'use strict';
/**
 * The one check of an element's JSON against its concept's JSON Schema (story graph-operations-first-slice #20, AC3 and
 * AC7; ADR graph-operations-first-slice/0020 Decision 11). The rule element-fits-schema is defined with it, and every
 * element write calls it: graph create-element now, and graph update-node (A10.21), graph add-to-concept (A10.22) and
 * the property operations (A10.18) when they are built (Decision 16).
 *
 * It reads a schema as the derive step always has, and the derive step now reads it here (src/lib/derivers/
 * schema-verdicts.js): the schema node's json tag, inline or an LMDB reference; its jsonSchema section, else the object
 * itself; $schema dropped; and ajv's default class, which reads draft-07's keywords, with allErrors and strict off. A schema that names draft 2020-12 is read the same way: a
 * keyword only 2020-12 has is ignored by both. Each schema gets a new Ajv, so an $id never clashes.
 *
 * What a schema describes is a node's tapestryJson: the JSON the Tapestry LMDB (the tapestry-store, not strfry's LMDB)
 * holds for it, its word block, a section for each concept it is an element of, and its graphContext (ADR
 * graph-operations-first-slice/0020a). Both readers judge that one document through this module, so they give one
 * verdict: the rule's check of a node as it stands reads its tapestryJson (tapestryJsonOf), and the derive step judges
 * the tapestryJson it builds (src/lib/derivers/schema-verdicts.js), against the concepts the rule judges (ADR
 * graph-operations-first-slice/0042). A write judges the JSON it builds before the derive step has built its
 * graphContext, so a write's check sets aside the problems that are only about graphContext, and answers waiting
 * (Decision 3).
 *
 *   schemaOf(read, concept)       E1 → { schema, node, nodeUuid, name, label, header: true }, or { problem, label,
 *                                 header, name, nodes }, where header is false when the key names no concept header,
 *                                 and nodes are the schema nodes found, [{ tapestryKey, uuid }]
 *   problemsOf(schema, json)      { problems: [{ path, message }] }, or { problem } when the schema doesn't compile
 *   fits(read, concept, json)     a write's check: { fits: true | false | null, problems, problem, waiting }; null with
 *                                 no schema to check against, or when the JSON misses only its graphContext (waiting)
 *   judge(read)                   a checker for one call, or one derive pass, which reads and compiles each concept's
 *                                 schema once; its check(concept, json, { writing, record }) sets nothing aside unless
 *                                 writing, and the record sections `record` names, those the node carries
 *   recordCarried(props)          the record sections a node carries, from its properties (ADR 0037 Amendment 3, item 6)
 *   tapestryJsonOf(node)          the node's tapestryJson → { json }, or { problem, missing } (ADR 0042 Decision 1)
 *   validatorOf(schema)           a schema compiled once, as the check compiles one → { check(json) → { fits, problems,
 *                                 errors } }, or { problem } when it doesn't compile: the property operations' reports
 *                                 judge each element twice with it, before and after (ADR graph-operations-first-slice/0018
 *                                 Decision 9); errors, ajv's own { keyword, schemaPath }, name what refuses graph
 *                                 enumerate's sample (ADR graph-operations-first-slice/0019 Amendment 2)
 *   checkElements(read, items)    run the rule element-fits-schema over the items and throw its first finding, with
 *                                 rule set, as the write path does: the one call each element write makes in apply.
 *                                 With { every: true }, one refusal names every finding: its code the first's (graph
 *                                 update-node, whose change can break more than one concept's section; ADR
 *                                 graph-operations-first-slice/0021 Decision 11)
 *   checkRule(read, name, items, { every })  the same for the rule named `name`: the element writes run
 *                                 enumerated-value-allowed with it, right after checkElements, over the same items
 *                                 (story graph-operations-first-slice #19, ADR graph-operations-first-slice/0019
 *                                 Decision 8)
 *   listProblems(problems)        the problems in words, at most 20 and then how many more
 *
 * It opens nothing when it loads (ADR graph-operations-foundation/0001 Decision 10): ajv, firmware's relationship names
 * and the LMDB store are required when first called. It never signs, publishes or reads a key.
 */

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
/** The most problems a message names; then it says how many more (Decision 12). */
const MAX_LISTED = 20;
/** The path of a problem with the JSON as a whole. */
const TOP = "the element's JSON";

/** The type a schema node points to its concept's header with, as firmware names it (as _fields.js reads it). */
function schemaType() {
  const { relAlias } = require('../../../api/normalize/firmware');
  return relAlias('CORE_NODE_JSON_SCHEMA');
}

/** "<name>" (<address>), or the tapestryKey alone, for messages. */
function labelOf(row, key) {
  const name = row && typeof row.name === 'string' && row.name ? row.name : null;
  const where = row && typeof row.uuid === 'string' && row.uuid ? row.uuid : key;
  return name ? `"${name}" (${where})` : where;
}

/**
 * E1: the concept's JSON schema, as the derive step reads it → { schema, node, nodeUuid, name, label, header: true },
 * or { problem, label, header, name, nodes } saying why there is none: no JSON schema node; more than one, since which
 * one counts isn't guessed (BIBLE §10, rule 11); a node with no json tag; JSON that doesn't parse; an LMDB entry that is
 * missing; or something other than an object. header is false when the key names no concept header. name is the
 * header's name, and nodes the schema nodes found, { tapestryKey, uuid }, which the derive step's verdicts name (ADR
 * graph-operations-first-slice/0042 Decision 5).
 */
async function schemaOf(read, concept) {
  if (typeof concept !== 'string' || !concept) return { problem: 'no concept was named', label: 'a concept', header: false, name: null, nodes: [] };
  const rows = await read(
    `MATCH (h:TapestryNode {tapestryKey: $key})
     WHERE h:ConceptHeader OR h:ListHeader
     OPTIONAL MATCH (h)<-[:${schemaType()}]-(js:JSONSchema)
     OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
     RETURN h.name AS name, h.uuid AS uuid, js.tapestryKey AS schema, js.uuid AS schemaUuid, jt.value AS json`,
    { key: concept },
  );
  if (!rows.length) return { problem: `No concept header has the tapestryKey ${concept}`, label: concept, header: false, name: null, nodes: [] };
  const label = labelOf(rows[0], concept);
  const name = typeof rows[0].name === 'string' && rows[0].name ? rows[0].name : null;
  const byKey = new Map();
  for (const r of rows) {
    if (typeof r.schema === 'string' && r.schema && !byKey.has(r.schema)) byKey.set(r.schema, { tapestryKey: r.schema, uuid: typeof r.schemaUuid === 'string' && r.schemaUuid ? r.schemaUuid : null });
  }
  const found = [...byKey.values()].sort((a, b) => (a.tapestryKey < b.tapestryKey ? -1 : a.tapestryKey > b.tapestryKey ? 1 : 0));
  const keys = found.map((n) => n.tapestryKey);
  const none = (problem) => ({ problem, label, header: true, name, nodes: found });
  if (!found.length) return none(`${label} has no JSON schema node`);
  if (found.length > 1) return none(`${label} has more than one JSON schema node (${keys.join(', ')}), and which one counts isn't guessed (BIBLE §10, rule 11)`);
  const node = keys[0];
  const row = rows.find((r) => r.schema === node && r.json !== null && r.json !== undefined);
  const { readJson } = require('./_fields');
  const { json, problem } = readJson(row ? row.json : null);
  if (problem) return none(`${label}'s JSON schema node (${node}) can't be read: ${problem}`);
  if (!isObject(json)) return none(`${label}'s JSON schema node (${node}) holds JSON that isn't an object, so it isn't a schema`);
  // As the derive step reads it: the jsonSchema section when there is one, else the object itself, and no $schema.
  const section = json.jsonSchema && typeof json.jsonSchema === 'object' ? json.jsonSchema : json;
  if (!isObject(section)) return none(`${label}'s JSON schema node (${node}) has a jsonSchema section that isn't an object, so it isn't a schema`);
  const { $schema, ...schema } = section;
  void $schema;
  return { schema, node, nodeUuid: found[0].uuid, name, label, header: true };
}

/**
 * A node's tapestryJson, from the tapestry-store (ADR graph-operations-first-slice/0042 Decision 1) → { json }, or
 * { problem, missing } when it has none, or { problem } when what the store holds isn't an object. The store is
 * required when first called, so loading this module opens nothing.
 */
function tapestryJsonOf(node) {
  if (typeof node !== 'string' || !node) return { problem: 'no node was named' };
  const store = require('../../../lib/tapestry-store');
  const entry = store.get(node);
  const data = entry && typeof entry === 'object' ? entry.data : undefined;
  if (data === null || data === undefined) return { problem: "it has no tapestryJson yet; the derive step builds it (cache rebuild, or a firmware reinstall's derive pass)", missing: true };
  if (!isObject(data)) return { problem: "its tapestryJson isn't an object" };
  return { json: data };
}

/** The schema compiled with a new Ajv, as the derive step compiles it → { validate } or { reason }. */
function compile(schema) {
  const Ajv = require('ajv');
  try {
    return { validate: new Ajv({ allErrors: true, strict: false }).compile(schema) };
  } catch (e) {
    return { reason: String((e && e.message) || e).split('\n')[0] };
  }
}

// ── a problem, in words ──
/** A JSON pointer as dots: /dog/breed → dog.breed. */
const dotted = (pointer) => String(pointer || '').split('/').slice(1).map((s) => s.replace(/~1/g, '/').replace(/~0/g, '~')).join('.');
const tick = (path) => `\`${path}\``;
const valueText = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
const typeText = (t) => {
  const list = Array.isArray(t) ? t : String(t).split(',');
  const words = list.map((x) => String(x).trim()).filter(Boolean).join(' or ');
  return `${/^[aeiou]/i.test(words) ? 'an' : 'a'} ${words}`;
};

/** One of ajv's errors as { path, message }: the path as dots, or "the element's JSON" at the top (Decision 11). */
function problemOf(err) {
  const at = dotted(err.instancePath);
  const path = at || TOP;
  const where = at ? tick(at) : TOP;
  const p = err.params || {};
  const field = (name) => tick(at ? `${at}.${name}` : String(name));
  switch (err.keyword) {
    case 'required': return { path, message: `${field(p.missingProperty)} is required` };
    case 'additionalProperties': return { path, message: `${field(p.additionalProperty)} isn't a field the schema takes` };
    case 'enum': return { path, message: `${where} must be one of ${(Array.isArray(p.allowedValues) ? p.allowedValues : []).map(valueText).join(', ')}` };
    case 'type': return { path, message: `${where} must be ${typeText(p.type)}` };
    default: return { path, message: `${where} ${err.message || `fails the schema's ${err.keyword}`}` };
  }
}

/** The problems with `json` under `schema` → { problems: [{ path, message }] }, or { problem } when it doesn't compile. */
function problemsOf(schema, json) {
  if (!isObject(schema)) return { problem: "the JSON schema isn't an object" };
  const c = compile(schema);
  if (c.reason) return { problem: `the JSON schema doesn't compile: ${c.reason}` };
  return { problems: c.validate(json) ? [] : (c.validate.errors || []).map(problemOf) };
}

/**
 * `schema` compiled once, as problemsOf and the rule's check compile one, for judging many documents with nothing set
 * aside (ADR graph-operations-first-slice/0018 Decision 9) → { check(json) → { fits, problems, errors } }, or { problem }
 * when it doesn't compile. Its problems are problemOf's, so its words are the rule's. errors are ajv's own, each {
 * keyword, schemaPath }, for words that name the keyword that refuses (graph enumerate's refuses-references; ADR
 * graph-operations-first-slice/0019 Amendment 2, item 2).
 */
function validatorOf(schema) {
  if (!isObject(schema)) return { problem: "the JSON schema isn't an object" };
  const c = compile(schema);
  if (c.reason) return { problem: `the JSON schema doesn't compile: ${c.reason}` };
  return {
    check(json) {
      if (c.validate(json)) return { fits: true, problems: [], errors: [] };
      const errors = c.validate.errors || [];
      return { fits: false, problems: errors.map(problemOf), errors: errors.map((e) => ({ keyword: e.keyword, schemaPath: e.schemaPath })) };
    },
  };
}

/** The problems in words, joined, at most MAX_LISTED and then how many more (Decision 12). */
function listProblems(problems) {
  const list = Array.isArray(problems) ? problems : [];
  const shown = list.slice(0, MAX_LISTED).map((x) => x.message);
  const more = list.length - shown.length;
  return `${shown.join('; ')}${more > 0 ? `; and ${more} more` : ''}`;
}

/**
 * Whether one of ajv's errors is about graphContext, which only the derive step builds: a required error at the top
 * whose missing property is graphContext, or any error at /graphContext or under it (ADR
 * graph-operations-first-slice/0042 Decision 3).
 */
function aboutGraphContext(err) {
  const at = String((err && err.instancePath) || '');
  if (at === '/graphContext' || at.startsWith('/graphContext/')) return true;
  return Boolean(err && err.keyword === 'required' && at === '' && err.params && err.params.missingProperty === 'graphContext');
}

/**
 * The JSON as a schema judges it: lifecycle seed-firmware's install record, the top-level cameFrom and installed the
 * derive step puts in from the node's own properties, set aside, as graphContext is local to the instance (ADR
 * graph-operations-first-slice/0037 Decision 6). Only the sections `record` names are, those the node carries: a
 * section of either name in a node with no record may be a concept's own, and is judged (Amendment 3, item 6).
 */
const RECORD_SECTIONS = Object.freeze(['cameFrom', 'installed']);
function withoutRecord(json, record) {
  const names = (Array.isArray(record) ? record : []).filter((k) => RECORD_SECTIONS.includes(k));
  if (!isObject(json) || !names.some((k) => Object.prototype.hasOwnProperty.call(json, k))) return json;
  const out = { ...json };
  for (const k of names) delete out[k];
  return out;
}
/** The record sections a node carries, from its own properties: each of cameFrom and installed that holds a JSON object. */
function recordCarried(props) {
  const holds = (v) => {
    if (isObject(v)) return true;
    if (typeof v !== 'string' || !v) return false;
    try { return isObject(JSON.parse(v)); } catch { return false; }
  };
  return RECORD_SECTIONS.filter((k) => isObject(props) && holds(props[k]));
}

/**
 * A checker for one call, or one derive pass: each concept's schema is read and compiled once, however many items or
 * nodes name it (Decision 12; ADR 0042 Decision 6).
 *   check(concept, json, { writing }) → { header, label, name, node, nodeUuid, nodes, fits: true | false | null,
 *   problems, problem, waiting }
 * With writing, the check of a write's JSON, the problems only about graphContext are set aside when the JSON has no
 * top-level graphContext: with nothing else wrong, fits is null and waiting true; with other problems too, fits is false,
 * those alone are listed, and waiting is true (ADR 0042 Decision 3). Without it, as the rule's check form and the derive
 * step judge a node's tapestryJson, nothing is set aside.
 */
function judge(read) {
  const memo = new Map();
  const of = (concept) => {
    if (!memo.has(concept)) {
      const reading = (async () => {
        const s = await schemaOf(read, concept);
        const facts = { header: s.header, label: s.label, name: s.name || null, node: s.node || null, nodeUuid: s.nodeUuid || null, nodes: s.nodes || (s.node ? [{ tapestryKey: s.node, uuid: s.nodeUuid || null }] : []) };
        if (!s.schema) return { ...facts, problem: s.problem };
        const c = compile(s.schema);
        if (c.reason) return { ...facts, header: true, problem: `${s.label}'s JSON schema doesn't compile: ${c.reason}` };
        return { ...facts, header: true, validate: c.validate };
      })();
      memo.set(concept, reading);
      // A read that failed isn't kept: the next check of the concept reads it again, so one transient failure doesn't
      // fail every later node of a derive pass that shares this judge (review round 1, non-blocking 1).
      reading.catch(() => { if (memo.get(concept) === reading) memo.delete(concept); });
    }
    return memo.get(concept);
  };
  async function check(concept, given, { writing = false, record = [] } = {}) {
    const j = await of(concept);
    const { validate, problem: why, ...facts } = j;
    if (!validate) return { ...facts, fits: null, problems: [], problem: why, waiting: false };
    const json = withoutRecord(given, record);
    if (validate(json)) return { ...facts, fits: true, problems: [], problem: null, waiting: false };
    let errors = validate.errors || [];
    let waiting = false;
    if (writing && !(isObject(json) && Object.prototype.hasOwnProperty.call(json, 'graphContext'))) {
      const kept = errors.filter((e) => !aboutGraphContext(e));
      waiting = kept.length < errors.length;
      errors = kept;
    }
    if (!errors.length) return { ...facts, fits: null, problems: [], problem: `${j.label} waits for the derive step, which builds the node's graphContext`, waiting: true };
    return { ...facts, fits: false, problems: errors.map(problemOf), problem: null, waiting };
  }
  return { check };
}

/**
 * A write's check: whether `json`, which a write is about to store, fits the schema of the concept keyed `concept` →
 * { fits: true | false | null, problems, problem, waiting }, with the problems only about graphContext set aside
 * (ADR 0042 Decision 3).
 */
async function fits(read, concept, json) {
  const r = await judge(read).check(concept, json, { writing: true });
  return { fits: r.fits, problems: r.problems, problem: r.problem, waiting: r.waiting };
}

/**
 * Run the rule element-fits-schema over `items` and throw its first finding as the write path throws a guard's, with
 * `rule` set (as _concepts.js's recheck does): each element write calls it in apply, once it has built the JSON it
 * would store (Decisions 12 and 16). With `every`, the refusal's message joins every finding's, so a change that
 * breaks two concepts' sections names the problems of both; its code is the first finding's (ADR 0021 Decision 11).
 */
async function checkElements(read, items, { every = false } = {}) {
  const { findRule } = require('../../rules');
  const { refusal } = require('../../refusal');
  const rule = findRule('element-fits-schema');
  if (!rule) throw new Error("the rule element-fits-schema isn't loaded");
  const found = await rule.violations(items, read);
  if (!found || !found.length) return;
  const message = every ? found.map((x) => x.message).join(' ') : found[0].message;
  throw refusal(found[0].code, message, { rule: rule.name });
}

/**
 * Run the rule named `name` over `items` and throw its first finding, or with `every` one refusal joining every
 * finding's message, its code the first's, as checkElements does for element-fits-schema (ADR
 * graph-operations-first-slice/0019 Decision 8). Each element write calls it for enumerated-value-allowed right after
 * checkElements, over the same items.
 */
async function checkRule(read, name, items, { every = false } = {}) {
  const { findRule } = require('../../rules');
  const { refusal } = require('../../refusal');
  const rule = findRule(name);
  if (!rule) throw new Error(`the rule ${name} isn't loaded`);
  const found = await rule.violations(items, read);
  if (!found || !found.length) return;
  const message = every ? found.map((x) => x.message).join(' ') : found[0].message;
  throw refusal(found[0].code, message, { rule: rule.name });
}

module.exports = { MAX_LISTED, TOP, schemaOf, problemsOf, problemOf, listProblems, judge, fits, tapestryJsonOf, validatorOf, checkElements, checkRule, recordCarried };
