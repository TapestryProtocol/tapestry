'use strict';
/**
 * graph walk — its own suite (ADR graph-operations-foundation/0001 Decision 12), run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/14-walk.md (AC1–AC7)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0014-walk.md (Decisions 1–4)
 *
 * Stack-free: every request goes through test/helpers/operationsHarness.js, over a graph test/helpers/walkGraph.js
 * seeds for test/helpers/graphFake.js. A page's cursor is read from one harness run and sent in the next, over the
 * same graph, and the graph is changed between runs where a test says so. Only what the story and the ADR pin is
 * checked: which nodes come back, at how many steps, on which path, in what order, what is counted, and what is
 * refused; how the walk finds them is the Implementer's. The engine itself, src/operations/walk.js, has its own suite,
 * test/operations/walk.test.js.
 *
 *   W1  a walk from one node reaches every node within depth steps, each once, at its least number of steps
 *   W2  types narrow the walk to those types, declared or not; with none it steps along every type; the answer gives
 *       the types sorted, each once; a type no relationship has answers an empty list
 *   W3  direction out, in or both (the default), for the whole walk; the answer gives the start nodes, in the order
 *       given and each once, with their five facts, and the types, direction, depth and point of view it walked by
 *   W4  each node reached is its five facts, depth, start and path, and nothing more; each step of a path is a
 *       relationship's six facts, read from the node the step leaves, and the steps chain from start to the node
 *   W5  a path is a shortest one: a walk both ways reaches elem3 in one step, by its CITES back, and set3 in two
 *   W6  of several paths as short, the same one each time: out before in, the start or parent with the lesser key,
 *       the type first by name; one of two parallel relationships, the same on every call
 *   W7  a walk never steps onto a node it has met: a relationship back, a loop and a cycle go no further; a start node
 *       is never answered as a node reached
 *   W8  with no types a walk doesn't step onto tag nodes and counts them, each once; with types it steps where they lead
 *   W9  the owner's point of view, by default: a walk steps only to nodes that count, and reaches nothing by way of one
 *       that doesn't; leftOut counts them
 *   W10 the start nodes are never left out, whoever their author
 *   W11 everyone steps onto every node
 *   W12 nothing about a point of view is stored: new scores answer differently, with no write between
 *   W13 before the owner's scores exist, only the instance's own count, and the answer says so
 *   W14 a pov the instance can't read from is refused unknown-pov; a malformed one invalid-input
 *   W15 pages of 50 by default, nearest first: by steps, then by tapestryKey; the cursors page through each node once,
 *       and every page counts the whole walk
 *   W16 a limit from 1 to 200 caps the page; 0 or 201 is refused naming limit
 *   W17 a node added or taken out between two pages, changing no other node's steps, makes no other appear twice or go
 *       missing
 *   W18 a cursor this read didn't give, for the same start nodes, types, direction, depth and point of view, is refused
 *       invalid-cursor; the start nodes' order doesn't matter
 *   W19 depth runs from 1 to 10, 1 by default; 0, 11 or text is refused naming depth
 *   W20 the bound: a walk whose next step would read past 10,000 relationships answers the steps it finished and says
 *       it stopped short; one that reads 10,000 is complete
 *   W21 no from, a from that isn't a tapestryKey, more than 100, or one that names no node of the graph (a change
 *       entry is not one) is refused, naming from and, for a node, each key that names none
 *   W22 a malformed type, more than 50 types, a malformed direction and an input it doesn't take are refused, naming them
 *   W23 a visitor gets 401 and a stranger 403; an admin walks what the owner walks
 *   W24 it writes nothing: reads only, the graph as it was, no change entry
 *   W25 the command answers what the route answers, refusals included; repeated flags make lists
 *   W26 it is listed for an admin, with its inputs and refusals, and has its /docs entry, from and types as lists
 *   W27 the engine, src/operations/walk.js, called from code with the same inputs, gives what the route gives
 *   W28 100 start nodes, sent as 100 repeated keys through the route's own query parser, are walked from
 *   W29 one step both ways with no types meets the nodes list-relationships lists for the same node
 *   W30 its inputs and answer are walk.js's and reads.js's, and the catalog says how a walk is answered and paged
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const { writeState } = require('../../helpers/graphFake');
const { seedWalk, seedBound, PEERS, TIE_KEYS, THREAD_TYPES, CLASS_THREAD, BOTH } = require('../../helpers/walkGraph');

const { ROOT, OWNER, ADMIN, TA, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph walk');

const ROUTE = '/api/tapestry/graph/walk';
const READ = 'graph walk';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/walk.js');
const ENGINE = path.join(ROOT, 'src/operations/walk.js');
const READS = path.join(ROOT, 'src/operations/reads.js');
const NODES = path.join(ROOT, 'src/operations/catalog/graph/_nodes.js');
const CATALOG = path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md');
const NODE_KEYS = ['address', 'author', 'name', 'own', 'tapestryKey'];
const REACHED_KEYS = ['address', 'author', 'depth', 'name', 'own', 'path', 'start', 'tapestryKey'];
const REL_KEYS = ['direction', 'from', 'node', 'properties', 'to', 'type'];
const POV_KEYS = ['cutoff', 'name', 'observer', 'scored'];
const ANSWER_KEYS = ['complete', 'cursor', 'depth', 'direction', 'finished', 'from', 'kept', 'leftOut', 'nodes', 'pov', 'tagsLeftOut', 'types'];
const INPUTS = ['cursor', 'depth', 'direction', 'from', 'limit', 'pov', 'types'];
const BOUND = 10000;
/** A tapestryKey no node of the seeds has. */
const UNKNOWN = '0c0c0c0c-0000-4000-8000-00000000cccc';

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/walk.js does not exist yet (ADR graph-operations-first-slice/0014 Decision 2)');
}

/** A query string; a list becomes one value for each item, as the CLIs send one. */
const q = (route, params) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    for (const x of [].concat(v)) u.append(k, String(x));
  }
  const text = u.toString();
  return text ? `${route}?${text}` : route;
};
const get = (id, caller, params = {}) => ({ id, method: 'GET', url: q(ROUTE, params), caller });
/** One harness run of `requests` (and `cli`) over the graph in `file`. */
const runOver = (file, requests, cli = [], opts = {}) => S.answered(S.runHarness({ scenarios: [{ graphFake: { stateFile: file }, requests, cli }] }, { dir: tmp('walk-run-'), ...opts }));
/** A fresh copy of a seed's graph, in a file of its own. */
const fileOf = (seed) => seed.file(tmp('walk-graph-'));

function ok(a, id) {
  needDecl();
  const x = a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body)}`);
  assert(x.body && x.body.data && Array.isArray(x.body.data.nodes), `${id} answers { nodes, … }; got ${show(x.body && x.body.data)}`);
  return x.body.data;
}
function refused(a, id, status, code, input) {
  needDecl();
  const x = a.req(id);
  assert(x.status === status && x.body && x.body.code === code, `${id}: ${status} ${code}; got ${x.status} ${show(x.body)}`);
  if (input !== undefined) assert(x.body.input === input, `${id}: the refusal names the input ${input}; got ${show(x.body.input)}`);
  assert(typeof x.body.error === 'string' && x.body.error.length > 0, `${id}: the refusal says in words what was wrong; got ${show(x.body)}`);
  return x.body;
}

const named = (k) => (key) => Object.keys(k).find((n) => k[n] === key) || key;
/** A node reached, as [depth, tapestryKey]: the facts that place it. */
const placed = (n) => [n.depth, n.tapestryKey];
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** The order ADR 0014 Decision 2 pins: by steps, then by tapestryKey. */
const inOrder = (list) => [...list].sort((a, b) => (a[0] - b[0]) || cmp(a[1], b[1]));
/** The expected placings of { name: depth }, named by seed keys `k`, in order. */
const want = (k, depths) => inOrder(Object.entries(depths).map(([name, d]) => [d, k[name]]));
const describe = (k, nodes) => nodes.map((n) => `${n.depth} ${named(k)(n.tapestryKey)}`);
/** A step as 'direction TYPE from->to', by name. */
const stepText = (k) => (r) => `${r.direction} ${r.type} ${named(k)(r.from)}->${named(k)(r.to)}`;
const pathText = (k, n) => (n && Array.isArray(n.path) ? n.path.map(stepText(k)) : null);
const byName = (k, d, name) => d.nodes.find((n) => n.tapestryKey === k[name]);

/** What AC2 pins of every path: it sets out from start, each step leaves where the last arrived, and ends at the node. */
function checkPaths(k, d, { types = null, direction = 'both' } = {}) {
  const at = new Map(d.nodes.map((n) => [n.tapestryKey, n.depth]));
  const starts = new Set(d.from.map((n) => n.tapestryKey));
  for (const n of d.nodes) {
    const label = `${named(k)(n.tapestryKey)}'s path ${show(pathText(k, n))}`;
    assert(Array.isArray(n.path) && n.path.length === n.depth, `${label}: as many steps as its depth, ${n.depth}`);
    assert(starts.has(n.start), `${label}: it sets out from one of the start nodes; got start ${show(n.start)}`);
    let leaves = n.start;
    n.path.forEach((r, i) => {
      assert(r.direction === 'out' || r.direction === 'in', `${label}: step ${i + 1}'s direction is out or in`);
      if (direction !== 'both') assert(r.direction === direction, `${label}: a walk ${direction} steps ${direction} only`);
      if (types) assert(types.includes(r.type), `${label}: step ${i + 1} is of one of the types walked by, ${show(types)}`);
      const reaches = r.node && r.node.tapestryKey;
      if (r.direction === 'out') assert(r.from === leaves && r.to === reaches, `${label}: step ${i + 1}, out, runs from the node it leaves to the node it reaches`);
      else assert(r.to === leaves && r.from === reaches, `${label}: step ${i + 1}, in, runs to the node it leaves from the node it reaches`);
      if (i < n.path.length - 1) assert(at.get(reaches) === i + 1, `${label}: the node step ${i + 1} reaches is itself reached at ${i + 1} steps`);
      leaves = reaches;
    });
    assert(leaves === n.tapestryKey, `${label}: its last step reaches the node`);
  }
}

/** A cursor's JSON, [read, scope, position], and a cursor made from one. */
const opened = (cursor) => JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
const sealed = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');

// ── the main run: one seeded graph, most of the requests ──
let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  const seed = seedWalk();
  const file = fileOf(seed);
  const k = seed.keys;
  const before = S.readState(file);
  const all = { pov: 'everyone', limit: 200 };
  const thread = { from: k.header, types: THREAD_TYPES, direction: 'out', ...all };
  const tie = { from: [k.tie2, k.tie1], depth: 2, ...all };
  const hundred = [k.bulkHub, ...seed.links.map((n) => k[n]), ...seed.leaves.slice(0, 39).map((n) => k[n])];
  const a = runOver(file, [
    // the class thread
    ...[1, 2, 3, 4, 5].map((d) => get(`thread-${d}`, 'owner', { ...thread, depth: d })),
    get('thread-dup-types', 'owner', { ...thread, types: ['HAS_ELEMENT', 'IS_A_SUPERSET_OF', 'HAS_ELEMENT', 'IS_THE_CONCEPT_FOR'], depth: 5 }),
    get('thread-in', 'owner', { from: k.elem3, types: THREAD_TYPES, direction: 'in', depth: 5, ...all }),
    get('thread-two-starts', 'owner', { from: [k.header, k.superset], types: THREAD_TYPES, direction: 'out', depth: 5, ...all }),
    get('out-no-types', 'owner', { from: k.header, direction: 'out', depth: 5, ...all }),
    get('both', 'owner', { from: k.header, depth: 5, ...all }),
    get('both-named', 'owner', { from: k.header, direction: 'both', depth: 5, ...all }),
    get('default-depth', 'owner', { from: k.header, ...all }),
    get('no-such-type', 'owner', { from: k.header, types: 'NO_SUCH_TYPE', depth: 5, ...all }),
    get('mentions', 'owner', { from: k.set2, types: 'MENTIONS', depth: 3, ...all }),
    get('lonely', 'owner', { from: k.lonely, depth: 3 }),
    // the tie-break
    get('tie', 'owner', tie),
    get('tie-dup-from', 'owner', { ...tie, from: [k.tie2, k.tie1, k.tie2] }),
    // the point of view
    get('pov-owner', 'owner', { from: k.pov0, direction: 'out', depth: 2, limit: 200 }),
    get('pov-owner-named', 'owner', { from: k.pov0, direction: 'out', depth: 2, pov: 'owner', limit: 200 }),
    get('pov-owner-pubkey', 'owner', { from: k.pov0, direction: 'out', depth: 2, pov: OWNER, limit: 200 }),
    get('pov-everyone', 'owner', { from: k.pov0, direction: 'out', depth: 2, ...all }),
    get('pov-start', 'owner', { from: k.povStart, direction: 'out', depth: 2, limit: 200 }),
    get('pov-stranger', 'owner', { from: k.pov0, pov: PEERS.stranger }),
    get('pov-admin', 'owner', { from: k.pov0, pov: ADMIN }),
    get('pov-house', 'owner', { from: k.pov0, pov: 'house' }),
    // tag nodes and the filter
    get('tags-none', 'owner', { from: k.tagged, depth: 2, ...all }),
    get('tags-typed', 'owner', { from: k.tagged, types: ['HAS_TAG', 'REFERENCES'], depth: 2, ...all }),
    get('tags-typed-owner', 'owner', { from: k.tagged, types: ['HAS_TAG', 'REFERENCES'], depth: 2, limit: 200 }),
    get('tags-two-starts', 'owner', { from: [k.tagged, k.tagger], depth: 1, ...all }),
    get('filtered', 'owner', { from: k.filtered, direction: 'out', depth: 1, ...all }),
    // depth and paging
    get('chain-10', 'owner', { from: k.chain0, direction: 'out', depth: 10, ...all }),
    get('chain-default', 'owner', { from: k.chain0, direction: 'out', ...all }),
    get('depth-0', 'owner', { from: k.chain0, depth: 0 }),
    get('depth-11', 'owner', { from: k.chain0, depth: 11 }),
    get('depth-text', 'owner', { from: k.chain0, depth: 'two' }),
    get('bulk-1', 'owner', { from: k.bulkHub, direction: 'out', depth: 2 }),
    get('bulk-200', 'owner', { from: k.bulkHub, direction: 'out', depth: 2, limit: 200 }),
    get('limit-3', 'owner', { from: k.header, depth: 5, pov: 'everyone', limit: 3 }),
    get('limit-0', 'owner', { from: k.header, limit: 0 }),
    get('limit-201', 'owner', { from: k.header, limit: 201 }),
    // refusals
    get('no-from', 'owner', {}),
    get('no-from-paged', 'owner', { limit: 5, pov: 'everyone', direction: 'out', depth: 2 }),
    get('bad-from', 'owner', { from: 'not-a-key' }),
    get('bad-from-second', 'owner', { from: [k.header, 'not-a-key'] }),
    get('from-101', 'owner', { from: Array.from({ length: 101 }, () => crypto.randomUUID()) }),
    get('unknown-from', 'owner', { from: UNKNOWN }),
    get('unknown-from-two', 'owner', { from: [k.header, '0a0a0a0a-0000-4000-8000-00000000aaaa', '0b0b0b0b-0000-4000-8000-00000000bbbb'] }),
    get('entry', 'owner', { from: k.G }),
    get('bad-type-space', 'owner', { from: k.header, types: 'HAS ELEMENT' }),
    get('bad-type-digit', 'owner', { from: k.header, types: '1CITES' }),
    get('bad-type-dash', 'owner', { from: k.header, types: 'IS-A' }),
    get('bad-type-tick', 'owner', { from: k.header, types: 'CITES`]->(m) DETACH DELETE m //' }),
    get('bad-type-second', 'owner', { from: k.header, types: ['CITES', 'NOT A TYPE'] }),
    get('types-51', 'owner', { from: k.header, types: Array.from({ length: 51 }, (_, i) => `TYPE_${i}`) }),
    get('types-50', 'owner', { from: k.header, types: Array.from({ length: 50 }, (_, i) => `TYPE_${i}`) }),
    get('bad-direction', 'owner', { from: k.header, direction: 'sideways' }),
    get('bad-direction-case', 'owner', { from: k.header, direction: 'OUT' }),
    get('unknown-input', 'owner', { from: k.header, foo: '1' }),
    // who may call
    get('visitor', 'visitor', { from: k.pov0 }),
    get('stranger', 'stranger', { from: k.pov0 }),
    get('owner-same', 'owner', { from: k.pov0, direction: 'out', depth: 2, limit: 200 }),
    get('admin-same', 'admin', { from: k.pov0, direction: 'out', depth: 2, limit: 200 }),
    // the route and the command
    get('route-tie', 'owner', { from: [k.tie2, k.tie1], depth: 2, pov: 'everyone', limit: 5 }),
    get('route-thread', 'owner', { ...thread, depth: 5 }),
    get('route-refusal', 'owner', { from: k.G }),
    // 100 start nodes, and one step both ways beside list-relationships
    get('hundred', 'owner', { from: hundred, direction: 'out', depth: 1, limit: 200 }),
    get('cross-header', 'owner', { from: k.header, limit: 200 }),
    get('cross-tie1', 'owner', { from: k.tie1, limit: 200 }),
    { id: 'lr-header', method: 'GET', url: q('/api/tapestry/graph/list-relationships', { node: k.header, limit: 200 }), caller: 'owner' },
    { id: 'lr-tie1', method: 'GET', url: q('/api/tapestry/graph/list-relationships', { node: k.tie1, limit: 200 }), caller: 'owner' },
    { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
  ], [
    { id: 'cli-tie', argv: ['graph', 'walk', '--from', k.tie2, '--from', k.tie1, '--depth', '2', '--pov', 'everyone', '--limit', '5'] },
    { id: 'cli-thread', argv: ['graph', 'walk', '--from', k.header, ...THREAD_TYPES.flatMap((t) => ['--types', t]), '--direction', 'out', '--depth', '5', '--pov', 'everyone', '--limit', '200'] },
    { id: 'cli-refusal', argv: ['graph', 'walk', '--from', k.G] },
  ]);
  MAIN = { a, seed, k, file, before, hundred };
  return MAIN;
}

test('W1: a walk from one node reaches every node within depth steps, each once, at its least number of steps', () => {
  const { a, k } = main();
  for (const d of [1, 2, 3, 4, 5]) {
    const x = ok(a, `thread-${d}`);
    const expected = Object.fromEntries(Object.entries(CLASS_THREAD).filter(([, steps]) => steps <= d));
    assert(show(x.nodes.map(placed)) === show(want(k, expected)), `depth ${d}, out along the class thread from header: every node within ${d} steps, nearest first; got ${show(describe(k, x.nodes))}`);
    assert(x.kept === Object.keys(expected).length && x.leftOut === 0 && x.tagsLeftOut === 0, `depth ${d}: kept ${Object.keys(expected).length}; got ${show({ kept: x.kept, leftOut: x.leftOut, tagsLeftOut: x.tagsLeftOut })}`);
    assert(x.complete === true && x.finished === d && x.cursor === null, `depth ${d}: complete, all ${d} steps finished, one page; got ${show({ complete: x.complete, finished: x.finished, cursor: x.cursor })}`);
  }
  const keys = ok(a, 'thread-5').nodes.map((n) => n.tapestryKey);
  assert(new Set(keys).size === keys.length, 'each node is answered once');
  const lonely = ok(a, 'lonely');
  assert(lonely.nodes.length === 0 && lonely.cursor === null && lonely.kept === 0 && lonely.leftOut === 0 && lonely.tagsLeftOut === 0 && lonely.complete === true, `a start with nothing to follow: an empty list, nothing counted; got ${show(lonely)}`);
  assert(lonely.from && lonely.from.length === 1 && lonely.from[0].tapestryKey === k.lonely, 'and it still gives the start node');
});

test('W2: types narrow the walk, declared or not; with none it steps along every type; types come back sorted, each once', () => {
  const { a, k } = main();
  const thread = ok(a, 'thread-5');
  assert(show(thread.types) === show([...THREAD_TYPES].sort()), `the answer gives the types it walked by, sorted; got ${show(thread.types)}`);
  const dup = ok(a, 'thread-dup-types');
  assert(show(dup.types) === show([...THREAD_TYPES].sort()) && show(dup.nodes) === show(thread.nodes), `a type named twice is walked by once; got ${show(dup.types)}`);
  const none = ok(a, 'out-no-types');
  assert(none.types === null, `with no types, types is null; got ${show(none.types)}`);
  assert(show(none.nodes.map(placed)) === show(want(k, CLASS_THREAD)), `out with no types reaches the same nodes, every type followed (CITES and MENTIONS lead only to nodes met); got ${show(describe(k, none.nodes))}`);
  const mentions = ok(a, 'mentions');
  assert(mentions.nodes.length === 0 && mentions.complete === true, `MENTIONS, which the graph doesn't declare, is followed like any type: set2's only one is to itself; got ${show(describe(k, mentions.nodes))}`);
  const nope = ok(a, 'no-such-type');
  assert(nope.nodes.length === 0 && nope.cursor === null && nope.kept === 0 && nope.leftOut === 0 && nope.tagsLeftOut === 0 && nope.complete === true, `a type no relationship has: an empty list, nothing counted, not a refusal; got ${show(nope)}`);
});

test('W3: direction out, in or both (the default), for the whole walk; the answer gives what it walked by', () => {
  const { a, k, seed } = main();
  const inn = ok(a, 'thread-in');
  assert(show(inn.nodes.map(placed)) === show(want(k, { set3: 1, set2: 2, set1: 3, superset: 4, header: 5 })), `in along the class thread from elem3: up to header in 5 steps; got ${show(describe(k, inn.nodes))}`);
  checkPaths(k, inn, { types: THREAD_TYPES, direction: 'in' });
  const both = ok(a, 'both');
  assert(both.direction === 'both' && show(both) === show(ok(a, 'both-named')), 'direction both is the default, and answers what the default answers');
  assert(ok(a, 'thread-5').direction === 'out' && inn.direction === 'in', 'the answer gives the direction it walked by');
  const d = ok(a, 'thread-5');
  assert(d.depth === 5 && ok(a, 'default-depth').depth === 1, `the answer gives the depth it walked to, 1 by default; got ${show([d.depth, ok(a, 'default-depth').depth])}`);
  assert(d.from && d.from.length === 1 && show(Object.keys(d.from[0]).sort()) === show(NODE_KEYS), `the start node comes with exactly the five facts; got ${show(d.from)}`);
  const h = d.from[0];
  assert(h.tapestryKey === k.header && h.name === 'widget' && h.address === seed.uuids.header && h.author === TA && h.own === true, `header: its key, name, address, the assistant as author, own; got ${show(h)}`);
  assert(d.pov && show(Object.keys(d.pov).sort()) === show(POV_KEYS) && d.pov.name === 'everyone', `pov is { name, observer, cutoff, scored }; got ${show(d.pov)}`);
  const tie = ok(a, 'tie');
  assert(show(tie.from.map((n) => n.tapestryKey)) === show([k.tie2, k.tie1]), `the start nodes come in the order given; got ${show(tie.from.map((n) => named(k)(n.tapestryKey)))}`);
  const dup = ok(a, 'tie-dup-from');
  assert(show(dup.from.map((n) => n.tapestryKey)) === show([k.tie2, k.tie1]) && show(dup.nodes) === show(tie.nodes), `a start named twice is answered, and walked from, once; got ${show(dup.from.map((n) => named(k)(n.tapestryKey)))}`);
  for (const id of ['thread-5', 'both']) {
    const x = ok(a, id);
    assert(show(Object.keys(x).sort()) === show(ANSWER_KEYS), `${id}: the answer is { from, types, direction, depth, pov, kept, leftOut, tagsLeftOut, complete, finished, nodes, cursor }; got ${show(Object.keys(x).sort())}`);
  }
});

test('W4: each node reached is its five facts, depth, start and path; each step is a relationship\'s six facts, read from the node it leaves', () => {
  const { a, k } = main();
  for (const id of ['thread-5', 'thread-in', 'both', 'tie', 'tags-typed']) {
    const d = ok(a, id);
    for (const n of d.nodes) {
      assert(show(Object.keys(n).sort()) === show(REACHED_KEYS), `${id}: a node reached has exactly { tapestryKey, name, address, author, own, depth, start, path }; got ${show(n)}`);
      assert(Number.isInteger(n.depth) && n.depth >= 1, `${id}: its depth is a whole number from 1; got ${show(n.depth)}`);
      for (const r of n.path) {
        assert(show(Object.keys(r).sort()) === show(REL_KEYS), `${id}: a step has exactly the six facts of a relationship; got ${show(r)}`);
        assert(r.node && show(Object.keys(r.node).sort()) === show(NODE_KEYS), `${id}: the node a step reaches has exactly the five facts; got ${show(r.node)}`);
        assert(r.properties && typeof r.properties === 'object' && !Array.isArray(r.properties), `${id}: a step's properties is an object; got ${show(r.properties)}`);
      }
    }
  }
  const d = ok(a, 'thread-5');
  checkPaths(k, d, { types: THREAD_TYPES, direction: 'out' });
  const elem3 = byName(k, d, 'elem3');
  assert(show(pathText(k, elem3)) === show(['out IS_THE_CONCEPT_FOR header->superset', 'out IS_A_SUPERSET_OF superset->set1', 'out IS_A_SUPERSET_OF set1->set2', 'out IS_A_SUPERSET_OF set2->set3', 'out HAS_ELEMENT set3->elem3']), `elem3's path, out from header; got ${show(pathText(k, elem3))}`);
  assert(elem3.start === k.header && elem3.name === 'elem3' && elem3.author === TA && elem3.own === true, `elem3: start header, its name, the assistant, own; got ${show({ start: named(k)(elem3.start), name: elem3.name, author: elem3.author, own: elem3.own })}`);
  const last = elem3.path[elem3.path.length - 1];
  assert(last.node.tapestryKey === k.elem3 && last.node.name === 'elem3', 'the last step reaches the node, with its five facts');
  const header = byName(k, ok(a, 'thread-in'), 'header');
  assert(show(pathText(k, header)) === show(['in HAS_ELEMENT set3->elem3', 'in IS_A_SUPERSET_OF set2->set3', 'in IS_A_SUPERSET_OF set1->set2', 'in IS_A_SUPERSET_OF superset->set1', 'in IS_THE_CONCEPT_FOR header->superset']), `in from elem3, header's path: each step in, from the node it reaches to the node it leaves; got ${show(pathText(k, header))}`);
});

test('W5: a path is a shortest one: both ways, elem3 is one step away by its CITES back to header, and set3 two', () => {
  const { a, k } = main();
  const d = ok(a, 'both');
  assert(show(d.nodes.map(placed)) === show(want(k, BOTH)), `both ways with no types from header: superset and elem3 1; set1, elem1 and set3 2; set2 and elem2 3; got ${show(describe(k, d.nodes))}`);
  checkPaths(k, d);
  assert(show(pathText(k, byName(k, d, 'elem3'))) === show(['in CITES elem3->header']), `elem3 by its CITES, read from header as in; got ${show(pathText(k, byName(k, d, 'elem3')))}`);
  assert(show(pathText(k, byName(k, d, 'set3'))) === show(['in CITES elem3->header', 'in HAS_ELEMENT set3->elem3']), `set3 in two steps, back through elem3; got ${show(pathText(k, byName(k, d, 'set3')))}`);
  assert(d.complete === true && d.finished === 5 && d.kept === 7 && d.tagsLeftOut === 3, `a walk that runs out of nodes before its depth is complete, all 5 steps finished; 7 kept, 3 tag nodes passed by; got ${show({ complete: d.complete, finished: d.finished, kept: d.kept, tagsLeftOut: d.tagsLeftOut })}`);
});

test('W6: of several paths as short, the same one each time: out before in, the lesser key, the type first by name', () => {
  const { a, k, file } = main();
  const d = ok(a, 'tie');
  assert(show(d.nodes.map(placed)) === show(want(k, { mid1: 1, mid2: 1, shared: 1, twin: 1, inward: 1, pair: 1, far: 2 })), `from tie2 and tie1 both ways: six nodes in one step, far in two; got ${show(describe(k, d.nodes))}`);
  checkPaths(k, d);
  const path = (name) => pathText(k, byName(k, d, name));
  assert(byName(k, d, 'shared').start === k.tie1 && show(path('shared')) === show(['out LINKS tie1->shared']), `shared, one step from both starts, sets out from tie1, the start with the lesser key; got ${show(path('shared'))} from ${named(k)(byName(k, d, 'shared').start)}`);
  assert(show(path('far')) === show(['out LINKS tie1->mid1', 'out LINKS mid1->far']), `far, two steps through mid1 or mid2, goes through mid1, the lesser key; got ${show(path('far'))}`);
  assert(show(path('twin')) === show(['out ALPHA tie1->twin']), `twin, by ZETA or ALPHA, goes by ALPHA, first by name; got ${show(path('twin'))}`);
  assert(show(path('inward')) === show(['out OUTWARD tie1->inward']), `inward, out by OUTWARD or in by INWARD, goes out; got ${show(path('inward'))}`);
  const set2 = byName(k, ok(a, 'both'), 'set2');
  assert(show(pathText(k, set2)) === show(['out IS_THE_CONCEPT_FOR header->superset', 'out IS_A_SUPERSET_OF superset->set1', 'out IS_A_SUPERSET_OF set1->set2']), `set2, three steps out from set1 or in from set3, goes out from set1; got ${show(pathText(k, set2))}`);
  const pair = byName(k, d, 'pair').path[0];
  assert(pair.type === 'SAME' && [1, 2].includes(pair.properties.n), `pair, by one of two SAME relationships; got ${show(pair)}`);
  const again = ok(runOver(file, [get('again', 'owner', { from: [k.tie2, k.tie1], depth: 2, pov: 'everyone', limit: 200 })]), 'again');
  assert(show(again) === show(d), 'the same graph, walked again, answers the same paths, the parallel SAME included');
  assert(Object.keys(TIE_KEYS).every((n) => k[n] === TIE_KEYS[n]), 'the tie-break nodes carry the seed\'s fixed keys');
});

test('W7: a walk never steps onto a node it has met: a relationship back, a loop and a cycle go no further; a start is never a node reached', () => {
  const { a, k } = main();
  for (const id of ['both', 'out-no-types', 'tie', 'bulk-200']) {
    const d = ok(a, id);
    const keys = d.nodes.map((n) => n.tapestryKey);
    assert(new Set(keys).size === keys.length, `${id}: each node once; got ${show(describe(k, d.nodes))}`);
    const starts = d.from.map((n) => n.tapestryKey);
    assert(!keys.some((x) => starts.includes(x)), `${id}: no start node is answered as a node reached`);
  }
  const none = ok(a, 'out-no-types');
  assert(!none.nodes.some((n) => n.tapestryKey === k.header), 'elem3\'s CITES back to header doesn\'t reach header again');
  assert(byName(k, none, 'set2').depth === 3, 'set2\'s MENTIONS to itself leaves set2 where it was');
  const two = ok(a, 'thread-two-starts');
  assert(show(two.nodes.map(placed)) === show(want(k, { set1: 1, elem1: 1, set2: 2, elem2: 2, set3: 3, elem3: 4 })), `from header and superset: superset is a start, so not reached, and the walk runs from it; got ${show(describe(k, two.nodes))}`);
});

test('W8: with no types a walk doesn\'t step onto tag nodes and counts them, each once; with types it steps where they lead', () => {
  const { a, k } = main();
  const none = ok(a, 'tags-none');
  assert(none.nodes.length === 0 && none.tagsLeftOut === 3 && none.kept === 0 && none.leftOut === 0, `from tagged with no types: no node, and 3 tag nodes passed by (two HAS_TAG out, one REFERENCES in); tagger, beyond its tag node, never met; got ${show(describe(k, none.nodes))} ${show({ tagsLeftOut: none.tagsLeftOut, kept: none.kept })}`);
  assert(none.complete === true && none.finished === 2, `it ran out of nodes, so it is complete, both steps finished; got ${show({ complete: none.complete, finished: none.finished })}`);
  const out = ok(a, 'out-no-types');
  assert(out.tagsLeftOut === 3 && !out.nodes.some((n) => ['headerTagD', 'headerTagName', 'elem1TagD'].includes(named(k)(n.tapestryKey))), `out with no types from header: header's two tag nodes and elem1's, counted across the steps; got ${show(out.tagsLeftOut)}`);
  const typed = ok(a, 'tags-typed');
  assert(show(typed.nodes.map(placed)) === show(want(k, { taggedD: 1, taggedName: 1, taggerE: 1, tagger: 2 })) && typed.tagsLeftOut === 0, `with HAS_TAG and REFERENCES: tagged's tag nodes and the e tag node in one step, and tagger behind it in two; got ${show(describe(k, typed.nodes))} ${typed.tagsLeftOut}`);
  assert(show(pathText(k, byName(k, typed, 'tagger'))) === show(['in REFERENCES taggerE->tagged', 'in HAS_TAG tagger->taggerE']), `tagger's path, through its tag node; got ${show(pathText(k, byName(k, typed, 'tagger')))}`);
  const owner = ok(a, 'tags-typed-owner');
  assert(show(owner.nodes.map(placed)) === show(typed.nodes.map(placed)) && owner.leftOut === 0, 'a tag node has no author, so the owner\'s point of view steps onto it too');
  const two = ok(a, 'tags-two-starts');
  assert(two.tagsLeftOut === 3 && two.nodes.length === 0, `from tagged and tagger: taggerE is met from both, and counted once; got ${show({ tagsLeftOut: two.tagsLeftOut, nodes: describe(k, two.nodes) })}`);
  const filtered = ok(a, 'filtered');
  assert(show(filtered.nodes.map(placed)) === show(want(k, { fine: 1 })) && filtered.kept === 1 && filtered.leftOut === 0 && filtered.tagsLeftOut === 0, `from filtered: only fine; a node with no tapestryKey, one keyed '{}' and a change entry are neither reached nor counted; got ${show(describe(k, filtered.nodes))}`);
});

test('W9: from the owner\'s point of view, by default, a walk steps only to nodes that count, and reaches nothing by way of one that doesn\'t', () => {
  const { a, k } = main();
  const d = ok(a, 'pov-owner');
  assert(show(d.nodes.map(placed)) === show(want(k, { povHi: 1, povAnon: 1, povOwned: 1, povHiKid: 2 })), `the owner counts the peer scored 0.2, the author-less and the owner's, and steps on to povHiKid; got ${show(describe(k, d.nodes))}`);
  assert(!d.nodes.some((n) => n.tapestryKey === k.povLoKid), 'povLoKid, which only povLo (0.01) leads to, is never reached');
  assert(d.kept === 4 && d.leftOut === 3, `kept 4; left out 3: povLo (0.01), povNoUser (no NostrUser) and povNoScore (no influence), and nothing beyond them counted; got ${show({ kept: d.kept, leftOut: d.leftOut })}`);
  assert(show(d.pov) === show({ name: 'owner', observer: OWNER, cutoff: 0.05, scored: true }), `pov: the owner's, as observer, with the default cutoff and scores; got ${show(d.pov)}`);
  checkPaths(k, d, { direction: 'out' });
  for (const id of ['pov-owner-named', 'pov-owner-pubkey']) assert(show(ok(a, id)) === show(d), `${id}: pov=owner, and the owner's own pubkey, walk exactly as the default`);
});

test('W10: the start nodes are never left out, whoever their author', () => {
  const { a, k } = main();
  const d = ok(a, 'pov-start');
  assert(d.from.length === 1 && d.from[0].tapestryKey === k.povStart && d.from[0].author === PEERS.lo && d.from[0].own === false, `povStart, by a peer scored 0.01, is still answered as the start; got ${show(d.from)}`);
  assert(show(d.nodes.map(placed)) === show(want(k, { povStartKid: 1 })) && d.kept === 1 && d.leftOut === 0, `and walked from: its kid (the assistant's) counts; got ${show(describe(k, d.nodes))}`);
});

test('W11: pov=everyone steps onto every node and leaves nothing out', () => {
  const { a, k } = main();
  const d = ok(a, 'pov-everyone');
  assert(show(d.nodes.map(placed)) === show(want(k, { povLo: 1, povHi: 1, povAnon: 1, povNoUser: 1, povNoScore: 1, povOwned: 1, povLoKid: 2, povHiKid: 2 })), `everyone: all six cited, and both kids; got ${show(describe(k, d.nodes))}`);
  assert(d.kept === 8 && d.leftOut === 0, `kept 8, nothing left out; got ${show({ kept: d.kept, leftOut: d.leftOut })}`);
  assert(show(d.pov) === show({ name: 'everyone', observer: null, cutoff: null, scored: null }), `pov: everyone's, with no observer, cutoff or scores; got ${show(d.pov)}`);
});

test('W12: nothing about a point of view is stored: new scores answer differently, with no write between', () => {
  needDecl();
  const seed = seedWalk();
  const file = fileOf(seed);
  const k = seed.keys;
  const keysOf = (d) => d.nodes.map((n) => n.tapestryKey);
  const first = ok(runOver(file, [get('before', 'owner', { from: k.pov0, direction: 'out', depth: 2, limit: 200 })]), 'before');
  assert(keysOf(first).includes(k.povHiKid) && !keysOf(first).includes(k.povLoKid), 'at first povHi (0.2) leads on to its kid, and povLo (0.01) does not');
  // GrapeRank writes new scores: hi falls to 0.01, lo rises to 0.3.
  const st = S.readState(file);
  for (const n of st.nodes) {
    if (!n.labels.includes('NostrUser')) continue;
    if (n.props.pubkey === PEERS.hi) n.props.influence = 0.01;
    if (n.props.pubkey === PEERS.lo) n.props.influence = 0.3;
  }
  const logLength = st.log.length;
  writeState(file, st);
  const second = ok(runOver(file, [get('after', 'owner', { from: k.pov0, direction: 'out', depth: 2, limit: 200 })]), 'after');
  assert(show(second.nodes.map(placed)) === show(want(k, { povLo: 1, povAnon: 1, povOwned: 1, povLoKid: 2 })), `after the new scores, the walk runs through povLo and not povHi; got ${show(describe(k, second.nodes))}`);
  assert(second.kept === 4 && second.leftOut === 3, `kept 4, left out 3; got ${show({ kept: second.kept, leftOut: second.leftOut })}`);
  const log = S.readState(file).log.slice(logLength);
  assert(log.length > 0 && log.every((e) => e.call === 'read'), `the walk only reads; nothing is written for a point of view; the log: ${show(log)}`);
});

test('W13: before the owner\'s scores exist, only the instance\'s own count, and the answer says the scores aren\'t there yet', () => {
  needDecl();
  const seed = seedWalk({ unscored: true });
  const k = seed.keys;
  const d = ok(runOver(fileOf(seed), [get('unscored', 'owner', { from: k.pov0, direction: 'out', depth: 2, limit: 200 })]), 'unscored');
  assert(show(d.nodes.map(placed)) === show(want(k, { povAnon: 1, povOwned: 1 })), `only the author-less and the owner's count; got ${show(describe(k, d.nodes))}`);
  assert(d.kept === 2 && d.leftOut === 4, `kept 2, left out 4; got ${show({ kept: d.kept, leftOut: d.leftOut })}`);
  assert(d.pov && d.pov.name === 'owner' && d.pov.scored === false, `pov.scored is false: the owner's scores aren't there yet; got ${show(d.pov)}`);
});

test('W14: a pov the instance can\'t read from is refused unknown-pov, saying which it can; a malformed one invalid-input', () => {
  const { a } = main();
  for (const id of ['pov-stranger', 'pov-admin']) {
    const b = refused(a, id, 400, 'unknown-pov', 'pov');
    assert(/owner/.test(b.error) && /everyone/.test(b.error), `${id}: the refusal says it reads from the owner's point of view or everyone's; got ${show(b.error)}`);
  }
  refused(a, 'pov-house', 400, 'invalid-input', 'pov');
});

test('W15: pages of 50 by default, nearest first, by steps then key; the cursors page through each node once; every page counts the whole walk', () => {
  const { a, seed, file } = main();
  const k = seed.keys;
  const order = inOrder([...seed.links.map((n) => [1, k[n]]), ...seed.leaves.map((n) => [2, k[n]])]);
  const p1 = ok(a, 'bulk-1');
  assert(p1.nodes.length === 50 && typeof p1.cursor === 'string' && p1.cursor.length > 0, `page 1: 50 and a cursor; got ${p1.nodes.length} and ${show(p1.cursor)}`);
  assert(p1.nodes.every((n) => n.depth === 1), 'page 1 is all one step away');
  const p2 = ok(runOver(file, [get('bulk-2', 'owner', { from: k.bulkHub, direction: 'out', depth: 2, cursor: p1.cursor })]), 'bulk-2');
  assert(p2.nodes.length === 50 && typeof p2.cursor === 'string', `page 2: 50 more and a cursor; got ${p2.nodes.length} and ${show(p2.cursor)}`);
  assert(p2.nodes.slice(0, 10).every((n) => n.depth === 1) && p2.nodes.slice(10).every((n) => n.depth === 2), `page 2 runs from the last 10 at one step into the first 40 at two; got ${show(p2.nodes.map((n) => n.depth).join(','))}`);
  const p3 = ok(runOver(file, [get('bulk-3', 'owner', { from: k.bulkHub, direction: 'out', depth: 2, cursor: p2.cursor })]), 'bulk-3');
  assert(p3.nodes.length === 20 && p3.cursor === null, `page 3: the last 20, and a null cursor; got ${p3.nodes.length} and ${show(p3.cursor)}`);
  const all = [...p1.nodes, ...p2.nodes, ...p3.nodes].map(placed);
  assert(show(all) === show(order), 'the three pages hold every node of the walk exactly once: the 60 links by key, then the 60 leaves by key');
  for (const p of [p1, p2, p3]) assert(p.kept === 120 && p.leftOut === 0 && p.tagsLeftOut === 0 && p.complete === true && p.finished === 2, `every page counts the whole walk, 120; got ${show({ kept: p.kept, leftOut: p.leftOut, complete: p.complete, finished: p.finished })}`);
  const max = ok(a, 'bulk-200');
  assert(show(max.nodes.map(placed)) === show(order) && max.cursor === null, 'limit 200: all 120 in one page, in the same order');
});

test('W16: a limit from 1 to 200 caps the page; 0 or 201 is refused naming limit', () => {
  const { a, k } = main();
  const three = ok(a, 'limit-3');
  assert(show(three.nodes.map(placed)) === show(want(k, BOTH).slice(0, 3)) && typeof three.cursor === 'string', `limit 3: the first 3, nearest first, and a cursor; got ${show(describe(k, three.nodes))}`);
  assert(three.kept === 7, `and the count is the whole walk's, 7; got ${show(three.kept)}`);
  refused(a, 'limit-0', 400, 'invalid-input', 'limit');
  refused(a, 'limit-201', 400, 'invalid-input', 'limit');
});

test('W17: a node added or taken out between two pages, changing no other node\'s steps, makes no other appear twice or go missing', () => {
  needDecl();
  const seed = seedWalk();
  const file = fileOf(seed);
  const k = seed.keys;
  const walk = (cursor) => get('page', 'owner', { from: k.bulkHub, direction: 'out', depth: 2, limit: 40, ...(cursor ? { cursor } : {}) });
  const p1 = ok(runOver(file, [walk(null)]), 'page');
  const order = inOrder([...seed.links.map((n) => [1, k[n]]), ...seed.leaves.map((n) => [2, k[n]])]);
  assert(show(p1.nodes.map(placed)) === show(order.slice(0, 40)), 'page 1: the first 40 links, by key');
  // Between the pages: two leaves are added under link1, one sorting first among the leaves and one last, and one
  // leaf not yet answered loses its only way in. No other node's steps change.
  const st = S.readState(file);
  const node = (key) => st.nodes.find((n) => n.props.tapestryKey === key);
  const goneLeaf = order[order.length - 5];
  const goneParent = st.rels.find((r) => r.to === node(goneLeaf[1]).eid);
  st.rels = st.rels.filter((r) => r !== goneParent);
  const make = (key, name) => { const n = { eid: st.nextEid++, labels: ['ListItem', 'TapestryNode'], props: { tapestryKey: key, name, pubkey: TA } }; st.nodes.push(n); st.rels.push({ eid: st.nextEid++, type: 'LINKS', from: node(k.link1).eid, to: n.eid, props: {} }); return key; };
  const first = make('00000000-0000-4000-8000-000000000000', 'sorts first');
  const last = make('ffffffff-ffff-4fff-bfff-ffffffffffff', 'sorts last');
  writeState(file, st);
  const rest = [];
  let cursor = p1.cursor;
  for (let i = 0; cursor && i < 8; i++) {
    const p = ok(runOver(file, [walk(cursor)]), 'page');
    rest.push(...p.nodes.map(placed));
    cursor = p.cursor;
  }
  assert(cursor === null, 'the pages end with a null cursor');
  const answered = [...p1.nodes.map(placed), ...rest].map((x) => show(x));
  assert(new Set(answered).size === answered.length, 'no node is answered twice');
  for (const x of order) {
    if (show(x) === show(goneLeaf)) continue;
    assert(answered.filter((y) => y === show(x)).length === 1, `a node there throughout, at the same steps, is answered exactly once; ${show(x)} was answered ${answered.filter((y) => y === show(x)).length} times`);
  }
  assert(!rest.some((x) => x[1] === goneLeaf[1]), 'a leaf that lost its only way in before its page is not answered');
  assert(rest.some((x) => x[1] === first && x[0] === 2) && rest.some((x) => x[1] === last && x[0] === 2), 'both leaves added after the cursor\'s place are answered, at two steps');
});

test('W18: a cursor this read didn\'t give, for the same start nodes, types, direction, depth and point of view, is refused invalid-cursor', () => {
  const { a, k, file } = main();
  const cursor = ok(a, 'limit-3').cursor; // from header, both, no types, depth 5, everyone
  assert(typeof cursor === 'string', 'limit 3 gave a cursor');
  const [read, scope, position] = opened(cursor);
  assert(read === READ && /^[0-9a-f]{16}$/.test(scope), `the cursor is [read, scope, position], as C1 makes one; got ${show([read, scope])}`);
  assert(Array.isArray(position) && position.length === 2 && Number.isInteger(position[0]) && typeof position[1] === 'string', `its position is [steps, tapestryKey] (ADR 0014 Decision 2); got ${show(position)}`);
  const base = { from: k.header, depth: 5, pov: 'everyone', limit: 3 };
  const tieCursor = ok(runOver(file, [get('tie-2', 'owner', { from: [k.tie2, k.tie1], depth: 2, pov: 'everyone', limit: 2 })]), 'tie-2').cursor;
  assert(typeof tieCursor === 'string', 'the tie walk, 2 a page, gave a cursor');
  const b = runOver(file, [
    get('same', 'owner', { ...base, cursor }),
    get('other-start', 'owner', { ...base, from: k.tie1, cursor }),
    get('other-types', 'owner', { ...base, types: 'CITES', cursor }),
    get('other-direction', 'owner', { ...base, direction: 'out', cursor }),
    get('other-depth', 'owner', { ...base, depth: 4, cursor }),
    get('other-pov', 'owner', { ...base, pov: 'owner', cursor }),
    get('garbage', 'owner', { ...base, cursor: 'garbage!!' }),
    get('list-relationships', 'owner', { ...base, cursor: sealed(['graph list-relationships', scope, ['out', 'CITES', k.superset, 'x']]) }),
    get('position-not-a-list', 'owner', { ...base, cursor: sealed([READ, scope, k.superset]) }),
    get('position-depth-0', 'owner', { ...base, cursor: sealed([READ, scope, [0, position[1]]]) }),
    get('position-past-depth', 'owner', { ...base, cursor: sealed([READ, scope, [6, position[1]]]) }),
    get('position-half', 'owner', { ...base, cursor: sealed([READ, scope, [1.5, position[1]]]) }),
    get('position-text', 'owner', { ...base, cursor: sealed([READ, scope, ['1', position[1]]]) }),
    get('position-key', 'owner', { ...base, cursor: sealed([READ, scope, [position[0], 'not-a-key']]) }),
    get('position-short', 'owner', { ...base, cursor: sealed([READ, scope, [position[0]]]) }),
    get('position-long', 'owner', { ...base, cursor: sealed([READ, scope, [...position, 'x']]) }),
    get('tie-order', 'owner', { from: [k.tie1, k.tie2], depth: 2, pov: 'everyone', limit: 2, cursor: tieCursor }),
    get('tie-given', 'owner', { from: [k.tie2, k.tie1], depth: 2, pov: 'everyone', limit: 2, cursor: tieCursor }),
  ]);
  const next = ok(b, 'same');
  assert(show(next.nodes.map(placed)) === show(want(k, BOTH).slice(3, 6)), `the cursor pages its own walk: the next 3; got ${show(describe(k, next.nodes))}`);
  for (const id of ['other-start', 'other-types', 'other-direction', 'other-depth', 'other-pov', 'garbage', 'list-relationships', 'position-not-a-list', 'position-depth-0', 'position-past-depth', 'position-half', 'position-text', 'position-key', 'position-short', 'position-long']) {
    refused(b, id, 400, 'invalid-cursor', 'cursor');
  }
  assert(show(ok(b, 'tie-order').nodes) === show(ok(b, 'tie-given').nodes), 'the same start nodes in another order share a walk, and its cursors');
});

test('W19: depth runs from 1 to 10, 1 by default; 0, 11 or text is refused naming depth', () => {
  const { a, k } = main();
  const ten = ok(a, 'chain-10');
  const chain = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`chain${i + 1}`, i + 1]));
  assert(show(ten.nodes.map(placed)) === show(want(k, chain)) && ten.depth === 10 && ten.finished === 10 && ten.complete === true, `depth 10 along the chain: chain1 to chain10, each a step further; got ${show(describe(k, ten.nodes))}`);
  assert(byName(k, ten, 'chain10').path.length === 10, 'chain10 comes with all 10 steps');
  const one = ok(a, 'chain-default');
  assert(show(one.nodes.map(placed)) === show(want(k, { chain1: 1 })) && one.depth === 1, `with no depth, one step; got ${show(describe(k, one.nodes))}`);
  for (const id of ['depth-0', 'depth-11', 'depth-text']) refused(a, id, 400, 'invalid-input', 'depth');
});

test('W20: the bound: a walk whose next step would read past 10,000 relationships answers the steps it finished and says it stopped short', () => {
  needDecl();
  const seed = seedBound({ leaves: BOUND });
  const k = seed.keys;
  const b = runOver(fileOf(seed), [
    get('short', 'owner', { from: k.boundHub, direction: 'out', depth: 2 }),
    get('whole', 'owner', { from: k.boundMid, direction: 'out', depth: 1 }),
  ]);
  const short = ok(b, 'short');
  assert(short.complete === false && short.finished === 1, `from boundHub: step 1 reads 1 and step 2 would read 10,000 more, past the bound, so the walk stops short after step 1; got ${show({ complete: short.complete, finished: short.finished })}`);
  assert(show(short.nodes.map(placed)) === show([[1, k.boundMid]]) && short.kept === 1 && short.leftOut === 0 && short.tagsLeftOut === 0 && short.cursor === null, `it answers the step it finished, and counts only it; got ${show({ nodes: short.nodes.length, kept: short.kept })}`);
  assert(short.depth === 2, 'and still says the depth it was asked for');
  const whole = ok(b, 'whole');
  assert(whole.complete === true && whole.finished === 1 && whole.kept === BOUND, `from boundMid, one step reads exactly 10,000: complete; got ${show({ complete: whole.complete, finished: whole.finished, kept: whole.kept })}`);
  assert(whole.nodes.length === 50 && typeof whole.cursor === 'string', `pages of 50 as ever; got ${whole.nodes.length}`);
});

test('W21: no from, one that isn\'t a key, more than 100, or one that names no node (a change entry is not one) is refused, naming from', () => {
  const { a } = main();
  for (const id of ['no-from', 'no-from-paged']) refused(a, id, 400, 'missing-input', 'from');
  for (const id of ['bad-from', 'bad-from-second', 'from-101']) refused(a, id, 400, 'invalid-input', 'from');
  const one = refused(a, 'unknown-from', 404, 'unknown-node', 'from');
  assert(one.error.includes(UNKNOWN), `the refusal names the key that names no node; got ${show(one.error)}`);
  const two = refused(a, 'unknown-from-two', 404, 'unknown-node', 'from');
  const { k } = main();
  assert(two.error.includes('0a0a0a0a-0000-4000-8000-00000000aaaa') && two.error.includes('0b0b0b0b-0000-4000-8000-00000000bbbb') && !two.error.includes(k.header), `the refusal names each key that names no node, and not the one that does; got ${show(two.error)}`);
  refused(a, 'entry', 404, 'unknown-node', 'from');
});

test('W22: a malformed type, more than 50 types, a malformed direction and an input it doesn\'t take are refused, naming them', () => {
  const { a } = main();
  for (const id of ['bad-type-space', 'bad-type-digit', 'bad-type-dash', 'bad-type-tick', 'bad-type-second', 'types-51']) refused(a, id, 400, 'invalid-input', 'types');
  const fifty = ok(a, 'types-50');
  assert(fifty.nodes.length === 0 && fifty.types.length === 50, `50 types are taken, though no relationship has them; got ${show({ nodes: fifty.nodes.length, types: fifty.types && fifty.types.length })}`);
  for (const id of ['bad-direction', 'bad-direction-case']) refused(a, id, 400, 'invalid-input', 'direction');
  refused(a, 'unknown-input', 400, 'unknown-input', 'foo');
});

test('W23: a visitor gets 401 and a stranger 403; an admin walks what the owner walks', () => {
  const { a } = main();
  needDecl();
  assert(a.req('visitor').status === 401 && a.req('stranger').status === 403, `a visitor 401, a stranger 403; got ${a.req('visitor').status}, ${a.req('stranger').status}`);
  assert(show(ok(a, 'admin-same')) === show(ok(a, 'owner-same')), 'an admin walks exactly what the owner walks, from the owner\'s point of view');
});

test('W24: it writes nothing: it only reads, the graph is as it was, and no change entry is recorded', () => {
  const { a, file, before } = main();
  ok(a, 'both');
  ok(a, 'pov-owner');
  const after = S.readState(file);
  const log = after.log.slice(before.log.length);
  assert(log.length > 0 && log.every((e) => e.call === 'read'), `graph walk opens no write transaction; the log: ${show(log.filter((e) => e.call !== 'read').slice(0, 5))}`);
  assert(after.nodes.length === before.nodes.length && after.rels.length === before.rels.length, 'the graph has the same nodes and relationships');
  assert(S.entriesOf(after).length === S.entriesOf(before).length, 'no change entry was recorded');
});

test('W25: the command answers what the route answers, refusals included; a repeated flag makes a list', () => {
  const { a, k } = main();
  needDecl();
  for (const [c, r, code] of [['cli-tie', 'route-tie', 0], ['cli-thread', 'route-thread', 0], ['cli-refusal', 'route-refusal', 1]]) {
    const cmd = a.cmd(c);
    assert(cmd.code === code, `${c} exits ${code}; got ${cmd.code} ${String(cmd.stderr).slice(-300)}`);
    let body = null;
    try { body = JSON.parse(cmd.stdout); } catch { /* reported below */ }
    assert(body && show(body) === show(a.req(r).body), `${c} prints what ${r} answers; command ${show(body).slice(0, 300)}, route ${show(a.req(r).body).slice(0, 300)}`);
  }
  const tie = ok(a, 'route-tie');
  assert(show(tie.from.map((n) => n.tapestryKey)) === show([k.tie2, k.tie1]), `--from twice walks from both; got ${show(tie.from)}`);
  assert(show(ok(a, 'route-thread').types) === show([...THREAD_TYPES].sort()), '--types three times walks by the three');
});

test('W26: it is listed for an admin with its inputs and refusals, and has its /docs entry, with from and types as lists', () => {
  const { a } = main();
  needDecl();
  const list = a.req('list');
  const e = ((list.body.data && list.body.data.operations) || []).find((o) => o.group === 'graph' && o.name === 'walk');
  assert(e, `graph walk is listed for an admin; problems: ${show(list.body.data && list.body.data.problems)}`);
  assert(e.kind === 'read' && e.method === 'GET' && e.access === 'owner-and-admins' && e.route === ROUTE && e.command === 'tapestry graph walk', `a GET read for the owner and admins; got ${show({ kind: e.kind, method: e.method, access: e.access, route: e.route, command: e.command })}`);
  assert(show(Object.keys(e.inputs).sort()) === show(INPUTS), `its inputs: from, types, direction, depth, pov, limit and cursor; got ${show(Object.keys(e.inputs))}`);
  const codes = e.refusals.map((x) => `${x.code}:${x.status}`);
  for (const c of ['unknown-node:404', 'unknown-pov:400', 'invalid-cursor:400', 'missing-input:400', 'unknown-input:400', 'invalid-input:400', 'sign-in-required:401', 'not-allowed:403']) {
    assert(codes.includes(c), `its refusals include ${c}; got ${show(codes)}`);
  }
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    const params = p && p.get ? (p.get.parameters || []) : [];
    const typeOf = (n) => { const x = params.find((y) => y.name === n); return x && x.schema ? x.schema.type : null; };
    process.stdout.write('RESULT:' + JSON.stringify({ methods: p ? Object.keys(p) : null, names: params.map((x) => x.name).sort(), from: typeOf('from'), types: typeOf('types') }));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('walk-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  const docs = line ? JSON.parse(line) : null;
  assert(docs && show(docs.methods) === show(['get']), `/docs has GET ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
  assert(show(docs.names) === show(INPUTS), `/docs gives its seven query parameters; got ${show(docs.names)}`);
  assert(docs.from === 'array' && docs.types === 'array', `/docs gives from and types as lists; got ${show({ from: docs.from, types: docs.types })}`);
});

test('W27: the engine, src/operations/walk.js, called from code with the same inputs, gives what the route gives', () => {
  const { a, k, file } = main();
  needDecl();
  const child = spawnSync(process.execPath, ['-e', `
    const fs = require('fs');
    const W = require(${JSON.stringify(ENGINE)});
    const R = require(${JSON.stringify(READS)});
    const { readerOver } = require(${JSON.stringify(path.join(ROOT, 'test/helpers/graphFake.js'))});
    const read = readerOver(JSON.parse(fs.readFileSync(${JSON.stringify(file)}, 'utf8')));
    const k = ${JSON.stringify(k)};
    (async () => {
      const everyone = await R.resolvePov(read, 'everyone');
      const owner = await R.resolvePov(read, 'owner');
      const cases = {
        thread: { from: [k.header], types: ${JSON.stringify([...THREAD_TYPES].sort())}, direction: 'out', depth: 5, pov: everyone },
        tie: { from: [k.tie2, k.tie1], types: null, direction: 'both', depth: 2, pov: everyone },
        pov: { from: [k.pov0], types: null, direction: 'out', depth: 2, pov: owner },
      };
      const out = {};
      for (const [name, opts] of Object.entries(cases)) {
        const w = await W.walk(read, opts);
        out[name] = {
          from: w.from, kept: w.kept, leftOut: w.leftOut, tagsLeftOut: w.tagsLeftOut, complete: w.complete, finished: w.finished,
          nodes: w.reached.map((n) => ({ ...n, path: w.pathOf(n.tapestryKey) })),
        };
      }
      process.stdout.write('RESULT:' + JSON.stringify(out));
    })().catch((e) => { process.stdout.write('RESULT:' + JSON.stringify({ crash: String((e && e.stack) || e) })); });
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('walk-engine-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  const x = line ? JSON.parse(line) : null;
  assert(x && !x.crash, `the engine runs from code; ${x ? x.crash : (child.stderr || '').slice(-400)}`);
  const sorted = (o) => (Array.isArray(o) ? o.map(sorted) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((key) => [key, sorted(o[key])])) : o);
  for (const [name, id] of [['thread', 'thread-5'], ['tie', 'tie'], ['pov', 'pov-owner']]) {
    const route = ok(a, id);
    const engine = x[name];
    for (const f of ['from', 'kept', 'leftOut', 'tagsLeftOut', 'complete', 'finished']) {
      assert(show(sorted(engine[f])) === show(sorted(route[f])), `${name}: the engine's ${f} is the route's; engine ${show(engine[f])}, route ${show(route[f])}`);
    }
    assert(show(sorted(engine.nodes)) === show(sorted(route.nodes)), `${name}: the engine reaches the route's nodes, in its order, on its paths; engine ${show(engine.nodes.map((n) => n.tapestryKey))}, route ${show(route.nodes.map((n) => n.tapestryKey))}`);
  }
});

test('W28: 100 start nodes, sent as 100 repeated keys through the route\'s own query parser, are walked from', () => {
  const { a, k, seed, hundred } = main();
  const d = ok(a, 'hundred');
  assert(hundred.length === 100 && d.from.length === 100 && show(d.from.map((n) => n.tapestryKey)) === show(hundred), `all 100 start nodes, in the order given; got ${d.from.length}`);
  const expected = Object.fromEntries(seed.leaves.slice(39).map((n) => [n, 1]));
  assert(show(d.nodes.map(placed)) === show(want(k, expected)), `one step out reaches the 21 leaves that aren't starts; got ${show(describe(k, d.nodes))}`);
});

test('W29: one step both ways with no types meets the nodes list-relationships lists for the same node, the node itself aside', () => {
  const { a, k } = main();
  needDecl();
  for (const [walk, lr, name] of [['cross-header', 'lr-header', 'header'], ['cross-tie1', 'lr-tie1', 'tie1']]) {
    const w = ok(a, walk);
    const l = a.req(lr);
    assert(l.status === 200 && l.body.data && Array.isArray(l.body.data.relationships), `list-relationships lists ${name}'s; got ${l.status}`);
    const others = [...new Set(l.body.data.relationships.map((r) => r.node.tapestryKey).filter((x) => x !== k[name]))].sort();
    assert(show(w.nodes.map((n) => n.tapestryKey).sort()) === show(others), `${name}: the walk's nodes are the other ends list-relationships lists, each once; walk ${show(describe(k, w.nodes))}, list ${show(others.map(named(k)))}`);
    assert(w.nodes.every((n) => n.depth === 1), `${name}: all one step away`);
  }
});

test('W30: its inputs and answer are walk.js\'s and reads.js\'s, and the catalog says how a walk is answered and paged', () => {
  needDecl();
  const child = spawnSync(process.execPath, ['-e', `
    const W = require(${JSON.stringify(ENGINE)});
    const R = require(${JSON.stringify(READS)});
    const N = require(${JSON.stringify(NODES)});
    const d = require(${JSON.stringify(DECL)});
    const pick = (r) => r && { code: r.code, status: r.status };
    const props = (d.result && d.result.schema && d.result.schema.properties) || {};
    const schemaOf = (x) => x && x.schema;
    process.stdout.write('RESULT:' + JSON.stringify({
      own: ['from', 'types', 'direction', 'depth'].map((n) => [n, schemaOf(d.inputs[n]), schemaOf(W[n.toUpperCase() + '_INPUT'])]),
      shared: ['limit', 'cursor', 'pov'].map((n) => [n, schemaOf(d.inputs[n]), schemaOf(R[n.toUpperCase() + '_INPUT'])]),
      fromRequired: d.inputs.from && d.inputs.from.required,
      keyPattern: N.KEY_PATTERN, typePattern: N.TYPE_PATTERN,
      refusals: (d.refusals || []).map(pick),
      unknownNode: pick(W.UNKNOWN_NODE), invalidCursor: pick(R.INVALID_CURSOR), unknownPov: pick(R.UNKNOWN_POV),
      from: [props.from && props.from.items, R.NODE],
      nodes: [props.nodes && props.nodes.items, W.REACHED || null],
      povSchema: [props.pov, R.POV],
      types: { counts: ['kept', 'leftOut', 'tagsLeftOut', 'finished'].map((c) => props[c] && props[c].type), complete: props.complete && props.complete.type },
      required: d.result && d.result.schema && d.result.schema.required,
    }));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('walk-once-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  const x = line ? JSON.parse(line) : null;
  assert(x, `the declaration, walk.js and reads.js load; ${(child.stderr || '').slice(-400)}`);
  for (const [n, mine, theirs] of x.own) assert(theirs && show(mine) === show(theirs), `its ${n} input is walk.js's; got ${show([mine, theirs])}`);
  for (const [n, mine, theirs] of x.shared) assert(theirs && show(mine) === show(theirs), `its ${n} input is reads.js's; got ${show([mine, theirs])}`);
  assert(x.fromRequired === true, `from is required; got ${show(x.fromRequired)}`);
  const [, from] = x.own[0];
  assert(from && from.type === 'array' && from.items && from.items.pattern === x.keyPattern && from.minItems === 1 && from.maxItems === 100, `from is a list of 1 to 100 tapestryKeys; got ${show(from)}`);
  const [, types] = x.own[1];
  assert(types && types.type === 'array' && types.items && types.items.pattern === x.typePattern && types.minItems === 1 && types.maxItems === 50, `types is a list of 1 to 50 type names; got ${show(types)}`);
  const [, direction] = x.own[2];
  assert(direction && show([...direction.enum].sort()) === show(['both', 'in', 'out']) && direction.default === 'both', `direction takes out, in or both, both by default; got ${show(direction)}`);
  const [, depth] = x.own[3];
  assert(depth && depth.type === 'integer' && depth.minimum === 1 && depth.maximum === 10 && depth.default === 1, `depth is a whole number from 1 to 10, 1 by default; got ${show(depth)}`);
  for (const r of [x.unknownNode, x.invalidCursor, x.unknownPov]) assert(r && x.refusals.some((y) => y.code === r.code && y.status === r.status), `it declares ${show(r)}; got ${show(x.refusals)}`);
  assert(x.unknownNode && x.unknownNode.code === 'unknown-node' && x.unknownNode.status === 404, `walk.js's UNKNOWN_NODE is unknown-node, 404; got ${show(x.unknownNode)}`);
  assert(x.from[1] && show(x.from[0]) === show(x.from[1]), `the start nodes are answered as reads.js's NODE; got ${show(x.from[0])}`);
  assert(x.nodes[1] && show(x.nodes[0]) === show(x.nodes[1]), `the nodes reached are walk.js's REACHED; got ${show(x.nodes[0])}`);
  assert(x.povSchema[1] && show(x.povSchema[0]) === show(x.povSchema[1]), `its pov is reads.js's POV; got ${show(x.povSchema)}`);
  assert(show(x.types.counts) === show(['integer', 'integer', 'integer', 'integer']) && x.types.complete === 'boolean', `kept, leftOut, tagsLeftOut and finished are integers, complete true or false; got ${show(x.types)}`);
  assert(x.required && show([...x.required].sort()) === show(ANSWER_KEYS), `the answer requires every field it gives; got ${show(x.required)}`);
  const text = fs.readFileSync(CATALOG, 'utf8');
  const conventions = (text.split(/\n## Conventions\n/)[1] || '').split(/\n## /)[0];
  const paging = conventions.split('\n').find((l) => /\*\*Paging\.\*\*/.test(l)) || '';
  assert(/walk/.test(paging) && /0014/.test(paging) && /nearest/i.test(paging), `the Conventions' Paging bullet names a walk's order, nearest first (ADR 0014); got ${show(paging)}`);
  const row = text.split('\n').find((l) => l.startsWith('| `walk` |')) || '';
  for (const word of ['path', 'complete', 'finished', 'kept', 'leftOut', 'tagsLeftOut', 'cursor']) assert(row.includes(word), `§1's walk row gives the answer as built, mentioning ${word}; got ${show(row)}`);
  const reads = (text.split(/\n## 1\. Graph reads\n/)[1] || '').split(/\n## /)[0];
  assert(reads.includes('src/operations/walk.js'), '§1 says search calls walk\'s engine, src/operations/walk.js');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
