'use strict';
/**
 * An admin agent searches the graph through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/8-search.md (AC7: an admin agent with its own key uses
 *          it through the external CLI, with no change to the CLI)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0008-search.md (Implementation notes, the live check)
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over a graph
 * test/helpers/searchGraph.js seeds for test/helpers/graphFake.js. The agent is the external CLI,
 * clients/cli/bin/tapestry.js, holding an admin's own key, as story graph-operations-foundation #6 built it. The live
 * check repeats this on a scratch stack at the size of Avi's brain.
 *
 *   SX1 the agent finds a rule by the words of its statement, and a document by the words of one of its headings, each
 *       with the field and the passage that show why
 *   SX2 the agent resolves a concept's name to its key, narrows a search to that concept's elements, pages through
 *       them with the cursor, and is refused a kind there isn't
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const { seedSearch } = require('../../helpers/searchGraph');

const { ROOT, NL, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent searches the graph through the external CLI');

const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const DECL = path.join(ROOT, 'src/operations/catalog/graph/search.js');
const READY = 'externalCliServer-ready ';
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));

function makeKey() {
  const sk = NT.generateSecretKey();
  const pubkey = NT.getPublicKey(sk);
  return { nsec: NT.nip19.nsecEncode(sk), pubkey };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('search-agent-');
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
    const home = tmp('search-agent-home-');
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
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/search.js does not exist yet (ADR graph-operations-first-slice/0008, Implementation notes)');
  const owner = makeKey();
  const admin = makeKey();
  const seed = seedSearch({ owner: owner.pubkey });
  const file = seed.file(tmp('search-agent-graph-'));
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('search-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  SETUP = { seed, file, env: { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile } };
  return SETUP;
}

test('SX1: the agent finds a rule by the words of its statement, and a document by the words of a heading, each with its field and passage', async () => {
  const { seed, env } = await setup();
  const r = await cli(['graph', 'search', '--q', 'never hardcode the pubkey'], env);
  assert(r.code === 0, `the agent's search must succeed; ${said(r)}`);
  const body = json(r.stdout);
  assert(body && body.success && Array.isArray(body.data.matches), `it answers matches; got ${show(body)}`);
  const top = body.data.matches[0];
  assert(top && top.tapestryKey === seed.keys.ruleTa && top.field === 'rule.statement' && /hardcode/i.test(top.passage), `the rule whose statement holds every word comes first, with rule.statement and its passage; got ${show(top)}`);
  assert(show(top.words) === show(['never', 'hardcode', 'pubkey']), `it holds every word searched for, the stop word left out; got ${show(top.words)}`);
  const h = json((await cli(['graph', 'search', '--q', 'location hints', '--pov', 'everyone'], env)).stdout);
  const doc = h && h.data && h.data.matches.find((m) => m.tapestryKey === seed.keys.docLong);
  assert(doc && doc.field === 'document.headings' && doc.passage === 'Map location hints', `the document is found by one of its headings, the heading its passage; got ${show(h && h.data)}`);
});

test('SX2: the agent resolves a concept\'s name, narrows a search to its elements, pages with the cursor, and is refused a kind there isn\'t', async () => {
  const { seed, env } = await setup();
  const res = json((await cli(['graph', 'resolve', '--ref', 'rule', '--kind', 'concept'], env)).stdout);
  assert(res && res.data && res.data.candidates.length === 1 && res.data.candidates[0].tapestryKey === seed.keys.ruleHeader, `rule names one concept, the rule concept's header; got ${show(res && res.data)}`);
  const key = res.data.candidates[0].tapestryKey;
  const first = await cli(['graph', 'search', '--q', 'iotaword', '--concept', key, '--pov', 'everyone', '--limit', '1'], env);
  assert(first.code === 0, `the agent searches within that concept with the key it got back; ${said(first)}`);
  const p1 = json(first.stdout);
  assert(p1 && p1.data.matches.length === 1 && typeof p1.data.cursor === 'string' && p1.data.kept === 2, `a page of one of the two matches, with a cursor; got ${show(p1 && p1.data)}`);
  const p2 = json((await cli(['graph', 'search', '--q', 'iotaword', '--concept', key, '--pov', 'everyone', '--limit', '1', '--cursor', p1.data.cursor], env)).stdout);
  assert(p2 && p2.data.matches.length === 1 && p2.data.cursor === null, `the second page is the last; got ${show(p2 && p2.data)}`);
  const both = [p1.data.matches[0].tapestryKey, p2.data.matches[0].tapestryKey].sort();
  assert(show(both) === show([seed.keys.ruleDoc, seed.keys.ruleMust].sort()), `the two pages hold the rule concept's two iotaword elements, once each; got ${show(both)}`);
  const no = await cli(['graph', 'search', '--q', 'iotaword', '--kind', 'property'], env);
  const refusal = json(no.stdout);
  assert(no.code === 1 && refusal && refusal.code === 'invalid-input' && refusal.input === 'kind', `a kind there isn't: exit 1, invalid-input, naming kind; ${said(no)}`);
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run: runAll };
