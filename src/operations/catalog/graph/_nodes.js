'use strict';
/**
 * What the graph writes share (story graph-operations-foundation #4, ADR graph-operations-foundation/0004 Decision 7):
 * the inputs that name a node by its tapestryKey (design D6) and a relationship by its type, and the one lookup every
 * write finds its nodes with. The lookup leaves change entries out, so no graph write can name one (Decision 5).
 * Requires nothing at load that opens anything (ADR 0001 Decision 10).
 *
 * It also holds the one test of whose node a node is (story graph-operations-first-slice #21, AC5; ADR
 * graph-operations-first-slice/0021 Decision 3 and Amendment 1), for every write that must leave someone else's node
 * as its author wrote it (design D4): graph update-node and delete-node (A10.26) now, and merge-nodes (A10.25) and
 * copy-node (A10.24) when they are built.
 *
 *   factsOf(key, node)                a node read whole, its properties and _labels, as whoseNode answers it
 *   whoseNode(read, key)              U0: { key, uuid, name, author, hasLetter, labels, person, placeholder, own }, or
 *                                     null for no node
 *   refuseUnlessOwn(facts, { input }) facts, for the instance's own node; else person-node, placeholder-node or
 *                                     not-own-node, in that order, naming the input
 *   requireOwn(read, key, { input })  that, for a key; unknown-node when no node has it
 *   NOT_OWN_NODE, PERSON_NODE, PLACEHOLDER_NODE  the refusals' declarations, which each write that calls requireOwn or
 *                                     refuseUnlessOwn lists
 *
 * And what a write that removes a node shares, moved from graph delete-node (story graph-operations-first-slice #18,
 * ADR graph-operations-first-slice/0018 Implementation notes), so a removal's change entry keeps the whole node:
 *   relationshipsOf(read, key)        D4 both ways: [{ id, type, direction, properties, tapestryKey, name, address, author, labels }]
 *   wholeNodeOf(read, key, opts)      the node read whole: U0 (unless opts.node gives it), D4, and each tag only it has,
 *                                     with that tag's relationships → { node, relationships, tags: [{ key, node, rels }] },
 *                                     or null for no node
 *   storedOf(value)                   what the store holds for an lmdb: value, parse or not (null when its entry is
 *                                     missing); undefined for any other value
 *   removalOf(read, key, change)      the newest entry recording a change of that name for the node → { entry, change },
 *                                     or null: a removal's repeat finds its entry with it
 *
 * A node is the instance's own when the read conventions answer `own: true` for it (src/operations/reads.js, C3): its
 * author is its assistant's or its owner's key, or it records none. An admin's letter is someone else's, as is anyone's
 * but those two keys (the owner's answer, story 21 open question 3). Two kinds of node are never its own, whatever key
 * they carry (story graph-operations-first-slice #26, AC3; ADR graph-operations-first-slice/0026 Decision 4, which
 * amends ADR 0021 Decision 3):
 *   person       a NostrUser node, which stands for the person whose key it carries, not for anything an author wrote
 *   placeholder  a NostrEvent with no created_at, which the import made for an event the graph doesn't hold: every
 *                import of an event sets its created_at, and no placeholder has one
 * The import makes both, so an operation leaves them as it made them. Reads still answer `own` by the author alone.
 */

const { refusal } = require('../../refusal');

const KEY_PATTERN = '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$';
// Only a plain name ever reaches Cypher's text, in backticks: a relationship type can't be a parameter (Decision 6).
const TYPE_PATTERN = '^[A-Za-z][A-Za-z0-9_]{0,63}$';

const keyInput = (description) => ({ schema: { type: 'string', pattern: KEY_PATTERN }, required: true, description });
const typeInput = (description) => ({ schema: { type: 'string', pattern: TYPE_PATTERN }, required: true, description });

const UNKNOWN_NODE = Object.freeze({ code: 'unknown-node', status: 404, when: 'A from or to that names no node of the graph (a change entry is not one); the refusal names which' });

/** The relationship a write is about, as its answer and its schema give it. */
const RELATIONSHIP = Object.freeze({
  type: 'object',
  required: ['type', 'from', 'to'],
  properties: {
    type: { type: 'string', description: 'Its type' },
    from: { type: 'string', description: 'The tapestryKey of the node it runs from' },
    to: { type: 'string', description: 'The tapestryKey of the node it runs to' },
  },
});

const NOT_OWN_NODE = Object.freeze({ code: 'not-own-node', status: 409, when: "A node that came from an event another author signed, or that records another author: its author isn't the instance's assistant or its owner, so it is that author's claim, which no operation changes (design D4); graph copy-node (A10.24) makes a copy of one's own. A person node or a placeholder is refused person-node or placeholder-node instead" });
const PERSON_NODE = Object.freeze({ code: 'person-node', status: 409, when: "A person node (NostrUser), which stands for the person whose key it carries: the import makes one for each author whose events it reads, and the instance's Web of Trust is computed from them, so an operation leaves it as the import made it; raw delete-node (A10.30, the owner's) removes any node" });
const PLACEHOLDER_NODE = Object.freeze({ code: 'placeholder-node', status: 409, when: "A placeholder the import made for an event the graph doesn't hold (a NostrEvent with no created_at): it stands for that event, so an operation leaves it as the import made it; importing the event fills it in, and raw delete-node (A10.30, the owner's) removes any node" });

/** Refuse unknown-node, naming the input, unless each of [input, tapestryKey] names a node of the graph. */
async function requireNodes(tx, wanted) {
  for (const [input, key] of wanted) {
    const rows = await tx.read('MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n.tapestryKey AS key LIMIT 1', { key });
    if (!rows.length) throw refusal('unknown-node', `No node of this graph has the tapestryKey ${key}, which ${input} names.`, { input });
  }
}

// ── whose node it is (ADR graph-operations-first-slice/0021 Decision 3) ──
const text = (x) => (typeof x === 'string' && x.length > 0 ? x : null);

/**
 * The facts of the node keyed `key`, from the node read whole ({ ...properties, _labels }, as U0 answers it, or as a
 * deletion's entry recorded it): → { key, uuid, name, author, hasLetter, labels, person, placeholder, own }.
 * - person: it is a NostrUser node; placeholder: it is a NostrEvent with no created_at (ADR 0026 Decision 4).
 * - own: the read conventions' own test (reads.js's nodeOf), so a write counts a node as its own when a read does,
 *   and false for a person node or a placeholder, whatever key it carries.
 * - hasLetter: a letter is an event, and a node the import made of one has its id; a placeholder's id names an event
 *   the graph doesn't hold, so it has none.
 */
function factsOf(key, n) {
  const R = require('../../reads');
  const labels = Array.isArray(n && n._labels) ? [...n._labels] : [];
  const uuid = text(n.uuid);
  const name = text(n.tapestryValue) || text(n.name);
  const author = text(n.pubkey);
  const person = labels.includes('NostrUser');
  const placeholder = labels.includes('NostrEvent') && (n.created_at === undefined || n.created_at === null);
  const own = !person && !placeholder && R.nodeOf({ tapestryKey: key, name, address: uuid, author }, R.ownKeys()).own;
  return { key, uuid, name, author, hasLetter: n.id !== undefined && n.id !== null && !placeholder, labels, person, placeholder, own };
}

/**
 * U0: the node a tapestryKey names, read whole, as _sets.js's R1 reads one (Amendment 1), and its facts (factsOf), or
 * null when no node (and no change entry) has the key.
 */
async function whoseNode(read, key) {
  if (typeof key !== 'string' || !key) return null;
  const rows = await read('MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n', { key });
  const n = rows.length && rows[0].n && typeof rows[0].n === 'object' ? rows[0].n : null;
  return n ? factsOf(key, n) : null;
}

/** "<name>" (<address>), or the key alone, for messages. */
const labelOf = (facts) => (facts.name ? `"${facts.name}" (${facts.uuid || facts.key})` : (facts.uuid || facts.key));

/**
 * `facts` (whoseNode's), when they are the instance's own node. Else it refuses, naming `input` (the write's own input:
 * node, or merge-nodes' merge): person-node, then placeholder-node, then not-own-node (ADR 0026 Decision 4). Nothing
 * changes: a write calls it before it writes.
 */
function refuseUnlessOwn(facts, { input = 'node' } = {}) {
  if (facts.person) {
    throw refusal(PERSON_NODE.code, `${labelOf(facts)} is a person node: it stands for the person whose key it carries, ${facts.author}, not for anything an author wrote. The import makes one for each author whose events it reads, and this instance's Web of Trust is computed from them, so an operation leaves it as the import made it. Nothing changed. raw delete-node (A10.30, to come) is the owner's way to remove any node.`, { input });
  }
  if (facts.placeholder) {
    throw refusal(PLACEHOLDER_NODE.code, `${labelOf(facts)} is a placeholder: the import made it for an event the graph doesn't hold, ${facts.uuid || facts.key}, when another node's event referred to it. It stands for that event, so an operation leaves it as the import made it. Nothing changed. Importing the event fills it in; raw delete-node (A10.30, to come) is the owner's way to remove any node.`, { input });
  }
  if (facts.own) return facts;
  const whose = facts.hasLetter
    ? `${labelOf(facts)} came from an event ${facts.author} signed`
    : `${labelOf(facts)} records ${facts.author} as its author, with no letter`;
  throw refusal(NOT_OWN_NODE.code, `${whose}, and that recorded author isn't one of this instance's own keys, its assistant's or its owner's. So the node is that author's claim, which an operation never changes: each point of view weighs it when it reads the graph (design D4). Nothing changed. graph copy-node (A10.24, to come) makes a copy of your own, linked to theirs (D8).`, { input });
}

/**
 * The instance's own node a tapestryKey names → whoseNode's facts. Refuses unknown-node when no node has the key, and
 * else as refuseUnlessOwn does, each naming `input`. Nothing changes: a write calls it before it writes.
 */
async function requireOwn(read, key, { input = 'node' } = {}) {
  const facts = await whoseNode(read, key);
  if (!facts) throw refusal('unknown-node', `No node of this graph has the tapestryKey ${key}, which ${input} names. Nothing changed.`, { input });
  return refuseUnlessOwn(facts, { input });
}

// ── a node read whole, and the entry that records its removal (moved from delete-node.js; ADR 0018) ──
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/** U0: a node read whole by its tapestryKey, change entries left out. */
const U0 = 'MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n';
/** D1: the entries that may record a change named `change` of the node, newest first (ADR 0026 Decision 3). */
const D1 = (change) => `MATCH (c:GraphChange)
  WHERE $key IN c.keys AND c.changes CONTAINS '"change":"${change}"'
  RETURN c.tapestryKey AS id, c.at AS at, c.byRole AS byRole, c.byPubkey AS byPubkey, c.operation AS operation, c.changes AS changes
  ORDER BY c.at DESC, c.tapestryKey DESC`;
/** D4, a node's relationships one way, each with its elementId, its properties and the node at its other end (ADR 0026 Decision 9). */
const D4 = (out) => `MATCH (x:TapestryNode {tapestryKey: $key})${out ? '-[r]->' : '<-[r]-'}(m)
  WHERE NOT x:GraphChange
  RETURN elementId(r) AS id, type(r) AS type, properties(r) AS properties, m.tapestryKey AS tapestryKey,
         coalesce(m.tapestryValue, m.name) AS name, m.uuid AS address, m.pubkey AS author, labels(m) AS labels`;
// A change's name is a constant of the code, kebab-case, never input: only such a name reaches D1's text.
const CHANGE_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** D4 both ways: [{ id, type, direction, properties, tapestryKey, name, address, author, labels }]. */
async function relationshipsOf(read, key) {
  const out = (await read(D4(true), { key })).map((r) => ({ ...r, direction: 'out' }));
  const into = (await read(D4(false), { key })).map((r) => ({ ...r, direction: 'in' }));
  return [...out, ...into];
}

/**
 * The node keyed `key` read whole (ADR 0026 Decision 9): the node (U0, unless `node` gives it as U0 read it), its
 * relationships both ways, and each of its tags that no other node has, with that tag's own relationships, read
 * before anything else so a relationship between the node and its tag is read under the tag. → { node, relationships,
 * tags: [{ key, node, rels }] }, or null when no node has the key. `label` names the node in a failure's message.
 */
async function wholeNodeOf(read, key, { node = undefined, label = null } = {}) {
  let n = node;
  if (n === undefined) {
    const [found] = await read(U0, { key });
    n = found && isObject(found.n) ? found.n : null;
  }
  if (!n) return null;
  const relationships = await relationshipsOf(read, key);
  const tags = [];
  const tagKeys = new Set();
  for (const t of relationships.filter((r) => r.direction === 'out' && r.type === 'HAS_TAG' && Array.isArray(r.labels) && r.labels.includes('NostrEventTag'))) {
    if (typeof t.tapestryKey !== 'string') throw new Error(`a tag of ${label || key} has no tapestryKey, so it can't be deleted with it; run lifecycle migrate first`);
    if (tagKeys.has(t.tapestryKey)) continue; // a second HAS_TAG to one tag: the tag is read and deleted once (ADR 0026 Amendment 3)
    tagKeys.add(t.tapestryKey);
    const rels = await relationshipsOf(read, t.tapestryKey);
    if (rels.some((r) => r.direction === 'in' && r.type === 'HAS_TAG' && r.tapestryKey !== key)) continue; // another node has it too: it stays
    const [whole] = await read(U0, { key: t.tapestryKey });
    tags.push({ key: t.tapestryKey, node: whole ? whole.n : {}, rels });
  }
  return { node: n, relationships, tags };
}

/** What the store holds for an lmdb: value, as it holds it, parse or not; null when its entry is missing; undefined for any other value. */
function storedOf(value) {
  if (typeof value !== 'string' || !value.startsWith('lmdb:')) return undefined;
  const { resolveValue } = require('../../../lib/tapestry-resolve');
  return resolveValue(value);
}

/** The newest entry that records a change named `change` of the node keyed `key`, with that change → { entry, change }, or null. */
async function removalOf(read, key, change) {
  if (!CHANGE_NAME.test(String(change))) throw new Error(`a change's name is kebab-case; got ${JSON.stringify(change)}`);
  const { entryOf } = require('../../changes');
  for (const row of await read(D1(change), { key })) {
    const entry = entryOf(row);
    const found = entry.changes.find((c) => isObject(c) && c.change === change && c.node === key);
    if (found) return { entry, change: found };
  }
  return null;
}

module.exports = {
  KEY_PATTERN, TYPE_PATTERN, keyInput, typeInput, UNKNOWN_NODE, NOT_OWN_NODE, PERSON_NODE, PLACEHOLDER_NODE, RELATIONSHIP,
  requireNodes, factsOf, whoseNode, refuseUnlessOwn, requireOwn, labelOf,
  U0, relationshipsOf, wholeNodeOf, storedOf, removalOf,
};
