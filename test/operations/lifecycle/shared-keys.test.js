'use strict';
/**
 * lifecycle migrate's check for keys held by more than one node — graph-operations-foundation #9, a bug from story 3.
 * Run by test/operations.test.js, which finds every suite under test/operations/.
 *   Story: engineering-team/stories/graph-operations-foundation/9-tapestry-keys-within-transaction-memory.md
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0009-shared-keys-from-a-stream-of-hashes.md
 *   Plan:  engineering-team/stories/graph-operations-foundation/9-tapestry-keys-within-transaction-memory.test-plan.md
 *
 * Stack-free (every run, CI included). The route runs in a child process (test/helpers/operationsHarness.js) against a
 * temporary instance whose fake graph database (test/helpers/lifecycleFakes.js) answers ADR 0009's streamed reads and
 * logs each one, so a test reads what the check sent as well as what it answered.
 *   SK1  no rule: the keys are read once, as a stream, nothing is grouped, nothing more is read; the rule added [AC1, AC4]
 *   SK2  a key on two nodes and one on twelve: both named, in key order, each count exact, up to ten nodes   [AC3]
 *   SK3  more than 100 shared keys: the first 100 in key order, each with its exact count                    [AC3]
 *   SK4  the rule in place, an unlabelled node holding a labelled node's key: named, left alone, not applied [AC3]
 *   SK5  the rule in place, two unlabelled nodes sharing a key: named, left alone, not applied               [AC3]
 *   SK6  two different keys with the same keyHash: confirmed by the second read, and neither is named [ADR D3, D5]
 *   SK7  the number 1 and the string '1' are two keys, not one                                              [ADR D5]
 *   SK8  status on a migrated graph: applied, its check one streamed read of unlabelled keys, nothing more    [AC5]
 *
 * Live: only with TAPESTRY_CONTAINER naming a scratch container (tapestry-scratch…) and TAPESTRY_KEYS_LIVE=1, on
 * staging's shape. Never the shared stack: every check drops the rule, and LK2 and LK4 rewrite keys and labels.
 *   LK1  staging's shape, rule dropped: done, no backup, rule and index online; transactions < 64 MB;
 *        the job's process no higher than a backup's count of the same keys                                [AC1, AC4]
 *   LK2  keys planted on 2 and on 12 nodes: named, unchanged, the rule left out; then the rule in place and a
 *        node without the label holding a labelled node's key: named, left alone                                [AC3]
 *   LK3  status on the migrated graph answers in under 5 s (today's code: 3.2–3.4 s), applied                    [AC5]
 *   LK4  production's shape (every second user, every card set and card unkeyed): backup, every node keyed and
 *        labelled, rule and index online; transactions < 64 MB                                          [AC2, AC4]
 *
 *   node test/operations/lifecycle/shared-keys.test.js                                       # stack-free only
 *   TAPESTRY_CONTAINER=$(SCRATCH_IMAGE=agent-memory-tapestry:latest bash scripts/scratch-stack.sh up)
 *   TAPESTRY_CONTAINER=tapestry-scratch node test/helpers/seedStagingShape.js                # staging's shape
 *   TAPESTRY_CONTAINER=tapestry-scratch TAPESTRY_KEYS_LIVE=1 node test/operations/lifecycle/shared-keys.test.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const F = require('../../helpers/lifecycleFakes');
const live = require('../../helpers/scratchLoopback');

const ROOT = F.ROOT;
const ROUTE = '/api/tapestry/lifecycle/migrate';
const STATUS = '/api/tapestry/lifecycle/status';
const MIGRATIONS = path.join(ROOT, 'src/operations/catalog/lifecycle/_migrations.js');
const PROBES = path.join(ROOT, 'test/helpers/scratchProbes');
const MUST = [[MIGRATIONS, 'ADR graph-operations-foundation/0003 Decision 3']];
const { show } = F;
const S = F.suite('lifecycle migrate: the check for shared keys');
const { test } = S;
const assert = F.assert;

/**
 * Two different keys with the same keyHash under ADR 0009 Decision 5 (cyrb53): found once, offline, by a birthday
 * search of 240 million strings `collide-<n in base 36>` on 2026-11-16. Both hash to 7794590295477596.
 */
const COLLIDING = ['collide-8xvbc', 'collide-28yjcu'];
const COLLIDING_HASH = 7794590295477596;

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────────────────────────────

const TA = 'ee'.repeat(32);
const uuid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
/** A small graph as tapestry-keys leaves it: events, tags, users and card sets, every node keyed and labelled. */
function keyedNodes(n = 8) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const kind = i % 4;
    if (kind === 0) out.push({ labels: ['NostrEvent', 'ListItem', 'TapestryNode'], key: uuid(i), id: `e-${i}`, uuid: `39999:${TA}:item-${i}`, tags: 2 });
    else if (kind === 1) out.push({ labels: ['NostrEventTag', 'TapestryNode'], key: uuid(i), uuid: `tag-${i}`, type: 'd', value: `item-${i}` });
    else if (kind === 2) out.push({ labels: ['NostrUser', 'TapestryNode'], key: uuid(i), pubkey: String(i).padStart(64, 'a') });
    else out.push({ labels: ['Set', 'SetOfNostrUserWotMetricsCards', 'TapestryNode'], key: uuid(i), observee_pubkey: String(i).padStart(64, 'b') });
  }
  return out;
}
/** A NostrUser holding `key`, with or without the label. */
const user = (key, labelled, i) => ({ labels: labelled ? ['NostrUser', 'TapestryNode'] : ['NostrUser'], key, pubkey: String(i).padStart(64, 'c') });

const keysRun = (id) => ({ id, method: 'POST', url: ROUTE, caller: 'owner', body: { migration: 'tapestry-keys' } });
const getStatus = (id) => ({ id, method: 'GET', url: STATUS, caller: 'owner' });
const graphOf = (inst) => F.readState(inst.state).graph;
const reads = (inst, what) => F.calls(inst.state, 'cypher').filter((e) => e.what === what);
const holdersOf = (g, key) => g.nodes.filter((n) => n.key === key);
const has = (n, label) => !!n && n.labels.includes(label);
function keysEntry(statusData) {
  const m = statusData && statusData.migrations;
  assert(m && m.known === true && Array.isArray(m.migrations), `status's migrations part is { known: true, keys, migrations: [...], note }; got ${show(m)}`);
  const entry = m.migrations.find((x) => x.name === 'tapestry-keys');
  assert(entry, `status lists tapestry-keys; got ${show(m.migrations.map((x) => x.name))}`);
  return entry;
}

/** ADR 0009: the check never groups every key in one query — story 3's read, which held 394 bytes a key. */
function noGrouping(inst) {
  const grouped = reads(inst, 'shared-keys-grouped');
  assert(grouped.length === 0,
    `the check for shared keys never groups the keys in one query (ADR 0009, Decision 1: it streams them); it sent story 3's grouping ${grouped.length} time${grouped.length === 1 ? '' : 's'}`);
}
/** ADR 0009 Decisions 1 and 3: each of the check's reads goes through cypherEach, so neither Neo4j nor the driver holds its rows. */
function streamed(inst, what, why) {
  const r = reads(inst, what);
  assert(r.length > 0, `the check sent its ${why} (${what}); the fake saw ${show([...new Set(F.calls(inst.state, 'cypher').map((e) => e.what))])}`);
  assert(r.every((e) => e.streamed === true), `the check's ${why} goes through cypherEach (ADR 0009); got ${show(r.map((e) => ({ what: e.what, streamed: !!e.streamed })))}`);
  return r;
}
/** Each named node holds the key it is named under. */
function namesHolders(g, entry) {
  const holders = holdersOf(g, entry.key).map((n) => n.eid);
  assert(Array.isArray(entry.nodes) && entry.nodes.every((id) => holders.includes(id)) && new Set(entry.nodes).size === entry.nodes.length,
    `the nodes named for ${entry.key} are its holders' element ids, each once; got ${show(entry.nodes)} against ${show(holders)}`);
}

// ── Stack-free ───────────────────────────────────────────────────────────────────────────────────────────────────

test('SK1: with no rule, the check reads every key once, as a stream, groups nothing, and reads nothing more when no key is shared; then the rule is added (AC1, AC4; ADR 0009 Decisions 1–3)', async () => {
  const { inst, run } = await S.setup('no-rule', {
    mustExist: MUST,
    instance: { graph: F.nodeGraph({ nodes: keyedNodes(8) }) },
    scenario: () => ({ requests: [keysRun('owner'), getStatus('status')] }),
  });
  const d = S.okData(run, 'owner');
  assert(d.state === 'done' && d.backup === null, `tapestry-keys answers done with no backup, since no node changes; got ${show(d).slice(0, 300)}`);
  noGrouping(inst);
  const first = streamed(inst, 'shared-keys-read', 'read of every key');
  assert(first.length === 1 && first[0].rows === 8, `the keys are read once, all 8 of them (Decision 1); got ${show(first)}`);
  assert(reads(inst, 'shared-holders').length === 0, 'with no candidate, nothing more is read (Decision 2)');
  assert(d.report.rule === 'added' && Array.isArray(d.report.sharedKeys) && d.report.sharedKeys.length === 0,
    `no key is shared, so the rule is added; got ${show({ rule: d.report.rule, sharedKeys: d.report.sharedKeys })}`);
  assert(keysEntry(S.okData(run, 'status')).applied === true, 'status then reads tapestry-keys as applied');
});

test('SK2: with no rule, a key on two nodes and a key on twelve are both named, in key order, each with its exact count and up to ten of its nodes; neither key changes, the rule is left out, and status reads it not applied (AC3)', async () => {
  const twelve = Array.from({ length: 12 }, (_, i) => user('k-twelve', i % 2 === 0, 100 + i));
  const nodes = [...keyedNodes(6), user('k-two', true, 1), { labels: ['NostrEvent', 'TapestryNode'], key: 'k-two', id: 'e-two', uuid: 'e-two', tags: 1 }, ...twelve];
  const { inst, run } = await S.setup('two-and-twelve', {
    mustExist: MUST,
    instance: { graph: F.nodeGraph({ nodes }) },
    scenario: () => ({ requests: [keysRun('owner'), getStatus('status')] }),
  });
  const d = S.okData(run, 'owner');
  const named = d.report.sharedKeys;
  assert(Array.isArray(named) && named.length === 2, `two keys are named; got ${show(named)}`);
  assert(named[0].key === 'k-twelve' && named[1].key === 'k-two',
    `the shared keys come in key order, so every run names them alike (ADR 0009 Decision 4); got ${show(named.map((x) => x.key))}`);
  assert(named[0].count === 12 && named[0].nodes.length === 10, `k-twelve: count 12, ten of its nodes; got ${show(named[0])}`);
  assert(named[1].count === 2 && named[1].nodes.length === 2, `k-two: count 2, both its nodes; got ${show(named[1])}`);
  const g = graphOf(inst);
  for (const entry of named) namesHolders(g, entry);
  assert(holdersOf(g, 'k-twelve').length === 12 && holdersOf(g, 'k-two').length === 2, 'neither shared key changes on any node');
  assert(d.report.rule === 'left-out' && !(g.schema.constraints || []).some((c) => c.name === 'tapestry_key'), `the rule is left out; got ${show({ rule: d.report.rule, schema: g.schema })}`);
  assert(keysEntry(S.okData(run, 'status')).applied === false, 'status reads tapestry-keys as not applied while a key is shared');
  noGrouping(inst);
  streamed(inst, 'shared-keys-read', 'read of every key');
  streamed(inst, 'shared-holders', 'read of the candidates\' holders');
});

test('SK3: with more than 100 shared keys, the answer is the first 100 in key order, each with its exact count (AC3; ADR 0009 Decision 4)', async () => {
  const nodes = [];
  // Written in descending key order, so an answer in the order the nodes come gives the wrong 100.
  for (let i = 119; i >= 0; i--) {
    const k = `k-dup-${String(i).padStart(3, '0')}`;
    nodes.push(user(k, true, i * 2), user(k, true, i * 2 + 1));
  }
  nodes.push(user('k-dup-007', true, 999));
  const { inst, run } = await S.setup('over-a-hundred', {
    mustExist: MUST,
    instance: { graph: F.nodeGraph({ nodes }) },
    scenario: () => ({ requests: [keysRun('owner')] }),
  });
  const named = S.okData(run, 'owner').report.sharedKeys;
  const want = Array.from({ length: 100 }, (_, i) => `k-dup-${String(i).padStart(3, '0')}`);
  assert(Array.isArray(named) && named.length === 100, `at most 100 shared keys are named; got ${Array.isArray(named) ? named.length : show(named)}`);
  assert(named.every((x, i) => x.key === want[i]),
    `they are the first 100 in key order, k-dup-000 to k-dup-099; got ${show(named.slice(0, 3).map((x) => x.key))} … ${show(named.slice(-2).map((x) => x.key))}`);
  const wrong = named.filter((x) => x.count !== (x.key === 'k-dup-007' ? 3 : 2) || x.nodes.length !== x.count);
  assert(wrong.length === 0, `each count is exact (k-dup-007 on three nodes, the rest on two), with every node named; got ${show(wrong.slice(0, 3))}`);
  noGrouping(inst);
});

test('SK4: with the rule in place, a node without the label that holds a labelled node\'s key is named with both nodes and left alone; the rule stays, and status reads tapestry-keys as not applied before and after (AC3)', async () => {
  const nodes = [...keyedNodes(8), user(uuid(2), false, 7)];
  const { inst, run } = await S.setup('held', {
    mustExist: MUST,
    instance: { graph: F.nodeGraph({ nodes, schema: F.migratedSchema() }) },
    scenario: () => ({ requests: [getStatus('before'), keysRun('owner'), getStatus('after')] }),
  });
  assert(keysEntry(S.okData(run, 'before')).applied === false, 'status reads tapestry-keys as not applied while the key is held twice');
  const d = S.okData(run, 'owner');
  const named = d.report.sharedKeys;
  assert(Array.isArray(named) && named.length === 1 && named[0].key === uuid(2) && named[0].count === 2 && named[0].nodes.length === 2,
    `the held key is named, with both nodes: [{ key: '${uuid(2)}', count: 2, nodes: [2 ids] }]; got ${show(named)}`);
  const g = graphOf(inst);
  namesHolders(g, named[0]);
  const probe = g.nodes.find((n) => n.eid === '4:fake:8');
  assert(probe && !has(probe, 'TapestryNode') && probe.key === uuid(2), `the unlabelled holder is left alone, with no label and its key; got ${show(probe)}`);
  assert(d.report.rule === 'already-there', `the rule stays; got ${show(d.report.rule)}`);
  assert(keysEntry(S.okData(run, 'after')).applied === false, 'status still reads tapestry-keys as not applied');
  noGrouping(inst);
  const first = streamed(inst, 'shared-keys-unlabelled', 'read of the unlabelled nodes\' keys, each checked against the rule');
  assert(first.some((e) => e.rows === 1), `that read covers only the one unlabelled node; got ${show(first)}`);
  streamed(inst, 'shared-holders', 'read of the candidates\' holders');
});

test('SK5: with the rule in place, two nodes without the label sharing a key no labelled node holds are named and left alone; status reads tapestry-keys as not applied (AC3)', async () => {
  const nodes = [...keyedNodes(8), user('k-pair', false, 21), user('k-pair', false, 22)];
  const { inst, run } = await S.setup('unlabelled-pair', {
    mustExist: MUST,
    instance: { graph: F.nodeGraph({ nodes, schema: F.migratedSchema() }) },
    scenario: () => ({ requests: [getStatus('before'), keysRun('owner')] }),
  });
  assert(keysEntry(S.okData(run, 'before')).applied === false, 'status reads tapestry-keys as not applied while two nodes share a key');
  const named = S.okData(run, 'owner').report.sharedKeys;
  assert(Array.isArray(named) && named.length === 1 && named[0].key === 'k-pair' && named[0].count === 2 && named[0].nodes.length === 2,
    `the shared key is named with both nodes; got ${show(named)}`);
  const g = graphOf(inst);
  namesHolders(g, named[0]);
  assert(holdersOf(g, 'k-pair').every((n) => !has(n, 'TapestryNode')), 'both are left without the label, so no batch fails on the rule');
  noGrouping(inst);
  streamed(inst, 'shared-keys-unlabelled', 'read of the unlabelled nodes\' keys');
});

test('SK6: two different keys with the same keyHash are confirmed by the second read and not named; the rule is added (ADR 0009 Decisions 3 and 5)', async () => {
  const exported = require(MIGRATIONS);
  assert(typeof exported.keyHash === 'function', `_migrations.js exports keyHash for the suites (ADR 0009 Decision 5); it exports ${show(Object.keys(exported))}`);
  const [a, b] = COLLIDING;
  assert(a !== b && exported.keyHash(a) === COLLIDING_HASH && exported.keyHash(b) === COLLIDING_HASH,
    `keyHash is Decision 5's cyrb53: '${a}' and '${b}' both hash to ${COLLIDING_HASH}; got ${exported.keyHash(a)} and ${exported.keyHash(b)}`);
  const { inst, run } = await S.setup('colliding', {
    mustExist: MUST,
    instance: { graph: F.nodeGraph({ nodes: [...keyedNodes(6), user(a, true, 31), user(b, true, 32)] }) },
    scenario: () => ({ requests: [keysRun('owner')] }),
  });
  const d = S.okData(run, 'owner');
  streamed(inst, 'shared-holders', 'second read, which confirms the candidates');
  assert(Array.isArray(d.report.sharedKeys) && d.report.sharedKeys.length === 0, `keys that only hash alike aren't shared; got ${show(d.report.sharedKeys)}`);
  assert(d.report.rule === 'added', `so the rule is added; got ${show(d.report.rule)}`);
  noGrouping(inst);
});

test('SK7: the number 1 and the string \'1\' are two keys, as Neo4j compares them: neither is named, and the rule is added (ADR 0009 Decision 5)', async () => {
  const exported = require(MIGRATIONS);
  assert(typeof exported.keyHash === 'function', `_migrations.js exports keyHash for the suites (ADR 0009 Decision 5); it exports ${show(Object.keys(exported))}`);
  assert(exported.keyHash(1) !== exported.keyHash('1'), `keyHash hashes a key with its type, so 1 and '1' differ; both gave ${exported.keyHash('1')}`);
  const { inst, run } = await S.setup('typed', {
    mustExist: MUST,
    instance: { graph: F.nodeGraph({ nodes: [...keyedNodes(6), user('1', true, 41), user(1, true, 42)] }) },
    scenario: () => ({ requests: [keysRun('owner')] }),
  });
  const d = S.okData(run, 'owner');
  assert(Array.isArray(d.report.sharedKeys) && d.report.sharedKeys.length === 0, `1 and '1' aren't one shared key; got ${show(d.report.sharedKeys)}`);
  assert(d.report.rule === 'added', `the rule is added; got ${show(d.report.rule)}`);
  const g = graphOf(inst);
  assert(holdersOf(g, '1').length === 1 && holdersOf(g, 1).length === 1, 'each node keeps its own key');
  noGrouping(inst);
  streamed(inst, 'shared-keys-read', 'read of every key');
});

test('SK8: on a migrated graph, status reads tapestry-keys as applied; its check is one streamed read of the unlabelled nodes\' keys, and nothing more (AC5)', async () => {
  const { inst, run } = await S.setup('migrated', {
    mustExist: MUST,
    instance: { graph: F.nodeGraph({ nodes: keyedNodes(8), schema: F.migratedSchema() }) },
    scenario: () => ({ requests: [getStatus('status')] }),
  });
  assert(keysEntry(S.okData(run, 'status')).applied === true, 'status reads tapestry-keys as applied');
  noGrouping(inst);
  const first = streamed(inst, 'shared-keys-unlabelled', 'read of the unlabelled nodes\' keys');
  assert(first.every((e) => e.rows === 0), `there is no unlabelled node to read; got ${show(first)}`);
  assert(reads(inst, 'shared-holders').length === 0, 'with nothing to confirm, nothing more is read');
});

// ── Live, on a scratch stack in staging's shape ──────────────────────────────────────────────────────────────────

const LIVE_FLAG = 'TAPESTRY_KEYS_LIVE';
const STAGING_SHAPE = { all: 3500000, cardSets: 370000 };
const TX_BOUND_MB = 64;       // AC4: an eighth of the scratch stack's 512 MB
const STATUS_SECONDS = 5;     // AC5: today's code took 3.17–3.38 s on the migrated staging shape (2026-11-16, docker exec and the CLI's start included)
const LK4_WORKER_SLACK = 1.25; // LK4's job takes its own backup, whose count of the keys is the yardstick
let liveWhy = null;

function liveSkip() {
  if (liveWhy !== null) return liveWhy;
  if (process.env[LIVE_FLAG] !== '1') return (liveWhy = `${LIVE_FLAG}=1 is not set`);
  const refusal = live.scratchRefusal();
  if (refusal) return (liveWhy = refusal);
  const shape = live.graphShape();
  if (shape.all < STAGING_SHAPE.all || shape.cardSets < STAGING_SHAPE.cardSets) {
    return (liveWhy = `the scratch graph isn't staging's shape (${shape.all} nodes, ${shape.cardSets} card sets); seed it first with test/helpers/seedStagingShape.js`);
  }
  return (liveWhy = '');
}
function skipLive(why) { console.log(`        (live check skipped: ${why})`); return 'skip'; }
const short = (x, n = 600) => { const s = typeof x === 'string' ? x : JSON.stringify(x); return s && s.length > n ? `${s.slice(0, n)}…` : s; };
const record = (name, m) => console.log(`        [${name}] ${JSON.stringify(m)}`);

/** A Cypher statement through the container's cypher-shell (schema and fixtures; scratch only). Its output as text. */
function cs(statement, maxSeconds = 900) {
  const c = live.assertScratch();
  const pw = live.sh("sed -n 's/^export NEO4J_PASSWORD=//p' /etc/brainstorm.conf | tr -d '\"'").trim();
  return execFileSync('docker', ['exec', '-i', c, 'cypher-shell', '-a', 'bolt://localhost:7687', '-u', 'neo4j', '-p', pw, '--format', 'plain', statement],
    { encoding: 'utf8', maxBuffer: 64 << 20, timeout: maxSeconds * 1000 });
}
/** The one value a statement returns (its last line, unquoted). */
const csValue = (statement) => cs(statement).trim().split('\n').pop().replace(/^"|"$/g, '');
const count = (statement) => Number(csValue(statement));

/** The instance's own command inside the container; its JSON answer, and how long it took. */
function tapestry(args, maxSeconds = 1800) {
  const c = live.assertScratch();
  const t0 = Date.now();
  let out = '';
  try {
    out = execFileSync('docker', ['exec', c, 'tapestry', ...args], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: maxSeconds * 1000, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    out = String(e.stdout || ''); // a refused or failed answer exits non-zero, with its JSON still on stdout
  }
  const at = out.startsWith('{') ? 0 : out.indexOf('\n{') + 1;
  let body = null;
  try { body = at >= 0 ? JSON.parse(out.slice(at)) : null; } catch { /* not JSON */ }
  return { body, data: body && body.data, seconds: (Date.now() - t0) / 1000, out };
}
const migrateKeys = () => tapestry(['lifecycle', 'migrate', '--migration', 'tapestry-keys']);
function liveStatus() {
  const r = tapestry(['lifecycle', 'status'], 120);
  assert(r.body && r.body.success === true, `lifecycle status answers; got ${short(r.out)}`);
  return { entry: keysEntry(r.data), seconds: r.seconds };
}
function indexStates() {
  const out = cs("SHOW INDEXES YIELD name, state WHERE name IN ['tapestry_key', 'tapestry_node_uuid'] RETURN name, state");
  const states = {};
  for (const line of out.trim().split('\n').slice(1)) {
    const [name, state] = line.split(',').map((x) => x.trim().replace(/^"|"$/g, ''));
    states[name] = state;
  }
  return states;
}

function copyProbes() {
  const c = live.assertScratch();
  for (const f of ['txMemoryPeak.js', 'workerPeak.sh', 'backupCountPeak.js']) execFileSync('docker', ['cp', path.join(PROBES, f), `${c}:/tmp/${f}`]);
}
/** A backup's count of the keys, in a process of its own: its count and peak memory, AC4's yardstick. */
function backupCountPeak() {
  copyProbes();
  const out = live.sh('node /tmp/backupCountPeak.js', 600).trim().split('\n').pop();
  const r = JSON.parse(out);
  assert(r && !r.error && r.peakKB > 0, `a backup's count of the keys runs; got ${short(out)}`);
  return r;
}
function startProbes(tag) {
  const c = live.assertScratch();
  copyProbes();
  live.sh(`rm -f /tmp/tx-${tag}.out /tmp/worker-${tag}.out`);
  execFileSync('docker', ['exec', '-d', c, 'sh', '-c', `node /tmp/txMemoryPeak.js --seconds=1800 > /tmp/tx-${tag}.out 2>&1`]);
  execFileSync('docker', ['exec', '-d', c, 'sh', '-c', `sh /tmp/workerPeak.sh 1800 > /tmp/worker-${tag}.out 2>&1`]);
}
function stopProbes(tag) {
  live.sh(`p=$(pgrep -f '^node /tmp/txMemoryPeak.js'); [ -n "$p" ] && kill -INT $p; for i in $(seq 1 20); do [ -s /tmp/tx-${tag}.out ] && break; sleep 0.5; done; true`, 60);
  const tx = JSON.parse(live.sh(`cat /tmp/tx-${tag}.out`).trim().split('\n').pop());
  const w = live.sh(`for i in $(seq 1 40); do [ -s /tmp/worker-${tag}.out ] && break; sleep 0.5; done; cat /tmp/worker-${tag}.out; true`, 60).trim();
  const m = w.match(/peakKB=(\d+)/);
  return { txPeakMB: tx.peakAllMB, txSamples: tx.samples, txTop: tx.queries.slice(0, 3), workerKB: m ? Number(m[1]) : null };
}

test('LK1: [live, staging\'s shape] with the rule dropped, tapestry-keys answers done with no backup and adds the rule and the index, both online; Neo4j\'s transactions together stay under 64 MB, and the job\'s process peaks no higher than a backup\'s count of the same keys (AC1, AC4)', () => {
  const why = liveSkip();
  if (why) return skipLive(why);
  cs('DROP CONSTRAINT tapestry_key IF EXISTS');
  const yardstick = backupCountPeak();
  startProbes('lk1');
  const r = migrateKeys();
  const probes = stopProbes('lk1');
  record('LK1', { seconds: r.seconds, ...probes, backupCount: yardstick });
  const d = r.data;
  assert(r.body && r.body.success === true && d && d.state === 'done', `tapestry-keys answers done (AC1); got ${short(r.out)}`);
  assert(d.backup === null, `no backup is taken, since no node changes; got ${show(d.backup)}`);
  assert(d.report.rule === 'added' && ['added', 'already-there'].includes(d.report.index) && d.report.keysGiven === 0 && d.report.labelsGiven === 0
    && Array.isArray(d.report.sharedKeys) && d.report.sharedKeys.length === 0,
  `the report: the rule added, the index there or added, no key given, none shared; got ${short(d.report)}`);
  const states = indexStates();
  assert(states.tapestry_key === 'ONLINE' && states.tapestry_node_uuid === 'ONLINE', `both are online; got ${show(states)}`);
  assert(liveStatus().entry.applied === true, 'status reads tapestry-keys as applied');
  assert(probes.txSamples > 0 && probes.txPeakMB < TX_BOUND_MB,
    `Neo4j's transactions together stay under ${TX_BOUND_MB} MB through the run (AC4); the peak was ${probes.txPeakMB} MB: ${short(probes.txTop)}`);
  assert(probes.workerKB !== null && probes.workerKB <= yardstick.peakKB,
    `the job's process peaks no higher than a backup's count of the same ${yardstick.keys} keys (AC4): ${probes.workerKB} kB against ${yardstick.peakKB} kB`);
});

test('LK2: [live, staging\'s shape] keys planted on two nodes and on twelve are named with their counts and up to ten nodes, nothing changes and the rule is left out; with the rule in place, a node without the label holding a labelled node\'s key is named and left alone (AC3)', () => {
  const why = liveSkip();
  if (why) return skipLive(why);
  cs('DROP CONSTRAINT tapestry_key IF EXISTS');
  cs("MATCH (u:NostrUser) WITH u LIMIT 2 SET u.tapestryKey = 'lk2-two', u.lk2Probe = true");
  cs("MATCH (u:NostrUser) WHERE u.lk2Probe IS NULL WITH u LIMIT 12 SET u.tapestryKey = 'lk2-twelve', u.lk2Probe = true");
  try {
    const r = migrateKeys();
    record('LK2 no rule', { seconds: r.seconds, rule: r.data && r.data.report && r.data.report.rule });
    const d = r.data;
    assert(r.body && r.body.success === true && d && d.state === 'done', `tapestry-keys answers done; got ${short(r.out)}`);
    const named = d.report.sharedKeys || [];
    assert(named.length === 2 && named[0].key === 'lk2-twelve' && named[0].count === 12 && named[0].nodes.length === 10
      && named[1].key === 'lk2-two' && named[1].count === 2 && named[1].nodes.length === 2,
    `both planted keys are named, in key order, with their counts and up to ten nodes; got ${short(named)}`);
    assert(d.report.rule === 'left-out', `the rule is left out; got ${show(d.report.rule)}`);
    assert(count("MATCH (u) WHERE u.tapestryKey = 'lk2-twelve' RETURN count(u)") === 12 && count("MATCH (u) WHERE u.tapestryKey = 'lk2-two' RETURN count(u)") === 2,
      'neither planted key changes');
    assert(liveStatus().entry.applied === false, 'status reads tapestry-keys as not applied while a key is shared');
  } finally {
    cs('MATCH (u) WHERE u.lk2Probe = true SET u.tapestryKey = randomUUID() REMOVE u.lk2Probe');
  }
  const again = migrateKeys();
  assert(again.data && again.data.state === 'done' && again.data.report.rule === 'added', `with the planted keys gone, the rule is added; got ${short(again.out)}`);
  const held = csValue('MATCH (u:NostrUser:TapestryNode) WITH u LIMIT 1 CREATE (p:Lk2Probe {tapestryKey: u.tapestryKey}) RETURN p.tapestryKey');
  try {
    assert(liveStatus().entry.applied === false, 'with the rule in place, status reads tapestry-keys as not applied while an unlabelled node holds a labelled node\'s key');
    const r = migrateKeys();
    record('LK2 rule in place', { seconds: r.seconds, backup: r.data && r.data.backup });
    const d = r.data;
    assert(r.body && r.body.success === true && d && d.state === 'done', `tapestry-keys answers done; got ${short(r.out)}`);
    const named = d.report.sharedKeys || [];
    assert(named.length === 1 && named[0].key === held && named[0].count === 2 && named[0].nodes.length === 2,
      `the held key is named with both its nodes; got ${short(named)}`);
    assert(d.report.rule === 'already-there', `the rule stays; got ${show(d.report.rule)}`);
    assert(count('MATCH (p:Lk2Probe) WHERE NOT p:TapestryNode RETURN count(p)') === 1, 'the unlabelled holder is left without the label');
  } finally {
    cs('MATCH (p:Lk2Probe) DELETE p');
  }
  assert(liveStatus().entry.applied === true, 'with the probe gone, status reads tapestry-keys as applied again');
});

test('LK3: [live] on the migrated graph, lifecycle status reads tapestry-keys as applied and answers in under 5 s, about as quickly as today\'s code (3.2–3.4 s there) (AC5)', () => {
  const why = liveSkip();
  if (why) return skipLive(why);
  const s = liveStatus();
  record('LK3', { seconds: s.seconds });
  assert(s.entry.applied === true, `status reads tapestry-keys as applied; got ${show(s.entry)}`);
  assert(s.seconds < STATUS_SECONDS, `status answers in under ${STATUS_SECONDS} s on 3.85 million nodes; it took ${s.seconds} s`);
});

test('LK4: [live, production\'s shape] with every second user and every card set and card unkeyed and unlabelled, and no rule, tapestry-keys takes its backup, keys and labels every node, and adds the rule and the index, both online; Neo4j\'s transactions together stay under 64 MB (AC2, AC4)', () => {
  const why = liveSkip();
  if (why) return skipLive(why);
  cs('DROP CONSTRAINT tapestry_key IF EXISTS');
  const stripped = count(`CALL apoc.periodic.iterate("MATCH (n) WHERE (n:NostrUser AND id(n) % 2 = 0) OR n:SetOfNostrUserWotMetricsCards OR n:NostrUserWotMetricsCard RETURN n", "REMOVE n:TapestryNode REMOVE n.tapestryKey", {batchSize: 10000, parallel: false}) YIELD total RETURN total`);
  assert(stripped > 2000000, `production's shape: over two million nodes with no key and no label; got ${stripped}`);
  const yardstick = backupCountPeak();
  startProbes('lk4');
  const r = migrateKeys();
  const probes = stopProbes('lk4');
  record('LK4', { seconds: r.seconds, stripped, ...probes, backupCount: yardstick });
  const d = r.data;
  assert(r.body && r.body.success === true && d && d.state === 'done', `tapestry-keys answers done (AC2); got ${short(r.out)}`);
  assert(typeof d.backup === 'string' && d.backup.length > 0, `it takes its backup first and names it; got ${show(d.backup)}`);
  assert(d.report.keysGiven === stripped && d.report.labelsGiven === stripped, `every stripped node gets a key and the label (${stripped}); got ${show({ keysGiven: d.report.keysGiven, labelsGiven: d.report.labelsGiven })}`);
  assert(d.report.rule === 'added' && ['added', 'already-there'].includes(d.report.index), `the rule and the index are added or there; got ${show({ rule: d.report.rule, index: d.report.index })}`);
  assert(count("MATCH (n) WHERE n.tapestryKey IS NULL OR n.tapestryKey = '{}' RETURN count(n)") === 0 && count('MATCH (n) WHERE NOT n:TapestryNode RETURN count(n)') === 0,
    'no node is left without a key or the label');
  const states = indexStates();
  assert(states.tapestry_key === 'ONLINE' && states.tapestry_node_uuid === 'ONLINE', `both are online; got ${show(states)}`);
  assert(liveStatus().entry.applied === true, 'status reads tapestry-keys as applied');
  assert(probes.txSamples > 0 && probes.txPeakMB < TX_BOUND_MB,
    `Neo4j's transactions together stay under ${TX_BOUND_MB} MB through the run (AC4); the peak was ${probes.txPeakMB} MB: ${short(probes.txTop)}`);
  assert(probes.workerKB !== null && probes.workerKB <= yardstick.peakKB * LK4_WORKER_SLACK,
    `the job's process, whose own backup counts the keys first, peaks within ${LK4_WORKER_SLACK}× of a backup's count of them (AC4): ${probes.workerKB} kB against ${yardstick.peakKB} kB`);
});

module.exports = { run: () => S.run() };

if (require.main === module) {
  module.exports.run().then((r) => process.exit(r.fail ? 1 : 0));
}
