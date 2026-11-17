'use strict';
/**
 * An admin agent deletes elements through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/26-delete-node.md (AC7's last sentence: an admin agent
 *          with its own key, through the external CLI and with no change to it, "makes an element with create-element,
 *          deletes it, deletes it again and is told it is already gone, finds the delete in graph history, and is refused
 *          a node from another author's event, a set, and one of firmware's own elements")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0026-delete-node.md (Decisions 1, 3, 4, 5, 11, 12)
 *   Model: test/operations/graph/update-node-agent-through-cli.test.js
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph seeded by
 * test/helpers/deleteNodeGraph.js; the agent is clients/cli/bin/tapestry.js, holding an admin's own key.
 *
 *   XD1 the agent makes Snoopy with create-element, deletes it, deletes it again (already-gone, nothing recorded, the
 *       first delete named), reads Snoopy's history back (the delete, then the create, each its own), and is refused
 *       another author's Snowy (not-own-node), walkers, a set (made-elsewhere, naming graph delete-set), and firmware's
 *       rover (firmware-node)
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const C = require('../../helpers/conceptGraph');
const D = require('../../helpers/deleteNodeGraph');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent deletes elements through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));
const DECL = path.join(ROOT, 'src/operations/catalog/graph/delete-node.js');

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('delete-node-agent-');
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
      resolve({ url: `http://127.0.0.1:${JSON.parse(out.slice(at + READY.length, end)).port}`, recordFile });
    });
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('exit', (code) => { if (!ready) { clearTimeout(timer); reject(new Error(`the test instance exited ${code} before it was ready: ${err.slice(-600)}`)); } });
  });
}

function cli(args, env) {
  return new Promise((resolve) => {
    const home = tmp('delete-node-agent-home-');
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
function needDecl(r) {
  if (!fs.existsSync(DECL)) throw new Error(`src/operations/catalog/graph/delete-node.js does not exist yet (ADR graph-operations-first-slice/0026 Decision 1): the external CLI exited ${r.code}: ${String(r.stderr || r.stdout).trim().split(NL)[0]}`);
}

test('XD1: the agent deletes, repeats and reads the history back; is refused another author\'s node, a set and firmware\'s own element', async () => {
  const owner = makeKey();
  const admin = makeKey();
  const seed = await D.seedDeleteNode();
  const k = seed.keys;
  const file = seed.file(tmp('delete-node-agent-graph-'));
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('delete-node-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const agents = (by) => by && by.role === 'admin' && by.pubkey === admin.pubkey;

  const made = await cli(['graph', 'create-element', '--concept', k.beagle, '--name', 'Snoopy', '--fields', '{"description":"A beagle who flies."}'], env);
  assert(made.code === 0, `the agent's create-element must succeed first; ${said(made)}`);
  const snoopy = json(made.stdout).data.element.tapestryKey;

  const gone = await cli(['graph', 'delete-node', '--node', snoopy], env);
  needDecl(gone);
  assert(gone.code === 0, `the agent's delete must succeed; ${said(gone)}`);
  const g = json(gone.stdout);
  assert(g && g.success && g.data.outcome === 'deleted' && g.data.node.tapestryKey === snoopy && g.data.change && agents(g.data.change.by),
    `deleted, recorded as the agent's own; got ${show(g).slice(0, 500)}`);
  const sent = fs.readFileSync(inst.recordFile, 'utf8').split(NL).filter(Boolean).map(json).find((r) => r && r.path === '/api/tapestry/graph/delete-node');
  assert(sent && sent.body.node === snoopy, `the CLI sent node as given: no change to the CLI; got ${show(sent && sent.body)}`);

  const again = await cli(['graph', 'delete-node', '--node', snoopy], env);
  assert(again.code === 0, `the agent's repeat must answer; ${said(again)}`);
  const a = json(again.stdout);
  assert(a && a.success && a.data.outcome === 'already-gone' && a.data.change === null && a.data.deletion && a.data.deletion.id === g.data.change.id && agents(a.data.deletion.by),
    `the same delete again: already-gone, nothing recorded, naming the first delete and its author; got ${show(a).slice(0, 500)}`);

  const hist = await cli(['graph', 'history', '--node', snoopy], env);
  assert(hist.code === 0, `the agent's history must succeed; ${said(hist)}`);
  const h = json(hist.stdout);
  const ops = h && h.success ? h.data.entries.map((e) => e.operation) : null;
  assert(ops && show(ops) === show(['graph delete-node', 'graph create-element']), `history for Snoopy: the delete, then the create, newest first, and nothing for the repeat or the refusals; got ${show(h).slice(0, 500)}`);
  assert(h.data.entries.every((e) => agents(e.by)), 'each entry is the agent\'s own');

  const peer = await cli(['graph', 'delete-node', '--node', k.snowy], env);
  assert(peer.code === 1, `a refusal exits 1; ${said(peer)}`);
  const p = json(peer.stdout);
  assert(p && p.success === false && p.code === 'not-own-node' && /copy-node/.test(String(p.error)), `another author's Snowy: not-own-node, naming graph copy-node; got ${show(p)}`);

  const set = await cli(['graph', 'delete-node', '--node', k.walkers], env);
  assert(set.code === 1, `a refusal exits 1; ${said(set)}`);
  const st = json(set.stdout);
  assert(st && st.code === 'made-elsewhere' && /delete-set/.test(String(st.error)), `walkers, a set: made-elsewhere, naming graph delete-set; got ${show(st)}`);

  const fw = await cli(['graph', 'delete-node', '--node', k.firmwareRover], env);
  assert(fw.code === 1, `a refusal exits 1; ${said(fw)}`);
  const f = json(fw.stdout);
  assert(f && f.code === 'firmware-node' && /rover\.json/.test(String(f.error)), `firmware's rover: firmware-node, naming its file; got ${show(f)}`);

  const after = S.readState(file);
  assert(!C.node(after, snoopy) && C.node(after, k.snowy) && C.node(after, k.walkers) && C.node(after, k.firmwareRover), 'the graph has no Snoopy, and still has Snowy, walkers and firmware\'s rover');
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
