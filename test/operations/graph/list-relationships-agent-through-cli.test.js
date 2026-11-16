'use strict';
/**
 * An admin agent lists a node's relationships through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/13-list-relationships.md (AC6's last sentence)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0013-list-relationships-and-the-relationship-conventions.md
 *          (the external CLI sends a read's flags as its query, so it needs no change)
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph
 * test/helpers/relationshipsGraph.js seeds for test/helpers/graphFake.js. The agent is the external CLI,
 * clients/cli/bin/tapestry.js, holding an admin's own key, as story graph-operations-foundation #6 built it.
 *
 *   RX1 the agent lists a node's relationships page by page, following each cursor to the end, and gets each one the
 *       owner's point of view keeps exactly once, with what was left out counted
 *   RX2 the agent lists one type in one direction from everyone's point of view, and is refused a node that isn't one
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const { seedRelationships, HUB } = require('../../helpers/relationshipsGraph');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent lists relationships through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const DECL = path.join(ROOT, 'src/operations/catalog/graph/list-relationships.js');
const READY = 'externalCliServer-ready ';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));

function makeKey() {
  const sk = NT.generateSecretKey();
  const pubkey = NT.getPublicKey(sk);
  return { nsec: NT.nip19.nsecEncode(sk), pubkey };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('relationships-agent-');
  const recordFile = path.join(dir, 'requests.jsonl');
  fs.writeFileSync(recordFile, '');
  const specFile = path.join(dir, 'spec.json');
  fs.writeFileSync(specFile, JSON.stringify({ root: ROOT, catalogDir: path.join(ROOT, 'src/operations/catalog'), recordFile, graphFakeState: stateFile }));
  const env = S.childEnv(dir);
  // The owner and the admin are this suite's own keys, so the CLI's sign-in admits the admin.
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
      const ports = JSON.parse(out.slice(at + READY.length, end));
      resolve({ url: `http://127.0.0.1:${ports.port}` });
    });
    proc.stderr.on('data', (d) => { err += d; });
    proc.on('exit', (code) => { if (!ready) { clearTimeout(timer); reject(new Error(`the test instance exited ${code} before it was ready: ${err.slice(-600)}`)); } });
  });
}

function cli(args, env) {
  return new Promise((resolve) => {
    const home = tmp('relationships-agent-home-');
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

/** The instance, its seeded graph and the agent's environment, made once for both tests. */
let SETUP = null;
async function setup() {
  if (SETUP) return SETUP;
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/list-relationships.js does not exist yet (ADR graph-operations-first-slice/0013 Decision 2)');
  const owner = makeKey();
  const admin = makeKey();
  const seed = seedRelationships({ owner: owner.pubkey, admin: admin.pubkey });
  const file = seed.file(tmp('relationships-agent-graph-'));
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('relationships-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  SETUP = { seed, file, env: { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile } };
  return SETUP;
}

test('RX1: the agent lists a node\'s relationships page by page, to the end, each kept one once, with what was left out counted', async () => {
  const { seed, env } = await setup();
  const k = seed.keys;
  const seen = [];
  let cursor = null;
  for (let page = 1; page <= 6; page++) {
    const args = ['graph', 'list-relationships', '--node', k.hub, '--limit', '3', ...(cursor ? ['--cursor', cursor] : [])];
    const r = await cli(args, env);
    assert(r.code === 0, `page ${page}: the agent's read must succeed; ${said(r)}`);
    const body = json(r.stdout);
    assert(body && body.success && Array.isArray(body.data.relationships), `page ${page} answers its relationships; got ${show(body)}`);
    assert(body.data.kept === 8 && body.data.leftOut === 4 && body.data.tagsLeftOut === 4, `page ${page}: 8 kept, 4 left out and 4 to tag nodes, across the list; got ${show({ kept: body.data.kept, leftOut: body.data.leftOut, tagsLeftOut: body.data.tagsLeftOut })}`);
    assert(body.data.pov && body.data.pov.name === 'owner', `page ${page}: read from the owner's point of view; got ${show(body.data.pov)}`);
    for (const rel of body.data.relationships) seen.push(`${rel.direction} ${rel.type} ${rel.from} ${rel.to}`);
    cursor = body.data.cursor;
    if (!cursor) break;
  }
  assert(cursor === null, 'the agent reaches the last page, whose cursor is null');
  assert(seen.length === 8 && new Set(seen).size === 8, `each of the 8 relationships the owner's point of view keeps, exactly once; got ${show(seen)}`);
  const kept = (dir, pairs) => pairs.filter(([, n]) => !HUB.leftOut.includes(n)).map(([type, n]) => (dir === 'out' ? `out ${type} ${k.hub} ${k[n]}` : `in ${type} ${k[n]} ${k.hub}`));
  const wanted = [...kept('out', HUB.out), ...kept('in', HUB.in)].sort();
  assert(show([...seen].sort()) === show(wanted), `the agent gets the relationships to the nodes the owner counts, each with its direction, from and to; got ${show(seen)}`);
});

test('RX2: the agent lists one type in one direction from everyone\'s point of view, and is refused a node that isn\'t one', async () => {
  const { seed, env } = await setup();
  const k = seed.keys;
  const r = await cli(['graph', 'list-relationships', '--node', k.hub, '--type', 'CITES', '--direction', 'in', '--pov', 'everyone'], env);
  assert(r.code === 0, `the agent's read of hub's incoming CITES must succeed; ${said(r)}`);
  const body = json(r.stdout);
  const rels = body && body.data && body.data.relationships;
  assert(rels && rels.length === 1 && rels[0].type === 'CITES' && rels[0].direction === 'in' && rels[0].from === k.citer && rels[0].to === k.hub, `the one CITES that runs to hub, citer's; got ${show(body && body.data)}`);
  const no = await cli(['graph', 'list-relationships', '--node', crypto.randomUUID()], env);
  const refusal = json(no.stdout);
  assert(no.code === 1 && refusal && refusal.code === 'unknown-node' && refusal.input === 'node', `a key that names no node: exit 1, unknown-node, naming node; ${said(no)}`);
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
