'use strict';
/**
 * The walk, src/operations/walk.js — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/14-walk.md (AC2, AC5, AC7)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0014-walk.md (Decision 1; Decision 3, how search
 *          calls it)
 *
 * Stack-free. The module is required in a child process with the harness's environment (the owner, the TA and every
 * service endpoint dead: test/helpers/graphOpsSuite.js's childEnv) and called as search (A10.8) will call it, over the
 * graphs test/helpers/walkGraph.js seeds, its reads through graphFake's readerOver. Only what the ADR pins is checked:
 * the exports and limits, the inputs and REACHED, what walk() answers, the bound, what it refuses and what it throws.
 * How it gets there is the Implementer's. graph walk's own suite is test/operations/graph/walk.test.js.
 *
 *   WK1  it exports the inputs, the limits, REACHED, UNKNOWN_NODE and walk, with Decision 1's limits
 *   WK2  the inputs: from a list of 1 to 100 tapestryKeys; types a list of 1 to 50 type names; direction out, in or
 *        both, both by default; depth a whole number from 1 to 10, 1 by default; each described
 *   WK3  REACHED is NODE's five facts with depth, start and path, a list of reads.js's RELATIONSHIP, all required
 *   WK4  UNKNOWN_NODE is unknown-node, 404, saying when
 *   WK5  walk() answers { from, reached, kept, leftOut, tagsLeftOut, complete, finished, pathOf }: the start nodes,
 *        each node reached nearest first with its depth and start, and its path from pathOf
 *   WK6  it takes any read function, as search passes graph.read or a write's tx.read, and only reads
 *   WK7  the bound: a walk that reads exactly the bound is complete; one whose step would read past it drops that
 *        step whole, answers the steps before it, and says so; relationships to tag nodes and to nodes left out count
 *   WK8  with no bound given, the bound is BOUND, 10,000
 *   WK9  it refuses unknown-node for a start that names no node, naming the input it is given and each such key
 *   WK10 it throws, never refuses, for a call no operation's schema lets through
 *   WK11 loading it opens nothing: no Neo4j driver
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../helpers/graphOpsSuite');

const { ROOT, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: the walk (walk.js)');

const ENGINE = path.join(ROOT, 'src/operations/walk.js');
const NODE_KEYS = ['address', 'author', 'name', 'own', 'tapestryKey'];
const ENTRY_KEYS = ['address', 'author', 'depth', 'name', 'own', 'start', 'tapestryKey'];
const RESULT_KEYS = ['complete', 'finished', 'from', 'kept', 'leftOut', 'pathOf', 'reached', 'tagsLeftOut'];
const missing = () => new Error('src/operations/walk.js does not exist yet (ADR graph-operations-first-slice/0014 Decision 1)');

/** The child's script: it requires walk.js, runs every check and prints its findings as one JSON line. */
const SCRIPT = `
'use strict';
const path = require('path');
const ROOT = ${JSON.stringify(ROOT)};
const out = {};
const done = () => { process.stdout.write('RESULT:' + JSON.stringify(out) + '\\n'); };
const loaded = (name) => Object.keys(require.cache).some((p) => p.includes(path.sep + name + path.sep));
let W;
try {
  W = require(path.join(ROOT, 'src/operations/walk.js'));
} catch (e) {
  out.missing = /Cannot find module/.test(String(e && e.message)) && String(e.message).includes('walk.js');
  out.loadError = String((e && e.message) || e).split('\\n')[0];
  done();
  process.exit(0);
}
out.atLoad = { driver: loaded('neo4j-driver') };
const R = require(path.join(ROOT, 'src/operations/reads.js'));
const N = require(path.join(ROOT, 'src/operations/catalog/graph/_nodes.js'));
const { readerOver } = require(path.join(ROOT, 'test/helpers/graphFake.js'));
const { seedWalk, THREAD_TYPES } = require(path.join(ROOT, 'test/helpers/walkGraph.js'));
const wrap = (x) => (x === undefined ? null : x);
const caughtAsync = async (fn) => { try { return { threw: false, value: await fn() }; } catch (e) { return { threw: true, isRefusal: !!(e && e.isRefusal), code: e && e.code, extra: e && e.extra, message: e && e.message, isError: e instanceof Error }; } };
/** A walk's answer as JSON, its paths from pathOf. */
const shown = (w) => w && {
  keys: Object.keys(w).sort(),
  pathOf: typeof w.pathOf,
  from: w.from, kept: w.kept, leftOut: w.leftOut, tagsLeftOut: w.tagsLeftOut, complete: w.complete, finished: w.finished,
  reached: w.reached,
  paths: Array.isArray(w.reached) && typeof w.pathOf === 'function' ? w.reached.map((n) => w.pathOf(n.tapestryKey)) : null,
};
const UNKNOWN1 = '0a0a0a0a-0000-4000-8000-00000000aaaa';
const UNKNOWN2 = '0b0b0b0b-0000-4000-8000-00000000bbbb';

(async () => {
  out.exports = Object.fromEntries(Object.entries(W).map(([k, v]) => [k, typeof v]));
  out.limits = { MAX_FROM: wrap(W.MAX_FROM), MAX_TYPES: wrap(W.MAX_TYPES), MAX_DEPTH: wrap(W.MAX_DEPTH), BOUND: wrap(W.BOUND) };
  out.inputs = { from: wrap(W.FROM_INPUT), types: wrap(W.TYPES_INPUT), direction: wrap(W.DIRECTION_INPUT), depth: wrap(W.DEPTH_INPUT) };
  out.schemas = { reached: wrap(W.REACHED), node: R.NODE, relationship: R.RELATIONSHIP };
  out.unknownNode = wrap(W.UNKNOWN_NODE);
  out.patterns = { key: N.KEY_PATTERN, type: N.TYPE_PATTERN };

  const seed = seedWalk();
  const k = seed.keys;
  out.keys = k;
  const read = readerOver(seed.state);
  const everyone = await R.resolvePov(read, 'everyone');
  const owner = await R.resolvePov(read, 'owner');
  const statements = [];
  const recording = async (q, p) => { statements.push(q); return read(q, p); };
  const walk = (opts, reader = read) => caughtAsync(() => W.walk(reader, opts));
  const thread = { from: [k.header], types: [...THREAD_TYPES].sort(), direction: 'out', depth: 5, pov: everyone };

  // WK5, WK6
  const t = await walk(thread, recording);
  out.thread = t.threw ? t : shown(t.value);
  out.statements = statements.length;
  const tx = { read: async (q, p) => read(q, p) };
  const viaTx = await walk(thread, tx.read);
  out.viaTx = viaTx.threw ? viaTx : shown(viaTx.value);
  const both = await walk({ from: [k.header], types: null, direction: 'both', depth: 5, pov: everyone });
  out.both = both.threw ? both : shown(both.value);

  // WK7, WK8: the bound
  const bulk = (depth, bound) => walk({ from: [k.bulkHub], types: null, direction: 'out', depth, pov: everyone, ...(bound === undefined ? {} : { bound }) });
  const cases = {
    exact: bulk(1, 60),
    oneOver: bulk(1, 59),
    twoSteps: bulk(2, 100),
    twoStepsExact: bulk(2, 120),
    defaulted: bulk(2),
    bothFits: walk({ from: [k.header], types: null, direction: 'both', depth: 1, pov: everyone, bound: 4 }),
    bothInOver: walk({ from: [k.header], types: null, direction: 'both', depth: 1, pov: everyone, bound: 3 }),
    tagsOver: walk({ from: [k.header], types: null, direction: 'out', depth: 1, pov: everyone, bound: 2 }),
    typedFits: walk({ from: [k.header], types: ['IS_THE_CONCEPT_FOR'], direction: 'out', depth: 1, pov: everyone, bound: 1 }),
    leftOutOver: walk({ from: [k.pov0], types: null, direction: 'out', depth: 1, pov: owner, bound: 5 }),
    leftOutFits: walk({ from: [k.pov0], types: null, direction: 'out', depth: 1, pov: owner, bound: 6 }),
  };
  out.bound = {};
  for (const [name, p] of Object.entries(cases)) { const r = await p; out.bound[name] = r.threw ? r : shown(r.value); }

  // WK9: refusals
  out.refused = {
    two: await walk({ ...thread, from: [k.header, UNKNOWN1, UNKNOWN2], input: 'starts' }),
    byDefault: await walk({ ...thread, from: [UNKNOWN1] }),
    entry: await walk({ ...thread, from: [k.G] }),
  };
  out.unknowns = [UNKNOWN1, UNKNOWN2];

  // WK10: what it throws
  const many = Array.from({ length: 101 }, (_, i) => '00000000-0000-4000-8000-' + String(900000 + i).padStart(12, '0'));
  out.throws = {
    fromText: await walk({ ...thread, from: k.header }),
    fromEmpty: await walk({ ...thread, from: [] }),
    from101: await walk({ ...thread, from: many }),
    fromNotAKey: await walk({ ...thread, from: ['not-a-key'] }),
    typeSpace: await walk({ ...thread, types: ['HAS ELEMENT'] }),
    typeTick: await walk({ ...thread, types: ['CITES\`]->(m) DETACH DELETE m //'] }),
    direction: await walk({ ...thread, direction: 'up' }),
    depth0: await walk({ ...thread, depth: 0 }),
    depth11: await walk({ ...thread, depth: 11 }),
    depthHalf: await walk({ ...thread, depth: 1.5 }),
    bound0: await walk({ ...thread, bound: 0 }),
  };
  done();
})().catch((e) => { out.crash = String((e && e.stack) || e); done(); });
`;

let RESULT = null;
function result() {
  if (!RESULT) {
    const dir = tmp('walk-engine-');
    const file = path.join(dir, 'probe.js');
    fs.writeFileSync(file, SCRIPT);
    const child = spawnSync(process.execPath, [file], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
    const line = (child.stdout || '').split('RESULT:')[1];
    assert(line, `the probe printed no result: ${(child.stderr || '').slice(-600)}`);
    RESULT = JSON.parse(line);
  }
  if (RESULT.missing) throw missing();
  assert(!RESULT.loadError, `walk.js must load: ${RESULT.loadError}`);
  assert(!RESULT.crash, `the probe crashed: ${RESULT.crash}`);
  return RESULT;
}

const named = (k) => (key) => Object.keys(k).find((n) => k[n] === key) || key;
const order = (list) => list.every((n, i) => i === 0 || list[i - 1].depth < n.depth || (list[i - 1].depth === n.depth && list[i - 1].tapestryKey < n.tapestryKey));

test('WK1: it exports the inputs, the limits, REACHED, UNKNOWN_NODE and walk, with Decision 1\'s limits', () => {
  const r = result();
  for (const name of ['FROM_INPUT', 'TYPES_INPUT', 'DIRECTION_INPUT', 'DEPTH_INPUT', 'REACHED', 'UNKNOWN_NODE']) assert(r.exports[name] === 'object', `walk.js exports ${name}; got ${show(r.exports[name])}`);
  assert(r.exports.walk === 'function', `walk.js exports walk(read, options); got ${show(r.exports.walk)}`);
  assert(show(r.limits) === show({ MAX_FROM: 100, MAX_TYPES: 50, MAX_DEPTH: 10, BOUND: 10000 }), `the limits: 100 start nodes, 50 types, 10 steps, and a bound of 10,000 relationships; got ${show(r.limits)}`);
});

test('WK2: the inputs: from a list of 1 to 100 keys, types of 1 to 50 type names, direction out, in or both, depth 1 to 10', () => {
  const r = result();
  const { from, types, direction, depth } = r.inputs;
  for (const [name, input] of Object.entries(r.inputs)) assert(input && typeof input.description === 'string' && input.description.length > 0, `${name}'s input is described; got ${show(input)}`);
  assert(from.schema && from.schema.type === 'array' && from.schema.items && from.schema.items.type === 'string' && from.schema.items.pattern === r.patterns.key && from.schema.minItems === 1 && from.schema.maxItems === 100, `from is a list of 1 to 100 tapestryKeys (_nodes.js's KEY_PATTERN); got ${show(from.schema)}`);
  assert(types.schema && types.schema.type === 'array' && types.schema.items && types.schema.items.type === 'string' && types.schema.items.pattern === r.patterns.type && types.schema.minItems === 1 && types.schema.maxItems === 50, `types is a list of 1 to 50 type names (_nodes.js's TYPE_PATTERN); got ${show(types.schema)}`);
  assert(direction.schema && direction.schema.type === 'string' && show([...direction.schema.enum].sort()) === show(['both', 'in', 'out']) && direction.schema.default === 'both', `direction is out, in or both, both by default; got ${show(direction.schema)}`);
  assert(depth.schema && depth.schema.type === 'integer' && depth.schema.minimum === 1 && depth.schema.maximum === 10 && depth.schema.default === 1, `depth is a whole number from 1 to 10, 1 by default; got ${show(depth.schema)}`);
});

test('WK3: REACHED is NODE\'s five facts with depth, start and path, a list of reads.js\'s RELATIONSHIP, all required', () => {
  const r = result();
  const s = r.schemas.reached;
  assert(s && s.type === 'object' && s.properties, `REACHED is an object schema; got ${show(s)}`);
  assert(show([...(s.required || [])].sort()) === show(ENTRY_KEYS.concat('path').sort()), `it requires the five facts, depth, start and path; got ${show(s.required)}`);
  for (const f of NODE_KEYS) assert(show(s.properties[f]) === show(r.schemas.node.properties[f]), `its ${f} is NODE's; got ${show(s.properties[f])}`);
  assert(s.properties.depth && s.properties.depth.type === 'integer', `depth is an integer; got ${show(s.properties.depth)}`);
  assert(s.properties.start && s.properties.start.type === 'string', `start is text, a tapestryKey; got ${show(s.properties.start)}`);
  assert(s.properties.path && s.properties.path.type === 'array' && show(s.properties.path.items) === show(r.schemas.relationship), `path is a list of RELATIONSHIP (C5); got ${show(s.properties.path)}`);
});

test('WK4: UNKNOWN_NODE is unknown-node, 404, saying when', () => {
  const u = result().unknownNode;
  assert(u && u.code === 'unknown-node' && u.status === 404 && typeof u.when === 'string' && u.when.length > 0, `UNKNOWN_NODE: { code: 'unknown-node', status: 404, when }; got ${show(u)}`);
});

test('WK5: walk() answers the start nodes, each node reached nearest first with its depth and start, and its path from pathOf', () => {
  const r = result();
  const k = r.keys;
  const t = r.thread;
  assert(t && !t.threw, `walk() answers along the class thread; got ${show(t)}`);
  assert(show(t.keys) === show(RESULT_KEYS) && t.pathOf === 'function', `it answers { from, reached, kept, leftOut, tagsLeftOut, complete, finished, pathOf }; got ${show(t.keys)}`);
  assert(t.from.length === 1 && show(Object.keys(t.from[0]).sort()) === show(NODE_KEYS) && t.from[0].tapestryKey === k.header, `from: header, with its five facts; got ${show(t.from)}`);
  const depths = t.reached.map((n) => [named(k)(n.tapestryKey), n.depth]).sort();
  const wanted = Object.entries({ superset: 1, set1: 2, elem1: 2, set2: 3, elem2: 3, set3: 4, elem3: 5 }).sort();
  assert(show(depths) === show(wanted), `each node of the class thread once, at its steps from header; got ${show(depths)}`);
  assert(order(t.reached), `reached comes nearest first: by depth, then tapestryKey; got ${show(t.reached.map((n) => `${n.depth} ${named(k)(n.tapestryKey)}`))}`);
  for (const n of t.reached) {
    assert(show(Object.keys(n).sort()) === show(ENTRY_KEYS), `a node reached is its five facts, depth and start; got ${show(n)}`);
    assert(n.start === k.header, `each sets out from header; got ${show(n.start)}`);
  }
  assert(t.kept === 7 && t.leftOut === 0 && t.tagsLeftOut === 0 && t.complete === true && t.finished === 5, `kept 7, nothing left out, complete, 5 steps finished; got ${show({ kept: t.kept, leftOut: t.leftOut, tagsLeftOut: t.tagsLeftOut, complete: t.complete, finished: t.finished })}`);
  const elem3 = t.paths[t.reached.findIndex((n) => n.tapestryKey === k.elem3)];
  const text = (p) => p.map((s) => `${s.direction} ${s.type} ${named(k)(s.from)}->${named(k)(s.to)}`);
  assert(show(text(elem3)) === show(['out IS_THE_CONCEPT_FOR header->superset', 'out IS_A_SUPERSET_OF superset->set1', 'out IS_A_SUPERSET_OF set1->set2', 'out IS_A_SUPERSET_OF set2->set3', 'out HAS_ELEMENT set3->elem3']), `pathOf(elem3) gives its five steps from header; got ${show(text(elem3))}`);
  assert(elem3.every((s) => s.node && show(Object.keys(s.node).sort()) === show(NODE_KEYS)), 'each step\'s node has the five facts');
  const both = r.both;
  assert(both && !both.threw && both.kept === 7 && both.tagsLeftOut === 3 && both.complete === true && both.finished === 5, `both ways with no types: 7 kept, 3 tag nodes passed by, complete; got ${show(both && { kept: both.kept, tagsLeftOut: both.tagsLeftOut, complete: both.complete, finished: both.finished })}`);
});

test('WK6: it takes any read function, as search passes graph.read or a write\'s tx.read, and only reads', () => {
  const r = result();
  assert(r.statements > 0, `walk() reads through the function it is given; ${r.statements} statements`);
  assert(r.viaTx && !r.viaTx.threw && show(r.viaTx) === show(r.thread), 'through a write transaction\'s read it answers the same');
  // readerOver runs every statement as a read, and refuses one that writes: the thread walk above wrote nothing.
});

test('WK7: the bound: exactly the bound is complete; a step that would read past it is dropped whole, and the walk says so', () => {
  const b = result().bound;
  const is = (name, want) => {
    const x = b[name];
    assert(x && !x.threw, `${name} answers; got ${show(x)}`);
    const got = { kept: x.kept, leftOut: x.leftOut, tagsLeftOut: x.tagsLeftOut, complete: x.complete, finished: x.finished, reached: x.reached.length };
    for (const [f, v] of Object.entries(want)) assert(got[f] === v, `${name}: ${f} ${v}; got ${show(got)}`);
  };
  is('exact', { complete: true, finished: 1, kept: 60, reached: 60 });
  is('oneOver', { complete: false, finished: 0, kept: 0, reached: 0, leftOut: 0, tagsLeftOut: 0 });
  is('twoSteps', { complete: false, finished: 1, kept: 60, reached: 60 });
  assert(b.twoSteps.reached.every((n) => n.depth === 1), 'a walk stopped short answers only the steps it finished');
  is('twoStepsExact', { complete: true, finished: 2, kept: 120 });
  is('bothFits', { complete: true, finished: 1, kept: 2, tagsLeftOut: 2 });
  is('bothInOver', { complete: false, finished: 0, kept: 0, tagsLeftOut: 0, reached: 0 });
  is('tagsOver', { complete: false, finished: 0, kept: 0, reached: 0 });
  is('typedFits', { complete: true, finished: 1, kept: 1 });
  is('leftOutOver', { complete: false, finished: 0, kept: 0, leftOut: 0 });
  is('leftOutFits', { complete: true, finished: 1, kept: 3, leftOut: 3 });
});

test('WK8: with no bound given, the bound is BOUND, 10,000', () => {
  const b = result().bound;
  assert(b.defaulted && !b.defaulted.threw && b.defaulted.complete === true && b.defaulted.kept === 120, `a walk of 120 relationships with no bound given is complete; got ${show(b.defaulted && { complete: b.defaulted.complete, kept: b.defaulted.kept })}`);
});

test('WK9: it refuses unknown-node for a start that names no node, naming the input it is given and each such key', () => {
  const r = result();
  const [u1, u2] = r.unknowns;
  const two = r.refused.two;
  assert(two.threw && two.isRefusal && two.code === 'unknown-node', `a start that names no node: unknown-node; got ${show(two)}`);
  assert(two.extra && two.extra.input === 'starts', `it names the input it is given; got ${show(two.extra)}`);
  assert(two.message.includes(u1) && two.message.includes(u2) && !two.message.includes(r.keys.header), `the message names each key that names no node, and not header's; got ${show(two.message)}`);
  const d = r.refused.byDefault;
  assert(d.threw && d.isRefusal && d.code === 'unknown-node' && d.extra && d.extra.input === 'from', `with no input given it names from; got ${show(d)}`);
  const e = r.refused.entry;
  assert(e.threw && e.isRefusal && e.code === 'unknown-node', `a change entry is no node to walk from; got ${show(e)}`);
});

test('WK10: it throws, never refuses, for a call no operation\'s schema lets through', () => {
  const t = result().throws;
  for (const [name, x] of Object.entries(t)) {
    assert(x && x.threw && x.isError && !x.isRefusal, `${name}: walk() throws an Error, not a refusal; got ${show(x)}`);
  }
});

test('WK11: loading it opens nothing: no Neo4j driver', () => {
  const r = result();
  assert(r.atLoad && r.atLoad.driver === false, `requiring walk.js loads no Neo4j driver (ADR graph-operations-foundation/0001 Decision 10); got ${show(r.atLoad)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
