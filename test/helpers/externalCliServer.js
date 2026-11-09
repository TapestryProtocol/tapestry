'use strict';
/**
 * A Tapestry instance for the external CLI's suite — run as a CHILD PROCESS, never required in-process:
 *
 *   node test/helpers/externalCliServer.js <spec.json>
 *
 * Story graph-operations-foundation #6, ADR graph-operations-foundation/0006.
 *
 * It serves, on an ephemeral loopback port, what the CLI talks to on a real instance:
 *   - express.json() and a real express-session (its MemoryStore, so the CLI's cookie is a real one);
 *   - the REAL central auth middleware (src/middleware/auth.js);
 *   - the REAL sign-in handlers: POST /api/auth/verify-user, /api/auth/login-user and /api/auth/logout;
 *   - registerOperationRoutes over the fixture catalog at spec.catalogDir.
 * Every request carries X-Forwarded-For before the central check sees it, as nginx traffic does, so no request is
 * trusted as a direct-local caller: the CLI has to sign in, as it does on a real instance.
 *
 * Every request the instance receives is appended to spec.recordFile as one JSON line:
 *   { method, path, url, headers: { cookie, 'user-agent', 'content-type', accept }, body }
 *
 * A second loopback port takes the suite's own controls, which the CLI never sees:
 *   POST /forget          drop every session, as an instance does when its sign-ins expire or its store is lost
 *   POST /forget-always   ?on=1|0: drop every session before each call under /api/tapestry/, so a sign-in completes
 *                         but never sticks
 *   GET  /runs            how many times each fixture operation ran (globalThis.__opsRuns)
 *
 * spec.mode 'html' answers every request with an HTML page, and 'redirect' with a 302 to spec.redirectTo: stand-ins
 * for something that isn't a Tapestry instance.
 *
 * When both ports listen it prints `externalCliServer-ready { port, control }` on stdout, and keeps running until killed. The
 * parent sets BRAINSTORM_CONF_PATH (the owner, and dead Neo4j and Redis endpoints) and TAPESTRY_SETTINGS_PATH (the
 * admin list), as test/operations.test.js does. Nothing here reaches a live instance.
 */

const fs = require('fs');
const http = require('http');
const path = require('path');

const SPEC = process.argv[2] ? path.resolve(process.argv[2]) : null;
if (!SPEC) { process.stderr.write('usage: node test/helpers/externalCliServer.js <spec.json>\n'); process.exit(2); }
const spec = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
const ROOT = path.resolve(spec.root || path.join(__dirname, '..', '..'));
const fromRoot = (name) => require(require.resolve(name, { paths: [ROOT] }));

function record(req) {
  const h = req.headers || {};
  const line = {
    method: req.method,
    path: req.path,
    url: req.originalUrl,
    headers: { cookie: h.cookie || null, 'user-agent': h['user-agent'] || null, 'content-type': h['content-type'] || null, accept: h.accept || null },
    body: req.body === undefined ? null : req.body,
  };
  fs.appendFileSync(spec.recordFile, `${JSON.stringify(line)}\n`);
}

let forgetAlways = false;

async function main() {
  const express = fromRoot('express');
  const session = fromRoot('express-session');
  const app = express();
  const store = new session.MemoryStore();

  if (spec.mode === 'html' || spec.mode === 'redirect') {
    app.use(express.json({ limit: '1mb', strict: false }));
    app.use((req, res) => {
      record(req);
      if (spec.mode === 'redirect') return res.redirect(302, spec.redirectTo);
      return res.status(200).type('html').send('<!doctype html><html><body>Not a Tapestry instance</body></html>');
    });
  } else {
    const { authMiddleware, handleAuthVerifyUser, handleAuthLoginUser, handleAuthLogout } = require(path.join(ROOT, 'src/middleware/auth.js'));
    const { registerOperationRoutes } = require(path.join(ROOT, 'src/operations/http.js'));
    app.use(express.json({ limit: '1mb', strict: false }));
    app.use((req, res, next) => { record(req); next(); });
    // Every request arrives as nginx forwards it, so the central check never trusts it as direct-local.
    app.use((req, res, next) => { req.headers['x-forwarded-for'] = '203.0.113.7'; next(); });
    // forget-always drops the sessions before each operation call only, so a sign-in itself still completes.
    app.use((req, res, next) => (forgetAlways && req.path.startsWith('/api/tapestry/') ? store.clear(() => next()) : next()));
    app.use(session({ store, secret: 'external-cli-suite', resave: false, saveUninitialized: false, cookie: { secure: false } }));
    app.use(authMiddleware);
    app.post('/api/auth/verify-user', handleAuthVerifyUser);
    app.post('/api/auth/login-user', handleAuthLoginUser);
    app.post('/api/auth/logout', handleAuthLogout);
    registerOperationRoutes(app, { dir: spec.catalogDir });
  }

  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });

  const control = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://control');
    const done = (body) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (req.method === 'POST' && url.pathname === '/forget') return store.clear(() => done({ forgotten: true }));
    if (req.method === 'POST' && url.pathname === '/forget-always') { forgetAlways = url.searchParams.get('on') === '1'; return done({ forgetAlways }); }
    if (req.method === 'GET' && url.pathname === '/runs') return done(globalThis.__opsRuns || {});
    res.writeHead(404); return res.end();
  });
  await new Promise((resolve) => control.listen(0, '127.0.0.1', resolve));

  // Prefixed, because the modules above may log to stdout too.
  process.stdout.write(`externalCliServer-ready ${JSON.stringify({ port: server.address().port, control: control.address().port })}\n`);
}

main().catch((err) => {
  process.stderr.write(`externalCliServer: ${(err && err.stack) || err}\n`);
  process.exit(1);
});
