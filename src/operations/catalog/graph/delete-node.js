'use strict';
/**
 * graph delete-node — delete one of this instance's own elements, with its relationships and its tags, the whole node
 * kept in its change entry (catalog §2, Nodes; story graph-operations-first-slice #26, AC1–AC7; ADR
 * graph-operations-first-slice/0026 Decisions 1–15 and Amendment 1).
 *
 * A write through the write path (src/operations/write.js), with no guard. In one transaction it locks the node, finds
 * out whose it is (_nodes.js, which knows person nodes and placeholders) and what kind it is, locks its concepts'
 * headers, counts and reads it whole, and deletes its tags and then it. Its entry's one change, node-deleted, holds the
 * node as it was, so a mistaken delete can be undone from the entry alone. A key whose deletion an entry records
 * answers already-gone. It signs nothing, and leaves the letter and the cached copy where they are, saying so.
 *
 * Its statements are the test plan's (26-delete-node.test-plan.md, "Statements"): U0, D1–D4 and D6 below.
 */

const { refusal } = require('../../refusal');
const { CHANGE_ENTRY, ENTRY, entryOf } = require('../../changes');
const R = require('../../reads');
const K = require('./_concepts');
const F = require('./_fields');
const S = require('./_sets');
const X = require('./_elements');
const N = require('./_nodes');

/** The most relationships one call removes, its tags' counted (Decision 8): the field mapping's cap. */
const CAP = 10000;
const count = (n) => Number(n).toLocaleString('en-US');
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
/** A map with its keys sorted, as an entry and an answer give properties. */
const sortKeys = (o) => (isObject(o) ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])) : {});
/** A node read whole, without what the driver adds to it (_labels, _id): its properties. */
const propsOf = (n) => sortKeys(Object.fromEntries(Object.entries(isObject(n) ? n : {}).filter(([k]) => k !== '_labels' && k !== '_id')));
const asCount = (x) => (typeof x === 'number' ? x : x && typeof x.toNumber === 'function' ? x.toNumber() : Number(x) || 0);

// ── the statements ──
const U0 = 'MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n';
/** D1, the entries that may record the node's deletion, newest first (Decision 3). */
const D1 = `MATCH (c:GraphChange)
  WHERE $key IN c.keys AND c.changes CONTAINS '"change":"node-deleted"'
  RETURN c.tapestryKey AS id, c.at AS at, c.byRole AS byRole, c.byPubkey AS byPubkey, c.operation AS operation, c.changes AS changes
  ORDER BY c.at DESC, c.tapestryKey DESC`;
/** D2, the nodes a class-thread link runs to from the node, itself aside (Decision 5). */
const D2 = `MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m)
  WHERE NOT x:GraphChange AND type(r) IN $types AND elementId(m) <> elementId(x)
  RETURN DISTINCT m.tapestryKey AS tapestryKey, coalesce(m.tapestryValue, m.name) AS name, m.uuid AS address
  ORDER BY tapestryKey LIMIT ${CAP + 1}`;
/** D3, the count of a node's relationships one way (Decision 8). */
const D3 = (out) => `MATCH (x:TapestryNode {tapestryKey: $key})${out ? '-[r]->' : '<-[r]-'}(m) WHERE NOT x:GraphChange RETURN count(r) AS n`;
/** D4, a node's relationships one way, each with its elementId, its properties and the node at its other end (Decision 9). */
const D4 = (out) => `MATCH (x:TapestryNode {tapestryKey: $key})${out ? '-[r]->' : '<-[r]-'}(m)
  WHERE NOT x:GraphChange
  RETURN elementId(r) AS id, type(r) AS type, properties(r) AS properties, m.tapestryKey AS tapestryKey,
         coalesce(m.tapestryValue, m.name) AS name, m.uuid AS address, m.pubkey AS author, labels(m) AS labels`;
/** D6, the delete (Decision 10; Amendment 1, item 2): each of its own tags, then the node. */
const D6_TAG = 'MATCH (t:NostrEventTag:TapestryNode {tapestryKey: $key}) DETACH DELETE t';
const D6_NODE = 'MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange DETACH DELETE n';

// ── the refusals (Decision 15) ──
const NOT_INSTALLED = Object.freeze({ code: 'not-installed', status: 409, when: "The instance has no assistant key, so it can't tell its own nodes from another author's (design D4), or firmware's own" });
const UNKNOWN_NODE = Object.freeze({ code: 'unknown-node', status: 404, when: 'A node that names no node of the graph, and whose deletion no change entry records (a change entry is not a node)' });
const MADE_ELSEWHERE = Object.freeze({ code: 'made-elsewhere', status: 409, when: 'A node another operation deletes, by its concepts or its role labels: a concept header or one of its core nodes, its JSON schema among them (graph delete-concept, A10.17), a set (graph delete-set, A10.17), a property (graph remove-property, A10.18) or a graph rule (the rulebook); the refusal names the operation to use' });
const FIRMWARE_NODE = Object.freeze({ code: 'firmware-node', status: 409, when: "One of firmware's own elements, which its file in the firmware defines and a firmware reinstall would make again: it changes through lifecycle seed-firmware (A10.37); the refusal names the file" });
const NOT_AN_ELEMENT = Object.freeze({ code: 'not-an-element', status: 409, when: "A node no concept's class thread reaches, such as a tag: it is no element of any concept (design D9); raw delete-node (A10.30, the owner's) removes any node" });
const HOLDS_ELEMENTS = Object.freeze({ code: 'holds-elements', status: 409, when: 'A node other nodes are elements through: a class-thread link runs from it to another node, which deleting it would take out of the concepts whose class thread runs through it (design D9); the refusal names how many, and the first five' });
const TOO_MANY = Object.freeze({ code: 'too-many-relationships', status: 409, when: `A node whose delete would remove more than ${count(CAP)} relationships, its tags' counted: one call removes at most ${count(CAP)}, each recorded in its change entry; raw delete-node (A10.30, the owner's) removes any node` });

// ── the answer's shapes (Decision 11) ──
const NODE = Object.freeze({
  type: 'object',
  required: [...R.NODE.required, 'hasLetter'],
  properties: { ...R.NODE.properties, hasLetter: { type: 'boolean', description: 'Whether it came from a nostr event, its letter' } },
});
const CONCEPT = Object.freeze({
  type: 'object',
  required: ['concept', 'name', 'address'],
  properties: {
    concept: { type: 'string', description: "The concept header's tapestryKey" },
    name: { type: 'string', nullable: true, description: "The concept header's name" },
    address: { type: 'string', nullable: true, description: "The concept header's address" },
  },
});
const REMOVED = Object.freeze({
  type: 'object',
  required: [...R.RELATIONSHIP.required, 'tag'],
  properties: {
    ...R.RELATIONSHIP.properties,
    tag: {
      type: 'object',
      nullable: true,
      required: ['key', 'type'],
      properties: { key: { type: 'string', description: "The tag's tapestryKey" }, type: { type: 'string', description: "The tag's type, such as a or e" } },
      description: "For a relationship one of its tags had, that tag: direction, from and to are then the tag's; null for one of the node's own",
    },
  },
});
const DELETION = Object.freeze({
  type: 'object',
  nullable: true,
  required: ['id', 'at', 'by', 'operation'],
  description: 'For already-gone, the change entry that records the deletion; null for deleted, whose entry is change',
  properties: { id: ENTRY.properties.id, at: ENTRY.properties.at, by: ENTRY.properties.by, operation: ENTRY.properties.operation },
});

/** "<name>" (<address>), or the key alone, for messages. */
const labelOf = N.labelOf;
/** The answer's node: the read conventions' five facts and hasLetter, from whoseNode's facts. */
const answerNode = (f) => ({ tapestryKey: f.key, name: f.name, address: f.uuid, author: f.author, own: f.own, hasLetter: f.hasLetter });

/** What made-elsewhere says, for the slug X.changedElsewhere found (Decision 5's table). */
function sayElsewhere(label, { slug, what }) {
  if (slug === 'concept-header') return `${label} is a concept header. A concept goes whole, with its core nodes, through graph delete-concept (A10.17, to come), once it has no elements or sets. Nothing changed.`;
  if (slug === 'json-schema') return `${label} is ${what}, one of its concept's core nodes, which goes with its concept: graph delete-concept (A10.17, to come) deletes a concept with its core nodes, and graph set-schema (A10.18, to come) replaces a schema. Nothing changed.`;
  if (slug === 'property') return `${label} is ${what}, which graph remove-property (A10.18, to come) takes out of its property tree and its concept's schema. Nothing changed.`;
  if (slug === 'set') return `${label} is ${what}. Sets are graph delete-set's (A10.17, to come), which deletes an empty set with the checks a set needs: the sets below it, its links to its parents, and the letters that still name it. Nothing changed.`;
  if (slug === 'graph-rule') return `${label} is ${what}, made from the rulebook, docs/GRAPH_RULES.md, and installed by firmware: a rule is changed or taken out in the rulebook, never in the graph. Nothing changed.`;
  return `${label} is ${what}, one of its concept's core nodes, which goes with its concept: graph delete-concept (A10.17, to come) deletes a concept with all of them. Nothing changed.`;
}

/** D4 both ways: [{ id, type, direction, properties, tapestryKey, name, address, author, labels }]. */
async function relationshipsOf(read, key) {
  const out = (await read(D4(true), { key })).map((r) => ({ ...r, direction: 'out' }));
  const into = (await read(D4(false), { key })).map((r) => ({ ...r, direction: 'in' }));
  return [...out, ...into];
}

/** The newest entry that records the deletion of the node keyed `key`, with its node-deleted change; or null (Decision 3). */
async function deletionOf(read, key) {
  for (const row of await read(D1, { key })) {
    const entry = entryOf(row);
    const change = entry.changes.find((c) => isObject(c) && c.change === 'node-deleted' && c.node === key);
    if (change) return { entry, change };
  }
  return null;
}

/** Who made an entry, in words. */
const whoOf = (by) => (by && by.role === 'local' ? 'the command inside the instance' : `${by && by.role} ${by && by.pubkey}`);

module.exports = {
  group: 'graph',
  name: 'delete-node',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Delete one of this instance's own elements, with its relationships and its tags, the whole node kept in its change entry",
  description: [
    "Deletes the element whose tapestryKey is `node`, one of this instance's own: its author is the instance's assistant or its owner, with a letter or without, or it records none. It goes with every relationship it had, in and out, and its tags with theirs. Nothing else is deleted: each node at the other end stays. Nothing is signed or sent anywhere.",
    "It refuses a node that came from another author's event, an admin's included (`not-own-node`), a person node (`person-node`) and a placeholder the import made (`placeholder-node`). It also refuses what another operation deletes (`made-elsewhere`: a concept header or core node and a JSON schema, `graph delete-concept`; a set, `graph delete-set`; a property, `graph remove-property`; a graph rule, the rulebook), firmware's own elements (`firmware-node`), a node no concept reaches (`not-an-element`), a node other nodes are elements through (`holds-elements`) and one whose delete would remove more than 10,000 relationships (`too-many-relationships`).",
    "Its change entry keeps the whole node, its properties, labels, tags and relationships, and JSON held only in the store, so `graph history` shows what went and a mistaken delete can be undone from the entry alone. The same call again changes nothing and records nothing (`already-gone`), saying when, by whom and through which operation it went.",
    "The node's letter, if it has one, stays wherever it was sent, and importing it again makes the node again, as a new node: `export retract` (A10.34) takes a letter back. The derive step's cached copy of its JSON stays in the store until `cache rebuild` (A10.36). `letterRemains` and `cacheRemains` say when either is so.",
  ].join('\n\n'),
  inputs: {
    node: N.keyInput("The tapestryKey of the element to delete: one of this instance's own"),
  },
  result: {
    description: "The node as it was; outcome deleted or already-gone; the concepts it was an element of; each relationship removed and how many tags went with it; whether its letter and its cached copy remain; for a repeat, the entry that records its deletion; and the change entry this call recorded (null when it changed nothing)",
    schema: {
      type: 'object',
      required: ['outcome', 'node', 'concepts', 'relationships', 'tags', 'letterRemains', 'cacheRemains', 'deletion', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['deleted', 'already-gone'], description: 'deleted, or already-gone when an entry records that it was deleted before' },
        node: NODE,
        concepts: { type: 'array', items: CONCEPT, description: 'Each concept it was an element of, by tapestryKey' },
        relationships: { type: 'array', items: REMOVED, description: 'Each relationship removed, once: its own and its tags\', its HAS_TAGs to the tags deleted with it aside; empty for already-gone' },
        tags: { type: 'integer', minimum: 0, description: 'How many tags were deleted with it; 0 for already-gone' },
        letterRemains: { type: 'boolean', description: 'Whether it had a letter, which stays wherever it was sent until export retract (A10.34) takes it back' },
        cacheRemains: { type: 'boolean', description: "Whether the store held a copy of its JSON (tapestryJsonUpdatedAt), which stays there until cache rebuild (A10.36); readers of the cache may still show it" },
        deletion: DELETION,
        note: { type: 'string', description: 'In words: what went, and what stays' },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [NOT_INSTALLED, UNKNOWN_NODE, N.PERSON_NODE, N.PLACEHOLDER_NODE, N.NOT_OWN_NODE, MADE_ELSEWHERE, FIRMWARE_NODE, NOT_AN_ELEMENT, HOLDS_ELEMENTS, TOO_MANY],
  guards: [],
  repeatKey: ['node'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    const key = inputs.node;

    // 1. What needs no graph (Decision 2).
    if (!K.assistant()) throw refusal(NOT_INSTALLED.code, "This instance has no assistant key, so it can't tell its own nodes from another author's, or firmware's own: the firmware isn't installed. Install it first (POST /api/firmware/install), then try again. Nothing changed.");

    // 2. The lock on the node (Decision 7): two deletes of one node, and a delete beside an update of it, go one at a
    // time. Neo4j 5.26 lets a lock statement that waited for a node another transaction deleted go on with no error, and
    // the read after it sees the node gone, so the second answers already-gone (ADR Amendment 2).
    await S.lockNode(tx, key);

    // 3. Whose node it is (Decision 4); no node is a repeat, or unknown-node (Decision 3).
    const [found] = await read(U0, { key });
    if (!found || !isObject(found.n)) return repeatOf(read, key);
    const n = found.n;
    const facts = N.factsOf(key, n);
    N.refuseUnlessOwn(facts, { input: 'node' });

    // 4. Its concepts, and what kind of node it is (Decision 5).
    const conceptKeys = [...new Set((await F.conceptsOfNodes(read, [key])).map((r) => r.concept))].sort();
    const headers = conceptKeys.length ? await K.headersByKey(read, conceptKeys) : [];
    const byKey = new Map(headers.map((h) => [h.key, h]));
    const elsewhere = X.changedElsewhere({ conceptUuids: headers.map((h) => h.uuid), labels: facts.labels, uuid: facts.uuid });
    if (elsewhere) throw refusal(MADE_ELSEWHERE.code, sayElsewhere(labelOf(facts), elsewhere), { input: 'node' });
    const file = X.firmwareElementOf(facts.uuid);
    if (file) {
      throw refusal(FIRMWARE_NODE.code, `${labelOf(facts)} is one of firmware's own elements, which its file ${file} defines: a firmware reinstall would make it again as that file says, so it changes in firmware's definition, through lifecycle seed-firmware (A10.37), never here. Nothing changed.`, { input: 'node' });
    }
    if (!conceptKeys.length) {
      throw refusal(NOT_AN_ELEMENT.code, `${labelOf(facts)} is an element of no concept: no concept's class thread reaches it, as for a tag, so it is no element to delete here (design D9). Nothing changed. raw delete-node (A10.30, to come) is the owner's way to remove any node.`, { input: 'node' });
    }
    const { INIT, PROP, TERM } = S.aliases();
    const below = await read(D2, { key, types: [INIT, PROP, TERM] });
    if (below.length) {
      const many = below.length > CAP ? `more than ${count(CAP)} other nodes` : `${count(below.length)} other node${below.length === 1 ? '' : 's'}`;
      const first = below.slice(0, 5).map((b) => (b.name ? `"${b.name}" (${b.tapestryKey})` : b.tapestryKey));
      throw refusal(HOLDS_ELEMENTS.code, `${labelOf(facts)} is a node other nodes are elements through: class-thread links run from it to ${many}${below.length > 5 ? `, the first five by tapestryKey ${first.join(', ')}` : `: ${first.join(', ')}`}. Deleting it would take them, and any below them, out of the concepts whose class thread runs through it, and leave any with no other way in of no concept (design D9). Nothing changed.`, { input: 'node' });
    }

    // 5. The locks on its concepts' headers, in tapestryKey order, word's and graphContext's aside (Decision 7).
    for (const c of conceptKeys) {
      const h = byKey.get(c);
      if (!h || !X.RESERVED_KEYS.includes(h.oKey)) await S.lockNode(tx, c);
    }

    // 6. The count, before anything is read whole (Decision 8; Amendment 1, item 3).
    const counted = asCount(((await read(D3(true), { key }))[0] || {}).n) + asCount(((await read(D3(false), { key }))[0] || {}).n);
    const tooMany = (total) => refusal(TOO_MANY.code, `${labelOf(facts)} has ${count(total)} relationships to remove, its tags' among them, more than the ${count(CAP)} one call removes: each goes into its change entry. Nothing changed. raw delete-node (A10.30, to come) is the owner's way to remove any node.`, { input: 'node' });
    if (counted > CAP) throw tooMany(counted);

    // 7. It, read whole (Decision 9): its tags first, so a relationship between it and its tag is read under the tag.
    const mine = await relationshipsOf(read, key);
    const tags = [];
    const tagKeys = new Set();
    for (const t of mine.filter((r) => r.direction === 'out' && r.type === 'HAS_TAG' && Array.isArray(r.labels) && r.labels.includes('NostrEventTag'))) {
      if (typeof t.tapestryKey !== 'string') throw new Error(`a tag of ${labelOf(facts)} has no tapestryKey, so it can't be deleted with it; run lifecycle migrate first`);
      if (tagKeys.has(t.tapestryKey)) continue; // a second HAS_TAG to one tag: the tag is read and deleted once (Amendment 3)
      tagKeys.add(t.tapestryKey);
      const rels = await relationshipsOf(read, t.tapestryKey);
      if (rels.some((r) => r.direction === 'in' && r.type === 'HAS_TAG' && r.tapestryKey !== key)) continue; // another node has it too: it stays
      const [whole] = await read(U0, { key: t.tapestryKey });
      tags.push({ key: t.tapestryKey, node: whole ? whole.n : {}, rels });
    }
    const ownTags = new Set(tags.map((t) => t.key));
    const seen = new Set();
    const removed = [];   // the answer's relationships
    const recorded = [];  // the entry's, the node's own
    const others = new Set();
    const ownKeys = R.ownKeys();
    const endOf = (r) => R.nodeOf({ tapestryKey: r.tapestryKey, name: r.name, address: r.address, author: r.author }, ownKeys);
    // Amendment 3: the entry names each other end by its tapestryKey, so a node with none would leave a relationship
    // that couldn't be put back from the entry alone (AC6).
    const keyed = (r) => {
      if (typeof r.tapestryKey !== 'string' || !r.tapestryKey) {
        throw new Error(`${labelOf(facts)} has a ${r.type} relationship with a node that has no tapestryKey, so its change entry couldn't name that node to put the relationship back; run lifecycle migrate first. Nothing was deleted`);
      }
    };
    const relOf = (from, r, tag) => ({
      type: r.type,
      direction: r.direction,
      from: r.direction === 'out' ? from : r.tapestryKey,
      to: r.direction === 'out' ? r.tapestryKey : from,
      node: endOf(r),
      properties: sortKeys(r.properties),
      tag,
    });
    const tagRecords = tags.map((t) => {
      const props = propsOf(t.node);
      const rels = [];
      for (const r of t.rels) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        if (r.direction === 'in' && r.type === 'HAS_TAG' && r.tapestryKey === key) continue; // its HAS_TAG from the node
        keyed(r);
        removed.push(relOf(t.key, r, { key: t.key, type: props.type }));
        rels.push({ type: r.type, direction: r.direction, other: r.tapestryKey, properties: sortKeys(r.properties) });
        if (r.tapestryKey !== key && !ownTags.has(r.tapestryKey)) others.add(r.tapestryKey);
      }
      const record = { labels: [...(Array.isArray(t.node._labels) ? t.node._labels : [])].sort(), properties: props };
      if (typeof props.value === 'string' && props.value.startsWith('lmdb:')) {
        // What the store holds, as it holds it, parse or not; null when its entry is missing (Amendment 3).
        const { resolveValue } = require('../../../lib/tapestry-resolve');
        record.stored = resolveValue(props.value);
      }
      record.relationships = rels;
      return record;
    });
    for (const r of mine) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      if (ownTags.has(r.tapestryKey)) continue; // a relationship with one of its own tags is the tag's
      keyed(r);
      removed.push(relOf(key, r, null));
      recorded.push({ type: r.type, direction: r.direction, other: r.tapestryKey, properties: sortKeys(r.properties) });
      if (r.tapestryKey !== key) others.add(r.tapestryKey);
    }
    if (seen.size > CAP) throw tooMany(seen.size);

    // 8. The delete (Decision 10): each of its own tags, then it. The counts must be what was read.
    let nodesDeleted = 0;
    let relationshipsDeleted = 0;
    for (const t of tags) {
      const { counters } = await tx.run(D6_TAG, { key: t.key });
      nodesDeleted += counters.nodesDeleted;
      relationshipsDeleted += counters.relationshipsDeleted;
    }
    const { counters } = await tx.run(D6_NODE, { key });
    nodesDeleted += counters.nodesDeleted;
    relationshipsDeleted += counters.relationshipsDeleted;
    if (nodesDeleted !== 1 + tags.length || relationshipsDeleted !== seen.size) {
      throw new Error(`${labelOf(facts)} changed while it was being deleted: ${nodesDeleted} nodes and ${relationshipsDeleted} relationships went, where ${1 + tags.length} and ${seen.size} were read. Nothing was deleted; try again`);
    }

    // 9. The answer and the entry (Decisions 11 and 12).
    const concepts = conceptKeys.map((c) => { const h = byKey.get(c); return { concept: c, name: (h && h.name) || null, address: (h && h.uuid) || null }; });
    const letterRemains = facts.hasLetter === true;
    const cacheRemains = n.tapestryJsonUpdatedAt !== undefined && n.tapestryJsonUpdatedAt !== null;
    const notes = ["Deleted from this instance's graph only: nothing was signed or sent anywhere."];
    if (letterRemains) notes.push(`Its letter, ${facts.uuid}, stays wherever it was sent, this instance's relay among them: export retract (A10.34, to come) is what takes a letter back, and importing that letter again makes the node again, as a new node with a new tapestryKey.`);
    else notes.push('It had no letter, so nothing of it was sent anywhere.');
    if (cacheRemains) notes.push(`The store keeps the cached copy of its JSON under its tapestryKey, which its JSON page and GET /api/tapestry-key/${key} may still show until cache rebuild (A10.36) drops it.`);
    notes.push(`Its change entry keeps the whole node, which graph history finds by ${key}.`);
    const was = {
      labels: [...facts.labels].sort(),
      properties: propsOf(n),
      concepts,
      relationships: recorded,
      tags: tagRecords,
    };
    return {
      data: { outcome: 'deleted', node: answerNode(facts), concepts, relationships: removed, tags: tags.length, letterRemains, cacheRemains, deletion: null, note: notes.join(' ') },
      changes: [{ change: 'node-deleted', node: key, nodes: [...others].filter((x) => typeof x === 'string').sort(), was }],
    };
  },
};

/** No node has the key: already-gone, from the entry that records its deletion, or unknown-node (Decision 3). */
async function repeatOf(read, key) {
  const found = await deletionOf(read, key);
  if (!found) {
    throw refusal(UNKNOWN_NODE.code, `No node of this graph has the tapestryKey ${key}, which node names, and no change entry records its deletion: it never named a node here, or something other than a graph write removed it. Nothing changed.`, { input: 'node' });
  }
  const { entry, change } = found;
  const was = isObject(change.was) ? change.was : {};
  const props = isObject(was.properties) ? was.properties : {};
  const facts = N.factsOf(key, { ...props, _labels: Array.isArray(was.labels) ? was.labels : [] });
  const deletion = { id: entry.id, at: entry.at, by: entry.by, operation: entry.operation };
  return {
    data: {
      outcome: 'already-gone',
      node: answerNode(facts),
      concepts: Array.isArray(was.concepts) ? was.concepts : [],
      relationships: [],
      tags: 0,
      letterRemains: facts.hasLetter === true,
      cacheRemains: props.tapestryJsonUpdatedAt !== undefined && props.tapestryJsonUpdatedAt !== null,
      deletion,
      note: `${labelOf(facts)} was deleted at ${entry.at}, by ${whoOf(entry.by)}, through ${entry.operation}: its entry is ${entry.id}. Nothing changed.`,
    },
    changes: [],
  };
}
