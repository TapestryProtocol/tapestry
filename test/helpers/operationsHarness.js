'use strict';
/**
 * The operations harness — run as a CHILD PROCESS (`node test/helpers/operationsHarness.js <spec.json> <out.json>`),
 * never required in-process. Story graph-operations-foundation #1, ADR graph-operations-foundation/0001.
 *
 * It loads the operations module from spec.root (this checkout by default, or a throwaway copy of it) and runs
 * spec.scenarios in order. Each scenario may:
 *   - replace lifecycle status's firmware and cache parts (statusStubs: { firmware|cache: { value } | { throw } });
 *   - send requests to one of two Express apps, each on an ephemeral loopback port with express.json(), a session
 *     read from the X-Test-Session header, the REAL central auth middleware (src/middleware/auth.js) and
 *     registerOperationRoutes:
 *       'real'    — the tree's own catalog (registerOperationRoutes(app));
 *       'fixture' — the catalog at spec.fixtureDir (registerOperationRoutes(app, { dir }));
 *     each request is made as one caller: owner, admin, stranger (signed in, neither), visitor (no session) or local
 *     (loopback with no forwarding header — the direct-local caller). The others carry X-Forwarded-For, as nginx
 *     traffic does;
 *   - run the command in-process: cli.main(argv, io, opts), with opts { dir } for the fixture catalog.
 *
 * It writes { error, scenarios: [{ requests: [{ id, status, body }], cli: [{ id, code, stdout, stderr, leaked }] }],
 * runs } to <out.json>. `runs` is globalThis.__opsRuns, which fixture operations count their runs in. A missing module
 * is reported as `error`, so the parent's assertions fail with the reason.
 *
 * The parent sets BRAINSTORM_CONF_PATH (the owner, and dead Neo4j and Redis endpoints) and TAPESTRY_SETTINGS_PATH (the
 * admin list). Nothing here reaches a live instance.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const Module = require('module');

const SPEC = process.argv[2] ? path.resolve(process.argv[2]) : null;
const OUT = process.argv[3] ? path.resolve(process.argv[3]) : null;
const result = { error: null, scenarios: [], runs: {} };

function finish(code) {
  result.runs = globalThis.__opsRuns || {};
  try { fs.writeFileSync(OUT, JSON.stringify(result)); } catch (e) { process.stderr.write(`operationsHarness: cannot write ${OUT}: ${e.message}\n`); code = 2; }
  process.exit(code);
}

if (!SPEC || !OUT) { process.stderr.write('usage: node test/helpers/operationsHarness.js <spec.json> <out.json>\n'); process.exit(2); }
const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
const ROOT = path.resolve(spec.root || path.join(__dirname, '..', '..'));

// Modules that name the in-container path load from the tree under test instead.
const CONTAINER_PREFIX = '/usr/local/lib/node_modules/brainstorm/';
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (typeof request === 'string' && request.startsWith(CONTAINER_PREFIX)) request = path.join(ROOT, request.slice(CONTAINER_PREFIX.length));
  return origResolve.call(this, request, ...rest);
};

const timer = setTimeout(() => { result.error = `the harness timed out after ${spec.timeoutMs || 60000} ms`; finish(1); }, spec.timeoutMs || 60000);
timer.unref();

function need(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) throw new Error(`${rel} does not exist yet (ADR graph-operations-foundation/0001)`);
  return require(p);
}

const SESSIONS = {
  owner: () => ({ authenticated: true, pubkey: spec.owner }),
  admin: () => ({ authenticated: true, pubkey: spec.admin }),
  stranger: () => ({ authenticated: true, pubkey: spec.stranger }),
  visitor: () => null,
  local: () => null,
};

async function startApp(dir) {
  const express = require(require.resolve('express', { paths: [ROOT] }));
  const { authMiddleware } = need('src/middleware/auth.js');
  const { registerOperationRoutes } = need('src/operations/http.js');
  const app = express();
  app.use(express.json({ limit: '1mb', strict: false }));
  app.use((req, res, next) => {
    const s = req.headers['x-test-session'];
    req.session = s ? JSON.parse(s) : {};
    next();
  });
  app.use(authMiddleware);
  await (dir ? registerOperationRoutes(app, { dir }) : registerOperationRoutes(app));
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  return { server, port: server.address().port };
}

function send(port, r) {
  return new Promise((resolve) => {
    const caller = r.caller || 'visitor';
    const session = (SESSIONS[caller] || SESSIONS.visitor)();
    const headers = { 'Content-Type': 'application/json' };
    if (caller !== 'local') headers['X-Forwarded-For'] = '203.0.113.9';
    if (session) headers['X-Test-Session'] = JSON.stringify(session);
    let payload;
    if (typeof r.rawBody === 'string') payload = r.rawBody;
    else if (r.body !== undefined) payload = JSON.stringify(r.body);
    const req = http.request({ host: '127.0.0.1', port, path: r.url, method: r.method, headers }, (res) => {
      let text = '';
      res.on('data', (c) => { text += c; });
      res.on('end', () => {
        let body = text;
        try { body = JSON.parse(text); } catch { /* keep the text */ }
        resolve({ id: r.id, status: res.statusCode, body });
      });
    });
    req.on('error', (e) => resolve({ id: r.id, status: 0, body: `request error: ${e.message}` }));
    req.end(payload);
  });
}

async function runCli(scn) {
  const cli = need('src/operations/cli.js');
  let stdout = '', stderr = '', leaked = '';
  const io = {
    stdout: { write: (s) => { stdout += String(s); return true; } },
    stderr: { write: (s) => { stderr += String(s); return true; } },
  };
  // The command runs with the real console, so a console.log that reaches the process's own stdout (rather than the
  // command keeping it off stdout, ADR Decision 7) is recorded as `leaked`.
  const quiet = {};
  for (const k of QUIETED) { quiet[k] = console[k]; console[k] = ORIGINAL_CONSOLE[k]; }
  const realWrite = process.stdout.write;
  process.stdout.write = (s) => { leaked += String(s); return true; };
  let code;
  try {
    code = await (scn.catalog === 'fixture' ? cli.main(scn.argv, io, { dir: spec.fixtureDir }) : cli.main(scn.argv, io));
  } catch (e) {
    code = `threw: ${e.message}`;
  } finally {
    process.stdout.write = realWrite;
    for (const k of QUIETED) console[k] = quiet[k];
  }
  return { id: scn.id, code, stdout, stderr, leaked };
}

function applyStubs(stubs) {
  if (!stubs) return;
  const status = need('src/operations/catalog/lifecycle/status.js');
  if (!status.parts || typeof status.parts !== 'object') {
    throw new Error('lifecycle status has no `parts` object to replace (ADR graph-operations-foundation/0001 Decision 11)');
  }
  for (const [part, stub] of Object.entries(stubs)) {
    status.parts[part] = async () => {
      if (stub.throw) throw new Error(stub.throw);
      return JSON.parse(JSON.stringify(stub.value));
    };
  }
}

// Outside a command run, the loaded modules' logging goes to stderr, so the parent's captured stdout stays small.
const QUIETED = ['log', 'info', 'debug'];
const ORIGINAL_CONSOLE = {};
for (const k of QUIETED) ORIGINAL_CONSOLE[k] = console[k];

(async () => {
  for (const k of QUIETED) console[k] = (...a) => process.stderr.write(a.join(' ') + '\n');
  const apps = {};
  try {
    for (const scenario of spec.scenarios || []) {
      applyStubs(scenario.statusStubs);
      const out = { requests: [], cli: [] };
      for (const r of scenario.requests || []) {
        const which = r.app || 'real';
        if (!apps[which]) apps[which] = await startApp(which === 'fixture' ? spec.fixtureDir : null);
        out.requests.push(await send(apps[which].port, r));
      }
      for (const scn of scenario.cli || []) out.cli.push(await runCli(scn));
      result.scenarios.push(out);
    }
  } catch (e) {
    result.error = e.message;
  }
  for (const a of Object.values(apps)) a.server.close();
  finish(0);
})();
