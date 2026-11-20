'use strict';
/**
 * import nostr — the instance's own nodes stay as the owner made them. Run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/32-import-nostr.md (AC6; open questions 1 and 2 as
 *          amended at Architecture)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0032-import-nostr.md (Decisions 7.2, 8 and 9;
 *          amendments 1, 2 and 6)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/32-import-nostr.test-plan.md
 *
 * Stack-free, over test/helpers/cypherGraphFake.js and test/helpers/relayFake.js. IW1–IW6 run over the assistant's
 * concept dog (importFixtures.js's ownConcept: its letters, signed with the throwaway assistant key the child is given,
 * imported by today's builder; a set; an element; and a node made here with no letter). IW4 gives the child an owner
 * who signs. IW7 runs over test/helpers/propertyGraph.js's seed, with graphOpsSuite's own keys: its beagle is the
 * instance's own concept, and the property writes and graph list-elements run over the graph the import left, through
 * test/helpers/graphFake.js, as their own suites run them.
 *
 *   IW1  the assistant's letter for one of its nodes, as today's builder imported it: own; nothing changes, no entry
 *   IW2  a newer version of that letter, as export nostr would send one: own; the node keeps the older's id, time and tags
 *   IW3  a letter at the address of a node made here with no letter: own; the node stays a node with no event
 *   IW4  the owner's letter at the owner's node's address: own
 *   IW5  an own letter with no node at its address is recorded; its z and n memberships are made; its s and its
 *        relationship letter's claim are not; one at a placeholder's address fills it
 *   IW6  another author's claims on the instance's own nodes: z becomes HAS_ELEMENT from the own superset; n, s, a
 *        relationship letter and a graph's relationships make nothing there; e, a and b references are made; and every
 *        own node keeps its properties, labels and relationships
 *   IW7  the owner's graph writes on that concept answer as they did before (graph set-schema on beagle, before and
 *        after another author's claims on it were imported), and graph list-elements from the owner's point of view
 *        leaves the other author's element out while pov=everyone counts it (ADR 0011)
 */

const S = require('../../helpers/graphOpsSuite');
const F = require('../../helpers/importFixtures');
const P = require('../../helpers/propertyGraph');

const { assert, show } = S;
const { test, run } = S.makeSuite('operations: import nostr — the instance\'s own nodes stay as the owner made them');
const { KEYS, imp, letter } = F;
const al = KEYS.alice, ta = KEYS.ta;
const A = (kind, key, d) => `${kind}:${key.pubkey}:${d}`;
const at = (rid, body, caller = 'admin') => imp(rid, caller, { relay: F.PEER_RELAY, ...body });
const one = (s, uuid, what) => { const ns = F.nodesAt(s, uuid); assert(ns.length === 1, `${what}: one node at ${uuid}; got ${ns.length}`); return ns[0]; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (o) => Object.keys(o).sort().reduce((x, k) => { x[k] = o[k]; return x; }, {});
/** A node as an own node must stay: its labels and properties. */
const facts = (n) => ({ labels: [...n.labels].sort(), props: sorted(n.props) });
/** A node's relationships, by type, direction and the other end's uuid (or pubkey), with their properties. */
function relsAround(s, n) {
  const name = (x) => (x ? x.props.uuid || x.props.pubkey || x.props.id : null);
  return F.relsOf(s, {}).filter((r) => r.from === n.eid || r.to === n.eid)
    .map((r) => `${r.from === n.eid ? 'out' : 'in'} ${r.type} ${JSON.stringify(sorted(r.props || {}))} ${name(r.from === n.eid ? r.toNode : r.fromNode)}`).sort();
}

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    F.needDecl();
    const state = F.emptyGraph();
    const dog = F.ownConcept(state);
    const a = dog.addr;
    // IW1–IW3: letters at the own nodes' addresses.
    const sameHeader = dog.letters.header;
    const newerHeader = letter(ta, { kind: 39998, at: sameHeader.created_at + 1000, tags: [['d', 'dog'], ['names', 'dog', 'dogs'], ['json', JSON.stringify({ rewritten: 'tapestry:links, as export nostr sends' })]] });
    const atMadeHere = letter(ta, { kind: 39999, at: 1700100000, tags: [['d', 'dog-made-here'], ['name', 'Made Here, sent']] });
    // IW5: own letters with no node at their address, and one at a placeholder's address.
    const newOwn = letter(ta, { kind: 39999, at: 1700100001, tags: [['d', 'new-own'], ['name', 'New Own'], ['z', a.header], ['n', a.set], ['s', a.superset]] });
    const ownRel = F.relationshipLetter(ta, { d: 'own-rel', from: a.header, to: A(39999, ta, 'new-own'), type: 'IS_THE_CONCEPT_FOR', at: 1700100002 });
    const placeheld = letter(ta, { kind: 39999, at: 1700100003, tags: [['d', 'placeheld'], ['name', 'Placeheld']] });
    const pointer = letter(al, { kind: 1, at: 1700100004, tags: [['a', F.addressOf(placeheld)]], content: 'alice names an address of the assistant\'s' });
    // IW6: alice's claims on the own nodes.
    const zA = letter(al, { kind: 39999, at: 1700100010, tags: [['d', 'z-a'], ['name', 'Alice\'s Dog'], ['z', a.header]] });
    const nA = letter(al, { kind: 39999, at: 1700100011, tags: [['d', 'n-a'], ['name', 'In Your Set'], ['n', a.set]] });
    const sA = letter(al, { kind: 39999, at: 1700100012, tags: [['d', 's-a'], ['name', 'Under Your Superset'], ['s', a.superset]] });
    const propA = letter(al, { kind: 39999, at: 1700100013, tags: [['d', 'prop-a'], ['name', 'Her Property'], ['json', JSON.stringify({ word: { slug: 'prop-a', wordTypes: ['word', 'property'] } })]] });
    const relA = F.relationshipLetter(al, { d: 'rel-a', from: F.addressOf(propA), to: a.primaryProperty, type: 'IS_A_PROPERTY_OF', at: 1700100014 });
    const relOwnEnds = F.relationshipLetter(al, { d: 'rel-own-ends', from: a.schema, to: a.header, type: 'IS_THE_JSON_SCHEMA_FOR', at: 1700100015 });
    const schemaA = letter(al, { kind: 39999, at: 1700100016, tags: [['d', 'schema-a'], ['name', 'A Second Schema'], ['json', JSON.stringify({ word: { slug: 'schema-a', wordTypes: ['word', 'jsonSchema'] } })]] });
    const graphA = F.graphLetter(al, { d: 'graph-a', nodes: [{ slug: 'mine', uuid: F.addressOf(schemaA) }, { slug: 'yours', uuid: a.header }], relationships: [['mine', 'IS_THE_JSON_SCHEMA_FOR', 'yours']], at: 1700100017 });
    const refA = letter(al, { kind: 39999, at: 1700100018, tags: [['d', 'ref-a'], ['e', sameHeader.id], ['a', a.superset], ['b', a.element, 'inherit']] });
    const relays = { [F.PEER_RELAY]: F.relay([sameHeader, newerHeader, atMadeHere, newOwn, ownRel, placeheld, pointer, zA, nA, sA, propA, relA, relOwnEnds, schemaA, graphA, refA]) };
    const before = JSON.parse(JSON.stringify(state));
    const r = F.runImport({
      state, relays, label: 'import-nostr-own',
      requests: [
        // By id: the relay holds the newer version at the same address too, which IW2 asks for.
        at('same', { ids: [sameHeader.id] }),
        at('newer', { ids: [newerHeader.id] }),
        at('made-here', { addresses: [a.madeHere] }),
        at('pointer', { ids: [pointer.id] }),
        at('own-letters', { addresses: [F.addressOf(newOwn), F.addressOf(ownRel), F.addressOf(placeheld)] }),
        at('peer', { addresses: [zA, nA, sA, propA, relA, relOwnEnds, schemaA, graphA, refA].map(F.addressOf) }),
      ],
    });
    return { dog, before, r, after: r.state(), letters: { sameHeader, newerHeader, atMadeHere, newOwn, ownRel, placeheld, pointer, zA, nA, sA, propA, relA, relOwnEnds, schemaA, graphA, refA } };
  })();
  return MAIN;
}

/** The data of a call whose one event is the instance's own: own, nothing changed, the own node's key. */
function ownAnswer(r, rid, node) {
  const d = F.data(r, rid);
  const [e] = d.events;
  assert(d.events.length === 1 && e.outcome === 'own' && e.node === node.props.tapestryKey && d.changes === 0 && d.counts.own === 1, `${rid}: own, naming the own node, and no entry; got ${show(d).slice(0, 500)}`);
  return d;
}

test('IW1 [AC6, Decision 7.2]: the assistant\'s letter for one of its own nodes is own; nothing changes and nothing is recorded', async () => {
  const { r, before, after, dog } = await main();
  const was = one(before, dog.addr.header, 'dog\'s header, before');
  ownAnswer(r, 'same', was);
  const now = one(after, dog.addr.header, 'dog\'s header');
  assert(same(facts(was), facts(now)), `the header's labels and properties are as they were; before ${show(facts(was))} after ${show(facts(now))}`);
  // The run's later calls reference the header (IW6's e tag), which a reference may: nothing else about it is new.
  const b = relsAround(before, was), n = relsAround(after, now);
  assert(b.every((x) => n.includes(x)) && n.filter((x) => !b.includes(x)).every((x) => /^in (REFERENCES|INHERITS_FROM) /.test(x)), `and its relationships, but for later references to it; before ${show(b)} after ${show(n)}`);
});

test('IW2 [AC6, memo #133]: a newer version of an own node\'s letter, as export nostr sends one, is own; the node keeps the older', async () => {
  const { r, before, after, dog, letters } = await main();
  const was = one(before, dog.addr.header, 'dog\'s header, before');
  ownAnswer(r, 'newer', was);
  const now = one(after, dog.addr.header, 'dog\'s header');
  assert(now.props.id === letters.sameHeader.id && now.props.created_at === letters.sameHeader.created_at, `the node keeps its letter, not the newer one: its id and created_at; got ${show(now.props)}`);
  assert(same(F.tagsOf(before, was).map((t) => t.props).sort((x, y) => String(x.uuid).localeCompare(y.uuid)), F.tagsOf(after, now).map((t) => t.props).sort((x, y) => String(x.uuid).localeCompare(y.uuid))), 'and its tags');
  assert(F.withId(after, letters.newerHeader.id).length === 0, 'and nothing holds the newer letter\'s id: no record of it is kept (amendment 6)');
});

test('IW3 [AC6]: a letter at the address of a node made here with no letter is own; the node stays one with no event', async () => {
  const { r, before, after, dog } = await main();
  const was = one(before, dog.addr.madeHere, 'made here, before');
  ownAnswer(r, 'made-here', was);
  const now = one(after, dog.addr.madeHere, 'made here');
  assert(same(facts(was), facts(now)) && !now.labels.includes('NostrEvent') && now.props.id === undefined, `it has no NostrEvent label and no id, as before; got ${show(facts(now))}`);
});

test('IW4 [AC6]: the owner\'s letter at the owner\'s node\'s address is own', async () => {
  F.needDecl();
  const owner = KEYS.ownerSigner;
  const state = F.emptyGraph();
  const first = letter(owner, { kind: 39999, at: 1700110000, tags: [['d', 'owners-note'], ['name', 'The Owner\'s']] });
  const node = F.today(state, first);
  const second = letter(owner, { kind: 39999, at: 1700110100, tags: [['d', 'owners-note'], ['name', 'The Owner\'s, again']] });
  const before = JSON.parse(JSON.stringify(state));
  const r = F.runImport({ state, ownerKey: owner.pubkey, relays: { [F.PEER_RELAY]: F.relay([first, second]) }, label: 'import-nostr-owner', requests: [at('owner-letter', { ids: [second.id] }, 'owner')] });
  ownAnswer(r, 'owner-letter', node);
  assert(F.sameGraph(before, r.state()), 'nothing changed');
});

test('IW5 [AC6, Decisions 7.2 and 8]: an own letter with no node at its address is recorded, with its memberships and nothing else', async () => {
  const { r, after, dog, letters } = await main();
  const d = F.data(r, 'own-letters');
  for (const e of [letters.newOwn, letters.ownRel, letters.placeheld]) assert(F.forRef(d, F.addressOf(e))[0].outcome === 'recorded', `${F.addressOf(e)}: recorded`);
  const n = one(after, F.addressOf(letters.newOwn), 'new own');
  const into = (type, from) => F.relsOf(after, { type, from }).filter((x) => x.to === n.eid);
  assert(into('HAS_ELEMENT', dog.addr.superset).length === 1, 'its z: HAS_ELEMENT from dog\'s superset');
  assert(into('HAS_ELEMENT', dog.addr.set).length === 1, 'its n: HAS_ELEMENT from the set it names');
  assert(into('IS_A_SUPERSET_OF', dog.addr.superset).length === 0, 'its s makes nothing: the instance\'s own structure is the graph operations\' and the signing routes\', never the import\'s');
  one(after, F.addressOf(letters.ownRel), 'the assistant\'s relationship letter');
  assert(F.relsOf(after, { type: 'IS_THE_CONCEPT_FOR', from: dog.addr.header }).filter((x) => x.to === n.eid).length === 0, 'and its relationship letter\'s claim makes nothing');
  const p = one(after, F.addressOf(letters.placeheld), 'placeheld');
  assert(!F.isPlaceholder(p) && p.props.id === letters.placeheld.id, 'an own letter at a placeholder\'s address fills it: a placeholder is never own');
});

test('IW6 [AC6, amendments 1 and 2]: another author\'s claims on the own nodes: only memberships and references, and every own node as it was', async () => {
  const { r, before, after, dog, letters } = await main();
  const d = F.data(r, 'peer');
  assert(d.events.every((e) => e.outcome === 'recorded'), `each of alice's letters is recorded; got ${show(d.events.map((e) => [e.ref, e.outcome]))}`);
  const node = (e) => one(after, F.addressOf(e), F.addressOf(e));
  const z = node(letters.zA);
  assert(F.relsOf(after, { type: 'HAS_ELEMENT', from: dog.addr.superset }).filter((x) => x.to === z.eid).length === 1, 'z: HAS_ELEMENT from dog\'s superset, a membership from anyone, which reads count when its author counts');
  assert(F.relsOf(after, { type: 'HAS_ELEMENT', from: dog.addr.set }).filter((x) => x.to === node(letters.nA).eid).length === 0, 'n naming the assistant\'s set: nothing (the set\'s address carries another key)');
  assert(F.relsOf(after, { type: 'IS_A_SUPERSET_OF', from: dog.addr.superset }).filter((x) => x.to === node(letters.sA).eid).length === 0, 's naming its superset: nothing');
  assert(F.relsOf(after, { type: 'IS_A_PROPERTY_OF', to: dog.addr.primaryProperty }).filter((x) => x.from === node(letters.propA).eid).length === 0, 'her relationship letter hanging her property on dog\'s: nothing');
  assert(F.relsOf(after, { type: 'IS_THE_JSON_SCHEMA_FOR', to: dog.addr.header }).filter((x) => x.fromNode.props.uuid !== dog.addr.schema).length === 0, 'her graph\'s second schema for dog: nothing');
  const ref = node(letters.refA);
  const fromRef = F.relsOf(after, {}).filter((x) => (x.from === ref.eid || F.tagsOf(after, ref).some((t) => t.eid === x.from)) && x.type !== 'HAS_TAG');
  const targets = fromRef.map((x) => `${x.type} ${x.toNode.props.uuid}`).sort();
  assert(same(targets, [`INHERITS_FROM ${dog.addr.element}`, `REFERENCES ${dog.addr.header}`, `REFERENCES ${dog.addr.superset}`].sort()), `her e, a and b references to the assistant's nodes are made, from her tags and node; got ${show(targets)}`);
  // Every own node as it was: its labels, its properties, and its relationships, but for the membership and the
  // references just made.
  const ownUuids = Object.values(dog.addr);
  // Alice's z (IW6) and the assistant's own new letter's z and n (IW5) are the only memberships the import made here.
  const allowed = new Set([`out HAS_ELEMENT {} ${F.addressOf(letters.zA)}`, `out HAS_ELEMENT {} ${F.addressOf(letters.newOwn)}`]);
  for (const uuid of ownUuids) {
    const was = one(before, uuid, `${uuid}, before`);
    const now = one(after, uuid, uuid);
    assert(same(facts(was), facts(now)), `${uuid}: its labels and properties are as they were; before ${show(facts(was))} after ${show(facts(now))}`);
    const b = relsAround(before, was);
    const n = relsAround(after, now);
    const added = n.filter((x) => !b.includes(x));
    const gone = b.filter((x) => !n.includes(x));
    assert(gone.length === 0, `${uuid}: none of its relationships went; gone ${show(gone)}`);
    const unexpected = added.filter((x) => !allowed.has(x) && !/^in (REFERENCES|INHERITS_FROM) /.test(x));
    assert(unexpected.length === 0, `${uuid}: nothing new but the membership and incoming references; new ${show(unexpected)}`);
  }
});

test('IW7 [AC6, ADR 0011]: the owner\'s graph writes on the concept answer as before; the owner\'s point of view leaves the other author\'s element out', async () => {
  F.needDecl();
  const seed = await P.seedProperties();
  const k = seed.keys;
  const uuidOf = (key) => seed.state.nodes.find((n) => n.props.tapestryKey === key).props.uuid;
  const b = { header: uuidOf(k.beagle), superset: uuidOf(k.beagleNodes.superset), schema: uuidOf(k.beagleNodes.jsonSchema), primaryProperty: uuidOf(k.beagleNodes.primaryProperty) };
  const w = (d, wordTypes, tags = []) => letter(al, { kind: 39999, at: 1700120000, tags: [['d', d], ['name', d], ...tags, ['json', JSON.stringify({ word: { slug: d, name: d, wordTypes } })]] });
  const prop = w('her-beagle-property', ['word', 'property']);
  const schema2 = w('her-beagle-schema', ['word', 'jsonSchema']);
  const set = w('her-beagle-set', ['word', 'set'], [['s', b.superset]]);
  const element = w('her-beagle', ['word', 'beagle'], [['z', b.header]]);
  const relProp = F.relationshipLetter(al, { d: 'her-prop-on-beagle', from: F.addressOf(prop), to: b.primaryProperty, type: 'IS_A_PROPERTY_OF' });
  const relSchema = F.relationshipLetter(al, { d: 'her-schema-for-beagle', from: F.addressOf(schema2), to: b.header, type: 'IS_THE_JSON_SCHEMA_FOR' });
  const graph = F.graphLetter(al, { d: 'her-beagle-graph', nodes: [{ slug: 'p', uuid: F.addressOf(prop) }, { slug: 'pp', uuid: b.primaryProperty }, { slug: 's', uuid: b.schema }], relationships: [['p', 'IS_A_PROPERTY_OF', 'pp'], ['pp', 'IS_A_PROPERTY_OF', 's']] });
  const all = [prop, schema2, set, element, relProp, relSchema, graph];
  const imported = F.runImport({ state: seed.state, signing: false, relays: { [F.PEER_RELAY]: F.relay(all) }, label: 'import-nostr-beagle', requests: [at('hers', { addresses: all.map(F.addressOf) })] });
  const d = F.data(imported, 'hers');
  assert(d.counts.recorded === all.length, `each of her letters is recorded; got ${show(d.counts)}`);
  const after = imported.state();
  const mine = F.nodesAt(after, F.addressOf(element))[0];
  const schemaInput = { type: 'object', properties: { beagle: { type: 'object', properties: { name: { type: 'string' }, slug: { type: 'string' }, description: { type: 'string' }, color: { type: 'string' }, size: { type: 'string' } } } } };
  const writes = [
    { id: 'set-schema', method: 'POST', url: '/api/tapestry/graph/set-schema', caller: 'owner', body: { concept: k.beagle, schema: schemaInput } },
    { id: 'list-owner', method: 'GET', url: `/api/tapestry/graph/list-elements?concept=${k.beagle}`, caller: 'owner' },
    { id: 'list-everyone', method: 'GET', url: `/api/tapestry/graph/list-elements?concept=${k.beagle}&pov=everyone`, caller: 'owner' },
  ];
  const store = (dir) => P.storeEntries(dir, seed.lmdb);
  const was = F.readWith(seed.state, writes, { signing: false, lmdb: store });
  const now = F.readWith(after, writes, { signing: false, lmdb: store });
  const mask = (x) => JSON.parse(JSON.stringify(x).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '<key>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, '<at>'));
  const tree = (x) => mask({ status: x.status, outcome: x.body.data && x.body.data.outcome, code: x.body.code, ...(x.body.data ? Object.fromEntries(['added', 'changed', 'removed', 'caughtUp', 'filledIn'].map((f) => [f, x.body.data[f]])) : {}) });
  const before = was.req('set-schema'), afterWrite = now.req('set-schema');
  assert(before.status === 200, `set-schema works on beagle before the import; got ${before.status} ${show(before.body).slice(0, 300)}`);
  assert(same(tree(before), tree(afterWrite)), `and answers as it did after her claims were imported: no claim of hers stops the owner's write; before ${show(tree(before)).slice(0, 600)} after ${show(tree(afterWrite)).slice(0, 600)}`);
  const lo = now.req('list-owner').body.data, le = now.req('list-everyone').body.data;
  const listed = (x) => (x.elements || []).some((e) => e.tapestryKey === mine.props.tapestryKey);
  assert(lo && !listed(lo) && lo.leftOut === was.req('list-owner').body.data.leftOut + 1, `from the owner's point of view her element is left out, since her key doesn't count; got ${show(lo).slice(0, 400)}`);
  assert(le && listed(le), `pov=everyone counts it; got ${show(le).slice(0, 400)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
