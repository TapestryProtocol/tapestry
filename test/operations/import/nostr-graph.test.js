'use strict';
/**
 * import nostr — a graph and what it lists. Run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/32-import-nostr.md (AC4; open question 3, as the owner
 *          answered it; AC2's claims of a graph element)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0032-import-nostr.md (Decisions 6, 8, 9, 11 and 12)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/32-import-nostr.test-plan.md
 *
 * Stack-free, over test/helpers/cypherGraphFake.js and test/helpers/relayFake.js. other.example.com is another
 * instance's relay: it holds alice's concept cat as her instance publishes it (importFixtures.js's conceptLetters:
 * header, superset, JSON schema, primary property, properties set, property tree graph, core nodes graph and concept
 * graph, the graphs listing their nodes, relationships and imports), two of cat's class thread (an element and a set,
 * which no graph lists), and bob's graphs for the slugs, the depth and the caps. One harness run, as the admin.
 *
 *   IG1  one concept's concept graph by its address: the element, the letters its graphs list and the graphs it imports,
 *        each once, at alice's addresses and as her letters; the wiring each graph lists; the role labels; her header
 *        a ListHeader
 *   IG2  the answer: source graph; each graph followed with its depth and outcome; each letter's outcome; next null
 *   IG3  a slug its own graph doesn't list is resolved through a graph followed before it; one no graph lists makes
 *        nothing, and the call goes on
 *   IG4  four levels below the element at most, the rest under next.graphs; a graph the relay doesn't hold is
 *        not-found; one whose JSON doesn't parse is recorded and listed unreadable
 *   IG5  at most 50 graphs a call: the rest under next.graphs, each graph named once
 *   IG6  the same graph again, by naddr: unchanged, no entry
 *   IG7  a graph's relationships are its author's claims: between another author's nodes they make nothing, and that
 *        author's own graph, imported through it, makes them
 *   IG8  a graph address the relay doesn't hold: answered (200), the graph not-found
 *   IG9  the class thread isn't followed: cat's element and set, which no graph lists, aren't read
 *   IG10 an element that named cat before cat was in the graph is wired when the graph brings cat's IS_THE_CONCEPT_FOR
 */

const S = require('../../helpers/graphOpsSuite');
const F = require('../../helpers/importFixtures');

const { assert, show } = S;
const { test, run } = S.makeSuite('operations: import nostr — a graph and what it lists');
const { KEYS, imp, letter } = F;
const al = KEYS.alice, bob = KEYS.bob;
const A = (kind, key, d) => `${kind}:${key.pubkey}:${d}`;
const at = (rid, body) => imp(rid, 'admin', { relay: F.OTHER_INSTANCE, ...body });
const one = (s, uuid, what) => { const ns = F.nodesAt(s, uuid); assert(ns.length === 1, `${what}: one node at ${uuid}; got ${ns.length}`); return ns[0]; };
/** A graph's entry in the answer, found by its address under whatever name the answer gives it. */
const graphEntry = (d, address) => (d.graphs || []).find((g) => g && Object.values(g).includes(address));

const cat = F.conceptLetters(al, 'cat', { at: 1700200000 });
const catElement = letter(al, { kind: 39999, at: 1700200001, tags: [['d', 'tom'], ['name', 'Tom'], ['z', cat.addr.header]] });
const catSet = letter(al, { kind: 39999, at: 1700200002, tags: [['d', 'big-cats'], ['name', 'big cats'], ['s', cat.addr.superset]] });
// IG3: bob's graphs for the slugs.
const X = letter(bob, { kind: 39999, at: 1700200100, tags: [['d', 'x'], ['name', 'X']] });
const Y = letter(bob, { kind: 39999, at: 1700200101, tags: [['d', 'y'], ['name', 'Y']] });
const child = F.graphLetter(bob, { d: 'slug-child', nodes: [{ slug: 'y', uuid: F.addressOf(Y) }], relationships: [['x', 'IMPORT', 'y'], ['nowhere', 'SUPERCEDES', 'y']], at: 1700200102 });
const root = F.graphLetter(bob, { d: 'slug-root', nodes: [{ slug: 'x', uuid: F.addressOf(X) }], imports: [{ slug: 'slug-child', uuid: F.addressOf(child) }], at: 1700200103 });
// IG4: a chain six graphs deep, a graph the relay doesn't hold, and one whose JSON doesn't parse.
const leaves = Array.from({ length: 6 }, (_, i) => letter(bob, { kind: 39999, at: 1700200200 + i, tags: [['d', `leaf-${i}`], ['name', `leaf ${i}`]] }));
const missingGraph = A(39999, bob, 'graph-nobody-published');
const broken = F.graphLetter(bob, { d: 'broken-graph', json: '{"graph": {"nodes": [', at: 1700200250 });
const chain = [];
for (let i = 5; i >= 0; i -= 1) {
  const imports = [];
  if (i < 5) imports.push({ slug: `deep-${i + 1}`, uuid: F.addressOf(chain[0]) });
  if (i === 2) imports.push({ slug: 'missing', uuid: missingGraph });
  if (i === 3) imports.push({ slug: 'broken', uuid: F.addressOf(broken) });
  chain.unshift(F.graphLetter(bob, { d: `deep-${i}`, nodes: [{ slug: `leaf-${i}`, uuid: F.addressOf(leaves[i]) }], imports, at: 1700200300 + i }));
}
// IG5: a graph that imports 55.
const many = Array.from({ length: 55 }, (_, i) => F.graphLetter(bob, { d: `many-${i}`, at: 1700200400 + i }));
const wide = F.graphLetter(bob, { d: 'wide', imports: many.map((g, i) => ({ slug: `many-${i}`, uuid: F.addressOf(g) })), at: 1700200500 });
// IG7: alice's graph over bob's nodes, importing bob's own graph of them.
const B1 = letter(bob, { kind: 39999, at: 1700200600, tags: [['d', 'b1'], ['name', 'B1']] });
const B2 = letter(bob, { kind: 39999, at: 1700200601, tags: [['d', 'b2'], ['name', 'B2']] });
const bobsGraph = F.graphLetter(bob, { d: 'bobs-graph', nodes: [{ slug: 'b1', uuid: F.addressOf(B1) }, { slug: 'b2', uuid: F.addressOf(B2) }], relationships: [['b1', 'IMPORT', 'b2']], at: 1700200602 });
const alicesGraph = F.graphLetter(al, { d: 'alices-graph-of-bobs', nodes: [{ slug: 'b1', uuid: F.addressOf(B1) }, { slug: 'b2', uuid: F.addressOf(B2) }], relationships: [['b1', 'SUPERCEDES', 'b2']], imports: [{ slug: 'bobs-graph', uuid: F.addressOf(bobsGraph) }], at: 1700200603 });
const neverPublished = A(39999, al, 'a-graph-nobody-published');

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    F.needDecl();
    const relays = { [F.OTHER_INSTANCE]: F.relay([...cat.all, catElement, catSet, X, Y, child, root, ...leaves, broken, ...chain, ...many, wide, B1, B2, bobsGraph, alicesGraph]) };
    const r = F.runImport({
      state: F.emptyGraph(), relays, label: 'import-nostr-graph',
      requests: [
        at('g-tom', { ids: [catElement.id] }),
        at('g-cat', { graph: cat.addr.conceptGraph }),
        at('g-cat-again', { graph: F.nip.naddr(39999, al.pubkey, 'cat-concept-graph') }),
        at('g-slugs', { graph: F.addressOf(root) }),
        at('g-depth', { graph: F.addressOf(chain[0]) }),
        at('g-many', { graph: F.addressOf(wide) }),
        at('g-cross', { graph: F.addressOf(alicesGraph) }),
        at('g-missing', { graph: neverPublished }),
      ],
    });
    return { r, after: r.state() };
  })();
  return MAIN;
}

test('IG1 [AC4, Decisions 6 and 9]: a concept graph by its address brings its header, superset, the graphs it imports and their wiring, at alice\'s addresses', async () => {
  const { r, after } = await main();
  const d = F.data(r, 'g-cat');
  const letters = Object.values(cat.letters);
  for (const e of letters) {
    const n = one(after, F.addressOf(e), F.addressOf(e));
    assert(n.props.id === e.id && n.props.pubkey === al.pubkey && !F.isPlaceholder(n), `${F.addressOf(e)}: alice's letter, recorded at her address; got ${show(n.props)}`);
    assert(F.forId(d, e.id).length === 1, `${F.addressOf(e)}: read and recorded once; got ${show(F.forId(d, e.id))}`);
  }
  assert(d.counts.recorded === letters.length, `eight letters recorded; got ${show(d.counts)}`);
  for (const [from, type, to] of F.wiringOf(cat)) assert(F.relsOf(after, { type, from, to }).length === 1, `${type} from ${from} to ${to}, as alice's graphs list it`);
  const label = (role, want) => assert(one(after, cat.addr[role], role).labels.includes(want), `${role}: ${want}`);
  label('superset', 'Superset'); label('schema', 'JSONSchema'); label('primaryProperty', 'Property'); label('properties', 'Set');
  const h = one(after, cat.addr.header, 'cat\'s header');
  assert(h.labels.includes('ListHeader') && !h.labels.includes('ConceptHeader'), `her header is a ListHeader, and no ConceptHeader; got ${show(h.labels)}`);
});

test('IG2 [AC4, Decision 11]: the answer: source graph, each graph followed with its depth and outcome, each letter\'s outcome', async () => {
  const { r } = await main();
  const d = F.data(r, 'g-cat');
  assert(d.source === 'graph' && d.next === null && d.crowded === null, `source graph, next null; got ${show({ source: d.source, next: d.next, crowded: d.crowded })}`);
  for (const [address, depth] of [[cat.addr.conceptGraph, 0], [cat.addr.propertyTreeGraph, 1], [cat.addr.coreNodesGraph, 1]]) {
    const g = graphEntry(d, address);
    assert(g && g.depth === depth && g.outcome === 'followed', `${address}: followed at depth ${depth}; got ${show(g)}`);
  }
  assert(d.graphs.length === 3, `three graphs followed, each once; got ${show(d.graphs)}`);
  assert(d.events.every((e) => e.outcome === 'recorded' && typeof e.node === 'string'), `each letter recorded, with its node; got ${show(d.events.map((e) => [e.address, e.outcome]))}`);
});

test('IG3 [Decision 6]: a slug is resolved through a graph followed before; one no graph lists makes nothing', async () => {
  const { r, after } = await main();
  const d = F.data(r, 'g-slugs');
  assert(d.counts.failed === 0, 'the call goes on past a slug it can\'t resolve');
  assert(F.relsOf(after, { type: 'IMPORT', from: F.addressOf(X), to: F.addressOf(Y) }).length === 1, 'x, listed by the root and not by the child, resolves through the root: X IMPORT Y');
  assert(F.relsOf(after, { type: 'SUPERCEDES', to: F.addressOf(Y) }).length === 0, 'nowhere, listed by no graph, makes nothing');
});

test('IG4 [Decisions 6 and 12]: four levels below the element at most, the rest under next; not-found and unreadable graphs', async () => {
  const { r, after } = await main();
  const d = F.data(r, 'g-depth');
  for (let i = 0; i <= 4; i += 1) {
    const g = graphEntry(d, F.addressOf(chain[i]));
    assert(g && g.depth === i && g.outcome === 'followed', `deep-${i}: followed at depth ${i}; got ${show(g)}`);
    one(after, F.addressOf(leaves[i]), `leaf ${i}`);
  }
  assert(!graphEntry(d, F.addressOf(chain[5])) || graphEntry(d, F.addressOf(chain[5])).outcome !== 'followed', 'deep-5, five levels down, is not followed');
  assert(d.next && Array.isArray(d.next.graphs) && d.next.graphs.includes(F.addressOf(chain[5])), `next.graphs names deep-5 for a later call; got ${show(d.next)}`);
  assert(F.nodesAt(after, F.addressOf(leaves[5])).length === 0, 'and leaf 5, which only deep-5 lists, isn\'t read');
  const m = graphEntry(d, missingGraph);
  assert(m && m.outcome === 'not-found', `a graph the relay doesn't hold: not-found; got ${show(m)}`);
  const b = graphEntry(d, F.addressOf(broken));
  assert(b && b.outcome === 'unreadable' && one(after, F.addressOf(broken), 'the broken graph').props.id === broken.id, `a graph whose JSON doesn't parse: unreadable, its letter recorded; got ${show(b)}`);
});

test('IG5 [Decisions 6 and 12]: at most 50 graphs a call; the rest under next.graphs, each graph named once', async () => {
  const { r } = await main();
  const d = F.data(r, 'g-many');
  const followed = (d.graphs || []).filter((g) => g.outcome === 'followed');
  const all = [F.addressOf(wide), ...many.map(F.addressOf)];
  const named = [...followed.map((g) => all.find((a) => Object.values(g).includes(a))), ...((d.next && d.next.graphs) || [])];
  assert(followed.length <= 50 && followed.length >= 1, `at most 50 graphs followed; got ${followed.length}`);
  assert(d.next && d.next.graphs.length >= 1, `the rest are under next.graphs; got ${show(d.next)}`);
  assert(named.length === all.length && all.every((a) => named.filter((x) => x === a).length === 1), `each of the 56 graphs is followed or named under next, once; got ${named.length}`);
});

test('IG6 [AC3, AC4]: the same graph again, by naddr: unchanged, no entry', async () => {
  const { r } = await main();
  const d = F.data(r, 'g-cat-again');
  assert(d.events.length === 8 && d.events.every((e) => e.outcome === 'unchanged') && d.changes === 0, `every letter unchanged, no entry; got ${show(d.events.map((e) => e.outcome))} ${d.changes}`);
  assert(graphEntry(d, cat.addr.conceptGraph) && graphEntry(d, cat.addr.conceptGraph).outcome === 'followed', 'the graph, given as an naddr, is followed again');
});

test('IG7 [AC2, Decision 8]: a graph\'s relationships are its author\'s claims, between her own nodes only', async () => {
  const { r, after } = await main();
  F.data(r, 'g-cross');
  assert(F.relsOf(after, { type: 'SUPERCEDES', from: F.addressOf(B1), to: F.addressOf(B2) }).length === 0, 'alice\'s graph claims SUPERCEDES between bob\'s nodes: nothing');
  assert(F.relsOf(after, { type: 'IMPORT', from: F.addressOf(B1), to: F.addressOf(B2) }).length === 1, 'bob\'s own graph, imported through hers, claims IMPORT between his: made');
});

test('IG8 [AC4, AC7]: a graph address the relay doesn\'t hold is answered, the graph not-found', async () => {
  const { r } = await main();
  const d = F.data(r, 'g-missing');
  const g = graphEntry(d, neverPublished);
  assert(g && g.outcome === 'not-found' && d.counts.recorded === 0, `answered with the graph not-found; got ${show(d)}`);
});

test('IG9 [AC4, open question 3]: the class thread isn\'t followed', async () => {
  const { r, after } = await main();
  const d = F.data(r, 'g-cat');
  assert(graphEntry(d, cat.addr.conceptGraph) && one(after, cat.addr.superset, 'cat\'s superset').props.id === cat.letters.superset.id, 'the graph import ran, and brought cat\'s superset');
  assert(F.nodesAt(after, F.addressOf(catSet)).length === 0 && !(d.events || []).some((e) => e.id === catSet.id), 'cat\'s set, which names its superset by s and which no graph lists, isn\'t read');
});

test('IG10 [AC3, Decision 8]: an element that named cat before cat arrived is wired when the graph brings cat\'s IS_THE_CONCEPT_FOR', async () => {
  const { r, after } = await main();
  F.data(r, 'g-tom');
  const tom = one(after, F.addressOf(catElement), 'Tom');
  assert(F.relsOf(after, { type: 'HAS_ELEMENT', from: cat.addr.superset }).filter((x) => x.to === tom.eid).length === 1, 'cat\'s superset HAS_ELEMENT Tom, made in the graph import\'s transaction that made IS_THE_CONCEPT_FOR');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
