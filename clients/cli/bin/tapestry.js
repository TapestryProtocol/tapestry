#!/usr/bin/env node
'use strict';
/**
 * `tapestry` — the external CLI for a Tapestry instance's graph operations (story graph-operations-foundation #6,
 * ADR graph-operations-foundation/0006). It signs in with your own key and calls the operations the instance lists:
 * `tapestry` on its own lists them. Inside an instance's container, `tapestry` is the internal command instead.
 */

const { main } = require('../src/main');

main(process.argv.slice(2), { stdout: process.stdout, stderr: process.stderr }, process.env).then(
  // Exit only once stdout has flushed, so piped output is never cut off.
  (code) => process.stdout.write('', () => process.exit(code)),
  (err) => process.stderr.write(`tapestry: ${(err && err.stack) || err}\n`, () => process.exit(3)),
);
