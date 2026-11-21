'use strict';
/**
 * The child process of test/firmware-install-leaves-tags-once.test.js (community-reference #39; ADR
 * community-reference/0035, Implementation notes §3): it runs the real firmware install's community references and the
 * edge wiring after them (install({ pass1: false, pass2: false }) in src/firmware/install.js, or pass_communityReferences
 * alone) over the Cypher engine, and prints the graph they leave. A child of its own, so the stubs it puts in
 * require.cache never reach another suite. Built on test/helpers/pass1bChild.js's pattern.
 *
 * stdin, JSON:
 *   ta            the instance's assistant: what getOwnerAssistantPubkey answers, and the author of the letters it signs
 *   graph         { nodes, rels, nextEid }: the graph before the first install
 *   strfry        the instance's strfry, as letters
 *   relay         the letters on the manifest's relay hints. The instance's own letters are there too, as its strfry
 *                 holds them when the relay is asked.
 *   installs      [{ resign, dryRun }]: each one firmware install, in order. With resign, Pass 1's part comes first: each
 *                 concept with a communityReference has its header and superset signed again from its definition,
 *                 stored in strfry and imported as create-concept does (communityStep.js's pass1Import), which Pass 1's
 *                 create-concept with overwrite does on every install. Then install({ pass1: false, pass2: false, dryRun }).
 *   direct        call pass_communityReferences() once, in place of the installs, and report the pending it returns
 *   failImportAt  an address: executeCypher refuses a batch that imports a letter there, before any of it runs, as
 *                 cypher-shell stops at a batch's first failing statement
 * stdout: one line `@@RESULT@@<json>`: { ta, graph, strfry, pending, calls, log, threw }, calls being publishes (the
 *   letters sent to /api/strfry/publish), relay (each /api/relay/external filter), scans (each /api/strfry/scan filter),
 *   signs (each letter signAndFinalize made), failedImports, and unexpected (any other route or function asked for).
 *
 * The stubs:
 *   - src/api/neo4j/eventSync.js: the real module's builders (buildImportCypher, and buildPruneCypher once it exists),
 *     with an executeCypher that runs each statement on the engine in order, each committed or rolled back on its own,
 *     as cypher-shell runs a piped batch, and stops at the first that fails.
 *   - src/lib/neo4j-driver.js: runCypher and writeCypher run on the engine; nothing makes a driver.
 *   - src/api/normalize/helpers.js: loadTAKey does nothing; signAndFinalize makes the assistant's letter, each later
 *     than the last; anything else that would sign, publish or import throws.
 *   - src/utils/assistantKeys.js: the assistant is `ta`.
 *   - global fetch: the control panel's routes install calls, answered in-process: GET /api/strfry/scan and POST
 *     /api/strfry/publish by the fake strfry, GET /api/relay/external by the fake relay, POST /api/neo4j/query on the
 *     engine (a failing statement answers 500, as the route does), and Pass 3's derive, enumeration and wiring routes with
 *     a success. Any other route is recorded as unexpected and answers 500.
 *   - child_process: launching anything throws.
 * Nothing here opens Neo4j, strfry, a relay, a file or the network.
 */

const path = require('path');
const Module = require('module');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
for (const k of ['exec', 'execFile', 'spawn', 'fork', 'execSync', 'execFileSync', 'spawnSync']) {
  childProcess[k] = () => { throw new Error(`child_process.${k} is not expected: nothing in communityStepChild launches a process`); };
}

const C = require('./communityStep');

function stub(rel, exportsObj) {
  const file = require.resolve(path.join(ROOT, rel));
  const m = new Module(file, module);
  m.filename = file;
  m.loaded = true;
  m.exports = exportsObj;
  require.cache[file] = m;
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const sc = JSON.parse(input);
  const ta = sc.ta;
  const state = { nodes: sc.graph.nodes, rels: sc.graph.rels, nextEid: sc.graph.nextEid };
  const strfry = new C.LetterStore(sc.strfry || []);
  const relay = new C.LetterStore(sc.relay || []);
  const calls = { publishes: [], relay: [], scans: [], signs: [], failedImports: [], unexpected: [] };
  const log = [];
  let clock = Math.max(1700000000, ...(sc.strfry || []).map((l) => l.created_at), ...(sc.relay || []).map((l) => l.created_at)) + 100;

  // The code under test logs to `log`, so stdout carries only the result line.
  for (const level of ['log', 'warn', 'error', 'info', 'debug']) console[level] = (...a) => log.push(a.map(String).join(' '));
  const unexpected = (what) => () => { calls.unexpected.push(what); throw new Error(`${what} is not expected (communityStepChild)`); };

  // The real builders, and an executeCypher on the engine.
  const real = C.eventSync();
  const importMark = sc.failImportAt ? `MERGE (e:NostrEvent {uuid: '${String(sc.failImportAt).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'})` : null;
  async function executeCypher(statements) {
    const list = Array.isArray(statements) ? statements : [statements];
    if (importMark && list.some((q) => String(q).includes(importMark))) {
      calls.failedImports.push(sc.failImportAt);
      throw new Error(`cypher-shell: the import of ${sc.failImportAt} failed at its first statement (communityStepChild's failImportAt)`);
    }
    for (const q of list) C.run(state, q, {});
    return '';
  }
  stub('src/api/neo4j/eventSync.js', { ...real, executeCypher });
  stub('src/lib/neo4j-driver.js', {
    runCypher: async (q, p) => C.run(state, q, p || {}).rows,
    writeCypher: async (q, p) => C.run(state, q, p || {}).rows,
    streamCypher: unexpected('streamCypher'),
    getDriver: unexpected('a Neo4j driver'),
  });
  stub('src/api/normalize/helpers.js', {
    randomDTag: () => 'deadbeef',
    deriveSlug: (n) => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    loadTAKey: async () => {},
    signAndFinalize: (t) => {
      const l = C.letter(ta, { kind: t.kind, at: t.created_at || ++clock, tags: t.tags || [], content: t.content || '' });
      calls.signs.push(l);
      return l;
    },
    publishToStrfry: unexpected('publishToStrfry'),
    importEventDirect: unexpected('importEventDirect'),
    regenerateJson: unexpected('regenerateJson'),
  });
  stub('src/utils/assistantKeys.js', {
    getOwnerAssistantPubkey: () => ta,
    getOwnerAssistantKeys: async () => null,
    getAssistantKeys: async () => null,
    getAssistantPubkeyFor: () => null,
    listInstanceAssistants: () => [],
    countInstanceCustomers: () => 0,
  });

  const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(String(url), 'http://control-panel.invalid');
    const method = String(opts.method || 'GET').toUpperCase();
    const route = `${method} ${u.pathname}`;
    const body = opts.body ? JSON.parse(opts.body) : {};
    const filter = () => JSON.parse(u.searchParams.get('filter') || '{}');
    if (route === 'GET /api/strfry/scan') { const f = filter(); calls.scans.push(f); return reply(200, { success: true, events: strfry.query(f) }); }
    if (route === 'POST /api/strfry/publish') { calls.publishes.push(body.event); strfry.put(body.event); return reply(200, { success: true }); }
    if (route === 'GET /api/relay/external') {
      const f = filter();
      calls.relay.push(f);
      const own = strfry.all().filter((l) => l.pubkey === ta);
      return reply(200, { success: true, events: new C.LetterStore([...relay.all(), ...own]).query(f) });
    }
    if (route === 'POST /api/neo4j/query') {
      try { return reply(200, { success: true, data: C.run(state, body.cypher, body.params || {}).rows, cypherResults: '' }); }
      catch (e) { return reply(500, { success: false, error: e.message }); }
    }
    if (method === 'POST' && u.pathname.startsWith('/api/tapestry-key/derive-all/')) return reply(200, { success: true });
    if (route === 'GET /api/tapestry-key/derive-status') return reply(200, { success: true, data: [] });
    if (route === 'POST /api/normalize/apply-enumerations' || route === 'POST /api/normalize/wire-implicit-elements') return reply(200, { success: true });
    calls.unexpected.push(route);
    return reply(500, { success: false, error: `${route} is not expected (communityStepChild)` });
  };

  const install = require(path.join(ROOT, 'src/firmware/install.js'));
  const firmware = require(path.join(ROOT, 'src/api/normalize/firmware.js'));
  const withReference = firmware.getManifest().concepts.filter((c) => c.communityReference && c.communityReference.headerATag);
  let pending = null;
  let threw = null;
  try {
    if (sc.direct) {
      pending = (await install.pass_communityReferences({})).pending;
    } else {
      for (const one of sc.installs || [{ resign: true }]) {
        if (one.resign) {
          for (const c of withReference) {
            for (const l of [C.letter(ta, { kind: 39998, at: ++clock, tags: C.headerTags(ta, c.slug) }), C.letter(ta, { kind: 39999, at: ++clock, tags: C.supersetTags(ta, c.slug) })]) {
              strfry.put(l);
              C.pass1Import(state, l);
            }
          }
        }
        await install.install({ pass1: false, pass2: false, dryRun: !!one.dryRun });
      }
    }
  } catch (e) {
    threw = String((e && e.stack) || e);
  }
  process.stdout.write(`@@RESULT@@${JSON.stringify({ ta, graph: state, strfry: strfry.all(), pending, calls, log, threw })}\n`);
}

main().catch((e) => { process.stdout.write(`@@RESULT@@${JSON.stringify({ threw: String((e && e.stack) || e) })}\n`); });
