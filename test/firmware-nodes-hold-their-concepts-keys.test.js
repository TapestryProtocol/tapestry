'use strict';
/**
 * Firmware's nodes, and each new concept's JSON schema, hold the keys of the concepts they belong to (story
 * graph-operations-first-slice #47, part two).
 *   Story: engineering-team/stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.md (AC3, AC4, AC5)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0047-wordtypes-hold-each-concepts-key.md (Decisions 8
 *          to 10)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.test-plan.md
 *
 * Stack-free in every run: firmware's files and manifest, read from the checkout; the old create-concept route's own
 * code, run in a sandbox (test/helpers/todaysCreateConcept.js); the install's Pass 1, run in a child with every call
 * answered in-process (test/helpers/pass1bChild.js); and graph create-concept, run through the real catalog over a fake
 * graph (test/helpers/conceptGraph.js's seed). The live checks of a fresh install and a reinstall are the plan's, on a
 * scratch stack.
 *
 *   FN1  src/api/normalize/firmware.js exports JSON_SCHEMA_WORD_TYPES, frozen: [word, validationTool, jsonSchema]
 *   FN2  every json-schema.json of firmware's concepts holds those word types
 *   FN3  each installed concept's concept-header.json holds [word, conceptHeader] and the keys of the concepts the
 *        manifest's existing-nodes make its header an element of: the eight headers gain nodeType, graphType or
 *        validationToolType; every other header holds no more
 *   FN4  the constant's keys between word and jsonSchema are exactly the concepts whose existing-sets chains reach json
 *        schema, word aside: validationTool
 *   FN5  every json-schema.json, as a node's JSON, fits validation tool's firmware schema
 *   FN6  no file under src/ writes a JSON schema's word types as ['word', 'jsonSchema'], and each of the seven writers
 *        uses the constant
 *   FN7  the old create-concept route makes a JSON schema whose word types are the constant
 *   FN8  the old create-concept route takes wordTypes: the header's are [word, conceptHeader] and the others given, once
 *        each, in order, overwrite or not; without them, [word, conceptHeader]; a list that isn't key-shaped strings is
 *        refused 400, and nothing is signed
 *   FN9  the install's Pass 1a hands each concept's create-concept call its header file's word types, with overwrite
 *   FN10 graph create-concept makes a JSON schema whose word types are the constant
 *   FN11 save-schema, given a schema node whose JSON has no word wrapper, writes one with the constant (test plan,
 *        Amendment 3: review round 1's mutation M11, a fallback that dropped validationTool, got past every suite)
 *
 * skeleton, normalize/json and the property route's schema generator are held by FN6's reading of their source alone:
 * the fake graph can't run their reads (skeleton reads over IS_THE_CORE_GRAPH_FOR, which saveSchemaChild doesn't serve;
 * normalize/json sorts with ORDER BY … DESC; the property route isn't one saveSchemaChild registers). Test plan,
 * Amendment 3.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const FIRMWARE = path.join(REPO, 'firmware/versions/v1.0.0');
const CONCEPTS = path.join(FIRMWARE, 'concepts');
const MANIFEST = path.join(FIRMWARE, 'manifest.json');
const FIRMWARE_JS = path.join(REPO, 'src/api/normalize/firmware.js');
const NORMALIZE = path.join(REPO, 'src/api/normalize/index.js');
const PROPERTY = path.join(REPO, 'src/api/property/index.js');
const CONCEPTS_JS = path.join(REPO, 'src/operations/catalog/graph/_concepts.js');
const CHILD = path.join(__dirname, 'helpers/pass1bChild.js');
const WANT = ['word', 'validationTool', 'jsonSchema'];
// The eight headers firmware's manifest makes elements of another concept (ADR 0047 fact 10, Decision 9).
const HEADER_KEYS = {
  word: ['nodeType'],
  image: ['nodeType'],
  'core-nodes-graph': ['graphType'],
  'concept-graph': ['graphType'],
  'property-tree-graph': ['graphType'],
  tapestry: ['graphType'],
  'json-schema': ['validationToolType'],
  'image-validation-script': ['validationToolType'],
};

function assert(c, m) { if (!c) throw new Error(m); }
const show = (x) => JSON.stringify(x);
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const manifest = () => readJson(MANIFEST);
const installed = () => manifest().concepts.map((c) => ({ slug: c.slug, dir: path.join(FIRMWARE, c.dir) }));
const headerFile = (dir) => readJson(path.join(dir, 'concept-header.json'));
const keyOf = (slug) => {
  const entry = installed().find((c) => c.slug === slug);
  assert(entry, `the manifest installs ${slug}`);
  return headerFile(entry.dir).conceptHeader.oKeys.singular;
};
// As src/firmware/install.js's categoryToSlug.
const categoryToSlug = (category) => ({ properties: 'property', sets: 'set' })[category] || category.replace(/s$/, '');
const constant = () => {
  delete require.cache[require.resolve(FIRMWARE_JS)];
  return require(FIRMWARE_JS).JSON_SCHEMA_WORD_TYPES;
};

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

t('FN1 [Decision 8]: src/api/normalize/firmware.js exports JSON_SCHEMA_WORD_TYPES, frozen: [word, validationTool, jsonSchema]', () => {
  const c = constant();
  assert(Array.isArray(c), `src/api/normalize/firmware.js exports JSON_SCHEMA_WORD_TYPES, a list (ADR 0047 Decision 8); got ${show(c)}`);
  assert(show(c) === show(WANT), `it is ${show(WANT)}, coarse to fine; got ${show(c)}`);
  assert(Object.isFrozen(c), 'it is frozen, so no writer changes it for the next');
});

t('FN2 [AC3, Decisions 8 and 10]: every json-schema.json of firmware\'s concepts holds [word, validationTool, jsonSchema]', () => {
  const files = fs.readdirSync(CONCEPTS).map((d) => path.join(CONCEPTS, d, 'json-schema.json')).filter((p) => fs.existsSync(p));
  assert(files.length >= 41, `firmware holds a json-schema.json for each concept (46 today); got ${files.length}`);
  const off = files.filter((p) => show(readJson(p).word.wordTypes) !== show(WANT)).map((p) => `${path.basename(path.dirname(p))}: ${show(readJson(p).word.wordTypes)}`);
  assert(!off.length, `each one's word.wordTypes is ${show(WANT)}, so firmware's files say what install writes; ${off.length} differ: ${off.slice(0, 6).join('; ')}${off.length > 6 ? ' …' : ''}`);
});

t('FN3 [AC3, Decisions 9 and 10]: each installed header file holds [word, conceptHeader] and the keys of the concepts the manifest\'s existing-nodes put it in', () => {
  const want = {};
  for (const [category, data] of Object.entries(manifest().elements || {})) {
    if (!data || Array.isArray(data)) continue;
    for (const e of data['existing-nodes'] || []) {
      if (e['core-node-type'] !== 'concept-header') continue;
      if (!installed().some((c) => c.slug === e.concept)) continue;
      (want[e.concept] = want[e.concept] || []).push(keyOf(categoryToSlug(category)));
    }
  }
  assert(show(Object.keys(want).sort()) === show(Object.keys(HEADER_KEYS).sort()), `the manifest wires the eight headers the ADR names into another concept; got ${show(want)}`);
  for (const [slug, keys] of Object.entries(HEADER_KEYS)) assert(show(want[slug]) === show(keys), `${slug}'s header is wired into ${show(keys)}; the manifest says ${show(want[slug])}`);
  const off = [];
  for (const c of installed()) {
    const got = headerFile(c.dir).word.wordTypes;
    const expect = ['word', 'conceptHeader', ...(want[c.slug] || [])];
    if (show(got) !== show(expect)) off.push(`${c.slug}: ${show(got)}, not ${show(expect)}`);
  }
  assert(!off.length, `each installed concept-header.json's word.wordTypes is [word, conceptHeader] and its wired keys; ${off.length} differ: ${off.join('; ')}`);
});

t('FN4 [Decision 10]: the constant\'s keys between word and jsonSchema are exactly the concepts whose existing-sets chains reach json schema, word aside', () => {
  const parentsOf = {};
  for (const [category, data] of Object.entries(manifest().sets || {})) {
    if (!data || Array.isArray(data)) continue;
    for (const e of data['existing-sets'] || []) (parentsOf[e.concept] = parentsOf[e.concept] || []).push(categoryToSlug(category));
  }
  const reached = new Set();
  const queue = [...(parentsOf['json-schema'] || [])];
  while (queue.length) { const s = queue.shift(); if (reached.has(s)) continue; reached.add(s); queue.push(...(parentsOf[s] || [])); }
  const keys = [...reached].map(keyOf).filter((k) => k !== 'word').sort();
  const c = constant();
  assert(Array.isArray(c), 'the constant exists (FN1)');
  const middle = c.slice(1, -1).slice().sort();
  assert(c[0] === 'word' && c[c.length - 1] === 'jsonSchema' && show(middle) === show(keys), `the constant is word, the keys of the concepts the manifest makes json schema a set of (${show(keys)}), then jsonSchema; got ${show(c)}`);
});

t('FN5 [AC3, Decision 8]: every json-schema.json, as a node\'s JSON, fits validation tool\'s firmware schema', () => {
  const { problemsOf } = require(path.join(REPO, 'src/operations/catalog/graph/_schemas.js'));
  const vt = readJson(path.join(CONCEPTS, 'validation-tool/json-schema.json')).jsonSchema;
  const schema = { ...vt };
  delete schema.$schema; // as the one check reads a schema: its jsonSchema section, $schema dropped (rulebook entry 7)
  const off = [];
  for (const d of fs.readdirSync(CONCEPTS)) {
    const p = path.join(CONCEPTS, d, 'json-schema.json');
    if (!fs.existsSync(p)) continue;
    const r = problemsOf(schema, readJson(p));
    assert(!r.problem, `validation tool's schema compiles; got ${r.problem}`);
    if (r.problems.length) off.push(`${d}: ${r.problems.map((x) => x.message).join(', ')}`);
  }
  assert(!off.length, `each JSON schema is a validation tool and fits its schema (validationTool among its word types); ${off.length} don't: ${off.slice(0, 4).join('; ')}${off.length > 4 ? ' …' : ''}`);
});

/** The body of the function `name` in `text`: from its declaration to the next top-level function. */
function body(text, name) {
  const at = text.search(new RegExp(`^(async )?function ${name}\\(`, 'm'));
  assert(at >= 0, `the source holds function ${name}`);
  const rest = text.slice(at + 1);
  const end = rest.search(/^(async )?function \w+\(/m);
  return text.slice(at, at + 1 + (end < 0 ? rest.length : end));
}

t('FN6 [AC4, Decision 8]: no file under src/ writes ["word", "jsonSchema"], and each of the seven writers uses the constant', () => {
  const files = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); } else if (p.endsWith('.js')) files.push(p); } };
  walk(path.join(REPO, 'src'));
  const old = /\[\s*(['"])word\1\s*,\s*(['"])jsonSchema\2\s*\]/;
  const hits = files.filter((p) => old.test(fs.readFileSync(p, 'utf8'))).map((p) => path.relative(REPO, p));
  assert(!hits.length, `no writer gives a JSON schema the word types ['word', 'jsonSchema'] any more (ADR 0047 Decision 8); these files still do: ${show(hits)}`);
  const uses = (text) => /JSON_SCHEMA_WORD_TYPES/.test(text);
  const normalize = fs.readFileSync(NORMALIZE, 'utf8');
  const sites = [
    ['src/operations/catalog/graph/_concepts.js (graph create-concept)', fs.readFileSync(CONCEPTS_JS, 'utf8')],
    ['POST /api/normalize/skeleton (handleNormalizeSkeleton)', body(normalize, 'handleNormalizeSkeleton')],
    ['POST /api/normalize/json (handleNormalizeJson)', body(normalize, 'handleNormalizeJson')],
    ['POST /api/normalize/create-concept (handleCreateConcept)', body(normalize, 'handleCreateConcept')],
    ['POST /api/normalize/save-schema (handleSaveSchema)', body(normalize, 'handleSaveSchema')],
    ['the schema generator (src/api/property/index.js handleGenerateJsonSchema)', body(fs.readFileSync(PROPERTY, 'utf8'), 'handleGenerateJsonSchema')],
  ];
  const missing = sites.filter(([, text]) => !uses(text)).map(([where]) => where);
  assert(!missing.length, `each writer of a JSON schema's word block uses JSON_SCHEMA_WORD_TYPES; these don't: ${show(missing)}`);
});

const TA = 'dd'.repeat(32);
const sandboxRoute = () => require(path.join(__dirname, 'helpers/todaysCreateConcept.js'));
const eventJson = (e) => { const tag = (e.tags || []).find((x) => x[0] === 'json'); return tag ? JSON.parse(tag[1]) : null; };
const headerOf = (out) => out.events.find((e) => e.kind === 39998);
const schemaOf = (out) => out.events.find((e) => { const j = eventJson(e); return j && j.jsonSchema !== undefined; });

t('FN7 [AC4, Decision 8]: the old create-concept route makes a JSON schema whose word types are [word, validationTool, jsonSchema]', async () => {
  const out = await sandboxRoute().runCreateConcept({ body: { name: 'coffee house' }, ta: TA });
  assert(out.answer && out.answer.success === true, `the route makes coffee house in the sandbox; got ${show(out.answer)}`);
  const schema = schemaOf(out);
  assert(schema, `it signs a JSON schema node; got ${show(out.events.map((e) => e.uuid))}`);
  assert(show(eventJson(schema).word.wordTypes) === show(WANT), `its word types are ${show(WANT)}; got ${show(eventJson(schema).word.wordTypes)}`);
});

t('FN8 [AC3, AC5, Decision 9]: the old create-concept route takes wordTypes for the header, and refuses a list that isn\'t key-shaped strings', async () => {
  const R = sandboxRoute();
  const headerTypes = async (extra) => {
    const out = await R.runCreateConcept({ body: { name: 'graph thing', dTag: 'graph-thing', ...extra }, ta: TA });
    assert(out.answer && out.answer.success === true, `the route makes the concept with ${show(extra)}; got ${out.status} ${show(out.answer)}`);
    return eventJson(headerOf(out)).word.wordTypes;
  };
  const cases = [
    [{}, ['word', 'conceptHeader']],
    [{ wordTypes: ['word', 'conceptHeader', 'graphType'] }, ['word', 'conceptHeader', 'graphType']],
    [{ wordTypes: ['graphType', 'validationToolType', 'graphType'] }, ['word', 'conceptHeader', 'graphType', 'validationToolType']],
    [{ wordTypes: ['word', 'conceptHeader', 'nodeType'], overwrite: true }, ['word', 'conceptHeader', 'nodeType']],
  ];
  for (const [extra, want] of cases) {
    const got = await headerTypes(extra);
    assert(show(got) === show(want), `with ${show(extra)}, the header's word types are ${show(want)}; got ${show(got)}`);
  }
  for (const bad of ['graphType', ['Graph Type'], [7], ['nodeType', null], { graphType: true }]) {
    const out = await R.runCreateConcept({ body: { name: 'bad thing', wordTypes: bad }, ta: TA });
    assert(out.status === 400 && out.answer && out.answer.success === false && typeof out.answer.error === 'string' && /wordTypes/.test(out.answer.error),
      `wordTypes ${show(bad)} is refused 400, saying so; got ${out.status} ${show(out.answer)}`);
    assert(out.events.length === 0, `and nothing is signed; got ${show(out.events.map((e) => e.uuid))}`);
  }
});

t('FN9 [AC3, AC5, Decision 9]: the install\'s Pass 1a hands each concept\'s create-concept call its header file\'s word types, with overwrite', () => {
  const dead = path.join(os.tmpdir(), `fn9-dead-${process.pid}.conf`);
  fs.writeFileSync(dead, 'NEO4J_URI="bolt://127.0.0.1:9"\nNEO4J_USER="none"\nNEO4J_PASSWORD="none"\n');
  try {
    const DEAD = { BRAINSTORM_CONF_PATH: dead, NEO4J_URI: 'bolt://127.0.0.1:9', TAPESTRY_API_BASE: 'http://127.0.0.1:9', BRAINSTORM_BASE_URL: 'http://127.0.0.1:9', TAPESTRY_PORT: '9', MEILI_URL_HOST: 'http://127.0.0.1:9', TAPESTRY_CONTAINER: 'no-such-container' };
    const r = spawnSync(process.execPath, [CHILD, '{}'], { cwd: REPO, encoding: 'utf8', timeout: 120000, maxBuffer: 64 << 20, env: { ...process.env, ...DEAD } });
    const line = String(r.stdout || '').split('\n').find((l) => l.startsWith('@@RESULT@@'));
    assert(line, `the child printed no result (exit ${r.status}): ${String(r.stderr || r.stdout).slice(0, 600)}`);
    const out = JSON.parse(line.slice('@@RESULT@@'.length));
    assert(!out.threw, `Pass 1 threw in the child: ${String(out.threw).slice(0, 600)}`);
    const calls = out.createConcept || [];
    assert(calls.length === installed().length, `one create-concept call for each concept the manifest installs (${installed().length}); got ${calls.length}`);
    const off = [];
    for (const c of installed()) {
      const call = calls.find((x) => x.dTag === c.slug);
      const want = headerFile(c.dir).word.wordTypes;
      if (!call) off.push(`${c.slug}: no call`);
      else if (show(call.wordTypes) !== show(want) || call.overwrite !== true) off.push(`${c.slug}: ${show({ wordTypes: call.wordTypes, overwrite: call.overwrite })}, not ${show({ wordTypes: want, overwrite: true })}`);
    }
    assert(!off.length, `each call carries wordTypes: its header file's word.wordTypes, and overwrite: true, so a reinstall rebuilds the header with them; ${off.length} don't: ${off.slice(0, 4).join('; ')}${off.length > 4 ? ' …' : ''}`);
  } finally {
    try { fs.unlinkSync(dead); } catch { /* gone */ }
  }
});

t('FN10 [AC4, Decision 8]: graph create-concept makes a JSON schema whose word types are [word, validationTool, jsonSchema]', async () => {
  const S = require(path.join(__dirname, 'helpers/graphOpsSuite.js'));
  const P = require(path.join(__dirname, 'helpers/propertyGraph.js'));
  const C = require(path.join(__dirname, 'helpers/conceptGraph.js'));
  const seed = await C.seedConcepts();
  const file = seed.file(S.tmp('fn10-'));
  const r = P.runOn(file, [{ id: 'make', method: 'POST', url: '/api/tapestry/graph/create-concept', caller: 'owner', body: { name: 'teapot' } }]);
  const x = r.req('make');
  assert(x.status === 200 && x.body && x.body.success, `graph create-concept makes teapot; got ${x.status} ${show(x.body).slice(0, 500)}`);
  const header = x.body.data.concept.conceptHeader;
  const after = S.readState(file);
  const schemaKeys = C.into(after, header, 'IS_THE_JSON_SCHEMA_FOR');
  assert(schemaKeys.length === 1, `teapot has one JSON schema node; got ${show(schemaKeys)}`);
  const j = C.json(after, schemaKeys[0]);
  assert(j && j.word && show(j.word.wordTypes) === show(WANT), `its word types are ${show(WANT)} (ADR 0047 Decision 8); got ${show(j && j.word && j.word.wordTypes)}`);
});

// ── the old routes, run for real in a child over a fake graph (test/helpers/saveSchemaChild.js) ──
const SCHEMA_CHILD = path.join(__dirname, 'helpers/saveSchemaChild.js');
const TA_PRIVKEY = '11'.repeat(32);
const childTa = () => require(path.join(REPO, 'node_modules/nostr-tools')).getPublicKey(Uint8Array.from(Buffer.from(TA_PRIVKEY, 'hex')));
/** A tapestryKey (a version 4 UUID) made from `seed`, so a graph is the same every run. */
function tapestryKeyOf(seed) {
  const h = require('crypto').createHash('sha256').update(String(seed)).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${'89ab'[parseInt(h[16], 16) % 4]}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
/**
 * teapot, the assistant's lettered concept: its header, with d, name and slug tags, and, when `schemaJson` is given, its
 * JSON schema node (IS_THE_JSON_SCHEMA_FOR) holding that JSON in its json tag. → { graph, header, schema }
 */
function teapotGraph(ta, schemaJson) {
  const nodes = [];
  const rels = [];
  let seq = 0;
  const id = (p) => `${p}-${seq++}`;
  const node = (labels, props, tags) => {
    const e = id('n');
    nodes.push({ eid: e, labels: [...labels, 'TapestryNode'], props: { tapestryKey: tapestryKeyOf(props.uuid), ...props } });
    for (const [type, value] of tags) {
      const tag = id('t');
      nodes.push({ eid: tag, labels: ['NostrEventTag', 'TapestryNode'], props: { uuid: `tag-${tag}`, tapestryKey: tapestryKeyOf(`tag-${tag}`), type, value } });
      rels.push({ eid: id('r'), type: 'HAS_TAG', from: e, to: tag, props: {} });
    }
    return e;
  };
  const header = `39998:${ta}:teapot`;
  const h = node(['NostrEvent', 'ListHeader', 'ConceptHeader'], { uuid: header, kind: 39998, pubkey: ta, id: 'event-teapot-header', name: 'teapot' }, [['d', 'teapot'], ['name', 'teapot'], ['slug', 'teapot']]);
  let schema = null;
  if (schemaJson !== undefined) {
    schema = `39999:${ta}:teapot-schema`;
    const s = node(['NostrEvent', 'ListItem', 'JSONSchema'], { uuid: schema, kind: 39999, pubkey: ta, id: 'event-teapot-schema', name: 'json schema for the concept of teapots' },
      [['d', 'teapot-schema'], ['name', 'json schema for the concept of teapots'], ['json', JSON.stringify(schemaJson)]]);
    rels.push({ eid: id('r'), type: 'IS_THE_JSON_SCHEMA_FOR', from: s, to: h, props: {} });
  }
  return { graph: { nodes, rels }, header, schema };
}
/** One run of saveSchemaChild with every endpoint dead → its { results, writes, published, unread, log }. */
function schemaChild(scenario) {
  const dead = path.join(os.tmpdir(), `fn-schema-dead-${process.pid}.conf`);
  fs.writeFileSync(dead, 'NEO4J_URI="bolt://127.0.0.1:9"\nNEO4J_USER="none"\nNEO4J_PASSWORD="none"\n');
  try {
    const DEAD = { BRAINSTORM_CONF_PATH: dead, TAPESTRY_API_BASE: 'http://127.0.0.1:9', BRAINSTORM_BASE_URL: 'http://127.0.0.1:9', TAPESTRY_PORT: '9', MEILI_URL_HOST: 'http://127.0.0.1:9', TAPESTRY_CONTAINER: 'no-such-container' };
    const r = spawnSync(process.execPath, [SCHEMA_CHILD], { input: JSON.stringify({ taPrivkey: TA_PRIVKEY, ...scenario }), encoding: 'utf8', env: { ...process.env, ...DEAD }, maxBuffer: 64 << 20, timeout: 120000 });
    const at = (r.stdout || '').lastIndexOf('@@RESULT@@');
    assert(at >= 0, `the child printed no result (exit ${r.status}): ${String(r.stderr || r.stdout).slice(0, 600)}`);
    const out = JSON.parse(r.stdout.slice(at + 10).split('\n')[0]);
    assert(!out.error, `the route threw in the child: ${String(out.error).slice(0, 600)}`);
    return out;
  } finally {
    try { fs.unlinkSync(dead); } catch { /* gone */ }
  }
}
/** The json a run last wrote on the node at `uuid`, parsed; undefined when it wrote none there. */
function savedJson(out, uuid) {
  const ws = out.writes.filter((w) => w.params && w.params.eventUuid === uuid && w.params.type === 'json');
  return ws.length ? JSON.parse(ws[ws.length - 1].params.value) : undefined;
}
const why = (out) => `answer ${show(out.results).slice(0, 400)}; reads the fake couldn't run ${show(out.unread).slice(0, 300)}`;

t('FN11 [AC4, Decision 8; test plan Amendment 3]: save-schema, given a schema node whose JSON has no word wrapper, writes one with [word, validationTool, jsonSchema]', () => {
  const ta = childTa();
  const { graph, schema } = teapotGraph(ta, { jsonSchema: { type: 'object' } });
  const out = schemaChild({ kind: 'saveSchema', graph, body: { concept: 'teapot', schema: { properties: { teapot: { type: 'object' } } } } });
  const j = savedJson(out, schema);
  assert(j, `save-schema writes teapot's schema node; ${why(out)}`);
  assert(j.word && show(j.word.wordTypes) === show(WANT), `the word wrapper it builds holds ${show(WANT)} (ADR 0047 Decision 8: save-schema's fallback); got ${show(j.word && j.word.wordTypes)}`);
});

async function run() {
  console.log('\n--- firmware\'s nodes, and each new JSON schema, hold their concepts\' keys (graph-operations-first-slice #47) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`); pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++;
    }
  }
  console.log(`\nfirmware-nodes-hold-their-concepts-keys: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
