'use strict';
/**
 * brains-launcher #1: the repo changes a launched brain needs, which any self-hoster can also use.
 * ADR:   engineering-team/decisions/brains-launcher/0001-one-droplet-compose-launcher.md
 * Story: engineering-team/stories/brains-launcher/1-launch-a-brain.md
 *
 * Stack-free. The firmware script runs for real against a stub curl on PATH. The readiness handler runs against a fake
 * install state. The entrypoint's wiring is checked on source, as test/strfry-router-first-boot-config.test.js does.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const ENTRYPOINT = fs.readFileSync(path.join(REPO, 'docker/entrypoint.sh'), 'utf8');
const COMPOSE = fs.readFileSync(path.join(REPO, 'docker-compose.yml'), 'utf8');
const FIRMWARE_SCRIPT = path.join(REPO, 'tools/firmware-on-boot.sh');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

/* ── Idle first boot ── */

test('R1: first boot does not copy the old router config, whose streams would run until the app replaced it', () => {
  assert(!/cp\s+\S*setup\/strfry-router-tapestry\.config/.test(ENTRYPOINT),
    'entrypoint.sh must not copy setup/strfry-router-tapestry.config to /etc/');
});

/* ── Firmware on first boot ── */

/** Runs the script with a stub curl. `statuses` are install-status answers, in order; the last repeats. */
function runFirmwareScript({ statuses, installResults = ['{"success":true}'], tries = 6, marker }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firmware-on-boot-'));
  const calls = path.join(dir, 'calls');
  const markerFile = path.join(dir, 'marker');
  if (marker !== undefined) fs.writeFileSync(markerFile, marker);
  fs.writeFileSync(path.join(dir, 'statuses'), statuses.join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'results'), installResults.join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'curl'), `#!/bin/bash
case "$*" in
  *-X\\ POST*)
    echo POST "\${@: -1}" >> "${calls}"
    line="$(head -n 1 "${dir}/results")"
    [ "$(wc -l < "${dir}/results")" -gt 1 ] && sed -i.bak 1d "${dir}/results"
    printf '%s' "$line"
    ;;
  *)
    echo GET "\${@: -1}" >> "${calls}"
    line="$(head -n 1 "${dir}/statuses")"
    [ "$(wc -l < "${dir}/statuses")" -gt 1 ] && sed -i.bak 1d "${dir}/statuses"
    printf '%s' "$line"
    ;;
esac
`, { mode: 0o755 });
  const out = spawnSync('bash', [FIRMWARE_SCRIPT], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, FIRMWARE_ON_BOOT_WAIT_SECONDS: '0', FIRMWARE_ON_BOOT_TRIES: String(tries), FIRMWARE_ON_BOOT_MARKER: markerFile },
  });
  const log = fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n') : [];
  const written = fs.existsSync(markerFile) ? fs.readFileSync(markerFile, 'utf8') : null;
  return { status: out.status, stdout: out.stdout, posts: log.filter((l) => l.startsWith('POST')), log, marker: written };
}

const INSTALLED = '{"success":true,"installed":true,"installedCount":3,"totalCount":3,"activeVersion":"v2"}';
const MISSING = '{"success":true,"installed":false,"installedCount":0,"totalCount":3,"activeVersion":"v2"}';
const NEO4J_DOWN = '{"success":false,"error":"connection refused"}';

test('F1: firmware this script finished installing means no install, so a restart is a no-op', () => {
  const r = runFirmwareScript({ statuses: [INSTALLED], marker: 'v2' });
  assert(r.status === 0, `exit ${r.status}`);
  assert(r.posts.length === 0, `expected no POST, got ${r.posts}`);
});

test('F2: a fresh instance installs once, then finishes and records the version', () => {
  const r = runFirmwareScript({ statuses: [MISSING, INSTALLED] });
  assert(r.status === 0, `exit ${r.status}`);
  assert(r.posts.length === 1, `expected one POST, got ${r.posts}`);
  assert(r.posts[0].endsWith('/api/firmware/install'), `posted to ${r.posts[0]}`);
  assert(r.marker === 'v2', `marker: ${r.marker}`);
});

test('F8: headers with no marker mean an install stopped partway, so it installs again', () => {
  const r = runFirmwareScript({ statuses: [INSTALLED, INSTALLED] });
  assert(r.posts.length === 1, `expected one POST, got ${r.posts}`);
  assert(r.marker === 'v2', `marker: ${r.marker}`);
});

test('F9: a failed install writes no marker', () => {
  const r = runFirmwareScript({ statuses: [INSTALLED], installResults: ['{"success":false,"error":"killed"}'], tries: 3 });
  assert(r.status !== 0, `exit ${r.status}`);
  assert(r.marker === null, `marker: ${r.marker}`);
  assert(r.posts.length === 3, `expected a try each time, got ${r.posts}`);
});

test('F10: a new firmware version installs again', () => {
  const r = runFirmwareScript({ statuses: [INSTALLED, INSTALLED], marker: 'v1' });
  assert(r.posts.length === 1, `expected one POST, got ${r.posts}`);
  assert(r.marker === 'v2', `marker: ${r.marker}`);
});

test('F3: it waits for Neo4j rather than installing against a database that is down', () => {
  const r = runFirmwareScript({ statuses: [NEO4J_DOWN, '', MISSING, INSTALLED] });
  assert(r.status === 0, `exit ${r.status}`);
  assert(r.posts.length === 1, `expected one POST, got ${r.posts}`);
  assert(r.log.indexOf(r.posts[0]) === 3, `POST came too early: ${r.log}`);
});

test('F4: a failed install is tried again', () => {
  const r = runFirmwareScript({ statuses: [MISSING, MISSING, INSTALLED], installResults: ['{"success":false,"error":"schema"}', '{"success":true}'] });
  assert(r.status === 0, `exit ${r.status}`);
  assert(r.posts.length === 2, `expected two POSTs, got ${r.posts}`);
});

test('F5: it gives up with a non-zero exit, and says so', () => {
  const r = runFirmwareScript({ statuses: [NEO4J_DOWN], tries: 3 });
  assert(r.status !== 0, 'expected a non-zero exit');
  assert(/gave up/i.test(r.stdout), `stdout: ${r.stdout}`);
});

test('F6: the entrypoint runs it only when TAPESTRY_FIRMWARE_ON_BOOT is true, and in the background', () => {
  const m = ENTRYPOINT.match(/if \[ "\$\{TAPESTRY_FIRMWARE_ON_BOOT:-\}" = "true" \]; then\n([\s\S]*?)\nfi/);
  assert(m, 'entrypoint.sh must guard the script on TAPESTRY_FIRMWARE_ON_BOOT');
  assert(/tools\/firmware-on-boot\.sh[^\n]*&\s*$/m.test(m[1]), `must run in the background: ${m[1]}`);
  assert(ENTRYPOINT.indexOf('TAPESTRY_FIRMWARE_ON_BOOT') < ENTRYPOINT.indexOf('exec /usr/bin/supervisord'),
    'the guard must come before supervisord takes over');
});

test('F7: the repo compose file does not turn it on, so existing droplets change nothing', () => {
  assert(!COMPOSE.includes('TAPESTRY_FIRMWARE_ON_BOOT'), 'docker-compose.yml must not set TAPESTRY_FIRMWARE_ON_BOOT');
});

/* ── Readiness ── */

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

test('A1: 200 when Neo4j answers and every firmware header is there', async () => {
  const { createReadyHandler } = require('../src/api/firmware/ready');
  const res = fakeRes();
  await createReadyHandler(async () => ({ installedCount: 3, totalCount: 3 }))({}, res);
  assert(res.statusCode === 200 && res.body.ready === true, JSON.stringify(res));
});

test('A2: 503 naming firmware when a header is missing', async () => {
  const { createReadyHandler } = require('../src/api/firmware/ready');
  const res = fakeRes();
  await createReadyHandler(async () => ({ installedCount: 1, totalCount: 3 }))({}, res);
  assert(res.statusCode === 503 && res.body.ready === false && res.body.unmet === 'firmware', JSON.stringify(res));
});

test('A3: 503 naming neo4j when the database does not answer, without its error text', async () => {
  const { createReadyHandler } = require('../src/api/firmware/ready');
  const res = fakeRes();
  await createReadyHandler(async () => { throw new Error('bolt://localhost secret detail'); })({}, res);
  assert(res.statusCode === 503 && res.body.unmet === 'neo4j', JSON.stringify(res));
  assert(!JSON.stringify(res.body).includes('secret detail'), 'error text must not reach the answer');
});

test('A5: with firmware on boot, headers are not enough: the install has to have finished', async () => {
  const { createReadyHandler } = require('../src/api/firmware/ready');
  const state = async () => ({ installedCount: 3, totalCount: 3, activeVersion: 'v2' });
  const call = async (readMarker) => {
    const res = fakeRes();
    await createReadyHandler(state, { onBoot: true, readMarker })({}, res);
    return res;
  };
  const none = await call(() => { throw new Error('no file'); });
  assert(none.statusCode === 503 && none.body.unmet === 'firmware', JSON.stringify(none));
  const old = await call(() => 'v1');
  assert(old.statusCode === 503 && old.body.unmet === 'firmware', JSON.stringify(old));
  const done = await call(() => 'v2\n');
  assert(done.statusCode === 200 && done.body.ready === true, JSON.stringify(done));
});

test('A6: without firmware on boot, nothing looks for the marker, so other instances behave as before', async () => {
  const { createReadyHandler } = require('../src/api/firmware/ready');
  const res = fakeRes();
  await createReadyHandler(async () => ({ installedCount: 3, totalCount: 3, activeVersion: 'v2' }), {
    onBoot: false,
    readMarker: () => { throw new Error('must not be read'); },
  })({}, res);
  assert(res.statusCode === 200, JSON.stringify(res));
});

test('A4: the route is registered and open to anyone', () => {
  const { resolveRouteAccess, ROUTE_ACCESS } = require('../src/middleware/routeAccess');
  assert(resolveRouteAccess('GET', '/api/ready') === 'public', 'must resolve to public');
  assert(ROUTE_ACCESS['GET /api/ready'].kind === 'read', 'must be a read');
  const { registerFirmwareApiRoutes } = require('../src/api/firmware');
  const seen = [];
  registerFirmwareApiRoutes({ get: (p) => seen.push(`GET ${p}`), post: (p) => seen.push(`POST ${p}`) });
  assert(seen.includes('GET /api/ready'), `registered: ${seen}`);
});

/* ── The Neo4j browser link ── */

test('B1: the entrypoint defaults NEO4J_BROWSER_URL to what droplets get today, and exports it', () => {
  assert(ENTRYPOINT.includes('NEO4J_BROWSER_URL="${NEO4J_BROWSER_URL:-http://${DOMAIN_NAME}:7474}"'), 'default missing');
  assert(/^export [^\n]*\bNEO4J_BROWSER_URL\b/m.test(ENTRYPOINT), 'export missing');
});

test('B2: the conf template reads it', () => {
  const t = fs.readFileSync(path.join(REPO, 'config/brainstorm.conf.template'), 'utf8');
  assert(t.includes('export BRAINSTORM_NEO4J_BROWSER_URL="${NEO4J_BROWSER_URL}"'), 'template must use ${NEO4J_BROWSER_URL}');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail, skipped: 0 };
}

module.exports = { run };
