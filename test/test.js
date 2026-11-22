/**
 * Brainstorm test entry point — `npm test` (package.json).
 *
 * Runs every suite in test/registry.js through the gate engine
 * (test/helpers/gateRunner.js), which writes a run record under tmp/gate-runs/ and
 * exits with the verdict it recorded. Read a run's result with `npm run gate:status`:
 * engineering-team/README.md — "Running and reading the test gate"
 * (honest-test-gate #1, ADR honest-test-gate/0001). Each suite runs in a fresh process
 * of its own, as many at a time as the machine has CPUs; GATE_JOBS=<n> sets how many,
 * and GATE_JOBS=1 runs them one at a time (test-gate-speed #1, ADR test-gate-speed/0001).
 *
 * Adding a suite is one line in test/registry.js.
 */

// Mock environment variables for the config smoke check (the registry's first entry). Every suite's
// process starts from this environment.
process.env.BRAINSTORM_RELAY_URL = 'wss://test-relay.com';
process.env.BRAINSTORM_RELAY_PUBKEY = 'test-pubkey';

const { runGate } = require('./helpers/gateRunner');

runGate({ suites: require('./registry').suites, label: process.env.GATE_LABEL }).catch((err) => {
  // runGate ends every run it starts through the real exit; only a failure before its
  // record exists (e.g. an unwritable tmp/gate-runs/) lands here, and it must not exit 0.
  // process.exitCode, not process.exit, so the message above is written out before the process ends.
  process.stderr.write(`Test gate could not start: ${(err && err.stack) || err}\n`);
  process.exitCode = 1;
});
