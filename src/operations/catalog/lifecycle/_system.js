'use strict';
/**
 * Every outside effect the lifecycle jobs have — ADR graph-operations-foundation/0002 Decision 8. `module.exports` is
 * the system object itself; the operations and jobs call its methods through it when they run, so a suite can replace
 * them (test/helpers/operationsHarness.js does, with test/helpers/lifecycleFakes.js's fake).
 *
 *   supervisor(action, programs)       supervisorctl <action> <programs…>; `restart brainstorm` runs detached, since
 *                                      it restarts the process that asks for it
 *   programStatus(names)               { name: 'RUNNING' | 'STOPPED' | … } from `supervisorctl status`
 *   neo4jAdmin(args, { stdin, stdout }) runuser -u neo4j -- neo4j-admin <args…> → { code, stdout, stderr }; stdout is
 *                                      captured as text unless a stream is given to write it to
 *   cypher(query, params, { write })   a query through the shared driver (src/lib/neo4j-driver.js): a read, or with
 *                                      write: true a write (lifecycle migrate's passes and schema, ADR 0003 Decision 4)
 *   version()                          the graph database's version, from `neo4j-admin --version`
 *   freeBytes(path)                    free bytes on the filesystem holding `path` (or its nearest existing parent)
 *   sleep(ms)
 *
 * Commands are run by name from PATH, with arguments as a list (never a shell). Nothing here is required at load.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const STDERR_LIMIT = 64 * 1024;

/** Run a command; resolve { code, stdout, stderr }. A given `stdout` stream receives the command's output instead. */
function runCommand(cmd, args, { stdin = null, stdout = null } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmd, args, { stdio: [stdin ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    } catch (err) {
      reject(err);
      return;
    }
    let out = '';
    let errText = '';
    if (stdout) child.stdout.pipe(stdout, { end: false });
    else child.stdout.on('data', (c) => { out += c; });
    child.stderr.on('data', (c) => { errText = (errText + c).slice(-STDERR_LIMIT); });
    if (stdin) {
      child.stdin.on('error', () => { /* the command stopped reading; its exit code says why */ });
      stdin.on('error', (err) => child.stdin.destroy(err));
      stdin.pipe(child.stdin);
    }
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code: code === null ? `signal ${signal}` : code, stdout: out, stderr: errText }));
  });
}

const tidy = (s) => String(s || '').trim().replace(/\s+/g, ' ').slice(0, 400);

const system = {
  async supervisor(action, programs) {
    const list = [].concat(programs || []);
    if (action === 'restart' && list.includes('brainstorm')) {
      // supervisord is about to stop the process running this code, so the client must outlive it.
      const child = spawn('supervisorctl', ['restart', ...list], { detached: true, stdio: 'ignore' });
      child.on('error', (err) => console.error(`[lifecycle] supervisorctl restart ${list.join(' ')} could not start: ${err.message}`));
      child.unref();
      return { code: 0, stdout: '', stderr: '' };
    }
    const r = await runCommand('supervisorctl', [action, ...list]);
    const said = `${r.stdout}\n${r.stderr}`;
    // Asking for what is already so is not a failure: "ERROR (not running)", "ERROR (already started)".
    const harmless = /not running|already started/i.test(said) && !/no such process|spawn error|abnormal termination/i.test(said);
    if (r.code !== 0 && !harmless) throw new Error(`supervisorctl ${action} ${list.join(' ')} exited ${r.code}: ${tidy(said)}`);
    return r;
  },

  async programStatus(names) {
    const list = [].concat(names || []);
    // Exit 3 means only that some program isn't running.
    const r = await runCommand('supervisorctl', ['status', ...list]);
    const out = {};
    for (const line of String(r.stdout).split('\n')) {
      const m = line.trim().match(/^(\S+)\s+([A-Z]+)\b/);
      if (m) out[m[1]] = m[2];
    }
    for (const n of list) if (!out[n]) out[n] = 'UNKNOWN';
    return out;
  },

  neo4jAdmin(args, opts = {}) {
    return runCommand('runuser', ['-u', 'neo4j', '--', 'neo4j-admin', ...[].concat(args || [])], opts);
  },

  async cypher(query, params, { write = false } = {}) {
    const { runCypher, writeCypher } = require('../../../lib/neo4j-driver');
    return write ? writeCypher(query, params || {}) : runCypher(query, params || {});
  },

  async version() {
    const r = await runCommand('neo4j-admin', ['--version']);
    const v = String(r.stdout).trim().split(/\s+/).pop();
    if (r.code !== 0 || !/^\d+\.\d+/.test(v || '')) throw new Error(`neo4j-admin --version didn't say its version: ${tidy(r.stdout + r.stderr)}`);
    return v;
  },

  async freeBytes(p) {
    let at = path.resolve(String(p));
    while (!fs.existsSync(at) && path.dirname(at) !== at) at = path.dirname(at);
    const s = await fs.promises.statfs(at);
    return Number(s.bavail) * Number(s.bsize);
  },

  sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); },
};

module.exports = system;
