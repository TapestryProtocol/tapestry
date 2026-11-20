'use strict';
/**
 * What import nostr's suites share (story graph-operations-first-slice #32; ADR graph-operations-first-slice/0032). Its
 * test plan, engineering-team/stories/graph-operations-first-slice/32-import-nostr.test-plan.md, says what each holds.
 *
 * Keys. The callers are graphOpsSuite's fixed fake keys (OWNER, ADMIN, STRANGER). The import checks every signature
 * (ADR Decision 3), and those keys have no secret, so the letters are signed with throwaway keys made here from fixed
 * seeds (KEYS): `ta`, the instance's assistant in the suites that sign its letters (the child's TA_PUBKEY: the code still
 * finds it at run time, through getOwnerAssistantPubkey); `alice`, `bob` and `carol`, other authors; `ownerSigner`, an
 * owner who signs, for the one case that needs the owner's letter. A suite over graphOpsSuite's own seeds keeps its TA.
 *
 * Letters (each signed, JSON only, so nothing carries nostr-tools' verified mark):
 *   letter(key, { kind, at, tags, content })   one event
 *   forged(event, changes)                      the event with changes, and its old id and sig: its id doesn't verify
 *   foreignSig(event, other)                    its id, another event's sig: its signature doesn't verify
 *   conceptLetters(key, slug, opts)             a concept as an instance publishes it: header, superset, JSON schema,
 *                                               primary property, properties set, property tree graph, core nodes graph
 *                                               and concept graph, each with its json tag, the graphs listing nodes,
 *                                               relationships and imports as today's create-concept writes them
 *   relationshipLetter(key, { d, from, to, type, at })  a relationship letter (nodeFrom, nodeTo, relationshipType)
 *   graphLetter(key, { d, nodes, relationships, imports, at, json })  a graph element of one's own making
 *   addressOf(event)                            NIP-01's address (Decision 4), or null for a regular event
 *
 * The graph (test/helpers/cypherEngine.js runs every statement):
 *   emptyGraph(), today(state, event): today's builder (src/api/neo4j/eventSync.js's buildImportCypher) run whole, the
 *   node it leaves; cy(state, cypher, params); label, wire, eventless; ownConcept(state, opts): the assistant's concept
 *   as today's signing routes leave it, letters imported by today's builder, then role labels and wiring.
 *
 * Runs: runImport({ state | file, relays, dns, live, timing, pauseMs, requests, cli, signing, ownerKey, spy }) is one
 * harness run with the cypher engine and the fake relays (relayFake.js says what live and timing are); readWith(state,
 * requests) one with graphFake.js, for other operations' reads.
 * Readers: nodesAt, withId, byKey, relsOf, tagsOf, personsOf, isPlaceholder, entries, canonical.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const S = require('./graphOpsSuite');
const R = require('./relayFake');
const CG = require('./cypherGraphFake');
const E = require('./cypherEngine');

const { ROOT, NL, assert, show } = S;
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));

const ROUTE = '/api/tapestry/import/nostr';
const DECL = path.join(ROOT, 'src/operations/catalog/import/nostr.js');
const OWN_RELAY = 'ws://127.0.0.1:7777';
const PEER_RELAY = 'wss://relay.example.com';
const OTHER_INSTANCE = 'wss://other.example.com';
/** The fake DNS: two public names, and three that the host guard must refuse. */
const DNS = Object.freeze({
  'relay.example.com': { v4: ['1.1.1.1'] },
  'other.example.com': { v4: ['8.8.8.8'], v6: ['2606:4700:4700::1111'] },
  'hint.example.com': { v4: ['9.9.9.9'] },
  'intranet.example.com': { v4: ['192.168.1.5'] },
  'mixed.example.com': { v4: ['1.1.1.1', '10.0.0.7'] },
});

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/import/nostr.js does not exist yet (ADR graph-operations-first-slice/0032 Decision 1)');
}

// ── keys and letters ──
function keyFrom(label) {
  const sk = crypto.createHash('sha256').update(`import-nostr-suite:${label}`).digest();
  return { label, sk: new Uint8Array(sk), pubkey: NT.getPublicKey(new Uint8Array(sk)) };
}
const KEYS = Object.freeze({ ta: keyFrom('assistant'), alice: keyFrom('alice'), bob: keyFrom('bob'), carol: keyFrom('carol'), ownerSigner: keyFrom('owner') });
const json = (x) => JSON.parse(JSON.stringify(x));

function letter(key, { kind = 1, at = 1700000000, tags = [], content = '' } = {}) {
  return json(NT.finalizeEvent({ kind, created_at: at, tags: json(tags), content }, key.sk));
}
const forged = (event, changes) => ({ ...json(event), ...changes });
const foreignSig = (event, other) => ({ ...json(event), sig: other.sig });

function addressOf(e) {
  const k = e.kind;
  if (k === 0 || k === 3 || (k >= 10000 && k < 20000)) return `${k}:${e.pubkey}:`;
  if (k >= 30000 && k < 40000) { const d = (e.tags.find((t) => t[0] === 'd') || [])[1]; return `${k}:${e.pubkey}:${d === undefined ? '' : d}`; }
  return null;
}
/** The node's uuid: the address, or the id for a regular event (Decision 4). */
const uuidOf = (e) => addressOf(e) || e.id;
/** Where today's builder keys an event: an address for kind 30000 and up, the id for any other (Context 4). */
const todaysUuidOf = (e) => (e.kind >= 30000 ? `${e.kind}:${e.pubkey}:${(e.tags.find((t) => t[0] === 'd') || [])[1]}` : e.id);

const nip = {
  note: (id) => NT.nip19.noteEncode(id),
  nevent: (id, relays = []) => NT.nip19.neventEncode({ id, relays }),
  naddr: (kind, pubkey, identifier, relays = []) => NT.nip19.naddrEncode({ kind, pubkey, identifier, relays }),
};

/** The word-wrapper slug of a concept's core node, as today's create-concept writes it. */
const roleSlug = (role, plural) => `${role}-for-the-concept-of-${plural}`;

/**
 * A concept as an instance publishes it, signed by `key` (its assistant): → { addr, letters, all, slugs }. The z tags
 * name the publisher's own firmware concepts (39998:<key>:<slug>), which this graph doesn't hold.
 */
function conceptLetters(key, slug, { plural = `${slug}s`, at = 1700000100 } = {}) {
  const pk = key.pubkey;
  const A = (d, kind = 39999) => `${kind}:${pk}:${d}`;
  const fw = (s) => `39998:${pk}:${s}`;
  const addr = {
    header: A(slug, 39998), superset: A(`${slug}-superset`), schema: A(`${slug}-schema`), primaryProperty: A(`${slug}-primary-property`),
    properties: A(`${slug}-properties`), propertyTreeGraph: A(`${slug}-property-tree-graph`), coreNodesGraph: A(`${slug}-core-nodes-graph`),
    conceptGraph: A(`${slug}-concept-graph`),
  };
  const sl = {
    header: roleSlug('concept-header', plural), superset: roleSlug('superset', plural), schema: roleSlug('json-schema', plural),
    primaryProperty: roleSlug('primary-property', plural), properties: roleSlug('properties', plural), propertyTreeGraph: roleSlug('property-tree-graph', plural),
    coreNodesGraph: roleSlug('core-nodes-graph', plural), conceptGraph: roleSlug('concept-graph', plural),
  };
  const node = (role) => ({ slug: sl[role], uuid: addr[role] });
  const rel = (from, type, to) => ({ nodeFrom: { slug: sl[from] }, relationshipType: { slug: type }, nodeTo: { slug: sl[to] } });
  const wordOf = (role, wordTypes, extra = {}) => ({ word: { slug: sl[role], name: `${sl[role].replace(/-/g, ' ')}`, wordTypes }, ...extra });
  const mk = (d, name, zs, body, kind = 39999) => letter(key, { kind, at, tags: [['d', d], ['name', name], ...zs.map((z) => ['z', fw(z)]), ['json', JSON.stringify(body)]] });
  const letters = {
    header: letter(key, { kind: 39998, at, tags: [['d', slug], ['names', slug, plural], ['z', fw('concept-header')], ['json', JSON.stringify(wordOf('header', ['word', 'conceptHeader'], { conceptHeader: { oNames: { singular: slug, plural }, oKeys: { singular: slug, plural } } }))]] }),
    superset: mk(`${slug}-superset`, `superset for the concept of ${plural}`, ['superset', 'word'], wordOf('superset', ['word', 'superset'], { superset: { slug: `${slug}-superset` } })),
    schema: mk(`${slug}-schema`, `json schema for the concept of ${plural}`, ['json-schema', 'word'], wordOf('schema', ['word', 'jsonSchema'], { jsonSchema: { type: 'object', properties: { [slug]: { type: 'object', required: ['name'], properties: { name: { type: 'string' } } } } } })),
    primaryProperty: mk(`${slug}-primary-property`, `primary property for the concept of ${plural}`, ['primary-property', 'property', 'word'], wordOf('primaryProperty', ['word', 'property', 'primaryProperty'], { property: { key: slug, type: 'object' } })),
    properties: mk(`${slug}-properties`, `properties for the concept of ${plural}`, ['properties-set', 'set', 'word'], wordOf('properties', ['word', 'set', 'propertiesSet'], { set: { slug: `${slug}-properties` } })),
    propertyTreeGraph: mk(`${slug}-property-tree-graph`, `property tree graph for the concept of ${plural}`, ['property-tree-graph', 'graph', 'word'], wordOf('propertyTreeGraph', ['word', 'graph', 'propertyTreeGraph'], {
      graph: { nodes: [node('schema'), node('primaryProperty')], relationshipTypes: [{ slug: 'IS_A_PROPERTY_OF' }], relationships: [rel('primaryProperty', 'IS_A_PROPERTY_OF', 'schema')], imports: [] },
    })),
    coreNodesGraph: mk(`${slug}-core-nodes-graph`, `core nodes graph for the concept of ${plural}`, ['core-nodes-graph', 'graph', 'word'], wordOf('coreNodesGraph', ['word', 'graph', 'coreNodesGraph'], {
      graph: {
        nodes: ['header', 'superset', 'schema', 'primaryProperty', 'properties', 'propertyTreeGraph', 'conceptGraph', 'coreNodesGraph'].map(node),
        relationships: [
          rel('header', 'IS_THE_CONCEPT_FOR', 'superset'), rel('schema', 'IS_THE_JSON_SCHEMA_FOR', 'header'), rel('primaryProperty', 'IS_THE_PRIMARY_PROPERTY_FOR', 'header'),
          rel('properties', 'IS_THE_PROPERTIES_SET_FOR', 'header'), rel('propertyTreeGraph', 'IS_THE_PROPERTY_TREE_GRAPH_FOR', 'header'),
          rel('coreNodesGraph', 'IS_THE_CORE_GRAPH_FOR', 'header'), rel('conceptGraph', 'IS_THE_CONCEPT_GRAPH_FOR', 'header'),
        ],
        imports: [],
      },
    })),
    conceptGraph: mk(`${slug}-concept-graph`, `concept graph for the concept of ${plural}`, ['concept-graph', 'graph', 'word'], wordOf('conceptGraph', ['word', 'graph', 'conceptGraph'], {
      graph: { nodes: [node('header'), node('superset')], relationships: [rel('header', 'IS_THE_CONCEPT_FOR', 'superset')], imports: [node('propertyTreeGraph'), node('coreNodesGraph')] },
    })),
  };
  return { addr, letters, all: Object.values(letters), slugs: sl, key };
}

/** The wiring conceptLetters' graphs list: [from address, type, to address]. */
function wiringOf(c) {
  const a = c.addr;
  return [
    [a.header, 'IS_THE_CONCEPT_FOR', a.superset], [a.schema, 'IS_THE_JSON_SCHEMA_FOR', a.header], [a.primaryProperty, 'IS_THE_PRIMARY_PROPERTY_FOR', a.header],
    [a.properties, 'IS_THE_PROPERTIES_SET_FOR', a.header], [a.propertyTreeGraph, 'IS_THE_PROPERTY_TREE_GRAPH_FOR', a.header],
    [a.coreNodesGraph, 'IS_THE_CORE_GRAPH_FOR', a.header], [a.conceptGraph, 'IS_THE_CONCEPT_GRAPH_FOR', a.header], [a.primaryProperty, 'IS_A_PROPERTY_OF', a.schema],
  ];
}

function relationshipLetter(key, { d, from, to, type, at = 1700000200 }) {
  return letter(key, { kind: 39999, at, tags: [['d', d], ['name', `${type} ${d}`], ['z', `39998:${key.pubkey}:relationship`], ['nodeFrom', from], ['nodeTo', to], ['relationshipType', type]] });
}

/** A graph element: nodes [{ slug, uuid }], relationships [[fromSlug, type, toSlug]], imports [{ slug, uuid }]. */
function graphLetter(key, { d, nodes = [], relationships = [], imports = [], at = 1700000300, json: raw = null, name = null }) {
  const body = raw !== null ? raw : JSON.stringify({
    word: { slug: d, name: name || d, wordTypes: ['word', 'graph'] },
    graph: { nodes, relationships: relationships.map(([f, t, to]) => ({ nodeFrom: { slug: f }, relationshipType: { slug: t }, nodeTo: { slug: to } })), imports },
  });
  return letter(key, { kind: 39999, at, tags: [['d', d], ['name', name || d], ['z', `39998:${key.pubkey}:graph`], ['json', body]] });
}

// ── the graph ──
function emptyGraph() { return { nodes: [], rels: [], failures: {}, log: [], nextEid: 1 }; }
const cy = (state, cypher, params = {}) => E.run(state, cypher, params).rows;

let builder = null;
/** Today's builder, required once, quietly (it logs at load). */
function buildImportCypher(event) {
  if (!builder) {
    const saved = {};
    for (const k of ['log', 'info', 'warn', 'debug']) { saved[k] = console[k]; console[k] = () => {}; }
    try { builder = require(path.join(ROOT, 'src/api/neo4j/eventSync.js')).buildImportCypher; } finally { Object.assign(console, saved); }
  }
  return builder(event);
}
/** Today's buildImportCypher(event), run whole over `state`: the node it leaves. */
function today(state, event) {
  for (const q of buildImportCypher(event)) E.run(state, q, {});
  return nodesAt(state, todaysUuidOf(event))[0] || null;
}
function label(state, uuid, labels) { if (labels.length) cy(state, `MATCH (n:TapestryNode {uuid: $u}) SET ${labels.map((l) => `n:${l}`).join(', ')}`, { u: uuid }); }
function wire(state, from, type, to, props = {}) {
  if (!/^[A-Z_][A-Z0-9_]*$/.test(type)) throw new Error(`wire: ${type} is not a type`);
  cy(state, `MATCH (a:TapestryNode {uuid: $a}), (b:TapestryNode {uuid: $b}) MERGE (a)-[r:${type}]->(b) SET r += $props`, { a: from, b: to, props });
}
/** A node made here with no letter, as src/operations/catalog/graph/_eventless.js makes one: no id, no NostrEvent. */
function eventless(state, { uuid, kind = 39999, labels = ['ListItem'], name, pubkey, createdAt = 1700000000 }) {
  cy(state, `CREATE (n:${labels.join(':')} {uuid: $uuid, kind: $kind, pubkey: $pubkey, name: $name, tapestryValue: $name, created_at: $createdAt})
    FOREACH (_ IN CASE WHEN NOT n:TapestryNode OR n.tapestryKey IS NULL THEN [1] ELSE [] END | SET n:TapestryNode, n.tapestryKey = randomUUID())`, { uuid, kind, pubkey, name, createdAt });
  return nodesAt(state, uuid)[0];
}

/**
 * The assistant's own concept `slug`, as today's signing routes leave it (create-concept, create-set, create-element):
 * its letters imported by today's builder, with the role labels and the wiring the routes add after; a set under its
 * superset (its own letter, with its s tag); an element of its own letter in the set; and an element made here with
 * no letter in the superset. → { c, addr, letters }.
 */
function ownConcept(state, { key = KEYS.ta, slug = 'dog', plural = `${slug}s`, at = 1690000000 } = {}) {
  const c = conceptLetters(key, slug, { plural, at });
  for (const e of c.all) today(state, e);
  const a = c.addr;
  label(state, a.header, ['ConceptHeader']);
  label(state, a.superset, ['Superset']);
  label(state, a.schema, ['JSONSchema']);
  label(state, a.primaryProperty, ['Property']);
  label(state, a.properties, ['Set']);
  for (const [f, t, to] of wiringOf(c)) wire(state, f, t, to);
  const set = letter(key, { kind: 39999, at, tags: [['d', `big-${plural}`], ['name', `big ${plural}`], ['z', `39998:${key.pubkey}:set`], ['s', a.superset]] });
  today(state, set);
  label(state, addressOf(set), ['Set']);
  wire(state, a.superset, 'IS_A_SUPERSET_OF', addressOf(set));
  const element = letter(key, { kind: 39999, at, tags: [['d', `${slug}-rex`], ['name', 'Rex'], ['z', a.header], ['n', addressOf(set)], ['json', JSON.stringify({ word: { slug: `${slug}-rex`, name: 'Rex', wordTypes: ['word', slug] }, [slug]: { name: 'Rex' } })]] });
  today(state, element);
  wire(state, addressOf(set), 'HAS_ELEMENT', addressOf(element));
  const madeHere = eventless(state, { uuid: `39999:${key.pubkey}:${slug}-made-here`, labels: ['ListItem'], name: 'Made Here', pubkey: key.pubkey });
  wire(state, a.superset, 'HAS_ELEMENT', madeHere.props.uuid);
  return { c, addr: { ...a, set: addressOf(set), element: addressOf(element), madeHere: madeHere.props.uuid }, letters: { ...c.letters, set, element } };
}

// ── runs ──
/** The child's environment: graphOpsSuite's, with the throwaway assistant (signing) and, for ownerKey, that owner. */
function envFor(dir, { signing = true, ownerKey = null } = {}) {
  const env = S.childEnv(dir);
  if (signing) env.TA_PUBKEY = KEYS.ta.pubkey;
  if (ownerKey) {
    fs.writeFileSync(env.BRAINSTORM_CONF_PATH, [`export BRAINSTORM_OWNER_PUBKEY="${ownerKey}"`, 'export NEO4J_URI="bolt://127.0.0.1:9"', 'export REDIS_HOST="127.0.0.1"', 'export REDIS_PORT="9"'].join(NL) + NL);
  }
  return env;
}

/**
 * One harness run with the cypher engine and the fake relays: → { req, cmd, spy, error, file, fixture, state(), log() }.
 * `relays` and `dns` are relayFake's fixture; `signing` gives the child the throwaway assistant (KEYS.ta); ownerKey
 * makes that pubkey the owner.
 */
function runImport({ state = null, file = null, relays = {}, dns = DNS, live = {}, timing = {}, pauseMs = 0, requests = [], cli = [], signing = true, ownerKey = null, spy = false, label: name = 'import-nostr', check = true } = {}) {
  const dir = file ? path.dirname(file) : S.tmp(`${name}-`);
  const stateFile = file || path.join(dir, 'graph.json');
  if (state) CG.writeState(stateFile, state);
  else if (!fs.existsSync(stateFile)) CG.writeState(stateFile, emptyGraph());
  const fixture = R.writeFixture(path.join(dir, `relays-${crypto.randomUUID()}.json`), { relays, dns, live, timing });
  const spec = { spy, scenarios: [{ graphFake: { stateFile, engine: 'cypher' }, relayFake: { file: fixture }, requests, cli, ...(pauseMs ? { pauseMs } : {}) }] };
  if (ownerKey) spec.owner = ownerKey;
  const r = S.runHarness(spec, { dir, env: envFor(dir, { signing, ownerKey }) });
  // check false: the caller looks at the child itself first (review round 1: a child that died), then calls answered().
  const rest = { file: stateFile, fixture, state: () => CG.readState(stateFile), log: () => R.readLog(fixture), raw: r };
  return check ? { ...S.answered(r), ...rest } : { ...rest, answered: () => S.answered(r) };
}

/** One harness run with graphFake.js over a copy of `state`, for the reads and writes of other operations. */
function readWith(state, requests, { signing = true, lmdb = null } = {}) {
  const dir = S.tmp('import-nostr-read-');
  const stateFile = path.join(dir, 'graph.json');
  CG.writeState(stateFile, { ...state, failures: {}, log: [] });
  if (lmdb) lmdb(dir);
  const r = S.runHarness({ scenarios: [{ graphFake: { stateFile }, requests }] }, { dir, env: envFor(dir, { signing }) });
  return { ...S.answered(r), state: () => CG.readState(stateFile) };
}

const imp = (id, caller, body, extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body, ...extra });
const history = (id, query, caller = 'owner') => ({ id, method: 'GET', url: `/api/tapestry/graph/history?${query}&limit=200`, caller });

/** The answer's data, asserting 200 and success. */
function data(a, id) {
  const r = a.req(id);
  assert(r.status === 200 && r.body && r.body.success === true, `${id} answers 200 with success; got ${r.status} ${show(r.body).slice(0, 700)}`);
  return r.body.data;
}
/** The refusal's body, asserting its status and code. */
function refused(a, id, status, code) {
  const r = a.req(id);
  assert(r.status === status && r.body && r.body.success === false && r.body.code === code, `${id} is refused ${status} ${code}; got ${r.status} ${show(r.body).slice(0, 500)}`);
  return r.body;
}
/** The events of an answer for one ref, or one id. */
const forRef = (d, ref) => (d.events || []).filter((e) => e.ref === ref);
const forId = (d, id) => (d.events || []).filter((e) => e.id === id);

// ── readers ──
const live = (s) => s.nodes.filter((n) => !n.labels.includes('GraphChange'));
const nodesAt = (s, uuid) => live(s).filter((n) => n.props.uuid === uuid);
const withId = (s, id) => live(s).filter((n) => n.props.id === id);
const byKey = (s, k) => s.nodes.find((n) => n.props.tapestryKey === k) || null;
const byEid = (s, eid) => s.nodes.find((n) => n.eid === eid) || null;
const isPlaceholder = (n) => !!n && n.labels.includes('NostrEvent') && (n.props.created_at === undefined || n.props.created_at === null);
/** Relationships, { type, from, to, props, fromNode, toNode }, filtered by type and by the uuid (or id) at either end. */
function relsOf(s, { type = null, from = null, to = null } = {}) {
  const at = (n, v) => !!n && (n.props.uuid === v || n.props.id === v || n.props.tapestryKey === v || n.eid === v);
  return s.rels.map((r) => ({ ...r, fromNode: byEid(s, r.from), toNode: byEid(s, r.to) }))
    .filter((r) => (!type || r.type === type) && (!from || at(r.fromNode, from)) && (!to || at(r.toNode, to)));
}
/** A node's tag nodes, in the order of their uuid's index. */
function tagsOf(s, node) {
  const idx = (t) => Number(String(t.props.uuid || '').split('_').pop());
  return relsOf(s, { type: 'HAS_TAG' }).filter((r) => r.from === node.eid).map((r) => r.toNode).filter(Boolean).sort((a, b) => idx(a) - idx(b));
}
const personsOf = (s, pubkey) => live(s).filter((n) => n.labels.includes('NostrUser') && n.props.pubkey === pubkey);
const entries = (s) => S.entriesOf(s);

/** The graph without keys or change entries, so two graphs built in different orders can be compared whole. */
function canonical(s) {
  const nodes = live(s);
  const eids = new Map(nodes.map((n) => [n.eid, n]));
  const nameOf = (n) => (n.labels.includes('NostrUser') ? `user:${n.props.pubkey}` : n.labels.includes('NostrEventTag') ? `tag:${n.props.uuid}` : `node:${n.props.uuid || n.props.id}`);
  const sorted = (o) => Object.keys(o).sort().reduce((x, k) => { x[k] = o[k]; return x; }, {});
  const ns = nodes.map((n) => ({ k: nameOf(n), labels: [...n.labels].sort(), props: sorted(Object.fromEntries(Object.entries(n.props).filter(([k]) => k !== 'tapestryKey'))) }))
    .sort((a, b) => a.k.localeCompare(b.k) || JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const rs = s.rels.filter((r) => eids.has(r.from) && eids.has(r.to))
    .map((r) => `${nameOf(eids.get(r.from))} -[${r.type} ${JSON.stringify(sorted(r.props || {}))}]-> ${nameOf(eids.get(r.to))}`).sort();
  return { nodes: ns, rels: rs };
}
const sameGraph = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
/** What differs between two canonical graphs, for a failure's message. */
function graphDiff(a, b) {
  const ca = canonical(a), cb = canonical(b);
  const na = new Set(ca.nodes.map((x) => JSON.stringify(x))), nb = new Set(cb.nodes.map((x) => JSON.stringify(x)));
  const ra = new Set(ca.rels), rb = new Set(cb.rels);
  return {
    nodesOnlyFirst: [...na].filter((x) => !nb.has(x)).slice(0, 6), nodesOnlySecond: [...nb].filter((x) => !na.has(x)).slice(0, 6),
    relsOnlyFirst: [...ra].filter((x) => !rb.has(x)).slice(0, 6), relsOnlySecond: [...rb].filter((x) => !ra.has(x)).slice(0, 6),
  };
}

/** A relay fixture entry holding `events`. */
const relay = (events, extra = {}) => ({ events: json(events), ...extra });

module.exports = {
  ROOT, ROUTE, DECL, OWN_RELAY, PEER_RELAY, OTHER_INSTANCE, DNS, KEYS, NT,
  needDecl, keyFrom, letter, forged, foreignSig, addressOf, uuidOf, todaysUuidOf, nip, roleSlug, conceptLetters, wiringOf,
  relationshipLetter, graphLetter,
  emptyGraph, cy, buildImportCypher, today, label, wire, eventless, ownConcept,
  envFor, runImport, readWith, imp, history, data, refused, forRef, forId,
  live, nodesAt, withId, byKey, byEid, isPlaceholder, relsOf, tagsOf, personsOf, entries, canonical, sameGraph, graphDiff, relay,
};
