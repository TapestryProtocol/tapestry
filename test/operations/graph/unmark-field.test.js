'use strict';
/**
 * graph unmark-field — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-foundation/5-field-mapping.md (AC4, AC6 over the fake, AC8)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0005-field-mapping.md (Decisions 3, 4, 9, 12, 13)
 *
 * Stack-free, as mark-field's suite is. The seed (test/helpers/fieldGraph.js) starts with marks and their copies in
 * place, as mark-field leaves them: dog's breed (on rover, spot, bella, luna, max and od1), dog's name and pet's name
 * (max, a dog and a pet, carries both), dog's `retired` (a field that has left dog's schema, its node still in the
 * tree), widget's color and cat's color. loner, a node of no concept, carries dog_breed too. Pet's name stays marked
 * throughout: the visitor, the stranger and the text/plain call try it, and are refused.
 *
 *   UF1  the owner unmarks dog's breed: the mark's edge is gone, no current element carries dog_breed, the property
 *        node stays an element of the property concept, a node of no concept keeps its own; cleared and the entry
 *   UF2  the same call again changes nothing, records nothing, and answers already-unmarked with change: null
 *   UF3  unmarking dog's name leaves pet's copy on the node that is both, since names carry the concept's key
 *   UF4  a field that has left the schema but still has its property node is unmarked too
 *   UF5  a field in the schema that was never marked answers already-unmarked; nothing is recorded
 *   UF6  a field that names nothing, or a concept that names nothing, is refused; a concept that isn't a key, 400
 *   UF7  nothing is signed; a visitor 401, a stranger 403, a text/plain body 415, none changing anything; an admin's
 *        unmark is the admin's
 *   UF8  the command unmarks one too, recorded as the command's
 *   UF9  it is listed with no guard, its repeatKey and its refusals, and has its /docs entry
 *   UF10 graph history finds the unmark's entry by the concept's header, the property node and an element
 *   UF11 once breed is unmarked, a Cypher read of dog's elements by dog_breed finds none (AC6, over the fake)
 *   UF12 above 10,000 elements it is refused too-many-elements, naming the count, and nothing changes (Amendment 2.4)
 *   UF13 a marked field that no element carries is unmarked with an entry of field-unmarked alone, no copies-removed
 *        (Amendment 2.5)
 *
 * In this run luna's LMDB entry isn't stored, so its JSON can't be read; UF1 still expects its copy cleared. AC4 says no
 * element of the concept carries the property any more, and unmarking doesn't read JSON (Amendment 2.2 is about the
 * mapping).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const FG = require('../../helpers/fieldGraph');
const G = require('../../helpers/graphFake');

const { ROOT, OWNER, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph unmark-field');

const ROUTE = '/api/tapestry/graph/unmark-field';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/unmark-field.js');
const NOBODY = '00000000-0000-4000-8000-0000000000bb';
const BREED_CARRIERS = ['rover', 'spot', 'bella', 'luna', 'max', 'od1'];

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/unmark-field.js does not exist yet (ADR graph-operations-foundation/0005 Decision 9)');
}
const post = (id, caller, body, extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body, ...extra });
const sameSet = (a, b) => show([...a].sort()) === show([...b].sort());

const SEED = {
  marks: [['dog', 'breed'], ['dog', 'name'], ['pet', 'name'], ['dog', 'retired'], ['widget', 'color'], ['cat', 'color'], ['dog', 'checks']],
  copies: {
    rover: { dog_breed: 'goldenRetriever', dog_name: 'Rover', dog_retired: true },
    spot: { dog_breed: 'irishSetter', dog_name: 'Spot' },
    bella: { dog_breed: 'goldenRetriever', dog_name: 'Bella' },
    luna: { dog_breed: 'irishSetter' },
    max: { dog_breed: 'irishSetter', dog_name: 'Max', pet_name: 'Maxie' },
    od1: { dog_breed: 'irishSetter', dog_name: 'Odie' },
    p1: { pet_name: 'Polly' },
    w1: { widget_color: 'red' },
    w2: { widget_color: 'blue' },
    c1: { cat_color: 'black' },
  },
};

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  const dir = tmp('unmark-field-');
  const seed = FG.seedFields(SEED);
  const file = seed.file(dir);
  const k = seed.keys;
  const r = S.runHarness({
    spy: true,
    scenarios: [{
      graphFake: { stateFile: file },
      requests: [
        post('visitor', 'visitor', { concept: k.pet, field: 'name' }),
        post('stranger', 'stranger', { concept: k.pet, field: 'name' }),
        post('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ concept: k.pet, field: 'name' }) }),
        post('uf1', 'owner', { concept: k.dog, field: 'breed' }),
        { id: 'h-concept', method: 'GET', url: `/api/tapestry/graph/history?node=${k.dog}&limit=5`, caller: 'owner' },
        { id: 'h-property', method: 'GET', url: `/api/tapestry/graph/history?node=${k.dogProp.breed}&limit=5`, caller: 'owner' },
        { id: 'h-element', method: 'GET', url: `/api/tapestry/graph/history?node=${k.rover}&limit=5`, caller: 'owner' },
        post('uf2', 'owner', { concept: k.dog, field: 'breed' }),
        post('shared', 'owner', { concept: k.dog, field: 'name' }),
        post('left-schema', 'owner', { concept: k.dog, field: 'retired' }),
        post('never', 'owner', { concept: k.dog, field: 'weight' }),
        post('no-copies', 'owner', { concept: k.dog, field: 'checks' }),
        post('unknown-field', 'owner', { concept: k.dog, field: 'nothing' }),
        post('unknown-concept', 'owner', { concept: NOBODY, field: 'breed' }),
        post('not-a-key', 'owner', { concept: 'dog', field: 'breed' }),
        post('admin', 'admin', { concept: k.widget, field: 'color' }),
        { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
      ],
      cli: [{ id: 'cli', argv: ['graph', 'unmark-field', '--concept', k.cat, '--field', 'color'] }],
    }],
  }, { dir });
  MAIN = { r, a: S.answered(r), file, k };
  return MAIN;
}
const graph = () => S.readState(main().file);
function ok(id) {
  needDecl();
  const x = main().a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body)}`);
  return x.body.data;
}
const changeOf = (d, name) => ((d && d.change && d.change.changes) || []).find((c) => c.change === name);

test('UF1: the owner unmarks dog\'s breed: the mark is gone, no current element carries dog_breed, the property node stays a property', () => {
  const { k } = main();
  const d = ok('uf1');
  assert(d.outcome === 'unmarked', `outcome unmarked; got ${show(d)}`);
  assert(d.mark && d.mark.concept === k.dog && d.mark.field === 'breed' && d.mark.property === 'dog_breed' && d.mark.node === k.dogProp.breed, `the answer gives the mark it took out; got ${show(d.mark)}`);
  const g = graph();
  assert(FG.edges(g, k.set1, 'HAS_ELEMENT', k.dogProp.breed) === 0, 'the first set\'s edge to breed\'s node is gone');
  assert(FG.edges(g, k.propertySuperset, 'HAS_ELEMENT', k.dogProp.breed) === 1, 'the property concept\'s edge to it is untouched: it stays a property (D9)');
  for (const name of BREED_CARRIERS) assert(!('dog_breed' in FG.copiesOn(g, k[name], 'dog_')), `${name} no longer carries dog_breed${name === 'luna' ? ' (its JSON can\'t be read in this run, and unmarking clears it all the same: AC4)' : ''}`);
  assert(changeOf(d, 'copies-removed') && d.change.changes.length === 2 && !JSON.stringify(d.change.changes).includes('"dog_name"'), `it removed dog_breed only, not another mark's copies (later calls unmark dog's name; this entry names only breed); got ${show(d.change && d.change.changes)}`);
  assert(FG.copiesOn(g, k.max, 'pet_').pet_name === 'Maxie', 'max keeps pet_name, a copy of another concept\'s mark');
  assert(FG.copiesOn(g, k.loner, 'dog_').dog_breed === 'goldenRetriever', 'a node that is no element of dog keeps its own dog_breed: only current elements are cleared');
  assert(d.cleared === 6, `cleared: the six nodes that carried it; got ${show(d.cleared)}`);
  const c = d.change;
  assert(c && show(c.by) === show({ role: 'owner', pubkey: OWNER }) && c.operation === 'graph unmark-field', `the entry is the owner's, through graph unmark-field; got ${show(c)}`);
  const fu = changeOf(d, 'field-unmarked');
  assert(fu && fu.node === k.dogProp.breed && fu.concept === k.dog && fu.field === 'breed' && fu.property === 'dog_breed', `a field-unmarked change names the node, the concept, the field and the property; got ${show(c.changes)}`);
  const cr = changeOf(d, 'copies-removed');
  const carriers = BREED_CARRIERS.map((n) => k[n]);
  assert(cr && cr.property === 'dog_breed' && sameSet(cr.nodes, carriers) && cr.count === 6, `a copies-removed change names the property and the six nodes, with their count; got ${show(cr)}`);
  const kept = S.entriesOf(g).filter((e) => e.tapestryKey === c.id);
  assert(kept.length === 1 && sameSet(kept[0].keys, [k.dogProp.breed, k.dog, ...carriers]), `the entry is kept, keyed by the property node, the concept and the cleared nodes; got ${show(kept)}`);
});

test('UF2: the same call again changes nothing, records nothing, and answers already-unmarked with change: null', () => {
  const d = ok('uf2');
  assert(d.outcome === 'already-unmarked' && d.change === null, `already-unmarked, change null; got ${show(d)}`);
  const forBreed = S.entriesOf(graph()).filter((e) => e.operation === 'graph unmark-field' && JSON.stringify(e.changes).includes('"dog_breed"'));
  assert(forBreed.length === 1, `one entry for unmarking breed, not two; got ${forBreed.length}`);
});

test('UF3: unmarking dog\'s name leaves pet\'s copy on the node that is both a dog and a pet', () => {
  const { k } = main();
  const d = ok('shared');
  assert(d.outcome === 'unmarked', `outcome unmarked; got ${show(d)}`);
  const g = graph();
  assert(!('dog_name' in FG.copiesOn(g, k.max, 'dog_')) && !('dog_name' in FG.copiesOn(g, k.rover, 'dog_')), 'max and rover no longer carry dog_name');
  assert(FG.copiesOn(g, k.max, 'pet_').pet_name === 'Maxie', 'max keeps pet_name: no other concept\'s copy has dog\'s name (Decision 4)');
  assert(FG.edges(g, k.set1, 'HAS_ELEMENT', k.petProp.name) === 1, 'pet\'s name is still marked');
});

test('UF4: a field that has left the schema but still has its property node is unmarked, its copies removed', () => {
  const { k } = main();
  const d = ok('left-schema');
  assert(d.outcome === 'unmarked' && d.mark && d.mark.node === k.dogProp.retired, `retired, no longer in dog's schema, is unmarked by its node; got ${show(d)}`);
  const g = graph();
  assert(FG.edges(g, k.set1, 'HAS_ELEMENT', k.dogProp.retired) === 0 && !('dog_retired' in FG.copiesOn(g, k.rover, 'dog_')), 'its mark and rover\'s copy are gone');
});

test('UF5: a field in the schema that was never marked answers already-unmarked, and nothing is recorded', () => {
  const d = ok('never');
  assert(d.outcome === 'already-unmarked' && d.change === null, `weight: already-unmarked, change null; got ${show(d)}`);
  assert(!S.entriesOf(graph()).some((e) => JSON.stringify(e.changes).includes('dog_weight')), 'no entry names dog_weight');
});

test('UF6: a field or a concept that names nothing is refused, as mark-field refuses it; a concept that isn\'t a key is invalid', () => {
  needDecl();
  const { a, k } = main();
  const f = a.req('unknown-field');
  assert(f.status === 404 && f.body.code === 'unknown-field', `a field neither in the schema nor with a property node: 404 unknown-field; got ${f.status} ${show(f.body)}`);
  const c = a.req('unknown-concept');
  assert(c.status === 404 && c.body.code === 'unknown-concept' && String(c.body.error).includes(NOBODY), `a concept that names nothing: 404 unknown-concept, naming the key; got ${c.status} ${show(c.body)}`);
  const i = a.req('not-a-key');
  assert(i.status === 400 && i.body.code === 'invalid-input' && i.body.input === 'concept', `a concept that isn't a tapestryKey: 400 invalid-input; got ${i.status} ${show(i.body)}`);
  void k;
});

test('UF7: nothing is signed; a visitor 401, a stranger 403, a text/plain body 415, none changing anything; an admin\'s is the admin\'s', () => {
  needDecl();
  const { a } = main();
  assert(ok('uf1').outcome === 'unmarked', 'the path under test ran (UF1 unmarked a field)');
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key; the spy saw: ${show(a.spy)}`);
  assert(a.req('visitor').status === 401 && a.req('stranger').status === 403, `a visitor 401, a stranger 403; got ${a.req('visitor').status}, ${a.req('stranger').status}`);
  const t = a.req('text');
  assert(t.status === 415 && t.body.code === 'wrong-content-type', `a text/plain body: 415; got ${t.status} ${show(t.body)}`);
  const g = graph();
  assert(FG.edges(g, main().k.set1, 'HAS_ELEMENT', main().k.petProp.name) === 1 && FG.copiesOn(g, main().k.p1, 'pet_').pet_name === 'Polly', 'pet\'s name is still marked, and p1 still carries pet_name: none of the three changed anything');
  const ad = ok('admin');
  assert(ad.outcome === 'unmarked' && show(ad.change && ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the admin's unmark is the admin's; got ${show(ad)}`);
});

test('UF8: the command unmarks one too, recorded as the command\'s', () => {
  needDecl();
  const { a, k } = main();
  const c = a.cmd('cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.data.outcome === 'unmarked' && show(body.data.change.by) === show({ role: 'local', pubkey: null }), `cat's color unmarked, recorded as the command's; got ${show(body)}`);
  const g = graph();
  assert(FG.edges(g, k.set1, 'HAS_ELEMENT', k.catProp.color) === 0 && !('cat_color' in FG.copiesOn(g, k.c1, 'cat_')), 'cat\'s color mark and c1\'s copy are gone');
});

test('UF9: it is listed with no guard, its repeatKey and its refusals, and has its /docs entry', () => {
  needDecl();
  const list = main().a.req('list');
  const e = ((list.body.data && list.body.data.operations) || []).find((o) => o.group === 'graph' && o.name === 'unmark-field');
  assert(e, `graph unmark-field is listed; problems: ${show(list.body.data && list.body.data.problems)}`);
  assert(e.kind === 'write' && e.access === 'owner-and-admins', `a write for the owner and admins; got ${show(e)}`);
  assert(show(e.guards) === '[]' && show(e.repeatKey) === show(['concept', 'field']), `no guard (unmarking breaks no rule), repeatKey [concept, field]; got ${show({ guards: e.guards, repeatKey: e.repeatKey })}`);
  const codes = e.refusals.map((x) => `${x.code}:${x.status}`);
  for (const c of ['unknown-concept:404', 'unknown-field:404', 'too-many-elements:409', 'wrong-content-type:415', 'sign-in-required:401', 'not-allowed:403']) assert(codes.includes(c), `its refusals include ${c}; got ${show(codes)}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('unmark-field-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line}`);
});

test('UF10: graph history finds the unmark\'s entry by the concept\'s header, the property node and an element', () => {
  const { a } = main();
  const id = ok('uf1').change.id;
  for (const h of ['h-concept', 'h-property', 'h-element']) {
    const x = a.req(h);
    assert(x.status === 200 && x.body.data.entries.length && x.body.data.entries[0].id === id, `${h}: the unmark's entry; got ${x.status} ${show(x.body).slice(0, 300)}`);
  }
});

test('UF11: once breed is unmarked, a Cypher read of dog\'s elements by dog_breed finds neither breed (AC6, over the fake graph)', () => {
  const { k } = main();
  assert(ok('uf1').outcome === 'unmarked', 'breed was unmarked');
  for (const breed of ['goldenRetriever', 'irishSetter']) {
    const rows = G.exec(graph(), `MATCH (h:TapestryNode {tapestryKey: $dog})-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*0..]->()-[:HAS_ELEMENT]->(d)
      WHERE d.dog_breed = $breed RETURN DISTINCT d.tapestryKey AS key`, { dog: k.dog, breed }).rows;
    assert(rows.length === 0, `no dog is found by dog_breed = ${breed}; got ${show(rows)}`);
  }
});

test('UF12: above 10,000 elements it is refused too-many-elements, naming the count, and nothing changes (Amendment 2.4)', () => {
  needDecl();
  const dir = tmp('unmark-field-big-');
  const seed = FG.seedFields({ bigCount: 10001, marks: [['big', 'label']], bigCopied: true });
  const file = seed.file(dir);
  const k = seed.keys;
  const a = S.answered(S.runHarness({ scenarios: [{ graphFake: { stateFile: file }, requests: [post('x', 'owner', { concept: k.big, field: 'label' })] }] }, { dir }));
  const x = a.req('x');
  assert(x.status === 409 && x.body.code === 'too-many-elements' && /10,?00[01]/.test(String(x.body.error)), `10,001 elements: 409 too-many-elements, naming the count; got ${x.status} ${show(x.body).slice(0, 300)}`);
  const g = S.readState(file);
  assert(FG.edges(g, k.set1, 'HAS_ELEMENT', k.bigProp.label) === 1, 'the mark is still there');
  assert(k.bigElements.every((key) => FG.nodeOf(g, key).props.big_label !== undefined), 'every element still carries big_label');
  assert(S.entriesOf(g).length === 0, 'no entry was recorded');
});

test('UF13: a marked field no element carries is unmarked with an entry of field-unmarked alone, no copies-removed (Amendment 2.5)', () => {
  const { k } = main();
  const d = ok('no-copies');
  assert(d.outcome === 'unmarked' && d.cleared === 0, `dog's checks, marked but carried by no element: unmarked, cleared 0; got ${show(d)}`);
  const changes = (d.change && d.change.changes) || [];
  assert(changes.length === 1 && changes[0].change === 'field-unmarked' && changes[0].node === k.dogProp.checks, `the entry holds field-unmarked alone, no copies-removed; got ${show(changes)}`);
  assert(FG.edges(graph(), k.set1, 'HAS_ELEMENT', k.dogProp.checks) === 0, 'the mark is gone');
  assert(S.entriesOf(graph()).some((e) => e.tapestryKey === d.change.id), 'and its entry is kept');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
