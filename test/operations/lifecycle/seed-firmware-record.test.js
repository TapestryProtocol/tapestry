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
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const F = require('../../helpers/seedFirmwareFixtures');
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

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
