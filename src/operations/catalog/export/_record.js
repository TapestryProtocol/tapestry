'use strict';
/**
 * What export nostr records of the letters it sent (story graph-operations-first-slice #34, AC1; ADR
 * graph-operations-first-slice/0034 Decision 8, Amendment 1 item 6, Amendment 2 item 1, Amendment 3 items 1 and 2). One
 * write transaction, at the end of a call in which some relay accepted some letter, or a letter's read-back didn't
 * answer:
 *   - first the write lock of each node it records a letter for, taken in tapestryKey order before it reads what they
 *     hold, as the graph writes' lockNode takes one (catalog/graph/_sets.js), so two records of one node go one after
 *     the other;
 *   - on each node whose new letter the instance's own relay accepted: its id and created_at become the letter's (so
 *     it has a letter, and a graph write that changes it answers letterOutOfDate) and its sentTo lists the relays
 *     holding that letter, own and each other by URL. That is while the node's id is still the one the call read, or
 *     while the node holds an older letter another export sent (one its sentIds lists): of the letters export sent for
 *     a node, the node keeps the newest by NIP-01's order (the later created_at, or on a tie the lower id). A node that
 *     already holds this very letter, which another export signed in the same second, gets these relays added to its
 *     sentTo, as a re-send does. A node that holds a newer letter export sent, or a letter no export sent, is left as
 *     it is, and its change says raced;
 *   - on each node whose unchanged letter an outside relay newly accepted: those relays added to its sentTo, while it
 *     still holds that letter, else its change says raced;
 *   - a letter whose read-back didn't answer (unread) may be on the instance's own relay, so it is in the entry, with
 *     each relay's answer, and on its node only in sentIds;
 *   - on each node it signed a letter for, accepted (set, already held or raced) or unread: sentIds, the ids of the
 *     newest MAX_SENT_IDS letters export signed for it, each once, the latest recorded last. A re-send lists none.
 *     _own.js's guard reads it, and no change entry (Amendment 3 item 2);
 *   Nothing else on the node changes: not its tags, labels or relationships, and no NostrEvent label is added (D7);
 *   - one change entry, operation `export nostr`: a letter-sent change for each letter, with its node, address, kind,
 *     was (the { id, created_at } it replaced, or null; for a re-send, or a letter the node already held, the same as
 *     now), now, and each relay's answer. Its keys are the nodes whose letters were sent, so graph history finds it by
 *     each.
 *
 *   record({ caller, letters }) → the entry as answered, or null when `letters` is empty
 *     letters: [{ key, address, kind, was, now, relays, sentTo (a new letter's, whole) | add (a re-send's) | unread }]
 *
 * It never signs or sends. It opens nothing when it loads.
 */

const OPERATION = 'export nostr';
/** How many letter ids a node's sentIds keeps, the newest (Amendment 3 item 2). */
const MAX_SENT_IDS = 20;

/** Each node's write lock, as lockNode takes it: tapestryLock set and taken off again, so only the lock remains. */
const LOCK = `UNWIND $keys AS key
  MATCH (n:TapestryNode {tapestryKey: key})
  WHERE NOT n:GraphChange AND NOT n:NostrEventTag
  SET n.tapestryLock = true REMOVE n.tapestryLock
  RETURN count(n) AS n`;
const HELD = `UNWIND $keys AS key
  MATCH (n:TapestryNode {tapestryKey: key})
  WHERE NOT n:GraphChange AND NOT n:NostrEventTag
  RETURN key, n.id AS id, n.created_at AS created_at, n.sentIds AS sentIds`;
const SET_LETTER = `UNWIND $rows AS r
  MATCH (n:TapestryNode {tapestryKey: r.key})
  WHERE NOT n:GraphChange AND NOT n:NostrEventTag
  SET n.id = r.id, n.created_at = toInteger(r.createdAt), n.sentTo = r.sentTo
  RETURN n.tapestryKey AS key`;
const ADD_SENT_TO = `UNWIND $rows AS r
  MATCH (n:TapestryNode {tapestryKey: r.key})
  WHERE NOT n:GraphChange AND NOT n:NostrEventTag AND n.id = r.id
  SET n.sentTo = coalesce(n.sentTo, []) + [x IN r.add WHERE NOT x IN coalesce(n.sentTo, [])]
  RETURN n.tapestryKey AS key`;
const SET_SENT_IDS = `UNWIND $rows AS r
  MATCH (n:TapestryNode {tapestryKey: r.key})
  WHERE NOT n:GraphChange AND NOT n:NostrEventTag
  SET n.sentIds = r.sentIds
  RETURN n.tapestryKey AS key`;

const text = (x) => (typeof x === 'string' && x ? x : null);
const num = (x) => (x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? null : Number(x));
/** Whether letter `a` is newer than `b` by NIP-01's order: the later created_at, or on a tie the lower id. */
const newer = (a, b) => b.created_at === null || a.created_at > b.created_at || (a.created_at === b.created_at && a.id < b.id);

async function record({ caller, letters }) {
  if (!letters.length) return null;
  const graph = require('../../graph');
  const { recordChange } = require('../../changes');
  return graph.writeTransaction(async (tx) => {
    const fresh = letters.filter((l) => l.sentTo);
    const toAdd = letters.filter((l) => l.add).map((l) => ({ l, add: l.add }));
    const raced = new Set();
    const replaced = new Map();
    const keys = [...new Set(letters.map((l) => l.key))].sort();
    // The locks first, then what each node holds now (Amendment 2 item 1).
    await tx.run(LOCK, { keys });
    const held = new Map();
    for (const r of await tx.read(HELD, { keys })) {
      held.set(r.key, { id: text(r.id), created_at: num(r.created_at), sentIds: Array.isArray(r.sentIds) ? r.sentIds.filter((x) => typeof x === 'string') : [] });
    }
    const readId = (l) => (l.was ? l.was.id : null);
    const toSet = [];
    for (const l of fresh) {
      const h = held.get(l.key);
      if (h && h.id === readId(l)) toSet.push(l);
      else if (h && h.id === l.now.id) {
        // This very letter, which another export signed in the same second: its relays are added, as a re-send's
        // (Amendment 3 item 1).
        toAdd.push({ l, add: l.sentTo });
        replaced.set(l.key, { id: h.id, created_at: h.created_at });
      } else if (h && h.id && h.sentIds.includes(h.id) && newer(l.now, h)) {
        toSet.push(l);
        replaced.set(l.key, { id: h.id, created_at: h.created_at });
      } else raced.add(l.key);
    }
    if (toSet.length) await tx.run(SET_LETTER, { rows: toSet.map((l) => ({ key: l.key, id: l.now.id, createdAt: l.now.created_at, sentTo: l.sentTo })) });
    if (toAdd.length) {
      const { rows } = await tx.run(ADD_SENT_TO, { rows: toAdd.map(({ l, add }) => ({ key: l.key, id: l.now.id, add })) });
      const added = new Set(rows.map((r) => r.key));
      for (const { l } of toAdd) if (!added.has(l.key)) raced.add(l.key);
    }
    // Each letter signed for a node, accepted or unread, in its sentIds once, the newest kept (Amendment 3 item 2).
    const lists = [];
    for (const l of letters) {
      const h = held.get(l.key);
      if (l.add || !h || h.sentIds.includes(l.now.id)) continue;
      lists.push({ key: l.key, sentIds: [...h.sentIds, l.now.id].slice(-MAX_SENT_IDS) });
    }
    if (lists.length) await tx.run(SET_SENT_IDS, { rows: lists });
    const changes = letters.map((l) => ({
      change: 'letter-sent', node: l.key, address: l.address, kind: l.kind, was: replaced.get(l.key) || l.was, now: l.now, relays: l.relays,
      ...(raced.has(l.key) ? { raced: true } : {}),
    }));
    return recordChange(tx, { at: new Date().toISOString(), caller, operation: OPERATION, changes });
  });
}

module.exports = { OPERATION, record };
