'use strict';
/**
 * The graph story graph-operations-first-slice #47's suites seed for test/helpers/graphFake.js: the rule
 * word-types-hold-concept-keys, and rules check and rules repair running it (ADR graph-operations-first-slice/0047).
 *
 * seedWordTypes(label) builds it from an empty graph, by hand, so what the rule judges is exactly what is written here
 * and nothing a writer makes. Every node is the assistant's (TA) unless said; "─▶" is a class-thread link, A one of
 * B's parents; "∈ X" is a HAS_ELEMENT from concept X's superset (or from the set named).
 *
 *   concepts, each a header at 39998:<TA>:<slug> (a json tag holding its conceptHeader, oKeys.singular its key) and its
 *   superset, IS_THE_CONCEPT_FOR between them:
 *     word (word) and graph context (graphContext), the reserved keys; json schema (jsonSchema); validation tool
 *     (validationTool), whose superset ─▶ json schema's, as firmware's manifest's sets.validation-tools makes it;
 *     concept header (conceptHeader); graph type (graphType); set (set); superset (superset); core nodes graph
 *     (coreNodesGraph); hound (hound) and show hound (showHound), whose superset is a set under hound's; pet (pet)
 *   walkers         a set under hound's superset and pet's, ∈ set, wordTypes [word, set]
 *   hound's core nodes: its superset (∈ superset and ∈ set, [word, set, superset]); houndSchema, its JSON schema node,
 *     ∈ json schema, [word, jsonSchema]: validation tool reaches it, so it lacks validationTool; houndPP, its primary
 *     property, in no concept. hound's header ∈ concept header, [word, conceptHeader]
 *   petSchema       pet's JSON schema node, ∈ json schema, [word, validationTool, jsonSchema]: holds both
 *   cngHeader       core nodes graph's header, ∈ concept header and ∈ graph type, [word, conceptHeader]: lacks graphType
 *
 *   elements of hound (∈ hound unless said), each with a json tag unless said:
 *     rex           [word, hound]                                              holds its key
 *     champ         ∈ show hound, [word, showHound, hound]                     holds both
 *     halfChamp     ∈ show hound, [word, showHound]                            lacks hound
 *     walker        ∈ walkers, [word], with hound and pet sections             lacks hound and pet: two findings
 *     noWordBlock   { hound: {…} }, no word block                              lacks hound
 *     noWordTypes   a word block with no wordTypes                             lacks hound
 *     strWordTypes  wordTypes "hound", a string, not a list                    lacks hound
 *     nonString     wordTypes [word, 7, null]                                  lacks hound
 *     extraKey      [word, hound, pet]: pet doesn't reach it                   holds its key; pet isn't judged
 *     beside        OTHER's letter, [word, cat], with the owner's hound section kept beside in tapestryOwnSections:
 *                   the view lays it over and appends hound                    holds its key
 *     mute          no json tag, no sections kept beside                       not judged: no-json
 *     twoJson       two json tags that differ                                  not judged: unreadable-json
 *     garbled       a json tag that doesn't parse                              not judged: unreadable-json
 *     listJson      a json tag holding a list                                  not judged: unreadable-json
 *     besideBroken  OTHER's, [word, hound], tapestryOwnSections not JSON       not judged: unreadable-json
 *     unlabelled    [word], no TapestryNode label: no operation's read sees it, so the rule doesn't either
 *   wordOnly        ∈ word, no json tag: nothing is expected of it (word is reserved)
 *   ctxOnly         ∈ graph context, [word]: nothing is expected of it
 *   entry           a change entry (GraphChange), in no concept
 *
 * missingKeys(state, keys?) restates the rule in plain JavaScript over a state (ADR 0047 Decisions 2 and 4): for each
 * node a class thread reaches (or each of `keys`), the keys it lacks and why a node can't be judged. scopeKeys(state,
 * scope) restates its scan (Decision 3). The seed throws unless missingKeys finds exactly FINDINGS and UNJUDGED, so a
 * finding a suite sees and the seed doesn't is the rule's.
 *
 * → { file, dir, k (each node's tapestryKey by its name above; a concept's header by its name, its superset as
 *   `<name>Superset`), uuid (the same, by address), FINDINGS ([{ node, key }]), UNJUDGED ([{ node, why }]) }
 */

const crypto = require('crypto');
const path = require('path');
const S = require('./graphOpsSuite');
const P = require('./propertyGraph');
const G = require('./graphFake');

const { TA, OWNER } = S;
const OTHER = 'ee'.repeat(32);
const RULE = 'word-types-hold-concept-keys';
const RESERVED = Object.freeze(['word', 'graphContext']);

const INIT = 'IS_THE_CONCEPT_FOR';
const PROP = 'IS_A_SUPERSET_OF';
const TERM = 'HAS_ELEMENT';
const CORE = Object.freeze(['IS_THE_JSON_SCHEMA_FOR', 'IS_THE_PRIMARY_PROPERTY_FOR', 'IS_THE_PROPERTIES_SET_FOR', 'IS_THE_PROPERTY_TREE_GRAPH_FOR', 'IS_THE_CORE_GRAPH_FOR', 'IS_THE_CONCEPT_GRAPH_FOR']);

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ── the rule, restated over a state ──────────────────────────────────────────────────────────────────────────────

function index(s) {
  const byEid = new Map(s.nodes.map((n) => [n.eid, n]));
  const out = (n, type) => s.rels.filter((r) => r.from === n.eid && r.type === type).map((r) => byEid.get(r.to)).filter(Boolean);
  const into = (n, type) => s.rels.filter((r) => r.to === n.eid && r.type === type).map((r) => byEid.get(r.from)).filter(Boolean);
  return { byEid, out, into };
}
/** A node any operation's read sees as a node a rule judges: TapestryNode, not a change entry, not a tag. */
const judgeable = (n) => !!n && n.labels.includes('TapestryNode') && !n.labels.includes('GraphChange') && !n.labels.includes('NostrEventTag');

function jsonTags(s, ix, n) {
  return ix.out(n, 'HAS_TAG').filter((t) => t.labels.includes('NostrEventTag') && t.props.type === 'json').map((t) => t.props.value);
}
function parse(text) {
  if (typeof text !== 'string') return { problem: 'not text' };
  try { return { json: JSON.parse(text) }; } catch { return { problem: "doesn't parse" }; }
}
/** A concept header's key, as K.headersByKey reads one: its json's conceptHeader.oKeys.singular. */
function headerKey(s, ix, h) {
  const j = jsonTags(s, ix, h).map(parse).find((x) => x.json);
  const ch = j && isObject(j.json) && isObject(j.json.conceptHeader) ? j.json.conceptHeader : null;
  return ch && isObject(ch.oKeys) && typeof ch.oKeys.singular === 'string' ? ch.oKeys.singular : null;
}
/** Every concept header with a superset → [{ header, superset, key }]. */
function concepts(s, ix) {
  return s.nodes
    .filter((n) => (n.labels.includes('ConceptHeader') || n.labels.includes('ListHeader')) && !n.labels.includes('GraphChange'))
    .flatMap((h) => ix.out(h, INIT).filter((x) => x.labels.includes('Superset')).map((sup) => ({ header: h, superset: sup, key: headerKey(s, ix, h) })));
}
/** The superset and every set below it, each once. */
function threadOf(ix, sup) {
  const seen = new Set([sup.eid]);
  const sets = [sup];
  for (let i = 0; i < sets.length; i++) for (const x of ix.out(sets[i], PROP)) if (!seen.has(x.eid)) { seen.add(x.eid); sets.push(x); }
  return sets;
}
/** Map<tapestryKey, [{ header, key }]>: the concepts whose class thread reaches each node. */
function reaching(s) {
  const ix = index(s);
  const out = new Map();
  for (const c of concepts(s, ix)) {
    for (const set of threadOf(ix, c.superset)) {
      for (const e of ix.out(set, TERM)) {
        if (!judgeable(e)) continue;
        const k = e.props.tapestryKey;
        if (!out.has(k)) out.set(k, []);
        if (!out.get(k).some((x) => x.header.eid === c.header.eid)) out.get(k).push(c);
      }
    }
  }
  return out;
}
/** The view of a node's JSON (Decision 2) → { view } or { why: 'no-json' | 'unreadable-json' }. */
function viewOf(s, ix, n) {
  const values = [...new Set(jsonTags(s, ix, n))];
  const ownRaw = n.props.tapestryOwnSections;
  if (!values.length && (ownRaw === undefined || ownRaw === null)) return { why: 'no-json' };
  if (values.length > 1) return { why: 'unreadable-json' };
  let base = {};
  if (values.length) {
    const p = parse(values[0]);
    if (p.problem || !isObject(p.json)) return { why: 'unreadable-json' };
    base = p.json;
  }
  let own = null;
  if (ownRaw !== undefined && ownRaw !== null) {
    const p = typeof ownRaw === 'string' ? parse(ownRaw) : { json: ownRaw };
    if (p.problem || !isObject(p.json)) return { why: 'unreadable-json' };
    own = p.json;
  }
  if (!own) return { view: base };
  // As _fields.js's overlaySections: each section laid over whole; its keys, when lacking, appended to wordTypes, sorted.
  const view = { ...base, ...own };
  if (isObject(base.word) && Array.isArray(base.word.wordTypes)) {
    const lacking = Object.keys(own).filter((k) => !base.word.wordTypes.includes(k)).sort();
    if (lacking.length) view.word = { ...base.word, wordTypes: [...base.word.wordTypes, ...lacking] };
  }
  return { view };
}
/**
 * The rule over a state → { findings: [{ node, concept, key }], unjudged: [{ node, why }] }, each sorted by node then
 * key. `keys`, when given, are the nodes judged (a scan's items); else every node a class thread reaches.
 */
function missingKeys(s, keys = null) {
  const ix = index(s);
  const reach = reaching(s);
  const byTk = new Map(s.nodes.map((n) => [n.props.tapestryKey, n]));
  const findings = [];
  const unjudged = [];
  for (const k of (keys || [...reach.keys()]).slice().sort(byKey)) {
    const n = byTk.get(k);
    if (!judgeable(n)) continue;
    const expected = (reach.get(k) || []).filter((c) => typeof c.key === 'string' && !RESERVED.includes(c.key));
    if (!expected.length) continue;
    const v = viewOf(s, ix, n);
    if (v.why) { unjudged.push({ node: k, why: v.why }); continue; }
    const wt = isObject(v.view.word) && Array.isArray(v.view.word.wordTypes) ? v.view.word.wordTypes.filter((x) => typeof x === 'string') : [];
    for (const c of expected) if (!wt.includes(c.key)) findings.push({ node: k, concept: c.header.props.tapestryKey, key: c.key });
  }
  findings.sort((a, b) => byKey(a.node, b.node) || byKey(a.key, b.key));
  return { findings, unjudged };
}
/** The rule's scan, restated (Decision 3): the tapestryKeys a check over `scope` judges, sorted. */
function scopeKeys(s, scope) {
  const ix = index(s);
  const keys = new Set();
  if (!scope || scope.kind === 'graph') {
    for (const k of reaching(s).keys()) keys.add(k);
  } else if (scope.kind === 'node') {
    const n = s.nodes.find((x) => x.props.tapestryKey === scope.key);
    if (judgeable(n)) keys.add(scope.key);
  } else {
    const h = s.nodes.find((x) => x.props.tapestryKey === scope.key);
    if (judgeable(h)) keys.add(h.props.tapestryKey);
    for (const sup of ix.out(h, INIT)) {
      for (const set of threadOf(ix, sup)) {
        if (judgeable(set)) keys.add(set.props.tapestryKey);
        for (const e of ix.out(set, TERM)) if (judgeable(e)) keys.add(e.props.tapestryKey);
      }
    }
    for (const t of CORE) for (const n of ix.into(h, t)) if (judgeable(n)) keys.add(n.props.tapestryKey);
  }
  return [...keys].sort(byKey);
}

// ── the seed ─────────────────────────────────────────────────────────────────────────────────────────────────────

const toKey = (name) => name.split(/\s+/).map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join('');
const toSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function seedWordTypes(label = 'word-types') {
  const s = G.emptyState();
  const b = P.over(s);
  const k = {};
  const uuid = {};
  const keep = (name, n) => { k[name] = n.props.tapestryKey; uuid[name] = n.props.uuid; return n; };
  const node = (labels, props, tags = []) => {
    const n = b.add([...labels, 'TapestryNode'], { kind: 39999, pubkey: TA, created_at: 1763000000, tapestryKey: crypto.randomUUID(), ...props });
    tags.forEach((t, i) => b.tag(n, t, i));
    return n;
  };
  const word = (wordTypes, sections = {}, extra = {}) => JSON.stringify({ word: { slug: 'x', name: 'x', ...extra, ...(wordTypes === undefined ? {} : { wordTypes }) }, ...sections });

  /** A concept: its header (json: conceptHeader, oKeys.singular the key) and its superset, IS_THE_CONCEPT_FOR between. */
  const concept = (id, singular, plural, key = toKey(singular)) => {
    const slug = toSlug(singular);
    const header = node(['ListHeader', 'ConceptHeader'], { uuid: `39998:${TA}:${slug}`, kind: 39998, name: singular, tapestryValue: singular }, [
      ['d', slug], ['names', singular, plural], ['slug', slug],
      ['json', JSON.stringify({ word: { slug: `concept-header-for-the-concept-of-${toSlug(plural)}`, name: `concept header for the concept of ${plural}`, wordTypes: ['word', 'conceptHeader'] }, conceptHeader: { oNames: { singular, plural }, oSlugs: { singular: slug, plural: toSlug(plural) }, oKeys: { singular: key, plural: toKey(plural) } } })],
    ]);
    const superset = node(['ListItem', 'Superset'], { uuid: `39999:${TA}:superset-for-the-concept-of-${toSlug(plural)}`, name: `superset for the concept of ${plural}` }, [
      ['json', word(['word', 'set', 'superset'], { superset: { slug: toSlug(plural), name: plural } }, { slug: `superset-for-the-concept-of-${toSlug(plural)}` })],
    ]);
    b.link(header, INIT, superset);
    keep(id, header);
    keep(`${id}Superset`, superset);
    return { header, superset };
  };
  const into = (parent, n) => { b.link(parent, TERM, n); return n; };

  // Concepts.
  const C = {
    word: concept('word', 'word', 'words'),
    graphContext: concept('graphContext', 'graph context', 'graph contexts'),
    jsonSchema: concept('jsonSchema', 'json schema', 'json schemas'),
    validationTool: concept('validationTool', 'validation tool', 'validation tools'),
    conceptHeader: concept('conceptHeader', 'concept header', 'concept headers'),
    graphType: concept('graphType', 'graph type', 'graph types'),
    set: concept('set', 'set', 'sets'),
    superset: concept('superset', 'superset', 'supersets'),
    coreNodesGraph: concept('coreNodesGraph', 'core nodes graph', 'core nodes graphs'),
    hound: concept('hound', 'hound', 'hounds'),
    showHound: concept('showHound', 'show hound', 'show hounds'),
    pet: concept('pet', 'pet', 'pets'),
  };
  b.link(C.validationTool.superset, PROP, C.jsonSchema.superset);
  b.link(C.hound.superset, PROP, C.showHound.superset);

  // walkers: a set under hound's superset and pet's, and an element of the set concept.
  const walkers = keep('walkers', node(['ListItem', 'Set'], { uuid: `39999:${TA}:the-set-of-walkers`, name: 'walkers' }, [['json', word(['word', 'set'], { set: { slug: 'walkers', name: 'walkers' } })]]));
  b.link(C.hound.superset, PROP, walkers);
  b.link(C.pet.superset, PROP, walkers);
  into(C.set.superset, walkers);

  // hound's core nodes, and the other core nodes the rule judges.
  into(C.superset.superset, C.hound.superset);
  into(C.set.superset, C.hound.superset);
  into(C.conceptHeader.superset, C.hound.header);
  const houndSchema = keep('houndSchema', node(['ListItem', 'JSONSchema'], { uuid: `39999:${TA}:hound-schema`, name: 'JSON schema for the concept of hounds' }, [['json', word(['word', 'jsonSchema'], { jsonSchema: { type: 'object' } })]]));
  b.link(houndSchema, 'IS_THE_JSON_SCHEMA_FOR', C.hound.header);
  into(C.jsonSchema.superset, houndSchema);
  const houndPP = keep('houndPP', node(['ListItem', 'Property'], { uuid: `39999:${TA}:hound-primary-property`, name: 'primary property for the concept of hounds' }, [['json', word(['word', 'property', 'primaryProperty'], { property: { name: 'hound' } })]]));
  b.link(houndPP, 'IS_THE_PRIMARY_PROPERTY_FOR', C.hound.header);
  const petSchema = keep('petSchema', node(['ListItem', 'JSONSchema'], { uuid: `39999:${TA}:pet-schema`, name: 'JSON schema for the concept of pets' }, [['json', word(['word', 'validationTool', 'jsonSchema'], { jsonSchema: { type: 'object' } })]]));
  b.link(petSchema, 'IS_THE_JSON_SCHEMA_FOR', C.pet.header);
  into(C.jsonSchema.superset, petSchema);
  into(C.conceptHeader.superset, C.coreNodesGraph.header);
  into(C.graphType.superset, C.coreNodesGraph.header);
  keep('cngHeader', C.coreNodesGraph.header);

  // Elements.
  const el = (id, json, { parent = C.hound.superset, author = TA, extraProps = {}, labels = ['ListItem'], tags = null } = {}) => {
    const address = `39999:${author}:${toSlug(id)}`;
    const n = keep(id, node(labels, { uuid: address, pubkey: author, name: id, ...(author === TA ? { tapestryValue: id } : { id: crypto.createHash('sha256').update(address).digest('hex') }), ...extraProps }, tags || (json === null ? [['d', toSlug(id)]] : [['d', toSlug(id)], ['json', json]])));
    into(parent, n);
    return n;
  };
  el('rex', word(['word', 'hound'], { hound: { name: 'Rex', slug: 'rex' } }));
  el('champ', word(['word', 'showHound', 'hound'], { showHound: { name: 'Champ' } }), { parent: C.showHound.superset });
  el('halfChamp', word(['word', 'showHound'], { showHound: { name: 'Half Champ' } }), { parent: C.showHound.superset });
  el('walker', word(['word'], { hound: { name: 'Walker' }, pet: { name: 'Walker' } }), { parent: walkers });
  el('noWordBlock', JSON.stringify({ hound: { name: 'No Word Block' } }));
  el('noWordTypes', word(undefined, { hound: { name: 'No Word Types' } }));
  el('strWordTypes', JSON.stringify({ word: { slug: 'x', wordTypes: 'hound' }, hound: {} }));
  el('nonString', word(['word', 7, null], { hound: {} }));
  el('extraKey', word(['word', 'hound', 'pet'], { hound: {} }));
  el('beside', word(['word', 'cat'], { cat: { name: 'Beside' } }), { author: OTHER, extraProps: { tapestryOwnSections: JSON.stringify({ hound: { name: 'Beside', slug: 'beside' } }) } });
  el('mute', null);
  el('twoJson', null, { tags: [['d', 'two-json'], ['json', word(['word', 'hound'])], ['json', word(['word'])]] });
  el('garbled', '{not json');
  el('listJson', '[1, 2]');
  el('besideBroken', word(['word', 'hound'], { hound: {} }), { author: OTHER, extraProps: { tapestryOwnSections: 'not json' } });
  const unl = b.add(['ListItem'], { uuid: `39999:${TA}:unlabelled`, kind: 39999, pubkey: TA, name: 'unlabelled', tapestryKey: crypto.randomUUID() });
  b.tag(unl, ['json', word(['word'])], 0);
  into(C.hound.superset, unl);
  keep('unlabelled', unl);
  el('wordOnly', null, { parent: C.word.superset });
  el('ctxOnly', word(['word']), { parent: C.graphContext.superset });
  keep('entry', b.add(['GraphChange', 'TapestryNode'], { tapestryKey: crypto.randomUUID(), at: 1763000000, by: OWNER }));

  const FINDINGS = [
    { node: k.houndSchema, key: 'validationTool' },
    { node: k.cngHeader, key: 'graphType' },
    { node: k.halfChamp, key: 'hound' },
    { node: k.walker, key: 'hound' },
    { node: k.walker, key: 'pet' },
    { node: k.noWordBlock, key: 'hound' },
    { node: k.noWordTypes, key: 'hound' },
    { node: k.strWordTypes, key: 'hound' },
    { node: k.nonString, key: 'hound' },
  ].sort((a, b2) => byKey(a.node, b2.node) || byKey(a.key, b2.key));
  const UNJUDGED = [
    { node: k.mute, why: 'no-json' },
    { node: k.twoJson, why: 'unreadable-json' },
    { node: k.garbled, why: 'unreadable-json' },
    { node: k.listJson, why: 'unreadable-json' },
    { node: k.besideBroken, why: 'unreadable-json' },
  ].sort((a, b2) => byKey(a.node, b2.node));

  // The seed checks itself against the rule restated: a finding a suite sees and this doesn't is the rule's.
  const got = missingKeys(s);
  const plain = (xs) => JSON.stringify(xs.map(({ node: n, key, why }) => ({ node: n, ...(key ? { key } : { why }) })));
  if (plain(got.findings) !== plain(FINDINGS)) throw new Error(`wordTypesGraph: the seed's findings aren't the ones it names: ${plain(got.findings)}`);
  if (plain(got.unjudged) !== plain(UNJUDGED)) throw new Error(`wordTypesGraph: the seed's unjudged nodes aren't the ones it names: ${plain(got.unjudged)}`);

  const dir = S.tmp(`${label}-`);
  const file = path.join(dir, 'graph.json');
  G.writeState(file, s);
  return { file, dir, k, uuid, FINDINGS, UNJUDGED };
}

/** The name the seed gives a tapestryKey, for messages. */
const nameIn = (k, key) => (Object.entries(k).find(([, v]) => v === key) || [key])[0];

module.exports = { TA, OWNER, OTHER, RULE, RESERVED, seedWordTypes, missingKeys, scopeKeys, reaching, nameIn };
