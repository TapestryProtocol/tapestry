'use strict';
/**
 * lifecycle migrate — its own suite, run by test/operations.test.js (ADR graph-operations-foundation/0001 Decision 12).
 *   Story: engineering-team/stories/graph-operations-foundation/3-a-tapestry-key-on-every-node.md (AC1–AC4, AC6, AC7)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0003-a-tapestry-key-on-every-node.md
 *   Plan:  engineering-team/stories/graph-operations-foundation/3-a-tapestry-key-on-every-node.test-plan.md
 *
 * Stack-free. The route and the command run in a child process (test/helpers/operationsHarness.js) against a
 * temporary instance (test/helpers/lifecycleFakes.js) whose fake graph database holds each node — its labels, key,
 * event id, address and tag count — and the schema, and answers the queries ADR 0003 Decisions 4, 5, 7 and 10 name.
 * The job runs in the same process, as in the backup suites. What a real Neo4j does with the same Cypher is the
 * scratch-stack check the plan describes.
 *
 *   M1   the declaration: a write for the owner and admins; migration and wait; four refusals
 *   M2   tapestry-keys takes a backup first, then gives every node a key and the label, and adds the rule and index
 *   M3   the answer's report: counts before and after, keys given, labels given, placeholders replaced
 *   M4   the backup before it is an ordinary backup: reason requested, a note naming the migration
 *   M5   the lock is held from the backup to the last write, and the writers run on after the backup
 *   M6   the pipeline writing during the run: more passes, and a failed batch, still end with every node keyed
 *   M7   keys already shared: no key changed, the rest keyed and labelled, the rule left out, the keys named (AC2)
 *   M8   applied, nothing left to change: no backup, no run, nothing written; it says so (AC3)
 *   M9   applied, then new nodes with no key: a backup, then keys for them, the rule already there (AC3)
 *   M10  every node keyed and labelled, no rule yet: no backup, the rule and index added (ADR Decision 4)
 *   M11  status before any run: the whole graph's key counts, both migrations listed, none run (AC4)
 *   M12  status after a run: applied, when, who, the backup before it, the rule in place (AC4)
 *   M13  status reads the graph: a restored older graph reads as not migrated, its history kept (Sub-decision 2)
 *   M14  event-less-nodes: NostrEvent off the event-less sets, kept on events and placeholders, after a backup (AC6)
 *   M15  event-less-nodes before tapestry-keys is refused run-tapestry-keys-first, and changes nothing (AC6)
 *   M16  an unknown migration is refused, naming the ones it knows (AC7)
 *   M17  busy while a backup, restore or migration runs; and backup, while a migration runs, says so (AC7)
 *   M18  graph-unavailable, before anything stops (AC7)
 *   M19  a backup that fails before the migration ends the run: 500 in words, nothing changed (ADR Decision 2)
 *   M20  who may call: the owner and admins; visitors 401, strangers 403; who ran it is recorded (AC7)
 *   M21  the command: no sign-in, the route's answer, the job's note on stderr, 'local' as who ran it (AC7)
 *   M22  how long the caller waits: 50 s over HTTP by default, `wait` when given, the command to the end (Sub-decision 3)
 *   M23  a run that outlasts its wait answers running with its id, and status shows how it went (Sub-decision 3)
 */

const fs = require('fs');
const path = require('path');
const F = require('../../helpers/lifecycleFakes');

const ROOT = F.ROOT;
const ROUTE = '/api/tapestry/lifecycle/migrate';
const STATUS = '/api/tapestry/lifecycle/status';
const DECL = path.join(ROOT, 'src/operations/catalog/lifecycle/migrate.js');
const MIGRATIONS = path.join(ROOT, 'src/operations/catalog/lifecycle/_migrations.js');
const { OWNER, ADMIN, show } = F;
const S = F.suite('lifecycle migrate');
const { test } = S;
const assert = F.assert;
const MUST = [[DECL, 'ADR graph-operations-foundation/0003 Decision 2'], [MIGRATIONS, 'ADR graph-operations-foundation/0003 Decision 3']];

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────────────────────────────

const TA = 'ee'.repeat(32);
/**
 * A graph as today's instances hold it: events with and without keys, one with the '{}' placeholder, tag nodes, an
 * event-less set (add-subset's), a placeholder the import made for an `a` tag, NostrUser nodes and a customer's
 * metrics set and card. No node has the label, and there is no rule.
 */
function unmigratedNodes() {
  return [
    { labels: ['NostrEvent', 'ListHeader'], key: 'k-header', id: 'e-header', uuid: `39998:${TA}:widget`, tags: 5, name: 'widget' },
    { labels: ['NostrEvent', 'ListItem'], key: null, id: 'e-item', uuid: `39999:${TA}:item-1`, tags: 3, name: 'item one' },
    { labels: ['NostrEvent'], key: '{}', id: 'e-note', uuid: 'e-note', tags: 2 },
    { labels: ['NostrEventTag'], key: null, uuid: 'tag-1', type: 'd', value: 'item-1' },
    { labels: ['NostrEventTag'], key: 'k-tag', uuid: 'tag-2', type: 'name', value: 'item one' },
    { labels: ['NostrEvent', 'ListItem', 'Set'], key: 'k-set', id: null, uuid: `39999:${TA}:set-a`, tags: 2, name: 'Set A', pubkey: TA },
    { labels: ['NostrEvent'], key: null, id: null, uuid: `39999:${'ff'.repeat(32)}:elsewhere`, tags: 0, kind: 39999 },
    { labels: ['NostrUser'], key: null, pubkey: 'p'.repeat(64) },
    { labels: ['NostrUser'], key: null, pubkey: 'q'.repeat(64) },
    { labels: ['NostrUser'], key: null, pubkey: 'r'.repeat(64) },
    { labels: ['Set', 'SetOfNostrUserWotMetricsCards'], key: null, observee_pubkey: 'p'.repeat(64) },
    { labels: ['NostrUserWotMetricsCard'], key: null, observer_pubkey: OWNER, observee_pubkey: 'p'.repeat(64), customer_id: 1 },
  ];
}
const UNMIGRATED = () => F.nodeGraph({ nodes: unmigratedNodes(), relationships: 9 });
/** The same graph after tapestry-keys: every node labelled and keyed, the rule and index online. */
function migratedNodes() {
  return unmigratedNodes().map((n, i) => ({ ...n, labels: [...n.labels, 'TapestryNode'], key: F.realKey(n.key) ? n.key : `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` }));
}
const MIGRATED = (extra = []) => F.nodeGraph({ nodes: [...migratedNodes(), ...extra], relationships: 9, schema: F.migratedSchema() });
const KEPT = ['k-header', 'k-tag', 'k-set'];

const post = (id, caller, body) => ({ id, method: 'POST', url: ROUTE, caller, body: body === undefined ? {} : body });
const getStatus = (id, caller = 'owner') => ({ id, method: 'GET', url: STATUS, caller });
const keysRun = (id, caller = 'owner', extra = {}) => post(id, caller, { migration: 'tapestry-keys', ...extra });

const graphOf = (inst) => F.readState(inst.state).graph;
const byUuid = (g, uuid) => g.nodes.find((n) => n.uuid === uuid);
const byPubkey = (g, pubkey) => g.nodes.find((n) => n.pubkey === pubkey && n.labels.includes('NostrUser'));
const has = (n, label) => !!n && n.labels.includes(label);
const cypherTrace = (inst) => F.calls(inst.state, 'cypher').map((e) => e.what);
const writes = (inst) => F.calls(inst.state, 'cypher').filter((e) => ['keys-pass', 'relabel-pass', 'create-rule', 'create-index'].includes(e.what));
const runFiles = (inst) => {
  const dir = path.join(inst.backupsDir, '.runs');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) : [];
};
const migrateRuns = (inst) => runFiles(inst).filter((r) => r.op === 'migrate');
const migrationOf = (statusData, name) => {
  const m = statusData && statusData.migrations;
  assert(m && m.known === true && Array.isArray(m.migrations), `status's migrations part is { known: true, keys, migrations: [...], note }; got ${show(m)}`);
  const entry = m.migrations.find((x) => x.name === name);
  assert(entry, `status lists the migration ${name}; got ${show(m.migrations.map((x) => x.name))}`);
  return entry;
};
const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.keys(v).sort().reduce((o, key) => { o[key] = v[key]; return o; }, {}) : v));
const same = (a, b) => canon(a) === canon(b);
function refused(run, id, status, code) {
  const r = F.pick(run, id);
  assert(r.status === status && r.body && r.body.code === code, `'${id}' is refused ${status} ${code}; got ${r.status} ${show(r.body).slice(0, 500)}`);
  return r.body;
}

// One harness run per setup, each its own instance.
const unmigrated = () => S.setup('unmigrated', {
  mustExist: MUST,
  instance: { graph: UNMIGRATED() },
  scenario: () => ({ requests: [getStatus('status-before'), keysRun('owner'), getStatus('status-after'), keysRun('again'), getStatus('status-again')] }),
});

// ── The declaration ──────────────────────────────────────────────────────────────────────────────────────────────

test('M1: the declaration is a write for the owner and admins; takes migration (1–64 characters, required) and wait (0–600 s); declares unknown-migration, run-tapestry-keys-first, busy and graph-unavailable', () => {
  for (const [abs, why] of MUST) if (!fs.existsSync(abs)) throw new Error(`${path.relative(ROOT, abs)} does not exist yet (${why})`);
  const { loadOperations } = require(path.join(ROOT, 'src/operations/index.js'));
  const { operations, problems } = loadOperations();
  const mine = problems.filter((p) => p.file.startsWith('lifecycle/'));
  assert(mine.length === 0, `the lifecycle declarations must load cleanly; problems: ${show(mine)}`);
  const op = operations.find((o) => o.group === 'lifecycle' && o.name === 'migrate');
  assert(op, 'lifecycle migrate is not among the loaded operations');
  assert(op.kind === 'write' && op.method === 'POST' && op.access === 'owner-and-admins', `migrate is a POST write for the owner and admins; got ${op.kind} ${op.method} ${op.access}`);
  const m = op.inputs.migration;
  assert(m && m.required === true && m.schema && m.schema.type === 'string' && m.schema.minLength === 1 && m.schema.maxLength === 64 && !m.schema.enum,
    `migration is a required string of 1–64 characters, not an enum, so the refusal can name the migrations (Decision 2); got ${show(m)}`);
  const w = op.inputs.wait;
  assert(w && w.required !== true && w.schema && w.schema.type === 'integer' && w.schema.minimum === 0 && w.schema.maximum === 600,
    `wait is an optional integer of 0–600 seconds; got ${show(w)}`);
  assert(Object.keys(op.inputs).sort().join(',') === 'migration,wait', `migrate's inputs are migration and wait; got ${show(Object.keys(op.inputs))}`);
  const r = Object.fromEntries(op.declaredRefusals.map((x) => [x.code, x.status]));
  for (const [code, status] of [['unknown-migration', 400], ['run-tapestry-keys-first', 409], ['busy', 409], ['graph-unavailable', 409]]) {
    assert(r[code] === status, `migrate declares ${code} (${status}); got ${show(r)}`);
  }
  const props = (op.result && op.result.schema && op.result.schema.properties) || {};
  for (const f of ['migration', 'state', 'runId', 'backup', 'report', 'note']) assert(props[f], `the result has ${f}; got ${show(Object.keys(props))}`);
  const state = props.state && props.state.enum;
  assert(state && ['done', 'running', 'already-applied'].every((s) => state.includes(s)), `state is done, running or already-applied; got ${show(state)}`);
});

// ── tapestry-keys (AC1) ──────────────────────────────────────────────────────────────────────────────────────────

test('M2: tapestry-keys takes a backup first, then gives every node — NostrUser and metrics cards included — a key and the label, keeps every real key, and adds the rule and the index (AC1)', async () => {
  const { inst, run } = await unmigrated();
  const d = S.okData(run, 'owner');
  assert(d.migration === 'tapestry-keys' && d.state === 'done', `the answer is { migration: 'tapestry-keys', state: 'done', … }; got ${show(d).slice(0, 400)}`);
  assert(F.ID_RE.test(String(d.backup)) && F.backupIds(inst.backupsDir).includes(d.backup), `the answer names the backup taken first, one the instance now holds; got ${show(d.backup)}`);
  const t = F.trace(inst.state);
  const [, , start] = F.inOrder(t, [[/^stop neo4j$/, 'the backup stopping the server'], [/^dump$/, 'the dump'], [/^start neo4j$/, 'the server back']]);
  const firstWrite = t.findIndex((x) => /^count:(keys-pass|create-rule|create-index)$/.test(x));
  assert(firstWrite > start, `nothing is written before the backup is taken; the trace was ${show(t)}`);
  const g = graphOf(inst);
  assert(g.nodes.length === 12, `no node is made or lost; got ${g.nodes.length}`);
  for (const n of g.nodes) {
    assert(has(n, 'TapestryNode'), `every node carries TapestryNode; ${show(n)} doesn't`);
    assert(F.realKey(n.key), `every node has a real tapestryKey, not null or '{}'; ${show(n)} doesn't`);
  }
  const before = unmigratedNodes();
  for (const k of KEPT) assert(g.nodes.filter((n) => n.key === k).length === 1, `the real key ${k} is kept on its node, unchanged`);
  assert(new Set(g.nodes.map((n) => n.key)).size === 12, `every key is distinct; got ${show(g.nodes.map((n) => n.key))}`);
  for (const n of before) {
    const now = n.uuid ? byUuid(g, n.uuid) : n.pubkey ? byPubkey(g, n.pubkey) : g.nodes.find((x) => x.labels.includes(n.labels[n.labels.length - 1]));
    assert(now && n.labels.every((l) => now.labels.includes(l)), `every node keeps its labels; ${show(n.labels)} → ${show(now && now.labels)}`);
  }
  assert(byPubkey(g, 'p'.repeat(64)) && F.realKey(byPubkey(g, 'p'.repeat(64)).key), 'NostrUser nodes get keys too (the owner\'s ruling at the planning gate)');
  const names = (g.schema.constraints || []).map((c) => c.name);
  const ix = Object.fromEntries((g.schema.indexes || []).map((i) => [i.name, i]));
  assert(names.includes('tapestry_key'), `the rule tapestry_key is in place; got ${show(names)}`);
  assert(ix.tapestry_key && ix.tapestry_key.state === 'ONLINE' && ix.tapestry_node_uuid && ix.tapestry_node_uuid.state === 'ONLINE' && ix.tapestry_node_uuid.label === 'TapestryNode' && ix.tapestry_node_uuid.property === 'uuid',
    `the rule's index and tapestry_node_uuid (TapestryNode.uuid) are online before the run answers; got ${show(g.schema.indexes)}`);
});

test('M3: the report gives the counts before and after, the keys and labels given, the placeholders replaced, and the rule and index added (AC1, ADR Decision 4)', async () => {
  const { run } = await unmigrated();
  const r = S.okData(run, 'owner').report;
  assert(r && typeof r === 'object', `the answer carries the migration's report; got ${show(r)}`);
  const want = {
    before: { nodes: 12, withLabel: 0, withoutKey: 9 }, after: { nodes: 12, withLabel: 12, withoutKey: 0 },
    keysGiven: 9, labelsGiven: 12, placeholdersReplaced: 1, rule: 'added', index: 'added',
  };
  for (const [k, v] of Object.entries(want)) {
    assert(show(r[k]) === show(v), `report.${k} is ${show(v)}; got ${show(r[k])} (the whole report: ${show(r).slice(0, 600)})`);
  }
  assert(Array.isArray(r.sharedKeys) && r.sharedKeys.length === 0, `report.sharedKeys is []; got ${show(r.sharedKeys)}`);
  assert(Number.isInteger(r.passes) && r.passes >= 1 && Number.isInteger(r.failedBatches) && r.failedBatches === 0, `report.passes ≥ 1 and failedBatches 0; got ${show(r.passes)} ${show(r.failedBatches)}`);
  assert(typeof S.okData(run, 'owner').note === 'string' && S.okData(run, 'owner').note.length > 0, 'the answer says in words what was done');
});

test('M4: the backup before it is an ordinary backup — reason requested, a note naming the migration — so A10.2\'s restore reads it (ADR Decision 6)', async () => {
  const { inst, run } = await unmigrated();
  const id = S.okData(run, 'owner').backup;
  const m = JSON.parse(fs.readFileSync(path.join(inst.backupsDir, id, 'manifest.json'), 'utf8'));
  assert(m.reason === 'requested', `its manifest's reason stays requested, which an A10.2 instance accepts; got ${show(m.reason)}`);
  assert(/before lifecycle migrate tapestry-keys/i.test(String(m.note)), `its note names the migration; got ${show(m.note)}`);
  const dumped = F.parseFakeDump(fs.readFileSync(path.join(inst.backupsDir, id, 'neo4j.dump')));
  assert(dumped && Array.isArray(dumped.nodes) && dumped.nodes.every((n) => !n.labels.includes('TapestryNode')), 'the backup holds the graph as it was before the migration');
});

test('M5: the lock is held from the backup to the last write, so no backup, restore or migration runs between; the writers run on after the backup (ADR Decision 6)', async () => {
  const { inst } = await unmigrated();
  const w = writes(inst);
  assert(w.length >= 3, `the run wrote the keys, the rule and the index; the fake saw ${show(w.map((e) => e.what))}`);
  for (const e of w) assert(e.lockStage !== null, `every write happens while the run's lock is held; ${e.what} happened with no lock`);
  assert(!fs.existsSync(path.join(inst.backupsDir, '.lock')), 'the lock is released at the end');
  const t = F.trace(inst.state);
  const lastStart = t.map((x, i) => (/^start stream-consumer/.test(x) ? i : -1)).filter((i) => i >= 0).pop();
  assert(lastStart !== undefined, `the backup resumed the writers; the trace was ${show(t)}`);
  const stops = t.slice(lastStart + 1).filter((x) => /^stop /.test(x));
  assert(stops.length === 0, `nothing is stopped after the backup: the keys go in online; got ${show(stops)}`);
  const st = F.readState(inst.state);
  assert(st.online && Object.values(st.programs).every((p) => p === 'RUNNING'), `the server and writers are running at the end; got ${show({ online: st.online, programs: st.programs })}`);
});

test('M6: while the pipeline writes nodes during the run and a batch fails, more passes run, and every node ends keyed and labelled (AC1)', async () => {
  const { inst, run } = await S.setup('pipeline', {
    mustExist: MUST,
    instance: { graph: UNMIGRATED(), failures: { keysPassFailsOnce: 1, writesBetweenPasses: [2, 1] } },
    scenario: () => ({ requests: [keysRun('owner')] }),
  });
  const d = S.okData(run, 'owner');
  const g = graphOf(inst);
  assert(g.nodes.length === 15, `the fake's pipeline made 3 nodes during the run; got ${g.nodes.length}`);
  for (const n of g.nodes) assert(has(n, 'TapestryNode') && F.realKey(n.key), `every node ends keyed and labelled, those made during the run included; ${show(n)} isn't`);
  const passes = cypherTrace(inst).filter((x) => x === 'keys-pass').length;
  assert(passes >= 2 && passes <= 3, `migrate runs another pass for what is left, at most three; it ran ${passes}`);
  assert(d.report.passes === passes && d.report.failedBatches >= 1, `the report counts the passes (${passes}) and the failed batch; got ${show({ passes: d.report.passes, failedBatches: d.report.failedBatches })}`);
  assert(d.report.after.withoutKey === 0 && d.report.rule === 'added', `the run ends with nothing left and the rule added; got ${show(d.report.after)} ${show(d.report.rule)}`);
});

test('M7: keys already shared by two nodes: neither key changes, the rest are keyed and labelled, the rule and index are left out, and the answer names each shared key and its nodes (AC2)', async () => {
  const nodes = [...unmigratedNodes(), { labels: ['NostrEvent'], key: 'k-dup', id: 'e-d1', uuid: 'e-d1', tags: 1 }, { labels: ['NostrUser'], key: 'k-dup', pubkey: 's'.repeat(64) }];
  const { inst, run } = await S.setup('shared', {
    mustExist: MUST,
    instance: { graph: F.nodeGraph({ nodes }) },
    scenario: () => ({ requests: [keysRun('owner'), getStatus('status')] }),
  });
  const d = S.okData(run, 'owner');
  const g = graphOf(inst);
  const dup = g.nodes.filter((n) => n.key === 'k-dup');
  assert(dup.length === 2, `neither node's shared key changes; got ${show(dup)}`);
  for (const n of g.nodes.filter((x) => x.key !== 'k-dup')) assert(F.realKey(n.key) && has(n, 'TapestryNode'), `every other node is keyed and labelled; ${show(n)} isn't`);
  assert((g.schema.constraints || []).length === 0 && !(g.schema.indexes || []).some((i) => i.name === 'tapestry_key'), `the rule is left out; got ${show(g.schema)}`);
  assert(d.report.rule === 'left-out' && d.report.index === 'left-out', `the report says the rule and index were left out; got ${show({ rule: d.report.rule, index: d.report.index })}`);
  const s = d.report.sharedKeys;
  assert(Array.isArray(s) && s.length === 1 && s[0].key === 'k-dup' && s[0].count === 2 && Array.isArray(s[0].nodes) && s[0].nodes.length === 2,
    `sharedKeys is [{ key: 'k-dup', count: 2, nodes: [two element ids] }]; got ${show(s)}`);
  assert(/k-dup/.test(String(d.note)), `the note names the shared key, so the owner can decide; got ${show(d.note)}`);
  const entry = migrationOf(S.okData(run, 'status'), 'tapestry-keys');
  assert(entry.applied === false, `tapestry-keys isn't applied while a key is shared; got ${show(entry)}`);
});

test('M8: run again with nothing left to change, it answers already-applied: no backup, no run file, no supervisor call, nothing written (AC3)', async () => {
  const { inst, run } = await unmigrated();
  const d = S.okData(run, 'again');
  assert(d.migration === 'tapestry-keys' && d.state === 'already-applied' && d.backup === null && d.report === null,
    `the second run answers { state: 'already-applied', backup: null, report: null }; got ${show(d).slice(0, 400)}`);
  assert(/already applied/i.test(String(d.note)), `it says so in words; got ${show(d.note)}`);
  assert(F.backupIds(inst.backupsDir).length === 1, `only the first run took a backup; got ${show(F.backupIds(inst.backupsDir))}`);
  assert(migrateRuns(inst).length === 1, `only the first run left a run file; got ${migrateRuns(inst).length}`);
  const d1 = S.okData(run, 'owner');
  assert(d1.state === 'done', 'the first run did run (so this test isn\'t passing on a migrate that does nothing)');
  const log = F.calls(inst.state);
  const lastFirst = log.map((e, i) => ((e.call === 'cypher' && ['keys-pass', 'create-rule', 'create-index'].includes(e.what)) || e.call === 'supervisor' ? i : -1)).filter((i) => i >= 0).pop();
  const afterFirst = log.slice(lastFirst + 1);
  assert(!afterFirst.some((e) => e.call === 'supervisor' || e.call === 'neo4jAdmin' || (e.call === 'cypher' && ['keys-pass', 'relabel-pass', 'create-rule', 'create-index'].includes(e.what))),
    `the second run only reads; after the first run the fake saw ${show(afterFirst.map((e) => e.what || `${e.call} ${e.action || ''}`))}`);
});

test('M9: applied, then nodes appear with no key (say, by raw Cypher): run again, it takes a backup, gives them keys and the label, and finds the rule already there (AC3)', async () => {
  const late = [{ labels: ['NostrUser'], key: null, pubkey: 't'.repeat(64) }, { labels: ['NostrEvent'], key: null, id: 'e-late', uuid: 'e-late', tags: 1 }];
  const { inst, run } = await S.setup('later', {
    mustExist: MUST,
    instance: { graph: MIGRATED(late) },
    scenario: () => ({ requests: [keysRun('owner')] }),
  });
  const d = S.okData(run, 'owner');
  assert(d.state === 'done' && F.backupIds(inst.backupsDir).includes(d.backup), `a backup is taken first; got ${show(d).slice(0, 300)}`);
  const g = graphOf(inst);
  for (const p of ['t'.repeat(64)]) assert(F.realKey(byPubkey(g, p).key) && has(byPubkey(g, p), 'TapestryNode'), 'the late NostrUser is keyed and labelled');
  assert(F.realKey(byUuid(g, 'e-late').key) && has(byUuid(g, 'e-late'), 'TapestryNode'), 'the late event is keyed and labelled');
  assert(d.report.keysGiven === 2 && d.report.rule === 'already-there' && d.report.index === 'already-there', `the report: 2 keys given, the rule and index already there; got ${show(d.report).slice(0, 400)}`);
});

test('M10: every node already keyed and labelled but no rule yet (a new instance): no backup, since no data changes; the rule and index are added (ADR Decision 4)', async () => {
  const nodes = migratedNodes();
  const { inst, run } = await S.setup('fresh', {
    mustExist: MUST,
    instance: { graph: F.nodeGraph({ nodes }) },
    scenario: () => ({ requests: [keysRun('owner')] }),
  });
  const d = S.okData(run, 'owner');
  assert(d.state === 'done' && d.backup === null, `no backup is taken when no node changes; got ${show(d).slice(0, 300)}`);
  assert(F.backupIds(inst.backupsDir).length === 0 && F.calls(inst.state, 'supervisor').length === 0, 'nothing was stopped or dumped');
  const g = graphOf(inst);
  assert((g.schema.constraints || []).some((c) => c.name === 'tapestry_key') && (g.schema.indexes || []).some((i) => i.name === 'tapestry_node_uuid' && i.state === 'ONLINE'),
    `the rule and index are added; got ${show(g.schema)}`);
  assert(d.report.keysGiven === 0 && d.report.labelsGiven === 0 && d.report.rule === 'added', `the report says only the rule was added; got ${show(d.report).slice(0, 300)}`);
});

// ── lifecycle status (AC4) ───────────────────────────────────────────────────────────────────────────────────────

test('M11: status before any run counts keys across the whole graph, NostrUser nodes included, and lists both migrations, none run (AC4)', async () => {
  const { run } = await unmigrated();
  const s = S.okData(run, 'status-before');
  const m = s.migrations;
  assert(m && m.known === true && m.keys, `the migrations part has keys; got ${show(m)}`);
  assert(same(m.keys, { nodes: 12, withLabel: 0, withoutKey: 9, rule: false, index: false }),
    `keys is { nodes: 12, withLabel: 0, withoutKey: 9, rule: false, index: false } — the whole graph, not the cache part's scope; got ${show(m.keys)}`);
  const k = migrationOf(s, 'tapestry-keys');
  const e = migrationOf(s, 'event-less-nodes');
  assert(k.applied === false && k.lastRun === null && show(k.requires) === show([]) && typeof k.summary === 'string' && k.summary.length > 0,
    `tapestry-keys: not applied, never run, requires nothing; got ${show(k)}`);
  assert(e.applied === false && e.lastRun === null && show(e.requires) === show(['tapestry-keys']), `event-less-nodes: not applied, never run, requires tapestry-keys; got ${show(e)}`);
  assert(/no migration has run/i.test(String(m.note)) && /tapestry-keys/.test(m.note) && /event-less-nodes/.test(m.note), `the note says none has run and names both; got ${show(m.note)}`);
});

test('M12: status after a run: tapestry-keys applied, when it ran, who ran it, the backup before it; the rule and index in place (AC4)', async () => {
  const { run } = await unmigrated();
  const id = S.okData(run, 'owner').backup;
  const s = S.okData(run, 'status-after');
  assert(same(s.migrations.keys, { nodes: 12, withLabel: 12, withoutKey: 0, rule: true, index: true }), `keys after the run; got ${show(s.migrations.keys)}`);
  const k = migrationOf(s, 'tapestry-keys');
  const r = k.lastRun;
  assert(k.applied === true && r && r.outcome === 'done' && r.by === OWNER && r.backup === id && F.ID_RE.test(String(r.runId)) && r.error === null,
    `lastRun is { runId, startedAt, finishedAt, outcome: 'done', by: the owner, backup: ${id}, error: null }; got ${show(r)}`);
  assert(!Number.isNaN(Date.parse(r.startedAt)) && !Number.isNaN(Date.parse(r.finishedAt)) && r.startedAt <= r.finishedAt, `lastRun's times are ISO, in order; got ${show(r)}`);
  assert(migrationOf(s, 'event-less-nodes').applied === false, 'event-less-nodes is still not applied');
  const again = S.okData(run, 'status-again');
  assert(migrationOf(again, 'tapestry-keys').lastRun.runId === r.runId, 'an already-applied answer records no run, so lastRun stays the run that did the work');
  const b = s.backup;
  assert(b && b.known === true && (b.lastRun === null || b.lastRun.op !== 'migrate'), `the backup part's lastRun stays a backup or restore run, not a migration; got ${show(b && b.lastRun)}`);
  assert(b.last && b.last.id === id, `the backup part's last backup is the one taken before the migration; got ${show(b.last)}`);
});

test('M13: status reads the graph, so after a restore of a backup from before the migration it says tapestry-keys is not applied, and keeps the run in its history (Sub-decision 2)', async () => {
  const { run } = await S.setup('restore-old', {
    mustExist: MUST,
    instance: { graph: UNMIGRATED() },
    before: (inst) => {
      const old = F.writeBackup(inst.backupsDir, {
        identityDir: inst.keysDir, graph: UNMIGRATED(), note: 'the old graph', assistantPubkey: inst.identity.pubkey, ownerPubkey: OWNER, admins: [ADMIN],
        takenAt: '2026-11-01T00:00:00.000Z',
      });
      return { old };
    },
    scenario: (inst, { old }) => ({ requests: [keysRun('owner'), { id: 'restore', method: 'POST', url: '/api/tapestry/lifecycle/restore', caller: 'owner', body: { backup: old.id } }, getStatus('status')] }),
  });
  S.okData(run, 'owner');
  const rs = S.okData(run, 'restore');
  assert(rs && rs.restored, `the restore went through; got ${show(rs).slice(0, 300)}`);
  const s = S.okData(run, 'status');
  const k = migrationOf(s, 'tapestry-keys');
  assert(k.applied === false, `the restored graph is the unmigrated one, so tapestry-keys reads not applied; got ${show(k)}`);
  assert(s.migrations.keys.rule === false && s.migrations.keys.withLabel === 0, `the restored graph has no rule and no label; got ${show(s.migrations.keys)}`);
  assert(k.lastRun && k.lastRun.outcome === 'done', `the run is still in the instance's history (the run files, which a restore leaves alone); got ${show(k.lastRun)}`);
});

// ── event-less-nodes (AC6) ───────────────────────────────────────────────────────────────────────────────────────

const eventLess = () => S.setup('event-less', {
  mustExist: MUST,
  instance: { graph: UNMIGRATED() },
  scenario: () => ({
    requests: [
      post('too-soon', 'owner', { migration: 'event-less-nodes' }),
      keysRun('keys'),
      post('owner', 'owner', { migration: 'event-less-nodes', wait: 5 }),
      post('again', 'owner', { migration: 'event-less-nodes' }),
      getStatus('status'),
    ],
  }),
});

test('M14: event-less-nodes, after a backup, takes NostrEvent off the event-less sets only, keeping their key, labels and fields; events and the import\'s placeholders keep it (AC6)', async () => {
  const { inst, run } = await eventLess();
  const d = S.okData(run, 'owner');
  assert(d.migration === 'event-less-nodes' && d.state === 'done' && F.backupIds(inst.backupsDir).includes(d.backup), `it runs after a backup of its own; got ${show(d).slice(0, 300)}`);
  const keysBackup = S.okData(run, 'keys').backup;
  assert(d.backup !== keysBackup, 'its backup is its own, taken after tapestry-keys');
  const g = graphOf(inst);
  const set = byUuid(g, `39999:${TA}:set-a`);
  assert(set && !has(set, 'NostrEvent') && ['ListItem', 'Set', 'TapestryNode'].every((l) => has(set, l)), `the event-less set loses NostrEvent and keeps ListItem, Set and TapestryNode; got ${show(set && set.labels)}`);
  assert(set.key === 'k-set' && set.name === 'Set A' && set.pubkey === TA && set.tags === 2, `it keeps its key, its fields and its tag nodes; got ${show(set)}`);
  const ph = byUuid(g, `39999:${'ff'.repeat(32)}:elsewhere`);
  assert(has(ph, 'NostrEvent'), `the import's placeholder for an a tag keeps NostrEvent, since it stands for an event; got ${show(ph && ph.labels)}`);
  for (const u of [`39998:${TA}:widget`, `39999:${TA}:item-1`, 'e-note']) assert(has(byUuid(g, u), 'NostrEvent'), `the event ${u} keeps NostrEvent`);
  assert(d.report && d.report.relabelled === 1 && show(d.report.addresses) === show([`39999:${TA}:set-a`]), `the report is { relabelled: 1, addresses: [the set's address] }; got ${show(d.report)}`);
  const t = cypherTrace(inst);
  const pass = t.lastIndexOf('relabel-pass');
  const dumps = F.trace(inst.state).filter((x) => x === 'dump').length;
  assert(pass >= 0 && dumps === 2, `two backups (one per migration), then the pass; got ${dumps} dumps, the pass at ${pass}`);
  const again = S.okData(run, 'again');
  assert(again.state === 'already-applied' && again.backup === null, `run again with nothing left, it answers already-applied with no backup (AC3); got ${show(again).slice(0, 200)}`);
  const s = S.okData(run, 'status');
  const e = migrationOf(s, 'event-less-nodes');
  assert(e.applied === true && e.lastRun && e.lastRun.backup === d.backup, `status shows event-less-nodes applied, with its backup; got ${show(e)}`);
});

test('M15: event-less-nodes before tapestry-keys is refused 409 run-tapestry-keys-first, naming the migration to run first, and changes nothing (AC6)', async () => {
  const { run } = await eventLess();
  const b = refused(run, 'too-soon', 409, 'run-tapestry-keys-first');
  assert(/tapestry-keys/.test(String(b.error)), `the refusal names the migration to run first; got ${show(b.error)}`);
  const keys = S.okData(run, 'keys');
  assert(keys.state === 'done' && keys.report.before.withLabel === 0 && keys.report.before.withoutKey === 9,
    'the graph tapestry-keys found next was untouched by the refused call');
});

// ── Refusals, callers and the command (AC7) ──────────────────────────────────────────────────────────────────────

test('M16: an unknown migration is refused 400 unknown-migration, the message naming tapestry-keys and event-less-nodes; nothing changes (AC7)', async () => {
  const { inst, run } = await S.setup('unknown', {
    mustExist: MUST,
    instance: { graph: UNMIGRATED() },
    scenario: () => ({ requests: [post('unknown', 'owner', { migration: 'copy-names' }), post('missing', 'owner', {}), keysRun('then')] }),
  });
  const b = refused(run, 'unknown', 400, 'unknown-migration');
  assert(/tapestry-keys/.test(String(b.error)) && /event-less-nodes/.test(String(b.error)), `the refusal names the migrations it knows; got ${show(b.error)}`);
  const missing = F.pick(run, 'missing');
  assert(missing.status === 400, `a call with no migration is refused 400; got ${missing.status} ${show(missing.body)}`);
  const then = S.okData(run, 'then');
  assert(then.state === 'done' && then.report.before.withoutKey === 9, 'the graph was untouched by the refused calls (the next run found it as it was)');
  assert(F.backupIds(inst.backupsDir).length === 1, 'the refused calls took no backup');
});

test('M17: while a backup, restore or migration holds the lock, migrate is refused 409 busy and touches nothing; while a migration holds it, backup is refused busy, naming the migration (AC7)', async () => {
  const { inst, run } = await S.setup('busy', {
    mustExist: MUST,
    instance: { graph: UNMIGRATED() },
    before: (i) => { F.writeLock(i.backupsDir, { op: 'migrate', pid: process.pid, stage: 'online' }); },
    scenario: () => ({ requests: [keysRun('busy'), { id: 'backup', method: 'POST', url: '/api/tapestry/lifecycle/backup', caller: 'owner', body: {} }] }),
  });
  const b = refused(run, 'busy', 409, 'busy');
  assert(/migrat/i.test(String(b.error)), `the busy refusal says a migration is running; got ${show(b.error)}`);
  const bb = refused(run, 'backup', 409, 'busy');
  assert(/migrat/i.test(String(bb.error)), `backup's busy refusal says a migration is running (busyMessage, ADR Decision 2); got ${show(bb.error)}`);
  assert(writes(inst).length === 0 && F.calls(inst.state, 'supervisor').length === 0, 'nothing was stopped or written');
  assert(show(graphOf(inst).nodes.map((n) => n.labels)) === show(UNMIGRATED().nodes.map((n) => n.labels)), 'the graph is as it was');
});

test('M18: a graph that doesn\'t answer is refused 409 graph-unavailable before anything stops (AC7)', async () => {
  const { inst, run } = await S.setup('down', {
    mustExist: MUST,
    instance: { graph: UNMIGRATED(), failures: { cypherDown: true } },
    scenario: () => ({ requests: [keysRun('down')] }),
  });
  refused(run, 'down', 409, 'graph-unavailable');
  assert(F.calls(inst.state, 'supervisor').length === 0 && F.backupIds(inst.backupsDir).length === 0, 'nothing was stopped and no backup taken');
  assert(F.calls(inst.state, 'cypher').length > 0, 'the graph was asked (so this isn\'t passing on a call that never reached it)');
});

test('M19: when the backup before the migration fails, the run ends there: 500 failed, saying the backup failed and nothing was changed; the graph, the server and the writers are as they were (ADR Decision 2)', async () => {
  const { inst, run } = await S.setup('backup-fails', {
    mustExist: MUST,
    instance: { graph: UNMIGRATED(), failures: { dump: true } },
    scenario: () => ({ requests: [keysRun('owner'), getStatus('status')] }),
  });
  const r = F.pick(run, 'owner');
  assert(r.status === 500 && r.body && r.body.code === 'failed', `answers 500 failed; got ${r.status} ${show(r.body)}`);
  assert(/backup before migration tapestry-keys failed/i.test(String(r.body.error)) && /nothing was changed/i.test(String(r.body.error)),
    `the error says "The backup before migration tapestry-keys failed: …; nothing was changed."; got ${show(r.body.error)}`);
  assert(F.trace(inst.state).includes('dump'), 'the backup was attempted (so this isn\'t passing on a run that never started)');
  assert(writes(inst).length === 0, `nothing was written; the fake saw ${show(writes(inst).map((e) => e.what))}`);
  assert(show(graphOf(inst).nodes) === show(UNMIGRATED().nodes), 'the graph is exactly as it was');
  const st = F.readState(inst.state);
  assert(st.online && Object.values(st.programs).every((p) => p === 'RUNNING') && !fs.existsSync(path.join(inst.backupsDir, '.lock')),
    `the server and writers are running and the lock is gone; got ${show({ online: st.online, programs: st.programs })}`);
  const k = migrationOf(S.okData(run, 'status'), 'tapestry-keys');
  assert(k.applied === false && k.lastRun && k.lastRun.outcome === 'failed' && /backup/i.test(String(k.lastRun.error)), `status shows the failed run and why; got ${show(k)}`);
});

test('M20: the owner and admins may run it, and the run records who did; a visitor is refused 401 and a stranger 403 (AC7)', async () => {
  const { inst, run } = await S.setup('callers', {
    mustExist: MUST,
    instance: { graph: UNMIGRATED() },
    scenario: () => ({ requests: [keysRun('visitor', 'visitor'), keysRun('stranger', 'stranger'), keysRun('admin', 'admin'), post('owner', 'owner', { migration: 'event-less-nodes' }), getStatus('status', 'admin')] }),
  });
  assert(F.pick(run, 'visitor').status === 401, `a visitor is refused 401; got ${F.pick(run, 'visitor').status}`);
  assert(F.pick(run, 'stranger').status === 403, `a stranger is refused 403; got ${F.pick(run, 'stranger').status}`);
  assert(S.okData(run, 'admin').state === 'done' && S.okData(run, 'owner').state === 'done', 'the admin and the owner each ran one');
  const s = S.okData(run, 'status');
  assert(migrationOf(s, 'tapestry-keys').lastRun.by === ADMIN && migrationOf(s, 'event-less-nodes').lastRun.by === OWNER, 'each run records who ran it');
  const recs = migrateRuns(inst);
  assert(recs.length === 2 && recs.every((x) => x.op === 'migrate' && typeof x.migration === 'string'), `each run's file names op migrate and its migration; got ${show(recs.map((x) => ({ op: x.op, migration: x.migration })))}`);
});

const fromTheShell = () => S.setup('cli', {
  mustExist: MUST,
  instance: { graph: UNMIGRATED() },
  scenario: () => ({
    cli: [{ id: 'cli', argv: ['lifecycle', 'migrate', '--migration', 'tapestry-keys'] }, { id: 'cli-evless', argv: ['lifecycle', 'migrate', '--migration', 'event-less-nodes', '--wait', '7'] },
      { id: 'cli-unknown', argv: ['lifecycle', 'migrate', '--migration', 'nope'] }, { id: 'cli-status', argv: ['lifecycle', 'status'] }],
  }),
});

test('M21: the command runs a migration without signing in, prints the route\'s answer, says on stderr that the job finishes on its own, and records \'local\' as who ran it (AC7)', async () => {
  const { run } = await fromTheShell();
  const c = F.pick(run, 'cli');
  let j = null;
  try { j = JSON.parse(c.stdout); } catch { /* reported below */ }
  assert(c.code === 0 && j && j.success === true && j.data && j.data.state === 'done' && j.data.migration === 'tapestry-keys',
    `the command exits 0 with the answer's JSON on stdout; got ${show(c.code)} ${show(String(c.stdout).slice(0, 400))} ${String(c.stderr).slice(-300)}`);
  assert(/job of its own/i.test(c.stderr) && /tapestry lifecycle status/.test(c.stderr), `stderr says the job finishes even if the command is interrupted; got ${show(String(c.stderr).slice(-400))}`);
  const u = F.pick(run, 'cli-unknown');
  let ju = null;
  try { ju = JSON.parse(u.stdout); } catch { /* reported below */ }
  assert(u.code === 1 && ju && ju.code === 'unknown-migration', `an unknown migration exits 1 with the refusal; got ${u.code} ${show(String(u.stdout).slice(0, 300))}`);
  const st = JSON.parse(F.pick(run, 'cli-status').stdout).data;
  assert(migrationOf(st, 'tapestry-keys').lastRun.by === 'local', `a run from the command records by: 'local'; got ${show(migrationOf(st, 'tapestry-keys').lastRun)}`);
});

test('M22: the route waits 50 s by default and `wait` seconds when given; the command waits to the end unless given --wait (Sub-decision 3)', async () => {
  const httpRun = await eventLess();
  S.okData(httpRun.run, 'keys');
  S.okData(httpRun.run, 'owner');
  const cliRun = await fromTheShell();
  const seen = (r) => F.calls(r.inst.state, 'runDetached').filter((e) => e.op === 'migrate').map((e) => e.waitMs);
  const http = seen(httpRun);
  assert(show(http) === show([50000, 5000]), `over HTTP, runDetached is asked to wait 50000 ms by default and 5000 ms for wait: 5; got ${show(http)}`);
  const cli = seen(cliRun);
  assert(show(cli) === show([null, 7000]), `from the command, it waits to the end (no waitMs), or 7000 ms for --wait 7; got ${show(cli)}`);
});

test('M23: a run that outlasts its wait answers state running with its run id and no report; status then shows how it went (Sub-decision 3)', async () => {
  const { inst, run } = await S.setup('running', {
    mustExist: MUST,
    instance: { graph: UNMIGRATED() },
    scenario: (i) => ({ lifecycleFake: { stateFile: i.state, detachedOutcome: 'running' }, requests: [keysRun('owner', 'owner', { wait: 1 }), getStatus('status')] }),
  });
  const d = S.okData(run, 'owner');
  assert(d.state === 'running' && F.ID_RE.test(String(d.runId)) && d.report === null, `the answer is { state: 'running', runId, report: null }; got ${show(d).slice(0, 300)}`);
  assert(migrateRuns(inst).some((r) => r.runId === d.runId), 'the run id is the run\'s file');
  assert(/tapestry lifecycle status|lifecycle\/status/.test(String(d.note)), `the note says where to see how it goes; got ${show(d.note)}`);
  const k = migrationOf(S.okData(run, 'status'), 'tapestry-keys');
  assert(k.lastRun && k.lastRun.runId === d.runId && k.lastRun.outcome === 'done' && k.applied === true, `status shows the run, finished; got ${show(k)}`);
});

module.exports = { run: () => S.run() };

if (require.main === module) {
  module.exports.run().then((r) => process.exit(r.fail ? 1 : 0));
}
