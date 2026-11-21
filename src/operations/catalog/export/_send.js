'use strict';
/**
 * export nostr's sender (story graph-operations-first-slice #34, AC1; ADR graph-operations-first-slice/0034 Decision 6).
 * It is another server-side publisher, beside dlist-curation's and assistant-profile's, under its own ADR and its own
 * exclusion (Decision 11): RE1 (test/publish-export-a-concept.test.js) excludes src/operations/catalog/export/, where
 * this file sits, and catches a publisher built this way anywhere else.
 *
 *   strfryImport(lines, { ms }) the seam for the instance's own relay: `strfry import` with the letters as JSONL on
 *                              stdin, as src/api/normalize/helpers.js puts a letter into it, its child killed after
 *                              `ms` (IMPORT_MS, 30 s, at the most). Resolves { code } once it ran or was killed,
 *                              rejects when it couldn't run. Its exit code is never taken as an answer: strfry exits 0
 *                              when it refuses an event, so each letter is read back by id (toOwn).
 *   now()                      the Unix time in seconds a letter's created_at starts from
 *   OK_MS, IN_FLIGHT           how long a relay has to send a letter's OK (5 s), and how many letters wait for theirs at
 *                              a time on one relay (8)
 *   toOwn(letters, conn, opts) put the letters into the instance's own relay and read each back by id over `conn`
 *                              (import's reader, src/operations/catalog/import/_relay.js) → Map(id → { status, reason }),
 *                              status accepted, refused, unread or unreachable (opts.deadline: the import is given
 *                              the time left until it, IMPORT_MS at the most, and is stopped then, its letters as the
 *                              read-back finds them (Amendment 2 item 5); no read-back starts after it, and what it
 *                              would have read is unread)
 *   toRelay(url, letters, opts)  send letters to one outside relay over one connection → Map(id → { status, reason }),
 *                              status accepted, refused, timeout, unreachable or not-sent (opts.cutoffAt: no send
 *                              starts after it; such a letter's answer carries cut: true, for next.after)
 * Each is read through this object at each call, so a suite can replace or shrink it (test/helpers/relayFake.js's
 * installStrfry). It signs nothing and reads no key: the letters come to it signed. It opens nothing when it loads.
 */

const OWN_RELAY = 'ws://127.0.0.1:7777';
const READ_BATCH = 100;
/** The longest a strfry import is given (Amendment 2 item 5): never more than 30 s, whatever the call has left. */
const IMPORT_MS = 30000;
/** How much longer toOwn waits, once the import's time is up, for its killed child to close before reading back. */
const STOP_MS = 1000;

const words = (err) => require('../import/_letters').words(err);
const answer = (status, reason = null) => ({ status, reason: reason === undefined || reason === '' ? null : reason });

/** One publish, waited for within `ms`: accepted (OK true), refused (OK false), timeout or unreachable. */
async function publishOne(relay, event, ms) {
  if (relay.connected === false) return answer('unreachable', 'the relay closed the connection before this letter was sent');
  let timer = null;
  let late = false;
  const waited = new Promise((resolve) => { timer = setTimeout(() => { late = true; resolve(null); }, ms); });
  // A rejection that comes after the wait is over is caught here too, so nothing is left unhandled.
  const sent = Promise.resolve().then(() => relay.publish(event)).then((reason) => ({ ok: true, reason }), (err) => ({ ok: false, err }));
  try {
    const got = await Promise.race([sent, waited]);
    if (got === null || late) return answer('timeout', `the relay sent no OK within ${ms / 1000} s`);
    if (got.ok) return answer('accepted', typeof got.reason === 'string' ? got.reason : null);
    const why = words(got.err);
    if (relay.connected === false) return answer('unreachable', why);
    if (/^publish timed out/.test(why)) return answer('timeout', why);
    return answer('refused', why);
  } finally {
    clearTimeout(timer);
  }
}

const sender = {
  OK_MS: 5000,
  IN_FLIGHT: 8,

  now() {
    return Math.floor(Date.now() / 1000);
  },

  strfryImport(lines, { ms = IMPORT_MS } = {}) {
    const text = Array.isArray(lines) ? lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') : String(lines);
    const limit = Number.isFinite(ms) ? Math.max(0, Math.min(ms, IMPORT_MS)) : IMPORT_MS;
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      let child;
      try {
        child = spawn('strfry', ['import'], { stdio: ['pipe', 'ignore', 'pipe'] });
      } catch (err) {
        reject(err);
        return;
      }
      let stderr = '';
      let done = false;
      // Stopped when its time is up: what it kept by then is read back either way.
      const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, limit);
      child.on('error', (err) => { if (done) return; done = true; clearTimeout(timer); reject(new Error(`strfry import could not run: ${words(err)}`)); });
      child.stderr.on('data', (d) => { if (stderr.length < 4000) stderr += String(d); });
      child.on('close', (code, signal) => { if (done) return; done = true; clearTimeout(timer); resolve({ code, signal, stderr }); });
      // It may exit before it has read everything: what it kept is read back either way.
      child.stdin.on('error', () => {});
      child.stdin.end(text.endsWith('\n') ? text : `${text}\n`);
    });
  },

  async toOwn(letters, conn, { deadline = Infinity } = {}) {
    const out = new Map();
    if (!letters.length) return out;
    // The import is given the call's time left, IMPORT_MS at the most, and is killed then (Amendment 2 item 5). It is
    // waited for STOP_MS longer, so the read-back comes after its child closed, and no longer, so one that never ends
    // can't hold the call. Its answer is caught here whenever it comes.
    const ms = Math.max(0, Math.min(deadline - Date.now(), IMPORT_MS));
    let timer = null;
    const stopped = new Promise((resolve) => { timer = setTimeout(() => resolve({ stopped: true }), ms + STOP_MS); });
    const importing = Promise.resolve()
      .then(() => sender.strfryImport(letters.map((e) => JSON.stringify(e)).join('\n'), { ms }))
      .then(() => ({ ran: true }), (err) => ({ err }));
    const imported = await Promise.race([importing, stopped]);
    clearTimeout(timer);
    if (imported.err) {
      for (const e of letters) out.set(e.id, answer('unreachable', `strfry import could not run, so the instance's own relay was never given it: ${words(imported.err)}`));
      return out;
    }
    const ids = letters.map((e) => e.id);
    for (let i = 0; i < ids.length; i += READ_BATCH) {
      const chunk = ids.slice(i, i + READ_BATCH);
      const got = Date.now() > deadline ? { ok: false, error: "the call's time ran out first" }
        : conn && !conn.error ? await conn.request({ ids: chunk }) : { ok: false, error: conn && conn.error ? conn.error : 'no connection to it' };
      const held = new Set(got.ok ? got.events.filter((e) => e && typeof e === 'object').map((e) => e.id) : []);
      for (const id of chunk) {
        if (!got.ok) out.set(id, answer('unread', `the instance's own relay couldn't be read back (${got.error}), so nothing is claimed for this letter`));
        else if (held.has(id)) out.set(id, answer('accepted'));
        else out.set(id, answer('refused', "the instance's own relay didn't store it: strfry import took it and kept nothing"));
      }
    }
    return out;
  },

  async toRelay(url, letters, { cutoffAt = Infinity } = {}) {
    const out = new Map();
    if (!letters.length) return out;
    // cut marks the letters the time cut short, for next.after; it isn't answered.
    const cut = () => ({ ...answer('not-sent', "the call's time to send ran out before this letter's turn; the next call, from next.after, sends it"), cut: true });
    if (Date.now() > cutoffAt) {
      for (const e of letters) out.set(e.id, cut());
      return out;
    }
    const conn = await require('../import/_relay').open(url);
    if (conn.error) {
      for (const e of letters) out.set(e.id, answer('unreachable', `the relay couldn't be reached: ${conn.error}`));
      return out;
    }
    const relay = conn.relay;
    const ms = sender.OK_MS;
    // nostr-tools' own publish timer waits longer than this one, so OK_MS is the one that counts.
    if (relay && typeof relay.publishTimeout === 'number') relay.publishTimeout = ms + 1000;
    try {
      const queue = [...letters];
      const worker = async () => {
        while (queue.length) {
          const e = queue.shift();
          if (Date.now() > cutoffAt) { out.set(e.id, cut()); continue; }
          out.set(e.id, await publishOne(relay, e, ms));
        }
      };
      const n = Math.max(1, Math.min(Math.floor(sender.IN_FLIGHT) || 1, letters.length));
      await Promise.all(Array.from({ length: n }, worker));
    } finally {
      conn.close();
    }
    return out;
  },
};

sender.OWN_RELAY = OWN_RELAY;

module.exports = sender;
