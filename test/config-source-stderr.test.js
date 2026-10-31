'use strict';
/**
 * Story security-auth-exposure #10: sourcing the config file never puts its contents in a log
 * (follow-up from story 9's review, ngit issue c549202b).
 * Test plan: engineering-team/stories/security-auth-exposure/10-config-source-stderr-no-values.test-plan.md
 *
 * Stack-free, two kinds of check:
 *   - Behavioural, for src/utils/config.js (AC-1, AC-3): a child node process points BRAINSTORM_CONF_PATH at a
 *     temp config with a line bash can't parse, holding a random value, and looks up a key only the `source`
 *     fallback could find. The whole child's stdout and stderr are captured, because bash's stderr reaches the
 *     log through the inherited file descriptor, not through process.stderr.write, so an in-process capture
 *     would miss it.
 *   - Source-level, for the four readers that read the hard-coded /etc/brainstorm.conf or run on import
 *     (AC-2, AC-3, AC-4): each `execSync` call that sources the config file must keep bash's stderr out
 *     (`stdio: ['ignore', 'pipe', 'ignore']`), and the catch that follows it may use its error only as
 *     `.status`. src/utils/config.js is held to the same rule.
 *
 * Before the fix every test fails on its leak assertion. Story 9's suite covers AC-5 (unchanged returns).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// The text of the call that opens at `open` (the index of its "("), through its matching ")".
function balanced(src, open, openCh = '(', closeCh = ')') {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === openCh) depth++;
    else if (src[i] === closeCh && --depth === 0) return { text: src.slice(open, i + 1), end: i + 1 };
  }
  throw new Error(`unbalanced ${openCh}${closeCh} from offset ${open}`);
}

// Every execSync(...) call whose text sources the config file, each with the catch block that follows it.
function sourceCalls(src) {
  const calls = [];
  let at = 0;
  for (;;) {
    const i = src.indexOf('execSync(', at);
    if (i === -1) break;
    const call = balanced(src, i + 'execSync'.length);
    at = call.end;
    if (!/\bsource\b/.test(call.text)) continue;
    const c = /catch\s*\(\s*(\w+)\s*\)\s*\{/g;
    c.lastIndex = call.end;
    const m = c.exec(src);
    assert(m, `no catch follows the source call at offset ${i}`);
    const body = balanced(src, m.index + m[0].length - 1, '{', '}').text;
    calls.push({ call: call.text, errName: m[1], catchBody: body });
  }
  return calls;
}

const STDERR_IGNORED = /stdio\s*:\s*\[\s*['"]ignore['"]\s*,\s*['"]pipe['"]\s*,\s*['"]ignore['"]\s*\]/;

const READERS = [
  'src/utils/config.js',
  'lib/config.js',
  'src/pipeline/stream/addToQueue.mjs',
  'src/algos/nip85/publish_nip85_30382.js',
  'src/algos/personalizedGrapeRank/initializeScorecards.js',
];

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'config-source-stderr-'));
const SECRET = `pw)${crypto.randomBytes(12).toString('hex')}`;
const DEFAULT = `default-${crypto.randomBytes(6).toString('hex')}`;
const UNSET_KEY = 'CSS_TEST_UNSET_KEY';

// Run getConfigFromFile(UNSET_KEY, DEFAULT) in a child against a malformed config; returns { result, output }.
function lookupInChild() {
  const conf = path.join(TMP, 'brainstorm.conf');
  fs.writeFileSync(conf, `export NEO4J_USER="neo4j"\nexport NEO4J_PASSWORD=${SECRET}\n`);
  const script = `
    const { getConfigFromFile } = require(${JSON.stringify(path.join(REPO, 'src/utils/config.js'))});
    const r = getConfigFromFile(${JSON.stringify(UNSET_KEY)}, ${JSON.stringify(DEFAULT)});
    process.stdout.write('\\nRESULT=' + r + '\\n');`;
  const env = { ...process.env, BRAINSTORM_CONF_PATH: conf };
  delete env[UNSET_KEY];
  const r = spawnSync(process.execPath, ['-e', script], { cwd: TMP, env, encoding: 'utf8', timeout: 30000 });
  const output = `${r.stdout || ''}${r.stderr || ''}`;
  const m = /RESULT=(.*)/.exec(r.stdout || '');
  return { result: m ? m[1] : undefined, output, status: r.status };
}

test('AC-1 getConfigFromFile: a malformed conf line never reaches the process output, and the default is still returned', () => {
  const { result, output, status } = lookupInChild();
  assert(status === 0, `the child exited ${status}: ${JSON.stringify(output.slice(-400))}`);
  assert(result === DEFAULT, `returned ${JSON.stringify(result)}, expected the default`);
  const tail = SECRET.slice(3);
  assert(!output.includes(tail), `the output holds the malformed line's value (${JSON.stringify(output.trim())})`);
});

test('AC-3 getConfigFromFile: a failed source lookup still logs the key and the exit status', () => {
  const { output } = lookupInChild();
  const line = output.split('\n').find((l) => l.includes(UNSET_KEY) && /fail/i.test(l));
  assert(line, `no line says the source lookup for ${UNSET_KEY} failed (${JSON.stringify(output.trim())})`);
  assert(/status\s*\d+/i.test(line), `the failure line gives no exit status: ${JSON.stringify(line)}`);
});

test('AC-2/AC-3 every reader: each source call keeps bash stderr out, and its catch logs only the status', () => {
  const offenders = [];
  for (const rel of READERS) {
    const src = fs.readFileSync(path.join(REPO, rel), 'utf8');
    const calls = sourceCalls(src);
    if (calls.length !== 1) { offenders.push(`${rel}: expected 1 execSync call that sources the config, found ${calls.length}`); continue; }
    const { call, errName, catchBody } = calls[0];
    if (!STDERR_IGNORED.test(call)) offenders.push(`${rel}: the source call doesn't pass stdio: ['ignore', 'pipe', 'ignore']`);
    // The error variable itself, not a property named like it (`console.error` when the variable is `error`).
    const uses = catchBody.match(new RegExp(`(?<![.\\w])${errName}\\b(\\.\\w+)?`, 'g')) || [];
    const bad = uses.filter((u) => u !== `${errName}.status`);
    if (bad.length) offenders.push(`${rel}: the catch uses ${[...new Set(bad)].join(', ')} (only ${errName}.status may be logged)`);
    if (!uses.includes(`${errName}.status`)) offenders.push(`${rel}: the catch doesn't log ${errName}.status, so a failed lookup goes unreported`);
  }
  assert(offenders.length === 0, `\n      - ${offenders.join('\n      - ')}`);
});

test('AC-4 addToQueue.mjs: its reader logs key names and where each came from, never values', () => {
  const src = fs.readFileSync(path.join(REPO, 'src/pipeline/stream/addToQueue.mjs'), 'utf8');
  const start = src.indexOf('function getConfigValue(');
  assert(start !== -1, 'getConfigValue not found');
  const body = balanced(src, src.indexOf('{', start), '{', '}').text;
  const logs = body.match(/console\.(log|info|warn|error)\([^;]*\);/g) || [];
  const leaks = logs.filter((l) => /\$\{\s*(result|defaultValue|process\.env\[varName\])\s*\}/.test(l)
    || /,\s*(result|defaultValue|process\.env\[varName\])\s*\)/.test(l));
  assert(leaks.length === 0, `log lines print a value:\n      - ${leaks.join('\n      - ')}`);
  for (const where of [/config file/i, /environment/i, /default/i]) {
    assert(logs.some((l) => l.includes('${varName}') && where.test(l)), `no log line names the key with ${where}`);
  }
});

async function run() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  try {
    for (const t of tests) {
      try {
        await t.fn();
        pass++;
        console.log(`  ✓ ${t.name}`);
      } catch (e) {
        fail++;
        failures.push({ name: t.name, error: e.message });
        console.log(`  ✗ ${t.name}\n      ${e.message}`);
      }
    }
  } finally {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  console.log(`\nconfig-source-stderr: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => { process.exitCode = fail === 0 ? 0 : 1; }).catch((e) => { console.error(e); process.exitCode = 1; });
}

module.exports = { run };
