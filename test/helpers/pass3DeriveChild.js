'use strict';
/**
 * The child process of test/pass-3-finishes-in-minutes.test.js (graph-operations-foundation #8): it runs the real
 * rebuild code (src/lib/tapestry-derive.js, the derivers, and GET /api/tapestry-key/derive-status) over a fake graph,
 * and prints what the rebuild did. A child of its own, so the stubs it puts in require.cache never reach another suite.
 *
 * stdin: { kind, nodes, labels?, keys? }
 *   kind 'deriveAll'    — deriveAll(label) for each of `labels`, in order (Pass 3's route, POST /api/tapestry-key/derive-all/:label)
 *   kind 'deriveByKey'  — deriveByKey(key) for each of `keys` (POST /api/tapestry-key/derive/:key)
 *   kind 'deriveStatus' — the GET /api/tapestry-key/derive-status handler, as registered on an app
 * stdout: one line `@@RESULT@@<json>` with { results, puts, writes, unread }.
 *
 * The stubs:
 *   - src/lib/neo4j-driver.js: reads of one node run on the fake graph (test/helpers/nodeCypherFake.js), as Neo4j
 *     would. A read the fake can't run (a relationship pattern, OPTIONAL MATCH, UNION …) answers no rows and is listed
 *     in `unread`, so the derivers run with empty neighbourhoods. Every writeCypher is recorded with its parameters.
 *   - src/lib/tapestry-store.js: an in-memory cache that records every put.
 * So the tests read what was rebuilt from what reached the cache and the timestamp writes, not from the query text.
 */

const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DRIVER_PATH = require.resolve(path.join(ROOT, 'src/lib/neo4j-driver'));
const STORE_PATH = require.resolve(path.join(ROOT, 'src/lib/tapestry-store'));
const { runQuery } = require('./nodeCypherFake');

const FAKE_TS = 1700000000;

function stubModule(file, exportsObj) {
  const m = new (require('module'))(file, module);
  m.filename = file;
  m.loaded = true;
  m.exports = exportsObj;
  require.cache[file] = m;
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const scenario = JSON.parse(input);
  const nodes = scenario.nodes.map((n) => ({ labels: [...n.labels], props: { ...n.props } }));

  const log = { puts: [], writes: [], unread: [] };

  const read = (cypher, params) => {
    try {
      return runQuery(nodes, cypher, params || {});
    } catch (err) {
      if (/the fake graph database can't read this Cypher/.test(err.message)) {
        log.unread.push(String(cypher).replace(/\s+/g, ' ').trim());
        return [];
      }
      throw err;
    }
  };
  stubModule(DRIVER_PATH, {
    runCypher: async (cypher, params) => read(cypher, params),
    streamCypher: async (cypher, params, onRecord) => { for (const r of read(cypher, params)) onRecord(r); },
    writeCypher: async (cypher, params) => { log.writes.push({ cypher: String(cypher).replace(/\s+/g, ' ').trim(), params: params || {} }); return []; },
    explainCypher: async () => { throw new Error('the fake graph database plans nothing (explainCypher)'); },
    getDriver: () => { throw new Error('the fake graph database has no driver; use runCypher, streamCypher or writeCypher'); },
    closeDriver: async () => {},
    toJS: (x) => x,
  });

  const cache = new Map();
  stubModule(STORE_PATH, {
    get: (key) => cache.get(key) || null,
    put: async (key, data, meta = {}) => {
      const envelope = { updatedAt: FAKE_TS, ...meta, data };
      cache.set(key, envelope);
      log.puts.push({ key, rebuiltFrom: meta.rebuiltFrom || null });
      return envelope;
    },
    remove: async (key) => { cache.delete(key); },
    stats: () => ({ entries: cache.size }),
    listKeys: () => [...cache.keys()],
    close: async () => {},
    getDb: () => null,
  });

  const results = [];
  if (scenario.kind === 'deriveAll' || scenario.kind === 'deriveByKey') {
    const { registerAll } = require(path.join(ROOT, 'src/lib/derivers'));
    registerAll();
    const derive = require(path.join(ROOT, 'src/lib/tapestry-derive'));
    if (scenario.kind === 'deriveAll') {
      for (const label of scenario.labels) {
        const before = { puts: log.puts.length, writes: log.writes.length };
        const answer = await derive.deriveAll(label);
        results.push({ label, answer, puts: log.puts.slice(before.puts), writes: log.writes.slice(before.writes) });
      }
    } else {
      for (const key of scenario.keys) {
        const before = { puts: log.puts.length, writes: log.writes.length };
        const answer = await derive.deriveByKey(key);
        results.push({ key, answer: answer ? { tapestryKey: answer.tapestryKey, derivedBy: answer.derivedBy } : null,
          puts: log.puts.slice(before.puts), writes: log.writes.slice(before.writes) });
      }
    }
  } else if (scenario.kind === 'deriveStatus') {
    const routes = {};
    const app = { get: (p, h) => { routes[`GET ${p}`] = h; }, post: (p, h) => { routes[`POST ${p}`] = h; } };
    require(path.join(ROOT, 'src/api/tapestry-key')).registerTapestryKeyRoutes(app);
    const handler = routes['GET /api/tapestry-key/derive-status'];
    if (!handler) throw new Error('GET /api/tapestry-key/derive-status is not registered by registerTapestryKeyRoutes');
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; } };
    await handler({ params: {}, query: {}, body: {} }, res);
    results.push({ statusCode: res.statusCode, body: res.body });
  } else {
    throw new Error(`unknown scenario kind ${scenario.kind}`);
  }

  process.stdout.write(`\n@@RESULT@@${JSON.stringify({ results, ...log })}\n`);
}

main().catch((err) => {
  process.stdout.write(`\n@@RESULT@@${JSON.stringify({ error: String((err && err.stack) || err) })}\n`);
  process.exitCode = 1;
});
