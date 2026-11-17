'use strict';
/**
 * graph search — concepts and elements found by the words in their names and fields, best first, each match with the
 * field it matched in and a passage, from a point of view (catalog §1; story graph-operations-first-slice #8; ADR
 * graph-operations-first-slice/0008). A read: it opens no write transaction and writes nothing.
 *
 * Its reads (Decision 4):
 *   S0  the full-text index's state (src/lib/graph-search-index.js): search answers search-not-ready until it is online
 *   S1  the nodes read: Lucene's hits on graph_search_text, each hit on a tag mapped to its node, filtered by kind and
 *       concept, scored by the sum of their texts' scores, judged by the point of view (reads.js's C2), the BOUND + 1
 *       best by score, each with its json and description tags
 *   S2  the page's concepts: the headers whose class threads reach each node on the page
 *   S3  how many json tags hold an LMDB reference, whose fields the index can't read
 * The check, the passage and the order are _search.js's (Decisions 3, 5 and 6). It stores nothing: each page reads S1
 * again, and the point of view filters inside S1's own query (CLAUDE.md, principles 1–3).
 */

const graph = require('../../graph');
const R = require('../../reads');
const { refusal } = require('../../refusal');
const { kindOf } = require('../../resolve');
const X = require('./_search');
const { KEY_PATTERN } = require('./_nodes');
const { INDEX_NAME, indexState } = require('../../../lib/graph-search-index');

const READ = 'graph search';

const UNKNOWN_NODE = Object.freeze({ code: 'unknown-node', status: 404, when: 'A concept that names no node of the graph (a change entry is not one); the refusal names concept' });
const NOT_A_CONCEPT = Object.freeze({ code: 'not-a-concept', status: 409, when: "A concept that isn't a concept header (a node labelled ConceptHeader, or ListHeader for one the nostr import brought in); the refusal names concept and says what the node is" });
const SEARCH_NOT_READY = Object.freeze({ code: 'search-not-ready', status: 409, when: `The full-text index ${INDEX_NAME} isn't there, or isn't online yet; the refusal says which and how far it has filled. The control panel makes it when it starts, and it fills by itself` });

/** The class thread's relationship types, as firmware names them (as list-elements takes them). */
function types() {
  const { relAlias } = require('../../../api/normalize/firmware');
  return { INIT: relAlias('CLASS_THREAD_INITIATION'), PROP: relAlias('CLASS_THREAD_PROPAGATION'), TERM: relAlias('CLASS_THREAD_TERMINATION') };
}

/** S1, from fixed texts: the kind's test, and the class thread's walk when a concept is given. Nothing else comes from input. */
function nodesRead(kind, T) {
  const kindText = kind === 'concept' ? 'AND (n:ConceptHeader OR n:ListHeader)'
    : kind === 'set' ? 'AND (n:Superset OR n:Set) AND n.uuid IS NOT NULL'
      : '';
  const within = T ? `AND EXISTS { MATCH (:TapestryNode {tapestryKey: $concept})-[:${T.INIT}]->(:Superset)-[:${T.PROP}*0..]->()-[:${T.TERM}]->(n) }` : '';
  // The bound is a checked whole number, so it goes into the text: the driver would send a parameter as a float (C1).
  return `CALL db.index.fulltext.queryNodes('${INDEX_NAME}', $lucene) YIELD node AS x, score
     OPTIONAL MATCH (p:TapestryNode)-[:HAS_TAG]->(x)
       WHERE x:NostrEventTag AND x.type IN ['json', 'name', 'description']
     WITH CASE WHEN x:NostrEventTag THEN p ELSE x END AS n, score
     WHERE n IS NOT NULL AND NOT n:NostrEventTag AND NOT n:GraphChange
       AND n.tapestryKey IS NOT NULL AND n.tapestryKey <> '{}' ${kindText} ${within}
     WITH n, sum(score) AS score
     ${R.trust('n', ['score'])}
     WITH n, score, counts ORDER BY score DESC, n.tapestryKey LIMIT ${X.BOUND + 1}
     OPTIONAL MATCH (n)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
     OPTIONAL MATCH (n)-[:HAS_TAG]->(d:NostrEventTag {type: 'description'})
     RETURN ${R.nodeColumns('n')}, n:ConceptHeader OR n:ListHeader AS isHeader, n:Superset AS isSuperset, n:Set AS isSet,
            head(collect(j.value)) AS json, head(collect(d.value)) AS description, score, counts`;
}

/** S2: the headers whose class threads reach each of `keys`, with each header's name → Map(key → [{ tapestryKey, name }]). */
async function conceptsOf(read, keys, T) {
  const out = new Map();
  if (!keys.length) return out;
  const rows = await read(
    `MATCH (e:TapestryNode) WHERE e.tapestryKey IN $keys AND NOT e:GraphChange
     MATCH (e)<-[:${T.TERM}]-()<-[:${T.PROP}*0..]-(:Superset)<-[:${T.INIT}]-(h)
     WHERE h:ConceptHeader OR h:ListHeader
     RETURN DISTINCT e.tapestryKey AS key, h.tapestryKey AS concept, coalesce(h.tapestryValue, h.name) AS name`,
    { keys },
  );
  for (const r of rows) {
    if (typeof r.key !== 'string' || typeof r.concept !== 'string') continue;
    if (!out.has(r.key)) out.set(r.key, []);
    const list = out.get(r.key);
    if (!list.some((c) => c.tapestryKey === r.concept)) list.push({ tapestryKey: r.concept, name: typeof r.name === 'string' && r.name ? r.name : null });
  }
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  for (const list of out.values()) list.sort((a, b) => ((a.name === null) - (b.name === null)) || cmp(a.name || '', b.name || '') || cmp(a.tapestryKey, b.tapestryKey));
  return out;
}

const asCount = (x) => (typeof x === 'number' ? x : x && typeof x.toNumber === 'function' ? x.toNumber() : Number(x) || 0);

/** `concept` must name a concept header: list-elements' read of the node, and its two refusals. */
async function requireConcept(read, key) {
  const found = await read(
    `MATCH (n:TapestryNode {tapestryKey: $key})
     WHERE NOT n:GraphChange
     RETURN n.tapestryKey AS key, n:ConceptHeader OR n:ListHeader AS isHeader, n:Superset AS isSuperset, n:Set AS isSet,
            n.uuid IS NOT NULL AS hasAddress`,
    { key },
  );
  if (!found.length) throw refusal(UNKNOWN_NODE.code, `No node of this graph has the tapestryKey ${key}, which concept names.`, { input: 'concept' });
  const node = found[0];
  if (node.isHeader) return;
  const what = node.hasAddress ? (node.isSuperset ? 'a superset' : node.isSet ? 'a set' : null) : null;
  throw refusal(NOT_A_CONCEPT.code, what
    ? `${key} is ${what}, not a concept header. concept takes the header of the concept to search within: pass the header of the concept the ${what.slice(2)} belongs to.`
    : `${key} is not a concept header (a node labelled ConceptHeader, or ListHeader for one the nostr import brought in), so it has no elements to search within.`, { input: 'concept' });
}

function notReady(state) {
  if (!state) {
    return `graph search's index, ${INDEX_NAME}, isn't there yet. The control panel makes it when it starts, and it fills by itself; if it is still missing after a restart, the control panel's log says why.`;
  }
  const pct = state.populationPercent === null ? '' : `: ${state.populationPercent}% so far`;
  return state.state === 'POPULATING'
    ? `graph search's index, ${INDEX_NAME}, is still filling${pct} (POPULATING). It fills by itself; search again in a moment.`
    : `graph search's index, ${INDEX_NAME}, isn't online: its state is ${state.state}${pct}. The control panel's log says why.`;
}

const MATCH = {
  type: 'object',
  required: [...R.NODE.required, 'kind', 'concepts', 'field', 'passage', 'words'],
  description: 'A match: its five facts, its kind, the concepts it is an element of, the field its words were found in, a passage of that text, and the words it holds',
  properties: {
    ...R.NODE.properties,
    kind: { type: 'string', enum: ['concept', 'superset', 'set', 'node'], description: 'A concept header (concept), a superset or a set with an address, or another node, as graph resolve answers one' },
    concepts: {
      type: 'array',
      description: 'The concepts it is an element of, through their class threads, by name then tapestryKey',
      items: { type: 'object', required: ['tapestryKey', 'name'], properties: { tapestryKey: { type: 'string' }, name: { type: 'string', nullable: true } } },
    },
    field: { type: 'string', description: 'Where its words were found: name, description, or <section>.<field> in its JSON, such as rule.statement or document.headings' },
    passage: { type: 'string', description: `The text its words were found in, or at most ${X.PASSAGE} characters of it around them, with … at a cut end` },
    words: { type: 'array', items: { type: 'string' }, description: "The words searched for that it holds, in q's order" },
  },
};

module.exports = {
  group: 'graph',
  name: 'search',
  kind: 'read',
  access: 'owner-and-admins',
  summary: 'Concepts and elements found by the words in their names and fields, best first, each with the field it matched in and a passage, from a point of view',
  description: [
    "The nodes whose texts hold `q`'s words: a node's name, its description, and the values of its fields, a concept's plural and description among them. A word matches only a whole word, whatever its case, and a plain plural or singular matches too (`rule` finds \"rules\"). Stop words such as the, of and is are left out when `q` has other words. JSON keys are never matched: `statement` finds the rules whose statement says the word, not every rule.",
    "Each match comes with its five facts, its kind, the concepts it is an element of, the field its words were found in and a passage of at most 200 characters around them. Matches come best first: one holding every word before one holding some, then by how well it matches (Lucene's score), then by tapestryKey; up to `limit` a page, with a `cursor` for the next. A search reads the 5,000 best nodes at most: past that, the answer says `complete: false`, and its counts cover those 5,000.",
    "`kind` narrows to concept headers (`concept`) or to supersets and sets (`set`); `concept`, a concept header's tapestryKey, to that concept's elements, through its class thread. Read from a point of view: the owner's by default; `pov=everyone` counts every author's claims. The answer says how many matches the point of view kept and left out, and how many nodes' JSON is offloaded to the LMDB store, which are found by their name only.",
  ].join('\n\n'),
  inputs: {
    q: { schema: { type: 'string', maxLength: X.MAX_Q }, required: true, description: `The words to search for, at most ${X.MAX_Q} characters: words, not substrings, whatever their case` },
    kind: { schema: { type: 'string', enum: ['concept', 'set'] }, description: 'concept: only concept headers; set: only supersets and sets' },
    concept: { schema: { type: 'string', pattern: KEY_PATTERN }, description: "A concept header's tapestryKey: only that concept's elements, through its class thread" },
    pov: R.POV_INPUT,
    limit: R.LIMIT_INPUT,
    cursor: R.CURSOR_INPUT,
  },
  result: {
    description: 'A page of the matches, best first, what was searched for and by, the point of view and what it kept and left out, whether the list is complete, and the cursor for the next page (null on the last)',
    schema: {
      type: 'object',
      required: ['q', 'words', 'kind', 'concept', 'pov', 'kept', 'leftOut', 'complete', 'offloaded', 'matches', 'cursor'],
      properties: {
        q: { type: 'string', description: 'q, trimmed' },
        words: { type: 'array', items: { type: 'string' }, description: 'The words searched for: q\'s words, lowercased, each once, its stop words left out when it has others' },
        kind: { type: 'string', nullable: true, description: 'The kind searched within, or null' },
        concept: { type: 'string', nullable: true, description: 'The concept searched within, or null' },
        pov: R.POV,
        kept: { type: 'integer', minimum: 0, description: 'How many matches the point of view kept, across the whole list' },
        leftOut: { type: 'integer', minimum: 0, description: 'How many it left out, across the whole list' },
        complete: { type: 'boolean', description: `false when more than ${X.BOUND} nodes hit: the list and its counts then cover the ${X.BOUND} best` },
        offloaded: { type: 'integer', minimum: 0, description: 'How many nodes\' JSON is offloaded to the LMDB store: such a node is found by its name and description only' },
        matches: { type: 'array', items: MATCH, description: 'This page of the matches, best first' },
        cursor: { type: 'string', nullable: true, description: 'Pass it as cursor for the next page; null on the last' },
      },
    },
  },
  refusals: [X.BAD_QUERY, UNKNOWN_NODE, NOT_A_CONCEPT, SEARCH_NOT_READY, R.UNKNOWN_POV, R.INVALID_CURSOR],

  async run(inputs) {
    const limit = inputs.limit;
    if (!Number.isInteger(limit) || limit < 1) throw new Error(`graph search's limit must be a whole number from 1; got ${JSON.stringify(limit)}`);
    const read = (cypher, params) => graph.read(cypher, params);
    const { q, words, forms } = X.words(inputs.q);
    const kind = inputs.kind || null;
    const concept = inputs.concept || null;
    const pov = await R.resolvePov(read, inputs.pov);
    const scope = R.scopeOf([words, kind, concept, pov.name]);
    const after = inputs.cursor ? R.decodeCursor(READ, scope, inputs.cursor, X.isPosition) : null;
    if (concept) await requireConcept(read, concept);

    const state = await indexState(read);
    if (!state || state.state !== 'ONLINE') throw refusal(SEARCH_NOT_READY.code, notReady(state));

    const T = types();
    const rows = await read(nodesRead(kind, concept ? T : null), { lucene: X.luceneOf(words, forms), concept, ...R.trustParams(pov) });
    const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    const best = [...rows].sort((a, b) => (b.score - a.score) || cmp(a.tapestryKey, b.tapestryKey));
    const complete = best.length <= X.BOUND;
    const matches = [];
    for (const row of best.slice(0, X.BOUND)) {
      const m = X.check(row, words, forms);
      if (m) matches.push({ row, ...m, every: m.words.length === words.length ? 1 : 0, score: row.score, tapestryKey: row.tapestryKey });
    }
    const kept = matches.filter((m) => m.row.counts === true).sort(X.order);
    const listed = after ? kept.filter((m) => X.after(m, after)) : kept;
    const page = R.pageOf(listed, limit, (last) => R.encodeCursor(READ, scope, [last.every, last.score, last.tapestryKey]));
    const concepts = await conceptsOf(read, page.items.map((m) => m.tapestryKey), T);
    const off = await read("MATCH (t:NostrEventTag {type: 'json'}) WHERE t.value STARTS WITH 'lmdb:' RETURN count(t) AS n", {});

    return {
      q,
      words,
      kind,
      concept,
      pov: { name: pov.name, observer: pov.observer, cutoff: pov.cutoff, scored: pov.scored },
      kept: kept.length,
      leftOut: matches.length - kept.length,
      complete,
      offloaded: off.length ? asCount(off[0].n) : 0,
      matches: page.items.map((m) => ({
        ...R.nodeOf(m.row, pov.own),
        kind: kindOf(m.row),
        concepts: concepts.get(m.tapestryKey) || [],
        field: m.field,
        passage: m.passage,
        words: m.words,
      })),
      cursor: page.cursor,
    };
  },
};
