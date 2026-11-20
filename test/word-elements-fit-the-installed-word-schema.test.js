'use strict';
/**
 * An element of `word` fits the `word` schema an install leaves — graph-operations-first-slice #46 (a bug; Loom P-156).
 *   Story: engineering-team/stories/graph-operations-first-slice/46-word-elements-fit-the-installed-word-schema.md
 *   Plan:  engineering-team/stories/graph-operations-first-slice/46-word-elements-fit-the-installed-word-schema.test-plan.md
 *   ADR:   none (Architecture skipped as obvious, the owner's choice when approving the story, 2026-11-20)
 *
 * Stack-free (every run, CI included). The install's own code runs in a child process (test/helpers/saveSchemaChild.js)
 * over a fake graph (test/helpers/pathCypherFake.js), with firmware's real manifest and schema files: its enumeration
 * step, POST /api/normalize/apply-enumerations, and Pass 2 of a reinstall. What the step left in a schema is read from
 * the json it wrote there. Nodes are judged here, over the same fake graph, by the one check the rule
 * element-fits-schema, the writes and the derive step share (src/operations/catalog/graph/_schemas.js).
 *   W1  after the enumeration step, nodes whose wordTypes are right fit word's schema once their graphContext is built [AC1]
 *   W2a the JSON graph create-set and graph create-element build: word waits for the derive step, with no problems   [AC2]
 *   W2b the derive step's cached verdict for word on those two nodes' tapestryJson: valid, with no errors            [AC2]
 *   W3a sentinel: a word type the install doesn't know still fails, naming its entry (the allowed list stays)         [AC3]
 *   W3b sentinel: a set whose graphContext lacks the set fields still fails (the set conditional stays)               [AC3]
 *   W3c sentinel: dog's pair still holds both ways after the enumeration step                                        [AC3]
 *   W4  a reinstall (Pass 2, then the enumeration step) over word's schema as an affected instance holds it: no pair
 *       compares wordTypes with itself, the set conditional and the allowed list stay, and older nodes fit           [AC4]
 *   W5a the ledger row closes                                                                                         [AC5]
 *   W5b sentinel: the manifest's switch, which the Firmware Explorer page shows, is on for an enumeration exactly when
 *       the enumeration step writes it a pair                                                                         [AC5]
 * BIBLE §6's account of install's enumerations (AC5) is prose, checked at Review.
 *
 *   node test/word-elements-fit-the-installed-word-schema.test.js
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CHILD = path.join(__dirname, 'helpers/saveSchemaChild.js');
const FIRMWARE = path.join(ROOT, 'firmware/active');
const LEDGER_ROW = path.join(ROOT, 'ledger/2026-11-17-word-wordtypes-conditionals-contradict-themselves.md');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const short = (x, n = 600) => { const s = typeof x === 'string' ? x : JSON.stringify(x); return s && s.length > n ? `${s.slice(0, n)}…` : s; };

/* ───────────── nothing here may reach a real service ───────────── */

// The child runs the install's code, which reaches the database and the control panel, so it gets a conf whose Neo4j is
// a closed port, and every other endpoint a closed port too, as test/schema-save-finds-the-right-header.test.js gives
// its child. Were the child's stub of the driver ever bypassed, the driver reads its address only from the conf file,
// and with none falls back to bolt://localhost:7687, which on the owner's Mac is the agent-memory instance.
// This process sets nothing in process.env. The gate loads every suite into one process before running any
// (test/helpers/gateRunner.js), so a value set here would reach every other suite (review round 1, blocking 1). It needs
// none: the check and the builders open nothing when they load (their headers say so), and every read they make here is
// given to them, over the fake graph; the derive step's schemaVerdicts is given its read and its judge.
const DEAD_CONF = path.join(os.tmpdir(), `word-schema-dead-${process.pid}.conf`);
fs.writeFileSync(DEAD_CONF, 'NEO4J_URI="bolt://127.0.0.1:9"\nNEO4J_USER="none"\nNEO4J_PASSWORD="none"\n');
process.on('exit', () => { try { fs.unlinkSync(DEAD_CONF); } catch { /* already gone */ } });
const DEAD = { BRAINSTORM_CONF_PATH: DEAD_CONF, NEO4J_URI: 'bolt://127.0.0.1:9', TAPESTRY_API_BASE: 'http://127.0.0.1:9', BRAINSTORM_BASE_URL: 'http://127.0.0.1:9', TAPESTRY_PORT: '9', MEILI_URL_HOST: 'http://127.0.0.1:9', TAPESTRY_CONTAINER: 'no-such-container' };

const { runPathQuery } = require('./helpers/pathCypherFake');
const X = require(path.join(ROOT, 'src/operations/catalog/graph/_schemas'));
const { setJson } = require(path.join(ROOT, 'src/operations/catalog/graph/_sets'));
const { elementJson } = require(path.join(ROOT, 'src/operations/catalog/graph/_elements'));
const { schemaVerdicts } = require(path.join(ROOT, 'src/lib/derivers/schema-verdicts'));
const { relAlias } = require(path.join(ROOT, 'src/api/normalize/firmware'));

/* ───────────── firmware, as the install reads it ───────────── */

const MANIFEST = JSON.parse(fs.readFileSync(path.join(FIRMWARE, 'manifest.json'), 'utf8'));
const fileSchema = (slug) => {
  const c = MANIFEST.concepts.find((x) => x.slug === slug);
  return JSON.parse(fs.readFileSync(path.join(FIRMWARE, c.dir, c.jsonSchema), 'utf8')).jsonSchema;
};
const ENUMS = Object.values(MANIFEST.enumerations).flatMap((e) => e['existing-nodes']);
const enumOf = (concept) => ENUMS.find((n) => n.concept === concept);
const WORD_ENUM = enumOf('word'); // concept-headers → word.wordTypes
const DOG_ENUM = enumOf('dog'); // dog-breeds → dog.breed
const switchOn = (def) => def['enforce-wordType-conditionals'] === true;

/** The concept keys the fixture's concept-header superset holds: what the install sends to word.wordTypes. */
const KEYS = ['word', 'set', 'superset', 'jsonSchema', 'validationTool', 'relationshipType', 'conceptHeader', 'dog', 'dogBreed', 'graph'];
const BREEDS = ['goldenRetriever', 'irishSetter'];

/* ───────────── the fake graph ───────────── */

const TA_PRIVKEY = '46'.repeat(32);
const nt = require(path.join(ROOT, 'node_modules/nostr-tools'));
const TA = nt.getPublicKey(Uint8Array.from(Buffer.from(TA_PRIVKEY, 'hex')));

/** A tapestryKey as keyNode mints one (a version 4 UUID), made from `seed` so a test's graph is the same every run. */
function keyOf(seed) {
  const h = crypto.createHash('sha256').update(String(seed)).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${'89ab'[parseInt(h[16], 16) % 4]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
/** { a: { b: v } } from 'a.b' and v. */
const objectAt = (dotted, v) => dotted.split('.').reduceRight((inner, part) => ({ [part]: inner }), v);

/**
 * A graph laid out as an install leaves one, for the parts this story reads:
 *   - firmware concepts of the instance's own (a header and its JSON schema node, whose json tag holds `jsonSchema`);
 *   - `word`'s class thread (header → superset), whose superset holds the nodes `member` adds;
 *   - the enumerations install wires (src/firmware/install.js): a superset whose elements' Tapestry JSON hold their
 *     values at the manifest's source path, ENUMERATES the target concept's JSON schema node, naming both paths.
 */
function makeGraph() {
  const nodes = [];
  const rels = [];
  const store = {};
  const eidOf = new Map();
  let seq = 0;
  const eid = (p) => `${p}-${seq++}`;
  const node = (labels, props, tags = []) => {
    const e = eid('n');
    nodes.push({ eid: e, labels: [...labels, 'TapestryNode'], props: { tapestryKey: keyOf(props.uuid || e), ...props } });
    for (const [type, value] of tags) {
      const t = eid('t');
      nodes.push({ eid: t, labels: ['NostrEventTag', 'TapestryNode'], props: { uuid: `tag-${t}`, tapestryKey: keyOf(`tag-${t}`), type, value } });
      rels.push({ eid: eid('r'), type: 'HAS_TAG', from: e, to: t, props: {} });
    }
    if (props.uuid) eidOf.set(props.uuid, e);
    return e;
  };
  const rel = (type, from, to, props = {}) => rels.push({ eid: eid('r'), type, from, to, props });
  const keyAt = (e) => nodes.find((n) => n.eid === e).props.tapestryKey;
  const event = (kind, d) => ({ uuid: `${kind}:${TA}:${d}`, kind, pubkey: TA, id: `event-${kind}-${d}` });

  const g = {
    nodes, rels, store,
    concept({ slug, name, jsonSchema }) {
      const h = event(39998, slug);
      const hEid = node(['NostrEvent', 'ListHeader', 'ConceptHeader'], { ...h, name }, [['d', slug], ['name', name], ['slug', slug]]);
      const s = event(39999, `${slug}-json-schema`);
      const wrapper = { word: { slug: `json-schema-for-the-concept-of-${slug}`, name: `JSON schema for the concept of ${name}`, wordTypes: ['word', 'jsonSchema'], coreMemberOf: [{ slug: `concept-header-for-the-concept-of-${slug}`, uuid: h.uuid }] }, jsonSchema };
      const sEid = node(['NostrEvent', 'ListItem', 'JSONSchema'], { ...s, name: `json schema for the concept of ${name}` },
        [['d', `${slug}-json-schema`], ['name', `json schema for the concept of ${name}`], ['json', JSON.stringify(wrapper)]]);
      rel(relAlias('CORE_NODE_JSON_SCHEMA'), sEid, hEid);
      const made = { header: h.uuid, key: keyAt(hEid), schema: s.uuid, hEid };
      if (slug === 'word') {
        const sup = event(39999, 'word-superset');
        made.superset = node(['NostrEvent', 'ListItem', 'Superset'], { ...sup, name: 'superset for the concept of words' }, [['d', 'word-superset']]);
        rel(relAlias('CLASS_THREAD_INITIATION'), hEid, made.superset);
      }
      return made;
    },
    /** A node in `word`'s class thread, as the derive step finds one: an element of word's superset. Its tapestryKey. */
    member(word, d, name) {
      const e = node(['NostrEvent', 'ListItem'], { ...event(39999, d), name }, [['d', d], ['name', name]]);
      rel(relAlias('CLASS_THREAD_TERMINATION'), word.superset, e);
      return keyAt(e);
    },
    enumeration({ d, def, values, schemaUuid }) {
      const supEid = node(['NostrEvent', 'ListItem', 'Superset'], { ...event(39999, d), name: d }, [['d', d], ['name', d]]);
      for (const v of values) {
        const elEid = node(['NostrEvent', 'ListItem'], { ...event(39999, `${d}-${v}`), name: v }, [['d', `${d}-${v}`], ['name', v]]);
        rel(relAlias('CLASS_THREAD_TERMINATION'), supEid, elEid);
        store[keyAt(elEid)] = objectAt(def['source-path'], v);
      }
      rel('ENUMERATES', supEid, eidOf.get(schemaUuid), { sourcePath: def['source-path'], destinationPath: def['destination-path'] });
    },
    /** The json tag value a node holds now. */
    jsonOf(uuid) {
      const e = eidOf.get(uuid);
      const tag = rels.filter((r) => r.type === 'HAS_TAG' && r.from === e).map((r) => nodes.find((n) => n.eid === r.to)).find((n) => n.props.type === 'json');
      return tag ? tag.props.value : undefined;
    },
    /** Puts the json a run wrote on each node into this graph, as the database would hold it after the run. */
    takeWrites(out) {
      for (const w of out.writes) {
        if (!w.params || w.params.type !== 'json' || typeof w.params.eventUuid !== 'string') continue;
        const e = eidOf.get(w.params.eventUuid);
        if (!e) continue;
        const tag = rels.filter((r) => r.type === 'HAS_TAG' && r.from === e).map((r) => nodes.find((n) => n.eid === r.to)).find((n) => n.props.type === 'json');
        if (tag) tag.props.value = w.params.value;
      }
    },
    /** A read over this graph, as _schemas.js and _fields.js make theirs. */
    read() {
      const types = ['HAS_TAG', 'ENUMERATES', ...['CORE_NODE_JSON_SCHEMA', 'CLASS_THREAD_INITIATION', 'CLASS_THREAD_PROPAGATION', 'CLASS_THREAD_TERMINATION'].map(relAlias)];
      return async (cypher, params) => runPathQuery({ nodes, rels }, cypher, params || {}, { types });
    },
  };
  return g;
}

/** Firmware's word schema, as an install leaves it on an affected instance (david.tapestry.ninja on 2026-11-20 held 47
 * keys): the allowed list on wordTypes' entries, and a Forward and a Reverse conditional for each key. */
function affectedWordSchema(keys) {
  const s = JSON.parse(JSON.stringify(fileSchema('word')));
  s.properties.word.properties.wordTypes.items = { type: 'string', enum: [...keys].sort() };
  const is = (k) => ({ properties: { word: { properties: { wordTypes: { const: k } }, required: ['wordTypes'] } } });
  const holds = (k) => ({ properties: { word: { properties: { wordTypes: { contains: { const: k } } } } } });
  s.allOf = [...(s.allOf || []), ...keys.flatMap((k) => [
    { $comment: `Forward: if word.wordTypes is ${k}, wordTypes must contain it`, if: is(k), then: holds(k) },
    { $comment: `Reverse: if wordTypes contains ${k}, word.wordTypes must be ${k}`, if: holds(k), then: is(k) },
  ])];
  return s;
}

/* ───────────── the child ───────────── */

function child(scenario) {
  const r = spawnSync(process.execPath, [CHILD], {
    input: JSON.stringify({ taPrivkey: TA_PRIVKEY, ...scenario }),
    encoding: 'utf8', env: { ...process.env, ...DEAD }, maxBuffer: 64 << 20, timeout: 120000,
  });
  const at = (r.stdout || '').lastIndexOf('@@RESULT@@');
  assert(at >= 0, `the child process printed no result (exit ${r.status}): ${short(r.stderr || r.stdout, 800)}`);
  const out = JSON.parse(r.stdout.slice(at + 10).split('\n')[0]);
  assert(!out.error, `the install's code threw in the child process: ${short(out.error, 1000)}`);
  assert(out.taPubkey === TA, `the child's Tapestry Assistant is ${out.taPubkey}, not the test's ${TA}`);
  return out;
}
const why = (out, answer) => `${short(answer, 500)}${out.unread.length ? ` — reads the fake graph couldn't run: ${short(out.unread, 600)}` : ''}`;

/** The enumeration step, POST /api/normalize/apply-enumerations, over `g`; its writes are then taken into `g`. */
function enumerate(g, expected) {
  const out = child({ kind: 'applyEnumerations', graph: { nodes: g.nodes, rels: g.rels }, store: g.store, body: {} });
  const answer = out.results[0];
  assert(answer.statusCode === 200 && answer.body && answer.body.success === true, `the enumeration step must answer success; ${why(out, answer)}`);
  assert(answer.body.updated === expected, `the enumeration step must save the ${expected} schema(s) it enumerated; it saved ${answer.body.updated}: ${why(out, (answer.body.log || []).filter((l) => /❌|⚠️|Save|Generated|Injected/.test(l)))}`);
  g.takeWrites(out);
  return out;
}

/* ───────────── the nodes, and judging them ───────────── */

/** A graphContext in the shape the derive step builds, with a set's three fields when `set`. */
const graphContext = (key, set = false) => ({
  identifiers: { tapestryKey: key, uuid: `39999:${TA}:${key}` },
  elementOf: { direct: [], indirect: [] },
  parentJsonSchemas: [],
  derivedAt: 1794813782,
  ...(set ? { elements: { direct: [], indirect: [] }, childSets: { direct: [], indirect: [] }, parentSets: { direct: [], indirect: [] } } : {}),
});
const wordNode = (wordTypes, ctx) => ({ word: { slug: 'a-word', name: 'a word', wordTypes }, ...(ctx ? { graphContext: ctx } : {}) });

/** The JSON graph create-element builds for a relationship type, as the owner's run made "class thread validation". */
const RELATIONSHIP_TYPE_HEADER = { json: { conceptHeader: { oTitles: { singular: 'Relationship Type' } } }, names: { singular: 'relationship type' }, oKey: 'relationshipType', slug: 'relationship-type' };
const relationshipTypeJson = () => elementJson({
  header: RELATIONSHIP_TYPE_HEADER, name: 'class thread validation', slug: 'class-thread-validation', others: ['word'],
  fields: [['alias', 'IS_THE_VALIDATION_NODE_FOR'], ['title', 'Class Thread Validation'], ['nodeFromType', 'validationTool'], ['nodeToType', 'conceptHeader'], ['category', 'classThreadValidation']],
});
/** The JSON graph create-set builds, as the owner's run made its set of relationship types. */
const setOfTypesJson = () => setJson({ name: 'relationship types for class thread validation', slug: 'relationship-types-for-class-thread-validation', description: 'The relationship types that run from a validation node to a concept header.', others: [] });

const listed = (r) => (r.problems || []).map((p) => `[${p.path}] ${p.message}`).join(' | ') || r.problem || '(none)';
/** Problems that compare wordTypes with itself: a const on wordTypes, or the "then" a failed conditional reports. */
const selfComparing = (r) => (r.problems || []).filter((p) => (p.path === 'word.wordTypes' && /equal to constant/.test(p.message)) || /must match "then" schema/.test(p.message));

/** The schema at a dotted path under `properties`, or undefined. */
function at(schema, dotted) {
  let s = schema;
  for (const part of dotted.split('.')) {
    if (!s || typeof s !== 'object' || !s.properties || !s.properties[part]) return undefined;
    s = s.properties[part];
  }
  return s;
}
/** Whether an allOf entry ties the field at `field` to word.wordTypes: its `if` and its `then` each constrain one of them.
 * For `word.wordTypes` itself, that is a pair comparing the list with itself. The set conditional's `then` constrains
 * graphContext, so it is never one. */
const ties = (entry, field) => !!entry && !!entry.if && !!entry.then
  && [entry.if, entry.then].every((s) => at(s, field) !== undefined || at(s, 'word.wordTypes') !== undefined);
const savedSchema = (g, uuid) => { const v = g.jsonOf(uuid); return v ? JSON.parse(v).jsonSchema : undefined; };

/* ───────────── the run every check but W4 reads ───────────── */

let FIXTURE = null;
function fixture() {
  if (FIXTURE) return FIXTURE;
  const g = makeGraph();
  const word = g.concept({ slug: 'word', name: 'word', jsonSchema: fileSchema('word') });
  const dog = g.concept({ slug: 'dog', name: 'dog', jsonSchema: fileSchema('dog') });
  g.enumeration({ d: 'concept-header-superset', def: WORD_ENUM, values: KEYS, schemaUuid: word.schema });
  g.enumeration({ d: 'dog-breed-superset', def: DOG_ENUM, values: BREEDS, schemaUuid: dog.schema });
  const typeKey = g.member(word, 'class-thread-validation-c33fd50a', 'class thread validation');
  const setKey = g.member(word, 'relationship-types-for-class-thread-validation-24c42f37', 'relationship types for class thread validation');
  const out = enumerate(g, 2);
  FIXTURE = { g, word, dog, typeKey, setKey, out, read: g.read() };
  return FIXTURE;
}

/* ───────────── the tests ───────────── */

const tests = [];
const t = (name, fn) => tests.push([name, fn]);

t('W1 (AC1): after the install\'s enumeration step, a node whose word types are right fits word\'s schema once its graphContext is built', async () => {
  const { word, read } = fixture();
  const j = X.judge(read);
  const cases = [
    [['word', 'relationshipType'], false],
    [['word', 'set'], true],
    [['word', 'jsonSchema', 'validationTool'], false],
  ];
  for (const [types, set] of cases) {
    const r = await j.check(word.key, wordNode(types, graphContext(keyOf(types.join()), set)));
    assert(r.fits === true, `${JSON.stringify(types)}${set ? ' (a set, its set fields built)' : ''} must fit word's installed schema; the check found: ${listed(r)}`);
    assert(selfComparing(r).length === 0, `no problem may compare ${JSON.stringify(types)} with itself; found ${short(selfComparing(r))}`);
  }
});

t('W2a (AC2): the JSON graph create-set and graph create-element build reports word as waiting for the derive step, with no problems', async () => {
  const { word, read } = fixture();
  for (const [what, json] of [['graph create-set\'s set', setOfTypesJson()], ['graph create-element\'s relationship type', relationshipTypeJson()]]) {
    const r = await X.fits(read, word.key, json);
    assert(r.fits === null && r.waiting === true && r.problems.length === 0,
      `${what} (wordTypes ${JSON.stringify(json.word.wordTypes)}) must report word with fits null, waiting true and no problems; it reported fits ${r.fits}, waiting ${r.waiting}: ${listed(r)}`);
  }
});

t('W2b (AC2): once the derive step has built those nodes\' tapestryJson, its cached verdict for word is valid, with no errors', async () => {
  const { word, read, typeKey, setKey } = fixture();
  const judge = X.judge(read);
  for (const [what, key, json, set] of [['the set', setKey, setOfTypesJson(), true], ['the relationship type', typeKey, relationshipTypeJson(), false]]) {
    const entries = await schemaVerdicts({ tapestryKey: key, json: { ...json, graphContext: graphContext(key, set) }, judge, read, now: 1794813782 });
    const entry = entries.find((e) => e.conceptTapestryKey === word.key);
    assert(entry, `the derive step must give ${what} a verdict for word; it gave ${short(entries)}`);
    assert(entry.valid === true && entry.errors.length === 0, `the derive step's verdict for word on ${what} must be valid with no errors; it is valid ${entry.valid}, errors ${short(entry.errors)}`);
  }
});

t('W3a (AC3, sentinel): a node whose word types hold a key the install doesn\'t know still fails, naming that entry of word.wordTypes', async () => {
  const { word, read } = fixture();
  const r = await X.judge(read).check(word.key, wordNode(['word', 'notAConcept'], graphContext('k-unknown')));
  assert(r.fits === false, `["word","notAConcept"] must still fail word's schema, since the allowed list stays; the check found it fits`);
  assert(r.problems.some((p) => p.path === 'word.wordTypes.1' && /must be one of/.test(p.message)), `the problem must name word.wordTypes.1 and the allowed keys; the check found: ${listed(r)}`);
});

t('W3b (AC3, sentinel): a set whose graphContext lacks the set fields still fails word\'s schema', async () => {
  const { word, read } = fixture();
  const r = await X.judge(read).check(word.key, wordNode(['word', 'set'], graphContext('k-set', false)));
  assert(r.fits === false, 'a set without elements, childSets and parentSets in its graphContext must still fail word\'s schema; the check found it fits');
  for (const field of ['elements', 'childSets', 'parentSets']) {
    assert(r.problems.some((p) => p.message.includes(`graphContext.${field}`)), `a problem must name graphContext.${field}; the check found: ${listed(r)}`);
  }
});

t('W3c (AC3, sentinel): dog\'s pair still holds both ways after the enumeration step', async () => {
  const { dog, read } = fixture();
  const j = X.judge(read);
  const dogNode = (wordTypes, breed) => ({ word: { slug: 'dog--rex', name: 'dog: Rex', wordTypes }, dog: { slug: 'rex', name: 'Rex', breed } });
  const ok = await j.check(dog.key, dogNode(['word', 'dog', 'goldenRetriever'], 'goldenRetriever'));
  assert(ok.fits === true, `a golden retriever that lists goldenRetriever in its word types must fit dog's schema; the check found: ${listed(ok)}`);
  const forward = await j.check(dog.key, dogNode(['word', 'dog'], 'goldenRetriever'));
  assert(forward.fits === false, 'a dog whose breed is goldenRetriever, with no goldenRetriever in its word types, must fail dog\'s schema; the check found it fits');
  const reverse = await j.check(dog.key, dogNode(['word', 'dog', 'goldenRetriever'], 'irishSetter'));
  assert(reverse.fits === false, 'a dog whose word types hold goldenRetriever and whose breed is irishSetter must fail dog\'s schema; the check found it fits');
});

t('W4 (AC4): a reinstall over word\'s schema as an affected instance holds it leaves no pair comparing wordTypes with itself; the set conditional and the allowed list stay, and older nodes fit', async () => {
  const g = makeGraph();
  const word = g.concept({ slug: 'word', name: 'word', jsonSchema: affectedWordSchema(KEYS) });
  g.enumeration({ d: 'concept-header-superset', def: WORD_ENUM, values: KEYS, schemaUuid: word.schema });
  const typeKey = g.member(word, 'class-thread-validation-c33fd50a', 'class thread validation');
  const setKey = g.member(word, 'relationship-types-for-class-thread-validation-24c42f37', 'relationship types for class thread validation');
  const read = g.read();
  const older = [['the relationship type', typeKey, relationshipTypeJson(), false], ['the set', setKey, setOfTypesJson(), true]];

  // The fixture holds the fault an affected instance holds: before the reinstall, the older nodes fail word.
  const before = await X.judge(read).check(word.key, { ...relationshipTypeJson(), graphContext: graphContext(typeKey) });
  assert(before.fits === false && selfComparing(before).length > 0, `the fixture must reproduce the fault before the reinstall; the check found: ${listed(before)}`);

  // Pass 2: each firmware concept's schema saved again from firmware's file.
  const p2 = child({ kind: 'pass2', graph: { nodes: g.nodes, rels: g.rels }, store: g.store });
  const pass2 = p2.results[0];
  assert(pass2 && Array.isArray(pass2.errors) && pass2.errors.length === 0, `Pass 2 must log no errors; ${why(p2, pass2)}`);
  assert(Array.isArray(pass2.updated) && pass2.updated.includes('word'), `Pass 2 must save word's schema; it saved ${short(pass2.updated)}`);
  g.takeWrites(p2);
  // Pass 3's enumeration step.
  enumerate(g, 1);

  const schema = savedSchema(g, word.schema);
  assert(schema, 'the reinstall must leave word a schema');
  const pairs = (schema.allOf || []).filter((e) => ties(e, 'word.wordTypes'));
  assert(pairs.length === 0, `after the reinstall, no conditional in word's schema may compare wordTypes with itself; ${pairs.length} do, among them ${short(pairs.slice(0, 2))}`);
  const j = X.judge(g.read());
  const unknown = await j.check(word.key, wordNode(['word', 'notAConcept'], graphContext('k-unknown')));
  assert(unknown.fits === false && unknown.problems.some((p) => p.path === 'word.wordTypes.1'), `the allowed list must stay: ["word","notAConcept"] must fail, naming word.wordTypes.1; the check found: ${listed(unknown)}`);
  const bare = await j.check(word.key, wordNode(['word', 'set'], graphContext('k-set', false)));
  assert(bare.fits === false && bare.problems.some((p) => p.message.includes('graphContext.elements')), `the set conditional must stay: a set without its set fields must fail; the check found: ${listed(bare)}`);
  for (const [what, key, json, set] of older) {
    const r = await j.check(word.key, { ...json, graphContext: graphContext(key, set) });
    assert(r.fits === true, `${what}, made before the reinstall, must fit word after a derive pass; the check found: ${listed(r)}`);
  }
});

t('W5a (AC5): the ledger row 2026-11-17-word-wordtypes-conditionals-contradict-themselves is closed', () => {
  const row = fs.readFileSync(LEDGER_ROW, 'utf8');
  const status = (row.match(/^\*\*Status:\*\*\s*(.+)$/m) || [])[1];
  const done = (row.match(/^\*\*Done:\*\*\s*(.+)$/m) || [])[1];
  assert(status && /^DONE\b/.test(status.trim()), `the ledger row's Status must be DONE; it is ${short(status)}`);
  assert(done && done.trim() !== '—', `the ledger row's Done line must say when and how it closed; it is ${short(done)}`);
});

t('W5b (AC5, sentinel): the manifest\'s switch, which the Firmware Explorer page shows, is on for an enumeration exactly when the enumeration step writes it a pair', async () => {
  const { g, word, dog } = fixture();
  for (const [def, uuid] of [[WORD_ENUM, word.schema], [DOG_ENUM, dog.schema]]) {
    const field = def['destination-path'];
    const schema = savedSchema(g, uuid);
    const written = (schema.allOf || []).some((e) => ties(e, field));
    assert(written === switchOn(def), `${field}: the manifest's enforce-wordType-conditionals is ${switchOn(def)}, so the Firmware Explorer page says ${switchOn(def) ? '"Yes — biconditional if/then blocks"' : '"No — enum values only"'}, but the enumeration step ${written ? 'writes' : 'writes no'} pair for it`);
  }
});

/* ───────────── run ───────────── */

async function run() {
  console.log('\n=== an element of word fits the word schema an install leaves (graph-operations-first-slice #46) ===');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; } else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\nword-elements-fit-the-installed-word-schema: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
