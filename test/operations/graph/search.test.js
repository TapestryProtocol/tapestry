'use strict';
/**
 * graph search — its own suite (ADR graph-operations-foundation/0001 Decision 12), run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/8-search.md (AC1–AC7)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0008-search.md (Decisions 1–9)
 *
 * Stack-free: every request goes through test/helpers/operationsHarness.js, over a graph test/helpers/searchGraph.js
 * seeds for test/helpers/graphFake.js. The graph's full-text index is test/helpers/fulltextFake.js's: Unicode's words, as
 * the standard analyzer splits them, and a score that is the same each time for the same graph. Where a test says a
 * match scores higher, it is that fake's score; on a live stack it is Lucene's. A page's cursor is read from one harness
 * run and sent in the next, over the same graph, and the graph is changed between runs where a test says so.
 *
 * Only what the story and the ADR pin is checked: which nodes come back, with which facts, field, passage and words, in
 * what order, what is counted, and what is refused. How search reads the index, checks a match and cuts a passage is
 * the Implementer's.
 *
 *   SR1  a word in an element's field finds it, with that field; a word in a concept's description finds the concept
 *   SR2  whole words only, ignoring case: og finds nothing though "dog" is in a statement; DOG finds it; hardcod nothing
 *   SR3  a field's name is no text: statement finds only the rule whose statement holds the word; strength and
 *        wordTypes find nothing, though every rule's JSON names them
 *   SR4  tag nodes and change entries are never answered, and a word only in a tag search doesn't read finds nothing
 *   SR5  a search that matches nothing answers an empty list
 *   SR6  the words: stop words left out unless q has only them, lowercased, each once; q comes back trimmed; Lucene's
 *        syntax in q is never syntax
 *   SR7  a plain plural or singular matches: relays and relay each find both; decide doesn't find decided
 *   SR8  the word section's slug, name, title and wordTypes are no text: header and concept find nothing
 *   SR9  each match is its five facts, kind, concepts, field, passage and words, and nothing more; the kinds; a match's
 *        concepts by name then tapestryKey, through its sets
 *   SR10 the field it matched in: name, description, rule.statement, document.description, document.headings,
 *        conceptHeader.description; of texts holding as many words, the first in the order of Decision 3
 *   SR11 the passage: at most 200 characters, holding a word searched for, from before the first one; a cut end is
 *        marked …; a long field is never answered whole, a short one is
 *   SR12 no match comes with a path: search packages no walk yet (Decision 8)
 *   SR13 best first: a match with every word before one with some, even at a lower score; then the higher score; then
 *        the lower tapestryKey
 *   SR14 the cursors page through every match once, in order; every page counts the whole list
 *   SR15 a limit of 0 or 201 is refused naming limit
 *   SR16 a cursor for other words, another kind, concept or point of view, or another read, is refused invalid-cursor;
 *        one for the same words, written otherwise, is not
 *   SR17 a match added between two pages, ranked after the last one read, leaves every other answered once
 *   SR18 kind=concept answers only concept headers, kind=set only supersets and sets with an address; any other kind is
 *        refused naming kind
 *   SR19 concept narrows a search to its elements, through its sets; a node in two concepts is under each
 *   SR20 concept refusals: not a key; no node or a change entry, unknown-node; a superset or an element, not-a-concept
 *   SR21 the owner's point of view by default: kept and leftOut across the whole list, on a page of one
 *   SR22 everyone answers every author's; the owner's pubkey is the owner; another pubkey unknown-pov; a malformed one
 *        invalid-input
 *   SR23 nothing about a point of view is stored: a new score answers differently, with no write between
 *   SR24 before the owner's scores exist, only the instance's own count, and the answer says so
 *   SR25 q refusals: none, missing-input; spaces, punctuation only, a control character, a text-direction control or an
 *        invisible character, bad-query; 301 characters, invalid-input; 300 characters answer
 *   SR26 an input search doesn't take is refused unknown-input
 *   SR27 the index not ready: populating or missing answers 503 search-not-ready, saying which and how far it has filled
 *   SR28 a node whose JSON is offloaded is found by its name, and the answer counts such nodes
 *   SR29 the bound: 5,001 matches answer complete false, the 5,000 best counted, pages of 50 by default and of 200 at
 *        most; 5,000 matches answer complete true
 *   SR30 a visitor gets 401 and a stranger 403; an admin gets what the owner gets
 *   SR31 it writes nothing: it only reads, the graph is as it was, and no change entry is recorded
 *   SR32 the command answers what the route answers, refusals included
 *   SR33 it is listed for an admin with its inputs and refusals, and has its /docs entry
 *   SR34 the catalog and reads.js say how search answers and pages (Decision 9)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const { writeState } = require('../../helpers/graphFake');
const { seedSearch, seedSearchBound, PEERS, FIXED_KEYS } = require('../../helpers/searchGraph');

const { ROOT, OWNER, ADMIN, TA, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph search');

const ROUTE = '/api/tapestry/graph/search';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/search.js');
const READS = path.join(ROOT, 'src/operations/reads.js');
const CATALOG = path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md');
const NODE_KEYS = ['address', 'author', 'name', 'own', 'tapestryKey'];
const MATCH_KEYS = ['address', 'author', 'concepts', 'field', 'kind', 'name', 'own', 'passage', 'tapestryKey', 'words'];
const ANSWER_KEYS = ['complete', 'concept', 'cursor', 'kept', 'kind', 'leftOut', 'matches', 'offloaded', 'pov', 'q', 'words'];
const INPUTS = ['concept', 'cursor', 'kind', 'limit', 'pov', 'q'];
const BOUND = 5000;
const PASSAGE = 200;
/** A tapestryKey no node of the seeds has. */
const UNKNOWN = '0c0c0c0c-0000-4000-8000-00000000cccc';
/** Characters search refuses in q, made from their code points so this file holds none of them. */
const BELL = String.fromCharCode(7);
const RTL_OVERRIDE = String.fromCharCode(0x202e);
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/search.js does not exist yet (ADR graph-operations-first-slice/0008, Implementation notes)');
}

/** A query string; a list becomes one value for each item. */
const q = (route, params) => {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    for (const x of [].concat(v)) u.append(k, String(x));
  }
  const text = u.toString();
  return text ? `${route}?${text}` : route;
};
const get = (id, caller, params = {}) => ({ id, method: 'GET', url: q(ROUTE, params), caller });
/** One harness run of `requests` (and `cli`) over the graph in `file`. */
const runOver = (file, requests, cli = [], opts = {}) => S.answered(S.runHarness({ scenarios: [{ graphFake: { stateFile: file }, requests, cli }] }, { dir: tmp('search-run-'), ...opts }));
const fileOf = (seed) => seed.file(tmp('search-graph-'));

function ok(a, id) {
  needDecl();
  const x = a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body)}`);
  assert(x.body && x.body.data && Array.isArray(x.body.data.matches), `${id} answers { matches, … }; got ${show(x.body && x.body.data)}`);
  return x.body.data;
}
function refused(a, id, status, code, input) {
  needDecl();
  const x = a.req(id);
  assert(x.status === status && x.body && x.body.code === code, `${id}: ${status} ${code}; got ${x.status} ${show(x.body)}`);
  if (input !== undefined) assert(x.body.input === input, `${id}: the refusal names the input ${input}; got ${show(x.body.input)}`);
  assert(typeof x.body.error === 'string' && x.body.error.length > 0, `${id}: the refusal says in words what was wrong; got ${show(x.body)}`);
  return x.body;
}

const named = (k) => (key) => Object.keys(k).find((n) => k[n] === key) || key;
const namesOf = (k, d) => d.matches.map((m) => named(k)(m.tapestryKey));
const sorted = (xs) => [...xs].sort();
const byName = (k, d, name) => d.matches.find((m) => m.tapestryKey === k[name]);
/** The same set of names, in any order. */
function sameSet(k, d, want, label) {
  const got = sorted(namesOf(k, d));
  assert(show(got) === show(sorted(want)), `${label}: matches ${show(sorted(want))}; got ${show(got)}`);
}

/** A cursor's JSON, [read, scope, position], and a cursor made from one. */
const opened = (cursor) => JSON.parse(Buffer.from(String(cursor), 'base64url').toString('utf8'));
const sealed = (x) => Buffer.from(JSON.stringify(x)).toString('base64url');

// ── the main run: one seeded graph, most of the requests ──
let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  const seed = seedSearch();
  const file = fileOf(seed);
  const k = seed.keys;
  const before = S.readState(file);
  const all = { pov: 'everyone', limit: 200 };
  const a = runOver(file, [
    // what a word finds
    get('hardcode', 'owner', { q: 'hardcode' }),
    get('repository', 'owner', { q: 'repository' }),
    get('specification', 'owner', { q: 'specification' }),
    get('runtime', 'owner', { q: 'runtime' }),
    get('og', 'owner', { q: 'og', ...all }),
    get('DOG', 'owner', { q: 'DOG', ...all }),
    get('hardcod', 'owner', { q: 'hardcod', ...all }),
    get('statement', 'owner', { q: 'statement', ...all }),
    get('strength', 'owner', { q: 'strength', ...all }),
    get('wordTypes', 'owner', { q: 'wordTypes', ...all }),
    get('epsilon', 'owner', { q: 'epsilonword', ...all }),
    get('zeta', 'owner', { q: 'zetaword', ...all }),
    get('nothing', 'owner', { q: 'nosuchwordanywhere' }),
    get('header', 'owner', { q: 'header', ...all }),
    get('concept-word', 'owner', { q: 'concept', ...all }),
    // the words
    get('stop', 'owner', { q: '  is it decided and still in force  ', ...all }),
    get('only-stop', 'owner', { q: 'the', ...all }),
    get('repeats', 'owner', { q: 'Relay RELAY relay', ...all }),
    get('syntax', 'owner', { q: '+mustword -neverword (x) [0 TO 9] a*b foo~2 "quoted" back\\slash: kind:39999', ...all }),
    get('relays', 'owner', { q: 'relays', ...all }),
    get('relay', 'owner', { q: 'relay', ...all }),
    get('decide', 'owner', { q: 'decide', ...all }),
    // a match, its field and passage
    get('iota', 'owner', { q: 'iotaword', ...all }),
    get('every', 'owner', { q: 'every', ...all }),
    get('bind', 'owner', { q: 'bind', ...all }),
    get('kappa', 'owner', { q: 'kappaword', ...all }),
    get('hints', 'owner', { q: 'location hints', ...all }),
    get('pov-all', 'owner', { q: 'epsilonword', ...all }),
    // the order
    get('tiers', 'owner', { q: 'alphaword betaword', ...all }),
    get('ties', 'owner', { q: 'gammaword deltaword', ...all }),
    get('limit-0', 'owner', { q: 'epsilonword', limit: 0 }),
    get('limit-201', 'owner', { q: 'epsilonword', limit: 201 }),
    get('page-1', 'owner', { q: 'epsilonword', pov: 'everyone', limit: 3 }),
    // kind and concept
    get('every-concept', 'owner', { q: 'every', kind: 'concept', ...all }),
    get('repository-concept', 'owner', { q: 'repository', kind: 'concept', ...all }),
    get('every-set', 'owner', { q: 'every', kind: 'set', ...all }),
    get('bind-set', 'owner', { q: 'bind', kind: 'set', ...all }),
    get('kind-node', 'owner', { q: 'every', kind: 'node' }),
    get('iota-rule', 'owner', { q: 'iotaword', concept: k.ruleHeader, ...all }),
    get('iota-document', 'owner', { q: 'iotaword', concept: k.docHeader, ...all }),
    get('iota-rule-set', 'owner', { q: 'iotaword', concept: k.ruleHeader, kind: 'set', ...all }),
    get('hardcode-document', 'owner', { q: 'hardcode', concept: k.docHeader, ...all }),
    get('concept-bad', 'owner', { q: 'iotaword', concept: 'not-a-key' }),
    get('concept-unknown', 'owner', { q: 'iotaword', concept: UNKNOWN }),
    get('concept-entry', 'owner', { q: 'iotaword', concept: k.change }),
    get('concept-superset', 'owner', { q: 'iotaword', concept: k.ruleSuperset }),
    get('concept-element', 'owner', { q: 'iotaword', concept: k.ruleTa }),
    // the point of view
    get('pov-owner', 'owner', { q: 'epsilonword', limit: 200 }),
    get('pov-owner-1', 'owner', { q: 'epsilonword', limit: 1 }),
    get('pov-owner-named', 'owner', { q: 'epsilonword', pov: 'owner', limit: 200 }),
    get('pov-owner-pubkey', 'owner', { q: 'epsilonword', pov: OWNER, limit: 200 }),
    get('pov-stranger', 'owner', { q: 'epsilonword', pov: PEERS.stranger }),
    get('pov-house', 'owner', { q: 'epsilonword', pov: 'house' }),
    // refusals
    get('no-q', 'owner', { pov: 'everyone' }),
    get('q-spaces', 'owner', { q: '   ' }),
    get('q-punctuation', 'owner', { q: '-- !! ??' }),
    get('q-control', 'owner', { q: `alpha${BELL}word` }),
    get('q-direction', 'owner', { q: `alpha${RTL_OVERRIDE}word` }),
    get('q-invisible', 'owner', { q: `alpha${ZERO_WIDTH_SPACE}word` }),
    get('q-301', 'owner', { q: 'x'.repeat(301) }),
    get('q-300', 'owner', { q: 'x '.repeat(150) }),
    get('unknown-input', 'owner', { q: 'hardcode', foo: '1' }),
    get('offloaded', 'owner', { q: 'thetaword', ...all }),
    // who may call
    get('visitor', 'visitor', { q: 'epsilonword' }),
    get('stranger', 'stranger', { q: 'epsilonword' }),
    get('owner-same', 'owner', { q: 'epsilonword', limit: 200 }),
    get('admin-same', 'admin', { q: 'epsilonword', limit: 200 }),
    // the route and the command
    get('route-hardcode', 'owner', { q: 'hardcode', limit: 5 }),
    get('route-iota', 'owner', { q: 'iotaword', concept: k.ruleHeader, pov: 'everyone' }),
    get('route-refusal', 'owner', { q: 'iotaword', concept: k.change }),
    { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
  ], [
    { id: 'cli-hardcode', argv: ['graph', 'search', '--q', 'hardcode', '--limit', '5'] },
    { id: 'cli-iota', argv: ['graph', 'search', '--q', 'iotaword', '--concept', k.ruleHeader, '--pov', 'everyone'] },
    { id: 'cli-refusal', argv: ['graph', 'search', '--q', 'iotaword', '--concept', k.change] },
  ]);
  MAIN = { a, seed, k, file, before };
  return MAIN;
}

/** Page through `params` from its first page, one harness run a page, over `file`; [pages]. */
function pagesOf(file, params, { most = 20 } = {}) {
  const pages = [];
  let cursor;
  for (let i = 0; i < most; i++) {
    const a = runOver(file, [get('page', 'owner', { ...params, cursor })]);
    const d = ok(a, 'page');
    pages.push(d);
    if (d.cursor === null) return pages;
    assert(typeof d.cursor === 'string' && d.cursor.length > 0, `a page's cursor is text, or null on the last; got ${show(d.cursor)}`);
    cursor = d.cursor;
  }
  throw new Error(`the pages did not end within ${most} pages`);
}

// ── AC1: what a word finds ──

test('SR1: a word in an element\'s field finds it, with that field; a word in a concept\'s description finds the concept', () => {
  const { a, k } = main();
  const hard = ok(a, 'hardcode');
  assert(show(namesOf(k, hard)) === show(['ruleTa']), `hardcode finds the rule whose statement holds it, and nothing else; got ${show(namesOf(k, hard))}`);
  const m = hard.matches[0];
  assert(m.field === 'rule.statement' && /hardcode/i.test(m.passage) && show(m.words) === show(['hardcode']), `it matched in rule.statement, with a passage holding the word; got ${show({ field: m.field, passage: m.passage, words: m.words })}`);
  const repo = ok(a, 'repository');
  assert(show(namesOf(k, repo)) === show(['docHeader']) && repo.matches[0].kind === 'concept', `repository finds the document concept by its description; got ${show(repo.matches)}`);
  const spec = ok(a, 'specification');
  assert(show(namesOf(k, spec)) === show(['ruleHeader']) && spec.matches[0].kind === 'concept', `specification finds the rule concept by its description; got ${show(spec.matches)}`);
});

test('SR2: whole words only, ignoring case: og finds nothing though "dog" is in a statement; DOG finds it; hardcod finds nothing', () => {
  const { a, k } = main();
  assert(ok(a, 'og').matches.length === 0, `og is a part of "dog", not a word of any text; got ${show(namesOf(k, ok(a, 'og')))}`);
  assert(show(namesOf(k, ok(a, 'DOG'))) === show(['ruleDog']), `DOG finds the rule whose statement says "dog", whatever the case; got ${show(namesOf(k, ok(a, 'DOG')))}`);
  assert(ok(a, 'hardcod').matches.length === 0, `hardcod is a part of "hardcode"; got ${show(namesOf(k, ok(a, 'hardcod')))}`);
});

test('SR3: a field\'s name is no text: statement finds only the rule whose statement holds it; strength and wordTypes find nothing', () => {
  const { a, k } = main();
  const st = ok(a, 'statement');
  assert(show(namesOf(k, st)) === show(['ruleKey']), `every rule's JSON has a field named statement, but only ruleKey's statement says the word; got ${show(namesOf(k, st))}`);
  assert(st.kept === 1 && st.leftOut === 0, `the counts count matches, not the nodes the index found by a key; got kept ${st.kept}, leftOut ${st.leftOut}`);
  assert(ok(a, 'strength').matches.length === 0, `strength names a field of every rule, and is in no value; got ${show(namesOf(k, ok(a, 'strength')))}`);
  assert(ok(a, 'wordTypes').matches.length === 0, `wordTypes names a field of every word section; got ${show(namesOf(k, ok(a, 'wordTypes')))}`);
});

test('SR4: tag nodes and change entries are never answered, and a word only in a tag search doesn\'t read finds nothing', () => {
  const { a, k, seed } = main();
  const e = ok(a, 'epsilon');
  sameSet(k, e, ['povTa', 'povOwner', 'povAnon', 'povHi', 'povLo', 'povNoScore', 'povNoUser'], 'epsilonword, from everyone\'s point of view');
  const tagKeys = new Set(seed.state.nodes.filter((n) => n.labels.includes('NostrEventTag')).map((n) => n.props.tapestryKey));
  for (const m of e.matches) assert(!tagKeys.has(m.tapestryKey), `a tag node is never a match; got ${m.tapestryKey}`);
  assert(!e.matches.some((m) => m.tapestryKey === k.change), 'the change entry named "epsilonword change" is never a match');
  assert(ok(a, 'zeta').matches.length === 0, `zetaword is only in a d tag, which isn't one of a node's texts; got ${show(namesOf(k, ok(a, 'zeta')))}`);
});

test('SR5: a search that matches nothing answers an empty list', () => {
  const { a } = main();
  const d = ok(a, 'nothing');
  assert(d.matches.length === 0 && d.kept === 0 && d.leftOut === 0 && d.complete === true && d.cursor === null, `no match: an empty list, nothing counted, complete, no cursor; got ${show(d)}`);
});

test('SR6: the words: stop words left out unless q has only them, lowercased, each once; q comes back trimmed; Lucene\'s syntax in q is never syntax', () => {
  const { a } = main();
  const stop = ok(a, 'stop');
  assert(stop.q === 'is it decided and still in force', `q comes back as given, trimmed; got ${show(stop.q)}`);
  assert(show(stop.words) === show(['decided', 'still', 'force']), `is, it, and and in are stop words, left out when q has others; got ${show(stop.words)}`);
  assert(show(ok(a, 'only-stop').words) === show(['the']), `a q of only stop words searches them; got ${show(ok(a, 'only-stop').words)}`);
  assert(show(ok(a, 'repeats').words) === show(['relay']), `the words are lowercased, each once; got ${show(ok(a, 'repeats').words)}`);
  const syn = ok(a, 'syntax');
  assert(syn.words.every((w) => /^[\p{L}\p{N}._':]+$/u.test(w) && !/[+\-()[\]*~"\\]/.test(w)), `Lucene's syntax in q is never a word: no +, -, ( ), [ ], *, ~, " or \\; got ${show(syn.words)}`);
  assert(syn.words.includes('mustword') && syn.words.includes('neverword') && syn.words.includes('39999'), `the words around the syntax are searched for; got ${show(syn.words)}`);
});

test('SR7: a plain plural or singular matches: relays and relay each find both; decide doesn\'t find decided', () => {
  const { a, k } = main();
  sameSet(k, ok(a, 'relays'), ['ruleRelay', 'ruleRelays'], 'relays');
  sameSet(k, ok(a, 'relay'), ['ruleRelay', 'ruleRelays'], 'relay');
  assert(ok(a, 'decide').matches.length === 0, `only plurals match as one word: decide doesn't find "decided"; got ${show(namesOf(k, ok(a, 'decide')))}`);
});

test('SR8: the word section\'s slug, name, title and wordTypes are no text: header and concept find nothing', () => {
  const { a, k } = main();
  assert(ok(a, 'header').matches.length === 0, `"concept header for the concept of rules" is the word section's boilerplate; got ${show(namesOf(k, ok(a, 'header')))}`);
  assert(ok(a, 'concept-word').matches.length === 0, `concept is only in the boilerplate; got ${show(namesOf(k, ok(a, 'concept-word')))}`);
});

// ── AC2: each match ──

test('SR9: each match is its five facts, kind, concepts, field, passage and words, and nothing more; the kinds; its concepts by name, through its sets', () => {
  const { a, k, seed } = main();
  const d = ok(a, 'iota');
  assert(show(sorted(Object.keys(d))) === show(ANSWER_KEYS), `the answer is ${show(ANSWER_KEYS)}; got ${show(sorted(Object.keys(d)))}`);
  sameSet(k, d, ['ruleDoc', 'ruleMust'], 'iotaword');
  for (const m of d.matches) assert(show(sorted(Object.keys(m))) === show(MATCH_KEYS), `a match is ${show(MATCH_KEYS)}; got ${show(sorted(Object.keys(m)))}`);
  const doc = byName(k, d, 'ruleDoc');
  assert(doc.address === seed.uuids.ruleDoc && doc.author === TA && doc.own === true && doc.name === 'Shared item', `its five facts; got ${show(doc)}`);
  assert(show(doc.concepts) === show([{ tapestryKey: k.docHeader, name: 'document' }, { tapestryKey: k.ruleHeader, name: 'rule' }]), `an element of two concepts names both, by name; got ${show(doc.concepts)}`);
  assert(show(byName(k, d, 'ruleMust').concepts) === show([{ tapestryKey: k.ruleHeader, name: 'rule' }]), `an element of a set names the concept above it; got ${show(byName(k, d, 'ruleMust').concepts)}`);
  const every = ok(a, 'every');
  sameSet(k, every, ['cardSet', 'ruleSuperset', 'docSuperset', 'ruleDog'], 'every');
  const kinds = Object.fromEntries(every.matches.map((m) => [named(k)(m.tapestryKey), m.kind]));
  assert(show(kinds) === show({ ...kinds, cardSet: 'node', ruleSuperset: 'superset', docSuperset: 'superset', ruleDog: 'node' }), `kinds as graph resolve answers them: a superset; a node labelled Set with no address is a node; got ${show(kinds)}`);
  const bind = ok(a, 'bind');
  sameSet(k, bind, ['mustSet', 'ruleBind'], 'bind');
  assert(byName(k, bind, 'mustSet').kind === 'set', `a set with an address is a set; got ${show(byName(k, bind, 'mustSet'))}`);
  assert(show(byName(k, ok(a, 'repository'), 'docHeader').concepts) === show([]), 'a concept header is an element of no concept here');
  const own = Object.fromEntries(ok(a, 'pov-all').matches.map((m) => [named(k)(m.tapestryKey), [m.author, m.own]]));
  assert(show(own.povAnon) === show([null, true]) && show(own.povHi) === show([PEERS.hi, false]) && show(own.povOwner) === show([OWNER, true]), `author and own, as C3 answers them; got ${show(own)}`);
});

test('SR10: the field it matched in: name, description, rule.statement, document.description, document.headings, conceptHeader.description', () => {
  const { a, k } = main();
  const field = (id, name) => { const m = byName(k, ok(a, id), name); assert(m, `${id} finds ${name}`); return m.field; };
  assert(field('hardcode', 'ruleTa') === 'rule.statement', `a rule's statement is rule.statement; got ${field('hardcode', 'ruleTa')}`);
  assert(field('runtime', 'ruleTa') === 'name', `the name holds runtime as the statement does: the name comes first; got ${field('runtime', 'ruleTa')}`);
  assert(field('specification', 'ruleHeader') === 'description', `the description tag comes before the JSON; got ${field('specification', 'ruleHeader')}`);
  assert(field('repository', 'docHeader') === 'conceptHeader.description', `a concept's description in its JSON is conceptHeader.description; got ${field('repository', 'docHeader')}`);
  assert(field('kappa', 'docLong') === 'document.description', `kappaword is in the description and in a heading: the description comes first; got ${field('kappa', 'docLong')}`);
  const hints = byName(k, ok(a, 'hints'), 'docLong');
  assert(hints.field === 'document.headings' && hints.passage === 'Map location hints', `the heading holding both words, whole: document.headings; got ${show({ field: hints.field, passage: hints.passage })}`);
  assert(show(hints.words) === show(['location', 'hints']), `the words it holds, in q's order; got ${show(hints.words)}`);
});

test('SR11: the passage: at most 200 characters, holding a word searched for, from before the first one; … at a cut end; a long field never whole', () => {
  const { a, k, seed } = main();
  const m = byName(k, ok(a, 'kappa'), 'docLong');
  const json = JSON.parse(seed.state.nodes.find((n) => n.props.type === 'json' && n.props.value.includes('Field guide')).props.value);
  const description = json.document.description;
  assert(description.length > PASSAGE, `the seed's description is longer than a passage (${description.length})`);
  assert(typeof m.passage === 'string' && m.passage.length <= PASSAGE, `a passage is at most ${PASSAGE} characters; got ${m.passage && m.passage.length}`);
  assert(/kappaword/i.test(m.passage), `the passage holds the word; got ${show(m.passage)}`);
  assert(m.passage.startsWith('…') && m.passage.endsWith('…'), `the word is past the start and well before the end, so both ends are cut and marked …; got ${show(m.passage)}`);
  const body = m.passage.replace(/^…/, '').replace(/…$/, '');
  assert(description.includes(body), `the passage is cut from the text it names; got ${show(m.passage)}`);
  assert(body.toLowerCase().indexOf('kappaword') > 0, `it starts before the word; got ${show(m.passage)}`);
  for (const id of ['hardcode', 'kappa', 'hints', 'iota', 'stop', 'tiers']) for (const x of ok(a, id).matches) assert(x.passage.length <= PASSAGE, `${id}: every passage is at most ${PASSAGE} characters`);
});

test('SR12: no match comes with a path: search packages no walk yet', () => {
  const { a } = main();
  for (const id of ['hardcode', 'iota', 'every', 'pov-all', 'repository']) {
    for (const m of ok(a, id).matches) {
      assert(!('path' in m) && !('depth' in m) && !('start' in m), `${id}: no node is answered because a walk reached it (ADR 0008 Decision 8); got ${show(m)}`);
      assert(typeof m.passage === 'string' && m.passage.length > 0, `${id}: every match comes with a passage`);
    }
  }
});

// ── AC3: the order, and paging ──

test('SR13: best first: every word before some, even at a lower score; then the higher score; then the lower tapestryKey', () => {
  const { a, k } = main();
  const tiers = ok(a, 'tiers');
  assert(show(namesOf(k, tiers)) === show(['tierBoth', 'tierAlpha4', 'tierAlpha1']), `tierBoth holds both words though tierAlpha4 scores higher; then the higher score; got ${show(namesOf(k, tiers))}`);
  assert(show(tiers.matches.map((m) => m.words)) === show([['alphaword', 'betaword'], ['alphaword'], ['alphaword']]), `the words each holds; got ${show(tiers.matches.map((m) => m.words))}`);
  const ties = ok(a, 'ties');
  assert(show(namesOf(k, ties)) === show(['tieC', 'tieA', 'tieB']), `tieC scores higher; tieA and tieB score the same and come by tapestryKey (${FIXED_KEYS.tieA} < ${FIXED_KEYS.tieB}); got ${show(namesOf(k, ties))}`);
});

test('SR14: the cursors page through every match once, in order; every page counts the whole list', () => {
  const { a, file } = main();
  const whole = ok(a, 'pov-all');
  const pages = pagesOf(file, { q: 'epsilonword', pov: 'everyone', limit: 3 });
  assert(show(pages.map((p) => p.matches.length)) === show([3, 3, 1]), `pages of 3, 3 and 1; got ${show(pages.map((p) => p.matches.length))}`);
  const keys = pages.flatMap((p) => p.matches.map((m) => m.tapestryKey));
  assert(show(keys) === show(whole.matches.map((m) => m.tapestryKey)), `the pages hold the whole list's matches, once each, in its order; got ${show(keys)}`);
  assert(pages.every((p) => p.kept === 7 && p.leftOut === 0 && p.complete === true), `every page counts the whole list; got ${show(pages.map((p) => [p.kept, p.leftOut, p.complete]))}`);
  assert(pages[pages.length - 1].cursor === null, 'the last page\'s cursor is null');
  assert(show(ok(a, 'page-1').matches) === show(pages[0].matches), 'the first page is the same each time');
});

test('SR15: a limit of 0 or 201 is refused naming limit', () => {
  const { a } = main();
  refused(a, 'limit-0', 400, 'invalid-input', 'limit');
  refused(a, 'limit-201', 400, 'invalid-input', 'limit');
});

test('SR16: a cursor for other words, kind, concept or point of view, or another read\'s, is refused invalid-cursor; the same words written otherwise are not', () => {
  const { a, k, file } = main();
  needDecl();
  const cursor = ok(a, 'page-1').cursor;
  assert(typeof cursor === 'string', 'the first page of three has a cursor');
  const [read, scope, position] = opened(cursor);
  const other = runOver(file, [
    get('other-words', 'owner', { q: 'alphaword', pov: 'everyone', limit: 3, cursor }),
    get('other-kind', 'owner', { q: 'epsilonword', kind: 'set', pov: 'everyone', limit: 3, cursor }),
    get('other-concept', 'owner', { q: 'epsilonword', concept: k.ruleHeader, pov: 'everyone', limit: 3, cursor }),
    get('other-pov', 'owner', { q: 'epsilonword', limit: 3, cursor }),
    get('other-read', 'owner', { q: 'epsilonword', pov: 'everyone', limit: 3, cursor: sealed(['graph walk', scope, position]) }),
    get('garbage', 'owner', { q: 'epsilonword', pov: 'everyone', limit: 3, cursor: 'not-a-cursor' }),
    get('same-words', 'owner', { q: '  EpsilonWord ', pov: 'everyone', limit: 3, cursor }),
  ]);
  assert(read === 'graph search', `a cursor names its read, graph search; got ${show(read)}`);
  for (const id of ['other-words', 'other-kind', 'other-concept', 'other-pov', 'other-read', 'garbage']) refused(other, id, 400, 'invalid-cursor', 'cursor');
  assert(ok(other, 'same-words').matches.length === 3, 'the same words, written in another case and with spaces, take the cursor');
});

test('SR17: a match added between two pages, ranked after the last one read, leaves every other answered once', () => {
  const seed = seedSearch();
  const file = fileOf(seed);
  const k = seed.keys;
  const first = runOver(file, [get('p1', 'owner', { q: 'epsilonword', pov: 'everyone', limit: 3 }), get('whole', 'owner', { q: 'epsilonword', pov: 'everyone', limit: 50 })]);
  const p1 = ok(first, 'p1');
  const whole = ok(first, 'whole').matches.map((m) => m.tapestryKey);
  // A late rule with a long statement: the lowest score of all, so it ranks after every match read so far.
  const s = S.readState(file);
  const nextEid = () => s.nextEid++;
  const late = { eid: nextEid(), labels: ['NostrEvent', 'ListItem', 'TapestryNode'], props: { tapestryKey: crypto.randomUUID(), kind: 39999, uuid: `39999:${TA}:povLate`, name: 'Late viewpoint', pubkey: TA } };
  const lateJson = { eid: nextEid(), labels: ['NostrEventTag', 'TapestryNode'], props: { tapestryKey: crypto.randomUUID(), type: 'json', value: JSON.stringify({ word: { slug: 'rule-pov-late', name: 'Late viewpoint', title: 'Late viewpoint', wordTypes: ['word', 'rule'] }, rule: { statement: `epsilonword ${'and a great many other words that make this statement long '.repeat(4)}`.trim(), strength: 'MAY' } }) } };
  s.nodes.push(late, lateJson);
  s.rels.push({ eid: nextEid(), type: 'HAS_TAG', from: late.eid, to: lateJson.eid, props: {} });
  writeState(file, s);
  const pages = [p1];
  let cursor = p1.cursor;
  while (cursor) {
    const d = ok(runOver(file, [get('p', 'owner', { q: 'epsilonword', pov: 'everyone', limit: 3, cursor })]), 'p');
    pages.push(d);
    cursor = d.cursor;
    assert(pages.length < 10, 'the pages end');
  }
  const keys = pages.flatMap((p) => p.matches.map((m) => m.tapestryKey));
  assert(show(keys) === show([...whole, late.props.tapestryKey]), `every match answered once, the late one after the rest; got ${show(keys.map(named({ ...k, povLate: late.props.tapestryKey })))}`);
});

// ── AC4: kind and concept ──

test('SR18: kind=concept answers only concept headers, kind=set only supersets and sets with an address; any other kind is refused naming kind', () => {
  const { a, k } = main();
  assert(ok(a, 'every-concept').matches.length === 0, `no concept header holds every; got ${show(namesOf(k, ok(a, 'every-concept')))}`);
  assert(show(namesOf(k, ok(a, 'repository-concept'))) === show(['docHeader']), `kind=concept still finds the document concept; got ${show(namesOf(k, ok(a, 'repository-concept')))}`);
  sameSet(k, ok(a, 'every-set'), ['ruleSuperset', 'docSuperset'], 'every, as a set (the card set has no address)');
  sameSet(k, ok(a, 'bind-set'), ['mustSet'], 'bind, as a set');
  for (const m of ok(a, 'every-set').matches) assert(m.kind === 'superset' || m.kind === 'set', `kind=set answers supersets and sets; got ${m.kind}`);
  refused(a, 'kind-node', 400, 'invalid-input', 'kind');
});

test('SR19: concept narrows a search to its elements, through its sets; a node in two concepts is under each', () => {
  const { a, k } = main();
  sameSet(k, ok(a, 'iota-rule'), ['ruleDoc', 'ruleMust'], 'iotaword within the rule concept (ruleMust through its set)');
  sameSet(k, ok(a, 'iota-document'), ['ruleDoc'], 'iotaword within the document concept');
  assert(ok(a, 'iota-rule-set').matches.length === 0, 'with kind=set too, a node must be both: no set is an element of rule');
  assert(ok(a, 'hardcode-document').matches.length === 0, 'hardcode finds no element of the document concept');
  const d = ok(a, 'iota-rule');
  assert(d.concept === k.ruleHeader && d.kind === null, `the answer says what it narrowed by; got ${show({ concept: d.concept, kind: d.kind })}`);
});

test('SR20: concept refusals: not a key; no node or a change entry, unknown-node; a superset or an element, not-a-concept, saying what it is', () => {
  const { a } = main();
  refused(a, 'concept-bad', 400, 'invalid-input', 'concept');
  refused(a, 'concept-unknown', 404, 'unknown-node', 'concept');
  refused(a, 'concept-entry', 404, 'unknown-node', 'concept');
  const sup = refused(a, 'concept-superset', 409, 'not-a-concept', 'concept');
  assert(/superset/i.test(sup.error), `the refusal says the node is a superset; got ${show(sup.error)}`);
  refused(a, 'concept-element', 409, 'not-a-concept', 'concept');
});

// ── AC5: the point of view ──

test('SR21: the owner\'s point of view by default: kept and leftOut across the whole list, on a page of one', () => {
  const { a, k } = main();
  const d = ok(a, 'pov-owner');
  sameSet(k, d, ['povTa', 'povOwner', 'povAnon', 'povHi'], 'epsilonword, from the owner\'s point of view');
  assert(d.kept === 4 && d.leftOut === 3, `kept 4 (the assistant's, the owner's, no author's, a peer scored 0.2), leftOut 3 (scored 0.01, no influence, no NostrUser); got ${d.kept}, ${d.leftOut}`);
  assert(d.pov && d.pov.name === 'owner' && d.pov.observer === OWNER && d.pov.scored === true, `the answer says it read from the owner's point of view; got ${show(d.pov)}`);
  const one = ok(a, 'pov-owner-1');
  assert(one.matches.length === 1 && one.kept === 4 && one.leftOut === 3, `a page of one counts the whole list; got ${show({ n: one.matches.length, kept: one.kept, leftOut: one.leftOut })}`);
  assert(show(ok(a, 'pov-owner-named')) === show(d), 'pov=owner is the default');
});

test('SR22: everyone answers every author\'s; the owner\'s pubkey is the owner; another pubkey unknown-pov; a malformed one invalid-input', () => {
  const { a } = main();
  const all = ok(a, 'pov-all');
  assert(all.matches.length === 7 && all.kept === 7 && all.leftOut === 0 && all.pov.name === 'everyone', `everyone's point of view keeps all seven; got ${show({ n: all.matches.length, kept: all.kept, leftOut: all.leftOut, pov: all.pov })}`);
  assert(show(ok(a, 'pov-owner-pubkey').matches) === show(ok(a, 'pov-owner').matches), 'the owner\'s pubkey is the owner\'s point of view');
  const st = refused(a, 'pov-stranger', 400, 'unknown-pov', 'pov');
  assert(/owner/.test(st.error) && /everyone/.test(st.error), `the refusal says which points of view it can read from; got ${show(st.error)}`);
  refused(a, 'pov-house', 400, 'invalid-input', 'pov');
});

test('SR23: nothing about a point of view is stored: a new score answers differently, with no write between', () => {
  const seed = seedSearch();
  const file = fileOf(seed);
  const k = seed.keys;
  const before = ok(runOver(file, [get('x', 'owner', { q: 'epsilonword', limit: 200 })]), 'x');
  assert(!namesOf(k, before).includes('povLo'), 'a peer scored 0.01 is left out');
  const s = S.readState(file);
  const logBefore = s.log.length;
  s.nodes.find((n) => n.labels.includes('NostrUser') && n.props.pubkey === PEERS.lo).props.influence = 0.3;
  writeState(file, s);
  const after = ok(runOver(file, [get('x', 'owner', { q: 'epsilonword', limit: 200 })]), 'x');
  assert(namesOf(k, after).includes('povLo') && after.kept === before.kept + 1, `once scored 0.3, the same search keeps it; got ${show(namesOf(k, after))}`);
  const log = S.readState(file).log.slice(logBefore);
  assert(log.every((e) => e.call === 'read'), `the search wrote nothing between; got ${show(log.filter((e) => e.call !== 'read'))}`);
});

test('SR24: before the owner\'s scores exist, only the instance\'s own count, and the answer says so', () => {
  const seed = seedSearch({ unscored: true });
  const d = ok(runOver(fileOf(seed), [get('x', 'owner', { q: 'epsilonword', limit: 200 })]), 'x');
  sameSet(seed.keys, d, ['povTa', 'povOwner', 'povAnon'], 'epsilonword before the scores exist');
  assert(d.pov.scored === false && d.kept === 3 && d.leftOut === 4, `scored is false, and only the instance's own count; got ${show({ pov: d.pov, kept: d.kept, leftOut: d.leftOut })}`);
});

// ── AC6: what it refuses ──

test('SR25: q refusals: none, missing-input; spaces, punctuation only, a control, direction or invisible character, bad-query; 301 characters invalid-input; 300 answer', () => {
  const { a } = main();
  refused(a, 'no-q', 400, 'missing-input', 'q');
  refused(a, 'q-spaces', 400, 'bad-query', 'q');
  const punct = refused(a, 'q-punctuation', 400, 'bad-query', 'q');
  assert(/word/i.test(punct.error), `the refusal says q holds no word; got ${show(punct.error)}`);
  for (const id of ['q-control', 'q-direction', 'q-invisible']) {
    const r = refused(a, id, 400, 'bad-query', 'q');
    assert(/U\+[0-9A-F]{4}/.test(r.error), `${id}: the refusal names the character by its code point; got ${show(r.error)}`);
  }
  refused(a, 'q-301', 400, 'invalid-input', 'q');
  ok(a, 'q-300');
});

test('SR26: an input search doesn\'t take is refused unknown-input', () => {
  const { a } = main();
  refused(a, 'unknown-input', 400, 'unknown-input', 'foo');
});

test('SR27: the index not ready: populating or missing answers 503 search-not-ready, saying which and how far it has filled', () => {
  const populating = seedSearch({ index: 'populating' });
  const missing = seedSearch({ index: 'missing' });
  const p = refused(runOver(fileOf(populating), [get('x', 'owner', { q: 'hardcode' })]), 'x', 503, 'search-not-ready');
  assert(/45/.test(p.error) && /popul|fill/i.test(p.error), `the refusal says the index is still filling, and how far: 45%; got ${show(p.error)}`);
  const m = refused(runOver(fileOf(missing), [get('x', 'owner', { q: 'hardcode' })]), 'x', 503, 'search-not-ready');
  assert(/graph_search_text/.test(m.error) && /(not|n't) (there|made|yet)|missing|no (such )?index|(doesn't|does not) exist/i.test(m.error), `the refusal says the index isn't there; got ${show(m.error)}`);
});

test('SR28: a node whose JSON is offloaded is found by its name, and the answer counts such nodes', () => {
  const { a, k } = main();
  const d = ok(a, 'offloaded');
  assert(show(namesOf(k, d)) === show(['offNode']) && d.matches[0].field === 'name', `thetaword finds the offloaded node by its name; got ${show(d.matches)}`);
  assert(d.offloaded === 1, `one node's JSON is offloaded to the LMDB store; got ${show(d.offloaded)}`);
  assert(ok(a, 'hardcode').offloaded === 1, 'every answer counts them');
});

test('SR29: the bound: 5,001 matches answer complete false, the 5,000 best counted, pages of 50 by default and 200 at most; 5,000 complete', () => {
  const over = seedSearchBound({ n: BOUND + 1 });
  const a = runOver(fileOf(over), [get('default', 'owner', { q: 'omegaword' }), get('most', 'owner', { q: 'omegaword', limit: 200 })]);
  const d = ok(a, 'default');
  assert(d.complete === false && d.kept + d.leftOut === BOUND && d.kept === BOUND, `5,001 nodes hold omegaword: complete false, the ${BOUND} best counted; got ${show({ complete: d.complete, kept: d.kept, leftOut: d.leftOut })}`);
  assert(d.matches.length === 50 && typeof d.cursor === 'string', `a page of 50 by default, with a cursor; got ${d.matches.length}, ${show(d.cursor)}`);
  assert(ok(a, 'most').matches.length === 200, `a limit of 200 answers 200; got ${ok(a, 'most').matches.length}`);
  const at = seedSearchBound({ n: BOUND });
  const e = ok(runOver(fileOf(at), [get('x', 'owner', { q: 'omegaword' })]), 'x');
  assert(e.complete === true && e.kept === BOUND && e.offloaded === 0, `5,000 matches are the whole list: complete true; got ${show({ complete: e.complete, kept: e.kept, offloaded: e.offloaded })}`);
});

// ── AC7: a read, behind sign-in, that agents can use ──

test('SR30: a visitor gets 401 and a stranger 403; an admin gets what the owner gets', () => {
  const { a } = main();
  needDecl();
  assert(a.req('visitor').status === 401 && a.req('stranger').status === 403, `a visitor 401, a stranger 403; got ${a.req('visitor').status}, ${a.req('stranger').status}`);
  assert(show(ok(a, 'admin-same')) === show(ok(a, 'owner-same')), 'an admin searches exactly what the owner searches, from the owner\'s point of view');
});

test('SR31: it writes nothing: it only reads, the graph is as it was, and no change entry is recorded', () => {
  const { a, file, before } = main();
  ok(a, 'hardcode');
  ok(a, 'pov-owner');
  const after = S.readState(file);
  const log = after.log.slice(before.log.length);
  assert(log.length > 0 && log.every((e) => e.call === 'read'), `graph search opens no write transaction; the log: ${show(log.filter((e) => e.call !== 'read').slice(0, 5))}`);
  assert(after.nodes.length === before.nodes.length && after.rels.length === before.rels.length, 'the graph has the same nodes and relationships');
  assert(S.entriesOf(after).length === S.entriesOf(before).length, 'no change entry was recorded');
});

test('SR32: the command answers what the route answers, refusals included', () => {
  const { a } = main();
  needDecl();
  for (const [c, r, code] of [['cli-hardcode', 'route-hardcode', 0], ['cli-iota', 'route-iota', 0], ['cli-refusal', 'route-refusal', 1]]) {
    const cmd = a.cmd(c);
    assert(cmd.code === code, `${c} exits ${code}; got ${cmd.code} ${String(cmd.stderr).slice(-300)}`);
    let body = null;
    try { body = JSON.parse(cmd.stdout); } catch { /* reported below */ }
    assert(body && show(body) === show(a.req(r).body), `${c} prints what ${r} answers; command ${show(body).slice(0, 300)}, route ${show(a.req(r).body).slice(0, 300)}`);
  }
});

test('SR33: it is listed for an admin with its inputs and refusals, and has its /docs entry', () => {
  const { a } = main();
  needDecl();
  const list = a.req('list');
  const e = ((list.body.data && list.body.data.operations) || []).find((o) => o.group === 'graph' && o.name === 'search');
  assert(e, `graph search is listed for an admin; problems: ${show(list.body.data && list.body.data.problems)}`);
  assert(e.kind === 'read' && e.method === 'GET' && e.access === 'owner-and-admins' && e.route === ROUTE && e.command === 'tapestry graph search', `a GET read for the owner and admins; got ${show({ kind: e.kind, method: e.method, access: e.access, route: e.route, command: e.command })}`);
  assert(show(Object.keys(e.inputs).sort()) === show(INPUTS), `its inputs: q, kind, concept, pov, limit and cursor; got ${show(Object.keys(e.inputs))}`);
  const codes = e.refusals.map((x) => `${x.code}:${x.status}`);
  for (const c of ['bad-query:400', 'unknown-node:404', 'not-a-concept:409', 'search-not-ready:503', 'unknown-pov:400', 'invalid-cursor:400', 'missing-input:400', 'unknown-input:400', 'invalid-input:400', 'sign-in-required:401', 'not-allowed:403']) {
    assert(codes.includes(c), `its refusals include ${c}; got ${show(codes)}`);
  }
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    const params = p && p.get ? (p.get.parameters || []) : [];
    process.stdout.write('RESULT:' + JSON.stringify({ methods: p ? Object.keys(p) : null, names: params.map((x) => x.name).sort(), qRequired: (params.find((x) => x.name === 'q') || {}).required === true }));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('search-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  const docs = line ? JSON.parse(line) : null;
  assert(docs && show(docs.methods) === show(['get']), `/docs has GET ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
  assert(show(docs.names) === show(INPUTS), `/docs gives its six query parameters; got ${show(docs.names)}`);
  assert(docs.qRequired, '/docs says q is required');
});

test('SR34: the catalog and reads.js say how search answers and pages', () => {
  needDecl();
  const catalog = fs.readFileSync(CATALOG, 'utf8');
  const row = catalog.split('\n').find((l) => l.startsWith('| `search` |'));
  assert(row, 'the catalog has its search row in §1');
  for (const w of ['passage', 'field', 'complete', 'cursor', 'offloaded']) assert(row.includes(w), `§1's search row says what search answers, as built: it names ${w}; got ${row.slice(0, 400)}`);
  const paging = catalog.split('\n').find((l) => l.includes('**Paging.**'));
  assert(paging && /search/.test(paging), `the Conventions' Paging bullet names search's order (ADR 0011 Amendment 5); got ${show(paging && paging.slice(0, 300))}`);
  const reads = fs.readFileSync(READS, 'utf8');
  const c1 = reads.slice(reads.indexOf(' * C1.'), reads.indexOf(' * C2.'));
  assert(/search/.test(c1), `reads.js's C1 paragraph names search's order and its exception; got ${show(c1.slice(0, 400))}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
