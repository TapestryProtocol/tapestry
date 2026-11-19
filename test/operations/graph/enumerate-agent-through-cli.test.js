'use strict';
/**
 * An admin agent links a property to another concept, and takes the link back, through the external CLI — run by
 * test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/19-enumerate.md (AC7's last sentence: on a scratch
 *          stack, an admin agent with its own key, through the external CLI (A10.6) and with no change to it, "makes two
 *          concepts and gives the first a string field, links that field to the second, is told it's already linked
 *          when it repeats the call, makes an element whose field names an element of the second by
 *          tapestry:<tapestryKey>, is refused one whose field holds that element's name, adds an element to the second
 *          concept and then names it, takes the link back, and is refused a firmware concept's property")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0019-enumerate-and-unenumerate.md (Decisions 2, 5,
 *          6, 8 and 10)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/19-enumerate.test-plan.md
 *   Model: test/operations/graph/move-element-agent-through-cli.test.js
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph seeded by
 * test/helpers/propertyGraph.js, with a property of firmware word's given by test/helpers/enumerationGraph.js; the
 * agent is clients/cli/bin/tapestry.js, holding an admin's own key. The plan's live check runs the same steps on a
 * scratch stack.
 *
 *   XN1 the agent makes robot and venture, gives robot a venture field, links it to venture, repeats the link
 *       (already-enumerated), makes Robo One naming Moonshot by tapestry:<key>, is refused Robo Two naming it by name,
 *       adds Second Venture and names it, takes the link back, is refused word's property, and reads the property's
 *       history back, each entry its own
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const P = require('../../helpers/propertyGraph');
const EG = require('../../helpers/enumerationGraph');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent links a property to another concept through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/enumerate.js');
const UNDECL = path.join(ROOT, 'src/operations/catalog/graph/unenumerate.js');
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('enumerate-agent-');
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
    const home = tmp('enumerate-agent-home-');
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
  if (!fs.existsSync(file)) throw new Error(`src/operations/catalog/graph/${name}.js does not exist yet (ADR graph-operations-first-slice/0019 ${decision}): the external CLI exited ${r.code}: ${String(r.stderr || r.stdout).trim().split(NL)[0]}`);
}

test('XN1 [AC7]: the agent links a field to another concept, repeats it, names an element by its key, is refused a name, follows the source, takes the link back, is refused firmware\'s property, and reads the history back', async () => {
  const owner = makeKey();
  const admin = makeKey();
  const seed = await P.seedProperties();
  const spelling = EG.firmwareProperty(seed.state);
  const file = seed.file(tmp('enumerate-agent-graph-'));
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('enumerate-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const mine = (body) => body && body.success && body.data.change && body.data.change.by.role === 'admin' && body.data.change.by.pubkey === admin.pubkey;
  const step = async (what, args) => {
    const r = await cli(args, env);
    assert(r.code === 0, `the agent's ${what} must succeed; ${said(r)}`);
    return json(r.stdout).data;
  };

  const robot = (await step('create-concept of robot', ['graph', 'create-concept', '--name', 'robot'])).concept.conceptHeader;
  const venture = (await step('create-concept of venture', ['graph', 'create-concept', '--name', 'venture'])).concept.conceptHeader;
  const field = (await step('add-property', ['graph', 'add-property', '--concept', robot, '--name', 'venture', '--type', 'string'])).property.property;
  const moonshot = (await step('create-element of Moonshot', ['graph', 'create-element', '--concept', venture, '--name', 'Moonshot', '--fields', '{"description":"the first venture"}'])).element.tapestryKey;

  const linked = await cli(['graph', 'enumerate', '--property', field, '--source', venture], env);
  needDecl(linked, DECL, 'enumerate', 'Decision 2');
  const l = json(linked.stdout);
  assert(linked.code === 0 && mine(l) && l.data.outcome === 'enumerated' && l.data.source.concept === venture, `linked robot's venture to venture, recorded as the agent's own; ${said(linked)}`);
  assert(l.data.allowed.elements.some((e) => e.node === moonshot && e.name === 'Moonshot'), `the answer lists Moonshot among the values it may name, with its key and name; got ${show(l.data.allowed)}`);
  const sent = fs.readFileSync(inst.recordFile, 'utf8').split(NL).filter(Boolean).map(json).find((r) => r && r.path === '/api/tapestry/graph/enumerate');
  assert(sent && sent.body.property === field && sent.body.source === venture, `the CLI sent the two keys as it was given them: no change to the CLI; got ${show(sent && sent.body)}`);

  const again = await cli(['graph', 'enumerate', '--property', field, '--source', venture], env);
  const g = json(again.stdout);
  assert(again.code === 0 && g && g.data.outcome === 'already-enumerated' && g.data.change === null, `the same link again: already-enumerated, nothing recorded; ${said(again)}`);

  await step('create-element of Robo One', ['graph', 'create-element', '--concept', robot, '--name', 'Robo One', '--fields', JSON.stringify({ description: 'names its venture by key', venture: EG.ref(moonshot) })]);
  const byName = await cli(['graph', 'create-element', '--concept', robot, '--name', 'Robo Two', '--fields', JSON.stringify({ description: 'names its venture by name', venture: 'Moonshot' })], env);
  const n = json(byName.stdout);
  assert(byName.code === 1 && n && n.code === 'value-not-allowed' && /graph resolve/.test(String(n.error)), `a venture named by its name is refused value-not-allowed, naming graph resolve; ${said(byName)}`);

  const second = (await step('create-element of Second Venture', ['graph', 'create-element', '--concept', venture, '--name', 'Second Venture', '--fields', '{"description":"added after the link"}'])).element.tapestryKey;
  await step('create-element of Robo Three', ['graph', 'create-element', '--concept', robot, '--name', 'Robo Three', '--fields', JSON.stringify({ description: 'names the new venture', venture: EG.ref(second) })]);

  const back = await cli(['graph', 'unenumerate', '--property', field], env);
  needDecl(back, UNDECL, 'unenumerate', 'Decision 5');
  const b = json(back.stdout);
  assert(back.code === 0 && mine(b) && b.data.outcome === 'unenumerated' && b.data.removed === 1, `took the link back, recorded as the agent's own; ${said(back)}`);
  assert(EG.linksInto(S.readState(file), field).length === 0, 'no link is left into the field');

  const fw = await cli(['graph', 'enumerate', '--property', spelling, '--source', venture], env);
  const f = json(fw.stdout);
  assert(fw.code === 1 && f && f.code === 'firmware-concept', `firmware word's property is refused firmware-concept; ${said(fw)}`);

  const hist = await cli(['graph', 'history', '--node', field], env);
  const h = json(hist.stdout);
  const ops = h && h.success ? h.data.entries.map((e) => e.operation) : null;
  assert(show(ops) === show(['graph unenumerate', 'graph enumerate', 'graph add-property']), `history for the field, newest first: the link taken back, made, and the field added; nothing for the repeat or the refusals; got ${show(h).slice(0, 500)}`);
  assert(h.data.entries.every((e) => e.by.role === 'admin' && e.by.pubkey === admin.pubkey), 'each entry is the agent\'s own');
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
