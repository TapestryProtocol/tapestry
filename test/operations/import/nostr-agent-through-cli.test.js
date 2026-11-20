'use strict';
/**
 * An admin agent imports nostr events through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/32-import-nostr.md (AC7's last sentence: on a scratch
 *          stack, an admin agent with its own key, through the external CLI (A10.6) and with no change to it, "imports
 *          one concept's concept graph from another instance's relay by the graph's address, and finds its nodes
 *          recorded at that instance's addresses and wired as its graphs list; repeats the call and is told nothing
 *          changed; imports a referrer by id before its addressable target, then the target, and finds one node for
 *          each, the reference pointing at the target; imports a filter in two calls, the second going on where the
 *          first stopped; and is refused a relay on a private address")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0032-import-nostr.md (Decisions 1, 5, 6 and 11)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/32-import-nostr.test-plan.md
 *   Model: test/operations/graph/enumerate-agent-through-cli.test.js
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over the graph
 * test/helpers/cypherGraphFake.js keeps and the relays and DNS of test/helpers/relayFake.js; the agent is
 * clients/cli/bin/tapestry.js, holding an admin's own key. The plan's live check runs the same steps on a scratch
 * stack, reading a hosted instance's public relay.
 *
 *   XI1 the agent imports alice's concept graph by its address from other.example.com and finds it recorded and wired
 *       (graph list-relationships, pov everyone); repeats it and is told nothing changed; imports a referrer by id,
 *       then its addressable target, and finds the reference on the target; imports a filter in two calls; is refused
 *       a private relay; and the CLI sent what it was given, unchanged
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const F = require('../../helpers/importFixtures');
const R = require('../../helpers/relayFake');
const CG = require('../../helpers/cypherGraphFake');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent imports nostr events through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const NT = F.NT;

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile, relayFile) {
  const dir = tmp('import-nostr-agent-');
  const recordFile = path.join(dir, 'requests.jsonl');
  fs.writeFileSync(recordFile, '');
  const specFile = path.join(dir, 'spec.json');
  fs.writeFileSync(specFile, JSON.stringify({ root: ROOT, catalogDir: path.join(ROOT, 'src/operations/catalog'), recordFile, graphFakeState: stateFile, graphFakeEngine: 'cypher', relayFake: relayFile }));
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
    const home = tmp('import-nostr-agent-home-');
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

test('XI1 [AC7]: the agent imports a concept graph, repeats it, imports a referrer before its target and a filter in two calls, and is refused a private relay', async () => {
  F.needDecl();
  const owner = makeKey();
  const admin = makeKey();
  const al = F.KEYS.alice, bob = F.KEYS.bob, carol = F.KEYS.carol;
  const cat = F.conceptLetters(al, 'cat', { at: 1700500000 });
  const target = F.letter(al, { kind: 39999, at: 1700500100, tags: [['d', 'the-target'], ['name', 'The Target']] });
  const referrer = F.letter(bob, { kind: 1, at: 1700500101, tags: [['e', target.id]], content: 'names the target by id' });
  const notes = Array.from({ length: 5 }, (_, i) => F.letter(carol, { kind: 1, at: 1700500200 + i, content: `carol #${i}` }));
  const dir = tmp('import-nostr-agent-graph-');
  const stateFile = path.join(dir, 'graph.json');
  CG.writeState(stateFile, F.emptyGraph());
  const relayFile = R.writeFixture(path.join(dir, 'relays.json'), { relays: { [F.OTHER_INSTANCE]: F.relay([...cat.all, target, referrer, ...notes]) }, dns: F.DNS });
  const inst = await startInstance(owner, admin, stateFile, relayFile);
  const keyFile = path.join(tmp('import-nostr-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const imp = async (what, args) => {
    const r = await cli(['import', 'nostr', ...args], env);
    if (!fs.existsSync(F.DECL)) throw new Error(`src/operations/catalog/import/nostr.js does not exist yet (ADR graph-operations-first-slice/0032 Decision 1): the external CLI exited ${r.code}: ${String(r.stderr || r.stdout).trim().split(NL)[0]}`);
    return r;
  };
  const ok = async (what, args) => {
    const r = await imp(what, args);
    const body = json(r.stdout);
    assert(r.code === 0 && body && body.success === true, `the agent's ${what} must succeed; ${said(r)}`);
    return body.data;
  };

  // 1. The concept graph, by its address, from the other instance's relay.
  const g = await ok('graph import', ['--graph', cat.addr.conceptGraph, '--relay', F.OTHER_INSTANCE]);
  assert(g.source === 'graph' && g.counts.recorded === 8, `the concept graph, its two graphs and their letters: eight recorded; got ${show(g.counts)}`);
  const s = CG.readState(stateFile);
  const keyAt = (uuid) => { const n = F.nodesAt(s, uuid); assert(n.length === 1, `one node at ${uuid}`); return n[0].props.tapestryKey; };
  const header = keyAt(cat.addr.header);
  const lr = await cli(['graph', 'list-relationships', '--node', header, '--pov', 'everyone', '--limit', '50'], env);
  const lb = json(lr.stdout);
  assert(lr.code === 0 && lb && lb.success, `the agent lists the header's relationships; ${said(lr)}`);
  const rels = lb.data.relationships;
  const has = (type, from, to) => rels.some((x) => x.type === type && x.from === from && x.to === to);
  assert(has('IS_THE_CONCEPT_FOR', header, keyAt(cat.addr.superset)), `the header IS_THE_CONCEPT_FOR its superset, as alice's graphs list it; got ${show(rels.map((x) => [x.type, x.direction]))}`);
  for (const [role, type] of [['schema', 'IS_THE_JSON_SCHEMA_FOR'], ['primaryProperty', 'IS_THE_PRIMARY_PROPERTY_FOR'], ['coreNodesGraph', 'IS_THE_CORE_GRAPH_FOR'], ['conceptGraph', 'IS_THE_CONCEPT_GRAPH_FOR']]) {
    assert(has(type, keyAt(cat.addr[role]), header), `${role} ${type} the header`);
  }
  assert(rels.every((x) => !x.node.address || x.node.address.includes(al.pubkey)), 'every node at the other end is at alice\'s address');

  // 2. The same call again.
  const again = await ok('graph import again', ['--graph', cat.addr.conceptGraph, '--relay', F.OTHER_INSTANCE]);
  assert(again.changes === 0 && again.events.every((e) => e.outcome === 'unchanged'), `told nothing changed; got ${show(again.counts)}`);

  // 3. A referrer by id, then its addressable target.
  const first = await ok('referrer import', ['--ids', referrer.id, '--relay', F.OTHER_INSTANCE]);
  const second = await ok('target import', ['--addresses', F.addressOf(target), '--relay', F.OTHER_INSTANCE]);
  assert(first.counts.recorded === 1 && second.counts.recorded === 1 && second.counts.failed === 0, `each recorded; got ${show([first.counts, second.counts])}`);
  const s2 = CG.readState(stateFile);
  const t = F.nodesAt(s2, F.addressOf(target));
  assert(t.length === 1 && t[0].props.id === target.id && F.withId(s2, target.id).length === 1, 'one node for the target, at its address, holding its id');
  const refs = await cli(['graph', 'list-relationships', '--node', t[0].props.tapestryKey, '--type', 'REFERENCES', '--direction', 'in', '--pov', 'everyone'], env);
  const rb = json(refs.stdout);
  assert(refs.code === 0 && rb && rb.data.relationships.length === 1, `the reference points at the target; ${said(refs)}`);

  // 4. A filter in two calls.
  const filter = { kinds: [1], authors: [carol.pubkey], limit: 3 };
  const f1 = await ok('filter import', ['--filter', JSON.stringify(filter), '--relay', F.OTHER_INSTANCE]);
  assert(f1.source === 'filter' && f1.counts.recorded === 3 && f1.next && Number.isInteger(f1.next.until), `the first call records three and says where to go on; got ${show({ counts: f1.counts, next: f1.next })}`);
  const f2 = await ok('filter import, going on', ['--filter', JSON.stringify({ ...filter, until: f1.next.until }), '--relay', F.OTHER_INSTANCE]);
  assert(f2.counts.recorded === 2 && f2.next === null, `the second goes on where the first stopped, and reads the rest; got ${show({ counts: f2.counts, next: f2.next })}`);
  const s3 = CG.readState(stateFile);
  assert(notes.every((e) => F.withId(s3, e.id).length === 1), 'all five of carol\'s notes recorded, each once');

  // 5. A relay on a private address.
  const priv = await imp('private relay', ['--ids', referrer.id, '--relay', 'ws://10.0.0.1']);
  const pb = json(priv.stdout);
  assert(priv.code === 1 && pb && pb.code === 'private-relay', `refused private-relay; ${said(priv)}`);

  // The CLI sent each input as the agent gave it, typed as the instance's text checker types it: no change to the CLI.
  const sent = fs.readFileSync(inst.recordFile, 'utf8').split(NL).filter(Boolean).map(json).filter((x) => x && x.path === F.ROUTE);
  assert(sent.some((x) => show(x.body.ids) === show([referrer.id])), `--ids went as a list of one; got ${show(sent.map((x) => x.body))}`);
  assert(sent.some((x) => typeof x.body.filter === 'string' && JSON.parse(x.body.filter).limit === 3), '--filter went as its JSON text');
  const history = await cli(['graph', 'history', '--node', header], env);
  const hb = json(history.stdout);
  assert(history.code === 0 && hb.data.entries.length >= 1 && hb.data.entries.every((e) => e.operation === 'import nostr' && e.by.role === 'admin' && e.by.pubkey === admin.pubkey), `the header's history is the agent's import, its own; got ${show(hb).slice(0, 400)}`);
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
