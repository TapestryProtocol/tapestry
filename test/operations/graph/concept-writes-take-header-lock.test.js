'use strict';
/**
 * graph update-concept and graph mark-field beside a property write on the same concept — story
 * graph-operations-first-slice #43's suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/43-concept-writes-take-header-lock.md (AC1–AC3)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0018-property-operations.md (Decision 11; Amendment 3,
 *          item 1; Amendment 4)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/43-concept-writes-take-header-lock.test-plan.md
 *
 * Stack-free, over test/helpers/propertyGraph.js's seed, on lamp, a concept graph create-concept made. The fake graph
 * runs one transaction at a time, so "at once" is its failures.meanwhile (test/helpers/graphFake.js): the other write
 * runs first, over a copy of the graph, and the graph it left is committed just before the write under test first
 * writes lamp's header. That is what Neo4j does when the other write holds the header: the statement waits for its
 * lock, then goes on over what it committed. A write that never writes the header never meets the other write here.
 *
 *   HL0  the fake's failures.meanwhile: it fires once, at the first copies statement (lockNode's shape) naming its
 *        node; it commits its graph, which a rollback keeps; it logs where; it refuses a transaction that has already
 *        written
 *   HL1  update-concept: right after the concept-header concept's lock, its next two statements set and clear the lock
 *        on lamp's header, with no read between
 *   HL2  a rename beside add-property: lamp's header, schema node, primary property and tree graph end as add-property
 *        then the rename, one after the other, leave them, weight in all three; the next property write takes no
 *        property node out
 *   HL3  a rename of the plural alone beside add-property: the same, against add-property then that rename
 *   HL4  a rename, then add-property, one after the other: the property write keeps the rename's names, and adds weight
 *   HL5  mark-field: its first two statements that write set and clear the lock on lamp's header, before its MERGE, and
 *        the rule field-mark-allowed's reads run again after them
 *   HL6  a mark beside update-property's change of the field to an object: refused not-plain, with the rule's name, and
 *        nothing written
 *   HL7  a mark beside remove-property of the field: refused unknown-field, with the rule's name, and nothing written
 */

const fs = require('fs');
const path = require('path');
const S = require('../../helpers/graphOpsSuite');
const P = require('../../helpers/propertyGraph');
const G = require('../../helpers/graphFake');

const { assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: a rename or a mark beside a property write takes the header lock');
const add = P.post('add');
const upd = P.post('update');
const rem = P.post('remove');
const mark = P.post('mark');
const UPDATE_CONCEPT = '/api/tapestry/graph/update-concept';
const rename = (id, body) => ({ id, method: 'POST', url: UPDATE_CONCEPT, caller: 'owner', body });
const RULE = 'field-mark-allowed';
const ROLES = ['conceptHeader', 'jsonSchema', 'primaryProperty', 'propertyTreeGraph'];

// ── helpers ──
/** A copy of a state file beside it, under another name: a second graph over the same store. */
function copyOf(file, name) {
  const to = path.join(path.dirname(file), `${name}.json`);
  fs.copyFileSync(file, to);
  return to;
}
/** Make the write in `otherFile` commit while the next write on `file` waits for the node keyed `at`. */
function meanwhileAt(file, at, otherFile) {
  const s = S.readState(file);
  const o = S.readState(otherFile);
  s.failures = { ...(s.failures || {}), meanwhile: { at, graph: { nodes: o.nodes, rels: o.rels, nextEid: o.nextEid } } };
  G.writeState(file, s);
}
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
/** The paths of the leaf values that differ between two JSON documents; a list whose length changed is one leaf. */
function leaves(a, b, at = [], out = []) {
  if (isObj(a) && isObj(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) leaves(a[k], b[k], [...at, k], out);
  } else if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    a.forEach((x, i) => leaves(x, b[i], [...at, i], out));
  } else if (!P.same(a, b)) {
    out.push(at);
  }
  return out;
}
const valueAt = (o, p) => p.reduce((x, k) => (x !== null && x !== undefined ? x[k] : undefined), o);
/** Where lamp's four json-holding nodes differ between two states: ['<role>: <path>: <x> where <y>'], or none. */
function differences(nodes, x, y) {
  const out = [];
  for (const role of ROLES) {
    const [jx, jy] = [x, y].map((s) => P.json(s, nodes[role]));
    for (const p of leaves(jx, jy)) out.push(`${role}: ${p.join('.') || '(the whole json)'}: ${show(valueAt(jx, p))} where ${show(valueAt(jy, p))}`);
  }
  return out;
}
/** The values the rename alone changed in lamp's four json-holding nodes that `final` doesn't hold as it left them. */
function renameLost(nodes, { base, renamed, final }) {
  const out = [];
  for (const role of ROLES) {
    const [j0, jr, jf] = [base, renamed, final].map((s) => P.json(s, nodes[role]));
    for (const p of leaves(j0, jr)) {
      if (!P.same(valueAt(jf, p), valueAt(jr, p))) out.push(`${role}: ${p.join('.')}: ${show(valueAt(jf, p))} where the rename left ${show(valueAt(jr, p))}`);
    }
  }
  return out;
}
/** Whether weight is in lamp's schema node, its primary property's view and its tree. */
function weightEverywhere(s, header) {
  const doc = P.schemaDoc(s, header);
  const pp = P.json(s, P.primaryOf(s, header));
  return {
    schema: Boolean(valueAt(doc, ['properties', 'lamp', 'properties', 'weight'])),
    primaryProperty: Boolean(valueAt(pp, ['property', 'properties', 'weight'])),
    tree: P.treeOf(s, header).some((x) => x.name === 'weight'),
  };
}
const everywhere = (w) => w.schema && w.primaryProperty && w.tree;
const ok = (r, id, what) => {
  const x = r.req(id);
  assert(x.status === 200 && x.body && x.body.data, `${what} must succeed; got ${x.status} ${show(x.body)}`);
  return x.body.data;
};
const metAt = (s, from, at) => P.transactions(s.log, from).some((t) => t.steps.some((st) => st.call === 'meanwhile' && st.at === at));

// ── the rename beside a property write (HL1–HL4) ──
let RENAMES = null;
function renames() {
  if (RENAMES) return RENAMES;
  RENAMES = (async () => {
    P.needDecls(['add-property', 'update-concept']);
    const ctx = await P.prepare('header-lock-rename');
    const LAMP = ctx.made.lamp.conceptHeader;
    const nodes = ctx.made.lamp.nodes;
    const base = S.readState(ctx.file);
    // Each write alone, over its own copy.
    const addAlone = copyOf(ctx.file, 'add-alone');
    ok(P.runOn(addAlone, [add('weight', 'owner', { concept: LAMP, name: 'weight', type: 'number' })]), 'weight', "the setup's add-property of weight, alone");
    const renameAlone = copyOf(ctx.file, 'rename-alone');
    ok(P.runOn(renameAlone, [rename('alone', { concept: LAMP, name: 'lantern' })]), 'alone', "the setup's rename of lamp to lantern, alone");
    const pluralAlone = copyOf(ctx.file, 'plural-alone');
    ok(P.runOn(pluralAlone, [rename('alone', { concept: LAMP, plural: 'lampions' })]), 'alone', "the setup's rename of lamps to lampions, alone");
    // The two one after the other, the property write first: what a race in which it commits first must equal.
    const thenName = copyOf(addAlone, 'add-then-name');
    ok(P.runOn(thenName, [rename('then', { concept: LAMP, name: 'lantern' })]), 'then', "the setup's rename to lantern after the add");
    const thenPlural = copyOf(addAlone, 'add-then-plural');
    ok(P.runOn(thenPlural, [rename('then', { concept: LAMP, plural: 'lampions' })]), 'then', "the setup's rename to lampions after the add");
    return { ctx, LAMP, nodes, base, addAlone, renameAlone, pluralAlone, thenName, thenPlural };
  })();
  return RENAMES;
}
/** A rename on a copy of the base, with add-property of weight committing while it waits for lamp's header. */
async function raceRename(name, body) {
  const R = await renames();
  const file = copyOf(R.ctx.file, name);
  meanwhileAt(file, R.LAMP, R.addAlone);
  const from = S.readState(file).log.length;
  const r = P.runOn(file, [rename('race', { concept: R.LAMP, ...body })]);
  return { R, file, from, r, after: S.readState(file) };
}

test('HL0: the fake\'s failures.meanwhile fires once, at the first copies statement that names its node, commits its graph, and refuses to merge', async () => {
  const dir = tmp('header-lock-fake-');
  const n = (eid, key, props = {}) => ({ eid, labels: ['TapestryNode'], props: { tapestryKey: key, ...props } });
  const plain = { nodes: [n(1, 'a'), n(2, 'b')], rels: [] };
  const other = { nodes: [n(1, 'a'), n(2, 'b'), n(3, 'c')], rels: [{ eid: 4, type: 'CITES', from: 3, to: 1, props: {} }], nextEid: 5 };
  const COPIES = 'UNWIND $rows AS row MATCH (n:TapestryNode {tapestryKey: row.key}) WHERE NOT n:GraphChange SET n += row.props RETURN count(n) AS n';
  const READ = 'MATCH (n:TapestryNode {tapestryKey: $key}) RETURN n.tapestryKey AS key';
  const set = (key, props) => [COPIES, { rows: [{ key, props }] }];
  const fresh = (name) => {
    const file = path.join(dir, `${name}.json`);
    G.writeState(file, G.emptyState({ ...JSON.parse(JSON.stringify(plain)), nextEid: 3, failures: { meanwhile: { at: 'a', graph: other } } }));
    return file;
  };
  const keys = (s) => s.nodes.map((x) => x.props.tapestryKey).sort();

  // It waits for a statement that writes 'a': a read of a, and a lock set and cleared on b, don't fire it.
  const f1 = fresh('fires');
  const g1 = G.fakeGraph(f1);
  await g1.writeTransaction(async (tx) => {
    await tx.read(READ, { key: 'a' });
    await tx.run(...set('b', { tapestryLock: true }));
    await tx.run(...set('b', { tapestryLock: null }));
    const seen = await tx.read('MATCH (n:TapestryNode {tapestryKey: $key}) RETURN n.tapestryKey AS key', { key: 'c' });
    assert(seen.length === 0, `before its node is written, the other write hasn't committed; c was read as ${show(seen)}`);
    await tx.run(...set('a', { tapestryLock: true }));
    const after = await tx.read('MATCH (n:TapestryNode {tapestryKey: $key}) RETURN n.tapestryKey AS key', { key: 'c' });
    assert(after.length === 1, `after the statement on a waited, the transaction reads the other write's graph; got ${show(after)}`);
    await tx.run(...set('a', { tapestryLock: null }));
  });
  const s1 = G.readState(f1);
  assert(show(keys(s1)) === show(['a', 'b', 'c']) && s1.rels.length === 1 && s1.nextEid === 5, `the commit keeps the other write's graph; got ${show({ keys: keys(s1), rels: s1.rels.length, nextEid: s1.nextEid })}`);
  assert(!(s1.failures && s1.failures.meanwhile), `it fires once; failures still holds ${show(s1.failures)}`);
  const steps = s1.log.filter((l) => l.call !== 'begin' && l.call !== 'commit');
  const at = steps.findIndex((l) => l.call === 'meanwhile');
  assert(at > 0 && steps[at].at === 'a' && steps[at + 1] && steps[at + 1].kind === 'copies' && show(steps[at + 1].keys) === show(['a']) && !steps.slice(0, at).some((l) => l.call === 'tx.run' && show(l.keys) === show(['a'])),
    `the log has { meanwhile, at: 'a' } just before the first statement on a; got ${show(steps)}`);
  const before = s1.log.length;
  await g1.writeTransaction(async (tx) => { await tx.run(...set('a', { tapestryLock: true })); await tx.run(...set('a', { tapestryLock: null })); });
  const s1b = G.readState(f1);
  assert(!s1b.log.slice(before).some((l) => l.call === 'meanwhile') && show(keys(s1b)) === show(['a', 'b', 'c']), `a second transaction meets nothing; got ${show(s1b.log.slice(before))}`);

  // A rollback after it fired keeps what the other write committed.
  const f2 = fresh('rollback');
  let thrown = null;
  try {
    await G.fakeGraph(f2).writeTransaction(async (tx) => { await tx.run(...set('a', { tapestryLock: true })); throw new Error('refused after the lock'); });
  } catch (e) { thrown = e; }
  const s2 = G.readState(f2);
  assert(thrown && /refused after the lock/.test(thrown.message), `the transaction's own error comes through; got ${show(thrown && thrown.message)}`);
  assert(show(keys(s2)) === show(['a', 'b', 'c']) && !(s2.failures && s2.failures.meanwhile), `the rollback keeps the other write's graph, and it doesn't fire again; got ${show({ keys: keys(s2), failures: s2.failures })}`);

  // A transaction that has already written can't be merged with the other write: it throws, naming the node.
  const f3 = fresh('merge');
  thrown = null;
  try {
    await G.fakeGraph(f3).writeTransaction(async (tx) => { await tx.run(...set('b', { y: 1 })); await tx.run(...set('a', { tapestryLock: true })); });
  } catch (e) { thrown = e; }
  const s3 = G.readState(f3);
  assert(thrown && /meanwhile/.test(thrown.message) && /\ba\b/.test(thrown.message) && /merge/.test(thrown.message), `it refuses to merge two writes, naming a; got ${show(thrown && thrown.message)}`);
  assert(show(keys(s3)) === show(['a', 'b']) && !('y' in s3.nodes.find((x) => x.props.tapestryKey === 'b').props) && s3.failures && s3.failures.meanwhile, `nothing changed, and it's still waiting; got ${show({ keys: keys(s3), failures: Object.keys(s3.failures || {}) })}`);
});

test('HL1: update-concept takes the lock on the concept\'s own header right after the concept-header concept\'s, before it reads', async () => {
  const R = await renames();
  const s = S.readState(R.renameAlone);
  const t = P.transactions(s.log, R.base.log.length).find((x) => x.end === 'commit' && x.steps.some((st) => st.kind === 'create'));
  assert(t, `the rename's committed transaction is in the log; got ${show(P.transactions(s.log, R.base.log.length).map((x) => x.end))}`);
  const writes = t.steps.filter((st) => st.call === 'tx.run');
  assert(writes[0] && writes[0].kind === 'lock', `its first write is still the concept-header concept's lock (ADR 0016, Decision 6); got ${show(writes.slice(0, 3))}`);
  assert(writes[1] && writes[1].kind === 'copies' && show(writes[1].keys) === show([R.LAMP]) && writes[2] && writes[2].kind === 'copies' && show(writes[2].keys) === show([R.LAMP]),
    `its next two statements set and clear the lock on lamp's own header (${R.LAMP}), as the property writes take it (ADR 0018, Decision 11); got ${show(writes.slice(0, 4))}`);
  const between = t.steps.slice(t.steps.indexOf(writes[0]) + 1, t.steps.indexOf(writes[1]));
  assert(!between.some((st) => st.call === 'tx.read'), `nothing is read between the two locks, so every read of the concept comes after its header's; got ${show(between)}`);
});

test('HL2: a rename beside add-property keeps both, and the next property write takes no property node out', async () => {
  const { R, file, from, r, after } = await raceRename('race-name', { name: 'lantern' });
  assert(metAt(after, from, R.LAMP), `the rename never waited for lamp's header (no failures.meanwhile in its transaction), so a property write in flight on lamp could interleave with it; the log: ${show(P.transactions(after.log, from).map((t) => t.steps.map((st) => st.call === 'tx.run' ? `${st.kind}${st.keys ? `:${st.keys.length}` : ''}` : st.call)))}`);
  const d = ok(r, 'race', 'the rename beside add-property');
  assert(d.outcome === 'updated' && d.concept.names && d.concept.names.singular === 'lantern', `the rename lands; got ${show({ outcome: d.outcome, names: d.concept.names })}`);
  assert(P.node(after, R.LAMP).props.name === 'lantern', `lamp's header is named lantern; got ${show(P.node(after, R.LAMP).props.name)}`);
  const serial = S.readState(R.thenName);
  assert(differences(R.nodes, serial, S.readState(R.addAlone)).length > 0 && differences(R.nodes, serial, S.readState(R.renameAlone)).length > 0,
    'each write changes what the other alone leaves in lamp\'s json (the fixture is live)');
  const w = weightEverywhere(after, R.LAMP);
  assert(everywhere(w), `weight is in lamp's schema node, primary property and tree; got ${show(w)}`);
  const diff = differences(R.nodes, after, serial);
  assert(diff.length === 0, `lamp's json is as add-property then the rename, one after the other, leave it; it differs at:\n  ${diff.join('\n  ')}`);
  const next = P.runOn(file, [add('height', 'owner', { concept: R.LAMP, name: 'height', type: 'number' })]);
  const h = ok(next, 'height', 'the next property write');
  const removed = (h.caughtUp && h.caughtUp.removed) || [];
  assert(h.outcome === 'added' && removed.length === 0, `the next property write catches nothing up out; it took out ${show(removed.map((x) => x.field || x))}`);
  const fields = P.treeOf(S.readState(file), R.LAMP).map((x) => x.name);
  assert(fields.includes('weight') && fields.includes('height'), `lamp's tree holds weight and height; got ${show(fields)}`);
});

test('HL3: a rename of the plural alone beside add-property keeps both', async () => {
  const { R, from, r, after } = await raceRename('race-plural', { plural: 'lampions' });
  assert(metAt(after, from, R.LAMP), `the plural's rename never waited for lamp's header (no failures.meanwhile in its transaction): it writes no header node, so before this fix nothing made it wait for a property write in flight on lamp; the log: ${show(P.transactions(after.log, from).map((t) => t.steps.map((st) => st.call === 'tx.run' ? `${st.kind}${st.keys ? `:${st.keys.length}` : ''}` : st.call)))}`);
  const d = ok(r, 'race', 'the plural\'s rename beside add-property');
  assert(d.outcome === 'updated' && d.concept.names && d.concept.names.plural === 'lampions', `the rename lands; got ${show({ outcome: d.outcome, names: d.concept.names })}`);
  const serial = S.readState(R.thenPlural);
  assert(differences(R.nodes, serial, S.readState(R.addAlone)).length > 0 && differences(R.nodes, serial, S.readState(R.pluralAlone)).length > 0,
    'each write changes what the other alone leaves in lamp\'s json (the fixture is live)');
  const w = weightEverywhere(after, R.LAMP);
  assert(everywhere(w), `weight is in lamp's schema node, primary property and tree; got ${show(w)}`);
  const diff = differences(R.nodes, after, serial);
  assert(diff.length === 0, `lamp's json is as add-property then the plural's rename, one after the other, leave it; it differs at:\n  ${diff.join('\n  ')}`);
});

test('HL4: a rename, then add-property, one after the other: the property write keeps the rename\'s names', async () => {
  const R = await renames();
  const file = copyOf(R.ctx.file, 'rename-then-add');
  ok(P.runOn(file, [rename('first', { concept: R.LAMP, name: 'lantern' })]), 'first', 'the rename');
  ok(P.runOn(file, [add('weight', 'owner', { concept: R.LAMP, name: 'weight', type: 'number' })]), 'weight', 'add-property after it');
  const final = S.readState(file);
  const lost = renameLost(R.nodes, { base: R.base, renamed: S.readState(R.renameAlone), final });
  assert(lost.length === 0, `each value the rename changed is still the rename's:\n  ${lost.join('\n  ')}`);
  const w = weightEverywhere(final, R.LAMP);
  assert(everywhere(w), `and weight is in lamp's schema node, primary property and tree; got ${show(w)}`);
});

// ── the mark beside a property write (HL5–HL7) ──
let MARKS = null;
function marks() {
  if (MARKS) return MARKS;
  MARKS = (async () => {
    P.needDecls(['add-property', 'update-property', 'remove-property', 'mark-field']);
    const ctx = await P.prepare('header-lock-mark');
    const LAMP = ctx.made.lamp.conceptHeader;
    const color = ok(P.runOn(ctx.file, [add('color', 'owner', { concept: LAMP, name: 'color', type: 'string' })]), 'color', "the setup's add-property of color").property.property;
    const base = S.readState(ctx.file);
    const toObject = copyOf(ctx.file, 'to-object-alone');
    ok(P.runOn(toObject, [upd('obj', 'owner', { property: color, type: 'object' })]), 'obj', "the setup's update-property of color to an object, alone");
    const removed = copyOf(ctx.file, 'removed-alone');
    ok(P.runOn(removed, [rem('gone', 'owner', { property: color })]), 'gone', "the setup's remove-property of color, alone");
    const markAlone = copyOf(ctx.file, 'mark-alone');
    const m = ok(P.runOn(markAlone, [mark('alone', 'owner', { concept: LAMP, field: 'color' })]), 'alone', "the setup's mark-field of color, alone");
    assert(m.outcome === 'marked', `the setup's mark lands alone; got ${show(m)}`);
    return { ctx, LAMP, color, base, toObject, removed, markAlone };
  })();
  return MARKS;
}
/** A mark on a copy of the base, with marks()'s other write `which` committing while it waits for lamp's header. */
async function raceMark(name, which) {
  const M = await marks();
  const file = copyOf(M.ctx.file, name);
  meanwhileAt(file, M.LAMP, M[which]);
  const from = S.readState(file).log.length;
  const r = P.runOn(file, [mark('race', 'owner', { concept: M.LAMP, field: 'color' })]);
  return { M, file, from, r, after: S.readState(file) };
}
const markEdges = (s, color) => {
  const set = P.node(s, P.SET1);
  const p = P.node(s, color);
  return set && p ? s.rels.filter((x) => x.type === 'HAS_ELEMENT' && x.from === set.eid && x.to === p.eid).length : 0;
};

test('HL5: mark-field locks the concept\'s header before its MERGE, and runs field-mark-allowed again after the lock', async () => {
  const M = await marks();
  const s = S.readState(M.markAlone);
  const t = P.transactions(s.log, M.base.log.length).find((x) => x.end === 'commit' && x.steps.some((st) => st.kind === 'merge'));
  assert(t, `the mark's committed transaction is in the log; got ${show(P.transactions(s.log, M.base.log.length).map((x) => x.end))}`);
  const writes = t.steps.filter((st) => st.call === 'tx.run');
  assert(writes[0] && writes[0].kind === 'copies' && show(writes[0].keys) === show([M.LAMP]) && writes[1] && writes[1].kind === 'copies' && show(writes[1].keys) === show([M.LAMP]) && writes[2] && writes[2].kind === 'merge',
    `its first two statements that write set and clear the lock on lamp's header (${M.LAMP}), then it MERGEs the mark; got ${show(writes.slice(0, 3))}`);
  const guard = t.steps.slice(0, t.steps.indexOf(writes[0])).filter((st) => st.call === 'tx.read').map((st) => st.query);
  const again = t.steps.slice(t.steps.indexOf(writes[1]) + 1).filter((st) => st.call === 'tx.read').slice(0, guard.length).map((st) => st.query);
  assert(guard.length > 0 && show(again) === show(guard), `the rule's reads before the lock run again, in order, right after it; before: ${show(guard)}; after: ${show(again)}`);
});

test('HL6: a mark beside update-property\'s change of the field to an object is refused not-plain, and writes nothing', async () => {
  const { M, from, r, after } = await raceMark('race-object', 'toObject');
  assert(metAt(after, from, M.LAMP), `mark-field never waited for lamp's header (no failures.meanwhile in its transaction), so a type change in flight on lamp could land on the field it marks; the answer: ${show({ status: r.req('race').status, body: r.req('race').body })}`);
  const x = r.req('race');
  assert(x.status === 409 && x.body.code === 'not-plain' && x.body.rule === RULE, `refused not-plain by ${RULE}, as the same mark after the type change is; got ${x.status} ${show(x.body)}`);
  assert(/object/i.test(x.body.error), `it says what the field holds now; got ${show(x.body.error)}`);
  const other = S.readState(M.toObject);
  assert(P.same(P.graphOf(after), P.graphOf(other)), 'the graph is as the type change left it: no mark, no copies, no change entry');
  assert(markEdges(after, M.color) === 0, `no mark from the first set to color; got ${markEdges(after, M.color)}`);
});

test('HL7: a mark beside remove-property of the field is refused unknown-field, and writes nothing', async () => {
  const { M, from, r, after } = await raceMark('race-removed', 'removed');
  assert(metAt(after, from, M.LAMP), `mark-field never waited for lamp's header (no failures.meanwhile in its transaction), so a removal in flight on lamp could take out the field it marks; the answer: ${show({ status: r.req('race').status, body: r.req('race').body })}`);
  const x = r.req('race');
  assert(x.status === 404 && x.body.code === 'unknown-field' && x.body.rule === RULE, `refused unknown-field by ${RULE}, as the same mark after the removal is; got ${x.status} ${show(x.body)}`);
  const other = S.readState(M.removed);
  assert(P.same(P.graphOf(after), P.graphOf(other)), 'the graph is as the removal left it: no mark, no copies, no change entry');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
