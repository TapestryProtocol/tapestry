'use strict';
/**
 * graph list-elements — its own suite (ADR graph-operations-foundation/0001 Decision 12), run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/11-list-elements.md (AC1–AC7)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0011-list-elements-and-the-read-conventions.md
 *
 * Stack-free: every request goes through test/helpers/operationsHarness.js, over a graph test/helpers/elementsGraph.js
 * seeds for test/helpers/graphFake.js. A page's cursor is read from one harness run and sent in the next, over the
 * same graph, and the graph is changed between runs where a test says so. Only what the story and the ADR pin is
 * checked: which elements come back, in what order, with which facts, and what is refused; how the read finds them is
 * the Implementer's.
 *
 *   LE1  a concept's elements: every node its class thread reaches, each once, and nothing else
 *   LE2  a set's elements: its own and those of the sets below it; a superset as `set` lists its concept
 *   LE3  direct lists only what hangs directly under the superset or the set
 *   LE4  a class link brings another concept's elements in; a concept the import brought in lists like any other
 *   LE5  a concept with no elements, or no superset, answers an empty list
 *   LE6  the answer names what it listed and the point of view it read from
 *   LE7  each element is { tapestryKey, name, address, author, own }, and nothing more
 *   LE8  pages of 50 by default, in tapestryKey order, and the cursors page through every element exactly once
 *   LE9  a limit from 1 to 200 caps the page; 0 or 201 is refused naming limit
 *   LE10 an element added or taken out between two pages moves no other element
 *   LE11 a cursor this read didn't give, for this same list, is refused invalid-cursor
 *   LE12 the owner's point of view, by default: the instance's own and those scored above the cutoff count
 *   LE13 kept and leftOut count the whole list, not the page
 *   LE14 everyone keeps every author's claims
 *   LE15 nothing about a point of view is stored: new scores answer differently, with no write between
 *   LE16 before the owner's scores exist, only the instance's own count, and the answer says so
 *   LE17 the cutoff is the instance's VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF
 *   LE18 a pov the instance can't read from is refused unknown-pov; a malformed one invalid-input
 *   LE19 neither or both of concept and set is refused concept-or-set
 *   LE20 a key that names no node is refused unknown-node, naming the input
 *   LE21 the wrong kind of node is refused, saying which input to pass it as
 *   LE22 malformed and unknown inputs are refused, naming them
 *   LE23 a visitor gets 401 and a stranger 403; an admin reads what the owner reads
 *   LE24 it writes nothing: reads only, the graph as it was, no change entry
 *   LE25 the command answers what the route answers, refusals included
 *   LE26 it is listed for an admin, with its inputs and refusals, and has its /docs entry
 *   LE27 its paging, point of view and node shape are reads.js's, and the catalog's Conventions say so
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const { writeState } = require('../../helpers/graphFake');
const { seedElements, DOG, PEERS } = require('../../helpers/elementsGraph');

const { ROOT, OWNER, ADMIN, TA, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph list-elements');

const ROUTE = '/api/tapestry/graph/list-elements';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/list-elements.js');
const READS = path.join(ROOT, 'src/operations/reads.js');
const CATALOG = path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md');
const NODE_KEYS = ['address', 'author', 'name', 'own', 'tapestryKey'];
const POV_KEYS = ['cutoff', 'name', 'observer', 'scored'];

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/list-elements.js does not exist yet (ADR graph-operations-first-slice/0011 Decision 2)');
}

const q = (params) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.set(k, String(v));
  const text = u.toString();
  return text ? `${ROUTE}?${text}` : ROUTE;
};
const get = (id, caller, params = {}) => ({ id, method: 'GET', url: q(params), caller });
/** One harness run of `requests` (and `cli`) over the graph in `file`. */
const runOver = (file, requests, cli = [], opts = {}) => S.answered(S.runHarness({ scenarios: [{ graphFake: { stateFile: file }, requests, cli }] }, { dir: tmp('list-elements-run-'), ...opts }));
/** A fresh copy of a seed's graph, in a file of its own. */
const fileOf = (seed) => seed.file(tmp('list-elements-graph-'));

function ok(a, id) {
  needDecl();
  const x = a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body)}`);
  assert(x.body && x.body.data && Array.isArray(x.body.data.elements), `${id} answers { elements, … }; got ${show(x.body && x.body.data)}`);
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
const keysOf = (elements) => elements.map((e) => e.tapestryKey);
const sorted = (list) => [...list].sort();

// ── the main run: one seeded graph, most of the requests ──
let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  const seed = seedElements();
  const file = fileOf(seed);
  const k = seed.keys;
  const before = S.readState(file);
  const everyone = { pov: 'everyone', limit: 200 };
  const a = runOver(file, [
    get('dog', 'owner', { concept: k.H, ...everyone }),
    get('walkers', 'owner', { set: k.W, ...everyone }),
    get('superset', 'owner', { set: k.S, ...everyone }),
    get('dog-direct', 'owner', { concept: k.H, direct: true, ...everyone }),
    get('walkers-direct', 'owner', { set: k.W, direct: true, ...everyone }),
    get('superset-direct', 'owner', { set: k.S, direct: true, ...everyone }),
    get('mammal', 'owner', { concept: k.MH, ...everyone }),
    get('cat', 'owner', { concept: k.CH, ...everyone }),
    get('empty', 'owner', { concept: k.EH }),
    get('bare', 'owner', { concept: k.BRH }),
    get('bulk-1', 'owner', { concept: k.BH }),
    get('limit-3', 'owner', { concept: k.H, pov: 'everyone', limit: 3 }),
    get('limit-200', 'owner', { concept: k.BH, limit: 200 }),
    get('limit-0', 'owner', { concept: k.H, limit: 0 }),
    get('limit-201', 'owner', { concept: k.H, limit: 201 }),
    get('owner', 'owner', { concept: k.H, limit: 200 }),
    get('owner-named', 'owner', { concept: k.H, pov: 'owner', limit: 200 }),
    get('owner-pubkey', 'owner', { concept: k.H, pov: OWNER, limit: 200 }),
    get('owner-limit-2', 'owner', { concept: k.H, limit: 2 }),
    get('walkers-owner', 'owner', { set: k.W, limit: 200 }),
    get('pov-stranger', 'owner', { concept: k.H, pov: PEERS.stranger }),
    get('pov-admin', 'owner', { concept: k.H, pov: ADMIN }),
    get('pov-house', 'owner', { concept: k.H, pov: 'house' }),
    get('neither', 'owner', {}),
    get('neither-paged', 'owner', { limit: 5, pov: 'everyone' }),
    get('both', 'owner', { concept: k.H, set: k.W }),
    get('unknown-concept', 'owner', { concept: crypto.randomUUID() }),
    get('unknown-set', 'owner', { set: crypto.randomUUID() }),
    get('entry-as-concept', 'owner', { concept: k.G }),
    get('set-as-concept', 'owner', { concept: k.W }),
    get('superset-as-concept', 'owner', { concept: k.S }),
    get('element-as-concept', 'owner', { concept: k.rover }),
    get('header-as-set', 'owner', { set: k.H }),
    get('element-as-set', 'owner', { set: k.rover }),
    get('bad-key', 'owner', { concept: 'not-a-key' }),
    get('bad-set-key', 'owner', { set: 'not-a-key' }),
    get('bad-direct', 'owner', { concept: k.H, direct: 'maybe' }),
    get('unknown-input', 'owner', { concept: k.H, foo: '1' }),
    get('visitor', 'visitor', { concept: k.H }),
    get('stranger', 'stranger', { concept: k.H }),
    get('admin', 'admin', { concept: k.H, limit: 200 }),
    get('route-5', 'owner', { concept: k.H, limit: 5 }),
    get('route-refusal', 'owner', { concept: k.W }),
    get('route-direct', 'owner', { concept: k.H, direct: true, pov: 'everyone' }),
    { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
  ], [
    { id: 'cli-5', argv: ['graph', 'list-elements', '--concept', k.H, '--limit', '5'] },
    { id: 'cli-refusal', argv: ['graph', 'list-elements', '--concept', k.W] },
    { id: 'cli-direct', argv: ['graph', 'list-elements', '--concept', k.H, '--direct', '--pov', 'everyone'] },
  ]);
  MAIN = { a, seed, k, file, before };
  return MAIN;
}

test('LE1: a concept\'s elements are every node its class thread reaches, each once, and nothing else', () => {
  const { a, seed } = main();
  const dog = ok(a, 'dog');
  const got = keysOf(dog.elements);
  assert(new Set(got).size === got.length, `each element once, however many paths reach it (bella hangs on the superset and on walkers); got ${got.length} keys, ${new Set(got).size} distinct`);
  assert(show(sorted(got)) === show(seed.names(DOG.all)), `dog's elements: the superset's, walkers' and puppies' (a set two levels down), and no other; got ${show(dog.elements.map((e) => e.name))}`);
  for (const not of ['stray', 'loner', 'G', 'W', 'P', 'S', 'H']) assert(!got.includes(seed.keys[not]), `${not} is not one of dog's elements (an implicit member, a node of no concept, a change entry, a set, the superset, the header)`);
  assert(!dog.elements.some((e) => e.address === seed.uuids.nokey), 'a node with no tapestryKey is never listed');
  assert(dog.cursor === null, `all of them fit one page of 200, so the cursor is null; got ${show(dog.cursor)}`);
});

test('LE2: a set\'s elements are its own and those of the sets below it; a superset given as set lists its concept', () => {
  const { a, seed } = main();
  const walkers = ok(a, 'walkers');
  assert(show(sorted(keysOf(walkers.elements))) === show(seed.names(DOG.walkers)), `walkers: its own elements and puppies'; got ${show(walkers.elements.map((e) => e.name))}`);
  const superset = ok(a, 'superset');
  assert(show(sorted(keysOf(superset.elements))) === show(seed.names(DOG.all)), `dog's superset as set: every element of dog; got ${show(superset.elements.map((e) => e.name))}`);
});

test('LE3: direct lists only the elements directly under the superset or the set', () => {
  const { a, seed } = main();
  const dogDirect = ok(a, 'dog-direct');
  assert(show(sorted(keysOf(dogDirect.elements))) === show(seed.names(DOG.direct)), `dog, direct: the superset's own elements only; got ${show(dogDirect.elements.map((e) => e.name))}`);
  const walkersDirect = ok(a, 'walkers-direct');
  assert(show(sorted(keysOf(walkersDirect.elements))) === show(seed.names(DOG.walkersDirect)), `walkers, direct: not puppies'; got ${show(walkersDirect.elements.map((e) => e.name))}`);
  const supersetDirect = ok(a, 'superset-direct');
  assert(show(sorted(keysOf(supersetDirect.elements))) === show(seed.names(DOG.direct)), `the superset as set, direct: the same as the concept, direct; got ${show(supersetDirect.elements.map((e) => e.name))}`);
  assert(dogDirect.direct === true && ok(a, 'dog').direct === false, `the answer says whether it was direct; got ${show([dogDirect.direct, ok(a, 'dog').direct])}`);
});

test('LE4: a class link brings another concept\'s elements in; a concept the import brought in lists like any other', () => {
  const { a, seed } = main();
  const mammal = ok(a, 'mammal');
  assert(show(sorted(keysOf(mammal.elements))) === show(seed.names([...DOG.all, 'whale'])), `mammal: whale, and every element of dog, whose superset is under mammal's; got ${show(mammal.elements.map((e) => e.name))}`);
  const cat = ok(a, 'cat');
  assert(show(keysOf(cat.elements)) === show(seed.names(['tom'])), `cat, labelled ListHeader only: its element tom; got ${show(cat.elements)}`);
});

test('LE5: a concept with no elements, or no superset at all, answers an empty list', () => {
  const { a } = main();
  for (const id of ['empty', 'bare']) {
    const d = ok(a, id);
    assert(d.elements.length === 0 && d.cursor === null && d.kept === 0 && d.leftOut === 0, `${id}: no elements, a null cursor, nothing kept or left out; got ${show(d)}`);
  }
});

test('LE6: the answer names the concept or set it listed, and the point of view it read from', () => {
  const { a, k } = main();
  const dog = ok(a, 'dog');
  assert(dog.concept === k.H && dog.set === null, `a concept's listing names it, and set is null; got ${show({ concept: dog.concept, set: dog.set })}`);
  const walkers = ok(a, 'walkers');
  assert(walkers.set === k.W && walkers.concept === null, `a set's listing names it, and concept is null; got ${show({ concept: walkers.concept, set: walkers.set })}`);
  for (const id of ['dog', 'owner']) {
    const d = ok(a, id);
    assert(d.pov && show(Object.keys(d.pov).sort()) === show(POV_KEYS), `${id}: pov is { name, observer, cutoff, scored }; got ${show(d.pov)}`);
  }
});

test('LE7: each element is { tapestryKey, name, address, author, own }, and nothing more', () => {
  const { a, seed } = main();
  const dog = ok(a, 'dog');
  for (const e of dog.elements) assert(show(Object.keys(e).sort()) === show(NODE_KEYS), `an element has exactly the five facts; got ${show(e)}`);
  const by = (name) => dog.elements.find((e) => e.tapestryKey === seed.keys[name]);
  const rover = by('rover');
  assert(rover && rover.name === 'rover' && rover.address === seed.uuids.rover && rover.author === TA && rover.own === true, `rover: its name, its address, the assistant as author, the instance's own; got ${show(rover)}`);
  const spot = by('spot');
  assert(spot && spot.author === OWNER && spot.own === true, `spot: the owner's, and the instance's own; got ${show(spot)}`);
  const ada = by('ada');
  assert(ada && ada.author === null && ada.address === null && ada.own === true, `ada: no author and no address, made here, so the instance's own; got ${show(ada)}`);
  const hi = by('hi');
  assert(hi && hi.author === PEERS.hi && hi.own === false, `hi: a peer's, not the instance's own; got ${show(hi)}`);
  const admin = by('admin');
  assert(admin && admin.author === ADMIN && admin.own === false, `admin: an admin's is not the instance's own; got ${show(admin)}`);
  const named = by('named');
  assert(named && named.name === 'Named Dog', `named: its name is its tapestryValue, before its name property; got ${show(named)}`);
  const unnamed = by('unnamed');
  assert(unnamed && unnamed.name === null, `unnamed: with neither, its name is null; got ${show(unnamed)}`);
});

test('LE8: pages of 50 by default, in tapestryKey order, and the cursors page through every element exactly once', () => {
  const { a, seed, file } = main();
  const p1 = ok(a, 'bulk-1');
  assert(p1.elements.length === 50 && typeof p1.cursor === 'string' && p1.cursor.length > 0, `page 1: 50 elements and a cursor; got ${p1.elements.length} and ${show(p1.cursor)}`);
  const p2 = ok(runOver(file, [get('bulk-2', 'owner', { concept: seed.keys.BH, cursor: p1.cursor })]), 'bulk-2');
  assert(p2.elements.length === 50 && typeof p2.cursor === 'string', `page 2: 50 more and a cursor; got ${p2.elements.length} and ${show(p2.cursor)}`);
  const p3 = ok(runOver(file, [get('bulk-3', 'owner', { concept: seed.keys.BH, cursor: p2.cursor })]), 'bulk-3');
  assert(p3.elements.length === 20 && p3.cursor === null, `page 3: the last 20, and a null cursor; got ${p3.elements.length} and ${show(p3.cursor)}`);
  const all = [...keysOf(p1.elements), ...keysOf(p2.elements), ...keysOf(p3.elements)];
  assert(show(all) === show(seed.names(seed.bulkNames)), 'the three pages hold every element of bulk exactly once, in ascending tapestryKey order');
});

test('LE9: a limit from 1 to 200 caps the page; 0 or 201 is refused naming limit', () => {
  const { a, seed } = main();
  const three = ok(a, 'limit-3');
  assert(show(keysOf(three.elements)) === show(seed.names(DOG.all).slice(0, 3)) && typeof three.cursor === 'string', `limit 3: the first 3 in tapestryKey order, and a cursor; got ${show(three.elements.map((e) => e.name))}`);
  const max = ok(a, 'limit-200');
  assert(max.elements.length === 120 && max.cursor === null, `limit 200: all 120 of bulk, and a null cursor; got ${max.elements.length}`);
  refused(a, 'limit-0', 400, 'invalid-input', 'limit');
  refused(a, 'limit-201', 400, 'invalid-input', 'limit');
});

test('LE10: an element added or taken out between two pages makes no other element appear twice or go missing', () => {
  needDecl();
  const seed = seedElements();
  const file = fileOf(seed);
  const k = seed.keys;
  const order = seed.names(seed.bulkNames);
  const p1 = ok(runOver(file, [get('p1', 'owner', { concept: k.BH, limit: 40 })]), 'p1');
  assert(show(keysOf(p1.elements)) === show(order.slice(0, 40)), 'page 1: the first 40 in tapestryKey order');
  // Between the pages: take out one element already answered and one not yet; add one that sorts first and one last.
  const st = S.readState(file);
  const eidOf = (key) => st.nodes.find((n) => n.props.tapestryKey === key).eid;
  const seenGone = order[10];
  const laterGone = order[90];
  for (const key of [seenGone, laterGone]) {
    const eid = eidOf(key);
    st.rels = st.rels.filter((r) => !(r.type === 'HAS_ELEMENT' && r.to === eid));
  }
  const bs = st.nodes.find((n) => n.props.tapestryKey === k.BS);
  const LOW = '00000000-0000-4000-8000-000000000000';
  const HIGH = 'ffffffff-ffff-4fff-bfff-ffffffffffff';
  for (const [key, name] of [[LOW, 'sorts first'], [HIGH, 'sorts last']]) {
    const n = { eid: st.nextEid++, labels: ['NostrEvent', 'ListItem', 'TapestryNode'], props: { tapestryKey: key, name, pubkey: TA } };
    st.nodes.push(n);
    st.rels.push({ eid: st.nextEid++, type: 'HAS_ELEMENT', from: bs.eid, to: n.eid, props: {} });
  }
  writeState(file, st);
  const rest = [];
  let cursor = p1.cursor;
  for (let i = 0; cursor && i < 5; i++) {
    const p = ok(runOver(file, [get('next', 'owner', { concept: k.BH, limit: 40, cursor })]), 'next');
    rest.push(...keysOf(p.elements));
    cursor = p.cursor;
  }
  assert(cursor === null, 'the pages end with a null cursor');
  const answered = [...keysOf(p1.elements), ...rest];
  assert(new Set(answered).size === answered.length, 'no element is answered twice');
  for (const key of order) {
    if (key === seenGone || key === laterGone) continue;
    assert(answered.filter((x) => x === key).length === 1, `an element there throughout is answered exactly once; ${key} was answered ${answered.filter((x) => x === key).length} times`);
  }
  assert(!rest.includes(laterGone), 'an element taken out before its page is not answered');
  assert(rest.includes(HIGH) && !answered.includes(LOW), 'an element added after the cursor is answered, and one added before it is not');
});

test('LE11: a cursor this read didn\'t give, for this same list, is refused invalid-cursor', () => {
  const { a, seed, file } = main();
  const k = seed.keys;
  const cursor = ok(a, 'limit-3').cursor; // dog, pov everyone, not direct
  assert(typeof cursor === 'string', 'limit 3 gave a cursor');
  const historys = Buffer.from(JSON.stringify(['2026-01-01T00:00:00.000Z', k.G])).toString('base64url');
  const b = runOver(file, [
    get('same-list', 'owner', { concept: k.H, pov: 'everyone', limit: 3, cursor }),
    get('other-concept', 'owner', { concept: k.BH, pov: 'everyone', limit: 3, cursor }),
    get('other-pov', 'owner', { concept: k.H, limit: 3, cursor }),
    get('other-direct', 'owner', { concept: k.H, pov: 'everyone', direct: true, limit: 3, cursor }),
    get('as-set', 'owner', { set: k.S, pov: 'everyone', limit: 3, cursor }),
    get('garbage', 'owner', { concept: k.H, cursor: 'garbage!!' }),
    get('historys', 'owner', { concept: k.H, cursor: historys }),
  ]);
  const next = ok(b, 'same-list');
  assert(show(keysOf(next.elements)) === show(seed.names(DOG.all).slice(3, 6)), `the cursor pages its own list: the next 3; got ${show(next.elements.map((e) => e.name))}`);
  for (const id of ['other-concept', 'other-pov', 'other-direct', 'as-set', 'garbage', 'historys']) refused(b, id, 400, 'invalid-cursor', 'cursor');
});

test('LE12: from the owner\'s point of view, by default: the instance\'s own, and authors scored above the cutoff, count', () => {
  const { a, seed } = main();
  const d = ok(a, 'owner');
  assert(show(sorted(keysOf(d.elements))) === show(seed.names(DOG.kept)), `the owner's point of view keeps the assistant's, the owner's, the author-less and hi (scored 0.2); got ${show(d.elements.map((e) => e.name))}`);
  for (const gone of DOG.leftOut) assert(!keysOf(d.elements).includes(seed.keys[gone]), `${gone} is left out: scored at or below the cutoff, unscored, or not in the web of trust (an admin counts by score)`);
  assert(d.kept === 8 && d.leftOut === 4, `kept 8, left out 4; got ${show({ kept: d.kept, leftOut: d.leftOut })}`);
  assert(show(d.pov) === show({ name: 'owner', observer: OWNER, cutoff: 0.05, scored: true }), `pov: the owner's, as observer, with the default cutoff and scores; got ${show(d.pov)}`);
  for (const id of ['owner-named', 'owner-pubkey']) {
    const x = ok(a, id);
    assert(show(x) === show(d), `${id}: pov=owner, and the owner's own pubkey, read exactly as the default; got ${show(x.pov)} ${x.kept}/${x.leftOut}`);
  }
  const walkers = ok(a, 'walkers-owner');
  assert(walkers.kept === 6 && walkers.leftOut === 2, `walkers from the owner's point of view: 6 kept, 2 left out (admin and nouser); got ${show({ kept: walkers.kept, leftOut: walkers.leftOut })}`);
});

test('LE13: kept and leftOut count the whole list, not the page', () => {
  const { a } = main();
  const d = ok(a, 'owner-limit-2');
  assert(d.elements.length === 2 && d.kept === 8 && d.leftOut === 4 && typeof d.cursor === 'string', `a page of 2 still says 8 kept and 4 left out; got ${show({ n: d.elements.length, kept: d.kept, leftOut: d.leftOut })}`);
  const bulk = ok(a, 'bulk-1');
  assert(bulk.elements.length === 50 && bulk.kept === 120 && bulk.leftOut === 0, `bulk's first page says 120 kept; got ${show({ n: bulk.elements.length, kept: bulk.kept, leftOut: bulk.leftOut })}`);
});

test('LE14: pov=everyone keeps every author\'s claims and leaves nothing out', () => {
  const { a } = main();
  const d = ok(a, 'dog');
  assert(d.elements.length === 12 && d.kept === 12 && d.leftOut === 0, `everyone: all 12, nothing left out; got ${show({ n: d.elements.length, kept: d.kept, leftOut: d.leftOut })}`);
  assert(show(d.pov) === show({ name: 'everyone', observer: null, cutoff: null, scored: null }), `pov: everyone's, with no observer, cutoff or scores; got ${show(d.pov)}`);
});

test('LE15: nothing about a point of view is stored: new scores answer differently, with no write between', () => {
  needDecl();
  const seed = seedElements();
  const file = fileOf(seed);
  const k = seed.keys;
  const first = ok(runOver(file, [get('before', 'owner', { concept: k.H, limit: 200 })]), 'before');
  assert(keysOf(first.elements).includes(k.hi) && !keysOf(first.elements).includes(k.lo), 'at first hi (0.2) counts and lo (0.01) does not');
  // GrapeRank writes new scores: hi falls to 0.01, lo rises to 0.3.
  const st = S.readState(file);
  for (const n of st.nodes) {
    if (!n.labels.includes('NostrUser')) continue;
    if (n.props.pubkey === PEERS.hi) n.props.influence = 0.01;
    if (n.props.pubkey === PEERS.lo) n.props.influence = 0.3;
  }
  const logLength = st.log.length;
  writeState(file, st);
  const second = ok(runOver(file, [get('after', 'owner', { concept: k.H, limit: 200 })]), 'after');
  assert(!keysOf(second.elements).includes(k.hi) && keysOf(second.elements).includes(k.lo), `after the new scores, lo counts and hi does not; got ${show(second.elements.map((e) => e.name))}`);
  assert(second.kept === 8 && second.leftOut === 4, `still 8 kept and 4 left out, a different 8; got ${show({ kept: second.kept, leftOut: second.leftOut })}`);
  const log = S.readState(file).log.slice(logLength);
  assert(log.length > 0 && log.every((e) => e.call === 'read'), `the read only reads; nothing is written for a point of view; the log: ${show(log)}`);
});

test('LE16: before the owner\'s scores exist, only the instance\'s own count, and the answer says the scores aren\'t there yet', () => {
  needDecl();
  const seed = seedElements({ unscored: true });
  const d = ok(runOver(fileOf(seed), [get('unscored', 'owner', { concept: seed.keys.H, limit: 200 })]), 'unscored');
  assert(show(sorted(keysOf(d.elements))) === show(seed.names(DOG.own)), `only the instance's own: hi is left out too; got ${show(d.elements.map((e) => e.name))}`);
  assert(d.kept === 7 && d.leftOut === 5, `kept 7, left out 5; got ${show({ kept: d.kept, leftOut: d.leftOut })}`);
  assert(d.pov && d.pov.name === 'owner' && d.pov.scored === false, `pov.scored is false: the owner's scores aren't there yet; got ${show(d.pov)}`);
});

test('LE17: the cutoff is the instance\'s VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF', () => {
  needDecl();
  const seed = seedElements();
  const dir = tmp('list-elements-cutoff-');
  const env = S.childEnv(dir);
  fs.writeFileSync(env.BRAINSTORM_CONF_PATH, [
    `export BRAINSTORM_OWNER_PUBKEY="${OWNER}"`,
    'export NEO4J_URI="bolt://127.0.0.1:9"',
    'export REDIS_HOST="127.0.0.1"',
    'export REDIS_PORT="9"',
    'export VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF="0.3"',
  ].join(NL) + NL);
  const d = ok(runOver(fileOf(seed), [get('cutoff', 'owner', { concept: seed.keys.H, limit: 200 })], [], { dir, env }), 'cutoff');
  assert(d.pov && d.pov.cutoff === 0.3, `pov.cutoff is the configured 0.3; got ${show(d.pov)}`);
  assert(!keysOf(d.elements).includes(seed.keys.hi) && d.kept === 7 && d.leftOut === 5, `at 0.3, hi (0.2) is left out too; got ${show({ kept: d.kept, leftOut: d.leftOut, names: d.elements.map((e) => e.name) })}`);
});

test('LE18: a pov the instance can\'t read from is refused unknown-pov, saying which it can; a malformed one invalid-input', () => {
  const { a } = main();
  for (const id of ['pov-stranger', 'pov-admin']) {
    const b = refused(a, id, 400, 'unknown-pov', 'pov');
    assert(/owner/.test(b.error) && /everyone/.test(b.error), `${id}: the refusal says it reads from the owner's point of view or everyone's; got ${show(b.error)}`);
  }
  refused(a, 'pov-house', 400, 'invalid-input', 'pov');
});

test('LE19: neither or both of concept and set is refused concept-or-set', () => {
  const { a } = main();
  for (const id of ['neither', 'neither-paged', 'both']) refused(a, id, 400, 'concept-or-set');
});

test('LE20: a key that names no node, or names a change entry, is refused unknown-node, naming the input', () => {
  const { a } = main();
  refused(a, 'unknown-concept', 404, 'unknown-node', 'concept');
  refused(a, 'unknown-set', 404, 'unknown-node', 'set');
  refused(a, 'entry-as-concept', 404, 'unknown-node', 'concept');
});

test('LE21: the wrong kind of node is refused, saying which input to pass it as', () => {
  const { a, k } = main();
  for (const id of ['set-as-concept', 'superset-as-concept']) {
    const b = refused(a, id, 409, 'not-a-concept', 'concept');
    assert(/\bset\b/.test(b.error), `${id}: the refusal says to pass it as set; got ${show(b.error)}`);
  }
  refused(a, 'element-as-concept', 409, 'not-a-concept', 'concept');
  const header = refused(a, 'header-as-set', 409, 'not-a-set', 'set');
  assert(/\bconcept\b/.test(header.error) && header.error.includes(k.S), `a header given as set: pass it as concept, or pass its superset ${k.S} as set; got ${show(header.error)}`);
  refused(a, 'element-as-set', 409, 'not-a-set', 'set');
});

test('LE22: malformed and unknown inputs are refused, naming them', () => {
  const { a } = main();
  refused(a, 'bad-key', 400, 'invalid-input', 'concept');
  refused(a, 'bad-set-key', 400, 'invalid-input', 'set');
  refused(a, 'bad-direct', 400, 'invalid-input', 'direct');
  refused(a, 'unknown-input', 400, 'unknown-input', 'foo');
});

test('LE23: a visitor gets 401 and a stranger 403; an admin reads what the owner reads', () => {
  const { a } = main();
  needDecl();
  assert(a.req('visitor').status === 401 && a.req('stranger').status === 403, `a visitor 401, a stranger 403; got ${a.req('visitor').status}, ${a.req('stranger').status}`);
  assert(show(ok(a, 'admin')) === show(ok(a, 'owner')), 'an admin reads exactly what the owner reads, from the owner\'s point of view');
});

test('LE24: it writes nothing: it only reads, the graph is as it was, and no change entry is recorded', () => {
  const { a, file, before } = main();
  ok(a, 'dog');
  ok(a, 'owner');
  const after = S.readState(file);
  const log = after.log.slice(before.log.length);
  assert(log.length > 0 && log.every((e) => e.call === 'read'), `list-elements opens no write transaction; the log: ${show(log.filter((e) => e.call !== 'read').slice(0, 5))}`);
  assert(after.nodes.length === before.nodes.length && after.rels.length === before.rels.length, 'the graph has the same nodes and relationships');
  assert(S.entriesOf(after).length === S.entriesOf(before).length, 'no change entry was recorded');
});

test('LE25: the command answers what the route answers, refusals included', () => {
  const { a } = main();
  needDecl();
  const cases = [['cli-5', 'route-5', 0], ['cli-refusal', 'route-refusal', 1], ['cli-direct', 'route-direct', 0]];
  for (const [c, r, code] of cases) {
    const cmd = a.cmd(c);
    assert(cmd.code === code, `${c} exits ${code}; got ${cmd.code} ${String(cmd.stderr).slice(-300)}`);
    let body = null;
    try { body = JSON.parse(cmd.stdout); } catch { /* reported below */ }
    assert(body && show(body) === show(a.req(r).body), `${c} prints what ${r} answers; command ${show(body).slice(0, 300)}, route ${show(a.req(r).body).slice(0, 300)}`);
  }
  assert(ok(a, 'route-direct').direct === true, '--direct with no value is true');
});

test('LE26: it is listed for an admin with its inputs and refusals, and has its /docs entry', () => {
  const { a } = main();
  needDecl();
  const list = a.req('list');
  const e = ((list.body.data && list.body.data.operations) || []).find((o) => o.group === 'graph' && o.name === 'list-elements');
  assert(e, `graph list-elements is listed for an admin; problems: ${show(list.body.data && list.body.data.problems)}`);
  assert(e.kind === 'read' && e.method === 'GET' && e.access === 'owner-and-admins' && e.route === ROUTE && e.command === 'tapestry graph list-elements', `a GET read for the owner and admins; got ${show({ kind: e.kind, method: e.method, access: e.access, route: e.route, command: e.command })}`);
  assert(show(Object.keys(e.inputs).sort()) === show(['concept', 'cursor', 'direct', 'limit', 'pov', 'set']), `its inputs: concept, set, direct, pov, limit and cursor; got ${show(Object.keys(e.inputs))}`);
  const codes = e.refusals.map((x) => `${x.code}:${x.status}`);
  for (const c of ['concept-or-set:400', 'unknown-node:404', 'not-a-concept:409', 'not-a-set:409', 'unknown-pov:400', 'invalid-cursor:400', 'unknown-input:400', 'invalid-input:400', 'sign-in-required:401', 'not-allowed:403']) {
    assert(codes.includes(c), `its refusals include ${c}; got ${show(codes)}`);
  }
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    const names = p && p.get ? (p.get.parameters || []).map((x) => x.name).sort() : null;
    process.stdout.write('RESULT:' + JSON.stringify({ methods: p ? Object.keys(p) : null, names }));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('list-elements-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  const docs = line ? JSON.parse(line) : null;
  assert(docs && show(docs.methods) === show(['get']), `/docs has GET ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
  assert(show(docs.names) === show(['concept', 'cursor', 'direct', 'limit', 'pov', 'set']), `/docs gives its six query parameters; got ${show(docs.names)}`);
});

test('LE27: its paging, point of view and node shape are reads.js\'s, and the catalog\'s Conventions say so', () => {
  needDecl();
  if (!fs.existsSync(READS)) throw new Error('src/operations/reads.js does not exist yet (ADR graph-operations-first-slice/0011 Decision 1)');
  const child = spawnSync(process.execPath, ['-e', `
    const R = require(${JSON.stringify(READS)});
    const d = require(${JSON.stringify(DECL)});
    const pick = (r) => r && { code: r.code, status: r.status };
    const props = (d.result && d.result.schema && d.result.schema.properties) || {};
    process.stdout.write('RESULT:' + JSON.stringify({
      limit: [d.inputs.limit && d.inputs.limit.schema, R.LIMIT_INPUT && R.LIMIT_INPUT.schema],
      cursor: [d.inputs.cursor && d.inputs.cursor.schema, R.CURSOR_INPUT && R.CURSOR_INPUT.schema],
      pov: [d.inputs.pov && d.inputs.pov.schema, R.POV_INPUT && R.POV_INPUT.schema],
      refusals: (d.refusals || []).map(pick),
      invalidCursor: pick(R.INVALID_CURSOR), unknownPov: pick(R.UNKNOWN_POV),
      node: [props.elements && props.elements.items, R.NODE],
      povSchema: [props.pov, R.POV],
    }));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('list-elements-once-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  const x = line ? JSON.parse(line) : null;
  assert(x, `the declaration and reads.js load; ${(child.stderr || '').slice(-400)}`);
  for (const input of ['limit', 'cursor', 'pov']) {
    assert(x[input][1] && show(x[input][0]) === show(x[input][1]), `its ${input} input is reads.js's; got ${show(x[input])}`);
  }
  assert(x.limit[1].type === 'integer' && x.limit[1].minimum === 1 && x.limit[1].maximum === 200 && x.limit[1].default === 50, `the limit is 1 to 200, 50 by default; got ${show(x.limit[1])}`);
  assert(x.pov[1].default === 'owner', `pov is the owner's by default; got ${show(x.pov[1])}`);
  for (const r of [x.invalidCursor, x.unknownPov]) assert(r && x.refusals.some((y) => y.code === r.code && y.status === r.status), `it declares reads.js's ${show(r)}; got ${show(x.refusals)}`);
  assert(x.node[1] && show(x.node[0]) === show(x.node[1]), `its elements are reads.js's NODE; got ${show(x.node)}`);
  assert(x.povSchema[1] && show(x.povSchema[0]) === show(x.povSchema[1]), `its pov is reads.js's POV; got ${show(x.povSchema)}`);
  const text = fs.readFileSync(CATALOG, 'utf8');
  const conventions = (text.split(/\n## Conventions\n/)[1] || '').split(/\n## /)[0];
  for (const words of ['src/operations/reads.js', '0011', '`limit`', '`cursor`', '`pov`', '`everyone`', '`tapestryKey`', '`address`', '`author`', '`own`']) {
    assert(conventions.includes(words), `the catalog's Conventions mention ${words}`);
  }
  const row = text.split('\n').find((l) => l.startsWith('| `list-elements` |')) || '';
  assert(/kept/.test(row) && /leftOut/.test(row), `§1's list-elements row gives the answer as built, kept and leftOut among it; got ${show(row)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
