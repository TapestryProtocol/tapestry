'use strict';
/**
 * What an export sends, and in what order (story graph-operations-first-slice #34, AC1 and AC5; ADR
 * graph-operations-first-slice/0034 Decision 2, and story amendment 5). Written to be shared with export file (A10.35),
 * which takes the same scope (D12).
 *
 *   isGraphElement(read, key)       whether the node is a graph element: one the class thread of this instance's graph
 *                                   concept (39998:<assistant>:graph) reaches, or one whose stored JSON holds a
 *                                   top-level graph object (story amendment 6)
 *   scopeOf(read, { form, key })    → { keys, reports }: the scope's tapestryKeys, a not-found report for each address
 *                                   or id a graph lists that no node holds, and a graph-not-followed report for each
 *                                   graph sent with its lists unfollowed, naming its key, address and name (Amendment 2
 *                                   item 3, Amendment 3 item 3)
 *                                     node        that node
 *                                     graph       the graph element, what its graph.nodes lists (by uuid as an
 *                                                 address, else as an event id), the graphs its graph.imports lists,
 *                                                 followed the same way (four levels, 50 graphs, as import nostr follows
 *                                                 them; a graph past them is sent as it is, its lists unfollowed), and
 *                                                 for a concept graph (a node that IS_THE_CONCEPT_GRAPH_FOR a header)
 *                                                 that concept's header, its six core nodes, its superset, the sets
 *                                                 below it to six levels and their elements, the instance's own only, as
 *                                                 today's export-set gathers them
 *                                     everything  every node of the instance's own of kind 39998 or 39999 with an address
 *   entriesOf(read, keys)           → each node's facts, with its rank and depth, in rank order: concept headers;
 *                                   supersets; sets, by their depth below a superset, parents first; everything else;
 *                                   ties by tapestryKey. Person nodes, tag nodes, change entries and placeholders are
 *                                   never in a scope
 *   fingerprint(form, key), encodeCursor(scope, position), decodeCursor(text, scope), isAfter(entry, position),
 *   positionOf(entry), START        the cursor next.after holds: [rank, depth, tapestryKey] of the last node finished
 *   sendOrder(items)                → items in the order their letters go out: by rank first (concept headers,
 *                                   supersets, sets, the rest), and within a rank each after the call's letters of that
 *                                   rank it names (its z, n, s, a, e, nodeFrom, nodeTo and concept-graph tags, and a
 *                                   graph's graph.nodes and graph.imports), a cycle by tapestryKey (Amendment 2 item 2)
 *
 * Every value is a parameter; only firmware's relationship types (checked plain names) reach a statement's text. It
 * opens nothing when it loads, and never writes, signs or sends.
 */

const READ = 'export nostr';
const MAX_DEPTH = 4;
const MAX_GRAPHS = 50;
const CLASS_LEVELS = 6;
const SET_DEPTHS = 6;
const UNREACHED_DEPTH = SET_DEPTHS + 1;
const BATCH = 500;
const HEX64 = /^[0-9a-f]{64}$/;
const TYPE = /^[A-Z][A-Z0-9_]{0,63}$/;
const KEY = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;
/** The tags through which a letter names another, for the order letters go out in (Decision 2). */
const NAMING_TAGS = Object.freeze(['z', 'n', 's', 'a', 'e', 'nodeFrom', 'nodeTo', 'concept-graph']);
/** Before every node: the position a cursor starts from. */
const START = Object.freeze([-1, -1, '']);

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = (x) => (typeof x === 'string' && x.length > 0 ? x : null);
const num = (x) => (x === null || x === undefined || x === '' ? null : Number.isFinite(Number(x)) ? Number(x) : null);
const chunks = (list, n) => { const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; };

/** A relationship type, as firmware names it, checked before it reaches a statement's text. */
function typeText(t) {
  if (!TYPE.test(String(t))) throw new Error(`export nostr reads no relationship type ${JSON.stringify(t)}`);
  return t;
}
function rel() {
  const R = require('../graph/_concepts').rel();
  for (const k of ['INIT', 'PROP', 'TERM', 'SCHEMA', 'PRIMARY', 'PROPERTIES', 'TREE', 'CORE', 'GRAPH']) typeText(R[k]);
  return R;
}
const coreTypes = (R) => [R.SCHEMA, R.PRIMARY, R.PROPERTIES, R.TREE, R.CORE, R.GRAPH].join('|');

// ── a node's facts ──
const FACTS = `UNWIND $keys AS k
  MATCH (n:TapestryNode {tapestryKey: k})
  RETURN k AS key, n.uuid AS uuid, n.id AS id, n.created_at AS created_at, n.kind AS kind, n.pubkey AS pubkey,
         labels(n) AS labels, n.name AS name, n.tapestryValue AS tapestryValue, n.sentTo AS sentTo`;

/** One node's facts, from a row of FACTS (or any row with those columns). */
function factsOfRow(r) {
  const labels = Array.isArray(r.labels) ? r.labels : [];
  const createdAt = num(r.created_at);
  return {
    key: r.key,
    uuid: text(r.uuid),
    id: text(r.id),
    created_at: createdAt,
    kind: num(r.kind),
    author: text(r.pubkey),
    labels,
    name: text(r.tapestryValue) || text(r.name),
    sentTo: Array.isArray(r.sentTo) ? r.sentTo.filter((x) => typeof x === 'string') : [],
    person: labels.includes('NostrUser'),
    tag: labels.includes('NostrEventTag'),
    change: labels.includes('GraphChange'),
    placeholder: labels.includes('NostrEvent') && createdAt === null,
  };
}

/** The facts of each key, as a Map(key → facts); keys no node has are left out. */
async function factsOf(read, keys) {
  const out = new Map();
  for (const part of chunks([...new Set(keys)].filter((k) => typeof k === 'string'), BATCH)) {
    for (const r of await read(FACTS, { keys: part })) if (r && typeof r.key === 'string' && !out.has(r.key)) out.set(r.key, factsOfRow(r));
  }
  return out;
}

/** A node that can be a letter: never a person node, a tag node, a change entry or a placeholder. */
const canBeLetter = (f) => !!f && !f.person && !f.tag && !f.change && !f.placeholder;

/** The instance's own, as the reads judge it (src/operations/reads.js's nodeOf, through graph/_nodes.js's factsOf). */
function isOwn(f, own) {
  return canBeLetter(f) && (f.author === null || own.includes(f.author));
}

// ── a node's stored JSON ──
const JSON_TAG = `UNWIND $keys AS k
  MATCH (n:TapestryNode {tapestryKey: k})-[:HAS_TAG]->(t:NostrEventTag {type: 'json'})
  RETURN k AS key, t.value AS value`;

/** A json tag's value as an object: inline, or an lmdb: pointer through tapestry-resolve; null when it isn't one. */
function storedJson(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  let value = raw;
  if (raw.startsWith('lmdb:')) {
    const { resolveValue } = require('../../../lib/tapestry-resolve');
    value = resolveValue(raw);
    if (value === null || value === undefined) return null;
    if (isObject(value)) return value;
    if (typeof value !== 'string') return null;
  }
  try { const v = JSON.parse(value); return isObject(v) ? v : null; } catch { return null; }
}

/** Each key's stored JSON object, as a Map(key → object); a node with none, or one that isn't an object, is left out. */
async function jsonOf(read, keys) {
  const out = new Map();
  for (const part of chunks([...new Set(keys)], BATCH)) {
    for (const r of await read(JSON_TAG, { keys: part })) {
      if (out.has(r.key)) continue;
      const j = storedJson(r.value);
      if (j) out.set(r.key, j);
    }
  }
  return out;
}

// ── is it a graph element (Decision 1, story amendment 6) ──
async function isGraphElement(read, key) {
  const R = rel();
  const firmware = require('../../../api/normalize/firmware');
  const header = firmware.conceptUuid('graph');
  if (header) {
    const rows = await read(
      `MATCH (h:TapestryNode {uuid: $header})-[:${R.INIT}]->(:Superset)-[:${R.PROP}*0..${CLASS_LEVELS}]->(s)-[:${R.TERM}]->(n:TapestryNode {tapestryKey: $key})
       RETURN n.tapestryKey AS key LIMIT 1`,
      { header, key },
    );
    if (rows.length) return true;
  }
  const json = (await jsonOf(read, [key])).get(key);
  return !!(json && isObject(json.graph));
}

// ── the scope (Decision 2) ──
const AT_UUID = `UNWIND $uuids AS u
  MATCH (n:TapestryNode {uuid: u})
  WHERE NOT n:NostrEventTag AND NOT n:GraphChange
  RETURN u AS at, n.tapestryKey AS key, labels(n) AS labels, n.created_at AS created_at`;
const WITH_ID = `UNWIND $ids AS i
  MATCH (n:NostrEvent|TapestryNode {id: i})
  WHERE NOT n:NostrEventTag AND NOT n:GraphChange
  RETURN i AS at, n.tapestryKey AS key, labels(n) AS labels, n.created_at AS created_at`;

/**
 * The node each address or id names, as a Map(ref → key): by uuid first, then, for 64 hex characters, as an event's
 * id. A placeholder holds nothing, so a ref that finds only one names no node.
 */
async function nodesNamed(read, refs) {
  const out = new Map();
  const held = (r) => !(Array.isArray(r.labels) && r.labels.includes('NostrEvent') && (r.created_at === null || r.created_at === undefined));
  const list = [...new Set(refs.filter((x) => typeof x === 'string' && x))];
  for (const part of chunks(list, BATCH)) {
    for (const r of await read(AT_UUID, { uuids: part })) if (!out.has(r.at) && typeof r.key === 'string' && held(r)) out.set(r.at, r.key);
  }
  const ids = list.filter((x) => !out.has(x) && HEX64.test(x));
  for (const part of chunks(ids, BATCH)) {
    for (const r of await read(WITH_ID, { ids: part })) if (!out.has(r.at) && typeof r.key === 'string' && held(r)) out.set(r.at, r.key);
  }
  return out;
}

/** The uuids a graph's list holds: [{ uuid }], in its order. */
const listed = (list) => (Array.isArray(list) ? list.filter((x) => isObject(x) && typeof x.uuid === 'string' && x.uuid).map((x) => x.uuid) : []);

/** A concept graph's concept, as today's export-set gathers it: its header, core nodes, superset, sets and elements. */
async function conceptOf(read, graphKey) {
  const R = rel();
  const headers = (await read(`MATCH (g:TapestryNode {tapestryKey: $key})-[:${R.GRAPH}]->(h:TapestryNode) RETURN DISTINCT h.tapestryKey AS key`, { key: graphKey }))
    .map((r) => r.key).filter((k) => typeof k === 'string');
  if (!headers.length) return [];
  const core = await read(`UNWIND $keys AS k MATCH (h:TapestryNode {tapestryKey: k})<-[:${coreTypes(R)}]-(c:TapestryNode) RETURN DISTINCT c.tapestryKey AS key`, { keys: headers });
  const supersets = (await read(`UNWIND $keys AS k MATCH (h:TapestryNode {tapestryKey: k})-[:${R.INIT}]->(s:TapestryNode) RETURN DISTINCT s.tapestryKey AS key`, { keys: headers }))
    .map((r) => r.key).filter((k) => typeof k === 'string');
  const sets = supersets.length
    ? (await read(`UNWIND $keys AS k MATCH (s:TapestryNode {tapestryKey: k})-[:${R.PROP}*0..${CLASS_LEVELS}]->(x:TapestryNode) RETURN DISTINCT x.tapestryKey AS key`, { keys: supersets }))
      .map((r) => r.key).filter((k) => typeof k === 'string')
    : [];
  const elements = sets.length
    ? (await read(`UNWIND $keys AS k MATCH (s:TapestryNode {tapestryKey: k})-[:${R.TERM}]->(e:TapestryNode) RETURN DISTINCT e.tapestryKey AS key`, { keys: sets }))
      .map((r) => r.key).filter((k) => typeof k === 'string')
    : [];
  return [...headers, ...core.map((r) => r.key).filter((k) => typeof k === 'string'), ...supersets, ...sets, ...elements];
}

async function scopeOf(read, { form, key, own }) {
  if (form === 'everything') {
    const rows = await read(
      `MATCH (n:TapestryNode)
       WHERE n.uuid IS NOT NULL AND n.kind IN [39998, 39999]
         AND NOT n:NostrUser AND NOT n:NostrEventTag AND NOT n:GraphChange
         AND NOT ('NostrEvent' IN labels(n) AND n.created_at IS NULL)
         AND (n.pubkey IS NULL OR n.pubkey IN $own)
       RETURN n.tapestryKey AS key`,
      { own },
    );
    return { keys: rows.map((r) => r.key).filter((k) => typeof k === 'string'), reports: [] };
  }
  if (form === 'node') return { keys: [key], reports: [] };

  const keys = new Set([key]);
  const reports = [];
  const followed = new Set();
  const queue = [{ key, depth: 0 }];
  const fromConcepts = [];
  const tooDeep = new Set(); // the graphs an import names more than MAX_DEPTH levels down
  while (queue.length && followed.size < MAX_GRAPHS) {
    const { key: g, depth } = queue.shift();
    if (followed.has(g)) continue;
    followed.add(g);
    const json = (await jsonOf(read, [g])).get(g);
    const graph = json && isObject(json.graph) ? json.graph : null;
    if (graph) {
      const nodes = listed(graph.nodes);
      const imports = listed(graph.imports);
      const named = await nodesNamed(read, [...nodes, ...imports]);
      for (const [where, list] of [['graph.nodes', nodes], ['graph.imports', imports]]) {
        for (const uuid of list) {
          const k = named.get(uuid);
          if (k) {
            keys.add(k);
            if (where === 'graph.imports' && !followed.has(k)) {
              if (depth + 1 <= MAX_DEPTH) queue.push({ key: k, depth: depth + 1 });
              else tooDeep.add(k);
            }
          } else if (!reports.some((r) => r.node === g && r.address === uuid)) {
            reports.push({
              report: 'not-found', node: g, where, address: uuid,
              words: `The graph ${g} lists ${uuid} in its ${where}, and no node of this graph holds it, so no letter of it is sent. The graph's letter still lists it.`,
            });
          }
        }
      }
    }
    fromConcepts.push(...await conceptOf(read, g));
  }
  // A graph past the fourth level of imports, or past the 50th, is sent as it is, its lists unfollowed, and reported
  // once, saying why (Amendment 2 item 3).
  const left = new Map();
  for (const q of queue) if (!followed.has(q.key) && !left.has(q.key)) left.set(q.key, `this call had followed the lists of ${MAX_GRAPHS} graphs, the most one call follows`);
  for (const g of tooDeep) if (!followed.has(g) && !left.has(g)) left.set(g, `it is imported more than ${MAX_DEPTH} levels below the graph exported, the deepest one call follows`);
  // A concept's class thread brings the instance's own nodes only, as today's export-set does.
  const facts = await factsOf(read, [...fromConcepts, ...left.keys()]);
  for (const k of fromConcepts) if (isOwn(facts.get(k), own)) keys.add(k);
  for (const [g, why] of left) {
    const { name, uuid } = facts.get(g) || {};
    reports.push({
      report: 'graph-not-followed', node: g, ...(uuid ? { address: uuid } : {}),
      words: `The graph ${name ? `"${name}" (${g})` : g} is sent as it is, but what its graph.nodes and graph.imports list isn't: ${why}. Export it on its own, as graph, to send what it lists.`,
    });
  }
  return { keys: [...keys], reports };
}

// ── rank, depth and the cursor (Decision 2) ──
function rankOf(labels) {
  if (labels.includes('ConceptHeader') || labels.includes('ListHeader')) return 0;
  if (labels.includes('Superset')) return 1;
  if (labels.includes('Set')) return 2;
  return 3;
}

/** Each set's depth below a superset, the fewest IS_A_SUPERSET_OF steps from one: Map(key → depth). */
async function depthsOf(read, keys) {
  const R = rel();
  const out = new Map();
  let left = [...keys];
  for (let d = 1; d <= SET_DEPTHS && left.length; d += 1) {
    const found = new Set();
    for (const part of chunks(left, BATCH)) {
      for (const r of await read(`UNWIND $keys AS k MATCH (n:TapestryNode {tapestryKey: k})<-[:${R.PROP}*${d}..${d}]-(:Superset) RETURN DISTINCT k AS key`, { keys: part })) found.add(r.key);
    }
    for (const k of found) out.set(k, d);
    left = left.filter((k) => !found.has(k));
  }
  return out;
}

const compare = (a, b) => (a[0] - b[0]) || (a[1] - b[1]) || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0);
const positionOf = (e) => [e.rank, e.depth, e.key];
const isAfter = (e, position) => compare(positionOf(e), position) > 0;

async function entriesOf(read, keys) {
  const facts = await factsOf(read, keys);
  const list = [...facts.values()].filter(canBeLetter);
  const sets = list.filter((f) => rankOf(f.labels) === 2).map((f) => f.key);
  const depths = sets.length ? await depthsOf(read, sets) : new Map();
  const entries = list.map((f) => {
    const rank = rankOf(f.labels);
    return { ...f, rank, depth: rank === 2 ? (depths.get(f.key) || UNREACHED_DEPTH) : 0 };
  });
  return entries.sort((a, b) => compare(positionOf(a), positionOf(b)));
}

function fingerprint(form, key) {
  return require('../../reads').scopeOf([READ, form, key || null]);
}
function encodeCursor(scope, position) {
  return Buffer.from(JSON.stringify([READ, scope, position])).toString('base64url');
}
const isPosition = (p) => Array.isArray(p) && p.length === 3 && Number.isInteger(p[0]) && p[0] >= -1 && p[0] <= 3
  && Number.isInteger(p[1]) && p[1] >= -1 && typeof p[2] === 'string' && (p[2] === '' || KEY.test(p[2]));
/** The position a cursor this read gave for this scope holds, or null for anything else. */
function decodeCursor(cursor, scope) {
  let parsed;
  try { parsed = JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8')); } catch { return null; }
  if (!Array.isArray(parsed) || parsed.length !== 3 || parsed[0] !== READ || parsed[1] !== scope || !isPosition(parsed[2])) return null;
  return parsed[2];
}

// ── the order letters go out in (Decision 2, story amendment 5; Amendment 2 item 2) ──
/**
 * items: [{ key, rank, depth, refs: [the addresses and ids it holds: its address, its letter's id], names: [what its
 * letter names] }] → the items in send order: rank by rank, concept headers first, and within a rank in the order
 * rankOrder gives.
 */
function sendOrder(items) {
  const out = [];
  for (const rank of [...new Set(items.map((it) => it.rank))].sort((a, b) => a - b)) out.push(...rankOrder(items.filter((it) => it.rank === rank)));
  return out;
}

const byKey = (a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

/**
 * One rank's items in send order. Each strongly connected group, of the names among them, goes after the groups it
 * names, the ready group first by depth (parents first, for sets) and tapestryKey; a group of more than one is a cycle,
 * sent by tapestryKey.
 */
function rankOrder(items) {
  const byRef = new Map();
  for (const it of items) for (const r of it.refs) if (typeof r === 'string' && r && !byRef.has(r)) byRef.set(r, it.key);
  const itemOf = new Map(items.map((it) => [it.key, it]));
  const deps = new Map(items.map((it) => [it.key, [...new Set(it.names.map((n) => byRef.get(n)).filter((k) => k && k !== it.key))]]));
  // Tarjan's strongly connected components, without recursion.
  let index = 0;
  const idx = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const groupOf = new Map();
  const groups = [];
  for (const start of items.map((it) => it.key)) {
    if (idx.has(start)) continue;
    const work = [[start, 0]];
    idx.set(start, index); low.set(start, index); index += 1; stack.push(start); onStack.add(start);
    while (work.length) {
      const top = work[work.length - 1];
      const [v, i] = top;
      const ds = deps.get(v);
      if (i < ds.length) {
        top[1] += 1;
        const w = ds[i];
        if (!idx.has(w)) {
          idx.set(w, index); low.set(w, index); index += 1; stack.push(w); onStack.add(w);
          work.push([w, 0]);
        } else if (onStack.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
        continue;
      }
      work.pop();
      if (work.length) { const u = work[work.length - 1][0]; low.set(u, Math.min(low.get(u), low.get(v))); }
      if (low.get(v) === idx.get(v)) {
        const group = [];
        for (;;) { const w = stack.pop(); onStack.delete(w); groupOf.set(w, groups.length); group.push(itemOf.get(w)); if (w === v) break; }
        group.sort(byKey);
        groups.push(group);
      }
    }
  }
  // Kahn's order over the groups, the ready group with the lowest depth and tapestryKey first.
  const waits = groups.map(() => new Set());
  const feeds = groups.map(() => new Set());
  groups.forEach((g, gi) => {
    for (const it of g) for (const d of deps.get(it.key)) { const gj = groupOf.get(d); if (gj !== gi) { waits[gi].add(gj); feeds[gj].add(gi); } }
  });
  const ready = groups.map((_, gi) => gi).filter((gi) => !waits[gi].size);
  const first = (gi) => positionOf(groups[gi][0]);
  const out = [];
  while (ready.length) {
    ready.sort((a, b) => compare(first(a), first(b)));
    const gi = ready.shift();
    out.push(...groups[gi]);
    for (const gj of feeds[gi]) { waits[gj].delete(gi); if (!waits[gj].size) ready.push(gj); }
  }
  return out;
}

/** What a letter names, for sendOrder: its naming tags' values, and its graph's graph.nodes and graph.imports. */
function namesOf(tags) {
  const out = [];
  for (const t of tags) if (NAMING_TAGS.includes(t[0]) && typeof t[1] === 'string' && t[1]) out.push(t[1]);
  const j = tags.find((t) => t[0] === 'json');
  let json = null;
  try { json = j ? JSON.parse(j[1]) : null; } catch { json = null; }
  const g = isObject(json) && isObject(json.graph) ? json.graph : null;
  if (g) out.push(...listed(g.nodes), ...listed(g.imports));
  return out;
}

module.exports = {
  READ, START, NAMING_TAGS,
  isGraphElement, scopeOf, entriesOf, factsOf, factsOfRow, canBeLetter, isOwn, storedJson, nodesNamed,
  fingerprint, encodeCursor, decodeCursor, isAfter, positionOf, sendOrder, namesOf, rel,
};
