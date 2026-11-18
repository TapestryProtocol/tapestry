'use strict';
/**
 * graph set-schema — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/18-property-operations.md (AC2, AC5–AC9, and the
 *          narrowings "Corrected at Architecture")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0018-property-operations.md (Decisions 1–7.4, 8–14)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/18-property-operations.test-plan.md
 *
 * Stack-free, over test/helpers/propertyGraph.js's seed. Runs, in order, over one state:
 *   A  the sets that land, add-property and mark-field on lamp, the callers, the command and the list;
 *   R  only refusals, so the graph after R is the graph before it.
 *
 *   SS1   a whole schema: the properties match it, it reads back as given, and the answer says what was added
 *   SS2   the same schema again: unchanged, nothing recorded
 *   SS3   a second schema: added, changed, removed; a field kept keeps its node; the report on the elements
 *   SS4   a schema missing what the json-schema concept requires: filled in, and named in filledIn
 *   SS5   a concept whose current schema can't be caught up to (cat, mouse) is set all the same, against its tree
 *   SS6   the first write on beagle catches its old-shape tree up, then adds weight
 *   SS7   32 levels are allowed; a 33rd is refused, by set-schema and by add-property
 *   SS8   each refusal, and the graph as it was after them
 *   SS9   nothing is signed; callers; an admin's set is the admin's; the command; the list and /docs
 */

const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const P = require('../../helpers/propertyGraph');

const { ROOT, ADMIN, assert, show, tmp } = S;
const cp = (n) => String.fromCodePoint(n); // a control or invisible character, never one typed raw in this file
const { test, run } = S.makeSuite('operations: graph set-schema');
const set = P.post('set');
const add = P.post('add');
const RULE = 'element-fits-schema';
const DRAFT = 'https://json-schema.org/draft/2020-12/schema';
const CODES = ['unknown-concept', 'not-own-concept', 'firmware-concept', 'not-installed', 'no-schema', 'no-primary-property', 'not-wrapped', 'tangled-tree', 'not-own-node', 'bad-name', 'bad-type', 'bad-description', 'bad-schema', 'schema-too-large', 'marked-field', 'no-free-address', 'invalid-fields', 'invalid-input', 'wrong-content-type', 'sign-in-required', 'not-allowed'];

/** A wrapped schema for a concept keyed `key`, with these fields, and every frame keyword the json-schema concept requires. */
const wrapped = (key, fields, section = {}) => ({ $schema: DRAFT, type: 'object', required: [key], definitions: {}, properties: { [key]: { type: 'object', ...section, properties: fields } } });
/** A chain of `n` objects, l1 holding l2 … holding ln, ln an object with nothing under it. */
function chain(n) {
  let inner = { type: 'object' };
  for (let i = n; i > 1; i--) inner = { type: 'object', properties: { [`l${i}`]: inner } };
  return { l1: inner };
}

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    P.needDecls(['set-schema', 'add-property']);
    const ctx = await P.prepare('set-schema');
    const { file, made, k } = ctx;
    const before = S.readState(file);
    const GD = made.gadget.conceptHeader;
    const gd0 = P.schemaDoc(before, GD);
    const S1 = P.copy(gd0);
    S1.allOf = [{ required: ['gadget'] }];
    Object.assign(S1.properties.gadget.properties, {
      color: { type: 'string', enum: ['red', 'blue'] },
      size: { type: 'object', additionalProperties: false, required: ['width'], properties: { width: { type: 'number' }, height: { type: 'number' } } },
      tags: { type: 'array', items: { type: 'string' } },
      stock: { type: 'integer', default: 0 },
    });
    const S2 = P.copy(S1);
    S2.properties.gadget.properties.color.enum = ['red', 'green'];
    S2.properties.gadget.properties.stock = { type: 'string', default: 'none' };
    delete S2.properties.gadget.properties.size.properties.height;
    delete S2.properties.gadget.properties.tags;
    S2.properties.gadget.properties.brand = { type: 'string' };
    const S3 = { properties: { gadget: { type: 'object', properties: { name: { type: 'string' } } } } };
    const S4 = { $schema: DRAFT, type: 'object', required: [], definitions: {}, properties: { gadget: { type: 'object', properties: { name: { type: 'string' }, weight: { type: 'number' } } } } };
    const cat0 = P.schemaDoc(before, k.cat);
    const catSet = P.copy(cat0);
    catSet.properties.cat.properties.favoriteToy = { type: 'string', enum: ['ball', 'string'] };
    const mouse0 = P.schemaDoc(before, k.mouse);
    const mouseSet = P.copy(mouse0);
    delete mouseSet.properties.word;
    const mouseCli = P.copy(mouseSet);
    mouseCli.properties.mouse.properties.whiskers = { type: 'integer' };
    const beagle0 = P.schemaDoc(before, k.beagle);
    const beagleSet = P.copy(beagle0);
    beagleSet.properties.beagle.properties.weight = { type: 'number' };
    const BK = made.bookshop.conceptHeader;
    const bk0 = P.schemaDoc(before, BK);
    const deep = P.copy(bk0);
    Object.assign(deep.properties.bookshop.properties, chain(32));
    const LAMP = made.lamp.conceptHeader;
    const lamp0 = P.schemaDoc(before, LAMP);
    const a = P.runOn(file, [
      set('visitor', 'visitor', { concept: GD, schema: S1 }),
      set('stranger', 'stranger', { concept: GD, schema: S1 }),
      set('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ concept: GD, schema: S1 }) }),
      set('gd-set', 'owner', { concept: GD, schema: S1 }),
      set('gd-same', 'owner', { concept: GD, schema: S1 }),
      set('gd-s2', 'owner', { concept: GD, schema: S2 }),
      set('gd-min', 'owner', { concept: GD, schema: S3 }),
      set('cat-set', 'owner', { concept: k.cat, schema: catSet }),
      set('mouse-set', 'owner', { concept: k.mouse, schema: mouseSet }),
      set('beagle-set', 'owner', { concept: k.beagle, schema: beagleSet }),
      set('deep', 'owner', { concept: BK, schema: deep }),
      add('wattage', 'owner', { concept: LAMP, name: 'wattage', type: 'integer' }),
      P.post('mark')('mark', 'owner', { concept: LAMP, field: 'wattage' }),
      set('admin', 'admin', { concept: GD, schema: S4 }),
      { id: 'list', method: 'GET', url: P.ROUTE.list, caller: 'admin' },
    ], [
      { id: 'cli', argv: ['graph', 'set-schema', '--concept', k.mouse, '--schema', JSON.stringify(mouseCli)] },
      { id: 'cli-refused', argv: ['graph', 'set-schema', '--concept', k.relay, '--schema', JSON.stringify(wrapped('nostrRelay', { name: { type: 'string' } }))] },
    ], true);
    const deepAnswer = a.req('deep');
    assert(deepAnswer.status === 200, `the 32-level set must land; got ${deepAnswer.status} ${show(deepAnswer.body)}`);
    const l32 = deepAnswer.body.data.added.find((x) => x.path.length === 32);
    assert(l32, `the 32-level set's answer names its 32nd level; got ${show(deepAnswer.body.data.added.map((x) => x.path.length))}`);
    const many = {};
    for (let i = 0; i < 1001; i++) many[`f${i}`] = { type: 'string' };
    const lampWith = (wattage) => { const s = P.copy(lamp0); if (wattage) s.properties.lamp.properties.wattage = wattage; return s; };
    const beforeR = S.readState(file);
    const r = P.runOn(file, [
      set('r-two-top', 'owner', { concept: GD, schema: { ...wrapped('gadget', { name: { type: 'string' } }), properties: { gadget: { type: 'object', properties: { name: { type: 'string' } } }, word: { type: 'object' } } } }),
      set('r-top-array', 'owner', { concept: GD, schema: { ...wrapped('gadget', { name: { type: 'string' } }), type: 'array' } }),
      set('r-no-section', 'owner', { concept: GD, schema: wrapped('widget', { name: { type: 'string' } }) }),
      set('r-section-string', 'owner', { concept: GD, schema: { ...wrapped('gadget', {}), properties: { gadget: { type: 'string' } } } }),
      set('r-ref', 'owner', { concept: GD, schema: { ...wrapped('gadget', { part: { $ref: '#/definitions/part' } }), definitions: { part: { type: 'string' } } } }),
      set('r-enum-only', 'owner', { concept: GD, schema: wrapped('gadget', { mood: { enum: ['calm', 'busy'] } }) }),
      set('r-regex', 'owner', { concept: GD, schema: wrapped('gadget', { pattern: { type: 'regex' } }) }),
      set('r-proto', 'owner', { concept: GD, schema: `{"$schema":"${DRAFT}","type":"object","required":[],"definitions":{},"properties":{"gadget":{"type":"object","properties":{"__proto__":{"type":"string"}}}}}` }),
      set('r-space', 'owner', { concept: GD, schema: wrapped('gadget', { ' size': { type: 'string' } }) }),
      set('r-control', 'owner', { concept: GD, schema: wrapped('gadget', { [`bell${cp(0x07)}`]: { type: 'string' } }) }),
      set('r-deep', 'owner', { concept: BK, schema: (() => { const d = P.copy(bk0); Object.assign(d.properties.bookshop.properties, chain(33)); return d; })() }),
      set('r-many', 'owner', { concept: GD, schema: wrapped('gadget', many) }),
      add('r-deep-add', 'owner', { concept: BK, name: 'l33', type: 'string', parent: l32.property }),
      set('r-unparsed', 'owner', { concept: GD, schema: '{nope' }),
      set('r-array', 'owner', { concept: GD, schema: '[1]' }),
      set('r-compile', 'owner', { concept: GD, schema: wrapped('gadget', { code: { type: 'string', minLength: 'two' } }) }),
      set('r-unknown', 'owner', { concept: P.NOBODY, schema: wrapped('ghost', {}) }),
      set('r-other', 'owner', { concept: k.relay, schema: wrapped('nostrRelay', {}) }),
      set('r-owner-key', 'owner', { concept: k.recipe, schema: wrapped('recipe', {}) }),
      set('r-firmware', 'owner', { concept: k.word, schema: wrapped('word', {}) }),
      set('r-no-schema', 'owner', { concept: made.stall.conceptHeader, schema: wrapped('stall', {}) }),
      set('r-two-schemas', 'owner', { concept: k.bird, schema: wrapped('avian', {}) }),
      set('r-no-pp', 'owner', { concept: made.kiosk.conceptHeader, schema: wrapped('kiosk', {}) }),
      set('r-tangled', 'owner', { concept: made.hut.conceptHeader, schema: wrapped('hut', {}) }),
      set('r-not-own-node', 'owner', { concept: made.cabin.conceptHeader, schema: P.schemaDoc(before, made.cabin.conceptHeader) }),
      set('r-marked-remove', 'owner', { concept: LAMP, schema: lampWith(null) }),
      set('r-marked-type', 'owner', { concept: LAMP, schema: lampWith({ type: 'number' }) }),
      // Review round 1: a field's description becomes its node's tag (finding 4); only an object holds properties (finding 8).
      set('r-desc-control', 'owner', { concept: GD, schema: wrapped('gadget', { note: { type: 'string', description: `a${cp(0x01)}b` } }) }),
      set('r-props-under-string', 'owner', { concept: GD, schema: wrapped('gadget', { code: { type: 'string', properties: { part: { type: 'string' } } } }) }),
    ]);
    const afterR = S.readState(file);
    return { ctx, a, r, GD, BK, S1, S2, S3, S4, gd0, catSet, mouseSet, beagleSet, deep, before, beforeR, afterR };
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
const paths = (list) => list.map((x) => x.path.join('.')).sort();

test('SS1: a whole schema: the properties match it, it reads back as given, and the answer says what was added', async () => {
  const { a, S1, GD } = await main();
  const d = ok(a, 'gd-set');
  assert(d.outcome === 'set' && show(d.filledIn) === show([]) && d.letterOutOfDate === false, `set, nothing filled in, no letter; got ${show({ outcome: d.outcome, filledIn: d.filledIn, letterOutOfDate: d.letterOutOfDate })}`);
  assert(show(d.caughtUp.added.map((x) => x.field)) === show(['name', 'slug', 'description']), `catching up first gave the schema's three fields their nodes; got ${show(d.caughtUp)}`);
  assert(show(paths(d.added)) === show(['color', 'size', 'size.height', 'size.width', 'stock', 'tags']) && d.changed.length === 0 && d.removed.length === 0,
    `added each new field, at its place, and changed and removed nothing; got ${show({ added: paths(d.added), changed: paths(d.changed), removed: paths(d.removed) })}`);
  const width = d.added.find((x) => x.path.join('.') === 'size.width');
  const size = d.added.find((x) => x.path.join('.') === 'size');
  assert(width.parent === size.property && size.required === false && width.required === true, `width hangs on size, and is required there; got ${show({ width, size })}`);
  const sc = changesOf(d, 'schema-changed');
  assert(sc.length === 1 && P.same(sc[0].now, S1), `the schema written is the schema given, every keyword kept (allOf, additionalProperties, default, enum, items); got ${show(sc[0] && sc[0].now)}`);
  assert(d.elements.stoppedFitting.count === 0 && d.elements.judged === 2, `g1 and g2 fit; got ${show(d.elements)}`);
  void GD;
});

test('SS2: the same schema again changes nothing, records nothing, and answers unchanged', async () => {
  const { a } = await main();
  const d = ok(a, 'gd-same');
  assert(d.outcome === 'unchanged' && d.change === null && d.added.length === 0 && d.changed.length === 0 && d.removed.length === 0, `unchanged, nothing recorded; got ${show(d)}`);
});

test('SS3: a second schema: added, changed and removed; a field kept keeps its node; the elements it leaves behind', async () => {
  const { a, ctx } = await main();
  const first = ok(a, 'gd-set');
  const d = ok(a, 'gd-s2');
  assert(d.outcome === 'set' && show(paths(d.added)) === show(['brand']) && show(paths(d.changed)) === show(['color', 'stock']) && show(paths(d.removed)) === show(['size.height', 'tags']),
    `brand added; color and stock changed; size.height and tags removed; got ${show({ added: paths(d.added), changed: paths(d.changed), removed: paths(d.removed) })}`);
  const keyOf = (list, p) => (list.find((x) => x.path.join('.') === p) || {}).property;
  assert(keyOf(d.changed, 'color') === keyOf(first.added, 'color') && keyOf(d.changed, 'stock') === keyOf(first.added, 'stock'), 'a field it kept kept its node and its tapestryKey');
  const e = d.elements;
  assert(e.stoppedFitting.count === 1 && e.stoppedFitting.elements[0].node === ctx.el.g1 && e.stoppedFitting.elements[0].problems.some((pr) => pr.message === '`gadget.stock` must be a string'),
    `g1 stops fitting: its stock is a number; got ${show(e.stoppedFitting)}`);
  assert(e.stillHold.count === 1 && e.stillHold.elements[0].node === ctx.el.g1, `g1 still holds tags, which was removed; got ${show(e.stillHold)}`);
});

test('SS4: a schema missing what the json-schema concept requires: each is filled in, and named in filledIn', async () => {
  const { a, S3 } = await main();
  const d = ok(a, 'gd-min');
  assert(show(d.filledIn) === show(['$schema', 'type', 'required', 'definitions']), `$schema, type, required and definitions filled in; got ${show(d.filledIn)}`);
  const now = changesOf(d, 'schema-changed')[0].now;
  assert(P.same(now, { ...S3, $schema: DRAFT, type: 'object', required: [], definitions: {} }), `the schema written is the one given and the four filled in, nothing else; got ${show(now)}`);
  assert(show(paths(d.changed)) === show(['name']) && show(paths(d.removed)) === show(['brand', 'color', 'description', 'size', 'size.width', 'slug', 'stock']),
    `name changed, everything else removed; got ${show({ changed: paths(d.changed), removed: paths(d.removed) })}`);
  assert(d.elements.stillHold.count === 2 && d.elements.stoppedFitting.count === 0, `g1 and g2 still hold removed fields, and nothing stops fitting; got ${show(d.elements)}`);
});

test('SS5: a concept whose current schema can\'t be caught up to is set all the same, against its tree as it is', async () => {
  const { a, catSet, mouseSet } = await main();
  const c = ok(a, 'cat-set');
  assert(c.outcome === 'set' && c.caughtUp.added.length === 0 && show(paths(c.added)) === show(['description', 'favoriteToy', 'name', 'slug']),
    `cat's schema, with a field that has no type and doesn't compile, is replaced; every field is added to its empty tree; got ${show({ caughtUp: c.caughtUp, added: paths(c.added) })}`);
  assert(c.elements.before && typeof c.elements.before.problem === 'string', `the schema before couldn't be judged, and the report says so; got ${show(c.elements.before)}`);
  assert(P.same(changesOf(c, 'schema-changed')[0].now, catSet), 'the schema written is the one given');
  const m = ok(a, 'mouse-set');
  assert(m.outcome === 'set' && P.same(changesOf(m, 'schema-changed')[0].now, mouseSet), `mouse's schema, which wasn't wrapped, is replaced with a wrapped one; got ${show(m.outcome)}`);
});

test('SS6: the first write on beagle catches its old-shape tree up, then adds weight; its letter no longer matches', async () => {
  const { a, ctx } = await main();
  const d = ok(a, 'beagle-set');
  assert(d.outcome === 'set' && show(paths(d.added)) === show(['weight']) && d.changed.length === 0 && d.removed.length === 0 && d.letterOutOfDate === true,
    `weight added, nothing else changed against the schema before; the letter no longer matches; got ${show({ added: paths(d.added), changed: paths(d.changed), removed: paths(d.removed), letterOutOfDate: d.letterOutOfDate })}`);
  assert(show(d.caughtUp.changed.map((x) => x.field).sort()) === show(['color', 'description', 'name', 'slug']) && show(d.caughtUp.removed.map((x) => x.field)) === show(['retired']),
    `catching up rewrote the four old-shape nodes and took the stray out; got ${show(d.caughtUp)}`);
  assert(d.elements.judged === 1 && d.elements.stoppedFitting.count === 0, `rover fits; got ${show(d.elements)}`);
  void ctx;
});

test('SS7: 32 levels under the concept\'s key are allowed; a 33rd is refused, by set-schema and by add-property', async () => {
  const { a, r, deep, BK } = await main();
  const d = ok(a, 'deep');
  assert(d.outcome === 'set' && d.added.some((x) => x.path.length === 32), `32 levels land; got ${show(d.added.map((x) => x.path.length))}`);
  const g = await graph();
  assert(P.same(P.schemaDoc(g, BK), deep), 'and read back as given');
  refused(r, 'r-deep', 400, 'schema-too-large');
  refused(r, 'r-deep-add', 400, 'schema-too-large');
});

test('SS8: each refusal, and the graph as it was after them', async () => {
  const { r, beforeR, afterR } = await main();
  for (const [id, status, code] of [
    ['r-two-top', 400, 'not-wrapped'], ['r-top-array', 400, 'not-wrapped'], ['r-no-section', 400, 'not-wrapped'], ['r-section-string', 400, 'not-wrapped'],
    ['r-ref', 400, 'bad-type'], ['r-enum-only', 400, 'bad-type'], ['r-regex', 400, 'bad-type'],
    ['r-proto', 400, 'bad-name'], ['r-space', 400, 'bad-name'], ['r-control', 400, 'bad-name'],
    ['r-many', 400, 'schema-too-large'],
    ['r-unparsed', 400, 'bad-schema'], ['r-array', 400, 'bad-schema'], ['r-compile', 400, 'bad-schema'],
    ['r-unknown', 404, 'unknown-concept'], ['r-other', 409, 'not-own-concept'], ['r-owner-key', 409, 'not-own-concept'], ['r-firmware', 409, 'firmware-concept'],
    ['r-no-schema', 409, 'no-schema'], ['r-two-schemas', 409, 'no-schema'], ['r-no-pp', 409, 'no-primary-property'],
    ['r-tangled', 409, 'tangled-tree'], ['r-not-own-node', 409, 'not-own-node'],
    ['r-marked-remove', 409, 'marked-field'], ['r-marked-type', 409, 'marked-field'],
    ['r-desc-control', 400, 'bad-description'], ['r-props-under-string', 400, 'bad-type'],
  ]) refused(r, id, status, code);
  assert(/unmark-field/.test(r.req('r-marked-remove').body.error), `marked-field names graph unmark-field; got ${show(r.req('r-marked-remove').body.error)}`);
  assert(P.same(P.graphOf(afterR), P.graphOf(beforeR)), 'every refusal left the graph as it was');
});

test('SS9: nothing is signed; callers; an admin\'s set is the admin\'s; the command; the list and /docs', async () => {
  const { a, S4, GD } = await main();
  assert(ok(a, 'gd-set').outcome === 'set', 'the path under test ran (SS1 set a schema)');
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key; the spy saw ${show(a.spy)}`);
  assert(a.req('visitor').status === 401 && a.req('stranger').status === 403 && a.req('text').status === 415, `401, 403 and 415; got ${a.req('visitor').status} ${a.req('stranger').status} ${a.req('text').status}`);
  const ad = ok(a, 'admin');
  assert(ad.outcome === 'set' && show(ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the admin's set is the admin's; got ${show(ad.change && ad.change.by)}`);
  const g = await graph();
  assert(P.same(P.schemaDoc(g, GD), S4), 'the graph\'s last schema for gadget is the admin\'s, as given');
  const cmd = a.cmd('cli');
  assert(cmd.code === 0, `the command exits 0; got ${cmd.code} ${cmd.stdout} ${cmd.stderr}`);
  const body = JSON.parse(cmd.stdout);
  assert(body.data.outcome === 'set' && show(paths(body.data.added)) === show(['whiskers']) && show(body.data.change.by) === show({ role: 'local', pubkey: null }), `the command sets, recorded as the command's; got ${show(body)}`);
  const rc = a.cmd('cli-refused');
  const rb = JSON.parse(rc.stdout);
  assert(rc.code === 1 && rb.code === 'not-own-concept', `the command's refusal is the route's; got ${show(rb)}`);
  const e = ((a.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'set-schema');
  assert(e && e.kind === 'write' && e.access === 'owner-and-admins' && show(e.guards) === show([RULE]) && show(e.repeatKey) === show(['concept', 'schema']),
    `listed: a write, ${RULE}, repeatKey [concept, schema]; got ${show(e && { kind: e.kind, guards: e.guards, repeatKey: e.repeatKey })}`);
  const codes = e.refusals.map((x) => x.code);
  for (const code of CODES) assert(codes.includes(code), `its refusals include ${code}; got ${show(codes)}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(P.ROUTE.set)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('set-schema-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${P.ROUTE.set}; got ${line}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
