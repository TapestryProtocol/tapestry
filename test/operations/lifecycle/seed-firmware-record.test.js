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
 * properties set on some of its nodes as seed-firmware writes them (JSON text); the judge runs in-process over a small
 * graph, its reads through test/helpers/cypherEngine.js.
 *
 *   SR1 the word deriver: an element's and a header's tapestryJSON gain top-level cameFrom and installed, parsed, beside
 *       what they held
 *   SR2 the set deriver: a set's and a superset's do too
 *   SR3 a node with no record gets neither section
 *   SR4 the judge (src/operations/catalog/graph/_schemas.js) sets both aside: a schema that allows no other top-level
 *       section judges a node's JSON with them as fitting, and still refuses an unknown section, writing or not
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const F = require('../../helpers/seedFirmwareFixtures');
const E = require('../../helpers/cypherEngine');
const S = require('../../helpers/graphOpsSuite');

const { assert, show, TA } = F;
const { test, run } = S.makeSuite('operations: lifecycle seed-firmware — the install record in the cache (the derive and the schema check)');

const CHILD = path.join(F.ROOT, 'test/helpers/seedFirmwareDeriveChild.js');
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
  const dir = F.tmp('seed-firmware-derive-');
  const stateFile = path.join(dir, 'state.json');
  const keysFile = path.join(dir, 'keys.json');
  const keys = [...recs.map((r) => F.nodesAt(s, r.address)[0].props.tapestryKey), plain.props.tapestryKey];
  fs.writeFileSync(stateFile, JSON.stringify(s));
  fs.writeFileSync(keysFile, JSON.stringify(keys));
  const child = spawnSync(process.execPath, [CHILD, stateFile, keysFile], { cwd: F.ROOT, env: F.envFor(dir), encoding: 'utf8', timeout: 60000, maxBuffer: 32 * 1024 * 1024 });
  const line = (child.stdout || '').split(F.NL).find((l) => l.startsWith('RESULT:'));
  assert(line, `the derive child printed no result (exit ${child.status}): ${(child.stderr || '').slice(-500)}`);
  const result = JSON.parse(line.slice(7));
  assert(!result.error, `the derive child failed: ${String(result.error).slice(0, 600)}`);
  DERIVED = { out: result.out, keys, recs, plain: plain.props.tapestryKey };
  return DERIVED;
}
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

test('SR4 [Decision 6]: the judge sets cameFrom and installed aside, as graphContext: a schema that allows no other top-level section finds a node\'s JSON with them fitting, and still refuses an unknown section, writing or not', async () => {
  const X = require(path.join(F.ROOT, 'src/operations/catalog/graph/_schemas.js'));
  const s = F.emptyGraph();
  const header = F.addNode(s, ['ListHeader', 'ConceptHeader'], { uuid: `39998:${TA}:gadget`, name: 'gadget', kind: 39998, pubkey: TA });
  const schema = F.addNode(s, ['ListItem', 'JSONSchema'], { uuid: `39999:${TA}:gadget-schema`, name: 'JSON schema for the concept of gadgets', kind: 39999, pubkey: TA });
  F.addTagNodes(s, schema, [['json', JSON.stringify({ word: { slug: 'json-schema-for-the-concept-of-gadgets', wordTypes: ['word', 'jsonSchema'] }, jsonSchema: {
    type: 'object', additionalProperties: false, required: ['gadget'],
    properties: { word: { type: 'object' }, graphContext: { type: 'object' }, gadget: { type: 'object', properties: { name: { type: 'string' } } } },
  } })]]);
  F.addRel(s, schema, 'IS_THE_JSON_SCHEMA_FOR', header);
  const read = async (q, p) => E.run(s, q, p || {}, { write: false }).rows;
  const base = { word: { slug: 'gadget--sprocket', wordTypes: ['word', 'gadget'] }, gadget: { name: 'Sprocket' }, graphContext: { identifiers: {} } };
  const rec = record('x', 'concepts/gadget/elements/sprocket.json');
  const withRecord = { ...base, cameFrom: rec.cameFrom, installed: rec.installed };
  const plain = await X.judge(read).check(header.props.tapestryKey, base);
  assert(plain.fits === true, `the JSON fits without the record (so the schema is read and checked); got ${show(plain).slice(0, 300)}`);
  for (const writing of [false, true]) {
    const c = await X.judge(read).check(header.props.tapestryKey, withRecord, { writing });
    assert(c.fits === true, `${writing ? 'a write\'s check' : 'the derive\'s and the rule\'s check'}: cameFrom and installed are set aside; got ${show({ fits: c.fits, problems: c.problems }).slice(0, 300)}`);
    const other = await X.judge(read).check(header.props.tapestryKey, { ...withRecord, extra: {} }, { writing });
    assert(other.fits === false && show(other.problems).includes('extra') && !show(other.problems).includes('cameFrom'), `an unknown section is still refused, and only it; got ${show(other.problems).slice(0, 300)}`);
  }
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
