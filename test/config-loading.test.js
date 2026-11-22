'use strict';
/**
 * The config smoke check: lib/config loads with the gate's starting environment.
 *
 * It ran first in the hand-written runner, and was then a { name, run } entry in test/registry.js
 * (honest-test-gate #1). Since test-gate-speed #1 every suite runs in a process of its own, and a
 * function can't be handed to one, so it is a file (ADR test-gate-speed/0001 Decision 9). It does
 * the same check as before. It relies on the two relay keys test/test.js sets before the gate starts.
 */

async function run() {
  const { loadConfig } = require('../lib/config');
  try {
    const config = loadConfig();
    console.log('Configuration loaded successfully:', Object.keys(config));
    return { pass: 1, fail: 0 };
  } catch (error) {
    console.error('Configuration loading failed:', error.message);
    return { pass: 0, fail: 1, failures: [{ name: 'config-loading', message: error.message }] };
  }
}

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
