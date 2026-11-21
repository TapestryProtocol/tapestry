'use strict';
/**
 * rules check and rules repair running word-types-hold-concept-keys — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.md (AC2)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0047-wordtypes-hold-each-concepts-key.md (Decisions 4
 *          to 6, which amend ADR 0045's Decisions 3, 5 and 6)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.test-plan.md
 *
 * Stack-free: the real catalog, over test/helpers/wordTypesGraph.js's seed (it says what the graph holds, and checks
 * itself against the rule restated in plain JavaScript). Every request runs on a copy of the seed's state.
 *
 *   WC1  the whole graph: the rule run, how many it judged, the nine findings, and notJudged: no-json 1, unreadable-json 4
 *   WC2  a finding as check answers it: id, rule, code, message, node, primary, concepts, parents, key, fix, choice
 *   WC3  ids: the same on a second check; one for each of a node's findings; every finding its own
 *   WC4  order and pages: by node, then rule, then id; pages of one walk every finding once, walker's two included,
 *        with a cursor of three parts; a cursor from another scope is refused
 *   WC5  scopes: hound's concept and a node's: what each judges, finds and couldn't judge
 *   WC6  rules: leaving them out runs both rules with a scan; naming this one runs it alone
 *   WC7  rules repair over a scope leaves every finding, each with why and the way on, and changes nothing
 *   WC8  rules repair of one violation finds it by its id among the node's findings; one that no longer matches is
 *        changed-since-check, naming the node's finding as it is now; one gone is nothing-to-repair
 *   WC9  check and repair change nothing and record nothing
 *   WC10 the declarations: check's result declares notJudged and a finding's key, check's description names both rules,
 *        and repair's says this rule's findings are left
 */

const fs = require('fs');
const path = require('path');
const S = require('../../helpers/graphOpsSuite');
const P = require('../../helpers/propertyGraph');
const W = require('../../helpers/wordTypesGraph');
const G = require('../../helpers/graphFake');

const { assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: rules check and repair run word-types-hold-concept-keys');

const RULE = W.RULE;
const OTHER_RULE = 'property-has-one-parent';
const CHECK = '/api/tapestry/rules/check';
const REPAIR = '/api/tapestry/rules/repair';
const ID = /^word-types-hold-concept-keys:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{12}$/;
const NOT_JUDGED = [{ rule: RULE, why: 'no-json', count: 1 }, { rule: RULE, why: 'unreadable-json', count: 4 }];

let seeded = null;
async function seed() {
  if (!seeded) seeded = await W.seedWordTypes('wt-check');
  return seeded;
}
/** A copy of the seed's state in a directory of its own, optionally changed first. */
async function copy(mutate = null) {
  const ctx = await seed();
  const s = S.readState(ctx.file);
  if (mutate) mutate(s, ctx);
  const file = path.join(tmp('wt-check-'), 'graph.json');
  G.writeState(file, s);
  return { ctx, file };
}
const q = (params) => Object.entries(params).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => `${k}=${encodeURIComponent(x)}`) : v === undefined ? [] : [`${k}=${encodeURIComponent(v)}`])).join('&');
const get = (id, params, caller = 'owner') => ({ id, method: 'GET', url: `${CHECK}?${q(params)}`, caller });
const post = (id, body, caller = 'owner') => ({ id, method: 'POST', url: REPAIR, caller, body });
function ok(r, id) {
  const x = r.req(id);
  assert(x.status === 200 && x.body && x.body.success && x.body.data, `${id} must answer 200; got ${x.status} ${show(x.body).slice(0, 700)}`);
  return x.body.data;
}
function refused(r, id, status, code) {
  const x = r.req(id);
  assert(x.status === status && x.body.code === code, `${id} must be refused ${status} ${code}; got ${x.status} ${show(x.body).slice(0, 600)}`);
  return x.body;
}
const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const pairsOf = (d) => (d.violations || []).map((v) => ({ node: v.node && v.node.tapestryKey, key: v.key })).sort((a, b) => byKey(a.node, b.node) || byKey(a.key, b.key));
const named = (ctx, ps) => ps.map((p) => `${W.nameIn(ctx.k, p.node)}:${p.key}`);
/** The keys walker's json tag holds, set to `wordTypes`, in a copy of the state. */
const giveWalker = (wordTypes) => (s, ctx) => {
  const b = P.over(s);
  b.editJson(b.byKey(ctx.k.walker), (j) => { j.word.wordTypes = wordTypes; });
};

let main = null;
/** One run over a copy of the seed: the whole graph twice, the scopes, the rules, the pages and the repairs. */
async function mainRun() {
  if (main) return main;
  const { ctx, file } = await copy();
  const before = S.readState(file);
  const requests = [
    get('graph', { scope: 'graph', rules: [RULE], limit: 200 }),
    get('graph-again', { scope: 'graph', rules: [RULE], limit: 200 }),
    get('graph-all', { scope: 'graph', limit: 200 }),
    get('hound', { scope: ctx.k.hound, rules: [RULE], limit: 200 }),
    get('node-walker', { scope: ctx.k.walker, rules: [RULE] }),
    get('node-rex', { scope: ctx.k.rex, rules: [RULE] }),
    get('node-mute', { scope: ctx.k.mute, rules: [RULE] }),
    get('node-word-only', { scope: ctx.k.wordOnly, rules: [RULE] }),
    get('page1', { scope: 'graph', rules: [RULE], limit: 1 }),
    post('repair-hound', { rule: RULE, scope: ctx.k.hound }),
    { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'owner' },
  ];
  const r = P.runOn(file, requests);
  const after = S.readState(file);
  main = { ctx, file, r, before, after };
  return main;
}

test('WC1 [AC2, Decision 5]: the whole graph: the rule run, how many it judged, the nine findings, and what it couldn\'t judge', async () => {
  const { ctx, r, before } = await mainRun();
  const d = ok(r, 'graph');
  assert(show(d.rules) === show([RULE]), `it ran the rule named; got ${show(d.rules)}`);
  assert(d.scope && d.scope.kind === 'graph', `the scope is the whole graph; got ${show(d.scope)}`);
  assert(d.found === ctx.FINDINGS.length && show(pairsOf(d)) === show(ctx.FINDINGS), `the nine findings, one for each key a node lacks: ${show(named(ctx, ctx.FINDINGS))}; got ${d.found} ${show(named(ctx, pairsOf(d)))}`);
  const scanned = W.scopeKeys(before, { kind: 'graph' }).length;
  assert(d.judged === scanned - ctx.UNJUDGED.length, `judged counts the items it judged: the ${scanned} it scanned less the ${ctx.UNJUDGED.length} it couldn't (Decision 5); got ${d.judged}`);
  assert(show(d.notJudged) === show(NOT_JUDGED), `notJudged, by rule then why: no-json 1, unreadable-json 4; got ${show(d.notJudged)}`);
  assert(d.cursor === null, `one page holds them all: cursor null; got ${show(d.cursor)}`);
});

test('WC2 [AC2, Decisions 4 and 5]: a finding as check answers it', async () => {
  const { ctx, r } = await mainRun();
  const d = ok(r, 'graph');
  const v = d.violations.find((x) => x.node.tapestryKey === ctx.k.houndSchema);
  assert(v, `hound's JSON schema is named; got ${show(named(ctx, pairsOf(d)))}`);
  assert(ID.test(v.id) && v.id.split(':')[1] === ctx.k.houndSchema && v.rule === RULE && v.code === 'missing-concept-key', `its id, rule and code; got ${show({ id: v.id, rule: v.rule, code: v.code })}`);
  for (const f of ['tapestryKey', 'name', 'address', 'author', 'own']) assert(f in v.node, `its node is answered as reads answer a node, with ${f}; got ${show(v.node)}`);
  assert(v.key === 'validationTool' && show(v.concepts.map((c) => [c.tapestryKey, c.name, c.firmware])) === show([[ctx.k.validationTool, 'validation tool', true]]), `its key, and the one concept whose key it lacks, marked firmware; got ${show({ key: v.key, concepts: v.concepts })}`);
  assert(v.primary === false && show(v.parents) === show([]), `primary false and no parents: they are rule 11's; got ${show({ primary: v.primary, parents: v.parents })}`);
  assert(v.fix === null && v.choice && v.choice.why && /reinstall/i.test(v.choice.wayOn), `no fix, and a choice whose way on names a firmware reinstall; got ${show({ fix: v.fix, choice: v.choice })}`);
  assert(typeof v.message === 'string' && v.message.includes('validationTool'), `its message names the key; got ${show(v.message)}`);
  for (const x of d.violations) assert(typeof x.key === 'string' && x.key, `every finding of this rule carries its key; got ${show(x)}`);
});

test('WC3 [Decision 5]: an id is the same on a second check, one for each of a node\'s findings, and every finding has its own', async () => {
  const { ctx, r } = await mainRun();
  const ids = (d) => d.violations.map((x) => x.id);
  const a = ids(ok(r, 'graph'));
  assert(show(a) === show(ids(ok(r, 'graph-again'))), 'two checks of one graph give the same ids, in the same order');
  assert(new Set(a).size === ctx.FINDINGS.length, `each finding has its own id, walker's two included; got ${show(a)}`);
  const walker = ok(r, 'graph').violations.filter((x) => x.node.tapestryKey === ctx.k.walker);
  assert(walker.length === 2 && walker[0].id !== walker[1].id && walker.every((x) => ID.test(x.id)), `walker's two findings, for hound and for pet, have two ids (the digest covers the key and the concept); got ${show(walker.map((x) => [x.key, x.id]))}`);
});

test('WC4 [Decision 5]: by node, then rule, then id; pages of one walk every finding once, walker\'s two included; a cursor from another scope is refused', async () => {
  const { ctx, r, file } = await mainRun();
  const all = ok(r, 'graph').violations;
  const order = all.map((x) => [x.node.tapestryKey, x.rule, x.id]);
  const sorted = [...order].sort((a, b) => byKey(a[0], b[0]) || byKey(a[1], b[1]) || byKey(a[2], b[2]));
  assert(show(order) === show(sorted), `findings are sorted by the node's tapestryKey, then rule, then id; got ${show(order.map((o) => [W.nameIn(ctx.k, o[0]), o[2].slice(-12)]))}`);
  const pages = [ok(r, 'page1')];
  let guard = 0;
  while (pages[pages.length - 1].cursor && guard++ < 20) {
    const next = P.runOn(file, [get('next', { scope: 'graph', rules: [RULE], limit: 1, cursor: pages[pages.length - 1].cursor })]);
    pages.push(ok(next, 'next'));
  }
  assert(pages.length === ctx.FINDINGS.length && pages.every((p) => p.violations.length === 1) && pages[pages.length - 1].cursor === null,
    `nine pages of one, the last with cursor null; got ${show(pages.map((p) => [p.violations.length, p.cursor ? 'cursor' : null]))}`);
  assert(show(pages.map((p) => p.violations[0].id)) === show(all.map((x) => x.id)), `the pages, in order, are the nine findings: none skipped between walker's two (the cursor is [node, rule, id]); got ${show(pages.map((p) => `${W.nameIn(ctx.k, p.violations[0].node.tapestryKey)}:${p.violations[0].key}`))}`);
  assert(pages.every((p) => p.found === ctx.FINDINGS.length && show(p.notJudged) === show(NOT_JUDGED)), 'every page says how many findings there are, and what it couldn\'t judge, across the whole check');
  const bad = P.runOn(file, [get('other-scope', { scope: ctx.k.hound, rules: [RULE], cursor: pages[0].cursor })]);
  refused(bad, 'other-scope', 400, 'invalid-cursor');
});

test('WC5 [AC2, AC4, Decision 3]: a concept\'s scope and a node\'s: what each judges, finds and couldn\'t judge', async () => {
  const { ctx, r, before } = await mainRun();
  const h = ok(r, 'hound');
  assert(h.scope.kind === 'concept' && h.scope.tapestryKey === ctx.k.hound && h.scope.name === 'hound', `the scope is hound, a concept; got ${show(h.scope)}`);
  const keys = W.scopeKeys(before, { kind: 'concept', key: ctx.k.hound });
  const oracle = W.missingKeys(before, keys);
  assert(show(pairsOf(h)) === show(oracle.findings.map(({ node, key }) => ({ node, key }))), `hound's findings: its schema's, and its elements'; got ${show(named(ctx, pairsOf(h)))}`);
  assert(h.judged === keys.length - oracle.unjudged.length, `it judged hound's ${keys.length} nodes less the ${oracle.unjudged.length} it couldn't; got ${h.judged}`);
  assert(show(h.notJudged) === show(NOT_JUDGED), `all five it can't judge are hound's; got ${show(h.notJudged)}`);
  const w = ok(r, 'node-walker');
  assert(w.scope.kind === 'node' && w.judged === 1 && show(pairsOf(w).map((x) => x.key)) === show(['hound', 'pet']) && show(w.notJudged) === show([]), `walker's scope: judged 1, two findings; got ${show({ judged: w.judged, keys: pairsOf(w).map((x) => x.key), notJudged: w.notJudged })}`);
  const rex = ok(r, 'node-rex');
  assert(rex.judged === 1 && rex.found === 0 && show(rex.violations) === show([]) && show(rex.notJudged) === show([]), `rex holds its key: judged, nothing found, nothing unjudged; got ${show(rex)}`);
  const mute = ok(r, 'node-mute');
  assert(mute.judged === 0 && mute.found === 0 && show(mute.notJudged) === show([{ rule: RULE, why: 'no-json', count: 1 }]), `mute has no JSON: not judged, and the answer says so, which tells it from rex (AC2); got ${show(mute)}`);
  const wordOnly = ok(r, 'node-word-only');
  assert(wordOnly.found === 0 && show(wordOnly.notJudged) === show([]), `a node only word reaches has nothing expected of it: no finding, nothing unjudged, though it has no JSON; got ${show(wordOnly)}`);
});

test('WC6 [Decision 5]: rules left out run both rules with a scan; naming this one runs it alone', async () => {
  const { r } = await mainRun();
  const all = ok(r, 'graph-all');
  assert(show(all.rules) === show([OTHER_RULE, RULE]), `left out, rules are every rule with a scan: ${OTHER_RULE} and ${RULE}; got ${show(all.rules)}`);
  assert(show(ok(r, 'graph').rules) === show([RULE]), 'naming this rule runs it alone');
  const mine = all.violations.filter((v) => v.rule === RULE).map((v) => v.id);
  assert(show(mine) === show(ok(r, 'graph').violations.map((v) => v.id)), 'run with the other rule, this rule finds what it finds alone');
});

test('WC7 [AC2, Decision 6]: rules repair over a scope leaves every finding, each with why and the way on, and changes nothing', async () => {
  const { ctx, r } = await mainRun();
  const d = ok(r, 'repair-hound');
  const checked = ok(r, 'hound').violations;
  assert(d.outcome === 'left' && show(d.fixed) === show([]) && d.remaining === 0 && d.change === null, `outcome left, nothing fixed, no change entry; got ${show({ outcome: d.outcome, fixed: d.fixed, remaining: d.remaining, change: d.change })}`);
  assert(show(d.left.map((x) => x.id).sort()) === show(checked.map((x) => x.id).sort()), `it leaves each of hound's findings, by the ids check gives; got ${show(d.left.map((x) => x.id))}`);
  for (const x of d.left) {
    const c = checked.find((y) => y.id === x.id);
    assert(x.why === c.choice.why && x.wayOn === c.choice.wayOn && x.node.tapestryKey === c.node.tapestryKey, `each left finding says why and the way on, as check's choice does; got ${show(x)}`);
  }
});

test('WC8 [Decision 6]: repair of one violation finds it by its id among the node\'s findings; a stale one is changed-since-check; a gone one is nothing-to-repair', async () => {
  const { ctx, r, file } = await mainRun();
  const walker = ok(r, 'graph').violations.filter((x) => x.node.tapestryKey === ctx.k.walker);
  const ids = Object.fromEntries(walker.map((x) => [x.key, x.id]));
  // Both of walker's findings, each by its id: whichever the node's first is, the other is found too.
  const both = P.runOn(file, [post('one-hound', { violation: ids.hound }), post('one-pet', { violation: ids.pet })]);
  for (const key of ['hound', 'pet']) {
    const d = ok(both, `one-${key}`);
    assert(d.outcome === 'left' && show(d.left.map((x) => x.id)) === show([ids[key]]) && d.change === null, `repair of walker's ${key} finding, by its id, answers it left, not changed-since-check; got ${show(d)}`);
  }
  // Given pet by hand: the pet finding is gone, the hound one stays.
  const { file: halfFile } = await copy(giveWalker(['word', 'pet']));
  const half = P.runOn(halfFile, [post('stale', { violation: ids.pet }), get('now', { scope: ctx.k.walker, rules: [RULE] })]);
  const nowId = ok(half, 'now').violations.map((x) => x.id);
  assert(show(nowId) === show([ids.hound]), `with pet given, walker's one finding is its hound one, with the same id; got ${show(nowId)}`);
  const b = refused(half, 'stale', 409, 'changed-since-check');
  assert(b.error.includes(ids.hound) && !/parents/.test(b.error), `changed-since-check names the node's finding as it is now, and doesn't speak of parents; got ${show(b.error)}`);
  // Given both by hand: nothing to repair.
  const { file: fullFile } = await copy(giveWalker(['word', 'hound', 'pet']));
  const full = P.runOn(fullFile, [post('gone', { violation: ids.hound })]);
  const g = ok(full, 'gone');
  assert(g.outcome === 'nothing-to-repair' && show(g.left) === show([]) && show(g.fixed) === show([]), `with both keys, the violation is gone: nothing-to-repair; got ${show(g)}`);
});

test('WC9 [AC1, AC2]: check and repair change nothing and record nothing', async () => {
  const { r, before, after } = await mainRun();
  ok(r, 'graph');
  ok(r, 'repair-hound');
  assert(P.same(P.graphOf(before), P.graphOf(after)), 'the graph after the checks and the repair is the graph before them');
  assert(after.nodes.filter((n) => n.labels.includes('GraphChange')).length === before.nodes.filter((n) => n.labels.includes('GraphChange')).length, 'no change entry was recorded');
});

test('WC10 [Decisions 5 and 6]: check declares notJudged and a finding\'s key, its description names both rules; repair\'s says this rule\'s findings are left', async () => {
  const { r } = await mainRun();
  const ops = (ok(r, 'list') || {}).operations || [];
  const check = ops.find((o) => o.group === 'rules' && o.name === 'check');
  const repair = ops.find((o) => o.group === 'rules' && o.name === 'repair');
  assert(check && repair, 'both operations are listed');
  const schema = (check.result && check.result.schema) || {};
  assert((schema.required || []).includes('notJudged') && schema.properties && schema.properties.notJudged, `check's result declares notJudged, required; got ${show({ required: schema.required, notJudged: schema.properties && schema.properties.notJudged })}`);
  const finding = schema.properties && schema.properties.violations && schema.properties.violations.items;
  assert(finding && finding.properties && finding.properties.key, `a finding declares its key; got ${show(finding && Object.keys(finding.properties || {}))}`);
  const desc = `${check.description || ''} ${check.summary || ''}`;
  assert(desc.includes(OTHER_RULE) && desc.includes(RULE), `check's description names the rules it runs, both; got ${show(desc.slice(0, 500))}`);
  assert((repair.description || '').includes(RULE), `repair's description says what it does with this rule's findings; got ${show((repair.description || '').slice(0, 500))}`);
});

module.exports = { run };
if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));
