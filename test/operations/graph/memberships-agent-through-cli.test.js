'use strict';
/**
 * An admin agent adds memberships and takes them out through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.md (AC9's
 *          last sentence: an admin agent with its own key, through the external CLI and with no change to it, "adds an
 *          element create-element made to a second concept, adds it again and is told it already is one, puts it in a
 *          set, takes it out of the set, and takes it out of the second concept; adds a node from a peer's event to a
 *          concept, and finds the peer's letter unchanged; and is refused fields that don't fit, a membership the peer's
 *          event claims, and a node's last concept")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0022-add-to-concept-and-remove-from-concept.md
 *          (Decisions 1, 2, 7, 10, 12, 13)
 *   Model: test/operations/graph/update-node-agent-through-cli.test.js
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph seeded by
 * test/helpers/membershipGraph.js; the agent is clients/cli/bin/tapestry.js, holding an admin's own key. Its fields go
 * on the command line as JSON text, which the CLI sends as it came. The plan's live check runs the same on a scratch
 * stack.
 *
 *   XM1 the agent makes Snoopy with create-element, adds it to pet, adds it again (already-element), puts it in lap
 *       pets, takes it out of lap pets and then out of pet; files another author's Snowy under pet, its letter as it was;
 *       is refused fields that don't fit (invalid-fields), Snowy's membership of beagle, which Snowy's letter claims
 *       (author-claim), and Snoopy's last concept (last-concept); and reads Snoopy's history back, each entry its own
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const C = require('../../helpers/conceptGraph');
const MG = require('../../helpers/membershipGraph');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent adds and removes memberships through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));
const DECLS = ['add-to-concept', 'remove-from-concept'].map((n) => path.join(ROOT, `src/operations/catalog/graph/${n}.js`));

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('memberships-agent-');
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
    const home = tmp('memberships-agent-home-');
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
function needDecls(r) {
  const missing = DECLS.filter((f) => !fs.existsSync(f)).map((f) => path.relative(ROOT, f));
  if (missing.length) throw new Error(`${missing.join(' and ')} ${missing.length > 1 ? 'do' : 'does'} not exist yet (ADR graph-operations-first-slice/0022 Decision 1): the external CLI exited ${r.code}: ${String(r.stderr || r.stdout).trim().split(NL)[0]}`);
}

test('XM1 [AC9]: the agent adds, repeats, puts in a set and takes out; files another author\'s node beside their letter; is refused bad fields, the author\'s claim and the last concept; reads the history back', async () => {
  const owner = makeKey();
  const admin = makeKey();
  const seed = await MG.seedMemberships();
  const k = seed.keys;
  const file = seed.file(tmp('memberships-agent-graph-'));
  const before = S.readState(file);
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('memberships-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const mine = (body) => body && body.success && body.data.change && body.data.change.by.role === 'admin' && body.data.change.by.pubkey === admin.pubkey;

  const made = await cli(['graph', 'create-element', '--concept', k.beagle, '--name', 'Snoopy', '--fields', '{"description":"A beagle who flies."}'], env);
  assert(made.code === 0, `the agent's create-element must succeed first; ${said(made)}`);
  const snoopy = json(made.stdout).data.element.tapestryKey;

  const added = await cli(['graph', 'add-to-concept', '--node', snoopy, '--concept', k.pet, '--fields', '{"description":"a beagle, kept as a pet"}'], env);
  needDecls(added);
  assert(added.code === 0, `the agent's add-to-concept must succeed; ${said(added)}`);
  const a = json(added.stdout);
  assert(mine(a) && a.data.outcome === 'added' && a.data.kept === 'json-tag', `added to a second concept, recorded as the agent's own; got ${show(a).slice(0, 400)}`);
  const sent = fs.readFileSync(inst.recordFile, 'utf8').split(NL).filter(Boolean).map(json).find((r) => r && r.path === '/api/tapestry/graph/add-to-concept');
  assert(sent && typeof sent.body.fields === 'string', `the CLI sent fields as the JSON text it was given: no change to the CLI; got ${show(sent && sent.body)}`);

  const again = await cli(['graph', 'add-to-concept', '--node', snoopy, '--concept', k.pet, '--fields', '{"description":"a beagle, kept as a pet"}'], env);
  const g = json(again.stdout);
  assert(again.code === 0 && g && g.data.outcome === 'already-element' && g.data.change === null, `the same add again: already-element, nothing recorded; ${said(again)}`);

  const inSet = await cli(['graph', 'add-to-concept', '--node', snoopy, '--concept', k.pet, '--set', k.lapPets], env);
  const s = json(inSet.stdout);
  assert(inSet.code === 0 && mine(s) && s.data.outcome === 'added', `put in lap pets, a set of pet's; ${said(inSet)}`);

  const outOfSet = await cli(['graph', 'remove-from-concept', '--node', snoopy, '--concept', k.pet, '--set', k.lapPets], env);
  const o = json(outOfSet.stdout);
  assert(outOfSet.code === 0 && mine(o) && o.data.outcome === 'removed' && Array.isArray(o.data.left) && o.data.left.length === 0, `taken out of lap pets, still in pet through its superset; ${said(outOfSet)}`);

  const outOfPet = await cli(['graph', 'remove-from-concept', '--node', snoopy, '--concept', k.pet], env);
  const p = json(outOfPet.stdout);
  assert(outOfPet.code === 0 && mine(p) && p.data.outcome === 'removed' && show((p.data.left || []).map((x) => x.concept)) === show([k.pet]), `taken out of pet; ${said(outOfPet)}`);

  const peer = await cli(['graph', 'add-to-concept', '--node', k.snowy, '--concept', k.pet, '--fields', '{"description":"filed under pet by the agent"}'], env);
  const q = json(peer.stdout);
  assert(peer.code === 0 && mine(q) && q.data.outcome === 'added' && q.data.kept === 'beside', `another author's Snowy is filed under pet, beside their letter; ${said(peer)}`);
  const after = S.readState(file);
  assert(show(C.tagArrays(after, k.snowy)) === show(C.tagArrays(before, k.snowy)), 'and Snowy\'s letter, its tags and json tag, is as the graph recorded it (AC5)');

  const bad = await cli(['graph', 'add-to-concept', '--node', snoopy, '--concept', k.gadget, '--fields', '{"size":"big"}'], env);
  const b = json(bad.stdout);
  assert(bad.code === 1 && b && b.code === 'invalid-fields' && b.rule === 'element-fits-schema' && /gadget\.size/.test(String(b.error)), `fields that don't fit: invalid-fields from element-fits-schema, naming the field; ${said(bad)}`);

  const claim = await cli(['graph', 'remove-from-concept', '--node', k.snowy, '--concept', k.beagle], env);
  const c = json(claim.stdout);
  assert(claim.code === 1 && c && c.code === 'author-claim' && String(c.error).includes(MG.OTHER), `Snowy's membership of beagle is its letter's claim: author-claim, naming its author; ${said(claim)}`);

  const last = await cli(['graph', 'remove-from-concept', '--node', snoopy, '--concept', k.beagle], env);
  const l = json(last.stdout);
  assert(last.code === 1 && l && l.code === 'last-concept' && l.rule === 'node-has-a-concept', `Snoopy's last concept: last-concept, by node-has-a-concept; ${said(last)}`);

  const hist = await cli(['graph', 'history', '--node', snoopy], env);
  const h = json(hist.stdout);
  const ops = h && h.success ? h.data.entries.map((e) => e.operation) : null;
  assert(ops && show(ops) === show(['graph remove-from-concept', 'graph remove-from-concept', 'graph add-to-concept', 'graph add-to-concept', 'graph create-element']),
    `history for Snoopy, newest first: out of pet, out of lap pets, into lap pets, into pet, made; nothing for the repeat or the refusals; got ${show(h).slice(0, 500)}`);
  assert(h.data.entries.every((e) => e.by.role === 'admin' && e.by.pubkey === admin.pubkey), 'each entry is the agent\'s own');
  const j = C.json(S.readState(file), snoopy);
  assert(!('pet' in j) && j.beagle && show(j.word.wordTypes) === show(['word', 'beagle']), `the graph holds Snoopy in beagle alone, pet's section gone; got ${show(j)}`);
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
