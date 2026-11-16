'use strict';
/**
 * An admin agent lists elements through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/11-list-elements.md (AC6's last sentence)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0011-list-elements-and-the-read-conventions.md
 *          (Context 10: the external CLI sends a read's flags as its query, so it needs no change)
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph
 * test/helpers/elementsGraph.js seeds for test/helpers/graphFake.js. The agent is the external CLI,
 * clients/cli/bin/tapestry.js, holding an admin's own key, as story graph-operations-foundation #6 built it.
 *
 *   LX1 the agent lists a concept's elements page by page, following each cursor to the end, and gets each element
 *       its owner's point of view keeps exactly once, with what was left out counted
 *   LX2 the agent lists a set's elements from everyone's point of view, and is refused a header given as a set
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const { seedElements, DOG } = require('../../helpers/elementsGraph');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent lists elements through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const DECL = path.join(ROOT, 'src/operations/catalog/graph/list-elements.js');
const READY = 'externalCliServer-ready ';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));

function makeKey() {
  const sk = NT.generateSecretKey();
  const pubkey = NT.getPublicKey(sk);
  return { nsec: NT.nip19.nsecEncode(sk), pubkey };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('elements-agent-');
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
    const home = tmp('elements-agent-home-');
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
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/list-elements.js does not exist yet (ADR graph-operations-first-slice/0011 Decision 2)');
  const owner = makeKey();
  const admin = makeKey();
  const seed = seedElements({ owner: owner.pubkey, admin: admin.pubkey });
  const file = seed.file(tmp('elements-agent-graph-'));
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('elements-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  SETUP = { seed, file, env: { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile } };
  return SETUP;
}

test('LX1: the agent lists a concept\'s elements page by page, to the end, each kept element once, with what was left out counted', async () => {
  const { seed, env } = await setup();
  const keys = [];
  let cursor = null;
  for (let page = 1; page <= 5; page++) {
    const args = ['graph', 'list-elements', '--concept', seed.keys.H, '--limit', '3', ...(cursor ? ['--cursor', cursor] : [])];
    const r = await cli(args, env);
    assert(r.code === 0, `page ${page}: the agent's read must succeed; ${said(r)}`);
    const body = json(r.stdout);
    assert(body && body.success && Array.isArray(body.data.elements), `page ${page} answers its elements; got ${show(body)}`);
    assert(body.data.kept === DOG.kept.length && body.data.leftOut === DOG.leftOut.length, `page ${page}: ${DOG.kept.length} kept and ${DOG.leftOut.length} left out, across the list; got ${show({ kept: body.data.kept, leftOut: body.data.leftOut })}`);
    assert(body.data.pov && body.data.pov.name === 'owner', `page ${page}: read from the owner's point of view; got ${show(body.data.pov)}`);
    keys.push(...body.data.elements.map((e) => e.tapestryKey));
    cursor = body.data.cursor;
    if (!cursor) break;
  }
  assert(cursor === null, 'the agent reaches the last page, whose cursor is null');
  assert(show(keys) === show(seed.names(DOG.kept)), `every element the owner's point of view keeps, exactly once, in tapestryKey order; got ${keys.length}`);
  assert(!keys.includes(seed.keys.admin), 'the agent\'s own element is left out: an admin counts by score, and this one is scored 0.01');
});

test('LX2: the agent lists a set\'s elements from everyone\'s point of view, and is refused a header given as a set', async () => {
  const { seed, env } = await setup();
  const r = await cli(['graph', 'list-elements', '--set', seed.keys.W, '--pov', 'everyone', '--limit', '200'], env);
  assert(r.code === 0, `the agent's read of walkers must succeed; ${said(r)}`);
  const body = json(r.stdout);
  assert(body && body.success && show(body.data.elements.map((e) => e.tapestryKey).sort()) === show(seed.names(DOG.walkers)), `walkers' elements, its own and puppies'; got ${show(body && body.data)}`);
  const no = await cli(['graph', 'list-elements', '--set', seed.keys.H], env);
  const refusal = json(no.stdout);
  assert(no.code === 1 && refusal && refusal.code === 'not-a-set' && refusal.input === 'set', `a header given as set: exit 1, not-a-set, naming set; ${said(no)}`);
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
