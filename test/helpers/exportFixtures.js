'use strict';
/**
 * What export nostr's suites share (story graph-operations-first-slice #34; ADR graph-operations-first-slice/0034). Its
 * test plan, engineering-team/stories/graph-operations-first-slice/34-export-nostr.test-plan.md, says what each holds.
 *
 * Keys. The callers are graphOpsSuite's (ADMIN, STRANGER), but the owner is importFixtures' KEYS.ownerSigner, so that a
 * node the owner signed can be told apart (AC4's owner-signed). The child's assistant is importFixtures' KEYS.ta: its
 * pubkey is the child's TA_PUBKEY, and its secret reaches getOwnerAssistantKeys through the harness's assistantKeys hook
 * (test/helpers/assistantKeysFake.js), so every letter export signs is checked with nostr-tools' verifyEvent.
 *
 * The world (world(), built once a process, then copied by each suite):
 *   firmware      fourteen of firmware's concepts as an install leaves them, each header and superset a letter the
 *                 assistant signed, imported by today's builder (importFixtures' today), with the role labels and
 *                 wiring the install adds: concept-header's superset HAS_ELEMENT each header; word's superset over
 *                 set's; graph's superset over the concept-graph, core-nodes-graph, property-tree-graph and tapestry
 *                 supersets (firmware's "graphs" category); JSON schemas for set, word, property, graph and tapestry
 *                 (firmware's own files); and one declared relationship type, CITES. Their letters are in the instance's
 *                 own relay. This is the precondition, as POST /api/firmware/install is for the live suites.
 *   dog           the assistant's concept as today's routes leave it (importFixtures' ownConcept: letters imported by
 *                 today's builder, a set, an element Rex and a node made here with no letter), and five more of today's
 *                 letters in it: note, with a five-element e tag (EL10); big, whose json and description are lmdb:
 *                 pointers the store holds and whose summary is one it doesn't (EL4, EK5); gone, whose json points at
 *                 nothing (unbuildable); context, whose inline json holds a graphContext (EL4); and pointer, whose a tag
 *                 names an address of the assistant's no node holds, so today's builder made a placeholder there that
 *                 carries the assistant's key (ES2: never in a scope). All in the own relay.
 *   bird          today's concept whose header has pointer b tags (alice's cat, pointer; bob's fish, untyped; carol's
 *                 lizard, inherit); its header's letter is left out of the own relay, so it is signed again (EL5).
 *                 Polly, today's element of bird, already carries cat's stamp; Tweety is made in bird by graph
 *                 create-element, with no stamps.
 *   others        alice's concept cat (her letters, imported by today's builder, labelled and wired) and her kind 1 note
 *                 (an nevent's target); the assistant's own kind 1 note (other-kind, EL8); an admin's node and the
 *                 owner's (each a letter imported by today's builder); a node with no author at one of the assistant's
 *                 addresses, made with _eventless.js's makeNode, and one with no author and no address (EL8, EL9).
 *   pet           made by the REAL graph operations, through the harness on the Cypher engine (no statement needed the
 *                 engine extended): graph create-concept (pet, and animal), create-set (Lap Pets, Walkers, Strays),
 *                 link-set (Walkers under Lap Pets, pet's superset under animal's, Strays under alice's cat superset),
 *                 unlink-set (Walkers from pet's superset), create-element (Rex in Lap Pets, Tom, Fido, Spot, Linker),
 *                 add-relationship (Rex CITES Tom), add-property (friend, which brings name, slug and description),
 *                 enumerate (friend from pet), update-node (Tom's description with a tapestry: link to Rex, and friend
 *                 tapestry:<Rex>), and create-element in the graph concept for six selections saved as graphs (picks,
 *                 carry, others, missing, linked, and an empty one).
 *   tapestry      a Tapestry as today's Tapestries UI publishes one (ui/src/pages/tapestries/tapestryDraft.mjs): the
 *                 assistant's letter, its graph listing pet's and dog's headers and importing their concept graphs, its
 *                 description holding a tapestry: link to Rex, imported by today's builder; its letter in the own relay.
 *   lmdb          the store entries: big's json and description, and a stale copy of Rex's JSON under Rex's own key.
 * world() → { state, lmdb, ownEvents, keys, addr, letters, fw }, keys and addr by name (see buildWorld). petScope(keys)
 * and dogScope(keys) are what each concept graph's scope brings (ADR Decision 2); everythingIn(state) what everything
 * does.
 *
 * Runs: runExport(opts) is one harness run with the Cypher engine, the fake relays and DNS, the fake strfry import and
 * the assistant's key (relayFake.js says what relays, live, strfry and exportTiming take): → { req, cmd, spy, error,
 * file, fixture, dir, state(), log(), store(url) }. opts.fixture reuses an earlier run's relay fixture, its store and its
 * log, so a later call sees what an earlier one sent. runOps(file, requests) runs the graph operations alone.
 * runTodays(state, run, { strfry }) runs one of today's importers (event-update, the I/O import, the brain-write hook) or
 * export's holdsLetterOrNewer, stack-free, in test/helpers/todaysImportersChild.js: → { error, answer, log, state() }.
 * Requests: exp(id, caller, body), history(id, query), op(id, name, body).
 * Answers (the ADR leaves some field names to the Implementer; these accessors say what the suites read):
 *   letters(d)          the answer's letters, one for each node in the scope
 *   keyOf(l)            a letter's node, its tapestryKey: l.node, else l.tapestryKey
 *   letterFor(d, key)   the letter for that node
 *   relayOf(l, relay)   that relay's answer for the letter, { relay, status, reason }: 'own' or ws://127.0.0.1:7777 for
 *                       the instance's own, any other by its URL
 *   reports(d, code)    the answer's reports of that code: r.report, else r.code, r.kind or r.type
 *   countOf(d, outcome) the answer's count of an outcome, under its name or its camelCase
 * Readers: tagArrays, jsonOf, nodeByKey, at (the node at an address), sentToOf, plain (a stored integer as a number),
 *   signings(spy), namesIn(event), decodeNip19, letterAt(events, address), letterJson, strings, sortedTags, sameTags,
 *   entriesOf, exportEntries.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('./graphOpsSuite');
const F = require('./importFixtures');
const R = require('./relayFake');
const CG = require('./cypherGraphFake');
const E = require('./cypherEngine');

const { ROOT, NL, assert, show } = S;
const { KEYS, NT } = F;

const ROUTE = '/api/tapestry/export/nostr';
const DECL = path.join(ROOT, 'src/operations/catalog/export/nostr.js');
const SEND = path.join(ROOT, 'src/operations/catalog/export/_send.js');
const OWN_MODULE = path.join(ROOT, 'src/operations/catalog/export/_own.js');
const LINKS = path.join(ROOT, 'src/lib/markdownLinks.js');
const OWN_RELAY = F.OWN_RELAY;
const PEER = F.PEER_RELAY;
const OWNER = KEYS.ownerSigner.pubkey;
const TA = KEYS.ta.pubkey;
const TA_SECRET = Buffer.from(KEYS.ta.sk).toString('hex');
/** The fake DNS: importFixtures' names, and one public name for each outside relay a suite names. */
const DNS = Object.freeze({
  ...F.DNS,
  'accepts.example.com': { v4: ['1.0.2.1'] },
  'refuses.example.com': { v4: ['1.0.2.2'] },
  'silent.example.com': { v4: ['1.0.2.3'] },
  'gone.example.com': { v4: ['1.0.2.4'] },
  'drop.example.com': { v4: ['1.0.2.5'] },
  'slow.example.com': { v4: ['1.0.2.6'] },
  'later.example.com': { v4: ['1.0.2.7'] },
});
const URL_OF = (name) => `wss://${name}.example.com`;

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/export/nostr.js does not exist yet (ADR graph-operations-first-slice/0034 Decision 1)');
}

const copy = (x) => JSON.parse(JSON.stringify(x));
const addressOf = F.addressOf;

// ── the firmware an install leaves (the precondition) ──
const FIRMWARE = Object.freeze([
  ['concept-header', 'concept header', 'concept headers'], ['superset', 'superset', 'supersets'], ['set', 'set', 'sets'],
  ['word', 'word', 'words'], ['json-schema', 'json schema', 'json schemas'], ['primary-property', 'primary property', 'primary properties'],
  ['property', 'property', 'properties'], ['properties-set', 'properties set', 'properties sets'],
  ['property-tree-graph', 'property tree graph', 'property tree graphs'], ['graph', 'graph', 'graphs'],
  ['concept-graph', 'concept graph', 'concept graphs'], ['core-nodes-graph', 'core nodes graph', 'core nodes graphs'],
  ['relationship-type', 'relationship type', 'relationship types'], ['tapestry', 'tapestry', 'tapestries'],
]);
const SCHEMAS = Object.freeze(['set', 'word', 'property', 'graph', 'tapestry']);
const GRAPHS_CATEGORY = Object.freeze(['concept-graph', 'core-nodes-graph', 'property-tree-graph', 'tapestry']);

function firmwareJson(concept, file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'firmware/versions/v1.0.0/concepts', concept, file), 'utf8'));
}

/** Firmware's concepts as an install leaves them, in `state`; → { letters, header(slug), superset(slug) }. */
function firmware(state, { key = KEYS.ta, at = 1680000000 } = {}) {
  const CN = require(path.join(ROOT, 'src/lib/conceptNames.js'));
  const A = (kind, d) => `${kind}:${key.pubkey}:${d}`;
  const letters = [];
  const sign = (kind, tags) => { const e = F.letter(key, { kind, at, tags }); F.today(state, e); letters.push(e); return e; };
  for (const [slug, singular, plural] of FIRMWARE) {
    const n = CN.deriveAllNames(singular, plural);
    const json = {
      word: { slug: `concept-header-for-the-concept-of-${n.oSlugs.plural}`, name: `concept header for the concept of ${n.oNames.plural}`, title: `Concept Header for the Concept of ${n.oTitles.plural}`, wordTypes: ['word', 'conceptHeader'] },
      conceptHeader: { description: `${n.oTitles.singular} is a firmware concept.`, oNames: n.oNames, oSlugs: n.oSlugs, oKeys: n.oKeys, oTitles: n.oTitles, oLabels: n.oLabels },
    };
    sign(39998, [['d', slug], ['names', singular, plural], ['slug', slug], ['json', JSON.stringify(json)]]);
    sign(39999, [['d', `${slug}-superset`], ['name', `superset for the concept of ${plural}`]]);
    F.label(state, A(39998, slug), ['ConceptHeader']);
    F.label(state, A(39999, `${slug}-superset`), ['Superset']);
    F.wire(state, A(39998, slug), 'IS_THE_CONCEPT_FOR', A(39999, `${slug}-superset`));
  }
  for (const [slug] of FIRMWARE) F.wire(state, A(39999, 'concept-header-superset'), 'HAS_ELEMENT', A(39998, slug));
  for (const c of SCHEMAS) {
    sign(39999, [['d', `${c}-schema`], ['name', `JSON schema for the concept of ${c}s`], ['json', JSON.stringify(firmwareJson(c, 'json-schema.json'))]]);
    F.label(state, A(39999, `${c}-schema`), ['JSONSchema']);
    F.wire(state, A(39999, `${c}-schema`), 'IS_THE_JSON_SCHEMA_FOR', A(39998, c));
  }
  F.wire(state, A(39999, 'word-superset'), 'IS_A_SUPERSET_OF', A(39999, 'set-superset'));
  for (const c of GRAPHS_CATEGORY) F.wire(state, A(39999, 'graph-superset'), 'IS_A_SUPERSET_OF', A(39999, `${c}-superset`));
  const cites = sign(39999, [['d', 'cites'], ['name', 'cites'], ['z', A(39998, 'relationship-type')], ['json', JSON.stringify({ word: { slug: 'CITES', name: 'cites', wordTypes: ['word', 'relationshipType'] }, relationshipType: { slug: 'CITES', alias: 'CITES', name: 'cites', category: 'custom', nodeFromType: 'node', nodeToType: 'node' } })]]);
  F.wire(state, A(39999, 'relationship-type-superset'), 'HAS_ELEMENT', addressOf(cites));
  return { letters, header: (slug) => A(39998, slug), superset: (slug) => A(39999, `${slug}-superset`) };
}

/** Firmware alone, for a suite whose caller makes the rest (the agent's): → { state, ownEvents }. */
function firmwareOnly() {
  const state = F.emptyGraph();
  const fw = firmware(state);
  return { state, ownEvents: fw.letters };
}

// ── runs ──
function envFor(dir, { ownerKey = OWNER, env = {} } = {}) {
  const e = F.envFor(dir, { signing: true, ownerKey });
  // The publish policy is read from the environment first (src/api/publish-policy/index.js): nothing of the parent's
  // reaches the child unless a suite gives it.
  e.BRAINSTORM_PUBLISH_LOCAL_ONLY = 'false';
  return { ...e, ...env };
}

/** Store entries in the child's LMDB (TAPESTRY_LMDB_PATH under `dir`) before a run, as propertyGraph.js's storeEntries does. */
function storeEntries(dir, entries) {
  if (!entries || !entries.length) return;
  const script = `
    const store = require(${JSON.stringify(path.join(ROOT, 'src/lib/tapestry-store.js'))});
    (async () => { for (const [k, v] of ${JSON.stringify(entries)}) await store.put(k, v); store.close(); process.stdout.write('STORED'); })()
      .catch((e) => { process.stderr.write(String(e && e.stack || e)); process.exit(1); });`;
  const r = spawnSync(process.execPath, ['-e', script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 60000 });
  if (!String(r.stdout).includes('STORED')) throw new Error(`the LMDB entries weren't stored: ${(r.stderr || '').slice(-400)}`);
}

/**
 * One harness run of export nostr's world: the Cypher engine over the graph, the fake relays and DNS, the fake strfry
 * import into the instance's own relay, and the assistant's key (assistantKeys: 'ta', the default; null for none).
 * `ownEvents` are the letters the instance's own relay holds (relays[OWN_RELAY] may say more about it).
 */
function runExport({
  state = null, file = null, fixture = null, ownEvents = [], relays = {}, dns = DNS, live = {}, timing = {}, exportTiming = {},
  strfry = { mode: 'ok' }, lmdb = [], env = {}, requests = [], cli = [], assistantKeys = 'ta', ownerKey = OWNER, spy = true,
  label = 'export-nostr', check = true,
} = {}) {
  const dir = file ? path.dirname(file) : S.tmp(`${label}-`);
  const stateFile = file || path.join(dir, 'graph.json');
  if (state) CG.writeState(stateFile, state);
  else if (!fs.existsSync(stateFile)) CG.writeState(stateFile, F.emptyGraph());
  const own = relays[OWN_RELAY] || {};
  const allRelays = { ...relays, [OWN_RELAY]: { ...own, events: [...copy(ownEvents), ...(own.events || [])] } };
  const fixtureFile = fixture || path.join(dir, `relays-${crypto.randomUUID()}.json`);
  R.writeFixture(fixtureFile, { relays: allRelays, dns, live, timing, strfry, exportTiming }, { keep: !!fixture });
  storeEntries(dir, lmdb);
  const spec = {
    spy,
    owner: ownerKey,
    ...(assistantKeys === 'ta' ? { assistantKeys: { privkey: TA_SECRET } } : { assistantKeys }),
    scenarios: [{ graphFake: { stateFile, engine: 'cypher' }, relayFake: { file: fixtureFile }, strfry: { file: fixtureFile }, requests, cli }],
  };
  const r = S.runHarness(spec, { dir, env: envFor(dir, { ownerKey, env }) });
  const rest = {
    file: stateFile, fixture: fixtureFile, dir, raw: r,
    state: () => CG.readState(stateFile),
    log: () => R.readLog(fixtureFile),
    store: (url = OWN_RELAY) => R.storedAt(fixtureFile, url),
  };
  return check ? { ...S.answered(r), ...rest } : { ...rest, answered: () => S.answered(r) };
}

/**
 * One of today's importers, run stack-free in a child (test/helpers/todaysImportersChild.js) over a copy of `state`,
 * strfry holding `strfry` (a list of events): → { error, answer, log, state() , strfry() }. `run` is the child's
 * { handler, … }; the child's environment is the export runs', the assistant KEYS.ta and the owner KEYS.ownerSigner.
 */
function runTodays(state, run, { strfry = [], ownerKey = OWNER, label = 'export-nostr-todays' } = {}) {
  const dir = S.tmp(`${label}-`);
  const spec = {
    root: ROOT,
    state: path.join(dir, 'graph.json'),
    strfry: path.join(dir, 'strfry.json'),
    log: path.join(dir, 'log.jsonl'),
    bin: path.join(dir, 'bin'),
    run,
  };
  CG.writeState(spec.state, { ...copy(state), failures: {}, log: [] });
  fs.writeFileSync(spec.strfry, JSON.stringify(copy(strfry)));
  fs.writeFileSync(spec.log, '');
  const specFile = path.join(dir, 'spec.json');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(specFile, JSON.stringify(spec));
  const child = spawnSync(process.execPath, [path.join(ROOT, 'test/helpers/todaysImportersChild.js'), specFile, outFile], { cwd: ROOT, encoding: 'utf8', env: envFor(dir, { ownerKey }), timeout: 90000, maxBuffer: 64 * 1024 * 1024 });
  let out = null;
  try { out = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported below */ }
  assert(out, `today's importers child wrote no result: exit ${child.status}; ${(child.stderr || '').split(NL).slice(-8).join(' | ')}`);
  return { ...out, stderr: child.stderr, state: () => CG.readState(spec.state), strfry: () => JSON.parse(fs.readFileSync(spec.strfry, 'utf8')) };
}

/** The graph operations alone, over the graph in `file`, on the Cypher engine: graphOpsSuite's answered. */
function runOps(file, requests, { ownerKey = OWNER, cli = [] } = {}) {
  const dir = path.dirname(file);
  const spec = { owner: ownerKey, scenarios: [{ graphFake: { stateFile: file, engine: 'cypher' }, requests, cli }] };
  return S.answered(S.runHarness(spec, { dir, env: envFor(dir, { ownerKey }) }));
}

const exp = (id, caller, body, extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body, ...extra });
const op = (id, name, body, caller = 'owner') => ({ id, method: 'POST', url: `/api/tapestry/graph/${name}`, caller, body });
const history = (id, query, caller = 'owner') => ({ id, method: 'GET', url: `/api/tapestry/graph/history?${query}&limit=200`, caller });

/** The answer's data, asserting 200 and success. */
function data(a, id) {
  const r = a.req(id);
  assert(r.status === 200 && r.body && r.body.success === true, `${id} answers 200 with success; got ${r.status} ${show(r.body).slice(0, 900)}`);
  return r.body.data;
}
/** The refusal's body, asserting its status and code. */
function refused(a, id, status, code) {
  const r = a.req(id);
  assert(r.status === status && r.body && r.body.success === false && r.body.code === code, `${id} is refused ${status} ${code}; got ${r.status} ${show(r.body).slice(0, 600)}`);
  return r.body;
}

// ── the world ──
/** An operation's answer, which the setup needs: its data, or a failure naming the step (never the feature). */
function setupData(a, id, what) {
  const r = a.req(id);
  if (!(r.status === 200 && r.body && r.body.success === true)) throw new Error(`the export suites' setup failed at ${what} (${id}), which is test/helpers/exportFixtures.js's, not the feature's: ${r.status} ${show(r.body).slice(0, 700)}`);
  return r.body.data;
}

/** A node made here, in `state`, through _eventless.js's makeNode, with no author when `author` is null. */
async function eventlessNode(state, { uuid, kind = 39999, labels = ['ListItem'], name, tags, author = TA }) {
  const { makeNode } = require(path.join(ROOT, 'src/operations/catalog/graph/_eventless.js'));
  const tx = { run: async (c, p) => E.run(state, c, p), read: async (c, p) => E.run(state, c, p).rows };
  const key = await makeNode(tx, { uuid, kind, labels, name, tags, pubkey: author || TA, createdAt: 1700000000 });
  if (author === null) E.run(state, 'MATCH (n:TapestryNode {tapestryKey: $key}) REMOVE n.pubkey', { key });
  return key;
}

/** An event as today's builder imports it, whatever its signature: a node another author's key, the admin's, holds. */
function unsigned(pubkey, { kind = 39999, at = 1690000900, tags = [], content = '' }) {
  const e = { kind, created_at: at, tags, content, pubkey };
  e.id = NT.getEventHash(e);
  e.sig = 'ab'.repeat(64);
  return e;
}

let WORLD = null;
/** The world (see the header), built once a process; each caller copies world().state before changing it. */
function world() {
  if (!WORLD) WORLD = buildWorld().catch((e) => { WORLD = null; throw e; });
  return WORLD;
}

async function buildWorld() {
  const ta = KEYS.ta, al = KEYS.alice;
  const state = F.emptyGraph();
  const ownEvents = [];
  const keys = {};
  const addr = {};
  const letters = {};

  // Firmware, and the assistant's concept dog as today's routes leave it.
  const fw = firmware(state);
  ownEvents.push(...fw.letters);
  const dog = F.ownConcept(state, { key: ta, slug: 'dog' });
  ownEvents.push(...Object.values(dog.letters));
  Object.assign(addr, { dogHeader: dog.addr.header, dogSuperset: dog.addr.superset, dogSet: dog.addr.set, dogRex: dog.addr.element, dogMadeHere: dog.addr.madeHere, dogConceptGraph: dog.addr.conceptGraph });

  // alice's kind 1 note (a node of another kind; an nevent's target) and her concept cat.
  const aliceNote = F.letter(al, { kind: 1, at: 1690000500, tags: [['t', 'dogs']], content: 'a note about dogs' });
  F.today(state, aliceNote);
  letters.aliceNote = aliceNote;
  // The assistant's own kind 1 note: a node of the instance's own whose kind no graph node takes (other-kind, EL8).
  const taNote = F.letter(ta, { kind: 1, at: 1690000501, tags: [['t', 'pets']], content: 'the assistant\'s note' });
  F.today(state, taNote);
  ownEvents.push(taNote);
  letters.taNote = taNote;
  const cat = F.conceptLetters(al, 'cat', { at: 1690000700 });
  for (const e of cat.all) F.today(state, e);
  F.label(state, cat.addr.header, ['ConceptHeader']);
  F.label(state, cat.addr.superset, ['Superset']);
  for (const [f, t, to] of F.wiringOf(cat)) F.wire(state, f, t, to);
  Object.assign(addr, { catHeader: cat.addr.header, catSuperset: cat.addr.superset });

  // Four more of today's letters in dog.
  const dogWord = (d, name, extra = {}) => ({ word: { slug: d, name, wordTypes: ['word', 'dog'] }, dog: { name, ...extra } });
  const note = F.letter(ta, { kind: 39999, at: 1690000600, tags: [['d', 'dog-note'], ['name', 'Dog Note'], ['z', dog.addr.header], ['e', aliceNote.id, PEER, 'mention', al.pubkey], ['json', JSON.stringify(dogWord('dog-note', 'Dog Note'))]] });
  const big = { json: crypto.randomUUID(), description: crypto.randomUUID(), missing: crypto.randomUUID() };
  const bigLetter = F.letter(ta, { kind: 39999, at: 1690000601, tags: [['d', 'dog-big'], ['name', 'Big Dog'], ['z', dog.addr.header], ['description', `lmdb:${big.description}`], ['summary', `lmdb:${big.missing}`], ['json', `lmdb:${big.json}`]] });
  const goneKey = crypto.randomUUID();
  const gone = F.letter(ta, { kind: 39999, at: 1690000602, tags: [['d', 'dog-gone'], ['name', 'Gone Dog'], ['z', dog.addr.header], ['json', `lmdb:${goneKey}`]] });
  const context = F.letter(ta, { kind: 39999, at: 1690000603, tags: [['d', 'dog-context'], ['name', 'Context Dog'], ['z', dog.addr.header], ['json', JSON.stringify({ ...dogWord('dog-context', 'Context Dog'), graphContext: { local: 'only here', conceptKeys: ['dog'] } })]] });
  // Its a tag names an address of the assistant's that no node holds: today's builder makes a placeholder there, which
  // carries the assistant's key and is still never in a scope (AC4).
  const pointer = F.letter(ta, { kind: 39999, at: 1690000604, tags: [['d', 'dog-pointer'], ['name', 'Pointer Dog'], ['z', dog.addr.header], ['a', `39999:${TA}:not-made-yet`]] });
  for (const e of [note, bigLetter, gone, context, pointer]) { F.today(state, e); F.wire(state, dog.addr.superset, 'HAS_ELEMENT', addressOf(e)); ownEvents.push(e); }
  Object.assign(letters, { note, big: bigLetter, gone, context, pointer });
  Object.assign(addr, { dogNote: addressOf(note), dogBig: addressOf(bigLetter), dogGone: addressOf(gone), dogContext: addressOf(context), dogPointer: addressOf(pointer), placeholder: `39999:${TA}:not-made-yet` });
  Object.assign(addr, { dogSchema: dog.addr.schema, dogPrimaryProperty: dog.addr.primaryProperty, dogProperties: dog.addr.properties, dogPropertyTreeGraph: dog.addr.propertyTreeGraph, dogCoreNodesGraph: dog.addr.coreNodesGraph });

  // bird, today's concept whose header points (b) at alice's cat and bob's fish, and inherits from carol's lizard; its
  // header's letter isn't in the own relay, so the export signs it again. polly, today's element of bird, already
  // carries cat's stamp.
  const bird = F.conceptLetters(ta, 'bird', { at: 1690000800 });
  const pointers = [['b', addr.catHeader, 'pointer'], ['b', `39998:${KEYS.bob.pubkey}:fish`], ['b', `39998:${KEYS.carol.pubkey}:lizard`, 'inherit']];
  const birdHeader = F.letter(ta, { kind: 39998, at: 1690000800, tags: [...bird.letters.header.tags.filter((t) => t[0] !== 'json'), ...pointers, bird.letters.header.tags.find((t) => t[0] === 'json')] });
  for (const e of [birdHeader, ...bird.all.filter((e) => e !== bird.letters.header)]) F.today(state, e);
  ownEvents.push(...bird.all.filter((e) => e !== bird.letters.header));
  F.label(state, bird.addr.header, ['ConceptHeader']);
  F.label(state, bird.addr.superset, ['Superset']);
  F.label(state, bird.addr.schema, ['JSONSchema']);
  F.label(state, bird.addr.primaryProperty, ['Property']);
  F.label(state, bird.addr.properties, ['Set']);
  for (const [f, t, to] of F.wiringOf(bird)) F.wire(state, f, t, to);
  const polly = F.letter(ta, { kind: 39999, at: 1690000801, tags: [['d', 'bird-polly'], ['name', 'Polly'], ['z', bird.addr.header], ['z', addr.catHeader], ['json', JSON.stringify({ word: { slug: 'bird-polly', name: 'Polly', wordTypes: ['word', 'bird'] }, bird: { name: 'Polly' } })]] });
  F.today(state, polly);
  F.wire(state, bird.addr.superset, 'HAS_ELEMENT', addressOf(polly));
  ownEvents.push(polly);
  Object.assign(letters, { birdHeader, polly });
  Object.assign(addr, { birdHeader: bird.addr.header, birdSuperset: bird.addr.superset, polly: addressOf(polly), fishHeader: `39998:${KEYS.bob.pubkey}:fish`, lizardHeader: `39998:${KEYS.carol.pubkey}:lizard` });

  // An admin's node and the owner's, each as today's builder imports a letter; and two nodes with no author.
  const adminNode = unsigned(S.ADMIN, { tags: [['d', 'admins-note'], ['name', 'The Admin\'s Note']] });
  F.today(state, adminNode);
  const ownerNode = F.letter(KEYS.ownerSigner, { kind: 39999, at: 1690000901, tags: [['d', 'owners-note'], ['name', 'The Owner\'s Note']] });
  F.today(state, ownerNode);
  ownEvents.push(ownerNode);
  Object.assign(letters, { adminNode, ownerNode });
  Object.assign(addr, { adminNode: addressOf(adminNode), ownerNode: addressOf(ownerNode) });
  addr.noAuthor = `39999:${TA}:no-author-here`;
  keys.noAuthor = await eventlessNode(state, { uuid: addr.noAuthor, name: 'No Author', tags: [['d', 'no-author-here'], ['name', 'No Author']], author: null });
  const nowhereId = crypto.createHash('sha256').update('export-nostr-suite: nowhere').digest('hex');
  E.run(state, `CREATE (n:NostrEvent:ListItem:TapestryNode {id: $id, kind: 39999, created_at: 1690000950, name: 'Nowhere', tapestryValue: 'Nowhere'})
    SET n.tapestryKey = randomUUID()`, { id: nowhereId });
  keys.nowhere = F.withId(state, nowhereId)[0].props.tapestryKey;
  addr.nowhereId = nowhereId;

  // pet, by the real graph operations, on the Cypher engine.
  const dir = S.tmp('export-nostr-world-');
  const file = path.join(dir, 'graph.json');
  CG.writeState(file, state);
  const k = (uuid) => { const n = F.nodesAt(CG.readState(file), uuid)[0]; if (!n) throw new Error(`the export suites' setup found no node at ${uuid}`); return n.props.tapestryKey; };
  keys.catSuperset = k(addr.catSuperset);

  let a = runOps(file, [
    op('pet', 'create-concept', { name: 'pet', plural: 'pets', description: 'An animal kept at home.' }),
    op('animal', 'create-concept', { name: 'animal', plural: 'animals' }),
  ]);
  const pet = setupData(a, 'pet', 'graph create-concept').concept;
  const animal = setupData(a, 'animal', 'graph create-concept').concept;
  for (const [role, key] of Object.entries(pet.nodes)) keys[`pet${role[0].toUpperCase()}${role.slice(1)}`] = key;
  keys.petHeader = pet.conceptHeader;
  keys.animalHeader = animal.conceptHeader;
  keys.animalSuperset = animal.nodes.superset;

  a = runOps(file, [
    op('lap', 'create-set', { parent: keys.petSuperset, name: 'Lap Pets', description: 'small ones' }),
    op('walkers', 'create-set', { parent: keys.petSuperset, name: 'Walkers' }),
    op('strays', 'create-set', { parent: keys.petSuperset, name: 'Strays' }),
    op('under-animal', 'link-set', { set: keys.petSuperset, parent: keys.animalSuperset }),
  ]);
  keys.lapPets = setupData(a, 'lap', 'graph create-set').set.tapestryKey;
  keys.walkers = setupData(a, 'walkers', 'graph create-set').set.tapestryKey;
  keys.strays = setupData(a, 'strays', 'graph create-set').set.tapestryKey;
  setupData(a, 'under-animal', 'graph link-set');

  a = runOps(file, [
    op('rex', 'create-element', { concept: keys.petHeader, name: 'Rex', set: keys.lapPets, fields: { description: 'a good dog' } }),
    op('tom', 'create-element', { concept: keys.petHeader, name: 'Tom', fields: { description: 'a cat' } }),
    op('fido', 'create-element', { concept: keys.petHeader, name: 'Fido', fields: { description: 'a loyal one' } }),
    op('walkers-under-lap', 'link-set', { set: keys.walkers, parent: keys.lapPets }),
    op('strays-under-cat', 'link-set', { set: keys.strays, parent: keys.catSuperset }),
  ]);
  keys.rex = setupData(a, 'rex', 'graph create-element').element.tapestryKey;
  keys.tom = setupData(a, 'tom', 'graph create-element').element.tapestryKey;
  keys.fido = setupData(a, 'fido', 'graph create-element').element.tapestryKey;
  setupData(a, 'walkers-under-lap', 'graph link-set');
  setupData(a, 'strays-under-cat', 'graph link-set');

  a = runOps(file, [
    op('walkers-off', 'unlink-set', { set: keys.walkers, parent: keys.petSuperset }),
    op('cites', 'add-relationship', { from: keys.rex, type: 'CITES', to: keys.tom }),
    op('tom-link', 'update-node', { node: keys.tom, concept: keys.petHeader, fields: { description: `a cat, who follows [Rex](tapestry:${keys.rex}) about` } }),
    op('friend', 'add-property', { concept: keys.petHeader, name: 'friend', type: 'string', description: 'a friend of theirs' }),
  ]);
  setupData(a, 'walkers-off', 'graph unlink-set');
  setupData(a, 'cites', 'graph add-relationship');
  setupData(a, 'tom-link', 'graph update-node');
  keys.friend = setupData(a, 'friend', 'graph add-property').property.property;

  keys.birdHeader = k(addr.birdHeader);
  a = runOps(file, [
    op('enumerate', 'enumerate', { property: keys.friend, source: keys.petHeader }),
    op('tweety', 'create-element', { concept: keys.birdHeader, name: 'Tweety' }),
  ]);
  setupData(a, 'enumerate', 'graph enumerate');
  keys.tweety = setupData(a, 'tweety', 'graph create-element in bird').element.tapestryKey;

  // The rest, now that every key they name exists.
  keys.dogHeader = k(addr.dogHeader);
  keys.aliceNote = F.withId(CG.readState(file), aliceNote.id)[0].props.tapestryKey;
  keys.taNote = F.withId(CG.readState(file), taNote.id)[0].props.tapestryKey;
  const ghost = crypto.randomUUID();
  keys.ghost = ghost;
  const linkerText = `see [the dog concept](tapestry:${keys.dogHeader}), [Rex](tapestry:${keys.rex}), [a note](tapestry:${keys.aliceNote}), [Walkers](tapestry:${keys.walkers}) and [a ghost](tapestry:${ghost})`;
  const listed = (pairs) => ({ nodes: pairs.map(([slug, uuid]) => ({ slug, uuid })), relationshipTypes: [], relationships: [], imports: [] });
  const uuidOfKey = (key) => CG.readState(file).nodes.find((n) => n.props.tapestryKey === key).props.uuid;
  const graphHeader = k(fw.header('graph'));
  a = runOps(file, [
    op('tom-friend', 'update-node', { node: keys.tom, concept: keys.petHeader, fields: { friend: `tapestry:${keys.rex}` } }),
    op('spot', 'create-element', { concept: keys.petHeader, name: 'Spot', fields: { description: 'a spotted one', friend: `tapestry:${keys.fido}` } }),
    op('linker', 'create-element', { concept: keys.petHeader, name: 'Linker', fields: { description: linkerText } }),
    op('picks', 'create-element', { concept: graphHeader, name: 'Pet Picks', fields: listed([['rex', uuidOfKey(keys.rex)], ['tom', uuidOfKey(keys.tom)]]) }),
    op('carry', 'create-element', { concept: graphHeader, name: 'Carried Or Not', fields: listed([['pets', uuidOfKey(keys.petSuperset)], ['friend', uuidOfKey(keys.friend)], ['rex', uuidOfKey(keys.rex)], ['tom', uuidOfKey(keys.tom)]]) }),
    op('others', 'create-element', { concept: graphHeader, name: 'Other Peoples', fields: listed([['cat', addr.catHeader], ['admins', addr.adminNode], ['owners', addr.ownerNode], ['note', taNote.id], ['nowhere', nowhereId], ['rex', uuidOfKey(keys.rex)]]) }),
    op('missing', 'create-element', { concept: graphHeader, name: 'Missing Ones', fields: listed([['rex', uuidOfKey(keys.rex)], ['nobody', `39999:${TA}:nobody-here`], ['no-event', 'ee'.repeat(32)]]) }),
  ]);
  setupData(a, 'tom-friend', 'graph update-node');
  keys.spot = setupData(a, 'spot', 'graph create-element').element.tapestryKey;
  keys.linker = setupData(a, 'linker', 'graph create-element').element.tapestryKey;
  keys.picks = setupData(a, 'picks', 'graph create-element in the graph concept').element.tapestryKey;
  keys.carry = setupData(a, 'carry', 'graph create-element in the graph concept').element.tapestryKey;
  keys.others = setupData(a, 'others', 'graph create-element in the graph concept').element.tapestryKey;
  keys.missing = setupData(a, 'missing', 'graph create-element in the graph concept').element.tapestryKey;
  a = runOps(file, [
    op('linked', 'create-element', { concept: graphHeader, name: 'Linked Ones', fields: listed([['linker', uuidOfKey(keys.linker)], ['rex', uuidOfKey(keys.rex)]]) }),
    op('empty', 'create-element', { concept: graphHeader, name: 'Empty Graph', fields: listed([]) }),
  ]);
  keys.linked = setupData(a, 'linked', 'graph create-element in the graph concept').element.tapestryKey;
  keys.emptyGraph = setupData(a, 'empty', 'graph create-element in the graph concept').element.tapestryKey;
  // The fields add-property and its catch-up made, which pet's property tree graph lists.
  for (const [name, field] of [['propName', 'name'], ['propSlug', 'slug'], ['propDescription', 'description']]) {
    const n = CG.readState(file).nodes.find((x) => x.labels.includes('Property') && new RegExp(`^39999:${TA}:${field}-`).test(String(x.props.uuid)));
    if (!n) throw new Error(`the export suites' setup found no ${field} property of pet`);
    keys[name] = n.props.tapestryKey;
  }

  // The Tapestry, as today's Tapestries UI publishes one, now that pet's concept graph and Rex exist.
  const after = CG.readState(file);
  const petHeaderUuid = uuidOfKey(keys.petHeader);
  const petConceptGraphUuid = uuidOfKey(keys.petConceptGraph);
  const tapestryJson = {
    word: { slug: 'pets-and-dogs', name: 'Pets and Dogs', wordTypes: ['word'] },
    tapestry: { slug: 'pets-and-dogs', title: 'Pets and Dogs', description: `pets, and [Rex](tapestry:${keys.rex}) among them` },
    graph: {
      graphType: 'tapestry',
      nodes: [{ slug: 'concept-header-for-the-concept-of-pets', uuid: petHeaderUuid, name: 'pet' }, { slug: 'concept-header-for-the-concept-of-dogs', uuid: addr.dogHeader, name: 'dog' }],
      relationshipTypes: [],
      relationships: [],
      imports: [{ slug: 'concept-graph-for-pet', uuid: petConceptGraphUuid }, { slug: 'concept-graph-for-dog', uuid: addr.dogConceptGraph }],
    },
  };
  const tapestry = F.letter(ta, { kind: 39999, at: 1690001000, tags: [['d', 'tapestry-pets-and-dogs-1'], ['name', 'Pets and Dogs'], ['z', fw.header('tapestry')], ['json', JSON.stringify(tapestryJson)]] });
  F.today(after, tapestry);
  F.wire(after, fw.superset('tapestry'), 'HAS_ELEMENT', addressOf(tapestry));
  ownEvents.push(tapestry);
  letters.tapestry = tapestry;
  addr.tapestry = addressOf(tapestry);

  // Every key by name, from the graph as it ends.
  const byUuid = (uuid) => { const n = F.nodesAt(after, uuid)[0]; if (!n) throw new Error(`the export suites' setup found no node at ${uuid}`); return n.props.tapestryKey; };
  for (const name of ['dogSuperset', 'dogSet', 'dogRex', 'dogMadeHere', 'dogConceptGraph', 'dogNote', 'dogBig', 'dogGone', 'dogContext', 'dogPointer', 'placeholder',
    'dogSchema', 'dogPrimaryProperty', 'dogProperties', 'dogPropertyTreeGraph', 'dogCoreNodesGraph', 'catHeader', 'adminNode', 'ownerNode', 'tapestry', 'birdSuperset', 'polly']) keys[name] = byUuid(addr[name]);
  for (const slug of ['graph', 'tapestry', 'set', 'word']) { keys[`fw_${slug}`] = byUuid(fw.header(slug)); keys[`fw_${slug}Superset`] = byUuid(fw.superset(slug)); }
  for (const name of Object.keys(keys)) {
    if (addr[name]) continue;
    const n = after.nodes.find((x) => x.props.tapestryKey === keys[name]);
    if (n && n.props.uuid) addr[name] = n.props.uuid;
  }

  // The store: big's json and description, a stale copy of Rex's JSON under Rex's key (the derived copy that lags).
  const rexJson = jsonOf(after, keys.rex);
  const lmdb = [
    [big.json, { word: { slug: 'dog-big', name: 'Big Dog', wordTypes: ['word', 'dog'] }, dog: { name: 'Big Dog', description: `bigger than [Rex](tapestry:${keys.rex})` }, graphContext: { local: 'only here' } }],
    [big.description, `a big one, like [Rex](tapestry:${keys.rex})`],
    [keys.rex, { ...rexJson, pet: { ...rexJson.pet, description: 'A STALE COPY, which the letter must never carry' }, graphContext: { local: 'only here' } }],
  ];
  keys.bigJson = big.json; keys.bigDescription = big.description; keys.bigMissing = big.missing; keys.goneJson = goneKey;

  return { state: after, lmdb, ownEvents, keys, addr, letters, fw: { header: fw.header, superset: fw.superset } };
}

// ── answers ──
const lettersOf = (d) => (d && Array.isArray(d.letters) ? d.letters : []);
const keyOf = (l) => (l ? (typeof l.node === 'string' ? l.node : l.tapestryKey) || null : null);
const letterFor = (d, key) => lettersOf(d).find((l) => keyOf(l) === key) || null;
const isOwnRelay = (name) => name === 'own' || R.normalize(name) === R.normalize(OWN_RELAY);
/** That relay's answer for a letter: { relay, status, reason }, or null. */
function relayOf(l, relay) {
  const list = l && Array.isArray(l.relays) ? l.relays : [];
  return list.find((x) => x && (relay === 'own' ? isOwnRelay(x.relay) : R.normalize(x.relay) === R.normalize(relay))) || null;
}
const codeOf = (r) => (r ? r.report || r.code || r.kind || r.type || null : null);
const reportsOf = (d, code) => (d && Array.isArray(d.reports) ? d.reports : []).filter((r) => !code || codeOf(r) === code);
const camel = (s) => s.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
function countOf(d, outcome) {
  const c = (d && d.counts) || {};
  return c[outcome] !== undefined ? c[outcome] : c[camel(outcome)];
}
const mentions = (x, s) => JSON.stringify(x).includes(s);

// ── readers ──
const live = F.live;
const nodeByKey = (s, key) => s.nodes.find((n) => n.props.tapestryKey === key) || null;
const at = (s, uuid) => F.nodesAt(s, uuid)[0] || null;
/** A node's tags as an event holds them, from its tag nodes: [type, value, value1…], none missing in between. */
function tagArrays(s, node) {
  return F.tagsOf(s, node).map((t) => {
    const out = [t.props.type, t.props.value, t.props.value1, t.props.value2, t.props.value3, t.props.value4];
    while (out.length && (out[out.length - 1] === null || out[out.length - 1] === undefined)) out.pop();
    return out.map((x) => (x === null || x === undefined ? '' : String(x)));
  });
}
function jsonOf(s, key) {
  const n = typeof key === 'string' ? nodeByKey(s, key) : key;
  const t = n ? F.tagsOf(s, n).find((x) => x.props.type === 'json') : null;
  if (!t) return null;
  try { return JSON.parse(t.props.value); } catch { return null; }
}
const sentToOf = (s, key) => { const n = nodeByKey(s, key); return n ? n.props.sentTo : undefined; };
/** A stored property as a plain value: an integer the engine keeps as { $int } (a neo4j.int parameter) as a number. */
const plain = (v) => E.plainValue(v);
const signings = (spy) => (Array.isArray(spy) ? spy : []).filter((x) => /finalizeEvent|signAndFinalize/.test(x)).length;
/** A tag list in a fixed order, for comparing two as multisets. */
const sortedTags = (tags) => [...tags].map((t) => JSON.stringify(t)).sort();
const sameTags = (a, b) => JSON.stringify(sortedTags(a)) === JSON.stringify(sortedTags(b));
/** The newest event at an address, or with an id, in a list of events. */
function letterAt(events, address) {
  const hits = (events || []).filter((e) => e && (addressOf(e) === address || e.id === address));
  return hits.sort(R.newestFirst)[0] || null;
}
/** The addresses and ids a letter names, through its z, n, s, a, e, nodeFrom and nodeTo tags and its graph's lists. */
function namesIn(e) {
  const out = new Set();
  for (const t of e.tags || []) if (['z', 'n', 's', 'a', 'e', 'nodeFrom', 'nodeTo', 'concept-graph'].includes(t[0]) && typeof t[1] === 'string') out.add(t[1]);
  const j = (e.tags || []).find((t) => t[0] === 'json');
  let json = null;
  try { json = j ? JSON.parse(j[1]) : null; } catch { json = null; }
  const g = json && json.graph && typeof json.graph === 'object' ? json.graph : null;
  for (const list of g ? [g.nodes, g.imports] : []) for (const x of Array.isArray(list) ? list : []) if (x && typeof x.uuid === 'string') out.add(x.uuid);
  return out;
}
/** nip19's decode of `nostr:<bech32>` or `<bech32>`, or null. */
function decodeNip19(s) {
  try { return NT.nip19.decode(String(s).replace(/^nostr:/, '')); } catch { return null; }
}
/** Every string anywhere in a value, for "no letter carries tapestry:". */
function strings(x, out = []) {
  if (typeof x === 'string') out.push(x);
  else if (Array.isArray(x)) for (const y of x) strings(y, out);
  else if (x && typeof x === 'object') for (const y of Object.values(x)) strings(y, out);
  return out;
}
/** A letter's json tag, parsed (null when it has none, or it doesn't parse). */
function letterJson(e) {
  const t = e && (e.tags || []).find((x) => x[0] === 'json');
  try { return t ? JSON.parse(t[1]) : null; } catch { return null; }
}
const entriesOf = (s) => S.entriesOf(s);
const exportEntries = (s) => entriesOf(s).filter((e) => e.operation === 'export nostr');

/**
 * What a concept graph's scope brings (ADR Decision 2): its graphs' nodes and imports, and the concept's header, core
 * nodes and class thread. pet's: its eight core nodes, the four fields its property tree graph lists, its three sets
 * and its five elements. dog's: its eight, its set, Rex, the node made here and today's five letters in it.
 */
const petScope = (k) => [k.petHeader, k.petSuperset, k.petJsonSchema, k.petPrimaryProperty, k.petProperties, k.petPropertyTreeGraph, k.petConceptGraph, k.petCoreNodesGraph,
  k.propName, k.propSlug, k.propDescription, k.friend, k.lapPets, k.walkers, k.strays, k.rex, k.tom, k.fido, k.spot, k.linker];
const dogScope = (k) => [k.dogHeader, k.dogSuperset, k.dogSchema, k.dogPrimaryProperty, k.dogProperties, k.dogPropertyTreeGraph, k.dogConceptGraph, k.dogCoreNodesGraph,
  k.dogSet, k.dogRex, k.dogMadeHere, k.dogNote, k.dogBig, k.dogGone, k.dogContext, k.dogPointer];
const sameSet = (a, b) => JSON.stringify([...new Set(a)].sort()) === JSON.stringify([...new Set(b)].sort());

/** The own nodes `everything` names (ADR Decision 2): factsOf's own, kind 39998 or 39999, with an address. */
function everythingIn(s, { own = [TA, OWNER] } = {}) {
  return live(s).filter((n) => {
    if (n.labels.includes('NostrUser') || n.labels.includes('NostrEventTag')) return false;
    if (F.isPlaceholder(n)) return false;
    const kind = Number(n.props.kind && n.props.kind.$int !== undefined ? n.props.kind.$int : n.props.kind);
    if (kind !== 39998 && kind !== 39999) return false;
    if (typeof n.props.uuid !== 'string' || !n.props.uuid) return false;
    const author = typeof n.props.pubkey === 'string' && n.props.pubkey ? n.props.pubkey : null;
    return author === null || own.includes(author);
  }).map((n) => n.props.tapestryKey);
}

module.exports = {
  ROOT, NL, ROUTE, DECL, SEND, OWN_MODULE, LINKS, OWN_RELAY, PEER, OWNER, TA, TA_SECRET, DNS, URL_OF, KEYS, NT,
  needDecl, copy, addressOf, FIRMWARE, firmware, firmwareOnly, envFor, storeEntries, runExport, runTodays, runOps, exp, op, history,
  data, refused, setupData, eventlessNode, unsigned, world,
  lettersOf, keyOf, letterFor, isOwnRelay, relayOf, codeOf, reportsOf, countOf, mentions,
  nodeByKey, at, tagArrays, jsonOf, sentToOf, plain, signings, sortedTags, sameTags, letterAt, namesIn, decodeNip19, strings, letterJson,
  entriesOf, exportEntries, everythingIn, petScope, dogScope, sameSet,
};
