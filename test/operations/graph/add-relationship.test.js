'use strict';
/**
 * graph add-relationship — its own suite (ADR graph-operations-foundation/0001 Decision 12), run by
 * test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-foundation/4-the-write-path.md (AC1, AC2, AC4, AC6, AC7)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0004-the-write-path.md (Decisions 2, 3, 5–7, 10, 13)
 *
 * Stack-free: the real catalog, over a graph seeded for test/helpers/graphFake.js (test/helpers/graphOpsSuite.js
 * says what it holds), with the harness's spy on everything that signs or reads a key.
 *
 *   AR1  the owner adds a declared type between two nodes: one relationship, and its change entry, answered and kept
 *   AR2  the same call again adds nothing, records nothing, and answers already-there with change: null
 *   AR3  a type declared under a set below the concept's superset, to a NostrUser, is added too
 *   AR4  a type the graph doesn't declare is refused undeclared-type, naming the rule; nothing changes
 *   AR5  a reserved type is refused reserved-type, declared (HAS_ELEMENT) or not (FOLLOWS); nothing changes
 *   AR6  a from or to that names no node, or names a change entry, is refused unknown-node, naming which
 *   AR7  a type that isn't a plain name, or a from that isn't a tapestryKey, is refused invalid-input
 *   AR8  nothing is signed and no key is read, accepted, refused or repeated
 *   AR9  a visitor is refused 401 and a stranger 403, and neither changes anything
 *   AR10 an admin's call is recorded as the admin's
 *   AR11 the command adds one too, recorded as the command's, and its refusal matches the route's
 *   AR12 it is listed for an admin with its guard, repeatKey and refusals, and has its /docs entry
 */

const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');

const { ROOT, OWNER, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph add-relationship');

const ROUTE = '/api/tapestry/graph/add-relationship';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/add-relationship.js');
const RULE = 'relationship-type-allowed';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  const dir = tmp('add-rel-');
  const seed = S.seedGraph();
  const file = seed.file(dir);
  const k = seed.keys;
  const nobody = crypto.randomUUID();
  const post = (id, caller, body) => ({ id, method: 'POST', url: ROUTE, caller, body });
  const r = S.runHarness({
    spy: true,
    scenarios: [{
      graphFake: { stateFile: file },
      requests: [
        post('ar1-add', 'owner', { from: k.A, to: k.B, type: 'CITES' }),
        post('ar2-again', 'owner', { from: k.A, to: k.B, type: 'CITES' }),
        post('ar3-user', 'owner', { from: k.A, to: k.U, type: 'DEPENDS_ON' }),
        post('ar4-undeclared', 'owner', { from: k.A, to: k.B, type: 'MENTIONS' }),
        post('ar5-declared', 'owner', { from: k.A, to: k.B, type: 'HAS_ELEMENT' }),
        post('ar5-code', 'owner', { from: k.A, to: k.B, type: 'FOLLOWS' }),
        post('ar6-from', 'owner', { from: nobody, to: k.B, type: 'CITES' }),
        post('ar6-to', 'owner', { from: k.A, to: nobody, type: 'CITES' }),
        post('ar6-entry', 'owner', { from: k.A, to: k.G, type: 'CITES' }),
        post('ar7-space', 'owner', { from: k.A, to: k.B, type: 'CITES X' }),
        post('ar7-backtick', 'owner', { from: k.A, to: k.B, type: 'CI`TES' }),
        post('ar7-digit', 'owner', { from: k.A, to: k.B, type: '1CITES' }),
        post('ar7-from', 'owner', { from: 'not-a-key', to: k.B, type: 'CITES' }),
        post('ar9-visitor', 'visitor', { from: k.B, to: k.U, type: 'CITES' }),
        post('ar9-stranger', 'stranger', { from: k.B, to: k.U, type: 'CITES' }),
        post('ar10-admin', 'admin', { from: k.B, to: k.A, type: 'CITES' }),
        { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
      ],
      cli: [
        { id: 'ar11-cli', argv: ['graph', 'add-relationship', '--from', k.U, '--to', k.B, '--type', 'DEPENDS_ON'] },
        { id: 'ar11-refused', argv: ['graph', 'add-relationship', '--from', k.A, '--to', k.B, '--type', 'MENTIONS'] },
      ],
    }],
  }, { dir });
  MAIN = { r, a: S.answered(r), file, k, nobody };
  return MAIN;
}
const graph = () => S.readState(main().file);
const mine = () => S.entriesOf(graph()).filter((e) => e.tapestryKey !== main().k.G);
const between = (type, from, to) => S.relsOf(graph(), type).filter((x) => x.from === from && x.to === to);
function needDecl() {
  if (!require('fs').existsSync(DECL)) throw new Error('src/operations/catalog/graph/add-relationship.js does not exist yet (ADR graph-operations-foundation/0004 Decision 7)');
}
function ok(id) {
  needDecl();
  const x = main().a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body)}`);
  return x.body.data;
}

test('AR1: the owner adds a declared type between two nodes: one relationship, and its change entry, answered and kept', () => {
  const { k } = main();
  const d = ok('ar1-add');
  assert(d.outcome === 'added', `outcome added; got ${show(d)}`);
  assert(show(d.relationship) === show({ type: 'CITES', from: k.A, to: k.B }), `it answers the relationship; got ${show(d.relationship)}`);
  const c = d.change;
  assert(c && UUID.test(c.id) && ISO.test(c.at), `it answers its change entry, with an id and an ISO time; got ${show(c)}`);
  assert(show(c.by) === show({ role: 'owner', pubkey: OWNER }) && c.operation === 'graph add-relationship', `the entry is the owner's, through graph add-relationship; got ${show(c)}`);
  assert(show(c.changes) === show([{ change: 'relationship-added', type: 'CITES', from: k.A, to: k.B }]), `the entry says what changed; got ${show(c.changes)}`);
  assert(between('CITES', k.A, k.B).length === 1, `the graph holds one CITES from A to B; got ${show(S.relsOf(graph(), 'CITES'))}`);
  const kept = mine().filter((e) => e.tapestryKey === c.id);
  assert(kept.length === 1 && kept[0].labels.includes('GraphChange') && kept[0].labels.includes('TapestryNode'), `the entry is kept as a GraphChange node; got ${show(kept)}`);
  assert(show([...kept[0].keys].sort()) === show([k.A, k.B].sort()), `the kept entry's keys are A's and B's; got ${show(kept[0].keys)}`);
});

test('AR2: the same call again adds nothing, records nothing, and answers already-there with change: null', () => {
  const { k } = main();
  const d = ok('ar2-again');
  assert(d.outcome === 'already-there' && d.change === null, `already-there, change null; got ${show(d)}`);
  assert(between('CITES', k.A, k.B).length === 1, 'still one CITES from A to B');
  const forAB = mine().filter((e) => e.operation === 'graph add-relationship' && JSON.stringify(e.changes).includes(`"from":"${k.A}","to":"${k.B}"`));
  assert(forAB.length === 1, `one entry for the add of A to B, not two; got ${forAB.length}`);
});

test('AR3: a type declared under a set below the concept\'s superset, to a NostrUser, is added too', () => {
  const { k } = main();
  const d = ok('ar3-user');
  assert(d.outcome === 'added', `DEPENDS_ON from A to U is added; got ${show(d)}`);
  assert(between('DEPENDS_ON', k.A, k.U).length === 1, 'the graph holds it');
});

test('AR4: a type the graph doesn\'t declare is refused undeclared-type, naming the rule; nothing changes', () => {
  needDecl();
  const x = main().a.req('ar4-undeclared');
  assert(x.status === 409 && x.body.code === 'undeclared-type' && x.body.rule === RULE, `409 undeclared-type from ${RULE}; got ${x.status} ${show(x.body)}`);
  assert(/MENTIONS/.test(x.body.error), `the refusal names the type; got ${show(x.body.error)}`);
  assert(S.relsOf(graph(), 'MENTIONS').length === 0, 'no MENTIONS relationship was made');
  assert(!mine().some((e) => JSON.stringify(e.changes).includes('MENTIONS')), 'no entry was recorded for it');
});

test('AR5: a reserved type is refused reserved-type, declared (HAS_ELEMENT) or not (FOLLOWS); nothing changes', () => {
  needDecl();
  const { a, k } = main();
  for (const [id, type, maker] of [['ar5-declared', 'HAS_ELEMENT', /add-to-concept/], ['ar5-code', 'FOLLOWS', /trust pipeline/]]) {
    const x = a.req(id);
    assert(x.status === 409 && x.body.code === 'reserved-type' && x.body.rule === RULE, `${type}: 409 reserved-type from ${RULE}; got ${x.status} ${show(x.body)}`);
    assert(x.body.error.includes(type) && maker.test(x.body.error), `${type}'s refusal names it and what makes it (${maker}); got ${show(x.body.error)}`);
    assert(between(type, k.A, k.B).length === 0, `no ${type} from A to B was made`);
  }
});

test('AR6: a from or to that names no node, or names a change entry, is refused unknown-node, naming which', () => {
  needDecl();
  const { a, k, nobody } = main();
  for (const [id, input] of [['ar6-from', 'from'], ['ar6-to', 'to'], ['ar6-entry', 'to']]) {
    const x = a.req(id);
    assert(x.status === 404 && x.body.code === 'unknown-node' && x.body.input === input, `${id}: 404 unknown-node naming ${input}; got ${x.status} ${show(x.body)}`);
  }
  assert(!S.relsOf(graph(), 'CITES').some((r) => r.from === nobody || r.to === nobody || r.to === k.G), 'nothing was linked to a node that isn\'t there, or to an entry');
});

test('AR7: a type that isn\'t a plain name, or a from that isn\'t a tapestryKey, is refused invalid-input', () => {
  needDecl();
  const { a } = main();
  for (const [id, input] of [['ar7-space', 'type'], ['ar7-backtick', 'type'], ['ar7-digit', 'type'], ['ar7-from', 'from']]) {
    const x = a.req(id);
    assert(x.status === 400 && x.body.code === 'invalid-input' && x.body.input === input, `${id}: 400 invalid-input naming ${input} (ADR 0004 Decisions 6 and 7); got ${x.status} ${show(x.body)}`);
  }
});

test('AR8: nothing is signed and no key is read, accepted, refused or repeated', () => {
  const d = ok('ar1-add');
  assert(d.outcome === 'added', 'the path under test ran (AR1 added a relationship)');
  const { spy } = main().a;
  assert(Array.isArray(spy), `the harness's spy recorded its calls; got ${show(spy)}`);
  assert(spy.length === 0, `no write through the path signs, publishes or reads a key (ADR 0004 Decision 10); the spy saw: ${show(spy)}`);
});

test('AR9: a visitor is refused 401 and a stranger 403, and neither changes anything', () => {
  needDecl();
  const { a, k } = main();
  const v = a.req('ar9-visitor');
  const s = a.req('ar9-stranger');
  assert(v.status === 401 && v.body.code === 'sign-in-required', `a visitor: 401 sign-in-required; got ${v.status} ${show(v.body)}`);
  assert(s.status === 403 && s.body.code === 'not-allowed', `a stranger: 403 not-allowed; got ${s.status} ${show(s.body)}`);
  assert(between('CITES', k.B, k.U).length === 0, 'neither added anything');
});

test('AR10: an admin\'s call is recorded as the admin\'s', () => {
  const d = ok('ar10-admin');
  assert(d.outcome === 'added' && show(d.change && d.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the admin's add is recorded as the admin's; got ${show(d)}`);
});

test('AR11: the command adds one too, recorded as the command\'s, and its refusal matches the route\'s', () => {
  needDecl();
  const { a, k } = main();
  const c = a.cmd('ar11-cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.success === true && body.data.outcome === 'added', `the command answers as the route does; got ${show(body)}`);
  assert(show(body.data.change.by) === show({ role: 'local', pubkey: null }), `the command's entry names the command; got ${show(body.data.change.by)}`);
  assert(between('DEPENDS_ON', k.U, k.B).length === 1, 'the command added it');
  const refused = a.cmd('ar11-refused');
  assert(refused.code === 1, `a refused command exits 1; got ${refused.code}`);
  const rb = JSON.parse(refused.stdout);
  const route = a.req('ar4-undeclared').body;
  assert(rb.code === route.code && rb.error === route.error && rb.rule === route.rule, `the command's refusal is the route's; command ${show(rb)}, route ${show(route)}`);
});

test('AR12: it is listed for an admin with its guard, repeatKey and refusals, and has its /docs entry', () => {
  needDecl();
  const list = main().a.req('list');
  const e = ((list.body.data && list.body.data.operations) || []).find((o) => o.group === 'graph' && o.name === 'add-relationship');
  assert(e, `graph add-relationship is listed for an admin; problems: ${show(list.body.data && list.body.data.problems)}`);
  assert(e.kind === 'write' && e.method === 'POST' && e.access === 'owner-and-admins', `a POST write for the owner and admins; got ${show({ kind: e.kind, method: e.method, access: e.access })}`);
  assert(show(e.guards) === show([RULE]) && show(e.repeatKey) === show(['from', 'to', 'type']), `guards [${RULE}], repeatKey [from, to, type]; got ${show({ guards: e.guards, repeatKey: e.repeatKey })}`);
  const codes = e.refusals.map((x) => x.code);
  for (const c of ['undeclared-type', 'reserved-type', 'unknown-node', 'wrong-content-type', 'invalid-input', 'sign-in-required', 'not-allowed']) {
    assert(codes.includes(c), `its refusals include ${c}; got ${show(codes)}`);
  }
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('add-rel-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
