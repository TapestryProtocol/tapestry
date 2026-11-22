'use strict';
/**
 * export nostr sends a concept as the sharing operations left it — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/48-declare-a-concept-shared.md (AC4)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0048-declare-shared-wire-to-shared-defer-sharing.md
 *          (Decision 9: export doesn't change, and its suites pin AC4)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/48-declare-a-concept-shared.test-plan.md
 *
 * Stack-free: the real catalog over test/helpers/exportFixtures.js's world on the Cypher engine, the fake relays and
 * strfry import, and the assistant's key, as export nostr's own suites run. Every b these cases send is written by the
 * new operations, never by hand:
 *   1. graph declare-shared on pet (made by the graph operations, no letter), graph wire-to-shared from pet to alice's
 *      cat, graph defer-sharing on animal (the same), and graph wire-to-shared from bird (today's lettered header, with
 *      three b tags already) to OTTER, an address no node holds;
 *   2. export nostr: a dry run of pet's concept graph, then pet's concept graph, animal's header and bird's header;
 *   3. graph wire-to-shared from pet to five more addresses no node holds (six in all, past export's cap of five);
 *   4. export nostr again over the same relay: a dry run of pet's header, then pet's concept graph.
 *
 *   EB1 pet's header letter carries ["b", "39998:<TA>:pet", "pointer"] and ["b", <cat>, "pointer"], each once, its b
 *       tags the node's own, signed by the assistant and read back from the own relay; neither the self-loop nor its
 *       REFERENCES to cat is reported uncarried
 *   EB2 a dry run lists pet's header new before it was ever sent, and, once sent and wired again, changed, its added
 *       tags the five new b's and its removed tags no b
 *   EB3 each of pet's elements' letters carries a z for cat, the concept pet is wired to, and pet's own z once: the
 *       self-pointing b stamps nothing
 *   EB4 wired to six, each element's letter carries five of the six stamps, each once: export's cap
 *   EB5 the marker travels with its header like any tag: animal's first letter, from this export, carries
 *       ["b", "b-tag-deferred"]
 *   EB6 bird, wired to OTTER through wire-to-shared, sends its cat, fish and lizard b's beside the new one, each as the
 *       node holds it
 */

const path = require('path');
const S = require('../../helpers/graphOpsSuite');
const X = require('../../helpers/exportFixtures');
const H = require('../../helpers/sharingGraph');
const CG = require('../../helpers/cypherGraphFake');

const { assert } = S;
const show = (x) => String(S.show(x));
const { test, run } = S.makeSuite('operations: export nostr sends a concept as the sharing operations left it');
const { exp, NT } = X;

const OTTER = `39998:${'cd'.repeat(32)}:otter`;
const MORE = ['a1', 'b2', 'c3', 'd4', 'e5'].map((h) => `39998:${h.repeat(32)}:shared-${h}`);
const bOf = (e) => (e.tags || []).filter((t) => t[0] === 'b');
const zOf = (e) => (e.tags || []).filter((t) => t[0] === 'z').map((t) => t[1]);
const sameSet = (a, b) => show([...a].sort()) === show([...b].sort());

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    X.needDecl();
    H.needDecls();
    const w = await X.world();
    const k = w.keys;
    const base = { ownEvents: w.ownEvents, lmdb: w.lmdb };
    const file = path.join(S.tmp('export-shared-'), 'graph.json');
    CG.writeState(file, X.copy(w.state));
    const o1 = X.runOps(file, [
      X.op('pet-declared', 'declare-shared', { concept: k.petHeader }),
      X.op('pet-cat', 'wire-to-shared', { concept: k.petHeader, target: w.addr.catHeader }),
      X.op('animal-deferred', 'defer-sharing', { concept: k.animalHeader }),
      X.op('bird-otter', 'wire-to-shared', { concept: k.birdHeader, target: OTTER }),
    ]);
    const want1 = { 'pet-declared': 'declared', 'pet-cat': 'wired', 'animal-deferred': 'deferred', 'bird-otter': 'wired' };
    for (const [id, outcome] of Object.entries(want1)) {
      const d = X.data(o1, id);
      assert(d.outcome === outcome, `the sharing operation ${id} answers ${outcome} before export runs; got ${show(d).slice(0, 400)}`);
    }
    const afterOps = CG.readState(file);
    const r1 = X.runExport({ ...base, file, label: 'export-shared', requests: [
      exp('dry', 'owner', { graph: k.petConceptGraph, dryRun: true }),
      exp('pet', 'owner', { graph: k.petConceptGraph }),
      exp('animal', 'owner', { node: k.animalHeader }),
      exp('bird', 'owner', { node: k.birdHeader }),
    ] });
    const store1 = r1.store();
    const o2 = X.runOps(file, MORE.map((t, i) => X.op(`more-${i}`, 'wire-to-shared', { concept: k.petHeader, target: t })));
    MORE.forEach((t, i) => assert(X.data(o2, `more-${i}`).outcome === 'wired', `pet is wired to ${t}`));
    const afterMore = CG.readState(file);
    const r2 = X.runExport({ ...base, file, fixture: r1.fixture, requests: [
      exp('dry2', 'owner', { node: k.petHeader, dryRun: true }),
      exp('pet2', 'owner', { graph: k.petConceptGraph }),
    ] });
    const store2 = r2.store();
    return { w, k, afterOps, afterMore, r1, store1, r2, store2 };
  })();
  return MAIN;
}
/** The letter a call sent for a node, from a store read when that call's run ended. */
function sent(r, store, id, key) {
  const l = X.letterFor(X.data(r, id), key);
  const e = l && store.find((x) => x.id === l.id);
  assert(e, `${id}: the export sent a letter for ${key} that the own relay holds; got ${show(l)}`);
  return e;
}

test('EB1 [AC4, Decision 9]: pet\'s header letter carries its self-pointing b and its b naming cat, each once and as the node holds them, signed by the assistant', async () => {
  const { w, k, afterOps, r1, store1 } = await main();
  const self = `39998:${X.TA}:pet`;
  assert(X.nodeByKey(afterOps, k.petHeader).props.uuid === self, `pet's header is at ${self}`);
  const e = sent(r1, store1, 'pet', k.petHeader);
  assert(e.pubkey === X.TA && NT.verifyEvent(X.copy(e)) && X.addressOf(e) === self, `signed by the assistant, at pet's address; got ${show({ pubkey: e.pubkey, address: X.addressOf(e) })}`);
  const want = [['b', self, 'pointer'], ['b', w.addr.catHeader, 'pointer']];
  assert(X.sameTags(bOf(e), want), `the letter carries ["b", "${self}", "pointer"] and ["b", cat, "pointer"], each once; got ${show(bOf(e))}`);
  const held = X.tagArrays(afterOps, X.nodeByKey(afterOps, k.petHeader)).filter((t) => t[0] === 'b');
  assert(X.sameTags(bOf(e), held), `its b tags are the node's own, as the operations wrote them; letter ${show(bOf(e))}, node ${show(held)}`);
  const uncarried = X.reportsOf(X.data(r1, 'pet'), 'uncarried-relationship').filter((x) => X.mentions(x, 'REFERENCES') && (X.mentions(x, k.petHeader) || X.mentions(x, self)));
  assert(uncarried.length === 0, `the self-loop and the REFERENCES to cat, which its b tags carry, aren't reported uncarried; got ${show(uncarried)}`);
});

test('EB2 [AC4]: a dry run lists pet\'s header new before it was ever sent, then changed once it was sent and wired again, its added tags the new b\'s', async () => {
  const { k, r1, r2 } = await main();
  const first = X.letterFor(X.data(r1, 'dry'), k.petHeader);
  assert(first && first.outcome === 'new', `before any letter, the dry run lists pet's header new; got ${show(first)}`);
  const second = X.letterFor(X.data(r2, 'dry2'), k.petHeader);
  assert(second && second.outcome === 'changed', `after the export sent it and pet was wired to five more, the dry run lists it changed; got ${show(second)}`);
  const added = (Array.isArray(second.added) ? second.added : []).filter((t) => Array.isArray(t) && t[0] === 'b').map((t) => t[1]);
  const removed = (Array.isArray(second.removed) ? second.removed : []).filter((t) => Array.isArray(t) && t[0] === 'b');
  assert(sameSet(added, MORE) && removed.length === 0, `its added tags are the five new b's, and it removes no b; got added ${show(second.added)} removed ${show(second.removed)}`);
});

test('EB3 [AC4, fact 4]: each of pet\'s elements carries a z for cat, the concept pet is wired to, and its own z for pet once', async () => {
  const { w, k, r1, store1 } = await main();
  const self = `39998:${X.TA}:pet`;
  for (const [name, key] of [['Rex', k.rex], ['Tom', k.tom], ['Fido', k.fido], ['Spot', k.spot], ['Linker', k.linker]]) {
    const e = sent(r1, store1, 'pet', key);
    const z = zOf(e);
    assert(z.filter((x) => x === w.addr.catHeader).length === 1, `${name}'s letter is stamped for cat, once; got ${show(z)}`);
    assert(z.filter((x) => x === self).length === 1, `${name}'s letter names pet once: the self-pointing b adds no stamp; got ${show(z)}`);
  }
});

test('EB4 [AC4, fact 4]: wired to six, each element\'s letter carries five of the six stamps, each once: export\'s cap', async () => {
  const { w, k, afterMore, r2, store2 } = await main();
  const six = [w.addr.catHeader, ...MORE];
  const held = X.tagArrays(afterMore, X.nodeByKey(afterMore, k.petHeader)).filter((t) => t[0] === 'b' && six.includes(t[1]));
  assert(held.length === 6, `pet's header holds the six pointer b's the operations wrote; got ${show(held)}`);
  for (const [name, key] of [['Rex', k.rex], ['Tom', k.tom], ['Fido', k.fido], ['Spot', k.spot], ['Linker', k.linker]]) {
    const e = sent(r2, store2, 'pet2', key);
    const stamps = zOf(e).filter((x) => six.includes(x));
    assert(stamps.length === 5 && new Set(stamps).size === 5, `${name}'s letter carries five of the six, each once (STAMP_CAP); got ${show(zOf(e))}`);
  }
});

test('EB5 [AC4]: the marker travels with its header like any tag: animal\'s first letter, sent by this export, carries ["b", "b-tag-deferred"]', async () => {
  const { k, r1, store1 } = await main();
  const l = X.letterFor(X.data(r1, 'animal'), k.animalHeader);
  assert(l && l.outcome === 'new', `animal had no letter: deferring it sent none; got ${show(l)}`);
  const e = sent(r1, store1, 'animal', k.animalHeader);
  assert(X.sameTags(bOf(e), [['b', H.MARKER]]), `the letter carries the marker, as the node holds it; got ${show(bOf(e))}`);
});

test('EB6 [AC4, AC2]: bird, wired to OTTER through wire-to-shared, sends the b\'s it held beside the new one, each as the node holds it', async () => {
  const { w, k, afterOps, r1, store1 } = await main();
  const e = sent(r1, store1, 'bird', k.birdHeader);
  const want = [['b', w.addr.catHeader, 'pointer'], ['b', w.addr.fishHeader], ['b', w.addr.lizardHeader, 'inherit'], ['b', OTTER, 'pointer']];
  assert(X.sameTags(bOf(e), want), `bird's letter carries its three b's and the new one; got ${show(bOf(e))}`);
  const held = X.tagArrays(afterOps, X.nodeByKey(afterOps, k.birdHeader)).filter((t) => t[0] === 'b');
  assert(X.sameTags(bOf(e), held), `each as the node holds it; letter ${show(bOf(e))}, node ${show(held)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
