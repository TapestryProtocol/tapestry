'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createControlHandler } = require('../lib/control');
const { tempDir } = require('./helpers');

const CLI = path.join(__dirname, '../cli.js');

function fakeBrains(overrides = {}) {
  const calls = [];
  return {
    calls,
    roll: async (tag, say) => { calls.push(['roll', tag]); say('updating one'); return { ok: true, rolled: ['one'] }; },
    reap: async () => { calls.push(['reap']); return ['old']; },
    reconcile: async () => { calls.push(['reconcile']); },
    list: () => [{ slug: 'one', status: 'running', ownerLabel: 'Ana', url: 'https://one.test', reapAfter: null }],
    ...overrides,
  };
}

async function withControl(brains, fn) {
  const socket = path.join(tempDir(), 'control.sock');
  const server = http.createServer(createControlHandler({ brains, log: () => {} }));
  await new Promise((r) => server.listen(socket, r));
  try {
    await fn(socket);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
}

function cli(socket, ...args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { env: { ...process.env, LAUNCHER_CONTROL_SOCKET: socket } });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('close', (code) => resolve({ code, out }));
  });
}

test('roll reaches the service, prints its progress, and exits 0', async () => {
  const brains = fakeBrains();
  await withControl(brains, async (socket) => {
    const r = await cli(socket, 'roll', 'sha-abc');
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /updating one/);
    assert.deepEqual(brains.calls, [['roll', 'sha-abc']]);
  });
});

test('roll with no tag uses dogfood', async () => {
  const brains = fakeBrains();
  await withControl(brains, async (socket) => {
    await cli(socket, 'roll');
    assert.deepEqual(brains.calls, [['roll', 'dogfood']]);
  });
});

test('a roll that stopped on a brain exits non-zero, naming it', async () => {
  const brains = fakeBrains({ roll: async () => ({ ok: false, failed: 'two', rolled: ['one'] }) });
  await withControl(brains, async (socket) => {
    const r = await cli(socket, 'roll');
    assert.notEqual(r.code, 0);
    assert.match(r.out, /two/);
  });
});

test('a roll that blows up exits non-zero', async () => {
  const brains = fakeBrains({ roll: async () => { throw new Error('boom'); } });
  await withControl(brains, async (socket) => {
    assert.notEqual((await cli(socket, 'roll')).code, 0);
  });
});

test('reap and reconcile reach the service', async () => {
  const brains = fakeBrains();
  await withControl(brains, async (socket) => {
    const reap = await cli(socket, 'reap');
    assert.equal(reap.code, 0, reap.out);
    assert.match(reap.out, /old/);
    assert.equal((await cli(socket, 'reconcile')).code, 0);
    assert.deepEqual(brains.calls, [['reap'], ['reconcile']]);
  });
});

test('list prints the brains', async () => {
  await withControl(fakeBrains(), async (socket) => {
    const r = await cli(socket, 'list');
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /one\s+running\s+Ana/);
  });
});

test('an unknown command prints usage and exits non-zero', async () => {
  await withControl(fakeBrains(), async (socket) => {
    const r = await cli(socket, 'nope');
    assert.notEqual(r.code, 0);
    assert.match(r.out, /roll.*reap.*reconcile.*list/);
  });
});

test('a connection dropped partway exits non-zero, so a crash mid-roll never reads as success', async () => {
  const socket = path.join(tempDir(), 'dropping.sock');
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.write('updating one\n');
    setTimeout(() => res.destroy(), 20);
  });
  await new Promise((r) => server.listen(socket, r));
  try {
    const r = await cli(socket, 'roll');
    assert.notEqual(r.code, 0, r.out);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});

test('a launcher that is not running is a clear error', async () => {
  const r = await cli(path.join(tempDir(), 'nothing.sock'), 'list');
  assert.notEqual(r.code, 0);
  assert.match(r.out, /launcher/i);
});
