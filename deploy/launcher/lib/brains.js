'use strict';
const { checkSlug } = require('./slug');
const { checkCaps } = require('./caps');
const { Refusal } = require('./refusal');

const DAY_MS = 24 * 60 * 60 * 1000;
const UNKNOWN_OWNER = 'someone no longer on the list';

/**
 * The launcher's rules: who may do what, in what order, and what state a brain is in. It knows brains through
 * `backend` and never what a container is (see backends/compose.js). Everything that touches the backend goes through
 * the queue, one at a time.
 */
function createBrains({ registry, backend, queue, getConfig, freeDiskGb, now = Date.now, log = console.log }) {
  /** slug -> what is happening to it now. A slug in here has work queued or running. */
  const work = new Map();
  const jobs = new Set();

  const iso = (ms) => new Date(ms).toISOString();
  const urlOf = (slug) => `https://${slug}.${getConfig().baseDomain}`;
  const errorText = (err) => String(err && err.message ? err.message : err);

  function schedule(slug, phase, job) {
    if (work.has(slug)) throw new Refusal(409, 'busy', `${slug} is busy. Wait for it to finish.`);
    work.set(slug, phase);
    const done = queue.enqueue(slug, async () => {
      try {
        await job((p) => work.set(slug, p));
      } catch (err) {
        log(`[launcher] ${slug}: ${errorText(err)}`);
      } finally {
        work.delete(slug);
      }
    });
    jobs.add(done);
    done.finally(() => jobs.delete(done));
    return done;
  }

  function owned(owner, slug) {
    const record = registry.find(slug);
    if (!record) throw new Refusal(404, 'not-found', `There is no brain named ${slug}.`);
    if (record.ownerPubkey !== owner) throw new Refusal(403, 'not-owner', 'Only the owner of this brain can do that.');
    return record;
  }

  function refuseOverCaps(owner, others, disk) {
    const over = checkCaps({ brains: others, owner, config: getConfig(), freeDiskGb: disk });
    if (over) throw new Refusal(409, over.code, over.message);
  }

  function fail(slug, err) {
    registry.transition(slug, 'failed', { lastError: errorText(err) });
  }

  async function runCreate(slug, ownerPubkey, imageTag, setPhase, { purgeFirst = false } = {}) {
    try {
      if (purgeFirst) {
        setPhase('deleting the old data');
        await backend.purge(slug);
      }
      setPhase('starting');
      await backend.create({ slug, ownerPubkey, imageTag, onPhase: setPhase });
      registry.transition(slug, 'running', { everRunning: true, lastError: null });
    } catch (err) {
      fail(slug, err);
      throw err;
    }
  }

  async function runRestore(slug, imageTag, setPhase) {
    try {
      await backend.restore({ slug, imageTag, onPhase: setPhase });
      return true;
    } catch (err) {
      fail(slug, err);
      throw err;
    }
  }

  return {
    /** Resolves when no work is left. */
    async idle() {
      while (jobs.size > 0) await Promise.allSettled([...jobs]);
    },

    list() {
      const { allowlist } = getConfig();
      return registry.live().map((r) => ({
        slug: r.slug,
        ownerPubkey: r.ownerPubkey,
        ownerLabel: allowlist.find((a) => a.pubkey === r.ownerPubkey)?.label ?? UNKNOWN_OWNER,
        status: r.status,
        createdAt: r.createdAt,
        reapAfter: r.reapAfter,
        url: urlOf(r.slug),
        phase: work.get(r.slug) ?? null,
        queued: queue.isWaiting(r.slug),
      }));
    },

    detail(owner, slug) {
      const r = owned(owner, slug);
      return {
        slug,
        status: r.status,
        imageTag: r.imageTag,
        lastError: r.lastError,
        createdAt: r.createdAt,
        reapAfter: r.reapAfter,
        url: urlOf(slug),
        logTail: backend.readLog(slug),
        neo4jPassword: backend.readPassword(slug),
      };
    },

    /** Status words only: what the page polls without asking for a signature. */
    publicStatus(slug) {
      const r = registry.find(slug);
      if (!r) return null;
      return { slug, status: r.status, phase: work.get(slug) ?? null, queued: queue.isWaiting(slug) };
    },

    askAllowed(domain) {
      const suffix = `.${getConfig().baseDomain}`;
      if (typeof domain !== 'string' || !domain.endsWith(suffix)) return false;
      const slug = domain.slice(0, -suffix.length);
      if (slug.includes('.')) return false;
      return registry.find(slug)?.status === 'running';
    },

    /** New brain, or retry when the signer owns a failed one under this name. */
    async create(owner, slug) {
      const bad = checkSlug(slug);
      if (bad) throw new Refusal(400, bad.code, bad.message);
      const disk = await freeDiskGb();

      const existing = registry.find(slug);
      const retrying = existing && existing.status === 'failed' && existing.ownerPubkey === owner;
      if (existing && !retrying) {
        throw new Refusal(409, 'slug-taken', `The name ${slug} is taken. A name stays taken until its data is deleted.`);
      }
      if (work.has(slug)) throw new Refusal(409, 'busy', `${slug} is busy. Wait for it to finish.`);
      refuseOverCaps(owner, registry.live().filter((r) => r !== existing), disk);

      const { imageTag } = getConfig();
      if (retrying) {
        const { everRunning } = existing;
        registry.transition(slug, 'creating', { lastError: null });
        schedule(slug, 'starting', async (setPhase) => {
          if (everRunning) {
            await runRestore(slug, imageTag, setPhase);
            registry.transition(slug, 'running', { lastError: null });
          } else {
            await runCreate(slug, owner, imageTag, setPhase, { purgeFirst: true });
          }
        });
      } else {
        registry.add({
          slug, ownerPubkey: owner, status: 'creating', imageTag, createdAt: iso(now()),
          destroyedAt: null, reapAfter: null, lastError: null, everRunning: false,
        });
        schedule(slug, 'starting', (setPhase) => runCreate(slug, owner, imageTag, setPhase));
      }
      return { slug, status: 'creating' };
    },

    async destroy(owner, slug) {
      const r = owned(owner, slug);
      if (work.has(slug)) throw new Refusal(409, 'busy', `${slug} is busy. Wait for it to finish.`);
      if (r.status !== 'running' && r.status !== 'failed') {
        throw new Refusal(409, 'wrong-state', `${slug} is ${r.status}, so it cannot be destroyed now.`);
      }
      // A brain that has run holds real data, so it gets the grace period even if it has since failed.
      const noGrace = r.status === 'failed' && !r.everRunning;
      schedule(slug, 'destroying', async () => {
        try {
          if (noGrace) {
            await backend.purge(slug);
            registry.transition(slug, 'destroyed', { destroyedAt: iso(now()) });
          } else {
            await backend.destroy(slug);
            registry.transition(slug, 'stopped', {
              destroyedAt: iso(now()),
              reapAfter: iso(now() + getConfig().graceDays * DAY_MS),
            });
          }
        } catch (err) {
          registry.patch(slug, { lastError: errorText(err) });
          throw err;
        }
      });
      return { slug, status: r.status, phase: 'destroying' };
    },

    async restore(owner, slug) {
      const r = owned(owner, slug);
      if (r.status !== 'stopped') throw new Refusal(409, 'wrong-state', `${slug} is ${r.status}, so there is nothing to restore.`);
      if (Date.parse(r.reapAfter) <= now()) throw new Refusal(409, 'grace-over', `The grace period for ${slug} is over.`);
      refuseOverCaps(owner, registry.live(), await freeDiskGb());
      schedule(slug, 'restoring', async (setPhase) => {
        await runRestore(slug, r.imageTag, setPhase);
        registry.transition(slug, 'running', { destroyedAt: null, reapAfter: null, lastError: null });
      });
      return { slug, status: r.status, phase: 'restoring' };
    },

    /** From stopped: delete the kept data now and create the brain again under the same name. */
    async startFresh(owner, slug) {
      const r = owned(owner, slug);
      if (r.status !== 'stopped') throw new Refusal(409, 'wrong-state', 'Only a stopped brain can start fresh. Destroy it first.');
      if (work.has(slug)) throw new Refusal(409, 'busy', `${slug} is busy. Wait for it to finish.`);
      refuseOverCaps(owner, registry.live(), await freeDiskGb());
      const { imageTag } = getConfig();
      registry.transition(slug, 'creating', {
        imageTag, createdAt: iso(now()), destroyedAt: null, reapAfter: null, lastError: null, everRunning: false,
      });
      schedule(slug, 'deleting the old data', (setPhase) => runCreate(slug, owner, imageTag, setPhase, { purgeFirst: true }));
      return { slug, status: 'creating' };
    },

    /** Deletes the data of brains past their grace period. Returns the slugs it deleted. */
    async reap() {
      const reaped = [];
      const due = registry.live().filter((r) => r.status === 'stopped' && Date.parse(r.reapAfter) <= now());
      await Promise.all(due.map((r) => schedule(r.slug, 'deleting', async () => {
        await backend.purge(r.slug);
        registry.transition(r.slug, 'destroyed');
        reaped.push(r.slug);
      })));
      return reaped;
    },

    /** Pulls the image once, then updates each running brain in turn, stopping at the first that does not come back. */
    async roll(imageTag, say = () => {}) {
      try {
        say(`pulling ${imageTag}`);
        await queue.enqueue('roll', () => backend.pullImages(imageTag));
      } catch (err) {
        say(`the pull failed: ${errorText(err)}`);
        return { ok: false, error: errorText(err) };
      }
      const rolled = [];
      for (const { slug } of registry.live().filter((r) => r.status === 'running')) {
        const outcome = await queue.enqueue(slug, async () => {
          if (registry.find(slug)?.status !== 'running' || work.has(slug)) return 'skipped';
          work.set(slug, 'updating');
          try {
            say(`updating ${slug}`);
            await backend.restore({ slug, imageTag, onPhase: (p) => work.set(slug, p) });
            registry.patch(slug, { imageTag, lastError: null });
            return 'rolled';
          } catch (err) {
            fail(slug, err);
            say(`${slug} did not come back: ${errorText(err)}`);
            return 'failed';
          } finally {
            work.delete(slug);
          }
        });
        if (outcome === 'failed') return { ok: false, failed: slug, rolled };
        if (outcome === 'rolled') rolled.push(slug);
      }
      say(`done: ${rolled.length} updated`);
      return { ok: true, rolled };
    },

    /** Runs when the launcher starts: puts the world back in line with the registry. */
    async reconcile() {
      for (const r of registry.live()) {
        if (r.status === 'creating') {
          registry.transition(r.slug, 'failed', { lastError: 'The launcher restarted while this brain was being created.' });
        }
      }
      for (const r of registry.live().filter((b) => b.status === 'running')) {
        await queue.enqueue(r.slug, async () => {
          try {
            await backend.ensureUp(r.slug);
          } catch (err) {
            log(`[launcher] reconcile ${r.slug}: ${errorText(err)}`);
            fail(r.slug, err);
          }
        });
      }
    },
  };
}

module.exports = { createBrains };
