'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createConfig } = require('../lib/config');
const { tempDir } = require('./helpers');

const A = 'a'.repeat(64);

function dir({ allowlist = [{ pubkey: A, label: 'Ana' }], launcher = {} } = {}) {
  const d = tempDir();
  fs.writeFileSync(path.join(d, 'allowlist.json'), JSON.stringify(allowlist));
  fs.writeFileSync(path.join(d, 'launcher.json'), JSON.stringify(launcher));
  return d;
}

test('reads the allowlist and fills in defaults', () => {
  const c = createConfig({ configDir: dir() }).current();
  assert.deepEqual(c.allowlist, [{ pubkey: A, label: 'Ana' }]);
  assert.equal(c.baseDomain, 'tapestry.ninja');
  assert.equal(c.imageTag, 'dogfood');
  assert.equal(c.image, 'ghcr.io/nousclawds4/tapestry');
  assert.equal(c.searchImage, 'ghcr.io/nousclawds4/tapestry-nostr-search');
  assert.equal(c.maxBrainsPerOwner, 3);
  assert.equal(c.maxBrainsTotal, 3);
  assert.equal(c.minFreeDiskGb, 10);
  assert.equal(c.graceDays, 7);
  assert.equal(c.neo4jHeapMb, 768);
  assert.equal(c.neo4jCacheMb, 512);
  assert.equal(c.neo4jTxMaxMb, 384);
  assert.equal(c.readyTimeoutSeconds, 300);
  assert.equal(c.readyPollSeconds, 5);
});

test('launcher.json overrides the defaults', () => {
  const c = createConfig({ configDir: dir({ launcher: { maxBrainsTotal: 7, baseDomain: 'x.test' } }) }).current();
  assert.equal(c.maxBrainsTotal, 7);
  assert.equal(c.baseDomain, 'x.test');
  assert.equal(c.baseUrl, 'https://x.test');
});

test('refuses to start on a bad allowlist', () => {
  assert.throws(() => createConfig({ configDir: dir({ allowlist: [{ pubkey: 'npub1nothex', label: 'x' }] }) }), /hex/);
  assert.throws(() => createConfig({ configDir: dir({ allowlist: { pubkey: A } }) }), /array/);
});

test('reload picks up an edited file', () => {
  const d = dir();
  const config = createConfig({ configDir: d });
  fs.writeFileSync(path.join(d, 'allowlist.json'), JSON.stringify([{ pubkey: 'b'.repeat(64), label: 'Bo' }]));
  config.reload();
  assert.equal(config.current().allowlist[0].label, 'Bo');
});

test('a reload onto a broken file keeps the last good config', () => {
  const d = dir();
  const config = createConfig({ configDir: d, log: () => {} });
  fs.writeFileSync(path.join(d, 'allowlist.json'), '{ broken');
  config.reload();
  assert.equal(config.current().allowlist[0].label, 'Ana');
});

test('isAllowed checks the list', () => {
  const config = createConfig({ configDir: dir() });
  assert.equal(config.isAllowed(A), true);
  assert.equal(config.isAllowed('b'.repeat(64)), false);
});
