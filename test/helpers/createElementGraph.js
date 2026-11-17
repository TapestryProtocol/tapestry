'use strict';
/**
 * The graph the create-element suites seed for test/helpers/graphFake.js (story graph-operations-first-slice #20, ADR
 * graph-operations-first-slice/0020). Named so it can't collide with list-elements' elementsGraph.js.
 *
 * seedCreateElement() → Promise<{ state, keys, uuids, file(dir) }>. It starts from story 16's seed, conceptGraph.js's
 * seedConcepts: the twelve firmware concepts a concept's nodes join (each a lettered header at 39998:<TA>:<slug> and its
 * superset, with no JSON schema node); beagle, this instance's own, exactly as today's create-concept makes it, with its
 * element rover ('Rover', 'a good beagle'); nostr relay, another author's (OTHER); and twelve widget headers by others,
 * with no superset. To that it adds, by the name the suites use (TA, OWNER and OTHER as graphOpsSuite and conceptGraph
 * give them; "A ─▶ B" is a class-thread link, A one of B's parents):
 *
 *   beagle    its schema is today's create-concept's: a beagle section whose name, slug and description are required,
 *             each text. Its header has a b pointer to the nostr relay concept (OTHER's), which today's create-element
 *             would stamp as a second z tag (ADR 0020 Decision 9: no stamps). Under its superset, besides rover: showBeagles, a set; lucky ('Lucky', own, in showBeagles);
 *             odie (own, at the address the name Odie gives, named 'Odie!'); pluto (own, at Pluto's address with ~1,
 *             named 'Planet Pluto'); twinNonced (own, 'Twin', at Twin's address with ~2, the lowest key) and twinPlain
 *             (own, 'Twin', at Twin's address, the highest key); echoLow (own, 'Echo', at Echo's address with ~2, the
 *             lowest key) and echoHigh (own, 'Echo', at ~1, the highest); snowy ('Snowy', OTHER's). In no class thread:
 *             biscuitHolder, a node at the address the name Biscuit gives, and crowd0 to crowd99, at Crowd's address and
 *             each nonce to ~99.
 *   dog       firmware's own shape (39998:<TA>:dog): its header's and its schema's JSON are firmware's files
 *             (firmware/versions/v1.0.0/concepts/dog), so its schema names draft 2020-12 and ties dog.breed to
 *             word.wordTypes. dog ─▶ goldenRetrieverSuperset (the golden retriever concept's superset, its JSON firmware's
 *             too: a goldenRetriever section is required), and dog ─▶ walkers, a set also under pet.
 *   pet       own, as today's create-concept makes it; pet ─▶ walkers, and pet ─▶ lapPets, a set of pet's only.
 *   gadget    own; its section requires name, slug and size (an integer), takes color (red or green), and nothing else.
 *   survey    own; its section requires q01 to q25, each text, besides name and slug.
 *   sameIdA, sameIdB  own, as today's shape, their schemas sharing one $id.
 *   teapot (its schema's JSON doesn't parse), kettle (two schema nodes), lantern (an LMDB reference whose entry is
 *             missing), compass (a schema that doesn't compile), scroll (no schema node: a header and a superset):
 *             each refused no-schema. word (firmware's, with no schema node) has none either.
 *   otherWord another author's concept named word (39998:<OTHER>:word), its key word, with a schema that takes any
 *             object; graphContextConcept, own, named "graph context", its key graphContext, the same. With word, each
 *             is refused reserved-key: an element's JSON keeps both keys for itself (ADR 0020 Amendment 1, item 2).
 *   relationshipType  firmware's (39998:<TA>:relationship-type), with a schema: a firmware concept that takes an element.
 *   graph     firmware's (seeded), given a schema that takes any object: a firmware concept that stays open.
 *   graphRule firmware's (39998:<TA>:graph-rule): made elsewhere, by the rulebook.
 *   otherSet  another author's concept named set (39998:<OTHER>:set), as today's shape: not firmware's, so it takes one.
 *   loner     a node of no concept; G, a change entry.
 *
 * keys names each node's tapestryKey: those above, plus conceptGraph's (beagle, relay, rover, widgets, word,
 * conceptHeader, supersets[<slug>]), and fw[<slug>], each firmware concept's header. uuids names each node's address.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { writeState } = require('./graphFake');
const C = require('./conceptGraph');
const { todaysConcept } = require('./todaysCreateConcept');

const { TA, OTHER } = C;
const ROOT = path.resolve(__dirname, '..', '..');
const FIRMWARE = path.join(ROOT, 'firmware/versions/v1.0.0/concepts');
const dtag = require(path.join(ROOT, 'src/lib/dtag.js'));

const hex = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const firmwareJson = (concept, file) => JSON.parse(fs.readFileSync(path.join(FIRMWARE, concept, file), 'utf8'));
/** The address today's create-element gives an element of the concept at `headerUuid` (dtag.childDTag), with a nonce. */
const elementAddress = (name, headerUuid, nonce = null) => `39999:${TA}:${dtag.childDTag(name, headerUuid, nonce === null ? undefined : nonce)}`;

async function seedCreateElement() {
  const seed = await C.seedConcepts();
  const s = seed.state;
  const keys = { ...seed.keys, fw: {} };
  const uuids = {};

  const add = (labels, props) => { const n = { eid: s.nextEid++, labels: [...new Set(labels)], props: { ...props } }; if (!n.props.tapestryKey) n.props.tapestryKey = crypto.randomUUID(); s.nodes.push(n); return n; };
  const link = (a, type, b) => { s.rels.push({ eid: s.nextEid++, type, from: a.eid, to: b.eid, props: {} }); };
  const byUuid = (uuid) => s.nodes.find((n) => n.props.uuid === uuid) || null;
  const named = (name, n) => { keys[name] = n.props.tapestryKey; if (n.props.uuid) uuids[name] = n.props.uuid; return n; };
  const tag = (node, t, i) => {
    const props = { uuid: C.tagUuid(node.props.uuid, t, i), type: t[0], value: t[1] === undefined ? '' : t[1] };
    if (t[2]) props.value1 = t[2];
    if (t[3]) props.value2 = t[3];
    link(node, 'HAS_TAG', add(['NostrEventTag', 'TapestryNode'], props));
  };
  const tagNode = (node, type) => s.rels.filter((r) => r.from === node.eid && r.type === 'HAS_TAG').map((r) => s.nodes.find((x) => x.eid === r.to)).find((t) => t && t.props.type === type) || null;
  /** A node as the import leaves an event: NostrEvent, ListHeader or ListItem, an id, its tags. */
  const lettered = ({ uuid, kind = 39999, tags, roleLabels = [], author = TA, tapestryKey = null }) => {
    const nameTag = tags.find((t) => t[0] === 'name') || tags.find((t) => t[0] === 'names') || [];
    const n = add(['NostrEvent', kind === 39998 ? 'ListHeader' : 'ListItem', ...roleLabels, 'TapestryNode'], { uuid, kind, pubkey: author, name: nameTag[1] || '', created_at: 1763000000, id: hex(`event ${uuid}`), ...(tapestryKey ? { tapestryKey } : {}) });
    tags.forEach((t, i) => tag(n, t, i));
    return n;
  };
  /** A set with no event, as add-subset makes one. */
  const eventlessSet = (uuid, name) => add(['ListItem', 'Set', 'TapestryNode'], { uuid, kind: 39999, pubkey: TA, name, tapestryValue: name, created_at: 1763000000 });

  /** A concept exactly as today's create-concept makes it, lettered and wired; `edit(json, role)` may change a node's JSON. */
  async function todays(name, plural, { author = TA, edit = null } = {}) {
    const made = await todaysConcept({ name, plural, ta: author });
    const d = made.events[0].uuid.split(':').slice(2).join(':');
    const nodes = {};
    const SUFFIX = { superset: 'superset', schema: 'jsonSchema', 'primary-property': 'primaryProperty', properties: 'properties', 'property-tree-graph': 'propertyTreeGraph', 'concept-graph': 'conceptGraph', 'core-nodes-graph': 'coreNodesGraph' };
    for (const e of made.events) {
      const role = e.kind === 39998 ? 'conceptHeader' : SUFFIX[e.uuid.split(':').slice(2).join(':').slice(d.length + 1)];
      const tags = e.tags.map((t) => {
        if (t[0] !== 'json' || !edit) return t;
        const json = JSON.parse(t[1]);
        edit(json, role);
        return ['json', JSON.stringify(json), ...t.slice(2)];
      });
      nodes[role] = lettered({ uuid: e.uuid, kind: e.kind, tags, roleLabels: (made.labels[e.uuid] || []).filter((l) => l !== 'ListHeader'), author });
    }
    for (const w of made.wiring) { const [a, b] = [byUuid(w.from), byUuid(w.to)]; if (a && b) link(a, w.type, b); }
    for (const m of made.memberships) { const sup = byUuid(m.superset); if (sup) link(sup, 'HAS_ELEMENT', byUuid(m.node)); }
    return nodes;
  }
  /** One of this concept's elements, lettered, with word-wrapper JSON, under `holder`. */
  function element(holder, { uuid, name, key, section, author = TA, tapestryKey = null, headerUuid }) {
    const slug = dtag.slug(name);
    const json = { word: { slug: `${key}--${slug}`, name: `${key}: ${name}`, wordTypes: ['word', key] }, [key]: { name, slug, ...section } };
    const n = lettered({ uuid, tags: [['d', uuid.split(':').slice(2).join(':')], ['name', name], ['z', headerUuid], ['json', JSON.stringify(json)]], author, tapestryKey });
    link(holder, 'HAS_ELEMENT', n);
    return n;
  }

  // ── firmware's headers, by slug ──
  for (const [slug] of C.FIRMWARE) { const h = byUuid(`39998:${TA}:${slug}`); if (h) keys.fw[slug] = h.props.tapestryKey; }

  // ── beagle ──
  const beagleHeader = C.node(s, keys.beagle);
  const beagleUuid = beagleHeader.props.uuid;
  uuids.beagle = beagleUuid;
  // A shared concept's pointer, as the dictionary's adoption writes one: untyped, so a pointer (bValueForms.js).
  const beagleTags = s.rels.filter((r) => r.from === beagleHeader.eid && r.type === 'HAS_TAG').length;
  tag(beagleHeader, ['b', C.node(s, keys.relay).props.uuid], beagleTags);
  const beagleSup = s.nodes.find((n) => n.labels.includes('Superset') && s.rels.some((r) => r.from === beagleHeader.eid && r.to === n.eid && r.type === 'IS_THE_CONCEPT_FOR'));
  named('beagleSuperset', beagleSup);
  uuids.rover = C.node(s, keys.rover).props.uuid;
  const showBeagles = named('showBeagles', eventlessSet(`39999:${TA}:show-beagles`, 'show beagles'));
  link(beagleSup, 'IS_A_SUPERSET_OF', showBeagles);
  const B = { key: 'beagle', headerUuid: beagleUuid };
  named('lucky', element(showBeagles, { ...B, uuid: elementAddress('Lucky', beagleUuid), name: 'Lucky', section: { description: 'a lucky beagle' } }));
  named('odie', element(beagleSup, { ...B, uuid: elementAddress('Odie', beagleUuid), name: 'Odie!', section: { description: 'made by an older route, with a bang' } }));
  named('pluto', element(beagleSup, { ...B, uuid: elementAddress('Pluto', beagleUuid, 1), name: 'Planet Pluto', section: { description: 'at a nonce' } }));
  named('twinNonced', element(beagleSup, { ...B, uuid: elementAddress('Twin', beagleUuid, 2), name: 'Twin', section: { description: 'the nonced twin' }, tapestryKey: '00000000-0000-4000-8000-000000000001' }));
  named('twinPlain', element(beagleSup, { ...B, uuid: elementAddress('Twin', beagleUuid), name: 'Twin', section: { description: 'the plain twin' }, tapestryKey: 'ffffffff-ffff-4fff-bfff-fffffffffff1' }));
  named('echoHigh', element(beagleSup, { ...B, uuid: elementAddress('Echo', beagleUuid, 1), name: 'Echo', section: { description: 'the higher key' }, tapestryKey: 'ffffffff-ffff-4fff-bfff-fffffffffff2' }));
  named('echoLow', element(beagleSup, { ...B, uuid: elementAddress('Echo', beagleUuid, 2), name: 'Echo', section: { description: 'the lower key' }, tapestryKey: '00000000-0000-4000-8000-000000000002' }));
  named('snowy', element(beagleSup, { ...B, uuid: `39999:${OTHER}:${dtag.childDTag('Snowy', beagleUuid)}`, name: 'Snowy', section: { description: "another author's" }, author: OTHER }));
  named('biscuitHolder', add(['ListItem', 'TapestryNode'], { uuid: elementAddress('Biscuit', beagleUuid), kind: 39999, pubkey: TA, name: 'not a beagle' }));
  for (let i = 0; i < 100; i++) named(`crowd${i}`, add(['ListItem', 'TapestryNode'], { uuid: elementAddress('Crowd', beagleUuid, i ? i : null), kind: 39999, pubkey: TA, name: `crowd ${i}` }));

  // ── dog and golden retriever: firmware's own JSON ──
  const fwConcept = (slug, roleKey) => {
    const header = named(roleKey, lettered({ uuid: `39998:${TA}:${slug}`, kind: 39998, tags: [['d', slug], ['names', ...Object.values(firmwareJson(slug, 'concept-header.json').conceptHeader.oNames)], ['slug', slug], ['json', JSON.stringify(firmwareJson(slug, 'concept-header.json'))]], roleLabels: ['ConceptHeader'] }));
    const superset = named(`${roleKey}Superset`, lettered({ uuid: `39999:${TA}:${slug}-superset`, tags: [['d', `${slug}-superset`], ['name', `superset for the concept of ${firmwareJson(slug, 'concept-header.json').conceptHeader.oNames.plural}`]], roleLabels: ['Superset'] }));
    link(header, 'IS_THE_CONCEPT_FOR', superset);
    const schema = named(`${roleKey}Schema`, lettered({ uuid: `39999:${TA}:${slug}-json-schema`, tags: [['d', `${slug}-json-schema`], ['name', `JSON schema for the concept of ${slug}`], ['json', JSON.stringify(firmwareJson(slug, 'json-schema.json'))]], roleLabels: ['JSONSchema'] }));
    link(schema, 'IS_THE_JSON_SCHEMA_FOR', header);
    return { header, superset };
  };
  const dog = fwConcept('dog', 'dog');
  const gr = fwConcept('golden-retriever', 'goldenRetriever');
  link(dog.superset, 'IS_A_SUPERSET_OF', gr.superset);
  const walkers = named('walkers', eventlessSet(`39999:${TA}:walkers`, 'walkers'));
  link(dog.superset, 'IS_A_SUPERSET_OF', walkers);

  // ── pet ──
  const pet = await todays('pet', 'pets');
  named('pet', pet.conceptHeader); named('petSuperset', pet.superset);
  link(pet.superset, 'IS_A_SUPERSET_OF', walkers);
  const lapPets = named('lapPets', eventlessSet(`39999:${TA}:lap-pets`, 'lap pets'));
  link(pet.superset, 'IS_A_SUPERSET_OF', lapPets);

  // ── schemas that ask more ──
  const gadget = await todays('gadget', 'gadgets', { edit: (json, role) => {
    if (role !== 'jsonSchema') return;
    json.jsonSchema.properties.gadget = { type: 'object', required: ['name', 'slug', 'size'], additionalProperties: false, properties: { name: { type: 'string' }, slug: { type: 'string' }, size: { type: 'integer' }, color: { enum: ['red', 'green'] } } };
  } });
  named('gadget', gadget.conceptHeader);
  const Q = Array.from({ length: 25 }, (_, i) => `q${String(i + 1).padStart(2, '0')}`);
  const survey = await todays('survey', 'surveys', { edit: (json, role) => {
    if (role !== 'jsonSchema') return;
    json.jsonSchema.properties.survey = { type: 'object', required: ['name', 'slug', ...Q], properties: Object.fromEntries([['name', { type: 'string' }], ['slug', { type: 'string' }], ...Q.map((q) => [q, { type: 'string' }])]) };
  } });
  named('survey', survey.conceptHeader);
  for (const [nm, label] of [['sameIdA', 'same id a'], ['sameIdB', 'same id b']]) {
    const c = await todays(label, `${label}s`, { edit: (json, role) => { if (role === 'jsonSchema') json.jsonSchema.$id = 'https://example.com/schemas/one-id'; } });
    named(nm, c.conceptHeader);
  }

  // ── schemas that can't be read ──
  const teapot = await todays('teapot', 'teapots');
  named('teapot', teapot.conceptHeader);
  tagNode(teapot.jsonSchema, 'json').props.value = '{"jsonSchema": {"type": "obj';
  const kettle = await todays('kettle', 'kettles');
  named('kettle', kettle.conceptHeader);
  const second = lettered({ uuid: `39999:${TA}:kettle-schema-2`, tags: [['d', 'kettle-schema-2'], ['name', 'a second JSON schema for kettles'], ['json', JSON.stringify({ jsonSchema: { type: 'object' } })]], roleLabels: ['JSONSchema'] });
  link(second, 'IS_THE_JSON_SCHEMA_FOR', kettle.conceptHeader);
  const lantern = await todays('lantern', 'lanterns');
  named('lantern', lantern.conceptHeader);
  tagNode(lantern.jsonSchema, 'json').props.value = `lmdb:${hex('an entry nothing stores')}`;
  const compass = await todays('compass', 'compasses', { edit: (json, role) => { if (role === 'jsonSchema') json.jsonSchema = { type: 'nonsense' }; } });
  named('compass', compass.conceptHeader);

  // ── firmware concepts: one that takes an element, one that stays open, one made elsewhere ──
  const rt = named('relationshipType', lettered({ uuid: `39998:${TA}:relationship-type`, kind: 39998, tags: [['d', 'relationship-type'], ['names', 'relationship type', 'relationship types'], ['slug', 'relationship-type'], ['json', JSON.stringify({ word: { slug: 'concept-header-for-the-concept-of-relationship-types', wordTypes: ['word', 'conceptHeader'] }, conceptHeader: { oNames: { singular: 'relationship type', plural: 'relationship types' }, oSlugs: { singular: 'relationship-type', plural: 'relationship-types' }, oKeys: { singular: 'relationshipType', plural: 'relationshipTypes' }, oTitles: { singular: 'Relationship Type', plural: 'Relationship Types' } } })]], roleLabels: ['ConceptHeader'] }));
  const rtSup = named('relationshipTypeSuperset', lettered({ uuid: `39999:${TA}:relationship-type-superset`, tags: [['d', 'relationship-type-superset'], ['name', 'superset for the concept of relationship types']], roleLabels: ['Superset'] }));
  link(rt, 'IS_THE_CONCEPT_FOR', rtSup);
  const rtSchema = lettered({ uuid: `39999:${TA}:relationship-type-json-schema`, tags: [['d', 'relationship-type-json-schema'], ['name', 'JSON schema for the concept of relationship types'], ['json', JSON.stringify({ jsonSchema: { type: 'object', required: ['relationshipType'], properties: { relationshipType: { type: 'object', required: ['name', 'slug'], properties: { name: { type: 'string' }, slug: { type: 'string' }, alias: { type: 'string' } } } } } })]], roleLabels: ['JSONSchema'] });
  link(rtSchema, 'IS_THE_JSON_SCHEMA_FOR', rt);
  keys.fw['relationship-type'] = rt.props.tapestryKey;

  const graphHeader = byUuid(`39998:${TA}:graph`);
  named('graph', graphHeader);
  const graphSchema = lettered({ uuid: `39999:${TA}:graph-json-schema`, tags: [['d', 'graph-json-schema'], ['name', 'JSON schema for the concept of graphs'], ['json', JSON.stringify({ jsonSchema: { type: 'object' } })]], roleLabels: ['JSONSchema'] });
  link(graphSchema, 'IS_THE_JSON_SCHEMA_FOR', graphHeader);

  const graphRule = named('graphRule', lettered({ uuid: `39998:${TA}:graph-rule`, kind: 39998, tags: [['d', 'graph-rule'], ['names', 'graph rule', 'graph rules'], ['slug', 'graph-rule']], roleLabels: ['ConceptHeader'] }));
  const grSup = lettered({ uuid: `39999:${TA}:graph-rule-superset`, tags: [['d', 'graph-rule-superset'], ['name', 'superset for the concept of graph rules']], roleLabels: ['Superset'] });
  link(graphRule, 'IS_THE_CONCEPT_FOR', grSup);
  keys.fw['graph-rule'] = graphRule.props.tapestryKey;

  const otherSet = await todays('set', 'sets', { author: OTHER });
  named('otherSet', otherSet.conceptHeader);

  // ── a concept with no schema node, and the keys an element keeps for itself (ADR 0020 Amendment 1) ──
  const scroll = named('scroll', lettered({ uuid: `39998:${TA}:scroll`, kind: 39998, tags: [['d', 'scroll'], ['names', 'scroll', 'scrolls'], ['slug', 'scroll'], ['json', JSON.stringify({ conceptHeader: { oNames: { singular: 'scroll', plural: 'scrolls' }, oSlugs: { singular: 'scroll', plural: 'scrolls' }, oKeys: { singular: 'scroll', plural: 'scrolls' } } })]], roleLabels: ['ConceptHeader'] }));
  link(scroll, 'IS_THE_CONCEPT_FOR', named('scrollSuperset', lettered({ uuid: `39999:${TA}:scroll-superset`, tags: [['d', 'scroll-superset'], ['name', 'superset for the concept of scrolls']], roleLabels: ['Superset'] })));
  const anyObject = (json, role) => { if (role === 'jsonSchema') json.jsonSchema = { type: 'object' }; };
  named('otherWord', (await todays('word', 'words', { author: OTHER, edit: anyObject })).conceptHeader);
  named('graphContextConcept', (await todays('graph context', 'graph contexts', { edit: anyObject })).conceptHeader);

  named('loner', add(['NostrEvent', 'ListItem', 'TapestryNode'], { uuid: `39999:${TA}:loner`, kind: 39999, pubkey: TA, name: 'loner', id: hex('loner') }));
  named('G', add(['GraphChange', 'TapestryNode'], { at: '2026-01-01T00:00:00.000Z', byRole: 'owner', byPubkey: C.OWNER, operation: 'graph add-relationship', keys: [], changes: '[]' }));

  return {
    state: s,
    keys,
    uuids,
    /** Write the state to <dir>/graph.json and return its path. */
    file(dir) { const f = path.join(dir, 'graph.json'); writeState(f, s); return f; },
  };
}

module.exports = { TA, OTHER, seedCreateElement, elementAddress };
