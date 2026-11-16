'use strict';
/**
 * The read conventions, src/operations/reads.js — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/11-list-elements.md (AC3, AC4, AC7)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0011-list-elements-and-the-read-conventions.md
 *          (Decision 1: C1 paging, C2 the point of view, C3 a node, answered)
 *
 * Stack-free. The module is required in a child process with the harness's environment (the owner, the TA and every
 * service endpoint dead: test/helpers/graphOpsSuite.js's childEnv), and called over graphs test/helpers/elementsGraph.js
 * seeds, its reads through graphFake's readerOver. Only what the ADR pins is checked: the exports' names and schemas,
 * the cursor's text and what it refuses, a page's cut, how a point of view resolves and what counts for it, and a
 * node's five facts. How each gets there is the Implementer's.
 *
 *   RC1  it exports the inputs, the refusals, the schemas and the functions the ADR names
 *   RC2  limit, cursor and pov are input declarations whose schemas are C1's and C2's
 *   RC3  invalid-cursor and unknown-pov are 400s, each saying when
 *   RC4  NODE and POV are the shapes C2 and C3 give
 *   RC5  a cursor is the base64url of [read, scope, position], and decodes back to its position
 *   RC6  a cursor that doesn't parse, or names another read, another list or a bad position, is refused invalid-cursor
 *   RC7  a scope is 16 hex characters, the same for the same parts and different for any other
 *   RC8  a page is the first limit rows, with a cursor only when more came back
 *   RC9  owner, or the owner's pubkey, is the owner's point of view; everyone is everyone's; any other is unknown-pov
 *   RC10 scored says whether the owner's scores exist, and only the owner's point of view reads it
 *   RC11 the cutoff is VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF, and 0.05 when it isn't set or isn't a number
 *   RC12 trust counts the author-less, the instance's own and those scored above the cutoff; everyone counts all
 *   RC13 nodeColumns and nodeOf answer a node's five facts
 *   RC14 ownKeys are the assistant's and the owner's
 *   RC15 loading it opens nothing
 *   RC16 the assistant's and the owner's keys are trimmed and lowercased (review round 1, ask 4)
 *
 * Story graph-operations-first-slice #13 (ADR graph-operations-first-slice/0013 Decision 1: C5 a relationship,
 * answered, and C6 a relationship, from a point of view), over graphs test/helpers/relationshipsGraph.js seeds:
 *   RC17 it exports RELATIONSHIP, relationshipColumns and relationshipOf
 *   RC18 RELATIONSHIP is { type, direction, from, to, node, properties }, its node C3's NODE
 *   RC19 relationshipColumns returns a relationship's type, its id as text, what it records as [key, value] pairs, and
 *        the node at its other end's facts
 *   RC20 relationshipOf answers a relationship by its direction: from and to, the node, and its properties as a map
 *        with its keys sorted
 *   RC21 trust(v, keep) carries the variables it keeps and judges the node v; a name that isn't a variable throws
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../helpers/graphOpsSuite');

const { ROOT, OWNER, ADMIN, TA, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: the read conventions (reads.js)');

const READS = path.join(ROOT, 'src/operations/reads.js');
const missing = () => new Error('src/operations/reads.js does not exist yet (ADR graph-operations-first-slice/0011 Decision 1)');

/** The child's script: it requires reads.js, runs every check and prints its findings as one JSON line. */
const SCRIPT = `
'use strict';
const path = require('path');
const ROOT = ${JSON.stringify(ROOT)};
const out = {};
const done = () => { process.stdout.write('RESULT:' + JSON.stringify(out) + '\\n'); };
const loadedDriver = () => Object.keys(require.cache).some((p) => p.includes(path.sep + 'neo4j-driver' + path.sep));
let R;
try {
  R = require(path.join(ROOT, 'src/operations/reads.js'));
} catch (e) {
  out.missing = /Cannot find module/.test(String(e && e.message)) && String(e.message).includes('reads.js');
  out.loadError = String((e && e.message) || e).split('\\n')[0];
  done();
  process.exit(0);
}
out.driverAtLoad = loadedDriver();
const { readerOver } = require(path.join(ROOT, 'test/helpers/graphFake.js'));
const { seedElements } = require(path.join(ROOT, 'test/helpers/elementsGraph.js'));
const refusalOf = (fn) => { try { fn(); return { threw: false }; } catch (e) { return { threw: true, isRefusal: !!(e && e.isRefusal), code: e && e.code, extra: e && e.extra, message: e && e.message }; } };
const asyncRefusalOf = async (p) => { try { const v = await p(); return { threw: false, value: v }; } catch (e) { return { threw: true, isRefusal: !!(e && e.isRefusal), code: e && e.code, extra: e && e.extra, message: e && e.message }; } };
const wrap = (x) => (x === undefined ? null : x);

(async () => {
  out.exports = Object.fromEntries(Object.entries(R).map(([k, v]) => [k, typeof v]));
  out.inputs = { limit: wrap(R.LIMIT_INPUT), cursor: wrap(R.CURSOR_INPUT), pov: wrap(R.POV_INPUT) };
  out.refusals = { invalidCursor: wrap(R.INVALID_CURSOR), unknownPov: wrap(R.UNKNOWN_POV) };
  out.schemas = { node: wrap(R.NODE), pov: wrap(R.POV) };
  const KEY = '0f0f0f0f-0000-4000-8000-000000000001';
  const isKey = (p) => typeof p === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(p);
  const scope = R.scopeOf(['a', null, false, 'owner']);
  const cursor = R.encodeCursor('graph list-elements', scope, KEY);
  let text = null;
  try { text = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')); } catch { text = 'unparsed'; }
  out.cursor = { cursor, text, scope, back: wrap(R.decodeCursor('graph list-elements', scope, cursor, isKey)) };
  const enc = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');
  out.badCursors = {
    garbage: refusalOf(() => R.decodeCursor('graph list-elements', scope, 'garbage!!', isKey)),
    notJson: refusalOf(() => R.decodeCursor('graph list-elements', scope, Buffer.from('not json').toString('base64url'), isKey)),
    otherRead: refusalOf(() => R.decodeCursor('graph list-elements', scope, R.encodeCursor('graph walk', scope, KEY), isKey)),
    otherScope: refusalOf(() => R.decodeCursor('graph list-elements', scope, R.encodeCursor('graph list-elements', R.scopeOf(['b', null, false, 'owner']), KEY), isKey)),
    badPosition: refusalOf(() => R.decodeCursor('graph list-elements', scope, R.encodeCursor('graph list-elements', scope, 'not-a-key'), isKey)),
    wrongLength: refusalOf(() => R.decodeCursor('graph list-elements', scope, enc(['graph list-elements', scope]), isKey)),
    historys: refusalOf(() => R.decodeCursor('graph list-elements', scope, enc(['2026-01-01T00:00:00.000Z', KEY]), isKey)),
  };
  out.scopes = {
    one: R.scopeOf(['a', null, false, 'owner']),
    again: R.scopeOf(['a', null, false, 'owner']),
    otherKey: R.scopeOf(['b', null, false, 'owner']),
    asSet: R.scopeOf([null, 'a', false, 'owner']),
    direct: R.scopeOf(['a', null, true, 'owner']),
    everyone: R.scopeOf(['a', null, false, 'everyone']),
  };
  const rows = (n) => Array.from({ length: n }, (_, i) => ({ tapestryKey: 'k' + String(i).padStart(3, '0') }));
  const cut = (n, limit) => R.pageOf(rows(n), limit, (last) => 'after:' + last.tapestryKey);
  out.pages = { fewer: cut(3, 5), exactly: cut(5, 5), more: cut(6, 5) };

  const scoredSeed = seedElements();
  const unscoredSeed = seedElements({ unscored: true });
  const scoredRead = readerOver(scoredSeed.state);
  const unscoredRead = readerOver(unscoredSeed.state);
  let reads = 0;
  const counting = (read) => async (q, p) => { reads++; return read(q, p); };
  const throwing = async () => { throw new Error('the everyone point of view read the graph'); };
  out.pov = {
    owner: await asyncRefusalOf(() => R.resolvePov(counting(scoredRead), 'owner')),
    ownerReads: reads,
    ownerPubkey: await asyncRefusalOf(() => R.resolvePov(scoredRead, ${JSON.stringify(OWNER)})),
    unscored: await asyncRefusalOf(() => R.resolvePov(unscoredRead, 'owner')),
    everyone: await asyncRefusalOf(() => R.resolvePov(throwing, 'everyone')),
    stranger: await asyncRefusalOf(() => R.resolvePov(scoredRead, ${JSON.stringify('ef'.repeat(32))})),
    admin: await asyncRefusalOf(() => R.resolvePov(scoredRead, ${JSON.stringify(ADMIN)})),
  };

  const seed = scoredSeed;
  const k = seed.keys;
  const trustRows = (pov) => scoredRead(
    'MATCH (s:TapestryNode {tapestryKey: $s})-[:HAS_ELEMENT]->(e) ' + R.trust('e') + ' RETURN e.tapestryKey AS key, counts',
    { s: pov.set, everyone: pov.everyone, own: [${JSON.stringify(TA)}, ${JSON.stringify(OWNER)}], cutoff: pov.cutoff },
  );
  const name = (key) => Object.keys(k).find((n) => k[n] === key);
  const byName = async (pov) => Object.fromEntries((await trustRows(pov)).map((r) => [name(r.key), r.counts]));
  out.trust = {
    walkersOwner: await byName({ set: k.W, everyone: false, cutoff: 0.05 }),
    supersetOwner: await byName({ set: k.S, everyone: false, cutoff: 0.05 }),
    walkersEveryone: await byName({ set: k.W, everyone: true, cutoff: null }),
    walkersHighCutoff: await byName({ set: k.W, everyone: false, cutoff: 0.3 }),
  };
  const own = R.ownKeys();
  const nodeRows = await scoredRead('MATCH (s:TapestryNode {tapestryKey: $s})-[:HAS_ELEMENT]->(e) RETURN ' + R.nodeColumns('e'), { s: k.W });
  out.nodes = Object.fromEntries(nodeRows.map((r) => [name(r.tapestryKey), R.nodeOf(r, own)]));
  out.ownKeys = own;
  out.uuids = seed.uuids;

  // ── C5 and C6 (ADR graph-operations-first-slice/0013 Decision 1) ──
  out.rel = { schema: wrap(R.RELATIONSHIP), errors: {} };
  const attempt = async (name, fn) => { try { await fn(); } catch (e) { out.rel.errors[name] = String((e && e.message) || e).split('\\n')[0]; } };
  const { seedRelationships } = require(path.join(ROOT, 'test/helpers/relationshipsGraph.js'));
  const rs = seedRelationships();
  const rread = readerOver(rs.state);
  const rk = rs.keys;
  const rname = (key) => Object.keys(rk).find((n) => rk[n] === key) || key;
  out.rel.bob = rk.bob;
  await attempt('columns', async () => {
    out.rel.columns = await rread('MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) WHERE m.tapestryKey IS NOT NULL RETURN ' + R.relationshipColumns('r', 'm'), { key: rk.alice });
  });
  out.rel.badKeep = refusalOf(() => R.trust('m', ['not a variable']));
  await attempt('judged', async () => {
    const judged = await rread(
      'MATCH (x:TapestryNode {tapestryKey: $key})-[r]->(m) WHERE m.tapestryKey IS NOT NULL AND m.tapestryKey <> ' + "'{}'" + ' AND NOT m:NostrEventTag ' + R.trust('m', ['r']) + ' RETURN type(r) AS type, m.tapestryKey AS key, counts',
      { key: rk.hub, everyone: false, own: [${JSON.stringify(TA)}, ${JSON.stringify(OWNER)}], cutoff: 0.05 },
    );
    out.rel.judged = judged.map((row) => [row.type, rname(row.key), row.counts]);
  });
  await attempt('of', async () => {
    const K1 = '0f0f0f0f-0000-4000-8000-000000000001';
    const K2 = '0f0f0f0f-0000-4000-8000-000000000002';
    const row = { type: 'CITES', rid: '5:x:1', properties: [['zeta', 1], ['alpha', 'a'], ['mid', [1, 2]]], tapestryKey: K2, name: 'other', address: '39999:' + ${JSON.stringify(TA)} + ':other', author: ${JSON.stringify(TA)} };
    out.rel.K1 = K1;
    out.rel.K2 = K2;
    out.rel.ofOut = R.relationshipOf(row, { key: K1, direction: 'out', own });
    out.rel.ofIn = R.relationshipOf(row, { key: K1, direction: 'in', own });
    out.rel.ofLoop = R.relationshipOf(Object.assign({}, row, { tapestryKey: K1 }), { key: K1, direction: 'out', own });
    out.rel.ofPeer = R.relationshipOf(Object.assign({}, row, { author: '22'.repeat(32), properties: [] }), { key: K1, direction: 'in', own });
  });
  done();
})().catch((e) => { out.error = String((e && e.stack) || e).split('\\n').slice(0, 6).join(' | '); done(); });
`;

function runChild(confLines = null, envExtra = null) {
  const dir = tmp('reads-');
  const env = { ...S.childEnv(dir), ...(envExtra || {}) };
  if (confLines) fs.writeFileSync(env.BRAINSTORM_CONF_PATH, confLines.join(NL) + NL);
  const script = path.join(dir, 'reads-check.js');
  fs.writeFileSync(script, SCRIPT);
  const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env, timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  const line = (child.stdout || '').split('RESULT:')[1];
  let res = null;
  try { res = line ? JSON.parse(line.split('\n')[0]) : null; } catch { res = null; }
  return res || { error: `no result: ${(child.stderr || '').slice(-600)}` };
}

let MAIN = null;
function result() {
  if (!MAIN) MAIN = runChild();
  if (MAIN.missing || (MAIN.loadError && !fs.existsSync(READS))) throw missing();
  assert(!MAIN.loadError, `reads.js failed to load: ${MAIN.loadError}`);
  assert(!MAIN.error, `the child failed: ${MAIN.error}`);
  return MAIN;
}
const conf = (...extra) => [
  `export BRAINSTORM_OWNER_PUBKEY="${OWNER}"`,
  'export NEO4J_URI="bolt://127.0.0.1:9"',
  'export REDIS_HOST="127.0.0.1"',
  'export REDIS_PORT="9"',
  ...extra,
];

test('RC1: it exports the inputs, the refusals, the schemas and the functions the ADR names', () => {
  const r = result();
  for (const name of ['LIMIT_INPUT', 'CURSOR_INPUT', 'POV_INPUT', 'INVALID_CURSOR', 'UNKNOWN_POV', 'NODE', 'POV']) {
    assert(r.exports[name] === 'object', `it exports ${name}, an object; got ${show(r.exports[name])}`);
  }
  for (const name of ['encodeCursor', 'decodeCursor', 'scopeOf', 'pageOf', 'resolvePov', 'trust', 'ownKeys', 'nodeColumns', 'nodeOf']) {
    assert(r.exports[name] === 'function', `it exports ${name}, a function; got ${show(r.exports[name])}`);
  }
});

test('RC2: limit, cursor and pov are input declarations whose schemas are C1\'s and C2\'s', () => {
  const { inputs } = result();
  for (const name of ['limit', 'cursor', 'pov']) {
    const i = inputs[name];
    assert(i && i.schema && typeof i.schema === 'object' && !i.required, `${name}: an input declaration, { schema, description }, not required; got ${show(i)}`);
    assert(typeof i.description === 'string' && i.description.length > 0, `${name} says what it is; got ${show(i)}`);
  }
  const { limit, cursor, pov } = inputs;
  assert(limit.schema.type === 'integer' && limit.schema.minimum === 1 && limit.schema.maximum === 200 && limit.schema.default === 50, `limit: an integer from 1 to 200, 50 by default; got ${show(limit.schema)}`);
  assert(cursor.schema.type === 'string' && cursor.schema.minLength === 1, `cursor: text of at least one character; got ${show(cursor.schema)}`);
  assert(pov.schema.type === 'string' && pov.schema.default === 'owner', `pov: text, owner by default; got ${show(pov.schema)}`);
  const re = new RegExp(pov.schema.pattern);
  for (const good of ['owner', 'everyone', 'aa'.repeat(32)]) assert(re.test(good), `pov's pattern takes ${good}`);
  for (const bad of ['house', 'Owner', 'AA'.repeat(32), 'aa'.repeat(31), 'owner ', '']) assert(!re.test(bad), `pov's pattern refuses ${show(bad)}`);
});

test('RC3: invalid-cursor and unknown-pov are 400s, each saying when', () => {
  const { refusals } = result();
  const c = refusals.invalidCursor;
  const p = refusals.unknownPov;
  assert(c && c.code === 'invalid-cursor' && c.status === 400 && typeof c.when === 'string' && c.when, `INVALID_CURSOR: invalid-cursor, 400, with when; got ${show(c)}`);
  assert(p && p.code === 'unknown-pov' && p.status === 400 && typeof p.when === 'string' && p.when, `UNKNOWN_POV: unknown-pov, 400, with when; got ${show(p)}`);
});

test('RC4: NODE and POV are the shapes C3 and C2 give', () => {
  const { schemas } = result();
  const n = schemas.node;
  assert(n && n.type === 'object' && show([...(n.required || [])].sort()) === show(['address', 'author', 'name', 'own', 'tapestryKey']), `NODE requires its five facts; got ${show(n && n.required)}`);
  assert(show(Object.keys(n.properties || {}).sort()) === show(['address', 'author', 'name', 'own', 'tapestryKey']), `NODE has those five properties and no others; got ${show(Object.keys(n.properties || {}))}`);
  assert(n.properties.tapestryKey.type === 'string' && n.properties.own.type === 'boolean', `tapestryKey is text and own a boolean; got ${show(n.properties)}`);
  for (const f of ['name', 'address', 'author']) assert(n.properties[f].type === 'string' && n.properties[f].nullable === true, `${f} is text that may be null; got ${show(n.properties[f])}`);
  const p = schemas.pov;
  assert(p && p.type === 'object' && show([...(p.required || [])].sort()) === show(['cutoff', 'name', 'observer', 'scored']), `POV requires name, observer, cutoff and scored; got ${show(p && p.required)}`);
  assert(p.properties.name && p.properties.name.type === 'string', `POV's name is text (owner or everyone, for now); got ${show(p.properties.name)}`);
  for (const f of ['observer', 'cutoff', 'scored']) assert(p.properties[f] && p.properties[f].nullable === true, `POV's ${f} may be null, as it is for everyone; got ${show(p.properties[f])}`);
});

test('RC5: a cursor is the base64url of [read, scope, position], and decodes back to its position', () => {
  const { cursor } = result();
  assert(/^[A-Za-z0-9_-]+$/.test(cursor.cursor), `a cursor is base64url text; got ${show(cursor.cursor)}`);
  assert(show(cursor.text) === show(['graph list-elements', cursor.scope, '0f0f0f0f-0000-4000-8000-000000000001']), `it is the JSON [read, scope, position]; got ${show(cursor.text)}`);
  assert(cursor.back === '0f0f0f0f-0000-4000-8000-000000000001', `decodeCursor gives the position back; got ${show(cursor.back)}`);
});

test('RC6: a cursor that doesn\'t parse, or names another read, another list or a bad position, is refused invalid-cursor', () => {
  const { badCursors } = result();
  for (const [name, r] of Object.entries(badCursors)) {
    assert(r.threw && r.isRefusal && r.code === 'invalid-cursor' && r.extra && r.extra.input === 'cursor', `${name}: refused invalid-cursor, naming cursor; got ${show(r)}`);
    assert(typeof r.message === 'string' && r.message.length > 0, `${name}: the refusal says what to do; got ${show(r.message)}`);
    assert(!/concept or set/.test(r.message), `${name}: the shared refusal names no one read's inputs, since every read uses it; got ${show(r.message)}`);
  }
});

test('RC7: a scope is 16 hex characters, the same for the same parts and different for any other', () => {
  const { scopes } = result();
  assert(/^[0-9a-f]{16}$/.test(scopes.one), `16 lowercase hex characters; got ${show(scopes.one)}`);
  assert(scopes.one === scopes.again, 'the same parts give the same scope');
  for (const other of ['otherKey', 'asSet', 'direct', 'everyone']) assert(scopes[other] !== scopes.one, `changing the parts (${other}) changes the scope`);
});

test('RC8: a page is the first limit rows, with a cursor only when more came back', () => {
  const { pages } = result();
  assert(pages.fewer.items.length === 3 && pages.fewer.cursor === null, `3 rows under a limit of 5: all 3, no cursor; got ${show(pages.fewer)}`);
  assert(pages.exactly.items.length === 5 && pages.exactly.cursor === null, `5 rows, limit 5: all 5, no cursor; got ${show(pages.exactly)}`);
  assert(pages.more.items.length === 5 && pages.more.cursor === 'after:k004', `6 rows, limit 5: the first 5, and the cursor of the 5th; got ${show(pages.more)}`);
});

test('RC9: owner, or the owner\'s pubkey, is the owner\'s point of view; everyone is everyone\'s; any other is unknown-pov', () => {
  const { pov } = result();
  const o = pov.owner;
  assert(!o.threw && o.value && o.value.name === 'owner' && o.value.observer === OWNER && o.value.cutoff === 0.05 && o.value.scored === true, `owner: the owner as observer, cutoff 0.05, scored; got ${show(o)}`);
  assert(Array.isArray(o.value.own) && o.value.own.includes(TA) && o.value.own.includes(OWNER), `owner: own holds the assistant and the owner; got ${show(o.value.own)}`);
  const p = pov.ownerPubkey;
  assert(!p.threw && show({ ...p.value, own: [...p.value.own].sort() }) === show({ ...o.value, own: [...o.value.own].sort() }), `the owner's own pubkey resolves exactly as owner; got ${show(p)}`);
  const e = pov.everyone;
  assert(!e.threw && e.value.name === 'everyone' && e.value.observer === null && e.value.cutoff === null && e.value.scored === null, `everyone: no observer, cutoff or scores; got ${show(e)}`);
  for (const name of ['stranger', 'admin']) {
    const r = pov[name];
    assert(r.threw && r.isRefusal && r.code === 'unknown-pov' && r.extra && r.extra.input === 'pov', `${name}'s pubkey: refused unknown-pov, naming pov; got ${show(r)}`);
    assert(/owner/.test(r.message) && /everyone/.test(r.message), `${name}: the refusal says which points of view it reads from; got ${show(r.message)}`);
  }
});

test('RC10: scored says whether the owner\'s scores exist, and only the owner\'s point of view reads it', () => {
  const { pov } = result();
  assert(pov.ownerReads >= 1, `the owner's point of view reads the graph for scored; it read ${pov.ownerReads} times`);
  assert(!pov.unscored.threw && pov.unscored.value.scored === false, `with no influence on any NostrUser, scored is false; got ${show(pov.unscored)}`);
  assert(!pov.everyone.threw, `everyone reads nothing: a read that throws is never called; got ${show(pov.everyone)}`);
});

test('RC11: the cutoff is VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF, and 0.05 when it isn\'t set or isn\'t a number', () => {
  if (!fs.existsSync(READS)) throw missing();
  const set = runChild(conf('export VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF="0.15"'));
  assert(!set.error && set.pov && set.pov.owner.value && set.pov.owner.value.cutoff === 0.15, `set to 0.15, the cutoff is 0.15; got ${show(set.pov ? set.pov.owner : set)}`);
  const bad = runChild(conf('export VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF="lots"'));
  assert(!bad.error && bad.pov && bad.pov.owner.value && bad.pov.owner.value.cutoff === 0.05, `set to something not a number, the cutoff is 0.05; got ${show(bad.pov ? bad.pov.owner : bad)}`);
  assert(result().pov.owner.value.cutoff === 0.05, 'not set at all, the cutoff is 0.05');
});

test('RC12: trust counts the author-less, the instance\'s own and those scored above the cutoff; everyone counts all', () => {
  const { trust } = result();
  const want = { bella: true, spot: true, ada: true, named: true, hi: true, admin: false };
  assert(show(trust.walkersOwner) === show(Object.fromEntries(Object.keys(trust.walkersOwner).map((n) => [n, want[n]]))) && Object.keys(trust.walkersOwner).length === 6, `walkers' own elements, from the owner's point of view: all but admin (0.01) count; got ${show(trust.walkersOwner)}`);
  const sup = trust.supersetOwner;
  assert(sup.rover === true && sup.bella === true && sup.unnamed === true && sup.lo === false && sup.noscore === false, `the superset's: the assistant's count; lo (0.01) and noscore (no influence) do not; got ${show(sup)}`);
  assert(Object.values(trust.walkersEveryone).every((v) => v === true) && Object.keys(trust.walkersEveryone).length === 6, `everyone: every element counts; got ${show(trust.walkersEveryone)}`);
  assert(trust.walkersHighCutoff.hi === false && trust.walkersHighCutoff.spot === true && trust.walkersHighCutoff.ada === true, `with the cutoff at 0.3, hi (0.2) no longer counts, while the owner's and the author-less still do; got ${show(trust.walkersHighCutoff)}`);
});

test('RC13: nodeColumns and nodeOf answer a node\'s five facts', () => {
  const { nodes, uuids } = result();
  const want = (n) => show(Object.keys(n).sort()) === show(['address', 'author', 'name', 'own', 'tapestryKey']);
  for (const [name, n] of Object.entries(nodes)) assert(want(n), `${name}: exactly the five facts; got ${show(n)}`);
  assert(nodes.spot && nodes.spot.name === 'spot' && nodes.spot.address === uuids.spot && nodes.spot.author === OWNER && nodes.spot.own === true, `spot: its name, address, the owner as author, own; got ${show(nodes.spot)}`);
  assert(nodes.named && nodes.named.name === 'Named Dog', `named: its tapestryValue is its name; got ${show(nodes.named)}`);
  assert(nodes.ada && nodes.ada.author === null && nodes.ada.address === null && nodes.ada.own === true, `ada: no author or address, and own; got ${show(nodes.ada)}`);
  assert(nodes.admin && nodes.admin.author === ADMIN && nodes.admin.own === false, `admin: an admin's is not own; got ${show(nodes.admin)}`);
  assert(nodes.hi && nodes.hi.own === false, `hi: a peer's is not own; got ${show(nodes.hi)}`);
});

test('RC14: ownKeys are the assistant\'s and the owner\'s', () => {
  const { ownKeys } = result();
  assert(Array.isArray(ownKeys) && show([...ownKeys].sort()) === show([OWNER, TA].sort()), `the assistant's and the owner's pubkeys, and nothing else; got ${show(ownKeys)}`);
});

test('RC15: loading it opens nothing', () => {
  const r = result();
  assert(r.driverAtLoad === false, 'requiring reads.js loads no Neo4j driver (ADR graph-operations-foundation/0001 Decision 10)');
});

test('RC16: the assistant\'s and the owner\'s keys are trimmed and lowercased', () => {
  if (!fs.existsSync(READS)) throw missing();
  const upperOwner = conf().map((l) => (l.startsWith('export BRAINSTORM_OWNER_PUBKEY=') ? `export BRAINSTORM_OWNER_PUBKEY="${OWNER.toUpperCase()}"` : l));
  const r = runChild(upperOwner, { TA_PUBKEY: `  ${TA.toUpperCase()}\n` });
  assert(!r.error && Array.isArray(r.ownKeys), `the child ran; got ${show(r.error || r)}`);
  assert(show([...r.ownKeys].sort()) === show([OWNER, TA].sort()), `ownKeys are both keys, trimmed and in lowercase, as events carry them; got ${show(r.ownKeys)}`);
  assert(r.pov && r.pov.owner && r.pov.owner.value && r.pov.owner.value.observer === OWNER, `the owner's point of view has the lowercase owner as observer; got ${show(r.pov && r.pov.owner)}`);
  assert(r.pov.ownerPubkey && !r.pov.ownerPubkey.threw && r.pov.ownerPubkey.value.name === 'owner', `the owner's lowercase pubkey still reads as owner; got ${show(r.pov.ownerPubkey)}`);
  assert(r.nodes && r.nodes.bella && r.nodes.bella.own === true && r.nodes.spot && r.nodes.spot.own === true, `the assistant's and the owner's elements are still the instance's own; got ${show(r.nodes && { bella: r.nodes.bella, spot: r.nodes.spot })}`);
});

// ── C5 and C6: story graph-operations-first-slice #13, ADR graph-operations-first-slice/0013 Decision 1 ──
const REL_KEYS = ['direction', 'from', 'node', 'properties', 'to', 'type'];
const NODE_FACTS = ['address', 'author', 'name', 'own', 'tapestryKey'];

test('RC17: it exports RELATIONSHIP, relationshipColumns and relationshipOf', () => {
  const r = result();
  assert(r.exports.RELATIONSHIP === 'object', `it exports RELATIONSHIP, an object (ADR 0013, C5); got ${show(r.exports.RELATIONSHIP)}`);
  for (const name of ['relationshipColumns', 'relationshipOf']) assert(r.exports[name] === 'function', `it exports ${name}, a function (ADR 0013, C5); got ${show(r.exports[name])}`);
});

test('RC18: RELATIONSHIP is { type, direction, from, to, node, properties }, its node C3\'s NODE', () => {
  const r = result();
  const s = r.rel.schema;
  assert(s && s.type === 'object' && show([...(s.required || [])].sort()) === show(REL_KEYS), `RELATIONSHIP requires its six facts; got ${show(s && s.required)}`);
  assert(show(Object.keys(s.properties || {}).sort()) === show(REL_KEYS), `RELATIONSHIP has those six properties and no others; got ${show(Object.keys((s && s.properties) || {}))}`);
  for (const f of ['type', 'from', 'to']) assert(s.properties[f].type === 'string', `${f} is text; got ${show(s.properties[f])}`);
  assert(s.properties.direction.type === 'string' && show([...(s.properties.direction.enum || [])].sort()) === show(['in', 'out']), `direction is out or in; got ${show(s.properties.direction)}`);
  assert(show(s.properties.node) === show(r.schemas.node), `node is C3's NODE; got ${show(s.properties.node)}`);
  assert(s.properties.properties.type === 'object', `properties is an object; got ${show(s.properties.properties)}`);
});

const ran = (r, name, what) => {
  assert(r.exports[what] === 'function', `${what} does not exist yet (ADR graph-operations-first-slice/0013 Decision 1)`);
  assert(!r.rel.errors[name], `${what}'s check ran; it failed: ${show(r.rel.errors[name])}`);
};

test('RC19: relationshipColumns gives a relationship\'s type, its id as text, what it records as pairs, and the other node\'s facts', () => {
  const r = result();
  ran(r, 'columns', 'relationshipColumns');
  const rows = r.rel.columns;
  assert(Array.isArray(rows) && rows.length === 4, `alice's 4 relationships out (three TAGS and a FOLLOWS, all to bob); got ${show(rows)}`);
  for (const row of rows) {
    for (const f of ['type', 'rid', 'properties', 'tapestryKey', 'name', 'address', 'author']) assert(f in row, `a row has ${f}; got ${show(row)}`);
    assert(row.tapestryKey === r.rel.bob, `the other node's facts are bob's; got ${show(row.tapestryKey)}`);
    assert(typeof row.rid === 'string' && row.rid.length > 0, `rid is the relationship's id, as text; got ${show(row.rid)}`);
    assert(Array.isArray(row.properties) && row.properties.every((p) => Array.isArray(p) && p.length === 2 && typeof p[0] === 'string'), `properties come as [key, value] pairs; got ${show(row.properties)}`);
  }
  const tags = rows.filter((row) => row.type === 'TAGS');
  assert(tags.length === 3 && new Set(tags.map((t) => t.rid)).size === 3, `the three TAGS between the same two nodes have three ids; got ${show(tags.map((t) => t.rid))}`);
  for (const t of tags) {
    const created = t.properties.find((p) => p[0] === 'createdAt');
    assert(created && typeof created[1] === 'number', `an integer in the pairs comes as a number; got ${show(created)}`);
  }
  const follows = rows.find((row) => row.type === 'FOLLOWS');
  assert(follows && show(follows.properties) === show([['timestamp', 1700000000]]), `FOLLOWS records its timestamp; got ${show(follows && follows.properties)}`);
});

test('RC20: relationshipOf answers a relationship by its direction, with its node and its properties as a map, keys sorted', () => {
  const r = result();
  ran(r, 'of', 'relationshipOf');
  const { K1, K2, ofOut, ofIn, ofLoop, ofPeer } = r.rel;
  for (const [name, x] of Object.entries({ ofOut, ofIn, ofLoop, ofPeer })) {
    assert(x && show(Object.keys(x).sort()) === show(REL_KEYS), `${name}: exactly the six facts; got ${show(x)}`);
    assert(show(Object.keys(x.node).sort()) === show(NODE_FACTS), `${name}: its node has the five facts; got ${show(x.node)}`);
  }
  assert(ofOut.type === 'CITES' && ofOut.direction === 'out' && ofOut.from === K1 && ofOut.to === K2, `out: from the node the read is about, to the other; got ${show(ofOut)}`);
  assert(ofIn.direction === 'in' && ofIn.from === K2 && ofIn.to === K1, `in: from the other, to the node the read is about; got ${show(ofIn)}`);
  assert(ofLoop.from === K1 && ofLoop.to === K1 && ofLoop.node.tapestryKey === K1, `a relationship from the node to itself: from and to alike; got ${show(ofLoop)}`);
  assert(ofOut.node.tapestryKey === K2 && ofOut.node.name === 'other' && ofOut.node.author === TA && ofOut.node.own === true, `the node at the other end, answered as C3: the assistant's, so own; got ${show(ofOut.node)}`);
  assert(show(ofOut.properties) === show({ alpha: 'a', mid: [1, 2], zeta: 1 }) && show(Object.keys(ofOut.properties)) === show(['alpha', 'mid', 'zeta']), `properties: the pairs as a map, keys sorted; got ${show(ofOut.properties)}`);
  assert(ofPeer.node.own === false && show(ofPeer.properties) === show({}), `a peer's node isn't own, and no pairs make {}; got ${show(ofPeer)}`);
});

test('RC21: trust(v, keep) carries the variables it keeps and judges the node v; a name that isn\'t a variable throws', () => {
  const r = result();
  assert(!r.rel.errors.judged, `a statement that judges m and keeps r runs: trust carries the variables it keeps through its WITH (ADR 0013, C6); it failed: ${show(r.rel.errors.judged)}`);
  const got = Object.fromEntries((r.rel.judged || []).map(([type, name, counts]) => [`${type} ${name}`, counts]));
  const wantJudged = {
    'CITES citedTa': true, 'CITES citedOwner': true, 'CITES citedHi': true, 'CITES citedLo': false, 'CITES citedNoscore': false,
    'CITES citedNouser': false, 'CITES citedAnon': true, 'DEPENDS_ON dependency': true, 'MENTIONS hub': true,
  };
  assert(show(Object.keys(got).sort()) === show(Object.keys(wantJudged).sort()), `the kept relationship's type comes through trust's WITH for each of hub's 9; got ${show(r.rel.judged)}`);
  for (const [k, v] of Object.entries(wantJudged)) assert(got[k] === v, `${k}: counts is ${v}, judged by the node at the other end; got ${show(got[k])}`);
  assert(r.rel.badKeep && r.rel.badKeep.threw === true, `trust throws for a kept name that isn't a Cypher variable, as it does for v; got ${show(r.rel.badKeep)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
