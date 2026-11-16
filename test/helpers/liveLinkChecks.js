'use strict';
/**
 * The live link checks: the information-for-agents and llms-txt suites' L1 tests, which fetch every link
 * those documents publish (honest-test-gate #2, OPERATIONS.md §15). One switch and one set of rules for both.
 *
 * They fetch the public internet, so a red from them says something about a website at that minute, not
 * about the pull request. In the pull-request gate they are off, and each check reports SKIP naming the
 * switch. TAPESTRY_LIVE_LINK_CHECKS=1 turns them on, in a person's own run or in the weekly one
 * (scripts/live-link-checks.js, run by .github/workflows/live-link-checks.yml).
 *
 * Switched on, a check follows these rules. A 2xx passes. A network failure, or a cloud egress gateway's own
 * 403, is SKIP with its reason (ledger 2026-10-04-llms-txt-egress-403-false-fail). Any other status fails.
 * Every check's outcome is recorded, so the weekly run can count and report them.
 */

const SWITCH = 'TAPESTRY_LIVE_LINK_CHECKS';
const OFF_REASON = `live link checks are off; set ${SWITCH}=1 to run them (OPERATIONS.md §15)`;

/** On only when the switch is exactly 1. Read at each check, so whoever sets it before the run is heard. */
function liveLinkChecksOn() { return process.env[SWITCH] === '1'; }

/** A 403 written by a sandbox's egress gateway, not by the host. Seen in Claude Code cloud containers:
 *  "Host not in allowlist: <host>. Add this host to your network egress settings…", and through the agent
 *  proxy, "GitHub access to this repository is not enabled for this session". The host never saw the
 *  request, so the link's health is unknown, not bad. */
function isEgressRefusal(status, body) {
  return status === 403 &&
    /Host not in allowlist|network egress settings|not enabled for this session/i.test(body || '');
}

/** Fetches one link: { status } when the host answered, { skip: reason } when it couldn't be asked. */
async function checkLink(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal, redirect: 'follow' });
    const body = res.status === 403 ? await res.text().catch(() => '') : '';
    if (isEgressRefusal(res.status, body)) return { skip: `egress gateway refused the host (${res.status})` };
    return { status: res.status };
  } catch (e) {
    return { skip: `no network (${(e && e.cause && e.cause.code) || (e && e.message)})` };
  } finally {
    clearTimeout(timer);
  }
}

/** Every check made in this process: { suite, url, outcome: 'pass' | 'fail' | 'skip', status?, reason? }. */
const recorded = [];

/** One L1 check for `suite`: { skip: reason } when it is off or couldn't be asked, else { status }. */
async function liveLinkCheck(suite, url) {
  const r = liveLinkChecksOn() ? await checkLink(url) : { skip: OFF_REASON };
  if (r.skip) recorded.push({ suite, url, outcome: 'skip', reason: r.skip });
  else recorded.push({ suite, url, outcome: r.status >= 200 && r.status < 300 ? 'pass' : 'fail', status: r.status });
  return r;
}

module.exports = { SWITCH, OFF_REASON, liveLinkChecksOn, isEgressRefusal, checkLink, liveLinkCheck, recorded };
