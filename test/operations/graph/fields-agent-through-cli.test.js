'use strict';
/**
 * An admin agent marks, maps and unmarks a field through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-foundation/5-field-mapping.md (AC8, "An agent": through the external
 *          CLI, A10.6, with no change to the CLI)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0005-field-mapping.md (Decisions 7–9, 12)
 *   Model: test/operations/graph/agent-through-cli.test.js (story 4's X1)
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph seeded by
 * test/helpers/fieldGraph.js; the agent is clients/cli/bin/tapestry.js, holding an admin's own key. Between the mark and
 * the map, the test changes rover's JSON in the graph, as today's routes would (they apply no mapping, D15).
 *
 *   X2 the agent marks dog's breed, maps dog after rover's breed changed, and unmarks breed; history for rover reads
 *      the three entries back, newest first, each recorded as the agent's own
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const FG = require('../../helpers/fieldGraph');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent maps fields through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));
const DECLS = ['mark-field', 'unmark-field', 'map-fields'].map((n) => path.join(ROOT, `src/operations/catalog/graph/${n}.js`));

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('fields-agent-');
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
    const home = tmp('fields-agent-home-');
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

/** Change an element's json tag in the state file, as one of today's routes would. */
function rewriteJson(file, key, json) {
  const s = S.readState(file);
  const node = s.nodes.find((n) => n.props.tapestryKey === key);
  const tag = s.rels.filter((r) => r.from === node.eid && r.type === 'HAS_TAG').map((r) => s.nodes.find((n) => n.eid === r.to)).find((n) => n.props.type === 'json');
  tag.props.value = JSON.stringify(json);
  require('../../helpers/graphFake').writeState(file, s);
}

test('X2: the agent marks dog\'s breed, maps dog after rover changed, and unmarks breed, each recorded as its own', async () => {
  const missing = DECLS.find((f) => !fs.existsSync(f));
  if (missing) throw new Error(`${path.relative(ROOT, missing)} does not exist yet (ADR graph-operations-foundation/0005 Decisions 7–9)`);
  const owner = makeKey();
  const admin = makeKey();
  const seed = FG.seedFields();
  const file = seed.file(tmp('fields-agent-graph-'));
  const k = seed.keys;
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('fields-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const mine = (body) => body && body.success && body.data.change && body.data.change.by.role === 'admin' && body.data.change.by.pubkey === admin.pubkey;

  const mark = await cli(['graph', 'mark-field', '--concept', k.dog, '--field', 'breed'], env);
  assert(mark.code === 0, `the agent's mark must succeed; ${said(mark)}`);
  const m = json(mark.stdout);
  assert(mine(m) && m.data.outcome === 'marked' && m.data.mark.property === 'dog_breed', `marked, recorded as the agent's own; got ${show(m)}`);
  assert(FG.copiesOn(S.readState(file), k.rover, 'dog_').dog_breed === 'goldenRetriever', 'rover carries dog_breed');

  rewriteJson(file, k.rover, { word: { slug: 'dog--rover' }, dog: { ...FG.DOG_ELEMENTS.rover, breed: 'irishSetter' } });
  const map = await cli(['graph', 'map-fields', '--concept', k.dog], env);
  assert(map.code === 0, `the agent's map must succeed; ${said(map)}`);
  const p = json(map.stdout);
  assert(mine(p) && FG.copiesOn(S.readState(file), k.rover, 'dog_').dog_breed === 'irishSetter', `mapped: rover's copy follows its JSON, recorded as the agent's; got ${show(p)}`);

  const unmark = await cli(['graph', 'unmark-field', '--concept', k.dog, '--field', 'breed'], env);
  assert(unmark.code === 0, `the agent's unmark must succeed; ${said(unmark)}`);
  const u = json(unmark.stdout);
  assert(mine(u) && u.data.outcome === 'unmarked', `unmarked; got ${show(u)}`);

  const hist = await cli(['graph', 'history', '--node', k.rover], env);
  assert(hist.code === 0, `the agent's history must succeed; ${said(hist)}`);
  const h = json(hist.stdout);
  const ops = h && h.success ? h.data.entries.map((e) => e.operation) : null;
  assert(show(ops) === show(['graph unmark-field', 'graph map-fields', 'graph mark-field']), `history for rover: the unmark, the map, the mark, newest first; got ${show(h)}`);
  assert(h.data.entries.every((e) => e.by.role === 'admin' && e.by.pubkey === admin.pubkey), 'each is recorded as the agent\'s');
  const g = S.readState(file);
  assert(!FG.marksIn(g).includes(k.dogProp.breed) && !('dog_breed' in FG.copiesOn(g, k.rover, 'dog_')), 'the graph holds no mark and no copy afterwards');
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
