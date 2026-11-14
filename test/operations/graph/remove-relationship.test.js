'use strict';
/**
 * graph remove-relationship — its own suite (ADR graph-operations-foundation/0001 Decision 12), run by
 * test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-foundation/4-the-write-path.md (AC3, AC4, AC6, AC7)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0004-the-write-path.md (Decisions 3, 5–7, 10)
 *
 * Stack-free, as add-relationship's suite is. The seeded graph also holds a CITES from A to B, two CITES from B to U
 * (as an older path could make), and a MENTIONS from A to U, a type nothing declares.
 *
 *   RR1 the owner removes a relationship that exists: it is gone, and its change entry says so, with a count of 1
 *   RR2 the same call again changes nothing, records nothing, and answers already-gone with change: null
 *   RR3 two relationships of the type between the same two nodes are both removed, with a count of 2
 *   RR4 a reserved type is refused reserved-type, so a class-thread edge can't be removed this way; it stays
 *   RR5 a type the graph doesn't declare is refused undeclared-type, even where such a relationship exists; it stays
 *   RR6 a from or to that names no node is refused unknown-node, naming which
 *   RR7 nothing is signed; a visitor gets 401 and a stranger 403; the command removes one, recorded as the command's
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const S = require('../../helpers/graphOpsSuite');

const { ROOT, OWNER, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph remove-relationship');

const ROUTE = '/api/tapestry/graph/remove-relationship';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/remove-relationship.js');
const RULE = 'relationship-type-allowed';

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  const dir = tmp('remove-rel-');
  const seed = S.seedGraph();
  const s = seed.state;
  const k = seed.keys;
  const eidOf = (key) => s.nodes.find((n) => n.props.tapestryKey === key).eid;
  const rel = (type, from, to) => s.rels.push({ eid: s.nextEid++, type, from: eidOf(from), to: eidOf(to), props: {} });
  rel('CITES', k.A, k.B);
  rel('CITES', k.B, k.U);
  rel('CITES', k.B, k.U);
  rel('MENTIONS', k.A, k.U);
  rel('DEPENDS_ON', k.U, k.A);
  // A class-thread edge the seed already holds: the superset's HAS_ELEMENT to CITES's element.
  const he = s.rels.find((r) => r.type === 'HAS_ELEMENT');
  const keyOf = (eid) => s.nodes.find((n) => n.eid === eid).props.tapestryKey;
  const sup = keyOf(he.from);
  const elem = keyOf(he.to);
  const file = seed.file(dir);
  const nobody = crypto.randomUUID();
  const post = (id, caller, body) => ({ id, method: 'POST', url: ROUTE, caller, body });
  const r = S.runHarness({
    spy: true,
    scenarios: [{
      graphFake: { stateFile: file },
      requests: [
        post('rr1-remove', 'owner', { from: k.A, to: k.B, type: 'CITES' }),
        post('rr2-again', 'owner', { from: k.A, to: k.B, type: 'CITES' }),
        post('rr3-two', 'owner', { from: k.B, to: k.U, type: 'CITES' }),
        post('rr4-reserved', 'owner', { from: sup, to: elem, type: 'HAS_ELEMENT' }),
        post('rr5-undeclared', 'owner', { from: k.A, to: k.U, type: 'MENTIONS' }),
        post('rr6-from', 'owner', { from: nobody, to: k.B, type: 'CITES' }),
        post('rr6-to', 'owner', { from: k.A, to: nobody, type: 'CITES' }),
        post('rr7-visitor', 'visitor', { from: k.U, to: k.A, type: 'DEPENDS_ON' }),
        post('rr7-stranger', 'stranger', { from: k.U, to: k.A, type: 'DEPENDS_ON' }),
      ],
      cli: [{ id: 'rr7-cli', argv: ['graph', 'remove-relationship', '--from', k.U, '--to', k.A, '--type', 'DEPENDS_ON'] }],
    }],
  }, { dir });
  MAIN = { r, a: S.answered(r), file, k, sup, elem, nobody };
  return MAIN;
}
const graph = () => S.readState(main().file);
const between = (type, from, to) => S.relsOf(graph(), type).filter((x) => x.from === from && x.to === to);
const removals = () => S.entriesOf(graph()).filter((e) => e.operation === 'graph remove-relationship');
function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/remove-relationship.js does not exist yet (ADR graph-operations-foundation/0004 Decision 7)');
}
function ok(id) {
  needDecl();
  const x = main().a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body)}`);
  return x.body.data;
}

test('RR1: the owner removes a relationship that exists: it is gone, and its change entry says so, with a count of 1', () => {
  const { k } = main();
  const d = ok('rr1-remove');
  assert(d.outcome === 'removed' && show(d.relationship) === show({ type: 'CITES', from: k.A, to: k.B }), `removed, naming the relationship; got ${show(d)}`);
  assert(show(d.change && d.change.by) === show({ role: 'owner', pubkey: OWNER }) && d.change.operation === 'graph remove-relationship', `its entry is the owner's, through graph remove-relationship; got ${show(d.change)}`);
  assert(show(d.change.changes) === show([{ change: 'relationship-removed', type: 'CITES', from: k.A, to: k.B, count: 1 }]), `the entry says what was removed, with its count; got ${show(d.change.changes)}`);
  assert(between('CITES', k.A, k.B).length === 0, 'the CITES from A to B is gone');
  assert(removals().some((e) => e.tapestryKey === d.change.id), 'the entry is kept');
});

test('RR2: the same call again changes nothing, records nothing, and answers already-gone with change: null', () => {
  const d = ok('rr2-again');
  assert(d.outcome === 'already-gone' && d.change === null, `already-gone, change null; got ${show(d)}`);
  const forAB = removals().filter((e) => JSON.stringify(e.changes).includes(`"from":"${main().k.A}","to":"${main().k.B}"`));
  assert(forAB.length === 1, `one entry for removing A to B, not two; got ${forAB.length}`);
});

test('RR3: two relationships of the type between the same two nodes are both removed, with a count of 2', () => {
  const { k } = main();
  const d = ok('rr3-two');
  assert(d.outcome === 'removed' && d.change && d.change.changes[0].count === 2, `both are removed, with a count of 2; got ${show(d)}`);
  assert(between('CITES', k.B, k.U).length === 0, 'no CITES from B to U is left');
});

test('RR4: a reserved type is refused reserved-type, so a class-thread edge can\'t be removed this way; it stays', () => {
  needDecl();
  const { a, sup, elem } = main();
  const x = a.req('rr4-reserved');
  assert(x.status === 409 && x.body.code === 'reserved-type' && x.body.rule === RULE, `409 reserved-type from ${RULE}; got ${x.status} ${show(x.body)}`);
  assert(between('HAS_ELEMENT', sup, elem).length === 1, 'the class-thread edge is still there');
});

test('RR5: a type the graph doesn\'t declare is refused undeclared-type, even where such a relationship exists; it stays', () => {
  needDecl();
  const { a, k } = main();
  const x = a.req('rr5-undeclared');
  assert(x.status === 409 && x.body.code === 'undeclared-type' && x.body.rule === RULE, `409 undeclared-type from ${RULE}; got ${x.status} ${show(x.body)}`);
  assert(between('MENTIONS', k.A, k.U).length === 1, 'the MENTIONS from A to U is still there');
});

test('RR6: a from or to that names no node is refused unknown-node, naming which', () => {
  needDecl();
  const { a } = main();
  for (const [id, input] of [['rr6-from', 'from'], ['rr6-to', 'to']]) {
    const x = a.req(id);
    assert(x.status === 404 && x.body.code === 'unknown-node' && x.body.input === input, `${id}: 404 unknown-node naming ${input}; got ${x.status} ${show(x.body)}`);
  }
});

test('RR7: nothing is signed; a visitor gets 401 and a stranger 403; the command removes one, recorded as the command\'s', () => {
  needDecl();
  const { a, k } = main();
  assert(ok('rr1-remove').outcome === 'removed', 'the path under test ran');
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key; the spy saw: ${show(a.spy)}`);
  assert(a.req('rr7-visitor').status === 401 && a.req('rr7-stranger').status === 403, `a visitor 401, a stranger 403; got ${a.req('rr7-visitor').status}, ${a.req('rr7-stranger').status}`);
  const c = a.cmd('rr7-cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.data.outcome === 'removed' && show(body.data.change.by) === show({ role: 'local', pubkey: null }), `the command removed it, recorded as the command's; got ${show(body)}`);
  assert(between('DEPENDS_ON', k.U, k.A).length === 0, 'the DEPENDS_ON from U to A is gone (and the visitor and the stranger didn\'t remove it first: they were refused)');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
