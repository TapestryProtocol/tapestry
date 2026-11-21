'use strict';
/**
 * export nostr — tapestry: links, whole values, lmdb: pointers and the references it can't name. Run by
 * test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/34-export-nostr.md (AC3; AC1's unbuildable)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0034-export-nostr.md (Decisions 4.5, 4.6, 7 and 9;
 *          graph-rules/0002 Decision 3; ADR 0019 Decision 14)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/34-export-nostr.test-plan.md
 *
 * Stack-free, over test/helpers/exportFixtures.js's world. Linker, made by graph create-element, holds five links in its
 * description: to dog's header (which has a letter), to Rex (sent in the same call), to alice's kind 1 note (whose address
 * is an event id), to Walkers (one of the instance's own, with no letter, outside the call) and to a key no node has.
 * Tom's friend is the whole value tapestry:<Rex>, Spot's tapestry:<Fido>. dog's big has a description that is an lmdb:
 * pointer to text holding a link, and a summary pointing at nothing; dog's gone has a json pointing at nothing.
 *
 *   EK1  each link becomes nostr:naddr1… for a node with a letter or one sent in the call (decoded: its kind, pubkey and
 *        d-tag), nostr:nevent1… for a node whose address is an event id, and its text for the rest, each of those
 *        reported link-dropped with the node, where and the key; no letter carries tapestry:
 *   EK2  a whole value tapestry:<key> becomes nostr:naddr1… when its target is in the call, and is left out of the letter
 *        and reported value-left-out when its target has no letter
 *   EK3  a tag naming one of the instance's own nodes with no letter, outside the call, is reported unsent-reference, and
 *        the letter still names it
 *   EK4  after it all, the nodes keep their tapestry: links and values in the graph, their tags as they were
 *   EK5  an lmdb: whole value is resolved before anything else, so the link in it is rewritten too; one the store
 *        doesn't hold is left out and reported pointer-unresolved; a json pointing at nothing makes its node unbuildable,
 *        reported, its letter not built (AC1's unbuildable, which no other test of the plan's list names)
 *   EK6  a graph that lists an address or an id no node holds reports not-found, and its other nodes are still sent
 */

const S = require('../../helpers/graphOpsSuite');
const X = require('../../helpers/exportFixtures');

const { assert } = S;
const show = (x) => String(S.show(x));
const { test, run } = S.makeSuite('operations: export nostr — tapestry: links, whole values and references it can\'t name');
const { exp } = X;

const linkTo = (text, label) => { const m = String(text).match(new RegExp(`\\[${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\(([^)]+)\\)`)); return m ? m[1] : null; };
const noTapestry = (events) => events.every((e) => !X.strings(e).some((s) => s.includes('tapestry:')));
const tagValue = (e, type) => { const t = (e.tags || []).find((x) => x[0] === type); return t ? t[1] : undefined; };

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    X.needDecl();
    const w = await X.world();
    const k = w.keys;
    const base = { ownEvents: w.ownEvents, lmdb: w.lmdb };
    const before = X.copy(w.state);
    const r = X.runExport({
      ...base, state: X.copy(w.state), label: 'export-nostr-links',
      // In this order: big before Rex has a letter, then the calls that send him.
      requests: [
        exp('big', 'owner', { node: k.dogBig }),
        exp('gone', 'owner', { node: k.dogGone }),
        exp('linked', 'owner', { graph: k.linked }),
        exp('picks', 'owner', { graph: k.picks }),
        exp('spot', 'owner', { node: k.spot }),
        exp('missing', 'owner', { graph: k.missing }),
      ],
    });
    return { w, k, before, r, after: r.state(), store: r.store() };
  })();
  return MAIN;
}
function sent(m, id, key) {
  const l = X.letterFor(X.data(m.r, id), key);
  const e = l && m.store.find((x) => x.id === l.id);
  assert(e, `${id}: ${key}'s letter was sent; got ${show(l)}`);
  return e;
}

test('EK1 [AC3, Decision 7]: a link becomes naddr for a node with a letter or sent in the call, nevent for an event id, and its text otherwise, reported link-dropped', async () => {
  const m = await main();
  const { w, k } = m;
  const linker = sent(m, 'linked', k.linker);
  const text = X.letterJson(linker).pet.description;
  const decoded = (label) => X.decodeNip19(linkTo(text, label));
  const dog = decoded('the dog concept');
  assert(dog && dog.type === 'naddr' && dog.data.kind === 39998 && dog.data.pubkey === X.TA && dog.data.identifier === 'dog' && /^nostr:naddr1/.test(linkTo(text, 'the dog concept')), `the link to dog's header, which has a letter, is its nostr:naddr1…; got ${show(text)}`);
  const rexAddress = w.addr.rex.split(':');
  const rex = decoded('Rex');
  assert(rex && rex.type === 'naddr' && rex.data.kind === 39999 && rex.data.pubkey === X.TA && rex.data.identifier === rexAddress.slice(2).join(':'), `the link to Rex, sent in the same call, is his naddr; got ${show(text)}`);
  const note = decoded('a note');
  assert(note && note.type === 'nevent' && note.data.id === w.letters.aliceNote.id && /^nostr:nevent1/.test(linkTo(text, 'a note')), `the link to alice's note, whose address is its id, is its nostr:nevent1…; got ${show(text)}`);
  assert(/ Walkers and a ghost$/.test(text) && linkTo(text, 'Walkers') === null && linkTo(text, 'a ghost') === null, `the links to Walkers (no letter, outside the call) and to a key no node has are dropped, their text kept; got ${show(text)}`);
  const dropped = X.reportsOf(X.data(m.r, 'linked'), 'link-dropped');
  for (const key of [k.walkers, k.ghost]) {
    assert(dropped.some((r) => X.mentions(r, key) && X.mentions(r, k.linker) && X.mentions(r, 'description')), `link-dropped names the node, where (its description) and the key ${key}; got ${show(dropped)}`);
  }
  const all = X.lettersOf(X.data(m.r, 'linked')).map((l) => m.store.find((e) => e.id === l.id)).filter(Boolean);
  assert(all.length >= 3 && noTapestry(all), `no letter the call sent carries tapestry:; got ${show(all.map((e) => X.strings(e).filter((s) => s.includes('tapestry:'))))}`);
});

test('EK2 [AC3, ADR 0019 Decision 14]: a whole value tapestry:<key> becomes the target\'s naddr, or is left out of the letter and reported value-left-out', async () => {
  const m = await main();
  const { w, k } = m;
  const tom = X.letterJson(sent(m, 'picks', k.tom));
  const friend = X.decodeNip19(tom.pet.friend);
  assert(/^nostr:naddr1/.test(tom.pet.friend) && friend && friend.data.identifier === w.addr.rex.split(':').slice(2).join(':'), `Tom's friend, tapestry:<Rex> with Rex in the call, is Rex's naddr; got ${show(tom.pet)}`);
  const spot = X.letterJson(sent(m, 'spot', k.spot));
  assert(spot && spot.pet && !('friend' in spot.pet) && spot.pet.description === 'a spotted one', `Spot's friend, tapestry:<Fido> with Fido unsent, is left out of the letter, the rest kept; got ${show(spot && spot.pet)}`);
  const left = X.reportsOf(X.data(m.r, 'spot'), 'value-left-out');
  assert(left.some((r) => X.mentions(r, k.spot) && X.mentions(r, 'friend')), `value-left-out names the node and the path; got ${show(left)}`);
});

test('EK3 [AC3, open question 3]: a tag naming an own node with no letter, outside the call, is reported unsent-reference, and the letter still names it', async () => {
  const m = await main();
  const { w, k } = m;
  const spot = sent(m, 'spot', k.spot);
  assert((spot.tags || []).some((t) => t[0] === 'z' && t[1] === w.addr.petHeader), `Spot's letter still names pet's header in its z; got ${show(spot.tags)}`);
  const unsent = X.reportsOf(X.data(m.r, 'spot'), 'unsent-reference');
  assert(unsent.some((r) => X.mentions(r, k.petHeader) || X.mentions(r, w.addr.petHeader)), `unsent-reference names pet's header, which has no letter and isn't in the call; got ${show(unsent)}`);
});

test('EK4 [AC3]: after the export, each node keeps its tapestry: links and values in the graph, and its tags as they were', async () => {
  const m = await main();
  const { k, before, after } = m;
  X.data(m.r, 'linked');
  for (const key of [k.linker, k.tom, k.spot]) {
    const was = X.nodeByKey(before, key);
    const now = X.nodeByKey(after, key);
    assert(X.sameTags(X.tagArrays(before, was), X.tagArrays(after, now)), `${key}: its tags are as they were`);
  }
  assert(X.jsonOf(after, k.linker).pet.description.includes(`tapestry:${k.walkers}`) && X.jsonOf(after, k.linker).pet.description.includes(`tapestry:${k.rex}`), 'Linker keeps its tapestry: links, rewritten in the letter only');
  assert(X.jsonOf(after, k.tom).pet.friend === `tapestry:${k.rex}` && X.jsonOf(after, k.spot).pet.friend === `tapestry:${k.fido}`, 'Tom and Spot keep their whole values');
});

test('EK5 [AC3, AC1, Decisions 4.5 and 4.6]: an lmdb: value is resolved first, its link rewritten; one the store lacks is left out and reported; a json pointing at nothing is unbuildable', async () => {
  const m = await main();
  const { w, k } = m;
  const big = sent(m, 'big', k.dogBig);
  assert(tagValue(big, 'description') === 'a big one, like Rex', `big's description, an lmdb: pointer, is resolved, and the link in it dropped to its text (Rex has no letter in that call); got ${show(tagValue(big, 'description'))}`);
  assert(!X.strings(big).some((s) => s.startsWith('lmdb:') || s.includes('tapestry:')), `no pointer and no tapestry: is left in the letter; got ${show(big.tags)}`);
  assert(tagValue(big, 'summary') === undefined, `the summary, a pointer the store doesn't hold, is left out; got ${show(big.tags)}`);
  const unresolved = X.reportsOf(X.data(m.r, 'big'), 'pointer-unresolved');
  assert(unresolved.some((r) => X.mentions(r, k.dogBig) || X.mentions(r, w.addr.dogBig)), `pointer-unresolved names the node; got ${show(unresolved)}`);
  const d = X.data(m.r, 'gone');
  const gone = X.letterFor(d, k.dogGone);
  assert(gone && gone.outcome === 'unbuildable', `gone, whose json points at nothing, is unbuildable; got ${show(gone)}`);
  assert(!m.store.some((e) => X.addressOf(e) === w.addr.dogGone), 'its letter isn\'t built or sent');
  assert(X.reportsOf(d).some((r) => X.mentions(r, k.dogGone) || X.mentions(r, w.addr.dogGone)), `and it is reported; got ${show(d.reports)}`);
});

test('EK6 [Decision 9]: a graph that lists an address or an id no node holds reports not-found, and its other nodes are still sent', async () => {
  const m = await main();
  const { w, k } = m;
  const d = X.data(m.r, 'missing');
  const nf = X.reportsOf(d, 'not-found');
  for (const ref of [`39999:${X.TA}:nobody-here`, 'ee'.repeat(32)]) assert(nf.some((r) => X.mentions(r, ref)), `not-found names ${ref}; got ${show(nf)}`);
  assert(['new', 'unchanged', 'changed'].includes((X.letterFor(d, k.rex) || {}).outcome) && (X.relayOf(X.letterFor(d, k.missing), 'own') || {}).status === 'accepted', `the graph and Rex are still answered and sent; got ${show(X.lettersOf(d).map((l) => [X.keyOf(l), l.outcome]))}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
