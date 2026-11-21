'use strict';
/**
 * graph defer-sharing — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/48-declare-a-concept-shared.md (AC2, AC3, AC5)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0048-declare-shared-wire-to-shared-defer-sharing.md
 *          (Decisions 1, 3–5, 7 and 8; Amendment 1, items 2, 4 and 6)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/48-declare-a-concept-shared.test-plan.md
 *
 * Stack-free: the real catalog in a child over test/helpers/sharingGraph.js's graph, every statement on the Cypher
 * engine. One run holds every call below, in order, with the spy on (two of them are declare-shared's and
 * wire-to-shared's, after a deferral); a second, over a graph with no concept-header concept, holds not-installed.
 *
 *   DF1  lamp, with no b: deferred; its header holds ["b", "b-tag-deferred"] once and no relationship is drawn; the
 *        answer gives its disposition (deferred) and disposition.bValues, and letterOutOfDate false; one entry, graph
 *        defer-sharing, the owner's, with one tag-added { node, field: 'b', now: 'b-tag-deferred' }
 *   DF2  called again: already-deferred, change null, nothing written; kite, which holds the marker, and bird, which
 *        holds two (its bValues list the marker once): already-deferred, nothing written
 *   DF3  a lettered concept, beagle: deferred, letterOutOfDate true
 *   DF4  affiliated (409), nothing written, for a header with a real b: cat's names its own address (untyped), mouse's
 *        relay (inherit-typed), hoop's an event id; goal, whose only b is malformed, is deferred, that b kept (its
 *        bValues sorted)
 *   DF5  deferred, then declared or wired: the marker goes, yoyo's when declare-shared runs and quilt's when
 *        wire-to-shared runs, each recorded as tag-removed
 *   DF6  the other tags and the JSON of each header deferred are as they were, and nothing else in the graph changed
 *   DF7  unknown-concept (a key no node has; rover), not-own-concept (relay, "another author"; recipe, "owner"; and a
 *        widget that holds a real b, refused not-own-concept, not affiliated: the header's refusals come first),
 *        firmware-concept (word), and not-installed (naming the concept-header concept); nothing changes
 *   DF8  a visitor 401 and a stranger 403 change nothing; an admin's deferral is the admin's; the command defers,
 *        recorded as local, and its refusal is the route's
 *   DF9  nothing is signed, published or read from a key, though the calls under test ran
 *   DF10 the locks: the concept-header concept's, then a write to lamp's own header, before anything is read
 *   DF11 declared once: listed with its input, repeatKey ['concept'] and refusals (affiliated among them); /docs is POST
 */

const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const H = require('../../helpers/sharingGraph');
const CG = require('../../helpers/cypherGraphFake');

const { ROOT, OWNER, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph defer-sharing');

const ROUTE = '/api/tapestry/graph/defer-sharing';
const NOBODY = '00000000-0000-4000-8000-0000000000bb';
const post = (id, caller, body, url = ROUTE) => ({ id, method: 'POST', url, caller, body });
const c = (concept) => ({ concept });
const MARKER_TAG = ['b', H.MARKER];

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    H.needDecls(['defer-sharing']);
    const p = await H.prepared();
    const { keys: k, made: m, addr } = p;
    const lamp = m.lamp.conceptHeader;
    const file = await H.fileOf('defer-sharing', { failures: { meanwhile: [{ match: lamp, add: [] }] } });
    const before = CG.readState(file);
    const a = H.runOn(file, [
      post('visitor', 'visitor', c(lamp)),
      post('stranger', 'stranger', c(lamp)),
      post('lamp', 'owner', c(lamp)),
      post('lamp-again', 'owner', c(lamp)),
      post('beagle', 'owner', c(k.beagle)),
      post('kite', 'owner', c(m.kite.conceptHeader)),
      post('bird', 'owner', c(k.bird)),
      post('cat', 'owner', c(k.cat)),
      post('mouse', 'owner', c(k.mouse)),
      post('hoop', 'owner', c(m.hoop.conceptHeader)),
      post('goal', 'owner', c(k.goal)),
      post('yoyo', 'owner', c(m.yoyo.conceptHeader)),
      post('yoyo-declared', 'owner', c(m.yoyo.conceptHeader), '/api/tapestry/graph/declare-shared'),
      post('quilt', 'owner', c(m.quilt.conceptHeader)),
      post('quilt-wired', 'owner', { concept: m.quilt.conceptHeader, target: addr.RELAY }, '/api/tapestry/graph/wire-to-shared'),
      post('unknown', 'owner', c(NOBODY)),
      post('rover', 'owner', c(k.rover)),
      post('other', 'owner', c(k.relay)),
      post('owner-key', 'owner', c(k.recipe)),
      post('widget-real', 'owner', c(k.widgets[2])),
      post('firmware', 'owner', c(k.word)),
      post('admin', 'admin', c(m.dogHouse.conceptHeader)),
      { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
    ], {
      spy: true,
      cli: [
        { id: 'cli', argv: ['graph', 'defer-sharing', '--concept', m.harp.conceptHeader] },
        { id: 'cli-refused', argv: ['graph', 'defer-sharing', '--concept', k.relay] },
      ],
    });
    const after = CG.readState(file);
    const ni = await H.notInstalledFile('defer-sharing');
    const b = H.runOn(ni.file, [post('ni', 'owner', c(ni.beagle))]);
    return { a, b, k, m, addr, lamp, before, after };
  })();
  return MAIN;
}

test('DF1 [AC2]: lamp, with no b, is deferred: its header holds the marker once, no relationship is drawn, and its entry records one tag-added', async () => {
  const { a, before, after, lamp } = await main();
  const d = H.ok(a, 'lamp');
  assert(d.outcome === 'deferred', `deferred; got ${show(d)}`);
  assert(d.concept && d.concept.conceptHeader === lamp && d.letterOutOfDate === false, `the concept answered, no letter out of date; got ${show({ concept: d.concept, letterOutOfDate: d.letterOutOfDate })}`);
  assert(d.disposition && d.disposition.deferred === true && d.disposition.selfDeclared === false && d.disposition.wired === false, `its disposition is deferred (dispositionOf); got ${show(d.disposition)}`);
  H.assertBValues(d, [H.MARKER], 'lamp');
  assert(show(H.bTags(after, lamp)) === show([MARKER_TAG]), `the header holds ["b", "${H.MARKER}"], once, after two calls; got ${show(H.bTags(after, lamp))}`);
  assert(H.sameMultiset(H.refsFrom(after, lamp), H.refsFrom(before, lamp)) && H.refsFrom(after, lamp).length === 0, `the marker draws no relationship (Decision 5); got ${show(H.refsFrom(after, lamp))}`);
  assert(d.change && d.change.operation === 'graph defer-sharing' && show(d.change.by) === show({ role: 'owner', pubkey: OWNER }), `the entry is graph defer-sharing, by the owner; got ${show(d.change)}`);
  assert(H.sameMultiset(H.changesOf(d), [{ change: 'tag-added', node: lamp, field: 'b', now: H.MARKER }]), `its one change is tag-added, in the existing shape; got ${show(H.changesOf(d))}`);
  assert(H.entriesNaming(after, lamp, 'graph defer-sharing').length === 1, 'graph history finds one entry by the header: the repeat recorded none');
});

test('DF2 [AC2, Decision 5]: called again it answers already-deferred with change null; a header that holds the marker, or two, is already deferred, and nothing is written', async () => {
  const { a, before, after, k, m } = await main();
  const again = H.ok(a, 'lamp-again');
  assert(again.outcome === 'already-deferred' && again.change === null && again.letterOutOfDate === false, `already-deferred, change null; got ${show(again)}`);
  H.assertBValues(again, [H.MARKER], 'the repeat');
  for (const [id, key] of [['kite', m.kite.conceptHeader], ['bird', k.bird]]) {
    const d = H.ok(a, id);
    assert(d.outcome === 'already-deferred' && d.change === null, `${id}, which holds the marker, is already deferred; got ${show(d)}`);
    H.assertBValues(d, [H.MARKER], `${id} (bird's two markers listed once)`);
    assert(show(H.bTags(after, key)) === show(H.bTags(before, key)) && H.changedSince(before, after, key).length === 0, `${id}: nothing written, its b tags as they were; got ${show(H.bTags(after, key))} ${show(H.changedSince(before, after, key))}`);
  }
});

test('DF3 [AC2]: a lettered concept, beagle, is deferred, and the answer says its letter no longer matches it', async () => {
  const { a, after, k } = await main();
  const d = H.ok(a, 'beagle');
  assert(d.outcome === 'deferred' && d.letterOutOfDate === true, `deferred, its letter out of date; got ${show(d)}`);
  assert(show(H.bTags(after, k.beagle)) === show([MARKER_TAG]), `beagle holds the marker; got ${show(H.bTags(after, k.beagle))}`);
});

test('DF4 [AC3, Decision 5]: a header with a real b is refused affiliated, naming why, and nothing is written; a malformed b is no real b', async () => {
  const { a, before, after, k, m } = await main();
  for (const [id, key] of [['cat', k.cat], ['mouse', k.mouse], ['hoop', m.hoop.conceptHeader]]) {
    const body = H.refused(a, id, 409, 'affiliated');
    assert(typeof body.error === 'string' && body.error.trim().length > 0, `${id}: the refusal says why in words; got ${show(body)}`);
    assert(show(H.bTags(after, key)) === show(H.bTags(before, key)) && H.changedSince(before, after, key).length === 0, `${id}: nothing written; got ${show(H.bTags(after, key))} ${show(H.changedSince(before, after, key))}`);
  }
  const goal = H.ok(a, 'goal');
  assert(goal.outcome === 'deferred' && goal.disposition && goal.disposition.deferred === true, `goal's only b is malformed, which classifyBValue reads as no claim, so it is deferred; got ${show(goal)}`);
  H.assertBValues(goal, ['not-a-coordinate', H.MARKER], 'goal');
  assert(H.sameMultiset(H.bTags(after, k.goal), [['b', 'not-a-coordinate'], MARKER_TAG]), `its malformed b is kept, beside the marker; got ${show(H.bTags(after, k.goal))}`);
});

test('DF5 [AC1, AC2, Decision 5]: deferred, then declared or wired, the marker goes: a declaration or a wiring beats a deferral', async () => {
  H.needDecls();
  const { a, after, m, addr } = await main();
  const yoyo = m.yoyo.conceptHeader;
  const quilt = m.quilt.conceptHeader;
  assert(H.ok(a, 'yoyo').outcome === 'deferred' && H.ok(a, 'quilt').outcome === 'deferred', 'yoyo and quilt were deferred first');
  const dec = H.ok(a, 'yoyo-declared');
  assert(dec.outcome === 'declared' && show(H.bTags(after, yoyo)) === show([['b', addr.yoyo, 'pointer']]), `declare-shared replaces yoyo's marker with its self-pointing b; got ${show(H.bTags(after, yoyo))}`);
  H.assertBValues(dec, [addr.yoyo], 'yoyo declared');
  assert(H.changesOf(dec).some((x) => show(x) === show({ change: 'tag-removed', node: yoyo, field: 'b', was: H.MARKER })), `and records the marker taken out; got ${show(H.changesOf(dec))}`);
  const wired = H.ok(a, 'quilt-wired');
  assert(wired.outcome === 'wired' && show(H.bTags(after, quilt)) === show([['b', addr.RELAY, 'pointer']]), `wire-to-shared replaces quilt's marker with its pointer b; got ${show(H.bTags(after, quilt))}`);
  H.assertBValues(wired, [addr.RELAY], 'quilt wired');
  assert(H.changesOf(wired).some((x) => show(x) === show({ change: 'tag-removed', node: quilt, field: 'b', was: H.MARKER })), `and records the marker taken out; got ${show(H.changesOf(wired))}`);
});

test('DF6 [AC2]: each header deferred keeps its other tags and its JSON, and nothing else in the graph changes', async () => {
  const { a, before, after, k, m, lamp } = await main();
  assert(H.ok(a, 'lamp').outcome === 'deferred', 'the path under test ran (DF1)');
  const headers = [lamp, k.beagle, k.goal, m.yoyo.conceptHeader, m.quilt.conceptHeader, m.dogHouse.conceptHeader, m.harp.conceptHeader];
  for (const key of headers) {
    assert(H.sameMultiset(H.otherTags(before, key), H.otherTags(after, key)) && H.jsonText(before, key) === H.jsonText(after, key), `${key}: every tag but b, and its JSON, as they were`);
  }
  const extra = H.unexpected(before, after, headers);
  assert(extra.length === 0, `nothing else in the graph changed: ${show(extra.slice(0, 8))}`);
});

test('DF7 [AC3, Decision 3, Amendment 1 items 4 and 6]: unknown-concept, not-own-concept (both cases, in words that say which, and before affiliated), firmware-concept and not-installed; nothing changes', async () => {
  const { a, b, before, after, k } = await main();
  for (const [id, status, code] of [['unknown', 404, 'unknown-concept'], ['rover', 404, 'unknown-concept'], ['other', 409, 'not-own-concept'], ['owner-key', 409, 'not-own-concept'], ['firmware', 409, 'firmware-concept']]) H.refused(a, id, status, code);
  assert(/another author/i.test(a.req('other').body.error) && /owner/i.test(a.req('owner-key').body.error), `the words say whose: another author's, the owner's own key's; got ${show([a.req('other').body.error, a.req('owner-key').body.error])}`);
  const wr = H.refused(a, 'widget-real', 409, 'not-own-concept');
  assert(/another author/i.test(wr.error), `another author's header that holds a real b is refused not-own-concept, not affiliated: the header's refusals come before affiliated (Amendment 1 item 4); got ${show(wr)}`);
  for (const key of [k.rover, k.relay, k.recipe, k.word, k.widgets[2]]) assert(show(H.bTags(before, key)) === show(H.bTags(after, key)) && H.changedSince(before, after, key).length === 0, `${key}: nothing written for a refused call; got ${show(H.changedSince(before, after, key))}`);
  const ni = H.refused(b, 'ni', 409, 'not-installed');
  assert(/concept-header/.test(String(ni.error)), `not-installed names the concept-header concept; got ${show(ni)}`);
});

test('DF8 [AC3, open question 1]: a visitor and a stranger are refused; an admin\'s deferral is the admin\'s; the command defers, and refuses as the route does', async () => {
  const { a, after, m } = await main();
  assert(a.req('visitor').status === 401 && a.req('stranger').status === 403, `401 and 403; got ${a.req('visitor').status} ${a.req('stranger').status}`);
  assert(H.ok(a, 'lamp').outcome === 'deferred', 'neither deferred lamp: the owner\'s call after them did (DF1)');
  const ad = H.ok(a, 'admin');
  assert(ad.outcome === 'deferred' && ad.change && show(ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `an admin's deferral is the admin's; got ${show(ad.change && ad.change.by)}`);
  assert(show(H.bTags(after, m.dogHouse.conceptHeader)) === show([MARKER_TAG]), 'dog house holds the marker');
  const cl = a.cmd('cli');
  assert(cl.code === 0, `the command exits 0; got ${cl.code} ${cl.stdout} ${cl.stderr}`);
  const body = JSON.parse(cl.stdout);
  assert(body.data.outcome === 'deferred' && show(body.data.change.by) === show({ role: 'local', pubkey: null }), `the command defers harp, recorded as the command's; got ${show(body)}`);
  const rc = a.cmd('cli-refused');
  const rb = JSON.parse(rc.stdout);
  const route = a.req('other').body;
  assert(rc.code === 1 && rb.code === route.code && rb.error === route.error, `the command's refusal is the route's; command ${show(rb)}, route ${show(route)}`);
});

test('DF9 [AC2]: nothing is signed, published or read from a key, though the calls under test ran', async () => {
  const { a } = await main();
  assert(H.ok(a, 'lamp').outcome === 'deferred' && H.ok(a, 'beagle').outcome === 'deferred', 'the path under test ran: lamp and beagle were deferred');
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key (D1); the spy saw ${show(a.spy)}`);
});

test('DF10 [Decision 4]: the locks: the concept-header concept\'s, then a write to lamp\'s own header, both before anything is read', async () => {
  const { a, after } = await main();
  assert(H.ok(a, 'lamp').outcome === 'deferred', 'the deferral of lamp ran (DF1)');
  const t = H.transactions(after.log).find((x) => x.steps.some((st) => st.call === 'meanwhile'));
  assert(t, 'a statement that writes with lamp\'s header\'s key among its parameters ran in a transaction');
  const i = t.steps.findIndex((st) => st.call === 'meanwhile');
  const first = t.steps.slice(0, i - 1);
  const trigger = t.steps[i - 1];
  assert(first.length === 1 && first[0].call === 'tx.run' && /tapestryLock/.test(first[0].query), `the transaction's first statement is the concept-header concept's lock, and nothing comes between it and the first statement naming lamp's header; got ${show(first)}`);
  assert(trigger && trigger.call === 'tx.run' && trigger.kind === 'write', `the first statement naming lamp's header writes it, and nothing was read before it; got ${show(trigger)}`);
});

test('DF11 [AC5, Decision 7]: declared once: listed with its input, repeatKey [concept] and refusals, affiliated among them; its /docs entry is POST', async () => {
  const { a } = await main();
  const data = a.req('list').body.data || {};
  const mine = (data.operations || []).filter((o) => o.group === 'graph' && o.name === 'defer-sharing');
  assert(mine.length === 1 && (data.problems || []).length === 0, `one declaration, and the catalog loads with no problems; got ${mine.length}, problems ${show(data.problems)}`);
  const e = mine[0];
  assert(e.kind === 'write' && e.access === 'owner-and-admins' && e.method === 'POST' && e.route === ROUTE && e.command === 'tapestry graph defer-sharing', `a write for the owner and admins at ${ROUTE}; got ${show({ kind: e.kind, access: e.access, route: e.route, command: e.command })}`);
  assert(show(Object.keys(e.inputs || {})) === show(['concept']) && e.inputs.concept.required === true, `one input, concept, required; got ${show(e.inputs)}`);
  assert(show(e.repeatKey) === show(['concept']), `repeatKey ['concept'] (Decision 7); got ${show(e.repeatKey)}`);
  const status = Object.fromEntries((e.refusals || []).map((x) => [x.code, x.status]));
  const want = { affiliated: 409, 'unknown-concept': 404, 'not-own-concept': 409, 'firmware-concept': 409, 'not-installed': 409 };
  for (const [code, st] of Object.entries(want)) assert(status[code] === st, `it declares ${code} at ${st}; got ${show(e.refusals)}`);
  for (const code of ['bad-target', 'self-target']) assert(!(code in status), `it doesn't declare ${code}, wire-to-shared's; got ${show(Object.keys(status))}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('defer-sharing-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
