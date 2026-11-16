'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { renderBrain, parseEnv } = require('../lib/render');

const TEMPLATE = fs.readFileSync(path.join(__dirname, '../../templates/brain.compose.yml'), 'utf8');
const config = {
  baseDomain: 'tapestry.test', image: 'ghcr.io/example/tapestry', searchImage: 'ghcr.io/example/search',
  neo4jHeapMb: 768, neo4jCacheMb: 512, neo4jTxMaxMb: 384,
};
const owner = 'a'.repeat(64);
const render = (o = {}) => renderBrain({ slug: 'avi', ownerPubkey: owner, imageTag: 'dogfood', config, template: TEMPLATE, ...o });

/** Splits the template's `services:` block into { name: text }, by indentation. */
function services(yml) {
  const lines = yml.split('\n');
  const start = lines.indexOf('services:');
  const out = {};
  let name = null;
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    const m = line.match(/^ {2}([\w-]+):\s*$/);
    if (m) { name = m[1]; out[name] = ''; } else if (name) out[name] += `${line}\n`;
  }
  return out;
}

test('the template has the services the repo compose file has, by the same names', () => {
  assert.deepEqual(Object.keys(services(render().compose)).sort(), ['nostr-search-api', 'nostr-search-meili', 'redis', 'tapestry']);
});

test('no service publishes a port', () => {
  assert.doesNotMatch(render().compose, /^\s*ports\s*:/m);
});

test('every service has a memory limit', () => {
  for (const [name, text] of Object.entries(services(render().compose))) assert.match(text, /^ {4}mem_limit:/m, name);
});

test('only tapestry has a fixed container name', () => {
  for (const [name, text] of Object.entries(services(render().compose))) {
    if (name === 'tapestry') assert.match(text, /^ {4}container_name: brain-\$\{SLUG\}-tapestry$/m);
    else assert.doesNotMatch(text, /container_name/, name);
  }
});

test('the search services sit behind the social profile, and nothing else does', () => {
  for (const [name, text] of Object.entries(services(render().compose))) {
    if (name.startsWith('nostr-search')) assert.match(text, /^ {4}profiles: \[social\]$/m, name);
    else assert.doesNotMatch(text, /profiles:/, name);
  }
});

test('every volume is a named volume, so nothing on the host is shared', () => {
  for (const m of render().compose.matchAll(/^\s+- ([^:\s]+):\/[\w/.-]+$/gm)) {
    assert.ok(!m[1].startsWith('/') && !m[1].startsWith('.'), m[1]);
  }
});

test('redis has a named volume', () => {
  assert.match(services(render().compose).redis, /redis:\/data/);
});

test('every variable the template uses is in .env', () => {
  const { compose, envText } = render();
  const env = parseEnv(envText);
  const used = [...compose.matchAll(/\$\{(\w+)[^}]*\}/g)].map((m) => m[1]);
  assert.ok(used.length > 5);
  for (const name of used) assert.ok(name in env, `${name} is missing from .env`);
});

test('.env carries what the entrypoint reads: the three memory variables, firmware on boot, the browser link', () => {
  const env = parseEnv(render().envText);
  assert.equal(env.BRAINSTORM_NEO4J_HEAP_MB, '768');
  assert.equal(env.BRAINSTORM_NEO4J_CACHE_MB, '512');
  assert.equal(env.BRAINSTORM_NEO4J_TX_MAX_MB, '384');
  assert.equal(env.TAPESTRY_FIRMWARE_ON_BOOT, 'true');
  assert.equal(env.BRAINSTORM_PUBLISH_LOCAL_ONLY, 'true', 'a brain mirrors nothing to public relays by default');
  assert.equal(env.DOMAIN_NAME, 'avi.tapestry.test');
  assert.equal(env.NEO4J_BROWSER_URL, 'https://avi.tapestry.test/browser/');
  assert.equal(env.OWNER_PUBKEY, owner);
  assert.equal(env.ADMIN_PUBKEYS, owner, 'admins start as the owner only');
});

test('the template passes the entrypoint its variables', () => {
  const { tapestry } = services(render().compose);
  for (const v of ['OWNER_PUBKEY', 'ADMIN_PUBKEYS', 'NEO4J_PASSWORD', 'DOMAIN_NAME', 'NEO4J_BROWSER_URL', 'BRAINSTORM_NEO4J_HEAP_MB', 'BRAINSTORM_NEO4J_CACHE_MB', 'BRAINSTORM_NEO4J_TX_MAX_MB', 'TAPESTRY_FIRMWARE_ON_BOOT', 'BRAINSTORM_PUBLISH_LOCAL_ONLY']) {
    assert.match(tapestry, new RegExp(`- ${v}=\\$\\{${v}\\}`), v);
  }
});

test('the password is 32 hex characters and differs between renders', () => {
  const a = parseEnv(render().envText).NEO4J_PASSWORD;
  const b = parseEnv(render().envText).NEO4J_PASSWORD;
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});

test('a given password is kept, so an update does not change it', () => {
  assert.equal(parseEnv(render({ neo4jPassword: 'keep-me' }).envText).NEO4J_PASSWORD, 'keep-me');
});
