'use strict';
/**
 * The Cypher engine import nostr's suites run the graph on (test/helpers/cypherEngine.js) and the seam's fake over it
 * (test/helpers/cypherGraphFake.js) — their own suite, so a suite that passes or fails over them does so for the
 * graph's reasons, not the fake's. Run by test/operations.test.js. It passes before import nostr exists: it tests the
 * fake, not the feature.
 *   Story: engineering-team/stories/graph-operations-first-slice/32-import-nostr.md
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0032-import-nostr.md (Implementation notes: the
 *          statements record runs; "Memo #130's case runs on real Neo4j in the live check either way")
 *   Plan:  engineering-team/stories/graph-operations-first-slice/32-import-nostr.test-plan.md
 *
 *   CE1  MERGE of a node makes it once and finds it after, with ON CREATE SET and ON MATCH SET as Neo4j runs them
 *   CE2  keyNode(v) gives the shared label and a key once; a second run keeps the key
 *   CE3  the uniqueness rules: a second NostrEvent with an id or a uuid, a NostrEventTag uuid, a NostrUser pubkey or a
 *        tapestryKey fails with ConstraintValidationFailed; a node without the label is no breach
 *   CE4  memo #130 on today's builder: a referrer by e before its addressable target makes the target's import fail
 *        on nostrEvent_id, and a b naming an event by id makes a regular event's fail on nostrEvent_uuid
 *   CE5  today's builder runs whole on an empty graph: the node, its author, its tags and its references
 *   CE6  SET: null removes, += merges, = replaces, a map can't be stored; REMOVE and labels
 *   CE7  a placeholder unless held (today's placeholderUnlessHeld shape): made once, never beside a node holding the
 *        address
 *   CE8  DELETE that isn't DETACH leaves a dangling relationship, which the fake's commit refuses; DETACH DELETE doesn't
 *   CE9  a read must end with RETURN, must write nothing, and what is outside the subset says so
 *   CE10 the fake's transaction: a failed statement fails it and each later one, and nothing is kept; failures
 *        unreachable, failWrite and meanwhile fire as cypherGraphFake.js says
 *   CE11 reads: OPTIONAL MATCH, aggregates, list and pattern comprehensions, EXISTS and COUNT subqueries, undirected and
 *        variable-length paths, ORDER BY and LIMIT
 */

const path = require('path');
const S = require('../../helpers/graphOpsSuite');
const E = require('../../helpers/cypherEngine');
const CG = require('../../helpers/cypherGraphFake');
const F = require('../../helpers/importFixtures');

const { assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: the Cypher engine import nostr\'s suites run on');

const fresh = () => F.emptyGraph();
const rows = (s, q, p) => E.run(s, q, p || {}).rows;
const throws = (fn) => { try { fn(); } catch (e) { return e; } return null; };
const KEY_NODE = require('../../../src/lib/tapestry-key-cypher').keyNode;

test('CE1: MERGE of a node makes it once and finds it after, with ON CREATE SET and ON MATCH SET', () => {
  const s = fresh();
  const q = 'MERGE (n:NostrEvent {uuid: $u}) ON CREATE SET n.made = true ON MATCH SET n.seen = coalesce(n.seen, 0) + 1 RETURN n.made AS made, n.seen AS seen';
  const a = E.run(s, q, { u: 'x' });
  const b = E.run(s, q, { u: 'x' });
  assert(a.counters.nodesCreated === 1 && show(a.rows) === show([{ made: true, seen: null }]), `the first MERGE made the node; got ${show(a)}`);
  assert(b.counters.nodesCreated === 0 && show(b.rows) === show([{ made: true, seen: 1 }]), `the second found it and ran ON MATCH SET; got ${show(b)}`);
  const m = E.run(s, 'UNWIND [1, 2, 3] AS i MERGE (t:T {k: 1}) RETURN count(t) AS c', {});
  assert(m.counters.nodesCreated === 1 && m.rows[0].c === 3, `a MERGE sees what an earlier row of the same clause made; got ${show(m)}`);
  const e = throws(() => E.run(s, 'MERGE (n:NostrEvent {uuid: $u})', { u: null }));
  assert(e && /null property value/.test(e.message), `a null in a MERGE's map fails, as Neo4j's does; got ${e && e.message}`);
});

test('CE2: keyNode(v) gives the shared label and a key once; a second run keeps the key', () => {
  const s = fresh();
  E.run(s, `MERGE (n:NostrEvent {uuid: 'a'}) ${KEY_NODE('n')}`, {});
  const k1 = s.nodes[0].props.tapestryKey;
  E.run(s, `MERGE (n:NostrEvent {uuid: 'a'}) ${KEY_NODE('n')}`, {});
  assert(s.nodes.length === 1 && s.nodes[0].labels.includes('TapestryNode') && /^[0-9a-f-]{36}$/.test(k1) && s.nodes[0].props.tapestryKey === k1, `one node, labelled and keyed once; got ${show(s.nodes)}`);
});

test('CE3: the uniqueness rules fail a second NostrEvent id or uuid, NostrEventTag uuid, NostrUser pubkey or tapestryKey', () => {
  const cases = [
    ['CREATE (:NostrEvent {id: "x"})', 'CREATE (:NostrEvent {id: "x"})', 'id'],
    ['CREATE (:NostrEvent {uuid: "u"})', 'CREATE (n:NostrEvent) SET n.uuid = "u"', 'uuid'],
    ['CREATE (:NostrEventTag {uuid: "t"})', 'CREATE (:NostrEventTag {uuid: "t"})', 'uuid'],
    ['CREATE (:NostrUser {pubkey: "p"})', 'MERGE (u:NostrUser {pubkey: "q"}) SET u.pubkey = "p"', 'pubkey'],
    ['CREATE (:TapestryNode {tapestryKey: "k"})', 'CREATE (:TapestryNode {tapestryKey: "k"})', 'tapestryKey'],
  ];
  for (const [first, second, prop] of cases) {
    const s = fresh();
    E.run(s, first, {});
    const e = throws(() => E.run(s, second, {}));
    assert(e && e.code === 'Neo.ClientError.Schema.ConstraintValidationFailed' && e.message.includes(`property \`${prop}\``), `${second} after ${first} fails on the ${prop} rule; got ${e && `${e.code}: ${e.message}`}`);
  }
  const s = fresh();
  E.run(s, 'CREATE (:ListItem {uuid: "u"})', {});
  E.run(s, 'CREATE (:NostrEvent {uuid: "u"})', {});
  assert(s.nodes.length === 2, 'a node without the label is no breach: an event-less node and a NostrEvent may share an address, as on Neo4j');
});

test('CE4: memo #130 on today\'s builder: a referrer by e before its addressable target, and a b naming a regular event by id', () => {
  const target = F.letter(F.KEYS.alice, { kind: 39999, at: 1000, tags: [['d', 'rex'], ['name', 'Rex']] });
  const referrer = F.letter(F.KEYS.bob, { kind: 1, at: 1001, tags: [['e', target.id]], content: 'see rex' });
  const s = fresh();
  F.today(s, referrer);
  const e = throws(() => F.today(s, target));
  assert(e && e.code === 'Neo.ClientError.Schema.ConstraintValidationFailed' && e.message.includes('property `id`'), `the target's import fails on nostrEvent_id, as memo #130 found on Neo4j; got ${e && e.message}`);
  assert(F.nodesAt(s, F.addressOf(target)).length === 0, 'and nothing sits at its address');

  const note = F.letter(F.KEYS.alice, { kind: 1, at: 1002, tags: [['t', 'x']], content: 'a note' });
  const pointer = F.letter(F.KEYS.bob, { kind: 39999, at: 1003, tags: [['d', 'ptr'], ['b', note.id]] });
  const s2 = fresh();
  F.today(s2, pointer);
  const e2 = throws(() => F.today(s2, note));
  assert(e2 && e2.code === 'Neo.ClientError.Schema.ConstraintValidationFailed' && e2.message.includes('property `uuid`'), `a b by id makes a placeholder keyed by address whose uuid is the id, which the note's import meets on nostrEvent_uuid; got ${e2 && e2.message}`);
});

test('CE5: today\'s builder runs whole on an empty graph: the node, its author, its tags and its references', () => {
  const s = fresh();
  const target = F.letter(F.KEYS.alice, { kind: 39999, at: 1000, tags: [['d', 'rex'], ['name', 'Rex']] });
  const e = F.letter(F.KEYS.bob, { kind: 39999, at: 1001, tags: [['d', 'ref'], ['a', F.addressOf(target)], ['b', F.addressOf(target), 'inherit'], ['t', "it's \\ fine"]] });
  const n = F.today(s, e);
  assert(n && n.labels.includes('NostrEvent') && n.labels.includes('ListItem') && n.props.id === e.id && n.props.aTag === F.addressOf(e), `the node, keyed by its address; got ${show(n)}`);
  assert(F.personsOf(s, F.KEYS.bob.pubkey).length === 1 && F.relsOf(s, { type: 'AUTHORS', to: F.addressOf(e) }).length === 1, 'its author AUTHORS it');
  assert(F.tagsOf(s, n).length === 4 && F.tagsOf(s, n).some((t) => t.props.value === "it's \\ fine"), `four tag nodes, the escaped value read back; got ${show(F.tagsOf(s, n).map((t) => t.props))}`);
  const ph = F.nodesAt(s, F.addressOf(target));
  assert(ph.length === 1 && F.isPlaceholder(ph[0]) && F.relsOf(s, { type: 'REFERENCES', to: F.addressOf(target) }).length === 1 && F.relsOf(s, { type: 'INHERITS_FROM', to: F.addressOf(target) }).length === 1,
    `one placeholder at the target's address, referenced by the a tag and inherited by the b; got ${show(ph)}`);
});

test('CE6: SET: null removes, += merges, = replaces, a map can\'t be stored; REMOVE and labels', () => {
  const s = fresh();
  E.run(s, 'CREATE (n:A {a: 1, b: 2})', {});
  E.run(s, 'MATCH (n:A) SET n.a = null, n += $m', { m: { c: 3, b: null } });
  assert(show(s.nodes[0].props) === show({ c: 3 }), `a null removes and += merges; got ${show(s.nodes[0].props)}`);
  E.run(s, 'MATCH (n:A) SET n = {z: 1}, n:B REMOVE n:A', {});
  assert(show(s.nodes[0].props) === show({ z: 1 }) && show(s.nodes[0].labels) === show(['B']), `= replaces; a label added and one taken; got ${show(s.nodes[0])}`);
  const e = throws(() => E.run(s, 'MATCH (n:B) SET n.m = $m', { m: { nested: 1 } }));
  assert(e && /primitive types/.test(e.message), `a map can't be a property, as on Neo4j; got ${e && e.message}`);
  const e2 = throws(() => E.run(s, 'MATCH (n:B) SET n.l = [1, "a"]', {}));
  assert(e2 && /mixed types/.test(e2.message), `nor a list of mixed types; got ${e2 && e2.message}`);
});

test('CE7: a placeholder unless held, in today\'s shape: made once, never beside a node holding the address', () => {
  const q = `MATCH (t:T {k: 1})
    OPTIONAL MATCH (held:NostrEvent|TapestryNode {uuid: $u})
    WITH t, count(held) AS holders
    FOREACH (absent IN CASE WHEN holders = 0 THEN [1] ELSE [] END |
      MERGE (p:NostrEvent {uuid: $u}) ON CREATE SET p.kind = 39999 ${KEY_NODE('p')})
    WITH t
    MATCH (p:NostrEvent|TapestryNode {uuid: $u})
    MERGE (t)-[:REFERENCES]->(p)`;
  const s = fresh();
  E.run(s, 'CREATE (:T {k: 1})', {});
  E.run(s, q, { u: 'addr' });
  E.run(s, q, { u: 'addr' });
  assert(F.nodesAt(s, 'addr').length === 1 && s.rels.length === 1, `one placeholder, one reference; got ${show(s)}`);
  const s2 = fresh();
  E.run(s2, 'CREATE (:T {k: 1}), (:Set:TapestryNode {uuid: "held", tapestryKey: "k1"})', {});
  E.run(s2, q, { u: 'held' });
  const at = F.nodesAt(s2, 'held');
  assert(at.length === 1 && !at[0].labels.includes('NostrEvent') && s2.rels.length === 1, `an event-less node at the address is the target, and no second node is made; got ${show(at)}`);
});

test('CE8: DELETE that isn\'t DETACH leaves a dangling relationship, which the fake\'s commit refuses; DETACH DELETE doesn\'t', async () => {
  const dir = tmp('cypher-engine-');
  const file = path.join(dir, 'graph.json');
  const s = fresh();
  E.run(s, 'CREATE (:E {k: 1})-[:HAS_TAG]->(:NostrEventTag {uuid: "t"})-[:REFERENCES]->(:X {k: 2})', {});
  CG.writeState(file, s);
  const g = CG.fakeGraph(file);
  let err = null;
  try { await g.writeTransaction(async (tx) => { await tx.run('MATCH (:E)-[r:HAS_TAG]->(t:NostrEventTag) DELETE r, t', {}); }); } catch (e) { err = e; }
  assert(err && /still has relationships/.test(err.message), `importEventDirect's DELETE r, t on a tag with a REFERENCES fails at the commit, as on Neo4j (story fact 6); got ${err && err.message}`);
  assert(CG.readState(file).nodes.length === 3, 'and nothing was kept');
  await g.writeTransaction(async (tx) => { await tx.run('MATCH (:E)-[:HAS_TAG]->(t:NostrEventTag) DETACH DELETE t', {}); });
  const after = CG.readState(file);
  assert(after.nodes.length === 2 && after.rels.length === 0, `DETACH DELETE takes its relationships with it; got ${show(after)}`);
});

test('CE9: a read must end with RETURN and write nothing; what is outside the subset says so', () => {
  const s = fresh();
  const e1 = throws(() => E.run(s, 'MATCH (n)', {}));
  assert(e1 && /cannot conclude/.test(e1.message), `a read with no RETURN fails; got ${e1 && e1.message}`);
  const e2 = throws(() => E.run(s, 'CREATE (n:A)', {}, { write: false }));
  assert(e2 && /must write nothing/.test(e2.message), `a read that writes is refused; got ${e2 && e2.message}`);
  for (const q of ['CALL db.labels() YIELD label RETURN label', 'MATCH (n) RETURN n UNION MATCH (m) RETURN m', 'MATCH p = (a)-->(b) RETURN p', 'RETURN apoc.text.join(["a"], ",") AS x']) {
    const e = throws(() => E.run(s, q, {}));
    assert(e && E.isCantRun(e) && e.message.startsWith(E.PREFIX), `${q}: the fake says it can't run it; got ${e && e.message}`);
  }
});

test('CE10: the fake\'s transaction: a failed statement fails it and each later one; failures unreachable, failWrite and meanwhile', async () => {
  const dir = tmp('cypher-engine-tx-');
  const file = path.join(dir, 'graph.json');
  CG.writeState(file, fresh());
  const g = CG.fakeGraph(file);
  let later = null;
  let err = null;
  try {
    await g.writeTransaction(async (tx) => {
      await tx.run('CREATE (:NostrEvent {id: "a"})', {});
      try { await tx.run('CREATE (:NostrEvent {id: "a"})', {}); } catch { /* caught, as a careless recorder might */ }
      try { await tx.run('CREATE (:Other)', {}); } catch (e) { later = e; }
    });
  } catch (e) { err = e; }
  assert(later && /rolled back/.test(later.message), `a statement after a failure throws; got ${later && later.message}`);
  assert(err && err.code === 'Neo.ClientError.Schema.ConstraintValidationFailed' && CG.readState(file).nodes.length === 0, `the transaction rejects with the first failure, keeping nothing, though work caught it; got ${err && err.message}`);

  const s = fresh();
  s.failures = { failWrite: [{ match: 'evt-1', times: 2 }], meanwhile: [{ match: 'evt-2', add: [{ labels: ['NostrEvent'], props: { id: 'evt-2', uuid: 'evt-2' } }] }], unreachable: { after: 2 } };
  CG.writeState(file, s);
  const write = (id) => g.writeTransaction(async (tx) => (await tx.run('MERGE (n:NostrEvent {id: $id}) ON CREATE SET n.uuid = $id RETURN n.uuid AS u', { id })).rows);
  const tries = [];
  for (const id of ['evt-1', 'evt-1', 'evt-1']) { try { await write(id); tries.push('ok'); } catch (e) { tries.push(e.code); } }
  assert(show(tries) === show(['Neo.ClientError.Schema.ConstraintValidationFailed', 'Neo.ClientError.Schema.ConstraintValidationFailed', 'ok']), `failWrite fails a write naming evt-1 twice, then lets it through; got ${show(tries)}`);
  const before = CG.readState(file).nodes.length;
  await write('evt-2');
  const st = CG.readState(file);
  assert(st.nodes.filter((n) => n.props.id === 'evt-2').length === 1 && st.nodes.length === before + 1 && st.log.some((x) => x.call === 'meanwhile'),
    `meanwhile commits evt-2's node just before the MERGE, which then finds it: one node; got ${show(st.nodes.filter((n) => n.props.id === 'evt-2'))}`);
  let down = null;
  try { await write('evt-3'); } catch (e) { down = e; }
  let downRead = null;
  try { await g.read('MATCH (n) RETURN count(n) AS c', {}); } catch (e) { downRead = e; }
  assert(down && down.code === 'ServiceUnavailable' && downRead && downRead.code === 'ServiceUnavailable', `after two commits the database is unreachable, for writes and reads; got ${down && down.code} ${downRead && downRead.code}`);
  const tx = CG.transactions(CG.readState(file).log);
  assert(tx.filter((t) => t.outcome === 'rollback').length === 2 && tx.filter((t) => t.outcome === 'commit').length === 2, `the log tells the rollbacks from the commits; got ${show(tx.map((t) => t.outcome))}`);
});

test('CE11: reads: OPTIONAL MATCH, aggregates, comprehensions, EXISTS and COUNT, undirected and variable-length paths, ORDER BY and LIMIT', () => {
  const s = fresh();
  E.run(s, `CREATE (h:H {name: 'h'})-[:IS_THE_CONCEPT_FOR]->(sup:Superset {name: 's'}),
    (sup)-[:IS_A_SUPERSET_OF]->(st:Set {name: 'set'}), (st)-[:HAS_ELEMENT]->(:E {name: 'e1', n: 2}), (sup)-[:HAS_ELEMENT]->(:E {name: 'e2', n: 1})`, {});
  const r = rows(s, `MATCH (h:H)-[:IS_THE_CONCEPT_FOR]->(sup)-[:IS_A_SUPERSET_OF*0..3]->()-[:HAS_ELEMENT]->(e)
    OPTIONAL MATCH (e)-[:NONE]->(x)
    WITH e, x ORDER BY e.n ASC
    RETURN collect(e.name) AS names, count(x) AS none, min(e.n) AS lo, max(e.n) AS hi`, {});
  assert(show(r) === show([{ names: ['e2', 'e1'], none: 0, lo: 1, hi: 2 }]), `the class-thread walk, ordered and aggregated; got ${show(r)}`);
  const r2 = rows(s, `MATCH (sup:Superset) RETURN [(sup)-[:HAS_ELEMENT]->(e) | e.name] AS direct, EXISTS { MATCH (sup)--(:H) } AS linked, COUNT { (sup)-->() } AS out, [x IN [3, 1, 2] WHERE x > 1 | x * 10] AS big`, {});
  assert(show(r2) === show([{ direct: ['e2'], linked: true, out: 2, big: [30, 20] }]), `comprehensions, an undirected EXISTS and a COUNT; got ${show(r2)}`);
  const e = throws(() => E.run(s, 'MATCH (n) RETURN n LIMIT $l', { l: 2 }));
  assert(e && /float/.test(e.message), `a LIMIT given a JavaScript number is refused, as Neo4j refuses the driver's float; got ${e && e.message}`);
  assert(rows(s, 'MATCH (n:E) RETURN n.name AS name ORDER BY n.name DESC LIMIT 1', {})[0].name === 'e2', 'ORDER BY DESC with a literal LIMIT');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
