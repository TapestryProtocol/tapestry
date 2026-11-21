'use strict';
/**
 * graph wire-to-shared — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/48-declare-a-concept-shared.md (AC2, AC3, AC5)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0048-declare-shared-wire-to-shared-defer-sharing.md
 *          (Decisions 1–8; Amendment 1, items 1–6)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/48-declare-a-concept-shared.test-plan.md
 *
 * Stack-free: the real catalog in a child over test/helpers/sharingGraph.js's graph, every statement on the Cypher
 * engine, which runs the placeholder's CREATE and the relationship's MERGE as Neo4j runs them, with Tapestry's
 * uniqueness rules: a second NostrEvent at an address fails as it would on Neo4j. One run holds every call below, in
 * order, with the spy on; a second, over a graph with no concept-header concept, holds not-installed. The targets:
 * relay's header (another author's, lettered), FISH, OTTER and GHOST (addresses no node holds), NEWT (seed-firmware's
 * kind of placeholder, a TapestryNode with no created_at), dog house's header (a concept graph create-concept made,
 * with no NostrEvent label) and two widgets' headers (other authors').
 *
 *   WS1  lamp wired to relay: ["b", <relay's address>, "pointer"] once, REFERENCES {source:'b-tag'} to relay's header,
 *        target { address, held: true, node }, disposition wired with its bValues, letterOutOfDate false, and its
 *        entry's tag-added and relationship-added in the existing shapes
 *   WS2  lamp wired to FISH as well, beside the b it holds: a placeholder made there, import nostr's kind (NostrEvent and
 *        TapestryNode, uuid, kind 39998, pubkey, a tapestryKey, no created_at, no id); target held false, its node the
 *        placeholder, which the relationship-added names and the entry's keys hold (graph history finds it); bValues
 *        both addresses, sorted
 *   WS3  a placeholder is made only when no node of any label is at the address, and held is true only for a node that
 *        isn't one: lamp wired to dog house runs to its header, held; kite wired to FISH runs to lamp's placeholder,
 *        held false, with no second; flute wired to NEWT runs to seed-firmware's placeholder there, held false, with no
 *        second (Amendment 1 item 1)
 *   WS4  an naddr target gives the b its address gives: drum wired to OTTER's naddr holds ["b", OTTER, "pointer"], and
 *        wiring it to OTTER's address then answers already-wired, its target as the first call's
 *   WS5  called again with the same target: already-wired, change null, nothing written, and target read from the graph
 *        as a first call answers it; mouse, whose header has an inherit-typed b naming relay (any type counts):
 *        already-wired, the same, no relationship drawn
 *   WS6  the deferral marker goes when a header is wired: kite's, recorded as tag-removed
 *   WS7  a lettered concept, beagle, wired to a widget: letterOutOfDate true
 *   WS8  hoop's REFERENCES {source:'b-tag'} to relay, which an import drew, isn't doubled and isn't recorded; firmware's
 *        REFERENCES {source:'firmware-community'} stub to the second widget isn't matched: a b-tag one is drawn beside it
 *   WS9  lamp ends holding the three pointer b's it was given and its other tags and JSON as they were; nothing else in
 *        the graph changed but the headers' b tags, their b-derived REFERENCES, the placeholders and the entries
 *   WS10 bad-target (400), naming the input target: text, a kind-39999 address, an event id, a bad naddr, an naddr of
 *        kind 39999, an address with upper-case hex; yoyo is as it was
 *   WS11 self-target (400) for yoyo's own address, and an naddr of it, naming graph declare-shared
 *   WS12 unknown-concept (a key no node has; rover), not-own-concept (relay, "another author"; recipe, "owner"),
 *        firmware-concept (word), and not-installed (naming the concept-header concept); nothing changes
 *   WS13 a visitor 401 and a stranger 403 change nothing; an admin's wiring is the admin's; the command wires, recorded
 *        as local, and its refusal is the route's
 *   WS14 nothing is signed, published or read from a key, though the calls under test ran
 *   WS15 the locks: the concept-header concept's, then a write to lamp's own header, before anything is read
 *   WS16 declared once: listed with its inputs (target a string of at most 2048 characters with no pattern), repeatKey
 *        ['concept', 'target'] and refusals; its /docs entry is POST
 *   (Amendment 1)
 *   WS17 a repeat whose b names an address where the graph holds no node: gong, whose b a route that draws no
 *        relationship wrote, answers already-wired with target { address, held: false, node: null }, writes nothing and
 *        draws no relationship
 *   WS18 the order of the checks: bad-target comes first, before any statement runs, on an unknown concept, another
 *        author's, a firmware concept and a graph with no concept-header concept; the header's refusals come before
 *        self-target and before the repeat; self-target comes before the repeat
 */

const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const H = require('../../helpers/sharingGraph');
const CG = require('../../helpers/cypherGraphFake');
const E = require('../../helpers/cypherEngine');

const { ROOT, TA, OWNER, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph wire-to-shared');

const ROUTE = '/api/tapestry/graph/wire-to-shared';
const NOBODY = '00000000-0000-4000-8000-0000000000bb';
const OTHER = 'ee'.repeat(32);
const BAD = 'not an address';
const w = (id, caller, concept, target, extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body: { concept, target }, ...extra });
/** The bad-target calls of the main run (WS10 and WS18), each refused before any statement runs (Amendment 1 item 4). */
const BAD_TARGET_IDS = Object.freeze(['bad-text', 'bad-39999', 'bad-event-id', 'bad-naddr', 'bad-naddr-39999', 'bad-upper', 'bad-unknown', 'bad-other', 'bad-firmware']);

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    H.needDecls(['wire-to-shared']);
    const p = await H.prepared();
    const { keys: k, made: m, addr } = p;
    const lamp = m.lamp.conceptHeader;
    const yoyo = m.yoyo.conceptHeader;
    const file = await H.fileOf('wire-to-shared', { failures: { meanwhile: [{ match: lamp, add: [] }] } });
    const before = CG.readState(file);
    const a = H.runOn(file, [
      w('visitor', 'visitor', lamp, addr.RELAY),
      w('stranger', 'stranger', lamp, addr.RELAY),
      w('relay', 'owner', lamp, addr.RELAY),
      w('relay-again', 'owner', lamp, addr.RELAY),
      w('fish', 'owner', lamp, addr.FISH),
      w('kite-fish', 'owner', m.kite.conceptHeader, addr.FISH),
      w('dog-house', 'owner', lamp, addr.dogHouse),
      w('flute-newt', 'owner', m.flute.conceptHeader, addr.NEWT),
      w('otter-naddr', 'owner', m.drum.conceptHeader, H.naddr(39998, H.PUB_OTTER, 'otter')),
      w('otter-address', 'owner', m.drum.conceptHeader, addr.OTTER),
      w('beagle', 'owner', k.beagle, addr.WIDGET0),
      w('mouse', 'owner', k.mouse, addr.RELAY),
      w('gong-ghost', 'owner', m.gong.conceptHeader, addr.GHOST),
      w('hoop-relay', 'owner', m.hoop.conceptHeader, addr.RELAY),
      w('hoop-widget', 'owner', m.hoop.conceptHeader, addr.WIDGET1),
      w('bad-text', 'owner', yoyo, BAD),
      w('bad-39999', 'owner', yoyo, `39999:${OTHER}:nostr-relay`),
      w('bad-event-id', 'owner', yoyo, H.EVENT_ID),
      w('bad-naddr', 'owner', yoyo, 'naddr1notavalidbech32string'),
      w('bad-naddr-39999', 'owner', yoyo, H.naddr(39999, H.PUB_OTTER, 'otter')),
      w('bad-upper', 'owner', yoyo, `39998:${'AB'.repeat(32)}:fish`),
      w('bad-unknown', 'owner', NOBODY, BAD),
      w('bad-other', 'owner', k.relay, BAD),
      w('bad-firmware', 'owner', k.word, BAD),
      w('self', 'owner', yoyo, addr.yoyo),
      w('self-naddr', 'owner', yoyo, H.naddr(39998, TA, 'yoyo')),
      w('other-self', 'owner', k.relay, addr.RELAY),
      w('widget-repeat', 'owner', k.widgets[2], addr.RELAY),
      w('cat-self', 'owner', k.cat, addr.cat),
      w('unknown', 'owner', NOBODY, addr.RELAY),
      w('rover', 'owner', k.rover, addr.RELAY),
      w('other', 'owner', k.relay, addr.FISH),
      w('owner-key', 'owner', k.recipe, addr.RELAY),
      w('firmware', 'owner', k.word, addr.RELAY),
      w('admin', 'admin', m.quilt.conceptHeader, addr.RELAY),
      { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
    ], {
      spy: true,
      cli: [
        { id: 'cli', argv: ['graph', 'wire-to-shared', '--concept', m.harp.conceptHeader, '--target', addr.RELAY] },
        { id: 'cli-refused', argv: ['graph', 'wire-to-shared', '--concept', k.relay, '--target', addr.FISH] },
      ],
    });
    const after = CG.readState(file);
    const ni = await H.notInstalledFile('wire-to-shared');
    const b = H.runOn(ni.file, [w('ni', 'owner', ni.beagle, addr.RELAY), w('ni-bad', 'owner', ni.beagle, BAD)]);
    return { a, b, k, m, addr, lamp, yoyo, before, after, niAfter: CG.readState(ni.file) };
  })();
  return MAIN;
}
const pointer = (target) => ['b', target, 'pointer'];
const refsTo = (s, from, to) => H.bRefs(s, from).filter((r) => r.to === to);
const sameTarget = (t, want) => !!t && show({ address: t.address, held: t.held, node: t.node }) === show(want);
/** The transactions of a state's log that rolled back before running any statement. */
const emptyRollbacks = (s) => H.transactions(s.log).filter((t) => t.end === 'rollback' && !t.steps.some((st) => st.call === 'tx.run' || st.call === 'tx.read'));

test('WS1 [AC2]: lamp is wired to relay, another author\'s concept: one pointer b, its REFERENCES to relay\'s header, the target held, and its entry', async () => {
  const { a, after, k, addr, lamp } = await main();
  const d = H.ok(a, 'relay');
  assert(d.outcome === 'wired', `wired; got ${show(d)}`);
  assert(sameTarget(d.target, { address: addr.RELAY, held: true, node: k.relay }), `target { address, held: true, node: relay's header }: the graph holds relay's lettered header (Amendment 1 item 1); got ${show(d.target)}`);
  assert(d.concept && d.concept.conceptHeader === lamp && d.letterOutOfDate === false, `the concept answered, and no letter out of date; got ${show({ concept: d.concept, letterOutOfDate: d.letterOutOfDate })}`);
  assert(d.disposition && d.disposition.wired === true && d.disposition.selfDeclared === false && d.disposition.deferred === false, `its disposition, read after the call, is wired; got ${show(d.disposition)}`);
  H.assertBValues(d, [addr.RELAY], 'lamp wired to relay');
  assert(H.bTags(after, lamp).filter((t) => t[1] === addr.RELAY).length === 1 && H.bTags(after, lamp).some((t) => show(t) === show(pointer(addr.RELAY))), `the header holds ["b", "${addr.RELAY}", "pointer"], once, after two calls; got ${show(H.bTags(after, lamp))}`);
  assert(refsTo(after, lamp, k.relay).length === 1, `one REFERENCES {source:'b-tag'} from lamp to relay's header; got ${show(H.refsFrom(after, lamp))}`);
  assert(d.change && d.change.operation === 'graph wire-to-shared' && show(d.change.by) === show({ role: 'owner', pubkey: OWNER }), `the entry is graph wire-to-shared, by the owner; got ${show(d.change)}`);
  assert(H.sameMultiset(H.changesOf(d), [
    { change: 'tag-added', node: lamp, field: 'b', now: addr.RELAY },
    { change: 'relationship-added', type: 'REFERENCES', from: lamp, to: k.relay },
  ]), `its changes, in the existing shapes with no new field; got ${show(H.changesOf(d))}`);
});

test('WS2 [AC2, Decision 6]: wired to an address no node holds, beside the b it has: a placeholder of import nostr\'s kind is made there, reported, and graph history finds it', async () => {
  const { a, after, addr, lamp } = await main();
  const d = H.ok(a, 'fish');
  assert(d.outcome === 'wired', `wired, though the graph doesn't hold the target (anyone's concept may be one); got ${show(d)}`);
  const at = H.nodesAtExactly(after, addr.FISH);
  assert(at.length === 1, `one node at ${addr.FISH}; got ${at.length}`);
  const ph = at[0];
  assert(show([...ph.labels].sort()) === show(['NostrEvent', 'TapestryNode']), `a placeholder, import nostr's kind: NostrEvent, with the shared label keyNode gives (ADR 0048 Decision 6); got ${show(ph.labels)}`);
  assert(E.plainValue(ph.props.kind) === 39998 && ph.props.pubkey === H.PUB_FISH && typeof ph.props.tapestryKey === 'string', `its kind and pubkey from the address, and a tapestryKey; got ${show(ph.props)}`);
  assert(ph.props.created_at === undefined && ph.props.id === undefined, `no created_at and no id, so every reader takes it to be a placeholder, and import nostr fills it; got ${show(ph.props)}`);
  assert(sameTarget(d.target, { address: addr.FISH, held: false, node: ph.props.tapestryKey }), `target { address, held: false, node: the placeholder } (reported, Decision 7 and Amendment 1 item 1); got ${show(d.target)}`);
  assert(refsTo(after, lamp, ph.props.tapestryKey).length === 1, `the REFERENCES {source:'b-tag'} runs to it; got ${show(H.refsFrom(after, lamp))}`);
  assert(H.sameMultiset(H.changesOf(d), [
    { change: 'tag-added', node: lamp, field: 'b', now: addr.FISH },
    { change: 'relationship-added', type: 'REFERENCES', from: lamp, to: ph.props.tapestryKey },
  ]), `its entry names the placeholder as the relationship's to; got ${show(H.changesOf(d))}`);
  assert(H.entriesNaming(after, ph.props.tapestryKey, 'graph wire-to-shared').some((e) => e.tapestryKey === d.change.id), 'graph history finds the entry by the placeholder\'s key (its keys hold it)');
  assert(H.bTags(after, lamp).some((t) => show(t) === show(pointer(addr.RELAY))) && H.bTags(after, lamp).some((t) => show(t) === show(pointer(addr.FISH))), `the new b sits beside the one lamp already held; got ${show(H.bTags(after, lamp))}`);
  H.assertBValues(d, [addr.RELAY, addr.FISH], 'lamp wired to FISH beside relay');
});

test('WS3 [Decision 6, Amendment 1 item 1]: a placeholder is made only when no node of any label is at the address, and held means a node there that isn\'t a placeholder', async () => {
  const { a, before, after, k, m, addr, lamp } = await main();
  const dh = H.ok(a, 'dog-house');
  assert(dh.outcome === 'wired' && sameTarget(dh.target, { address: addr.dogHouse, held: true, node: m.dogHouse.conceptHeader }), `lamp wired to dog house runs to its header, which has a created_at and so is held, with no NostrEvent label; got ${show(dh.target)}`);
  assert(H.nodesAtExactly(before, addr.dogHouse).length === 1 && H.nodesAtExactly(after, addr.dogHouse).length === 1, `no node was added at ${addr.dogHouse}; got ${H.nodesAtExactly(after, addr.dogHouse).length}`);
  assert(refsTo(after, lamp, m.dogHouse.conceptHeader).length === 1, `the REFERENCES {source:'b-tag'} runs to dog house's header; got ${show(H.refsFrom(after, lamp))}`);
  const kite = H.ok(a, 'kite-fish');
  const ph = H.nodesAtExactly(after, addr.FISH)[0];
  assert(kite.outcome === 'wired' && H.nodesAtExactly(after, addr.FISH).length === 1, `kite wired to FISH makes no second node there; got ${H.nodesAtExactly(after, addr.FISH).length}`);
  assert(sameTarget(kite.target, { address: addr.FISH, held: false, node: ph.props.tapestryKey }) && refsTo(after, m.kite.conceptHeader, ph.props.tapestryKey).length === 1, `kite's REFERENCES runs to the placeholder lamp's call made, and held is false: only a placeholder is there, whoever made it (Amendment 1 item 1); got ${show(kite.target)} ${show(H.refsFrom(after, m.kite.conceptHeader))}`);
  const flute = H.ok(a, 'flute-newt');
  assert(flute.outcome === 'wired' && sameTarget(flute.target, { address: addr.NEWT, held: false, node: k.newt }), `flute wired to NEWT runs to seed-firmware's placeholder there, a TapestryNode with no created_at: held false, node its key; got ${show(flute.target)}`);
  assert(H.nodesAtExactly(after, addr.NEWT).length === 1 && refsTo(after, m.flute.conceptHeader, k.newt).length === 1, `no second node at NEWT, and the REFERENCES runs to the one there; got ${H.nodesAtExactly(after, addr.NEWT).length} ${show(H.refsFrom(after, m.flute.conceptHeader))}`);
});

test('WS4 [AC2, Decision 2, Amendment 1 item 3]: an naddr target gives the b its address gives, and the same target by its address is already wired, its target as the first call\'s', async () => {
  const { a, after, m, addr } = await main();
  const drum = m.drum.conceptHeader;
  const d = H.ok(a, 'otter-naddr');
  const ph = H.nodesAtExactly(after, addr.OTTER)[0];
  assert(d.outcome === 'wired' && ph && sameTarget(d.target, { address: addr.OTTER, held: false, node: ph.props.tapestryKey }), `the naddr is turned into its address, ${addr.OTTER}, where a placeholder is made; got ${show(d)}`);
  assert(H.bTags(after, drum).filter((t) => t[1] === addr.OTTER).length === 1 && H.bTags(after, drum).some((t) => show(t) === show(pointer(addr.OTTER))) && !H.bTags(after, drum).some((t) => /^naddr1/.test(t[1])), `drum holds ["b", "${addr.OTTER}", "pointer"], once, and no naddr; got ${show(H.bTags(after, drum))}`);
  assert(H.sameMultiset(H.changesOf(d).filter((x) => x.change === 'tag-added'), [{ change: 'tag-added', node: drum, field: 'b', now: addr.OTTER }]), `its tag-added's now is the address; got ${show(H.changesOf(d))}`);
  const again = H.ok(a, 'otter-address');
  assert(again.outcome === 'already-wired' && again.change === null, `wiring drum to ${addr.OTTER} by its address then answers already-wired; got ${show(again)}`);
  assert(sameTarget(again.target, { address: addr.OTTER, held: false, node: ph.props.tapestryKey }), `its target is read from the graph as a first call answers it: the placeholder, not held (Amendment 1 item 3); got ${show(again.target)}`);
  assert(H.nodesAtExactly(after, addr.OTTER).length === 1, 'and no second node was made at OTTER');
});

test('WS5 [AC2, Decision 5, Amendment 1 item 3]: called again with the same target it answers already-wired, change null, target as a first call answers it, and writes nothing; an inherit-typed b naming the target counts', async () => {
  const { a, before, after, k, addr, lamp } = await main();
  const again = H.ok(a, 'relay-again');
  assert(again.outcome === 'already-wired' && again.change === null && again.letterOutOfDate === false, `already-wired, change null; got ${show(again)}`);
  assert(sameTarget(again.target, { address: addr.RELAY, held: true, node: k.relay }), `target { address, held: true, node: relay's header }, read from the graph (Amendment 1 item 3); got ${show(again.target)}`);
  H.assertBValues(again, [addr.RELAY], 'the repeat');
  assert(H.bTags(after, lamp).filter((t) => t[1] === addr.RELAY).length === 1 && refsTo(after, lamp, k.relay).length === 1, 'the repeat added no tag and no relationship (WS1)');
  const mouse = H.ok(a, 'mouse');
  assert(mouse.outcome === 'already-wired' && mouse.change === null, `mouse's header has ["b", relay, "inherit"]: a b naming the target, of any type, answers already-wired; got ${show(mouse)}`);
  assert(sameTarget(mouse.target, { address: addr.RELAY, held: true, node: k.relay }), `its target is relay's header, held; got ${show(mouse.target)}`);
  assert(show(H.bTags(after, k.mouse)) === show(H.bTags(before, k.mouse)) && show(H.relsOut(after, k.mouse)) === show(H.relsOut(before, k.mouse)) && H.changedSince(before, after, k.mouse).length === 0, `and nothing was written for it, no relationship drawn; got ${show(H.bTags(after, k.mouse))} ${show(H.relsOut(after, k.mouse))} ${show(H.changedSince(before, after, k.mouse))}`);
});

test('WS6 [AC2, Decision 5]: the deferral marker goes when a header is wired: kite\'s, recorded as tag-removed', async () => {
  const { a, after, m, addr } = await main();
  const kite = m.kite.conceptHeader;
  const d = H.ok(a, 'kite-fish');
  assert(d.disposition && d.disposition.deferred === false && d.disposition.wired === true, `kite is wired, no longer deferred; got ${show(d.disposition)}`);
  H.assertBValues(d, [addr.FISH], 'kite');
  assert(show(H.bTags(after, kite)) === show([pointer(addr.FISH)]), `kite's marker is gone and its pointer b is there; got ${show(H.bTags(after, kite))}`);
  const removed = H.changesOf(d).filter((x) => x.change === 'tag-removed');
  assert(H.sameMultiset(removed, [{ change: 'tag-removed', node: kite, field: 'b', was: H.MARKER }]), `its entry records the marker taken out; got ${show(H.changesOf(d))}`);
});

test('WS7 [AC2]: a lettered concept, beagle, wired to a widget: the answer says its letter no longer matches it', async () => {
  const { a, after, k, addr } = await main();
  const d = H.ok(a, 'beagle');
  assert(d.outcome === 'wired' && d.letterOutOfDate === true, `wired, its letter out of date; got ${show(d)}`);
  assert(sameTarget(d.target, { address: addr.WIDGET0, held: true, node: k.widgets[0] }), `the widget's header is held; got ${show(d.target)}`);
  assert(show(H.bTags(after, k.beagle)) === show([pointer(addr.WIDGET0)]) && refsTo(after, k.beagle, k.widgets[0]).length === 1, `beagle holds the pointer b and its REFERENCES to the widget's header; got ${show(H.bTags(after, k.beagle))}`);
});

test('WS8 [Decision 6]: a REFERENCES {source:\'b-tag\'} an import drew isn\'t doubled or recorded; firmware\'s firmware-community stub isn\'t matched', async () => {
  const { a, after, k, m, addr } = await main();
  const hoop = m.hoop.conceptHeader;
  const r = H.ok(a, 'hoop-relay');
  assert(r.outcome === 'wired' && refsTo(after, hoop, k.relay).length === 1, `hoop wired to relay keeps one REFERENCES {source:'b-tag'} to relay's header, the import's; got ${show(H.refsFrom(after, hoop))}`);
  assert(H.sameMultiset(H.changesOf(r), [{ change: 'tag-added', node: hoop, field: 'b', now: addr.RELAY }]), `and records only the tag: relationship-added only when the MERGE made it; got ${show(H.changesOf(r))}`);
  const wd = H.ok(a, 'hoop-widget');
  const toWidget = H.refsFrom(after, hoop).filter((x) => x.to === k.widgets[1]);
  assert(wd.outcome === 'wired' && toWidget.length === 2 && toWidget.filter((x) => x.props.source === 'firmware-community').length === 1 && toWidget.filter((x) => x.props.source === 'b-tag').length === 1, `the stub stays as it was, and a REFERENCES {source:'b-tag'} is drawn beside it; got ${show(toWidget)}`);
  assert(H.changesOf(wd).some((x) => show(x) === show({ change: 'relationship-added', type: 'REFERENCES', from: hoop, to: k.widgets[1] })), `and recorded; got ${show(H.changesOf(wd))}`);
  H.assertBValues(wd, [H.EVENT_ID, addr.RELAY, addr.WIDGET1], 'hoop, with its event-id b and two pointers');
});

test('WS9 [AC2]: lamp holds the three pointer b\'s it was given beside its other tags and JSON, as they were; nothing else in the graph changed', async () => {
  const { a, before, after, k, m, addr, lamp } = await main();
  assert(H.ok(a, 'relay').outcome === 'wired', 'the path under test ran (WS1)');
  assert(H.sameMultiset(H.bTags(after, lamp), [pointer(addr.RELAY), pointer(addr.FISH), pointer(addr.dogHouse)]), `lamp's b tags are exactly the three it was wired to, each once, the repeat adding none; got ${show(H.bTags(after, lamp))}`);
  const headers = [lamp, m.kite.conceptHeader, m.drum.conceptHeader, m.flute.conceptHeader, k.beagle, m.hoop.conceptHeader, m.quilt.conceptHeader, m.harp.conceptHeader];
  for (const key of headers) {
    assert(H.sameMultiset(H.otherTags(before, key), H.otherTags(after, key)) && H.jsonText(before, key) === H.jsonText(after, key), `${key}: every tag but b, and its JSON, as they were`);
  }
  const extra = H.unexpected(before, after, headers);
  assert(extra.length === 0, `nothing else in the graph changed: ${show(extra.slice(0, 8))}`);
});

test('WS10 [AC3, Decision 2, Amendment 1 item 5]: bad-target (400), naming the input target, for text, a kind-39999 address, an event id, a bad naddr, an naddr of kind 39999 and upper-case hex; yoyo is as it was', async () => {
  const { a, before, after, yoyo } = await main();
  for (const id of ['bad-text', 'bad-39999', 'bad-event-id', 'bad-naddr', 'bad-naddr-39999', 'bad-upper']) {
    const body = H.refused(a, id, 400, 'bad-target');
    assert(body.input === 'target', `${id}: the refusal names the input target; got ${show(body)}`);
  }
  assert(show(H.bTags(after, yoyo)) === show(H.bTags(before, yoyo)) && H.changedSince(before, after, yoyo).length === 0, `nothing was written for yoyo; got ${show(H.bTags(after, yoyo))} ${show(H.changedSince(before, after, yoyo))}`);
});

test('WS11 [AC3, Amendment 1 item 6]: self-target (400) for the header\'s own address and an naddr of it, naming graph declare-shared, whose job declaring it is', async () => {
  const { a, after, yoyo } = await main();
  for (const id of ['self', 'self-naddr']) {
    const body = H.refused(a, id, 400, 'self-target');
    assert(/graph declare-shared/.test(String(body.error)), `${id}: the refusal names graph declare-shared, the way to offer it; got ${show(body)}`);
  }
  assert(H.bTags(after, yoyo).length === 0, `yoyo holds no b; got ${show(H.bTags(after, yoyo))}`);
});

test('WS12 [AC3, Decision 3, Amendment 1 item 6]: unknown-concept, not-own-concept (both cases, in words that say which), firmware-concept and not-installed (naming the concept-header concept); nothing changes', async () => {
  const { a, b, before, after, k } = await main();
  for (const [id, status, code] of [['unknown', 404, 'unknown-concept'], ['rover', 404, 'unknown-concept'], ['other', 409, 'not-own-concept'], ['owner-key', 409, 'not-own-concept'], ['firmware', 409, 'firmware-concept']]) H.refused(a, id, status, code);
  assert(/another author/i.test(a.req('other').body.error) && /owner/i.test(a.req('owner-key').body.error), `the words say whose: another author's, the owner's own key's; got ${show([a.req('other').body.error, a.req('owner-key').body.error])}`);
  for (const key of [k.rover, k.relay, k.recipe, k.word]) {
    assert(show(H.bTags(before, key)) === show(H.bTags(after, key)) && H.changedSince(before, after, key).length === 0, `${key}: nothing written for a refused call; got ${show(H.changedSince(before, after, key))}`);
  }
  const ni = H.refused(b, 'ni', 409, 'not-installed');
  assert(/concept-header/.test(String(ni.error)), `not-installed names the concept-header concept; got ${show(ni)}`);
});

test('WS13 [AC3, open question 1]: a visitor and a stranger are refused; an admin\'s wiring is the admin\'s; the command wires, and refuses as the route does', async () => {
  const { a, after, m } = await main();
  assert(a.req('visitor').status === 401 && a.req('stranger').status === 403, `401 and 403; got ${a.req('visitor').status} ${a.req('stranger').status}`);
  assert(H.ok(a, 'relay').outcome === 'wired', 'neither wired lamp: the owner\'s call after them did (WS1)');
  const ad = H.ok(a, 'admin');
  assert(ad.outcome === 'wired' && ad.change && show(ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `an admin's wiring is the admin's; got ${show(ad.change && ad.change.by)}`);
  assert(H.bTags(after, m.quilt.conceptHeader).length === 1, 'quilt holds its pointer b');
  const cl = a.cmd('cli');
  assert(cl.code === 0, `the command exits 0; got ${cl.code} ${cl.stdout} ${cl.stderr}`);
  const body = JSON.parse(cl.stdout);
  assert(body.data.outcome === 'wired' && show(body.data.change.by) === show({ role: 'local', pubkey: null }), `the command wires harp, recorded as the command's; got ${show(body)}`);
  const rc = a.cmd('cli-refused');
  const rb = JSON.parse(rc.stdout);
  const route = a.req('other').body;
  assert(rc.code === 1 && rb.code === route.code && rb.error === route.error, `the command's refusal is the route's; command ${show(rb)}, route ${show(route)}`);
});

test('WS14 [AC2]: nothing is signed, published or read from a key, though the calls under test ran', async () => {
  const { a } = await main();
  assert(H.ok(a, 'relay').outcome === 'wired' && H.ok(a, 'fish').outcome === 'wired', 'the path under test ran: lamp was wired twice');
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key (D1); the spy saw ${show(a.spy)}`);
});

test('WS15 [Decision 4]: the locks: the concept-header concept\'s, then a write to lamp\'s own header, both before anything is read', async () => {
  const { a, after } = await main();
  assert(H.ok(a, 'relay').outcome === 'wired', 'the wiring of lamp ran (WS1)');
  const t = H.transactions(after.log).find((x) => x.steps.some((st) => st.call === 'meanwhile'));
  assert(t, 'a statement that writes with lamp\'s header\'s key among its parameters ran in a transaction');
  const i = t.steps.findIndex((st) => st.call === 'meanwhile');
  const first = t.steps.slice(0, i - 1);
  const trigger = t.steps[i - 1];
  assert(first.length === 1 && first[0].call === 'tx.run' && /tapestryLock/.test(first[0].query), `the transaction's first statement is the concept-header concept's lock, and nothing comes between it and the first statement naming lamp's header; got ${show(first)}`);
  assert(trigger && trigger.call === 'tx.run' && trigger.kind === 'write', `the first statement naming lamp's header writes it, and nothing was read before it; got ${show(trigger)}`);
});

test('WS16 [AC5, Decision 7, Amendment 1 item 5]: declared once: listed with its two inputs, target a string of at most 2048 characters with no pattern, repeatKey [concept, target] and refusals; its /docs entry is POST', async () => {
  const { a } = await main();
  const data = a.req('list').body.data || {};
  const mine = (data.operations || []).filter((o) => o.group === 'graph' && o.name === 'wire-to-shared');
  assert(mine.length === 1 && (data.problems || []).length === 0, `one declaration, and the catalog loads with no problems; got ${mine.length}, problems ${show(data.problems)}`);
  const e = mine[0];
  assert(e.kind === 'write' && e.access === 'owner-and-admins' && e.method === 'POST' && e.route === ROUTE && e.command === 'tapestry graph wire-to-shared', `a write for the owner and admins at ${ROUTE}; got ${show({ kind: e.kind, access: e.access, route: e.route, command: e.command })}`);
  assert(show(Object.keys(e.inputs || {}).sort()) === show(['concept', 'target']) && e.inputs.concept.required === true && e.inputs.target.required === true, `two inputs, concept and target, both required; got ${show(e.inputs)}`);
  const ts = e.inputs.target.schema || {};
  assert(ts.type === 'string' && ts.maxLength === 2048 && !('pattern' in ts), `target's schema is a string with maxLength 2048 and no pattern: its form is targetOf's to check (Amendment 1 item 5); got ${show(ts)}`);
  assert(show(e.repeatKey) === show(['concept', 'target']), `repeatKey ['concept', 'target'] (Decision 7); got ${show(e.repeatKey)}`);
  const status = Object.fromEntries((e.refusals || []).map((x) => [x.code, x.status]));
  const want = { 'bad-target': 400, 'self-target': 400, 'unknown-concept': 404, 'not-own-concept': 409, 'firmware-concept': 409, 'not-installed': 409 };
  for (const [code, st] of Object.entries(want)) assert(status[code] === st, `it declares ${code} at ${st}; got ${show(e.refusals)}`);
  assert(!('affiliated' in status), `it doesn't declare affiliated, defer-sharing's; got ${show(Object.keys(status))}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('wire-to-shared-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

test('WS17 [AC2, Amendment 1 item 3]: a repeat whose b names an address where the graph holds no node answers node null and held false, writes nothing and draws no relationship', async () => {
  const { a, before, after, m, addr } = await main();
  const gong = m.gong.conceptHeader;
  assert(H.nodesAtExactly(before, addr.GHOST).length === 0 && show(H.bTags(before, gong)) === show([pointer(addr.GHOST)]), `the setup: gong's b names ${addr.GHOST}, where no node is, as a route that draws no relationship leaves it`);
  const d = H.ok(a, 'gong-ghost');
  assert(d.outcome === 'already-wired' && d.change === null, `gong already names the target: already-wired, change null; got ${show(d)}`);
  assert(sameTarget(d.target, { address: addr.GHOST, held: false, node: null }), `target { address, held: false, node: null }: no node at the address, and a repeat makes none (Amendment 1 item 3); got ${show(d.target)}`);
  H.assertBValues(d, [addr.GHOST], 'gong');
  assert(H.nodesAtExactly(after, addr.GHOST).length === 0, `no placeholder was made at ${addr.GHOST}; got ${H.nodesAtExactly(after, addr.GHOST).length}`);
  assert(show(H.relsOut(after, gong)) === show(H.relsOut(before, gong)) && show(H.bTags(after, gong)) === show(H.bTags(before, gong)) && H.changedSince(before, after, gong).length === 0, `nothing was written and no relationship drawn for gong; got ${show(H.relsOut(after, gong))} ${show(H.changedSince(before, after, gong))}`);
});

test('WS18 [AC3, Amendment 1 item 4]: the order of the checks: bad-target first, before any statement; then the header\'s refusals, before self-target and the repeat; then self-target, before the repeat', async () => {
  const { a, b, before, after, k, niAfter } = await main();
  for (const id of ['bad-unknown', 'bad-other', 'bad-firmware']) {
    const body = H.refused(a, id, 400, 'bad-target');
    assert(body.input === 'target', `${id}: a bad target is refused bad-target, naming the input, though the concept is unknown, another author's or firmware's; got ${show(body)}`);
  }
  const niBad = H.refused(b, 'ni-bad', 400, 'bad-target');
  assert(niBad.input === 'target', `on a graph with no concept-header concept, a bad target is still refused bad-target: its form is checked before the locks; got ${show(niBad)}`);
  const empty = emptyRollbacks(after);
  assert(empty.length === BAD_TARGET_IDS.length, `each of the ${BAD_TARGET_IDS.length} bad-target calls was refused in a transaction that ran no statement ("checked in apply before any statement"), and no other call was; got ${empty.length}: ${show(empty.map((t) => String(t.error || '').slice(0, 80)))}`);
  assert(emptyRollbacks(niAfter).length === 1, `and so was the one on the graph with no concept-header concept; got ${emptyRollbacks(niAfter).length}`);
  const os = H.refused(a, 'other-self', 409, 'not-own-concept');
  assert(/another author/i.test(os.error), `relay wired to its own address is refused not-own-concept, not self-target: the header's refusals come first; got ${show(os)}`);
  const wr = H.refused(a, 'widget-repeat', 409, 'not-own-concept');
  assert(/another author/i.test(wr.error), `a widget whose b already names relay, wired to relay, is refused not-own-concept, not answered already-wired; got ${show(wr)}`);
  H.refused(a, 'cat-self', 400, 'self-target');
  for (const key of [k.relay, k.widgets[2], k.cat, k.word]) {
    assert(show(H.bTags(before, key)) === show(H.bTags(after, key)) && H.changedSince(before, after, key).length === 0, `${key}: nothing written for a refused call; got ${show(H.changedSince(before, after, key))}`);
  }
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
