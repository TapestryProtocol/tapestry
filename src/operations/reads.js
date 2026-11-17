'use strict';
/**
 * The read conventions (story graph-operations-first-slice #11, ADR graph-operations-first-slice/0011 Decision 1):
 * what every read shares, defined once, so the reads after graph list-elements (A10.7–A10.14) page, filter and answer a
 * node the same way. C5 and C6 (story #13, ADR graph-operations-first-slice/0013 Decision 1) do the same for a
 * relationship, so graph list-relationships and the relationship reads after it (graph walk, graph describe-node) answer
 * and judge one the same way. C4, where reads sit, is ADR 0011's and has no code here.
 *
 *   C1 paging          LIMIT_INPUT, CURSOR_INPUT, INVALID_CURSOR, scopeOf, encodeCursor, decodeCursor, pageOf
 *   C2 point of view   POV_INPUT, UNKNOWN_POV, POV, resolvePov, trust, trustParams, ownKeys
 *   C3 a node          NODE, nodeColumns, nodeOf
 *   C5 a relationship  RELATIONSHIP, relationshipColumns, relationshipOf
 *   C6 judging one     trust(v, keep)
 *
 * C1. A read that answers a list takes `limit` (1 to 200, 50 by default) and `cursor`, and answers its items with
 * `cursor`, null on the last page. Items come in an order that never changes for an item, which each read's ADR names:
 * tapestryKey ascending for a list of nodes, unless the read is about time (history, newest first); for a list of
 * relationships, out before in, then by type, the other node's tapestryKey and elementId (ADR 0013). A walk and a
 * search are the two exceptions. A walk answers nearest first, by steps from a start node and then tapestryKey, so a
 * change between pages that alters a node's steps can move it (ADR 0014; ADR 0011, Amendment 4). A search answers best
 * first: a match holding every word, then the higher score, then tapestryKey, so a change between pages that alters a
 * score can move a match (ADR graph-operations-first-slice/0008; ADR 0011, Amendment 5). The query fetches limit + 1
 * rows, the checked whole number written into its text (the driver sends a JavaScript number as a float); a walk reads
 * its whole walk instead, and a search its bound, and each pages what it read. A cursor is the base64url of JSON
 * [read, scope, position]: the read's '<group> <name>', a fingerprint
 * of the inputs that choose the list, and the last item's sort key. One that doesn't parse, or names another read,
 * another list or a position that isn't one, is refused invalid-cursor.
 *
 * C2. A read that can include other authors' nodes takes `pov`: owner (the default; the owner's own pubkey means the
 * same) or everyone; any other is refused unknown-pov for now. A node counts when the point of view is everyone, when
 * it has no author, when its author is the instance's own (its assistant or its owner), or when the owner's web of
 * trust scores its author above VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF (GrapeRank's NostrUser.influence, as the verified-
 * follower list reads it). The test is a fragment of the read's own Cypher, run at read time: nothing about a point of
 * view is stored (CLAUDE.md, principles 1–3).
 *
 * C3. A node is answered as { tapestryKey, name, address, author, own }. A read may add facts of its own beside them,
 * never rename or drop one.
 *
 * C5. A relationship is answered as { type, direction, from, to, node, properties }. Its direction is out when it runs
 * from the node the read is about and in when it runs to it; from and to are the tapestryKeys of the nodes it runs from
 * and to (with type, what graph remove-relationship takes); node is the node at its other end, answered as C3; and
 * properties is what it records about itself, keys sorted, {} for most. A relationship from a node to itself has from
 * and to alike: a read that lists both directions answers it once, as out. Its elementId comes back as rid, for a
 * read's cursor, and is never answered (design D6). A read may add facts beside these six, never rename or drop one.
 *
 * C6. No relationship records its author, so a relationship counts when the node at its other end counts by C2's test,
 * and the node the read is about is never left out, since the caller named it. trust(v, keep) carries the variables
 * named in keep through its WITH, so a relationship read judges m and keeps r: trust('m', ['r']). When relationships
 * come to record who made them, this widens here, and callers stay as they are.
 *
 * It opens nothing at load (ADR graph-operations-foundation/0001 Decision 10): the config, the assistant's key and the
 * hash are required when first called.
 */

const { refusal } = require('./refusal');

const HEX64 = /^[0-9a-f]{64}$/;
const VARIABLE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const DEFAULT_CUTOFF = 0.05;

// ── C1 paging ──

const LIMIT_INPUT = {
  schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
  description: 'How many items a page holds, 1 to 200 (50 by default)',
};
const CURSOR_INPUT = {
  schema: { type: 'string', minLength: 1 },
  description: 'The cursor the last page answered, for the next page; leave it out to start from the first',
};
const INVALID_CURSOR = Object.freeze({ code: 'invalid-cursor', status: 400, when: 'A cursor this read did not give for the same list: from another read, another list or another point of view, or text that does not parse' });

/** The fingerprint of the inputs that choose a list, in the order the read gives them: 16 hex characters. */
function scopeOf(parts) {
  const { createHash } = require('crypto');
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 16);
}

/** A cursor: the base64url of JSON [read, scope, position]. */
function encodeCursor(read, scope, position) {
  return Buffer.from(JSON.stringify([read, scope, position])).toString('base64url');
}

/** The position a cursor holds, or the refusal invalid-cursor when it isn't one `read` gave for this `scope`. */
function decodeCursor(read, scope, cursor, isPosition) {
  const bad = () => refusal(INVALID_CURSOR.code, `That cursor is not one ${read} gave for this list. A cursor works only with the inputs that made it, so pass it with the same ones. Leave it out to start from the first page, or pass the cursor the last page answered.`, { input: 'cursor' });
  let parsed;
  try { parsed = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8')); } catch { throw bad(); }
  if (!Array.isArray(parsed) || parsed.length !== 3 || parsed[0] !== read || parsed[1] !== scope) throw bad();
  const position = parsed[2];
  if (typeof isPosition === 'function' ? !isPosition(position) : position === undefined || position === null) throw bad();
  return position;
}

/** A page: the first `limit` rows, and cursorOf(the last of them) when more came back, else null. */
function pageOf(rows, limit, cursorOf) {
  const list = Array.isArray(rows) ? rows : [];
  const items = list.slice(0, limit);
  return { items, cursor: list.length > limit && items.length ? cursorOf(items[items.length - 1]) : null };
}

// ── C2 the point of view ──

const POV_INPUT = {
  schema: { type: 'string', pattern: '^(owner|everyone|[0-9a-f]{64})$', default: 'owner' },
  description: "Whose point of view decides which nodes count: owner (the default; the owner's own pubkey means the same) or everyone (every author's claims). Other points of view are to come.",
};
const UNKNOWN_POV = Object.freeze({ code: 'unknown-pov', status: 400, when: "A pov this instance can't read from: it reads from its owner's point of view or from everyone's" });

/** The point of view, as an answer gives it. */
const POV = {
  type: 'object',
  required: ['name', 'observer', 'cutoff', 'scored'],
  description: 'The point of view the read used, and what decided it',
  properties: {
    name: { type: 'string', description: 'owner or everyone' },
    observer: { type: 'string', nullable: true, description: "Whose web of trust decided: the owner's pubkey; null for everyone" },
    cutoff: { type: 'number', nullable: true, description: "The GrapeRank influence an author's score must be above to count (VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF); null for everyone" },
    scored: { type: 'boolean', nullable: true, description: "Whether the owner's scores exist yet: when false, only the instance's own nodes count; null for everyone" },
  },
};

let cutoffRead;
/** VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF, read once, as the verified-follower list reads it; 0.05 unless a finite number. */
function cutoff() {
  if (cutoffRead === undefined) {
    const { getConfigFromFile } = require('../utils/config');
    const n = Number(getConfigFromFile('VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF', String(DEFAULT_CUTOFF)));
    cutoffRead = Number.isFinite(n) ? n : DEFAULT_CUTOFF;
  }
  return cutoffRead;
}

/** A pubkey as events carry it: trimmed, lowercase, 64 hex characters; null for anything else. */
function hexKey(k) {
  const lower = typeof k === 'string' ? k.trim().toLowerCase() : '';
  return HEX64.test(lower) ? lower : null;
}

/** The owner's hex pubkey, or null when the instance has none configured. */
function ownerKey() {
  const { getOwnerPubkey } = require('../utils/config');
  return hexKey(getOwnerPubkey());
}

/** The instance's own pubkeys: its assistant's and its owner's, each as events carry it (a key that isn't one is left out). */
function ownKeys() {
  const { getOwnerAssistantPubkey } = require('../utils/assistantKeys');
  return [...new Set([hexKey(getOwnerAssistantPubkey()), ownerKey()].filter((k) => k !== null))];
}

/**
 * The point of view `value` names → { name, observer, own, cutoff, scored }, or the refusal unknown-pov. Only the
 * owner's reads the graph, for `scored`: whether any NostrUser has an influence yet.
 */
async function resolvePov(read, value) {
  const v = value === undefined || value === null ? 'owner' : String(value);
  const owner = ownerKey();
  if (v === 'everyone') return { name: 'everyone', observer: null, own: ownKeys(), cutoff: null, scored: null };
  if (v === 'owner' || (owner !== null && v === owner)) {
    const rows = await read('MATCH (u:NostrUser) WHERE u.influence IS NOT NULL RETURN u.pubkey AS pubkey LIMIT 1', {});
    return { name: 'owner', observer: owner, own: ownKeys(), cutoff: cutoff(), scored: Array.isArray(rows) && rows.length > 0 };
  }
  throw refusal(UNKNOWN_POV.code, `This instance can't read from the point of view of ${v}. It reads from its owner's point of view (pov=owner, the default) or from everyone's (pov=everyone); other points of view are to come.`, { input: 'pov' });
}

/**
 * The trust test for node variable `v`, as a fragment of a read's Cypher; its parameters are trustParams(pov). Its WITH
 * carries `v`, `counts` and the variables named in `keep`, such as the relationship a read judges by `v` (C6).
 */
function trust(v, keep = []) {
  if (!VARIABLE.test(String(v))) throw new Error(`trust: ${JSON.stringify(v)} is not a Cypher variable name`);
  if (!Array.isArray(keep)) throw new Error(`trust: keep is a list of Cypher variable names; got ${JSON.stringify(keep)}`);
  for (const k of keep) if (!VARIABLE.test(String(k))) throw new Error(`trust: ${JSON.stringify(k)} is not a Cypher variable name`);
  const u = `u_${v}`;
  const carried = [...new Set([...keep.map(String), String(v)])].join(', ');
  return `OPTIONAL MATCH (${u}:NostrUser {pubkey: ${v}.pubkey})
     WITH ${carried}, coalesce($everyone OR ${v}.pubkey IS NULL OR ${v}.pubkey IN $own OR ${u}.influence > $cutoff, false) AS counts`;
}

/** The parameters trust(v) reads, for a resolved point of view. */
function trustParams(pov) {
  return { everyone: pov.name === 'everyone', own: Array.isArray(pov.own) ? pov.own : [], cutoff: pov.cutoff === undefined ? null : pov.cutoff };
}

// ── C3 a node, answered ──

const NODE = {
  type: 'object',
  required: ['tapestryKey', 'name', 'address', 'author', 'own'],
  properties: {
    tapestryKey: { type: 'string', description: "The node's tapestryKey: its id" },
    name: { type: 'string', nullable: true, description: 'Its name: its tapestryValue, else its name property; null when it has neither' },
    address: { type: 'string', nullable: true, description: 'Its nostr address (kind:pubkey:d-tag), or its event id, as the graph records it; null when it has none' },
    author: { type: 'string', nullable: true, description: "Its author's hex pubkey: the event's author, or the instance's assistant for a node made here; null when it records none" },
    own: { type: 'boolean', description: "Whether it is the instance's own: by its assistant or its owner, or made here with no author" },
  },
};

/** The RETURN items that give node variable `v`'s facts. */
function nodeColumns(v) {
  if (!VARIABLE.test(String(v))) throw new Error(`nodeColumns: ${JSON.stringify(v)} is not a Cypher variable name`);
  return `${v}.tapestryKey AS tapestryKey, coalesce(${v}.tapestryValue, ${v}.name) AS name, ${v}.uuid AS address, ${v}.pubkey AS author`;
}

/** A node, answered, from a row of nodeColumns(v) and the instance's own keys. */
function nodeOf(row, own) {
  const text = (x) => (typeof x === 'string' && x.length > 0 ? x : null);
  const author = text(row && row.author);
  return {
    tapestryKey: row.tapestryKey,
    name: text(row && row.name),
    address: text(row && row.address),
    author,
    own: author === null || (Array.isArray(own) && own.includes(author)),
  };
}

// ── C5 a relationship, answered ──

const RELATIONSHIP = {
  type: 'object',
  required: ['type', 'direction', 'from', 'to', 'node', 'properties'],
  properties: {
    type: { type: 'string', description: 'Its type' },
    direction: { type: 'string', enum: ['out', 'in'], description: 'out when it runs from the node the read is about, in when it runs to it' },
    from: { type: 'string', description: 'The tapestryKey of the node it runs from' },
    to: { type: 'string', description: 'The tapestryKey of the node it runs to' },
    node: NODE,
    properties: { type: 'object', description: 'What it records about itself, keys sorted; {} for most' },
  },
};

/**
 * The RETURN items that give relationship variable `r`'s facts and those of node variable `m`, the node at its other
 * end. What `r` records comes as [key, value] pairs, so the driver converts each value as an item of a list: an
 * integer inside a map would stay a driver Integer (ADR 0013, Context 7).
 */
function relationshipColumns(r, m) {
  if (!VARIABLE.test(String(r))) throw new Error(`relationshipColumns: ${JSON.stringify(r)} is not a Cypher variable name`);
  return `type(${r}) AS type, elementId(${r}) AS rid, [k IN keys(${r}) | [k, ${r}[k]]] AS properties, ${nodeColumns(m)}`;
}

/**
 * A relationship, answered, from a row of relationshipColumns(r, m): `key` is the tapestryKey of the node the read is
 * about, `direction` is 'out' or 'in' from it, and `own` is the instance's own keys.
 */
function relationshipOf(row, { key, direction, own }) {
  if (direction !== 'out' && direction !== 'in') throw new Error(`relationshipOf: direction is out or in; got ${JSON.stringify(direction)}`);
  const pairs = Array.isArray(row && row.properties)
    ? row.properties.filter((p) => Array.isArray(p) && p.length === 2 && typeof p[0] === 'string')
    : [];
  pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const other = row.tapestryKey;
  return {
    type: row.type,
    direction,
    from: direction === 'out' ? key : other,
    to: direction === 'out' ? other : key,
    node: nodeOf(row, own),
    properties: Object.fromEntries(pairs),
  };
}

module.exports = {
  LIMIT_INPUT, CURSOR_INPUT, POV_INPUT,
  INVALID_CURSOR, UNKNOWN_POV,
  NODE, POV, RELATIONSHIP,
  scopeOf, encodeCursor, decodeCursor, pageOf,
  resolvePov, trust, trustParams, ownKeys,
  nodeColumns, nodeOf,
  relationshipColumns, relationshipOf,
};
