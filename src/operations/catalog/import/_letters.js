'use strict';
/**
 * import nostr's letters (story graph-operations-first-slice #32; ADR graph-operations-first-slice/0032 Decisions 3, 4,
 * 7, 8 and 9): what a ref names, whether an event is one, where an event is keyed, the claims it makes, and the
 * recorder, which writes one event, its tags and its claims in a transaction of its own.
 *
 *   parseRef(text, as)       as 'id': 64 lowercase hex, a note or an nevent → { ref, id }; as 'address': kind:pubkey:d-tag
 *                            or an naddr → { ref, address, kind, pubkey, d }; null when it can't be read (Decision 1)
 *   addressParts(text)       an address read → { address, kind, pubkey, d }, or null
 *   checkEvent(e)            null for an event whose shape, id and signature hold; else why it isn't one (Decision 3)
 *   keyOf(e)                 NIP-01's key (Decision 4) → { uuid, address }: a replaceable kind at kind:pubkey:, an
 *                            addressable one at kind:pubkey:d, any other at its id (address null)
 *   newer(a, b)              whether version a stands over b: the later created_at, on a tie the lower id
 *   claimsOf(e, { slugs })   the claims e makes, read from it alone (Decision 8's table), each gate that needs only the
 *                            event applied: an n, s or structure claim's ends carry its author's key, and a structure
 *                            claim's type is one structureTypes() holds
 *   structureTypes()         firmware's relationship types outside its nostr category, and IMPORT, SUPERCEDES and
 *                            PROVIDED_THE_TEMPLATE_FOR
 *   record(tx, e, ctx)       one verified event, in transaction tx (Decision 7) → { outcome, node, entry }
 *   isUnreachable(err), words(err), UNIQUE
 *
 * Only a type from structureTypes() or the constants below, and a label from LABELS, reach a statement's text; every
 * value is a parameter. Every node a statement makes gets keyNode's label and key. It opens nothing when it loads
 * (ADR graph-operations-foundation/0001 Decision 10), and it never signs, publishes or reads a key.
 */

const { keyNode } = require('../../../lib/tapestry-key-cypher');
const { classifyBValue } = require('../../../lib/bValueForms');
const { recordChange } = require('../../changes');

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const ADDRESS = /^(0|[1-9][0-9]{0,4}):([0-9a-f]{64}):([\s\S]*)$/;
const TYPE = /^[A-Z][A-Z0-9_]{0,63}$/;
const OPERATION = 'import nostr';
/** Neo4j's code for a uniqueness rule's failure (Decision 7.9). */
const UNIQUE = 'Neo.ClientError.Schema.ConstraintValidationFailed';
/** The editorial types tapestry-concepts.md names, which a structure claim may make beside firmware's (Decision 8). */
const EDITORIAL = Object.freeze(['IMPORT', 'SUPERCEDES', 'PROVIDED_THE_TEMPLATE_FOR']);
const REFERENCES = 'REFERENCES';
const INHERITS_FROM = 'INHERITS_FROM';
const B_TAG = " {source: 'b-tag'}";
/** The labels a statement may write (Decisions 7.5 and 9). */
const LABELS = Object.freeze(['NostrEvent', 'ListHeader', 'ListItem', 'Reaction', 'Superset', 'Set', 'Property', 'JSONSchema']);
const ROLE_LABELS = Object.freeze({ superset: 'Superset', set: 'Set', property: 'Property', primaryProperty: 'Property', jsonSchema: 'JSONSchema' });

const isText = (x) => typeof x === 'string' && x.length > 0;
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/** What a thrown thing says: nostr-tools throws bare strings. */
function words(err) {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || String(err);
  if (err === null || err === undefined) return 'unknown error';
  try { return JSON.stringify(err); } catch { return String(err); }
}

/** Whether the graph database couldn't be reached, which stops a call (Decision 7.9). */
function isUnreachable(err) {
  const code = err && err.code;
  return code === 'ServiceUnavailable' || code === 'SessionExpired' || code === 'Neo.TransientError.General.DatabaseUnavailable';
}

// ── refs (Decision 1) ──

function addressParts(text) {
  const m = typeof text === 'string' ? text.match(ADDRESS) : null;
  if (!m) return null;
  const kind = Number(m[1]);
  if (kind > 65535) return null;
  return { address: `${kind}:${m[2]}:${m[3]}`, kind, pubkey: m[2], d: m[3] };
}

function decode(text) {
  try { return require('nostr-tools').nip19.decode(text); } catch { return null; }
}

function parseRef(text, as) {
  if (typeof text !== 'string') return null;
  if (as === 'id') {
    if (HEX64.test(text)) return { ref: text, id: text };
    if (/^(note|nevent)1/.test(text)) {
      const d = decode(text);
      if (d && d.type === 'note' && typeof d.data === 'string' && HEX64.test(d.data)) return { ref: text, id: d.data };
      if (d && d.type === 'nevent' && d.data && typeof d.data.id === 'string' && HEX64.test(d.data.id)) return { ref: text, id: d.data.id };
    }
    return null;
  }
  const a = addressParts(text);
  if (a) return { ref: text, ...a };
  if (/^naddr1/.test(text)) {
    const d = decode(text);
    const x = d && d.type === 'naddr' ? d.data : null;
    if (x && Number.isInteger(x.kind) && x.kind >= 0 && x.kind <= 65535 && typeof x.pubkey === 'string' && HEX64.test(x.pubkey) && typeof x.identifier === 'string') {
      return { ref: text, address: `${x.kind}:${x.pubkey}:${x.identifier}`, kind: x.kind, pubkey: x.pubkey, d: x.identifier };
    }
  }
  return null;
}

// ── an event (Decisions 3 and 4) ──

function checkEvent(e) {
  const not = (why) => `it isn't an event: ${why}`;
  if (!isObject(e)) return not('it is not a JSON object');
  if (typeof e.id !== 'string' || !HEX64.test(e.id)) return not('its id is not 64 lowercase hex characters');
  if (typeof e.pubkey !== 'string' || !HEX64.test(e.pubkey)) return not('its pubkey is not 64 lowercase hex characters');
  if (typeof e.sig !== 'string' || !HEX128.test(e.sig)) return not('its sig is not 128 lowercase hex characters');
  if (!Number.isInteger(e.kind) || e.kind < 0 || e.kind > 65535) return not('its kind is not a whole number from 0 to 65535');
  if (!Number.isSafeInteger(e.created_at)) return not('its created_at is not a whole number');
  if (!Array.isArray(e.tags) || !e.tags.every((t) => Array.isArray(t) && t.every((x) => typeof x === 'string'))) return not('its tags are not lists of strings');
  if (typeof e.content !== 'string') return not('its content is not a string');
  const NT = require('nostr-tools');
  let hash = null;
  try { hash = NT.getEventHash(e); } catch { hash = null; }
  if (hash !== e.id) return "its id doesn't verify: it isn't the hash of the event";
  let ok = false;
  try { ok = NT.verifyEvent(e) === true; } catch { ok = false; }
  return ok ? null : "its signature doesn't verify";
}

const isReplaceable = (k) => k === 0 || k === 3 || (k >= 10000 && k < 20000);
const isAddressable = (k) => k >= 30000 && k < 40000;

function keyOf(e) {
  if (isReplaceable(e.kind)) { const address = `${e.kind}:${e.pubkey}:`; return { uuid: address, address }; }
  if (isAddressable(e.kind)) {
    const t = e.tags.find((x) => x[0] === 'd');
    const address = `${e.kind}:${e.pubkey}:${t && typeof t[1] === 'string' ? t[1] : ''}`;
    return { uuid: address, address };
  }
  return { uuid: e.id, address: null };
}

function newer(a, b) {
  return a.created_at > b.created_at || (a.created_at === b.created_at && a.id < b.id);
}

/** The first tag of a type's first value, or null. */
const firstValue = (tags, type) => { const t = tags.find((x) => x[0] === type); return t && isText(t[1]) ? t[1] : null; };

/** The event's JSON: its json tag's value, parsed, when it is an object; else null. */
function jsonOf(e) {
  const raw = firstValue(e.tags, 'json');
  if (!raw) return null;
  try { const v = JSON.parse(raw); return isObject(v) ? v : null; } catch { return null; }
}

/** name and tapestryValue: the first name tag, else names, else title, as buildImportCypher reads them. */
const nameOf = (e) => firstValue(e.tags, 'name') || firstValue(e.tags, 'names') || firstValue(e.tags, 'title');

function kindLabel(k) {
  if (k === 9998 || k === 39998) return 'ListHeader';
  if (k === 9999 || k === 39999) return 'ListItem';
  if (k === 7) return 'Reaction';
  return null;
}

/** Every label the event's node carries: NostrEvent, its kind's, and the role labels its word types give (Decision 9). */
function labelsOf(e) {
  const out = ['NostrEvent'];
  const k = kindLabel(e.kind);
  if (k) out.push(k);
  const j = jsonOf(e);
  const types = j && isObject(j.word) && Array.isArray(j.word.wordTypes) ? j.word.wordTypes : [];
  for (const t of types) {
    const l = typeof t === 'string' && Object.prototype.hasOwnProperty.call(ROLE_LABELS, t) ? ROLE_LABELS[t] : null;
    if (l && !out.includes(l)) out.push(l);
  }
  return out;
}

// ── the claims (Decision 8) ──

let TYPES = null;
function structureTypes() {
  if (TYPES) return TYPES;
  const fs = require('fs');
  const path = require('path');
  const firmware = require('../../../api/normalize/firmware');
  const nostr = new Set();
  const others = new Set();
  const add = (rt) => {
    if (!rt || typeof rt.alias !== 'string' || !TYPE.test(rt.alias)) return;
    (rt.category === 'nostr' ? nostr : others).add(rt.alias);
  };
  const entry = (firmware.getManifest().concepts || []).find((c) => c && c.slug === 'relationship-type');
  if (entry) {
    const dir = path.join(firmware.firmwareDir(), entry.dir, 'elements');
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
        try { add(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).relationshipType); } catch { /* a broken file declares nothing */ }
      }
    }
  }
  for (const data of Object.values(firmware.allRelationshipTypes() || {})) add(data && data.relationshipType);
  TYPES = Object.freeze(new Set([...[...others].filter((t) => !nostr.has(t)), ...EDITORIAL]));
  return TYPES;
}

/**
 * The claims of event `e`, from its tags and its JSON alone: { kind, … } with kind one of
 *   reference  { tag, to }              an e or an a: the tag at index `tag` REFERENCES `to`
 *   b          { to, inherit }          the node INHERITS_FROM or REFERENCES {source: 'b-tag'} `to`
 *   z          { header }               HAS_ELEMENT from each superset the header IS_THE_CONCEPT_FOR
 *   n          { set }                  HAS_ELEMENT from the set
 *   s          { parent }               IS_A_SUPERSET_OF from the parent
 *   structure  { from, type, to }       a relationship letter's, or one its graph.relationships lists
 * where `to`, `header`, `set`, `parent`, `from` are { id } or addressParts(). `slugs` (a Map) resolves a graph's slugs its
 * own nodes don't list, through the graphs a call followed before (Decision 6).
 */
function claimsOf(e, { slugs = null } = {}) {
  const out = [];
  const mine = (a) => !!a && a.pubkey === e.pubkey;
  e.tags.forEach((t, i) => {
    const v = t[1];
    if (!isText(v)) return;
    if (t[0] === 'e') {
      if (HEX64.test(v)) out.push({ kind: 'reference', tag: i, to: { id: v } });
    } else if (t[0] === 'a') {
      const a = addressParts(v);
      if (a) out.push({ kind: 'reference', tag: i, to: a });
    } else if (t[0] === 'b') {
      // The two locatable forms only: the sentinel b-tag-deferred and a malformed value derive nothing (BIBLE §25).
      const form = classifyBValue(v);
      const to = form === 'a-tag' ? addressParts(v) : form === 'event-id' ? { id: v } : null;
      if (to) out.push({ kind: 'b', to, inherit: t[2] === 'inherit' });
    } else if (t[0] === 'z') {
      // Never for a concept whose d-tag is word, as firmware's step 1d skips it (BIBLE §7).
      const a = addressParts(v);
      if (a && a.d !== 'word') out.push({ kind: 'z', header: a });
    } else if (t[0] === 'n' || t[0] === 's') {
      // Only within the claimant's own graph (protocols/drafts/class-thread-relationships.md, rule 1).
      const a = addressParts(v);
      if (mine(a)) out.push(t[0] === 'n' ? { kind: 'n', set: a } : { kind: 's', parent: a });
    }
  });
  const allowed = structureTypes();
  const structure = (from, type, to) => {
    if (mine(from) && mine(to) && typeof type === 'string' && allowed.has(type)) out.push({ kind: 'structure', from, type, to });
  };
  const from = firstValue(e.tags, 'nodeFrom');
  const to = firstValue(e.tags, 'nodeTo');
  const type = firstValue(e.tags, 'relationshipType');
  if (from && to && type) structure(addressParts(from), type, addressParts(to));
  const g = jsonOf(e);
  const graph = g && isObject(g.graph) ? g.graph : null;
  if (graph && Array.isArray(graph.relationships)) {
    const own = new Map();
    for (const n of Array.isArray(graph.nodes) ? graph.nodes : []) if (isObject(n) && isText(n.slug) && isText(n.uuid)) own.set(n.slug, n.uuid);
    const uuidOf = (slug) => (isText(slug) ? own.get(slug) || (slugs && slugs.get(slug)) || null : null);
    const slug = (x) => (isObject(x) ? x.slug : null);
    for (const r of graph.relationships) {
      if (!isObject(r)) continue;
      structure(addressParts(uuidOf(slug(r.nodeFrom))), slug(r.relationshipType), addressParts(uuidOf(slug(r.nodeTo))));
    }
  }
  return out;
}

/** A claim's identity, for telling an older version's from a newer's. */
function claimKey(c) {
  const at = (x) => x.address || x.id;
  if (c.kind === 'b') return `b:${c.inherit}:${at(c.to)}`;
  if (c.kind === 'z') return `z:${c.header.address}`;
  if (c.kind === 'n') return `n:${c.set.address}`;
  if (c.kind === 's') return `s:${c.parent.address}`;
  return null;
}

// ── the statements (ADR 0032, Implementation notes) ──

/** 1. Find nodes: at an address or an id's uuid (an event-less node or a placeholder too), and with an event's id. */
const AT_UUID = `UNWIND $uuids AS u
  MATCH (n:NostrEvent|TapestryNode {uuid: u})
  WHERE NOT n:NostrEventTag AND NOT n:GraphChange
  RETURN u AS at, elementId(n) AS eid, n AS node`;
const WITH_ID = `UNWIND $ids AS i
  MATCH (n:NostrEvent {id: i})
  RETURN i AS at, elementId(n) AS eid, n AS node`;

/** 2. The node and its author. FIELDS is every field an event sets; labels are LABELS, spliced. */
const FIELDS = 'n.uuid = $uuid, n.id = $id, n.pubkey = $pubkey, n.created_at = toInteger($createdAt), n.kind = toInteger($kind), n.aTag = $aTag, n.name = $name, n.tapestryValue = $name';
const labelText = (labels) => {
  for (const l of labels) if (!LABELS.includes(l)) throw new Error(`import nostr writes no label ${JSON.stringify(l)}`);
  return labels.length ? `, n:${labels.join(':')}` : '';
};
const NODE_NEW = (labels, content) => `
  CREATE (n:NostrEvent {uuid: $uuid})
  SET ${FIELDS}${content ? ', n.content = $content' : ''}${labelText(labels)}
  ${keyNode('n')}
  WITH n
  MERGE (u:NostrUser {pubkey: $pubkey})
  ${keyNode('u')}
  MERGE (u)-[:AUTHORS]->(n)
  RETURN n.tapestryKey AS key, elementId(n) AS eid, false AS authored`;
const NODE_AT = (labels, content) => `MATCH (n) WHERE elementId(n) = $eid
  SET ${FIELDS}${content ? ', n.content = $content' : ''}${labelText(labels)}
  ${keyNode('n')}
  WITH n
  MERGE (u:NostrUser {pubkey: $pubkey})
  ${keyNode('u')}
  WITH n, u, EXISTS { (u)-[:AUTHORS]->(n) } AS authored
  MERGE (u)-[:AUTHORS]->(n)
  RETURN n.tapestryKey AS key, elementId(n) AS eid, authored`;

/** 3 and 4. The node's tags: read, deleted (those no other node has; a shared one loses only this node's link), made. */
const TAGS_OF = `MATCH (n) WHERE elementId(n) = $eid
  MATCH (n)-[:HAS_TAG]->(t:NostrEventTag)
  RETURN DISTINCT t.uuid AS uuid, elementId(t) AS eid, t.type AS type, t.value AS value, t.value1 AS value1, t.value2 AS value2, t.value3 AS value3, t.value4 AS value4`;
const TAGS_DROP = `MATCH (n) WHERE elementId(n) = $eid
  MATCH (n)-[h:HAS_TAG]->(t:NostrEventTag)
  WITH n, h, t, COUNT { MATCH (o)-[:HAS_TAG]->(t) WHERE o <> n } AS others
  DELETE h
  WITH DISTINCT t, others
  WHERE others = 0
  DETACH DELETE t`;
const TAGS_MAKE = `MATCH (n) WHERE elementId(n) = $eid
  UNWIND $tags AS g
  MERGE (t:NostrEventTag {uuid: g.uuid})
  SET t.type = g.type, t.value = g.value, t.value1 = g.value1, t.value2 = g.value2, t.value3 = g.value3, t.value4 = g.value4
  ${keyNode('t')}
  MERGE (n)-[:HAS_TAG]->(t)
  RETURN g.uuid AS uuid, elementId(t) AS eid`;

/**
 * 5. A placeholder unless held: by address, with its kind and pubkey; by id, its uuid the id (Decision 8). The address
 * one is a CREATE: the same transaction found no node at the address, of any label, so an event-less node there is never
 * passed by; one another import made meanwhile fails the uniqueness rule, and the event runs again (Decision 7.9).
 */
const HOLD_ADDRESS = `UNWIND $missing AS a
  CREATE (p:NostrEvent {uuid: a.uuid})
  SET p.kind = toInteger(a.kind), p.pubkey = a.pubkey
  ${keyNode('p')}
  RETURN a.uuid AS at, elementId(p) AS eid, p AS node`;
const HOLD_ID = `UNWIND $missing AS i
  MERGE (p:NostrEvent {id: i})
  ON CREATE SET p.uuid = i
  ${keyNode('p')}
  RETURN i AS at, elementId(p) AS eid, p AS node`;

/** 6 and 7. A claim's relationship made, or taken out; `type` is a checked name, `props` a constant. */
function typeText(type) {
  if (!TYPE.test(String(type))) throw new Error(`import nostr writes no relationship type ${JSON.stringify(type)}`);
  return type;
}
const LINK = (type, props) => `UNWIND $pairs AS p
  MATCH (a) WHERE elementId(a) = p.a
  MATCH (b) WHERE elementId(b) = p.b
  WITH a, b, EXISTS { (a)-[:${typeText(type)}${props}]->(b) } AS had
  MERGE (a)-[:${typeText(type)}${props}]->(b)
  RETURN a.tapestryKey AS from, b.tapestryKey AS to, had`;
const UNLINK = (type, props) => `UNWIND $pairs AS p
  MATCH (a) WHERE elementId(a) = p.a
  MATCH (b) WHERE elementId(b) = p.b
  MATCH (a)-[r:${typeText(type)}${props}]->(b)
  DELETE r
  RETURN a.tapestryKey AS from, b.tapestryKey AS to`;

/** 8. A placeholder keyed by the event's id, merged into the event's node: its incoming references moved, then it goes. */
const MOVE = (type) => `MATCH (p) WHERE elementId(p) = $p
  MATCH (n) WHERE elementId(n) = $n
  MATCH (x)-[r:${typeText(type)}]->(p)
  MERGE (x)-[m:${typeText(type)}]->(n)
  SET m += properties(r)
  DELETE r
  RETURN count(*) AS moved`;
// A plain DELETE: a placeholder holds only the references moved above, and anything else stops the commit.
const DROP = 'MATCH (p) WHERE elementId(p) = $p DELETE p';

/** 9. The supersets a concept's header IS_THE_CONCEPT_FOR, and the z wiring for one superset (Context 8). */
const SUPERSETS = (init) => `UNWIND $headers AS h
  MATCH (x:NostrEvent|TapestryNode {uuid: h})-[:${typeText(init)}]->(s)
  RETURN h AS header, x.tapestryKey AS headerKey, elementId(s) AS eid, s.tapestryKey AS key`;
const WIRE = (term) => `MATCH (s) WHERE elementId(s) = $s
  MATCH (m)-[:HAS_TAG]->(:NostrEventTag {type: 'z', value: $header})
  WHERE m.pubkey IS NOT NULL AND NOT m.pubkey IN $own
  WITH DISTINCT s, m
  WITH s, m, EXISTS { (s)-[:${typeText(term)}]->(m) } AS had
  MERGE (s)-[:${typeText(term)}]->(m)
  RETURN m.tapestryKey AS key, had`;

// ── the recorder (Decision 7) ──

/**
 * A node's properties as numbers where Neo4j holds integers: src/lib/neo4j-driver.js's toJS spreads a node's properties
 * as the driver gives them, so created_at and kind, which today's builder and this recorder store as integers, arrive
 * as the driver's Integer, which === never matches a number.
 */
const plainValue = (v) => (v && typeof v === 'object' && typeof v.toNumber === 'function' && 'low' in v && 'high' in v ? v.toNumber() : v);
const plainNode = (n) => (isObject(n) ? Object.fromEntries(Object.entries(n).map(([k, v]) => [k, plainValue(v)])) : n);

/** { byUuid, byId }: Maps from each uuid and id asked to the nodes there, each { eid, n } (n: properties and _labels). */
async function nodesAt(tx, { uuids = [], ids = [] }) {
  const byUuid = new Map();
  const byId = new Map();
  const add = (m, row) => {
    if (!m.has(row.at)) m.set(row.at, []);
    const list = m.get(row.at);
    if (row.node && !list.some((x) => x.eid === row.eid)) list.push({ eid: row.eid, n: plainNode(row.node) });
  };
  const u = [...new Set(uuids.filter(isText))];
  if (u.length) for (const row of await tx.read(AT_UUID, { uuids: u })) add(byUuid, row);
  const i = [...new Set(ids.filter(isText))];
  if (i.length) for (const row of await tx.read(WITH_ID, { ids: i })) add(byId, row);
  return { byUuid, byId };
}

const labelsIn = (x) => (Array.isArray(x.n._labels) ? x.n._labels : []);
const isPlaceholder = (x) => labelsIn(x).includes('NostrEvent') && (x.n.created_at === undefined || x.n.created_at === null);
const holdsEvent = (x) => isText(x.n.id) && x.n.created_at !== undefined && x.n.created_at !== null;
const same = (a, b) => ((a === undefined || a === null) && (b === undefined || b === null)) || a === b;
function isOwn(x) {
  const { factsOf } = require('../graph/_nodes');
  return factsOf(x.n.tapestryKey, x.n).own;
}

/** The tag nodes an event's tags make: uuid <whole id>_<index>, type and the first five values (Decision 7.6). */
const tagRows = (e) => e.tags.map((t, i) => ({
  uuid: `${e.id}_${i}`,
  type: t[0] === undefined ? null : t[0],
  value: t[1] === undefined ? null : t[1],
  value1: t[2] === undefined ? null : t[2],
  value2: t[3] === undefined ? null : t[3],
  value3: t[4] === undefined ? null : t[4],
  value4: t[5] === undefined ? null : t[5],
}));
/** An older version's tags, as its tag nodes hold them, for its claims. */
const tagsFromNodes = (rows) => rows
  .map((r) => ({ i: Number(String(r.uuid || '').split('_').pop()), t: [r.type, r.value, r.value1, r.value2, r.value3, r.value4] }))
  .sort((a, b) => a.i - b.i)
  .map(({ t }) => { const out = [...t]; while (out.length && (out[out.length - 1] === null || out[out.length - 1] === undefined)) out.pop(); return out.map((x) => (x === null || x === undefined ? '' : String(x))); });

/**
 * The ends claims name, found, with placeholders made where a claim may make one (every claim but z): → { at(x) → [{ eid,
 * key }], made: [keys] }, `x` being { id } or an address's parts. An id is found by its id, else by a uuid that is the id
 * (a b placeholder today's builder made), else a placeholder is made with both (Decision 8).
 */
async function resolveEnds(tx, ends) {
  const addresses = new Map();
  const ids = new Set();
  for (const x of ends) { if (x.address) addresses.set(x.address, x); else if (x.id) ids.add(x.id); }
  const found = await nodesAt(tx, { uuids: [...addresses.keys(), ...ids], ids: [...ids] });
  const at = new Map();
  const made = [];
  for (const [a] of addresses) if (found.byUuid.has(a)) at.set(a, found.byUuid.get(a));
  for (const i of ids) {
    const hit = found.byId.get(i) || found.byUuid.get(i);
    if (hit) at.set(i, hit);
  }
  const missingA = [...addresses.values()].filter((x) => !at.has(x.address)).map((x) => ({ uuid: x.address, kind: x.kind, pubkey: x.pubkey }));
  if (missingA.length) {
    const { rows } = await tx.run(HOLD_ADDRESS, { missing: missingA });
    for (const r of rows) { at.set(r.at, [{ eid: r.eid, n: r.node }]); made.push(r.node.tapestryKey); }
  }
  const missingI = [...ids].filter((i) => !at.has(i));
  if (missingI.length) {
    const { rows } = await tx.run(HOLD_ID, { missing: missingI });
    for (const r of rows) { at.set(r.at, [{ eid: r.eid, n: r.node }]); made.push(r.node.tapestryKey); }
  }
  return { get: (x) => at.get(x.address || x.id) || [], made };
}

/** The supersets each header IS_THE_CONCEPT_FOR: Map(header address → [{ eid, key, headerKey }]). */
async function supersetsOf(tx, headers) {
  const out = new Map();
  if (!headers.length) return out;
  const { INIT } = require('../graph/_concepts').rel();
  for (const r of await tx.read(SUPERSETS(INIT), { headers: [...new Set(headers)] })) {
    if (!out.has(r.header)) out.set(r.header, []);
    if (!out.get(r.header).some((s) => s.eid === r.eid)) out.get(r.header).push({ eid: r.eid, key: r.key, headerKey: r.headerKey });
  }
  return out;
}

/**
 * Record verified event `e` in transaction `tx` (Decision 7): its node, its tags, its author and its claims, and the change
 * entry when anything changed. ctx: { own: the instance's own keys, caller, slugs? }. → { outcome, node, entry }, outcome
 * one of recorded, updated, unchanged, older, own.
 */
async function record(tx, e, ctx) {
  const own = Array.isArray(ctx.own) ? ctx.own : [];
  const R = require('../graph/_concepts').rel();
  const key = keyOf(e);

  // 1. Find its node: at its key, with its id, and, for an event with an address, at a uuid that is its id.
  const found = await nodesAt(tx, { uuids: key.address ? [key.uuid, e.id] : [e.id], ids: [e.id] });
  const atKey = found.byUuid.get(key.uuid) || [];
  const withId = found.byId.get(e.id) || [];
  const atId = key.address ? found.byUuid.get(e.id) || [] : [];
  const all = [];
  for (const x of [...atKey, ...withId, ...atId]) if (!all.some((y) => y.eid === x.eid)) all.push(x);
  const primary = (key.address ? atKey[0] || withId[0] || atId[0] : withId[0] || atKey[0]) || null;

  // 2. The instance's own node: reported, and nothing is written (AC6; Decision 7.2).
  const ownNode = all.find(isOwn);
  if (ownNode) return { outcome: 'own', node: ownNode.n.tapestryKey || null, entry: null };

  // 3. Versions, against a node that holds an event.
  let mode = 'new';
  if (primary && holdsEvent(primary)) {
    if (primary.n.id === e.id) mode = 'refresh';
    else if (newer(e, primary.n)) mode = 'update';
    else return { outcome: 'older', node: primary.n.tapestryKey || null, entry: null };
  } else if (primary) mode = 'fill';

  let changed = mode === 'new' || mode === 'fill';
  const nodes = new Set();
  const extra = [];

  // 4. Placeholders keyed by its id, merged into its node (memo #130). A node of today's that holds the event stays.
  const merged = primary ? all.filter((x) => x.eid !== primary.eid && isPlaceholder(x)) : [];
  for (const p of merged) {
    for (const type of [REFERENCES, INHERITS_FROM]) await tx.run(MOVE(type), { p: p.eid, n: primary.eid });
    await tx.run(DROP, { p: p.eid });
    changed = true;
    if (p.n.tapestryKey) extra.push(p.n.tapestryKey);
  }

  // The older version's tags, read before anything is written over them.
  const oldTags = primary ? await tx.read(TAGS_OF, { eid: primary.eid }) : [];

  // 5. The node, its fields, its labels and its author.
  const name = nameOf(e);
  const params = { uuid: key.uuid, id: e.id, pubkey: e.pubkey, createdAt: e.created_at, kind: e.kind, aTag: key.address, name, content: e.content };
  const content = e.kind === 7;
  const labels = labelsOf(e);
  let nodeKey;
  let nodeEid;
  if (!primary) {
    const { rows } = await tx.run(NODE_NEW(labels.filter((l) => l !== 'NostrEvent'), content), params);
    nodeKey = rows[0].key;
    nodeEid = rows[0].eid;
  } else {
    const was = primary.n;
    const want = { uuid: key.uuid, id: e.id, pubkey: e.pubkey, created_at: e.created_at, kind: e.kind, aTag: key.address, name, tapestryValue: name };
    if (content) want.content = e.content;
    const missing = labels.filter((l) => !labelsIn(primary).includes(l));
    if (Object.entries(want).some(([k, v]) => !same(was[k], v)) || missing.length || !isText(was.tapestryKey) || !labelsIn(primary).includes('TapestryNode')) changed = true;
    const { rows, counters } = await tx.run(NODE_AT(missing, content), { ...params, eid: primary.eid });
    nodeKey = rows[0].key;
    nodeEid = rows[0].eid;
    if (!rows[0].authored || counters.nodesCreated > 0) changed = true;
  }

  // 6. Its tags: written again on a newer version, or when they aren't in the recorder's shape.
  const rows = tagRows(e);
  const shaped = oldTags.length === rows.length && rows.every((r) => oldTags.some((t) => t.uuid === r.uuid));
  let tagEids = new Map(oldTags.map((t) => [t.uuid, t.eid]));
  if (mode === 'update' || !shaped) {
    if (oldTags.length) await tx.run(TAGS_DROP, { eid: nodeEid });
    tagEids = new Map();
    if (rows.length) for (const r of (await tx.run(TAGS_MAKE, { eid: nodeEid, tags: rows })).rows) tagEids.set(r.uuid, r.eid);
    changed = true;
  }

  // 7. Its claims (Decision 8). An own letter's s and structure claims are never made.
  const ownClaimant = own.includes(e.pubkey);
  const claims = claimsOf(e, { slugs: ctx.slugs || null }).filter((c) => !(ownClaimant && (c.kind === 's' || c.kind === 'structure')));
  const ends = [];
  for (const c of claims) {
    if (c.kind === 'reference' || c.kind === 'b') ends.push(c.to);
    else if (c.kind === 'n') ends.push(c.set);
    else if (c.kind === 's') ends.push(c.parent);
    else if (c.kind === 'structure') ends.push(c.from, c.to);
  }
  const resolved = await resolveEnds(tx, ends);
  for (const k of resolved.made) { nodes.add(k); changed = true; }
  const supersets = await supersetsOf(tx, claims.filter((c) => c.kind === 'z').map((c) => c.header.address));
  // Grouped by type, one statement a group. A tag's reference names only its target in the entry, not the tag.
  const groups = new Map();
  const linked = new Set();
  const link = (type, props, a, b, { fromTag = false } = {}) => {
    if (!a || !b) return;
    const g = `${type}${props}${fromTag ? '|tag' : ''}`;
    if (!groups.has(g)) groups.set(g, { type, props, fromTag, pairs: [] });
    if (!linked.has(`${type}${props}|${a}|${b}`)) { linked.add(`${type}${props}|${a}|${b}`); groups.get(g).pairs.push({ a, b }); }
  };
  const eidOf = (x) => { const hit = resolved.get(x); return hit.length ? hit[0].eid : null; };
  const inits = [];
  for (const c of claims) {
    if (c.kind === 'reference') link(REFERENCES, '', tagEids.get(`${e.id}_${c.tag}`), eidOf(c.to), { fromTag: true });
    else if (c.kind === 'b') link(c.inherit ? INHERITS_FROM : REFERENCES, c.inherit ? '' : B_TAG, nodeEid, eidOf(c.to));
    else if (c.kind === 'z') for (const s of supersets.get(c.header.address) || []) link(R.TERM, '', s.eid, nodeEid);
    else if (c.kind === 'n') link(R.TERM, '', eidOf(c.set), nodeEid);
    else if (c.kind === 's') link(R.PROP, '', eidOf(c.parent), nodeEid);
    else if (c.kind === 'structure') {
      link(c.type, '', eidOf(c.from), eidOf(c.to));
      if (c.type === R.INIT && c.from.d !== 'word') inits.push(c);
    }
  }
  const madeInit = new Set();
  for (const g of groups.values()) {
    const { rows: out } = await tx.run(LINK(g.type, g.props), { pairs: g.pairs });
    for (const r of out) {
      if (r.had) continue;
      changed = true;
      for (const k of g.fromTag ? [r.to] : [r.from, r.to]) if (isText(k) && k !== nodeKey) nodes.add(k);
      if (g.type === R.INIT && !g.props) madeInit.add(`${r.from}>${r.to}`);
    }
  }
  // A z claim in any order: an IS_THE_CONCEPT_FOR the import makes gives its superset a HAS_ELEMENT to every node whose z
  // tag names the header, but the instance's own (Decision 8; AC6).
  for (const c of inits) {
    const [h] = resolved.get(c.from);
    const [s] = resolved.get(c.to);
    if (!h || !s || !madeInit.has(`${h.n.tapestryKey}>${s.n.tapestryKey}`)) continue;
    const { rows: out } = await tx.run(WIRE(R.TERM), { s: s.eid, header: c.from.address, own });
    for (const r of out) if (!r.had) { changed = true; if (isText(r.key)) nodes.add(r.key); }
  }

  // 8. A newer version: the older's b, z, n and s claims it doesn't make are taken out, but a z membership whose
  // concept's section the owner keeps beside the letter (tapestryOwnSections); tag references went with the tags.
  if (mode === 'update') {
    const kept = new Set(claimsOf(e).map(claimKey).filter(Boolean));
    const stale = claimsOf({ pubkey: e.pubkey, tags: tagsFromNodes(oldTags) }).filter((c) => ['b', 'z', 'n', 's'].includes(c.kind) && !kept.has(claimKey(c)));
    if (stale.length) {
      const oldEnds = await nodesAt(tx, {
        uuids: stale.flatMap((c) => (c.kind === 'b' ? [c.to.address || c.to.id] : c.kind === 'n' ? [c.set.address] : c.kind === 's' ? [c.parent.address] : [])),
        ids: stale.filter((c) => c.kind === 'b' && c.to.id).map((c) => c.to.id),
      });
      const endsOf = (x) => (x.address ? oldEnds.byUuid.get(x.address) || [] : [...(oldEnds.byId.get(x.id) || []), ...(oldEnds.byUuid.get(x.id) || [])]);
      const oldSupersets = await supersetsOf(tx, stale.filter((c) => c.kind === 'z').map((c) => c.header.address));
      const sections = ownSections(primary.n.tapestryOwnSections);
      let oKeys = new Map();
      if (sections.size) {
        const keys = [...new Set([...oldSupersets.values()].flat().map((s) => s.headerKey).filter(isText))];
        const K = require('../graph/_concepts');
        oKeys = new Map((await K.headersByKey((c, p) => tx.read(c, p), keys)).map((h) => [h.key, h.oKey]));
      }
      // Never one this record has just linked for the newer version's own claims.
      const unlinks = new Map();
      const unlink = (type, props, a, b) => {
        if (linked.has(`${type}${props}|${a}|${b}`)) return;
        const g = `${type}${props}`;
        if (!unlinks.has(g)) unlinks.set(g, { type, props, pairs: [] });
        unlinks.get(g).pairs.push({ a, b });
      };
      for (const c of stale) {
        if (c.kind === 'b') for (const t of endsOf(c.to)) unlink(c.inherit ? INHERITS_FROM : REFERENCES, c.inherit ? '' : B_TAG, nodeEid, t.eid);
        else if (c.kind === 'n') for (const t of endsOf(c.set)) unlink(R.TERM, '', t.eid, nodeEid);
        else if (c.kind === 's') for (const t of endsOf(c.parent)) unlink(R.PROP, '', t.eid, nodeEid);
        else if (c.kind === 'z') {
          for (const s of oldSupersets.get(c.header.address) || []) {
            if (sections.has(oKeys.get(s.headerKey))) continue;
            unlink(R.TERM, '', s.eid, nodeEid);
          }
        }
      }
      for (const g of unlinks.values()) {
        const { rows: out } = await tx.run(UNLINK(g.type, g.props), { pairs: g.pairs });
        for (const r of out) { changed = true; for (const k of [r.from, r.to]) if (isText(k) && k !== nodeKey) nodes.add(k); }
      }
    }
  }

  // 9. Its change entry, in the same transaction, whenever something changed (Decision 7.8).
  if (!changed) return { outcome: 'unchanged', node: nodeKey, entry: null };
  const main = { change: mode === 'new' ? 'event-recorded' : mode === 'fill' ? 'placeholder-filled' : 'event-updated', node: nodeKey };
  if (mode === 'update' || mode === 'refresh') {
    main.was = { id: primary.n.id, created_at: primary.n.created_at };
    main.now = { id: e.id, created_at: e.created_at };
  }
  if (nodes.size) main.nodes = [...nodes];
  const changes = [main];
  if (extra.length) changes.push({ change: 'placeholder-merged', node: nodeKey, nodes: extra });
  const entry = await recordChange(tx, { at: new Date().toISOString(), caller: ctx.caller, operation: OPERATION, changes });
  return { outcome: mode === 'new' || mode === 'fill' ? 'recorded' : 'updated', node: nodeKey, entry };
}

/** The concept keys of the sections the owner keeps beside a letter (tapestryOwnSections), as a Set. */
function ownSections(value) {
  if (typeof value !== 'string') return new Set();
  try { const v = JSON.parse(value); return isObject(v) ? new Set(Object.keys(v)) : new Set(); } catch { return new Set(); }
}

module.exports = {
  UNIQUE, LABELS,
  words, isUnreachable, parseRef, addressParts, checkEvent, keyOf, newer, claimsOf, structureTypes, record,
};
