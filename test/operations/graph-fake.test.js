'use strict';
/**
 * The fake graph the write path's suites read their answers from (test/helpers/graphFake.js) — its own suite, so a
 * suite that passes or fails over it does so for the graph's reasons, not the fake's. Run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-foundation/4-the-write-path.md
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0004-the-write-path.md (Decision 9)
 *
 *   F1 a read of one node, with a property map and NOT …:GraphChange, finds nodes as Neo4j would
 *   F2 MERGE between two nodes found by tapestryKey makes one relationship, and says so in its counters, once
 *   F3 a MATCH and DELETE removes every such relationship and counts them; a count answers one row even when none
 *   F4 the CREATE of a GraphChange node keeps its map, its randomUUID() and its SET, and a null SET leaves it out
 *   F4b with keyNode(c) after it (ADR 0003 Decision 8), the node gets the shared label and a key
 *   F5 the declared types' read walks the concept's class thread to each element's json tag
 *   F6 a transaction that throws keeps nothing; one that resolves keeps everything; a read refuses to write
 *   F7 a statement it doesn't run says so, naming it
 *
 * Story graph-operations-foundation #5 (ADR graph-operations-foundation/0005, Implementation notes S1–S8), over the
 * graph test/helpers/fieldGraph.js seeds:
 *   F8  S1, the concept: its header by tapestryKey (a ConceptHeader, or a ListHeader the import brought in), its json,
 *       and its JSON Schema node's json, also through head(collect(…)); no row for a node that isn't a header
 *   F9  S2, the property node: under the section node named for the key, or on the primary property when wrapped; a
 *       node create-property hung off the schema node, a child a level down, and a concept with no primary property
 *       give none
 *   F10 S3, the marks: from the first set by uuid back to each concept header, by either climb, limited to one header
 *   F11 S4, the elements: the class-thread walk, subsets' elements included and each once after WITH DISTINCT (twice
 *       without), its json tag, and its properties under a prefix through keys(); a literal LIMIT caps it, and a
 *       LIMIT sent as a JavaScript number is refused as Neo4j refuses a float
 *   F12 S5, the first set: a read of one node by uuid, WHERE s:Set
 *   F13 S8, the copies: SET n += row.props sets, removes on null, leaves change entries and missing keys alone, keeps
 *       a neo4j.int as an integer and a number as a float, and refuses what Neo4j can't store, keeping nothing
 *   F14 what it still can't run says so: another relationship type, an undirected relationship, UNION, another write
 *
 * Story graph-operations-first-slice #16 (ADR graph-operations-first-slice/0016, Implementation notes C1–C11):
 *   F15 C1, the lock: a node found by uuid answers its key and keeps no property; an address no node has answers no row
 *   F16 C5, a node: CREATE with any labels and a property map, and keyNode(n), gives the labels, the shared label and a
 *       key, and answers the key
 *   F17 C6, its tags: one NostrEventTag per row, each HAS_TAG from the node, a null SET left out, keyed, and counted
 *   F18 C11, a removed tag: DETACH DELETE of a tag node by key takes its HAS_TAG with it; a node that isn't a tag
 *       can't be removed this way
 *   F19 the reads C3, C4, C8 and C9: supersets by IN, held addresses over NostrEvent|TapestryNode, toLower, and a
 *       concept's core nodes over the wiring types, with type(r)
 *   F20 failures.entry fails only a GraphChange's CREATE, so a write's nodes are made before its entry fails
 *
 * Story graph-operations-first-slice #13 (ADR graph-operations-first-slice/0013, Decision 2, S2 and S3), over the graph
 * test/helpers/relationshipsGraph.js seeds:
 *   F21 a one-hop read from a node found by its tapestryKey reads relationships of every type, out and in, with no type
 *       or with one in backticks, a relationship from the node to itself in both directions; F14's limits stay
 *   F22 elementId() of a relationship is text in Neo4j 5's form, one for each relationship, the same on every read
 *   F23 properties() leaves an integer as the driver leaves one inside a map, while [key, value] pairs give a number
 *   F24 a one-hop read keeps the repertoire for any later relationship; a later node, as trust() adds, still runs
 */

const fs = require('fs');
const path = require('path');
const S = require('../helpers/graphOpsSuite');
const G = require('../helpers/graphFake');
const FG = require('../helpers/fieldGraph');

const { HANDLE, ROOT, TA, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: the fake graph');

function fresh() {
  const seed = S.seedGraph();
  const dir = tmp('graph-fake-');
  return { ...seed, path: seed.file(dir), fake: null };
}
function freshFields(opts) {
  const seed = FG.seedFields(opts);
  return { ...seed, path: seed.file(tmp('graph-fake-fields-')) };
}
const neo4jInt = (n) => require(require.resolve('neo4j-driver', { paths: [ROOT] })).int(n);
async function refusedWith(promise) {
  try { await promise; } catch (e) { return e; }
  return null;
}

test('F1: a read of one node, with a property map and NOT …:GraphChange, finds nodes as Neo4j would', async () => {
  const s = fresh();
  const fake = G.fakeGraph(s.path);
  const q = 'MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n.tapestryKey AS key';
  assert(show(await fake.read(q, { key: s.keys.A })) === show([{ key: s.keys.A }]), 'A is found by its key');
  assert(show(await fake.read(q, { key: s.keys.G })) === '[]', 'a change entry is left out');
  const whole = await fake.read('MATCH (n:TapestryNode {tapestryKey: $key}) RETURN n', { key: s.keys.U });
  assert(whole[0].n.pubkey === 'ee'.repeat(32) && show(whole[0].n._labels) === show(['NostrUser', 'TapestryNode']), `a whole node comes back as toJS gives it; got ${show(whole)}`);
});

test('F2: MERGE between two nodes found by tapestryKey makes one relationship, and says so in its counters, once', async () => {
  const s = fresh();
  const fake = G.fakeGraph(s.path);
  const q = 'MATCH (a:TapestryNode {tapestryKey: $from}) WHERE NOT a:GraphChange MATCH (b:TapestryNode) WHERE b.tapestryKey = $to AND NOT b:GraphChange MERGE (a)-[r:`CITES`]->(b) RETURN count(r) AS n';
  const one = await fake.writeTransaction((tx) => tx.run(q, { from: s.keys.A, to: s.keys.B }));
  const two = await fake.writeTransaction((tx) => tx.run(q, { from: s.keys.A, to: s.keys.B }));
  assert(one.counters.relationshipsCreated === 1 && two.counters.relationshipsCreated === 0, `created once, then found; got ${show([one.counters, two.counters])}`);
  assert(show(one.rows) === show([{ n: 1 }]), `its count answers 1; got ${show(one.rows)}`);
  assert(S.relsOf(S.readState(s.path), 'CITES').length === 1, 'one CITES is kept');
  const none = await fake.writeTransaction((tx) => tx.run(q, { from: s.keys.A, to: s.keys.G }));
  assert(none.counters.relationshipsCreated === 0 && show(none.rows) === show([{ n: 0 }]), `a node that isn't found makes nothing; got ${show(none)}`);
});

test('F3: a MATCH and DELETE removes every such relationship and counts them; a count answers one row even when none', async () => {
  const s = fresh();
  const eid = (key) => s.state.nodes.find((n) => n.props.tapestryKey === key).eid;
  s.state.rels.push({ eid: 9001, type: 'CITES', from: eid(s.keys.A), to: eid(s.keys.B), props: {} }, { eid: 9002, type: 'CITES', from: eid(s.keys.A), to: eid(s.keys.B), props: {} });
  G.writeState(s.path, s.state);
  const fake = G.fakeGraph(s.path);
  const q = 'MATCH (a:TapestryNode {tapestryKey: $from})-[r:CITES]->(b:TapestryNode {tapestryKey: $to}) DELETE r RETURN count(r) AS removed';
  const out = await fake.writeTransaction((tx) => tx.run(q, { from: s.keys.A, to: s.keys.B }));
  assert(out.counters.relationshipsDeleted === 2 && show(out.rows) === show([{ removed: 2 }]), `both removed and counted; got ${show(out)}`);
  const again = await fake.writeTransaction((tx) => tx.run(q, { from: s.keys.A, to: s.keys.B }));
  assert(show(again.rows) === show([{ removed: 0 }]), `with none left, the count still answers one row of 0; got ${show(again.rows)}`);
});

test('F4: the CREATE of a GraphChange node keeps its map, its randomUUID() and its SET, and a null SET leaves it out', async () => {
  const s = fresh();
  const fake = G.fakeGraph(s.path);
  const q = 'CREATE (c:GraphChange:TapestryNode {tapestryKey: randomUUID(), at: $at, byRole: $role, operation: $op, keys: $keys, changes: $changes}) SET c.byPubkey = $pubkey RETURN c';
  const p = { at: '2026-11-14T00:00:00.000Z', role: 'local', op: 'graph x', keys: [s.keys.A], changes: '[]', pubkey: null };
  const out = await fake.writeTransaction((tx) => tx.run(q, p));
  const c = out.rows[0].c;
  assert(/^[0-9a-f-]{36}$/.test(c.tapestryKey) && c.at === p.at && c.byRole === 'local' && show(c.keys) === show([s.keys.A]), `the node holds its map; got ${show(c)}`);
  assert(!('byPubkey' in c), `a null SET leaves the property out; got ${show(c)}`);
  assert(show(c._labels) === show(['GraphChange', 'TapestryNode']) && out.counters.nodesCreated === 1, 'it carries both labels, and its counters say a node was made');
});

test('F4b: with keyNode(c) after the CREATE (ADR 0003 Decision 8), the node gets the shared label and a key', async () => {
  const s = fresh();
  const fake = G.fakeGraph(s.path);
  const { keyNode } = require('../../src/lib/tapestry-key-cypher');
  const q = `CREATE (c:GraphChange {at: $at, byRole: $role}) ${keyNode('c')} SET c.byPubkey = $pubkey RETURN c.tapestryKey AS id`;
  const out = await fake.writeTransaction((tx) => tx.run(q, { at: '2026-11-14T00:00:00.000Z', role: 'admin', pubkey: 'bb'.repeat(32) }));
  const id = out.rows[0].id;
  const kept = S.readState(s.path).nodes.find((n) => n.props.tapestryKey === id);
  assert(/^[0-9a-f-]{36}$/.test(id) && kept, `the node has a key, and the RETURN reads it; got ${show(out)}`);
  assert(show(kept.labels) === show(['GraphChange', 'TapestryNode']) && kept.props.byPubkey === 'bb'.repeat(32) && kept.props.at === '2026-11-14T00:00:00.000Z', `it carries the shared label, its map and its SET; got ${show(kept)}`);
});

test('F5: the declared types\' read walks the concept\'s class thread to each element\'s json tag', async () => {
  const s = fresh();
  const fake = G.fakeGraph(s.path);
  const q = 'MATCH (h:NostrEvent|TapestryNode {uuid: $handle}) WHERE h:ConceptHeader MATCH (h)-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*0..]->()-[:HAS_ELEMENT]->(e) WITH DISTINCT e OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag {type: \'json\'}) RETURN e.tapestryKey AS key, t.value AS json';
  const rows = await fake.read(q, { handle: HANDLE });
  const aliases = rows.map((r) => { try { return JSON.parse(r.json).relationshipType.alias; } catch { return null; } });
  for (const a of ['HAS_ELEMENT', 'REFERENCES', 'AUTHORS', 'CITES', 'DEPENDS_ON']) assert(aliases.includes(a), `it reads ${a}'s element; got ${show(aliases)}`);
  assert(rows.every((r) => typeof r.key === 'string'), 'each row has the element\'s key');
  assert(show(await fake.read(q, { handle: '39998:nobody:relationship-type' })) === '[]', 'another handle finds no concept');
});

test('F6: a transaction that throws keeps nothing; one that resolves keeps everything; a read refuses to write', async () => {
  const s = fresh();
  const fake = G.fakeGraph(s.path);
  const q = 'MATCH (a:TapestryNode {tapestryKey: $from}), (b:TapestryNode {tapestryKey: $to}) MERGE (a)-[r:CITES]->(b)';
  let threw = null;
  try { await fake.writeTransaction(async (tx) => { await tx.run(q, { from: s.keys.A, to: s.keys.B }); throw new Error('boom'); }); } catch (e) { threw = e; }
  assert(threw && threw.message === 'boom', 'the throw reaches the caller');
  assert(S.relsOf(S.readState(s.path), 'CITES').length === 0, 'nothing written before the throw is kept');
  assert(S.readState(s.path).log.some((e) => e.call === 'rollback'), 'the log says it rolled back');
  await fake.writeTransaction((tx) => tx.run(q, { from: s.keys.A, to: s.keys.B }));
  assert(S.relsOf(S.readState(s.path), 'CITES').length === 1, 'a transaction that resolves keeps its writes');
  let refused = null;
  try { await fake.read(q, { from: s.keys.B, to: s.keys.A }); } catch (e) { refused = e; }
  assert(refused && /a read must write nothing/.test(refused.message), `a read that writes is refused; got ${refused && refused.message}`);
});

test('F7: a statement it doesn\'t run says so, naming it', async () => {
  const s = fresh();
  const fake = G.fakeGraph(s.path);
  let err = null;
  try { await fake.writeTransaction((tx) => tx.run('MATCH (n) DETACH DELETE n', {})); } catch (e) { err = e; }
  assert(err && /the fake graph can't run this Cypher/.test(err.message) && /DETACH DELETE/.test(err.message), `it says it can't run it, naming it; got ${err && err.message}`);
  void fs; void path;
});

// ── ADR 0005's statements ──

const S1 = `MATCH (h:TapestryNode {tapestryKey: $key}) WHERE h:ConceptHeader OR h:ListHeader
  OPTIONAL MATCH (h)-[:HAS_TAG]->(ht:NostrEventTag {type: 'json'})
  OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
  OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
  RETURN h.uuid AS uuid, h.name AS name, ht.value AS headerJson, jt.value AS schemaJson
  LIMIT 1`;

test('F8: S1 reads a concept by its header\'s tapestryKey, a ConceptHeader or an imported ListHeader, with both json values', async () => {
  const s = freshFields();
  const fake = G.fakeGraph(s.path);
  const [dog] = await fake.read(S1, { key: s.keys.dog });
  assert(dog && dog.uuid === `39998:${TA}:dog` && dog.name === 'dog', `the dog header is found by its key; got ${show(dog)}`);
  assert(JSON.parse(dog.headerJson).conceptHeader.oKeys.singular === 'dog', `its json is the header's json tag, not its d or name tag; got ${show(dog.headerJson)}`);
  assert(Object.keys(JSON.parse(dog.schemaJson).jsonSchema.properties).sort().join() === 'dog,word', `the schema's json is the JSON Schema node's; got ${show(dog.schemaJson)}`);
  const [cat] = await fake.read(S1, { key: s.keys.cat });
  assert(cat && cat.uuid === `39998:${TA}:cat`, `a header labelled ListHeader only is found too; got ${show(cat)}`);
  assert(show(await fake.read(S1, { key: s.keys.rover })) === '[]', 'an element\'s key finds no header');
  assert(show(await fake.read(S1, { key: '00000000-0000-4000-8000-000000000000' })) === '[]', 'a key nothing has finds nothing');
  const onlyConceptHeader = S1.replace('WHERE h:ConceptHeader OR h:ListHeader', 'WHERE h:ConceptHeader');
  assert(show(await fake.read(onlyConceptHeader, { key: s.keys.cat })) === '[]', 'it reads the WHERE as written: a ListHeader-only header is not a ConceptHeader');
  const collected = `MATCH (h:TapestryNode {tapestryKey: $key}) WHERE h:ConceptHeader OR h:ListHeader
    OPTIONAL MATCH (h)-[:HAS_TAG]->(ht:NostrEventTag {type: 'json'})
    WITH h, head(collect(ht.value)) AS headerJson
    OPTIONAL MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(h)
    OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
    RETURN h.uuid AS uuid, headerJson, head(collect(jt.value)) AS schemaJson`;
  const [viaCollect] = await fake.read(collected, { key: s.keys.widget });
  assert(viaCollect && JSON.parse(viaCollect.headerJson).conceptHeader.oKeys.singular === 'widget' && JSON.parse(viaCollect.schemaJson).jsonSchema.properties.widget, `head(collect(…)) answers the same values; got ${show(viaCollect)}`);
});

test('F9: S2 finds the field\'s node under the section node, or on the primary property when wrapped, and nothing else', async () => {
  const s = freshFields();
  const fake = G.fakeGraph(s.path);
  const unwrapped = `MATCH (h:TapestryNode {tapestryKey: $concept})<-[:IS_THE_PRIMARY_PROPERTY_FOR]-(pp:Property)
    MATCH (sec:Property {name: $key})-[:IS_A_PROPERTY_OF]->(pp)
    MATCH (p:Property)-[:IS_A_PROPERTY_OF]->(sec) WHERE p.name = $field
    RETURN p.tapestryKey AS key`;
  const wrapped = `MATCH (pp:Property)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h:TapestryNode {tapestryKey: $concept})
    MATCH (p:Property)-[:IS_A_PROPERTY_OF]->(pp) WHERE p.name = $field
    RETURN p.tapestryKey AS key`;
  const keysOf = async (q, p) => (await fake.read(q, p)).map((r) => r.key);
  assert(show(await keysOf(unwrapped, { concept: s.keys.dog, key: 'dog', field: 'breed' })) === show([s.keys.dogProp.breed]), 'dog\'s breed: the tree\'s node under the dog section, not the create-property node off the schema node');
  assert(show(await keysOf(unwrapped, { concept: s.keys.dog, key: 'dog', field: 'name' })) === show([s.keys.dogProp.name]), 'dog\'s name: the section\'s child, not owner\'s child a level down');
  assert(show(await keysOf(unwrapped, { concept: s.keys.dog, key: 'dog', field: 'nickname' })) === '[]', 'a field whose only node create-property made has none');
  assert(show(await keysOf(unwrapped, { concept: s.keys.dog, key: 'dog', field: 'wordTypes' })) === '[]', 'a child of the word section is no field of dog');
  assert(show(await keysOf(wrapped, { concept: s.keys.widget, field: 'color' })) === show([s.keys.widgetProp.color]), 'widget\'s color hangs on its primary property');
  assert(show(await keysOf(wrapped, { concept: s.keys.rock, field: 'hardness' })) === '[]', 'a concept with no primary property has no tree node');
});

const S3 = `MATCH (s:Set {uuid: $set})-[:HAS_ELEMENT]->(p:Property)-[:IS_A_PROPERTY_OF]->(parent:Property)
  OPTIONAL MATCH (parent)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h1)
  OPTIONAL MATCH (parent)-[:IS_A_PROPERTY_OF]->(:Property)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h2)
  WITH p, parent, coalesce(h1, h2) AS h
  WHERE h IS NOT NULL AND ($concept IS NULL OR h.tapestryKey = $concept)
  OPTIONAL MATCH (h)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'})
  RETURN p.tapestryKey AS node, p.name AS field, parent.name AS parent, h.tapestryKey AS concept, t.value AS json`;

test('F10: S3 climbs from each of the first set\'s elements back to its concept\'s header, either way, and can keep one header', async () => {
  const s = freshFields({ marks: [['dog', 'breed'], ['widget', 'color'], ['otherDog', 'name']] });
  const fake = G.fakeGraph(s.path);
  const rows = await fake.read(S3, { set: FG.SET1, concept: null });
  const got = rows.map((r) => `${r.field}@${r.concept === s.keys.dog ? 'dog' : r.concept === s.keys.widget ? 'widget' : r.concept === s.keys.otherDog ? 'otherDog' : r.concept}`).sort();
  assert(show(got) === show(['breed@dog', 'color@widget', 'name@otherDog']), `three marks, each back to its own header; got ${show(rows)}`);
  const dogRow = rows.find((r) => r.field === 'breed');
  assert(dogRow.parent === 'dog' && dogRow.node === s.keys.dogProp.breed && JSON.parse(dogRow.json).conceptHeader.oKeys.singular === 'dog', `dog's mark climbs through the dog section, with the header's json; got ${show(dogRow)}`);
  assert(rows.find((r) => r.field === 'color').parent === 'primary property for the concept of widgets', 'widget\'s mark hangs on the primary property');
  const one = await fake.read(S3, { set: FG.SET1, concept: s.keys.widget });
  assert(show(one.map((r) => r.field)) === show(['color']), `limited to widget's header, only its mark; got ${show(one)}`);
  const varLength = `MATCH (s:Set {uuid: $set})-[:HAS_ELEMENT]->(p:Property)-[:IS_A_PROPERTY_OF]->(parent:Property)-[:IS_A_PROPERTY_OF*0..1]->(pp:Property)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(h)
    RETURN p.name AS field, h.tapestryKey AS concept`;
  const viaRange = (await fake.read(varLength, { set: FG.SET1 })).map((r) => r.field).sort();
  assert(show(viaRange) === show(['breed', 'color', 'name']), `the same marks through *0..1; got ${show(viaRange)}`);
});

const S4 = (limit) => `MATCH (h:TapestryNode {tapestryKey: $concept}) WHERE h:ConceptHeader OR h:ListHeader
  MATCH (h)-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*0..]->()-[:HAS_ELEMENT]->(e)
  WITH DISTINCT e
  OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'})
  RETURN e.tapestryKey AS key, t.value AS json, [k IN keys(e) WHERE k STARTS WITH $prefix | [k, e[k]]] AS copies
  LIMIT ${limit}`;

test('F11: S4 walks the class thread to each element once, with its json tag and its properties under the prefix', async () => {
  const s = freshFields({ copies: { rover: { dog_breed: 'goldenRetriever', dog_age: { $int: '3' }, dog_scores: [{ $int: '1' }, { $int: '2' }] } } });
  const fake = G.fakeGraph(s.path);
  const rows = await fake.read(S4(10001), { concept: s.keys.dog, prefix: 'dog_' });
  const k = s.keys;
  const want = ['rover', 'spot', 'bella', 'fido', 'rex', 'flat', 'luna', 'ghost', 'max', 'od1'].map((n) => k[n]).sort();
  assert(show(rows.map((r) => r.key).sort()) === show(want), `dog's ten elements, spot through the walkers set, bella once, and not the unwired stray; got ${rows.length} rows`);
  const rover = rows.find((r) => r.key === k.rover);
  assert(JSON.parse(rover.json).dog.breed === 'goldenRetriever', `its json is the element's json tag; got ${show(rover.json)}`);
  const copies = Object.fromEntries(rover.copies);
  assert(show(copies) === show({ dog_breed: 'goldenRetriever', dog_age: 3, dog_scores: [1, 2] }), `its dog_ properties, an integer as a number, as toJS gives it; got ${show(rover.copies)}`);
  assert(rows.find((r) => r.key === k.luna).json === `lmdb:${s.lunaKey}`, 'an LMDB reference comes back as the tag holds it');
  const noDistinct = S4(10001).replace('WITH DISTINCT e', 'WITH e');
  assert((await fake.read(noDistinct, { concept: k.dog, prefix: 'dog_' })).filter((r) => r.key === k.bella).length === 2, 'without DISTINCT, an element reached two ways comes back twice, as in Neo4j');
  assert((await fake.read(S4(2), { concept: k.dog, prefix: 'dog_' })).length === 2, 'a literal LIMIT caps the rows');
  const asParam = S4(10001).replace('LIMIT 10001', 'LIMIT $limit');
  const refused = await refusedWith(fake.read(asParam, { concept: k.dog, prefix: 'dog_', limit: 10001 }));
  assert(refused && /LIMIT/.test(refused.message) && /float|10001\.0/.test(refused.message), `a LIMIT sent as a JavaScript number is refused, as Neo4j refuses a float; got ${refused && refused.message}`);
  assert((await fake.read(asParam, { concept: k.dog, prefix: 'dog_', limit: neo4jInt(3) })).length === 3, 'a LIMIT sent as a neo4j.int is taken');
});

test('F12: S5 reads the first set by uuid, WHERE s:Set, as a read of one node', async () => {
  const s = freshFields();
  const fake = G.fakeGraph(s.path);
  const rows = await fake.read('MATCH (s:TapestryNode {uuid: $uuid}) WHERE s:Set RETURN s.tapestryKey AS key', { uuid: FG.SET1 });
  assert(show(rows) === show([{ key: s.keys.set1 }]), `the first set's key; got ${show(rows)}`);
  const byLabel = await fake.read('MATCH (s:Set {uuid: $uuid}) RETURN s.tapestryKey AS key', { uuid: FG.SET1 });
  assert(show(byLabel) === show([{ key: s.keys.set1 }]), `also with the label in the pattern; got ${show(byLabel)}`);
  const none = freshFields({ noFirstSet: true });
  assert(show(await G.fakeGraph(none.path).read('MATCH (s:TapestryNode {uuid: $uuid}) WHERE s:Set RETURN s.tapestryKey AS key', { uuid: FG.SET1 })) === '[]', 'with no first set, nothing');
});

const S8 = 'UNWIND $rows AS row MATCH (n:TapestryNode {tapestryKey: row.key}) WHERE NOT n:GraphChange SET n += row.props';

test('F13: S8 sets and removes copies, keeps a neo4j.int as an integer and a number as a float, and refuses what Neo4j can\'t store', async () => {
  const s = freshFields({ copies: { rover: { dog_stale: 'x' } } });
  const entry = { eid: s.state.nextEid++, labels: ['GraphChange', 'TapestryNode'], props: { tapestryKey: '11111111-1111-4111-8111-111111111111', at: '2026-01-01T00:00:00.000Z' } };
  s.state.nodes.push(entry);
  G.writeState(s.path, s.state);
  const fake = G.fakeGraph(s.path);
  const k = s.keys;
  const out = await fake.writeTransaction((tx) => tx.run(S8, { rows: [
    { key: k.rover, props: { dog_breed: 'goldenRetriever', dog_age: neo4jInt(3), dog_weight: 30.5, dog_whole: 30, dog_scores: [neo4jInt(1), neo4jInt(2)], dog_nicknames: ['Ro'], dog_stale: null } },
    { key: entry.props.tapestryKey, props: { dog_breed: 'nope' } },
    { key: '00000000-0000-4000-8000-000000000000', props: { dog_breed: 'nope' } },
  ] }));
  const g = S.readState(s.path);
  const c = FG.copiesOn(g, k.rover, 'dog_');
  assert(c.dog_breed === 'goldenRetriever' && show(c.dog_nicknames) === show(['Ro']), `strings and lists of them are kept; got ${show(c)}`);
  assert(FG.isInt(c.dog_age) && c.dog_age.$int === '3' && c.dog_scores.every(FG.isInt), `a neo4j.int is kept as an integer, in a list too; got ${show(c)}`);
  assert(c.dog_weight === 30.5 && c.dog_whole === 30 && !FG.isInt(c.dog_whole), `a JavaScript number is kept as a float, a whole one too; got ${show(c)}`);
  assert(!('dog_stale' in c), `a null removes the property; got ${show(c)}`);
  assert(!('dog_breed' in g.nodes.find((n) => n.props.tapestryKey === entry.props.tapestryKey).props), 'a change entry is left alone (NOT n:GraphChange)');
  assert(out.counters.propertiesSet > 0, `its counters say properties were set; got ${show(out.counters)}`);
  const back = await fake.read(S4(10001), { concept: k.dog, prefix: 'dog_' });
  assert(Object.fromEntries(back.find((r) => r.key === k.rover).copies).dog_age === 3, 'a read gives the integer back as a number');
  for (const [what, bad] of [['a map', { name: 'mutt' }], ['a list holding a null', ['Fi', null]], ['a list of mixed types', ['Bee', 3]], ['an integer among floats', [neo4jInt(1), 1.5]], ['a list of lists', [[1, 2]]]]) {
    const err = await refusedWith(fake.writeTransaction((tx) => tx.run(S8, { rows: [{ key: k.spot, props: { dog_breed: 'irishSetter', dog_bad: bad } }] })));
    assert(err && /Neo4j can't store/.test(err.message), `${what} is refused, as Neo4j refuses it; got ${err && err.message}`);
  }
  assert(!('dog_breed' in FG.copiesOn(S.readState(s.path), k.spot, 'dog_')), 'a refused write keeps nothing, not even the good copy beside it');
  const asRead = await refusedWith(fake.read(S8, { rows: [] }));
  assert(asRead && /a read must write nothing/.test(asRead.message), `outside a write transaction it is refused; got ${asRead && asRead.message}`);
  const keyInWhere = 'UNWIND $rows AS row MATCH (n:TapestryNode) WHERE n.tapestryKey = row.key AND NOT n:GraphChange SET n += row.props RETURN count(n) AS n';
  const counted = await fake.writeTransaction((tx) => tx.run(keyInWhere, { rows: [{ key: k.w1, props: { widget_color: 'red' } }] }));
  assert(show(counted.rows) === show([{ n: 1 }]) && FG.copiesOn(S.readState(s.path), k.w1, 'widget_').widget_color === 'red', `the key in the WHERE works too, with RETURN count(n); got ${show(counted)}`);
});

test('F14: what it still can\'t run says so: another relationship type, an undirected relationship, UNION, another write', async () => {
  const s = freshFields();
  const fake = G.fakeGraph(s.path);
  const cases = [
    ['MATCH (a:TapestryNode {tapestryKey: $k})-[:FOLLOWS]->(b) RETURN b.tapestryKey AS key', /FOLLOWS/],
    ['MATCH (a:TapestryNode {tapestryKey: $k})-[:HAS_TAG]-(b) RETURN b.tapestryKey AS key', /undirected/],
    ['MATCH (a:TapestryNode {tapestryKey: $k})-[:HAS_TAG]->(b) RETURN b.value AS v UNION MATCH (a:TapestryNode {tapestryKey: $k})-[:HAS_TAG]->(b) RETURN b.value AS v', /UNION/],
    ['MATCH (a:TapestryNode {tapestryKey: $k})-->(b) RETURN b.value AS v', /no \[ \]/],
  ];
  for (const [q, re] of cases) {
    const err = await refusedWith(fake.read(q, { k: s.keys.rover }));
    assert(err && /the fake graph can't run this Cypher/.test(err.message) && re.test(err.message), `it says it can't run ${q.slice(0, 60)}…, naming why (${re}); got ${err && err.message}`);
  }
  for (const q of ['MATCH (n:TapestryNode {tapestryKey: $k}) SET n.dog_breed = $v', 'UNWIND $rows AS row MATCH (n {uuid: row.uuid}) SET n += row.props']) {
    const err = await refusedWith(fake.writeTransaction((tx) => tx.run(q, { k: s.keys.rover, v: 'x', rows: [] })));
    assert(err && /the fake graph can't run this Cypher/.test(err.message), `it can't run ${q}; got ${err && err.message}`);
  }
});

// ── ADR graph-operations-first-slice/0016's statements ──

const { keyNode } = require('../../src/lib/tapestry-key-cypher');

/** A small state of its own: a header with two core nodes, wired, and a tag; { path, keys }. */
function freshConcept() {
  const s = G.emptyState();
  const add = (labels, props) => { const n = { eid: s.nextEid++, labels, props }; s.nodes.push(n); return n; };
  const link = (a, type, b) => s.rels.push({ eid: s.nextEid++, type, from: a.eid, to: b.eid, props: {} });
  const key = () => require('crypto').randomUUID();
  const h = add(['NostrEvent', 'ListHeader', 'ConceptHeader', 'TapestryNode'], { uuid: `39998:${TA}:dog`, name: 'Dog', pubkey: TA, tapestryKey: key() });
  const sup = add(['NostrEvent', 'ListItem', 'Superset', 'TapestryNode'], { uuid: `39999:${TA}:dog-superset`, name: 'superset for the concept of dogs', tapestryKey: key() });
  const js = add(['NostrEvent', 'ListItem', 'JSONSchema', 'TapestryNode'], { uuid: `39999:${TA}:dog-schema`, name: 'JSON schema for the concept of dogs', tapestryKey: key() });
  const core = add(['NostrEvent', 'ListItem', 'TapestryNode'], { uuid: `39999:${TA}:dog-core-nodes-graph`, name: 'core nodes graph for the concept of dogs', tapestryKey: key() });
  const tag = add(['NostrEventTag', 'TapestryNode'], { type: 'names', value: 'dog', value1: 'dogs', tapestryKey: key() });
  link(h, 'IS_THE_CONCEPT_FOR', sup);
  link(js, 'IS_THE_JSON_SCHEMA_FOR', h);
  link(core, 'IS_THE_CORE_GRAPH_FOR', h);
  link(h, 'HAS_TAG', tag);
  const file = path.join(tmp('graph-fake-concept-'), 'graph.json');
  G.writeState(file, s);
  return { path: file, keys: { h: h.props.tapestryKey, sup: sup.props.tapestryKey, js: js.props.tapestryKey, core: core.props.tapestryKey, tag: tag.props.tapestryKey } };
}
const nodeBy = (state, key) => state.nodes.find((n) => n.props.tapestryKey === key);

test('F15: C1, the lock: a node found by uuid answers its key and keeps no property; an address no node has answers no row', async () => {
  const c = freshConcept();
  const fake = G.fakeGraph(c.path);
  const C1 = 'MATCH (n:NostrEvent|TapestryNode {uuid: $uuid}) SET n.tapestryLock = true REMOVE n.tapestryLock RETURN n.tapestryKey AS key';
  const got = await fake.writeTransaction((tx) => tx.run(C1, { uuid: `39998:${TA}:dog` }));
  assert(show(got.rows) === show([{ key: c.keys.h }]), `the lock answers the node's key; got ${show(got.rows)}`);
  const after = G.readState(c.path);
  assert(!('tapestryLock' in nodeBy(after, c.keys.h).props), 'the lock keeps no property on the node');
  assert(after.log.some((l) => l.kind === 'lock'), `the log names the lock; got ${show(after.log.map((l) => l.kind))}`);
  const none = await fake.writeTransaction((tx) => tx.run(C1, { uuid: `39998:${TA}:nobody` }));
  assert(none.rows.length === 0, `an address no node has answers no row; got ${show(none.rows)}`);
});

test('F16: C5, a node: CREATE with any labels and a map, and keyNode(n), gives the labels, the shared label and a key', async () => {
  const c = freshConcept();
  const fake = G.fakeGraph(c.path);
  const C5 = `CREATE (n:ListItem:Superset {uuid: $uuid, kind: $kind, pubkey: $pubkey, name: $name, tapestryValue: $name, created_at: $at}) ${keyNode('n')} RETURN n.tapestryKey AS key`;
  const got = await fake.writeTransaction((tx) => tx.run(C5, { uuid: `39999:${TA}:cat-superset`, kind: 39999, pubkey: TA, name: 'superset for the concept of cats', at: 1 }));
  const key = got.rows[0] && got.rows[0].key;
  assert(/^[0-9a-f-]{36}$/.test(String(key)) && got.counters.nodesCreated === 1, `it answers the new node's key and counts it; got ${show(got)}`);
  const n = nodeBy(G.readState(c.path), key);
  assert(n && show([...n.labels].sort()) === show(['ListItem', 'Superset', 'TapestryNode']), `the node has its labels and the shared label, and no NostrEvent; got ${show(n && n.labels)}`);
  assert(n.props.name === 'superset for the concept of cats' && n.props.tapestryValue === n.props.name && n.props.kind === 39999 && n.props.uuid === `39999:${TA}:cat-superset`,
    `it keeps the map, a parameter used twice included; got ${show(n.props)}`);
});

test('F17: C6, its tags: one NostrEventTag per row, each HAS_TAG from the node, a null SET left out, keyed, and counted', async () => {
  const c = freshConcept();
  const fake = G.fakeGraph(c.path);
  const C6 = `MATCH (n:TapestryNode {tapestryKey: $key}) UNWIND $tags AS t CREATE (n)-[:HAS_TAG]->(tn:NostrEventTag {uuid: t.uuid, type: t.type, value: t.value}) SET tn.value1 = t.value1, tn.value2 = t.value2 ${keyNode('tn')} RETURN count(tn) AS made`;
  const tags = [{ uuid: 'u1', type: 'd', value: 'dog-superset', value1: null, value2: null }, { uuid: 'u2', type: 'names', value: 'dog', value1: 'dogs', value2: null }];
  const got = await fake.writeTransaction((tx) => tx.run(C6, { key: c.keys.sup, tags }));
  assert(show(got.rows) === show([{ made: 2 }]) && got.counters.nodesCreated === 2 && got.counters.relationshipsCreated === 2, `two tags made and counted; got ${show(got)}`);
  const s = G.readState(c.path);
  const sup = nodeBy(s, c.keys.sup);
  const made = s.rels.filter((r) => r.from === sup.eid && r.type === 'HAS_TAG').map((r) => s.nodes.find((n) => n.eid === r.to));
  assert(made.length === 2 && made.every((t) => t.labels.includes('NostrEventTag') && t.labels.includes('TapestryNode') && /^[0-9a-f-]{36}$/.test(t.props.tapestryKey)), `two keyed tag nodes hang off the superset; got ${show(made)}`);
  const names = made.find((t) => t.props.type === 'names');
  const d = made.find((t) => t.props.type === 'd');
  assert(names.props.value1 === 'dogs' && !('value2' in names.props) && !('value1' in d.props), `a null SET leaves the property out; got ${show(made.map((t) => t.props))}`);
  const none = await fake.writeTransaction((tx) => tx.run(C6, { key: '00000000-0000-4000-8000-000000000000', tags }));
  assert(show(none.rows) === show([{ made: 0 }]) && none.counters.nodesCreated === 0, `no node, no tags; got ${show(none)}`);
});

test('F18: C11, a removed tag: DETACH DELETE of a tag node by key takes its HAS_TAG with it; a node that isn\'t a tag can\'t go this way', async () => {
  const c = freshConcept();
  const fake = G.fakeGraph(c.path);
  const got = await fake.writeTransaction((tx) => tx.run('MATCH (t:NostrEventTag:TapestryNode {tapestryKey: $key}) DETACH DELETE t', { key: c.keys.tag }));
  assert(got.counters.nodesDeleted === 1 && got.counters.relationshipsDeleted === 1, `one tag and its HAS_TAG removed; got ${show(got.counters)}`);
  const s = G.readState(c.path);
  assert(!nodeBy(s, c.keys.tag) && !s.rels.some((r) => r.type === 'HAS_TAG'), 'the tag and its relationship are gone');
  const err = await refusedWith(fake.writeTransaction((tx) => tx.run('MATCH (t:TapestryNode {tapestryKey: $key}) DETACH DELETE t', { key: c.keys.h })));
  assert(err && /the fake graph can't run this Cypher/.test(err.message) && /tag node/.test(err.message), `a node that isn't a tag is refused; got ${err && err.message}`);
  assert(nodeBy(G.readState(c.path), c.keys.h), 'and the header is still there');
});

test('F19: the reads C3, C4, C8 and C9: supersets by IN, held addresses, toLower, and core nodes over the wiring types', async () => {
  const c = freshConcept();
  const fake = G.fakeGraph(c.path);
  const sup = await fake.read('MATCH (h)-[:IS_THE_CONCEPT_FOR]->(s:Superset) WHERE h.uuid IN $uuids RETURN h.uuid AS concept, s.tapestryKey AS superset', { uuids: [`39998:${TA}:dog`, `39998:${TA}:none`] });
  assert(show(sup) === show([{ concept: `39998:${TA}:dog`, superset: c.keys.sup }]), `C3 finds the superset of each concept named; got ${show(sup)}`);
  const held = await fake.read('MATCH (n:NostrEvent|TapestryNode) WHERE n.uuid IN $uuids RETURN n.uuid AS uuid', { uuids: [`39999:${TA}:dog-schema`, `39999:${TA}:free`] });
  assert(show(held) === show([{ uuid: `39999:${TA}:dog-schema` }]), `C4 answers the addresses held; got ${show(held)}`);
  const lower = await fake.read(`MATCH (h) WHERE (h:ConceptHeader OR h:ListHeader)
    OPTIONAL MATCH (h)-[:HAS_TAG]->(t:NostrEventTag) WHERE t.type IN ['names', 'slug']
    WITH h, t WHERE toLower(h.name) IN $names OR (t.type = 'names' AND toLower(t.value1) IN $names)
    RETURN DISTINCT h.tapestryKey AS key`, { names: ['dog'] });
  assert(show(lower) === show([{ key: c.keys.h }]), `C8's toLower compares names without case; got ${show(lower)}`);
  const roles = await fake.read(`MATCH (h:TapestryNode {tapestryKey: $key}) WHERE h:ConceptHeader OR h:ListHeader
    OPTIONAL MATCH (h)<-[r:IS_THE_JSON_SCHEMA_FOR|IS_THE_CORE_GRAPH_FOR|IS_THE_PROPERTIES_SET_FOR]-(c)
    RETURN type(r) AS role, c.tapestryKey AS node ORDER BY role`, { key: c.keys.h });
  assert(show(roles) === show([{ role: 'IS_THE_CORE_GRAPH_FOR', node: c.keys.core }, { role: 'IS_THE_JSON_SCHEMA_FOR', node: c.keys.js }]), `C9 walks the wiring types in, with type(r); got ${show(roles)}`);
});

test('F20: failures.entry fails only a GraphChange\'s CREATE, so a write\'s nodes are made before its entry fails', async () => {
  const c = freshConcept();
  const s = G.readState(c.path);
  s.failures = { entry: true };
  G.writeState(c.path, s);
  const fake = G.fakeGraph(c.path);
  const before = G.readState(c.path).nodes.length;
  let made = null;
  const err = await refusedWith(fake.writeTransaction(async (tx) => {
    made = await tx.run(`CREATE (n:ListItem {uuid: $uuid, name: $name}) ${keyNode('n')} RETURN n.tapestryKey AS key`, { uuid: `39999:${TA}:x`, name: 'x' });
    await tx.run(`CREATE (c:GraphChange {at: $at}) ${keyNode('c')} RETURN c.tapestryKey AS id`, { at: '2026-01-01T00:00:00.000Z' });
  }));
  assert(made && made.rows.length === 1, `the node's CREATE ran; got ${show(made)}`);
  assert(err && /failures\.entry/.test(err.message), `the entry's CREATE failed; got ${err && err.message}`);
  assert(G.readState(c.path).nodes.length === before, 'and the transaction kept nothing');
});

// ── story graph-operations-first-slice #13: the one-hop reads ──
const RG = require('../helpers/relationshipsGraph');

test('F21: a one-hop read from a node found by its tapestryKey reads relationships of every type, out and in; F14\'s limits stay', async () => {
  const seed = RG.seedRelationships();
  const read = G.readerOver(seed.state);
  const k = seed.keys;
  const name = (key) => Object.keys(k).find((n) => k[n] === key) || key;
  const out = await read('MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) WHERE m.tapestryKey IS NOT NULL RETURN type(r) AS type, m.tapestryKey AS key ORDER BY type, key', { key: k.hub });
  const outTypes = [...new Set(out.map((row) => row.type))].sort();
  assert(show(outTypes) === show(['CITES', 'DEPENDS_ON', 'HAS_TAG', 'MENTIONS']), `with no type, every type out of hub, CITES and MENTIONS among them (neither in the repertoire); got ${show(outTypes)}`);
  const inn = await read('MATCH (x:TapestryNode {tapestryKey: $key})<-[r]-(m) RETURN type(r) AS type, m.tapestryKey AS key', { key: k.hub });
  assert(show(inn.map((row) => `${row.type} ${name(row.key)}`).sort()) === show(['CITES citer', 'DEPENDS_ON dependent', 'HAS_ELEMENT holder', 'MENTIONS hub', 'REFERENCES otherTag']), `incoming, the loop among them; got ${show(inn)}`);
  const loopOut = out.filter((row) => row.key === k.hub);
  assert(loopOut.length === 1 && loopOut[0].type === 'MENTIONS', `the loop is matched once out; got ${show(loopOut)}`);
  const typed = await read('MATCH (x:TapestryNode {tapestryKey: $key})-[r:`TAGS`]->(m) RETURN m.tapestryKey AS key', { key: k.alice });
  assert(typed.length === 3 && typed.every((row) => row.key === k.bob), `one type in backticks, TAGS, outside the repertoire: alice's three to bob; got ${show(typed)}`);
  const typedIn = await read('MATCH (x:TapestryNode {tapestryKey: $key})<-[r:`TAGS`]-(m) RETURN m.tapestryKey AS key', { key: k.alice });
  assert(show(typedIn.map((row) => row.key)) === show([k.carol]), `in, one type: carol's; got ${show(typedIn)}`);
  const still = [
    ['MATCH (x:TapestryNode {tapestryKey: $key})-[:TAGS]->(m) RETURN m.tapestryKey AS key', /TAGS/],
    ['MATCH (x:TapestryNode {tapestryKey: $key})-[r:TAGS]->(m) RETURN m.tapestryKey AS key', /TAGS/],
    ['MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m)-[s]->(n) RETURN n.tapestryKey AS key', /no type/],
    ['MATCH (x:TapestryNode {tapestryKey: $key}) MATCH (x)-[r]->(m) RETURN m.tapestryKey AS key', /no type/],
    ['MATCH (x:TapestryNode {tapestryKey: $key})-[r]-(m) RETURN m.tapestryKey AS key', /undirected/],
  ];
  for (const [q, re] of still) {
    const err = await refusedWith(read(q, { key: k.alice }));
    assert(err && /the fake graph can't run this Cypher/.test(err.message) && re.test(err.message), `it still can't run ${q.slice(0, 70)}…, naming why (${re}); got ${err && err.message}`);
  }
});

test('F22: elementId() of a relationship is text in Neo4j 5\'s form, one for each relationship, the same on every read', async () => {
  const seed = RG.seedRelationships();
  const read = G.readerOver(seed.state);
  const q = 'MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) RETURN type(r) AS type, elementId(r) AS rid ORDER BY rid';
  const first = await read(q, { key: seed.keys.alice });
  const again = await read(q, { key: seed.keys.alice });
  assert(first.length === 4 && first.every((row) => typeof row.rid === 'string' && /^5:[0-9a-f-]+:\d+$/.test(row.rid)), `each relationship's id is text, 5:<database id>:<n>; got ${show(first)}`);
  assert(new Set(first.map((row) => row.rid)).size === 4, `the three TAGS between the same two nodes, and the FOLLOWS, have four ids; got ${show(first)}`);
  assert(show(first) === show(again), 'the same ids on every read');
  const after = await read('MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) WHERE elementId(r) > $after RETURN elementId(r) AS rid ORDER BY rid', { key: seed.keys.alice, after: first[1].rid });
  assert(show(after.map((row) => row.rid)) === show(first.slice(2).map((row) => row.rid)), `ids compare as text, as a cursor compares them; got ${show(after)}`);
});

test('F23: properties() leaves an integer as the driver leaves one inside a map, while [key, value] pairs give a number', async () => {
  const seed = RG.seedRelationships();
  const read = G.readerOver(seed.state);
  const rows = await read('MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) RETURN type(r) AS type, properties(r) AS map, [k IN keys(r) | [k, r[k]]] AS pairs', { key: seed.keys.alice });
  const follows = rows.find((row) => row.type === 'FOLLOWS');
  assert(follows && typeof follows.map.timestamp !== 'number' && follows.map.timestamp !== null, `properties(r): the integer timestamp is not a number, as the driver's toJS leaves a map's Integer; got ${show(follows && follows.map)}`);
  assert(show(follows.pairs) === show([['timestamp', Number(RG.FOLLOWED_AT)]]), `[k IN keys(r) | [k, r[k]]]: the pairs give the integer as a number, as toJS converts a list's items; got ${show(follows.pairs)}`);
});

// Review finding 2 (engineering-team/reviews/graph-operations-first-slice/13-list-relationships.md): the repertoire is
// lifted for the opening one-hop alone, so a later relationship still fails loudly.
test('F24: a one-hop read keeps the repertoire for any later relationship; a later node, as trust() adds, still runs', async () => {
  const seed = RG.seedRelationships();
  const read = G.readerOver(seed.state);
  const k = seed.keys;
  const later = [
    ['a later OPTIONAL MATCH', 'MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) OPTIONAL MATCH (m)-[:TAGS]->(z) RETURN m.tapestryKey AS key, z.tapestryKey AS z'],
    ['a later MATCH', 'MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) WHERE m.tapestryKey IS NOT NULL MATCH (m)-[:TAGS]->(z) RETURN m.tapestryKey AS key'],
    ['a pattern in WHERE', 'MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) WHERE NOT (m)-[:TAGS]->() RETURN m.tapestryKey AS key'],
    ['a later relationship with no brackets', 'MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) OPTIONAL MATCH (m)-->(z) RETURN m.tapestryKey AS key'],
  ];
  for (const [what, q] of later) {
    const err = await refusedWith(read(q, { key: k.alice }));
    assert(err && /the fake graph can't run this Cypher/.test(err.message), `the repertoire still holds for ${what} after the opening one-hop; got ${err ? err.message : 'rows'}`);
  }
  const alone = await read('MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) OPTIONAL MATCH (u:NostrUser {pubkey: m.pubkey}) RETURN type(r) AS type, u.pubkey AS who', { key: k.alice });
  assert(alone.length === 4, `a later node, with no relationship, still runs with no repertoire: alice's four; got ${show(alone)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
