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
 *   F5 the declared types' read walks the concept's class thread to each element's json tag
 *   F6 a transaction that throws keeps nothing; one that resolves keeps everything; a read refuses to write
 *   F7 a statement it doesn't run says so, naming it
 */

const fs = require('fs');
const path = require('path');
const S = require('../helpers/graphOpsSuite');
const G = require('../helpers/graphFake');

const { HANDLE, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: the fake graph');

function fresh() {
  const seed = S.seedGraph();
  const dir = tmp('graph-fake-');
  return { ...seed, path: seed.file(dir), fake: null };
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

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
