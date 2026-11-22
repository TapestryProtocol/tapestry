'use strict';
/**
 * What the suites of community-reference #39 share (story
 * engineering-team/stories/community-reference/39-firmware-install-leaves-tags-once.md; ADR
 * engineering-team/decisions/community-reference/0035-community-references-import-then-prune.md): letters, the two ways
 * today's code imports one, a strfry and a relay that keep letters as NIP-01 says, and readers over the graph that
 * test/helpers/cypherEngine.js keeps. Used by test/community-references-prune-builder.test.js,
 * test/firmware-install-leaves-tags-once.test.js and that suite's child, test/helpers/communityStepChild.js.
 *
 * Letters. letter(pubkey, { kind, at, tags, content, id }) is an event with NIP-01's id (or the id given, for a version
 * a manifest pins with knownGoodEventId) and a placeholder signature. Nothing these suites run checks a signature:
 * buildImportCypher, the fake strfry and the fake relay take a letter as it is, so any pubkey can sign one, an instance's
 * assistant included, whichever instance it is. headerTags(pubkey, slug) and supersetTags(pubkey, slug) are the tags
 * create-concept signs into a concept's header and superset (src/api/normalize/index.js, the header at :1247, the
 * superset at :1312), with short stand-ins for their json and description values.
 *
 * The two imports, each run on the engine as it is:
 *   pass1Import(state, letter)  what create-concept does with a header or superset it signs, which Pass 1 does for every
 *                               firmware concept on every install (src/firmware/install.js:184-190). It passes no
 *                               overwrite here, but create-concept's duplicate check never matches
 *                               (src/api/normalize/index.js:1198), so it signs every header again: normalize's importEventDirect
 *                               (src/api/normalize/index.js:135-177), its statements as they are, then the labels
 *                               create-concept sets (:1280-1283 and :1324). It deletes the node's tag nodes and makes one
 *                               per tag, sha256("<address>:<tag.join(',')>:<i>"). This is feat/tags' importEventDirect,
 *                               which has no TapestryNode label and no tapestryKey (story 39's test plan, "The feat/tags
 *                               port").
 *   todaysImport(state, letter) the real buildImportCypher (src/api/neo4j/eventSync.js), run whole: it MERGEs a tag node
 *                               per tag, named from the letter's id, and deletes none.
 *   importMakes(letter, how)    the uuids of the tag nodes one import of the letter makes on an empty graph, how being
 *                               'pass1' or 'today'
 * run(state, cypher, params) runs one statement as Neo4j commits one: a statement that fails, or that leaves a
 * relationship without its node, is rolled back and throws.
 *
 * Stores. new LetterStore(letters) keeps one letter per address, the newest (NIP-01: the later created_at, and on a tie
 * the lower id), and a regular event by its id; get(address), put(letter), all(), and query(filter), which answers ids,
 * kinds, authors and #d, newest first.
 *
 * Readers: addressOf, nodesAt, tagsOf, relsOut, selfRels, orphanTags, contentOf, bTargets, short.
 */

const crypto = require('crypto');
const path = require('path');
const E = require('./cypherEngine');

const ROOT = path.resolve(__dirname, '../..');
const { classifyBValue } = require(path.join(ROOT, 'src/lib/bValueForms'));

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const json = (x) => JSON.parse(JSON.stringify(x));
const oneLine = (q) => String(q).replace(/\s+/g, ' ').trim();
/** An address or a pubkey cut short for a message: 39998:8e901369…:tag. */
const short = (s) => String(s).replace(/[0-9a-f]{64}/g, (h) => `${h.slice(0, 8)}…`);

// ── letters ──
function letter(pubkey, { kind, at, tags = [], content = '', id = null }) {
  const t = json(tags);
  return { id: id || sha256(JSON.stringify([0, pubkey, at, kind, t, content])), pubkey, created_at: at, kind, tags: t, content, sig: '00'.repeat(64) };
}
function addressOf(ev) {
  if (ev.kind >= 30000 && ev.kind < 40000) return `${ev.kind}:${ev.pubkey}:${(ev.tags.find((t) => t[0] === 'd') || [])[1] || ''}`;
  return null;
}
const words = (slug) => slug.replace(/-/g, ' ');
function headerTags(pubkey, slug) {
  return [
    ['d', slug],
    ['names', words(slug), `${words(slug)}s`],
    ['slug', slug],
    ['concept-graph', `39999:${pubkey}:${slug}-concept-graph`],
    ['json', JSON.stringify({ word: { slug: `concept-header-for-the-concept-of-${slug}s`, wordTypes: ['word', 'conceptHeader'] } })],
    ['description', `The concept of ${words(slug)}s.`],
  ];
}
function supersetTags(pubkey, slug) {
  return [
    ['d', `${slug}-superset`],
    ['name', `${words(slug)}s`],
    ['z', `39998:${pubkey}:superset`],
    ['z', `39998:${pubkey}:set`],
    ['z', `39998:${pubkey}:word`],
    ['description', `This is the superset of all known ${words(slug)}s.`],
    ['json', JSON.stringify({ word: { slug: `superset-for-the-concept-of-${slug}s`, wordTypes: ['word', 'set', 'superset'] } })],
  ];
}

// ── the graph ──
const emptyGraph = () => ({ nodes: [], rels: [], nextEid: 1 });

/** One statement, committed as Neo4j commits it: rolled back, and thrown, if it fails or leaves a relationship dangling. */
function run(state, cypher, params = {}) {
  const before = JSON.stringify({ nodes: state.nodes, rels: state.rels, nextEid: state.nextEid });
  const out = E.run(state, cypher, params);
  const dangling = E.danglingRels(state);
  if (dangling.length) {
    Object.assign(state, JSON.parse(before));
    throw Object.assign(new Error(`Cannot delete a node that still has relationships (${dangling.length} would be left without their node), so Neo4j's commit refuses: ${oneLine(cypher).slice(0, 300)}`),
      { code: 'Neo.ClientError.Schema.ConstraintValidationFailed' });
  }
  return out;
}

let builders = null;
/** src/api/neo4j/eventSync.js, required once, quietly. */
function eventSync() {
  if (!builders) {
    const saved = {};
    for (const k of ['log', 'info', 'warn', 'debug']) { saved[k] = console[k]; console[k] = () => {}; }
    try { builders = require(path.join(ROOT, 'src/api/neo4j/eventSync.js')); } finally { Object.assign(console, saved); }
  }
  return builders;
}

/** normalize's importEventDirect, statement for statement, then the labels create-concept sets (see the header). */
function pass1Import(state, ev) {
  const uuid = addressOf(ev);
  const name = ((ev.tags.find((t) => t[0] === 'name') || ev.tags.find((t) => t[0] === 'names') || [])[1]) || '';
  run(state, `MERGE (e:NostrEvent {uuid: $uuid})
    SET e.id = $id, e.kind = $kind, e.pubkey = $pubkey, e.name = $name, e.created_at = $created_at
    WITH e
    FOREACH (_ IN CASE WHEN $kind = 39998 THEN [1] ELSE [] END | SET e:ListHeader)
    FOREACH (_ IN CASE WHEN $kind = 39999 THEN [1] ELSE [] END | SET e:ListItem)`,
  { uuid, id: ev.id, kind: ev.kind, pubkey: ev.pubkey, name, created_at: ev.created_at });
  run(state, 'MATCH (e:NostrEvent {uuid: $uuid})-[r:HAS_TAG]->(t:NostrEventTag) DELETE r, t', { uuid });
  ev.tags.forEach((tag, i) => {
    const props = { tagUuid: sha256(`${uuid}:${tag.join(',')}:${i}`), eventUuid: uuid, type: tag[0], value: tag[1] || '' };
    let set = 't.type = $type, t.value = $value';
    if (tag[2]) { props.value1 = tag[2]; set += ', t.value1 = $value1'; }
    if (tag[3]) { props.value2 = tag[3]; set += ', t.value2 = $value2'; }
    run(state, `MATCH (e:NostrEvent {uuid: $eventUuid}) CREATE (e)-[:HAS_TAG]->(t:NostrEventTag {uuid: $tagUuid}) SET ${set}`, props);
  });
  if (ev.kind === 39998) run(state, 'MATCH (h:NostrEvent {uuid: $uuid}) SET h:ListHeader, h:ConceptHeader', { uuid });
  if (ev.kind === 39999) run(state, 'MATCH (n:NostrEvent {uuid: $uuid}) SET n:Superset', { uuid });
}

/** Today's buildImportCypher(letter), run whole. */
function todaysImport(state, ev) {
  for (const q of eventSync().buildImportCypher(ev)) run(state, q, {});
}

/** The uuids, sorted, of the tag nodes one import of `ev` makes on an empty graph: how is 'pass1' or 'today'. */
function importMakes(ev, how) {
  const s = emptyGraph();
  if (how === 'pass1') pass1Import(s, ev); else todaysImport(s, ev);
  const node = nodesAt(s, addressOf(ev) || ev.id)[0];
  return node ? tagsOf(s, node).map((t) => t.props.uuid).sort() : [];
}

// ── stores ──
const newer = (a, b) => a.created_at > b.created_at || (a.created_at === b.created_at && a.id < b.id);
function matches(ev, f) {
  if (f.ids && !f.ids.includes(ev.id)) return false;
  if (f.kinds && !f.kinds.includes(ev.kind)) return false;
  if (f.authors && !f.authors.includes(ev.pubkey)) return false;
  if (f['#d'] && !ev.tags.some((t) => t[0] === 'd' && f['#d'].includes(t[1]))) return false;
  return true;
}
class LetterStore {
  constructor(letters = []) { this.map = new Map(); for (const l of letters) this.put(l); }
  put(ev) {
    const k = addressOf(ev) || ev.id;
    const held = this.map.get(k);
    if (!held || newer(ev, held)) this.map.set(k, json(ev));
    return this;
  }
  get(address) { return this.map.get(address) || null; }
  all() { return [...this.map.values()]; }
  query(f) { return this.all().filter((ev) => matches(ev, f || {})).sort((a, b) => (newer(a, b) ? -1 : newer(b, a) ? 1 : 0)); }
}

// ── readers ──
const isTag = (n) => n.labels.includes('NostrEventTag');
/** The nodes at a uuid (an address, or an id for a regular event), tag nodes aside. */
const nodesAt = (s, uuid) => s.nodes.filter((n) => !isTag(n) && n.props.uuid === uuid);
const byEid = (s, eid) => s.nodes.find((n) => n.eid === eid) || null;
/** A node's tag nodes. */
const tagsOf = (s, node) => s.rels.filter((r) => r.type === 'HAS_TAG' && r.from === node.eid).map((r) => byEid(s, r.to)).filter(Boolean);
/** A node's outgoing relationships, of a type if one is given, each with its end node as `toNode`. */
const relsOut = (s, node, type = null) => s.rels.filter((r) => r.from === node.eid && (!type || r.type === type)).map((r) => ({ ...r, toNode: byEid(s, r.to) }));
/** The relationships from a node to itself, of any type. */
const selfRels = (s, node) => s.rels.filter((r) => r.from === node.eid && r.to === node.eid);
/** The tag nodes nothing holds. */
const orphanTags = (s) => s.nodes.filter((n) => isTag(n) && !s.rels.some((r) => r.type === 'HAS_TAG' && r.to === n.eid));
/** A tag node's tag, as an array: its type, then its values in order (value, value1, value2, …). */
function contentOf(t) {
  const out = [t.props.type];
  for (const k of ['value', 'value1', 'value2', 'value3', 'value4']) { if (t.props[k] === undefined || t.props[k] === null) break; out.push(t.props[k]); }
  return out;
}
/** The targets a letter's b tags derive relationships to, as buildImportCypher's b branch reads them (ADR 0035 §1). */
function bTargets(ev) {
  const located = ev.tags.filter((t) => t[0] === 'b' && t[1] && ['a-tag', 'event-id'].includes(classifyBValue(t[1])));
  return { pointers: located.filter((t) => t[2] !== 'inherit').map((t) => t[1]), inherits: located.filter((t) => t[2] === 'inherit').map((t) => t[1]) };
}

module.exports = {
  ROOT, sha256, json, short, oneLine,
  letter, addressOf, headerTags, supersetTags,
  emptyGraph, run, eventSync, pass1Import, todaysImport, importMakes,
  LetterStore,
  nodesAt, byEid, tagsOf, relsOut, selfRels, orphanTags, contentOf, bTargets,
};
