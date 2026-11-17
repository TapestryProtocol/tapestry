'use strict';
/**
 * The graph the property operations' suites seed for test/helpers/graphFake.js (story graph-operations-first-slice #18,
 * ADR graph-operations-first-slice/0018): graph add-property, update-property, remove-property and set-schema.
 *
 * It starts from test/helpers/conceptGraph.js's seed (which says what that holds: the twelve firmware concepts a new
 * concept's nodes join, each a header and a superset; beagle, cat, bird, mouse and tapestry owner goal as today's
 * create-concept signed them; nostr relay, another author's; recipe, under the owner's own key) and adds:
 *   - the firmware schemas of the four concepts whose nodes these writes rewrite or make (property, json-schema,
 *     primary-property, property-tree-graph), each read from firmware/versions/v1.0.0/concepts/<slug>/json-schema.json:
 *     the writes check each node they write against them (ADR 0018, Decision 10);
 *   - the concept of neo4j properties, with its set of neo4j properties that are also fields, so graph mark-field can
 *     mark a field (the first set, 39999:<TA>:the-set-of-neo4j-properties-that-are-also-fields);
 *   - beagle (lettered): a field `color` in its schema, and a tree as today's generate-property-tree signs one, in the
 *     old shape (`property: { name, type, description, required: <boolean> }`): a node for name, slug, description and
 *     color, and a stray `retired` its schema doesn't list. Rover's tapestryJson is in the store;
 *   - mouse: a schema that isn't wrapped (a top-level `word` beside `mouse`);
 *   - cat: a field with no `type` (`favoriteToy`, an enum, and a minLength that isn't a number, so its schema doesn't
 *     compile either);
 *   - bird: a second JSON schema node (BIBLE §10, rule 11).
 *
 * prepare(label) then runs graph create-concept for tea house, gadget, lamp, bookshop, kiosk, stall, hut and cabin
 * (each with no event, and no property node: create-concept makes none), and adds:
 *   - tea house's elements, in its superset, each with a json tag and, in the store, its tapestryJson:
 *       lapsang (fits), oolong (lacks description: already doesn't fit), matcha (no tapestryJson: not judged, missing),
 *       chai (fits, and holds address.city), sencha (tapestryJson that isn't an object: not judged, unreadable),
 *       assam (fits; its json tag also holds `opened`, which its tapestryJson lacks, so a reader of the json tag and
 *       a reader of the tapestryJson part once `opened` is required);
 *   - gadget's elements: g1 (holds tags, a list, and stock, a whole number) and g2 (the defaults alone);
 *   - kiosk without its primary property, and stall without its JSON schema node;
 *   - hut's tangled tree: roof under its primary property, and door under both its primary property and roof;
 *   - cabin's `name` node, under its primary property, signed by another author (OTHER), in the old shape.
 *
 * → { file, dir, k, made, el, tree, extra }: k is conceptGraph's keys (with firmware schema nodes by slug in
 * k.schemas); made, each created concept's answer by its id (teaHouse, gadget, lamp, bookshop, kiosk, stall, hut,
 * cabin); el, each element's tapestryKey by its name (lapsang, …, g1, g2, rover); tree, beagle's old-shape nodes by
 * field; extra, hut's roof and door and cabin's theirName.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('./graphOpsSuite');
const C = require('./conceptGraph');
const G = require('./graphFake');

const { ROOT, TA, OWNER, assert, show } = S;
const OTHER = C.OTHER;
const NOBODY = '00000000-0000-4000-8000-0000000000bb';
const SET1 = `39999:${TA}:the-set-of-neo4j-properties-that-are-also-fields`;
const FIRMWARE_SCHEMAS = Object.freeze(['property', 'json-schema', 'primary-property', 'property-tree-graph']);
const MADE = Object.freeze({ teaHouse: 'tea house', gadget: 'gadget', lamp: 'lamp', bookshop: 'bookshop', kiosk: 'kiosk', stall: 'stall', hut: 'hut', cabin: 'cabin' });
const ROUTE = Object.freeze({
  add: '/api/tapestry/graph/add-property',
  update: '/api/tapestry/graph/update-property',
  remove: '/api/tapestry/graph/remove-property',
  set: '/api/tapestry/graph/set-schema',
  create: '/api/tapestry/graph/create-concept',
  mark: '/api/tapestry/graph/mark-field',
  element: '/api/tapestry/graph/create-element',
  list: '/api/tapestry/operations',
});
const DECL = (name) => path.join(ROOT, `src/operations/catalog/graph/${name}.js`);
/** BIBLE §9's deterministic d-tag of a property: slug(name)-<sha256(parent uuid), first 8>, as dtag.childDTag computes it. */
const slugOf = (name) => String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hash8 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 8);
const childD = (name, parentUuid) => `${slugOf(name)}-${hash8(parentUuid)}`;
const hex = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const copy = (x) => JSON.parse(JSON.stringify(x));
/** JSON with object keys sorted (array order kept), so equality never depends on the order keys were set in. */
const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.keys(v).sort().reduce((o, key) => { o[key] = v[key]; return o; }, {}) : v));
const same = (a, b) => canon(a) === canon(b);

/** Throw, naming the ADR, when an operation's declaration isn't there yet: the suites fail for the right reason. */
function needDecls(names) {
  const missing = names.map(DECL).find((f) => !fs.existsSync(f));
  if (missing) throw new Error(`${path.relative(ROOT, missing)} does not exist yet (ADR graph-operations-first-slice/0018 Decision 7)`);
}

// ── building over a state ──
function over(s) {
  const key = () => crypto.randomUUID();
  const add = (labels, props) => { const n = { eid: s.nextEid++, labels: [...labels], props: { ...props } }; s.nodes.push(n); return n; };
  const link = (a, type, b) => { s.rels.push({ eid: s.nextEid++, type, from: a.eid, to: b.eid, props: {} }); };
  const byKey = (k) => s.nodes.find((n) => n.props.tapestryKey === k) || null;
  const byUuid = (u) => s.nodes.find((n) => n.props.uuid === u) || null;
  const tag = (node, t, i) => {
    const props = { uuid: C.tagUuid(node.props.uuid, t, i), type: t[0], value: t[1] === undefined ? '' : String(t[1]), tapestryKey: key() };
    if (t[2]) props.value1 = t[2];
    if (t[3]) props.value2 = t[3];
    link(node, 'HAS_TAG', add(['NostrEventTag', 'TapestryNode'], props));
  };
  /** A node as the import leaves an event: NostrEvent, its labels, a letter's id, and its tag nodes. */
  const lettered = ({ uuid, kind = 39999, labels, name, tags, author = TA }) => {
    const n = add(['NostrEvent', ...labels, 'TapestryNode'], { uuid, kind, pubkey: author, name, created_at: 1763000000, id: hex(`event ${uuid}`), tapestryKey: key() });
    tags.forEach((t, i) => tag(n, t, i));
    return n;
  };
  /** A node with no event, as the graph operations make one (ADR 0016, Decision 1). */
  const eventless = ({ uuid, labels, name, tags }) => {
    const n = add([...labels, 'TapestryNode'], { uuid, kind: 39999, pubkey: TA, name, tapestryValue: name, created_at: 1763000000, tapestryKey: key() });
    tags.forEach((t, i) => tag(n, t, i));
    return n;
  };
  const tagsOf = (n) => s.rels.filter((r) => r.from === n.eid && r.type === 'HAS_TAG').map((r) => s.nodes.find((x) => x.eid === r.to)).filter(Boolean);
  const editJson = (n, fn) => {
    const t = tagsOf(n).find((x) => x.props.type === 'json');
    const j = JSON.parse(t.props.value);
    fn(j);
    t.props.value = JSON.stringify(j);
  };
  /** The node wired to a header by `type` (IS_THE_JSON_SCHEMA_FOR, IS_THE_PRIMARY_PROPERTY_FOR, …). */
  const coreOf = (header, type) => {
    const r = s.rels.find((x) => x.to === header.eid && x.type === type);
    return r ? s.nodes.find((n) => n.eid === r.from) : null;
  };
  /** A node, its tags and every relationship of either, gone. */
  const removeNode = (n) => {
    const gone = new Set([n.eid, ...tagsOf(n).map((t) => t.eid)]);
    s.rels = s.rels.filter((r) => !gone.has(r.from) && !gone.has(r.to));
    s.nodes = s.nodes.filter((x) => !gone.has(x.eid));
  };
  return { add, link, byKey, byUuid, tag, lettered, eventless, tagsOf, editJson, coreOf, removeNode, key };
}

/** A property node in the old shape today's generate-property-tree signs: { property: { name, type, description, required } }. */
function oldProperty(b, { parent, name, type, description, required, propertySuperset, author = TA }) {
  const d = childD(name, parent.props.uuid);
  const json = { word: { slug: slugOf(name), name, wordTypes: ['word', 'property'] }, property: { name, type, description, required } };
  const n = b.lettered({
    uuid: `39999:${author}:${d}`, labels: ['ListItem', 'Property'], name, author,
    tags: [['d', d], ['name', name], ['description', description], ['type', type], ['z', `39998:${TA}:property`], ['json', JSON.stringify(json)]],
  });
  b.link(n, 'IS_A_PROPERTY_OF', parent);
  if (propertySuperset) b.link(propertySuperset, 'HAS_ELEMENT', n);
  return n;
}

/** An element, as the import leaves one, in a superset; its tapestryJson, if any, is returned as a store entry. */
function element(b, { superset, concept, oKey, name, section, tapestry = 'same', jsonExtra = {} }) {
  const slug = slugOf(name);
  const word = { slug, name, wordTypes: ['word', oKey] };
  const json = { word, [oKey]: { ...section, ...jsonExtra } };
  const n = b.lettered({ uuid: `39999:${TA}:${slug}`, labels: ['ListItem'], name, tags: [['d', slug], ['name', name], ['z', concept], ['json', JSON.stringify(json)]] });
  b.link(superset, 'HAS_ELEMENT', n);
  const key = n.props.tapestryKey;
  if (tapestry === null) return { key, entry: null };
  const data = tapestry === 'same' ? { word, [oKey]: { ...section }, graphContext: { derivedAt: 1763000001, parentJsonSchemas: [] } } : tapestry;
  return { key, entry: [key, data] };
}

/** The concept seed with this story's additions (the header comment's first list). */
async function seedProperties({ without = [] } = {}) {
  const seed = await C.seedConcepts({ without });
  const s = seed.state;
  const k = seed.keys;
  const b = over(s);
  const lmdb = [];

  // The firmware schemas of the four concepts the writes' nodes are elements of (Decision 10).
  k.schemas = {};
  for (const slug of FIRMWARE_SCHEMAS) {
    const header = b.byUuid(`39998:${TA}:${slug}`);
    if (!header) continue;
    const raw = fs.readFileSync(path.join(ROOT, `firmware/versions/v1.0.0/concepts/${slug}/json-schema.json`), 'utf8').split('<uuid>').join(header.props.uuid);
    const js = b.lettered({ uuid: `39999:${TA}:${slug}-schema`, labels: ['ListItem', 'JSONSchema'], name: `json schema for the concept of ${slug}`, tags: [['d', `${slug}-schema`], ['name', `json schema for the concept of ${slug}`], ['json', JSON.stringify(JSON.parse(raw))]] });
    b.link(js, 'IS_THE_JSON_SCHEMA_FOR', header);
    k.schemas[slug] = js.props.tapestryKey;
  }

  // The concept of neo4j properties and its first set, as a firmware install makes them.
  const nh = b.lettered({ uuid: `39998:${TA}:neo4j-property`, kind: 39998, labels: ['ListHeader', 'ConceptHeader'], name: 'neo4j property', tags: [['d', 'neo4j-property'], ['names', 'neo4j property', 'neo4j properties'], ['json', JSON.stringify({ word: { slug: 'concept-header-for-the-concept-of-neo4j-properties', name: 'concept header for the concept of neo4j properties', wordTypes: ['word', 'conceptHeader'] }, conceptHeader: { oNames: { singular: 'neo4j property', plural: 'neo4j properties' }, oKeys: { singular: 'neo4jProperty', plural: 'neo4jProperties' } } })]] });
  const nsup = b.lettered({ uuid: `39999:${TA}:neo4j-property-superset`, labels: ['ListItem', 'Superset'], name: 'superset for the concept of neo4j properties', tags: [['d', 'neo4j-property-superset'], ['name', 'superset for the concept of neo4j properties']] });
  b.link(nh, 'IS_THE_CONCEPT_FOR', nsup);
  const set1 = b.lettered({ uuid: SET1, labels: ['ListItem', 'Set'], name: 'neo4j properties that are also fields', tags: [['d', 'the-set-of-neo4j-properties-that-are-also-fields'], ['name', 'neo4j properties that are also fields'], ['json', JSON.stringify({ word: { slug: 'the-set-of-neo4j-properties-that-are-also-fields' }, set: { slug: 'neo4j-properties-that-are-also-fields' } })]] });
  b.link(nsup, 'IS_A_SUPERSET_OF', set1);

  // beagle: a color field, and an old-shape tree with a stray (the property concept's superset holds each node).
  const propertySuperset = k.supersets.property ? b.byKey(k.supersets.property) : null;
  const beagle = b.byKey(k.beagle);
  const beagleSchema = b.coreOf(beagle, 'IS_THE_JSON_SCHEMA_FOR');
  const beaglePP = b.coreOf(beagle, 'IS_THE_PRIMARY_PROPERTY_FOR');
  b.editJson(beagleSchema, (j) => { j.jsonSchema.properties.beagle.properties.color = { type: 'string', name: 'color', slug: 'color', title: 'Color', description: 'The colour of its coat' }; });
  const tree = {};
  for (const [name, type, description, required] of [
    ['name', 'string', 'The name of the beagle', true],
    ['slug', 'string', 'A unique kebab-case identifier for this beagle', true],
    ['description', 'string', 'A brief description of the beagle', true],
    ['color', 'string', 'The colour of its coat', false],
    ['retired', 'boolean', 'No longer listed', false],
  ]) tree[name] = oldProperty(b, { parent: beaglePP, name, type, description, required, propertySuperset }).props.tapestryKey;
  lmdb.push([k.rover, { word: { slug: 'rover', name: 'Rover', wordTypes: ['word', 'beagle'] }, beagle: { name: 'Rover', slug: 'rover', description: 'a good beagle', color: 'tan' }, graphContext: { derivedAt: 1763000001, parentJsonSchemas: [] } }]);

  // mouse isn't wrapped; cat has a field with no type; bird has two JSON schema nodes.
  b.editJson(b.coreOf(b.byKey(k.mouse), 'IS_THE_JSON_SCHEMA_FOR'), (j) => { j.jsonSchema.properties.word = { type: 'object' }; });
  b.editJson(b.coreOf(b.byKey(k.cat), 'IS_THE_JSON_SCHEMA_FOR'), (j) => { j.jsonSchema.properties.cat.properties.favoriteToy = { enum: ['ball', 'string'], minLength: 'two' }; });
  const bird = b.byKey(k.bird);
  const birdSchema = b.coreOf(bird, 'IS_THE_JSON_SCHEMA_FOR');
  const second = b.lettered({ uuid: `${birdSchema.props.uuid}-again`, labels: ['ListItem', 'JSONSchema'], name: 'a second json schema for birds', tags: [['d', `${birdSchema.props.uuid.split(':').slice(2).join(':')}-again`], ['name', 'a second json schema for birds'], ['json', b.tagsOf(birdSchema).find((t) => t.props.type === 'json').props.value]] });
  b.link(second, 'IS_THE_JSON_SCHEMA_FOR', bird);

  return { state: s, keys: k, tree, lmdb, file(dir) { const f = path.join(dir, 'graph.json'); G.writeState(f, s); return f; } };
}

/** Store entries [[key, data]] under <dir>/lmdb, the store a harness run in <dir> reads (childEnv's path). */
function storeEntries(dir, entries) {
  if (!entries.length) return;
  const script = `
    const store = require(${JSON.stringify(path.join(ROOT, 'src/lib/tapestry-store.js'))});
    (async () => { for (const [k, v] of ${JSON.stringify(entries)}) await store.put(k, v); store.close(); process.stdout.write('STORED'); })()
      .catch((e) => { process.stderr.write(String(e && e.stack || e)); process.exit(1); });`;
  const r = spawnSync(process.execPath, ['-e', script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 60000 });
  if (!String(r.stdout).includes('STORED')) throw new Error(`the LMDB entries weren't stored: ${(r.stderr || '').slice(-400)}`);
}

/** One harness run over the state file: { req, cmd, spy, … } (graphOpsSuite's answered). */
const runOn = (file, requests, cli = [], spy = false) => S.answered(S.runHarness({ spy, scenarios: [{ graphFake: { stateFile: file }, requests, cli }] }, { dir: path.dirname(file) }));
const post = (route) => (id, caller, body, extra = {}) => ({ id, method: 'POST', url: ROUTE[route], caller, body, ...extra });

/** The concepts graph create-concept makes, and what the suites add to them once they exist (the header's second list). */
async function prepare(label, opts = {}) {
  const seed = await seedProperties(opts);
  const dir = S.tmp(`${label}-`);
  const file = seed.file(dir);
  const first = runOn(file, Object.entries(MADE).map(([id, name]) => post('create')(id, 'owner', { name })));
  const made = {};
  for (const id of Object.keys(MADE)) {
    const x = first.req(id);
    assert(x.status === 200 && x.body.data && x.body.data.outcome === 'created', `the setup's create of ${MADE[id]} must succeed; got ${x.status} ${show(x.body)}`);
    made[id] = x.body.data.concept;
  }
  const s = S.readState(file);
  const b = over(s);
  const lmdb = [...seed.lmdb];
  const el = { rover: seed.keys.rover };

  const th = made.teaHouse;
  const thSup = b.byKey(th.nodes.superset);
  const thUuid = th.address;
  const tea = (name, section, opt = {}) => {
    const r = element(b, { superset: thSup, concept: thUuid, oKey: 'teaHouse', name, section, ...opt });
    el[slugOf(name)] = r.key;
    if (r.entry) lmdb.push(r.entry);
  };
  tea('lapsang', { name: 'lapsang', slug: 'lapsang', description: 'smoky' });
  tea('oolong', { name: 'oolong', slug: 'oolong' });
  tea('matcha', { name: 'matcha', slug: 'matcha', description: 'whisked' }, { tapestry: null });
  tea('chai', { name: 'chai', slug: 'chai', description: 'spiced', address: { city: 'Leeds' } });
  tea('sencha', { name: 'sencha', slug: 'sencha', description: 'steamed' }, { tapestry: 'not an object' });
  tea('assam', { name: 'assam', slug: 'assam', description: 'malty' }, { jsonExtra: { opened: '1990' } });

  const gd = made.gadget;
  const gdSup = b.byKey(gd.nodes.superset);
  for (const [name, section] of [
    ['g1', { name: 'g1', slug: 'g1', description: 'the first', tags: ['a', 'b'], stock: 3 }],
    ['g2', { name: 'g2', slug: 'g2', description: 'the second' }],
  ]) {
    const r = element(b, { superset: gdSup, concept: gd.address, oKey: 'gadget', name, section });
    el[name] = r.key;
    lmdb.push(r.entry);
  }

  b.removeNode(b.byKey(made.kiosk.nodes.primaryProperty));
  b.removeNode(b.byKey(made.stall.nodes.jsonSchema));

  const propertySuperset = seed.keys.supersets.property ? b.byKey(seed.keys.supersets.property) : null;
  const hutPP = b.byKey(made.hut.nodes.primaryProperty);
  const newShape = (parent, name) => {
    const d = childD(name, parent.props.uuid);
    const json = { word: { slug: slugOf(name), name, wordTypes: ['word', 'property'] }, property: { key: name, type: 'object', schema: { type: 'object' } } };
    const n = b.eventless({ uuid: `39999:${TA}:${d}`, labels: ['ListItem', 'Property'], name, tags: [['d', d], ['name', name], ['type', 'object'], ['z', `39998:${TA}:property`], ['json', JSON.stringify(json)]] });
    b.link(n, 'IS_A_PROPERTY_OF', parent);
    if (propertySuperset) b.link(propertySuperset, 'HAS_ELEMENT', n);
    return n;
  };
  const roof = newShape(hutPP, 'roof');
  const door = newShape(hutPP, 'door');
  b.link(door, 'IS_A_PROPERTY_OF', roof);
  const cabinPP = b.byKey(made.cabin.nodes.primaryProperty);
  const theirName = oldProperty(b, { parent: cabinPP, name: 'name', type: 'string', description: 'The name of the cabin', required: true, propertySuperset, author: OTHER });

  G.writeState(file, s);
  storeEntries(dir, lmdb);
  return { file, dir, k: seed.keys, made, el, tree: seed.tree, extra: { roof: roof.props.tapestryKey, door: door.props.tapestryKey, theirName: theirName.props.tapestryKey } };
}

// ── reading a state ──
const node = C.node;
const tags = C.tags;
const tagArrays = C.tagArrays;
const json = C.json;
const out = C.out;
const into = C.into;
const eidOf = (s, k) => { const n = node(s, k); return n ? n.eid : null; };
const keyOfEid = (s, eid) => { const n = s.nodes.find((x) => x.eid === eid); return n ? n.props.tapestryKey : null; };

/** The document a concept's JSON schema node holds (its json tag's jsonSchema), as E1 reads it; null when it has none. */
function schemaDoc(s, header) {
  const eid = eidOf(s, header);
  const rels = s.rels.filter((r) => r.to === eid && r.type === 'IS_THE_JSON_SCHEMA_FOR');
  if (rels.length !== 1) return null;
  const j = json(s, keyOfEid(s, rels[0].from));
  return j && j.jsonSchema ? j.jsonSchema : null;
}
/** A concept's primary property's tapestryKey. */
function primaryOf(s, header) {
  const eid = eidOf(s, header);
  const r = s.rels.find((x) => x.to === eid && x.type === 'IS_THE_PRIMARY_PROPERTY_FOR');
  return r ? keyOfEid(s, r.from) : null;
}
/**
 * A concept's tree, from its primary property down: [{ key, name, parent, path, labels, uuid, json }], parents first,
 * children of each in no promised order.
 */
function treeOf(s, header) {
  const pp = primaryOf(s, header);
  const outRows = [];
  const walk = (parentKey, pathSoFar, depth) => {
    if (depth > 40) return;
    const pe = eidOf(s, parentKey);
    for (const r of s.rels.filter((x) => x.to === pe && x.type === 'IS_A_PROPERTY_OF')) {
      const n = s.nodes.find((x) => x.eid === r.from);
      if (!n || !n.labels.includes('Property')) continue;
      const p = [...pathSoFar, n.props.name];
      outRows.push({ key: n.props.tapestryKey, name: n.props.name, parent: parentKey === pp ? null : parentKey, path: p, labels: [...n.labels], uuid: n.props.uuid, json: json(s, n.props.tapestryKey) });
      walk(n.props.tapestryKey, p, depth + 1);
    }
  };
  if (pp) walk(pp, [], 0);
  return outRows;
}
/** The change entries in a state, oldest first, with `changes` parsed. */
const entriesOf = S.entriesOf;
/** The rows the concept page's Properties tab reads (ui/src/pages/concepts/ConceptProperties.jsx's query), over a state file. */
async function propertiesPage(file, headerUuid) {
  const cypher = `
    MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h:NostrEvent|TapestryNode {uuid: '${headerUuid}'})
    MATCH (p:Property)-[:IS_A_PROPERTY_OF *1..]->(js)
    OPTIONAL MATCH (p)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
    OPTIONAL MATCH (p)-[:IS_A_PROPERTY_OF]->(parent)
    WITH DISTINCT p, head(collect(j.value)) AS json,
      CASE WHEN parent:JSONSchema THEN null ELSE parent.name END AS parentName
    RETURN p.uuid AS uuid, p.name AS name, json, parentName
    ORDER BY parentName IS NOT NULL, parentName, p.name`;
  return G.fakeGraph(file).read(cypher, {});
}
/** The transactions in a fake's log from `from`: [{ steps, end, error }]. */
function transactions(log, from = 0) {
  const outT = [];
  let cur = null;
  for (const l of log.slice(from)) {
    if (l.call === 'begin') cur = { steps: [] };
    else if ((l.call === 'commit' || l.call === 'rollback') && cur) { outT.push({ ...cur, end: l.call, error: l.error || null }); cur = null; } else if (cur) cur.steps.push(l);
  }
  return outT;
}
/** A state's nodes and relationships, for comparing two states (the log aside). */
const graphOf = (s) => ({ nodes: s.nodes, rels: s.rels });

module.exports = {
  ROOT, TA, OWNER, OTHER, NOBODY, SET1, MADE, ROUTE, FIRMWARE_SCHEMAS,
  slugOf, hash8, childD, copy, canon, same, needDecls, over, seedProperties, prepare, storeEntries, runOn, post,
  node, tags, tagArrays, json, out, into, schemaDoc, primaryOf, treeOf, entriesOf, propertiesPage, transactions, graphOf,
};
