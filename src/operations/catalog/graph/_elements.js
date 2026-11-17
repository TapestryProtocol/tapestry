'use strict';
/**
 * What the element writes share (story graph-operations-first-slice #20; ADR graph-operations-first-slice/0020
 * Implementation notes): graph create-element now, and graph update-node (A10.21) and graph add-to-concept (A10.22)
 * when they are built. An element is the node the nostr import would make of the letter its write would sign, made
 * with no event (_eventless.js), and its fields are held to its concept's schema by _schemas.js.
 *
 *   FIELDS_INPUT, parseFields(value, { name, slug })  the fields input: an object or its JSON text (Decisions 1 and 2)
 *   cleanName(raw)                                    the name, cleaned and checked as create-concept checks one (Decision 5)
 *   the refusals the element writes share, with their wording (Decision 18)
 *   MADE_ELSEWHERE, madeElsewhere(uuid)               the concepts whose elements another operation makes (Decision 4)
 *   RESERVED_KEYS                                     the top-level keys an element's JSON keeps for itself (Amendment 1)
 *   whereTo(read, { concept, superset, set })         where the element goes, and the concepts that reach it (Decision 3)
 *   findRepeat(read, { concept, name, ta, address })  this instance's own element the call repeats, or null (Decision 6)
 *   differsOf(repeat, { name, set, fields, oKey })    each input given that differs from what the element holds
 *   freeAddress(read, { name, header, ta })           the first address the name gives that no node holds (Decision 5)
 *   elementJson({ header, name, slug, fields, others }) the element's word-wrapper JSON (Decision 8)
 *   elementTags({ d, name, header, set, json })       the tags of the letter the write would sign (Decision 9)
 *   describeElement({ key, address, name, slug, concept, parents, hasLetter })  an element as the answer gives it (Decision 14)
 *   link(tx, from, to)                                one HAS_ELEMENT from a superset or set to the element (Decision 10)
 *
 * graph update-node adds (story graph-operations-first-slice #21; ADR graph-operations-first-slice/0021, Decisions 4,
 * 8–10 and 17, and Amendment 1):
 *   CHANGED_ELSEWHERE, changedElsewhere({ conceptUuids, labels, uuid })  the nodes another operation changes, by
 *                                                     their concepts, then by their role labels, and the operation each
 *                                                     refusal names; say.changedElsewhere words it
 *   firmwareElements(), firmwareElementOf(uuid)       the address install gives each firmware element file, and the file
 *   repeatsOf(read, { concept, name, authors, address })  every element of the concept the name repeats, by those
 *                                                     authors: E3 with e.pubkey IN $authors; findRepeat is its first
 *                                                     with the assistant alone
 *   mergeSection(section, fields)                     the fields merged into a section: each given value in its place
 *                                                     or at the end, a null taking a field out, an object replaced whole
 *   renamedJson(json, { was, now })                   a rename's JSON: each section's name and slug, and the word block's
 *                                                     name, title and slug, where they held what the old name gave
 *   CONCEPTS                                          the schema of an answer's concepts, each with whether it fits
 *
 * Like _nodes.js and _sets.js, it opens nothing when it loads: firmware, the assistant's key and the LMDB store are
 * required when first called. It never signs, publishes or reads a key.
 */

const dtag = require('../../../lib/dtag');
const CN = require('../../../lib/conceptNames');
const { refusal } = require('../../refusal');
const S = require('./_sets');

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const own = (o, k) => isObject(o) && Object.prototype.hasOwnProperty.call(o, k);
const count = (n) => n.toLocaleString('en-US');
/** JSON with every object's keys sorted, so two values are compared as JSON, not by their keys' order. */
// Copied with Object.fromEntries, which keeps every key as the object's own, a __proto__ key included.
const canon = (x) => JSON.stringify(x, (k, v) => (isObject(v) ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, v[key]])) : v));
const shorten = (s) => (String(s).length > 60 ? `${String(s).slice(0, 57)}…` : String(s));

/** The longest an element's JSON may be, and its fields' text (Decisions 1 and 7). */
const MAX_JSON = 1000000;
const MAX_NONCE = 99;

/** The fields input: an object in a JSON body, or its JSON text from a command line, which makes no object (Decision 1). */
const FIELDS_INPUT = {
  schema: { oneOf: [{ type: 'object' }, { type: 'string', maxLength: MAX_JSON }] },
  description: "The element's fields, which go in its JSON under the concept's key: an object, or its JSON text, as a command line gives it, such as '{\"description\": \"a dog\"}'. Left out, none. A name or slug given must be the one the name gives",
};

// ── the refusals (Decision 18) ──
const BAD_NAME = Object.freeze({ code: 'bad-name', status: 400, when: 'A name that is empty once trimmed, has no slug, has a control character, a text-direction control or an invisible character that draws nothing where it is, or is longer than 200 characters, as create-concept refuses a name; the refusal names the character when one is the problem' });
const BAD_FIELDS = Object.freeze({ code: 'bad-fields', status: 400, when: `Fields that aren't a JSON object or its text, that give a name or a slug other than the ones the name gives, or that would make the element's JSON longer than ${count(MAX_JSON)} characters` });
const MADE_ELSEWHERE_REFUSAL = Object.freeze({ code: 'made-elsewhere', status: 409, when: 'A concept whose elements another operation makes, with wiring an element made here would lack: the concept-header concept and the seven core-node concepts (graph create-concept), set (graph create-set), property (graph add-property) and graph rule (the rulebook, through firmware); the refusal names the operation to use' });
const NO_SUPERSET = Object.freeze({ code: 'no-superset', status: 409, when: 'A concept with no superset, so no class thread to put the element in (BIBLE §10, rule 1)' });
const NOT_INSTALLED = Object.freeze({ code: 'not-installed', status: 409, when: 'The instance has no assistant key, the would-be author of every node a write makes' });
const UNKNOWN_SET = Object.freeze({ code: 'unknown-node', status: 404, when: 'A set that names no node of the graph (a change entry is not one)' });
const NOT_A_SET = Object.freeze({ code: 'not-a-set', status: 409, when: "A set that is neither a set nor a superset: an element, a concept header (the refusal names its superset, the key to pass), a node with no address, such as one of the trust pipeline's card sets, or any other node" });
const NOT_IN_CLASS_THREAD = Object.freeze({ code: 'not-in-class-thread', status: 409, when: "A set outside the concept's class thread: no chain of class-thread links runs down to it from the concept's superset; the refusal names the concept and its superset" });
const NO_FREE_ADDRESS = Object.freeze({ code: 'no-free-address', status: 409, when: `Every address the name gives is held, its d-tag and each versioning nonce to ~${MAX_NONCE}` });
const RESERVED_KEY = Object.freeze({ code: 'reserved-key', status: 409, when: "A concept whose key is word or graphContext, keys an element's JSON keeps for itself: its word block, and the derive step's graphContext; the refusal names the key" });

/**
 * The top-level keys an element's JSON keeps for itself (ADR graph-operations-first-slice/0020 Amendment 1, item 2):
 * word, its word block, which names it (Decision 8), and graphContext, which the derive step writes into its cached
 * JSON. A concept's section filed under either would replace that block, or be replaced in the cache.
 */
const RESERVED_KEYS = Object.freeze(['word', 'graphContext']);

/**
 * The concepts whose elements another operation makes, by firmware slug, and the operation each refusal names
 * (Decision 4). Each is matched by its firmware address on this instance, so another author's concept of the same slug
 * isn't one of them. graph stays open: the catalog saves a selection as a graph with create-element.
 */
const MADE_ELSEWHERE = Object.freeze({
  'concept-header': 'graph create-concept',
  superset: 'graph create-concept',
  'json-schema': 'graph create-concept',
  'primary-property': 'graph create-concept',
  'properties-set': 'graph create-concept',
  'property-tree-graph': 'graph create-concept',
  'concept-graph': 'graph create-concept',
  'core-nodes-graph': 'graph create-concept',
  set: 'graph create-set',
  property: 'graph add-property',
  'graph-rule': 'the rulebook',
});

/**
 * The nodes graph update-node leaves to another operation (ADR 0021 Decision 4), in the order the refusal is chosen:
 * [firmware slug of the concept, the operation the refusal names, what such a node is]. A node is one when one of its
 * concepts' headers sits at that slug's firmware address, or (Amendment 1) when it carries the role label such a node
 * carries (CHANGED_BY_LABEL), since today's routes make a concept's header and a set before a reinstall wires them in.
 */
const CHANGED_ELSEWHERE = Object.freeze([
  ['concept-header', 'graph update-concept', 'a concept header'],
  ['superset', 'graph update-concept', "a concept's superset"],
  ['primary-property', 'graph update-concept', "a concept's primary property"],
  ['properties-set', 'graph update-concept', "a concept's properties set"],
  ['property-tree-graph', 'graph update-concept', "a concept's property tree graph"],
  ['concept-graph', 'graph update-concept', "a concept's concept graph"],
  ['core-nodes-graph', 'graph update-concept', "a concept's core nodes graph"],
  ['json-schema', 'graph set-schema (A10.18)', "a concept's JSON schema"],
  ['property', 'graph update-property (A10.18)', 'a property'],
  ['set', 'A10.21.a', 'a set'],
  ['graph-rule', 'the rulebook', 'a graph rule'],
]);
/** The role labels that make a node one of those, in order, and the slug each stands for (Amendment 1, item 1). */
const CHANGED_BY_LABEL = Object.freeze([
  [['ConceptHeader', 'ListHeader'], 'concept-header'],
  [['Superset'], 'superset'],
  [['JSONSchema'], 'json-schema'],
  [['Property'], 'property'],
  [['Set'], 'set'],
]);

/**
 * Whether another operation changes this node → { slug, operation, what, by: 'concept' | 'label' }, or null. Its
 * concepts are read first, by their headers' firmware addresses; then its labels. A Set label counts only on a node
 * with an address, as _sets.js's kindOf reads a set (Amendment 1, item 2).
 */
function changedElsewhere({ conceptUuids = [], labels = [], uuid = null } = {}) {
  const firmware = require('../../../api/normalize/firmware');
  const have = new Set((Array.isArray(conceptUuids) ? conceptUuids : []).filter((u) => typeof u === 'string' && u));
  for (const [slug, operation, what] of CHANGED_ELSEWHERE) {
    const at = firmware.conceptUuid(slug);
    if (at && have.has(at)) return { slug, operation, what, by: 'concept' };
  }
  const ls = Array.isArray(labels) ? labels : [];
  for (const [names, slug] of CHANGED_BY_LABEL) {
    if (!names.some((l) => ls.includes(l))) continue;
    if (slug === 'set' && !(typeof uuid === 'string' && uuid)) continue;
    const [, operation, what] = CHANGED_ELSEWHERE.find(([x]) => x === slug);
    return { slug, operation, what, by: 'label' };
  }
  return null;
}

/** The firmware slug and operation of a concept whose elements another operation makes, by its header's address; or null. */
function madeElsewhere(uuid) {
  if (typeof uuid !== 'string' || !uuid) return null;
  const firmware = require('../../../api/normalize/firmware');
  for (const [slug, operation] of Object.entries(MADE_ELSEWHERE)) {
    if (firmware.conceptUuid(slug) === uuid) return { slug, operation };
  }
  return null;
}

/** "<name>" (<address>), or the key alone, for messages. */
function conceptLabel(concept) {
  const name = concept && typeof concept.name === 'string' && concept.name ? concept.name : null;
  const where = (concept && (concept.uuid || concept.key)) || 'a concept';
  return name ? `"${name}" (${where})` : where;
}

/** What each shared refusal says, in words. */
const say = {
  notInstalled() {
    return "This instance has no assistant key, the would-be author of every node a write makes, so no element can be made: the firmware isn't installed. Install it first (POST /api/firmware/install), then try again.";
  },
  madeElsewhere(concept, { slug, operation }) {
    const label = conceptLabel(concept);
    if (slug === 'graph-rule') return `The elements of ${label} are the graph's rules, made from the rulebook, docs/GRAPH_RULES.md, and each rule's code by node src/firmware/graph-rules.js, and installed by firmware: a rule is changed in the rulebook, never in the graph. Nothing changed.`;
    return `The elements of ${label} are made by ${operation}, with the tags and links each one needs, which an element made here would lack. Nothing changed. Use ${operation}.`;
  },
  reservedKey(concept, key) {
    const why = key === 'word'
      ? "an element's word block, which names it, is filed under word, so this concept's section would replace it. Every element is already a word through that block, which the write that makes the element gives it"
      : "the derive step writes its own graphContext into each element's cached JSON, so this concept's section would be replaced there";
    return `${conceptLabel(concept)}'s key is ${key}, a key an element's JSON keeps for itself: ${why}. No element of it can be made here (ADR graph-operations-first-slice/0020 Amendment 1). Nothing changed.`;
  },
  noSuperset(concept) {
    return `${conceptLabel(concept)} has no superset, so there is no class thread to put an element in (BIBLE §10, rule 1). Nothing changed.`;
  },
  unknownSet(set) {
    return `No node of this graph has the tapestryKey ${set}, which set names. Pass the tapestryKey of a set below the concept's superset, or leave set out to make the element directly under the superset.`;
  },
  notASet(node, superset) {
    return superset
      ? `${S.describe(node)}, which set names, is a concept header, not a set or a superset. To make the element directly under that concept's superset, pass its superset's tapestryKey, ${superset}, or leave set out.`
      : `${S.describe(node)}, which set names, is neither a set nor a superset. A set or a superset is a node labelled Set or Superset that has an address, its uuid; a node with no address, such as one of the trust pipeline's card sets, isn't one. Pass the tapestryKey of a set below the concept's superset.`;
  },
  notInClassThread(node, concept, superset) {
    return `${S.describe(node)}, which set names, isn't in the class thread of ${conceptLabel(concept)}: no chain of class-thread links runs down to it from that concept's superset, ${superset}. Pass a set below that superset, or link this one under it first (graph link-set). Nothing changed.`;
  },
  noFreeAddress(name, address) {
    return `Every address the name ${name} gives in this concept is held: ${address}, and each versioning nonce to ~${MAX_NONCE}. Nothing changed. Choose another name.`;
  },
  tooLong(length) {
    return `With these fields, the element's JSON would be ${count(length)} characters long, more than the ${count(MAX_JSON)} an element's json tag holds. Nothing changed.`;
  },
  /** graph update-node's made-elsewhere (ADR 0021 Decision 4): `label` names the node, `hit` is changedElsewhere's. */
  changedElsewhere(label, { slug, operation, what }) {
    if (slug === 'set') return `${label} is ${what}. update-node doesn't change sets yet: A10.21.a teaches it, once graph create-set (A10.27) has landed, since a set's name is checked among its siblings under its parent, not among all sets. Nothing changed.`;
    if (slug === 'graph-rule') return `${label} is ${what}, made from the rulebook, docs/GRAPH_RULES.md, and each rule's code by node src/firmware/graph-rules.js, and installed by firmware: a rule is changed in the rulebook, never in the graph. Nothing changed.`;
    if (slug === 'json-schema') return `${label} is ${what}. A concept's schema changes through its properties, with ${operation} or the other property operations, so that its property tree and its schema stay one. Nothing changed.`;
    if (slug === 'property') return `${label} is ${what}, which ${operation} changes, with the property tree it hangs in and the schema made from it. Nothing changed.`;
    return `${label} is ${what}. Its names follow its concept's, which ${operation} changes: a concept's names, slug and description, and the names its core nodes take from them. Nothing changed. Use ${operation} with the concept's header.`;
  },
};

// ── the inputs (Decisions 1, 2 and 5) ──
/** The name, cleaned as create-concept cleans one (its white space trimmed and collapsed); or the refusal bad-name. */
function cleanName(raw) {
  const name = CN.cleanName(raw);
  const why = CN.nameProblem(name);
  if (why) throw refusal(BAD_NAME.code, `The name ${JSON.stringify(shorten(raw))} can't be an element's name: ${why}.`, { input: 'name' });
  return name;
}

/** What a value is, in words, for a refusal. */
const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'a list' : typeof v === 'string' ? 'text' : `a ${typeof v}`);

/**
 * The fields: an object, or JSON text that parses to one; {} when left out. A name or slug equal to the ones the name
 * gives is dropped, since the section holds those anyway; another is refused bad-fields, as is anything that isn't an
 * object. → [[field, value]], in the order given.
 */
function parseFields(value, { name, slug }) {
  let fields = value;
  if (value === undefined) fields = {};
  else if (typeof value === 'string') {
    try {
      fields = JSON.parse(value);
    } catch {
      throw refusal(BAD_FIELDS.code, `fields isn't JSON that parses: give the element's fields as a JSON object, such as '{"description": "a dog"}'. Nothing changed.`, { input: 'fields' });
    }
  }
  if (!isObject(fields)) throw refusal(BAD_FIELDS.code, `fields must be a JSON object of the element's fields, such as {"description": "a dog"}; it is ${kindOf(fields)}. Nothing changed.`, { input: 'fields' });
  const out = [];
  for (const [field, v] of Object.entries(fields)) {
    if (field === 'name' || field === 'slug') {
      const want = field === 'name' ? name : slug;
      if (v === want) continue;
      throw refusal(BAD_FIELDS.code, `fields gives the ${field} ${JSON.stringify(v)}, but the element's ${field} is ${JSON.stringify(want)}, ${field === 'name' ? 'the name given' : 'the slug its name gives'}. Its section always holds those. Leave ${field} out of fields, or give the same one. Nothing changed.`, { input: 'fields' });
    }
    out.push([field, v]);
  }
  return out;
}

// ── where the element goes (Decision 3) ──
/** E2: the concept headers whose class thread reaches the superset or set keyed `key` → [{ concept, uuid }]. */
async function conceptsReaching(read, key) {
  const { INIT, PROP } = S.aliases();
  const rows = await read(
    `MATCH (t:TapestryNode {tapestryKey: $key})<-[:${PROP}*0..]-(s:Superset)<-[:${INIT}]-(h)
     WHERE h:ConceptHeader OR h:ListHeader
     RETURN DISTINCT h.tapestryKey AS concept, h.uuid AS uuid`,
    { key },
  );
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (typeof r.concept !== 'string' || seen.has(r.concept)) continue;
    seen.add(r.concept);
    out.push({ concept: r.concept, uuid: typeof r.uuid === 'string' ? r.uuid : null });
  }
  return out;
}

/**
 * Where the element goes: `set` when it is given and isn't the concept's own superset, else the superset; and every
 * concept whose class thread reaches it, the named one among them (rule 3). Refuses a set that names no node, one that
 * is neither a set nor a superset, and one outside the concept's class thread. → { target, setNode, concepts }
 */
async function whereTo(read, { concept, superset, set }) {
  let target = superset;
  let setNode = null;
  if (typeof set === 'string' && set && set !== superset) {
    const node = await S.nodeOf(read, set);
    if (!node) throw refusal(UNKNOWN_SET.code, say.unknownSet(set), { input: 'set' });
    if (S.kindOf(node) === 'other') throw refusal(NOT_A_SET.code, say.notASet(node, await S.supersetOf(read, set)), { input: 'set' });
    setNode = node;
    target = set;
  }
  const concepts = await conceptsReaching(read, target);
  if (setNode && !concepts.some((c) => c.concept === concept.key)) throw refusal(NOT_IN_CLASS_THREAD.code, say.notInClassThread(setNode, concept, superset), { input: 'set' });
  return { target, setNode, concepts };
}

// ── the repeat (Decision 6) ──
/**
 * E3: this instance's own element of the concept, anywhere in its class thread, that the call repeats: one whose name,
 * lowercased, is the name lowercased, or that sits at the address the name gives, with or without a nonce. Of several,
 * the one at the plain address, then the lowest tapestryKey. Another author's element is never one: its address isn't
 * the assistant's. → { key, uuid, name, hasLetter, json, parents } or null
 */
async function findRepeat(read, { concept, name, ta, address }) {
  const all = await repeatsOf(read, { concept, name, authors: [ta], address });
  return all[0] || null;
}

/**
 * E3 for any authors (ADR 0021 Decision 10): every element of the concept, anywhere in its class thread, by one of
 * `authors`, whose name, lowercased, is the name lowercased, or that sits at `address` with or without a nonce; sorted
 * as findRepeat takes them, the plain address first, then the lowest key. With no address (a header that has none),
 * by name alone. → [{ key, uuid, name, hasLetter, json, parents }]
 */
async function repeatsOf(read, { concept, name, authors, address }) {
  const list = (Array.isArray(authors) ? authors : []).filter((a) => typeof a === 'string' && a);
  if (!list.length || typeof concept !== 'string' || !concept) return [];
  const at = typeof address === 'string' && address ? address : null;
  const { INIT, PROP, TERM } = S.aliases();
  const rows = await read(
    `MATCH (h:TapestryNode {tapestryKey: $key})-[:${INIT}]->(:Superset)-[:${PROP}*0..]->()-[:${TERM}]->(e:TapestryNode)
     WHERE e.pubkey IN $authors AND NOT e:GraphChange AND (toLower(e.name) = $name OR e.uuid = $address OR e.uuid STARTS WITH $nonced)
     WITH DISTINCT e
     OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'})
     OPTIONAL MATCH (p)-[:${TERM}]->(e)
     RETURN e.tapestryKey AS key, e.uuid AS uuid, e.name AS name, e.id IS NOT NULL AS hasLetter, head(collect(DISTINCT t.value)) AS json, collect(DISTINCT p.tapestryKey) AS parents`,
    { key: concept, authors: list, name: String(name).toLowerCase(), address: at, nonced: at ? `${at}~` : null },
  );
  const found = rows.filter((r) => typeof r.key === 'string');
  found.sort((a, b) => (a.uuid === at ? 0 : 1) - (b.uuid === at ? 0 : 1) || a.key.localeCompare(b.key));
  return found.map((r) => ({
    key: r.key,
    uuid: typeof r.uuid === 'string' ? r.uuid : null,
    name: typeof r.name === 'string' ? r.name : null,
    hasLetter: r.hasLetter === true,
    json: r.json === undefined ? null : r.json,
    parents: [...new Set((Array.isArray(r.parents) ? r.parents : []).filter((k) => typeof k === 'string'))].sort(),
  }));
}

/**
 * Each input given that differs from what the repeated element holds (Decision 6): the name, case included; the set,
 * when it isn't one of the element's direct parents; and each field given whose value differs from its JSON's, compared
 * as JSON. A repeat checks no field against the schema: it writes nothing.
 */
function differsOf(repeat, { name, set, fields, oKey }) {
  const out = [];
  if (repeat.name !== name) out.push({ input: 'name', given: name, holds: repeat.name });
  if (typeof set === 'string' && set && !repeat.parents.includes(set)) out.push({ input: 'set', given: set, holds: [...repeat.parents] });
  const { readJson } = require('./_fields');
  const { json } = readJson(repeat.json);
  const section = json && own(json, oKey) && isObject(json[oKey]) ? json[oKey] : {};
  for (const [field, given] of fields) {
    const holds = own(section, field) ? section[field] : null;
    if (canon(given) !== canon(holds)) out.push({ input: `fields.${field}`, given, holds });
  }
  return out;
}

// ── the address (Decision 5) ──
/** C4: the first address the name gives in the concept at `header` that no node holds, ~1 to ~99 after the plain one; or null. */
async function freeAddress(read, { name, header, ta }) {
  const ds = [];
  for (let n = 0; n <= MAX_NONCE; n++) ds.push(n === 0 ? dtag.childDTag(name, header) : dtag.childDTag(name, header, n));
  const addresses = ds.map((d) => `39999:${ta}:${d}`);
  const rows = await read('MATCH (n:NostrEvent|TapestryNode) WHERE n.uuid IN $uuids RETURN n.uuid AS uuid', { uuids: addresses });
  const held = new Set(rows.map((r) => r.uuid));
  const i = addresses.findIndex((a) => !held.has(a));
  return i < 0 ? null : { d: ds[i], address: addresses[i] };
}

// ── the JSON and the tags (Decisions 8 and 9) ──
/**
 * The element's word-wrapper JSON, keys in Decision 8's order: its word block, named for its concept as most of
 * firmware's elements are (dog's rover: dog--rover, "dog: Rover"), its wordTypes the key of each concept that reaches
 * it, the named one first and the others sorted (D10: membership is the edges); then the concept's section, holding the
 * name, the slug and the fields in the order given. No value is made up. `header` is _concepts.js's headerOf.
 */
function elementJson({ header, name, slug, fields, others }) {
  const ch = header.json && isObject(header.json.conceptHeader) ? header.json.conceptHeader : {};
  const singular = header.names.singular;
  const title = (isObject(ch.oTitles) && typeof ch.oTitles.singular === 'string' && ch.oTitles.singular) || CN.toTitleName(singular);
  const key = header.oKey;
  const rest = [...new Set(others.filter((k) => typeof k === 'string' && k && k !== key && k !== 'word'))].sort();
  const word = { slug: `${header.slug}--${slug}`, name: `${singular}: ${name}`, title: `${title}: ${name}`, wordTypes: ['word', key, ...rest] };
  const section = Object.fromEntries([['name', name], ['slug', slug], ...fields]);
  return Object.fromEntries([['word', word], [key, section]]);
}

/** The tags of the letter the write would sign, in its order (Decision 9): d, name, z, n for a set, json. No stamps. */
function elementTags({ d, name, header, set, json }) {
  return [['d', d], ['name', name], ['z', header], ...(set ? [['n', set]] : []), ['json', json]];
}

/** An element as the answer gives it (Decision 14). */
function describeElement({ key, address, name, slug, concept, parents, hasLetter }) {
  return { tapestryKey: key, address, name, slug, concept, parents: [...parents], hasLetter: hasLetter === true };
}

/** One HAS_ELEMENT from the superset or set keyed `from` to the element keyed `to`, by add-relationship's MERGE (Decision 10). */
async function link(tx, from, to) {
  const { TERM } = S.aliases();
  const { rows } = await tx.run(
    `MATCH (a:TapestryNode {tapestryKey: $from}) WHERE NOT a:GraphChange
     MATCH (b:TapestryNode {tapestryKey: $to}) WHERE NOT b:GraphChange
     MERGE (a)-[r:\`${TERM}\`]->(b)
     RETURN count(r) AS n`,
    { from, to },
  );
  if (!rows.length || rows[0].n !== 1) throw new Error(`the new element's ${TERM} found ${rows.length ? rows[0].n : 0} pairs of nodes to join, not 1`);
}

// ── firmware's own elements (ADR 0021 Decision 4) ──
/**
 * The name install gives an element file (src/firmware/install.js:262–266, copied, since install doesn't export it;
 * if install's changes, this must follow): word.name after its last colon, else the section's name, else word.slug,
 * trimmed as today's create-element route trims a name.
 */
function installName(data) {
  if (!isObject(data)) return null;
  const word = isObject(data.word) ? data.word : {};
  const key = Object.keys(data).filter((k) => k !== 'word')[0];
  const section = key && isObject(data[key]) ? data[key] : {};
  const raw = typeof word.name === 'string' && word.name.includes(':')
    ? word.name.split(':').pop()
    : (typeof section.name === 'string' && section.name) || (typeof word.slug === 'string' && word.slug) || null;
  const name = typeof raw === 'string' ? raw.trim() : '';
  return name || null;
}

let firmwareElementsCache = null;
/**
 * The address install gives each element file of the active firmware: 39999:<TA>:<childDTag(name, 39998:<TA>:<slug>)>,
 * today's create-element's d-tag for the file's name under its concept's firmware header (fact 8), mapped to the
 * file's path in the firmware, such as concepts/dog/elements/rover.json. Worked out once per process; empty, and not
 * kept, when the instance has no assistant key.
 */
function firmwareElements() {
  if (firmwareElementsCache) return firmwareElementsCache;
  const { getOwnerAssistantPubkey } = require('../../../utils/assistantKeys');
  const ta = getOwnerAssistantPubkey();
  const out = new Map();
  if (!ta) return out;
  const fs = require('fs');
  const path = require('path');
  const firmware = require('../../../api/normalize/firmware');
  const root = firmware.firmwareDir();
  for (const c of firmware.getManifest().concepts || []) {
    if (!isObject(c) || typeof c.slug !== 'string' || typeof c.dir !== 'string') continue;
    const dir = path.join(root, c.dir, 'elements');
    if (!fs.existsSync(dir)) continue;
    const base = String(c.dir).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
    for (const file of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      let data = null;
      try { data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch { continue; }
      const name = installName(data);
      if (!name) continue;
      const address = `39999:${ta}:${dtag.childDTag(name, `39998:${ta}:${c.slug}`)}`;
      if (!out.has(address)) out.set(address, path.posix.join(base, 'elements', file));
    }
  }
  firmwareElementsCache = out;
  return out;
}

/** The firmware file whose element sits at `uuid`, such as concepts/dog/elements/rover.json; or null. */
function firmwareElementOf(uuid) {
  if (typeof uuid !== 'string' || !uuid) return null;
  return firmwareElements().get(uuid) || null;
}

// ── a change to an element's JSON (ADR 0021 Decisions 8 and 9) ──
/**
 * The fields merged into a section → a new section: each field given takes the value given, in its place, or at the
 * end when the section lacks it; one given as null is taken out; an object or a list is replaced whole. Built with
 * Object.fromEntries, so a field called __proto__ stays an own field. `fields` is [[field, value]], in order.
 */
function mergeSection(section, fields) {
  const m = new Map(Object.entries(isObject(section) ? section : {}));
  for (const [field, value] of fields) {
    if (value === null) m.delete(field);
    else m.set(field, value);
  }
  return Object.fromEntries(m);
}

/** A value that held what the old name made, with the new one in its place: `v` itself, or its ending after `sep`. */
function follow(v, was, now, sep) {
  if (typeof v !== 'string' || was === now) return v;
  if (v === was) return now;
  if (v.endsWith(`${sep}${was}`)) return `${v.slice(0, v.length - was.length)}${now}`;
  return v;
}

/**
 * A rename's JSON (Decision 9) → { json, sections }: in each top-level value that is an object, other than word and
 * graphContext, a name equal to the old name takes the new one, and a slug equal to the slug the old name gives takes
 * the slug the new one gives; in the word block, name and title equal to the old name or ending with ": <old name>",
 * and a slug equal to the old slug or ending with "--<old slug>", follow likewise. Every other value stays, in its
 * order. `sections` lists the keys of the sections it changed.
 */
function renamedJson(json, { was, now }) {
  const oldSlug = dtag.slug(was);
  const newSlug = dtag.slug(now);
  const sections = [];
  const out = Object.entries(isObject(json) ? json : {}).map(([key, value]) => {
    if (!isObject(value) || key === 'graphContext') return [key, value];
    if (key === 'word') {
      return [key, Object.fromEntries(Object.entries(value).map(([k, v]) => {
        if (k === 'name' || k === 'title') return [k, follow(v, was, now, ': ')];
        if (k === 'slug') return [k, follow(v, oldSlug, newSlug, '--')];
        return [k, v];
      }))];
    }
    let changed = false;
    const section = Object.fromEntries(Object.entries(value).map(([k, v]) => {
      if (k === 'name' && v === was && was !== now) { changed = true; return [k, now]; }
      if (k === 'slug' && v === oldSlug && oldSlug !== newSlug) { changed = true; return [k, newSlug]; }
      return [k, v];
    }));
    if (changed) sections.push(key);
    return [key, section];
  });
  return { json: Object.fromEntries(out), sections };
}

/** The answer's schemas. */
const ELEMENT = Object.freeze({
  type: 'object',
  required: ['tapestryKey', 'address', 'name', 'slug', 'concept', 'parents', 'hasLetter'],
  properties: {
    tapestryKey: { type: 'string', description: "The element's tapestryKey" },
    address: { type: 'string', nullable: true, description: 'Its nostr address, 39999:<assistant>:<d>: the address a letter for it would carry' },
    name: { type: 'string', nullable: true, description: 'Its name, its tapestryValue' },
    slug: { type: 'string', nullable: true, description: "Its slug: its section's slug, else the one its name gives" },
    concept: { type: 'string', description: "The tapestryKey of the named concept's header" },
    parents: { type: 'array', items: { type: 'string' }, description: 'The tapestryKeys of the supersets and sets it is directly in' },
    hasLetter: { type: 'boolean', description: 'Whether it came from a nostr event' },
  },
});
const PROBLEM = Object.freeze({
  type: 'object',
  required: ['path', 'message'],
  properties: {
    path: { type: 'string', description: "The field, as a dotted path such as dog.breed, or \"the element's JSON\" for the whole" },
    message: { type: 'string', description: 'What is wrong, in words' },
  },
});
/** An answer's concepts (ADR 0021 Decision 17): each concept a node belongs to, and whether its JSON fits that concept's schema. */
const CONCEPTS = Object.freeze({
  type: 'array',
  description: "Each concept the node belongs to, and whether its JSON fits that concept's schema",
  items: {
    type: 'object',
    required: ['concept', 'key', 'fits', 'problems', 'problem'],
    properties: {
      concept: { type: 'string', description: "The tapestryKey of the concept's header" },
      key: { type: 'string', nullable: true, description: "The concept's key, the section its fields go in" },
      fits: { type: 'boolean', nullable: true, description: "Whether the node's JSON fits the concept's schema; null when the concept has no schema to check against" },
      problems: { type: 'array', items: PROBLEM, description: 'Each problem with its JSON under that schema' },
      problem: { type: 'string', nullable: true, description: 'Why there is no schema to check against' },
    },
  },
});

module.exports = {
  MAX_JSON, MAX_NONCE, FIELDS_INPUT, MADE_ELSEWHERE, RESERVED_KEYS, ELEMENT, PROBLEM,
  BAD_NAME, BAD_FIELDS, MADE_ELSEWHERE_REFUSAL, NO_SUPERSET, NOT_INSTALLED, UNKNOWN_SET, NOT_A_SET, NOT_IN_CLASS_THREAD, NO_FREE_ADDRESS, RESERVED_KEY,
  say, conceptLabel, cleanName, parseFields, madeElsewhere, conceptsReaching, whereTo, findRepeat, differsOf, freeAddress,
  elementJson, elementTags, describeElement, link,
  CHANGED_ELSEWHERE, CHANGED_BY_LABEL, CONCEPTS, changedElsewhere, firmwareElements, firmwareElementOf, repeatsOf, mergeSection, renamedJson,
};
