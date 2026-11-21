'use strict';
/**
 * Story container-apt-refresh #1: every build of the tapestry image brings its Ubuntu packages up to date at least
 * once a week. ADR container-apt-refresh/0001 (Accepted): a refresh step between the npm installs and `COPY .`, keyed
 * by the ISO week that every server deploy and the brains' build pass in as PACKAGES_REFRESH.
 *   Story:     engineering-team/stories/done/container-apt-refresh/1-deploys-refresh-ubuntu-packages.md
 *   Test plan: engineering-team/stories/done/container-apt-refresh/1-deploys-refresh-ubuntu-packages.test-plan.md
 *
 * Stack-free in every run:
 *   D  the Dockerfile, source level: the step's place, its apt options, its guard and its marker.
 *   C  docker-compose.yml passes PACKAGES_REFRESH to the tapestry build.
 *   W  the four deploy workflows. Each one's SSH script runs under bash, with docker, git and sed stubbed first on
 *      PATH and /opt/tapestry swapped for a temp folder, so nothing touches Docker, a checkout or a server. A script is
 *      run only once `command -v docker` resolves to the stub.
 *   P  publish-image.yml passes the week to the brains' build. Its week step runs under bash.
 *   O  OPERATIONS.md, docs/SAFE_TO_MERGE.md and the two cycle skills say how the refresh works (AC-5).
 *
 * Live, off unless TAPESTRY_LIVE_DOCKER_CHECKS=1. Off, each L test SKIPs and names the switch:
 *   L  the Dockerfile's refresh step, copied verbatim, runs in throwaway containers from a stale base image, with
 *      stand-in neo4j and nodejs packages and an unreachable third-party source. They need Docker and Ubuntu's archive,
 *      take a few minutes, and never touch a running stack (docker run --rm only; no compose, ports or volumes).
 *      Run them by hand at Test Design and at Review.
 *
 * Before the implementation, every D, C, P and O test fails on a contract assertion, never a load error. So do W1 for
 * all four workflows, and W2 for deploy-staging.yml and deploy-magic-carpet.yml. W2 already holds for
 * deploy-tapestry.yml and deploy-tags.yml, which have set -euo pipefail; for them it is a guard.
 * D7, O5 and O6 came with review round 1 (ADR Amendment 1). Each failed on its contract assertion before that round's
 * fix.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const DOCKERFILE = path.join(ROOT, 'Dockerfile');
const COMPOSE_FILES = ['docker-compose.yml', 'docker-compose.dev.yml'].map((f) => path.join(ROOT, f));
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');
const DEPLOY_WORKFLOWS = ['deploy-staging.yml', 'deploy-tapestry.yml', 'deploy-tags.yml', 'deploy-magic-carpet.yml'];
const PUBLISH = path.join(WORKFLOWS, 'publish-image.yml');
const OPERATIONS = path.join(ROOT, 'OPERATIONS.md');
const SAFE_TO_MERGE = path.join(ROOT, 'docs', 'SAFE_TO_MERGE.md');
const CYCLE_SKILLS = ['cycle-staging', 'cycle-prod'].map((s) => path.join(ROOT, '.claude', 'skills', s, 'SKILL.md'));

const ADR = 'ADR container-apt-refresh/0001';
const ARG_NAME = 'PACKAGES_REFRESH';
const MARKER = '/etc/tapestry/packages-refresh';
const WEEK = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/; // what `date -u +%G-W%V` prints, e.g. 2026-W47
const WEEK_EXPR = /PACKAGES_REFRESH="?\$\(date -u \+%G-W%V\)/;
const SWITCH = 'TAPESTRY_LIVE_DOCKER_CHECKS';
// A base image whose packages are months old, so a refresh always has updates to apply.
const STALE_BASE = 'ubuntu:jammy-20260509';

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const NOT_IMPL = (what) => `${what}: not implemented yet (${ADR}).`;
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

// ═══ Reading the Dockerfile ═══════════════════════════════════════════════════════════════════════════════════════

/** Dockerfile instructions with continuation lines joined; comment lines dropped (as router-stream-limit-on-connect). */
function dockerInstructions(src) {
  const out = [];
  let cur = null;
  for (const line of src.split('\n')) {
    if (cur === null) {
      if (/^\s*(#|$)/.test(line)) continue;
      cur = line;
    } else {
      if (/^\s*#/.test(line)) continue;
      cur += '\n' + line;
    }
    if (!/\\\s*$/.test(line)) { out.push(cur); cur = null; }
  }
  if (cur !== null) out.push(cur);
  return out;
}
function firstIndex(instrs, re, from = 0) {
  for (let i = from; i < instrs.length; i++) if (re.test(instrs[i])) return i;
  return -1;
}
function lastIndex(instrs, re, before = instrs.length) {
  let at = -1;
  for (let i = 0; i < before; i++) if (re.test(instrs[i])) at = i;
  return at;
}

/** The refresh step: `ARG PACKAGES_REFRESH` and the first RUN after it, which must be an apt-get full-upgrade. */
function refreshStep() {
  const instrs = dockerInstructions(safeRead(DOCKERFILE));
  assert(instrs.length > 0, 'the Dockerfile is missing or empty; unexpected.');
  const arg = firstIndex(instrs, new RegExp(`^ARG\\s+${ARG_NAME}(=|\\s|$)`));
  assert(arg !== -1, NOT_IMPL(`the Dockerfile must declare \`ARG ${ARG_NAME}\` for the refresh step`));
  const run = firstIndex(instrs, /^RUN\s/, arg + 1);
  assert(run !== -1 && /\bfull-upgrade\b/.test(instrs[run]),
    NOT_IMPL(`the first RUN after \`ARG ${ARG_NAME}\` must be the refresh step, an apt-get full-upgrade`));
  return { instrs, arg, run, text: instrs[run], body: instrs[run].replace(/^RUN\s+/, '') };
}

// ═══ D: the Dockerfile ════════════════════════════════════════════════════════════════════════════════════════════

test('D1 (AC-1): a refresh step brings Ubuntu\'s packages up to date, keyed by ARG PACKAGES_REFRESH', () => {
  const { text } = refreshStep();
  assert(/\bapt-get\b[^\n;&|]*\bupdate\b/.test(text), 'the refresh step must run apt-get update before it upgrades.');
});

test('D2 (AC-4): the refresh step comes after the NodeSource, strfry, Neo4j and npm steps and before COPY ., so a refresh redoes none of them and a push alone never re-runs it', () => {
  const { instrs, arg } = refreshStep();
  const copyAll = firstIndex(instrs, /^COPY\s+\.\s+\/usr\/local\/lib\/node_modules\/brainstorm\/?\s*$/);
  assert(copyAll !== -1, 'the `COPY . /usr/local/lib/node_modules/brainstorm/` step is missing; unexpected.');
  const heavy = {
    'the NodeSource step': lastIndex(instrs, /deb\.nodesource\.com/, copyAll),
    'the strfry build': lastIndex(instrs, /git clone[^\n]*hoytech\/strfry/, copyAll),
    'the Neo4j install': lastIndex(instrs, /apt-get install[^\n]*\bneo4j=/, copyAll),
    'the last npm install': lastIndex(instrs, /^RUN\s[\s\S]*\bnpm (install|ci)\b/, copyAll),
  };
  for (const [what, at] of Object.entries(heavy)) {
    assert(at !== -1, `${what} is missing from the Dockerfile; unexpected.`);
    assert(at < arg, `ARG ${ARG_NAME} must come after ${what}: a new week would otherwise redo it.`);
  }
  assert(arg < copyAll, `ARG ${ARG_NAME} and the refresh step must come before \`COPY .\`, which every push changes.`);
});

test('D3 (AC-1, AC-3, AC-4): the refresh step reads Ubuntu\'s sources only, fails when a source can\'t be reached, takes every update without removing anything, and cleans its lists', () => {
  const { text } = refreshStep();
  const need = [
    ['Dir::Etc::SourceParts=-', 'read /etc/apt/sources.list alone, leaving the NodeSource and Neo4j lists out'],
    ['--error-on=any', 'make apt-get update fail when a source can\'t be reached (it only warns by default)'],
    ['--no-remove', 'stop rather than remove a package'],
    ['APT::Get::Always-Include-Phased-Updates=true', 'take phased updates too, so nothing Ubuntu has published is left waiting'],
    ['--force-confdef', 'keep a locally edited config file instead of stopping at dpkg\'s prompt'],
    ['--force-confold', 'keep a locally edited config file instead of stopping at dpkg\'s prompt'],
  ];
  const missing = need.filter(([token]) => !text.includes(token)).map(([token, why]) => `${token} (to ${why})`);
  assert(missing.length === 0, `the refresh step is missing: ${missing.join('; ')}.`);
  assert(/(^|\s)(-y|--yes|--assume-yes)(\s|;|$)/m.test(text), 'the refresh step must answer yes (-y) to the upgrade.');
  assert(/rm -rf \/var\/lib\/apt\/lists/.test(text), 'the refresh step must remove /var/lib/apt/lists/*, as the other apt steps do.');
});

test('D4 (AC-3): the refresh step reads the neo4j and nodejs versions before the upgrade and again after it', () => {
  const { text } = refreshStep();
  const upgrade = text.indexOf('--no-remove');
  assert(upgrade !== -1, 'the refresh step has no `--no-remove` full-upgrade; see D3.');
  const queries = [];
  const re = /dpkg-query[^\n;]*/g;
  let m;
  while ((m = re.exec(text))) if (/\bneo4j\b/.test(m[0]) && /\bnodejs\b/.test(m[0])) queries.push(m.index);
  assert(queries.some((i) => i < upgrade), 'the refresh step must record the neo4j and nodejs versions (dpkg-query) before the upgrade.');
  assert(queries.some((i) => i > upgrade), 'the refresh step must read the neo4j and nodejs versions (dpkg-query) again after the upgrade, and fail when they differ.');
});

test('D5 (AC-2): the refresh step writes /etc/tapestry/packages-refresh with the week, the time and the count, outside every volume', () => {
  const { text } = refreshStep();
  assert(text.includes(MARKER), `the refresh step must write its marker to ${MARKER}.`);
  for (const key of ['week=', 'refreshed_at=', 'upgraded=']) {
    assert(text.includes(key), `the marker must carry \`${key}\`.`);
  }
  const hiding = [];
  for (const file of COMPOSE_FILES) {
    const doc = yaml.load(safeRead(file)) || {};
    const vols = (((doc.services || {}).tapestry || {}).volumes) || [];
    for (const v of vols) {
      const dst = typeof v === 'string' ? v.split(':')[1] : v && v.target;
      if (dst && (MARKER === dst || MARKER.startsWith(dst.replace(/\/?$/, '/')))) hiding.push(`${path.basename(file)}: ${dst}`);
    }
  }
  assert(hiding.length === 0, `a volume would hide the marker: ${hiding.join(', ')}.`);
});

test('D6 (AC-4): the refresh step stops at its first failing command', () => {
  const { body } = refreshStep();
  assert(/^set\s+-[a-z]*e[a-z]*\b/.test(body.trim()), 'the refresh step must start with `set -e` (or `set -eu`), so a failed apt-get fails the build.');
});

test('D7 (AC-2): the count\'s simulation takes the upgrade\'s own options, so the marker counts what the upgrade does (ADR Amendment 1, item 3)', () => {
  const { text } = refreshStep();
  const sim = (text.match(/apt-get[^\n;|]*\s-s\s[^\n;|]*full-upgrade/) || [])[0];
  assert(sim, 'the refresh step must count its packages with a simulated full-upgrade (`apt-get … -s … full-upgrade`).');
  const missing = ['--no-remove', 'APT::Get::Always-Include-Phased-Updates=true'].filter((o) => !sim.includes(o));
  assert(missing.length === 0,
    `the count's simulation must take the upgrade's own options, so a phased update the upgrade installs is counted too; it lacks ${missing.join(' and ')}.`);
});

// ═══ C: docker-compose.yml ════════════════════════════════════════════════════════════════════════════════════════

test('C1 (AC-1, AC-4): docker-compose.yml passes PACKAGES_REFRESH from the environment to the tapestry build, empty when unset', () => {
  const doc = yaml.load(safeRead(COMPOSE_FILES[0])) || {};
  const build = ((doc.services || {}).tapestry || {}).build;
  assert(build && typeof build === 'object',
    NOT_IMPL(`docker-compose.yml's tapestry service must use the long \`build:\` form, with \`context: .\` and \`args:\`, not \`build: ${build}\``));
  assert(['.', './'].includes(build.context), `the tapestry build's context must stay \`.\`, not ${JSON.stringify(build.context)}.`);
  let value;
  if (Array.isArray(build.args)) {
    const entry = build.args.find((a) => typeof a === 'string' && a.startsWith(`${ARG_NAME}=`));
    value = entry && entry.slice(ARG_NAME.length + 1);
  } else if (build.args && typeof build.args === 'object') {
    value = build.args[ARG_NAME];
  }
  assert(value !== undefined, NOT_IMPL(`the tapestry build's args must pass ${ARG_NAME}`));
  assert(new RegExp(`^\\$\\{${ARG_NAME}:?-[^}]*\\}$`).test(String(value)),
    `${ARG_NAME} must come from the environment with a default for local builds, as \`\${${ARG_NAME}:-}\`, not ${JSON.stringify(value)}.`);
});

// ═══ W: the four deploy workflows ═════════════════════════════════════════════════════════════════════════════════

/** The script a deploy workflow's SSH step runs on its server. */
function deployScript(file) {
  const doc = yaml.load(safeRead(path.join(WORKFLOWS, file)));
  assert(doc && doc.jobs, `${file} is missing or unreadable; unexpected.`);
  for (const job of Object.values(doc.jobs)) {
    for (const step of job.steps || []) {
      if (typeof step.uses === 'string' && step.uses.startsWith('appleboy/ssh-action@') && step.with && step.with.script) {
        return step.with.script;
      }
    }
  }
  throw new Error(`${file} has no appleboy/ssh-action step with a script; unexpected.`);
}

/**
 * Runs a deploy script under bash with docker, git and sed stubbed, and /opt/tapestry swapped for a temp folder.
 * Each stub appends its arguments to a call log; docker also logs the PACKAGES_REFRESH it was given. With failUp,
 * `docker compose up` exits 1, as a build that can't reach Ubuntu's archive would.
 */
function runDeployScript(file, { failUp = false } = {}) {
  const script = deployScript(file);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apt-refresh-deploy-'));
  try {
    const bin = path.join(tmp, 'bin');
    const work = path.join(tmp, 'opt-tapestry');
    const log = path.join(tmp, 'calls.log');
    fs.mkdirSync(bin);
    fs.mkdirSync(work);
    const stub = (name, body) => {
      const p = path.join(bin, name);
      fs.writeFileSync(p, `#!/bin/bash\n${body}\n`);
      fs.chmodSync(p, 0o755);
    };
    stub('docker', [
      `echo "docker $* PACKAGES_REFRESH=\${PACKAGES_REFRESH-<unset>}" >> "${log}"`,
      'if [ "$1 $2" = "compose up" ] && [ "${STUB_FAIL_UP:-}" = 1 ]; then exit 1; fi',
      'exit 0',
    ].join('\n'));
    stub('git', `echo "git $*" >> "${log}"; exit 0`);
    stub('sed', `echo "sed $*" >> "${log}"; exit 0`);
    const env = { PATH: `${bin}:/usr/bin:/bin`, HOME: tmp, STUB_FAIL_UP: failUp ? '1' : '' };
    const which = spawnSync('bash', ['-c', 'command -v docker'], { env, encoding: 'utf8' });
    const resolved = (which.stdout || '').trim();
    assert(resolved === path.join(bin, 'docker'), `refusing to run ${file}'s script: docker resolves to "${resolved}", not the stub.`);
    const res = spawnSync('bash', ['-c', script.split('/opt/tapestry').join(work)], { env, cwd: tmp, encoding: 'utf8', timeout: 30000 });
    return { status: res.status, calls: safeRead(log).split('\n').filter(Boolean), stderr: res.stderr || '' };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
const isComposeUp = (c) => c.startsWith('docker compose up -d --build');
const isPrune = (c) => c.startsWith('docker image prune -f');

for (const file of DEPLOY_WORKFLOWS) {
  test(`W1 (${file}; AC-1, AC-4): its deploy builds with PACKAGES_REFRESH set to the UTC ISO week, then prunes`, () => {
    assert(WEEK_EXPR.test(deployScript(file)),
      NOT_IMPL(`${file}'s script must set PACKAGES_REFRESH="$(date -u +%G-W%V)" before \`docker compose up -d --build\``));
    const r = runDeployScript(file);
    assert(r.status === 0, `${file}'s script failed with every command stubbed to succeed (exit ${r.status}): ${r.stderr.trim()}`);
    const up = r.calls.findIndex(isComposeUp);
    assert(up !== -1, `${file}'s script never ran \`docker compose up -d --build\`; calls: ${r.calls.join(' | ')}`);
    const given = (r.calls[up].match(/PACKAGES_REFRESH=(\S*)$/) || [])[1];
    assert(WEEK.test(given), `\`docker compose up -d --build\` got PACKAGES_REFRESH=${given}, not an ISO week such as 2026-W47.`);
    const prune = r.calls.findIndex(isPrune);
    assert(prune > up, `${file}'s script must still run \`docker image prune -f\` after the build.`);
  });

  test(`W2 (${file}; AC-4): when the build fails, its deploy stops there: the run is red and nothing is pruned`, () => {
    const r = runDeployScript(file, { failUp: true });
    const up = r.calls.findIndex(isComposeUp);
    assert(up !== -1, `${file}'s script never reached \`docker compose up -d --build\`; calls: ${r.calls.join(' | ')}`);
    assert(r.status !== 0,
      `${file}'s script exited 0 after \`docker compose up -d --build\` failed, so its run would show green; it needs \`set -euo pipefail\`.`);
    assert(!r.calls.slice(up + 1).some(isPrune), `${file}'s script ran \`docker image prune -f\` after the build failed.`);
  });
}

// ═══ P: publish-image.yml ═════════════════════════════════════════════════════════════════════════════════════════

test('P1 (AC-1): the brains\' build passes PACKAGES_REFRESH from a step that writes the UTC ISO week', () => {
  const doc = yaml.load(safeRead(PUBLISH));
  assert(doc && doc.jobs && doc.jobs.publish, 'publish-image.yml or its publish job is missing; unexpected.');
  const steps = doc.jobs.publish.steps || [];
  const build = steps.findIndex((s) => typeof s.uses === 'string' && s.uses.startsWith('docker/build-push-action@')
    && s.with && s.with.context === '.');
  assert(build !== -1, 'publish-image.yml has no build-push-action step for the Tapestry image (context .); unexpected.');
  const m = String(steps[build].with['build-args'] || '')
    .match(/^\s*PACKAGES_REFRESH=\$\{\{\s*steps\.([\w-]+)\.outputs\.([\w-]+)\s*\}\}\s*$/m);
  assert(m, NOT_IMPL('the Tapestry build step must pass `build-args: PACKAGES_REFRESH=${{ steps.<id>.outputs.<name> }}`'));
  const [, id, key] = m;
  const source = steps.findIndex((s) => s.id === id);
  assert(source !== -1 && source < build, `the step \`${id}\` that PACKAGES_REFRESH reads must come before the Tapestry build.`);
  const run = String(steps[source].run || '');
  assert(run.includes('date -u +%G-W%V'), `the \`${id}\` step must compute the week with \`date -u +%G-W%V\`.`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apt-refresh-publish-'));
  try {
    const out = path.join(tmp, 'github_output');
    fs.writeFileSync(out, '');
    const res = spawnSync('bash', ['-e', '-c', run], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: out } });
    assert(res.status === 0, `the \`${id}\` step's script failed: ${(res.stderr || '').trim()}`);
    const line = safeRead(out).split('\n').find((l) => l.startsWith(`${key}=`));
    const value = line && line.slice(key.length + 1);
    assert(WEEK.test(value || ''), `the \`${id}\` step wrote ${key}=${value}, not an ISO week such as 2026-W47.`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ═══ O: the docs (AC-5) ═══════════════════════════════════════════════════════════════════════════════════════════

/** A markdown section: from the first heading whose line passes `match` (a RegExp, or a test function) to the next
 * heading of the same or a higher level. */
function section(src, match) {
  const passes = typeof match === 'function' ? match : (l) => match.test(l);
  const lines = src.split('\n');
  const at = lines.findIndex((l) => /^#{1,6}\s/.test(l) && passes(l));
  if (at === -1) return '';
  const level = lines[at].match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i++) {
    const h = lines[i].match(/^(#+)\s/);
    if (h && h[1].length <= level) { end = i; break; }
  }
  return lines.slice(at, end).join('\n');
}

test('O1 (AC-5, AC-2): OPERATIONS.md §3 says which deploy refreshes the packages, and where the marker is', () => {
  const s3 = section(safeRead(OPERATIONS), /^## 3\. /);
  assert(s3, 'OPERATIONS.md §3 is missing; unexpected.');
  const missing = [ARG_NAME, MARKER].filter((t) => !s3.includes(t));
  assert(missing.length === 0, NOT_IMPL(`OPERATIONS.md §3 must describe the weekly refresh, naming ${missing.join(' and ')}`));
  assert(/ISO week/i.test(s3) && /Monday/.test(s3), 'OPERATIONS.md §3 must say the first deploy of each ISO week refreshes, weeks starting Monday 00:00 UTC.');
});

test('O2 (AC-5): OPERATIONS.md gives a refresh by hand, both for a target with the step and in place for one without it', () => {
  const by = section(safeRead(OPERATIONS), (l) => /refresh/i.test(l) && /by hand/i.test(l));
  assert(by, NOT_IMPL('OPERATIONS.md must have a section on refreshing a container\'s packages by hand (a heading naming both)'));
  const need = [`${ARG_NAME}=`, 'docker compose up -d --build', 'docker exec tapestry', 'docker restart tapestry'];
  const missing = need.filter((t) => !by.includes(t));
  assert(missing.length === 0, `the by-hand refresh section is missing: ${missing.join(', ')}.`);
});

test('O3 (AC-4, AC-5): docs/SAFE_TO_MERGE.md says how to tell a refreshing deploy and how long it takes', () => {
  const s = section(safeRead(SAFE_TO_MERGE), /refresh/i);
  assert(s, NOT_IMPL('docs/SAFE_TO_MERGE.md must have a section on the refreshing deploy (a heading naming it)'));
  assert(/Monday|ISO week/i.test(s), 'the section must say which deploy refreshes: the first of each ISO week, from Monday 00:00 UTC.');
  assert(/minute/i.test(s), 'the section must say how much longer a refreshing deploy takes.');
});

test('O4 (AC-5): the /cycle-staging and /cycle-prod skills give a refreshing deploy\'s expected time', () => {
  const missing = CYCLE_SKILLS.filter((f) => !safeRead(f).split('\n').some((l) => /refresh/i.test(l) && /Monday|ISO week/i.test(l)));
  assert(missing.length === 0,
    NOT_IMPL(`${missing.map((f) => path.relative(ROOT, f)).join(' and ')} must say the first deploy of each ISO week refreshes the packages, and how long it takes`));
});

test('O5 (AC-4, AC-5): OPERATIONS.md §3 and docs/SAFE_TO_MERGE.md say a deploy that changes a step above the refresh refreshes too, and how to see one before a merge (ADR Amendment 1, item 2)', () => {
  const ops = safeRead(OPERATIONS);
  const at = ops.indexOf('**The weekly package refresh**');
  assert(at !== -1, 'OPERATIONS.md §3 has no "The weekly package refresh" paragraph; see O1.');
  const end = ops.indexOf('These are the **deploy** workflows', at);
  const paragraph = ops.slice(at, end === -1 ? undefined : end);
  const stm = section(safeRead(SAFE_TO_MERGE), /refresh/i);
  const missing = [];
  for (const [name, text] of [['OPERATIONS.md §3', paragraph], ['docs/SAFE_TO_MERGE.md', stm]]) {
    for (const t of ['package.json', 'patches/strfry-', 'gh pr diff']) if (!text.includes(t)) missing.push(`${name} lacks ${t}`);
  }
  assert(missing.length === 0,
    `a deploy that changes a step above the refresh reruns it whatever the week, so the docs must name that case and how to see it before a merge: ${missing.join('; ')}.`);
});

test('O6 (AC-5): OPERATIONS.md says a refresh by hand on a target with the step lasts only until the next deploy, which reuses the week\'s own refresh (ADR Amendment 1, item 1)', () => {
  const by = section(safeRead(OPERATIONS), (l) => /refresh/i.test(l) && /by hand/i.test(l));
  assert(by, 'OPERATIONS.md has no by-hand refresh section; see O2.');
  const start = by.search(/^1\.\s/m);
  const next = by.search(/^2\.\s/m);
  assert(start !== -1 && next > start, 'the by-hand section must number its recipes 1., 2. and 3.; unexpected.');
  const recipe1 = by.slice(start, next);
  assert(/until the next deploy/i.test(recipe1),
    'recipe 1 must say its refresh lasts only until the next deploy: BuildKit keeps the week\'s earlier refresh for that deploy to reuse.');
  assert(/\breuses?\b/i.test(recipe1), 'recipe 1 must say the next deploy reuses this week\'s earlier refresh when a deploy has already refreshed.');
  assert(!/it lasts, since the new image carries the refresh/i.test(recipe1),
    'recipe 1 must not say its refresh lasts because the new image carries it: the next deploy builds from the week\'s own refresh.');
});

// ═══ L: live, in throwaway containers (TAPESTRY_LIVE_DOCKER_CHECKS=1) ═══════════════════════════════════════════════

function liveOff() {
  if (process.env[SWITCH] === '1') return false;
  console.log(`        (off: set ${SWITCH}=1 to run it; it needs Docker and Ubuntu's archive)`);
  return true;
}

/**
 * Runs the Dockerfile's refresh step, verbatim, in a throwaway container from STALE_BASE. Stand-in packages named
 * neo4j and nodejs are installed first (Ubuntu's archive has no neo4j, and its nodejs is 12.x), with an unreachable
 * third-party source in sources.list.d. Then it reads the marker, the two versions and what is still waiting.
 * With `refresh: null` it passes what a plain `docker build .` with no build-arg would: the ARG's own default if it
 * has one, and otherwise nothing, leaving the variable unset.
 */
function runStepInContainer({ nodejsVersion = '22.21.0-1nodesource1', network, refresh = '2026-W47' } = {}) {
  const { instrs, arg, body } = refreshStep();
  const given = [];
  if (refresh !== null) {
    given.push('-e', `${ARG_NAME}=${refresh}`);
  } else {
    const m = instrs[arg].match(new RegExp(`^ARG\\s+${ARG_NAME}=(.*)$`));
    if (m) given.push('-e', `${ARG_NAME}=${m[1].trim().replace(/^"(.*)"$/, '$1')}`);
  }
  const script = [
    'set -e',
    'export DEBIAN_FRONTEND=noninteractive',
    'standin() { d=/tmp/standin/$1; mkdir -p $d/DEBIAN; printf "Package: %s\\nVersion: %s\\nArchitecture: all\\nMaintainer: test <test@example.invalid>\\nDescription: stand-in for %s\\n" "$1" "$2" "$1" > $d/DEBIAN/control; dpkg-deb --build $d /tmp/$1.deb >/dev/null; dpkg -i /tmp/$1.deb >/dev/null; }',
    'standin neo4j 1:5.26.10',
    `standin nodejs ${nodejsVersion}`,
    'echo "deb [trusted=yes] http://unreachable.invalid/nodesource nodistro main" > /etc/apt/sources.list.d/nodesource.list',
    'set +e',
    'sh -c "$STEP"; echo "STEP_EXIT=$?"',
    'echo MARKER_BEGIN; cat /etc/tapestry/packages-refresh 2>/dev/null; echo MARKER_END',
    "echo \"PINNED=$(dpkg-query -W -f='${Package}=${Version} ' neo4j nodejs)\"",
    'if apt-get -o Dir::Etc::SourceParts=- update -qq >/dev/null 2>&1; then echo "WAITING=$(apt-get -o Dir::Etc::SourceParts=- -o APT::Get::Always-Include-Phased-Updates=true -s full-upgrade | grep -c ^Inst)"; else echo "WAITING=unknown"; fi',
  ].join('\n');
  const args = ['run', '--rm', '--name', `apt-refresh-live-${process.pid}-${Date.now()}`, '-e', `STEP=${body}`, ...given];
  if (network) args.push('--network', network);
  args.push(STALE_BASE, 'bash', '-c', script);
  const res = spawnSync('docker', args, { encoding: 'utf8', timeout: 10 * 60 * 1000 });
  const out = res.stdout || '';
  const get = (k) => { const m = out.match(new RegExp(`^${k}=(.*)$`, 'm')); return m ? m[1] : null; };
  const marker = ((out.split('MARKER_BEGIN\n')[1] || '').split('MARKER_END')[0] || '').trim();
  assert(res.status === 0 && get('STEP_EXIT') !== null,
    `the container didn't run to the end (docker exit ${res.status}): ${(res.stderr || '').trim().slice(-400)}`);
  return { stepExit: Number(get('STEP_EXIT')), marker, pinned: get('PINNED'), waiting: get('WAITING'), out };
}

test('L1 (AC-1, AC-2, AC-3, live): on a stale base the refresh step brings every Ubuntu package up to date, writes its marker and leaves Neo4j and Node alone', () => {
  if (liveOff()) return 'SKIP';
  const r = runStepInContainer();
  assert(r.stepExit === 0, `the refresh step failed (exit ${r.stepExit}):\n${r.out.slice(-800)}`);
  assert(/^week=2026-W47$/m.test(r.marker), `the marker must say week=2026-W47; it says:\n${r.marker}`);
  assert(/^refreshed_at=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m.test(r.marker), `the marker must say when, in UTC; it says:\n${r.marker}`);
  const n = Number((r.marker.match(/^upgraded=(\d+)$/m) || [])[1]);
  assert(n > 0, `on ${STALE_BASE} the step must upgrade something, and say how many; the marker says:\n${r.marker}`);
  assert(r.pinned === 'neo4j=1:5.26.10 nodejs=22.21.0-1nodesource1 ', `Neo4j and Node must not move; after the step: ${r.pinned}`);
  assert(r.waiting === '0', `after the step, Ubuntu's archive must have nothing left for this container; ${r.waiting} waiting.`);
});

test('L2 (AC-4, live): with no network the refresh step fails, and writes no marker', () => {
  if (liveOff()) return 'SKIP';
  const r = runStepInContainer({ network: 'none' });
  assert(r.stepExit !== 0, `the refresh step must fail when Ubuntu's archive can't be reached; it exited 0:\n${r.out.slice(-800)}`);
  assert(r.marker === '', `a failed refresh must not write a marker; it wrote:\n${r.marker}`);
});

test('L3 (AC-3, live): when an upgrade would move nodejs, the refresh step fails the build', () => {
  if (liveOff()) return 'SKIP';
  // A stand-in nodejs older than Ubuntu's own 12.x gives the upgrade something to move, as a pinned package moving would.
  const r = runStepInContainer({ nodejsVersion: '0.1' });
  assert(!/nodejs=0\.1 /.test(r.pinned || ''), `the upgrade didn't move the stand-in nodejs, so the guard went untested; after the step: ${r.pinned}`);
  assert(r.stepExit !== 0, `the refresh step must fail when nodejs moves; it exited 0 with ${r.pinned}`);
  assert(r.marker === '', `a refresh that fails its guard must not write a marker; it wrote:\n${r.marker}`);
});

test('L4 (AC-4, live): a build given no PACKAGES_REFRESH, as a plain `docker build .` is, still runs the refresh step and writes its marker', () => {
  if (liveOff()) return 'SKIP';
  const r = runStepInContainer({ refresh: null });
  assert(r.stepExit === 0, `with no PACKAGES_REFRESH given, the refresh step failed (exit ${r.stepExit}):\n${r.out.slice(-800)}`);
  assert(/^week=\S*$/m.test(r.marker) && /^upgraded=\d+$/m.test(r.marker), `the marker must still say week= and upgraded=; it says:\n${r.marker}`);
});

// ═══ Runner ════════════════════════════════════════════════════════════════════════════════════════════════════════

async function run() {
  console.log('\n--- container-apt-refresh #1: weekly Ubuntu package refresh (ADR container-apt-refresh/0001) ---');
  let pass = 0;
  let fail = 0;
  let skipped = 0;
  const failures = [];
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${t.name}`); skipped++; }
      else { console.log(`  PASS  ${t.name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${t.name}\n        ${err.message}`);
      failures.push({ name: t.name, message: err.message });
      fail++;
    }
  }
  console.log(`\ncontainer-apt-refresh: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

if (require.main === module) {
  run().then(({ fail }) => { process.exitCode = fail === 0 ? 0 : 1; }).catch((e) => { console.error(e); process.exitCode = 1; });
}

module.exports = { run };
