'use strict';
/**
 * The field mapping (story graph-operations-foundation #5, ADR graph-operations-foundation/0005 Decision 6): a
 * concept's marked fields, carried on its elements' Neo4j nodes.
 *
 * A mark is one HAS_ELEMENT edge from the first set of the concept of neo4j properties,
 * 39999:<TA>:the-set-of-neo4j-properties-that-are-also-fields, to the field's property node in its concept's property
 * tree (Decision 3). Each current element of the concept then carries the field's value, from its JSON, as the node
 * property <concept key>_<field>, such as dog_breed (Decision 4). The value comes from the element's json tag, inline
 * or an LMDB reference, never from the LMDB cache of its Tapestry JSON (Context 7).
 *
 * The three operations (mark-field, unmark-field, map-fields), the rule field-mark-allowed, and every later element
 * write use this one module. Like _nodes.js, it opens nothing when it loads: what it reads with (firmware, the
 * assistant's key, the LMDB store, the Neo4j driver) is required when first called.
 *
 *   conceptOf(read, key)                     the concept a header's tapestryKey names, or null
 *   propertyNodeOf(read, concept, field)     the tapestryKey of the field's node in the concept's tree, or null
 *   firstSetOf(read)                         the first set, { uuid, key }, or null when the firmware isn't installed
 *   marksOf(read, { concept })               every mark, found back to its concept; one concept's when asked
 *   elementsOf(read, concept, limit)         the concept's elements, with their JSON and their copies
 *   valueOf(json, concept, field)            what an element's JSON gives a node for a field (Decision 10)
 *   propertyName(oKey, field)                <key>_<field>
 *   writeCopies(tx, rows)                    one statement that sets and removes copies
 *   mapConcept(tx, concept, options)         the mapping itself: brings elements in line with the marks
 *   mapNodes(tx, keys)                       the mapping of a write's nodes, for every concept they're elements of
 */

const { refusal } = require('../../refusal');

/** The most elements one call handles (Decision 11): one transaction holds every copy. */
const MAX_ELEMENTS = 10000;
const FIRST_SET_SLUG = 'the-set-of-neo4j-properties-that-are-also-fields';
const LMDB_PREFIX = 'lmdb:'; // src/lib/tapestry-resolve.js's: only a reference loads the store
const PLAIN_TYPES = Object.freeze(['string', 'number', 'integer', 'boolean']);

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const has = (o, k) => isObject(o) && Object.prototype.hasOwnProperty.call(o, k);
const typesOf = (t) => (Array.isArray(t) ? t.filter((x) => typeof x === 'string') : typeof t === 'string' ? [t] : []);
const isNeoInt = (x) => !!x && typeof x === 'object' && typeof x.toNumber === 'function' && typeof x.low === 'number' && typeof x.high === 'number';
const plainOf = (v) => (isNeoInt(v) ? v.toNumber() : Array.isArray(v) ? v.map(plainOf) : v);
const count = (n) => n.toLocaleString('en-US');

/** The relationship types the reads walk, as firmware names them (as the relationship-type rule reads them). */
function types() {
  const { relAlias } = require('../../../api/normalize/firmware');
  return {
    INIT: relAlias('CLASS_THREAD_INITIATION'),
    PROP: relAlias('CLASS_THREAD_PROPAGATION'),
    TERM: relAlias('CLASS_THREAD_TERMINATION'),
    SCHEMA: relAlias('CORE_NODE_JSON_SCHEMA'),
    PRIMARY: relAlias('CORE_NODE_PRIMARY_PROPERTY'),
    MEMBER: relAlias('PROPERTY_MEMBERSHIP'),
  };
}

// ── what the operations refuse with ──
const NOT_INSTALLED = Object.freeze({ code: 'not-installed', status: 409, when: 'The graph has no concept for neo4j properties, or no set of neo4j properties that are also fields: install the firmware first' });
const UNKNOWN_CONCEPT = Object.freeze({ code: 'unknown-concept', status: 404, when: 'A concept that names no concept header: a node labelled ConceptHeader, or ListHeader for one the nostr import brought in' });
const UNKNOWN_FIELD = Object.freeze({ code: 'unknown-field', status: 404, when: "A field that isn't one of the concept's top-level fields, jsonSchema.properties[<concept key>].properties" });
const TOO_MANY_ELEMENTS = Object.freeze({ code: 'too-many-elements', status: 409, when: `The concept has more than ${count(MAX_ELEMENTS)} elements, more than one call handles; nothing changes` });

/** The type of a mark's edge: the class thread's termination, HAS_ELEMENT (Decision 3). */
function markType() {
  return types().TERM;
}

/** The first set's address on this instance, or null with no assistant key. */
function firstSetAddress() {
  const { getOwnerAssistantPubkey } = require('../../../utils/assistantKeys');
  const ta = getOwnerAssistantPubkey();
  return ta ? `39999:${ta}:${FIRST_SET_SLUG}` : null;
}

/** What each shared refusal says, in words. */
const say = {
  notInstalled() {
    return `This graph has no set of neo4j properties that are also fields (${firstSetAddress() || `39999:<TA>:${FIRST_SET_SLUG}`}), which every mark starts from: the firmware's concept of neo4j properties isn't installed. Install the firmware first (POST /api/firmware/install), then try again.`;
  },
  unknownConcept(key) {
    return `No concept header has the tapestryKey ${key}. Name a concept by its header's tapestryKey: a node labelled ConceptHeader, or ListHeader for one the nostr import brought in.`;
  },
  unknownField(concept, field, { node = false } = {}) {
    const names = Object.keys(concept.fields || {});
    const fields = names.length ? `Its top-level fields are ${names.join(', ')}.` : `Its schema has no top-level fields under ${concept.oKey || 'its key'}.`;
    return `${field} isn't one of the top-level fields of ${concept.uuid || concept.key}${node ? ', and its property tree has no node for it' : ''}. ${fields}`;
  },
  tooMany(concept) {
    return `${concept.uuid || concept.key} has more than ${count(MAX_ELEMENTS)} elements (at least ${count(MAX_ELEMENTS + 1)}), more than one call handles: every copy goes in one transaction, and its change entry names every node. Nothing changed. Concepts this large wait for batching.`;
  },
};
const tooManyElements = (concept) => refusal(TOO_MANY_ELEMENTS.code, say.tooMany(concept));

// ── reading the JSON ──
/**
 * A json tag's value, read: { json } when it reads, or { json: null, problem } when it can't be read (Amendment 2.2):
 * no tag, inline JSON that doesn't parse, or an LMDB reference whose entry is missing.
 */
function readJson(raw) {
  if (raw === null || raw === undefined) return { json: null, problem: 'it has no json tag, so its JSON can\'t be read' };
  let value = raw;
  if (typeof raw === 'string' && raw.startsWith(LMDB_PREFIX)) {
    const { isLmdbRef, resolveValue } = require('../../../lib/tapestry-resolve');
    value = isLmdbRef(raw) ? resolveValue(raw) : raw;
    if (value === null || value === undefined) return { json: null, problem: `its json tag is an LMDB reference (${raw}) whose entry is missing, so its JSON can't be read` };
  }
  if (typeof value !== 'string') return { json: value };
  try { return { json: JSON.parse(value) }; } catch { return { json: null, problem: "its json tag isn't JSON that parses, so its JSON can't be read" }; }
}

// ── names ──
/** The node property a mark carries: <key>_<field>, such as dog_breed (Decision 4). */
function propertyName(oKey, field) {
  return `${oKey}_${field}`;
}

// ── the reads (the ADR's Implementation notes, S1–S5) ──
/**
 * S1: the concept a header's tapestryKey names → { key, uuid, name, oKey, fields, wrapped }, or null for anything that
 * isn't a concept header. `fields` maps each top-level field, jsonSchema.properties[oKey].properties, to its schema;
 * `wrapped` is true when the schema's only top-level key is oKey.
 */
async function conceptOf(read, key) {
  if (typeof key !== 'string' || !key) return null;
  const T = types();
  const rows = await read(
    `MATCH (h:TapestryNode {tapestryKey: $key})
     WHERE h:ConceptHeader OR h:ListHeader
     OPTIONAL MATCH (h)-[:HAS_TAG]->(ht:NostrEventTag {type: 'json'})
     OPTIONAL MATCH (h)<-[:${T.SCHEMA}]-(js:JSONSchema)
     OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
     RETURN h.uuid AS uuid, h.name AS name, ht.value AS headerJson, jt.value AS schemaJson`,
    { key },
  );
  if (!rows.length) return null;
  const first = (f) => { for (const r of rows) if (r[f] !== null && r[f] !== undefined) return r[f]; return null; };
  const header = readJson(first('headerJson')).json;
  const ch = isObject(header) && isObject(header.conceptHeader) ? header.conceptHeader : {};
  const oKey = isObject(ch.oKeys) && typeof ch.oKeys.singular === 'string' && ch.oKeys.singular ? ch.oKeys.singular : null;
  const parsed = readJson(first('schemaJson')).json;
  const schema = isObject(parsed) ? (isObject(parsed.jsonSchema) ? parsed.jsonSchema : parsed) : {};
  const top = isObject(schema.properties) ? schema.properties : {};
  const section = oKey && isObject(top[oKey]) ? top[oKey] : null;
  const fields = section && isObject(section.properties) ? { ...section.properties } : {};
  const topKeys = Object.keys(top);
  return { key, uuid: rows[0].uuid || null, name: rows[0].name || null, oKey, fields, wrapped: !!oKey && topKeys.length === 1 && topKeys[0] === oKey };
}

/**
 * S2: the tapestryKey of the field's property node: the node named `field` that IS_A_PROPERTY_OF the concept's section
 * node, which is the primary property when the schema is wrapped, or else the primary property's child named oKey
 * (Dog's `dog`). A node create-property hung off the schema node doesn't count, since it can be shared (Context 6).
 * Null when there is none, or the concept has no primary property.
 */
async function propertyNodeOf(read, concept, field) {
  if (!concept || typeof concept.key !== 'string' || typeof field !== 'string') return null;
  if (!concept.wrapped && !concept.oKey) return null;
  const T = types();
  const toSection = concept.wrapped
    ? `MATCH (h)<-[:${T.PRIMARY}]-(section:Property)`
    : `MATCH (h)<-[:${T.PRIMARY}]-(:Property)<-[:${T.MEMBER}]-(section:Property {name: $oKey})`;
  const rows = await read(
    `MATCH (h:TapestryNode {tapestryKey: $key})
     WHERE h:ConceptHeader OR h:ListHeader
     ${toSection}
     MATCH (section)<-[:${T.MEMBER}]-(p:Property)
     WHERE p.name = $field
     RETURN p.tapestryKey AS key
     ORDER BY key
     LIMIT 1`,
    { key: concept.key, oKey: concept.oKey, field },
  );
  return rows.length && typeof rows[0].key === 'string' ? rows[0].key : null;
}

/** S5: the first set, { uuid, key }, or null when the graph doesn't have it (the firmware isn't installed). */
async function firstSetOf(read) {
  const uuid = firstSetAddress();
  if (!uuid) return null;
  const rows = await read('MATCH (s:TapestryNode {uuid: $uuid}) WHERE s:Set RETURN s.tapestryKey AS key', { uuid });
  return rows.length && typeof rows[0].key === 'string' ? { uuid, key: rows[0].key } : null;
}

/**
 * S3: every mark → [{ concept, uuid, oKey, field, property, node }], found from the first set back to its concept
 * through the property tree; given `concept` (a header's tapestryKey), only that concept's. A mark counts for a concept
 * only when its node hangs on the concept's section node, so one on the word section's child, or a level down,
 * yields nothing.
 */
async function marksOf(read, { concept = null } = {}) {
  const set = firstSetAddress();
  if (!set) return [];
  const T = types();
  const rows = await read(
    `MATCH (s:TapestryNode {uuid: $set})-[:${T.TERM}]->(p:Property)
     WHERE s:Set
     MATCH (p)-[:${T.MEMBER}]->(parent:Property)-[:${T.MEMBER}*0..1]->(pp:Property)-[:${T.PRIMARY}]->(h)
     WHERE (h:ConceptHeader OR h:ListHeader) AND ($concept IS NULL OR h.tapestryKey = $concept)
     RETURN DISTINCT p.tapestryKey AS node, p.name AS field, parent.tapestryKey AS parentKey, parent.name AS parentName, pp.tapestryKey AS ppKey, h.tapestryKey AS concept`,
    { set, concept: typeof concept === 'string' && concept ? concept : null },
  );
  const concepts = new Map();
  const out = [];
  const seen = new Set();
  for (const r of rows) {
    if (typeof r.node !== 'string' || typeof r.field !== 'string' || typeof r.concept !== 'string') continue;
    if (!concepts.has(r.concept)) concepts.set(r.concept, await conceptOf(read, r.concept));
    const c = concepts.get(r.concept);
    if (!c || !c.oKey) continue;
    const onSection = c.wrapped ? r.parentKey === r.ppKey : r.parentKey !== r.ppKey && r.parentName === c.oKey;
    if (!onSection || seen.has(`${c.key} ${r.node}`)) continue;
    seen.add(`${c.key} ${r.node}`);
    out.push({ concept: c.key, uuid: c.uuid, oKey: c.oKey, field: r.field, property: propertyName(c.oKey, r.field), node: r.node });
  }
  return out;
}

/**
 * S4: the concept's elements, its subsets' elements included, through the class-thread walk → [{ key, uuid, json,
 * problem, copies }]: `json` resolved from the json tag (null, with `problem` saying why, when it can't be read), and
 * `copies` the node's properties that start with <key>_. At most `limit` (a checked whole number, written into the
 * text, as graph history's is); `only` keeps those keys alone. Implicit members join once they are wired (Context 11).
 */
async function elementsOf(read, concept, limit, { only = null } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`elementsOf's limit must be a whole number from 1; got ${JSON.stringify(limit)}`);
  const T = types();
  const rows = await read(
    `MATCH (h:TapestryNode {tapestryKey: $key})
     WHERE h:ConceptHeader OR h:ListHeader
     MATCH (h)-[:${T.INIT}]->(:Superset)-[:${T.PROP}*0..]->()-[:${T.TERM}]->(e)
     WITH DISTINCT e
     WHERE $only IS NULL OR e.tapestryKey IN $only
     OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'})
     WITH e, head(collect(t.value)) AS json
     RETURN e.tapestryKey AS key, e.uuid AS uuid, json, [k IN keys(e) WHERE $prefix IS NOT NULL AND k STARTS WITH $prefix | [k, e[k]]] AS copies
     LIMIT ${limit}`,
    { key: concept.key, prefix: concept.oKey ? `${concept.oKey}_` : null, only: Array.isArray(only) ? only : null },
  );
  const out = [];
  for (const r of rows) {
    if (typeof r.key !== 'string') continue;
    const { json, problem } = readJson(r.json);
    const copies = {};
    for (const pair of Array.isArray(r.copies) ? r.copies : []) if (Array.isArray(pair) && typeof pair[0] === 'string' && pair[1] !== null && pair[1] !== undefined) copies[pair[0]] = pair[1];
    out.push({ key: r.key, uuid: r.uuid || null, json, problem: problem || null, copies });
  }
  return out;
}

// ── values (Decision 10, Amendment 2.6) ──
/** neo4j.int(n), so the driver sends an integer: a JavaScript number goes as a float. */
function toInt(n) {
  return require('neo4j-driver').int(n);
}

/**
 * What an element's JSON gives its node for `field`: { value } to carry, { none: true } for no property (an empty list,
 * a null or nothing, which removes a copy), or { bad: reason } for no property and a skip (no <key> section, JSON that
 * can't be read, an object, or a list holding an object, a null or mixed types). A plain value is copied as the JSON
 * holds it, even when it doesn't match the schema's type; a number goes as an integer only where the schema says
 * integer and it is a safe integer, and a list under integer items only when every item is one.
 */
function valueOf(json, concept, field) {
  if (json === null || json === undefined) return { bad: "its JSON can't be read" };
  const oKey = concept && concept.oKey;
  const section = isObject(json) && oKey ? json[oKey] : undefined;
  if (!isObject(section)) return { bad: `its JSON has no ${oKey || 'concept'} section` };
  const v = section[field];
  if (v === null || v === undefined) return { none: true };
  const def = concept.fields && isObject(concept.fields[field]) ? concept.fields[field] : {};
  if (typeof v === 'string' || typeof v === 'boolean') return { value: v };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return { bad: `its ${field} isn't a finite number` };
    return { value: typesOf(def.type).includes('integer') && Number.isSafeInteger(v) ? toInt(v) : v };
  }
  if (Array.isArray(v)) {
    if (!v.length) return { none: true };
    if (v.some((x) => x === null || x === undefined)) return { bad: `its ${field} is a list that holds a null` };
    if (v.some((x) => typeof x === 'object')) return { bad: `its ${field} is a list that holds an object or a list` };
    const kinds = [...new Set(v.map((x) => typeof x))];
    if (kinds.length > 1) return { bad: `its ${field} is a list of mixed types (${kinds.join(', ')})` };
    if (kinds[0] === 'number') {
      if (!v.every(Number.isFinite)) return { bad: `its ${field} holds a number that isn't finite` };
      const items = isObject(def.items) ? def.items : {};
      const asInt = typesOf(items.type).includes('integer') && v.every(Number.isSafeInteger);
      return { value: asInt ? v.map(toInt) : [...v] };
    }
    return { value: [...v] };
  }
  return { bad: `its ${field} is an object` };
}

/** A copy as read back (the driver gives integers as numbers) is the value to carry. */
function same(existing, desired) {
  const d = plainOf(desired);
  if (Array.isArray(d) || Array.isArray(existing)) {
    return Array.isArray(d) && Array.isArray(existing) && d.length === existing.length && d.every((x, i) => x === existing[i]);
  }
  return existing === d;
}

// ── writes ──
/**
 * S8: one statement for [{ key, props }]: each node found by tapestryKey (a change entry never is) gets props, where a
 * null removes that property. A property's name never enters the text. → how many nodes it wrote to.
 */
async function writeCopies(tx, rows) {
  if (!Array.isArray(rows) || !rows.length) return 0;
  const { rows: out } = await tx.run(
    `UNWIND $rows AS row
     MATCH (n:TapestryNode {tapestryKey: row.key}) WHERE NOT n:GraphChange
     SET n += row.props
     RETURN count(n) AS written`,
    { rows },
  );
  return out.length && typeof out[0].written === 'number' ? out[0].written : 0;
}

/**
 * The mapping: bring the concept's elements (or the `only` ones) in line with its marks (or the marks of the `fields`
 * given), writing only what differs; with `strays`, also remove each copy in the concept's namespace that no mark
 * anywhere yields (Decision 8). An element whose JSON can't be read is left exactly as it is, copies and strays alike
 * (Amendment 2.2). `elements`, when the caller has read them already (elementsOf), saves a second read.
 * → { marks, set: { [property]: [keys] }, removed: { [property]: [keys] }, skipped: [{ node, field?, reason }],
 *     carried: { [property]: how many elements carry it now }, elements: how many it looked at }
 * Refuses too-many-elements when it reads more than MAX_ELEMENTS itself.
 */
async function mapConcept(tx, concept, { only = null, fields = null, strays = false, elements = null } = {}) {
  const read = (cypher, params) => tx.read(cypher, params);
  const result = { marks: [], set: {}, removed: {}, skipped: [], carried: {}, elements: 0 };
  if (!concept || !concept.oKey) return result;
  if (Array.isArray(only) && !only.length) return result;
  const marks = await marksOf(read, strays ? {} : { concept: concept.key });
  const mine = marks.filter((m) => m.concept === concept.key && (!Array.isArray(fields) || fields.includes(m.field)));
  const yielded = new Set(marks.filter((m) => m.oKey === concept.oKey).map((m) => m.property));
  let list = elements;
  if (!Array.isArray(list)) {
    list = await elementsOf(read, concept, MAX_ELEMENTS + 1, { only });
    if (list.length > MAX_ELEMENTS) throw tooManyElements(concept);
  } else if (Array.isArray(only)) {
    list = list.filter((e) => only.includes(e.key));
  }
  result.marks = mine;
  result.elements = list.length;
  for (const m of mine) result.carried[m.property] = 0;
  const note = (map, property, key) => { (map[property] || (map[property] = [])).push(key); };
  const rows = [];
  for (const el of list) {
    if (el.problem) {
      // Its copies may be the last record of those values (BIBLE §30): nothing here touches them.
      if (mine.length || strays) result.skipped.push({ node: el.key, reason: el.problem });
      for (const m of mine) if (el.copies[m.property] !== undefined) result.carried[m.property] += 1;
      continue;
    }
    const props = {};
    const hasSection = isObject(el.json) && isObject(el.json[concept.oKey]);
    if (mine.length && !hasSection) result.skipped.push({ node: el.key, reason: `its JSON has no ${concept.oKey} section` });
    for (const m of mine) {
      const v = hasSection ? valueOf(el.json, concept, m.field) : { none: true };
      const existing = el.copies[m.property];
      if (Object.prototype.hasOwnProperty.call(v, 'value')) {
        result.carried[m.property] += 1;
        if (existing === undefined || !same(existing, v.value)) { props[m.property] = v.value; note(result.set, m.property, el.key); }
      } else {
        if (v.bad) result.skipped.push({ node: el.key, field: m.field, reason: v.bad });
        if (existing !== undefined) { props[m.property] = null; note(result.removed, m.property, el.key); }
      }
    }
    if (strays) {
      for (const p of Object.keys(el.copies)) {
        if (!yielded.has(p) && !has(props, p)) { props[p] = null; note(result.removed, p, el.key); }
      }
    }
    if (Object.keys(props).length) rows.push({ key: el.key, props });
  }
  await writeCopies(tx, rows);
  return result;
}

/**
 * The mapping of a write's nodes: each node in `keys` brought in line with the marks of every concept it is an element
 * of (found through the class-thread walk, read from the node back to each concept header), and nothing else. Every
 * element write the new operations add later (create-element, update-node, add-to-concept) calls it inside its own
 * write, on the nodes it wrote. It records no entry: it returns what it changed, { set, removed, skipped }, for the
 * calling write's own entry (Amendment 2.7).
 */
async function mapNodes(tx, keys) {
  const out = { set: {}, removed: {}, skipped: [] };
  const wanted = [...new Set((Array.isArray(keys) ? keys : []).filter((k) => typeof k === 'string' && k))];
  if (!wanted.length) return out;
  const read = (cypher, params) => tx.read(cypher, params);
  const T = types();
  const rows = await read(
    `MATCH (e:TapestryNode)
     WHERE e.tapestryKey IN $keys AND NOT e:GraphChange
     MATCH (e)<-[:${T.TERM}]-()<-[:${T.PROP}*0..]-(:Superset)<-[:${T.INIT}]-(h)
     WHERE h:ConceptHeader OR h:ListHeader
     RETURN DISTINCT h.tapestryKey AS concept, e.tapestryKey AS key`,
    { keys: wanted },
  );
  const byConcept = new Map();
  for (const r of rows) {
    if (typeof r.concept !== 'string' || typeof r.key !== 'string') continue;
    if (!byConcept.has(r.concept)) byConcept.set(r.concept, []);
    if (!byConcept.get(r.concept).includes(r.key)) byConcept.get(r.concept).push(r.key);
  }
  for (const [key, only] of byConcept) {
    const concept = await conceptOf(read, key);
    if (!concept || !concept.oKey) continue;
    const r = await mapConcept(tx, concept, { only });
    for (const [p, ks] of Object.entries(r.set)) out.set[p] = [...(out.set[p] || []), ...ks];
    for (const [p, ks] of Object.entries(r.removed)) out.removed[p] = [...(out.removed[p] || []), ...ks];
    for (const s of r.skipped) out.skipped.push({ ...s, concept: concept.key });
  }
  return out;
}

/** The change entry's copies-set and copies-removed changes for a mapping's result, each naming at least one node. */
function copyChanges(result) {
  const changes = [];
  const sorted = (o) => Object.keys(o).sort().filter((p) => o[p].length);
  for (const property of sorted(result.set)) changes.push({ change: 'copies-set', property, nodes: [...result.set[property]].sort(), count: result.set[property].length });
  for (const property of sorted(result.removed)) changes.push({ change: 'copies-removed', property, nodes: [...result.removed[property]].sort(), count: result.removed[property].length });
  return changes;
}

// ── what the answers share ──
const MARK = Object.freeze({
  type: 'object',
  required: ['concept', 'field', 'property', 'node'],
  properties: {
    concept: { type: 'string', description: "The tapestryKey of the concept's header" },
    field: { type: 'string', description: 'The field' },
    property: { type: 'string', description: 'The node property its elements carry: <concept key>_<field>, such as dog_breed' },
    node: { type: 'string', nullable: true, description: "The tapestryKey of the field's property node, which the mark makes an element of the set of neo4j properties that are also fields (null when the field has none)" },
  },
});
const SKIPPED = Object.freeze({
  type: 'array',
  description: "The elements whose value couldn't be carried, and why: JSON that can't be read (left as it is), JSON with no section for the concept, or a value no Neo4j property can hold",
  items: {
    type: 'object',
    required: ['node', 'reason'],
    properties: {
      node: { type: 'string', description: "The element's tapestryKey" },
      field: { type: 'string', description: 'The field, when the reason is its value' },
      reason: { type: 'string', description: 'Why, in words' },
    },
  },
});

module.exports = {
  MAX_ELEMENTS,
  FIRST_SET_SLUG,
  NOT_INSTALLED,
  UNKNOWN_CONCEPT,
  UNKNOWN_FIELD,
  TOO_MANY_ELEMENTS,
  MARK,
  SKIPPED,
  say,
  tooManyElements,
  markType,
  conceptOf,
  propertyNodeOf,
  firstSetOf,
  marksOf,
  elementsOf,
  valueOf,
  propertyName,
  writeCopies,
  mapConcept,
  mapNodes,
  copyChanges,
};
