'use strict';
/**
 * lifecycle migrate's job, and backup's key walk — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-foundation/3-a-tapestry-key-on-every-node.md (AC1)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0003-a-tapestry-key-on-every-node.md
 *          (Sub-decision 3, Decisions 6 and 10)
 *   Plan:  engineering-team/stories/graph-operations-foundation/3-a-tapestry-key-on-every-node.test-plan.md
 *
 * Stack-free. runDetached is driven with a stand-in worker, as in backup-job.test.js; the key walk through the
 * harness and the node-level fake graph, with a graph of 100,003 keys.
 *
 *   K1  runDetached with waitMs answers running once the wait is up, while the job runs on and keeps its lock
 *   K2  runDetached with waitMs answers the record when the job finishes within the wait
 *   K3  with the rule online, backup counts keys by walking the index, 50,000 at a time, and the digest is unchanged
 *   K4  a restore compares by the walk too: a backup written the old way restores with match: true
 *   K5  with no rule, backup counts keys as it always has
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const F = require('../../helpers/lifecycleFakes');

const ROOT = F.ROOT;
const NL = String.fromCharCode(10);
const JOBS = path.join(ROOT, 'src/operations/catalog/lifecycle/_jobs.js');
const { OWNER, ADMIN, show } = F;
const S = F.suite('lifecycle migrate job and key walk');
const { test } = S;
const assert = F.assert;
const need = (abs, why) => { if (!fs.existsSync(abs)) throw new Error(`${path.relative(ROOT, abs)} does not exist yet (${why})`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── runDetached's wait (Sub-decision 3) ──────────────────────────────────────────────────────────────────────────

/** A stand-in worker: notes it started, waits payload.delayMs, writes its record and releases its lock. */
const WORKER = [
  `'use strict';`,
  `const fs = require('fs'); const path = require('path');`,
  `const dir = process.env.TAPESTRY_BACKUPS_DIR; const runId = process.argv[2];`,
  `const file = path.join(dir, '.runs', runId + '.json');`,
  `const req = JSON.parse(fs.readFileSync(file, 'utf8'));`,
  `fs.writeFileSync(path.join(dir, 'started-' + runId), String(process.pid));`,
  `setTimeout(() => {`,
  `  fs.writeFileSync(file, JSON.stringify({ ...req, outcome: 'done', result: { echoed: req.payload.value }, finishedAt: new Date().toISOString() }));`,
  `  try { const l = JSON.parse(fs.readFileSync(path.join(dir, '.lock'), 'utf8')); if (l.runId === runId) fs.rmSync(path.join(dir, '.lock')); } catch {}`,
  `  process.exit(0);`,
  `}, req.payload.delayMs || 0);`,
].join(NL);

function jobDir(name) {
  const dir = fs.mkdtempSync(path.join(S.base(), `${name}-`));
  const backups = path.join(dir, 'backups');
  fs.mkdirSync(path.join(backups, '.runs'), { recursive: true, mode: 0o700 });
  const worker = path.join(dir, 'worker.js');
  fs.writeFileSync(worker, WORKER);
  return { dir, backups, worker, env: { ...process.env, TAPESTRY_BACKUPS_DIR: backups, HOME: dir } };
}
function callDetached(j, runId, payload, waitMs) {
  const script = path.join(j.dir, `caller-${runId}.js`);
  fs.writeFileSync(script, [
    `'use strict';`,
    `for (const k of ['log', 'info', 'debug', 'warn']) console[k] = () => {};`,
    `const jobs = require(${show(JOBS)});`,
    `const t0 = Date.now();`,
    `jobs.runDetached({ op: 'migrate', runId: ${show(runId)}, migration: 'tapestry-keys', payload: ${show(payload)} }, { workerPath: ${show(j.worker)}, waitMs: ${show(waitMs)} })`,
    `  .then((rec) => process.stdout.write('RESULT:' + JSON.stringify({ rec, took: Date.now() - t0 }) + '\\n'), (e) => process.stdout.write('RESULT:' + JSON.stringify({ threw: e.message }) + '\\n'));`,
  ].join(NL));
  const r = spawnSync(process.execPath, [script], { cwd: ROOT, env: j.env, encoding: 'utf8', timeout: 30000 });
  const line = String(r.stdout || '').split(NL).find((l) => l.startsWith('RESULT:'));
  return { out: line ? JSON.parse(line.slice(7)) : null, stderr: r.stderr };
}

test('K1: runDetached with waitMs answers { outcome: \'running\' } once the wait is up, while the job runs on, holds its lock, and later writes its record (Sub-decision 3)', async () => {
  need(JOBS, 'ADR graph-operations-foundation/0002 Decision 8');
  const j = jobDir('k1');
  const runId = F.newId();
  F.writeLock(j.backups, { runId, op: 'migrate', pid: process.pid, stage: 'online' });
  const { out, stderr } = callDetached(j, runId, { value: 1, delayMs: 4000 }, 600);
  assert(out && out.rec && out.rec.outcome === 'running', `runDetached answers { outcome: 'running' } past its wait; got ${show(out)} ${String(stderr).slice(-300)}`);
  assert(out.took < 2500, `it answers soon after the wait (600 ms), not when the job ends (4 s); it took ${out.took} ms`);
  assert(fs.existsSync(path.join(j.backups, '.lock')), 'the job keeps its lock: runDetached removes nothing when it answers running');
  const file = path.join(j.backups, '.runs', `${runId}.json`);
  let rec = null;
  for (let i = 0; i < 120; i++) {
    try { rec = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { rec = null; }
    if (rec && rec.outcome) break;
    await sleep(50);
  }
  assert(rec && rec.outcome === 'done' && rec.result.echoed === 1, `the job finishes on its own and writes its record; got ${show(rec)}`);
  assert(!fs.existsSync(path.join(j.backups, '.lock')), 'the job releases its lock when it ends');
});

test('K2: runDetached with waitMs answers the job\'s record when the job finishes within the wait (Sub-decision 3)', () => {
  need(JOBS, 'ADR graph-operations-foundation/0002 Decision 8');
  const j = jobDir('k2');
  const runId = F.newId();
  const { out, stderr } = callDetached(j, runId, { value: 2, delayMs: 0 }, 10000);
  assert(out && out.rec && out.rec.outcome === 'done' && out.rec.result && out.rec.result.echoed === 2, `a quick job's record comes back as before; got ${show(out)} ${String(stderr).slice(-300)}`);
  assert(out.took < 8000, `it answers when the record is written, not when the wait is up; it took ${out.took} ms`);
});

// ── Backup's key walk (Decision 10) ──────────────────────────────────────────────────────────────────────────────

const LABELLED = 100001;
/** A migrated graph of 100,001 labelled keys, in no order, and two keyed nodes without the label. */
function bigGraph() {
  const nodes = [];
  for (let i = 0; i < LABELLED; i++) nodes.push({ labels: ['NostrUser', 'TapestryNode'], key: crypto.randomUUID() });
  nodes.push({ labels: ['NostrEvent'], key: 'zz-unlabelled-1', id: 'e1', uuid: 'e1', tags: 1 });
  nodes.push({ labels: ['NostrUser'], key: '00-unlabelled-2' });
  return F.nodeGraph({ nodes, relationships: 3, schema: F.migratedSchema() });
}
const walkRun = () => S.setup('walk', {
  instance: { graph: bigGraph() },
  before: (inst) => ({ old: F.writeBackup(inst.backupsDir, {
    identityDir: inst.keysDir, graph: F.readState(inst.state).graph, note: 'written the A10.2 way', assistantPubkey: inst.identity.pubkey,
    ownerPubkey: OWNER, admins: [ADMIN], takenAt: '2026-11-01T00:00:00.000Z',
  }) }),
  scenario: (inst, { old }) => ({ requests: [
    { id: 'backup', method: 'POST', url: '/api/tapestry/lifecycle/backup', caller: 'owner', body: { note: 'big' } },
    { id: 'restore', method: 'POST', url: '/api/tapestry/lifecycle/restore', caller: 'owner', body: { backup: old.id } },
  ] }),
});

test('K3: with the rule online, backup counts keys by walking the rule\'s index 50,000 at a time, never all at once, and records the same counts and digest as before (ADR Decision 10)', async () => {
  const { inst, run } = await walkRun();
  const d = S.okData(run, 'backup');
  const m = JSON.parse(fs.readFileSync(path.join(inst.backupsDir, d.backup.id, 'manifest.json'), 'utf8'));
  const g = F.readState(inst.state).graph;
  const all = F.keysOf(g);
  assert(m.graph.tapestryKeys === LABELLED + 2 && m.graph.distinctTapestryKeys === LABELLED + 2, `the manifest counts every key, the two unlabelled ones included; got ${show({ k: m.graph.tapestryKeys, d: m.graph.distinctTapestryKeys })}`);
  assert(m.graph.tapestryKeyDigest === F.keyDigest(all), 'the digest is the same string\'s hash as before: every key, sorted, joined by a newline');
  const log = F.calls(inst.state, 'cypher');
  const pages = log.filter((e) => e.what === 'walk-page');
  assert(pages.length >= 6, `two counts (before and after the offline window), each in at least 3 pages of 100,001 keys; got ${pages.length} pages`);
  assert(pages.every((p) => p.size <= 50000), `no page is over 50,000 keys; got ${show(pages.map((p) => p.size))}`);
  assert(!log.some((e) => e.what === 'keys'), 'no query reads every key at once');
  assert(log.some((e) => e.what === 'unlabelled-keys'), 'the keys of nodes without the label are read too');
});

test('K4: a restore counts by the walk too, so a backup written the A10.2 way restores with match: true (ADR Decision 10)', async () => {
  const { inst, run } = await walkRun();
  const d = S.okData(run, 'restore');
  const counts = d && d.graph && d.graph.counts;
  assert(counts && counts.match === true && counts.exact === true, `the restored graph's counts match the backup's manifest (graph.counts.match); got ${show(counts || d).slice(0, 500)}`);
  const pages = F.calls(inst.state, 'cypher').filter((e) => e.what === 'walk-page');
  assert(pages.length >= 9, `the restore's counts walk the index too (backup's 2 counts, then the safety backup's and the restore's); got ${pages.length} pages`);
});

test('K5: with no rule online, backup counts keys as it always has, in one read (ADR Decision 10)', async () => {
  const nodes = [{ labels: ['NostrEvent'], key: 'k-a', id: 'a', uuid: 'a', tags: 1 }, { labels: ['NostrUser'], key: null }, { labels: ['NostrUser'], key: 'k-b' }];
  const { inst, run } = await S.setup('no-rule', {
    instance: { graph: F.nodeGraph({ nodes }) },
    scenario: () => ({ requests: [{ id: 'backup', method: 'POST', url: '/api/tapestry/lifecycle/backup', caller: 'owner', body: {} }] }),
  });
  const d = S.okData(run, 'backup');
  const m = JSON.parse(fs.readFileSync(path.join(inst.backupsDir, d.backup.id, 'manifest.json'), 'utf8'));
  assert(m.graph.tapestryKeys === 2 && m.graph.tapestryKeyDigest === F.keyDigest(['k-a', 'k-b']), `the counts are as before; got ${show(m.graph)}`);
  const log = F.calls(inst.state, 'cypher');
  assert(log.some((e) => e.what === 'show-indexes' || e.what === 'show-constraints'), 'backup asks whether the rule is online');
  assert(log.some((e) => e.what === 'keys') && !log.some((e) => e.what === 'walk-page'), `with no rule it reads the keys as before, without the walk; the fake saw ${show([...new Set(log.map((e) => e.what))])}`);
});

module.exports = { run: () => S.run() };

if (require.main === module) {
  module.exports.run().then((r) => process.exit(r.fail ? 1 : 0));
}
