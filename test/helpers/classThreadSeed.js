'use strict';
/**
 * The class-thread graphs the link-set and unlink-set suites seed for test/helpers/graphFake.js (story
 * graph-operations-first-slice #28, ADR graph-operations-first-slice/0028), shaped as today's routes and a firmware
 * install make them (ADR Context 4–7). Named so it can't collide with the seed helper story 16 adds.
 *
 * Every node carries the shared label TapestryNode and a random tapestryKey. A graph's `keys` maps each node's name
 * below to its tapestryKey, `uuids` to its address and `names` its tapestryKey back to its name. The kinds of node:
 *   - a concept: its header 39998:<author>:<slug> (NostrEvent, ListHeader, ConceptHeader) and its superset
 *     39999:<author>:<slug>-superset (NostrEvent, ListItem, Superset), joined by IS_THE_CONCEPT_FOR, both lettered (an
 *     id), as create-concept and a firmware install sign them. The owner's concepts are the TA's, as create-concept
 *     signs them, under slugs no firmware concept has. A header is named by its slug, a superset by its own name;
 *   - a lettered set, as today's create-set signs it: NostrEvent, ListItem and Set, an id, its author's pubkey, and the
 *     tags d, name, z and s, its s naming its first parent's uuid (or `claims`, the parent its tag names);
 *   - an event-less set, as add-subset makes it: ListItem and Set, the TA's pubkey, the same would-be tags, no id;
 *   - an element: NostrEvent and ListItem, under a superset or a set by HAS_ELEMENT;
 *   - U, a NostrUser, and G, a change entry, which no write may name.
 * "A ─▶ B" below is a class-thread link, (A)-[:IS_A_SUPERSET_OF]->(B): A is one of B's parents. TA, OWNER and PEER
 * are 'dd', 'aa' and 'ee' repeated (test/helpers/graphOpsSuite.js's TA and owner).
 *
 * linkSetGraph(), for test/operations/graph/link-set.test.js:
 *   household "Households" ─▶ Indoor pets
 *   pet       "Pets"       ─▶ Indoor pets (lettered), Outdoor pets; element Goldie
 *   canine    "Canines"    ─▶ Hounds (lettered) ─▶ Beagles ─▶ Pocket beagles; elements Fido (of Canines), Rex (of
 *                            Beagles), Snoopy (of Pocket beagles)
 *   mammal    "Mammals"    ─▶ Pack animals; element Whale
 *   feline    "Felines"    ─▶ Tabbies, Kittens; element Tom
 *   vehicle   "Vehicles"   ─▶ Cars ─▶ Sedans; machine "Machines" ─▶ Movers ─▶ Vehicles (vehicles are a kind of mover)
 *   firmware, as an install leaves it after its prune (addFirmware, pruned): nostr-relay, relationship-type and
 *     property (the last a firmware concept whose folder has no manifest.json). On nostr-relay's superset (F below):
 *     F ─▶ organization-by-monetization ─▶ free-relays, paid-relays; F ─▶ organization-by-firmware ─▶ the other eight;
 *     and F ─▶ profile-relays kept, an older redundancy a reinstall would prune
 *   the owner's sets beside it: collection "Collections" ─▶ Relay notes, My relationship types, Relay folders;
 *     F ─▶ Saved relays, and Relay folders ─▶ Saved relays; organization-by-firmware ─▶ Favourite relays;
 *     F ─▶ Bookmarked relays; property's superset ─▶ Field notes ─▶ Field details
 *   toy       "Toys"       ─▶ Puzzles ─▶ Jigsaws; Toys ─▶ Blocks
 *   U, G
 *
 * unlinkSetGraph(), for test/operations/graph/unlink-set.test.js:
 *   pet       "Pets"       ─▶ Indoor pets, Outdoor pets
 *   canine    "Canines"    ─▶ Hounds ─▶ Rex (an element); Indoor pets ─▶ Hounds
 *                          ─▶ Puppies; Indoor pets ─▶ Puppies twice, as an older path could make
 *   feline    "Felines"    ─▶ Tabbies (the TA's letter names Felines; also under Indoor pets)
 *                          ─▶ Calicos (the owner's letter names Felines; also under Outdoor pets)
 *                          ─▶ Ferals (event-less, its would-be s tag names Felines; also under Outdoor pets)
 *                          ─▶ Siamese (its only parent)
 *                          ─▶ Persians (also under Indoor pets), Maine coons (also under Outdoor pets)
 *   Strays: an event-less set an old route left under no parent; its would-be s tag still names Pets
 *   mammal    "Mammals"    ─▶ Pack animals ─▶ Wolves, the wolf concept's superset, its only parent; Grey wolf (of Wolves)
 *   firmware, before its prune (addFirmware): nostr-relay, set, superset and tag, every link Decision 6's table names
 *   the owner's links: collection "Collections" ─▶ Relay taxonomies ─▶ organization-by-monetization;
 *     profile-relays ─▶ free-relays (between two firmware sets)
 *   a peer's class thread, as the pull records it: bird "Birds" (PEER's) ─▶ Songbirds (PEER's letter names Birds);
 *     and the owner's link into it: garden "Garden" ─▶ Garden visitors ─▶ Songbirds
 *   U, G
 *
 * firmwareSweepGraph(): every firmware concept, before its prune, with every link its definition makes; and collection
 *   "Collections" ─▶ Firmware bookmarks ─▶ every firmware set, so that each set has a parent besides firmware's.
 *
 * ruleGraph(), for test/operations/rules/class-thread-acyclic.test.js and set-has-a-parent.test.js:
 *   vehicle "Vehicles" ─▶ Cars ─▶ Sedans ─▶ Rex (an element); Vehicles ─▶ Trucks; machine "Machines" ─▶ Movers ─▶ Vehicles
 *   loop "Loops" ─▶ Loop A ─▶ Loop B ─▶ Loop C ─▶ Loop A (a cycle an old route made); Loop A ─▶ Off loop
 *   ladder "Ladders" ─▶ Rung 01 ─▶ Rung 02 ─▶ … ─▶ Rung 15
 *   pet "Pets" ─▶ Indoor pets, Notes; Notes ─▶ Stray note (an element an old route put under a set as a set)
 *   feline "Felines" ─▶ Tabbies (also under Indoor pets), Siamese, Hybrid; Old note (an element) ─▶ Hybrid, Ghost set
 *   Strays (under no parent); mammal "Mammals" ─▶ Pack animals ─▶ Wolves (the wolf concept's superset)
 *   the class thread anomaly (BIBLE §10, rule 9): firmware's concept-header concept, whose superset has every header
 *     here as an element, its own header among them; concept-header's superset ─▶ Header sets
 *   U
 *
 * agentGraph(), for test/operations/graph/sets-agent-through-cli.test.js: book "Books" ─▶ Novels, Classics.
 *
 * Firmware. firmwareDefinition() reads the active firmware's files (firmware/active, which is versions/v1.0.0) and lists
 * the class-thread links its definition makes, as ADR 0028 Decision 6's table gives them, with the harness's TA:
 *   (a) each set file concepts/<c>/sets/<f>.json: <c>'s superset ─▶ 39999:<TA>:<word.slug, or f>
 *   (b) each manifest.json sets.<category>['existing-sets'][].concept: the superset of categoryToSlug(category) ─▶ the
 *       concept's superset (categoryToSlug copied from src/firmware/install.js:123)
 *   (c) each concepts/<c>/manifest.json IS_A_SUPERSET_OF[{ nodeFrom, nodeTo }]: the file of each name in <c>'s sets/ or
 *       elements/, else the first such file in any firmware concept; a name that resolves to no file is left out
 *   (d) each communityReference.headerATag 39998:<pk>:<d>: <c>'s superset ─▶ 39999:<pk>:<d>-superset
 * Firmware's nodes are named fw:<c> (the header), fw:<c>/superset, fw:<c>/sets/<f>, fw:<c>/elements/<f> and
 * fw:<c>/community (the curator's superset, the curator's lettered node). addFirmware(b, { concepts, pruned }) adds the
 * concepts named (all of them by default), their set files' sets (lettered by the TA, each s tag naming the superset,
 * as create-set made them), and every link above whose two ends it added. pruned takes out what install's prune pass
 * does (src/firmware/install.js:807–833): each link from the superset of a concept whose folder has a manifest.json to a
 * direct child that is also below it through another child.
 *
 * Reading a committed state: relsBetween, parentsOf, elementsOf (what a concept's class thread reaches, from its
 * header) and entriesNaming (the change entries whose changes name a link).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { emptyState, writeState } = require('./graphFake');
const S = require('./graphOpsSuite');

const { ROOT, TA, OWNER } = S;
const PEER = 'ee'.repeat(32);
const PROP = 'IS_A_SUPERSET_OF';
const FIRMWARE = path.join(ROOT, 'firmware/active');

const hex = () => crypto.randomBytes(32).toString('hex');
const slugOf = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** A graph under construction, over graphFake's emptyState(). */
function builder() {
  const state = emptyState();
  const keys = {};
  const uuids = {};
  const names = {};
  const nodes = {};
  const headers = [];

  function node(name, labels, props) {
    if (nodes[name]) throw new Error(`classThreadSeed: two nodes are named ${name}`);
    const n = { eid: state.nextEid++, labels: [...labels, 'TapestryNode'], props: { ...props, tapestryKey: crypto.randomUUID() } };
    state.nodes.push(n);
    nodes[name] = n;
    keys[name] = n.props.tapestryKey;
    names[n.props.tapestryKey] = name;
    if (props.uuid) uuids[name] = props.uuid;
    return n;
  }
  function rel(type, from, to) {
    for (const x of [from, to]) if (!nodes[x]) throw new Error(`classThreadSeed: no node is named ${x}`);
    state.rels.push({ eid: state.nextEid++, type, from: nodes[from].eid, to: nodes[to].eid, props: {} });
  }
  /** Tag nodes, as importEventDirect and add-subset make them: (owner)-[:HAS_TAG]->(:NostrEventTag { type, value }). */
  function tags(name, list) {
    const owner = nodes[name];
    list.forEach(([type, value], i) => {
      const uuid = crypto.createHash('sha256').update(`${owner.props.uuid}:${type},${value}:${i}`).digest('hex');
      const t = { eid: state.nextEid++, labels: ['NostrEventTag', 'TapestryNode'], props: { uuid, type, value, tapestryKey: crypto.randomUUID() } };
      state.nodes.push(t);
      state.rels.push({ eid: state.nextEid++, type: 'HAS_TAG', from: owner.eid, to: t.eid, props: {} });
    });
  }
  /** A concept: its header (named `header`, its slug by default) and its superset (named `superset`). */
  function concept(slug, { superset, header = slug, author = TA, headerName = slug, supersetName = superset } = {}) {
    node(header, ['NostrEvent', 'ListHeader', 'ConceptHeader'], { uuid: `39998:${author}:${slug}`, name: headerName, pubkey: author, kind: 39998, id: hex() });
    node(superset, ['NostrEvent', 'ListItem', 'Superset'], { uuid: `39999:${author}:${slug}-superset`, name: supersetName, pubkey: author, kind: 39999, id: hex() });
    rel('IS_THE_CONCEPT_FOR', header, superset);
    headers.push(header);
  }
  /** A set under each of `under`: lettered (create-set's) or event-less (add-subset's); its s tag names `claims`. */
  function set(name, { under = [], author = TA, letter = false, claims = under[0] || null, uuid = null, displayName = name } = {}) {
    const address = uuid || `39999:${author}:${slugOf(name)}`;
    const props = { uuid: address, name: displayName, pubkey: author, kind: 39999 };
    if (letter) props.id = hex();
    node(name, letter ? ['NostrEvent', 'ListItem', 'Set'] : ['ListItem', 'Set'], props);
    const t = [['d', address.split(':').slice(2).join(':')], ['name', displayName], ['z', `39998:${TA}:set`]];
    if (claims) t.push(['s', nodes[claims].props.uuid]);
    tags(name, t);
    for (const p of under) rel(PROP, p, name);
  }
  function element(name, { under = [], author = TA, uuid = null } = {}) {
    node(name, ['NostrEvent', 'ListItem'], { uuid: uuid || `39999:${author}:${slugOf(name)}`, name, pubkey: author, kind: 39999, id: hex() });
    for (const p of under) rel('HAS_ELEMENT', p, name);
  }
  /** `times` class-thread links from `parent` to `child`. */
  function link(parent, child, times = 1) { for (let i = 0; i < times; i++) rel(PROP, parent, child); }
  function unlink(parent, child) {
    state.rels = state.rels.filter((r) => !(r.type === PROP && r.from === nodes[parent].eid && r.to === nodes[child].eid));
  }
  function user(name, pubkey) { node(name, ['NostrUser'], { pubkey }); }
  function entry(name) {
    node(name, ['GraphChange'], { at: '2026-01-01T00:00:00.000Z', byRole: 'owner', byPubkey: OWNER, operation: 'graph add-relationship', keys: [], changes: '[]' });
  }

  return {
    state, keys, uuids, names, nodes, headers,
    node, rel, tags, concept, set, element, link, unlink, user, entry,
    has: (name) => !!nodes[name],
    /** Write the state to <dir>/graph.json and return its path. */
    file(dir) { const f = path.join(dir, 'graph.json'); writeState(f, state); return f; },
  };
}

// ── firmware ──
const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** src/firmware/install.js:123's categoryToSlug, copied: two overrides for irregular plurals, then a final s stripped. */
function categoryToSlug(category) {
  const overrides = { properties: 'property', sets: 'set' };
  if (overrides[category]) return overrides[category];
  return category.replace(/s$/, '');
}

let DEFINITION = null;
/**
 * Firmware's class-thread links, read from the active firmware's files, as ADR 0028 Decision 6's table gives them.
 * @returns {{ concepts: object[], bySlug: object, links: { part, concept, parent, set, file?, category?, resolves? }[] }}
 *   each link's parent and set are node names (fw:…); `file` names the file that makes an (a) or (c) link.
 */
function firmwareDefinition() {
  if (DEFINITION) return DEFINITION;
  const manifest = readJson(path.join(FIRMWARE, 'manifest.json'));
  const concepts = manifest.concepts.map((entry) => {
    const dir = path.join(FIRMWARE, entry.dir);
    const header = readJson(path.join(dir, entry.conceptHeader));
    const oNames = (header.conceptHeader && header.conceptHeader.oNames) || {};
    const filesIn = (sub) => (fs.existsSync(path.join(dir, sub)) ? fs.readdirSync(path.join(dir, sub)).filter((f) => f.endsWith('.json')).sort() : []);
    const fileOf = (sub, f) => {
      const data = readJson(path.join(dir, sub, f));
      const file = f.replace(/\.json$/, '');
      const word = data.word || {};
      return { file, slug: word.slug || file, name: (data.set && data.set.name) || word.name || file };
    };
    const hasManifest = fs.existsSync(path.join(dir, 'manifest.json'));
    return {
      slug: entry.slug,
      singular: oNames.singular || entry.slug,
      plural: oNames.plural || `${entry.slug}s`,
      sets: filesIn('sets').map((f) => fileOf('sets', f)),
      elements: filesIn('elements').map((f) => fileOf('elements', f)),
      hasManifest,
      edges: hasManifest ? (readJson(path.join(dir, 'manifest.json'))[PROP] || []) : [],
      communityReference: entry.communityReference || null,
    };
  });
  const bySlug = Object.fromEntries(concepts.map((c) => [c.slug, c]));
  const links = [];
  // (a) each set file
  for (const c of concepts) {
    for (const s of c.sets) links.push({ part: 'a', concept: c.slug, file: `${s.file}.json`, parent: `fw:${c.slug}/superset`, set: `fw:${c.slug}/sets/${s.file}` });
  }
  // (b) existing-sets
  for (const [category, data] of Object.entries(manifest.sets || {})) {
    const parentConcept = categoryToSlug(category);
    for (const e of (data && data['existing-sets']) || []) {
      links.push({
        part: 'b', concept: e.concept, category, parentConcept,
        resolves: !!bySlug[parentConcept] && !!bySlug[e.concept],
        parent: `fw:${parentConcept}/superset`, set: `fw:${e.concept}/superset`,
      });
    }
  }
  // (c) concept manifests' IS_A_SUPERSET_OF
  const resolve = (c, name) => {
    for (const [sub, list] of [['sets', c.sets], ['elements', c.elements]]) if (list.some((x) => x.file === name)) return `fw:${c.slug}/${sub}/${name}`;
    for (const other of concepts) {
      for (const [sub, list] of [['sets', other.sets], ['elements', other.elements]]) if (list.some((x) => x.file === name)) return `fw:${other.slug}/${sub}/${name}`;
    }
    return null;
  };
  for (const c of concepts) {
    for (const edge of c.edges) {
      const from = resolve(c, edge.nodeFrom);
      const to = resolve(c, edge.nodeTo);
      if (from && to) links.push({ part: 'c', concept: c.slug, file: `${c.slug}/manifest.json`, edge, parent: from, set: to });
    }
  }
  // (d) community references
  for (const c of concepts) {
    const tag = c.communityReference && c.communityReference.headerATag;
    const m = typeof tag === 'string' ? tag.match(/^39998:([0-9a-f]{64}):(.+)$/) : null;
    if (m) links.push({ part: 'd', concept: c.slug, curator: m[1], dTag: m[2], parent: `fw:${c.slug}/superset`, set: `fw:${c.slug}/community` });
  }
  DEFINITION = { concepts, bySlug, links };
  return DEFINITION;
}

/** Firmware's concepts and class-thread links, as an install makes them (pruned: and as its prune pass leaves them). */
function addFirmware(b, { concepts = null, pruned = false } = {}) {
  const def = firmwareDefinition();
  const include = new Set(concepts || def.concepts.map((c) => c.slug));
  for (const slug of include) if (!def.bySlug[slug]) throw new Error(`classThreadSeed: ${slug} is not a firmware concept`);
  for (const c of def.concepts.filter((x) => include.has(x.slug))) {
    b.concept(c.slug, { header: `fw:${c.slug}`, superset: `fw:${c.slug}/superset`, headerName: c.singular, supersetName: `the superset of all ${c.plural}` });
    for (const s of c.sets) {
      b.set(`fw:${c.slug}/sets/${s.file}`, { uuid: `39999:${TA}:${s.slug}`, displayName: s.name, letter: true, claims: `fw:${c.slug}/superset` });
    }
  }
  // The elements an included concept's manifest edges name.
  for (const l of def.links.filter((x) => x.part === 'c' && include.has(x.concept))) {
    for (const end of [l.parent, l.set]) {
      const m = end.match(/^fw:([^/]+)\/elements\/(.+)$/);
      if (m && !b.has(end) && def.bySlug[m[1]]) {
        const e = def.bySlug[m[1]].elements.find((x) => x.file === m[2]);
        b.element(end, { uuid: `39999:${TA}:${e.slug}` });
      }
    }
  }
  const present = (l) => b.has(l.parent) && b.has(l.set);
  for (const l of def.links.filter((x) => x.part !== 'd' && present(x))) b.link(l.parent, l.set);
  if (pruned) {
    for (const c of def.concepts.filter((x) => include.has(x.slug) && x.hasManifest)) {
      const F = `fw:${c.slug}/superset`;
      for (const child of childrenOf(b, F)) if (reachesThroughAnother(b, F, child)) b.unlink(F, child);
    }
  }
  // (d), after the prune, as install wires it.
  for (const l of def.links.filter((x) => x.part === 'd' && include.has(x.concept))) {
    const c = def.bySlug[l.concept];
    b.node(l.set, ['NostrEvent', 'ListItem', 'Superset'], { uuid: `39999:${l.curator}:${l.dTag}-superset`, name: `the community superset of ${c.plural}`, pubkey: l.curator, kind: 39999, id: hex() });
    b.link(l.parent, l.set);
  }
  return def;
}

/** The names of `parent`'s direct children by class-thread link, in a builder. */
function childrenOf(b, parent) {
  const eid = b.nodes[parent].eid;
  const byEid = new Map(b.state.nodes.map((n) => [n.eid, n]));
  return [...new Set(b.state.rels.filter((r) => r.type === PROP && r.from === eid).map((r) => b.names[byEid.get(r.to).props.tapestryKey]))];
}
/** Whether `top` is above `child` through a parent other than the link top ─▶ child itself. */
function reachesThroughAnother(b, top, child) {
  const topEid = b.nodes[top].eid;
  const childEid = b.nodes[child].eid;
  const ups = (eid) => b.state.rels.filter((r) => r.type === PROP && r.to === eid && !(r.from === topEid && r.to === childEid)).map((r) => r.from);
  const seen = new Set();
  const queue = ups(childEid);
  while (queue.length) {
    const x = queue.shift();
    if (x === topEid) return true;
    if (seen.has(x)) continue;
    seen.add(x);
    queue.push(...ups(x));
  }
  return false;
}

// ── the suites' graphs ──
function linkSetGraph() {
  const b = builder();
  b.concept('household', { superset: 'Households' });
  b.concept('pet', { superset: 'Pets' });
  b.set('Indoor pets', { under: ['Pets', 'Households'], letter: true });
  b.set('Outdoor pets', { under: ['Pets'] });
  b.element('Goldie', { under: ['Pets'] });
  b.concept('canine', { superset: 'Canines' });
  b.set('Hounds', { under: ['Canines'], letter: true });
  b.set('Beagles', { under: ['Hounds'] });
  b.set('Pocket beagles', { under: ['Beagles'] });
  b.element('Fido', { under: ['Canines'] });
  b.element('Rex', { under: ['Beagles'] });
  b.element('Snoopy', { under: ['Pocket beagles'] });
  b.concept('mammal', { superset: 'Mammals' });
  b.set('Pack animals', { under: ['Mammals'] });
  b.element('Whale', { under: ['Mammals'] });
  b.concept('feline', { superset: 'Felines' });
  b.set('Tabbies', { under: ['Felines'] });
  b.set('Kittens', { under: ['Felines'] });
  b.element('Tom', { under: ['Felines'] });
  b.concept('vehicle', { superset: 'Vehicles' });
  b.set('Cars', { under: ['Vehicles'] });
  b.set('Sedans', { under: ['Cars'] });
  b.concept('machine', { superset: 'Machines' });
  b.set('Movers', { under: ['Machines'] });
  b.link('Movers', 'Vehicles');
  addFirmware(b, { concepts: ['nostr-relay', 'relationship-type', 'property'], pruned: true });
  const F = 'fw:nostr-relay/superset';
  b.link(F, 'fw:nostr-relay/sets/profile-relays');
  b.concept('collection', { superset: 'Collections' });
  b.set('Relay notes', { under: ['Collections'] });
  b.set('My relationship types', { under: ['Collections'] });
  b.set('Relay folders', { under: ['Collections'] });
  b.set('Saved relays', { under: [F, 'Relay folders'] });
  b.set('Favourite relays', { under: ['fw:nostr-relay/sets/organization-by-firmware'] });
  b.set('Bookmarked relays', { under: [F] });
  b.set('Field notes', { under: ['fw:property/superset'] });
  b.set('Field details', { under: ['Field notes'] });
  b.concept('toy', { superset: 'Toys' });
  b.set('Puzzles', { under: ['Toys'] });
  b.set('Jigsaws', { under: ['Puzzles'] });
  b.set('Blocks', { under: ['Toys'] });
  b.user('U', PEER);
  b.entry('G');
  return b;
}

function unlinkSetGraph() {
  const b = builder();
  b.concept('pet', { superset: 'Pets' });
  b.set('Indoor pets', { under: ['Pets'] });
  b.set('Outdoor pets', { under: ['Pets'] });
  b.concept('canine', { superset: 'Canines' });
  b.set('Hounds', { under: ['Canines', 'Indoor pets'] });
  b.element('Rex', { under: ['Hounds'] });
  b.set('Puppies', { under: ['Canines'] });
  b.link('Indoor pets', 'Puppies', 2);
  b.concept('feline', { superset: 'Felines' });
  b.set('Tabbies', { under: ['Felines', 'Indoor pets'], letter: true });
  b.set('Calicos', { under: ['Felines', 'Outdoor pets'], letter: true, author: OWNER });
  b.set('Ferals', { under: ['Felines', 'Outdoor pets'] });
  b.set('Siamese', { under: ['Felines'] });
  b.set('Persians', { under: ['Felines', 'Indoor pets'] });
  b.set('Maine coons', { under: ['Felines', 'Outdoor pets'] });
  b.set('Strays', { under: [], claims: 'Pets' });
  b.concept('mammal', { superset: 'Mammals' });
  b.set('Pack animals', { under: ['Mammals'] });
  b.concept('wolf', { superset: 'Wolves' });
  b.link('Pack animals', 'Wolves');
  b.element('Grey wolf', { under: ['Wolves'] });
  addFirmware(b, { concepts: ['nostr-relay', 'set', 'superset', 'tag'] });
  b.concept('collection', { superset: 'Collections' });
  b.set('Relay taxonomies', { under: ['Collections'] });
  b.link('Relay taxonomies', 'fw:nostr-relay/sets/organization-by-monetization');
  b.link('fw:nostr-relay/sets/profile-relays', 'fw:nostr-relay/sets/free-relays');
  b.concept('bird', { superset: 'Birds', author: PEER });
  b.set('Songbirds', { under: ['Birds'], author: PEER, letter: true });
  b.concept('garden', { superset: 'Garden' });
  b.set('Garden visitors', { under: ['Garden'] });
  b.link('Garden visitors', 'Songbirds');
  b.user('U', PEER);
  b.entry('G');
  return b;
}

function firmwareSweepGraph() {
  const b = builder();
  const def = addFirmware(b);
  b.concept('collection', { superset: 'Collections' });
  b.set('Firmware bookmarks', { under: ['Collections'] });
  for (const c of def.concepts) for (const s of c.sets) b.link('Firmware bookmarks', `fw:${c.slug}/sets/${s.file}`);
  return Object.assign(b, { links: def.links });
}

function ruleGraph() {
  const b = builder();
  b.concept('vehicle', { superset: 'Vehicles' });
  b.set('Cars', { under: ['Vehicles'] });
  b.set('Sedans', { under: ['Cars'] });
  b.set('Trucks', { under: ['Vehicles'] });
  b.element('Rex', { under: ['Sedans'] });
  b.concept('machine', { superset: 'Machines' });
  b.set('Movers', { under: ['Machines'] });
  b.link('Movers', 'Vehicles');
  b.concept('loop', { superset: 'Loops' });
  b.set('Loop A', { under: ['Loops'] });
  b.set('Loop B', { under: ['Loop A'] });
  b.set('Loop C', { under: ['Loop B'] });
  b.link('Loop C', 'Loop A');
  b.set('Off loop', { under: ['Loop A'] });
  b.concept('ladder', { superset: 'Ladders' });
  let above = 'Ladders';
  for (let i = 1; i <= 15; i++) {
    const rung = `Rung ${String(i).padStart(2, '0')}`;
    b.set(rung, { under: [above] });
    above = rung;
  }
  b.concept('pet', { superset: 'Pets' });
  b.set('Indoor pets', { under: ['Pets'] });
  b.set('Notes', { under: ['Pets'] });
  b.element('Stray note');
  b.link('Notes', 'Stray note');
  b.concept('feline', { superset: 'Felines' });
  b.set('Tabbies', { under: ['Felines', 'Indoor pets'] });
  b.set('Siamese', { under: ['Felines'] });
  b.element('Old note');
  b.set('Hybrid', { under: ['Felines', 'Old note'] });
  b.set('Ghost set', { under: ['Old note'] });
  b.set('Strays', { under: [], claims: 'Felines' });
  b.concept('mammal', { superset: 'Mammals' });
  b.set('Pack animals', { under: ['Mammals'] });
  b.concept('wolf', { superset: 'Wolves' });
  b.link('Pack animals', 'Wolves');
  b.concept('concept-header', { header: 'fw:concept-header', superset: 'fw:concept-header/superset', supersetName: 'the superset of all concept headers' });
  b.set('Header sets', { under: ['fw:concept-header/superset'] });
  for (const h of b.headers) b.rel('HAS_ELEMENT', 'fw:concept-header/superset', h);
  b.user('U', PEER);
  return b;
}

function agentGraph() {
  const b = builder();
  b.concept('book', { superset: 'Books' });
  b.set('Novels', { under: ['Books'] });
  b.set('Classics', { under: ['Books'] });
  return b;
}

// ── reading a committed state ──
function indexOf(state) {
  return { byKey: new Map(state.nodes.map((n) => [n.props.tapestryKey, n])), byEid: new Map(state.nodes.map((n) => [n.eid, n])) };
}
/** How many relationships of `type` run from the node keyed `from` to the node keyed `to`. */
function relsBetween(state, from, to, type = PROP) {
  const { byKey } = indexOf(state);
  const a = byKey.get(from);
  const b = byKey.get(to);
  if (!a || !b) return 0;
  return state.rels.filter((r) => r.type === type && r.from === a.eid && r.to === b.eid).length;
}
/** The tapestryKeys of the nodes with a class-thread link to the node keyed `key`. */
function parentsOf(state, key) {
  const { byKey, byEid } = indexOf(state);
  const n = byKey.get(key);
  if (!n) return [];
  return state.rels.filter((r) => r.type === PROP && r.to === n.eid).map((r) => byEid.get(r.from).props.tapestryKey);
}
/** What a concept's class thread reaches: from its header, IS_THE_CONCEPT_FOR, IS_A_SUPERSET_OF*0.., HAS_ELEMENT. */
function elementsOf(state, headerKey) {
  const { byKey, byEid } = indexOf(state);
  const header = byKey.get(headerKey);
  if (!header) return [];
  const out = (eid, type) => state.rels.filter((r) => r.from === eid && r.type === type).map((r) => r.to);
  const start = out(header.eid, 'IS_THE_CONCEPT_FOR').filter((eid) => byEid.get(eid).labels.includes('Superset'));
  const seen = new Set(start);
  const queue = [...start];
  while (queue.length) { const x = queue.shift(); for (const y of out(x, PROP)) if (!seen.has(y)) { seen.add(y); queue.push(y); } }
  const elements = new Set();
  for (const x of seen) for (const y of out(x, 'HAS_ELEMENT')) elements.add(byEid.get(y).props.tapestryKey);
  return [...elements];
}
/** The change entries whose changes name the link from the node keyed `from` to the node keyed `to`. */
function entriesNaming(state, from, to) {
  return S.entriesOf(state).filter((e) => Array.isArray(e.changes) && e.changes.some((c) => c && c.from === from && c.to === to));
}

module.exports = {
  TA, OWNER, PEER, PROP, FIRMWARE,
  builder, categoryToSlug, firmwareDefinition, addFirmware,
  linkSetGraph, unlinkSetGraph, firmwareSweepGraph, ruleGraph, agentGraph,
  relsBetween, parentsOf, elementsOf, entriesNaming,
};
