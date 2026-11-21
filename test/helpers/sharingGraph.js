'use strict';
/**
 * The graph story graph-operations-first-slice #48's suites share (graph declare-shared, wire-to-shared and
 * defer-sharing; ADR graph-operations-first-slice/0048). Its test plan,
 * engineering-team/stories/graph-operations-first-slice/48-declare-a-concept-shared.test-plan.md, says what each holds.
 *
 * Every statement runs on the Cypher engine (test/helpers/cypherEngine.js, through cypherGraphFake.js), which runs a
 * MERGE with a property map in its relationship pattern, an OPTIONAL MATCH of a node of any label and import nostr's
 * placeholder CREATE as Neo4j runs them, with Tapestry's uniqueness rules. test/helpers/graphFake.js runs none of the
 * first: the self-loop's MERGE is "a MERGE it can't read" there (Test Design's probe, 2026-11-21). So no fake is taught a
 * new shape for this story, and the suites pin what the graph holds after each call, whatever text the Implementer writes
 * within the engine's subset.
 *
 * prepared() → Promise<{ state, keys, made, addr }>, built once a process and kept in memory (a temporary folder is
 * removed when the suite that made it ends, so a later suite couldn't read it); fileOf(label) writes a copy of the state
 * into a folder of the caller's suite and returns its path. The graph is test/helpers/conceptGraph.js's seed (firmware,
 * today's lettered concepts beagle, cat, bird, mouse and goal, another author's relay, the owner's recipe, twelve widgets
 * by other authors, rover, the node at 39998:<TA>:held) with these added:
 *   - b tags on today's lettered headers, as letters can carry them:
 *       cat      ["b", "39998:<TA>:cat"]: untyped, naming its own address
 *       bird     ["b", "b-tag-deferred"], twice: two markers
 *       mouse    ["b", <relay's address>, "inherit"]: a real b naming relay, inherit-typed
 *       goal     ["b", "not-a-coordinate"]: malformed, which derives nothing and isn't a real b
 *       widget 2 ["b", <relay's address>, "pointer"]: another author's header with a real b (ADR 0048 Amendment 1, item 4)
 *       widget 3 ["b", <its own address>, "pointer"]: another author's self-declaration (the same)
 *   - at NEWT, seed-firmware's kind of placeholder: a TapestryNode with no created_at and no NostrEvent label (Amendment 1,
 *     item 1: a placeholder is any node with no created_at, whoever made it)
 *   - ten concepts graph create-concept made, with no letter: lamp, kite, drum, hoop, yoyo, quilt, harp, gong, flute and
 *     dog house, and on four of them:
 *       kite   ["b", "b-tag-deferred"]: one marker, as defer-sharing would leave it
 *       drum   (drum)-[:REFERENCES {source:'b-tag'}]->(drum), with no b tag: a self-loop an import drew
 *       hoop   ["b", <64 hex>]: a real b, an event id; (hoop)-[:REFERENCES {source:'b-tag'}]->(relay's header), with no
 *              b tag naming relay, as an import drew it; and (hoop)-[:REFERENCES {source:'firmware-community'}]->(the
 *              second widget's header), firmware's legacy stub (BIBLE §22's other concept-level producer)
 *       gong   ["b", GHOST, "pointer"], with no node at GHOST and no relationship: as a route that draws no relationship
 *              writes a b (Amendment 1, item 3)
 * keys: conceptGraph's keys, held (the node at 39998:<TA>:held) and newt (the placeholder at NEWT). made: each made
 * concept as create-concept answered it ({ conceptHeader, nodes, address, … }), by name (dogHouse for dog house). addr:
 * each header's address by the same names, and RELAY, WIDGET0 to WIDGET3 (other authors'), FISH, OTTER and GHOST
 * (addresses no node holds; OTTER's pubkey is PUB_OTTER) and NEWT (the placeholder's).
 *
 * Readers over a state: node, bTags (a header's b tags as an event holds them), otherTags (the rest), jsonText (its json
 * tag's value), refsFrom (its REFERENCES out, { to, props }), relsOut (every relationship out of it but HAS_TAG),
 * nodesAtExactly (the nodes at one address), entriesNaming (the change entries whose keys hold a tapestryKey),
 * changedSince (the changes a run's new entries made to a node), transactions (a state's log, split by transaction),
 * unexpected (what differs between two states outside what the three may change), naddr, sameMultiset, changesOf. And
 * assertBValues, for an answer's disposition.bValues (Amendment 1, item 2).
 */

const crypto = require('crypto');
const path = require('path');
const S = require('./graphOpsSuite');
const C = require('./conceptGraph');
const CG = require('./cypherGraphFake');

const { ROOT, TA, assert, show } = S;
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));

const MARKER = 'b-tag-deferred';
const EVENT_ID = crypto.createHash('sha256').update('sharingGraph: an event a b names').digest('hex');
const PUB_FISH = 'ab'.repeat(32);
const PUB_OTTER = 'cd'.repeat(32);
const PUB_GHOST = 'ef'.repeat(32);
const PUB_NEWT = 'ad'.repeat(32);
const NAMES = Object.freeze({ lamp: 'lamp', kite: 'kite', drum: 'drum', hoop: 'hoop', yoyo: 'yoyo', quilt: 'quilt', harp: 'harp', gong: 'gong', flute: 'flute', dogHouse: 'dog house' });
const DECLS = Object.freeze(['declare-shared', 'wire-to-shared', 'defer-sharing']);
const declFile = (name) => path.join(ROOT, `src/operations/catalog/graph/${name}.js`);

/** Throw the reason a suite can't run yet: one of the three declarations doesn't exist. */
function needDecls(names = DECLS) {
  const fs = require('fs');
  const missing = names.find((n) => !fs.existsSync(declFile(n)));
  if (missing) throw new Error(`src/operations/catalog/graph/${missing}.js does not exist yet (ADR graph-operations-first-slice/0048 Decision 1)`);
}

const copy = (x) => JSON.parse(JSON.stringify(x));
const hex = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// ── building ──
/** A tag node under the node keyed `key`, as the import makes one at the node's next index: → its tapestryKey. */
function addTag(s, key, tag) {
  const n = s.nodes.find((x) => x.props.tapestryKey === key);
  if (!n) throw new Error(`sharingGraph's setup found no node ${key} to tag, which is this helper's failure, not the feature's`);
  const index = s.rels.filter((r) => r.from === n.eid && r.type === 'HAS_TAG').length;
  const props = { uuid: hex(`${n.props.uuid}:${tag.join(',')}:${index}`), type: tag[0], value: tag[1] === undefined ? '' : tag[1], tapestryKey: crypto.randomUUID() };
  if (tag[2]) props.value1 = tag[2];
  if (tag[3]) props.value2 = tag[3];
  const t = { eid: s.nextEid++, labels: ['NostrEventTag', 'TapestryNode'], props };
  s.nodes.push(t);
  s.rels.push({ eid: s.nextEid++, type: 'HAS_TAG', from: n.eid, to: t.eid, props: {} });
  return props.tapestryKey;
}
/** A relationship between two nodes by tapestryKey, with its properties. */
function addRel(s, fromKey, type, toKey, props = {}) {
  const a = s.nodes.find((x) => x.props.tapestryKey === fromKey);
  const b = s.nodes.find((x) => x.props.tapestryKey === toKey);
  if (!a || !b) throw new Error(`sharingGraph's setup found no node for ${!a ? fromKey : toKey}, which is this helper's failure, not the feature's`);
  s.rels.push({ eid: s.nextEid++, type, from: a.eid, to: b.eid, props: { ...props } });
}

let PREPARED = null;
/** The graph above, built once a process (see the header). */
function prepared() {
  if (!PREPARED) PREPARED = build().catch((e) => { PREPARED = null; throw e; });
  return PREPARED;
}

async function build() {
  const seed = await C.seedConcepts();
  const keys = { ...seed.keys };
  const st = seed.state;
  const uuidOf = (k) => C.node(st, k).props.uuid;
  keys.held = C.byUuid(st, `39998:${TA}:held`).props.tapestryKey;
  const addr = {
    beagle: uuidOf(keys.beagle), cat: uuidOf(keys.cat), bird: uuidOf(keys.bird), mouse: uuidOf(keys.mouse), goal: uuidOf(keys.goal),
    recipe: uuidOf(keys.recipe), word: uuidOf(keys.word),
    RELAY: uuidOf(keys.relay), WIDGET0: uuidOf(keys.widgets[0]), WIDGET1: uuidOf(keys.widgets[1]),
    WIDGET2: uuidOf(keys.widgets[2]), WIDGET3: uuidOf(keys.widgets[3]),
    FISH: `39998:${PUB_FISH}:fish`, OTTER: `39998:${PUB_OTTER}:otter`, GHOST: `39998:${PUB_GHOST}:ghost`, NEWT: `39998:${PUB_NEWT}:newt`,
  };
  addTag(st, keys.cat, ['b', addr.cat]);
  addTag(st, keys.bird, ['b', MARKER]);
  addTag(st, keys.bird, ['b', MARKER]);
  addTag(st, keys.mouse, ['b', addr.RELAY, 'inherit']);
  addTag(st, keys.goal, ['b', 'not-a-coordinate']);
  addTag(st, keys.widgets[2], ['b', addr.RELAY, 'pointer']);
  addTag(st, keys.widgets[3], ['b', addr.WIDGET3, 'pointer']);
  // Seed-firmware's kind of placeholder (MERGE (p:TapestryNode {uuid})): no created_at, no NostrEvent label.
  keys.newt = crypto.randomUUID();
  st.nodes.push({ eid: st.nextEid++, labels: ['TapestryNode'], props: { uuid: addr.NEWT, tapestryKey: keys.newt } });

  // The concepts with no letter, made by the real graph create-concept on the Cypher engine.
  const dir = S.tmp('sharing-graph-');
  const file = path.join(dir, 'graph.json');
  CG.writeState(file, st);
  const requests = Object.entries(NAMES).map(([id, name]) => ({ id, method: 'POST', url: '/api/tapestry/graph/create-concept', caller: 'owner', body: { name } }));
  const a = S.answered(S.runHarness({ scenarios: [{ graphFake: { stateFile: file, engine: 'cypher' }, requests }] }, { dir }));
  const made = {};
  for (const id of Object.keys(NAMES)) {
    const r = a.req(id);
    if (!(r.status === 200 && r.body && r.body.data && r.body.data.outcome === 'created')) {
      throw new Error(`sharingGraph's setup failed at graph create-concept of ${NAMES[id]}, which is this helper's, not the feature's: ${r.status} ${show(r.body).slice(0, 400)}`);
    }
    made[id] = r.body.data.concept;
    addr[id] = made[id].address;
  }
  const state = CG.readState(file);
  state.log = [];
  addTag(state, made.kite.conceptHeader, ['b', MARKER]);
  addRel(state, made.drum.conceptHeader, 'REFERENCES', made.drum.conceptHeader, { source: 'b-tag' });
  addTag(state, made.hoop.conceptHeader, ['b', EVENT_ID]);
  addRel(state, made.hoop.conceptHeader, 'REFERENCES', keys.relay, { source: 'b-tag' });
  addRel(state, made.hoop.conceptHeader, 'REFERENCES', keys.widgets[1], { source: 'firmware-community' });
  addTag(state, made.gong.conceptHeader, ['b', addr.GHOST, 'pointer']);
  return { state, keys, made, addr };
}

/** A copy of the prepared state (or `state`) in a folder of the calling suite, with `failures` given: → its path. */
async function fileOf(label, { state = null, failures = {} } = {}) {
  const p = state ? { state } : await prepared();
  const s = copy(p.state);
  s.failures = failures;
  s.log = [];
  const f = path.join(S.tmp(`${label}-`), 'graph.json');
  CG.writeState(f, s);
  return f;
}

/** A graph with no concept-header concept (K.lock's not-installed), its beagle a concept the three would otherwise take. */
async function notInstalledFile(label) {
  const seed = await C.seedConcepts({ without: ['concept-header'] });
  const f = path.join(S.tmp(`${label}-not-installed-`), 'graph.json');
  CG.writeState(f, seed.state);
  return { file: f, beagle: seed.keys.beagle };
}

/** One harness run over `file` on the Cypher engine: graphOpsSuite's answered. */
function runOn(file, requests, { cli = [], spy = false } = {}) {
  return S.answered(S.runHarness({ spy, scenarios: [{ graphFake: { stateFile: file, engine: 'cypher' }, requests, cli }] }, { dir: path.dirname(file) }));
}

// ── reading ──
const node = (s, key) => s.nodes.find((n) => n.props.tapestryKey === key) || null;
const tagNodes = (s, key) => {
  const n = node(s, key);
  return n ? s.rels.filter((r) => r.from === n.eid && r.type === 'HAS_TAG').map((r) => s.nodes.find((x) => x.eid === r.to)).filter(Boolean) : [];
};
/** A tag node as an event holds it: [type, value, value1…], none missing in between. */
const asArray = (t) => {
  const out = [t.props.type, t.props.value, t.props.value1, t.props.value2];
  while (out.length > 2 && (out[out.length - 1] === null || out[out.length - 1] === undefined || out[out.length - 1] === '')) out.pop();
  return out.map((x) => (x === null || x === undefined ? '' : String(x)));
};
const bTags = (s, key) => tagNodes(s, key).filter((t) => t.props.type === 'b').map(asArray);
const otherTags = (s, key) => tagNodes(s, key).filter((t) => t.props.type !== 'b').map(asArray);
const jsonText = (s, key) => { const t = tagNodes(s, key).find((x) => x.props.type === 'json'); return t ? t.props.value : null; };
/** The REFERENCES relationships out of a node: [{ to (a tapestryKey), props }]. */
function refsFrom(s, key) {
  const n = node(s, key);
  if (!n) return [];
  return s.rels.filter((r) => r.from === n.eid && r.type === 'REFERENCES').map((r) => ({ to: (s.nodes.find((x) => x.eid === r.to) || { props: {} }).props.tapestryKey, props: r.props || {} }));
}
const bRefs = (s, key) => refsFrom(s, key).filter((r) => r.props.source === 'b-tag');
const nodesAtExactly = (s, uuid) => s.nodes.filter((n) => n.props.uuid === uuid && !n.labels.includes('NostrEventTag'));
const entriesNaming = (s, key, operation = null) => S.entriesOf(s).filter((e) => Array.isArray(e.keys) && e.keys.includes(key) && (!operation || e.operation === operation));
/**
 * The changes made to the node keyed `key` (its node, or a relationship's from) by the entries `after` holds and
 * `before` doesn't: [] when nothing was written for it. The setup's own entries (create-concept's) never count, nor an
 * entry naming the node only as another write's target.
 */
function changedSince(before, after, key) {
  const had = new Set(S.entriesOf(before).map((e) => e.tapestryKey));
  return S.entriesOf(after).filter((e) => !had.has(e.tapestryKey))
    .flatMap((e) => (Array.isArray(e.changes) ? e.changes : []).filter((c) => c && (c.node === key || c.from === key)).map((c) => ({ operation: e.operation, ...c })));
}
/** The transactions in a state's log: [{ steps, end, error }]. */
function transactions(log) {
  const out = [];
  let cur = null;
  for (const l of log || []) {
    if (l.call === 'begin') cur = { steps: [] };
    else if ((l.call === 'commit' || l.call === 'rollback') && cur) { out.push({ ...cur, end: l.call, error: l.error || null }); cur = null; } else if (cur) cur.steps.push(l);
  }
  return out;
}
const sortedJson = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((o, kk) => { o[kk] = v[kk]; return o; }, {}) : v));
/** Two lists equal as multisets, each item compared by its JSON with keys sorted. */
const sameMultiset = (a, b) => show([...(a || [])].map(sortedJson).sort()) === show([...(b || [])].map(sortedJson).sort());
/** The changes of an answer's change entry, or []. */
const changesOf = (d) => (d && d.change && Array.isArray(d.change.changes) ? d.change.changes : []);

/**
 * What differs between two states outside what the three operations may change on the headers keyed `headers`: their b
 * tag nodes and those HAS_TAG links, their REFERENCES {source:'b-tag'}, a placeholder (a NostrEvent with no created_at at
 * a kind-39998 address), and the change entries. → a list of what else differs, empty when nothing does.
 */
function unexpected(before, after, headers) {
  const allowed = new Set(headers);
  const eidKey = (s) => new Map(s.nodes.map((n) => [n.eid, n.props.tapestryKey]));
  const kb = eidKey(before), ka = eidKey(after);
  const isEntry = (n) => n.labels.includes('GraphChange');
  const ownerOfTag = (s, n) => { const r = s.rels.find((x) => x.type === 'HAS_TAG' && x.to === n.eid); return r ? (s.nodes.find((x) => x.eid === r.from) || { props: {} }).props.tapestryKey : null; };
  const isAllowedTag = (s, n) => n.labels.includes('NostrEventTag') && n.props.type === 'b' && allowed.has(ownerOfTag(s, n));
  const isPlaceholder = (n) => n.labels.includes('NostrEvent') && (n.props.created_at === undefined || n.props.created_at === null) && /^39998:/.test(String(n.props.uuid));
  const out = [];
  const byKey = (s) => new Map(s.nodes.filter((n) => !isEntry(n)).map((n) => [n.props.tapestryKey, n]));
  const nb = byKey(before), na = byKey(after);
  for (const [k, n] of nb) {
    const m = na.get(k);
    if (!m) { if (!isAllowedTag(before, n)) out.push(`node gone: ${show(n.labels)} ${show(n.props).slice(0, 160)}`); continue; }
    if (sortedJson([...n.labels].sort()) !== sortedJson([...m.labels].sort()) || sortedJson(n.props) !== sortedJson(m.props)) out.push(`node changed: ${k}: ${show({ labels: n.labels, props: n.props }).slice(0, 200)} → ${show({ labels: m.labels, props: m.props }).slice(0, 200)}`);
  }
  for (const [k, m] of na) if (!nb.has(k) && !isAllowedTag(after, m) && !isPlaceholder(m)) out.push(`node added: ${show(m.labels)} ${show(m.props).slice(0, 200)}`);
  const relText = (r, keys) => `${keys.get(r.from)} -[${r.type} ${sortedJson(r.props || {})}]-> ${keys.get(r.to)}`;
  const relAllowed = (s, r) => {
    const from = (s.nodes.find((x) => x.eid === r.from) || { props: {} }).props.tapestryKey;
    const to = s.nodes.find((x) => x.eid === r.to);
    if (r.type === 'HAS_TAG') return allowed.has(from) && !!to && isAllowedTag(s, to);
    return r.type === 'REFERENCES' && allowed.has(from) && (r.props || {}).source === 'b-tag';
  };
  const counted = (s, keys) => {
    const m = new Map();
    for (const r of s.rels) { const t = relText(r, keys); if (!m.has(t)) m.set(t, { n: 0, sample: r }); m.get(t).n += 1; }
    return m;
  };
  const cb = counted(before, kb), ca = counted(after, ka);
  for (const [t, { n, sample }] of cb) { const d = n - (ca.has(t) ? ca.get(t).n : 0); if (d > 0 && !relAllowed(before, sample)) out.push(`relationship gone (${d}): ${t}`); }
  for (const [t, { n, sample }] of ca) { const d = n - (cb.has(t) ? cb.get(t).n : 0); if (d > 0 && !relAllowed(after, sample)) out.push(`relationship added (${d}): ${t}`); }
  return out;
}

/** An naddr of an address's three parts. */
const naddr = (kind, pubkey, identifier) => NT.nip19.naddrEncode({ kind, pubkey, identifier, relays: [] });

/** The answer's data, asserting 200 and success. */
function ok(a, id) {
  const r = a.req(id);
  assert(r.status === 200 && r.body && r.body.success === true, `${id} must answer 200; got ${r.status} ${show(r.body).slice(0, 600)}`);
  return r.body.data;
}
/** The refusal's body, asserting its status and code. */
function refused(a, id, status, code) {
  const r = a.req(id);
  assert(r.status === status && r.body && r.body.success === false && r.body.code === code, `${id} must be refused ${status} ${code}; got ${r.status} ${show(r.body).slice(0, 600)}`);
  return r.body;
}
/**
 * Assert the answer's disposition.bValues (ADR 0048 Amendment 1, item 2): a list of strings, each b's value, once each and
 * sorted, read after the call: exactly `values`, made distinct and sorted. `what` names the call in the message.
 */
function assertBValues(d, values, what) {
  const want = [...new Set(values)].sort();
  const got = d && d.disposition ? d.disposition.bValues : undefined;
  assert(Array.isArray(got) && got.every((v) => typeof v === 'string') && show(got) === show(want),
    `${what}: disposition.bValues is the header's b values after the call, as strings, once each and sorted (ADR 0048 Amendment 1, item 2): ${show(want)}; got ${show(d && d.disposition)}`);
}
/** Every relationship out of a node but HAS_TAG, as `<type> <props> → <key>`, sorted: for "no relationship was drawn". */
function relsOut(s, key) {
  const n = node(s, key);
  if (!n) return [];
  return s.rels.filter((r) => r.from === n.eid && r.type !== 'HAS_TAG')
    .map((r) => `${r.type} ${sortedJson(r.props || {})} → ${(s.nodes.find((x) => x.eid === r.to) || { props: {} }).props.tapestryKey}`).sort();
}

module.exports = {
  MARKER, EVENT_ID, PUB_FISH, PUB_OTTER, PUB_GHOST, PUB_NEWT, NAMES, DECLS, NT,
  declFile, needDecls, prepared, fileOf, notInstalledFile, runOn, addTag, addRel,
  node, tagNodes, bTags, otherTags, jsonText, refsFrom, bRefs, relsOut, nodesAtExactly, entriesNaming, changedSince, transactions, sameMultiset, sortedJson, changesOf,
  unexpected, naddr, ok, refused, assertBValues, copy,
};
