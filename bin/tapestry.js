#!/usr/bin/env node
'use strict';
/**
 * `tapestry <group> <operation> [--input value …]` — the graph operations, from a shell inside the instance
 * (ADR graph-operations-foundation/0001 Decision 7). `tapestry` on its own lists them. The Dockerfile links this file
 * onto PATH as /usr/local/bin/tapestry.
 */

const { main } = require('../src/operations/cli');

main(process.argv.slice(2)).then(
  // Exit only once stdout has flushed, so piped output is never cut off.
  (code) => process.stdout.write('', () => process.exit(code)),
  (err) => process.stderr.write(`tapestry: ${(err && err.stack) || err}\n`, () => process.exit(3)),
);
