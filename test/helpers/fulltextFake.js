'use strict';
/**
 * A full-text index, for test/helpers/graphFake.js and test/helpers/pathCypherFake.js (story graph-operations-first-slice
 * #8, ADR graph-operations-first-slice/0008, Decisions 1, 2 and 4). graph search is its first user.
 *
 * A fake graph's state may hold `fulltextIndexes`, each as SHOW FULLTEXT INDEXES answers one:
 *
 *   { name, type: 'FULLTEXT', entityType: 'NODE', labelsOrTypes: [label], properties: [prop, …], state: 'ONLINE',
 *     populationPercent: 100, options: { indexConfig: { 'fulltext.analyzer': …, 'fulltext.eventually_consistent': … } } }
 *
 * With none, the graph has no full-text index, as a fresh Neo4j has none.
 *
 *   showFulltextIndexes(state, cypher, params) runs `SHOW FULLTEXT INDEXES [YIELD col, …] [WHERE col = <'text' or
 *     $param>] [RETURN col [AS alias], …]`, over the state's indexes.
 *   queryNodes(state, name, query) gives { node, score } for each node the index covers that the query matches, best
 *     first, as db.index.fulltext.queryNodes does:
 *     - the nodes it covers: every node with the index's label(s) holding a string, or a list of strings, in one of its
 *       properties. It reads them as they are, whatever the index's state;
 *     - the words: the standard analyzer's, Unicode's word segments lowercased. That is Intl.Segmenter's word-like
 *       segments, which ADR 0008 (Context 4) found to split as the analyzer does;
 *     - the query: Lucene's syntax as far as search writes it (Decision 2): phrases in double quotes ("…", with \" and \\
 *       escaped), joined by OR and grouped by ( ). A phrase matches where its words come one after another in one
 *       property's words; a phrase with no word matches nothing;
 *     - the score: for each phrase, the times it matches, over one more than the number of the node's words, summed:
 *       the same each time for the same graph, higher for more matches and for fewer words, as Lucene's BM25 is. Two
 *       nodes with the same text score the same.
 *   Anything else in a query throws "the fake full-text index can't read this query", naming what it met. A name no
 *   index has throws as Neo4j does: "There is no such fulltext schema index: <name>".
 */

const SEGMENTER = new Intl.Segmenter('en', { granularity: 'word' });

/** A text's words, as the standard analyzer gives them: Unicode word segments, lowercased. */
function wordsOf(text) {
  const out = [];
  for (const s of SEGMENTER.segment(String(text))) if (s.isWordLike) out.push(s.segment.toLowerCase());
  return out;
}

function cantRead(why, query) {
  return new Error(`the fake full-text index can't read this query (${why}); it reads phrases in double quotes, joined by OR and grouped by ( ), as graph search writes them (test/helpers/fulltextFake.js): ${String(query).slice(0, 300)}`);
}

/** The phrases a query names, each as its list of words; the query is their OR. */
function phrasesOf(query) {
  if (typeof query !== 'string') throw cantRead('a query that is not text', query);
  const q = query;
  let i = 0;
  const phrases = [];
  const space = () => { while (i < q.length && /\s/.test(q[i])) i++; };
  function clause() {
    space();
    if (q[i] === '(') {
      i++;
      disjunction();
      space();
      if (q[i] !== ')') throw cantRead(`a ( with no ) at ${i}`, q);
      i++;
      return;
    }
    if (q[i] !== '"') throw cantRead(`${q[i] === undefined ? 'the end' : JSON.stringify(q[i])} where a phrase in double quotes should be, at ${i}`, q);
    i++;
    let text = '';
    while (i < q.length && q[i] !== '"') {
      if (q[i] === '\\') {
        if (i + 1 >= q.length) throw cantRead('a \\ at the end', q);
        text += q[i + 1];
        i += 2;
      } else {
        text += q[i];
        i++;
      }
    }
    if (q[i] !== '"') throw cantRead('a phrase with no closing "', q);
    i++;
    phrases.push(wordsOf(text));
  }
  function disjunction() {
    clause();
    for (;;) {
      space();
      if (q.startsWith('OR', i) && /[\s("]/.test(q[i + 2] || '')) { i += 2; clause(); continue; }
      return;
    }
  }
  disjunction();
  space();
  if (i < q.length) throw cantRead(`${JSON.stringify(q.slice(i, i + 20))} after the last phrase (only OR joins phrases)`, q);
  return phrases;
}

/** How many times `phrase` (a list of words) comes, one word after another, in `words`. */
function occurrences(words, phrase) {
  if (!phrase.length) return 0;
  let n = 0;
  for (let i = 0; i + phrase.length <= words.length; i++) {
    let all = true;
    for (let j = 0; j < phrase.length; j++) if (words[i + j] !== phrase[j]) { all = false; break; }
    if (all) n++;
  }
  return n;
}

function indexNamed(state, name) {
  const ix = (state.fulltextIndexes || []).find((x) => x && x.name === name);
  if (!ix) {
    const e = new Error(`Failed to invoke procedure \`db.index.fulltext.queryNodes\`: Caused by: java.lang.IllegalArgumentException: There is no such fulltext schema index: ${name}`);
    e.code = 'Neo.ClientError.Procedure.ProcedureCallFailed';
    throw e;
  }
  return ix;
}

/** The plain value of a stored property: a string, a list of strings, or null for anything the index doesn't read. */
function texts(v) {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
  return [];
}

/** db.index.fulltext.queryNodes(name, query): [{ node, score }], best first, then in the graph's order. */
function queryNodes(state, name, query) {
  const ix = indexNamed(state, name);
  const phrases = phrasesOf(query);
  const labels = ix.labelsOrTypes || [];
  const props = ix.properties || [];
  const hits = [];
  (state.nodes || []).forEach((node, at) => {
    if (!labels.every((l) => node.labels.includes(l))) return;
    const fields = props.flatMap((p) => texts(node.props[p]).map(wordsOf));
    if (!fields.length) return;
    const total = fields.reduce((a, f) => a + f.length, 0);
    let matches = 0;
    for (const phrase of phrases) for (const f of fields) matches += occurrences(f, phrase);
    if (matches > 0) hits.push({ node, score: matches / (1 + total), at });
  });
  hits.sort((a, b) => (b.score - a.score) || (a.at - b.at));
  return hits.map(({ node, score }) => ({ node, score }));
}

/** SHOW FULLTEXT INDEXES's rows, all columns. */
function indexRows(state) {
  return (state.fulltextIndexes || []).map((x, i) => ({
    id: i + 1,
    name: x.name,
    state: x.state || 'ONLINE',
    populationPercent: x.populationPercent === undefined ? 100 : x.populationPercent,
    type: 'FULLTEXT',
    entityType: x.entityType || 'NODE',
    labelsOrTypes: [...(x.labelsOrTypes || [])],
    properties: [...(x.properties || [])],
    indexProvider: 'fulltext-1.0',
    owningConstraint: null,
    options: x.options || { indexProvider: 'fulltext-1.0', indexConfig: {} },
  }));
}

/** Run SHOW FULLTEXT INDEXES [YIELD …] [WHERE col = value] [RETURN …] over the state's indexes. */
function showFulltextIndexes(state, cypher, params = {}) {
  const q = String(cypher).replace(/\s+/g, ' ').trim().replace(/;$/, '');
  const m = /^SHOW FULLTEXT INDEXES(?: YIELD (.+?))?(?: WHERE (\w+) = (?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|\$(\w+)))?(?: RETURN (.+))?$/i.exec(q);
  if (!m) throw new Error(`the fake graph can't run this SHOW (it runs SHOW FULLTEXT INDEXES [YIELD …] [WHERE <column> = <'text' or $param>] [RETURN …]; test/helpers/fulltextFake.js): ${q.slice(0, 300)}`);
  const [, yieldList, whereCol, lit1, lit2, param, returnList] = m;
  const cols = (list) => list.split(',').map((s) => s.trim()).filter(Boolean).map((item) => {
    const am = /^(\w+)(?: AS (\w+))?$/i.exec(item);
    if (!am) throw new Error(`the fake graph's SHOW reads plain columns, with AS; it met ${item}`);
    return { col: am[1], alias: am[2] || am[1] };
  });
  let rows = indexRows(state);
  if (yieldList) {
    const ys = cols(yieldList);
    rows = rows.map((r) => Object.fromEntries(ys.map((y) => [y.alias, r[y.col] === undefined ? null : r[y.col]])));
  }
  if (whereCol) {
    const want = param !== undefined ? params[param] : (lit1 !== undefined ? lit1 : lit2).replace(/\\(.)/g, '$1');
    rows = rows.filter((r) => r[whereCol] === want);
  }
  if (returnList) {
    const rs = cols(returnList);
    rows = rows.map((r) => Object.fromEntries(rs.map((x) => [x.alias, r[x.col] === undefined ? null : r[x.col]])));
  }
  return rows;
}

module.exports = { wordsOf, phrasesOf, queryNodes, showFulltextIndexes };
