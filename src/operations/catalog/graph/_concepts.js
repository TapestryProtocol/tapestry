'use strict';
/**
 * What graph create-concept, graph update-concept and the rule concept-slug-unique share (story
 * graph-operations-first-slice #16, ADR graph-operations-first-slice/0016 Decisions 3–6, 8, 9 and 11).
 *
 *   conceptNodes({ names, d, ta, description })   the eight nodes today's create-concept would sign for these names,
 *                                                 as { role → { uuid, kind, labels, name, tags } }, with their wiring
 *                                                 and memberships (Decision 3)
 *   ownConcepts(read)                             this instance's own concepts, each with its slug and key (Decision 4)
 *   describeConcept(read, headerKey)              a concept, as the operations answer it (Decision 11), or null
 *   conceptFacts(read, headerKey)                 a concept's nodes, with their properties and tags, for an update
 *   nearMatches(read, asked)                      the concepts close to one asked for, capped (Decision 8)
 *   supersetsOf(read, slugs)                      each firmware concept's superset, or the refusal not-installed
 *   freeD(read, name, ta)                         the first free d-tag for a name, or null (Decision 3)
 *   lock(tx)                                      the lock every concept write takes first (Decision 6)
 *   renameRows(...)                               the rename rule: what a rename writes (Decision 9)
 *   the shared refusals, and the answer's schemas
 *
 * It opens nothing when it loads (ADR graph-operations-foundation/0001 Decision 10): the firmware, the assistant's key
 * and the LMDB store are required when first called. It never signs, publishes or reads a secret key.
 */

const dtag = require('../../../lib/dtag');
const CN = require('../../../lib/conceptNames');
const { refusal } = require('../../refusal');

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const copy = (x) => JSON.parse(JSON.stringify(x));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** The roles of a concept's eight nodes, as coreNodesGraph.constituents names them. */
const ROLES = Object.freeze(['conceptHeader', 'superset', 'jsonSchema', 'primaryProperty', 'properties', 'propertyTreeGraph', 'conceptGraph', 'coreNodesGraph']);
/** Each core node's d-tag suffix, its role in the spec's `o` tag, and the role label the import's route adds. */
const CORE = Object.freeze({
  superset: { suffix: 'superset', o: 'superset', label: 'Superset' },
  jsonSchema: { suffix: 'schema', o: 'json-schema', label: 'JSONSchema' },
  primaryProperty: { suffix: 'primary-property', o: 'primary-property', label: 'Property' },
  properties: { suffix: 'properties', o: 'properties-set', label: null },
  propertyTreeGraph: { suffix: 'property-tree-graph', o: 'property-tree-graph', label: null },
  conceptGraph: { suffix: 'concept-graph', o: 'concept-graph', label: null },
  coreNodesGraph: { suffix: 'core-nodes-graph', o: 'core-nodes-graph', label: null },
});
/** The firmware concepts a new concept's nodes name: each z tag's, and concept-header for the header. All must be installed. */
const FIRMWARE_SLUGS = Object.freeze(['concept-header', 'superset', 'set', 'word', 'json-schema', 'primary-property', 'property', 'properties-set', 'property-tree-graph', 'graph', 'concept-graph', 'core-nodes-graph']);
/**
 * Each node's memberships (D9), as a firmware reinstall leaves them (ADR graph-operations-first-slice/0016 Amendment 2,
 * the owner's ruling; measured on firmware 1.0.0): a reinstall prunes the rest of what the z tags name, which the class
 * threads give instead. So a reinstall leaves a new concept as it was.
 */
const MEMBERSHIPS = Object.freeze({
  conceptHeader: Object.freeze(['concept-header']),
  superset: Object.freeze(['superset', 'set']),
  jsonSchema: Object.freeze(['json-schema']),
  primaryProperty: Object.freeze(['primary-property', 'property']),
  properties: Object.freeze(['properties-set']),
  propertyTreeGraph: Object.freeze(['property-tree-graph']),
  conceptGraph: Object.freeze(['concept-graph']),
  coreNodesGraph: Object.freeze(['core-nodes-graph']),
});
const MAX_NONCE = 99;
const MAX_SIMILAR = 10;
const LMDB_PREFIX = 'lmdb:';

/** The relationship types, as firmware names them (src/api/normalize/firmware.js), required when first called. */
function rel() {
  const { relAlias } = require('../../../api/normalize/firmware');
  return {
    INIT: relAlias('CLASS_THREAD_INITIATION'),
    PROP: relAlias('CLASS_THREAD_PROPAGATION'),
    TERM: relAlias('CLASS_THREAD_TERMINATION'),
    SCHEMA: relAlias('CORE_NODE_JSON_SCHEMA'),
    PRIMARY: relAlias('CORE_NODE_PRIMARY_PROPERTY'),
    PROPERTIES: relAlias('CORE_NODE_PROPERTIES'),
    TREE: relAlias('CORE_NODE_PROPERTY_TREE_GRAPH'),
    CORE: relAlias('CORE_NODE_CORE_GRAPH'),
    GRAPH: relAlias('CORE_NODE_CONCEPT_GRAPH'),
    MEMBER: relAlias('PROPERTY_MEMBERSHIP'),
  };
}
/** The assistant's pubkey, the would-be author of every node a concept write makes; null when there is none. */
function assistant() {
  const { getOwnerAssistantPubkey } = require('../../../utils/assistantKeys');
  return getOwnerAssistantPubkey() || null;
}
/** A firmware concept's address on this instance, or null. */
function firmwareUuid(slug) {
  const firmware = require('../../../api/normalize/firmware');
  return firmware.conceptUuid(slug) || null;
}
/** Is this header a firmware concept: its address the assistant's for a slug of the active firmware? */
function isFirmware(uuid) {
  if (typeof uuid !== 'string') return false;
  const d = uuid.split(':').slice(2).join(':');
  return !!d && firmwareUuid(d) === uuid;
}

// ── the refusals ──
const BAD_NAME = Object.freeze({ code: 'bad-name', status: 400, when: 'A name or a plural that is empty once trimmed, has no slug, has a control character, a text-direction control or an invisible character no script or emoji draws with where it is, or is longer than 200 characters; the refusal names the input and the character' });
const BAD_DESCRIPTION = Object.freeze({ code: 'bad-description', status: 400, when: 'A description with a control character other than a line break or a tab' });
const NOT_INSTALLED = Object.freeze({ code: 'not-installed', status: 409, when: "The firmware isn't installed: the graph lacks the concept-header concept, or a concept a new concept's nodes join, or the instance has no assistant key; the refusal names what is missing" });
const NO_FREE_ADDRESS = Object.freeze({ code: 'no-free-address', status: 409, when: `Every address the name gives is held, its d-tag and each versioning nonce to ~${MAX_NONCE}` });
const UNKNOWN_CONCEPT = Object.freeze({ code: 'unknown-concept', status: 404, when: 'A concept that names no concept header: a node labelled ConceptHeader, or ListHeader' });
const NOT_OWN_CONCEPT = Object.freeze({ code: 'not-own-concept', status: 409, when: "A concept that isn't this instance's own: its header's author isn't the instance's assistant (another author's, or the owner's own key's); this write can't sign a new version of it" });
const FIRMWARE_CONCEPT = Object.freeze({ code: 'firmware-concept', status: 409, when: "A firmware concept, which a firmware reinstall rebuilds from its definition: lifecycle seed-firmware is how those change" });
const NAME_KEYED = Object.freeze({ code: 'name-keyed', status: 409, when: "A new singular name for a concept the server finds by its name (the Dictionary's NAME_KEYED_CONCEPTS), or a new singular name that is one of those names; its plural may change" });
const NOTHING_TO_CHANGE = Object.freeze({ code: 'nothing-to-change', status: 400, when: 'A call that names no field to change: name, plural, slug or description' });

/** The cleaned names and description of a write's inputs, or the refusal for the first that has a problem. */
function cleanInputs(inputs, { create = false } = {}) {
  const out = {};
  for (const input of ['name', 'plural']) {
    if (typeof inputs[input] !== 'string') continue;
    const value = CN.cleanName(inputs[input]);
    const why = CN.nameProblem(value);
    if (why) throw refusal(BAD_NAME.code, `The ${input} ${JSON.stringify(inputs[input].length > 60 ? `${inputs[input].slice(0, 57)}…` : inputs[input])} can't be a concept's ${input}: ${why}.`, { input });
    out[input] = value;
  }
  if (typeof inputs.description === 'string') {
    const value = inputs.description.trim();
    const why = CN.descriptionProblem(value);
    if (why) throw refusal(BAD_DESCRIPTION.code, `That description can't be a concept's: ${why}.`, { input: 'description' });
    out.description = value;
  }
  if (create && !out.plural) out.plural = `${out.name}s`;
  return out;
}

/**
 * Whether a name, plural or description given has a problem. A guard then checks nothing, so that the input's own
 * refusal, in apply, comes before anything reads the graph (Decision 2; review round 1).
 */
function anyBadInput(inputs) {
  for (const input of ['name', 'plural']) {
    if (typeof inputs[input] === 'string' && CN.nameProblem(CN.cleanName(inputs[input]))) return true;
  }
  return typeof inputs.description === 'string' && CN.descriptionProblem(inputs.description.trim()) !== null;
}

/** The item a create's guard checks: its slug and key, as a repeat (Decision 5); none when an input has a problem. */
function createItems(inputs) {
  if (typeof inputs.name !== 'string' || anyBadInput(inputs)) return [];
  const name = CN.cleanName(inputs.name);
  const plural = typeof inputs.plural === 'string' ? CN.cleanName(inputs.plural) : `${name}s`;
  const names = CN.deriveAllNames(name, plural);
  return [{ slug: names.oSlugs.singular, key: names.oKeys.singular, repeat: true }];
}

// ── the eight nodes (Decision 3) ──
/**
 * The eight nodes today's create-concept signs for `names` (src/api/normalize/index.js, handleCreateConcept), each with
 * its tags and word-wrapper JSON in the route's order, and the final versions of the core nodes graph and the concept
 * graph. The core nodes' d-tags are the header's `d` with their suffix, and each core node gets the spec's `o` tag after
 * its z tags (tapestry-concepts.md, "Core nodes of a concept"). `names` is deriveAllNames' shape; an update passes the
 * concept's own oSlugs, oKeys and oLabels with its names and titles, old or new (the rename rule).
 * → { nodes: { role → { uuid, kind, labels, name, tags, json } }, wiring: [{ from, type, to }] (roles),
 *     memberships: { role → [firmware slug] } (Amendment 2), membershipType }
 */
function conceptNodes({ names, d, ta, description = null }) {
  const R = rel();
  const z = (slug) => firmwareUuid(slug);
  const slugPlural = names.oSlugs.plural;
  const uuid = { conceptHeader: `39998:${ta}:${d}` };
  for (const [role, c] of Object.entries(CORE)) uuid[role] = `39999:${ta}:${d}-${c.suffix}`;
  const headerSlug = `concept-header-for-the-concept-of-${slugPlural}`;
  const memberOf = [{ slug: headerSlug, uuid: uuid.conceptHeader }];
  const slugOf = {
    superset: `superset-for-the-concept-of-${slugPlural}`,
    jsonSchema: `json-schema-for-the-concept-of-${slugPlural}`,
    primaryProperty: `primary-property-for-the-concept-of-${slugPlural}`,
    properties: `the-set-of-properties-for-the-concept-of-${slugPlural}`,
    propertyTreeGraph: `property-tree-graph-for-the-concept-of-${slugPlural}`,
    conceptGraph: `concept-graph-for-the-concept-of-${slugPlural}`,
    coreNodesGraph: `core-nodes-graph-for-the-concept-of-${slugPlural}`,
  };

  const headerWord = {
    word: {
      slug: headerSlug,
      name: `concept header for the concept of ${names.oNames.plural}`,
      title: `Concept Header for the Concept of ${names.oTitles.plural}`,
      wordTypes: ['word', 'conceptHeader'],
    },
    conceptHeader: {
      description: description || `${names.oTitles.singular} is a concept.`,
      oNames: names.oNames,
      oSlugs: names.oSlugs,
      oKeys: names.oKeys,
      oTitles: names.oTitles,
      oLabels: names.oLabels,
    },
  };
  const supersetWord = {
    word: {
      slug: slugOf.superset,
      name: `superset for the concept of ${names.oNames.plural}`,
      title: `Superset for the Concept of ${names.oTitles.plural}`,
      wordTypes: ['word', 'set', 'superset'],
      coreMemberOf: memberOf,
    },
    set: { slug: names.oSlugs.plural, name: names.oNames.plural, title: names.oTitles.plural, description: `This is a set of ${names.oNames.plural}.` },
    superset: { slug: names.oSlugs.plural, name: names.oNames.plural, title: names.oTitles.plural, description: `This is the superset of all known ${names.oNames.plural}.` },
  };
  const ppKey = names.oKeys.singular;
  const ppSlug = names.oSlugs.singular;
  const schemaWord = {
    word: {
      slug: slugOf.jsonSchema,
      name: `JSON schema for the concept of ${names.oNames.plural}`,
      title: `JSON Schema for the Concept of ${names.oTitles.plural}`,
      description: `the json schema for the concept of ${names.oNames.plural}`,
      wordTypes: ['word', 'jsonSchema'],
      coreMemberOf: memberOf,
    },
    jsonSchema: {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      name: names.oNames.singular,
      title: names.oTitles.singular,
      description: `JSON Schema for the concept of ${names.oNames.plural}`,
      required: [ppKey],
      definitions: {},
      properties: {
        [ppKey]: {
          type: 'object',
          name: names.oNames.singular,
          title: names.oTitles.singular,
          slug: ppSlug,
          description: `data about this ${names.oNames.singular}`,
          required: ['name', 'slug', 'description'],
          'x-tapestry': { unique: ['name', 'slug'] },
          properties: {
            name: { type: 'string', name: 'name', slug: 'name', title: 'Name', description: `The name of the ${names.oNames.singular}` },
            slug: { type: 'string', name: 'slug', slug: 'slug', title: 'Slug', description: `A unique kebab-case identifier for this ${names.oNames.singular}` },
            description: { type: 'string', name: 'description', slug: 'description', title: 'Description', description: `A brief description of the ${names.oNames.singular}` },
          },
        },
      },
    },
  };
  const ppWord = {
    word: {
      slug: slugOf.primaryProperty,
      name: `primary property for the concept of ${names.oNames.plural}`,
      description: `the primary property for the concept of ${names.oNames.plural}`,
      wordTypes: ['word', 'property', 'primaryProperty'],
      coreMemberOf: memberOf,
    },
    property: {
      key: names.oKeys.singular,
      title: names.oTitles.singular,
      type: 'object',
      required: ['name', 'slug', 'description'],
      properties: { name: { type: 'string' }, slug: { type: 'string' }, description: { type: 'string' } },
    },
    primaryProperty: { description: `the primary property for the concept of ${names.oNames.plural}` },
  };
  const propsWord = {
    word: {
      slug: slugOf.properties,
      name: `the set of properties for the concept of ${names.oNames.plural}`,
      title: `The Set of Properties for the Concept of ${names.oTitles.plural}`,
      wordTypes: ['word', 'set', 'propertiesSet'],
      coreMemberOf: memberOf,
    },
    set: { slug: `properties-for-the-concept-of-${slugPlural}`, name: `properties for the concept of ${names.oNames.plural}` },
    propertiesSet: { description: `the set of all properties for the concept of ${names.oNames.plural}` },
  };
  const ptWord = {
    word: {
      slug: slugOf.propertyTreeGraph,
      name: `property tree graph for the concept of ${names.oNames.plural}`,
      title: `Property Tree Graph for the Concept of ${names.oTitles.plural}`,
      wordTypes: ['word', 'graph', 'propertyTreeGraph'],
      coreMemberOf: memberOf,
    },
    graph: {
      nodes: [
        { slug: slugOf.jsonSchema, uuid: uuid.jsonSchema },
        { slug: slugOf.primaryProperty, uuid: uuid.primaryProperty },
        { slug: slugOf.properties, uuid: uuid.properties },
      ],
      relationshipTypes: [{ slug: R.MEMBER }],
      relationships: [{ nodeFrom: { slug: slugOf.primaryProperty }, relationshipType: { slug: R.MEMBER }, nodeTo: { slug: slugOf.jsonSchema } }],
      imports: [],
    },
    propertyTreeGraph: { description: `the collection of the JSON schema node, all property nodes and all of their connections for the concept of ${names.oNames.plural}` },
  };
  const cgWord = {
    word: {
      slug: slugOf.conceptGraph,
      name: `concept graph for the concept of ${names.oNames.plural}`,
      title: `Concept Graph for the Concept of ${names.oTitles.plural}`,
      wordTypes: ['word', 'graph', 'conceptGraph'],
      coreMemberOf: memberOf,
    },
    graph: {
      nodes: [{ slug: headerSlug, uuid: uuid.conceptHeader }, { slug: slugOf.superset, uuid: uuid.superset }],
      relationshipTypes: [{ slug: R.INIT, uuid: '' }, { slug: R.PROP, uuid: '' }, { slug: R.TERM, uuid: '' }],
      relationships: [{ nodeFrom: { slug: headerSlug }, relationshipType: { slug: R.INIT }, nodeTo: { slug: slugOf.superset } }],
      imports: [
        { slug: slugOf.propertyTreeGraph, uuid: uuid.propertyTreeGraph },
        { slug: slugOf.coreNodesGraph, uuid: uuid.coreNodesGraph },
      ],
    },
    conceptGraph: {
      description: `The concept graph for the concept of ${names.oNames.plural}`,
      cypher: `MATCH classPath = (conceptHeader)-[:${R.INIT}]->(superset:Superset)-[:${R.PROP} *0..5]->()-[:${R.TERM}]->() WHERE conceptHeader.uuid = '${uuid.conceptHeader}' RETURN classPath`,
    },
  };
  const coreWord = {
    word: {
      slug: slugOf.coreNodesGraph,
      name: `core nodes graph for the concept of ${names.oNames.plural}`,
      title: `Core Nodes Graph for the Concept of ${names.oTitles.plural}`,
      wordTypes: ['word', 'graph', 'coreNodesGraph'],
      coreMemberOf: memberOf,
    },
    graph: {
      nodes: [
        { slug: headerSlug, uuid: uuid.conceptHeader },
        { slug: slugOf.superset, uuid: uuid.superset },
        { slug: slugOf.jsonSchema, uuid: uuid.jsonSchema },
        { slug: slugOf.primaryProperty, uuid: uuid.primaryProperty },
        { slug: slugOf.properties, uuid: uuid.properties },
        { slug: slugOf.propertyTreeGraph, uuid: uuid.propertyTreeGraph },
        { slug: slugOf.conceptGraph, uuid: uuid.conceptGraph },
        { slug: slugOf.coreNodesGraph, uuid: uuid.coreNodesGraph },
      ],
      relationshipTypes: [
        { slug: R.INIT }, { slug: R.SCHEMA }, { slug: R.PRIMARY }, { slug: R.PROPERTIES }, { slug: R.TREE }, { slug: R.CORE }, { slug: R.GRAPH },
      ],
      relationships: [
        { nodeFrom: { slug: headerSlug }, relationshipType: { slug: R.INIT }, nodeTo: { slug: slugOf.superset } },
        { nodeFrom: { slug: slugOf.jsonSchema }, relationshipType: { slug: R.SCHEMA }, nodeTo: { slug: headerSlug } },
        { nodeFrom: { slug: slugOf.primaryProperty }, relationshipType: { slug: R.PRIMARY }, nodeTo: { slug: headerSlug } },
        { nodeFrom: { slug: slugOf.properties }, relationshipType: { slug: R.PROPERTIES }, nodeTo: { slug: headerSlug } },
        { nodeFrom: { slug: slugOf.propertyTreeGraph }, relationshipType: { slug: R.TREE }, nodeTo: { slug: headerSlug } },
        { nodeFrom: { slug: slugOf.coreNodesGraph }, relationshipType: { slug: R.CORE }, nodeTo: { slug: headerSlug } },
        { nodeFrom: { slug: slugOf.conceptGraph }, relationshipType: { slug: R.GRAPH }, nodeTo: { slug: headerSlug } },
      ],
      imports: [],
    },
    coreNodesGraph: {
      description: `the set of core nodes for the concept of ${names.oNames.plural}`,
      constituents: {
        conceptHeader: uuid.conceptHeader,
        superset: uuid.superset,
        jsonSchema: uuid.jsonSchema,
        primaryProperty: uuid.primaryProperty,
        properties: uuid.properties,
        propertyTreeGraph: uuid.propertyTreeGraph,
        conceptGraph: uuid.conceptGraph,
        coreNodesGraph: uuid.coreNodesGraph,
      },
    },
  };

  const core = (role, word, zs, describe) => {
    const tags = [['d', `${d}-${CORE[role].suffix}`], ['name', word.word.name], ...zs.map((s) => ['z', z(s)]), ['o', uuid.conceptHeader, CORE[role].o]];
    if (describe !== null) tags.push(['description', describe]);
    tags.push(['json', JSON.stringify(word)]);
    return { uuid: uuid[role], kind: 39999, labels: ['ListItem', ...(CORE[role].label ? [CORE[role].label] : [])], name: word.word.name, tags, json: word, z: zs };
  };
  const headerTags = [['d', d], ['names', names.oNames.singular, names.oNames.plural], ['slug', names.oSlugs.singular], ['concept-graph', uuid.conceptGraph], ['json', JSON.stringify(headerWord)]];
  if (description) headerTags.push(['description', description]);
  const nodes = {
    conceptHeader: { uuid: uuid.conceptHeader, kind: 39998, labels: ['ListHeader', 'ConceptHeader'], name: names.oNames.singular, tags: headerTags, json: headerWord, z: [] },
    superset: core('superset', supersetWord, ['superset', 'set', 'word'], supersetWord.superset.description),
    jsonSchema: core('jsonSchema', schemaWord, ['json-schema', 'word'], schemaWord.word.description),
    primaryProperty: core('primaryProperty', ppWord, ['primary-property', 'property', 'word'], ppWord.word.description),
    properties: core('properties', propsWord, ['properties-set', 'set', 'word'], null),
    propertyTreeGraph: core('propertyTreeGraph', ptWord, ['property-tree-graph', 'graph', 'word'], ptWord.propertyTreeGraph.description),
    conceptGraph: core('conceptGraph', cgWord, ['concept-graph', 'graph', 'word'], cgWord.conceptGraph.description),
    coreNodesGraph: core('coreNodesGraph', coreWord, ['core-nodes-graph', 'graph', 'word'], coreWord.coreNodesGraph.description),
  };
  const wiring = [
    { from: 'conceptHeader', type: R.INIT, to: 'superset' },
    { from: 'jsonSchema', type: R.SCHEMA, to: 'conceptHeader' },
    { from: 'primaryProperty', type: R.PRIMARY, to: 'conceptHeader' },
    { from: 'primaryProperty', type: R.MEMBER, to: 'jsonSchema' },
    { from: 'properties', type: R.PROPERTIES, to: 'conceptHeader' },
    { from: 'coreNodesGraph', type: R.CORE, to: 'conceptHeader' },
    { from: 'conceptGraph', type: R.GRAPH, to: 'conceptHeader' },
    { from: 'propertyTreeGraph', type: R.TREE, to: 'conceptHeader' },
  ];
  // D9: each node an element of the concepts a reinstall leaves it in (Amendment 2).
  return { nodes, wiring, memberships: MEMBERSHIPS, membershipType: R.TERM };
}

// ── reading concepts ──
/** A json tag's value, read: inline, or an LMDB reference resolved through the store; null when it can't be read. */
function readJson(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  let text = raw;
  if (raw.startsWith(LMDB_PREFIX)) {
    const { isLmdbRef, resolveValue } = require('../../../lib/tapestry-resolve');
    const value = isLmdbRef(raw) ? resolveValue(raw) : null;
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') return isObject(value) ? value : null;
    text = value;
  }
  try { const v = JSON.parse(text); return isObject(v) ? v : null; } catch { return null; }
}

/** One concept header's facts, from its rows of C2 or C8b: { key, uuid, name, author, hasLetter, names, slug, oKey, description, json }. */
function headerOf(rows) {
  const r0 = rows[0];
  const tag = (type) => rows.find((r) => r.type === type) || null;
  const json = readJson(tag('json') && tag('json').value);
  const ch = json && isObject(json.conceptHeader) ? json.conceptHeader : {};
  const namesTag = tag('names');
  const singular = (namesTag && namesTag.value) || (isObject(ch.oNames) && ch.oNames.singular) || r0.name || '';
  const plural = (namesTag && namesTag.value1) || (isObject(ch.oNames) && ch.oNames.plural) || '';
  const slugTag = tag('slug');
  const slug = (slugTag && slugTag.value) || (isObject(ch.oSlugs) && ch.oSlugs.singular) || (singular ? CN.toSlugName(singular) : null);
  const oKey = (isObject(ch.oKeys) && typeof ch.oKeys.singular === 'string' && ch.oKeys.singular) || (singular ? CN.toKeyName(singular) : null);
  const descTag = tag('description');
  const description = (descTag && descTag.value) || (typeof ch.description === 'string' ? ch.description : null);
  return { key: r0.key || null, uuid: r0.uuid || null, name: r0.name || null, author: r0.author || null, hasLetter: r0.hasLetter === true, names: { singular, plural }, slug, oKey, description, json };
}
const groupBy = (rows) => {
  const m = new Map();
  for (const r of rows) { const id = r.key || r.uuid; if (!m.has(id)) m.set(id, []); m.get(id).push(r); }
  return [...m.values()];
};
const HEADER_TAGS = "['slug', 'names', 'json', 'description']";

/** C2: this instance's own concepts — every header whose author is the assistant, lettered or not (Decision 4). */
async function ownConcepts(read) {
  const ta = assistant();
  if (!ta) return [];
  const rows = await read(
    `MATCH (h)
     WHERE (h:ConceptHeader OR h:ListHeader) AND h.pubkey = $ta
     OPTIONAL MATCH (h)-[:HAS_TAG]->(t:NostrEventTag)
     WHERE t.type IN ${HEADER_TAGS}
     RETURN h.tapestryKey AS key, h.uuid AS uuid, h.name AS name, h.pubkey AS author, h.id IS NOT NULL AS hasLetter, t.type AS type, t.value AS value, t.value1 AS value1`,
    { ta },
  );
  return groupBy(rows).map(headerOf);
}

/** C8b: the headers with these tapestryKeys, by any author. */
async function headersByKey(read, keys) {
  if (!keys.length) return [];
  const rows = await read(
    `MATCH (h)
     WHERE h.tapestryKey IN $keys
     OPTIONAL MATCH (h)-[:HAS_TAG]->(t:NostrEventTag)
     WHERE t.type IN ${HEADER_TAGS}
     RETURN h.tapestryKey AS key, h.uuid AS uuid, h.name AS name, h.pubkey AS author, h.id IS NOT NULL AS hasLetter, t.type AS type, t.value AS value, t.value1 AS value1`,
    { keys },
  );
  return groupBy(rows).map(headerOf);
}

/** C9 (a): a concept's eight nodes by role, through the wiring types; null when the key names no concept header. */
async function rolesOf(read, headerKey) {
  const R = rel();
  const byType = { [R.SCHEMA]: 'jsonSchema', [R.PRIMARY]: 'primaryProperty', [R.PROPERTIES]: 'properties', [R.TREE]: 'propertyTreeGraph', [R.CORE]: 'coreNodesGraph', [R.GRAPH]: 'conceptGraph' };
  const rows = await read(
    `MATCH (h:TapestryNode {tapestryKey: $key})
     WHERE h:ConceptHeader OR h:ListHeader
     OPTIONAL MATCH (h)-[:${R.INIT}]->(sup:Superset)
     OPTIONAL MATCH (h)<-[r:${Object.keys(byType).join('|')}]-(c)
     RETURN h.uuid AS uuid, sup.tapestryKey AS superset, type(r) AS role, c.tapestryKey AS node`,
    { key: headerKey },
  );
  if (!rows.length) return null;
  const nodes = Object.fromEntries(ROLES.map((r) => [r, null]));
  nodes.conceptHeader = headerKey;
  const supersets = [...new Set(rows.map((r) => r.superset).filter((x) => typeof x === 'string'))].sort();
  nodes.superset = supersets[0] || null;
  for (const r of rows) {
    const role = byType[r.role];
    if (role && typeof r.node === 'string' && (!nodes[role] || r.node < nodes[role])) nodes[role] = r.node;
  }
  return { uuid: rows[0].uuid, nodes };
}

/** A concept as the operations answer it (Decision 11, Amendment 1.3), from a header's facts and its nodes by role. */
function answerOf(h, nodes) {
  return {
    conceptHeader: h.key,
    nodes,
    address: h.uuid,
    names: { singular: h.names.singular, plural: h.names.plural },
    slug: h.slug,
    key: h.oKey,
    description: h.description,
    hasLetter: h.hasLetter,
  };
}

/** A concept, as answered, by its header's tapestryKey; null when the key names no concept header. */
async function describeConcept(read, headerKey) {
  const roles = await rolesOf(read, headerKey);
  if (!roles) return null;
  const [h] = await headersByKey(read, [headerKey]);
  return h ? answerOf(h, roles.nodes) : null;
}

/**
 * C9 (b): a concept's nodes, for an update: { roles, header, nodes: { role → { key, uuid, name, value, hasLetter, tags: [{ key, uuid, type, value, value1, value2 }], json } } },
 * or null when the key names no concept header.
 */
async function conceptFacts(read, headerKey) {
  const roles = await rolesOf(read, headerKey);
  if (!roles) return null;
  const keys = Object.values(roles.nodes).filter((k) => typeof k === 'string');
  const rows = await read(
    `MATCH (n:TapestryNode)
     WHERE n.tapestryKey IN $keys
     OPTIONAL MATCH (n)-[:HAS_TAG]->(t:NostrEventTag)
     RETURN n.tapestryKey AS key, n.uuid AS uuid, n.name AS name, n.tapestryValue AS value, n.pubkey AS author, n.id IS NOT NULL AS hasLetter,
            t.tapestryKey AS tag, t.uuid AS tagUuid, t.type AS type, t.value AS tagValue, t.value1 AS value1, t.value2 AS value2`,
    { keys },
  );
  const byKey = new Map();
  for (const r of rows) {
    if (!byKey.has(r.key)) byKey.set(r.key, { key: r.key, uuid: r.uuid, name: r.name, value: r.value, author: r.author, hasLetter: r.hasLetter === true, tags: [] });
    if (r.type !== null && r.type !== undefined) byKey.get(r.key).tags.push({ key: r.tag, uuid: r.tagUuid, type: r.type, value: r.tagValue, value1: r.value1, value2: r.value2 });
  }
  const nodes = {};
  for (const role of ROLES) {
    const n = roles.nodes[role] ? byKey.get(roles.nodes[role]) : null;
    if (!n) continue;
    const jt = n.tags.find((t) => t.type === 'json');
    nodes[role] = { ...n, json: jt ? readJson(jt.value) : null };
  }
  const h = nodes.conceptHeader;
  if (!h) return null;
  const base = { key: headerKey, uuid: h.uuid, name: h.name, author: h.author, hasLetter: h.hasLetter };
  const header = headerOf([{ ...base, type: null }, ...h.tags.map((t) => ({ ...base, type: t.type, value: t.value, value1: t.value1 }))]);
  return { roles: roles.nodes, header, nodes };
}

// ── near matches (Decision 8) ──
/**
 * C8: the concepts close to the one asked for, by any author, with the concept itself (`exclude`) left out: another
 * author's with the asked slug (same-slug), any with the asked singular and another slug (same-name), and any whose
 * singular is the asked plural, or whose plural is the asked singular (plural-swap). → { similar, moreSimilar }
 */
async function nearMatches(read, { singular, plural, slug, exclude = null }) {
  const ta = assistant();
  const names = [...new Set([singular, plural].map((x) => String(x).toLowerCase()))];
  const slugs = [...new Set([singular, plural].map((x) => CN.toSlugName(String(x))))];
  const rows = await read(
    `MATCH (h)
     WHERE (h:ConceptHeader OR h:ListHeader) AND h.tapestryKey IS NOT NULL
     OPTIONAL MATCH (h)-[:HAS_TAG]->(t:NostrEventTag)
     WHERE t.type IN ['names', 'slug']
     WITH h, t
     WHERE toLower(h.name) IN $names
        OR (t.type = 'slug' AND t.value IN $slugs)
        OR (t.type = 'names' AND (toLower(t.value) IN $names OR toLower(t.value1) IN $names))
     RETURN DISTINCT h.tapestryKey AS key
     ORDER BY key
     LIMIT 500`,
    { names, slugs },
  );
  const keys = rows.map((r) => r.key).filter((k) => typeof k === 'string' && k !== exclude);
  const S = singular.toLowerCase();
  const P = plural.toLowerCase();
  const ORDER = { 'same-slug': 0, 'same-name': 1, 'plural-swap': 2 };
  const found = [];
  for (const h of await headersByKey(read, keys)) {
    const own = !!ta && h.author === ta;
    const cs = String(h.names.singular || '').toLowerCase();
    const cp = String(h.names.plural || '').toLowerCase();
    let match = null;
    if (!own && h.slug === slug) match = 'same-slug';
    else if (cs === S && h.slug !== slug) match = 'same-name';
    else if (cs === P || cp === S) match = 'plural-swap';
    if (!match) continue;
    found.push({ concept: h.key, address: h.uuid, names: { singular: h.names.singular, plural: h.names.plural }, slug: h.slug, author: h.author, own, match });
  }
  found.sort((a, b) => ORDER[a.match] - ORDER[b.match] || String(a.address).localeCompare(String(b.address)));
  return { similar: found.slice(0, MAX_SIMILAR), moreSimilar: found.length > MAX_SIMILAR };
}

// ── the firmware, addresses and the lock ──
/** C3: the superset of each firmware concept named, by slug; refuses not-installed, naming the first missing. */
async function supersetsOf(read, slugs) {
  const uuids = Object.fromEntries(slugs.map((s) => [s, firmwareUuid(s)]));
  const wanted = Object.values(uuids).filter(Boolean);
  const rows = wanted.length ? await read(
    `MATCH (h:NostrEvent|TapestryNode)-[:${rel().INIT}]->(s:Superset)
     WHERE h.uuid IN $uuids
     RETURN h.uuid AS concept, s.tapestryKey AS superset`,
    { uuids: wanted },
  ) : [];
  const out = {};
  for (const s of slugs) {
    const row = uuids[s] ? rows.filter((r) => r.concept === uuids[s] && typeof r.superset === 'string').sort((a, b) => a.superset.localeCompare(b.superset))[0] : null;
    if (!row) throw refusal(NOT_INSTALLED.code, `This graph has no ${s.replace(/-/g, ' ')} concept with a superset (${uuids[s] || `39998:<assistant>:${s}`}), which a new concept's nodes join: the firmware isn't installed. Install it first (POST /api/firmware/install), then try again.`);
    out[s] = row.superset;
  }
  return out;
}

/** The eight addresses a concept with d-tag `d` would have. */
function addressesOf(d, ta) {
  return [`39998:${ta}:${d}`, ...Object.values(CORE).map((c) => `39999:${ta}:${d}-${c.suffix}`)];
}

/** C4: the first d-tag for `name` whose eight addresses no node holds, trying ~1 to ~99 after the plain one; or null. */
async function freeD(read, name, ta) {
  const candidates = [];
  for (let n = 0; n <= MAX_NONCE; n++) candidates.push(n === 0 ? dtag.headerDTag(name) : dtag.headerDTag(name, n));
  const all = candidates.flatMap((d) => addressesOf(d, ta));
  const rows = await read('MATCH (n:NostrEvent|TapestryNode) WHERE n.uuid IN $uuids RETURN n.uuid AS uuid', { uuids: all });
  const held = new Set(rows.map((r) => r.uuid));
  return candidates.find((d) => addressesOf(d, ta).every((u) => !held.has(u))) || null;
}

/** C1: the lock on the concept-header concept's header, held until the transaction ends (Decision 6). */
async function lock(tx) {
  const uuid = firmwareUuid('concept-header');
  const { rows } = uuid ? await tx.run(
    'MATCH (n:NostrEvent|TapestryNode {uuid: $uuid}) SET n.tapestryLock = true REMOVE n.tapestryLock RETURN n.tapestryKey AS key',
    { uuid },
  ) : { rows: [] };
  if (!rows.length) throw refusal(NOT_INSTALLED.code, `This graph has no concept-header concept (${uuid || '39998:<assistant>:concept-header'}), whose header every concept write locks first: the firmware isn't installed${assistant() ? '' : ', and the instance has no assistant key'}. Install it first (POST /api/firmware/install), then try again.`);
}

/** Run the rule concept-slug-unique again, after the lock, and throw its refusal as the write path does (Decision 6). */
async function recheck(read, items) {
  if (!items.length) return;
  const { findRule } = require('../../rules');
  const rule = findRule('concept-slug-unique');
  if (!rule) throw new Error("the rule concept-slug-unique isn't loaded");
  const found = await rule.violations(items, read);
  if (found && found.length) throw refusal(found[0].code, found[0].message, { rule: rule.name });
}

// ── the rename rule (Decision 9) ──
/** The leaf values that differ between two builds of a node's JSON: [{ path, was, now }]. */
function diffPaths(a, b, at = [], out = []) {
  if (isObject(a) && isObject(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diffPaths(a[k], b[k], [...at, k], out);
  } else if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    a.forEach((x, i) => diffPaths(x, b[i], [...at, i], out));
  } else if (!same(a, b)) {
    out.push({ path: at, was: a, now: b });
  }
  return out;
}
const getAt = (o, p) => p.reduce((x, k) => (x !== null && x !== undefined ? x[k] : undefined), o);
function setAt(o, p, v) {
  let x = o;
  for (const k of p.slice(0, -1)) x = x[k];
  x[p[p.length - 1]] = v;
}

/** The concept's own identity — slugs, keys and labels — from its header's JSON, else from the names it was made with. */
function identityOf(header, names) {
  const ch = header.json && isObject(header.json.conceptHeader) ? header.json.conceptHeader : {};
  const made = CN.deriveAllNames(names.singular || header.names.singular, names.plural || header.names.plural || `${names.singular}s`);
  return {
    oSlugs: isObject(ch.oSlugs) ? ch.oSlugs : made.oSlugs,
    oKeys: isObject(ch.oKeys) ? ch.oKeys : made.oKeys,
    oLabels: isObject(ch.oLabels) ? ch.oLabels : made.oLabels,
  };
}

/**
 * What a rename writes (Decision 9): each value the old names made, in a node's name, tapestryValue, `name` and
 * `names` tags, `description` tags and JSON, where the node still holds it, becomes what the new names make. Both builds
 * keep the concept's slugs, keys, labels and addresses, so those never move. A JSON the node can't read is left as it is.
 * → { props: [{ key, props }], tags: [{ key, props }], json: { role → json }, renamed: [roles] }
 */
function renameRows(facts, d, ta, oldNames, newNames) {
  const identity = identityOf(facts.header, oldNames);
  const titles = (n) => ({ singular: CN.toTitleName(n.singular), plural: CN.toTitleName(n.plural) });
  const build = (n) => conceptNodes({ names: { oNames: { singular: n.singular, plural: n.plural }, oTitles: titles(n), ...identity }, d, ta, description: null }).nodes;
  const was = build(oldNames);
  const now = build(newNames);
  const out = { props: [], tags: [], json: {}, renamed: [] };
  for (const role of ROLES) {
    const node = facts.nodes[role];
    if (!node) continue;
    let changed = false;
    if (was[role].name !== now[role].name && node.name === was[role].name) {
      out.props.push({ key: node.key, props: { name: now[role].name, tapestryValue: now[role].name } });
      changed = true;
    }
    for (const type of ['name', 'names', 'description']) {
      const w = was[role].tags.find((t) => t[0] === type);
      const n = now[role].tags.find((t) => t[0] === type);
      const cur = node.tags.find((t) => t.type === type);
      if (!w || !n || !cur || same(w, n)) continue;
      // A tag with no value1, such as a names tag with no plural (a header the dlist curation copies can have one),
      // holds the old value1 too: the concept reads the plural from elsewhere (Decision 4). It gains one only when the
      // plural changes, so that the concept then holds the new plural whatever its JSON holds (review round 1).
      const noValue1 = cur.value1 === undefined || cur.value1 === null;
      if (cur.value === w[1] && (w[2] === undefined || noValue1 || cur.value1 === w[2])) {
        if (typeof cur.key !== 'string') throw new Error(`the ${type} tag of ${node.uuid} has no tapestryKey, so it can't be changed; run lifecycle migrate first`);
        const props = { value: n[1] };
        if (n[2] !== undefined && (!noValue1 || n[2] !== w[2])) props.value1 = n[2];
        out.tags.push({ key: cur.key, props });
        changed = true;
      }
    }
    if (node.json) {
      const json = copy(node.json);
      let edited = false;
      for (const { path, was: w, now: n } of diffPaths(was[role].json, now[role].json)) {
        if (getAt(json, path.slice(0, -1)) === undefined) continue;
        if (same(getAt(json, path), w)) { setAt(json, path, copy(n)); edited = true; }
      }
      if (edited) { out.json[role] = json; changed = true; }
    }
    if (changed) out.renamed.push(role);
  }
  return out;
}

// ── the answer's schemas ──
const NAMES = Object.freeze({ type: 'object', required: ['singular', 'plural'], properties: { singular: { type: 'string' }, plural: { type: 'string' } } });
const CONCEPT = Object.freeze({
  type: 'object',
  required: ['conceptHeader', 'nodes', 'address', 'names', 'slug', 'key', 'description', 'hasLetter'],
  properties: {
    conceptHeader: { type: 'string', description: "The tapestryKey of the concept's header" },
    nodes: {
      type: 'object',
      description: "The tapestryKey of each of the concept's eight nodes, by its role as coreNodesGraph.constituents names it, the header's included; null where the concept lacks that node",
      properties: Object.fromEntries(ROLES.map((r) => [r, { type: 'string', nullable: true }])),
    },
    address: { type: 'string', description: "The header's nostr address, 39998:<assistant>:<d>: the address a letter for it would carry" },
    names: { ...NAMES, description: 'Its singular and plural names' },
    slug: { type: 'string', nullable: true, description: 'Its slug: what create-concept finds it by, and what rule 10 keeps unique among this instance\'s concepts' },
    key: { type: 'string', nullable: true, description: "Its key, oKeys.singular: what its elements' JSON is filed under. It never changes" },
    description: { type: 'string', nullable: true, description: "Its description: the header's description tag, else its JSON's" },
    hasLetter: { type: 'boolean', description: 'Whether its header came from a nostr event' },
  },
});
const SIMILAR = Object.freeze({
  type: 'array',
  description: `The concepts close to the one asked for, by any author, up to ${MAX_SIMILAR}: another author's with the slug (same-slug, such as a shared concept), any with the name and another slug (same-name), and any whose singular is the plural asked for or whose plural is the singular (plural-swap). None stops the create`,
  items: {
    type: 'object',
    required: ['concept', 'address', 'names', 'slug', 'author', 'own', 'match'],
    properties: {
      concept: { type: 'string', description: "Its header's tapestryKey" },
      address: { type: 'string', nullable: true },
      names: NAMES,
      slug: { type: 'string', nullable: true },
      author: { type: 'string', nullable: true, description: "Its header's author, a hex pubkey" },
      own: { type: 'boolean', description: "Whether it is this instance's own: its author is the instance's assistant" },
      match: { type: 'string', enum: ['same-slug', 'same-name', 'plural-swap'] },
    },
  },
});

module.exports = {
  ROLES, CORE, FIRMWARE_SLUGS, MEMBERSHIPS, MAX_NONCE, MAX_SIMILAR,
  BAD_NAME, BAD_DESCRIPTION, NOT_INSTALLED, NO_FREE_ADDRESS, UNKNOWN_CONCEPT, NOT_OWN_CONCEPT, FIRMWARE_CONCEPT, NAME_KEYED, NOTHING_TO_CHANGE,
  CONCEPT, SIMILAR, NAMES,
  rel, assistant, firmwareUuid, isFirmware, cleanInputs, anyBadInput, createItems,
  conceptNodes, readJson, headerOf, ownConcepts, headersByKey, rolesOf, answerOf, describeConcept, conceptFacts, nearMatches,
  supersetsOf, addressesOf, freeD, lock, recheck, renameRows, diffPaths,
};
