'use strict';
/**
 * An admin agent makes elements through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/20-create-element.md (AC8's last sentence: "an admin
 *          agent with its own key makes an element, makes it again, makes one in a set, and is refused fields that
 *          don't fit, through the external CLI (A10.6) with no change to the CLI")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0020-create-element.md (Decisions 1, 6, 12, 14, 15)
 *   Model: test/operations/graph/concepts-agent-through-cli.test.js
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph seeded by
 * test/helpers/createElementGraph.js; the agent is clients/cli/bin/tapestry.js, holding an admin's own key. Its fields
 * go on the command line as JSON text, which the CLI sends as it came (Decision 1).
 *
 *   XE1 the agent makes Snoopy, makes it again (already-exists, nothing recorded), makes Ribbon in show beagles, is
 *       refused Nameless's fields (invalid-fields, from element-fits-schema), and reads beagle's history back: the two
 *       creates, newest first, each its own
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const C = require('../../helpers/conceptGraph');
const E = require('../../helpers/createElementGraph');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent makes elements through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));
const DECL = path.join(ROOT, 'src/operations/catalog/graph/create-element.js');

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('elements-agent-');
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
function needDecl(r) {
  if (!fs.existsSync(DECL)) throw new Error(`src/operations/catalog/graph/create-element.js does not exist yet (ADR graph-operations-first-slice/0020 Decision 1): the external CLI exited ${r.code}: ${String(r.stderr || r.stdout).trim().split(NL)[0]}`);
}

test('XE1: the agent makes Snoopy, makes it again, makes Ribbon in a set, is refused fields that don\'t fit, and reads the history back', async () => {
  const owner = makeKey();
  const admin = makeKey();
  const seed = await E.seedCreateElement();
  const k = seed.keys;
  const file = seed.file(tmp('elements-agent-graph-'));
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('elements-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const mine = (body) => body && body.success && body.data.change && body.data.change.by.role === 'admin' && body.data.change.by.pubkey === admin.pubkey;

  const made = await cli(['graph', 'create-element', '--concept', k.beagle, '--name', 'Snoopy', '--fields', '{"description":"A beagle who flies."}'], env);
  needDecl(made);
  assert(made.code === 0, `the agent's create must succeed; ${said(made)}`);
  const m = json(made.stdout);
  assert(mine(m) && m.data.outcome === 'created' && m.data.element.name === 'Snoopy' && m.data.element.address === E.elementAddress('Snoopy', seed.uuids.beagle), `created, recorded as the agent's own; got ${show(m)}`);
  const snoopy = m.data.element.tapestryKey;
  const sent = fs.readFileSync(inst.recordFile, 'utf8').split(NL).filter(Boolean).map(json).find((r) => r && r.path === '/api/tapestry/graph/create-element');
  assert(sent && typeof sent.body.fields === 'string', `the CLI sent fields as the JSON text it was given: no change to the CLI; got ${show(sent && sent.body)}`);

  const again = await cli(['graph', 'create-element', '--concept', k.beagle, '--name', 'Snoopy', '--fields', '{"description":"A beagle who flies."}'], env);
  assert(again.code === 0, `the agent's repeat must answer; ${said(again)}`);
  const g = json(again.stdout);
  assert(g && g.success && g.data.outcome === 'already-exists' && g.data.change === null && g.data.element.tapestryKey === snoopy && show(g.data.differs) === show([]), `already-exists, the same element, nothing recorded, nothing differs; got ${show(g)}`);

  const inSet = await cli(['graph', 'create-element', '--concept', k.beagle, '--set', k.showBeagles, '--name', 'Ribbon', '--fields', '{"description":"a show beagle"}'], env);
  assert(inSet.code === 0, `the agent's create in a set must succeed; ${said(inSet)}`);
  const r = json(inSet.stdout);
  assert(mine(r) && r.data.outcome === 'created' && show(r.data.element.parents) === show([k.showBeagles]), `Ribbon is made directly in show beagles, recorded as the agent's own; got ${show(r)}`);

  const bad = await cli(['graph', 'create-element', '--concept', k.beagle, '--name', 'Nameless', '--fields', '{}'], env);
  assert(bad.code === 1, `a refusal exits 1; ${said(bad)}`);
  const b = json(bad.stdout);
  assert(b && b.success === false && b.code === 'invalid-fields' && b.rule === 'element-fits-schema' && /beagle\.description/.test(String(b.error)),
    `fields with no description are refused invalid-fields by element-fits-schema, naming the field; got ${show(b)}`);

  const hist = await cli(['graph', 'history', '--node', k.beagle], env);
  assert(hist.code === 0, `the agent's history must succeed; ${said(hist)}`);
  const h = json(hist.stdout);
  const mineEntries = h && h.success ? h.data.entries.filter((e) => e.operation === 'graph create-element') : null;
  assert(mineEntries && mineEntries.length === 2 && mineEntries.every((e) => e.by.role === 'admin' && e.by.pubkey === admin.pubkey), `history for beagle: the two creates, each the agent's, and nothing for the repeat or the refusal; got ${show(h)}`);
  const nodes = mineEntries.map((e) => (e.changes.find((c) => c.change === 'element-created') || {}).node);
  assert(show(nodes) === show([r.data.element.tapestryKey, snoopy]), `newest first: Ribbon, then Snoopy; got ${show(nodes)}`);
  assert(C.node(S.readState(file), snoopy).props.name === 'Snoopy', 'the graph holds Snoopy');
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
