'use strict';
const fs = require('node:fs');
const path = require('node:path');

const DEFAULTS = Object.freeze({
  baseDomain: 'tapestry.ninja',
  image: 'ghcr.io/nousclawds4/tapestry',
  searchImage: 'ghcr.io/nousclawds4/tapestry-nostr-search',
  imageTag: 'dogfood',
  maxBrainsPerOwner: 3,
  maxBrainsTotal: 3,
  minFreeDiskGb: 10,
  graceDays: 7,
  neo4jHeapMb: 768,
  neo4jCacheMb: 512,
  neo4jTxMaxMb: 384,
  readyTimeoutSeconds: 300,
  readyPollSeconds: 5,
});

function load(configDir) {
  const allowlist = JSON.parse(fs.readFileSync(path.join(configDir, 'allowlist.json'), 'utf8'));
  if (!Array.isArray(allowlist)) throw new Error('allowlist.json must be an array of { pubkey, label }');
  for (const entry of allowlist) {
    if (!/^[0-9a-f]{64}$/.test(entry.pubkey)) throw new Error(`allowlist.json: a pubkey must be 64 hex characters, not "${entry.pubkey}"`);
  }
  const overrides = JSON.parse(fs.readFileSync(path.join(configDir, 'launcher.json'), 'utf8'));
  const merged = { ...DEFAULTS, ...overrides, allowlist };
  return { ...merged, baseUrl: merged.baseUrl ?? `https://${merged.baseDomain}` };
}

/** Editing these files is a root job. The launcher reads them at start and on SIGHUP. */
function createConfig({ configDir, log = console.log }) {
  let current = load(configDir);
  return {
    current: () => current,
    isAllowed: (pubkey) => current.allowlist.some((a) => a.pubkey === pubkey),
    reload() {
      try {
        current = load(configDir);
        log('[launcher] config reloaded');
      } catch (err) {
        log(`[launcher] config not reloaded, keeping the last good one: ${err.message}`);
      }
    },
  };
}

module.exports = { createConfig };
