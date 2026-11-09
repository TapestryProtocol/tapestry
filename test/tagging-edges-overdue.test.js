'use strict';
/**
 * Tests for Story 7 (epic tagging-edges) — the overdue-pass verdict: is the gap-filling pass overdue, judged on the
 * server from the schedule's entries, the latest pass's start and the server's own clock, and served on the public
 * status.
 *
 * Story: engineering-team/stories/done/tagging-edges/7-confirm-held-removals.md — AC-5 (When: an enabled entry's interval
 *        plus one hour, 25 hours for the daily entry; a calendar rule by the longest time between two runs in a row,
 *        03:00 every day = 24 hours; the most frequent of several; a refused or failed pass counts as begun; a waiting
 *        or given-up pass has not begun. No warning with no enabled entry, or no pass on record. "When it cannot
 *        tell" … "A missing warning never stands for on time". "The same for every viewer", whatever their clock. "It
 *        clears within 10 seconds of a new pass beginning". "It is only a warning"), and § Test tasks "Server or view
 *        cases for AC-5".
 * ADR:   engineering-team/decisions/done/tagging-edges/0007-confirm-held-removals.md — D8 (src/lib/tagging-edges/
 *        overdue.js overdueVerdict; the cron period; readConfigStrict; handleStatus's `overdue` member), D6 (`overdue`
 *        is a new status member, computed per request from server time), R12, R13.
 *
 * Intentionally failing until the implementation lands (red phase): src/pipeline/tagging-edges/overdue.js and
 * scheduled-tasks' readConfigStrict do not exist yet, and handleStatus serves no `overdue`. Each module is loaded
 * inside its test, so the suite always loads and every test fails on its own with a message naming what is missing.
 *
 * Classes (all OV):
 *   OV1        the module: exports overdueVerdict, loads with no I/O.
 *   OV2–OV4    no warning to give: no enabled entry for the pass (no-entry), none that runs it (no-schedule), no pass
 *              on record (no-pass).
 *   OV5–OV8    an interval entry: the 25-hour boundary for the daily entry, the times it carries, the most frequent of
 *              several, a refused latest and a running latest.
 *   OV9–OV12   a calendar rule, judged by the real cron-parser (in a child process with TZ=UTC, the container's zone):
 *              03:00 every day is 24 h, weekdays 72 h, a cron wins over interval fields, a rule with fewer than two
 *              runs in 400 days cannot be judged (R13).
 *   OV13–OV14  cannot tell: a start time that does not parse; only unjudged rules.
 *   OV15       clock-free: the verdict comes from nowMs alone.
 *   OV16–OV18  readConfigStrict (D8 "The reader"): it throws on a read or parse error, seeds a fresh install like
 *              readConfig, and readConfig still swallows.
 *   OV19–OV23  handleStatus's `overdue` member (D6, D8): served from the injected reader and the server's now; a
 *              reader that throws → cannot-tell, never a 500; it clears when a new pass begins; no who; the server's
 *              clock, not the host's.
 *   OV24–OV29  added at story 7's fix round (2026-11-07; its review, round 1, requested 4, 6 and 7; ADR 0007
 *              § Fix-round notes, D8):
 *              OV24  the status's own default schedule reader (readConfigStrict over SCHEDULED_TASKS_CONFIG_PATH), with
 *                    no reader injected. Green on purpose: the default works today, and no other test reaches it.
 *              OV25  more than 32 distinct cron patterns: none is judged, cannot-tell/rule. Red until the fix.
 *              OV26  a second status read with 33 patterns makes no parse call (nor does the first). Red until the fix.
 *              OV27  a pattern longer than 256 characters is not judged; one of exactly 256 still is. Red until the fix.
 *              OV28  exactly 32 distinct patterns are still judged, and only the pass's enabled entries count. Green on
 *                    purpose: the boundary the fix must keep.
 *              OV29  a throw from the verdict (an entry that cannot become a string or a number) is
 *                    cannot-tell/schedule and a 200, never a 500. Red until the fix.
 *   OV27, OV30 at story 7's fix round 2 (2026-11-08; its review, round 2, blocking 1 and requested 4; ADR 0007
 *              § Fix-round notes, round 2, D8):
 *              OV27  revised: a pattern longer than 256 characters makes the verdict cannot-tell/rule whatever stands
 *                    beside it. Its case beside a daily interval entry said on time, which was false; it is flipped,
 *                    and a case beside the daily cron rule is added. Both are red until the fix.
 *              OV30  more than 32 distinct patterns beside an interval entry are still cannot-tell/rule. Green on
 *                    purpose: round 1's bound already does this, and no test ran it beside an interval.
 *
 * Choices this suite makes where the ADR leaves a detail open:
 *   - overdueVerdict filters its `entries` itself (D8's first rule: "the schedule entries with taskId
 *     'reconcileTaggingEdges' and enabled === true"), so it is handed every entry; another task's entries and disabled
 *     ones never count.
 *   - With no `periodOf` given, overdueVerdict judges a cron with its own real judge (cron-parser, D8). A test that
 *     injects `periodOf` checks only the arithmetic around it.
 *   - The overdue boundary is D8's letter: overdue when nowMs > expectedAt + 3,600,000, so exactly 25 h after a daily
 *     pass began is still on time.
 *   - `readScheduleEntries()` (D8 "a new dep calling readConfigStrict()") resolves to the entries array. handleStatus
 *     passes it to overdueVerdict; the tests inject it.
 *   - The `overdue` member's keys are closed: state, and only reason, latestBeganAt, expectedAt and periodMs beside it.
 *   - Times on the member are ISO strings (D8 "ISO times").
 *   - Fix round, the default reader (OV24): handleStatus gets no readScheduleEntries key at all (not one set to
 *     undefined, which would replace the default). SCHEDULED_TASKS_CONFIG_PATH names a temp file, and the Scheduled
 *     Tasks module is dropped from require's cache first, since it fixes its CONFIG_PATH when it loads. The runner puts
 *     the env and the cache back after each test.
 *   - Fix round, counting the cron work (OV25–OV28): each case runs in its own child with TZ=UTC. There, cron-parser's
 *     parseExpression is wrapped before the verdict's module loads, so a parse is seen however the module reaches it.
 *     The periodOf spy, where one is given, is the child's own.
 *     - The rules that fill the cache are monthly ones (`<m> 3 1 * *`, a 31-day period), which are cheap to judge, so
 *       the red run stays short.
 *     - "Distinct" is by the trimmed pattern. Entries that repeat a pattern count it once, and only the pass's enabled
 *       entries count.
 *     - The 256-character boundary is "0 3 * * *" with its first gap widened by spaces (cron-parser splits on any
 *       whitespace), so both sides of it are the same daily rule. The other long rule is written out as lists: 319
 *       characters, every minute.
 *     - A rule that is not judged for its length makes the verdict cannot-tell/rule, alone or beside others. (Until
 *       fix round 2 it was counted with no period, as R13's are, so another entry's period decided; review round 2,
 *       blocking 1.)
 *   - Fix round, a throw from the verdict (OV29): the entries come from JSON.parse, as a hand-edited file gives them.
 *     The status answers cannot-tell/schedule, as for a schedule that cannot be read: that is the fix-round D8 note.
 *     A verdict that answered something else for such entries would not be what the note says.
 *
 * Module path (revised 2026-11-07, at Implementation, on the owner's decision): src/pipeline/tagging-edges/overdue.js,
 * not src/lib/tagging-edges/. Story 1's purity pin (test/tagging-edge-contract.test.js) refuses dates and any require
 * but a sibling in src/lib/tagging-edges/, and the cron judge needs both (ADR 0007 D8's dated note). The tests are
 * otherwise unchanged.
 *
 * Hermetic: pure functions, a child process with TZ=UTC for the real cron judge, a temp SCHEDULED_TASKS_CONFIG_PATH
 * for the reader (set before the Scheduled Tasks module is required, and the module dropped from require's cache
 * after), and handleStatus with every dep injected (OV24 leaves out only the schedule reader, over a temp file). No
 * Redis, network, graph or /var/lib/brainstorm.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const LIB = 'src/pipeline/tagging-edges/overdue.js';
const SCHED = 'src/api/scheduled-tasks/index.js';
const INDEX = 'src/api/tagging-edges/index.js';
const D8 = 'ADR tagging-edges/0007 D8';
const D6 = 'ADR tagging-edges/0007 D6';
const TASK = 'reconcileTaggingEdges';

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = Date.parse('2026-11-07T12:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const OVERDUE_KEYS = ['state', 'reason', 'latestBeganAt', 'expectedAt', 'periodMs'];
const OWNER = 'a1b2c3d4'.repeat(8);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

function forget(rel) {
  let resolved;
  try { resolved = require.resolve(path.join(REPO, rel)); } catch (_) { return; }
  delete require.cache[resolved];
}
function load(rel, names, ref) {
  const abs = path.join(REPO, rel);
  let mod;
  try {
    mod = require(abs);
  } catch (e) {
    const head = String((e && e.message) || e).split('\n')[0];
    const absent = e && e.code === 'MODULE_NOT_FOUND' && head.includes(abs);
    assert.fail(absent
      ? `${rel} does not exist yet (${ref}): expected a module exporting ${names.join(', ')}`
      : `${rel} did not load (${ref}): ${head}`);
  }
  const missing = names.filter((n) => !mod || typeof mod[n] !== 'function');
  if (missing.length) {
    assert.fail(`${rel} does not export ${missing.map((n) => `${n}()`).join(', ')} yet (${ref}); it exports ${Object.keys(mod || {}).sort().join(', ') || 'nothing'}`);
  }
  return mod;
}
const lib = () => load(LIB, ['overdueVerdict'], D8);

function entry(o = {}) {
  return {
    id: o.id || 'entry-1',
    taskId: o.taskId || TASK,
    label: 'Reconcile tagging relationships',
    args: {},
    enabled: o.enabled === undefined ? true : o.enabled,
    intervalDays: o.intervalDays === undefined ? 1 : o.intervalDays,
    intervalHours: o.intervalHours || 0,
    intervalMinutes: o.intervalMinutes || 0,
    cron: o.cron || '',
  };
}
function latest(startedAtMs, o = {}) {
  return {
    runId: o.runId || '20261106T110000Z-0a1b2c3d',
    outcome: o.outcome || 'done',
    startedAt: typeof startedAtMs === 'number' ? iso(startedAtMs) : startedAtMs,
    endedAt: o.running ? null : (typeof startedAtMs === 'number' ? iso(startedAtMs + 5 * SEC) : null),
  };
}
function verdict(input) {
  const { overdueVerdict } = lib();
  let v;
  try { v = overdueVerdict(input); } catch (e) { assert.fail(`overdueVerdict must answer, never throw (${D8}); it threw ${e && e.message}`); }
  assert.ok(v && typeof v === 'object' && typeof v.state === 'string', `overdueVerdict answers { state, … } (${D8}); got ${JSON.stringify(v)}`);
  const extra = Object.keys(v).filter((k) => !OVERDUE_KEYS.includes(k));
  assert.deepStrictEqual(extra, [], `the verdict carries only ${OVERDUE_KEYS.join(', ')} (${D8}); it also carries ${extra.join(', ')}`);
  return v;
}
const noCron = () => { throw new Error('periodOf was called for an entry with no cron'); };

/** The real cron judge, through overdueVerdict with no periodOf, in a child process with TZ=UTC (the container's zone, as BullMQ's own). */
function cronVerdict(entries, latestRun, nowMs) {
  const script = `
    const path = require('path');
    let mod;
    try { mod = require(path.join(${JSON.stringify(REPO)}, ${JSON.stringify(LIB)})); }
    catch (e) { process.stdout.write(JSON.stringify({ loadError: String(e && e.message).split('\\n')[0], code: e && e.code })); process.exit(0); }
    if (!mod || typeof mod.overdueVerdict !== 'function') { process.stdout.write(JSON.stringify({ loadError: 'no overdueVerdict export' })); process.exit(0); }
    let v; try { v = mod.overdueVerdict(${JSON.stringify({ entries, latest: latestRun, nowMs })}); }
    catch (e) { process.stdout.write(JSON.stringify({ threw: String(e && e.message) })); process.exit(0); }
    process.stdout.write(JSON.stringify({ v }));`;
  const r = spawnSync(process.execPath, ['-e', script], { cwd: REPO, env: { ...process.env, TZ: 'UTC' }, encoding: 'utf8', timeout: 20000 });
  let out;
  try { out = JSON.parse(r.stdout); } catch (_) { assert.fail(`the cron child gave no answer (status ${r.status}): ${String(r.stderr).slice(0, 400)}`); }
  if (out.loadError) {
    assert.fail(out.code === 'MODULE_NOT_FOUND' ? `${LIB} does not exist yet (${D8}): expected a module exporting overdueVerdict` : `${LIB} did not load (${D8}): ${out.loadError}`);
  }
  if (out.threw) assert.fail(`overdueVerdict must answer, never throw, for a cron rule (${D8}); it threw ${out.threw}`);
  return out.v;
}

// ─── OV1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

test('OV1 — src/pipeline/tagging-edges/overdue.js exports overdueVerdict, and loading it reads no file and starts no process (D8)', () => {
  const cp = require('child_process');
  const saved = { spawn: cp.spawn, exec: cp.exec, writeFileSync: fs.writeFileSync };
  const touched = [];
  cp.spawn = function (...a) { touched.push(`spawn ${a[0]}`); return saved.spawn.apply(this, a); };
  cp.exec = function (...a) { touched.push(`exec ${a[0]}`); return saved.exec.apply(this, a); };
  fs.writeFileSync = function (...a) { touched.push(`writeFileSync ${a[0]}`); return saved.writeFileSync.apply(this, a); };
  try { forget(LIB); lib(); } finally { Object.assign(cp, { spawn: saved.spawn, exec: saved.exec }); fs.writeFileSync = saved.writeFileSync; }
  assert.deepStrictEqual(touched, [], `loading ${LIB} must do no I/O (${D8}); it did: ${touched.join('; ')}`);
});

// ─── OV2–OV4 — nothing to warn about ─────────────────────────────────────────────────────────────────────────────────

test('OV2 — no enabled entry for the pass → no-entry: another task\'s entries and disabled ones (enabled false, or anything but true) never count, however old the latest pass (D8; AC-5 "No warning when no entry is enabled")', () => {
  const old = latest(NOW - 30 * DAY);
  const cases = [
    ['no entries at all', []],
    ['only a disabled entry', [entry({ enabled: false })]],
    ['an entry whose enabled is the string "true"', [entry({ enabled: 'true' })]],
    ['only another task\'s enabled entry', [entry({ taskId: 'updateAllScoresForOwner' })]],
    ['a disabled pass entry beside another task\'s enabled one', [entry({ enabled: false }), entry({ id: 'e2', taskId: 'syncNegentropyPresets', intervalHours: 6, intervalDays: 0 })]],
  ];
  for (const [what, entries] of cases) {
    const v = verdict({ entries, latest: old, nowMs: NOW, periodOf: noCron });
    assert.strictEqual(v.state, 'no-entry', `${what}: no-entry, so the backstop section's own no-entry warning stands (${D8}); got ${JSON.stringify(v)}`);
  }
});

test('OV3 — enabled entries that do not run the pass (no positive interval and no cron; a cron that does not parse) → no-schedule, never overdue or on-time (D8 "does not run the pass and is not counted")', () => {
  const old = latest(NOW - 30 * DAY);
  const zero = entry({ intervalDays: 0, intervalHours: 0, intervalMinutes: 0 });
  const negative = entry({ id: 'neg', intervalDays: 0, intervalHours: -5 });
  const v1 = verdict({ entries: [zero], latest: old, nowMs: NOW, periodOf: noCron });
  assert.strictEqual(v1.state, 'no-schedule', `an enabled entry with a zero interval and no cron runs nothing: no-schedule (${D8}); got ${JSON.stringify(v1)}`);
  const v2 = verdict({ entries: [zero, negative], latest: old, nowMs: NOW, periodOf: noCron });
  assert.strictEqual(v2.state, 'no-schedule', `none counted → no-schedule (${D8}); got ${JSON.stringify(v2)}`);
  const v3 = cronVerdict([entry({ cron: 'this is not a cron' })], old, NOW);
  assert.strictEqual(v3.state, 'no-schedule', `a cron that does not parse runs nothing, as the scheduler cannot schedule it: no-schedule (${D8}); got ${JSON.stringify(v3)}`);
});

test('OV4 — no pass on record (no latest) → no-pass, with an enabled daily entry (D8; AC-5 "There is also none when no pass is on record")', () => {
  for (const l of [null, undefined]) {
    const v = verdict({ entries: [entry()], latest: l, nowMs: NOW, periodOf: noCron });
    assert.strictEqual(v.state, 'no-pass', `no latest pass → no-pass; the panel already says no pass has run (${D8}); got ${JSON.stringify(v)}`);
  }
});

// ─── OV5–OV8 — interval entries ───────────────────────────────────────────────────────────────────────────────────

test('OV5 — the daily entry: 24 h 59 min after the latest pass began is on time; 25 h 1 min is overdue; exactly 25 h is still on time (D8 "overdue when nowMs > expectedAt + 3,600,000"; AC-5 "For the daily entry that is more than 25 hours")', () => {
  const cases = [
    [24 * HOUR + 59 * MIN, 'on-time'],
    [25 * HOUR, 'on-time'],
    [25 * HOUR + 1, 'overdue'],
    [25 * HOUR + 1 * MIN, 'overdue'],
    [10 * DAY, 'overdue'],
  ];
  for (const [ago, want] of cases) {
    const v = verdict({ entries: [entry()], latest: latest(NOW - ago), nowMs: NOW, periodOf: noCron });
    assert.strictEqual(v.state, want, `a daily pass that began ${(ago / HOUR).toFixed(4)} h ago is ${want} (${D8}); got ${JSON.stringify(v)}`);
  }
});

test('OV6 — the verdict says when the latest pass began and when one was expected: latestBeganAt is its startedAt, expectedAt is that plus the period, periodMs the period, all from the entry\'s days, hours and minutes (D8; AC-5 "saying when the latest pass began and when one was expected")', () => {
  const began = NOW - 26 * HOUR;
  const v = verdict({ entries: [entry({ intervalDays: 1, intervalHours: 0, intervalMinutes: 0 })], latest: latest(began), nowMs: NOW, periodOf: noCron });
  assert.strictEqual(v.state, 'overdue', `26 h after a daily pass began: overdue (${D8}); got ${JSON.stringify(v)}`);
  assert.strictEqual(v.latestBeganAt, iso(began), `latestBeganAt is the latest pass's startedAt, as an ISO string (${D8}); got ${JSON.stringify(v)}`);
  assert.strictEqual(v.expectedAt, iso(began + DAY), `expectedAt is startedAt + the period (${D8}); got ${JSON.stringify(v)}`);
  assert.strictEqual(v.periodMs, DAY, `periodMs is the period in ms (${D8}); got ${JSON.stringify(v)}`);
  const mixed = verdict({ entries: [entry({ intervalDays: 0, intervalHours: 6, intervalMinutes: 30 })], latest: latest(NOW - HOUR), nowMs: NOW, periodOf: noCron });
  assert.strictEqual(mixed.state, 'on-time', `an hour after a 6 h 30 min entry's pass: on time (${D8}); got ${JSON.stringify(mixed)}`);
  assert.strictEqual(mixed.periodMs, 6 * HOUR + 30 * MIN, `days, hours and minutes sum to the period, as toRepeatOpts does (${D8}); got ${JSON.stringify(mixed)}`);
  assert.strictEqual(mixed.expectedAt, iso(NOW - HOUR + 6 * HOUR + 30 * MIN), `expectedAt follows (${D8})`);
  for (const k of ['latestBeganAt', 'expectedAt']) assert.ok(ISO_RE.test(v[k]) && ISO_RE.test(mixed[k]), `${k} is an ISO time (${D8})`);
});

test('OV7 — with more than one enabled entry, the most frequent counts: a daily entry and a 6-hour one judge by 6 h (D8 "the smallest known period"; AC-5 "With more than one enabled entry, the most frequent counts")', () => {
  const entries = [entry({ id: 'daily' }), entry({ id: 'six', intervalDays: 0, intervalHours: 6 })];
  const late = verdict({ entries, latest: latest(NOW - 7 * HOUR - 1), nowMs: NOW, periodOf: noCron });
  assert.strictEqual(late.state, 'overdue', `7 h 0 min 0.001 s after the latest pass, with a 6 h entry enabled: overdue, by the most frequent (${D8}); got ${JSON.stringify(late)}`);
  assert.strictEqual(late.periodMs, 6 * HOUR, `the period is the most frequent entry's (${D8}); got ${JSON.stringify(late)}`);
  const fine = verdict({ entries: entries.slice().reverse(), latest: latest(NOW - 5 * HOUR), nowMs: NOW, periodOf: noCron });
  assert.strictEqual(fine.state, 'on-time', `5 h after: on time, whatever the entries' order (${D8}); got ${JSON.stringify(fine)}`);
  const withDisabled = verdict({ entries: [entry({ id: 'daily' }), entry({ id: 'off', intervalDays: 0, intervalHours: 1, enabled: false })], latest: latest(NOW - 2 * HOUR), nowMs: NOW, periodOf: noCron });
  assert.strictEqual(withDisabled.state, 'on-time', `a disabled hourly entry does not count: 2 h after a daily pass is on time (${D8}); got ${JSON.stringify(withDisabled)}`);
});

test('OV8 — a refused or failed latest pass counts as having begun, and a running one began when it started (D8; AC-5 "A pass that was refused or failed counts as having begun")', () => {
  for (const outcome of ['refused', 'failed', 'stopped', 'done-removals-held']) {
    const v = verdict({ entries: [entry()], latest: latest(NOW - 2 * HOUR, { outcome }), nowMs: NOW, periodOf: noCron });
    assert.strictEqual(v.state, 'on-time', `a ${outcome} pass that began 2 h ago counts as begun: on time (${D8}); got ${JSON.stringify(v)}`);
  }
  const running = verdict({ entries: [entry()], latest: latest(NOW - 10 * MIN, { running: true }), nowMs: NOW, periodOf: noCron });
  assert.strictEqual(running.state, 'on-time', `a pass running for 10 minutes: on time (${D8}); got ${JSON.stringify(running)}`);
  const refusedLong = verdict({ entries: [entry()], latest: latest(NOW - 26 * HOUR, { outcome: 'refused' }), nowMs: NOW, periodOf: noCron });
  assert.strictEqual(refusedLong.state, 'overdue', `a refused pass 26 h ago is overdue like any other (${D8}); got ${JSON.stringify(refusedLong)}`);
});

// ─── OV9–OV12 — calendar rules, the real judge ───────────────────────────────────────────────────────────────────

test('OV9 — a calendar rule for 03:00 every day counts as 24 hours, by the real cron judge: on time at 24 h 59 min, overdue at 25 h 1 min (D8 "the longest gap between consecutive runs"; AC-5 "a rule for 03:00 every day counts as 24 hours")', () => {
  const e = [entry({ cron: '0 3 * * *', intervalDays: 0 })];
  const fine = cronVerdict(e, latest(NOW - 24 * HOUR - 59 * MIN), NOW);
  assert.strictEqual(fine.state, 'on-time', `03:00 daily, 24 h 59 min after: on time (${D8}); got ${JSON.stringify(fine)}`);
  assert.strictEqual(fine.periodMs, DAY, `03:00 daily is a 24 h period (${D8}); got ${JSON.stringify(fine)}`);
  const late = cronVerdict(e, latest(NOW - 25 * HOUR - MIN), NOW);
  assert.strictEqual(late.state, 'overdue', `03:00 daily, 25 h 1 min after: overdue (${D8}); got ${JSON.stringify(late)}`);
});

test('OV10 — a weekday rule (03:00 Monday to Friday) counts by its longest gap, Friday to Monday, 72 hours (D8; AC-5 "the longest time between two of its runs in a row")', () => {
  const e = [entry({ cron: '0 3 * * 1-5', intervalDays: 0 })];
  const v = cronVerdict(e, latest(NOW - 50 * HOUR), NOW);
  assert.strictEqual(v.periodMs, 72 * HOUR, `weekdays at 03:00: the longest gap is 72 h (${D8}); got ${JSON.stringify(v)}`);
  assert.strictEqual(v.state, 'on-time', `50 h after, with a 72 h period: on time (${D8}); got ${JSON.stringify(v)}`);
  const late = cronVerdict(e, latest(NOW - 73 * HOUR - 1), NOW);
  assert.strictEqual(late.state, 'overdue', `73 h 0 min 0.001 s after: overdue (${D8}); got ${JSON.stringify(late)}`);
});

test('OV11 — a non-blank cron wins over the interval fields on the same entry, as in the scheduler; a blank one (spaces) is no cron (D8 "a non-blank cron (trimmed) wins, as in toRepeatOpts")', () => {
  const cronWins = cronVerdict([entry({ cron: ' 0 3 * * * ', intervalDays: 0, intervalHours: 1 })], latest(NOW - 5 * HOUR), NOW);
  assert.strictEqual(cronWins.periodMs, DAY, `the cron's 24 h, not the interval's 1 h (${D8}); got ${JSON.stringify(cronWins)}`);
  assert.strictEqual(cronWins.state, 'on-time', `5 h after, by the cron: on time (${D8}); got ${JSON.stringify(cronWins)}`);
  const blank = verdict({ entries: [entry({ cron: '   ', intervalDays: 0, intervalHours: 1 })], latest: latest(NOW - 3 * HOUR), nowMs: NOW, periodOf: noCron });
  assert.strictEqual(blank.periodMs, HOUR, `a blank cron is none: the 1 h interval counts (${D8}); got ${JSON.stringify(blank)}`);
  assert.strictEqual(blank.state, 'overdue', `3 h after a 1 h entry's pass: overdue (${D8}); got ${JSON.stringify(blank)}`);
});

test('OV12 — a rule with fewer than two runs in 400 days (29 February) cannot be judged: cannot-tell with reason rule, never on time; beside a judged entry, the judged one counts (D8; R13)', () => {
  const leap = entry({ id: 'leap', cron: '0 3 29 2 *', intervalDays: 0 });
  const alone = cronVerdict([leap], latest(NOW - 2 * HOUR), NOW);
  assert.strictEqual(alone.state, 'cannot-tell', `only an unjudged rule: cannot tell, never on time (${D8}; R13); got ${JSON.stringify(alone)}`);
  assert.strictEqual(alone.reason, 'rule', `the reason names the rule (${D8}); got ${JSON.stringify(alone)}`);
  const beside = cronVerdict([leap, entry({ id: 'daily' })], latest(NOW - 26 * HOUR), NOW);
  assert.strictEqual(beside.state, 'overdue', `beside a daily entry, the daily one counts: 26 h after is overdue (${D8}); got ${JSON.stringify(beside)}`);
  assert.strictEqual(beside.periodMs, DAY, `the judged entry's period (${D8}); got ${JSON.stringify(beside)}`);
});

// ─── OV13–OV15 — cannot tell; clock-free ─────────────────────────────────────────────────────────────────────────

test('OV13 — a latest pass whose startedAt does not parse → cannot-tell with reason report, never on time (D8; AC-5 "A missing warning never stands for on time")', () => {
  for (const startedAt of ['yesterday', '', null, undefined, 12345]) {
    const l = { runId: '20261106T110000Z-0a1b2c3d', outcome: 'done', startedAt, endedAt: null };
    const v = verdict({ entries: [entry()], latest: l, nowMs: NOW, periodOf: noCron });
    assert.strictEqual(v.state, 'cannot-tell', `startedAt ${JSON.stringify(startedAt)}: cannot tell (${D8}); got ${JSON.stringify(v)}`);
    assert.strictEqual(v.reason, 'report', `the reason names the report (${D8}); got ${JSON.stringify(v)}`);
  }
});

test('OV14 — when every counted entry\'s period is unknown (periodOf answers null), the verdict is cannot-tell with reason rule (D8 "When every counted entry\'s period is null")', () => {
  const v = verdict({ entries: [entry({ cron: '0 3 29 2 *', intervalDays: 0 }), entry({ id: 'b', cron: '0 4 29 2 *', intervalDays: 0 })], latest: latest(NOW - HOUR), nowMs: NOW, periodOf: () => null });
  assert.strictEqual(v.state, 'cannot-tell', `no known period: cannot tell (${D8}); got ${JSON.stringify(v)}`);
  assert.strictEqual(v.reason, 'rule', `reason rule (${D8}); got ${JSON.stringify(v)}`);
  const calls = [];
  const v2 = verdict({ entries: [entry({ cron: '0 3 * * *', intervalDays: 0 })], latest: latest(NOW - 2 * HOUR), nowMs: NOW, periodOf: (p, n) => { calls.push([p, n]); return 6 * HOUR; } });
  assert.deepStrictEqual(calls, [['0 3 * * *', NOW]], `periodOf is asked once per cron entry, with the trimmed pattern and nowMs (${D8}); calls ${JSON.stringify(calls)}`);
  assert.strictEqual(v2.periodMs, 6 * HOUR, `the injected period counts (${D8}); got ${JSON.stringify(v2)}`);
});

test('OV15 — the verdict comes from nowMs alone: with the process\'s clock set ten days wrong, the answers are the same (D8; AC-5 "A viewer whose device clock is wrong sees the same as everyone else")', () => {
  const realNow = Date.now;
  const input = { entries: [entry()], latest: latest(NOW - 26 * HOUR), nowMs: NOW, periodOf: noCron };
  const right = verdict(input);
  let wrong;
  try { Date.now = () => realNow() + 10 * DAY; wrong = verdict(input); } finally { Date.now = realNow; }
  assert.deepStrictEqual(wrong, right, `the same verdict whatever the clock (${D8}); right ${JSON.stringify(right)}, with the clock wrong ${JSON.stringify(wrong)}`);
  assert.strictEqual(right.state, 'overdue', `and it is the verdict nowMs gives (${D8})`);
});

// ─── OV16–OV18 — readConfigStrict ────────────────────────────────────────────────────────────────────────────────

/** Load the Scheduled Tasks module with SCHEDULED_TASKS_CONFIG_PATH at `configPath`, fresh, quietly; returns it and a restore. */
function schedWith(configPath) {
  const saved = process.env.SCHEDULED_TASKS_CONFIG_PATH;
  process.env.SCHEDULED_TASKS_CONFIG_PATH = configPath;
  forget(SCHED);
  const origError = console.error;
  console.error = () => {};
  let mod;
  try { mod = require(path.join(REPO, SCHED)); } finally { console.error = origError; }
  return {
    mod,
    quiet(fn) { const o = console.error; console.error = () => {}; try { return fn(); } finally { console.error = o; } },
    restore() {
      if (saved === undefined) delete process.env.SCHEDULED_TASKS_CONFIG_PATH; else process.env.SCHEDULED_TASKS_CONFIG_PATH = saved;
      forget(SCHED);
    },
  };
}
const TMP = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tagging-edges-overdue-'));

test('OV16 — readConfigStrict reads the same file as readConfig and returns its entries; a file that does not parse, or cannot be read, throws instead of reading as no entries (D8 "a read or parse error throws")', () => {
  const dir = TMP();
  try {
    const file = path.join(dir, 'scheduled-tasks.json');
    const good = { version: 2, entries: [entry({ id: 'entry-abc' })] };
    fs.writeFileSync(file, JSON.stringify(good));
    let s = schedWith(file);
    try {
      assert.strictEqual(typeof s.mod.readConfigStrict, 'function', `${SCHED} must export readConfigStrict() (${D8}); it exports ${Object.keys(s.mod).sort().join(', ')}`);
      const cfg = s.quiet(() => s.mod.readConfigStrict());
      assert.ok(cfg && Array.isArray(cfg.entries), `readConfigStrict returns the config with its entries (${D8}); got ${JSON.stringify(cfg)}`);
      assert.deepStrictEqual(cfg.entries.map((e) => e.id), ['entry-abc'], `the same entries as the file (${D8}); got ${JSON.stringify(cfg.entries)}`);
    } finally { s.restore(); }

    fs.writeFileSync(file, '{ not json');
    s = schedWith(file);
    try {
      assert.strictEqual(typeof s.mod.readConfigStrict, 'function', `${SCHED} must export readConfigStrict() (${D8})`);
      assert.throws(() => s.quiet(() => s.mod.readConfigStrict()), `a file that does not parse throws, so the status can say it cannot tell (${D8})`);
    } finally { s.restore(); }

    const asDir = path.join(dir, 'a-directory');
    fs.mkdirSync(asDir);
    s = schedWith(asDir);
    try {
      assert.throws(() => s.quiet(() => s.mod.readConfigStrict()), `a path that cannot be read as a file throws (${D8})`);
    } finally { s.restore(); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('OV17 — readConfigStrict on a missing file seeds a fresh install as readConfig does: the seed entries, the pass\'s disabled, so no entry counts (D8 "the same … fresh-install seeding as readConfig()")', () => {
  const dir = TMP();
  try {
    const s = schedWith(path.join(dir, 'absent.json'));
    try {
      assert.strictEqual(typeof s.mod.readConfigStrict, 'function', `${SCHED} must export readConfigStrict() (${D8})`);
      const strict = s.quiet(() => s.mod.readConfigStrict());
      const loose = s.quiet(() => s.mod.readConfig());
      assert.deepStrictEqual(strict, loose, `a missing file reads the same through both (${D8}); strict ${JSON.stringify(strict).slice(0, 300)}, loose ${JSON.stringify(loose).slice(0, 300)}`);
      const pass = strict.entries.filter((e) => e.taskId === TASK);
      assert.ok(pass.every((e) => e.enabled === false), `the pass's seed entry is disabled (${D8}); got ${JSON.stringify(pass)}`);
      assert.ok(!fs.existsSync(path.join(dir, 'absent.json')), `reading writes no file (${D8})`);
    } finally { s.restore(); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('OV18 — readConfig still swallows a parse error (its callers are unchanged), and is a wrapper over readConfigStrict (D8 "readConfig() becomes a wrapper that catches and logs")', () => {
  const dir = TMP();
  try {
    const file = path.join(dir, 'scheduled-tasks.json');
    fs.writeFileSync(file, '{ not json');
    const s = schedWith(file);
    try {
      assert.strictEqual(typeof s.mod.readConfigStrict, 'function', `${SCHED} must export readConfigStrict() (${D8}) before readConfig can wrap it`);
      let cfg;
      assert.doesNotThrow(() => { cfg = s.quiet(() => s.mod.readConfig()); }, `readConfig never throws (${D8})`);
      assert.ok(cfg && Array.isArray(cfg.entries), `readConfig still answers a config (${D8}); got ${JSON.stringify(cfg)}`);
    } finally { s.restore(); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ─── OV19–OV23 — the status's `overdue` member ───────────────────────────────────────────────────────────────────

function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}
/** handleStatus with every dep injected: report.json (and nothing else) under /state, the schedule reader, the clock. */
async function status({ report, readScheduleEntries, now = () => NOW }) {
  forget(INDEX);
  const index = require(path.join(REPO, INDEX));
  const files = { '/state/report.json': report === undefined ? null : JSON.stringify(report) };
  const deps = {
    stateDir: () => '/state',
    readFile: async (p) => {
      if (files[p] == null) throw Object.assign(new Error(`ENOENT ${p}`), { code: 'ENOENT' });
      return files[p];
    },
    isAlive: async () => false,
    snapshot: async () => ({ queue: 'ok', items: [], gaveUp: null }),
    now,
    readScheduleEntries,
  };
  const res = fakeRes();
  await index.handleStatus({ method: 'GET', headers: {}, query: {} }, res, deps);
  return res;
}
const reportWith = (startedAtMs, o) => ({ reportVersion: 1, latest: latest(startedAtMs, o), previous: [] });
function overdueOf(res) {
  assert.strictEqual(res.statusCode, 200, `the status answers 200 (${D6}); got ${res.statusCode} ${JSON.stringify(res.body)}`);
  const o = res.body && res.body.overdue;
  assert.ok(o && typeof o === 'object', `the status carries an \`overdue\` member (${D6}, ${D8}); its members are ${Object.keys(res.body || {}).join(', ')}`);
  return o;
}

test('OV19 — the public status carries `overdue`, the verdict over the injected schedule reader, the report it already read and the server\'s now (D8 "In handleStatus"; D6)', async () => {
  const res = await status({ report: reportWith(NOW - 26 * HOUR), readScheduleEntries: async () => [entry()] });
  const o = overdueOf(res);
  assert.strictEqual(o.state, 'overdue', `26 h after a daily pass began: overdue on the status (${D8}); got ${JSON.stringify(o)}`);
  assert.strictEqual(o.latestBeganAt, iso(NOW - 26 * HOUR), `latestBeganAt is the report's latest startedAt (${D8}); got ${JSON.stringify(o)}`);
  assert.strictEqual(o.expectedAt, iso(NOW - 2 * HOUR), `expectedAt is startedAt + 24 h (${D8}); got ${JSON.stringify(o)}`);
  assert.ok(res.body.latest && res.body.latest.runId, `the report is still served beside it (${D6})`);
  const none = overdueOf(await status({ report: reportWith(NOW - 26 * HOUR), readScheduleEntries: async () => [] }));
  assert.strictEqual(none.state, 'no-entry', `no enabled entry: no-entry on the status (${D8}); got ${JSON.stringify(none)}`);
  const noPass = overdueOf(await status({ report: undefined, readScheduleEntries: async () => [entry()] }));
  assert.strictEqual(noPass.state, 'no-pass', `no report: no-pass on the status (${D8}); got ${JSON.stringify(noPass)}`);
});

test('OV20 — a schedule reader that throws gives `overdue: {state: cannot-tell, reason: schedule}` and the status still answers 200 with the report, never a 500 (D8 "The status never fails for it"; AC-5 "When it cannot tell")', async () => {
  for (const reader of [async () => { throw Object.assign(new Error('bad json'), { code: 'EBADJSON' }); }, () => { throw new Error('sync throw'); }]) {
    const res = await status({ report: reportWith(NOW - HOUR), readScheduleEntries: reader });
    const o = overdueOf(res);
    assert.strictEqual(o.state, 'cannot-tell', `a schedule that cannot be read: cannot tell (${D8}); got ${JSON.stringify(o)}`);
    assert.strictEqual(o.reason, 'schedule', `the reason names the schedule (${D8}); got ${JSON.stringify(o)}`);
    assert.ok(res.body.latest, `the report is still served (${D8})`);
  }
});

test('OV21 — the warning clears as soon as a new pass begins: the next status read after a new latest pass recorded itself says on time (AC-5 "It clears within 10 seconds of a new pass beginning"; D6 "computed per request")', async () => {
  const reader = async () => [entry()];
  const before = overdueOf(await status({ report: reportWith(NOW - 30 * HOUR), readScheduleEntries: reader }));
  assert.strictEqual(before.state, 'overdue', `30 h after the last pass: overdue (${D8}); got ${JSON.stringify(before)}`);
  const after = overdueOf(await status({ report: { reportVersion: 1, latest: latest(NOW - 2 * SEC, { running: true, runId: '20261107T115958Z-11223344' }), previous: [latest(NOW - 30 * HOUR)] }, readScheduleEntries: reader }));
  assert.strictEqual(after.state, 'on-time', `a pass that began 2 s ago: on time on the very next read (${D8}); got ${JSON.stringify(after)}`);
});

test('OV22 — the `overdue` member carries no who: only state, reason, latestBeganAt, expectedAt and periodMs, and no key of anyone (D6; AC-5 "every viewer"; the public status names no one)', async () => {
  const res = await status({ report: reportWith(NOW - 26 * HOUR), readScheduleEntries: async () => [{ ...entry(), createdBy: OWNER, label: `owner ${OWNER.slice(0, 8)}` }] });
  const o = overdueOf(res);
  const extra = Object.keys(o).filter((k) => !OVERDUE_KEYS.includes(k));
  assert.deepStrictEqual(extra, [], `the member's keys are closed (${D8}); extra ${extra.join(', ')}`);
  assert.ok(!JSON.stringify(o).includes(OWNER.slice(0, 8)), `no key of anyone on the member (${D6}); got ${JSON.stringify(o)}`);
});

test('OV23 — the status judges by the server\'s injected now, not the process clock: with Date.now set two days wrong the member is the same (D8 "computed per request from server time"; AC-5 "The same for every viewer")', async () => {
  const reader = async () => [entry()];
  const realNow = Date.now;
  const right = overdueOf(await status({ report: reportWith(NOW - 20 * HOUR), readScheduleEntries: reader }));
  let wrong;
  try {
    Date.now = () => realNow() + 2 * DAY;
    wrong = overdueOf(await status({ report: reportWith(NOW - 20 * HOUR), readScheduleEntries: reader }));
  } finally { Date.now = realNow; }
  assert.strictEqual(right.state, 'on-time', `20 h after a daily pass, by the server's now: on time (${D8}); got ${JSON.stringify(right)}`);
  assert.deepStrictEqual(wrong, right, `the same member whatever the process clock says (${D8}); got ${JSON.stringify(wrong)}`);
});

// ─── OV24–OV29 — added at story 7's fix round (2026-11-07; its review, round 1, requested 4, 6 and 7) ──────────────

const FIX8 = 'ADR tagging-edges/0007 § Fix-round notes (2026-11-07), D8';
const FIX8R2 = 'ADR tagging-edges/0007 § Fix-round notes, round 2 (2026-11-08), D8';
const same = (a, b) => { try { assert.deepStrictEqual(a, b); return true; } catch (_) { return false; } };
/** Every problem at once, under one reference. */
function report(problems, ref) {
  if (problems.length) assert.fail(`${problems.join('\n        ')}\n        (${ref})`);
}

/**
 * handleStatus with no readScheduleEntries key at all, so index.js's own default runs: readConfigStrict() over
 * SCHEDULED_TASKS_CONFIG_PATH, which the Scheduled Tasks module fixes when it loads (so it is dropped from require's
 * cache first). Every other dep is injected, as status() injects them.
 */
async function statusWithDefaultReader({ report: rep, configPath }) {
  assert.ok(path.isAbsolute(configPath) && configPath.startsWith(os.tmpdir()) && !configPath.startsWith('/var/lib'),
    `setup: the schedule file must be a temp file; it is ${configPath}`);
  process.env.SCHEDULED_TASKS_CONFIG_PATH = configPath;
  forget(SCHED);
  forget(INDEX);
  const index = require(path.join(REPO, INDEX));
  const files = { '/state/report.json': rep === undefined ? null : JSON.stringify(rep) };
  const deps = {
    stateDir: () => '/state',
    readFile: async (p) => {
      if (files[p] == null) throw Object.assign(new Error(`ENOENT ${p}`), { code: 'ENOENT' });
      return files[p];
    },
    isAlive: async () => false,
    snapshot: async () => ({ queue: 'ok', items: [], gaveUp: null }),
    now: () => NOW,
  };
  assert.ok(!Object.prototype.hasOwnProperty.call(deps, 'readScheduleEntries'), 'setup: no schedule reader may be injected');
  const res = fakeRes();
  const origError = console.error;
  console.error = () => {};
  try { await index.handleStatus({ method: 'GET', headers: {}, query: {} }, res, deps); } finally { console.error = origError; }
  return res;
}

test('OV24 (story 7 fix round; review requested 4; green on purpose — the default works today, and no other test reaches it) — with no schedule reader injected, the status reads the schedule through index.js\'s own default, readConfigStrict over SCHEDULED_TASKS_CONFIG_PATH: a valid file with one enabled reconcileTaggingEdges entry gives that entry\'s verdict; a file that does not parse gives overdue {state: cannot-tell, reason: schedule}, never no-entry, and still a 200 with the report; neither read writes the file (D8 "The reader", "In handleStatus: … over d.readScheduleEntries() (a new dep calling readConfigStrict())"; AC-5 "When it cannot tell … A missing warning never stands for on time")', async () => {
  const dir = TMP();
  try {
    const file = path.join(dir, 'scheduled-tasks.json');
    const rep = reportWith(NOW - 26 * HOUR);
    const good = JSON.stringify({ version: 2, entries: [entry({ id: 'entry-daily' })] }, null, 2);
    fs.writeFileSync(file, good);
    const okRes = await statusWithDefaultReader({ report: rep, configPath: file });
    const ok = overdueOf(okRes);
    assert.deepStrictEqual(ok, { state: 'overdue', latestBeganAt: iso(NOW - 26 * HOUR), expectedAt: iso(NOW - 2 * HOUR), periodMs: DAY },
      `the default reader reads the temp file's one enabled daily entry, so 26 h after the latest pass began the status says overdue, with its times (${D8} "a new dep calling readConfigStrict()"); got ${JSON.stringify(ok)}`);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), good, `the status's read of the schedule writes nothing (${D8})`);

    fs.writeFileSync(file, '{ not json');
    const badRes = await statusWithDefaultReader({ report: rep, configPath: file });
    const bad = overdueOf(badRes);
    assert.deepStrictEqual(bad, { state: 'cannot-tell', reason: 'schedule' },
      `a schedule file that does not parse: the default reader must throw, so the status says it cannot tell (${D8} "a read or parse error throws"; AC-5). readConfig() would read it as no entries, and the panel would show no-entry; got ${JSON.stringify(bad)}`);
    assert.ok(badRes.body.latest && badRes.body.latest.runId === rep.latest.runId, `the report is still served beside it (${D8} "The status never fails for it"); got ${JSON.stringify(badRes.body).slice(0, 300)}`);
    assert.strictEqual(fs.readFileSync(file, 'utf8'), '{ not json', `a file that does not parse is left as it is (${D8})`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

/** 03:<m> on the 1st of each month: a 31-day period, cheap to judge. */
const MONTHLY = (m, h = 3) => `${m} ${h} 1 * *`;
const monthlies = (n, h = 3) => Array.from({ length: n }, (_, i) => MONTHLY(i, h));
const DAILY = '0 3 * * *';
const MONTH_MS = 31 * DAY;
const cronEntry = (cron, i, o = {}) => entry({ id: `cron-${i}`, cron, intervalDays: 0, ...o });
const numbers = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i).join(',');
/** Every minute, written out as lists: 319 characters. */
const LONG_LIST = `${numbers(0, 59)} ${numbers(0, 23)} ${numbers(1, 31)} * *`;
/** "0 3 * * *" (03:00 every day) with its first gap widened to make the pattern `len` characters long. */
const paddedDaily = (len) => `0${' '.repeat(len - 8)}3 * * *`;

/**
 * Fix round (the bound on the cron work): in a child with TZ=UTC (the container's zone, as cronVerdict), cron-parser's
 * parseExpression wrapped to record each pattern it is asked to parse, then each step run in order in that one process,
 * so the per-pattern cache carries from step to step. The wrapper is installed before the verdict's module loads, so a
 * parse is seen however that module reaches cron-parser. A step is
 *   { verdict: { entries, latest, nowMs }, periodMs }   overdueVerdict; with periodMs, periodOf is a spy answering it
 *   { status: { entries, report, nowMs } }               handleStatus, every dep injected, readScheduleEntries included
 * → per step { v, parsed, asked } (or { threw, parsed, asked }), or { status, body, parsed }: `parsed` the patterns
 * parseExpression was asked for during the step, `asked` the patterns periodOf was asked for.
 */
function countedCron(steps) {
  const script = `
    const path = require('path');
    const REPO = ${JSON.stringify(REPO)};
    const steps = ${JSON.stringify(steps)};
    const say = (o) => { process.stdout.write(JSON.stringify(o)); process.exit(0); };
    let parser;
    try { parser = require(require.resolve('cron-parser', { paths: [path.join(REPO, ${JSON.stringify(path.dirname(LIB))})] })); }
    catch (e) { say({ loadError: 'cron-parser did not load: ' + String(e && e.message).split('\\n')[0] }); }
    const realParse = parser.parseExpression;
    let parsed = [];
    parser.parseExpression = function (...a) { parsed.push(String(a[0])); return realParse.apply(this, a); };
    (async () => {
      const out = [];
      for (const s of steps) {
        parsed = [];
        if (s.verdict) {
          let mod;
          try { mod = require(path.join(REPO, ${JSON.stringify(LIB)})); }
          catch (e) { say({ loadError: String(e && e.message).split('\\n')[0], code: e && e.code }); }
          const asked = [];
          const input = Object.assign({}, s.verdict);
          if (s.periodMs !== undefined) input.periodOf = (p) => { asked.push(String(p)); return s.periodMs; };
          try { out.push({ v: mod.overdueVerdict(input), parsed, asked }); }
          catch (e) { out.push({ threw: String(e && e.message), parsed, asked }); }
        } else {
          const index = require(path.join(REPO, ${JSON.stringify(INDEX)}));
          const text = JSON.stringify(s.status.report);
          const res = { statusCode: 200, body: undefined };
          res.status = (c) => { res.statusCode = c; return res; };
          res.json = (b) => { res.body = b; return res; };
          const deps = {
            stateDir: () => '/state',
            readFile: async (p) => {
              if (p === '/state/report.json' && s.status.report) return text;
              throw Object.assign(new Error('ENOENT ' + p), { code: 'ENOENT' });
            },
            isAlive: async () => false,
            snapshot: async () => ({ queue: 'ok', items: [], gaveUp: null }),
            now: () => s.status.nowMs,
            readScheduleEntries: async () => s.status.entries,
          };
          await index.handleStatus({ method: 'GET', headers: {}, query: {} }, res, deps);
          out.push({ status: res.statusCode, body: res.body, parsed });
        }
      }
      say({ out });
    })().catch((e) => say({ fatal: String(e && e.message) }));`;
  const r = spawnSync(process.execPath, ['-e', script], { cwd: REPO, env: { ...process.env, TZ: 'UTC' }, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
  let out;
  try { out = JSON.parse(r.stdout); } catch (_) { assert.fail(`the counted cron child gave no answer (status ${r.status}${r.signal ? `, signal ${r.signal}` : ''}): ${String(r.stderr).slice(0, 400)}`); }
  if (out.loadError) assert.fail(out.code === 'MODULE_NOT_FOUND' ? `${LIB} does not exist yet (${D8}): expected a module exporting overdueVerdict` : `the counted cron child could not load what it tests (${D8}): ${out.loadError}`);
  if (out.fatal) assert.fail(`the counted cron child failed (${D8}): ${out.fatal}`);
  return out.out;
}
const showV = (r) => (r.threw ? `it threw ${r.threw}` : JSON.stringify(r.v));
const listed = (patterns) => `${patterns.length} (${patterns.slice(0, 3).map((p) => JSON.stringify(p.length > 40 ? `${p.slice(0, 20)}…(${p.length} characters)` : p)).join(', ')}${patterns.length > 3 ? ', …' : ''})`;

test('OV25 (story 7 fix round; review requested 6; red until the fix) — when the pass\'s enabled entries carry more than 32 distinct cron patterns, none is judged and the verdict is {state: cannot-tell, reason: rule}: periodOf, a spy, is never asked, and through the real judge cron-parser\'s parseExpression is never called — for 33 monthly rules, and for 32 monthly rules beside the daily 03:00 rule, which alone would say on time (ADR 0007 § Fix-round notes, D8 "More distinct patterns than the cache holds … none is judged and the verdict is {state: \'cannot-tell\', reason: \'rule\'}"; review requested 6 "answer cannot-tell/rule without judging when the distinct patterns exceed the cache")', () => {
  const sets = [
    ['33 monthly rules', monthlies(33)],
    ['32 monthly rules and the daily 03:00 rule', [...monthlies(32), DAILY]],
  ];
  const problems = [];
  for (const [what, patterns] of sets) {
    const entries = patterns.map((p, i) => cronEntry(p, i));
    for (const spy of [true, false]) {
      const label = `${what}, ${spy ? 'with periodOf a spy' : 'through the real judge'}`;
      const [r] = countedCron([{ verdict: { entries, latest: latest(NOW - HOUR), nowMs: NOW }, ...(spy ? { periodMs: 6 * HOUR } : {}) }]);
      if (r.threw || !same(r.v, { state: 'cannot-tell', reason: 'rule' })) problems.push(`${label}: the verdict should be {state: cannot-tell, reason: rule}; ${r.threw ? `it threw ${r.threw}` : `it is ${showV(r)}`}`);
      if (r.parsed.length) problems.push(`${label}: no pattern may be judged, yet parseExpression was called for ${listed(r.parsed)}`);
      if (spy && r.asked.length) problems.push(`${label}: periodOf may not be asked, yet it was asked for ${listed(r.asked)}`);
    }
  }
  report(problems, `${FIX8}: at most 32 are judged`);
});

test('OV26 (story 7 fix round; review requested 6; red until the fix) — a status read with 33 distinct patterns makes no parse call, and nor does the second read in the same process: each answers 200 with overdue {state: cannot-tell, reason: rule}, so a signed-out viewer\'s poll never pays for judging them (review requested 6 "add a test that a second status read with more patterns than the cache makes no parse calls"; ADR 0007 § Fix-round notes, D8 "What remains: each pattern\'s first judgment still runs synchronously, once per process while cached. At most 32 are judged")', () => {
  const entries = monthlies(33).map((p, i) => cronEntry(p, i));
  const rep = reportWith(NOW - HOUR);
  const reads = countedCron([{ status: { entries, report: rep, nowMs: NOW } }, { status: { entries, report: rep, nowMs: NOW } }]);
  const problems = [];
  reads.forEach((r, i) => {
    const label = i === 0 ? 'the first status read' : 'the second status read';
    if (r.status !== 200) problems.push(`${label}: the status should answer 200; it answered ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    else if (!same(r.body && r.body.overdue, { state: 'cannot-tell', reason: 'rule' })) problems.push(`${label}: overdue should be {state: cannot-tell, reason: rule}; it is ${JSON.stringify(r.body && r.body.overdue)}`);
    if (r.parsed.length) problems.push(`${label} called parseExpression for ${listed(r.parsed)}; with more distinct patterns than the cache holds it may call it for none`);
  });
  report(problems, `${FIX8}; review requested 6`);
});

test('OV27 (story 7 fix round; review requested 6; red until the fix. Revised at fix round 2, 2026-11-08: review round 2, blocking 1) — a cron pattern longer than 256 characters is not judged (no parse call, periodOf never asked for it), and the verdict is then {state: cannot-tell, reason: rule} whatever stands beside it, since the rule not judged may be the most frequent: alone (a rule written out as lists, 319 characters, every minute; and the daily 03:00 rule widened to 257 characters); beside an enabled daily interval entry, which alone would say on time 2 h after; and beside the daily 03:00 cron rule, which is judged. The daily rule widened to exactly 256 characters is still judged, 24 h (ADR 0007 § Fix-round notes, round 2, D8 "A pattern longer than 256 characters on an enabled entry for the pass is not judged, and the verdict is {state: \'cannot-tell\', reason: \'rule\'}"; story 7 AC-5 "the most frequent counts", "A missing warning never stands for on time"; review round 1 requested 6 "skip a pattern past a fixed length"; review round 2, blocking 1)', () => {
  assert.strictEqual(LONG_LIST.length, 319, `setup: the list rule is 319 characters; it is ${LONG_LIST.length}`);
  assert.ok(paddedDaily(256).length === 256 && paddedDaily(257).length === 257, 'setup: the widened daily rules are 256 and 257 characters');
  const at2h = latest(NOW - 2 * HOUR);
  const cases = [
    { what: 'the 319-character list rule alone, through the real judge', long: LONG_LIST, entries: [cronEntry(LONG_LIST, 1)], want: { state: 'cannot-tell', reason: 'rule' } },
    { what: 'the 319-character list rule alone, with periodOf a spy', long: LONG_LIST, entries: [cronEntry(LONG_LIST, 1)], periodMs: MIN, want: { state: 'cannot-tell', reason: 'rule' } },
    { what: 'the daily rule widened to 257 characters, alone', long: paddedDaily(257), entries: [cronEntry(paddedDaily(257), 2)], want: { state: 'cannot-tell', reason: 'rule' } },
    // Revised at fix round 2 (review round 2, blocking 1): this case said on time, the daily entry's verdict. The long
    // rule runs every minute, so the pass is two hours overdue by it, and on time was false.
    { what: 'the 319-character list rule beside an enabled daily interval entry', long: LONG_LIST, entries: [cronEntry(LONG_LIST, 1), entry({ id: 'daily-interval' })], want: { state: 'cannot-tell', reason: 'rule' } },
    { what: 'the 319-character list rule beside the daily 03:00 cron rule, which is judged', long: LONG_LIST, entries: [cronEntry(LONG_LIST, 1), cronEntry(DAILY, 4)], want: { state: 'cannot-tell', reason: 'rule' } },
    { what: 'the daily rule widened to exactly 256 characters, still judged', judged: paddedDaily(256), entries: [cronEntry(paddedDaily(256), 3)], want: { state: 'on-time', latestBeganAt: iso(NOW - 2 * HOUR), expectedAt: iso(NOW + 22 * HOUR), periodMs: DAY } },
  ];
  const problems = [];
  for (const c of cases) {
    const [r] = countedCron([{ verdict: { entries: c.entries, latest: at2h, nowMs: NOW }, ...(c.periodMs !== undefined ? { periodMs: c.periodMs } : {}) }]);
    if (r.threw || !same(r.v, c.want)) problems.push(`${c.what}: the verdict should be ${JSON.stringify(c.want)}; it is ${showV(r)}`);
    if (c.long && r.parsed.includes(c.long)) problems.push(`${c.what}: a pattern of ${c.long.length} characters may not be judged, yet parseExpression was called for it`);
    if (c.long && r.asked && r.asked.includes(c.long)) problems.push(`${c.what}: periodOf may not be asked for a pattern of ${c.long.length} characters, yet it was`);
    if (c.judged && !r.parsed.includes(c.judged)) problems.push(`${c.what}: a pattern of exactly 256 characters is judged (only one longer is not), yet parseExpression was never called for it`);
  }
  report(problems, `${FIX8R2}: a pattern longer than 256 characters`);
});

test('OV28 (story 7 fix round; review requested 6; green on purpose — the boundary the fix keeps) — exactly 32 distinct cron patterns are still judged: 31 monthly rules and the daily 03:00 rule give the daily rule\'s 24 h through the real judge (overdue 26 h after), each of the 32 parsed; with periodOf a spy, every one is asked; 40 entries repeating those same 32 patterns are judged the same; and only the pass\'s enabled entries count, so 40 more distinct patterns on disabled entries and on another task\'s entries are never parsed (ADR 0007 § Fix-round notes, D8 "When the enabled entries for the pass carry more than 32 distinct cron patterns" — 32 is not more; D8 "The most frequent counts")', () => {
  const p32 = [...monthlies(31), DAILY];
  const at26h = latest(NOW - 26 * HOUR);
  const overdueDaily = { state: 'overdue', latestBeganAt: iso(NOW - 26 * HOUR), expectedAt: iso(NOW - 2 * HOUR), periodMs: DAY };
  const others = monthlies(40, 4);
  const cases = [
    { what: '32 distinct patterns, through the real judge', entries: p32.map((p, i) => cronEntry(p, i)), want: overdueDaily, parsedAll: p32 },
    { what: '32 distinct patterns, with periodOf a spy answering 6 h', entries: p32.map((p, i) => cronEntry(p, i)), periodMs: 6 * HOUR, want: { state: 'overdue', latestBeganAt: iso(NOW - 26 * HOUR), expectedAt: iso(NOW - 20 * HOUR), periodMs: 6 * HOUR }, askedAll: p32 },
    { what: '40 entries over the same 32 distinct patterns', entries: [...p32, ...p32.slice(0, 8)].map((p, i) => cronEntry(p, i)), want: overdueDaily, parsedAll: p32 },
    {
      what: 'the daily rule on the pass\'s one enabled entry, beside 40 distinct patterns on disabled pass entries and another task\'s enabled entries',
      entries: [cronEntry(DAILY, 0), ...others.slice(0, 20).map((p, i) => cronEntry(p, 100 + i, { enabled: false })), ...others.slice(20).map((p, i) => cronEntry(p, 200 + i, { taskId: 'syncNegentropyPresets' }))],
      want: overdueDaily, parsedNone: others,
    },
  ];
  const problems = [];
  for (const c of cases) {
    const [r] = countedCron([{ verdict: { entries: c.entries, latest: at26h, nowMs: NOW }, ...(c.periodMs !== undefined ? { periodMs: c.periodMs } : {}) }]);
    if (r.threw || !same(r.v, c.want)) problems.push(`${c.what}: the verdict should be ${JSON.stringify(c.want)}; it is ${showV(r)}`);
    if (c.parsedAll) { const missed = c.parsedAll.filter((p) => !r.parsed.includes(p)); if (missed.length) problems.push(`${c.what}: each pattern is judged, yet parseExpression was never called for ${listed(missed)}`); }
    if (c.askedAll) { const missed = c.askedAll.filter((p) => !r.asked.includes(p)); if (missed.length) problems.push(`${c.what}: periodOf should be asked for every pattern, yet not for ${listed(missed)}`); }
    if (c.parsedNone) { const hit = c.parsedNone.filter((p) => r.parsed.includes(p)); if (hit.length) problems.push(`${c.what}: only the pass's enabled entries count, yet parseExpression was called for ${listed(hit)}`); }
  }
  report(problems, `${FIX8}: at most 32 are judged`);
});

test('OV29 (story 7 fix round; review requested 7; red until the fix) — a schedule entry the verdict cannot read makes overdueVerdict throw, and the status still answers 200 with overdue {state: cannot-tell, reason: schedule} and the rest of its body (reportVersion, running, the latest report, previous, confirmationPending, control): an enabled pass entry whose cron is {"toString": null}, and one with an empty cron whose intervalDays is {"toString": null, "valueOf": null}, each as JSON.parse reads a hand-edited file (ADR 0007 § Fix-round notes, D8 "A throw from overdueVerdict in handleStatus gives {state: \'cannot-tell\', reason: \'schedule\'}, as a throw from the reader does. The status never fails for it"; AC-5 "When it cannot tell")', async () => {
  const cases = [
    ['a cron that is {"toString": null}', '[{"id":"hand-1","taskId":"reconcileTaggingEdges","label":"x","args":{},"enabled":true,"intervalDays":1,"intervalHours":0,"intervalMinutes":0,"cron":{"toString":null}}]'],
    ['an empty cron and intervalDays {"toString": null, "valueOf": null}', '[{"id":"hand-2","taskId":"reconcileTaggingEdges","label":"x","args":{},"enabled":true,"intervalDays":{"toString":null,"valueOf":null},"intervalHours":0,"intervalMinutes":0,"cron":""}]'],
  ];
  const rep = reportWith(NOW - HOUR);
  const problems = [];
  for (const [what, text] of cases) {
    const res = await status({ report: rep, readScheduleEntries: async () => JSON.parse(text) });
    if (res.statusCode !== 200) {
      problems.push(`${what}: the public status should still answer 200, with overdue {state: cannot-tell, reason: schedule}; it answered ${res.statusCode} ${JSON.stringify(res.body)}`);
      continue;
    }
    const b = res.body || {};
    if (!same(b.overdue, { state: 'cannot-tell', reason: 'schedule' })) problems.push(`${what}: overdue should be {state: cannot-tell, reason: schedule}; it is ${JSON.stringify(b.overdue)}`);
    const missing = ['reportVersion', 'running', 'latest', 'previous', 'confirmationPending', 'control'].filter((k) => !Object.prototype.hasOwnProperty.call(b, k));
    if (missing.length) problems.push(`${what}: the rest of the status should still be served; it lacks ${missing.join(', ')}`);
    if (!(b.latest && b.latest.runId === rep.latest.runId)) problems.push(`${what}: the latest report should still be served; it is ${JSON.stringify(b.latest)}`);
  }
  report(problems, `${FIX8}: a throw from overdueVerdict`);
});

// ─── OV30 — added at story 7's fix round 2 (2026-11-08; its review, round 2, requested 4) ─────────────────────────

test('OV30 (story 7 fix round 2; review round 2, requested 4; green on purpose — round 1\'s bound holds today, and no test ran it beside an interval) — more than 32 distinct cron patterns beside an enabled interval entry still give {state: cannot-tell, reason: rule}, with no pattern judged: beside a daily interval entry, which alone would say on time 2 h after, and beside an hourly one, which alone would say overdue 2 h 1 min after (a 1 h period and 1 h of grace, the comparison strict: revised at review round 3, requested 4, from "2 h", where it says on time); the interval entry\'s verdict never stands for the patterns not judged (ADR 0007 § Fix-round notes, D8 "When the enabled entries for the pass carry more than 32 distinct cron patterns, none is judged and the verdict is {state: \'cannot-tell\', reason: \'rule\'}"; story 7 AC-5 "the most frequent counts"; review round 2, requested 4)', () => {
  const daily = entry({ id: 'daily-interval' });
  const hourly = entry({ id: 'hourly-interval', intervalDays: 0, intervalHours: 1 });
  const cases = [
    ['33 monthly rules beside an enabled daily interval entry', daily, latest(NOW - 2 * HOUR), 'on-time'],
    ['33 monthly rules beside an enabled hourly interval entry', hourly, latest(NOW - 2 * HOUR - MIN), 'overdue'],
  ];
  const problems = [];
  for (const [what, interval, began, alone] of cases) {
    // Setup (review round 3, requested 4): the interval entry alone gives the verdict the title names.
    const [a] = countedCron([{ verdict: { entries: [interval], latest: began, nowMs: NOW } }]);
    if (a.threw || !a.v || a.v.state !== alone) problems.push(`setup, ${what}: the interval entry alone should say ${alone}; it is ${showV(a)}`);
    const entries = [...monthlies(33).map((p, i) => cronEntry(p, i)), interval];
    for (const spy of [true, false]) {
      const label = `${what}, ${spy ? 'with periodOf a spy' : 'through the real judge'}`;
      const [r] = countedCron([{ verdict: { entries, latest: began, nowMs: NOW }, ...(spy ? { periodMs: 6 * HOUR } : {}) }]);
      if (r.threw || !same(r.v, { state: 'cannot-tell', reason: 'rule' })) problems.push(`${label}: the verdict should be {state: cannot-tell, reason: rule}; it is ${showV(r)}`);
      if (r.parsed.length) problems.push(`${label}: no pattern may be judged, yet parseExpression was called for ${listed(r.parsed)}`);
      if (spy && r.asked.length) problems.push(`${label}: periodOf may not be asked, yet it was asked for ${listed(r.asked)}`);
    }
  }
  report(problems, `${FIX8}: at most 32 are judged, beside an interval entry`);
});

// ─── the runner ─────────────────────────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n--- tagging-edges overdue verdict (epic tagging-edges, Story 7) ---');
  let pass = 0, fail = 0;
  const skipped = 0;
  const failures = [];
  const savedPath = process.env.SCHEDULED_TASKS_CONFIG_PATH;
  try {
    for (const [name, fn] of tests) {
      try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (err) {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
      } finally {
        forget(LIB);
        forget(INDEX);
        forget(SCHED);
        if (savedPath === undefined) delete process.env.SCHEDULED_TASKS_CONFIG_PATH; else process.env.SCHEDULED_TASKS_CONFIG_PATH = savedPath;
      }
    }
  } finally {
    forget(SCHED);
  }
  console.log(`\ntagging-edges-overdue: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
