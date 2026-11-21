'use strict';
/**
 * rules check — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/45-property-has-one-parent.md (AC2, AC5's check
 *          refusals, AC8's listing, /docs, callers and command)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0045-property-has-one-parent.md (Decisions 2 to 5;
 *          Amendment 1)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/45-property-has-one-parent.test-plan.md
 *
 * Stack-free: the real catalog, over test/helpers/propertyParentsGraph.js's seed (it says what the graph holds, and
 * checks itself against the rule restated in plain JavaScript). Every request runs on a copy of the seed's state, so a
 * read is compared with the graph it read.
 *
 *   CK1  the whole graph: the rules it ran, the scope, how many it judged, and the eleven findings, by tapestryKey
 *   CK2  a finding as check answers it: id, rule, code, message, node, primary, concepts, parents, fix or choice
 *   CK3  an id is the same for the same finding on the same graph, and changes when the node's parents do
 *   CK4  a concept's scope and a node's: what each finds and judges; a node that isn't a property judges nothing
 *   CK5  rules: every rule with a scan when left out; unknown-rule and not-checkable, naming A10.31
 *   CK6  unknown-node: a scope naming no node, a change entry or a tag; missing-input for no scope
 *   CK7  paging: limit and cursor page the findings in order; a cursor from another scope is refused
 *   CK8  a check changes nothing and records nothing
 *   CK9  callers: 401 signed out, 403 neither owner nor admin; the admin's check answers
 *   CK10 listed as a read for the owner and admins, with its inputs and refusals, and its /docs entry
 *   CK11 tapestry rules check --scope graph answers the route's findings, with no sign-in
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const P = require('../../helpers/propertyGraph');
const PG = require('../../helpers/propertyParentsGraph');
const G = require('../../helpers/graphFake');

const { ROOT, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: rules check');

const DECL = path.join(ROOT, 'src/operations/catalog/rules/check.js');
const ROUTE = '/api/tapestry/rules/check';
const RULE = 'property-has-one-parent';
const NOBODY = '00000000-0000-4000-8000-0000000000cb';
const ID = /^property-has-one-parent:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:[0-9a-f]{12}$/;

let seeded = null;
async function seed() {
  if (!seeded) seeded = await PG.preparePropertyParents('rules-check');
  return seeded;
}
/** A copy of the seed's state in a directory of its own, optionally changed first. */
async function copy(mutate = null) {
  const ctx = await seed();
  const s = S.readState(ctx.file);
  if (mutate) mutate(s, ctx);
  const file = path.join(tmp('rules-check-'), 'graph.json');
  G.writeState(file, s);
  return { ctx, file };
}
const q = (params) => Object.entries(params).flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => `${k}=${encodeURIComponent(x)}`) : v === undefined ? [] : [`${k}=${encodeURIComponent(v)}`])).join('&');
const get = (id, params, caller = 'owner') => ({ id, method: 'GET', url: `${ROUTE}?${q(params)}`, caller });
function needDecl(x) {
  if (!fs.existsSync(DECL)) throw new Error(`src/operations/catalog/rules/check.js does not exist yet (ADR graph-operations-first-slice/0045 Decision 5): GET ${ROUTE} answered ${x.status}`);
}
function ok(r, id) {
  const x = r.req(id);
  needDecl(x);
  assert(x.status === 200 && x.body && x.body.success && x.body.data, `${id} must answer 200; got ${x.status} ${show(x.body).slice(0, 600)}`);
  return x.body.data;
}
function refused(r, id, status, code) {
  const x = r.req(id);
  needDecl(x);
  assert(x.status === status && x.body.code === code, `${id} must be refused ${status} ${code}; got ${x.status} ${show(x.body).slice(0, 600)}`);
  return x.body;
}
const keysOf = (d) => (d.violations || []).map((v) => v.node && v.node.tapestryKey);
const nameOf = (ctx, key) => (Object.entries(ctx.x).find(([, v]) => v === key) || [key])[0];

let main = null;
/** One run over a copy of the seed: the whole graph twice, every scope, the rules, the refusals and the pages. */
async function mainRun() {
  if (main) return main;
  const { ctx, file } = await copy();
  const before = S.readState(file);
  const c = ctx.c;
  const entry = before.nodes.find((n) => n.labels.includes('GraphChange'));
  const tag = before.nodes.find((n) => n.labels.includes('NostrEventTag') && typeof n.props.tapestryKey === 'string');
  assert(entry && tag, 'the seed holds a change entry and a tag with a tapestryKey');
  const requests = [
    // Story graph-operations-first-slice #47 adds a second rule with a scan (ADR 0047), so each check here names this
    // suite's rule; 'graph-all' leaves rules out, as CK5 asks.
    get('graph', { scope: 'graph', rules: [RULE], limit: 200 }),
    get('graph-again', { scope: 'graph', rules: [RULE], limit: 200 }),
    get('graph-all', { scope: 'graph', limit: 200 }),
    get('graph-rules', { scope: 'graph', rules: [RULE], limit: 200 }),
    get('grok', { scope: c.grokBot, rules: [RULE], limit: 200 }),
    get('tea', { scope: ctx.made.teaHouse.conceptHeader, rules: [RULE], limit: 200 }),
    get('lamp', { scope: ctx.made.lamp.conceptHeader, rules: [RULE], limit: 200 }),
    get('bookshop', { scope: ctx.made.bookshop.conceptHeader, rules: [RULE], limit: 200 }),
    get('node-project', { scope: ctx.x.grokProject, rules: [RULE] }),
    get('node-clean', { scope: ctx.f.bot.project, rules: [RULE] }),
    get('node-element', { scope: ctx.el.lapsang, rules: [RULE] }),
    get('node-unhooked', { scope: ctx.x.unhooked, rules: [RULE] }),
    get('r-unknown-rule', { scope: 'graph', rules: ['no-such-rule'] }),
    get('r-not-checkable', { scope: 'graph', rules: ['set-has-a-parent'] }),
    get('r-nobody', { scope: NOBODY }),
    get('r-entry', { scope: entry.props.tapestryKey }),
    get('r-tag', { scope: tag.props.tapestryKey }),
    get('r-no-scope', {}),
    get('page1', { scope: 'graph', rules: [RULE], limit: 4 }),
    get('visitor', { scope: 'graph', rules: [RULE] }, 'visitor'),
    get('stranger', { scope: 'graph', rules: [RULE] }, 'stranger'),
    get('admin', { scope: 'graph', rules: [RULE], limit: 200 }, 'admin'),
    { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'owner' },
  ];
  const r = P.runOn(file, requests, [{ id: 'cli', argv: ['rules', 'check', '--scope', 'graph', '--rules', RULE, '--limit', '200'] }]);
  const after = S.readState(file);
  main = { ctx, file, r, before, after, entry, tag };
  return main;
}

test('CK1 [AC2, Decision 5]: the whole graph: the rules run, the scope, how many were judged, and the eleven findings by tapestryKey', async () => {
  const { ctx, r, before } = await mainRun();
  const d = ok(r, 'graph');
  assert(show(d.rules) === show([RULE]), `it ran ${RULE}, the rule named; got ${show(d.rules)}`);
  assert(d.scope && d.scope.kind === 'graph', `the scope is the whole graph; got ${show(d.scope)}`);
  assert(d.judged === PG.judgedProperties(before).length, `it judged every property with a parent (${PG.judgedProperties(before).length}); got ${d.judged}`);
  assert(d.found === ctx.FINDINGS.length && show(keysOf(d)) === show(ctx.FINDINGS), `the eleven findings, by the node's tapestryKey; got ${d.found} ${show(keysOf(d).map((k) => nameOf(ctx, k)))}`);
  assert(d.cursor === null, `one page holds them all: cursor null; got ${show(d.cursor)}`);
});

test('CK2 [AC2, Decision 3, Amendment 1]: a finding as check answers it', async () => {
  const { ctx, r } = await mainRun();
  const d = ok(r, 'graph');
  const v = Object.fromEntries(d.violations.map((x) => [x.node.tapestryKey, x]));
  const grok = v[ctx.x.grokProject];
  assert(ID.test(grok.id) && grok.id.split(':')[1] === ctx.x.grokProject && grok.rule === RULE && grok.code === 'more-than-one-parent', `its id, rule and code; got ${show({ id: grok.id, rule: grok.rule, code: grok.code })}`);
  for (const f of ['tapestryKey', 'name', 'address', 'author', 'own']) assert(f in grok.node, `its node is answered as reads answer a node, with ${f}; got ${show(grok.node)}`);
  assert(grok.primary === false && show(grok.concepts.map((x) => x.tapestryKey)) === show([ctx.c.grokBot]) && grok.parents.length === 2, `not primary; its concept grok bot; two parents; got ${show({ primary: grok.primary, concepts: grok.concepts, parents: grok.parents.length })}`);
  assert(grok.fix && show(grok.fix.removes) === show([{ type: PG.MEMBER, from: ctx.x.grokProject, to: ctx.schema.grokBot }]) && grok.fix.firmware === false && grok.choice === null,
    `its fix takes off the link to its own schema; got ${show({ fix: grok.fix, choice: grok.choice })}`);
  assert(v[ctx.x.wordSpelling].fix && v[ctx.x.wordSpelling].fix.firmware === true, `word's spelling's fix is marked firmware: it needs the override; got ${show(v[ctx.x.wordSpelling].fix)}`);
  for (const key of ctx.CHOICES) assert(v[key].fix === null && v[key].choice && v[key].choice.why && v[key].choice.wayOn, `${nameOf(ctx, key)} answers a choice and no fix; got ${show({ fix: v[key].fix, choice: v[key].choice })}`);
  const relay = v[ctx.x.relayMotto].choice;
  assert(/claim/i.test(`${relay.why} ${relay.wayOn}`), `another author's concept is that author's claim, as repair will answer it (Amendment 1); got ${show(relay)}`);
});

test('CK3 [Decision 3]: an id is the same for the same finding on the same graph, and changes when the node\'s parents do', async () => {
  const { ctx, r } = await mainRun();
  const ids = (d) => Object.fromEntries(d.violations.map((x) => [x.node.tapestryKey, x.id]));
  const a = ids(ok(r, 'graph'));
  assert(show(a) === show(ids(ok(r, 'graph-again'))), 'two checks of one graph give the same ids');
  assert(new Set(Object.values(a)).size === ctx.FINDINGS.length, `each finding has its own id; got ${show(a)}`);
  const { file } = await copy((s, c) => { const b = P.over(s); b.link(b.byKey(c.x.teamLead), PG.MEMBER, b.byKey(c.pp.person)); });
  const r2 = P.runOn(file, [get('moved', { scope: 'graph', limit: 200 })]);
  const m = ids(ok(r2, 'moved'));
  assert(m[ctx.x.teamLead] && m[ctx.x.teamLead] !== a[ctx.x.teamLead], `team.lead's id changes when it gains a parent; got ${a[ctx.x.teamLead]} then ${m[ctx.x.teamLead]}`);
  for (const k of ctx.FINDINGS.filter((x) => x !== ctx.x.teamLead)) assert(m[k] === a[k], `${nameOf(ctx, k)}'s id stays as it was`);
});

test('CK4 [AC2, Decisions 2 and 4]: a concept\'s scope and a node\'s', async () => {
  const { ctx, r } = await mainRun();
  const grok = ok(r, 'grok');
  assert(grok.scope.kind === 'concept' && grok.scope.tapestryKey === ctx.c.grokBot && grok.scope.name === 'grok bot', `the scope is grok bot, a concept; got ${show(grok.scope)}`);
  assert(show(keysOf(grok)) === show([ctx.x.grokProject]), `grok bot's one finding is its project; got ${show(keysOf(grok))}`);
  for (const [id, want] of [['tea', [ctx.x.shared]], ['lamp', [ctx.x.schemaOnly]], ['bookshop', [ctx.x.misplacedPP]]]) {
    assert(show(keysOf(ok(r, id))) === show(want), `${id}'s scope finds ${show(want.map((k) => nameOf(ctx, k)))}; got ${show(keysOf(ok(r, id)).map((k) => nameOf(ctx, k)))}`);
  }
  const n = ok(r, 'node-project');
  assert(n.scope.kind === 'node' && n.scope.tapestryKey === ctx.x.grokProject && n.judged === 1 && show(keysOf(n)) === show([ctx.x.grokProject]), `a node's scope judges the node; got ${show({ scope: n.scope, judged: n.judged, found: keysOf(n) })}`);
  const clean = ok(r, 'node-clean');
  assert(clean.judged === 1 && clean.found === 0 && show(clean.violations) === show([]), `bot's project, under its primary property alone, is judged and has no finding; got ${show(clean)}`);
  const el = ok(r, 'node-element');
  assert(el.judged === 0 && el.found === 0, `an element isn't a property: nothing is judged; got ${show(el)}`);
  const u = ok(r, 'node-unhooked');
  assert(u.found === 0, `a property under no parent has no finding (open question 3); got ${show(u)}`);
});

test('CK5 [AC5, Decision 5]: rules: every rule with a scan when left out; unknown-rule and not-checkable, naming A10.31', async () => {
  const { r } = await mainRun();
  assert(show(keysOf(ok(r, 'graph-rules'))) === show(keysOf(ok(r, 'graph'))), 'naming the rule finds what naming it finds again');
  // Story graph-operations-first-slice #47 (ADR 0047 Decision 5): left out, rules are every rule with a scan, both.
  const all = ok(r, 'graph-all');
  assert(show(all.rules) === show([RULE, 'word-types-hold-concept-keys']), `left out, rules are every rule with a scan: ${RULE} and word-types-hold-concept-keys; got ${show(all.rules)}`);
  assert(show(all.violations.filter((v) => v.rule === RULE).map((v) => v.node.tapestryKey)) === show(keysOf(ok(r, 'graph'))), `run beside the other rule, ${RULE} finds what it finds alone`);
  const u = refused(r, 'r-unknown-rule', 400, 'unknown-rule');
  assert(/no-such-rule/.test(u.error) && u.error.includes(RULE), `unknown-rule names the rule asked for and the rules there are; got ${show(u.error)}`);
  const n = refused(r, 'r-not-checkable', 409, 'not-checkable');
  assert(/set-has-a-parent/.test(n.error) && /A10\.31/.test(n.error), `not-checkable names the rule and A10.31; got ${show(n.error)}`);
});

test('CK6 [AC5, Decision 4]: unknown-node for a scope naming no node, a change entry or a tag; missing-input for no scope', async () => {
  const { r } = await mainRun();
  for (const id of ['r-nobody', 'r-entry', 'r-tag']) {
    const b = refused(r, id, 404, 'unknown-node');
    assert(/scope/.test(b.error) || b.input === 'scope', `${id}'s refusal names the scope; got ${show(b)}`);
  }
  refused(r, 'r-no-scope', 400, 'missing-input');
});

test('CK7 [Decision 5]: limit and cursor page the findings in order; a cursor from another scope is refused', async () => {
  const { ctx, r, file } = await mainRun();
  const pages = [ok(r, 'page1')];
  let guard = 0;
  while (pages[pages.length - 1].cursor && guard++ < 10) {
    const cur = pages[pages.length - 1].cursor;
    const next = P.runOn(file, [get('next', { scope: 'graph', rules: [RULE], limit: 4, cursor: cur })]);
    pages.push(ok(next, 'next'));
  }
  assert(show(pages.map((p) => p.violations.length)) === show([4, 4, 3]) && pages[2].cursor === null, `three pages of 4, 4 and 3, the last with cursor null; got ${show(pages.map((p) => [p.violations.length, p.cursor ? 'cursor' : null]))}`);
  assert(show(pages.flatMap(keysOf)) === show(ctx.FINDINGS) && pages.every((p) => p.found === ctx.FINDINGS.length), 'the pages, in order, are the eleven findings, and each page says how many there are');
  const bad = P.runOn(file, [get('garbage', { scope: 'graph', rules: [RULE], cursor: 'not-a-cursor' }), get('other-scope', { scope: ctx.c.grokBot, rules: [RULE], cursor: pages[0].cursor })]);
  refused(bad, 'garbage', 400, 'invalid-cursor');
  refused(bad, 'other-scope', 400, 'invalid-cursor');
});

test('CK8 [AC2]: a check changes nothing and records nothing', async () => {
  const { r, before, after } = await mainRun();
  ok(r, 'graph');
  assert(P.same(P.graphOf(before), P.graphOf(after)), 'the graph after the checks is the graph before them');
  assert(after.nodes.filter((n) => n.labels.includes('GraphChange')).length === before.nodes.filter((n) => n.labels.includes('GraphChange')).length, 'no change entry was recorded');
});

test('CK9 [AC8]: callers: 401 signed out, 403 neither owner nor admin; the admin\'s check answers', async () => {
  const { ctx, r } = await mainRun();
  needDecl(r.req('visitor'));
  assert(r.req('visitor').status === 401 && r.req('stranger').status === 403, `401 and 403; got ${r.req('visitor').status} ${r.req('stranger').status}`);
  assert(show(keysOf(ok(r, 'admin'))) === show(ctx.FINDINGS), "the admin's check finds the eleven");
});

test('CK10 [AC8]: listed as a read for the owner and admins, with its inputs and refusals, and its /docs entry', async () => {
  const { r } = await mainRun();
  const e = ((ok(r, 'list') || {}).operations || []).find((o) => o.group === 'rules' && o.name === 'check');
  assert(e, `rules check is listed; problems: ${show((r.req('list').body.data || {}).problems)}`);
  assert(e.kind === 'read' && e.access === 'owner-and-admins', `a read for the owner and admins; got ${show({ kind: e.kind, access: e.access })}`);
  const ins = e.inputs || {};
  assert(show(Object.keys(ins).sort()) === show(['cursor', 'limit', 'rules', 'scope']) && ins.scope.required === true, `inputs scope (required), rules, limit and cursor; got ${show(ins)}`);
  const codes = (e.refusals || []).map((x) => x.code);
  for (const code of ['unknown-node', 'unknown-rule', 'not-checkable', 'invalid-cursor', 'missing-input', 'sign-in-required', 'not-allowed']) assert(codes.includes(code), `its refusals include ${code}; got ${show(codes)}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('rules-check-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['get']), `/docs has GET ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

test('CK11 [AC8]: tapestry rules check --scope graph answers the route\'s findings, with no sign-in', async () => {
  const { ctx, r } = await mainRun();
  const c = r.cmd('cli');
  if (!fs.existsSync(DECL)) throw new Error(`src/operations/catalog/rules/check.js does not exist yet (ADR 0045 Decision 5): the command exited ${c.code}`);
  assert(c.code === 0, `the command exits 0; got ${c.code} ${String(c.stdout).slice(0, 300)} ${String(c.stderr).slice(0, 300)}`);
  const body = JSON.parse(c.stdout);
  assert(show(keysOf(body.data)) === show(ctx.FINDINGS), `the command finds the eleven; got ${show(keysOf(body.data))}`);
});

module.exports = { run };
if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));
