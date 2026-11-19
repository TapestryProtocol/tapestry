'use strict';
/**
 * The graph the move-element suites seed for test/helpers/graphFake.js (story graph-operations-first-slice #23, ADR
 * graph-operations-first-slice/0023). It starts from add-to-concept's and remove-from-concept's seed,
 * test/helpers/membershipGraph.js, which says what that graph holds and what it is built on. Among what this seed reuses
 * from there: beagle, whose superset ─▶ showBeagles, commonSet (also under word's superset) and scrollShelf; lucky
 * (lettered by the assistant, directly in showBeagles alone, with no n tag); setItem (lettered by the assistant, in
 * beagle's superset and showBeagles, its n naming showBeagles); peerInSet (OTHER's, the same, its n naming showBeagles);
 * dog, whose superset ─▶ golden retriever's superset ─▶ showGoldens, and ─▶ walkers, also under pet's superset; pet,
 * whose superset ─▶ walkers, lapPets and sharedSet (also under gadget's superset); whiskers (pet only); twoHome (beagle's
 * and pet's supersets); json-data-type, firmware's, its superset ─▶ numericTypes, with fwInteger in both (the manifest's
 * HAS_ELEMENT edge) and fwNumber in its superset and in pet's (the owner's claim, beside); personInPet (a person node in
 * pet's superset, beside); the relationship concept; wordOnly; the nodes another operation looks after; and G.
 *
 * "Made here" is a node with no letter, as create-element makes one; "lettered", one the import made of an event. Each
 * element's JSON is create-element's word block and its concept's section; its tags are d, name, a z for each concept
 * named, an n for each set named, and json. "A ─▶ B" is a class-thread link, A one of B's parents.
 *
 *   sets
 *     agilityBeagles   a second set of beagle's, under its superset beside showBeagles
 *     championBeagles  a set under showBeagles: a set below a set
 *     petWords         under pet's superset and word's: with commonSet, two sets that share only word (AC3)
 *     contextShelf     under beagle's superset and graph context's: a move into it joins graphContext, never counted
 *     contextOnly      under graph context's superset alone: a set of no concept but graphContext
 *     sharedTwo        a second set under pet's superset and gadget's, beside sharedSet
 *     gadgetBin        a set of gadget's alone
 *     numericPets      under json-data-type's superset and pet's
 *     cardSet          a node labelled Set with no address, as the trust pipeline's card sets are: not a set
 *                      (ADR 0028 Amendment 3)
 *
 *   moves made (MAIN)
 *     filer, cliFiler, adminFiler  made here, beagle, in its superset: filed into showBeagles
 *     shelved          lettered by the assistant, in showBeagles alone, its n naming it; relShelved, the assistant's
 *                      relationship event naming showBeagles HAS_ELEMENT shelved, in the relationship concept: taken
 *                      back up to beagle's superset
 *     hopper           lettered by the assistant and cached (tapestryJsonUpdatedAt), in showBeagles, its n naming it:
 *                      moved to agilityBeagles
 *     twoSets          made here, in showBeagles and agilityBeagles, an n naming each: the both-sets case
 *     doubled          made here, two copies of agilityBeagles' link and an n naming it
 *     stacked          made here, in showBeagles and agilityBeagles, an n naming each: moved up to the superset while
 *                      showBeagles still holds it
 *     peerCached       OTHER's lettered element of beagle, in its superset, cached: kept beside
 *     placeholderInPet a placeholder (a NostrEvent with no created_at) in pet's superset
 *     sharedKept       made here, pet and gadget, in sharedSet and gadget's superset: gadget still reaches it after a
 *                      move to lapPets
 *     inCommon         made here, beagle, in commonSet, its n naming it: leaves word, which isn't counted
 *     toCommon, toContext  made here, beagle, in its superset: join word and graphContext, neither counted
 *     goldFiled        made here, golden retriever (and so dog), in golden retriever's superset: moved to showGoldens
 *     twoShared        made here, pet and gadget, in sharedSet: moved to sharedTwo, two concepts shared
 *     markedGadget     made here, gadget, in its superset, carrying gadget_size and gadget_color: moved to gadgetBin
 *
 *   moves refused (REF)
 *     fwString         firmware's own string.json element at its install address, in numericPets alone: leaving it
 *                      would leave json-data-type, its element file's concept
 *     lapOnly          made here, pet, in lapPets: sharedSet would join gadget
 *     sharedOwn        made here, pet and gadget, in sharedSet: lapPets would leave gadget
 *     peerShared       OTHER's lettered, pet and gadget, in sharedSet, a z naming each: lapPets would leave gadget, which
 *                      their z claims
 *     deepNode         made here, beagle, in championBeagles alone, its n naming it
 *     unkeyedN         made here, in showBeagles, its n naming it a tag with no tapestryKey (run lifecycle migrate)
 *
 * keys and uuids name each node, as membershipGraph's do; FW_STRING_FILE is fwString's file, as firmware names it.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const MG = require('./membershipGraph');
const U = require('./updateNodeGraph');
const C = require('./conceptGraph');

const { TA, OTHER } = C;
const ROOT = path.resolve(__dirname, '..', '..');
const FIRMWARE = path.join(ROOT, 'firmware/versions/v1.0.0/concepts');
const dtag = require(path.join(ROOT, 'src/lib/dtag.js'));

const FW_STRING_FILE = 'concepts/json-data-type/elements/string.json';
const CACHED_AT = 1763000009;

const hex = (x) => crypto.createHash('sha256').update(String(x)).digest('hex');

async function seedMoveElement() {
  const seed = await MG.seedMemberships();
  const s = seed.state;
  const { keys, uuids } = seed;

  const add = (labels, props) => { const n = { eid: s.nextEid++, labels: [...new Set(labels)], props: { ...props } }; if (!n.props.tapestryKey) n.props.tapestryKey = crypto.randomUUID(); s.nodes.push(n); return n; };
  const link = (a, type, b) => { s.rels.push({ eid: s.nextEid++, type, from: a.eid, to: b.eid, props: {} }); };
  const nodeOf = (key) => s.nodes.find((n) => n.props.tapestryKey === key) || null;
  const named = (name, n) => { keys[name] = n.props.tapestryKey; if (n.props.uuid) uuids[name] = n.props.uuid; return n; };
  const tag = (node, t, i) => {
    const props = { uuid: C.tagUuid(node.props.uuid || node.props.tapestryKey, t, i), type: t[0], value: t[1] === undefined ? '' : t[1], tapestryKey: crypto.randomUUID() };
    link(node, 'HAS_TAG', add(['NostrEventTag', 'TapestryNode'], props));
  };
  const supersetOf = (headerKey) => {
    const h = nodeOf(headerKey);
    const r = s.rels.find((x) => x.type === 'IS_THE_CONCEPT_FOR' && x.from === h.eid);
    return s.nodes.find((n) => n.eid === r.to);
  };
  const eventlessSet = (slug, name, parents) => {
    const n = add(['ListItem', 'Set', 'TapestryNode'], { uuid: `39999:${TA}:${slug}`, kind: 39999, pubkey: TA, name, tapestryValue: name, created_at: 1763000000 });
    for (const p of parents) link(p, 'IS_A_SUPERSET_OF', n);
    return n;
  };

  const { BEAGLE, PET, GADGET, GOLDEN } = seed.concepts;
  const beagleSup = nodeOf(keys.beagleSuperset);
  const petSup = nodeOf(keys.petSuperset);
  const gadgetSup = nodeOf(keys.gadgetSuperset);
  const grSup = nodeOf(keys.goldenRetrieverSuperset);
  const wordSup = nodeOf(keys.supersets.word);
  const jdtSup = nodeOf(keys.jsonDataTypeSuperset);
  const relSup = nodeOf(keys.relationshipSuperset);
  const ctxSup = named('graphContextSuperset', supersetOf(keys.graphContextConcept));
  const showBeagles = nodeOf(keys.showBeagles);
  const commonSet = nodeOf(keys.commonSet);
  const sharedSet = nodeOf(keys.sharedSet);
  const lapPets = nodeOf(keys.lapPets);

  // ── the sets ──
  const agility = named('agilityBeagles', eventlessSet('agility-beagles', 'agility beagles', [beagleSup]));
  const champion = named('championBeagles', eventlessSet('champion-beagles', 'champion beagles', [showBeagles]));
  named('petWords', eventlessSet('pet-words', 'pet words', [petSup, wordSup]));
  named('contextShelf', eventlessSet('context-shelf', 'context shelf', [beagleSup, ctxSup]));
  named('contextOnly', eventlessSet('context-only', 'context only', [ctxSup]));
  named('sharedTwo', eventlessSet('shared-two', 'shared two', [petSup, gadgetSup]));
  named('gadgetBin', eventlessSet('gadget-bin', 'gadget bin', [gadgetSup]));
  const numericPets = named('numericPets', eventlessSet('numeric-pets', 'numeric pets', [jdtSup, petSup]));
  named('cardSet', add(['Set', 'TapestryNode'], { name: 'a card set' }));

  /**
   * One element of `c` named `name`, under each of `holders` (a holder twice is two copies of its link). Lettered when
   * `lettered`, else made here. Its JSON is create-element's word block and the sections (c's by default); its tags are
   * d, name, a z naming each concept of `zs` (c by default), an n naming each set of `ns`, and json.
   */
  function element({ c, name, holders, author = TA, lettered = false, zs = [c], ns = [], sections = null, types = null, extraProps = {} }) {
    const d = dtag.childDTag(name, c.uuid);
    const uuid = `39999:${author}:${d}`;
    const slug = dtag.slug(name);
    const word = { slug: `${c.slug}--${slug}`, name: `${c.singular}: ${name}`, title: `${c.title}: ${name}`, wordTypes: ['word', ...(types || [c.key])] };
    const text = JSON.stringify({ word, ...(sections || { [c.key]: { name, slug, description: `${name}, a ${c.singular}` } }) });
    const props = lettered
      ? { uuid, kind: 39999, pubkey: author, name, created_at: 1763000000, id: hex(`event ${uuid}`), ...extraProps }
      : { uuid, kind: 39999, pubkey: author, name, tapestryValue: name, created_at: 1763000000, ...extraProps };
    const n = add([...(lettered ? ['NostrEvent'] : []), 'ListItem', 'TapestryNode'], props);
    [['d', d], ['name', name], ...zs.map((z) => ['z', z.uuid]), ...ns.map((x) => ['n', x.props.uuid]), ['json', text]].forEach((t, i) => tag(n, t, i));
    for (const h of holders) link(h, 'HAS_ELEMENT', n);
    return n;
  }
  const both = (name) => ({ sections: { pet: { name, slug: dtag.slug(name), description: `${name}, a pet` }, gadget: { name, slug: dtag.slug(name), size: 1 } }, types: ['pet', 'gadget'], zs: [PET, GADGET] });

  // ── moves made ──
  named('filer', element({ c: BEAGLE, name: 'Filer', holders: [beagleSup] }));
  named('cliFiler', element({ c: BEAGLE, name: 'Command Filer', holders: [beagleSup] }));
  named('adminFiler', element({ c: BEAGLE, name: 'Admin Filer', holders: [beagleSup] }));
  const shelved = named('shelved', element({ c: BEAGLE, name: 'Shelved', holders: [showBeagles], lettered: true, ns: [showBeagles] }));
  const relD = hex('show beagles HAS_ELEMENT Shelved').slice(0, 16);
  const relShelved = named('relShelved', add(['NostrEvent', 'ListItem', 'TapestryNode'], { uuid: `39999:${TA}:${relD}`, kind: 39999, pubkey: TA, name: 'show beagles HAS_ELEMENT Shelved', created_at: 1763000000, id: hex(`event ${relD}`) }));
  [['d', relD], ['name', 'show beagles HAS_ELEMENT Shelved'], ['z', `39998:${TA}:relationship`], ['nodeFrom', showBeagles.props.uuid], ['nodeTo', shelved.props.uuid], ['relationshipType', 'HAS_ELEMENT']].forEach((t, i) => tag(relShelved, t, i));
  link(relSup, 'HAS_ELEMENT', relShelved);
  named('hopper', element({ c: BEAGLE, name: 'Hopper', holders: [showBeagles], lettered: true, ns: [showBeagles], extraProps: { tapestryJsonUpdatedAt: CACHED_AT } }));
  named('twoSets', element({ c: BEAGLE, name: 'Two Sets', holders: [showBeagles, agility], ns: [showBeagles, agility] }));
  named('doubled', element({ c: BEAGLE, name: 'Doubled', holders: [agility, agility], ns: [agility] }));
  named('stacked', element({ c: BEAGLE, name: 'Stacked', holders: [showBeagles, agility], ns: [showBeagles, agility] }));
  named('peerCached', element({ c: BEAGLE, name: 'Peer Cached', holders: [beagleSup], author: OTHER, lettered: true, extraProps: { tapestryJsonUpdatedAt: CACHED_AT } }));
  const placeholder = named('placeholderInPet', add(['NostrEvent', 'TapestryNode'], { uuid: `39999:${OTHER}:somewhere-else`, kind: 39999, pubkey: OTHER }));
  link(petSup, 'HAS_ELEMENT', placeholder);
  named('sharedKept', element({ c: PET, name: 'Shared Kept', holders: [sharedSet, gadgetSup], ...both('Shared Kept') }));
  named('inCommon', element({ c: BEAGLE, name: 'In Common', holders: [commonSet], ns: [commonSet] }));
  named('toCommon', element({ c: BEAGLE, name: 'To Common', holders: [beagleSup] }));
  named('toContext', element({ c: BEAGLE, name: 'To Context', holders: [beagleSup] }));
  named('goldFiled', element({
    c: GOLDEN, name: 'Gold Filed', holders: [grSup], types: ['dog', 'goldenRetriever'],
    sections: { dog: { name: 'Gold Filed', slug: 'gold-filed', breed: 'goldenRetriever' }, goldenRetriever: { name: 'Gold Filed', slug: 'gold-filed' } },
  }));
  named('twoShared', element({ c: PET, name: 'Two Shared', holders: [sharedSet], ...both('Two Shared') }));
  named('markedGadget', element({
    c: GADGET, name: 'Marked Gadget', holders: [gadgetSup],
    sections: { gadget: { name: 'Marked Gadget', slug: 'marked-gadget', size: 3, color: 'red' } },
    extraProps: { gadget_size: { $int: '3' }, gadget_color: 'red' },
  }));

  // ── moves refused ──
  const stringFile = JSON.parse(fs.readFileSync(path.join(FIRMWARE, 'json-data-type', 'elements', 'string.json'), 'utf8'));
  const stringName = MG.installName(stringFile);
  const stringUuid = U.firmwareElementAddress(stringName, 'json-data-type');
  const fwString = named('fwString', add(['NostrEvent', 'ListItem', 'TapestryNode'], { uuid: stringUuid, kind: 39999, pubkey: TA, name: stringName, created_at: 1763000000, id: hex(`event ${stringUuid}`) }));
  [['d', stringUuid.split(':').slice(2).join(':')], ['name', stringName], ['z', nodeOf(keys.jsonDataType).props.uuid], ['json', JSON.stringify(stringFile)]].forEach((t, i) => tag(fwString, t, i));
  link(numericPets, 'HAS_ELEMENT', fwString);
  named('lapOnly', element({ c: PET, name: 'Lap Only', holders: [lapPets] }));
  named('sharedOwn', element({ c: PET, name: 'Shared Own', holders: [sharedSet], ...both('Shared Own') }));
  named('peerShared', element({ c: PET, name: 'Peer Shared', holders: [sharedSet], author: OTHER, lettered: true, ...both('Peer Shared') }));
  named('deepNode', element({ c: BEAGLE, name: 'Deep Node', holders: [champion], ns: [champion] }));
  const unkeyed = named('unkeyedN', element({ c: BEAGLE, name: 'Unkeyed N', holders: [showBeagles], ns: [showBeagles] }));
  const nTag = s.rels.filter((r) => r.from === unkeyed.eid && r.type === 'HAS_TAG').map((r) => s.nodes.find((n) => n.eid === r.to)).find((t) => t.props.type === 'n');
  delete nTag.props.tapestryKey;

  return { ...seed, state: s, keys, uuids };
}

module.exports = { TA, OTHER, FW_STRING_FILE, CACHED_AT, seedMoveElement };
