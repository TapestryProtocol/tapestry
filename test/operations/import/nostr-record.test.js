'use strict';
/**
 * import nostr — one event, one node, and the claims it makes. Run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/32-import-nostr.md (AC1, AC2)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0032-import-nostr.md (Decisions 3, 4, 7, 8, 9 and 11)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/32-import-nostr.test-plan.md
 *
 * Stack-free, over test/helpers/cypherGraphFake.js and test/helpers/relayFake.js. The graph holds the assistant's
 * concepts dog and word, as today's signing routes leave them (importFixtures.js's ownConcept), and bob's person node.
 * relay.example.com holds alice's and bob's letters; its fixture sends bob's `stray` with every answer, an event no
 * request asked for. One harness run, as the admin, in order:
 *   rec-1  kinds and names: alice's note, items, a header, a long-form post, a profile, a mute list, kinds 9998, 9999,
 *          7 and 40001, and the tagged and named letters
 *   rec-2  references: e, a and b, to what the graph holds and to what it doesn't
 *   rec-3  alice's cat concept: its header, its superset and her relationship letter IS_THE_CONCEPT_FOR between them
 *   rec-4  memberships and the class thread: z, n and s, to her own nodes, to another author's and to the assistant's
 *   rec-5  relationship letters of each kind of type, and across authors
 *   rec-6  role labels from word types
 *   rec-7  what can't be recorded: letters that don't verify, events that aren't events, ids and addresses the relay
 *          doesn't hold, two versions of one address, the same id twice
 *   rec-8  ids given as note and nevent, an address as naddr, each with a relay hint
 *   rec-bob bob's letter, whose person node is already in the graph
 *
 *   IR1  a regular event: one node, NostrEvent and TapestryNode with a key, its uuid its id; the answer's entry
 *   IR2  keys and labels by kind: addressable at kind:pubkey:d, replaceable at kind:pubkey:, 40000 and up and 9998 and
 *        9999 regular; ListHeader, ListItem, Reaction with its content; a foreign header is no ConceptHeader
 *   IR3  ids as note and nevent, addresses as naddr; ref is what was asked; a relay hint inside one isn't followed
 *   IR4  name and tapestryValue from the first name tag, else names, else title
 *   IR5  its author: one person node for a pubkey AUTHORS each of its nodes; one already in the graph keeps its key
 *   IR6  its tags: one tag node each, keyed <id>_<index>, with type and up to five values, HAS_TAG from the node
 *   IR7  e and a: the tag REFERENCES the node with that id or at that address; one placeholder for what isn't held,
 *        by id or by address; a node at the address with no event is the target, never a second node there
 *   IR8  b: REFERENCES {source: 'b-tag'}, INHERITS_FROM for inherit, nothing for the sentinel or a malformed value
 *   IR9  z: HAS_ELEMENT from the superset the header IS_THE_CONCEPT_FOR; nothing for a concept not held (and no
 *        placeholder) or one whose d-tag is word
 *   IR10 n and s within the claimant's graph: HAS_ELEMENT from her set, IS_A_SUPERSET_OF from her parent; nothing for
 *        another author's set or parent
 *   IR11 a relationship letter: its relationship between two nodes its author signed, named by address, of a type
 *        firmware declares outside nostr or an editorial one; nothing for a nostr type, an undeclared one, another
 *        author's end or an end named by id
 *   IR12 role labels from word types: Superset, Set, Property (property and primaryProperty) and JSONSchema
 *   IR13 claims recorded, never judged: an element that doesn't fit its concept's schema, one whose name another
 *        element has, and one of a concept the graph doesn't hold
 *   IR14 the change entry: import nostr, the caller's; event-recorded with the node, and the nodes its claims reach,
 *        placeholders included; graph history finds it by each, and by the admin
 *   IR15 Decision 3: invalid with a reason, not-found, an event not asked for left out, the newest of two versions,
 *        each id once
 */

const S = require('../../helpers/graphOpsSuite');
const F = require('../../helpers/importFixtures');
const R = require('../../helpers/relayFake');

const { ADMIN, assert, show } = S;
const { test, run } = S.makeSuite('operations: import nostr — one event, one node, its claims');
const { KEYS, imp, letter } = F;
const al = KEYS.alice, bob = KEYS.bob;
const A = (kind, key, d) => `${kind}:${key.pubkey}:${d}`;
const hex = (s) => require('crypto').createHash('sha256').update(s).digest('hex');
const KEY_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// rec-1: kinds and names
const note = letter(al, { kind: 1, at: 1700001000, tags: [['t', 'x']], content: 'a note' });
const item = letter(al, { kind: 39999, at: 1700001001, tags: [['d', 'item-1'], ['name', 'Item One']] });
const itemB = letter(al, { kind: 39999, at: 1700001002, tags: [['d', 'item-2'], ['name', 'Item Two']] });
const hdr = letter(al, { kind: 39998, at: 1700001003, tags: [['d', 'gadget'], ['names', 'gadget', 'gadgets']] });
const long = letter(al, { kind: 30023, at: 1700001004, tags: [['d', ''], ['title', 'Long Form']], content: 'long' });
const longNoD = letter(al, { kind: 30024, at: 1700001005, tags: [['title', 'Draft']], content: 'draft' });
const profile = letter(al, { kind: 0, at: 1700001006, content: '{"name":"alice"}' });
const mute = letter(al, { kind: 10000, at: 1700001007, tags: [['p', bob.pubkey]] });
const far = letter(al, { kind: 40001, at: 1700001008, tags: [['d', 'not-an-address']] });
const lh = letter(al, { kind: 9998, at: 1700001009, tags: [['names', 'list', 'lists']] });
const li = letter(al, { kind: 9999, at: 1700001010, tags: [['name', 'a list item']] });
const react = letter(al, { kind: 7, at: 1700001011, tags: [['e', note.id]], content: '+' });
const named = letter(al, { kind: 39999, at: 1700001012, tags: [['d', 'named'], ['title', 'A Title'], ['names', 'by names'], ['name', 'By Name'], ['name', 'Second Name']] });
const namesOnly = letter(al, { kind: 39999, at: 1700001013, tags: [['d', 'names-only'], ['title', 'A Title'], ['names', 'dog', 'dogs']] });
const titleOnly = letter(al, { kind: 39999, at: 1700001014, tags: [['d', 'title-only'], ['title', 'Only A Title']] });
const tagged = letter(al, { kind: 1, at: 1700001015, tags: [['t', 'one'], ['x', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6'], ['p', bob.pubkey], ['client']], content: 'tags' });
// rec-2: references
const missingId = hex('an event the graph does not hold');
const missingId2 = hex('another event the graph does not hold');
const missingAddr = A(39999, bob, 'nowhere');
let refs, bees;
// rec-3 and rec-4: alice's cat concept, and memberships
const cat = F.conceptLetters(al, 'cat', { at: 1700002000 });
const relInit = F.relationshipLetter(al, { d: 'cat-init', from: cat.addr.header, to: cat.addr.superset, type: 'IS_THE_CONCEPT_FOR', at: 1700002001 });
const aliceSetAddr = A(39999, al, 'alice-set');
const bobSetAddr = A(39999, bob, 'bob-set');
let zOwn, zMissing, zWord, zCat, nOwn, nOther, sOwn, sOther, unfit, sameName;
// rec-5: relationship letters
let rels;
// rec-6: role labels
const word = (d, wordTypes) => letter(al, { kind: 39999, at: 1700004000, tags: [['d', d], ['name', d], ['json', JSON.stringify({ word: { slug: d, name: d, wordTypes } })]] });
const roles = { set: word('role-set', ['word', 'set']), property: word('role-property', ['word', 'property']), primary: word('role-primary', ['word', 'primaryProperty']), schema: word('role-schema', ['word', 'jsonSchema']), superset: word('role-superset', ['word', 'superset']) };
// rec-7: what can't be recorded
const tampered = F.forged(letter(al, { kind: 1, at: 1700005000, content: 'as signed' }), { content: 'changed after signing' });
const otherSig = F.foreignSig(letter(al, { kind: 1, at: 1700005001, content: 'signed' }), letter(bob, { kind: 1, at: 1700005002, content: 'by bob' }));
const notEvent = { id: hex('not an event'), kind: 1, content: 'no pubkey, no sig, no tags, no created_at' };
const bigKind = letter(al, { kind: 70000, at: 1700005003, content: 'kind past 65535' });
const v1 = letter(al, { kind: 39999, at: 1700005004, tags: [['d', 'versioned'], ['name', 'old']] });
const v2 = letter(al, { kind: 39999, at: 1700005005, tags: [['d', 'versioned'], ['name', 'new']] });
const twice = letter(al, { kind: 1, at: 1700005006, content: 'asked twice' });
const stray = letter(bob, { kind: 1, at: 1700005007, content: 'nobody asked for me' });
const absentAddr = A(39999, al, 'never-published');
const unknownId = hex('nobody published this, and nothing names it');
// rec-8 and rec-bob: the encodings, and bob
const bobNote = letter(bob, { kind: 1, at: 1700006000, content: 'bob was here before' });
const viaNote = letter(al, { kind: 1, at: 1700006001, content: 'asked as a note' });
const viaNevent = letter(al, { kind: 1, at: 1700006002, content: 'asked as an nevent, with a hint' });
const viaNaddr = letter(al, { kind: 39999, at: 1700006003, tags: [['d', 'via-naddr'], ['name', 'Via Naddr']] });
const HINT = 'wss://hint.example.com';

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    F.needDecl();
    const state = F.emptyGraph();
    const dog = F.ownConcept(state);
    const wordConcept = F.ownConcept(state, { slug: 'word', plural: 'words', at: 1690000500 });
    const bobKey = require('crypto').randomUUID();
    F.cy(state, 'CREATE (u:NostrUser:TapestryNode {pubkey: $p, tapestryKey: $k})', { p: bob.pubkey, k: bobKey });
    refs = letter(al, { kind: 39999, at: 1700001100, tags: [['d', 'refs'], ['e', note.id], ['e', missingId], ['a', F.addressOf(item)], ['a', missingAddr], ['a', dog.addr.madeHere]] });
    bees = letter(al, { kind: 39999, at: 1700001101, tags: [['d', 'bees'], ['b', F.addressOf(item)], ['b', F.addressOf(hdr), 'inherit'], ['b', 'b-tag-deferred'], ['b', 'not a b value'], ['b', missingId2]] });
    const el = (d, tags, json) => letter(al, { kind: 39999, at: 1700003000, tags: [['d', d], ['name', d], ...tags, ...(json ? [['json', JSON.stringify(json)]] : [])] });
    zOwn = el('z-own', [['z', dog.addr.header]]);
    zMissing = el('z-missing', [['z', A(39998, bob, 'unheld')]]);
    zWord = el('z-word', [['z', wordConcept.addr.header]]);
    zCat = el('z-cat', [['z', cat.addr.header]]);
    nOwn = el('n-own', [['z', cat.addr.header], ['n', aliceSetAddr]]);
    nOther = el('n-other', [['n', bobSetAddr]]);
    sOwn = el('s-own', [['s', cat.addr.superset]]);
    sOther = el('s-other', [['s', dog.addr.superset]]);
    unfit = el('unfit', [['z', dog.addr.header]], { word: { slug: 'unfit', name: 'unfit', wordTypes: ['word', 'dog'] }, dog: { name: 42 } });
    sameName = letter(al, { kind: 39999, at: 1700003001, tags: [['d', 'another-rex'], ['name', 'Rex'], ['z', dog.addr.header]] });
    const R5 = (d, type, from, to) => F.relationshipLetter(al, { d, from, to, type, at: 1700003500 });
    const ia = F.addressOf(item), ib = F.addressOf(itemB);
    rels = {
      supercedes: R5('rel-supercedes', 'SUPERCEDES', ia, ib),
      importRel: R5('rel-import', 'IMPORT', ia, ib),
      template: R5('rel-template', 'PROVIDED_THE_TEMPLATE_FOR', ia, ib),
      property: R5('rel-property', 'IS_A_PROPERTY_OF', ib, ia),
      hasTag: R5('rel-has-tag', 'HAS_TAG', ia, ib),
      authors: R5('rel-authors', 'AUTHORS', ia, ib),
      references: R5('rel-references', 'REFERENCES', ia, ib),
      cites: R5('rel-cites', 'CITES', ia, ib),
      lower: R5('rel-lower', 'lower_case', ia, ib),
      cross: R5('rel-cross', 'IS_A_PROPERTY_OF', ia, A(39999, bob, 'bobs-node')),
      byId: R5('rel-by-id', 'SUPERCEDES', note.id, ia),
      toMissing: R5('rel-to-missing', 'SUPERCEDES', ia, A(39999, al, 'not-yet')),
    };
    const peer = [note, item, itemB, hdr, long, longNoD, profile, mute, far, lh, li, react, named, namesOnly, titleOnly, tagged, refs, bees,
      ...cat.all, relInit, zOwn, zMissing, zWord, zCat, nOwn, nOther, sOwn, sOther, unfit, sameName, ...Object.values(rels), ...Object.values(roles),
      tampered, otherSig, notEvent, bigKind, v1, v2, twice, bobNote, viaNote, viaNevent, viaNaddr];
    const relays = { [F.PEER_RELAY]: F.relay(peer, { extra: [stray] }), [HINT]: F.relay([viaNevent, viaNaddr]) };
    const before = JSON.parse(JSON.stringify(state));
    const at = (rid, body) => imp(rid, 'admin', { relay: F.PEER_RELAY, ...body });
    const r = F.runImport({
      state, relays, label: 'import-nostr-record',
      requests: [
        at('rec-1', { ids: [note.id, longNoD.id, far.id, lh.id, li.id, react.id, tagged.id], addresses: [F.addressOf(item), F.addressOf(itemB), F.addressOf(hdr), F.addressOf(long), F.addressOf(profile), F.addressOf(mute), F.addressOf(named), F.addressOf(namesOnly), F.addressOf(titleOnly)] }),
        at('rec-2', { addresses: [F.addressOf(refs), F.addressOf(bees)] }),
        at('rec-3', { addresses: [cat.addr.header, cat.addr.superset, F.addressOf(relInit)] }),
        at('rec-4', { addresses: [zOwn, zMissing, zWord, zCat, nOwn, nOther, sOwn, sOther, unfit, sameName].map(F.addressOf) }),
        at('rec-5', { addresses: Object.values(rels).map(F.addressOf) }),
        at('rec-6', { addresses: Object.values(roles).map(F.addressOf) }),
        at('rec-7', { ids: [tampered.id, otherSig.id, notEvent.id, bigKind.id, unknownId, twice.id, twice.id], addresses: [absentAddr, F.addressOf(v1)] }),
        at('rec-8', { ids: [F.nip.note(viaNote.id), F.nip.nevent(viaNevent.id, [HINT])], addresses: [F.nip.naddr(39999, al.pubkey, 'via-naddr', [HINT])] }),
        at('rec-bob', { ids: [bobNote.id] }),
      ],
    });
    const after = r.state();
    return { dog, wordConcept, bobKey, before, r, after, log: r.log() };
  })();
  return MAIN;
}

const nodeOf = (s, e) => F.nodesAt(s, F.uuidOf(e));
const one = (s, e, what) => { const ns = nodeOf(s, e); assert(ns.length === 1, `${what}: one node at ${F.uuidOf(e)}; got ${ns.length}: ${show(ns).slice(0, 400)}`); return ns[0]; };
const has = (n, label) => n.labels.includes(label);

test('IR1 [AC1, Decision 4]: a regular event is one node, NostrEvent and TapestryNode with a key, at its id; the answer names it', async () => {
  const { r, after } = await main();
  const d = F.data(r, 'rec-1');
  const n = one(after, note, 'the note');
  assert(has(n, 'NostrEvent') && has(n, 'TapestryNode') && KEY_RE.test(n.props.tapestryKey), `labelled NostrEvent and TapestryNode, with a tapestryKey; got ${show(n)}`);
  assert(n.props.uuid === note.id && n.props.id === note.id && n.props.kind === 1 && n.props.pubkey === al.pubkey && n.props.created_at === note.created_at, `it holds its id, kind, pubkey and created_at, its uuid its id; got ${show(n.props)}`);
  assert(n.props.aTag === undefined && n.props.content === undefined, 'a regular event has no aTag, and its content is kept for kind 7 only');
  const [e] = F.forRef(d, note.id);
  assert(e && e.id === note.id && e.outcome === 'recorded' && e.node === n.props.tapestryKey, `the answer: ref, id, outcome recorded and the node's tapestryKey; got ${show(e)}`);
  assert(d.source === 'ids' && R.normalize(d.relay) === R.normalize(F.PEER_RELAY) && d.counts.recorded === 16 && d.graphs === null && d.crowded === null && d.next === null && d.changes === 16,
    `source ids, the relay read, sixteen recorded, sixteen entries, and no graphs, crowded or next; got ${show({ ...d, events: undefined })}`);
  for (const k of ['recorded', 'updated', 'unchanged', 'older', 'own', 'notFound', 'invalid', 'unread', 'failed']) assert(Number.isInteger(d.counts[k]), `counts.${k} is a number; got ${show(d.counts)}`);
});

test('IR2 [AC1, Decision 4]: keys and labels by kind', async () => {
  const { after } = await main();
  const it = one(after, item, 'the item');
  assert(it.props.uuid === A(39999, al, 'item-1') && it.props.aTag === it.props.uuid && has(it, 'ListItem'), `an addressable event at kind:pubkey:d, with its aTag, a ListItem; got ${show(it)}`);
  const h = one(after, hdr, 'the header');
  assert(has(h, 'ListHeader') && !has(h, 'ConceptHeader'), `a foreign header is a ListHeader, never a ConceptHeader (BIBLE §22); got ${show(h.labels)}`);
  assert(one(after, long, 'the long-form post').props.uuid === `30023:${al.pubkey}:`, 'an empty d tag: kind:pubkey:');
  assert(one(after, longNoD, 'the draft').props.uuid === `30024:${al.pubkey}:`, 'no d tag at all: kind:pubkey: too (Decision 4: the first d tag, \'\' without one)');
  for (const [e, what] of [[profile, 'the profile (kind 0)'], [mute, 'the mute list (kind 10000)']]) {
    const n = one(after, e, what);
    assert(n.props.uuid === `${e.kind}:${al.pubkey}:` && n.props.aTag === n.props.uuid && n.props.id === e.id, `${what}: replaceable, at kind:pubkey:; got ${show(n.props)}`);
  }
  const f = one(after, far, 'kind 40001');
  assert(f.props.uuid === far.id && f.props.aTag === undefined, `kind 40001 is regular, at its id, its d tag aside; got ${show(f.props)}`);
  const l1 = one(after, lh, 'kind 9998'), l2 = one(after, li, 'kind 9999');
  assert(l1.props.uuid === lh.id && has(l1, 'ListHeader') && l2.props.uuid === li.id && has(l2, 'ListItem'), `9998 a ListHeader and 9999 a ListItem, each at its id; got ${show([l1.labels, l2.labels])}`);
  const x = one(after, react, 'the reaction');
  assert(has(x, 'Reaction') && x.props.content === '+', `a reaction is a Reaction, its content kept; got ${show(x)}`);
});

test('IR3 [AC1, Decision 1]: ids as note and nevent, addresses as naddr; ref is what was asked; a relay hint isn\'t followed', async () => {
  const { r, after, log } = await main();
  const d = F.data(r, 'rec-8');
  for (const [ref, e] of [[F.nip.note(viaNote.id), viaNote], [F.nip.nevent(viaNevent.id, [HINT]), viaNevent], [F.nip.naddr(39999, al.pubkey, 'via-naddr', [HINT]), viaNaddr]]) {
    const [x] = F.forRef(d, ref);
    assert(x && x.id === e.id && x.outcome === 'recorded', `${ref.slice(0, 12)}…: answered under the ref as asked, recorded; got ${show(x)}`);
    one(after, e, ref.slice(0, 12));
  }
  assert(!log.some((x) => x.at === 'connect' && x.url === R.normalize(HINT)), 'the hint inside the nevent and the naddr was never connected to: relay names where to read');
});

test('IR4 [AC1, Decision 7.5]: name and tapestryValue from the first name tag, else names, else title', async () => {
  const { after } = await main();
  for (const [e, want] of [[named, 'By Name'], [namesOnly, 'dog'], [titleOnly, 'Only A Title'], [item, 'Item One']]) {
    const n = one(after, e, want);
    assert(n.props.name === want && n.props.tapestryValue === want, `${F.uuidOf(e)}: name and tapestryValue ${want}; got ${show([n.props.name, n.props.tapestryValue])}`);
  }
  assert(one(after, note, 'the note').props.name === undefined, 'a letter with none of the three has no name');
});

test('IR5 [AC2]: its author\'s person node AUTHORS it, one for a pubkey; one already in the graph keeps its key', async () => {
  const { after, bobKey } = await main();
  const people = F.personsOf(after, al.pubkey);
  assert(people.length === 1 && people[0].labels.includes('TapestryNode') && KEY_RE.test(people[0].props.tapestryKey), `one person node for alice, keyed; got ${show(people)}`);
  for (const e of [note, item, hdr, profile]) {
    const n = one(after, e, F.uuidOf(e));
    assert(F.relsOf(after, { type: 'AUTHORS' }).some((x) => x.from === people[0].eid && x.to === n.eid), `alice AUTHORS ${F.uuidOf(e)}`);
  }
  const bobs = F.personsOf(after, bob.pubkey);
  const bn = one(after, bobNote, 'bob\'s note');
  assert(bobs.length === 1 && bobs[0].props.tapestryKey === bobKey && F.relsOf(after, { type: 'AUTHORS' }).some((x) => x.from === bobs[0].eid && x.to === bn.eid), `bob's person node, as it was, AUTHORS his note; got ${show(bobs)}`);
});

test('IR6 [AC2, Decision 7.6]: one tag node a tag, keyed <id>_<index>, type and up to five values, HAS_TAG from the node', async () => {
  const { after } = await main();
  const n = one(after, tagged, 'the tagged note');
  const tags = F.tagsOf(after, n);
  assert(tags.length === tagged.tags.length, `a tag node for each of its ${tagged.tags.length} tags; got ${tags.length}`);
  tagged.tags.forEach((t, i) => {
    const tn = tags.find((x) => x.props.uuid === `${tagged.id}_${i}`);
    assert(tn && tn.labels.includes('NostrEventTag') && tn.labels.includes('TapestryNode') && KEY_RE.test(tn.props.tapestryKey), `tag ${i}: NostrEventTag and TapestryNode, keyed, uuid <whole id>_${i}; got ${show(tn)}`);
    assert(tn.props.type === t[0], `tag ${i}: type ${t[0]}; got ${tn.props.type}`);
    ['value', 'value1', 'value2', 'value3', 'value4'].forEach((k, j) => {
      const want = t[j + 1];
      assert(tn.props[k] === (want === undefined ? undefined : want), `tag ${i}: ${k} ${want === undefined ? 'unset' : want}; got ${show(tn.props)}`);
    });
    assert(tn.props.value5 === undefined, `tag ${i}: no sixth value is kept`);
  });
});

test('IR7 [AC2, Decision 8]: e and a: the tag REFERENCES its target; one placeholder for what isn\'t held; a node with no event at the address is the target', async () => {
  const { after, dog } = await main();
  const n = one(after, refs, 'refs');
  const tags = F.tagsOf(after, n);
  const refOf = (i) => F.relsOf(after, { type: 'REFERENCES' }).filter((x) => x.from === tags.find((t) => t.props.uuid === `${refs.id}_${i}`).eid).map((x) => x.toNode);
  const [eNote] = refOf(1);
  assert(eNote && eNote.props.id === note.id && !F.isPlaceholder(eNote), `e to the note: the note's node; got ${show(eNote)}`);
  const [eMissing] = refOf(2);
  assert(eMissing && F.isPlaceholder(eMissing) && eMissing.props.id === missingId && eMissing.props.uuid === missingId && eMissing.labels.includes('TapestryNode') && KEY_RE.test(eMissing.props.tapestryKey),
    `e to an event not held: a placeholder, NostrEvent with no created_at, its id and uuid the id, keyed; got ${show(eMissing)}`);
  const [aItem] = refOf(3);
  assert(aItem && aItem.props.uuid === F.addressOf(item), `a to the item: the item's node; got ${show(aItem)}`);
  const [aMissing] = refOf(4);
  assert(aMissing && F.isPlaceholder(aMissing) && aMissing.props.uuid === missingAddr && aMissing.props.kind === 39999 && aMissing.props.pubkey === bob.pubkey && aMissing.props.id === undefined,
    `a to an address not held: a placeholder there, its kind and pubkey from the address; got ${show(aMissing)}`);
  const [aHeld] = refOf(5);
  const held = F.nodesAt(after, dog.addr.madeHere);
  assert(aHeld && held.length === 1 && aHeld.eid === held[0].eid && !held[0].labels.includes('NostrEvent'), `a to the address of a node made here with no event: that node, and no second node there; got ${show(held)}`);
  assert(F.nodesAt(after, missingAddr).length === 1 && F.withId(after, missingId).length === 1, 'one placeholder each');
});

test('IR8 [AC2, Decision 8]: b: REFERENCES {source: b-tag}, INHERITS_FROM for inherit, nothing for the sentinel or a malformed value', async () => {
  const { after } = await main();
  const n = one(after, bees, 'bees');
  const out = F.relsOf(after, {}).filter((x) => x.from === n.eid && x.type !== 'HAS_TAG');
  const pointer = out.filter((x) => x.type === 'REFERENCES' && x.toNode.props.uuid === F.addressOf(item));
  assert(pointer.length === 1 && pointer[0].props.source === 'b-tag', `a pointer b: the node REFERENCES the item, source b-tag; got ${show(out.map((x) => [x.type, x.props, x.toNode.props.uuid]))}`);
  const inherit = out.filter((x) => x.type === 'INHERITS_FROM');
  assert(inherit.length === 1 && inherit[0].toNode.props.uuid === F.addressOf(hdr), `an inherit b: INHERITS_FROM the header; got ${show(inherit)}`);
  const byId = out.filter((x) => x.type === 'REFERENCES' && x.toNode.props.id === missingId2);
  assert(byId.length === 1 && F.isPlaceholder(byId[0].toNode) && byId[0].toNode.props.uuid === missingId2, 'a b naming an event by id: a placeholder by id, its uuid and id the id');
  assert(out.length === 3, `nothing for the sentinel or the malformed value; got ${show(out.map((x) => [x.type, x.toNode.props]))}`);
  assert(F.nodesAt(after, 'b-tag-deferred').length === 0 && F.nodesAt(after, 'not a b value').length === 0, 'and no node for either');
  assert(F.tagsOf(after, n).length === bees.tags.length, 'every b keeps its tag node');
});

test('IR9 [AC2, Decision 8]: z: HAS_ELEMENT from the concept\'s superset; nothing for a concept not held, or whose d-tag is word', async () => {
  const { after, dog, wordConcept } = await main();
  const from = (e) => F.relsOf(after, { type: 'HAS_ELEMENT' }).filter((x) => x.to === one(after, e, F.uuidOf(e)).eid).map((x) => x.fromNode.props.uuid);
  assert(show(from(zOwn)) === show([dog.addr.superset]), `alice's z naming the assistant's dog: HAS_ELEMENT from dog's superset, a membership from anyone; got ${show(from(zOwn))}`);
  assert(show(from(zCat)) === show([cat.addr.superset]), `her z naming her own cat, wired in rec-3: from cat's superset; got ${show(from(zCat))}`);
  assert(from(zMissing).length === 0 && F.nodesAt(after, A(39998, bob, 'unheld')).length === 0, 'a z naming a concept the graph doesn\'t hold makes nothing, and no placeholder');
  assert(from(zWord).length === 0 && F.relsOf(after, { type: 'HAS_ELEMENT', from: wordConcept.addr.superset }).every((x) => x.toNode.props.uuid !== F.addressOf(zWord)), 'a z naming word makes nothing (firmware\'s step 1d)');
});

test('IR10 [AC2, Amendment 1]: n and s within the claimant\'s graph only', async () => {
  const { after, dog } = await main();
  const nn = one(after, nOwn, 'n-own');
  const set = F.relsOf(after, { type: 'HAS_ELEMENT' }).filter((x) => x.to === nn.eid && x.fromNode.props.uuid === aliceSetAddr);
  assert(set.length === 1 && F.isPlaceholder(set[0].fromNode) && set[0].fromNode.props.pubkey === al.pubkey, `her n naming her own set, not yet held: HAS_ELEMENT from a placeholder at its address; got ${show(set)}`);
  const no = one(after, nOther, 'n-other');
  assert(F.relsOf(after, { type: 'HAS_ELEMENT' }).filter((x) => x.to === no.eid).length === 0 && F.nodesAt(after, bobSetAddr).length === 0, 'her n naming bob\'s set makes nothing, and no placeholder');
  const so = one(after, sOwn, 's-own');
  assert(F.relsOf(after, { type: 'IS_A_SUPERSET_OF' }).filter((x) => x.to === so.eid && x.fromNode.props.uuid === cat.addr.superset).length === 1, 'her s naming her own superset: IS_A_SUPERSET_OF from it');
  const sx = one(after, sOther, 's-other');
  assert(F.relsOf(after, { type: 'IS_A_SUPERSET_OF' }).filter((x) => x.to === sx.eid).length === 0, `her s naming the assistant's superset (${dog.addr.superset}) makes nothing`);
});

test('IR11 [AC2, Decision 8]: a relationship letter between her own nodes, of an allowed type, by address; nothing otherwise', async () => {
  const { after } = await main();
  const ia = F.addressOf(item), ib = F.addressOf(itemB);
  const made = (type, from, to) => F.relsOf(after, { type, from, to }).length;
  assert(made('IS_THE_CONCEPT_FOR', cat.addr.header, cat.addr.superset) === 1, 'IS_THE_CONCEPT_FOR between her header and superset (rec-3)');
  for (const type of ['SUPERCEDES', 'IMPORT', 'PROVIDED_THE_TEMPLATE_FOR']) assert(made(type, ia, ib) === 1, `the editorial ${type}, item to item two`);
  assert(made('IS_A_PROPERTY_OF', ib, ia) === 1, 'IS_A_PROPERTY_OF, a type firmware declares outside nostr');
  for (const type of ['HAS_TAG', 'AUTHORS', 'REFERENCES', 'CITES', 'lower_case']) {
    const between = F.relsOf(after, { type }).filter((x) => x.fromNode && x.toNode && x.fromNode.props.uuid === ia && x.toNode.props.uuid === ib);
    assert(between.length === 0, `${type} between the two items is not made: a nostr type, or one firmware doesn't declare; got ${show(between)}`);
  }
  assert(made('IS_A_PROPERTY_OF', ia, A(39999, bob, 'bobs-node')) === 0 && F.nodesAt(after, A(39999, bob, 'bobs-node')).length === 0, 'an end at bob\'s address: nothing, and no placeholder');
  assert(F.relsOf(after, { type: 'SUPERCEDES', to: ia }).filter((x) => x.fromNode.props.id === note.id).length === 0, 'an end named by id: nothing');
  const ahead = F.relsOf(after, { type: 'SUPERCEDES', from: ia, to: A(39999, al, 'not-yet') });
  assert(ahead.length === 1 && F.isPlaceholder(ahead[0].toNode), 'an end of hers not held yet: the relationship, to a placeholder at its address');
  for (const e of Object.values(rels)) one(after, e, `the letter ${F.uuidOf(e)}`);
});

test('IR12 [AC2, Decision 9]: role labels from word types', async () => {
  const { after } = await main();
  for (const [k, want] of [['set', 'Set'], ['property', 'Property'], ['primary', 'Property'], ['schema', 'JSONSchema'], ['superset', 'Superset']]) {
    const n = one(after, roles[k], k);
    assert(n.labels.includes(want), `wordTypes ${k}: the label ${want}; got ${show(n.labels)}`);
  }
  assert(one(after, cat.letters.superset, 'cat\'s superset').labels.includes('Superset'), 'cat\'s superset is a Superset');
  assert(!one(after, cat.letters.header, 'cat\'s header').labels.includes('ConceptHeader'), 'cat\'s header is not a ConceptHeader');
});

test('IR13 [AC2, D4]: claims are recorded, never judged', async () => {
  const { r, after, dog } = await main();
  const d = F.data(r, 'rec-4');
  for (const e of [unfit, sameName, zMissing]) assert(F.forRef(d, F.addressOf(e))[0].outcome === 'recorded', `${F.addressOf(e)} is recorded`);
  for (const e of [unfit, sameName]) {
    const n = one(after, e, F.addressOf(e));
    assert(F.relsOf(after, { type: 'HAS_ELEMENT', from: dog.addr.superset }).some((x) => x.to === n.eid), `${F.addressOf(e)}: its claim on dog is made, whatever dog's schema or names say; rules check reports what breaks a rule`);
  }
});

test('IR14 [AC1, Decision 7.8]: the change entry names the node and the nodes its claims reach; graph history finds it by each, and by the admin', async () => {
  const { r, after, dog } = await main();
  const d = F.data(r, 'rec-2');
  assert(d.changes === 2, `two events changed the graph, two entries; got ${d.changes}`);
  const n = one(after, refs, 'refs');
  const entry = F.entries(after).find((e) => e.operation === 'import nostr' && e.keys.includes(n.props.tapestryKey));
  assert(entry && entry.byRole === 'admin' && entry.byPubkey === ADMIN, `refs' entry is import nostr's, the admin's; got ${show(entry)}`);
  const recorded = entry.changes.filter((c) => c.change === 'event-recorded');
  assert(recorded.length === 1 && recorded[0].node === n.props.tapestryKey, `one event-recorded change, naming the node; got ${show(entry.changes)}`);
  const want = {
    placeholderById: F.withId(after, missingId)[0], placeholderByAddress: F.nodesAt(after, missingAddr)[0],
    note: F.nodesAt(after, note.id)[0], item: F.nodesAt(after, F.addressOf(item))[0], madeHere: F.nodesAt(after, dog.addr.madeHere)[0],
  };
  for (const [what, node] of Object.entries(want)) assert(node && entry.keys.includes(node.props.tapestryKey), `the entry's keys name the ${what}; keys ${show(entry.keys)}`);
  const h = F.readWith(after, [
    ...Object.entries({ node: n, ...want }).map(([what, node]) => F.history(`h-${what}`, `node=${node.props.tapestryKey}`)),
    F.history('h-admin', `by=${ADMIN}`),
  ]);
  for (const what of ['node', ...Object.keys(want), 'admin']) {
    const x = h.req(`h-${what}`);
    assert(x.status === 200 && x.body.data.entries.some((e) => e.id === entry.tapestryKey && e.operation === 'import nostr'), `graph history finds the entry by ${what}; got ${x.status} ${show(x.body).slice(0, 300)}`);
  }
});

test('IR15 [Decision 3]: invalid with a reason, not-found, an event not asked for left out, the newest of two versions, each id once', async () => {
  const { r, after } = await main();
  const d = F.data(r, 'rec-7');
  for (const e of [tampered, otherSig, notEvent, bigKind]) {
    const [x] = F.forRef(d, e.id);
    assert(x && x.outcome === 'invalid' && typeof x.reason === 'string' && x.reason.length > 0 && x.node === null, `${e.id.slice(0, 8)}…: invalid, with the reason; got ${show(x)}`);
    assert(F.withId(after, e.id).length === 0, `and nothing recorded for ${e.id.slice(0, 8)}…`);
  }
  const [missing] = F.forRef(d, unknownId);
  assert(missing && missing.outcome === 'not-found' && missing.node === null, `an id the relay doesn't hold: not-found; got ${show(missing)}`);
  const [absent] = F.forRef(d, absentAddr);
  assert(absent && absent.outcome === 'not-found' && F.nodesAt(after, absentAddr).length === 0, `an address it doesn't hold: not-found; got ${show(absent)}`);
  assert(!(d.events || []).some((x) => x.id === stray.id) && F.withId(after, stray.id).length === 0, 'the event no request asked for is left out: not listed, not recorded');
  const ver = F.forRef(d, F.addressOf(v1));
  assert(ver.filter((x) => x.outcome === 'recorded').length === 1 && ver.find((x) => x.outcome === 'recorded').id === v2.id && ver.every((x) => x.outcome === 'recorded' || (x.outcome === 'older' && x.id === v1.id)),
    `two versions of one address: the newest recorded, the other older; got ${show(ver)}`);
  const v = one(after, v2, 'versioned');
  assert(v.props.id === v2.id && v.props.name === 'new', 'the node holds the newest');
  assert(F.withId(after, twice.id).length === 1 && (d.events || []).filter((x) => x.id === twice.id && x.outcome === 'recorded').length === 1, 'an id asked twice is recorded once');
  assert(d.counts.invalid === 4 && d.counts.notFound === 2, `counts: four invalid, two not found; got ${show(d.counts)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
