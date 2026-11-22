'use strict';
/**
 * One unit of a gate run, in a fresh process of its own — test-gate-speed #1, ADR test-gate-speed/0001 Decision 4.
 *
 * The engine (test/helpers/gateRunner.js) forks this with stdout and stderr on the unit's log file, an IPC channel,
 * and a process group of its own. It waits for one message naming its suite, applies to that one suite the rules the
 * engine applied to every suite in one process before, sends one result message, and exits:
 *
 *   - its starting environment is taken first, before anything else runs (ADR test-suite-hermeticity/0002, rule 1);
 *   - process.exit is trapped from the load on, so a call throws where it was made: into the load, into run(), or,
 *     from a timer, into the stray-error listener;
 *   - the load is guarded, and a load that changed process.env is this unit's FAIL, and the suite isn't run (rule 4);
 *   - one macrotask later a change from a timer the load left is a stray of this unit (rule 5);
 *   - the counts are normalised, and one macrotask after the run a key left changed is one more failed check,
 *     named (rule 6; as the last suite in its process, rule 7's check is this one);
 *   - escaped rejections and exceptions are this unit's strays;
 *   - a run() that never settles, with nothing left to keep the process alive, is this unit's FAIL. The IPC channel
 *     is unref'd so that it doesn't keep the process alive itself;
 *   - when the IPC channel closes before the result is sent, the engine is gone. This unit then ends at once, with
 *     its whole process group.
 *
 * Only key names leave this process, never an environment value.
 */

// The starting environment, taken before anything else runs.
const START_ENV = Object.assign({}, process.env);
const realExit = process.exit.bind(process);

const G = require('./gateRunner');
const R = require('./gateRecord');

let unit = null;
let reported = false;
let phase = 'waiting for its suite';
const strays = [];

/** Send the one result, then exit through the real exit once it is on its way. */
function report(result) {
  if (reported) return;
  reported = true;
  const msg = { type: 'gate-unit-result', result, strays: strays.map((s) => R.clip(s)) };
  try {
    process.send(msg, () => realExit(0));
  } catch {
    realExit(3);
  }
}

const strayOf = (err) => strays.push(String((err && err.stack) || err));
process.on('unhandledRejection', strayOf);
process.on('uncaughtException', strayOf);

process.on('disconnect', () => {
  if (reported) return;
  try { process.kill(-process.pid, 'SIGKILL'); } catch { /* not a group leader; end this process alone */ }
  realExit(1);
});

process.on('beforeExit', () => {
  if (reported || !unit) return;
  report({
    pass: 0,
    fail: 1,
    skipped: 0,
    error: phase === 'running'
      ? 'its run() never settled, and nothing it left was still going that could settle it'
      : `it stopped while ${phase}, before it had a result`,
  });
});

async function runUnit() {
  process.exit = (code) => { throw new Error(`called process.exit(${code === undefined ? '' : code}) — a suite may not end the run`); };

  phase = 'loading';
  let mod;
  let loadError = null;
  try { mod = require(unit.file); } catch (e) { loadError = `failed to load: ${G.errorText(e)}`; }

  let r = null;
  const envAtLoad = G.envChangesSince(START_ENV);
  if (envAtLoad) {
    G.restoreEnv(START_ENV);
    const envText = `changed process.env when it loaded, so it was not run ${G.describeEnvChanges(envAtLoad)} — a suite may set process.env only inside run(), and must put it back before run() ends`;
    r = { pass: 0, fail: 1, skipped: 0, error: loadError ? `${loadError}; and ${envText}` : envText, envChanged: { phase: 'load', ...envAtLoad } };
  }
  phase = 'settling after its load';
  await G.settle();
  const deferredAtLoad = G.envChangesSince(START_ENV);
  if (deferredAtLoad) {
    G.restoreEnv(START_ENV);
    strays.push(`process.env changed after ${unit.name} loaded, before it ran ${G.describeEnvChanges(deferredAtLoad)}`);
  }

  if (!r) {
    if (loadError) {
      r = { pass: 0, fail: 1, skipped: 0, error: loadError };
    } else if (!mod || typeof mod.run !== 'function') {
      r = { pass: 0, fail: 1, skipped: 0, error: 'exports no run() function' };
    } else {
      phase = 'running';
      try {
        r = G.normalize(await (unit.runOptions ? mod.run(unit.runOptions) : mod.run()));
      } catch (err) {
        r = { pass: 0, fail: 1, skipped: 0, error: G.errorText(err) };
      }
      phase = 'settling after its run';
      await G.settle();
      const envAfterRun = G.envChangesSince(START_ENV);
      if (envAfterRun) {
        G.restoreEnv(START_ENV);
        const envText = `left process.env changed after its run ${G.describeEnvChanges(envAfterRun)} — put each key back before run() ends (delete one that was unset)`;
        r.fail += 1;
        r.error = r.error ? `${r.error}; and ${envText}` : envText;
        r.envChanged = { phase: 'run', ...envAfterRun };
      }
    }
  }
  // Only plain names and messages cross the channel: a failure object may hold anything.
  r.failures = R.clipFailures(r.failures);
  report(r);
}

process.once('message', (msg) => {
  if (!msg || msg.type !== 'gate-unit' || !msg.unit || typeof msg.unit.file !== 'string') {
    report({ pass: 0, fail: 1, skipped: 0, error: 'the gate sent this unit no suite to run' });
    return;
  }
  unit = msg.unit;
  // The channel must not keep this process alive itself, or a run() that never settles would hang it rather than fail.
  if (process.channel && typeof process.channel.unref === 'function') process.channel.unref();
  runUnit().catch((err) => report({ pass: 0, fail: 1, skipped: 0, error: `the unit runner failed: ${G.errorText(err)}` }));
});
