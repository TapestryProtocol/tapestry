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
  done();
})().catch((e) => { out.error = String((e && e.stack) || e).split('\\n').slice(0, 6).join(' | '); done(); });
`;

function runChild(confLines = null) {
  const dir = tmp('reads-');
  const env = S.childEnv(dir);
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

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
