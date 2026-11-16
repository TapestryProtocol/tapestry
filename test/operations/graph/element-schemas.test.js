'use strict';
/**
 * _schemas.js, the one check of an element against its concept's JSON Schema — its own suite, run by
 * test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/20-create-element.md (AC3, AC7)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0020-create-element.md (Decision 11; Implementation
 *          notes E1–E4)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/20-create-element.test-plan.md
 *
 * Stack-free. Every call runs in one child process with the TA set, over the graph test/helpers/createElementGraph.js
 * seeds (through graphFake's readerOver), and an LMDB store under the child's directory holding one schema. The child
 * adds three concepts first, each a header and a schema node: bare (its schema node's JSON is the schema itself, with
 * no jsonSchema section), held (its JSON is an LMDB reference to the stored schema), and two whose schema can't be
 * used: jsonless (a schema node with no json tag) and listy (JSON that is a list).
 *
 *   SC1 schemaOf reads the jsonSchema section, else the object itself, and drops $schema; it resolves an LMDB reference
 *   SC2 schemaOf says why there is no schema: none, more than one, no json tag, JSON that doesn't parse, an LMDB entry
 *       that is missing, something other than an object
 *   SC3 problemsOf names each problem by its dotted path, in words: required, a field the schema doesn't take, a value
 *       not allowed, the wrong type, any other keyword in ajv's words; "the element's JSON" at the top; every problem
 *   SC4 a schema that doesn't compile is a problem, not a throw; two schemas with one $id both check
 *   SC5 the dialect is the derive step's reading of a schema: for each schema and JSON, problemsOf's verdict is the
 *       one ajv gives the JSON under src/lib/derivers/word.js:136–180's reading, 2020-12's own keywords ignored as
 *       it ignores them. It compares the reading of a schema, not the document the derive step checks (SC9)
 *   SC6 fits gives true, false (with the problems) or null (with why) for a concept and JSON
 *   SC7 loading _schemas.js opens nothing: no ajv, LMDB, Neo4j driver or store until first called
 *   SC8 the fake graph runs E1–E4 as the ADR writes them, answering as Neo4j would
 *   SC9 (review round 1, ADR 0020 Amendment 1, item 1) the real derive step beside this check, its database, store
 *       and resolver stubbed: they agree under create-concept's schema and firmware dog's, and split as Amendment 1
 *       says under firmware word's schema, which requires the derive step's graphContext, and under a schema that
 *       forbids extra top-level keys
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const FG = require('../../helpers/fieldGraph');

const { ROOT, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: _schemas.js, the check of an element against its schema');

const SCHEMAS = path.join(ROOT, 'src/operations/catalog/graph/_schemas.js');
const HELD_KEY = crypto.createHash('sha256').update('the schema an LMDB entry holds').digest('hex');
const HELD_SCHEMA = { word: { slug: 'json-schema-for-the-concept-of-held-things' }, jsonSchema: { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', required: ['held'], properties: { held: { type: 'object' } } } };

function needSchemas() {
  if (!fs.existsSync(SCHEMAS)) throw new Error('src/operations/catalog/graph/_schemas.js does not exist yet (ADR graph-operations-first-slice/0020 Decision 11)');
}

/** The derive step's reading of a schema (src/lib/derivers/word.js:136–180): the jsonSchema section, $schema dropped, ajv's defaults with strict off. SC9 runs the derive step itself. */
const DERIVE = `(schemaObj, json) => {
  if (schemaObj.jsonSchema && typeof schemaObj.jsonSchema === 'object') schemaObj = schemaObj.jsonSchema;
  const { $schema, ...schemaNoMeta } = schemaObj;
  const Ajv = require(require.resolve('ajv', { paths: [ROOT] }));
  const ajv = new Ajv({ allErrors: true, strict: false });
  try { const v = ajv.compile(schemaNoMeta); return v(json); } catch (e) { return 'throws'; }
}`;

const DIALECT = [
  ['firmware dog, a golden retriever in its set', 'dog', { word: { wordTypes: ['word', 'dog', 'goldenRetriever'] }, dog: { name: 'Rover', slug: 'rover', breed: 'goldenRetriever' } }],
  ['firmware dog, a golden retriever outside it', 'dog', { word: { wordTypes: ['word', 'dog'] }, dog: { name: 'Fido', slug: 'fido', breed: 'goldenRetriever' } }],
  ['prefixItems, 2020-12 only', { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', properties: { pair: { type: 'array', prefixItems: [{ type: 'string' }] } } }, { pair: [5] }],
  ['dependentRequired, 2019-09 on', { type: 'object', dependentRequired: { a: ['b'] } }, { a: 1 }],
  ['unevaluatedProperties, 2019-09 on', { type: 'object', properties: { a: {} }, unevaluatedProperties: false }, { a: 1, z: 2 }],
  ['dependencies, draft-07', { type: 'object', dependencies: { a: ['b'] } }, { a: 1 }],
  ['definitions and $ref', { type: 'object', definitions: { name: { type: 'string' } }, properties: { n: { $ref: '#/definitions/name' } } }, { n: 5 }],
  ['if and then, with contains', { type: 'object', if: { properties: { k: { const: 'x' } }, required: ['k'] }, then: { properties: { list: { contains: { const: 'x' } } } } }, { k: 'x', list: ['y'] }],
];

let CACHE = null;
function runChild() {
  if (CACHE) return CACHE;
  const dir = tmp('element-schemas-');
  FG.seedLmdb(dir, [[HELD_KEY, HELD_SCHEMA]]);
  const script = path.join(dir, 'child.js');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(script, `'use strict';
const ROOT = ${JSON.stringify(ROOT)};
const out = { };
const before = new Set(Object.keys(require.cache));
(async () => {
  try {
    const { readerOver } = require(ROOT + '/test/helpers/graphFake.js');
    const C = require(ROOT + '/test/helpers/conceptGraph.js');
    const E = require(ROOT + '/test/helpers/createElementGraph.js');
    const seed = await E.seedCreateElement();
    const s = seed.state;
    const k = seed.keys;
    const crypto = require('crypto');
    const add = (labels, props) => { const n = { eid: s.nextEid++, labels, props: { ...props, tapestryKey: crypto.randomUUID() } }; s.nodes.push(n); return n; };
    const link = (a, type, b) => s.rels.push({ eid: s.nextEid++, type, from: a.eid, to: b.eid, props: {} });
    const concept = (slug, json) => {
      const h = add(['NostrEvent', 'ListHeader', 'ConceptHeader', 'TapestryNode'], { uuid: '39998:' + E.TA + ':' + slug, kind: 39998, pubkey: E.TA, name: slug });
      const sup = add(['NostrEvent', 'ListItem', 'Superset', 'TapestryNode'], { uuid: '39999:' + E.TA + ':' + slug + '-superset', kind: 39999, pubkey: E.TA, name: slug + 's' });
      link(h, 'IS_THE_CONCEPT_FOR', sup);
      const js = add(['NostrEvent', 'ListItem', 'JSONSchema', 'TapestryNode'], { uuid: '39999:' + E.TA + ':' + slug + '-schema', kind: 39999, pubkey: E.TA, name: 'schema for ' + slug });
      link(js, 'IS_THE_JSON_SCHEMA_FOR', h);
      if (json !== undefined) link(js, 'HAS_TAG', add(['NostrEventTag', 'TapestryNode'], { type: 'json', value: json, uuid: slug + '-schema-json' }));
      k[slug] = h.props.tapestryKey;
    };
    concept('bare', JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', required: ['bare'] }));
    concept('held', 'lmdb:${HELD_KEY}');
    concept('jsonless', undefined);
    concept('listy', '[1, 2]');
    const read = readerOver(s);

    // SC8 first: the fake, before anything of _schemas.js loads.
    const E1 = "MATCH (h:TapestryNode {tapestryKey: $key}) WHERE h:ConceptHeader OR h:ListHeader OPTIONAL MATCH (h)<-[:IS_THE_JSON_SCHEMA_FOR]-(js:JSONSchema) OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'}) RETURN js.tapestryKey AS schema, jt.value AS json";
    const E2 = 'MATCH (t:TapestryNode {tapestryKey: $key})<-[:IS_A_SUPERSET_OF*0..]-(s:Superset)<-[:IS_THE_CONCEPT_FOR]-(h) WHERE h:ConceptHeader OR h:ListHeader RETURN DISTINCT h.tapestryKey AS concept, h.uuid AS uuid';
    const E3 = "MATCH (h:TapestryNode {tapestryKey: $key})-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*0..]->(holder)-[:HAS_ELEMENT]->(e) WHERE e.pubkey = $ta AND (toLower(e.name) = $name OR e.uuid = $address OR e.uuid STARTS WITH $nonced) WITH DISTINCT e OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'}) OPTIONAL MATCH (p)-[:HAS_ELEMENT]->(e) RETURN e.tapestryKey AS key, e.uuid AS uuid, head(collect(DISTINCT t.value)) AS json, collect(DISTINCT p.tapestryKey) AS parents ORDER BY key";
    const E4 = "MATCH (e:TapestryNode {tapestryKey: $key}) WHERE NOT e:GraphChange OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'}) RETURN head(collect(t.value)) AS json";
    const nm = (key) => Object.keys(k).find((x) => k[x] === key) || key;
    out.fake = {};
    try {
      out.fake.e1 = {};
      for (const c of ['beagle', 'kettle', 'word']) out.fake.e1[c] = (await read(E1, { key: k[c] })).map((r) => ({ schema: typeof r.schema === 'string', json: typeof r.json === 'string' }));
      out.fake.e2 = {};
      for (const t of ['walkers', 'goldenRetrieverSuperset', 'lapPets', 'beagleSuperset']) out.fake.e2[t] = (await read(E2, { key: k[t] })).map((r) => nm(r.concept)).sort();
      const twin = E.elementAddress('Twin', seed.uuids.beagle);
      out.fake.e3 = (await read(E3, { key: k.beagle, ta: E.TA, name: 'twin', address: twin, nonced: twin + '~' })).map((r) => ({ key: nm(r.key), json: typeof r.json === 'string', parents: r.parents.map(nm) }));
      out.fake.e4 = { rover: typeof (await read(E4, { key: k.rover }))[0].json, loner: (await read(E4, { key: k.loner }))[0].json };
    } catch (e) { out.fake.error = String(e && e.message || e); }

    const X = require(${JSON.stringify(SCHEMAS)});
    out.loadedAtRequire = Object.keys(require.cache).filter((f) => !before.has(f) && /[\\\\/]ajv[\\\\/]|neo4j-driver|[\\\\/]lmdb[\\\\/]|tapestry-store/.test(f));
    out.exports = Object.keys(X).sort();

    out.schemaOf = {};
    for (const c of ['dog', 'beagle', 'bare', 'held', 'word', 'kettle', 'jsonless', 'teapot', 'lantern', 'listy']) {
      try { out.schemaOf[c] = await X.schemaOf(read, k[c]); } catch (e) { out.schemaOf[c] = { threw: String(e && e.message || e) }; }
    }

    const p = (schema, json) => { try { return X.problemsOf(schema, json); } catch (e) { return { threw: String(e && e.message || e) }; } };
    const dogSchema = { type: 'object', required: ['dog'], properties: { dog: { type: 'object', required: ['description'], additionalProperties: false, properties: { name: { type: 'string', minLength: 3 }, description: { type: 'string' }, breed: { enum: ['goldenRetriever', 'irishSetter'] }, age: { type: 'integer' }, owner: { type: 'object', properties: { name: { type: 'string' } } } } } } };
    out.problems = {
      top: p(dogSchema, {}),
      required: p(dogSchema, { dog: { name: 'Fido' } }),
      extra: p(dogSchema, { dog: { name: 'Fido', description: 'x', color: 'red' } }),
      enumBad: p(dogSchema, { dog: { name: 'Fido', description: 'x', breed: 'poodle' } }),
      typeBad: p(dogSchema, { dog: { name: 'Fido', description: 'x', age: 'three' } }),
      other: p(dogSchema, { dog: { name: 'Fi', description: 'x' } }),
      nested: p(dogSchema, { dog: { name: 'Fido', description: 'x', owner: { name: 5 } } }),
      every: p(dogSchema, { dog: { name: 'Fi', breed: 'poodle', age: 'three', color: 'red' } }),
      fits: p(dogSchema, { dog: { name: 'Fido', description: 'a dog' } }),
      noCompile: p({ type: 'nonsense' }, {}),
      idA: p({ $id: 'https://example.com/schemas/one', type: 'object', required: ['a'] }, {}),
      idB: p({ $id: 'https://example.com/schemas/one', type: 'object', required: ['b'] }, { a: 1 }),
      idA2: p({ $id: 'https://example.com/schemas/one', type: 'object', required: ['a'] }, { a: 1 }),
    };

    const derive = ${DERIVE};
    const fwDog = JSON.parse(require('fs').readFileSync(ROOT + '/firmware/versions/v1.0.0/concepts/dog/json-schema.json', 'utf8'));
    out.dialect = [];
    for (const [label, schemaSpec, json] of ${JSON.stringify(DIALECT)}) {
      const whole = schemaSpec === 'dog' ? fwDog : schemaSpec;
      const section = whole.jsonSchema && typeof whole.jsonSchema === 'object' ? whole.jsonSchema : whole;
      const { $schema, ...noMeta } = section;
      const mine = p(noMeta, json);
      out.dialect.push({ label, derive: derive(JSON.parse(JSON.stringify(whole)), json), mine });
    }

    out.fits = {};
    for (const [id, c, json] of [
      ['fits', 'beagle', { word: { wordTypes: ['word', 'beagle'] }, beagle: { name: 'Max', slug: 'max', description: 'a dog' } }],
      ['not', 'beagle', { word: { wordTypes: ['word', 'beagle'] }, beagle: { name: 'Max', slug: 'max' } }],
      ['none', 'word', { word: { wordTypes: ['word'] } }],
      ['dogFits', 'dog', { word: { wordTypes: ['word', 'dog', 'goldenRetriever'] }, dog: { name: 'Buddy', slug: 'buddy', breed: 'goldenRetriever' } }],
    ]) {
      try { out.fits[id] = await X.fits(read, k[c], json); } catch (e) { out.fits[id] = { threw: String(e && e.message || e) }; }
    }
  } catch (e) { out.error = String(e && e.stack || e); }
  require('fs').writeFileSync(${JSON.stringify(outFile)}, JSON.stringify(out));
  process.exit(0);
})();
`);
  const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 120000 });
  let out = null;
  try { out = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported below */ }
  assert(out, `the child wrote no answer: ${(child.stderr || '').slice(-600)}`);
  CACHE = out;
  return out;
}
function got() {
  needSchemas();
  const out = runChild();
  assert(!out.error, `the child failed: ${String(out.error).slice(0, 600)}`);
  return out;
}
const msgs = (r) => ((r && r.problems) || []).map((x) => `${x.path} :: ${x.message}`).join(' | ');

test('SC1: schemaOf reads the jsonSchema section, else the object itself, drops $schema, and resolves an LMDB reference', () => {
  const o = got().schemaOf;
  assert(o.dog && o.dog.schema && !('$schema' in o.dog.schema) && Array.isArray(o.dog.schema.allOf) && show(o.dog.schema.required) === show(['word', 'dog']),
    `firmware dog's schema: its jsonSchema section, without $schema; got ${show(o.dog).slice(0, 300)}`);
  assert(o.beagle && o.beagle.schema && o.beagle.schema.properties && o.beagle.schema.properties.beagle && !('$schema' in o.beagle.schema), `beagle's, as today's create-concept wrote it; got ${show(o.beagle).slice(0, 300)}`);
  assert(o.bare && o.bare.schema && show(o.bare.schema) === show({ type: 'object', required: ['bare'] }), `a schema node whose JSON is the schema itself; got ${show(o.bare)}`);
  assert(o.held && o.held.schema && show(o.held.schema) === show({ type: 'object', required: ['held'], properties: { held: { type: 'object' } } }), `an LMDB reference is resolved, as F.readJson does; got ${show(o.held)}`);
});

test('SC2: schemaOf says why there is no schema: none, more than one, no json tag, unparseable, a missing LMDB entry, not an object', () => {
  const o = got().schemaOf;
  const cases = [['word', /no JSON schema|has no schema|no schema node/i], ['kettle', /more than one|two|several/i], ['jsonless', /json tag/i], ['teapot', /pars/i], ['lantern', /LMDB/i], ['listy', /object/i]];
  for (const [c, why] of cases) {
    const r = o[c];
    assert(r && !r.schema && typeof r.problem === 'string' && why.test(r.problem), `${c}: no schema, and the problem says why (${why}); got ${show(r)}`);
  }
});

test('SC3: problemsOf names each problem by its dotted path, in words, every one of them', () => {
  const p = got().problems;
  assert(/^the element's JSON/.test(String(p.top.problems[0].path)) && /`?dog`? is required/.test(p.top.problems[0].message), `a top-level field left out: "the element's JSON", "\`dog\` is required"; got ${msgs(p.top)}`);
  assert(/`?dog\.description`? is required/.test(msgs(p.required)), `required names the missing field; got ${msgs(p.required)}`);
  assert(/`?dog\.color`? isn't a field the schema takes/.test(msgs(p.extra)), `additionalProperties names the extra field; got ${msgs(p.extra)}`);
  assert(/dog\.breed/.test(msgs(p.enumBad)) && /goldenRetriever/.test(msgs(p.enumBad)) && /irishSetter/.test(msgs(p.enumBad)), `enum lists the values allowed; got ${msgs(p.enumBad)}`);
  assert(/dog\.age/.test(msgs(p.typeBad)) && /integer/.test(msgs(p.typeBad)), `type names the type; got ${msgs(p.typeBad)}`);
  assert(p.other.problems.some((x) => x.path === 'dog.name' && /fewer than 3/.test(x.message)), `another keyword gives ajv's words, at the dotted path; got ${msgs(p.other)}`);
  assert(p.nested.problems.some((x) => x.path === 'dog.owner.name'), `a path a level down is dotted; got ${msgs(p.nested)}`);
  const every = msgs(p.every);
  assert(['dog.description', 'dog.name', 'dog.breed', 'dog.age', 'dog.color'].every((f) => every.includes(f)), `every problem is listed, not the first alone; got ${every}`);
  assert(show(p.fits.problems) === show([]) && !p.fits.problem, `JSON that fits has no problems; got ${show(p.fits)}`);
});

test('SC4: a schema that doesn\'t compile is a problem, not a throw; two schemas with one $id both check', () => {
  const p = got().problems;
  assert(!p.noCompile.threw && typeof p.noCompile.problem === 'string' && p.noCompile.problem.length > 5, `a schema that doesn't compile answers { problem }; got ${show(p.noCompile)}`);
  assert(!p.idA.threw && /`?a`? is required/.test(msgs(p.idA)), `the first schema with the $id checks; got ${show(p.idA)}`);
  assert(!p.idB.threw && /`?b`? is required/.test(msgs(p.idB)), `a second schema with the same $id checks against itself, not the first (a new Ajv each time); got ${show(p.idB)}`);
  assert(!p.idA2.threw && show(p.idA2.problems) === show([]), `the first again, now fitting; got ${show(p.idA2)}`);
});

test('SC5: the dialect is the derive step\'s reading of a schema: the same verdict for each schema and JSON under it, 2020-12\'s own keywords ignored alike', () => {
  for (const d of got().dialect) {
    assert(d.derive !== 'throws' && !d.mine.threw && !d.mine.problem, `${d.label}: both compile; got derive ${show(d.derive)}, mine ${show(d.mine)}`);
    const mineValid = (d.mine.problems || []).length === 0;
    assert(mineValid === d.derive, `${d.label}: problemsOf says ${mineValid ? 'fits' : 'doesn\'t fit'}, the derive step ${d.derive ? 'fits' : 'doesn\'t fit'} (Decision 11: one verdict); got ${msgs(d.mine)}`);
  }
  const byLabel = Object.fromEntries(got().dialect.map((d) => [d.label, d]));
  assert(byLabel['prefixItems, 2020-12 only'].derive === true, 'prefixItems is ignored, as draft-07 reads it');
  assert(byLabel['firmware dog, a golden retriever outside it'].derive === false, 'and dog\'s tie of breed to wordTypes holds');
});

test('SC6: fits gives true, false with the problems, or null with why', () => {
  const f = got().fits;
  assert(f.fits && f.fits.fits === true && show(f.fits.problems) === show([]), `beagle's JSON that fits: fits true; got ${show(f.fits)}`);
  assert(f.not && f.not.fits === false && /beagle\.description/.test(msgs(f.not)), `JSON without a description: fits false, with the problem; got ${show(f.not)}`);
  assert(f.none && f.none.fits === null && typeof f.none.problem === 'string', `a concept with no schema: fits null, and why; got ${show(f.none)}`);
  assert(f.dogFits && f.dogFits.fits === true, `firmware dog, through schemaOf, $schema 2020-12 dropped: fits; got ${show(f.dogFits)}`);
});

test('SC7: loading _schemas.js opens nothing: no ajv, LMDB, Neo4j driver or store until first called', () => {
  const o = got();
  assert(show(o.loadedAtRequire) === show([]), `requiring it must load nothing heavy (ADR 0001 Decision 10; ADR 0020 Implementation notes); it loaded ${show(o.loadedAtRequire)}`);
  for (const name of ['schemaOf', 'problemsOf', 'fits', 'checkElements']) assert(o.exports.includes(name), `it exports ${name}; got ${show(o.exports)}`);
});

test('SC8: the fake graph runs E1–E4 as the ADR writes them, answering as Neo4j would', () => {
  const out = runChild();
  const f = out.fake || {};
  assert(!f.error, `the fake can't run one of the ADR's statements: ${f.error}`);
  assert(show(f.e1.beagle) === show([{ schema: true, json: true }]) && f.e1.kettle.length === 2 && show(f.e1.word) === show([{ schema: false, json: false }]), `E1: one schema, two, or a row of nulls; got ${show(f.e1)}`);
  assert(show(f.e2.walkers) === show(['dog', 'pet']) && show(f.e2.goldenRetrieverSuperset) === show(['dog', 'goldenRetriever']) && show(f.e2.lapPets) === show(['pet']) && show(f.e2.beagleSuperset) === show(['beagle']),
    `E2: the concepts whose class thread reaches each; got ${show(f.e2)}`);
  assert(f.e3.length === 2 && f.e3.every((r) => r.json === true && r.parents.length === 1 && r.parents[0] === 'beagleSuperset'), `E3: both twins, each with its json and its parent; got ${show(f.e3)}`);
  assert(f.e4.rover === 'string' && f.e4.loner === null, `E4: rover's JSON, and a null for a node with none; got ${show(f.e4)}`);
});

/** SC9's child: the real deriveWord, with Neo4j, the LMDB store and the resolver stubbed in require.cache, beside problemsOf. */
function deriveBeside(cases) {
  const dir = tmp('element-schemas-derive-');
  const script = path.join(dir, 'child.js');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(script, `'use strict';
const path = require('path');
const ROOT = ${JSON.stringify(ROOT)};
const out = { cases: [] };
const stub = (rel, exports) => { const f = require.resolve(path.join(ROOT, rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports }; };
let current = null;
stub('src/lib/neo4j-driver', {
  runCypher: async (q) => {
    if (/tag\\.value AS value/.test(q)) return [{ value: current.json }];
    if (/IS_THE_JSON_SCHEMA_FOR/.test(q)) return [{ schemaUuid: 's', schemaTapestryKey: 'sk', conceptName: 'c', conceptTapestryKey: 'ck', schemaJson: current.schema }];
    return [];
  },
});
stub('src/lib/tapestry-store', { get: () => undefined });
stub('src/lib/tapestry-resolve', { isLmdbRef: () => false, resolveValue: () => null });
(async () => {
  try {
    const deriveWord = require(path.join(ROOT, 'src/lib/derivers/word.js'));
    const X = require(${JSON.stringify(SCHEMAS)});
    for (const c of ${JSON.stringify(cases)}) {
      current = { json: JSON.stringify(c.json), schema: c.schema };
      const derived = await deriveWord({ uuid: 'u', tapestryKey: 'k', name: 'n', labels: [], elementId: 'e' });
      const entry = derived.graphContext.parentJsonSchemas[0];
      const parsed = JSON.parse(c.schema);
      const section = parsed.jsonSchema && typeof parsed.jsonSchema === 'object' ? parsed.jsonSchema : parsed;
      const { $schema, ...noMeta } = section;
      const mine = X.problemsOf(noMeta, c.json);
      out.cases.push({ label: c.label, derive: entry ? entry.valid : null, deriveErrors: entry ? entry.errors : null, fits: mine.problem ? null : mine.problems.length === 0, problems: (mine.problems || []).map((p) => p.message), problem: mine.problem || null });
    }
  } catch (e) { out.error = String(e && e.stack || e); }
  require('fs').writeFileSync(${JSON.stringify(outFile)}, JSON.stringify(out));
  process.exit(0);
})();
`);
  const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 120000 });
  let out = null;
  try { out = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported below */ }
  assert(out, `the derive child wrote no answer: ${(child.stderr || '').slice(-600)}`);
  assert(!out.error, `the derive child failed: ${String(out.error).slice(0, 600)}`);
  return Object.fromEntries(out.cases.map((c) => [c.label, c]));
}

test('SC9: the real derive step beside this check: agreeing under create-concept\'s and firmware dog\'s schemas, split as Amendment 1 says under word\'s and one that limits top-level keys', () => {
  needSchemas();
  const fw = (c) => fs.readFileSync(path.join(ROOT, `firmware/versions/v1.0.0/concepts/${c}/json-schema.json`), 'utf8');
  const beagleSchema = JSON.stringify({ jsonSchema: { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', required: ['beagle'], properties: { beagle: { type: 'object', required: ['name', 'slug', 'description'], properties: { name: { type: 'string' }, slug: { type: 'string' }, description: { type: 'string' } } } } } });
  const beagle = (description) => ({ word: { slug: 'beagle--max', name: 'beagle: Max', title: 'Beagle: Max', wordTypes: ['word', 'beagle'] }, beagle: { name: 'Max', slug: 'max', ...(description === undefined ? {} : { description }) } });
  const r = deriveBeside([
    { label: 'beagle fits', schema: beagleSchema, json: beagle('a dog') },
    { label: 'beagle misses', schema: beagleSchema, json: beagle(undefined) },
    { label: 'dog in its set', schema: fw('dog'), json: { word: { slug: 'dog--rover', name: 'dog: Rover', title: 'Dog: Rover', wordTypes: ['word', 'dog', 'goldenRetriever'] }, dog: { name: 'Rover', slug: 'rover', breed: 'goldenRetriever' } } },
    { label: 'dog outside it', schema: fw('dog'), json: { word: { slug: 'dog--fido', name: 'dog: Fido', title: 'Dog: Fido', wordTypes: ['word', 'dog'] }, dog: { name: 'Fido', slug: 'fido', breed: 'goldenRetriever' } } },
    { label: 'word', schema: fw('word'), json: { word: { slug: 'word--lexeme', name: 'word: Lexeme', title: 'Word: Lexeme', wordTypes: ['word'] } } },
    { label: 'closed top', schema: JSON.stringify({ jsonSchema: { type: 'object', properties: { word: {}, beagle: {} }, additionalProperties: false } }), json: beagle('a dog') },
  ]);
  for (const [label, want] of [['beagle fits', true], ['beagle misses', false], ['dog in its set', true], ['dog outside it', false]]) {
    const c = r[label];
    assert(c.derive === want && c.fits === want, `${label}: the derive step and this check agree, ${want ? 'fitting' : 'not fitting'} (Amendment 1, item 1); got derive ${show(c.derive)}, check ${show(c.fits)} ${show(c.problems)}`);
  }
  const w = r.word;
  assert(w.derive === true && w.fits === false && w.problems.some((p) => /graphContext/.test(p)), `firmware word's schema: the derive step, which adds its own graphContext, says valid; this check, on the stored JSON, says graphContext is required (Amendment 1, item 1); got derive ${show(w.derive)}, check ${show(w.problems)}`);
  const t = r['closed top'];
  assert(t.derive === false && t.fits === true, `a schema that forbids extra top-level keys: the derive step's graphContext breaks it, the stored JSON doesn't; got derive ${show(t.derive)} ${show(t.deriveErrors)}, check ${show(t.fits)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
