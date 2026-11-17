'use strict';
/**
 * graph search's full-text index (story graph-operations-first-slice #8, ADR graph-operations-first-slice/0008
 * Decision 1): graph_search_text, on TapestryNode over name, tapestryValue and value. A tag node is a TapestryNode with
 * its text in `value`, so one index covers node names and the texts of their letters. With eventually_consistent
 * false, a write's own transaction keeps it current, whichever route wrote.
 *
 * The control panel makes it when it starts, as it makes tapestry_node_uuid and the change entries' indexes
 * (src/lib/tapestry-node-index.js). ensureSearchIndexOnBoot isn't awaited, retries the graph's start-up errors, never
 * throws, never rejects and never drops anything. It makes nothing when the name is held by another definition
 * (name-taken), or when an index under another name covers the same label and properties (equivalent-exists): Neo4j
 * keeps one full-text index per schema, and CREATE … IF NOT EXISTS would silently make nothing. Making the index changes
 * no node, relationship or property; it fills in the background.
 *
 * indexState(read) is graph search's S0: { state, populationPercent } for the index, or null when it isn't there.
 *
 * It needs no driver of its own: the callers pass runRead and runWrite, or read, so it loads and is tested stack-free.
 */

const INDEX_NAME = 'graph_search_text';
const LABEL = 'TapestryNode';
const PROPERTIES = Object.freeze(['name', 'tapestryValue', 'value']);
const ANALYZER = 'standard-no-stop-words';

const CREATE_INDEX = `CREATE FULLTEXT INDEX ${INDEX_NAME} IF NOT EXISTS
FOR (n:${LABEL}) ON EACH [${PROPERTIES.map((p) => `n.${p}`).join(', ')}]
OPTIONS { indexConfig: { \`fulltext.analyzer\`: '${ANALYZER}', \`fulltext.eventually_consistent\`: false } }`;
const SHOW_INDEXES = 'SHOW FULLTEXT INDEXES YIELD name, labelsOrTypes, properties, options';
const STATE = `SHOW FULLTEXT INDEXES YIELD name, state, populationPercent WHERE name = '${INDEX_NAME}' RETURN state, populationPercent`;

// The errors of a graph that is starting, or whose password the entrypoint is still setting (as tapestry-node-index's).
const RETRY_CODES = Object.freeze(['ServiceUnavailable', 'SessionExpired', 'Neo.ClientError.Security.Unauthorized', 'Neo.ClientError.Security.AuthenticationRateLimit']);
const retriable = (err) => {
  const code = err && typeof err.code === 'string' ? err.code : '';
  return code.startsWith('Neo.TransientError.') || RETRY_CODES.includes(code);
};
const sleepMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sameList = (a, b) => {
  const x = [].concat(a || []).map(String).sort();
  const y = [].concat(b || []).map(String).sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
};
/** Does the row cover what Decision 1's index covers: TapestryNode, over name, tapestryValue and value, in any order? */
const sameSchema = (row) => sameList(row && row.labelsOrTypes, [LABEL]) && sameList(row && row.properties, PROPERTIES);
const analyzerOf = (row) => {
  const config = row && row.options && row.options.indexConfig;
  return config && typeof config['fulltext.analyzer'] === 'string' ? config['fulltext.analyzer'] : null;
};
/** Is the row Decision 1's index: its name, its schema and its analyzer? */
const isOurs = (row) => !!row && row.name === INDEX_NAME && sameSchema(row) && analyzerOf(row) === ANALYZER;

/**
 * Make graph_search_text when it is missing. Retries the graph's start-up errors, waiting 5 s and doubling to 60 s, for
 * up to `windowMs`; stops at any other error. Logs one line when it does anything other than find the index there.
 * Never throws, never rejects, never drops anything.
 * → Promise<{ outcome: 'present' | 'created' | 'not-created' | 'gave-up', code?, index? }>
 */
async function ensureSearchIndexOnBoot({ runWrite, runRead, log = () => {}, sleep = sleepMs, windowMs = 30 * 60 * 1000 } = {}) {
  const say = (m) => { try { log(m); } catch { /* never throw */ } };
  try {
    let waited = 0;
    let delay = 5000;
    for (;;) {
      try {
        const rows = ((await runRead(SHOW_INDEXES, {})) || []).filter((r) => r && typeof r === 'object');
        const named = rows.find((r) => r.name === INDEX_NAME);
        if (named && isOurs(named)) return { outcome: 'present' };
        if (named) {
          say(`[graph-search] index ${INDEX_NAME} not created: name-taken (the name is held by a full-text index with another definition; graph search reads ${INDEX_NAME} only)`);
          return { outcome: 'not-created', code: 'name-taken' };
        }
        const twin = rows.find((r) => sameSchema(r));
        if (twin) {
          say(`[graph-search] index ${INDEX_NAME} not created: equivalent-exists (${twin.name} already covers ${LABEL}'s ${PROPERTIES.join(', ')}, so Neo4j would make nothing; graph search reads ${INDEX_NAME} only)`);
          return { outcome: 'not-created', code: 'equivalent-exists', index: twin.name };
        }
        await runWrite(CREATE_INDEX, {});
        say(`[graph-search] index ${INDEX_NAME} created (a full-text index on ${LABEL}'s ${PROPERTIES.join(', ')}, for graph search; it fills by itself)`);
        return { outcome: 'created' };
      } catch (err) {
        const code = (err && err.code) || 'no-status';
        if (!retriable(err)) {
          say(`[graph-search] index ${INDEX_NAME} not created: ${code}`);
          return { outcome: 'not-created', code };
        }
        if (waited + delay > windowMs) {
          say(`[graph-search] index ${INDEX_NAME} not created: ${code} (gave up after ${Math.round(waited / 1000)} s)`);
          return { outcome: 'gave-up', code };
        }
        await sleep(delay);
        waited += delay;
        delay = Math.min(delay * 2, 60000);
      }
    }
  } catch (err) {
    say(`[graph-search] index ${INDEX_NAME} not created: ${(err && err.code) || 'no-status'}`);
    return { outcome: 'not-created', code: (err && err.code) || 'no-status' };
  }
}

/** S0: the index's state and how far it has filled, or null when it isn't there. */
async function indexState(read) {
  const rows = await read(STATE, {});
  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  if (!row) return null;
  const pct = Number(row.populationPercent);
  return { state: String(row.state), populationPercent: Number.isFinite(pct) ? pct : null };
}

module.exports = { INDEX_NAME, LABEL, PROPERTIES, ANALYZER, CREATE_INDEX, ensureSearchIndexOnBoot, indexState };
