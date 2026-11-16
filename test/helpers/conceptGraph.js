'use strict';
/**
 * A graph for story graph-operations-first-slice #16's suites (graph create-concept and update-concept, ADR
 * graph-operations-first-slice/0016), seeded for test/helpers/graphFake.js. The assistant is graphOpsSuite's TA.
 *
 * seedConcepts(opts) → Promise<{ state, keys, file(dir) }>. The graph holds:
 *   - firmware: the twelve concepts a new concept's nodes join (FIRMWARE: concept-header, superset, set, word,
 *     json-schema, primary-property, property, properties-set, property-tree-graph, graph, concept-graph,
 *     core-nodes-graph), each a lettered header at 39998:<TA>:<slug> with its superset at 39999:<TA>:<slug>-superset.
 *     opts.without leaves out the named ones (not-installed).
 *   - lettered concepts, each exactly what today's create-concept makes for its names (test/helpers/todaysCreateConcept.js
 *     runs the route), imported with an id, as the route's import leaves them:
 *       beagle/beagles (this instance's own; not dog, which is a firmware concept), with an element, rover, and its
 *       superset's description edited by hand;
 *       cat/cats, own, whose slug set-slug changed to feline (its key is still cat);
 *       bird/birds, own, made as avian/avians and renamed since (its slug and key are avian);
 *       mouse/mice, own; tapestry owner goal/tapestry owner goals, own and name-keyed;
 *       nostr relay/nostr relays, another author's (OTHER); recipe/recipes, the owner's own key's.
 *   - twelve headers named widget, each by another author, header only (more near matches than the cap);
 *   - a node that isn't a concept at 39998:<TA>:held, and 100 at 39998:<TA>:crowded and crowded~1 to crowded~99.
 * keys names each header's tapestryKey (beagle, cat, bird, mouse, goal, relay, recipe, word, conceptHeader, …),
 * beagleNodes the beagle's eight by role, rover, and supersets (each firmware concept's superset by slug).
 *
 * Readers over a state: node(state, key), byUuid(state, uuid), tags(state, key) in the order made, json(state, key),
 * out(state, key, type) and into(state, key, type) (the tapestryKeys at the other end), and nodesAt(state, prefix).
 */

const crypto = require('crypto');
const path = require('path');
const { emptyState, writeState } = require('./graphFake');
const { TA, OWNER } = require('./graphOpsSuite');
const { todaysConcept, names } = require('./todaysCreateConcept');

const OTHER = 'ee'.repeat(32);
const FIRMWARE = Object.freeze([
  ['concept-header', 'concept header', 'concept headers'],
  ['superset', 'superset', 'supersets'],
  ['set', 'set', 'sets'],
  ['word', 'word', 'words'],
  ['json-schema', 'json schema', 'json schemas'],
  ['primary-property', 'primary property', 'primary properties'],
  ['property', 'property', 'properties'],
  ['properties-set', 'properties set', 'properties sets'],
  ['property-tree-graph', 'property tree graph', 'property tree graphs'],
  ['graph', 'graph', 'graphs'],
  ['concept-graph', 'concept graph', 'concept graphs'],
  ['core-nodes-graph', 'core nodes graph', 'core nodes graphs'],
]);
const ROLES = Object.freeze(['conceptHeader', 'superset', 'jsonSchema', 'primaryProperty', 'properties', 'propertyTreeGraph', 'conceptGraph', 'coreNodesGraph']);
const SUFFIX_ROLE = Object.freeze({ superset: 'superset', schema: 'jsonSchema', 'primary-property': 'primaryProperty', properties: 'properties', 'property-tree-graph': 'propertyTreeGraph', 'concept-graph': 'conceptGraph', 'core-nodes-graph': 'coreNodesGraph' });

const key = () => crypto.randomUUID();
const hex = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
/** The import's tag-node uuid: sha256("<uuid>:<tag.join(',')>:<index>") (importEventDirect). */
const tagUuid = (uuid, tag, i) => hex(`${uuid}:${tag.join(',')}:${i}`);

/** The role a core node's address names, from its d-tag's suffix after the concept's d. */
function roleOf(uuid, d) {
  if (uuid.startsWith('39998:')) return 'conceptHeader';
  const tail = uuid.split(':').slice(2).join(':').slice(d.length + 1);
  return SUFFIX_ROLE[tail] || null;
}

function builder() {
  const s = emptyState();
  const add = (labels, props) => { const n = { eid: s.nextEid++, labels: [...labels], props: { ...props } }; s.nodes.push(n); return n; };
  const link = (a, type, b) => { s.rels.push({ eid: s.nextEid++, type, from: a.eid, to: b.eid, props: {} }); };
  const byUuid = (uuid) => s.nodes.find((n) => n.props.uuid === uuid) || null;
  const tag = (node, t, i) => {
    const props = { uuid: tagUuid(node.props.uuid, t, i), type: t[0], value: t[1] === undefined ? '' : t[1], tapestryKey: key() };
    if (t[2]) props.value1 = t[2];
    if (t[3]) props.value2 = t[3];
    link(node, 'HAS_TAG', add(['NostrEventTag', 'TapestryNode'], props));
  };
  return { s, add, link, byUuid, tag };
}

/** One lettered node, as the import leaves an event: NostrEvent, ListHeader or ListItem, its props and tag nodes. */
function lettered(b, { uuid, kind, tags, roleLabels = [], author }) {
  const nameTag = tags.find((t) => t[0] === 'name') || tags.find((t) => t[0] === 'names') || [];
  const labels = ['NostrEvent', kind === 39998 ? 'ListHeader' : 'ListItem', ...roleLabels.filter((l) => l !== 'ListHeader'), 'TapestryNode'];
  const n = b.add([...new Set(labels)], { uuid, kind, pubkey: author, name: nameTag[1] || '', created_at: 1763000000, id: hex(`event ${uuid}`), tapestryKey: key() });
  tags.forEach((t, i) => b.tag(n, t, i));
  return n;
}

/**
 * A concept as today's create-concept makes it, imported as lettered nodes, wired as the route wires it and, for this
 * instance's assistant, made elements of the firmware supersets the route names. `edit(json, role)` may change a
 * node's JSON first, as a hand edit would. → { header, nodes: { [role]: node } }
 */
async function concept(b, { name, plural, description, author = TA, edit = null, headerOnly = false }) {
  const made = await todaysConcept({ name, plural, description, ta: author });
  const d = made.events[0].uuid.split(':').slice(2).join(':');
  const nodes = {};
  for (const e of headerOnly ? made.events.slice(0, 1) : made.events) {
    const role = roleOf(e.uuid, d);
    const tags = e.tags.map((t) => {
      if (t[0] !== 'json' || !edit) return t;
      const json = JSON.parse(t[1]);
      edit(json, role);
      return ['json', JSON.stringify(json), ...t.slice(2)];
    });
    nodes[role] = lettered(b, { uuid: e.uuid, kind: e.kind, tags, roleLabels: made.labels[e.uuid] || [], author });
  }
  if (!headerOnly) {
    for (const w of made.wiring) b.link(b.byUuid(w.from), w.type, b.byUuid(w.to));
    for (const m of made.memberships) { const sup = b.byUuid(m.superset); if (sup) b.link(sup, 'HAS_ELEMENT', b.byUuid(m.node)); }
  }
  return { header: nodes.conceptHeader, nodes };
}

/** Set one of a node's tag values in the state, as a route that re-signed it would. */
function setTag(b, node, type, value, value1) {
  const t = b.s.rels.filter((r) => r.from === node.eid && r.type === 'HAS_TAG').map((r) => b.s.nodes.find((n) => n.eid === r.to)).find((x) => x.props.type === type);
  t.props.value = value;
  if (value1 !== undefined) t.props.value1 = value1;
}

async function seedConcepts({ without = [] } = {}) {
  const b = builder();
  const keys = { supersets: {} };
  for (const [slug, singular, pluralName] of FIRMWARE) {
    if (without.includes(slug)) continue;
    const n = names(singular, pluralName);
    const json = { word: { slug: `concept-header-for-the-concept-of-${n.oSlugs.plural}`, name: `concept header for the concept of ${n.oNames.plural}`, title: `Concept Header for the Concept of ${n.oTitles.plural}`, wordTypes: ['word', 'conceptHeader'] }, conceptHeader: { description: `${n.oTitles.singular} is a firmware concept.`, ...n } };
    const header = lettered(b, { uuid: `39998:${TA}:${slug}`, kind: 39998, tags: [['d', slug], ['names', n.oNames.singular, n.oNames.plural], ['slug', slug], ['json', JSON.stringify(json)]], roleLabels: ['ConceptHeader'], author: TA });
    const superset = lettered(b, { uuid: `39999:${TA}:${slug}-superset`, kind: 39999, tags: [['d', `${slug}-superset`], ['name', `superset for the concept of ${n.oNames.plural}`]], roleLabels: ['Superset'], author: TA });
    b.link(header, 'IS_THE_CONCEPT_FOR', superset);
    keys.supersets[slug] = superset.props.tapestryKey;
    if (slug === 'word') keys.word = header.props.tapestryKey;
    if (slug === 'concept-header') keys.conceptHeader = header.props.tapestryKey;
  }
  // Firmware wires its own headers as elements of the concept-header concept (install.js, pass 1d½).
  const chSup = b.byUuid(`39999:${TA}:concept-header-superset`);
  if (chSup) for (const n of b.s.nodes.filter((x) => x.labels.includes('ConceptHeader'))) b.link(chSup, 'HAS_ELEMENT', n);

  const beagle = await concept(b, { name: 'beagle', plural: 'beagles', edit: (json, role) => { if (role === 'superset') json.superset.description = 'All the beagles we know of.'; } });
  keys.beagle = beagle.header.props.tapestryKey;
  keys.beagleNodes = Object.fromEntries(ROLES.map((r) => [r, beagle.nodes[r].props.tapestryKey]));
  const rover = lettered(b, { uuid: `39999:${TA}:rover`, kind: 39999, tags: [['d', 'rover'], ['name', 'Rover'], ['z', `39998:${TA}:beagle`], ['json', JSON.stringify({ word: { slug: 'rover', name: 'Rover', wordTypes: ['word', 'beagle'] }, beagle: { name: 'Rover', slug: 'rover', description: 'a good beagle' } })]], author: TA });
  b.link(beagle.nodes.superset, 'HAS_ELEMENT', rover);
  keys.rover = rover.props.tapestryKey;

  const cat = await concept(b, { name: 'cat', plural: 'cats' });
  setTag(b, cat.header, 'slug', 'feline');
  keys.cat = cat.header.props.tapestryKey;

  const bird = await concept(b, { name: 'avian', plural: 'avians' });
  setTag(b, bird.header, 'names', 'bird', 'birds');
  bird.header.props.name = 'bird';
  keys.bird = bird.header.props.tapestryKey;

  keys.mouse = (await concept(b, { name: 'mouse', plural: 'mice' })).header.props.tapestryKey;
  keys.goal = (await concept(b, { name: 'tapestry owner goal', plural: 'tapestry owner goals' })).header.props.tapestryKey;
  keys.relay = (await concept(b, { name: 'nostr relay', plural: 'nostr relays', author: OTHER })).header.props.tapestryKey;
  keys.recipe = (await concept(b, { name: 'recipe', plural: 'recipes', author: OWNER })).header.props.tapestryKey;
  keys.widgets = [];
  for (let i = 0; i < 12; i++) {
    const author = (i.toString(16).padStart(2, '0') + 'f').repeat(22).slice(0, 64);
    keys.widgets.push((await concept(b, { name: 'widget', plural: 'widgets', author, headerOnly: true })).header.props.tapestryKey);
  }

  b.add(['NostrEvent', 'ListItem', 'TapestryNode'], { uuid: `39998:${TA}:held`, name: 'not a concept', id: hex('held'), tapestryKey: key() });
  for (let i = 0; i < 100; i++) b.add(['ListItem', 'TapestryNode'], { uuid: `39998:${TA}:crowded${i ? `~${i}` : ''}`, name: `crowd ${i}`, tapestryKey: key() });

  return {
    state: b.s,
    keys,
    /** Write the state to <dir>/graph.json and return its path. */
    file(dir) { const f = path.join(dir, 'graph.json'); writeState(f, b.s); return f; },
  };
}

// ── reading a state ──
const node = (s, k) => s.nodes.find((n) => n.props.tapestryKey === k) || null;
const byUuid = (s, uuid) => s.nodes.find((n) => n.props.uuid === uuid) || null;
const eidOf = (s, k) => { const n = node(s, k); return n ? n.eid : null; };
const keyOfEid = (s, eid) => { const n = s.nodes.find((x) => x.eid === eid); return n ? n.props.tapestryKey : null; };
/** A node's tags in the order they were made: [{ type, value, value1, value2, uuid, key }]. */
function tags(s, k) {
  const eid = eidOf(s, k);
  return s.rels.filter((r) => r.from === eid && r.type === 'HAS_TAG').map((r) => s.nodes.find((n) => n.eid === r.to)).filter(Boolean)
    .map((t) => ({ type: t.props.type, value: t.props.value, value1: t.props.value1, value2: t.props.value2, uuid: t.props.uuid, key: t.props.tapestryKey }));
}
/** A node's tags as an event holds them: [type, value, value1?, value2?]. */
const tagArrays = (s, k) => tags(s, k).map((t) => [t.type, t.value, ...(t.value1 ? [t.value1] : []), ...(t.value2 ? [t.value2] : [])]);
function json(s, k) {
  const t = tags(s, k).find((x) => x.type === 'json');
  return t ? JSON.parse(t.value) : null;
}
const out = (s, k, type) => { const eid = eidOf(s, k); return s.rels.filter((r) => r.from === eid && r.type === type).map((r) => keyOfEid(s, r.to)); };
const into = (s, k, type) => { const eid = eidOf(s, k); return s.rels.filter((r) => r.to === eid && r.type === type).map((r) => keyOfEid(s, r.from)); };
const nodesAt = (s, prefix) => s.nodes.filter((n) => typeof n.props.uuid === 'string' && n.props.uuid.startsWith(prefix));
/** Everything about a set of nodes that a reinstall or a restore must leave as it was, for comparing two states. */
function facts(s, keys) {
  const pick = (n) => { const { tapestryJsonUpdatedAt, ...rest } = n.props; void tapestryJsonUpdatedAt; return { labels: [...n.labels].sort(), props: rest }; };
  return keys.map((k) => ({ node: pick(node(s, k)), tags: tagArrays(s, k), out: s.rels.filter((r) => r.from === eidOf(s, k) && r.type !== 'HAS_TAG').map((r) => `${r.type}>${keyOfEid(s, r.to)}`).sort(), into: s.rels.filter((r) => r.to === eidOf(s, k)).map((r) => `${r.type}<${keyOfEid(s, r.from)}`).sort() }));
}

module.exports = { TA, OTHER, OWNER, FIRMWARE, ROLES, tagUuid, seedConcepts, node, byUuid, tags, tagArrays, json, out, into, nodesAt, facts };
