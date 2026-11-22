'use strict';
/**
 * The one rule for finding suites in a folder — test-gate-speed #1, ADR test-gate-speed/0001 Decision 3.
 *
 * Every *.test.js under a folder, at any depth, skipping node_modules, sorted by path. It was
 * test/operations.test.js's own rule (ADR graph-operations-foundation/0001 Decision 12). The gate engine
 * now uses it too, to run an entry's `expand` folder as suites of their own, so both must find the same files.
 */

const fs = require('fs');
const path = require('path');

/** Every file under dir, at any depth, skipping node_modules folders, as absolute paths. */
function filesUnder(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') out.push(...filesUnder(p)); } else out.push(p);
  }
  return out;
}

/** Every *.test.js under dir, sorted, as absolute paths. */
function discoverSuites(dir) {
  return filesUnder(dir).filter((f) => f.endsWith('.test.js')).sort();
}

module.exports = { filesUnder, discoverSuites };
