'use strict';
/**
 * The graph the add-to-concept and remove-from-concept suites seed for test/helpers/graphFake.js (story
 * graph-operations-first-slice #22, ADR graph-operations-first-slice/0022). It starts from update-node's seed,
 * test/helpers/updateNodeGraph.js, which is built on create-element's (test/helpers/createElementGraph.js); those two say
 * what they hold: beagle, with rover (lettered), lucky (lettered, in showBeagles), odie (at the address "Odie" gives),
 * OTHER's snowy, the owner's patch, an admin's ace, a stranger's drifter (no letter), ghosty (no author), stamped
 * (cached), mute (no json tag), twofer, garble, phantom and listy (JSON that can't be read); dog, with golden retriever's
 * superset and walkers below its superset, firmware's rover at its file's address, and walkerMax in walkers; pet, with
 * walkers and lapPets below its superset, and whiskers; gadget (its schema wants size, an integer) with gizmo; scroll,
 * teapot, kettle, lantern and compass (no-schema); word, OTHER's word and graph context (reserved keys); the twelve
 * firmware concepts (keys.fw, keys.supersets) and graph rule; the property node, the rule element and wordOnly; loner;
 * and G, a change entry.
 *
 * To that it adds, by the name the suites use. "Made here" is a node with no letter, as create-element makes one;
 * "lettered", one the import made of an event, with its id and created_at; "beside" is the owner's sections kept in the
 * node's tapestryOwnSections property, beside another author's letter or firmware's definition (ADR 0022 Decision 6).
 * Each element's JSON is create-element's word block and its sections; its tags are d, name, a z for each concept named
 * below, an n where said, and json. "A ─▶ B" is a class-thread link, A one of B's parents.
 *
 *   concepts and sets the new nodes use
 *     jsonDataType       firmware's json-data-type concept (39998:<TA>:json-data-type), its header's JSON the file's;
 *                        jsonDataTypeSuperset ─▶ numericTypes, the set its file sets/numeric-types.json makes
 *     relationship       firmware's relationship concept, whose superset holds relEvent
 *     neo4jProperty      the concept of neo4j properties: its superset ─▶ firstSet, the set whose HAS_ELEMENT edges are
 *                        the marks. gadget's size and color are marked (MARKED): a property node for each hangs on
 *                        gadget's primary property, so gadget's elements carry gadget_size and gadget_color (AC9)
 *     commonSet          a set of the instance's own under beagle's superset and word's: word reaches what it holds
 *
 *   add-to-concept (AC1–AC5, AC9)
 *     fetch              made here, beagle: joins dog through walkers, which pet shares (AC2)
 *     personNode         a NostrUser (PERSON) with no name, in no concept: takes its section's name from fields (AC5)
 *     placeholder        a NostrEvent with no created_at (39999:<OTHER>:far-away), in no concept (AC5)
 *     peerLucky          OTHER's lettered element of pet named Lucky: beside, so no name-in-use in beagle (Decision 8)
 *     peerStale          OTHER's lettered beagle element whose letter has a pet section, though it isn't in pet: the
 *                        owner's fields merge into that section, kept beside (Decision 7)
 *     stale              made here, beagle, its JSON holding a pet section though it isn't in pet (Decision 7)
 *     markMe             made here, beagle: joins gadget with a size and a color (AC9)
 *     stored             made here, beagle, its json tag lmdb:<its tapestryKey>; storeEntries() stores STORED_JSON
 *     commandBeagle      made here, beagle: the command's add, and the refusals' node
 *     petLucky, petOdie, petPatch, petSnowy  made here, pet, named lucky, Odie, Patch and Snowy: the first three clash
 *                        in beagle with lucky (by name, case aside), odie (by the address "Odie" gives) and the owner's
 *                        patch (name-in-use); Snowy is OTHER's there, so no clash
 *
 *   remove-from-concept (AC5–AC8)
 *     twoHome, roundTrip, pair, cliPair, adminPair  made here, beagle and pet, both sections, a z for each; pair is
 *                        cached (tapestryJsonUpdatedAt); roundTrip is taken out of pet and put back
 *     setItem            lettered by the assistant, beagle's superset and showBeagles, its n naming showBeagles
 *     relEvent           the assistant's relationship event naming showBeagles HAS_ELEMENT setItem, as today's
 *                        add-to-set signs one (nodeFrom, nodeTo, relationshipType tags), in the relationship concept
 *     goldie             made here, golden retriever's superset and pet: dog, golden retriever and pet sections, a z
 *                        naming golden retriever and one naming pet; dog reaches it only through golden retriever
 *     walkerBella        made here, beagle's superset and walkers: beagle and dog sections, z beagle, z dog, n walkers
 *     wordy              made here, in commonSet and pet: leaving beagle leaves word too
 *     commonOnly         made here, in commonSet alone: beagle and word reach it, so leaving beagle leaves it in no
 *                        concept but word (the rule node-has-a-concept, D9)
 *     peerItem           OTHER's lettered beagle element (its z names beagle), and in pet beside: the owner's pet section
 *     peerInSet          OTHER's lettered beagle element in beagle's superset and showBeagles, its n naming showBeagles
 *     peerTwoOwn         OTHER's lettered beagle element whose letter has a pet section, in pet and graph beside, the
 *                        owner's pet section (no description) replacing the author's in the view
 *     peerGarbled        OTHER's, in beagle (z) and pet beside: its json tag doesn't parse
 *     peerBadOwn         OTHER's, in beagle (z) and pet: its tapestryOwnSections doesn't parse
 *     personInPet        a NostrUser in pet, beside: its pet section and no json tag
 *     fwInteger          firmware's own element, concepts/json-data-type/elements/integer.json, at the address install
 *                        gives it: in json-data-type's superset and in numericTypes, the manifest's HAS_ELEMENT edge
 *     fwNumber           firmware's number.json element, in json-data-type's superset only, and in pet beside
 *     gadgetPet          made here, gadget and pet, carrying gadget_size 5 and gadget_color green (AC9)
 *     storedPair         made here, beagle and pet, its json tag lmdb:<its tapestryKey>; storeEntries() stores
 *                        STORED_PAIR_JSON
 *     doubleJson         made here, beagle and pet, with two json tags that differ
 *
 * keys and uuids name each node as the base seeds do, and keys.luckyJsonTag names lucky's json tag node (a tag).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const U = require('./updateNodeGraph');
const C = require('./conceptGraph');
const S = require('./graphOpsSuite');
const FG = require('./fieldGraph');
const { names } = require('./todaysCreateConcept');

const { TA, OTHER } = C;
const { OWNER, ADMIN, STRANGER } = S;
const ROOT = path.resolve(__dirname, '..', '..');
const FIRMWARE = path.join(ROOT, 'firmware/versions/v1.0.0/concepts');
const dtag = require(path.join(ROOT, 'src/lib/dtag.js'));

const PERSON = '7c'.repeat(32);
const PERSON_IN_PET = '7d'.repeat(32);
const FIRST_SET = `39999:${TA}:the-set-of-neo4j-properties-that-are-also-fields`;
/** The marked fields: [concept, field], each carried as <key>_<field>. */
const MARKED = Object.freeze([['gadget', 'size'], ['gadget', 'color']]);
/** Firmware's files for its own elements in this seed, as X.firmwareElements maps their addresses. */
const FIRMWARE_FILES = Object.freeze({
  rover: 'concepts/dog/elements/rover.json',
  integer: 'concepts/json-data-type/elements/integer.json',
  number: 'concepts/json-data-type/elements/number.json',
  manifest: 'concepts/json-data-type/manifest.json',
});

const hex = (x) => crypto.createHash('sha256').update(String(x)).digest('hex');
const fwJson = (...parts) => JSON.parse(fs.readFileSync(path.join(FIRMWARE, ...parts), 'utf8'));
/** The name install gives an element file: word.name after its last colon, else its section's name, else word.slug. */
function installName(data) {
  const word = data.word || {};
  const key = Object.keys(data).filter((k) => k !== 'word')[0];
  const raw = typeof word.name === 'string' && word.name.includes(':') ? word.name.split(':').pop() : ((data[key] || {}).name || word.slug);
  return String(raw).trim();
}

async function seedMemberships() {
  const seed = await U.seedUpdateNode();
  const s = seed.state;
  const keys = seed.keys;
  const uuids = seed.uuids;

  const add = (labels, props) => { const n = { eid: s.nextEid++, labels: [...new Set(labels)], props: { ...props } }; if (!n.props.tapestryKey) n.props.tapestryKey = crypto.randomUUID(); s.nodes.push(n); return n; };
  const link = (a, type, b) => { s.rels.push({ eid: s.nextEid++, type, from: a.eid, to: b.eid, props: {} }); };
  const nodeOf = (key) => s.nodes.find((n) => n.props.tapestryKey === key) || null;
  const named = (name, n) => { keys[name] = n.props.tapestryKey; if (n.props.uuid) uuids[name] = n.props.uuid; return n; };
  const tag = (node, t, i) => {
    const props = { uuid: C.tagUuid(node.props.uuid || node.props.tapestryKey, t, i), type: t[0], value: t[1] === undefined ? '' : t[1], tapestryKey: crypto.randomUUID() };
    if (t[2]) props.value1 = t[2];
    if (t[3]) props.value2 = t[3];
    link(node, 'HAS_TAG', add(['NostrEventTag', 'TapestryNode'], props));
  };
  const tagNodes = (node) => s.rels.filter((r) => r.from === node.eid && r.type === 'HAS_TAG').map((r) => s.nodes.find((n) => n.eid === r.to));
  /** A node as the import leaves an event, not an element: NostrEvent, ListHeader or ListItem, an id, its tags. */
  const letter = ({ uuid, kind = 39999, tags, roleLabels = [], author = TA, extraProps = {} }) => {
    const nameTag = tags.find((t) => t[0] === 'name') || tags.find((t) => t[0] === 'names') || [];
    const n = add(['NostrEvent', kind === 39998 ? 'ListHeader' : 'ListItem', ...roleLabels, 'TapestryNode'], { uuid, kind, pubkey: author, name: nameTag[1] || '', created_at: 1763000000, id: hex(`event ${uuid}`), ...extraProps });
    tags.forEach((t, i) => tag(n, t, i));
    return n;
  };

  // The concepts the new nodes belong to: slug, singular name and title, key and address.
  const concept = (slug, singular, plural, key, headerKey) => ({ slug, singular, title: names(singular, plural).oTitles.singular, key, uuid: nodeOf(headerKey).props.uuid });
  const BEAGLE = concept('beagle', 'beagle', 'beagles', 'beagle', keys.beagle);
  const PET = concept('pet', 'pet', 'pets', 'pet', keys.pet);
  const GADGET = concept('gadget', 'gadget', 'gadgets', 'gadget', keys.gadget);
  const DOG = { slug: 'dog', singular: 'dog', title: 'Dog', key: 'dog', uuid: `39998:${TA}:dog` };
  const GOLDEN = { slug: 'golden-retriever', singular: 'golden retriever', title: 'Golden Retriever', key: 'goldenRetriever', uuid: `39998:${TA}:golden-retriever` };
  const wordOf = (c, name, types) => ({ slug: `${c.slug}--${dtag.slug(name)}`, name: `${c.singular}: ${name}`, title: `${c.title}: ${name}`, wordTypes: ['word', ...types] });
  const sectionOf = (c, name, extra = {}) => ({ name, slug: dtag.slug(name), description: `${name}, a ${c.singular}`, ...extra });
  const beside = (sections) => ({ tapestryOwnSections: JSON.stringify(sections) });

  /**
   * One element of `c` named `name`, under each of `holders`. Lettered when `lettered`, else made here. Its JSON is
   * create-element's word block and `sections` (c's section by default) unless `json` gives the text (null: no json
   * tag). Its tags are d, name, z naming c, and json, unless `tags({ d, uuid, text })` gives them.
   */
  function element({ c, name, holders = [], author = TA, lettered = false, sections = null, types = null, json, tags = null, extraProps = {}, key = null }) {
    const d = dtag.childDTag(name, c.uuid);
    const uuid = `39999:${author}:${d}`;
    const text = json !== undefined ? json : JSON.stringify({ word: wordOf(c, name, types || [c.key]), ...(sections || { [c.key]: sectionOf(c, name) }) });
    const props = lettered
      ? { uuid, kind: 39999, pubkey: author, name, created_at: 1763000000, id: hex(`event ${uuid}`), ...extraProps }
      : { uuid, kind: 39999, pubkey: author, name, tapestryValue: name, created_at: 1763000000, ...extraProps };
    if (key) props.tapestryKey = key;
    const n = add([...(lettered ? ['NostrEvent'] : []), 'ListItem', 'TapestryNode'], props);
    const list = tags ? tags({ d, uuid, text }) : [['d', d], ['name', name], ['z', c.uuid], ...(text === null ? [] : [['json', text]])];
    list.forEach((t, i) => tag(n, t, i));
    for (const h of holders) link(h, 'HAS_ELEMENT', n);
    return n;
  }

  const beagleSup = nodeOf(keys.beagleSuperset);
  const petSup = nodeOf(keys.petSuperset);
  const gadgetSup = nodeOf(keys.gadgetSuperset);
  const grSup = nodeOf(keys.goldenRetrieverSuperset);
  const walkers = nodeOf(keys.walkers);
  const showBeagles = nodeOf(keys.showBeagles);
  const graphSup = nodeOf(keys.supersets.graph);
  const wordSup = nodeOf(keys.supersets.word);
  const propertySup = nodeOf(keys.supersets.property);

  keys.luckyJsonTag = tagNodes(nodeOf(keys.lucky)).find((t) => t.props.type === 'json').props.tapestryKey;

  // ── json-data-type: firmware's concept, its numeric set, and two of its element files ──
  const jdtHeader = named('jsonDataType', letter({ uuid: `39998:${TA}:json-data-type`, kind: 39998, tags: [['d', 'json-data-type'], ['names', 'JSON data type', 'JSON data types'], ['slug', 'json-data-type'], ['json', JSON.stringify(fwJson('json-data-type', 'concept-header.json'))]], roleLabels: ['ConceptHeader'] }));
  const jdtSup = named('jsonDataTypeSuperset', letter({ uuid: `39999:${TA}:json-data-type-superset`, tags: [['d', 'json-data-type-superset'], ['name', 'superset for the concept of JSON data types']], roleLabels: ['Superset'] }));
  link(jdtHeader, 'IS_THE_CONCEPT_FOR', jdtSup);
  const numericFile = fwJson('json-data-type', 'sets', 'numeric-types.json');
  const numeric = named('numericTypes', letter({ uuid: `39999:${TA}:${numericFile.word.slug}`, tags: [['d', numericFile.word.slug], ['name', numericFile.set.name], ['json', JSON.stringify(numericFile)]], roleLabels: ['Set'] }));
  link(jdtSup, 'IS_A_SUPERSET_OF', numeric);
  const fwElement = (file, holders, extraProps = {}) => {
    const data = fwJson('json-data-type', 'elements', file);
    const name = installName(data);
    const uuid = U.firmwareElementAddress(name, 'json-data-type');
    const n = letter({ uuid, tags: [['d', uuid.split(':').slice(2).join(':')], ['name', name], ['z', jdtHeader.props.uuid], ['json', JSON.stringify(data)]], extraProps });
    for (const h of holders) link(h, 'HAS_ELEMENT', n);
    return n;
  };
  named('fwInteger', fwElement('integer.json', [jdtSup, numeric]));
  named('fwNumber', fwElement('number.json', [jdtSup, petSup], beside({ pet: { name: 'number', slug: 'number', description: 'a JSON data type, filed as a pet by the owner' } })));

  // ── the relationship concept, for the relationship event today's add-to-set signs ──
  const relHeader = named('relationship', letter({ uuid: `39998:${TA}:relationship`, kind: 39998, tags: [['d', 'relationship'], ['names', 'relationship', 'relationships'], ['slug', 'relationship'], ['json', JSON.stringify({ conceptHeader: { oNames: { singular: 'relationship', plural: 'relationships' }, oKeys: { singular: 'relationship', plural: 'relationships' } } })]], roleLabels: ['ConceptHeader'] }));
  const relSup = named('relationshipSuperset', letter({ uuid: `39999:${TA}:relationship-superset`, tags: [['d', 'relationship-superset'], ['name', 'superset for the concept of relationships']], roleLabels: ['Superset'] }));
  link(relHeader, 'IS_THE_CONCEPT_FOR', relSup);

  // ── the marks: the concept of neo4j properties, its first set, and gadget's size and color ──
  const n4jHeader = named('neo4jProperty', letter({ uuid: `39998:${TA}:neo4j-property`, kind: 39998, tags: [['d', 'neo4j-property'], ['names', 'neo4j property', 'neo4j properties'], ['slug', 'neo4j-property'], ['json', JSON.stringify({ conceptHeader: { oNames: { singular: 'neo4j property', plural: 'neo4j properties' }, oKeys: { singular: 'neo4jProperty', plural: 'neo4jProperties' } } })]], roleLabels: ['ConceptHeader'] }));
  const n4jSup = named('neo4jPropertySuperset', letter({ uuid: `39999:${TA}:neo4j-property-superset`, tags: [['d', 'neo4j-property-superset'], ['name', 'superset for the concept of neo4j properties']], roleLabels: ['Superset'] }));
  link(n4jHeader, 'IS_THE_CONCEPT_FOR', n4jSup);
  const firstSet = named('firstSet', letter({ uuid: FIRST_SET, tags: [['d', 'the-set-of-neo4j-properties-that-are-also-fields'], ['name', 'neo4j properties that are also fields']], roleLabels: ['Set'] }));
  link(n4jSup, 'IS_A_SUPERSET_OF', firstSet);
  const gadgetHeader = nodeOf(keys.gadget);
  const ppRel = s.rels.find((r) => r.type === 'IS_THE_PRIMARY_PROPERTY_FOR' && r.to === gadgetHeader.eid);
  if (!ppRel) throw new Error("membershipGraph: gadget has no primary property to hang its marked fields on");
  const gadgetPp = s.nodes.find((n) => n.eid === ppRel.from);
  keys.gadgetPrimaryProperty = gadgetPp.props.tapestryKey;
  for (const [, field] of MARKED) {
    const prop = named(`gadget${field[0].toUpperCase()}${field.slice(1)}Property`, letter({ uuid: `39999:${TA}:gadget-${field}`, tags: [['d', `gadget-${field}`], ['name', field], ['json', JSON.stringify({ word: { slug: field, name: field, wordTypes: ['word', 'property'] }, property: { name: field, type: field === 'size' ? 'integer' : 'string' } })]], roleLabels: ['Property'] }));
    link(prop, 'IS_A_PROPERTY_OF', gadgetPp);
    link(propertySup, 'HAS_ELEMENT', prop);
    link(firstSet, 'HAS_ELEMENT', prop);
  }

  // ── a set word's class thread holds, beside beagle's ──
  const commonSet = named('commonSet', add(['ListItem', 'Set', 'TapestryNode'], { uuid: `39999:${TA}:common-words`, kind: 39999, pubkey: TA, name: 'common words', tapestryValue: 'common words', created_at: 1763000000 }));
  link(beagleSup, 'IS_A_SUPERSET_OF', commonSet);
  link(wordSup, 'IS_A_SUPERSET_OF', commonSet);

  // ── add-to-concept ──
  named('fetch', element({ c: BEAGLE, name: 'Fetch', holders: [beagleSup] }));
  named('personNode', add(['NostrUser', 'TapestryNode'], { pubkey: PERSON }));
  named('placeholder', add(['NostrEvent', 'TapestryNode'], { uuid: `39999:${OTHER}:far-away`, kind: 39999, pubkey: OTHER }));
  named('peerLucky', element({ c: PET, name: 'Lucky', holders: [petSup], author: OTHER, lettered: true }));
  named('peerStale', element({ c: BEAGLE, name: 'Peer Stale', holders: [beagleSup], author: OTHER, lettered: true, sections: { beagle: sectionOf(BEAGLE, 'Peer Stale'), pet: { name: 'Peer Stale', slug: 'peer-stale', description: "the author's words", color: 'brown' } } }));
  named('stale', element({ c: BEAGLE, name: 'Stale', holders: [beagleSup], sections: { beagle: sectionOf(BEAGLE, 'Stale'), pet: { name: 'Stale', slug: 'stale', description: 'left over', color: 'grey' } } }));
  named('markMe', element({ c: BEAGLE, name: 'Mark Me', holders: [beagleSup] }));
  const storedKey = crypto.randomUUID();
  named('stored', element({ c: BEAGLE, name: 'Stored', holders: [beagleSup], json: `lmdb:${storedKey}`, key: storedKey }));
  named('commandBeagle', element({ c: BEAGLE, name: 'Command Beagle', holders: [beagleSup] }));
  named('petLucky', element({ c: PET, name: 'lucky', holders: [petSup] }));
  named('petOdie', element({ c: PET, name: 'Odie', holders: [petSup] }));
  named('petPatch', element({ c: PET, name: 'Patch', holders: [petSup] }));
  named('petSnowy', element({ c: PET, name: 'Snowy', holders: [petSup] }));

  // ── remove-from-concept ──
  /** Made here, an element of beagle and of pet, with both sections and a z naming each. */
  const twoConcepts = (name, extraProps = {}) => element({
    c: BEAGLE, name, holders: [beagleSup, petSup], types: ['beagle', 'pet'], extraProps,
    sections: { beagle: sectionOf(BEAGLE, name), pet: sectionOf(PET, name) },
    tags: ({ d, text }) => [['d', d], ['name', name], ['z', BEAGLE.uuid], ['z', PET.uuid], ['json', text]],
  });
  named('twoHome', twoConcepts('Two Home'));
  named('roundTrip', twoConcepts('Round Trip'));
  named('pair', twoConcepts('Pair', { tapestryJsonUpdatedAt: 1763000005 }));
  named('cliPair', twoConcepts('Command Pair'));
  named('adminPair', twoConcepts('Admin Pair'));

  const setItem = named('setItem', element({
    c: BEAGLE, name: 'Set Item', holders: [beagleSup, showBeagles], lettered: true,
    tags: ({ d, text }) => [['d', d], ['name', 'Set Item'], ['z', BEAGLE.uuid], ['n', showBeagles.props.uuid], ['json', text]],
  }));
  const relD = hex('show beagles HAS_ELEMENT Set Item').slice(0, 16);
  const relEvent = named('relEvent', letter({ uuid: `39999:${TA}:${relD}`, tags: [['d', relD], ['name', `show beagles HAS_ELEMENT Set Item`], ['z', relHeader.props.uuid], ['nodeFrom', showBeagles.props.uuid], ['nodeTo', setItem.props.uuid], ['relationshipType', 'HAS_ELEMENT']] }));
  link(relSup, 'HAS_ELEMENT', relEvent);

  named('goldie', element({
    c: GOLDEN, name: 'Goldie', holders: [grSup, petSup], types: ['dog', 'goldenRetriever', 'pet'],
    sections: { dog: { name: 'Goldie', slug: 'goldie', breed: 'goldenRetriever' }, goldenRetriever: { slug: 'goldie' }, pet: sectionOf(PET, 'Goldie') },
    tags: ({ d, text }) => [['d', d], ['name', 'Goldie'], ['z', GOLDEN.uuid], ['z', PET.uuid], ['json', text]],
  }));
  named('walkerBella', element({
    c: BEAGLE, name: 'Bella', holders: [beagleSup, walkers], types: ['beagle', 'dog', 'pet'],
    sections: { beagle: sectionOf(BEAGLE, 'Bella'), dog: { name: 'Bella', slug: 'bella' } },
    tags: ({ d, text }) => [['d', d], ['name', 'Bella'], ['z', BEAGLE.uuid], ['z', DOG.uuid], ['n', walkers.props.uuid], ['json', text]],
  }));
  named('wordy', element({
    c: BEAGLE, name: 'Wordy', holders: [commonSet, petSup], types: ['beagle', 'pet'],
    sections: { beagle: sectionOf(BEAGLE, 'Wordy'), pet: sectionOf(PET, 'Wordy') },
    tags: ({ d, text }) => [['d', d], ['name', 'Wordy'], ['z', BEAGLE.uuid], ['z', PET.uuid], ['json', text]],
  }));
  named('commonOnly', element({ c: BEAGLE, name: 'Common Only', holders: [commonSet] }));

  named('peerItem', element({ c: BEAGLE, name: 'Peer Item', holders: [beagleSup, petSup], author: OTHER, lettered: true, extraProps: beside({ pet: { name: 'Peer Item', slug: 'peer-item', description: 'filed under pet by the owner' } }) }));
  named('peerInSet', element({
    c: BEAGLE, name: 'Peer In Set', holders: [beagleSup, showBeagles], author: OTHER, lettered: true,
    tags: ({ d, text }) => [['d', d], ['name', 'Peer In Set'], ['z', BEAGLE.uuid], ['n', showBeagles.props.uuid], ['json', text]],
  }));
  named('peerTwoOwn', element({
    c: BEAGLE, name: 'Peer Two', holders: [beagleSup, petSup, graphSup], author: OTHER, lettered: true,
    sections: { beagle: sectionOf(BEAGLE, 'Peer Two'), pet: { name: 'Peer Two', slug: 'peer-two', description: "the author's own pet words" } },
    extraProps: beside({ pet: { name: 'Peer Two', slug: 'peer-two', color: 'brown' }, graph: { name: 'Peer Two', slug: 'peer-two' } }),
  }));
  named('peerGarbled', element({ c: BEAGLE, name: 'Peer Garbled', holders: [beagleSup, petSup], author: OTHER, lettered: true, json: '{"beagle": {"name": ', extraProps: beside({ pet: { name: 'Peer Garbled', slug: 'peer-garbled', description: 'filed under pet by the owner' } }) }));
  named('peerBadOwn', element({ c: BEAGLE, name: 'Peer Bad Own', holders: [beagleSup, petSup], author: OTHER, lettered: true, extraProps: { tapestryOwnSections: 'not JSON at all' } }));
  const personInPet = named('personInPet', add(['NostrUser', 'TapestryNode'], { pubkey: PERSON_IN_PET, ...beside({ pet: { name: 'Bob', slug: 'bob', description: 'a person, filed as a pet by the owner' } }) }));
  link(petSup, 'HAS_ELEMENT', personInPet);

  named('gadgetPet', element({
    c: GADGET, name: 'Gadget Pet', holders: [gadgetSup, petSup], types: ['gadget', 'pet'],
    sections: { gadget: { name: 'Gadget Pet', slug: 'gadget-pet', size: 5, color: 'green' }, pet: sectionOf(PET, 'Gadget Pet') },
    tags: ({ d, text }) => [['d', d], ['name', 'Gadget Pet'], ['z', GADGET.uuid], ['z', PET.uuid], ['json', text]],
    extraProps: { gadget_size: { $int: '5' }, gadget_color: 'green' },
  }));
  const storedPairKey = crypto.randomUUID();
  named('storedPair', element({
    c: BEAGLE, name: 'Stored Pair', holders: [beagleSup, petSup], key: storedPairKey, json: `lmdb:${storedPairKey}`,
    tags: ({ d, text }) => [['d', d], ['name', 'Stored Pair'], ['z', BEAGLE.uuid], ['z', PET.uuid], ['json', text]],
  }));
  const doubleOne = JSON.stringify({ word: wordOf(BEAGLE, 'Double Json', ['beagle', 'pet']), beagle: sectionOf(BEAGLE, 'Double Json'), pet: sectionOf(PET, 'Double Json') });
  const doubleTwo = JSON.stringify({ word: wordOf(BEAGLE, 'Double Json', ['beagle', 'pet']), beagle: sectionOf(BEAGLE, 'Double Json', { description: 'the other one' }), pet: sectionOf(PET, 'Double Json') });
  named('doubleJson', element({
    c: BEAGLE, name: 'Double Json', holders: [beagleSup, petSup],
    tags: ({ d }) => [['d', d], ['name', 'Double Json'], ['z', BEAGLE.uuid], ['z', PET.uuid], ['json', doubleOne], ['json', doubleTwo]],
  }));

  const stored = {
    [keys.stored]: { word: wordOf(BEAGLE, 'Stored', ['beagle']), beagle: { name: 'Stored', slug: 'stored', description: 'its JSON is in the store' } },
    [keys.storedPair]: { word: wordOf(BEAGLE, 'Stored Pair', ['beagle', 'pet']), beagle: sectionOf(BEAGLE, 'Stored Pair'), pet: sectionOf(PET, 'Stored Pair') },
  };

  return {
    ...seed,
    state: s,
    keys,
    uuids,
    concepts: { BEAGLE, PET, GADGET, DOG, GOLDEN },
    /** The JSON the store holds for stored and storedPair, by tapestryKey. */
    stored,
    /** Store that JSON under <dir>/lmdb, the store a harness run in <dir> reads. */
    storeEntries(dir) { FG.seedLmdb(dir, Object.entries(stored)); },
  };
}

module.exports = { TA, OTHER, OWNER, ADMIN, STRANGER, PERSON, PERSON_IN_PET, FIRST_SET, MARKED, FIRMWARE_FILES, installName, seedMemberships };
