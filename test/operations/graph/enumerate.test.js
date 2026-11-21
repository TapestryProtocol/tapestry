'use strict';
/**
 * graph enumerate — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/19-enumerate.md (AC1, AC2, AC4, AC6 and AC7 over the
 *          fake; AC3's report; the live check covers the reinstall, the restore, nginx and the relay)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0019-enumerate-and-unenumerate.md (Option A;
 *          Decisions 1–4, 6, 9–12 and 14)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/19-enumerate.test-plan.md
 *
 * Stack-free: the real catalog, over test/helpers/enumerationGraph.js's seed (it says what the graph holds), with the
 * spy on everything that signs or reads a key. The suite makes these links by hand first, as today's routes leave them:
 * partner, from project's superset (POST /api/normalize/enumerate's shape); flag, from the flagship set; twice, from
 * project's superset and from the flagship set; grok bot's project, from project's superset (with its second parent,
 * the seed's); and firmware's shape, person's superset to bot's JSON schema node with a destinationPath. Then A links
 * bot's project alone, so the graph before and after it can be compared whole; B makes the other links and repeats; R
 * holds only refusals, so the graph after R is the graph before it; C repeats a link after the schema moved ahead of
 * the tree. The race, not-installed and EN14's yardstick, an enumerate refused at Decision 2's step 2, have runs of
 * their own.
 *
 *   EN1  the link: one ENUMERATES, project's superset to bot's project node, carrying nothing; nothing else changes
 *   EN2  the answer: enumerated; the property, its concept and its place; the source; the property writes' fields; the
 *        change entry enumeration-added { type, from, to, concept, nodes } and nothing else
 *   EN3  allowed: the source's elements from the owner's point of view, by tapestryKey, as list-elements lists them
 *   EN4  the values report: the elements written before the link whose value isn't allowed, everyone's, from each
 *        element's JSON; counted, named with field and values; never a refusal; every enumerated field of the concept
 *        judged, not only the one just linked (review round 1: the story's Deviation 3)
 *   EN5  graph history finds the entry by the property, the source, the superset and the property's concept;
 *        list-relationships on the property lists the link
 *   EN6  the property's own concept may be its source: person's mentor, from person
 *   EN7  what may be linked: a nullable string, a list of strings, a nested field, a pattern and a length a reference
 *        meets
 *   EN8  a format: the piece is judged by rule 4's own compile, which checks no format (Decision 4)
 *   EN9  a firmware concept may be the source, and so may another author's
 *   EN10 the same call again: already-enumerated, change null, the allowed list and the report, nothing recorded
 *   EN11 a link today's route made from the same superset is a repeat too
 *   EN12 two enumerates of one property at once make one link
 *   EN13 a repeat that finds the tree out of line with the schema brings it in line, and records that alone
 *   EN14 the write's first statements set and clear the lock on the property's concept's header; before it, only the
 *        install check and the property's concept are read (review round 1)
 *   EN15 a source of 60: allowed counts them, names the first 50 by tapestryKey, and says there are more
 *   EN16 unknown-property: no node, a primary property, a concept header, an element
 *   EN17 not-own-concept, firmware-concept and tangled-tree, as the property writes refuse them
 *   EN18 not-enumerable: a number, an object, a list of objects, a list with no item type, a type list with a number
 *   EN19 refuses-references: its own enum and const, a pattern and lengths a reference can't meet, and the same in
 *        items; each names the keyword that refuses (review round 1)
 *   EN20 enumerated-elsewhere: linked from another source's superset, or from a set, even beside a link from the
 *        source's own superset (review round 1: the story's Deviation 1); it names that start and the way on
 *   EN21 the source: unknown-concept (no node, an element; a superset or a set names its concept's header),
 *        reserved-source (word, graphContext), no-superset (none, two)
 *   EN22 the refusal run changed nothing and recorded nothing; each status is the one its declaration lists
 *   EN23 not-installed
 *   EN24 callers: 401, 403, 415; an admin's link is the admin's; nothing is signed
 *   EN25 the internal command links, recorded as the command's; its refusal is the route's
 *   EN26 listed with its guard, repeatKey, inputs and every refusal, and its /docs entry; inputs are checked
 *   EN27 firmware's edge to a JSON schema node is never read or changed
 *   EN28 add-relationship's refusal of ENUMERATES names graph enumerate and unenumerate
 *   EN29 the catalog: enumerate takes property and source, no concept; a row for unenumerate; the old routes' map sends
 *        apply-enumerations to rule 10; "At a glance" counts 65 (62 until story #48) and lists unenumerate
 *   Review round 1 (ADR 0019 Amendment 2):
 *   EN30 a list is tried with as many references as it must hold: minItems 2, with uniqueItems too, and minItems 10,000
 *        are linked; a minItems above 10,000 is refused refuses-references, in words that say so (item 1)
 *   EN31 refuses-references names each keyword that refuses, read from the check: a list's maxItems 0, a not, and a
 *        keyword inside anyOf, named by the anyOf; each with graph update-property (item 2)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const P = require('../../helpers/propertyGraph');
const EG = require('../../helpers/enumerationGraph');
const G = require('../../helpers/graphFake');

const { ROOT, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph enumerate');

const DECL = path.join(ROOT, 'src/operations/catalog/graph/enumerate.js');
const RULE = 'element-fits-schema';
const NEW_CODES = ['not-enumerable', 'refuses-references', 'enumerated-elsewhere', 'reserved-source', 'no-superset'];
/** Every refusal load and commit can give, as remove-property lists them (ADR 0019 Implementation notes), and the source's. */
const PROPERTY_WRITE_CODES = ['not-installed', 'unknown-property', 'not-own-concept', 'firmware-concept', 'no-primary-property', 'not-wrapped', 'unreadable-schema', 'tangled-tree', 'not-own-node', 'marked-field', 'schema-too-large', 'bad-schema', 'no-free-address', 'invalid-fields', 'no-schema'];

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/enumerate.js does not exist yet (ADR graph-operations-first-slice/0019 Decision 2)');
}
const post = (route) => (id, caller, body, extra = {}) => ({ id, method: 'POST', url: EG.ROUTE[route], caller, body, ...extra });
const en = post('enumerate');
const get = (id, url, caller = 'owner') => ({ id, method: 'GET', url, caller });
const history = (id, key) => get(id, `${EG.ROUTE.history}?node=${key}&limit=200`);
const ref = EG.ref;

const changesOf = (d, name) => ((d && d.change && d.change.changes) || []).filter((c) => c.change === name);
const err = (body) => String(body && body.error);
/** Whether `text` names the node keyed `key`: by its tapestryKey or by its address. */
const names = (text, key, uuidOf) => String(text).includes(key) || (uuidOf[key] && String(text).includes(uuidOf[key]));
const graphOf = (s) => ({ nodes: s.nodes, rels: s.rels });
const entries = (s) => s.nodes.filter((n) => n.labels.includes('GraphChange'));
const sorted = (xs) => [...xs].sort();

// ── MAIN ──
let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    needDecl();
    const ctx = await EG.prepareEnumeration('enumerate', { bigSource: 60 });
    const { file, c, sup, set, f, el } = ctx;
    // Today's routes' links, before anything this story builds runs (the header comment).
    EG.link(file, sup.project, f.bot.partner);
    EG.link(file, set.flagship, f.bot.flag);
    // Review round 1 (the story's Deviation 1): twice, linked from the source's superset and from a set.
    EG.link(file, sup.project, f.bot.twice);
    EG.link(file, set.flagship, f.bot.twice);
    EG.link(file, sup.project, f.grokBot.project);
    EG.link(file, sup.person, ctx.schema.bot, { destinationPath: 'bot.spare', sourcePath: 'slug' });
    const before = S.readState(file);

    const a = P.runOn(file, [en('link', 'owner', { property: f.bot.project, source: c.project })], [], true);
    const afterA = S.readState(file);

    // EN14's yardstick (review round 1): an enumerate refused at Decision 2's step 2, for a key that names no node, alone
    // on a copy of the graph A started from. It reads what steps 1 and 2 read, and nothing else.
    const yardFile = path.join(tmp('enumerate-step-two-'), 'graph.json');
    G.writeState(yardFile, before);
    const yard = { run: P.runOn(yardFile, [en('nobody', 'owner', { property: EG.NOBODY, source: c.project })]), from: before.log.length };
    yard.after = S.readState(yardFile);

    const b = P.runOn(file, [
      en('again', 'owner', { property: f.bot.project, source: c.project }),
      en('partner', 'owner', { property: f.bot.partner, source: c.project }),
      en('projects', 'owner', { property: f.bot.projects, source: c.project }),
      en('sponsor', 'owner', { property: f.bot.sponsor, source: c.project }),
      en('mentor', 'owner', { property: f.person.mentor, source: c.person }),
      en('nickname', 'owner', { property: f.bot.nickname, source: c.project }),
      en('lead', 'owner', { property: f.bot['team.lead'], source: c.person }),
      en('prefixed', 'owner', { property: f.bot.prefixed, source: c.project }),
      en('exact', 'owner', { property: f.bot.exact, source: c.project }),
      en('email', 'owner', { property: f.bot.email, source: c.project }),
      // Review round 1 (ADR 0019 Amendment 2, item 1): lists that must hold two references, or 10,000.
      en('pair', 'owner', { property: f.bot.pair, source: c.project }),
      en('unique-pair', 'owner', { property: f.bot.uniquePair, source: c.project }),
      en('ten-thousand', 'owner', { property: f.bot.tenThousand, source: c.project }),
      // Review round 1 (the story's Deviation 1): refused, in this run beside the repeats it must not be taken for.
      en('elsewhere-both', 'owner', { property: f.bot.twice, source: c.project }),
      en('base', 'owner', { property: f.bot.base, source: c.graph }),
      en('station', 'owner', { property: f.bot.station, source: c.relay }),
      en('vessel', 'owner', { property: f.bot.vessel, source: c.fleet }),
      en('admin', 'admin', { property: f.bot.adminField, source: c.project }),
      en('visitor', 'visitor', { property: f.bot.spare, source: c.project }),
      en('stranger', 'stranger', { property: f.bot.spare, source: c.project }),
      en('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ property: f.bot.spare, source: c.project }) }),
      get('list', EG.ROUTE.list, 'admin'),
      history('h-property', f.bot.project), history('h-source', c.project), history('h-superset', sup.project), history('h-concept', c.bot),
      get('lr', `${EG.ROUTE.listRelationships}?node=${f.bot.project}&type=ENUMERATES&limit=200`),
      get('le-project', `${EG.ROUTE.listElements}?concept=${c.project}&limit=200`),
      get('le-person', `${EG.ROUTE.listElements}?concept=${c.person}&limit=200`),
    ], [
      { id: 'cli', argv: ['graph', 'enumerate', '--property', f.bot.cliField, '--source', c.project] },
      { id: 'cli-refused', argv: ['graph', 'enumerate', '--property', f.relayMotto, '--source', c.project] },
    ], true);
    const afterB = S.readState(file);

    const r = P.runOn(file, [
      en('r-nobody', 'owner', { property: EG.NOBODY, source: c.project }),
      en('r-primary', 'owner', { property: ctx.pp.bot, source: c.project }),
      en('r-header', 'owner', { property: c.bot, source: c.project }),
      en('r-element', 'owner', { property: el.grokOne, source: c.project }),
      en('r-other', 'owner', { property: f.relayMotto, source: c.project }),
      en('r-owner-key', 'owner', { property: f.recipeDish, source: c.project }),
      en('r-firmware', 'owner', { property: f.wordSpelling, source: c.project }),
      en('r-grok', 'owner', { property: f.grokBot.project, source: c.project }),
      en('r-hut', 'owner', { property: f.hutDoor, source: c.project }),
      en('r-number', 'owner', { property: f.bot.count, source: c.project }),
      en('r-object', 'owner', { property: f.bot.meta, source: c.project }),
      en('r-objects', 'owner', { property: f.bot.parts, source: c.project }),
      en('r-loose', 'owner', { property: f.bot.loose, source: c.project }),
      en('r-mixed', 'owner', { property: f.bot.mixed, source: c.project }),
      en('r-enum', 'owner', { property: f.bot.code, source: c.project }),
      en('r-const', 'owner', { property: f.bot.fixed, source: c.project }),
      en('r-pattern', 'owner', { property: f.bot.ref, source: c.project }),
      en('r-short', 'owner', { property: f.bot.short, source: c.project }),
      en('r-long', 'owner', { property: f.bot.long, source: c.project }),
      en('r-items-enum', 'owner', { property: f.bot.codes, source: c.project }),
      en('r-items-short', 'owner', { property: f.bot.shortItems, source: c.project }),
      // Review round 1 (ADR 0019 Amendment 2): a minItems above the 10,000 tried (item 1), and keywords the old fixed list
      // didn't know (item 2).
      en('r-over-ten-thousand', 'owner', { property: f.bot.overTenThousand, source: c.project }),
      en('r-closed', 'owner', { property: f.bot.closed, source: c.project }),
      en('r-not', 'owner', { property: f.bot.notRef, source: c.project }),
      en('r-either', 'owner', { property: f.bot.either, source: c.project }),
      en('r-elsewhere', 'owner', { property: f.bot.sponsor, source: c.person }),
      en('r-elsewhere-set', 'owner', { property: f.bot.flag, source: c.project }),
      en('r-source-nobody', 'owner', { property: f.bot.spare, source: EG.NOBODY }),
      en('r-source-element', 'owner', { property: f.bot.spare, source: el.loom }),
      en('r-source-superset', 'owner', { property: f.bot.spare, source: sup.project }),
      en('r-source-set', 'owner', { property: f.bot.spare, source: set.flagship }),
      en('r-word', 'owner', { property: f.bot.spare, source: c.word }),
      en('r-context', 'owner', { property: f.bot.spare, source: c.graphContext }),
      en('r-bare', 'owner', { property: f.bot.spare, source: c.bare }),
      en('r-twin', 'owner', { property: f.bot.spare, source: c.twin }),
      en('r-missing-property', 'owner', { source: c.project }),
      en('r-missing-source', 'owner', { property: f.bot.spare }),
      en('r-bad-key', 'owner', { property: 'not a tapestryKey', source: c.project }),
      en('r-concept-input', 'owner', { property: f.bot.spare, source: c.project, concept: c.bot }),
      { id: 'r-reserved-type', method: 'POST', url: '/api/tapestry/graph/add-relationship', caller: 'owner', body: { from: sup.project, to: f.bot.vessel, type: 'ENUMERATES' } },
    ]);
    const afterR = S.readState(file);

    // C: the schema node moves ahead of the tree, as today's save-schema route writes it; a repeat then catches up.
    const s = S.readState(file);
    P.over(s).editJson(s.nodes.find((n) => n.props.tapestryKey === ctx.schema.bot), (j) => { j.jsonSchema.properties.bot.properties.extra = { type: 'string' }; });
    G.writeState(file, s);
    const cRun = P.runOn(file, [en('catchup', 'owner', { property: f.bot.project, source: c.project })]);
    const afterC = S.readState(file);
    return { ctx, a, b, r, cRun, yard, before, afterA, afterB, afterR, afterC };
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
/**
 * One of the five refusals ADR 0019 adds: declared with status 409, as the existing refusals of their kind are
 * (Amendment 1), and answered so. The call is R's, or B's with `run` 'b'.
 */
async function refusedAsDeclared(id, code, run = 'r') {
  const all = await main();
  const { b } = all;
  const x = all[run].req(id);
  const e = ((b.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'enumerate');
  const decl = e && (e.refusals || []).find((y) => y.code === code);
  assert(decl && decl.status === 409, `graph enumerate declares ${code} with status 409 (ADR 0019 Amendment 1); got ${show(decl)}`);
  assert(x.status === decl.status && x.body.code === code, `${id} must be refused ${decl.status} ${code}; got ${x.status} ${show(x.body).slice(0, 600)}`);
  return x.body;
}
const linkIs = (l, from, to) => l.from === from && l.to === to;

test('EN1 [AC1, Decision 1]: the link is one ENUMERATES from project\'s superset to bot\'s project node, carrying nothing; nothing else changes and nothing is signed', async () => {
  const { a, ctx, before, afterA } = await main();
  ok(a, 'link');
  const { c, sup, f } = ctx;
  const added = EG.links(afterA).filter((l) => !EG.links(before).some((x) => linkIs(x, l.from, l.to)));
  assert(added.length === 1 && linkIs(added[0], sup.project, f.bot.project) && show(added[0].props) === '{}',
    `one new ENUMERATES, from the source's superset to the property node, with no properties (the reducibility rule); got ${show(added)}`);
  const relKey = (s, r) => `${r.type} ${(s.nodes.find((n) => n.eid === r.from) || { props: {} }).props.tapestryKey} ${(s.nodes.find((n) => n.eid === r.to) || { props: {} }).props.tapestryKey}`;
  const relsBefore = new Set(before.rels.map((r) => relKey(before, r)));
  const relsAfter = new Set(afterA.rels.map((r) => relKey(afterA, r)));
  const newRels = [...relsAfter].filter((x) => !relsBefore.has(x));
  const goneRels = [...relsBefore].filter((x) => !relsAfter.has(x));
  assert(show(newRels) === show([`ENUMERATES ${sup.project} ${f.bot.project}`]) && goneRels.length === 0,
    `no other relationship comes or goes: no IS_A_PROPERTY_OF to the JSON schema, the property where it was; got new ${show(newRels)}, gone ${show(goneRels)}`);
  const newNodes = afterA.nodes.filter((n) => !before.nodes.some((x) => x.eid === n.eid));
  assert(newNodes.length === 1 && newNodes[0].labels.includes('GraphChange'), `the one node made is the change entry; got ${show(newNodes.map((n) => n.labels))}`);
  const changed = before.nodes.filter((n) => { const m = afterA.nodes.find((x) => x.eid === n.eid); return !m || P.canon(m.props) !== P.canon(n.props) || P.canon(m.labels) !== P.canon(n.labels); });
  assert(changed.length === 0, `no node's labels or properties change, the lock on the header set and cleared; got ${show(changed.map((n) => n.props.uuid || n.props.tapestryKey))}`);
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing is signed, published or read from a key store; the spy saw ${show(a.spy)}`);
  void c;
});

test('EN2 [AC1, Decisions 10 and 11]: the answer: enumerated; the property, its concept and its place; the source; the property writes\' fields; one enumeration-added change', async () => {
  const { a, ctx } = await main();
  const { c, sup, f } = ctx;
  const d = ok(a, 'link');
  assert(d.outcome === 'enumerated', `outcome enumerated; got ${show(d.outcome)}`);
  const p = d.property || {};
  assert(p.property === f.bot.project && p.concept === c.bot && p.field === 'project' && show(p.path) === show(['project']) && p.type === 'string',
    `the property: its tapestryKey, its concept and its place among the fields, as the property writes answer one; got ${show(p)}`);
  assert(d.source && d.source.concept === c.project && d.source.name === 'project' && d.source.superset === sup.project,
    `the source: { concept, name, superset }; got ${show(d.source)}`);
  assert(show(d.caughtUp) === show({ added: [], changed: [], removed: [] }) && show(d.filledIn) === show([]) && d.letterOutOfDate === false && d.cacheOutOfDate === false,
    `the property writes' fields: nothing caught up or filled in, no letter or cache out of date (amendment 4); got ${show({ caughtUp: d.caughtUp, filledIn: d.filledIn, letterOutOfDate: d.letterOutOfDate, cacheOutOfDate: d.cacheOutOfDate })}`);
  assert(d.elements && typeof d.elements === 'object' && Number.isInteger(d.elements.judged), `the property writes' report on the concept's elements, elements; got ${show(d.elements)}`);
  assert(d.change && typeof d.change.id === 'string' && d.change.operation === 'graph enumerate' && show(d.change.by) === show({ role: 'owner', pubkey: S.OWNER }),
    `the change entry, the owner's; got ${show(d.change && { id: d.change.id, operation: d.change.operation, by: d.change.by })}`);
  assert(d.change.changes.length === 1, `one change, the link's; got ${show(d.change.changes)}`);
  const x = changesOf(d, 'enumeration-added')[0] || {};
  assert(x.type === 'ENUMERATES' && x.from === sup.project && x.to === f.bot.project && x.concept === c.project && show(x.nodes) === show([c.bot]),
    `enumeration-added { type: ENUMERATES, from: the superset, to: the property, concept: the source's header, nodes: [the property's concept] }; got ${show(x)}`);
});

test('EN3 [AC1, AC2, Decision 9]: allowed is the source\'s elements from the owner\'s point of view, by tapestryKey, as list-elements lists them by default', async () => {
  const { a, b, ctx } = await main();
  const { el } = ctx;
  const al = ok(a, 'link').allowed || {};
  const want = sorted([el.infiniteHarness, el.loom, el.ownersPlan, el.peerHi, el.noAuthor, el.deep]);
  const got = (al.elements || []).map((e) => e.node);
  assert(show(got) === show(want) && al.count === 6 && al.more === false,
    `the instance's own (Infinite Harness, Loom, Deep Project in a set below), the owner's, a peer scored above the cutoff and one with no author; not the peers below, at or unscored, nor the admin scored below; by tapestryKey; got ${show(al)}`);
  const le = ok(b, 'le-project');
  assert(show(got) === show(le.elements.map((e) => e.tapestryKey)) && al.count === le.kept, `the list graph list-elements gives the source by default (AC2); got list-elements' ${show(le.elements.map((e) => e.tapestryKey))}, kept ${le.kept}`);
  for (const e of al.elements) {
    const l = le.elements.find((x) => x.tapestryKey === e.node);
    assert(e.name === l.name && e.address === l.address, `each with its name and address; got ${show(e)} against ${show(l)}`);
  }
});

test('EN4 [AC1, AC3, Decision 9]: the values report names the elements written before the link whose value isn\'t allowed, everyone\'s, judged from their JSON, and refuses none; it judges every enumerated field of the concept', async () => {
  const { a, b, ctx } = await main();
  const { el, uuid } = ctx;
  const v = ok(a, 'link').values || {};
  const na = (v.notAllowed || {});
  const got = (na.elements || []).map((e) => e.node).sort();
  assert(na.count === 3 && show(got) === show(sorted([el.grokOne, el.grokFive, el.peerBot])),
    `Grok One (a name), Grok Five (a peer's project below the cutoff) and Peer Bot (a peer's bot, with a name): three not allowed, each named; Grok Two's reference and Grok Three's empty field are allowed; got ${show(na)}`);
  const want = { [el.grokOne]: ['Infinite Harness'], [el.grokFive]: [ref(el.peerLo)], [el.peerBot]: ['Some Project Name'] };
  for (const e of na.elements) {
    assert(/(^|\.)project$/.test(String(e.field)) && show(e.values) === show(want[e.node]), `${e.name}: the field and the values not allowed; got ${show(e)}`);
    assert(e.address === uuid[e.node] && typeof e.name === 'string', `${e.node}: its name and address; got ${show(e)}`);
  }
  assert(v.judged === 6 && v.limit === 10000 && v.beyond === false, `bot's six elements judged, of 10,000 at most, none beyond; got ${show({ judged: v.judged, limit: v.limit, beyond: v.beyond })}`);
  // Review round 1, non-blocking 3: the story's Deviation 3. Linking projects judges every enumerated field of bot, as
  // a later write to one of its elements is judged: A's project too, not only the field just linked.
  const pr = (ok(b, 'projects').values || {}).notAllowed || {};
  const rows = (pr.elements || []).map((e) => `${e.node} ${String(e.field).split('.').pop()}`).sort();
  const wantRows = sorted([`${el.grokOne} project`, `${el.grokFive} project`, `${el.peerBot} project`, `${el.grokFour} projects`]);
  assert(pr.count === 4 && show(rows) === show(wantRows),
    `linking projects reports Grok Four's projects and the three whose project A's link doesn't allow, one entry for each element and field; got ${show(pr)}`);
});

test('EN5 [AC1, Decision 11]: graph history finds the entry by the property, the source, the superset and the property\'s concept; list-relationships on the property lists the link', async () => {
  const { a, b, ctx } = await main();
  const id = ok(a, 'link').change.id;
  for (const h of ['h-property', 'h-source', 'h-superset', 'h-concept']) {
    const ids = ok(b, h).entries.map((e) => e.id);
    assert(ids.includes(id), `${h}: graph history finds the link's entry; got ${show(ids).slice(0, 300)}`);
  }
  const rels = ok(b, 'lr').relationships || [];
  const x = rels.find((r) => r.type === 'ENUMERATES');
  assert(rels.length === 1 && x.direction === 'in' && x.from === ctx.sup.project && x.to === ctx.f.bot.project && show(x.properties) === '{}' && x.node.tapestryKey === ctx.sup.project,
    `one ENUMERATES into the property, from project's superset, with no properties; got ${show(rels)}`);
});

test('EN6 [AC1]: the property\'s own concept may be its source: person\'s mentor, from person, allows person\'s elements', async () => {
  const { b, ctx } = await main();
  const d = ok(b, 'mentor');
  assert(d.outcome === 'enumerated' && d.source.concept === ctx.c.person && d.source.superset === ctx.sup.person, `enumerated, from person itself; got ${show({ outcome: d.outcome, source: d.source })}`);
  const want = sorted([ctx.el.ada, ctx.el.grace, ctx.el.wanderer]);
  assert(show(d.allowed.elements.map((e) => e.node)) === show(want) && show(want) === show(ok(b, 'le-person').elements.map((e) => e.tapestryKey)), `its allowed values are person's elements; got ${show(d.allowed)}`);
  assert(EG.linksInto(S.readState(ctx.file), ctx.f.person.mentor).some((l) => l.from === ctx.sup.person), 'the link runs from person\'s superset to its own property');
});

test('EN7 [AC2, Decision 4]: a nullable string, a list of strings, a nested field, a pattern and a length a reference meets can each be linked', async () => {
  const { b, ctx } = await main();
  const { f, sup } = ctx;
  for (const [id, property, from] of [['nickname', f.bot.nickname, sup.project], ['projects', f.bot.projects, sup.project], ['lead', f.bot['team.lead'], sup.person], ['prefixed', f.bot.prefixed, sup.project], ['exact', f.bot.exact, sup.project]]) {
    const d = ok(b, id);
    assert(d.outcome === 'enumerated' && d.property.property === property, `${id}: enumerated; got ${show({ outcome: d.outcome, property: d.property })}`);
    assert(EG.linksInto(S.readState(ctx.file), property).filter((l) => l.from === from).length === 1, `${id}: one link from ${from}`);
  }
  assert(show(ok(b, 'lead').property.path) === show(['team', 'lead']), `the nested field's place: team.lead; got ${show(ok(b, 'lead').property.path)}`);
  const p = ok(b, 'projects');
  const four = (p.values.notAllowed.elements || []).find((e) => e.node === ctx.el.grokFour);
  assert(four && /(^|\.)projects$/.test(String(four.field)) && show(four.values) === show(['Loom']), `a list is judged item by item: Grok Four's 'Loom' isn't allowed, its reference is; got ${show(p.values)}`);
});

test('EN8 [Decision 4]: a format is judged as rule 4 judges it, compiled with its ajv options, which enforce no format: a reference meets it, so it can be linked', async () => {
  const { b, ctx } = await main();
  const Ajv = require(require.resolve('ajv', { paths: [ROOT] }));
  const meets = new Ajv({ allErrors: true, strict: false, logger: false }).compile(EG.BOT_FIELDS.email)(ref('00000000-0000-4000-8000-000000000000'));
  assert(meets === true, 'rule 4\'s compile of {type: string, format: email} accepts a reference (this suite\'s premise; the plan flags it)');
  const d = ok(b, 'email');
  assert(d.outcome === 'enumerated' && d.property.property === ctx.f.bot.email, `enumerated, as rule 4 would accept every reference in it; got ${show({ outcome: d.outcome })}`);
});

test('EN9 [AC1, Decision 3]: a firmware concept may be the source, and so may another author\'s', async () => {
  const { b, ctx } = await main();
  const base = ok(b, 'base');
  assert(base.outcome === 'enumerated' && base.source.concept === ctx.c.graph && base.source.superset === ctx.sup.graph, `graph, a firmware concept, as the source; got ${show(base.source)}`);
  const station = ok(b, 'station');
  assert(station.outcome === 'enumerated' && station.source.concept === ctx.c.relay && station.source.superset === ctx.sup.relay, `nostr relay, another author's concept, as the source; got ${show(station.source)}`);
});

test('EN10 [AC4]: the same call again is already-enumerated: change null, the allowed list and the report, nothing recorded, one link', async () => {
  const { a, b, ctx, afterB } = await main();
  const first = ok(a, 'link');
  const d = ok(b, 'again');
  assert(d.outcome === 'already-enumerated' && d.change === null, `already-enumerated, change null; got ${show({ outcome: d.outcome, change: d.change })}`);
  assert(d.allowed && d.allowed.count === first.allowed.count && show(d.allowed.elements) === show(first.allowed.elements), `it answers the elements a value may name; got ${show(d.allowed)}`);
  assert(d.values && d.values.notAllowed && d.values.notAllowed.count === first.values.notAllowed.count, `and the report; got ${show(d.values)}`);
  assert(d.source && d.source.concept === ctx.c.project && d.property.property === ctx.f.bot.project, 'the property and its source');
  assert(EG.linksInto(afterB, ctx.f.bot.project).length === 1, 'one link');
  assert(entries(afterB).filter((e) => e.props.operation === 'graph enumerate' && (e.props.keys || []).includes(ctx.f.bot.project)).length === 1, 'one entry for the property: the repeat recorded nothing');
});

test('EN11 [AC4]: a link today\'s route made from the same superset is a repeat too: already-enumerated, change null, still one link', async () => {
  const { b, ctx, afterB } = await main();
  const d = ok(b, 'partner');
  assert(d.outcome === 'already-enumerated' && d.change === null, `partner, linked by POST /api/normalize/enumerate's shape: already-enumerated, change null; got ${show({ outcome: d.outcome, change: d.change })}`);
  assert(EG.linksInto(afterB, ctx.f.bot.partner).length === 1, 'one link, the route\'s');
});

test('EN12 [AC4, Decision 12]: two enumerates of one property at once make one link: the second waits for the header\'s lock and answers already-enumerated', async () => {
  needDecl();
  const { ctx, before } = await main();
  const dir = tmp('enumerate-race-');
  const file = path.join(dir, 'graph.json');
  const other = path.join(dir, 'other.json');
  G.writeState(file, before);
  G.writeState(other, before);
  const call = (id) => en(id, 'owner', { property: ctx.f.bot.project, source: ctx.c.project });
  const o = P.runOn(other, [call('first')]);
  assert(o.req('first').status === 200 && o.req('first').body.data.outcome === 'enumerated', `the other call, alone, links; got ${show(o.req('first').body).slice(0, 300)}`);
  const s = S.readState(file);
  const g = S.readState(other);
  s.failures = { meanwhile: { at: ctx.c.bot, graph: { nodes: g.nodes, rels: g.rels, nextEid: g.nextEid } } };
  G.writeState(file, s);
  const from = S.readState(file).log.length;
  const x = P.runOn(file, [call('second')]).req('second');
  assert(x.status === 200 && x.body.data.outcome === 'already-enumerated' && x.body.data.change === null, `the second reads what the first committed: already-enumerated, no entry; got ${x.status} ${show(x.body).slice(0, 400)}`);
  const end = S.readState(file);
  assert(P.transactions(end.log, from).some((t) => t.steps.some((st) => st.call === 'meanwhile' && st.at === ctx.c.bot)), 'the second waited for the lock on bot\'s header (failures.meanwhile fired in its transaction)');
  assert(EG.linksInto(end, ctx.f.bot.project).length === 1 && P.same(graphOf(end), graphOf(S.readState(other))), 'one link, and the graph the first alone left');
});

test('EN13 [AC4, amendment 4]: a repeat that finds the concept\'s tree out of line with its schema brings it in line and records that, and no link', async () => {
  const { cRun, ctx, afterR, afterC } = await main();
  const d = ok(cRun, 'catchup');
  assert(d.outcome === 'already-enumerated', `still already-enumerated; got ${show(d.outcome)}`);
  assert(d.caughtUp.added.map((x) => x.field).includes('extra'), `caughtUp names extra, the field the schema gained by hand; got ${show(d.caughtUp)}`);
  assert(d.change && changesOf(d, 'property-added').some((x) => x.field === 'extra' && x.catchUp === true) && changesOf(d, 'enumeration-added').length === 0,
    `its entry records the catching up, marked catchUp, and no enumeration-added; got ${show(d.change && d.change.changes)}`);
  assert(EG.linksInto(afterC, ctx.f.bot.project).length === 1 && P.treeOf(afterC, ctx.c.bot).some((x) => x.name === 'extra') && !P.treeOf(afterR, ctx.c.bot).some((x) => x.name === 'extra'), 'still one link; extra has its property node now');
});

test('EN14 [Decisions 2 and 12]: the write\'s first statements set and clear the lock on the property\'s concept\'s header; before it, only the install check and the property\'s concept are read', async () => {
  const { ctx, yard, before, afterA } = await main();
  const txns = P.transactions(afterA.log, before.log.length).filter((t) => t.end === 'commit');
  assert(txns.length === 1, `one committed write; got ${show(txns.map((t) => t.steps.map((st) => st.kind)))}`);
  const writes = txns[0].steps.filter((st) => st.call === 'tx.run');
  assert(writes[0] && writes[0].kind === 'copies' && show(writes[0].keys) === show([ctx.c.bot]) && writes[1] && writes[1].kind === 'copies' && show(writes[1].keys) === show([ctx.c.bot]),
    `its first two statements that write set and clear the lock on bot's header; got ${show(writes.slice(0, 3))}`);
  assert(writes.some((st) => st.kind === 'merge') && writes.some((st) => st.kind === 'create'), `then the link's MERGE and the entry; got ${show(writes.map((st) => st.kind))}`);
  // Review round 1, non-blocking 3 (Decision 2, steps 1 to 4): the concept, its tree and the links are read after the
  // lock, so only steps 1 and 2 read before it, as the yardstick, refused at step 2, reads them.
  const early = txns[0].steps.slice(0, txns[0].steps.indexOf(writes[0])).filter((st) => st.call === 'tx.read').map((st) => st.query);
  const y = yard.run.req('nobody');
  const yt = P.transactions(yard.after.log, yard.from);
  assert(y.status === 404 && y.body.code === 'unknown-property' && yt.length === 1 && !yt[0].steps.some((st) => st.call === 'tx.run'),
    `the yardstick is refused unknown-property at step 2, in one transaction that writes nothing; got ${y.status} ${show(y.body).slice(0, 300)}, ${show(yt.map((t) => t.steps.map((st) => st.kind)))}`);
  const steps12 = yt[0].steps.filter((st) => st.call === 'tx.read').map((st) => st.query);
  assert(steps12.length > 0 && show(early) === show(steps12),
    `before the lock it reads what steps 1 and 2 read (the install check, the property's concept) and nothing of the concept, its tree or its links; got before the lock ${show(early)}, steps 1 and 2 ${show(steps12)}`);
});

test('EN15 [Decision 9]: a source of 60 elements: allowed counts 60, names the first 50 by tapestryKey, and says there are more', async () => {
  const { b, ctx } = await main();
  const al = ok(b, 'vessel').allowed;
  assert(al.count === 60 && al.more === true && show(al.elements.map((e) => e.node)) === show(sorted(ctx.el.fleet).slice(0, 50)), `60 counted, the first 50 by tapestryKey named, more; got ${show({ count: al.count, more: al.more, named: al.elements.length })}`);
});

test('EN16 [AC6]: unknown-property: a key that names no node, a concept\'s primary property, a concept header, an element', async () => {
  const { r, ctx } = await main();
  for (const [id, key] of [['r-nobody', EG.NOBODY], ['r-primary', ctx.pp.bot], ['r-header', ctx.c.bot], ['r-element', ctx.el.grokOne]]) {
    const body = refused(r, id, 404, 'unknown-property');
    assert(body.input === 'property' && err(body).includes(key), `${id}: names the input and the key given; got ${show(body)}`);
  }
});

test('EN17 [AC6, Decision 2]: not-own-concept, firmware-concept and tangled-tree, as the property writes refuse them', async () => {
  const { r } = await main();
  for (const [id, status, code] of [['r-other', 409, 'not-own-concept'], ['r-owner-key', 409, 'not-own-concept'], ['r-firmware', 409, 'firmware-concept'], ['r-grok', 409, 'tangled-tree'], ['r-hut', 409, 'tangled-tree']]) {
    const body = refused(r, id, status, code);
    assert(err(body).length > 20, `${id} says in words what is wrong; got ${show(body)}`);
  }
  assert(/two|2|more than one|hangs under/i.test(err(r.req('r-grok').body)), `Grok Bots' project: its tree isn't a tree, the property under two parents; got ${err(r.req('r-grok').body)}`);
});

test('EN18 [AC6, Decision 4]: not-enumerable: a number, an object, a list of objects, a list with no item type, a type list holding a number', async () => {
  for (const [id, key] of [['r-number', 'count'], ['r-object', 'meta'], ['r-objects', 'parts'], ['r-loose', 'loose'], ['r-mixed', 'mixed']]) {
    const body = await refusedAsDeclared(id, 'not-enumerable');
    const { ctx } = await main();
    assert(body.input === 'property' && err(body).includes(ctx.f.bot[key]), `${id}: names the property; got ${show(body)}`);
  }
});

test('EN19 [AC6, Decision 4, amendment 2]: refuses-references: its own enum or const, a pattern or a length a reference can\'t meet, the same in items; each names graph update-property and the keyword that refuses', async () => {
  // Review round 1, non-blocking 1 (ADR 0019 Amendment 2, item 2): each still names its keyword, an items' one as the items'.
  const KEYWORD = { 'r-enum': 'enum', 'r-const': 'const', 'r-pattern': 'pattern', 'r-short': 'maxLength', 'r-long': 'minLength', 'r-items-enum': 'enum', 'r-items-short': 'maxLength' };
  for (const id of ['r-enum', 'r-const', 'r-pattern', 'r-short', 'r-long', 'r-items-enum', 'r-items-short']) {
    const body = await refusedAsDeclared(id, 'refuses-references');
    assert(body.input === 'property' && /update-property/.test(err(body)), `${id}: names the property and graph update-property, to take it out first; got ${show(body)}`);
    const inItems = id.startsWith('r-items-');
    assert(new RegExp(`\\b${KEYWORD[id]}\\b`).test(err(body)) && (!inItems || /\bitems\b/.test(err(body))), `${id}: names ${inItems ? "its items' " : 'its '}${KEYWORD[id]}, what refuses every reference; got ${err(body)}`);
  }
});

test('EN20 [AC6, Decision 2 step 9]: enumerated-elsewhere: a link from another source\'s superset, or from a set, even beside one from the source\'s own superset; it names that start, its concept, and graph unenumerate', async () => {
  const { ctx } = await main();
  const one = await refusedAsDeclared('r-elsewhere', 'enumerated-elsewhere');
  assert(names(err(one), ctx.sup.project, ctx.uuid) && names(err(one), ctx.c.project, ctx.uuid) && /unenumerate/.test(err(one)),
    `sponsor, linked from project's superset, asked from person: names that superset, project and graph unenumerate; got ${err(one)}`);
  const two = await refusedAsDeclared('r-elsewhere-set', 'enumerated-elsewhere');
  assert(names(err(two), ctx.set.flagship, ctx.uuid) && /unenumerate/.test(err(two)), `flag, linked from the flagship set: names the set and graph unenumerate; got ${err(two)}`);
  assert(EG.linksInto((await main()).afterR, ctx.f.bot.sponsor).length === 1, 'sponsor keeps its one link');
  // Review round 1, non-blocking 3: the story's Deviation 1. The link from project's superset doesn't make the call a
  // repeat while another start links the property too: a property has one source (Decision 1).
  const both = await refusedAsDeclared('elsewhere-both', 'enumerated-elsewhere', 'b');
  assert(names(err(both), ctx.set.flagship, ctx.uuid) && /unenumerate/.test(err(both)), `twice, linked from project's superset and from the flagship set, asked from project: refused, naming the set and graph unenumerate, not answered already-enumerated; got ${err(both)}`);
  assert(EG.linksInto((await main()).afterB, ctx.f.bot.twice).length === 2, 'twice keeps both its links');
});

test('EN21 [AC6, Decision 3]: the source: unknown-concept (no node, an element; a superset or a set names its concept\'s header), reserved-source (word, graphContext), no-superset (none, two)', async () => {
  const { r, ctx } = await main();
  for (const id of ['r-source-nobody', 'r-source-element']) {
    const body = refused(r, id, 404, 'unknown-concept');
    assert(body.input === 'source', `${id}: names source; got ${show(body)}`);
  }
  for (const id of ['r-source-superset', 'r-source-set']) {
    const body = refused(r, id, 404, 'unknown-concept');
    assert(body.input === 'source' && err(body).includes(ctx.c.project), `${id}: names project's header, the key to pass; got ${show(body)}`);
  }
  for (const id of ['r-word', 'r-context']) {
    const body = await refusedAsDeclared(id, 'reserved-source');
    assert(body.input === 'source', `${id}: names source; got ${show(body)}`);
  }
  for (const id of ['r-bare', 'r-twin']) {
    const body = await refusedAsDeclared(id, 'no-superset');
    assert(body.input === 'source', `${id}: names source; got ${show(body)}`);
  }
});

test('EN22 [AC6]: the refusal run changed nothing and recorded nothing', async () => {
  const { r, afterB, afterR } = await main();
  const ids = Object.keys(r.requests);
  const answered = ids.filter((id) => { const x = r.req(id); return x.status >= 400 && x.status < 500 && x.body && typeof x.body.code === 'string'; });
  assert(answered.length === ids.length, `every call of the refusal run was refused by the operation, with a code (the path under test ran); these weren't: ${show(ids.filter((id) => !answered.includes(id)))}`);
  assert(P.same(graphOf(afterR), graphOf(afterB)), 'every refusal left the graph as it was: no node, tag, relationship or entry');
});

test('EN23 [Decision 2 step 1]: not-installed: the graph has no property concept', async () => {
  needDecl();
  const seed = await P.seedProperties({ without: ['property'] });
  const file = seed.file(tmp('enumerate-not-installed-'));
  refused(P.runOn(file, [en('n', 'owner', { property: EG.NOBODY, source: EG.NOBODY })]), 'n', 409, 'not-installed');
});

test('EN24 [AC7]: a visitor gets 401, a stranger 403, a text/plain body 415; an admin\'s link is the admin\'s; nothing is signed', async () => {
  const { b, afterB, ctx } = await main();
  assert(ok(b, 'again').outcome === 'already-enumerated', 'the path under test ran');
  assert(b.req('visitor').status === 401 && b.req('stranger').status === 403 && b.req('text').status === 415, `401, 403 and 415; got ${b.req('visitor').status} ${b.req('stranger').status} ${b.req('text').status}`);
  assert(EG.linksInto(afterB, ctx.f.bot.spare).length === 0, 'none of them linked anything');
  const ad = ok(b, 'admin');
  assert(ad.outcome === 'enumerated' && show(ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the admin's link is the admin's; got ${show(ad.change && ad.change.by)}`);
  assert(Array.isArray(b.spy) && b.spy.length === 0, `nothing signs, publishes or reads a key; the spy saw ${show(b.spy)}`);
});

test('EN25 [AC7]: tapestry graph enumerate --property --source links with no sign-in, recorded as the command\'s; its refusal is the route\'s', async () => {
  const { b, ctx, afterB } = await main();
  const c = b.cmd('cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.data.outcome === 'enumerated' && body.data.property.property === ctx.f.bot.cliField && show(body.data.change.by) === show({ role: 'local', pubkey: null }), `the command links, its entry naming the command; got ${show(body)}`);
  assert(EG.linksInto(afterB, ctx.f.bot.cliField).length === 1, 'the link is there');
  const rc = b.cmd('cli-refused');
  const rb = JSON.parse(rc.stdout);
  assert(rc.code === 1 && rb.code === 'not-own-concept', `the command's refusal is the route's; got ${show(rb)}`);
});

test('EN26 [AC7]: listed with its guard, repeatKey, inputs and every refusal, and its /docs entry; inputs are checked', async () => {
  const { b, r } = await main();
  const e = ((b.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'enumerate');
  assert(e, `graph enumerate is listed; problems: ${show((b.req('list').body.data || {}).problems)}`);
  assert(e.kind === 'write' && e.access === 'owner-and-admins' && show(e.guards) === show([RULE]) && show(e.repeatKey) === show(['property', 'source']),
    `a write for the owner and admins, guard ${RULE}, repeatKey [property, source]; got ${show({ kind: e.kind, access: e.access, guards: e.guards, repeatKey: e.repeatKey })}`);
  const ins = e.inputs || {};
  assert(show(Object.keys(ins).sort()) === show(['property', 'source']) && ins.property.required === true && ins.source.required === true, `two inputs, property and source, both required; got ${show(ins)}`);
  const codes = (e.refusals || []).map((x) => x.code);
  for (const code of [...PROPERTY_WRITE_CODES, 'unknown-concept', ...NEW_CODES, 'missing-input', 'invalid-input', 'unknown-input', 'wrong-content-type', 'sign-in-required', 'not-allowed']) {
    assert(codes.includes(code), `its refusals include ${code}; got ${show(codes)}`);
  }
  refused(r, 'r-missing-property', 400, 'missing-input');
  refused(r, 'r-missing-source', 400, 'missing-input');
  refused(r, 'r-bad-key', 400, 'invalid-input');
  refused(r, 'r-concept-input', 400, 'unknown-input');
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(EG.ROUTE.enumerate)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('enumerate-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${EG.ROUTE.enumerate}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

test('EN27 [Decision 1]: firmware\'s edge to a JSON schema node is never read or changed: it is there, as it was, after every run', async () => {
  const { a, cRun, before, afterC, ctx } = await main();
  assert(ok(a, 'link').outcome === 'enumerated' && ok(cRun, 'catchup').outcome === 'already-enumerated', 'the path under test ran: bot\'s project was linked, and linked again after the schema moved');
  const fw = (s) => EG.linksInto(s, ctx.schema.bot);
  assert(fw(before).length === 1 && P.same(fw(afterC), fw(before)), `person's superset to bot's JSON schema node, destinationPath bot.spare, as it was; got ${show(fw(afterC))}`);
  assert(EG.linksInto(afterC, ctx.f.bot.spare).length === 0, 'and spare, the field it names, has no link');
});

test('EN28 [Implementation notes]: add-relationship\'s refusal of ENUMERATES names graph enumerate and unenumerate', async () => {
  const { r } = await main();
  const body = refused(r, 'r-reserved-type', 409, 'reserved-type');
  assert(body.rule === 'relationship-type-allowed' && /enumerate and unenumerate/.test(err(body)), `ENUMERATES stays reserved, made and taken out by graph enumerate and unenumerate; got ${show(body)}`);
});

test('EN29 [Implementation notes]: the catalog: enumerate takes property and source; a row for unenumerate; apply-enumerations goes to rule 10; "At a glance" counts 65 and lists unenumerate', () => {
  needDecl();
  const catalog = fs.readFileSync(path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md'), 'utf8');
  const s2 = catalog.slice(catalog.indexOf('## 2.'), catalog.indexOf('## 3.'));
  const row = (op) => s2.split('\n').find((l) => l.startsWith(`| \`${op}\``)) || '';
  const takes = (row('enumerate').split('|')[3] || '').split('→')[0];
  assert(/`property`/.test(takes) && /`source`/.test(takes) && !/`concept`/.test(takes), `the enumerate row takes property and source, and no concept (the property's key gives it); got ${show(row('enumerate'))}`);
  assert(row('unenumerate'), 'a row for unenumerate');
  const old = catalog.split('\n').find((l) => l.startsWith('| `normalize/apply-enumerations`')) || '';
  assert(/enumerated-value-allowed|rule 10/.test(old), `the map of old routes sends apply-enumerations to rule 10; got ${show(old)}`);
  // 65 since story graph-operations-first-slice #48 added declare-shared, wire-to-shared and defer-sharing (ADR
  // graph-operations-first-slice/0048 Decision 10).
  assert(/At a glance \(65 operations\)/.test(catalog), '"At a glance" counts 65 operations');
  const glance = catalog.slice(catalog.indexOf('## At a glance'), catalog.indexOf('## 1.'));
  const line = glance.split('\n').find((l) => /properties and schema/.test(l)) || '';
  assert(/\benumerate\b/.test(line) && /\bunenumerate\b/.test(line), `"properties and schema" lists enumerate and unenumerate; got ${show(line)}`);
});

// ── review round 1 (2026-11-19; ADR 0019 Amendment 2) ──
/** Whether a refusal's words name the keyword `kw`: "its kw", "its items' kw", or as JSON or code, "kw" or `kw`. */
const namesKeyword = (text, kw) => new RegExp(`\\bits (items' )?${kw}\\b|"${kw}"|\`${kw}\``).test(String(text));

test('EN30 [AC6, Decision 4, Amendment 2 item 1]: a list is tried with as many references as it must hold: minItems 2 is linked, with uniqueItems too, and minItems 10,000; above 10,000 it is refused, saying so', async () => {
  // Review round 1, non-blocking 1: a list was tried with one reference, so minItems 2 was refused in words that weren't true.
  const { b, ctx } = await main();
  const { f, sup } = ctx;
  for (const [id, property] of [['pair', f.bot.pair], ['unique-pair', f.bot.uniquePair], ['ten-thousand', f.bot.tenThousand]]) {
    const d = ok(b, id);
    assert(d.outcome === 'enumerated' && d.property.property === property, `${id}: enumerated, since a list of different references meets its minItems${id === 'unique-pair' ? ' and its uniqueItems' : ''}; got ${show({ outcome: d.outcome, property: d.property })}`);
    assert(EG.linksInto(S.readState(ctx.file), property).filter((l) => l.from === sup.project).length === 1, `${id}: one link from project's superset`);
  }
  const body = await refusedAsDeclared('r-over-ten-thousand', 'refuses-references');
  assert(body.input === 'property' && /\bminItems\b/.test(err(body)) && /\b10,?000\b/.test(err(body)),
    `minItems 10,001: refused, naming minItems and saying enumerate tries at most 10,000 references; got ${err(body)}`);
});

test('EN31 [AC6, Decision 4, Amendment 2 item 2]: refuses-references names what refuses, read from the check: a list\'s maxItems 0, a not, a keyword inside anyOf named by the anyOf; each with graph update-property', async () => {
  // Review round 1, non-blocking 1: these were refused in words that named nothing.
  const closed = err(await refusedAsDeclared('r-closed', 'refuses-references'));
  assert(/\bmaxItems\b/.test(closed) && /\{\s*"maxItems"\s*:\s*null\s*\}/.test(closed) && /update-property/.test(closed),
    `a list with maxItems 0: names maxItems, and '{"maxItems": null}' with graph update-property to take it out; got ${closed}`);
  const not = err(await refusedAsDeclared('r-not', 'refuses-references'));
  assert(namesKeyword(not, 'not') && /update-property/.test(not), `a string with not: { pattern: ^tapestry: }: names its not, and graph update-property; got ${not}`);
  const either = err(await refusedAsDeclared('r-either', 'refuses-references'));
  assert(/\banyOf\b/.test(either) && !/\bits (maxLength|pattern)\b/.test(either) && /update-property/.test(either),
    `a string whose anyOf a reference meets no branch of: named by the anyOf, the outermost, not as its own maxLength or pattern; and graph update-property; got ${either}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
