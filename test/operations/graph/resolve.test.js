'use strict';
/**
 * graph resolve — its own suite (ADR graph-operations-foundation/0001 Decision 12), run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/9-resolve.md (AC1–AC7)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0009-resolve-and-naming-a-node.md
 *
 * Stack-free: every request goes through test/helpers/operationsHarness.js, over a graph test/helpers/resolveGraph.js
 * seeds for test/helpers/graphFake.js. A page's cursor is read from one harness run and sent in the next, over the same
 * graph. Only what the story and the ADR pin is checked: which candidates come back, in what order, with which facts,
 * how each matched, what the answer says around them, and what is refused. How the read finds them is the
 * Implementer's.
 *
 *   RV1  a tapestryKey names the node that has it; a change entry, an event's tag node, or a key no node has names none
 *   RV2  a nostr address names the node at it, whatever its pubkey's case; one no node holds names none
 *   RV3  an event's id names the event, and the replaceable node whose latest event it is; never a tag whose uuid it is
 *   RV4  an naddr, nevent or note names what it decodes to; one that doesn't decode is read as a name and a slug
 *   RV5  a name names every node whose name it is, without regard to case or extra white space; the name is the
 *        tapestryValue, else the name; a name in another script resolves
 *   RV6  a concept header's plural names it too
 *   RV7  a slug names a concept whose slug it is, and a concept-graph node whose whole d-tag it is
 *   RV8  a node found several ways is listed once; change entries and keyless nodes never are; kind narrows
 *   RV9  each candidate is a node's five facts, its kind and how it matched, and nothing more
 *   RV10 the answer gives the ref as read, whether it is ambiguous, and kept and leftOut; it never picks one
 *   RV11 from the owner's point of view by default; ambiguity is judged among the candidates it keeps
 *   RV12 nothing about a point of view is stored: new scores answer differently, with no write between
 *   RV13 before the owner's scores exist, only the instance's own count, and the answer says so
 *   RV14 a pov the instance can't read from is refused unknown-pov; a malformed one invalid-input
 *   RV15 pages of 50 by default, in tapestryKey order; the cursors page through every candidate once; limit 1–200
 *   RV16 a cursor resolve didn't give for this same ref, kind and point of view is refused invalid-cursor
 *   RV17 what it refuses: no ref, an empty one, a character that makes it read as another, one too long, a bad kind,
 *        an input it doesn't take
 *   RV18 a visitor gets 401 and a stranger 403; an admin reads what the owner reads
 *   RV19 it writes nothing: reads only, the graph as it was, no change entry
 *   RV20 the command answers what the route answers, refusals included
 *   RV21 it is listed for an admin with its inputs and refusals, and has its /docs entry
 *   RV22 its paging and point of view are reads.js's, its ref, kind and candidate are resolve.js's, and the catalog
 *        says how an input names a node
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const { writeState } = require('../../helpers/graphFake');
const { seedResolve, PEERS, EVENT_ID, REPLACED_ID, GOU } = require('../../helpers/resolveGraph');

const { ROOT, OWNER, ADMIN, TA, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph resolve');

const ROUTE = '/api/tapestry/graph/resolve';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/resolve.js');
const MODULE = path.join(ROOT, 'src/operations/resolve.js');
const READS = path.join(ROOT, 'src/operations/reads.js');
const CATALOG = path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md');
const ANSWER_KEYS = ['ambiguous', 'candidates', 'cursor', 'kept', 'kind', 'leftOut', 'pov', 'readings', 'ref'];
const CANDIDATE_KEYS = ['address', 'author', 'kind', 'matched', 'name', 'own', 'tapestryKey'];
const OWNER_POV = { name: 'owner', observer: OWNER, cutoff: 0.05, scored: true };
const EVERYONE_POV = { name: 'everyone', observer: null, cutoff: null, scored: null };
const BEL = String.fromCharCode(0x07);
const RLO = String.fromCharCode(0x202e);
const ZWSP = String.fromCharCode(0x200b);
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));
const NADDR = NT.nip19.naddrEncode({ kind: 39998, pubkey: TA, identifier: 'dog' });
const NOTE = NT.nip19.noteEncode(EVENT_ID);
const NEVENT = NT.nip19.neventEncode({ id: EVENT_ID });
/** An naddr with its last character changed: its checksum fails. */
const BAD_NADDR = `${NADDR.slice(0, -1)}${NADDR.endsWith('q') ? 'p' : 'q'}`;

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/resolve.js does not exist yet (ADR graph-operations-first-slice/0009 Decision 4)');
}

const q = (params) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.set(k, String(v));
  const text = u.toString();
  return text ? `${ROUTE}?${text}` : ROUTE;
};
const get = (id, caller, params = {}) => ({ id, method: 'GET', url: q(params), caller });
/** One harness run of `requests` (and `cli`) over the graph in `file`. */
const runOver = (file, requests, cli = [], opts = {}) => S.answered(S.runHarness({ scenarios: [{ graphFake: { stateFile: file }, requests, cli }] }, { dir: tmp('resolve-run-'), ...opts }));
/** A fresh copy of a seed's graph, in a file of its own. */
const fileOf = (seed) => seed.file(tmp('resolve-graph-'));

function ok(a, id) {
  needDecl();
  const x = a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body)}`);
  assert(x.body && x.body.data && Array.isArray(x.body.data.candidates), `${id} answers { candidates, … }; got ${show(x.body && x.body.data)}`);
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
const keysOf = (candidates) => candidates.map((c) => c.tapestryKey);
const byKey = (d, key) => d.candidates.find((c) => c.tapestryKey === key);
/** The answer holds exactly these candidates, by the seed's names, in tapestryKey order, each matched as given. */
function expectCandidates(d, seed, want, label) {
  const names = Object.keys(want);
  const wantKeys = names.map((n) => {
    if (!seed.keys[n]) throw new Error(`resolveGraph: no node named ${n}`);
    return seed.keys[n];
  }).sort();
  assert(show(keysOf(d.candidates)) === show(wantKeys), `${label}: the candidates ${show(names)}, in tapestryKey order; got ${show(d.candidates.map((c) => c.name))}`);
  for (const [n, matched] of Object.entries(want)) {
    const c = byKey(d, seed.keys[n]);
    assert(show(c.matched) === show(matched), `${label}: ${n} matched ${show(matched)}; got ${show(c.matched)}`);
  }
}
const none = (d, label) => assert(d.candidates.length === 0 && d.cursor === null, `${label}: no candidate, and a null cursor; got ${show(d.candidates.map((c) => c.name))}`);

// ── the main run: one seeded graph, most of the requests ──
let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  const seed = seedResolve();
  const file = fileOf(seed);
  const k = seed.keys;
  const before = S.readState(file);
  const everyone = { pov: 'everyone', limit: 200 };
  const a = runOver(file, [
    get('dog-everyone', 'owner', { ref: 'dog', ...everyone }),
    get('dog-owner', 'owner', { ref: 'dog', limit: 200 }),
    get('dog-concept', 'owner', { ref: 'dog', kind: 'concept', limit: 200 }),
    get('dog-concept-everyone', 'owner', { ref: 'dog', kind: 'concept', ...everyone }),
    get('dog-set', 'owner', { ref: 'dog', kind: 'set', ...everyone }),
    get('dogs', 'owner', { ref: 'dogs', ...everyone }),
    get('dog-breed-name', 'owner', { ref: 'Dog Breed' }),
    get('dog-breed-spaces', 'owner', { ref: '  dog   breed  ' }),
    get('dog-breed-slug', 'owner', { ref: 'dog-breed' }),
    get('dog-breed-upper-slug', 'owner', { ref: 'Dog-Breed' }),
    get('dog-breeds', 'owner', { ref: 'dog breeds' }),
    get('dog-breeds-upper', 'owner', { ref: 'DOG BREEDS' }),
    get('net-dtag', 'owner', { ref: 'nostr-event-tag' }),
    get('net-slug', 'owner', { ref: 'nostr-event-tagging' }),
    get('net-name', 'owner', { ref: 'nostr event tagging' }),
    get('dog-superset', 'owner', { ref: 'dog-superset' }),
    get('cat-nonce', 'owner', { ref: 'cat~1' }),
    get('cat', 'owner', { ref: 'cat' }),
    get('fish', 'owner', { ref: 'fish' }),
    get('fishes', 'owner', { ref: 'fishes' }),
    get('fido', 'owner', { ref: 'fido' }),
    get('old-fido', 'owner', { ref: 'old fido' }),
    get('rex-owner', 'owner', { ref: 'rex' }),
    get('rex-everyone', 'owner', { ref: 'rex', pov: 'everyone' }),
    get('walkers', 'owner', { ref: 'walkers' }),
    get('walkers-set', 'owner', { ref: 'walkers', kind: 'set' }),
    get('gou', 'owner', { ref: GOU }),
    get('hi-dog', 'owner', { ref: 'hi dog' }),
    get('admin-note', 'owner', { ref: 'admin note' }),
    get('admin-note-everyone', 'owner', { ref: 'admin note', pov: 'everyone' }),
    get('nothing', 'owner', { ref: 'no such thing' }),
    get('ghost', 'owner', { ref: 'ghost', pov: 'everyone' }),
    get('relay-owner', 'owner', { ref: 'nostr relay' }),
    get('relay-everyone', 'owner', { ref: 'nostr relay', pov: 'everyone' }),
    get('relay-owner-pubkey', 'owner', { ref: 'nostr relay', pov: OWNER }),
    get('relay-owner-named', 'owner', { ref: 'nostr relay', pov: 'owner' }),
    get('key', 'owner', { ref: k.rex }),
    get('key-concept', 'owner', { ref: k.dog, kind: 'concept' }),
    get('key-wrong-kind', 'owner', { ref: k.rex, kind: 'concept' }),
    get('key-entry', 'owner', { ref: k.G, pov: 'everyone' }),
    get('key-tag', 'owner', { ref: k.eTag, pov: 'everyone' }),
    get('key-unknown', 'owner', { ref: crypto.randomUUID() }),
    get('address', 'owner', { ref: `39998:${TA}:dog` }),
    get('address-upper', 'owner', { ref: `39998:${TA.toUpperCase()}:dog` }),
    get('address-peer-list', 'owner', { ref: `30000:${PEERS.hi}:dog` }),
    get('address-unknown', 'owner', { ref: `39998:${TA}:no-such-concept` }),
    get('event-id', 'owner', { ref: EVENT_ID, pov: 'everyone' }),
    get('event-id-upper', 'owner', { ref: EVENT_ID.toUpperCase(), pov: 'everyone' }),
    get('replaced-id', 'owner', { ref: REPLACED_ID }),
    get('naddr', 'owner', { ref: NADDR }),
    get('note1', 'owner', { ref: NOTE, pov: 'everyone' }),
    get('nevent', 'owner', { ref: NEVENT, pov: 'everyone' }),
    get('naddr-bad', 'owner', { ref: BAD_NADDR }),
    get('item-1', 'owner', { ref: 'item' }),
    get('item-3', 'owner', { ref: 'item', limit: 3 }),
    get('item-200', 'owner', { ref: 'item', limit: 200 }),
    get('limit-0', 'owner', { ref: 'item', limit: 0 }),
    get('limit-201', 'owner', { ref: 'item', limit: 201 }),
    get('pov-stranger', 'owner', { ref: 'dog', pov: PEERS.stranger }),
    get('pov-admin', 'owner', { ref: 'dog', pov: ADMIN }),
    get('pov-house', 'owner', { ref: 'dog', pov: 'house' }),
    get('no-ref', 'owner', {}),
    get('empty-ref', 'owner', { ref: '' }),
    get('spaces-ref', 'owner', { ref: '   ' }),
    get('control-ref', 'owner', { ref: `dog${BEL}` }),
    get('bidi-ref', 'owner', { ref: `${RLO}dog` }),
    get('invisible-ref', 'owner', { ref: `do${ZWSP}g` }),
    get('long-ref', 'owner', { ref: 'x'.repeat(1001) }),
    get('ref-1000', 'owner', { ref: 'x'.repeat(1000) }),
    get('bad-kind', 'owner', { ref: 'dog', kind: 'property' }),
    get('unknown-input', 'owner', { ref: 'dog', foo: '1' }),
    get('visitor', 'visitor', { ref: 'dog' }),
    get('stranger', 'stranger', { ref: 'dog' }),
    get('admin', 'admin', { ref: 'dog', limit: 200 }),
    get('route-slug', 'owner', { ref: 'dog-breed' }),
    get('route-concept', 'owner', { ref: 'dog', kind: 'concept', pov: 'everyone' }),
    get('route-refusal', 'owner', { ref: 'dog', kind: 'property' }),
    { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
  ], [
    { id: 'cli-slug', argv: ['graph', 'resolve', '--ref', 'dog-breed'] },
    { id: 'cli-concept', argv: ['graph', 'resolve', '--ref', 'dog', '--kind', 'concept', '--pov', 'everyone'] },
    { id: 'cli-refusal', argv: ['graph', 'resolve', '--ref', 'dog', '--kind', 'property'] },
  ]);
  MAIN = { a, seed, k, file, before };
  return MAIN;
}

test('RV1: a tapestryKey names the node that has it; a change entry, an event\'s tag node, or a key no node has names none', () => {
  const { a, seed, k } = main();
  const d = ok(a, 'key');
  expectCandidates(d, seed, { rex: ['tapestryKey'] }, 'rex\'s key');
  assert(show(d.readings) === show([{ as: 'tapestryKey', value: k.rex }]), `a key is read as a tapestryKey only; got ${show(d.readings)}`);
  expectCandidates(ok(a, 'key-concept'), seed, { dog: ['tapestryKey'] }, 'dog\'s key, kind=concept');
  for (const id of ['key-wrong-kind', 'key-entry', 'key-tag', 'key-unknown']) none(ok(a, id), id);
});

test('RV2: a nostr address names the node at it, whatever its pubkey\'s case; one no node holds names none', () => {
  const { a, seed } = main();
  const d = ok(a, 'address');
  expectCandidates(d, seed, { dog: ['address'] }, 'the address of dog');
  assert(show(d.readings) === show([{ as: 'address', value: `39998:${TA}:dog` }]), `an address is read as an address only; got ${show(d.readings)}`);
  const upper = ok(a, 'address-upper');
  expectCandidates(upper, seed, { dog: ['address'] }, 'the address with its pubkey in capitals');
  assert(show(upper.readings) === show([{ as: 'address', value: `39998:${TA}:dog` }]), `its pubkey is looked up as events carry it, in lowercase; got ${show(upper.readings)}`);
  expectCandidates(ok(a, 'address-peer-list'), seed, { peerList: ['address'] }, 'a kind-30000 address');
  none(ok(a, 'address-unknown'), 'an address no node holds');
});

test('RV3: an event\'s id names the event, whatever its case, and the replaceable node whose latest event it is; never a tag whose uuid it is', () => {
  const { a, seed } = main();
  const d = ok(a, 'event-id');
  expectCandidates(d, seed, { note: ['address'] }, 'the note\'s id (the event tag whose uuid it is too is no candidate)');
  assert(show(d.readings) === show([{ as: 'address', value: EVENT_ID }]), `an event id is read as an address; got ${show(d.readings)}`);
  const upper = ok(a, 'event-id-upper');
  expectCandidates(upper, seed, { note: ['address'] }, 'the id in capitals');
  assert(show(upper.readings) === show([{ as: 'address', value: EVENT_ID }]), `it is looked up in lowercase; got ${show(upper.readings)}`);
  expectCandidates(ok(a, 'replaced-id'), seed, { breed: ['address'] }, 'the latest event id of dog breed\'s header');
});

test('RV4: an naddr, nevent or note names what it decodes to; one that doesn\'t decode is read as a name and a slug', () => {
  const { a, seed } = main();
  const d = ok(a, 'naddr');
  expectCandidates(d, seed, { dog: ['address'] }, 'dog\'s naddr');
  assert(d.ref === NADDR && show(d.readings) === show([{ as: 'address', value: `39998:${TA}:dog` }]), `the answer gives the naddr and the address it was read as; got ${show({ ref: d.ref, readings: d.readings })}`);
  expectCandidates(ok(a, 'note1'), seed, { note: ['address'] }, 'the note\'s note1');
  expectCandidates(ok(a, 'nevent'), seed, { note: ['address'] }, 'the note\'s nevent');
  const bad = ok(a, 'naddr-bad');
  none(bad, 'an naddr whose checksum fails');
  assert(show(bad.readings) === show([{ as: 'name', value: BAD_NADDR }, { as: 'slug', value: BAD_NADDR }]), `one that doesn't decode is read as a name and a slug; got ${show(bad.readings)}`);
});

test('RV5: a name names every node whose name it is, without regard to case or extra white space; a name in another script resolves', () => {
  const { a, seed } = main();
  const breed = ok(a, 'dog-breed-name');
  expectCandidates(breed, seed, { breed: ['name'] }, 'Dog Breed');
  assert(show(breed.readings) === show([{ as: 'name', value: 'Dog Breed' }]), `a name with a space is read as a name only; got ${show(breed.readings)}`);
  const spaces = ok(a, 'dog-breed-spaces');
  expectCandidates(spaces, seed, { breed: ['name'] }, 'dog breed with extra spaces');
  assert(spaces.ref === 'dog   breed', `the answer gives the ref as given, trimmed; got ${show(spaces.ref)}`);
  assert(show(spaces.readings) === show([{ as: 'name', value: 'dog breed' }]), `the name it looked up has each run of white space as one space; got ${show(spaces.readings)}`);
  expectCandidates(ok(a, 'net-name'), seed, { net: ['name'] }, 'nostr event tagging');
  expectCandidates(ok(a, 'fido'), seed, { fido: ['name'] }, 'fido, its tapestryValue');
  none(ok(a, 'old-fido'), 'old fido, its name property, which its tapestryValue stands before');
  const gou = ok(a, 'gou');
  expectCandidates(gou, seed, { gou: ['name'] }, 'a name in another script');
  assert(show(gou.readings) === show([{ as: 'name', value: GOU }]), `it is read as a name; got ${show(gou.readings)}`);
});

test('RV6: a concept header\'s plural names it too', () => {
  const { a, seed } = main();
  expectCandidates(ok(a, 'dogs'), seed, { dog: ['plural'], peerDog: ['plural'] }, 'dogs, from everyone\'s point of view');
  expectCandidates(ok(a, 'dog-breeds'), seed, { breed: ['plural'] }, 'dog breeds');
  expectCandidates(ok(a, 'dog-breeds-upper'), seed, { breed: ['plural'] }, 'DOG BREEDS');
  none(ok(a, 'fishes'), 'fishes, when fish\'s names tag holds no plural');
});

test('RV7: a slug names a concept whose slug it is, and a concept-graph node whose whole d-tag it is', () => {
  const { a, seed } = main();
  const slug = ok(a, 'dog-breed-slug');
  expectCandidates(slug, seed, { breed: ['slug', 'd-tag'] }, 'dog-breed');
  assert(show(slug.readings) === show([{ as: 'name', value: 'dog-breed' }, { as: 'slug', value: 'dog-breed' }]), `a slug is read as a name and a slug; got ${show(slug.readings)}`);
  const upper = ok(a, 'dog-breed-upper-slug');
  expectCandidates(upper, seed, { breed: ['slug', 'd-tag'] }, 'Dog-Breed');
  assert(show(upper.readings) === show([{ as: 'name', value: 'Dog-Breed' }, { as: 'slug', value: 'dog-breed' }]), `its slug is its lowercase; got ${show(upper.readings)}`);
  expectCandidates(ok(a, 'net-dtag'), seed, { net: ['d-tag'] }, 'nostr-event-tag, its d-tag');
  expectCandidates(ok(a, 'net-slug'), seed, { net: ['slug'] }, 'nostr-event-tagging, its slug');
  expectCandidates(ok(a, 'dog-superset'), seed, { dogSuperset: ['d-tag'] }, 'dog-superset, a core node\'s d-tag');
  expectCandidates(ok(a, 'cat-nonce'), seed, { cat1: ['d-tag'] }, 'cat~1, a versioned address\'s d-tag');
  expectCandidates(ok(a, 'cat'), seed, { cat1: ['name', 'slug'] }, 'cat: its name and its slug, not its d-tag cat~1');
  expectCandidates(ok(a, 'fish'), seed, { fish: ['name', 'd-tag'] }, 'fish, with no slug tag: its name and its d-tag');
  const dog = ok(a, 'dog-everyone');
  for (const not of ['peerList', 'colon']) assert(!keysOf(dog.candidates).includes(seed.keys[not]), `dog doesn't name ${not}: a kind-30000 address's d-tag isn't a concept-graph slug, and x:dog isn't dog`);
});

test('RV8: a node found several ways is listed once; change entries and keyless nodes never are; kind narrows', () => {
  const { a, seed } = main();
  const dog = ok(a, 'dog-everyone');
  expectCandidates(dog, seed, { dog: ['name', 'slug', 'd-tag'], peerDog: ['name', 'slug', 'd-tag'], dogItem: ['name'] }, 'dog, from everyone\'s point of view');
  assert(!keysOf(dog.candidates).includes(seed.keys.G), 'the change entry named dog is never a candidate');
  none(ok(a, 'ghost'), 'ghost, whose nodes have no tapestryKey or the placeholder \'{}\'');
  expectCandidates(ok(a, 'dog-concept-everyone'), seed, { dog: ['name', 'slug', 'd-tag'], peerDog: ['name', 'slug', 'd-tag'] }, 'dog, kind=concept');
  none(ok(a, 'dog-set'), 'dog, kind=set');
  expectCandidates(ok(a, 'walkers'), seed, { walkers: ['name', 'd-tag'], cardSet: ['name'] }, 'walkers, any node');
  expectCandidates(ok(a, 'walkers-set'), seed, { walkers: ['name', 'd-tag'] }, 'walkers, kind=set: the card set has no address, so is no set');
  expectCandidates(ok(a, 'rex-everyone'), seed, { rex: ['name', 'd-tag'], peerRex: ['name', 'd-tag'] }, 'rex, from everyone\'s point of view');
});

test('RV9: each candidate is a node\'s five facts, its kind and how it matched, and nothing more', () => {
  const { a, k } = main();
  const dog = ok(a, 'dog-everyone');
  for (const c of dog.candidates) assert(show(Object.keys(c).sort()) === show(CANDIDATE_KEYS), `a candidate has exactly ${show(CANDIDATE_KEYS)}; got ${show(c)}`);
  const own = byKey(dog, k.dog);
  assert(own.name === 'dog' && own.address === `39998:${TA}:dog` && own.author === TA && own.own === true && own.kind === 'concept',
    `dog: its name, its address, the assistant as author, the instance's own, a concept; got ${show(own)}`);
  const peer = byKey(dog, k.peerDog);
  assert(peer.author === PEERS.lo && peer.own === false && peer.kind === 'concept', `the peer's dog, labelled ListHeader only, is a concept and not the instance's own; got ${show(peer)}`);
  const item = byKey(dog, k.dogItem);
  assert(item.name === 'Dog' && item.kind === 'node' && item.own === true, `Dog, an element: another node, with its name as stored; got ${show(item)}`);
  assert(byKey(ok(a, 'dog-superset'), k.dogSuperset).kind === 'superset', 'dog\'s superset is a superset');
  const walkers = ok(a, 'walkers');
  assert(byKey(walkers, k.walkers).kind === 'set', 'walkers, with an address, is a set');
  const card = byKey(walkers, k.cardSet);
  assert(card.kind === 'node' && card.address === null && card.author === null && card.own === true, `the card set, with no address and no author: another node, and the instance's own; got ${show(card)}`);
  const rex = byKey(ok(a, 'key'), k.rex);
  assert(rex.author === OWNER && rex.own === true && rex.name === 'Rex', `rex: the owner's, so the instance's own; got ${show(rex)}`);
  assert(byKey(ok(a, 'fido'), k.fido).name === 'Fido', 'fido is answered with its tapestryValue as its name');
});

test('RV10: the answer gives the ref as read, whether it is ambiguous, and kept and leftOut; it never picks one', () => {
  const { a, seed } = main();
  const d = ok(a, 'dog-owner');
  assert(show(Object.keys(d).sort()) === show(ANSWER_KEYS), `the answer holds ${show(ANSWER_KEYS)}; got ${show(Object.keys(d))}`);
  expectCandidates(d, seed, { dog: ['name', 'slug', 'd-tag'], dogItem: ['name'] }, 'dog, from the owner\'s point of view');
  assert(d.ambiguous === true && d.kept === 2 && d.leftOut === 1, `two of the instance's own count, so it's ambiguous, and the peer's dog is left out; got ${show({ ambiguous: d.ambiguous, kept: d.kept, leftOut: d.leftOut })}`);
  assert(d.ref === 'dog' && d.kind === null, `the ref as given, and kind null for any node; got ${show({ ref: d.ref, kind: d.kind })}`);
  const concept = ok(a, 'dog-concept');
  assert(concept.ambiguous === false && concept.kept === 1 && concept.leftOut === 1 && concept.kind === 'concept', `kind=concept: one counts, not ambiguous; got ${show({ ambiguous: concept.ambiguous, kept: concept.kept, leftOut: concept.leftOut, kind: concept.kind })}`);
  const nothing = ok(a, 'nothing');
  none(nothing, 'a ref that names nothing');
  assert(nothing.ambiguous === false && nothing.kept === 0 && nothing.leftOut === 0, `an empty list, not a refusal; got ${show(nothing)}`);
  const leftOut = ok(a, 'admin-note');
  none(leftOut, 'a ref whose only node the point of view leaves out');
  assert(leftOut.kept === 0 && leftOut.leftOut === 1 && leftOut.ambiguous === false, `kept 0 and left out 1; got ${show({ kept: leftOut.kept, leftOut: leftOut.leftOut })}`);
});

test('RV11: from the owner\'s point of view by default; ambiguity is judged among the candidates it keeps', () => {
  const { a, seed } = main();
  const relay = ok(a, 'relay-owner');
  expectCandidates(relay, seed, { relay: ['name'] }, 'nostr relay, from the owner\'s point of view: a name with a space is no slug');
  assert(relay.ambiguous === false && relay.kept === 1 && relay.leftOut === 1, `the instance's own nostr relay, with the peer's left out: not ambiguous; got ${show({ ambiguous: relay.ambiguous, kept: relay.kept, leftOut: relay.leftOut })}`);
  assert(show(relay.pov) === show(OWNER_POV), `pov: the owner's, with the default cutoff and scores; got ${show(relay.pov)}`);
  const all = ok(a, 'relay-everyone');
  expectCandidates(all, seed, { relay: ['name'], peerRelay: ['name'] }, 'nostr relay, from everyone\'s');
  assert(all.ambiguous === true && all.kept === 2 && all.leftOut === 0 && show(all.pov) === show(EVERYONE_POV), `from everyone's point of view, both count, so it's ambiguous; got ${show({ ambiguous: all.ambiguous, kept: all.kept, leftOut: all.leftOut, pov: all.pov })}`);
  for (const id of ['relay-owner-pubkey', 'relay-owner-named']) assert(show(ok(a, id)) === show(relay), `${id}: the owner's pubkey, and pov=owner, read exactly as the default`);
  expectCandidates(ok(a, 'hi-dog'), seed, { hiDog: ['name'] }, 'hi dog, by a peer scored above the cutoff');
  expectCandidates(ok(a, 'admin-note-everyone'), seed, { adminNote: ['name'] }, 'admin note, from everyone\'s point of view');
  const rex = ok(a, 'rex-owner');
  expectCandidates(rex, seed, { rex: ['name', 'd-tag'] }, 'rex, from the owner\'s point of view');
  assert(rex.ambiguous === false && rex.kept === 1 && rex.leftOut === 1, `the owner's Rex counts and lo's is left out; got ${show({ ambiguous: rex.ambiguous, kept: rex.kept, leftOut: rex.leftOut })}`);
});

test('RV12: nothing about a point of view is stored: new scores answer differently, with no write between', () => {
  needDecl();
  const seed = seedResolve({ items: 0 });
  const file = fileOf(seed);
  const first = ok(runOver(file, [get('before', 'owner', { ref: 'rex' })]), 'before');
  assert(first.kept === 1 && first.leftOut === 1 && first.ambiguous === false, `at first only the owner's Rex counts; got ${show({ kept: first.kept, leftOut: first.leftOut })}`);
  const st = S.readState(file);
  for (const n of st.nodes) if (n.labels.includes('NostrUser') && n.props.pubkey === PEERS.lo) n.props.influence = 0.3;
  const logLength = st.log.length;
  writeState(file, st);
  const second = ok(runOver(file, [get('after', 'owner', { ref: 'rex' })]), 'after');
  expectCandidates(second, seed, { rex: ['name', 'd-tag'], peerRex: ['name', 'd-tag'] }, 'rex, once lo is scored 0.3');
  assert(second.ambiguous === true && second.kept === 2 && second.leftOut === 0, `both count now, so it's ambiguous; got ${show({ ambiguous: second.ambiguous, kept: second.kept, leftOut: second.leftOut })}`);
  const log = S.readState(file).log.slice(logLength);
  assert(log.length > 0 && log.every((e) => e.call === 'read'), `resolve only reads; nothing is written for a point of view; the log: ${show(log)}`);
});

test('RV13: before the owner\'s scores exist, only the instance\'s own count, and the answer says so', () => {
  needDecl();
  const seed = seedResolve({ unscored: true, items: 0 });
  const a = runOver(fileOf(seed), [get('hi-dog', 'owner', { ref: 'hi dog' }), get('rex', 'owner', { ref: 'rex' })]);
  const hi = ok(a, 'hi-dog');
  none(hi, 'hi dog, before any score exists');
  assert(hi.kept === 0 && hi.leftOut === 1 && hi.pov.scored === false, `hi's node is left out, and pov.scored is false; got ${show({ kept: hi.kept, leftOut: hi.leftOut, pov: hi.pov })}`);
  const rex = ok(a, 'rex');
  assert(rex.kept === 1 && rex.leftOut === 1, `the owner's Rex still counts; got ${show({ kept: rex.kept, leftOut: rex.leftOut })}`);
});

test('RV14: a pov the instance can\'t read from is refused unknown-pov, saying which it can; a malformed one invalid-input', () => {
  const { a } = main();
  for (const id of ['pov-stranger', 'pov-admin']) {
    const b = refused(a, id, 400, 'unknown-pov', 'pov');
    assert(/owner/.test(b.error) && /everyone/.test(b.error), `${id}: the refusal says it reads from the owner's point of view or everyone's; got ${show(b.error)}`);
  }
  refused(a, 'pov-house', 400, 'invalid-input', 'pov');
});

test('RV15: pages of 50 by default, in tapestryKey order; the cursors page through every candidate once; limit 1 to 200', () => {
  const { a, seed, file } = main();
  const p1 = ok(a, 'item-1');
  assert(p1.candidates.length === 50 && typeof p1.cursor === 'string' && p1.cursor.length > 0, `page 1: 50 candidates and a cursor; got ${p1.candidates.length} and ${show(p1.cursor)}`);
  assert(p1.kept === 120 && p1.leftOut === 0 && p1.ambiguous === true, `kept counts the whole list, not the page; got ${show({ kept: p1.kept, leftOut: p1.leftOut, ambiguous: p1.ambiguous })}`);
  const p2 = ok(runOver(file, [get('item-2', 'owner', { ref: 'item', cursor: p1.cursor })]), 'item-2');
  assert(p2.candidates.length === 50 && typeof p2.cursor === 'string', `page 2: 50 more and a cursor; got ${p2.candidates.length} and ${show(p2.cursor)}`);
  const p3 = ok(runOver(file, [get('item-3rd', 'owner', { ref: 'item', cursor: p2.cursor })]), 'item-3rd');
  assert(p3.candidates.length === 20 && p3.cursor === null, `page 3: the last 20, and a null cursor; got ${p3.candidates.length} and ${show(p3.cursor)}`);
  const all = [...keysOf(p1.candidates), ...keysOf(p2.candidates), ...keysOf(p3.candidates)];
  assert(show(all) === show(seed.itemKeys), 'the three pages hold every node named item exactly once, in ascending tapestryKey order');
  const three = ok(a, 'item-3');
  assert(show(keysOf(three.candidates)) === show(seed.itemKeys.slice(0, 3)) && typeof three.cursor === 'string', `limit 3: the first 3, and a cursor; got ${three.candidates.length}`);
  const max = ok(a, 'item-200');
  assert(max.candidates.length === 120 && max.cursor === null, `limit 200: all 120, and a null cursor; got ${max.candidates.length}`);
  refused(a, 'limit-0', 400, 'invalid-input', 'limit');
  refused(a, 'limit-201', 400, 'invalid-input', 'limit');
});

test('RV16: a cursor resolve didn\'t give for this same ref, kind and point of view is refused invalid-cursor', () => {
  const { a, seed, file, k } = main();
  const cursor = ok(a, 'item-3').cursor;
  assert(typeof cursor === 'string', 'limit 3 gave a cursor');
  const enc = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
  const listElements = enc(['graph list-elements', '0123456789abcdef', seed.itemKeys[0]]);
  const historys = enc(['2026-01-01T00:00:00.000Z', k.G]);
  const b = runOver(file, [
    get('same', 'owner', { ref: 'item', limit: 3, cursor }),
    get('other-ref', 'owner', { ref: 'rex', limit: 3, cursor }),
    get('other-kind', 'owner', { ref: 'item', kind: 'concept', limit: 3, cursor }),
    get('other-pov', 'owner', { ref: 'item', pov: 'everyone', limit: 3, cursor }),
    get('garbage', 'owner', { ref: 'item', cursor: 'garbage!!' }),
    get('list-elements', 'owner', { ref: 'item', cursor: listElements }),
    get('historys', 'owner', { ref: 'item', cursor: historys }),
  ]);
  const next = ok(b, 'same');
  assert(show(keysOf(next.candidates)) === show(seed.itemKeys.slice(3, 6)), `the cursor pages its own list: the next 3; got ${next.candidates.length}`);
  for (const id of ['other-ref', 'other-kind', 'other-pov', 'garbage', 'list-elements', 'historys']) refused(b, id, 400, 'invalid-cursor', 'cursor');
});

test('RV17: it refuses no ref, an empty one, a character that makes it read as another, one too long, a bad kind and an input it doesn\'t take', () => {
  const { a } = main();
  refused(a, 'no-ref', 400, 'missing-input', 'ref');
  for (const id of ['empty-ref', 'spaces-ref']) refused(a, id, 400, 'bad-ref', 'ref');
  for (const [id, point] of [['control-ref', 'U+0007'], ['bidi-ref', 'U+202E'], ['invisible-ref', 'U+200B']]) {
    const b = refused(a, id, 400, 'bad-ref', 'ref');
    assert(b.error.includes(point), `${id}: the refusal names the character, ${point}; got ${show(b.error)}`);
  }
  refused(a, 'long-ref', 400, 'invalid-input', 'ref');
  none(ok(a, 'ref-1000'), 'a ref of 1,000 characters is read, and names nothing here');
  refused(a, 'bad-kind', 400, 'invalid-input', 'kind');
  refused(a, 'unknown-input', 400, 'unknown-input', 'foo');
});

test('RV18: a visitor gets 401 and a stranger 403; an admin reads what the owner reads', () => {
  const { a } = main();
  needDecl();
  assert(a.req('visitor').status === 401 && a.req('stranger').status === 403, `a visitor 401, a stranger 403; got ${a.req('visitor').status}, ${a.req('stranger').status}`);
  assert(show(ok(a, 'admin')) === show(ok(a, 'dog-owner')), 'an admin reads exactly what the owner reads, from the owner\'s point of view');
});

test('RV19: it writes nothing: it only reads, the graph is as it was, and no change entry is recorded', () => {
  const { a, file, before } = main();
  ok(a, 'dog-owner');
  ok(a, 'relay-everyone');
  const after = S.readState(file);
  const log = after.log.slice(before.log.length);
  assert(log.length > 0 && log.every((e) => e.call === 'read'), `resolve opens no write transaction; the log: ${show(log.filter((e) => e.call !== 'read').slice(0, 5))}`);
  assert(after.nodes.length === before.nodes.length && after.rels.length === before.rels.length, 'the graph has the same nodes and relationships');
  assert(S.entriesOf(after).length === S.entriesOf(before).length, 'no change entry was recorded');
});

test('RV20: the command answers what the route answers, refusals included', () => {
  const { a } = main();
  needDecl();
  for (const [c, r, code] of [['cli-slug', 'route-slug', 0], ['cli-concept', 'route-concept', 0], ['cli-refusal', 'route-refusal', 1]]) {
    const cmd = a.cmd(c);
    assert(cmd.code === code, `${c} exits ${code}; got ${cmd.code} ${String(cmd.stderr).slice(-300)}`);
    let body = null;
    try { body = JSON.parse(cmd.stdout); } catch { /* reported below */ }
    assert(body && show(body) === show(a.req(r).body), `${c} prints what ${r} answers; command ${show(body).slice(0, 300)}, route ${show(a.req(r).body).slice(0, 300)}`);
  }
});

test('RV21: it is listed for an admin with its inputs and refusals, and has its /docs entry', () => {
  const { a } = main();
  needDecl();
  const list = a.req('list');
  const e = ((list.body.data && list.body.data.operations) || []).find((o) => o.group === 'graph' && o.name === 'resolve');
  assert(e, `graph resolve is listed for an admin; problems: ${show(list.body.data && list.body.data.problems)}`);
  assert(e.kind === 'read' && e.method === 'GET' && e.access === 'owner-and-admins' && e.route === ROUTE && e.command === 'tapestry graph resolve', `a GET read for the owner and admins; got ${show({ kind: e.kind, method: e.method, access: e.access, route: e.route, command: e.command })}`);
  assert(show(Object.keys(e.inputs).sort()) === show(['cursor', 'kind', 'limit', 'pov', 'ref']), `its inputs: ref, kind, pov, limit and cursor; got ${show(Object.keys(e.inputs))}`);
  const codes = e.refusals.map((x) => `${x.code}:${x.status}`);
  for (const c of ['bad-ref:400', 'unknown-pov:400', 'invalid-cursor:400', 'missing-input:400', 'unknown-input:400', 'invalid-input:400', 'sign-in-required:401', 'not-allowed:403']) {
    assert(codes.includes(c), `its refusals include ${c}; got ${show(codes)}`);
  }
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    const names = p && p.get ? (p.get.parameters || []).map((x) => x.name).sort() : null;
    process.stdout.write('RESULT:' + JSON.stringify({ methods: p ? Object.keys(p) : null, names }));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('resolve-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  const docs = line ? JSON.parse(line) : null;
  assert(docs && show(docs.methods) === show(['get']), `/docs has GET ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
  assert(show(docs.names) === show(['cursor', 'kind', 'limit', 'pov', 'ref']), `/docs gives its five query parameters; got ${show(docs.names)}`);
});

test('RV22: its paging and point of view are reads.js\'s, its ref, kind and candidate are resolve.js\'s, and the catalog says how an input names a node', () => {
  needDecl();
  if (!fs.existsSync(MODULE)) throw new Error('src/operations/resolve.js does not exist yet (ADR graph-operations-first-slice/0009 Decisions 1–3 and 5)');
  const child = spawnSync(process.execPath, ['-e', `
    const R = require(${JSON.stringify(READS)});
    const RS = require(${JSON.stringify(MODULE)});
    const d = require(${JSON.stringify(DECL)});
    const pick = (r) => r && { code: r.code, status: r.status };
    const props = (d.result && d.result.schema && d.result.schema.properties) || {};
    process.stdout.write('RESULT:' + JSON.stringify({
      limit: [d.inputs.limit && d.inputs.limit.schema, R.LIMIT_INPUT && R.LIMIT_INPUT.schema],
      cursor: [d.inputs.cursor && d.inputs.cursor.schema, R.CURSOR_INPUT && R.CURSOR_INPUT.schema],
      pov: [d.inputs.pov && d.inputs.pov.schema, R.POV_INPUT && R.POV_INPUT.schema],
      ref: [d.inputs.ref && d.inputs.ref.schema, RS.REF_INPUT && RS.REF_INPUT.schema, d.inputs.ref && d.inputs.ref.required],
      kind: [d.inputs.kind && d.inputs.kind.schema, RS.KIND_INPUT && RS.KIND_INPUT.schema],
      refusals: (d.refusals || []).map(pick),
      badRef: pick(RS.BAD_REF), invalidCursor: pick(R.INVALID_CURSOR), unknownPov: pick(R.UNKNOWN_POV),
      candidate: [props.candidates && props.candidates.items, RS.CANDIDATE],
      node: R.NODE,
      povSchema: [props.pov, R.POV],
    }));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('resolve-once-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  const x = line ? JSON.parse(line) : null;
  assert(x, `the declaration, resolve.js and reads.js load; ${(child.stderr || '').slice(-400)}`);
  for (const input of ['limit', 'cursor', 'pov']) assert(x[input][1] && show(x[input][0]) === show(x[input][1]), `its ${input} input is reads.js's; got ${show(x[input])}`);
  assert(x.ref[1] && show(x.ref[0]) === show(x.ref[1]) && x.ref[2] === true, `its ref input is resolve.js's REF_INPUT, and required; got ${show(x.ref)}`);
  assert(x.ref[1].type === 'string' && x.ref[1].maxLength === 1000, `a ref is text of at most 1,000 characters; got ${show(x.ref[1])}`);
  assert(x.kind[1] && show(x.kind[0]) === show(x.kind[1]) && show(x.kind[1].enum) === show(['concept', 'set']), `its kind input is resolve.js's KIND_INPUT, concept or set; got ${show(x.kind)}`);
  for (const r of [x.badRef, x.invalidCursor, x.unknownPov]) assert(r && x.refusals.some((y) => y.code === r.code && y.status === r.status), `it declares ${show(r)}; got ${show(x.refusals)}`);
  assert(x.candidate[1] && show(x.candidate[0]) === show(x.candidate[1]), `its candidates are resolve.js's CANDIDATE; got ${show(x.candidate[0])}`);
  for (const [fact, schema] of Object.entries(x.node.properties)) {
    assert(show(x.candidate[1].properties[fact]) === show(schema), `CANDIDATE keeps NODE's ${fact} as reads.js gives it; got ${show(x.candidate[1].properties[fact])}`);
  }
  for (const fact of [...x.node.required, 'kind', 'matched']) assert(x.candidate[1].required.includes(fact), `CANDIDATE requires ${fact}; got ${show(x.candidate[1].required)}`);
  assert(x.povSchema[1] && show(x.povSchema[0]) === show(x.povSchema[1]), `its pov is reads.js's POV; got ${show(x.povSchema)}`);
  const text = fs.readFileSync(CATALOG, 'utf8');
  const conventions = (text.split(/\n## Conventions\n/)[1] || '').split(/\n## /)[0];
  const naming = conventions.split('\n').find((l) => /\*\*Naming a node\.\*\*/.test(l)) || '';
  for (const words of ['src/operations/resolve.js', '0009', '`ambiguous-ref`', '`unknown-ref`', '`graph resolve`']) {
    assert(naming.includes(words), `the Conventions' "Naming a node" bullet mentions ${words}; got ${show(naming.slice(0, 300))}`);
  }
  const row = text.split('\n').find((l) => l.startsWith('| `resolve` |')) || '';
  for (const words of ['ambiguous', 'candidates', 'kept', 'leftOut', '`kind`']) assert(row.includes(words), `§1's resolve row gives the answer as built, ${words} among it; got ${show(row)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
