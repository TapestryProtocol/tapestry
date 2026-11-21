'use strict';
/**
 * What graph declare-shared, wire-to-shared and defer-sharing share (story graph-operations-first-slice #48; ADR
 * graph-operations-first-slice/0048, Implementation notes): a concept header's shared-concept disposition, written in
 * the graph as the `b` tags its letter would carry (protocols/drafts/inherit-from.md § "The `b` tag";
 * protocols/drafts/shared-concepts.md), with the relationship each real `b` draws, and nothing signed (design D1).
 *
 *   headerOf(read, key)          one of the instance's own concept headers, read after the locks: { facts, h, tags,
 *                                bTags, values }, or the refusal unknown-concept, not-own-concept or firmware-concept,
 *                                in that order (Decision 3; Amendment 1, item 4)
 *   targetOf(text)               the address a target names: 39998:<64 lowercase hex>:<d-tag>, or an naddr of kind
 *                                39998 turned into one; else the refusal bad-target, before any statement (Decision 2)
 *   nodeAt(read, address)        { address, held, node }: the node at an address, by its tapestryKey or null, and
 *                                whether the graph holds the target itself, a node there that isn't a placeholder
 *                                (Amendment 1, items 1 and 3)
 *   addB(tx, found, tag)         the tag under the header, at its next index, as update-concept adds one → its
 *                                tag-added change (Decision 5)
 *   dropMarkers(tx, found)       each deferral marker the header holds taken out → their tag-removed changes
 *   link(tx, from, to)           REFERENCES {source: 'b-tag'} between two nodes by tapestryKey, merged with its source in
 *                                the pattern → whether this call made it (Decision 6)
 *   drawReference(tx, from, at)  that relationship to the node at an address, or to a placeholder of import nostr's
 *                                kind made there when no node of any label is → { key, held, made } (Decision 6)
 *   answerOf(found, outcome, values, changed)  the answer's outcome, concept, disposition and letterOutOfDate, from
 *                                the header's b values after the call (Decision 7; Amendment 1, item 2)
 *   BAD_TARGET, SELF_TARGET, AFFILIATED, DISPOSITION, TARGET   the refusals' and the answer's declarations
 *
 * src/lib/bValueForms.js stays the one owner of the value forms: its constants are required, never copied. Like the
 * other helpers it opens nothing when it loads, and it never signs, publishes or reads a key.
 */

const B = require('../../../lib/bValueForms');
const { keyNode } = require('../../../lib/tapestry-key-cypher');
const { refusal } = require('../../refusal');
const K = require('./_concepts');
const E = require('./_eventless');

/** The kind of a concept header's address, the only kind a target may name (Decision 2). */
const KIND = 39998;

const BAD_TARGET = Object.freeze({ code: 'bad-target', status: 400, when: "A target that isn't a concept header's address: 39998:<pubkey>:<d-tag>, its pubkey 64 lowercase hex, or an naddr of kind 39998; the refusal names the input" });
const SELF_TARGET = Object.freeze({ code: 'self-target', status: 400, when: "A target that is the concept's own address: offering the concept as a shared concept is graph declare-shared's job" });
const AFFILIATED = Object.freeze({ code: 'affiliated', status: 409, when: "A concept whose header holds a real b, naming an address or an event: a declaration or a wiring beats a deferral" });

const DISPOSITION = Object.freeze({
  type: 'object',
  required: ['selfDeclared', 'wired', 'deferred', 'bValues'],
  description: "The header's disposition after the call, as its b values give it (dispositionOf, src/lib/bValueForms.js), and those values",
  properties: {
    selfDeclared: { type: 'boolean', description: 'Whether a b names its own address: its author offers it as a shared concept' },
    wired: { type: 'boolean', description: 'Whether a b names another address, or an event: it is affiliated with another concept' },
    deferred: { type: 'boolean', description: 'Whether it holds the deferral marker and no real b: deliberately unaffiliated' },
    bValues: { type: 'array', items: { type: 'string' }, description: "Each b tag's value, its second element, once each and sorted" },
  },
});
const TARGET = Object.freeze({
  type: 'object',
  required: ['address', 'held', 'node'],
  description: 'The shared concept the b names, and the node its relationship runs to',
  properties: {
    address: { type: 'string', description: 'Its address, 39998:<pubkey>:<d-tag>: the target given, or the address its naddr names' },
    held: { type: 'boolean', description: "Whether the graph holds it: a node at the address that isn't a placeholder (a node with no created_at)" },
    node: { type: 'string', nullable: true, description: "The tapestryKey of the node at the address, a placeholder included; null when the graph holds none there" },
  },
});

// ── the header (Decision 3) ──
/**
 * The concept header keyed `key`, when it is one of the instance's own and not firmware's: → { facts (K.conceptFacts'),
 * h (its header), tags (its tag nodes), bTags, values (each b's value, as held) }. Else it refuses, naming the input
 * concept: unknown-concept, then not-own-concept (in words that say whose: another author's, or the owner's own key's),
 * then firmware-concept. Nothing changes: a write calls it after its locks, before it writes.
 */
async function headerOf(read, key) {
  const facts = await K.conceptFacts(read, key);
  if (!facts) throw refusal(K.UNKNOWN_CONCEPT.code, `No concept header has the tapestryKey ${key}. Name a concept by its header's tapestryKey. Nothing changed.`, { input: 'concept' });
  const h = facts.header;
  const name = h.names.singular || 'That concept';
  const ta = K.assistant();
  if (!ta || h.author !== ta) {
    // The owner's key is the one of the instance's own keys that isn't its assistant's (reads.js, ownKeys).
    const owners = !!h.author && h.author !== ta && require('../../reads').ownKeys().includes(h.author);
    throw refusal(K.NOT_OWN_CONCEPT.code, owners
      ? `${name} (${h.uuid}) is at the owner's own key, ${h.author}, not the instance's assistant's, and the assistant can't sign a new version of a letter at the owner's key. Nothing changed.`
      : `${name} (${h.uuid}) is another author's concept: its author is ${h.author || 'unknown'}, not the instance's assistant, which never re-signs another author's concept (design D8). Nothing changed.`, { input: 'concept' });
  }
  if (K.isFirmware(h.uuid)) throw refusal(K.FIRMWARE_CONCEPT.code, `${name} (${h.uuid}) is one of firmware's own concepts, which a firmware reinstall rebuilds from its definition, and the reinstall would drop a b written here. Nothing changed.`, { input: 'concept' });
  const tags = facts.nodes.conceptHeader.tags;
  const bTags = tags.filter((t) => t.type === 'b');
  return { facts, h, tags, bTags, values: bTags.map((t) => String(t.value)) };
}

// ── the target (Decision 2) ──
const quote = (text) => JSON.stringify(text.length > 60 ? `${text.slice(0, 57)}…` : text);

/** The address `text` names, trimmed as today's b-append route trims it, or the refusal bad-target. Reads nothing. */
function targetOf(text) {
  const given = typeof text === 'string' ? text.trim() : '';
  let address = given;
  if (/^naddr1/.test(given)) {
    let d = null;
    try { d = require('nostr-tools').nip19.decode(given); } catch { d = null; }
    const x = d && d.type === 'naddr' ? d.data : null;
    address = x && x.kind === KIND && typeof x.pubkey === 'string' && typeof x.identifier === 'string' ? `${x.kind}:${x.pubkey}:${x.identifier}` : null;
  }
  if (!address || B.classifyBValue(address) !== 'a-tag' || !address.startsWith(`${KIND}:`)) {
    throw refusal(BAD_TARGET.code, `The target ${quote(given)} isn't a concept header's address. Give it as 39998:<pubkey>:<d-tag>, its pubkey 64 lowercase hex, or as an naddr of kind 39998. Nothing changed.`, { input: 'target' });
  }
  return address;
}

// ── the node at an address (Amendment 1, items 1 and 3) ──
/** Every node at an address, of any label but a tag or an entry, and whether each has a created_at (no placeholder does). */
const AT = `MATCH (n:NostrEvent|TapestryNode {uuid: $address})
  WHERE NOT n:NostrEventTag AND NOT n:GraphChange
  RETURN n.tapestryKey AS key, n.created_at IS NOT NULL AS dated`;

/** → { address, held, node }; the node the graph holds is taken before a placeholder, then the lowest tapestryKey. */
async function nodeAt(read, address) {
  const rows = await read(AT, { address });
  const [best] = [...rows].sort((a, b) => Number(b.dated === true) - Number(a.dated === true) || String(a.key).localeCompare(String(b.key)));
  if (best && typeof best.key !== 'string') throw new Error(`the node at ${address} has no tapestryKey, so a b's relationship can't run to it; run lifecycle migrate first`);
  return { address, held: !!best && best.dated === true, node: best ? best.key : null };
}

// ── the writes (Decisions 5 and 6) ──
/** The tag `tag` under the header, at index tags.length, as update-concept adds one → its tag-added change. */
async function addB(tx, found, tag) {
  await E.addTags(tx, found.h.key, E.tagRows(found.h.uuid, [tag], found.tags.length));
  return { change: 'tag-added', node: found.h.key, field: 'b', now: tag[1] };
}

/** Each deferral marker the header holds taken out, as update-concept takes a tag out → their tag-removed changes. */
async function dropMarkers(tx, found) {
  const markers = found.bTags.filter((t) => t.value === B.SENTINEL);
  if (markers.some((t) => typeof t.key !== 'string')) throw new Error(`a deferral marker of ${found.h.uuid} has no tapestryKey, so it can't be taken out; run lifecycle migrate first`);
  for (const t of markers) await tx.run('MATCH (t:NostrEventTag:TapestryNode {tapestryKey: $key}) DETACH DELETE t', { key: t.key });
  return markers.map((t) => ({ change: 'tag-removed', node: found.h.key, field: 'b', was: t.value }));
}

/** A b's relationship, its source in the pattern, so §22's other REFERENCES are never matched and none is doubled. */
const LINK = `MATCH (a:TapestryNode {tapestryKey: $from})
  MATCH (b:TapestryNode {tapestryKey: $to})
  MERGE (a)-[r:REFERENCES {source: 'b-tag'}]->(b)
  RETURN count(r) AS n`;

/** → whether this call made the relationship from `from` to `to` (false when one was there). */
async function link(tx, from, to) {
  const { rows, counters } = await tx.run(LINK, { from, to });
  if (!rows.length || !(Number(rows[0].n) > 0)) throw new Error(`the b's relationship from ${from} to ${to} was not drawn: a node it runs between went missing`);
  return counters.relationshipsCreated > 0;
}

/** Import nostr's placeholder: a NostrEvent at the address, with its kind and pubkey and no created_at. */
const PLACEHOLDER = `CREATE (p:NostrEvent {uuid: $uuid})
  SET p.kind = toInteger($kind), p.pubkey = $pubkey
  ${keyNode('p')}
  RETURN p.tapestryKey AS key`;

/**
 * REFERENCES {source: 'b-tag'} from the node keyed `from` to the node at `address`, or to a placeholder made there when
 * no node of any label is, which importing that address's letter fills in → { key (the node it runs to), held, made }.
 */
async function drawReference(tx, from, address) {
  const at = await nodeAt((cypher, params) => tx.read(cypher, params), address);
  let key = at.node;
  if (key === null) {
    const [kind, pubkey] = address.split(':');
    const { rows } = await tx.run(PLACEHOLDER, { uuid: address, kind: Number(kind), pubkey });
    key = rows.length ? rows[0].key : null;
    if (typeof key !== 'string') throw new Error(`the placeholder at ${address} was written, but its tapestryKey did not come back`);
  }
  return { key, held: at.held, made: await link(tx, from, key) };
}

// ── the answer (Decision 7; Amendment 1, item 2) ──
/** The answer's data, from the header's b values after the call: letterOutOfDate only when it changed a lettered header. */
function answerOf(found, outcome, values, changed) {
  const { facts, h } = found;
  const bValues = [...new Set(values.map(String))].sort();
  return {
    outcome,
    concept: K.answerOf(h, facts.roles),
    disposition: { ...B.dispositionOf(bValues, h.uuid), bValues },
    letterOutOfDate: changed === true && h.hasLetter === true,
  };
}

module.exports = {
  KIND, BAD_TARGET, SELF_TARGET, AFFILIATED, DISPOSITION, TARGET,
  headerOf, targetOf, nodeAt, addB, dropMarkers, link, drawReference, answerOf,
};
