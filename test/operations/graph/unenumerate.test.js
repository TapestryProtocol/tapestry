'use strict';
/**
 * graph unenumerate — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/19-enumerate.md (AC5, AC6 and AC7 over the fake; the
 *          live check covers the reinstall, the restore, nginx and the relay)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0019-enumerate-and-unenumerate.md (Option A;
 *          Decisions 1, 2, 5 and 10–12)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/19-enumerate.test-plan.md
 *
 * Stack-free: the real catalog, over test/helpers/enumerationGraph.js's seed (it says what the graph holds), with the
 * spy on. The suite makes these links by hand first, as today's routes leave them: projects, from project's superset,
 * with the relationship event today's route signs for it; sponsor, twice, from project's superset and from person's;
 * flag, from the flagship set; cliField and adminField, from project's superset; grok bot's project, from project's
 * superset (its tree tangled, the seed's); and firmware's shape, person's superset to bot's JSON schema node. Then U0
 * links bot's project with graph enumerate; U1 takes that link out alone, so the graph before and after it can be
 * compared whole; U2 takes out the others and repeats; UR holds only refusals; UC takes a link out of a property with
 * none after the schema moved ahead of the tree. not-installed has a run of its own.
 *
 *   UE1  a link graph enumerate made is taken out: that ENUMERATES goes, and nothing else changes; nothing is signed
 *   UE2  the answer: unenumerated; the property; the source it had; removed; letters; the property writes' fields; the
 *        change entry enumeration-removed { type, from, to, concept, nodes }
 *   UE3  graph history finds the entry by the property, the source, the superset and the property's concept;
 *        list-relationships on the property lists no link
 *   UE4  the property's values are judged by its schema alone again: an element whose value is a name is made
 *   UE5  a letter today's route signed for the link: the answer names it, and says what it searched
 *   UE6  every ENUMERATES into the property goes, whatever its start: two, counted; one from a set
 *   UE7  called again, or on a property with no link: not-enumerated, change null, source null, nothing recorded
 *   UE8  a property with no link whose tree is out of line with its schema: not-enumerated, the catching up recorded
 *   UE9  unknown-property: no node, a primary property, a concept header, an element
 *   UE10 not-own-concept, firmware-concept and tangled-tree: Grok Bots' project keeps its link
 *   UE11 the refusal run changed nothing and recorded nothing
 *   UE12 not-installed
 *   UE13 callers: 401, 403, 415; an admin's is the admin's; nothing is signed
 *   UE14 the internal command takes a link out, recorded as the command's; its refusal is the route's
 *   UE15 listed with its guard, repeatKey, its one input and every refusal, and its /docs entry; inputs are checked
 *   UE16 firmware's edge to a JSON schema node is never taken out
 *   UE17 the write's first statements set and clear the lock on the property's concept's header
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const P = require('../../helpers/propertyGraph');
const EG = require('../../helpers/enumerationGraph');
const G = require('../../helpers/graphFake');

const { ROOT, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph unenumerate');

const DECL = path.join(ROOT, 'src/operations/catalog/graph/unenumerate.js');
const ENUMERATE = path.join(ROOT, 'src/operations/catalog/graph/enumerate.js');
const RULE = 'element-fits-schema';
const PROPERTY_WRITE_CODES = ['not-installed', 'unknown-property', 'not-own-concept', 'firmware-concept', 'no-primary-property', 'not-wrapped', 'unreadable-schema', 'tangled-tree', 'not-own-node', 'marked-field', 'schema-too-large', 'bad-schema', 'no-free-address', 'invalid-fields', 'no-schema'];

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/unenumerate.js does not exist yet (ADR graph-operations-first-slice/0019 Decision 5)');
  if (!fs.existsSync(ENUMERATE)) throw new Error('src/operations/catalog/graph/enumerate.js does not exist yet (ADR graph-operations-first-slice/0019 Decision 2): this suite\'s first link is graph enumerate\'s');
}
const post = (route) => (id, caller, body, extra = {}) => ({ id, method: 'POST', url: EG.ROUTE[route], caller, body, ...extra });
const un = post('unenumerate');
const en = post('enumerate');
const get = (id, url, caller = 'owner') => ({ id, method: 'GET', url, caller });
const history = (id, key) => get(id, `${EG.ROUTE.history}?node=${key}&limit=200`);

const changesOf = (d, name) => ((d && d.change && d.change.changes) || []).filter((c) => c.change === name);
const err = (body) => String(body && body.error);
const graphOf = (s) => ({ nodes: s.nodes, rels: s.rels });
const entries = (s) => s.nodes.filter((n) => n.labels.includes('GraphChange'));
const jsonTags = (s, keys) => keys.map((k) => P.json(s, k));

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    needDecl();
    const ctx = await EG.prepareEnumeration('unenumerate');
    const { file, c, sup, set, f, el } = ctx;
    EG.link(file, sup.project, f.bot.projects);
    const letter = EG.letter(file, ctx, sup.project, f.bot.projects);
    EG.link(file, sup.project, f.bot.sponsor);
    EG.link(file, sup.person, f.bot.sponsor);
    EG.link(file, set.flagship, f.bot.flag);
    EG.link(file, sup.project, f.bot.cliField);
    EG.link(file, sup.project, f.bot.adminField);
    EG.link(file, sup.project, f.grokBot.project);
    EG.link(file, sup.person, ctx.schema.bot, { destinationPath: 'bot.spare', sourcePath: 'slug' });
    const start = S.readState(file);

    const u0 = P.runOn(file, [en('link', 'owner', { property: f.bot.project, source: c.project })]);
    const beforeU1 = S.readState(file);
    const u1 = P.runOn(file, [un('unlink', 'owner', { property: f.bot.project })], [], true);
    const afterU1 = S.readState(file);
    const u2 = P.runOn(file, [
      un('again', 'owner', { property: f.bot.project }),
      un('none', 'owner', { property: f.bot.spare }),
      un('projects', 'owner', { property: f.bot.projects }),
      un('sponsor', 'owner', { property: f.bot.sponsor }),
      un('flag', 'owner', { property: f.bot.flag }),
      un('admin', 'admin', { property: f.bot.adminField }),
      un('visitor', 'visitor', { property: f.bot.cliField }),
      un('stranger', 'stranger', { property: f.bot.cliField }),
      un('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ property: f.bot.cliField }) }),
      post('createElement')('after', 'owner', { concept: c.bot, name: 'After Unlink', fields: { description: 'made once the link is gone', project: 'Infinite Harness' } }),
      get('list', EG.ROUTE.list, 'admin'),
      history('h-property', f.bot.project), history('h-source', c.project), history('h-superset', sup.project), history('h-concept', c.bot),
      get('lr', `${EG.ROUTE.listRelationships}?node=${f.bot.project}&type=ENUMERATES&limit=200`),
    ], [
      { id: 'cli', argv: ['graph', 'unenumerate', '--property', f.bot.cliField] },
      { id: 'cli-refused', argv: ['graph', 'unenumerate', '--property', f.relayMotto] },
    ], true);
    const afterU2 = S.readState(file);
    const ur = P.runOn(file, [
      un('r-nobody', 'owner', { property: EG.NOBODY }),
      un('r-primary', 'owner', { property: ctx.pp.bot }),
      un('r-header', 'owner', { property: c.bot }),
      un('r-element', 'owner', { property: el.grokOne }),
      un('r-other', 'owner', { property: f.relayMotto }),
      un('r-owner-key', 'owner', { property: f.recipeDish }),
      un('r-firmware', 'owner', { property: f.wordSpelling }),
      un('r-grok', 'owner', { property: f.grokBot.project }),
      un('r-hut', 'owner', { property: f.hutDoor }),
      un('r-missing', 'owner', {}),
      un('r-bad-key', 'owner', { property: 'not a tapestryKey' }),
      un('r-source-input', 'owner', { property: f.bot.spare, source: c.project }),
    ]);
    const afterUR = S.readState(file);
    const s = S.readState(file);
    P.over(s).editJson(s.nodes.find((n) => n.props.tapestryKey === ctx.schema.bot), (j) => { j.jsonSchema.properties.bot.properties.extra = { type: 'string' }; });
    G.writeState(file, s);
    const uc = P.runOn(file, [un('catchup', 'owner', { property: f.bot.spare })]);
    const afterUC = S.readState(file);
    return { ctx, letter, start, u0, u1, u2, ur, uc, beforeU1, afterU1, afterU2, afterUR, afterUC };
  })();
  return MAIN;
}
function ok(runResult, id) {
  const x = runResult.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body).slice(0, 800)}`);
  return x.body.data;
}
function refused(runResult, id, status, code) {
  const x = runResult.req(id);
  assert(x.status === status && x.body.code === code, `${id} must be refused ${status} ${code}; got ${x.status} ${show(x.body).slice(0, 600)}`);
  return x.body;
}
const removedCount = (d) => changesOf(d, 'enumeration-removed').reduce((n, x) => n + (Number.isInteger(x.count) ? x.count : 1), 0);

test('UE1 [AC5, Decision 5]: a link graph enumerate made is taken out: that ENUMERATES goes, and nothing else changes; nothing is signed', async () => {
  const { u0, u1, ctx, beforeU1, afterU1 } = await main();
  assert(ok(u0, 'link').outcome === 'enumerated', 'graph enumerate made the link first');
  ok(u1, 'unlink');
  const { sup, f, c, el } = ctx;
  assert(EG.linksInto(beforeU1, f.bot.project).length === 1 && EG.linksInto(afterU1, f.bot.project).length === 0, 'the link into bot\'s project is gone');
  const relKey = (s, r) => `${r.type} ${(s.nodes.find((n) => n.eid === r.from) || { props: {} }).props.tapestryKey} ${(s.nodes.find((n) => n.eid === r.to) || { props: {} }).props.tapestryKey}`;
  const before = new Set(beforeU1.rels.map((r) => relKey(beforeU1, r)));
  const after = new Set(afterU1.rels.map((r) => relKey(afterU1, r)));
  const gone = [...before].filter((x) => !after.has(x));
  const came = [...after].filter((x) => !before.has(x));
  assert(show(gone) === show([`ENUMERATES ${sup.project} ${f.bot.project}`]) && came.length === 0, `only that link goes, and no relationship comes; got gone ${show(gone)}, new ${show(came)}`);
  const newNodes = afterU1.nodes.filter((n) => !beforeU1.nodes.some((x) => x.eid === n.eid));
  const goneNodes = beforeU1.nodes.filter((n) => !afterU1.nodes.some((x) => x.eid === n.eid));
  assert(newNodes.length === 1 && newNodes[0].labels.includes('GraphChange') && goneNodes.length === 0, `the one node made is the change entry, and none goes: the property stays; got made ${show(newNodes.map((n) => n.labels))}, gone ${goneNodes.length}`);
  const changed = beforeU1.nodes.filter((n) => { const m = afterU1.nodes.find((x) => x.eid === n.eid); return m && P.canon(m.props) !== P.canon(n.props); });
  assert(changed.length === 0, `no node's properties change; got ${show(changed.map((n) => n.props.uuid || n.props.tapestryKey))}`);
  const bots = [el.grokOne, el.grokTwo, el.grokThree, el.grokFour, el.grokFive, el.peerBot];
  assert(P.same(jsonTags(afterU1, bots), jsonTags(beforeU1, bots)), 'no element changes');
  assert(Array.isArray(u1.spy) && u1.spy.length === 0, `nothing is signed, published or read from a key store; the spy saw ${show(u1.spy)}`);
  void c;
});

test('UE2 [AC5, Decisions 10 and 11]: the answer: unenumerated; the property; the source it had; removed; letters; the property writes\' fields; one enumeration-removed change', async () => {
  const { u1, ctx } = await main();
  const { c, sup, f } = ctx;
  const d = ok(u1, 'unlink');
  assert(d.outcome === 'unenumerated', `outcome unenumerated; got ${show(d.outcome)}`);
  assert(d.property && d.property.property === f.bot.project && d.property.concept === c.bot && d.property.field === 'project', `the property, as the property writes answer one; got ${show(d.property)}`);
  assert(d.source && d.source.concept === c.project && d.source.name === 'project' && d.source.superset === sup.project, `the source it had: { concept, name, superset }; got ${show(d.source)}`);
  assert(d.removed === 1, `removed: 1; got ${show(d.removed)}`);
  assert(d.letters && Array.isArray(d.letters.addresses) && d.letters.addresses.length === 0 && d.letters.searched !== undefined, `letters: { addresses: [], searched }, no letter claiming a link graph enumerate made; got ${show(d.letters)}`);
  assert(show(d.caughtUp) === show({ added: [], changed: [], removed: [] }) && show(d.filledIn) === show([]) && d.letterOutOfDate === false && d.cacheOutOfDate === false && d.elements && typeof d.elements === 'object',
    `the property writes' fields; got ${show({ caughtUp: d.caughtUp, filledIn: d.filledIn, letterOutOfDate: d.letterOutOfDate, cacheOutOfDate: d.cacheOutOfDate })}`);
  assert(d.change && d.change.operation === 'graph unenumerate' && show(d.change.by) === show({ role: 'owner', pubkey: S.OWNER }) && d.change.changes.length === 1, `one change, the owner's; got ${show(d.change)}`);
  const x = changesOf(d, 'enumeration-removed')[0] || {};
  assert(x.type === 'ENUMERATES' && x.from === sup.project && x.to === f.bot.project && x.concept === c.project && show(x.nodes) === show([c.bot]) && (x.count === undefined || x.count === 1),
    `enumeration-removed { type: ENUMERATES, from: the superset, to: the property, concept: the source's header, nodes: [the property's concept], count }; got ${show(x)}`);
});

test('UE3 [AC5, Decision 11]: graph history finds the entry by the property, the source, the superset and the property\'s concept; list-relationships lists no link', async () => {
  const { u1, u2 } = await main();
  const id = ok(u1, 'unlink').change.id;
  for (const h of ['h-property', 'h-source', 'h-superset', 'h-concept']) {
    const ids = ok(u2, h).entries.map((e) => e.id);
    assert(ids.includes(id), `${h}: graph history finds the removal's entry; got ${show(ids).slice(0, 300)}`);
  }
  assert(show(ok(u2, 'lr').relationships) === '[]', `list-relationships on the property lists no ENUMERATES; got ${show(ok(u2, 'lr').relationships)}`);
});

test('UE4 [AC5]: the property\'s values are judged by its schema alone again: an element whose project is a name is made', async () => {
  const { u0, u1, u2, ctx, beforeU1 } = await main();
  assert(ok(u0, 'link').outcome === 'enumerated' && EG.linksInto(beforeU1, ctx.f.bot.project).length === 1 && ok(u1, 'unlink').outcome === 'unenumerated',
    'the path under test ran: bot\'s project was linked, then the link taken out');
  const d = ok(u2, 'after');
  assert(d.outcome === 'created', `create-element makes After Unlink, its project a name, once the link is gone; got ${show(d)}`);
});

test('UE5 [AC5, Decision 5]: a letter today\'s route signed for the link: the answer names it, and says what it searched', async () => {
  const { u2, letter, ctx, afterU2 } = await main();
  const d = ok(u2, 'projects');
  assert(d.outcome === 'unenumerated' && d.removed === 1 && EG.linksInto(afterU2, ctx.f.bot.projects).length === 0, `projects' link, today's route's, is taken out; got ${show({ outcome: d.outcome, removed: d.removed })}`);
  assert(d.letters && show(d.letters.addresses) === show([letter]), `the relationship event that still claims it is named by its address; got ${show(d.letters)}`);
  assert(d.letters.searched !== undefined && d.letters.searched !== null, `and the answer says what the search covered; got ${show(d.letters)}`);
  assert(afterU2.nodes.some((n) => n.props.uuid === letter), 'the letter itself is left as it is: taking it back is export nostr\'s (A10.34)');
});

test('UE6 [AC5, Decision 5]: every ENUMERATES into the property goes, whatever its start: two, counted; one from a set', async () => {
  const { u2, ctx, afterU2 } = await main();
  const two = ok(u2, 'sponsor');
  assert(two.outcome === 'unenumerated' && two.removed === 2 && removedCount(two) === 2, `sponsor's two links, from project's superset and from person's, both go, counted; got ${show({ removed: two.removed, changes: two.change && two.change.changes })}`);
  const froms = changesOf(two, 'enumeration-removed').map((x) => x.from).sort();
  assert(show(froms) === show([ctx.sup.project, ctx.sup.person].sort()), `the entry names both starts; got ${show(froms)}`);
  const set = ok(u2, 'flag');
  assert(set.outcome === 'unenumerated' && set.removed === 1 && changesOf(set, 'enumeration-removed').some((x) => x.from === ctx.set.flagship), `flag's link, from the flagship set, goes; got ${show(set)}`);
  for (const p of [ctx.f.bot.sponsor, ctx.f.bot.flag]) assert(EG.linksInto(afterU2, p).length === 0, 'no link is left into it');
});

test('UE7 [AC5]: called again, or on a property with no link: not-enumerated, change null, source null, nothing removed or recorded', async () => {
  const { u2, ctx, afterU2 } = await main();
  for (const id of ['again', 'none']) {
    const d = ok(u2, id);
    assert(d.outcome === 'not-enumerated' && d.change === null && d.source === null && d.removed === 0, `${id}: not-enumerated, change null, source null, removed 0; got ${show({ outcome: d.outcome, change: d.change, source: d.source, removed: d.removed })}`);
  }
  assert(entries(afterU2).filter((e) => e.props.operation === 'graph unenumerate' && (e.props.keys || []).includes(ctx.f.bot.project)).length === 1, 'bot\'s project has the one removal entry: the repeat recorded nothing');
  assert(!entries(afterU2).some((e) => e.props.operation === 'graph unenumerate' && (e.props.keys || []).includes(ctx.f.bot.spare)), 'and spare none');
});

test('UE8 [AC5, amendment 4]: a property with no link whose concept\'s tree is out of line with its schema: not-enumerated, the catching up recorded', async () => {
  const { uc, afterUC, ctx } = await main();
  const d = ok(uc, 'catchup');
  assert(d.outcome === 'not-enumerated', `not-enumerated; got ${show(d.outcome)}`);
  assert(d.caughtUp.added.map((x) => x.field).includes('extra') && d.change && changesOf(d, 'property-added').some((x) => x.field === 'extra' && x.catchUp === true) && changesOf(d, 'enumeration-removed').length === 0,
    `its entry records the catching up alone; got ${show(d.change && d.change.changes)}`);
  assert(P.treeOf(afterUC, ctx.c.bot).some((x) => x.name === 'extra'), 'extra has its property node now');
});

test('UE9 [AC6]: unknown-property: a key that names no node, a concept\'s primary property, a concept header, an element', async () => {
  const { ur, ctx } = await main();
  for (const [id, key] of [['r-nobody', EG.NOBODY], ['r-primary', ctx.pp.bot], ['r-header', ctx.c.bot], ['r-element', ctx.el.grokOne]]) {
    const body = refused(ur, id, 404, 'unknown-property');
    assert(body.input === 'property' && err(body).includes(key), `${id}: names the input and the key; got ${show(body)}`);
  }
});

test('UE10 [AC6, Decision 5]: not-own-concept, firmware-concept and tangled-tree, as the property writes refuse them: Grok Bots\' project keeps its link', async () => {
  const { ur, ctx, afterUR } = await main();
  for (const [id, code] of [['r-other', 'not-own-concept'], ['r-owner-key', 'not-own-concept'], ['r-firmware', 'firmware-concept'], ['r-grok', 'tangled-tree'], ['r-hut', 'tangled-tree']]) refused(ur, id, 409, code);
  assert(EG.linksInto(afterUR, ctx.f.grokBot.project).length === 1, 'the link today\'s route made into Grok Bots\' project stays until its tree is repaired (rules repair, A10.31)');
});

test('UE11 [AC6]: the refusal run changed nothing and recorded nothing', async () => {
  const { ur, afterU2, afterUR } = await main();
  const ids = Object.keys(ur.requests);
  const answered = ids.filter((id) => { const x = ur.req(id); return x.status >= 400 && x.status < 500 && x.body && typeof x.body.code === 'string'; });
  assert(answered.length === ids.length, `every call of the refusal run was refused by the operation, with a code; these weren't: ${show(ids.filter((id) => !answered.includes(id)))}`);
  refused(ur, 'r-missing', 400, 'missing-input');
  refused(ur, 'r-bad-key', 400, 'invalid-input');
  refused(ur, 'r-source-input', 400, 'unknown-input');
  assert(P.same(graphOf(afterUR), graphOf(afterU2)), 'every refusal left the graph as it was');
});

test('UE12 [Decision 5]: not-installed: the graph has no property concept', async () => {
  needDecl();
  const seed = await P.seedProperties({ without: ['property'] });
  const file = seed.file(tmp('unenumerate-not-installed-'));
  refused(P.runOn(file, [un('n', 'owner', { property: EG.NOBODY })]), 'n', 409, 'not-installed');
});

test('UE13 [AC7]: a visitor gets 401, a stranger 403, a text/plain body 415; an admin\'s is the admin\'s; nothing is signed', async () => {
  const { u2, ctx, afterU2 } = await main();
  assert(u2.req('visitor').status === 401 && u2.req('stranger').status === 403 && u2.req('text').status === 415, `401, 403 and 415; got ${u2.req('visitor').status} ${u2.req('stranger').status} ${u2.req('text').status}`);
  const ad = ok(u2, 'admin');
  assert(ad.outcome === 'unenumerated' && show(ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the admin's removal is the admin's; got ${show(ad.change && ad.change.by)}`);
  assert(Array.isArray(u2.spy) && u2.spy.length === 0, `nothing signs, publishes or reads a key; the spy saw ${show(u2.spy)}`);
  void ctx; void afterU2;
});

test('UE14 [AC7]: tapestry graph unenumerate --property takes a link out with no sign-in, recorded as the command\'s; its refusal is the route\'s', async () => {
  const { u2, ctx, afterU2 } = await main();
  const c = u2.cmd('cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.data.outcome === 'unenumerated' && show(body.data.change.by) === show({ role: 'local', pubkey: null }), `the command takes the link out, its entry naming the command; got ${show(body)}`);
  assert(EG.linksInto(afterU2, ctx.f.bot.cliField).length === 0, 'cliField\'s link is gone');
  const rc = u2.cmd('cli-refused');
  const rb = JSON.parse(rc.stdout);
  assert(rc.code === 1 && rb.code === 'not-own-concept', `the command's refusal is the route's; got ${show(rb)}`);
});

test('UE15 [AC7]: listed with its guard, repeatKey, its one input and every refusal, and its /docs entry', async () => {
  const { u2 } = await main();
  const e = ((u2.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'unenumerate');
  assert(e, `graph unenumerate is listed; problems: ${show((u2.req('list').body.data || {}).problems)}`);
  assert(e.kind === 'write' && e.access === 'owner-and-admins' && show(e.guards) === show([RULE]) && show(e.repeatKey) === show(['property']),
    `a write for the owner and admins, guard ${RULE}, repeatKey [property]; got ${show({ kind: e.kind, access: e.access, guards: e.guards, repeatKey: e.repeatKey })}`);
  assert(show(Object.keys(e.inputs || {})) === show(['property']) && e.inputs.property.required === true, `one input, property, required; got ${show(e.inputs)}`);
  const codes = (e.refusals || []).map((x) => x.code);
  for (const code of [...PROPERTY_WRITE_CODES, 'missing-input', 'invalid-input', 'unknown-input', 'wrong-content-type', 'sign-in-required', 'not-allowed']) assert(codes.includes(code), `its refusals include ${code}; got ${show(codes)}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(EG.ROUTE.unenumerate)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('unenumerate-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${EG.ROUTE.unenumerate}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

test('UE16 [Decision 1]: firmware\'s edge to a JSON schema node is never taken out', async () => {
  const { u1, start, afterUC, ctx } = await main();
  assert(ok(u1, 'unlink').outcome === 'unenumerated', 'the path under test ran');
  const fw = (s) => EG.linksInto(s, ctx.schema.bot);
  assert(fw(start).length === 1 && P.same(fw(afterUC), fw(start)), `person's superset to bot's JSON schema node stays as it was; got ${show(fw(afterUC))}`);
});

test('UE17 [Decisions 5 and 12]: the write\'s first statements set and clear the lock on the property\'s concept\'s header', async () => {
  const { ctx, beforeU1, afterU1 } = await main();
  const txns = P.transactions(afterU1.log, beforeU1.log.length).filter((t) => t.end === 'commit');
  assert(txns.length === 1, `one committed write; got ${show(txns.map((t) => t.steps.map((st) => st.kind)))}`);
  const writes = txns[0].steps.filter((st) => st.call === 'tx.run');
  assert(writes[0] && writes[0].kind === 'copies' && show(writes[0].keys) === show([ctx.c.bot]) && writes[1] && writes[1].kind === 'copies' && show(writes[1].keys) === show([ctx.c.bot]),
    `its first two statements that write set and clear the lock on bot's header; got ${show(writes.slice(0, 3))}`);
  assert(writes.some((st) => st.kind === 'delete') && writes.some((st) => st.kind === 'create'), `then the link's DELETE and the entry; got ${show(writes.map((st) => st.kind))}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
