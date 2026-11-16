'use strict';
/**
 * An admin agent creates and renames a concept through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/16-create-concept-and-update-concept.md (AC8's last
 *          sentence: "An admin agent with its own key creates a concept, creates it again, and renames it, through the
 *          external CLI (A10.6) with no change to the CLI")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0016-create-concept-and-update-concept.md (Decisions 7,
 *          9, 10, 13)
 *   Model: test/operations/graph/fields-agent-through-cli.test.js
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph seeded by
 * test/helpers/conceptGraph.js; the agent is clients/cli/bin/tapestry.js, holding an admin's own key.
 *
 *   X3 the agent creates lamp, creates it again (already-exists, nothing recorded), renames it light, and reads its
 *      history back by the header, newest first, each entry recorded as its own
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const C = require('../../helpers/conceptGraph');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent makes concepts through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));
const DECLS = ['create-concept', 'update-concept'].map((n) => path.join(ROOT, `src/operations/catalog/graph/${n}.js`));

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('concepts-agent-');
  const recordFile = path.join(dir, 'requests.jsonl');
  fs.writeFileSync(recordFile, '');
  const specFile = path.join(dir, 'spec.json');
  fs.writeFileSync(specFile, JSON.stringify({ root: ROOT, catalogDir: path.join(ROOT, 'src/operations/catalog'), recordFile, graphFakeState: stateFile }));
  const env = S.childEnv(dir);
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
    const home = tmp('concepts-agent-home-');
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

test('X3: the agent creates lamp, creates it again, renames it light, and reads its history back, each entry its own', async () => {
  const missing = DECLS.find((f) => !fs.existsSync(f));
  if (missing) throw new Error(`${path.relative(ROOT, missing)} does not exist yet (ADR graph-operations-first-slice/0016 Decisions 7 and 9)`);
  const owner = makeKey();
  const admin = makeKey();
  const seed = await C.seedConcepts();
  const file = seed.file(tmp('concepts-agent-graph-'));
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('concepts-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const mine = (body) => body && body.success && body.data.change && body.data.change.by.role === 'admin' && body.data.change.by.pubkey === admin.pubkey;

  const made = await cli(['graph', 'create-concept', '--name', 'lamp'], env);
  assert(made.code === 0, `the agent's create must succeed; ${said(made)}`);
  const m = json(made.stdout);
  assert(mine(m) && m.data.outcome === 'created' && m.data.concept.names.singular === 'lamp', `created, recorded as the agent's own; got ${show(m)}`);
  const header = m.data.concept.conceptHeader;

  const again = await cli(['graph', 'create-concept', '--name', 'lamp'], env);
  assert(again.code === 0, `the agent's repeat must succeed; ${said(again)}`);
  const g = json(again.stdout);
  assert(g && g.success && g.data.outcome === 'already-exists' && g.data.change === null && g.data.concept.conceptHeader === header, `already-exists, the same concept, nothing recorded; got ${show(g)}`);

  const renamed = await cli(['graph', 'update-concept', '--concept', header, '--name', 'light'], env);
  assert(renamed.code === 0, `the agent's rename must succeed; ${said(renamed)}`);
  const u = json(renamed.stdout);
  assert(mine(u) && u.data.outcome === 'updated' && u.data.concept.names.singular === 'light', `renamed, recorded as the agent's own; got ${show(u)}`);
  assert(C.node(S.readState(file), header).props.name === 'light', 'the graph holds the new name');

  const hist = await cli(['graph', 'history', '--node', header], env);
  assert(hist.code === 0, `the agent's history must succeed; ${said(hist)}`);
  const h = json(hist.stdout);
  const ops = h && h.success ? h.data.entries.map((e) => e.operation) : null;
  assert(show(ops) === show(['graph update-concept', 'graph create-concept']), `history for the header: the rename, then the create, newest first, and no entry for the repeat; got ${show(h)}`);
  assert(h.data.entries.every((e) => e.by.role === 'admin' && e.by.pubkey === admin.pubkey), 'each is recorded as the agent\'s');
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
