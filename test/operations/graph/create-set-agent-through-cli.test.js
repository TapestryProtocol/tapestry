'use strict';
/**
 * An admin agent makes sets through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/27-create-set.md (AC7's last sentence: "an admin agent
 *          with its own key, through the external CLI (A10.6) and with no change to the CLI, makes a set under a
 *          concept's superset, makes it again and is told it exists, makes a set under that set, is refused a concept
 *          header as a parent and given its superset's key, and puts an element in the new set with graph
 *          create-element")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0027-create-set.md (Decisions 1, 4, 7, 13, 14)
 *   Model: test/operations/graph/elements-agent-through-cli.test.js
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph seeded by
 * test/helpers/createSetGraph.js; the agent is clients/cli/bin/tapestry.js, holding an admin's own key.
 *
 *   XS1 the agent makes Field Trials under beagle's superset, makes it again (already-exists, nothing recorded), makes
 *       Junior Trials under it, is refused beagle's header as a parent and given its superset's key, puts Trial Winner
 *       in Field Trials with create-element, and reads Field Trials' history back: three entries, newest first, each
 *       its own
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const C = require('../../helpers/conceptGraph');
const G = require('../../helpers/createSetGraph');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent makes sets through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));
const DECL = path.join(ROOT, 'src/operations/catalog/graph/create-set.js');

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('sets-create-agent-');
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
    const home = tmp('sets-create-agent-home-');
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
  if (!fs.existsSync(DECL)) throw new Error(`src/operations/catalog/graph/create-set.js does not exist yet (ADR graph-operations-first-slice/0027 Decision 1): the external CLI exited ${r.code}: ${String(r.stderr || r.stdout).trim().split(NL)[0]}`);
}

test('XS1: the agent makes a set, makes it again, makes one under it, is refused a header as parent, puts an element in the set, and reads the history back', async () => {
  const owner = makeKey();
  const admin = makeKey();
  const seed = await G.seedCreateSet();
  const k = seed.keys;
  const file = seed.file(tmp('sets-create-agent-graph-'));
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('sets-create-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const mine = (body) => body && body.success && body.data.change && body.data.change.by.role === 'admin' && body.data.change.by.pubkey === admin.pubkey;

  const made = await cli(['graph', 'create-set', '--parent', k.beagleSuperset, '--name', 'Field Trials', '--description', 'beagles in the field'], env);
  needDecl(made);
  assert(made.code === 0, `the agent's create must succeed; ${said(made)}`);
  const m = json(made.stdout);
  assert(mine(m) && m.data.outcome === 'created' && m.data.set.name === 'Field Trials' && m.data.set.address === G.setAddress('Field Trials', seed.uuids.beagleSuperset), `created, recorded as the agent's own; got ${show(m)}`);
  const trials = m.data.set.tapestryKey;

  const again = await cli(['graph', 'create-set', '--parent', k.beagleSuperset, '--name', 'Field Trials', '--description', 'beagles in the field'], env);
  assert(again.code === 0, `the agent's repeat must answer; ${said(again)}`);
  const g = json(again.stdout);
  assert(g && g.success && g.data.outcome === 'already-exists' && g.data.change === null && g.data.set.tapestryKey === trials && show(g.data.differs) === show([]), `already-exists, the same set, nothing recorded, nothing differs; got ${show(g)}`);

  const under = await cli(['graph', 'create-set', '--parent', trials, '--name', 'Junior Trials'], env);
  assert(under.code === 0, `the agent's create under the new set must succeed; ${said(under)}`);
  const j = json(under.stdout);
  assert(mine(j) && j.data.outcome === 'created' && show(j.data.set.parents) === show([trials]) && show((j.data.threads || []).map((t) => t.concept)) === show([k.beagle]), `Junior Trials is made under Field Trials, in beagle's class thread; got ${show(j)}`);

  const header = await cli(['graph', 'create-set', '--parent', k.beagle, '--name', 'Under Beagle'], env);
  assert(header.code === 1, `a refusal exits 1; ${said(header)}`);
  const h = json(header.stdout);
  assert(h && h.success === false && h.code === 'not-a-parent' && String(h.error).includes(k.beagleSuperset), `beagle's header is refused not-a-parent, naming its superset's key; got ${show(h)}`);

  const winner = await cli(['graph', 'create-element', '--concept', k.beagle, '--set', trials, '--name', 'Trial Winner', '--fields', '{"description":"won the field trial"}'], env);
  assert(winner.code === 0, `the agent's create-element in the new set must succeed; ${said(winner)}`);
  const w = json(winner.stdout);
  assert(mine(w) && w.data.outcome === 'created' && show(w.data.element.parents) === show([trials]), `Trial Winner is made directly in Field Trials; got ${show(w)}`);

  const hist = await cli(['graph', 'history', '--node', trials], env);
  assert(hist.code === 0, `the agent's history must succeed; ${said(hist)}`);
  const hh = json(hist.stdout);
  const entries = hh && hh.success ? hh.data.entries : null;
  assert(entries && entries.length === 3 && entries.every((e) => e.by.role === 'admin' && e.by.pubkey === admin.pubkey), `history for Field Trials: its own create, Junior Trials' and Trial Winner's, each the agent's; nothing for the repeat or the refusal; got ${show(hh)}`);
  assert(show(entries.map((e) => e.operation)) === show(['graph create-element', 'graph create-set', 'graph create-set']), `newest first: the element, then Junior Trials, then Field Trials; got ${show(entries.map((e) => e.operation))}`);
  assert(C.node(S.readState(file), trials).props.name === 'Field Trials', 'the graph holds Field Trials');
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
