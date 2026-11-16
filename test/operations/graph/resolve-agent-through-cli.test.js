'use strict';
/**
 * An admin agent resolves names through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/9-resolve.md (AC6's last sentence)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0009-resolve-and-naming-a-node.md
 *          (Context 11: the external CLI sends a read's flags as its query, so it needs no change)
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph
 * test/helpers/resolveGraph.js seeds for test/helpers/graphFake.js. The agent is the external CLI,
 * clients/cli/bin/tapestry.js, holding an admin's own key, as story graph-operations-foundation #6 built it.
 *
 *   RX1 the agent resolves a concept by its name, gets one candidate, and lists its elements with the key it got back
 *   RX2 the agent is told when a name is ambiguous, narrows a set by kind, and is refused a kind there isn't
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const { seedResolve } = require('../../helpers/resolveGraph');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent resolves names through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const DECL = path.join(ROOT, 'src/operations/catalog/graph/resolve.js');
const READY = 'externalCliServer-ready ';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));

function makeKey() {
  const sk = NT.generateSecretKey();
  const pubkey = NT.getPublicKey(sk);
  return { nsec: NT.nip19.nsecEncode(sk), pubkey };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('resolve-agent-');
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
    const home = tmp('resolve-agent-home-');
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

/** The instance, its seeded graph and the agent's environment, made once for both tests. */
let SETUP = null;
async function setup() {
  if (SETUP) return SETUP;
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/resolve.js does not exist yet (ADR graph-operations-first-slice/0009 Decision 4)');
  const owner = makeKey();
  const admin = makeKey();
  const seed = seedResolve({ owner: owner.pubkey, admin: admin.pubkey, items: 0 });
  const file = seed.file(tmp('resolve-agent-graph-'));
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('resolve-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  SETUP = { seed, file, env: { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile } };
  return SETUP;
}

test('RX1: the agent resolves a concept by its name, gets one candidate, and lists its elements with the key it got back', async () => {
  const { seed, env } = await setup();
  const r = await cli(['graph', 'resolve', '--ref', 'dog breed', '--kind', 'concept'], env);
  assert(r.code === 0, `the agent's resolve must succeed; ${said(r)}`);
  const body = json(r.stdout);
  assert(body && body.success && Array.isArray(body.data.candidates), `it answers candidates; got ${show(body)}`);
  assert(body.data.ambiguous === false && body.data.candidates.length === 1, `dog breed names one concept; got ${show(body.data)}`);
  const key = body.data.candidates[0].tapestryKey;
  assert(key === seed.keys.breed && body.data.candidates[0].kind === 'concept', `the one candidate is dog breed's header; got ${show(body.data.candidates[0])}`);
  const list = await cli(['graph', 'list-elements', '--concept', key, '--pov', 'everyone'], env);
  assert(list.code === 0, `the agent lists that concept's elements with the key it got back; ${said(list)}`);
  const els = json(list.stdout);
  assert(els && els.success && show(els.data.elements.map((e) => e.name).sort()) === show(['beagle', 'collie', 'poodle']), `dog breed's three elements; got ${show(els && els.data)}`);
});

test('RX2: the agent is told when a name is ambiguous, narrows a set by kind, and is refused a kind there isn\'t', async () => {
  const { seed, env } = await setup();
  const all = await cli(['graph', 'resolve', '--ref', 'nostr relay', '--pov', 'everyone'], env);
  assert(all.code === 0, `the agent's resolve must succeed; ${said(all)}`);
  const b = json(all.stdout);
  assert(b && b.data.ambiguous === true && show(b.data.candidates.map((c) => c.tapestryKey).sort()) === show([seed.keys.relay, seed.keys.peerRelay].sort()), `from everyone's point of view, nostr relay names two concepts, and the answer says it's ambiguous; got ${show(b && b.data)}`);
  const own = json((await cli(['graph', 'resolve', '--ref', 'nostr relay'], env)).stdout);
  assert(own && own.data.ambiguous === false && own.data.kept === 1 && own.data.leftOut === 1, `from the owner's point of view, one counts and one is left out; got ${show(own && own.data)}`);
  const set = json((await cli(['graph', 'resolve', '--ref', 'walkers', '--kind', 'set'], env)).stdout);
  assert(set && set.data.candidates.length === 1 && set.data.candidates[0].tapestryKey === seed.keys.walkers && set.data.candidates[0].kind === 'set', `walkers, as a set: the set, not the card set named like it; got ${show(set && set.data)}`);
  const no = await cli(['graph', 'resolve', '--ref', 'dog', '--kind', 'property'], env);
  const refusal = json(no.stdout);
  assert(no.code === 1 && refusal && refusal.code === 'invalid-input' && refusal.input === 'kind', `a kind there isn't: exit 1, invalid-input, naming kind; ${said(no)}`);
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
