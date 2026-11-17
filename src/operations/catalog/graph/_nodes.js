'use strict';
/**
 * What the graph writes share (story graph-operations-foundation #4, ADR graph-operations-foundation/0004 Decision 7):
 * the inputs that name a node by its tapestryKey (design D6) and a relationship by its type, and the one lookup every
 * write finds its nodes with. The lookup leaves change entries out, so no graph write can name one (Decision 5).
 * Requires nothing at load that opens anything (ADR 0001 Decision 10).
 *
 * It also holds the one test of whose node a node is (story graph-operations-first-slice #21, AC5; ADR
 * graph-operations-first-slice/0021 Decision 3 and Amendment 1), for every write that must leave someone else's node
 * as its author wrote it (design D4): graph update-node now, and merge-nodes (A10.25), delete-node (A10.26) and
 * copy-node (A10.24) when they are built.
 *
 *   whoseNode(read, key)              U0: { key, uuid, name, author, hasLetter, labels, own }, or null for no node
 *   requireOwn(read, key, { input })  that, for the instance's own node; else unknown-node or not-own-node, naming the input
 *   NOT_OWN_NODE                      the refusal's declaration, which each write that calls requireOwn lists
 *
 * A node is the instance's own exactly when the read conventions answer `own: true` for it (src/operations/reads.js,
 * C3): its author is its assistant's or its owner's key, or it records none. An admin's letter is someone else's, as
 * is anyone's but those two keys (the owner's answer, story 21 open question 3).
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

const NOT_OWN_NODE = Object.freeze({ code: 'not-own-node', status: 409, when: "A node that came from an event another author signed, or that records another author: its author isn't the instance's assistant or its owner, so it is that author's claim, which no operation changes (design D4); graph copy-node (A10.24) makes a copy of one's own" });

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
 * U0: the node a tapestryKey names, read whole, as _sets.js's R1 reads one (Amendment 1), and whether it is the
 * instance's own, by the read conventions' own test (reads.js's nodeOf), so a write counts a node as its own exactly
 * when a read does. → { key, uuid, name, author, hasLetter, labels, own }, or null when no node (and no change entry)
 * has the key. A letter is an event: a node the import made of one has its id.
 */
async function whoseNode(read, key) {
  if (typeof key !== 'string' || !key) return null;
  const rows = await read('MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n', { key });
  const n = rows.length && rows[0].n && typeof rows[0].n === 'object' ? rows[0].n : null;
  if (!n) return null;
  const R = require('../../reads');
  const uuid = text(n.uuid);
  const name = text(n.tapestryValue) || text(n.name);
  const author = text(n.pubkey);
  const own = R.nodeOf({ tapestryKey: key, name, address: uuid, author }, R.ownKeys()).own;
  return { key, uuid, name, author, hasLetter: n.id !== undefined && n.id !== null, labels: Array.isArray(n._labels) ? [...n._labels] : [], own };
}

/** "<name>" (<address>), or the key alone, for messages. */
const labelOf = (facts) => (facts.name ? `"${facts.name}" (${facts.uuid || facts.key})` : (facts.uuid || facts.key));

/**
 * The instance's own node a tapestryKey names → whoseNode's facts. Refuses unknown-node when no node has the key, and
 * not-own-node when the node is someone else's, each naming `input` (the write's own input: node, or merge-nodes'
 * merge). Neither changes anything: a write calls it before it writes.
 */
async function requireOwn(read, key, { input = 'node' } = {}) {
  const facts = await whoseNode(read, key);
  if (!facts) throw refusal('unknown-node', `No node of this graph has the tapestryKey ${key}, which ${input} names. Nothing changed.`, { input });
  if (facts.own) return facts;
  const whose = facts.hasLetter
    ? `${labelOf(facts)} came from an event ${facts.author} signed`
    : `${labelOf(facts)} records ${facts.author} as its author, with no letter`;
  throw refusal(NOT_OWN_NODE.code, `${whose}, and that recorded author isn't one of this instance's own keys, its assistant's or its owner's. So the node is that author's claim, which an operation never changes: each point of view weighs it when it reads the graph (design D4). Nothing changed. graph copy-node (A10.24, to come) makes a copy of your own, linked to theirs (D8).`, { input });
}

module.exports = { KEY_PATTERN, TYPE_PATTERN, keyInput, typeInput, UNKNOWN_NODE, NOT_OWN_NODE, RELATIONSHIP, requireNodes, whoseNode, requireOwn };
