'use strict';
/**
 * An admin agent links and unlinks sets through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/28-link-set-and-unlink-set.md (AC8: "an admin agent
 *          with its own key links a set, links it again, is refused a cycle, unlinks the set, and is refused its last
 *          parent, through the external CLI (A10.6) with no change to the CLI")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0028-link-set-and-unlink-set.md (Decision 11)
 *   Model: test/operations/graph/agent-through-cli.test.js and fields-agent-through-cli.test.js
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over the graph
 * test/helpers/classThreadSeed.js's agentGraph() seeds (book "Books" ─▶ Novels, Classics). The agent is
 * clients/cli/bin/tapestry.js, holding an admin's own key. The scratch stack's run of the same steps is the plan's
 * live check.
 *
 *   X3 the agent links Novels under Classics, links it again, is refused Classics under Novels (a cycle), unlinks Novels
 *      from Classics, and is refused Novels' last parent; history for Novels reads the two entries back, newest first,
 *      each recorded as the agent's own
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const CT = require('../../helpers/classThreadSeed');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent links and unlinks sets through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));
const DECL = {
  'link-set': path.join(ROOT, 'src/operations/catalog/graph/link-set.js'),
  'unlink-set': path.join(ROOT, 'src/operations/catalog/graph/unlink-set.js'),
};

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('sets-agent-');
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
      resolve({ url: `http://127.0.0.1:${JSON.parse(out.slice(at + READY.length, end)).port}` });
    });
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('exit', (code) => { if (!ready) { clearTimeout(timer); reject(new Error(`the test instance exited ${code} before it was ready: ${err.slice(-600)}`)); } });
  });
}

function cli(args, env) {
  return new Promise((resolve) => {
    const home = tmp('sets-agent-home-');
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
/** The operation's declaration must be there; if it isn't, the CLI's answer shows the reason. */
function needDecl(op, r) {
  if (!fs.existsSync(DECL[op])) throw new Error(`src/operations/catalog/graph/${op}.js does not exist yet (ADR graph-operations-first-slice/0028 Decision 1): the external CLI exited ${r.code}: ${String(r.stderr || r.stdout).trim().split(NL)[0]}`);
}

test('X3: the agent links a set, links it again, is refused a cycle, unlinks the set, and is refused its last parent, each through the external CLI', async () => {
  const owner = makeKey();
  const admin = makeKey();
  const g = CT.agentGraph();
  const file = g.file(tmp('sets-agent-graph-'));
  const k = g.keys;
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('sets-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const mine = (body) => body && body.success && body.data.change && body.data.change.by.role === 'admin' && body.data.change.by.pubkey === admin.pubkey;

  const link = await cli(['graph', 'link-set', '--set', k.Novels, '--parent', k.Classics], env);
  needDecl('link-set', link);
  assert(link.code === 0, `the agent's link must succeed; ${said(link)}`);
  const l = json(link.stdout);
  assert(mine(l) && l.data.outcome === 'linked', `linked, recorded as the agent's own; got ${show(l)}`);

  const again = await cli(['graph', 'link-set', '--set', k.Novels, '--parent', k.Classics], env);
  assert(again.code === 0, `the agent's repeat must answer; ${said(again)}`);
  const a = json(again.stdout);
  assert(a && a.success && a.data.outcome === 'already-linked' && a.data.change === null, `already-linked, change null; got ${show(a)}`);

  const cycle = await cli(['graph', 'link-set', '--set', k.Classics, '--parent', k.Novels], env);
  assert(cycle.code === 1, `a refusal exits 1; ${said(cycle)}`);
  const c = json(cycle.stdout);
  assert(c && c.success === false && c.code === 'cycle' && c.rule === 'class-thread-acyclic', `Classics under Novels, which is below it, is refused cycle by class-thread-acyclic; got ${show(c)}`);

  const unlink = await cli(['graph', 'unlink-set', '--set', k.Novels, '--parent', k.Classics], env);
  needDecl('unlink-set', unlink);
  assert(unlink.code === 0, `the agent's unlink must succeed; ${said(unlink)}`);
  const u = json(unlink.stdout);
  assert(mine(u) && u.data.outcome === 'unlinked', `unlinked, recorded as the agent's own; got ${show(u)}`);

  const last = await cli(['graph', 'unlink-set', '--set', k.Novels, '--parent', k.Books], env);
  assert(last.code === 1, `a refusal exits 1; ${said(last)}`);
  const lp = json(last.stdout);
  assert(lp && lp.success === false && lp.code === 'last-parent' && lp.rule === 'set-has-a-parent', `Novels from Books, its last parent, is refused last-parent by set-has-a-parent; got ${show(lp)}`);

  const hist = await cli(['graph', 'history', '--node', k.Novels], env);
  assert(hist.code === 0, `the agent's history must succeed; ${said(hist)}`);
  const h = json(hist.stdout);
  const ops = h && h.success ? h.data.entries.map((e) => e.operation) : null;
  assert(show(ops) === show(['graph unlink-set', 'graph link-set']), `history for Novels: the unlink, then the link, newest first; the repeat and the refusals recorded nothing; got ${show(h)}`);
  assert(h.data.entries.every((e) => e.by.role === 'admin' && e.by.pubkey === admin.pubkey), 'each is recorded as the agent\'s');
  const st = S.readState(file);
  assert(CT.relsBetween(st, k.Books, k.Novels) === 1 && CT.relsBetween(st, k.Classics, k.Novels) === 0 && CT.relsBetween(st, k.Novels, k.Classics) === 0, 'the graph ends as it began: Novels under Books only, and no link between Novels and Classics');
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
