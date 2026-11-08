'use strict';
/**
 * lifecycle restore — its own suite, run by test/operations.test.js (ADR graph-operations-foundation/0001 Decision 12).
 *   Story: engineering-team/stories/graph-operations-foundation/2-lifecycle-backup-and-restore.md (AC3, AC4, AC5, AC6)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0002-backup-and-restore-the-whole-instance.md
 *   Plan:  engineering-team/stories/graph-operations-foundation/2-lifecycle-backup-and-restore.test-plan.md
 *
 * Stack-free, as the backup suite is: a temporary instance with a real encrypted assistant key, backup folders written
 * the way ADR Decisions 2 and 3 lay them out, and the fake supervisor, neo4j-admin and graph database in place of
 * _system.js, with the job run in the harness's process.
 *
 *   R1   the declaration: a write for the owner and admins, a required backup id, and its six refusals
 *   R2   a restore takes a safety backup of the graph as it is, then puts the backup in place, and proves it (AC3)
 *   R3   one offline window: writers paused, server stopped once, info, safety dump, load, info, started once (AC3)
 *   R4   a backup from another instance makes this one the same instance: key, conf, admins; owner reported (AC3, AC4)
 *   R5   the answer marks the run answered for the job, which restarts the control panel; the writers came back
 *        with the new key (AC3, ADR 0002 Amendment 1)
 *   R6   counts that don't match what the backup recorded say so, and name the safety backup (AC3)
 *   R7   a backup whose counts weren't exact can't be matched, and says so (AC3)
 *   R8   unknown, damaged and incompatible backups are refused, changing nothing (AC5)
 *   R9   too little space for the archive is refused before anything stops
 *   R10  busy and graph-unavailable are refused, changing nothing (AC5)
 *   R11  a load that fails is rolled back from the safety backup
 *   R12  a load that comes up at another transaction is rolled back too
 *   R13  a safety dump that fails changes nothing: nothing is loaded
 *   R14  warnings: an empty admin list falls back to the launch settings; TA_PUBKEY outranks the restored key
 *   R15  an older 5.x backup is accepted
 *   R16  who may call, and `tapestry lifecycle restore --backup <id>` (AC6)
 *   R17  no answer, warning or log line carries a private key or a master key
 *   R18  a step after the load that fails says the backup's graph is in place, and names the safety backup
 *   R19  a rollback that fails too gives the by-hand steps: stop, load the safety dump, start
 *   R20  restore's result schema names the report's fields
 */

const fs = require('fs');
const path = require('path');
const F = require('../../helpers/lifecycleFakes');

const { suite, assert, show, OWNER, ADMIN } = F;
const S = suite('lifecycle restore');
const test = S.test;
const ROUTE = '/api/tapestry/lifecycle/restore';
const DECL = path.join(F.ROOT, 'src/operations/catalog/lifecycle/restore.js');
const NEED = [[DECL, 'ADR graph-operations-foundation/0002 Decision 1']];
const OWNER2 = 'dd'.repeat(32);
const ADMIN2 = '9a'.repeat(32);
const OLD = { tx: 12, keys: ['k-old-1', 'k-old-2'], nodesWithoutKey: 1, relationships: 2, offloaded: 0 };
const post = (id, caller, backup) => ({ id, method: 'POST', url: ROUTE, caller, body: { backup } });

/** An earlier backup of this same instance, holding OLD; the instance's graph has moved on since. */
const ownBackup = (inst, o = {}) => F.writeBackup(inst.backupsDir, {
  identityDir: inst.keysDir, assistantPubkey: inst.identity.pubkey, ownerPubkey: OWNER, admins: [ADMIN], graph: OLD,
  takenAt: new Date(Date.now() - 86400e3).toISOString(), ...o,
});
const confText = (inst) => fs.readFileSync(inst.conf, 'utf8');
const settingsAdmins = (inst) => JSON.parse(fs.readFileSync(inst.settings, 'utf8')).adminPubkeys;
const manifestOf = (inst, id) => JSON.parse(fs.readFileSync(path.join(inst.backupsDir, id, 'manifest.json'), 'utf8'));
const stops = (t) => t.filter((x) => x === 'stop neo4j').length;
/** Assert nothing changed: no stop, no load, the graph as it was, no new backup. */
function assertUntouched(inst, beforeIds, label) {
  const t = F.trace(inst.state);
  assert(stops(t) === 0 && !t.includes('load') && !t.includes('dump'), `${label}: nothing is stopped, dumped or loaded; got ${show(t)}`);
  const g = F.readState(inst.state).graph;
  assert(g.tx === 18 && show(g.keys) === show(F.defaultGraph().keys), `${label}: the graph is as it was; got ${show(g)}`);
  assert(show(F.backupIds(inst.backupsDir)) === show(beforeIds), `${label}: no backup is added; got ${show(F.backupIds(inst.backupsDir))}`);
}

function same() {
  return S.setup('same', {
    mustExist: NEED,
    before: (inst) => {
      const x = ownBackup(inst, { note: 'before migrate' });
      const y = ownBackup(inst, { takenAt: new Date(Date.now() - 2 * 86400e3).toISOString(), manifest: { graph: { nodes: 99 } } });
      const z = ownBackup(inst, { takenAt: new Date(Date.now() - 3 * 86400e3).toISOString(), countsExact: false });
      return { x: x.id, y: y.id, z: z.id, keyBefore: fs.readFileSync(path.join(inst.keysDir, 'tapestry-assistant.json')) };
    },
    scenario: (inst, e) => ({
      requests: [post('x', 'owner', e.x), post('y', 'owner', e.y), post('z', 'admin', e.z),
        { id: 'visitor', method: 'POST', url: ROUTE, caller: 'visitor', body: { backup: e.x } },
        { id: 'stranger', method: 'POST', url: ROUTE, caller: 'stranger', body: { backup: e.x } },
        { id: 'no-id', method: 'POST', url: ROUTE, caller: 'owner', body: {} },
        { id: 'bad-id', method: 'POST', url: ROUTE, caller: 'owner', body: { backup: '../../etc' } }],
      cli: [{ id: 'cli', argv: ['lifecycle', 'restore', '--backup', e.x] }],
    }),
  });
}

test('R1: the declaration is a write for the owner and admins, takes a required backup id, and declares its six refusals', () => {
  for (const [abs, why] of NEED) if (!fs.existsSync(abs)) throw new Error(`${path.relative(F.ROOT, abs)} does not exist yet (${why})`);
  const { loadOperations } = require(path.join(F.ROOT, 'src/operations/index.js'));
  const op = loadOperations().operations.find((o) => o.group === 'lifecycle' && o.name === 'restore');
  assert(op, 'lifecycle restore is not among the loaded operations');
  assert(op.kind === 'write' && op.access === 'owner-and-admins', `restore is a write for the owner and admins; got ${op.kind} ${op.access}`);
  const b = op.inputs.backup;
  assert(b && b.required === true && b.schema && b.schema.type === 'string' && b.schema.pattern === '^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$',
    `restore takes a required backup id with the pattern ^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$; got ${show(b)}`);
  const r = Object.fromEntries(op.declaredRefusals.map((x) => [x.code, x.status]));
  const want = { 'unknown-backup': 404, 'damaged-backup': 422, 'newer-database': 409, 'not-enough-space': 409, busy: 409, 'graph-unavailable': 409 };
  for (const [k, v] of Object.entries(want)) assert(r[k] === v, `restore declares ${k} (${v}); got ${show(r)}`);
});

test('R2: a restore takes a safety backup of the graph as it is, puts the backup in place, and proves it (AC3)', async () => {
  const { inst, run, extra } = await same();
  const d = S.okData(run, 'x');
  assert(d.restored === extra.x, `restored names the backup; got ${show(d.restored)}`);
  assert(F.ID_RE.test(String(d.safetyBackup)) && F.backupIds(inst.backupsDir).includes(d.safetyBackup), `safetyBackup names a complete backup kept beside the others; got ${show(d.safetyBackup)}`);
  const sm = manifestOf(inst, d.safetyBackup);
  assert(sm.reason === 'before-restore' && sm.restoring === extra.x && new RegExp(extra.x).test(String(sm.note)) && sm.graph.countsExact === false,
    `the safety backup is reason 'before-restore', restoring the id, with a note naming it, counts not exact; got ${show({ reason: sm.reason, restoring: sm.restoring, note: sm.note, exact: sm.graph.countsExact })}`);
  const safetyDump = F.parseFakeDump(fs.readFileSync(path.join(inst.backupsDir, d.safetyBackup, 'neo4j.dump')));
  assert(safetyDump && safetyDump.tx === 18 && show(safetyDump.keys) === show(F.defaultGraph().keys), `the safety dump is the graph before the restore; got ${show(safetyDump)}`);
  assert(fs.readFileSync(path.join(inst.backupsDir, d.safetyBackup, 'identity/tapestry-assistant.json')).equals(extra.keyBefore), 'the safety backup holds the key the instance had');
  const g = d.graph || {};
  assert(g.transaction && String(g.transaction.recorded) === '12' && String(g.transaction.loaded) === '12' && g.transaction.same === true,
    `graph.transaction compares the recorded and the loaded transaction; got ${show(g.transaction)}`);
  const c = g.counts || {};
  const want = F.countsOf(F.defaultGraph(OLD));
  for (const [k, v] of Object.entries(want)) {
    assert(c.recorded && show(c.recorded[k]) === show(v), `counts.recorded.${k} is the manifest's ${show(v)}; got ${show(c.recorded)}`);
    assert(c.restored && show(c.restored[k]) === show(v), `counts.restored.${k} is what came back, ${show(v)}; got ${show(c.restored)}`);
  }
  assert(c.exact === true && c.match === true, `counts are exact and match; got ${show({ exact: c.exact, match: c.match })}`);
  assert(d.assistant && d.assistant.before === inst.identity.pubkey && d.assistant.after === inst.identity.pubkey && d.assistant.changed === false,
    `the assistant is unchanged; got ${show(d.assistant)}`);
  assert(d.owner && d.owner.backup === OWNER && d.owner.instance === OWNER && d.owner.same === true, `the owner is the same; got ${show(d.owner)}`);
  assert(d.admins && show(d.admins.before) === show([ADMIN]) && show(d.admins.after) === show([ADMIN]), `admins before and after; got ${show(d.admins)}`);
  assert(Array.isArray(d.restarting) && d.restarting.length === 0 && Number.isInteger(d.offlineMs) && Array.isArray(d.warnings),
    `with the assistant unchanged nothing restarts; offlineMs and warnings are given; got ${show({ restarting: d.restarting, offlineMs: d.offlineMs, warnings: d.warnings })}`);
  assert(!F.calls(inst.state, 'supervisor').some((e) => e.action === 'restart'), 'nothing is restarted');
});

test('R3: a restore is one offline window — writers paused, the server stopped once, info, safety dump, load, info, started once (AC3)', async () => {
  const { inst } = await same();
  const t = F.trace(inst.state);
  const firstStop = t.indexOf('stop neo4j');
  const firstStart = t.indexOf('start neo4j', firstStop);
  assert(firstStop >= 0 && firstStart > firstStop, `the first restore stops and starts the server; got ${show(t)}`);
  const win = t.slice(firstStop, firstStart + 1);
  F.inOrder(win, [/^stop neo4j$/, /^info$/, /^dump$/, /^load$/, /^info$/, /^start neo4j$/]);
  assert(win.filter((x) => x === 'stop neo4j').length === 1 && win.filter((x) => /^start neo4j$/.test(x)).length === 1, `one stop and one start; got ${show(win)}`);
  F.inOrder(t, [[/^stop (.*\+)?stream-consumer(\+|$)/, 'writers paused'], [/^count:keys$/, 'counted before'], [/^stop neo4j$/, 'stop'], [/^start neo4j$/, 'start'],
    [/^count:keys$/, 'counted after'], [/^start (.*\+)?stream-consumer(\+|$)/, 'writers resumed']]);
  const loads = F.calls(inst.state, 'neo4jAdmin').filter((e) => e.args.includes('load') && !e.args.includes('--info'));
  assert(loads.length && loads.every((e) => e.online === false), 'every load runs with the server stopped');
});

async function other() {
  return S.setup('other', {
    mustExist: NEED,
    before: async (inst) => {
      // The instance the backup came from: its own key and master key, owner and admins.
      const from = await F.makeInstance(S.base(), { name: 'other-origin', owner: OWNER2, admins: [ADMIN2] });
      const customer = await F.addAccountKey(inst.keysDir, 'customer-x');
      const w = F.writeBackup(inst.backupsDir, {
        identityDir: from.keysDir, assistantPubkey: from.identity.pubkey, ownerPubkey: OWNER2, admins: [ADMIN2], graph: OLD,
        received: { receivedAt: new Date().toISOString(), by: ADMIN },
      });
      return { w: w.id, from, customer, masterBefore: fs.readFileSync(path.join(inst.keysDir, '.master-key'), 'utf8'), confBefore: confText(inst) };
    },
    scenario: (inst, e) => ({ pauseMs: 400, requests: [post('w', 'admin', e.w)] }),
  });
}

test('R4: a backup from another instance makes this one the same instance — the key under this master key, the conf, the admins (AC3, AC4)', async () => {
  const { inst, run, extra } = await other();
  const d = S.okData(run, 'w');
  const key = await F.readKey(inst.keysDir);
  assert(key && key.pubkey === extra.from.identity.pubkey && key.privkey === extra.from.identity.privkey,
    `tapestry-assistant.json decrypts, with THIS instance's master key, to the backup's assistant; got ${show(key && key.pubkey)}`);
  assert(fs.readFileSync(path.join(inst.keysDir, '.master-key'), 'utf8') === extra.masterBefore, 'this instance keeps its own master key');
  const customer = await F.readKey(inst.keysDir, 'customer-x');
  assert(customer && customer.privkey === extra.customer.privkey, 'another account\'s key in the folder still decrypts with the instance\'s master key');
  const conf = confText(inst);
  assert(F.confPubkey(inst.conf) === extra.from.identity.pubkey && conf.includes(`BRAINSTORM_RELAY_NPUB='${extra.from.identity.npub}'`),
    'the conf names the backup\'s assistant on its BRAINSTORM_RELAY_PUBKEY and BRAINSTORM_RELAY_NPUB lines');
  const keep = (t) => t.split('\n').filter((l) => !/BRAINSTORM_RELAY_(PUBKEY|NPUB)=/.test(l)).join('\n');
  assert(keep(conf) === keep(extra.confBefore), `the conf's other lines are unchanged; got ${show(conf)}`);
  assert(F.modeOf(inst.conf) === 0o664, `the conf keeps its mode; got ${F.modeOf(inst.conf).toString(8)}`);
  assert(show(settingsAdmins(inst)) === show([ADMIN2]), `the admins are the backup's; got ${show(settingsAdmins(inst))}`);
  assert(d.assistant && d.assistant.before === inst.identity.pubkey && d.assistant.after === extra.from.identity.pubkey && d.assistant.changed === true,
    `the report names the assistant before and after; got ${show(d.assistant)}`);
  assert(d.owner && d.owner.backup === OWNER2 && d.owner.instance === OWNER && d.owner.same === false, `the owner differs, and is reported; got ${show(d.owner)}`);
  assert((d.warnings || []).some((w) => /owner/i.test(w)), `a warning says the owner stays as the launch settings name it; got ${show(d.warnings)}`);
  assert(d.admins && show(d.admins.before) === show([ADMIN]) && show(d.admins.after) === show([ADMIN2]), `admins before and after; got ${show(d.admins)}`);
  assert(Array.isArray(d.restarting) && d.restarting.includes('brainstorm') && d.restarting.includes('tagging-edges-realtime'), `restarting lists both; got ${show(d.restarting)}`);
  assert(F.readState(inst.state).graph.tx === 12, 'the backup\'s graph is in place');
});

test('R5: once the restore has answered, it marks its run answered for the job, which restarts the control panel; the route restarts nothing; the writers came back with the new key (AC3, ADR 0002 Amendment 1)', async () => {
  const { inst, run, extra } = await other();
  S.okData(run, 'w');
  const runs = path.join(inst.backupsDir, '.runs');
  const marked = fs.existsSync(runs) ? fs.readdirSync(runs).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(runs, f), 'utf8'))).filter((r) => r.answeredAt) : [];
  assert(marked.length === 1 && !Number.isNaN(Date.parse(marked[0].answeredAt)) && F.ID_RE.test(String(marked[0].runId)),
    `the restore's run is marked answered once the answer is out (.runs/<runId>.json has answeredAt); got ${show(marked)}`);
  const sup = F.calls(inst.state, 'supervisor');
  assert(!sup.some((e) => e.action === 'restart'), `the route restarts nothing itself; the job does, once the answer is out; got ${show(sup.map((e) => `${e.action} ${e.programs}`))}`);
  const writerStarts = sup.filter((e) => (e.action === 'start' || e.action === 'restart') && e.programs.some((p) => F.WRITERS.includes(p)));
  assert(writerStarts.length && writerStarts.every((e) => e.assistantAtStart === extra.from.identity.pubkey), `the writers start once the conf names the new assistant; got ${show(writerStarts)}`);
});

test('R6: counts that don\'t match what the backup recorded say so, and name the safety backup (AC3)', async () => {
  const { run } = await same();
  const d = S.okData(run, 'y');
  assert(d.graph && d.graph.counts && d.graph.counts.match === false, `match is false; got ${show(d.graph && d.graph.counts)}`);
  assert((d.warnings || []).some((w) => w.includes(d.safetyBackup)), `a warning names the safety backup to go back to; got ${show(d.warnings)}`);
});

test('R7: a backup whose counts weren\'t exact can\'t be matched — match is null, with a warning (AC3)', async () => {
  const { run } = await same();
  const d = S.okData(run, 'z');
  assert(d.graph && d.graph.counts && d.graph.counts.exact === false && d.graph.counts.match === null, `exact false, match null; got ${show(d.graph && d.graph.counts)}`);
  assert((d.warnings || []).some((w) => /confirm|exact/i.test(w)), `a warning says the counts couldn't be confirmed; got ${show(d.warnings)}`);
});

function refusals() {
  return S.setup('refusals', {
    mustExist: NEED,
    before: (inst) => {
      const ids = {};
      const day = (n) => new Date(Date.now() - n * 86400e3).toISOString();
      const a = ownBackup(inst, { takenAt: day(1) });
      fs.writeFileSync(path.join(a.folder, 'neo4j.dump'), F.fakeDumpBytes({ ...OLD, tx: 13 })); ids.shaMismatch = a.id;
      const b = ownBackup(inst, { takenAt: day(2) }); fs.rmSync(path.join(b.folder, 'admins.json')); ids.missingFile = b.id;
      ids.badManifest = ownBackup(inst, { takenAt: day(3), dropManifestFields: ['instance'] }).id;
      ids.notADump = ownBackup(inst, { takenAt: day(4), dump: Buffer.from('this is not a neo4j dump') }).id;
      ids.wrongKey = ownBackup(inst, { takenAt: day(5), assistantPubkey: 'ab'.repeat(32) }).id;
      ids.newer = ownBackup(inst, { takenAt: day(6), neo4jVersion: '5.27.0' }).id;
      ids.otherMajor = ownBackup(inst, { takenAt: day(7), neo4jVersion: '4.4.30' }).id;
      ids.noManifest = ownBackup(inst, { takenAt: day(8) }).id;
      fs.rmSync(path.join(inst.backupsDir, ids.noManifest, 'manifest.json'));
      ids.unknown = F.newId(new Date(Date.now() - 9 * 86400e3));
      return { ids, before: F.backupIds(inst.backupsDir) };
    },
    scenario: (inst, e) => ({ requests: Object.entries(e.ids).map(([k, id]) => post(k, 'owner', id)) }),
  });
}

test('R8: unknown, damaged and incompatible backups are refused with what went wrong, and nothing changes (AC5)', async () => {
  const { inst, run, extra } = await refusals();
  const want = {
    unknown: [404, 'unknown-backup'], noManifest: [404, 'unknown-backup'],
    shaMismatch: [422, 'damaged-backup'], missingFile: [422, 'damaged-backup'], badManifest: [422, 'damaged-backup'],
    notADump: [422, 'damaged-backup'], wrongKey: [422, 'damaged-backup'],
    newer: [409, 'newer-database'], otherMajor: [409, 'newer-database'],
  };
  for (const [k, [status, code]] of Object.entries(want)) {
    const r = F.pick(run, k);
    assert(r.status === status && r.body && r.body.code === code && typeof r.body.error === 'string' && r.body.error.trim().length > 10,
      `${k}: refused ${status} ${code}, in words; got ${r.status} ${show(r.body)}`);
  }
  const u = F.pick(run, 'unknown');
  assert(extra.before.some((id) => u.body.error.includes(id)), `unknown-backup names the backups the instance holds; got ${show(u.body.error)}`);
  assertUntouched(inst, extra.before, 'after the refusals');
});

test('R9: too little free space for the archive is refused 409 not-enough-space before anything stops', async () => {
  const { inst, run, extra } = await S.setup('space', {
    mustExist: NEED,
    before: (i) => {
      const s = F.readState(i.state); s.freeBytes = 1000; F.writeState(i.state, s);
      const x = ownBackup(i);
      return { x: x.id, before: F.backupIds(i.backupsDir) };
    },
    scenario: (i, e) => ({ requests: [post('space', 'owner', e.x)] }),
  });
  const r = F.pick(run, 'space');
  assert(r.status === 409 && r.body && r.body.code === 'not-enough-space', `refused 409 not-enough-space; got ${r.status} ${show(r.body)}`);
  assertUntouched(inst, extra.before, 'not-enough-space');
});

test('R10: while another backup or restore runs, and when the graph doesn\'t answer, restore refuses, changing nothing (AC5)', async () => {
  const busy = await S.setup('busy', {
    mustExist: NEED,
    before: (i) => { const x = ownBackup(i); F.writeLock(i.backupsDir, { op: 'backup', pid: process.pid }); return { x: x.id, before: F.backupIds(i.backupsDir) }; },
    scenario: (i, e) => ({ requests: [post('busy', 'owner', e.x)] }),
  });
  const b = F.pick(busy.run, 'busy');
  assert(b.status === 409 && b.body && b.body.code === 'busy', `refused 409 busy; got ${b.status} ${show(b.body)}`);
  assertUntouched(busy.inst, busy.extra.before, 'busy');
  const down = await S.setup('graph-down', {
    mustExist: NEED,
    instance: { failures: { cypherDown: true } },
    before: (i) => { const x = ownBackup(i); return { x: x.id, before: F.backupIds(i.backupsDir) }; },
    scenario: (i, e) => ({ requests: [post('down', 'owner', e.x)] }),
  });
  const g = F.pick(down.run, 'down');
  assert(g.status === 409 && g.body && g.body.code === 'graph-unavailable', `refused 409 graph-unavailable; got ${g.status} ${show(g.body)}`);
  assertUntouched(down.inst, down.extra.before, 'graph-unavailable');
});

/** A restore whose load goes wrong: the job rolls back from the safety backup. */
async function rollback(name, failures) {
  const { inst, run, extra } = await S.setup(name, {
    mustExist: NEED,
    instance: { failures },
    before: (i) => ({ x: ownBackup(i).id, conf: confText(i), admins: settingsAdmins(i) }),
    scenario: (i, e) => ({ requests: [post('roll', 'owner', e.x)] }),
  });
  const r = F.pick(run, 'roll');
  assert(r.status === 500 && r.body && r.body.code === 'failed' && /roll/i.test(String(r.body.error)), `answers 500 failed, saying it rolled back; got ${r.status} ${show(r.body)}`);
  const t = F.trace(inst.state);
  const win = t.slice(t.indexOf('stop neo4j'));
  assert(win.filter((x) => x === 'load').length === 2, `the backup is loaded, then the safety dump; got ${show(t)}`);
  const s = F.readState(inst.state);
  assert(s.graph.tx === 18 && show(s.graph.keys) === show(F.defaultGraph().keys), `the graph is as it was before; got ${show(s.graph)}`);
  assert(s.online === true && s.programs['stream-consumer'] === 'RUNNING' && s.programs['tagging-edges-realtime'] === 'RUNNING', 'the server and the writers run again');
  assert(confText(inst) === extra.conf && show(settingsAdmins(inst)) === show(extra.admins), 'the key\'s conf lines and the admins are untouched');
  const safety = F.backupIds(inst.backupsDir).filter((id) => id !== extra.x);
  assert(safety.length === 1 && manifestOf(inst, safety[0]).reason === 'before-restore', `the safety backup is kept; got ${show(safety)}`);
}
test('R11: a load that fails is rolled back from the safety backup: the graph as it was, the key and admins untouched', () => rollback('load-fails', { loadFailures: 1 }));
test('R12: a load that comes up at another transaction than the backup recorded is rolled back too', () => rollback('tx-differs', { txOffsetOnce: 5 }));

test('R13: a safety dump that fails changes nothing: nothing is loaded, the server and writers come back', async () => {
  const { inst, run, extra } = await S.setup('safety-fails', {
    mustExist: NEED,
    instance: { failures: { dump: true } },
    before: (i) => { const x = ownBackup(i); return { x: x.id, before: F.backupIds(i.backupsDir) }; },
    scenario: (i, e) => ({ requests: [post('sf', 'owner', e.x)] }),
  });
  const r = F.pick(run, 'sf');
  assert(r.status === 500 && r.body && r.body.code === 'failed', `answers 500 failed; got ${r.status} ${show(r.body)}`);
  const t = F.trace(inst.state);
  assert(!t.includes('load'), `nothing is loaded; got ${show(t)}`);
  const s = F.readState(inst.state);
  assert(s.online === true && s.graph.tx === 18 && s.programs['stream-consumer'] === 'RUNNING', 'the server, the graph and the writers are as they were');
  assert(show(F.backupIds(inst.backupsDir)) === show(extra.before) && F.leftovers(inst.backupsDir).length === 0, `no safety backup or incomplete folder is left; got ${show(fs.readdirSync(inst.backupsDir))}`);
});

test('R14: warnings — a backup with no admins falls back to the launch settings; TA_PUBKEY in the environment outranks the restored key', async () => {
  const { inst, run } = await S.setup('warnings', {
    mustExist: NEED,
    before: (i) => ({ x: ownBackup(i, { admins: [] }).id }),
    env: (i) => ({ TA_PUBKEY: i.identity.pubkey }),
    scenario: (i, e) => ({ requests: [post('warn', 'owner', e.x)] }),
  });
  const d = S.okData(run, 'warn');
  assert((d.warnings || []).some((w) => /launch/i.test(w)), `a warning says an empty admin list falls back to the launch settings; got ${show(d.warnings)}`);
  assert((d.warnings || []).some((w) => /TA_PUBKEY/.test(w)), `a warning says TA_PUBKEY outranks the key file; got ${show(d.warnings)}`);
  assert(show(settingsAdmins(inst)) === show([]), `the settings' admin list is the backup's, empty; got ${show(settingsAdmins(inst))}`);
});

test('R15: an older 5.x backup is accepted', async () => {
  const { run } = await S.setup('older', {
    mustExist: NEED,
    before: (i) => ({ x: ownBackup(i, { neo4jVersion: '5.20.0' }).id }),
    scenario: (i, e) => ({ requests: [post('older', 'owner', e.x)] }),
  });
  S.okData(run, 'older');
});

test('R16: the owner and admins may restore; a visitor 401, a stranger 403; a missing or ill-formed id 400; the command restores without signing in (AC6)', async () => {
  const { inst, run, extra } = await same();
  S.okData(run, 'x');
  S.okData(run, 'z'); // the admin's
  const v = F.pick(run, 'visitor');
  assert(v.status === 401 && v.body.success === false && /owner/i.test(String(v.body.error)), `visitor 401; got ${v.status} ${show(v.body)}`);
  const s = F.pick(run, 'stranger');
  assert(s.status === 403 && s.body.success === false && /owner/i.test(String(s.body.error)), `stranger 403; got ${s.status} ${show(s.body)}`);
  const n = F.pick(run, 'no-id');
  assert(n.status === 400 && n.body.code === 'missing-input' && n.body.input === 'backup', `a missing id is 400 missing-input; got ${n.status} ${show(n.body)}`);
  const b = F.pick(run, 'bad-id');
  assert(b.status === 400 && b.body.code === 'invalid-input' && b.body.input === 'backup', `an id that isn't one is 400 invalid-input, never a path; got ${b.status} ${show(b.body)}`);
  const c = F.pick(run, 'cli');
  let j = null;
  try { j = JSON.parse(c.stdout); } catch { /* reported below */ }
  assert(c.code === 0 && j && j.success === true && j.data && j.data.restored === extra.x,
    `\`tapestry lifecycle restore --backup <id>\` exits 0 with the report; got ${show(c.code)} ${show(String(c.stdout).slice(0, 300))} ${String(c.stderr).slice(-300)}`);
  assert(F.readState(inst.state).graph.tx === 12, 'the command\'s restore put the backup in place');
});

test('R18: a step after the load that fails says the backup\'s graph is in place and names the safety backup (review round 1)', async () => {
  const { inst, run, extra } = await S.setup('after-load-fails', {
    mustExist: NEED,
    before: (i) => {
      // A settings path under a regular file: reading it finds nothing, and restoring the admins can't write it.
      const blocker = path.join(i.dir, 'not-a-folder');
      fs.writeFileSync(blocker, 'a file');
      return { x: ownBackup(i).id, settingsPath: path.join(blocker, 'settings.json') };
    },
    env: (i, e) => ({ TAPESTRY_SETTINGS_PATH: e.settingsPath }),
    scenario: (i, e) => ({ requests: [post('after-load', 'owner', e.x)] }),
  });
  const r = F.pick(run, 'after-load');
  const safety = F.backupIds(inst.backupsDir).filter((id) => id !== extra.x);
  assert(r.status === 500 && r.body && r.body.code === 'failed', `answers 500 failed; got ${r.status} ${show(r.body)}`);
  assert(/in place/i.test(String(r.body.error)) && safety.length === 1 && String(r.body.error).includes(safety[0]),
    `the error says the backup's graph is in place and names the safety backup ${show(safety)}; got ${show(r.body.error)}`);
  const s = F.readState(inst.state);
  assert(s.online === true && s.graph.tx === 12, 'the server runs, with the backup\'s graph');
});

test('R19: a rollback that fails too says to stop the graph database, load the safety dump by hand, and start it again (review round 1)', async () => {
  const { inst, run, extra } = await S.setup('rollback-fails', {
    mustExist: NEED,
    instance: { failures: { loadFailures: 2 } },
    before: (i) => ({ x: ownBackup(i).id }),
    scenario: (i, e) => ({ requests: [post('both-fail', 'owner', e.x)] }),
  });
  const r = F.pick(run, 'both-fail');
  const safety = F.backupIds(inst.backupsDir).filter((id) => id !== extra.x);
  const err = String(r.body && r.body.error);
  assert(r.status === 500 && safety.length === 1 && err.includes(safety[0]), `500 failed, naming the safety backup; got ${r.status} ${show(r.body)}`);
  F.inOrder([err], [/supervisorctl stop neo4j/]);
  assert(err.indexOf('supervisorctl stop neo4j') < err.indexOf('neo4j-admin database load') && err.indexOf('neo4j-admin database load') < err.indexOf('supervisorctl start neo4j'),
    `the by-hand steps are stop, load, start, in that order; got ${show(err)}`);
});

test('R20: restore\'s result schema names the report\'s fields, and a real report matches it (review round 1)', async () => {
  const { loadOperations } = require(path.join(F.ROOT, 'src/operations/index.js'));
  const op = loadOperations().operations.find((o) => o.group === 'lifecycle' && o.name === 'restore');
  const props = Object.keys((op && op.result.schema && op.result.schema.properties) || {}).sort();
  const want = ['admins', 'assistant', 'graph', 'offlineMs', 'owner', 'restarting', 'restored', 'safetyBackup', 'warnings'];
  assert(want.every((k) => props.includes(k)), `the schema names ${show(want)}; got ${show(props)}`);
  const { run } = await same();
  const Ajv = require('ajv');
  const validate = new Ajv({ allErrors: true, strict: false }).compile(op.result.schema);
  assert(validate(S.okData(run, 'x')), `a real report matches the schema: ${show(validate.errors)}`);
});

test('R17: no answer, warning or log line carries either assistant\'s private key or either master key', async () => {
  const { inst, run, extra } = await other();
  const said = [show(run.data), String(run.child.stdout || ''), String(run.child.stderr || '')].join('\n');
  const secrets = [['the backup\'s private key', extra.from.identity.privkey], ['the backup\'s master key', extra.from.identity.masterKey],
    ['this instance\'s old private key', inst.identity.privkey], ['this instance\'s master key', inst.identity.masterKey]];
  for (const [what, secret] of secrets) assert(!said.includes(secret), `${what} appears in an answer or in the log`);
});

module.exports = { run: () => S.run() };
if (require.main === module) S.run().then(({ fail }) => process.exit(fail ? 1 : 0));
