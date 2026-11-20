'use strict';
/**
 * An admin agent installs and updates the firmware through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/37-seed-firmware.md (AC7, "The live check": an admin
 *          agent with its own key, through the external CLI and with no change to it, "installs the firmware on an
 *          instance that has none, and finds its concepts; runs it again, and is told nothing changed; after a firmware
 *          node is edited and the firmware the instance carries changes, runs it again, and is told which nodes it kept
 *          and which it changed"; Loom's done: "an agent has used it through the external CLI")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0037-seed-firmware.md (Decisions 1, 7 and 11)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/37-seed-firmware.test-plan.md
 *   Model: test/operations/import/nostr-agent-through-cli.test.js
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over the graph
 * test/helpers/cypherGraphFake.js keeps, lifecycle's system faked (spec.lifecycleFakeState) and TAPESTRY_FIRMWARE_DIR
 * naming a copy of firmware/active; the agent is clients/cli/bin/tapestry.js, holding an admin's own key. The edit is
 * made to the graph's file between calls, as a raw query would make it; the firmware change, to the copy's file.
 *
 *   SA1 the agent installs, finds a concept by its address, is told the repeat changed nothing; after an edit and a
 *       firmware change it is told which node was kept (and why) and which changed; it takes the kept one; the CLI sent
 *       what it was given; the history is the agent's own
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const F = require('../../helpers/seedFirmwareFixtures');
const LF = require('../../helpers/lifecycleFakes');
const CG = require('../../helpers/cypherGraphFake');

const { ROOT, NL, assert, show, tmp } = S;
const { TA } = F;
const { test, run } = S.makeSuite('operations: an admin agent installs and updates the firmware through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));
const DCOSL = 'concepts/nostr-relay/elements/dcosl-brainstorm-world.json';

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile, firmwareDir) {
  const dir = tmp('seed-firmware-agent-');
  const recordFile = path.join(dir, 'requests.jsonl');
  fs.writeFileSync(recordFile, '');
  const lifecycleFile = path.join(dir, 'lifecycle.json');
  LF.newFakeState(lifecycleFile);
  const specFile = path.join(dir, 'spec.json');
  fs.writeFileSync(specFile, JSON.stringify({ root: ROOT, catalogDir: path.join(ROOT, 'src/operations/catalog'), recordFile, graphFakeState: stateFile, graphFakeEngine: 'cypher', lifecycleFakeState: lifecycleFile }));
  const env = F.envFor(dir, { firmwareDir });
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
    const home = tmp('seed-firmware-agent-home-');
    const child = spawn(process.execPath, [BIN, ...args], { cwd: home, env: { PATH: process.env.PATH, HOME: home, TAPESTRY_HOME: path.join(home, 'tapestry-home'), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 90000);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}
const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
const said = (r) => `exit ${r.code}; stdout ${show(String(r.stdout).slice(-400))}; stderr ${show(String(r.stderr).slice(-300))}`;

test('SA1 [AC7]: the agent installs, finds a concept, is told a repeat changed nothing; after an edit and a firmware change it is told what it kept and what it changed; it takes the kept node; its history is its own', async () => {
  F.needDecl();
  const owner = makeKey();
  const admin = makeKey();
  const o = await F.oracle();
  const dir = tmp('seed-firmware-agent-graph-');
  const stateFile = path.join(dir, 'graph.json');
  CG.writeState(stateFile, F.emptyGraph());
  const fw = F.copyFirmware({}, { label: 'seed-firmware-agent-fw-' });
  const inst = await startInstance(owner, admin, stateFile, fw);
  const keyFile = path.join(tmp('seed-firmware-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const ok = async (what, args) => {
    const r = await cli(args, env);
    const body = json(r.stdout);
    assert(r.code === 0 && body && body.success === true, `the agent's ${what} must succeed; ${said(r)}`);
    return body.data;
  };

  // 1. An instance with no firmware: the agent installs it, and finds a concept by its address.
  const first = await ok('install', ['lifecycle', 'seed-firmware']);
  assert(F.countOf(first, 'added') === 459, `the install adds the firmware's 459 nodes; got ${show(first.counts)}`);
  const found = await ok('resolve', ['graph', 'resolve', '--ref', `39998:${TA}:dog`]);
  assert((found.candidates || []).some((c) => c.address === `39998:${TA}:dog`), `the agent finds dog's header by its address; got ${show(found).slice(0, 300)}`);

  // 2. Again: nothing changed.
  const again = await ok('repeat', ['lifecycle', 'seed-firmware']);
  assert(F.countOf(again, 'unchanged') === 459 && again.change === null, `told nothing changed; got ${show({ counts: again.counts, change: again.change })}`);

  // 3. A firmware node edited (dog's header, as a raw query edits it), and the firmware the instance carries changed.
  const s = CG.readState(stateFile);
  for (const t of F.relsOf(s, { type: 'HAS_TAG', from: o.headerOf('dog') }).map((r) => r.toNode).filter((x) => x.props.type === 'json')) {
    const j = JSON.parse(t.props.value);
    j.conceptHeader.description = 'Dogs, as the agent\'s owner describes them.';
    t.props.value = JSON.stringify(j);
  }
  CG.writeState(stateFile, s);
  F.applyChanges(fw, { [DCOSL]: (j) => ({ ...j, nostrRelay: { ...j.nostrRelay, note: 'a newer firmware' } }) });
  const upd = await ok('update', ['lifecycle', 'seed-firmware']);
  const by = F.entriesByAddress(upd);
  const kept = by.get(o.headerOf('dog'));
  assert(kept && kept.outcome === 'kept' && F.partsOf(kept).has('json'), `told dog's header was kept, naming its JSON; got ${show(kept)}`);
  assert(by.get(o.elementOf(DCOSL)) && by.get(o.elementOf(DCOSL)).outcome === 'changed', `told dcosl-brainstorm-world was changed; got ${show(by.get(o.elementOf(DCOSL)))}`);

  // 4. The agent takes the kept node anyway.
  const dogKey = F.nodesAt(CG.readState(stateFile), o.headerOf('dog'))[0].props.tapestryKey;
  const took = await ok('take', ['lifecycle', 'seed-firmware', '--take', dogKey]);
  assert(F.entriesByAddress(took).get(o.headerOf('dog')).outcome === 'changed', `the taken node is changed; got ${show(took.counts)}`);

  // The CLI sent each input as the agent gave it: no change to the CLI.
  const sent = fs.readFileSync(inst.recordFile, 'utf8').split(NL).filter(Boolean).map(json).filter((x) => x && x.path === F.ROUTE);
  assert(sent.some((x) => show(x.body.take) === show([dogKey])), `--take went as a list of one; got ${show(sent.map((x) => x.body))}`);
  const history = await cli(['graph', 'history', '--node', dogKey], env);
  const hb = json(history.stdout);
  assert(history.code === 0 && hb.data.entries.length >= 2 && hb.data.entries.every((e) => e.operation === 'lifecycle seed-firmware' && e.by.role === 'admin' && e.by.pubkey === admin.pubkey), `the header's history is the agent's installs, its own; got ${show(hb).slice(0, 400)}`);
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
