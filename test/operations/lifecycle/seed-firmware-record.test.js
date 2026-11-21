'use strict';
/**
 * lifecycle seed-firmware's install record in the cache: the derive puts a node's cameFrom and installed into its
 * tapestryJSON, and the schema check sets them aside — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/37-seed-firmware.md (AC2: "A read of the node answers
 *          it (cache get)")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0037-seed-firmware.md (Decision 6: "The derive puts
 *          both properties into the node's tapestryJSON, as top-level cameFrom and installed sections … Wherever
 *          tapestryJSON is judged against a schema (story 42's judge), the two sections are set aside, as graphContext
 *          is")
 *   Plan:  engineering-team/stories/graph-operations-first-slice/37-seed-firmware.test-plan.md
 *
 * The derive runs in a child (test/helpers/seedFirmwareDeriveChild.js) over today's install's graph, the two
 * properties set on some of its nodes as seed-firmware writes them (JSON text), and three small concepts of the
 * instance's own beside it. The verdicts are the ones the derive gives (graphContext.parentJsonSchemas), through story
 * 42's judge, which the derive calls knowing the node.
 *
 *   SR1 the word deriver: an element's and a header's tapestryJSON gain top-level cameFrom and installed, parsed, beside
 *       what they held
 *   SR2 the set deriver: a set's and a superset's do too
 *   SR3 a node with no record gets neither section
 *   SR4 the derive's schema verdicts set the record aside for a node that carries it: a schema that allows no other
 *       top-level section finds such a node fitting, and still refuses a node's unknown section (moved onto the derive
 *       path, which knows the node, at review round 1: ADR 0037 Amendment 3 item 6)
 *   SR5 a node with no record whose JSON has a concept's section named installed keeps it through the derive, and the
 *       verdicts judge it: fitting when it fits, and naming installed.when when it doesn't (Amendment 3, item 6; review
 *       round 1, N4)
 *   SR6 the same for a section named cameFrom
 * Review round 2 (engineering-team/reviews/graph-operations-first-slice/37-seed-firmware.md, "Round 2"):
 *   SR7 R2-N1: the write path's checks (checkElements, and the answer's verdicts, Sch.fits) set aside the record of an
 *       element seed-firmware recorded, its json offloaded (the store's copy, the derive's, holds the record's
 *       sections) or inline, so a schema that closes its top level takes it: through graph add-to-concept, and through
 *       graph update-node, which of seed-firmware's nodes takes only its installed-firmware graph; a node with no record
 *       is judged whole, its own installed section refused
 *   SR8 R2-N2: recordCarried names the record sections a node carries, from its properties: both, one, none, and not
 *       one that can't be read
 *   SR9 R2-N2: the rule element-fits-schema, judging a node as it stands, sets aside the record of a node that carries
 *       it, under a schema closed at its top level; a node with no record is judged whole
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const F = require('../../helpers/seedFirmwareFixtures');
const S = require('../../helpers/graphOpsSuite');

const { assert, show, TA } = F;
const { test, run } = S.makeSuite('operations: lifecycle seed-firmware — the install record in the cache (the derive and the schema check)');

const CHILD = path.join(F.ROOT, 'test/helpers/seedFirmwareDeriveChild.js');
const words = (b) => String(b && (b.error || b.message || ''));
const ROVER = 'concepts/dog/elements/rover.json';
const FREE = 'concepts/nostr-relay/sets/free-relays.json';
const record = (address, file) => ({
  cameFrom: { kind: 'file', address: file, id: 'ab'.repeat(32) },
  installed: { version: '1.0.0', source: 'cd'.repeat(32), digest: 'ef'.repeat(32), parts: { name: '01'.repeat(32), json: '23'.repeat(32), tags: { d: '45'.repeat(32), z: '67'.repeat(32) } }, at: '2026-11-20T12:00:00.000Z' },
  address,
});

let DERIVED = null;
async function derived() {
  if (DERIVED) return DERIVED;
  const o = await F.oracle();
  const s = F.todaysGraph(o, { schemaValues: false });
  const recs = [
    record(o.elementOf(ROVER), ROVER),
    record(o.headerOf('dog'), 'concepts/dog/concept-header.json'),
    record(o.setOf(FREE), FREE),
    record(o.supersetOf('dog'), 'concepts/dog/concept-header.json'),
  ];
  for (const r of recs) {
    const n = F.nodesAt(s, r.address)[0];
    n.props.cameFrom = JSON.stringify(r.cameFrom);
    n.props.installed = JSON.stringify(r.installed);
  }
  const plain = F.nodesAt(s, o.elementOf('concepts/json-data-type/elements/string.json'))[0];
  const custom = customConcepts(s);
  const dir = F.tmp('seed-firmware-derive-');
  const stateFile = path.join(dir, 'state.json');
  const keysFile = path.join(dir, 'keys.json');
  const keys = [...recs.map((r) => F.nodesAt(s, r.address)[0].props.tapestryKey), plain.props.tapestryKey, ...Object.values(custom.elements)];
  fs.writeFileSync(stateFile, JSON.stringify(s));
  fs.writeFileSync(keysFile, JSON.stringify(keys));
  const child = spawnSync(process.execPath, [CHILD, stateFile, keysFile], { cwd: F.ROOT, env: F.envFor(dir), encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024 });
  const line = (child.stdout || '').split(F.NL).find((l) => l.startsWith('RESULT:'));
  assert(line, `the derive child printed no result (exit ${child.status}): ${(child.stderr || '').slice(-500)}`);
  const result = JSON.parse(line.slice(7));
  assert(!result.error, `the derive child failed: ${String(result.error).slice(0, 600)}`);
  DERIVED = { out: result.out, keys, recs, plain: plain.props.tapestryKey, custom };
  return DERIVED;
}

/**
 * Three concepts of the instance's own, put into the state: gadget, whose schema allows no top-level section but word,
 * graphContext and gadget; installed, whose key is `installed`, its section requiring a text `when`; and came from,
 * whose key is `cameFrom`, its section requiring a text `place`. Their elements: g1 (gadget, carrying a record, as
 * seed-firmware sets one), g2 (gadget, with an unknown `extra` section), i1 and i2 (installed: when as text, and as a
 * number) and c1 (came from). → { headers: { gadget, installed, cameFrom }, elements: { g1, g2, i1, i2, c1 } } by key.
 */
function customConcepts(s) {
  const concept = (slug, name, key, section) => {
    const header = F.addNode(s, ['ListHeader', 'ConceptHeader'], { uuid: `39998:${TA}:${slug}`, kind: 39998, pubkey: TA, name });
    const superset = F.addNode(s, ['ListItem', 'Superset'], { uuid: `39999:${TA}:${slug}-superset`, kind: 39999, pubkey: TA, name: `superset for the concept of ${name}s` });
    F.addRel(s, header, 'IS_THE_CONCEPT_FOR', superset);
    const schema = F.addNode(s, ['ListItem', 'JSONSchema'], { uuid: `39999:${TA}:${slug}-schema`, kind: 39999, pubkey: TA, name: `JSON schema for the concept of ${name}s` });
    F.addTagNodes(s, schema, [['json', JSON.stringify({ word: { slug: `json-schema-for-the-concept-of-${slug}s`, wordTypes: ['word', 'jsonSchema'] }, jsonSchema: section })]]);
    F.addRel(s, schema, 'IS_THE_JSON_SCHEMA_FOR', header);
    return { header, superset, key };
  };
  const element = (c, d, json, props = {}) => {
    const n = F.addNode(s, ['ListItem'], { uuid: `39999:${TA}:${d}`, kind: 39999, pubkey: TA, name: d, tapestryValue: d, ...props });
    F.addTagNodes(s, n, [['d', d], ['name', d], ['json', JSON.stringify({ word: { slug: d, name: d, wordTypes: ['word', c.key] }, ...json })]]);
    F.addRel(s, c.superset, 'HAS_ELEMENT', n);
    return n.props.tapestryKey;
  };
  const top = (key, inner) => ({ type: 'object', additionalProperties: false, required: [key], properties: { word: { type: 'object' }, graphContext: { type: 'object' }, [key]: inner } });
  const gadget = concept('gadget', 'gadget', 'gadget', top('gadget', { type: 'object', properties: { name: { type: 'string' } } }));
  const installed = concept('installed', 'installed', 'installed', top('installed', { type: 'object', required: ['when'], properties: { when: { type: 'string' } } }));
  const cameFrom = concept('came-from', 'came from', 'cameFrom', top('cameFrom', { type: 'object', required: ['place'], properties: { place: { type: 'string' } } }));
  const rec = record('x', 'concepts/gadget/elements/g1.json');
  return {
    headers: { gadget: gadget.header.props.tapestryKey, installed: installed.header.props.tapestryKey, cameFrom: cameFrom.header.props.tapestryKey },
    elements: {
      g1: element(gadget, 'g1', { gadget: { name: 'Sprocket' } }, { cameFrom: JSON.stringify(rec.cameFrom), installed: JSON.stringify(rec.installed) }),
      g2: element(gadget, 'g2', { gadget: { name: 'Cog' }, extra: { note: 'not a section the schema takes' } }),
      i1: element(installed, 'i1', { installed: { when: 'yesterday' } }),
      i2: element(installed, 'i2', { installed: { when: 5 } }),
      c1: element(cameFrom, 'c1', { cameFrom: { place: 'Lisbon' } }),
    },
    rec,
  };
}
/** A derived node's verdict for a concept: its parentJsonSchemas entry, or null. */
const verdictOf = (json, conceptKey) => ((json && json.graphContext && json.graphContext.parentJsonSchemas) || []).find((v) => v.conceptTapestryKey === conceptKey) || null;
function sectionsFor(d, i) {
  const json = d.out[d.keys[i]];
  assert(json && json.word && json.graphContext, `the derive built ${d.recs[i] ? d.recs[i].address : 'it'}'s tapestryJSON (so this isn't passing on a derive that did nothing); got ${show(json).slice(0, 200)}`);
  return json;
}

test('SR1 [AC2, Decision 6]: the word deriver: an element\'s and a header\'s tapestryJSON gain top-level cameFrom and installed, parsed, beside what they held', async () => {
  const d = await derived();
  for (const i of [0, 1]) {
    const json = sectionsFor(d, i);
    assert(F.sameJson(json.cameFrom, d.recs[i].cameFrom) && F.sameJson(json.installed, d.recs[i].installed), `${d.recs[i].address.split(':')[2]}: cameFrom and installed are top-level sections, as the node holds them; got ${show({ cameFrom: json.cameFrom, installed: json.installed }).slice(0, 300)}`);
  }
  assert(sectionsFor(d, 0).dog && sectionsFor(d, 0).dog.name === 'Rover', 'rover\'s own section is still there');
});

test('SR2 [AC2, Decision 6]: the set deriver: a set\'s and a superset\'s tapestryJSON gain them too', async () => {
  const d = await derived();
  for (const i of [2, 3]) {
    const json = sectionsFor(d, i);
    assert(F.sameJson(json.cameFrom, d.recs[i].cameFrom) && F.sameJson(json.installed, d.recs[i].installed), `${d.recs[i].address.split(':')[2]}: cameFrom and installed; got ${show({ cameFrom: json.cameFrom, installed: json.installed }).slice(0, 300)}`);
  }
});

test('SR3 [Decision 6]: a node with no install record gets neither section', async () => {
  const d = await derived();
  const json = d.out[d.plain];
  assert(json && json.word, 'the derive built it');
  assert((json.cameFrom === undefined || json.cameFrom === null) && (json.installed === undefined || json.installed === null), `no cameFrom, no installed; got ${show({ cameFrom: json.cameFrom, installed: json.installed })}`);
});

test('SR4 [Decision 6, Amendment 3 item 6]: the derive\'s verdicts set the record aside for a node that carries it: a schema allowing no other top-level section finds it fitting, and still refuses a node\'s unknown section', async () => {
  const d = await derived();
  const g1 = d.out[d.custom.elements.g1];
  assert(g1 && g1.word && F.sameJson(g1.cameFrom, d.custom.rec.cameFrom) && F.sameJson(g1.installed, d.custom.rec.installed), `g1, which carries the record, has its two sections; got ${show(g1).slice(0, 300)}`);
  const v1 = verdictOf(g1, d.custom.headers.gadget);
  assert(v1 && v1.valid === true, `g1's verdict for gadget: fitting, the record set aside; got ${show(v1)}`);
  const v2 = verdictOf(d.out[d.custom.elements.g2], d.custom.headers.gadget);
  assert(v2 && v2.valid === false && show(v2.errors).includes('extra'), `g2's unknown section is still refused, naming it; got ${show(v2)}`);
});

test('SR5 [Amendment 3, item 6; review round 1, N4]: a node with no record whose JSON has a concept section named installed keeps it through the derive, and the verdicts judge it', async () => {
  const d = await derived();
  const i1 = d.out[d.custom.elements.i1];
  assert(i1 && i1.word, 'the derive built i1');
  assert(F.sameJson(i1.installed, { when: 'yesterday' }), `i1 has no install record, so its own installed section stays as it is; got ${show(i1.installed)}`);
  const v1 = verdictOf(i1, d.custom.headers.installed);
  assert(v1 && v1.valid === true, `i1's verdict for installed: its section judged, and fitting; got ${show(v1)}`);
  const i2 = d.out[d.custom.elements.i2];
  assert(i2 && F.sameJson(i2.installed, { when: 5 }), `i2 keeps its section too; got ${show(i2 && i2.installed)}`);
  const v2 = verdictOf(i2, d.custom.headers.installed);
  assert(v2 && v2.valid === false && show(v2.errors).includes('installed.when'), `i2's section is judged, not set aside: refused, naming installed.when; got ${show(v2)}`);
});

test('SR6 [Amendment 3, item 6; review round 1, N4]: a node with no record whose JSON has a concept section named cameFrom keeps it through the derive, judged and fitting', async () => {
  const d = await derived();
  const c1 = d.out[d.custom.elements.c1];
  assert(c1 && c1.word, 'the derive built c1');
  assert(F.sameJson(c1.cameFrom, { place: 'Lisbon' }), `c1's own cameFrom section stays as it is; got ${show(c1.cameFrom)}`);
  const v = verdictOf(c1, d.custom.headers.cameFrom);
  assert(v && v.valid === true, `c1's verdict for came from: its section judged, and fitting; got ${show(v)}`);
});

// ── review round 2: the write path, recordCarried and the rule (R2-N1, R2-N2) ──
/**
 * Schemas as a raw edit, or a schema builder to come, may leave them: closed at the top level, taking word, graphContext
 * and the sections named, but no other (review round 2, R2-N1: none closes it today). gadget's, and graph's.
 */
const closed = (...sections) => ({ type: 'object', additionalProperties: false, properties: Object.fromEntries(['word', 'graphContext', ...sections].map((k) => [k, { type: 'object' }])) });
const CLOSED = closed('gadget', 'dog', 'jsonDataType');
const CLOSED_GRAPH = closed('graph', 'installedFirmware');
const UPDATE = '/api/tapestry/graph/update-node';
const ADD = '/api/tapestry/graph/add-to-concept';

/**
 * WRITES: seed-firmware installs firmware/active's copy, and the owner makes the concept gadget (graph create-concept),
 * whose schema is then closed (CLOSED), as graph's is (CLOSED_GRAPH). Beside them, n1 ("Widget"), a node of the
 * instance's own with no record, whose JSON has a section of its own named installed. The Dashboard's offload, and a
 * derive, of rover, n1 and the installed-firmware graph: each json tag is then an lmdb: reference to the derive's copy,
 * which holds the record's sections of a node that carries one; string's stays inline. Then graph add-to-concept puts
 * each of rover, string and n1 in gadget, and graph update-node gives the installed-firmware graph a description.
 */
let WRITES = null;
async function writes() {
  if (WRITES) return WRITES;
  F.needDecl();
  const fw = F.copyFirmware({}, { label: 'seed-firmware-record-fw-' });
  const o = await F.oracle(fw);
  const a = F.runSeed({ firmwareDir: fw, label: 'seed-firmware-record-install-', requests: [F.seed('install', 'owner'), { id: 'gadget', method: 'POST', url: '/api/tapestry/graph/create-concept', caller: 'owner', body: { name: 'gadget' } }] });
  F.data(a, 'install');
  F.data(a, 'gadget');
  const s = a.state();
  const header = F.nodesAt(s, `39998:${TA}:gadget`)[0];
  assert(header, 'graph create-concept made gadget\'s header');
  const gadget = header.props.tapestryKey;
  const schema = F.relsOf(s, { type: 'IS_THE_JSON_SCHEMA_FOR', to: `39998:${TA}:gadget` }).map((r) => r.fromNode)[0];
  assert(schema, 'graph create-concept made gadget\'s JSON schema node');
  const closeSchema = (node, jsonSchema) => {
    const t = F.relsOf(s, { type: 'HAS_TAG', from: node.props.uuid }).map((r) => r.toNode).find((x) => x.props.type === 'json');
    assert(t && !String(t.props.value).startsWith('lmdb:'), `${node.props.uuid} has its JSON inline`);
    t.props.value = JSON.stringify({ ...JSON.parse(t.props.value), jsonSchema });
  };
  closeSchema(schema, CLOSED);
  closeSchema(F.nodesAt(s, [...o.letters.values()].find((l) => l.role === 'jsonSchema' && l.concept === 'graph').address)[0], CLOSED_GRAPH);
  const n1 = F.addNode(s, ['ListItem'], { uuid: `39999:${TA}:widget`, kind: 39999, pubkey: TA, name: 'Widget', tapestryValue: 'Widget', created_at: 1700000002 });
  F.addTagNodes(s, n1, [['d', 'widget'], ['name', 'Widget'], ['json', JSON.stringify({ word: { slug: 'widget', name: 'Widget', wordTypes: ['word'] }, installed: { when: 'yesterday' } })]]);
  const rover = F.nodesAt(s, o.elementOf(ROVER))[0];
  const string = F.nodesAt(s, o.elementOf('concepts/json-data-type/elements/string.json'))[0];
  const ig = F.nodesAt(s, F.installedGraphAddress())[0];
  assert(F.propJson(rover, 'installed') && F.propJson(string, 'installed') && ig && F.propJson(ig, 'installed'), 'seed-firmware recorded rover, string and its installed-firmware graph: each carries its installed record');
  const keys = { gadget, graph: F.nodesAt(s, o.headerOf('graph'))[0].props.tapestryKey, rover: rover.props.tapestryKey, string: string.props.tapestryKey, n1: n1.props.tapestryKey, ig: ig.props.tapestryKey };
  const lmdb = path.join(F.tmp('seed-firmware-record-lmdb-'), 'lmdb');
  const offloaded = [keys.rover, keys.n1, keys.ig];
  const off = F.offloadAndDerive(s, { lmdb, offload: offloaded, derive: offloaded });
  const add = (id, node) => ({ id, method: 'POST', url: ADD, caller: 'owner', body: { node, concept: gadget } });
  const b = F.runSeed({
    state: off.state, firmwareDir: fw, lmdb, label: 'seed-firmware-record-add-',
    requests: [add('recorded-offloaded', keys.rover), add('recorded-inline', keys.string), add('unrecorded', keys.n1), { id: 'recorded-update', method: 'POST', url: UPDATE, caller: 'owner', body: { node: keys.ig, description: 'what lifecycle seed-firmware last installed' } }],
  });
  WRITES = { fw, keys, lmdb, off, b };
  return WRITES;
}

/** The rule element-fits-schema's violations over `items`, in a child: the graph WRITES' offload left, its store at WRITES' lmdb. */
function ruleOn(w, items) {
  const dir = F.tmp('seed-firmware-record-rule-');
  const file = path.join(dir, 'state.json');
  fs.writeFileSync(file, JSON.stringify(w.off.state));
  const script = [
    "'use strict';",
    "for (const k of ['log', 'info', 'debug', 'warn']) console[k] = () => {};",
    "const path = require('path');",
    `const ROOT = ${show(F.ROOT)};`,
    // No driver: the rule reads through the read it is given, and a call to the driver fails here, never reaching Neo4j.
    "const driverFile = require.resolve(path.join(ROOT, 'src/lib/neo4j-driver.js'));",
    "const none = () => { throw new Error('the rule child has no driver'); };",
    'require.cache[driverFile] = { id: driverFile, filename: driverFile, loaded: true, children: [], paths: [], exports: { runCypher: none, streamCypher: none, writeCypher: none, getDriver: none, closeDriver: async () => {}, toJS: (x) => x } };',
    `const E = require(${show(path.join(F.ROOT, 'test/helpers/cypherEngine.js'))});`,
    `const state = JSON.parse(require('fs').readFileSync(${show(file)}, 'utf8'));`,
    'const read = async (q, p) => E.run(state, q, p || {}, { write: false }).rows;',
    "const rule = require(path.join(ROOT, 'src/operations/rules/element-fits-schema.js'));",
    '(async () => {',
    '  try {',
    `    const found = await rule.violations(${show(items)}, read);`,
    "    process.stdout.write('RESULT:' + JSON.stringify({ found: found.map((f) => ({ node: f.item.node, concept: f.concept, code: f.code, message: f.message })) }) + '\\n');",
    "  } catch (e) { process.stdout.write('RESULT:' + JSON.stringify({ error: String((e && e.stack) || e) }) + '\\n'); }",
    '})();',
  ].join(F.NL);
  const scriptFile = path.join(dir, 'rule-child.js');
  fs.writeFileSync(scriptFile, script);
  const r = spawnSync(process.execPath, [scriptFile], { cwd: F.ROOT, env: F.envFor(dir, { firmwareDir: w.fw, lmdb: w.lmdb }), encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
  const line = (r.stdout || '').split(F.NL).find((l) => l.startsWith('RESULT:'));
  assert(line, `the rule child printed no result (exit ${r.status}): ${(r.stderr || '').slice(-500)}`);
  const out = JSON.parse(line.slice(7));
  assert(!out.error, `the rule child failed: ${String(out.error).slice(0, 600)}`);
  return out.found;
}

test('SR7 [Amendment 3, item 6; review round 2, R2-N1]: the write path\'s checks set aside the record of an element seed-firmware recorded, its json offloaded or inline, so a schema closed at its top level takes it, through graph add-to-concept and graph update-node; a node with no record is judged whole', async () => {
  const w = await writes();
  const dr = w.off.derived[w.keys.rover];
  assert(dr && dr.cameFrom && dr.installed, `rover's offloaded copy, the derive's, holds its record's sections, which the write reads as its JSON; got ${show(dr && Object.keys(dr))}`);
  const dn = w.off.derived[w.keys.n1];
  assert(dn && F.sameJson(dn.installed, { when: 'yesterday' }) && !dn.cameFrom, `n1's offloaded copy keeps its own installed section; got ${show(dn && dn.installed)}`);
  for (const [id, what] of [['recorded-offloaded', 'rover, recorded, its json offloaded'], ['recorded-inline', 'string, recorded, its json inline']]) {
    const r = w.b.req(id);
    assert(r.status === 200 && r.body && r.body.success === true && r.body.data.outcome === 'added', `${what}: graph add-to-concept puts it in gadget, whose schema closes its top level, the record's sections set aside (checkElements); got ${r.status} ${String(show(r.body)).slice(0, 500)}`);
    const v = (r.body.data.concepts || []).find((c) => c.concept === w.keys.gadget);
    assert(v && v.fits === true, `${what}: the answer's verdict for gadget fits, the record set aside there too (Sch.fits); got ${show(v)}`);
  }
  const di = w.off.derived[w.keys.ig];
  assert(di && di.installed && di.installedFirmware, `the installed-firmware graph's offloaded copy holds its installed record's section beside installedFirmware; got ${show(di && Object.keys(di))}`);
  const up = w.b.req('recorded-update');
  assert(up.status === 200 && up.body && up.body.success === true && up.body.data.outcome === 'updated', `the installed-firmware graph, recorded, its json offloaded: graph update-node changes its description under graph's schema, closed at its top level, the record's section set aside (checkElements); got ${up.status} ${String(show(up.body)).slice(0, 500)}`);
  const vg = (up.body.data.concepts || []).find((c) => c.concept === w.keys.graph);
  assert(vg && vg.fits === true, `the answer's verdict for graph fits, the record set aside there too (Sch.fits); got ${show(vg)}`);
  const u = w.b.req('unrecorded');
  assert(u.status === 400 && u.body && u.body.code === 'invalid-fields' && /installed/.test(words(u.body)), `n1, with no record, is judged whole: gadget's closed schema refuses its own installed section, naming it; got ${u.status} ${String(show(u.body)).slice(0, 500)}`);
});

test('SR8 [Amendment 3, item 6; review round 2, R2-N2]: recordCarried names the record sections a node carries, from its properties: both, one, none, and not one that can\'t be read', () => {
  const X = require(path.join(F.ROOT, 'src/operations/catalog/graph/_schemas.js'));
  assert(typeof X.recordCarried === 'function', '_schemas.js exports recordCarried');
  const rec = record('x', ROVER);
  const text = { cameFrom: JSON.stringify(rec.cameFrom), installed: JSON.stringify(rec.installed) };
  const cases = [
    ['both, as seed-firmware writes them (JSON text)', { ...text, name: 'Rover' }, ['cameFrom', 'installed']],
    ['both, as objects', { cameFrom: rec.cameFrom, installed: rec.installed }, ['cameFrom', 'installed']],
    ['cameFrom alone', { cameFrom: text.cameFrom }, ['cameFrom']],
    ['installed alone', { installed: text.installed }, ['installed']],
    ['none', { name: 'Rover', uuid: `39999:${TA}:rover` }, []],
    ['no properties', {}, []],
    ['no row (null)', null, []],
    ['not an object', 'cameFrom', []],
    ['cameFrom text that isn\'t JSON, beside a readable installed', { cameFrom: '{"kind": "file"', installed: text.installed }, ['installed']],
    ['JSON that isn\'t an object: a list, a text', { cameFrom: '[1, 2]', installed: '"installed"' }, []],
    ['a number, and JSON null', { cameFrom: 5, installed: 'null' }, []],
    ['empty texts', { cameFrom: '', installed: '' }, []],
    ['a list, beside a readable installed', { cameFrom: [{ kind: 'file' }], installed: text.installed }, ['installed']],
  ];
  const wrong = [];
  for (const [what, props, want] of cases) {
    const got = X.recordCarried(props);
    if (!Array.isArray(got) || show([...got].sort()) !== show(want)) wrong.push(`${what}: want ${show(want)}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('SR9 [Amendment 3, item 6; review round 2, R2-N2]: the rule element-fits-schema, judging a node as it stands, sets aside the record of a node that carries it: under a schema closed at its top level, rover fits; n1, with no record, is judged whole', async () => {
  const w = await writes();
  const found = ruleOn(w, [{ node: w.keys.rover, concept: w.keys.gadget }, { node: w.keys.n1, concept: w.keys.gadget }]);
  const of = (k) => found.filter((f) => f.node === k);
  assert(of(w.keys.rover).length === 0, `rover, which carries its record, fits gadget's closed schema, its tapestryJSON's record set aside: no finding; got ${String(show(of(w.keys.rover))).slice(0, 500)}`);
  const n = of(w.keys.n1);
  assert(n.length === 1 && n[0].code === 'invalid-fields' && /installed/.test(n[0].message), `n1, with no record, is judged whole: one invalid-fields finding, naming installed; got ${String(show(n)).slice(0, 500)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
