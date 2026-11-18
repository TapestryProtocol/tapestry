'use strict';
/**
 * graph add-property — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/18-property-operations.md (AC1, AC2, AC6–AC9 over the
 *          fake; the live check covers the reinstall and the restore)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0018-property-operations.md (Decisions 1–7.1, 9–14)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/18-property-operations.test-plan.md
 *
 * Stack-free, over test/helpers/propertyGraph.js's seed (it says what the graph holds). Runs, in order, over one state:
 *   A  the adds, the callers, the command and the list;
 *   B  the adds and reads that need A's keys: city under address, mark-field, create-element;
 *   R  only refusals, so the graph after R is the graph before it;
 *   N  a seed with no property concept, for not-installed.
 *
 *   AP1   a top-level property: the answer, the schema every reader reads, and the entry
 *   AP2   the first write catches the tree up: the schema's three fields get nodes, marked catchUp; the primary
 *         property's record agrees with the schema (the hygiene check)
 *   AP3   the node is the one the import would make of the letter create-property would sign, corrected
 *   AP4   a nested property, a list's item type and allowed values (a piece given as JSON text)
 *   AP5   the same call again: already-exists, nothing recorded
 *   AP6   the report: elements that stop fitting, those that already didn't, those not judged; never a refusal
 *   AP7   the report's verdicts are the rule element-fits-schema's, judged on tapestryJson
 *   AP8   the readers see it: mark-field marks it, create-element is checked against it, the Properties page lists it
 *   AP9   a lettered concept: its letter no longer matches
 *   AP10  the write locks the concept's header before it writes
 *   AP11  each refusal, and the graph as it was after them, a catch-up undone with them
 *   AP12  not-installed
 *   AP13  nothing is signed; callers; an admin's add is the admin's; the command; the list and /docs
 *   AP14  the check of what a write wrote refuses only what the write breaks (ADR 0018 Amendment 2), over a seed with
 *         what an installed instance has: a concept whose schema the tree graph already fails
 *   AP15  the report names at most 50 elements in each list, the first by tapestryKey, and counts them all (review
 *         round 1, finding 3)
 */

const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const P = require('../../helpers/propertyGraph');
const G = require('../../helpers/graphFake');

const { ROOT, TA, ADMIN, assert, show, tmp } = S;
const cp = (n) => String.fromCodePoint(n); // a control or invisible character, never one typed raw in this file
const { test, run } = S.makeSuite('operations: graph add-property');
const add = P.post('add');
const RULE = 'element-fits-schema';
const CODES = ['unknown-concept', 'not-own-concept', 'firmware-concept', 'not-installed', 'no-schema', 'no-primary-property', 'not-wrapped', 'unreadable-schema', 'tangled-tree', 'not-own-node', 'bad-name', 'bad-type', 'bad-description', 'bad-parent', 'bad-schema', 'name-in-use', 'marked-field', 'schema-too-large', 'no-free-address', 'invalid-fields', 'invalid-input', 'wrong-content-type', 'sign-in-required', 'not-allowed'];

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    P.needDecls(['add-property']);
    const ctx = await P.prepare('add-property');
    const { file, made, k } = ctx;
    const TH = made.teaHouse.conceptHeader;
    const before = S.readState(file);
    const a = P.runOn(file, [
      add('visitor', 'visitor', { concept: TH, name: 'visitor field', type: 'string' }),
      add('stranger', 'stranger', { concept: TH, name: 'stranger field', type: 'string' }),
      add('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ concept: TH, name: 'text field', type: 'string' }) }),
      add('price', 'owner', { concept: TH, name: 'price', type: 'number', description: 'What a pot costs' }),
      add('price-again', 'owner', { concept: TH, name: 'price', type: 'number', description: 'What a pot costs' }),
      add('address', 'owner', { concept: TH, name: 'address', type: 'object' }),
      add('tags', 'owner', { concept: TH, name: 'tags', type: 'array', schema: { items: { type: 'string' } } }),
      add('rating', 'owner', { concept: TH, name: 'rating', type: 'integer', schema: '{"enum": [1, 2, 3], "minimum": 1}' }),
      add('opened', 'owner', { concept: TH, name: 'opened', type: 'string', required: true, description: 'The year it opened' }),
      add('goal', 'owner', { concept: k.goal, name: 'deadline', type: 'string' }),
      add('admin', 'admin', { concept: TH, name: 'since', type: 'string' }),
      { id: 'list', method: 'GET', url: P.ROUTE.list, caller: 'admin' },
    ], [
      { id: 'cli', argv: ['graph', 'add-property', '--concept', made.lamp.conceptHeader, '--name', 'brightness', '--type', 'integer'] },
      { id: 'cli-refused', argv: ['graph', 'add-property', '--concept', k.relay, '--name', 'colour', '--type', 'string'] },
    ], true);
    const afterA = S.readState(file);
    const keyOf = (id) => { const x = a.req(id); assert(x.status === 200, `the run's ${id} must succeed; got ${x.status} ${show(x.body)}`); return x.body.data.property.property; };
    const addressKey = keyOf('address');
    const priceKey = keyOf('price');
    const tagsKey = keyOf('tags');
    const b = P.runOn(file, [
      add('city', 'owner', { concept: TH, name: 'city', type: 'string', required: true, parent: addressKey }),
      P.post('mark')('mark', 'owner', { concept: TH, field: 'price' }),
      P.post('element')('element', 'owner', { concept: TH, name: 'Pu-erh', fields: { description: 'earthy' } }),
    ]);
    const beforeR = S.readState(file);
    const r = P.runOn(file, [
      add('r-unknown', 'owner', { concept: P.NOBODY, name: 'x', type: 'string' }),
      add('r-not-header', 'owner', { concept: k.rover, name: 'x', type: 'string' }),
      add('r-other', 'owner', { concept: k.relay, name: 'x', type: 'string' }),
      add('r-owner-key', 'owner', { concept: k.recipe, name: 'x', type: 'string' }),
      add('r-firmware', 'owner', { concept: k.word, name: 'x', type: 'string' }),
      add('r-no-schema', 'owner', { concept: made.stall.conceptHeader, name: 'x', type: 'string' }),
      add('r-two-schemas', 'owner', { concept: k.bird, name: 'x', type: 'string' }),
      add('r-no-pp', 'owner', { concept: made.kiosk.conceptHeader, name: 'x', type: 'string' }),
      add('r-not-wrapped', 'owner', { concept: k.mouse, name: 'x', type: 'string' }),
      add('r-untyped', 'owner', { concept: k.cat, name: 'x', type: 'string' }),
      add('r-tangled', 'owner', { concept: made.hut.conceptHeader, name: 'x', type: 'string' }),
      add('r-not-own-node', 'owner', { concept: made.cabin.conceptHeader, name: 'x', type: 'string' }),
      add('r-name-empty', 'owner', { concept: TH, name: '   ', type: 'string' }),
      add('r-name-long', 'owner', { concept: TH, name: 'n'.repeat(201), type: 'string' }),
      add('r-name-control', 'owner', { concept: TH, name: `bell${cp(0x07)}field`, type: 'string' }),
      add('r-name-bidi', 'owner', { concept: TH, name: `rtl${cp(0x202e)}field`, type: 'string' }),
      add('r-name-invisible', 'owner', { concept: TH, name: `zero${cp(0x200b)}width`, type: 'string' }),
      add('r-name-proto', 'owner', { concept: TH, name: '__proto__', type: 'string' }),
      add('r-type-regex', 'owner', { concept: TH, name: 'pattern field', type: 'regex' }),
      add('r-type-text', 'owner', { concept: TH, name: 'text field', type: 'text' }),
      add('r-description', 'owner', { concept: TH, name: 'described', type: 'string', description: `a${cp(0x01)}b` }),
      add('r-parent-string', 'owner', { concept: TH, name: 'currency', type: 'string', parent: priceKey }),
      add('r-parent-list', 'owner', { concept: TH, name: 'first', type: 'string', parent: tagsKey }),
      add('r-parent-primary', 'owner', { concept: TH, name: 'top', type: 'string', parent: made.teaHouse.nodes.primaryProperty }),
      add('r-parent-elsewhere', 'owner', { concept: TH, name: 'shade', type: 'string', parent: ctx.tree.color }),
      add('r-parent-nobody', 'owner', { concept: TH, name: 'ghost', type: 'string', parent: P.NOBODY }),
      add('r-piece-array', 'owner', { concept: TH, name: 'p1', type: 'string', schema: '[1]' }),
      add('r-piece-unparsed', 'owner', { concept: TH, name: 'p2', type: 'string', schema: '{nope' }),
      add('r-piece-properties', 'owner', { concept: TH, name: 'p3', type: 'object', schema: { properties: { x: { type: 'string' } } } }),
      add('r-piece-required', 'owner', { concept: TH, name: 'p4', type: 'object', schema: { required: ['x'] } }),
      add('r-piece-type', 'owner', { concept: TH, name: 'p5', type: 'number', schema: { type: 'string' } }),
      add('r-piece-description', 'owner', { concept: TH, name: 'p6', type: 'string', description: 'one', schema: { description: 'other' } }),
      add('r-piece-compile', 'owner', { concept: TH, name: 'p7', type: 'number', schema: { minimum: 'five' } }),
      add('r-in-use', 'owner', { concept: TH, name: 'price', type: 'string' }),
      add('r-in-use-catch-up', 'owner', { concept: made.bookshop.conceptHeader, name: 'slug', type: 'string' }),
      // Review round 1, finding 4: a description given inside the piece becomes the node's description tag too.
      add('r-piece-desc-control', 'owner', { concept: TH, name: 'p8', type: 'string', schema: { description: `a${cp(0x01)}b` } }),
    ]);
    const afterR = S.readState(file);
    return { ctx, a, b, r, TH, before, afterA, beforeR, afterR, keys: { addressKey, priceKey, tagsKey } };
  })();
  return MAIN;
}
const graph = async () => S.readState((await main()).ctx.file);
function ok(runResult, id) {
  const x = runResult.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body)}`);
  return x.body.data;
}
function refused(runResult, id, status, code) {
  const x = runResult.req(id);
  assert(x.status === status && x.body.code === code, `${id} must be refused ${status} ${code}; got ${x.status} ${show(x.body)}`);
  return x.body;
}
const changesOf = (d, name) => ((d && d.change && d.change.changes) || []).filter((c) => c.change === name);

test('AP1: a top-level property: the answer, the schema every reader reads, and its entry', async () => {
  const { a, TH, ctx } = await main();
  const d = ok(a, 'price');
  const g = await graph();
  const pp = P.node(g, ctx.made.teaHouse.nodes.primaryProperty);
  const p = d.property;
  assert(d.outcome === 'added' && d.letterOutOfDate === false && d.cacheOutOfDate === false && show(d.filledIn) === show([]), `added, no letter or cache out of date, nothing filled in; got ${show({ outcome: d.outcome, letterOutOfDate: d.letterOutOfDate, cacheOutOfDate: d.cacheOutOfDate, filledIn: d.filledIn })}`);
  assert(p.concept === TH && p.field === 'price' && show(p.path) === show(['price']) && p.parent === null && p.type === 'number' && p.required === false
    && p.description === 'What a pot costs' && p.hasLetter === false && P.same(p.schema, { type: 'number', description: 'What a pot costs' }),
  `the property as it is: its concept, field, path, no parent at the top, type, required, description and its piece; got ${show(p)}`);
  assert(p.address === `39999:${TA}:${P.childD('price', pp.props.uuid)}`, `its address is BIBLE §9's d-tag under its parent, the primary property; got ${p.address}`);
  const doc = P.schemaDoc(g, TH);
  const section = doc.properties.teaHouse;
  assert(P.same(section.properties.price, { type: 'number', description: 'What a pot costs' }), `the schema node holds the field at its place; got ${show(section.properties.price)}`);
  assert(['name', 'slug', 'description'].every((f) => section.properties[f] && section.properties[f].type === 'string'), `the schema's own fields stay; got ${show(Object.keys(section.properties))}`);
  assert(show(section.required) === show(['name', 'slug', 'description', 'opened']),
    `price isn't required: the section's required list is the defaults, and opened from AP6's write; got ${show(section.required)}`);
  const own = changesOf(d, 'property-added').filter((c) => !c.catchUp);
  assert(own.length === 1 && own[0].node === p.property && own[0].concept === TH && own[0].field === 'price' && show(own[0].path) === show(['price'])
    && P.same(own[0].now, { schema: { type: 'number', description: 'What a pot costs' }, required: false }), `one property-added change of its own, with now; got ${show(own)}`);
  const sc = changesOf(d, 'schema-changed');
  assert(sc.length === 1 && sc[0].concept === TH && sc[0].node === ctx.made.teaHouse.nodes.jsonSchema && sc[0].was && sc[0].now
    && !sc[0].was.properties.teaHouse.properties.price && P.same(sc[0].now.properties.teaHouse.properties.price, { type: 'number', description: 'What a pot costs' }),
  `one schema-changed change, for the schema node, with the document before and after; got ${show(sc.map((c) => ({ node: c.node, concept: c.concept })))}`);
});

test('AP2: the first write catches the tree up: name, slug and description get nodes from the schema, marked catchUp; the primary property agrees with the schema', async () => {
  const { a, TH, ctx } = await main();
  const d = ok(a, 'price');
  assert(show(d.caughtUp.added.map((x) => x.field)) === show(['name', 'slug', 'description']) && d.caughtUp.changed.length === 0 && d.caughtUp.removed.length === 0,
    `catching up added the schema's three fields, and changed and removed nothing; got ${show(d.caughtUp)}`);
  const caught = changesOf(d, 'property-added').filter((c) => c.catchUp === true);
  assert(show(caught.map((c) => c.field)) === show(['name', 'slug', 'description']), `each is a property-added change marked catchUp; got ${show(caught)}`);
  const g = await graph();
  const defaults = (await main()).before;
  const doc = P.schemaDoc(defaults, TH);
  const rows = P.treeOf(g, TH);
  for (const f of ['name', 'slug', 'description']) {
    const n = rows.find((r) => r.name === f && r.parent === null);
    assert(n, `${f} has a node under the primary property; got ${show(rows.map((r) => r.name))}`);
    assert(P.same(n.json.property.schema, doc.properties.teaHouse.properties[f]) && n.json.property.key === f && n.json.property.type === 'string',
      `${f}'s piece is the schema's definition, and its view gives its key and type; got ${show(n.json.property)}`);
  }
  const ppJson = P.json(g, ctx.made.teaHouse.nodes.primaryProperty);
  const pv = ppJson.property;
  assert(pv.key === 'teaHouse' && pv.type === 'object' && show(Object.keys(pv.properties).slice(0, 4)) === show(['name', 'slug', 'description', 'price'])
    && pv.properties.price.type === 'number' && P.same(pv.required, P.schemaDoc(g, TH).properties.teaHouse.required),
  `the primary property's view lists its children in order, with their types, and the section's required list; got ${show(pv)}`);
  const { properties: kids, ...piece } = P.schemaDoc(g, TH).properties.teaHouse;
  void kids;
  assert(P.same(pv.schema, { ...piece, properties: {} }), `its piece is the section without its fields' definitions, an empty properties where they go; got ${show(pv.schema)}`);
  assert(ppJson.primaryProperty && typeof ppJson.primaryProperty.description === 'string', 'its primaryProperty section stays, as the primary-property concept requires');
  const { comparePropertyRecord } = require(path.join(ROOT, 'src/lib/brain/hygiene.js'));
  const problems = comparePropertyRecord({ concept: 'tea house', schemaObject: P.schemaDoc(g, TH).properties.teaHouse, propertySection: pv });
  assert(problems.length === 0, `the hygiene check finds the primary property's record consistent with the schema; got ${show(problems)}`);
});

test('AP3: the node is the one the import would make of the letter create-property would sign, corrected', async () => {
  const { a, ctx, afterA } = await main();
  const d = ok(a, 'price');
  const g = await graph();
  const n = P.node(g, d.property.property);
  const pp = P.node(g, ctx.made.teaHouse.nodes.primaryProperty);
  assert(n && show([...n.labels].sort()) === show(['ListItem', 'Property', 'TapestryNode']), `labels ListItem, Property and the shared label, no NostrEvent; got ${show(n && n.labels)}`);
  assert(n.props.uuid === d.property.address && n.props.kind === 39999 && n.props.pubkey === TA && n.props.name === 'price' && n.props.tapestryValue === 'price'
    && n.props.id === undefined && typeof n.props.created_at === 'number', `its address, kind 39999, the assistant as would-be author, name and tapestryValue its key, no letter, a created_at; got ${show(n.props)}`);
  const t = P.tagArrays(g, n.props.tapestryKey);
  const dtag = n.props.uuid.split(':').slice(2).join(':');
  assert(show(t.map((x) => x[0])) === show(['d', 'name', 'description', 'type', 'z', 'json']) && t[0][1] === dtag && t[1][1] === 'price'
    && t[2][1] === 'What a pot costs' && t[3][1] === 'number' && t[4][1] === `39998:${TA}:property`, `tags d, name, description, type, z and json, in create-property's order; got ${show(t)}`);
  const j = JSON.parse(t[5][1]);
  assert(P.same(j.word, { slug: 'price', name: 'price', wordTypes: ['word', 'property'] }) && j.property.key === 'price' && j.property.type === 'number'
    && j.property.description === 'What a pot costs' && P.same(j.property.schema, { type: 'number', description: 'What a pot costs' }) && j.property.required === undefined,
  `its JSON: a word block, the view (key, type, description) and the piece in property.schema; no required list on a leaf; got ${show(j)}`);
  assert(show(P.out(g, n.props.tapestryKey, 'IS_A_PROPERTY_OF')) === show([pp.props.tapestryKey]), 'it hangs on the primary property');
  // As run A left it: run B's mark-field marks price, and a mark is a HAS_ELEMENT edge from the first set (AP8).
  assert(show(P.into(afterA, n.props.tapestryKey, 'HAS_ELEMENT')) === show([ctx.k.supersets.property]), 'it is an element of the property concept alone, through its superset (ADR 0016 Amendment 2)');
});

test('AP4: a nested property, a list\'s item type, and allowed values given as JSON text', async () => {
  const { b, TH, keys } = await main();
  const city = ok(b, 'city').property;
  assert(city.parent === keys.addressKey && show(city.path) === show(['address', 'city']) && city.required === true, `city is under address, at address.city, required; got ${show(city)}`);
  const g = await graph();
  const section = P.schemaDoc(g, TH).properties.teaHouse;
  assert(P.same(section.properties.address, { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] }), `the schema holds address with city in it, required there; got ${show(section.properties.address)}`);
  const av = P.json(g, keys.addressKey).property;
  assert(av.type === 'object' && P.same(av.properties, { city: { type: 'string' } }) && show(av.required) === show(['city']) && show(av.schema.required) === show(['city']),
    `address's view lists city and its required list; its piece holds the list; got ${show(av)}`);
  assert(P.same(section.properties.tags, { type: 'array', items: { type: 'string' } }), `a list keeps its item type; got ${show(section.properties.tags)}`);
  assert(P.same(section.properties.rating, { type: 'integer', enum: [1, 2, 3], minimum: 1 }), `allowed values and a minimum, given as JSON text, are kept; got ${show(section.properties.rating)}`);
});

test('AP5: the same call again changes nothing, records nothing, and answers already-exists', async () => {
  const { a } = await main();
  const first = ok(a, 'price');
  const d = ok(a, 'price-again');
  assert(d.outcome === 'already-exists' && d.change === null && d.property.property === first.property.property && d.caughtUp.added.length === 0,
    `already-exists, the same property, no entry, nothing caught up; got ${show(d)}`);
  const g = await graph();
  assert(P.treeOf(g, (await main()).TH).filter((r) => r.name === 'price').length === 1, 'one price node');
});

test('AP6: the report: the elements that stop fitting, those that already didn\'t, and those not judged; never a refusal', async () => {
  const { a, ctx } = await main();
  const d = ok(a, 'opened');
  const e = d.elements;
  const el = ctx.el;
  assert(d.outcome === 'added', `the write lands whatever it reports; got ${show(d.outcome)}`);
  const stopped = e.stoppedFitting.elements.map((x) => x.node).sort();
  assert(e.stoppedFitting.count === 3 && show(stopped) === show([el.lapsang, el.chai, el.assam].sort()),
    `lapsang, chai and assam fit before and not after; got ${show(e.stoppedFitting)}`);
  for (const x of e.stoppedFitting.elements) {
    assert(x.problems.some((pr) => pr.message === '`teaHouse.opened` is required' && pr.path === 'teaHouse'), `each says opened is required, in the rule's words; got ${show(x.problems)}`);
    assert(typeof x.name === 'string' && typeof x.address === 'string', `each element comes with its name and address; got ${show(x)}`);
  }
  assert(e.alreadyNotFitting === 1 && e.judged === 4 && show(e.notJudged) === show({ count: 2, missing: 1, unreadable: 1 }),
    `oolong already didn't fit; four judged; matcha has no tapestryJson and sencha's isn't an object; got ${show({ judged: e.judged, alreadyNotFitting: e.alreadyNotFitting, notJudged: e.notJudged })}`);
  assert(show(e.stillHold) === show({ count: 0, elements: [] }) && e.before === null && e.limit === 10000 && e.beyond === false,
    `nothing removed, so nothing still held; the schema before was judged; the limit; got ${show({ stillHold: e.stillHold, before: e.before, limit: e.limit, beyond: e.beyond })}`);
  const pr = ok(a, 'price').elements;
  assert(pr.stoppedFitting.count === 0 && pr.alreadyNotFitting === 1 && pr.judged === 4, `an optional field stops no element fitting; got ${show(pr)}`);
});

test('AP7: the report\'s verdicts are the rule element-fits-schema\'s, judged on each element\'s tapestryJson', async () => {
  const { a, ctx, TH } = await main();
  const e = ok(a, 'opened').elements;
  const els = ['lapsang', 'oolong', 'matcha', 'chai', 'sencha', 'assam'].map((n) => ctx.el[n]);
  const items = els.map((node) => ({ node, concept: TH }));
  const child = spawnSync(process.execPath, ['-e', `
    const G = require(${JSON.stringify(path.join(ROOT, 'test/helpers/graphFake.js'))});
    const { findRule } = require(${JSON.stringify(path.join(ROOT, 'src/operations/rules'))});
    const fg = G.fakeGraph(${JSON.stringify(ctx.file)});
    findRule(${JSON.stringify(RULE)}).violations(${JSON.stringify(items)}, (c, p) => fg.read(c, p))
      .then((f) => process.stdout.write('RESULT:' + JSON.stringify(f.map((x) => ({ node: x.item.node, code: x.code, problems: x.problems || null })))))
      .catch((err) => { process.stderr.write(String(err && err.stack || err)); process.exit(1); });
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(ctx.dir), timeout: 60000 });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line, `the rule ran over the final graph; ${(child.stderr || '').slice(-400)}`);
  const found = JSON.parse(line);
  const failing = new Set(found.map((f) => f.node));
  for (const x of e.stoppedFitting.elements) {
    const f = found.find((y) => y.node === x.node);
    assert(f && f.code === 'invalid-fields' && P.same((f.problems || []).map((p) => p.message), x.problems.map((p) => p.message)),
      `the rule finds ${x.name} doesn't fit, for the same problems; got ${show(f)} against ${show(x.problems)}`);
  }
  assert(failing.size === e.stoppedFitting.count + e.alreadyNotFitting + e.notJudged.count,
    `the rule's findings are the report's elements that don't fit after, already didn't, or weren't judged, and no others; got ${show(found)}`);
  assert(failing.has(ctx.el.assam), 'assam, whose json tag holds opened but whose tapestryJson doesn\'t, doesn\'t fit: the rule judges tapestryJson (ADR 0042)');
});

test('AP8: the readers see it: mark-field marks it, create-element is checked against it, the Properties page lists it', async () => {
  const { b, ctx, TH, keys } = await main();
  const m = ok(b, 'mark');
  assert(m.outcome === 'marked', `mark-field finds price's node and marks it; got ${show(m)}`);
  const x = b.req('element');
  assert(x.status === 400 && x.body.code === 'invalid-fields' && /opened/.test(x.body.error), `create-element refuses JSON missing the newly required opened; got ${x.status} ${show(x.body)}`);
  const g = await graph();
  const pp = P.node(g, ctx.made.teaHouse.nodes.primaryProperty);
  const rows = await P.propertiesPage(ctx.file, P.node(g, TH).props.uuid);
  const row = (name) => rows.find((r) => r.name === name);
  const typeOf = (r) => { try { return JSON.parse(r.json).property.type; } catch { return null; } };
  assert(row('price') && typeOf(row('price')) === 'number' && row('price').parentName === pp.props.name, `the Properties page lists price, a number, at the top; got ${show(row('price'))}`);
  assert(row('city') && typeOf(row('city')) === 'string' && row('city').parentName === 'address', `and city, a string, under address; got ${show(row('city'))}`);
  void keys;
});

test('AP9: a lettered concept: the write lands, and the answer says its letter no longer matches', async () => {
  const { a } = await main();
  const d = ok(a, 'goal');
  assert(d.outcome === 'added' && d.letterOutOfDate === true, `added to tapestry owner goal, whose schema node has a letter; got ${show({ outcome: d.outcome, letterOutOfDate: d.letterOutOfDate })}`);
});

test('AP10: the write takes the lock on the concept\'s header before it writes anything else', async () => {
  const { ctx, TH, before, afterA } = await main();
  const txns = P.transactions(afterA.log, before.log.length).filter((t) => t.end === 'commit');
  const priceTx = txns.find((t) => t.steps.some((s) => s.kind === 'create'));
  assert(priceTx, `a committed write that made nodes; got ${show(txns.map((t) => t.steps.map((s) => s.kind)))}`);
  const writes = priceTx.steps.filter((s) => s.call === 'tx.run');
  assert(writes[0] && writes[0].kind === 'copies' && show(writes[0].keys) === show([TH]) && writes[1] && writes[1].kind === 'copies' && show(writes[1].keys) === show([TH]),
    `its first two statements set and clear the lock on the header; got ${show(writes.slice(0, 3))}`);
  void ctx;
});

test('AP11: each refusal, and the graph as it was after them all; a refused write undoes its catching up', async () => {
  const { r, beforeR, afterR, ctx } = await main();
  for (const [id, status, code] of [
    ['r-unknown', 404, 'unknown-concept'], ['r-not-header', 404, 'unknown-concept'],
    ['r-other', 409, 'not-own-concept'], ['r-owner-key', 409, 'not-own-concept'], ['r-firmware', 409, 'firmware-concept'],
    ['r-no-schema', 409, 'no-schema'], ['r-two-schemas', 409, 'no-schema'], ['r-no-pp', 409, 'no-primary-property'],
    ['r-not-wrapped', 409, 'not-wrapped'], ['r-untyped', 409, 'unreadable-schema'], ['r-tangled', 409, 'tangled-tree'], ['r-not-own-node', 409, 'not-own-node'],
    ['r-name-empty', 400, 'bad-name'], ['r-name-long', 400, 'bad-name'], ['r-name-control', 400, 'bad-name'], ['r-name-bidi', 400, 'bad-name'],
    ['r-name-invisible', 400, 'bad-name'], ['r-name-proto', 400, 'bad-name'],
    ['r-type-regex', 400, 'bad-type'], ['r-type-text', 400, 'bad-type'], ['r-description', 400, 'bad-description'],
    ['r-parent-string', 409, 'bad-parent'], ['r-parent-list', 409, 'bad-parent'], ['r-parent-primary', 409, 'bad-parent'],
    ['r-parent-elsewhere', 409, 'bad-parent'], ['r-parent-nobody', 409, 'bad-parent'],
    ['r-piece-array', 400, 'bad-schema'], ['r-piece-unparsed', 400, 'bad-schema'], ['r-piece-properties', 400, 'bad-schema'], ['r-piece-required', 400, 'bad-schema'],
    ['r-piece-type', 400, 'bad-schema'], ['r-piece-description', 400, 'bad-schema'], ['r-piece-compile', 400, 'bad-schema'],
    ['r-in-use', 409, 'name-in-use'], ['r-in-use-catch-up', 409, 'name-in-use'],
    ['r-piece-desc-control', 400, 'bad-description'],
  ]) refused(r, id, status, code);
  assert(/number/.test(r.req('r-in-use').body.error) && /string/.test(r.req('r-in-use').body.error), `name-in-use names what differs; got ${show(r.req('r-in-use').body.error)}`);
  assert(P.same(P.graphOf(afterR), P.graphOf(beforeR)), 'every refusal left the graph as it was: no node, tag, relationship or entry');
  assert(P.treeOf(afterR, ctx.made.bookshop.conceptHeader).length === 0, 'bookshop\'s fields got no nodes: the refused write undid its catching up');
});

test('AP12: not-installed: the graph has no property concept', async () => {
  P.needDecls(['add-property']);
  const seed = await P.seedProperties({ without: ['property'] });
  const file = seed.file(tmp('add-property-not-installed-'));
  const n = P.runOn(file, [add('n', 'owner', { concept: seed.keys.beagle, name: 'weight', type: 'number' })]);
  refused(n, 'n', 409, 'not-installed');
});

test('AP13: nothing is signed; callers; an admin\'s add is the admin\'s; the command; the list and /docs', async () => {
  const { a } = await main();
  assert(ok(a, 'price').outcome === 'added', 'the path under test ran (AP1 added a property)');
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key; the spy saw ${show(a.spy)}`);
  assert(a.req('visitor').status === 401 && a.req('stranger').status === 403 && a.req('text').status === 415, `401, 403 and 415; got ${a.req('visitor').status} ${a.req('stranger').status} ${a.req('text').status}`);
  const g = await graph();
  assert(!g.nodes.some((n) => /^(visitor|stranger|text) field$/.test(String(n.props.name))), 'none of them added anything');
  const ad = ok(a, 'admin');
  assert(ad.outcome === 'added' && show(ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the admin's add is the admin's; got ${show(ad.change && ad.change.by)}`);
  const c = a.cmd('cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.data.outcome === 'added' && body.data.property.field === 'brightness' && show(body.data.change.by) === show({ role: 'local', pubkey: null }), `the command adds, recorded as the command's; got ${show(body)}`);
  const rc = a.cmd('cli-refused');
  const rb = JSON.parse(rc.stdout);
  assert(rc.code === 1 && rb.code === 'not-own-concept', `the command's refusal is the route's; got ${show(rb)}`);
  const e = ((a.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'add-property');
  assert(e && e.kind === 'write' && e.access === 'owner-and-admins' && show(e.guards) === show([RULE]) && show(e.repeatKey) === show(['concept', 'name', 'type', 'required', 'description', 'parent', 'schema']),
    `listed: a write, ${RULE}, repeatKey [concept, name, type, required, description, parent, schema]; got ${show(e && { kind: e.kind, guards: e.guards, repeatKey: e.repeatKey })}`);
  const codes = e.refusals.map((x) => x.code);
  for (const code of CODES) assert(codes.includes(code), `its refusals include ${code}; got ${show(codes)}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(P.ROUTE.add)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('add-property-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${P.ROUTE.add}; got ${line}`);
});

test('AP14: the check of what a write wrote refuses only what the write breaks, over what an installed instance has (ADR 0018 Amendment 2)', async () => {
  P.needDecls(['add-property', 'update-property']);
  const ctx = await P.prepare('add-property-amendment-2');
  const { file, made, k } = ctx;
  const TH = made.teaHouse.conceptHeader;
  const s = S.readState(file);
  const b = P.over(s);
  const DRAFT = 'https://json-schema.org/draft/2020-12/schema';
  const schemaNode = (slug, header, schema) => {
    const n = b.lettered({ uuid: `39999:${TA}:${slug}-schema`, labels: ['ListItem', 'JSONSchema'], name: `json schema for the concept of ${slug}`, tags: [['d', `${slug}-schema`], ['name', `json schema for the concept of ${slug}`], ['json', JSON.stringify({ jsonSchema: { $schema: DRAFT, type: 'object', required: [], definitions: {}, ...schema } })]] });
    b.link(n, 'IS_THE_JSON_SCHEMA_FOR', header);
  };
  // What the live check found on an instance (L1a): firmware's graph concept has a schema that requires
  // graph.graphType, which no tree graph create-concept makes has, and a concept's tree graph is one of its elements.
  schemaNode('graph', b.byUuid(`39998:${TA}:graph`), { required: ['graph'], properties: { graph: { type: 'object', required: ['graphType'], properties: { graphType: { type: 'string' } } } } });
  b.link(b.byKey(k.supersets.graph), 'HAS_ELEMENT', b.byKey(made.teaHouse.nodes.propertyTreeGraph));
  // And a concept whose schema requires a property's description, every property node its element: its superset
  // holds the property concept's.
  const strict = b.lettered({ uuid: `39998:${TA}:strict-property`, kind: 39998, labels: ['ListHeader', 'ConceptHeader'], name: 'strict property', tags: [['d', 'strict-property'], ['names', 'strict property', 'strict properties'], ['json', JSON.stringify({ word: { slug: 'concept-header-for-the-concept-of-strict-properties', name: 'concept header for the concept of strict properties', wordTypes: ['word', 'conceptHeader'] }, conceptHeader: { oNames: { singular: 'strict property', plural: 'strict properties' }, oKeys: { singular: 'strictProperty', plural: 'strictProperties' } } })]] });
  const strictSup = b.lettered({ uuid: `39999:${TA}:strict-property-superset`, labels: ['ListItem', 'Superset'], name: 'superset for the concept of strict properties', tags: [['d', 'strict-property-superset'], ['name', 'superset for the concept of strict properties']] });
  b.link(strict, 'IS_THE_CONCEPT_FOR', strictSup);
  b.link(strictSup, 'IS_A_SUPERSET_OF', b.byKey(k.supersets.property));
  schemaNode('strict-property', strict, { required: ['property'], properties: { property: { type: 'object', required: ['description'] } } });
  G.writeState(file, s);

  const x = P.runOn(file, [
    add('lands', 'owner', { concept: TH, name: 'price', type: 'number', description: 'What a pot costs' }),
    add('new-breaks', 'owner', { concept: TH, name: 'colour', type: 'string' }),
  ]);
  const landed = x.req('lands');
  assert(landed.status === 200 && landed.body.data.outcome === 'added',
    `the first write lands, though the tree graph it rewrites fails graph's schema before it and after; got ${landed.status} ${show(landed.body)}`);
  const g = S.readState(file);
  const tg = P.json(g, made.teaHouse.nodes.propertyTreeGraph);
  assert(tg && tg.graph && tg.graph.graphType === undefined && tg.graph.nodes.some((n) => n.uuid === landed.body.data.property.address),
    `the tree graph was rewritten, listing price, and still has no graphType; got ${show(tg && tg.graph)}`);
  const nb = x.req('new-breaks');
  assert(nb.status === 400 && nb.body.code === 'invalid-fields' && nb.body.rule === RULE && /strict property/.test(nb.body.error) && /description/.test(nb.body.error),
    `a new property node a concept's schema refuses is refused, naming that concept; got ${nb.status} ${show(nb.body)}`);
  assert(!P.treeOf(g, TH).some((r) => r.name === 'colour'), 'and no colour node was made');
  const y = P.runOn(file, [P.post('update')('old-breaks', 'owner', { property: landed.body.data.property.property, description: '' })]);
  const ob = y.req('old-breaks');
  assert(ob.status === 400 && ob.body.code === 'invalid-fields' && /strict property/.test(ob.body.error),
    `taking out the description that strict property requires is refused: a problem the write introduces; got ${ob.status} ${show(ob.body)}`);
  assert(P.json(S.readState(file), landed.body.data.property.property).property.description === 'What a pot costs', 'and price keeps its description');
});

test('AP15: the report names at most 50 elements in each list, the first by tapestryKey, and counts them all (review round 1, finding 3)', async () => {
  P.needDecls(['add-property', 'remove-property']);
  const ctx = await P.prepare('add-property-cap');
  const { file, made } = ctx;
  const LAMP = made.lamp.conceptHeader;
  const s = S.readState(file);
  const b = P.over(s);
  const sup = b.byKey(made.lamp.nodes.superset);
  const entries = [];
  const keys = [];
  for (let i = 0; i < 60; i += 1) {
    const name = `lamp ${String(i).padStart(2, '0')}`;
    const slug = P.slugOf(name);
    const word = { slug, name, wordTypes: ['word', 'lamp'] };
    const section = { name, slug, description: `lamp number ${i}` };
    const n = b.lettered({ uuid: `39999:${TA}:${slug}`, labels: ['ListItem'], name, tags: [['d', slug], ['name', name], ['z', made.lamp.address], ['json', JSON.stringify({ word, lamp: section })]] });
    b.link(sup, 'HAS_ELEMENT', n);
    keys.push(n.props.tapestryKey);
    entries.push([n.props.tapestryKey, { word, lamp: section, graphContext: { derivedAt: 1763000001, parentJsonSchemas: [] } }]);
  }
  G.writeState(file, s);
  P.storeEntries(ctx.dir, entries);
  const first50 = [...keys].sort().slice(0, 50);

  const x = P.runOn(file, [add('watts', 'owner', { concept: LAMP, name: 'watts', type: 'integer', required: true })]);
  const e = ok(x, 'watts').elements;
  assert(e.judged === 60 && e.stoppedFitting.count === 60 && e.stoppedFitting.elements.length === 50,
    `all 60 stop fitting, counted, and 50 are named; got ${show({ judged: e.judged, count: e.stoppedFitting.count, named: e.stoppedFitting.elements.length })}`);
  assert(show(e.stoppedFitting.elements.map((y) => y.node)) === show(first50), 'the 50 named are the first by tapestryKey');
  assert(e.stoppedFitting.elements.every((y) => y.problems.some((p) => p.message === '`lamp.watts` is required')), 'each named with its problem, in the rule\'s words');
  assert(e.limit === 10000 && e.beyond === false, `the limit, and not beyond it; got ${show({ limit: e.limit, beyond: e.beyond })}`);

  const slugKey = P.treeOf(S.readState(file), LAMP).find((row) => row.name === 'slug').key;
  const y = P.runOn(file, [P.post('remove')('slug', 'owner', { property: slugKey })]);
  const st = ok(y, 'slug').elements.stillHold;
  assert(st.count === 60 && st.elements.length === 50 && show(st.elements.map((z) => z.node)) === show(first50),
    `all 60 still hold a slug, counted, and the first 50 by tapestryKey are named; got ${show({ count: st.count, named: st.elements.length })}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
