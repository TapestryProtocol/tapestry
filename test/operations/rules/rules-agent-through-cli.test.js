'use strict';
/**
 * An admin agent finds a property hung under two parents and repairs it, through the external CLI — run by
 * test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/45-property-has-one-parent.md (AC8: "On a scratch
 *          stack, an admin agent with its own key, through the external CLI and with no change to it, checks a concept
 *          whose property hangs under both its primary property and its JSON schema node and is told so, repairs it,
 *          checks again and is told nothing is wrong, changes the concept's property with graph update-property, and
 *          repeats the repair and is told there was nothing to repair")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0045-property-has-one-parent.md (Decisions 5 to 9)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/45-property-has-one-parent.test-plan.md
 *   Model: test/operations/graph/enumerate-agent-through-cli.test.js
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph seeded by
 * test/helpers/propertyGraph.js; the agent is clients/cli/bin/tapestry.js, holding an admin's own key. No operation
 * makes the tangle, so the test hangs the agent's new property on its concept's schema node by hand, in the graph's
 * file, as today's enumerate route would. The plan's live check runs the same steps on a scratch stack.
 *
 *   XR1 the agent makes robot and its field venture; with venture hung on robot's schema too, update-property is
 *       refused tangled-tree; rules check on robot names venture, with a fix; rules repair by its id repairs it, as the
 *       agent's own; check again finds nothing; update-property changes venture; the repair again finds nothing to
 *       repair; and venture's history is the change, the repair and the add, each the agent's own
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const P = require('../../helpers/propertyGraph');
const G = require('../../helpers/graphFake');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent repairs a property hung under two parents through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const CHECK_DECL = path.join(ROOT, 'src/operations/catalog/rules/check.js');
const REPAIR_DECL = path.join(ROOT, 'src/operations/catalog/rules/repair.js');
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('rules-agent-');
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
    const home = tmp('rules-agent-home-');
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
function needDecl(r, file, name, decision) {
  if (!fs.existsSync(file)) throw new Error(`src/operations/catalog/rules/${name}.js does not exist yet (ADR graph-operations-first-slice/0045 ${decision}): the external CLI exited ${r.code}: ${String(r.stderr || r.stdout).trim().split(NL)[0]}`);
}

test('XR1 [AC8]: the agent finds venture hung on robot\'s schema too, repairs it, finds nothing wrong, changes it, and is told a repeat has nothing to repair', async () => {
  const owner = makeKey();
  const admin = makeKey();
  const seed = await P.seedProperties();
  const file = seed.file(tmp('rules-agent-graph-'));
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('rules-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const mine = (body) => body && body.success && body.data.change && body.data.change.by.role === 'admin' && body.data.change.by.pubkey === admin.pubkey;
  const step = async (what, args) => {
    const r = await cli(args, env);
    assert(r.code === 0, `the agent's ${what} must succeed; ${said(r)}`);
    return json(r.stdout).data;
  };

  const made = (await step('create-concept of robot', ['graph', 'create-concept', '--name', 'robot'])).concept;
  const robot = made.conceptHeader;
  const field = (await step('add-property', ['graph', 'add-property', '--concept', robot, '--name', 'venture', '--type', 'string'])).property.property;

  // As today's enumerate route would leave it: venture hung on robot's JSON schema node too.
  const s = S.readState(file);
  const byKey = (k) => s.nodes.find((n) => n.props.tapestryKey === k);
  const schemaRel = s.rels.find((r) => r.type === 'IS_THE_JSON_SCHEMA_FOR' && r.to === byKey(robot).eid);
  assert(schemaRel, "robot has a JSON schema node, as create-concept makes one");
  const schemaKey = s.nodes.find((n) => n.eid === schemaRel.from).props.tapestryKey;
  s.rels.push({ eid: s.nextEid++, type: 'IS_A_PROPERTY_OF', from: byKey(field).eid, to: schemaRel.from, props: {} });
  G.writeState(file, s);

  const tangled = await cli(['graph', 'update-property', '--property', field, '--description', 'The venture the robot works on'], env);
  const t = json(tangled.stdout);
  assert(tangled.code === 1 && t && t.code === 'tangled-tree', `with venture under two parents, update-property is refused tangled-tree; ${said(tangled)}`);

  const checked = await cli(['rules', 'check', '--scope', robot], env);
  needDecl(checked, CHECK_DECL, 'check', 'Decision 5');
  const c = json(checked.stdout);
  assert(checked.code === 0 && c && c.data.found === 1 && c.data.violations[0].node.tapestryKey === field && c.data.violations[0].fix, `rules check on robot names venture, with a fix; ${said(checked)}`);
  const id = c.data.violations[0].id;
  const sent = fs.readFileSync(inst.recordFile, 'utf8').split(NL).filter(Boolean).map(json).find((r) => r && r.path === '/api/tapestry/rules/check');
  assert(sent && new URL(sent.url, 'http://x').searchParams.get('scope') === robot, `the CLI sent the scope as it was given: no change to the CLI; got ${show(sent && sent.url)}`);

  const repaired = await cli(['rules', 'repair', '--violation', id], env);
  needDecl(repaired, REPAIR_DECL, 'repair', 'Decision 6');
  const rp = json(repaired.stdout);
  assert(repaired.code === 0 && mine(rp) && rp.data.outcome === 'repaired' && show(rp.data.fixed[0].removed.map((x) => [x.from, x.to])) === show([[field, schemaKey]]),
    `rules repair takes off venture's link to robot's schema, recorded as the agent's own; ${said(repaired)}`);

  const again = await cli(['rules', 'check', '--scope', robot], env);
  const a = json(again.stdout);
  assert(again.code === 0 && a && a.data.found === 0, `check again: nothing wrong; ${said(again)}`);

  const changed = await cli(['graph', 'update-property', '--property', field, '--description', 'The venture the robot works on'], env);
  assert(changed.code === 0 && mine(json(changed.stdout)), `update-property now changes venture, as the agent's own; ${said(changed)}`);

  const repeat = await cli(['rules', 'repair', '--violation', id], env);
  const re = json(repeat.stdout);
  assert(repeat.code === 0 && re && re.data.outcome === 'nothing-to-repair' && re.data.change === null, `the repair again: nothing to repair, nothing recorded; ${said(repeat)}`);

  const hist = await cli(['graph', 'history', '--node', field], env);
  const h = json(hist.stdout);
  const ops = h && h.success ? h.data.entries.map((e) => e.operation) : null;
  assert(show(ops) === show(['graph update-property', 'rules repair', 'graph add-property']), `venture's history, newest first: the change, the repair and the add; nothing for the refusal, the checks or the repeat; got ${show(h).slice(0, 500)}`);
  assert(h.data.entries.every((e) => e.by.role === 'admin' && e.by.pubkey === admin.pubkey), "each entry is the agent's own");
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

module.exports = { run: runAll };
if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));
