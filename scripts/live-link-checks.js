#!/usr/bin/env node
'use strict';
/**
 * The live link checks' own run (honest-test-gate #2; OPERATIONS.md §15).
 *
 * The information-for-agents and llms-txt suites check every link they publish by fetching it from the public
 * internet. They are off in the pull-request gate. This runs both suites with the checks switched on
 * (TAPESTRY_LIVE_LINK_CHECKS=1), then prints how many link checks passed, failed and were skipped.
 *
 *   node scripts/live-link-checks.js            exit 0 when no link failed and at least one could be checked
 *   node scripts/live-link-checks.js --report   the same, and keep the GitHub issue, as the weekly workflow does
 *
 * With --report it uses the GitHub CLI (`gh`, with GH_TOKEN) on the issue whose title starts "Live link check".
 * A red run opens that issue, or comments on it if it is already open. A green run closes it, if open, naming
 * any link it could not check. A run that dies before it can count says so on the same issue. The issue links
 * the Actions run, from GITHUB_SERVER_URL, GITHUB_REPOSITORY and GITHUB_RUN_ID.
 * Without --report it never calls gh, so a person's own run never touches GitHub.
 */

const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const links = require(path.join(ROOT, 'test/helpers/liveLinkChecks'));

const SUITES = ['test/information-for-agents.test.js', 'test/llms-txt.test.js'];
const MARKER = 'Live link check';

function runUrl() {
  const { GITHUB_SERVER_URL: server, GITHUB_REPOSITORY: repo, GITHUB_RUN_ID: id } = process.env;
  return server && repo && id ? `${server}/${repo}/actions/runs/${id}` : null;
}

function gh(args, input = '') {
  return execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'inherit'] });
}

/** The issue's text for a red run: each dead link with its status, or, if none could be checked, why. */
function redBody({ dead, skips, counts, run }) {
  const lines = [];
  if (dead.length) {
    lines.push(`${dead.length} link check${dead.length === 1 ? '' : 's'} failed: these links answered something other than a 2xx.`, '');
    for (const c of dead) lines.push(`- ${c.url} answered ${c.status} (${c.suite})`);
  } else {
    lines.push(`No link could be checked: every link check was skipped. A run that checks nothing is not a clean bill of health.`, '');
    const reasons = new Map();
    for (const c of skips) reasons.set(c.reason, (reasons.get(c.reason) || 0) + 1);
    for (const [reason, n] of reasons) lines.push(`- ${n} skipped: ${reason}`);
  }
  lines.push('', counts);
  if (run) lines.push(`Run: ${run}`);
  lines.push('', 'These checks run weekly, and by hand from the Actions tab (Live link checks, then Run workflow). OPERATIONS.md §15 says how to run them yourself. The next green run closes this issue.');
  return lines.join('\n') + '\n';
}

/** The repository flags for gh, and the open issue this run keeps, if there is one. */
function issueContext() {
  const repo = process.env.GITHUB_REPOSITORY;
  const where = repo ? ['--repo', repo] : [];
  const listed = JSON.parse(gh(['issue', 'list', ...where, '--state', 'open', '--json', 'number,title', '--limit', '100']) || '[]');
  const open = listed.find((i) => i && typeof i.title === 'string' && i.title.startsWith(MARKER));
  return { where, open };
}

function report({ checks, passed, failed, skipped, red }) {
  const { where, open } = issueContext();
  const run = runUrl();
  const counts = `live link checks: ${passed} passed, ${failed} failed, ${skipped} skipped`;
  if (red) {
    const dead = checks.filter((c) => c.outcome === 'fail');
    const body = redBody({ dead, skips: checks.filter((c) => c.outcome === 'skip'), counts, run });
    if (open) {
      gh(['issue', 'comment', String(open.number), ...where, '--body-file', '-'], body);
      console.log(`reported on issue #${open.number}`);
    } else {
      const title = dead.length
        ? `${MARKER} failed: ${dead.length} dead link${dead.length === 1 ? '' : 's'}`
        : `${MARKER} could not check any link`;
      const url = gh(['issue', 'create', ...where, '--title', title, '--body-file', '-'], body).trim();
      console.log(`opened ${url || 'an issue'}`);
    }
  } else if (open) {
    // Name any link this run couldn't check: the one the issue was opened for may be among them.
    const skips = checks.filter((c) => c.outcome === 'skip');
    const lines = [skips.length
      ? `No link failed, and every link this run could check resolves again (${counts}). These ${skips.length} could not be checked, so this run can't say whether they resolve:`
      : `Every link resolves again (${counts}).`];
    for (const c of skips) lines.push(`- ${c.url} (${c.suite}): ${c.reason}`);
    if (run) lines.push('', `Run: ${run}`);
    gh(['issue', 'close', String(open.number), ...where, '--comment', lines.join('\n')]);
    console.log(`closed issue #${open.number}`);
  }
}

/** With --report, a run that died before it could count still reaches the issue (best effort). */
function reportCrash(err) {
  const { where, open } = issueContext();
  const run = runUrl();
  const first = String((err && err.message) || err).split('\n')[0];
  const body = [
    `The live link checks could not run: ${first}`, '',
    'No link was counted, so this run says nothing about the links. The next green run closes this issue.',
    ...(run ? ['', `Run: ${run}`] : []),
  ].join('\n') + '\n';
  if (open) gh(['issue', 'comment', String(open.number), ...where, '--body-file', '-'], body);
  else gh(['issue', 'create', ...where, '--title', `${MARKER} could not run`, '--body-file', '-'], body);
}

async function main(argv) {
  const reporting = argv.includes('--report');
  process.env[links.SWITCH] = '1';
  try {
    for (const file of SUITES) await require(path.join(ROOT, file)).run();
  } catch (err) {
    // The run died before it could count. Only this failure is reported as "could not run": a gh call that fails
    // later, after counting, goes to the top level and exits 2 without posting anything that isn't true.
    console.error(`live link checks: the run failed before it could count: ${(err && err.stack) || err}`);
    if (reporting) {
      try { reportCrash(err); } catch (e) { console.error(`live link checks: could not report that on GitHub either: ${(e && e.message) || e}`); }
    }
    return 2;
  }
  const checks = links.recorded;
  const count = (outcome) => checks.filter((c) => c.outcome === outcome).length;
  const passed = count('pass');
  const failed = count('fail');
  const skipped = count('skip');
  const red = failed > 0 || passed + failed === 0;
  console.log(`\nlive link checks: ${passed} passed, ${failed} failed, ${skipped} skipped`);
  for (const c of checks.filter((x) => x.outcome === 'fail')) console.log(`  dead: ${c.url} answered ${c.status} (${c.suite})`);
  if (passed + failed === 0) console.log('  no link could be checked: every one was skipped, so this run is red');
  if (reporting) report({ checks, passed, failed, skipped, red });
  return red ? 1 : 0;
}

// Exit once the output is written: the suites' stack checks leave abort timers pending that would hold the
// process open for up to 15 s.
const done = (code) => process.stdout.write('', () => process.exit(code));
main(process.argv.slice(2)).then(done, (err) => {
  // Here the run had counted, and something after it failed, such as a gh call. Its counts are already printed.
  console.error(`live link checks: the run failed after counting: ${(err && err.stack) || err}`);
  done(2);
});
