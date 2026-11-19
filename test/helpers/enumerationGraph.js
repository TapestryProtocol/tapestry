'use strict';
/**
 * The graph story graph-operations-first-slice #19's suites seed for test/helpers/graphFake.js: graph enumerate and
 * unenumerate, the rule enumerated-value-allowed, and the element writes' cases for it (ADR
 * graph-operations-first-slice/0019). TA, OWNER and ADMIN are test/helpers/graphOpsSuite.js's; OTHER is
 * test/helpers/conceptGraph.js's.
 *
 * prepareEnumeration(label, opts) starts from test/helpers/propertyGraph.js's prepare, which says what it holds: the
 * firmware concepts (word and graph among them), beagle, cat, bird, mouse and goal, nostr relay (another author's,
 * OTHER), recipe (under the owner's own key), and tea house, gadget, lamp, bookshop, kiosk, stall, hut (whose tree is
 * tangled: door under two parents) and cabin, each made by graph create-concept. Through the real catalog it then:
 *   - makes bot, project, person (plural people), grok bot and graph context (its key graphContext) with graph
 *     create-concept;
 *   - gives bot, person and grok bot their fields with graph set-schema (BOT_FIELDS, PERSON_FIELDS, GROK_FIELDS), so
 *     every field has the property node the property writes make, and each tree is in line with its schema.
 * Then it adds by hand, as today's routes and the import leave them:
 *   project's elements, under its superset unless said, each with a json tag and its tapestryJson in the store:
 *     infiniteHarness  'Infinite Harness', the assistant's, lettered
 *     loom             'Loom', the assistant's, with no event (as the graph operations make one)
 *     ownersPlan       "Owner's Plan", the owner's
 *     peerHi           'Peer Hi Project', a peer GrapeRank scores 0.2, above the cutoff (0.05)
 *     peerLo           'Peer Lo Project', a peer scored 0.01, below it
 *     atCutoff         'At Cutoff Project', a peer scored exactly 0.05: not above it
 *     unscored         'Unscored Project', a peer whose NostrUser has no influence
 *     adminProject     'Admin Project', the admin's, scored 0.01: an admin counts by score, like anyone
 *     noAuthor         'No Author Project', with no author, as an older path made one: it counts (ADR 0011, C2)
 *     deep             'Deep Project', the assistant's, in flagship, a set under project's superset
 *   person's: ada, grace and wanderer, the assistant's
 *   bot's, under its superset, written before any link, each with a json tag and its tapestryJson:
 *     grokOne    project 'Infinite Harness', a name: not a value a link allows
 *     grokTwo    project tapestry:<infiniteHarness>
 *     grokThree  no project
 *     grokFour   projects [tapestry:<loom>, 'Loom']
 *     grokFive   project tapestry:<peerLo>, an element the owner's point of view leaves out
 *     peerBot    hi's, project 'Some Project Name'
 *   and crew, an empty set under bot's superset;
 *   grok bot's element grokAlpha, project 'Infinite Harness', as the hosted instance's bots hold names; and its
 *     project property also IS_A_PROPERTY_OF its JSON schema node, as today's enumerate route left Grok Bots' project,
 *     so its tree is tangled (ledger row 2026-11-19-old-routes-hang-properties-on-schema);
 *   the NostrUser nodes: hi 0.2, lo 0.01, atCutoff 0.05, noscore (no influence), the admin 0.01 and the owner 1;
 *   bare, a concept header with no superset; twin, one with two;
 *   the relationship concept, 39998:<TA>:relationship, a header and a superset, for the letters today's route signs;
 *   properties whose concepts the writes refuse: relay's motto (another author's), recipe's dish (the owner's own
 *     key's), and word's spelling, under a primary property given to word, a firmware concept;
 *   with opts.bigSource n > 0, fleet, a concept with n of the assistant's elements, for the answer's cap of 50.
 *
 * No ENUMERATES is made here: each suite makes the links it needs, with link(file, from, to, props) as today's route
 * makes one (from a superset to a property node, no properties) or as firmware install does (to a JSON schema node,
 * with a destinationPath), and letter(file, ctx, from, to) for the relationship event today's route signs for one.
 *
 * → { file, dir, k, made, c, sup, set, f, pp, schema, el, uuid, peers }: k is propertyGraph's keys; made, each
 * concept graph create-concept made, by id; c, the concept headers by id (bot, project, person, grokBot, graphContext,
 * bare, twin, relationship, relay, recipe, word, graph, teaHouse, hut, fleet); sup, their supersets (twin has two:
 * twin and twin2); set, flagship and crew; f, the property nodes by concept and path ('team.lead'), and the refused
 * ones (relayMotto, recipeDish, wordSpelling, hutDoor); pp and schema, primary properties and JSON schema nodes by
 * concept; el, the elements above, and tea house's (lapsang); uuid, any of these nodes' addresses by key.
 */

const crypto = require('crypto');
const path = require('path');
const S = require('./graphOpsSuite');
const P = require('./propertyGraph');
const G = require('./graphFake');

const { TA, OWNER, ADMIN, assert, show } = S;
const { OTHER } = P;
const PEERS = Object.freeze({ hi: '11'.repeat(32), lo: '22'.repeat(32), noscore: '33'.repeat(32), atCutoff: '55'.repeat(32) });
const NOBODY = '00000000-0000-4000-8000-0000000000e9';
const ROUTE = Object.freeze({
  enumerate: '/api/tapestry/graph/enumerate',
  unenumerate: '/api/tapestry/graph/unenumerate',
  createElement: '/api/tapestry/graph/create-element',
  updateNode: '/api/tapestry/graph/update-node',
  addToConcept: '/api/tapestry/graph/add-to-concept',
  removeFromConcept: '/api/tapestry/graph/remove-from-concept',
  deleteNode: '/api/tapestry/graph/delete-node',
  history: '/api/tapestry/graph/history',
  listElements: '/api/tapestry/graph/list-elements',
  listRelationships: '/api/tapestry/graph/list-relationships',
  list: '/api/tapestry/operations',
});

/** bot's fields beyond create-concept's name, slug and description: one for each case the suites need. */
const BOT_FIELDS = Object.freeze({
  project: { type: 'string', description: 'The project the bot works on' },
  projects: { type: 'array', items: { type: 'string' } },
  team: { type: 'object', properties: { lead: { type: 'string' } } },
  nickname: { type: ['string', 'null'] },
  partner: { type: 'string' },
  sponsor: { type: 'string' },
  flag: { type: 'string' },
  spare: { type: 'string' },
  vessel: { type: 'string' },
  base: { type: 'string' },
  station: { type: 'string' },
  cliField: { type: 'string' },
  adminField: { type: 'string' },
  mixed: { type: ['string', 'number'] },
  count: { type: 'number' },
  meta: { type: 'object' },
  parts: { type: 'array', items: { type: 'object' } },
  loose: { type: 'array' },
  code: { type: 'string', enum: ['a', 'b'] },
  fixed: { type: 'string', const: 'x' },
  ref: { type: 'string', pattern: '^nostr:' },
  short: { type: 'string', maxLength: 44 },
  long: { type: 'string', minLength: 46 },
  codes: { type: 'array', items: { type: 'string', enum: ['a'] } },
  shortItems: { type: 'array', items: { type: 'string', maxLength: 5 } },
  prefixed: { type: 'string', pattern: '^tapestry:' },
  exact: { type: 'string', minLength: 45, maxLength: 45 },
  email: { type: 'string', format: 'email' },
});
const PERSON_FIELDS = Object.freeze({ mentor: { type: 'string' } });
const GROK_FIELDS = Object.freeze({ project: { type: 'string' } });
const MADE_HERE = Object.freeze({ bot: ['bot'], project: ['project'], person: ['person', 'people'], grokBot: ['grok bot'], graphContext: ['graph context'] });

/** A value naming the node keyed `key`, as ADR 0019 Decision 6 writes one. */
const ref = (key) => `tapestry:${key}`;
const copy = (x) => JSON.parse(JSON.stringify(x));

/** The concept header's own JSON, as today's create-concept writes its conceptHeader block. */
const headerJson = (singular, plural, oKey) => JSON.stringify({ word: { slug: `concept-header-for-the-concept-of-${P.slugOf(plural)}`, name: `concept header for the concept of ${plural}`, wordTypes: ['word', 'conceptHeader'] }, conceptHeader: { oNames: { singular, plural }, oSlugs: { singular: P.slugOf(singular), plural: P.slugOf(plural) }, oKeys: { singular: oKey, plural: `${oKey}s` } } });

/** Over a state: a node by hand, as the import leaves one, and the helpers propertyGraph's over() gives. */
function builder(s) {
  const b = P.over(s);
  const hex = (x) => crypto.createHash('sha256').update(String(x)).digest('hex');
  /** An element under `holder`: word-wrapper JSON with its concept's section; lettered unless eventless, by `author`. */
  b.element = ({ holder, name, oKey, conceptUuid, section = {}, author = TA, eventless = false, noAuthor = false }) => {
    const slug = P.slugOf(name);
    const word = { slug, name, wordTypes: ['word', oKey] };
    const json = { word, [oKey]: { name, slug, description: `${name}, for the tests`, ...section } };
    const tags = [['d', slug], ['name', name], ['z', conceptUuid], ['json', JSON.stringify(json)]];
    let n;
    if (noAuthor) {
      n = b.add(['ListItem', 'TapestryNode'], { name, tapestryKey: b.key() });
      tags.forEach((t, i) => b.tag(n, t, i));
    } else if (eventless) {
      n = b.add(['ListItem', 'TapestryNode'], { uuid: `39999:${author}:${slug}`, kind: 39999, pubkey: author, name, tapestryValue: name, created_at: 1763000000, tapestryKey: b.key() });
      tags.forEach((t, i) => b.tag(n, t, i));
    } else {
      n = b.lettered({ uuid: `39999:${author}:${slug}`, labels: ['ListItem'], name, tags, author });
    }
    b.link(holder, 'HAS_ELEMENT', n);
    return { node: n, entry: [n.props.tapestryKey, { ...json, graphContext: { derivedAt: 1763000001, parentJsonSchemas: [] } }] };
  };
  /** A concept header by hand: lettered, by the assistant, with names and keys in its JSON. */
  b.header = (d, singular, plural, oKey) => b.lettered({ uuid: `39998:${TA}:${d}`, kind: 39998, labels: ['ListHeader', 'ConceptHeader'], name: singular, tags: [['d', d], ['names', singular, plural], ['slug', d], ['json', headerJson(singular, plural, oKey)]] });
  b.superset = (d, plural) => b.lettered({ uuid: `39999:${TA}:${d}`, labels: ['ListItem', 'Superset'], name: `superset for the concept of ${plural}`, tags: [['d', d], ['name', `superset for the concept of ${plural}`]] });
  /** A property node in today's old shape, by `author`, under `parent` (propertyGraph's oldProperty, any author). */
  b.property = (parent, name, author) => {
    const d = P.childD(name, parent.props.uuid);
    const json = { word: { slug: P.slugOf(name), name, wordTypes: ['word', 'property'] }, property: { name, type: 'string', description: `The ${name}`, required: false } };
    const n = b.lettered({ uuid: `39999:${author}:${d}`, labels: ['ListItem', 'Property'], name, author, tags: [['d', d], ['name', name], ['description', `The ${name}`], ['type', 'string'], ['z', `39998:${TA}:property`], ['json', JSON.stringify(json)]] });
    b.link(n, 'IS_A_PROPERTY_OF', parent);
    return n;
  };
  b.hex = hex;
  return b;
}

/** Word's primary property and its field spelling, by hand on any state: a firmware concept's property. → spelling's key */
function firmwareProperty(s) {
  const b = builder(s);
  const word = b.byUuid(`39998:${TA}:word`);
  assert(word, 'the seed holds firmware word');
  const pp = b.eventless({ uuid: `39999:${TA}:word-primary-property`, labels: ['ListItem', 'Property'], name: 'word', tags: [['d', 'word-primary-property'], ['name', 'word'], ['json', JSON.stringify({ property: { key: 'word', type: 'object', schema: { type: 'object', properties: {} } } })]] });
  b.link(pp, 'IS_THE_PRIMARY_PROPERTY_FOR', word);
  return b.property(pp, 'spelling', TA).props.tapestryKey;
}

/** The graph's ENUMERATES from `from` to `to` (by tapestryKey), as today's route makes it, or with `props`, firmware's. */
function link(file, from, to, props = {}) {
  const s = S.readState(file);
  const a = s.nodes.find((n) => n.props.tapestryKey === from);
  const b = s.nodes.find((n) => n.props.tapestryKey === to);
  assert(a && b, `link: both ends must be in the graph; ${from} ${a ? 'is' : "isn't"}, ${to} ${b ? 'is' : "isn't"}`);
  s.rels.push({ eid: s.nextEid++, type: 'ENUMERATES', from: a.eid, to: b.eid, props: { ...props } });
  G.writeState(file, s);
}

/**
 * The relationship event today's POST /api/normalize/enumerate signs for a link (src/api/normalize/index.js:4190–4203):
 * 39999:<TA>:<d>, its nodeFrom, nodeTo and relationshipType tags and a z naming the relationship concept, an element of
 * that concept's superset, as a reinstall's pass 1d wires one. → its address
 */
function letter(file, ctx, from, to) {
  const s = S.readState(file);
  const b = builder(s);
  const a = b.byKey(from);
  const z = b.byKey(to);
  const d = b.hex(`${a.props.uuid} ENUMERATES ${z.props.uuid}`).slice(0, 32);
  const n = b.lettered({ uuid: `39999:${TA}:${d}`, labels: ['ListItem'], name: `${a.props.name} ENUMERATES ${z.props.name}`, tags: [['d', d], ['name', `${a.props.name} ENUMERATES ${z.props.name}`], ['z', `39998:${TA}:relationship`], ['nodeFrom', a.props.uuid], ['nodeTo', z.props.uuid], ['relationshipType', 'ENUMERATES']] });
  b.link(b.byKey(ctx.sup.relationship), 'HAS_ELEMENT', n);
  G.writeState(file, s);
  return n.props.uuid;
}

/** The property nodes of a concept's tree, by path ('project', 'team.lead'). */
function propertiesOf(s, header) {
  return Object.fromEntries(P.treeOf(s, header).map((r) => [r.path.join('.'), r.key]));
}

async function prepareEnumeration(label, { bigSource = 0 } = {}) {
  const ctx = await P.prepare(label);
  const { file, dir, k } = ctx;
  const made = { ...ctx.made };

  // ── through the real catalog: the concepts, then their fields ──
  const first = P.runOn(file, Object.entries(MADE_HERE).map(([id, [name, plural]]) => P.post('create')(id, 'owner', { name, ...(plural ? { plural } : {}) })));
  for (const id of Object.keys(MADE_HERE)) {
    const x = first.req(id);
    assert(x.status === 200 && x.body.data && x.body.data.outcome === 'created', `the setup's create-concept of ${MADE_HERE[id][0]} must succeed; got ${x.status} ${show(x.body).slice(0, 400)}`);
    made[id] = x.body.data.concept;
  }
  const s1 = S.readState(file);
  const withFields = (id, fields) => {
    const doc = P.copy(P.schemaDoc(s1, made[id].conceptHeader));
    const oKey = Object.keys(doc.properties)[0];
    doc.properties[oKey].properties = { ...doc.properties[oKey].properties, ...copy(fields) };
    return P.post('set')(`set-${id}`, 'owner', { concept: made[id].conceptHeader, schema: doc });
  };
  const second = P.runOn(file, [withFields('bot', BOT_FIELDS), withFields('person', PERSON_FIELDS), withFields('grokBot', GROK_FIELDS)]);
  for (const id of ['bot', 'person', 'grokBot']) {
    const x = second.req(`set-${id}`);
    assert(x.status === 200 && x.body.data && x.body.data.outcome === 'set', `the setup's set-schema of ${id} must succeed; got ${x.status} ${show(x.body).slice(0, 600)}`);
  }

  // ── by hand ──
  const s = S.readState(file);
  const b = builder(s);
  const lmdb = [];
  const el = { lapsang: ctx.el.lapsang };
  const node = (key) => b.byKey(key);
  const conceptOf = (id) => ({ oKey: made[id].key, conceptUuid: made[id].address });
  const sup = Object.fromEntries(['bot', 'project', 'person', 'grokBot', 'graphContext'].map((id) => [id, made[id].nodes.superset]));
  const put = (name, made1) => { el[name] = made1.node.props.tapestryKey; lmdb.push(made1.entry); return made1.node; };

  // The web of trust's scores.
  const user = (pubkey, influence) => b.add(['NostrUser', 'TapestryNode'], influence === undefined ? { pubkey, tapestryKey: b.key() } : { pubkey, influence, tapestryKey: b.key() });
  user(PEERS.hi, 0.2); user(PEERS.lo, 0.01); user(PEERS.atCutoff, 0.05); user(PEERS.noscore); user(ADMIN, 0.01); user(OWNER, 1);

  // project's elements.
  const projectSup = node(sup.project);
  const P1 = { holder: projectSup, ...conceptOf('project') };
  put('infiniteHarness', b.element({ ...P1, name: 'Infinite Harness' }));
  put('loom', b.element({ ...P1, name: 'Loom', eventless: true }));
  put('ownersPlan', b.element({ ...P1, name: "Owner's Plan", author: OWNER }));
  put('peerHi', b.element({ ...P1, name: 'Peer Hi Project', author: PEERS.hi }));
  put('peerLo', b.element({ ...P1, name: 'Peer Lo Project', author: PEERS.lo }));
  put('atCutoff', b.element({ ...P1, name: 'At Cutoff Project', author: PEERS.atCutoff }));
  put('unscored', b.element({ ...P1, name: 'Unscored Project', author: PEERS.noscore }));
  put('adminProject', b.element({ ...P1, name: 'Admin Project', author: ADMIN }));
  put('noAuthor', b.element({ ...P1, name: 'No Author Project', noAuthor: true }));
  const flagship = b.add(['ListItem', 'Set', 'TapestryNode'], { uuid: `39999:${TA}:flagship-projects`, kind: 39999, pubkey: TA, name: 'flagship projects', tapestryValue: 'flagship projects', created_at: 1763000000, tapestryKey: b.key() });
  b.link(projectSup, 'IS_A_SUPERSET_OF', flagship);
  put('deep', b.element({ ...P1, holder: flagship, name: 'Deep Project' }));

  // person's.
  const P2 = { holder: node(sup.person), ...conceptOf('person') };
  put('ada', b.element({ ...P2, name: 'Ada' }));
  put('grace', b.element({ ...P2, name: 'Grace' }));
  put('wanderer', b.element({ ...P2, name: 'Wanderer' }));

  // bot's, written before any link.
  const P3 = { holder: node(sup.bot), ...conceptOf('bot') };
  put('grokOne', b.element({ ...P3, name: 'Grok One', section: { project: 'Infinite Harness' } }));
  put('grokTwo', b.element({ ...P3, name: 'Grok Two', section: { project: ref(el.infiniteHarness) } }));
  put('grokThree', b.element({ ...P3, name: 'Grok Three' }));
  put('grokFour', b.element({ ...P3, name: 'Grok Four', section: { projects: [ref(el.loom), 'Loom'] } }));
  put('grokFive', b.element({ ...P3, name: 'Grok Five', section: { project: ref(el.peerLo) } }));
  put('peerBot', b.element({ ...P3, name: 'Peer Bot', author: PEERS.hi, section: { project: 'Some Project Name' } }));
  const crew = b.add(['ListItem', 'Set', 'TapestryNode'], { uuid: `39999:${TA}:bot-crew`, kind: 39999, pubkey: TA, name: 'bot crew', tapestryValue: 'bot crew', created_at: 1763000000, tapestryKey: b.key() });
  b.link(node(sup.bot), 'IS_A_SUPERSET_OF', crew);

  // grok bot: its element, and its project hung on its JSON schema node too, as today's enumerate route left it.
  put('grokAlpha', b.element({ holder: node(sup.grokBot), ...conceptOf('grokBot'), name: 'Grok Alpha', section: { project: 'Infinite Harness' } }));
  const grokProject = propertiesOf(s, made.grokBot.conceptHeader).project;
  b.link(node(grokProject), 'IS_A_PROPERTY_OF', node(made.grokBot.nodes.jsonSchema));

  // bare (no superset), twin (two), and the relationship concept.
  const bare = b.header('bare-concept', 'bare concept', 'bare concepts', 'bareConcept');
  const twin = b.header('twin-concept', 'twin concept', 'twin concepts', 'twinConcept');
  const twin1 = b.superset('twin-concept-superset', 'twin concepts');
  const twin2 = b.superset('twin-concept-superset-2', 'twin concepts');
  b.link(twin, 'IS_THE_CONCEPT_FOR', twin1);
  b.link(twin, 'IS_THE_CONCEPT_FOR', twin2);
  const relationship = b.header('relationship', 'relationship', 'relationships', 'relationship');
  const relationshipSup = b.superset('relationship-superset', 'relationships');
  b.link(relationship, 'IS_THE_CONCEPT_FOR', relationshipSup);

  // Properties of concepts the writes refuse.
  const ppOf = (header) => { const r = s.rels.find((x) => x.to === node(header).eid && x.type === 'IS_THE_PRIMARY_PROPERTY_FOR'); return r ? s.nodes.find((n) => n.eid === r.from) : null; };
  const relayPP = ppOf(k.relay);
  const recipePP = ppOf(k.recipe);
  assert(relayPP && recipePP, 'nostr relay and recipe have their primary properties, as today\'s create-concept made them');
  const relayMotto = b.property(relayPP, 'motto', OTHER).props.tapestryKey;
  const recipeDish = b.property(recipePP, 'dish', OWNER).props.tapestryKey;
  const wordSpelling = firmwareProperty(s);

  // fleet: a source with many elements.
  let fleet = null;
  let fleetSup = null;
  if (bigSource > 0) {
    fleet = b.header('fleet', 'fleet', 'fleets', 'fleet');
    fleetSup = b.superset('fleet-superset', 'fleets');
    b.link(fleet, 'IS_THE_CONCEPT_FOR', fleetSup);
    el.fleet = [];
    for (let i = 0; i < bigSource; i += 1) {
      const m = b.element({ holder: fleetSup, oKey: 'fleet', conceptUuid: fleet.props.uuid, name: `Vessel ${String(i).padStart(3, '0')}`, eventless: true });
      el.fleet.push(m.node.props.tapestryKey);
      lmdb.push(m.entry);
    }
  }

  G.writeState(file, s);
  P.storeEntries(dir, lmdb);

  const header = (id) => made[id].conceptHeader;
  const c = {
    bot: header('bot'), project: header('project'), person: header('person'), grokBot: header('grokBot'), graphContext: header('graphContext'),
    bare: bare.props.tapestryKey, twin: twin.props.tapestryKey, relationship: relationship.props.tapestryKey,
    relay: k.relay, recipe: k.recipe, word: k.word, graph: S.readState(file).nodes.find((n) => n.props.uuid === `39998:${TA}:graph`).props.tapestryKey,
    teaHouse: made.teaHouse.conceptHeader, hut: made.hut.conceptHeader, fleet: fleet ? fleet.props.tapestryKey : null,
  };
  const g = S.readState(file);
  const supOf = (h) => { const n = g.nodes.find((x) => x.props.tapestryKey === h); const r = n && g.rels.find((x) => x.from === n.eid && x.type === 'IS_THE_CONCEPT_FOR'); return r ? g.nodes.find((x) => x.eid === r.to).props.tapestryKey : null; };
  const supersets = {
    ...sup, twin: twin1.props.tapestryKey, twin2: twin2.props.tapestryKey, relationship: relationshipSup.props.tapestryKey,
    relay: supOf(k.relay), word: supOf(k.word), graph: supOf(c.graph), fleet: fleetSup ? fleetSup.props.tapestryKey : null,
  };
  const f = {
    bot: propertiesOf(g, c.bot), person: propertiesOf(g, c.person), grokBot: propertiesOf(g, c.grokBot),
    relayMotto, recipeDish, wordSpelling, hutDoor: ctx.extra.door,
  };
  for (const [what, need] of [['bot', [...Object.keys(BOT_FIELDS), 'team.lead']], ['person', Object.keys(PERSON_FIELDS)], ['grokBot', Object.keys(GROK_FIELDS)]]) {
    for (const p of need) assert(typeof f[what][p] === 'string', `set-schema gave ${what}'s ${p} a property node; got ${show(Object.keys(f[what]))}`);
  }
  const uuid = Object.fromEntries(g.nodes.filter((n) => typeof n.props.tapestryKey === 'string' && typeof n.props.uuid === 'string').map((n) => [n.props.tapestryKey, n.props.uuid]));
  return {
    file, dir, k, made, c, sup: supersets, set: { flagship: flagship.props.tapestryKey, crew: crew.props.tapestryKey }, f,
    pp: { bot: made.bot.nodes.primaryProperty, person: made.person.nodes.primaryProperty, grokBot: made.grokBot.nodes.primaryProperty },
    schema: { bot: made.bot.nodes.jsonSchema, person: made.person.nodes.jsonSchema, grokBot: made.grokBot.nodes.jsonSchema },
    el, uuid, peers: PEERS,
  };
}

/**
 * prepareEnumeration's seed with the links the element writes and the rule enumerated-value-allowed meet, each as
 * today's route makes one: project's superset to bot's project, projects and nickname; person's superset to bot's
 * team.lead and to person's mentor; project's superset to grok bot's project, whose tree is tangled (Grok Bots' shape);
 * and firmware's shape, person's superset to bot's JSON schema node, with a destinationPath naming bot.spare.
 */
async function prepareLinked(label, opts) {
  const ctx = await prepareEnumeration(label, opts);
  const { file, sup, f } = ctx;
  link(file, sup.project, f.bot.project);
  link(file, sup.project, f.bot.projects);
  link(file, sup.project, f.bot.nickname);
  link(file, sup.person, f.bot['team.lead']);
  link(file, sup.person, f.person.mentor);
  link(file, sup.project, f.grokBot.project);
  link(file, sup.person, ctx.schema.bot, { destinationPath: 'bot.spare', sourcePath: 'slug' });
  return ctx;
}

/** The JSON an element write would store: word-wrapper JSON with the concept's section, name and slug filled in. */
const elementJson = (oKey, fields, name = 'Probe') => ({ word: { slug: P.slugOf(name), name, wordTypes: ['word', oKey] }, [oKey]: { name, slug: P.slugOf(name), description: `${name}, a probe`, ...fields } });

// ── reading a state ──
/** The ENUMERATES in a state, as { from, to, props } by tapestryKey. */
function links(s) {
  const keyOf = (eid) => (s.nodes.find((n) => n.eid === eid) || { props: {} }).props.tapestryKey;
  return s.rels.filter((r) => r.type === 'ENUMERATES').map((r) => ({ from: keyOf(r.from), to: keyOf(r.to), props: r.props || {} }));
}
/** The links into the node keyed `to`. */
const linksInto = (s, to) => links(s).filter((l) => l.to === to);
/** A node's section of its JSON, from its json tag. */
function sectionOf(s, key, oKey) {
  const j = P.json(s, key);
  return j && j[oKey];
}

module.exports = {
  TA, OWNER, ADMIN, OTHER, PEERS, NOBODY, ROUTE, BOT_FIELDS, PERSON_FIELDS, GROK_FIELDS,
  ref, prepareEnumeration, prepareLinked, elementJson, firmwareProperty, link, letter, links, linksInto, sectionOf, propertiesOf,
};
