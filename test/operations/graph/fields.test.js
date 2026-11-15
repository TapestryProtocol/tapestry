'use strict';
/**
 * The mapping's module, src/operations/catalog/graph/_fields.js — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-foundation/5-field-mapping.md ("How this meets 'whenever the
 *          element is written'": the mapping is one function, which later element writes call)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0005-field-mapping.md (Decisions 4, 6, 10 and 11)
 *
 * Stack-free. The module is required in a child process with the TA set, and called over graphs
 * test/helpers/fieldGraph.js seeds: its reads through graphFake's readerOver, mapNodes inside graphFake's
 * writeTransaction. Only what the ADR pins is checked: the names of its exports, what each answers, and the values
 * table; how it gets there is the Implementer's.
 *
 *   FD1 loading it opens nothing: no Neo4j driver, LMDB, store or Redis module
 *   FD2 propertyName(oKey, field) is <key>_<field>
 *   FD3 MAX_ELEMENTS is 10,000
 *   FD4 valueOf(json, concept, field) follows the values table: { value } for a plain value or a list of one type, an
 *       integer as an integer only where the schema says integer and it is safe, and a list under integer items as
 *       integers only when every item is one (Amendment 2.6); { none: true } for an empty list, a null or nothing;
 *       { bad } for no section, a missing LMDB entry (null JSON), an object, a list holding an object or a null, a mixed
 *       list; a value that doesn't match the schema's type as the JSON holds it
 *   FD5 conceptOf(read, key) answers { key, uuid, name, oKey, fields, wrapped } for a concept header, an imported
 *       one included, and null for anything else
 *   FD6 propertyNodeOf finds the field's node under the section node (or on the primary property when wrapped), and
 *       nothing for create-property's node, a child a level down, the word section's child, or no primary property
 *   FD7 marksOf answers every mark as { concept, oKey, field, property, node }, one concept's when asked; a mark whose
 *       node isn't under its concept's section node doesn't count
 *   FD8 mapNodes(tx, keys) brings each given node in line with the marks of every concept it is an element of, and
 *       touches nothing else: not the concepts' other elements, not a node of no marked concept; it writes no change
 *       entry, and returns what it changed for the calling write's own entry (Amendment 2.7)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const FG = require('../../helpers/fieldGraph');

const { ROOT, TA, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: the mapping module (_fields.js)');

const FIELDS = path.join(ROOT, 'src/operations/catalog/graph/_fields.js');
const NOBODY = '00000000-0000-4000-8000-0000000000ee';
const missing = () => new Error('src/operations/catalog/graph/_fields.js does not exist yet (ADR graph-operations-foundation/0005 Decision 6)');

/** The values table's rows: [label, json, field]. */
const ROWS = [
  ['string', { dog: { breed: 'goldenRetriever' } }, 'breed'],
  ['true', { dog: { vaccinated: true } }, 'vaccinated'],
  ['false', { dog: { vaccinated: false } }, 'vaccinated'],
  ['integer', { dog: { age: 3 } }, 'age'],
  ['fraction under integer', { dog: { age: 2.5 } }, 'age'],
  ['unsafe integer', { dog: { age: 9007199254740993 } }, 'age'],
  ['whole number under number', { dog: { weight: 30 } }, 'weight'],
  ['strings', { dog: { nicknames: ['Ro', 'Rov'] } }, 'nicknames'],
  ['integers', { dog: { scores: [1, 2, 3] } }, 'scores'],
  ['integers among fractions', { dog: { scores: [1.5, 2] } }, 'scores'],
  ['booleans', { dog: { checks: [true, false] } }, 'checks'],
  ['empty list', { dog: { scores: [] } }, 'scores'],
  ['null', { dog: { color: null } }, 'color'],
  ['nothing', { dog: { name: 'Fido' } }, 'breed'],
  ['no section', { name: 'Flat', breed: 'goldenRetriever' }, 'breed'],
  ['null json', null, 'breed'],
  ['object', { dog: { breed: { name: 'mutt' } } }, 'breed'],
  ['list holding an object', { dog: { nicknames: [{ kind: 'pup' }] } }, 'nicknames'],
  ['list holding a null', { dog: { nicknames: ['Fi', null] } }, 'nicknames'],
  ['mixed list', { dog: { nicknames: ['Bee', 3] } }, 'nicknames'],
  ['string in an integer field', { dog: { age: 'three' } }, 'age'],
  ['nullable string', { dog: { color: 'brown' } }, 'color'],
];

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  const dir = tmp('fields-');
  const mapSeed = FG.seedFields({ marks: [['dog', 'breed'], ['pet', 'name'], ['widget', 'color']] });
  const mapFile = mapSeed.file(dir);
  const script = path.join(dir, 'child.js');
  // The answer goes to a file: written to a pipe and followed by process.exit, a long one would be cut short.
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(script, `'use strict';
const ROOT = ${JSON.stringify(ROOT)};
const out = {};
const tagged = (x) => (x && typeof x === 'object' && typeof x.toNumber === 'function' && typeof x.low === 'number' ? { $int: x.toString() } : Array.isArray(x) ? x.map(tagged) : x);
const plain = (r) => (r && typeof r === 'object' ? Object.fromEntries(Object.entries(r).map(([k, v]) => [k, tagged(v)])) : r);
(async () => {
  try {
    const before = new Set(Object.keys(require.cache));
    if (!require('fs').existsSync(${JSON.stringify(FIELDS)})) { out.missing = true; throw new Error('missing'); }
    const F = require(${JSON.stringify(FIELDS)});
    out.heavy = Object.keys(require.cache).filter((k) => !before.has(k) && /neo4j-driver|[\\\\/]lmdb[\\\\/]|tapestry-store|ioredis|connect-redis/.test(k));
    out.exports = Object.keys(F);
    out.max = F.MAX_ELEMENTS;
    out.names = typeof F.propertyName === 'function' ? [F.propertyName('dog', 'breed'), F.propertyName('widget', 'color'), F.propertyName('dog', 'owner_name')] : null;
    const { readerOver, fakeGraph } = require(ROOT + '/test/helpers/graphFake.js');
    const FG = require(ROOT + '/test/helpers/fieldGraph.js');
    const seed = FG.seedFields({ marks: [['dog', 'breed'], ['widget', 'color'], ['otherDog', 'name']], markNodes: ['dogWordTypes'] });
    const read = readerOver(seed.state);
    const k = seed.keys;
    out.keys = k;
    const dog = await F.conceptOf(read, k.dog);
    out.concepts = {};
    for (const [name, key] of [['dog', k.dog], ['widget', k.widget], ['cat', k.cat], ['rover', k.rover], ['nobody', ${JSON.stringify(NOBODY)}]]) out.concepts[name] = await F.conceptOf(read, key);
    out.values = {};
    for (const [label, json, field] of ${JSON.stringify(ROWS)}) {
      try { out.values[label] = plain(await F.valueOf(json, dog, field)); } catch (e) { out.values[label] = { threw: String(e.message) }; }
    }
    out.nodes = {};
    for (const [label, cname, field] of [['dog breed', 'dog', 'breed'], ['dog name', 'dog', 'name'], ['dog nickname', 'dog', 'nickname'], ['dog wordTypes', 'dog', 'wordTypes'], ['widget color', 'widget', 'color'], ['rock hardness', 'rock', 'hardness']]) {
      const c = await F.conceptOf(read, k[cname]);
      out.nodes[label] = c ? await F.propertyNodeOf(read, c, field) : 'no concept';
    }
    out.marksAll = await F.marksOf(read, {});
    out.marksDog = await F.marksOf(read, { concept: k.dog });
    const fake = fakeGraph(${JSON.stringify(mapFile)});
    const mk = ${JSON.stringify(mapSeed.keys)};
    const returned = await fake.writeTransaction((tx) => F.mapNodes(tx, [mk.rover, mk.max, mk.w1, mk.r1]));
    out.mapped = true;
    out.mapReturned = returned === undefined ? null : JSON.parse(JSON.stringify(tagged(returned)));
  } catch (e) { if (!out.missing) out.error = String((e && e.stack) || e); }
  require('fs').writeFileSync(${JSON.stringify(outFile)}, JSON.stringify(out));
  process.exit(0);
})();
`);
  const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  const answered = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : null;
  MAIN = { out: answered || { error: `no result: ${(child.stderr || '').slice(-600)}` }, mapFile, mapKeys: mapSeed.keys };
  return MAIN;
}
function result() {
  const { out } = main();
  if (out.missing) throw missing();
  assert(!out.error, `the module's child failed: ${String(out.error).split('\n').slice(0, 4).join(' | ')}`);
  return out;
}
const num = (v) => (v && typeof v === 'object' && typeof v.$int === 'string' ? Number(v.$int) : v);
const isInt = (v) => !!v && typeof v === 'object' && typeof v.$int === 'string';
const fieldNames = (fields) => (Array.isArray(fields) ? fields.map((f) => (typeof f === 'string' ? f : f && f.name)) : fields && typeof fields === 'object' ? Object.keys(fields) : []);

test('FD1: loading _fields.js opens nothing: no Neo4j driver, LMDB, store or Redis module is required', () => {
  const out = result();
  assert(Array.isArray(out.heavy) && out.heavy.length === 0, `it opens nothing when it loads, as _nodes.js (Decision 6); these were required: ${show((out.heavy || []).map((f) => path.relative(ROOT, f)))}`);
  for (const name of ['conceptOf', 'propertyNodeOf', 'marksOf', 'elementsOf', 'valueOf', 'propertyName', 'writeCopies', 'mapConcept', 'mapNodes', 'MAX_ELEMENTS']) {
    assert(out.exports.includes(name), `it exports ${name} (Decision 6's contract); its exports: ${show(out.exports)}`);
  }
});

test('FD2: propertyName(oKey, field) is <key>_<field>', () => {
  const out = result();
  assert(show(out.names) === show(['dog_breed', 'widget_color', 'dog_owner_name']), `dog_breed, widget_color, dog_owner_name; got ${show(out.names)}`);
});

test('FD3: MAX_ELEMENTS is 10,000', () => {
  assert(result().max === 10000, `MAX_ELEMENTS (Decision 11); got ${show(result().max)}`);
});

test('FD4: valueOf follows the values table', () => {
  const v = result().values;
  const value = (label) => { const r = v[label]; assert(r && 'value' in r && !r.none && !r.bad, `${label}: { value }; got ${show(r)}`); return r.value; };
  const none = (label) => assert(v[label] && v[label].none === true && !('value' in v[label]), `${label}: { none: true }, so an existing copy is removed; got ${show(v[label])}`);
  const bad = (label) => assert(v[label] && typeof v[label].bad === 'string' && v[label].bad.trim() && !('value' in v[label]), `${label}: { bad: reason }, so the element is skipped; got ${show(v[label])}`);
  assert(value('string') === 'goldenRetriever' && value('true') === true && value('false') === false, 'a string and booleans, false included, are values');
  assert(num(value('integer')) === 3, `an integer under an integer schema is 3, sent as neo4j.int (by valueOf or after it); got ${show(v.integer)}`);
  for (const [label, n] of [['fraction under integer', 2.5], ['unsafe integer', 9007199254740992], ['whole number under number', 30]]) {
    const x = value(label);
    assert(!isInt(x) && x === n, `${label}: the number ${n}, as a float, never a neo4j.int; got ${show(v[label])}`);
  }
  assert(show(value('strings')) === show(['Ro', 'Rov']) && show(value('booleans')) === show([true, false]), 'lists of strings and of booleans are values');
  assert(show(value('integers').map(num)) === show([1, 2, 3]), `a list of integers is a value, item by item; got ${show(v.integers)}`);
  const mixed = value('integers among fractions');
  assert(Array.isArray(mixed) && show(mixed) === show([1.5, 2]) && !mixed.some(isInt), `[1.5, 2] under integer items: every item a float, one type, never an integer among floats (Amendment 2.6); got ${show(v['integers among fractions'])}`);
  for (const label of ['empty list', 'null', 'nothing']) none(label);
  for (const label of ['no section', 'null json', 'object', 'list holding an object', 'list holding a null', 'mixed list']) bad(label);
  assert(value('string in an integer field') === 'three', 'a plain value is copied as the JSON holds it, though it doesn\'t match the schema\'s type');
  assert(value('nullable string') === 'brown', 'a field whose type list adds null holds a string');
});

test('FD5: conceptOf answers { key, uuid, name, oKey, fields, wrapped } for a concept header, an imported one too, and null otherwise', () => {
  const { concepts: c, keys: k } = result();
  const dog = c.dog;
  assert(dog && dog.key === k.dog && dog.uuid === `39998:${TA}:dog` && dog.name === 'dog' && dog.oKey === 'dog', `dog: its key, uuid, name and oKey; got ${show(dog)}`);
  assert(dog.wrapped === false, `dog's schema has two top-level keys, word and dog: not wrapped; got ${show(dog.wrapped)}`);
  const names = fieldNames(dog.fields);
  assert(['slug', 'name', 'breed', 'age', 'owner'].every((f) => names.includes(f)) && !names.includes('wordTypes') && !names.includes('word'), `dog's fields are the ones under its dog section; got ${show(dog.fields)}`);
  assert(c.widget && c.widget.wrapped === true && c.widget.oKey === 'widget', `widget's schema has one top-level key, its oKey: wrapped; got ${show(c.widget)}`);
  assert(c.cat && c.cat.key === k.cat && c.cat.oKey === 'cat', `cat, labelled ListHeader only, is a concept too; got ${show(c.cat)}`);
  assert(c.rover == null && c.nobody == null, `an element's key and a key nothing has give null; got ${show([c.rover, c.nobody])}`);
});

test('FD6: propertyNodeOf finds the field\'s node under the section node, or on the primary property when wrapped, and nothing else', () => {
  const { nodes: n, keys: k } = result();
  assert(n['dog breed'] === k.dogProp.breed, `dog's breed: the tree's node, not create-property's off the schema node; got ${show(n['dog breed'])}`);
  assert(n['dog name'] === k.dogProp.name, `dog's name: the dog section's child, not owner's child; got ${show(n['dog name'])}`);
  assert(n['widget color'] === k.widgetProp.color, `widget's color hangs on the primary property; got ${show(n['widget color'])}`);
  for (const label of ['dog nickname', 'dog wordTypes', 'rock hardness']) assert(n[label] == null, `${label}: none (null); got ${show(n[label])}`);
});

test('FD7: marksOf answers every mark as { concept, oKey, field, property, node }, and one concept\'s when asked', () => {
  const { marksAll, marksDog, keys: k } = result();
  const want = [
    { concept: k.dog, oKey: 'dog', field: 'breed', property: 'dog_breed', node: k.dogProp.breed },
    { concept: k.widget, oKey: 'widget', field: 'color', property: 'widget_color', node: k.widgetProp.color },
    { concept: k.otherDog, oKey: 'dog', field: 'name', property: 'dog_name', node: k.otherDogProp.name },
  ];
  const pick = (m) => ({ concept: m.concept, oKey: m.oKey, field: m.field, property: m.property, node: m.node });
  const sorted = (xs) => show(xs.map(pick).sort((a, b) => (a.node < b.node ? -1 : 1)));
  assert(sorted(marksAll) === sorted(want), `the three marks, each found back to its concept; got ${show(marksAll)}`);
  assert(!marksAll.some((m) => m.node === k.dogWordTypes), 'the mark on the word section\'s child doesn\'t count: its parent isn\'t dog\'s section node');
  assert(sorted(marksDog) === sorted([want[0]]), `asked for dog's, only dog's; got ${show(marksDog)}`);
});

test('FD8: mapNodes brings each given node in line with its concepts\' marks, touches nothing else, and records no entry', () => {
  const out = result();
  assert(out.mapped, 'mapNodes ran');
  const g = S.readState(main().mapFile);
  const k = main().mapKeys;
  assert(FG.copiesOn(g, k.rover, 'dog_').dog_breed === 'goldenRetriever', 'rover, a dog, carries dog_breed');
  assert(FG.copiesOn(g, k.max, 'dog_').dog_breed === 'irishSetter' && FG.copiesOn(g, k.max, 'pet_').pet_name === 'Maxie', 'max, a dog and a pet, carries both concepts\' copies');
  assert(FG.copiesOn(g, k.w1, 'widget_').widget_color === 'red', 'w1, a widget, carries widget_color');
  assert(!Object.keys(FG.nodeOf(g, k.r1).props).some((p) => p.startsWith('rock_')), 'r1, a rock (no mark), carries nothing new');
  for (const [name, prefix] of [['spot', 'dog_'], ['bella', 'dog_'], ['w2', 'widget_'], ['p1', 'pet_']]) {
    assert(!Object.keys(FG.copiesOn(g, k[name], prefix)).length, `${name}, not given, is left alone`);
  }
  assert(S.entriesOf(g).length === 0, 'it writes copies only: the write that calls it records the entry');
  // Amendment 2.7: it returns what it changed, for the calling write's own entry. Its shape is the Implementer's; it must
  // name each node it changed and each property it set.
  const text = JSON.stringify(out.mapReturned);
  assert(out.mapReturned !== null && text.length > 2, `mapNodes returns what it changed; got ${show(out.mapReturned)}`);
  for (const [what, s] of [['rover', k.rover], ['max', k.max], ['w1', k.w1], ['dog_breed', 'dog_breed'], ['pet_name', 'pet_name'], ['widget_color', 'widget_color']]) {
    assert(text.includes(s), `what it returns names ${what}; got ${text.slice(0, 400)}`);
  }
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
