'use strict';
/**
 * graph declare-shared — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/48-declare-a-concept-shared.md (AC1, AC3, AC5)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0048-declare-shared-wire-to-shared-defer-sharing.md
 *          (Decisions 1, 3–8 and 10; Amendment 1, items 2, 4 and 6)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/48-declare-a-concept-shared.test-plan.md
 *
 * Stack-free: the real catalog in a child (test/helpers/operationsHarness.js) over test/helpers/sharingGraph.js's graph,
 * every statement run on the Cypher engine, so the self-loop's MERGE runs as Neo4j runs it. One run holds every call
 * below, in order, with the spy on; a second, over a graph with no concept-header concept, holds not-installed. The
 * first run's graph marks, with the Cypher fake's failures.meanwhile (no other write, only a mark in the log), the first
 * statement that writes with lamp's header's key among its parameters.
 *
 *   DS1  lamp, a concept with no letter: declared; its header holds ["b", "39998:<TA>:lamp", "pointer"] once and the
 *        self-loop REFERENCES {source:'b-tag'} once; the answer gives the concept, its disposition (self-declared) and
 *        disposition.bValues (sorted, distinct, read after the call), and letterOutOfDate false
 *   DS2  the other tags and the JSON of each header declared are as they were, and nothing else in the graph changed
 *        but their b tags, their b-derived REFERENCES and the change entries
 *   DS3  one change entry for the call, graph declare-shared, the owner's: tag-added { node, field: 'b', now } and
 *        relationship-added { type: 'REFERENCES', from, to }, in the existing shapes; graph history finds it by the header
 *   DS4  a lettered concept, beagle: declared, letterOutOfDate true
 *   DS5  called again: already-declared, change null, nothing written; cat, whose header has an untyped b naming its own
 *        address (any type counts): already-declared, nothing written
 *   DS6  the deferral marker goes: kite's one and bird's two, each recorded as tag-removed { node, field: 'b', was }
 *   DS7  drum's self-loop, which an import drew, isn't doubled, and no relationship-added is recorded for it
 *   DS8  unknown-concept (a key no node has; rover, an element; the node at 39998:<TA>:held), not-own-concept (relay,
 *        another author's, "another author"; recipe, at the owner's key, "owner"; and a widget whose own b names its own
 *        address, refused before the repeat is read), firmware-concept (word); nothing changes
 *   DS9  not-installed, naming the concept-header concept: a graph with no concept-header concept
 *   DS10 a visitor 401, a stranger 403 and a text/plain body 415 change nothing; an admin's declaration is the admin's;
 *        the command declares, recorded as local, and its refusal is the route's
 *   DS11 nothing is signed, published or read from a key (the spy), and the calls under test ran
 *   DS12 the locks: the concept-header concept's lock, then a write to lamp's header, before anything is read
 *   DS13 declared once: listed with its kind, access, inputs, repeatKey and refusals; its /docs entry is POST
 *   DS14 the docs: the catalog's §2 rows and "At a glance" (65 operations, 29 graph writes), §9's row for today's three
 *        routes and set-b-tag's own row; BIBLE §25; inherit-from.md's implementation note; the agent skill
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const H = require('../../helpers/sharingGraph');
const CG = require('../../helpers/cypherGraphFake');

const { ROOT, TA, OWNER, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph declare-shared');

const ROUTE = '/api/tapestry/graph/declare-shared';
const NOBODY = '00000000-0000-4000-8000-0000000000bb';
const post = (id, caller, body, extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body, ...extra });
const c = (concept) => ({ concept });

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    H.needDecls(['declare-shared']);
    const p = await H.prepared();
    const { keys: k, made: m, addr } = p;
    const lamp = m.lamp.conceptHeader;
    const file = await H.fileOf('declare-shared', { failures: { meanwhile: [{ match: lamp, add: [] }] } });
    const before = CG.readState(file);
    const a = H.runOn(file, [
      post('visitor', 'visitor', c(lamp)),
      post('stranger', 'stranger', c(lamp)),
      post('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify(c(lamp)) }),
      post('lamp', 'owner', c(lamp)),
      post('lamp-again', 'owner', c(lamp)),
      post('beagle', 'owner', c(k.beagle)),
      post('cat', 'owner', c(k.cat)),
      post('kite', 'owner', c(m.kite.conceptHeader)),
      post('bird', 'owner', c(k.bird)),
      post('drum', 'owner', c(m.drum.conceptHeader)),
      post('unknown', 'owner', c(NOBODY)),
      post('rover', 'owner', c(k.rover)),
      post('held', 'owner', c(k.held)),
      post('other', 'owner', c(k.relay)),
      post('owner-key', 'owner', c(k.recipe)),
      post('widget-self', 'owner', c(k.widgets[3])),
      post('firmware', 'owner', c(k.word)),
      post('admin', 'admin', c(m.dogHouse.conceptHeader)),
      { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
    ], {
      spy: true,
      cli: [
        { id: 'cli', argv: ['graph', 'declare-shared', '--concept', m.harp.conceptHeader] },
        { id: 'cli-refused', argv: ['graph', 'declare-shared', '--concept', k.relay] },
      ],
    });
    const after = CG.readState(file);
    const ni = await H.notInstalledFile('declare-shared');
    const b = H.runOn(ni.file, [post('ni', 'owner', c(ni.beagle))]);
    return { a, b, k, m, addr, lamp, before, after };
  })();
  return MAIN;
}
const selfB = (address) => ['b', address, 'pointer'];
const loopsOf = (s, key) => H.bRefs(s, key).filter((r) => r.to === key);

test('DS1 [AC1]: lamp, a concept with no letter, is declared: its header holds the self-pointing pointer b once, with the self-loop it draws', async () => {
  const { a, after, m, lamp } = await main();
  const self = `39998:${TA}:lamp`;
  assert(m.lamp.address === self, `the setup's lamp is at ${self}; got ${m.lamp.address}`);
  const d = H.ok(a, 'lamp');
  assert(d.outcome === 'declared', `declared; got ${show(d)}`);
  assert(d.concept && d.concept.conceptHeader === lamp && d.concept.address === self, `the concept, as the concept writes answer it (K.answerOf); got ${show(d.concept)}`);
  assert(d.letterOutOfDate === false, `lamp has no letter, so none is out of date; got ${show(d.letterOutOfDate)}`);
  assert(d.disposition && d.disposition.selfDeclared === true && d.disposition.wired === false && d.disposition.deferred === false, `its disposition, read after the call, is self-declared (dispositionOf); got ${show(d.disposition)}`);
  H.assertBValues(d, [self], 'lamp');
  assert(show(H.bTags(after, lamp)) === show([selfB(self)]), `the header holds ["b", "${self}", "pointer"], once, after two calls; got ${show(H.bTags(after, lamp))}`);
  const loops = loopsOf(after, lamp);
  assert(loops.length === 1 && H.bRefs(after, lamp).length === 1, `and the self-loop (lamp)-[:REFERENCES {source:'b-tag'}]->(lamp), once, and no other b-derived REFERENCES (ADR 0048 Decision 6); got ${show(H.refsFrom(after, lamp))}`);
});

test('DS2 [AC1]: each header declared keeps its other tags and its JSON, and nothing else in the graph changes but the b tags, their REFERENCES and the entries', async () => {
  const { a, before, after, k, m, lamp } = await main();
  assert(H.ok(a, 'lamp').outcome === 'declared', 'the path under test ran (DS1)');
  const headers = [lamp, k.beagle, k.bird, m.kite.conceptHeader, m.drum.conceptHeader, m.dogHouse.conceptHeader, m.harp.conceptHeader];
  for (const key of headers) {
    assert(H.sameMultiset(H.otherTags(before, key), H.otherTags(after, key)), `${key}: every tag but b is as it was; before ${show(H.otherTags(before, key))}, after ${show(H.otherTags(after, key))}`);
    assert(H.jsonText(before, key) === H.jsonText(after, key), `${key}: its JSON is as it was, byte for byte`);
  }
  const extra = H.unexpected(before, after, headers);
  assert(extra.length === 0, `nothing else in the graph changed: ${show(extra.slice(0, 8))}`);
});

test('DS3 [AC1, Decision 8]: one change entry, graph declare-shared, the owner\'s, with tag-added and relationship-added in the existing shapes; graph history finds it by the header', async () => {
  const { a, after, lamp } = await main();
  const self = `39998:${TA}:lamp`;
  const d = H.ok(a, 'lamp');
  const e = d.change;
  assert(e && e.operation === 'graph declare-shared' && show(e.by) === show({ role: 'owner', pubkey: OWNER }), `the entry is graph declare-shared, by the owner; got ${show(e)}`);
  const want = [
    { change: 'tag-added', node: lamp, field: 'b', now: self },
    { change: 'relationship-added', type: 'REFERENCES', from: lamp, to: lamp },
  ];
  assert(H.sameMultiset(H.changesOf(d), want), `its changes are exactly ${show(want)}, with no new field; got ${show(H.changesOf(d))}`);
  const entries = H.entriesNaming(after, lamp, 'graph declare-shared');
  assert(entries.length === 1 && entries[0].tapestryKey === e.id, `graph history finds the one entry by the header's key (its keys hold it), and the repeat recorded none; got ${show(entries.map((x) => x.tapestryKey))}`);
});

test('DS4 [AC1]: a lettered concept, beagle, is declared, and the answer says its letter no longer matches it', async () => {
  const { a, after, k } = await main();
  const d = H.ok(a, 'beagle');
  const self = `39998:${TA}:beagle`;
  assert(d.outcome === 'declared' && d.letterOutOfDate === true, `declared, and its letter is out of date (as the other graph writes answer it); got ${show(d)}`);
  assert(show(H.bTags(after, k.beagle)) === show([selfB(self)]) && loopsOf(after, k.beagle).length === 1, `its header holds the self-pointing b and the self-loop, once each; got ${show(H.bTags(after, k.beagle))} ${show(H.refsFrom(after, k.beagle))}`);
});

test('DS5 [AC1, Decision 5]: called again it answers already-declared with change null and writes nothing; a header whose b names its own address untyped is already declared', async () => {
  const { a, before, after, k, addr, lamp } = await main();
  const again = H.ok(a, 'lamp-again');
  assert(again.outcome === 'already-declared' && again.change === null && again.letterOutOfDate === false, `already-declared, change null, nothing out of date; got ${show(again)}`);
  assert(again.disposition && again.disposition.selfDeclared === true, `its disposition is still self-declared; got ${show(again.disposition)}`);
  H.assertBValues(again, [`39998:${TA}:lamp`], 'the repeat');
  assert(H.bTags(after, lamp).length === 1 && loopsOf(after, lamp).length === 1 && H.entriesNaming(after, lamp, 'graph declare-shared').length === 1, 'the repeat added no tag, no relationship and no entry (DS1, DS3)');
  const cat = H.ok(a, 'cat');
  assert(cat.outcome === 'already-declared' && cat.change === null, `cat's header has ["b", "${addr.cat}"], untyped: a b naming its own address, of any type, is a declaration (as today's route reads it); got ${show(cat)}`);
  H.assertBValues(cat, [addr.cat], 'cat');
  assert(show(H.bTags(after, k.cat)) === show([['b', addr.cat]]) && H.bRefs(after, k.cat).length === 0 && H.changedSince(before, after, k.cat).length === 0, `and nothing was written for it: its one b as it was, no relationship, no change recorded; got ${show(H.bTags(after, k.cat))} ${show(H.changedSince(before, after, k.cat))}`);
});

test('DS6 [AC1, Decision 5]: the deferral marker goes when a header is declared: kite\'s one and bird\'s two, each recorded as tag-removed', async () => {
  const { a, after, k, m, addr } = await main();
  const kite = m.kite.conceptHeader;
  const d = H.ok(a, 'kite');
  assert(d.outcome === 'declared' && d.letterOutOfDate === false && d.disposition && d.disposition.deferred === false && d.disposition.selfDeclared === true, `kite is declared, no longer deferred; got ${show(d)}`);
  assert(show(H.bTags(after, kite)) === show([selfB(addr.kite)]), `kite's marker is gone and its self-pointing b is there; got ${show(H.bTags(after, kite))}`);
  H.assertBValues(d, [addr.kite], 'kite');
  assert(H.sameMultiset(H.changesOf(d), [
    { change: 'tag-added', node: kite, field: 'b', now: addr.kite },
    { change: 'tag-removed', node: kite, field: 'b', was: H.MARKER },
    { change: 'relationship-added', type: 'REFERENCES', from: kite, to: kite },
  ]), `its entry records the marker taken out as tag-removed { node, field: 'b', was: '${H.MARKER}' }; got ${show(H.changesOf(d))}`);
  const b = H.ok(a, 'bird');
  assert(b.outcome === 'declared' && b.letterOutOfDate === true, `bird, lettered, is declared and its letter out of date; got ${show(b)}`);
  assert(show(H.bTags(after, k.bird)) === show([selfB(addr.bird)]), `both of bird's markers are gone; got ${show(H.bTags(after, k.bird))}`);
  H.assertBValues(b, [addr.bird], 'bird');
  const removed = H.changesOf(b).filter((x) => x.change === 'tag-removed');
  assert(H.sameMultiset(removed, [1, 2].map(() => ({ change: 'tag-removed', node: k.bird, field: 'b', was: H.MARKER }))), `one tag-removed for each marker it took out; got ${show(H.changesOf(b))}`);
});

test('DS7 [Decision 6]: drum\'s self-loop, which an import drew, isn\'t doubled, and no relationship-added is recorded for it', async () => {
  const { a, after, m, addr } = await main();
  const drum = m.drum.conceptHeader;
  const d = H.ok(a, 'drum');
  assert(d.outcome === 'declared', `drum is declared; got ${show(d)}`);
  assert(loopsOf(after, drum).length === 1, `one self-loop REFERENCES {source:'b-tag'}, the one already there (a MERGE with its source in the pattern); got ${show(H.refsFrom(after, drum))}`);
  assert(H.sameMultiset(H.changesOf(d), [{ change: 'tag-added', node: drum, field: 'b', now: addr.drum }]), `its entry records the tag alone: relationship-added only when the MERGE made it (Decision 8); got ${show(H.changesOf(d))}`);
});

test('DS8 [AC3, Decision 3, Amendment 1 items 4 and 6]: unknown-concept, not-own-concept (both cases, in words that say which, and before the repeat is read) and firmware-concept are refused, and none changes anything', async () => {
  const { a, before, after, k } = await main();
  for (const [id, status, code] of [['unknown', 404, 'unknown-concept'], ['rover', 404, 'unknown-concept'], ['held', 404, 'unknown-concept'], ['other', 409, 'not-own-concept'], ['owner-key', 409, 'not-own-concept'], ['firmware', 409, 'firmware-concept']]) {
    const body = H.refused(a, id, status, code);
    assert(typeof body.error === 'string' && body.error.trim().length > 0, `${id}: the refusal names the reason in words; got ${show(body)}`);
  }
  const other = a.req('other').body.error;
  const mine = a.req('owner-key').body.error;
  assert(/another author/i.test(other), `relay's refusal says it is another author's concept (Decision 3, Amendment 1 item 6); got ${show(other)}`);
  assert(/owner/i.test(mine) && mine !== other, `recipe's refusal says its address carries the owner's own key, which the assistant can't sign a new version of; got ${show(mine)}`);
  const ws = H.refused(a, 'widget-self', 409, 'not-own-concept');
  assert(/another author/i.test(ws.error), `a widget whose own b names its own address is another author's: refused not-own-concept, not answered already-declared, since the header's refusals come before the repeat (Amendment 1 item 4); got ${show(ws)}`);
  for (const key of [k.rover, k.held, k.relay, k.recipe, k.word, k.widgets[3]]) {
    assert(show(H.bTags(before, key)) === show(H.bTags(after, key)) && H.sameMultiset(H.refsFrom(before, key), H.refsFrom(after, key)) && H.changedSince(before, after, key).length === 0, `${key}: no tag, relationship or change was written for a refused call; got ${show(H.changedSince(before, after, key))}`);
  }
});

test('DS9 [AC3, Decision 3, Amendment 1 item 6]: not-installed: in a graph with no concept-header concept, the call is refused, naming that concept, and writes nothing', async () => {
  const { b } = await main();
  const body = H.refused(b, 'ni', 409, 'not-installed');
  assert(/concept-header/.test(String(body.error)), `the refusal names the concept-header concept, which is missing; got ${show(body)}`);
});

test('DS10 [AC3, open question 1]: a visitor, a stranger and a text/plain body are refused; an admin\'s declaration is the admin\'s; the command declares, and refuses as the route does', async () => {
  const { a, after, m, lamp } = await main();
  assert(a.req('visitor').status === 401 && a.req('stranger').status === 403 && a.req('text').status === 415, `401, 403 and 415; got ${a.req('visitor').status} ${a.req('stranger').status} ${a.req('text').status}`);
  assert(H.ok(a, 'lamp').outcome === 'declared', 'none of them declared lamp: the owner\'s call after them did (DS1)');
  const ad = H.ok(a, 'admin');
  assert(ad.outcome === 'declared' && ad.change && show(ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `an admin may declare one of the instance's concepts, and the entry names the admin; got ${show(ad.change && ad.change.by)}`);
  assert(H.bTags(after, m.dogHouse.conceptHeader).length === 1, 'and dog house holds its self-pointing b');
  const cl = a.cmd('cli');
  assert(cl.code === 0, `the command exits 0; got ${cl.code} ${cl.stdout} ${cl.stderr}`);
  const body = JSON.parse(cl.stdout);
  assert(body.data.outcome === 'declared' && show(body.data.change.by) === show({ role: 'local', pubkey: null }), `the command declares harp, recorded as the command's; got ${show(body)}`);
  const rc = a.cmd('cli-refused');
  const rb = JSON.parse(rc.stdout);
  const route = a.req('other').body;
  assert(rc.code === 1 && rb.code === route.code && rb.error === route.error, `the command's refusal is the route's; command ${show(rb)}, route ${show(route)}`);
  void lamp;
});

test('DS11 [AC1]: nothing is signed, published or read from a key, though the calls under test ran', async () => {
  const { a } = await main();
  assert(H.ok(a, 'lamp').outcome === 'declared' && H.ok(a, 'beagle').outcome === 'declared', 'the path under test ran: lamp and beagle were declared');
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key (D1); the spy saw ${show(a.spy)}`);
});

test('DS12 [Decision 4]: the locks: the concept-header concept\'s, then a write to lamp\'s own header, both before anything is read', async () => {
  const { a, after } = await main();
  assert(H.ok(a, 'lamp').outcome === 'declared', 'the declaration of lamp ran (DS1)');
  const t = H.transactions(after.log).find((x) => x.steps.some((st) => st.call === 'meanwhile'));
  assert(t, `a statement that writes with lamp's header's key among its parameters ran in a transaction; the log: ${show(H.transactions(after.log).map((x) => x.steps.map((st) => st.call === 'meanwhile' ? 'MARK' : `${st.call}:${st.kind}`)).slice(0, 4))}`);
  const i = t.steps.findIndex((st) => st.call === 'meanwhile');
  const first = t.steps.slice(0, i - 1);
  const trigger = t.steps[i - 1];
  assert(first.length === 1 && first[0].call === 'tx.run' && /tapestryLock/.test(first[0].query), `the transaction's first statement is the concept-header concept's lock (K.lock), and nothing comes between it and the first statement naming lamp's header; got ${show(first)}`);
  assert(trigger && trigger.call === 'tx.run' && trigger.kind === 'write', `the first statement naming lamp's header writes it (S.lockNode), and nothing was read before it; got ${show(trigger)}`);
});

test('DS13 [AC5, Decision 7]: declared once: listed for agents with its kind, access, input, repeatKey and refusals, and its /docs entry is POST', async () => {
  const { a } = await main();
  const data = a.req('list').body.data || {};
  const mine = (data.operations || []).filter((o) => o.group === 'graph' && o.name === 'declare-shared');
  assert(mine.length === 1 && (data.problems || []).length === 0, `one declaration, and the catalog loads with no problems; got ${mine.length}, problems ${show(data.problems)}`);
  const e = mine[0];
  assert(e.kind === 'write' && e.access === 'owner-and-admins' && e.method === 'POST' && e.route === ROUTE && e.command === 'tapestry graph declare-shared', `a write for the owner and admins at ${ROUTE}, its command tapestry graph declare-shared; got ${show({ kind: e.kind, access: e.access, method: e.method, route: e.route, command: e.command })}`);
  assert(show(Object.keys(e.inputs || {})) === show(['concept']) && e.inputs.concept.required === true, `one input, concept, required; got ${show(e.inputs)}`);
  assert(show(e.repeatKey) === show(['concept']), `repeatKey ['concept'] (Decision 7); got ${show(e.repeatKey)}`);
  const status = Object.fromEntries((e.refusals || []).map((x) => [x.code, x.status]));
  const want = { 'unknown-concept': 404, 'not-own-concept': 409, 'firmware-concept': 409, 'not-installed': 409 };
  for (const [code, st] of Object.entries(want)) assert(status[code] === st, `it declares ${code} at ${st}; got ${show(e.refusals)}`);
  for (const code of ['invalid-input', 'wrong-content-type', 'sign-in-required', 'not-allowed']) assert(code in status, `its refusals include the built-in ${code}; got ${show(Object.keys(status))}`);
  for (const code of ['bad-target', 'self-target', 'affiliated']) assert(!(code in status), `it declares only what it can answer: not ${code}, which is another of the three's; got ${show(Object.keys(status))}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('declare-shared-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

test('DS14 [AC5, Decision 10]: the docs: the catalog\'s §2 rows, "At a glance", §9\'s row for today\'s three routes and set-b-tag\'s own; BIBLE §25; inherit-from.md; the skill', () => {
  H.needDecls(['declare-shared']);
  const catalog = fs.readFileSync(path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md'), 'utf8');
  const s2 = catalog.slice(catalog.indexOf('## 2.'), catalog.indexOf('## 3.'));
  for (const op of H.DECLS) assert(s2.split('\n').some((l) => l.startsWith(`| \`${op}\``)), `the catalog's §2 has a row for ${op}`);
  assert(/At a glance \(65 operations\)/.test(catalog), `"At a glance" counts 65 operations (Decision 10: 62 → 65)`);
  const glance = catalog.slice(catalog.indexOf('## At a glance'), catalog.indexOf('## 1.'));
  assert(/Graph writes \(29\)/.test(glance), 'and 29 graph writes (26 → 29)');
  const concepts = glance.split('\n').find((l) => /^\s*- concepts:/.test(l)) || '';
  assert(H.DECLS.every((op) => concepts.includes(op)), `its concepts line lists the three; got ${show(concepts)}`);
  const s9 = catalog.slice(catalog.indexOf('## 9.'), catalog.indexOf('## 10.'));
  const rows = s9.split('\n').filter((l) => l.startsWith('|'));
  const three = rows.find((l) => /self-declare/.test(l) && /b-append/.test(l) && /b-defer/.test(l)) || '';
  assert(H.DECLS.every((op) => three.includes(op)) && !/to place in the review/.test(three), `§9's row for self-declare, b-append and b-defer says where they now are, the three operations; got ${show(three)}`);
  const setB = rows.find((l) => /set-b-tag/.test(l)) || '';
  assert(setB && setB !== three && /to place/i.test(setB), `set-b-tag has a §9 row of its own, still to place; got ${show(setB)}`);
  const bible = fs.readFileSync(path.join(ROOT, 'BIBLE.md'), 'utf8');
  const at = bible.indexOf('\n## 25. ');
  const s25 = bible.slice(at, bible.indexOf('\n## ', at + 5));
  assert(at >= 0 && H.DECLS.every((op) => s25.includes(op)), 'BIBLE §25 names the three, which write a header\'s b with no letter and draw its relationship');
  const inherit = fs.readFileSync(path.join(ROOT, 'protocols/drafts/inherit-from.md'), 'utf8');
  assert(H.DECLS.every((op) => inherit.includes(op)), 'protocols/drafts/inherit-from.md\'s implementation note names the three beside composeSelfDeclare');
  const skill = fs.readFileSync(path.join(ROOT, 'clients/cli/skill/SKILL.md'), 'utf8');
  const sentences = skill.split(/\n|(?<=\.)\s+/);
  assert(sentences.some((x) => x.includes('declare-shared') && x.includes('export nostr')), 'the skill gains one sentence: to offer a concept as a shared concept, declare it with graph declare-shared, then send it with export nostr');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
