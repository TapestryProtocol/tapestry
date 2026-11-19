'use strict';
/**
 * An admin agent moves an element through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/23-move-element.md (AC7's last sentence: an admin agent
 *          with its own key, through the external CLI (A10.6) and with no change to it, "moves an element create-element
 *          made from its concept's superset into a set, moves it again and is told it already moved, moves it on to a
 *          second set, and is refused sets of different concepts and a `from` that doesn't hold the node")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0023-move-element.md (Decisions 1, 2, 5, 9, 13)
 *   Model: test/operations/graph/memberships-agent-through-cli.test.js
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph seeded by
 * test/helpers/moveElementGraph.js; the agent is clients/cli/bin/tapestry.js, holding an admin's own key. The plan's
 * live check runs the same on a scratch stack.
 *
 *   XE1 the agent makes Snoopy with create-element in beagle's superset, files it into show beagles, files it again
 *       (already-moved), moves it on to agility beagles, is refused agility beagles to lap pets (different-concepts) and
 *       show beagles to the superset (not-in-from), and reads Snoopy's history back, each entry its own
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const C = require('../../helpers/conceptGraph');
const ME = require('../../helpers/moveElementGraph');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent moves an element through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));
const DECL = path.join(ROOT, 'src/operations/catalog/graph/move-element.js');

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('move-element-agent-');
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
    const home = tmp('move-element-agent-home-');
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
  if (!fs.existsSync(DECL)) throw new Error(`src/operations/catalog/graph/move-element.js does not exist yet (ADR graph-operations-first-slice/0023 Decision 1): the external CLI exited ${r.code}: ${String(r.stderr || r.stdout).trim().split(NL)[0]}`);
}

test('XE1 [AC7]: the agent files an element create-element made, repeats it, moves it on to a second set, is refused different concepts and a from that doesn\'t hold it, and reads the history back', async () => {
  const owner = makeKey();
  const admin = makeKey();
  const seed = await ME.seedMoveElement();
  const k = seed.keys;
  const file = seed.file(tmp('move-element-agent-graph-'));
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('move-element-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const mine = (body) => body && body.success && body.data.change && body.data.change.by.role === 'admin' && body.data.change.by.pubkey === admin.pubkey;
  const move = (from, to, node) => cli(['graph', 'move-element', '--node', node, '--from', from, '--to', to], env);

  const made = await cli(['graph', 'create-element', '--concept', k.beagle, '--name', 'Snoopy', '--fields', '{"description":"A beagle who flies."}'], env);
  assert(made.code === 0, `the agent's create-element must succeed first; ${said(made)}`);
  const snoopy = json(made.stdout).data.element.tapestryKey;
  const madeState = S.readState(file);
  assert(show(C.into(madeState, snoopy, 'HAS_ELEMENT')) === show([k.beagleSuperset]), `create-element put Snoopy directly under beagle's superset; got ${show(C.into(madeState, snoopy, 'HAS_ELEMENT'))}`);

  const filed = await move(k.beagleSuperset, k.showBeagles, snoopy);
  needDecl(filed);
  const f = json(filed.stdout);
  assert(filed.code === 0 && mine(f) && f.data.outcome === 'moved' && f.data.kept === 'json-tag', `filed into show beagles, recorded as the agent's own; ${said(filed)}`);
  const sent = fs.readFileSync(inst.recordFile, 'utf8').split(NL).filter(Boolean).map(json).find((r) => r && r.path === '/api/tapestry/graph/move-element');
  assert(sent && sent.body.node === snoopy && sent.body.from === k.beagleSuperset && sent.body.to === k.showBeagles, `the CLI sent the three keys as it was given them: no change to the CLI; got ${show(sent && sent.body)}`);

  const again = await move(k.beagleSuperset, k.showBeagles, snoopy);
  const g = json(again.stdout);
  assert(again.code === 0 && g && g.data.outcome === 'already-moved' && g.data.change === null, `the same move again: already-moved, nothing recorded; ${said(again)}`);

  const on = await move(k.showBeagles, k.agilityBeagles, snoopy);
  const o = json(on.stdout);
  assert(on.code === 0 && mine(o) && o.data.outcome === 'moved' && o.data.to === k.agilityBeagles, `moved on to agility beagles; ${said(on)}`);

  const other = await move(k.agilityBeagles, k.lapPets, snoopy);
  const d = json(other.stdout);
  assert(other.code === 1 && d && d.code === 'different-concepts' && d.input === 'to', `agility beagles and lap pets share no concept: different-concepts, naming to; ${said(other)}`);

  const gone = await move(k.showBeagles, k.beagleSuperset, snoopy);
  const n = json(gone.stdout);
  assert(gone.code === 1 && n && n.code === 'not-in-from' && n.input === 'from' && String(n.error).includes(k.agilityBeagles), `show beagles no longer holds Snoopy: not-in-from, naming agility beagles, where it is; ${said(gone)}`);

  const hist = await cli(['graph', 'history', '--node', snoopy], env);
  const h = json(hist.stdout);
  const ops = h && h.success ? h.data.entries.map((e) => e.operation) : null;
  assert(ops && show(ops) === show(['graph move-element', 'graph move-element', 'graph create-element']),
    `history for Snoopy, newest first: moved on, filed, made; nothing for the repeat or the refusals; got ${show(h).slice(0, 500)}`);
  assert(h.data.entries.every((e) => e.by.role === 'admin' && e.by.pubkey === admin.pubkey), 'each entry is the agent\'s own');
  const s = S.readState(file);
  const agilityUuid = C.node(s, k.agilityBeagles).props.uuid;
  assert(show(C.into(s, snoopy, 'HAS_ELEMENT')) === show([k.agilityBeagles]), `the graph holds Snoopy directly in agility beagles alone; got ${show(C.into(s, snoopy, 'HAS_ELEMENT'))}`);
  const ns = C.tags(s, snoopy).filter((t) => t.type === 'n').map((t) => t.value);
  assert(show(ns) === show([agilityUuid]), `its one n names agility beagles: its tags follow the moves (AC6); got ${show(ns)}`);
  assert(show(C.json(s, snoopy)) === show(C.json(madeState, snoopy)), 'and its JSON is as create-element made it');
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
