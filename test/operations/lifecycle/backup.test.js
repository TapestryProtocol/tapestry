'use strict';
/**
 * lifecycle backup — its own suite, run by test/operations.test.js (ADR graph-operations-foundation/0001 Decision 12).
 *   Story: engineering-team/stories/graph-operations-foundation/2-lifecycle-backup-and-restore.md (AC1, AC5, AC6)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0002-backup-and-restore-the-whole-instance.md
 *   Plan:  engineering-team/stories/graph-operations-foundation/2-lifecycle-backup-and-restore.test-plan.md
 *
 * Stack-free. The route and the command run in a child process (test/helpers/operationsHarness.js) against a
 * temporary instance (test/helpers/lifecycleFakes.js): a real encrypted assistant key, a conf, settings, a backups
 * folder, and a fake supervisor, neo4j-admin and graph database in place of _system.js (ADR Decision 8), with the
 * job run in the same process.
 *
 *   B1   the declaration: a write for the owner and admins, a `note` of 1–200 characters, refusals busy and graph-unavailable
 *   B2   a backup folder holds the graph's dump, the assistant's key, its master key and the admins, with a manifest
 *   B3   the answer: id, when, note, size, what it holds, how long the graph was offline
 *   B4   the offline window: writers paused, counted, server stopped, info, dump, server started, counted, writers resumed
 *   B5   a writer that wasn't running isn't started
 *   B6   a write while the backup is taken leaves the counts marked not exact, with a warning
 *   B7   json tags offloaded to the LMDB are counted and warned about
 *   B8   a dump that fails: the server comes back, the writers resume, nothing is kept, the lock is gone
 *   B9   a store that needs recovery after the stop is never dumped, and the server comes back
 *   B10  while a backup or restore runs, backup refuses busy and touches nothing
 *   B11  a graph that doesn't answer is refused graph-unavailable before anything stops
 *   B12  a stale lock is recovered first: the server started, its incomplete folder removed, its run recorded interrupted
 *   B13  a lock from another host (a recreated container) is stale too
 *   B14  a key that doesn't decrypt to the instance's assistant fails the backup before the server stops
 *   B15  who may call: owner and admins; visitors 401, strangers 403; a note over 200 characters is refused 400
 *   B16  the command takes a backup without signing in, says on stderr that the job finishes on its own
 *   B17  backups live on the data volume: /var/lib/brainstorm/backups by default
 *   B18  no answer, warning or log line carries a private key or a master key
 *   B19  an instance with no admins records none, not its launch settings' empty quotes (found by the live check)
 *   B20  a stop that stops the server but then fails is still undone (review round 1)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const F = require('../../helpers/lifecycleFakes');

const ROOT = F.ROOT;
const NL = String.fromCharCode(10);
const ROUTE = '/api/tapestry/lifecycle/backup';
const DECL = path.join(ROOT, 'src/operations/catalog/lifecycle/backup.js');
const { OWNER, ADMIN, show } = F;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
let BASE = null;
const base = () => { if (!BASE) BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-backup-')); return BASE; };

function mustExist(abs, why) {
  if (!fs.existsSync(abs)) throw new Error(`${path.relative(ROOT, abs)} does not exist yet (${why})`);
}
const modeOf = (p) => fs.statSync(p).mode & 0o777;

/** One harness run per named setup, shared by the tests that read it. */
const RUNS = {};
async function setup(name, { instance = {}, before, scenario }) {
  if (RUNS[name]) return RUNS[name];
  mustExist(DECL, 'ADR graph-operations-foundation/0002 Decision 1');
  const inst = await F.makeInstance(base(), { name, owner: OWNER, admins: [ADMIN], ...instance });
  const extra = before ? await before(inst) : {};
  const spec = { scenarios: [{ lifecycleFake: { stateFile: inst.state }, ...scenario(inst, extra) }] };
  const run = F.runHarness(spec, inst.env, base());
  RUNS[name] = { inst, run, extra };
  return RUNS[name];
}
const post = (id, caller, body) => ({ id, method: 'POST', url: ROUTE, caller, body: body === undefined ? {} : body });

function healthy() {
  return setup('healthy', {
    scenario: () => ({
      requests: [
        post('owner', 'owner', { note: '  before migrate  ' }),
        post('admin', 'admin', {}),
        post('visitor', 'visitor', {}),
        post('stranger', 'stranger', {}),
        post('long-note', 'owner', { note: 'x'.repeat(201) }),
      ],
      cli: [{ id: 'cli', argv: ['lifecycle', 'backup', '--note', 'from the shell'] }],
    }),
  });
}
/** The data of a 200 answer, or throw what came instead. */
function okData(run, id) {
  const r = F.pick(run, id);
  assert(r.status === 200 && r.body && r.body.success === true, `'${id}' must answer 200 { success: true, data }; got ${r.status} ${show(r.body).slice(0, 600)}`);
  return r.body.data;
}

test('B1: the declaration is a write for the owner and admins, takes a note of 1–200 characters, and declares busy and graph-unavailable', () => {
  mustExist(DECL, 'ADR graph-operations-foundation/0002 Decision 1');
  const { loadOperations } = require(path.join(ROOT, 'src/operations/index.js'));
  const { operations, problems } = loadOperations();
  const mine = problems.filter((p) => p.file.startsWith('lifecycle/'));
  assert(mine.length === 0, `the lifecycle declarations must load cleanly; problems: ${show(mine)}`);
  const op = operations.find((o) => o.group === 'lifecycle' && o.name === 'backup');
  assert(op, 'lifecycle backup is not among the loaded operations');
  assert(op.kind === 'write' && op.method === 'POST' && op.access === 'owner-and-admins', `backup must be a POST write for the owner and admins; got ${op.kind} ${op.method} ${op.access}`);
  const note = op.inputs.note;
  assert(note && note.required !== true && note.schema && note.schema.type === 'string' && note.schema.minLength === 1 && note.schema.maxLength === 200,
    `backup takes an optional note, a string of 1–200 characters; got ${show(note)}`);
  assert(Object.keys(op.inputs).length === 1, `backup's only input is note; got ${show(Object.keys(op.inputs))}`);
  const r = Object.fromEntries(op.declaredRefusals.map((x) => [x.code, x.status]));
  assert(r.busy === 409 && r['graph-unavailable'] === 409, `backup declares busy (409) and graph-unavailable (409); got ${show(r)}`);
});

test('B2: a backup folder holds the dump, the assistant key and master key byte for byte, and the admins, with a manifest of sizes and sha256s (AC1)', async () => {
  const { inst, run } = await healthy();
  const d = okData(run, 'owner');
  const id = d && d.backup && d.backup.id;
  assert(F.ID_RE.test(String(id)), `the backup's id is YYYYMMDDTHHMMSSZ-<8 hex>; got ${show(id)}`);
  const folder = path.join(inst.backupsDir, id);
  assert(fs.existsSync(folder), `the backup is the folder ${folder}`);
  const files = F.folderFiles(folder);
  const names = Object.keys(files).sort();
  assert(show(names) === show([...F.MEMBER_ORDER].sort()), `a backup taken here holds exactly ${show([...F.MEMBER_ORDER].sort())}; got ${show(names)}`);
  assert(files['identity/tapestry-assistant.json'].equals(fs.readFileSync(path.join(inst.keysDir, 'tapestry-assistant.json'))),
    'identity/tapestry-assistant.json is the secure-keys file, byte for byte');
  assert(files['identity/master-key'].equals(fs.readFileSync(path.join(inst.keysDir, '.master-key'))),
    'identity/master-key is the secure-keys .master-key, byte for byte');
  const admins = JSON.parse(files['admins.json']);
  assert(show(admins.pubkeys) === show([ADMIN]) && admins.from === 'settings', `admins.json is { pubkeys: [the admin], from: 'settings' }; got ${show(admins)}`);
  const dumped = F.parseFakeDump(files['neo4j.dump']);
  assert(dumped && dumped.tx === 18 && show(dumped.keys) === show(['k-0001', 'k-0002', 'k-0003']),
    `neo4j.dump is what neo4j-admin dump wrote (the fake graph at the stop); got ${show(dumped)}`);
  const m = JSON.parse(files['manifest.json']);
  const want = { format: 'tapestry-backup', version: 1, id, note: 'before migrate', reason: 'requested', restoring: null };
  for (const [k, v] of Object.entries(want)) assert(show(m[k]) === show(v), `manifest.${k} must be ${show(v)}; got ${show(m[k])}`);
  assert(!Number.isNaN(Date.parse(m.takenAt)), `manifest.takenAt is an ISO time; got ${show(m.takenAt)}`);
  assert(m.instance && m.instance.assistantPubkey === inst.identity.pubkey && m.instance.ownerPubkey === OWNER,
    `manifest.instance names the assistant and the owner; got ${show(m.instance)}`);
  assert(m.admins && show(m.admins.pubkeys) === show([ADMIN]) && m.admins.from === 'settings', `manifest.admins; got ${show(m.admins)}`);
  const counts = F.countsOf(F.defaultGraph());
  const g = m.graph || {};
  for (const [k, v] of Object.entries(counts)) assert(show(g[k]) === show(v), `manifest.graph.${k} must be ${show(v)}; got ${show(g[k])}`);
  assert(g.neo4jVersion === '5.26.10' && g.storeFormat === 'record-aligned-1.1' && g.lastCommittedTransaction === '18' && g.countsExact === true && g.offloadedJsonTags === 0,
    `manifest.graph records the version, the store format and transaction (as info prints them), exact counts and no offloaded tags; got ${show(g)}`);
  assert(Number.isInteger(m.offlineMs) && m.offlineMs >= 0, `manifest.offlineMs is a whole number of ms; got ${show(m.offlineMs)}`);
  for (const name of F.MEMBER_ORDER.filter((n) => n !== 'manifest.json')) {
    const e = (m.files || {})[name];
    assert(e && e.size === files[name].length && e.sha256 === F.sha256(files[name]), `manifest.files['${name}'] has its size and sha256; got ${show(e)}`);
  }
  assert(modeOf(inst.backupsDir) === 0o700 && modeOf(folder) === 0o700, `the backups folder and the backup are mode 0700; got ${modeOf(inst.backupsDir).toString(8)} ${modeOf(folder).toString(8)}`);
  for (const name of names) assert(modeOf(path.join(folder, name)) === 0o600, `${name} is mode 0600; got ${modeOf(path.join(folder, name)).toString(8)}`);
});

test('B3: the answer gives the id, when, note, size, what it holds and how long the graph was offline (AC1)', async () => {
  const { inst, run } = await healthy();
  const d = okData(run, 'owner');
  const b = d.backup || {};
  const folder = path.join(inst.backupsDir, b.id);
  const size = Object.values(F.folderFiles(folder)).reduce((n, x) => n + x.length, 0);
  assert(b.note === 'before migrate' && b.origin === 'taken' && b.reason === 'requested' && !Number.isNaN(Date.parse(b.takenAt)),
    `backup is { id, takenAt, note (trimmed), origin: 'taken', reason: 'requested', size }; got ${show(b)}`);
  assert(b.size === size, `backup.size is the sum of its files (${size}); got ${show(b.size)}`);
  const h = d.holds || {};
  const want = { nodes: 5, relationships: 4, tapestryKeys: 3, countsExact: true, assistantPubkey: inst.identity.pubkey, ownerPubkey: OWNER, offloadedJsonTags: 0 };
  for (const [k, v] of Object.entries(want)) assert(show(h[k]) === show(v), `holds.${k} must be ${show(v)}; got ${show(h[k])}`);
  assert(show(h.admins) === show([ADMIN]), `holds.admins are the instance's admins; got ${show(h.admins)}`);
  assert(d.graph && d.graph.neo4jVersion === '5.26.10' && d.graph.lastCommittedTransaction === '18' && d.graph.storeFormat === 'record-aligned-1.1',
    `graph names the version, transaction and store format; got ${show(d.graph)}`);
  assert(Number.isInteger(d.offlineMs) && d.offlineMs >= 0 && Array.isArray(d.warnings), `offlineMs and warnings; got ${show({ offlineMs: d.offlineMs, warnings: d.warnings })}`);
  const admin = okData(run, 'admin');
  assert(admin.backup && admin.backup.note === null && F.ID_RE.test(admin.backup.id) && admin.backup.id !== b.id,
    `a second backup, with no note, gets its own id and note null; got ${show(admin.backup)}`);
});

test('B4: the offline window — writers paused, counted, server stopped, info, dump, server started, counted again, writers resumed (AC1)', async () => {
  const { inst } = await healthy();
  const t = F.trace(inst.state);
  const stopsWriter = (w) => [new RegExp(`^stop (.*\\+)?${w}(\\+|$)`), `stop ${w}`];
  const startsWriter = (w) => [new RegExp(`^start (.*\\+)?${w}(\\+|$)`), `start ${w}`];
  F.inOrder(t, [stopsWriter('stream-consumer'), [/^count:keys$/, 'the keys counted before'], [/^stop neo4j$/, 'stop neo4j'], [/^info$/, 'info'], [/^dump$/, 'dump'],
    [/^start neo4j$/, 'start neo4j'], [/^count:keys$/, 'the keys counted after'], startsWriter('stream-consumer')]);
  F.inOrder(t, [stopsWriter('tagging-edges-realtime'), [/^stop neo4j$/, 'stop neo4j'], [/^start neo4j$/, 'start neo4j'], startsWriter('tagging-edges-realtime')]);
  const dumps = F.calls(inst.state, 'neo4jAdmin').filter((e) => e.args.includes('dump'));
  assert(dumps.length >= 1 && dumps.every((e) => e.online === false), `every dump runs with the server stopped; got ${show(dumps)}`);
  const s = F.readState(inst.state);
  assert(s.online === true && s.programs['stream-consumer'] === 'RUNNING' && s.programs['tagging-edges-realtime'] === 'RUNNING',
    `afterwards the server is online and both writers run; got ${show({ online: s.online, programs: s.programs })}`);
  assert(!fs.existsSync(path.join(inst.backupsDir, '.lock')), 'the lock is gone once the backup is done');
});

function edgy() {
  return setup('edgy', {
    instance: {
      graph: { offloaded: 3 },
      programs: { 'tagging-edges-realtime': 'STOPPED' },
      failures: { writeAfterStart: 1 },
    },
    scenario: () => ({ requests: [post('edgy', 'owner', {})] }),
  });
}

test('B5: a writer that wasn\'t running is neither stopped nor started; the one that was is paused and resumed (AC1)', async () => {
  const { inst, run } = await edgy();
  okData(run, 'edgy');
  const sup = F.calls(inst.state, 'supervisor');
  assert(!sup.some((e) => e.action === 'start' && e.programs.includes('tagging-edges-realtime')), `tagging-edges-realtime was stopped, so it is never started; got ${show(sup)}`);
  assert(sup.some((e) => e.action === 'stop' && e.programs.includes('stream-consumer')) && sup.some((e) => e.action === 'start' && e.programs.includes('stream-consumer')),
    `stream-consumer was running: paused, then resumed; got ${show(sup)}`);
  assert(F.readState(inst.state).programs['tagging-edges-realtime'] === 'STOPPED', 'tagging-edges-realtime is still stopped');
});

test('B6: a write that lands while the backup is taken leaves the counts of before, marked not exact, with a warning (AC1)', async () => {
  const { inst, run } = await edgy();
  const d = okData(run, 'edgy');
  assert(d.holds && d.holds.countsExact === false && d.holds.tapestryKeys === 3, `the counts are those of before (3 keys), not exact; got ${show(d.holds)}`);
  const m = JSON.parse(fs.readFileSync(path.join(inst.backupsDir, d.backup.id, 'manifest.json'), 'utf8'));
  assert(m.graph.countsExact === false && m.graph.tapestryKeyDigest === F.keyDigest(F.defaultGraph().keys),
    `the manifest keeps the counts and digest of before, marked not exact; got ${show(m.graph)}`);
  assert((d.warnings || []).some((w) => /chang/i.test(w)), `a warning says the graph changed while the backup was taken; got ${show(d.warnings)}`);
});

test('B7: json tags offloaded to the LMDB, which a backup doesn\'t carry, are counted and warned about (AC1)', async () => {
  const { run } = await edgy();
  const d = okData(run, 'edgy');
  assert(d.holds && d.holds.offloadedJsonTags === 3, `holds.offloadedJsonTags counts them; got ${show(d.holds)}`);
  assert((d.warnings || []).some((w) => /offload|LMDB|cache/i.test(w)), `a warning says they aren't in the backup; got ${show(d.warnings)}`);
});

test('B8: a dump that fails brings the server back and the writers with it, keeps nothing and leaves no lock', async () => {
  const { inst, run } = await setup('dump-fails', { instance: { failures: { dump: true } }, scenario: () => ({ requests: [post('fails', 'owner', {})] }) });
  const r = F.pick(run, 'fails');
  assert(r.status === 500 && r.body && r.body.code === 'failed' && /backup/i.test(String(r.body.error)),
    `a failed dump answers 500 failed, in words; got ${r.status} ${show(r.body)}`);
  const s = F.readState(inst.state);
  assert(s.online === true && s.programs['stream-consumer'] === 'RUNNING' && s.programs['tagging-edges-realtime'] === 'RUNNING',
    `the server is online again and both writers run; got ${show({ online: s.online, programs: s.programs })}`);
  F.inOrder(F.trace(inst.state), [[/^stop neo4j$/, 'stop neo4j'], [/^dump$/, 'dump'], [/^start neo4j$/, 'start neo4j']]);
  assert(F.backupIds(inst.backupsDir).length === 0 && F.leftovers(inst.backupsDir).length === 0,
    `nothing is kept: no backup, no incomplete folder, no lock; got ${show(fs.existsSync(inst.backupsDir) ? fs.readdirSync(inst.backupsDir) : [])}`);
});

test('B9: a store that needs recovery after the stop is never dumped, and the server comes back', async () => {
  const { inst, run } = await setup('recovery', { instance: { failures: { recoveryRequired: true } }, scenario: () => ({ requests: [post('rec', 'owner', {})] }) });
  const r = F.pick(run, 'rec');
  assert(r.status === 500 && r.body && r.body.code === 'failed', `answers 500 failed; got ${r.status} ${show(r.body)}`);
  const t = F.trace(inst.state);
  assert(t.includes('info') && !t.includes('dump'), `info is read and nothing is dumped; got ${show(t)}`);
  assert(F.readState(inst.state).online === true, 'the server is online again');
  assert(F.backupIds(inst.backupsDir).length === 0 && F.leftovers(inst.backupsDir).length === 0, 'nothing is kept');
});

test('B10: while a backup or restore runs, backup refuses 409 busy and touches nothing (AC5)', async () => {
  const { inst, run, extra } = await setup('busy', {
    before: (i) => ({ lock: F.writeLock(i.backupsDir, { op: 'restore', pid: process.pid }) }),
    scenario: () => ({ requests: [post('busy', 'owner', {})] }),
  });
  const r = F.pick(run, 'busy');
  assert(r.status === 409 && r.body && r.body.code === 'busy' && /restore|backup/i.test(String(r.body.error)),
    `a backup during a running restore is refused 409 busy, saying so; got ${r.status} ${show(r.body)}`);
  assert(F.calls(inst.state, 'supervisor').length === 0 && F.calls(inst.state, 'neo4jAdmin').length === 0, `nothing is stopped or dumped; got ${show(F.trace(inst.state))}`);
  const lock = JSON.parse(fs.readFileSync(path.join(inst.backupsDir, '.lock'), 'utf8'));
  assert(lock.runId === extra.lock.runId, 'the running job\'s lock is left as it was');
});

test('B11: a graph that doesn\'t answer is refused 409 graph-unavailable before anything stops', async () => {
  const { inst, run } = await setup('graph-down', { instance: { failures: { cypherDown: true } }, scenario: () => ({ requests: [post('down', 'owner', {})] }) });
  const r = F.pick(run, 'down');
  assert(r.status === 409 && r.body && r.body.code === 'graph-unavailable', `answers 409 graph-unavailable; got ${r.status} ${show(r.body)}`);
  assert(!F.calls(inst.state, 'supervisor').some((e) => e.action === 'stop' && e.programs.includes('neo4j')), `the server is never stopped; got ${show(F.trace(inst.state))}`);
  assert(F.backupIds(inst.backupsDir).length === 0 && F.leftovers(inst.backupsDir).length === 0, 'nothing is kept');
});

test('B12: a stale lock is recovered first — the server started, its incomplete folder removed, its run recorded interrupted — then the backup runs', async () => {
  const { inst, run, extra } = await setup('stale', {
    before: (i) => {
      const staleId = F.newId(new Date(Date.now() - 3600e3));
      fs.mkdirSync(path.join(i.backupsDir, staleId), { recursive: true, mode: 0o700 });
      fs.writeFileSync(path.join(i.backupsDir, staleId, 'neo4j.dump'), 'half a dump');
      const lock = F.writeLock(i.backupsDir, { op: 'backup', pid: F.deadPid(), stage: 'offline', backup: staleId });
      const s = F.readState(i.state); s.online = false; F.writeState(i.state, s); // the dead job left the server stopped
      return { staleId, lock };
    },
    scenario: () => ({ requests: [post('after-stale', 'owner', {})] }),
  });
  const d = okData(run, 'after-stale');
  assert(!fs.existsSync(path.join(inst.backupsDir, extra.staleId)), 'the dead job\'s incomplete folder is removed');
  const t = F.trace(inst.state);
  F.inOrder(t, [[/^start neo4j$/, 'the recovery starts the server'], [/^stop neo4j$/, 'the new backup stops it'], [/^dump$/, 'dump'], [/^start neo4j$/, 'and starts it again']]);
  const runFile = path.join(inst.backupsDir, '.runs', `${extra.lock.runId}.json`);
  assert(fs.existsSync(runFile) && JSON.parse(fs.readFileSync(runFile, 'utf8')).outcome === 'interrupted', `the dead run is recorded as interrupted in ${runFile}`);
  assert(F.backupIds(inst.backupsDir).includes(d.backup.id), 'the new backup is kept');
});

test('B13: a lock written on another host (a recreated container) is stale, even if its pid is alive here', async () => {
  const { run } = await setup('other-host', {
    before: (i) => ({ lock: F.writeLock(i.backupsDir, { op: 'backup', host: 'a-container-that-is-gone', pid: process.pid, stage: 'online' }) }),
    scenario: () => ({ requests: [post('other-host', 'owner', {})] }),
  });
  okData(run, 'other-host');
});

test('B14: a key that doesn\'t decrypt to the instance\'s assistant fails the backup before the server stops, and the writers resume', async () => {
  const { inst, run } = await setup('wrong-key', {
    instance: { confPubkeyOverride: 'ee'.repeat(32) },
    scenario: () => ({ requests: [post('wrong-key', 'owner', {})] }),
  });
  const r = F.pick(run, 'wrong-key');
  assert(r.status === 500 && r.body && r.body.code === 'failed' && /assistant|key/i.test(String(r.body.error)), `answers 500 failed, naming the key; got ${r.status} ${show(r.body)}`);
  assert(!F.calls(inst.state, 'supervisor').some((e) => e.action === 'stop' && e.programs.includes('neo4j')), `the server is never stopped; got ${show(F.trace(inst.state))}`);
  const s = F.readState(inst.state);
  assert(s.online === true && s.programs['stream-consumer'] === 'RUNNING' && s.programs['tagging-edges-realtime'] === 'RUNNING', 'the writers run again');
  assert(F.backupIds(inst.backupsDir).length === 0 && F.leftovers(inst.backupsDir).length === 0, 'nothing is kept');
});

test('B15: the owner and admins may back up; a visitor is refused 401 and a stranger 403; a note over 200 characters 400 (AC6)', async () => {
  const { run } = await healthy();
  okData(run, 'owner');
  okData(run, 'admin');
  const v = F.pick(run, 'visitor');
  assert(v.status === 401 && v.body && v.body.success === false && /owner/i.test(String(v.body.error)), `a visitor gets 401, told who may call; got ${v.status} ${show(v.body)}`);
  const s = F.pick(run, 'stranger');
  assert(s.status === 403 && s.body && s.body.success === false && /owner/i.test(String(s.body.error)), `a stranger gets 403, told who may call; got ${s.status} ${show(s.body)}`);
  const l = F.pick(run, 'long-note');
  assert(l.status === 400 && l.body && l.body.code === 'invalid-input' && l.body.input === 'note', `a 201-character note is refused 400 invalid-input, naming it; got ${l.status} ${show(l.body)}`);
});

test('B16: `tapestry lifecycle backup --note …` takes a backup without signing in, answers as the route does, and says the job finishes on its own (AC6)', async () => {
  const { inst, run } = await healthy();
  const c = F.pick(run, 'cli');
  let j = null;
  try { j = JSON.parse(c.stdout); } catch { /* reported below */ }
  assert(c.code === 0 && j && j.success === true && j.data && j.data.backup && j.data.backup.note === 'from the shell',
    `the command exits 0 with the backup's JSON on stdout; got ${show(c.code)} ${show(String(c.stdout).slice(0, 400))} ${String(c.stderr).slice(-300)}`);
  assert(F.backupIds(inst.backupsDir).includes(j.data.backup.id), 'the command\'s backup is kept beside the others');
  assert(/job of its own/i.test(c.stderr) && /tapestry lifecycle status/.test(c.stderr), `stderr says the job finishes even if the command is interrupted; got ${show(c.stderr.slice(-400))}`);
});

test('B18: no answer, warning or log line carries the assistant\'s private key or the master key', async () => {
  const { inst, run } = await healthy();
  const said = [show(run.data), String(run.child.stdout || ''), String(run.child.stderr || '')].join(NL);
  for (const [what, secret] of [['the private key', inst.identity.privkey], ['the master key', inst.identity.masterKey]]) {
    assert(!said.includes(secret), `${what} appears in an answer or in the log`);
  }
});

test('B19: an instance with no admins records none — not the empty quotes of its launch settings\' BRAINSTORM_ADMIN_PUBKEYS=""', async () => {
  // Found by the live check (2026-11-08): a fresh instance's conf says BRAINSTORM_ADMIN_PUBKEYS="", which the conf
  // reader returns as the two characters "", so the backup recorded [""] and a restore would have written it into the
  // other instance's settings, overriding that instance's own admins.
  const { inst, run } = await setup('no-admins', {
    instance: { admins: [], confExtra: ['export BRAINSTORM_ADMIN_PUBKEYS=""'] },
    scenario: () => ({ requests: [post('no-admins', 'owner', {})] }),
  });
  const d = okData(run, 'no-admins');
  assert(show(d.holds && d.holds.admins) === show([]), `holds.admins is empty; got ${show(d.holds && d.holds.admins)}`);
  const admins = JSON.parse(fs.readFileSync(path.join(inst.backupsDir, d.backup.id, 'admins.json'), 'utf8'));
  assert(show(admins) === show({ pubkeys: [], from: 'launch-settings' }), `admins.json is { pubkeys: [], from: 'launch-settings' }; got ${show(admins)}`);
});

test('B20: a stop that stops the server but then fails is still undone: the server and the writers come back (review round 1)', async () => {
  const { inst, run } = await setup('stop-throws', { instance: { failures: { stopThrows: true } }, scenario: () => ({ requests: [post('stop-throws', 'owner', {})] }) });
  const r = F.pick(run, 'stop-throws');
  assert(r.status === 500 && r.body && r.body.code === 'failed', `answers 500 failed; got ${r.status} ${show(r.body)}`);
  const s = F.readState(inst.state);
  assert(s.online === true && s.programs['stream-consumer'] === 'RUNNING' && s.programs['tagging-edges-realtime'] === 'RUNNING',
    `the server is started again and both writers run; got ${show({ online: s.online, programs: s.programs })}`);
  assert(F.backupIds(inst.backupsDir).length === 0 && F.leftovers(inst.backupsDir).length === 0, 'nothing is kept');
});

test('B17: backups live on the data volume — /var/lib/brainstorm/backups unless TAPESTRY_BACKUPS_DIR says otherwise', () => {
  const store = path.join(ROOT, 'src/operations/catalog/lifecycle/_store.js');
  mustExist(store, 'ADR graph-operations-foundation/0002 Decision 2');
  const src = fs.readFileSync(store, 'utf8');
  assert(src.includes('/var/lib/brainstorm/backups') && src.includes('TAPESTRY_BACKUPS_DIR'), '_store.js defaults to /var/lib/brainstorm/backups and honours TAPESTRY_BACKUPS_DIR');
  const compose = fs.readFileSync(path.join(ROOT, 'docker-compose.yml'), 'utf8');
  assert(/tapestry-data:\/var\/lib\/brainstorm\b/.test(compose), 'docker-compose.yml keeps /var/lib/brainstorm on the tapestry-data volume');
});

async function run() {
  console.log(`${NL}=== operations: lifecycle backup ===`);
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  try {
    for (const [name, fn] of tests) {
      try {
        const r = await fn();
        if (r === 'skip') { console.log(`  SKIP  ${name}`); skipped++; } else { console.log(`  PASS  ${name}`); pass++; }
      } catch (err) {
        console.log(`  FAIL  ${name}${NL}        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
      }
    }
  } finally {
    if (BASE) fs.rmSync(BASE, { recursive: true, force: true });
  }
  console.log(`${NL}operations: lifecycle backup: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
