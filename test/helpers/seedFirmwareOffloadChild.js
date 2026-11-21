'use strict';
/**
 * The child process behind seed-firmware.test.js's SF33 (story graph-operations-first-slice #37, review round 1,
 * Blocking 1; ADR graph-operations-first-slice/0037 Amendment 3, items 1 and 2): the Dashboard's "Offload N tags" and
 * "Derive all", run for real over a graph state, so a later harness run reads what they leave.
 *
 *   TAPESTRY_LMDB_PATH=<dir> node test/helpers/seedFirmwareOffloadChild.js <state.json> <keys.json>
 *   keys.json: { offload: [tapestryKey…], derive: [tapestryKey…] }
 *
 * 1. POST /api/tapestry-key/offload-all, the route's own handler (registerTapestryKeyRoutes), over the json tags of the
 *    nodes `offload` names: its read of the inline tags is narrowed to them, and the rest is the handler's own work, so
 *    each tag becomes lmdb:<tapestryKey>, its JSON put in the store, as the Dashboard's "Offload N tags" leaves it.
 * 2. The derive step (src/lib/tapestry-derive.js, the real derivers) for each key `derive` names: each entry is
 *    overwritten with the tapestryJSON the derive builds, a superset's word.wordTypes in the set deriver's order.
 * 3. The state is written back to <state.json>.
 * stdout: one line `RESULT:<json>`, { offloaded, derived: { <key>: <the entry's data> } } or { error }.
 *
 * The stubs: src/lib/neo4j-driver.js only (runCypher and streamCypher read the state through test/helpers/
 * cypherEngine.js; writeCypher writes it). The store is the real LMDB store, at TAPESTRY_LMDB_PATH, which the parent
 * names and later hands to the harness run. Nothing here opens Neo4j or the network.
 */

for (const k of ['log', 'info', 'debug', 'warn']) console[k] = () => {};
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const E = require('./cypherEngine');
const stateFile = process.argv[2];
const { offload = [], derive: deriveKeys = [] } = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const OFFLOAD = new Set(offload);
const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));

if (!process.env.TAPESTRY_LMDB_PATH) { process.stdout.write(`RESULT:${JSON.stringify({ error: 'TAPESTRY_LMDB_PATH must name the store the harness run will read' })}\n`); process.exit(0); }
const file = require.resolve(path.join(ROOT, 'src/lib/neo4j-driver.js'));
const read = async (q, p) => E.run(state, q, p || {}, { write: false }).rows;
/** The offload route's read of the inline json tags, narrowed to the nodes asked for. */
const isOffloadRead = (q) => /NOT tag\.value STARTS WITH 'lmdb:'/.test(String(q));
require.cache[file] = {
  id: file, filename: file, loaded: true, children: [], paths: [],
  exports: {
    runCypher: async (q, p) => { const rows = await read(q, p); return isOffloadRead(q) ? rows.filter((r) => OFFLOAD.has(r.tapestryKey)) : rows; },
    streamCypher: async (q, p, on) => { for (const r of await read(q, p)) on(r); },
    writeCypher: async (q, p) => E.run(state, q, p || {}, { atomic: false }).rows,
    getDriver: () => { throw new Error('the offload child has no driver'); },
    closeDriver: async () => {},
    toJS: (x) => x,
  },
};

(async () => {
  try {
    const routes = {};
    const app = { get: (p, h) => { routes[`GET ${p}`] = h; }, post: (p, h) => { routes[`POST ${p}`] = h; }, put: () => {}, delete: () => {} };
    require(path.join(ROOT, 'src/api/tapestry-key')).registerTapestryKeyRoutes(app);
    const offloadAll = routes['POST /api/tapestry-key/offload-all'];
    if (!offloadAll) throw new Error('POST /api/tapestry-key/offload-all is not registered by registerTapestryKeyRoutes');
    const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; } };
    await offloadAll({ params: {}, query: {}, body: {} }, res);
    if (!res.body || res.body.success !== true) throw new Error(`offload-all answered ${res.statusCode} ${JSON.stringify(res.body).slice(0, 300)}`);
    require(path.join(ROOT, 'src/lib/derivers')).registerAll();
    const derive = require(path.join(ROOT, 'src/lib/tapestry-derive'));
    const store = require(path.join(ROOT, 'src/lib/tapestry-store'));
    const derived = {};
    for (const key of deriveKeys) {
      await derive.deriveByKey(key);
      const entry = store.get(key);
      derived[key] = entry ? entry.data : null;
    }
    fs.writeFileSync(stateFile, JSON.stringify(state));
    if (typeof store.close === 'function') await store.close();
    process.stdout.write(`RESULT:${JSON.stringify({ offloaded: res.body.data.offloaded, errors: res.body.data.errors, derived })}\n`);
  } catch (e) {
    process.stdout.write(`RESULT:${JSON.stringify({ error: String((e && e.stack) || e) })}\n`);
  }
})();
