'use strict';
/**
 * test-suite-hermeticity #4 — a suite that leaves process.env changed fails the gate, and the change reaches no
 * other suite.
 *
 * Story: engineering-team/stories/test-suite-hermeticity/4-suite-env-changes-fail-the-gate.md
 * ADR:   engineering-team/decisions/test-suite-hermeticity/0002-gate-checks-process-env-around-every-suite.md
 * Plan:  engineering-team/stories/test-suite-hermeticity/4-suite-env-changes-fail-the-gate.test-plan.md
 *
 * PHASE-3 GUARD (ADR 0002, Implementation notes, carve-out). This story's deliverable is test infrastructure: the
 * Implementer changes test/helpers/gateRunner.js and six suites, and must NOT modify this file,
 * test/gate-result-record.test.js, test/helpers/gateFixtures.js, test/registry.js or test/stack-free-npm-test.test.js.
 *
 * Every test runs stack-free (CI runs them all), and nothing here can reach a real service:
 *   E1–E10 the engine. Each drives runGate() (test/helpers/gateRunner.js) in a child process over fixture suites
 *          (test/helpers/gateFixtures.js) in a temp dir, with records in a temp GATE_RECORD_DIR, and judges the
 *          child's exit, its output and the record it left. The child's starting environment holds
 *          GATE_ENV_FIXTURE_PRESET and never GATE_ENV_FIXTURE_ADDED.
 *   S1–S6  the six suites the story names. Each is loaded and run in a child of its own, directly (not through the
 *          engine), and the child compares its own process.env before and after. These judge the suites alone, so
 *          they fail before the engine changes as well as after. S2 is the exception, passing today: its suite
 *          doesn't leak after all (ADR 0002, Amendment 1), and S2 keeps it that way.
 * Every child gets dead endpoints: closed ports, TAPESTRY_CONTAINER=no-such-container, a conf whose Neo4j is a closed
 * port, and fake curl and docker first on PATH. tl-weighted-sum-method's live layer, for one, writes the container's
 * settings.json.
 *
 * This file sets nothing in process.env: the gate would judge it by the very check it tests, and every value a child
 * needs goes in that child's env. Pre-implementation every E test fails with a message naming what ADR 0002 asks
 * of the engine, and every S test but S2 with the keys its suite leaves changed — never with an import crash.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const F = require('./helpers/gateFixtures');

const { short, ENV_FIXTURE: E } = F;
const ADR = 'ADR test-suite-hermeticity/0002';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

/* ───────────── nothing here may reach a real service ───────────── */

/** Closed endpoints and fake curl/docker for a child, written under dir. */
function deadEnv(dir) {
  const bin = path.join(dir, 'deadbin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/sh\nexit 7\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'docker'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const conf = path.join(dir, 'dead.conf');
  fs.writeFileSync(conf, 'NEO4J_URI="bolt://127.0.0.1:9"\nNEO4J_USER="none"\nNEO4J_PASSWORD="none"\n');
  return {
    PATH: `${bin}${path.delimiter}${process.env.PATH || ''}`,
    BRAINSTORM_CONF_PATH: conf,
    NEO4J_URI: 'bolt://127.0.0.1:9',
    BRAINSTORM_BASE_URL: 'http://127.0.0.1:9',
    CONCEPT_GRAPH_URL: 'http://127.0.0.1:9',
    TAPESTRY_API_BASE: 'http://127.0.0.1:9',
    TAPESTRY_PORT: '9',
    MEILI_URL_HOST: 'http://127.0.0.1:9',
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '9',
    TAPESTRY_CONTAINER: 'no-such-container',
  };
}

/* ───────────── the engine over fixtures ───────────── */

/** Run the engine over the named fixtures; the child's environment holds PRESET and not ADDED. */
function engineRun(names, why) {
  F.need('runner');
  assert(!Object.prototype.hasOwnProperty.call(process.env, E.ADDED) && !Object.prototype.hasOwnProperty.call(process.env, E.PRESET),
    `${why}: precondition: this process must not hold ${E.ADDED} or ${E.PRESET}, or the fixtures' starting environment is not the one the checks assume`);
  const sc = F.scenario();
  const r = F.runEngineSync(sc, names.map((n) => sc.suite(n)), { extraEnv: { ...deadEnv(sc.dir), [E.PRESET]: E.PRESET_VALUE } });
  const recs = F.readRecords(sc.recordDir);
  const rec = recs.length === 1 ? recs[0].rec : null;
  const recordText = recs.length === 1 ? (F.readSafe(recs[0].path) || '') : '';
  return { sc, r, rec, recordText, byFile: F.entryMap(rec), why };
}

function within(run, fn) { try { return fn(run); } finally { run.sc.cleanup(); } }

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
/** The per-suite result lines ([i/N] … PASS|FAIL|SKIP …) for one fixture. */
function resultLines(stdout, file) {
  const name = file.replace(/\.test\.js$/, '');
  const re = new RegExp(`(^|[\\s/\\\\\\[\\]:])${escRe(name)}(\\.test\\.js)?(?![\\w.-])`);
  return F.lines(stdout).filter((l) => /\[\d+\/\d+\]/.test(l) && re.test(l) && /\b(PASS|FAIL|SKIP)\b/.test(l));
}

/** The run as a whole ended FAIL with exit 1, and said so last. */
function endsFail({ r, rec, why }) {
  assert(rec, `${why}: the run must leave exactly one readable record; stderr: ${short(r.stderr)}`);
  assert(r.status === 1, `${why}: the run must end FAIL with exit 1; it exited ${r.status} (signal ${r.signal}). Last line: ${JSON.stringify(F.lastLine(r.stdout))}`);
  assert(/^Overall: FAIL\b/.test(F.lastLine(r.stdout)), `${why}: the last line must be the verdict, Overall: FAIL; got ${JSON.stringify(F.lastLine(r.stdout))}`);
  assert(rec.verdict === 'FAIL' && rec.exitCode === 1, `${why}: the record must hold FAIL / exit 1; got ${rec.verdict} / exit ${rec.exitCode}`);
}

/**
 * One fixture's entry says it changed process.env: FAIL, the key named in its error and its printed result line,
 * and the record's envChanged naming the phase and the key under the right kind (ADR 0002, Decision, rules 4 and 6,
 * and "The record").
 */
function changedEntry(run, file, { phase, kind, key }) {
  const entry = run.byFile[file];
  assert(entry, `${run.why}: the record has no entry for ${file}; entries: ${short(Object.keys(run.byFile))}`);
  assert(entry.verdict === 'FAIL',
    `${run.why}: ${file} ${kind} ${key} ${phase === 'load' ? 'when it loaded' : 'in its run'}, so it must be recorded FAIL (${ADR}, Decision, rule ${phase === 'load' ? 4 : 6}); got ${entry.verdict} — entry ${short(entry)}`);
  assert(typeof entry.error === 'string' && entry.error.includes(key) && /process\.env/.test(entry.error),
    `${run.why}: ${file}'s error must say it changed process.env and name ${key}; got ${JSON.stringify(entry.error)}`);
  const lines = resultLines(run.r.stdout, file);
  assert(lines.some((l) => l.includes(key)),
    `${run.why}: ${file}'s printed result line must name ${key}; its lines: ${short(lines)}`);
  const ec = entry.envChanged;
  assert(ec && ec.phase === phase && Array.isArray(ec[kind]) && ec[kind].includes(key),
    `${run.why}: ${file}'s record entry must carry envChanged { phase: '${phase}', ${kind}: [..'${key}'..] } (${ADR}, "The record"); got ${JSON.stringify(ec)}`);
  return entry;
}

function ran(run, file) { return fs.existsSync(path.join(run.sc.dir, `ran-${file}`)); }

/** A fixture that changed nothing passed, and its record says it changed nothing. */
function untouchedEntry(run, file, counts) {
  const entry = run.byFile[file];
  assert(entry && entry.verdict === 'PASS',
    `${run.why}: ${file} leaves process.env as it found it, so it must keep its PASS; got ${short(entry)}`);
  if (counts) {
    assert(entry.pass === counts.pass && entry.fail === counts.fail && entry.skipped === counts.skipped,
      `${run.why}: ${file} must keep its own counts ${JSON.stringify(counts)}; got pass ${entry.pass}, fail ${entry.fail}, skipped ${entry.skipped}`);
  }
  assert(entry.envChanged === null,
    `${run.why}: ${file}'s record entry must carry envChanged: null, saying it changed nothing (${ADR}, "The record"); got ${JSON.stringify(entry.envChanged)}`);
  return entry;
}

/** What a probe fixture saw, from the file it left. */
function probeSaw(run, file) {
  const text = F.readSafe(path.join(run.sc.dir, `probe-${file}.json`));
  assert(text, `${run.why}: precondition: ${file} must run and leave its observations; its entry: ${short(run.byFile[file])}`);
  return JSON.parse(text);
}

/** A probe saw the starting environment at load, at run, and in a child it started (story AC4). */
function sawStart(run, file) {
  const seen = probeSaw(run, file);
  const want = { [E.ADDED]: null, [E.PRESET]: E.PRESET_VALUE };
  for (const when of ['atLoad', 'atRun', 'child']) {
    const got = seen[when] || {};
    const off = Object.keys(want).filter((k) => got[k] !== want[k]);
    const what = { atLoad: 'when it loaded', atRun: 'when it ran', child: 'in a child process it started' };
    assert(off.length === 0,
      `${run.why}: ${file} must see the environment the gate began with ${what[when]} — ${E.ADDED} unset and ${E.PRESET} at its starting value — but ${off.join(' and ')} differed. Another suite's change reached it (${ADR}, Decision; story AC4).`);
  }
}

/* ═══ AC1 — a change at load fails that suite ═══════════════════════════════════════ */

test('E1 (AC1): a suite that adds, changes or removes a process.env key when it loads is that suite\'s FAIL, naming the key, and is never run; a suite beside it that changes nothing passes, and the run ends FAIL with exit 1', () => {
  within(engineRun(['env-clean.test.js', 'env-adds-at-load.test.js', 'env-changes-at-load.test.js', 'env-removes-at-load.test.js'], 'E1'), (run) => {
    assert(ran(run, 'env-clean.test.js'), `E1: env-clean must run (it leaves a marker) — the run reached its suites; its entry: ${short(run.byFile['env-clean.test.js'])}`);
    for (const [file, kind, key] of [
      ['env-adds-at-load.test.js', 'added', E.ADDED],
      ['env-changes-at-load.test.js', 'changed', E.PRESET],
      ['env-removes-at-load.test.js', 'removed', E.PRESET],
    ]) {
      const entry = changedEntry(run, file, { phase: 'load', kind, key });
      assert(entry.pass === 0 && entry.fail === 1 && entry.skipped === 0,
        `E1: a suite that changed process.env when it loaded is not run, so its result is { pass: 0, fail: 1, skipped: 0 } (${ADR}, Decision, rule 4); ${file} has pass ${entry.pass}, fail ${entry.fail}, skipped ${entry.skipped}`);
      assert(!ran(run, file),
        `E1: ${file} changed process.env when it loaded, so its run() must never be attempted — with the starting environment put back, a suite that set dead endpoints at load would reach real ones (${ADR}, Decision, rule 4). It ran.`);
    }
    untouchedEntry(run, 'env-clean.test.js', { pass: 1, fail: 0, skipped: 0 });
    endsFail(run);
  });
});

test('E2 (AC1): a load that changes a key and then throws is that suite\'s FAIL carrying both — its load error first, then the key', () => {
  within(engineRun(['env-throws-at-load.test.js', 'env-clean.test.js'], 'E2'), (run) => {
    const entry = changedEntry(run, 'env-throws-at-load.test.js', { phase: 'load', kind: 'added', key: E.ADDED });
    assert(/failed to load/.test(entry.error) && entry.error.includes('boom after setting a key'),
      `E2: the entry must keep its load error (failed to load: boom after setting a key …) as well as the env change; got ${JSON.stringify(entry.error)}`);
    assert(entry.error.indexOf('boom after setting a key') < entry.error.indexOf(E.ADDED),
      `E2: the load error comes first, then the env change (${ADR}, Decision, rule 4); got ${JSON.stringify(entry.error)}`);
    untouchedEntry(run, 'env-clean.test.js', { pass: 1, fail: 0, skipped: 0 });
    endsFail(run);
  });
});

test('E3 (AC1, AC4): a key set by a timer a suite left while loading fails the run as a stray change, naming the key, and the suites that run after it see the environment the gate began with', () => {
  within(engineRun(['env-deferred-at-load.test.js', 'brief.test.js', 'env-probe-last.test.js'], 'E3'), (run) => {
    sawStart(run, 'env-probe-last.test.js');
    const strays = (run.rec && run.rec.strayErrors) || [];
    assert(strays.some((s) => String(s.message).includes(E.ADDED) && /process\.env/.test(String(s.message))),
      `E3: the change, found once the suites have loaded, must be recorded in strayErrors naming ${E.ADDED} (${ADR}, Decision, rule 5); strayErrors: ${short(strays)}`);
    const brief = run.byFile['brief.test.js'];
    assert(brief && brief.verdict === 'PASS', `E3: brief.test.js changed nothing and must pass; got ${short(brief)}`);
    endsFail(run);
  });
});

/* ═══ AC2 — a change left after the run fails that suite ════════════════════════════ */

test('E4 (AC2): a suite whose run leaves a key added, changed or removed is that suite\'s FAIL, naming the key, with its own counts plus one failed check; a suite beside it that changes nothing passes', () => {
  within(engineRun(['env-writer.test.js', 'env-changes-in-run.test.js', 'env-removes-in-run.test.js', 'env-clean.test.js'], 'E4'), (run) => {
    for (const [file, kind, key, own] of [
      ['env-writer.test.js', 'added', E.PROBE, { pass: 1, fail: 0 }],
      ['env-changes-in-run.test.js', 'changed', E.PRESET, { pass: 2, fail: 0 }],
      ['env-removes-in-run.test.js', 'removed', E.PRESET, { pass: 2, fail: 0 }],
    ]) {
      const entry = changedEntry(run, file, { phase: 'run', kind, key });
      assert(entry.pass === own.pass && entry.fail === own.fail + 1,
        `E4: ${file} returned ${JSON.stringify(own)}; leaving process.env changed adds one failed check (${ADR}, Decision, rule 6), so its counts must be pass ${own.pass}, fail ${own.fail + 1}; got pass ${entry.pass}, fail ${entry.fail}`);
    }
    untouchedEntry(run, 'env-clean.test.js', { pass: 1, fail: 0, skipped: 0 });
    endsFail(run);
  });
});

test('E5 (AC2): a run that fails, or throws, and leaves a key changed is that suite\'s FAIL carrying both its own failure and the key', () => {
  within(engineRun(['env-adds-in-failing-run.test.js', 'env-throws-in-run.test.js', 'env-clean.test.js'], 'E5'), (run) => {
    const failing = changedEntry(run, 'env-adds-in-failing-run.test.js', { phase: 'run', kind: 'added', key: E.ADDED });
    assert(failing.pass === 1 && failing.fail === 2,
      `E5: env-adds-in-failing-run returned { pass: 1, fail: 1 } and left a key changed: pass 1, fail 2 (${ADR}, Decision, rule 6); got pass ${failing.pass}, fail ${failing.fail}`);
    const threw = changedEntry(run, 'env-throws-in-run.test.js', { phase: 'run', kind: 'added', key: E.ADDED });
    assert(threw.error.includes('fetch failed after setting a key (fixture: env-throws-in-run)'),
      `E5: the throwing suite keeps its own error as well as the env change; got ${JSON.stringify(threw.error)}`);
    assert(threw.error.indexOf('fetch failed after setting a key') < threw.error.indexOf(E.ADDED),
      `E5: its own error comes first, then the env change (${ADR}, Decision, rule 6); got ${JSON.stringify(threw.error)}`);
    assert(threw.fail === 2, `E5: a throw is one failed check and the env change another (${ADR}, Decision, rule 6); got fail ${threw.fail}`);
    untouchedEntry(run, 'env-clean.test.js', { pass: 1, fail: 0, skipped: 0 });
    endsFail(run);
  });
});

test('E6 (AC2): a suite that changes keys during its run and puts them back before the run ends keeps its result, and the run passes', () => {
  within(engineRun(['env-restores-in-run.test.js', 'env-clean.test.js'], 'E6'), (run) => {
    assert(run.rec, `E6: the run must leave exactly one readable record; stderr: ${short(run.r.stderr)}`);
    untouchedEntry(run, 'env-restores-in-run.test.js', { pass: 3, fail: 0, skipped: 0 });
    untouchedEntry(run, 'env-clean.test.js', { pass: 1, fail: 0, skipped: 0 });
    assert(run.r.status === 0 && /^Overall: PASS\b/.test(F.lastLine(run.r.stdout)),
      `E6: nothing was left changed, so the run must pass with exit 0; it exited ${run.r.status} with ${JSON.stringify(F.lastLine(run.r.stdout))}`);
  });
});

test('E7 (AC2, AC4): a key a suite sets on a zero-delay timer after its run resolves counts against that suite, not the one after it', () => {
  within(engineRun(['env-deferred-in-run.test.js', 'brief.test.js'], 'E7'), (run) => {
    changedEntry(run, 'env-deferred-in-run.test.js', { phase: 'run', kind: 'added', key: E.ADDED });
    untouchedEntry(run, 'brief.test.js', { pass: 1, fail: 0, skipped: 0 });
    endsFail(run);
  });
});

/* ═══ AC3 — names, never values ═════════════════════════════════════════════════════ */

test('E8 (AC3): a run full of env changes names every changed key, and no value — written by a suite, or the one the gate began with — appears in its output or its record', () => {
  within(engineRun([
    'env-adds-at-load.test.js', 'env-changes-at-load.test.js', 'env-removes-at-load.test.js', 'env-throws-at-load.test.js',
    'env-writer.test.js', 'env-changes-in-run.test.js', 'env-removes-in-run.test.js', 'env-adds-in-failing-run.test.js',
    'env-throws-in-run.test.js', 'env-clean.test.js',
  ], 'E8'), (run) => {
    assert(run.rec, `E8: the run must leave exactly one readable record; stderr: ${short(run.r.stderr)}`);
    for (const key of [E.ADDED, E.PRESET, E.PROBE]) {
      assert(run.r.stdout.includes(key) && run.recordText.includes(key),
        `E8: the changed key ${key} must be named in the run's output and in its record (${ADR}, Decision, "Names, never values") — `
        + `output ${run.r.stdout.includes(key) ? 'names' : 'does not name'} it, the record ${run.recordText.includes(key) ? 'names' : 'does not name'} it`);
    }
    const leaks = [];
    for (const value of E.VALUES) {
      if (run.r.stdout.includes(value)) leaks.push(`stdout holds ${value}`);
      if (run.r.stderr.includes(value)) leaks.push(`stderr holds ${value}`);
      if (run.recordText.includes(value)) leaks.push(`the record holds ${value}`);
    }
    assert(leaks.length === 0,
      `E8: a process.env value can be a secret and CI's log is public, so the gate names keys and never values (story AC3): ${leaks.join('; ')}`);
  });
});

/* ═══ AC4 — the change goes no further ══════════════════════════════════════════════ */

test('E9 (AC4): a suite that changes keys when it loads changes nothing for the suites before and after it — at their load, at their run, or in a child they start', () => {
  within(engineRun(['env-probe-first.test.js', 'env-leaks-at-load.test.js', 'env-probe-last.test.js'], 'E9'), (run) => {
    sawStart(run, 'env-probe-first.test.js');
    sawStart(run, 'env-probe-last.test.js');
    changedEntry(run, 'env-leaks-at-load.test.js', { phase: 'load', kind: 'added', key: E.ADDED });
    endsFail(run);
  });
});

test('E10 (AC4): a suite that leaves keys changed after its run changes nothing for the suites around it — at their load, at their run, or in a child they start', () => {
  within(engineRun(['env-probe-first.test.js', 'env-leaks-in-run.test.js', 'env-probe-last.test.js'], 'E10'), (run) => {
    sawStart(run, 'env-probe-first.test.js');
    sawStart(run, 'env-probe-last.test.js');
    changedEntry(run, 'env-leaks-in-run.test.js', { phase: 'run', kind: 'changed', key: E.PRESET });
    endsFail(run);
  });
});

/* ═══ AC5 — the six suites put back what they change ════════════════════════════════ */

// Runs in a child: loads one suite and runs it, comparing this process's environment before the load, after it, and
// after the run (plus one macrotask, as the engine waits), then writes key names only to GATE_ENV_REPORT.
const SUITE_CHILD =
  "'use strict';\n" +
  "const fs = require('fs');\n" +
  'const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);\n' +
  'const snap = () => Object.assign({}, process.env);\n' +
  'const diff = (a, b) => ({\n' +
  '  added: Object.keys(b).filter((k) => !has(a, k)).sort(),\n' +
  '  removed: Object.keys(a).filter((k) => !has(b, k)).sort(),\n' +
  '  changed: Object.keys(a).filter((k) => has(b, k) && a[k] !== b[k]).sort(),\n' +
  '});\n' +
  'const report = process.env.GATE_ENV_REPORT;\n' +
  'const out = (o) => fs.writeFileSync(report, JSON.stringify(o));\n' +
  'const start = snap();\n' +
  'let mod;\n' +
  'try { mod = require(process.env.GATE_ENV_SUITE); } catch (e) { out({ loadError: String((e && e.message) || e), atLoad: diff(start, snap()) }); process.exit(0); }\n' +
  'const atLoad = diff(start, snap());\n' +
  'const afterLoad = snap();\n' +
  'const settle = () => new Promise((r) => setTimeout(r, 0));\n' +
  'Promise.resolve().then(() => mod.run()).then(\n' +
  '  (res) => settle().then(() => out({ atLoad, afterRun: diff(afterLoad, snap()), result: res ? { pass: res.pass, fail: res.fail, skipped: res.skipped } : null })),\n' +
  '  (e) => settle().then(() => out({ atLoad, afterRun: diff(afterLoad, snap()), runError: String((e && e.message) || e) })),\n' +
  ').then(() => process.exit(0), (e) => { console.error(e); process.exit(3); });\n';

const SUITE_KEYS = {
  'search-api-result-type-settings.test.js': { key: 'TAPESTRY_SETTINGS_PATH', preset: true },
  'strfry-router-saved-state.test.js': { key: 'BRAINSTORM_ROUTER_PLUGINS_DIR', preset: true },
  'tl-certainty-method.test.js': { key: 'TAPESTRY_SETTINGS_PATH', preset: true },
  'tl-membership-method-selector.test.js': { key: 'TAPESTRY_SETTINGS_PATH', preset: true },
  'tl-weighted-sum-method.test.js': { key: 'TAPESTRY_SETTINGS_PATH', preset: true },
  'trusted-list-pin-publish-blockers.test.js': { key: 'SCHEDULED_TASKS_CONFIG_PATH', preset: true },
};

/**
 * Load and run one suite in a child, its key unset or (preset) set to a path in a temp directory that exists but
 * holds no file; return what the child reports.
 */
function suiteInChild(file, { key, preset }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'suite-env-'));
  try {
    const driver = path.join(dir, 'suite-child.js');
    fs.writeFileSync(driver, SUITE_CHILD);
    const reportFile = path.join(dir, 'report.json');
    const env = { ...process.env, ...deadEnv(dir), GATE_ENV_SUITE: path.join(F.TEST_DIR, file), GATE_ENV_REPORT: reportFile };
    delete env.TAPESTRY_CONTAINER_PORT;
    delete env.GATE_LABEL;
    delete env.GATE_RECORD_DIR;
    if (preset) {
      fs.mkdirSync(path.join(dir, 'preset'));
      env[key] = path.join(dir, 'preset', 'preset.json');
    } else {
      delete env[key];
    }
    const r = cp.spawnSync(process.execPath, [driver], { cwd: F.REPO, env, encoding: 'utf8', timeout: 120000, maxBuffer: 32 * 1024 * 1024 });
    const text = F.readSafe(reportFile);
    assert(text, `${file}: the child left no report (exit ${r.status}, signal ${r.signal}); stderr: ${short(r.stderr)}`);
    return JSON.parse(text);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

function describe(d) {
  return ['added', 'changed', 'removed'].filter((k) => d[k].length).map((k) => `${k} ${d[k].join(', ')}`).join('; ');
}

function suiteLeavesEnvAlone(file) {
  const { key, preset } = SUITE_KEYS[file];
  const modes = [{ label: `${key} unset`, preset: false }];
  if (preset) modes.push({ label: `${key} preset to a temp path`, preset: true });
  const problems = [];
  for (const mode of modes) {
    const rep = suiteInChild(file, { key, preset: mode.preset });
    if (rep.loadError) { problems.push(`${mode.label}: the suite failed to load in the child — ${rep.loadError}`); continue; }
    if (rep.runError) problems.push(`${mode.label}: the suite's run() threw in the child — ${rep.runError}`);
    else if (!rep.result || typeof rep.result.pass !== 'number' || typeof rep.result.fail !== 'number') {
      problems.push(`${mode.label}: the suite's run() returned no counts (${short(rep.result)}), so the run that should put its keys back may not have happened`);
    }
    const loadChange = describe(rep.atLoad);
    const runChange = describe(rep.afterRun || { added: [], changed: [], removed: [] });
    if (loadChange) problems.push(`${mode.label}: loading it left process.env changed: ${loadChange}`);
    if (runChange) problems.push(`${mode.label}: its run left process.env changed: ${runChange}`);
  }
  assert(problems.length === 0,
    `${file} must leave process.env as it found it — put each key back before run() ends, deleting one that was unset (story AC5; ${ADR}, Implementation notes §2):\n      - ${problems.join('\n      - ')}`);
}

test('S1 (AC5): search-api-result-type-settings puts TAPESTRY_SETTINGS_PATH back as it found it, unset or set', () => {
  suiteLeavesEnvAlone('search-api-result-type-settings.test.js');
});

// A regression guard, passing today: the suite's run() holds BRAINSTORM_ROUTER_PLUGINS_DIR for the whole run and puts
// it back in a finally, so P3's restore by assignment never meets an unset key (ADR 0002, Amendment 1).
test('S2 (AC5): strfry-router-saved-state leaves BRAINSTORM_ROUTER_PLUGINS_DIR as it found it, unset or set — never holding the string "undefined"', () => {
  suiteLeavesEnvAlone('strfry-router-saved-state.test.js');
});

test('S3 (AC5): tl-certainty-method puts TAPESTRY_SETTINGS_PATH back as it found it, unset or set', () => {
  suiteLeavesEnvAlone('tl-certainty-method.test.js');
});

test('S4 (AC5): tl-membership-method-selector puts TAPESTRY_SETTINGS_PATH back as it found it, unset or set', () => {
  suiteLeavesEnvAlone('tl-membership-method-selector.test.js');
});

test('S5 (AC5): tl-weighted-sum-method puts TAPESTRY_SETTINGS_PATH back as it found it, unset or set', () => {
  suiteLeavesEnvAlone('tl-weighted-sum-method.test.js');
});

test('S6 (AC5): trusted-list-pin-publish-blockers puts SCHEDULED_TASKS_CONFIG_PATH back as it found it, unset or set', () => {
  suiteLeavesEnvAlone('trusted-list-pin-publish-blockers.test.js');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- suite env changes fail the gate (epic test-suite-hermeticity, Story 4) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      if (err && err.skipped) { console.log(`  SKIP  ${name} (${err.message})`); skipped++; continue; }
      console.log(`  FAIL  ${name}\n        ${err && err.message}`);
      failures.push({ name, message: err && err.message });
      fail++;
    }
  }
  console.log(`\nsuite-env-changes: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
