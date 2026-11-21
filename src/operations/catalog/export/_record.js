'use strict';
/**
 * What export nostr records of the letters it sent (story graph-operations-first-slice #34, AC1; ADR
 * graph-operations-first-slice/0034 Decision 8, Amendment 1 item 6). One write transaction, at the end of a call in
 * which some relay accepted some letter:
 *   - on each node whose new letter the instance's own relay accepted: its id and created_at become the letter's (so
 *     it has a letter, and a graph write that changes it answers letterOutOfDate) and its sentTo lists the relays
 *     holding that letter, own and each other by URL;
 *   - on each node whose unchanged letter an outside relay newly accepted: those relays added to its sentTo;
 *   each only while the node's id is still the one the call read, else it is left as it is and its change says raced.
 *   Nothing else on the node changes: not its tags, labels or relationships, and no NostrEvent label is added (D7);
 *   - one change entry, operation `export nostr`: a letter-sent change for each letter, with its node, address, kind,
 *     was (the { id, created_at } it replaced, or null; for a re-send, the same as now), now, and each relay's answer.
 *     Its keys are the nodes whose letters were sent, so graph history finds it by each.
 *
 *   record({ caller, letters }) → the entry as answered, or null when `letters` is empty
 *     letters: [{ key, address, kind, was, now, relays, sentTo (a new letter's, whole) | add (a re-send's) }]
 *
 * It never signs or sends. It opens nothing when it loads.
 */

const OPERATION = 'export nostr';

const SET_LETTER = `UNWIND $rows AS r
  MATCH (n:TapestryNode {tapestryKey: r.key})
  WHERE NOT n:GraphChange AND NOT n:NostrEventTag AND ((r.was IS NULL AND n.id IS NULL) OR n.id = r.was)
  SET n.id = r.id, n.created_at = toInteger(r.createdAt), n.sentTo = r.sentTo
  RETURN n.tapestryKey AS key`;
const ADD_SENT_TO = `UNWIND $rows AS r
  MATCH (n:TapestryNode {tapestryKey: r.key})
  WHERE NOT n:GraphChange AND NOT n:NostrEventTag AND n.id = r.id
  SET n.sentTo = coalesce(n.sentTo, []) + [x IN r.add WHERE NOT x IN coalesce(n.sentTo, [])]
  RETURN n.tapestryKey AS key`;

async function record({ caller, letters }) {
  if (!letters.length) return null;
  const graph = require('../../graph');
  const { recordChange } = require('../../changes');
  return graph.writeTransaction(async (tx) => {
    const fresh = letters.filter((l) => !l.add);
    const resent = letters.filter((l) => l.add);
    const set = new Set();
    if (fresh.length) {
      const { rows } = await tx.run(SET_LETTER, { rows: fresh.map((l) => ({ key: l.key, was: l.was ? l.was.id : null, id: l.now.id, createdAt: l.now.created_at, sentTo: l.sentTo })) });
      for (const r of rows) set.add(r.key);
    }
    if (resent.length) {
      const { rows } = await tx.run(ADD_SENT_TO, { rows: resent.map((l) => ({ key: l.key, id: l.now.id, add: l.add })) });
      for (const r of rows) set.add(r.key);
    }
    const changes = letters.map((l) => ({
      change: 'letter-sent', node: l.key, address: l.address, kind: l.kind, was: l.was, now: l.now, relays: l.relays,
      ...(set.has(l.key) ? {} : { raced: true }),
    }));
    return recordChange(tx, { at: new Date().toISOString(), caller, operation: OPERATION, changes });
  });
}

module.exports = { OPERATION, record };
