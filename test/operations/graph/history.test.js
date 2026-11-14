'use strict';
/**
 * graph history — its own suite (ADR graph-operations-foundation/0001 Decision 12), run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-foundation/4-the-write-path.md (AC5, AC7)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0004-the-write-path.md (Decisions 5 and 7)
 *
 * Stack-free, over a graph seeded for test/helpers/graphFake.js with 60 change entries a minute apart from
 * 2026-11-01T00:00:00.000Z (entry i at minute i): every third one touches A, the rest B; by the owner, an admin and
 * the command in turn; and two more at one instant, to show how a tie is ordered. A page's cursor is read from one
 * harness run and sent in the next, over the same graph.
 *
 *   H1 the entries come newest first, 50 to a page by default, and the cursor pages through all of them exactly once
 *   H2 the filters by node, by who made them (a pubkey, or local) and since a time each keep only theirs, and combine;
 *      a time given without milliseconds keeps the entry made at that very instant
 *   H3 a limit from 1 to 200 caps the page; 0 or 201 is refused invalid-input
 *   H4 a cursor that isn't one of history's is refused invalid-cursor
 *   H5 a node that isn't a tapestryKey, a by that isn't a pubkey or local, or a since that isn't a time, is refused
 *   H6 an entry add-relationship records is read back first, with what it answered
 *   H7 a visitor gets 401 and a stranger 403; the command answers the same entries as the route
 *   H8 history writes nothing
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const S = require('../../helpers/graphOpsSuite');

const { ROOT, OWNER, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph history');

const ROUTE = '/api/tapestry/graph/history';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/history.js');
const T0 = Date.parse('2026-11-01T00:00:00.000Z');
const atMinute = (i) => new Date(T0 + i * 60000).toISOString();
const TIE_AT = atMinute(100);

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/history.js does not exist yet (ADR graph-operations-foundation/0004 Decision 7)');
}

/** The seeded graph, and the entries it holds as history must answer them. */
let SEED = null;
function seeded() {
  if (SEED) return SEED;
  const dir = tmp('history-');
  const seed = S.seedGraph();
  const s = seed.state;
  const k = seed.keys;
  // The seed's own entry G stands at 2026-01-01; it is history's oldest.
  const who = [{ role: 'owner', pubkey: OWNER }, { role: 'admin', pubkey: ADMIN }, { role: 'local', pubkey: null }];
  const expected = [];
  const addEntry = (at, by, keyed) => {
    const changes = [{ change: 'relationship-added', type: 'CITES', from: keyed, to: k.U }];
    const props = { tapestryKey: crypto.randomUUID(), at, byRole: by.role, operation: 'graph add-relationship', keys: [keyed, k.U], changes: JSON.stringify(changes) };
    if (by.pubkey) props.byPubkey = by.pubkey;
    s.nodes.push({ eid: s.nextEid++, labels: ['GraphChange', 'TapestryNode'], props });
    expected.push({ id: props.tapestryKey, at, by, operation: 'graph add-relationship', changes, keys: props.keys });
  };
  for (let i = 0; i < 60; i++) addEntry(atMinute(i), who[i % 3], i % 3 === 0 ? k.A : k.B);
  addEntry(TIE_AT, who[0], k.B);
  addEntry(TIE_AT, who[1], k.B);
  const g = s.nodes.find((n) => n.props.tapestryKey === k.G);
  expected.push({ id: k.G, at: g.props.at, by: { role: 'owner', pubkey: OWNER }, operation: g.props.operation, changes: [], keys: [] });
  // Newest first; a tie by the later tapestryKey first.
  expected.sort((x, y) => (x.at === y.at ? (x.id < y.id ? 1 : -1) : (x.at < y.at ? 1 : -1)));
  const file = seed.file(dir);
  SEED = { dir, file, k, expected };
  return SEED;
}
const q = (params) => `${ROUTE}?${new URLSearchParams(params).toString()}`;
const get = (id, caller, params = {}) => ({ id, method: 'GET', url: q(params), caller });
const runOver = (requests, cli = []) => S.answered(S.runHarness({ scenarios: [{ graphFake: { stateFile: seeded().file }, requests, cli }] }, { dir: tmp('history-run-') }));

let FIRST = null;
function first() {
  if (FIRST) return FIRST;
  const { k } = seeded();
  FIRST = runOver([
    get('h1-page1', 'owner'),
    get('h2-node', 'owner', { node: k.A, limit: 200 }),
    get('h2-admin', 'owner', { by: ADMIN, limit: 200 }),
    get('h2-local', 'owner', { by: 'local', limit: 200 }),
    get('h2-since', 'owner', { since: '2026-11-01T00:30:00Z', limit: 200 }),
    get('h2-all3', 'owner', { node: k.A, by: OWNER, since: '2026-11-01T00:30:00.000Z', limit: 200 }),
    get('h3-three', 'admin', { limit: 3 }),
    get('h3-zero', 'owner', { limit: 0 }),
    get('h3-over', 'owner', { limit: 201 }),
    get('h4-garbage', 'owner', { cursor: 'garbage!!' }),
    get('h4-shape', 'owner', { cursor: Buffer.from(JSON.stringify(['x'])).toString('base64url') }),
    get('h5-node', 'owner', { node: 'not-a-key' }),
    get('h5-by', 'owner', { by: 'xyz' }),
    get('h5-since', 'owner', { since: 'yesterday' }),
    get('h7-visitor', 'visitor'),
    get('h7-stranger', 'stranger'),
    get('h7-route', 'owner', { node: k.A, limit: 5 }),
  ], [{ id: 'h7-cli', argv: ['graph', 'history', '--node', k.A, '--limit', '5'] }]);
  return FIRST;
}
function ok(a, id) {
  needDecl();
  const x = a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body)}`);
  assert(x.body.data && Array.isArray(x.body.data.entries), `${id} answers { entries, cursor }; got ${show(x.body.data)}`);
  return x.body.data;
}
const ids = (entries) => entries.map((e) => e.id);
const asAnswered = (e) => ({ id: e.id, at: e.at, by: e.by, operation: e.operation, changes: e.changes });

test('H1: the entries come newest first, 50 to a page by default, and the cursor pages through all of them exactly once', () => {
  const { expected } = seeded();
  const p1 = ok(first(), 'h1-page1');
  assert(p1.entries.length === 50, `a page holds 50 by default; got ${p1.entries.length}`);
  assert(show(p1.entries.map(asAnswered)) === show(expected.slice(0, 50).map(asAnswered)), `page 1 is the 50 newest, newest first, each as { id, at, by, operation, changes }; first got ${show(p1.entries[0])}, wanted ${show(asAnswered(expected[0]))}`);
  assert(typeof p1.cursor === 'string' && p1.cursor.length > 0, `page 1 has a cursor for the next; got ${show(p1.cursor)}`);
  const p2 = ok(runOver([get('h1-page2', 'owner', { cursor: p1.cursor })]), 'h1-page2');
  assert(show(ids(p2.entries)) === show(ids(expected.slice(50))), `page 2 is the rest, in order; got ${show(ids(p2.entries))}`);
  assert(p2.cursor === null, `the last page's cursor is null; got ${show(p2.cursor)}`);
  const tie = expected.filter((e) => e.at === TIE_AT).map((e) => e.id);
  assert(tie.length === 2 && tie[0] > tie[1], 'the tie is ordered by the later tapestryKey first');
});

test('H2: the filters keep only theirs and combine; a time without milliseconds keeps the entry at that instant', () => {
  const { expected, k } = seeded();
  const a = first();
  const want = (pred) => ids(expected.filter(pred));
  const node = ok(a, 'h2-node');
  assert(show(ids(node.entries)) === show(want((e) => e.keys.includes(k.A))), `node: the entries that touched A, newest first; got ${node.entries.length}`);
  const admin = ok(a, 'h2-admin');
  assert(show(ids(admin.entries)) === show(want((e) => e.by.role === 'admin')), `by a pubkey: the admin's entries; got ${admin.entries.length}`);
  const local = ok(a, 'h2-local');
  assert(show(ids(local.entries)) === show(want((e) => e.by.role === 'local')), `by local: the command's entries; got ${local.entries.length}`);
  const since = ok(a, 'h2-since');
  assert(show(ids(since.entries)) === show(want((e) => e.at >= '2026-11-01T00:30:00.000Z')), `since: the entries at or after 00:30, the one at 00:30:00.000 included; got ${since.entries.length}`);
  assert(since.entries.some((e) => e.at === '2026-11-01T00:30:00.000Z'), 'the entry made at 00:30:00.000 is kept when since says 00:30:00Z');
  const all3 = ok(a, 'h2-all3');
  assert(show(ids(all3.entries)) === show(want((e) => e.keys.includes(k.A) && e.by.role === 'owner' && e.at >= '2026-11-01T00:30:00.000Z')), `the three filters together; got ${all3.entries.length}`);
});

test('H3: a limit from 1 to 200 caps the page; 0 or 201 is refused invalid-input', () => {
  const { expected } = seeded();
  const a = first();
  const three = ok(a, 'h3-three');
  assert(show(ids(three.entries)) === show(ids(expected.slice(0, 3))) && typeof three.cursor === 'string', `limit 3: the 3 newest and a cursor; got ${show(three)}`);
  for (const id of ['h3-zero', 'h3-over']) {
    const x = a.req(id);
    assert(x.status === 400 && x.body.code === 'invalid-input' && x.body.input === 'limit', `${id}: 400 invalid-input naming limit; got ${x.status} ${show(x.body)}`);
  }
});

test('H4: a cursor that isn\'t one of history\'s is refused invalid-cursor', () => {
  needDecl();
  const a = first();
  for (const id of ['h4-garbage', 'h4-shape']) {
    const x = a.req(id);
    assert(x.status === 400 && x.body.code === 'invalid-cursor', `${id}: 400 invalid-cursor; got ${x.status} ${show(x.body)}`);
  }
});

test('H5: a node that isn\'t a tapestryKey, a by that isn\'t a pubkey or local, or a since that isn\'t a time, is refused', () => {
  needDecl();
  const a = first();
  for (const [id, input] of [['h5-node', 'node'], ['h5-by', 'by'], ['h5-since', 'since']]) {
    const x = a.req(id);
    assert(x.status === 400 && x.body.code === 'invalid-input' && x.body.input === input, `${id}: 400 invalid-input naming ${input}; got ${x.status} ${show(x.body)}`);
  }
});

test('H6: an entry add-relationship records is read back first, with what it answered', () => {
  needDecl();
  const { k } = seeded();
  const a = runOver([
    { id: 'add', method: 'POST', url: '/api/tapestry/graph/add-relationship', caller: 'owner', body: { from: k.A, to: k.B, type: 'CITES' } },
    get('read-back', 'owner', { limit: 1 }),
  ]);
  const add = a.req('add');
  assert(add.status === 200 && add.body.data.change, `the add answers 200 with its entry; got ${add.status} ${show(add.body)}`);
  const back = ok(a, 'read-back');
  assert(back.entries.length === 1 && show(back.entries[0]) === show(add.body.data.change), `history's newest entry is the one the add answered (the story's "read back"); got ${show(back.entries[0])}, answered ${show(add.body.data.change)}`);
});

test('H7: a visitor gets 401 and a stranger 403; the command answers the same entries as the route', () => {
  needDecl();
  const a = first();
  assert(a.req('h7-visitor').status === 401 && a.req('h7-stranger').status === 403, `a visitor 401, a stranger 403; got ${a.req('h7-visitor').status}, ${a.req('h7-stranger').status}`);
  const route = ok(a, 'h7-route');
  const c = a.cmd('h7-cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(show(body.data) === show(route), `the command answers what the route does; command ${show(body.data).slice(0, 200)}, route ${show(route).slice(0, 200)}`);
});

test('H8: history writes nothing', () => {
  needDecl();
  const before = S.readState(seeded().file);
  const a = runOver([get('h8-a', 'owner'), get('h8-b', 'admin', { node: seeded().k.A })]);
  ok(a, 'h8-a');
  const after = S.readState(seeded().file);
  const newLog = after.log.slice(before.log.length);
  assert(newLog.length > 0 && newLog.every((e) => e.call === 'read'), `history only reads: it opens no write transaction; the log: ${show(newLog)}`);
  assert(after.nodes.length === before.nodes.length && after.rels.length === before.rels.length, 'the graph is as it was');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
