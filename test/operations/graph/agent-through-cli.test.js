'use strict';
/**
 * An admin agent through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-foundation/4-the-write-path.md (AC7's last sentence)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0004-the-write-path.md (Consequences: "The external
 *          CLI and /docs pick the operations up from the list, with no change to either")
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph seeded
 * for test/helpers/graphFake.js (spec.graphFakeState). The agent is the external CLI, clients/cli/bin/tapestry.js,
 * holding an admin's own key: it signs in with the instance's challenge and calls what the instance lists, as story 6
 * built it.
 *
 *   X1 the agent adds a relationship, removes it, and reads both entries back, newest first, each recorded as its own
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));

function makeKey() {
  const sk = NT.generateSecretKey();
  const pubkey = NT.getPublicKey(sk);
  return { nsec: NT.nip19.nsecEncode(sk), pubkey };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('agent-cli-');
  const recordFile = path.join(dir, 'requests.jsonl');
  fs.writeFileSync(recordFile, '');
  const specFile = path.join(dir, 'spec.json');
  fs.writeFileSync(specFile, JSON.stringify({ root: ROOT, catalogDir: path.join(ROOT, 'src/operations/catalog'), recordFile, graphFakeState: stateFile }));
  const env = S.childEnv(dir);
  // The owner and the admin are this suite's own keys, so the CLI's sign-in admits the admin.
  fs.writeFileSync(env.BRAINSTORM_CONF_PATH, [`export BRAINSTORM_OWNER_PUBKEY="${owner.pubkey}"`, 'export NEO4J_URI="bolt://127.0.0.1:9"', 'export REDIS_HOST="127.0.0.1"', 'export REDIS_PORT="9"'].join(NL) + NL);
  fs.writeFileSync(env.TAPESTRY_SETTINGS_PATH, JSON.stringify({ adminPubkeys: [admin.pubkey] }));
  const proc = spawn(process.execPath, [SERVER, specFile], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(proc);
  return new Promise((resolve, reject) => {
    let out = '', err = '', ready = false;
    const timer = setTimeout(() => reject(new Error(`the test instance didn't start within 30 s: ${err.slice(-400)}`)), 30000);
    proc.stdout.on('data', (d) => {
      if (ready) return;
      out += d;
      const at = out.indexOf(READY);
      const end = at >= 0 ? out.indexOf(NL, at) : -1;
      if (end < 0) return;
      ready = true;
      clearTimeout(timer);
      const ports = JSON.parse(out.slice(at + READY.length, end));
      resolve({ url: `http://127.0.0.1:${ports.port}` });
    });
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('exit', (code) => { if (!ready) { clearTimeout(timer); reject(new Error(`the test instance exited ${code} before it was ready: ${err.slice(-600)}`)); } });
  });
}

function cli(args, env) {
  return new Promise((resolve) => {
    const home = tmp('agent-cli-home-');
    const child = spawn(process.execPath, [BIN, ...args], { cwd: home, env: { PATH: process.env.PATH, HOME: home, TAPESTRY_HOME: path.join(home, 'tapestry-home'), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 30000);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}
const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
const said = (r) => `exit ${r.code}; stdout ${show(String(r.stdout).slice(-300))}; stderr ${show(String(r.stderr).slice(-300))}`;

test('X1: the agent adds a relationship, removes it, and reads both entries back, newest first, each recorded as its own', async () => {
  const owner = makeKey();
  const admin = makeKey();
  const seed = S.seedGraph();
  const file = seed.file(tmp('agent-cli-graph-'));
  const { A, B } = seed.keys;
  let inst;
  try {
    inst = await startInstance(owner, admin, file);
  } catch (e) {
    if (!fs.existsSync(path.join(ROOT, 'src/operations/graph.js'))) throw new Error('src/operations/graph.js does not exist yet (ADR graph-operations-foundation/0004 Decision 9)');
    throw e;
  }
  const keyFile = path.join(tmp('agent-cli-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };

  const add = await cli(['graph', 'add-relationship', '--from', A, '--to', B, '--type', 'CITES'], env);
  assert(add.code === 0, `the agent's add must succeed; ${said(add)}`);
  const a = json(add.stdout);
  assert(a && a.success && a.data.outcome === 'added' && a.data.change && a.data.change.by.pubkey === admin.pubkey && a.data.change.by.role === 'admin', `added, recorded as the agent's own; got ${show(a)}`);

  const remove = await cli(['graph', 'remove-relationship', '--from', A, '--to', B, '--type', 'CITES'], env);
  assert(remove.code === 0, `the agent's remove must succeed; ${said(remove)}`);
  const r = json(remove.stdout);
  assert(r && r.success && r.data.outcome === 'removed', `removed; got ${show(r)}`);

  const hist = await cli(['graph', 'history', '--node', A], env);
  assert(hist.code === 0, `the agent's history must succeed; ${said(hist)}`);
  const h = json(hist.stdout);
  const ops = h && h.success ? h.data.entries.map((e) => e.operation) : null;
  assert(show(ops) === show(['graph remove-relationship', 'graph add-relationship']), `history for A: the removal, then the add, newest first; got ${show(h)}`);
  assert(h.data.entries.every((e) => e.by.role === 'admin' && e.by.pubkey === admin.pubkey), 'each is recorded as the agent\'s');
  assert(S.relsOf(S.readState(file), 'CITES').length === 0, 'the graph holds no CITES afterwards');
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
