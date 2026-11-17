'use strict';
/**
 * graph update-property — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/18-property-operations.md (AC2, AC3, AC6–AC9)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0018-property-operations.md (Decisions 1, 2, 6, 7.2, 8–14)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/18-property-operations.test-plan.md
 *
 * Stack-free, over test/helpers/propertyGraph.js's seed. Runs, in order, over one state:
 *   A  add-property makes tea house's price, opened, address and extras, and lamp's wattage and colors; mark-field
 *      marks lamp's two;
 *   B  add-property puts city under address;
 *   R  only refusals, so the graph after R is the graph before it (beagle's stray among them);
 *   C  the updates, the callers, the command and the list.
 *
 *   UP1   a description: the schema, the piece and the view, and its tag
 *   UP2   a type: the schema, the view, the type tag, and the entry's was and now
 *   UP3   required: the parent's required list, and the elements that stop fitting
 *   UP4   a piece merges: a keyword set, then taken out with null
 *   UP5   an empty description takes it out, tag and all
 *   UP6   the same values again: unchanged, nothing recorded
 *   UP7   a type away from object: refused while it has properties under it, else its empty properties go
 *   UP8   a marked field: its description changes; its type and its list's item type are refused
 *   UP9   the first write on beagle catches its old-shape tree up, then updates color; its letter no longer matches
 *   UP10  each refusal, and the graph as it was after them; the stray catching up would remove is refused, undone
 *   UP11  nothing is signed; callers; an admin's update is the admin's; the command; the list and /docs
 */

const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const P = require('../../helpers/propertyGraph');

const { ROOT, ADMIN, assert, show, tmp } = S;
const cp = (n) => String.fromCodePoint(n); // a control or invisible character, never one typed raw in this file
const { test, run } = S.makeSuite('operations: graph update-property');
const add = P.post('add');
const upd = P.post('update');
const RULE = 'element-fits-schema';
const CODES = ['unknown-property', 'not-own-concept', 'firmware-concept', 'not-installed', 'no-schema', 'no-primary-property', 'not-wrapped', 'unreadable-schema', 'tangled-tree', 'not-own-node', 'bad-type', 'bad-description', 'bad-schema', 'nothing-to-change', 'has-properties', 'marked-field', 'schema-too-large', 'invalid-fields', 'invalid-input', 'wrong-content-type', 'sign-in-required', 'not-allowed'];

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    P.needDecls(['add-property', 'update-property']);
    const ctx = await P.prepare('update-property');
    const { file, made, k, tree } = ctx;
    const TH = made.teaHouse.conceptHeader;
    const LAMP = made.lamp.conceptHeader;
    const a = P.runOn(file, [
      add('price', 'owner', { concept: TH, name: 'price', type: 'number', description: 'What a pot costs' }),
      add('opened', 'owner', { concept: TH, name: 'opened', type: 'string', description: 'The year it opened' }),
      add('address', 'owner', { concept: TH, name: 'address', type: 'object' }),
      add('extras', 'owner', { concept: TH, name: 'extras', type: 'object' }),
      add('wattage', 'owner', { concept: LAMP, name: 'wattage', type: 'integer' }),
      add('colors', 'owner', { concept: LAMP, name: 'colors', type: 'array', schema: { items: { type: 'string' } } }),
      P.post('mark')('mark-wattage', 'owner', { concept: LAMP, field: 'wattage' }),
      P.post('mark')('mark-colors', 'owner', { concept: LAMP, field: 'colors' }),
    ]);
    const key = {};
    for (const id of ['price', 'opened', 'address', 'extras', 'wattage', 'colors']) {
      const x = a.req(id);
      assert(x.status === 200, `the setup's add of ${id} must succeed; got ${x.status} ${show(x.body)}`);
      key[id] = x.body.data.property.property;
    }
    for (const id of ['mark-wattage', 'mark-colors']) assert(a.req(id).status === 200, `the setup's ${id} must succeed; got ${show(a.req(id).body)}`);
    const b = P.runOn(file, [add('city', 'owner', { concept: TH, name: 'city', type: 'string', description: 'Where it is', parent: key.address })]);
    assert(b.req('city').status === 200, `the setup's add of city must succeed; got ${show(b.req('city').body)}`);
    key.city = b.req('city').body.data.property.property;
    const beforeR = S.readState(file);
    const r = P.runOn(file, [
      upd('r-nothing', 'owner', { property: key.price }),
      upd('r-unknown', 'owner', { property: P.NOBODY, description: 'x' }),
      upd('r-primary', 'owner', { property: made.teaHouse.nodes.primaryProperty, description: 'x' }),
      upd('r-schema-node', 'owner', { property: made.teaHouse.nodes.jsonSchema, description: 'x' }),
      upd('r-element', 'owner', { property: k.rover, description: 'x' }),
      upd('r-stray', 'owner', { property: tree.retired, description: 'x' }),
      upd('r-type', 'owner', { property: key.price, type: 'regex' }),
      upd('r-description', 'owner', { property: key.price, description: `a${cp(0x01)}b` }),
      upd('r-piece-properties', 'owner', { property: key.address, schema: { properties: { x: { type: 'string' } } } }),
      upd('r-piece-required', 'owner', { property: key.address, schema: { required: ['city'] } }),
      upd('r-piece-type', 'owner', { property: key.price, type: 'number', schema: { type: 'string' } }),
      upd('r-piece-compile', 'owner', { property: key.price, schema: { maximum: 'ten' } }),
      upd('r-piece-array', 'owner', { property: key.price, schema: '[1]' }),
      upd('r-marked-type', 'owner', { property: key.wattage, type: 'number' }),
      upd('r-marked-items', 'owner', { property: key.colors, schema: { items: { type: 'integer' } } }),
      upd('r-tangled', 'owner', { property: ctx.extra.roof, description: 'x' }),
      upd('r-not-own-node', 'owner', { property: ctx.extra.theirName, description: 'x' }),
    ]);
    const afterR = S.readState(file);
    const c = P.runOn(file, [
      upd('visitor', 'visitor', { property: key.opened, description: 'visitor' }),
      upd('stranger', 'stranger', { property: key.opened, description: 'stranger' }),
      upd('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ property: key.opened, description: 'text' }) }),
      upd('desc', 'owner', { property: key.opened, description: 'When it opened' }),
      upd('type', 'owner', { property: key.price, type: 'string' }),
      upd('required', 'owner', { property: key.price, required: true }),
      upd('merge', 'owner', { property: key.price, schema: { minLength: 1 } }),
      upd('unmerge', 'owner', { property: key.price, schema: { minLength: null } }),
      upd('desc-clear', 'owner', { property: key.city, description: '' }),
      upd('same', 'owner', { property: key.opened, type: 'string' }),
      upd('obj-has-props', 'owner', { property: key.address, type: 'string' }),
      upd('empty-obj', 'owner', { property: key.extras, type: 'string' }),
      upd('marked-desc', 'owner', { property: key.wattage, description: 'Power draw' }),
      upd('beagle', 'owner', { property: tree.color, description: 'Its coat' }),
      upd('admin', 'admin', { property: key.opened, schema: { maxLength: 10 } }),
      { id: 'list', method: 'GET', url: P.ROUTE.list, caller: 'admin' },
    ], [
      { id: 'cli', argv: ['graph', 'update-property', '--property', key.opened, '--description', 'From the command'] },
      { id: 'cli-refused', argv: ['graph', 'update-property', '--property', P.NOBODY, '--description', 'x'] },
    ], true);
    return { ctx, r, c, TH, key, beforeR, afterR };
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
const tagValue = (g, k, type) => { const t = P.tags(g, k).find((x) => x.type === type); return t ? t.value : null; };

test('UP1: a description changes in the schema, the piece, the view and the description tag', async () => {
  const { c, key } = await main();
  const d = ok(c, 'desc');
  assert(d.outcome === 'updated' && show(d.changed) === show(['description']) && d.property.description === 'When it opened', `updated, the description changed; got ${show(d)}`);
  const own = changesOf(d, 'property-changed').filter((x) => !x.catchUp);
  assert(own.length === 1 && own[0].node === key.opened && own[0].was.schema.description === 'The year it opened' && own[0].now.schema.description === 'When it opened',
    `a property-changed change with was and now; got ${show(own)}`);
});

test('UP2: a type changes in the schema, the view and the type tag', async () => {
  const { c, key, TH } = await main();
  const d = ok(c, 'type');
  assert(d.outcome === 'updated' && show(d.changed) === show(['type']) && d.property.type === 'string', `updated, its type now string; got ${show(d)}`);
  const own = changesOf(d, 'property-changed').filter((x) => !x.catchUp);
  assert(own.length === 1 && own[0].was.schema.type === 'number' && own[0].now.schema.type === 'string', `was number, now string; got ${show(own)}`);
  const g = await graph();
  assert(P.schemaDoc(g, TH).properties.teaHouse.properties.price.type === 'string', 'the schema says string');
  assert(P.json(g, key.price).property.type === 'string' && tagValue(g, key.price, 'type') === 'string', 'the view and the type tag say string');
});

test('UP3: required goes in the parent\'s required list, and the report names the elements that stop fitting', async () => {
  const { c, TH, ctx } = await main();
  const d = ok(c, 'required');
  assert(d.outcome === 'updated' && show(d.changed) === show(['required']) && d.property.required === true, `updated, now required; got ${show(d)}`);
  const g = await graph();
  const section = P.schemaDoc(g, TH).properties.teaHouse;
  assert(section.required.includes('price'), `the section's required list holds price; got ${show(section.required)}`);
  assert(P.json(g, ctx.made.teaHouse.nodes.primaryProperty).property.required.includes('price'), 'and so does the primary property\'s view');
  const e = d.elements;
  assert(e.stoppedFitting.count === 3 && show(e.stoppedFitting.elements.map((x) => x.node).sort()) === show([ctx.el.lapsang, ctx.el.chai, ctx.el.assam].sort()) && e.alreadyNotFitting === 1,
    `lapsang, chai and assam stop fitting, oolong already didn't; got ${show(e)}`);
});

test('UP4: a piece merges: a keyword set, then taken out with null; everything else stays', async () => {
  const { c, key, TH } = await main();
  const m = ok(c, 'merge');
  assert(m.outcome === 'updated' && show(m.changed) === show(['schema']) && m.property.schema.minLength === 1 && m.property.schema.type === 'string', `minLength set, the rest kept; got ${show(m.property)}`);
  const u = ok(c, 'unmerge');
  assert(u.outcome === 'updated' && u.property.schema.minLength === undefined && u.property.schema.type === 'string' && u.property.description === 'What a pot costs', `minLength taken out, the rest kept; got ${show(u.property)}`);
  const g = await graph();
  assert(P.schemaDoc(g, TH).properties.teaHouse.properties.price.minLength === undefined, 'the schema follows');
  void key;
});

test('UP5: an empty description takes it out of the piece and the view, and its tag goes', async () => {
  const { c, key, TH } = await main();
  const d = ok(c, 'desc-clear');
  assert(d.outcome === 'updated' && d.property.description === null && d.property.schema.description === undefined, `city has no description; got ${show(d.property)}`);
  const g = await graph();
  assert(P.json(g, key.city).property.description === undefined && tagValue(g, key.city, 'description') === null, `nor has its view, and its description tag is gone; got ${show(P.tags(g, key.city).map((t) => t.type))}`);
  assert(P.schemaDoc(g, TH).properties.teaHouse.properties.address.properties.city.description === undefined, 'the schema follows');
});

test('UP6: the same values again change nothing, record nothing, and answer unchanged', async () => {
  const { c } = await main();
  const d = ok(c, 'same');
  assert(d.outcome === 'unchanged' && d.change === null && show(d.changed) === show([]), `unchanged, nothing recorded; got ${show(d)}`);
});

test('UP7: a type away from object is refused while properties hang under it; with none, its empty properties go', async () => {
  const { c, key, TH } = await main();
  refused(c, 'obj-has-props', 409, 'has-properties');
  const d = ok(c, 'empty-obj');
  assert(d.outcome === 'updated' && P.same(d.property.schema, { type: 'string' }), `extras, an object with nothing under it, becomes a string; got ${show(d.property)}`);
  const g = await graph();
  assert(P.same(P.schemaDoc(g, TH).properties.teaHouse.properties.extras, { type: 'string' }), 'the schema follows');
  assert(P.schemaDoc(g, TH).properties.teaHouse.properties.address.type === 'object', 'address, refused, is as it was');
  void key;
});

test('UP8: a marked field: its description changes; its type and its list\'s item type are refused, naming unmark-field', async () => {
  const { c, r } = await main();
  const d = ok(c, 'marked-desc');
  assert(d.outcome === 'updated' && d.property.description === 'Power draw', `a marked field's description changes; got ${show(d)}`);
  for (const id of ['r-marked-type', 'r-marked-items']) {
    const body = refused(r, id, 409, 'marked-field');
    assert(/unmark-field/.test(body.error), `${id} names graph unmark-field; got ${show(body.error)}`);
  }
});

test('UP9: the first write on beagle catches its old-shape tree up, then updates color; its letter no longer matches', async () => {
  const { c, ctx } = await main();
  const d = ok(c, 'beagle');
  assert(d.outcome === 'updated' && d.property.description === 'Its coat' && d.letterOutOfDate === true, `color updated; the letter no longer matches; got ${show(d)}`);
  assert(show(d.caughtUp.changed.map((x) => x.field).sort()) === show(['color', 'description', 'name', 'slug']) && show(d.caughtUp.removed.map((x) => x.field)) === show(['retired']) && d.caughtUp.added.length === 0,
    `catching up rewrote the four old-shape nodes and took the stray out; got ${show(d.caughtUp)}`);
  const g = await graph();
  const rows = P.treeOf(g, ctx.k.beagle);
  assert(show(rows.map((x) => x.name).sort()) === show(['color', 'description', 'name', 'slug']), `beagle's tree is its schema's four fields; got ${show(rows.map((x) => x.name))}`);
  for (const x of rows) assert(x.json.property.key === x.name && x.json.property.schema && x.json.property.schema.type === 'string', `each node holds its piece now; got ${show(x.json.property)}`);
  assert(P.node(g, ctx.tree.retired) === null, 'the stray is gone');
  const caught = (d.change.changes || []).filter((x) => x.catchUp === true);
  assert(caught.some((x) => x.change === 'property-removed' && x.node === ctx.tree.retired) && caught.filter((x) => x.change === 'property-changed').length === 4,
    `the entry marks each catching-up change; got ${show(caught.map((x) => x.change))}`);
});

test('UP10: each refusal, and the graph as it was after them all; the stray catching up would take out is refused, its catching up undone', async () => {
  const { r, beforeR, afterR, ctx } = await main();
  for (const [id, status, code] of [
    ['r-nothing', 400, 'nothing-to-change'], ['r-unknown', 404, 'unknown-property'], ['r-primary', 404, 'unknown-property'],
    ['r-schema-node', 404, 'unknown-property'], ['r-element', 404, 'unknown-property'], ['r-stray', 404, 'unknown-property'],
    ['r-type', 400, 'bad-type'], ['r-description', 400, 'bad-description'],
    ['r-piece-properties', 400, 'bad-schema'], ['r-piece-required', 400, 'bad-schema'], ['r-piece-type', 400, 'bad-schema'],
    ['r-piece-compile', 400, 'bad-schema'], ['r-piece-array', 400, 'bad-schema'],
    ['r-marked-type', 409, 'marked-field'], ['r-marked-items', 409, 'marked-field'],
    ['r-tangled', 409, 'tangled-tree'], ['r-not-own-node', 409, 'not-own-node'],
  ]) refused(r, id, status, code);
  assert(P.same(P.graphOf(afterR), P.graphOf(beforeR)), 'every refusal left the graph as it was');
  assert(P.node(afterR, ctx.tree.retired) && P.json(afterR, ctx.tree.name).property.required === true, 'beagle\'s tree is still the old one: the refused write undid its catching up');
});

test('UP11: nothing is signed; callers; an admin\'s update is the admin\'s; the command; the list and /docs', async () => {
  const { c, key } = await main();
  assert(ok(c, 'desc').outcome === 'updated', 'the path under test ran (UP1 updated a property)');
  assert(Array.isArray(c.spy) && c.spy.length === 0, `nothing signs, publishes or reads a key; the spy saw ${show(c.spy)}`);
  assert(c.req('visitor').status === 401 && c.req('stranger').status === 403 && c.req('text').status === 415, `401, 403 and 415; got ${c.req('visitor').status} ${c.req('stranger').status} ${c.req('text').status}`);
  const ad = ok(c, 'admin');
  assert(ad.outcome === 'updated' && show(ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the admin's update is the admin's; got ${show(ad.change && ad.change.by)}`);
  const cmd = c.cmd('cli');
  assert(cmd.code === 0, `the command exits 0; got ${cmd.code} ${cmd.stdout} ${cmd.stderr}`);
  const body = JSON.parse(cmd.stdout);
  assert(body.data.outcome === 'updated' && body.data.property.description === 'From the command' && show(body.data.change.by) === show({ role: 'local', pubkey: null }), `the command updates, recorded as the command's; got ${show(body)}`);
  const rc = c.cmd('cli-refused');
  const rb = JSON.parse(rc.stdout);
  assert(rc.code === 1 && rb.code === 'unknown-property', `the command's refusal is the route's; got ${show(rb)}`);
  const g = await graph();
  assert(P.json(g, key.opened).property.description === 'From the command' && tagValue(g, key.opened, 'description') === 'From the command', 'the graph holds the command\'s description, in the view and the description tag');
  const e = ((c.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'update-property');
  assert(e && e.kind === 'write' && e.access === 'owner-and-admins' && show(e.guards) === show([RULE]) && show(e.repeatKey) === show(['property', 'type', 'required', 'description', 'schema']),
    `listed: a write, ${RULE}, repeatKey [property, type, required, description, schema]; got ${show(e && { kind: e.kind, guards: e.guards, repeatKey: e.repeatKey })}`);
  const codes = e.refusals.map((x) => x.code);
  for (const code of CODES) assert(codes.includes(code), `its refusals include ${code}; got ${show(codes)}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(P.ROUTE.update)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('update-property-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${P.ROUTE.update}; got ${line}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
