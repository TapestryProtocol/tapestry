'use strict';
/**
 * An admin agent changes a concept's properties through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/18-property-operations.md (AC9's last sentence: "An
 *          admin agent with its own key adds, updates and removes a property, and sets a concept's schema, through the
 *          external CLI (A10.6), with no change to the CLI")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0018-property-operations.md (Decisions 7, 12, 14)
 *   Model: test/operations/graph/concepts-agent-through-cli.test.js
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph seeded by
 * test/helpers/propertyGraph.js; the agent is clients/cli/bin/tapestry.js, holding an admin's own key.
 *
 *   X18  the agent creates kettle, adds volume, updates its description, sets the schema with brand added, removes
 *        volume, and reads the concept's history back, newest first, each entry recorded as its own
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const P = require('../../helpers/propertyGraph');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent changes properties through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('properties-agent-');
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
    const home = tmp('properties-agent-home-');
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

test('X18: the agent adds, updates and removes a property and sets a schema, and reads the concept\'s history back, each entry its own', async () => {
  P.needDecls(['add-property', 'update-property', 'remove-property', 'set-schema']);
  const owner = makeKey();
  const admin = makeKey();
  const seed = await P.seedProperties();
  const file = seed.file(tmp('properties-agent-graph-'));
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('properties-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const mine = (body) => body && body.success && body.data.change && body.data.change.by.role === 'admin' && body.data.change.by.pubkey === admin.pubkey;
  const step = async (what, args) => {
    const r = await cli(args, env);
    assert(r.code === 0, `the agent's ${what} must succeed; ${said(r)}`);
    const body = json(r.stdout);
    assert(mine(body), `the agent's ${what} is recorded as its own; got ${show(body)}`);
    return body.data;
  };

  const made = await step('create-concept', ['graph', 'create-concept', '--name', 'kettle']);
  const header = made.concept.conceptHeader;
  const volume = await step('add-property', ['graph', 'add-property', '--concept', header, '--name', 'volume', '--type', 'number']);
  assert(volume.outcome === 'added' && volume.property.field === 'volume', `added volume; got ${show(volume)}`);
  const updated = await step('update-property', ['graph', 'update-property', '--property', volume.property.property, '--description', 'Litres it holds']);
  assert(updated.outcome === 'updated' && updated.property.description === 'Litres it holds', `updated its description; got ${show(updated)}`);
  const schema = P.copy(P.schemaDoc(S.readState(file), header));
  schema.properties.kettle.properties.brand = { type: 'string' };
  const set = await step('set-schema', ['graph', 'set-schema', '--concept', header, '--schema', JSON.stringify(schema)]);
  assert(set.outcome === 'set' && set.added.map((x) => x.field).join() === 'brand', `set the schema, brand added; got ${show(set)}`);
  const removed = await step('remove-property', ['graph', 'remove-property', '--property', volume.property.property]);
  assert(removed.outcome === 'removed' && removed.removed[0].property === volume.property.property, `removed volume; got ${show(removed)}`);
  const doc = P.schemaDoc(S.readState(file), header);
  assert(doc.properties.kettle.properties.brand && !doc.properties.kettle.properties.volume, 'the graph\'s schema has brand and no volume');

  const hist = await cli(['graph', 'history', '--node', header], env);
  assert(hist.code === 0, `the agent's history must succeed; ${said(hist)}`);
  const h = json(hist.stdout);
  const ops = h && h.success ? h.data.entries.map((e) => e.operation) : null;
  assert(show(ops) === show(['graph remove-property', 'graph set-schema', 'graph update-property', 'graph add-property', 'graph create-concept']),
    `history for the concept: each write, newest first; got ${show(ops)}`);
  assert(h.data.entries.every((e) => e.by.role === 'admin' && e.by.pubkey === admin.pubkey), 'each is recorded as the agent\'s');
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
