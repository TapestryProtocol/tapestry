'use strict';
/**
 * The child process of test/operations/lifecycle/seed-firmware-record.test.js (story graph-operations-first-slice #37,
 * ADR graph-operations-first-slice/0037 Decision 6): it runs the real derive step (src/lib/tapestry-derive.js and the
 * derivers) over a graph state, every read run by test/helpers/cypherEngine.js, and prints what it cached for each key.
 * A child of its own, so the stubs it puts in require.cache never reach another suite.
 *
 *   node test/helpers/seedFirmwareDeriveChild.js <state.json> <keys.json>
 * stdout: one line `RESULT:<json>`, { out: { <tapestryKey>: <the tapestryJSON it cached, or null> } } or { error }.
 *
 * The stubs: src/lib/neo4j-driver.js (runCypher and streamCypher read the state through the engine; writeCypher writes
 * it, in memory) and src/lib/tapestry-store.js (an in-memory cache). Nothing here opens Neo4j, the LMDB or the network.
 */

for (const k of ['log', 'info', 'debug', 'warn']) console[k] = () => {};
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const E = require('./cypherEngine');
const state = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const keys = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));

function stub(rel, exportsObj) {
  const file = require.resolve(path.join(ROOT, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, children: [], paths: [], exports: exportsObj };
}
const read = async (q, p) => E.run(state, q, p || {}, { write: false }).rows;
stub('src/lib/neo4j-driver.js', {
  runCypher: read,
  streamCypher: async (q, p, on) => { for (const r of await read(q, p)) on(r); },
  writeCypher: async (q, p) => E.run(state, q, p || {}).rows,
  explainCypher: async () => { throw new Error('the engine plans nothing'); },
  getDriver: () => { throw new Error('the derive child has no driver'); },
  closeDriver: async () => {},
  toJS: (x) => x,
});
const cache = new Map();
stub('src/lib/tapestry-store.js', {
  get: (k) => cache.get(k) || null,
  put: async (k, data, meta = {}) => { const e = { updatedAt: 1700000000, ...meta, data }; cache.set(k, e); return e; },
  remove: async (k) => { cache.delete(k); },
  stats: () => ({ entries: cache.size }),
  listKeys: () => [...cache.keys()],
  close: async () => {},
  getDb: () => null,
});

(async () => {
  try {
    require(path.join(ROOT, 'src/lib/derivers')).registerAll();
    const derive = require(path.join(ROOT, 'src/lib/tapestry-derive'));
    const out = {};
    for (const key of keys) {
      await derive.deriveByKey(key);
      out[key] = (cache.get(key) || {}).data || null;
    }
    process.stdout.write(`RESULT:${JSON.stringify({ out })}\n`);
  } catch (e) {
    process.stdout.write(`RESULT:${JSON.stringify({ error: String((e && e.stack) || e) })}\n`);
  }
})();
