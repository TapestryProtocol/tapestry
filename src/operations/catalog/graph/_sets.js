'use strict';
/**
 * The class thread's sets (story graph-operations-first-slice #28, ADR graph-operations-first-slice/0028 Decision 2):
 * what graph link-set and unlink-set, and the rules class-thread-acyclic and set-has-a-parent, share.
 *
 * A class-thread link runs from a parent to a set by the class thread's propagation type. What counts as which
 * (Decision 5, refined by Amendment 3): a superset is a node labelled Superset that has an address, its uuid; a set,
 * one labelled Set and not Superset that has one; a parent, either; a concept header, a node with a Superset at the
 * end of its IS_THE_CONCEPT_FOR, which is named only to say which key to pass. These are the labels today's add-subset
 * and create-set write and check. A node with no address, such as one of the trust pipeline's card sets (labelled
 * Set), is none of them.
 *
 * Like _nodes.js and _fields.js, it opens nothing when it loads: firmware, the assistant's key and the config are
 * required when first called (ADR graph-operations-foundation/0001 Decision 10).
 *
 *   aliases()                                      { INIT, PROP, TERM }: the only type names its statements interpolate
 *   nodeOf(read, key)                              R1: { key, uuid, name, labels, pubkey, hasLetter }, or null
 *   kindOf(node)                                   'superset', 'set' or 'other'
 *   supersetOf(read, key)                          R2: the tapestryKey of the superset a concept header points to
 *   parentsOf(read, keys)                          R3: one level up for many nodes at once
 *   isLinked(read, parent, set)                    whether a link runs from parent to set
 *   ancestors(read, from, { skip, nodes })         the class thread above `from`, Map(child → [parent]) (Decision 8)
 *   isAbove(up, key), chain(up, from, to)          whether a walk reached `key`, and the path up from `from` to `to`
 *   childrenOf(read, key)                          R4: a node's direct sets
 *   requireEnds(tx, { set, parent })               link-set's and unlink-set's first two steps (Decision 1)
 *   firmwareLinks()                                the links firmware's definition makes, and the supersets its prune
 *                                                  covers, worked out once per process (Decision 6)
 *   isFirmwareLink(read, parentNode, setNode)      the part of that definition that makes a link, or null
 *   firmwarePrunes(read, { parent, set, before })  the links firmware's prune would take out (Decision 6)
 *   peerClaim(read, parentNode, setNode)           a peer's letter that claims the link, or null (Decision 7)
 *   ownLetters(read, parentNode, setNode)          the instance's own letters that still name the parent (Decision 7)
 *   describe(node)                                 "<name>" (<tapestryKey>), for messages
 *
 * And what the set writes share (story graph-operations-first-slice #27, ADR graph-operations-first-slice/0027):
 * graph create-set now, and graph delete-set (A10.17) when it is built.
 *   requireParent(tx, parent)                      unknown-node, then not-a-parent, as link-set reads a parent (Decision 4)
 *   linkUnder(tx, parent, set)                     one class-thread link from parent to set, by link-set's MERGE (Decision 11)
 *   setJson({ name, slug, description, others })   a set's word-wrapper JSON, as firmware's set files hold it (Decision 9)
 *   setTags({ d, name, setConcept, parent, description, json })  the tags of the letter a set write would sign (Decision 10)
 *   findSetRepeat(read, { parent, name, ta, address })  R7: this instance's own set under parent the call repeats (Decision 7)
 *   setDiffers(repeat, { name, description })      each input given that differs from what the repeated set holds
 *   describeSet({ key, address, name, slug, description, parents, hasLetter })  a set as an answer gives it (Decision 13)
 */

const CN = require('../../../lib/conceptNames');
const { refusal } = require('../../refusal');
const N = require('./_nodes');

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/** The class thread's relationship types, as firmware names them (as relationship-type-allowed and _fields.js do). */
function aliases() {
  const { relAlias } = require('../../../api/normalize/firmware');
  return {
    INIT: relAlias('CLASS_THREAD_INITIATION'),
    PROP: relAlias('CLASS_THREAD_PROPAGATION'),
    TERM: relAlias('CLASS_THREAD_TERMINATION'),
  };
}

// ── what the two operations refuse with (Decision 1; Amendment 1, item 2) ──
const UNKNOWN_SET_OR_PARENT = Object.freeze({ code: 'unknown-node', status: 404, when: 'A set or parent that names no node of the graph (a change entry is not one); the refusal names which' });
const NOT_A_SET = Object.freeze({ code: 'not-a-set', status: 409, when: "A set that is neither a set nor a superset: an element, a concept header (the refusal names its superset, the key to pass), a node with no address, such as one of the trust pipeline's card sets, or any other node" });
const NOT_A_PARENT = Object.freeze({ code: 'not-a-parent', status: 409, when: "A parent that is neither a superset nor a set: an element, a concept header (the refusal names its superset, the key to pass), a node with no address, such as one of the trust pipeline's card sets, or any other node" });

/** The link an answer is about. */
const LINK = Object.freeze({
  type: 'object',
  required: ['set', 'parent'],
  properties: {
    set: { type: 'string', description: "The tapestryKey of the set, or of the concept's superset" },
    parent: { type: 'string', description: 'The tapestryKey of the superset or set it is directly under' },
  },
});

/** "<name>" (<tapestryKey>) for messages, or the key alone. */
function describe(node) {
  if (!node) return 'a node';
  const key = typeof node.key === 'string' && node.key ? node.key : null;
  const name = typeof node.name === 'string' && node.name ? node.name : null;
  if (name) return key ? `"${name}" (${key})` : `"${name}"`;
  return key || 'a node';
}

const say = {
  notASet(node, superset) {
    return superset
      ? `${describe(node)}, which set names, is a concept header, not a set or a superset. To put its concept under another parent, or take it out from under one, pass its superset's tapestryKey, ${superset}.`
      : `${describe(node)}, which set names, is neither a set nor a superset. A set or a superset is a node labelled Set or Superset that has an address, its uuid; a node with no address, such as one of the trust pipeline's card sets, isn't one. Pass the tapestryKey of a set or of a concept's superset.`;
  },
  notAParent(node, superset) {
    return superset
      ? `${describe(node)}, which parent names, is a concept header, not a superset or a set. To use its concept's class thread, pass its superset's tapestryKey, ${superset}.`
      : `${describe(node)}, which parent names, is neither a superset nor a set, so no set goes under it. A superset or a set is a node labelled Superset or Set that has an address, its uuid; a node with no address, such as one of the trust pipeline's card sets, isn't one. Pass the tapestryKey of a concept's superset or of a set.`;
  },
};

// ── the reads (Decision 10's statements) ──
/** R1: the node a tapestryKey names (never a change entry) → { key, uuid, name, labels, pubkey, hasLetter }, or null. */
async function nodeOf(read, key) {
  if (typeof key !== 'string' || !key) return null;
  const rows = await read('MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n', { key });
  const n = rows.length && isObject(rows[0].n) ? rows[0].n : null;
  if (!n) return null;
  return {
    key,
    uuid: typeof n.uuid === 'string' ? n.uuid : null,
    name: typeof n.name === 'string' ? n.name : null,
    labels: Array.isArray(n._labels) ? [...n._labels] : [],
    pubkey: typeof n.pubkey === 'string' ? n.pubkey : null,
    // A letter is an event: a set today's create-set signed has its event's id, one add-subset made has none (Context 5).
    hasLetter: n.id !== undefined && n.id !== null,
  };
}

/**
 * 'superset' (labelled Superset), 'set' (Set, not Superset) or 'other' (Decision 5). Only a node with an address, its
 * uuid, is either (Amendment 3): the trust pipeline's card sets are labelled Set and have none. A node read with R1, a
 * parent read with R3 and a walk's node each carry the uuid this reads.
 */
function kindOf(node) {
  if (!node || typeof node.uuid !== 'string' || !node.uuid) return 'other';
  const labels = Array.isArray(node.labels) ? node.labels : [];
  if (labels.includes('Superset')) return 'superset';
  if (labels.includes('Set')) return 'set';
  return 'other';
}

/** R2: the tapestryKey of the superset the concept header keyed `key` points to, or null for any other node. */
async function supersetOf(read, key) {
  const { INIT } = aliases();
  const rows = await read(`MATCH (h:TapestryNode {tapestryKey: $key})-[:${INIT}]->(s:Superset) RETURN s.tapestryKey AS key LIMIT 1`, { key });
  return rows.length && typeof rows[0].key === 'string' ? rows[0].key : null;
}

/** R2 in reverse: the uuids of the concept headers that point to the superset keyed `key`. */
async function headersOf(read, key) {
  const { INIT } = aliases();
  const rows = await read(`MATCH (s:TapestryNode {tapestryKey: $key})<-[:${INIT}]-(h) RETURN h.uuid AS uuid`, { key });
  return [...new Set(rows.map((r) => r.uuid).filter((u) => typeof u === 'string' && u))];
}

/** R3: each node's parents, one level up → [{ child, parent, uuid, name, labels }], a row per link (two copies, two). */
async function parentsOf(read, keys) {
  const wanted = [...new Set((Array.isArray(keys) ? keys : []).filter((k) => typeof k === 'string' && k))];
  if (!wanted.length) return [];
  const { PROP } = aliases();
  const rows = await read(
    `MATCH (c:TapestryNode)<-[:${PROP}]-(u:TapestryNode)
     WHERE c.tapestryKey IN $keys AND NOT u:GraphChange
     RETURN c.tapestryKey AS child, u.tapestryKey AS parent, u.uuid AS uuid, u.name AS name, labels(u) AS labels`,
    { keys: wanted },
  );
  return rows.filter((r) => typeof r.child === 'string' && typeof r.parent === 'string').map((r) => ({
    child: r.child,
    parent: r.parent,
    key: r.parent,
    uuid: typeof r.uuid === 'string' ? r.uuid : null,
    name: typeof r.name === 'string' ? r.name : null,
    labels: Array.isArray(r.labels) ? r.labels : [],
  }));
}

/** Whether a class-thread link runs from the node keyed `parent` to the node keyed `set`. */
async function isLinked(read, parent, set) {
  return (await parentsOf(read, [set])).some((r) => r.parent === parent);
}

/** R4: the tapestryKeys of a node's direct sets, each once. */
async function childrenOf(read, key) {
  const { PROP } = aliases();
  const rows = await read(`MATCH (p:TapestryNode {tapestryKey: $key})-[:${PROP}]->(c:TapestryNode) WHERE NOT c:GraphChange RETURN c.tapestryKey AS key`, { key });
  return [...new Set(rows.map((r) => r.key).filter((k) => typeof k === 'string'))];
}

// ── the walks (Decision 8) ──
/**
 * The class thread above `from`, read one level at a time over the frontier of keys not yet visited, until nothing new
 * appears → Map(child → [parent]), one entry for `from` and each node above it. The visited set ends the walk on a
 * cycle the old routes made; `from` is in it from the start, so its parents are read once. `skip: [parent, child]`
 * leaves that one link out of the first level (Decision 6). `nodes`, when given, is a Map that gets each parent read,
 * { key, uuid, name, labels }, for messages and kinds.
 */
async function ancestors(read, from, { skip = null, nodes = null } = {}) {
  const up = new Map();
  const seen = new Set([from]);
  let frontier = [from];
  let first = true;
  while (frontier.length) {
    for (const k of frontier) up.set(k, []);
    const next = [];
    for (const r of await parentsOf(read, frontier)) {
      if (first && skip && r.parent === skip[0] && r.child === skip[1]) continue;
      const list = up.get(r.child);
      if (!list || list.includes(r.parent)) continue;
      list.push(r.parent);
      if (nodes && !nodes.has(r.parent)) nodes.set(r.parent, { key: r.parent, uuid: r.uuid, name: r.name, labels: r.labels });
      if (!seen.has(r.parent)) { seen.add(r.parent); next.push(r.parent); }
    }
    frontier = next;
    first = false;
  }
  return up;
}

/** Whether `key` is a parent anywhere in the walk `up`: the walk's node is below it. */
function isAbove(up, key) {
  for (const parents of up.values()) if (parents.includes(key)) return true;
  return false;
}

/** The path up from `from` to `to` in the walk `up`, as tapestryKeys, `from` first; [from, to] when there is none. */
function chain(up, from, to) {
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const x = queue.shift();
    if (x === to) break;
    for (const p of up.get(x) || []) if (!prev.has(p)) { prev.set(p, x); queue.push(p); }
  }
  if (!prev.has(to)) return [from, to];
  const out = [];
  for (let x = to; x !== null; x = prev.get(x)) out.unshift(x);
  return out;
}

// ── both operations' first two steps (Decision 1) ──
/**
 * Refuse unknown-node, naming the input, unless `set` and `parent` each name a node; then not-a-set unless `set` is a
 * set or a superset, and not-a-parent unless `parent` is a superset or a set, naming a concept header's superset as the
 * key to pass. → { setNode, parentNode }
 */
async function requireEnds(tx, { set, parent }) {
  await N.requireNodes(tx, [['set', set], ['parent', parent]]);
  const read = (cypher, params) => tx.read(cypher, params);
  const setNode = await nodeOf(read, set);
  const parentNode = await nodeOf(read, parent);
  if (!setNode || !parentNode) throw new Error('the set or the parent went missing after it was found');
  if (kindOf(setNode) === 'other') throw refusal(NOT_A_SET.code, say.notASet(setNode, await supersetOf(read, set)), { input: 'set' });
  if (kindOf(parentNode) === 'other') throw refusal(NOT_A_PARENT.code, say.notAParent(parentNode, await supersetOf(read, parent)), { input: 'parent' });
  return { setNode, parentNode };
}

// The node property a lock writes and takes away again in the same transaction, so nothing of it is ever committed:
// the same name ADR graph-operations-first-slice/0016's lock (C1) uses.
const LOCK_PROPERTY = 'tapestryLock';
const LOCK_STATEMENT = `UNWIND $rows AS row
   MATCH (n:TapestryNode {tapestryKey: row.key}) WHERE NOT n:GraphChange
   SET n += row.props
   RETURN count(n) AS n`;
/**
 * Take a write lock on one node until the transaction ends (ADR graph-operations-first-slice/0028 Amendment 2): a
 * relationship's DELETE doesn't lock its ends, so two unlink-sets of one set would otherwise both pass their re-check.
 * It sets a property and removes it again, in the statement shape field mapping's copies use, so the node is left as
 * it was and only the lock remains, held until commit or rollback.
 */
async function lockNode(tx, key) {
  await tx.run(LOCK_STATEMENT, { rows: [{ key, props: { [LOCK_PROPERTY]: true } }] });
  await tx.run(LOCK_STATEMENT, { rows: [{ key, props: { [LOCK_PROPERTY]: null } }] });
}

// ── firmware's links and firmware's prune (Decision 6) ──
/**
 * src/firmware/install.js:123's categoryToSlug, copied (it is private there): a manifest category, a plural, to the
 * slug of the firmware concept its existing-sets go under. Two overrides for irregular plurals, then a final s
 * stripped. If install's changes, this must follow.
 */
function categoryToSlug(category) {
  const overrides = { properties: 'property', sets: 'set' };
  if (overrides[category]) return overrides[category];
  return category.replace(/s$/, '');
}

/** The key of a concept manifest's class-thread links, as install.js reads it (its relTypes). */
const MANIFEST_LINKS = 'IS_A_SUPERSET_OF';

let firmwareCache = null;
/**
 * The class-thread links the active firmware's definition makes, read from its files once per process, with <TA> this
 * instance's assistant (Decision 6's table). Each end is a descriptor: `node:<uuid>` for a node whose address the
 * definition gives, or `superset-of:<header uuid>` for a concept's superset, matched through its header, so a
 * superset's own address is never assumed.
 *   (a) each concepts/<c>/sets/<f>.json: superset-of:39998:<TA>:<c> → node:39999:<TA>:<word.slug, or f>
 *   (b) manifest.json's sets.<category>['existing-sets'][].concept: superset-of:39998:<TA>:<categoryToSlug(category)>
 *       → superset-of:39998:<TA>:<concept>
 *   (c) each concepts/<c>/manifest.json's IS_A_SUPERSET_OF [{ nodeFrom, nodeTo }]: node:39999:<TA>:<slug of nodeFrom>
 *       → node:39999:<TA>:<slug of nodeTo>; a name is the set file of that name in <c>'s sets/, else the first such
 *       file in any firmware concept, and an edge with a name that resolves to no set file is left out (Amendment 3,
 *       item 3: an element file's address isn't its word.slug)
 *   (d) each communityReference.headerATag 39998:<pk>:<d>: superset-of:39998:<TA>:<c> → node:39999:<pk>:<d>-superset,
 *       but none when <pk> is <TA>: install skips a reference the instance curates itself (community-reference ADR 0035
 *       Decision 3, Amendment 1 item 8)
 * → { pairs: Map('<parent> <set>' → { part, what }), pruned: Set of the superset-of descriptors of the concepts whose
 *   folder has a manifest.json, the ones install's prune pass covers }. Nothing, with no assistant key.
 */
function firmwareLinks() {
  if (firmwareCache) return firmwareCache;
  const { getOwnerAssistantPubkey } = require('../../../utils/assistantKeys');
  const ta = getOwnerAssistantPubkey();
  if (!ta) return { pairs: new Map(), pruned: new Set() };
  const fs = require('fs');
  const path = require('path');
  const firmware = require('../../../api/normalize/firmware');
  const root = firmware.firmwareDir();
  const manifest = firmware.getManifest();
  const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } };
  const jsonFiles = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort() : []);
  const supersetOfConcept = (slug) => `superset-of:39998:${ta}:${slug}`;
  const pairs = new Map();
  const pruned = new Set();
  const add = (parent, set, made) => { const k = `${parent} ${set}`; if (!pairs.has(k)) pairs.set(k, made); };

  const concepts = (manifest.concepts || []).filter((c) => isObject(c) && typeof c.slug === 'string' && typeof c.dir === 'string');
  // Each concept's set files, by name: their word.slug, else the name (install's d-tag for a set file, and so its
  // address's last part).
  const setFiles = new Map();
  for (const c of concepts) {
    const dir = path.join(root, c.dir);
    const own = new Map();
    for (const f of jsonFiles(path.join(dir, 'sets'))) {
      const name = f.slice(0, -'.json'.length);
      const data = readJson(path.join(dir, 'sets', f));
      own.set(name, isObject(data) && isObject(data.word) && typeof data.word.slug === 'string' && data.word.slug ? data.word.slug : name);
    }
    setFiles.set(c.slug, own);
    if (fs.existsSync(path.join(dir, 'manifest.json'))) pruned.add(supersetOfConcept(c.slug));
  }
  const relative = (c, ...parts) => path.posix.normalize(path.posix.join(String(c.dir).replace(/\\/g, '/'), ...parts));

  // (a) each set file
  for (const c of concepts) {
    for (const [name, slug] of setFiles.get(c.slug)) {
      add(supersetOfConcept(c.slug), `node:39999:${ta}:${slug}`, { part: 'a', what: `the set file ${relative(c, 'sets', `${name}.json`)}, which puts that set under the superset of ${c.slug}` });
    }
  }
  // (b) existing-sets
  for (const [category, data] of Object.entries(isObject(manifest.sets) ? manifest.sets : {})) {
    const parentSlug = categoryToSlug(category);
    const listed = isObject(data) && Array.isArray(data['existing-sets']) ? data['existing-sets'] : [];
    for (const e of listed) {
      if (!isObject(e) || typeof e.concept !== 'string') continue;
      add(supersetOfConcept(parentSlug), supersetOfConcept(e.concept), { part: 'b', what: `the firmware manifest's existing-sets for ${category}, which put the superset of ${e.concept} under the superset of ${parentSlug}` });
    }
  }
  // (c) concept manifests, set files only (Amendment 3, item 3): their IS_A_SUPERSET_OF links sets, and an element
  // file's address isn't its word.slug
  const resolve = (c, name) => {
    for (const owner of [c, ...concepts]) if (setFiles.get(owner.slug).has(name)) return setFiles.get(owner.slug).get(name);
    return null;
  };
  for (const c of concepts) {
    const m = readJson(path.join(root, c.dir, 'manifest.json'));
    const edges = isObject(m) && Array.isArray(m[MANIFEST_LINKS]) ? m[MANIFEST_LINKS] : [];
    for (const edge of edges) {
      if (!isObject(edge) || typeof edge.nodeFrom !== 'string' || typeof edge.nodeTo !== 'string') continue;
      const from = resolve(c, edge.nodeFrom);
      const to = resolve(c, edge.nodeTo);
      if (!from || !to) continue;
      add(`node:39999:${ta}:${from}`, `node:39999:${ta}:${to}`, { part: 'c', what: `the concept manifest ${relative(c, 'manifest.json')}, whose ${MANIFEST_LINKS} lists ${edge.nodeFrom} → ${edge.nodeTo}` });
    }
  }
  // (d) community references, parsed as install.js parses them (39998:<curatorPk>:<dTag>)
  for (const c of concepts) {
    const tag = isObject(c.communityReference) ? c.communityReference.headerATag : null;
    const parts = typeof tag === 'string' ? tag.split(':') : [];
    if (parts.length < 3 || parts[0] !== '39998') continue;
    if (parts[1] === ta) continue;
    const address = `39999:${parts[1]}:${parts.slice(2).join(':')}-superset`;
    add(supersetOfConcept(c.slug), `node:${address}`, { part: 'd', what: `the community reference of ${c.slug}, ${tag}, which puts its curator's superset, ${address}, under the superset of ${c.slug}` });
  }
  firmwareCache = Object.freeze({ pairs, pruned });
  return firmwareCache;
}

/** A node's descriptors (Decision 6): node:<uuid>, and for a superset superset-of:<uuid> of each header that points to it. */
async function descriptorsOf(read, node) {
  const out = node && node.uuid ? [`node:${node.uuid}`] : [];
  if (node && kindOf(node) === 'superset') for (const h of await headersOf(read, node.key)) out.push(`superset-of:${h}`);
  return out;
}

/** The part of firmware's definition that makes the link from parentNode to setNode, { part, what }, or null. */
async function isFirmwareLink(read, parentNode, setNode) {
  const { pairs } = firmwareLinks();
  if (!pairs.size) return null;
  const fromParent = await descriptorsOf(read, parentNode);
  const fromSet = await descriptorsOf(read, setNode);
  for (const p of fromParent) {
    for (const s of fromSet) {
      const made = pairs.get(`${p} ${s}`);
      if (made) return made;
    }
  }
  return null;
}

/**
 * The links install's prune pass (src/firmware/install.js:807–833) would take out, among those a link from `parent` to
 * `set` could affect → [{ parent, set, isNew }], by tapestryKey, isNew when it is that link itself. The supersets are
 * `parent` and those above it whose concept's folder has a manifest.json; for each, F, a link F → Y to a direct child
 * is prunable when F is above Y through another parent. Unlike install it walks with no depth limit, on the safe side.
 * Given `before`, what it found before the link was made, it answers only the links that weren't among them, so a
 * redundancy already in the graph never blocks an unrelated link.
 */
async function firmwarePrunes(read, { parent, set, before = null }) {
  const { pruned } = firmwareLinks();
  if (!pruned.size) return [];
  const nodes = new Map();
  const self = await nodeOf(read, parent);
  if (self) nodes.set(parent, self);
  const up = await ancestors(read, parent, { nodes });
  const covered = [];
  for (const key of new Set([parent, ...up.keys()])) {
    const n = nodes.get(key);
    if (!n || kindOf(n) !== 'superset') continue;
    if ((await descriptorsOf(read, n)).some((d) => pruned.has(d))) covered.push(key);
  }
  const out = [];
  for (const top of covered) {
    for (const child of await childrenOf(read, top)) {
      if (isAbove(await ancestors(read, child, { skip: [top, child] }), top)) out.push({ parent: top, set: child, isNew: top === parent && child === set });
    }
  }
  if (!Array.isArray(before)) return out;
  return out.filter((l) => !before.some((b) => b.parent === l.parent && b.set === l.set));
}

// ── peers' links and the instance's own letters (Decision 7) ──
/** The instance's own keys: its assistant's and its owner's. */
function ownKeys() {
  const { getOwnerAssistantPubkey } = require('../../../utils/assistantKeys');
  const { getOwnerPubkey } = require('../../../utils/config');
  return [getOwnerAssistantPubkey(), getOwnerPubkey()].filter((k) => typeof k === 'string' && k);
}

/** R5: whether setNode's own letter names parentNode as its parent, in an s tag. */
async function letterNames(read, parentNode, setNode) {
  if (!setNode.hasLetter || !parentNode.uuid) return false;
  const rows = await read("MATCH (s:TapestryNode {tapestryKey: $key})-[:HAS_TAG]->(t:NostrEventTag) WHERE t.type = 's' RETURN t.value AS value", { key: setNode.key });
  return rows.some((r) => r.value === parentNode.uuid);
}

/**
 * A peer's claim on the link → { author, address }, or null: the set's author isn't one of the instance's own keys, the
 * set has a letter, and one of its s tags is the parent's uuid. That is the link a pull of their class thread makes
 * again (Context 6).
 */
async function peerClaim(read, parentNode, setNode) {
  if (ownKeys().includes(setNode.pubkey)) return null;
  return (await letterNames(read, parentNode, setNode)) ? { author: setNode.pubkey, address: setNode.uuid } : null;
}

/**
 * The instance's own letters that still name the parent → [{ address, says }]: one, when the set's author is one of
 * the instance's own keys, the set has a letter, and one of its s tags is the parent's uuid; else []. A would-be s tag
 * on a set with no event isn't a letter.
 */
async function ownLetters(read, parentNode, setNode) {
  if (!ownKeys().includes(setNode.pubkey)) return [];
  if (!(await letterNames(read, parentNode, setNode))) return [];
  return [{ address: setNode.uuid, says: `its s tag still names ${parentNode.uuid} as a parent, which the graph no longer has it under; export nostr (A10.34) is what sends a letter that matches` }];
}

// ── making a set (ADR graph-operations-first-slice/0027) ──
/**
 * Decision 4: refuse unknown-node, naming parent, unless `parent` names a node; then not-a-parent unless it is a
 * superset or a set, naming a concept header's superset as the key to pass. These are the reads and the words
 * requireEnds uses on link-set's parent, so the two accept and refuse the same nodes. → the parent node, as R1 reads it
 */
async function requireParent(tx, parent) {
  await N.requireNodes(tx, [['parent', parent]]);
  const read = (cypher, params) => tx.read(cypher, params);
  const node = await nodeOf(read, parent);
  if (!node) throw new Error('the parent went missing after it was found');
  if (kindOf(node) === 'other') throw refusal(NOT_A_PARENT.code, say.notAParent(node, await supersetOf(read, parent)), { input: 'parent' });
  return node;
}

/** Decision 11: one class-thread link from the node keyed `parent` to the node keyed `set`, by link-set's MERGE. */
async function linkUnder(tx, parent, set) {
  const { PROP } = aliases();
  const { rows } = await tx.run(
    `MATCH (a:TapestryNode {tapestryKey: $from}) WHERE NOT a:GraphChange
     MATCH (b:TapestryNode {tapestryKey: $to}) WHERE NOT b:GraphChange
     MERGE (a)-[r:\`${PROP}\`]->(b)
     RETURN count(r) AS n`,
    { from: parent, to: set },
  );
  if (!rows.length || rows[0].n !== 1) throw new Error(`the new set's ${PROP} found ${rows.length ? rows[0].n : 0} pairs of nodes to join, not 1`);
}

/**
 * A set's word-wrapper JSON (Decision 9), keys in the order firmware's set files hold them: its word block (the-set-of-
 * <slug>, "The set of <name>", "The Set of <Title>"), whose wordTypes list word, set, then the key of each other concept
 * the set is an element of, sorted (D10: membership is the edges); then its set section, holding its slug, name, title
 * and, when given, its description. No value is made up.
 */
function setJson({ name, slug, description = null, others = [] }) {
  const title = CN.toTitleName(name);
  const rest = [...new Set((Array.isArray(others) ? others : []).filter((k) => typeof k === 'string' && k && k !== 'word' && k !== 'set'))].sort();
  const word = { slug: `the-set-of-${slug}`, name: `The set of ${name}`, title: `The Set of ${title}`, wordTypes: ['word', 'set', ...rest] };
  const section = { slug, name, title, ...(typeof description === 'string' && description ? { description } : {}) };
  return { word, set: section };
}

/** The tags of the letter a set write would sign (Decision 10), today's create-set's then json: d, name, z, s, description when given, json. */
function setTags({ d, name, setConcept, parent, description = null, json }) {
  return [['d', d], ['name', name], ['z', setConcept], ['s', parent], ...(typeof description === 'string' && description ? [['description', description]] : []), ['json', json]];
}

/**
 * R7 (Decision 7): this instance's own set directly under the node keyed `parent` that the call repeats: one labelled
 * Set and not Superset, with an address, made by the assistant, with a letter or without, whose name, lowercased, is the
 * name lowercased, or that sits at the address the name and parent give, with or without a nonce. Of several, the one
 * at the plain address, then the lowest tapestryKey. Another author's set is never one. → { key, uuid, name, hasLetter,
 * description, json, parents } or null
 */
async function findSetRepeat(read, { parent, name, ta, address }) {
  const { PROP } = aliases();
  const rows = await read(
    `MATCH (p:TapestryNode {tapestryKey: $parent})-[:${PROP}]->(s:Set)
     WHERE NOT s:Superset AND NOT s:GraphChange AND s.uuid IS NOT NULL AND s.pubkey = $ta
       AND (toLower(s.name) = $name OR s.uuid = $address OR s.uuid STARTS WITH $nonced)
     WITH DISTINCT s
     OPTIONAL MATCH (s)-[:HAS_TAG]->(d:NostrEventTag {type: 'description'})
     OPTIONAL MATCH (s)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
     OPTIONAL MATCH (u)-[:${PROP}]->(s)
     RETURN s.tapestryKey AS key, s.uuid AS uuid, s.name AS name, s.id IS NOT NULL AS hasLetter,
            head(collect(DISTINCT d.value)) AS description, head(collect(DISTINCT j.value)) AS json,
            collect(DISTINCT u.tapestryKey) AS parents`,
    { parent, ta, name: name.toLowerCase(), address, nonced: `${address}~` },
  );
  const found = rows.filter((r) => typeof r.key === 'string');
  found.sort((a, b) => (a.uuid === address ? 0 : 1) - (b.uuid === address ? 0 : 1) || a.key.localeCompare(b.key));
  const r = found[0];
  if (!r) return null;
  const parents = [...new Set((Array.isArray(r.parents) ? r.parents : []).filter((k) => typeof k === 'string'))].sort();
  return {
    key: r.key,
    uuid: typeof r.uuid === 'string' ? r.uuid : null,
    name: typeof r.name === 'string' ? r.name : null,
    hasLetter: r.hasLetter === true,
    description: typeof r.description === 'string' && r.description ? r.description : null,
    json: r.json === undefined ? null : r.json,
    parents,
  };
}

/** Each input given that differs from what the repeated set holds (Decision 7): the name, case included; the description, when one is given. */
function setDiffers(repeat, { name, description }) {
  const out = [];
  if (repeat.name !== name) out.push({ input: 'name', given: name, holds: repeat.name });
  const held = typeof repeat.description === 'string' && repeat.description ? repeat.description : null;
  if (typeof description === 'string' && description !== held) out.push({ input: 'description', given: description, holds: held });
  return out;
}

/** A set as an answer gives it (Decision 13). */
function describeSet({ key, address = null, name = null, slug = null, description = null, parents = [], hasLetter = false }) {
  return {
    tapestryKey: key,
    address: typeof address === 'string' && address ? address : null,
    name: typeof name === 'string' ? name : null,
    slug: typeof slug === 'string' && slug ? slug : null,
    description: typeof description === 'string' && description ? description : null,
    parents: [...parents],
    hasLetter: hasLetter === true,
  };
}

module.exports = {
  UNKNOWN_SET_OR_PARENT,
  NOT_A_SET,
  NOT_A_PARENT,
  LINK,
  say,
  aliases,
  describe,
  nodeOf,
  kindOf,
  supersetOf,
  parentsOf,
  isLinked,
  childrenOf,
  ancestors,
  isAbove,
  chain,
  requireEnds,
  lockNode,
  firmwareLinks,
  descriptorsOf,
  isFirmwareLink,
  firmwarePrunes,
  peerClaim,
  ownLetters,
  requireParent,
  linkUnder,
  setJson,
  setTags,
  findSetRepeat,
  setDiffers,
  describeSet,
};
