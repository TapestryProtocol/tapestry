'use strict';
/**
 * A node with no event (story graph-operations-first-slice #16, ADR graph-operations-first-slice/0016 Decision 1):
 * the node the nostr import would make of the letter its write would sign, recorded without signing. Every write that
 * makes a node uses it: graph create-concept now, graph create-set (A10.27) and create-element (A10.20) next.
 *
 * The node has the letter's address (`uuid`), kind, would-be author (the assistant, `pubkey`), name, and the time it was
 * made; its tapestryValue is its name (design D11); and keyNode gives it the shared label and a random tapestryKey (ADR
 * graph-operations-foundation/0003 Decision 8). It has no `id` and no NostrEvent label (D7). Its tags are tag nodes,
 * NostrEventTag, each with the uuid the import gives a tag, sha256("<uuid>:<tag.join(',')>:<index>"), its type and
 * value, and value1 and value2 only when the tag has them (importEventDirect, src/api/normalize/index.js). So every
 * reader of an imported node reads it, and a letter published for it later lands on the same node (ADR 0003 Decision 9).
 *
 *   makeNode(tx, { uuid, kind, labels, name, tags, pubkey, createdAt }) → its tapestryKey
 *   addTags(tx, key, rows)            tag nodes under a node, from tagRows (C6)
 *   tagRows(uuid, tags, from = 0)     the rows for tags, the first at index `from`
 *   LABELS, KINDS                     what a node may be given: labels never come from input
 *
 * It never signs, publishes or reads a key. Like _nodes.js, it opens nothing when it loads.
 */

const crypto = require('crypto');
const { keyNode } = require('../../../lib/tapestry-key-cypher');

/** The labels a node with no event may carry, besides the shared one keyNode adds. Never from input. */
const LABELS = Object.freeze(['ListHeader', 'ListItem', 'ConceptHeader', 'Superset', 'JSONSchema', 'Property', 'Set']);
/** The kinds a would-be letter may have: a replaceable list header or list item. */
const KINDS = Object.freeze([39998, 39999]);

/** The tag-node rows for `tags`, as the import makes them, the first at index `from`. */
function tagRows(uuid, tags, from = 0) {
  return tags.map((t, i) => ({
    uuid: crypto.createHash('sha256').update(`${uuid}:${t.join(',')}:${i + from}`).digest('hex'),
    type: String(t[0]),
    value: t[1] === undefined || t[1] === null ? '' : String(t[1]),
    value1: t[2] ? String(t[2]) : null,
    value2: t[3] ? String(t[3]) : null,
  }));
}

/** C6: tag nodes under the node with tapestryKey `key`, one per row; → how many were made. */
async function addTags(tx, key, rows) {
  if (!rows.length) return 0;
  const { rows: out } = await tx.run(
    `MATCH (n:TapestryNode {tapestryKey: $key})
     UNWIND $tags AS t
     CREATE (n)-[:HAS_TAG]->(tn:NostrEventTag {uuid: t.uuid, type: t.type, value: t.value})
     SET tn.value1 = t.value1, tn.value2 = t.value2
     ${keyNode('tn')}
     RETURN count(tn) AS made`,
    { key, tags: rows },
  );
  const made = out.length ? Number(out[0].made) : 0;
  if (made !== rows.length) throw new Error(`the tags of ${key} were not all written: ${made} of ${rows.length}`);
  return made;
}

/** C5 and C6: make one node with no event and its tags, in `tx`; → its tapestryKey. */
async function makeNode(tx, { uuid, kind, labels, name, tags = [], pubkey, createdAt }) {
  if (!KINDS.includes(kind)) throw new Error(`a node with no event has kind 39998 or 39999, not ${JSON.stringify(kind)}`);
  const bad = labels.filter((l) => !LABELS.includes(l));
  if (!labels.length || bad.length) throw new Error(`a node with no event takes labels from ${LABELS.join(', ')}; got ${JSON.stringify(labels)}`);
  // Each label is one of LABELS, so only a plain name reaches Cypher's text.
  const { rows } = await tx.run(
    `CREATE (n:${labels.join(':')} {uuid: $uuid, kind: $kind, pubkey: $pubkey, name: $name, tapestryValue: $name, created_at: $createdAt})
     ${keyNode('n')}
     RETURN n.tapestryKey AS key`,
    { uuid, kind, pubkey, name, createdAt },
  );
  const key = rows.length ? rows[0].key : null;
  if (typeof key !== 'string') throw new Error(`the node at ${uuid} was written, but its tapestryKey did not come back`);
  await addTags(tx, key, tagRows(uuid, tags));
  return key;
}

module.exports = { LABELS, KINDS, tagRows, addTags, makeNode };
