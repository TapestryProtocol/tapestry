'use strict';
/**
 * What graph add-property, update-property, remove-property and set-schema share (catalog §2, Properties and schema;
 * story graph-operations-first-slice #18; ADR graph-operations-first-slice/0018 and its Amendment 1).
 *
 * A concept's property tree is the authority for its JSON Schema (design D10; BIBLE §9 and §30). Each property node
 * holds its piece of the schema: the field's definition exactly as the schema holds it, minus the contents of its
 * `properties`, which are its children's (Decision 1). Every write rebuilds the concept's section from the tree and
 * rewrites the JSON schema node with it, in the same transaction, so every reader of that node reads the change with no
 * change of its own (Decision 2). The writes keep only a wrapped schema, whose one top-level property is the concept's
 * key, and only typed fields, at most 32 levels and 1,000 properties under the section (Decisions 3 and 4). The first
 * write on a concept whose tree isn't in line with its schema brings it in line first (catching up, Decision 6), and
 * every write reports on the concept's elements, judged as the rule element-fits-schema judges one as it stands, before
 * and after (Decision 9).
 *
 *   requireInstalled(read)             step 2: the assistant and the property concept's superset, or not-installed
 *   conceptOfProperty(read, key)       the header of the concept whose tree holds the property keyed `key`, or null
 *   load(read, concept, opts)          steps 4 to 6, after the lock: the concept, its tree, its current schema, and the
 *                                      tree caught up to it (a working state), or a refusal
 *   commit(tx, read, state, change)    steps 7 to 12 for a target section: the plan, the checks (not-own-node, marks,
 *                                      size and compile), the writes, the check of what was written (refusing only
 *                                      what the write breaks: Amendment 2), the report and the change entry's changes
 *   pieceOf, viewOf, definitionOf, sectionOf, documentOf, withFillIns   Decisions 1 to 3, in memory
 *   planFor(tree, section)             the added, changed and removed of Decisions 6 and 7.4, by path, in memory
 *   schemaProblem(doc, oKey)           Decisions 3 and 4 on a document: null, or { code, message }
 *   the refusals' declarations, and PROPERTY, CAUGHT_UP and ELEMENTS
 *
 * Like the other _*.js modules, it opens nothing when it loads: firmware, the store and ajv are required when first
 * called. It never signs, publishes or reads a secret key.
 */

const dtag = require('../../../lib/dtag');
const CN = require('../../../lib/conceptNames');
const { refusal } = require('../../refusal');
const K = require('./_concepts');
const F = require('./_fields');
const X = require('./_schemas');
const N = require('./_nodes');
const E = require('./_eventless');
const EL = require('./_elements');

/** JSON Schema's seven types: the type of every property these writes keep (Decision 4). */
const TYPES = Object.freeze(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']);
/** The draft a filled-in $schema names, as save-schema and create-concept write it (Decision 3). */
const DRAFT = 'https://json-schema.org/draft/2020-12/schema';
/** The most levels under the concept's section, and the most properties in all (Decision 4). */
const MAX_DEPTH = 32;
const MAX_PROPERTIES = 1000;
/** The versioning nonces a new node's address may take, ~1 to ~99, as create-set's search (Decision 5). */
const MAX_NONCE = 99;
/** The most elements each list of the report names, and the most one call judges (Decision 9). */
const MAX_LISTED = 50;
const LIMIT = F.MAX_ELEMENTS;
/** The longest JSON text a piece or a schema may be given as, as an element's fields (_elements.js). */
const MAX_JSON = EL.MAX_JSON;

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const has = (o, k) => isObject(o) && Object.prototype.hasOwnProperty.call(o, k);
const copy = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
/** A value with every object's keys sorted (arrays keep their order); built with fromEntries, so __proto__ stays a key. */
const sortedDeep = (x) => (Array.isArray(x) ? x.map(sortedDeep)
  : isObject(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, sortedDeep(x[k])])) : x);
/** Two JSON values are the same when they are equal with each object's keys sorted (Decision 2). */
const same = (a, b) => JSON.stringify(sortedDeep(a === undefined ? null : a)) === JSON.stringify(sortedDeep(b === undefined ? null : b));
const typesOf = (t) => (Array.isArray(t) ? t.filter((x) => typeof x === 'string') : typeof t === 'string' ? [t] : []);
const dOf = (uuid) => String(uuid || '').split(':').slice(2).join(':');
const show = (v) => (v === undefined ? 'nothing' : JSON.stringify(v));
const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'a list' : typeof v === 'string' ? 'text' : `a ${typeof v}`);
const count = (n) => Number(n).toLocaleString('en-US');
const shorten = (s) => (String(s).length > 60 ? `${String(s).slice(0, 57)}…` : String(s));

// ── the refusals (Decision 7; Amendment 1, item 3) ──
const R = (code, status, when) => Object.freeze({ code, status, when });
const NOT_INSTALLED = R('not-installed', 409, "The instance has no assistant key, the would-be author of every property node, or the graph has no property concept with a superset: the firmware isn't installed");
const UNKNOWN_CONCEPT = K.UNKNOWN_CONCEPT;
const FIRMWARE_CONCEPT = K.FIRMWARE_CONCEPT;
const NOT_OWN_CONCEPT = R('not-own-concept', 409, "A concept that isn't this instance's own: its header's author isn't the instance's assistant (another author's, or the owner's own key's), so its properties are its author's claim (design D4)");
const NO_PRIMARY_PROPERTY = R('no-primary-property', 409, "A concept with no primary property, or more than one: its fields' property nodes hang under it (BIBLE §9)");
const NOT_WRAPPED_NOW = R('not-wrapped', 409, "A concept whose JSON schema isn't wrapped: its only top-level property isn't the concept's key, holding an object, or its top level isn't an object. These writes keep only a wrapped schema; graph set-schema, given one, replaces it");
const NOT_WRAPPED_GIVEN = R('not-wrapped', 400, "A schema that isn't wrapped: its top level must be an object (or untyped) whose only property is the concept's key, holding an object (type object), where the concept's elements keep their fields; the refusal names the keys it found");
const UNREADABLE_SCHEMA = R('unreadable-schema', 409, "A concept whose JSON schema can't be caught up to: it can't be read, isn't an object, doesn't compile, has a field with no type, a key no field can have, a description create-concept's description check refuses, or properties under a field that isn't an object, or has more than 32 levels or 1,000 properties under the concept's key. graph set-schema replaces it");
const TANGLED_TREE = R('tangled-tree', 409, "A concept whose property tree isn't a tree: a property node with more than one parent, or more than 32 levels below the primary property");
const NOT_OWN_NODE = R('not-own-node', 409, "A property node this write would change or take out that came from another author's event, or records another author: it is that author's claim, which an operation never changes (design D4)");
const BAD_NAME = R('bad-name', 400, "A key a field can't have: empty once trimmed, no slug, a control, text-direction or invisible character, longer than 200 characters (as create-concept refuses a name), or __proto__, which can't key a field of an element's JSON; in a schema, a key create-concept's name check would change. The refusal names its place");
const BAD_TYPE = R('bad-type', 400, "A type that isn't one of JSON Schema's seven (string, number, integer, boolean, object, array, null), or a list of them with none repeated; in a schema, a field with none, such as one defined by $ref or enum alone, or a field that holds properties with a type other than object. The refusal names its place");
const BAD_DESCRIPTION = R('bad-description', 400, "A description with a control character other than a line break or a tab, as the description input, inside schema, or on a field of a schema: it becomes the property node's description tag");
const BAD_PARENT = R('bad-parent', 409, "A parent that isn't one of the same concept's object properties: another concept's, a property that holds a plain value or a list (a list's item fields stay in its own definition), or the concept's primary property, which isn't a field: leave parent out for a top-level property");
const BAD_SCHEMA = R('bad-schema', 400, "A piece or a schema that isn't a JSON object or its text, a piece that names the property's own sub-properties (properties, or a required list: those are properties of their own) or says something other than an input beside it, or a schema that wouldn't compile, read as the readers read one");
const NAME_IN_USE = R('name-in-use', 409, 'A name another property already has at that place, holding something other than the call asks for; the refusal names what differs');
const HAS_PROPERTIES = R('has-properties', 409, 'A type other than object for a property that has properties under it: take those out first (graph remove-property), or set the whole schema (graph set-schema)');
const MARKED_FIELD = R('marked-field', 409, "A write that would take out a marked field, or a property it is under, or change the type of value it holds (its type, or its list's item type): its elements carry it on their nodes. graph unmark-field takes the mark and its copies off first");
const SCHEMA_TOO_LARGE = R('schema-too-large', 400, `A schema with more than ${MAX_DEPTH} levels or ${count(MAX_PROPERTIES)} properties under the concept's key: one transaction holds every node, and every node goes into the change entry`);
const NO_FREE_ADDRESS = R('no-free-address', 409, `Every address a new property node's key and parent give is held: its d-tag and each versioning nonce to ~${MAX_NONCE}`);
const NOTHING_TO_CHANGE = R('nothing-to-change', 400, 'A call that names nothing to change: type, required, description or schema');
const UNKNOWN_PROPERTY = R('unknown-property', 404, "A property that names no property of a concept's tree (a concept's primary property is not one), and, for remove-property, whose removal no change entry records");

/** The piece input: an object, or its JSON text, as a command line gives it (_elements.js's fields input's shape). */
const PIECE_INPUT = Object.freeze({
  schema: { oneOf: [{ type: 'object' }, { type: 'string', maxLength: MAX_JSON }] },
  description: "The rest of what JSON Schema says about the property, such as {\"enum\": [\"a\", \"b\"]}, a format, or a list's items: an object, or its JSON text, as a command line gives it. It can't hold properties or a required list, which are properties of their own",
});

// ── the answer's shapes (Decision 14; Amendment 1, item 4) ──
const PROPERTY = Object.freeze({
  type: 'object',
  required: ['property', 'concept', 'field', 'path', 'parent', 'address', 'type', 'required', 'description', 'schema', 'hasLetter'],
  properties: {
    property: { type: 'string', description: "The property node's tapestryKey" },
    concept: { type: 'string', description: "The tapestryKey of its concept's header" },
    field: { type: 'string', description: 'Its key: the field it is under its parent, in the elements\' JSON' },
    path: { type: 'array', items: { type: 'string' }, description: "The keys from the concept's section down to it, such as ['address', 'city']" },
    parent: { type: 'string', nullable: true, description: 'The tapestryKey of the property it is under; null at the top level, under the primary property' },
    address: { type: 'string', nullable: true, description: 'Its nostr address, 39999:<assistant>:<d>: the address a letter for it would carry' },
    type: { type: 'string', nullable: true, description: 'Its type, or the first type other than null of a list of them' },
    required: { type: 'boolean', description: 'Whether its parent requires it' },
    description: { type: 'string', nullable: true, description: 'Its description, or null' },
    schema: { type: 'object', nullable: true, description: "Its piece of the concept's schema: its definition, with an empty properties where its children's go; null for a node made before these writes, which holds none" },
    hasLetter: { type: 'boolean', description: 'Whether it came from a nostr event' },
  },
});
const PROPERTIES = (description) => ({ type: 'array', items: PROPERTY, description });
const CAUGHT_UP = Object.freeze({
  type: 'object',
  required: ['added', 'changed', 'removed'],
  description: "What the write changed first, bringing the concept's property nodes in line with its schema as it was (Decision 6): each list empty when they already were",
  properties: {
    added: PROPERTIES('The properties given nodes, for fields the schema listed with none, as they now are'),
    changed: PROPERTIES('The nodes rewritten from the schema, as they now are'),
    removed: PROPERTIES("The nodes among the fields that the schema didn't list, taken out, as they were"),
  },
});
const ELEMENT = Object.freeze({
  type: 'object',
  required: ['node', 'name', 'address'],
  properties: {
    node: { type: 'string', description: "The element's tapestryKey" },
    name: { type: 'string', nullable: true },
    address: { type: 'string', nullable: true },
  },
});
const ELEMENTS = Object.freeze({
  type: 'object',
  required: ['judged', 'notJudged', 'stoppedFitting', 'alreadyNotFitting', 'stillHold', 'before', 'limit', 'beyond'],
  nullable: true,
  description: "The concept's elements, each judged by its tapestryJson as the rule element-fits-schema judges an element as it stands, against the schema before the write and after it (Decision 9). None of it stops the write. Null only for already-gone, which judged nothing",
  properties: {
    judged: { type: 'integer', minimum: 0, description: 'How many were judged' },
    notJudged: {
      type: 'object',
      required: ['count', 'missing', 'unreadable'],
      description: "Those that couldn't be judged: no tapestryJson yet (missing: the derive step builds it), or one that isn't an object",
      properties: { count: { type: 'integer', minimum: 0 }, missing: { type: 'integer', minimum: 0 }, unreadable: { type: 'integer', minimum: 0 } },
    },
    stoppedFitting: {
      type: 'object',
      required: ['count', 'elements'],
      description: `Those that fit the schema before and don't after, each with what doesn't fit (at most 20 problems), at most ${MAX_LISTED} named`,
      properties: {
        count: { type: 'integer', minimum: 0 },
        elements: {
          type: 'array',
          items: { type: 'object', required: [...ELEMENT.required, 'problems'], properties: { ...ELEMENT.properties, problems: { type: 'array', items: EL.PROBLEM } } },
        },
      },
    },
    alreadyNotFitting: { type: 'integer', minimum: 0, description: "How many didn't fit before either" },
    stillHold: {
      type: 'object',
      required: ['count', 'elements'],
      description: `For a write that takes a field out, those whose tapestryJson still holds a value at its place under the concept's key, at most ${MAX_LISTED} named; empty otherwise`,
      properties: { count: { type: 'integer', minimum: 0 }, elements: { type: 'array', items: ELEMENT } },
    },
    before: {
      type: 'object',
      nullable: true,
      required: ['problem'],
      description: "Null; or, when the schema before couldn't be judged (it couldn't be read, or doesn't compile), why. Then each element that doesn't fit after counts as having stopped fitting",
      properties: { problem: { type: 'string' } },
    },
    limit: { type: 'integer', description: `The most elements one call judges, ${count(LIMIT)}` },
    beyond: { type: 'boolean', description: 'Whether the concept has more elements than that, which weren\'t judged' },
  },
});
const FILLED_IN = Object.freeze({ type: 'array', items: { type: 'string', enum: ['$schema', 'type', 'required', 'definitions'] }, description: "What the write filled in at the schema's top level, which the json-schema concept requires and it lacked: $schema (draft 2020-12), type object, an empty required list and empty definitions (Decision 3)" });
const LETTER = Object.freeze({ type: 'boolean', description: 'Whether this call changed or took out a node that has a letter (a schema node, a primary property, a property tree graph or a property node that came from an event), which now differs from it until export nostr (A10.34) sends a new one' });
const CACHE = Object.freeze({ type: 'boolean', description: 'Whether this call changed or took out a node the derive step had cached (tapestryJsonUpdatedAt): readers of the cache may see its old JSON until cache rebuild (A10.36)' });

// ── the inputs that need no graph (step 1) ──
/** A field key given as a name: cleaned with create-concept's cleanName, then checked (Decision 4). → the key, or bad-name. */
function cleanKey(raw, input = 'name') {
  const key = CN.cleanName(String(raw));
  const why = key === '__proto__' ? "it can't key a field of an element's JSON: a JSON object built by assignment can't hold it" : CN.nameProblem(key);
  if (why) throw refusal(BAD_NAME.code, `The ${input} ${JSON.stringify(shorten(raw))} can't be a property's key: ${why}. Nothing changed.`, { input });
  return key;
}
/** A description: trimmed and checked → the text ('' to take one out), or bad-description. */
function cleanDescription(raw, input = 'description') {
  const value = String(raw).trim();
  const why = CN.descriptionProblem(value);
  if (why) throw refusal(BAD_DESCRIPTION.code, `That description can't be a property's: ${why}. Nothing changed.`, { input });
  return value;
}
/** What is wrong with a type, in words, or null: one of the seven, or a list of them with none repeated (Decision 4). */
function typeProblem(t) {
  if (typeof t === 'string') return TYPES.includes(t) ? null : `${JSON.stringify(t)} isn't one of JSON Schema's seven types (${TYPES.join(', ')})`;
  if (Array.isArray(t) && t.length) {
    const bad = t.find((x) => typeof x !== 'string' || !TYPES.includes(x));
    if (bad !== undefined) return `its type list holds ${JSON.stringify(bad)}, which isn't one of JSON Schema's seven types (${TYPES.join(', ')})`;
    if (new Set(t).size !== t.length) return 'its type list names a type twice';
    return null;
  }
  if (t === undefined) return 'it has no type, which every property has: one of the seven, or a list of them';
  return `its type ${JSON.stringify(t)} is neither one of JSON Schema's seven types nor a list of them`;
}
/** What is wrong with a schema's key as given, or null: exactly as create-concept's name check leaves it (Decision 4). */
function keyProblem(key) {
  if (key === '__proto__') return "it can't key a field of an element's JSON: a JSON object built by assignment can't hold it";
  const why = CN.nameProblem(key);
  if (why) return why;
  if (CN.cleanName(key) !== key) return "create-concept's name check would change it (white space at either end, or a run of it inside)";
  return null;
}
/** An object, or its JSON text → the object; refuses bad-schema, naming `input`. */
function parseObject(value, input, what) {
  let v = value;
  if (typeof value === 'string') {
    try {
      v = JSON.parse(value);
    } catch {
      throw refusal(BAD_SCHEMA.code, `${input} isn't JSON that parses: give ${what} as a JSON object. Nothing changed.`, { input });
    }
  }
  if (!isObject(v)) throw refusal(BAD_SCHEMA.code, `${input} must be a JSON object, ${what}; it is ${kindOf(v)}. Nothing changed.`, { input });
  return v;
}
/**
 * The piece add-property and update-property take (step 1): an object that holds neither properties nor required (a
 * property's own sub-properties are properties of their own), and says nothing other than a type or description given
 * beside it. → the piece, or bad-schema.
 */
function pieceInput(value, { type, description } = {}) {
  const piece = parseObject(value, 'schema', "the rest of what JSON Schema says about the property, such as '{\"enum\": [\"a\", \"b\"]}'");
  // A keyword is set by assignment when a piece merges (update-property), and __proto__ would set an object's prototype.
  if (has(piece, '__proto__')) throw refusal(BAD_SCHEMA.code, 'schema names __proto__, which no JSON Schema keyword is. Nothing changed.', { input: 'schema' });
  for (const k of ['properties', 'required']) {
    if (has(piece, k)) throw refusal(BAD_SCHEMA.code, `schema names the property's own sub-properties (${k}), which are properties of their own: add each with graph add-property, giving this property as parent, or set the whole schema with graph set-schema. Nothing changed.`, { input: 'schema' });
  }
  if (type !== undefined && has(piece, 'type') && !same(piece.type, type)) {
    throw refusal(BAD_SCHEMA.code, `schema says the type is ${show(piece.type)}, but type is ${show(type)}: give it once, or the same in both. Nothing changed.`, { input: 'schema' });
  }
  if (description !== undefined && has(piece, 'description') && piece.description !== null && piece.description !== description) {
    throw refusal(BAD_SCHEMA.code, `schema says the description is ${show(piece.description)}, but description is ${show(description)}: give it once, or the same in both. Nothing changed.`, { input: 'schema' });
  }
  // A description in the piece becomes the node's description tag, so it is checked as the description input is
  // (Amendment 3, item 2).
  const why = typeof piece.description === 'string' ? CN.descriptionProblem(piece.description) : null;
  if (why) throw refusal(BAD_DESCRIPTION.code, `The description schema gives can't be a property's: ${why}. Nothing changed.`, { input: 'schema' });
  return piece;
}

// ── a document and its pieces (Decisions 1 to 4) ──
/** The piece: a definition minus the contents of its properties, an empty properties kept where it had one (Decision 1). */
function pieceOf(def) {
  const p = copy(def);
  if (isObject(p.properties)) p.properties = {};
  return p;
}
/** A piece's type as a view gives it: its type, or the first type other than null of a list of them. */
function viewType(piece) {
  const t = piece && piece.type;
  if (typeof t === 'string') return t;
  const list = typesOf(t);
  return list.find((x) => x !== 'null') || list[0] || null;
}
/**
 * The property concept's view of a piece (Decision 1), rebuilt on every write: key, type, title and description when
 * the piece has them as text, required when it has a required list, and, when it has children or an empty properties,
 * properties as { <key>: { type } } in their order. Firmware's property schema and the hygiene check read this shape.
 */
function viewOf(key, piece, kids) {
  const v = { key, type: viewType(piece) };
  if (typeof piece.title === 'string') v.title = piece.title;
  if (typeof piece.description === 'string') v.description = piece.description;
  if (Array.isArray(piece.required)) v.required = [...piece.required];
  if (kids.length || isObject(piece.properties)) v.properties = Object.fromEntries(kids.map((k) => [k.field, { type: viewType(k.piece) }]));
  return v;
}

/** The document with its section `section` put back: the frame's keys in their order, properties holding the section alone. */
function documentOf(frame, oKey, section) {
  const props = Object.fromEntries([[oKey, section]]);
  const entries = Object.entries(isObject(frame) ? frame : {}).map(([k, v]) => (k === 'properties' ? [k, props] : [k, v]));
  if (!entries.some(([k]) => k === 'properties')) entries.push(['properties', props]);
  return Object.fromEntries(entries);
}
/** What the json-schema concept requires that the document lacks, filled in, in this order (Decision 3) → { doc, filledIn }. */
function withFillIns(doc) {
  const out = Object.fromEntries(Object.entries(doc));
  const filledIn = [];
  const fill = (k, v) => { if (!has(out, k)) { out[k] = v; filledIn.push(k); } };
  fill('$schema', DRAFT);
  fill('type', 'object');
  fill('required', []);
  fill('definitions', {});
  return { doc: out, filledIn };
}
/** A document as _schemas.js reads one: $schema dropped. */
function asRead(doc) {
  const { $schema, ...rest } = doc;
  void $schema;
  return rest;
}
/** A place in a section, for messages: its keys from the section down, a key that isn't a plain name quoted. */
const placeOf = (oKey, path) => [oKey, ...path].map((k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k))).join('.');

/**
 * Decisions 3 and 4 on a document → null when these writes keep it, or { code, message }: not-wrapped, bad-name,
 * bad-type, schema-too-large, or bad-schema when it isn't an object or doesn't compile, read as _schemas.js reads one.
 * `oKey` is the concept's key, the one top-level property a wrapped schema has; null checks the shape alone.
 */
function schemaProblem(doc, oKey) {
  if (!isObject(doc)) return { code: 'bad-schema', message: `it is ${kindOf(doc)}, not a JSON object` };
  const top = doc.properties;
  const keys = isObject(top) ? Object.keys(top) : [];
  const key = keys.length === 1 ? keys[0] : null;
  const section = key !== null ? top[key] : undefined;
  const found = keys.length ? `its top-level properties are ${keys.map((k) => JSON.stringify(k)).join(', ')}` : 'it has no top-level properties';
  if (doc.type !== undefined && doc.type !== 'object') return { code: 'not-wrapped', message: `its top level has type ${show(doc.type)}, not object` };
  if (key === null) return { code: 'not-wrapped', message: `${found}, where a wrapped schema has one: ${oKey ? `the concept's key, ${oKey}` : "the concept's key"}` };
  if (oKey && key !== oKey) return { code: 'not-wrapped', message: `${found}, but the concept's key is ${oKey}: its elements keep their fields under ${oKey}` };
  if (!isObject(section) || section.type !== 'object') return { code: 'not-wrapped', message: `its ${JSON.stringify(key)} isn't an object with type object, where its elements' fields go` };
  let total = 0;
  const walk = (def, path) => {
    if (def.properties === undefined) return null;
    if (!isObject(def.properties)) return { code: 'bad-schema', message: `the properties at ${placeOf(key, path)} aren't a JSON object` };
    for (const k of Object.keys(def.properties)) {
      const at = [...path, k];
      const kp = keyProblem(k);
      if (kp) return { code: 'bad-name', message: `the key ${JSON.stringify(shorten(k))} at ${placeOf(key, path)} can't be a field's: ${kp}` };
      const child = def.properties[k];
      const tp = isObject(child) ? typeProblem(child.type) : `it is ${kindOf(child)}, not a definition`;
      if (tp) return { code: 'bad-type', message: `the field ${placeOf(key, at)} can't be a property: ${tp}` };
      // Only an object holds properties, and a field's description becomes its node's tag (Amendment 3, items 2 and 3).
      if (child.properties !== undefined && !typesOf(child.type).includes('object')) {
        return { code: 'bad-type', message: `the field ${placeOf(key, at)} holds properties, but its type is ${show(child.type)}, not object: only an object holds properties` };
      }
      const dp = typeof child.description === 'string' ? CN.descriptionProblem(child.description) : null;
      if (dp) return { code: 'bad-description', message: `the description of the field ${placeOf(key, at)} can't be a property's: ${dp}` };
      total += 1;
      if (total > MAX_PROPERTIES) return { code: 'schema-too-large', message: `it has more than ${count(MAX_PROPERTIES)} properties under ${key}, the most these writes keep` };
      if (at.length > MAX_DEPTH) return { code: 'schema-too-large', message: `${placeOf(key, at)} is ${at.length} levels under ${key}, more than the ${MAX_DEPTH} these writes keep` };
      const deeper = walk(child, at);
      if (deeper) return deeper;
    }
    return null;
  };
  const walked = walk(section, []);
  if (walked) return walked;
  const v = X.validatorOf(asRead(doc));
  if (v.problem) return { code: 'bad-schema', message: v.problem };
  return null;
}

// ── the tree, in memory ──
// A tree is { root, recs: Map<ref, rec>, seq }. A rec is one property node: ref (its tapestryKey, or 'new:<n>' for one a
// write makes), key, uuid, field (its key in the schema: the node's name), parent (its parent's ref; null for the
// root, the primary property), piece, order (its children's keys, as its view lists them), and, for a node read from
// the graph, existing, node (as U0 reads one), tags, json, facts (_nodes.js's), hasLetter, own and cached.

/** Each rec's children, in the order its view lists them, then any the list lacks, by key (Decision 2). */
function kidsOf(tree) {
  if (tree.kids) return tree.kids;
  const m = new Map();
  for (const r of tree.recs.values()) {
    if (r.parent === null || r.parent === undefined) continue;
    if (!m.has(r.parent)) m.set(r.parent, []);
    m.get(r.parent).push(r);
  }
  for (const [ref, list] of m) {
    const rec = tree.recs.get(ref);
    const pos = new Map(((rec && rec.order) || []).map((f, i) => [f, i]));
    const at = (r) => (pos.has(r.field) ? pos.get(r.field) : Infinity);
    list.sort((a, b) => at(a) - at(b) || String(a.field).localeCompare(String(b.field)) || String(a.ref).localeCompare(String(b.ref)));
  }
  Object.defineProperty(tree, 'kids', { value: m, enumerable: false });
  return m;
}
const childrenOf = (tree, ref) => kidsOf(tree).get(ref) || [];
/** Every rec under the root, parents first (pre-order), in their order. */
function below(tree, ref = tree.root, out = []) {
  for (const k of childrenOf(tree, ref)) { out.push(k); below(tree, k.ref, out); }
  return out;
}
/** The keys from the section down to a rec. */
function pathOf(tree, rec) {
  const path = [];
  let r = rec;
  while (r && r.ref !== tree.root) { path.unshift(r.field); r = tree.recs.get(r.parent); }
  return path;
}
/** A node's definition, rebuilt from the tree: its piece, with each child's definition in its properties (Decision 2). */
function definitionOf(tree, ref) {
  const rec = tree.recs.get(ref);
  const def = copy(rec.piece);
  const kids = childrenOf(tree, ref);
  if (kids.length || isObject(def.properties)) def.properties = Object.fromEntries(kids.map((k) => [k.field, definitionOf(tree, k.ref)]));
  return def;
}
const sectionOf = (tree) => definitionOf(tree, tree.root);
/** Whether a rec's parent requires it: the parent's piece's required list, or, for a node in the old shape under a parent with no piece, its own flag. */
function requiredIn(tree, rec) {
  const parent = tree.recs.get(rec.parent);
  if (parent && isObject(parent.piece)) return Array.isArray(parent.piece.required) && parent.piece.required.includes(rec.field);
  const old = isObject(rec.json) && isObject(rec.json.property) ? rec.json.property.required : undefined;
  return old === true;
}
/** The rec of a node by its tapestryKey, or null. */
const findRec = (tree, key) => [...tree.recs.values()].find((r) => r.key === key && typeof key === 'string') || null;
/** The definition at a path in a section (null when there is none). */
function defAt(section, path) {
  let d = section;
  for (const k of path) {
    if (!isObject(d) || !isObject(d.properties) || !has(d.properties, k)) return null;
    d = d.properties[k];
  }
  return d;
}

/**
 * The plan that makes `tree` match `section`, by path (Decisions 6 and 7.4): each field matched to the node at the same
 * place, the same parent and a child with that key. → { tree (the tree after it), added, changed, removed, rootChanged }:
 * added, a field with no node (and everything under it), with now; changed, a node whose piece or required flag
 * differs, with was and now ({ schema, required }); removed, a node at a place the section doesn't have, with all
 * under it, each named before those under it. Nothing is written: refs of new nodes are 'new:<n>'.
 */
function planFor(tree, section) {
  const recs = new Map();
  const next = { root: tree.root, recs, seq: tree.seq || 0 };
  const added = [];
  const changed = [];
  const removed = [];
  const root = tree.recs.get(tree.root);
  const orderOf = (def) => (isObject(def.properties) ? Object.keys(def.properties) : []);
  recs.set(root.ref, { ...root, piece: pieceOf(section), order: orderOf(section) });
  const takeOut = (rec, path) => {
    const at = [...path, rec.field];
    removed.push({ ref: rec.ref, path: at });
    for (const k of childrenOf(tree, rec.ref)) takeOut(k, at);
  };
  const walk = (oldRef, newRef, def, path) => {
    const target = isObject(def.properties) ? Object.entries(def.properties) : [];
    const old = oldRef ? childrenOf(tree, oldRef) : [];
    const req = Array.isArray(def.required) ? def.required : [];
    const used = new Set();
    for (const [field, childDef] of target) {
      const at = [...path, field];
      const match = old.find((c) => c.field === field && !used.has(c.ref));
      const piece = pieceOf(childDef);
      const now = { schema: piece, required: req.includes(field) };
      if (match) {
        used.add(match.ref);
        recs.set(match.ref, { ...match, parent: newRef, piece, order: orderOf(childDef) });
        const was = { schema: match.piece === null || match.piece === undefined ? null : copy(match.piece), required: requiredIn(tree, match) };
        if (!same(was, now)) changed.push({ ref: match.ref, path: at, was, now });
        walk(match.ref, match.ref, childDef, at);
      } else {
        next.seq += 1;
        const ref = `new:${next.seq}`;
        recs.set(ref, { ref, key: null, uuid: null, field, parent: newRef, piece, order: orderOf(childDef), existing: false, hasLetter: false, own: true, cached: false });
        added.push({ ref, path: at, now });
        walk(null, ref, childDef, at);
      }
    }
    for (const c of old) if (!used.has(c.ref)) takeOut(c, path);
  };
  walk(root.ref, root.ref, section, []);
  return { tree: next, added, changed, removed, rootChanged: !same(root.piece, recs.get(root.ref).piece) };
}

// ── the reads ──
const PRIMARY_PROPERTIES = (PRIMARY) => `MATCH (h:TapestryNode {tapestryKey: $key})
  MATCH (h)<-[:${PRIMARY}]-(pp:Property)
  RETURN DISTINCT pp.tapestryKey AS key`;
/** P1: the tree, from the primary property: every property node within 33 levels (one more than these writes keep). */
const TREE_KEYS = (MEMBER) => `MATCH (pp:TapestryNode {tapestryKey: $pp})
  MATCH (p:Property)-[:${MEMBER}*1..${MAX_DEPTH + 1}]->(pp)
  RETURN DISTINCT p.tapestryKey AS key`;
const NODES = (MEMBER) => `MATCH (n:TapestryNode)
  WHERE n.tapestryKey IN $keys AND NOT n:GraphChange
  OPTIONAL MATCH (n)-[:${MEMBER}]->(up)
  RETURN n.tapestryKey AS key, n AS n, up.tapestryKey AS up`;
const TAGS = `MATCH (n:TapestryNode)
  WHERE n.tapestryKey IN $keys
  OPTIONAL MATCH (n)-[:HAS_TAG]->(t:NostrEventTag)
  RETURN n.tapestryKey AS key, t.tapestryKey AS tag, t.uuid AS tagUuid, t.type AS type, t.value AS value, t.value1 AS value1, t.value2 AS value2`;
/** The concept whose tree holds a property node: through its parents to a primary property, and on to the header. */
const CONCEPT_OF = (MEMBER, PRIMARY) => `MATCH (p:Property {tapestryKey: $key})
  MATCH (p)-[:${MEMBER}*1..${MAX_DEPTH + 1}]->(pp:Property)-[:${PRIMARY}]->(h)
  WHERE h:ConceptHeader OR h:ListHeader
  RETURN DISTINCT h.tapestryKey AS concept`;
const HELD = 'MATCH (n:NostrEvent|TapestryNode) WHERE n.uuid IN $uuids RETURN n.uuid AS uuid';
const NAMES = `MATCH (n:TapestryNode)
  WHERE n.tapestryKey IN $keys
  OPTIONAL MATCH (n)-[:HAS_TAG]->(t:NostrEventTag {type: 'name'})
  RETURN n.tapestryKey AS key, n.name AS name, n.tapestryValue AS value, n.uuid AS uuid`;
const EDGE = (type) => `MATCH (a:TapestryNode {tapestryKey: $from}) WHERE NOT a:GraphChange
  MATCH (b:TapestryNode {tapestryKey: $to}) WHERE NOT b:GraphChange
  MERGE (a)-[r:\`${type}\`]->(b)
  RETURN count(r) AS n`;
const TAG_DELETE = 'MATCH (t:NostrEventTag:TapestryNode {tapestryKey: $key}) DETACH DELETE t';
const NODE_DELETE = 'MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange DETACH DELETE n';

/** Nodes read whole with their tags → Map<key, { node, ups: [keys], tags: [{ key, uuid, type, value, value1, value2 }] }>. */
async function nodesOf(read, keys) {
  const out = new Map();
  if (!keys.length) return out;
  const { MEMBER } = K.rel();
  for (const r of await read(NODES(MEMBER), { keys })) {
    if (typeof r.key !== 'string' || !isObject(r.n)) continue;
    if (!out.has(r.key)) out.set(r.key, { node: r.n, ups: [], tags: [] });
    const got = out.get(r.key);
    if (typeof r.up === 'string' && !got.ups.includes(r.up)) got.ups.push(r.up);
  }
  for (const r of await read(TAGS, { keys })) {
    const got = out.get(r.key);
    if (!got || r.type === null || r.type === undefined) continue;
    if (!got.tags.some((t) => t.key === r.tag && t.type === r.type)) got.tags.push({ key: r.tag, uuid: r.tagUuid, type: r.type, value: r.value, value1: r.value1, value2: r.value2 });
  }
  return out;
}
const jsonOfTags = (tags) => { const t = tags.find((x) => x.type === 'json'); return t ? K.readJson(t.value) : null; };
const cachedOf = (n) => n.tapestryJsonUpdatedAt !== undefined && n.tapestryJsonUpdatedAt !== null;

/** A node of the tree as a rec (the tree section's comment). */
function recOf(key, got, field) {
  const json = jsonOfTags(got.tags);
  const prop = json && isObject(json.property) ? json.property : null;
  const facts = N.factsOf(key, got.node);
  return {
    ref: key,
    key,
    uuid: typeof got.node.uuid === 'string' ? got.node.uuid : null,
    field,
    parent: null,
    piece: prop && isObject(prop.schema) ? copy(prop.schema) : null,
    order: prop && isObject(prop.properties) ? Object.keys(prop.properties) : [],
    existing: true,
    node: got.node,
    tags: got.tags,
    json,
    facts,
    hasLetter: facts.hasLetter === true,
    own: facts.own === true,
    cached: cachedOf(got.node),
    ups: got.ups,
  };
}

/** The concept's tree, read (P1) → { root, recs, seq, tangled: [{ rec, why }] }. */
async function treeOf(read, { pp, oKey }) {
  const { MEMBER } = K.rel();
  const keys = (await read(TREE_KEYS(MEMBER), { pp })).map((r) => r.key).filter((k) => typeof k === 'string' && k !== pp);
  const got = await nodesOf(read, [pp, ...keys]);
  const recs = new Map();
  const rootGot = got.get(pp);
  if (!rootGot) throw new Error(`the primary property ${pp} went missing while it was read`);
  recs.set(pp, recOf(pp, rootGot, oKey));
  for (const k of keys) {
    const g = got.get(k);
    if (!g) continue;
    recs.set(k, recOf(k, g, typeof g.node.name === 'string' ? g.node.name : ''));
  }
  const tangled = [];
  for (const rec of recs.values()) {
    if (rec.ref === pp) continue;
    if (rec.ups.length !== 1 || !recs.has(rec.ups[0])) tangled.push({ rec, why: `it hangs under ${rec.ups.length} nodes, where a property hangs under one` });
    else rec.parent = rec.ups[0];
  }
  const tree = { root: pp, recs, seq: 0, tangled };
  if (!tangled.length) {
    for (const rec of recs.values()) {
      if (rec.ref === pp) continue;
      const depth = pathOf(tree, rec).length;
      if (depth > MAX_DEPTH) { tangled.push({ rec, why: `it is ${depth} levels below the primary property, more than the ${MAX_DEPTH} these writes keep` }); break; }
    }
  }
  return tree;
}

/** "<name>" (<address>), or the key alone, for messages. */
const labelOfRec = (rec) => (rec.field ? `${JSON.stringify(rec.field)} (${rec.uuid || rec.key})` : (rec.uuid || rec.key));
const conceptLabel = (h) => `${h.names.singular || 'That concept'} (${h.uuid})`;

// ── step 2: installed ──
/** The assistant and the property concept's superset → { ta, superset, propertyUuid }, or not-installed. */
async function requireInstalled(read) {
  const ta = K.assistant();
  if (!ta) throw refusal(NOT_INSTALLED.code, "This instance has no assistant key, the would-be author of every property node these writes make: the firmware isn't installed. Install it first (POST /api/firmware/install), then try again. Nothing changed.");
  const propertyUuid = K.firmwareUuid('property');
  let supersets;
  try {
    supersets = await K.supersetsOf(read, ['property']);
  } catch (e) {
    if (e && e.code === NOT_INSTALLED.code) {
      throw refusal(NOT_INSTALLED.code, `This graph has no property concept with a superset (${propertyUuid || `39998:${ta}:property`}), whose elements a concept's property nodes are: the firmware isn't installed. Install it first (POST /api/firmware/install), then try again. Nothing changed.`);
    }
    throw e;
  }
  return { ta, superset: supersets.property, propertyUuid };
}

/** The header of the concept whose tree holds the property keyed `key` → its tapestryKey, null for none; tangled-tree for two. */
async function conceptOfProperty(read, key) {
  const { MEMBER, PRIMARY } = K.rel();
  const rows = (await read(CONCEPT_OF(MEMBER, PRIMARY), { key })).map((r) => r.concept).filter((c) => typeof c === 'string');
  const concepts = [...new Set(rows)].sort();
  if (concepts.length > 1) throw refusal(TANGLED_TREE.code, `The property ${key} hangs in the property trees of ${concepts.length} concepts (${concepts.join(', ')}), where a property node is one concept's. Nothing changed.`, { input: 'property' });
  return concepts[0] || null;
}

// ── steps 4 to 6 ──
/**
 * The concept keyed `concept`, after the lock: its checks (step 4), its tree's (step 5), and its tree caught up to its
 * current schema (step 6). `setSchema` never refuses for the current schema: set-schema makes the tree match its own,
 * against the tree as it is. `missing` gives the refusal for a key that names no concept header.
 * → { inst, header, oKey, schemaNode, treeGraph, propertiesSet, doc0, section0, before, problem0, t0, t1, plan0, section1 }
 */
async function load(read, concept, { inst, setSchema = false, missing = null } = {}) {
  const facts = await K.conceptFacts(read, concept);
  if (!facts) {
    if (missing) throw missing();
    throw refusal(UNKNOWN_CONCEPT.code, `No concept header has the tapestryKey ${concept}. Name a concept by its header's tapestryKey. Nothing changed.`, { input: 'concept' });
  }
  const h = facts.header;
  if (h.author !== inst.ta) throw refusal(NOT_OWN_CONCEPT.code, `${conceptLabel(h)} isn't this instance's own: its author is ${h.author || 'unknown'}, not the instance's assistant, so its properties are that author's claim (design D4). Nothing changed.`, { input: 'concept' });
  if (K.isFirmware(h.uuid)) throw refusal(FIRMWARE_CONCEPT.code, `${conceptLabel(h)} is a firmware concept, which a firmware reinstall rebuilds from its definition: lifecycle seed-firmware (A10.37) is how its properties change. Nothing changed.`, { input: 'concept' });
  const oKey = h.oKey;
  if (!oKey) throw refusal(setSchema ? NOT_WRAPPED_GIVEN.code : UNREADABLE_SCHEMA.code, `${conceptLabel(h)} has no key, the one its elements keep their fields under, so no schema can be wrapped under it. Nothing changed.`, { input: 'concept' });

  // The schema node: one, as the readers count them (BIBLE §10, rule 11).
  const s = await X.schemaOf(read, concept);
  const schemaKeys = s.node ? [s.node] : (s.nodes || []).map((n) => n.tapestryKey);
  if (schemaKeys.length !== 1) {
    const why = schemaKeys.length ? `more than one JSON schema node (${schemaKeys.join(', ')}), and which one counts isn't guessed (BIBLE §10, rule 11)` : 'no JSON schema node';
    throw refusal('no-schema', `${conceptLabel(h)} has ${why}, so there is no schema for its properties to say. Nothing changed.`, { input: 'concept' });
  }
  const { PRIMARY } = K.rel();
  const pps = (await read(PRIMARY_PROPERTIES(PRIMARY), { key: concept })).map((r) => r.key).filter((k) => typeof k === 'string');
  if (pps.length !== 1) {
    throw refusal(NO_PRIMARY_PROPERTY.code, `${conceptLabel(h)} has ${pps.length ? `${pps.length} primary properties (${pps.sort().join(', ')})` : 'no primary property'}, where its fields' property nodes hang under one (BIBLE §9). Nothing changed.`, { input: 'concept' });
  }

  // The tree (step 5).
  const t0 = await treeOf(read, { pp: pps[0], oKey });
  if (t0.tangled.length) {
    const { rec, why } = t0.tangled[0];
    throw refusal(TANGLED_TREE.code, `${conceptLabel(h)}'s property tree isn't a tree: ${labelOfRec(rec)} ${why}. Nothing changed.`, { input: 'concept' });
  }

  // The schema node and the core nodes its rewrite and the tree graph's need.
  const core = await nodesOf(read, [s.node || schemaKeys[0], facts.roles.propertyTreeGraph, facts.roles.properties].filter((k) => typeof k === 'string'));
  const coreOf = (key) => {
    const g = typeof key === 'string' ? core.get(key) : null;
    if (!g) return null;
    const f = N.factsOf(key, g.node);
    return { key, uuid: g.node.uuid || null, tags: g.tags, json: jsonOfTags(g.tags), hasLetter: f.hasLetter === true, cached: cachedOf(g.node) };
  };
  const schemaNode = coreOf(schemaKeys[0]);
  if (!schemaNode) throw new Error(`the JSON schema node ${schemaKeys[0]} went missing while it was read`);
  const sj = schemaNode.json;
  const doc0 = isObject(sj) ? (isObject(sj.jsonSchema) ? sj.jsonSchema : sj) : null;
  // The schema before, as the rule reads it (Decision 9).
  const before = s.schema ? { schema: s.schema } : { problem: s.problem || "its JSON schema node can't be read" };

  // Whether the current schema can be caught up to (step 6).
  let problem0 = null;
  if (!doc0) problem0 = { code: 'unreadable-schema', message: s.problem || "its JSON schema node holds no schema that can be read" };
  else problem0 = schemaProblem(doc0, oKey);
  if (problem0 && !setSchema) {
    const wrapped = problem0.code === 'not-wrapped';
    throw refusal(wrapped ? NOT_WRAPPED_NOW.code : UNREADABLE_SCHEMA.code, `${conceptLabel(h)}'s JSON schema can't be caught up to: ${problem0.message}. These writes keep ${wrapped ? 'only a wrapped schema' : 'a schema they can read and compile, with typed fields'}; graph set-schema, given one, replaces it. Nothing changed.`, { input: 'concept' });
  }
  let plan0 = null;
  let t1 = t0;
  if (!problem0) {
    const p = planFor(t0, doc0.properties[oKey]);
    t1 = p.tree;
    if (p.added.length || p.changed.length || p.removed.length || p.rootChanged) plan0 = p;
  }
  return {
    inst, header: h, oKey, schemaNode, treeGraph: coreOf(facts.roles.propertyTreeGraph), propertiesSet: coreOf(facts.roles.properties),
    doc0, before, problem0, t0, t1, plan0, section1: problem0 ? null : sectionOf(t1),
  };
}

// ── steps 7 to 12 ──
const shapeOf = (x) => ({ schema: x.schema === null || x.schema === undefined ? null : copy(x.schema), required: x.required === true });
/** A rec's type, for a node in the old shape too: its piece's, else its JSON's, else its type tag's. */
function typeOfRec(rec) {
  if (isObject(rec.piece)) return rec.piece.type;
  const p = isObject(rec.json) && isObject(rec.json.property) ? rec.json.property : null;
  if (p && p.type !== undefined) return p.type;
  const t = (rec.tags || []).find((x) => x.type === 'type');
  return t ? t.value : undefined;
}
const itemTypeOfRec = (rec) => (isObject(rec.piece) && isObject(rec.piece.items) ? rec.piece.items.type : undefined);
const sameTypes = (a, b) => same([...typesOf(a)].sort(), [...typesOf(b)].sort());

/** The node's JSON as the write leaves it (Decisions 1 and 5): its word block, the view and the piece. */
function jsonFor(tree, rec) {
  const kids = childrenOf(tree, rec.ref);
  const property = { ...viewOf(rec.field, rec.piece, kids), schema: copy(rec.piece) };
  const base = isObject(rec.json) ? rec.json : {};
  if (rec.ref === tree.root) return Object.fromEntries([...Object.entries(base).filter(([k]) => k !== 'property'), ['property', property]]);
  const word = isObject(base.word) ? base.word : { slug: dtag.slug(rec.field), name: rec.field, wordTypes: ['word', 'property'] };
  const entries = Object.entries(base).filter(([k]) => k !== 'word' && k !== 'property');
  return Object.fromEntries([['word', word], ...entries, ['property', property]]);
}

/**
 * Steps 7 to 12 of a write whose own change makes the concept's section `target`, with the document's frame taken from
 * `frame` (Decision 7). Everything is planned and checked before anything is written, so a refusal changes nothing:
 * the plan, not-own-node, marked-field, then the new document's size and compile. Then it writes, checks what it wrote
 * against its concepts (Decision 10), reports on the elements (Decision 9), and gives the changes for the entry
 * (Decision 12). `removedFields` are the paths whose values the report counts as still held.
 */
async function commit(tx, read, st, { target, frame }) {
  const { t0, t1, plan0, inst, header: h, oKey } = st;
  const plan1 = planFor(t1, target);
  const t2 = plan1.tree;
  // A node catching up would add and the write's own change takes out again changes nothing, so neither is recorded.
  const phantom = new Set((plan0 ? plan0.added : []).map((a) => a.ref).filter((ref) => !t2.recs.has(ref)));
  const caught = plan0 ? { added: plan0.added.filter((a) => !phantom.has(a.ref)), changed: plan0.changed, removed: plan0.removed } : { added: [], changed: [], removed: [] };
  const own = { added: plan1.added, changed: plan1.changed, removed: plan1.removed.filter((r) => !phantom.has(r.ref)) };

  // The document the schema node will hold: the frame with the section rebuilt from the tree, and Decision 3's fill-ins.
  const { doc: newDoc, filledIn } = withFillIns(documentOf(frame, oKey, sectionOf(t2)));
  const docChanged = !same(st.doc0, newDoc);

  // What the write takes out, makes and rewrites.
  const removedRecs = [...t0.recs.values()].filter((r) => r.ref !== t0.root && !t2.recs.has(r.ref));
  const kept = [t2.recs.get(t2.root), ...below(t2)];
  const newRecs = kept.filter((r) => !r.existing);
  const want = new Map(kept.map((r) => [r.ref, jsonFor(t2, r)]));
  const rewritten = kept.filter((r) => r.existing && (!same(r.json, want.get(r.ref)) || (r.ref !== t2.root && tagsDiffer(r, want.get(r.ref)))));

  // not-own-node (step 5's, now that the write's changes are known).
  const theirs = [...removedRecs, ...rewritten].find((r) => !r.own);
  if (theirs) {
    const what = removedRecs.includes(theirs) ? 'take it out' : 'rewrite it';
    const whose = theirs.hasLetter ? `came from an event ${theirs.facts.author} signed` : `records ${theirs.facts.author} as its author`;
    throw refusal(NOT_OWN_NODE.code, `${labelOfRec(theirs)}, a property node of ${conceptLabel(h)}, ${whose}, and that author isn't one of this instance's own keys, its assistant's or its owner's. This write would ${what}, but it is that author's claim, which an operation never changes (design D4). Nothing changed.`);
  }

  // The marks (Decision 8).
  for (const m of await F.marksOf(read, { concept: h.key })) {
    const was = t0.recs.get(m.node);
    if (!was) continue;
    const now = t2.recs.get(m.node);
    const why = !now ? 'take it out'
      : !sameTypes(typeOfRec(was), typeOfRec(now)) ? `change its type from ${show(typeOfRec(was))} to ${show(typeOfRec(now))}`
        : !same(itemTypeOfRec(was), itemTypeOfRec(now)) ? `change its list's item type from ${show(itemTypeOfRec(was))} to ${show(itemTypeOfRec(now))}` : null;
    if (why) {
      throw refusal(MARKED_FIELD.code, `${conceptLabel(h)}'s field ${m.field} is marked: its elements carry it on their nodes as ${m.property}. This write would ${why}, so the copies would no longer be what the field holds. Take the mark and its copies off first with graph unmark-field, then try again. Nothing changed.`);
    }
  }

  // The new document (step 9).
  const p = schemaProblem(newDoc, oKey);
  if (p) {
    const code = p.code === 'schema-too-large' ? SCHEMA_TOO_LARGE.code : BAD_SCHEMA.code;
    throw refusal(code, `The schema this write would leave ${conceptLabel(h)} with can't be kept: ${p.message}. Nothing changed.`);
  }

  // Addresses for the nodes it makes, parents first: BIBLE §9's d-tag, then the first free nonce (Decision 5).
  const ids = new Map([...t0.recs.values(), ...kept].filter((r) => r.existing).map((r) => [r.ref, { key: r.key, uuid: r.uuid }]));
  const freed = new Set(removedRecs.map((r) => r.uuid).filter(Boolean));
  const taken = new Set();
  let pending = [...newRecs];
  while (pending.length) {
    const ready = pending.filter((r) => ids.has(r.parent) && ids.get(r.parent).uuid);
    if (!ready.length) throw new Error('a new property node\'s parent has no address');
    const cands = new Map(ready.map((r) => {
      const parentUuid = ids.get(r.parent).uuid;
      const list = [];
      for (let n = 0; n <= MAX_NONCE; n++) list.push(`39999:${inst.ta}:${n === 0 ? dtag.childDTag(r.field, parentUuid) : dtag.childDTag(r.field, parentUuid, n)}`);
      return [r.ref, list];
    }));
    // Each node's plain d-tag first. Its nonces are read when that plain address is held, already taken by this write,
    // or shared with another new node of this level, as two keys that slug alike share one. So a node is never given a
    // nonce whose holder wasn't read (review round 1, finding 9; round 2, blocking 1; SS10).
    const heldOf = async (uuids) => new Set((uuids.length ? await read(HELD, { uuids }) : []).map((x) => x.uuid).filter((u) => typeof u === 'string' && !freed.has(u)));
    const plainOf = (r) => cands.get(r.ref)[0];
    const sharing = new Map();
    for (const r of ready) sharing.set(plainOf(r), (sharing.get(plainOf(r)) || 0) + 1);
    const held = await heldOf(ready.map(plainOf));
    const crowded = ready.filter((r) => held.has(plainOf(r)) || taken.has(plainOf(r)) || sharing.get(plainOf(r)) > 1);
    for (const u of await heldOf(crowded.flatMap((r) => cands.get(r.ref).slice(1)))) held.add(u);
    for (const r of ready) {
      const address = cands.get(r.ref).find((u) => !held.has(u) && !taken.has(u));
      if (!address) throw refusal(NO_FREE_ADDRESS.code, `Every address the property ${placeOf(oKey, pathOf(t2, r))} would take is held: ${cands.get(r.ref)[0]}, and each versioning nonce to ~${MAX_NONCE}. Nothing changed.`);
      taken.add(address);
      ids.set(r.ref, { key: null, uuid: address });
    }
    pending = pending.filter((r) => !ids.has(r.ref));
  }

  // ── the writes (step 10) ──
  const { MEMBER, TERM } = K.rel();
  // The nodes taken out, each read whole first, so its change entry keeps it (Decision 12), then deleted, tags first.
  const wholes = new Map();
  for (const r of removedRecs) wholes.set(r.ref, await N.wholeNodeOf(read, r.key, { node: r.node, label: labelOfRec(r) }));
  for (const r of removedRecs) {
    const whole = wholes.get(r.ref);
    for (const t of whole ? whole.tags : []) await tx.run(TAG_DELETE, { key: t.key });
    const { counters } = await tx.run(NODE_DELETE, { key: r.key });
    if (counters && counters.nodesDeleted !== 1) throw new Error(`${labelOfRec(r)} went missing while it was taken out; try again`);
  }
  // The nodes made: each with no event (ADR 0016 Decision 1), under its parent, an element of the property concept.
  const createdAt = Math.floor(Date.now() / 1000);
  for (const r of newRecs) {
    const { uuid } = ids.get(r.ref);
    const json = want.get(r.ref);
    const desc = typeof r.piece.description === 'string' ? r.piece.description : null;
    const tags = [['d', dOf(uuid)], ['name', r.field], ...(desc ? [['description', desc]] : []), ['type', json.property.type], ['z', inst.propertyUuid], ['json', JSON.stringify(json)]];
    const key = await E.makeNode(tx, { uuid, kind: 39999, labels: ['ListItem', 'Property'], name: r.field, tags, pubkey: inst.ta, createdAt });
    ids.set(r.ref, { key, uuid });
    await edge(tx, MEMBER, key, ids.get(r.parent).key);
    await edge(tx, TERM, inst.superset, key);
  }
  // The nodes rewritten: their json tags, and a property's type and description tags, in one statement.
  const rows = [];
  const adds = [];
  const drops = [];
  const tagKey = (node, t) => {
    if (typeof t.key !== 'string') throw new Error(`the ${t.type} tag of ${node.uuid || node.key} has no tapestryKey, so it can't be changed; run lifecycle migrate first`);
    return t.key;
  };
  for (const r of rewritten) {
    const json = want.get(r.ref);
    const add = [];
    const jt = r.tags.find((t) => t.type === 'json');
    if (!same(r.json, json)) { if (jt) rows.push({ key: tagKey(r, jt), props: { value: JSON.stringify(json) } }); else add.push(['json', JSON.stringify(json)]); }
    if (r.ref !== t2.root) {
      const tt = r.tags.find((t) => t.type === 'type');
      if (!tt) add.push(['type', json.property.type]);
      else if (tt.value !== json.property.type) rows.push({ key: tagKey(r, tt), props: { value: json.property.type } });
      const dt = r.tags.find((t) => t.type === 'description');
      const desc = typeof r.piece.description === 'string' && r.piece.description ? r.piece.description : null;
      if (dt && !desc) drops.push(tagKey(r, dt));
      else if (dt && dt.value !== desc) rows.push({ key: tagKey(r, dt), props: { value: desc } });
      else if (!dt && desc) add.push(['description', desc]);
    }
    if (add.length) adds.push({ key: r.key, uuid: r.uuid, tags: add, from: r.tags.length });
  }
  // The schema node, and the property tree graph (Decision 1).
  const schemaJson = isObject(st.schemaNode.json) && isObject(st.schemaNode.json.jsonSchema)
    ? Object.fromEntries(Object.entries(st.schemaNode.json).map(([k, v]) => (k === 'jsonSchema' ? [k, newDoc] : [k, v])))
    : { jsonSchema: newDoc };
  const coreWrites = [];
  const writeCore = (node, json) => {
    if (!node || same(node.json, json)) return;
    const jt = node.tags.find((t) => t.type === 'json');
    if (jt) rows.push({ key: tagKey(node, jt), props: { value: JSON.stringify(json) } });
    else adds.push({ key: node.key, uuid: node.uuid, tags: [['json', JSON.stringify(json)]], from: node.tags.length });
    coreWrites.push({ node, json });
  };
  writeCore(st.schemaNode, schemaJson);
  const tg = treeGraphJson(st, t2, ids, MEMBER);
  if (tg) writeCore(st.treeGraph, tg);
  if (rows.length) {
    const written = await F.writeCopies(tx, rows);
    if (written !== rows.length) throw new Error(`the write wrote ${written} of its ${rows.length} tags: one went missing while it was written`);
  }
  for (const a of adds) await E.addTags(tx, a.key, E.tagRows(a.uuid, a.tags, a.from));
  for (const k of drops) await tx.run(TAG_DELETE, { key: k });

  // ── what was written is checked (step 11; Decision 10) ──
  // Each node written, against each concept it is an element of, word's and graphContext's aside, as the rule
  // element-fits-schema judges a write's JSON: as written, and, for a node that existed, as it was. Only a finding the
  // write introduces refuses: a concept the node fitted before, or a problem its JSON didn't have. One the instance's
  // schemas already had stays theirs, as firmware's graph schema, which every tree graph create-concept makes fails
  // (ADR 0018 Amendment 2, the owner's ruling). The items carry their node's key, which the rule doesn't read.
  const afterByKey = new Map();
  const beforeByKey = new Map();
  for (const r of [...newRecs, ...rewritten]) {
    afterByKey.set(ids.get(r.ref).key, want.get(r.ref));
    if (r.existing && isObject(r.json)) beforeByKey.set(r.key, r.json);
  }
  for (const c of coreWrites) {
    afterByKey.set(c.node.key, c.json);
    if (isObject(c.node.json)) beforeByKey.set(c.node.key, c.node.json);
  }
  const pairs = await F.conceptsOfNodes(read, [...afterByKey.keys()]);
  const headers = pairs.length ? await K.headersByKey(read, [...new Set(pairs.map((x) => x.concept))]) : [];
  const reserved = new Set(headers.filter((x) => EL.RESERVED_KEYS.includes(x.oKey)).map((x) => x.key));
  const judged = pairs.filter((x) => !reserved.has(x.concept));
  const { findRule } = require('../../rules');
  const rule = findRule('element-fits-schema');
  if (!rule) throw new Error("the rule element-fits-schema isn't loaded");
  const afterFound = await rule.violations(judged.map((x) => ({ concept: x.concept, json: afterByKey.get(x.key), key: x.key })), read);
  const beforeFound = await rule.violations(judged.filter((x) => beforeByKey.has(x.key)).map((x) => ({ concept: x.concept, json: beforeByKey.get(x.key), key: x.key })), read);
  const broken = afterFound.filter((f) => {
    if (!beforeByKey.has(f.item.key)) return true;
    const was = beforeFound.find((b) => b.item.key === f.item.key && b.concept === f.concept && b.code === f.code);
    if (!was) return true;
    const held = new Set((was.problems || []).map((p) => p.message));
    return (f.problems || []).some((p) => !held.has(p.message));
  });
  if (broken.length) throw refusal(broken[0].code, broken.map((x) => x.message).join(' '), { rule: rule.name });

  // ── the report (step 12; Decision 9) ──
  const removedPaths = [...caught.removed, ...own.removed].map((r) => r.path);
  const elements = await reportOf(read, { concept: h.key, oKey, before: st.before, after: asRead(newDoc), removedPaths });

  // ── the answer's properties, and the entry's changes (Decisions 12 and 14) ──
  const propertyIn = (tree, ref) => {
    const rec = tree.recs.get(ref);
    const parent = tree.recs.get(rec.parent);
    const id = ids.get(ref) || { key: rec.key, uuid: rec.uuid };
    const old = isObject(rec.json) && isObject(rec.json.property) ? rec.json.property : {};
    const descTag = (rec.tags || []).find((t) => t.type === 'description');
    const description = isObject(rec.piece) ? (typeof rec.piece.description === 'string' ? rec.piece.description : null)
      : (typeof old.description === 'string' ? old.description : descTag ? descTag.value : null);
    const type = isObject(rec.piece) ? viewType(rec.piece) : (typeof typeOfRec(rec) === 'string' ? typeOfRec(rec) : viewType({ type: typeOfRec(rec) }));
    return {
      property: id.key,
      concept: h.key,
      field: rec.field,
      path: pathOf(tree, rec),
      parent: parent && parent.ref !== tree.root ? ((ids.get(parent.ref) || {}).key || parent.key || null) : null,
      address: id.uuid || null,
      type: type || null,
      required: requiredIn(tree, rec),
      description,
      schema: isObject(rec.piece) ? copy(rec.piece) : null,
      hasLetter: rec.hasLetter === true,
    };
  };
  const now = (ref) => propertyIn(t2.recs.has(ref) ? t2 : t1, ref);
  const thenIn = (tree) => (ref) => propertyIn(tree.recs.has(ref) ? tree : t0, ref);
  const changes = [];
  const entry = (name, x, extra, catchUp) => ({ change: name, concept: h.key, node: (ids.get(x.ref) || {}).key, field: x.path[x.path.length - 1], path: x.path, ...extra, ...(catchUp ? { catchUp: true } : {}) });
  const removedEntry = (x, catchUp) => entry('property-removed', x, { was: wholeRecord((ids.get(x.ref) || {}).key, wholes.get(x.ref)) }, catchUp);
  for (const a of caught.added) changes.push(entry('property-added', a, { now: shapeOf(a.now) }, true));
  for (const c of caught.changed) changes.push(entry('property-changed', c, { was: shapeOf(c.was), now: shapeOf(c.now) }, true));
  for (const r of caught.removed) changes.push(removedEntry(r, true));
  for (const a of own.added) changes.push(entry('property-added', a, { now: shapeOf(a.now) }, false));
  for (const c of own.changed) changes.push(entry('property-changed', c, { was: shapeOf(c.was), now: shapeOf(c.now) }, false));
  for (const r of own.removed) changes.push(removedEntry(r, false));
  if (docChanged) changes.push({ change: 'schema-changed', concept: h.key, node: st.schemaNode.key, was: st.doc0 === null ? null : copy(st.doc0), now: copy(newDoc) });

  const touched = [...removedRecs, ...rewritten, ...coreWrites.map((c) => c.node)];
  return {
    t0, t1, t2, plan1, newDoc, filledIn, docChanged, elements, changes,
    letterOutOfDate: touched.some((r) => r.hasLetter === true),
    cacheOutOfDate: touched.some((r) => r.cached === true),
    caughtUp: { added: caught.added.map((a) => now(a.ref)), changed: caught.changed.map((c) => now(c.ref)), removed: caught.removed.map((r) => thenIn(t0)(r.ref)) },
    own: { added: own.added.map((a) => now(a.ref)), changed: own.changed.map((c) => now(c.ref)), removed: own.removed.map((r) => thenIn(t1)(r.ref)) },
    now,
  };
}

/** Whether a property node's type or description tag differs from what its JSON says. */
function tagsDiffer(rec, json) {
  const tt = rec.tags.find((t) => t.type === 'type');
  if (!tt || tt.value !== json.property.type) return true;
  const dt = rec.tags.find((t) => t.type === 'description');
  const desc = typeof json.property.description === 'string' && json.property.description ? json.property.description : null;
  return dt ? dt.value !== desc : desc !== null;
}

/** An edge between two keyed nodes, made once (create-concept's statement). */
async function edge(tx, type, from, to) {
  const { rows } = await tx.run(EDGE(type), { from, to });
  if (!rows.length || Number(rows[0].n) !== 1) throw new Error(`a ${type} relationship of a new property node found ${rows.length ? rows[0].n : 0} pairs of nodes to join, not 1`);
}

/**
 * The property tree graph's JSON as the write leaves it (Decision 1): the schema node, the primary property, the
 * properties set and every property node, each { slug, uuid }, and each one's IS_A_PROPERTY_OF, in create-concept's
 * shape. A property node goes by its d-tag, since two properties under different parents can share a key. Null when the
 * concept has no tree graph whose JSON can be read: it is left as it is.
 */
function treeGraphJson(st, t2, ids, MEMBER) {
  const tg = st.treeGraph;
  if (!tg || !isObject(tg.json)) return null;
  const old = tg.json;
  const g = isObject(old.graph) ? old.graph : {};
  const slugOf = (n) => (n && isObject(n.json) && isObject(n.json.word) && typeof n.json.word.slug === 'string' ? n.json.word.slug : dOf(n && n.uuid));
  const root = t2.recs.get(t2.root);
  const schemaSlug = slugOf(st.schemaNode);
  const ppSlug = slugOf(root);
  const nodes = [{ slug: schemaSlug, uuid: st.schemaNode.uuid }, { slug: ppSlug, uuid: root.uuid }];
  if (st.propertiesSet) nodes.push({ slug: slugOf(st.propertiesSet), uuid: st.propertiesSet.uuid });
  const relationships = [{ nodeFrom: { slug: ppSlug }, relationshipType: { slug: MEMBER }, nodeTo: { slug: schemaSlug } }];
  for (const r of below(t2)) {
    const uuid = ids.get(r.ref).uuid;
    const parent = t2.recs.get(r.parent);
    nodes.push({ slug: dOf(uuid), uuid });
    relationships.push({ nodeFrom: { slug: dOf(uuid) }, relationshipType: { slug: MEMBER }, nodeTo: { slug: parent.ref === t2.root ? ppSlug : dOf(ids.get(parent.ref).uuid) } });
  }
  const graph = Object.fromEntries([...Object.entries(g).filter(([k]) => !['nodes', 'relationshipTypes', 'relationships', 'imports'].includes(k)),
    ['nodes', nodes], ['relationshipTypes', [{ slug: MEMBER }]], ['relationships', relationships], ['imports', Array.isArray(g.imports) ? g.imports : []]]);
  return Object.fromEntries([...Object.entries(old).map(([k, v]) => (k === 'graph' ? [k, graph] : [k, v])), ...(has(old, 'graph') ? [] : [['graph', graph]])]);
}

/** A node taken out, as its change entry keeps it (Decision 12): labels, properties, relationships and tags, each relationship with its from and to. */
function wholeRecord(key, whole) {
  if (!whole) return null;
  const sortKeys = (o) => (isObject(o) ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])) : {});
  const propsOf = (n) => sortKeys(Object.fromEntries(Object.entries(isObject(n) ? n : {}).filter(([k]) => k !== '_labels' && k !== '_id')));
  const rel = (from, r) => ({ type: r.type, direction: r.direction, from: r.direction === 'out' ? from : r.tapestryKey, to: r.direction === 'out' ? r.tapestryKey : from, other: r.tapestryKey, properties: sortKeys(r.properties) });
  const ownTags = new Set(whole.tags.map((t) => t.key));
  const tags = whole.tags.map((t) => {
    const props = propsOf(t.node);
    const record = { labels: [...(Array.isArray(t.node && t.node._labels) ? t.node._labels : [])].sort(), properties: props };
    const stored = N.storedOf(props.value);
    if (stored !== undefined) record.stored = stored;
    record.relationships = t.rels.filter((r) => !(r.direction === 'in' && r.type === 'HAS_TAG' && r.tapestryKey === key)).map((r) => rel(t.key, r));
    return record;
  });
  return {
    labels: [...(Array.isArray(whole.node._labels) ? whole.node._labels : [])].sort(),
    properties: propsOf(whole.node),
    relationships: whole.relationships.filter((r) => !ownTags.has(r.tapestryKey)).map((r) => rel(key, r)),
    tags,
  };
}

/** Whether a document holds a value at a path under the concept's key. */
function holds(json, oKey, path) {
  let v = isObject(json) ? json[oKey] : undefined;
  for (const k of path) {
    if (!isObject(v) || !has(v, k)) return false;
    v = v[k];
  }
  return v !== undefined;
}

/**
 * The report on the concept's elements (Decision 9): each element's tapestryJson judged against the schema before and
 * after, with _schemas.js's own compile and words, so its verdicts are the rule's; and, for a write that takes fields
 * out, those that still hold one. It never refuses.
 */
async function reportOf(read, { concept, oKey, before, after, removedPaths }) {
  const found = await F.elementsOf(read, { key: concept, oKey }, LIMIT + 1);
  const beyond = found.length > LIMIT;
  const list = found.slice(0, LIMIT).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  const vAfter = X.validatorOf(after);
  if (vAfter.problem) throw new Error(`the schema this write leaves doesn't compile, which its check should have refused: ${vAfter.problem}`);
  const vBefore = before.problem ? before : X.validatorOf(before.schema);
  const out = { judged: 0, notJudged: { count: 0, missing: 0, unreadable: 0 }, stopped: [], alreadyNotFitting: 0, still: [] };
  for (const e of list) {
    const t = X.tapestryJsonOf(e.key);
    if (t.problem) {
      out.notJudged.count += 1;
      if (t.missing) out.notJudged.missing += 1; else out.notJudged.unreadable += 1;
      continue;
    }
    out.judged += 1;
    const a = vAfter.check(t.json);
    if (!a.fits) {
      const b = vBefore.problem ? null : vBefore.check(t.json);
      if (b === null || b.fits) out.stopped.push({ e, problems: a.problems.slice(0, X.MAX_LISTED) });
      else out.alreadyNotFitting += 1;
    }
    if (removedPaths.some((p) => holds(t.json, oKey, p))) out.still.push(e);
  }
  const named = [...out.stopped.slice(0, MAX_LISTED).map((x) => x.e), ...out.still.slice(0, MAX_LISTED)];
  const names = new Map();
  if (named.length) {
    for (const r of await read(NAMES, { keys: [...new Set(named.map((e) => e.key))] })) {
      if (!names.has(r.key)) names.set(r.key, { name: (typeof r.value === 'string' && r.value) || (typeof r.name === 'string' && r.name) || null, address: r.uuid || null });
    }
  }
  const el = (e) => ({ node: e.key, name: (names.get(e.key) || {}).name || null, address: (names.get(e.key) || {}).address || e.uuid || null });
  return {
    judged: out.judged,
    notJudged: out.notJudged,
    stoppedFitting: { count: out.stopped.length, elements: out.stopped.slice(0, MAX_LISTED).map((x) => ({ ...el(x.e), problems: x.problems })) },
    alreadyNotFitting: out.alreadyNotFitting,
    stillHold: { count: out.still.length, elements: out.still.slice(0, MAX_LISTED).map(el) },
    before: vBefore.problem ? { problem: vBefore.problem } : null,
    limit: LIMIT,
    beyond,
  };
}

/** The keywords where two definitions differ, in words, for name-in-use. */
function differences(holds_, asks, heldRequired, askedRequired) {
  const out = [];
  const keys = [...new Set([...Object.keys(holds_), ...Object.keys(asks)])].filter((k) => k !== 'properties');
  for (const k of keys) if (!same(holds_[k], asks[k])) out.push(`${k}: it holds ${show(holds_[k])}, the call gives ${show(asks[k])}`);
  if (isObject(holds_.properties) && Object.keys(holds_.properties).length) out.push(`it has properties under it (${Object.keys(holds_.properties).join(', ')})`);
  if (heldRequired !== askedRequired) out.push(`required: it is ${heldRequired ? '' : 'not '}required, the call asks for ${askedRequired ? 'required' : 'not required'}`);
  return out;
}

module.exports = {
  TYPES, DRAFT, MAX_DEPTH, MAX_PROPERTIES, MAX_NONCE, MAX_LISTED, LIMIT, MAX_JSON,
  NOT_INSTALLED, UNKNOWN_CONCEPT, FIRMWARE_CONCEPT, NOT_OWN_CONCEPT, NO_PRIMARY_PROPERTY, NOT_WRAPPED_NOW, NOT_WRAPPED_GIVEN,
  UNREADABLE_SCHEMA, TANGLED_TREE, NOT_OWN_NODE, BAD_NAME, BAD_TYPE, BAD_DESCRIPTION, BAD_PARENT, BAD_SCHEMA, NAME_IN_USE,
  HAS_PROPERTIES, MARKED_FIELD, SCHEMA_TOO_LARGE, NO_FREE_ADDRESS, NOTHING_TO_CHANGE, UNKNOWN_PROPERTY,
  PIECE_INPUT, PROPERTY, PROPERTIES, CAUGHT_UP, ELEMENTS, FILLED_IN, LETTER, CACHE,
  isObject, has, copy, same, typesOf, show, cleanKey, cleanDescription, typeProblem, keyProblem, parseObject, pieceInput,
  pieceOf, viewType, viewOf, documentOf, withFillIns, schemaProblem, placeOf,
  childrenOf, below, pathOf, definitionOf, sectionOf, requiredIn, findRec, defAt, planFor, differences,
  requireInstalled, conceptOfProperty, load, commit, labelOfRec, conceptLabel,
};
