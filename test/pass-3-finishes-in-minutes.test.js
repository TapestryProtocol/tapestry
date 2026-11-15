'use strict';
/**
 * A firmware install's Pass 3 finishes in minutes — graph-operations-foundation #8 (a bug from story 3).
 *   Story: engineering-team/stories/graph-operations-foundation/8-pass-3-finishes-in-minutes.md
 *   Plan:  engineering-team/stories/graph-operations-foundation/8-pass-3-finishes-in-minutes.test-plan.md
 *   ADR:   none (the Standard bug path, chosen by the owner on 2026-11-15)
 *
 * Stack-free (every run, CI included). The real rebuild code runs in a child process (test/helpers/pass3DeriveChild.js)
 * over a fake graph (test/helpers/nodeCypherFake.js), with a recording cache. What was rebuilt is read from the cache
 * puts and the timestamp writes, not from the query text.
 *   S0  the fake's labels(), elementId() and id()                                                  [the fake]
 *   S1a after tapestry-keys: Pass 3's rebuild of each label rebuilds its nodes with an address, and none without  [AC1]
 *   S1b before tapestry-keys (no TapestryNode label anywhere): every node with an address is still rebuilt        [AC1]
 *   S2a derive-status counts, for each label, only its nodes with a key and an address                            [AC2]
 *   S2b once every node with an address is rebuilt, each label reads derived = total                              [AC2]
 *   S5  a rebuild by key of a node with no address does what it does today                                       [AC5]
 *   S6  before tapestry-keys, a rebuild by key still finds each node with an address; a missing key, none     [AC1, AC5]
 *   S7  before tapestry-keys, derive-status still counts each label's nodes with a key and an address         [AC2]
 *
 * Live (only with TAPESTRY_CONTAINER naming a scratch container, tapestry-scratch…; never the shared stack).
 *   L1  [small graph] Pass 3's rebuild passes by keyed card sets and other nodes with no address               [AC1]
 *   L2  derive-status's totals leave out the nodes with no address                                              [AC2]
 *   L5c a rebuild by key of a card set does what it does today                                                  [AC5]
 *   L5a [small graph] each rebuilt node holds what today's queries find for it                                  [AC5]
 *   L3  [staging's shape] one rebuild takes at most 200 ms, by key and inside derive-all                        [AC3]
 *   L4  [staging's shape, PASS3_INSTALL=1] a firmware install's Pass 3 finishes in under 10 minutes             [AC4]
 *   L2b [after L4] every label reads derived = total                                                            [AC2]
 *   L5b [one install, then a rebuild in this run] Pass 3's output matches today's, from test/fixtures/          [AC5]
 *
 *   node test/pass-3-finishes-in-minutes.test.js                                   # stack-free only
 *   TAPESTRY_CONTAINER=$(bash scripts/scratch-stack.sh up) node test/pass-3-finishes-in-minutes.test.js     # + small graph
 *   TAPESTRY_CONTAINER=tapestry-scratch node test/helpers/seedStagingShape.js      # then staging's shape:
 *   TAPESTRY_CONTAINER=tapestry-scratch PASS3_INSTALL=1 node test/pass-3-finishes-in-minutes.test.js
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const live = require('./helpers/scratchLoopback');
const { runQuery } = require('./helpers/nodeCypherFake');

const CHILD = path.join(__dirname, 'helpers/pass3DeriveChild.js');
const SNAPSHOT_FIXTURE = path.join(__dirname, 'fixtures/pass-3-snapshot-today.json');
const LABELS = ['ListItem', 'ListHeader', 'ConceptHeader', 'JSONSchema', 'Property', 'Set', 'Superset'];
const REBUILD_MS = 200;          // AC3
const PASS3_MINUTES = 10;        // AC4
const SMALL_GRAPH = 100000;      // below this, today's queries are quick enough to be the oracle (L5a)
const STAGING_SHAPE = { all: 3500000, cardSets: 370000 };

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const short = (x, n = 300) => { const s = typeof x === 'string' ? x : JSON.stringify(x); return s && s.length > n ? `${s.slice(0, n)}…` : s; };
const sorted = (xs) => [...xs].sort();
const sameSet = (a, b) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));

/* ───────────── the stack-free graphs ───────────── */

const TA = 'a'.repeat(64);

/** The concept graph's nodes, with the label sets they carry on a real instance (one of each kind), all addressed. */
function addressed({ migrated }) {
  const T = migrated ? ['TapestryNode'] : [];
  const node = (slug, labels, extra = {}) => ({ labels: [...labels, ...T], props: { uuid: `39999:${TA}:${slug}`, id: `event-${slug}`, tapestryKey: `k-${slug}`, name: slug, ...extra } });
  return [
    node('item', ['ListItem', 'NostrEvent']),
    node('superset', ['ListItem', 'NostrEvent', 'Superset']),
    node('header', ['ConceptHeader', 'ListHeader', 'NostrEvent'], { uuid: `39998:${TA}:header` }),
    node('property', ['ListItem', 'NostrEvent', 'Property']),
    node('schema', ['JSONSchema', 'ListItem', 'NostrEvent']),
    node('set-one', ['ListItem', 'NostrEvent', 'Set']),
    node('set-two', ['ListItem', 'NostrEvent', 'Set']),
    node('list-header', ['ListHeader', 'NostrEvent'], { uuid: `39998:${TA}:list-header` }),
    // An event-less set (add-subset's): a uuid and no id. Since event-less-nodes it has no NostrEvent; before, it had.
    { labels: migrated ? ['ListItem', 'Set', 'TapestryNode'] : ['ListItem', 'NostrEvent', 'Set'],
      props: { uuid: `39999:${TA}:event-less-set`, tapestryKey: 'k-event-less-set', name: 'event-less set' } },
  ];
}

/** As on staging since tapestry-keys: every node keyed and TapestryNode, card sets and stray nodes with no address. */
function afterGraph() {
  const nodes = addressed({ migrated: true });
  for (let i = 1; i <= 3; i++) nodes.push({ labels: ['Set', 'SetOfNostrUserWotMetricsCards', 'TapestryNode'], props: { observee_pubkey: `p${i}`, tapestryKey: `k-card-set-${i}` } });
  // A keyed node with no address under each other label: AC1's "whatever labels it has".
  for (const L of LABELS.filter((l) => l !== 'Set')) nodes.push({ labels: [L, 'TapestryNode'], props: { tapestryKey: `k-stray-${L}` } });
  for (let i = 1; i <= 20; i++) nodes.push({ labels: ['NostrUser', 'TapestryNode'], props: { pubkey: `u${i}`, tapestryKey: `k-user-${i}` } });
  nodes.push({ labels: ['NostrUserWotMetricsCard', 'TapestryNode'], props: { observee_pubkey: 'p1', tapestryKey: 'k-card-1' } });
  // An addressed node with no key: Pass 3 never rebuilt it, and still must not (it has nothing to be cached under).
  nodes.push({ labels: ['ListItem', 'NostrEvent', 'TapestryNode'], props: { uuid: `39999:${TA}:no-key`, id: 'event-no-key', name: 'no key' } });
  return nodes;
}

/** As on production today, before story 3: no TapestryNode label, and nothing without an address has a key. */
function beforeGraph() {
  const nodes = addressed({ migrated: false });
  for (let i = 1; i <= 3; i++) nodes.push({ labels: ['Set', 'SetOfNostrUserWotMetricsCards'], props: { observee_pubkey: `p${i}` } });
  for (let i = 1; i <= 20; i++) nodes.push({ labels: ['NostrUser'], props: { pubkey: `u${i}` } });
  return nodes;
}

const hasAddress = (n) => n.props.uuid != null || n.props.id != null;
const hasKey = (n) => n.props.tapestryKey != null;
const elementIdOf = (nodes, n) => `4:fake:${nodes.indexOf(n)}`;

function child(scenario) {
  const r = spawnSync(process.execPath, [CHILD], { input: JSON.stringify(scenario), encoding: 'utf8', maxBuffer: 64 << 20, timeout: 120000 });
  const at = (r.stdout || '').lastIndexOf('@@RESULT@@');
  assert(at >= 0, `the child process printed no result (exit ${r.status}): ${short(r.stderr || r.stdout, 600)}`);
  const out = JSON.parse(r.stdout.slice(at + 10).split('\n')[0]);
  assert(!out.error, `the rebuild code threw in the child process: ${short(out.error, 800)}`);
  return out;
}

/** Which nodes a pass's writes stamp with tapestryJsonUpdatedAt: a write names a node by its key, uuid or element id. */
function stampedBy(writes, nodes) {
  const stamps = writes.filter((w) => /tapestryJsonUpdatedAt/.test(w.cypher));
  const named = (n) => stamps.some((w) => Object.values(w.params).some((v) =>
    (Array.isArray(v) ? v : [v]).some((x) => x === n.props.tapestryKey || (n.props.uuid != null && x === n.props.uuid) || x === elementIdOf(nodes, n)
      || (x && typeof x === 'object' && Object.values(x).some((y) => y === n.props.tapestryKey || y === elementIdOf(nodes, n))))));
  return nodes.filter(named);
}

/* ───────────── tests ───────────── */

const tests = [];
const t = (name, fn) => tests.push([name, fn]);

t('S0 (the fake): labels(), elementId() and id() read a node as Neo4j would', () => {
  const nodes = [{ labels: ['A', 'B'], props: { k: 1 } }, { labels: ['C'], props: { k: 2 } }];
  const rows = runQuery(nodes, 'MATCH (n) WHERE n.k = 2 RETURN labels(n) AS ls, elementId(n) AS e, id(n) AS i');
  assert(JSON.stringify(rows) === JSON.stringify([{ ls: ['C'], e: '4:fake:1', i: 1 }]), `got ${short(rows)}`);
  const byId = runQuery(nodes, 'MATCH (n) WHERE elementId(n) = $e RETURN n.k AS k', { e: '4:fake:0' });
  assert(JSON.stringify(byId) === JSON.stringify([{ k: 1 }]), `elementId(n) = $e must find node 0; got ${short(byId)}`);
});

function rebuildOnlyAddressed(nodes, caseName) {
  const out = child({ kind: 'deriveAll', nodes, labels: LABELS });
  const problems = [];
  for (const pass of out.results) {
    const L = pass.label;
    const want = nodes.filter((n) => n.labels.includes(L) && hasKey(n) && hasAddress(n));
    const notWanted = nodes.filter((n) => n.labels.includes(L) && hasKey(n) && !hasAddress(n));
    const put = pass.puts.map((p) => p.key);
    if (put.some((k) => k == null || k === '')) problems.push(`${L}: cached a Tapestry JSON under no key (${put.filter((k) => k == null || k === '').length} times)`);
    const putWrong = notWanted.filter((n) => put.includes(n.props.tapestryKey)).map((n) => n.props.tapestryKey);
    const putMissing = want.filter((n) => !put.includes(n.props.tapestryKey)).map((n) => n.props.tapestryKey);
    const stamped = stampedBy(pass.writes, nodes);
    const stampWrong = notWanted.filter((n) => stamped.includes(n)).map((n) => n.props.tapestryKey);
    const stampMissing = want.filter((n) => !stamped.includes(n)).map((n) => n.props.tapestryKey);
    if (putWrong.length || stampWrong.length) problems.push(`${L}: rebuilt nodes with no address — cached ${JSON.stringify(putWrong)}, stamped ${JSON.stringify(stampWrong)}`);
    if (putMissing.length || stampMissing.length) problems.push(`${L}: left out nodes with an address — not cached ${JSON.stringify(putMissing)}, not stamped ${JSON.stringify(stampMissing)}`);
  }
  assert(problems.length === 0, `${caseName}:\n        ${problems.join('\n        ')}` +
    (out.unread.length ? `\n        (reads the fake answered with no rows: ${out.unread.length}, e.g. ${short(out.unread[0], 160)})` : ''));
}

t('S1a (AC1): after tapestry-keys, each label\'s rebuild rebuilds its nodes with an address and none of its keyed nodes with no address (card sets included)', () => {
  rebuildOnlyAddressed(afterGraph(), 'after tapestry-keys');
});

t('S1b (AC1): before tapestry-keys (no TapestryNode label anywhere), every node with an address is still rebuilt', () => {
  rebuildOnlyAddressed(beforeGraph(), 'before tapestry-keys');
});

function deriveStatus(nodes) {
  const out = child({ kind: 'deriveStatus', nodes });
  const r = out.results[0];
  assert(r.statusCode === 200 && r.body && r.body.success === true, `derive-status must answer success; got ${r.statusCode} ${short(r.body)}`);
  return Object.fromEntries(r.body.data.map((e) => [e.label, e]));
}

function expectedStatus(nodes) {
  const want = {};
  for (const L of LABELS) {
    const counted = nodes.filter((n) => n.labels.includes(L) && hasKey(n) && hasAddress(n));
    const derived = counted.filter((n) => n.props.tapestryJsonUpdatedAt != null).length;
    want[L] = { derived, underived: counted.length - derived, total: counted.length };
  }
  return want;
}

function compareStatus(got, want) {
  const bad = LABELS.filter((L) => !got[L] || got[L].total !== want[L].total || got[L].derived !== want[L].derived || got[L].underived !== want[L].underived)
    .map((L) => `${L}: want ${JSON.stringify(want[L])}, got ${JSON.stringify(got[L] && { derived: got[L].derived, underived: got[L].underived, total: got[L].total })}`);
  assert(bad.length === 0, `derive-status must count only the nodes with a key and an address:\n        ${bad.join('\n        ')}`);
}

t('S2a (AC2): derive-status counts, for each label, only its nodes with a key and an address (a card set rebuilt by today\'s code included)', () => {
  const nodes = afterGraph();
  const stamp = (key) => { nodes.find((n) => n.props.tapestryKey === key).props.tapestryJsonUpdatedAt = 1700000000; };
  ['k-item', 'k-header', 'k-set-one', 'k-card-set-1', 'k-stray-ListItem'].forEach(stamp);
  compareStatus(deriveStatus(nodes), expectedStatus(nodes));
});

t('S2b (AC2): once every node with an address has been rebuilt, each label reads derived = total (Set reads 3 of 3 here, not of 6)', () => {
  const nodes = afterGraph();
  for (const n of nodes) if (hasAddress(n)) n.props.tapestryJsonUpdatedAt = 1700000000;
  nodes.find((n) => n.props.tapestryKey === 'k-card-set-1').props.tapestryJsonUpdatedAt = 1700000000;
  const got = deriveStatus(nodes);
  compareStatus(got, expectedStatus(nodes));
  const unequal = LABELS.filter((L) => got[L].derived !== got[L].total);
  assert(unequal.length === 0, `every label must read derived = total; ${unequal.join(', ')} don't`);
});

t('S5 (AC5): a rebuild by key of a node with no address does what it does today — it is rebuilt — and so is a node with an address', () => {
  const nodes = afterGraph();
  const out = child({ kind: 'deriveByKey', nodes, keys: ['k-card-set-1', 'k-set-one'] });
  for (const r of out.results) {
    assert(r.answer && r.answer.tapestryKey === r.key, `rebuild by key ${r.key} must answer with its rebuild; got ${short(r.answer)}` +
      (out.unread.length ? ` (reads the fake answered with no rows: ${short(out.unread.slice(0, 2), 300)})` : ''));
    assert(r.puts.some((p) => p.key === r.key), `rebuild by key ${r.key} must cache a Tapestry JSON for it; cached ${short(r.puts)}`);
  }
});

t('S6 (AC1, AC5): before tapestry-keys (no TapestryNode label anywhere), a rebuild by key still finds, rebuilds and stamps each node with an address, an event-less set included; a key no node holds rebuilds nothing', () => {
  const nodes = beforeGraph();
  const addressedKeys = nodes.filter((n) => hasKey(n) && hasAddress(n)).map((n) => n.props.tapestryKey);
  const out = child({ kind: 'deriveByKey', nodes, keys: [...addressedKeys, 'k-no-such-key'] });
  const problems = [];
  for (const r of out.results) {
    if (r.key === 'k-no-such-key') {
      if (r.answer !== null || r.puts.length || r.writes.length) problems.push(`a key no node holds must rebuild nothing; got ${short({ answer: r.answer, puts: r.puts, writes: r.writes.length })}`);
      continue;
    }
    const node = nodes.find((n) => n.props.tapestryKey === r.key);
    if (!r.answer || r.answer.tapestryKey !== r.key) problems.push(`${r.key}: no rebuild (answer ${short(r.answer)})`);
    else if (!r.puts.some((p) => p.key === r.key)) problems.push(`${r.key}: nothing cached`);
    else if (!stampedBy(r.writes, nodes).includes(node)) problems.push(`${r.key}: not stamped`);
  }
  assert(problems.length === 0, `before tapestry-keys, a rebuild by key must still work:\n        ${problems.join('\n        ')}` +
    (out.unread.length ? `\n        (reads the fake answered with no rows: ${out.unread.length}, e.g. ${short(out.unread[0], 160)})` : ''));
});

t('S7 (AC2): before tapestry-keys (no TapestryNode label anywhere), derive-status still counts each label\'s nodes with a key and an address', () => {
  const nodes = beforeGraph();
  for (const k of ['k-item', 'k-set-one']) nodes.find((n) => n.props.tapestryKey === k).props.tapestryJsonUpdatedAt = 1700000000;
  compareStatus(deriveStatus(nodes), expectedStatus(nodes));
});

/* ───────────── live ───────────── */

let liveNote = null;
function liveOrSkip() {
  const refusal = live.scratchRefusal();
  if (refusal) {
    if (!liveNote) { liveNote = refusal; console.log(`  NOTE  live checks skipped: ${refusal}. To run them: TAPESTRY_CONTAINER=$(bash scripts/scratch-stack.sh up)`); }
    return false;
  }
  return true;
}
let shapeMemo = null;
const shape = () => (shapeMemo = shapeMemo || live.graphShape());
const isStagingShape = () => shape().all >= STAGING_SHAPE.all && shape().cardSets >= STAGING_SHAPE.cardSets;
const isSmall = () => shape().all < SMALL_GRAPH;
const nowSec = () => Math.floor(Date.now() / 1000);
const runTag = `pass3-${process.pid}-${Date.now()}`;
// L5b compares the state one install and then a rebuild of the seven labels leave, as its baseline was taken. An install
// rebuilds before it wires the implicit elements, so only a derive-all after the last install sets this; L4 clears it.
let rebuiltSinceInstall = false;
let installFinished = false;

function deriveAllLabels() {
  const answers = {};
  for (const L of LABELS) {
    const r = live.http('POST', `/api/tapestry-key/derive-all/${L}`, {}, 1800);
    assert(r.status === 200 && r.json && r.json.success, `derive-all ${L} must answer success; got HTTP ${r.status} ${short(r.text)}`);
    answers[L] = r.json.data;
  }
  rebuiltSinceInstall = true;
  return answers;
}

/** Keyed nodes with no address: card sets, and one stray node under each other label. Removed by removeFixtures(). */
function addUnaddressedFixtures(cardSets) {
  live.cypher(`UNWIND range(1, $n) AS i
               CREATE (u:NostrUser:TapestryNode {pubkey: $tag + '-u' + i, tapestryKey: randomUUID(), pass3Fixture: $tag})
               CREATE (u)-[:WOT_METRICS_CARDS]->(:Set:SetOfNostrUserWotMetricsCards:TapestryNode {observee_pubkey: $tag + '-u' + i, tapestryKey: randomUUID(), pass3Fixture: $tag})`,
  { n: cardSets, tag: runTag });
  // The labels come from LABELS, not from input, so writing them into the statement is safe.
  live.cypher(`CREATE ${LABELS.filter((l) => l !== 'Set').map((L) => `(:TapestryNode:${L} {tapestryKey: randomUUID(), pass3Fixture: $tag})`).join(', ')}`, { tag: runTag });
  return live.cypher(`MATCH (n:TapestryNode {pass3Fixture: $tag}) WHERE NOT n:NostrUser RETURN n.tapestryKey AS k, labels(n) AS labels`, { tag: runTag });
}
function removeFixtures() {
  try { live.cypher('MATCH (n {pass3Fixture: $tag}) DETACH DELETE n', { tag: runTag }); } catch (e) { console.log(`  NOTE  fixture clean-up failed: ${e.message}`); }
}

t('L1 (AC1, live, small graph): Pass 3\'s rebuild passes by keyed card sets and keyed nodes with no address, and rebuilds every node with an address, an event-less set included', () => {
  if (!liveOrSkip()) return 'SKIP';
  if (!isSmall()) { console.log(`  NOTE  L1 runs on a small graph (under ${SMALL_GRAPH} nodes); this one has ${shape().all}.`); return 'SKIP'; }
  const ta = live.taPubkey();
  try {
    const unaddressed = addUnaddressedFixtures(30);
    const eventLess = `39999:${ta}:${runTag}-event-less-set`;
    live.cypher(`CREATE (:TapestryNode:ListItem:Set {uuid: $u, name: $u, tapestryKey: randomUUID(), pass3Fixture: $tag})`, { u: eventLess, tag: runTag });
    const t0 = nowSec() - 1;
    deriveAllLabels();
    const rebuiltWrongly = unaddressed.filter(({ k }) => {
      const cached = live.http('GET', `/api/tapestry-key/${encodeURIComponent(k)}`).status === 200;
      const stamped = live.cypher('MATCH (n:TapestryNode {tapestryKey: $k}) RETURN n.tapestryJsonUpdatedAt AS ts', { k })[0].ts != null;
      return cached || stamped;
    });
    assert(rebuiltWrongly.length === 0, `${rebuiltWrongly.length} of ${unaddressed.length} keyed nodes with no address were rebuilt, e.g. ${short(rebuiltWrongly.slice(0, 3))}`);
    const stale = live.cypher(`MATCH (n) WHERE (${LABELS.map((l) => `n:${l}`).join(' OR ')}) AND n.tapestryKey IS NOT NULL
                                 AND (n.uuid IS NOT NULL OR n.id IS NOT NULL) AND coalesce(n.tapestryJsonUpdatedAt, 0) < $t0
                               RETURN n.uuid AS u, labels(n) AS labels LIMIT 5`, { t0 });
    assert(stale.length === 0, `every node with an address must be rebuilt by the pass; not rebuilt: ${short(stale)}`);
  } finally { removeFixtures(); }
});

t('L2 (AC2, live): derive-status\'s totals count only the nodes with a key and an address', () => {
  if (!liveOrSkip()) return 'SKIP';
  try {
    addUnaddressedFixtures(5);
    const r = live.http('GET', '/api/tapestry-key/derive-status', undefined, 300);
    assert(r.status === 200 && r.json && r.json.success, `derive-status must answer success; got HTTP ${r.status}`);
    const got = Object.fromEntries(r.json.data.map((e) => [e.label, e]));
    const bad = [];
    for (const L of LABELS) {
      const want = live.cypher(`MATCH (n:${L}) WHERE n.tapestryKey IS NOT NULL AND (n.uuid IS NOT NULL OR n.id IS NOT NULL) RETURN count(n) AS c`)[0].c;
      if (!got[L] || got[L].total !== Number(want)) bad.push(`${L}: want total ${want}, got ${got[L] && got[L].total}`);
    }
    assert(bad.length === 0, `derive-status must count only the nodes with an address:\n        ${bad.join('\n        ')}`);
  } finally { removeFixtures(); }
});

t('L5c (AC5, live): a rebuild by key of a keyed card set does what it does today — it answers with its rebuild', () => {
  if (!liveOrSkip()) return 'SKIP';
  try {
    const [cardSet] = addUnaddressedFixtures(1).filter((f) => f.labels.includes('SetOfNostrUserWotMetricsCards'));
    const r = live.http('POST', `/api/tapestry-key/derive/${encodeURIComponent(cardSet.k)}`, {}, 300);
    assert(r.status === 200 && r.json && r.json.success && r.json.data && r.json.data.tapestryKey === cardSet.k,
      `POST /api/tapestry-key/derive/<card set's key> must answer with its rebuild, as today; got HTTP ${r.status} ${short(r.text)}`);
  } finally { removeFixtures(); }
});

// Today's queries, as src/lib/derivers/{word,set}.js send them before this story, one node per row ($uuids).
const ORACLE = {
  elementOfDirect: 'UNWIND $uuids AS uuid MATCH (parent)-[:HAS_ELEMENT]->(n { uuid: uuid }) RETURN uuid, collect(parent.tapestryKey) AS keys',
  elementOfIndirect: 'UNWIND $uuids AS uuid MATCH (parent)-[:HAS_ELEMENT]->(n { uuid: uuid }) MATCH (ancestor)-[:IS_A_SUPERSET_OF*1..10]->(parent) WHERE NOT (ancestor)-[:HAS_ELEMENT]->(n { uuid: uuid }) RETURN uuid, collect(DISTINCT ancestor.tapestryKey) AS keys',
  elementsDirect: 'UNWIND $uuids AS uuid MATCH (s { uuid: uuid })-[:HAS_ELEMENT]->(e) RETURN uuid, collect(e.tapestryKey) AS keys',
  elementsIndirect: 'UNWIND $uuids AS uuid MATCH (s { uuid: uuid })-[:IS_A_SUPERSET_OF*1..10]->(child)-[:HAS_ELEMENT]->(e) WHERE NOT (s)-[:HAS_ELEMENT]->(e) RETURN uuid, collect(DISTINCT e.tapestryKey) AS keys',
  childSetsDirect: 'UNWIND $uuids AS uuid MATCH (s { uuid: uuid })-[:IS_A_SUPERSET_OF]->(child) RETURN uuid, collect(child.tapestryKey) AS keys',
  childSetsIndirect: 'UNWIND $uuids AS uuid MATCH (s { uuid: uuid })-[:IS_A_SUPERSET_OF*2..10]->(child) WHERE NOT (s)-[:IS_A_SUPERSET_OF]->(child) RETURN uuid, collect(DISTINCT child.tapestryKey) AS keys',
  parentSetsDirect: 'UNWIND $uuids AS uuid MATCH (parent)-[:IS_A_SUPERSET_OF]->(s { uuid: uuid }) RETURN uuid, collect(parent.tapestryKey) AS keys',
  parentSetsIndirect: 'UNWIND $uuids AS uuid MATCH (parent)-[:IS_A_SUPERSET_OF*2..10]->(s { uuid: uuid }) WHERE NOT (parent)-[:IS_A_SUPERSET_OF]->(s { uuid: uuid }) RETURN uuid, collect(DISTINCT parent.tapestryKey) AS keys',
};
const ORACLE_SCHEMAS = `MATCH (n { uuid: $uuid })
  OPTIONAL MATCH (n)<-[:HAS_ELEMENT]-(parentSet)<-[:IS_A_SUPERSET_OF*0..10]-(sup:Superset)<-[:IS_THE_CONCEPT_FOR]-(h1:ConceptHeader)
  OPTIONAL MATCH (n)-[:HAS_TAG]->(zt:NostrEventTag {type: 'z'})
  OPTIONAL MATCH (h2:ConceptHeader {uuid: zt.value})
  WITH collect(DISTINCT h1) + collect(DISTINCT h2) AS headers
  UNWIND headers AS ch
  WITH DISTINCT ch
  WHERE ch IS NOT NULL
  MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(ch)
  RETURN DISTINCT js.uuid AS uuid, js.tapestryKey AS tapestryKey, ch.name AS conceptName, ch.tapestryKey AS conceptTapestryKey`;
// The deriver a node gets (src/lib/tapestry-derive.js labelPriority, today): the set deriver for Set and Superset.
const PRIORITY = { ListItem: 1, ListHeader: 2, Set: 3, Superset: 4, ConceptHeader: 5, JSONSchema: 5, Property: 5 };
const derivedBy = (labels) => labels.filter((l) => l in PRIORITY).reduce((best, l) => (best && PRIORITY[best] >= PRIORITY[l] ? best : l), null);

t('L5a (AC5, live, small graph): each node Pass 3 rebuilds holds what today\'s queries find for it — elements, child and parent sets, elementOf and schemas', () => {
  if (!liveOrSkip()) return 'SKIP';
  if (!isSmall()) { console.log(`  NOTE  L5a runs on a small graph (under ${SMALL_GRAPH} nodes), where today's queries are quick; this one has ${shape().all}.`); return 'SKIP'; }
  deriveAllLabels();
  const nodes = live.cypher(`MATCH (n) WHERE (${LABELS.map((l) => `n:${l}`).join(' OR ')}) AND n.tapestryKey IS NOT NULL AND n.uuid IS NOT NULL
                             RETURN n.uuid AS uuid, n.tapestryKey AS key, labels(n) AS labels ORDER BY uuid`);
  const uuids = nodes.map((n) => n.uuid);
  const oracle = {};
  for (const [part, q] of Object.entries(ORACLE)) oracle[part] = new Map(live.cypher(q, { uuids }).map((r) => [r.uuid, r.keys]));
  const problems = [];
  for (const n of nodes) {
    const r = live.http('GET', `/api/tapestry-key/${encodeURIComponent(n.key)}`);
    if (r.status !== 200) { problems.push(`${n.uuid}: not cached after the rebuild`); continue; }
    const env = r.json.data;
    const gc = (env.data && env.data.graphContext) || {};
    const by = derivedBy(n.labels);
    const keysOf = (refs) => (refs || []).map((x) => x.tapestryKey);
    const want = (part) => oracle[part].get(n.uuid) || [];
    const check = (what, got, expected) => { if (!sameSet(got, expected)) problems.push(`${n.uuid} ${what}: want ${short(sorted(expected), 160)}, got ${short(sorted(got), 160)}`); };
    if (env.rebuiltFrom !== `derive:${by}`) problems.push(`${n.uuid}: rebuilt by ${env.rebuiltFrom}, want derive:${by}`);
    if (!gc.identifiers || gc.identifiers.tapestryKey !== n.key || gc.identifiers.uuid !== n.uuid) problems.push(`${n.uuid}: identifiers ${short(gc.identifiers)}`);
    check('elementOf.direct', keysOf(gc.elementOf && gc.elementOf.direct), want('elementOfDirect'));
    check('elementOf.indirect', keysOf(gc.elementOf && gc.elementOf.indirect), want('elementOfIndirect'));
    if (by === 'Set' || by === 'Superset') {
      check('elements.direct', keysOf(gc.elements && gc.elements.direct), want('elementsDirect'));
      check('elements.indirect', keysOf(gc.elements && gc.elements.indirect), want('elementsIndirect'));
      check('childSets.direct', keysOf(gc.childSets && gc.childSets.direct), want('childSetsDirect'));
      check('childSets.indirect', keysOf(gc.childSets && gc.childSets.indirect), want('childSetsIndirect'));
      check('parentSets.direct', keysOf(gc.parentSets && gc.parentSets.direct), want('parentSetsDirect'));
      check('parentSets.indirect', keysOf(gc.parentSets && gc.parentSets.indirect), want('parentSetsIndirect'));
    }
    const schemas = live.cypher(ORACLE_SCHEMAS, { uuid: n.uuid }).map((s) => JSON.stringify([s.uuid, s.tapestryKey, s.conceptName, s.conceptTapestryKey]));
    check('parentJsonSchemas', (gc.parentJsonSchemas || []).map((s) => JSON.stringify([s.uuid, s.tapestryKey, s.conceptName, s.conceptTapestryKey])), schemas);
    if (problems.length > 12) break;
  }
  assert(problems.length === 0, `${problems.length} difference(s) from today's queries over ${nodes.length} nodes:\n        ${problems.slice(0, 12).join('\n        ')}`);
});

function median3(fn) { const xs = [fn(), fn(), fn()].sort((a, b) => a - b); return xs[1]; }

t(`L3 (AC3, live, staging's shape): rebuilding one concept node of each label takes at most ${REBUILD_MS} ms, by key and inside derive-all`, () => {
  if (!liveOrSkip()) return 'SKIP';
  if (!isStagingShape()) { console.log(`  NOTE  L3 needs staging's shape (${STAGING_SHAPE.all} nodes, ${STAGING_SHAPE.cardSets} card sets); this graph has ${shape().all} and ${shape().cardSets}. Seed it: TAPESTRY_CONTAINER=tapestry-scratch node test/helpers/seedStagingShape.js`); return 'SKIP'; }
  const ta = live.taPubkey();
  const times = {};
  for (const L of LABELS) {
    const only = { ListItem: 'AND NOT n:Set AND NOT n:Superset AND NOT n:Property AND NOT n:JSONSchema', ListHeader: 'AND NOT n:ConceptHeader' }[L] || '';
    const row = live.cypher(`MATCH (n:${L}) WHERE n.uuid IS NOT NULL AND n.tapestryKey IS NOT NULL ${only}
                             RETURN n.tapestryKey AS k ORDER BY n.uuid CONTAINS $ta DESC, n.uuid LIMIT 1`, { ta })[0];
    assert(row, `no ${L} with an address to rebuild — was firmware installed?`);
    times[L] = Math.round(1000 * median3(() => {
      const r = live.http('POST', `/api/tapestry-key/derive/${encodeURIComponent(row.k)}`, {}, 300);
      assert(r.status === 200, `rebuild by key of a ${L} must answer 200; got ${r.status} ${short(r.text)}`);
      return r.seconds;
    }));
  }
  const r = live.http('POST', '/api/tapestry-key/derive-all/ConceptHeader', {}, 1800);
  assert(r.status === 200 && r.json && r.json.success, `derive-all ConceptHeader must answer success; got HTTP ${r.status}`);
  const perNode = Math.round((1000 * r.seconds) / Math.max(1, r.json.data.derived));
  console.log(`        rebuild by key, median of 3 (ms): ${JSON.stringify(times)}; inside derive-all ConceptHeader: ${perNode} ms each (${r.json.data.derived} in ${r.seconds.toFixed(1)} s)`);
  const slow = Object.entries(times).filter(([, ms]) => ms > REBUILD_MS);
  assert(slow.length === 0 && perNode <= REBUILD_MS,
    `one rebuild must take at most ${REBUILD_MS} ms at staging's size; by key: ${JSON.stringify(Object.fromEntries(slow))}${perNode > REBUILD_MS ? `; inside derive-all: ${perNode} ms` : ''}`);
});

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

t(`L4 (AC4, live, staging's shape, PASS3_INSTALL=1): a firmware install's Pass 3 finishes in under ${PASS3_MINUTES} minutes, and the install completes`, async () => {
  if (!liveOrSkip()) return 'SKIP';
  if (process.env.PASS3_INSTALL !== '1') { console.log('  NOTE  L4 runs a firmware install on the scratch container: set PASS3_INSTALL=1 to run it.'); return 'SKIP'; }
  if (!isStagingShape()) { console.log(`  NOTE  L4 needs staging's shape; this graph has ${shape().all} nodes and ${shape().cardSets} card sets. Seed it first: TAPESTRY_CONTAINER=tapestry-scratch node test/helpers/seedStagingShape.js`); return 'SKIP'; }
  const LOG = '/var/log/supervisor/brainstorm.log';
  const start = Number(live.sh(`wc -l < ${LOG}`).trim()) + 1;
  const MARKERS = [['pass3', /── Pass 3:/], ['ListItem', /Derived ListItem/], ['ListHeader', /Derived ListHeader/], ['ConceptHeader', /Derived ConceptHeader/],
    ['JSONSchema', /Derived JSONSchema/], ['Property', /Derived Property/], ['Set', /Derived Set/], ['Superset', /Derived Superset/],
    ['enumerations', /Enumerations applied/], ['implicit', /Implicit elements wired/], ['complete', /FIRMWARE INSTALL COMPLETE/]];
  const seen = {};
  const t0 = Date.now();
  const install = spawn('docker', ['exec', live.container(), 'curl', '-s', '-m', '3600', '-X', 'POST', `${live.BASE}/api/firmware/install`]);
  let body = '';
  let exited = false;
  install.stdout.on('data', (d) => { body += d; });
  install.on('exit', () => { exited = true; });
  const limit = (PASS3_MINUTES + 20) * 60000;   // Pass 1 and Pass 2 come first; the limit on Pass 3 is checked below
  const poll = () => {
    const lines = live.sh(`tail -n +${start} ${LOG} | grep -E 'Pass 3:|Derived |Enumerations applied|Implicit elements wired|FIRMWARE INSTALL COMPLETE' || true`);
    for (const [k, re] of MARKERS) if (!seen[k] && re.test(lines)) seen[k] = Date.now();
  };
  while (!seen.complete && Date.now() - t0 < limit) {
    await sleep(2000);
    const wasExited = exited;
    poll();
    if (seen.pass3 && !seen.complete && Date.now() - seen.pass3 > PASS3_MINUTES * 60000 + 60000) break;
    if (wasExited && !seen.complete) { await sleep(2000); poll(); break; }
  }
  const secs = (a, b) => (seen[a] && seen[b] ? Math.round((seen[b] - seen[a]) / 1000) : null);
  const steps = {};
  let prev = 'pass3';
  for (const [k] of MARKERS.slice(1)) { if (seen[k]) { steps[k] = secs(prev, k); prev = k; } }
  console.log(`        before Pass 3 (Pass 1, Pass 2, community headers): ${Math.round(((seen.pass3 || Date.now()) - t0) / 1000)} s; Pass 3 steps (s): ${JSON.stringify(steps)}; Pass 3 in all: ${secs('pass3', 'complete')} s`);
  if (!seen.complete) {
    // Stop the install: it would keep the scratch control panel busy for days on today's code.
    live.sh('supervisorctl restart brainstorm >/dev/null 2>&1 || true', 120);
    for (let i = 0; i < 60 && live.scratchRefusal(); i++) await sleep(2000);
    throw new Error(`Pass 3 did not finish within ${PASS3_MINUTES} minutes (reached: ${Object.keys(seen).join(', ') || 'nothing'}); the scratch control panel was restarted to stop the install`);
  }
  while (!exited) await sleep(500);
  const pass3Minutes = (seen.complete - seen.pass3) / 60000;
  let answer = null;
  try { answer = JSON.parse(body); } catch { /* not JSON */ }
  assert(answer && answer.success === true, `the install must answer success; got ${short(body)}`);
  assert(pass3Minutes < PASS3_MINUTES, `Pass 3 must finish in under ${PASS3_MINUTES} minutes; it took ${pass3Minutes.toFixed(1)}`);
  installFinished = true;
  rebuiltSinceInstall = false;
});

t('L2b (AC2, live, after L4): after a full Pass 3, every label reads derived = total', () => {
  if (!liveOrSkip()) return 'SKIP';
  if (!installFinished) { console.log('  NOTE  L2b reads derive-status after L4\'s install, which did not run to the end in this run.'); return 'SKIP'; }
  const r = live.http('GET', '/api/tapestry-key/derive-status', undefined, 300);
  const unequal = r.json.data.filter((e) => e.derived !== e.total);
  assert(unequal.length === 0, `every label must read derived = total after a full Pass 3; got ${short(unequal)}`);
});

t('L5b (AC5, live, one install then a rebuild in this run): Pass 3\'s output — the rebuilt Tapestry JSON, the enumerated schemas and the implicit elements — matches today\'s', () => {
  if (!liveOrSkip()) return 'SKIP';
  // The baseline is of a container that has run one install. A second install comes out differently by itself, mostly
  // because Pass 2's save-schema finds a concept's header by name and another author's header with that name can take its
  // place (ledger row 2026-11-15-save-schema-finds-header-by-name). None of it goes through code story 8 changed
  // (test plan, amendments 1 and 2).
  const installs = Number(live.sh('grep -c "FIRMWARE INSTALL COMPLETE" /var/log/supervisor/brainstorm.log || true').trim());
  if (installs !== 1) { console.log(`  NOTE  L5b compares a container that has run one firmware install; this one's log shows ${installs}. Boot a fresh scratch stack to run it.`); return 'SKIP'; }
  if (!rebuiltSinceInstall) { console.log('  NOTE  L5b compares the graph after a rebuild of the seven labels that follows the install; neither L1 nor L5a ran one in this run.'); return 'SKIP'; }
  const { snapshot, firmwareDigest } = require('./helpers/pass3Snapshot');
  const baseline = JSON.parse(fs.readFileSync(SNAPSHOT_FIXTURE, 'utf8'));
  const digest = firmwareDigest();
  if (digest !== baseline.firmwareDigest) { console.log(`  NOTE  L5b's baseline was taken with other firmware (${baseline.firmwareDigest.slice(0, 12)}…, this container has ${digest.slice(0, 12)}…); re-baseline it with test/helpers/pass3Snapshot.js on today's code.`); return 'SKIP'; }
  const now = snapshot();
  const diff = [];
  for (const part of ['nodes', 'schemas', 'implicit']) {
    const keys = new Set([...Object.keys(baseline[part]), ...Object.keys(now[part])]);
    for (const k of keys) if (JSON.stringify(baseline[part][k]) !== JSON.stringify(now[part][k])) diff.push(`${part} ${k}: ${baseline[part][k] === undefined ? 'new' : now[part][k] === undefined ? 'gone' : 'differs'}`);
  }
  assert(diff.length === 0, `${diff.length} difference(s) from today's Pass 3 output:\n        ${diff.slice(0, 12).join('\n        ')}`);
});

/* ───────────── run ───────────── */

async function run() {
  console.log('\n=== a firmware install\'s Pass 3 finishes in minutes (graph-operations-foundation #8) ===');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; } else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\npass-3-finishes-in-minutes: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
