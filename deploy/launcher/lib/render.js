'use strict';
const crypto = require('node:crypto');

/**
 * What one brain's compose project is made of. The compose file is the template as it stands; compose reads the values
 * from .env beside it. A self-hoster can run one brain by copying the template and writing this .env by hand.
 */
function renderBrain({ slug, ownerPubkey, imageTag, config, template, neo4jPassword }) {
  const domain = `${slug}.${config.baseDomain}`;
  const env = {
    SLUG: slug,
    IMAGE_TAG: imageTag,
    TAPESTRY_IMAGE: config.image,
    SEARCH_IMAGE: config.searchImage,
    OWNER_PUBKEY: ownerPubkey,
    ADMIN_PUBKEYS: ownerPubkey,
    NEO4J_PASSWORD: neo4jPassword || crypto.randomBytes(16).toString('hex'),
    DOMAIN_NAME: domain,
    NEO4J_BROWSER_URL: `https://${domain}/browser/`,
    BRAINSTORM_NEO4J_HEAP_MB: String(config.neo4jHeapMb),
    BRAINSTORM_NEO4J_CACHE_MB: String(config.neo4jCacheMb),
    BRAINSTORM_NEO4J_TX_MAX_MB: String(config.neo4jTxMaxMb),
    TAPESTRY_FIRMWARE_ON_BOOT: 'true',
  };
  const envText = `${Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n')}\n`;
  return { compose: template, envText, neo4jPassword: env.NEO4J_PASSWORD };
}

function parseEnv(text) {
  const env = {};
  for (const line of text.split('\n')) {
    const i = line.indexOf('=');
    if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
  }
  return env;
}

module.exports = { renderBrain, parseEnv };
