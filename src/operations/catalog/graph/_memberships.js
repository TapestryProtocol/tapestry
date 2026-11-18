'use strict';
/**
 * What graph add-to-concept and graph remove-from-concept share, and what the rule node-has-a-concept reads with (story
 * graph-operations-first-slice #22; ADR graph-operations-first-slice/0022 Implementation notes and Amendment 1). A
 * membership is read through the class thread, from each concept's header down to the node (memo #117 on A10.22), never
 * from the node's direct links alone.
 *
 *   keptIn(facts)                        where a node's sections are kept: 'json-tag' for one of the instance's own,
 *                                        firmware's own elements aside; 'beside', in tapestryOwnSections, for every other
 *                                        node (Decision 2)
 *   theNode(read, key)                   the node and its concepts; refuses unknown-node, tag-node, made-elsewhere
 *   lookedAfterElsewhere(read, facts)    whether another operation looks after the node (X.changedElsewhere), which
 *                                        theNode refuses and the rule's guard leaves to it (Amendment 2, item 3)
 *   theConcept(read, key, { add })       the concept, its header, key and superset; refuses unknown-concept,
 *                                        reserved-key, no-superset and, for an add, made-elsewhere (Decision 3)
 *   anchorOf(read, { concept, set })     the same, refusing nothing: null where a check would refuse (the rule's guard)
 *   sectionFields(value, facts)          the section's name, slug and fields (Decision 7)
 *   tagsOf(read, key)                    a node's tags, each with its tapestryKey
 *   jsonOf(read, facts, kept)            the node's JSON as the operations read it: { view, base, own, tags, jsonTags,
 *                                        cached } (Decision 5); refuses unreadable-json
 *   isElementLink(read, from, to)        whether a HAS_ELEMENT runs from one node to the other (Decision 7)
 *   waysIn(read, { anchor, node })       M1: every HAS_ELEMENT into the node from the anchor or below it (Decision 10)
 *   reaches(read, { concept, anchor })   M2: whether a concept's class thread reaches the anchor (Decision 10)
 *   firmwareMemberships()                the memberships firmware's definition makes, worked out once per process
 *                                        (Decision 11)
 *   firmwareMembership(read, …)          the part of that definition behind a link taken out or a concept left, or null
 *   authorClaim({ facts, tags, … })      the tag of another author's letter that claims one, or null (Decision 10)
 *   ownLetters(read, …)                  the instance's own letters that still state a removed membership (Decision 13),
 *                                        the relationship events found through the relationship concept (Amendment 2,
 *                                        item 4)
 *   NODE, CONCEPT_KEYS, LETTERS          the answers' schemas
 *   the refusals the two operations declare, and their words (Decision 17), each operation's own not-installed and
 *   no-superset among them (Amendment 2, item 7)
 *
 * Like _nodes.js, it opens nothing when it loads: firmware, the assistant's key and the store are required when first
 * called. It never signs, publishes or reads a key.
 */

const dtag = require('../../../lib/dtag');
const { refusal } = require('../../refusal');
const K = require('./_concepts');
const F = require('./_fields');
const S = require('./_sets');
const X = require('./_elements');
const N = require('./_nodes');

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const own = (o, k) => isObject(o) && Object.prototype.hasOwnProperty.call(o, k);

// ── the refusals (Decision 17) ──
const UNKNOWN_NODE = Object.freeze({ code: 'unknown-node', status: 404, when: 'A node, or a set, that names no node of the graph (a change entry is not one); the refusal names which input' });
const TAG_NODE = Object.freeze({ code: 'tag-node', status: 409, when: "A node that is a tag (NostrEventTag): part of a letter, which records no author and is no element of any concept" });
const MADE_ELSEWHERE_NODE = "A node whose memberships another operation looks after, by its concepts or its role labels: a concept header or a core node (graph update-concept), a JSON schema (graph set-schema, A10.18), a property (graph update-property, A10.18), a set or a superset (graph link-set and unlink-set) or a graph rule (the rulebook); the refusal names the operation";
const MADE_ELSEWHERE_ADD = Object.freeze({ code: 'made-elsewhere', status: 409, when: `${MADE_ELSEWHERE_NODE}. Also a concept whose elements another operation makes, with wiring a node added here would lack: the concept-header concept and the seven core-node concepts (graph create-concept), set (graph create-set), property (graph add-property) and graph rule (the rulebook)` });
const MADE_ELSEWHERE_REMOVE = Object.freeze({ code: 'made-elsewhere', status: 409, when: MADE_ELSEWHERE_NODE });
const UNREADABLE_JSON = Object.freeze({ code: 'unreadable-json', status: 409, when: "A node whose JSON can't be read: json tags that differ, JSON that doesn't parse, an LMDB entry that is missing, JSON that isn't an object, or sections kept beside another author's letter (tapestryOwnSections) that aren't JSON of an object; nothing could be checked or changed" });
const NAME_IN_USE = Object.freeze({ code: 'name-in-use', status: 409, when: "A node whose author is one of the instance's own keys, added to a concept where another of the instance's own elements, its assistant's or its owner's, has the node's name, without regard to case, or sits at the address the name gives: the element create-element would answer for the name; the refusal names it" });
const FIRMWARE_MEMBERSHIP = Object.freeze({ code: 'firmware-membership', status: 409, when: "A membership firmware's definition makes, by an element file or a concept manifest's HAS_ELEMENT, which a firmware reinstall would make again: it changes through lifecycle seed-firmware (A10.37); the refusal names the part of the definition" });
const AUTHOR_CLAIM = Object.freeze({ code: 'author-claim', status: 409, when: "A membership another author's letter claims: its z tag names the concept, or its n tag names the set, which the instance records as theirs and the next import would make again; whether it counts is decided per point of view; the refusal names the tag and its author" });
const OTHER_CONCEPT = Object.freeze({ code: 'other-concept', status: 409, when: "A call that would also take the node out of a concept it didn't name: one whose superset is under the named concept's class thread, or that shares a set with it; the refusal names that concept and the link's start, and says how to go on: take the node out of that concept instead, or unlink the two (graph unlink-set)" });
// Each operation's own not-installed and no-superset (ADR 0022 Amendment 2, item 7), with create-element's codes and statuses.
const NOT_INSTALLED_ADD = Object.freeze({ code: 'not-installed', status: 409, when: "The instance has no assistant key, so it can't tell its own nodes from another author's, or firmware's own, nor whether a node keeps the concept's section in its own JSON or beside its author's letter" });
const NOT_INSTALLED_REMOVE = Object.freeze({ code: 'not-installed', status: 409, when: "The instance has no assistant key, so it can't tell its own nodes from another author's, or firmware's own, nor whose claim a membership is: the owner's, an author's or firmware's" });
const NO_SUPERSET_ADD = Object.freeze({ code: 'no-superset', status: 409, when: 'A concept with no superset, so no class thread to put the node in (BIBLE §10, rule 1)' });
const NO_SUPERSET_REMOVE = Object.freeze({ code: 'no-superset', status: 409, when: 'A concept with no superset, so no class thread that could reach the node, and nothing to take it out of (BIBLE §10, rule 1)' });

/** "<name>" (<address>), or the key alone, for messages. */
const labelOf = N.labelOf;

/** What each refusal says, in words. */
const say = {
  notInstalled({ add = false } = {}) {
    const what = add ? "nor where a node's section for the concept is kept" : 'nor whose claim a membership is';
    return `This instance has no assistant key, so it can't tell its own nodes from another author's, or firmware's own, ${what}: the firmware isn't installed. Install it first (POST /api/firmware/install), then try again. Nothing changed.`;
  },
  unknownNode(key) {
    return `No node of this graph has the tapestryKey ${key}, which node names (a change entry is not a node). Nothing changed.`;
  },
  tagNode(facts) {
    return `${labelOf(facts)} is a tag (NostrEventTag): part of a letter's event, which records no author and is no element of any concept, so no concept is given to it or taken from it. Nothing changed.`;
  },
  /** made-elsewhere for the node (Amendment 1, item 6): what looks after that kind of node's memberships. */
  madeElsewhere(label, { slug, operation, what }) {
    if (slug === 'set') return `${label} is ${what}: where a set is in a class thread, the sets and supersets it is directly under, is graph link-set's and unlink-set's, so it isn't put in a concept or taken out of one here. Nothing changed.`;
    if (slug === 'superset') return `${label} is ${what}, which graph update-concept changes with its concept; graph link-set and unlink-set put it under a parent or take it out from under one. It isn't put in a concept or taken out of one here. Nothing changed.`;
    if (slug === 'graph-rule') return `${label} is ${what}, made from the rulebook, docs/GRAPH_RULES.md, and each rule's code by node src/firmware/graph-rules.js, and installed by firmware: its memberships are firmware's, never changed in the graph. Nothing changed.`;
    return `${label} is ${what}, which ${operation} looks after, with the wiring such a node needs: it isn't put in a concept or taken out of one here. Nothing changed.`;
  },
  reservedKey(concept, key) {
    return `${X.conceptLabel(concept)}'s key is ${key}, a key an element's JSON keeps for itself: ${key === 'word' ? "every element is a word through its word block, which stays" : "the derive step writes the graphContext of each element's cached JSON"}. No node is taken out of it here (ADR graph-operations-first-slice/0020 Amendment 1). Nothing changed.`;
  },
  noSuperset(concept, { add = false } = {}) {
    return add
      ? `${X.conceptLabel(concept)} has no superset, so it has no class thread to put the node in (BIBLE §10, rule 1). Nothing changed.`
      : `${X.conceptLabel(concept)} has no superset, so no class thread of its reaches the node, and there is nothing to take it out of (BIBLE §10, rule 1). Nothing changed.`;
  },
  unreadable(facts, why) {
    return `${labelOf(facts)}'s JSON can't be read: ${why}. So its sections can't be checked against its concepts' schemas or changed. Nothing changed.`;
  },
  nameInUse(facts, concept, other, name) {
    const how = typeof other.name === 'string' && other.name.toLowerCase() === String(name).toLowerCase() ? `has the name ${JSON.stringify(other.name)}` : `sits at the address the name ${name} gives, ${other.uuid}`;
    return `In ${X.conceptLabel(concept)}, whose tapestryKey is ${concept.key}, another of this instance's own elements, ${other.name ? `"${other.name}"` : 'one'} (${other.key}), ${how}: adding ${labelOf(facts)} would leave two of the instance's own elements of one name in one concept, and graph create-element would find that one for the name. Nothing changed. Rename one of them first (graph update-node), or merge the two (graph merge-nodes, A10.25, to come).`;
  },
  firmwareMembership(facts, made) {
    return `${labelOf(facts)}'s membership is firmware's own: it comes from ${made.what}. Firmware's memberships stay as its definition makes them, and a firmware reinstall would make this one again, so it isn't taken out. Nothing changed. Firmware changes through lifecycle seed-firmware (A10.37).`;
  },
  authorClaim(facts, claim) {
    return `${labelOf(facts)}'s membership is its author's claim: their letter, ${claim.address}, signed by ${claim.author}, names ${claim.value} in its ${claim.tag} tag. The instance records an author's claims as theirs, and a firmware reinstall, or the next import of their letter, would make the membership again; whether it counts is each point of view's call, when the graph is read. Nothing changed.`;
  },
  otherConcept(facts, named, other, via) {
    return `Taking ${labelOf(facts)} out of ${X.conceptLabel(named)} would also take it out of ${X.conceptLabel(other)}, which the call didn't name: ${X.conceptLabel(named)} reaches it through ${S.describe(via)}, which is in the class thread of ${X.conceptLabel(other)} too. Nothing changed. Take it out of ${X.conceptLabel(other)} instead (graph remove-from-concept with concept ${other.key}), or unlink the two (graph unlink-set).`;
  },
};

// ── the answers' schemas (Decision 13) ──
const NODE = Object.freeze({
  type: 'object',
  required: ['tapestryKey', 'address', 'name'],
  properties: {
    tapestryKey: { type: 'string', description: "The node's tapestryKey" },
    address: { type: 'string', nullable: true, description: 'Its nostr address, or null when it has none' },
    name: { type: 'string', nullable: true, description: 'Its name: its tapestryValue, else its name property; null when it has neither' },
  },
});
const CONCEPT_KEYS = Object.freeze({
  type: 'array',
  items: {
    type: 'object',
    required: ['concept', 'key'],
    properties: {
      concept: { type: 'string', description: "The tapestryKey of the concept's header" },
      key: { type: 'string', nullable: true, description: "The concept's key, the section its fields go in" },
    },
  },
});
const LETTERS = Object.freeze({
  type: 'array',
  description: "The instance's own letters that still state a removed membership: the node's own letter, for one of the instance's own nodes that has one, and a relationship event of the instance's own that names a removed pair, as today's add-to-set signs one. export nostr (A10.34) is what sends letters that match",
  items: {
    type: 'object',
    required: ['address', 'says'],
    properties: {
      address: { type: 'string', description: "The letter's address" },
      says: { type: 'string', description: 'What it still says, in words' },
    },
  },
});

/** A node as the answers give it: its tapestryKey, address and name (Decision 13). */
const nodeOf = (facts) => ({ tapestryKey: facts.key, address: facts.uuid || null, name: facts.name || null });

// ── the node and its concept (Decisions 2 and 3) ──
/** Where a node's sections are kept (Decision 2). */
function keptIn(facts) {
  return facts && facts.own === true && !X.firmwareElementOf(facts.uuid) ? 'json-tag' : 'beside';
}

/** The concept keys of conceptsOfNodes' rows, each once, sorted. */
const keysOf = (rows) => [...new Set(rows.map((r) => r.concept).filter((c) => typeof c === 'string'))].sort();

/**
 * The node keyed `key` → { facts, conceptKeys, headers }: whoseNode's facts, the concepts whose class thread reaches it
 * and their headers. Refuses unknown-node, tag-node and made-elsewhere, naming node.
 */
async function theNode(read, key) {
  const facts = await N.whoseNode(read, key);
  if (!facts) throw refusal(UNKNOWN_NODE.code, say.unknownNode(key), { input: 'node' });
  if (facts.labels.includes('NostrEventTag')) throw refusal(TAG_NODE.code, say.tagNode(facts), { input: 'node' });
  const { hit, conceptKeys, headers } = await lookedAfterElsewhere(read, facts);
  if (hit) throw refusal(MADE_ELSEWHERE_REMOVE.code, say.madeElsewhere(labelOf(facts), hit), { input: 'node' });
  return { facts, conceptKeys, headers };
}

/**
 * Whether another operation looks after the node, by its concepts or its role labels (X.changedElsewhere) → { hit,
 * conceptKeys, headers }: the hit, or null, and the concepts whose class thread reaches the node, with their headers.
 * theNode refuses such a node made-elsewhere, and the rule node-has-a-concept's guard gives it no finding, so apply's
 * refusal answers (ADR 0022 Amendment 2, item 3).
 */
async function lookedAfterElsewhere(read, facts) {
  const conceptKeys = keysOf(await F.conceptsOfNodes(read, [facts.key]));
  const headers = conceptKeys.length ? await K.headersByKey(read, conceptKeys) : [];
  const hit = X.changedElsewhere({ conceptUuids: headers.map((h) => h.uuid), labels: facts.labels, uuid: facts.uuid });
  return { hit, conceptKeys, headers };
}

/** The key a concept's header files its elements' section under: its header's, else the one its JSON gives. */
const keyOf = (header, concept) => (header && typeof header.oKey === 'string' && header.oKey ? header.oKey : concept.oKey || null);

/**
 * The concept keyed `key` → { concept, header, oKey, superset }. Refuses unknown-concept, reserved-key, no-superset
 * and, with `add`, made-elsewhere, naming concept, in that order (Decision 3).
 */
async function theConcept(read, key, { add = false } = {}) {
  const concept = await F.conceptOf(read, key);
  if (!concept) throw refusal(F.UNKNOWN_CONCEPT.code, F.say.unknownConcept(key), { input: 'concept' });
  const [header] = await K.headersByKey(read, [concept.key]);
  const oKey = keyOf(header, concept);
  if (X.RESERVED_KEYS.includes(oKey)) throw refusal(X.RESERVED_KEY.code, add ? X.say.reservedKey(concept, oKey) : say.reservedKey(concept, oKey), { input: 'concept' });
  const superset = await S.supersetOf(read, concept.key);
  if (!superset) throw refusal((add ? NO_SUPERSET_ADD : NO_SUPERSET_REMOVE).code, say.noSuperset(concept, { add }), { input: 'concept' });
  if (add) {
    const elsewhere = X.madeElsewhere(concept.uuid);
    if (elsewhere) throw refusal(MADE_ELSEWHERE_ADD.code, X.say.madeElsewhere(concept, elsewhere), { input: 'concept' });
  }
  if (!oKey) throw new Error(`the concept header ${concept.key} has no key, so a node's JSON has no section to file under it`);
  return { concept, header, oKey, superset };
}

/**
 * The rule's reading of { concept, set } (Decision 12; Amendment 1, item 10) → { concept, oKey, superset, anchor }, or
 * null where theConcept or whereTo would refuse: no concept header, a reserved key, no superset, or a set that names no
 * node, isn't a set or a superset, or is outside the concept's class thread. The anchor is the set, when one is given
 * and isn't the concept's superset, else the superset.
 */
async function anchorOf(read, { concept, set }) {
  const c = await F.conceptOf(read, concept);
  if (!c) return null;
  const [header] = await K.headersByKey(read, [c.key]);
  const oKey = keyOf(header, c);
  if (X.RESERVED_KEYS.includes(oKey)) return null;
  const superset = await S.supersetOf(read, c.key);
  if (!superset) return null;
  let anchor = superset;
  if (typeof set === 'string' && set && set !== superset) {
    const node = await S.nodeOf(read, set);
    if (!node || S.kindOf(node) === 'other') return null;
    if (!(await reaches(read, { concept: c.key, anchor: set }))) return null;
    anchor = set;
  }
  return { concept: c, oKey, superset, anchor };
}

/**
 * The section's name, its slug and the fields (Decision 7) → { name, slug, fields: [[field, value]] }. A node with a
 * name gives its own, and fields may give only that name and the slug it gives (bad-fields). A node with no name, such
 * as a person node or a placeholder, takes its section's name from fields, cleaned as create-element cleans a name
 * (bad-name, naming fields: Amendment 1, item 8), and the slug that name gives; with none, the section has no name or
 * slug, and the concept's schema decides.
 */
function sectionFields(value, facts) {
  if (facts.name) {
    const name = facts.name;
    const slug = dtag.slug(name);
    return { name, slug, fields: X.parseFields(value, { name, slug }) };
  }
  let given = value;
  if (typeof value === 'string') {
    try { given = JSON.parse(value); } catch { given = value; } // parseFields refuses it below
  }
  if (!own(given, 'name')) return { name: null, slug: null, fields: X.parseFields(value, { name: null, slug: null }) };
  let name;
  try {
    name = X.cleanName(given.name);
  } catch (e) {
    if (e && e.code === X.BAD_NAME.code) throw refusal(X.BAD_NAME.code, `${e.message} A node with no name takes its section's name from fields. Nothing changed.`, { input: 'fields' });
    throw e;
  }
  const slug = dtag.slug(name);
  return { name, slug, fields: X.parseFields({ ...given, name }, { name, slug }) };
}

// ── the node's JSON (Decision 5) ──
/** U1: the node, its sections beside and its cache stamp, and every tag it has, each with its tapestryKey. */
const U1 = `MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange
  OPTIONAL MATCH (n)-[:HAS_TAG]->(t:NostrEventTag)
  RETURN n.tapestryOwnSections AS own, n.tapestryJsonUpdatedAt AS cached, t.tapestryKey AS tag, t.type AS type, t.value AS tagValue`;

/** A node's tags, each { key, type, value }, read with U1; and the node's own row. */
async function readNode(read, key) {
  const rows = await read(U1, { key });
  const tags = rows.filter((r) => r.type !== null && r.type !== undefined).map((r) => ({ key: r.tag, type: r.type, value: r.tagValue }));
  return { row: rows[0] || {}, tags };
}

/** A node's tags, each { key, type, value }. */
async function tagsOf(read, key) {
  return (await readNode(read, key)).tags;
}

/**
 * The node's JSON as the two operations read it → { view, base, own, tags, jsonTags, cached }. Its json tags are read as
 * update-node reads them: several that differ, one that can't be read, or JSON that isn't an object refuse
 * unreadable-json; none gives {}. For a node kept beside, `own` is its tapestryOwnSections, which must be JSON of an
 * object, and `view` is base with them laid over (F.overlaySections); for one kept in its json tag, `view` is base.
 * `cached` is whether the derive step has cached it (tapestryJsonUpdatedAt). With `letter: false`, a node kept beside
 * reads only its tapestryOwnSections, base {}: a removal writes only those, so the author's JSON, readable or not, is
 * no reason to refuse it (ADR 0022 Amendment 2, item 6).
 */
async function jsonOf(read, facts, kept, { letter = true } = {}) {
  const { row, tags } = await readNode(read, facts.key);
  const jsonTags = tags.filter((t) => t.type === 'json');
  const unreadable = (why) => refusal(UNREADABLE_JSON.code, say.unreadable(facts, why), { input: 'node' });
  let base = {};
  if (jsonTags.length && (kept !== 'beside' || letter)) {
    const values = [...new Set(jsonTags.map((t) => t.value))];
    if (values.length > 1) throw unreadable(`it has ${jsonTags.length} json tags that differ, and which one counts isn't guessed`);
    const got = F.readJson(values[0]);
    if (got.problem) throw unreadable(got.problem);
    if (!isObject(got.json)) throw unreadable("its JSON isn't an object, so it has no sections");
    base = got.json;
  }
  let sections = {};
  if (kept === 'beside') {
    const o = F.ownSectionsOf(row.own);
    if (o.problem) throw unreadable(o.problem);
    sections = o.sections || {};
  }
  return {
    view: kept === 'beside' ? F.overlaySections(base, sections) : base,
    base,
    own: sections,
    tags,
    jsonTags,
    cached: row.cached !== null && row.cached !== undefined,
  };
}

// ── the class thread's reads (Decisions 7 and 10; Amendment 1) ──
/** Whether a HAS_ELEMENT runs from the node keyed `from` to the node keyed `to`. */
async function isElementLink(read, from, to) {
  const { TERM } = S.aliases();
  const rows = await read(
    `MATCH (a:TapestryNode {tapestryKey: $from})-[r:\`${TERM}\`]->(b:TapestryNode {tapestryKey: $to})
     WHERE NOT a:GraphChange AND NOT b:GraphChange
     RETURN count(r) AS n`,
    { from, to },
  );
  return rows.length > 0 && Number(rows[0].n) > 0;
}

/**
 * M1: every HAS_ELEMENT into the node from the anchor or from any node below it → [{ from, uuid, labels, rel }], `from`
 * the tapestryKey of the node it runs from and `rel` the relationship's elementId, each relationship once.
 */
async function waysIn(read, { anchor, node }) {
  const { PROP, TERM } = S.aliases();
  const rows = await read(
    `MATCH (a:TapestryNode {tapestryKey: $anchor})-[:\`${PROP}\`*0..]->(x:TapestryNode)-[r:\`${TERM}\`]->(n:TapestryNode {tapestryKey: $node})
     WHERE NOT x:GraphChange
     RETURN DISTINCT x.tapestryKey AS from, x.uuid AS uuid, labels(x) AS labels, elementId(r) AS rel`,
    { anchor, node },
  );
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    if (typeof r.from !== 'string' || typeof r.rel !== 'string' || seen.has(r.rel)) continue;
    seen.add(r.rel);
    out.push({ from: r.from, uuid: typeof r.uuid === 'string' && r.uuid ? r.uuid : null, labels: Array.isArray(r.labels) ? r.labels : [], rel: r.rel });
  }
  return out;
}

/** M2: whether the class thread of the concept keyed `concept` reaches the node keyed `anchor`, its superset included. */
async function reaches(read, { concept, anchor }) {
  const { INIT, PROP } = S.aliases();
  const rows = await read(
    `MATCH (h:TapestryNode {tapestryKey: $concept})-[:\`${INIT}\`]->(:Superset)-[:\`${PROP}\`*0..]->(a:TapestryNode {tapestryKey: $anchor})
     RETURN count(*) AS n`,
    { concept, anchor },
  );
  return rows.length > 0 && Number(rows[0].n) > 0;
}

// ── firmware's memberships (Decision 11) ──
let firmwareCache = null;
/**
 * The memberships the active firmware's definition makes, with <TA> this instance's assistant → { elements, edges }:
 *   (a) elements: Map(address → { concept, file, what }): each concepts/<c>/elements/<f>.json makes its address, as
 *       X.firmwareElements gives it, an element of 39998:<TA>:<c>, which pass 1b signs with a z naming that header;
 *   (b) edges: Map('node:<set address> node:<element address>' → { what }): each concept manifest's HAS_ELEMENT
 *       { nodeFrom, nodeTo }, its set named as _sets.js's firmwareLinks part (c) names one, to the set file of that name
 *       in the concept's sets/ (else in any concept's), and its element to the element file of that name in its
 *       elements/. A name that resolves to nothing is left out.
 * Worked out once per process, as _sets.js's firmwareLinks is; empty, and not kept, with no assistant key.
 */
function firmwareMemberships() {
  if (firmwareCache) return firmwareCache;
  const { getOwnerAssistantPubkey } = require('../../../utils/assistantKeys');
  const ta = getOwnerAssistantPubkey();
  if (!ta) return { elements: new Map(), edges: new Map() };
  const fs = require('fs');
  const path = require('path');
  const firmware = require('../../../api/normalize/firmware');
  const root = firmware.firmwareDir();
  const concepts = (firmware.getManifest().concepts || []).filter((c) => isObject(c) && typeof c.slug === 'string' && typeof c.dir === 'string');
  const base = (c) => String(c.dir).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
  const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
  const jsonFiles = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : []);

  // (a) each element file, at the address install gives it
  const byFile = new Map();
  for (const [address, file] of X.firmwareElements()) byFile.set(file, address);
  const elements = new Map();
  for (const c of concepts) {
    const prefix = `${base(c)}/elements/`;
    const header = `39998:${ta}:${c.slug}`;
    for (const [file, address] of byFile) {
      if (!file.startsWith(prefix) || elements.has(address)) continue;
      elements.set(address, { concept: header, file, what: `the element file ${file}, which makes ${address} an element of ${header}` });
    }
  }

  // (b) each concept manifest's HAS_ELEMENT edges
  const setFiles = new Map();
  for (const c of concepts) {
    const mine = new Map();
    for (const f of jsonFiles(path.join(root, c.dir, 'sets'))) {
      const name = f.slice(0, -'.json'.length);
      const data = readJson(path.join(root, c.dir, 'sets', f));
      mine.set(name, isObject(data) && isObject(data.word) && typeof data.word.slug === 'string' && data.word.slug ? data.word.slug : name);
    }
    setFiles.set(c.slug, mine);
  }
  const setOf = (c, name) => {
    for (const owner of [c, ...concepts]) if (setFiles.get(owner.slug).has(name)) return setFiles.get(owner.slug).get(name);
    return null;
  };
  const edges = new Map();
  for (const c of concepts) {
    const m = readJson(path.join(root, c.dir, 'manifest.json'));
    const list = isObject(m) && Array.isArray(m.HAS_ELEMENT) ? m.HAS_ELEMENT : [];
    for (const e of list) {
      if (!isObject(e) || typeof e.nodeFrom !== 'string' || typeof e.nodeTo !== 'string') continue;
      const set = setOf(c, e.nodeFrom);
      const element = byFile.get(`${base(c)}/elements/${e.nodeTo}.json`);
      if (!set || !element) continue;
      const k = `node:39999:${ta}:${set} node:${element}`;
      if (!edges.has(k)) edges.set(k, { what: `the concept manifest ${base(c)}/manifest.json, whose HAS_ELEMENT lists ${e.nodeFrom} → ${e.nodeTo}` });
    }
  }
  firmwareCache = Object.freeze({ elements, edges });
  return firmwareCache;
}

/**
 * Check 1 of Decision 10: the part of firmware's definition that makes a link taken out (a manifest edge, its start
 * matched by its descriptors, _sets.js's descriptorsOf), or that makes the node an element of a concept it would leave
 * (an element file) → { what }, or null. `ways` are M1's links; `left`, [{ concept, uuid }], the concepts it would leave.
 */
async function firmwareMembership(read, { facts, ways, left }) {
  const { elements, edges } = firmwareMemberships();
  if (!facts.uuid || (!elements.size && !edges.size)) return null;
  for (const w of ways) {
    for (const d of await S.descriptorsOf(read, { key: w.from, uuid: w.uuid, labels: w.labels })) {
      const made = edges.get(`${d} node:${facts.uuid}`);
      if (made) return made;
    }
  }
  const el = elements.get(facts.uuid);
  if (el && left.some((c) => c.uuid === el.concept)) return { what: el.what };
  return null;
}

/**
 * Check 2 of Decision 10: on a node whose letter is another author's, the tag of that letter that claims a membership
 * the call would take out → { tag, value, author, address }, or null: an n tag naming a set a link in M1 runs from, then
 * a z tag naming the header of a concept it would leave. Pass 1d, wire-implicit-elements or the next import would make
 * either again.
 */
function authorClaim({ facts, tags, ways, left }) {
  if (!facts.hasLetter || facts.own) return null;
  const claim = (t) => ({ tag: t.type, value: t.value, author: facts.author, address: facts.uuid || facts.key });
  const from = new Set(ways.map((w) => w.uuid).filter(Boolean));
  const n = tags.find((t) => t.type === 'n' && from.has(t.value));
  if (n) return claim(n);
  const headers = new Set(left.map((c) => c.uuid).filter(Boolean));
  const z = tags.find((t) => t.type === 'z' && headers.has(t.value));
  return z ? claim(z) : null;
}

/**
 * R: the instance's own relationship events naming a pair from one of `from` to `to`, of the class thread's termination
 * type → [{ address, from }]. They are found as elements of the relationship concept (its header at
 * firmware.conceptUuid('relationship')), through its class thread, by the instance's own authors, and only then by
 * their nodeFrom, nodeTo and relationshipType tags: no read scans tag nodes by type and value, which no index covers
 * (ADR 0022 Amendment 2, item 4). An event a firmware reinstall's pass 1d hasn't wired into that concept yet is left
 * out. An instance with no relationship concept has none.
 */
async function relationshipEvents(read, { from, to, authors }) {
  const firmware = require('../../../api/normalize/firmware');
  const uuid = firmware.conceptUuid('relationship');
  if (!uuid || !to || !from.length || !authors.length) return [];
  const [header] = await read('MATCH (h:TapestryNode {uuid: $uuid}) WHERE h:ConceptHeader OR h:ListHeader RETURN h.tapestryKey AS key LIMIT 1', { uuid });
  if (!header || typeof header.key !== 'string') return [];
  const { INIT, PROP, TERM } = S.aliases();
  const rows = await read(
    `MATCH (h:TapestryNode {tapestryKey: $concept})-[:\`${INIT}\`]->(:Superset)-[:\`${PROP}\`*0..]->()-[:\`${TERM}\`]->(e:TapestryNode)
     WHERE e.pubkey IN $authors AND NOT e:GraphChange
     WITH DISTINCT e
     MATCH (e)-[:HAS_TAG]->(t:NostrEventTag {type: 'nodeTo'})
     WHERE t.value = $to
     MATCH (e)-[:HAS_TAG]->(f:NostrEventTag {type: 'nodeFrom'})
     WHERE f.value IN $from
     MATCH (e)-[:HAS_TAG]->(y:NostrEventTag {type: 'relationshipType'})
     WHERE y.value = $type
     RETURN DISTINCT e.uuid AS address, f.value AS from`,
    { concept: header.key, authors, to, from, type: TERM },
  );
  return rows.filter((r) => typeof r.address === 'string' && r.address);
}

/**
 * The instance's own letters that still state a removed membership (Decision 13) → [{ address, says }]: the node's own
 * letter, for a node kept in its json tag that has one, and each relationship event of the instance's own naming a
 * removed pair (follow-up 7). `removed` are the links taken out, { from, uuid }; `tags` the tags taken out; `sections`
 * the keys of the sections taken out.
 */
async function ownLetters(read, { facts, kept, removed, tags, sections, authors }) {
  const { TERM } = S.aliases();
  const out = [];
  if (kept === 'json-tag' && facts.hasLetter && facts.uuid) {
    const what = [...tags.map((t) => `its ${t.type} tag names ${t.value}`), ...sections.map((k) => `it has a ${k} section`)];
    out.push({ address: facts.uuid, says: `it still states a membership this call took out${what.length ? `: ${what.join('; ')}` : ''}. export nostr (A10.34) is what sends a letter that matches` });
  }
  const from = [...new Set(removed.map((w) => w.uuid).filter((u) => typeof u === 'string' && u))];
  if (facts.uuid && from.length) {
    for (const r of await relationshipEvents(read, { from, to: facts.uuid, authors })) {
      if (out.some((l) => l.address === r.address)) continue;
      out.push({ address: r.address, says: `it names ${r.from} ${TERM} ${facts.uuid}, a membership the graph no longer has. Nothing makes an edge from it again; export nostr (A10.34) is what sends letters that match` });
    }
  }
  return out;
}

module.exports = {
  UNKNOWN_NODE, TAG_NODE, MADE_ELSEWHERE_ADD, MADE_ELSEWHERE_REMOVE, UNREADABLE_JSON, NAME_IN_USE, FIRMWARE_MEMBERSHIP, AUTHOR_CLAIM, OTHER_CONCEPT,
  NOT_INSTALLED_ADD, NOT_INSTALLED_REMOVE, NO_SUPERSET_ADD, NO_SUPERSET_REMOVE,
  NODE, CONCEPT_KEYS, LETTERS,
  say, nodeOf, keysOf, keptIn, theNode, lookedAfterElsewhere, theConcept, anchorOf, sectionFields, tagsOf, jsonOf,
  isElementLink, waysIn, reaches, firmwareMemberships, firmwareMembership, authorClaim, ownLetters,
};
