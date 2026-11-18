'use strict';
/**
 * graph remove-property — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/18-property-operations.md (AC2, AC4, AC6–AC9)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0018-property-operations.md (Decisions 6, 7.3, 8–14)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/18-property-operations.test-plan.md
 *
 * Stack-free, over test/helpers/propertyGraph.js's seed. Runs, in order, over one state:
 *   A  add-property makes tea house's address, opened and tags, and lamp's wattage and lumens; mark-field marks wattage;
 *   B  add-property puts city and street under address;
 *   R  only refusals, so the graph after R is the graph before it;
 *   C  the removes, the callers, the command and the list.
 *
 *   RM1  a property and everything under it come out of the tree and the schema; the elements that still hold it
 *   RM2  the entry keeps each removed node whole, so a mistake can be undone from it alone
 *   RM3  the same call again: already-gone, naming the entry that records the removal
 *   RM4  a required field leaves its parent's required list
 *   RM5  a field leaves x-tapestry.unique too
 *   RM6  a stray beagle's schema doesn't list: catching up takes it out, and the answer is removed
 *   RM7  each refusal, and the graph as it was after them
 *   RM8  nothing is signed; callers; an admin's remove is the admin's; the command; the list and /docs
 */

const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const P = require('../../helpers/propertyGraph');

const { ROOT, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph remove-property');
const add = P.post('add');
const rem = P.post('remove');
const RULE = 'element-fits-schema';
const CODES = ['unknown-property', 'not-own-concept', 'firmware-concept', 'not-installed', 'no-schema', 'no-primary-property', 'not-wrapped', 'unreadable-schema', 'tangled-tree', 'not-own-node', 'marked-field', 'schema-too-large', 'invalid-fields', 'invalid-input', 'wrong-content-type', 'sign-in-required', 'not-allowed'];

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    P.needDecls(['add-property', 'remove-property']);
    const ctx = await P.prepare('remove-property');
    const { file, made, k, tree } = ctx;
    const TH = made.teaHouse.conceptHeader;
    const LAMP = made.lamp.conceptHeader;
    const a = P.runOn(file, [
      add('address', 'owner', { concept: TH, name: 'address', type: 'object' }),
      add('opened', 'owner', { concept: TH, name: 'opened', type: 'string', required: true }),
      add('tags', 'owner', { concept: TH, name: 'tags', type: 'array', schema: { items: { type: 'string' } } }),
      add('wattage', 'owner', { concept: LAMP, name: 'wattage', type: 'integer' }),
      add('lumens', 'owner', { concept: LAMP, name: 'lumens', type: 'integer' }),
      P.post('mark')('mark', 'owner', { concept: LAMP, field: 'wattage' }),
    ]);
    const key = {};
    for (const id of ['address', 'opened', 'tags', 'wattage', 'lumens']) {
      const x = a.req(id);
      assert(x.status === 200, `the setup's add of ${id} must succeed; got ${x.status} ${show(x.body)}`);
      key[id] = x.body.data.property.property;
    }
    assert(a.req('mark').status === 200, `the setup's mark must succeed; got ${show(a.req('mark').body)}`);
    const b = P.runOn(file, [
      add('city', 'owner', { concept: TH, name: 'city', type: 'string', required: true, parent: key.address }),
      add('street', 'owner', { concept: TH, name: 'street', type: 'string', parent: key.address }),
    ]);
    for (const id of ['city', 'street']) {
      assert(b.req(id).status === 200, `the setup's add of ${id} must succeed; got ${show(b.req(id).body)}`);
      key[id] = b.req(id).body.data.property.property;
    }
    const slugKey = P.treeOf(S.readState(file), TH).find((x) => x.name === 'slug').key;
    const beforeR = S.readState(file);
    const r = P.runOn(file, [
      rem('r-unknown', 'owner', { property: P.NOBODY }),
      rem('r-primary', 'owner', { property: made.teaHouse.nodes.primaryProperty }),
      rem('r-element', 'owner', { property: k.rover }),
      rem('r-marked', 'owner', { property: key.wattage }),
      rem('r-tangled', 'owner', { property: ctx.extra.roof }),
      rem('r-not-own-node', 'owner', { property: ctx.extra.theirName }),
    ]);
    const afterR = S.readState(file);
    const c = P.runOn(file, [
      rem('visitor', 'visitor', { property: key.tags }),
      rem('stranger', 'stranger', { property: key.tags }),
      rem('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ property: key.tags }) }),
      rem('rm-address', 'owner', { property: key.address }),
      rem('rm-again', 'owner', { property: key.address }),
      rem('rm-opened', 'owner', { property: key.opened }),
      rem('rm-slug', 'owner', { property: slugKey }),
      rem('rm-stray', 'owner', { property: tree.retired }),
      rem('admin', 'admin', { property: key.tags }),
      { id: 'list', method: 'GET', url: P.ROUTE.list, caller: 'admin' },
    ], [
      { id: 'cli', argv: ['graph', 'remove-property', '--property', key.lumens] },
      { id: 'cli-refused', argv: ['graph', 'remove-property', '--property', P.NOBODY] },
    ], true);
    return { ctx, r, c, TH, key, slugKey, beforeR, afterR };
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

test('RM1: a property and everything under it come out of the tree and the schema; the report names the elements that still hold it', async () => {
  const { c, key, TH, ctx } = await main();
  const d = ok(c, 'rm-address');
  assert(d.outcome === 'removed' && show(d.removed.map((x) => x.property).sort()) === show([key.address, key.city, key.street].sort()),
    `removed address, city and street; got ${show(d.removed && d.removed.map((x) => x.field))}`);
  assert(d.removed[0].property === key.address && d.removed[0].field === 'address', `the property named comes first; got ${show(d.removed.map((x) => x.field))}`);
  const g = await graph();
  for (const k2 of [key.address, key.city, key.street]) assert(P.node(g, k2) === null, `node ${k2} is gone`);
  const section = P.schemaDoc(g, TH).properties.teaHouse;
  assert(section.properties.address === undefined && !section.required.includes('address'), `the schema no longer has address; got ${show(Object.keys(section.properties))}`);
  const e = d.elements;
  assert(e.stillHold.count === 1 && e.stillHold.elements[0].node === ctx.el.chai, `chai still holds address.city; got ${show(e.stillHold)}`);
  const removedChanges = changesOf(d, 'property-removed');
  assert(removedChanges.length === 3 && removedChanges.every((x) => !x.catchUp && x.concept === TH), `three property-removed changes of its own; got ${show(removedChanges.map((x) => x.field))}`);
});

test('RM2: the entry keeps each removed node whole: labels, properties, tags and relationships', async () => {
  const { c, key, ctx } = await main();
  const d = ok(c, 'rm-address');
  const ch = changesOf(d, 'property-removed').find((x) => x.node === key.address);
  assert(ch && show(ch.path) === show(['address']) && ch.field === 'address', `the address change names it; got ${show(ch && { node: ch.node, path: ch.path })}`);
  const was = ch.was;
  assert(was && Array.isArray(was.labels) && was.labels.includes('Property') && was.properties && was.properties.tapestryKey === key.address && was.properties.name === 'address',
    `the node as it was: labels and properties; got ${show(was && { labels: was.labels, properties: was.properties })}`);
  const tagTypes = (was.tags || []).map((t) => (t.properties || t).type);
  assert(['d', 'name', 'type', 'z', 'json'].every((t) => tagTypes.includes(t)), `its tags; got ${show(tagTypes)}`);
  const rels = was.relationships || [];
  assert(rels.some((rl) => rl.type === 'IS_A_PROPERTY_OF' && rl.to === ctx.made.teaHouse.nodes.primaryProperty)
    && rels.some((rl) => rl.type === 'HAS_ELEMENT' && rl.from === ctx.k.supersets.property), `its relationships: under the primary property, an element of property; got ${show(rels)}`);
});

test('RM3: the same call again changes nothing and answers already-gone, naming the entry that records the removal', async () => {
  const { c } = await main();
  const first = ok(c, 'rm-address');
  const d = ok(c, 'rm-again');
  assert(d.outcome === 'already-gone' && d.change === null && d.removal && d.removal.id === first.change.id && d.removal.operation === 'graph remove-property',
    `already-gone, nothing recorded, its removal's entry named; got ${show(d)}`);
});

test('RM4: a required field leaves its parent\'s required list', async () => {
  const { c, TH, ctx } = await main();
  const d = ok(c, 'rm-opened');
  assert(d.outcome === 'removed', `removed; got ${show(d.outcome)}`);
  const g = await graph();
  assert(!P.schemaDoc(g, TH).properties.teaHouse.required.includes('opened'), 'the section no longer requires opened');
  assert(!P.json(g, ctx.made.teaHouse.nodes.primaryProperty).property.required.includes('opened'), 'nor does the primary property\'s view');
});

test('RM5: a field leaves x-tapestry.unique too; the elements that hold it are reported', async () => {
  const { c, TH } = await main();
  const d = ok(c, 'rm-slug');
  const g = await graph();
  const section = P.schemaDoc(g, TH).properties.teaHouse;
  assert(show(section['x-tapestry'].unique) === show(['name']) && !section.required.includes('slug'), `slug is out of the unique list and the required list; got ${show({ unique: section['x-tapestry'].unique, required: section.required })}`);
  assert(d.elements.stillHold.count === 4, `lapsang, oolong, chai and assam still hold a slug; got ${show(d.elements.stillHold)}`);
});

test('RM6: a stray its schema doesn\'t list: catching up takes it out, and the answer is removed', async () => {
  const { c, ctx } = await main();
  const d = ok(c, 'rm-stray');
  assert(d.outcome === 'removed' && d.removed[0].property === ctx.tree.retired && d.removed[0].field === 'retired' && d.letterOutOfDate === true, `removed, the letter no longer matches; got ${show(d)}`);
  assert(show(d.caughtUp.removed.map((x) => x.field)) === show(['retired']) && d.caughtUp.changed.length === 4, `catching up took it out and rewrote the four old-shape nodes; got ${show(d.caughtUp)}`);
  const ch = changesOf(d, 'property-removed').find((x) => x.node === ctx.tree.retired);
  assert(ch && ch.catchUp === true, `its property-removed change is marked catchUp; got ${show(ch)}`);
  assert(P.node(await graph(), ctx.tree.retired) === null, 'the stray is gone');
});

test('RM7: each refusal, and the graph as it was after them', async () => {
  const { r, beforeR, afterR } = await main();
  for (const [id, status, code] of [
    ['r-unknown', 404, 'unknown-property'], ['r-primary', 404, 'unknown-property'], ['r-element', 404, 'unknown-property'],
    ['r-marked', 409, 'marked-field'], ['r-tangled', 409, 'tangled-tree'], ['r-not-own-node', 409, 'not-own-node'],
  ]) refused(r, id, status, code);
  assert(/unmark-field/.test(r.req('r-marked').body.error), `marked-field names graph unmark-field; got ${show(r.req('r-marked').body.error)}`);
  assert(P.same(P.graphOf(afterR), P.graphOf(beforeR)), 'every refusal left the graph as it was');
});

test('RM8: nothing is signed; callers; an admin\'s remove is the admin\'s; the command; the list and /docs', async () => {
  const { c, key } = await main();
  assert(ok(c, 'rm-address').outcome === 'removed', 'the path under test ran (RM1 removed a property)');
  assert(Array.isArray(c.spy) && c.spy.length === 0, `nothing signs, publishes or reads a key; the spy saw ${show(c.spy)}`);
  assert(c.req('visitor').status === 401 && c.req('stranger').status === 403 && c.req('text').status === 415, `401, 403 and 415; got ${c.req('visitor').status} ${c.req('stranger').status} ${c.req('text').status}`);
  const ad = ok(c, 'admin');
  assert(ad.outcome === 'removed' && show(ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the admin's remove is the admin's; got ${show(ad.change && ad.change.by)}`);
  const cmd = c.cmd('cli');
  assert(cmd.code === 0, `the command exits 0; got ${cmd.code} ${cmd.stdout} ${cmd.stderr}`);
  const body = JSON.parse(cmd.stdout);
  assert(body.data.outcome === 'removed' && body.data.removed[0].property === key.lumens && show(body.data.change.by) === show({ role: 'local', pubkey: null }), `the command removes, recorded as the command's; got ${show(body)}`);
  const rc = c.cmd('cli-refused');
  const rb = JSON.parse(rc.stdout);
  assert(rc.code === 1 && rb.code === 'unknown-property', `the command's refusal is the route's; got ${show(rb)}`);
  const e = ((c.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'remove-property');
  assert(e && e.kind === 'write' && e.access === 'owner-and-admins' && show(e.guards) === show([RULE]) && show(e.repeatKey) === show(['property']),
    `listed: a write, ${RULE}, repeatKey [property]; got ${show(e && { kind: e.kind, guards: e.guards, repeatKey: e.repeatKey })}`);
  const codes = e.refusals.map((x) => x.code);
  for (const code of CODES) assert(codes.includes(code), `its refusals include ${code}; got ${show(codes)}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(P.ROUTE.remove)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('remove-property-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${P.ROUTE.remove}; got ${line}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
