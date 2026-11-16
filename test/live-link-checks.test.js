'use strict';
/**
 * honest-test-gate #2 — the pull-request gate stops checking live links; a weekly run checks them and
 * files an issue.
 *   Story: engineering-team/stories/honest-test-gate/2-live-link-checks-leave-the-pr-gate.md
 *   ADR:   none. The owner skipped Architecture on 2026-11-16: a Bug whose design the owner chose from
 *          ledger row 2026-11-16-link-check-fails-during-prod-deploy's options.
 *   Plan:  engineering-team/stories/honest-test-gate/2-live-link-checks-leave-the-pr-gate.test-plan.md
 *
 * Stack-free, and it never reaches the internet. Every run below is a child process whose global fetch is
 * a stub, written to a temp folder when the suite starts. The stub answers each public URL as the test
 * says (200 unless told otherwise) and refuses every loopback URL, so the stack reads as absent. Issue
 * calls go to a fake `gh`, put first on PATH, which records each call. The temp folder is removed when the
 * suite ends.
 *
 * With no ADR, this suite pins the interface below (ratified at the Test Design gate):
 *   - TAPESTRY_LIVE_LINK_CHECKS=1 switches the live link checks on. Unset, or any other value, leaves
 *     them off.
 *   - `node scripts/live-link-checks.js` runs both suites with the checks switched on, prints one line
 *     `live link checks: <P> passed, <F> failed, <S> skipped`, and exits non-zero when a link check fails
 *     or when no link could be checked. It counts link checks, one per L1 test.
 *   - With `--report` it also keeps the GitHub issue, through `gh issue list|create|comment|close`, on an
 *     open issue whose title starts "Live link check", and links the run it belongs to from
 *     GITHUB_SERVER_URL, GITHUB_REPOSITORY and GITHUB_RUN_ID. Without `--report` it never calls gh.
 *   - One workflow under .github/workflows runs it with `--report`, weekly and on demand.
 *
 *   A1–A4  AC1  switched off (the default), neither suite makes a request, and each link check is SKIP
 *               with a reason naming the switch; every other test reports as it does switched on
 *   B1–B2  AC2  switched on, in each suite: a 2xx passes; a network failure or an egress gateway's own
 *               403 is SKIP with its reason; any other status fails, naming the link and the status
 *   C1–C6  AC3  the runner's counts and exit codes, and no gh call without --report; the workflow runs
 *               it weekly and on demand, never on a pull request; the pull-request gate never sets the
 *               switch
 *   D1–D7  AC4  --report opens an issue, comments on the open one, closes it once green, opens none when
 *               green, leaves other issues alone, and says why when no link could be checked
 *   D8–D12 AC4  a run that dies before it counts reports that (and calls no gh without --report); a gh call
 *               that fails after counting posts no "could not run"; a green close names the links it skipped
 *   E1–E2  AC5  OPERATIONS.md §15 says where the link checks went; the ledger row is closed
 *
 * The Implementer edits the two suites, OPERATIONS.md and the ledger row, and adds the runner and the
 * workflow. The Implementer does not edit this file.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const NL = String.fromCharCode(10);
const SUITES = {
  briefing: path.join(ROOT, 'test/information-for-agents.test.js'),
  llms: path.join(ROOT, 'test/llms-txt.test.js'),
};
const LABEL = { briefing: 'information-for-agents', llms: 'llms-txt' };
const RUNNER = path.join(ROOT, 'scripts/live-link-checks.js');
const OPERATIONS = path.join(ROOT, 'OPERATIONS.md');
const ROW = path.join(ROOT, 'ledger/2026-11-16-link-check-fails-during-prod-deploy.md');
const WORKFLOWS = path.join(ROOT, '.github/workflows');
const GATE_WORKFLOW = path.join(WORKFLOWS, 'test.yml');
const SWITCH = 'TAPESTRY_LIVE_LINK_CHECKS';
const MARKER = 'Live link check';
// A placeholder repository, never the real one: if the fake gh could not run (a temp folder mounted noexec, say),
// exec would fall through to a real gh later on PATH, and this name keeps that call from reaching any real repository
// (review round 1, non-blocking 4). gh's config folder is empty too (childEnv), though a gh that keeps its token in
// the system keychain may still be logged in; the placeholder is what makes such a call harmless.
const RUN_ENV = { GITHUB_SERVER_URL: 'https://github.example', GITHUB_REPOSITORY: 'live-link-checks-fixture/no-such-repo', GITHUB_RUN_ID: '424242' };
const RUN_URL = 'https://github.example/live-link-checks-fixture/no-such-repo/actions/runs/424242';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const show = (v) => JSON.stringify(v);
const need = (abs, why) => { if (!fs.existsSync(abs)) throw new Error(`${path.relative(ROOT, abs)} does not exist yet (${why})`); };

// ── The fakes ─────────────────────────────────────────────────────────────────────────────────────────

/** The fetch stub each child loads first (NODE_OPTIONS=--require). Its source is written to a file. */
function fetchStub() {
  const fs = require('fs');
  const NL = String.fromCharCode(10);
  const LOG = process.env.LINK_STUB_LOG;
  const MAP = JSON.parse(process.env.LINK_STUB_MAP || '{}');
  const loopback = (u) => {
    try { const h = new URL(u).hostname; return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'; } catch { return false; }
  };
  const failed = (code) => { const e = new TypeError('fetch failed'); e.cause = Object.assign(new Error(code), { code }); return e; };
  // LINK_STUB_CRASH names a file (a path suffix) that throws as it loads, to make the run die before it counts.
  if (process.env.LINK_STUB_CRASH) {
    const Module = require('module');
    const compile = Module.prototype._compile;
    Module.prototype._compile = function crashingCompile(src, file) {
      if (String(file).endsWith(process.env.LINK_STUB_CRASH)) src = "throw new Error('stub: this suite fails to load');" + src;
      return compile.call(this, src, file);
    };
  }
  globalThis.fetch = async function stubFetch(input) {
    const url = typeof input === 'string' ? input : (input && input.url) || String(input);
    if (loopback(url)) throw failed('ECONNREFUSED');
    if (LOG) fs.appendFileSync(LOG, url + NL);
    const how = Object.prototype.hasOwnProperty.call(MAP, url) ? MAP[url] : 200;
    if (how === 'neterr') throw failed('ENOTFOUND');
    if (how === 'egress403') return new Response('Host not in allowlist: stub.example. Add this host to your network egress settings.', { status: 403 });
    if (how === 'plain403') return new Response('Forbidden', { status: 403 });
    return new Response('stub', { status: Number(how) });
  };
}

/** The fake gh: records each call; answers `issue list` with FAKE_GH_OPEN and `issue create` with a URL. */
function fakeGh() {
  const fs = require('fs');
  const NL = String.fromCharCode(10);
  const argv = process.argv.slice(2);
  const entry = { argv };
  const at = argv.findIndex((a) => a === '--body-file' || a === '-F');
  if (at >= 0) {
    const src = argv[at + 1];
    try { entry.body = src === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(src, 'utf8'); } catch (e) { entry.bodyError = e.message; }
  }
  fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(entry) + NL);
  // FAKE_GH_FAIL names an issue subcommand (create, comment, close) that fails, after the call is recorded.
  if (argv[0] === 'issue' && process.env.FAKE_GH_FAIL && argv[1] === process.env.FAKE_GH_FAIL) {
    process.stderr.write(`fake gh: issue ${argv[1]} fails on purpose` + NL);
    process.exit(1);
  }
  if (argv[0] === 'issue' && argv[1] === 'list') process.stdout.write(process.env.FAKE_GH_OPEN || '[]');
  if (argv[0] === 'issue' && argv[1] === 'create') process.stdout.write('https://github.example/live-link-checks-fixture/no-such-repo/issues/99' + NL);
}

let FIX = null;
function fixtures() {
  if (FIX) return FIX;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'live-link-checks-'));
  const stub = path.join(dir, 'fetch-stub.js');
  fs.writeFileSync(stub, `'use strict';${NL}(${fetchStub.toString()})();${NL}`);
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'gh'), `#!/usr/bin/env node${NL}'use strict';${NL}(${fakeGh.toString()})();${NL}`, { mode: 0o755 });
  const ghConfig = path.join(dir, 'gh-config');
  fs.mkdirSync(ghConfig);
  FIX = { dir, stub, bin, ghConfig, seq: 0 };
  return FIX;
}
function cleanup() { if (FIX) { fs.rmSync(FIX.dir, { recursive: true, force: true }); FIX = null; } }

/** A child's environment: no switch and no GitHub token unless asked, a dead loopback stack, the stub, the fake gh.
 *  GH_CONFIG_DIR is an empty folder, so a real gh, if one were ever reached, has no stored config of its own. */
function childEnv(extra) {
  const f = fixtures();
  const env = { ...process.env };
  for (const k of [SWITCH, 'GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN', 'NODE_OPTIONS']) delete env[k];
  return Object.assign(env, RUN_ENV, {
    BRAINSTORM_BASE_URL: 'http://127.0.0.1:9',
    NODE_OPTIONS: `--require=${f.stub}`,
    PATH: `${f.bin}${path.delimiter}${process.env.PATH || ''}`,
    GH_CONFIG_DIR: f.ghConfig,
  }, extra);
}

function readLog(file) { return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(NL).filter(Boolean) : []; }

function finish(r, fetchLog, ghLog) {
  const stdout = String(r.stdout || '');
  const lines = stdout.split(NL);
  const resultLine = lines.find((l) => l.startsWith('RESULT:'));
  return {
    status: r.status,
    stdout,
    stderr: String(r.stderr || ''),
    lines,
    requested: readLog(fetchLog),
    gh: readLog(ghLog).map((l) => JSON.parse(l)),
    result: resultLine ? JSON.parse(resultLine.slice(7)) : null,
  };
}

/** Runs one suite's run() in a child. `on` sets the switch to 1; `value` sets it to exactly that string. */
function runSuite(which, { on = false, value, map = {} } = {}) {
  const f = fixtures();
  const seq = ++f.seq;
  const fetchLog = path.join(f.dir, `fetch-${seq}.log`);
  const ghLog = path.join(f.dir, `gh-${seq}.log`);
  const extra = { LINK_STUB_LOG: fetchLog, LINK_STUB_MAP: show(map), FAKE_GH_LOG: ghLog };
  if (value !== undefined) extra[SWITCH] = value;
  else if (on) extra[SWITCH] = '1';
  // The child exits as soon as it has its result: the suites' fetch helpers leave a 10–15 s abort timer
  // pending when a fetch fails, which would otherwise hold each child open that long.
  const code = [
    `require(${show(SUITES[which])}).run().then(`,
    `  (r) => process.stdout.write('RESULT:' + JSON.stringify({ pass: r.pass, fail: r.fail, skipped: r.skipped }) + String.fromCharCode(10), () => process.exit(0)),`,
    `  (e) => process.stdout.write('RESULT:' + JSON.stringify({ threw: String((e && e.stack) || e) }) + String.fromCharCode(10), () => process.exit(0)));`,
  ].join(NL);
  const r = spawnSync(process.execPath, ['-e', code], { cwd: ROOT, env: childEnv(extra), encoding: 'utf8', timeout: 120000 });
  return finish(r, fetchLog, ghLog);
}

/** Runs the weekly run's entry point in a child, as the workflow would, but with the fakes. */
function runRunner({ map = {}, report = false, open = '[]', crash, ghFail } = {}) {
  need(RUNNER, "the weekly run's entry point, story AC3");
  const f = fixtures();
  const seq = ++f.seq;
  const fetchLog = path.join(f.dir, `fetch-${seq}.log`);
  const ghLog = path.join(f.dir, `gh-${seq}.log`);
  const env = childEnv({ LINK_STUB_LOG: fetchLog, LINK_STUB_MAP: show(map), FAKE_GH_LOG: ghLog, FAKE_GH_OPEN: open });
  if (crash) env.LINK_STUB_CRASH = crash;
  if (ghFail) env.FAKE_GH_FAIL = ghFail;
  const r = spawnSync(process.execPath, [RUNNER, ...(report ? ['--report'] : [])], { cwd: ROOT, env, encoding: 'utf8', timeout: 240000 });
  const run = finish(r, fetchLog, ghLog);
  const m = /^live link checks: (\d+) passed, (\d+) failed, (\d+) skipped\b/m.exec(run.stdout);
  run.summary = m ? m.slice(1).map(Number) : null;
  return run;
}

// ── Reading the runs ──────────────────────────────────────────────────────────────────────────────────

/** Every reported test, in order, from the suites' `  PASS  <name>` lines. */
function outcomes(lines) {
  const out = [];
  lines.forEach((line, at) => { const m = /^  (PASS|FAIL|SKIP)  (.+)$/.exec(line); if (m) out.push({ outcome: m[1], name: m[2], at }); });
  return out;
}
const isLinkCheck = (o) => /^L1 /.test(o.name);
const urlOf = (o) => (/(https?:\/\/\S+)\s*$/.exec(o.name) || [])[1];
const linkChecks = (run) => outcomes(run.lines).filter(isLinkCheck);
/** Whether a line matching `re` sits on the test's own line, or the line just before or after it. */
const near = (lines, at, re) => lines.slice(Math.max(0, at - 1), at + 2).some((l) => re.test(l));

const cache = {};
/** Switched on, every link answering 200: the control that proves the stub sees the suite's requests. */
function control(which) {
  if (!cache[`on-${which}`]) cache[`on-${which}`] = runSuite(which, { on: true });
  return cache[`on-${which}`];
}
function off(which) {
  if (!cache[`off-${which}`]) cache[`off-${which}`] = runSuite(which, {});
  return cache[`off-${which}`];
}
function ran(run, what) {
  assert(run.result && !run.result.threw, `${what} ran to the end; got ${show(run.result)} ${run.stderr.slice(-300)}`);
}
const urlsOf = (which) => linkChecks(control(which)).map(urlOf);
const totalChecks = () => linkChecks(control('briefing')).length + linkChecks(control('llms')).length;
/** Links only the briefing has, so that breaking one fails exactly one link check. */
const onlyBriefing = () => [...new Set(urlsOf('briefing'))].filter((u) => !urlsOf('llms').includes(u));
const everyUrl = () => [...new Set([...urlsOf('briefing'), ...urlsOf('llms')])];

// ── AC1: switched off (the default), no link is fetched ─────────────────────────────────────────────

for (const [n, which] of [[1, 'briefing'], [2, 'llms']]) {
  test(`A${n} switched off, the ${LABEL[which]} suite makes no request, and each link check is SKIP with a reason naming ${SWITCH}=1 (AC1)`, () => {
    const ctl = control(which);
    ran(ctl, `the ${LABEL[which]} suite, switched on (the control)`);
    const ctlLinks = linkChecks(ctl);
    assert(ctlLinks.length >= 10, `the control run lists the suite's link checks; found ${ctlLinks.length}`);
    const unseen = ctlLinks.filter((o) => !ctl.requested.includes(urlOf(o)));
    assert(unseen.length === 0, `switched on, the stub sees a request for every link, so a run with none means the checks were off; not seen: ${show(unseen.map(urlOf))}`);
    const r = off(which);
    ran(r, `the ${LABEL[which]} suite, switched off`);
    assert(r.requested.length === 0, `switched off, the suite must make no request beyond the loopback; it requested ${show(r.requested)}`);
    const links = linkChecks(r);
    assert(links.length === ctlLinks.length, `switched off, every link check is still listed (${ctlLinks.length}); found ${links.length}`);
    const notSkipped = links.filter((o) => o.outcome !== 'SKIP');
    assert(notSkipped.length === 0, `switched off, each link check reports SKIP; these did not: ${show(notSkipped.map((o) => `${o.outcome} ${o.name}`))}`);
    const reason = new RegExp(`${SWITCH}=1`);
    const reasons = r.lines.filter((l) => reason.test(l)).length;
    const silent = links.filter((o) => !near(r.lines, o.at, reason));
    assert(silent.length === 0 && reasons >= links.length,
      `each skipped link check gives a reason naming ${SWITCH}=1, the way to switch the checks on; ${silent.length} gave none (${reasons} reason lines for ${links.length} checks), e.g. ${show(silent.slice(0, 2).map((o) => o.name))}`);
  });
}

test('A3 switched off, every other test in both suites reports as it does switched on (AC1)', () => {
  for (const which of ['briefing', 'llms']) {
    const others = (run) => outcomes(run.lines).filter((o) => !isLinkCheck(o)).map((o) => `${o.outcome} ${o.name}`);
    ran(control(which), `the ${LABEL[which]} suite, switched on`);
    ran(off(which), `the ${LABEL[which]} suite, switched off`);
    const on = others(control(which));
    const offed = others(off(which));
    assert(on.length >= 10, `the ${LABEL[which]} suite reports its other tests; found ${on.length}`);
    assert(show(offed) === show(on), `switched off, the ${LABEL[which]} suite's other tests report as they do switched on;${NL}  on:  ${show(on.filter((x) => !offed.includes(x)))}${NL}  off: ${show(offed.filter((x) => !on.includes(x)))}`);
  }
});

test(`A4 only ${SWITCH}=1 switches the checks on: set to "0", "", "true" or "yes", the briefing's suite still makes no request (AC1)`, () => {
  for (const value of ['0', '', 'true', 'yes']) {
    const r = runSuite('briefing', { value });
    ran(r, `the briefing's suite with ${SWITCH}=${show(value)}`);
    assert(r.requested.length === 0, `with ${SWITCH}=${show(value)}, the suite must make no request; it requested ${r.requested.length}`);
    const notSkipped = linkChecks(r).filter((o) => o.outcome !== 'SKIP');
    assert(linkChecks(r).length > 0 && notSkipped.length === 0, `with ${SWITCH}=${show(value)}, each link check reports SKIP; these did not: ${show(notSkipped.map((o) => o.name))}`);
  }
});

// ── AC2: switched on, the checks are today's checks ─────────────────────────────────────────────────

for (const [n, which] of [[1, 'briefing'], [2, 'llms']]) {
  test(`B${n} switched on, each ${LABEL[which]} link check: a 2xx passes; a network failure or an egress gateway's own 403 is SKIP with its reason; a 502, a 404 or a site's own 403 fails, naming the link and the status (AC2)`, () => {
    const urls = [...new Set(urlsOf(which))];
    assert(urls.length >= 6, `the ${LABEL[which]} suite has at least 6 distinct links to give the cases to; found ${urls.length}`);
    const [u502, u404, uEgress, u403, uNet] = urls;
    const r = runSuite(which, { on: true, map: { [u502]: 502, [u404]: 404, [uEgress]: 'egress403', [u403]: 'plain403', [uNet]: 'neterr' } });
    ran(r, `the ${LABEL[which]} suite, switched on`);
    const checksOf = (u) => { const os = linkChecks(r).filter((o) => urlOf(o) === u); assert(os.length >= 1, `no link check is reported for ${u}`); return os; };
    for (const [u, status] of [[u502, 502], [u404, 404], [u403, 403]]) {
      for (const o of checksOf(u)) {
        assert(o.outcome === 'FAIL', `a link answering ${status} fails; ${u} reported ${o.outcome}`);
        const msg = r.lines[o.at + 1] || '';
        assert(msg.includes(u) && msg.includes(String(status)), `the failure names the link and its status (${status}); got ${show(msg)}`);
      }
    }
    for (const [u, re, what] of [[uEgress, /egress/i, "an egress gateway's own 403"], [uNet, /no network|ENOTFOUND/i, 'a network failure']]) {
      for (const o of checksOf(u)) {
        assert(o.outcome === 'SKIP', `${what} is SKIP; ${u} reported ${o.outcome}`);
        assert(near(r.lines, o.at, re), `the SKIP gives its reason (${what}); the lines around it: ${show(r.lines.slice(Math.max(0, o.at - 1), o.at + 2))}`);
      }
    }
    const rest = linkChecks(r).filter((o) => ![u502, u404, uEgress, u403, uNet].includes(urlOf(o)));
    const notPassed = rest.filter((o) => o.outcome !== 'PASS');
    assert(rest.length > 0 && notPassed.length === 0, `every link answering 200 passes; these did not: ${show(notPassed.map((o) => `${o.outcome} ${o.name}`))}`);
  });
}

// ── AC3: the weekly run, and the same run on demand ─────────────────────────────────────────────────

test('C1 the runner switches the checks on by itself, runs both suites, prints "live link checks: N passed, 0 failed, 0 skipped" for every link check, and exits 0 when every link answers 2xx (AC3)', () => {
  const r = runRunner();
  const n = totalChecks();
  assert(show(r.summary) === show([n, 0, 0]), `expected "live link checks: ${n} passed, 0 failed, 0 skipped"; got ${show(r.summary)}${NL}${r.stdout.slice(-400)}${r.stderr.slice(-300)}`);
  assert(r.status === 0, `every link answers 2xx, so the run is green (exit 0); got ${r.status}`);
  const missing = everyUrl().filter((u) => !r.requested.includes(u));
  assert(missing.length === 0, `the runner checks every link of both suites, with ${SWITCH} unset by its caller; not requested: ${show(missing)}`);
  assert(r.gh.length === 0, `without --report the runner never calls gh; it made ${r.gh.length} call(s)`);
});

test('C2 one link answering 404: the runner prints 1 failed, its log names the link and the status, and it exits non-zero (AC3)', () => {
  const u = onlyBriefing()[0];
  assert(u, 'the briefing has a link the llms.txt suite does not');
  const r = runRunner({ map: { [u]: 404 } });
  const n = totalChecks();
  assert(show(r.summary) === show([n - 1, 1, 0]), `expected "live link checks: ${n - 1} passed, 1 failed, 0 skipped"; got ${show(r.summary)}${NL}${r.stdout.slice(-400)}${r.stderr.slice(-300)}`);
  assert(r.status !== 0 && r.status !== null, `a failing link makes the run red (a non-zero exit); got ${r.status}`);
  assert(r.stdout.includes(u) && /\b404\b/.test(r.stdout), `the run's log names the failing link (${u}) and its status (404)`);
  assert(r.gh.length === 0, `without --report the runner never calls gh; it made ${r.gh.length} call(s)`);
});

test('C3 when no link can be checked (every one a network failure), the runner prints 0 passed, 0 failed, N skipped and exits non-zero (AC3)', () => {
  const map = {};
  for (const u of everyUrl()) map[u] = 'neterr';
  const r = runRunner({ map });
  const n = totalChecks();
  assert(show(r.summary) === show([0, 0, n]), `expected "live link checks: 0 passed, 0 failed, ${n} skipped"; got ${show(r.summary)}${NL}${r.stdout.slice(-400)}${r.stderr.slice(-300)}`);
  assert(r.status !== 0 && r.status !== null, `a run that checked no link is red, not green; got exit ${r.status}`);
});

test('C4 some links skipped and none failing: the runner prints the skips and exits 0 (AC3)', () => {
  const [a, b] = onlyBriefing();
  assert(a && b, 'the briefing has two links the llms.txt suite does not');
  const r = runRunner({ map: { [a]: 'neterr', [b]: 'neterr' } });
  const n = totalChecks();
  assert(show(r.summary) === show([n - 2, 0, 2]), `expected "live link checks: ${n - 2} passed, 0 failed, 2 skipped"; got ${show(r.summary)}${NL}${r.stdout.slice(-400)}${r.stderr.slice(-300)}`);
  assert(r.status === 0, `skips with no failure leave the run green (exit 0); got ${r.status}`);
});

test('C5 one workflow runs the runner with --report, weekly and on demand, never on a pull request or a push, with issues: write, after npm ci (AC3, AC4)', () => {
  const yaml = require('js-yaml');
  const files = fs.readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
  const mine = files.filter((f) => /scripts\/live-link-checks\.js/.test(fs.readFileSync(path.join(WORKFLOWS, f), 'utf8')));
  assert(mine.length === 1, `exactly one workflow runs scripts/live-link-checks.js; found ${show(mine)}`);
  const wf = yaml.load(fs.readFileSync(path.join(WORKFLOWS, mine[0]), 'utf8')) || {};
  const on = wf.on && typeof wf.on === 'object' && !Array.isArray(wf.on) ? wf.on : {};
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const crons = (Array.isArray(on.schedule) ? on.schedule : []).map((s) => s && s.cron).filter(Boolean);
  assert(crons.length === 1, `${mine[0]} has one schedule entry; got ${show(crons)}`);
  const f5 = String(crons[0]).trim().split(/\s+/);
  assert(f5.length === 5 && /^\d+$/.test(f5[0]) && /^\d+$/.test(f5[1]) && f5[2] === '*' && f5[3] === '*' && /^([0-7]|SUN|MON|TUE|WED|THU|FRI|SAT)$/i.test(f5[4]),
    `the schedule fires once a week ("<minute> <hour> * * <weekday>"); got ${show(crons[0])}`);
  assert(has(on, 'workflow_dispatch'), 'a person can start the same run by hand (on: workflow_dispatch)');
  for (const t of ['pull_request', 'pull_request_target', 'push']) assert(!has(on, t), `the link checks never run on ${t}, and ${mine[0]} lists it`);
  const jobs = Object.values(wf.jobs || {});
  const perms = (o) => (o && typeof o.permissions === 'object' && o.permissions) || {};
  assert(perms(wf).issues === 'write' || jobs.some((j) => perms(j).issues === 'write'), 'the run may write issues (permissions: issues: write)');
  const steps = jobs.flatMap((j) => (Array.isArray(j.steps) ? j.steps : []).map((s) => String((s && s.run) || '')));
  const install = steps.findIndex((s) => /\bnpm ci\b/.test(s));
  const runIt = steps.findIndex((s) => /scripts\/live-link-checks\.js/.test(s) && /--report/.test(s));
  assert(runIt >= 0, 'a step runs node scripts/live-link-checks.js --report');
  assert(install >= 0 && install < runIt, 'the dependencies are installed (npm ci) before that step');
});

test(`C6 the pull-request gate never switches the checks on: no workflow that runs on a pull request sets ${SWITCH} (AC1)`, () => {
  const yaml = require('js-yaml');
  assert(fs.existsSync(GATE_WORKFLOW), 'the gate workflow .github/workflows/test.yml exists');
  let prWorkflows = 0;
  for (const f of fs.readdirSync(WORKFLOWS).filter((x) => /\.ya?ml$/.test(x))) {
    const text = fs.readFileSync(path.join(WORKFLOWS, f), 'utf8');
    const on = (yaml.load(text) || {}).on;
    const onPr = typeof on === 'string' ? /^pull_request/.test(on)
      : Array.isArray(on) ? on.some((t) => /^pull_request/.test(t))
        : !!on && (Object.prototype.hasOwnProperty.call(on, 'pull_request') || Object.prototype.hasOwnProperty.call(on, 'pull_request_target'));
    if (!onPr) continue;
    prWorkflows++;
    assert(!text.includes(SWITCH), `${f} runs on pull requests and must not set ${SWITCH}`);
  }
  assert(prWorkflows >= 1, 'at least one workflow (the gate) runs on pull requests');
});

// ── AC4: a red run opens an issue ───────────────────────────────────────────────────────────────────

/** A named flag's value in a gh call, as `--name value` or `--name=value`. */
function flag(argv, names) {
  for (let i = 0; i < argv.length; i++) {
    for (const name of names) {
      if (argv[i] === name) return argv[i + 1];
      if (argv[i].startsWith(`${name}=`)) return argv[i].slice(name.length + 1);
    }
  }
  return undefined;
}
const callsTo = (r, sub) => r.gh.filter((e) => e.argv[0] === 'issue' && e.argv[1] === sub);
const textOf = (e) => (e.body !== undefined ? e.body : (flag(e.argv, ['--body', '-b']) || flag(e.argv, ['--comment', '-c']) || ''));
const titleOf = (e) => flag(e.argv, ['--title', '-t']) || '';
const issueOf = (e) => (/(\d+)\s*$/.exec(String(e.argv[2] || '')) || [])[1];
const OPEN_7 = show([{ number: 7, title: 'Live link check failed: 1 link' }]);
const ghCalls = (r) => show(r.gh.map((e) => e.argv.slice(0, 3).join(' ')));

test('D1 --report with one link answering 404 and no issue open: one issue opens, titled "Live link check…", naming the link, its status and the run (AC4)', () => {
  const u = onlyBriefing()[0];
  const r = runRunner({ map: { [u]: 404 }, report: true });
  assert(r.status !== 0 && r.status !== null, `the run stays red with --report; got exit ${r.status}`);
  const made = callsTo(r, 'create');
  assert(made.length === 1, `one issue is opened; gh calls: ${ghCalls(r)}`);
  assert(titleOf(made[0]).startsWith(MARKER), `its title starts "${MARKER}"; got ${show(titleOf(made[0]))}`);
  const body = textOf(made[0]);
  assert(body.includes(u) && /\b404\b/.test(body) && body.includes(RUN_URL), `its body names ${u}, its status (404) and the run (${RUN_URL}); got ${show(body.slice(0, 600))}`);
  assert(callsTo(r, 'comment').length === 0 && callsTo(r, 'close').length === 0, `no issue is commented on or closed; gh calls: ${ghCalls(r)}`);
});

test('D2 --report with a link answering 404 while issue #7 from an earlier red run is open: the run comments on #7, naming the link, its status and the run, and opens no second issue (AC4)', () => {
  const u = onlyBriefing()[0];
  const r = runRunner({ map: { [u]: 404 }, report: true, open: OPEN_7 });
  assert(r.status !== 0 && r.status !== null, `the run stays red with --report; got exit ${r.status}`);
  assert(callsTo(r, 'create').length === 0, `no second issue is opened; gh calls: ${ghCalls(r)}`);
  const said = callsTo(r, 'comment').filter((e) => issueOf(e) === '7');
  assert(said.length === 1, `one comment goes on #7; gh calls: ${ghCalls(r)}`);
  const body = textOf(said[0]);
  assert(body.includes(u) && /\b404\b/.test(body) && body.includes(RUN_URL), `the comment names ${u}, its status (404) and the run (${RUN_URL}); got ${show(body.slice(0, 600))}`);
  assert(callsTo(r, 'close').length === 0, `a red run closes nothing; gh calls: ${ghCalls(r)}`);
});

test('D3 --report with two links failing, a 502 and a 404: the issue names each link with its own status (AC4)', () => {
  const [a, b] = onlyBriefing();
  const r = runRunner({ map: { [a]: 502, [b]: 404 }, report: true });
  const made = callsTo(r, 'create');
  assert(made.length === 1, `one issue is opened; gh calls: ${ghCalls(r)}`);
  const body = textOf(made[0]);
  const lineWith = (u) => body.split(NL).find((l) => l.includes(u)) || '';
  assert(/\b502\b/.test(lineWith(a)) && /\b404\b/.test(lineWith(b)), `each failing link appears on a line with its own status (${a}: 502, ${b}: 404); got ${show(body.slice(0, 800))}`);
});

test('D4 --report with every link answering 2xx and no issue open: the run is green and opens, comments on and closes nothing (AC4)', () => {
  const r = runRunner({ report: true });
  assert(r.status === 0, `every link answers 2xx, so the run is green (exit 0); got ${r.status} ${r.stderr.slice(-300)}`);
  for (const sub of ['create', 'comment', 'close']) assert(callsTo(r, sub).length === 0, `a green run makes no "gh issue ${sub}" call; gh calls: ${ghCalls(r)}`);
});

test('D5 --report with every link answering 2xx while issue #7 is open: the run closes #7 with a comment that every link resolves again, linking itself (AC4)', () => {
  const r = runRunner({ report: true, open: OPEN_7 });
  assert(r.status === 0, `every link answers 2xx, so the run is green (exit 0); got ${r.status} ${r.stderr.slice(-300)}`);
  assert(callsTo(r, 'create').length === 0, `a green run opens no issue; gh calls: ${ghCalls(r)}`);
  assert(callsTo(r, 'close').some((e) => issueOf(e) === '7'), `#7 is closed; gh calls: ${ghCalls(r)}`);
  const words = [...callsTo(r, 'comment'), ...callsTo(r, 'close')].filter((e) => issueOf(e) === '7').map(textOf).join(NL);
  assert(/resolve/i.test(words) && words.includes(RUN_URL), `the closing comment says every link resolves again and links the run (${RUN_URL}); got ${show(words.slice(0, 600))}`);
});

test('D6 --report leaves other issues alone: with only an unrelated issue #3 open, a red run opens its own issue and neither comments on nor closes #3 (AC4)', () => {
  const u = onlyBriefing()[0];
  const r = runRunner({ map: { [u]: 404 }, report: true, open: show([{ number: 3, title: 'Something else entirely' }]) });
  assert(callsTo(r, 'create').length === 1, `the run opens its own issue; gh calls: ${ghCalls(r)}`);
  const touched3 = [...callsTo(r, 'comment'), ...callsTo(r, 'close')].filter((e) => issueOf(e) === '3');
  assert(touched3.length === 0, `#3 is left alone; gh calls: ${ghCalls(r)}`);
});

test('D7 --report when no link could be checked: the run is red and its issue says that no link could be checked, linking the run (AC3, AC4)', () => {
  const map = {};
  for (const u of everyUrl()) map[u] = 'neterr';
  const r = runRunner({ map, report: true });
  assert(r.status !== 0 && r.status !== null, `a run that checked no link is red; got exit ${r.status}`);
  const made = callsTo(r, 'create');
  assert(made.length === 1, `one issue is opened; gh calls: ${ghCalls(r)}`);
  const body = textOf(made[0]);
  // The words as well as the counts line: "0 passed, 0 failed, N skipped" alone doesn't say why the run is red.
  assert(/skip/i.test(body) && /no link (?:could|was|were)|could ?not be checked|couldn.t be checked/i.test(body) && body.includes(RUN_URL),
    `its body says that the links were skipped, that no link could be checked, and links the run (${RUN_URL}); got ${show(body.slice(0, 600))}`);
});

// Added after review round 2: the run that dies before it counts, and a gh call that fails after it has counted.
const LLMS_SUITE = 'test/llms-txt.test.js';
const couldNotRun = (e) => /could not run|no link was counted/i.test(textOf(e));

test('D8 --report when a suite fails to load: the run exits 2 and opens one issue, titled "Live link check…", saying the checks could not run and linking the run (AC4)', () => {
  const r = runRunner({ report: true, crash: LLMS_SUITE });
  assert(r.status === 2, `a run that dies before it counts exits 2; got ${r.status} ${r.stderr.slice(-300)}`);
  const made = callsTo(r, 'create');
  assert(made.length === 1, `one issue is opened; gh calls: ${ghCalls(r)}`);
  assert(titleOf(made[0]).startsWith(MARKER), `its title starts "${MARKER}"; got ${show(titleOf(made[0]))}`);
  assert(couldNotRun(made[0]) && textOf(made[0]).includes(RUN_URL), `its body says the checks could not run, and links the run (${RUN_URL}); got ${show(textOf(made[0]).slice(0, 600))}`);
  assert(callsTo(r, 'comment').length === 0 && callsTo(r, 'close').length === 0, `nothing is commented on or closed; gh calls: ${ghCalls(r)}`);
});

test('D9 --report when a suite fails to load while issue #7 is open: the run comments on #7 that the checks could not run, and opens no second issue (AC4)', () => {
  const r = runRunner({ report: true, crash: LLMS_SUITE, open: OPEN_7 });
  assert(r.status === 2, `a run that dies before it counts exits 2; got ${r.status}`);
  assert(callsTo(r, 'create').length === 0, `no second issue is opened; gh calls: ${ghCalls(r)}`);
  const said = callsTo(r, 'comment').filter((e) => issueOf(e) === '7');
  assert(said.length === 1 && couldNotRun(said[0]) && textOf(said[0]).includes(RUN_URL), `one comment on #7 says the checks could not run, and links the run; gh calls: ${ghCalls(r)}`);
  assert(callsTo(r, 'close').length === 0, `nothing is closed; gh calls: ${ghCalls(r)}`);
});

test('D10 without --report, a run whose suite fails to load exits 2 and never calls gh (AC3; ratified interface 4)', () => {
  const r = runRunner({ crash: LLMS_SUITE });
  assert(r.status === 2, `a run that dies before it counts exits 2; got ${r.status}`);
  assert(r.gh.length === 0, `without --report the runner never calls gh, even when it dies; it made ${r.gh.length} call(s): ${ghCalls(r)}`);
});

test('D11 when gh fails after the run has counted, the run exits non-zero and posts no "could not run" report: a red run whose issue create fails, and a green run whose close fails (AC4)', () => {
  const u = onlyBriefing()[0];
  const red = runRunner({ map: { [u]: 404 }, report: true, ghFail: 'create' });
  assert(red.status !== 0 && red.status !== null, `a red run whose issue create fails exits non-zero; got ${red.status}`);
  const tried = callsTo(red, 'create');
  assert(tried.length >= 1 && textOf(tried[0]).includes(u), `the run tried to open the issue with its real result (${u}); gh calls: ${ghCalls(red)}`);
  const falseReports = red.gh.filter((e) => e.argv[0] === 'issue' && ['create', 'comment'].includes(e.argv[1]) && couldNotRun(e));
  assert(falseReports.length === 0, `a run that counted must not then report that it could not run; gh calls: ${ghCalls(red)}`);
  const green = runRunner({ report: true, open: OPEN_7, ghFail: 'close' });
  assert(green.status !== 0 && green.status !== null, `a green run whose close fails exits non-zero; got ${green.status}`);
  const greenFalse = green.gh.filter((e) => e.argv[0] === 'issue' && ['create', 'comment'].includes(e.argv[1]) && couldNotRun(e));
  assert(greenFalse.length === 0, `a green run whose close fails must not leave a "could not run" comment on #7; gh calls: ${ghCalls(green)}`);
});

test('D12 --report with two links skipped and none failing while issue #7 is open: the closing comment names both links it could not check (AC4)', () => {
  const [a, b] = onlyBriefing();
  const r = runRunner({ map: { [a]: 'neterr', [b]: 'neterr' }, report: true, open: OPEN_7 });
  assert(r.status === 0, `skips with no failure leave the run green (exit 0); got ${r.status}`);
  assert(callsTo(r, 'close').some((e) => issueOf(e) === '7'), `#7 is closed; gh calls: ${ghCalls(r)}`);
  const words = [...callsTo(r, 'comment'), ...callsTo(r, 'close')].filter((e) => issueOf(e) === '7').map(textOf).join(NL);
  assert(words.includes(a) && words.includes(b), `the closing comment names both skipped links (${a}, ${b}); got ${show(words.slice(0, 800))}`);
});

// ── AC5: the operations doc, and the ledger row ─────────────────────────────────────────────────────

test('E1 OPERATIONS.md §15 names both live link checks among what the gate leaves out, and says when they run, how to run them by hand, and where a failure goes (AC5)', () => {
  const ops = fs.readFileSync(OPERATIONS, 'utf8');
  const start = ops.indexOf(`${NL}## 15.`);
  assert(start >= 0, 'OPERATIONS.md has a "## 15." section');
  const next = ops.indexOf(`${NL}## `, start + 1);
  const s15 = ops.slice(start, next < 0 ? undefined : next);
  for (const [re, what] of [
    [/information-for-agents/, "the briefing's suite (information-for-agents)"],
    [/llms[-.]txt/, 'the llms.txt suite'],
    [new RegExp(`${SWITCH}=1`), `the switch, ${SWITCH}=1`],
    [/weekly|every week|once a week/i, 'when the checks run instead (weekly)'],
    [/workflow_dispatch|Run workflow|by hand/i, 'how to run them by hand'],
    [/\bissue\b/i, 'where a failure is reported (an issue)'],
  ]) assert(re.test(s15), `§15 must name ${what}`);
});

test('E2 ledger row 2026-11-16-link-check-fails-during-prod-deploy is closed: Status DONE, with a Done line giving the date and the pull request (AC5)', () => {
  const row = fs.readFileSync(ROW, 'utf8');
  assert(/^\*\*Status:\*\* DONE\b/m.test(row), 'the row says **Status:** DONE');
  // "in #<n>" or "PR #<n>", so a story's own number (honest-test-gate #2) on the line doesn't count as the pull request.
  assert(/^\*\*Done:\*\* \d{4}-\d{2}-\d{2}\b.*\b(?:in|PR|pull request) #\d+/m.test(row), 'its Done line gives an ISO date and the pull request ("in #<n>")');
});

// ── Run ───────────────────────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`${NL}--- live link checks leave the pull-request gate (epic honest-test-gate, Story 2) ---`);
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  try {
    for (const [name, fn] of tests) {
      try {
        const r = await fn();
        if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
        else { console.log(`  PASS  ${name}`); pass++; }
      } catch (err) {
        console.log(`  FAIL  ${name}${NL}        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
      }
    }
  } finally {
    cleanup();
  }
  console.log(`${NL}live-link-checks: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1), (e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
