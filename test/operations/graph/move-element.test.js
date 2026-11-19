'use strict';
/**
 * graph move-element — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/23-move-element.md (AC1–AC7, over the fake)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0023-move-element.md (Option A; Decisions 1–14)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/23-move-element.test-plan.md
 *
 * Stack-free: the real catalog, over test/helpers/moveElementGraph.js's seed for test/helpers/graphFake.js, with the
 * spy on. MAIN makes the moves and repeats them; AFTER reads its graph back through graph history and list-elements; REF
 * holds every refusal, so its graph must end as it began. The locks, two moves of one node at once (the fake's
 * failures.meanwhile), another write taking the link out before the move's delete (failures.beforeRelDelete, taught to
 * the fake for this story), a keyless instance, an entry that can't be recorded, a node deleted meanwhile and a tag with
 * no tapestryKey each have a run of their own.
 *
 *   ME0  the fake's failures.beforeRelDelete fires once, just before the first relationship DELETE, in both graphs
 *   ME1  filing: Filer goes from beagle's superset into show beagles; its n naming the set is added; nothing else changes
 *   ME2  the change entry; history finds it by the node, from, to and the concept; list-elements, direct, by each set
 *   ME3  the same call again is already-moved, recording nothing; a node already in to and not in from is too
 *   ME4  taking it back up: Shelved from show beagles to the superset; its n goes, none comes; letters
 *   ME5  set to set: Hopper's n tags follow it; a cached own node reports cacheOutOfDate; its letter is out of date
 *   ME6  an n naming to is added when none names it yet, though no n named from
 *   ME7  both sets: only from's link goes, and no link is added; history finds it by the node, from and the concept
 *   ME8  both sets with the superset as from: no tag changes, so letterOutOfDate stays false for a lettered own node
 *   ME9  every copy of from's link goes, recorded with count
 *   ME10 the note: nothing signed; the two reinstall sentences, each only where it applies
 *   ME11 another author's node, kept beside: moved, its letter untouched, no tag written, cacheOutOfDate
 *   ME12 a person node, a placeholder and firmware's own element, each the owner's claim, are moved, kept beside
 *   ME13 a concept that still reaches the node another way isn't left
 *   ME14 word and graphContext are never counted: leaving word, joining word, joining graphContext are each moved
 *   ME15 the move's concept is the innermost shared one; of two neither inside the other, the lowest tapestryKey
 *   ME16 marked-field node properties stay as they were
 *   ME17 every move made: JSON, node properties, other memberships and tags change only as a move says
 *   ME18 nothing is signed; an admin's move is the admin's; the command moves too, recorded as the command's
 *   ME19 listed with no guard, repeatKey [node, from, to], its three inputs and every refusal in order; /docs
 *   ME20 the lock: the node's, before any read, and no other; one write holds the delete, the MERGE and the entry
 *   ME21–ME24 two moves of one node at once, a move beside remove-from-concept, another write before the delete
 *   ME25–ME27 an entry that can't be recorded, a node deleted meanwhile, a tag with no tapestryKey
 *   ME30–ME44 the refusals (REF and the keyless run), in Decision 14's order
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const C = require('../../helpers/conceptGraph');
const ME = require('../../helpers/moveElementGraph');
const G = require('../../helpers/graphFake');

const { ROOT, OWNER, ADMIN, assert, show, tmp } = S;
const { OTHER } = ME;
const { test, run } = S.makeSuite('operations: graph move-element');

const ROUTE = '/api/tapestry/graph/move-element';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/move-element.js');
const HAS_ELEMENT = 'HAS_ELEMENT';
const NOBODY = '00000000-0000-4000-8000-0000000000e3';
const NOSET = '00000000-0000-4000-8000-0000000000f3';
/** Decision 14's refusals, in Decision 2's order, with their statuses. */
const REFUSALS = [['same-set', 400], ['not-installed', 409], ['unknown-node', 404], ['tag-node', 409], ['made-elsewhere', 409], ['not-a-set', 409], ['different-concepts', 409], ['not-in-from', 409], ['firmware-membership', 409], ['author-claim', 409], ['leaves-concept', 409], ['joins-concept', 409]];

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/move-element.js does not exist yet (ADR graph-operations-first-slice/0023 Decision 1)');
}
const post = (id, caller, body, extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body, ...extra });
const mv = (id, node, from, to, caller = 'owner') => post(id, caller, { node, from, to });
const get = (id, url) => ({ id, method: 'GET', url, caller: 'owner' });
const history = (id, key) => get(id, `/api/tapestry/graph/history?node=${key}&limit=200`);
const listSet = (id, key) => get(id, `/api/tapestry/graph/list-elements?set=${key}&direct=true&limit=200`);

/** One harness run over a state file; { r, a }. */
function runOn(file, requests, { cli = [], spy = false, env = null } = {}) {
  const dir = path.dirname(file);
  const r = S.runHarness({ spy, scenarios: [{ graphFake: { stateFile: file }, requests, cli }] }, { dir, env: env ? env(dir) : null });
  return { r, a: S.answered(r) };
}
/** A fresh seed in a directory of its own; { file, dir, k, u, seed }. `mutate(state, keys)` changes it first. */
async function fresh(mutate = null) {
  const seed = await ME.seedMoveElement();
  if (mutate) mutate(seed.state, seed.keys);
  const file = seed.file(tmp('move-element-'));
  return { file, dir: path.dirname(file), k: seed.keys, u: seed.uuids, seed };
}
/** A copy of a state file beside it, under another name. */
function copyOf(file, name) {
  const to = path.join(path.dirname(file), `${name}.json`);
  fs.copyFileSync(file, to);
  return to;
}
/** Make the write that left `otherFile` commit while the next write on `file` waits for the node keyed `at`. */
function meanwhileAt(file, at, otherFile) {
  const s = S.readState(file);
  const o = S.readState(otherFile);
  s.failures = { ...(s.failures || {}), meanwhile: { at, graph: { nodes: o.nodes, rels: o.rels, nextEid: o.nextEid } } };
  G.writeState(file, s);
}

// ── reading a state ──
const nodeByKey = (g, key) => g.nodes.find((n) => n.props.tapestryKey === key) || null;
const entriesIn = (g) => g.nodes.filter((n) => n.labels.includes('GraphChange'));
const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((o, key) => { o[key] = v[key]; return o; }, {}) : v));
const same = (a, b) => canon(a) === canon(b);
const graphOf = (s) => ({ nodes: s.nodes, rels: s.rels });
const into = (g, key) => C.into(g, key, HAS_ELEMENT).sort();
const tagSet = (g, key) => C.tags(g, key).map((t) => `${t.type}:${t.value}`).sort();
const jsonValues = (g, key) => C.tags(g, key).filter((t) => t.type === 'json').map((t) => t.value);
const changeOf = (d, name) => ((d && d.change && d.change.changes) || []).filter((c) => c.change === name);
const keysOf = (list) => (Array.isArray(list) ? list.map((c) => c && c.concept) : ['(not a list)']).sort();
const err = (body) => String(body && body.error);
const uuidOf = (g, key) => C.node(g, key).props.uuid;
const has = (text, ...parts) => parts.every((p) => String(text).includes(p));
const sentencesOf = (text) => String(text || '').split(/(?<=[.!?])\s+/);
const reinstallSentences = (text) => sentencesOf(text).filter((x) => /reinstall/i.test(x));
const entriesNaming = (g, key) => entriesIn(g).filter((e) => e.props.operation === 'graph move-element' && (e.props.keys || []).includes(key));

function transactions(log, from = 0) {
  const out = [];
  let cur = null;
  for (const l of log.slice(from)) {
    if (l.call === 'begin') cur = { steps: [] };
    else if (l.call === 'commit' || l.call === 'rollback') { if (cur) out.push({ end: l.call, error: l.error || null, steps: cur.steps }); cur = null; } else if (cur) cur.steps.push(l);
  }
  return out;
}

// ── MAIN: the moves made, and repeated ──
/** [id, node, from, to, caller], in the order they run. */
const MOVES = (k) => [
  ['file', k.filer, k.beagleSuperset, k.showBeagles],
  ['file-again', k.filer, k.beagleSuperset, k.showBeagles],
  ['already-filed', k.shelved, k.beagleSuperset, k.showBeagles],
  ['up', k.shelved, k.showBeagles, k.beagleSuperset],
  ['hop', k.hopper, k.showBeagles, k.agilityBeagles],
  ['lucky', k.lucky, k.showBeagles, k.agilityBeagles],
  ['both', k.twoSets, k.showBeagles, k.agilityBeagles],
  ['both-superset', k.setItem, k.beagleSuperset, k.showBeagles],
  ['doubled', k.doubled, k.agilityBeagles, k.showBeagles],
  ['stacked', k.stacked, k.agilityBeagles, k.beagleSuperset],
  ['peer', k.peerCached, k.beagleSuperset, k.showBeagles],
  ['person', k.personInPet, k.petSuperset, k.lapPets],
  ['placeholder', k.placeholderInPet, k.petSuperset, k.lapPets],
  ['firmware-own', k.fwNumber, k.petSuperset, k.lapPets],
  ['kept-other-way', k.sharedKept, k.sharedSet, k.lapPets],
  ['word-leave', k.inCommon, k.commonSet, k.beagleSuperset],
  ['word-join', k.toCommon, k.beagleSuperset, k.commonSet],
  ['context-join', k.toContext, k.beagleSuperset, k.contextShelf],
  ['innermost', k.goldFiled, k.goldenRetrieverSuperset, k.showGoldens],
  ['lowest', k.twoShared, k.sharedSet, k.sharedTwo],
  ['marked', k.markedGadget, k.gadgetSuperset, k.gadgetBin],
  ['admin', k.adminFiler, k.beagleSuperset, k.showBeagles, 'admin'],
];
/** The moves that change the graph (every MAIN move but the two repeats), and the command's. */
const MADE = (k) => [...MOVES(k).filter(([id]) => id !== 'file-again' && id !== 'already-filed'), ['cli', k.cliFiler, k.beagleSuperset, k.showBeagles]];

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    const { file, k, u, seed } = await fresh();
    const before = S.readState(file);
    const { a } = runOn(file, [
      ...MOVES(k).map(([id, node, from, to, caller]) => mv(id, node, from, to, caller || 'owner')),
      { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
    ], {
      spy: true,
      cli: [{ id: 'cli', argv: ['graph', 'move-element', '--node', k.cliFiler, '--from', k.beagleSuperset, '--to', k.showBeagles] }],
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

// ── AFTER: MAIN's graph read back through history and list-elements ──
let AFTER = null;
function after() {
  if (AFTER) return AFTER;
  AFTER = (async () => {
    const { file, k } = await main();
    const { a } = runOn(file, [
      history('h-node', k.filer), history('h-from', k.beagleSuperset), history('h-to', k.showBeagles), history('h-concept', k.beagle),
      history('b-node', k.twoSets), history('b-from', k.showBeagles), history('b-concept', k.beagle),
      listSet('le-to', k.showBeagles), listSet('le-from', k.beagleSuperset),
    ]);
    return a;
  })();
  return AFTER;
}
async function entryIdsOf(id) {
  const x = (await after()).req(id);
  assert(x.status === 200, `${id}: graph history must answer 200; got ${x.status} ${show(x.body).slice(0, 300)}`);
  return x.body.data.entries.map((e) => e.id);
}
async function listedBy(id) {
  const x = (await after()).req(id);
  assert(x.status === 200, `${id}: list-elements must answer 200; got ${x.status} ${show(x.body).slice(0, 300)}`);
  return x.body.data.elements.map((e) => e.tapestryKey);
}

// ── ME0: the fake's new failure ──
test('ME0 [Decision 8]: the fake\'s failures.beforeRelDelete fires once, just before the first relationship DELETE, in the committed graph and the transaction\'s alike', async () => {
  const dir = tmp('move-element-fake-');
  const n = (eid, key) => ({ eid, labels: ['TapestryNode'], props: { tapestryKey: key } });
  const base = { nodes: [n(1, 'a'), n(2, 'b'), n(3, 'c')], rels: [{ eid: 4, type: HAS_ELEMENT, from: 1, to: 3, props: {} }] };
  const other = { drop: [{ type: HAS_ELEMENT, from: 'a', to: 'c' }], add: [{ type: HAS_ELEMENT, from: 'b', to: 'c' }] };
  const fresh0 = (name, failures = { beforeRelDelete: other }) => {
    const file = path.join(dir, `${name}.json`);
    G.writeState(file, G.emptyState({ ...JSON.parse(JSON.stringify(base)), nextEid: 5, failures }));
    return file;
  };
  const COPIES = 'UNWIND $rows AS row MATCH (n:TapestryNode {tapestryKey: row.key}) WHERE NOT n:GraphChange SET n += row.props RETURN count(n) AS n';
  const LINK = (from, to) => ['MATCH (a:TapestryNode {tapestryKey: $from})-[r:`HAS_ELEMENT`]->(b:TapestryNode {tapestryKey: $to}) WHERE NOT a:GraphChange AND NOT b:GraphChange RETURN count(r) AS n', { from, to }];
  const DELETE = (from, to) => ['MATCH (a:TapestryNode {tapestryKey: $from})-[r:`HAS_ELEMENT`]->(b:TapestryNode {tapestryKey: $to}) WHERE NOT a:GraphChange AND NOT b:GraphChange DELETE r RETURN count(r) AS removed', { from, to }];
  const pairs = (s) => s.rels.filter((r) => r.type === HAS_ELEMENT).map((r) => `${s.nodes.find((x) => x.eid === r.from).props.tapestryKey}>${s.nodes.find((x) => x.eid === r.to).props.tapestryKey}`).sort();

  const f1 = fresh0('fires');
  let deleted = null;
  await G.fakeGraph(f1).writeTransaction(async (tx) => {
    const seen = await tx.read(...LINK('a', 'c'));
    assert(Number(seen[0].n) === 1, `before the delete, a's link to c is there; got ${show(seen)}`);
    await tx.run(COPIES, { rows: [{ key: 'c', props: { tapestryLock: true } }] });
    await tx.run(COPIES, { rows: [{ key: 'c', props: { tapestryLock: null } }] });
    const still = await tx.read(...LINK('a', 'c'));
    assert(Number(still[0].n) === 1, `a lock doesn't fire it; got ${show(still)}`);
    const { counters } = await tx.run(...DELETE('a', 'c'));
    deleted = counters.relationshipsDeleted;
    const now = await tx.read(...LINK('b', 'c'));
    assert(Number(now[0].n) === 1, `after it fired, the transaction reads b's link to c; got ${show(now)}`);
  });
  const s1 = G.readState(f1);
  assert(deleted === 0, `the delete finds a's link already gone; it deleted ${deleted}`);
  assert(show(pairs(s1)) === show(['b>c']) && !(s1.failures && s1.failures.beforeRelDelete), `the commit keeps the other write's graph, and it fired once; got ${show({ pairs: pairs(s1), failures: s1.failures })}`);
  const steps = s1.log.filter((l) => l.call !== 'begin' && l.call !== 'commit');
  const at = steps.findIndex((l) => l.call === 'beforeRelDelete');
  assert(at > 0 && steps[at + 1] && steps[at + 1].kind === 'delete' && !steps.slice(0, at).some((l) => l.kind === 'delete'), `the log has { beforeRelDelete } just before the first relationship delete; got ${show(steps)}`);

  // A rollback after it fired keeps what the other write committed; a DETACH DELETE doesn't fire it.
  const f2 = fresh0('rollback');
  let thrown = null;
  try {
    await G.fakeGraph(f2).writeTransaction(async (tx) => {
      await tx.run('MATCH (t:NostrEventTag {tapestryKey: $key}) DETACH DELETE t', { key: 'no-such-tag' });
      assert(Number((await tx.read(...LINK('a', 'c')))[0].n) === 1, 'a DETACH DELETE doesn\'t fire it');
      await tx.run(...DELETE('a', 'c'));
      throw new Error('refused after the delete');
    });
  } catch (e) { thrown = e; }
  const s2 = G.readState(f2);
  assert(thrown && /refused after the delete/.test(thrown.message), `the transaction's own error comes through; got ${show(thrown && thrown.message)}`);
  assert(show(pairs(s2)) === show(['b>c']) && !(s2.failures && s2.failures.beforeRelDelete), `the rollback keeps the other write's graph; got ${show({ pairs: pairs(s2), failures: s2.failures })}`);

  // An end that names no node is the test's mistake, said so.
  const f3 = fresh0('unknown', { beforeRelDelete: { drop: [{ type: HAS_ELEMENT, from: 'zz', to: 'c' }] } });
  thrown = null;
  try { await G.fakeGraph(f3).writeTransaction(async (tx) => { await tx.run(...DELETE('a', 'c')); }); } catch (e) { thrown = e; }
  assert(thrown && /beforeRelDelete/.test(thrown.message) && /\bzz\b/.test(thrown.message), `it names the key no node has; got ${show(thrown && thrown.message)}`);
});

// ── AC1: a move ──
test('ME1 [AC1, AC6]: filing: Filer goes from beagle\'s superset into show beagles, in one write; its n naming the set is added; its JSON and the rest stay', async () => {
  const d = await ok('file');
  const { k, u, before } = await main();
  assert(d.outcome === 'moved' && d.from === k.beagleSuperset && d.to === k.showBeagles && d.concept === k.beagle && d.kept === 'json-tag', `moved, from the superset into the set, in beagle, kept in its json tag; got ${show(d).slice(0, 500)}`);
  assert(d.node && d.node.tapestryKey === k.filer && d.node.address === u.filer && d.node.name === 'Filer', `the answer's node is its key, address and name; got ${show(d.node)}`);
  assert(show(keysOf(d.concepts)) === show([k.beagle]) && d.concepts[0].key === 'beagle', `still an element of beagle alone; got ${show(d.concepts)}`);
  assert(show(d.letters) === show([]) && d.letterOutOfDate === false && d.cacheOutOfDate === false, `made here, so no letter; not cached; got ${show({ letters: d.letters, l: d.letterOutOfDate, c: d.cacheOutOfDate })}`);
  const g = await graph();
  assert(show(into(g, k.filer)) === show([k.showBeagles]), `directly in show beagles and no longer in the superset; got ${show(into(g, k.filer))}`);
  assert(show(jsonValues(g, k.filer)) === show(jsonValues(before, k.filer)) && same(nodeByKey(g, k.filer).props, nodeByKey(before, k.filer).props), 'its JSON and its node properties are as they were');
  const showUuid = uuidOf(before, k.showBeagles);
  assert(show(tagSet(g, k.filer)) === show([...tagSet(before, k.filer), `n:${showUuid}`].sort()), `its tags gain one n naming show beagles; its z naming beagle stays (Decision 9); got ${show(tagSet(g, k.filer))}`);
  const added = C.tags(g, k.filer).find((t) => t.type === 'n');
  const old = C.tags(before, k.filer).map((t) => t.uuid);
  assert(added && typeof added.key === 'string' && added.key && !old.includes(added.uuid), `the new n has a tapestryKey and a uuid no tag had before, from a new index (Decision 9); got ${show(added)}`);
});

test('ME2 [AC1, Decision 13]: the change entry; history finds it by the node, from, to and the concept; list-elements, direct, lists it in to and no longer in from', async () => {
  const d = await ok('file');
  const { k, before } = await main();
  assert(d.change && d.change.operation === 'graph move-element' && show(d.change.by) === show({ role: 'owner', pubkey: OWNER }), `the owner's entry, through graph move-element; got ${show(d.change).slice(0, 300)}`);
  const out = changeOf(d, 'membership-removed');
  assert(out.length === 1 && out[0].type === HAS_ELEMENT && out[0].from === k.beagleSuperset && out[0].to === k.filer && out[0].node === k.filer && out[0].concept === k.beagle && !('count' in out[0]),
    `one membership-removed: the superset's link, in beagle, with no count for one copy; got ${show(out)}`);
  const inn = changeOf(d, 'membership-added');
  assert(inn.length === 1 && inn[0].type === HAS_ELEMENT && inn[0].from === k.showBeagles && inn[0].to === k.filer && inn[0].node === k.filer && inn[0].concept === k.beagle, `one membership-added: show beagles' link; got ${show(inn)}`);
  const t = changeOf(d, 'tag-added');
  assert(t.length === 1 && t[0].node === k.filer && t[0].field === 'n' && t[0].now === uuidOf(before, k.showBeagles) && changeOf(d, 'tag-removed').length === 0, `tag-added: the n naming show beagles; no tag-removed; got ${show(d.change.changes)}`);
  const kinds = [...new Set(d.change.changes.map((c) => c.change))].sort();
  assert(show(kinds) === show(['membership-added', 'membership-removed', 'tag-added']), `nothing but links and tags: no section, wordTypes or copies change (AC1, AC4); got ${show(kinds)}`);
  for (const id of ['h-node', 'h-from', 'h-to', 'h-concept']) {
    const ids = await entryIdsOf(id);
    assert(ids.includes(d.change.id), `${id}: graph history finds the move's entry (AC1); got ${show(ids).slice(0, 300)}`);
  }
  const inTo = await listedBy('le-to');
  const inFrom = await listedBy('le-from');
  assert(inTo.includes(k.filer), `list-elements with set show beagles and direct lists Filer; got ${show(inTo)}`);
  assert(!inFrom.includes(k.filer) && inFrom.includes(k.rover), `with set beagle's superset and direct it no longer does, and still lists rover; got ${show(inFrom).slice(0, 300)}`);
});

// ── AC2: safe to repeat ──
test('ME3 [AC2]: the same call again is already-moved, recording nothing; so is a call whose node is already in to and not in from', async () => {
  const again = await ok('file-again');
  const { k, before } = await main();
  assert(again.outcome === 'already-moved' && again.change === null && again.node && again.node.tapestryKey === k.filer && again.from === k.beagleSuperset && again.to === k.showBeagles,
    `already-moved, naming the node and the two sets, with no entry; got ${show(again).slice(0, 400)}`);
  assert(show(again.letters) === show([]) && again.letterOutOfDate === false && again.cacheOutOfDate === false, `already-moved answers no letters and both flags false (Decision 12); got ${show(again)}`);
  assert(show(keysOf(again.concepts)) === show([k.beagle]) && again.concepts[0].key === 'beagle', `already-moved still names each concept the node is an element of: beagle (Decision 12; review round 1, finding 4); got ${show(again.concepts)}`);
  const g = await graph();
  assert(entriesNaming(g, k.filer).length === 1, `one entry for Filer's move; got ${entriesNaming(g, k.filer).length}`);
  const filed = await ok('already-filed');
  assert(filed.outcome === 'already-moved' && filed.change === null, `Shelved, already in show beagles and not in the superset: already-moved; got ${show(filed).slice(0, 300)}`);
  const up = await ok('up');
  assert(up.outcome === 'moved' && entriesNaming(g, k.shelved).length === 1, `and only its own move afterwards recorded an entry; got ${up.outcome}, ${entriesNaming(g, k.shelved).length}`);
  assert(show(into(before, k.shelved)) === show([k.showBeagles]), `control: Shelved was in show beagles alone before; got ${show(into(before, k.shelved))}`);
});

test('ME4 [AC1, AC6, Decisions 9 and 10]: taking it back up: Shelved from show beagles to the superset; its n goes, none comes; letters names its letter and the relationship event', async () => {
  const d = await ok('up');
  const { k, before } = await main();
  const g = await graph();
  const showUuid = uuidOf(before, k.showBeagles);
  assert(d.outcome === 'moved' && d.from === k.showBeagles && d.to === k.beagleSuperset && d.concept === k.beagle && d.kept === 'json-tag', `moved up to the superset; got ${show(d).slice(0, 400)}`);
  assert(show(into(g, k.shelved)) === show([k.beagleSuperset]), `directly in the superset, no longer in show beagles; got ${show(into(g, k.shelved))}`);
  assert(show(tagSet(g, k.shelved)) === show(tagSet(before, k.shelved).filter((t) => t !== `n:${showUuid}`)), `its n naming show beagles goes, and a superset gets no n; got ${show(tagSet(g, k.shelved))}`);
  const tr = changeOf(d, 'tag-removed');
  assert(tr.length === 1 && tr[0].field === 'n' && tr[0].was === showUuid && changeOf(d, 'tag-added').length === 0, `tag-removed: the n; no tag-added; got ${show(d.change && d.change.changes)}`);
  assert(d.letterOutOfDate === true, `its letter, signed with that n, now differs from it (Decision 10); got ${show(d.letterOutOfDate)}`);
  const letters = Array.isArray(d.letters) ? d.letters : [];
  assert(show(letters.map((l) => l && l.address).sort()) === show([uuidOf(before, k.shelved), uuidOf(before, k.relShelved)].sort()) && letters.every((l) => typeof l.says === 'string' && l.says.trim()),
    `letters: its own letter, and the instance's own relationship event naming show beagles HAS_ELEMENT it, each saying what it still says; got ${show(d.letters)}`);
  const own = letters.find((l) => l.address === uuidOf(before, k.shelved));
  assert(own && own.says.includes(showUuid), `its own letter's words say which n names from (Decision 10); got ${show(own)}`);
  assert(C.node(g, k.relShelved) && show(C.tagArrays(g, k.relShelved)) === show(C.tagArrays(before, k.relShelved)), 'the relationship event stays as it was, reported');
  assert(/export nostr/i.test(String(d.note)), `the note says the letter differs until export nostr; got ${show(d.note)}`);
});

test('ME5 [AC1, AC6, Decisions 9 and 10]: set to set: Hopper\'s n tags follow it; a cached own node reports cacheOutOfDate; its letter is out of date', async () => {
  const d = await ok('hop');
  const { k, before } = await main();
  const g = await graph();
  const [showUuid, agilityUuid] = [uuidOf(before, k.showBeagles), uuidOf(before, k.agilityBeagles)];
  assert(d.outcome === 'moved' && d.concept === k.beagle && show(into(g, k.hopper)) === show([k.agilityBeagles]), `moved into agility beagles; got ${show(d).slice(0, 300)}, links ${show(into(g, k.hopper))}`);
  assert(show(tagSet(g, k.hopper)) === show([...tagSet(before, k.hopper).filter((t) => t !== `n:${showUuid}`), `n:${agilityUuid}`].sort()), `its n naming show beagles goes, and one naming agility beagles comes; got ${show(tagSet(g, k.hopper))}`);
  const added = C.tags(g, k.hopper).find((t) => t.type === 'n');
  assert(added && !C.tags(before, k.hopper).map((t) => t.uuid).includes(added.uuid), `the new n's uuid is new, never the removed one's (Decision 9); got ${show(added)}`);
  const tr = changeOf(d, 'tag-removed');
  const ta = changeOf(d, 'tag-added');
  assert(tr.length === 1 && tr[0].was === showUuid && ta.length === 1 && ta[0].now === agilityUuid && tr[0].field === 'n' && ta[0].field === 'n', `tag-removed names show beagles, tag-added agility beagles; got ${show(d.change && d.change.changes)}`);
  assert(d.cacheOutOfDate === true && /cache rebuild/i.test(String(d.note)), `its cached copy lists show beagles among its parents until cache rebuild (Decision 10); got ${show({ c: d.cacheOutOfDate, note: d.note })}`);
  assert(d.letterOutOfDate === true, `lettered, and a tag changed: its letter is out of date; got ${show(d.letterOutOfDate)}`);
  const own = (d.letters || []).find((l) => l.address === uuidOf(before, k.hopper));
  assert(own && has(own.says, showUuid, agilityUuid), `its letter's words name the n naming from and the one missing for to; got ${show(d.letters)}`);
});

test('ME6 [AC6, Decision 9]: an n naming to is added when none names it yet, though no n named from: Lucky into agility beagles', async () => {
  const d = await ok('lucky');
  const { k, before } = await main();
  const g = await graph();
  const agilityUuid = uuidOf(before, k.agilityBeagles);
  assert(d.outcome === 'moved' && show(into(g, k.lucky)) === show([k.agilityBeagles]), `moved; got ${show(d).slice(0, 300)}`);
  assert(show(tagSet(g, k.lucky)) === show([...tagSet(before, k.lucky), `n:${agilityUuid}`].sort()), `it gains an n naming agility beagles, and loses nothing; got ${show(tagSet(g, k.lucky))}`);
  assert(changeOf(d, 'tag-added').length === 1 && changeOf(d, 'tag-removed').length === 0 && d.letterOutOfDate === true, `tag-added only, its letter out of date; got ${show(d.change && d.change.changes)}`);
  const own = (d.letters || []).find((l) => l.address === uuidOf(before, k.lucky));
  assert(own && own.says.includes(agilityUuid), `its letter's words say which n is missing for to; got ${show(d.letters)}`);
});

test('ME7 [AC2, Decision 5]: both sets: Two Sets, in show beagles and agility beagles, loses only show beagles\' link; no link is added; history finds it by the node, from and the concept', async () => {
  const d = await ok('both');
  const { k, before } = await main();
  const g = await graph();
  const showUuid = uuidOf(before, k.showBeagles);
  assert(d.outcome === 'moved' && show(into(g, k.twoSets)) === show([k.agilityBeagles]), `moved: only from's link goes, and agility beagles' one link stays (AC2); got ${show(d).slice(0, 300)}, links ${show(into(g, k.twoSets))}`);
  assert(changeOf(d, 'membership-removed').length === 1 && changeOf(d, 'membership-added').length === 0, `membership-removed, and no membership-added: to's link wasn't made; got ${show(d.change && d.change.changes)}`);
  assert(show(tagSet(g, k.twoSets)) === show(tagSet(before, k.twoSets).filter((t) => t !== `n:${showUuid}`)) && changeOf(d, 'tag-added').length === 0, `its n naming show beagles goes; the one naming agility beagles stays alone; got ${show(tagSet(g, k.twoSets))}`);
  for (const id of ['b-node', 'b-from', 'b-concept']) {
    const ids = await entryIdsOf(id);
    assert(ids.includes(d.change.id), `${id}: history finds the both-sets entry by the node, from and the concept (AC1, amended); got ${show(ids).slice(0, 300)}`);
  }
});

test('ME8 [AC2, Decision 10]: both sets with the superset as from: Set Item loses the superset\'s link, no tag changes, and its letter isn\'t out of date', async () => {
  const d = await ok('both-superset');
  const { k, before } = await main();
  const g = await graph();
  assert(d.outcome === 'moved' && show(into(g, k.setItem)) === show([k.showBeagles]), `moved; got ${show(d).slice(0, 300)}`);
  assert(show(tagSet(g, k.setItem)) === show(tagSet(before, k.setItem)) && !d.change.changes.some((c) => /^tag-/.test(c.change)), `a superset has no n to take out, and show beagles' n is there: no tag changes; got ${show(d.change.changes)}`);
  assert(d.letterOutOfDate === false && show(d.letters) === show([]), `lettered and its own, but no tag changed, so its letter still says where it is (Decision 10); got ${show({ l: d.letterOutOfDate, letters: d.letters })}`);
});

test('ME9 [Decision 8, Decision 13]: every copy of from\'s link goes, recorded once with its count', async () => {
  const d = await ok('doubled');
  const { k } = await main();
  const g = await graph();
  const out = changeOf(d, 'membership-removed');
  assert(d.outcome === 'moved' && show(into(g, k.doubled)) === show([k.showBeagles]), `both copies of agility beagles' link go; got ${show(into(g, k.doubled))}`);
  assert(out.length === 1 && out[0].from === k.agilityBeagles && out[0].count === 2, `one membership-removed with count 2; got ${show(out)}`);
});

test('ME10 [AC7, Decisions 11 and 12]: the note says nothing was signed, and gives each reinstall sentence only where it applies', async () => {
  const { a } = await main();
  for (const id of ['file', 'up', 'hop', 'stacked', 'peer', 'person']) await ok(id);
  const note = (id) => String((a.req(id).body.data || {}).note || '');
  for (const id of ['file', 'up', 'hop', 'stacked', 'peer', 'person']) assert(/nothing was signed or sent anywhere/i.test(note(id)), `${id}: the note says the change is in this instance's graph only (Decision 12); got ${show(note(id))}`);
  const filed = reinstallSentences(note('file'));
  assert(filed.some((x) => /\bz\b|z tag|pass 1d/i.test(x)), `Filer left beagle's superset, and its z names beagle: a reinstall links the superset to it again from that z (Decision 11); its sentences on a reinstall are ${show(filed)}`);
  const stacked = reinstallSentences(note('stacked'));
  assert(stacked.some((x) => /redundant|prune/i.test(x)), `Stacked went up to the superset while show beagles still holds it: the superset's link is redundant, and a reinstall's prune may take it out (Decision 12); its sentences on a reinstall are ${show(stacked)}`);
  for (const id of ['hop', 'up']) assert(reinstallSentences(note(id)).length === 0, `${id}: neither applies (from isn't a superset; to is a set, or a superset no set of the concept holds it under), so no reinstall sentence; got ${show(note(id))}`);
  // Review round 1, finding 4: out of a superset, but no z of the node names its concept, so pass 1d doesn't link it again.
  for (const id of ['placeholder', 'firmware-own']) await ok(id);
  for (const id of ['person', 'placeholder', 'firmware-own']) assert(reinstallSentences(note(id)).length === 0, `${id}: moved out of pet's superset, but no z of the node names pet, so a reinstall doesn't link the superset to it again (Decision 11): no reinstall sentence; got ${show(note(id))}`);
});

// ── AC6: anyone's node ──
test('ME11 [AC6, Decisions 6 and 9]: another author\'s node kept beside is moved: their letter untouched, no tag written, its z naming the concept it stays in no claim; cacheOutOfDate', async () => {
  const d = await ok('peer');
  const { k, before } = await main();
  const g = await graph();
  assert(d.outcome === 'moved' && d.kept === 'beside' && show(into(g, k.peerCached)) === show([k.showBeagles]), `moved, kept beside: their z names beagle, which it stays in, so it claims no link from the superset (Decision 6); got ${show(d).slice(0, 400)}`);
  assert(show(C.tagArrays(g, k.peerCached)) === show(C.tagArrays(before, k.peerCached)) && same(nodeByKey(g, k.peerCached).props, nodeByKey(before, k.peerCached).props), 'their letter, its tags and json tag, and its properties are exactly as they were');
  assert(!d.change.changes.some((c) => /^tag-/.test(c.change)), `no tag change is recorded; got ${show(d.change.changes)}`);
  assert(d.cacheOutOfDate === true && d.letterOutOfDate === false && show(d.letters) === show([]), `cached, however it is kept: cacheOutOfDate; the letter isn't the instance's; got ${show({ c: d.cacheOutOfDate, l: d.letterOutOfDate, letters: d.letters })}`);
  const words = sentencesOf(d.note).filter((x) => /tags/i.test(x) && /JSON/.test(x));
  assert(words.some((x) => /left|unchanged|as (it|they) (is|are|was|were)/i.test(x)), `the note says its tags and JSON are left as they are, and only its links changed (Decision 12); got ${show(d.note)}`);
  assert(reinstallSentences(d.note).some((x) => /\bz\b|z tag|pass 1d/i.test(x)), `and that a reinstall links the superset again from their z; got ${show(d.note)}`);
});

test('ME12 [AC6]: a person node, a placeholder and firmware\'s own element are moved, each the owner\'s claim, kept beside, nothing of theirs written', async () => {
  const { k, before } = await main();
  const g = await graph();
  for (const [id, key, links] of [['person', k.personInPet, [k.lapPets]], ['placeholder', k.placeholderInPet, [k.lapPets]], ['firmware-own', k.fwNumber, [k.jsonDataTypeSuperset, k.lapPets].sort()]]) {
    const d = await ok(id);
    assert(d.outcome === 'moved' && d.kept === 'beside' && d.concept === k.pet, `${id}: moved within pet, kept beside; got ${show(d).slice(0, 300)}`);
    assert(show(into(g, key)) === show(links), `${id}: directly in lap pets, out of pet's superset${key === k.fwNumber ? ", still in json-data-type's, firmware's membership" : ''}; got ${show(into(g, key))}`);
    assert(show(C.tagArrays(g, key)) === show(C.tagArrays(before, key)) && same(nodeByKey(g, key).props, nodeByKey(before, key).props), `${id}: its tags and properties, tapestryOwnSections among them, are as they were`);
    assert(!d.change.changes.some((c) => /^tag-/.test(c.change)), `${id}: no tag change; got ${show(d.change.changes)}`);
  }
});

// ── AC4: the node's concepts stay the same ──
test('ME13 [AC4, Decision 7]: a concept that still reaches the node another way isn\'t left: Shared Kept, in sharedSet and gadget\'s superset, moves to lap pets', async () => {
  const d = await ok('kept-other-way');
  const { k, before } = await main();
  const g = await graph();
  assert(d.outcome === 'moved' && d.concept === k.pet && show(keysOf(d.concepts)) === show([k.gadget, k.pet].sort()), `moved, still in gadget through its superset and in pet: no leaves-concept; got ${show(d).slice(0, 400)}`);
  const zs = (s) => tagSet(s, k.sharedKept).filter((t) => t.startsWith('z:'));
  assert(show(into(g, k.sharedKept)) === show([k.gadgetSuperset, k.lapPets].sort()), `sharedSet's link goes, gadget's superset's stays; got ${show(into(g, k.sharedKept))}`);
  assert(show(zs(g)) === show(zs(before)) && zs(before).length === 2, `its z tags naming pet and gadget are untouched: the concepts don't change (Decision 9); got ${show(zs(g))}`);
});

test('ME14 [AC3, AC4, Decision 4]: word and graphContext are never counted: leaving word, joining word, and joining graphContext are each moved, the JSON untouched', async () => {
  const { k, before } = await main();
  const g = await graph();
  for (const [id, key, to] of [['word-leave', k.inCommon, k.beagleSuperset], ['word-join', k.toCommon, k.commonSet], ['context-join', k.toContext, k.contextShelf]]) {
    const d = await ok(id);
    assert(d.outcome === 'moved' && d.concept === k.beagle && keysOf(d.concepts).includes(k.beagle), `${id}: moved, in beagle: word's and graph context's keys are set aside (Decision 4); got ${show(d).slice(0, 400)}`);
    assert(show(into(g, key)) === show([to]) && show(jsonValues(g, key)) === show(jsonValues(before, key)), `${id}: in its new set, its JSON (word block included) as it was`);
  }
});

test('ME15 [AC1, Decision 4]: the move\'s concept is the innermost one both sets share; of two where neither is inside the other, the one of lower tapestryKey', async () => {
  const gold = await ok('innermost');
  const { k } = await main();
  assert(gold.concept === k.goldenRetriever && show(keysOf(gold.concepts)) === show([k.dog, k.goldenRetriever].sort()), `golden retriever's superset is under dog's: the move is in golden retriever, the innermost; got ${show({ concept: gold.concept, concepts: gold.concepts })}`);
  assert(gold.change.changes.filter((c) => /^membership-/.test(c.change)).every((c) => c.concept === k.goldenRetriever), `its entry names golden retriever; got ${show(gold.change.changes)}`);
  const low = await ok('lowest');
  assert(low.concept === [k.pet, k.gadget].sort()[0] && show(keysOf(low.concepts)) === show([k.gadget, k.pet].sort()), `pet and gadget both hold sharedSet and sharedTwo: the lower tapestryKey of the two; got ${show({ concept: low.concept, pet: k.pet, gadget: k.gadget })}`);
});

test('ME16 [AC1]: marked-field node properties stay as they were: Marked Gadget into the gadget bin', async () => {
  const d = await ok('marked');
  const { k, before } = await main();
  const n = nodeByKey(await graph(), k.markedGadget);
  assert(d.outcome === 'moved' && same(n.props, nodeByKey(before, k.markedGadget).props) && 'gadget_size' in n.props && n.props.gadget_color === 'red', `gadget_size and gadget_color are untouched: its concepts don't change (AC1); got ${show(n.props)}`);
});

test('ME17 [AC1, AC4, AC6]: every move made changes the node\'s links and n tags as the move says, and nothing else of it', async () => {
  needDecl();
  const { a, k, before } = await main();
  const g = await graph();
  const superset = (key) => C.node(before, key).labels.includes('Superset');
  const byNode = new Map();
  for (const [id, node, from, to] of MADE(k)) {
    const x = id === 'cli' ? { status: a.cmd('cli').code === 0 ? 200 : 0 } : a.req(id);
    assert(x.status === 200, `${id} must succeed; got ${x.status}`);
    byNode.set(node, [...(byNode.get(node) || []), { from, to }]);
  }
  for (const [node, moves] of byNode) {
    const kept = C.node(before, node).labels.includes('NostrUser') ? 'beside' : null;
    let links = into(before, node);
    let tags = tagSet(before, node);
    const own = tagSet(before, node).some((t) => t.startsWith('json:')) && C.node(before, node).props.pubkey === ME.TA && !kept && node !== k.fwNumber;
    for (const { from, to } of moves) {
      links = links.filter((x) => x !== from);
      if (!links.includes(to)) links.push(to);
      if (own) {
        tags = tags.filter((t) => t !== `n:${uuidOf(before, from)}`);
        if (!superset(to) && !tags.includes(`n:${uuidOf(before, to)}`)) tags.push(`n:${uuidOf(before, to)}`);
      }
    }
    const name = C.node(before, node).props.name || node;
    assert(show(into(g, node)) === show(links.sort()), `${name}: its links are what its moves leave, the others as they were; got ${show(into(g, node))}, expected ${show(links)}`);
    assert(show(tagSet(g, node)) === show(tags.sort()), `${name}: its tags change only in n, and only for the instance's own node (Decision 9); got ${show(tagSet(g, node))}, expected ${show(tags)}`);
    assert(show(jsonValues(g, node)) === show(jsonValues(before, node)) && same(nodeByKey(g, node).props, nodeByKey(before, node).props), `${name}: its JSON (sections, wordTypes) and node properties (tapestryOwnSections, marks) are as they were (AC1)`);
  }
});

test('ME18 [AC1, AC7]: nothing is signed; an admin\'s move is the admin\'s; the command moves too, recorded as the command\'s', async () => {
  const ad = await ok('admin');
  const { a, k } = await main();
  assert(ad.outcome === 'moved' && show(ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the admin's move is recorded as the admin's; got ${show(ad.change && ad.change.by)}`);
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key; the spy saw ${show(a.spy)}`);
  const c = a.cmd('cli');
  assert(c.code === 0, `tapestry graph move-element exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.success === true && body.data.outcome === 'moved' && show(body.data.change.by) === show({ role: 'local', pubkey: null }) && body.data.change.operation === 'graph move-element',
    `the command answers as the route does, its entry naming the command as who made it (AC7); got ${show(body).slice(0, 300)}`);
  assert(show(into(await graph(), k.cliFiler)) === show([k.showBeagles]), 'and the command\'s move is made');
});

test('ME19 [AC7, Decisions 1 and 14]: listed as a write for the owner and admins, with no guard, repeatKey [node, from, to], its three inputs and every refusal in order; /docs has it', async () => {
  needDecl();
  const { a } = await main();
  const e = ((a.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'move-element');
  assert(e, `graph move-element is listed; problems: ${show((a.req('list').body.data || {}).problems)}`);
  assert(e.kind === 'write' && e.access === 'owner-and-admins' && show(e.guards) === show([]) && show(e.repeatKey) === show(['node', 'from', 'to']),
    `a write for the owner and admins, no guard (Decision 7), repeatKey [node, from, to]; got ${show({ kind: e.kind, access: e.access, guards: e.guards, repeatKey: e.repeatKey })}`);
  const ins = e.inputs || {};
  assert(show(Object.keys(ins).sort()) === show(['from', 'node', 'to']) && ['node', 'from', 'to'].every((n) => ins[n].required === true), `node, from and to, each required, and nothing else; got ${show(ins)}`);
  const listed = (e.refusals || []).map((x) => [x.code, x.status]);
  const mine = listed.filter(([code]) => REFUSALS.some(([c]) => c === code));
  assert(show(mine) === show(REFUSALS), `Decision 14's refusals, with their statuses, in the order they are checked; got ${show(mine)}`);
  for (const code of ['missing-input', 'invalid-input', 'unknown-input', 'wrong-content-type', 'sign-in-required', 'not-allowed']) assert(listed.some(([c]) => c === code), `its refusals include ${code}; got ${show(listed.map(([c]) => c))}`);
  assert(/reinstall/i.test(String(e.description || '')), `its description says what a reinstall does to a superset's link (Decision 1); got ${show(e.description).slice(0, 400)}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('move-element-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

// ── Decision 3: the lock, and one write ──
test('ME20 [AC1, AC2, Decision 3]: the node\'s lock comes before any read, and no other is taken; one write holds the delete, the MERGE and the entry; a repeat writes only its lock', async () => {
  needDecl();
  const { file, k } = await fresh();
  const from = S.readState(file).log.length;
  const { a } = runOn(file, [mv('first', k.filer, k.beagleSuperset, k.showBeagles), mv('again', k.filer, k.beagleSuperset, k.showBeagles)]);
  assert(a.req('first').status === 200 && a.req('first').body.data.outcome === 'moved' && a.req('again').body.data.outcome === 'already-moved',
    `the path under test ran: moved, then already-moved; got ${show(['first', 'again'].map((id) => a.req(id).body)).slice(0, 400)}`);
  const txns = transactions(S.readState(file).log, from);
  assert(txns.length === 2 && txns.every((t) => t.end === 'commit'), `one committed transaction for each call; got ${show(txns.map((t) => t.end))}`);
  for (const [t, id] of [[txns[0], 'first'], [txns[1], 'again']]) {
    const two = t.steps.slice(0, 2);
    assert(two.length === 2 && two.every((x) => x.call === 'tx.run' && x.kind === 'copies' && show(x.keys) === show([k.filer])), `${id}: its first two statements set and clear the lock on the node, before any read (Decision 3); got ${show(t.steps.slice(0, 3))}`);
    const locks = t.steps.filter((x) => x.call === 'tx.run' && x.kind === 'copies');
    assert(locks.length === 2, `${id}: no other lock: not the concept's header, not from, not to (Decision 3); got ${show(locks)}`);
  }
  const kinds = txns[0].steps.filter((x) => x.call === 'tx.run').map((x) => x.kind);
  assert(kinds.includes('delete') && kinds.includes('merge') && kinds.includes('create'), `the delete of from's link, the MERGE of to's and the entry are one transaction: no reader sees the node in both or in neither (AC1); got ${show(kinds)}`);
  assert(txns[1].steps.filter((x) => x.call === 'tx.run').length === 2, `the repeat writes nothing but its lock; got ${show(txns[1].steps.filter((x) => x.call === 'tx.run'))}`);
});

// ── AC2: two at once, and another write meanwhile ──
const metAt = (s, from, at) => transactions(s.log, from).some((t) => t.steps.some((st) => st.call === 'meanwhile' && st.at === at));
/** A move on a fresh seed while `otherRequests`, run alone on a copy first, commit as it waits for `node`'s lock. */
async function race(name, otherRequests, request, node) {
  needDecl();
  const { file, k } = await fresh();
  const other = copyOf(file, `${name}-other`);
  const o = runOn(other, otherRequests(k)).a;
  for (const q of otherRequests(k)) assert(o.req(q.id).status === 200, `the other write ${q.id} must succeed alone first; got ${o.req(q.id).status} ${show(o.req(q.id).body).slice(0, 300)}`);
  meanwhileAt(file, node(k), other);
  const from = S.readState(file).log.length;
  const { a } = runOn(file, [request(k)]);
  return { k, a, file, other, from, s: S.readState(file), o: S.readState(other) };
}

test('ME21 [AC2, Decision 3]: two moves of one node with the same to, at once, make one move: the second waits for the node and answers already-moved', async () => {
  const r = await race('same-to', (k) => [mv('first', k.filer, k.beagleSuperset, k.showBeagles)], (k) => mv('second', k.filer, k.beagleSuperset, k.showBeagles), (k) => k.filer);
  const x = r.a.req('second');
  assert(x.status === 200 && x.body.data.outcome === 'already-moved' && x.body.data.change === null, `the second reads what the first committed: already-moved, with no entry (AC2); got ${x.status} ${show(x.body).slice(0, 400)}`);
  assert(metAt(r.s, r.from, r.k.filer), `the second waited for the node's lock (failures.meanwhile fired in its transaction); the log: ${show(transactions(r.s.log, r.from).map((t) => t.steps.map((st) => st.call === 'tx.run' ? st.kind : st.call)))}`);
  assert(same(graphOf(r.s), graphOf(r.o)) && entriesNaming(r.s, r.k.filer).length === 1, 'the graph is what the first move alone left: one move, one entry');
});

test('ME22 [AC2, Decision 3]: two moves of one node with different tos, at once: the second is refused not-in-from, naming the set the first moved it to', async () => {
  const r = await race('other-to', (k) => [mv('first', k.filer, k.beagleSuperset, k.showBeagles)], (k) => mv('second', k.filer, k.beagleSuperset, k.agilityBeagles), (k) => k.filer);
  const x = r.a.req('second');
  assert(x.status === 409 && x.body.code === 'not-in-from' && x.body.input === 'from' && err(x.body).includes(r.k.showBeagles), `not-in-from, naming from and show beagles, where the node now is (AC2, Decision 5); got ${x.status} ${show(x.body).slice(0, 500)}`);
  assert(metAt(r.s, r.from, r.k.filer), 'the second waited for the node\'s lock');
  assert(same(graphOf(r.s), graphOf(r.o)), 'and the graph is what the first move alone left');
});

test('ME23 [AC2, Decision 3]: a move beside a remove-from-concept of the node goes after it: Two Home, taken out of beagle meanwhile, is refused not-in-from, as no element of beagle', async () => {
  const r = await race('beside-remove', (k) => [{ id: 'remove', method: 'POST', url: '/api/tapestry/graph/remove-from-concept', caller: 'owner', body: { node: k.twoHome, concept: k.beagle } }],
    (k) => mv('move', k.twoHome, k.beagleSuperset, k.showBeagles), (k) => k.twoHome);
  const x = r.a.req('move');
  assert(x.status === 409 && x.body.code === 'not-in-from' && x.body.input === 'from' && /add-to-concept/.test(err(x.body)) && has(err(x.body), r.k.beagle, r.k.showBeagles),
    `not-in-from: the node is no longer an element of beagle, so the refusal names graph add-to-concept with beagle and set show beagles (Decision 5); got ${x.status} ${show(x.body).slice(0, 500)}`);
  assert(metAt(r.s, r.from, r.k.twoHome), 'the move waited for the node\'s lock, which remove-from-concept takes first too');
  assert(same(graphOf(r.s), graphOf(r.o)), 'and the graph is what the removal alone left');
});

test('ME24 [AC2, Decision 8]: another write took from\'s link out before the move\'s delete: already-moved when to now holds the node, else not-in-from saying so; nothing of the move\'s is written', async () => {
  needDecl();
  const drop = (k) => ({ type: HAS_ELEMENT, from: k.beagleSuperset, to: k.filer });
  const one = await fresh((s, k) => { s.failures = { beforeRelDelete: { drop: [drop(k)], add: [{ type: HAS_ELEMENT, from: k.showBeagles, to: k.filer }] } }; });
  const before1 = S.readState(one.file);
  const from1 = before1.log.length;
  const x = runOn(one.file, [mv('moved-meanwhile', one.k.filer, one.k.beagleSuperset, one.k.showBeagles)]).a.req('moved-meanwhile');
  const s1 = S.readState(one.file);
  assert(transactions(s1.log, from1).some((t) => t.steps.some((st) => st.call === 'beforeRelDelete')), `the path under test ran: the move reached its delete (failures.beforeRelDelete fired); got ${x.status} ${show(x.body).slice(0, 300)}`);
  assert(x.status === 200 && x.body.data.outcome === 'already-moved' && x.body.data.change === null, `to holds the node now: already-moved, recording nothing (Decision 8); got ${x.status} ${show(x.body).slice(0, 400)}`);
  assert(show(into(s1, one.k.filer)) === show([one.k.showBeagles]) && show(tagSet(s1, one.k.filer)) === show(tagSet(before1, one.k.filer)) && entriesNaming(s1, one.k.filer).length === 0,
    `one link, the other write's; no n added, no entry; got ${show({ links: into(s1, one.k.filer), tags: tagSet(s1, one.k.filer) })}`);

  const two = await fresh((s, k) => { s.failures = { beforeRelDelete: { drop: [drop(k)] } }; });
  const before2 = S.readState(two.file);
  const from2 = before2.log.length;
  const y = runOn(two.file, [mv('taken-meanwhile', two.k.filer, two.k.beagleSuperset, two.k.showBeagles)]).a.req('taken-meanwhile');
  const s2 = S.readState(two.file);
  assert(transactions(s2.log, from2).some((t) => t.steps.some((st) => st.call === 'beforeRelDelete')), 'the path under test ran: the move reached its delete');
  assert(y.status === 409 && y.body.code === 'not-in-from' && y.body.input === 'from' && /another write/i.test(err(y.body)) && /while/i.test(err(y.body)),
    `not-in-from, saying another write took the node out of from while this call ran (Decision 8); got ${y.status} ${show(y.body).slice(0, 500)}`);
  assert(show(into(s2, two.k.filer)) === show([]) && show(tagSet(s2, two.k.filer)) === show(tagSet(before2, two.k.filer)) && entriesNaming(s2, two.k.filer).length === 0,
    `nothing of the move's: no link to show beagles, no n, no entry (the other write's removal stays); got ${show({ links: into(s2, two.k.filer), tags: tagSet(s2, two.k.filer) })}`);
});

// ── what fails whole ──
test('ME25: a move whose entry can\'t be recorded keeps nothing', async () => {
  needDecl();
  const { file, k } = await fresh((s) => { s.failures = { entry: true }; });
  const before = S.readState(file);
  const { a } = runOn(file, [mv('fail', k.filer, k.beagleSuperset, k.showBeagles)]);
  assert(a.req('fail').status === 500, `the write fails; got ${a.req('fail').status} ${show(a.req('fail').body).slice(0, 300)}`);
  const s = S.readState(file);
  assert(same(graphOf(s), graphOf(before)), 'and keeps neither link change nor the n');
});

test('ME26 [Decision 3]: a move whose node a delete removed while it waited answers unknown-node, never a 500', async () => {
  needDecl();
  const { file, k } = await fresh((s, keys) => { s.failures = { vanish: { key: keys.filer } }; });
  const x = runOn(file, [mv('vanished', k.filer, k.beagleSuperset, k.showBeagles)]).a.req('vanished');
  assert(x.status === 404 && x.body.code === 'unknown-node' && x.body.input === 'node', `unknown-node, naming node, from its second try; got ${x.status} ${show(x.body).slice(0, 300)}`);
});

test('ME27 [Decision 9]: a tag of the node with no tapestryKey fails the write, saying to run lifecycle migrate, and nothing changes', async () => {
  needDecl();
  const { file, k } = await fresh();
  const before = S.readState(file);
  const x = runOn(file, [mv('unkeyed', k.unkeyedN, k.showBeagles, k.agilityBeagles)]).a.req('unkeyed');
  assert(x.status === 500 && /lifecycle migrate/.test(err(x.body)), `the n naming show beagles has no tapestryKey, so it can't be taken out: 500, saying to run lifecycle migrate first; got ${x.status} ${show(x.body).slice(0, 300)}`);
  assert(same(graphOf(S.readState(file)), graphOf(before)), 'and the move is rolled back whole');
});

// ── REF: every refusal, over a graph that must end as it began ──
let REF = null;
function ref() {
  if (REF) return REF;
  REF = (async () => {
    const { file, k } = await fresh();
    const before = S.readState(file);
    const body = { node: k.filer, from: k.beagleSuperset, to: k.showBeagles };
    const { a } = runOn(file, [
      post('visitor', 'visitor', body),
      post('stranger', 'stranger', body),
      post('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify(body) }),
      // same-set, before anything that reads the graph
      mv('same', k.filer, k.beagleSuperset, k.beagleSuperset),
      mv('same-first', NOBODY, k.showBeagles, k.showBeagles),
      // the inputs that name no node
      mv('u-node', NOBODY, k.beagleSuperset, k.showBeagles),
      mv('u-entry', k.G, k.beagleSuperset, k.showBeagles),
      mv('u-from', k.filer, NOBODY, k.showBeagles),
      mv('u-to', k.filer, k.beagleSuperset, NOBODY),
      mv('u-node-first', NOBODY, NOSET, k.showBeagles),
      mv('u-from-first', k.filer, NOBODY, NOSET),
      // the node
      mv('tag', k.luckyJsonTag, k.showBeagles, k.agilityBeagles),
      mv('men-header', k.beagle, k.beagleSuperset, k.showBeagles),
      mv('men-superset', k.beagleSuperset, k.beagleSuperset, k.showBeagles),
      mv('men-schema', k.beagleNodes.jsonSchema, k.beagleSuperset, k.showBeagles),
      mv('men-property', k.propertyNode, k.beagleSuperset, k.showBeagles),
      mv('men-set', k.walkers, k.beagleSuperset, k.showBeagles),
      mv('men-set-label', k.agilityBeagles, k.beagleSuperset, k.showBeagles),
      mv('men-rule', k.ruleElement, k.beagleSuperset, k.showBeagles),
      // from and to
      mv('nas-from', k.filer, k.rover, k.showBeagles),
      mv('nas-from-header', k.filer, k.beagle, k.showBeagles),
      mv('nas-to', k.filer, k.beagleSuperset, k.rover),
      mv('nas-to-header', k.filer, k.beagleSuperset, k.pet),
      mv('nas-card', k.filer, k.beagleSuperset, k.cardSet),
      // two sets of one concept
      mv('dc', k.filer, k.beagleSuperset, k.lapPets),
      mv('dc-word', k.inCommon, k.commonSet, k.petWords),
      mv('dc-word-from', k.wordOnly, k.supersets.word, k.showBeagles),
      mv('dc-context', k.filer, k.beagleSuperset, k.contextOnly),
      mv('dc-first', k.lucky, k.lapPets, k.showBeagles),
      // where the node is
      mv('nif-other-set', k.hopper, k.agilityBeagles, k.beagleSuperset),
      mv('nif-superset', k.lucky, k.beagleSuperset, k.agilityBeagles),
      mv('nif-below', k.deepNode, k.showBeagles, k.agilityBeagles),
      mv('nif-not-element', k.whiskers, k.beagleSuperset, k.showBeagles),
      // whose claim from's link is
      mv('fw-manifest', k.fwInteger, k.numericTypes, k.jsonDataTypeSuperset),
      mv('fw-file', k.fwString, k.numericPets, k.lapPets),
      mv('claim-n', k.peerInSet, k.showBeagles, k.agilityBeagles),
      mv('claim-z', k.peerShared, k.sharedSet, k.lapPets),
      // the node's concepts
      mv('leaves', k.sharedOwn, k.sharedSet, k.lapPets),
      mv('leaves-first', k.sharedOwn, k.sharedSet, k.walkers),
      mv('joins', k.lapOnly, k.lapPets, k.sharedSet),
      // the inputs
      post('i-missing', 'owner', {}),
      post('i-type', 'owner', { node: 5, from: k.beagleSuperset, to: k.showBeagles }),
      post('i-unknown', 'owner', { ...body, concept: k.beagle }),
      // the reserved type's words (Decision 15)
      { id: 'reserved-type', method: 'POST', url: '/api/tapestry/graph/add-relationship', caller: 'owner', body: { from: k.beagleSuperset, to: k.lucky, type: HAS_ELEMENT } },
    ], {
      spy: true,
      cli: [{ id: 'cli-refused', argv: ['graph', 'move-element', '--node', k.filer, '--from', k.beagleSuperset, '--to', k.lapPets] }],
    });
    return { a, k, file, before };
  })();
  return REF;
}
async function refused(id, status, code, input) {
  needDecl();
  const x = (await ref()).a.req(id);
  assert(x.status === status && x.body.code === code, `${id} must be refused ${status} ${code}; got ${x.status} ${show(x.body).slice(0, 600)}`);
  if (input !== undefined) assert(x.body.input === input, `${id}: ${code} names the input ${input}; got ${show(x.body).slice(0, 400)}`);
  return x.body;
}

test('ME30 [AC7]: a visitor gets 401, a stranger 403, a text/plain body 415; the command\'s refusal is the route\'s', async () => {
  needDecl();
  const { a } = await ref();
  const [v, s, t] = ['visitor', 'stranger', 'text'].map((id) => a.req(id));
  assert(v.status === 401 && s.status === 403 && t.status === 415, `401, 403 and 415; got ${v.status} ${s.status} ${t.status}`);
  const c = a.cmd('cli-refused');
  assert(c.code === 1, `a refused command exits 1; got ${c.code} ${c.stdout} ${c.stderr}`);
  const rb = JSON.parse(c.stdout);
  const route = a.req('dc').body;
  assert(rb.code === 'different-concepts' && rb.code === route.code && rb.error === route.error && rb.input === route.input, `the command's refusal is the route's; command ${show(rb)}, route ${show(route)}`);
});

test('ME31 [AC5, open question 2]: a to that is from is refused same-set, naming to, before anything that reads the graph', async () => {
  await refused('same', 400, 'same-set', 'to');
  await refused('same-first', 400, 'same-set', 'to');
});

test('ME32 [AC5]: a node, from or to that names no node is refused unknown-node, naming the first such input of node, from and to; a change entry is no node', async () => {
  for (const [id, input] of [['u-node', 'node'], ['u-entry', 'node'], ['u-from', 'from'], ['u-to', 'to'], ['u-node-first', 'node'], ['u-from-first', 'from']]) await refused(id, 404, 'unknown-node', input);
});

test('ME33 [AC5]: a tag is refused tag-node, naming node', async () => {
  await refused('tag', 409, 'tag-node', 'node');
});

test('ME34 [AC5]: a node another operation looks after is refused made-elsewhere, naming node and the operation: link-set and unlink-set for a set or a superset', async () => {
  const want = { 'men-header': /update-concept/, 'men-superset': /link-set/, 'men-schema': /set-schema/, 'men-property': /update-property/, 'men-set': /link-set/, 'men-set-label': /link-set/, 'men-rule': /rulebook/ };
  for (const [id, op] of Object.entries(want)) {
    const body = await refused(id, 409, 'made-elsewhere', 'node');
    assert(op.test(err(body)), `${id}: names the operation (${op}); got ${err(body)}`);
  }
});

test('ME35 [AC5]: a from or to that is neither a set nor a superset is refused not-a-set, naming it; for a concept header, its superset\'s tapestryKey', async () => {
  const { k } = await ref();
  await refused('nas-from', 409, 'not-a-set', 'from');
  assert(err(await refused('nas-from-header', 409, 'not-a-set', 'from')).includes(k.beagleSuperset), "beagle's header as from: the refusal names beagle's superset's key, the key to pass");
  await refused('nas-to', 409, 'not-a-set', 'to');
  assert(err(await refused('nas-to-header', 409, 'not-a-set', 'to')).includes(k.petSuperset), "pet's header as to: the refusal names pet's superset's key");
  await refused('nas-card', 409, 'not-a-set', 'to');
});

test('ME36 [AC3]: sets no concept but word has both of are refused different-concepts, naming to, each set\'s concepts, and the way on: add-to-concept, then remove-from-concept', async () => {
  const { k } = await ref();
  const dc = err(await refused('dc', 409, 'different-concepts', 'to'));
  assert(has(dc, k.filer, k.pet, k.lapPets, k.beagle, k.beagleSuperset), `it names beagle and pet, and gives the way on's inputs as tapestryKeys: the node, pet and lap pets, beagle and its superset (Decision 4); got ${dc}`);
  assert(/add-to-concept/.test(dc) && /remove-from-concept/.test(dc) && dc.indexOf('add-to-concept') < dc.indexOf('remove-from-concept'), `add the node to pet first, then take it out of beagle; got ${dc}`);
  const word = err(await refused('dc-word', 409, 'different-concepts', 'to'));
  assert(has(word, k.pet, k.petWords) && /add-to-concept/.test(word), `commonSet and pet words share word alone, which never counts (AC3); got ${word}`);
  const wordFrom = err(await refused('dc-word-from', 409, 'different-concepts', 'to'));
  assert(/word/.test(wordFrom) && /add-to-concept/.test(wordFrom) && !/remove-from-concept/.test(wordFrom), `from is in no concept's class thread but word's: it says so, and leaves out the step remove-from-concept would refuse (Decision 4); got ${wordFrom}`);
  await refused('dc-context', 409, 'different-concepts', 'to');
  await refused('dc-first', 409, 'different-concepts', 'to');
});

test('ME37 [AC5, open question 2]: a node from doesn\'t hold directly, when to doesn\'t either, is refused not-in-from, naming from and the sets that hold it; or, in none, add-to-concept', async () => {
  const { k } = await ref();
  assert(err(await refused('nif-other-set', 409, 'not-in-from', 'from')).includes(k.showBeagles), 'Hopper is in show beagles, not agility beagles: the refusal names show beagles');
  assert(err(await refused('nif-superset', 409, 'not-in-from', 'from')).includes(k.showBeagles), "Lucky is in show beagles, under the superset named: from reaches it only through a set, which the refusal names");
  assert(err(await refused('nif-below', 409, 'not-in-from', 'from')).includes(k.championBeagles), 'Deep Node is in champion beagles, below show beagles: the refusal names champion beagles');
  const none = err(await refused('nif-not-element', 409, 'not-in-from', 'from'));
  assert(/add-to-concept/.test(none) && has(none, k.whiskers, k.beagle, k.showBeagles), `Whiskers is no element of beagle: the refusal names graph add-to-concept with the node, beagle and set show beagles; got ${none}`);
});

test('ME38 [AC5, open question 3]: a link from from that firmware\'s definition makes is refused firmware-membership: a manifest\'s edge, and an element file\'s concept a move would leave, before leaves-concept', async () => {
  const edge = err(await refused('fw-manifest', 409, 'firmware-membership', 'node'));
  assert(/manifest/.test(edge) && /json-data-type/.test(edge), `fwInteger is in the numeric set by json-data-type's manifest edge: named; got ${edge}`);
  const file = err(await refused('fw-file', 409, 'firmware-membership', 'node'));
  assert(file.includes('string.json'), `fwString would leave json-data-type, the concept its element file ${ME.FW_STRING_FILE} puts it in: the claim is refused first (Decision 7, the order); got ${file}`);
});

test('ME39 [AC5, open question 3, Decision 6]: a link another author\'s letter claims is refused author-claim, naming their key and the tag, what makes it again, and that each point of view decides', async () => {
  const { k, before } = await ref();
  const n = err(await refused('claim-n', 409, 'author-claim', 'node'));
  assert(has(n, OTHER, uuidOf(before, k.showBeagles)) && /pull/i.test(n), `their n names show beagles: refused, naming their key and the tag, and the next pull of their class thread, which makes it again; got ${n}`);
  const z = err(await refused('claim-z', 409, 'author-claim', 'node'));
  assert(has(z, OTHER, uuidOf(before, k.gadget)) && /reinstall/i.test(z), `their z names gadget, which the move would leave: refused before leaves-concept, naming a reinstall, which makes it again; got ${z}`);
  for (const text of [n, z]) assert(/point of view/i.test(text), `whether the claim counts is each point of view's call (D4); got ${text}`);
});

test('ME40 [AC4]: a move that would take the node out of a concept is refused leaves-concept, naming from, the concept and the way on; before joins-concept', async () => {
  const { k } = await ref();
  const left = err(await refused('leaves', 409, 'leaves-concept', 'from'));
  assert(has(left, k.sharedOwn, k.gadget, k.pet, k.lapPets) && /add-to-concept/.test(left) && /remove-from-concept/.test(left), `sharedSet is in gadget's class thread and lap pets isn't: refused, naming gadget, and the way on with pet, set lap pets and gadget as keys (Decision 7); got ${left}`);
  await refused('leaves-first', 409, 'leaves-concept', 'from');
});

test('ME41 [AC4]: a move that would put the node into a concept it isn\'t in is refused joins-concept, naming to, the concept and the way on', async () => {
  const { k } = await ref();
  const joined = err(await refused('joins', 409, 'joins-concept', 'to'));
  assert(has(joined, k.lapOnly, k.gadget, k.sharedSet) && /add-to-concept/.test(joined) && /again/i.test(joined), `sharedSet is also gadget's: refused, naming gadget, and the way on: add the node to gadget with set sharedSet and its fields, then this call again (Decision 7); got ${joined}`);
});

test('ME42: inputs are checked: missing, the wrong type, unknown (move-element takes no concept)', async () => {
  needDecl();
  const { a } = await ref();
  for (const [id, code] of [['i-missing', 'missing-input'], ['i-type', 'invalid-input'], ['i-unknown', 'unknown-input']]) {
    const x = a.req(id);
    assert(x.status === 400 && x.body.code === code, `${id}: 400 ${code}; got ${x.status} ${show(x.body)}`);
  }
});

test('ME43 [AC3, AC4, AC5]: the refusal run changed nothing, recorded nothing and signed nothing', async () => {
  await refused('dc', 409, 'different-concepts');
  await refused('leaves', 409, 'leaves-concept');
  const { file, before, a } = await ref();
  const s = S.readState(file);
  assert(entriesIn(s).length === entriesIn(before).length, `no change entry was recorded; ${entriesIn(before).length} before, ${entriesIn(s).length} after`);
  assert(same(graphOf(s), graphOf(before)), 'the graph is as it was');
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signed; the spy saw ${show(a.spy)}`);
});

test('ME44 [AC5, Decision 2]: with no assistant key a move is refused not-installed, and nothing changes; same-set still answers first', async () => {
  needDecl();
  const { file, k } = await fresh();
  const before = S.readState(file);
  const { a } = runOn(file, [mv('ni', k.filer, k.beagleSuperset, k.showBeagles), mv('ni-same', k.filer, k.beagleSuperset, k.beagleSuperset)], { env: (dir) => { const env = S.childEnv(dir); delete env.TA_PUBKEY; return env; } });
  const x = a.req('ni');
  assert(x.status === 409 && x.body.code === 'not-installed', `409 not-installed; got ${x.status} ${show(x.body)}`);
  const y = a.req('ni-same');
  assert(y.status === 400 && y.body.code === 'same-set', `same-set needs no graph, so it answers before not-installed; got ${y.status} ${show(y.body)}`);
  assert(same(graphOf(S.readState(file)), graphOf(before)), 'and nothing changes');
});

test('ME45 [Decision 15]: add-relationship\'s refusal of HAS_ELEMENT names graph move-element among the operations that make and take it out', async () => {
  needDecl();
  const x = (await ref()).a.req('reserved-type');
  assert(x.status === 409 && x.body.code === 'reserved-type' && x.body.rule === 'relationship-type-allowed', `HAS_ELEMENT is still reserved; got ${x.status} ${show(x.body).slice(0, 300)}`);
  for (const op of ['add-to-concept', 'remove-from-concept', 'move-element', 'create-element']) assert(err(x.body).includes(op), `the reserved-type message names graph ${op}; got ${err(x.body)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
