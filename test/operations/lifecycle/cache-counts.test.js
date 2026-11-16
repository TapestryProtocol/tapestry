'use strict';
/**
 * The cache counts cover only the nodes they count — its own suite, run by test/operations.test.js, which finds every
 * suite under test/operations/.
 *   Story: engineering-team/stories/graph-operations-foundation/7-cache-counts-cover-only-the-nodes-they-count.md
 *   Plan:  engineering-team/stories/graph-operations-foundation/7-cache-counts-cover-only-the-nodes-they-count.test-plan.md
 *   (A bug from story 3; no ADR — the Standard bug path.)
 *
 * Stack-free. Each graph runs in a child process with src/lib/neo4j-driver.js replaced by test/helpers/nodeCypherFake.js,
 * which runs the Cypher it is sent over the graph's nodes as Neo4j would, and src/lib/tapestry-store.js replaced by a
 * cache that records every key looked up. Nothing pins the text of the queries: the tests say what the reads must find.
 *
 *   C0  the fake reads Cypher as Neo4j does (OR looser than AND, null keeps no row, WITH and CASE group), and refuses
 *       what it can't read
 *   C1  AC1  after tapestry-keys, status's cache part adds up and no figure is larger than its nodes
 *   C2  AC2  on the same graph, GET /api/tapestry-key/status counts only the addressed nodes and its lmdb figures add up
 *   C3  AC3  both answers look up exactly the counted keys, once each, and no read returns an unaddressed node's key
 *   C4  AC4  an addressed node whose key is '{}' or missing is counted without a key and never looked up
 *   C5  AC1, AC4  before tapestry-keys (no TapestryNode label, NostrUser nodes unkeyed), the counts are the same
 *   C6  AC4  the migrations part still counts every node in the graph, while the cache part counts the addressed ones
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const NL = String.fromCharCode(10);
const STATUS_FILE = path.join(ROOT, 'src/operations/catalog/lifecycle/status.js');
const TK_FILE = path.join(ROOT, 'src/api/tapestry-key/index.js');
const FAKE = path.join(ROOT, 'test/helpers/nodeCypherFake.js');
const LIFECYCLE_FAKES = path.join(ROOT, 'test/helpers/lifecycleFakes.js');

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (x) => JSON.stringify(x);
const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.keys(v).sort().reduce((o, key) => { o[key] = v[key]; return o; }, {}) : v));
const same = (a, b) => canon(a) === canon(b);

// ── The graphs ──
// The addressed nodes: a uuid, an id, or both. Their cache entries: two with data, one empty, one missing.
const UNADDRESSED = 3000; // stands for staging's 3.85 million keyed NostrUser, tag and card nodes
const ADDRESSED_KEYS = ['k-a1', 'k-a2', 'k-a3', 'k-a4'];
const LMDB = { 'k-a1': { updatedAt: 1, data: { name: 'one' } }, 'k-a2': { updatedAt: 1, data: { items: [1] } }, 'k-a3': { updatedAt: 1, data: {} } };
const node = (labels, props) => ({ labels, props });

/**
 * after: as on staging once tapestry-keys has run — every node keyed and labelled, only four of them addressed.
 * gaps:  after, plus an addressed node whose key is '{}', one with no key, and two unaddressed nodes the same.
 * before: as before story 3 — no TapestryNode label anywhere, and the nodes with no address have no key.
 */
function graph(kind) {
  const labelled = kind !== 'before';
  const L = (...ls) => (labelled ? [...ls, 'TapestryNode'] : ls);
  const nodes = [
    node(L('NostrEvent', 'ListItem'), { uuid: '39998:aa:one', id: 'e1', tapestryKey: 'k-a1' }),
    node(L('NostrEvent', 'ListItem'), { uuid: '39999:aa:two', id: 'e2', tapestryKey: 'k-a2' }),
    node(L('ListItem', 'Set'), { uuid: 'set-three', tapestryKey: 'k-a3' }), // an event-less set: a uuid, no id
    node(L('NostrEvent'), { id: 'e4', tapestryKey: 'k-a4' }), // an id and no uuid
  ];
  if (kind !== 'after') {
    nodes.push(node(L('NostrEvent', 'ListItem'), { uuid: '39999:aa:five', id: 'e5', tapestryKey: '{}' }));
    nodes.push(node(['NostrEvent'], { id: 'e6' }));
  }
  for (let i = 0; i < UNADDRESSED; i++) {
    const label = i % 10 === 0 ? 'NostrEventTag' : i % 10 === 1 ? 'NostrUserWotMetricsCard' : 'NostrUser';
    const props = label === 'NostrUser' ? { pubkey: `p${i}` } : { type: 'z', value: `v${i}` };
    nodes.push(node(L(label), kind === 'before' ? props : { ...props, tapestryKey: `k-u${String(i).padStart(5, '0')}` }));
  }
  if (kind === 'gaps') {
    nodes.push(node(['NostrUser', 'TapestryNode'], { pubkey: 'px', tapestryKey: '{}' }));
    nodes.push(node(['NostrUser'], { pubkey: 'py' }));
  }
  return nodes;
}
const addressed = (n) => (n.props.uuid !== undefined && n.props.uuid !== null) || (n.props.id !== undefined && n.props.id !== null);
const realKey = (k) => typeof k === 'string' && k !== '{}';

// ── The child ──
function child(script, dir) {
  const file = path.join(dir, 'child.js');
  fs.writeFileSync(file, script);
  const conf = path.join(dir, 'brainstorm.conf');
  fs.writeFileSync(conf, `export NEO4J_URI="bolt://127.0.0.1:9"${NL}`);
  const env = { ...process.env, BRAINSTORM_CONF_PATH: conf, TAPESTRY_SETTINGS_PATH: path.join(dir, 'settings.json'), BRAINSTORM_BASE_DIR: dir,
    TAPESTRY_LMDB_PATH: path.join(dir, 'lmdb'), HOME: dir, TA_PUBKEY: 'dd'.repeat(32), BRAINSTORM_BASE_URL: 'http://127.0.0.1:9',
    TAPESTRY_BACKUPS_DIR: path.join(dir, 'backups') };
  const r = spawnSync(process.execPath, [file], { cwd: ROOT, env, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  const line = (r.stdout || '').split(NL).find((l) => l.startsWith('RESULT:'));
  assert(line, `the child printed no result (exit ${r.status}): ${(r.stderr || '').slice(-800)}`);
  const out = JSON.parse(line.slice(7));
  assert(!out.error, `the child failed: ${out.error}`);
  return out;
}
const stub = (file, exportsSrc) => [
  `{ const p = require.resolve(${show(file)});`,
  `  require.cache[p] = { id: p, filename: p, loaded: true, children: [], paths: [], exports: ${exportsSrc} }; }`,
].join(NL);

/**
 * Lines for a child: the graph and the cache read from files, neo4j-driver and tapestry-store replaced, and `log`
 * recording every query, every row returned and every key looked up. `summary()` reports what a caller did: its
 * queries, the keys it looked up, and how many returned values were keys of nodes with no address.
 */
const setup = (graphFile, lmdbFile) => [
  `'use strict';`,
  `for (const k of ['log', 'info', 'debug', 'warn']) console[k] = () => {};`,
  `const fs = require('fs');`,
  `const nodes = JSON.parse(fs.readFileSync(${show(graphFile)}, 'utf8'));`,
  `const entries = JSON.parse(fs.readFileSync(${show(lmdbFile)}, 'utf8'));`,
  `const log = { queries: [], rows: [], lookups: [] };`,
  `const lookup = (k) => { log.lookups.push(k); return Object.prototype.hasOwnProperty.call(entries, k) ? entries[k] : null; };`,
  `const db = { get: lookup, getMany: (ks) => ks.map(lookup), doesExist: (k) => lookup(k) !== null };`,
  stub(path.join(ROOT, 'src/lib/neo4j-driver.js'), `require(${show(FAKE)}).driverStub(nodes, log)`),
  stub(path.join(ROOT, 'src/lib/tapestry-store.js'), `{
    get: lookup, getDb: () => db,
    put: async () => { throw new Error('a read must write nothing to the cache (put)'); },
    remove: async () => { throw new Error('a read must write nothing to the cache (remove)'); },
    stats: () => ({ count: Object.keys(entries).length, path: 'stub' }), listKeys: () => Object.keys(entries).slice(0, 100), close: () => {},
  }`),
  `const unaddressedKeys = new Set(nodes.filter((n) => (n.props.uuid === undefined || n.props.uuid === null) && (n.props.id === undefined || n.props.id === null))`,
  `  .map((n) => n.props.tapestryKey).filter((k) => typeof k === 'string' && k !== '{}'));`,
  `const leaks = (x) => (typeof x === 'string' ? (unaddressedKeys.has(x) ? 1 : 0) : Array.isArray(x) ? x.reduce((n, y) => n + leaks(y), 0)`,
  `  : x && typeof x === 'object' ? Object.values(x).reduce((n, y) => n + leaks(y), 0) : 0);`,
  `const summary = () => { const s = { queries: log.queries.length, lookups: log.lookups.slice(), leaked: leaks(log.rows), rows: log.rows.length };`,
  `  log.queries = []; log.rows = []; log.lookups = []; return s; };`,
].join(NL);
const body = (lines) => [`(async () => {`, `  try {`, ...lines, `  } catch (e) { process.stdout.write('RESULT:' + JSON.stringify({ error: e.stack || e.message }) + '\\n'); }`, `})();`].join(NL);

/** Both callers over one graph: status's cache part, then GET /api/tapestry-key/status, each with what it did. */
const runs = {};
function bothCallers(kind) {
  if (runs[kind]) return runs[kind];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-cache-counts-'));
  try {
    const graphFile = path.join(dir, 'graph.json');
    const lmdbFile = path.join(dir, 'lmdb.json');
    fs.writeFileSync(graphFile, JSON.stringify(graph(kind)));
    fs.writeFileSync(lmdbFile, JSON.stringify(LMDB));
    runs[kind] = child([setup(graphFile, lmdbFile), body([
      `const r = {};`,
      `const s = require(${show(STATUS_FILE)});`,
      `r.cache = await s.parts.cache(); r.cacheDid = summary();`,
      `const tk = require(${show(TK_FILE)});`,
      `r.route = await new Promise((resolve) => { tk.handleStatus({}, { status(c) { this.code = c; return this; }, json: resolve }); }); r.routeDid = summary();`,
      `process.stdout.write('RESULT:' + JSON.stringify(r) + '\\n');`,
    ])].join(NL), dir);
    return runs[kind];
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// What every graph here must answer: four addressed nodes keyed (two cached, one empty, one not cached).
const COUNTS = (without) => ({ initialized: 4, uninitialized: without, total: 4 + without, lmdb: { derived: 2, empty: 1, missing: 1 } });
const CACHE = (without) => ({ known: true, nodes: 4 + without, withTapestryKey: 4, withoutTapestryKey: without, cached: 2, cachedEmpty: 1, notCached: 1 });
const addsUp = (c) => c.cached + c.cachedEmpty + c.notCached === c.withTapestryKey
  && [c.withTapestryKey, c.withoutTapestryKey, c.cached, c.cachedEmpty, c.notCached].every((x) => x <= c.nodes);

test('C0: the fake graph database reads Cypher as Neo4j does — OR binds looser than AND, a comparison with null keeps no row, WITH and CASE group as count does — and refuses what it cannot read', () => {
  const { runQuery } = require(FAKE);
  const g = [node(['NostrEvent', 'TapestryNode'], { uuid: 'u1', tapestryKey: 'k1' }), node(['ListItem'], { id: 'i2', tapestryKey: '{}' }),
    node(['NostrUser', 'TapestryNode'], { tapestryKey: 'k3' }), node(['NostrEvent'], { uuid: 'u4' })];
  const keys = (q, p) => runQuery(g, q, p).map((r) => r.tk);
  assert(same(keys(`MATCH (n) WHERE n.uuid IS NOT NULL OR n.id IS NOT NULL AND n.tapestryKey <> '{}' RETURN n.tapestryKey AS tk`), ['k1', null]),
    'OR binds looser than AND: u4 (a uuid, no key) is kept by its uuid alone');
  assert(same(keys(`MATCH (n) WHERE (n.uuid IS NOT NULL OR n.id IS NOT NULL) AND n.tapestryKey <> '{}' RETURN n.tapestryKey AS tk`), ['k1']),
    "a null key compared with '{}' is null, so WHERE drops u4");
  const grouped = runQuery(g, `MATCH (n) WHERE n.uuid IS NOT NULL OR n.id IS NOT NULL WITH n, CASE WHEN n.tapestryKey IS NOT NULL AND n.tapestryKey <> '{}' THEN true ELSE false END AS initialized RETURN initialized, count(n) AS count`);
  assert(same(grouped, [{ initialized: true, count: 1 }, { initialized: false, count: 2 }]), `WITH, CASE and count group as Neo4j does; got ${show(grouped)}`);
  assert(same(runQuery(g, `MATCH (n) WHERE n.zzz = 1 RETURN count(n) AS c, collect(n.tapestryKey) AS ks`), [{ c: 0, ks: [] }]), 'aggregates over no rows answer one row');
  assert(same(keys(`MATCH (n:NostrEvent|ListItem) WHERE n:TapestryNode OR n.id = $x RETURN n.tapestryKey AS tk ORDER BY tk LIMIT $l`, { x: 'i2', l: 1 }), ['k1']),
    'label disjunctions, label tests, parameters, ORDER BY and LIMIT');
  assert(same(keys(`MATCH (n) WHERE coalesce(n.uuid, n.id) IS NOT NULL AND NOT n.tapestryKey IN ['{}'] RETURN n.tapestryKey AS tk`), ['k1']), 'coalesce, NOT and IN');
  let refused = null;
  try { runQuery(g, 'MATCH (a)-[:HAS_ELEMENT]->(b) RETURN b.tapestryKey AS tk'); } catch (e) { refused = e.message; }
  assert(refused && /can't read this Cypher/.test(refused), `a relationship is refused, saying so; got ${show(refused)}`);
});

test('C1 (AC1): after tapestry-keys — 4 addressed nodes, 3,000 keyed nodes with none — status\'s cache part adds up: cached + cachedEmpty + notCached = withTapestryKey, none larger than nodes', () => {
  const r = bothCallers('after');
  assert(r.cache && r.cache.known === true, `the cache part answers; got ${show(r.cache)}`);
  assert(addsUp(r.cache), `cached + cachedEmpty + notCached must equal withTapestryKey, and none may exceed nodes; got ${show(r.cache)}`);
  assert(same(r.cache, CACHE(0)), `the cache part must count the 4 addressed nodes as before story 3, ${show(CACHE(0))}; got ${show(r.cache)}`
    + (r.cache.notCached > 4 ? ` — notCached counts ${r.cache.notCached - 1} keys of nodes with no address` : ''));
});

test('C2 (AC2): on the same graph, GET /api/tapestry-key/status counts only the addressed nodes, and lmdb.derived + lmdb.empty + lmdb.missing = initialized', () => {
  const r = bothCallers('after');
  const d = r.route && r.route.data;
  assert(r.route && r.route.success === true && d && d.lmdb, `the route answers { success: true, data }; got ${show(r.route)}`);
  assert(d.total === 4 && d.initialized + d.uninitialized === d.total, `total counts the 4 addressed nodes; got ${show(d)}`);
  assert(d.lmdb.derived + d.lmdb.empty + d.lmdb.missing === d.initialized,
    `lmdb.derived + lmdb.empty + lmdb.missing must equal initialized (${d.initialized}); got ${show(d.lmdb)}`);
  assert(same(r.route, { success: true, data: COUNTS(0) }), `the route must answer ${show({ success: true, data: COUNTS(0) })}; got ${show(r.route)}`);
});

test('C3 (AC3): each answer looks up exactly the 4 counted keys, once each, and no read returns a key of a node with no address', () => {
  const r = bothCallers('after');
  for (const [who, did] of [['status\'s cache part', r.cacheDid], ['GET /api/tapestry-key/status', r.routeDid]]) {
    assert(did && did.queries > 0, `${who} reads the graph (so this isn't passing on an answer that never looked); got ${show(did && { queries: did.queries })}`);
    assert(did.lookups.length === 4 && same([...did.lookups].sort(), ADDRESSED_KEYS),
      `${who} must look up exactly ${show(ADDRESSED_KEYS)}, once each; it looked up ${did.lookups.length} keys${did.lookups.length > 4 ? `, ${did.lookups.filter((k) => !ADDRESSED_KEYS.includes(k)).length} of them of nodes with no address` : `: ${show(did.lookups)}`}`);
    assert(did.leaked === 0, `no read by ${who} may return a key of a node with no address; its reads returned ${did.leaked} of the ${UNADDRESSED} (in ${did.rows} rows)`);
  }
});

test('C4 (AC4): an addressed node whose key is \'{}\' or missing is counted as without a key and never looked up; unaddressed nodes the same change nothing', () => {
  const r = bothCallers('gaps');
  assert(same(r.cache, CACHE(2)), `the cache part must answer ${show(CACHE(2))}; got ${show(r.cache)}`);
  assert(same(r.route, { success: true, data: COUNTS(2) }), `the route must answer ${show({ success: true, data: COUNTS(2) })}; got ${show(r.route)}`);
  for (const [who, did] of [['status\'s cache part', r.cacheDid], ['GET /api/tapestry-key/status', r.routeDid]]) {
    const odd = did.lookups.filter((k) => !realKey(k));
    assert(odd.length === 0, `${who} must never look up '{}' or a missing key; it looked up ${show(odd)}`);
    assert(did.lookups.length === 4 && same([...did.lookups].sort(), ADDRESSED_KEYS), `${who} looks up exactly the 4 counted keys; it looked up ${did.lookups.length}`);
    assert(did.leaked === 0, `no read by ${who} may return a key of a node with no address; its reads returned ${did.leaked}`);
  }
});

test('C5 (AC1, AC4): before tapestry-keys — no TapestryNode label anywhere, the nodes with no address unkeyed — the counts are what they are after it', () => {
  const r = bothCallers('before');
  assert(same(r.cache, CACHE(2)), `the cache part must answer ${show(CACHE(2))} on an unmigrated graph too; got ${show(r.cache)}`);
  assert(same(r.route, { success: true, data: COUNTS(2) }), `the route must answer ${show({ success: true, data: COUNTS(2) })}; got ${show(r.route)}`);
  assert(r.cacheDid.lookups.length === 4 && r.routeDid.lookups.length === 4, `each looks up the 4 keyed addressed nodes; got ${r.cacheDid.lookups.length} and ${r.routeDid.lookups.length}`);
});

test('C6 (AC4): on one graph, the migrations part still counts every node\'s key across the whole graph, while the cache part counts only the addressed nodes', () => {
  const nodes = graph('gaps');
  const F = require(LIFECYCLE_FAKES);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-cache-counts-'));
  try {
    const graphFile = path.join(dir, 'graph.json');
    const lmdbFile = path.join(dir, 'lmdb.json');
    const state = path.join(dir, 'state.json');
    fs.writeFileSync(graphFile, JSON.stringify(nodes));
    fs.writeFileSync(lmdbFile, JSON.stringify(LMDB));
    fs.mkdirSync(path.join(dir, 'backups', '.runs'), { recursive: true, mode: 0o700 });
    // The same nodes, in the lifecycle fake's form, behind _system for the migrations part (as status.test.js P2 does).
    F.newFakeState(state, { graph: F.nodeGraph({ nodes: nodes.map((n) => ({
      labels: n.labels, key: n.props.tapestryKey === undefined ? null : n.props.tapestryKey,
      id: n.props.id === undefined ? null : n.props.id, uuid: n.props.uuid === undefined ? null : n.props.uuid, tags: 0,
    })) }) });
    const r = child([setup(graphFile, lmdbFile), body([
      `const sys = require(${show(path.join(ROOT, 'src/operations/catalog/lifecycle/_system.js'))});`,
      `const fake = require(${show(LIFECYCLE_FAKES)}).fakeSystem(${show(state)});`,
      `for (const k of Object.keys(fake)) sys[k] = fake[k];`,
      `const s = require(${show(STATUS_FILE)});`,
      `const r = { migrations: await s.parts.migrations(), cache: await s.parts.cache() };`,
      `process.stdout.write('RESULT:' + JSON.stringify(r) + '\\n');`,
    ])].join(NL), dir);
    const all = nodes.length;
    const withoutKey = nodes.filter((n) => !realKey(n.props.tapestryKey)).length;
    const withLabel = nodes.filter((n) => n.labels.includes('TapestryNode')).length;
    const k = r.migrations && r.migrations.keys;
    assert(k && k.nodes === all && k.withoutKey === withoutKey && k.withLabel === withLabel,
      `the migrations part counts the whole graph: { nodes: ${all}, withLabel: ${withLabel}, withoutKey: ${withoutKey} }; got ${show(k)}`);
    assert(r.cache && r.cache.nodes === nodes.filter(addressed).length && addsUp(r.cache),
      `the cache part counts the ${nodes.filter(addressed).length} addressed nodes, and adds up; got ${show(r.cache)}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

async function run() {
  console.log(`${NL}=== operations: the cache counts (graph-operations-foundation #7) ===`);
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
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
  console.log(`${NL}operations: the cache counts: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
