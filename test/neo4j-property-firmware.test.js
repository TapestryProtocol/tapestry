'use strict';
/**
 * The concept of neo4j properties, in firmware — story graph-operations-foundation #5 (Loom A10.5), AC1.
 *
 * Story: engineering-team/stories/graph-operations-foundation/5-field-mapping.md
 * ADR:   engineering-team/decisions/graph-operations-foundation/0005-field-mapping.md (Decisions 1 and 2, Amendments 1
 *        and 2.1)
 * Model: test/event-tagging-firmware-seed.test.js (its FS layer)
 *
 * The files only: stack-free and deterministic. What an install makes of them (the header, its superset, its two
 * sets, empty, and their description in the graph) is the live check's first step, at Implementation, on a scratch
 * stack (the test plan). Run on its own with `node test/neo4j-property-firmware.test.js`.
 *
 *   NP1 the concept's five files are there: its header, its schema, its manifest and its two sets, and no other set
 *   NP2 its header's word.slug and names (oNames, oSlugs, oKeys, oTitles, oLabels), and no x-tapestry anywhere in it
 *   NP3 its header's description is the ADR's, as plain text (Amendment 1)
 *   NP4 its schema is permissive: properties.neo4jProperty is an object with no fields, and nothing is required
 *   NP5 its manifest is {"HAS_ELEMENT": [], "IS_A_SUPERSET_OF": []}
 *   NP6 its two sets: each word.slug (its address), set.slug, set.name and description, shaped like
 *       relationship-type's sets/class-threads.json
 *   NP7 the global manifest's concepts[] entry, exactly, next to relationship-type, and not listed under sets.properties
 *       or sets.words (its superset is no subset of the property concept's)
 *   NP8 its slugs are its own: no other firmware file has the header's or a set's word.slug, and no other concept its slug
 *   NP9 nothing else in the manifest went missing: relationship-type, property and dog are still there
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const V1 = path.join(REPO, 'firmware/versions/v1.0.0');
const DIR = path.join(V1, 'concepts/neo4j-property');
const MANIFEST = path.join(V1, 'manifest.json');
const ADR = 'ADR graph-operations-foundation/0005';

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (x) => JSON.stringify(x);
function readJson(abs, why) {
  if (!fs.existsSync(abs)) throw new Error(`${path.relative(REPO, abs)} does not exist yet (${ADR} ${why})`);
  return JSON.parse(fs.readFileSync(abs, 'utf8'));
}
const header = () => readJson(path.join(DIR, 'concept-header.json'), 'Decision 1');

/**
 * The ADR's three quoted descriptions, as plain text: its quotes without their markdown (Amendment 1), each set's
 * starting after its bold name, which is only the ADR's label (Amendment 2.1).
 */
const HEADER_DESCRIPTION = "A property that Neo4j nodes carry, so that Cypher can find nodes by it. It has two sets. Neo4j properties that are also fields holds fields of concepts, marked with graph mark-field: each element of the field's concept carries the field's value from its JSON on its node, as the property <concept key>_<field>, such as dog_breed. Neo4j-only properties holds properties a node carries that are no field of its concept, such as search strings or an event's kind, each with the source its value comes from. These values are optional data and cost space on every node, so a property goes in only when a read needs it. A fully reduced graph keeps the memberships, which are edges, and drops the values on the nodes, which can be made again: a field's from the element's JSON, a Neo4j-only property's from its source.";
const SETS = [
  {
    file: 'neo4j-properties-that-are-also-fields.json',
    wordSlug: 'the-set-of-neo4j-properties-that-are-also-fields',
    slug: 'neo4j-properties-that-are-also-fields',
    name: 'neo4j properties that are also fields',
    description: "Fields of a concept that its elements also carry on their Neo4j nodes. Each element is the field's property node, from its concept's property tree. graph mark-field adds one and copies the field's value from each element's JSON to the node property <concept key>_<field>; graph unmark-field takes it out and removes the copies; graph map-fields brings the copies up to date.",
  },
  {
    file: 'neo4j-only-properties.json',
    wordSlug: 'the-set-of-neo4j-only-properties',
    slug: 'neo4j-only-properties',
    name: 'neo4j-only properties',
    description: "Properties a Neo4j node carries that are no field of its concept, such as search strings, or an event's id, kind and created_at. Each will name where its value comes from, so that a fully reduced graph can make it again. It stays empty until a story adds the first one and decides its shape.",
  },
];

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

t('NP1: the concept\'s five files are there, its two sets the only ones', () => {
  for (const f of ['concept-header.json', 'json-schema.json', 'manifest.json', ...SETS.map((s) => `sets/${s.file}`)]) {
    readJson(path.join(DIR, f), f.startsWith('sets/') ? 'Decision 2' : 'Decision 1');
  }
  const sets = fs.readdirSync(path.join(DIR, 'sets')).filter((f) => f.endsWith('.json')).sort();
  assert(show(sets) === show(SETS.map((s) => s.file).sort()), `sets/ holds the two sets and no other; got ${show(sets)}`);
});

t('NP2: its header\'s word.slug and names, and no x-tapestry anywhere in it', () => {
  const h = header();
  assert(h.word && h.word.slug === 'concept-header-for-the-concept-of-neo4j-properties', `word.slug is concept-header-for-the-concept-of-neo4j-properties; got ${show(h.word && h.word.slug)}`);
  const ch = h.conceptHeader || {};
  const want = {
    oNames: { singular: 'neo4j property', plural: 'neo4j properties' },
    oSlugs: { singular: 'neo4j-property', plural: 'neo4j-properties' },
    oKeys: { singular: 'neo4jProperty', plural: 'neo4jProperties' },
    oTitles: { singular: 'Neo4j Property', plural: 'Neo4j Properties' },
    oLabels: { singular: 'Neo4jProperty', plural: 'Neo4jProperties' },
  };
  for (const [k, v] of Object.entries(want)) {
    assert(ch[k] && ch[k].singular === v.singular && ch[k].plural === v.plural, `conceptHeader.${k} is ${show(v)}; got ${show(ch[k])}`);
  }
  assert(!JSON.stringify(h).includes('x-tapestry'), 'the header has no x-tapestry, so a marked property node gets no label (Decision 1)');
});

t('NP3: its header\'s description is the ADR\'s, as plain text', () => {
  const d = (header().conceptHeader || {}).description;
  assert(d === HEADER_DESCRIPTION, `conceptHeader.description is Decision 1's text without its markdown (Amendment 1); got ${show(d)}`);
});

t('NP4: its schema is permissive: neo4jProperty an object with no fields, and nothing required', () => {
  const js = readJson(path.join(DIR, 'json-schema.json'), 'Decision 1');
  const schema = js.jsonSchema || js;
  const np = schema.properties && schema.properties.neo4jProperty;
  assert(np && np.type === 'object', `properties.neo4jProperty is an object; got ${show(np)}`);
  assert(!np.properties || Object.keys(np.properties).length === 0, `it has no fields: membership is the whole fact; got ${show(np.properties)}`);
  const required = (x) => (Array.isArray(x.required) ? x.required : []);
  assert(required(schema).length === 0 && required(np).length === 0, `nothing is required; got ${show({ top: schema.required, neo4jProperty: np.required })}`);
});

t('NP5: its manifest is {"HAS_ELEMENT": [], "IS_A_SUPERSET_OF": []}', () => {
  const m = readJson(path.join(DIR, 'manifest.json'), 'Decision 1');
  assert(show(m) === show({ HAS_ELEMENT: [], IS_A_SUPERSET_OF: [] }), `the manifest puts nothing into the sets: both ship empty; got ${show(m)}`);
});

t('NP6: its two sets, each with its address, slug, name and description, shaped like relationship-type\'s class-threads set', () => {
  const model = readJson(path.join(V1, 'concepts/relationship-type/sets/class-threads.json'), '(the model set)');
  for (const s of SETS) {
    const f = readJson(path.join(DIR, 'sets', s.file), 'Decision 2');
    assert(show(Object.keys(f).sort()) === show(Object.keys(model).sort()), `${s.file} has the model's top-level keys ${show(Object.keys(model))}; got ${show(Object.keys(f))}`);
    for (const k of Object.keys(model.word)) assert(f.word && k in f.word, `${s.file}'s word has ${k}, as the model's does`);
    for (const k of Object.keys(model.set)) assert(f.set && k in f.set, `${s.file}'s set has ${k}, as the model's does`);
    assert(f.word.slug === s.wordSlug, `${s.file}'s word.slug, the set's address, is ${s.wordSlug}; got ${show(f.word.slug)}`);
    assert(f.set.slug === s.slug && f.set.name === s.name, `${s.file}'s set.slug ${s.slug} and set.name ${s.name}; got ${show({ slug: f.set.slug, name: f.set.name })}`);
    assert(f.set.description === s.description, `${s.file}'s description is Decision 2's text without its markdown (Amendment 1), starting after the bold name (Amendment 2.1); got ${show(f.set.description)}`);
  }
});

t('NP7: the global manifest\'s entry, exactly, next to relationship-type, and under neither sets.properties nor sets.words', () => {
  const m = readJson(MANIFEST, '(the global manifest)');
  const concepts = m.concepts || [];
  const i = concepts.findIndex((c) => c.slug === 'neo4j-property');
  assert(i >= 0, `versions/v1.0.0/manifest.json has no concepts[] entry for neo4j-property yet (${ADR} Decision 1)`);
  assert(concepts.filter((c) => c.slug === 'neo4j-property').length === 1, 'one entry, not two');
  const want = { slug: 'neo4j-property', dir: './concepts/neo4j-property/', conceptHeader: 'concept-header.json', jsonSchema: 'json-schema.json', categories: ['graph-theoretic'] };
  assert(show(concepts[i]) === show(want), `the entry is ${show(want)}; got ${show(concepts[i])}`);
  const rt = concepts.findIndex((c) => c.slug === 'relationship-type');
  assert(Math.abs(i - rt) === 1, `it sits next to relationship-type's (at ${rt}); it is at ${i}`);
  const listed = (group) => (((m.sets || {})[group] || {})['existing-sets'] || []).some((x) => x.concept === 'neo4j-property');
  assert(!listed('properties'), 'it isn\'t listed under sets.properties: a Neo4j property need not be a field (the owner\'s revision)');
  assert(!listed('words'), 'nor under sets.words');
});

t('NP8: its slugs are its own: no other firmware file has the header\'s or a set\'s word.slug, and no other concept its slug', () => {
  const mine = new Set([path.join(DIR, 'concept-header.json'), ...SETS.map((s) => path.join(DIR, 'sets', s.file))]);
  header();
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
  for (const slug of ['concept-header-for-the-concept-of-neo4j-properties', ...SETS.map((s) => s.wordSlug)]) {
    const clash = others.filter(([x]) => x === slug);
    assert(!clash.length, `${slug} is unique among the firmware's word slugs (a set's address must be: ADR Context 4); also in ${show(clash.map(([, f]) => f))}`);
  }
  const slugs = (readJson(MANIFEST, '').concepts || []).map((c) => c.slug);
  assert(slugs.filter((x) => x === 'neo4j-property').length === 1, 'no other concept has the slug neo4j-property');
});

t('NP9: nothing else went missing from the manifest: relationship-type, property and dog are still there', () => {
  header();
  const slugs = (readJson(MANIFEST, '').concepts || []).map((c) => c.slug);
  for (const s of ['relationship-type', 'property', 'dog']) assert(slugs.includes(s), `regression: ${s} disappeared from the manifest`);
});

async function run() {
  console.log('\n--- the concept of neo4j properties, in firmware (graph-operations-foundation #5) ---');
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
  console.log(`\nneo4j-property-firmware: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
