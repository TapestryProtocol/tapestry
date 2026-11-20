'use strict';
/**
 * The graph rule concept, in firmware — graph-operations-first-slice #41 (Loom A10.41).
 *
 * Story: engineering-team/stories/graph-operations-first-slice/41-graph-rule-concept.md
 * Plan:  engineering-team/stories/graph-operations-first-slice/41-graph-rule-concept.test-plan.md
 * ADR:   engineering-team/decisions/graph-operations-first-slice/0041-graph-rule-concept.md (Decisions 1, 2, 6 and 8)
 * Model: test/neo4j-property-firmware.test.js
 *
 * Stack-free in every run (the files): what an install makes of them is the live part, which runs only against a
 * scratch container (TAPESTRY_CONTAINER=tapestry-scratch…), never the shared stack.
 *
 *   GF1  the concept's files are there: its header, its schema, its manifest and its elements, and no sets      [AC1]
 *   GF2  its header's word block and names, and no x-tapestry                                                   [AC1]
 *   GF3  its header's description is the ADR's, as plain text                                                  [AC1]
 *   GF4  its schema: graphRule's thirteen fields, required, each described; its enums; unique by name            [AC3]
 *   GF5  its manifest is {"HAS_ELEMENT": [], "IS_A_SUPERSET_OF": []}                                            [AC1]
 *   GF6  the global manifest's entry, exactly, appended last, with every other concept in its old order          [AC1, AC5]
 *   GF7  only graph-rule sets updateElements, and it isn't listed under the manifest's sets, elements or enumerations [AC5]
 *   GF8  the changelog's first entry adds graph-rule                                                           [AC1]
 *   GF9  every element validates against the concept's JSON Schema                                            [AC2, AC3]
 *   GF10 install would name each element by its rule's name                                                    [AC2]
 *   GF11 no file of the concept holds a 64-hex pubkey                                                           [house rule]
 *   GF12 its word slugs are its own: no other firmware file has the header's, the schema's or an item's          [AC2]
 *   GF13 BIBLE §7 lists graph-rule, gives 41 concepts, and says what updateElements and the script do            [AC6]
 *   GL1  [live] after an install, the concept with its eight core nodes and an item per rule, as summaries lists it [AC1, AC2, AC6]
 *   GL2  [live] each item in the graph holds its committed file's JSON, at an address of the instance's own      [AC2, AC3]
 *   GL3  [live] graph list-elements gives an item per rule                                                      [AC6]
 *   GL4  [live, GRAPH_RULE_INSTALL=1] a second install with no rule change signs nothing new for the items       [AC5]
 *
 *   node test/graph-rule-firmware.test.js                                                     # stack-free only
 *   TAPESTRY_CONTAINER=tapestry-scratch node test/graph-rule-firmware.test.js                 # + GL1 to GL3
 *   TAPESTRY_CONTAINER=tapestry-scratch GRAPH_RULE_INSTALL=1 node test/graph-rule-firmware.test.js   # + GL4 (minutes)
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const V1 = path.join(REPO, 'firmware/versions/v1.0.0');
const DIR = path.join(V1, 'concepts/graph-rule');
const ELEMENTS = path.join(DIR, 'elements');
const MANIFEST = path.join(V1, 'manifest.json');
const BIBLE = path.join(REPO, 'BIBLE.md');
const ADR = 'ADR graph-operations-first-slice/0041';

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (x) => JSON.stringify(x);
const short = (x, n = 300) => { const s = typeof x === 'string' ? x : show(x); return s && s.length > n ? `${s.slice(0, n)}…` : s; };
function readJson(abs, why) {
  if (!fs.existsSync(abs)) throw new Error(`${path.relative(REPO, abs)} does not exist yet (${ADR} ${why})`);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}
function stable(x) {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`;
  if (x && typeof x === 'object') return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${stable(x[k])}`).join(',')}}`;
  return JSON.stringify(x);
}

const header = () => readJson(path.join(DIR, 'concept-header.json'), 'Decision 1');
const schema = () => readJson(path.join(DIR, 'json-schema.json'), 'Decision 1');
const manifest = () => readJson(MANIFEST, '');

// element-fits-schema, rule 7, joined with story graph-operations-first-slice #20 (ADR graph-operations-first-slice/0020 Decision 12);
// node-has-a-concept, rule 8, with story graph-operations-first-slice #22 (ADR graph-operations-first-slice/0022 Decision 12);
// tapestry-link-names-a-node, rule 9, proposed, with ADR graph-rules/0002 Decision 5;
// enumerated-value-allowed, rule 10, with story graph-operations-first-slice #19 (ADR graph-operations-first-slice/0019 Decision 13);
// property-has-one-parent, rule 11, with story graph-operations-first-slice #45 (ADR graph-operations-first-slice/0045 Decision 13).
const RULES = ['tapestry-key-unique', 'relationship-type-allowed', 'field-mark-allowed', 'concept-slug-unique', 'class-thread-acyclic', 'set-has-a-parent', 'element-fits-schema', 'node-has-a-concept', 'tapestry-link-names-a-node', 'enumerated-value-allowed', 'property-has-one-parent'];
function elements() {
  if (!fs.existsSync(ELEMENTS)) throw new Error(`firmware/versions/v1.0.0/concepts/graph-rule/elements/ does not exist yet (${ADR} Decision 1)`);
  return fs.readdirSync(ELEMENTS).filter((f) => f.endsWith('.json')).sort().map((f) => ({ file: f, json: JSON.parse(fs.readFileSync(path.join(ELEMENTS, f), 'utf8')) }));
}

/** The header's description, exactly (Decision 1). */
const DESCRIPTION = "A graph rule is one sentence that a graph or an event meets or breaks. The test: a program can check it and answer pass or fail. A rule either refuses a write or only reports. Each rule's wording is written once, in the rulebook, docs/GRAPH_RULES.md in TapestryProtocol/tapestry. Each element of this concept is made from its entry there and from the rule's code, never kept by hand, so a rule is changed in the rulebook, not here.";

/** The manifest's concepts, in order, before this story (staging 4d8c58bb). */
const BEFORE = ['node-type', 'superset', 'set', 'concept-header', 'relationship', 'relationship-type', 'neo4j-property', 'property', 'primary-property', 'properties-set', 'json-schema', 'json-data-type', 'graph', 'graph-type', 'property-tree-graph', 'core-nodes-graph', 'concept-graph', 'list', 'word', 'validation-tool', 'validation-tool-type', 'image', 'image-type', 'image-validation-script', 'tapestry', 'nostr-user', 'nostr-relay', 'dog-breed', 'dog', 'nostr-event', 'nostr-kind', 'graperank', 'web-of-trust', 'class-thread', 'word-wrapper', 'tag', 'nostr-user-tag', 'tag-pinning', 'nostr-event-tag', 'tagging-with-specific-tag'];

const ENTRY = { slug: 'graph-rule', dir: './concepts/graph-rule/', conceptHeader: 'concept-header.json', jsonSchema: 'json-schema.json', categories: ['tapestry'], updateElements: true };

/** graphRule's fields (Decision 2), each with what its schema says it holds. */
const FIELDS = {
  name: 'string', number: 'integer', says: 'string', kind: 'string', about: 'string', refusesOrReports: 'string',
  check: 'string', repair: 'string', enforcedBy: 'string', status: 'string', source: 'string', alsoSays: 'array', code: ['object', 'null'],
};

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

t("GF1 (AC1): the concept's files are there — its header, its schema, its manifest and its elements — and it has no sets", () => {
  header(); schema(); readJson(path.join(DIR, 'manifest.json'), 'Decision 1');
  assert(elements().length > 0, 'elements/ holds the items');
  assert(!fs.existsSync(path.join(DIR, 'sets')), `the concept has no sets (Decision 1); found ${path.relative(REPO, path.join(DIR, 'sets'))}`);
  const files = fs.readdirSync(DIR).sort();
  assert(show(files) === show(['concept-header.json', 'elements', 'json-schema.json', 'manifest.json']), `the folder holds those four and nothing else; got ${show(files)}`);
});

t("GF2 (AC1): its header's word block and names, and no x-tapestry anywhere in it", () => {
  const h = header();
  assert(h.word && h.word.slug === 'concept-header-for-the-concept-of-graph-rules', `word.slug; got ${show(h.word && h.word.slug)}`);
  assert(h.word.name === 'concept header for the concept of graph rules' && h.word.title === 'Concept Header for the Concept of Graph Rules', `word.name and word.title; got ${show({ name: h.word.name, title: h.word.title })}`);
  assert(show(h.word.wordTypes) === show(['word', 'conceptHeader']), `word.wordTypes; got ${show(h.word.wordTypes)}`);
  const c = h.conceptHeader || {};
  const want = {
    oNames: { singular: 'graph rule', plural: 'graph rules' },
    oSlugs: { singular: 'graph-rule', plural: 'graph-rules' },
    oKeys: { singular: 'graphRule', plural: 'graphRules' },
    oTitles: { singular: 'Graph Rule', plural: 'Graph Rules' },
    oLabels: { singular: 'GraphRule', plural: 'GraphRules' },
  };
  for (const [k, v] of Object.entries(want)) assert(show(c[k]) === show(v), `conceptHeader.${k} is ${show(v)}; got ${show(c[k])}`);
  assert(!/x-tapestry/.test(JSON.stringify(h)), 'the header has no x-tapestry, so its items get no node label (Decision 1)');
});

t("GF3 (AC1): its header's description is the ADR's, as plain text", () => {
  const d = header().conceptHeader.description;
  assert(d === DESCRIPTION, `conceptHeader.description, exactly (Decision 1):\n          want ${show(DESCRIPTION)}\n          got  ${show(d)}`);
});

t("GF4 (AC3): its schema — graphRule's thirteen fields, all required, each described — with its enums, unique by name", () => {
  const s = schema();
  assert(s.word && s.word.slug === 'json-schema-for-the-concept-of-graph-rules', `the schema's word.slug; got ${show(s.word && s.word.slug)}`);
  assert(Array.isArray(s.word.wordTypes) && s.word.wordTypes.includes('jsonSchema'), `the schema's word.wordTypes names jsonSchema; got ${show(s.word.wordTypes)}`);
  const js = s.jsonSchema || {};
  assert(js.type === 'object' && Array.isArray(js.required) && js.required.includes('graphRule'), `jsonSchema requires graphRule; got ${short(js.required)}`);
  const g = (js.properties || {}).graphRule || {};
  assert(g.type === 'object', `graphRule is an object; got ${show(g.type)}`);
  assert(show([...(g.required || [])].sort()) === show(Object.keys(FIELDS).sort()), `graphRule requires its thirteen fields, ${show(Object.keys(FIELDS))}; got ${show(g.required)}`);
  for (const [k, type] of Object.entries(FIELDS)) {
    const p = (g.properties || {})[k];
    assert(p, `graphRule.properties.${k} is there`);
    assert(show(p.type) === show(type), `${k}'s type is ${show(type)}; got ${show(p.type)}`);
    for (const a of ['name', 'title', 'slug', 'description']) assert(typeof p[a] === 'string' && p[a], `${k} has its ${a}, as relationship-type's fields do (Decision 1)`);
  }
  assert(show(g.properties.about.enum) === show(['the graph', 'events']), `about is "the graph" or "events"; got ${show(g.properties.about.enum)}`);
  assert(show(g.properties.status.enum) === show(['proposed', 'enforced', 'retired']), `status is proposed, enforced or retired; got ${show(g.properties.status.enum)}`);
  assert(show((g['x-tapestry'] || {}).unique) === show(['name']), `graphRule's x-tapestry.unique is ["name"]; got ${show(g['x-tapestry'])}`);
});

t("GF5 (AC1): its manifest is {\"HAS_ELEMENT\": [], \"IS_A_SUPERSET_OF\": []}", () => {
  const m = readJson(path.join(DIR, 'manifest.json'), 'Decision 1');
  assert(stable(m) === stable({ HAS_ELEMENT: [], IS_A_SUPERSET_OF: [] }), `got ${show(m)}`);
});

t("GF6 (AC1, AC5): the global manifest's entry, exactly, appended last, with every other concept where it was", () => {
  const cs = manifest().concepts || [];
  const last = cs[cs.length - 1];
  assert(last && last.slug === 'graph-rule', `graph-rule is the last concept, so every other installs in the same order as before (Decision 1); the last is ${show(last && last.slug)}`);
  assert(stable(last) === stable(ENTRY), `its entry, exactly:\n          want ${show(ENTRY)}\n          got  ${show(last)}`);
  assert(show(cs.slice(0, -1).map((c) => c.slug)) === show(BEFORE), `the other concepts are the ones before this story, in their order; got ${show(cs.slice(0, -1).map((c) => c.slug))}`);
  assert(cs.filter((c) => c.slug === 'graph-rule').length === 1, 'one graph-rule entry');
});

t("GF7 (AC5): only graph-rule sets updateElements, and the manifest's sets, elements and enumerations don't name it", () => {
  const m = manifest();
  const flagged = (m.concepts || []).filter((c) => 'updateElements' in c).map((c) => c.slug);
  assert(show(flagged) === show(['graph-rule']), `only graph-rule's entry has updateElements, so every other concept installs as today (Decision 6); got ${show(flagged)}`);
  const elsewhere = JSON.stringify({ sets: m.sets, elements: m.elements, enumerations: m.enumerations });
  assert(!/"graph-rule"/.test(elsewhere), 'graph-rule is under none of the manifest\'s sets, elements or enumerations, sets.words included (Decision 1)');
});

t("GF8 (AC1): the changelog's first entry adds graph-rule", () => {
  const first = (manifest().changelog || [])[0] || {};
  assert(first.version === '1.0.0' && first.date === '2026-11-15', `the first changelog entry is 1.0.0, 2026-11-15 (Decision 1); got ${show({ version: first.version, date: first.date })}`);
  assert(Array.isArray(first.changes) && first.changes.some((c) => /graph-rule/.test(c)), `one of its changes names graph-rule; got ${short(first.changes)}`);
});

t('GF9 (AC2, AC3): every element validates against the concept\'s JSON Schema', () => {
  const Ajv2020 = require('ajv/dist/2020');
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const validate = ajv.compile(schema().jsonSchema);
  const els = elements();
  assert(show(els.map((e) => e.file)) === show(RULES.map((r) => `${r}.json`).sort()), `one element per rule; got ${show(els.map((e) => e.file))}`);
  for (const e of els) {
    assert(validate(e.json), `${e.file} validates against the schema: ${short(ajv.errorsText(validate.errors), 600)}`);
  }
});

t("GF10 (AC2): install would name each element by its rule's name", () => {
  for (const { file, json } of elements()) {
    const key = Object.keys(json).filter((k) => k !== 'word')[0];
    const name = json.word.name.includes(':') ? json.word.name.split(':').pop().trim() : (json[key] && json[key].name) || json.word.slug;
    assert(key === 'graphRule', `${file}'s section is graphRule; got ${show(key)}`);
    assert(name === file.replace(/\.json$/, ''), `${file}: pass 1b names the element ${show(name)}, which must be its rule's name (src/firmware/install.js, the element-name derivation)`);
    assert(json.word.slug === name, `${file}: its word.slug, the node's slug, is the rule's name too; got ${show(json.word.slug)}`);
  }
});

t('GF11 (house rule): no file of the concept holds a 64-hex pubkey', () => {
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  if (!fs.existsSync(DIR)) throw new Error(`firmware/versions/v1.0.0/concepts/graph-rule/ does not exist yet (${ADR} Decision 1)`);
  for (const f of walk(DIR)) assert(!/\b[0-9a-f]{64}\b/.test(fs.readFileSync(f, 'utf8')), `${path.relative(REPO, f)} holds no pubkey: the assistant's is read at runtime (CLAUDE.md)`);
});

t('GF12 (AC2): its word slugs are its own — no other firmware file has the header\'s, the schema\'s or an item\'s', () => {
  const mine = new Set([path.join(DIR, 'concept-header.json'), path.join(DIR, 'json-schema.json'), ...elements().map((e) => path.join(ELEMENTS, e.file))]);
  const others = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.json') || mine.has(p)) continue;
      try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); if (j && j.word && j.word.slug) others.push([j.word.slug, path.relative(REPO, p)]); } catch { /* not a word */ }
    }
  };
  walk(path.join(V1, 'concepts'));
  for (const slug of ['concept-header-for-the-concept-of-graph-rules', 'json-schema-for-the-concept-of-graph-rules', ...RULES]) {
    const clash = others.filter(([x]) => x === slug);
    assert(!clash.length, `${slug} is unique among the firmware's word slugs; also in ${show(clash.map(([, f]) => f))}`);
  }
});

t('GF13 (AC6): BIBLE §7 lists graph-rule, gives 41 concepts, and says what updateElements and the script do', () => {
  const b = fs.readFileSync(BIBLE, 'utf8');
  const start = b.indexOf('\n## 7. Firmware');
  const end = b.indexOf('\n## 8.', start + 1);
  assert(start >= 0 && end > start, 'BIBLE.md has a §7 Firmware');
  const s7 = b.slice(start, end);
  assert(/\*\*Tapestry \(\d+\):\*\*[^\n]*graph-rule/.test(s7), 'the Tapestry category line lists graph-rule (Decision 8)');
  assert(/\b41 concepts\b/.test(s7), 'it gives the manifest\'s concept count, 41 (Decision 8)');
  assert(/updateElements/.test(s7), 'Firmware Install says what updateElements does (Decision 8)');
  assert(/src\/firmware\/graph-rules\.js/.test(s7), 'it names the script that makes graph-rule\'s element files (Decision 8)');
});

// ── Live: a scratch container only ───────────────────────────────────────────────────────────────────────────

const live = require('./helpers/scratchLoopback');
const liveSkip = () => {
  const refusal = live.scratchRefusal();
  if (refusal) { console.log(`  NOTE  live checks skipped: ${refusal}`); return true; }
  return false;
};
const conceptHandle = (ta) => `39998:${ta}:graph-rule`;
/** A json tag's value as JSON: inline, or an LMDB reference resolved inside the container (BIBLE §8). */
function jsonOf(value) {
  if (/^lmdb:[0-9a-zA-Z-]+$/.test(value)) {
    const out = live.sh(`node -e 'const r = require("/usr/local/lib/node_modules/brainstorm/src/lib/tapestry-resolve"); process.stdout.write(JSON.stringify(r.resolveValue(process.argv[1])))' '${value}'`);
    const v = JSON.parse(out);
    return typeof v === 'string' ? JSON.parse(v) : v;
  }
  return JSON.parse(value);
}
const itemsInGraph = (handle) => live.cypher(
  `MATCH (h {uuid: $h})-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*0..5]->()-[:HAS_ELEMENT]->(e)
   RETURN DISTINCT e.uuid AS uuid, e.name AS name, e.id AS id ORDER BY uuid`, { h: handle });

t('GL1 (AC1, AC2, AC6, live): after an install, the concept with its eight core nodes and an item per rule, as summaries lists it', () => {
  if (liveSkip()) return 'SKIP';
  const ta = live.taPubkey();
  const handle = conceptHandle(ta);
  const r = live.http('GET', '/api/concept-graph/summaries');
  const list = (r.json && (r.json.summaries || r.json.concepts || r.json.data)) || r.json || [];
  const s = (Array.isArray(list) ? list : []).find((c) => c && c.handle === handle);
  if (!s) { console.log(`  NOTE  GL1 needs a firmware install with this change; ${handle} isn't in summaries. Run POST /api/firmware/install on the scratch stack first.`); }
  assert(s, `summaries lists ${handle}`);
  assert(s.name === 'graph rule' && s.elementCount === RULES.length, `it is named "graph rule" with ${RULES.length} elements; got ${show({ name: s.name, elementCount: s.elementCount })}`);
  const firmware = require('../src/api/normalize/firmware');
  const core = ['CORE_NODE_JSON_SCHEMA', 'CORE_NODE_PRIMARY_PROPERTY', 'CORE_NODE_PROPERTIES', 'CORE_NODE_PROPERTY_TREE_GRAPH', 'CORE_NODE_CORE_GRAPH', 'CORE_NODE_CONCEPT_GRAPH'].map((x) => firmware.relAlias(x));
  const count = (h) => Number(live.cypher(
    `MATCH (h {uuid: $h}) OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(sup) OPTIONAL MATCH (n)-[r]->(h) WHERE type(r) IN $core
     RETURN 1 + count(DISTINCT sup) + count(DISTINCT n) AS c`, { h, core })[0].c);
  const mine = count(handle);
  const theirs = count(`39998:${ta}:relationship-type`);
  assert(mine === 8 && mine === theirs, `the header and its seven other core nodes, as relationship-type has; got ${mine} (relationship-type: ${theirs})`);
});

t('GL2 (AC2, AC3, live): each item in the graph holds its committed file\'s JSON, at an address of the instance\'s own', () => {
  if (liveSkip()) return 'SKIP';
  const ta = live.taPubkey();
  const rows = itemsInGraph(conceptHandle(ta));
  assert(show(rows.map((r) => r.name).sort()) === show([...RULES].sort()), `the ${RULES.length} items, by their rules' names; got ${show(rows.map((r) => r.name))}`);
  for (const row of rows) {
    assert(String(row.uuid).startsWith(`39999:${ta}:`), `${row.name} is the instance's own: ${row.uuid}`);
    const node = live.http('GET', `/api/concept-graph/node/${encodeURIComponent(row.uuid)}`);
    const tag = ((node.json && node.json.node && node.json.node.tags) || []).find((x) => x && x.type === 'json');
    assert(tag && typeof tag.value === 'string', `${row.name} has a json tag; got ${short(node.json, 400)}`);
    const json = jsonOf(tag.value);
    const file = JSON.parse(fs.readFileSync(path.join(ELEMENTS, `${row.name}.json`), 'utf8'));
    assert(stable(json) === stable(file), `${row.name}'s JSON in the graph is its committed file's; got ${short(json, 400)}`);
  }
});

t('GL3 (AC6, live): graph list-elements gives an item per rule', () => {
  if (liveSkip()) return 'SKIP';
  const ta = live.taPubkey();
  const key = live.cypher('MATCH (h {uuid: $h}) RETURN h.tapestryKey AS k', { h: conceptHandle(ta) })[0].k;
  const out = live.sh(`tapestry graph list-elements --concept '${key}' --limit 50`);
  const body = JSON.parse(out);
  const els = (body.data && body.data.elements) || body.elements || [];
  assert(show(els.map((e) => e.name).sort()) === show([...RULES].sort()), `list-elements gives the ${RULES.length} items; got ${short(els.map((e) => e.name))}`);
});

t('GL4 (AC5, live, GRAPH_RULE_INSTALL=1): a second install with no rule change signs nothing new for the items', () => {
  if (liveSkip()) return 'SKIP';
  if (process.env.GRAPH_RULE_INSTALL !== '1') { console.log('  NOTE  GL4 runs a firmware install (minutes); set GRAPH_RULE_INSTALL=1 to run it.'); return 'SKIP'; }
  const handle = conceptHandle(live.taPubkey());
  const before = itemsInGraph(handle);
  assert(before.length === RULES.length, `GL4 needs the ${RULES.length} items from a first install; got ${before.length}`);
  const r = live.http('POST', '/api/firmware/install', {}, 3600);
  assert(r.status === 200, `the install answers 200; got ${r.status} ${short(r.text)}`);
  const after = itemsInGraph(handle);
  assert(stable(after) === stable(before), `each item keeps its address and its event: nothing new was signed (Decision 7)\n          before ${short(before, 600)}\n          after  ${short(after, 600)}`);
});

async function run() {
  console.log('\n--- the graph rule concept, in firmware (graph-operations-first-slice #41) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; } else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++;
    }
  }
  console.log(`\ngraph-rule-firmware: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
