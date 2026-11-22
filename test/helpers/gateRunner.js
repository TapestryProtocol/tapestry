'use strict';
/**
 * The gate engine — honest-test-gate #1 (ADR honest-test-gate/0001 §1); since test-gate-speed #1 (ADR
 * test-gate-speed/0001) every suite runs in a fresh process of its own, several at a time.
 *
 * runGate({ suites, recordDir, label }) runs an ordered registry of suites and reports the run truthfully,
 * however it was launched or ended:
 *
 *   - The units are the registry's entries, in order. An entry with `expand: '<folder>'` is followed by one
 *     unit per *.test.js under test/<folder>/ (test/helpers/discoverSuites.js), and its own module is called
 *     as run({ discovered: 'separately' }), so it leaves those files to the engine (Decision 3).
 *   - Each unit runs in a fresh child process (test/helpers/gateUnit.js), up to GATE_JOBS at once; by default
 *     one per CPU, os.availableParallelism() (Decisions 1 and 2). This process never loads a suite. The child
 *     keeps today's rules for its one suite: a guarded load, process.exit trapped, process.env checked at load
 *     and after the run (ADR test-suite-hermeticity/0002), escaped errors recorded as its strays, counts
 *     normalised, and a run() that never settles is its FAIL rather than the end of the run (Decision 4).
 *   - A unit's stdout and stderr go to one file. When the unit ends, the engine prints them as one block, under
 *     "▶ [i/N] <name>" and above its result line, so suites running side by side never mix their lines; blocks
 *     come in the order units finish (Decision 5). Then it kills whatever is left in the unit's process group,
 *     so nothing a suite started outlives it (Decision 6).
 *   - A run record (gateRecord.js, schema 2) is written before the first unit, rewritten as each starts and
 *     ends, and finished with the verdict and exit code the process exits with (Decision 7).
 *   - A run that ends before its verdict anyway — the engine's own failure, such as a record write that throws —
 *     records FAIL and exits non-zero. No run exits 0 without a verdict.
 *   - stdout/stderr are set blocking. Node writes pipes asynchronously on macOS and process.exit then drops
 *     whatever is still queued, so without this a piped run can lose its own verdict line. A reader that goes
 *     away (EPIPE) stops the output, not the run.
 *   - SIGINT/SIGTERM/SIGHUP kill every running unit, print each one's output so far marked unfinished, record
 *     INTERRUPTED with the progress so far, and exit 128 + signal number. An engine killed outright (SIGKILL)
 *     stays "running" in its record, which the reader reports as unfinished once its process is gone; each of
 *     its units sees its IPC channel close and ends itself.
 *   - Every total is summed from the one results array.
 *
 * suites: [{ file, skipNote?, expand? }], file resolved against test/; skipNote is the reason printed when the
 * whole suite skipped. An entry with no file is that entry's FAIL, since a function can't be handed to another
 * process (Decision 9).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const R = require('./gateRecord');
const { discoverSuites } = require('./discoverSuites');

const TEST_DIR = path.resolve(__dirname, '..');
const UNIT_RUNNER = path.join(__dirname, 'gateUnit.js');
const SIGNALS = { SIGHUP: 1, SIGINT: 2, SIGTERM: 15 };
const NO_FILE = 'has no file; a suite runs in its own process, so it needs one';
// After a unit's process exits, how long to wait for its IPC channel to close before reading its result anyway.
const CLOSE_GRACE_MS = 2000;

function errorText(err) { return String((err && err.message) || err); }

function brief(v) {
  try {
    // NaN and Infinity print as themselves; JSON alone would show them as null.
    const s = JSON.stringify(v, (k, x) => (typeof x === 'number' && !Number.isFinite(x) ? `@@${x}@@` : x));
    return s === undefined ? String(v) : s.replace(/"@@(-?\w+)@@"/g, '$1').slice(0, 80);
  } catch { return String(v); }
}

/** A result count is a non-negative integer. */
function isCount(n) { return Number.isInteger(n) && n >= 0; }

function normalize(res) {
  const skippedMissing = !res || res.skipped === undefined || res.skipped === null;
  if (!res || !isCount(res.pass) || !isCount(res.fail) || !(skippedMissing || isCount(res.skipped))) {
    return { pass: 0, fail: 1, skipped: 0, error: `returned no result counts (got ${brief(res)})` };
  }
  return { pass: res.pass, fail: res.fail, skipped: skippedMissing ? 0 : res.skipped, failures: res.failures };
}

// The old runner's rule: a suite gates the run unless its fail count is exactly 0.
function verdictOf(r) {
  if (r.error || r.fail !== 0) return 'FAIL';
  if (r.pass + r.fail === 0 && r.skipped > 0) return 'SKIP';
  return 'PASS';
}

function counts(r) { return `(${r.pass} passed, ${r.fail} failed, ${r.skipped} skipped)`; }

function totalsOf(results, extraFailed) {
  const t = results.reduce(
    (a, x) => ({ passed: a.passed + x.pass, failed: a.failed + x.fail, skipped: a.skipped + x.skipped }),
    { passed: 0, failed: 0, skipped: 0 },
  );
  return {
    ...t,
    suitesPassed: results.filter((x) => x.verdict === 'PASS').length,
    suitesFailed: results.filter((x) => x.verdict === 'FAIL').length + extraFailed,
    suitesSkipped: results.filter((x) => x.verdict === 'SKIP').length,
  };
}

/* ───────────── process.env around every suite (test-suite-hermeticity #4, ADR test-suite-hermeticity/0002) ─────────────
 * Used by each unit's own process (gateUnit.js), which checks its one suite with them. */

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/** One macrotask: work a suite deferred with a zero-delay timer or setImmediate lands before the next check. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A plain copy of process.env. Taken once, before the suite loads, it is the unit's starting environment. */
function snapshotEnv() { return Object.assign({}, process.env); }

/**
 * What differs from the starting environment, as sorted key names: { added, changed, removed }, or null when nothing
 * does. Values are compared here and never kept, printed or recorded (story AC3).
 */
function envChangesSince(start) {
  const added = [];
  const changed = [];
  const removed = [];
  for (const k of Object.keys(process.env)) {
    if (!has(start, k)) added.push(k);
    else if (process.env[k] !== start[k]) changed.push(k);
  }
  for (const k of Object.keys(start)) if (!has(process.env, k)) removed.push(k);
  if (added.length + changed.length + removed.length === 0) return null;
  return { added: added.sort(), changed: changed.sort(), removed: removed.sort() };
}

/** Put the starting environment back: delete every added key, and set every changed or removed one back. */
function restoreEnv(start) {
  for (const k of Object.keys(process.env)) if (!has(start, k)) delete process.env[k];
  for (const k of Object.keys(start)) if (process.env[k] !== start[k]) process.env[k] = start[k];
}

/** "(<n> key[s]): added A, B; changed C; removed D" — the count first, so a clipped message still says how many. */
function describeEnvChanges(c) {
  const n = c.added.length + c.changed.length + c.removed.length;
  const groups = ['added', 'changed', 'removed'].filter((kind) => c[kind].length).map((kind) => `${kind} ${c[kind].join(', ')}`);
  return `(${n} key${n === 1 ? '' : 's'}): ${groups.join('; ')}`;
}

/* ───────────── the units, and the machine they run on (test-gate-speed #1, ADR test-gate-speed/0001) ───────────── */

const posix = (p) => p.split(path.sep).join('/');

/** A file's unit name: its path under test/ without .test.js; a file outside test/, its basename (Decision 3). */
function fileUnitName(abs) {
  const rel = path.relative(TEST_DIR, abs);
  const inside = rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
  return (inside ? posix(rel) : path.basename(abs)).replace(/\.test\.js$/, '').replace(/\.js$/, '');
}

/**
 * The run's units, in order (Decision 3): each entry, and after an entry with expand, one unit per *.test.js in its
 * folder, named <folder>/<path under it> (Amendment 1). An expand folder that holds no suite is a FAIL of its own,
 * so a mistyped folder can't silently run nothing.
 */
function unitsOf(suites) {
  const units = [];
  const expanded = [];
  for (const entry of suites) {
    if (!entry || typeof entry.file !== 'string' || entry.file === '') {
      const name = (entry && typeof entry.name === 'string' && entry.name) || 'an entry with no file';
      units.push({ name, recordFile: name, problem: NO_FILE });
      continue;
    }
    const abs = path.resolve(TEST_DIR, entry.file);
    const unit = { name: fileUnitName(abs), file: abs, recordFile: entry.file, skipNote: entry.skipNote };
    units.push(unit);
    if (entry.expand === undefined || entry.expand === null) continue;
    unit.runOptions = { discovered: 'separately' };
    const dir = path.resolve(TEST_DIR, String(entry.expand));
    const folder = path.basename(dir);
    const files = discoverSuites(dir);
    for (const f of files) {
      units.push({ name: `${folder}/${posix(path.relative(dir, f)).replace(/\.test\.js$/, '')}`, file: f, recordFile: posix(path.relative(TEST_DIR, f)) });
    }
    if (!files.length) {
      units.push({ name: `${folder}/`, recordFile: String(entry.expand), problem: `${unit.name}'s expand names ${posix(path.relative(TEST_DIR, dir))}/, which holds no *.test.js` });
    }
    expanded.push({ folder, count: files.length });
  }
  units.forEach((u, i) => { u.index = i; });
  return { units, expanded };
}

function availableCpus() { return typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length; }
function cpuModel() { return String(((os.cpus() || [])[0] || {}).model || '').trim(); }

/** GATE_JOBS (Decision 2): unset or empty means one per CPU; otherwise a whole number of 1 or more. */
function jobsSetting(raw, cpus) {
  if (raw === undefined || raw === '') return { jobs: cpus };
  if (/^\d+$/.test(raw) && Number(raw) >= 1) return { jobs: Number(raw) };
  return { error: `GATE_JOBS=${JSON.stringify(raw)} is not a whole number of 1 or more — it sets how many suites run at once (unset, one per CPU; 1, one at a time)` };
}

/** "464 suites (353 registered, with operations' 111 files run as suites of their own)" (Decision 8). */
function unitsText(units, registered, expanded) {
  const n = `${units.length} suite${units.length === 1 ? '' : 's'}`;
  if (!expanded.length) return n;
  const parts = expanded.map((x) => `${x.folder}${x.folder.endsWith('s') ? "'" : "'s"} ${x.count} file${x.count === 1 ? '' : 's'}`);
  return `${n} (${registered} registered, with ${parts.join(' and ')} run as suites of their own)`;
}

async function runGate({ suites, recordDir, label } = {}) {
  if (!Array.isArray(suites)) throw new TypeError('runGate: suites must be an array of { file, skipNote?, expand? } entries');

  // The engine's own exits (the signal path, the final verdict, an engine failure) use the real exit.
  const realExit = process.exit.bind(process);
  const { units, expanded } = unitsOf(suites);
  const cpus = availableCpus();
  const model = cpuModel();
  const setting = jobsSetting(process.env.GATE_JOBS, cpus);
  const h = R.createRecord({
    dir: R.recordDir(recordDir),
    label: label || process.env.GATE_LABEL,
    total: units.length,
    machine: { cpus, model, jobs: setting.jobs || null },
  });
  const shown = h.file.startsWith(`${R.REPO}${path.sep}`) ? path.relative(R.REPO, h.file) : h.file;

  for (const stream of [process.stdout, process.stderr]) {
    if (stream._handle && typeof stream._handle.setBlocking === 'function') stream._handle.setBlocking(true);
  }
  let stdoutGone = false;
  process.stdout.on('error', (e) => { if (e && e.code === 'EPIPE') stdoutGone = true; });
  process.stderr.on('error', () => { /* stderr must never take the run down */ });
  const write = (text) => {
    if (stdoutGone || !text) return;
    try { process.stdout.write(text); } catch { stdoutGone = true; }
  };
  const say = (line) => write(`${line}\n`);
  /** A unit's output as it wrote it, ending with a newline. */
  const writeBlock = (text) => { if (text) write(text.endsWith('\n') ? text : `${text}\n`); };

  const where = `${setting.jobs ? `${setting.jobs} at a time on ` : 'on '}${cpus} CPU${cpus === 1 ? '' : 's'}${model ? ` (${model})` : ''}`;
  say(`Gate run ${h.rec.runId} — record: ${shown} · ${unitsText(units, suites.length, expanded)} · ${where}`);

  let settled = false;
  let completed = 0;
  let logDir = null;
  const results = new Array(units.length);
  const running = new Map(); // unit index → { unit, child, logFile, started, message, spawnError, exit }

  const runningNames = () => [...running.values()].sort((a, b) => a.unit.index - b.unit.index).map((x) => x.unit.name);
  const progress = () => {
    const names = runningNames();
    Object.assign(h.rec.progress, { completed, running: names, current: names.length ? names.join(', ') : null });
  };
  const recordSuites = () => results.filter(Boolean).map((x) => ({
    file: x.file, name: x.name, verdict: x.verdict, pass: x.pass, fail: x.fail, skipped: x.skipped, ms: x.ms,
    error: x.error ? R.clip(x.error) : null, failures: R.clipFailures(x.failures), envChanged: x.envChanged || null,
  }));
  const killGroup = (pid) => { if (Number.isInteger(pid) && pid > 0) { try { process.kill(-pid, 'SIGKILL'); } catch { /* already gone */ } } };
  const killAll = () => { for (const x of running.values()) killGroup(x.child.pid); };
  const cleanLogs = () => { if (logDir) { try { fs.rmSync(logDir, { recursive: true, force: true }); } catch { /* best effort */ } } };
  const readSafe = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } };

  // An error that escapes the engine's own code: recorded, and it fails the run.
  const stray = (err) => {
    h.rec.strayErrors.push({ during: null, message: R.clip((err && err.stack) || err) });
    try { R.updateRecord(h, {}); } catch { /* best effort */ }
  };
  process.on('unhandledRejection', stray);
  process.on('uncaughtException', stray);

  // Ends a run that can't reach its own verdict: recorded as FAIL with the reason, a FAIL verdict line, and a
  // non-zero exit — never a silent exit 0.
  const abandon = (why, exitCode = 1) => {
    settled = true;
    killAll();
    h.rec.strayErrors.push({ during: null, message: R.clip(why) });
    try {
      progress();
      R.finishRecord(h, { verdict: 'FAIL', exitCode, totals: totalsOf(results.filter(Boolean), 1) });
    } catch { /* the record may be what failed; the exit status still says FAIL */ }
    say(`Overall: FAIL — ${String(why).split('\n')[0]} · after ${completed}/${units.length} suites · record ${shown}`);
    cleanLogs();
  };

  for (const [signal, signo] of Object.entries(SIGNALS)) {
    process.on(signal, () => {
      if (settled) return;
      settled = true;
      const exitCode = 128 + signo;
      const inFlight = [...running.values()].sort((a, b) => a.unit.index - b.unit.index);
      for (const x of inFlight) killGroup(x.child.pid);
      // What each running unit had printed, so an interrupted run — a CI cancellation, a time limit — shows what was still running.
      for (const x of inFlight) {
        say(`▶ [${x.unit.index + 1}/${units.length}] ${x.unit.name} (unfinished: its output so far)`);
        writeBlock(readSafe(x.logFile));
      }
      try { progress(); R.interruptRecord(h, { signal, exitCode }); } catch { /* best effort */ }
      say(`Overall: INTERRUPTED — ${signal} after ${completed}/${units.length} suites · record ${shown}`);
      cleanLogs();
      realExit(exitCode);
    });
  }

  // The process is exiting and the run never settled: an exit got past the engine.
  process.on('exit', (code) => {
    if (settled) return;
    const exitCode = code || 1;
    abandon(`the run ended before its verdict (process exit ${code}${running.size ? ` while ${runningNames().join(', ')} ran` : ''})`, exitCode);
    process.exitCode = exitCode;
  });

  try {
    if (setting.error) {
      abandon(setting.error);
      realExit(1);
      return;
    }
    if (units.length) logDir = fs.mkdtempSync(path.join(os.tmpdir(), `gate-${h.rec.runId}-`));
    const jobs = Math.max(1, Math.min(setting.jobs, units.length || 1));

    await new Promise((resolve, reject) => {
      let next = 0;

      const resultOf = (x) => {
        const m = x.message;
        if (m && m.result) {
          for (const s of m.strays || []) h.rec.strayErrors.push({ during: x.unit.name, message: R.clip(s) });
          return { ...m.result };
        }
        if (x.spawnError) return { pass: 0, fail: 1, skipped: 0, error: `could not start its process: ${x.spawnError}` };
        const e = x.exit || {};
        return { pass: 0, fail: 1, skipped: 0, error: `its process ended before it reported a result (exit ${e.code}${e.signal ? `, signal ${e.signal}` : ''})` };
      };

      const finish = (unit, r, output, ms) => {
        Object.assign(r, { name: unit.name, file: unit.recordFile, ms, skipNote: unit.skipNote });
        r.verdict = verdictOf(r);
        results[unit.index] = r;
        completed += 1;
        const tag = `[${unit.index + 1}/${units.length}]`;
        say(`▶ ${tag} ${unit.name}`);
        writeBlock(output);
        say(`  ${tag} ${unit.name}: ${r.verdict} ${counts(r)} ${r.ms}ms${r.error ? ` — ${r.error}` : ''}`);
        progress();
        R.updateRecord(h, { suites: recordSuites() });
      };

      const launch = (unit) => {
        if (unit.problem) { finish(unit, { pass: 0, fail: 1, skipped: 0, error: unit.problem }, '', 0); return; }
        const logFile = path.join(logDir, `${unit.index + 1}.log`);
        const fd = fs.openSync(logFile, 'w');
        let child;
        try {
          child = cp.fork(UNIT_RUNNER, [], {
            cwd: process.cwd(),
            env: process.env,
            // Not the engine's own flags: a gate started with `node -e …` would otherwise hand its -e to every unit.
            execArgv: [],
            stdio: ['ignore', fd, fd, 'ipc'],
            // Its own process group, so the engine can end everything the suite started (Decision 6).
            detached: true,
          });
        } finally { fs.closeSync(fd); }
        const x = { unit, child, logFile, started: Date.now(), message: null, spawnError: null, exit: null, done: false };
        running.set(unit.index, x);
        progress();
        R.updateRecord(h, {});
        let closeTimer = null;
        const done = () => {
          if (x.done) return;
          x.done = true;
          clearTimeout(closeTimer);
          running.delete(unit.index);
          if (settled) return;
          try {
            const output = readSafe(logFile);
            try { fs.unlinkSync(logFile); } catch { /* already gone */ }
            finish(unit, resultOf(x), output, Date.now() - x.started);
            pump();
          } catch (e) { reject(e); }
        };
        child.on('message', (m) => { if (m && m.type === 'gate-unit-result') x.message = m; });
        child.on('error', (e) => { x.spawnError = errorText(e); if (!child.pid) setImmediate(done); });
        child.on('exit', (code, signal) => {
          x.exit = { code, signal };
          killGroup(child.pid);
          closeTimer = setTimeout(done, CLOSE_GRACE_MS);
        });
        child.on('close', (code, signal) => {
          if (!x.exit) x.exit = { code, signal };
          killGroup(child.pid);
          done();
        });
        try {
          child.send({ type: 'gate-unit', unit: { file: unit.file, name: unit.name, runOptions: unit.runOptions || null } });
        } catch (e) { x.spawnError = errorText(e); }
      };

      function pump() {
        while (!settled && running.size < jobs && next < units.length) launch(units[next++]);
        if (!settled && running.size === 0 && next >= units.length) resolve();
      }

      try { pump(); } catch (e) { reject(e); }
    });

    // One macrotask, so an escaped rejection of the engine's own lands before the verdict.
    await settle();

    say('\nTest Results');
    say('-------------');
    for (const x of results) {
      const shape = x.verdict === 'SKIP' ? `SKIP (${x.skipped} tests${x.skipNote ? `; ${x.skipNote}` : ''})` : `${x.verdict} ${counts(x)}`;
      say(`${x.name}: ${shape}`);
    }
    const failed = results.filter((x) => x.verdict === 'FAIL').map((x) => x.name);
    if (h.rec.strayErrors.length) {
      const what = h.rec.strayErrors.map((s) => `during ${s.during || 'the runner'}: ${String(s.message).split('\n')[0]}`).join('; ');
      say(`stray async errors: FAIL (${h.rec.strayErrors.length}) — ${what}`);
      failed.push('stray async errors');
    }
    if (failed.length) say(`Failed suites: ${failed.join(', ')}`);
    const totals = totalsOf(results, h.rec.strayErrors.length ? 1 : 0);
    say(`Total skipped: ${totals.skipped}`);

    const verdict = failed.length ? 'FAIL' : 'PASS';
    const exitCode = failed.length ? 1 : 0;
    settled = true;
    progress();
    R.finishRecord(h, { verdict, exitCode, totals });
    say(`Overall: ${verdict} — ${totals.passed} passed, ${totals.failed} failed, ${totals.skipped} skipped across ${results.length} suites · record ${shown}`);
    cleanLogs();
    realExit(exitCode);
  } catch (err) {
    // The engine itself failed — most likely its record could not be written. The run can't finish honestly, so it
    // ends here as a FAIL.
    abandon(`the gate engine failed: ${(err && err.stack) || err}`);
    realExit(1);
  }
}

module.exports = {
  runGate,
  // For test/helpers/gateUnit.js, which applies them to its one suite.
  errorText, normalize, settle, snapshotEnv, envChangesSince, restoreEnv, describeEnvChanges,
};
