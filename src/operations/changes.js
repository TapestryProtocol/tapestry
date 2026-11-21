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

/**
 * One change in an entry: what it did, and the tapestryKeys it touches in node, from, to, concept or nodes. A field
 * mapping's changes add concept, field, property and nodes (story graph-operations-foundation #5, ADR
 * graph-operations-foundation/0005 Decision 12). A concept's add name, slug, field, was and now (story
 * graph-operations-first-slice #16, ADR graph-operations-first-slice/0016 Decision 10). An element's add field, was and
 * now, whose values are the field's JSON, and a rename's was and now (story graph-operations-first-slice #21, ADR
 * graph-operations-first-slice/0021 Decision 18). A deleted node's add nodes, the other ends of its relationships, and
 * was, the node as it was (story graph-operations-first-slice #26, ADR graph-operations-first-slice/0026 Decision 12).
 * A property's add path, the keys from its concept's section down to it, and catchUp, for a change made while the write
 * brought the concept's property nodes in line with its schema first; its was and now are { schema, required }, a
 * removed property's was the node as it was, and a schema's the two documents (story graph-operations-first-slice #18,
 * ADR graph-operations-first-slice/0018 Decision 12).
 * A membership's add type, from and to, the link, and concept; its section's field (the concept's key), was and now,
 * the section whole, and property, tapestryOwnSections, for one kept beside another author's letter; a tag's field,
 * its type, and was or now, its value; and wordTypes' was and now (story graph-operations-first-slice #22, ADR
 * graph-operations-first-slice/0022 Decision 14).
 * A move's are a membership's and a tag's: membership-removed for the link out of from, with count when more than one
 * copy went, and membership-added for the link into to, unless it was there, each naming the move's concept; and
 * tag-removed and tag-added for its n tags (story graph-operations-first-slice #23, ADR
 * graph-operations-first-slice/0023 Decision 13).
 * A repair's are relationship-removed, one for each link it took off, adding node (the property), concept, the rule it
 * repaired, and firmwareOverride: true when it changed a firmware concept with the override (story
 * graph-operations-first-slice #45, ADR graph-operations-first-slice/0045 Decision 9).
 * An export's are letter-sent, one for each letter a relay accepted, or whose read-back didn't answer (unread, recorded
 * on no node), adding address and kind, the letter's; was and now, its { id, created_at } before and after (was null
 * for a node's first letter, and the same as now for a letter re-sent unchanged); relays, each relay's answer; and
 * raced: true when the node held a newer letter another export sent, or a letter no export sent, so it was left as it
 * was (story graph-operations-first-slice #34, ADR graph-operations-first-slice/0034 Decision 8, Amendment 2 item 1).
 */
const CHANGE = Object.freeze({
  type: 'object',
  required: ['change'],
  properties: {
    change: { type: 'string', description: "What it did, such as 'relationship-added', 'node-renamed', 'field-changed', 'node-deleted' or 'letter-sent'" },
    type: { type: 'string', description: "A relationship's type" },
    from: { type: 'string', description: 'The tapestryKey of the node a relationship runs from, of the superset or set an element was made in, or of the parent a set was made under' },
    to: { type: 'string', description: 'The tapestryKey of the node it runs to' },
    node: { type: 'string', description: 'The tapestryKey of a node the change is about' },
    count: { type: 'integer', minimum: 1, description: 'How many, when the change removed more than one thing alike, or touched the nodes it names' },
    concept: { type: 'string', description: "The tapestryKey of the concept header the change is about" },
    field: { type: 'string', description: "The field the change is about: the field a mark is for, a concept's name, plural, slug or description, an element's field, or a property's key" },
    path: { type: 'array', items: { type: 'string' }, description: "For a property, the keys from its concept's section down to it, such as ['address', 'city']" },
    catchUp: { type: 'boolean', description: "For a property, true when the change was made while the write brought the concept's property nodes in line with its schema, before its own change; absent otherwise" },
    rule: { type: 'string', description: 'For a repair, the rule whose violation the change fixed, such as property-has-one-parent' },
    firmwareOverride: { type: 'boolean', description: 'For a repair, true when it changed a firmware concept with firmwareOverride; absent otherwise' },
    property: { type: 'string', description: 'The node property a mark carries, <concept key>_<field>, such as dog_breed' },
    nodes: { type: 'array', items: { type: 'string' }, description: "The tapestryKeys of the nodes the change touched: those whose copy it set or removed, a concept's nodes it made or renamed, or, for a deleted node, the nodes at the other end of its relationships and its tags'" },
    address: { type: 'string', description: "For a letter sent, the letter's address, kind:pubkey:d-tag, which is its node's" },
    kind: { type: 'integer', description: "For a letter sent, the letter's kind" },
    relays: {
      type: 'array',
      description: "For a letter sent, what each relay did with it: own (this instance's own relay) first, then each relay named, by URL",
      items: {
        type: 'object',
        required: ['relay', 'status'],
        properties: {
          relay: { type: 'string', description: 'own, or the relay\'s URL' },
          status: { type: 'string', description: 'accepted, refused, timeout, unreachable, held, not-sent or unread' },
          reason: { type: 'string', nullable: true, description: "The relay's words, or why it wasn't sent" },
        },
      },
    },
    raced: { type: 'boolean', description: "For a letter sent, true when the node held a newer letter another export sent, or a letter no export sent, so the node was left as it was; absent otherwise" },
    name: { type: 'string', description: "A concept's singular name, an element's name, or a set's, when the change made it" },
    slug: { type: 'string', description: "A concept's slug, an element's, or a set's, when the change made it" },
    was: { description: "What the field held before the change: a concept's name, plural, slug or description, or an element's name, as text, or an element's field, any JSON value; null when it held none. For a deleted node, the node as it was: { labels, properties, concepts, relationships, tags }, each tag with its own labels, properties and relationships, and stored, the JSON the store held for an lmdb: value. For a changed property, { schema, required }: its piece of the concept's schema (null for a node made before the property operations) and whether its parent requires it; for a removed property, the node as it was: { labels, properties, relationships, tags }, each relationship with its type, direction, from and to; for a schema, the document its JSON schema node held. For a letter sent, the { id, created_at } of the letter it replaced, null for the node's first, or the same as now for one re-sent unchanged" },
    now: { description: "What it holds after the change: as was, for a concept, an element, a property ({ schema, required }) or a schema; null when the change took it out. For a letter sent, its { id, created_at }" },
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

/** The distinct tapestryKeys a list of changes names: in node, from, to and concept, and every one in nodes. */
function keysOf(changes) {
  const seen = new Set();
  const keys = [];
  const add = (k) => { if (typeof k === 'string' && !seen.has(k)) { seen.add(k); keys.push(k); } };
  for (const c of changes) {
    for (const f of ['node', 'from', 'to', 'concept']) add(c[f]);
    if (Array.isArray(c.nodes)) for (const k of c.nodes) add(k);
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
