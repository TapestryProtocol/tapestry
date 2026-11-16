'use strict';
/**
 * The one check of an element's JSON against its concept's JSON Schema (story graph-operations-first-slice #20, AC3 and
 * AC7; ADR graph-operations-first-slice/0020 Decision 11). The rule element-fits-schema is defined with it, and every
 * element write calls it: graph create-element now, and graph update-node (A10.21), graph add-to-concept (A10.22) and
 * the property operations (A10.18) when they are built (Decision 16).
 *
 * It reads a schema as the derive step does (src/lib/derivers/word.js:136–180): the schema node's json tag, inline or
 * an LMDB reference; its jsonSchema section, else the object itself; $schema dropped; and ajv's default class, which
 * reads draft-07's keywords, with allErrors and strict off. A schema that names draft 2020-12 is read the same way: a
 * keyword only 2020-12 has is ignored by both. Each schema gets a new Ajv, so an $id never clashes.
 *
 * What it checks is an element's stored JSON, its json tag. The derive step checks another document, its own `base`:
 * the cached JSON, with its graphContext added and word defaults filled in, against the concepts a z tag names too. So
 * the two verdicts agree under a schema that neither requires nor forbids graphContext and doesn't limit an element's
 * top-level keys, as every schema create-concept writes does; firmware's word schema, which requires graphContext,
 * splits them (ADR graph-operations-first-slice/0020 Amendment 1; test SC9 runs both).
 *
 *   schemaOf(read, concept)       E1 → { schema, node, label, header: true }, or { problem, label, header }, where
 *                                 header is false when the key names no concept header
 *   problemsOf(schema, json)      { problems: [{ path, message }] }, or { problem } when the schema doesn't compile
 *   fits(read, concept, json)     { fits: true | false | null, problems, problem }; null with no schema to check against
 *   judge(read)                   a checker for one call, which reads and compiles each concept's schema once
 *   checkElements(read, items)    run the rule element-fits-schema over the items and throw its first finding, with
 *                                 rule set, as the write path does: the one call each element write makes in apply
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
 * E1: the concept's JSON schema, as the derive step reads it → { schema, node, label, header: true }, or { problem,
 * label, header } saying why there is none: no JSON schema node; more than one, since which one counts isn't guessed
 * (BIBLE §10, rule 11); a node with no json tag; JSON that doesn't parse; an LMDB entry that is missing; or something
 * other than an object. header is false when the key names no concept header.
 */
async function schemaOf(read, concept) {
  if (typeof concept !== 'string' || !concept) return { problem: 'no concept was named', label: 'a concept', header: false };
  const rows = await read(
    `MATCH (h:TapestryNode {tapestryKey: $key})
     WHERE h:ConceptHeader OR h:ListHeader
     OPTIONAL MATCH (h)<-[:${schemaType()}]-(js:JSONSchema)
     OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
     RETURN h.name AS name, h.uuid AS uuid, js.tapestryKey AS schema, jt.value AS json`,
    { key: concept },
  );
  if (!rows.length) return { problem: `No concept header has the tapestryKey ${concept}`, label: concept, header: false };
  const label = labelOf(rows[0], concept);
  const nodes = [...new Set(rows.map((r) => r.schema).filter((k) => typeof k === 'string' && k))].sort();
  if (!nodes.length) return { problem: `${label} has no JSON schema node`, label, header: true };
  if (nodes.length > 1) return { problem: `${label} has more than one JSON schema node (${nodes.join(', ')}), and which one counts isn't guessed (BIBLE §10, rule 11)`, label, header: true };
  const node = nodes[0];
  const found = rows.find((r) => r.schema === node && r.json !== null && r.json !== undefined);
  const { readJson } = require('./_fields');
  const { json, problem } = readJson(found ? found.json : null);
  if (problem) return { problem: `${label}'s JSON schema node (${node}) can't be read: ${problem}`, label, header: true };
  if (!isObject(json)) return { problem: `${label}'s JSON schema node (${node}) holds JSON that isn't an object, so it isn't a schema`, label, header: true };
  // As the derive step reads it: the jsonSchema section when there is one, else the object itself, and no $schema.
  const section = json.jsonSchema && typeof json.jsonSchema === 'object' ? json.jsonSchema : json;
  if (!isObject(section)) return { problem: `${label}'s JSON schema node (${node}) has a jsonSchema section that isn't an object, so it isn't a schema`, label, header: true };
  const { $schema, ...schema } = section;
  void $schema;
  return { schema, node, label, header: true };
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

/** The problems in words, joined, at most MAX_LISTED and then how many more (Decision 12). */
function listProblems(problems) {
  const list = Array.isArray(problems) ? problems : [];
  const shown = list.slice(0, MAX_LISTED).map((x) => x.message);
  const more = list.length - shown.length;
  return `${shown.join('; ')}${more > 0 ? `; and ${more} more` : ''}`;
}

/**
 * A checker for one call: each concept's schema is read and compiled once, however many items name it (Decision 12).
 *   check(concept, json) → { header, label, fits: true | false | null, problems, problem }
 */
function judge(read) {
  const memo = new Map();
  const of = (concept) => {
    if (!memo.has(concept)) {
      memo.set(concept, (async () => {
        const s = await schemaOf(read, concept);
        if (!s.schema) return { header: s.header, label: s.label, problem: s.problem };
        const c = compile(s.schema);
        if (c.reason) return { header: true, label: s.label, problem: `${s.label}'s JSON schema doesn't compile: ${c.reason}` };
        return { header: true, label: s.label, validate: c.validate };
      })());
    }
    return memo.get(concept);
  };
  async function check(concept, json) {
    const j = await of(concept);
    if (!j.validate) return { header: j.header, label: j.label, fits: null, problems: [], problem: j.problem };
    const problems = j.validate(json) ? [] : (j.validate.errors || []).map(problemOf);
    return { header: true, label: j.label, fits: problems.length === 0, problems, problem: null };
  }
  return { check };
}

/** Whether `json` fits the schema of the concept keyed `concept` → { fits: true | false | null, problems, problem }. */
async function fits(read, concept, json) {
  const r = await judge(read).check(concept, json);
  return { fits: r.fits, problems: r.problems, problem: r.problem };
}

/**
 * Run the rule element-fits-schema over `items` and throw its first finding as the write path throws a guard's, with
 * `rule` set (as _concepts.js's recheck does): each element write calls it in apply, once it has built the JSON it
 * would store (Decisions 12 and 16).
 */
async function checkElements(read, items) {
  const { findRule } = require('../../rules');
  const { refusal } = require('../../refusal');
  const rule = findRule('element-fits-schema');
  if (!rule) throw new Error("the rule element-fits-schema isn't loaded");
  const found = await rule.violations(items, read);
  if (found && found.length) throw refusal(found[0].code, found[0].message, { rule: rule.name });
}

module.exports = { MAX_LISTED, TOP, schemaOf, problemsOf, problemOf, listProblems, judge, fits, checkElements };
