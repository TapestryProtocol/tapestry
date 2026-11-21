'use strict';
/**
 * export nostr — publishing a scope, and recording what was sent. Run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/34-export-nostr.md (AC1, AC5)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0034-export-nostr.md (Decisions 2, 5, 6 and 8;
 *          amendments 4 and 5)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/34-export-nostr.test-plan.md (the sending classes table)
 *
 * Stack-free: the real catalog over test/helpers/exportFixtures.js's world on the Cypher engine, the fake relays and DNS
 * and the fake strfry import of test/helpers/relayFake.js, the assistant's key through the harness's assistantKeys hook,
 * and the spy on. The chain is one graph and one relay fixture, run after run, as an owner would: A1 exports pet's
 * concept graph to the instance's own relay, with _send.js's now() set ahead of time (exportTiming.NOW); A2 makes the
 * same call; graph update-node then changes Tom; A3 dry-runs the export; A4 exports; A5 exports to an outside relay
 * too; A6 does that again.
 *
 *   ES1  (AC1) the first export: each of the scope's 20 letters new, signed by the assistant (verifies, its pubkey the
 *        child's TA_PUBKEY), put into the own relay through the strfry import seam and read back by id, accepted; each
 *        node then holds its letter's id and created_at and sentTo ['own'], with no NostrEvent label added and no tag,
 *        label or relationship changed; one change entry, export nostr, a letter-sent change for each letter (node,
 *        address, kind, was null, now, relays), which graph history finds by each node
 *   ES2  (AC1, AC4) scopes: a node by its key and by its address; a concept graph; a Tapestry, bringing its concept
 *        graphs' scopes, each node once; a selection saved with graph create-element, by its name; an empty graph, its
 *        one letter; everything, every own node of kind 39998 or 39999 with an address; and no scope counts a person
 *        node, a tag node, a placeholder or a change entry. everything over a graph with no own nodes answers none, and
 *        records nothing
 *   ES3  (AC1, Decision 6) four outside relays: one accepts, one refuses with its reason, one never answers (timeout),
 *        one can't be reached (unreachable); sentTo lists own and the one that accepted
 *   ES4  (AC5) the dry run: each node's outcome, the changed one's added and removed tags, the reports before the
 *        letters, and nothing signed, sent or recorded
 *   ES5  (AC5) the same call again with nothing changed: every letter unchanged; nothing signed, sent or recorded
 *   ES6  (AC5, Decision 5) graph update-node changes Tom, which answers letterOutOfDate: a dry run lists only Tom
 *        changed; the export signs only Tom, created_at one second after his last letter's, which is ahead of now; the
 *        first export's letters started from _send.js's now()
 *   ES7  (AC5, Decision 6) an unchanged letter is sent as it was signed, the same id, to a relay named now that isn't in
 *        its sentTo; the own relay, which has it, answers held; sentTo gains the new relay; the same call again: held
 *        on both, nothing published
 *   ES8  (AC5 and Decision 2, as amended at Review: Amendment 2 item 2; changed at review round 1) order: by kind of
 *        node first, concept headers, supersets, sets, the rest; within a kind, each after the letters of that kind it
 *        names, and letters of one kind that name each other by tapestryKey; so pet's header goes before all its core
 *        nodes and elements, and a graph after the nodes it lists
 *   ES9  (AC5, amendment 5) paging, with MAX_SCOPE and MAX_SEND shrunk: next.after, each call going on where the last
 *        stopped, and together each letter signed and accepted once
 *   ES10 (Decision 6) time, with SEND_CUTOFF_MS shrunk and a slow relay: letters not sent in time answer not-sent, with
 *        next.after
 *   The sending classes (Decision 6; amendment 4):
 *   ES11 strfry import runs and the read-back finds the letter: own accepted, sent out, recorded
 *   ES12 the read-back answers without it: own refused, not-sent out, not recorded
 *   ES13 the read-back doesn't answer: own unread, not-sent out, not on its node; (changed at review round 1, Amendment
 *        2 item 1) the call's change entry records each letter, with each relay's answer
 *   ES14 strfry import can't run: every letter unreachable, not-sent out, not recorded; (review round 1, a pin) and no
 *        change entry is written
 *   ES15 BRAINSTORM_PUBLISH_LOCAL_ONLY=true: own accepted, every outside relay not-sent saying why, sentTo ['own']
 *   ES16 a live relay (a ws server in the child, reached through _relay.js's own connect) drops the connection at the
 *        second letter: the rest unreachable or timeout, the first accepted, the own relay as answered, and the
 *        process lives on
 *   Review round 1 (ADR 0034 Amendment 2):
 *   ES17 (item 5, finding 7) a strfry import that never ends (the fake's hang), with BUDGET_MS at 3 s: the call answers
 *        within 3 s and a 5 s margin, each letter unread, refused or unreachable as the read-back decides, none on its
 *        node, none sent out
 *   ES18 (item 1, a pin) two exports of a node race, and the other records first, with a newer letter (the graph fake's
 *        meanwhile, just before this call's first write to the node): the node keeps the newer letter, and this call's
 *        change says raced
 *   ES19 (item 1, finding 3) the same with an older letter: the node keeps the newest letter export sent, this call's,
 *        and its change isn't raced
 */

const crypto = require('crypto');
const S = require('../../helpers/graphOpsSuite');
const X = require('../../helpers/exportFixtures');
const F = require('../../helpers/importFixtures');
const R = require('../../helpers/relayFake');
const CG = require('../../helpers/cypherGraphFake');

const { assert } = S;
const show = (x) => String(S.show(x));
const { test, run } = S.makeSuite('operations: export nostr — publishing a scope, and recording what was sent');
const { exp, KEYS, NT } = X;

/** The first export's now(): a time ahead of the clock, so the next version must be dated after it. */
const AHEAD = 1900000000;
const ACCEPTS = X.URL_OF('accepts');
const HEX64 = /^[0-9a-f]{64}$/;
const sorted = (o) => Object.keys(o).sort().reduce((x, k) => { x[k] = o[k]; return x; }, {});
/** A node as an export must leave it, but for its letter: its labels, and its properties less id, created_at and sentTo. */
function kept(n) {
  const { id, created_at: at, sentTo, ...rest } = n.props;
  void id; void at; void sentTo;
  return { labels: [...n.labels].sort(), props: sorted(rest) };
}
function relsAround(s, n) {
  const name = (x) => (x ? x.props.uuid || x.props.pubkey || x.props.id || x.props.tapestryKey : null);
  return F.relsOf(s, {}).filter((r) => (r.from === n.eid || r.to === n.eid) && r.type !== 'HAS_TAG')
    .map((r) => `${r.from === n.eid ? 'out' : 'in'} ${r.type} ${name(r.from === n.eid ? r.toNode : r.fromNode)}`).sort();
}
const statuses = (d, relay) => X.lettersOf(d).map((l) => (X.relayOf(l, relay) || {}).status);

let CHAIN = null;
function chain() {
  if (CHAIN) return CHAIN;
  CHAIN = (async () => {
    X.needDecl();
    const w = await X.world();
    const k = w.keys;
    const scope = X.petScope(k);
    const base = { ownEvents: w.ownEvents, lmdb: w.lmdb };
    const before = X.copy(w.state);
    // Each run's graph, store and log as it ended: a later run replaces versions in the store and adds to the log.
    const ended = (r) => Object.assign(r, { ended: { state: r.state(), store: r.store(), accepts: r.store(ACCEPTS) } });
    const sliceSince = (r, mark) => Object.assign(r, { mine: R.readLog(r.fixture).slice(mark) });
    const a1 = ended(sliceSince(X.runExport({ ...base, state: before, relays: { [ACCEPTS]: F.relay([]) }, exportTiming: { NOW: AHEAD }, label: 'export-nostr-chain', requests: [exp('a1', 'owner', { graph: k.petConceptGraph }), ...scope.map((key, i) => X.history(`h${i}`, `node=${key}`))] }), 0));
    const afterA1 = a1.ended.state;
    const again = { ...base, file: a1.file, fixture: a1.fixture, relays: { [ACCEPTS]: F.relay([]) } };
    const step = (opts) => { const mark = R.readLog(a1.fixture).length; return ended(sliceSince(X.runExport({ ...again, ...opts }), mark)); };
    const a2 = step({ exportTiming: { NOW: AHEAD }, requests: [exp('a2', 'owner', { graph: k.petConceptGraph })] });
    const edit = X.runOps(a1.file, [X.op('naps', 'update-node', { node: k.tom, concept: k.petHeader, fields: { description: `a cat, who follows [Rex](tapestry:${k.rex}) about, and naps` } })]);
    const edited = X.data(edit, 'naps');
    const afterEdit = CG.readState(a1.file);
    const a3 = step({ requests: [exp('a3', 'owner', { graph: k.petConceptGraph, dryRun: true })] });
    const a4 = step({ requests: [exp('a4', 'owner', { graph: k.petConceptGraph })] });
    const a5 = step({ requests: [exp('a5', 'owner', { graph: k.petConceptGraph, relays: [ACCEPTS] })] });
    const a6 = step({ requests: [exp('a6', 'owner', { graph: k.petConceptGraph, relays: [ACCEPTS] })] });
    return {
      w, k, scope, before, a1, afterA1, a2, afterA2: a2.ended.state, edited, afterEdit, a3, afterA3: a3.ended.state, a4, afterA4: a4.ended.state,
      a5, afterA5: a5.ended.state, a6, afterA6: a6.ended.state,
    };
  })();
  return CHAIN;
}

test('ES1 [AC1, Decisions 6 and 8]: the first export signs each letter as the assistant, sends it to the own relay, reads it back, and records it on its node, in one change entry', async () => {
  const { a1, before, afterA1, scope, k } = await chain();
  const d = X.data(a1, 'a1');
  const letters = X.lettersOf(d);
  assert(X.sameSet(letters.map(X.keyOf), scope), `one letter for each of the scope's 20 nodes; got ${show(letters.map((l) => [X.keyOf(l), l.outcome]))}`);
  assert(letters.every((l) => l.outcome === 'new' && HEX64.test(String(l.id)) && Number.isInteger(l.kind)), `each new, with its letter's id and kind; got ${show(letters.slice(0, 3))}`);
  assert(X.countOf(d, 'new') === 20, `the counts say 20 new; got ${show(d.counts)}`);
  assert(letters.every((l) => (X.relayOf(l, 'own') || {}).status === 'accepted'), `the own relay accepted each; got ${show(statuses(d, 'own'))}`);
  const held = a1.ended.store;
  const log = a1.mine;
  const imported = log.filter((x) => x.at === 'strfry-import').flatMap((x) => x.ids);
  const lastImport = log.map((x) => x.at).lastIndexOf('strfry-import');
  const readBack = log.slice(lastImport + 1).filter((x) => x.at === 'req' && x.url === R.normalize(X.OWN_RELAY)).flatMap((x) => x.filters.flatMap((f) => f.ids || []));
  for (const l of letters) {
    const n = X.nodeByKey(before, X.keyOf(l));
    const e = held.find((x) => x.id === l.id);
    assert(e && NT.verifyEvent(JSON.parse(JSON.stringify(e))) && e.pubkey === X.TA && e.kind === l.kind && X.addressOf(e) === n.props.uuid, `${n.props.uuid}: its letter is in the own relay, signed by the assistant, at the node's address; got ${show(e).slice(0, 300)}`);
    assert(e.content === '', `${n.props.uuid}: its content is empty`);
    assert(imported.includes(l.id) && readBack.includes(l.id), `${n.props.uuid}: it went through the strfry import seam and was read back by id after it`);
    const now = X.nodeByKey(afterA1, X.keyOf(l));
    assert(now.props.id === l.id && X.plain(now.props.created_at) === e.created_at && JSON.stringify(now.props.sentTo) === JSON.stringify(['own']),
      `${n.props.uuid}: the node holds its letter's id and created_at, and sentTo ['own']; got ${show({ id: now.props.id, created_at: now.props.created_at, sentTo: now.props.sentTo })}`);
    assert(JSON.stringify(kept(n)) === JSON.stringify(kept(now)) && !now.labels.includes('NostrEvent'), `${n.props.uuid}: nothing else on the node changed, and no NostrEvent label was added; before ${show(kept(n))} after ${show(kept(now))}`);
    assert(X.sameTags(X.tagArrays(before, n), X.tagArrays(afterA1, now)), `${n.props.uuid}: its tags are as they were`);
    assert(JSON.stringify(relsAround(before, n)) === JSON.stringify(relsAround(afterA1, now)), `${n.props.uuid}: its relationships are as they were`);
  }
  const fresh = X.exportEntries(afterA1);
  assert(fresh.length === 1 && fresh[0].byRole === 'owner', `one change entry, operation export nostr, the owner's; got ${show(fresh.map((e) => [e.operation, e.byRole]))}`);
  const sent = fresh[0].changes.filter((c) => c.change === 'letter-sent');
  for (const l of letters) {
    const c = sent.find((x) => x.node === X.keyOf(l));
    const n = X.nodeByKey(afterA1, X.keyOf(l));
    assert(c && c.address === n.props.uuid && c.kind === l.kind && c.was === null && c.now && c.now.id === l.id && c.now.created_at === X.plain(n.props.created_at) && Array.isArray(c.relays) && c.relays.some((x) => X.isOwnRelay(x.relay) && x.status === 'accepted'),
      `${n.props.uuid}: a letter-sent change with its node, address, kind, was null, now and each relay's answer; got ${show(c)}`);
  }
  scope.forEach((key, i) => {
    const h = X.data(a1, `h${i}`);
    assert((h.entries || []).some((e) => e.id === fresh[0].tapestryKey || (e.operation === 'export nostr' && e.changes.some((c) => c.node === key))), `graph history finds the entry by ${key}; got ${show((h.entries || []).map((e) => e.operation))}`);
  });
  void k;
});

let SCOPES = null;
function scopes() {
  if (SCOPES) return SCOPES;
  SCOPES = (async () => {
    X.needDecl();
    const w = await X.world();
    const k = w.keys;
    const c = X.runExport({
      state: X.copy(w.state), ownEvents: w.ownEvents, lmdb: w.lmdb, label: 'export-nostr-scopes',
      requests: [
        exp('node-key', 'owner', { node: k.rex, dryRun: true }),
        exp('node-address', 'owner', { node: w.addr.rex, dryRun: true }),
        exp('concept-graph', 'owner', { graph: k.petConceptGraph, dryRun: true }),
        exp('tapestry', 'owner', { graph: k.tapestry, dryRun: true }),
        exp('selection', 'owner', { graph: 'Pet Picks', dryRun: true }),
        exp('empty', 'owner', { graph: k.emptyGraph, dryRun: true }),
        exp('everything', 'owner', { everything: true, dryRun: true }),
      ],
    });
    // A graph with no own nodes: alice's concept, as her letters arrive, and nothing of the instance's.
    const none = F.emptyGraph();
    for (const e of F.conceptLetters(KEYS.alice, 'cat', { at: 1690000700 }).all) F.today(none, e);
    const n = X.runExport({ state: none, label: 'export-nostr-none', requests: [exp('none', 'owner', { everything: true })] });
    return { w, k, c, n, none };
  })();
  return SCOPES;
}

test('ES2 [AC1, AC4, Decision 2]: a node, a concept graph, a Tapestry, a selection, an empty graph and everything each bring what Decision 2 says, and nothing that isn\'t a letter\'s', async () => {
  const { w, k, c, n, none } = await scopes();
  const keysOf = (id) => X.lettersOf(X.data(c, id)).map(X.keyOf);
  const expect = (id, want) => {
    const got = keysOf(id);
    assert(got.length === new Set(got).size, `${id}: each node is answered once; got ${show(got)}`);
    assert(X.sameSet(got, want), `${id}: the scope is ${want.length} nodes; got ${got.length}: missing ${show(want.filter((x) => !got.includes(x)))} extra ${show(got.filter((x) => !want.includes(x)))}`);
  };
  expect('node-key', [k.rex]);
  expect('node-address', [k.rex]);
  expect('concept-graph', X.petScope(k));
  expect('tapestry', [k.tapestry, ...X.petScope(k), ...X.dogScope(k)]);
  expect('selection', [k.picks, k.rex, k.tom]);
  expect('empty', [k.emptyGraph]);
  expect('everything', X.everythingIn(w.state));
  const notLetters = new Set(w.state.nodes.filter((x) => x.labels.includes('NostrUser') || x.labels.includes('NostrEventTag') || x.labels.includes('GraphChange') || F.isPlaceholder(x)).map((x) => x.props.tapestryKey));
  for (const id of ['concept-graph', 'tapestry', 'everything']) assert(!keysOf(id).some((x) => notLetters.has(x)), `${id}: no person node, tag node, placeholder or change entry is in it`);
  assert(!keysOf('everything').includes(k.placeholder), 'the placeholder at one of the assistant\'s addresses is never in a scope');
  const d = X.data(n, 'none');
  assert(X.lettersOf(d).length === 0 && X.exportEntries(n.state()).length === 0 && X.signings(n.spy) === 0, `everything over a graph with no own nodes answers none, records nothing and signs nothing; got ${show(d).slice(0, 300)}`);
  void none;
});

test('ES3 [AC1, Decision 6]: four outside relays: accepted, refused with its reason, timeout and unreachable, each answered so; sentTo lists own and the one that accepted', async () => {
  X.needDecl();
  const w = await X.world();
  const k = w.keys;
  const reason = 'blocked: we take no pets here';
  const relays = {
    [ACCEPTS]: F.relay([]),
    [X.URL_OF('refuses')]: F.relay([], { publish: { mode: 'refuse', reason } }),
    [X.URL_OF('silent')]: F.relay([], { publish: 'timeout' }),
    [X.URL_OF('gone')]: F.relay([], { connect: 'refuse' }),
  };
  const r = X.runExport({ state: X.copy(w.state), ownEvents: w.ownEvents, lmdb: w.lmdb, relays, exportTiming: { OK_MS: 400 }, label: 'export-nostr-relays', requests: [exp('four', 'owner', { graph: k.picks, relays: Object.keys(relays) })] });
  const d = X.data(r, 'four');
  const letters = X.lettersOf(d);
  assert(letters.length === 3, `the selection's three letters; got ${show(letters.map(X.keyOf))}`);
  for (const l of letters) {
    const st = (u) => X.relayOf(l, u) || {};
    assert(st('own').status === 'accepted' && st(ACCEPTS).status === 'accepted', `${X.keyOf(l)}: the own relay and accepts accepted it; got ${show(l.relays)}`);
    assert(st(X.URL_OF('refuses')).status === 'refused' && String(st(X.URL_OF('refuses')).reason).includes(reason), `${X.keyOf(l)}: refuses refused it, with the relay's words; got ${show(st(X.URL_OF('refuses')))}`);
    assert(st(X.URL_OF('silent')).status === 'timeout', `${X.keyOf(l)}: a relay that sends no OK in time is timeout; got ${show(st(X.URL_OF('silent')))}`);
    assert(st(X.URL_OF('gone')).status === 'unreachable', `${X.keyOf(l)}: a relay that can't be reached is unreachable; got ${show(st(X.URL_OF('gone')))}`);
    const sentTo = X.sentToOf(r.state(), X.keyOf(l));
    assert(Array.isArray(sentTo) && X.sameSet(sentTo, ['own', ACCEPTS]), `${X.keyOf(l)}: sentTo lists own and the relay that accepted; got ${show(sentTo)}`);
  }
  assert(r.log().some((x) => x.at === 'publish' && x.url === R.normalize(X.URL_OF('refuses'))), 'the refusing relay was sent each letter: its refusal is its answer, not the call\'s');
});

test('ES4 [AC5, Decision 5]: a dry run answers each node\'s outcome, a changed one\'s added and removed tags, the reports before the letters, and signs, sends and records nothing', async () => {
  const { a3, afterEdit, afterA3, k } = await chain();
  const body = a3.req('a3').body;
  const d = X.data(a3, 'a3');
  const tom = X.letterFor(d, k.tom);
  assert(tom && tom.outcome === 'changed', `Tom, changed since his letter, is changed; got ${show(tom)}`);
  assert(X.lettersOf(d).filter((l) => X.keyOf(l) !== k.tom).every((l) => l.outcome === 'unchanged'), `every other letter is unchanged; got ${show(X.lettersOf(d).map((l) => [X.keyOf(l), l.outcome]))}`);
  const json = (list) => (Array.isArray(list) ? list : []).filter((t) => Array.isArray(t) && t[0] === 'json').map((t) => String(t[1]));
  assert(json(tom.added).some((v) => v.includes('naps')) && json(tom.removed).some((v) => !v.includes('naps')), `Tom's added tags hold his new JSON and his removed tags his old; got added ${show(tom.added).slice(0, 300)} removed ${show(tom.removed).slice(0, 300)}`);
  const order = Object.keys(body.data);
  assert(Array.isArray(d.reports) && d.reports.length > 0 && order.indexOf('reports') >= 0 && order.indexOf('reports') < order.indexOf('letters'),
    `the reports come first, before the letters (the ghost link and the uncarried ENUMERATES among them); got keys ${show(order)} and ${show(d.reports).slice(0, 300)}`);
  assert(X.signings(a3.spy) === 0, `nothing was signed; the spy saw ${show(a3.spy)}`);
  assert(!a3.mine.some((x) => x.at === 'strfry-import' || x.at === 'publish'), 'nothing was sent');
  assert(F.sameGraph(afterEdit, afterA3) && X.exportEntries(afterA3).length === X.exportEntries(afterEdit).length, `nothing was recorded; differs ${show(F.graphDiff(afterEdit, afterA3))}`);
});

test('ES5 [AC5]: the same call again with nothing changed signs nothing, sends nothing and records nothing: every letter unchanged', async () => {
  const { a2, afterA1, afterA2 } = await chain();
  const d = X.data(a2, 'a2');
  assert(X.lettersOf(d).length === 20 && X.lettersOf(d).every((l) => l.outcome === 'unchanged') && X.countOf(d, 'unchanged') === 20, `every letter unchanged; got ${show(X.lettersOf(d).map((l) => l.outcome))}`);
  assert(X.signings(a2.spy) === 0, `nothing was signed; the spy saw ${show(a2.spy)}`);
  assert(!a2.mine.some((x) => x.at === 'strfry-import' || x.at === 'publish'), 'nothing was sent');
  assert(F.sameGraph(afterA1, afterA2) && X.exportEntries(afterA2).length === 1, `nothing was recorded; differs ${show(F.graphDiff(afterA1, afterA2))}`);
});

test('ES6 [AC5, Decision 5]: graph update-node changes Tom: a dry run lists only Tom changed, and the export signs only Tom, dated one second after his last letter, which is ahead of now', async () => {
  const { a1, a3, a4, afterA1, afterA4, edited, k } = await chain();
  const first = X.lettersOf(X.data(a1, 'a1'));
  const store1 = a1.ended.store;
  assert(first.every((l) => (store1.find((e) => e.id === l.id) || {}).created_at === AHEAD), `the first export's letters start from _send.js's now(), set ahead of the clock to ${AHEAD}; got ${show(first.map((l) => (store1.find((e) => e.id === l.id) || {}).created_at))}`);
  assert(edited.letterOutOfDate === true, `Tom has a letter now, so graph update-node answers letterOutOfDate; got ${show(edited)}`);
  const dry = X.lettersOf(X.data(a3, 'a3'));
  assert(dry.filter((l) => l.outcome === 'changed').map(X.keyOf).join() === k.tom, `the dry run lists only Tom changed; got ${show(dry.filter((l) => l.outcome !== 'unchanged').map((l) => [X.keyOf(l), l.outcome]))}`);
  const d = X.data(a4, 'a4');
  const tom = X.letterFor(d, k.tom);
  const was = X.nodeByKey(afterA1, k.tom).props;
  assert(tom && tom.outcome === 'changed' && tom.id !== was.id && X.lettersOf(d).filter((l) => l !== tom).every((l) => l.outcome === 'unchanged'), `only Tom is signed again; got ${show(X.lettersOf(d).map((l) => [X.keyOf(l), l.outcome]))}`);
  assert(X.signings(a4.spy) === 1, `one letter signed; the spy saw ${show(a4.spy)}`);
  const e = a4.ended.store.find((x) => x.id === tom.id);
  assert(e && e.created_at === X.plain(was.created_at) + 1 && X.plain(was.created_at) === AHEAD, `his new letter is dated one second after his last, ${was.created_at}, which is ahead of now; got ${e && e.created_at}`);
  const now = X.nodeByKey(afterA4, k.tom).props;
  assert(now.id === tom.id && X.plain(now.created_at) === e.created_at, 'his node holds the new letter');
  const entry = X.exportEntries(afterA4).find((x) => x.changes.some((c) => c.change === 'letter-sent' && c.node === k.tom && c.was && c.was.id === was.id));
  assert(entry && entry.changes.filter((c) => c.change === 'letter-sent').length === 1 && entry.changes.find((c) => c.node === k.tom).was.created_at === AHEAD,
    `the call's entry records one letter sent, Tom's, with the letter it replaced as was; got ${show(X.exportEntries(afterA4).map((x) => x.changes))}`);
  assert(a4.mine.filter((x) => x.at === 'strfry-import').flatMap((x) => x.ids).join() === tom.id, 'only Tom\'s letter went to the strfry import');
});

test('ES7 [AC5, Decision 6]: an unchanged letter is sent as it was signed to a relay named now that doesn\'t hold it; the own relay answers held; sentTo gains the new one; again, held on both', async () => {
  const { a5, a6, afterA4, afterA5, scope } = await chain();
  const d = X.data(a5, 'a5');
  const published = a5.mine.filter((x) => x.at === 'publish' && x.url === R.normalize(ACCEPTS));
  for (const l of X.lettersOf(d)) {
    const n = X.nodeByKey(afterA4, X.keyOf(l)).props;
    assert(l.outcome === 'unchanged', `${n.uuid}: unchanged`);
    assert((X.relayOf(l, 'own') || {}).status === 'held' && (X.relayOf(l, ACCEPTS) || {}).status === 'accepted', `${n.uuid}: the own relay holds it (held) and accepts accepted it; got ${show(l.relays)}`);
    assert(published.some((x) => x.id === n.id), `${n.uuid}: sent as it was signed, its id ${n.id}`);
    assert(X.sameSet(X.sentToOf(afterA5, X.keyOf(l)) || [], ['own', ACCEPTS]), `${n.uuid}: sentTo gains ${ACCEPTS}; got ${show(X.sentToOf(afterA5, X.keyOf(l)))}`);
  }
  assert(published.length === scope.length && X.signings(a5.spy) === 0, `each letter sent once, none signed again; got ${published.length} publishes, spy ${show(a5.spy)}`);
  const again = X.data(a6, 'a6');
  assert(X.lettersOf(again).every((l) => (X.relayOf(l, 'own') || {}).status === 'held' && (X.relayOf(l, ACCEPTS) || {}).status === 'held'), `the same call again: held on both; got ${show(X.lettersOf(again).slice(0, 2).map((l) => l.relays))}`);
  assert(!a6.mine.some((x) => x.at === 'publish' || x.at === 'strfry-import'), 'and nothing was sent');
});

test('ES8 [AC5 and Decision 2, as amended at Review: Amendment 2 item 2] (round 1): letters go out by kind first, headers, supersets, sets, the rest; within a kind, after the letters of that kind they name, a cycle by tapestryKey; so a header goes before its core nodes and elements, and a graph after the nodes it lists', async () => {
  const { a1, k, w } = await chain();
  const order = a1.mine.filter((x) => x.at === 'strfry-import').flatMap((x) => x.ids);
  const held = a1.ended.store;
  const events = order.map((id) => held.find((e) => e.id === id)).filter(Boolean);
  assert(events.length === 20, `the twenty letters went out in one order; got ${events.length}`);
  const addresses = events.map((e) => X.addressOf(e));
  const pos = new Map(addresses.map((a, i) => [a, i]));
  const nodeAt = (a) => X.at(w.state, a);
  // The kinds of node, as Decision 2 ranks them: concept headers, supersets, sets, everything else.
  const KINDS = ['header', 'superset', 'set', 'rest'];
  const kindOf = (a) => { const l = nodeAt(a).labels; return l.includes('ConceptHeader') || l.includes('ListHeader') ? 0 : l.includes('Superset') ? 1 : l.includes('Set') ? 2 : 3; };
  const name = (a) => `${a.split(':').slice(2).join(':')} (${KINDS[kindOf(a)]})`;
  // 1. By kind first.
  const outOfKind = [];
  for (let i = 1; i < addresses.length; i += 1) if (kindOf(addresses[i]) < kindOf(addresses[i - 1])) outOfKind.push(`${name(addresses[i])} went out after ${name(addresses[i - 1])}`);
  assert(outOfKind.length === 0, `letters go out by kind of node first: concept headers, then supersets, then sets, then the rest; got ${show(outOfKind)} in the order ${show(addresses.map(name))}`);
  // 2. Within a kind, each after the letters of its kind it names; letters of one kind that name each other go by tapestryKey.
  const edges = new Map(events.map((e) => [X.addressOf(e), [...X.namesIn(e)].filter((a) => pos.has(a) && a !== X.addressOf(e) && kindOf(a) === kindOf(X.addressOf(e)))]));
  const reaches = (from, to, seen = new Set()) => {
    if (from === to) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    return (edges.get(from) || []).some((x) => reaches(x, to, seen));
  };
  const late = [];
  const ties = [];
  for (const [l, named] of edges) {
    for (const m of named) {
      if (!reaches(m, l)) { if (pos.get(m) > pos.get(l)) late.push(`${name(l)} went before ${name(m)}, of its kind, which it names`); continue; }
      const [kl, km] = [nodeAt(l).props.tapestryKey, nodeAt(m).props.tapestryKey];
      if ((kl < km) !== (pos.get(l) < pos.get(m))) ties.push(`${name(l)} and ${name(m)} name each other, and went out against their tapestryKeys' order`);
    }
  }
  assert(late.length === 0, `within a kind, each letter goes after the letters of that kind it names; got ${show(late)}`);
  assert(ties.length === 0, `letters of one kind that name each other go by tapestryKey; got ${show([...new Set(ties)])}`);
  // 3. AC5's example: the concept's header before all its core nodes and elements.
  const its = ['petSuperset', 'petJsonSchema', 'petPrimaryProperty', 'petProperties', 'petPropertyTreeGraph', 'petConceptGraph', 'petCoreNodesGraph', 'rex', 'tom', 'fido', 'spot', 'linker'];
  const before = its.filter((n) => !(pos.get(w.addr.petHeader) < pos.get(w.addr[n])));
  assert(before.length === 0, `pet's header goes before all its core nodes and elements; it went out at ${pos.get(w.addr.petHeader)}, after ${show(before.map((n) => `${n} at ${pos.get(w.addr[n])}`))}`);
  // 4. A graph goes after the nodes it lists, but for one of its kind that names it back.
  const early = [];
  for (const e of events) {
    const g = X.letterJson(e) && X.letterJson(e).graph;
    for (const x of g && Array.isArray(g.nodes) ? g.nodes : []) {
      const a = x && x.uuid;
      if (!pos.has(a) || a === X.addressOf(e) || (kindOf(a) === kindOf(X.addressOf(e)) && reaches(a, X.addressOf(e)))) continue;
      if (pos.get(a) > pos.get(X.addressOf(e))) early.push(`${name(X.addressOf(e))} went before ${name(a)}, which it lists`);
    }
  }
  assert(early.length === 0, `a graph goes after the nodes it lists; got ${show(early)}`);
  void k;
});

test('ES9 [AC5, amendment 5]: with MAX_SCOPE and MAX_SEND shrunk, a call answers next.after and the next call goes on from it; together each letter is signed and accepted once', async () => {
  X.needDecl();
  const w = await X.world();
  const k = w.keys;
  const caps = { MAX_SCOPE: 6, MAX_SEND: 4 };
  let r = X.runExport({ state: X.copy(w.state), ownEvents: w.ownEvents, lmdb: w.lmdb, exportTiming: caps, label: 'export-nostr-paging', requests: [exp('p0', 'owner', { graph: k.petConceptGraph })] });
  const calls = [X.data(r, 'p0')];
  let signed = X.signings(r.spy);
  while (calls[calls.length - 1].next && calls.length < 12) {
    const after = calls[calls.length - 1].next.after;
    assert(typeof after === 'string' && after.length > 0, `next.after is a cursor; got ${show(calls[calls.length - 1].next)}`);
    const id = `p${calls.length}`;
    r = X.runExport({ file: r.file, fixture: r.fixture, ownEvents: w.ownEvents, lmdb: w.lmdb, exportTiming: caps, requests: [exp(id, 'owner', { graph: k.petConceptGraph, after })] });
    calls.push(X.data(r, id));
    signed += X.signings(r.spy);
  }
  assert(calls.length >= 5 && !calls[calls.length - 1].next, `twenty letters, four a call, take five calls or more, the last answering no next; got ${calls.length} calls, the last next ${show(calls[calls.length - 1].next)}`);
  const accepted = calls.flatMap((d) => X.lettersOf(d).filter((l) => (X.relayOf(l, 'own') || {}).status === 'accepted').map(X.keyOf));
  assert(calls.every((d) => X.lettersOf(d).filter((l) => (X.relayOf(l, 'own') || {}).status === 'accepted').length <= 4 && X.lettersOf(d).length <= 6), `each call signs at most MAX_SEND and classes at most MAX_SCOPE; got ${show(calls.map((d) => X.lettersOf(d).length))}`);
  assert(accepted.length === 20 && X.sameSet(accepted, X.petScope(k)), `together the calls sent each of the twenty once; got ${accepted.length}: ${show(accepted)}`);
  assert(signed === 20, `and signed each once; the spy saw ${signed} signings`);
});

test('ES10 [Decision 6]: with SEND_CUTOFF_MS shrunk and a slow relay, letters not sent in time answer not-sent, and the call answers next.after', async () => {
  X.needDecl();
  const w = await X.world();
  const slow = X.URL_OF('slow');
  const t0 = Date.now();
  const r = X.runExport({
    state: X.copy(w.state), ownEvents: w.ownEvents, lmdb: w.lmdb, relays: { [slow]: F.relay([], { publishDelayMs: 400 }) },
    exportTiming: { IN_FLIGHT: 1, SEND_CUTOFF_MS: 2500, OK_MS: 3000 }, label: 'export-nostr-cutoff',
    requests: [exp('slow', 'owner', { graph: w.keys.petConceptGraph, relays: [slow] })],
  });
  const d = X.data(r, 'slow');
  const st = statuses(d, slow);
  assert(st.includes('not-sent') && d.next && typeof d.next.after === 'string', `letters not sent before the cutoff answer not-sent to the slow relay, and next.after says where to go on; got ${show(st)}, next ${show(d.next)}`);
  assert(Date.now() - t0 < 20000, `the call ends soon after its cutoff, not after every slow send; took ${Date.now() - t0} ms`);
});

/** One send over the selection (three letters) to the own relay and accepts, with the strfry and own-relay setup given. */
function classRun(w, { strfry = { mode: 'ok' }, own = {}, timing = {}, env = {}, label }) {
  return X.runExport({
    state: X.copy(w.state), ownEvents: w.ownEvents, lmdb: w.lmdb, strfry, timing, env, label,
    relays: { [X.OWN_RELAY]: own, [ACCEPTS]: F.relay([]) },
    requests: [exp('send', 'owner', { graph: w.keys.picks, relays: [ACCEPTS] })],
  });
}
const recorded = (s, key) => { const n = X.nodeByKey(s, key).props; return typeof n.id === 'string' || n.sentTo !== undefined; };

test('ES11 [Decision 6]: strfry import runs and the read-back finds the letter: the own relay accepted, the letter sent out, and recorded', async () => {
  X.needDecl();
  const w = await X.world();
  const r = classRun(w, { label: 'export-nostr-es11' });
  for (const l of X.lettersOf(X.data(r, 'send'))) {
    assert((X.relayOf(l, 'own') || {}).status === 'accepted' && (X.relayOf(l, ACCEPTS) || {}).status === 'accepted', `${X.keyOf(l)}: accepted by both; got ${show(l.relays)}`);
    assert(X.nodeByKey(r.state(), X.keyOf(l)).props.id === l.id && X.sameSet(X.sentToOf(r.state(), X.keyOf(l)) || [], ['own', ACCEPTS]), `${X.keyOf(l)}: recorded`);
  }
});

test('ES12 [Decision 6]: the read-back answers without one letter: refused by the own relay, not-sent out, not recorded; the others go on', async () => {
  X.needDecl();
  const w = await X.world();
  const r = classRun(w, { strfry: { mode: 'drop', addresses: [w.addr.rex] }, label: 'export-nostr-es12' });
  const d = X.data(r, 'send');
  const rex = X.letterFor(d, w.keys.rex);
  const own = X.relayOf(rex, 'own') || {};
  assert(own.status === 'refused' && typeof own.reason === 'string' && own.reason.length > 0, `Rex's letter, which the read-back didn't find, is refused by the own relay, saying so; got ${show(rex)}`);
  assert((X.relayOf(rex, ACCEPTS) || {}).status === 'not-sent' && !recorded(r.state(), w.keys.rex), `it isn't sent out, and isn't recorded; got ${show(rex.relays)} and ${show(X.nodeByKey(r.state(), w.keys.rex).props)}`);
  assert(!r.log().some((x) => x.at === 'publish' && x.id === rex.id), 'no relay was sent it');
  for (const key of [w.keys.picks, w.keys.tom]) assert((X.relayOf(X.letterFor(d, key), ACCEPTS) || {}).status === 'accepted' && recorded(r.state(), key), `${key}: the others are sent and recorded`);
});

test('ES13 [Decision 6; Decision 8 as amended at Review: Amendment 2 item 1] (round 1): the read-back doesn\'t answer: each letter unread, not-sent out, recorded in the call\'s change entry with each relay\'s answer, and not on its node', async () => {
  X.needDecl();
  const w = await X.world();
  const r = classRun(w, { own: { silentAfterImport: true }, timing: { REQUEST_MS: 800 }, label: 'export-nostr-es13' });
  const d = X.data(r, 'send');
  const letters = X.lettersOf(d);
  assert(letters.length === 3 && letters.every((l) => (X.relayOf(l, 'own') || {}).status === 'unread' && (X.relayOf(l, ACCEPTS) || {}).status === 'not-sent'), `own unread, accepts not-sent; got ${show(letters.map((l) => l.relays))}`);
  assert(r.log().some((x) => x.at === 'strfry-import'), 'the letters went through the strfry import first');
  assert([w.keys.picks, w.keys.rex, w.keys.tom].every((key) => !recorded(r.state(), key)), 'nothing is claimed for them on their nodes: no node holds a letter or a sentTo');
  // Each may be on the instance's own relay, so the call's entry records it, with each relay's answer (Amendment 2 item 1).
  const entries = X.exportEntries(r.state());
  assert(entries.length === 1 && d.change && d.change.id === entries[0].tapestryKey, `the call writes one change entry, export nostr, and answers it; got ${entries.length} entries and change ${show(d.change).slice(0, 200)}`);
  for (const l of letters) {
    const c = (entries[0].changes || []).find((x) => x && x.node === X.keyOf(l) && x.now && x.now.id === l.id);
    const status = (relay) => ((c && Array.isArray(c.relays) ? c.relays : []).find((x) => (relay === 'own' ? X.isOwnRelay(x.relay) : R.normalize(x.relay) === R.normalize(relay))) || {}).status;
    assert(c && c.address === X.nodeByKey(r.state(), X.keyOf(l)).props.uuid && status('own') === 'unread' && status(ACCEPTS) === 'not-sent',
      `${X.keyOf(l)}: the entry records its unread letter, ${l.id}, with its address and each relay's answer (own unread, accepts not-sent); got ${show(c)}`);
  }
});

test('ES14 [Decision 6]: strfry import can\'t run: every letter unreachable, not-sent out, not recorded', async () => {
  X.needDecl();
  const w = await X.world();
  const r = classRun(w, { strfry: { mode: 'fail' }, label: 'export-nostr-es14' });
  const d = X.data(r, 'send');
  assert(X.lettersOf(d).length === 3 && X.lettersOf(d).every((l) => (X.relayOf(l, 'own') || {}).status === 'unreachable' && (X.relayOf(l, ACCEPTS) || {}).status === 'not-sent'), `own unreachable, accepts not-sent; got ${show(X.lettersOf(d).map((l) => l.relays))}`);
  assert(r.log().some((x) => x.at === 'strfry-import'), 'the strfry import was tried');
  assert([w.keys.picks, w.keys.rex, w.keys.tom].every((key) => !recorded(r.state(), key)) && !r.log().some((x) => x.at === 'publish'), 'nothing recorded, nothing sent out');
  // (round 1, a pin) A call whose every letter was refused, unreachable or not sent writes no entry (Amendment 2 item 1).
  assert(X.data(r, 'send').change === null && X.exportEntries(r.state()).length === 0, `no change entry: no letter reached anywhere; got ${show(X.data(r, 'send').change)}`);
});

test('ES15 [Decision 6]: BRAINSTORM_PUBLISH_LOCAL_ONLY=true: the own relay accepted, every outside relay not-sent saying why, sentTo own only', async () => {
  X.needDecl();
  const w = await X.world();
  const r = classRun(w, { env: { BRAINSTORM_PUBLISH_LOCAL_ONLY: 'true' }, label: 'export-nostr-es15' });
  for (const l of X.lettersOf(X.data(r, 'send'))) {
    const out = X.relayOf(l, ACCEPTS) || {};
    assert((X.relayOf(l, 'own') || {}).status === 'accepted' && out.status === 'not-sent' && typeof out.reason === 'string' && out.reason.length > 0, `${X.keyOf(l)}: own accepted, accepts not-sent with the reason; got ${show(l.relays)}`);
    assert(JSON.stringify(X.sentToOf(r.state(), X.keyOf(l))) === JSON.stringify(['own']), `${X.keyOf(l)}: sentTo ['own']; got ${show(X.sentToOf(r.state(), X.keyOf(l)))}`);
  }
  assert(!r.log().some((x) => x.at === 'publish'), 'nothing went to an outside relay');
});

test('ES16 [Decision 6; story 32\'s review, blocking 1]: a live relay drops the connection at the second letter: the rest unreachable or timeout, the first accepted, and the process lives on', async () => {
  X.needDecl();
  const w = await X.world();
  const drop = X.URL_OF('drop');
  const t0 = Date.now();
  const r = X.runExport({
    state: X.copy(w.state), ownEvents: w.ownEvents, lmdb: w.lmdb, live: { [drop]: { events: [], dropOnEvent: 2 } }, exportTiming: { IN_FLIGHT: 1, OK_MS: 1500 },
    label: 'export-nostr-drop', check: false, requests: [exp('drop', 'owner', { graph: w.keys.picks, relays: [drop] })],
  });
  assert(r.raw.child.status === 0 && r.raw.data, `the process lives through the dropped connection; the harness's child exited ${r.raw.child.status}: ${String(r.raw.child.stderr || '').split('\n').filter(Boolean).slice(-4).join(' | ')}`);
  const d = X.data(r.answered(), 'drop');
  const st = statuses(d, drop);
  assert(st.filter((x) => x === 'accepted').length === 1 && st.filter((x) => x === 'unreachable' || x === 'timeout').length === 2, `one accepted before the drop, the two after it unreachable or timeout; got ${show(st)}`);
  assert(X.lettersOf(d).every((l) => (X.relayOf(l, 'own') || {}).status === 'accepted'), 'the own relay\'s answers stand');
  assert(r.log().some((x) => x.at === 'live-drop-event'), 'the live relay dropped the connection');
  assert(Date.now() - t0 < 15000, `and the call ends soon after the drop; took ${Date.now() - t0} ms`);
});

// ── Review round 1 ──

test('ES17 [Decision 6 as amended at Review: Amendment 2 item 5; review round 1, finding 7] (round 1): a strfry import that never ends doesn\'t hold the call: it answers within BUDGET_MS and a margin, each letter as the read-back decides, none on its node and none sent out', async () => {
  X.needDecl();
  const w = await X.world();
  const BUDGET = 3000;
  const MARGIN = 5000;
  const STOP = BUDGET + MARGIN + 7000;
  const r = X.runExport({
    state: X.copy(w.state), ownEvents: w.ownEvents, lmdb: w.lmdb, strfry: { mode: 'hang' }, relays: { [ACCEPTS]: F.relay([]) },
    exportTiming: { BUDGET_MS: BUDGET }, timeoutMs: STOP, label: 'export-nostr-es17',
    requests: [exp('hang', 'owner', { graph: w.keys.picks, relays: [ACCEPTS] })],
  });
  assert(!r.error && r.requests.hang, `the call answers while its strfry import never ends; it hadn't answered when the harness stopped at its own ${STOP} ms: ${r.error}`);
  const ms = r.req('hang').ms;
  assert(ms < BUDGET + MARGIN, `it answers within BUDGET_MS, ${BUDGET} ms here, and ${MARGIN} ms more, never the 60 s a strfry import may run; it took ${ms} ms`);
  const d = X.data(r, 'hang');
  const letters = X.lettersOf(d);
  assert(r.log().some((x) => x.at === 'strfry-import'), 'the letters went to the strfry import, which never ended');
  assert(letters.length === 3 && letters.every((l) => ['unread', 'refused', 'unreachable'].includes((X.relayOf(l, 'own') || {}).status) && (X.relayOf(l, ACCEPTS) || {}).status === 'not-sent'),
    `each letter as the read-back decides (the import kept nothing, so never accepted), and not sent out; got ${show(letters.map((l) => l.relays))}`);
  assert([w.keys.picks, w.keys.rex, w.keys.tom].every((key) => !recorded(r.state(), key)) && !r.log().some((x) => x.at === 'publish'), 'no node holds a letter, and nothing went to an outside relay');
});

/** Another export's letter, by a label and a created_at (its id stands in: the record keeps ids, and signs nothing). */
const raceLetter = (label, at) => ({ id: crypto.createHash('sha256').update(`export-nostr-race: ${label}`).digest('hex'), created_at: at });
let RACES = null;
function races() {
  if (RACES) return RACES;
  RACES = (async () => {
    X.needDecl();
    const w = await X.world();
    const k = w.keys;
    const state = X.copy(w.state);
    // Two exports of a node read it before either records. Here the other one records first: just before this call's
    // first write to the node (its lock, or its record), another transaction gives the node the other export's letter
    // and writes that export's entry, made by changes.js's recordChange (the graph fake's meanwhile, with set).
    const newer = raceLetter('newer, for Rex', AHEAD + 60);
    const older = raceLetter('older, for Tom', AHEAD - 60);
    const meanwhile = [];
    for (const [key, letter] of [[k.rex, newer], [k.tom, older]]) {
      const { labels, props } = await X.exportEntry({ letters: [{ node: key, address: X.nodeByKey(state, key).props.uuid, kind: 39999, was: null, now: letter }] });
      meanwhile.push({ match: key, set: [{ key, props: { id: letter.id, created_at: letter.created_at, sentTo: ['own'] } }], add: [{ labels, props }] });
    }
    state.failures = { ...(state.failures || {}), meanwhile };
    const r = X.runExport({ state, ownEvents: w.ownEvents, lmdb: w.lmdb, exportTiming: { NOW: AHEAD }, label: 'export-nostr-races', requests: [exp('rex', 'owner', { node: k.rex }), exp('tom', 'owner', { node: k.tom })] });
    return { w, k, r, newer, older, after: r.state() };
  })();
  return RACES;
}
const fired = (s, key) => (s.log || []).some((x) => x.call === 'meanwhile' && x.match === key);
const changeFor = (d, key) => ((d.change && Array.isArray(d.change.changes) ? d.change.changes : []).find((c) => c && c.node === key)) || null;

test('ES18 [Decision 8 as amended at Review: Amendment 2 item 1] (round 1, a pin): a record that finds the node already holding a newer letter another export sent leaves it, and its change says raced', async () => {
  const { k, r, newer, after } = await races();
  const d = X.data(r, 'rex');
  const l = X.letterFor(d, k.rex);
  assert(fired(after, k.rex), 'the other export recorded the node first, before this call\'s first write to it');
  assert(l && l.outcome === 'new' && (X.relayOf(l, 'own') || {}).status === 'accepted' && AHEAD < newer.created_at, `this call's letter, dated ${AHEAD}, went into the own relay; got ${show(l)}`);
  const n = X.nodeByKey(after, k.rex).props;
  assert(n.id === newer.id && X.plain(n.created_at) === newer.created_at, `the node keeps the newer letter, ${newer.id} at ${newer.created_at}; got ${show({ id: n.id, created_at: n.created_at })}`);
  const c = changeFor(d, k.rex);
  assert(c && c.raced === true && c.now && c.now.id === l.id, `the call's change for it says raced; got ${show(c)}`);
});

test('ES19 [Decision 8 as amended at Review: Amendment 2 item 1; review round 1, finding 3] (round 1): of the letters export sent for a node, the node keeps the newest: a record that finds the node holding an older letter another export sent replaces it, not raced', async () => {
  const { k, r, older, after } = await races();
  const d = X.data(r, 'tom');
  const l = X.letterFor(d, k.tom);
  assert(fired(after, k.tom), 'the other export recorded the node first, before this call\'s first write to it');
  assert(l && l.outcome === 'new' && (X.relayOf(l, 'own') || {}).status === 'accepted' && HEX64.test(String(l.id)), `this call's letter went into the own relay; got ${show(l)}`);
  const n = X.nodeByKey(after, k.tom).props;
  assert(n.id === l.id && X.plain(n.created_at) === AHEAD && Array.isArray(n.sentTo) && n.sentTo.includes('own'),
    `the node holds this call's letter, ${l.id} at ${AHEAD}, the newer of the two, not the other export's, ${older.id} at ${older.created_at}; got ${show({ id: n.id, created_at: n.created_at, sentTo: n.sentTo })}`);
  const c = changeFor(d, k.tom);
  assert(c && c.raced !== true && c.now && c.now.id === l.id, `the call's change for it isn't raced; got ${show(c)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
