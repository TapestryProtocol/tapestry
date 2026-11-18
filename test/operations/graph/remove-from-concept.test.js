'use strict';
/**
 * graph remove-from-concept — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.md (AC5's
 *          removals, AC6, AC7, AC8's remove refusals, AC9's marks, access and command, over the fake)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0022-add-to-concept-and-remove-from-concept.md
 *          (Decisions 1–6, 10–15, 17; Amendment 1)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.test-plan.md
 *
 * Stack-free: the real catalog, over test/helpers/membershipGraph.js's seed for test/helpers/graphFake.js, with the spy
 * on. MAIN takes memberships out and repeats them; AFTER reads its graph back; REF holds every refusal, so its graph
 * must end as it began; the locks, the re-check (another write taking the node's other concept away while the call
 * runs: graphFake's failures.shrinkBeforeDetach, fired by the first DETACH DELETE, the tag delete of Decision 15 step 3),
 * a keyless instance, an entry that can't be recorded and a node deleted meanwhile each have a run of their own.
 *
 *   RM1  the owner takes Two Home out of pet: the link, pet's section and key, its z naming pet go; the rest stays
 *   RM2  the change entry: membership-removed, section-removed keeping the section whole, tag-removed, wordTypes;
 *        history finds it by the node and the concept; list-elements no longer lists the node
 *   RM3  the same call again is already-removed; add-to-concept with the section's fields undoes a removal
 *   RM4  a concept or a set that doesn't reach the node: already-removed
 *   RM5  out of a set: the node stays in the concept through its superset; its n tag goes; letters names its own letter
 *        and the relationship event of the instance's own naming the pair
 *   RM6  a concept this one is a kind of leaves with it: Goldie out of golden retriever leaves dog too
 *   RM7  with set: Bella out of walkers, through dog, leaves dog and pet, which reached it only through walkers
 *   RM8  word is never a reason to refuse, and its block stays: Wordy out of beagle leaves word too
 *   RM9  the owner's claim beside another author's letter is taken out: tapestryOwnSections goes, their letter stays
 *   RM10 one of two of the owner's sections goes; the author's own section for the concept stays in their letter
 *   RM11 the owner's claim on firmware's own element is taken out; firmware's own membership stays
 *   RM12 two removals of a node's last two concepts, one after the other: the second is refused last-concept
 *   RM13 the marks: the copies of the concept left go in the same write, recorded
 *   RM14 a JSON held in the store is written back inline without the section
 *   RM15 nothing is signed; an admin's removal is the admin's; the command removes too, as the command's
 *   RM16 it is listed with its guard, repeatKey, inputs and every refusal, and has its /docs entry
 *   RM17 each removal locks the node, then the concept's header, before it deletes; a repeat writes only its locks
 *   RM18 the re-check: another write took the node's other concept away while the call ran: rolled back, last-concept
 *   RM30–RM44 the refusals (REF and their own runs)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const C = require('../../helpers/conceptGraph');
const M = require('../../helpers/membershipGraph');

const { ROOT, OWNER, ADMIN, assert, show, tmp } = S;
const { OTHER } = M;
const { test, run } = S.makeSuite('operations: graph remove-from-concept');

const ROUTE = '/api/tapestry/graph/remove-from-concept';
const ADD = '/api/tapestry/graph/add-to-concept';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/remove-from-concept.js');
const RULE = 'node-has-a-concept';
const HAS_ELEMENT = 'HAS_ELEMENT';
const NOBODY = '00000000-0000-4000-8000-0000000000c3';
const NOSET = '00000000-0000-4000-8000-0000000000d3';

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/remove-from-concept.js does not exist yet (ADR graph-operations-first-slice/0022 Decision 1)');
}
const post = (id, caller, body, extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body, ...extra });
const rm = (id, node, concept, extra = {}, caller = 'owner') => post(id, caller, { node, concept, ...extra });
const get = (id, url) => ({ id, method: 'GET', url, caller: 'owner' });

/** One harness run over a state file; { r, a }. */
function runOn(file, requests, { cli = [], spy = false, env = null } = {}) {
  const dir = path.dirname(file);
  const r = S.runHarness({ spy, scenarios: [{ graphFake: { stateFile: file }, requests, cli }] }, { dir, env: env ? env(dir) : null });
  return { r, a: S.answered(r) };
}
/** A fresh seed in a directory of its own; { file, dir, k, u, seed }. `mutate(state, keys)` changes it first. */
async function fresh(mutate = null, { store = false } = {}) {
  const seed = await M.seedMemberships();
  if (mutate) mutate(seed.state, seed.keys);
  const file = seed.file(tmp('remove-from-concept-'));
  const dir = path.dirname(file);
  if (store) seed.storeEntries(dir);
  return { file, dir, k: seed.keys, u: seed.uuids, seed };
}

// ── reading a state ──
const nodeByKey = (g, key) => g.nodes.find((n) => n.props.tapestryKey === key) || null;
const entriesIn = (g) => g.nodes.filter((n) => n.labels.includes('GraphChange'));
const sortKeys = (o) => Object.fromEntries(Object.keys(o || {}).sort().map((k) => [k, o[k]]));
const same = (a, b) => show(sortKeys(a)) === show(sortKeys(b));
const into = (g, key) => C.into(g, key, HAS_ELEMENT).sort();
const jsonTags = (g, key) => C.tags(g, key).filter((t) => t.type === 'json');
const ownSections = (g, key) => { const n = nodeByKey(g, key); const v = n && n.props.tapestryOwnSections; return typeof v === 'string' ? JSON.parse(v) : v; };
const propsBut = (n, ...names) => Object.fromEntries(Object.entries(n.props).filter(([k]) => !names.includes(k)));
const changeOf = (d, name) => ((d && d.change && d.change.changes) || []).filter((c) => c.change === name);
const keysOf = (list) => (Array.isArray(list) ? list.map((c) => c && c.concept) : ['(not a list)']).sort();
const propsOf = (copies) => (Array.isArray(copies) ? copies.map((c) => (typeof c === 'string' ? c : c && c.property)) : copies && typeof copies === 'object' ? Object.keys(copies) : ['(not a list or an object)']).sort();
const err = (body) => String(body && body.error);
const nowNone = (c) => !('now' in c) || c.now === null;
const uuidOf = (g, key) => C.node(g, key).props.uuid;
/** Whether an answer's links are these relationships, each { type, from, to } (N.RELATIONSHIP), whatever their keys' order. */
const linksAre = (d, want) => Array.isArray(d.links) && show(d.links.map(sortKeys)) === show(want.map(sortKeys));

function transactions(log, from = 0) {
  const out = [];
  let cur = null;
  for (const l of log.slice(from)) {
    if (l.call === 'begin') cur = { steps: [] };
    else if (l.call === 'commit' || l.call === 'rollback') { if (cur) out.push({ end: l.call, error: l.error || null, steps: cur.steps }); cur = null; } else if (cur) cur.steps.push(l);
  }
  return out;
}

// ── MAIN: takes memberships out and repeats them ──
let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    const { file, k, u, seed } = await fresh(null, { store: true });
    const before = S.readState(file);
    const { a } = runOn(file, [
      rm('two-home', k.twoHome, k.pet),
      rm('two-home-again', k.twoHome, k.pet),
      rm('round', k.roundTrip, k.pet),
      { id: 'undo', method: 'POST', url: ADD, caller: 'owner', body: { node: k.roundTrip, concept: k.pet, fields: { description: 'Round Trip, a pet' } } },
      rm('not-there', k.lucky, k.pet),
      rm('not-in-set', k.rover, k.beagle, { set: k.showBeagles }),
      rm('set', k.setItem, k.beagle, { set: k.showBeagles }),
      rm('kind-of', k.goldie, k.goldenRetriever),
      rm('shared-set', k.walkerBella, k.dog, { set: k.walkers }),
      rm('word', k.wordy, k.beagle),
      rm('peer', k.peerItem, k.pet),
      rm('peer-two', k.peerTwoOwn, k.pet),
      rm('firmware-own', k.fwNumber, k.pet),
      rm('pair-1', k.pair, k.beagle),
      rm('pair-2', k.pair, k.pet),
      rm('marks', k.gadgetPet, k.gadget),
      rm('stored', k.storedPair, k.pet),
      rm('admin', k.adminPair, k.pet, {}, 'admin'),
      { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
    ], {
      spy: true,
      cli: [{ id: 'cli', argv: ['graph', 'remove-from-concept', '--node', k.cliPair, '--concept', k.pet] }],
    });
    return { a, k, u, file, before, seed };
  })();
  return MAIN;
}
const graph = async () => S.readState((await main()).file);
async function ok(id) {
  needDecl();
  const x = (await main()).a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body).slice(0, 600)}`);
  return x.body.data;
}

test('RM1 [AC6]: the owner takes Two Home out of pet: the link, pet\'s section and key, and its z naming pet go; the rest stays', async () => {
  const d = await ok('two-home');
  const { k, u, before } = await main();
  assert(d.outcome === 'removed' && d.concept === k.pet && d.kept === 'json-tag', `removed, from pet, its sections kept in its json tag; got ${show(d).slice(0, 400)}`);
  assert(d.node && d.node.tapestryKey === k.twoHome && d.node.address === u.twoHome && d.node.name === 'Two Home', `the answer's node is its key, address and name; got ${show(d.node)}`);
  assert(linksAre(d, [{ type: HAS_ELEMENT, from: k.petSuperset, to: k.twoHome }]), `links: the relationship taken out (Decision 13); got ${show(d.links)}`);
  assert(show(keysOf(d.left)) === show([k.pet]) && d.left[0].key === 'pet', `left: pet, with its key; got ${show(d.left)}`);
  assert(show(keysOf(d.concepts)) === show([k.beagle]) && d.concepts[0].key === 'beagle', `still an element of beagle; got ${show(d.concepts)}`);
  assert(show(d.letters) === show([]) && d.letterOutOfDate === false && d.cacheOutOfDate === false && show(propsOf(d.copies)) === show([]), `no letter, no cache, no copies; got ${show({ letters: d.letters, l: d.letterOutOfDate, c: d.cacheOutOfDate, copies: d.copies })}`);
  const g = await graph();
  assert(show(into(g, k.twoHome)) === show([k.beagleSuperset]), `pet's superset no longer reaches it; beagle's still does; got ${show(into(g, k.twoHome))}`);
  const was = C.json(before, k.twoHome);
  const j = C.json(g, k.twoHome);
  assert(!('pet' in j) && show(j.beagle) === show(was.beagle), `pet's section leaves its JSON, beagle's stays (the owner's answer, question 2); got ${show(j)}`);
  assert(show(j.word.wordTypes) === show(['word', 'beagle']) && show({ ...j.word, wordTypes: null }) === show({ ...was.word, wordTypes: null }), `pet's key leaves wordTypes, and the word block is otherwise as it was; got ${show(j.word)}`);
  const petUuid = uuidOf(before, k.pet);
  const tagsNow = C.tagArrays(g, k.twoHome).filter((t) => t[0] !== 'json');
  const want = C.tagArrays(before, k.twoHome).filter((t) => t[0] !== 'json' && !(t[0] === 'z' && t[1] === petUuid));
  assert(show(tagsNow) === show(want), `its z naming pet goes, so a reinstall's pass 1d doesn't link it again (AC9); the others stay; got ${show(tagsNow)}`);
  assert(jsonTags(g, k.twoHome).length === 1 && jsonTags(g, k.twoHome)[0].key === jsonTags(before, k.twoHome)[0].key, 'its json tag is rewritten in place');
});

test('RM2 [AC6, Decision 14]: the change entry keeps the section whole; history finds it by the node and the concept; list-elements no longer lists it', async () => {
  const d = await ok('two-home');
  const { file, k, before } = await main();
  assert(d.change && d.change.operation === 'graph remove-from-concept' && show(d.change.by) === show({ role: 'owner', pubkey: OWNER }), `the owner's entry, through graph remove-from-concept; got ${show(d.change).slice(0, 300)}`);
  const m = changeOf(d, 'membership-removed');
  assert(m.length === 1 && m[0].type === HAS_ELEMENT && m[0].from === k.petSuperset && m[0].to === k.twoHome && m[0].node === k.twoHome && m[0].concept === k.pet, `one membership-removed for the link; got ${show(m)}`);
  const sec = changeOf(d, 'section-removed');
  assert(sec.length === 1 && sec[0].node === k.twoHome && sec[0].concept === k.pet && sec[0].field === 'pet' && show(sec[0].was) === show(C.json(before, k.twoHome).pet) && nowNone(sec[0]),
    `section-removed keeps the section whole in was, so add-to-concept with its fields undoes the removal (question 2); got ${show(sec)}`);
  const t = changeOf(d, 'tag-removed');
  assert(t.length === 1 && t[0].node === k.twoHome && t[0].field === 'z' && t[0].was === uuidOf(before, k.pet), `tag-removed: the z naming pet; got ${show(t)}`);
  const w = changeOf(d, 'field-changed').filter((c) => c.field === 'word.wordTypes');
  assert(w.length === 1 && show(w[0].was) === show(['word', 'beagle', 'pet']) && show(w[0].now) === show(['word', 'beagle']), `wordTypes: was and now; got ${show(changeOf(d, 'field-changed'))}`);
  const { a } = runOn(file, [
    get('h-node', `/api/tapestry/graph/history?node=${k.twoHome}&limit=5`),
    get('h-concept', `/api/tapestry/graph/history?node=${k.pet}&limit=200`),
    get('le', `/api/tapestry/graph/list-elements?concept=${k.pet}&limit=200`),
  ]);
  for (const id of ['h-node', 'h-concept']) {
    const x = a.req(id);
    const ids = x.status === 200 ? x.body.data.entries.map((e) => e.id) : null;
    assert(ids && ids.includes(d.change.id), `${id}: graph history finds the entry; got ${x.status} ${show(x.body).slice(0, 300)}`);
  }
  const le = a.req('le');
  const listed = le.status === 200 ? le.body.data.elements.map((e) => e.tapestryKey) : null;
  assert(listed && !listed.includes(k.twoHome) && listed.includes(k.whiskers), `list-elements no longer lists Two Home among pet's elements; got ${le.status} ${show(le.body).slice(0, 300)}`);
});

test('RM3 [AC6]: the same call again is already-removed, recording nothing; add-to-concept with the section\'s fields undoes a removal', async () => {
  const again = await ok('two-home-again');
  const { k, before } = await main();
  assert(again.outcome === 'already-removed' && again.change === null, `already-removed, and no entry (AC6); got ${show(again).slice(0, 300)}`);
  const g = await graph();
  const mine = entriesIn(g).filter((e) => e.props.operation === 'graph remove-from-concept' && (e.props.keys || []).includes(k.twoHome));
  assert(mine.length === 1, `one entry for Two Home's removal; got ${mine.length}`);
  const r = await ok('round');
  const was = changeOf(r, 'section-removed')[0];
  assert(r.outcome === 'removed' && was && show(was.was) === show(C.json(before, k.roundTrip).pet), `Round Trip leaves pet, its entry keeping the section; got ${show(r).slice(0, 300)}`);
  needDecl();
  const undo = (await main()).a.req('undo');
  assert(undo.status === 200 && undo.body.data.outcome === 'added', `add-to-concept puts it back; got ${undo.status} ${show(undo.body).slice(0, 300)}`);
  assert(show(C.json(g, k.roundTrip).pet) === show(was.was) && show(into(g, k.roundTrip)) === show([k.beagleSuperset, k.petSuperset].sort()), `its pet section is as it was, and it is in pet again; got ${show(C.json(g, k.roundTrip))}`);
});

test('RM4 [AC6]: a concept, or a set, that doesn\'t reach the node: already-removed, and nothing changes', async () => {
  const { k, before } = await main();
  for (const [id, node] of [['not-there', k.lucky], ['not-in-set', k.rover]]) {
    const d = await ok(id);
    assert(d.outcome === 'already-removed' && d.change === null, `${id}: already-removed, and no entry; got ${show(d).slice(0, 300)}`);
    const g = await graph();
    assert(show(into(g, node)) === show(into(before, node)) && show(C.tagArrays(g, node)) === show(C.tagArrays(before, node)), `${id}: the node is as it was`);
  }
});

test('RM5 [AC6, Decision 13]: out of a set: the node stays in the concept through its superset; its n tag goes; letters names its letter and the relationship event', async () => {
  const d = await ok('set');
  const { k, before } = await main();
  const g = await graph();
  assert(d.outcome === 'removed' && d.set === k.showBeagles && linksAre(d, [{ type: HAS_ELEMENT, from: k.showBeagles, to: k.setItem }]), `removed: the link from show beagles; got ${show(d).slice(0, 300)}`);
  assert(show(d.left) === show([]) && show(keysOf(d.concepts)) === show([k.beagle]), `it leaves no concept: beagle still reaches it through its superset (AC6); got ${show({ left: d.left, concepts: d.concepts })}`);
  assert(show(into(g, k.setItem)) === show([k.beagleSuperset]), `only show beagles' link is gone; got ${show(into(g, k.setItem))}`);
  assert(show(C.json(g, k.setItem)) === show(C.json(before, k.setItem)), 'its JSON is as it was: no concept left, so no section goes');
  const showUuid = uuidOf(before, k.showBeagles);
  assert(!C.tagArrays(g, k.setItem).some((t) => t[0] === 'n') && C.tagArrays(g, k.setItem).some((t) => t[0] === 'z'), `its n naming show beagles goes, its z stays (Decision 15); got ${show(C.tagArrays(g, k.setItem))}`);
  const t = changeOf(d, 'tag-removed');
  assert(t.length === 1 && t[0].field === 'n' && t[0].was === showUuid, `tag-removed: the n; got ${show(t)}`);
  const letters = Array.isArray(d.letters) ? d.letters : [];
  const at = letters.map((l) => l && l.address).sort();
  assert(show(at) === show([uuidOf(before, k.setItem), uuidOf(before, k.relEvent)].sort()) && letters.every((l) => typeof l.says === 'string' && l.says.trim()),
    `letters: its own letter, which still has the n, and the instance's own relationship event naming the pair, each saying what it still says (Decision 13); got ${show(d.letters)}`);
  assert(d.letterOutOfDate === true, `its letter is now out of date; got ${show(d.letterOutOfDate)}`);
  assert(C.node(g, k.relEvent), 'the relationship event stays, reported (follow-up 7)');
});

test('RM6 [AC6, open question 1]: a concept this one is a kind of leaves with it: Goldie out of golden retriever leaves dog too, and stays in pet', async () => {
  const d = await ok('kind-of');
  const { k, before } = await main();
  const g = await graph();
  assert(d.outcome === 'removed' && show(keysOf(d.left)) === show([k.dog, k.goldenRetriever].sort()) && show(keysOf(d.concepts)) === show([k.pet]), `left golden retriever and dog, which reached it only through golden retriever; still pet; got ${show({ left: d.left, concepts: d.concepts })}`);
  const j = C.json(g, k.goldie);
  assert(!('dog' in j) && !('goldenRetriever' in j) && show(j.pet) === show(C.json(before, k.goldie).pet) && show(j.word.wordTypes) === show(['word', 'pet']), `both sections and keys go; pet's stays; got ${show(j)}`);
  assert(changeOf(d, 'section-removed').map((c) => c.field).sort().join(',') === 'dog,goldenRetriever', `a section-removed for each; got ${show(changeOf(d, 'section-removed'))}`);
  const grUuid = uuidOf(before, k.goldenRetriever);
  assert(!C.tagArrays(g, k.goldie).some((t) => t[0] === 'z' && t[1] === grUuid) && C.tagArrays(g, k.goldie).some((t) => t[0] === 'z' && t[1] === uuidOf(before, k.pet)), 'its z naming golden retriever goes; its z naming pet stays');
});

test('RM7 [AC6, open question 1]: with set: Bella out of walkers, through dog, leaves dog and pet, which reached it only through walkers', async () => {
  const d = await ok('shared-set');
  const { k, before } = await main();
  const g = await graph();
  assert(d.outcome === 'removed' && show(keysOf(d.left)) === show([k.dog, k.pet].sort()) && show(keysOf(d.concepts)) === show([k.beagle]), `the named set's concepts both leave: each reaches the set (M2); got ${show({ left: d.left, concepts: d.concepts })}`);
  assert(show(into(g, k.walkerBella)) === show([k.beagleSuperset]), `walkers' link is gone; got ${show(into(g, k.walkerBella))}`);
  const j = C.json(g, k.walkerBella);
  assert(!('dog' in j) && show(j.beagle) === show(C.json(before, k.walkerBella).beagle) && show(j.word.wordTypes) === show(['word', 'beagle']), `dog's section goes, and dog's and pet's keys; got ${show(j)}`);
  const kinds = C.tagArrays(g, k.walkerBella).map((t) => `${t[0]}:${t[1]}`);
  assert(!kinds.includes(`z:${uuidOf(before, k.dog)}`) && !kinds.includes(`n:${uuidOf(before, k.walkers)}`) && kinds.includes(`z:${uuidOf(before, k.beagle)}`), `its z naming dog and n naming walkers go; its z naming beagle stays; got ${show(kinds)}`);
});

test('RM8 [AC6, open question 1]: word is never a reason to refuse, and its block stays: Wordy out of beagle leaves word too', async () => {
  const d = await ok('word');
  const { k, before } = await main();
  const g = await graph();
  assert(d.outcome === 'removed' && keysOf(d.left).includes(k.beagle) && keysOf(d.left).includes(k.word) && show(keysOf(d.concepts)) === show([k.pet]), `left beagle, and word, which reached it only through the set the two share: listed, never refused (open question 1); got ${show({ left: d.left, concepts: d.concepts })}`);
  const j = C.json(g, k.wordy);
  const was = C.json(before, k.wordy);
  assert(j.word && j.word.slug === was.word.slug && j.word.name === was.word.name && show(j.word.wordTypes) === show(['word', 'pet']), `the word block stays, word first in wordTypes: every element is a word through it (fact 7); got ${show(j.word)}`);
  assert(!('beagle' in j) && show(j.pet) === show(was.pet), `beagle's section goes; got ${show(j)}`);
  assert(!changeOf(d, 'section-removed').some((c) => c.field === 'word') && changeOf(d, 'section-removed').length === 1, `no section-removed for word's block; got ${show(changeOf(d, 'section-removed'))}`);
});

test('RM9 [AC5, Decisions 2 and 15]: the owner\'s claim beside another author\'s letter is taken out: tapestryOwnSections goes, their letter stays', async () => {
  const d = await ok('peer');
  const { k, before } = await main();
  const g = await graph();
  assert(d.outcome === 'removed' && d.kept === 'beside' && show(d.letters) === show([]) && d.letterOutOfDate === false, `removed, from beside their letter, which isn't the instance's; got ${show(d).slice(0, 300)}`);
  const n = nodeByKey(g, k.peerItem);
  assert(!('tapestryOwnSections' in n.props), `its last section beside gone, the property is removed (Decision 6); got ${show(n.props)}`);
  assert(same(n.props, propsBut(nodeByKey(before, k.peerItem), 'tapestryOwnSections')), 'its event\'s properties are otherwise as they were');
  assert(show(C.tagArrays(g, k.peerItem)) === show(C.tagArrays(before, k.peerItem)), `their letter, its tags and json tag, is exactly as it was; got ${show(C.tagArrays(g, k.peerItem))}`);
  assert(show(into(g, k.peerItem)) === show([k.beagleSuperset]), 'it stays in beagle, by their claim');
  const sec = changeOf(d, 'section-removed');
  assert(sec.length === 1 && sec[0].field === 'pet' && show(sec[0].was) === show(ownSections(before, k.peerItem).pet), `the owner's section, kept whole in the entry; got ${show(sec)}`);
  assert(changeOf(d, 'tag-removed').length === 0, 'and no tag of theirs is taken out');
});

test('RM10 [AC5, Decision 15]: one of two of the owner\'s sections beside goes; the author\'s own section for the concept stays in their letter', async () => {
  const d = await ok('peer-two');
  const { k, before } = await main();
  const g = await graph();
  assert(d.outcome === 'removed' && d.kept === 'beside', `removed; got ${show(d).slice(0, 300)}`);
  assert(show(ownSections(g, k.peerTwoOwn)) === show({ graph: ownSections(before, k.peerTwoOwn).graph }), `graph's section stays beside; pet's goes; got ${show(nodeByKey(g, k.peerTwoOwn).props.tapestryOwnSections)}`);
  assert(show(C.tagArrays(g, k.peerTwoOwn)) === show(C.tagArrays(before, k.peerTwoOwn)) && C.json(g, k.peerTwoOwn).pet.description === "the author's own pet words", "the author's pet section stays in their letter, as their claim");
});

test('RM11 [AC5]: the owner\'s claim on firmware\'s own element is taken out; firmware\'s own membership and file stay', async () => {
  const d = await ok('firmware-own');
  const { k, before } = await main();
  const g = await graph();
  assert(d.outcome === 'removed' && d.kept === 'beside' && show(keysOf(d.left)) === show([k.pet]) && show(keysOf(d.concepts)) === show([k.jsonDataType]), `removed from pet; still json-data-type's; got ${show(d).slice(0, 300)}`);
  assert(!('tapestryOwnSections' in nodeByKey(g, k.fwNumber).props) && show(C.tagArrays(g, k.fwNumber)) === show(C.tagArrays(before, k.fwNumber)), "its section beside goes; its file's tags and JSON stay");
  assert(show(into(g, k.fwNumber)) === show([k.jsonDataTypeSuperset]), 'firmware\'s membership stays');
});

test('RM12 [AC7]: two removals of a node\'s last two concepts, one after the other: the first passes, the second is refused last-concept, and nothing changes', async () => {
  const one = await ok('pair-1');
  const { a, k } = await main();
  assert(one.outcome === 'removed' && one.cacheOutOfDate === true, `the first leaves beagle; its cached copy is out of date (Decision 13); got ${show(one).slice(0, 300)}`);
  const two = a.req('pair-2');
  assert(two.status === 409 && two.body.code === 'last-concept' && two.body.rule === RULE, `the second, of its last concept, is refused last-concept by ${RULE} (AC7); got ${two.status} ${show(two.body).slice(0, 400)}`);
  assert(/pet/.test(err(two.body)) && /add-to-concept/.test(err(two.body)) && /delete-node/.test(err(two.body)), `it names the concept and the way on: add it to another concept first, or delete it (Decision 12); got ${err(two.body)}`);
  const g = await graph();
  assert(show(into(g, k.pair)) === show([k.petSuperset]) && C.json(g, k.pair).pet, 'it stays in pet, its section with it');
  assert(entriesIn(g).filter((e) => (e.props.keys || []).includes(k.pair)).length === 1, 'and one entry: the first call\'s');
});

test('RM13 [AC9]: the marks: gadget\'s copies go from a node that leaves gadget, in the same write, recorded', async () => {
  const d = await ok('marks');
  const { k } = await main();
  const n = nodeByKey(await graph(), k.gadgetPet);
  assert(d.outcome === 'removed' && !('gadget_size' in n.props) && !('gadget_color' in n.props), `gadget_size and gadget_color are taken off (AC9); got ${show(n.props)}`);
  assert(show(propsOf(d.copies)) === show(['gadget_color', 'gadget_size']), `copies: the node properties taken off (Decision 13); got ${show(d.copies)}`);
  const gone = changeOf(d, 'copies-removed');
  assert(show(gone.map((c) => c.property).sort()) === show(['gadget_color', 'gadget_size']) && gone.every((c) => show(c.nodes) === show([k.gadgetPet])), `the entry records the copies taken off (Decision 14); got ${show(gone)}`);
});

test('RM14 [Decision 15]: a JSON held in the store is written back inline, without the section', async () => {
  const d = await ok('stored');
  const { k, seed } = await main();
  const jt = jsonTags(await graph(), k.storedPair);
  assert(d.outcome === 'removed' && jt.length === 1 && !String(jt[0].value).startsWith('lmdb:'), `its json tag holds the JSON inline now; got ${show(jt.map((t) => String(t.value).slice(0, 60)))}`);
  const j = JSON.parse(jt[0].value);
  assert(!('pet' in j) && show(j.beagle) === show(seed.stored[k.storedPair].beagle) && show(j.word.wordTypes) === show(['word', 'beagle']), `the store's JSON, pet's section and key gone; got ${show(j)}`);
});

test('RM15 [AC6, AC9]: nothing is signed; an admin\'s removal is the admin\'s; the command removes too, recorded as the command\'s', async () => {
  const ad = await ok('admin');
  const { a, k } = await main();
  assert(ad.outcome === 'removed' && show(ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the admin's removal is recorded as the admin's; got ${show(ad.change && ad.change.by)}`);
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key; the spy saw ${show(a.spy)}`);
  const c = a.cmd('cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.success === true && body.data.outcome === 'removed' && show(body.data.change.by) === show({ role: 'local', pubkey: null }), `the command answers as the route does, its entry the command's; got ${show(body).slice(0, 300)}`);
  assert(show(into(await graph(), k.cliPair)) === show([k.beagleSuperset]), 'and the command\'s removal is made');
});

test('RM16 [AC9, Decisions 1 and 17]: it is listed with its guard, repeatKey, inputs and every refusal, and has its /docs entry', async () => {
  needDecl();
  const { a } = await main();
  const e = ((a.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'remove-from-concept');
  assert(e, `graph remove-from-concept is listed; problems: ${show((a.req('list').body.data || {}).problems)}`);
  assert(e.kind === 'write' && e.access === 'owner-and-admins' && show(e.guards) === show([RULE]) && show(e.repeatKey) === show(['node', 'concept', 'set']),
    `a write for the owner and admins, guard ${RULE}, repeatKey [node, concept, set]; got ${show({ kind: e.kind, access: e.access, guards: e.guards, repeatKey: e.repeatKey })}`);
  const ins = e.inputs || {};
  assert(ins.node && ins.node.required === true && ins.concept && ins.concept.required === true && ins.set && !ins.set.required && !('fields' in ins), `node and concept required, set not, and no fields; got ${show(ins)}`);
  const status = Object.fromEntries((e.refusals || []).map((x) => [x.code, x.status]));
  const want = { 'not-installed': 409, 'unknown-node': 404, 'tag-node': 409, 'made-elsewhere': 409, 'unknown-concept': 404, 'reserved-key': 409, 'no-superset': 409, 'not-a-set': 409, 'not-in-class-thread': 409, 'unreadable-json': 409, 'firmware-membership': 409, 'author-claim': 409, 'other-concept': 409, 'last-concept': 409 };
  for (const [code, st] of Object.entries(want)) assert(status[code] === st, `its refusals include ${code} (${st}), Decision 17's; got ${show(status)}`);
  for (const code of ['missing-input', 'invalid-input', 'unknown-input', 'wrong-content-type', 'sign-in-required', 'not-allowed']) assert(code in status, `its refusals include ${code}; got ${show(Object.keys(status))}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('remove-from-concept-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

// ── Decision 4: the locks ──
test('RM17 [Decision 4, AC7]: each removal locks the node, then the concept\'s header, before it deletes; a repeat writes nothing but its locks', async () => {
  needDecl();
  const { file, k } = await fresh();
  const from = S.readState(file).log.length;
  const { a } = runOn(file, [rm('first', k.twoHome, k.pet), rm('again', k.twoHome, k.pet)]);
  assert(a.req('first').status === 200 && a.req('first').body.data.outcome === 'removed' && a.req('again').body.data.outcome === 'already-removed',
    `the path under test ran: removed, then already-removed; got ${show(['first', 'again'].map((id) => a.req(id).body)).slice(0, 400)}`);
  const txns = transactions(S.readState(file).log, from);
  assert(txns.length === 2 && txns.every((t) => t.end === 'commit'), `one committed transaction for each call; got ${show(txns.map((t) => t.end))}`);
  for (const [t, id] of [[txns[0], 'first'], [txns[1], 'again']]) {
    const writes = t.steps.filter((x) => x.call === 'tx.run');
    const four = writes.slice(0, 4);
    assert(four.length === 4 && four.every((x) => x.kind === 'copies'), `${id}: its first writes are two locks, each set and removed; got ${show(four)}`);
    const keys = four.map((x) => (Array.isArray(x.keys) ? x.keys.join(',') : null));
    assert(show(keys) === show([k.twoHome, k.twoHome, k.pet, k.pet]), `${id}: the node's lock, then the concept header's (Decision 4); got ${show(keys)}`);
  }
  const firstDelete = txns[0].steps.findIndex((x) => x.call === 'tx.run' && x.kind === 'delete');
  const lastLock = txns[0].steps.map((x, i) => [x, i]).filter(([x]) => x.call === 'tx.run' && x.kind === 'copies').slice(0, 4).pop()[1];
  assert(firstDelete > lastLock, `the link is deleted after both locks; got delete at ${firstDelete}, the fourth lock statement at ${lastLock}`);
  const againWrites = txns[1].steps.filter((x) => x.call === 'tx.run');
  assert(againWrites.length === 4, `the repeat writes nothing but its locks; got ${show(againWrites)}`);
});

// ── Decision 15: the re-check ──
test('RM18 [AC7, Decision 15]: another write took the node\'s other concept away while the call ran: the removal is rolled back, refused last-concept, saying so', async () => {
  needDecl();
  // Pair is in beagle and pet. Just before the call's first DETACH DELETE (its z naming beagle, Decision 15 step 3), the
  // fake takes Pair's one other relationship that isn't a tag's, pet's superset's link, out of the transaction's graph:
  // what a second removal, of pet, committed between this one's guard and its re-check would leave.
  const { file, k } = await fresh((s, keys) => { s.failures = { shrinkBeforeDetach: keys.pair }; });
  const before = S.readState(file);
  const { a } = runOn(file, [rm('race', k.pair, k.beagle)]);
  const x = a.req('race');
  assert(x.status === 409 && x.body.code === 'last-concept' && x.body.rule === RULE, `the re-check finds the node in no concept but word: 409 last-concept, by ${RULE} (Decision 15 step 5); got ${x.status} ${show(x.body).slice(0, 400)}`);
  assert(/another write/i.test(err(x.body)) && /while/i.test(err(x.body)), `it says another write took the node's other concept away while the call ran (unlink-set's shape); got ${err(x.body)}`);
  const after = S.readState(file);
  assert(show(after.nodes) === show(before.nodes) && show(after.rels) === show(before.rels), 'and the removal is rolled back: Pair is in beagle and pet as it was');
});

// ── REF: every refusal, over a graph that must end as it began ──
let REF = null;
function ref() {
  if (REF) return REF;
  REF = (async () => {
    const { file, k } = await fresh();
    const before = S.readState(file);
    const { a } = runOn(file, [
      post('visitor', 'visitor', { node: k.twoHome, concept: k.pet }),
      post('stranger', 'stranger', { node: k.twoHome, concept: k.pet }),
      post('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ node: k.twoHome, concept: k.pet }) }),
      // the node
      rm('u-node', NOBODY, k.pet),
      rm('u-entry', k.G, k.pet),
      rm('tag', k.luckyJsonTag, k.beagle),
      rm('men-header', k.beagle, k.pet),
      rm('men-superset', k.beagleSuperset, k.pet),
      rm('men-schema', k.beagleNodes.jsonSchema, k.pet),
      rm('men-property', k.propertyNode, k.pet),
      rm('men-set', k.walkers, k.pet),
      rm('men-rule', k.ruleElement, k.pet),
      // the concept
      rm('uc-random', k.twoHome, NOBODY),
      rm('uc-element', k.twoHome, k.rover),
      rm('rk-word', k.wordOnly, k.word),
      rm('rk-other-word', k.twoHome, k.otherWord),
      rm('rk-graph-context', k.twoHome, k.graphContextConcept),
      rm('no-superset', k.twoHome, k.widgets[0]),
      // the set
      rm('un-set', k.lucky, k.beagle, { set: NOSET }),
      rm('nas-element', k.lucky, k.beagle, { set: k.rover }),
      rm('nas-header', k.lucky, k.beagle, { set: k.beagle }),
      rm('lap', k.lucky, k.dog, { set: k.lapPets }),
      rm('lap-last', k.whiskers, k.beagle, { set: k.petSuperset }),
      // JSON that can't be read
      rm('uj-double', k.doubleJson, k.pet),
      rm('uj-own', k.peerBadOwn, k.pet),
      rm('uj-peer', k.peerGarbled, k.pet),
      // whose claim it is
      rm('fw-file', k.fwNumber, k.jsonDataType),
      rm('fw-manifest', k.fwInteger, k.jsonDataType, { set: k.numericTypes }),
      rm('claim-z', k.peerItem, k.beagle),
      rm('claim-n', k.peerInSet, k.beagle, { set: k.showBeagles }),
      // another concept
      rm('other-sub', k.goldie, k.dog),
      rm('other-shared', k.walkerBella, k.dog),
      // the last concept
      rm('last', k.whiskers, k.pet),
      rm('last-firmware', k.firmwareRover, k.dog),
      rm('last-peer', k.snowy, k.beagle),
      // inputs
      post('i-missing', 'owner', {}),
      post('i-type', 'owner', { node: 5, concept: k.pet }),
      post('i-unknown', 'owner', { node: k.twoHome, concept: k.pet, fields: { description: 'x' } }),
    ], {
      spy: true,
      cli: [{ id: 'cli-refused', argv: ['graph', 'remove-from-concept', '--node', k.whiskers, '--concept', k.pet] }],
    });
    return { a, k, file, before };
  })();
  return REF;
}
async function refused(id, status, code) {
  needDecl();
  const x = (await ref()).a.req(id);
  assert(x.status === status && x.body.code === code, `${id} must be refused ${status} ${code}; got ${x.status} ${show(x.body).slice(0, 600)}`);
  return x.body;
}

test('RM30 [AC9]: a visitor gets 401, a stranger 403, a text/plain body 415; the command\'s refusal is the route\'s', async () => {
  needDecl();
  const { a } = await ref();
  const [v, s, t] = ['visitor', 'stranger', 'text'].map((id) => a.req(id));
  assert(v.status === 401 && s.status === 403 && t.status === 415, `401, 403 and 415; got ${v.status} ${s.status} ${t.status}`);
  const c = a.cmd('cli-refused');
  assert(c.code === 1, `a refused command exits 1; got ${c.code} ${c.stdout} ${c.stderr}`);
  const rb = JSON.parse(c.stdout);
  const route = a.req('last').body;
  assert(rb.code === 'last-concept' && rb.code === route.code && rb.error === route.error && rb.rule === route.rule, `the command's refusal is the route's; command ${show(rb)}, route ${show(route)}`);
});

test('RM31 [AC8, Decision 2]: a node that names no node, or a change entry, is unknown-node; a tag is tag-node', async () => {
  for (const id of ['u-node', 'u-entry']) {
    const body = await refused(id, 404, 'unknown-node');
    assert(body.input === 'node', `${id}: names the input node; got ${show(body)}`);
  }
  const t = await refused('tag', 409, 'tag-node');
  assert(t.input === 'node', `tag-node names the input; got ${show(t)}`);
});

test('RM32 [AC8, Decision 2]: a node another operation looks after is refused made-elsewhere, naming the operation', async () => {
  const want = { 'men-header': /update-concept/, 'men-superset': /update-concept/, 'men-schema': /set-schema/, 'men-property': /update-property/, 'men-set': /./, 'men-rule': /rulebook/ };
  for (const [id, op] of Object.entries(want)) {
    const body = await refused(id, 409, 'made-elsewhere');
    assert(body.input === 'node' && op.test(err(body)), `${id}: made-elsewhere, naming node and the operation (${op}); got ${show(body)}`);
  }
});

test('RM33 [AC8, Decision 3]: unknown-concept, reserved-key (even for a node only word reaches) and no-superset', async () => {
  for (const id of ['uc-random', 'uc-element']) {
    const body = await refused(id, 404, 'unknown-concept');
    assert(body.input === 'concept', `${id}: names the input concept; got ${show(body)}`);
  }
  for (const [id, key] of [['rk-word', 'word'], ['rk-other-word', 'word'], ['rk-graph-context', 'graphContext']]) {
    const body = await refused(id, 409, 'reserved-key');
    assert(body.input === 'concept' && err(body).includes(key), `${id}: reserved-key, naming ${key}: the rule finds nothing for a reserved key, so apply's refusal answers (Decision 12); got ${show(body)}`);
  }
  await refused('no-superset', 409, 'no-superset');
});

test('RM34 [AC8, Decision 3]: a set that names no node, isn\'t a set, or is outside the concept\'s class thread is refused, naming set', async () => {
  const { k } = await ref();
  const un = await refused('un-set', 404, 'unknown-node');
  assert(un.input === 'set', `unknown-node names the input set; got ${show(un)}`);
  assert((await refused('nas-element', 409, 'not-a-set')).input === 'set', 'an element is not a set');
  assert(err(await refused('nas-header', 409, 'not-a-set')).includes(k.beagleSuperset), 'a concept header names its superset');
  const lap = await refused('lap', 409, 'not-in-class-thread');
  assert(lap.input === 'set' && err(lap).includes(k.dogSuperset), `outside dog's class thread, naming its superset; got ${show(lap)}`);
  const lapLast = await refused('lap-last', 409, 'not-in-class-thread');
  assert(lapLast.input === 'set', `pet's superset reaches whiskers, whose only concept is pet, but it is outside beagle's class thread: the guard gives no finding for such a set, so the call is refused not-in-class-thread, not last-concept (Amendment 1, item 10); got ${show(lapLast)}`);
});

test('RM35 [AC8, Decision 5]: JSON that can\'t be read is refused unreadable-json: two json tags that differ; sections beside that don\'t parse; a letter that doesn\'t', async () => {
  for (const id of ['uj-double', 'uj-own', 'uj-peer']) {
    const body = await refused(id, 409, 'unreadable-json');
    assert(body.input === 'node' && err(body).length > 20, `${id}: unreadable-json, naming node, saying why; got ${show(body).slice(0, 300)}`);
  }
});

test('RM36 [AC5, AC8, Decision 11]: a membership firmware\'s definition makes is refused firmware-membership, naming the part: an element file, a manifest edge', async () => {
  const file = await refused('fw-file', 409, 'firmware-membership');
  assert(err(file).includes('number.json'), `fwNumber is json-data-type's by its element file, ${M.FIRMWARE_FILES.number}, which names it (Decision 11a); got ${err(file)}`);
  const edge = await refused('fw-manifest', 409, 'firmware-membership');
  assert(/json-data-type/.test(err(edge)) && /manifest/.test(err(edge)), `fwInteger is in the numeric set by json-data-type's manifest edge, which names it (Decision 11b); got ${err(edge)}`);
});

test('RM37 [AC5, AC8, Decision 10]: a membership another author\'s letter claims is refused author-claim, naming the tag and its author', async () => {
  const { k } = await ref();
  const { before } = await ref();
  const z = await refused('claim-z', 409, 'author-claim');
  assert(err(z).includes(OTHER) && (err(z).includes(uuidOf(before, k.beagle)) || /\bz\b/.test(err(z))), `their z names beagle: refused, naming their key and the tag; got ${err(z)}`);
  const n = await refused('claim-n', 409, 'author-claim');
  assert(err(n).includes(OTHER) && (err(n).includes(uuidOf(before, k.showBeagles)) || /\bn\b/.test(err(n))), `their n names show beagles, a set the link runs from: refused, naming their key and the tag; got ${err(n)}`);
});

test('RM38 [AC8, open question 1]: a call that would take the node out of a concept it didn\'t name is refused other-concept, naming that concept and the way on', async () => {
  const { k, before } = await ref();
  // The link's start is named by its key, its address or its name: the ADR doesn't say which.
  const namesNode = (text, key) => { const n = C.node(before, key); return text.includes(key) || text.includes(n.props.uuid) || (n.props.name && text.includes(n.props.name)); };
  const sub = await refused('other-sub', 409, 'other-concept');
  assert(/golden retriever|goldenRetriever/i.test(err(sub)) && namesNode(err(sub), k.goldenRetrieverSuperset) && /unlink-set/.test(err(sub)),
    `dog reaches Goldie through golden retriever's superset: refused, naming golden retriever and its superset, and graph unlink-set (Decision 10, check 3); got ${err(sub)}`);
  const shared = await refused('other-shared', 409, 'other-concept');
  assert(/\bpet\b/.test(err(shared)) && namesNode(err(shared), k.walkers) && /unlink-set/.test(err(shared)),
    `Bella is in walkers, which pet shares with dog: refused, naming pet and the set; got ${err(shared)}`);
});

test('RM39 [AC7, Decision 12]: a node\'s last concept is refused last-concept by node-has-a-concept, before the operation\'s own checks', async () => {
  const last = await refused('last', 409, 'last-concept');
  assert(last.rule === RULE && /pet/.test(err(last)) && /add-to-concept/.test(err(last)) && /delete-node/.test(err(last)), `Whiskers' only concept: refused by ${RULE}, naming pet and the way on; got ${show(last)}`);
  for (const id of ['last-firmware', 'last-peer']) {
    const body = await refused(id, 409, 'last-concept');
    assert(body.rule === RULE, `${id}: a last concept that is also firmware's, or the author's, is answered last-concept: guards answer first (Consequences); got ${show(body)}`);
  }
});

test('RM40: inputs are checked: missing, the wrong type, unknown (fields is add-to-concept\'s)', async () => {
  needDecl();
  const { a } = await ref();
  for (const [id, code] of [['i-missing', 'missing-input'], ['i-type', 'invalid-input'], ['i-unknown', 'unknown-input']]) {
    const x = a.req(id);
    assert(x.status === 400 && x.body.code === code, `${id}: 400 ${code}; got ${x.status} ${show(x.body)}`);
  }
});

test('RM41 [AC8]: the refusal run changed nothing and recorded nothing, and signed nothing', async () => {
  await refused('last', 409, 'last-concept');
  await refused('claim-z', 409, 'author-claim');
  const { file, before, a } = await ref();
  const after = S.readState(file);
  assert(entriesIn(after).length === entriesIn(before).length, `no change entry was recorded; ${entriesIn(before).length} before, ${entriesIn(after).length} after`);
  assert(show(after.nodes) === show(before.nodes) && show(after.rels) === show(before.rels), 'the graph is as it was');
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signed; the spy saw ${show(a.spy)}`);
});

test('RM42 [Decision 2]: with no assistant key it is refused not-installed, and nothing changes', async () => {
  needDecl();
  const { file, k } = await fresh();
  const before = S.readState(file);
  const { a } = runOn(file, [rm('ni', k.twoHome, k.pet)], { env: (dir) => { const env = S.childEnv(dir); delete env.TA_PUBKEY; return env; } });
  const x = a.req('ni');
  assert(x.status === 409 && x.body.code === 'not-installed', `a node of two concepts, which the guard passes: 409 not-installed; got ${x.status} ${show(x.body)}`);
  const after = S.readState(file);
  assert(show(after.nodes) === show(before.nodes) && show(after.rels) === show(before.rels), 'and nothing changes');
});

test('RM43: a removal whose entry can\'t be recorded keeps nothing', async () => {
  needDecl();
  const { file, k } = await fresh((s) => { s.failures = { entry: true }; });
  const before = S.readState(file);
  const { a } = runOn(file, [rm('fail', k.twoHome, k.pet)]);
  assert(a.req('fail').status === 500, `the write fails; got ${a.req('fail').status} ${show(a.req('fail').body).slice(0, 300)}`);
  const after = S.readState(file);
  assert(show(after.nodes) === show(before.nodes) && show(after.rels) === show(before.rels), 'and keeps neither the delete, nor the section taken out, nor the tag');
});

test('RM44 [Decision 4]: a removal whose node a delete removed while it waited answers unknown-node, never a 500', async () => {
  needDecl();
  const { file, k } = await fresh((s, keys) => { s.failures = { vanish: { key: keys.twoHome } }; });
  const { a } = runOn(file, [rm('vanished', k.twoHome, k.pet)]);
  const x = a.req('vanished');
  assert(x.status === 404 && x.body.code === 'unknown-node', `unknown-node from its second try; got ${x.status} ${show(x.body).slice(0, 300)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
