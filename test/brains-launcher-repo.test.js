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

/* ── The publish workflow ── */

function publishWorkflow() {
  const file = path.join(REPO, '.github/workflows/publish-image.yml');
  assert(fs.existsSync(file), '.github/workflows/publish-image.yml is missing');
  return fs.readFileSync(file, 'utf8');
}

test('W1: it runs on main and by hand, never on pull requests, and never cancels a roll under way', () => {
  const wf = publishWorkflow();
  assert(/push:\s*\n\s*branches: \[[^\]]*\bmain\b[^\]]*\]/.test(wf), 'push to main is missing');
  assert(/workflow_dispatch:/.test(wf), 'workflow_dispatch is missing');
  assert(!/pull_request/.test(wf), 'it must not run on pull requests, which could reach the droplet');
  assert(/branches: \[main\]/.test(wf), 'main is the only branch that rolls the brains');
  assert(/if: github\.ref == 'refs\/heads\/main'/.test(wf), 'running it by hand from another branch must not roll them');
  assert(/cancel-in-progress: false/.test(wf), 'a newer push must not cancel a roll under way');
});

test('W2: both images are pushed as dogfood and by commit, with layer caching', () => {
  const wf = publishWorkflow();
  for (const image of ['ghcr.io/nousclawds4/tapestry', 'ghcr.io/nousclawds4/tapestry-nostr-search']) {
    assert(wf.includes(image), `${image} is missing`);
  }
  assert((wf.match(/:dogfood/g) || []).length >= 2, 'both images need the dogfood tag');
  assert((wf.match(/:sha-\$\{\{/g) || []).length >= 2, 'both images need a sha tag');
  assert((wf.match(/type=gha/g) || []).length >= 4, 'both builds need cache-from and cache-to');
  assert(/context: \.\/nostr-search/.test(wf), 'the search image builds from nostr-search/');
  assert(/packages: write/.test(wf), 'pushing to GHCR needs packages: write');
});

test('W3: the roll runs last, stops on any failure, and waits for the launcher to answer first', () => {
  const wf = publishWorkflow();
  const lastPush = wf.lastIndexOf('docker/build-push-action');
  const ssh = wf.indexOf('appleboy/ssh-action');
  assert(lastPush > -1 && ssh > lastPush, 'the roll must come after both pushes');
  const script = wf.slice(ssh);
  for (const secret of ['DEPLOY_HOST_NINJA', 'DEPLOY_USER_NINJA', 'DEPLOY_SSH_KEY_NINJA']) {
    assert(script.includes(`secrets.${secret}`), `${secret} is missing`);
  }
  assert(script.includes('set -euo pipefail'), 'a failed step must stop the script');
  const up = script.indexOf('deploy/edge/docker-compose.yml up -d --build');
  const wait = script.indexOf('cli.js list');
  const roll = script.indexOf('cli.js roll dogfood');
  assert(up > -1 && wait > up && roll > wait, 'the order must be: edge stack up, launcher answers, roll');
});

test('W4: the roll has time for three brains to each reach the 15-minute limit, as a new firmware version can make them', () => {
  const wf = publishWorkflow();
  assert(/command_timeout: 55m/.test(wf), 'command_timeout must allow three brains at 15 minutes each, plus the pull');
  assert(/name: Roll the brains[\s\S]*?timeout-minutes: 60/.test(wf), 'the step needs a timeout above command_timeout');
});

test('W5: a launcher-only change does not rebuild the brain image, which would restart every brain', () => {
  const ignored = fs.readFileSync(path.join(REPO, '.dockerignore'), 'utf8').split('\n');
  assert(ignored.includes('deploy/'), '.dockerignore must leave out deploy/');
});

/* ── The edge ── */

test('E1: www asks for its own certificate, since Caddy otherwise leaves it to the on-demand * site, which refuses it', () => {
  const caddyfile = fs.readFileSync(path.join(REPO, 'deploy/edge/Caddyfile'), 'utf8');
  const www = caddyfile.match(/^www\.[^\n]*\{\n([\s\S]*?)^\}/m);
  assert(www, 'the www site is missing');
  assert(/^\s*tls force_automate\s*$/m.test(www[1]), 'the www site needs "tls force_automate", on one line');
});

test('E2: the launcher comes back from a reboot, whatever signal it was last sent', () => {
  // `docker kill -s HUP` marks a container as manually stopped, and `unless-stopped` then leaves it down after a reboot,
  // which also stops brains answering. It did, on the droplet, on 2026-11-04.
  const edge = fs.readFileSync(path.join(REPO, 'deploy/edge/docker-compose.yml'), 'utf8');
  const launcher = edge.slice(edge.indexOf('  launcher:'), edge.indexOf('\nnetworks:'));
  assert(/restart: always/.test(launcher), 'the launcher needs restart: always');
  for (const file of ['deploy/RUNBOOK.md', 'deploy/launcher/test/integration.sh']) {
    const text = fs.readFileSync(path.join(REPO, file), 'utf8');
    assert(!text.includes('docker kill -s HUP'), `${file} must reload with: docker exec edge-launcher kill -HUP 1`);
  }
});

/* ── The owner's npub ── */

test('O1: the entrypoint works out the owner npub from any directory', () => {
  // Its own block, run from /, where the entrypoint runs and nostr-tools does not resolve by name. The pair is NIP-19's example.
  const block = ENTRYPOINT.match(/# Calculate owner npub[\s\S]*?\nfi\n/);
  assert(block, 'the owner npub block is missing');
  const script = [
    `BRAINSTORM_MODULE_BASE_DIR="${REPO}/"`,
    'OWNER_PUBKEY=3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d',
    block[0],
    'echo "$OWNER_NPUB"',
  ].join('\n');
  const out = spawnSync('bash', ['-c', script], { cwd: '/', encoding: 'utf8' }).stdout.trim();
  assert(out === 'npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6', `got "${out}"`);
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
