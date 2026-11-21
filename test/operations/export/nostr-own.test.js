'use strict';
/**
 * export nostr — its letters never come back over their nodes. Run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/34-export-nostr.md (AC6, as amended at Architecture)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0034-export-nostr.md (Decision 10; amendment 7)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/34-export-nostr.test-plan.md
 *
 * Stack-free. Export runs as the other suites run it; the importers run as they are:
 *   - import nostr through the harness, its relay the instance's own holding what export sent;
 *   - POST /api/neo4j/event-update, the I/O import (registerIORoutes' upload and execute) and the client-publish
 *     route's brain-write hook (maybeBrainWriteTapestry), each in a child of their own
 *     (test/helpers/todaysImportersChild.js): their real code, shelling out to a strfry and a cypher-shell that answer
 *     from a fixture and run each statement on the Cypher engine (test/helpers/todaysImportersStubs.js), the driver and
 *     the graph seam on that same graph, every statement logged.
 * Each "turned away" case is paired with a newer letter at the same node, which the same handler imports as today, so
 * no case passes by a path that returns early.
 *
 *   EW1  import nostr of the letters export sent: each own, and every node as it was
 *   EW2  event-update at a node whose letter export sent, strfry answering that letter: unchanged, with no statement that
 *        deletes its tags or imports a letter, and the node as it was; an older letter at its address, the same; a newer
 *        one is imported as today
 *   EW3  the I/O import of a file holding that letter: the item skipped, with the reason, and no import statement run
 *        for it (strfry was written first, as Decision 10 has it); a newer letter is imported
 *   EW4  the brain-write hook: export's own Tapestry letter, posted again, isn't imported, the node as it was; a newer
 *        one, as the Tapestries UI would post, is imported
 *   EW5  holdsLetterOrNewer(read, event) itself (src/operations/catalog/export/_own.js), over today's own letters: yes
 *        for the letter the node holds, and for an older version, or a tie the node's lower id wins; no for a newer
 *        version, a tie the event's lower id wins, another author's node, an own node with no letter, and no node. Its
 *        answer is taken as true or false, or { holds } with one
 */

const S = require('../../helpers/graphOpsSuite');
const X = require('../../helpers/exportFixtures');
const F = require('../../helpers/importFixtures');

const { assert } = S;
const show = (x) => String(S.show(x));
const { test, run } = S.makeSuite('operations: export nostr — its letters never come back over their nodes');
const { exp, KEYS } = X;

/** Statements that would put a letter over a node: a tag deleted, or an event node merged or made. */
const writesOver = (log) => log.filter((x) => (x.at === 'cypher-shell' || x.at === 'driver' || x.at === 'seam')
  && /DETACH DELETE t|DELETE r, t|MERGE \(e:NostrEvent|CREATE \(e\)-\[:HAS_TAG\]/.test(String(x.query)));
const holds = (a) => (a === true || a === false ? a : a && typeof a === 'object' && typeof a.holds === 'boolean' ? a.holds : 'not an answer');
const facts = (n) => ({ labels: [...n.labels].sort(), props: Object.keys(n.props).sort().reduce((o, k) => { o[k] = n.props[k]; return o; }, {}) });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** A version of `e` at its address, `by` seconds later (or earlier), with another name. */
const version = (e, by, name) => F.letter(KEYS.ta, { kind: e.kind, at: e.created_at + by, tags: e.tags.map((t) => (t[0] === 'name' ? ['name', name] : t)), content: e.content });

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    X.needDecl();
    const w = await X.world();
    const k = w.keys;
    const r = X.runExport({ state: X.copy(w.state), ownEvents: w.ownEvents, lmdb: w.lmdb, label: 'export-nostr-own', requests: [exp('picks', 'owner', { graph: k.picks }), exp('tapestry', 'owner', { node: k.tapestry })] });
    const sentPicks = X.lettersOf(X.data(r, 'picks'));
    const tapestry = X.letterFor(X.data(r, 'tapestry'), k.tapestry);
    const store = r.store();
    const letterOf = (key) => { const l = sentPicks.find((x) => X.keyOf(x) === key) || (key === k.tapestry ? tapestry : null); return l ? store.find((e) => e.id === l.id) : null; };
    const rexLetter = letterOf(k.rex);
    const tapestryLetter = letterOf(k.tapestry);
    assert(rexLetter && tapestryLetter && tapestry.outcome === 'changed', `export sent Rex's letter and a new Tapestry letter, the Tapestry's old one carrying a tapestry: link; got ${show(sentPicks.map((l) => [X.keyOf(l), l.outcome]))} ${show(tapestry)}`);
    return { w, k, r, after: r.state(), store, rexLetter, tapestryLetter };
  })();
  return MAIN;
}

test('EW1 [AC6]: import nostr of the letters export sent answers own for each, and every node stays as it was', async () => {
  const { w, k, after, store } = await main();
  const addresses = [k.picks, k.rex, k.tom].map((key) => X.nodeByKey(after, key).props.uuid);
  const back = F.runImport({ state: after, ownerKey: X.OWNER, relays: { [X.OWN_RELAY]: F.relay(store) }, label: 'export-nostr-own-import', requests: [F.imp('back', 'admin', { addresses })] });
  const d = F.data(back, 'back');
  assert(d.events.length === 3 && d.events.every((e) => e.outcome === 'own') && d.changes === 0, `each letter answers own, and nothing is recorded; got ${show(d.events.map((e) => [e.ref, e.outcome]))}`);
  assert(F.sameGraph(after, back.state()), `every node is as it was; differs ${show(F.graphDiff(after, back.state()))}`);
  void w;
});

test('EW2 [AC6, Decision 10]: event-update at an exported node answers unchanged for its letter and an older one, writing nothing; a newer one is imported as today', async () => {
  const { w, k, after, rexLetter } = await main();
  const address = X.nodeByKey(after, k.rex).props.uuid;
  const node = X.nodeByKey(after, k.rex);
  for (const [what, letter] of [['its own letter', rexLetter], ['an older letter', version(rexLetter, -100, 'Rex, before')]]) {
    const t = X.runTodays(after, { handler: 'event-update', uuid: address }, { strfry: [letter] });
    assert(!t.error && t.answer && t.answer.status === 200 && t.answer.body.success === true && t.answer.body.unchanged === true, `${what}: event-update answers success and unchanged; got ${show(t.answer)} ${t.error || ''}`);
    assert(t.log.some((x) => x.at === 'strfry' && x.cmd === 'scan'), `${what}: the handler ran: it looked the letter up in strfry; log ${show(t.log.map((x) => x.at))}`);
    assert(writesOver(t.log).length === 0, `${what}: no statement deleted its tags or imported a letter; ran ${show(writesOver(t.log))}`);
    const now = X.nodeByKey(t.state(), k.rex);
    assert(same(facts(node), facts(now)) && X.sameTags(X.tagArrays(after, node), X.tagArrays(t.state(), now)), `${what}: the node, its letter and its tags are as they were; now ${show(facts(now))}`);
  }
  const newer = version(rexLetter, 100, 'Rex the Second');
  const t = X.runTodays(after, { handler: 'event-update', uuid: address }, { strfry: [newer] });
  assert(t.answer && t.answer.status === 200 && t.answer.body.success === true && t.answer.body.action === 'updated', `a newer letter is imported as today: updated; got ${show(t.answer)} ${t.error || ''}`);
  assert(writesOver(t.log).length > 0 && X.nodeByKey(t.state(), k.rex).props.id === newer.id, 'its statements ran, and the node holds the newer letter');
  void w;
});

test('EW3 [AC6, Decision 10]: the I/O import skips, with the reason, a letter an exported node holds, running no import statement for it; a newer letter is imported', async () => {
  const { k, after, rexLetter } = await main();
  const node = X.nodeByKey(after, k.rex);
  const t = X.runTodays(after, { handler: 'io-import', items: [{ slug: 'rex', event: rexLetter, word: null }] });
  const ex = t.answer && t.answer.execute;
  const item = ex && ex.body && (ex.body.results || []).find((x) => x.slug === 'rex');
  assert(!t.error && item && item.status === 'skipped' && typeof item.reason === 'string' && item.reason.length > 0, `the item is skipped, with the reason; got ${show(t.answer)} ${t.error || ''}`);
  assert(t.log.some((x) => x.at === 'strfry' && x.cmd === 'import'), 'the handler ran: it wrote the letter to strfry first, which changes nothing there');
  assert(writesOver(t.log).length === 0 && X.nodeByKey(t.state(), k.rex).props.id === node.props.id, `no import statement ran for it, and the node holds its letter; ran ${show(writesOver(t.log))}`);
  const newer = version(rexLetter, 100, 'Rex the Second');
  const n = X.runTodays(after, { handler: 'io-import', items: [{ slug: 'rex', event: newer, word: null }] });
  const nitem = n.answer && n.answer.execute && (n.answer.execute.body.results || []).find((x) => x.slug === 'rex');
  assert(nitem && nitem.status === 'imported' && writesOver(n.log).length > 0 && X.nodeByKey(n.state(), k.rex).props.id === newer.id, `a newer letter is imported as today; got ${show(n.answer)} ${n.error || ''}`);
});

test('EW4 [AC6, Decision 10, amendment 7]: the brain-write hook doesn\'t import export\'s own Tapestry letter posted again; a newer one, as the Tapestries UI posts, it imports', async () => {
  const { k, after, tapestryLetter } = await main();
  const node = X.nodeByKey(after, k.tapestry);
  const t = X.runTodays(after, { handler: 'brain-write', event: tapestryLetter });
  assert(!t.error && t.answer, `the hook answered; got ${t.error || show(t.answer)}`);
  assert(writesOver(t.log).length === 0, `no statement imported the letter the node holds over it; ran ${show(writesOver(t.log))}`);
  const now = X.nodeByKey(t.state(), k.tapestry);
  assert(now.props.id === node.props.id && now.props.created_at === node.props.created_at && X.sameTags(X.tagArrays(after, node), X.tagArrays(t.state(), now)), `the Tapestry's node still holds its letter, with its tags as they were; now ${show(facts(now)).slice(0, 400)}`);
  const newer = version(tapestryLetter, 100, 'Pets and Dogs, again');
  const n = X.runTodays(after, { handler: 'brain-write', event: newer });
  assert(n.answer && n.answer.report && n.answer.report.success === true && writesOver(n.log).length > 0 && X.nodeByKey(n.state(), k.tapestry).props.id === newer.id, `a newer Tapestry letter is imported as today; got ${show(n.answer)} ${n.error || ''}`);
});

test('EW5 [AC6, Decision 10]: holdsLetterOrNewer answers yes for the letter an own node holds or an older version, and no for a newer one, another author\'s node, a node with no letter or none', async () => {
  const w = await X.world();
  const k = w.keys;
  const held = w.ownEvents.find((e) => X.addressOf(e) === w.addr.dogRex);
  // A tie on created_at goes to the lower id (NIP-01): grind one version below the held id and one above it.
  const tie = (lower) => { for (let i = 0; i < 400; i++) { const e = version(held, 0, `Rex, tied ${i}`); if (lower ? e.id < held.id : e.id > held.id) return e; } throw new Error('no tie found'); };
  const cat = F.conceptLetters(KEYS.alice, 'cat', { at: 1690000700 }).letters.header;
  const petRex = F.letter(KEYS.ta, { kind: 39999, at: 1690000000, tags: [['d', w.addr.rex.split(':').slice(2).join(':')], ['name', 'Rex']] });
  const nobody = F.letter(KEYS.ta, { kind: 39999, at: 1690000000, tags: [['d', 'no-node-here'], ['name', 'Nobody']] });
  const cases = [
    ['the letter the node holds', held, true],
    ['an older version', version(held, -10, 'Rex, earlier'), true],
    ['a tie the node\'s lower id wins', tie(false), true],
    ['a newer version', version(held, 10, 'Rex, later'), false],
    ['a tie the event\'s lower id wins', tie(true), false],
    ['another author\'s node, alice\'s cat header', cat, false],
    ['an own node with no letter, pet\'s Rex', petRex, false],
    ['no node at the address', nobody, false],
  ];
  const t = X.runTodays(w.state, { handler: 'holds', events: cases.map((c) => c[1]) });
  assert(!t.error && t.answer && Array.isArray(t.answer.answers), `holdsLetterOrNewer answered; got ${t.error || show(t.answer)}`);
  cases.forEach(([what, , want], i) => assert(holds(t.answer.answers[i]) === want, `${what}: ${want ? 'yes' : 'no'}; got ${show(t.answer.answers[i])}`));
  void k;
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
