'use strict';
/**
 * What add-to-concept and remove-from-concept share — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.md (AC5's
 *          readers, AC7's rule, AC9's derive step)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0022-add-to-concept-and-remove-from-concept.md
 *          (Decisions 2, 5, 6, 10–12, 14, 16)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.test-plan.md
 *
 * Stack-free and mostly unit-level. F.overlaySections runs in this process (it is pure). The reads run in a child
 * process with the TA set (S.childEnv), over test/helpers/membershipGraph.js's seed through graphFake's readerOver, as
 * the rule suites run theirs; each case answers { value } or { error }, so a piece that isn't built yet fails its own
 * tests, naming what is missing. The derive step runs in a child with Neo4j, the store and the resolver stubbed in
 * require.cache, as element-schemas' SC9 runs it. update-node's words run through the harness.
 *
 *   MS1  F.overlaySections: whole sections replaced; own keys added to a wordTypes list at its end, sorted; JSON with no
 *        word block, or a wordTypes that isn't a list, left so; a __proto__ key stays an own key; neither input changed
 *   MS2  elementsOf lays the owner's sections over the json tag; a node with sections beside and no json tag reads as
 *        them; a json tag that can't be read is still a problem
 *   MS3  the derive step, then the rule: the rule's check form judges a node's tapestryJson (ADR 0042), so the owner's
 *        sections reach it through deriveWord's overlay. Derived and kept in a store stub, as ADR 0042's SC9 runs it: the
 *        owner's section fits where the letter's has none, and replaces the letter's whole (Amendment 1, item 12)
 *   MS4  deriveWord lays tapestryOwnSections over its base, from the json tag or from a cache entry
 *   MS5  the derive step reads tapestryOwnSections: deriveByKey hands it to the deriver (NODE_FIELDS)
 *   MS6  F.conceptsOfNodes(read, keys, { without }) leaves those relationships out of the walk
 *   MS7  M1 (M.waysIn) and M2 (M.reaches), over the fake
 *   MS8  M.keptIn: json-tag for the instance's own node, beside for every other, firmware's own elements among them
 *   MS9  M.firmwareMemberships: rover's element file, the integer's manifest edge; empty with no key, and not kept
 *   MS10 the rule node-has-a-concept loads: refuses, its one refusal last-concept (409); loading it opens nothing
 *   MS11 its guard form { node, concept, set }: a finding when the call would leave the node in no concept but word,
 *        none for a repeat, a reserved key, a tag or anything apply refuses
 *   MS12 its check form { node }: names each node no concept but word reaches; tags and change entries exempt; person
 *        nodes and placeholders not
 *   MS13 the rulebook's entry 8, in its format
 *   MS14 relationship-type-allowed says HAS_ELEMENT is made and taken out by add-to-concept, remove-from-concept and
 *        create-element
 *   MS15 update-node's not-an-element and no-section name graph add-to-concept, no longer "to come"
 *   MS16 the catalog's two rows say what was built and name the ADR
 *   MS17 changes.js's header says what the membership changes use
 *   MS18 the new modules require nothing that signs
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');

const { ROOT, TA, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: what add-to-concept and remove-from-concept share');

const ADR = 'ADR graph-operations-first-slice/0022';
const FIELDS = path.join(ROOT, 'src/operations/catalog/graph/_fields.js');
const MEMBERSHIPS = 'src/operations/catalog/graph/_memberships.js';
const RULE = 'node-has-a-concept';
const RULE_FILE = `src/operations/rules/${RULE}.js`;
const NOBODY = '00000000-0000-4000-8000-0000000000c4';
const NOSET = '00000000-0000-4000-8000-0000000000d4';

// ── MS1: the overlay, in this process ──
function overlay() {
  const F = require(FIELDS);
  if (typeof F.overlaySections !== 'function') throw new Error(`F.overlaySections does not exist yet in src/operations/catalog/graph/_fields.js (${ADR} Decision 5)`);
  return F.overlaySections;
}

test('MS1 [Decision 5]: F.overlaySections replaces whole sections, adds the keys a wordTypes list lacks at its end, sorted, keeps __proto__ an own key, and changes neither input', () => {
  const overlaySections = overlay();
  const json = { word: { slug: 'dog--rex', wordTypes: ['word', 'dog'] }, dog: { name: 'Rex', breed: 'irishSetter' }, cat: { name: 'Tom' } };
  const own = { dog: { name: 'Rex' }, zebra: { stripes: 3 }, beagle: { name: 'Rex' } };
  const was = { json: show(json), own: show(own) };
  const out = overlaySections(json, own);
  assert(out !== json && show(out.dog) === show({ name: 'Rex' }), `each section in own replaces json's of its key whole: breed is gone; got ${show(out.dog)}`);
  assert(show(out.cat) === show({ name: 'Tom' }) && show(out.zebra) === show({ stripes: 3 }) && show(out.beagle) === show({ name: 'Rex' }), `the others stay, and own's new sections join; got ${show(out)}`);
  assert(show(out.word.wordTypes) === show(['word', 'dog', 'beagle', 'zebra']) && out.word.slug === 'dog--rex', `wordTypes gains the keys of own it lacks, at its end, sorted; got ${show(out.word)}`);
  assert(show(json) === was.json && show(own) === was.own, 'it gives a copy: json and own are as they were');
  const bare = overlaySections({ dog: { name: 'Rex' } }, { beagle: { name: 'Rex' } });
  assert(!('word' in bare) && show(bare.beagle) === show({ name: 'Rex' }), `JSON with no word block gets none; got ${show(bare)}`);
  const text = overlaySections({ word: { wordTypes: 'word' } }, { beagle: {} });
  assert(text.word.wordTypes === 'word', `a wordTypes that isn't a list is left as it is; got ${show(text.word)}`);
  const proto = overlaySections({ dog: {} }, JSON.parse('{"__proto__": {"polluted": true}}'));
  assert(Object.prototype.hasOwnProperty.call(proto, '__proto__') && show(proto.__proto__) === show({ polluted: true }) && Object.getPrototypeOf(proto) === Object.prototype && ({}).polluted === undefined,
    `a key called __proto__ stays an own key, built with Object.fromEntries; got ${show(Object.getOwnPropertyNames(proto))}`);
  const none = overlaySections(json, {});
  assert(none !== json && show(none) === show(json), 'with no sections beside, a copy of json');
});

// ── the reads, in a child over the seed ──
/** Every string a value holds, in its keys and values, Maps and Sets included: what a structure names, whatever its shape. */
const STRINGS = `function strings(x, out = [], depth = 0) {
  if (depth > 8 || out.length > 5000) return out;
  if (typeof x === 'string') { out.push(x); return out; }
  if (x instanceof Map) { for (const [k, v] of x) { strings(k, out, depth + 1); strings(v, out, depth + 1); } return out; }
  if (x instanceof Set || Array.isArray(x)) { for (const v of x) strings(v, out, depth + 1); return out; }
  if (x && typeof x === 'object') { for (const [k, v] of Object.entries(x)) { out.push(k); strings(v, out, depth + 1); } }
  return out;
}`;

function readsChild() {
  const dir = tmp('memberships-shared-');
  const script = path.join(dir, 'child.js');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(script, `'use strict';
const fs = require('fs');
const ROOT = ${JSON.stringify(ROOT)};
const out = { cases: {} };
${STRINGS}
const need = (rel, why) => { const p = ROOT + '/' + rel; if (!fs.existsSync(p)) throw new Error(rel + ' does not exist yet (${ADR} ' + why + ')'); return require(p); };
const fn = (obj, name, rel, why) => { if (!obj || typeof obj[name] !== 'function') throw new Error(name + ' is not in ' + rel + ' yet (${ADR} ' + why + ')'); return obj[name].bind(obj); };
async function c(name, f) { try { out.cases[name] = { value: await f() }; } catch (e) { out.cases[name] = { error: String((e && e.message) || e) }; } }
(async () => {
  try {
    const { readerOver } = require(ROOT + '/test/helpers/graphFake.js');
    const MG = require(ROOT + '/test/helpers/membershipGraph.js');
    const seed = await MG.seedMemberships();
    const k = seed.keys;
    out.keys = Object.fromEntries(Object.entries(k).filter(([, v]) => typeof v === 'string'));
    out.uuids = seed.uuids;
    out.own = { peerItem: null, fwNumber: null, personInPet: null, peerTwoOwn: null };
    for (const n of Object.keys(out.own)) out.own[n] = JSON.parse(seed.state.nodes.find((x) => x.props.tapestryKey === k[n]).props.tapestryOwnSections);
    const read = readerOver(seed.state);
    const F = require(ROOT + '/src/operations/catalog/graph/_fields.js');
    const N = require(ROOT + '/src/operations/catalog/graph/_nodes.js');
    const rules = require(ROOT + '/src/operations/rules');
    const M = () => need(${JSON.stringify(MEMBERSHIPS)}, 'Implementation notes');
    const rule = () => {
      const r = rules.findRule(${JSON.stringify(RULE)});
      if (r) return r;
      const left = rules.loadRules().problems.find((p) => p.file === 'rules/${RULE}.js');
      if (!fs.existsSync(ROOT + '/${RULE_FILE}')) throw new Error('rule ${RULE} isn\\'t loaded: ${RULE_FILE} does not exist yet (${ADR} Decision 12)');
      throw new Error('rule ${RULE} isn\\'t loaded: the rules loader left it out' + (left ? ': ' + left.problem : ''));
    };
    const relOf = async (a, b) => {
      const rows = await read('MATCH (a:TapestryNode {tapestryKey: $a})-[r:HAS_ELEMENT]->(b:TapestryNode {tapestryKey: $b}) RETURN elementId(r) AS id', { a, b });
      if (!rows.length) throw new Error('the seed has no HAS_ELEMENT from ' + a + ' to ' + b);
      return rows[0].id;
    };
    const pairs = (rows) => rows.map((r) => r.key + '>' + r.concept).sort();

    await c('elementsOf', async () => {
      const pet = await F.conceptOf(read, k.pet);
      const els = await F.elementsOf(read, pet, 1000);
      const want = ['peerItem', 'fwNumber', 'personInPet', 'peerGarbled', 'peerTwoOwn', 'whiskers'];
      return Object.fromEntries(els.filter((e) => want.some((n) => k[n] === e.key)).map((e) => [Object.keys(k).find((n) => k[n] === e.key), { json: e.json, problem: e.problem }]));
    });
    await c('without', async () => {
      const cn = (keys, opts) => (opts === undefined ? F.conceptsOfNodes(read, keys) : F.conceptsOfNodes(read, keys, opts));
      return {
        walkerMax: pairs(await cn([k.walkerMax])),
        walkerMaxWithout: pairs(await cn([k.walkerMax], { without: [await relOf(k.walkers, k.walkerMax)] })),
        setItemWithout: pairs(await cn([k.setItem], { without: [await relOf(k.beagleSuperset, k.setItem)] })),
        bothWithout: pairs(await cn([k.setItem, k.walkerMax], { without: [await relOf(k.walkers, k.walkerMax)] })),
        emptyWithout: pairs(await cn([k.walkerMax], { without: [] })),
      };
    });
    await c('waysIn', async () => {
      const waysIn = fn(M(), 'waysIn', ${JSON.stringify(MEMBERSHIPS)}, 'Decision 10, M1');
      const ways = async (anchor, node) => (await waysIn(read, { anchor, node })).map((r) => ({ from: r.from, rel: typeof r.rel }));
      return {
        setItemFromSuperset: await ways(k.beagleSuperset, k.setItem),
        setItemFromSet: await ways(k.showBeagles, k.setItem),
        walkerMaxFromDog: await ways(k.dogSuperset, k.walkerMax),
        roverFromSet: await ways(k.showBeagles, k.rover),
        wordyFromBeagle: await ways(k.beagleSuperset, k.wordy),
      };
    });
    await c('reaches', async () => {
      const reaches = fn(M(), 'reaches', ${JSON.stringify(MEMBERSHIPS)}, 'Decision 10, M2');
      const r = async (concept, anchor) => Boolean(await reaches(read, { concept, anchor }));
      return {
        petWalkers: await r(k.pet, k.walkers), petDog: await r(k.pet, k.dogSuperset), dogGolden: await r(k.dog, k.goldenRetrieverSuperset),
        goldenDog: await r(k.goldenRetriever, k.dogSuperset), beagleCommon: await r(k.beagle, k.commonSet), wordCommon: await r(k.word, k.commonSet),
        beagleOwn: await r(k.beagle, k.beagleSuperset),
      };
    });
    await c('keptIn', async () => {
      const keptIn = fn(M(), 'keptIn', ${JSON.stringify(MEMBERSHIPS)}, 'Decision 2');
      const o = {};
      for (const n of ['whiskers', 'patch', 'ghosty', 'snowy', 'ace', 'drifter', 'personNode', 'placeholder', 'firmwareRover', 'fwInteger']) o[n] = keptIn(await N.whoseNode(read, k[n]));
      return o;
    });
    await c('firmwareMemberships', async () => strings(fn(M(), 'firmwareMemberships', ${JSON.stringify(MEMBERSHIPS)}, 'Decision 11')()));
    await c('rule', async () => { const r = rule(); return { name: r.name, summary: r.summary, refuses: r.refuses, refusals: r.refusals }; });
    await c('guard', async () => {
      const r = rule();
      const g = async (node, concept, set) => r.violations([set === undefined ? { node, concept } : { node, concept, set }], read);
      return {
        twoHome: await g(k.twoHome, k.pet), whiskers: await g(k.whiskers, k.pet), walkerMax: await g(k.walkerMax, k.dog),
        walkerMaxSet: await g(k.walkerMax, k.dog, k.walkers), setItemSet: await g(k.setItem, k.beagle, k.showBeagles),
        commonOnly: await g(k.commonOnly, k.beagle), wordy: await g(k.wordy, k.beagle), repeat: await g(k.lucky, k.pet),
        reserved: await g(k.wordOnly, k.word), noNode: await g(${JSON.stringify(NOBODY)}, k.pet), noConcept: await g(k.whiskers, ${JSON.stringify(NOBODY)}),
        noSet: await g(k.whiskers, k.pet, ${JSON.stringify(NOSET)}), tag: await g(k.luckyJsonTag, k.beagle),
      };
    });
    await c('check', async () => {
      const r = rule();
      const one = async (node) => r.violations([{ node }], read);
      return {
        whiskers: await one(k.whiskers), wordOnly: await one(k.wordOnly), loner: await one(k.loner), personNode: await one(k.personNode),
        placeholder: await one(k.placeholder), tag: await one(k.luckyJsonTag), entry: await one(k.G), nobody: await one(${JSON.stringify(NOBODY)}),
        personInPet: await one(k.personInPet), fwInteger: await one(k.fwInteger), commonOnly: await one(k.commonOnly),
        many: await r.violations([k.whiskers, k.wordOnly, k.loner, k.luckyJsonTag, k.G, k.personInPet, k.commonOnly].map((node) => ({ node })), read),
      };
    });
    await c('reservedType', async () => {
      const r = rules.findRule('relationship-type-allowed');
      return r.violations([{ type: 'HAS_ELEMENT', from: k.beagleSuperset, to: k.lucky }], read);
    });
  } catch (e) { out.error = String((e && e.stack) || e); }
  fs.writeFileSync(${JSON.stringify(outFile)}, JSON.stringify(out));
  process.exit(0);
})();
`);
  const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  if (!fs.existsSync(outFile)) return { error: `the reads' child must answer: ${(child.stderr || '').slice(-600)}` };
  const out = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  if (out.error) return { error: `the reads' child failed: ${out.error.split('\n').slice(0, 3).join(' | ')}` };
  return out;
}
let READS = null;
function reads() {
  if (!READS) READS = readsChild();
  if (READS.error) throw new Error(READS.error);
  return READS;
}
function value(name) {
  const c = reads().cases[name];
  assert(c, `case ${name} ran`);
  if (c.error) throw new Error(c.error);
  return c.value;
}
const key = (n) => reads().keys[n];

test('MS2 [Decision 6, AC5]: elementsOf lays the owner\'s sections over the json tag; sections beside and no json tag read as them; a json tag that can\'t be read is still a problem', () => {
  const e = value('elementsOf');
  const own = reads().own;
  const pi = e.peerItem;
  assert(pi && pi.problem === null && show(pi.json.pet) === show(own.peerItem.pet) && pi.json.beagle && show(pi.json.word.wordTypes) === show(['word', 'beagle', 'pet']),
    `peerItem reads as its letter with the owner's pet section laid over it, pet's key in wordTypes, so a mark's copy comes from that section (AC9); got ${show(pi)}`);
  assert(e.fwNumber && show(e.fwNumber.json.pet) === show(own.fwNumber.pet) && e.fwNumber.json.jsonDataType, `firmware's number reads with the owner's section beside its file's; got ${show(e.fwNumber)}`);
  assert(e.personInPet && e.personInPet.problem === null && show(e.personInPet.json) === show(own.personInPet), `a person with sections beside and no json tag reads as {} with them, not as a problem; got ${show(e.personInPet)}`);
  assert(e.peerTwoOwn && show(e.peerTwoOwn.json.pet) === show(own.peerTwoOwn.pet) && show(e.peerTwoOwn.json.graph) === show(own.peerTwoOwn.graph), `the owner's pet section replaces the author's whole; got ${show(e.peerTwoOwn)}`);
  assert(e.peerGarbled && e.peerGarbled.json === null && typeof e.peerGarbled.problem === 'string', `a json tag that can't be read is still a problem, sections beside or not; got ${show(e.peerGarbled)}`);
  assert(e.whiskers && e.whiskers.json && e.whiskers.json.pet && e.whiskers.problem === null, 'a node of the instance\'s own reads as its json tag, as before');
});

// ── MS3: the derive step, then the rule, as ADR 0042's SC9 runs them ──
/**
 * The rule's check form judges a node's tapestryJson, from the tapestry-store (ADR 0042 Decision 2), so the owner's
 * sections reach it only through the derive step's overlay (ADR 0022 Decision 6; Amendment 1, item 12). The cases come
 * from membershipGraph's seed: each node's letter (its json tag) and its tapestryOwnSections, and pet's schema as today's
 * create-concept made it. A child runs the real deriveWord and the real rule, with Neo4j, the store and the resolver
 * stubbed in require.cache, as element-schemas' SC9 does: the stubbed database answers by the parameters a statement
 * takes, as a graph holding the one node (tapestryKey k) in pet would. Whatever deriveWord builds goes in the store stub,
 * and the rule's { node, concept } check reads it from there.
 */
async function deriveThenJudge() {
  const MG = require('../../helpers/membershipGraph');
  const C = require('../../helpers/conceptGraph');
  const seed = await MG.seedMemberships();
  const s = seed.state;
  const k = seed.keys;
  const nodeOf = (key) => s.nodes.find((n) => n.props.tapestryKey === key);
  const jsonTag = (key) => (C.tags(s, key).find((t) => t.type === 'json') || {}).value;
  const schemaRel = s.rels.find((r) => r.type === 'IS_THE_JSON_SCHEMA_FOR' && r.to === nodeOf(k.pet).eid);
  const petSchema = jsonTag(s.nodes.find((n) => n.eid === schemaRel.from).props.tapestryKey);
  const caseOf = (label, key, { own, json } = {}) => {
    const n = nodeOf(key);
    return { label, uuid: n.props.uuid, name: n.props.name, json: json !== undefined ? json : jsonTag(key), own: own !== undefined ? own : (n.props.tapestryOwnSections || null) };
  };
  const short = JSON.parse(jsonTag(k.peerTwoOwn));
  delete short.pet.description;
  const cases = [
    // Sentinels: they hold today, so a failure below is the overlay's, not the stubs'.
    caseOf('a letter that fits', k.whiskers),
    caseOf('a letter that falls short', k.peerTwoOwn, { own: null, json: JSON.stringify(short) }),
    caseOf('peerItem', k.peerItem),
    caseOf('peerTwoOwn', k.peerTwoOwn),
  ];
  const own = { peerItem: JSON.parse(nodeOf(k.peerItem).props.tapestryOwnSections), peerTwoOwn: JSON.parse(nodeOf(k.peerTwoOwn).props.tapestryOwnSections) };
  const dir = tmp('memberships-derive-judge-');
  const script = path.join(dir, 'child.js');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(script, `'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = ${JSON.stringify(ROOT)};
const out = { cases: {} };
const stub = (rel, exports) => { const f = require.resolve(path.join(ROOT, rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports }; };
let current = null;
const rowsFor = (q, p) => {
  const text = String(q);
  p = p || {};
  if (Array.isArray(p.keys)) return p.keys.flatMap((key) => current.threads.map((c) => ({ concept: c, key })));
  if (typeof p.key === 'string' && /IS_THE_JSON_SCHEMA_FOR/.test(text)) {
    const nodes = current.schemas[p.key] || [];
    const head = { name: current.names[p.key] || p.key, uuid: p.key + '-address' };
    if (!nodes.length) return [{ ...head, schema: null, schemaUuid: null, json: null }];
    return nodes.map((n) => ({ ...head, schema: n.key, schemaUuid: n.uuid, json: n.json }));
  }
  if (typeof p.key === 'string' && /GraphChange/.test(text)) return p.key === current.node.tapestryKey ? [{ name: current.node.name, uuid: current.node.uuid }] : [];
  if (/tag\\.value AS value/.test(text)) return current.json === undefined || current.json === null ? [] : [{ value: current.json }];
  return [];
};
stub('src/lib/neo4j-driver', { runCypher: async (q, p) => rowsFor(q, p), writeCypher: async () => [] });
const mem = new Map();
stub('src/lib/tapestry-store', {
  get: (key) => mem.get(key),
  put: async (key, data, meta) => { const env = { updatedAt: 1, ...(meta || {}), data }; mem.set(key, env); return env; },
  remove: async (key) => mem.delete(key),
});
stub('src/lib/tapestry-resolve', { isLmdbRef: () => false, resolveValue: () => null, resolveDeep: (v) => v });
(async () => {
  try {
    const deriveWord = require(path.join(ROOT, 'src/lib/derivers/word.js'));
    const rule = require(path.join(ROOT, 'src/operations/rules/index.js')).findRule('element-fits-schema');
    if (!rule) throw new Error('the rule element-fits-schema is not loaded');
    const store = require(path.join(ROOT, 'src/lib/tapestry-store'));
    const read = async (q, p) => rowsFor(q, p);
    for (const c of ${JSON.stringify(cases)}) {
      mem.clear();
      current = {
        node: { tapestryKey: 'k', uuid: c.uuid, name: c.name, elementId: 'e', labels: ['NostrEvent', 'ListItem', 'TapestryNode'], ...(c.own ? { tapestryOwnSections: c.own } : {}) },
        json: c.json, threads: ['pc'], schemas: { pc: [{ key: 'psk', uuid: 'ps', json: ${JSON.stringify(petSchema)} }] }, names: { pc: 'pet' },
      };
      const derived = await deriveWord({ ...current.node });
      await store.put('k', derived);
      const found = await rule.violations([{ node: 'k', concept: 'pc' }], read);
      out.cases[c.label] = {
        pet: derived && derived.pet !== undefined ? derived.pet : null,
        findings: found.map((v) => ({ concept: v.concept || null, code: v.code, missing: v.missing === true, message: v.message, problems: (v.problems || []).map((x) => x.message) })),
      };
    }
  } catch (e) { out.error = String((e && e.stack) || e); }
  fs.writeFileSync(${JSON.stringify(outFile)}, JSON.stringify(out));
  process.exit(0);
})();
`);
  const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 120000 });
  let out = null;
  try { out = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported below */ }
  assert(out, `the derive-then-judge child wrote no answer: ${(child.stderr || '').slice(-600)}`);
  assert(!out.error, `the derive-then-judge child failed: ${String(out.error).slice(0, 600)}`);
  return { cases: out.cases, own };
}

test('MS3 [Decision 6, Amendment 1 item 12]: derived, then judged: the rule fits pet through the owner\'s section where the letter has none, and the owner\'s section replaces the letter\'s whole', async () => {
  const { cases, own } = await deriveThenJudge();
  const findingsOf = (label) => { const c = cases[label]; assert(c, `case ${label} ran`); return c.findings; };
  // The plumbing, before the overlay: what deriveWord builds reaches the rule through the store stub, and is judged.
  const fits = findingsOf('a letter that fits');
  assert(show(fits) === show([]), `a letter whose pet section fits, derived and kept, fits pet: the store stub holds what the derive step built, so nothing is missing; got ${show(fits)}`);
  const short = findingsOf('a letter that falls short');
  assert(short.length === 1 && short[0].code === 'invalid-fields' && !short[0].missing && /pet\.description/.test(short[0].message), `a letter whose pet section lacks its description, derived and kept, is one finding naming pet.description; got ${show(short)}`);
  // The overlay.
  const item = findingsOf('peerItem');
  assert(show(item) === show([]) && show(cases.peerItem.pet) === show(own.peerItem.pet),
    `peerItem's letter has no pet section; the owner's, beside it, reaches its tapestryJson through deriveWord's overlay, which the rule judges: it fits pet (Decision 6); got ${show(item)}, the derived pet section ${show(cases.peerItem.pet)}`);
  const two = findingsOf('peerTwoOwn');
  assert(show(cases.peerTwoOwn.pet) === show(own.peerTwoOwn.pet) && two.length === 1 && two[0].code === 'invalid-fields' && !two[0].missing && /pet\.description/.test(two[0].message),
    `peerTwoOwn's letter's pet section has a description; the owner's, which replaces it whole in the tapestryJson, has none: one finding, naming pet.description (Decision 5); got ${show(two)}, the derived pet section ${show(cases.peerTwoOwn.pet)}`);
});

// ── MS4–MS5: the derive step, its database, store and resolver stubbed ──
function deriveChild() {
  const dir = tmp('memberships-derive-');
  const script = path.join(dir, 'child.js');
  const outFile = path.join(dir, 'out.json');
  const author = { word: { slug: 'beagle--peer', name: 'beagle: Peer', wordTypes: ['word', 'beagle'] }, beagle: { name: 'Peer', slug: 'peer', description: "the author's" } };
  const own = { pet: { name: 'Peer', slug: 'peer', description: "the owner's" }, beagle: { name: 'Peer', slug: 'peer', description: "the owner's beagle words" } };
  const cache = { word: { slug: 'beagle--peer', name: 'beagle: Peer', wordTypes: ['word', 'beagle'] }, beagle: { name: 'Peer', slug: 'peer', description: 'cached' }, graphContext: { derivedAt: 1 } };
  fs.writeFileSync(script, `'use strict';
const path = require('path');
const ROOT = ${JSON.stringify(ROOT)};
const out = {};
const stub = (rel, exports) => { const f = require.resolve(path.join(ROOT, rel)); require.cache[f] = { id: f, filename: f, loaded: true, exports }; };
let current = { json: null, cache: undefined, own: null };
const queries = [];
const put = [];
stub('src/lib/neo4j-driver', {
  runCypher: async (q) => {
    queries.push(q);
    if (/tag\\.value AS value/.test(q)) return current.json === null ? [] : [{ value: current.json }];
    if (/MATCH \\(n(:TapestryNode)? \\{tapestryKey: \\$key\\}\\) RETURN/.test(q)) {
      const row = { tapestryKey: 'k', uuid: 'u', name: 'Peer', slug: null, kind: 39999, pubkey: ${JSON.stringify(TA)}, labels: ['NostrEvent', 'ListItem', 'TapestryNode'], elementId: 'e' };
      if (/tapestryOwnSections/.test(q)) row.tapestryOwnSections = current.own;
      return [row];
    }
    return [];
  },
  writeCypher: async () => [],
});
stub('src/lib/tapestry-store', { get: () => current.cache, put: async (key, data) => { put.push({ key, data }); return { updatedAt: 1763000009 }; } });
stub('src/lib/tapestry-resolve', { isLmdbRef: () => false, resolveValue: () => null });
(async () => {
  try {
    const deriveWord = require(path.join(ROOT, 'src/lib/derivers/word.js'));
    const node = (own) => ({ uuid: 'u', tapestryKey: 'k', name: 'Peer', labels: ['NostrEvent', 'ListItem', 'TapestryNode'], elementId: 'e', ...(own === undefined ? {} : { tapestryOwnSections: own }) });
    current = { json: ${JSON.stringify(JSON.stringify(author))}, cache: undefined, own: null };
    out.fromTag = await deriveWord(node(${JSON.stringify(JSON.stringify(own))}));
    current = { json: null, cache: { data: ${JSON.stringify(cache)} }, own: null };
    out.fromCache = await deriveWord(node(${JSON.stringify(JSON.stringify({ pet: own.pet }))}));
    current = { json: ${JSON.stringify(JSON.stringify(author))}, cache: undefined, own: null };
    out.without = await deriveWord(node(undefined));
    const engine = require(path.join(ROOT, 'src/lib/tapestry-derive.js'));
    engine.registerDeriver('ListItem', deriveWord);
    current = { json: ${JSON.stringify(JSON.stringify(author))}, cache: undefined, own: ${JSON.stringify(JSON.stringify({ pet: own.pet }))} };
    await engine.deriveByKey('k');
    out.byKey = put.length ? put[put.length - 1].data : null;
  } catch (e) { out.error = String(e && e.stack || e); }
  require('fs').writeFileSync(${JSON.stringify(outFile)}, JSON.stringify(out));
  process.exit(0);
})();
`);
  const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 120000 });
  let out = null;
  try { out = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported below */ }
  assert(out, `the derive child wrote no answer: ${(child.stderr || '').slice(-600)}`);
  assert(!out.error, `the derive child failed: ${String(out.error).slice(0, 600)}`);
  return { out, own, author, cache };
}
let DERIVE = null;
const derive = () => { if (!DERIVE) DERIVE = deriveChild(); return DERIVE; };

test('MS4 [Decision 6]: deriveWord lays tapestryOwnSections over its base, from the json tag or from a cache entry, so the node\'s tapestryJson holds the owner\'s sections', () => {
  const { out, own, author } = derive();
  const t = out.fromTag;
  assert(show(t.pet) === show(own.pet) && show(t.beagle) === show(own.beagle), `over the json tag's JSON: the owner's pet section joins, and the owner's beagle section replaces the author's whole; got ${show({ pet: t.pet, beagle: t.beagle })}`);
  assert(show(t.word.wordTypes) === show(['word', 'beagle', 'pet']), `wordTypes gains pet, laid over before the word block is built; got ${show(t.word)}`);
  const c = out.fromCache;
  assert(show(c.pet) === show(own.pet) && c.beagle.description === 'cached', `over a cache entry with a word block, the base deriveWord uses then: the owner's pet section joins; got ${show({ pet: c.pet, beagle: c.beagle })}`);
  const w = out.without;
  assert(!('pet' in w) && show(w.beagle) === show(author.beagle), 'a node with no sections beside derives as before');
});

test('MS5 [Decision 6]: the derive step reads tapestryOwnSections: deriveByKey finds the node with it and hands it to the deriver (NODE_FIELDS)', () => {
  const { out, own } = derive();
  assert(out.byKey && show(out.byKey.pet) === show(own.pet), `the node read by its key carries tapestryOwnSections to deriveWord, so the JSON it stores holds the owner's section (src/lib/tapestry-derive.js NODE_FIELDS); got ${show(out.byKey && Object.keys(out.byKey))}`);
});

test('MS6 [Decision 10]: F.conceptsOfNodes(read, keys, { without }) leaves those relationships out of the walk, so "the concepts reaching a node" keeps one definition', () => {
  const v = value('without');
  const k = reads().keys;
  assert(show(v.walkerMax) === show([`${k.walkerMax}>${k.dog}`, `${k.walkerMax}>${k.pet}`].sort()), `walkerMax, through walkers, is dog's and pet's (the walk as it is); got ${show(v.walkerMax)}`);
  assert(show(v.walkerMaxWithout) === show([]), `without walkers' link to it, no concept reaches it; got ${show(v.walkerMaxWithout)}`);
  assert(show(v.setItemWithout) === show([`${k.setItem}>${k.beagle}`]), `without beagle's superset's own link, beagle still reaches setItem through show beagles; got ${show(v.setItemWithout)}`);
  assert(show(v.bothWithout) === show([`${k.setItem}>${k.beagle}`]), `a relationship of one node doesn't change another's; got ${show(v.bothWithout)}`);
  assert(show(v.emptyWithout) === show(v.walkerMax), `an empty without changes nothing; got ${show(v.emptyWithout)}`);
});

test('MS7 [Decision 10, Amendment 1]: M1 finds every HAS_ELEMENT into the node from the anchor or below it; M2 whether a concept\'s class thread reaches the anchor', () => {
  const w = value('waysIn');
  const k = reads().keys;
  const froms = (rows) => rows.map((r) => r.from).sort();
  assert(show(froms(w.setItemFromSuperset)) === show([k.beagleSuperset, k.showBeagles].sort()) && w.setItemFromSuperset.every((r) => r.rel === 'string'), `from beagle's superset: its own link and show beagles', each with its relationship's elementId; got ${show(w.setItemFromSuperset)}`);
  assert(show(froms(w.setItemFromSet)) === show([k.showBeagles]), `from show beagles: its link alone; got ${show(w.setItemFromSet)}`);
  assert(show(froms(w.walkerMaxFromDog)) === show([k.walkers]), `from dog's superset: walkers', the set below it; got ${show(w.walkerMaxFromDog)}`);
  assert(show(w.roverFromSet) === show([]), `none from a set that doesn't hold it; got ${show(w.roverFromSet)}`);
  assert(show(froms(w.wordyFromBeagle)) === show([k.commonSet]), `from beagle's superset to Wordy: the set beagle and word share; got ${show(w.wordyFromBeagle)}`);
  const r = value('reaches');
  const want = { petWalkers: true, petDog: false, dogGolden: true, goldenDog: false, beagleCommon: true, wordCommon: true, beagleOwn: true };
  for (const [name, b] of Object.entries(want)) assert(r[name] === b, `${name}: ${b}; got ${show(r)}`);
});

test('MS8 [Decision 2]: M.keptIn: json-tag for the instance\'s own node, beside for another author\'s, a person\'s, a placeholder and firmware\'s own elements', () => {
  const v = value('keptIn');
  const want = { whiskers: 'json-tag', patch: 'json-tag', ghosty: 'json-tag', snowy: 'beside', ace: 'beside', drifter: 'beside', personNode: 'beside', placeholder: 'beside', firmwareRover: 'beside', fwInteger: 'beside' };
  for (const [n, kept] of Object.entries(want)) assert(v[n] === kept, `${n}: ${kept}; got ${show(v)}`);
});

test('MS9 [Decision 11]: M.firmwareMemberships names rover\'s element file and json-data-type\'s manifest edge; with no assistant key it is empty, and isn\'t kept', () => {
  const names = value('firmwareMemberships');
  const has = (s) => names.some((x) => x.includes(s));
  const { firmwareElementAddress } = require('../../helpers/updateNodeGraph');
  const rover = firmwareElementAddress('Rover', 'dog');
  const integer = firmwareElementAddress('integer', 'json-data-type');
  assert(has(rover) && has(`39998:${TA}:dog`), `(a) concepts/dog/elements/rover.json makes rover's address, ${rover}, an element of dog; got ${names.length} strings`);
  assert(has(integer) && has(`39999:${TA}:the-set-of-numeric-json-data-types`), `(b) json-data-type's manifest edge numeric-types → integer, each name resolved to its file's address; got ${show(names.filter((x) => /integer|numeric/.test(x)).slice(0, 10))}`);
  const dir = tmp('memberships-keyless-');
  const script = path.join(dir, 'child.js');
  fs.writeFileSync(script, `'use strict';
${STRINGS}
const fs = require('fs');
const ROOT = ${JSON.stringify(ROOT)};
const p = ROOT + '/' + ${JSON.stringify(MEMBERSHIPS)};
if (!fs.existsSync(p)) { process.stdout.write('RESULT:' + JSON.stringify({ error: ${JSON.stringify(MEMBERSHIPS)} + ' does not exist yet (${ADR} Implementation notes)' })); process.exit(0); }
const M = require(p);
const addresses = (x) => strings(x).filter((s) => /3999[89]:/.test(s)).length;
const keyless = addresses(M.firmwareMemberships());
process.env.TA_PUBKEY = ${JSON.stringify(TA)};
const keyed = addresses(M.firmwareMemberships());
process.stdout.write('RESULT:' + JSON.stringify({ keyless, keyed }));
`);
  const env = S.childEnv(dir);
  delete env.TA_PUBKEY;
  const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env, timeout: 60000 });
  const line = (child.stdout || '').split('RESULT:')[1];
  const r = line ? JSON.parse(line) : { error: (child.stderr || '').slice(-400) };
  if (r.error) throw new Error(r.error);
  assert(r.keyless === 0 && r.keyed > 0, `with no assistant key it names no address; once the key is there it is worked out, so the empty one wasn't kept; got ${show(r)}`);
});

test('MS10 [AC7, Decision 12]: the rule node-has-a-concept loads, refuses, with one refusal, last-concept (409); loading it opens nothing', () => {
  const r = value('rule');
  assert(r.name === RULE && typeof r.summary === 'string' && r.summary.trim() && r.refuses === true, `its name, a summary, refuses: true; got ${show(r)}`);
  assert(show((r.refusals || []).map((x) => `${x.code}:${x.status}`)) === show(['last-concept:409']) && String(r.refusals[0].when).trim(), `its one refusal is last-concept, 409, saying when; got ${show(r.refusals)}`);
  const child = spawnSync(process.execPath, ['-e', `
    const ROOT = ${JSON.stringify(ROOT)};
    const rules = require(ROOT + '/src/operations/rules');
    rules.loadRules();
    const has = (rel) => Object.keys(require.cache).some((f) => f.endsWith(rel));
    const opened = () => ['src/lib/neo4j-driver.js', 'src/lib/tapestry-store.js', 'src/api/normalize/firmware.js', 'src/utils/assistantKeys.js'].filter(has);
    const afterRules = opened();
    let afterMemberships = null;
    if (require('fs').existsSync(ROOT + '/${MEMBERSHIPS}')) { require(ROOT + '/${MEMBERSHIPS}'); afterMemberships = opened(); }
    process.stdout.write('RESULT:' + JSON.stringify({ loaded: !!rules.findRule(${JSON.stringify(RULE)}), afterRules, afterMemberships }));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('memberships-load-')), timeout: 60000 });
  const line = (child.stdout || '').split('RESULT:')[1];
  const o = line ? JSON.parse(line) : null;
  assert(o && o.loaded, `the loader loads the rule; got ${line} ${(child.stderr || '').slice(-300)}`);
  assert(show(o.afterRules) === show([]) && show(o.afterMemberships) === show([]), `loading the rule, and _memberships.js, opens nothing: no driver, store, firmware or key (ADR graph-operations-foundation/0001 Decision 10); got ${show(o)}`);
});

test('MS11 [AC7, Decision 12]: as remove-from-concept\'s guard, a finding when the call would leave the node in no concept but word; none for a repeat, a reserved key, a tag or anything apply refuses', () => {
  const v = value('guard');
  const k = reads().keys;
  for (const name of ['twoHome', 'setItemSet', 'wordy', 'repeat', 'reserved', 'noNode', 'noConcept', 'noSet', 'tag']) {
    assert(Array.isArray(v[name]) && v[name].length === 0, `${name}: no finding; got ${show(v[name])}`);
  }
  for (const name of ['whiskers', 'walkerMax', 'walkerMaxSet', 'commonOnly']) {
    const f = v[name];
    assert(Array.isArray(f) && f.length === 1 && f[0].code === 'last-concept' && f[0].item && f[0].item.node, `${name}: one last-concept finding, naming its item; got ${show(f)}`);
  }
  const m = String(v.whiskers[0].message);
  assert((m.includes(k.pet) || /\bpet\b/.test(m)) && /add-to-concept/.test(m) && /delete-node/.test(m), `it names the concept and the way on: add the node to another concept first, or delete it (Decision 12); got ${m}`);
  assert(/word/.test(String(v.commonOnly[0].message)) || /no concept/.test(String(v.commonOnly[0].message)), `a node beagle and word reach, taken out of beagle, is left in no concept but word: word doesn't count (D9); got ${show(v.commonOnly)}`);
});

test('MS12 [AC7, Decision 12]: as a check, it names each node no concept but word reaches; tags and change entries are exempt, person nodes and placeholders aren\'t', () => {
  const v = value('check');
  const k = reads().keys;
  for (const name of ['whiskers', 'tag', 'entry', 'nobody', 'personInPet', 'fwInteger', 'commonOnly']) {
    assert(Array.isArray(v[name]) && v[name].length === 0, `${name}: no finding; got ${show(v[name])}`);
  }
  for (const name of ['wordOnly', 'loner', 'personNode', 'placeholder']) {
    const f = v[name];
    assert(Array.isArray(f) && f.length === 1 && f[0].code === 'last-concept' && f[0].item && f[0].item.node === k[name], `${name}: one finding, naming it (Consequences, follow-up 6); got ${show(f)}`);
  }
  assert(/word/.test(String(v.wordOnly[0].message)), `as a check it says no concept but word reaches the node; got ${show(v.wordOnly)}`);
  const many = (v.many || []).map((f) => f.item && f.item.node).sort();
  assert(show(many) === show([k.loner, k.wordOnly].sort()), `over many nodes at once, exactly those no concept but word reaches; got ${show(v.many)}`);
});

test('MS13 [AC7, Decision 12]: the rulebook\'s entry 8 says the rule, that it refuses, how a check finds what breaks it, and its source, in the entry format', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs/GRAPH_RULES.md'), 'utf8');
  const at = doc.search(/^## 8\. `node-has-a-concept`$/m);
  assert(at >= 0, `docs/GRAPH_RULES.md has no entry "## 8. \`node-has-a-concept\`" yet (${ADR} Decision 12)`);
  const next = doc.slice(at + 3).search(/^## /m);
  const entry = next >= 0 ? doc.slice(at, at + 3 + next) : doc.slice(at);
  const field = (label) => { const m = entry.match(new RegExp(`^- \\*\\*${label.replace(/ /g, ' ')}:\\*\\* ([\\s\\S]*?)(?=^- \\*\\*|(?![\\s\\S]))`, 'm')); return m ? m[1] : null; };
  for (const label of ['Says', 'Kind', 'Refuses or reports', 'Check', 'Repair', 'Enforced by', 'Status', 'Source']) {
    assert((entry.match(new RegExp(`^- \\*\\*${label}:\\*\\*`, 'gm')) || []).length === 1, `entry 8 has its ${label} once; got ${show(entry.slice(0, 400))}`);
  }
  assert(/word/.test(field('Says')) && /concept/.test(field('Says')), `its Says: every node is an element of a concept other than word; got ${show(field('Says'))}`);
  assert(/`last-concept`/.test(field('Refuses or reports')) && /409/.test(field('Refuses or reports')), `it refuses, last-concept (409); got ${show(field('Refuses or reports'))}`);
  assert(/remove-from-concept/.test(field('Enforced by')) && /node-has-a-concept\.js/.test(field('Enforced by')), `it is the guard of graph remove-from-concept, its code in src/operations/rules/node-has-a-concept.js; got ${show(field('Enforced by'))}`);
  assert(/enforced/.test(field('Status')) && /graph-operations-first-slice\/0022/.test(field('Source')), `enforced, from ${ADR}; got ${show([field('Status'), field('Source')])}`);
});

test('MS14 [Decision 16]: relationship-type-allowed says HAS_ELEMENT is made and taken out by graph add-to-concept, remove-from-concept and create-element', () => {
  const v = value('reservedType');
  const m = String((v[0] || {}).message);
  assert(v.length === 1 && v[0].code === 'reserved-type', `HAS_ELEMENT is still reserved; got ${show(v)}`);
  assert(/add-to-concept/.test(m) && /remove-from-concept/.test(m) && /create-element/.test(m), `the reserved-type message names the three operations; got ${m}`);
});

test('MS15 [Decision 16]: update-node\'s not-an-element and no-section name graph add-to-concept, no longer "to come"', () => {
  const MG = require('../../helpers/membershipGraph');
  return MG.seedMemberships().then((seed) => {
    const k = seed.keys;
    const file = seed.file(tmp('memberships-update-node-'));
    const r = S.runHarness({ scenarios: [{ graphFake: { stateFile: file }, requests: [
      { id: 'not-an-element', method: 'POST', url: '/api/tapestry/graph/update-node', caller: 'owner', body: { node: k.wordOnly, fields: { description: 'x' } } },
      { id: 'no-section', method: 'POST', url: '/api/tapestry/graph/update-node', caller: 'owner', body: { node: k.walkerMax, concept: k.pet, fields: { description: 'x' } } },
    ] }] }, { dir: path.dirname(file) });
    const a = S.answered(r);
    for (const [id, code] of [['not-an-element', 'not-an-element'], ['no-section', 'no-section']]) {
      const x = a.req(id);
      assert(x.status === 409 && x.body.code === code, `the path under test ran: update-node refuses ${code}; got ${x.status} ${show(x.body).slice(0, 300)}`);
      assert(/add-to-concept/.test(String(x.body.error)) && !/to come/.test(String(x.body.error)), `${code} names graph add-to-concept as built: no "(A10.22, to come)"; got ${x.body.error}`);
    }
    const src = fs.readFileSync(path.join(ROOT, 'src/operations/catalog/graph/update-node.js'), 'utf8');
    const left = src.split('\n').filter((l) => l.includes('(A10.22, to come)')).length;
    assert(left === 0, `none of update-node's words still calls graph add-to-concept "(A10.22, to come)", not-its-concept's included (Amendment 1, item 9); ${left} line(s) still do`);
  });
});

test('MS16 [Decision 16]: the catalog\'s two rows give add-to-concept and remove-from-concept as built, each naming its rule and the ADR', () => {
  const lines = fs.readFileSync(path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md'), 'utf8').split('\n');
  const add = lines.find((l) => l.startsWith('| `add-to-concept` |')) || '';
  const rm = lines.find((l) => l.startsWith('| `remove-from-concept` |')) || '';
  for (const [name, row, rule] of [['add-to-concept', add, '`element-fits-schema`'], ['remove-from-concept', rm, '`node-has-a-concept`']]) {
    assert(row.includes('graph-operations-first-slice/0022') && row.includes(rule) && row.includes('`set?`') && !/`concept` or `set`/.test(row),
      `${name}'s row names ${ADR}, its rule ${rule}, and its inputs as built (concept, set?); got ${show(row).slice(0, 400)}`);
  }
  assert(add.includes('`fields?`'), 'add-to-concept takes fields?');
});

test('MS17 [Decision 14]: changes.js\'s header says which change fields the membership changes use', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/operations/changes.js'), 'utf8');
  const header = src.slice(0, src.indexOf('const CHANGE'));
  assert(/graph-operations-first-slice\/0022/.test(header), `the comment before CHANGE names ${ADR}, as each ADR that uses change fields does (changes.js:28–35)`);
});

test('MS18: the new modules require nothing that signs, publishes or reads a key', () => {
  const files = ['src/operations/catalog/graph/add-to-concept.js', 'src/operations/catalog/graph/remove-from-concept.js', MEMBERSHIPS, RULE_FILE];
  for (const f of files) {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) throw new Error(`${f} does not exist yet (${ADR} Implementation notes)`);
    const src = fs.readFileSync(abs, 'utf8');
    const bad = (src.match(/require\(\s*['"][^'"]*['"]\s*\)/g) || []).filter((r) => /nostr-tools|normalize\/helpers|secureKeyStorage|child_process|strfry|signing/.test(r));
    assert(bad.length === 0, `${f} must require nothing that signs (ADR 0004 Decision 10); it requires ${show(bad)}`);
  }
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
