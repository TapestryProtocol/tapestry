'use strict';
/**
 * The graph the create-set suites seed for test/helpers/graphFake.js (story graph-operations-first-slice #27, ADR
 * graph-operations-first-slice/0027). It starts from story 20's seed, createElementGraph.js's seedCreateElement, which
 * starts from story 16's conceptGraph.js (firmware's twelve headers with their supersets, beagle as today's
 * create-concept makes it with its element rover and its set show beagles, dog, pet and walkers, firmware's
 * relationship type, another author's nostr relay, loner and the change entry G). To that it adds what a set write
 * reads. TA, OTHER and OWNER are graphOpsSuite's and conceptGraph's; "A ─▶ B" is a class-thread link, A one of B's
 * parents.
 *
 *   set concept   firmware's header (39998:<TA>:set) and superset, given firmware's own JSON schema
 *                 (firmware/versions/v1.0.0/concepts/set/json-schema.json) at 39999:<TA>:set-schema; a primary property
 *                 with a slug field node on it, as generate-property-tree makes them for a wrapped schema; and the first
 *                 set of neo4j properties, 39999:<TA>:the-set-of-neo4j-properties-that-are-also-fields, which marks
 *                 nothing unless `mark` is given.
 *   word          firmware's header, given firmware's own JSON schema, which requires graphContext; and word ─▶ set's
 *                 superset, as firmware's existing-sets put it (firmware/versions/v1.0.0/manifest.json, sets.words).
 *   parents       beagleSuperset (own, today's create-concept's), showBeagles (own, add-subset's, under it), walkers
 *                 (under dog's and pet's supersets), dogSuperset (firmware's shape), relationshipTypeSuperset (a firmware
 *                 concept's), relaySuperset (OTHER's nostr relay concept's), peerSet (OTHER's, lettered, under
 *                 relaySuperset) and orphanSet (own, add-subset's, under no parent).
 *   not parents   cardSet (labelled Set, with no address, as the trust pipeline makes one), rover (an element), beagle
 *                 (a concept header), loner (a node of no concept) and G (a change entry).
 *   the repeat, under beagleSuperset:
 *                 showDogs ('Show Dogs', own, lettered as today's create-set signs one, described 'dogs for shows');
 *                 puppies ('Puppies', own, add-subset's, described 'young ones'); oddOnes (own, at the address the name
 *                 Odd Ones gives, named 'Odd Ones!'); nonceSet (own, at Nonce's address with ~1, named 'Nonce Set');
 *                 twinNonced (own, 'Twin', at ~2, the lowest key) and twinPlain (own, 'Twin', at the plain address, the
 *                 highest key); echoHigh (own, 'Echo', at ~1, the highest key) and echoLow (own, 'Echo', at ~2, the
 *                 lowest key); peerNamed ('Peer Named', OTHER's); hounds (an own superset named 'Hounds').
 *   addresses     elsewhere ('Elsewhere', own, under lapPets: the name under another parent); moved ('Moved', own, at
 *                 the address the name and beagleSuperset give, but under lapPets only); heldNode (a node that isn't a
 *                 set, at the address the name Held and beagleSuperset give); setCrowd0 to setCrowd99 (nodes at the
 *                 address the name Crowd and beagleSuperset give, and at each nonce to ~99).
 *   probe         ('Probe', own, add-subset's, under no parent): the set the parity suite links with link-set.
 *
 * Options:
 *   mark          the first set marks the set concept's slug field, so a set made carries set_slug;
 *   above         an own concept, collection, whose superset is above set's: every set is one of its elements too.
 *                 Its header has no schema node;
 *   strict        the set concept's schema also requires set.color;
 *   schema        'missing' (the set concept has no schema node) or 'broken' (its JSON doesn't parse);
 *   noSetConcept  the set concept's header points to no superset.
 *
 * keys names each node's tapestryKey (those above, plus createElementGraph's), with setConcept, setSuperset,
 * setSchema, wordSuperset, relay and relaySuperset; uuids names each node's address.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { writeState } = require('./graphFake');
const C = require('./conceptGraph');
const E = require('./createElementGraph');

const { TA, OTHER } = C;
const ROOT = path.resolve(__dirname, '..', '..');
const FIRMWARE = path.join(ROOT, 'firmware/versions/v1.0.0/concepts');
const dtag = require(path.join(ROOT, 'src/lib/dtag.js'));

const hex = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const firmwareJson = (concept, file) => JSON.parse(fs.readFileSync(path.join(FIRMWARE, concept, file), 'utf8'));
/** The address today's create-set and add-subset give a set of `name` under the parent at `parentUuid`, with a nonce. */
const setAddress = (name, parentUuid, nonce = null) => `39999:${TA}:${dtag.childDTag(name, parentUuid, nonce === null ? undefined : nonce)}`;
const SET_CONCEPT = `39998:${TA}:set`;
const FIRST_SET = `39999:${TA}:the-set-of-neo4j-properties-that-are-also-fields`;

async function seedCreateSet(opts = {}) {
  const seed = await E.seedCreateElement();
  const s = seed.state;
  const keys = { ...seed.keys };
  const uuids = { ...seed.uuids };

  const add = (labels, props) => { const n = { eid: s.nextEid++, labels: [...new Set(labels)], props: { ...props } }; if (!n.props.tapestryKey) n.props.tapestryKey = crypto.randomUUID(); s.nodes.push(n); return n; };
  const link = (a, type, b) => { s.rels.push({ eid: s.nextEid++, type, from: a.eid, to: b.eid, props: {} }); };
  const byUuid = (uuid) => s.nodes.find((n) => n.props.uuid === uuid) || null;
  const byKey = (k) => s.nodes.find((n) => n.props.tapestryKey === k) || null;
  const named = (name, n) => { keys[name] = n.props.tapestryKey; if (n.props.uuid) uuids[name] = n.props.uuid; return n; };
  const tag = (node, t, i) => {
    const props = { uuid: C.tagUuid(node.props.uuid, t, i), type: t[0], value: t[1] === undefined ? '' : t[1] };
    if (t[2]) props.value1 = t[2];
    link(node, 'HAS_TAG', add(['NostrEventTag', 'TapestryNode'], props));
  };
  const tagNode = (node, type) => s.rels.filter((r) => r.from === node.eid && r.type === 'HAS_TAG').map((r) => s.nodes.find((x) => x.eid === r.to)).find((t) => t && t.props.type === type) || null;
  const supersetOf = (header) => { const r = s.rels.find((x) => x.from === header.eid && x.type === 'IS_THE_CONCEPT_FOR'); return r ? s.nodes.find((n) => n.eid === r.to) : null; };

  /** A node as the import leaves an event: NostrEvent, ListHeader or ListItem, an id, its tags. */
  const lettered = ({ uuid, kind = 39999, tags, roleLabels = [], author = TA, tapestryKey = null }) => {
    const nameTag = tags.find((t) => t[0] === 'name') || tags.find((t) => t[0] === 'names') || [];
    const n = add(['NostrEvent', kind === 39998 ? 'ListHeader' : 'ListItem', ...roleLabels, 'TapestryNode'], { uuid, kind, pubkey: author, name: nameTag[1] || '', created_at: 1763000000, id: hex(`event ${uuid}`), ...(tapestryKey ? { tapestryKey } : {}) });
    tags.forEach((t, i) => tag(n, t, i));
    return n;
  };

  // ── the set concept ──
  const setHeader = byUuid(SET_CONCEPT);
  if (!setHeader) throw new Error('createSetGraph: story 16\'s seed has no set concept');
  const setSuperset = supersetOf(setHeader);
  named('setConcept', setHeader);
  named('setSuperset', setSuperset);
  /** A set's tags, as today's create-set signs them and add-subset writes them: d, name, z, s, then description. */
  const setTags = (uuid, name, parentUuid, description) => [['d', uuid.split(':').slice(2).join(':')], ['name', name], ['z', SET_CONCEPT], ['s', parentUuid], ...(description ? [['description', description]] : [])];
  /** An own set under `parent` (null for none), registered under the set concept, lettered or as add-subset makes one. */
  const aSet = (parent, { uuid, name, description = null, isLettered = false, author = TA, tapestryKey = null, parentUuid = null }) => {
    const tags = setTags(uuid, name, parentUuid || (parent ? parent.props.uuid : ''), description);
    let n;
    if (isLettered || author !== TA) {
      n = lettered({ uuid, tags, roleLabels: ['Set'], author, tapestryKey });
    } else {
      n = add(['ListItem', 'Set', 'TapestryNode'], { uuid, kind: 39999, pubkey: author, name, tapestryValue: name, created_at: 1763000000, ...(tapestryKey ? { tapestryKey } : {}) });
      tags.forEach((t, i) => tag(n, t, i));
    }
    if (parent) link(parent, 'IS_A_SUPERSET_OF', n);
    if (author === TA) link(setSuperset, 'HAS_ELEMENT', n);
    return n;
  };

  if (opts.noSetConcept) s.rels = s.rels.filter((r) => !(r.from === setHeader.eid && r.type === 'IS_THE_CONCEPT_FOR'));
  if (opts.schema !== 'missing') {
    const json = firmwareJson('set', 'json-schema.json');
    if (opts.strict) json.jsonSchema.properties.set.required = ['slug', 'color'];
    const schema = named('setSchema', lettered({ uuid: `39999:${TA}:set-schema`, tags: [['d', 'set-schema'], ['name', 'JSON schema for the concept of sets'], ['json', JSON.stringify(json)]], roleLabels: ['JSONSchema'] }));
    link(schema, 'IS_THE_JSON_SCHEMA_FOR', setHeader);
    if (opts.schema === 'broken') tagNode(schema, 'json').props.value = '{"jsonSchema": {"type": "obj';
  }
  // A wrapped schema's fields hang on the primary property (ADR graph-operations-foundation/0005, S2).
  const pp = named('setPrimaryProperty', lettered({ uuid: `39999:${TA}:set-primary-property`, tags: [['d', 'set-primary-property'], ['name', 'primary property for the concept of sets']], roleLabels: ['Property'] }));
  link(pp, 'IS_THE_PRIMARY_PROPERTY_FOR', setHeader);
  const slugField = named('setSlugField', lettered({ uuid: `39999:${TA}:slug-${hex('set slug field').slice(0, 8)}`, tags: [['d', `slug-${hex('set slug field').slice(0, 8)}`], ['name', 'slug']], roleLabels: ['Property'] }));
  link(slugField, 'IS_A_PROPERTY_OF', pp);
  const firstSet = named('firstSet', lettered({ uuid: FIRST_SET, tags: [['d', 'the-set-of-neo4j-properties-that-are-also-fields'], ['name', 'neo4j properties that are also fields']], roleLabels: ['Set'] }));
  if (opts.mark) link(firstSet, 'HAS_ELEMENT', slugField);

  // ── word, above the set concept's superset ──
  const wordHeader = byUuid(`39998:${TA}:word`);
  const wordSuperset = supersetOf(wordHeader);
  named('wordSuperset', wordSuperset);
  const wordSchema = lettered({ uuid: `39999:${TA}:word-schema`, tags: [['d', 'word-schema'], ['name', 'JSON schema for the concept of words'], ['json', JSON.stringify(firmwareJson('word', 'json-schema.json'))]], roleLabels: ['JSONSchema'] });
  link(wordSchema, 'IS_THE_JSON_SCHEMA_FOR', wordHeader);
  link(wordSuperset, 'IS_A_SUPERSET_OF', setSuperset);

  if (opts.above) {
    const ch = { conceptHeader: { oNames: { singular: 'collection', plural: 'collections' }, oSlugs: { singular: 'collection', plural: 'collections' }, oKeys: { singular: 'collection', plural: 'collections' }, oTitles: { singular: 'Collection', plural: 'Collections' } } };
    const header = named('collection', lettered({ uuid: `39998:${TA}:collection`, kind: 39998, tags: [['d', 'collection'], ['names', 'collection', 'collections'], ['slug', 'collection'], ['json', JSON.stringify(ch)]], roleLabels: ['ConceptHeader'] }));
    const sup = named('collectionSuperset', lettered({ uuid: `39999:${TA}:collection-superset`, tags: [['d', 'collection-superset'], ['name', 'superset for the concept of collections']], roleLabels: ['Superset'] }));
    link(header, 'IS_THE_CONCEPT_FOR', sup);
    link(sup, 'IS_A_SUPERSET_OF', setSuperset);
  }

  // ── parents ──
  const beagleSup = byKey(keys.beagleSuperset);
  const lapPets = byKey(keys.lapPets);
  const relayHeader = byKey(keys.relay);
  const relaySup = supersetOf(relayHeader);
  named('relaySuperset', relaySup);
  named('dogSuperset', byKey(keys.dogSuperset));
  named('peerSet', aSet(relaySup, { uuid: `39999:${OTHER}:fast-relays`, name: 'fast relays', author: OTHER }));
  named('orphanSet', aSet(null, { uuid: `39999:${TA}:orphans`, name: 'orphans', parentUuid: '' }));
  named('probe', aSet(null, { uuid: `39999:${TA}:probe`, name: 'Probe', parentUuid: '' }));
  named('cardSet', add(['Set', 'SetOfNostrUserWotMetricsCards', 'TapestryNode'], {}));

  // ── the repeat, under beagle's superset ──
  const bUuid = beagleSup.props.uuid;
  named('showDogs', aSet(beagleSup, { uuid: setAddress('Show Dogs', bUuid), name: 'Show Dogs', description: 'dogs for shows', isLettered: true }));
  named('puppies', aSet(beagleSup, { uuid: setAddress('Puppies', bUuid), name: 'Puppies', description: 'young ones' }));
  named('oddOnes', aSet(beagleSup, { uuid: setAddress('Odd Ones', bUuid), name: 'Odd Ones!' }));
  named('nonceSet', aSet(beagleSup, { uuid: setAddress('Nonce', bUuid, 1), name: 'Nonce Set' }));
  named('twinNonced', aSet(beagleSup, { uuid: setAddress('Twin', bUuid, 2), name: 'Twin', tapestryKey: '00000000-0000-4000-8000-000000000011' }));
  named('twinPlain', aSet(beagleSup, { uuid: setAddress('Twin', bUuid), name: 'Twin', tapestryKey: 'ffffffff-ffff-4fff-bfff-fffffffffff3' }));
  named('echoHigh', aSet(beagleSup, { uuid: setAddress('Echo', bUuid, 1), name: 'Echo', tapestryKey: 'ffffffff-ffff-4fff-bfff-fffffffffff4' }));
  named('echoLow', aSet(beagleSup, { uuid: setAddress('Echo', bUuid, 2), name: 'Echo', tapestryKey: '00000000-0000-4000-8000-000000000012' }));
  named('peerNamed', aSet(beagleSup, { uuid: `39999:${OTHER}:${dtag.childDTag('Peer Named', bUuid)}`, name: 'Peer Named', author: OTHER }));
  const hounds = named('hounds', add(['ListItem', 'Superset', 'TapestryNode'], { uuid: `39999:${TA}:hounds-superset`, kind: 39999, pubkey: TA, name: 'Hounds', tapestryValue: 'Hounds', created_at: 1763000000 }));
  link(beagleSup, 'IS_A_SUPERSET_OF', hounds);

  // ── addresses ──
  named('elsewhere', aSet(lapPets, { uuid: setAddress('Elsewhere', lapPets.props.uuid), name: 'Elsewhere' }));
  named('moved', aSet(lapPets, { uuid: setAddress('Moved', bUuid), name: 'Moved', parentUuid: bUuid }));
  named('heldNode', add(['ListItem', 'TapestryNode'], { uuid: setAddress('Held', bUuid), kind: 39999, pubkey: TA, name: 'not a set' }));
  for (let i = 0; i < 100; i++) named(`setCrowd${i}`, add(['ListItem', 'TapestryNode'], { uuid: setAddress('Crowd', bUuid, i ? i : null), kind: 39999, pubkey: TA, name: `crowd ${i}` }));

  return {
    state: s,
    keys,
    uuids,
    /** Write the state to <dir>/graph.json and return its path. */
    file(dir) { const f = path.join(dir, 'graph.json'); writeState(f, s); return f; },
  };
}

module.exports = { TA, OTHER, SET_CONCEPT, FIRST_SET, seedCreateSet, setAddress };
