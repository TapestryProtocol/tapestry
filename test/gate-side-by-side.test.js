'use strict';
/**
 * test-gate-speed #1 — the stack-free gate gives the same verdict in half the time.
 *
 * Story: engineering-team/stories/test-gate-speed/1-stack-free-gate-in-half-the-time.md
 * ADR:   engineering-team/decisions/test-gate-speed/0001-every-suite-runs-in-its-own-process-several-at-a-time.md
 * Plan:  engineering-team/stories/test-gate-speed/1-stack-free-gate-in-half-the-time.test-plan.md
 *
 * PHASE-3 GUARD (the carve-out in engineering-team/templates/adr.md). This story's deliverable is test
 * infrastructure: the Implementer edits test/helpers/gateRunner.js, test/helpers/gateRecord.js,
 * test/gate-status.js and test/operations.test.js, and adds test/helpers/gateUnit.js and
 * test/helpers/discoverSuites.js. The Implementer must NOT modify this file, test/helpers/gateFixtures.js,
 * test/gate-result-record.test.js, test/ci-test-job.test.js, test/registry.js or test/config-loading.test.js.
 *
 * Every test runs stack-free (CI runs them all):
 *   P1–P5    where and how many: side by side, a process each, one at a time with GATE_JOBS=1, the
 *            default of one per CPU, and an invalid GATE_JOBS                         [AC1, AC3, AC5; Decisions 1, 2, 8]
 *   P6–P8    expand: an entry's folder runs as suites of their own; the real registry; and
 *            operations.test.js run with { discovered: 'separately' }                  [AC2; Decisions 3, 9]
 *   P9       nothing a suite leaves in its process reaches the next                    [AC2; Decision 1]
 *   P10–P12  the log and the record: one block per suite, finishing order, schema 2, and
 *            gate:status while several run                                             [AC3; Decisions 5, 7]
 *   P13–P16  processes end with their suite: leftovers, an interrupt, a killed engine, a run that
 *            never settles                                                             [AC2; Decisions 4, 6]
 *   P17      an entry with no file is that entry's FAIL                                [AC2; Decision 9]
 *   P18–P19  the docs say how it runs and how to run one at a time                     [AC3, AC5]
 *   P20      side by side, the largest test file starts first                          [AC1; Amendment 2]
 *
 * Engine tests drive runGate() in a child process over fixture suites written to a temp dir, with records
 * in a temp GATE_RECORD_DIR, as test/gate-result-record.test.js does. Nothing here requires the engine at
 * module load.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const F = require('./helpers/gateFixtures');

const { short } = F;
const REPO = F.REPO;
const OPS_SUITE = path.join(REPO, 'test', 'operations.test.js');
const ADR = 'ADR test-gate-speed/0001';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const jobs = (n) => ({ extraEnv: { GATE_JOBS: String(n) } });
const cpuCount = () => (typeof os.availableParallelism === 'function' ? os.availableParallelism() : os.cpus().length);
const cpuModel = () => String((os.cpus()[0] || {}).model || '').trim();

function onlyRecord(sc, why) {
  const recs = F.readRecords(sc.recordDir);
  assert(recs.length === 1, `${why}: expected exactly one run record, found ${recs.length}`);
  assert(recs[0].rec, `${why}: the run record ${recs[0].path} is not valid JSON`);
  return recs[0];
}
/** The record's suite entries by unit name (schema 2), falling back to the file's basename. */
function byName(rec) {
  const m = {};
  for (const e of (rec && rec.suites) || []) if (e) m[e.name || path.basename(String(e.file)).replace(/\.test\.js$/, '')] = e;
  return m;
}
function readJson(p) { const t = F.readSafe(p); try { return t === null ? null : JSON.parse(t); } catch { return null; } }
function span(sc, name) { return readJson(path.join(sc.dir, `span-${name}.json`)); }
function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}
async function gone(pid, timeoutMs = 5000) { return F.waitFor(() => !alive(pid), timeoutMs, 50); }
function pidIn(sc, file) { const t = F.readSafe(path.join(sc.dir, file)); const n = Number(t); return Number.isInteger(n) && n > 0 ? n : null; }
/** The run's lines before its summary ("Test Results"), where the suites' blocks are. */
function blockLines(stdout) {
  const ls = F.lines(stdout);
  const at = ls.findIndex((l) => l.trim() === 'Test Results');
  return at === -1 ? ls : ls.slice(0, at);
}
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ═══ P1–P5 — where and how many ═══════════════════════════════════════════════════════════════════ */

test('P1 (AC1; Decision 2): with GATE_JOBS=2, two suites that can only pass while the other is running both pass — suites run side by side', () => {
  F.need('runner');
  const sc = F.scenario();
  try {
    const r = F.runEngineSync(sc, [sc.suite('meet-a.test.js'), sc.suite('meet-b.test.js')], jobs(2));
    const { rec } = onlyRecord(sc, 'P1');
    const m = F.entryMap(rec);
    const a = m['meet-a.test.js'];
    const b = m['meet-b.test.js'];
    assert(a && a.verdict === 'PASS' && b && b.verdict === 'PASS',
      `each fixture waits up to 15 s for the other to start, so both pass only if the engine runs them at the same time (${ADR}, Decision 2: GATE_JOBS sets how many units run at once); ` +
      `got meet-a ${short(a)}, meet-b ${short(b)}`);
    assert(r.status === 0, `with both passing the run must exit 0; got ${r.status}. stderr: ${short(r.stderr)}`);
  } finally { sc.cleanup(); }
});

test('P2 (Decision 1): each suite loads and runs in a process of its own — not the engine\'s, and not another suite\'s', () => {
  F.need('runner');
  const sc = F.scenario();
  try {
    F.runEngineSync(sc, [sc.suite('chatty-a.test.js'), sc.suite('chatty-b.test.js')], jobs(2));
    const { rec } = onlyRecord(sc, 'P2');
    const a = span(sc, 'chatty-a');
    const b = span(sc, 'chatty-b');
    assert(a && b, `precondition: both fixtures run and record where they ran; got ${short(a)} and ${short(b)}`);
    assert(a.pid !== rec.pid && b.pid !== rec.pid,
      `a suite must run in a fresh process of its own, never in the engine's (pid ${rec.pid}) (${ADR}, Decision 1); chatty-a ran in ${a.pid}, chatty-b in ${b.pid}`);
    assert(a.pid !== b.pid, `two suites must not share a process (${ADR}, Decision 1); both ran in ${a.pid}`);
    assert(a.loadPid === a.pid && b.loadPid === b.pid,
      `each suite must load in the process that runs it, just before it runs (Decision 1); chatty-a loaded in ${a.loadPid} and ran in ${a.pid}, chatty-b loaded in ${b.loadPid} and ran in ${b.pid}`);
  } finally { sc.cleanup(); }
});

test('P3 (AC5; Decision 2): with GATE_JOBS=1 the suites run one at a time, in unit order, and the record and the first line say so', () => {
  F.need('runner');
  const sc = F.scenario();
  try {
    const r = F.runEngineSync(sc, [sc.suite('chatty-a.test.js'), sc.suite('chatty-b.test.js')], jobs(1));
    const { rec } = onlyRecord(sc, 'P3');
    const a = span(sc, 'chatty-a');
    const b = span(sc, 'chatty-b');
    assert(a && b, `precondition: both fixtures run and record when they ran; got ${short(a)} and ${short(b)}`);
    assert(a.end <= b.start,
      `with GATE_JOBS=1 nothing runs side by side, and units start in unit order (${ADR}, Decision 2): chatty-b must start after chatty-a ends; chatty-a ran ${a.start}–${a.end}, chatty-b ${b.start}–${b.end}`);
    assert(rec.machine && rec.machine.jobs === 1,
      `the record must say how many units ran at once — machine.jobs 1 (${ADR}, Decision 7); got machine ${short(rec.machine)}`);
    assert(/\b1 at a time on \d+ CPUs?\b/.test(F.firstLine(r.stdout)),
      `the first line must say "1 at a time on <n> CPUs (<model>)" (Decision 8); got ${JSON.stringify(F.firstLine(r.stdout))}`);
  } finally { sc.cleanup(); }
});

test('P4 (AC3; Decisions 2, 7, 8): with GATE_JOBS unset the engine runs one suite per CPU, and the record and the first line name the CPU count and model', () => {
  F.need('runner');
  const n = cpuCount();
  const model = cpuModel();
  const problems = [];
  for (const [env, want] of [[{ GATE_JOBS: undefined }, n], [{ GATE_JOBS: '3' }, 3]]) {
    const sc = F.scenario();
    try {
      const r = F.runEngineSync(sc, [sc.suite('pass.test.js')], { extraEnv: env });
      const { rec } = onlyRecord(sc, 'P4');
      const m = rec.machine || {};
      const label = env.GATE_JOBS === undefined ? 'GATE_JOBS unset' : `GATE_JOBS=${env.GATE_JOBS}`;
      if (m.cpus !== n || m.model !== model || m.jobs !== want) {
        problems.push(`${label}: the record must hold machine { cpus: ${n}, model: ${JSON.stringify(model)}, jobs: ${want} }; got ${short(rec.machine)}`);
      }
      const first = F.firstLine(r.stdout);
      if (!first.includes(`${want} at a time on ${n} CPU`) || (model && !first.includes(`(${model})`))) {
        problems.push(`${label}: the first line must say "${want} at a time on ${n} CPUs (${model})"; got ${JSON.stringify(first)}`);
      }
    } finally { sc.cleanup(); }
  }
  assert(problems.length === 0,
    `the default is os.availableParallelism(), here ${n}, and the log names the machine so runs on different GitHub runners can be compared (story AC3; ${ADR}, Decisions 2, 7 and 8):\n      - ${problems.join('\n      - ')}`);
});

test('P5 (Decision 2): a GATE_JOBS that is not a whole number of 1 or more ends the run FAIL before its first suite, naming GATE_JOBS', () => {
  F.need('runner');
  const problems = [];
  for (const value of ['0', '-2', 'two', '1.5']) {
    const sc = F.scenario();
    try {
      const r = F.runEngineSync(sc, [sc.suite('env-clean.test.js')], { extraEnv: { GATE_JOBS: value } });
      const ran = fs.existsSync(path.join(sc.dir, 'ran-env-clean.test.js'));
      const recs = F.readRecords(sc.recordDir);
      const got = [];
      if (r.status !== 1) got.push(`it exited ${r.status}`);
      if (!/^Overall: FAIL\b/.test(F.lastLine(r.stdout))) got.push(`its last line was ${JSON.stringify(F.lastLine(r.stdout))}`);
      if (!/GATE_JOBS/.test(`${r.stdout}\n${r.stderr}`)) got.push('no line named GATE_JOBS');
      if (ran) got.push('the suite ran');
      if (recs.some((x) => x.rec && x.rec.verdict === 'PASS')) got.push('its record reads PASS');
      if (got.length) problems.push(`GATE_JOBS=${JSON.stringify(value)}: ${got.join('; ')}`);
    } finally { sc.cleanup(); }
  }
  assert(problems.length === 0,
    `an invalid GATE_JOBS must end the run before its first suite: Overall FAIL, exit 1, a line naming GATE_JOBS, and no suite run (${ADR}, Decision 2):\n      - ${problems.join('\n      - ')}`);
});

/* ═══ P6–P8 — expand: a folder of suites that need no registry line ══════════════════════════════════ */

test('P6 (AC2; Decision 3): an entry with expand runs its own module with { discovered: \'separately\' }, then every *.test.js in that folder as a suite of its own, named by path, with counts that add up', () => {
  F.need('runner', 'status');
  const sc = F.scenario();
  try {
    const expand = sc.folder('ops');
    const own = { ...sc.suite('own.test.js'), expand };
    const r = F.runEngineSync(sc, [own], jobs(2));
    const { rec } = onlyRecord(sc, 'P6');
    const args = readJson(path.join(sc.dir, 'own-args.json'));
    assert(args && args.n === 1 && args.args && args.args[0] && args.args[0].discovered === 'separately',
      `the expanding entry's own module must be called as run({ discovered: 'separately' }), so it leaves the folder's files to the engine (${ADR}, Decision 3); it was called with ${short(args)}`);
    const names = (rec.suites || []).map((s) => s.name);
    const want = ['own', 'ops/bad', 'ops/good', 'ops/nested/also'];
    assert(JSON.stringify(names) === JSON.stringify(want),
      `the units must be the entry, then one per *.test.js under its folder at any depth, sorted by path, skipping node_modules and files that aren't suites, each named <folder>/<path> without .test.js (${ADR}, Decision 3; test plan, naming); ` +
      `want ${JSON.stringify(want)}, got the record's suites ${short((rec.suites || []).map((s) => s.name || s.file), 400)}`);
    const m = byName(rec);
    const counts = (e) => e && `${e.pass}/${e.fail}/${e.skipped}`;
    assert(m.own.verdict === 'PASS' && counts(m.own) === '2/0/0' && m['ops/good'].verdict === 'PASS' && counts(m['ops/good']) === '2/0/0'
      && m['ops/nested/also'].verdict === 'PASS' && counts(m['ops/nested/also']) === '2/0/1',
      `each unit keeps its own counts; got own ${short(m.own)}, ops/good ${short(m['ops/good'])}, ops/nested/also ${short(m['ops/nested/also'])}`);
    assert(m['ops/bad'].verdict === 'FAIL' && /exports no run\(\)/.test(String(m['ops/bad'].error)),
      `a file in the folder that exports no run() is still a FAIL of its own (ADR graph-operations-foundation/0001 Decision 12, kept); got ${short(m['ops/bad'])}`);
    const t = rec.totals || {};
    assert(t.passed === 6 && t.failed === 1 && t.skipped === 1,
      `no test lost or counted twice: the totals must be 6 passed, 1 failed, 1 skipped (story AC2); got ${short(rec.totals)}`);
    assert(r.status === 1 && /^Overall: FAIL\b.*\bacross 4 suites\b/.test(F.lastLine(r.stdout)),
      `the run must end FAIL, exit 1, and its Overall line must count the 4 units ("across 4 suites"; Decision 8); got exit ${r.status}, last line ${JSON.stringify(F.lastLine(r.stdout))}`);
    assert(/\b4 suites \(1 registered, with ops\S* 3 files run as suites of their own\)/.test(F.firstLine(r.stdout)),
      `the first line must say how the run counts its parts: "4 suites (1 registered, with ops' 3 files run as suites of their own)" (story AC2; Decision 8); got ${JSON.stringify(F.firstLine(r.stdout))}`);
    for (const [re, what] of [
      [/\[1\/4\] own: PASS\b/, '[1/4] own: PASS'], [/\[2\/4\] ops\/bad: FAIL\b/, '[2/4] ops/bad: FAIL'],
      [/\[3\/4\] ops\/good: PASS\b/, '[3/4] ops/good: PASS'], [/\[4\/4\] ops\/nested\/also: PASS \(2 passed, 0 failed, 1 skipped\)/, '[4/4] ops/nested/also: PASS (2 passed, 0 failed, 1 skipped)'],
    ]) {
      assert(re.test(r.stdout), `each unit gets its own result line, with its time (story AC3): no "${what}" line in the output`);
    }
    const s = F.runStatus([], sc.recordDir);
    assert(/failed: [^·]*\bops\/bad\b/.test(s.stdout),
      `gate:status must name a failed unit by its unit name, ops/bad (${ADR}, Decision 7); got ${JSON.stringify(short(s.stdout, 300))}`);

    // Without expand, the same module is called with nothing, as standalone runs and scoped gates call it.
    fs.rmSync(path.join(sc.dir, 'own-args.json'), { force: true });
    const plain = F.runEngineSync(sc, [sc.suite('own.test.js')], jobs(2));
    const plainArgs = readJson(path.join(sc.dir, 'own-args.json'));
    assert(plain.status === 0 && plainArgs && plainArgs.n === 0,
      `an entry without expand must call run() with no arguments, so a module like operations.test.js still runs its files itself there (${ADR}, Decision 3); got exit ${plain.status}, called with ${short(plainArgs)}`);
  } finally { sc.cleanup(); }
});

test('P7 (AC2, AC4; Decisions 3, 9): the real registry gives every entry a file, runs config-loading as test/config-loading.test.js, and expands operations.test.js over test/operations/ — and nothing else', () => {
  F.need('registry');
  const p = F.modulePath('registry');
  delete require.cache[require.resolve(p)];
  const reg = require(p);
  const suites = reg.suites || [];
  const noFile = suites.filter((e) => !e || typeof e.file !== 'string');
  assert(noFile.length === 0,
    `every registry entry must have a file, since a function can't be handed to another process (${ADR}, Decision 9); entries with none: ${short(noFile)}`);
  assert(suites[0] && suites[0].file === 'config-loading.test.js',
    `the config smoke check must be the first entry, as test/config-loading.test.js (Decision 9); the first entry is ${short(suites[0])}`);
  const expanding = suites.filter((e) => e && e.expand !== undefined);
  assert(expanding.length === 1 && expanding[0].file === 'operations.test.js' && expanding[0].expand === 'operations',
    `exactly one entry carries expand — operations.test.js, with expand: 'operations' (Decision 3); got ${short(expanding)}`);
  const opsFiles = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(abs); } else if (e.name.endsWith('.test.js')) opsFiles.push(abs);
    }
  }(path.join(REPO, 'test', 'operations')));
  assert(opsFiles.length >= 100,
    `precondition: test/operations/ holds the operation suites the expand entry turns into units (111 on 2026-11-21); found ${opsFiles.length}`);
  const r = cp.spawnSync(process.execPath, ['-e',
    "require(process.env.CONFIG_SUITE).run().then((r) => console.log('__R__' + JSON.stringify(r)), (e) => console.log('__THREW__' + e.message));"], {
    cwd: REPO,
    env: { ...process.env, CONFIG_SUITE: path.join(REPO, 'test', 'config-loading.test.js'), BRAINSTORM_RELAY_URL: 'wss://test-relay.com', BRAINSTORM_RELAY_PUBKEY: 'test-pubkey' },
    encoding: 'utf8',
    timeout: 30000,
  });
  const line = (r.stdout || '').split('\n').find((l) => l.startsWith('__R__'));
  const result = line ? JSON.parse(line.slice(5)) : null;
  assert(result && result.pass === 1 && result.fail === 0,
    `test/config-loading.test.js must do the same smoke check, passing with the two relay keys test/test.js sets; got ${short(result || r.stdout)} (stderr ${short(r.stderr)})`);
});

test('P8 (Decision 3): the real operations.test.js, run with { discovered: \'separately\' }, runs only its own tests and says the files under test/operations/ run as suites of their own', async () => {
  const START_FILES = '--- per-operation suites under test/operations/';
  const child = cp.spawn(process.execPath, ['-e',
    "require(process.env.OPS_SUITE).run({ discovered: 'separately' })" +
    ".then((r) => { console.log('__OPS_RESULT__' + JSON.stringify({ pass: r.pass, fail: r.fail, skipped: r.skipped })); process.exit(0); }," +
    " (e) => { console.log('__OPS_THREW__' + ((e && e.message) || e)); process.exit(1); });"],
  { cwd: REPO, env: { ...process.env, OPS_SUITE }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  let wentOn = false;
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (c) => {
    out += c;
    if (!wentOn && out.includes(START_FILES)) { wentOn = true; try { child.kill('SIGKILL'); } catch { /* gone */ } }
  });
  child.stderr.resume();
  const ended = await Promise.race([
    new Promise((resolve) => child.on('exit', () => resolve(true))),
    F.sleep(240000).then(() => false),
  ]);
  if (!ended) { try { child.kill('SIGKILL'); } catch { /* gone */ } }
  assert(!wentOn,
    `given { discovered: 'separately' }, operations.test.js must leave the files under test/operations/ to the engine (${ADR}, Decision 3); it went on to run them itself ("${START_FILES}…")`);
  assert(ended, 'operations.test.js run({ discovered: \'separately\' }) must finish; it was still going after 240 s');
  const line = out.split('\n').find((l) => l.startsWith('__OPS_RESULT__'));
  const res = line ? JSON.parse(line.slice('__OPS_RESULT__'.length)) : null;
  assert(res, `operations.test.js run({ discovered: 'separately' }) must return its counts; output ended ${JSON.stringify(short(out.slice(-300), 300))}`);
  const total = res.pass + res.fail + res.skipped;
  assert(total > 0 && total < 400,
    `its counts must be its own tests only, not the 1,400-odd in test/operations/ (story AC2: no test counted twice); got ${short(res)}`);
  assert(out.split('\n').some((l) => l.includes('test/operations/') && /suites of their own/.test(l)),
    'it must say in one line that the files under test/operations/ run as suites of their own (Decision 3)');
});

/* ═══ P9 — nothing a suite leaves in its process reaches the next ════════════════════════════════════ */

test('P9 (AC2; Decision 1): a global, a patched core module, a working-directory change and a loaded module that one suite leaves are not there for the next', () => {
  F.need('runner');
  const sc = F.scenario();
  try {
    F.runEngineSync(sc, [sc.suite('leave-state.test.js'), sc.suite('see-state.test.js')], jobs(1));
    const seen = readJson(path.join(sc.dir, 'seen-state.json'));
    assert(seen, 'precondition: see-state runs and records what it met');
    const problems = [];
    if (seen.leak !== null) problems.push(`it saw the global leave-state set (${JSON.stringify(seen.leak)})`);
    if (seen.patched) problems.push('it saw the property leave-state put on fs');
    if (seen.loads !== 1) problems.push(`the counting module had been loaded before (this was load ${seen.loads})`);
    let sameCwd = false;
    try { sameCwd = fs.realpathSync(seen.cwd) === fs.realpathSync(REPO); } catch { /* unreadable */ }
    if (!sameCwd) problems.push(`its working directory was ${seen.cwd}, not the engine's (${REPO})`);
    assert(problems.length === 0,
      `each suite starts in a fresh process with nothing another suite left — no global, no patched module, no require cache, the engine's working directory (${ADR}, Decision 1):\n      - ${problems.join('\n      - ')}`);
  } finally { sc.cleanup(); }
});

/* ═══ P10–P12 — the log and the record ═══════════════════════════════════════════════════════════════ */

test('P10 (AC3; Decision 5): two suites printing over the same seconds each come out as one block — header, their stdout and stderr in order, result line — never mixed', () => {
  F.need('runner');
  const sc = F.scenario();
  try {
    const r = F.runEngineSync(sc, [sc.suite('chatty-a.test.js'), sc.suite('chatty-b.test.js')], jobs(2));
    const a = span(sc, 'chatty-a');
    const b = span(sc, 'chatty-b');
    assert(a && b && a.start < b.end && b.start < a.end,
      `precondition: with GATE_JOBS=2 the two must run side by side, or this proves nothing (${ADR}, Decision 2); chatty-a ran ${a && `${a.start}–${a.end}`}, chatty-b ${b && `${b.start}–${b.end}`}`);
    const ls = blockLines(r.stdout);
    for (const [name, other] of [['chatty-a', 'chatty-b'], ['chatty-b', 'chatty-a']]) {
      const at = ls.map((l, i) => (l.includes(name) ? i : -1)).filter((i) => i !== -1);
      assert(at.length >= 18, `${name}: its header, 15 lines, its stderr line and its result line must all be in stdout; found ${at.length} lines naming it`);
      const block = ls.slice(at[0], at[at.length - 1] + 1);
      assert(new RegExp(`^▶ \\[\\d+/2\\] ${escRe(name)}\\s*$`).test(ls[at[0]]),
        `${name}: its block must open with "▶ [i/2] ${name}" (Decision 5); its first line is ${JSON.stringify(ls[at[0]])}`);
      assert(new RegExp(`\\[\\d+/2\\] ${escRe(name)}: PASS \\(1 passed, 0 failed, 0 skipped\\) \\d+ms`).test(ls[at[at.length - 1]]),
        `${name}: its block must close with its result line (Decision 5); its last line is ${JSON.stringify(ls[at[at.length - 1]])}`);
      assert(!block.some((l) => l.includes(other)),
        `${name}'s block must hold none of ${other}'s lines, though both printed over the same seconds (story AC3); its block was:\n${block.join('\n')}`);
      const order = block.map((l) => { const m = l.match(new RegExp(`${escRe(name)} line (\\d+)$`)); return m ? Number(m[1]) : null; }).filter((x) => x !== null);
      assert(JSON.stringify(order) === JSON.stringify([...Array(15).keys()]),
        `${name}: its 15 lines must appear once each, in order; got ${JSON.stringify(order)}`);
      const errAt = block.findIndex((l) => l.includes(`${name} on stderr`));
      const line7 = block.findIndex((l) => l.endsWith(`${name} line 7`));
      const line8 = block.findIndex((l) => l.endsWith(`${name} line 8`));
      assert(errAt > line7 && errAt < line8,
        `${name}: what it wrote to stderr must appear in its block, where it wrote it (between lines 7 and 8; Decision 5); found at ${errAt}`);
    }
  } finally { sc.cleanup(); }
});

test('P11 (AC3; Decisions 5, 7): result lines come as suites finish, while the record (schema 2, each suite named and timed) and the summary keep unit order', () => {
  F.need('runner');
  const sc = F.scenario();
  try {
    const r = F.runEngineSync(sc, [sc.suite('takes-a-while.test.js'), sc.suite('pass.test.js')], jobs(2));
    const { rec } = onlyRecord(sc, 'P11');
    const out = r.stdout;
    const slowAt = out.search(/\[1\/2\] takes-a-while: PASS\b/);
    const fastAt = out.search(/\[2\/2\] pass: PASS\b/);
    assert(slowAt !== -1 && fastAt !== -1 && fastAt < slowAt,
      `pass (unit 2) finishes about 1.5 s before takes-a-while (unit 1), so its block must come first: blocks appear as units finish, numbered by unit order (${ADR}, Decision 5); got pass at ${fastAt}, takes-a-while at ${slowAt}`);
    assert(rec.schema === 2, `the record must be schema 2 (Decision 7); got schema ${rec.schema}`);
    const names = (rec.suites || []).map((s) => s.name);
    assert(JSON.stringify(names) === JSON.stringify(['takes-a-while', 'pass']),
      `the record's suites must be in unit order, each with its name (Decision 7); got ${short((rec.suites || []).map((s) => s.name || s.file))}`);
    assert((rec.suites || []).every((s) => Number.isInteger(s.ms) && s.ms >= 0),
      `every suite entry must carry its time in ms, so a later ledger row can measure per suite (story AC3); got ${short((rec.suites || []).map((s) => s.ms))}`);
    const m = rec.machine || {};
    assert(Number.isInteger(m.cpus) && m.cpus >= 1 && typeof m.model === 'string' && m.jobs === 2,
      `the record must name the machine: machine { cpus, model, jobs: 2 } (Decision 7); got ${short(rec.machine)}`);
    const summary = out.slice(out.search(/^Test Results\s*$/m));
    const sumSlow = summary.search(/^takes-a-while: PASS/m);
    const sumFast = summary.search(/^pass: PASS/m);
    assert(sumSlow !== -1 && sumFast !== -1 && sumSlow < sumFast,
      `the Test Results summary must list units in unit order (Decision 5); got takes-a-while at ${sumSlow}, pass at ${sumFast}`);
  } finally { sc.cleanup(); }
});

test('P12 (Decision 7): while two suites run, the record lists both as running and gate:status shows both', async () => {
  F.need('runner', 'status');
  const sc = F.scenario();
  try {
    const e = F.startEngine(sc, [sc.suite('slow.test.js'), sc.suite('slow-two.test.js')], { label: 'two-running', ...jobs(2) });
    const mid = await F.waitFor(() => {
      const rec = (F.readRecords(sc.recordDir)[0] || {}).rec;
      return rec && rec.progress && Array.isArray(rec.progress.running) && rec.progress.running.length === 2 ? rec : null;
    }, 20000);
    assert(mid,
      `the record's progress.running must list every running unit, here slow and slow-two (${ADR}, Decision 7); progress was ${short(((F.readRecords(sc.recordDir)[0] || {}).rec || {}).progress)}`);
    assert([...mid.progress.running].sort().join(',') === 'slow,slow-two'
      && /\bslow\b/.test(String(mid.progress.current)) && /\bslow-two\b/.test(String(mid.progress.current)),
      `progress.running must name them, and progress.current must carry both names for older readers (Decision 7); got running ${short(mid.progress.running)}, current ${short(mid.progress.current)}`);
    const s = F.runStatus([], sc.recordDir);
    assert(s.status === 4 && /RUNNING/.test(s.stdout) && /\b0\/2\b/.test(s.stdout) && /\bslow\b/.test(s.stdout) && /\bslow-two\b/.test(s.stdout),
      `while it runs, gate:status must report RUNNING, 0/2, and both running units (Decision 7); got exit ${s.status}, ${JSON.stringify(short(s.stdout, 300))}`);
    e.child.kill('SIGKILL');
    await e.exited;
  } finally { sc.cleanup(); }
});

/* ═══ P13–P16 — processes end with their suite ═══════════════════════════════════════════════════════ */

test('P13 (Decision 6): a process a suite starts and leaves running is gone once that suite ends', async () => {
  F.need('runner');
  const sc = F.scenario();
  let leftover = null;
  try {
    const r = F.runEngineSync(sc, [sc.suite('leaves-child.test.js'), sc.suite('pass.test.js')], jobs(2));
    leftover = pidIn(sc, 'leftover-pid');
    assert(leftover, `precondition: leaves-child runs and records the pid of the process it leaves; exit ${r.status}`);
    const ok = await gone(leftover, 5000);
    assert(ok,
      `the process leaves-child started (pid ${leftover}) was still running 5 s after the run ended. Each suite's processes end with it, so none can hold a port or write a file during another suite (${ADR}, Decision 6)`);
  } finally {
    if (leftover && alive(leftover)) { try { process.kill(leftover, 'SIGKILL'); } catch { /* gone */ } }
    sc.cleanup();
  }
});

test('P14 (Decision 6): SIGINT while a suite runs prints that suite\'s output so far, marked unfinished, before "Overall: INTERRUPTED", and ends its process', async () => {
  F.need('runner');
  const sc = F.scenario();
  let hung = null;
  try {
    const e = F.startEngine(sc, [sc.suite('pass.test.js'), sc.suite('prints-then-hangs.test.js')], { label: 'interrupt-shows-running', ...jobs(2) });
    const ready = await F.waitFor(() => {
      const rec = (F.readRecords(sc.recordDir)[0] || {}).rec;
      return rec && rec.progress && rec.progress.completed >= 1 && pidIn(sc, 'hang-pid-prints-then-hangs') ? rec : null;
    }, 20000);
    assert(ready, 'precondition: pass must finish and prints-then-hangs must start before the signal');
    hung = pidIn(sc, 'hang-pid-prints-then-hangs');
    e.child.kill('SIGINT');
    const res = await e.exited;
    const ls = F.lines(e.output());
    const last = (ls[ls.length - 1] || '').trim();
    const partialAt = ls.findIndex((l) => l.includes('partial output before the interrupt (fixture: prints-then-hangs)'));
    const headAt = ls.findIndex((l) => l.includes('prints-then-hangs') && /unfinished/i.test(l));
    assert(res.status === 130 && /^Overall: INTERRUPTED\b/.test(last),
      `precondition: SIGINT still ends the run INTERRUPTED, exit 130; got exit ${res.status}, last line ${JSON.stringify(last)}`);
    assert(headAt !== -1 && partialAt > headAt && partialAt < ls.length - 1,
      `the interrupted run must print each running suite's output so far under a header marking it unfinished, before the Overall line, so a CI cancellation shows what was still running (${ADR}, Decision 6); ` +
      `header at ${headAt}, the fixture's line at ${partialAt}, of ${ls.length} lines`);
    assert(await gone(hung, 5000), `prints-then-hangs' process (pid ${hung}) must be gone after the interrupt (Decision 6)`);
  } finally {
    if (hung && alive(hung)) { try { process.kill(hung, 'SIGKILL'); } catch { /* gone */ } }
    sc.cleanup();
  }
});

test('P15 (Decision 4): an engine killed outright (SIGKILL) leaves no suite running', async () => {
  F.need('runner');
  const sc = F.scenario();
  let hung = null;
  try {
    const e = F.startEngine(sc, [sc.suite('prints-then-hangs.test.js')], { label: 'engine-killed', ...jobs(2) });
    hung = await F.waitFor(() => pidIn(sc, 'hang-pid-prints-then-hangs'), 20000);
    assert(hung, 'precondition: prints-then-hangs must start and record its pid');
    assert(hung !== e.child.pid,
      `prints-then-hangs ran in the engine's own process (pid ${hung}): each suite must run in a process of its own (${ADR}, Decision 1)`);
    e.child.kill('SIGKILL');
    await e.exited;
    assert(await gone(hung, 5000),
      `prints-then-hangs (pid ${hung}) was still running 5 s after its engine was killed. A unit whose engine is gone must end at once (Decision 4: on the IPC channel's disconnect)`);
  } finally {
    if (hung && alive(hung)) { try { process.kill(hung, 'SIGKILL'); } catch { /* gone */ } }
    sc.cleanup();
  }
});

test('P16 (AC2; Decision 4): a run() that never settles is that suite\'s FAIL, and the suite after it still runs', () => {
  F.need('runner');
  const sc = F.scenario();
  try {
    const r = F.runEngineSync(sc, [sc.suite('never-settles.test.js'), sc.suite('pass.test.js')], { ...jobs(1), timeoutMs: 30000 });
    const recs = F.readRecords(sc.recordDir);
    const m = F.entryMap(recs.length === 1 ? recs[0].rec : null);
    const stuck = m['never-settles.test.js'];
    const later = m['pass.test.js'];
    assert(later && later.verdict === 'PASS' && later.pass === 2,
      `the suite after a run() that never settles must still run and pass: it is one unit's FAIL, not the end of the run (${ADR}, Decision 4); pass's record entry is ${short(later)}`);
    assert(stuck && stuck.verdict === 'FAIL' && /never settled/.test(String(stuck.error)),
      `never-settles must be recorded FAIL, saying its run() never settled; got ${short(stuck)}`);
    assert(r.status === 1 && /^Overall: FAIL\b/.test(F.lastLine(r.stdout)),
      `the run must still end Overall: FAIL, exit 1 (gate-result-record C14); got exit ${r.status}, last line ${JSON.stringify(F.lastLine(r.stdout))}`);
  } finally { sc.cleanup(); }
});

/* ═══ P17 — an entry with no file ═══════════════════════════════════════════════════════════════════ */

test('P17 (AC2; Decision 9): an entry with no file — a { name, run } function — is that entry\'s FAIL ("has no file"), and the run goes on', () => {
  F.need('runner');
  const sc = F.scenario();
  try {
    const r = F.runFunctionEntryEngine(sc, [sc.suite('pass.test.js')], jobs(2));
    const recs = F.readRecords(sc.recordDir);
    const rec = recs.length === 1 ? recs[0].rec : null;
    const entries = (rec && rec.suites) || [];
    const fn = entries.find((x) => x && (x.name === 'a-function-suite' || x.file === 'a-function-suite'));
    const later = F.entryMap(rec)['pass.test.js'];
    assert(fn && fn.verdict === 'FAIL' && /has no file/.test(String(fn.error)),
      `a function can't be handed to another process, so an entry with no file must be that entry's FAIL, saying it has no file (${ADR}, Decision 9); its record entry is ${short(fn)}`);
    assert(later && later.verdict === 'PASS', `the suite after it must still run and pass; its record entry is ${short(later)}`);
    assert(r.status === 1 && /^Overall: FAIL\b/.test(F.lastLine(r.stdout)),
      `the run must end Overall: FAIL, exit 1; got exit ${r.status}, last line ${JSON.stringify(F.lastLine(r.stdout))}. stderr: ${short(r.stderr)}`);
  } finally { sc.cleanup(); }
});

/* ═══ P20 — the order units start in (Amendment 2) ═══════════════════════════════════════════════════ */

test('P20 (AC1; Amendment 2): side by side, the largest test file starts first — with GATE_JOBS=2 the largest of three, listed last, starts before the smallest, listed first — while the record keeps unit order', () => {
  F.need('runner');
  const sc = F.scenario();
  try {
    F.runEngineSync(sc, [sc.suite('size-small.test.js'), sc.suite('size-middle.test.js'), sc.suite('size-large.test.js')], jobs(2));
    const { rec } = onlyRecord(sc, 'P20');
    const small = span(sc, 'size-small');
    const middle = span(sc, 'size-middle');
    const large = span(sc, 'size-large');
    assert(small && middle && large, `precondition: all three run and record when they ran; got ${short({ small, middle, large }, 300)}`);
    assert(large.start < small.start && middle.start < small.start,
      `with GATE_JOBS=2 the two largest files must start first and the smallest wait for a free slot, so a long suite listed late can't set the run's tail (${ADR}, Amendment 2); ` +
      `started at small ${small.start}, middle ${middle.start}, large ${large.start}`);
    assert(small.start >= Math.min(large.end, middle.end),
      `the smallest must start only when one of the first two has ended (2 slots); it started at ${small.start}, and they ended at ${middle.end} and ${large.end}`);
    const names = (rec.suites || []).map((s) => s.name);
    assert(JSON.stringify(names) === JSON.stringify(['size-small', 'size-middle', 'size-large']),
      `the order they start in changes nothing else: the record keeps unit order (Amendment 2); got ${short(names)}`);
  } finally { sc.cleanup(); }
});

/* ═══ P18–P19 — the docs ═════════════════════════════════════════════════════════════════════════════ */

/** The text of the markdown section whose heading matches `re`, up to the next heading of the same or a higher level. */
function section(file, re) {
  const text = F.readSafe(path.join(REPO, file)) || '';
  const ls = text.split('\n');
  const at = ls.findIndex((l) => /^#{1,6}\s/.test(l) && re.test(l));
  if (at === -1) return '';
  const level = ls[at].match(/^#+/)[0].length;
  let end = ls.length;
  for (let i = at + 1; i < ls.length; i++) {
    const m = ls[i].match(/^(#+)\s/);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return ls.slice(at, end).join('\n');
}
function near(text, a, b, window = 400) {
  let from = 0;
  for (;;) {
    const i = text.indexOf(a, from);
    if (i === -1) return false;
    if (text.slice(Math.max(0, i - window), i + a.length + window).includes(b)) return true;
    from = i + 1;
  }
}

test('P18 (AC5): OPERATIONS.md §15 says suites run side by side, each in a process of its own; that GATE_JOBS=1 runs them one at a time; and that a failure seen only side by side gets a ledger row, never a retry', () => {
  const s = section('OPERATIONS.md', /CI test gate/);
  assert(s.length > 0, 'OPERATIONS.md must keep its "CI test gate" section (§15)');
  const missing = [];
  if (!/side by side/i.test(s)) missing.push('that suites run side by side');
  if (!/(process of its own|own process)/i.test(s)) missing.push('that each suite runs in a process of its own');
  if (!/GATE_JOBS/.test(s)) missing.push('GATE_JOBS, which sets how many run at once');
  if (!/GATE_JOBS=1\b/.test(s)) missing.push('GATE_JOBS=1, to run them one at a time');
  if (!near(s, 'side by side', 'ledger row')) missing.push('that a failure seen only side by side gets a ledger row (within a short reach of "side by side")');
  assert(missing.length === 0,
    `§15 must tell a contributor how the gate now runs and how to tell a side-by-side failure from a real one (story AC5; ${ADR}, Implementation notes, Docs); missing:\n      - ${missing.join('\n      - ')}`);
});

test('P19 (AC3, AC5): engineering-team/README.md, "Running and reading the test gate", names GATE_JOBS and says the run\'s first line names the CPUs', () => {
  const s = section('engineering-team/README.md', /Running and reading the test gate/);
  assert(s.length > 0, 'engineering-team/README.md must keep its "Running and reading the test gate" section');
  const missing = [];
  if (!/GATE_JOBS/.test(s)) missing.push('GATE_JOBS');
  if (!/first line/i.test(s) || !/CPU/.test(s)) missing.push("that the run's first line names the CPUs");
  assert(missing.length === 0,
    `the one recipe for running and reading the gate must cover the new run (${ADR}, Implementation notes, Docs); missing: ${missing.join('; ')}`);
});

async function run() {
  console.log('\n--- gate side by side (epic test-gate-speed, Story 1) ---');
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
  console.log(`\ngate-side-by-side: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
