'use strict';
/**
 * An admin agent exports a concept to nostr through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/34-export-nostr.md (AC7's last part: "an admin agent with
 *          its own key, through the external CLI (A10.6) and with no change to it: makes a concept with the graph
 *          operations, with a set, two elements and a tapestry: link between them, and dry-runs its export, seeing every
 *          letter new; exports it to the stack's own relay, and to one outside relay …; changes one element with graph
 *          update-node, and sees a dry run list only that element as changed; exports again, and sees only that element
 *          signed; imports the letters back with import nostr, and finds the graph unchanged; is refused a relay on a
 *          private address")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0034-export-nostr.md (Decisions 1, 5, 6 and 10)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/34-export-nostr.test-plan.md (EA1; LH1 is the same
 *          sequence by hand on a scratch stack, to an outside relay the owner chooses)
 *   Model: test/operations/import/nostr-agent-through-cli.test.js
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph holding only
 * firmware (test/helpers/exportFixtures.js's firmwareOnly) on the Cypher engine, with the fake relays, DNS and strfry
 * import of test/helpers/relayFake.js and the assistant's key (KEYS.ta, the server's TA_PUBKEY). The agent is
 * clients/cli/bin/tapestry.js, holding an admin's own key. accepts.example.com stands for the outside relay.
 *
 *   EA1 the agent makes a concept, a set and two elements, one linking to the other; dry-runs the export (every letter
 *       new); exports to the own relay and to accepts.example.com (each accepted, the link sent as an naddr); changes an
 *       element with graph update-node (letterOutOfDate) and dry-runs (only it changed); exports (only it signed again);
 *       imports the letters back with import nostr (each own, the graph unchanged); is refused a private relay; and the
 *       CLI sent what it was given, unchanged
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const X = require('../../helpers/exportFixtures');
const F = require('../../helpers/importFixtures');
const R = require('../../helpers/relayFake');
const CG = require('../../helpers/cypherGraphFake');

const { ROOT, NL, assert, tmp } = S;
const show = (x) => String(S.show(x));
const { test, run } = S.makeSuite('operations: an admin agent exports a concept to nostr through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const NT = X.NT;
const ACCEPTS = X.URL_OF('accepts');

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile, relayFile) {
  const dir = tmp('export-nostr-agent-');
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
    const home = tmp('export-nostr-agent-home-');
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

test('EA1 [AC7]: the agent makes a concept with a link, dry-runs and exports it, changes an element and exports again, imports the letters back unchanged, and is refused a private relay', async () => {
  X.needDecl();
  const owner = makeKey();
  const admin = makeKey();
  const fw = X.firmwareOnly();
  const dir = tmp('export-nostr-agent-graph-');
  const stateFile = path.join(dir, 'graph.json');
  CG.writeState(stateFile, fw.state);
  const relayFile = R.writeFixture(path.join(dir, 'relays.json'), { relays: { [X.OWN_RELAY]: F.relay(fw.ownEvents), [ACCEPTS]: F.relay([]) }, dns: X.DNS, strfry: { mode: 'ok' } });
  const inst = await startInstance(owner, admin, stateFile, relayFile);
  const keyFile = path.join(tmp('export-nostr-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const ok = async (what, args) => {
    const r = await cli(args, env);
    const body = json(r.stdout);
    assert(r.code === 0 && body && body.success === true, `the agent's ${what} must succeed; ${said(r)}`);
    return body.data;
  };

  // 1. A concept made with the graph operations: a set, two elements, a tapestry: link from one to the other.
  const concept = (await ok('graph create-concept', ['graph', 'create-concept', '--name', 'toy', '--plural', 'toys'])).concept;
  const set = (await ok('graph create-set', ['graph', 'create-set', '--parent', concept.nodes.superset, '--name', 'Bath Toys'])).set.tapestryKey;
  const duck = (await ok('graph create-element (Duck)', ['graph', 'create-element', '--concept', concept.conceptHeader, '--name', 'Duck', '--set', set, '--fields', '{"description": "a yellow duck"}'])).element.tapestryKey;
  const boat = (await ok('graph create-element (Boat)', ['graph', 'create-element', '--concept', concept.conceptHeader, '--name', 'Boat', '--fields', JSON.stringify({ description: `it floats beside [the duck](tapestry:${duck})` })])).element.tapestryKey;
  const cg = concept.nodes.conceptGraph;

  const dry = await ok('dry run', ['export', 'nostr', '--graph', cg, '--dryRun']);
  const letters = X.lettersOf(dry);
  const keys = letters.map(X.keyOf);
  assert(letters.length >= 11 && [duck, boat, set, concept.conceptHeader].every((k) => keys.includes(k)) && letters.every((l) => l.outcome === 'new'), `the dry run lists every letter new: the eight core nodes, the set and the two elements; got ${show(letters.map((l) => [X.keyOf(l), l.outcome]))}`);
  assert(R.storedAt(relayFile, X.OWN_RELAY).length === 0, 'and sent nothing');

  // 2. The export, to the own relay and the outside one.
  const sent = await ok('export', ['export', 'nostr', '--graph', cg, '--relays', ACCEPTS]);
  assert(X.lettersOf(sent).every((l) => (X.relayOf(l, 'own') || {}).status === 'accepted' && (X.relayOf(l, ACCEPTS) || {}).status === 'accepted'), `each letter accepted by the own relay and the outside one; got ${show(X.lettersOf(sent).map((l) => l.relays))}`);
  const boatLetter = R.storedAt(relayFile, ACCEPTS).find((e) => e.id === (X.letterFor(sent, boat) || {}).id);
  const boatText = boatLetter && X.letterJson(boatLetter).toy.description;
  assert(boatText && /\[the duck\]\(nostr:naddr1/.test(boatText) && !X.strings(boatLetter).some((s) => s.includes('tapestry:')), `the link went out as the duck's naddr; got ${show(boatText)}`);

  // 3. A change, and the dry run that sees only it.
  const updated = await ok('graph update-node', ['graph', 'update-node', '--node', duck, '--fields', '{"description": "a red duck"}']);
  assert(updated.letterOutOfDate === true, `the duck has a letter now, so the change answers letterOutOfDate; got ${show(updated).slice(0, 300)}`);
  const dry2 = await ok('dry run again', ['export', 'nostr', '--graph', cg, '--dryRun']);
  const changed = X.lettersOf(dry2).filter((l) => l.outcome !== 'unchanged');
  assert(changed.length === 1 && X.keyOf(changed[0]) === duck && changed[0].outcome === 'changed', `the dry run lists only the duck, changed; got ${show(changed.map((l) => [X.keyOf(l), l.outcome]))}`);

  // 4. The export again: only the duck signed.
  const again = await ok('export again', ['export', 'nostr', '--graph', cg]);
  const signed = X.lettersOf(again).filter((l) => l.outcome !== 'unchanged');
  assert(signed.length === 1 && X.keyOf(signed[0]) === duck && R.storedAt(relayFile, X.OWN_RELAY).some((e) => e.id === signed[0].id), `only the duck is signed and sent again; got ${show(X.lettersOf(again).map((l) => [X.keyOf(l), l.outcome]))}`);

  // 5. The letters back, with import nostr: each own, the graph as it was.
  const before = CG.readState(stateFile);
  const addresses = keys.map((k) => X.nodeByKey(before, k).props.uuid);
  const back = await ok('import nostr', ['import', 'nostr', ...addresses.flatMap((a) => ['--addresses', a])]);
  assert(back.events.length === addresses.length && back.events.every((e) => e.outcome === 'own') && back.changes === 0, `each letter comes back own, recording nothing; got ${show(back.events.map((e) => e.outcome))}`);
  assert(F.sameGraph(before, CG.readState(stateFile)), `and the graph is as it was; differs ${show(F.graphDiff(before, CG.readState(stateFile)))}`);

  // 6. A relay on a private address.
  const priv = await cli(['export', 'nostr', '--graph', cg, '--relays', 'ws://10.0.0.1'], env);
  const pb = json(priv.stdout);
  assert(priv.code === 1 && pb && pb.code === 'private-relay', `refused private-relay; ${said(priv)}`);

  // The CLI sent each input as the agent gave it, typed as the instance's text checker types it: no change to the CLI.
  const bodies = fs.readFileSync(inst.recordFile, 'utf8').split(NL).filter(Boolean).map(json).filter((x) => x && x.path === X.ROUTE).map((x) => x.body);
  assert(bodies.some((b) => b.dryRun === true && b.graph === cg) && bodies.some((b) => show(b.relays) === show([ACCEPTS])), `--dryRun went as true and --relays as a list of one; got ${show(bodies)}`);
  const history = await cli(['graph', 'history', '--node', duck], env);
  const hb = json(history.stdout);
  assert(history.code === 0 && hb.data.entries.some((e) => e.operation === 'export nostr' && e.by.role === 'admin' && e.by.pubkey === admin.pubkey), `the duck's history has the agent's exports, its own; got ${show(hb).slice(0, 400)}`);
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
