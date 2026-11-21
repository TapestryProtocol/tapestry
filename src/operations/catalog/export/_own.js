'use strict';
/**
 * Export nostr's promise to the graph (story graph-operations-first-slice #34, AC6; ADR
 * graph-operations-first-slice/0034 Decision 10): a letter export sent never comes back over its node. Import nostr
 * answers such a letter `own` and writes nothing. Today's other importers ask this first:
 *   POST /api/neo4j/event-update (src/api/neo4j/eventSync.js), before it deletes any tag;
 *   the I/O import's first phase (src/api/io.js), after it writes the event to strfry and before it imports it;
 *   the client-publish route's brain-write hook (src/api/strfry/tapestryBrainWrite.js), before it imports.
 *
 *   holdsLetterOrNewer(read, event) → true when the node at the letter's address (or keyed by its id) is the
 *     instance's own (graph/_nodes.js's factsOf) and holds that letter, or a newer one by NIP-01's order: a later
 *     created_at, or on a tie the lower id. True too for any letter the node's sentIds lists, newer or not, whatever
 *     the node holds: one that lost a race of two exports, or whose read-back didn't answer (Amendment 2 item 1,
 *     Amendment 3 item 2; _record.js keeps sentIds). False for anything else: a newer letter no export sent, another
 *     author's node, an own node with no letter that its sentIds doesn't list, no node, or something that isn't an
 *     event. It reads the node only, never a change entry, so its cost doesn't grow with the graph's history. `read`
 *     is the graph seam's read.
 *
 * It reads and never writes, signs or sends. The loader skips it, as every `_` file. It requires nothing at load that
 * opens anything (ADR graph-operations-foundation/0001 Decision 10).
 */

/** The nodes at the letter's address and at its id, as a node's facts need them, with their sentIds. */
const AT = `UNWIND $uuids AS u
  MATCH (n:TapestryNode {uuid: u})
  WHERE NOT n:NostrEventTag AND NOT n:GraphChange
  RETURN DISTINCT n.tapestryKey AS key, n.uuid AS uuid, n.id AS id, n.created_at AS created_at, n.pubkey AS pubkey,
         n.name AS name, n.tapestryValue AS tapestryValue, labels(n) AS labels, n.sentIds AS sentIds`;

const HEX64 = /^[0-9a-f]{64}$/;

/** Whether `e` has the shape a letter needs to be keyed and compared. */
function isLetter(e) {
  return !!e && typeof e === 'object' && typeof e.id === 'string' && HEX64.test(e.id) && typeof e.pubkey === 'string'
    && Number.isInteger(e.kind) && Number.isSafeInteger(e.created_at) && Array.isArray(e.tags) && e.tags.every(Array.isArray);
}

async function holdsLetterOrNewer(read, event) {
  if (!isLetter(event)) return false;
  const { keyOf } = require('../import/_letters');
  const { factsOf } = require('../graph/_nodes');
  const uuids = [...new Set([keyOf(event).uuid, event.id])];
  const rows = await read(AT, { uuids });
  for (const r of rows || []) {
    if (!r || typeof r.key !== 'string') continue;
    const facts = factsOf(r.key, { uuid: r.uuid, id: r.id, created_at: r.created_at, pubkey: r.pubkey, name: r.name, tapestryValue: r.tapestryValue, _labels: r.labels });
    if (!facts.own) continue;
    if (Array.isArray(r.sentIds) && r.sentIds.includes(event.id)) return true;
    if (!facts.hasLetter) continue;
    if (r.id === event.id) return true;
    const at = Number(r.created_at);
    if (at > event.created_at || (at === event.created_at && String(r.id) < event.id)) return true;
  }
  return false;
}

/** The words an importer answers with when it turns a letter away. */
const TURNED_AWAY = "This instance's own node at the letter's address already holds this letter or a newer one, or export nostr sent this letter for it (export records the letters it sends on their nodes and in its change entries), so importing it would put a letter export sent, or an older one, back over what the graph holds now. Nothing changed.";

module.exports = { holdsLetterOrNewer, TURNED_AWAY };
