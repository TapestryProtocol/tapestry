'use strict';
/**
 * An admin agent checks word types through the external CLI — run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.md (AC4: "when a
 *          concept is made by graph create-concept … its JSON schema holds validationTool, and rules check over the new
 *          concept names none of its core nodes for this rule"; AC6: "An admin agent with its own key, through the
 *          external CLI and with no change to it, runs rules check for this rule … a node made to lack a key is named,
 *          and named no more once it has the key")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0047-wordtypes-hold-each-concepts-key.md (Decisions 3
 *          to 6 and 8)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.test-plan.md
 *   Model: test/operations/rules/rules-agent-through-cli.test.js
 *
 * Stack-free. test/helpers/externalCliServer.js serves the REAL catalog, with the real sign-in, over story 18's graph
 * (test/helpers/propertyGraph.js's seedProperties), given a validation tool concept whose superset holds json schema's,
 * as firmware's manifest wires it (sets.validation-tools). The agent is clients/cli/bin/tapestry.js, holding an
 * admin's own key. No operation leaves a key out, so the test takes one out by hand, in the graph's file, as raw Cypher
 * would. The plan's live check runs the same steps on a scratch stack.
 *
 *   XW1 the agent makes teapot, and a check of teapot names none of its core nodes (its JSON schema holds
 *       validationTool); it makes Brown Betty; with teapot's key taken out of Brown Betty's wordTypes, a check of the
 *       graph names Brown Betty for teapot; repair over teapot leaves it, with the way on, and records nothing; with the
 *       key back, a check of Brown Betty names nothing
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const P = require('../../helpers/propertyGraph');
const G = require('../../helpers/graphFake');

const { ROOT, NL, TA, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: an admin agent checks word types through the external CLI');

const RULE = 'word-types-hold-concept-keys';
const BIN = path.join(ROOT, 'clients/cli/bin/tapestry.js');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const READY = 'externalCliServer-ready ';
const RULE_FILE = path.join(ROOT, `src/operations/rules/${RULE}.js`);
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));

function makeKey() {
  const sk = NT.generateSecretKey();
  return { nsec: NT.nip19.nsecEncode(sk), pubkey: NT.getPublicKey(sk) };
}

const children = [];
function startInstance(owner, admin, stateFile) {
  const dir = tmp('wt-agent-');
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
    const home = tmp('wt-agent-home-');
    const child = spawn(process.execPath, [BIN, ...args], { cwd: home, env: { PATH: process.env.PATH, HOME: home, TAPESTRY_HOME: path.join(home, 'tapestry-home'), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 30000);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}
const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
const said = (r) => `exit ${r.code}; stdout ${show(String(r.stdout).slice(-400))}; stderr ${show(String(r.stderr).slice(-300))}`;
function needRule(r) {
  if (!fs.existsSync(RULE_FILE)) throw new Error(`src/operations/rules/${RULE}.js does not exist yet (ADR graph-operations-first-slice/0047 Decision 1): the external CLI exited ${r.code}: ${String(r.stdout || r.stderr).trim().split(NL)[0].slice(0, 300)}`);
}

/** Story 18's graph, given validation tool: its header and superset, the superset holding json schema's (sets.validation-tools). */
async function seedFile() {
  const seed = await P.seedProperties();
  const s = seed.state;
  const b = P.over(s);
  const jsonSchemaSuperset = b.byUuid(`39999:${TA}:json-schema-superset`);
  assert(jsonSchemaSuperset, "story 18's graph holds json schema's superset at 39999:<TA>:json-schema-superset");
  const header = b.lettered({
    uuid: `39998:${TA}:validation-tool`, kind: 39998, labels: ['ListHeader', 'ConceptHeader'], name: 'validation tool',
    tags: [['d', 'validation-tool'], ['names', 'validation tool', 'validation tools'], ['slug', 'validation-tool'],
      ['json', JSON.stringify({ word: { slug: 'concept-header-for-the-concept-of-validation-tools', wordTypes: ['word', 'conceptHeader'] }, conceptHeader: { oNames: { singular: 'validation tool', plural: 'validation tools' }, oKeys: { singular: 'validationTool', plural: 'validationTools' } } })]],
  });
  const superset = b.lettered({
    uuid: `39999:${TA}:validation-tool-superset`, labels: ['ListItem', 'Superset'], name: 'superset for the concept of validation tools',
    tags: [['d', 'validation-tool-superset'], ['json', JSON.stringify({ word: { slug: 'superset-for-the-concept-of-validation-tools', wordTypes: ['word', 'set', 'superset'] }, superset: { slug: 'validation-tools' } })]],
  });
  b.link(header, 'IS_THE_CONCEPT_FOR', superset);
  b.link(superset, 'IS_A_SUPERSET_OF', jsonSchemaSuperset);
  const file = path.join(tmp('wt-agent-graph-'), 'graph.json');
  G.writeState(file, s);
  return file;
}

/** In the graph's file: the json tag of the node keyed `key`, its wordTypes changed by `fn`. */
function editWordTypes(file, key, fn) {
  const s = S.readState(file);
  const b = P.over(s);
  const n = b.byKey(key);
  assert(n, `the graph holds ${key}`);
  b.editJson(n, (j) => { j.word.wordTypes = fn(j.word.wordTypes); });
  G.writeState(file, s);
}

test('XW1 [AC4, AC6]: the agent checks a new concept and finds nothing; finds an element made to lack its key; repair leaves it; with the key back, nothing', async () => {
  const owner = makeKey();
  const admin = makeKey();
  const file = await seedFile();
  const inst = await startInstance(owner, admin, file);
  const keyFile = path.join(tmp('wt-agent-key-'), 'agent.key');
  fs.writeFileSync(keyFile, `${admin.nsec}${NL}`);
  fs.chmodSync(keyFile, 0o600);
  const env = { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile };
  const step = async (what, args) => {
    const r = await cli(args, env);
    assert(r.code === 0, `the agent's ${what} must succeed; ${said(r)}`);
    return json(r.stdout).data;
  };

  const made = (await step('create-concept of teapot', ['graph', 'create-concept', '--name', 'teapot'])).concept;
  const teapot = made.conceptHeader;

  // AC4: a check of the new concept names none of its core nodes; its JSON schema holds validationTool.
  const first = await cli(['rules', 'check', '--scope', teapot, '--rules', RULE], env);
  needRule(first);
  const f = json(first.stdout);
  assert(first.code === 0 && f && f.data.found === 0, `a check of teapot, just made by graph create-concept, names none of its core nodes (its JSON schema holds validationTool, ADR 0047 Decision 8); ${said(first)}`);
  const sent = fs.readFileSync(inst.recordFile, 'utf8').split(NL).filter(Boolean).map(json).find((r) => r && r.path === '/api/tapestry/rules/check');
  const params = sent ? new URL(sent.url, 'http://x').searchParams : null;
  assert(params && params.get('scope') === teapot && show(params.getAll('rules')) === show([RULE]), `the CLI sent the scope and the rule as they were given: no change to the CLI; got ${show(sent && sent.url)}`);

  // graph create-concept's starter schema requires a description (test plan, Amendment 1).
  const betty = (await step('create-element of Brown Betty', ['graph', 'create-element', '--concept', teapot, '--name', 'Brown Betty', '--fields', '{"description":"A round brown teapot."}'])).element.tapestryKey;

  // As raw Cypher might leave it: teapot's key taken out of Brown Betty's wordTypes.
  editWordTypes(file, betty, (wt) => wt.filter((x) => x !== 'teapot'));
  const lacking = await cli(['rules', 'check', '--scope', 'graph', '--rules', RULE, '--limit', '200'], env);
  const l = json(lacking.stdout);
  const mineOf = (d) => (d.violations || []).filter((v) => v.node.tapestryKey === betty);
  assert(lacking.code === 0 && l && mineOf(l.data).length === 1 && mineOf(l.data)[0].key === 'teapot' && mineOf(l.data)[0].concepts[0].tapestryKey === teapot,
    `a check of the graph names Brown Betty, once, for teapot's key; ${said(lacking)}`);

  const repaired = await cli(['rules', 'repair', '--rule', RULE, '--scope', teapot], env);
  const rp = json(repaired.stdout);
  assert(repaired.code === 0 && rp && rp.data.outcome === 'left' && rp.data.change === null && rp.data.left.some((x) => x.id === mineOf(l.data)[0].id && x.wayOn),
    `repair over teapot leaves Brown Betty's finding, with the way on, and records nothing; ${said(repaired)}`);

  editWordTypes(file, betty, (wt) => [...wt, 'teapot']);
  const back = await cli(['rules', 'check', '--scope', betty, '--rules', RULE], env);
  const bk = json(back.stdout);
  assert(back.code === 0 && bk && bk.data.found === 0 && bk.data.judged === 1, `with the key back, a check of Brown Betty judges it and names nothing; ${said(back)}`);
});

async function runAll() {
  try { return await run(); } finally { for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } } }
}

module.exports = { run: runAll };
if (require.main === module) runAll().then(({ fail }) => process.exit(fail ? 1 : 0));
