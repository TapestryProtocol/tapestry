'use strict';
/**
 * The child process of test/schema-save-finds-the-right-header.test.js (graph-operations-foundation #10): it runs the
 * real schema-save code over a fake graph and prints what the code wrote. A child of its own, so the stubs it puts in
 * require.cache never reach another suite.
 *
 * stdin: { kind, graph: { nodes, rels }, taPrivkey, body? }
 *   kind 'saveSchema'         — POST /api/normalize/save-schema with `body`, the handler registerNormalizeRoutes registers
 *   kind 'applyEnumerations'  — POST /api/normalize/apply-enumerations with `body`
 *   kind 'pass2'              — the firmware install's Pass 2 (pass2_enrich in src/firmware/install.js). Its calls to the
 *                               control panel are answered in-process: POST /api/neo4j/query by the fake graph, and
 *                               POST /api/normalize/save-schema by the real handler
 * stdout: one line `@@RESULT@@<json>` with { results, writes, published, unread, log }.
 *
 * The stubs:
 *   - src/lib/neo4j-driver.js: every read runs on the fake graph (test/helpers/pathCypherFake.js), as Neo4j would. A read
 *     the fake can't run throws its "can't run this Cypher" message and is listed in `unread`. Every writeCypher is
 *     recorded with its parameters. A write that re-creates a node's json tag (parameters eventUuid, type 'json', value)
 *     is also applied to the fake graph, so a later read in the same request sees the json the save wrote.
 *   - child_process.exec: `strfry import` records each event it is given, in `published`; nothing is launched. The
 *     other child_process launchers, and fetch to anywhere but the in-process routes above, throw.
 *   - src/utils/assistantKeys.js: the Tapestry Assistant is the key in `taPrivkey`.
 *   - src/lib/tapestry-store.js: an in-memory cache, holding the `store` entries the scenario gives (apply-enumerations
 *     reads each element's Tapestry JSON from it).
 *   - require('/usr/local/lib/node_modules/brainstorm/…'), the container's path, resolves inside this checkout.
 * So the tests read where a save landed from what was written and published, not from the query text.
 */

const path = require('path');
const Module = require('module');
const childProcess = require('child_process');
const { EventEmitter } = require('events');

const ROOT = path.resolve(__dirname, '../..');
const { runPathQuery } = require('./pathCypherFake');

// The relationship types the schema-save code reads over (the firmware's aliases).
const TYPES = ['HAS_TAG', 'IS_THE_JSON_SCHEMA_FOR', 'IS_THE_PRIMARY_PROPERTY_FOR', 'IS_THE_CONCEPT_FOR', 'IS_A_SUPERSET_OF',
  'HAS_ELEMENT', 'ENUMERATES', 'IS_A_PROPERTY_OF'];

const PREFIX = '/usr/local/lib/node_modules/brainstorm/';
const resolve0 = Module._resolveFilename;
Module._resolveFilename = function resolveInCheckout(request, ...rest) {
  if (typeof request === 'string' && request.startsWith(PREFIX)) request = path.join(ROOT, request.slice(PREFIX.length));
  return resolve0.call(this, request, ...rest);
};

function stubModule(file, exportsObj) {
  const m = new Module(file, module);
  m.filename = file;
  m.loaded = true;
  m.exports = exportsObj;
  require.cache[file] = m;
}

const oneLine = (q) => String(q).replace(/\s+/g, ' ').trim();

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const scenario = JSON.parse(input);
  const state = {
    nodes: scenario.graph.nodes.map((n) => ({ eid: n.eid, labels: [...n.labels], props: { ...n.props } })),
    rels: scenario.graph.rels.map((r) => ({ ...r, props: { ...(r.props || {}) } })),
  };
  const out = { writes: [], published: [], unread: [], log: [] };

  // Console output from the code under test goes to `log`, so stdout carries only the result line.
  for (const level of ['log', 'warn', 'error', 'info']) console[level] = (...a) => out.log.push(a.map(String).join(' '));

  const read = (cypher, params) => {
    try {
      return runPathQuery(state, cypher, params || {}, { types: TYPES });
    } catch (err) {
      if (/the fake graph can't run this Cypher/.test(err.message)) out.unread.push(oneLine(cypher));
      throw err;
    }
  };

  /** Applies a json-tag write to the fake graph: the node's json tag now holds `value`. */
  const applyTagWrite = (params) => {
    if (!params || params.type !== 'json' || typeof params.eventUuid !== 'string') return;
    const node = state.nodes.find((n) => n.props.uuid === params.eventUuid);
    if (!node) return;
    const tagRel = state.rels.find((r) => r.type === 'HAS_TAG' && r.from === node.eid
      && (state.nodes.find((t) => t.eid === r.to) || { props: {} }).props.type === 'json');
    if (tagRel) {
      state.nodes.find((t) => t.eid === tagRel.to).props.value = params.value;
    } else {
      const eid = `json-of-${node.eid}`;
      state.nodes.push({ eid, labels: ['NostrEventTag'], props: { uuid: params.tagUuid || eid, type: 'json', value: params.value } });
      state.rels.push({ eid: `has-${eid}`, type: 'HAS_TAG', from: node.eid, to: eid, props: {} });
    }
  };

  stubModule(require.resolve(path.join(ROOT, 'src/lib/neo4j-driver')), {
    runCypher: async (cypher, params) => read(cypher, params),
    streamCypher: async (cypher, params, onRecord) => { for (const r of read(cypher, params)) onRecord(r); },
    writeCypher: async (cypher, params) => {
      out.writes.push({ cypher: oneLine(cypher), params: params || {} });
      applyTagWrite(params);
      return [];
    },
    explainCypher: async () => { throw new Error('the fake graph plans nothing (explainCypher)'); },
    getDriver: () => { throw new Error('the fake graph has no driver; use runCypher, streamCypher or writeCypher'); },
    closeDriver: async () => {},
    toJS: (x) => x,
  });

  const nt = require(path.join(ROOT, 'node_modules/nostr-tools'));
  const privBytes = Uint8Array.from(Buffer.from(scenario.taPrivkey, 'hex'));
  const taPubkey = nt.getPublicKey(privBytes);
  stubModule(require.resolve(path.join(ROOT, 'src/utils/assistantKeys')), {
    getOwnerAssistantKeys: async () => ({ privkey: scenario.taPrivkey, pubkey: taPubkey }),
    getOwnerAssistantPubkey: () => taPubkey,
  });

  const cache = new Map(Object.entries(scenario.store || {}).map(([k, data]) => [k, { updatedAt: 1700000000, data }]));
  stubModule(require.resolve(path.join(ROOT, 'src/lib/tapestry-store')), {
    get: (key) => cache.get(key) || null,
    put: async (key, data, meta = {}) => { const e = { updatedAt: 1700000000, ...meta, data }; cache.set(key, e); return e; },
    remove: async (key) => { cache.delete(key); },
    stats: () => ({ entries: cache.size }),
    listKeys: () => [...cache.keys()],
    close: async () => {},
    getDb: () => null,
  });

  // `strfry import` reads one event per line on stdin; record each, launch nothing.
  childProcess.exec = function recordStrfryImport(command, ...rest) {
    const cb = rest.find((x) => typeof x === 'function');
    const child = new EventEmitter();
    let buf = '';
    child.stdin = {
      write(s) { buf += String(s); return true; },
      end() {
        if (/strfry import/.test(command)) {
          for (const line of buf.split('\n').filter((l) => l.trim())) out.published.push(JSON.parse(line));
          process.nextTick(() => cb && cb(null, '', ''));
        } else {
          process.nextTick(() => cb && cb(Object.assign(new Error(`not launched by the test: ${command}`), { code: 'EPERM' }), '', ''));
        }
      },
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => true;
    return child;
  };
  // Nothing else is launched, and nothing leaves this process: the code under test has no business doing either here.
  const refused = (what) => () => { throw Object.assign(new Error(`${what} is refused by the test (test/helpers/saveSchemaChild.js)`), { code: 'EPERM' }); };
  for (const name of ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'execSync', 'fork']) childProcess[name] = refused(`child_process.${name}`);
  globalThis.fetch = async (url) => { throw new Error(`a network call to ${url} is refused by the test (test/helpers/saveSchemaChild.js)`); };

  const routes = {};
  const app = { get: (p, h) => { routes[`GET ${p}`] = h; }, post: (p, h) => { routes[`POST ${p}`] = h; }, use: () => {} };
  const { registerNormalizeRoutes } = require(path.join(ROOT, 'src/api/normalize'));
  await registerNormalizeRoutes(app);

  async function call(route, body) {
    const handler = routes[route];
    if (!handler) throw new Error(`${route} is not registered by registerNormalizeRoutes`);
    const res = {
      statusCode: 200, body: null,
      status(c) { this.statusCode = c; return this; },
      json(o) { this.body = o; return this; },
    };
    await handler({ method: 'POST', body: body || {}, params: {}, query: {}, headers: {} }, res);
    return { statusCode: res.statusCode, body: res.body };
  }

  const results = [];
  if (scenario.kind === 'saveSchema') {
    results.push(await call('POST /api/normalize/save-schema', scenario.body));
  } else if (scenario.kind === 'applyEnumerations') {
    results.push(await call('POST /api/normalize/apply-enumerations', scenario.body));
  } else if (scenario.kind === 'pass2') {
    globalThis.fetch = async (url, init = {}) => {
      const route = `${(init.method || 'GET').toUpperCase()} ${new URL(url).pathname}`;
      const body = init.body ? JSON.parse(init.body) : {};
      let answer;
      if (route === 'POST /api/neo4j/query') {
        try { answer = { status: 200, json: { success: true, data: read(body.cypher, body.params) } }; } catch (err) { answer = { status: 500, json: { success: false, error: err.message } }; }
      } else if (routes[route]) {
        const r = await call(route, body);
        answer = { status: r.statusCode, json: r.body };
      } else {
        answer = { status: 404, json: { success: false, error: `${route} is not answered by the test` } };
      }
      return { ok: answer.status < 400, status: answer.status, json: async () => answer.json, text: async () => JSON.stringify(answer.json) };
    };
    const { pass2_enrich } = require(path.join(ROOT, 'src/firmware/install'));
    results.push(await pass2_enrich());
  } else {
    throw new Error(`unknown scenario kind ${scenario.kind}`);
  }

  process.stdout.write(`\n@@RESULT@@${JSON.stringify({ results, ...out, taPubkey })}\n`);
}

main().catch((err) => {
  process.stdout.write(`\n@@RESULT@@${JSON.stringify({ error: String((err && err.stack) || err) })}\n`);
  process.exitCode = 1;
});
