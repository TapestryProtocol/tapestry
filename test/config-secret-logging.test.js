'use strict';
/**
 * Story security-auth-exposure #9: the config reader logs key names, never values (ngit issue c549202b).
 * Test plan: engineering-team/stories/security-auth-exposure/9-config-reader-logs-no-values.test-plan.md
 *
 * Stack-free: getConfigFromFile() reads the file BRAINSTORM_CONF_PATH names, so each test points it at a
 * temp file (or at a path that doesn't exist) and captures everything written to stdout and stderr during
 * the one call. Capturing the streams, not the console methods, catches console.log/info/warn/error/debug
 * and any direct write alike. Values are random per run, so a match can only come from a leak.
 *
 * Before the fix every test fails on its "value not logged" assertion: the function prints the value on all
 * four ways it resolves a key. The AC-4 assertions (name and resolution logged) pass before and after.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const { getConfigFromFile } = require('../src/utils/config');

const rand = (prefix) => `${prefix}-${crypto.randomBytes(12).toString('hex')}`;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function assert(cond, msg) { if (!cond) throw new Error(msg); }

// Run fn() with stdout and stderr captured; returns { result, output }.
function captured(fn) {
  const chunks = [];
  const saved = { out: process.stdout.write, err: process.stderr.write };
  const grab = (chunk) => { chunks.push(String(chunk)); return true; };
  process.stdout.write = grab;
  process.stderr.write = grab;
  let result;
  try {
    result = fn();
  } finally {
    process.stdout.write = saved.out;
    process.stderr.write = saved.err;
  }
  return { result, output: chunks.join('') };
}

function assertNoValue(output, value, label) {
  assert(!output.includes(value), `${label}: the log holds the value (${JSON.stringify(output.trim())})`);
}

function assertNamesKey(output, key, how, label) {
  assert(output.includes(key), `${label}: the log doesn't name ${key} (${JSON.stringify(output.trim())})`);
  assert(how.test(output), `${label}: the log doesn't say how ${key} was resolved (expected ${how})`);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'config-secret-logging-'));
const CONF = path.join(TMP, 'brainstorm.conf');

const QUOTED_KEY = 'CSL_TEST_QUOTED_SECRET';
const UNQUOTED_KEY = 'CSL_TEST_UNQUOTED_SECRET';
const ENV_ONLY_KEY = 'CSL_TEST_ENV_ONLY_SECRET';
const MISSING_KEY = 'CSL_TEST_MISSING_SECRET';

const QUOTED_VALUE = rand('quoted');
const UNQUOTED_VALUE = rand('unquoted');
const ENV_ONLY_VALUE = rand('envonly');
const DEFAULT_VALUE = rand('default');

test('AC-1 a quoted value is returned and never logged; the log names the key and says quoted', () => {
  const { result, output } = captured(() => getConfigFromFile(QUOTED_KEY));
  assert(result === QUOTED_VALUE, `returned ${JSON.stringify(result)}, expected the quoted value`);
  assertNoValue(output, QUOTED_VALUE, 'quoted');
  assertNamesKey(output, QUOTED_KEY, /\bquoted\b/, 'quoted');
});

test('AC-1 an unquoted value is returned and never logged; the log names the key and says unquoted', () => {
  const { result, output } = captured(() => getConfigFromFile(UNQUOTED_KEY));
  assert(result === UNQUOTED_VALUE, `returned ${JSON.stringify(result)}, expected the unquoted value`);
  assertNoValue(output, UNQUOTED_VALUE, 'unquoted');
  assertNamesKey(output, UNQUOTED_KEY, /\bunquoted\b/, 'unquoted');
});

test('AC-2 a value only the source fallback finds (environment only) is returned and never logged', () => {
  const { result, output } = captured(() => getConfigFromFile(ENV_ONLY_KEY));
  assert(result === ENV_ONLY_VALUE, `returned ${JSON.stringify(result)}, expected the environment value`);
  assertNoValue(output, ENV_ONLY_VALUE, 'source fallback');
  assertNamesKey(output, ENV_ONLY_KEY, /\bsource\b/i, 'source fallback');
});

test('AC-3 a default is returned and never logged when nothing resolves the key', () => {
  const { result, output } = captured(() => getConfigFromFile(MISSING_KEY, DEFAULT_VALUE));
  assert(result === DEFAULT_VALUE, `returned ${JSON.stringify(result)}, expected the default`);
  assertNoValue(output, DEFAULT_VALUE, 'default');
  assertNamesKey(output, MISSING_KEY, /\bdefault\b/i, 'default');
});

test('AC-3/AC-4 with no config file the default is returned and never logged; the log says the file is missing', () => {
  const saved = process.env.BRAINSTORM_CONF_PATH;
  process.env.BRAINSTORM_CONF_PATH = path.join(TMP, 'does-not-exist.conf');
  try {
    const { result, output } = captured(() => getConfigFromFile(QUOTED_KEY, DEFAULT_VALUE));
    assert(result === DEFAULT_VALUE, `returned ${JSON.stringify(result)}, expected the default`);
    assertNoValue(output, DEFAULT_VALUE, 'no config file');
    assertNoValue(output, QUOTED_VALUE, 'no config file');
    assertNamesKey(output, QUOTED_KEY, /not found/i, 'no config file');
  } finally {
    process.env.BRAINSTORM_CONF_PATH = saved;
  }
});

async function run() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  const savedEnv = {
    BRAINSTORM_CONF_PATH: process.env.BRAINSTORM_CONF_PATH,
    [ENV_ONLY_KEY]: process.env[ENV_ONLY_KEY],
    [MISSING_KEY]: process.env[MISSING_KEY],
  };
  try {
    fs.writeFileSync(CONF, `${QUOTED_KEY}="${QUOTED_VALUE}"\n${UNQUOTED_KEY}=${UNQUOTED_VALUE}\n`);
    process.env.BRAINSTORM_CONF_PATH = CONF;
    process.env[ENV_ONLY_KEY] = ENV_ONLY_VALUE;
    delete process.env[MISSING_KEY];
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
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* best effort */ }
  }
  console.log(`\nconfig-secret-logging: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => { process.exitCode = fail === 0 ? 0 : 1; }).catch((e) => { console.error(e); process.exitCode = 1; });
}

module.exports = { run };
