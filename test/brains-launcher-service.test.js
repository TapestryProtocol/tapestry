'use strict';
/**
 * brains-launcher #1: the launcher's own unit tests, under deploy/launcher/test, run as part of the repo's gate.
 * They use node:test, since the launcher ships on its own and carries no part of this test harness.
 * Stack-free: no Docker, no network beyond loopback.
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const DIR = path.join(__dirname, '../deploy/launcher/test');

async function run() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.test.js')).map((f) => path.join(DIR, f));
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { encoding: 'utf8', timeout: 120000 });
  const count = (name) => Number((r.stdout.match(new RegExp(`^# ${name} (\\d+)$`, 'm')) || [])[1] || 0);
  const pass = count('pass');
  const fail = count('fail') + (r.status === 0 ? 0 : count('fail') === 0 ? 1 : 0);
  if (fail > 0) console.log(r.stdout.split('\n').filter((l) => /^\s*not ok|^\s+error:/.test(l)).join('\n') || r.stderr);
  if (pass === 0 && fail === 0) throw new Error(`node --test ran nothing: ${r.stderr}`);
  console.log(`  launcher unit tests: ${pass} passed, ${fail} failed`);
  return { pass, fail, skipped: 0 };
}

module.exports = { run };
