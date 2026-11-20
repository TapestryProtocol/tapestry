'use strict';
/**
 * import nostr — safe to repeat, in any order, version by version. Run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/32-import-nostr.md (AC3; AC1's "a node one of today's
 *          importers made for the same event is that node")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0032-import-nostr.md (Decisions 4, 7.3, 7.4, 7.8,
 *          7.9, 8 and 13)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/32-import-nostr.test-plan.md
 *
 * Stack-free, over test/helpers/cypherGraphFake.js, whose engine keeps Neo4j's uniqueness rules, so memo #130's
 * failure would happen here as it does on Neo4j (test/operations/import/cypher-engine.test.js, CE4, shows today's
 * builder failing it). The live check runs memo #130's pair and two imports at once on a scratch stack's Neo4j too.
 * Each run starts from the assistant's concept dog (importFixtures.js's ownConcept) unless it says otherwise.
 *
 *   IO1  a repeat: every event already recorded, at its version, answers unchanged; no entry; the graph as it was
 *   IO2  memo #130: a referrer by e before its addressable target, then the target: one node at the address holding
 *        its id and its tags, the reference pointing at it, the placeholder's key kept; placeholder-filled
 *   IO3  a referrer with the e and the matching a, before its target: one node, both references on it; placeholder-merged
 *   IO4  a b naming an event by id before the event, for an addressable target and a regular one (inherit): one node
 *   IO5  each claim whose other end arrives second: z (the concept's IS_THE_CONCEPT_FOR after the element), n, s, a
 *        relationship letter's ends, a graph element's nodes
 *   IO6  placeholders: two referrers to one missing address make one placeholder, which the event fills; by id the same
 *   IO7  a newer version: updated, the same node and key; its tags replace the older's, and the older's b, z, n and s
 *        relationships go, tag-level references with their tags; what the owner added stays (a membership kept beside
 *        in tapestryOwnSections, a relationship), as do a relationship letter's and the role labels; no name, no name
 *   IO8  an older version answers older and writes nothing; on a tie of created_at the lower id stands
 *   IO9  a node today's builder made for the same event is that node: its key kept, its tags rewritten once, then
 *        unchanged; a replaceable event's id-keyed node moves to its address, unless a node already holds it
 *   IO10 the same events in three orders make the same graph, and none fails
 *   IO11 Decision 7.9: a placeholder another import made meanwhile is met by a second run; two failures, or another
 *        error, answer failed with the error's words and the call goes on; the database unreachable fails the call
 *        (500), keeping what it recorded
 */

const S = require('../../helpers/graphOpsSuite');
const F = require('../../helpers/importFixtures');
const CG = require('../../helpers/cypherGraphFake');

const { assert, show } = S;
const { test, run } = S.makeSuite('operations: import nostr — safe to repeat, in any order, version by version');
const { KEYS, imp, letter } = F;
const al = KEYS.alice, bob = KEYS.bob, carol = KEYS.carol;
const A = (kind, key, d) => `${kind}:${key.pubkey}:${d}`;
const at = (rid, body, caller = 'admin') => imp(rid, caller, { relay: F.PEER_RELAY, ...body });
const byAddr = (rid, events) => at(rid, { addresses: events.map(F.addressOf) });
const byId = (rid, events) => at(rid, { ids: events.map((e) => e.id) });
const one = (s, uuid, what) => { const ns = F.nodesAt(s, uuid); assert(ns.length === 1, `${what}: one node at ${uuid}; got ${ns.length} ${show(ns).slice(0, 300)}`); return ns[0]; };
const noFailure = (d, what) => assert(d.counts.failed === 0 && !(d.events || []).some((e) => e.outcome === 'failed'), `${what}: no import failed; got ${show(d.events).slice(0, 400)}`);

// ── IO2–IO6: memo #130 and every other end that arrives second ──
const T = letter(al, { kind: 39999, at: 1700010000, tags: [['d', 'target'], ['name', 'Target'], ['t', 'x']] });
const Rf = letter(bob, { kind: 1, at: 1700010001, tags: [['e', T.id]], content: 'see the target' });
const T2 = letter(al, { kind: 39999, at: 1700010002, tags: [['d', 'target-two'], ['name', 'Target Two']] });
const Rf2 = letter(bob, { kind: 1, at: 1700010003, tags: [['e', T2.id], ['a', F.addressOf(T2)]], content: 'see target two, both ways' });
const T3 = letter(al, { kind: 39999, at: 1700010004, tags: [['d', 'target-three'], ['name', 'Target Three']] });
const Rf3 = letter(bob, { kind: 39999, at: 1700010005, tags: [['d', 'pointer'], ['b', T3.id]] });
const N4 = letter(al, { kind: 1, at: 1700010006, content: 'a regular event, named by a b' });
const Rf4 = letter(bob, { kind: 39999, at: 1700010007, tags: [['d', 'pointer-two'], ['b', N4.id, 'inherit']] });
const cat = F.conceptLetters(al, 'cat', { at: 1700010100 });
const Ez = letter(al, { kind: 39999, at: 1700010101, tags: [['d', 'ez'], ['name', 'Ez'], ['z', cat.addr.header]] });
const Linit = F.relationshipLetter(al, { d: 'cat-init', from: cat.addr.header, to: cat.addr.superset, type: 'IS_THE_CONCEPT_FOR', at: 1700010102 });
const Sn = letter(al, { kind: 39999, at: 1700010103, tags: [['d', 'sn'], ['name', 'Sn'], ['s', cat.addr.superset]] });
const En = letter(al, { kind: 39999, at: 1700010104, tags: [['d', 'en'], ['name', 'En'], ['n', F.addressOf(Sn)]] });
const Us = letter(al, { kind: 39999, at: 1700010105, tags: [['d', 'us'], ['name', 'Us']] });
const Ss = letter(al, { kind: 39999, at: 1700010106, tags: [['d', 'ss'], ['name', 'Ss'], ['s', F.addressOf(Us)]] });
const P1 = letter(al, { kind: 39999, at: 1700010107, tags: [['d', 'p1'], ['name', 'P1']] });
const P2 = letter(al, { kind: 39999, at: 1700010108, tags: [['d', 'p2'], ['name', 'P2']] });
const Lr = F.relationshipLetter(al, { d: 'p1-p2', from: F.addressOf(P1), to: F.addressOf(P2), type: 'SUPERCEDES', at: 1700010109 });
const G1 = letter(al, { kind: 39999, at: 1700010110, tags: [['d', 'g1'], ['name', 'G1']] });
const G2 = letter(al, { kind: 39999, at: 1700010111, tags: [['d', 'g2'], ['name', 'G2']] });
const Gr = F.graphLetter(al, { d: 'g-graph', nodes: [{ slug: 'g1', uuid: F.addressOf(G1) }, { slug: 'g2', uuid: F.addressOf(G2) }], relationships: [['g1', 'IMPORT', 'g2']], at: 1700010112 });
const M6 = letter(al, { kind: 39999, at: 1700010113, tags: [['d', 'missing-for-two'], ['name', 'M6']] });
const R6a = letter(bob, { kind: 1, at: 1700010114, tags: [['a', F.addressOf(M6)]], content: 'bob names M6' });
const R6b = letter(carol, { kind: 1, at: 1700010115, tags: [['a', F.addressOf(M6)]], content: 'carol names M6' });
const X6 = letter(al, { kind: 1, at: 1700010116, content: 'a regular event named by id' });
const R6c = letter(bob, { kind: 1, at: 1700010117, tags: [['e', X6.id]], content: 'bob names X6' });
const ORDER_EVENTS = [T, Rf, T2, Rf2, T3, Rf3, N4, Rf4, ...cat.all, Ez, Linit, Sn, En, Us, Ss, P1, P2, Lr, G1, G2, Gr, M6, R6a, R6b, X6, R6c];

let ORDER = null;
function order() {
  if (ORDER) return ORDER;
  ORDER = (async () => {
    F.needDecl();
    const state = F.emptyGraph();
    F.ownConcept(state);
    const r = F.runImport({
      state, label: 'import-nostr-order', relays: { [F.PEER_RELAY]: F.relay(ORDER_EVENTS) },
      requests: [
        byId('o-rf', [Rf]), byAddr('o-t', [T]),
        byId('o-rf2', [Rf2]), byAddr('o-t2', [T2]),
        byAddr('o-rf3', [Rf3]), byAddr('o-t3', [T3]),
        byAddr('o-rf4', [Rf4]), byId('o-n4', [N4]),
        byAddr('o-ez', [Ez]), byAddr('o-cat', [cat.letters.header, cat.letters.superset]), byAddr('o-linit', [Linit]),
        byAddr('o-en', [En]), byAddr('o-sn', [Sn]),
        byAddr('o-ss', [Ss]), byAddr('o-us', [Us]),
        byAddr('o-lr', [Lr]), byAddr('o-p', [P1, P2]),
        byAddr('o-gr', [Gr]), byAddr('o-g', [G1, G2]),
        byId('o-r6a', [R6a]), byId('o-r6b', [R6b]), byId('o-r6c', [R6c]), byAddr('o-m6', [M6]), byId('o-x6', [X6]),
      ],
    });
    return { r, after: r.state(), mid: null };
  })();
  return ORDER;
}

test('IO2 [AC3, memo #130]: a referrer by e before its addressable target, then the target: one node, the reference on it', async () => {
  const { r, after } = await order();
  const first = F.data(r, 'o-rf');
  noFailure(first, 'the referrer');
  const d = F.data(r, 'o-t');
  noFailure(d, 'the target');
  const [x] = F.forRef(d, F.addressOf(T));
  assert(x && x.outcome === 'recorded' && x.id === T.id, `the target is recorded; got ${show(x)}`);
  const n = one(after, F.addressOf(T), 'the target');
  assert(n.props.id === T.id && n.props.created_at === T.created_at && n.labels.includes('ListItem') && !F.isPlaceholder(n), `the node at its address holds its id and created_at; got ${show(n)}`);
  assert(F.withId(after, T.id).length === 1 && F.nodesAt(after, T.id).length === 0, 'one node with its id, and none left keyed by the id');
  assert(F.tagsOf(after, n).length === T.tags.length, `its tags; got ${F.tagsOf(after, n).length}`);
  const rf = one(after, Rf.id, 'the referrer');
  const refs = F.relsOf(after, { type: 'REFERENCES' }).filter((y) => F.tagsOf(after, rf).some((t) => t.eid === y.from));
  assert(refs.length === 1 && refs[0].to === n.eid, `the referrer's e tag REFERENCES the target's node; got ${show(refs.map((y) => y.toNode.props))}`);
  const entryOfRf = F.entries(after).find((e) => e.operation === 'import nostr' && e.keys.includes(rf.props.tapestryKey));
  const entryOfT = F.entries(after).find((e) => e.operation === 'import nostr' && e.keys.includes(n.props.tapestryKey) && e.changes.some((c) => c.change === 'placeholder-filled'));
  assert(entryOfRf && entryOfRf.keys.includes(n.props.tapestryKey), `the placeholder the referrer made is the node now: the referrer's entry named its key, and the node keeps it; got ${show(entryOfRf)}`);
  assert(entryOfT && entryOfT.changes.some((c) => c.change === 'placeholder-filled' && c.node === n.props.tapestryKey), `the target's entry records placeholder-filled, naming the node; got ${show(entryOfT)}`);
});

test('IO3 [AC3, memo #130]: a referrer with both the e and the matching a, before its target: one node, both references on it', async () => {
  const { r, after } = await order();
  noFailure(F.data(r, 'o-rf2'), 'the referrer');
  const d = F.data(r, 'o-t2');
  noFailure(d, 'the target');
  const n = one(after, F.addressOf(T2), 'target two');
  assert(n.props.id === T2.id && F.withId(after, T2.id).length === 1 && F.nodesAt(after, T2.id).length === 0, `one node at the address holding the id; got ${show(F.withId(after, T2.id))}`);
  const rf = one(after, Rf2.id, 'the referrer');
  const refs = F.relsOf(after, { type: 'REFERENCES' }).filter((y) => F.tagsOf(after, rf).some((t) => t.eid === y.from));
  assert(refs.length === 2 && refs.every((y) => y.to === n.eid), `both tags REFERENCE the one node; got ${show(refs.map((y) => y.toNode.props))}`);
  const entry = F.entries(after).find((e) => e.operation === 'import nostr' && e.keys.includes(n.props.tapestryKey) && e.changes.some((c) => c.change === 'placeholder-merged'));
  assert(entry, `the target's entry names the placeholder it merged (placeholder-merged); got ${show(F.entries(after).filter((e) => e.keys.includes(n.props.tapestryKey)).map((e) => e.changes))}`);
});

test('IO4 [AC3]: a b naming an event by id, before the event: one node, for an addressable target and a regular one', async () => {
  const { r, after } = await order();
  for (const rid of ['o-rf3', 'o-t3', 'o-rf4', 'o-n4']) noFailure(F.data(r, rid), rid);
  const t3 = one(after, F.addressOf(T3), 'target three');
  assert(F.withId(after, T3.id).length === 1 && F.nodesAt(after, T3.id).length === 0, 'one node holds target three\'s id, at its address');
  const p3 = one(after, F.addressOf(Rf3), 'the pointer');
  assert(F.relsOf(after, { type: 'REFERENCES' }).filter((y) => y.from === p3.eid && y.to === t3.eid && y.props.source === 'b-tag').length === 1, 'the pointer\'s b REFERENCES target three\'s node');
  const n4 = one(after, N4.id, 'the regular event');
  assert(F.withId(after, N4.id).length === 1 && !F.isPlaceholder(n4), 'one node holds N4\'s id, filled in');
  const p4 = one(after, F.addressOf(Rf4), 'the second pointer');
  assert(F.relsOf(after, { type: 'INHERITS_FROM' }).filter((y) => y.from === p4.eid && y.to === n4.eid).length === 1, 'the inherit b is INHERITS_FROM N4\'s node');
});

test('IO5 [AC3, Decision 8]: each claim whose other end arrives second is made when it arrives', async () => {
  const { r, after } = await order();
  for (const rid of ['o-ez', 'o-cat', 'o-linit', 'o-en', 'o-sn', 'o-ss', 'o-us', 'o-lr', 'o-p', 'o-gr', 'o-g']) noFailure(F.data(r, rid), rid);
  const sup = one(after, cat.addr.superset, 'cat\'s superset');
  const ez = one(after, F.addressOf(Ez), 'Ez');
  assert(F.relsOf(after, { type: 'HAS_ELEMENT' }).filter((y) => y.from === sup.eid && y.to === ez.eid).length === 1,
    'z: Ez named cat before cat was wired; the relationship letter that made cat\'s IS_THE_CONCEPT_FOR gave its superset the HAS_ELEMENT to Ez, in the same transaction');
  const sn = one(after, F.addressOf(Sn), 'Sn');
  const en = one(after, F.addressOf(En), 'En');
  assert(!F.isPlaceholder(sn) && sn.props.id === Sn.id && F.relsOf(after, { type: 'HAS_ELEMENT' }).filter((y) => y.from === sn.eid && y.to === en.eid).length === 1, 'n: the set arrived after the element; its placeholder is filled, the HAS_ELEMENT on it');
  const us = one(after, F.addressOf(Us), 'Us');
  const ss = one(after, F.addressOf(Ss), 'Ss');
  assert(!F.isPlaceholder(us) && F.relsOf(after, { type: 'IS_A_SUPERSET_OF' }).filter((y) => y.from === us.eid && y.to === ss.eid).length === 1, 's: the parent arrived second; IS_A_SUPERSET_OF from its node');
  const p1 = one(after, F.addressOf(P1), 'P1'), p2 = one(after, F.addressOf(P2), 'P2');
  assert(!F.isPlaceholder(p1) && !F.isPlaceholder(p2) && F.relsOf(after, { type: 'SUPERCEDES' }).filter((y) => y.from === p1.eid && y.to === p2.eid).length === 1, 'a relationship letter whose ends arrived after it: the relationship, between the filled nodes');
  const g1 = one(after, F.addressOf(G1), 'G1'), g2 = one(after, F.addressOf(G2), 'G2');
  assert(!F.isPlaceholder(g1) && F.relsOf(after, { type: 'IMPORT' }).filter((y) => y.from === g1.eid && y.to === g2.eid).length === 1, 'a graph element imported by address, its nodes after it: its relationship, between them');
});

test('IO6 [AC3]: two referrers to one missing address make one placeholder, which the event fills; by id the same', async () => {
  const { r, after } = await order();
  for (const rid of ['o-r6a', 'o-r6b', 'o-r6c', 'o-m6', 'o-x6']) noFailure(F.data(r, rid), rid);
  const m6 = one(after, F.addressOf(M6), 'M6');
  assert(m6.props.id === M6.id && !F.isPlaceholder(m6), 'M6 filled its placeholder: one node');
  for (const e of [R6a, R6b]) {
    const n = one(after, e.id, 'a referrer');
    assert(F.relsOf(after, { type: 'REFERENCES' }).some((y) => F.tagsOf(after, n).some((t) => t.eid === y.from) && y.to === m6.eid), `${e.id.slice(0, 8)}…'s a tag REFERENCES M6's node`);
  }
  const x6 = one(after, X6.id, 'X6');
  assert(x6.props.id === X6.id && !F.isPlaceholder(x6) && F.withId(after, X6.id).length === 1, 'X6 filled the placeholder found by its id');
});

// ── IO1: a repeat ──
test('IO1 [AC3]: a repeat answers unchanged, records no entry, and leaves the graph as it was', async () => {
  F.needDecl();
  const state = F.emptyGraph();
  F.ownConcept(state);
  const batch = (rid) => [byId(`${rid}-ids`, [Rf, Rf2, N4, X6, R6c]), byAddr(`${rid}-addr`, [T, T2, T3, Rf3, Rf4, Ez, cat.letters.header, cat.letters.superset, Linit, Sn, En, Gr, G1, G2])];
  const relays = { [F.PEER_RELAY]: F.relay(ORDER_EVENTS) };
  const a = F.runImport({ state, relays, requests: batch('first'), label: 'import-nostr-repeat' });
  F.data(a, 'first-ids'); F.data(a, 'first-addr');
  const mid = a.state();
  const b = F.runImport({ file: a.file, relays, requests: batch('again') });
  const after = b.state();
  for (const rid of ['again-ids', 'again-addr']) {
    const d = F.data(b, rid);
    assert(d.events.length > 0 && d.events.every((e) => e.outcome === 'unchanged') && d.changes === 0 && d.counts.unchanged === d.events.length, `${rid}: every event unchanged, no entry; got ${show(d.events.map((e) => e.outcome))} changes ${d.changes}`);
  }
  assert(F.sameGraph(mid, after), `the graph is as it was; differs: ${show(F.graphDiff(mid, after))}`);
  assert(F.entries(after).length === F.entries(mid).length, 'and no change entry was added');
});

// ── IO7 and IO8: versions ──
test('IO7 [AC3, Decision 8]: a newer version replaces the older\'s tag claims; what the owner added, a relationship letter\'s claim and role labels stay', async () => {
  F.needDecl();
  const state = F.emptyGraph();
  const dog = F.ownConcept(state);
  const target7 = letter(bob, { kind: 1, at: 1700020000, content: 'target seven' });
  const item7 = letter(bob, { kind: 39999, at: 1700020001, tags: [['d', 'item-seven']] });
  const S7 = letter(al, { kind: 39999, at: 1700020002, tags: [['d', 's7'], ['name', 'S7']] });
  const U7 = letter(al, { kind: 39999, at: 1700020003, tags: [['d', 'u7'], ['name', 'U7']] });
  const evo = (when, tags, wordTypes) => letter(al, { kind: 39999, at: when, tags: [['d', 'evolving'], ...tags, ['json', JSON.stringify({ word: { slug: 'evolving', name: 'Evolving', wordTypes } })]] });
  const v1 = evo(1700020010, [['name', 'Old Name'], ['z', dog.addr.header], ['z', cat.addr.header], ['n', F.addressOf(S7)], ['s', F.addressOf(U7)], ['b', F.addressOf(item7)], ['e', target7.id], ['t', 'old']], ['word', 'set']);
  const v2 = evo(1700020020, [['t', 'new']], ['word']);
  const rel7 = F.relationshipLetter(al, { d: 'evolving-supercedes', from: F.addressOf(v1), to: F.addressOf(S7), type: 'SUPERCEDES', at: 1700020011 });
  const relays = { [F.PEER_RELAY]: F.relay([target7, item7, S7, U7, v1, v2, rel7, cat.letters.header, cat.letters.superset, Linit]) };
  const a = F.runImport({
    state, relays, label: 'import-nostr-versions',
    requests: [byId('v-target', [target7]), byAddr('v-setup', [item7, S7, U7, cat.letters.header, cat.letters.superset, Linit]), at('v1', { ids: [v1.id] }), byAddr('v-rel', [rel7])],
  });
  F.data(a, 'v1');
  // What the owner added with the graph operations, as add-to-concept and add-relationship leave it: dog's section kept
  // beside alice's letter (her z already made dog's membership), and a relationship to the assistant's Rex.
  const s = a.state();
  const node1 = one(s, F.addressOf(v1), 'evolving');
  const key = node1.props.tapestryKey;
  node1.props.tapestryOwnSections = JSON.stringify({ dog: { name: 'Evolving', slug: 'evolving' } });
  const rex = one(s, dog.addr.element, 'Rex');
  s.rels.push({ eid: s.nextEid++, type: 'CITES', from: node1.eid, to: rex.eid, props: {} });
  const oldTags = F.tagsOf(s, node1).map((t) => t.props.uuid);
  CG.writeState(a.file, s);
  const b = F.runImport({ file: a.file, relays, requests: [at('v2', { ids: [v2.id] }), at('v1-again', { ids: [v1.id] })] });
  const after = b.state();
  const d = F.data(b, 'v2');
  assert(d.events[0].outcome === 'updated' && d.changes === 1, `the newer version: updated; got ${show(d.events)}`);
  const n = one(after, F.addressOf(v2), 'evolving, updated');
  assert(n.props.tapestryKey === key && n.props.id === v2.id && n.props.created_at === v2.created_at, `the same node, its key kept, holding the newer id and created_at; got ${show(n.props)}`);
  assert(n.props.name === undefined && n.props.tapestryValue === undefined, 'the newer has no name tag: name and tapestryValue are taken out');
  const tags = F.tagsOf(after, n);
  assert(tags.length === v2.tags.length && tags.every((t) => t.props.uuid.startsWith(`${v2.id}_`)), `its tags are the newer's; got ${show(tags.map((t) => t.props.uuid))}`);
  assert(oldTags.every((u) => F.live(after).every((x) => x.props.uuid !== u)), 'the older\'s tag nodes are gone');
  const into = (type, fromUuid) => F.relsOf(after, { type, from: fromUuid }).filter((y) => y.to === n.eid);
  assert(into('HAS_ELEMENT', cat.addr.superset).length === 0, 'the older\'s z on cat, which the newer doesn\'t claim, is taken out');
  assert(into('HAS_ELEMENT', F.addressOf(S7)).length === 0 && into('IS_A_SUPERSET_OF', F.addressOf(U7)).length === 0, 'and its n and s');
  assert(F.relsOf(after, { from: F.addressOf(v2), to: F.addressOf(item7) }).length === 0, 'and its b');
  assert(F.relsOf(after, { type: 'REFERENCES', to: target7.id }).length === 0, 'its e tag\'s reference went with its tag');
  assert(into('HAS_ELEMENT', dog.addr.superset).length === 1 && JSON.parse(n.props.tapestryOwnSections).dog, 'dog\'s membership stays: the owner\'s add-to-concept put it there (tapestryOwnSections holds dog\'s section), and the section stays');
  assert(F.relsOf(after, { type: 'CITES' }).filter((y) => y.from === n.eid && y.to === rex.eid).length === 1, 'the relationship the owner added stays');
  assert(F.relsOf(after, { type: 'SUPERCEDES' }).filter((y) => y.from === n.eid && y.toNode.props.uuid === F.addressOf(S7)).length === 1, 'a relationship letter\'s claim stays: a structure claim is made and never taken out');
  assert(n.labels.includes('Set'), 'its role label stays, though the newer\'s word types lack set (Decision 9)');
  const entry = F.entries(after).find((e) => e.operation === 'import nostr' && e.changes.some((c) => c.change === 'event-updated' && c.node === key));
  const ch = entry && entry.changes.find((c) => c.change === 'event-updated');
  assert(ch && show(ch.was) === show({ id: v1.id, created_at: v1.created_at }) && show(ch.now) === show({ id: v2.id, created_at: v2.created_at }), `its entry: event-updated, was and now; got ${show(entry)}`);
  for (const uuid of [cat.addr.superset, F.addressOf(S7), F.addressOf(U7), F.addressOf(item7)]) {
    const other = F.nodesAt(after, uuid)[0];
    assert(other && entry.keys.includes(other.props.tapestryKey), `the entry names ${uuid}, at the other end of a relationship it took out; keys ${show(entry.keys)}`);
  }
  const older = F.data(b, 'v1-again');
  assert(older.events[0].outcome === 'older' && older.changes === 0, `the older version again: older, nothing written; got ${show(older.events)}`);
});

test('IO8 [AC3, Decision 4]: an older version answers older and writes nothing; on a tie of created_at the lower id stands', async () => {
  F.needDecl();
  const early = letter(al, { kind: 39999, at: 1700030000, tags: [['d', 'aged'], ['name', 'early']] });
  const late = letter(al, { kind: 39999, at: 1700030100, tags: [['d', 'aged'], ['name', 'late']] });
  const tie = (d, name) => letter(al, { kind: 39999, at: 1700030200, tags: [['d', d], ['name', name]] });
  // Two versions of one address in one second: make them until their ids order the way each half needs.
  const [lo, hi] = [tie('tied', 'first'), tie('tied', 'second')].sort((x, y) => x.id.localeCompare(y.id));
  const [lo2, hi2] = [tie('tied-two', 'first'), tie('tied-two', 'second')].sort((x, y) => x.id.localeCompare(y.id));
  const relays = { [F.PEER_RELAY]: F.relay([early, late, lo, hi, lo2, hi2]) };
  const state = F.emptyGraph();
  const a = F.runImport({ state, relays, label: 'import-nostr-older', requests: [at('late', { ids: [late.id] })] });
  F.data(a, 'late');
  const mid = a.state();
  const b = F.runImport({ file: a.file, relays, requests: [at('early', { ids: [early.id] })] });
  const d = F.data(b, 'early');
  assert(d.events[0].outcome === 'older' && d.changes === 0 && d.counts.older === 1, `older; got ${show(d.events)}`);
  assert(F.sameGraph(mid, b.state()) && F.entries(b.state()).length === F.entries(mid).length, 'nothing written, no entry');
  const c = F.runImport({ file: a.file, relays, requests: [at('hi', { ids: [hi.id] }), at('lo', { ids: [lo.id] }), at('hi-again', { ids: [hi.id] }), at('lo2', { ids: [lo2.id] }), at('hi2', { ids: [hi2.id] })] });
  const after = c.state();
  assert(F.data(c, 'hi').events[0].outcome === 'recorded' && F.data(c, 'lo').events[0].outcome === 'updated', 'the higher id first, then the lower: the lower id stands (updated)');
  assert(F.data(c, 'hi-again').events[0].outcome === 'older', 'the higher id again: older');
  assert(one(after, F.addressOf(lo), 'tied').props.id === lo.id, 'the node holds the lower id');
  assert(F.data(c, 'lo2').events[0].outcome === 'recorded' && F.data(c, 'hi2').events[0].outcome === 'older' && one(after, F.addressOf(lo2), 'tied two').props.id === lo2.id, 'the lower id first, then the higher: older');
});

// ── IO9: today's builders' nodes ──
test('IO9 [AC1, Decisions 4 and 7.3]: a node today\'s builder made for the same event is that node; a replaceable event\'s id-keyed node moves to its address unless one holds it', async () => {
  F.needDecl();
  const state = F.emptyGraph();
  const T9 = letter(al, { kind: 39999, at: 1700040000, tags: [['d', 'todays'], ['name', 'Today\'s'], ['t', 'a'], ['t', 'b']] });
  const P0 = letter(al, { kind: 0, at: 1700040001, content: '{"name":"alice"}' });
  const B0a = letter(bob, { kind: 0, at: 1700040002, content: '{"name":"bob, before"}' });
  const B0b = letter(bob, { kind: 0, at: 1700040003, content: '{"name":"bob, after"}' });
  const t9 = F.today(state, T9);
  const p0 = F.today(state, P0);
  const b0a = F.today(state, B0a);
  const b0b = F.today(state, B0b);
  const keys = { t9: t9.props.tapestryKey, p0: p0.props.tapestryKey, b0a: b0a.props.tapestryKey, b0b: b0b.props.tapestryKey };
  assert(p0.props.uuid === P0.id && b0a.props.uuid === B0a.id, 'today\'s builder keyed each kind-0 version by its id (story fact 4)');
  const relays = { [F.PEER_RELAY]: F.relay([T9, P0, B0a, B0b]) };
  const r = F.runImport({ state, relays, label: 'import-nostr-today', requests: [byAddr('t9', [T9]), at('p0', { addresses: [`0:${al.pubkey}:`] }), at('b0b', { ids: [B0b.id] }), at('b0a', { ids: [B0a.id] }), byAddr('t9-again', [T9])] });
  const after = r.state();
  const d = F.data(r, 't9');
  const n = one(after, F.addressOf(T9), 'today\'s node');
  assert(d.events[0].outcome === 'updated' && n.props.tapestryKey === keys.t9, `the node today's builder made is that node, its key kept; its tags rewritten, so updated; got ${show(d.events)}`);
  const tags = F.tagsOf(after, n);
  assert(tags.length === T9.tags.length && tags.every((t) => t.props.uuid.startsWith(`${T9.id}_`)), `one set of tags, in the recorder's shape <id>_<index>; got ${show(tags.map((t) => t.props.uuid))}`);
  assert(F.live(after).filter((x) => x.labels.includes('NostrEventTag') && String(x.props.uuid).startsWith(`${T9.id.slice(-8)}_`)).length === 0, 'today\'s 32-bit tag keys are gone');
  assert(F.data(r, 't9-again').events[0].outcome === 'unchanged', 'a second import: unchanged');
  const p = one(after, `0:${al.pubkey}:`, 'alice\'s profile');
  assert(p.props.tapestryKey === keys.p0 && p.props.id === P0.id && F.nodesAt(after, P0.id).length === 0, `today's id-keyed kind-0 node moved to 0:<pubkey>:, its key kept; got ${show(p.props)}`);
  const b = one(after, `0:${bob.pubkey}:`, 'bob\'s profile');
  assert(b.props.tapestryKey === keys.b0b && b.props.id === B0b.id, 'bob\'s newer version\'s node moved to the address');
  assert(F.data(r, 'b0a').events[0].outcome === 'older' && one(after, B0a.id, 'bob\'s older node').props.tapestryKey === keys.b0a, 'bob\'s older version: older, and today\'s per-version node of it stays where it is, since a node holds the address');
});

// ── IO10: three orders ──
test('IO10 [AC2, AC3]: the same events in three orders make the same graph, and none fails', async () => {
  F.needDecl();
  const set = [T, Rf, T2, Rf2, Rf3, T3, N4, Rf4, cat.letters.header, cat.letters.superset, Linit, Ez, Sn, En, Us, Ss, Lr, P1, P2, Gr, G1, G2];
  const shuffled = [...set].sort((x, y) => x.id.localeCompare(y.id));
  const orders = { forward: set, backward: [...set].reverse(), shuffled };
  const graphs = {};
  for (const [name, list] of Object.entries(orders)) {
    const state = F.emptyGraph();
    F.ownConcept(state);
    const r = F.runImport({ state, label: `import-nostr-${name}`, relays: { [F.PEER_RELAY]: F.relay(set) }, requests: list.map((e, i) => at(`${name}-${i}`, { ids: [e.id] })) });
    list.forEach((e, i) => { const d = F.data(r, `${name}-${i}`); noFailure(d, `${name} #${i}`); });
    graphs[name] = r.state();
  }
  for (const name of ['backward', 'shuffled']) assert(F.sameGraph(graphs.forward, graphs[name]), `${name} makes forward's graph; differs: ${show(F.graphDiff(graphs.forward, graphs[name]))}`);
  const placeholders = F.live(graphs.forward).filter(F.isPlaceholder);
  assert(placeholders.length === 0, `every reference's other end arrived, so no placeholder is left; got ${show(placeholders.map((x) => x.props))}`);
});

// ── IO11: failures ──
test('IO11 [Decisions 7.9 and 13]: a placeholder made meanwhile meets a second run; two failures or another error answer failed and the call goes on; an unreachable database fails the call', async () => {
  F.needDecl();
  const M = letter(al, { kind: 39999, at: 1700050000, tags: [['d', 'raced'], ['name', 'Raced']] });
  const F2 = letter(al, { kind: 1, at: 1700050001, content: 'fails twice' });
  const F3 = letter(al, { kind: 1, at: 1700050002, content: 'after one that failed' });
  const F4 = letter(al, { kind: 1, at: 1700050003, content: 'another kind of error' });
  const F5 = letter(al, { kind: 1, at: 1700050004, content: 'fails once' });
  const state = F.emptyGraph();
  state.failures = {
    meanwhile: [{ match: M.id, add: [{ labels: ['NostrEvent'], props: { id: M.id, uuid: M.id } }] }],
    failWrite: [{ match: F2.id, times: 2 }, { match: F4.id, times: 1, code: 'Neo.ClientError.Statement.SyntaxError', message: 'Invalid input: the fake graph fails this statement (failures.failWrite)' }, { match: F5.id, times: 1 }],
  };
  const relays = { [F.PEER_RELAY]: F.relay([M, F2, F3, F4, F5]) };
  const r = F.runImport({ state, relays, label: 'import-nostr-fail', requests: [at('race', { ids: [M.id] }), at('failing', { ids: [F2.id, F3.id, F4.id, F5.id] })] });
  const after = r.state();
  const race = F.data(r, 'race');
  assert(race.events[0].outcome === 'recorded' && race.counts.failed === 0, `the race: another import's placeholder made meanwhile, and still recorded; got ${show(race.events)}`);
  const m = one(after, F.addressOf(M), 'the raced event');
  assert(m.props.id === M.id && F.withId(after, M.id).length === 1 && F.nodesAt(after, M.id).length === 0, 'one node, at its address, holding its id: the placeholder made meanwhile is that node or merged into it');
  const d = F.data(r, 'failing');
  const out = (e) => F.forRef(d, e.id)[0] || {};
  assert(out(F2).outcome === 'failed' && /already exists/.test(String(out(F2).reason)), `two uniqueness failures: failed, with the error's words; got ${show(out(F2))}`);
  assert(out(F4).outcome === 'failed' && /Invalid input/.test(String(out(F4).reason)), `another error: failed at once, with its words; got ${show(out(F4))}`);
  assert(out(F3).outcome === 'recorded' && out(F5).outcome === 'recorded' && F.withId(after, F3.id).length === 1 && F.withId(after, F5.id).length === 1, 'the call goes on: the next event is recorded, and one that failed once is run again and recorded');
  assert(F.withId(after, F2.id).length === 0 && F.withId(after, F4.id).length === 0 && d.counts.failed === 2, 'the two that failed left nothing');
  const tx = CG.transactions(after.log);
  const rolledF4 = tx.filter((t) => t.outcome === 'rollback' && /Invalid input/.test(String(t.error)));
  assert(rolledF4.length === 1, `the other error was not run a second time: one rollback for it; got ${rolledF4.length}`);
  const down = F.emptyGraph();
  down.failures = { unreachable: { after: 1 } };
  const u = F.runImport({ state: down, relays, label: 'import-nostr-down', requests: [at('down', { ids: [F3.id, F5.id] })] });
  const x = u.req('down');
  assert(x.status === 500 && x.body && x.body.code === 'failed', `the database unreachable after one event: the call fails (500); got ${x.status} ${show(x.body)}`);
  const kept = u.state();
  assert(F.withId(kept, F3.id).length + F.withId(kept, F5.id).length === 1, 'and what it recorded before stays');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
