'use strict';
/**
 * The child process of test/firmware-element-sync.test.js's IS4 to IS9 (graph-operations-first-slice #41, ADR 0041
 * Amendment 2.4): it runs the real firmware install's Pass 1 (pass1_bootstrap in src/firmware/install.js) with
 * everything that could reach a database, a relay or a key stubbed, and prints what the code did. A child of its own,
 * so the stubs it puts in require.cache never reach another suite. Adapted from the review's scratchpad simulation.
 *
 * argv[2]: a scenario, JSON: { <graph-rule element name>: <what the lookup finds> }, one of
 *   none            no element has the name
 *   own-reordered   the assistant's element, holding the file's JSON with its keys in another order
 *   own-changed     the assistant's element, holding other JSON
 *   other-only      only another author's element
 *   own-same+other  the assistant's element with the file's JSON, and another author's with other JSON
 *   other-first+own-changed  another author's element first, then the assistant's holding other JSON: install must
 *                  re-sign the assistant's, never the first row it read
 *   throws          the lookup fails
 * stdout: one line `@@RESULT@@<json>` with { createElement, regenerateJson, loadTAKey, lookups, otherConcepts,
 *   errors, log }.
 *
 * The stubs:
 *   - src/lib/neo4j-driver.js: runCypher answers install's lookup of a graph-rule element by name from the scenario,
 *     and anything else with no rows; writeCypher records and answers nothing. No driver is ever made.
 *   - src/api/normalize/helpers.js: loadTAKey and regenerateJson record their calls; anything that would sign,
 *     publish or import throws.
 *   - src/api/neo4j/eventSync.js: throws if Pass 1 calls it.
 *   - src/utils/assistantKeys.js: the assistant's pubkey is a made-up one.
 *   - global fetch: answers install's calls to the control panel (create-concept, create-element, the Cypher route)
 *     in-process, and records them; nothing leaves the process.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const REPO = path.resolve(__dirname, '../..');
const TA = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const ELEMENTS = path.join(REPO, 'firmware/versions/v1.0.0/concepts/graph-rule/elements');

const scenario = JSON.parse(process.argv[2] || '{}');
const calls = { lookups: [], regenerateJson: [], loadTAKey: 0, posts: [] };

function stub(rel, exportsObj) {
  const file = require.resolve(path.join(REPO, rel));
  const m = new Module(file, module);
  m.filename = file;
  m.loaded = true;
  m.exports = exportsObj;
  require.cache[file] = m;
}
const unexpected = (what) => () => { throw new Error(`${what} is not expected in Pass 1b (pass1bChild)`); };

const fileJson = (name) => JSON.parse(fs.readFileSync(path.join(ELEMENTS, `${name}.json`), 'utf8'));
function rowsFor(name) {
  const own = `39999:${TA}:${name}-1b2c3b2d`;
  const theirs = `39999:${OTHER}:${name}-99999999`;
  const j = fileJson(name);
  const same = JSON.stringify(j);
  const reordered = JSON.stringify({ graphRule: j.graphRule, word: j.word });
  const changed = JSON.stringify({ ...j, graphRule: { ...j.graphRule, says: `${j.graphRule.says} (edited)` } });
  switch (scenario[name] || 'none') {
    case 'none': return [];
    case 'own-reordered': return [{ uuid: own, json: reordered }];
    case 'own-changed': return [{ uuid: own, json: changed }];
    case 'other-only': return [{ uuid: theirs, json: changed }];
    case 'own-same+other': return [{ uuid: theirs, json: changed }, { uuid: own, json: same }];
    case 'other-first+own-changed': return [{ uuid: theirs, json: changed }, { uuid: own, json: changed }];
    case 'throws': throw new Error('the graph database is unreachable (pass1bChild)');
    default: throw new Error(`pass1bChild: unknown scenario ${scenario[name]}`);
  }
}

stub('src/lib/neo4j-driver.js', {
  runCypher: async (q, p) => {
    if (/\$name\b/.test(q) && p && typeof p.name === 'string') {
      calls.lookups.push({ name: p.name, header: p.header });
      return rowsFor(p.name);
    }
    return [];
  },
  writeCypher: async () => [],
  streamCypher: unexpected('streamCypher'),
  getDriver: unexpected('a driver'),
});
stub('src/api/normalize/helpers.js', {
  randomDTag: () => 'deadbeef',
  deriveSlug: (n) => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  loadTAKey: async () => { calls.loadTAKey++; },
  signAndFinalize: unexpected('signAndFinalize'),
  publishToStrfry: unexpected('publishToStrfry'),
  importEventDirect: unexpected('importEventDirect'),
  regenerateJson: async (uuid, json) => { calls.regenerateJson.push({ uuid, json }); return { id: 'x' }; },
});
stub('src/api/neo4j/eventSync.js', { buildImportCypher: unexpected('buildImportCypher'), executeCypher: unexpected('executeCypher') });
stub('src/utils/assistantKeys.js', {
  getOwnerAssistantPubkey: () => TA,
  getOwnerAssistantKeys: async () => null,
  getAssistantKeys: async () => null,
  getAssistantPubkeyFor: () => null,
  listInstanceAssistants: () => [],
  countInstanceCustomers: () => 0,
});

globalThis.fetch = async (url, opts = {}) => {
  const endpoint = String(url).replace(/^https?:\/\/[^/]+/, '');
  const body = opts.body ? JSON.parse(opts.body) : {};
  calls.posts.push({ endpoint, concept: body.concept, name: body.name });
  let answer = { success: true };
  if (endpoint === '/api/normalize/create-concept') answer = { success: true, concept: { uuid: `39998:${TA}:${body.dTag}` } };
  else if (endpoint === '/api/normalize/create-element') answer = { success: true, element: { uuid: `39999:${TA}:${body.name}-created` } };
  else if (endpoint === '/api/neo4j/query') answer = { success: true, data: [], cypherResults: '' };
  return { ok: true, status: 200, json: async () => answer };
};

(async () => {
  const log = [];
  for (const level of ['log', 'warn', 'error', 'info']) console[level] = (...a) => log.push(a.map(String).join(' '));
  const install = require(path.join(REPO, 'src/firmware/install.js'));
  const out = await install.pass1_bootstrap({});
  const creates = calls.posts.filter((c) => c.endpoint === '/api/normalize/create-element');
  process.stdout.write(`@@RESULT@@${JSON.stringify({
    ta: TA,
    createElement: creates.filter((c) => c.concept === 'graph rule').map((c) => c.name),
    otherConcepts: { createElement: creates.filter((c) => c.concept !== 'graph rule').length, lookups: calls.lookups.filter((l) => !fs.existsSync(path.join(ELEMENTS, `${l.name}.json`))).length },
    regenerateJson: calls.regenerateJson.map((r) => ({ uuid: r.uuid, name: r.json && r.json.graphRule && r.json.graphRule.name, json: r.json })),
    loadTAKey: calls.loadTAKey,
    lookups: calls.lookups,
    errors: (out && out.errors) || [],
    log: log.filter((l) => /graph-rule|Already in line|Re-signed|Not made|❌/.test(l)),
  })}\n`);
})().catch((e) => { process.stdout.write(`@@RESULT@@${JSON.stringify({ threw: String((e && e.stack) || e) })}\n`); });
