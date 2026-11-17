'use strict';
/**
 * An admin agent changes elements through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/21-update-node.md (AC8's last sentence: an admin agent
 *          with its own key, through the external CLI and with no change to it, "changes a field of an element
 *          create-element made, renames it, runs the same call again and is told nothing changed, and is refused fields
 *          that don't fit, a rename onto a name in use, and a node from another author's event")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0021-update-node.md (Decisions 1, 3, 10–12, 17, 18)
 *   Model: test/operations/graph/elements-agent-through-cli.test.js
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph seeded by
 * test/helpers/updateNodeGraph.js; the agent is clients/cli/bin/tapestry.js, holding an admin's own key. Its fields go
 * on the command line as JSON text, which the CLI sends as it came.
 *
 *   XU1 the agent makes Snoopy with create-element, changes its description, renames it, runs the rename again
 *       (unchanged, nothing recorded), is refused a description taken out (invalid-fields, from element-fits-schema),
 *       a rename of Lucky onto Rover (name-in-use) and a change to another author's Snowy (not-own-node), and reads
 *       Snoopy's history back: the create and the two updates, newest first, each its own
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const C = require('../../helpers/conceptGraph');
const U = require('../../helpers/updateNodeGraph');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent changes elements through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));
const DECL = path.join(ROOT, 'src/operations/catalog/graph/update-node.js');

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('update-node-agent-');
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
    const home = tmp('update-node-agent-home-');
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
  if (!fs.existsSync(DECL)) throw new Error(`src/operations/catalog/graph/update-node.js does not exist yet (ADR graph-operations-first-slice/0021 Decision 1): the external CLI exited ${r.code}: ${String(r.stderr || r.stdout).trim().split(NL)[0]}`);
}

test('XU1: the agent changes, renames and repeats; is refused bad fields, a name in use and another author\'s node; reads the history back', async () => {
  const owner = makeKey();
  const admin = makeKey();
  const seed = await U.seedUpdateNode();
  const k = seed.keys;
  const file = seed.file(tmp('update-node-agent-graph-'));
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('update-node-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const mine = (body) => body && body.success && body.data.change && body.data.change.by.role === 'admin' && body.data.change.by.pubkey === admin.pubkey;

  const made = await cli(['graph', 'create-element', '--concept', k.beagle, '--name', 'Snoopy', '--fields', '{"description":"A beagle who flies."}'], env);
  assert(made.code === 0, `the agent's create-element must succeed first; ${said(made)}`);
  const snoopy = json(made.stdout).data.element.tapestryKey;

  const changed = await cli(['graph', 'update-node', '--node', snoopy, '--fields', '{"description":"A beagle who flew."}'], env);
  needDecl(changed);
  assert(changed.code === 0, `the agent's change must succeed; ${said(changed)}`);
  const c = json(changed.stdout);
  assert(mine(c) && c.data.outcome === 'updated' && show(c.data.changed) === show(['fields.description']), `updated, the description changed, recorded as the agent's own; got ${show(c)}`);
  const sent = fs.readFileSync(inst.recordFile, 'utf8').split(NL).filter(Boolean).map(json).find((r) => r && r.path === '/api/tapestry/graph/update-node');
  assert(sent && typeof sent.body.fields === 'string', `the CLI sent fields as the JSON text it was given: no change to the CLI; got ${show(sent && sent.body)}`);

  const renamed = await cli(['graph', 'update-node', '--node', snoopy, '--name', 'Snoopy Ace'], env);
  assert(renamed.code === 0, `the agent's rename must succeed; ${said(renamed)}`);
  const r = json(renamed.stdout);
  assert(mine(r) && r.data.outcome === 'updated' && r.data.node.name === 'Snoopy Ace', `renamed, recorded as the agent's own; got ${show(r)}`);

  const again = await cli(['graph', 'update-node', '--node', snoopy, '--name', 'Snoopy Ace'], env);
  assert(again.code === 0, `the agent's repeat must answer; ${said(again)}`);
  const g = json(again.stdout);
  assert(g && g.success && g.data.outcome === 'unchanged' && g.data.change === null, `the same rename again: unchanged, nothing recorded; got ${show(g)}`);

  const bad = await cli(['graph', 'update-node', '--node', snoopy, '--fields', '{"description":null}'], env);
  assert(bad.code === 1, `a refusal exits 1; ${said(bad)}`);
  const b = json(bad.stdout);
  assert(b && b.success === false && b.code === 'invalid-fields' && b.rule === 'element-fits-schema' && /beagle\.description/.test(String(b.error)),
    `a description taken out is refused invalid-fields by element-fits-schema, naming the field; got ${show(b)}`);

  const clash = await cli(['graph', 'update-node', '--node', k.lucky, '--name', 'Rover'], env);
  assert(clash.code === 1, `a refusal exits 1; ${said(clash)}`);
  const n = json(clash.stdout);
  assert(n && n.code === 'name-in-use' && String(n.error).includes(k.rover), `Lucky can't take Rover's name: name-in-use, naming rover; got ${show(n)}`);

  const peer = await cli(['graph', 'update-node', '--node', k.snowy, '--fields', '{"description":"mine now"}'], env);
  assert(peer.code === 1, `a refusal exits 1; ${said(peer)}`);
  const p = json(peer.stdout);
  assert(p && p.code === 'not-own-node' && /copy-node/.test(String(p.error)), `another author's Snowy: not-own-node, naming graph copy-node; got ${show(p)}`);

  const hist = await cli(['graph', 'history', '--node', snoopy], env);
  assert(hist.code === 0, `the agent's history must succeed; ${said(hist)}`);
  const h = json(hist.stdout);
  const ops = h && h.success ? h.data.entries.map((e) => e.operation) : null;
  assert(ops && show(ops) === show(['graph update-node', 'graph update-node', 'graph create-element']), `history for Snoopy: the rename, the change, then the create, newest first, and nothing for the repeat or the refusals; got ${show(h)}`);
  assert(h.data.entries.every((e) => e.by.role === 'admin' && e.by.pubkey === admin.pubkey), 'each entry is the agent\'s own');
  const node = C.node(S.readState(file), snoopy);
  assert(node.props.name === 'Snoopy Ace' && C.json(S.readState(file), snoopy).beagle.description === 'A beagle who flew.', `the graph holds Snoopy Ace, its description changed; got ${show(node.props)}`);
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
