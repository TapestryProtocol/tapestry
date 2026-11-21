'use strict';
/**
 * An admin agent declares a concept shared, wires another to it, and exports both, through the external CLI — run by
 * test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/48-declare-a-concept-shared.md (AC5's last part: "An
 *          agent, through the external CLI, declares a concept shared and exports it to a stack's own relay, and the
 *          letter read back from that relay carries the self-pointing b")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0048-declare-shared-wire-to-shared-defer-sharing.md
 *          (Decisions 1, 2, 7 and 9; Implementation notes, the live check, which is this sequence on a scratch stack)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/48-declare-a-concept-shared.test-plan.md (XS1)
 *   Model: test/operations/export/nostr-agent-through-cli.test.js
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph holding only
 * firmware (test/helpers/exportFixtures.js's firmwareOnly) on the Cypher engine, with the fake relays, DNS and strfry
 * import of test/helpers/relayFake.js and the assistant's key. The agent is clients/cli/bin/tapestry.js, holding an
 * admin's own key, with no change to it.
 *
 *   XS1 the agent makes toy and game, each with an element; declares toy shared; wires game to toy (held); is refused a
 *       target that isn't an address; dry-runs toy's export (its header new, nothing sent); exports both to the own
 *       relay; and the letters read back from it by id carry toy's self-pointing b, game's b naming toy, and the stamp
 *       for toy on game's element; graph history has the declaration as the agent's; the CLI sent what it was given
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const X = require('../../helpers/exportFixtures');
const F = require('../../helpers/importFixtures');
const R = require('../../helpers/relayFake');
const H = require('../../helpers/sharingGraph');
const CG = require('../../helpers/cypherGraphFake');

const { ROOT, NL, assert, tmp } = S;
const show = (x) => String(S.show(x));
const { test, run } = S.makeSuite('operations: an admin agent declares a concept shared and exports it through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const NT = X.NT;

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile, relayFile) {
  const dir = tmp('shared-concepts-agent-');
  const recordFile = path.join(dir, 'requests.jsonl');
  fs.writeFileSync(recordFile, '');
  const specFile = path.join(dir, 'spec.json');
  fs.writeFileSync(specFile, JSON.stringify({
    root: ROOT, catalogDir: path.join(ROOT, 'src/operations/catalog'), recordFile, graphFakeState: stateFile, graphFakeEngine: 'cypher',
    relayFake: relayFile, strfry: relayFile, assistantKeys: { privkey: X.TA_SECRET },
  }));
  const env = { ...S.childEnv(dir), TA_PUBKEY: X.TA, BRAINSTORM_PUBLISH_LOCAL_ONLY: 'false' };
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
    const home = tmp('shared-concepts-agent-home-');
    const child = spawn(process.execPath, [BIN, ...args], { cwd: home, env: { PATH: process.env.PATH, HOME: home, TAPESTRY_HOME: path.join(home, 'tapestry-home'), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 60000);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}
const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
const said = (r) => `exit ${r.code}; stdout ${show(String(r.stdout).slice(-400))}; stderr ${show(String(r.stderr).slice(-300))}`;

test('XS1 [AC5]: the agent declares toy shared and wires game to it, is refused a bad target, dry-runs and exports both, and the letters read back carry the b\'s and the stamp', async () => {
  H.needDecls();
  X.needDecl();
  const owner = makeKey();
  const admin = makeKey();
  const fw = X.firmwareOnly();
  const dir = tmp('shared-concepts-agent-graph-');
  const stateFile = path.join(dir, 'graph.json');
  CG.writeState(stateFile, fw.state);
  const relayFile = R.writeFixture(path.join(dir, 'relays.json'), { relays: { [X.OWN_RELAY]: F.relay(fw.ownEvents) }, dns: X.DNS, strfry: { mode: 'ok' } });
  const inst = await startInstance(owner, admin, stateFile, relayFile);
  const keyFile = path.join(tmp('shared-concepts-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const ok = async (what, args) => {
    const r = await cli(args, env);
    const body = json(r.stdout);
    assert(r.code === 0 && body && body.success === true, `the agent's ${what} must succeed; ${said(r)}`);
    return body.data;
  };

  // 1. Two concepts, each with an element, made with the graph operations.
  const toy = (await ok('graph create-concept (toy)', ['graph', 'create-concept', '--name', 'toy', '--plural', 'toys'])).concept;
  const game = (await ok('graph create-concept (game)', ['graph', 'create-concept', '--name', 'game', '--plural', 'games'])).concept;
  await ok('graph create-element (Duck)', ['graph', 'create-element', '--concept', toy.conceptHeader, '--name', 'Duck', '--fields', '{"description": "a yellow duck"}']);
  const chess = (await ok('graph create-element (Chess)', ['graph', 'create-element', '--concept', game.conceptHeader, '--name', 'Chess', '--fields', '{"description": "a board game"}'])).element.tapestryKey;
  const toyAddress = toy.address;
  assert(toyAddress === `39998:${X.TA}:toy`, `toy is at the assistant's address; got ${toyAddress}`);

  // 2. The declaration and the wiring, each the agent's.
  const declared = await ok('graph declare-shared', ['graph', 'declare-shared', '--concept', toy.conceptHeader]);
  assert(declared.outcome === 'declared' && declared.change && declared.change.by.role === 'admin' && declared.change.by.pubkey === admin.pubkey, `toy is declared, the entry the agent's; got ${show(declared).slice(0, 400)}`);
  const wired = await ok('graph wire-to-shared', ['graph', 'wire-to-shared', '--concept', game.conceptHeader, '--target', toyAddress]);
  assert(wired.outcome === 'wired' && wired.target && wired.target.held === true && wired.target.node === toy.conceptHeader, `game is wired to toy, which the graph holds; got ${show(wired).slice(0, 400)}`);
  const bad = await cli(['graph', 'wire-to-shared', '--concept', game.conceptHeader, '--target', 'not an address'], env);
  const bb = json(bad.stdout);
  assert(bad.code === 1 && bb && bb.code === 'bad-target', `a target that isn't a concept header's address is refused bad-target; ${said(bad)}`);
  assert(R.storedAt(relayFile, X.OWN_RELAY).every((e) => X.addressOf(e) !== toyAddress && X.addressOf(e) !== game.address), 'the writes sent nothing: the own relay holds no letter at toy\'s or game\'s address');

  // 3. The dry run, then the exports to the stack's own relay.
  const dry = await ok('dry run', ['export', 'nostr', '--graph', toy.nodes.conceptGraph, '--dryRun']);
  const dl = X.letterFor(dry, toy.conceptHeader);
  assert(dl && dl.outcome === 'new', `the dry run lists toy's header new; got ${show(dl)}`);
  const sentToy = await ok('export of toy', ['export', 'nostr', '--graph', toy.nodes.conceptGraph]);
  const sentGame = await ok('export of game', ['export', 'nostr', '--graph', game.nodes.conceptGraph]);
  const store = R.storedAt(relayFile, X.OWN_RELAY);
  const back = (d, key) => {
    const l = X.letterFor(d, key);
    assert(l && (X.relayOf(l, 'own') || {}).status === 'accepted', `the own relay accepted the letter for ${key}; got ${show(l)}`);
    const e = store.find((x) => x.id === l.id);
    assert(e && NT.verifyEvent(X.copy(e)) && e.pubkey === X.TA, `the letter read back from the own relay by its id, ${l.id}, is the assistant's and verifies`);
    return e;
  };
  const toyLetter = back(sentToy, toy.conceptHeader);
  assert(toyLetter.tags.filter((t) => t[0] === 'b').length === 1 && toyLetter.tags.some((t) => show(t) === show(['b', toyAddress, 'pointer'])), `toy's letter carries its self-pointing b, once; got ${show(toyLetter.tags.filter((t) => t[0] === 'b'))}`);
  const gameLetter = back(sentGame, game.conceptHeader);
  assert(gameLetter.tags.some((t) => show(t) === show(['b', toyAddress, 'pointer'])), `game's letter carries its b naming toy; got ${show(gameLetter.tags.filter((t) => t[0] === 'b'))}`);
  const chessLetter = back(sentGame, chess);
  const z = chessLetter.tags.filter((t) => t[0] === 'z').map((t) => t[1]);
  assert(z.includes(game.address) && z.filter((x) => x === toyAddress).length === 1, `Chess, game's element, is stamped for toy, the concept game is wired to; got ${show(z)}`);

  // 4. The agent's record, and what the CLI sent.
  const history = await cli(['graph', 'history', '--node', toy.conceptHeader], env);
  const hb = json(history.stdout);
  assert(history.code === 0 && hb && hb.data.entries.some((e) => e.operation === 'graph declare-shared' && e.by.role === 'admin' && e.by.pubkey === admin.pubkey), `toy's history holds the agent's declaration; got ${show(hb).slice(0, 400)}`);
  const bodies = fs.readFileSync(inst.recordFile, 'utf8').split(NL).filter(Boolean).map(json).filter(Boolean);
  const decl = bodies.filter((x) => x.path === '/api/tapestry/graph/declare-shared').map((x) => x.body);
  const wire = bodies.filter((x) => x.path === '/api/tapestry/graph/wire-to-shared').map((x) => x.body);
  assert(decl.some((b) => show(b) === show({ concept: toy.conceptHeader })) && wire.some((b) => b.concept === game.conceptHeader && b.target === toyAddress), `the CLI sent each input as the agent gave it; got ${show({ decl, wire })}`);
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
