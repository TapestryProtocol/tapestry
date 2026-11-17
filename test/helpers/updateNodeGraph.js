'use strict';
/**
 * The graph the update-node suites seed for test/helpers/graphFake.js (story graph-operations-first-slice #21, ADR
 * graph-operations-first-slice/0021). It starts from create-element's seed, test/helpers/createElementGraph.js, which
 * says what that graph holds (beagle with rover, lucky, odie and the rest, OTHER's snowy; dog, golden retriever and pet,
 * with walkers under dog's and pet's supersets; gadget, scroll, word, graph context, firmware's graph rule; loner and G),
 * and adds, by the name the suites use. "Made here" is a node with no letter, as create-element makes one: labels
 * ListItem and TapestryNode, no id, its name its tapestryValue. "Lettered" is one the import made of an event.
 *
 *   whose node it is (ADR 0021 Decision 3)
 *     patch        an element of beagle lettered by the OWNER: the instance's own (the owner's answer, open question 3)
 *     ace          an element of beagle lettered by an ADMIN: someone else's
 *     drifter      an element of beagle made with no letter whose recorded author is a STRANGER: someone else's
 *     ghosty       an element of beagle made here with no author at all: the instance's own
 *   the node's kind (Decision 4)
 *     firmwareRover  firmware's own element, dog's rover, at the address install gives concepts/dog/elements/rover.json
 *                  (today's create-element's d-tag for the name Rover under 39998:<TA>:dog), lettered, under dog's
 *                  superset, its JSON the file's
 *     propertyNode an element of the property concept alone (graph update-property, A10.18)
 *     ruleElement  an element of the graph rule concept (the rulebook)
 *     wordOnly     a node only word's class thread reaches
 *     walkers      made an element of the set concept here, as add-subset registers a set (A10.21.a)
 *   several concepts (Decisions 4, 6 and 10)
 *     walkerMax    made here in walkers, so an element of dog and of pet, with a dog section only
 *     whiskers     made here, an element of pet
 *     sharedSet    a set under pet's superset and gadget's
 *     twoFaced     made here in sharedSet, with a pet section that lacks pet's required description and a gadget
 *                  section that lacks gadget's required size
 *   sections (Decisions 8 and 9)
 *     gizmo        made here, an element of gadget: { name, slug, size: 2 }
 *     bare         made here, beagle: its section holds a description and no name or slug
 *     oddSlug      made here, beagle, named Oddslug: its section's slug is odd-one, not the slug its name gives
 *     handy        made here, beagle, named Handy: its section's name was edited by hand to Hand Edited
 *     tagless      made here, beagle, named Tagless, with no name tag (d, z and json)
 *     stamped      made here, beagle, named Stamped, which the derive step has cached (tapestryJsonUpdatedAt)
 *   JSON that can't be read (Decision 7)
 *     mute (no json tag), twofer (two json tags that differ), garble (JSON that doesn't parse), phantom (an LMDB
 *     reference whose entry is missing), listy (a list, not an object): each made here, an element of beagle
 *   scrolled       made here, an element of scroll, the concept with no schema node
 *
 * Every node made here by the assistant gets create-element's word block: <concept slug>--<slug>, "<concept>: <name>",
 * "<Concept>: <name>" and the wordTypes of its concepts. keys and uuids name each node, as createElementGraph's do.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const E = require('./createElementGraph');
const C = require('./conceptGraph');
const S = require('./graphOpsSuite');
const { names } = require('./todaysCreateConcept');

const { TA, OTHER } = C;
const { OWNER, ADMIN, STRANGER } = S;
const ROOT = path.resolve(__dirname, '..', '..');
const FIRMWARE = path.join(ROOT, 'firmware/versions/v1.0.0/concepts');
const dtag = require(path.join(ROOT, 'src/lib/dtag.js'));

const hex = (x) => crypto.createHash('sha256').update(String(x)).digest('hex');

/** The address firmware install gives the element file named `name` of the firmware concept `slug` (ADR 0021, fact 8). */
const firmwareElementAddress = (name, slug) => `39999:${TA}:${dtag.childDTag(name, `39998:${TA}:${slug}`)}`;

async function seedUpdateNode() {
  const seed = await E.seedCreateElement();
  const s = seed.state;
  const keys = seed.keys;
  const uuids = seed.uuids;

  const add = (labels, props) => { const n = { eid: s.nextEid++, labels: [...new Set(labels)], props: { ...props } }; if (!n.props.tapestryKey) n.props.tapestryKey = crypto.randomUUID(); s.nodes.push(n); return n; };
  const link = (a, type, b) => { s.rels.push({ eid: s.nextEid++, type, from: a.eid, to: b.eid, props: {} }); };
  const nodeOf = (key) => s.nodes.find((n) => n.props.tapestryKey === key) || null;
  const named = (name, n) => { keys[name] = n.props.tapestryKey; if (n.props.uuid) uuids[name] = n.props.uuid; return n; };
  const tag = (node, t, i) => {
    const props = { uuid: C.tagUuid(node.props.uuid, t, i), type: t[0], value: t[1] === undefined ? '' : t[1], tapestryKey: crypto.randomUUID() };
    if (t[2]) props.value1 = t[2];
    if (t[3]) props.value2 = t[3];
    link(node, 'HAS_TAG', add(['NostrEventTag', 'TapestryNode'], props));
  };
  /** The node at the far end of `key`'s first `type` relationship. */
  const target = (key, type) => { const from = nodeOf(key); const r = from && s.rels.find((x) => x.from === from.eid && x.type === type); return r ? s.nodes.find((n) => n.eid === r.to) : null; };

  // The concepts the new nodes belong to: slug, singular name and title (as headerOf gives them), key and address.
  const concept = (slug, singular, plural, key, headerKey) => ({ slug, singular, title: names(singular, plural).oTitles.singular, key, uuid: nodeOf(headerKey).props.uuid });
  const BEAGLE = concept('beagle', 'beagle', 'beagles', 'beagle', keys.beagle);
  const PET = concept('pet', 'pet', 'pets', 'pet', keys.pet);
  const GADGET = concept('gadget', 'gadget', 'gadgets', 'gadget', keys.gadget);
  const DOG = { slug: 'dog', singular: 'dog', title: 'Dog', key: 'dog', uuid: `39998:${TA}:dog` };
  const SCROLL = { slug: 'scroll', singular: 'scroll', title: 'Scroll', key: 'scroll', uuid: `39998:${TA}:scroll` };

  /** create-element's word block for an element of `c` named `name`, whose concepts' keys are `types`. */
  const wordOf = (c, name, types) => ({ slug: `${c.slug}--${dtag.slug(name)}`, name: `${c.singular}: ${name}`, title: `${c.title}: ${name}`, wordTypes: ['word', ...types] });

  /**
   * One element under `holder`. Lettered (NostrEvent, an id) when `lettered`, else made here. Its JSON is create-
   * element's word block and `sections` (the concept's section by default), unless `json` gives the text. Its tags are
   * d, name, z and json unless `tags` gives them. `author` null leaves its pubkey out.
   */
  function element(holder, { c, name, author = TA, lettered = false, sections = null, types = null, json = undefined, tags = null, extraProps = {} }) {
    const d = dtag.childDTag(name, c.uuid);
    const uuid = `39999:${author || TA}:${d}`;
    const text = json !== undefined ? json : JSON.stringify({ word: wordOf(c, name, types || [c.key]), ...(sections || { [c.key]: { name, slug: dtag.slug(name), description: `${name}, a ${c.singular}` } }) });
    const props = lettered
      ? { uuid, kind: 39999, pubkey: author, name, created_at: 1763000000, id: hex(`event ${uuid}`), ...extraProps }
      : { uuid, kind: 39999, ...(author ? { pubkey: author } : {}), name, tapestryValue: name, created_at: 1763000000, ...extraProps };
    const n = add([...(lettered ? ['NostrEvent'] : []), 'ListItem', 'TapestryNode'], props);
    const list = tags || [['d', d], ['name', name], ['z', c.uuid], ...(text === null ? [] : [['json', text]])];
    list.forEach((t, i) => tag(n, t, i));
    link(holder, 'HAS_ELEMENT', n);
    return n;
  }

  const beagleSup = nodeOf(keys.beagleSuperset);
  const petSup = nodeOf(keys.petSuperset);
  const gadgetSup = target(keys.gadget, 'IS_THE_CONCEPT_FOR');
  named('gadgetSuperset', gadgetSup);

  // ── whose node it is ──
  named('patch', element(beagleSup, { c: BEAGLE, name: 'Patch', author: OWNER, lettered: true }));
  named('ace', element(beagleSup, { c: BEAGLE, name: 'Ace', author: ADMIN, lettered: true }));
  named('drifter', element(beagleSup, { c: BEAGLE, name: 'Drifter', author: STRANGER }));
  named('ghosty', element(beagleSup, { c: BEAGLE, name: 'Ghosty', author: null }));

  // ── the node's kind ──
  const roverFile = JSON.parse(fs.readFileSync(path.join(FIRMWARE, 'dog/elements/rover.json'), 'utf8'));
  const fwRoverUuid = firmwareElementAddress('Rover', 'dog');
  const fwRover = add(['NostrEvent', 'ListItem', 'TapestryNode'], { uuid: fwRoverUuid, kind: 39999, pubkey: TA, name: 'Rover', created_at: 1763000000, id: hex(`event ${fwRoverUuid}`) });
  [['d', fwRoverUuid.split(':').slice(2).join(':')], ['name', 'Rover'], ['z', DOG.uuid], ['json', JSON.stringify(roverFile)]].forEach((t, i) => tag(fwRover, t, i));
  link(nodeOf(keys.dogSuperset), 'HAS_ELEMENT', fwRover);
  named('firmwareRover', fwRover);

  // propertyNode and ruleElement are lettered, so each has a created_at, as every import gives an event (ADR
  // graph-operations-first-slice/0026 Decision 4: a NostrEvent with none is a placeholder).
  const propertyNode = named('propertyNode', add(['NostrEvent', 'ListItem', 'Property', 'TapestryNode'], { uuid: `39999:${TA}:a-loose-property`, kind: 39999, pubkey: TA, name: 'a loose property', id: hex('a loose property'), created_at: 1763000000 }));
  tag(propertyNode, ['json', JSON.stringify({ word: { slug: 'a-loose-property', wordTypes: ['word', 'property'] }, property: { name: 'a loose property', slug: 'a-loose-property' } })], 0);
  link(nodeOf(keys.supersets.property), 'HAS_ELEMENT', propertyNode);

  const ruleSup = target(keys.graphRule, 'IS_THE_CONCEPT_FOR');
  const ruleElement = named('ruleElement', add(['NostrEvent', 'ListItem', 'TapestryNode'], { uuid: `39999:${TA}:a-graph-rule`, kind: 39999, pubkey: TA, name: 'a graph rule', id: hex('a graph rule'), created_at: 1763000000 }));
  tag(ruleElement, ['json', JSON.stringify({ word: { slug: 'a-graph-rule', wordTypes: ['word', 'graphRule'] }, graphRule: { name: 'a graph rule', slug: 'a-graph-rule' } })], 0);
  link(ruleSup, 'HAS_ELEMENT', ruleElement);

  const wordOnly = named('wordOnly', add(['ListItem', 'TapestryNode'], { uuid: `39999:${TA}:only-a-word`, kind: 39999, pubkey: TA, name: 'only a word', tapestryValue: 'only a word' }));
  tag(wordOnly, ['json', JSON.stringify({ word: { slug: 'only-a-word', name: 'only a word', wordTypes: ['word'] } })], 0);
  link(nodeOf(keys.supersets.word), 'HAS_ELEMENT', wordOnly);

  // walkers, an element of the set concept, as add-subset registers a set.
  link(nodeOf(keys.supersets.set), 'HAS_ELEMENT', nodeOf(keys.walkers));

  // ── several concepts ──
  named('walkerMax', element(nodeOf(keys.walkers), { c: DOG, name: 'Max', types: ['dog', 'pet'], sections: { dog: { name: 'Max', slug: 'max' } } }));
  named('whiskers', element(petSup, { c: PET, name: 'Whiskers' }));
  const sharedSet = named('sharedSet', add(['ListItem', 'Set', 'TapestryNode'], { uuid: `39999:${TA}:shared-set`, kind: 39999, pubkey: TA, name: 'shared set', tapestryValue: 'shared set', created_at: 1763000000 }));
  link(petSup, 'IS_A_SUPERSET_OF', sharedSet);
  link(gadgetSup, 'IS_A_SUPERSET_OF', sharedSet);
  named('twoFaced', element(sharedSet, { c: PET, name: 'Two Face', types: ['pet', 'gadget'], sections: { pet: { name: 'Two Face', slug: 'two-face' }, gadget: { name: 'Two Face', slug: 'two-face' } } }));

  // ── sections ──
  named('gizmo', element(gadgetSup, { c: GADGET, name: 'Gizmo', sections: { gadget: { name: 'Gizmo', slug: 'gizmo', size: 2 } } }));
  named('bare', element(beagleSup, { c: BEAGLE, name: 'Bare', sections: { beagle: { description: 'bare' } } }));
  named('oddSlug', element(beagleSup, { c: BEAGLE, name: 'Oddslug', sections: { beagle: { name: 'Oddslug', slug: 'odd-one', description: 'its slug is not its name\'s' } } }));
  named('handy', element(beagleSup, { c: BEAGLE, name: 'Handy', sections: { beagle: { name: 'Hand Edited', slug: 'handy', description: 'named by hand' } } }));
  const taglessD = dtag.childDTag('Tagless', BEAGLE.uuid);
  const taglessJson = JSON.stringify({ word: wordOf(BEAGLE, 'Tagless', ['beagle']), beagle: { name: 'Tagless', slug: 'tagless', description: 'no name tag' } });
  named('tagless', element(beagleSup, { c: BEAGLE, name: 'Tagless', tags: [['d', taglessD], ['z', BEAGLE.uuid], ['json', taglessJson]] }));
  named('stamped', element(beagleSup, { c: BEAGLE, name: 'Stamped', extraProps: { tapestryJsonUpdatedAt: 1763000001 } }));

  // ── JSON that can't be read ──
  named('mute', element(beagleSup, { c: BEAGLE, name: 'Mute', json: null }));
  const twoD = dtag.childDTag('Twofer', BEAGLE.uuid);
  const one = JSON.stringify({ word: wordOf(BEAGLE, 'Twofer', ['beagle']), beagle: { name: 'Twofer', slug: 'twofer', description: 'one' } });
  const two = JSON.stringify({ word: wordOf(BEAGLE, 'Twofer', ['beagle']), beagle: { name: 'Twofer', slug: 'twofer', description: 'two' } });
  named('twofer', element(beagleSup, { c: BEAGLE, name: 'Twofer', tags: [['d', twoD], ['name', 'Twofer'], ['z', BEAGLE.uuid], ['json', one], ['json', two]] }));
  named('garble', element(beagleSup, { c: BEAGLE, name: 'Garble', json: '{"beagle": {"name": ' }));
  named('phantom', element(beagleSup, { c: BEAGLE, name: 'Phantom', json: `lmdb:${hex('an entry nothing stores, for update-node')}` }));
  named('listy', element(beagleSup, { c: BEAGLE, name: 'Listy', json: '[1, 2]' }));

  named('scrolled', element(nodeOf(keys.scrollSuperset), { c: SCROLL, name: 'Scrolled', sections: { scroll: { name: 'Scrolled', slug: 'scrolled' } } }));

  return { ...seed, state: s, keys, uuids };
}

module.exports = { TA, OTHER, OWNER, ADMIN, STRANGER, seedUpdateNode, firmwareElementAddress };
