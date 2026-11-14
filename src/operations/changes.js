'use strict';
/**
 * The change entries: one for each graph write that changed the graph, kept with the change in its transaction
 * (story graph-operations-foundation #4, ADR graph-operations-foundation/0004 Decision 5).
 *
 * An entry is a node, (:GraphChange:TapestryNode), so the core rules hold for it as for any node: a tapestryKey (its
 * id) under the shared label. It holds
 *   at          when, new Date().toISOString(): UTC, milliseconds, fixed width, so text order is time order
 *   byRole      'owner' | 'admin' | 'local', as the caller was found at the time of the write
 *   byPubkey    the caller's hex pubkey; absent for 'local'
 *   operation   '<group> <name>'
 *   keys        the distinct tapestryKeys its changes name (node, from, to), for history's filter by node
 *   changes     the changes, as JSON text: Neo4j holds no nested maps
 * and no tapestryValue, no uuid and no edge: an entry links to nothing, so it never shows among a node's neighbors.
 * No graph write may name one (catalog/graph/_nodes.js leaves them out).
 *
 * Answered, an entry is { id, at, by: { role, pubkey }, operation, changes }: the same shape from the write that
 * recorded it and from graph history.
 */

const { refusal } = require('./refusal');
const { keyNode } = require('../lib/tapestry-key-cypher');

const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const KEY = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

/** One change in an entry: what it did, and the tapestryKeys it touches in node, from or to. */
const CHANGE = Object.freeze({
  type: 'object',
  required: ['change'],
  properties: {
    change: { type: 'string', description: "What it did, such as 'relationship-added'" },
    type: { type: 'string', description: "A relationship's type" },
    from: { type: 'string', description: 'The tapestryKey of the node a relationship runs from' },
    to: { type: 'string', description: 'The tapestryKey of the node it runs to' },
    node: { type: 'string', description: 'The tapestryKey of a node the change is about' },
    count: { type: 'integer', minimum: 1, description: 'How many, when the change removed more than one thing alike' },
  },
});

/** A change entry as it is answered: by the write that recorded it (as `change`) and by graph history. */
const ENTRY = Object.freeze({
  type: 'object',
  required: ['id', 'at', 'by', 'operation', 'changes'],
  properties: {
    id: { type: 'string', description: "The entry's id: its tapestryKey" },
    at: { type: 'string', description: 'When the change was made: ISO 8601, UTC, with milliseconds' },
    by: {
      type: 'object',
      required: ['role', 'pubkey'],
      description: 'Who made it: the owner or an admin, by pubkey, or the command inside the instance (local, with no pubkey)',
      properties: {
        role: { type: 'string', enum: ['owner', 'admin', 'local'] },
        pubkey: { type: 'string', nullable: true },
      },
    },
    operation: { type: 'string', description: "The operation that made it, as '<group> <name>'" },
    changes: { type: 'array', items: CHANGE, description: 'What changed' },
  },
});

/** The `change` every write through the path answers: its entry, or null when it changed nothing (ADR Decision 2). */
const CHANGE_ENTRY = Object.freeze({ ...ENTRY, nullable: true, description: 'The change entry this write recorded, or null when it changed nothing (a repeat)' });

/** The distinct tapestryKeys a list of changes names. */
function keysOf(changes) {
  const keys = [];
  for (const c of changes) {
    for (const f of ['node', 'from', 'to']) if (typeof c[f] === 'string' && !keys.includes(c[f])) keys.push(c[f]);
  }
  return keys;
}

/** Who made a change, as an entry holds it, from the context's caller. */
function byOf(caller) {
  const role = caller && ['owner', 'admin', 'local'].includes(caller.role) ? caller.role : 'local';
  return { role, pubkey: role === 'local' ? null : (caller.pubkey || null) };
}

/**
 * Write the entry for `changes` in transaction `tx`; resolves it as answered.
 * @param {{ run: Function }} tx
 * @param {{ at: string, caller: object, operation: string, changes: object[] }} what
 */
async function recordChange(tx, { at, caller, operation, changes }) {
  const by = byOf(caller);
  const { rows } = await tx.run(
    // keyNode('c') gives the entry the shared label and its random key, as for every node a statement makes (ADR
    // graph-operations-foundation/0003 Decision 8).
    `CREATE (c:GraphChange {at: $at, byRole: $role, operation: $operation, keys: $keys, changes: $changes})
     ${keyNode('c')}
     SET c.byPubkey = $pubkey
     RETURN c.tapestryKey AS id`,
    { at, role: by.role, pubkey: by.pubkey, operation, keys: keysOf(changes), changes: JSON.stringify(changes) },
  );
  if (!rows.length || typeof rows[0].id !== 'string') throw new Error('the change entry was written, but its id did not come back');
  return { id: rows[0].id, at, by, operation, changes };
}

/** An entry as answered, from a row of history's read. */
function entryOf(row) {
  let changes = [];
  try { changes = JSON.parse(row.changes); } catch { changes = []; }
  return {
    id: row.id,
    at: row.at,
    by: { role: row.byRole, pubkey: row.byRole === 'local' ? null : (row.byPubkey || null) },
    operation: row.operation,
    changes: Array.isArray(changes) ? changes : [],
  };
}

/** A page's cursor: the base64url of [at, id] of the last entry on it. */
function encodeCursor(entry) {
  return Buffer.from(JSON.stringify([entry.at, entry.id])).toString('base64url');
}
/** [at, id] from a cursor, or the refusal invalid-cursor. */
function decodeCursor(cursor) {
  const bad = () => refusal('invalid-cursor', 'That cursor is not one graph history gave. Leave it out to start from the newest entry, or pass the one the last page answered.', { input: 'cursor' });
  let pair;
  try { pair = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8')); } catch { throw bad(); }
  if (!Array.isArray(pair) || pair.length !== 2 || !ISO_MS.test(String(pair[0])) || !KEY.test(String(pair[1]))) throw bad();
  return pair;
}

/**
 * A page of history, newest first: by `at`, then the later tapestryKey first.
 * @param {Function} read  graph.read
 * @param {{ node?: string, by?: string, since?: string, limit: number, cursor?: string }} filters
 * @returns {Promise<{ entries: object[], cursor: string|null }>}
 */
async function readHistory(read, { node = null, by = null, since = null, limit = 50, cursor = null } = {}) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`graph history's limit must be a whole number from 1; got ${JSON.stringify(limit)}`);
  const [cursorAt, cursorKey] = cursor ? decodeCursor(cursor) : [null, null];
  const params = {
    node: node || null,
    byPubkey: by && by !== 'local' ? by : null,
    local: by === 'local',
    // `…:00Z` sorts after `…:00.000Z` as text, so a time is compared in the form `at` is stored in.
    since: since ? new Date(since).toISOString() : null,
    cursorAt,
    cursorKey,
  };
  // The limit is a checked whole number, so it goes into the text: the driver would send a parameter as a float.
  const rows = await read(
    `MATCH (c:GraphChange)
     WHERE c.at IS NOT NULL
       AND ($node IS NULL OR $node IN c.keys)
       AND ($byPubkey IS NULL OR c.byPubkey = $byPubkey)
       AND ($local = false OR c.byRole = 'local')
       AND ($since IS NULL OR c.at >= $since)
       AND ($cursorAt IS NULL OR c.at < $cursorAt OR (c.at = $cursorAt AND c.tapestryKey < $cursorKey))
     RETURN c.tapestryKey AS id, c.at AS at, c.byRole AS byRole, c.byPubkey AS byPubkey, c.operation AS operation, c.changes AS changes
     ORDER BY c.at DESC, c.tapestryKey DESC
     LIMIT ${limit + 1}`,
    params,
  );
  const entries = rows.slice(0, limit).map(entryOf);
  return { entries, cursor: rows.length > limit && entries.length ? encodeCursor(entries[entries.length - 1]) : null };
}

module.exports = { CHANGE, ENTRY, CHANGE_ENTRY, keysOf, byOf, recordChange, entryOf, encodeCursor, decodeCursor, readHistory, ISO_MS, KEY };
