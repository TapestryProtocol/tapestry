'use strict';
/**
 * lifecycle seed-firmware's source: the firmware's target, built from the files of one firmware folder (story
 * graph-operations-first-slice #37, ADR graph-operations-first-slice/0037 Decisions 2 to 5 and Amendment 1).
 *
 *   buildTarget({ dir, ta }) → { version, source, nodes, relationships, references, problems }
 *
 * The target is what today's install (src/firmware/install.js) leaves in the graph for these files, rebuilt without
 * signing: every node at the address today's install gives it, under the assistant `ta`, with its kind, role labels,
 * name, tags as today's route first signs them, JSON and where it came from, and every relationship between them.
 * It is a pure function of the files and `ta`: it reads each file it needs once, fresh, writes nothing and asks no
 * graph, relay or key.
 *
 *   version        the manifest's
 *   source         { kind: 'files', digest, files }: files maps each file read, by its posix path in the folder, to the
 *                  sha256 of its bytes; digest is the sha256 of those pairs, so the same files anywhere give the same one
 *   nodes          [{ address, kind, labels, name, tags, json, slug, cameFrom, role, concept, file, updateElements,
 *                  letter }]: json the parsed JSON (null for a set and a relationship letter); cameFrom
 *                  { kind: 'file', address, id }; letter { nodeFrom, nodeTo, relationshipType } on a set's
 *                  relationship letter, whose address here is a stand-in, since today's create-set gives it a random
 *                  d-tag and a graph's is matched by these three (Decision 4, 1c½)
 *   relationships  [{ type, from, to, properties }], by address, after 1e's and 3c's prunes
 *   references     each community-reference curator header's address that a b claim reaches (Decision 9)
 *   problems       why the files can't be installed, each naming the file or the concept, a relationship alias that
 *                  isn't a plain name among them (Amendment 3, item 5); with any, no nodes
 *   ta, aliases    the assistant, and the folder's relationship types as conceptNodes names them, for the installer
 *
 * Today's order, pass by pass (Decision 4): 1a the concepts (conceptNodes, with the header file's overrides,
 * headerTags and word types, and no o tags); 1b the elements; 1c the manifest's existing nodes, with no rewrite of the parent's concept
 * graph (Amendment 1, item 2); 1c½ the sets and their relationship letters; the existing sets; 1c¾ the concept
 * manifests' links; 1d the z tags' HAS_ELEMENT; 1d½ the headers under concept-header; 1d¾ ENUMERATES; 1e the prune;
 * pass 2 the schemas and the primary-property fold (Amendment 1, item 1); the community references' pointer b and its
 * claim; 3c the implicit elements and their prune. Pass 3b isn't rebuilt (Decision 5). Each prune runs in one fixed
 * order, by address (Amendment 1, item 5).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCHEMA_URL = 'https://json-schema.org/draft/2020-12/schema';
/** The conceptHeader fields create-concept builds itself, which a header file's overrides never replace. */
const GENERATED = new Set(['description', 'oNames', 'oSlugs', 'oKeys', 'oTitles', 'headerTags']);
/** The relationship types the core nodes use, by canonical slug, under the names conceptNodes' aliases take. */
const ALIASES = Object.freeze({
  INIT: 'CLASS_THREAD_INITIATION', PROP: 'CLASS_THREAD_PROPAGATION', TERM: 'CLASS_THREAD_TERMINATION',
  SCHEMA: 'CORE_NODE_JSON_SCHEMA', PRIMARY: 'CORE_NODE_PRIMARY_PROPERTY', PROPERTIES: 'CORE_NODE_PROPERTIES',
  TREE: 'CORE_NODE_PROPERTY_TREE_GRAPH', CORE: 'CORE_NODE_CORE_GRAPH', GRAPH: 'CORE_NODE_CONCEPT_GRAPH',
  MEMBER: 'PROPERTY_MEMBERSHIP',
});
/** The concept manifests' link names, as install.js reads them (its relTypes). */
const MANIFEST_LINKS = Object.freeze({ HAS_ELEMENT: 'TERM', IS_A_SUPERSET_OF: 'PROP' });
/** Each core node's firmware concept, which today's create-concept makes it an element of (its step 11). */
const MEMBER_OF = Object.freeze({ superset: 'superset', jsonSchema: 'json-schema', primaryProperty: 'primary-property', properties: 'properties-set', propertyTreeGraph: 'property-tree-graph', conceptGraph: 'concept-graph', coreNodesGraph: 'core-nodes-graph' });
/** A manifest's core-node-type, as the role conceptNodes gives that node (install.js's coreNodeTypeToRel). */
const CORE_NODE_TYPES = Object.freeze({ 'concept-header': 'conceptHeader', superset: 'superset', 'json-schema': 'jsonSchema', 'primary-property': 'primaryProperty', 'properties-set': 'properties', 'property-tree-graph': 'propertyTreeGraph', 'core-nodes-graph': 'coreNodesGraph', 'concept-graph': 'conceptGraph' });
const ENUMERATES = 'ENUMERATES';
const REFERENCES = 'REFERENCES';
/** What a relationship alias must be, since it reaches Cypher's text (ADR 0037 Amendment 3, item 5). */
const PLAIN_NAME = /^[A-Z_][A-Z0-9_]*$/;
/** A word type create-concept takes in a header's wordTypes: a concept key's form (ADR 0047 Decision 9). */
const KEY_FORM = /^[a-z][A-Za-z0-9]*$/;

const sha256 = (x) => crypto.createHash('sha256').update(x).digest('hex');
const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const copy = (x) => JSON.parse(JSON.stringify(x));
const byText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** A path in the folder as the posix path the records use, './' and trailing slashes dropped. */
const rel = (...parts) => path.posix.join(...parts.map((p) => String(p).replace(/\\/g, '/')));
/** install.js's categoryToSlug. */
function categoryToSlug(category) {
  const overrides = { properties: 'property', sets: 'set' };
  return overrides[category] || String(category).replace(/s$/, '');
}

// ── reading the folder ──
/** Every file the builder reads, once: { json(rel), list(rel), files, problems }. */
function folderReader(dir) {
  const files = {};
  const problems = [];
  const cache = new Map();
  function json(file, why = null) {
    if (cache.has(file)) return cache.get(file);
    let out;
    let buf = null;
    try { buf = fs.readFileSync(path.join(dir, file)); } catch { buf = null; }
    if (buf === null) {
      problems.push(`${file}: ${why || 'the firmware names it'}, and it isn't there`);
      out = { ok: false };
    } else {
      files[file] = sha256(buf);
      try { out = { ok: true, data: JSON.parse(buf.toString('utf8')) }; } catch (e) {
        problems.push(`${file} isn't JSON: ${String((e && e.message) || e).split('\n')[0]}`);
        out = { ok: false };
      }
    }
    cache.set(file, out);
    return out;
  }
  function list(folder) {
    try { return fs.readdirSync(path.join(dir, folder)).filter((f) => f.endsWith('.json')).sort(); } catch { return []; }
  }
  const exists = (file) => fs.existsSync(path.join(dir, file));
  return { json, list, exists, files, problems };
}

/** The source: the files read, and their digest by path and content (Decision 3). */
function sourceOf(files) {
  const names = Object.keys(files).sort(byText);
  const sorted = Object.fromEntries(names.map((f) => [f, files[f]]));
  return { kind: 'files', digest: sha256(names.map((f) => `${f}\u0000${files[f]}`).join('\n')), files: sorted };
}

/** Read and check every file before anything is built → { manifest, concepts, aliases } or problems (Decision 3). */
function readFirmware(r) {
  const m = r.json('manifest.json', 'the folder has no manifest');
  if (!m.ok) return null;
  const manifest = m.data;
  if (!isObject(manifest) || !Array.isArray(manifest.concepts)) {
    r.problems.push('manifest.json holds no list of concepts');
    return null;
  }
  // The relationship types, and their aliases (conceptNodes' rel(), from this folder).
  const canonical = {};
  const aliasSet = new Set();
  for (const entry of Array.isArray(manifest.relationshipTypes) ? manifest.relationshipTypes : []) {
    if (!isObject(entry) || typeof entry.file !== 'string') continue;
    const f = r.json(rel(entry.file), 'the manifest\'s relationshipTypes name it');
    if (!f.ok) continue;
    const rt = isObject(f.data) && isObject(f.data.relationshipType) ? f.data.relationshipType : null;
    if (!rt || typeof rt.slug !== 'string' || typeof rt.alias !== 'string') { r.problems.push(`${rel(entry.file)} has no relationshipType with a slug and an alias`); continue; }
    // An alias names a relationship type in Cypher's text, so it must be a plain name (Amendment 3, item 5).
    if (!PLAIN_NAME.test(rt.alias)) { r.problems.push(`${rel(entry.file)}: the alias ${JSON.stringify(rt.alias)} of the relationship type ${rt.slug} isn't a plain name, [A-Z_][A-Z0-9_]*`); continue; }
    canonical[rt.slug] = rt.alias;
    aliasSet.add(rt.alias);
  }
  const aliases = {};
  for (const [k, slug] of Object.entries(ALIASES)) {
    if (canonical[slug]) aliases[k] = canonical[slug];
    else r.problems.push(`manifest.json's relationshipTypes lack ${slug}, which every concept's core nodes use`);
  }
  aliases.ENUM = canonical.PROPERTY_ENUMERATION || ENUMERATES;

  // Each concept's files.
  const concepts = [];
  for (const entry of manifest.concepts) {
    if (!isObject(entry) || typeof entry.slug !== 'string' || typeof entry.dir !== 'string' || typeof entry.conceptHeader !== 'string') {
      r.problems.push(`manifest.json has a concept entry with no slug, dir or conceptHeader: ${JSON.stringify(entry).slice(0, 120)}`);
      continue;
    }
    const dir = rel(entry.dir);
    const headerFile = rel(dir, entry.conceptHeader);
    const h = r.json(headerFile, `the manifest names it as ${entry.slug}'s concept header`);
    const ch = h.ok && isObject(h.data) && isObject(h.data.conceptHeader) ? h.data.conceptHeader : null;
    if (h.ok && !(ch && isObject(ch.oNames) && typeof ch.oNames.singular === 'string' && ch.oNames.singular.trim())) {
      r.problems.push(`${headerFile} has no conceptHeader.oNames.singular, the concept's name`);
    }
    // The header's word types, as today's pass 1a passes them to create-concept: a list, when the file's word block holds
    // one (ADR graph-operations-first-slice/0047 Decision 9). The route refuses one that isn't each a key's form, and
    // makes no concept.
    const wordTypes = h.ok && isObject(h.data) && isObject(h.data.word) && Array.isArray(h.data.word.wordTypes) ? h.data.word.wordTypes : null;
    if (wordTypes && !wordTypes.every((w) => typeof w === 'string' && KEY_FORM.test(w))) {
      r.problems.push(`${headerFile}'s word.wordTypes isn't a list of concept keys, each [a-z][A-Za-z0-9]*, so today's create-concept refuses it and makes no concept`);
    }
    const schemaFile = typeof entry.jsonSchema === 'string' ? rel(dir, entry.jsonSchema) : null;
    const s = schemaFile ? r.json(schemaFile, `the manifest names it as ${entry.slug}'s JSON schema`) : null;
    const manifestFile = rel(dir, 'manifest.json');
    const cm = r.exists(manifestFile) ? r.json(manifestFile) : null;
    if (cm && cm.ok) {
      if (!isObject(cm.data)) r.problems.push(`${manifestFile} isn't an object of relationship types`);
      else {
        for (const name of Object.keys(cm.data)) {
          if (!aliasSet.has(name)) r.problems.push(`${manifestFile} uses the relationship type ${name}, which manifest.json's relationshipTypes lack`);
        }
      }
    }
    const elements = r.list(rel(dir, 'elements')).map((f) => ({ file: rel(dir, 'elements', f), name: f.replace(/\.json$/, '') }));
    const sets = r.list(rel(dir, 'sets')).map((f) => ({ file: rel(dir, 'sets', f), name: f.replace(/\.json$/, '') }));
    const E = require('../operations/catalog/graph/_elements');
    for (const e of elements) {
      const f = r.json(e.file);
      e.data = f.ok ? f.data : null;
      if (f.ok && !E.installName(e.data)) r.problems.push(`${e.file} gives its element no name: no word.name, section name or word.slug`);
    }
    for (const x of sets) { const f = r.json(x.file); x.data = f.ok ? f.data : null; }
    concepts.push({
      entry, slug: entry.slug, dir, headerFile, header: ch, wordTypes, schemaFile, schema: s && s.ok ? s.data : null,
      manifestFile: cm && cm.ok && isObject(cm.data) ? manifestFile : null, links: cm && cm.ok && isObject(cm.data) ? cm.data : null, elements, sets,
    });
  }

  // An enumeration names concepts the manifest must define (Amendment 1, item 4: an existing node or set that names
  // one is skipped, as today, and isn't a problem).
  const defined = (x) => concepts.some((c) => c.slug === x || (c.header && c.header.oNames && String(c.header.oNames.singular).toLowerCase() === String(x).replace(/-/g, ' ').toLowerCase()));
  for (const [plural, data] of Object.entries(isObject(manifest.enumerations) ? manifest.enumerations : {})) {
    const entries = isObject(data) && Array.isArray(data['existing-nodes']) ? data['existing-nodes'] : [];
    if (!entries.length) continue;
    const by = categoryToSlug(plural);
    if (!defined(by)) r.problems.push(`manifest.json's enumerations.${plural} is by the concept ${by}, which the manifest doesn't define`);
    for (const e of entries) {
      const concept = isObject(e) ? e.concept : null;
      if (typeof concept !== 'string' || !defined(concept)) r.problems.push(`manifest.json's enumerations.${plural} names the concept ${concept}, which the manifest doesn't define`);
    }
  }
  return { manifest, concepts, aliases };
}

// ── the graph being built ──
function builder() {
  const nodes = [];
  const byAddress = new Map();
  const rels = new Map();
  const key = (type, from, to) => `${from}\u0000${type}\u0000${to}`;
  return {
    nodes, byAddress, rels,
    add(n) { if (byAddress.has(n.address)) return false; byAddress.set(n.address, n); nodes.push(n); return true; },
    link(type, from, to, properties = {}) {
      if (!from || !to) return;
      const k = key(type, from, to);
      if (rels.has(k)) Object.assign(rels.get(k).properties, properties);
      else rels.set(k, { type, from, to, properties: { ...properties } });
    },
    unlink(type, from, to) { rels.delete(key(type, from, to)); },
    has(type, from, to) { return rels.has(key(type, from, to)); },
    /** The ends of `from`'s relationships of these types. */
    out(from, types) { const out = []; for (const r of rels.values()) if (r.from === from && types.includes(r.type)) out.push(r.to); return out; },
  };
}

/** The adjacency of some types, from the relationships as they are now: from → [to]. */
function adjacency(rels, types) {
  const out = new Map();
  for (const r of rels.values()) {
    if (!types.includes(r.type)) continue;
    if (!out.has(r.from)) out.set(r.from, []);
    out.get(r.from).push(r.to);
  }
  return out;
}
/** Whether `to` is reached from `from` in min..max steps over `adj` (a walk, by frontiers). */
function reaches(adj, from, to, min, max) {
  let frontier = new Set([from]);
  for (let k = 1; k <= max; k++) {
    const next = new Set();
    for (const n of frontier) for (const m of adj.get(n) || []) next.add(m);
    if (k >= min && next.has(to)) return true;
    if (!next.size) return false;
    frontier = next;
  }
  return false;
}
/** Every node reached from `from` in min..max steps over `adj`. */
function reachedFrom(adj, from, min, max) {
  const seen = new Set();
  let frontier = new Set([from]);
  if (min === 0) seen.add(from);
  for (let k = 1; k <= max && frontier.size; k++) {
    const next = new Set();
    for (const n of frontier) for (const m of adj.get(n) || []) next.add(m);
    if (k >= min) for (const n of next) seen.add(n);
    frontier = next;
  }
  return seen;
}

// ── the target ──
function buildTarget({ dir, ta }) {
  if (typeof dir !== 'string' || !dir) throw new Error('buildTarget needs the firmware folder, dir');
  if (typeof ta !== 'string' || !/^[0-9a-f]{64}$/.test(ta)) throw new Error('buildTarget needs the assistant\'s pubkey, ta');
  const r = folderReader(dir);
  const read = readFirmware(r);
  const done = (extra) => ({ version: read && read.manifest ? read.manifest.version : null, source: sourceOf(r.files), nodes: [], relationships: [], references: [], problems: r.problems, ...extra });
  if (!read || r.problems.length) return done({});

  const K = require('../operations/catalog/graph/_concepts');
  const CN = require('../lib/conceptNames');
  const dtag = require('../lib/dtag');
  const E = require('../operations/catalog/graph/_elements');
  const { manifest, concepts, aliases: R } = read;
  const slugs = new Set(concepts.map((c) => c.slug));
  const zOf = (slug) => (slugs.has(slug) ? `39998:${ta}:${slug}` : null);
  const headerOf = (slug) => `39998:${ta}:${slug}`;
  const cameFrom = (file) => ({ kind: 'file', address: file, id: r.files[file] });
  const g = builder();
  const roles = new Map(); // concept slug → { role → address }
  const nodeMap = new Map(); // concept slug → Map(file name → address), for 1c¾
  const mapOf = (slug) => { if (!nodeMap.has(slug)) nodeMap.set(slug, new Map()); return nodeMap.get(slug); };
  const supersetOf = (slug) => (roles.get(slug) || {}).superset || null;
  const nameOf = (address) => (g.byAddress.get(address) || {}).name;
  const jsonTag = (n) => { n.tags = n.tags.map((t) => (t[0] === 'json' ? ['json', JSON.stringify(n.json)] : t)); };

  // ── 1a: every concept, its d-tag its slug, its core nodes at its name's slug (Amendment 1, item 3) ──
  for (const c of concepts) {
    const ch = c.header;
    const name = String(ch.oNames.singular).trim();
    const plural = String(ch.oNames.plural || '').trim() || `${name}s`;
    const names = CN.deriveAllNames(name, plural);
    const built = K.conceptNodes({ names, d: c.slug, coreD: names.oSlugs.singular, ta, description: ch.description || null, zOf, aliases: R, oTags: false });
    // The header file's overrides, as handleCreateConcept merges them, and its headerTags after the description tag.
    const h = built.nodes.conceptHeader;
    h.json = copy(h.json);
    for (const [k, v] of Object.entries(ch)) if (!GENERATED.has(k)) h.json.conceptHeader[k] = copy(v);
    // The file's word types after create-concept's own, once each, in the file's order (ADR 0047 Decision 9).
    if (c.wordTypes) for (const w of c.wordTypes) if (!h.json.word.wordTypes.includes(w)) h.json.word.wordTypes.push(w);
    jsonTag(h);
    h.tags = h.tags.map((t) => (t[0] === 'description' ? ['description', String(t[1]).trim()] : t));
    for (const tag of Array.isArray(ch.headerTags) ? ch.headerTags : []) if (Array.isArray(tag) && tag.length >= 2 && typeof tag[0] === 'string') h.tags.push(copy(tag));
    const at = {};
    for (const [role, n] of Object.entries(built.nodes)) {
      at[role] = n.uuid;
      g.add({ address: n.uuid, kind: n.kind, labels: [...n.labels], name: n.name, tags: n.tags.map((t) => [...t]), json: copy(n.json), slug: null, cameFrom: cameFrom(c.headerFile), role, concept: c.slug, file: c.headerFile, updateElements: false, letter: null });
    }
    roles.set(c.slug, at);
    for (const w of built.wiring) g.link(w.type, at[w.from], at[w.to]);
  }
  // 1a's step 11: each core node an element of its firmware concept.
  for (const c of concepts) {
    for (const [role, fw] of Object.entries(MEMBER_OF)) if (slugs.has(fw)) g.link(R.TERM, supersetOf(fw), roles.get(c.slug)[role]);
  }

  // ── 1b: each concept's elements, by file name ──
  for (const c of concepts) {
    const header = headerOf(c.slug);
    const sup = supersetOf(c.slug);
    for (const e of c.elements) {
      const name = E.installName(e.data);
      const d = dtag.childDTag(name, header);
      const address = `39999:${ta}:${d}`;
      // create-element refuses a name the concept's class thread already holds.
      const held = g.out(sup, [R.TERM]).some((x) => nameOf(x) === name);
      if (held || !g.add({
        address, kind: 39999, labels: ['ListItem'], name, tags: [['d', d], ['name', name], ['z', header], ['json', JSON.stringify(e.data)]],
        json: copy(e.data), slug: elementSlug(e.data), cameFrom: cameFrom(e.file), role: 'element', concept: c.slug, file: e.file, updateElements: c.entry.updateElements === true, letter: null,
      })) continue;
      mapOf(c.slug).set(e.name, address);
      g.link(R.TERM, sup, address);
    }
  }

  // ── 1c: the manifest's existing nodes, as elements of their category's concept ──
  for (const [category, data] of Object.entries(isObject(manifest.elements) ? manifest.elements : {})) {
    if (!isObject(data)) continue;
    const parent = categoryToSlug(category);
    for (const e of Array.isArray(data['existing-nodes']) ? data['existing-nodes'] : []) {
      const role = isObject(e) ? CORE_NODE_TYPES[e['core-node-type']] : null;
      if (!role || !slugs.has(parent) || !slugs.has(e.concept)) continue;
      g.link(R.TERM, supersetOf(parent), roles.get(e.concept)[role]);
    }
  }

  // ── 1c½: each concept's sets, each with its relationship letter ──
  for (const c of concepts) {
    const parent = supersetOf(c.slug);
    for (const x of c.sets) {
      const data = isObject(x.data) ? x.data : {};
      const setName = (isObject(data.set) && data.set.name) || (isObject(data.word) && data.word.name) || x.name;
      const description = (isObject(data.set) && data.set.description) || '';
      const d = (isObject(data.word) && data.word.slug) || x.name;
      const address = `39999:${ta}:${d}`;
      mapOf(c.slug).set(x.name, address);
      const tags = [['d', d], ['name', setName], ['z', zOf('set') || ''], ['s', parent]];
      if (description) tags.push(['description', description]);
      if (!g.add({ address, kind: 39999, labels: ['ListItem', 'Set'], name: setName, tags, json: null, slug: null, cameFrom: cameFrom(x.file), role: 'set', concept: c.slug, file: x.file, updateElements: false, letter: null })) continue;
      const letter = { nodeFrom: parent, nodeTo: address, relationshipType: R.PROP };
      const stand = sha256(`${letter.nodeFrom} ${letter.relationshipType} ${letter.nodeTo}`).slice(0, 8);
      const letterName = `${nameOf(parent)} ${R.PROP} ${setName}`;
      g.add({
        address: `39999:${ta}:${stand}`, kind: 39999, labels: ['ListItem'], name: letterName,
        tags: [['d', stand], ['name', letterName], ['z', zOf('relationship')], ['nodeFrom', letter.nodeFrom], ['nodeTo', letter.nodeTo], ['relationshipType', letter.relationshipType]],
        json: null, slug: null, cameFrom: cameFrom(x.file), role: 'relationshipLetter', concept: c.slug, file: x.file, updateElements: false, letter,
      });
      g.link(R.PROP, parent, address);
    }
  }

  // ── the manifest's existing sets: a concept's superset under its category's ──
  for (const [category, data] of Object.entries(isObject(manifest.sets) ? manifest.sets : {})) {
    const parent = categoryToSlug(category);
    for (const e of isObject(data) && Array.isArray(data['existing-sets']) ? data['existing-sets'] : []) {
      if (!isObject(e) || !slugs.has(parent) || !slugs.has(e.concept)) continue;
      g.link(R.PROP, supersetOf(parent), supersetOf(e.concept));
    }
  }

  // ── 1c¾: each concept manifest's links, its own files first, then a node of that slug or name ──
  const lookup = (x) => {
    const name = String(x).replace(/-/g, ' ');
    const n = g.nodes.find((y) => y.slug === x || y.name === name);
    return n ? n.address : null;
  };
  for (const c of concepts) {
    if (!c.links) continue;
    const own = mapOf(c.slug);
    for (const [relName, edges] of Object.entries(c.links)) {
      const type = MANIFEST_LINKS[relName] ? R[MANIFEST_LINKS[relName]] : null;
      if (!type || !Array.isArray(edges)) continue;
      for (const edge of edges) {
        if (!isObject(edge) || typeof edge.nodeFrom !== 'string' || typeof edge.nodeTo !== 'string') continue;
        g.link(type, own.get(edge.nodeFrom) || lookup(edge.nodeFrom), own.get(edge.nodeTo) || lookup(edge.nodeTo));
      }
    }
  }

  // ── 1d: each concept's superset, word's excepted, to every node whose z names the concept ──
  const headers = g.nodes.filter((n) => n.role === 'conceptHeader');
  for (const h of headers) {
    if (h.name === 'word') continue;
    const sup = supersetOf(h.concept);
    for (const n of g.nodes) if (n.address !== sup && n.tags.some((t) => t[0] === 'z' && t[1] === h.address)) g.link(R.TERM, sup, n.address);
  }

  // ── 1d½: every header an element of concept-header ──
  const conceptHeader = headers.find((h) => h.name === 'concept header');
  if (conceptHeader) for (const h of headers) g.link(R.TERM, supersetOf(conceptHeader.concept), h.address);

  // ── 1d¾: ENUMERATES, from the enumerating concept's superset to the enumerated concept's schema ──
  // As install finds them: by the header's name (the slug with spaces for the enumerating concept), else by slug.
  const headerNamed = (x) => headers.find((h) => h.name === String(x).replace(/-/g, ' ')) || headers.find((h) => h.name === x || h.concept === x) || null;
  for (const [plural, data] of Object.entries(isObject(manifest.enumerations) ? manifest.enumerations : {})) {
    const entries = isObject(data) && Array.isArray(data['existing-nodes']) ? data['existing-nodes'] : [];
    const by = headerNamed(categoryToSlug(plural));
    if (!entries.length || !by) continue;
    for (const e of entries) {
      const of = headerNamed(e.concept);
      if (!of) continue;
      const props = {};
      const sourcePath = e['source-path'] || null;
      const destinationPath = e['destination-path'] || e.path || null;
      if (sourcePath !== null) props.sourcePath = sourcePath;
      if (destinationPath !== null) props.destinationPath = destinationPath;
      g.link(ENUMERATES, supersetOf(by.concept), roles.get(of.concept).jsonSchema, props);
    }
  }

  // ── 1e: the prune, for each concept with a concept manifest, in one fixed order, by address ──
  for (const c of concepts) {
    if (!c.manifestFile) continue;
    const sup = supersetOf(c.slug);
    for (const elem of g.out(sup, [R.TERM]).sort(byText)) {
      if (reaches(adjacency(g.rels, [R.PROP, R.TERM]), sup, elem, 2, 12)) g.unlink(R.TERM, sup, elem);
    }
    for (const s of g.out(sup, [R.PROP]).sort(byText)) {
      const adj = adjacency(g.rels, [R.PROP]);
      const mids = (adj.get(sup) || []).filter((m) => m !== s);
      if (mids.some((m) => reaches(adj, m, s, 1, 10))) g.unlink(R.PROP, sup, s);
    }
  }

  // ── pass 2: each schema from its file, under 1a's word block, and the primary-property fold ──
  const H = require('../lib/brain/hygiene');
  for (const c of concepts) {
    if (!c.schemaFile || !isObject(c.schema) || !isObject(c.schema.jsonSchema)) continue;
    const at = roles.get(c.slug);
    const schema = g.byAddress.get(at.jsonSchema);
    const wrapper = isObject(schema.json) && schema.json.word && schema.json.jsonSchema !== undefined ? copy(schema.json) : null;
    if (!wrapper) continue;
    wrapper.jsonSchema = { $schema: SCHEMA_URL, type: 'object', ...copy(c.schema.jsonSchema) };
    schema.json = wrapper;
    jsonTag(schema);
    schema.cameFrom = cameFrom(c.schemaFile);
    schema.file = c.schemaFile;
    // reconcilePrimaryPropertyForConcept, against the schema just saved.
    const pp = g.byAddress.get(at.primaryProperty);
    const props = wrapper.jsonSchema.properties;
    const keys = isObject(props) ? Object.keys(props) : [];
    if (keys.length !== 1 || !isObject(props[keys[0]]) || !isObject(pp.json)) continue;
    const schemaObject = props[keys[0]];
    const current = isObject(pp.json.property) ? pp.json.property : null;
    if (H.comparePropertyRecord({ concept: c.slug, schemaObject, propertySection: current }).length === 0) continue;
    const properties = {};
    for (const [k, v] of Object.entries(isObject(schemaObject.properties) ? schemaObject.properties : {})) properties[k] = { type: v && v.type };
    pp.json = copy({ ...pp.json, property: { key: keys[0], title: (current && current.title) || schemaObject.title || keys[0], type: 'object', required: [...(schemaObject.required || [])], properties } });
    jsonTag(pp);
    pp.cameFrom = cameFrom(c.schemaFile);
    pp.file = c.schemaFile;
  }

  // ── the community references: a pointer b on the header, and its claim (REFERENCES, source b-tag) ──
  const references = [];
  for (const c of concepts) {
    const cr = isObject(c.entry.communityReference) ? c.entry.communityReference : null;
    const parts = cr && typeof cr.headerATag === 'string' ? cr.headerATag.split(':') : [];
    if (parts.length < 3 || parts[0] !== '39998') continue;
    const h = g.byAddress.get(headerOf(c.slug));
    if (h.tags.some((t) => t[0] === 'b')) continue;
    h.tags.push(['b', cr.headerATag, 'pointer']);
    g.link(REFERENCES, h.address, cr.headerATag, { source: 'b-tag' });
    if (!references.includes(cr.headerATag)) references.push(cr.headerATag);
  }

  // ── 3c: each concept's implicit elements, by name, then the prune once anything was wired ──
  let wired = 0;
  const byName = (a, b) => byText(a.name, b.name) || byText(a.address, b.address);
  for (const h of [...headers].sort(byName)) {
    const sup = supersetOf(h.concept);
    let reached = null;
    const explicit = (n) => {
      if (!reached) reached = reachedFrom(adjacency(g.rels, [R.PROP, R.TERM]), sup, 0, 12);
      for (const p of reached) if (g.has(R.TERM, p, n.address)) return true;
      return false;
    };
    for (const n of g.nodes.filter((x) => x.tags.some((t) => t[0] === 'z' && t[1] === h.address)).sort(byName)) {
      if (explicit(n)) continue;
      g.link(R.TERM, sup, n.address);
      reached = null;
      wired++;
    }
    if (!wired) continue;
    const children = reachedFrom(adjacency(g.rels, [R.PROP]), sup, 1, 10);
    for (const t of g.out(sup, [R.TERM]).sort(byText)) {
      if ([...children].some((s) => g.has(R.TERM, s, t))) g.unlink(R.TERM, sup, t);
    }
  }

  return {
    version: manifest.version,
    source: sourceOf(r.files),
    nodes: g.nodes,
    relationships: [...g.rels.values()],
    references,
    problems: [],
    // For the installer: the assistant, and the folder's relationship types.
    ta,
    aliases: { ...R },
  };
}

/** create-element's slug property: word.slug, else the first section's slug. */
function elementSlug(data) {
  if (!isObject(data)) return null;
  if (isObject(data.word) && data.word.slug) return data.word.slug;
  const k = Object.keys(data).find((x) => x !== 'word');
  return k && isObject(data[k]) && data[k].slug ? data[k].slug : null;
}

module.exports = { buildTarget, categoryToSlug, sourceOf };
