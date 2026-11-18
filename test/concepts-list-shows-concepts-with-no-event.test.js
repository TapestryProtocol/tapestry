'use strict';
/**
 * graph-operations-first-slice #44: the Concepts page and the Dashboard show a concept with no event.
 *   Story: engineering-team/stories/graph-operations-first-slice/44-concepts-list-shows-concepts-with-no-event.md
 *   Plan:  engineering-team/stories/graph-operations-first-slice/44-concepts-list-shows-concepts-with-no-event.test-plan.md
 *   ADR:   none (a bug with an obvious fix; the owner skipped Architecture, 2026-11-18)
 *
 * graph create-concept (story 16) makes a concept whose nodes have no event, so by D7 they have no NostrEvent label.
 * The page's header scan and the Dashboard's Concepts tile matched NostrEvent alone, so such a concept showed on
 * neither, and the guard's record excused both lines with "a header is always an event".
 *
 * The one interface this plan fixes: each row of the page's query says whether its header came from an event, as
 * `hasEvent` (true for a header labelled NostrEvent, false for one with no event).
 *
 *   U1..U3  the state filter (ui/src/utils/conceptStateFilter.js), loaded by dynamic import: a row with no event isn't
 *           undispositioned, it is not yet shared, and every other row is judged as before. Stack-free.
 *   S1..S6  the page, the tile and the guard's record, read from source: which headers each query's label expression
 *           admits, the row's event fact, Save & next, the Disposition cell, and the kept-list's reasons. Stack-free.
 *   L1..L4  the page's own query and the tile's own query, read from source and run on a scratch stack's Neo4j beside a
 *           concept graph create-concept made there. They run only against a scratch container
 *           (TAPESTRY_CONTAINER=tapestry-scratch…, test/helpers/scratchLoopback.js) and SKIP otherwise, so they never
 *           touch the owner's own stack.
 *
 * EXPECTED BEFORE THE FIX: U1 and S1–S6 FAIL; U2 and U3 PASS (sentinels: behavior that must not change). On a scratch
 * stack L1, L2 and L4 FAIL, and L3 PASSES (a sentinel against a fix that matches the shared label alone).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const S = require('./helpers/scratchLoopback');

const ROOT = path.resolve(__dirname, '..');
const FILTER_JS = path.join(ROOT, 'ui/src/utils/conceptStateFilter.js');
const CONCEPT_LIST = path.join(ROOT, 'ui/src/pages/concepts/ConceptList.jsx');
const DASHBOARD = path.join(ROOT, 'ui/src/pages/Dashboard.jsx');
const KEPT = path.join(ROOT, 'test/operations/lifecycle/nostr-event-lookups-kept.json');

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const show = (v) => JSON.stringify(v);
const short = (v, n = 300) => { const s = typeof v === 'string' ? v : show(v); return s && s.length > n ? `${s.slice(0, n)}…` : s; };
const read = (abs) => fs.readFileSync(abs, 'utf8');
const rel = (abs) => path.relative(ROOT, abs);
function skip(why) { return { skip: why }; }

// ── What a header carries ────────────────────────────────────────────────────────────────────────────────────────

/**
 * The labels each kind of header carries. The import gives a header NostrEvent and ListHeader, and the shared label
 * since ADR graph-operations-foundation/0003, so an instance that hasn't run tapestry-keys still has headers without
 * it. graph create-concept gives its header ListHeader, ConceptHeader and the shared label, and no NostrEvent (ADR
 * graph-operations-first-slice/0016, Decisions 1 and 3).
 */
const HEADERS = {
  'a list header from an event, on an instance that has not run tapestry-keys': ['NostrEvent', 'ListHeader'],
  'a concept header from an event, on an instance that has not run tapestry-keys': ['NostrEvent', 'ListHeader', 'ConceptHeader'],
  'a concept header from an event, on an instance that has run tapestry-keys': ['NostrEvent', 'ListHeader', 'ConceptHeader', 'TapestryNode'],
  'a concept header graph create-concept made, with no event': ['ListHeader', 'ConceptHeader', 'TapestryNode'],
};
const CONCEPT_HEADERS = Object.fromEntries(Object.entries(HEADERS).filter(([, labels]) => labels.includes('ConceptHeader')));

/**
 * Whether a node with `labels` matches a node pattern's label expression, as Cypher reads it: no expression matches
 * any node; `:A:B` and `:A&B` need every label; `:A|B` needs one of them. Other forms aren't read here.
 */
function admits(expr, labels) {
  const e = String(expr || '').replace(/^:/, '');
  if (!e) return true;
  if (/[!%()]/.test(e) || (e.includes('|') && /[:&]/.test(e))) {
    throw new Error(`this suite reads the label expressions :A, :A:B, :A&B and :A|B, not :${e}. Write the match in one of those forms, or teach admits() the new one.`);
  }
  if (e.includes('|')) return e.split('|').some((l) => labels.includes(l.trim()));
  return e.split(/[:&]/).every((l) => labels.includes(l.trim()));
}

/** The label expression on `v` in the first MATCH (not OPTIONAL MATCH) of `cypher` whose pattern starts at `(v`. */
function labelsOf(cypher, v) {
  const m = cypher.match(new RegExp(`(?<!OPTIONAL\\s+)\\bMATCH\\s*\\(${v}((?::[A-Za-z_|&:]+)?)\\s*(?:\\{[^}]*\\})?\\)`));
  return m ? m[1] : null;
}

/** The page's header scan, as the page runs it: ConceptList.jsx's `const QUERY = `…``. */
function pageQuery() {
  const m = read(CONCEPT_LIST).match(/const QUERY = `([\s\S]*?)`;/);
  assert(m, `${rel(CONCEPT_LIST)} no longer holds its header scan as const QUERY = \`…\`; point this suite at where it went.`);
  assert(!m[1].includes('${'), `the page's QUERY must stay a plain template: this suite runs it as written.`);
  return m[1];
}

/** The Concepts tile's count, as the Dashboard runs it: the query StatsRow() reads into conceptData. */
function tileQuery() {
  const src = read(DASHBOARD);
  const at = src.indexOf('function StatsRow()');
  assert(at >= 0, `${rel(DASHBOARD)} has no StatsRow(), where the Concepts tile's count was; point this suite at where it went.`);
  const body = src.slice(at);
  assert(/label:\s*'Concepts',\s*value:\s*conceptData/.test(body), `StatsRow()'s Concepts tile no longer reads conceptData; point this suite at its query.`);
  const m = body.match(/data:\s*conceptData\s*\}\s*=\s*useCypher\(`([\s\S]*?)`/);
  assert(m, `StatsRow() no longer reads conceptData from a useCypher template; point this suite at the tile's query.`);
  assert(!m[1].includes('${'), `the tile's query must stay a plain template: this suite runs it as written.`);
  return m[1];
}

/** The text of the block that starts at `start` and ends before `end`, in `src`. */
function block(src, start, end, where) {
  const a = src.indexOf(start);
  assert(a >= 0, `${where} no longer has ${start}; point this suite at where it went.`);
  const b = src.indexOf(end, a + start.length);
  assert(b > a, `${where}: nothing ends ${start}'s block at ${end}.`);
  return src.slice(a, b);
}

// ── U: the state filter ──────────────────────────────────────────────────────────────────────────────────────────

let _filter;
async function filter() {
  if (_filter === undefined) {
    try { _filter = await import(pathToFileURL(FILTER_JS).href); } catch (err) { _filter = { __error: err }; }
  }
  assert(!_filter.__error, `${rel(FILTER_JS)} must load under plain node: ${_filter.__error && String(_filter.__error.message).split('\n')[0]}`);
  assert(typeof _filter.matchesState === 'function', `${rel(FILTER_JS)} exports matchesState(row, state, ctx).`);
  return _filter;
}
const TA = 'a7'.repeat(32);
const OTHER = 'b8'.repeat(32);
/** Publication as /api/shared-by-me reports it: an empty map, so no concept here was ever declared. */
const ctx = () => ({ taPubkey: TA, publishedByCoord: new Map(), relayOk: true });
const row = (over = {}) => ({ uuid: `39998:${TA}:lantern`, name: 'lantern', author: TA, _disp: {}, ...over });

test('U1 (AC3): a row of this instance\'s own concept with no event is not under Undispositioned (mine); the same row from an event is', async () => {
  const { matchesState } = await filter();
  assert(matchesState(row({ hasEvent: true }), 'undispositioned', ctx()) === true,
    'control: a row of this instance\'s own concept, from an event, with no b tag, is under Undispositioned (mine); unless it is, this test proves nothing.');
  assert(matchesState(row({ hasEvent: false }), 'undispositioned', ctx()) === false,
    'a concept with no event can\'t be dispositioned until it has one: each Disposition… action re-signs the header\'s latest event, and for a header with no event answers "No local header event found" (story 44, AC3). So a row with hasEvent: false must not be under Undispositioned (mine).');
});

test('U2 (AC3): a row with no event is under Not yet shared (mine) and All states', async () => {
  const { matchesState } = await filter();
  const r = row({ hasEvent: false });
  assert(matchesState(r, 'not-yet-shared', ctx()) === true, 'a concept with no event has never been declared, so it is knowably not yet shared (AC3).');
  for (const all of ['all', '']) assert(matchesState(r, all, ctx()) === true, `All states lists every row, a row with no event among them (state ${show(all)}).`);
});

test('U3 (AC4): every other row is judged as before: from an event, or not saying, or another author\'s, or already dispositioned', async () => {
  const { matchesState } = await filter();
  const und = (r) => matchesState(r, 'undispositioned', ctx());
  assert(und(row({ hasEvent: true })) === true, 'mine, from an event, no b tag: undispositioned, as before.');
  assert(und(row()) === true, 'a row that doesn\'t say whether it has an event is judged as before this story: mine with no b tag is undispositioned.');
  assert(und(row({ author: OTHER, hasEvent: true })) === false, 'another author\'s concept is never under Undispositioned (mine).');
  for (const flag of ['wired', 'selfDeclared', 'deferred']) {
    assert(und(row({ hasEvent: true, _disp: { [flag]: true } })) === false, `a row already dispositioned (${flag}) is not undispositioned, as before.`);
  }
  assert(matchesState(row({ hasEvent: true }), 'not-yet-shared', ctx()) === true, 'mine, from an event, never declared: not yet shared, as before.');
});

// ── S: the page, the tile and the record, from source ────────────────────────────────────────────────────────────

test('S1 (AC1, AC4): the Concepts page\'s header scan admits a header with no event, and every header it admitted before', () => {
  const q = pageQuery();
  const expr = labelsOf(q, 'h');
  assert(expr !== null, `the page's QUERY has no top-level MATCH (h…): ${short(q.trim(), 200)}`);
  const skipped = Object.entries(HEADERS).filter(([, labels]) => !admits(expr, labels));
  assert(skipped.length === 0,
    `the page's header scan, MATCH (h${expr}), skips ${skipped.map(([what, labels]) => `${what} (${labels.join(', ')})`).join('; ')}. ` +
    'A concept made with graph create-concept has no event, and so no NostrEvent label (D7), and it must have a row (AC1). ' +
    'A header from an event may lack the shared label where tapestry-keys hasn\'t run, and it must keep its row (AC4).');
});

test('S2 (AC3): each row of the page\'s query says whether its header came from an event, as hasEvent', () => {
  const q = pageQuery();
  assert(/\bAS\s+hasEvent\b/.test(q),
    'the page\'s QUERY must return hasEvent for each header, true when it came from an event (it is labelled NostrEvent): the row\'s Disposition cell, Save & next and the state filter all turn on it (AC3).');
});

test('S3 (AC2, AC4): the Dashboard\'s Concepts tile counts a concept with no event, and every concept it counted before', () => {
  const q = tileQuery();
  assert(/IS_THE_CONCEPT_FOR/.test(q), `the tile's query should count headers by their superset: ${short(q.trim(), 200)}`);
  const expr = labelsOf(q, 'n');
  assert(expr !== null, `the tile's query has no top-level MATCH (n…): ${short(q.trim(), 200)}`);
  const skipped = Object.entries(CONCEPT_HEADERS).filter(([, labels]) => !admits(expr, labels));
  assert(skipped.length === 0,
    `the Concepts tile's count, MATCH (n${expr})-[:IS_THE_CONCEPT_FOR]->(), skips ${skipped.map(([what]) => what).join('; ')}. ` +
    'It must count a concept graph create-concept made (AC2), and every concept from an event, whether or not tapestry-keys has run (AC4).');
});

test('S4 (AC3): Save & next passes over a row with no event: the page\'s undispositioned set reads the row\'s event fact', () => {
  const src = read(CONCEPT_LIST);
  const b = block(src, 'const enrichedData = useMemo(', '}, [', rel(CONCEPT_LIST));
  assert(/_undispositionedMine/.test(b), `the enrichedData block must still set _undispositionedMine, the set Save & next walks.`);
  const readsEvent = /\bhasEvent\b/.test(b) || (/\bmatchesState\(/.test(b) && /'undispositioned'/.test(b));
  assert(readsEvent,
    '_undispositionedMine is the set Save & next walks (nextUndispositioned), and it must leave out a row with no event (AC3). ' +
    'So the block that sets it must read the row\'s hasEvent, itself or through matchesState(row, \'undispositioned\', …), which U1 holds to it. ' +
    `It reads neither: ${short(b.replace(/\s+/g, ' '), 400)}`);
});

test('S5 (AC3): the Disposition cell of a row with no event says the concept has no event yet, in place of Disposition…', () => {
  const src = read(CONCEPT_LIST);
  const b = block(src, 'const dispositionCell =', 'const columns =', rel(CONCEPT_LIST));
  assert(/Disposition…/.test(b), 'control: the cell still offers Disposition… to this instance\'s other undispositioned concepts (AC4).');
  assert(/\bhasEvent\b/.test(b) && /no event yet/i.test(b),
    'the Disposition cell must tell a row with no event apart, by its hasEvent, and say the concept has no event yet ' +
    '(the words "no event yet") instead of offering Disposition…, whose three actions need the header\'s event (AC3).');
});

test('S6 (records): the guard no longer keeps the Concepts page\'s scan or the Dashboard\'s concept count on "a header is always an event"', () => {
  const doc = JSON.parse(read(KEPT));
  const kept = Array.isArray(doc.kept) ? doc.kept : [];
  assert(kept.length > 0, `control: ${rel(KEPT)} lists the lines kept on NostrEvent alone.`);
  // Only this story's two pages. Nine more kept lines rest on the same reason (the plan's "Left for a ledger row").
  const ours = new Set(['ui/src/pages/concepts/ConceptList.jsx', 'ui/src/pages/Dashboard.jsx']);
  const wrong = kept.filter((k) => ours.has(k.file) && /a header is always an event/i.test(String(k.reason || '')));
  assert(wrong.length === 0,
    `${wrong.length} kept line(s) on this story's pages rest on "a header is always an event", which graph create-concept (story 16) made false: ` +
    `${wrong.map((k) => `${k.file}: ${k.text}`).join(' | ')}. A line that changes leaves the list (G11 holds the list to the code); ` +
    'a line that stays, such as the Dashboard\'s onboarding check, needs a reason that is still true.');
});

// ── L: the two queries on a real graph (a scratch stack only) ────────────────────────────────────────────────────

let _refusal;
function scratchRefusal() {
  if (_refusal === undefined) _refusal = S.scratchRefusal();
  return _refusal;
}
let _ta;
const ta = () => (_ta || (_ta = S.taPubkey()));
const conceptHeaderUuid = () => `39998:${ta()}:concept-header`;
const count = (rows) => Number(rows && rows[0] && rows[0].cnt);

const LANTERN = 'eventless lantern';
let _lantern;
/** A concept graph create-concept made on the scratch stack, with no event: { uuid, key }. Made once per run. */
function lantern() {
  if (_lantern) return _lantern;
  const r = S.http('POST', '/api/tapestry/graph/create-concept', { name: LANTERN, description: 'A concept made on a scratch stack, with no event (story 44).' });
  assert(r.status === 200 && r.json && r.json.success === true,
    `graph create-concept on the scratch stack answered HTTP ${r.status}: ${short(r.json || r.text)}`);
  const rows = S.cypher('MATCH (h:ConceptHeader {name: $name}) RETURN h.uuid AS uuid, h.tapestryKey AS key, h:NostrEvent AS withEvent', { name: LANTERN });
  assert(rows.length === 1 && rows[0].withEvent === false, `the scratch graph should hold one header named ${LANTERN}, with no event: ${short(rows)}`);
  _lantern = rows[0];
  return _lantern;
}

test('L1 (AC1): on a scratch stack, the page\'s own query lists a concept graph create-concept made, with hasEvent false, beside the firmware\'s concepts', () => {
  const why = scratchRefusal(); if (why) return skip(why);
  const made = lantern();
  const rows = S.cypher(pageQuery());
  const mine = rows.find((r) => r.uuid === made.uuid);
  assert(mine, `the page's query, run on the scratch graph, lists ${rows.length} headers, and not ${made.uuid}, the concept graph create-concept made there (AC1).`);
  assert(mine.hasEvent === false, `its row should say it has no event (hasEvent false): ${short(mine)}`);
  assert(mine.name === LANTERN && mine.author === ta(), `its row should carry its name and the assistant as author: ${short(mine)}`);
  for (const k of ['hasConceptHeader', 'supersetCount', 'schemaCount', 'ppCount', 'propsSetCount', 'coreGraphCount', 'conceptGraphCount', 'propTreeGraphCount']) {
    assert(Number(mine[k]) === 1, `its row's ${k} should be 1, as for any concept with its eight core nodes: ${short(mine)}`);
  }
  const header = rows.find((r) => r.uuid === conceptHeaderUuid());
  assert(header && header.hasEvent === true, `the firmware's concept-header concept, from an event, should be listed with hasEvent true: ${short(header)}`);
});

test('L2 (AC2): on a scratch stack, the Concepts tile\'s own query counts the concept with no event', () => {
  const why = scratchRefusal(); if (why) return skip(why);
  lantern();
  const tile = count(S.cypher(tileQuery()));
  const every = count(S.cypher('MATCH (n:ListHeader)-[:IS_THE_CONCEPT_FOR]->() RETURN count(DISTINCT n) AS cnt'));
  const withEvent = count(S.cypher('MATCH (n:NostrEvent:ListHeader)-[:IS_THE_CONCEPT_FOR]->() RETURN count(DISTINCT n) AS cnt'));
  assert(every > withEvent, `control: the scratch graph should hold a concept with no event, so this test can tell the counts apart (every ${every}, from an event ${withEvent}).`);
  assert(tile === every, `the Concepts tile counts ${tile}; the graph holds ${every} concepts, ${every - withEvent} of them with no event (AC2).`);
});

test('L3 (AC4): on a scratch stack, a header from an event without the shared label, as where tapestry-keys hasn\'t run, keeps its row and its count', () => {
  const why = scratchRefusal(); if (why) return skip(why);
  const uuid = conceptHeaderUuid();
  const before = { rows: S.cypher(pageQuery()).length, tile: count(S.cypher(tileQuery())) };
  const took = S.cypher('MATCH (h:NostrEvent:ConceptHeader {uuid: $uuid}) WHERE h:TapestryNode REMOVE h:TapestryNode RETURN count(h) AS cnt', { uuid });
  assert(count(took) === 1, `control: the concept-header header should have carried the shared label, to take off for this test: ${short(took)}`);
  try {
    const rows = S.cypher(pageQuery());
    assert(rows.some((r) => r.uuid === uuid),
      'without the shared label, the concept-header header has no row: a scan by the shared label alone misses every header from an event on an instance that hasn\'t run tapestry-keys (AC4).');
    assert(rows.length === before.rows, `the page listed ${before.rows} headers, and ${rows.length} without the label on one (AC4).`);
    const tile = count(S.cypher(tileQuery()));
    assert(tile === before.tile, `the tile counted ${before.tile}, and ${tile} without the label on one (AC4).`);
  } finally {
    S.cypher('MATCH (h:NostrEvent:ConceptHeader {uuid: $uuid}) SET h:TapestryNode RETURN count(h) AS cnt', { uuid });
  }
});

test('L4 (AC1, AC4): on a scratch stack, the page lists exactly every header it listed before plus every header with no event, and hasEvent says which', () => {
  const why = scratchRefusal(); if (why) return skip(why);
  lantern();
  const WHERE = '(h:ListHeader OR h:ConceptHeader) AND h.kind IN [9998, 39998]';
  const withEvent = new Set(S.cypher(`MATCH (h:NostrEvent) WHERE ${WHERE} RETURN h.uuid AS uuid`).map((r) => r.uuid));
  const without = new Set(S.cypher(`MATCH (h) WHERE ${WHERE} AND NOT h:NostrEvent RETURN h.uuid AS uuid`).map((r) => r.uuid));
  assert(without.size > 0, 'control: the scratch graph should hold a header with no event.');
  const rows = S.cypher(pageQuery());
  const listed = new Set(rows.map((r) => r.uuid));
  assert(rows.length === listed.size, `one row per header: ${rows.length} rows, ${listed.size} headers.`);
  const missing = [...withEvent, ...without].filter((u) => !listed.has(u));
  const extra = [...listed].filter((u) => !withEvent.has(u) && !without.has(u));
  assert(missing.length === 0 && extra.length === 0,
    `the page should list the ${withEvent.size} headers from an event and the ${without.size} with none. Missing ${missing.length}: ${short(missing)}; not headers ${extra.length}: ${short(extra)}.`);
  const wrong = rows.filter((r) => r.hasEvent !== withEvent.has(r.uuid));
  assert(wrong.length === 0, `hasEvent should be true exactly for the headers from an event; it is wrong on ${wrong.length}: ${short(wrong.map((r) => [r.uuid, r.hasEvent]))}`);
});

// ── Run ──────────────────────────────────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n--- concepts list shows concepts with no event (graph-operations-first-slice #44) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r && r.skip) { console.log(`  SKIP  ${name}\n        (${r.skip})`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\nconcepts-list-shows-concepts-with-no-event: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
