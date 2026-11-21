'use strict';
/**
 * What lifecycle seed-firmware's suites share — story graph-operations-first-slice #37 (Loom A10.37), ADR
 * graph-operations-first-slice/0037. Its test plan, engineering-team/stories/graph-operations-first-slice/
 * 37-seed-firmware.test-plan.md, says what each holds.
 *
 * The firmware:
 *   ACTIVE                       firmware/active, resolved (versions/v1.0.0)
 *   copyFirmware(changes)        a copy of it in a temporary folder, with changes: { '<path in the folder>': null
 *                                (removed) | text | object (written as JSON) | (json) => json (edited) }
 *   oracle(dir)                  what today's install signs at each address for that folder, from today's routes
 *                                (test/helpers/todaysFirmwareRoutes.js), memoized
 *   targetLetters(o)             the oracle's letters with the concept graphs pass 1c rewrites as create-concept made
 *                                them: what the target holds (ADR 0037 Amendment 1, item 2)
 *   enumeratedOnTodaysInstall(o) the enumerations today's pass 3b applies: one whose enumerating concept has no element
 *                                it skips, as the route does (dog-breed's, on firmware/active)
 *   keptOnFirstContact(o)        the nodes first contact keeps on today's install's graph: the schemas pass 3b fills
 *                                (four on firmware/active) and the three concept graphs pass 1c flattens
 *   buildTarget(dir, ta)         src/firmware/target.js's buildTarget({ dir, ta }), or a throw that it doesn't exist yet
 *
 * The graph, in test/helpers/cypherEngine.js's shape:
 *   emptyGraph()
 *   todaysGraph(o, opts)         the firmware's nodes as today's install leaves them (story fact 1): each letter a node
 *                                with NostrEvent and its id, its tags as importEventDirect makes them, the role labels
 *                                and the slug the routes set, the edges the routes MERGE, each community-reference
 *                                header's b claim, and each schema pass 3b fills as it leaves it (an enum at each
 *                                destination path; an enumeration with no enumerating element skipped, as the route
 *                                skips it); opts.edges adds relationships, opts.edit(state, at) edits
 *   cy(state, cypher, params)    one statement on the engine, its rows
 *
 * Runs (each a child process, test/helpers/operationsHarness.js, every endpoint dead):
 *   runSeed({ state, firmwareDir, requests, cli, spy, noAssistant, lifecycleFailures, graphFailures, lock, label })
 *                                the real catalog over the cypher engine (graphFake engine 'cypher') with lifecycle's
 *                                system faked (test/helpers/lifecycleFakes.js), TAPESTRY_FIRMWARE_DIR set to
 *                                firmwareDir, and the assistant graphOpsSuite's TA unless noAssistant
 *   statusFirmware(state, opts)  lifecycle status's firmware part, run in a child whose Neo4j driver and graph seam both
 *                                answer from `state` through the engine
 *
 * Readers: live, nodesAt, byKey, relsOf, tagsOf, tagSet, propJson, entries, installedGraphAddress (the reserved
 * 39999:<ta>:installed-firmware, Amendment 3 item 3) and oldInstalledGraphAddress, installedGraphJson, listedIn, the
 * answer's entries, counts, parts and relationship lists.
 * The store (review round 1): offloadAndDerive(state, { lmdb, offload, derive }) runs the Dashboard's offload and the
 * derive for real in a child; runSeed's and statusFirmware's lmdb option hand that store to the next child.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('./graphOpsSuite');
const LF = require('./lifecycleFakes');
const CG = require('./cypherGraphFake');
const E = require('./cypherEngine');
const O = require('./todaysFirmwareRoutes');

const { ROOT, NL, assert, show } = S;
const TA = S.TA;
const ACTIVE = fs.realpathSync(path.join(ROOT, 'firmware/active'));
const ROUTE = '/api/tapestry/lifecycle/seed-firmware';
const STATUS = '/api/tapestry/lifecycle/status';
const DECL = path.join(ROOT, 'src/operations/catalog/lifecycle/seed-firmware.js');
const SEED = path.join(ROOT, 'src/operations/catalog/lifecycle/_seed.js');
const TARGET = path.join(ROOT, 'src/firmware/target.js');
/** The five schemas pass 3b fills, installed as their files say (ADR 0037 Decision 5). */
const FIVE = Object.freeze(['word', 'graph', 'property', 'relationship', 'dog']);
/** The six concepts with a community reference (story fact 1). */
const COMMUNITY = Object.freeze(['nostr-relay', 'tag', 'nostr-user-tag', 'tag-pinning', 'nostr-event-tag', 'tagging-with-specific-tag']);
/**
 * The three concepts whose concept graph pass 1c flattens and the target keeps as create-concept made it: the second
 * departure (ADR 0037 Amendment 1, item 2; the owner, 2026-11-20).
 */
const DEPARTED_GRAPHS = Object.freeze(['node-type', 'graph-type', 'validation-tool-type']);
const ROLE_LABELS = O.ROLE_LABELS;
const dtag = require(path.join(ROOT, 'src/lib/dtag.js'));

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/lifecycle/seed-firmware.js does not exist yet (ADR graph-operations-first-slice/0037 Decision 1)');
}
function needTarget() {
  if (!fs.existsSync(TARGET)) throw new Error('src/firmware/target.js does not exist yet (ADR graph-operations-first-slice/0037 Decisions 2 to 4)');
  const m = require(TARGET);
  if (typeof m.buildTarget !== 'function') throw new Error('src/firmware/target.js must export buildTarget({ dir, ta }) (ADR graph-operations-first-slice/0037 Decision 2)');
  return m;
}
function needSeed() {
  if (!fs.existsSync(SEED)) throw new Error('src/operations/catalog/lifecycle/_seed.js does not exist yet (ADR graph-operations-first-slice/0037 Decision 2: readState, plan and apply)');
  const m = require(SEED);
  for (const f of ['readState', 'plan', 'apply']) if (typeof m[f] !== 'function') throw new Error(`src/operations/catalog/lifecycle/_seed.js must export ${f} (ADR graph-operations-first-slice/0037 Decision 2)`);
  return m;
}

// ── the firmware ──
function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}
/** A copy of firmware/active with `changes` made; see the file's header. */
function copyFirmware(changes = {}, { from = ACTIVE, label = 'seed-firmware-fw-' } = {}) {
  const dir = path.join(S.tmp(label), 'v1.0.0');
  copyDir(from, dir);
  applyChanges(dir, changes);
  return dir;
}
function applyChanges(dir, changes) {
  for (const [rel, v] of Object.entries(changes)) {
    const file = path.join(dir, rel);
    if (v === null) { fs.rmSync(file, { force: true, recursive: true }); continue; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (typeof v === 'function') fs.writeFileSync(file, `${JSON.stringify(v(JSON.parse(fs.readFileSync(file, 'utf8'))), null, 2)}\n`);
    else if (typeof v === 'string') fs.writeFileSync(file, v);
    else fs.writeFileSync(file, `${JSON.stringify(v, null, 2)}\n`);
  }
  return dir;
}
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const fileSha = (dir, rel) => sha256(fs.readFileSync(path.join(dir, rel)));
const readFirmwareJson = (dir, rel) => JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8'));

const ORACLES = new Map();
/** What today's install signs for the firmware in `dir`, from today's routes; memoized by folder and assistant. */
function oracle(dir = ACTIVE, ta = TA) {
  const k = `${dir}|${ta}`;
  if (!ORACLES.has(k)) ORACLES.set(k, O.todaysFirmware({ dir, ta }));
  return ORACLES.get(k);
}
/** buildTarget's answer, awaited, so that a builder that reads its files asynchronously is read the same way. */
async function buildTarget(dir = ACTIVE, ta = TA) {
  return needTarget().buildTarget({ dir, ta });
}
/**
 * What the target holds at each address: today's install's letters, but each concept graph pass 1c rewrites as
 * create-concept made it (ADR 0037 Amendment 1, item 2). Pass 3b isn't in the oracle either (Decision 5).
 */
function targetLetters(o) {
  const m = new Map(o.letters);
  for (const [address, l] of o.rewrittenBy1c) m.set(address, l);
  return m;
}
/**
 * The enumerations today's pass 3b applies: each of the manifest's, unless its enumerating concept has no element on
 * today's install, which apply-enumerations skips (src/api/normalize/index.js, handleApplyEnumerations: "No elements
 * found — skipping"). Its elements are its superset's class thread when pass 3b runs, as today's install leaves it: its
 * element files (1b) and the manifest's existing nodes it finds (1c), both edges the routes MERGE; each node whose z
 * names it (1d, word excepted); and for concept-header every header (1d½). For firmware/active, dog-breed has none (its
 * existing nodes name irish-setter and golden-retriever, which no concept is), so dog's schema is its file's on today's
 * install too. → [{ concept, source, destination }]
 */
function enumeratedOnTodaysInstall(o) {
  const hasElements = (slug) => {
    if (slug === 'concept-header') return [...o.letters.values()].some((l) => l.role === 'conceptHeader');
    const sup = o.supersetOf(slug);
    if (!sup) return false;
    if (o.edges.some((e) => e.type === 'HAS_ELEMENT' && e.from === sup)) return true;
    const header = o.headerOf(slug);
    return slug !== 'word' && [...o.letters.values(), ...o.relationshipLetters].some((l) => l.address !== sup && l.tags.some((t) => t[0] === 'z' && t[1] === header));
  };
  const out = [];
  for (const [plural, data] of Object.entries(o.manifest.enumerations || {})) {
    const source = O.categoryToSlug(plural);
    if (!hasElements(source)) continue;
    for (const e of data['existing-nodes'] || []) out.push({ concept: e.concept, source, destination: e['destination-path'] || e.path });
  }
  return out;
}
/**
 * The nodes first contact keeps with noRecord on a graph today's install made: each schema pass 3b filled (four of the
 * five on firmware/active: word's, graph's, property's and relationship's) and the three concept graphs pass 1c flattened.
 */
function keptOnFirstContact(o) {
  const filled = new Set(enumeratedOnTodaysInstall(o).map((x) => x.concept));
  const schemas = [...o.letters.values()].filter((l) => l.role === 'jsonSchema' && filled.has(l.concept)).map((l) => l.address);
  const graphs = [...o.letters.values()].filter((l) => l.role === 'conceptGraph' && DEPARTED_GRAPHS.includes(l.concept)).map((l) => l.address);
  return [...schemas, ...graphs];
}

// ── the target's nodes, as the suites read them (the names the test plan pins) ──
const nodesOf = (t) => (t && Array.isArray(t.nodes) ? t.nodes : []);
const relsOfTarget = (t) => (t && Array.isArray(t.relationships) ? t.relationships : []);
const isRelationshipLetter = (n) => Array.isArray(n && n.tags) && n.tags.some((x) => x[0] === 'relationshipType');
const tagValue = (tags, type) => { const t = (tags || []).find((x) => x[0] === type); return t ? t[1] : undefined; };
const parsed = (j) => { if (typeof j !== 'string') return j === undefined ? null : j; try { return JSON.parse(j); } catch { return j; } };
const roleLabels = (labels) => (labels || []).filter((l) => ROLE_LABELS.includes(l)).sort();
/** A tag as the graph keeps it: [type, value, value1?, value2?], the empty values dropped from the end. */
const tagKey = (t) => { const x = [...t].map((v) => (v === null || v === undefined ? '' : String(v))); while (x.length > 2 && x[x.length - 1] === '') x.pop(); return JSON.stringify(x); };
const tagSet = (tags) => new Set((tags || []).map(tagKey));
function setDiff(a, b) { return { onlyFirst: [...a].filter((x) => !b.has(x)), onlySecond: [...b].filter((x) => !a.has(x)) }; }
const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));
/** Order-free JSON: every object's keys sorted. */
function stable(x) {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`;
  if (x && typeof x === 'object') return `{${Object.keys(x).sort().map((k) => `${JSON.stringify(k)}:${stable(x[k])}`).join(',')}}`;
  return JSON.stringify(x);
}
const sameJson = (a, b) => stable(parsed(a)) === stable(parsed(b));
/** A target relationship's ends and type, whatever the field names (from / nodeFrom). */
const relEnds = (r) => ({ type: r.type || r.relationshipType, from: r.from || r.nodeFrom, to: r.to || r.nodeTo, props: r.properties || r.props || {} });
const hasTargetRel = (t, type, from, to) => relsOfTarget(t).map(relEnds).some((r) => r.type === type && r.from === from && r.to === to);
const targetRel = (t, type, from, to) => relsOfTarget(t).map(relEnds).find((r) => r.type === type && r.from === from && r.to === to) || null;

// ── the graph ──
function emptyGraph() { return { nodes: [], rels: [], failures: {}, log: [], nextEid: 1 }; }
const cy = (state, cypher, params = {}) => E.run(state, cypher, params).rows;
/**
 * An index of a state's nodes and relationships, made again whenever its arrays are replaced or change length (a
 * property changed in place needs none: the index holds the objects themselves).
 */
const INDEX = new WeakMap();
function idx(s) {
  const c = INDEX.get(s);
  if (c && c.nodes === s.nodes && c.rels === s.rels && c.nl === s.nodes.length && c.rl === s.rels.length) return c;
  const byEid = new Map(s.nodes.map((n) => [n.eid, n]));
  const byUuid = new Map();
  const byKeyMap = new Map();
  for (const n of s.nodes) {
    if (n.props.uuid !== undefined) { if (!byUuid.has(n.props.uuid)) byUuid.set(n.props.uuid, []); byUuid.get(n.props.uuid).push(n); }
    if (n.props.tapestryKey !== undefined) byKeyMap.set(n.props.tapestryKey, n);
  }
  const out = new Map();
  const inc = new Map();
  for (const r of s.rels) {
    if (!out.has(r.from)) out.set(r.from, []); out.get(r.from).push(r);
    if (!inc.has(r.to)) inc.set(r.to, []); inc.get(r.to).push(r);
  }
  const made = { nodes: s.nodes, rels: s.rels, nl: s.nodes.length, rl: s.rels.length, byEid, byUuid, byKey: byKeyMap, out, inc };
  INDEX.set(s, made);
  return made;
}
const live = (s) => s.nodes.filter((n) => !n.labels.includes('GraphChange'));
const nodesAt = (s, uuid) => (idx(s).byUuid.get(uuid) || []).filter((n) => !n.labels.includes('GraphChange'));
const byKey = (s, k) => idx(s).byKey.get(k) || null;
const byEid = (s, eid) => idx(s).byEid.get(eid) || null;
/** The nodes an end names: by address (uuid), by tapestryKey, or by element id. */
function endNodes(s, v) {
  if (typeof v === 'number') { const n = byEid(s, v); return n ? [n] : []; }
  const at = idx(s).byUuid.get(v) || [];
  const k = byKey(s, v);
  return k && !at.includes(k) ? [...at, k] : at;
}
function relsOf(s, { type = null, from = null, to = null } = {}) {
  const ix = idx(s);
  let rels;
  if (from !== null) rels = endNodes(s, from).flatMap((n) => ix.out.get(n.eid) || []);
  else if (to !== null) rels = endNodes(s, to).flatMap((n) => ix.inc.get(n.eid) || []);
  else rels = s.rels;
  const toSet = to === null ? null : new Set(endNodes(s, to).map((n) => n.eid));
  return rels.filter((r) => (!type || r.type === type) && (!toSet || toSet.has(r.to)))
    .map((r) => ({ ...r, fromNode: ix.byEid.get(r.from) || null, toNode: ix.byEid.get(r.to) || null }));
}
/** A node's tags, as [type, value, value1?, value2?], from its tag nodes. */
function tagsOf(s, node) {
  const ix = idx(s);
  return (ix.out.get(node.eid) || []).filter((r) => r.type === 'HAS_TAG').map((r) => ix.byEid.get(r.to)).filter(Boolean)
    .map((t) => { const x = [t.props.type, t.props.value]; if (t.props.value1) x.push(t.props.value1); if (t.props.value2) x.push(t.props.value2); return x; });
}
const jsonTagOf = (s, node) => { const t = tagsOf(s, node).find((x) => x[0] === 'json'); return t ? parsed(t[1]) : null; };
/** A node property that holds JSON text (cameFrom, installed), parsed; null when absent. */
const propJson = (n, k) => { const v = n && n.props ? n.props[k] : undefined; if (v === undefined || v === null) return null; return typeof v === 'string' ? parsed(v) : v; };
const entries = (s) => S.entriesOf(s);
/**
 * Where the installed-firmware graph is: a reserved d-tag, which no element write gives, since theirs end in a hash of
 * their concept's address (ADR 0037 Decision 9, as Amendment 3 item 3 moves it).
 */
const installedGraphAddress = (ta = TA) => `39999:${ta}:installed-firmware`;
/** Where Decision 9 first put it, and where graph create-element puts an element named "installed firmware" of graph. */
const oldInstalledGraphAddress = (ta = TA) => `39999:${ta}:${dtag.childDTag('installed firmware', `39998:${ta}:graph`)}`;
/** The installed-firmware graph's JSON in a state, its json tag read through the store when it is an lmdb: reference. */
function installedGraphJson(s, { ta = TA, lmdb = null } = {}) {
  const n = nodesAt(s, installedGraphAddress(ta))[0];
  if (!n) return null;
  const j = jsonTagOf(s, n);
  if (typeof j === 'string' && j.startsWith('lmdb:') && lmdb) return readStoreEntry(lmdb, j.slice(5));
  return j;
}
/** Whether a list of the installed-firmware graph holds (type, from, to), as { nodeFrom: { slug }, … } or { type, from, to }. */
function listedIn(list, type, from, to) {
  return (Array.isArray(list) ? list : []).some((x) => {
    const t = x.relationshipType && typeof x.relationshipType === 'object' ? x.relationshipType.slug : x.type || x.relationshipType;
    const f = x.nodeFrom && typeof x.nodeFrom === 'object' ? x.nodeFrom.slug : x.from || x.nodeFrom;
    const o = x.nodeTo && typeof x.nodeTo === 'object' ? x.nodeTo.slug : x.to || x.nodeTo;
    return t === type && f === from && o === to;
  });
}

/** Make a node in a state directly, as an import or a route leaves it; → the node. */
function addNode(s, labels, props) {
  const n = { eid: s.nextEid++, labels: [...new Set([...labels, 'TapestryNode'])], props: { tapestryKey: props.tapestryKey || crypto.randomUUID(), ...props } };
  for (const k of Object.keys(n.props)) if (n.props[k] === null || n.props[k] === undefined) delete n.props[k];
  s.nodes.push(n);
  return n;
}
function addRel(s, from, type, to, props = {}) {
  const r = { eid: s.nextEid++, type, from: from.eid, to: to.eid, props: { ...props } };
  s.rels.push(r);
  return r;
}
/** A node's tag nodes, as importEventDirect makes them for a letter (or tagRows for a node with no letter). */
function addTagNodes(s, node, tags, { uuidOf } = {}) {
  tags.forEach((t, i) => {
    const props = { uuid: uuidOf ? uuidOf(t, i) : O.tagUuid(node.props.uuid, t, i), type: t[0], value: t[1] === undefined || t[1] === null ? '' : String(t[1]) };
    if (t[2]) props.value1 = String(t[2]);
    if (t[3]) props.value2 = String(t[3]);
    addRel(s, node, 'HAS_TAG', addNode(s, ['NostrEventTag'], props));
  });
}

/** Where pass 3b puts an enumeration's values in a schema's jsonSchema: an enum at the destination path. */
function withEnumerated(json, destinationPath, values) {
  const j = JSON.parse(JSON.stringify(json));
  const parts = String(destinationPath).split('.');
  let at = j.jsonSchema;
  for (const p of parts) {
    if (!at || !at.properties || !at.properties[p]) { at = null; break; }
    at = at.properties[p];
  }
  if (at) { if (at.type === 'array') at.items = { ...(at.items || {}), enum: values }; else at.enum = values; } else j.jsonSchema.allOf = [...(j.jsonSchema.allOf || []), { properties: { [parts[0]]: { enum: values } } }];
  return j;
}

/** Today's install's graph for the oracle `o`; see the file's header. */
function todaysGraph(o, { ta = TA, edges = [], schemaValues = true, edit = null } = {}) {
  const s = emptyGraph();
  const at = new Map();
  let author = null;
  const letterNode = (address, l) => {
    const labels = ['NostrEvent', ...l.labels];
    const seeded = l.tags.some((t) => t[0] === 'b');
    const n = addNode(s, labels, { uuid: address, id: l.id, kind: l.kind, pubkey: ta, name: l.name, created_at: l.created_at, slug: l.slug || null, aTag: seeded ? address : null });
    if (seeded) {
      // The community-reference seed re-signs the header and imports it with buildImportCypher, which adds its tag nodes
      // (<id's last 8>_<index>_<type>) beside the ones importEventDirect made for pass 1a's letter, and AUTHORS.
      addTagNodes(s, n, l.tags.filter((t) => t[0] !== 'b'));
      addTagNodes(s, n, l.tags, { uuidOf: (t, i) => `${l.id.slice(-8)}_${i}_${t[0]}` });
      if (!author) author = addNode(s, ['NostrUser'], { pubkey: ta });
      addRel(s, author, 'AUTHORS', n);
    } else addTagNodes(s, n, l.tags);
    at.set(address, n);
    return n;
  };
  // Pass 3b's values, for each enumeration it applies (one whose enumerating concept has no element it skips).
  const enumerations = enumeratedOnTodaysInstall(o).map((x) => ({ ...x, values: [`${x.source}-a`, `${x.source}-b`] }));
  for (const [address, l] of o.letters) {
    let letter = l;
    const en = schemaValues && l.role === 'jsonSchema' ? enumerations.filter((x) => x.concept === l.concept) : [];
    if (en.length) {
      let json = l.json;
      for (const x of en) json = withEnumerated(json, x.destination, x.values);
      letter = { ...l, tags: l.tags.map((t) => (t[0] === 'json' ? ['json', JSON.stringify(json)] : t)), id: crypto.createHash('sha256').update(`3b:${l.id}`).digest('hex') };
    }
    letterNode(address, letter);
  }
  for (const r of o.relationshipLetters) letterNode(r.address, { ...r, kind: 39999, labels: ['ListItem'], slug: null });
  for (const e of [...o.edges, ...edges]) {
    const a = at.get(e.from) || nodesAt(s, e.from)[0];
    const b = at.get(e.to) || nodesAt(s, e.to)[0];
    if (a && b && !s.rels.some((r) => r.from === a.eid && r.to === b.eid && r.type === e.type)) addRel(s, a, e.type, b, e.props || {});
  }
  // The b claim each seeded header carries (src/api/neo4j/eventSync.js): REFERENCES {source: 'b-tag'} to the node at
  // the b address, or to a placeholder the import makes there.
  for (const [address, l] of o.letters) {
    const b = l.tags.find((t) => t[0] === 'b');
    if (!b) continue;
    let target = nodesAt(s, b[1])[0];
    if (!target) target = addNode(s, ['NostrEvent'], { uuid: b[1] });
    addRel(s, at.get(address), 'REFERENCES', target, { source: 'b-tag' });
  }
  if (typeof edit === 'function') edit(s, at);
  return s;
}

// ── runs ──
/**
 * The child's environment: graphOpsSuite's, the firmware folder given, and the assistant unless noAssistant; lmdb names
 * a store (TAPESTRY_LMDB_PATH) shared with an earlier child, rather than the run's own new one.
 */
function envFor(dir, { firmwareDir = null, noAssistant = false, lmdb = null } = {}) {
  const env = S.childEnv(dir);
  if (firmwareDir) env.TAPESTRY_FIRMWARE_DIR = firmwareDir; else delete env.TAPESTRY_FIRMWARE_DIR;
  if (noAssistant) delete env.TA_PUBKEY;
  if (lmdb) env.TAPESTRY_LMDB_PATH = lmdb;
  return env;
}
/**
 * The Dashboard's "Offload N tags" over the json tags of the nodes `offload` names, then the derive of the nodes `derive`
 * names, run for real over `state` (test/helpers/seedFirmwareOffloadChild.js) with the store at `lmdb`:
 * → { state, offloaded, derived: { key → the entry's data } }.
 */
function offloadAndDerive(state, { lmdb, offload = [], derive = [] }) {
  const dir = S.tmp('seed-firmware-offload-');
  const stateFile = path.join(dir, 'state.json');
  const keysFile = path.join(dir, 'keys.json');
  fs.writeFileSync(stateFile, JSON.stringify({ ...JSON.parse(JSON.stringify(state)), failures: {}, log: [] }));
  fs.writeFileSync(keysFile, JSON.stringify({ offload, derive }));
  const r = spawnSync(process.execPath, [path.join(__dirname, 'seedFirmwareOffloadChild.js'), stateFile, keysFile], { cwd: ROOT, env: envFor(dir, { lmdb }), encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  const line = (r.stdout || '').split(NL).find((l) => l.startsWith('RESULT:'));
  assert(line, `the offload child printed no result (exit ${r.status}): ${(r.stderr || '').slice(-500)}`);
  const out = JSON.parse(line.slice(7));
  assert(!out.error, `the offload child failed: ${String(out.error).slice(0, 600)}`);
  return { state: JSON.parse(fs.readFileSync(stateFile, 'utf8')), offloaded: out.offloaded, derived: out.derived };
}
/** An entry's data in the store at `lmdb`, read in a child of its own (the store holds its folder open). */
function readStoreEntry(lmdb, key) {
  const r = spawnSync(process.execPath, ['-e', `const s = require(${show(path.join(ROOT, 'src/lib/tapestry-store.js'))}); const e = s.get(${show(key)}); process.stdout.write('RESULT:' + JSON.stringify(e ? e.data : null));`], { cwd: ROOT, env: { ...process.env, TAPESTRY_LMDB_PATH: lmdb }, encoding: 'utf8', timeout: 60000 });
  const line = (r.stdout || '').split('RESULT:')[1];
  return line ? JSON.parse(line) : null;
}
/** One harness run of seed-firmware's world; see the file's header. → { req, cmd, spy, error, file, state(), dir, env, raw } */
function runSeed({ state = null, file = null, firmwareDir = null, requests = [], cli = [], spy = false, noAssistant = false, lifecycleFailures = {}, graphFailures = null, lock = null, lmdb = null, label = 'seed-firmware-' } = {}) {
  const dir = S.tmp(label);
  const graphFile = path.join(dir, 'graph.json');
  const base = state ? JSON.parse(JSON.stringify(state)) : file ? CG.readState(file) : emptyGraph();
  base.log = [];
  base.failures = graphFailures || {};
  CG.writeState(graphFile, base);
  const lifecycleFile = path.join(dir, 'lifecycle.json');
  LF.newFakeState(lifecycleFile, { failures: lifecycleFailures });
  const env = envFor(dir, { firmwareDir, noAssistant, lmdb });
  if (lock) LF.writeLock(env.TAPESTRY_BACKUPS_DIR, lock);
  const spec = { spy, scenarios: [{ lifecycleFake: { stateFile: lifecycleFile }, graphFake: { stateFile: graphFile, engine: 'cypher' }, requests, cli }] };
  const r = S.runHarness(spec, { dir, env });
  return { ...S.answered(r), file: graphFile, state: () => CG.readState(graphFile), lifecycle: () => LF.readState(lifecycleFile), dir, env, raw: r };
}
const seed = (id, caller, body = {}) => ({ id, method: 'POST', url: ROUTE, caller, body });
const together = (...rs) => ({ together: rs });

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

// ── the answer (ADR 0037 Decision 11) ──
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
/** How many nodes had `outcome`, from the answer's counts. */
function countOf(d, outcome) {
  const c = (d && d.counts) || {};
  const v = c[outcome] !== undefined ? c[outcome] : c[camel(outcome)];
  return typeof v === 'number' ? v : Array.isArray(v) ? v.length : undefined;
}
/** The answer's node entries (each whose outcome isn't unchanged), by address. */
function entriesByAddress(d) {
  const list = Array.isArray(d && d.nodes) ? d.nodes : [];
  return new Map(list.map((e) => [e.address, e]));
}
/** Every word a kept entry's parts name, at any depth: part names, tag types. */
function partsOf(entry) {
  const out = new Set();
  (function walk(x) {
    if (typeof x === 'string') { out.add(x); for (const w of x.split(/[^A-Za-z0-9-]+/)) if (w) out.add(w); return; }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { out.add(k); if (v !== false && v !== null) walk(v); }
  })(entry && entry.parts);
  return out;
}
/** The answer's relationships: the four lists and the two counts (Decision 11). */
function relsOfAnswer(d) {
  const r = (d && d.relationships) || {};
  const list = (k) => (Array.isArray(r[k]) ? r[k] : []);
  const n = (k) => (typeof r[k] === 'number' ? r[k] : Array.isArray(r[k]) ? r[k].length : undefined);
  return { added: list('added'), removed: list('removed'), changed: list('changed'), kept: list('kept'), unchanged: n('unchanged'), others: n('others') };
}
/** Whether a listed relationship is (type, from, to), its ends named by address or by tapestryKey. */
function relIs(entry, type, from, to, keyOf = () => null) {
  const e = relEnds(entry);
  const end = (v, want) => v === want || (keyOf(want) && v === keyOf(want)) || (v && typeof v === 'object' && (v.address === want || v.tapestryKey === keyOf(want) || v.slug === want));
  return e.type === type && end(e.from, from) && end(e.to, to);
}

/** lifecycle status's firmware part over `state`, in a child: its driver and its graph seam answer from the engine. */
function statusFirmware(state, { firmwareDir = null, lmdb = null } = {}) {
  const dir = S.tmp('seed-firmware-status-');
  const file = path.join(dir, 'graph.json');
  CG.writeState(file, { ...JSON.parse(JSON.stringify(state)), failures: {}, log: [] });
  const script = [
    "'use strict';",
    "for (const k of ['log', 'info', 'debug', 'warn']) console[k] = () => {};",
    `const ROOT = ${show(ROOT)};`,
    "const path = require('path');",
    `const CG = require(${show(path.join(__dirname, 'cypherGraphFake.js'))});`,
    `const fake = CG.fakeGraph(${show(file)});`,
    "const driverFile = require.resolve(path.join(ROOT, 'src/lib/neo4j-driver.js'));",
    'const toJS = (x) => x;',
    "require.cache[driverFile] = { id: driverFile, filename: driverFile, loaded: true, children: [], paths: [], exports: {",
    '  runCypher: (q, p) => fake.read(q, p), streamCypher: async (q, p, on) => { for (const r of await fake.read(q, p)) on(r); },',
    '  writeCypher: async () => { throw new Error("lifecycle status writes nothing"); }, getDriver: () => { throw new Error("no driver in this child"); }, toJS,',
    '} };',
    "const seam = require(path.join(ROOT, 'src/operations/graph.js'));",
    "for (const k of ['writeTransaction', 'read']) seam[k] = fake[k];",
    '(async () => {',
    '  try {',
    "    const status = require(path.join(ROOT, 'src/operations/catalog/lifecycle/status.js'));",
    "    const part = await status.parts.firmware();",
    "    const schema = status.result && status.result.schema && status.result.schema.properties && status.result.schema.properties.firmware;",
    "    process.stdout.write('RESULT:' + JSON.stringify({ part, schemaFields: schema ? Object.keys(schema.properties || {}) : null }) + '\\n');",
    "  } catch (e) { process.stdout.write('RESULT:' + JSON.stringify({ error: String(e && e.stack || e) }) + '\\n'); }",
    '})();',
  ].join(NL);
  const scriptFile = path.join(dir, 'status-child.js');
  fs.writeFileSync(scriptFile, script);
  const env = envFor(dir, { firmwareDir, lmdb });
  const r = spawnSync(process.execPath, [scriptFile], { cwd: ROOT, env, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
  const line = (r.stdout || '').split(NL).find((l) => l.startsWith('RESULT:'));
  assert(line, `the status child printed no result (exit ${r.status}): ${(r.stderr || '').slice(-500)}`);
  const out = JSON.parse(line.slice(7));
  assert(!out.error, `the status child failed: ${String(out.error).slice(0, 600)}`);
  return out;
}

module.exports = {
  ROOT, NL, TA, ACTIVE, ROUTE, STATUS, DECL, SEED, TARGET, FIVE, COMMUNITY, DEPARTED_GRAPHS, ROLE_LABELS, assert, show, tmp: S.tmp, dtag,
  needDecl, needTarget, needSeed, copyFirmware, applyChanges, fileSha, sha256, readFirmwareJson, oracle, buildTarget, targetLetters, keptOnFirstContact,
  enumeratedOnTodaysInstall,
  nodesOf, relsOfTarget, isRelationshipLetter, tagValue, parsed, roleLabels, tagKey, tagSet, setDiff, sameSet, stable, sameJson, relEnds,
  hasTargetRel, targetRel,
  emptyGraph, cy, live, nodesAt, byKey, byEid, relsOf, tagsOf, jsonTagOf, propJson, entries, installedGraphAddress, oldInstalledGraphAddress,
  installedGraphJson, listedIn, offloadAndDerive, readStoreEntry, addNode, addRel, addTagNodes,
  withEnumerated, todaysGraph,
  envFor, runSeed, seed, together, data, refused, countOf, entriesByAddress, partsOf, relsOfAnswer, relIs, statusFirmware, camel,
};
