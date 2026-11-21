'use strict';
/**
 * What export nostr records of the letters it sent (story graph-operations-first-slice #34, AC1; ADR
 * graph-operations-first-slice/0034 Decision 8, Amendment 1 item 6, Amendment 2 item 1). One write transaction, at the
 * end of a call in which some relay accepted some letter, or a letter's read-back didn't answer:
 *   - first the write lock of each node it sets, taken in tapestryKey order before it reads their ids, as the graph
 *     writes' lockNode takes one (catalog/graph/_sets.js), so two records of one node go one after the other;
 *   - on each node whose new letter the instance's own relay accepted: its id and created_at become the letter's (so
 *     it has a letter, and a graph write that changes it answers letterOutOfDate) and its sentTo lists the relays
 *     holding that letter, own and each other by URL. That is while the node's id is still the one the call read, or
 *     while the node holds an older letter another export sent: of the letters export sent for a node, the node keeps
 *     the newest by NIP-01's order (the later created_at, or on a tie the lower id). A node that holds a newer letter
 *     export sent, or a letter no export sent, is left as it is, and its change says raced;
 *   - on each node whose unchanged letter an outside relay newly accepted: those relays added to its sentTo, while it
 *     still holds that letter, else its change says raced;
 *   - a letter whose read-back didn't answer (unread) may be on the instance's own relay, so it is in the entry, with
 *     each relay's answer, and on no node;
 *   Nothing else on the node changes: not its tags, labels or relationships, and no NostrEvent label is added (D7);
 *   - one change entry, operation `export nostr`: a letter-sent change for each letter, with its node, address, kind,
 *     was (the { id, created_at } it replaced, or null; for a re-send, the same as now), now, and each relay's answer.
 *     Its keys are the nodes whose letters were sent, so graph history finds it by each.
 *
 *   record({ caller, letters }) → the entry as answered, or null when `letters` is empty
 *     letters: [{ key, address, kind, was, now, relays, sentTo (a new letter's, whole) | add (a re-send's) | unread }]
 *   sentByExport(read, pairs) → a Set of `<key> <id>`, for each { key, id } of `pairs` that an export nostr entry
 *     records as a letter sent for that node (a letter-sent change's now), whatever the node holds; _own.js's guard
 *     reads it too (Amendment 2 item 1)
 *
 * It never signs or sends. It opens nothing when it loads.
 */

const OPERATION = 'export nostr';

/** Each node's write lock, as lockNode takes it: tapestryLock set and taken off again, so only the lock remains. */
const LOCK = `UNWIND $keys AS key
  MATCH (n:TapestryNode {tapestryKey: key})
  WHERE NOT n:GraphChange AND NOT n:NostrEventTag
  SET n.tapestryLock = true REMOVE n.tapestryLock
  RETURN count(n) AS n`;
const HELD = `UNWIND $keys AS key
  MATCH (n:TapestryNode {tapestryKey: key})
  WHERE NOT n:GraphChange AND NOT n:NostrEventTag
  RETURN key, n.id AS id, n.created_at AS created_at`;
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
/** The export nostr entries naming a node whose changes' text holds an id; each is then read to be sure. */
const SENT_BY_EXPORT = `UNWIND $pairs AS p
  MATCH (c:GraphChange {operation: $operation})
  WHERE p.key IN c.keys AND c.changes CONTAINS p.id
  RETURN p.key AS key, p.id AS id, c.changes AS changes`;

const text = (x) => (typeof x === 'string' && x ? x : null);
const num = (x) => (x === null || x === undefined || x === '' || !Number.isFinite(Number(x)) ? null : Number(x));
/** Whether letter `a` is newer than `b` by NIP-01's order: the later created_at, or on a tie the lower id. */
const newer = (a, b) => b.created_at === null || a.created_at > b.created_at || (a.created_at === b.created_at && a.id < b.id);

async function sentByExport(read, pairs) {
  const out = new Set();
  const list = (pairs || []).filter((p) => p && typeof p.key === 'string' && typeof p.id === 'string' && p.id);
  if (!list.length) return out;
  for (const r of await read(SENT_BY_EXPORT, { pairs: list, operation: OPERATION })) {
    let changes = [];
    try { changes = JSON.parse(r.changes); } catch { changes = []; }
    if (Array.isArray(changes) && changes.some((c) => c && c.change === 'letter-sent' && c.node === r.key && c.now && c.now.id === r.id)) out.add(`${r.key} ${r.id}`);
  }
  return out;
}

async function record({ caller, letters }) {
  if (!letters.length) return null;
  const graph = require('../../graph');
  const { recordChange } = require('../../changes');
  return graph.writeTransaction(async (tx) => {
    const fresh = letters.filter((l) => l.sentTo);
    const resent = letters.filter((l) => l.add);
    const raced = new Set();
    const replaced = new Map();
    const keys = [...new Set([...fresh, ...resent].map((l) => l.key))].sort();
    if (keys.length) {
      // The locks first, then what each node holds now (Amendment 2 item 1).
      await tx.run(LOCK, { keys });
      const held = new Map();
      for (const r of await tx.read(HELD, { keys })) held.set(r.key, { id: text(r.id), created_at: num(r.created_at) });
      const readId = (l) => (l.was ? l.was.id : null);
      const others = fresh.filter((l) => held.has(l.key) && held.get(l.key).id && held.get(l.key).id !== readId(l));
      const exported = await sentByExport((c, p) => tx.read(c, p), others.map((l) => ({ key: l.key, id: held.get(l.key).id })));
      const toSet = [];
      for (const l of fresh) {
        const h = held.get(l.key);
        if (h && h.id === readId(l)) toSet.push(l);
        else if (h && h.id && exported.has(`${l.key} ${h.id}`) && newer(l.now, h)) {
          toSet.push(l);
          replaced.set(l.key, { id: h.id, created_at: h.created_at });
        } else raced.add(l.key);
      }
      if (toSet.length) await tx.run(SET_LETTER, { rows: toSet.map((l) => ({ key: l.key, id: l.now.id, createdAt: l.now.created_at, sentTo: l.sentTo })) });
      if (resent.length) {
        const { rows } = await tx.run(ADD_SENT_TO, { rows: resent.map((l) => ({ key: l.key, id: l.now.id, add: l.add })) });
        const added = new Set(rows.map((r) => r.key));
        for (const l of resent) if (!added.has(l.key)) raced.add(l.key);
      }
    }
    const changes = letters.map((l) => ({
      change: 'letter-sent', node: l.key, address: l.address, kind: l.kind, was: replaced.get(l.key) || l.was, now: l.now, relays: l.relays,
      ...(raced.has(l.key) ? { raced: true } : {}),
    }));
    return recordChange(tx, { at: new Date().toISOString(), caller, operation: OPERATION, changes });
  });
}

module.exports = { OPERATION, record, sentByExport };
