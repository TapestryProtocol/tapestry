'use strict';
/**
 * The graph the resolve suites seed for test/helpers/graphFake.js (story graph-operations-first-slice #9, ADR
 * graph-operations-first-slice/0009). TA, the owner and the admin are test/helpers/graphOpsSuite.js's unless given.
 * Each concept header has the `names` and `slug` tags today's create-concept signs, as NostrEventTag nodes behind
 * HAS_TAG.
 *
 * Concept headers (labelled NostrEvent, ListHeader, ConceptHeader and TapestryNode, unless said):
 *   dog          39998:<TA>:dog, names dog/dogs, slug dog; its superset dogSuperset at 39999:<TA>:dog-superset
 *   peerDog      39998:<lo>:dog, by the peer lo (scored 0.01, below the cutoff), labelled ListHeader only, as the
 *                nostr import brings a concept in; names dog/dogs, slug dog
 *   breed        39998:<TA>:dog-breed, names dog breed/dog breeds, slug dog-breed, its latest event's id REPLACED_ID;
 *                its superset breedSuperset holds three elements, beagle, collie and poodle
 *   net          39998:<TA>:nostr-event-tag, names nostr event tagging/…, slug nostr-event-tagging: its slug and its
 *                d-tag differ, as the firmware's concept's do
 *   relay        39998:<TA>:nostr-relay, names nostr relay/nostr relays, slug nostr-relay
 *   peerRelay    39998:<lo>:nostr-relay, by lo, ListHeader only, the same names and slug
 *   cat1         39998:<TA>:cat~1, a versioned address; names cat/cats, slug cat
 *   fish         39998:<TA>:fish, a names tag with no plural, and no slug tag
 * Other nodes:
 *   dogItem      'Dog', the assistant's, at 39999:<TA>:dog-1a2b3c4d: a node named like the concept dog
 *   rex          'Rex', the owner's, at 39999:<owner>:rex
 *   peerRex      'rex', lo's, at 39999:<lo>:rex
 *   fido         tapestryValue 'Fido', name 'old fido': its name is its tapestryValue
 *   walkers      a set with an address, 39999:<TA>:walkers
 *   cardSet      a trust-pipeline card set (Set, no address, no author), named 'walkers' too
 *   gou          a node named in another script (dog, in Chinese), the assistant's
 *   hiDog        'hi dog', by the peer hi (scored 0.2, above the cutoff)
 *   adminNote    'admin note', by the admin (scored 0.01: an admin counts by score)
 *   note         a kind-1 event at its id, EVENT_ID, named 'a note'
 *   eTag         an event's tag node whose uuid is EVENT_ID too: never a candidate
 *   peerList     a kind-30000 event at 30000:<hi>:dog: not a concept-graph kind, so no d-tag of its names it
 *   colon        'x dog', at 39999:<TA>:x:dog: its d-tag holds a colon, so it isn't `dog`
 *   ghost        'ghost', with no tapestryKey; and ghost2, 'ghost' keyed '{}': neither is ever a candidate
 *   G            a change entry named 'dog': never a candidate
 *   item1…itemN  `items` nodes (120 by default) named 'item', the assistant's: three pages of 50
 * NostrUser scores: hi 0.2, lo 0.01, the admin 0.01, the owner 1; with `unscored`, none has an influence.
 *
 * seedResolve(opts) → { state, keys: { <name>: tapestryKey }, uuids: { <name>: uuid }, itemKeys (sorted), pubkeys,
 * file(dir) }.
 */

const path = require('path');
const crypto = require('crypto');
const { emptyState, writeState } = require('./graphFake');
const S = require('./graphOpsSuite');

const PEERS = Object.freeze({ hi: '11'.repeat(32), lo: '22'.repeat(32), stranger: 'ef'.repeat(32) });
/** A kind-1 note's id, which an event tag's uuid also holds. */
const EVENT_ID = 'e1'.repeat(32);
/** The latest event's id of dog breed's header, a replaceable event. */
const REPLACED_ID = 'e2'.repeat(32);
/** Dog, in Chinese: a name with no letter a–z, which still resolves. */
const GOU = String.fromCodePoint(0x72d7);

function seedResolve({ owner = S.OWNER, admin = S.ADMIN, ta = S.TA, unscored = false, items = 120 } = {}) {
  const s = emptyState();
  const keys = {};
  const uuids = {};
  const itemKeys = [];
  const add = (name, labels, props, { keyed = true } = {}) => {
    const p = { ...props };
    if (keyed && p.tapestryKey === undefined) p.tapestryKey = crypto.randomUUID();
    const n = { eid: s.nextEid++, labels, props: p };
    s.nodes.push(n);
    if (name) {
      if (keyed) keys[name] = p.tapestryKey;
      if (p.uuid) uuids[name] = p.uuid;
    }
    return n;
  };
  const link = (from, type, to) => { s.rels.push({ eid: s.nextEid++, type, from: from.eid, to: to.eid, props: {} }); };
  const tag = (node, type, value, value1) => {
    const props = { type, value };
    if (value1 !== undefined) props.value1 = value1;
    link(node, 'HAS_TAG', add(null, ['NostrEventTag', 'TapestryNode'], props));
  };
  const HEADER = ['NostrEvent', 'ListHeader', 'ConceptHeader', 'TapestryNode'];
  const IMPORTED = ['NostrEvent', 'ListHeader', 'TapestryNode'];
  const header = (name, { author = ta, d, singular, plural, slug, labels = HEADER, extra = {} }) => {
    const h = add(name, labels, { uuid: `39998:${author}:${d}`, name: singular, pubkey: author, kind: 39998, ...extra });
    tag(h, 'names', singular, plural);
    if (slug !== undefined) tag(h, 'slug', slug);
    return h;
  };
  const item = (name, props, opts) => add(name, ['NostrEvent', 'ListItem', 'TapestryNode'], { kind: 39999, ...props }, opts);

  // ── concepts ──
  const dog = header('dog', { d: 'dog', singular: 'dog', plural: 'dogs', slug: 'dog' });
  const dogSuperset = add('dogSuperset', ['NostrEvent', 'ListItem', 'Superset', 'TapestryNode'], { uuid: `39999:${ta}:dog-superset`, name: 'superset for the concept of dogs', pubkey: ta, kind: 39999 });
  link(dog, 'IS_THE_CONCEPT_FOR', dogSuperset);
  header('peerDog', { author: PEERS.lo, d: 'dog', singular: 'dog', plural: 'dogs', slug: 'dog', labels: IMPORTED });
  const breed = header('breed', { d: 'dog-breed', singular: 'dog breed', plural: 'dog breeds', slug: 'dog-breed', extra: { id: REPLACED_ID } });
  const breedSuperset = add('breedSuperset', ['NostrEvent', 'ListItem', 'Superset', 'TapestryNode'], { uuid: `39999:${ta}:dog-breed-superset`, name: 'superset for the concept of dog breeds', pubkey: ta, kind: 39999 });
  link(breed, 'IS_THE_CONCEPT_FOR', breedSuperset);
  for (const b of ['beagle', 'collie', 'poodle']) link(breedSuperset, 'HAS_ELEMENT', item(b, { uuid: `39999:${ta}:${b}-0b0b0b0b`, name: b, pubkey: ta }));
  header('net', { d: 'nostr-event-tag', singular: 'nostr event tagging', plural: 'nostr event taggings', slug: 'nostr-event-tagging' });
  header('relay', { d: 'nostr-relay', singular: 'nostr relay', plural: 'nostr relays', slug: 'nostr-relay' });
  header('peerRelay', { author: PEERS.lo, d: 'nostr-relay', singular: 'nostr relay', plural: 'nostr relays', slug: 'nostr-relay', labels: IMPORTED });
  header('cat1', { d: 'cat~1', singular: 'cat', plural: 'cats', slug: 'cat' });
  header('fish', { d: 'fish', singular: 'fish', plural: undefined, slug: undefined });

  // ── other nodes ──
  item('dogItem', { uuid: `39999:${ta}:dog-1a2b3c4d`, name: 'Dog', pubkey: ta });
  item('rex', { uuid: `39999:${owner}:rex`, name: 'Rex', pubkey: owner });
  item('peerRex', { uuid: `39999:${PEERS.lo}:rex`, name: 'rex', pubkey: PEERS.lo });
  item('fido', { uuid: `39999:${ta}:fido-0c0c0c0c`, tapestryValue: 'Fido', name: 'old fido', pubkey: ta });
  add('walkers', ['Set', 'TapestryNode'], { uuid: `39999:${ta}:walkers`, name: 'walkers', pubkey: ta });
  add('cardSet', ['Set', 'SetOfNostrUserWotMetricsCards', 'TapestryNode'], { name: 'walkers', observee_pubkey: PEERS.hi });
  item('gou', { uuid: `39999:${ta}:gou`, name: GOU, pubkey: ta });
  item('hiDog', { uuid: `39999:${PEERS.hi}:hi-dog`, name: 'hi dog', pubkey: PEERS.hi });
  item('adminNote', { uuid: `39999:${admin}:admin-note`, name: 'admin note', pubkey: admin });
  add('note', ['NostrEvent', 'TapestryNode'], { uuid: EVENT_ID, id: EVENT_ID, kind: 1, name: 'a note', pubkey: ta });
  add('eTag', ['NostrEventTag', 'TapestryNode'], { uuid: EVENT_ID, type: 'e', value: EVENT_ID });
  add('peerList', ['NostrEvent', 'TapestryNode'], { uuid: `30000:${PEERS.hi}:dog`, kind: 30000, name: 'my dogs', pubkey: PEERS.hi });
  item('colon', { uuid: `39999:${ta}:x:dog`, name: 'x dog', pubkey: ta });
  item('ghost', { uuid: `39999:${ta}:ghost`, name: 'ghost', pubkey: ta }, { keyed: false });
  item(null, { uuid: `39999:${ta}:ghost-2`, name: 'ghost', pubkey: ta, tapestryKey: '{}' }, { keyed: false });
  add('G', ['GraphChange', 'TapestryNode'], { name: 'dog', at: '2026-01-01T00:00:00.000Z', byRole: 'owner', byPubkey: owner, operation: 'graph add-relationship', keys: [], changes: '[]' });
  for (let i = 1; i <= items; i++) {
    const n = item(`item${i}`, { uuid: `39999:${ta}:item-${i}`, name: 'item', pubkey: ta });
    itemKeys.push(n.props.tapestryKey);
  }
  itemKeys.sort();

  // ── the web of trust's scores ──
  const user = (pubkey, influence) => add(null, ['NostrUser', 'TapestryNode'], unscored ? { pubkey } : { pubkey, influence });
  user(PEERS.hi, 0.2);
  user(PEERS.lo, 0.01);
  user(admin, 0.01);
  user(owner, 1);

  return {
    state: s,
    keys,
    uuids,
    itemKeys,
    pubkeys: { ta, owner, admin, ...PEERS },
    /** Write the state to <dir>/graph.json and return its path. */
    file(dir) { const f = path.join(dir, 'graph.json'); writeState(f, s); return f; },
  };
}

module.exports = { seedResolve, PEERS, EVENT_ID, REPLACED_ID, GOU };
