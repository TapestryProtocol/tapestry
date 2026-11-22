'use strict';
/**
 * Guard-side fixtures for honest-test-gate #1 — shared by test/gate-result-record.test.js
 * and the re-aimed G3/G5/G6/G7 in test/stack-free-npm-test.test.js.
 *
 * Story: engineering-team/stories/honest-test-gate/1-gate-result-tells-the-truth.md
 * ADR:   engineering-team/decisions/honest-test-gate/0001-registry-runner-and-run-record.md
 *
 * PHASE-3 OWNED (ADR 0001, Implementation notes, carve-out): the Implementer must not
 * modify this file, test/gate-result-record.test.js, or test/stack-free-npm-test.test.js.
 *
 * Also shared by test/suite-env-changes.test.js (test-suite-hermeticity #4, ADR
 * test-suite-hermeticity/0002), which added the env fixtures and ENV_FIXTURE below and
 * re-aimed gate-result-record's C6. The same carve-out holds for that story: its
 * Implementer must not modify this file either.
 *
 * Also shared by test/gate-side-by-side.test.js (test-gate-speed #1, ADR
 * test-gate-speed/0001), which added the fixtures under "test-gate-speed #1" below, the
 * EXPAND_FIXTURE folder, scenario().folder() and runFunctionEntryEngine(), and re-aimed the
 * fixtures of gate-result-record's C6 and C11. The same carve-out holds: that story's
 * Implementer must not modify this file either.
 *
 * Nothing here requires the gate engine at module load. Before implementation the
 * engine does not exist, and a registered suite that throws at require time would crash
 * the current runner's load phase for every suite on the branch. Every engine touch goes
 * through need(), which names what is missing and the ADR section that defines it.
 *
 * Fixture suites are written to a fresh temp dir per scenario and handed to runGate() as
 * paths RELATIVE TO test/ — the registry's resolution base (ADR §1) — so any sane
 * resolution against test/ finds them. Records go to a fresh temp dir (passed as
 * recordDir and as GATE_RECORD_DIR), except where a test deliberately exercises the
 * default location. Children are spawned with cwd = the repo, so the record's git
 * identity is this checkout's.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const REPO = path.resolve(__dirname, '..', '..');
const TEST_DIR = path.join(REPO, 'test');
const ADR = 'engineering-team/decisions/honest-test-gate/0001-registry-runner-and-run-record.md';

const MODULES = {
  runner: { rel: 'test/helpers/gateRunner.js', what: 'the engine, runGate({ suites, recordDir, label })', adr: '§1' },
  record: { rel: 'test/helpers/gateRecord.js', what: 'the run-record helpers', adr: '§2' },
  registry: { rel: 'test/registry.js', what: 'the ordered suite registry ({ suites, excluded })', adr: '§3' },
  status: { rel: 'test/gate-status.js', what: 'the reader behind `npm run gate:status`', adr: '§5' },
  stackHttp: { rel: 'test/helpers/stackHttp.js', what: 'the shared stack-HTTP helper (loopbackRequest, describeResponse)', adr: '§6' },
};

function modulePath(key) { return path.join(REPO, MODULES[key].rel); }

/** Throw a readable failure naming every missing module and the ADR section that defines it. */
function need(...keys) {
  const missing = keys.filter((k) => !fs.existsSync(modulePath(k)));
  if (missing.length) {
    throw new Error(missing
      .map((k) => `${MODULES[k].rel} does not exist yet — ${MODULES[k].what} (${ADR}, Implementation notes ${MODULES[k].adr}).`)
      .join(' '));
  }
}

function short(v, n = 200) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s === undefined ? String(v) : (s.length > n ? `${s.slice(0, n)}…` : s);
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function lines(text) { return String(text || '').split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim() !== ''); }
function firstLine(text) { return lines(text)[0] || ''; }
function lastLine(text) { const ls = lines(text); return (ls[ls.length - 1] || '').trim(); }

/* ───────────── fixture suites ───────────── */

const pass = (p) => `module.exports = { run: async () => ({ pass: ${p}, fail: 0 }) };\n`;

/*
 * The keys and values of test-suite-hermeticity #4's env fixtures (ADR test-suite-hermeticity/0002). ADDED is never
 * in a run's starting environment; PRESET always is: the guard puts it, with PRESET_VALUE, on the engine's child.
 * Every value a fixture writes, and PRESET_VALUE, is listed in VALUES, so a guard can show that none of them
 * reaches the run's output or its record (story AC3). env-writer's key and value are older and listed too.
 */
const ENV_FIXTURE = {
  ADDED: 'GATE_ENV_FIXTURE_ADDED',
  PRESET: 'GATE_ENV_FIXTURE_PRESET',
  PROBE: 'GATE_FIXTURE_ENV_PROBE',
  PRESET_VALUE: 'gate-env-fixture-starting-value-7d1f',
  AT_LOAD: 'gate-env-fixture-written-at-load-7d1f',
  CHANGED_AT_LOAD: 'gate-env-fixture-changed-at-load-7d1f',
  IN_RUN: 'gate-env-fixture-written-in-run-7d1f',
  CHANGED_IN_RUN: 'gate-env-fixture-changed-in-run-7d1f',
  LATE: 'gate-env-fixture-written-late-7d1f',
  WRITER: 'written-by-env-writer',
};
ENV_FIXTURE.VALUES = [ENV_FIXTURE.PRESET_VALUE, ENV_FIXTURE.AT_LOAD, ENV_FIXTURE.CHANGED_AT_LOAD, ENV_FIXTURE.IN_RUN,
  ENV_FIXTURE.CHANGED_IN_RUN, ENV_FIXTURE.LATE, ENV_FIXTURE.WRITER];

// An env fixture whose run() runs leaves ran-<its file name> beside itself, so a guard can tell whether it ran.
const MARK_RAN = "require('fs').writeFileSync(require('path').join(__dirname, 'ran-' + require('path').basename(__filename)), '');";
const E = ENV_FIXTURE;
const envSet = (key, value) => `process.env.${key} = '${value}';`;

/* test-gate-speed #1 (ADR test-gate-speed/0001): fixtures that show where, when and beside what a suite ran. */

// Writes met-<self> beside itself, then waits up to 15 s for met-<other>. Both pass only when they run at once.
const meet = (self, other) =>
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  'module.exports = { run: async () => {\n' +
  `  fs.writeFileSync(path.join(__dirname, 'met-${self}'), String(process.pid));\n` +
  '  const end = Date.now() + 15000;\n' +
  '  while (Date.now() < end) {\n' +
  `    if (fs.existsSync(path.join(__dirname, 'met-${other}'))) return { pass: 1, fail: 0 };\n` +
  '    await new Promise((r) => setTimeout(r, 25));\n' +
  '  }\n' +
  `  return { pass: 0, fail: 1, failures: [{ name: 'meet', message: 'meet-${other} never ran while meet-${self} was running' }] };\n` +
  '} };\n';

// Prints 15 lines over about 1.2 s, and one more on stderr halfway. Records where and when it ran in span-<name>.json:
// the pid that loaded it, the pid that ran it, and when its run started and ended.
const chatty = (name) =>
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  'const LOAD_PID = process.pid;\n' +
  'module.exports = { run: async () => {\n' +
  '  const start = Date.now();\n' +
  '  for (let i = 0; i < 15; i++) {\n' +
  `    console.log('${name} line ' + i);\n` +
  `    if (i === 7) console.error('${name} on stderr');\n` +
  '    await new Promise((r) => setTimeout(r, 80));\n' +
  '  }\n' +
  `  fs.writeFileSync(path.join(__dirname, 'span-${name}.json'), JSON.stringify({ pid: process.pid, loadPid: LOAD_PID, start, end: Date.now() }));\n` +
  '  return { pass: 1, fail: 0 };\n' +
  '} };\n';

// Prints one line, then records its pid in hang-pid-<name> and waits a minute on a timer, until the guard stops it.
const hang = (name) =>
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  'module.exports = { run: async () => {\n' +
  `  console.log('partial output before the interrupt (fixture: ${name})');\n` +
  `  fs.writeFileSync(path.join(__dirname, 'hang-pid-${name}'), String(process.pid));\n` +
  '  await new Promise((r) => setTimeout(r, 60000));\n' +
  '  return { pass: 1, fail: 0 };\n' +
  '} };\n';

// ADR test-gate-speed/0001 Amendment 2: runs for 0.8 s and records when it started and ended in span-<name>.json. A
// trailing comment of `pad` characters sets its file size, which decides where it starts when suites run side by side.
const sized = (name, pad) =>
  "const fs = require('fs');\n" +
  "const path = require('path');\n" +
  'module.exports = { run: async () => {\n' +
  '  const start = Date.now();\n' +
  '  await new Promise((r) => setTimeout(r, 800));\n' +
  `  fs.writeFileSync(path.join(__dirname, 'span-${name}.json'), JSON.stringify({ pid: process.pid, loadPid: process.pid, start, end: Date.now() }));\n` +
  '  return { pass: 1, fail: 0 };\n' +
  '} };\n' +
  `// ${'x'.repeat(pad)}\n`;

// ADR test-gate-speed/0001 Amendment 3: passes at once with one test. A trailing comment of `pad` characters sets its
// file size, which decides the part it falls in when the run is split.
const quickSized = (pad) => `module.exports = { run: async () => ({ pass: 1, fail: 0 }) };\n// ${'q'.repeat(pad)}\n`;

// The folder an expanding entry names (ADR test-gate-speed/0001 Decision 3), written by scenario().folder().
// Three suites at two depths, one of them with no run(); a helper that isn't a suite; and a suite under
// node_modules, which discovery skips.
const EXPAND_FIXTURE = {
  'good.test.js': pass(2),
  'nested/also.test.js': 'module.exports = { run: async () => ({ pass: 2, fail: 0, skipped: 1 }) };\n',
  'bad.test.js': 'module.exports = {};\n',
  'helper.js': 'module.exports = { notASuite: true };\n',
  'node_modules/skipped.test.js': pass(99),
};

const FIXTURE_SOURCES = {
  'pass.test.js': pass(2),
  'second-pass.test.js': pass(1),
  'third-pass.test.js': pass(1),
  'fourth-pass.test.js': pass(1),
  'fifth-pass.test.js': pass(1),
  'fail.test.js': 'module.exports = { run: async () => ({ pass: 1, fail: 1 }) };\n',
  'skip-only.test.js': 'module.exports = { run: async () => ({ pass: 0, fail: 0, skipped: 3 }) };\n',
  'mixed.test.js': 'module.exports = { run: async () => ({ pass: 2, fail: 0, skipped: 1 }) };\n',
  'fail-with-skips.test.js': 'module.exports = { run: async () => ({ pass: 0, fail: 1, skipped: 2 }) };\n',
  'throws-in-run.test.js':
    "module.exports = { run: async () => { throw new TypeError('fetch failed (fixture: throws-in-run)'); } };\n",
  'throws-at-load.test.js': "throw new Error('boom at load (fixture: throws-at-load)');\n",
  'calls-exit.test.js': 'module.exports = { run: async () => { process.exit(0); return { pass: 1, fail: 0 }; } };\n',
  // The rejection must be observed while the engine is still running: yield one macrotask
  // so Node processes unhandled rejections before this suite returns.
  'stray-rejection.test.js':
    "module.exports = { run: async () => {\n" +
    "  Promise.reject(new Error('stray rejection (fixture: stray-rejection)'));\n" +
    '  await new Promise((r) => setTimeout(r, 50));\n' +
    '  return { pass: 1, fail: 0 };\n' +
    '} };\n',
  'no-counts.test.js': 'module.exports = { run: async () => undefined };\n',
  'brief.test.js': 'module.exports = { run: () => new Promise((r) => setTimeout(() => r({ pass: 1, fail: 0 }), 400)) };\n',
  'slow.test.js': 'module.exports = { run: () => new Promise((r) => setTimeout(() => r({ pass: 1, fail: 0 }), 60000)) };\n',
  // ~4 MB of output: enough to leave writes queued behind a pipe, then exit.
  'noisy.test.js':
    "const line = 'n'.repeat(199);\n" +
    'module.exports = { run: async () => { for (let i = 0; i < 20000; i++) console.log(line); return { pass: 1, fail: 0 }; } };\n',
  // ~600 KB of output, then marks the moment it finished (for AC-5's lag measurement).
  'marked-noisy.test.js':
    "const fs = require('fs');\n" +
    "const line = 'm'.repeat(199);\n" +
    'module.exports = { run: async () => {\n' +
    '  for (let i = 0; i < 3000; i++) console.log(line);\n' +
    '  fs.writeFileSync(process.env.GATE_FIXTURE_MARKER, String(Date.now()));\n' +
    '  return { pass: 1, fail: 0 };\n' +
    '} };\n',
  // Blocks the event loop for 6 s — longer than AC-5's 5 s bound.
  'blocking.test.js':
    "module.exports = { run: async () => { require('child_process').execSync('sleep 6'); return { pass: 1, fail: 0 }; } };\n",
  // Leaves a key set after its run. Since test-suite-hermeticity #4 (ADR test-suite-hermeticity/0002) that is the
  // suite's FAIL; test/suite-env-changes.test.js uses it as such. Its old partner env-reader went with C6's re-aim.
  'env-writer.test.js':
    "module.exports = { run: async () => { process.env.GATE_FIXTURE_ENV_PROBE = 'written-by-env-writer'; return { pass: 1, fail: 0 }; } };\n",
  // C6's probe (re-aimed again 2026-11-21, test-gate-speed #1, ADR test-gate-speed/0001 Decision 1): the writer's run
  // leaves a global in its process, and the reader notes at load whether it is there. A global, because suites now
  // load in processes of their own: a file the writer left would reach the reader through the shared file system,
  // which no engine isolates. The writer still leaves load-order-marker, to show that it ran.
  'marker-writer.test.js':
    "const fs = require('fs');\n" +
    "const path = require('path');\n" +
    "module.exports = { run: async () => { globalThis.__gateLoadOrderMarker = 'written by marker-writer'; fs.writeFileSync(path.join(__dirname, 'load-order-marker'), 'written by marker-writer'); return { pass: 1, fail: 0 }; } };\n",
  'marker-reader.test.js':
    'const SEEN_AT_LOAD = globalThis.__gateLoadOrderMarker !== undefined;\n' +
    'module.exports = { run: async () => (SEEN_AT_LOAD ? { pass: 0, fail: 1 } : { pass: 1, fail: 0 }) };\n',

  /* ── Added at the review kick-back, 2026-09-13 (review c6ed2b35, Blocking 1 and 2) ── */

  // Blocking 1, route 1 — the engine's own failure. From its run() on, every write into the
  // run's record directory throws, whichever fs entry point it goes through (sync, callback
  // or promise; both the given and the real path of the directory). Then it passes, so the
  // engine's next record write is the one that fails. The first refused write is marked in
  // GATE_FIXTURE_MARKER, so the guard can tell that the fault fired.
  'record-write-fault.test.js':
    "const fs = require('fs');\n" +
    "const path = require('path');\n" +
    "if (!process.env.GATE_RECORD_DIR) throw new Error('record-write-fault needs GATE_RECORD_DIR');\n" +
    'const DIRS = [path.resolve(process.env.GATE_RECORD_DIR), fs.realpathSync(process.env.GATE_RECORD_DIR)].map((d) => d + path.sep);\n' +
    "const inDir = (p) => typeof p === 'string' && DIRS.some((d) => path.resolve(p).startsWith(d));\n" +
    "const writes = (f) => (typeof f === 'number' ? (f & (fs.constants.O_WRONLY | fs.constants.O_RDWR)) !== 0 : typeof f === 'string' && /[wa+]/.test(f));\n" +
    'const one = (a) => inDir(a[0]);\n' +
    'const opening = (a) => inDir(a[0]) && writes(a[1]);\n' +
    'const either = (a) => inDir(a[0]) || inDir(a[1]);\n' +
    'const mark = fs.writeFileSync;\n' +
    'let fired = false;\n' +
    'function trap(api, names, refused, promised) {\n' +
    '  for (const n of names) {\n' +
    '    const real = api[n];\n' +
    "    if (typeof real !== 'function') continue;\n" +
    '    api[n] = function (...args) {\n' +
    '      if (!refused(args)) return real.apply(this, args);\n' +
    '      if (!fired && process.env.GATE_FIXTURE_MARKER) { fired = true; mark(process.env.GATE_FIXTURE_MARKER, String(Date.now())); }\n' +
    "      const e = new Error('injected record-write failure (fixture: record-write-fault)');\n" +
    '      if (promised) return Promise.reject(e);\n' +
    '      throw e;\n' +
    '    };\n' +
    '  }\n' +
    '}\n' +
    'module.exports = { run: async () => {\n' +
    "  trap(fs, ['writeFileSync', 'appendFileSync', 'writeFile', 'appendFile'], one, false);\n" +
    "  trap(fs, ['openSync', 'open'], opening, false);\n" +
    "  trap(fs, ['renameSync', 'copyFileSync', 'rename', 'copyFile'], either, false);\n" +
    "  trap(fs.promises, ['writeFile', 'appendFile'], one, true);\n" +
    "  trap(fs.promises, ['open'], opening, true);\n" +
    "  trap(fs.promises, ['rename', 'copyFile'], either, true);\n" +
    '  return { pass: 1, fail: 0 };\n' +
    '} };\n',
  // C11's route since test-gate-speed #1 (ADR test-gate-speed/0001): a suite runs in a process of its own, so it can no
  // longer patch the engine's fs. Instead its run takes write permission off the run's record directory, which the
  // engine's next record write then meets, whichever process makes it. It marks GATE_FIXTURE_MARKER first, so the guard
  // can tell that it ran. A root user ignores file modes, so as root it skips and leaves the marker unwritten.
  'record-dir-readonly.test.js':
    "const fs = require('fs');\n" +
    "if (!process.env.GATE_RECORD_DIR) throw new Error('record-dir-readonly needs GATE_RECORD_DIR');\n" +
    'module.exports = { run: async () => {\n' +
    "  if (typeof process.getuid === 'function' && process.getuid() === 0) return { pass: 0, fail: 0, skipped: 1 };\n" +
    // Amendment 4's P27: wait up to 10 s for the file GATE_FIXTURE_WAIT_FOR names, so a suite beside it has printed first.
    '  for (let i = 0; process.env.GATE_FIXTURE_WAIT_FOR && i < 200 && !fs.existsSync(process.env.GATE_FIXTURE_WAIT_FOR); i++) await new Promise((r) => setTimeout(r, 50));\n' +
    '  if (process.env.GATE_FIXTURE_MARKER) fs.writeFileSync(process.env.GATE_FIXTURE_MARKER, String(Date.now()));\n' +
    '  fs.chmodSync(process.env.GATE_RECORD_DIR, 0o500);\n' +
    '  return { pass: 1, fail: 0 };\n' +
    '} };\n',
  // Blocking 1, route 2 — ends the process while the engine is still loading suites.
  'exits-at-load.test.js':
    'process.exit(0); // (fixture: exits-at-load) runs while the engine loads suites, before any has run\n' +
    'module.exports = { run: async () => ({ pass: 1, fail: 0 }) };\n',
  // Blocking 1, route 3 — passes, leaving a process.exit(0) behind on a timer. Registered
  // last, the timer fires after this suite's run() has returned.
  'deferred-exit.test.js':
    'module.exports = { run: async () => { setTimeout(() => process.exit(0), 0); return { pass: 1, fail: 0 }; } };\n',
  // Blocking 1, route 4 — a run() that never settles and holds no timer or handle open.
  'never-settles.test.js': 'module.exports = { run: () => new Promise(() => {}) };\n',
  // Blocking 2 — counts that are not non-negative integers.
  'nan-fail.test.js': 'module.exports = { run: async () => ({ pass: 1, fail: NaN }) };\n',
  'negative-fail.test.js': 'module.exports = { run: async () => ({ pass: 1, fail: -1 }) };\n',
  'string-skipped.test.js': "module.exports = { run: async () => ({ pass: 1, fail: 0, skipped: '4' }) };\n",

  /* ── test-suite-hermeticity #4 (ADR test-suite-hermeticity/0002): suites that change process.env ── */

  // Leaves process.env alone, and marks that it ran.
  'env-clean.test.js': `module.exports = { run: async () => { ${MARK_RAN} return { pass: 1, fail: 0 }; } };\n`,

  // Change it when they load. Each run() would mark that it ran.
  'env-adds-at-load.test.js':
    `${envSet(E.ADDED, E.AT_LOAD)}\nmodule.exports = { run: async () => { ${MARK_RAN} return { pass: 1, fail: 0 }; } };\n`,
  'env-changes-at-load.test.js':
    `${envSet(E.PRESET, E.CHANGED_AT_LOAD)}\nmodule.exports = { run: async () => { ${MARK_RAN} return { pass: 1, fail: 0 }; } };\n`,
  'env-removes-at-load.test.js':
    `delete process.env.${E.PRESET};\nmodule.exports = { run: async () => { ${MARK_RAN} return { pass: 1, fail: 0 }; } };\n`,
  'env-throws-at-load.test.js':
    `${envSet(E.ADDED, E.AT_LOAD)}\nthrow new Error('boom after setting a key (fixture: env-throws-at-load)');\n`,
  // Adds one key and changes the other at load: what AC4's probes must never see.
  'env-leaks-at-load.test.js':
    `${envSet(E.ADDED, E.AT_LOAD)}\n${envSet(E.PRESET, E.CHANGED_AT_LOAD)}\n` +
    `module.exports = { run: async () => { ${MARK_RAN} return { pass: 1, fail: 0 }; } };\n`,
  // Sets a key on a zero-delay timer while it loads; the timer fires after every suite has loaded.
  'env-deferred-at-load.test.js':
    `setTimeout(() => { ${envSet(E.ADDED, E.LATE)} }, 0);\nmodule.exports = { run: async () => ({ pass: 1, fail: 0 }) };\n`,

  // Leave it changed after their runs: a pass, a pass, a failing run, a throw.
  'env-changes-in-run.test.js':
    `module.exports = { run: async () => { ${envSet(E.PRESET, E.CHANGED_IN_RUN)} return { pass: 2, fail: 0 }; } };\n`,
  'env-removes-in-run.test.js':
    `module.exports = { run: async () => { delete process.env.${E.PRESET}; return { pass: 2, fail: 0 }; } };\n`,
  'env-adds-in-failing-run.test.js':
    `module.exports = { run: async () => { ${envSet(E.ADDED, E.IN_RUN)} return { pass: 1, fail: 1 }; } };\n`,
  'env-throws-in-run.test.js':
    `module.exports = { run: async () => { ${envSet(E.ADDED, E.IN_RUN)} throw new Error('fetch failed after setting a key (fixture: env-throws-in-run)'); } };\n`,
  // Adds one key and changes the other in its run: what AC4's later probe must never see.
  'env-leaks-in-run.test.js':
    `module.exports = { run: async () => { ${envSet(E.ADDED, E.IN_RUN)} ${envSet(E.PRESET, E.CHANGED_IN_RUN)} return { pass: 1, fail: 0 }; } };\n`,
  // Sets one key and changes the other during its run, waits, and puts both back before run() ends.
  'env-restores-in-run.test.js':
    'module.exports = { run: async () => {\n' +
    `  const had = Object.prototype.hasOwnProperty.call(process.env, '${E.PRESET}');\n` +
    `  const was = process.env.${E.PRESET};\n` +
    `  try { ${envSet(E.ADDED, E.IN_RUN)} ${envSet(E.PRESET, E.CHANGED_IN_RUN)} await new Promise((r) => setTimeout(r, 5)); }\n` +
    `  finally { delete process.env.${E.ADDED}; if (had) process.env.${E.PRESET} = was; else delete process.env.${E.PRESET}; }\n` +
    '  return { pass: 3, fail: 0 };\n' +
    '} };\n',
  // Passes at once, leaving a write behind on a zero-delay timer.
  'env-deferred-in-run.test.js':
    `module.exports = { run: async () => { setTimeout(() => { ${envSet(E.ADDED, E.LATE)} }, 0); return { pass: 1, fail: 0 }; } };\n`,

  // AC4's probes (one source, two names): what the two keys held at load, at run, and in a child started at run.
  // Written beside the fixture as probe-<file name>.json; the run itself always passes, and the guard judges the file.
  ...Object.fromEntries(['env-probe-first.test.js', 'env-probe-last.test.js'].map((name) => [name,
    "const fs = require('fs');\n" +
    "const path = require('path');\n" +
    "const cp = require('child_process');\n" +
    `const KEYS = ${JSON.stringify([E.ADDED, E.PRESET])};\n` +
    'const look = () => Object.fromEntries(KEYS.map((k) => [k, Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : null]));\n' +
    'const atLoad = look();\n' +
    'module.exports = { run: async () => {\n' +
    '  const atRun = look();\n' +
    "  const src = `process.stdout.write(JSON.stringify(Object.fromEntries(${JSON.stringify(KEYS)}.map((k) => [k, Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : null]))))`;\n" +
    "  const child = JSON.parse(cp.execFileSync(process.execPath, ['-e', src], { encoding: 'utf8' }));\n" +
    "  fs.writeFileSync(path.join(__dirname, 'probe-' + path.basename(__filename) + '.json'), JSON.stringify({ atLoad, atRun, child }));\n" +
    '  return { pass: 1, fail: 0 };\n' +
    '} };\n',
  ])),

  /* ── test-gate-speed #1 (ADR test-gate-speed/0001): where, when and beside what each suite runs ── */

  'meet-a.test.js': meet('a', 'b'),
  'meet-b.test.js': meet('b', 'a'),
  'chatty-a.test.js': chatty('chatty-a'),
  'chatty-b.test.js': chatty('chatty-b'),
  'prints-then-hangs.test.js': hang('prints-then-hangs'),
  'slow-two.test.js': 'module.exports = { run: () => new Promise((r) => setTimeout(() => r({ pass: 1, fail: 0 }), 60000)) };\n',
  // Amendment 4 (review round 1, blocking 1): each passes its run, then fails 300 ms later, after the one macrotask the
  // engine waits; or fails as its process exits. Staging's engine failed every one of these.
  'late-throw.test.js':
    "module.exports = { run: async () => { setTimeout(() => { throw new Error('late throw (fixture: late-throw)'); }, 300); return { pass: 1, fail: 0 }; } };\n",
  'late-reject.test.js':
    "module.exports = { run: async () => { new Promise((r) => setTimeout(r, 300)).then(() => { throw new Error('late rejection (fixture: late-reject)'); }); return { pass: 1, fail: 0 }; } };\n",
  'late-exit.test.js':
    'module.exports = { run: async () => { setTimeout(() => process.exit(0), 300); return { pass: 1, fail: 0 }; } };\n',
  'exit-cleanup-throws.test.js':
    "module.exports = { run: async () => { process.on('exit', () => { throw new Error('exit cleanup throws (fixture: exit-cleanup-throws)'); }); return { pass: 1, fail: 0 }; } };\n",
  'crash-at-exit.test.js':
    "module.exports = { run: async () => { process.on('exit', () => { process.kill(process.pid, 'SIGKILL'); }); return { pass: 1, fail: 0 }; } };\n",
  // Amendment 4: leaves a 300 ms timer that does no harm, and records in late-timer-fired when it fires.
  'late-timer.test.js':
    "const fs = require('fs');\n" +
    "const path = require('path');\n" +
    "module.exports = { run: async () => { setTimeout(() => fs.writeFileSync(path.join(__dirname, 'late-timer-fired'), String(Date.now())), 300); return { pass: 1, fail: 0 }; } };\n",
  // Amendment 4: leaves an interval running forever, which keeps its process alive until something ends it.
  'leaves-interval.test.js':
    'module.exports = { run: async () => { setInterval(() => {}, 1000); return { pass: 1, fail: 0 }; } };\n',
  // Amendment 4, review round 2 (non-blocking 2): leaves a listener that swallows every error, an exit cleanup that
  // throws, and an interval open. It records its pid in hang-pid-swallows-at-exit, so a guard can end it if it hangs.
  'swallows-at-exit.test.js':
    "const fs = require('fs');\n" +
    "const path = require('path');\n" +
    'module.exports = { run: async () => {\n' +
    "  fs.writeFileSync(path.join(__dirname, 'hang-pid-swallows-at-exit'), String(process.pid));\n" +
    "  process.on('uncaughtException', () => {});\n" +
    "  process.on('exit', () => { throw new Error('exit cleanup throws (fixture: swallows-at-exit)'); });\n" +
    '  setInterval(() => {}, 1000);\n' +
    '  return { pass: 1, fail: 0 };\n' +
    '} };\n',
  // Amendment 3: records in seen-part.json what GATE_PART it sees in its run (null when unset).
  'sees-part.test.js':
    "const fs = require('fs');\n" +
    "const path = require('path');\n" +
    "module.exports = { run: async () => { fs.writeFileSync(path.join(__dirname, 'seen-part.json'), JSON.stringify({ part: process.env.GATE_PART === undefined ? null : process.env.GATE_PART })); return { pass: 1, fail: 0 }; } };\n",
  // Amendment 3's six, for the parts: sizes from about 0.1 KB to 12 KB.
  ...Object.fromEntries([0, 500, 1500, 3000, 6000, 12000].map((pad, i) => [`part-q${i + 1}.test.js`, quickSized(pad)])),
  // Amendment 2's three sizes: about 0.3 KB, 3 KB and 30 KB.
  'size-small.test.js': sized('size-small', 0),
  'size-middle.test.js': sized('size-middle', 3000),
  'size-large.test.js': sized('size-large', 30000),
  // Passes after 1.5 s: long enough that a suite started beside it at the same moment finishes first, even on a
  // loaded runner.
  'takes-a-while.test.js': 'module.exports = { run: () => new Promise((r) => setTimeout(() => r({ pass: 1, fail: 0 }), 1500)) };\n',
  // Leaves process state behind: a global, a patched core module, a changed working directory, and one load of a
  // module that counts its loads.
  'leave-state.test.js':
    "const fs = require('fs');\n" +
    "const os = require('os');\n" +
    "const path = require('path');\n" +
    "const COUNTER = path.join(__dirname, 'load-counter.js');\n" +
    'module.exports = { run: async () => {\n' +
    "  if (!fs.existsSync(COUNTER)) fs.writeFileSync(COUNTER, 'let n = 0; module.exports = () => ++n;\\n');\n" +
    '  require(COUNTER)();\n' +
    "  globalThis.__gateGuardLeak = 'left by leave-state';\n" +
    '  fs.__gateGuardPatched = true;\n' +
    '  process.chdir(os.tmpdir());\n' +
    '  return { pass: 1, fail: 0 };\n' +
    '} };\n',
  // Records in seen-state.json which of that state it meets. Its run always passes; the guard judges the file.
  'see-state.test.js':
    "const fs = require('fs');\n" +
    "const path = require('path');\n" +
    "const COUNTER = path.join(__dirname, 'load-counter.js');\n" +
    'module.exports = { run: async () => {\n' +
    "  if (!fs.existsSync(COUNTER)) fs.writeFileSync(COUNTER, 'let n = 0; module.exports = () => ++n;\\n');\n" +
    '  const seen = {\n' +
    '    leak: globalThis.__gateGuardLeak === undefined ? null : globalThis.__gateGuardLeak,\n' +
    '    patched: fs.__gateGuardPatched === true,\n' +
    '    cwd: process.cwd(),\n' +
    '    loads: require(COUNTER)(),\n' +
    '  };\n' +
    "  fs.writeFileSync(path.join(__dirname, 'seen-state.json'), JSON.stringify(seen));\n" +
    '  return { pass: 1, fail: 0 };\n' +
    '} };\n',
  // Starts a process that would live a minute, records its pid in leftover-pid, and returns without stopping it.
  'leaves-child.test.js':
    "const fs = require('fs');\n" +
    "const path = require('path');\n" +
    "const cp = require('child_process');\n" +
    'module.exports = { run: async () => {\n' +
    "  const c = cp.spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });\n" +
    '  c.unref();\n' +
    "  fs.writeFileSync(path.join(__dirname, 'leftover-pid'), String(c.pid));\n" +
    '  return { pass: 1, fail: 0 };\n' +
    '} };\n',
  // The module of an entry that carries expand (Decision 3). It records how it was called, in own-args.json.
  'own.test.js':
    "const fs = require('fs');\n" +
    "const path = require('path');\n" +
    'module.exports = { run: async (...args) => {\n' +
    "  fs.writeFileSync(path.join(__dirname, 'own-args.json'), JSON.stringify({ n: args.length, args }));\n" +
    '  return { pass: 2, fail: 0 };\n' +
    '} };\n',
};

const DRIVER_SOURCE =
  "'use strict';\n" +
  '// Drives the gate engine over a fixture registry (honest-test-gate #1 guards).\n' +
  'const { runGate } = require(process.env.GATE_FIXTURE_RUNNER);\n' +
  'const opts = { suites: JSON.parse(process.env.GATE_FIXTURE_SUITES) };\n' +
  'if (process.env.GATE_FIXTURE_RECORD_DIR) opts.recordDir = process.env.GATE_FIXTURE_RECORD_DIR;\n' +
  'if (process.env.GATE_FIXTURE_LABEL) opts.label = process.env.GATE_FIXTURE_LABEL;\n' +
  "Promise.resolve(runGate(opts)).catch((e) => { console.error('driver: runGate rejected: ' + ((e && e.stack) || e)); process.exit(99); });\n";

// test-gate-speed #1 (ADR test-gate-speed/0001 Decision 9): the same driver, with a { name, run } entry ahead of the
// fixtures. A function can't be handed to another process, so the engine must take that entry as its FAIL.
const FUNCTION_DRIVER_SOURCE =
  "'use strict';\n" +
  '// Drives the gate engine over a registry whose first entry is a function, with no file (test-gate-speed #1).\n' +
  'const { runGate } = require(process.env.GATE_FIXTURE_RUNNER);\n' +
  "const fnEntry = { name: 'a-function-suite', run: async () => ({ pass: 1, fail: 0 }) };\n" +
  'const opts = { suites: [fnEntry, ...JSON.parse(process.env.GATE_FIXTURE_SUITES)] };\n' +
  'if (process.env.GATE_FIXTURE_RECORD_DIR) opts.recordDir = process.env.GATE_FIXTURE_RECORD_DIR;\n' +
  'if (process.env.GATE_FIXTURE_LABEL) opts.label = process.env.GATE_FIXTURE_LABEL;\n' +
  "Promise.resolve(runGate(opts)).catch((e) => { console.error('driver: runGate rejected: ' + ((e && e.stack) || e)); process.exit(99); });\n";

/** A fresh temp dir with a driver, a record dir, and fixture writers. cleanup() kills children and removes it. */
function scenario() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-guard-'));
  const recordDir = path.join(dir, 'records');
  fs.mkdirSync(recordDir);
  const driver = path.join(dir, 'driver.js');
  fs.writeFileSync(driver, DRIVER_SOURCE);
  const children = new Set();
  return {
    dir,
    recordDir,
    driver,
    children,
    /** Write fixture `name` (if not yet written) and return its registry entry. */
    suite(name, skipNote) {
      const src = FIXTURE_SOURCES[name];
      if (!src) throw new Error(`gateFixtures: unknown fixture ${name}`);
      const abs = path.join(dir, name);
      if (!fs.existsSync(abs)) fs.writeFileSync(abs, src);
      const entry = { file: path.relative(TEST_DIR, abs) };
      if (skipNote) entry.skipNote = skipNote;
      return entry;
    },
    /**
     * Write EXPAND_FIXTURE (or `files`) into <dir>/<name>/, and return that folder relative to test/, the value an
     * entry's expand takes (test-gate-speed #1, ADR test-gate-speed/0001 Decision 3).
     */
    folder(name, files = EXPAND_FIXTURE) {
      const root = path.join(dir, name);
      for (const [rel, src] of Object.entries(files)) {
        const abs = path.join(root, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, src);
      }
      return path.relative(TEST_DIR, root);
    },
    cleanup() {
      for (const c of children) { try { c.kill('SIGKILL'); } catch { /* already gone */ } }
      // C11 takes write permission off the record dir (test-gate-speed #1); give it back so the dir can be removed.
      try { fs.chmodSync(recordDir, 0o700); } catch { /* already gone */ }
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Run the engine to completion over [a { name, run } entry, ...suites] (test-gate-speed #1, Decision 9). */
function runFunctionEntryEngine(sc, suites, opts = {}) {
  need('runner');
  const driver = path.join(sc.dir, 'function-driver.js');
  if (!fs.existsSync(driver)) fs.writeFileSync(driver, FUNCTION_DRIVER_SOURCE);
  const r = cp.spawnSync(process.execPath, [driver], {
    cwd: REPO,
    env: engineEnv(sc, suites, opts),
    encoding: 'utf8',
    timeout: opts.timeoutMs || 60000,
    maxBuffer: 32 * 1024 * 1024,
  });
  return { status: r.status, signal: r.signal, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
}

/** Child env for one engine run. recordDir null ⇒ exercise the default record location. */
function engineEnv(sc, suites, { label, recordDir = sc.recordDir, extraEnv } = {}) {
  const env = { ...process.env };
  delete env.GATE_LABEL;
  delete env.GATE_RECORD_DIR;
  delete env.GATE_FIXTURE_ENV_PROBE;
  // A fixture engine runs its whole fixture registry, whichever part of the outer run it runs in (test-gate-speed #1,
  // Amendment 3). The outer engine doesn't pass GATE_PART on either; this keeps a fixture run whole regardless.
  delete env.GATE_PART;
  env.GATE_FIXTURE_RUNNER = modulePath('runner');
  env.GATE_FIXTURE_SUITES = JSON.stringify(suites);
  if (recordDir) { env.GATE_FIXTURE_RECORD_DIR = recordDir; env.GATE_RECORD_DIR = recordDir; }
  if (label) env.GATE_FIXTURE_LABEL = label;
  return { ...env, ...(extraEnv || {}) };
}

/** Run the engine to completion in a child process. */
function runEngineSync(sc, suites, opts = {}) {
  need('runner');
  const r = cp.spawnSync(process.execPath, [sc.driver], {
    cwd: REPO,
    env: engineEnv(sc, suites, opts),
    encoding: 'utf8',
    timeout: opts.timeoutMs || 60000,
    maxBuffer: 32 * 1024 * 1024,
  });
  return { status: r.status, signal: r.signal, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error };
}

/**
 * Start the engine without waiting. stdoutTo: 'pipe' (default) or a file path.
 * firstMatch(re) resolves to the time the matching output first became readable.
 */
function startEngine(sc, suites, opts = {}) {
  need('runner');
  const stdoutTo = opts.stdoutTo || 'pipe';
  let fd = null;
  const stdio = ['ignore', 'pipe', 'pipe'];
  if (stdoutTo !== 'pipe') { fd = fs.openSync(stdoutTo, 'w'); stdio[1] = fd; }
  const child = cp.spawn(process.execPath, [sc.driver], { cwd: REPO, env: engineEnv(sc, suites, opts), stdio });
  if (fd !== null) fs.closeSync(fd);
  sc.children.add(child);
  const chunks = [];
  let stderr = '';
  if (child.stdout) { child.stdout.setEncoding('utf8'); child.stdout.on('data', (c) => chunks.push({ t: Date.now(), text: c })); }
  if (child.stderr) { child.stderr.setEncoding('utf8'); child.stderr.on('data', (c) => { stderr += c; }); }
  const exited = new Promise((resolve) => child.on('exit', (status, signal) => { sc.children.delete(child); resolve({ status, signal }); }));
  const output = () => (stdoutTo === 'pipe' ? chunks.map((c) => c.text).join('') : (readSafe(stdoutTo) || ''));
  function arrival(re) {
    if (stdoutTo !== 'pipe') return re.test(readSafe(stdoutTo) || '') ? Date.now() : null;
    let acc = '';
    for (const c of chunks) { acc += c.text; if (re.test(acc)) return c.t; }
    return null;
  }
  return {
    child,
    exited,
    output,
    stderr: () => stderr,
    async firstMatch(re, timeoutMs) {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const at = arrival(re);
        if (at !== null) return at;
        if (Date.now() > deadline || child.exitCode !== null || child.signalCode !== null) return arrival(re);
        await sleep(25);
      }
    },
  };
}

/* ───────────── records & reader ───────────── */

function recordFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f));
}
/** Every record in dir, parsed ({ path, rec } — rec null if unreadable). */
function readRecords(dir) {
  return recordFiles(dir).map((p) => {
    try { return { path: p, rec: JSON.parse(fs.readFileSync(p, 'utf8')) }; } catch { return { path: p, rec: null }; }
  });
}
async function waitFor(fn, timeoutMs, stepMs = 50) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(stepMs);
  }
}
/** Map suite-file basename → the record's entry for it. */
function entryMap(rec) {
  const m = {};
  for (const e of (rec && rec.suites) || []) if (e && e.file) m[path.basename(e.file)] = e;
  return m;
}

/** Run the reader (test/gate-status.js) against recordDir (null ⇒ its default). */
function runStatus(args, recordDir) {
  need('status');
  const env = { ...process.env };
  delete env.GATE_LABEL;
  if (recordDir) env.GATE_RECORD_DIR = recordDir; else delete env.GATE_RECORD_DIR;
  const r = cp.spawnSync(process.execPath, [modulePath('status'), ...args], { cwd: REPO, env, encoding: 'utf8', timeout: 20000 });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/* ───────────── shells, git, the stack-HTTP helper ───────────── */

function hasShell(name) {
  const r = cp.spawnSync(name, ['-c', 'true'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
}
function git(args) {
  const r = cp.spawnSync('git', args, { cwd: REPO, encoding: 'utf8' });
  return (r.stdout || '').trim();
}

const FAKE_DOCKER =
  '#!/bin/sh\n' +
  '# Fake `docker` for the stack-HTTP guard (honest-test-gate #1). Ignores its arguments and\n' +
  '# prints what `docker exec … curl -w "\\n__STATUS__%{http_code}"` would, per FAKE_DOCKER_MODE.\n' +
  'case "$FAKE_DOCKER_MODE" in\n' +
  "  ok)       printf '%s\\n__STATUS__%s' '{\"success\":true}' 200 ;;\n" +
  "  ok-false) printf '%s\\n__STATUS__%s' '{\"success\":false,\"error\":\"refused\"}' 200 ;;\n" +
  "  http500)  printf '%s\\n__STATUS__%s' '{\"success\":false,\"error\":\"server error\"}' 500 ;;\n" +
  '  empty)    : ;;\n' +
  "  nomarker) printf '%s' '{\"success\":true}' ;;\n" +
  "  zero)     printf '\\n__STATUS__000' ;;\n" +
  "  exit1)    echo 'Error response from daemon: No such container: tapestry' >&2; exit 1 ;;\n" +
  '  *)        echo "fake docker: unknown FAKE_DOCKER_MODE=$FAKE_DOCKER_MODE" >&2; exit 2 ;;\n' +
  'esac\n';

/** Write the fake docker into <dir>/fakebin and return that directory. */
function makeFakeDocker(dir) {
  const bin = path.join(dir, 'fakebin');
  fs.mkdirSync(bin, { recursive: true });
  const p = path.join(bin, 'docker');
  fs.writeFileSync(p, FAKE_DOCKER);
  fs.chmodSync(p, 0o755);
  return bin;
}

const PROBE_SOURCE =
  'const h = require(process.env.GATE_FIXTURE_STACKHTTP);\n' +
  "Promise.resolve(h.loopbackRequest({ container: 'tapestry', method: 'POST', url: 'http://127.0.0.1:7778/api/fixture', body: { probe: 1 }, timeoutS: 5 }))\n" +
  "  .then((r) => { console.log('__PROBE__' + JSON.stringify({ r, described: h.describeResponse(r) })); })\n" +
  "  .catch((e) => { console.log('__PROBE__' + JSON.stringify({ threw: String((e && e.message) || e) })); });\n";

/** Call loopbackRequest() in a child whose PATH finds the fake docker first. */
function probeStackHttp(binDir, mode) {
  need('stackHttp');
  const env = {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH || ''}`,
    FAKE_DOCKER_MODE: mode,
    GATE_FIXTURE_STACKHTTP: modulePath('stackHttp'),
  };
  const r = cp.spawnSync(process.execPath, ['-e', PROBE_SOURCE], { cwd: REPO, env, encoding: 'utf8', timeout: 20000 });
  const line = (r.stdout || '').split('\n').find((l) => l.startsWith('__PROBE__'));
  if (!line) return { threw: `the probe produced no result (exit ${r.status}); stderr: ${short(r.stderr)}` };
  return JSON.parse(line.slice('__PROBE__'.length));
}

module.exports = {
  REPO, TEST_DIR, ADR, MODULES, modulePath, need,
  short, sleep, readSafe, lines, firstLine, lastLine,
  FIXTURE_SOURCES, ENV_FIXTURE, EXPAND_FIXTURE, scenario, engineEnv, runEngineSync, runFunctionEntryEngine, startEngine,
  readRecords, waitFor, entryMap, runStatus,
  hasShell, git, makeFakeDocker, probeStackHttp,
};
