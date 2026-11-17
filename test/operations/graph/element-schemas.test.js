'use strict';
/**
 * _schemas.js, the one check of an element against its concept's JSON Schema — its own suite, run by
 * test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/20-create-element.md (AC3, AC7), and
 *          engineering-team/stories/graph-operations-first-slice/42-both-readers-judge-tapestryjson.md (AC1–AC4)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0020-create-element.md (Decision 11; Implementation
 *          notes E1–E4), and 0042-both-readers-judge-tapestryjson.md (Decisions 1, 3, 5 and 6; E1 and E4 as it
 *          writes them)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/20-create-element.test-plan.md, and
 *          42-both-readers-judge-tapestryjson.test-plan.md
 *
 * Stack-free. SC1–SC8, SC10 and SC11 run in one child process with the TA set, over the graph
 * test/helpers/createElementGraph.js seeds (through graphFake's readerOver), and an LMDB store under the child's
 * directory holding one schema. The child adds five concepts first, each a header and a schema node: bare (its schema
 * node's JSON is the schema itself, with no jsonSchema section), held (its JSON is an LMDB reference to the stored
 * schema), wordy (firmware word's own schema, which requires graphContext), and two whose schema can't be used:
 * jsonless (a schema node with no json tag) and listy (JSON that is a list). SC9, SC12 and SC13 run the real derivers
 * and the rule in a second child, its database, store and resolver stubbed, the database answering each statement by
 * the parameters it takes, as a graph holding the case's node would.
 *
 *   SC1 schemaOf reads the jsonSchema section, else the object itself, and drops $schema; it resolves an LMDB reference
 *   SC2 schemaOf says why there is no schema: none, more than one, no json tag, JSON that doesn't parse, an LMDB entry
 *       that is missing, something other than an object
 *   SC3 problemsOf names each problem by its dotted path, in words: required, a field the schema doesn't take, a value
 *       not allowed, the wrong type, any other keyword in ajv's words; "the element's JSON" at the top; every problem
 *   SC4 a schema that doesn't compile is a problem, not a throw; two schemas with one $id both check
 *   SC5 the dialect is the reading the derive step used before story 42, which it now takes from this module: for
 *       each schema and JSON, problemsOf's verdict is the one ajv gives the JSON under that reading (the jsonSchema
 *       section, $schema dropped, ajv's defaults with strict off), 2020-12's own keywords ignored as it ignores them
 *   SC6 fits gives true, false (with the problems) or null (with why) for a concept and JSON
 *   SC7 loading _schemas.js opens nothing: no ajv, LMDB, Neo4j driver or store until first called; it exports
 *       tapestryJsonOf too (ADR 0042 Decision 1)
 *   SC8 the fake graph runs E1–E4 as the ADRs write them, E1 with the schema node's uuid and E4 with only the node's
 *       name and uuid (ADR 0042 Decisions 2 and 5), answering as Neo4j would
 *   SC9 (story 42, AC3) one verdict from both readers: the real derive step builds a node's tapestryJson, the store
 *       keeps it, and the rule's check of the node judges what was kept. On each concept they agree, fitting, not
 *       fitting or not checkable, the cache's errors in the rule's words, under create-concept's schema, firmware
 *       dog's and firmware word's, one that forbids extra top-level keys, a word block missing a field the derive step
 *       fills in, an entry built before the node's json tag changed, and a schema that doesn't compile. A concept only
 *       a z tag names is judged by neither
 *   SC10 (story 42, AC1 and AC2) tapestryJsonOf reads a node's tapestryJson from the store; a node with no entry is a
 *       problem marked missing, saying the derive step builds it; an entry that isn't an object is a problem
 *   SC11 (story 42, AC4) a write's check sets aside what only the derive step builds: under firmware word's schema, a
 *       full word block with no graphContext is waiting, not failing; with other problems too, those alone are
 *       reported; JSON that holds a graphContext is judged as it is; a check that isn't a write's sets nothing aside;
 *       and every answer says whether it waits
 *   SC12 (story 42, AC3; ADR 0042 Decision 5) the derivers' cached verdicts, the word deriver's and the set
 *       deriver's: today's entry shape, naming the schema node by its uuid and tapestryKey; two schema nodes give one
 *       entry each, not checkable; a concept with no schema node gives none; filling the entries in changes no
 *       verdict under firmware word's schema; and a set entry that still carries an old x-tapestry.derived artifact is
 *       judged as it is stored, without it (review round 1, non-blocking 4)
 *   SC13 (ADR 0042 Decision 6) a derive pass over a label reads each concept's schema once, however many nodes it
 *       derives; and loading src/lib/derivers/schema-verdicts.js opens nothing heavy
 *   SC14 (review round 1, non-blocking 1) a judge doesn't keep a schema read that failed: after one transient failure,
 *       the next check of that concept reads its schema again, so one hiccup doesn't fail the rest of a derive pass
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

/** The derive step's reading of a schema before story 42, which _schemas.js keeps: the jsonSchema section, $schema dropped, ajv's defaults with strict off. SC9 runs the derive step itself. */
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
    concept('wordy', require('fs').readFileSync(ROOT + '/firmware/versions/v1.0.0/concepts/word/json-schema.json', 'utf8'));
    const read = readerOver(s);

    // SC8 first: the fake, before anything of _schemas.js loads. E1 and E4 as ADR 0042 writes them (Decisions 2 and 5).
    const E1 = "MATCH (h:TapestryNode {tapestryKey: $key}) WHERE h:ConceptHeader OR h:ListHeader OPTIONAL MATCH (h)<-[:IS_THE_JSON_SCHEMA_FOR]-(js:JSONSchema) OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'}) RETURN h.name AS name, h.uuid AS uuid, js.tapestryKey AS schema, js.uuid AS schemaUuid, jt.value AS json";
    const E2 = 'MATCH (t:TapestryNode {tapestryKey: $key})<-[:IS_A_SUPERSET_OF*0..]-(s:Superset)<-[:IS_THE_CONCEPT_FOR]-(h) WHERE h:ConceptHeader OR h:ListHeader RETURN DISTINCT h.tapestryKey AS concept, h.uuid AS uuid';
    const E3 = "MATCH (h:TapestryNode {tapestryKey: $key})-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*0..]->(holder)-[:HAS_ELEMENT]->(e) WHERE e.pubkey = $ta AND (toLower(e.name) = $name OR e.uuid = $address OR e.uuid STARTS WITH $nonced) WITH DISTINCT e OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'}) OPTIONAL MATCH (p)-[:HAS_ELEMENT]->(e) RETURN e.tapestryKey AS key, e.uuid AS uuid, head(collect(DISTINCT t.value)) AS json, collect(DISTINCT p.tapestryKey) AS parents ORDER BY key";
    const E4 = 'MATCH (e:TapestryNode {tapestryKey: $key}) WHERE NOT e:GraphChange RETURN e.name AS name, e.uuid AS uuid';
    const nm = (key) => Object.keys(k).find((x) => k[x] === key) || key;
    out.fake = {};
    try {
      out.fake.e1 = {};
      for (const c of ['beagle', 'kettle', 'word']) out.fake.e1[c] = (await read(E1, { key: k[c] })).map((r) => ({ schema: typeof r.schema === 'string', schemaUuid: typeof r.schemaUuid === 'string', json: typeof r.json === 'string', name: typeof r.name === 'string' }));
      out.fake.e2 = {};
      for (const t of ['walkers', 'goldenRetrieverSuperset', 'lapPets', 'beagleSuperset']) out.fake.e2[t] = (await read(E2, { key: k[t] })).map((r) => nm(r.concept)).sort();
      const twin = E.elementAddress('Twin', seed.uuids.beagle);
      out.fake.e3 = (await read(E3, { key: k.beagle, ta: E.TA, name: 'twin', address: twin, nonced: twin + '~' })).map((r) => ({ key: nm(r.key), json: typeof r.json === 'string', parents: r.parents.map(nm) }));
      const rover = await read(E4, { key: k.rover });
      out.fake.e4 = { rover: rover.map((r) => ({ name: typeof r.name === 'string', uuid: typeof r.uuid === 'string', json: 'json' in r })), nobody: (await read(E4, { key: '00000000-0000-4000-8000-0000000000cc' })).length };
    } catch (e) { out.fake.error = String(e && e.message || e); }

    const X = require(${JSON.stringify(SCHEMAS)});
    out.loadedAtRequire = Object.keys(require.cache).filter((f) => !before.has(f) && /[\\\\/]ajv[\\\\/]|neo4j-driver|[\\\\/]lmdb[\\\\/]|tapestry-store/.test(f));
    out.exports = Object.keys(X).sort();

    // SC10: tapestryJsonOf, over the child's own store (TAPESTRY_LMDB_PATH, from childEnv), seeded only now, after SC7.
    const store = require(ROOT + '/src/lib/tapestry-store.js');
    const roverTapestry = { word: { slug: 'beagle--rover', name: 'beagle: Rover', wordTypes: ['word', 'beagle'] }, beagle: { name: 'Rover', slug: 'rover', description: 'held in the store' }, graphContext: { identifiers: { tapestryKey: k.rover }, derivedAt: 1 } };
    await store.put(k.rover, roverTapestry);
    const odd = crypto.randomUUID();
    await store.put(odd, [1, 2]);
    out.tapestryJsonOf = {};
    for (const [id, key] of [['rover', k.rover], ['loner', k.loner], ['odd', odd]]) {
      try { out.tapestryJsonOf[id] = await Promise.resolve(X.tapestryJsonOf(key)); } catch (e) { out.tapestryJsonOf[id] = { threw: String(e && e.message || e) }; }
    }
    out.roverTapestry = roverTapestry;

    // SC11: a write's check (fits) against firmware word's schema, and a check that isn't a write's (judge).
    const wordBlock = { slug: 'word--lexeme', name: 'word: Lexeme', wordTypes: ['word'] };
    out.writing = {};
    for (const [id, run] of [
      ['waitOnly', () => X.fits(read, k.wordy, { word: wordBlock })],
      ['waitAndMore', () => X.fits(read, k.wordy, { word: { name: 'word: Lexeme', wordTypes: ['word'] } })],
      ['heldContext', () => X.fits(read, k.wordy, { word: wordBlock, graphContext: {} })],
      ['strict', () => X.judge(read).check(k.wordy, { word: wordBlock })],
      ['ordinary', () => X.fits(read, k.beagle, { word: { wordTypes: ['word', 'beagle'] }, beagle: { name: 'Max', slug: 'max', description: 'a dog' } })],
    ]) {
      try { out.writing[id] = await run(); } catch (e) { out.writing[id] = { threw: String(e && e.message || e) }; }
    }

    // SC14: a judge whose first schema read fails, once, as a transient database error would.
    let failures = 1;
    const flaky = async (q, p) => { if (/IS_THE_JSON_SCHEMA_FOR/.test(String(q)) && failures > 0) { failures--; throw new Error('a transient failure'); } return read(q, p); };
    const fj = X.judge(flaky);
    const okBeagle = { word: { wordTypes: ['word', 'beagle'] }, beagle: { name: 'Max', slug: 'max', description: 'a dog' } };
    out.flaky = {};
    try { await fj.check(k.beagle, okBeagle); out.flaky.first = 'answered'; } catch (e) { out.flaky.first = 'threw: ' + String(e && e.message || e); }
    try { out.flaky.second = await fj.check(k.beagle, okBeagle); } catch (e) { out.flaky.second = { threw: String(e && e.message || e) }; }

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
  assert(show(o.loadedAtRequire) === show([]), `requiring it must load nothing heavy (ADR 0001 Decision 10; ADR 0020 Implementation notes; ADR 0042 Decision 1: the store is required when first called); it loaded ${show(o.loadedAtRequire)}`);
  for (const name of ['schemaOf', 'problemsOf', 'fits', 'checkElements', 'tapestryJsonOf']) assert(o.exports.includes(name), `it exports ${name} (ADR 0042 Decision 1); got ${show(o.exports)}`);
});

test('SC8: the fake graph runs E1–E4 as the ADRs write them, E1 with the schema node\'s uuid and E4 with the node\'s name and uuid alone', () => {
  const out = runChild();
  const f = out.fake || {};
  assert(!f.error, `the fake can't run one of the ADRs' statements: ${f.error}`);
  assert(show(f.e1.beagle) === show([{ schema: true, schemaUuid: true, json: true, name: true }]) && f.e1.kettle.length === 2 && show(f.e1.word) === show([{ schema: false, schemaUuid: false, json: false, name: true }]),
    `E1: one schema with its node's uuid (ADR 0042 Decision 5), two, or the header with nulls; got ${show(f.e1)}`);
  assert(show(f.e2.walkers) === show(['dog', 'pet']) && show(f.e2.goldenRetrieverSuperset) === show(['dog', 'goldenRetriever']) && show(f.e2.lapPets) === show(['pet']) && show(f.e2.beagleSuperset) === show(['beagle']),
    `E2: the concepts whose class thread reaches each; got ${show(f.e2)}`);
  assert(f.e3.length === 2 && f.e3.every((r) => r.json === true && r.parents.length === 1 && r.parents[0] === 'beagleSuperset'), `E3: both twins, each with its json and its parent; got ${show(f.e3)}`);
  assert(show(f.e4.rover) === show([{ name: true, uuid: true, json: false }]) && f.e4.nobody === 0, `E4: rover's name and uuid, and no json tag read (ADR 0042 Decision 2); no row for a key no node has; got ${show(f.e4)}`);
});

test('SC10: tapestryJsonOf reads a node\'s tapestryJson from the store; none is a problem marked missing; an entry that isn\'t an object is a problem', () => {
  const o = got();
  const t = o.tapestryJsonOf || {};
  for (const id of ['rover', 'loner', 'odd']) assert(t[id] && !t[id].threw, `tapestryJsonOf(${id}) answers, never throws (ADR 0042 Decision 1); got ${show(t[id])}`);
  assert(show(t.rover.json) === show(o.roverTapestry) && !t.rover.problem, `rover: the store's entry, its data as it was put, graphContext and all; got ${show(t.rover)}`);
  assert(!t.loner.json && t.loner.missing === true && /tapestryJson/.test(String(t.loner.problem)) && /derive/i.test(String(t.loner.problem)),
    `a node with no entry: a problem saying it has no tapestryJson yet and the derive step builds it, marked missing (story 42, AC2); got ${show(t.loner)}`);
  assert(!t.odd.json && t.odd.missing !== true && /object/.test(String(t.odd.problem)), `an entry that is a list: a problem saying it isn't an object, not marked missing; got ${show(t.odd)}`);
});

test('SC11: a write\'s check sets aside what only the derive step builds: under firmware word\'s schema a full word block waits, and other problems are reported alone', () => {
  const w = got().writing || {};
  for (const id of ['waitOnly', 'waitAndMore', 'heldContext', 'strict', 'ordinary']) assert(w[id] && !w[id].threw, `case ${id} answers; got ${show(w[id])}`);
  const a = w.waitOnly;
  assert(a.fits === null && a.waiting === true && show(a.problems) === show([]) && /derive step/.test(String(a.problem)) && /graphContext/.test(String(a.problem)),
    `a word block with its slug and wordTypes, and no graphContext: not failing but waiting for the derive step, which builds graphContext (story 42, AC4; ADR 0042 Decision 3); got ${show(a)}`);
  const b = w.waitAndMore;
  assert(b.fits === false && b.waiting === true && b.problems.length >= 1 && b.problems.some((p) => /word\.slug/.test(p.message)) && !b.problems.some((p) => /graphContext/.test(`${p.path} ${p.message}`)) && !b.problem,
    `a word block with no slug: reported for word.slug alone, graphContext set aside, and still waiting; got ${show(b)}`);
  const c = w.heldContext;
  assert(c.fits === false && c.waiting === false && c.problems.some((p) => /graphContext/.test(`${p.path} ${p.message}`)),
    `JSON that holds a graphContext, an empty one: judged as it is, nothing set aside; got ${show(c)}`);
  const d = w.strict;
  assert(d.fits === false && d.waiting === false && d.problems.some((p) => /graphContext/.test(p.message)),
    `a check that isn't a write's (the rule's check form, the derive step) sets nothing aside: graphContext is required; got ${show(d)}`);
  const e = w.ordinary;
  assert(e.fits === true && e.waiting === false && show(e.problems) === show([]), `JSON that fits beagle's schema: fits, and waits for nothing; got ${show(e)}`);
});

/**
 * SC9, SC12 and SC13's child: the real derivers and the rule, with Neo4j, the LMDB store and the resolver stubbed in
 * require.cache. The stubbed database answers each statement by the parameters it takes, as a graph holding one node
 * (tapestryKey k, its json tag and the concepts of the case) would: $keys, the class-thread walk of _fields.js
 * (conceptsOfNodes), from the case's `threads` alone; $key with a JSON schema, E1, from the case's `schemas`, counting
 * each read; $key with GraphChange, E4, the node's name, uuid and json tag; $elementId with a JSON schema, the derive
 * step's own query today (word.js:100–117), the class thread's headers and those a z tag names (`zNamed`); the json
 * tag's value; and the derive pass's list of nodes (`list`). Everything else is an empty answer. The store keeps what is
 * put.
 */
function deriveChild(cases, { pass = null } = {}) {
  const dir = tmp('element-schemas-derive-');
  const script = path.join(dir, 'child.js');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(script, `'use strict';
const path = require('path');
const ROOT = ${JSON.stringify(ROOT)};
const out = { cases: [], e1Reads: {} };
const stub = (rel, exports) => { const f = require.resolve(path.join(ROOT, rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports }; };
let current = null;
const rowsFor = (q, p) => {
  const text = String(q);
  p = p || {};
  if (Array.isArray(p.keys)) return p.keys.flatMap((key) => current.threads.map((c) => ({ concept: c, key })));
  if (typeof p.key === 'string' && /IS_THE_JSON_SCHEMA_FOR/.test(text)) {
    out.e1Reads[p.key] = (out.e1Reads[p.key] || 0) + 1;
    const nodes = current.schemas[p.key] || [];
    const head = { name: current.names[p.key] || p.key, uuid: p.key + '-address' };
    if (!nodes.length) return [{ ...head, schema: null, schemaUuid: null, json: null }];
    return nodes.map((n) => ({ ...head, schema: n.key, schemaUuid: n.uuid, json: n.json }));
  }
  if (typeof p.key === 'string' && /GraphChange/.test(text)) return p.key === current.node.tapestryKey ? [{ name: current.node.name, uuid: current.node.uuid, json: current.json }] : [];
  if (/tag\\.value AS value/.test(text)) return current.json === undefined ? [] : [{ value: current.json }];
  if (p.elementId !== undefined && /IS_THE_JSON_SCHEMA_FOR/.test(text)) {
    return [...current.threads, ...current.zNamed].flatMap((c) => (current.schemas[c] || []).map((n) => ({ schemaUuid: n.uuid, schemaTapestryKey: n.key, conceptName: current.names[c] || c, conceptTapestryKey: c, schemaJson: n.json })));
  }
  if (/tapestryKey IS NOT NULL/.test(text)) return current.list || [];
  return [];
};
stub('src/lib/neo4j-driver', { runCypher: async (q, p) => rowsFor(q, p), writeCypher: async () => [] });
const mem = new Map();
stub('src/lib/tapestry-store', {
  get: (key) => mem.get(key),
  put: async (key, data, meta) => { const env = { updatedAt: 1, ...(meta || {}), data }; mem.set(key, env); return env; },
  remove: async (key) => mem.delete(key),
});
stub('src/lib/tapestry-resolve', { isLmdbRef: () => false, resolveValue: () => null, resolveDeep: (v) => v });
const sectionOf = (text) => { const o = JSON.parse(text); const s = o.jsonSchema && typeof o.jsonSchema === 'object' ? o.jsonSchema : o; const { $schema, ...rest } = s; return rest; };
(async () => {
  try {
    const deriveWord = require(path.join(ROOT, 'src/lib/derivers/word.js'));
    const deriveSet = require(path.join(ROOT, 'src/lib/derivers/set.js'));
    const X = require(${JSON.stringify(SCHEMAS)});
    const rule = require(path.join(ROOT, 'src/operations/rules/index.js')).findRule('element-fits-schema');
    if (!rule) throw new Error('the rule element-fits-schema is not loaded');
    const store = require(path.join(ROOT, 'src/lib/tapestry-store'));
    const read = async (q, p) => rowsFor(q, p);
    for (const c of ${JSON.stringify(cases)}) {
      mem.clear();
      current = { node: { tapestryKey: 'k', uuid: 'u', name: 'n', elementId: 'e', labels: c.labels || ['ListItem'] }, json: c.json === undefined ? undefined : JSON.stringify(c.json), threads: c.threads || ['ck'], zNamed: c.zNamed || [], schemas: c.schemas, names: { ck: 'c', zk: 'z' } };
      if (c.stored !== undefined) await store.put('k', c.stored);
      const derived = await (c.set ? deriveSet : deriveWord)({ ...current.node });
      await store.put('k', derived);
      const found = await rule.violations([{ node: 'k' }], read);
      out.cases.push({
        label: c.label,
        entries: (derived && derived.graphContext && derived.graphContext.parentJsonSchemas) || null,
        findings: found.map((v) => ({ concept: v.concept || null, code: v.code, missing: v.missing === true, message: v.message, problems: (v.problems || []).map((x) => x.message) })),
        judgedAfter: c.judgeAfter ? X.problemsOf(sectionOf(c.judgeAfter), derived) : null,
      });
    }
    ${pass ? `
    mem.clear();
    for (const key of Object.keys(out.e1Reads)) delete out.e1Reads[key];
    const p = ${JSON.stringify(pass)};
    current = { node: { tapestryKey: 'k1', uuid: 'u1', name: 'n1', elementId: 'e1', labels: ['ListItem'] }, json: JSON.stringify(p.json), threads: ['ck'], zNamed: [], schemas: p.schemas, names: { ck: 'c' },
      list: [1, 2, 3].map((i) => ({ tapestryKey: 'k' + i, uuid: 'u' + i, name: 'n' + i, slug: null, kind: 39999, pubkey: 'p', labels: ['ListItem'], elementId: 'e' + i })) };
    require(path.join(ROOT, 'src/lib/derivers/index.js')).registerAll();
    const D = require(path.join(ROOT, 'src/lib/tapestry-derive.js'));
    out.pass = await D.deriveAll('ListItem');
    out.passReads = { ...out.e1Reads };
    out.passEntries = [1, 2, 3].map((i) => { const env = mem.get('k' + i); return env && env.data && env.data.graphContext ? env.data.graphContext.parentJsonSchemas : null; });
    ` : ''}
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
  return { byLabel: Object.fromEntries(out.cases.map((c) => [c.label, c])), out };
}

const fw = (c) => fs.readFileSync(path.join(ROOT, `firmware/versions/v1.0.0/concepts/${c}/json-schema.json`), 'utf8');
const BEAGLE_SCHEMA = JSON.stringify({ jsonSchema: { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', required: ['beagle'], properties: { beagle: { type: 'object', required: ['name', 'slug', 'description'], properties: { name: { type: 'string' }, slug: { type: 'string' }, description: { type: 'string' } } } } } });
const beagleJson = (description) => ({ word: { slug: 'beagle--max', name: 'beagle: Max', title: 'Beagle: Max', wordTypes: ['word', 'beagle'] }, beagle: { name: 'Max', slug: 'max', ...(description === undefined ? {} : { description }) } });
const one = (json) => ({ ck: [{ key: 'sk', uuid: 's', json }] });

/** The rule's verdict on concept ck from its findings: true with none, false for invalid-fields, null for no-schema. */
const ruleVerdict = (c, concept = 'ck') => {
  const f = c.findings.filter((x) => x.concept === concept);
  if (!f.length) return true;
  return f[0].code === 'no-schema' ? null : f[0].code === 'invalid-fields' ? false : `code ${f[0].code}`;
};
const entryOf = (c, concept = 'ck') => (c.entries || []).filter((e) => e.conceptTapestryKey === concept);

let DERIVED = null;
function derivedCases() {
  needSchemas();
  if (DERIVED) return DERIVED;
  DERIVED = deriveChild([
    { label: 'beagle fits', schemas: one(BEAGLE_SCHEMA), json: beagleJson('a dog'), want: true },
    { label: 'beagle misses', schemas: one(BEAGLE_SCHEMA), json: beagleJson(undefined), want: false },
    { label: 'dog in its set', schemas: one(fw('dog')), json: { word: { slug: 'dog--rover', name: 'dog: Rover', title: 'Dog: Rover', wordTypes: ['word', 'dog', 'goldenRetriever'] }, dog: { name: 'Rover', slug: 'rover', breed: 'goldenRetriever' } }, want: true },
    { label: 'dog outside it', schemas: one(fw('dog')), json: { word: { slug: 'dog--fido', name: 'dog: Fido', title: 'Dog: Fido', wordTypes: ['word', 'dog'] }, dog: { name: 'Fido', slug: 'fido', breed: 'goldenRetriever' } }, want: false },
    { label: 'word', schemas: one(fw('word')), json: { word: { slug: 'word--lexeme', name: 'word: Lexeme', title: 'Word: Lexeme', wordTypes: ['word'] } }, want: true, judgeAfter: fw('word') },
    { label: 'closed top', schemas: one(JSON.stringify({ jsonSchema: { type: 'object', properties: { word: {}, beagle: {} }, additionalProperties: false } })), json: beagleJson('a dog'), want: false },
    { label: 'a word default', schemas: one(fw('validation-tool')), json: { word: { name: 'checker', wordTypes: ['word', 'validationTool'] } }, want: true },
    { label: 'built before the json tag changed', schemas: one(BEAGLE_SCHEMA), json: beagleJson('a description the tag gained later'), stored: beagleJson(undefined), want: false },
    { label: "a schema that doesn't compile", schemas: one(JSON.stringify({ jsonSchema: { type: 'nonsense' } })), json: beagleJson('a dog'), want: null },
    { label: 'a concept only a z tag names', schemas: { ...one(BEAGLE_SCHEMA), zk: [{ key: 'zsk', uuid: 'zs', json: JSON.stringify({ jsonSchema: { type: 'object', required: ['zebra'] } }) }] }, zNamed: ['zk'], json: beagleJson('a dog'), want: true },
    { label: 'two schema nodes', schemas: { ck: [{ key: 'sk1', uuid: 's1', json: BEAGLE_SCHEMA }, { key: 'sk2', uuid: 's2', json: BEAGLE_SCHEMA }] }, json: beagleJson('a dog') },
    { label: 'no schema node', schemas: { ck: [] }, json: beagleJson('a dog') },
    { label: 'the set deriver', set: true, labels: ['Set'], schemas: one(BEAGLE_SCHEMA), json: { word: { slug: 'the-set-of-show-beagles', name: 'the set of show beagles', wordTypes: ['word', 'set'] }, set: { slug: 'show-beagles', name: 'show beagles' }, beagle: { name: 'Show', slug: 'show' } } },
    { label: 'a set entry with an old artifact', set: true, labels: ['Set'], schemas: one(JSON.stringify({ jsonSchema: { type: 'object', properties: { word: {}, set: {}, graphContext: {} }, additionalProperties: false } })),
      json: { word: { slug: 'the-set-of-old-beagles', name: 'the set of old beagles', wordTypes: ['word', 'set'] }, set: { slug: 'old-beagles', name: 'old beagles' } },
      stored: { word: { slug: 'the-set-of-old-beagles', name: 'the set of old beagles', wordTypes: ['word', 'set'] }, set: { slug: 'old-beagles', name: 'old beagles' }, 'x-tapestry': { derived: { by: 'an older deriver' } } } },
  ], { pass: { schemas: one(BEAGLE_SCHEMA), json: beagleJson('a dog') } });
  return DERIVED;
}

test('SC14: a judge drops a schema read that failed, so the next check of that concept reads its schema again', () => {
  const f = got().flaky || {};
  assert(/^threw/.test(String(f.first)), `the first check meets the failed read and throws, as any read failure does; got ${show(f.first)}`);
  assert(f.second && !f.second.threw && f.second.fits === true, `the next check of the same concept, with the same judge, reads the schema again and fits: a derive pass's shared judge doesn't keep one hiccup for the rest of the pass (review round 1, non-blocking 1); got ${show(f.second)}`);
});

test('SC9: one verdict from both readers: the derive step\'s cached verdicts and the rule\'s check of what it kept agree on each concept, in the rule\'s words', () => {
  const { byLabel } = derivedCases();
  const AC3 = ['beagle fits', 'beagle misses', 'dog in its set', 'dog outside it', 'word', 'closed top', 'a word default', 'built before the json tag changed', "a schema that doesn't compile", 'a concept only a z tag names'];
  const wants = { 'beagle fits': true, 'beagle misses': false, 'dog in its set': true, 'dog outside it': false, word: true, 'closed top': false, 'a word default': true, 'built before the json tag changed': false, "a schema that doesn't compile": null, 'a concept only a z tag names': true };
  for (const label of AC3) {
    const c = byLabel[label];
    assert(c, `case ${label} ran`);
    const entries = entryOf(c);
    assert(entries.length === 1, `${label}: the cache holds one verdict for the concept the class thread reaches; got ${show(c.entries)}`);
    const e = entries[0];
    const rv = ruleVerdict(c);
    const want = wants[label];
    assert(e.valid === want && rv === want, `${label}: the derive step and the rule agree, ${want === null ? 'not checkable' : want ? 'fitting' : 'not fitting'} (story 42, AC3); got the cache's ${show(e.valid)} ${show(e.errors)}, the rule's ${show(rv)} ${show(c.findings)}`);
    if (want === false) {
      const f = c.findings.find((x) => x.concept === 'ck');
      assert(show([...e.errors].sort()) === show([...f.problems].sort()) && e.errors.length > 0, `${label}: the cache's errors are the rule's problems, in its words; got ${show(e.errors)} beside ${show(f.problems)}`);
    }
    if (want === null) {
      const f = c.findings.find((x) => x.concept === 'ck');
      assert(e.errors.length === 1 && f && String(f.message).includes(e.errors[0]), `${label}: the cache's one error is the rule's problem; got ${show(e.errors)} beside ${show(f)}`);
    }
    assert(c.findings.every((x) => x.missing !== true), `${label}: what the derive step built is in the store, so nothing is missing; got ${show(c.findings)}`);
  }
  assert(/graphContext/.test(show(byLabel['closed top'].entries[0].errors)), 'closed top: the tapestryJson the store keeps has a graphContext, which a schema closed at the top refuses');
  const z = byLabel['a concept only a z tag names'];
  assert(entryOf(z, 'zk').length === 0 && !z.findings.some((x) => x.concept === 'zk'), `a concept only a z tag names is judged by neither: membership is the edges (ADR 0042 Decision 5); got ${show(z.entries)} ${show(z.findings)}`);
});

test('SC12: the derivers\' cached verdicts: today\'s shape, naming the schema node; two schema nodes, one each, not checkable; no schema node, none; filling them in changes no verdict', () => {
  const { byLabel } = derivedCases();
  const e = entryOf(byLabel['beagle misses'])[0];
  assert(e && e.uuid === 's' && e.tapestryKey === 'sk' && e.conceptName === 'c' && e.conceptTapestryKey === 'ck' && typeof e.lastValidated === 'number' && e.valid === false && Array.isArray(e.errors) && e.errors.every((x) => typeof x === 'string'),
    `an entry is { uuid, tapestryKey } of the schema node, { conceptName, conceptTapestryKey } of the concept, lastValidated, valid and errors (ADR 0042 Decision 5); got ${show(e)}`);
  const two = entryOf(byLabel['two schema nodes']);
  assert(two.length === 2 && show(two.map((x) => x.tapestryKey).sort()) === show(['sk1', 'sk2']) && two.every((x) => x.valid === null && x.errors.length === 1 && /more than one/.test(x.errors[0])),
    `a concept with two schema nodes: one entry for each, not checkable, with the rule's problem (rule 11); got ${show(byLabel['two schema nodes'].entries)}`);
  assert(entryOf(byLabel['no schema node']).length === 0, `a concept with no schema node has no entry: the list is of schemas; got ${show(byLabel['no schema node'].entries)}`);
  const set = byLabel['the set deriver'];
  const se = entryOf(set)[0];
  const sf = set.findings.find((x) => x.concept === 'ck');
  assert(se && se.valid === false && sf && show([...se.errors].sort()) === show([...sf.problems].sort()) && se.errors.some((x) => /beagle\.description/.test(x)),
    `the set deriver's verdicts are the rule's too, in its words; got ${show(set.entries)} beside ${show(set.findings)}`);
  const old = byLabel['a set entry with an old artifact'];
  const oe = entryOf(old)[0];
  assert(oe && oe.valid === true && ruleVerdict(old) === true, `a set entry still carrying x-tapestry.derived: the set deriver removes it before it judges, so its verdict is on what it stores, and agrees with the rule's check of that; got the cache's ${show(oe)}, the rule's ${show(old.findings)}`);
  const after = byLabel.word.judgedAfter;
  assert(after && !after.problem && show(after.problems) === show([]), `the stored tapestryJson, its entries filled in, still fits firmware word's schema: filling them changes no verdict; got ${show(after)}`);
});

test('SC13: a derive pass over a label reads each concept\'s schema once, however many nodes it derives; schema-verdicts.js opens nothing when loaded', () => {
  const { out } = derivedCases();
  assert(out.pass && out.pass.derived === 3 && out.pass.errors === 0, `deriveAll('ListItem') derives the three nodes it lists; got ${show(out.pass)}`);
  assert(out.passReads && out.passReads.ck === 1, `one pass reads ck's schema once, not once a node (ADR 0042 Decision 6); got ${show(out.passReads)}`);
  assert(Array.isArray(out.passEntries) && out.passEntries.every((x) => Array.isArray(x) && x.length === 1 && x[0].valid === true), `and each node of the pass has its verdict; got ${show(out.passEntries)}`);
  const file = path.join(ROOT, 'src/lib/derivers/schema-verdicts.js');
  assert(fs.existsSync(file), 'src/lib/derivers/schema-verdicts.js exists (ADR 0042 Decision 5)');
  const probe = spawnSync(process.execPath, ['-e', `const before = new Set(Object.keys(require.cache)); require(${JSON.stringify(file)}); process.stdout.write(JSON.stringify(Object.keys(require.cache).filter((f) => !before.has(f) && /[\\\\/]ajv[\\\\/]|_schemas\\.js|_fields\\.js|[\\\\/]lmdb[\\\\/]/.test(f))));`], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('schema-verdicts-load-')), timeout: 60000 });
  assert(probe.status === 0 && probe.stdout === '[]', `requiring it loads no ajv, _schemas.js, _fields.js or LMDB: they are required when first called (ADR 0042 Implementation notes); got ${probe.status} ${probe.stdout} ${(probe.stderr || '').slice(-300)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
