'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createComposeBackend } = require('../backends/compose');
const { parseEnv } = require('../lib/render');
const { tempDir } = require('./helpers');

const owner = 'a'.repeat(64);
const config = {
  baseDomain: 'tapestry.test', image: 'img', searchImage: 'search', imageTag: 'dogfood',
  neo4jHeapMb: 768, neo4jCacheMb: 512, neo4jTxMaxMb: 384, readyTimeoutSeconds: 0.05, readyPollSeconds: 0,
};

function setup({ ready = () => true, failOn = () => false } = {}) {
  const brainsDir = tempDir();
  const commands = [];
  const run = async (file, args, options) => {
    const line = [file, ...args].join(' ');
    commands.push(line);
    if (!options || !options.timeout) throw new Error(`no timeout on: ${line}`);
    if (line.includes('/api/ready') && !ready(line)) throw new Error('not ready');
    const failure = failOn(line);
    if (failure) throw new Error(failure === true ? `failed: ${line}` : failure);
    return { stdout: '', stderr: '' };
  };
  const backend = createComposeBackend({
    brainsDir, caddyContainer: 'edge-caddy', template: 'name: brain-${SLUG}\n', getConfig: () => config, run, sleep: async () => {},
  });
  return { backend, brainsDir, commands };
}
const has = (commands, text) => commands.some((c) => c.includes(text));

test('create writes the files, starts the stack, attaches Caddy, and waits for ready', async () => {
  const { backend, brainsDir, commands } = setup();
  await backend.create({ slug: 'avi', ownerPubkey: owner, imageTag: 'dogfood' });
  const dir = path.join(brainsDir, 'avi');
  assert.equal(fs.readFileSync(path.join(dir, 'docker-compose.yml'), 'utf8'), 'name: brain-${SLUG}\n');
  const env = parseEnv(fs.readFileSync(path.join(dir, '.env'), 'utf8'));
  assert.equal(env.OWNER_PUBKEY, owner);
  assert.match(env.NEO4J_PASSWORD, /^[0-9a-f]{32}$/);
  assert.equal(fs.statSync(path.join(dir, '.env')).mode & 0o777, 0o600);
  const up = commands.findIndex((c) => c.includes(' up -d'));
  const attach = commands.findIndex((c) => c === 'docker network connect brain-avi_default edge-caddy');
  const wait = commands.findIndex((c) => c.includes('docker exec brain-avi-tapestry curl -sf --max-time 30 http://localhost/api/ready'));
  assert.ok(up >= 0 && up < attach && attach < wait, commands.join('\n'));
  assert.match(commands[up], /docker compose -p brain-avi /);
  assert.match(commands[up], /--pull missing/);
});

test('the password never reaches the log', async () => {
  const { backend, brainsDir } = setup();
  await backend.create({ slug: 'avi', ownerPubkey: owner, imageTag: 'dogfood' });
  const pw = parseEnv(fs.readFileSync(path.join(brainsDir, 'avi/.env'), 'utf8')).NEO4J_PASSWORD;
  assert.ok(!fs.readFileSync(path.join(brainsDir, 'avi/create.log'), 'utf8').includes(pw));
});

test('every command is written to create.log with a timestamp', async () => {
  const { backend, brainsDir } = setup();
  await backend.create({ slug: 'avi', ownerPubkey: owner, imageTag: 'dogfood' });
  assert.match(fs.readFileSync(path.join(brainsDir, 'avi/create.log'), 'utf8'), /^\d{4}-\d{2}-\d{2}T.*docker compose/m);
});

test('a brain that never gets ready fails with a clear error', async () => {
  const { backend } = setup({ ready: () => false });
  await assert.rejects(backend.create({ slug: 'avi', ownerPubkey: owner, imageTag: 'dogfood' }), /did not get ready/);
});

test('attaching Caddy when it is already attached is fine, and any other network error is not', async () => {
  const already = setup({ failOn: (l) => l.startsWith('docker network connect') && 'endpoint already exists in network' });
  await already.backend.create({ slug: 'avi', ownerPubkey: owner, imageTag: 'dogfood' });
  const broken = setup({ failOn: (l) => l.startsWith('docker network connect') && 'no such network' });
  await assert.rejects(broken.backend.create({ slug: 'avi', ownerPubkey: owner, imageTag: 'dogfood' }), /no such network/);
});

test('destroy detaches Caddy first, then removes containers and keeps volumes', async () => {
  const { backend, brainsDir, commands } = setup();
  await backend.create({ slug: 'avi', ownerPubkey: owner, imageTag: 'dogfood' });
  commands.length = 0;
  await backend.destroy('avi');
  assert.equal(commands[0], 'docker network disconnect brain-avi_default edge-caddy');
  assert.ok(commands[1].endsWith(' down'), commands[1]);
  assert.ok(!commands.some((c) => c.includes('-v')), 'destroy must not remove volumes');
  assert.ok(fs.existsSync(path.join(brainsDir, 'avi/.env')));
});

test('destroy still goes ahead if Caddy was not attached', async () => {
  const { backend, commands } = setup({ failOn: (l) => l.startsWith('docker network disconnect') });
  fs.mkdirSync(path.join(backend.brainsDir, 'avi'));
  await backend.destroy('avi');
  assert.ok(has(commands, ' down'));
});

test('purge removes the volumes and the directory', async () => {
  const { backend, brainsDir, commands } = setup();
  await backend.create({ slug: 'avi', ownerPubkey: owner, imageTag: 'dogfood' });
  commands.length = 0;
  await backend.purge('avi');
  assert.ok(has(commands, ' down -v'));
  assert.equal(fs.existsSync(path.join(brainsDir, 'avi')), false);
});

test('purge on a brain with no directory is fine', async () => {
  const { backend, commands } = setup();
  await backend.purge('avi');
  assert.deepEqual(commands.filter((c) => c.includes('down')), []);
});

test('the backend refuses a slug that could leave the brains directory', async () => {
  const { backend } = setup();
  await assert.rejects(backend.purge('../etc'), /bad slug/);
  await assert.rejects(backend.create({ slug: '../etc', ownerPubkey: owner, imageTag: 'x' }), /bad slug/);
});

test('restore keeps the password, picks up the current template and image tag, and waits for ready', async () => {
  const { backend, brainsDir, commands } = setup();
  await backend.create({ slug: 'avi', ownerPubkey: owner, imageTag: 'dogfood' });
  const envFile = path.join(brainsDir, 'avi/.env');
  const before = parseEnv(fs.readFileSync(envFile, 'utf8')).NEO4J_PASSWORD;
  fs.writeFileSync(path.join(brainsDir, 'avi/docker-compose.yml'), 'old');
  commands.length = 0;
  await backend.restore({ slug: 'avi', imageTag: 'sha-abc' });
  const env = parseEnv(fs.readFileSync(envFile, 'utf8'));
  assert.equal(env.NEO4J_PASSWORD, before);
  assert.equal(env.IMAGE_TAG, 'sha-abc');
  assert.equal(env.OWNER_PUBKEY, owner);
  assert.equal(fs.readFileSync(path.join(brainsDir, 'avi/docker-compose.yml'), 'utf8'), 'name: brain-${SLUG}\n');
  assert.ok(has(commands, ' up -d'));
  assert.ok(has(commands, 'docker network connect'));
  assert.ok(has(commands, '/api/ready'));
});

test('restore keeps a wrong password as it is, so a broken brain stays broken and shows up', async () => {
  const { backend, brainsDir } = setup();
  await backend.create({ slug: 'avi', ownerPubkey: owner, imageTag: 'dogfood' });
  const envFile = path.join(brainsDir, 'avi/.env');
  fs.writeFileSync(envFile, fs.readFileSync(envFile, 'utf8').replace(/NEO4J_PASSWORD=.*/, 'NEO4J_PASSWORD=wrong'));
  await backend.restore({ slug: 'avi', imageTag: 'dogfood' });
  assert.equal(backend.readPassword('avi'), 'wrong');
});

test('ensureUp starts the stack and attaches Caddy without waiting for ready', async () => {
  const { backend, commands } = setup();
  await backend.create({ slug: 'avi', ownerPubkey: owner, imageTag: 'dogfood' });
  commands.length = 0;
  await backend.ensureUp('avi');
  assert.ok(has(commands, ' up -d --no-recreate'), 'it must not move a brain to a new image with no ready check');
  assert.ok(has(commands, 'docker network connect'));
  assert.ok(!has(commands, '/api/ready'));
});

test('pullImages pulls both images at the tag', async () => {
  const { backend, commands } = setup();
  await backend.pullImages('sha-abc');
  assert.deepEqual(commands, ['docker pull img:sha-abc', 'docker pull search:sha-abc']);
});

test('readLog gives the tail, and nothing when there is no log', async () => {
  const { backend, brainsDir } = setup();
  assert.equal(backend.readLog('avi'), '');
  fs.mkdirSync(path.join(brainsDir, 'avi'));
  fs.writeFileSync(path.join(brainsDir, 'avi/create.log'), Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n'));
  const tail = backend.readLog('avi');
  assert.ok(tail.includes('line 99'));
  assert.ok(!tail.includes('line 0\n'));
});
