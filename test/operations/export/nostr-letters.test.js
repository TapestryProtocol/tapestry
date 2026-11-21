'use strict';
/**
 * export nostr — what a letter says, and whose letters it signs. Run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/34-export-nostr.md (AC2, AC4)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0034-export-nostr.md (Decisions 3, 4, 5 and 9;
 *          amendments 1, 2 and 3)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/34-export-nostr.test-plan.md
 *
 * Stack-free: the real catalog over test/helpers/exportFixtures.js's world on the Cypher engine, the fake relays, DNS and
 * strfry import, and the assistant's key. L1 exports pet's concept graph, which the graph operations made, to the
 * instance's own relay and to relay.example.com; EL6 then imports those letters with import nostr, from that relay,
 * into an empty graph of another instance (graphOpsSuite's assistant, so the letters are another author's there).
 *
 *   EL1  each kind of node the graph operations make (the header, the seven core nodes, a set, an element, a property)
 *        gets its letter from its own tags: its kind, d first, json last, the rest by type and then values, content
 *        empty, the assistant's pubkey; the JSON the node stores, where nothing in it needs rewriting
 *   EL2  a set's s from its parent links: Walkers, linked under Lap Pets and unlinked from pet's superset, names Lap Pets
 *        alone; pet's superset, linked under animal's, names it; Strays, under pet's superset and alice's cat
 *        superset, names pet's only (another author's parent derives nothing)
 *   EL3  z and n as the node holds them: Rex's letter names pet and Lap Pets, not animal, whose class thread reaches it;
 *        pet's superset keeps its z for superset, set and word (Context 3's conventions)
 *   EL4  the json is the stored JSON: Rex's inline json, not the stale copy the store holds under his key; big's json
 *        read through tapestry-resolve from its lmdb: pointer; graphContext taken out (big's, and context's inline one)
 *   EL5  bird's header carries its pointer b tags; Tweety, made in bird with graph create-element, gets a z stamp for
 *        each pointer or untyped b (alice's cat, bob's fish) and none for the inherit one (carol's lizard); Polly, which
 *        has cat's stamp, isn't given a second
 *   EL6  the round trip: import nostr records the letters into an empty graph: one node at each address, the names the
 *        exporting graph gives it, the JSON its letter carried, and every relationship among them a letter carries;
 *        nothing more but pet's superset's HAS_ELEMENT to Rex, whom the exporting graph reaches through Lap Pets
 *   EL7  the relationships no letter carries, graph enumerate's ENUMERATES and graph add-relationship's CITES, are
 *        reported uncarried-relationship with their type and two nodes; no relationship letter is made for them
 *   EL8  in a graph scope: alice's node and an admin's not-own, the owner's owner-signed, the assistant's own kind 1 node
 *        other-kind, a node with no address no-address; none signed or sent; the graph's letter still names them by
 *        address and id
 *   EL9  a node with no author at one of the assistant's addresses is signed; one with no author and no address isn't
 *   EL10 a tag past its fourth element: dog's note, changed by graph update-node, keeps its five-element e tag whole
 *   EL11 white space and key order in a json tag aren't a change: dog's Rex, its json tag rewritten so, is unchanged,
 *        while Polly, whose JSON changed, is changed
 *   Review round 1 (ADR 0034 Amendment 2):
 *   EL12 (item 4, finding 13; a pin, which today's code passes) a child whose b tag inherits from a parent, both sent:
 *        its INHERITS_FROM, which import nostr wires from that tag, isn't reported uncarried-relationship, while the link
 *        back, which no b tag carries, is
 */

const path = require('path');
const S = require('../../helpers/graphOpsSuite');
const X = require('../../helpers/exportFixtures');
const F = require('../../helpers/importFixtures');
const E = require('../../helpers/cypherEngine');
const CG = require('../../helpers/cypherGraphFake');

const { assert } = S;
const show = (x) => String(S.show(x));
const { test, run } = S.makeSuite('operations: export nostr — what a letter says, and whose letters it signs');
const { exp, NT, KEYS } = X;

const tagsOfType = (e, type) => (e.tags || []).filter((t) => t[0] === type);
const values = (e, type) => tagsOfType(e, type).map((t) => t[1]).sort();
const cmpTag = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] === undefined ? '' : a[i], y = b[i] === undefined ? '' : b[i]; if (x < y) return -1; if (x > y) return 1; } return 0; };
const without = (tags, types) => tags.filter((t) => !types.includes(t[0]));
const noContext = (j) => { if (!j || typeof j !== 'object') return j; const { graphContext, ...rest } = j; void graphContext; return rest; };
const same = (a, b) => JSON.stringify(sortDeep(a)) === JSON.stringify(sortDeep(b));
function sortDeep(x) {
  if (Array.isArray(x)) return x.map(sortDeep);
  if (x && typeof x === 'object') return Object.keys(x).sort().reduce((o, k) => { o[k] = sortDeep(x[k]); return o; }, {});
  return x;
}

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    X.needDecl();
    const w = await X.world();
    const k = w.keys;
    const base = { ownEvents: w.ownEvents, lmdb: w.lmdb };
    const before = X.copy(w.state);
    const l1 = X.runExport({ ...base, state: X.copy(w.state), relays: { [X.PEER]: F.relay([]) }, label: 'export-nostr-letters', requests: [exp('cg', 'owner', { graph: k.petConceptGraph, relays: [X.PEER] })] });
    return { w, k, base, before, l1, own1: l1.store(), peer1: l1.store(X.PEER) };
  })();
  return MAIN;
}
/** The letter the first export sent for a node, from the own relay. */
function sentFor(m, key) {
  const d = X.data(m.l1, 'cg');
  const l = X.letterFor(d, key);
  assert(l && l.id, `the export answered a letter for ${key}; got ${show(l)}`);
  const e = m.own1.find((x) => x.id === l.id);
  assert(e, `the own relay holds ${key}'s letter, ${l.id}`);
  return e;
}

test('EL1 [AC2, Decision 4]: each kind of node the graph operations make gets its letter from its tags: kind, d first, json last, the rest by type then values, content empty', async () => {
  const m = await main();
  const { k, before } = m;
  const kinds = { header: k.petHeader, superset: k.petSuperset, schema: k.petJsonSchema, primaryProperty: k.petPrimaryProperty, properties: k.petProperties, propertyTreeGraph: k.petPropertyTreeGraph, conceptGraph: k.petConceptGraph, coreNodesGraph: k.petCoreNodesGraph, set: k.lapPets, element: k.rex, property: k.friend };
  for (const [what, key] of Object.entries(kinds)) {
    const n = X.nodeByKey(before, key);
    const e = sentFor(m, key);
    const kind = Number(n.props.kind);
    assert(e.kind === kind && e.pubkey === X.TA && e.content === '', `${what}: kind ${kind}, the assistant's pubkey, content empty; got ${show({ kind: e.kind, pubkey: e.pubkey, content: e.content })}`);
    const d = n.props.uuid.split(':').slice(2).join(':');
    assert(JSON.stringify(e.tags[0]) === JSON.stringify(['d', d]), `${what}: d comes first; got ${show(e.tags[0])}`);
    const hasJson = X.tagArrays(before, n).some((t) => t[0] === 'json');
    if (hasJson) assert(e.tags[e.tags.length - 1][0] === 'json', `${what}: json comes last; got ${show(e.tags.map((t) => t[0]))}`);
    const middle = e.tags.slice(1, hasJson ? -1 : undefined);
    const ordered = [...middle].sort(cmpTag);
    assert(JSON.stringify(middle) === JSON.stringify(ordered), `${what}: the tags between d and json go by type, then values; got ${show(middle.map((t) => t.slice(0, 2)))}`);
    assert(X.sameTags(without(e.tags, ['json', 's']), without(X.tagArrays(before, n), ['json', 's'])), `${what}: its tags are the node's own (s and json aside, EL2 and EL4); letter ${show(without(e.tags, ['json']))} node ${show(without(X.tagArrays(before, n), ['json']))}`);
    if (hasJson) {
      const stored = X.jsonOf(before, key);
      assert(same(X.letterJson(e), noContext(stored)), `${what}: the json is the JSON the node stores; got ${show(X.letterJson(e)).slice(0, 300)}`);
    }
  }
});

test('EL2 [AC2, Decision 4.2, memo #114]: a set\'s s comes from its parent links now, never from its would-be s tag, and another author\'s parent gives none', async () => {
  const m = await main();
  const { w, k } = m;
  assert(JSON.stringify(values(sentFor(m, k.walkers), 's')) === JSON.stringify([w.addr.lapPets]), `Walkers, linked under Lap Pets and unlinked from pet's superset, names Lap Pets alone; got ${show(values(sentFor(m, k.walkers), 's'))}`);
  assert(JSON.stringify(values(sentFor(m, k.lapPets), 's')) === JSON.stringify([w.addr.petSuperset]), 'Lap Pets names pet\'s superset');
  assert(JSON.stringify(values(sentFor(m, k.petSuperset), 's')) === JSON.stringify([w.addr.animalSuperset]), `pet's superset, under animal's, names it; got ${show(values(sentFor(m, k.petSuperset), 's'))}`);
  assert(JSON.stringify(values(sentFor(m, k.strays), 's')) === JSON.stringify([w.addr.petSuperset]), `Strays, also under alice's cat superset, names pet's superset only; got ${show(values(sentFor(m, k.strays), 's'))}`);
});

test('EL3 [AC2, Decision 4.3, amendment 1]: z and n are as the node holds them: no z for a concept only its class thread reaches; a superset\'s z for word and superset kept', async () => {
  const m = await main();
  const { w, k } = m;
  const rex = sentFor(m, k.rex);
  assert(JSON.stringify(values(rex, 'z')) === JSON.stringify([w.addr.petHeader]) && JSON.stringify(values(rex, 'n')) === JSON.stringify([w.addr.lapPets]), `Rex names pet and Lap Pets as his tags do, and not animal, whose class thread reaches him; got z ${show(values(rex, 'z'))} n ${show(values(rex, 'n'))}`);
  const sup = sentFor(m, k.petSuperset);
  const fw = ['superset', 'set', 'word'].map((s) => w.fw.header(s)).sort();
  assert(JSON.stringify(values(sup, 'z')) === JSON.stringify(fw), `pet's superset keeps its z for superset, set and word; got ${show(values(sup, 'z'))}`);
});

test('EL4 [AC2, Decision 4.5, amendment 3]: the json is the stored JSON, read through tapestry-resolve for an lmdb: pointer, without graphContext, never the store\'s copy', async () => {
  const m = await main();
  const { w, k, base } = m;
  const rex = X.letterJson(sentFor(m, k.rex));
  assert(rex && rex.pet && rex.pet.description === 'a good dog' && !rex.graphContext, `Rex's letter carries his json tag's JSON, not the stale copy the store holds under his key; got ${show(rex)}`);
  const r = X.runExport({ ...base, state: X.copy(w.state), label: 'export-nostr-json', requests: [exp('big', 'owner', { node: k.dogBig }), exp('context', 'owner', { node: k.dogContext })] });
  const pick = (id, key) => { const l = X.letterFor(X.data(r, id), key); const e = l && r.store().find((x) => x.id === l.id); assert(e, `${id}: its letter was sent; got ${show(l)}`); return e; };
  const big = pick('big', k.dogBig);
  const bj = X.letterJson(big);
  assert(bj && bj.dog && bj.dog.name === 'Big Dog' && !('graphContext' in bj) && !X.strings(big).some((s) => s.startsWith('lmdb:')), `big's json is what its lmdb: pointer holds, without graphContext, and no pointer is left in the letter; got ${show(big.tags).slice(0, 500)}`);
  const cj = X.letterJson(pick('context', k.dogContext));
  assert(cj && cj.dog && cj.dog.name === 'Context Dog' && !('graphContext' in cj), `context's inline json loses its graphContext; got ${show(cj)}`);
});

test('EL5 [AC2, Decision 4.4 and 4.7; ADR 0020]: a header\'s pointer b tags are carried; an element gets a z stamp for each pointer or untyped b of its concept, and a stamp it has isn\'t doubled', async () => {
  const m = await main();
  const { w, k, base } = m;
  const r = X.runExport({ ...base, state: X.copy(w.state), label: 'export-nostr-stamps', requests: [exp('tweety', 'owner', { node: k.tweety }), exp('polly', 'owner', { node: k.polly }), exp('bird', 'owner', { node: k.birdHeader })] });
  const pick = (id, key) => { const l = X.letterFor(X.data(r, id), key); const e = l && r.store().find((x) => x.id === l.id); assert(e, `${id}: its letter was sent (${l && l.outcome}); got ${show(l)}`); return e; };
  const tweety = pick('tweety', k.tweety);
  assert(JSON.stringify(values(tweety, 'z')) === JSON.stringify([w.addr.birdHeader, w.addr.catHeader, w.addr.fishHeader].sort()), `Tweety names bird, and is stamped for cat (pointer) and fish (untyped), not lizard (inherit); got ${show(values(tweety, 'z'))}`);
  const polly = pick('polly', k.polly);
  assert(tagsOfType(polly, 'z').filter((t) => t[1] === w.addr.catHeader).length === 1 && values(polly, 'z').includes(w.addr.fishHeader), `Polly keeps her one cat stamp, not doubled, and gains fish's; got ${show(values(polly, 'z'))}`);
  const bird = pick('bird', k.birdHeader);
  const b = tagsOfType(bird, 'b').map((t) => JSON.stringify(t)).sort();
  assert(JSON.stringify(b) === JSON.stringify([['b', w.addr.catHeader, 'pointer'], ['b', w.addr.fishHeader], ['b', w.addr.lizardHeader, 'inherit']].map((t) => JSON.stringify(t)).sort()), `bird's header carries its b tags, from the header node; got ${show(b)}`);
});

test('EL6 [AC2, amendment 2]: the round trip: import nostr records the letters into an empty graph as one node each, with their names and JSON, and the relationships a letter carries', async () => {
  const m = await main();
  const { w, k, before, l1, peer1 } = m;
  const d = X.data(l1, 'cg');
  const sent = X.lettersOf(d);
  assert(sent.length === 20 && sent.every((l) => (X.relayOf(l, X.PEER) || {}).status === 'accepted'), `relay.example.com accepted the twenty; got ${show(sent.map((l) => l.relays))}`);
  const scope = X.petScope(k);
  const uuids = scope.map((key) => X.nodeByKey(before, key).props.uuid);
  const back = F.runImport({ state: F.emptyGraph(), signing: false, relays: { [X.PEER]: F.relay(peer1) }, label: 'export-nostr-roundtrip', requests: [F.imp('back', 'admin', { addresses: uuids, relay: X.PEER })] });
  const got = F.data(back, 'back');
  assert(got.counts.recorded === 20 && got.counts.failed === 0, `import nostr records all twenty; got ${show(got.counts)}`);
  const s2 = back.state();
  for (const key of scope) {
    const n = X.nodeByKey(before, key);
    const there = F.nodesAt(s2, n.props.uuid);
    assert(there.length === 1, `${n.props.uuid}: one node at its address; got ${there.length}`);
    const name = n.props.tapestryValue || n.props.name;
    assert(there[0].props.name === name, `${n.props.uuid}: the name the exporting graph gives it, ${name}; got ${there[0].props.name}`);
    const letter = peer1.find((e) => e.id === (X.letterFor(d, key) || {}).id);
    const stored = X.jsonOf(before, key);
    if (stored) {
      const json = X.jsonOf(s2, there[0]);
      assert(same(json, X.letterJson(letter)), `${n.props.uuid}: the JSON its letter carried`);
      if (!X.strings(stored).some((s) => s.includes('tapestry:'))) assert(same(json, noContext(stored)), `${n.props.uuid}: which is the JSON the exporting graph stores, less what is local`);
    }
  }
  const at = new Set(uuids);
  const relsAmong = (s) => F.relsOf(s, {}).filter((r) => r.type !== 'HAS_TAG' && r.fromNode && r.toNode && at.has(r.fromNode.props.uuid) && at.has(r.toNode.props.uuid)).map((r) => `${r.fromNode.props.uuid} ${r.type} ${r.toNode.props.uuid}`);
  const exporting = relsAmong(before);
  const carried = exporting.filter((x) => !/ (CITES|ENUMERATES) /.test(x));
  const imported = relsAmong(s2);
  const missing = carried.filter((x) => !imported.includes(x));
  assert(missing.length === 0, `every relationship among them that a letter carries is in the importing graph; missing ${show(missing)}`);
  const allowed = new Set([`${w.addr.petSuperset} HAS_ELEMENT ${w.addr.rex}`]);
  const extra = imported.filter((x) => !carried.includes(x) && !allowed.has(x));
  assert(extra.length === 0, `and nothing more, but the superset's HAS_ELEMENT to Rex, whom the exporting graph reaches through Lap Pets; extra ${show(extra)}`);
});

test('EL7 [AC2, Decision 9]: enumerate\'s ENUMERATES and add-relationship\'s CITES, which no letter carries, are reported with their type and two nodes; no letter is made for them', async () => {
  const m = await main();
  const { w, k, l1, own1, peer1 } = m;
  const d = X.data(l1, 'cg');
  const found = X.reportsOf(d, 'uncarried-relationship');
  // A node is named by its tapestryKey or its address.
  const names = (r, name) => X.mentions(r, k[name]) || X.mentions(r, w.addr[name]);
  const reported = (type, from, to) => found.some((r) => X.mentions(r, type) && names(r, from) && names(r, to));
  assert(reported('ENUMERATES', 'petSuperset', 'friend'), `pet's superset ENUMERATES friend is reported, with its type and its two nodes; got ${show(found)}`);
  // ADR 0034 Decision 9 limits the report to the types structureTypes allows, which add-relationship's never are; AC2,
  // the plan's EL7 and Decision 9's own list ("add-relationship's links … are reported this way") report it. Raised for
  // the Architect at Test Design.
  assert(reported('CITES', 'rex', 'tom'), `Rex CITES Tom is reported, with its type and its two nodes; got ${show(found)}`);
  const relationshipLetters = [...own1, ...peer1].filter((e) => e.tags.some((t) => t[0] === 'relationshipType' || t[0] === 'nodeFrom'));
  assert(relationshipLetters.length === 0, `no relationship letter was made up to carry them; got ${show(relationshipLetters).slice(0, 300)}`);
});

test('EL8 [AC4, Decision 3]: in a graph scope, another author\'s node is not-own, the owner\'s owner-signed, another kind other-kind, no address no-address; none signed or sent, and the graph\'s letter names them as before', async () => {
  const m = await main();
  const { w, k, base } = m;
  const r = X.runExport({ ...base, state: X.copy(w.state), label: 'export-nostr-whose', requests: [exp('others', 'owner', { graph: k.others })] });
  const d = X.data(r, 'others');
  const outcome = (key) => (X.letterFor(d, key) || {}).outcome;
  const want = { [k.catHeader]: 'not-own', [k.adminNode]: 'not-own', [k.ownerNode]: 'owner-signed', [k.taNote]: 'other-kind', [k.nowhere]: 'no-address', [k.rex]: 'new', [k.others]: 'new' };
  for (const [key, o] of Object.entries(want)) assert(outcome(key) === o, `${key}: ${o}; got ${show(X.letterFor(d, key))}`);
  const held = r.store();
  assert(held.every((e) => e.pubkey === X.TA) && X.signings(r.spy) === 2, `only the assistant's two letters were signed and sent (the graph's and Rex's); got ${show(held.map((e) => [e.pubkey.slice(0, 8), X.addressOf(e)]))}, ${X.signings(r.spy)} signings`);
  assert(!r.log().some((x) => x.at === 'publish'), 'and nothing else went anywhere');
  const graph = X.letterJson(held.find((e) => e.id === X.letterFor(d, k.others).id));
  const listed = ((graph && graph.graph && graph.graph.nodes) || []).map((x) => x.uuid);
  for (const a of [w.addr.catHeader, w.addr.adminNode, w.addr.ownerNode, w.letters.taNote.id, w.addr.nowhereId]) assert(listed.includes(a), `the graph's letter still names ${a} as the graph does; got ${show(listed)}`);
});

test('EL9 [AC4, Decision 3]: a node with no author whose address carries the assistant\'s key is signed; one with no author and no address isn\'t', async () => {
  const m = await main();
  const { w, k, base } = m;
  const r = X.runExport({ ...base, state: X.copy(w.state), label: 'export-nostr-authorless', requests: [exp('no-author', 'owner', { node: k.noAuthor }), exp('nowhere', 'owner', { node: k.nowhere })] });
  const a = X.letterFor(X.data(r, 'no-author'), k.noAuthor);
  const e = a && r.store().find((x) => x.id === a.id);
  assert(a && a.outcome === 'new' && e && e.pubkey === X.TA && X.addressOf(e) === w.addr.noAuthor && NT.verifyEvent(X.copy(e)), `the node with no author at the assistant's address is signed as the assistant; got ${show(a)}`);
  const b = X.letterFor(X.data(r, 'nowhere'), k.nowhere);
  assert(b && b.outcome === 'no-address', `the one with no author and no address is no-address; got ${show(b)}`);
  assert(X.signings(r.spy) === 1, `one letter signed in all; the spy saw ${show(r.spy)}`);
});

test('EL10 [AC2, Decision 4.8]: a tag past its fourth element: dog\'s note, changed by graph update-node, keeps its five-element e tag whole in its new letter', async () => {
  const m = await main();
  const { w, k, base } = m;
  const file = path.join(S.tmp('export-nostr-five-'), 'graph.json');
  CG.writeState(file, X.copy(w.state));
  X.data(X.runOps(file, [X.op('colour', 'update-node', { node: k.dogNote, fields: { colour: 'brown' } })]), 'colour');
  const r = X.runExport({ ...base, file, requests: [exp('note', 'owner', { node: k.dogNote })] });
  const l = X.letterFor(X.data(r, 'note'), k.dogNote);
  assert(l && l.outcome === 'changed', `the note, changed since its letter, is changed; got ${show(l)}`);
  const e = r.store().find((x) => x.id === l.id);
  const five = ['e', w.letters.aliceNote.id, X.PEER, 'mention', KEYS.alice.pubkey];
  assert(e && e.tags.some((t) => JSON.stringify(t) === JSON.stringify(five)), `its new letter keeps the e tag whole, all five elements; got ${show(e && e.tags.filter((t) => t[0] === 'e'))}`);
  assert(X.letterJson(e).dog.colour === 'brown', 'and carries the change');
});

test('EL11 [AC5, Decision 5]: white space and key order in a json tag aren\'t a change: dog\'s Rex, so rewritten, is unchanged, while Polly, whose JSON changed, is changed', async () => {
  const m = await main();
  const { w, k, base } = m;
  const s = X.copy(w.state);
  const setJson = (key, value) => {
    const n = X.nodeByKey(s, key);
    const t = F.tagsOf(s, n).find((x) => x.props.type === 'json');
    E.run(s, 'MATCH (t:NostrEventTag {uuid: $uuid}) SET t.value = $value', { uuid: t.props.uuid, value });
  };
  const rex = X.jsonOf(s, k.dogRex);
  setJson(k.dogRex, JSON.stringify(sortDeep(rex), null, 2));
  setJson(k.polly, JSON.stringify({ ...X.jsonOf(s, k.polly), bird: { name: 'Polly Parrot' } }));
  const r = X.runExport({ ...base, state: s, label: 'export-nostr-spaces', requests: [exp('rex', 'owner', { node: k.dogRex }), exp('polly', 'owner', { node: k.polly })] });
  assert((X.letterFor(X.data(r, 'rex'), k.dogRex) || {}).outcome === 'unchanged', `dog's Rex, whose json tag differs from his letter's only in white space and key order, is unchanged; got ${show(X.letterFor(X.data(r, 'rex'), k.dogRex))}`);
  assert((X.letterFor(X.data(r, 'polly'), k.polly) || {}).outcome === 'changed', `Polly, whose JSON changed, is changed; got ${show(X.letterFor(X.data(r, 'polly'), k.polly))}`);
  assert(X.signings(r.spy) === 1, `only Polly is signed; the spy saw ${show(r.spy)}`);
});

test('EL12 [AC2 and Decision 9, as amended at Review: Amendment 2 item 4; review round 1, finding 13] (round 1, a pin): an INHERITS_FROM carried by its node\'s b tag isn\'t reported uncarried-relationship; one no b tag carries is', async () => {
  const m = await main();
  const { w, base } = m;
  const s = X.copy(w.state);
  const at = (slug) => `39999:${X.TA}:${slug}`;
  // A child whose b tag inherits from a parent, as import nostr wires INHERITS_FROM from it, and the link back with no
  // b tag to carry it; both sent in one call, through a graph that lists them.
  const parent = await X.eventlessNode(s, { uuid: at('inherit-parent'), name: 'Inherit Parent', tags: [['d', 'inherit-parent'], ['name', 'Inherit Parent']] });
  const child = await X.eventlessNode(s, { uuid: at('inherit-child'), name: 'Inherit Child', tags: [['d', 'inherit-child'], ['name', 'Inherit Child'], ['b', at('inherit-parent'), 'inherit']] });
  E.run(s, 'MATCH (c:TapestryNode {tapestryKey: $child}), (p:TapestryNode {tapestryKey: $parent}) CREATE (c)-[:INHERITS_FROM]->(p), (p)-[:INHERITS_FROM]->(c)', { child, parent });
  const graph = await X.graphNode(s, { slug: 'inherit-pair', nodes: [{ slug: 'inherit-child', uuid: at('inherit-child') }, { slug: 'inherit-parent', uuid: at('inherit-parent') }] });
  const r = X.runExport({ ...base, state: s, label: 'export-nostr-b-carries', requests: [exp('pair', 'owner', { graph, dryRun: true })] });
  const d = X.data(r, 'pair');
  assert(X.sameSet(X.lettersOf(d).map(X.keyOf), [graph, child, parent]), `the call has the graph and both nodes; got ${show(X.lettersOf(d).map(X.keyOf))}`);
  const found = X.reportsOf(d, 'uncarried-relationship');
  const reported = (from, to) => found.some((rep) => X.mentions(rep, 'INHERITS_FROM') && rep.from === from && rep.to === to);
  assert(reported(parent, child), `the INHERITS_FROM no b tag carries, parent to child, is reported; got ${show(found)}`);
  assert(!reported(child, parent), `the child's, which its b tag carries, isn't reported; got ${show(found)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
