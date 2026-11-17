'use strict';
/**
 * An admin agent walks the graph through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/14-walk.md (AC7: an admin agent with its own key walks
 *          from a concept's header to its elements, page by page, then by types and by direction, through the
 *          external CLI with no change to the CLI)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0014-walk.md (Context 6: the external CLI sends a
 *          repeated flag as repeated keys, so it needs no change)
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph
 * test/helpers/walkGraph.js seeds for test/helpers/graphFake.js. The agent is the external CLI,
 * clients/cli/bin/tapestry.js, holding an admin's own key, as story graph-operations-foundation #6 built it.
 *
 *   WX1 the agent walks from a concept's header out along the class thread to its elements, page by page, following
 *       each cursor to the end, and gets each node once, nearest first, each with its path
 *   WX2 the agent walks in from an element by the class thread's types, walks from two start nodes with --from given
 *       twice, and is refused a start that names no node
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const { seedWalk, THREAD_TYPES, CLASS_THREAD } = require('../../helpers/walkGraph');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent walks the graph through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const DECL = path.join(ROOT, 'src/operations/catalog/graph/walk.js');
const READY = 'externalCliServer-ready ';
const UNKNOWN = '0c0c0c0c-0000-4000-8000-00000000cccc';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));

function makeKey() {
  const sk = NT.generateSecretKey();
  const pubkey = NT.getPublicKey(sk);
  return { nsec: NT.nip19.nsecEncode(sk), pubkey };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('walk-agent-');
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
    const home = tmp('walk-agent-home-');
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
const named = (k) => (key) => Object.keys(k).find((n) => k[n] === key) || key;

/** The instance, its seeded graph and the agent's environment, made once for both tests. */
let SETUP = null;
async function setup() {
  if (SETUP) return SETUP;
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/walk.js does not exist yet (ADR graph-operations-first-slice/0014 Decision 2)');
  const owner = makeKey();
  const admin = makeKey();
  const seed = seedWalk({ owner: owner.pubkey, admin: admin.pubkey });
  const file = seed.file(tmp('walk-agent-graph-'));
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('walk-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  SETUP = { seed, file, env: { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile } };
  return SETUP;
}

const typeFlags = THREAD_TYPES.flatMap((t) => ['--types', t]);

test('WX1: the agent walks from a concept\'s header to its elements, page by page, to the end, each node once, nearest first, with its path', async () => {
  const { seed, env } = await setup();
  const k = seed.keys;
  const seen = [];
  let cursor = null;
  for (let page = 1; page <= 6; page++) {
    const args = ['graph', 'walk', '--from', k.header, ...typeFlags, '--direction', 'out', '--depth', '5', '--limit', '3', ...(cursor ? ['--cursor', cursor] : [])];
    const r = await cli(args, env);
    assert(r.code === 0, `page ${page}: the agent's walk must succeed; ${said(r)}`);
    const body = json(r.stdout);
    assert(body && body.success && Array.isArray(body.data.nodes), `page ${page} answers its nodes; got ${show(body)}`);
    assert(body.data.kept === 7 && body.data.leftOut === 0 && body.data.complete === true && body.data.finished === 5, `page ${page}: 7 kept across the walk, complete; got ${show({ kept: body.data.kept, leftOut: body.data.leftOut, complete: body.data.complete, finished: body.data.finished })}`);
    assert(body.data.pov && body.data.pov.name === 'owner', `page ${page}: walked from the owner's point of view; got ${show(body.data.pov)}`);
    for (const n of body.data.nodes) {
      assert(Array.isArray(n.path) && n.path.length === n.depth && n.start === k.header, `page ${page}: ${named(k)(n.tapestryKey)} comes with its ${n.depth} steps from header; got ${show(n.path)}`);
      seen.push([n.depth, n.tapestryKey]);
    }
    cursor = body.data.cursor;
    if (!cursor) break;
  }
  assert(cursor === null, 'the agent reaches the last page, whose cursor is null');
  const wanted = Object.entries(CLASS_THREAD).map(([name, d]) => [d, k[name]]).sort((a, b) => (a[0] - b[0]) || (a[1] < b[1] ? -1 : 1));
  assert(show(seen) === show(wanted), `each node of the class thread once, nearest first, its elements among them; got ${show(seen.map(([d, key]) => `${d} ${named(k)(key)}`))}`);
});

test('WX2: the agent walks in by types, walks from two start nodes with --from twice, and is refused a start that names no node', async () => {
  const { seed, env } = await setup();
  const k = seed.keys;
  const up = await cli(['graph', 'walk', '--from', k.elem3, ...typeFlags, '--direction', 'in', '--depth', '5', '--pov', 'everyone'], env);
  assert(up.code === 0, `the agent's walk in from elem3 must succeed; ${said(up)}`);
  const upBody = json(up.stdout);
  const climbed = upBody && upBody.data && upBody.data.nodes.map((n) => `${n.depth} ${named(k)(n.tapestryKey)}`);
  assert(show(climbed) === show(['1 set3', '2 set2', '3 set1', '4 superset', '5 header']), `in from elem3, up the class thread to its header; got ${show(climbed)}`);
  assert(upBody.data.nodes.every((n) => n.path.every((s) => s.direction === 'in')), 'every step of a walk in runs in');
  const two = await cli(['graph', 'walk', '--from', k.tie2, '--from', k.tie1, '--depth', '2', '--pov', 'everyone'], env);
  assert(two.code === 0, `the agent's walk from two starts must succeed; ${said(two)}`);
  const twoBody = json(two.stdout);
  assert(twoBody && show(twoBody.data.from.map((n) => n.tapestryKey)) === show([k.tie2, k.tie1]) && twoBody.data.kept === 7, `--from twice walks from both, in the order given; got ${show(twoBody && { from: twoBody.data.from.map((n) => named(k)(n.tapestryKey)), kept: twoBody.data.kept })}`);
  const no = await cli(['graph', 'walk', '--from', UNKNOWN], env);
  const refusal = json(no.stdout);
  assert(no.code === 1 && refusal && refusal.code === 'unknown-node' && refusal.input === 'from', `a key that names no node: exit 1, unknown-node, naming from; ${said(no)}`);
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
