'use strict';
/**
 * What today's firmware install signs for each firmware node, run from today's routes' own code — story
 * graph-operations-first-slice #37 (Loom A10.37), ADR graph-operations-first-slice/0037 (Implementation notes: "AC1's
 * oracles are today's routes run from their source in node:vm … that helper [todaysCreateConcept.js], extended with
 * dTag, overwrite and conceptHeaderOverrides; new ones, in the same way, for create-element, create-set and
 * save-schema").
 *
 * As test/helpers/todaysCreateConcept.js runs create-concept, this runs, from src/api/normalize/index.js, in one
 * sandbox (node:vm) per install:
 *   handleCreateConcept (pass 1a), handleCreateElement (1b), handleAddNodeAsElement (1c, which also rewrites the
 *   parent concept's concept graph), handleCreateSet (1c½, with its relationship letter), handleSaveSchema (pass 2,
 *   with the primary-property fold it calls, reconcilePrimaryPropertyForConcept) and regenerateJson (which both
 *   re-sign through).
 * Signing, the relay and Neo4j are replaced: the signer gives each letter NIP-01's id over its fields, from the
 * assistant's pubkey, with no key and no signature; publishing is recorded; the import keeps each node's last
 * letter in a small store, with the labels and the slug the routes SET and the edges they MERGE; and each read a
 * route makes is answered from that store by what it asks (a read the store doesn't know throws, naming it, so a
 * route that changes makes this fail, saying where). So the oracle can't drift from the routes.
 *
 * The walk over the firmware folder — which files, in which order, with which names — is install.js's passes 1a, 1b,
 * 1c, 1c½, 2 and the community references' b seed (src/firmware/install.js), followed here line by line, since
 * install.js doesn't export them. Pass 3b isn't run (ADR 0037 Decision 5); the edge passes (1c's existing sets, 1c¾,
 * 1d, 1d½, 1d¾, 1e, 3c) write no letter, and the suites pin them against expectations worked out from the files.
 *
 *   todaysFirmware({ dir, ta }) → {
 *     manifest, version,
 *     letters: Map(address → { address, kind, role, concept, file, name, tags, labels, json, slug, id, created_at }),
 *       the last letter today's install signs at each address but a set's relationship letter; tags as signed; labels
 *       the role labels (ListHeader, ConceptHeader, ListItem, Superset, Set, JSONSchema, Property); json the json
 *       tag's value parsed, or null; slug the element's slug property, or null;
 *     relationshipLetters: [{ address, tags, name, nodeFrom, nodeTo, relationshipType, id, created_at, file }],
 *     rewrittenBy1c: Map(address → the letter create-concept signed), for each concept graph pass 1c's
 *       add-node-as-element re-signed (node-type's, graph-type's and validation-tool-type's for firmware/active): the
 *       form the target keeps (ADR 0037 Amendment 1);
 *     edges: [{ from, type, to }], the relationships the routes MERGE, in order, before any pass prunes;
 *     headerOf(slug) → the concept's header address; supersetOf(slug) → its superset's address;
 *     elementOf(file) → the address of the element made from that file ('concepts/<slug>/elements/<name>.json');
 *     setOf(file) → the address of the set made from that file;
 *     published: how many letters were signed
 *   }
 *   tagUuid(uuid, tag, i)   the uuid importEventDirect gives a node's i-th tag node
 *   fakeKey(address)        a tapestryKey for an address, deterministic
 *
 * Nothing here opens Neo4j, a relay, a key or the network.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const CC = require('./todaysCreateConcept');

const ROOT = path.resolve(__dirname, '..', '..');
const INDEX = path.join(ROOT, 'src/api/normalize/index.js');
const ROLE_LABELS = Object.freeze(['ListHeader', 'ConceptHeader', 'ListItem', 'Superset', 'Set', 'JSONSchema', 'Property']);
const REL_NAMES = ['CLASS_THREAD_INITIATION', 'CLASS_THREAD_PROPAGATION', 'CLASS_THREAD_TERMINATION', 'CORE_NODE_JSON_SCHEMA', 'CORE_NODE_PRIMARY_PROPERTY',
  'CORE_NODE_PROPERTIES', 'CORE_NODE_PROPERTY_TREE_GRAPH', 'CORE_NODE_CORE_GRAPH', 'CORE_NODE_CONCEPT_GRAPH', 'PROPERTY_MEMBERSHIP', 'PROPERTY_ENUMERATION'];
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const oneLine = (q) => String(q).replace(/\s+/g, ' ').trim();

let SLICES = null;
/** The routes' code, as src/api/normalize/index.js has it. */
function slices() {
  if (SLICES) return SLICES;
  const src = fs.readFileSync(INDEX, 'utf8');
  const slice = (from, to, what) => {
    const at = src.search(from);
    if (at < 0) throw new Error(`test/helpers/todaysFirmwareRoutes.js can't find ${what} in src/api/normalize/index.js (looked for ${from}); the route moved, so move this oracle with it`);
    const rest = src.slice(at);
    const end = rest.search(to);
    if (end < 0) throw new Error(`test/helpers/todaysFirmwareRoutes.js can't find the end of ${what} in src/api/normalize/index.js (looked for ${to})`);
    return rest.slice(0, end);
  };
  const concept = CC.source();
  SLICES = {
    deriveSlug: slice(/^function deriveSlug\(/m, /^function toCamelCase\(/m, 'deriveSlug'),
    regenerateJson: slice(/^async function regenerateJson\(/m, /^let _cachedPrivkey/m, 'regenerateJson'),
    names: concept.names,
    createConcept: concept.handler,
    createElement: slice(/^async function handleCreateElement\(/m, /^\/\/ ═+\n\/\/ POST \/api\/normalize\/save-schema/m, 'handleCreateElement'),
    saveSchema: slice(/^const TAPESTRY_KEY = new RegExp\(KEY_PATTERN\);/m, /^\/\/ ═+\n\/\/ POST \/api\/normalize\/reconcile-primary-property/m, 'findSchemaHeader and handleSaveSchema'),
    reconcile: slice(/^async function reconcilePrimaryPropertyForConcept\(/m, /^async function handleReconcilePrimaryProperty\(/m, 'reconcilePrimaryPropertyForConcept'),
    addNodeAsElement: slice(/^async function handleAddNodeAsElement\(/m, /^\/\/ POST \/api\/normalize\/migrate-primary-property-ztags/m, 'handleAddNodeAsElement'),
    createSet: slice(/^async function handleCreateSet\(/m, /^\/\/ ═+\n\/\/ POST \/api\/normalize\/add-to-set/m, 'handleCreateSet'),
  };
  return SLICES;
}

function rel() {
  const firmware = require(path.join(ROOT, 'src/api/normalize/firmware.js'));
  return Object.fromEntries(REL_NAMES.map((k) => [k, firmware.relAlias(k)]));
}

/** The uuid importEventDirect gives a node's i-th tag node (src/api/normalize/index.js). */
const tagUuid = (uuid, tag, i) => sha256(`${uuid}:${tag.join(',')}:${i}`);
/** A tapestryKey for an address: deterministic, in the key's form. */
function fakeKey(address) {
  const h = sha256(`tapestry-key:${address}`);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
/** NIP-01's id over an event's fields. */
const eventId = (e) => sha256(JSON.stringify([0, e.pubkey, e.created_at, e.kind, e.tags, e.content]));

/** A sandbox with every route above loaded over one store. */
function sandbox(ta, manifestSlugs) {
  const R = rel();
  const store = new Map(); // uuid → { event, labels: Set, slug, key }
  const edges = []; // { from, type, to, props }
  const published = [];
  let clock = 1700000000;
  let randoms = 0;
  const node = (uuid) => store.get(uuid) || null;
  const nameOf = (e) => { const n = e.tags.find((t) => t[0] === 'name'); const ns = e.tags.find((t) => t[0] === 'names'); return (n && n[1]) || (ns && ns[1]) || ''; };
  const tagsOf = (uuid) => { const n = node(uuid); return n ? n.event.tags : []; };
  const jsonOf = (uuid) => { const t = tagsOf(uuid).find((x) => x[0] === 'json'); return t ? t[1] : null; };
  const out = (from, type) => edges.filter((x) => x.from === from && x.type === type).map((x) => x.to);
  const inc = (to, type) => edges.filter((x) => x.to === to && x.type === type).map((x) => x.from);
  const hasLabel = (uuid, l) => { const n = node(uuid); return !!n && n.labels.has(l); };
  const supersetOfHeader = (h) => out(h, R.CLASS_THREAD_INITIATION).find((s) => hasLabel(s, 'Superset')) || null;
  const merge = (from, type, to, props = {}) => {
    if (!node(from) || !node(to)) return; // MATCH (a), (b) found nothing: MERGE makes nothing
    const e = edges.find((x) => x.from === from && x.type === type && x.to === to);
    if (e) Object.assign(e.props, props); else edges.push({ from, type, to, props: { ...props } });
  };
  /** The uuids a walk reaches from `start` over `types`, min..max steps (no relationship twice). */
  function reach(start, types, min, max) {
    const found = new Set();
    const walk = (at, depth, used) => {
      if (depth >= min) found.add(at);
      if (depth >= max) return;
      edges.forEach((x, i) => { if (x.from === at && types.includes(x.type) && !used.has(i)) walk(x.to, depth + 1, new Set([...used, i])); });
    };
    walk(start, 0, new Set());
    return [...found];
  }

  function importEventDirect(event, uuid) {
    const was = node(uuid);
    const labels = was ? was.labels : new Set();
    labels.add(event.kind === 39998 ? 'ListHeader' : 'ListItem');
    store.set(uuid, { event: JSON.parse(JSON.stringify(event)), labels, slug: was ? was.slug : null, key: was ? was.key : fakeKey(uuid) });
  }
  function signAndFinalize(t) {
    const e = { kind: t.kind, created_at: t.created_at || clock++, tags: JSON.parse(JSON.stringify(t.tags || [])), content: t.content || '', pubkey: ta };
    return { ...e, id: eventId(e), sig: '' };
  }
  const unknown = (what, q) => { throw new Error(`test/helpers/todaysFirmwareRoutes.js doesn't know a ${what} today's routes made: ${oneLine(q).slice(0, 300)}`); };

  async function runCypher(q, p = {}) {
    const s = oneLine(q);
    // create-concept: a firmware concept's superset (step 11), and add-node-as-element's header with its superset.
    if (/^MATCH \(h:NostrEvent\|TapestryNode \{uuid: \$fwConceptUuid\}\)-\[:\w+\]->\(sup:Superset\) RETURN sup\.uuid AS supersetUuid LIMIT 1$/.test(s)) {
      const sup = supersetOfHeader(p.fwConceptUuid);
      return sup ? [{ supersetUuid: sup }] : [];
    }
    // create-element: the concept's header by name, its superset and its b tags.
    if (/^MATCH \(h:NostrEvent\) WHERE \(h:ListHeader OR h:ClassThreadHeader\) AND h\.kind IN \[9998, 39998\] AND h\.name = \$concept OPTIONAL MATCH/.test(s)) {
      for (const [uuid, n] of store) {
        if (n.event.kind !== 39998 || !n.labels.has('ListHeader') || nameOf(n.event) !== p.concept) continue;
        const b = n.event.tags.filter((t) => t[0] === 'b').map((t) => ({ value: t[1], type: t[2] || null }));
        return [{ headerUuid: uuid, headerName: nameOf(n.event), supersetUuid: supersetOfHeader(uuid), bRows: b.length ? b : [{ value: null, type: null }] }];
      }
      return [];
    }
    // create-element: an element of that name already in the concept's class thread.
    if (/^MATCH \(sup:Superset \{uuid: \$supersetUuid\}\)-\[:\w+\*0\.\.5\]->\(s\)-\[:\w+\]->\(e:NostrEvent\|ListItem\) WHERE e\.name = \$name RETURN e\.uuid AS uuid LIMIT 1$/.test(s)) {
      for (const set of reach(p.supersetUuid, [R.CLASS_THREAD_PROPAGATION], 0, 5)) {
        for (const e of out(set, R.CLASS_THREAD_TERMINATION)) if (node(e) && nameOf(node(e).event) === p.name) return [{ uuid: e }];
      }
      return [];
    }
    // create-set: the parent by uuid; and whether the set is already there.
    if (/^MATCH \(n:NostrEvent\|TapestryNode \{uuid: \$uuid\}\) RETURN n\.uuid AS uuid(, n\.name AS name)? LIMIT 1$/.test(s)) {
      const n = node(p.uuid);
      return n ? [{ uuid: p.uuid, name: nameOf(n.event) }] : [];
    }
    // save-schema: the header by its tapestryKey, its JSON schema node and that node's json.
    if (/^MATCH \(h:ListHeader\|ClassThreadHeader\|ConceptHeader\) WHERE h\.tapestryKey = \$tapestryKey OPTIONAL MATCH \(js:JSONSchema\)-\[:\w+\]->\(h\)/.test(s)) {
      for (const [uuid, n] of store) {
        if (n.key !== p.tapestryKey) continue;
        const schemas = inc(uuid, R.CORE_NODE_JSON_SCHEMA).filter((x) => hasLabel(x, 'JSONSchema')).sort();
        const slugTag = n.event.tags.find((t) => t[0] === 'slug');
        const row = (js) => ({ headerUuid: uuid, author: ta, lettered: true, schemaUuid: js, schemaLettered: js ? true : null, existingJson: js ? jsonOf(js) : null, slug: slugTag ? slugTag[1] : null });
        return schemas.length ? schemas.map(row) : [row(null)];
      }
      return [];
    }
    // regenerateJson: a node's tags, in the order of their tag nodes' uuids.
    if (/^MATCH \(e:NostrEvent\|TapestryNode \{uuid: \$uuid\}\)-\[:HAS_TAG\]->\(t:NostrEventTag\) RETURN t\.type AS type, t\.value AS value, t\.value1 AS value1, t\.value2 AS value2 ORDER BY t\.uuid$/.test(s)) {
      return tagsOf(p.uuid).map((t, i) => ({ u: tagUuid(p.uuid, t, i), type: t[0], value: t[1] || '', value1: t[2] || null, value2: t[3] || null }))
        .sort((a, b) => (a.u < b.u ? -1 : a.u > b.u ? 1 : 0)).map(({ u, ...r }) => r);
    }
    // The primary-property fold: the schema's json and the primary property's, by the header's address.
    if (/^MATCH \(h:NostrEvent\|TapestryNode \{uuid: \$headerUuid\}\) OPTIONAL MATCH \(js:JSONSchema\)-\[:\w+\]->\(h\) OPTIONAL MATCH \(js\)-\[:HAS_TAG\]->\(jt:NostrEventTag \{type: 'json'\}\) OPTIONAL MATCH \(pp:Property\)/.test(s)) {
      if (!node(p.headerUuid)) return [];
      const js = inc(p.headerUuid, R.CORE_NODE_JSON_SCHEMA).filter((x) => hasLabel(x, 'JSONSchema')).sort()[0] || null;
      const pp = inc(p.headerUuid, R.CORE_NODE_PRIMARY_PROPERTY).filter((x) => hasLabel(x, 'Property')).sort()[0] || null;
      return [{ headerUuid: p.headerUuid, schemaUuid: js, schemaJson: js ? jsonOf(js) : null, ppUuid: pp, ppJson: pp ? jsonOf(pp) : null }];
    }
    // add-node-as-element: the concept by its header's address, with its superset and its concept graph.
    if (/^MATCH \(h:NostrEvent\|TapestryNode \{uuid: \$conceptUuid\}\)-\[:\w+\]->\(sup:Superset\) OPTIONAL MATCH \(ctg\)-\[:\w+\]->\(h\) RETURN h\.name AS conceptName/.test(s)) {
      const sup = supersetOfHeader(p.conceptUuid);
      if (!sup) return [];
      const graphs = inc(p.conceptUuid, R.CORE_NODE_CONCEPT_GRAPH);
      return (graphs.length ? graphs : [null]).map((g) => ({ conceptName: nameOf(node(p.conceptUuid).event), headerUuid: p.conceptUuid, supersetUuid: sup, supersetName: nameOf(node(sup).event), classGraphUuid: g }));
    }
    if (/^MATCH \(n:NostrEvent\|TapestryNode \{uuid: \$nodeUuid\}\) RETURN n\.name AS name, n\.uuid AS uuid, labels\(n\) AS labels$/.test(s)) {
      const n = node(p.nodeUuid);
      return n ? [{ name: nameOf(n.event), uuid: p.nodeUuid, labels: ['NostrEvent', ...n.labels] }] : [];
    }
    if (/^MATCH \(sup:NostrEvent\|TapestryNode \{uuid: \$supersetUuid\}\)-\[:\w+\]->\(n:NostrEvent\|TapestryNode \{uuid: \$nodeUuid\}\) RETURN count\(\*\) AS cnt$/.test(s)) {
      return [{ cnt: out(p.supersetUuid, R.CLASS_THREAD_TERMINATION).includes(p.nodeUuid) ? 1 : 0 }];
    }
    if (/^MATCH \(h:NostrEvent\|TapestryNode \{uuid: \$conceptUuid\}\)-\[:\w+\]->\(sup:Superset\) OPTIONAL MATCH \(sup\)-\[:\w+\*0\.\.10\]->\(s\) WHERE s:Superset OR s:NostrEvent\|ListItem RETURN DISTINCT s\.uuid AS uuid, s\.name AS name$/.test(s)) {
      const sup = supersetOfHeader(p.conceptUuid);
      if (!sup) return [];
      return reach(sup, [R.CLASS_THREAD_PROPAGATION], 0, 10).filter((x) => node(x)).map((x) => ({ uuid: x, name: nameOf(node(x).event) }));
    }
    return unknown('read', q);
  }

  async function writeCypher(q, p = {}) {
    const s = oneLine(q);
    let m;
    if ((m = s.match(/^MATCH \((\w+):NostrEvent\|TapestryNode \{uuid: \$uuid\}\) SET ((?:\w+:\w+(?:, )?)+)$/))) {
      const n = node(p.uuid);
      if (n) for (const x of m[2].split(',')) n.labels.add(x.trim().split(':')[1]);
      return [];
    }
    if ((m = s.match(/^MATCH \(n:NostrEvent\|TapestryNode \{uuid: \$uuid\}\) SET n:(\w+), n\.slug = \$slug$/))) {
      const n = node(p.uuid);
      if (n) { n.labels.add(m[1]); n.slug = p.slug; }
      return [];
    }
    if ((m = s.match(/^MATCH \(a:NostrEvent\|TapestryNode \{uuid: \$from\}\), \(b:NostrEvent\|TapestryNode \{uuid: \$to\}\) MERGE \(a\)-\[:(\w+)\]->\(b\)$/))) { merge(p.from, m[1], p.to); return []; }
    if ((m = s.match(/^MATCH \(sup:NostrEvent\|TapestryNode \{uuid: \$supersetUuid\}\), \((?:node|elem):NostrEvent\|TapestryNode \{uuid: \$(nodeUuid|elemUuid)\}\) MERGE \(sup\)-\[:(\w+)\]->\((?:node|elem)\)$/))) {
      merge(p.supersetUuid, m[2], p[m[1]]);
      return [];
    }
    return unknown('write', q);
  }

  const firmware = {
    conceptUuid: (slug) => (manifestSlugs.has(slug) ? `39998:${ta}:${slug}` : null),
    getTAPubkey: () => ta,
  };
  const ctx = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    JSON, Object, Set, Map, Math, Date, Array, String, Number, Promise, RegExp, Error, Buffer,
    require: createRequire(INDEX),
    getPrivkey: () => new Uint8Array(32),
    nt: () => ({ getPublicKey: () => ta }),
    runCypher,
    writeCypher,
    randomDTag: () => `random${String(++randoms).padStart(4, '0')}`,
    dtag: require(path.join(ROOT, 'src/lib/dtag.js')),
    signAndFinalize,
    publishToStrfry: async (e) => { published.push(e); },
    importEventDirect: async (event, uuid) => importEventDirect(event, uuid),
    firmware,
    REL: R,
    KEY_PATTERN: require(path.join(ROOT, 'src/operations/catalog/graph/_nodes.js')).KEY_PATTERN,
  };
  vm.createContext(ctx);
  const s = slices();
  vm.runInContext([
    s.deriveSlug, s.regenerateJson, s.names, s.createConcept, s.createElement, s.saveSchema, s.reconcile, s.addNodeAsElement, s.createSet,
    'this.routes = { createConcept: handleCreateConcept, createElement: handleCreateElement, saveSchema: handleSaveSchema, addNodeAsElement: handleAddNodeAsElement, createSet: handleCreateSet };',
  ].join('\n'), ctx, { filename: 'src/api/normalize/index.js (today\'s firmware routes, sandboxed)' });

  /** Call one route with a body, as Express would; resolves its JSON answer. */
  async function call(route, body) {
    let answer = null;
    let status = 200;
    const res = { json(x) { answer = x; return res; }, status(c) { status = c; return res; } };
    await ctx.routes[route]({ body: JSON.parse(JSON.stringify(body)) }, res);
    return { status, answer };
  }
  return { call, store, edges, published, R, signAndFinalize, importEventDirect, node, supersetOfHeader, nameOf, merge };
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
/** install.js's categoryToSlug. */
function categoryToSlug(category) {
  const overrides = { properties: 'property', sets: 'set' };
  return overrides[category] || category.replace(/s$/, '');
}
const posix = (...parts) => path.posix.join(...parts.map((p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '')));

/** What today's install signs at each address, for the firmware in `dir`; see the file's header. */
async function todaysFirmware({ dir, ta }) {
  if (typeof ta !== 'string' || !/^[0-9a-f]{64}$/.test(ta)) throw new Error('todaysFirmware needs the assistant pubkey, ta');
  const manifest = readJson(path.join(dir, 'manifest.json'));
  const slugs = new Set(manifest.concepts.map((c) => c.slug));
  const sb = sandbox(ta, slugs);
  const role = new Map(); // address → { role, concept, file }
  const mark = (address, r) => { if (address && !role.has(address)) role.set(address, r); };
  const elementFiles = new Map();
  const setFiles = new Map();
  const relationshipLetters = [];
  const refusedElements = [];
  const fail = (what, r) => { throw new Error(`today's ${what} didn't succeed in the sandbox: ${JSON.stringify(r.answer).slice(0, 300)}`); };

  // ── 1a: every concept, with overwrite, its d-tag its slug, its file's conceptHeader as overrides.
  for (const entry of manifest.concepts) {
    const headerFile = posix(entry.dir, entry.conceptHeader);
    const ch = readJson(path.join(dir, headerFile)).conceptHeader;
    const r = await sb.call('createConcept', { name: ch.oNames.singular, plural: ch.oNames.plural, description: ch.description, dTag: entry.slug, conceptHeaderOverrides: ch, overwrite: true });
    if (!r.answer || r.answer.success !== true) fail(`create-concept of ${entry.slug}`, r);
    const c = r.answer.concept;
    mark(c.uuid, { role: 'conceptHeader', concept: entry.slug, file: headerFile });
    for (const [k, rl] of [['superset', 'superset'], ['schema', 'jsonSchema'], ['primaryProperty', 'primaryProperty'], ['properties', 'properties'], ['propertyTreeGraph', 'propertyTreeGraph'], ['conceptGraph', 'conceptGraph'], ['coreGraph', 'coreNodesGraph']]) {
      mark(c[k], { role: rl, concept: entry.slug, file: headerFile });
    }
  }

  // ── 1b: each concept's elements, by file name, under the concept's lower-cased singular name.
  for (const entry of manifest.concepts) {
    const elemDir = path.join(dir, entry.dir, 'elements');
    if (!fs.existsSync(elemDir)) continue;
    const files = fs.readdirSync(elemDir).filter((f) => f.endsWith('.json')).sort();
    const conceptName = readJson(path.join(dir, entry.dir, entry.conceptHeader)).conceptHeader.oNames.singular.toLowerCase();
    for (const file of files) {
      const data = readJson(path.join(elemDir, file));
      const sectionKeys = Object.keys(data).filter((k) => k !== 'word');
      const conceptKey = sectionKeys[0];
      const elementName = data.word.name.includes(':') ? data.word.name.split(':').pop().trim() : (data[conceptKey] && data[conceptKey].name) || data.word.slug;
      // updateElements (graph-rule): on a graph with no such element, install's plan is create, so it goes on to
      // create-element as any other concept's element does (src/firmware/element-sync.js).
      const r = await sb.call('createElement', { concept: conceptName, name: elementName, json: data });
      const rel = posix(entry.dir, 'elements', file);
      // A refusal (the name already in the concept's class thread) is logged by install, which goes on: no letter.
      if (!r.answer || r.answer.success !== true) { refusedElements.push({ file: rel, error: r.answer && r.answer.error }); continue; }
      mark(r.answer.element.uuid, { role: 'element', concept: entry.slug, file: rel });
      elementFiles.set(rel, r.answer.element.uuid);
    }
  }

  // Each concept graph as create-concept made it, before 1c's add-node-as-element may rewrite it: the target keeps
  // this form (ADR 0037 Amendment 1, the owner's second departure, 2026-11-20).
  const conceptGraphs1a = new Map();
  for (const [address, n] of sb.store) {
    const r = role.get(address);
    if (r && r.role === 'conceptGraph') conceptGraphs1a.set(address, JSON.parse(JSON.stringify(n.event)));
  }

  // ── 1c: the manifest's existing nodes, as elements of the category's concept (add-node-as-element).
  const coreNodeTypeToRel = {
    'concept-header': null, superset: 'IS_THE_CONCEPT_FOR', 'json-schema': 'IS_THE_JSON_SCHEMA_FOR', 'primary-property': 'IS_THE_PRIMARY_PROPERTY_FOR',
    'properties-set': 'IS_THE_PROPERTIES_SET_FOR', 'property-tree-graph': 'IS_THE_PROPERTY_TREE_GRAPH_FOR', 'core-nodes-graph': 'IS_THE_CORE_GRAPH_FOR', 'concept-graph': 'IS_THE_CONCEPT_GRAPH_FOR',
  };
  for (const [category, data] of Object.entries(manifest.elements || {})) {
    if (Array.isArray(data)) continue;
    for (const e of data['existing-nodes'] || []) {
      const target = `39998:${ta}:${e.concept}`;
      const r = coreNodeTypeToRel[e['core-node-type']];
      let nodeUuid;
      if (r === null) nodeUuid = target;
      else if (r) nodeUuid = (e['core-node-type'] === 'superset' ? sb.edges.filter((x) => x.from === target && x.type === r) : sb.edges.filter((x) => x.to === target && x.type === r)).map((x) => (e['core-node-type'] === 'superset' ? x.to : x.from))[0];
      if (!nodeUuid) continue;
      await sb.call('addNodeAsElement', { conceptUuid: `39998:${ta}:${categoryToSlug(category)}`, nodeUuid });
    }
  }

  // ── 1c½: each concept's sets, under its superset, each with its relationship letter.
  for (const entry of manifest.concepts) {
    const setsDir = path.join(dir, entry.dir, 'sets');
    if (!fs.existsSync(setsDir)) continue;
    const files = fs.readdirSync(setsDir).filter((f) => f.endsWith('.json')).sort();
    const parentUuid = sb.supersetOfHeader(`39998:${ta}:${entry.slug}`);
    if (!parentUuid) continue;
    for (const file of files) {
      const data = readJson(path.join(setsDir, file));
      const fileSlug = file.replace(/\.json$/, '');
      const setName = (data.set && data.set.name) || (data.word && data.word.name) || fileSlug;
      const setDescription = (data.set && data.set.description) || '';
      const dTag = (data.word && data.word.slug) || fileSlug;
      const before = sb.published.length;
      const r = await sb.call('createSet', { name: setName, description: setDescription || undefined, parentUuid, dTag });
      if (!r.answer || r.answer.success !== true) fail(`create-set of ${file}`, r);
      const rel = posix(entry.dir, 'sets', file);
      mark(r.answer.set.uuid, { role: 'set', concept: entry.slug, file: rel });
      setFiles.set(rel, r.answer.set.uuid);
      for (const ev of sb.published.slice(before)) {
        const t = (k) => (ev.tags.find((x) => x[0] === k) || [])[1];
        if (!t('relationshipType')) continue;
        relationshipLetters.push({ address: `39999:${ta}:${t('d')}`, tags: ev.tags, name: t('name'), nodeFrom: t('nodeFrom'), nodeTo: t('nodeTo'), relationshipType: t('relationshipType'), id: ev.id, created_at: ev.created_at, file: rel, concept: entry.slug });
      }
    }
  }

  // ── Pass 2: each concept's schema, from its file, through save-schema with the header's tapestryKey.
  for (const entry of manifest.concepts) {
    if (!entry.jsonSchema) continue;
    const schemaFile = path.join(dir, entry.dir, entry.jsonSchema);
    if (!fs.existsSync(schemaFile)) continue;
    const firmwareSchema = readJson(schemaFile);
    const header = sb.node(`39998:${ta}:${entry.slug}`);
    if (!header) continue;
    const conceptName = readJson(path.join(dir, entry.dir, entry.conceptHeader)).conceptHeader.oNames.singular.toLowerCase();
    const r = await sb.call('saveSchema', { concept: conceptName, tapestryKey: header.key, schema: firmwareSchema.jsonSchema });
    if (!r.answer || r.answer.success !== true) fail(`save-schema of ${entry.slug}`, r);
  }

  // ── The community references: a pointer b on the instance's own header, unless it has a b (the seed).
  for (const entry of manifest.concepts) {
    const cr = entry.communityReference;
    if (!cr || !cr.headerATag) continue;
    const parts = String(cr.headerATag).split(':');
    if (parts.length < 3 || parts[0] !== '39998') continue;
    const uuid = `39998:${ta}:${entry.slug}`;
    const header = sb.node(uuid);
    if (!header || header.event.tags.some((t) => t[0] === 'b')) continue;
    const signed = sb.signAndFinalize({ kind: 39998, content: header.event.content || '', tags: [...header.event.tags, ['b', cr.headerATag, 'pointer']] });
    sb.published.push(signed);
    // buildImportCypher adds the new tags beside the old ones: as a set, the node's tags are the new letter's.
    sb.importEventDirect(signed, uuid);
  }

  const letters = new Map();
  for (const [address, n] of sb.store) {
    if (relationshipLetters.some((x) => x.address === address)) continue;
    const jt = n.event.tags.find((t) => t[0] === 'json');
    let json = null;
    if (jt) { try { json = JSON.parse(jt[1]); } catch { json = jt[1]; } }
    const r = role.get(address) || { role: null, concept: null, file: null };
    letters.set(address, {
      address, kind: n.event.kind, ...r, name: sb.nameOf(n.event), tags: n.event.tags.map((t) => [...t]),
      labels: ROLE_LABELS.filter((l) => n.labels.has(l)), json, slug: n.slug || null, id: n.event.id, created_at: n.event.created_at, key: n.key,
    });
  }
  // The concept graphs 1c re-signed, each as create-concept made it.
  const rewrittenBy1c = new Map();
  for (const [address, ev] of conceptGraphs1a) {
    const now = letters.get(address);
    if (!now || now.id === ev.id) continue;
    const jt = ev.tags.find((t) => t[0] === 'json');
    let json = null;
    if (jt) { try { json = JSON.parse(jt[1]); } catch { json = jt[1]; } }
    rewrittenBy1c.set(address, { ...now, tags: ev.tags.map((t) => [...t]), json, id: ev.id, created_at: ev.created_at });
  }
  const supersetOf = (slug) => sb.supersetOfHeader(`39998:${ta}:${slug}`);
  return {
    manifest, version: manifest.version, letters, relationshipLetters, edges: sb.edges.map((e) => ({ ...e, props: { ...e.props } })), rewrittenBy1c,
    headerOf: (slug) => `39998:${ta}:${slug}`, supersetOf, elementOf: (file) => elementFiles.get(file) || null, setOf: (file) => setFiles.get(file) || null,
    published: sb.published.length, refusedElements,
  };
}

module.exports = { todaysFirmware, tagUuid, fakeKey, eventId, ROLE_LABELS, categoryToSlug };
