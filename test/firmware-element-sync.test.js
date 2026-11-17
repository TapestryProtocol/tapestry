'use strict';
/**
 * A reinstall brings a concept's existing elements in line with its files — graph-operations-first-slice #41
 * (Loom A10.41), AC5.
 *
 * Story: engineering-team/stories/graph-operations-first-slice/41-graph-rule-concept.md
 * Plan:  engineering-team/stories/graph-operations-first-slice/41-graph-rule-concept.test-plan.md
 * ADR:   engineering-team/decisions/graph-operations-first-slice/0041-graph-rule-concept.md (Decision 6, Amendment 1)
 *
 * Stack-free: planElement (src/firmware/element-sync.js), the pure step that decides what pass 1b does with one element
 * file of a concept that sets updateElements, and what install.js must use to act on it. What an install does with it
 * on a real graph is test/graph-rule-firmware.test.js GL4, and the plan's live check.
 *
 *   ES1  element-sync.js exports planElement
 *   ES2  no element has the name: create
 *   ES3  the assistant's element holds the file's JSON, keys in another order: unchanged, with its address
 *   ES4  the assistant's element holds other JSON: update, with its address
 *   ES5  a json tag held in LMDB is resolved before it is compared
 *   ES6  the assistant's element holds JSON that can't be read: update
 *   ES7  only other authors' elements have the name: blocked, naming them, and nothing to update
 *   ES8  the assistant's and another author's: the assistant's decides, and the other is never the one updated
 *   ES9  two of the assistant's elements: the first by address decides
 *   ES10 the assistant is the pubkey given, matched with its colon: a longer pubkey that starts with it is another author
 *   ES11 planElement leaves its inputs as they were
 *   IS1  install.js reads updateElements and hands the decision to element-sync.js
 *   IS2  install.js signs an update with the normalize helpers' regenerateJson, after loading the key there
 *   IS3  install.js reads the elements with runCypher from src/lib/neo4j-driver, and finds the header by its address
 *   IS4 to IS9 (ADR 0041 Amendment 2.4) run Pass 1 itself in a child process with its dependencies stubbed
 *   (test/helpers/pass1bChild.js): one element file in each state at once —
 *   IS4  an element no row has goes to create-element, in the graph rule concept, by its rule's name
 *   IS5  the assistant's element holding the file's JSON is left as it is: nothing created, nothing signed
 *   IS6  the assistant's element holding other JSON is re-signed once, at its address, with its file's JSON
 *   IS7  an element only another author has is never signed over, nor created beside it
 *   IS8  a lookup that fails is recorded as an error, the element isn't created blindly, and the install goes on
 *   IS9  every lookup finds the header by its address, and every other concept installs as before
 *   IS10 with another author's element read first, the assistant's that differs is the one re-signed (review round 2)
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const SYNC = path.join(REPO, 'src/firmware/element-sync.js');
const INSTALL = path.join(REPO, 'src/firmware/install.js');
const ADR = 'ADR graph-operations-first-slice/0041';

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (x) => JSON.stringify(x);

function planElement() {
  if (!fs.existsSync(SYNC)) throw new Error(`src/firmware/element-sync.js does not exist yet (${ADR} Decision 6)`);
  const m = require(SYNC);
  assert(m && typeof m.planElement === 'function', `element-sync.js exports planElement() (${ADR} Decision 6); it exports ${show(Object.keys(m || {}))}`);
  return m.planElement;
}

const TA = 'a'.repeat(64);
const OTHER = 'b'.repeat(64);
const mine = (d) => `39999:${TA}:${d}`;
const theirs = (d) => `39999:${OTHER}:${d}`;
const FILE = { word: { slug: 'beta-rule', name: 'beta-rule', wordTypes: ['word', 'graphRule'] }, graphRule: { name: 'beta-rule', number: 2, alsoSays: [], code: null } };
const REORDERED = JSON.stringify({ graphRule: { code: null, alsoSays: [], number: 2, name: 'beta-rule' }, word: { wordTypes: ['word', 'graphRule'], name: 'beta-rule', slug: 'beta-rule' } });
const CHANGED = JSON.stringify({ ...FILE, graphRule: { ...FILE.graphRule, number: 3 } });
const noResolve = (v) => { throw new Error(`resolve was called with ${show(v)}, which isn't an LMDB reference`); };

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

t('ES1: src/firmware/element-sync.js exports planElement', () => { planElement(); });

t('ES2: no element has the name — create', () => {
  const p = planElement()({ json: FILE, found: [], ta: TA, resolve: noResolve });
  assert(p && p.action === 'create', `action create; got ${show(p)}`);
});

t("ES3: the assistant's element holds the file's JSON, keys in another order — unchanged, with its address", () => {
  const p = planElement()({ json: FILE, found: [{ uuid: mine('beta-rule-1a2b3c4d'), json: REORDERED }], ta: TA, resolve: noResolve });
  assert(p.action === 'unchanged' && p.uuid === mine('beta-rule-1a2b3c4d'), `unchanged, at its address: JSON is compared as values (Amendment 1); got ${show(p)}`);
});

t("ES4: the assistant's element holds other JSON — update, with its address", () => {
  const p = planElement()({ json: FILE, found: [{ uuid: mine('beta-rule-1a2b3c4d'), json: CHANGED }], ta: TA, resolve: noResolve });
  assert(p.action === 'update' && p.uuid === mine('beta-rule-1a2b3c4d'), `update, at its address; got ${show(p)}`);
});

t('ES5: a json tag held in LMDB is resolved before it is compared', () => {
  const plan = planElement();
  const ref = 'lmdb:2f1c0e6a-1111-4222-8333-944445555666';
  const seen = [];
  const same = plan({ json: FILE, found: [{ uuid: mine('x'), json: ref }], ta: TA, resolve: (v) => { seen.push(v); return REORDERED; } });
  assert(show(seen) === show([ref]), `resolve is given the reference; it was given ${show(seen)}`);
  assert(same.action === 'unchanged', `the resolved JSON equals the file's: unchanged; got ${show(same)}`);
  const other = plan({ json: FILE, found: [{ uuid: mine('x'), json: ref }], ta: TA, resolve: () => JSON.parse(CHANGED) });
  assert(other.action === 'update', `the resolved JSON, as a value, differs: update; got ${show(other)}`);
});

t("ES6: the assistant's element holds JSON that can't be read — update", () => {
  const plan = planElement();
  for (const json of ['{"word": {', null, '']) {
    const p = plan({ json: FILE, found: [{ uuid: mine('x'), json }], ta: TA, resolve: noResolve });
    assert(p.action === 'update' && p.uuid === mine('x'), `json ${show(json)}: update, so the element is brought in line (Amendment 1); got ${show(p)}`);
  }
  const ref = 'lmdb:2f1c0e6a-1111-4222-8333-944445555666';
  const gone = plan({ json: FILE, found: [{ uuid: mine('x'), json: ref }], ta: TA, resolve: () => null });
  assert(gone.action === 'update', `an LMDB reference whose entry is missing (resolveValue answers null): update; got ${show(gone)}`);
  const broken = plan({ json: FILE, found: [{ uuid: mine('x'), json: ref }], ta: TA, resolve: () => { throw new Error('the store is unreadable'); } });
  assert(broken.action === 'update', `an LMDB reference the store can't read: update; got ${show(broken)}`);
});

t("ES7: only other authors' elements have the name — blocked, naming them, and nothing to update", () => {
  const p = planElement()({ json: FILE, found: [{ uuid: theirs('beta-rule-9'), json: REORDERED }, { uuid: theirs('beta-rule-8'), json: CHANGED }], ta: TA, resolve: noResolve });
  assert(p.action === 'blocked', `blocked: install never signs over another author's event (Decision 6); got ${show(p)}`);
  assert(show([...(p.others || [])].sort()) === show([theirs('beta-rule-8'), theirs('beta-rule-9')]), `others names the other authors' addresses; got ${show(p.others)}`);
  assert(!p.uuid, `no address to update; got ${show(p.uuid)}`);
});

t("ES8: the assistant's and another author's — the assistant's decides, and the other is never the one updated", () => {
  const plan = planElement();
  const a = plan({ json: FILE, found: [{ uuid: theirs('beta-rule-9'), json: CHANGED }, { uuid: mine('beta-rule-1'), json: REORDERED }], ta: TA, resolve: noResolve });
  assert(a.action === 'unchanged' && a.uuid === mine('beta-rule-1'), `the assistant's holds the file's JSON: unchanged, though the other's differs; got ${show(a)}`);
  const b = plan({ json: FILE, found: [{ uuid: theirs('beta-rule-9'), json: REORDERED }, { uuid: mine('beta-rule-1'), json: CHANGED }], ta: TA, resolve: noResolve });
  assert(b.action === 'update' && b.uuid === mine('beta-rule-1'), `the assistant's differs: update the assistant's, never the other's; got ${show(b)}`);
});

t("ES9: two of the assistant's elements have the name — the first by address decides", () => {
  const p = planElement()({ json: FILE, found: [{ uuid: mine('beta-rule-2'), json: REORDERED }, { uuid: mine('beta-rule-1'), json: CHANGED }], ta: TA, resolve: noResolve });
  assert(p.action === 'update' && p.uuid === mine('beta-rule-1'), `the first by address, beta-rule-1, decides: it differs, so update it (Amendment 1); got ${show(p)}`);
});

t('ES10: the assistant is the pubkey given, matched with its colon — a longer pubkey that starts with it is another author', () => {
  const longer = `39999:${TA}ff:beta-rule-1`;
  const p = planElement()({ json: FILE, found: [{ uuid: longer, json: CHANGED }], ta: TA, resolve: noResolve });
  assert(p.action === 'blocked', `an address under ${TA.slice(0, 8)}…ff isn't the assistant's: blocked; got ${show(p)}`);
});

t('ES11: planElement leaves its inputs as they were', () => {
  const json = JSON.parse(JSON.stringify(FILE));
  const found = [{ uuid: mine('beta-rule-2'), json: CHANGED }, { uuid: mine('beta-rule-1'), json: REORDERED }];
  const before = show({ json, found });
  planElement()({ json, found, ta: TA, resolve: noResolve });
  assert(show({ json, found }) === before, 'the file JSON and the rows are unchanged, the rows\' order included');
});

// ── What install.js uses to act on the decision (Decision 6) ─────────────────────────────────────────────────────

const installSource = () => fs.readFileSync(INSTALL, 'utf8');

t("IS1: install.js reads updateElements and hands the decision to element-sync.js", () => {
  const s = installSource();
  assert(/require\(\s*['"]\.\/element-sync['"]\s*\)/.test(s), 'install.js requires ./element-sync (Decision 6)');
  assert(/\bupdateElements\b/.test(s), "install.js reads a manifest entry's updateElements (Decision 6)");
  assert(/\bplanElement\s*\(/.test(s), 'install.js calls planElement (Decision 6)');
  assert(/['"]\/api\/normalize\/create-element['"]/.test(s), 'pass 1b still creates elements through create-element, for every concept (Decision 6)');
});

t("IS2: install.js signs an update with the normalize helpers' regenerateJson, after loading the key there", () => {
  const s = installSource();
  const helpers = s.match(/const\s*\{([^}]*)\}\s*=\s*require\(\s*['"]\.\.\/api\/normalize\/helpers['"]\s*\)/);
  assert(helpers, "install.js takes what it signs with from ../api/normalize/helpers");
  assert(/\bregenerateJson\b/.test(helpers[1]) && /\bloadTAKey\b/.test(helpers[1]), `it takes regenerateJson and loadTAKey from the helpers (Decision 6); it takes ${show(helpers[1].trim())}`);
  assert(/\bregenerateJson\s*\(/.test(s), 'install.js calls regenerateJson for an element to update');
});

t('IS3: install.js reads the elements with runCypher from src/lib/neo4j-driver, and finds the header by its address', () => {
  const s = installSource();
  assert(/require\(\s*['"]\.\.\/lib\/neo4j-driver['"]\s*\)/.test(s), 'install.js requires ../lib/neo4j-driver, since /api/neo4j/query\'s CSV answer can\'t carry a JSON value (Decision 6)');
  assert(/\bconceptUuid\s*\(/.test(s), "install.js finds the concept's header by its address, firmware.conceptUuid(slug), never by name (Amendment 1)");
});

// ── Pass 1b itself, run in a child process with its dependencies stubbed (ADR 0041 Amendment 2.4) ────────────────
//
// test/helpers/pass1bChild.js runs the real pass1_bootstrap. The driver, the normalize helpers, the event sync and the
// assistant's keys are stubbed in its require.cache, and its control-panel calls are answered in-process, so nothing
// leaves the child. Were the driver's stub ever bypassed, the driver would read its address only from the conf file
// (src/lib/neo4j-driver.js, src/utils/config.js), and with none it falls back to bolt://localhost:7687, which on the
// owner's Mac is the agent-memory instance. So the child gets a conf of its own whose Neo4j is a closed port, as
// test/schema-save-finds-the-right-header.test.js gives its child, and every other endpoint is a closed port too.

const os = require('os');
const { spawnSync } = require('child_process');
const CHILD = path.join(__dirname, 'helpers/pass1bChild.js');
const DEAD_CONF = path.join(os.tmpdir(), `pass1b-dead-${process.pid}.conf`);
const DEAD = { BRAINSTORM_CONF_PATH: DEAD_CONF, NEO4J_URI: 'bolt://127.0.0.1:9', TAPESTRY_API_BASE: 'http://127.0.0.1:9', BRAINSTORM_BASE_URL: 'http://127.0.0.1:9', TAPESTRY_PORT: '9', MEILI_URL_HOST: 'http://127.0.0.1:9', TAPESTRY_CONTAINER: 'no-such-container' };
const SCENARIO = {
  'tapestry-key-unique': 'none',
  'relationship-type-allowed': 'own-reordered',
  'field-mark-allowed': 'own-changed',
  'concept-slug-unique': 'other-only',
  'class-thread-acyclic': 'throws',
  'set-has-a-parent': 'own-same+other',
  // Rule 7, joined with story graph-operations-first-slice #20 (ADR graph-operations-first-slice/0020 Decision 12).
  'element-fits-schema': 'own-reordered',
};
const runs = new Map();
function runPass1b(scenario = SCENARIO) {
  const key = JSON.stringify(scenario);
  if (runs.has(key)) return runs.get(key);
  if (!fs.existsSync(DEAD_CONF)) {
    fs.writeFileSync(DEAD_CONF, 'NEO4J_URI="bolt://127.0.0.1:9"\nNEO4J_USER="none"\nNEO4J_PASSWORD="none"\n');
    process.on('exit', () => { try { fs.unlinkSync(DEAD_CONF); } catch { /* already gone */ } });
  }
  const r = spawnSync(process.execPath, [CHILD, key], {
    cwd: REPO,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 64 << 20,
    env: { ...process.env, ...DEAD },
  });
  const line = String(r.stdout || '').split('\n').find((l) => l.startsWith('@@RESULT@@'));
  assert(line, `the child printed no result (exit ${r.status}): ${String(r.stderr || r.stdout).slice(0, 600)}`);
  const out = JSON.parse(line.slice('@@RESULT@@'.length));
  assert(!out.threw, `Pass 1 threw in the child: ${String(out.threw).slice(0, 600)}`);
  runs.set(key, out);
  return out;
}
const own = (name) => `39999:${'a'.repeat(64)}:${name}-1b2c3b2d`;

t('IS4: an element no row has goes to create-element, in the graph rule concept, by its rule\'s name', () => {
  const r = runPass1b();
  assert(show(r.createElement) === show(['tapestry-key-unique']), `create-element is called for the one element no lookup found, and no other graph-rule element; got ${show(r.createElement)}`);
});

t("IS5: the assistant's element holding the file's JSON is left as it is: nothing created, nothing signed", () => {
  const r = runPass1b();
  for (const name of ['relationship-type-allowed', 'set-has-a-parent']) {
    assert(!r.createElement.includes(name), `${name} isn't created again`);
    assert(!r.regenerateJson.some((x) => x.name === name), `${name} isn't re-signed`);
    assert(r.log.some((l) => /Already in line/.test(l) && l.includes(own(name))), `its log line says it is already in line, at ${own(name)}; the log is ${show(r.log)}`);
  }
});

t("IS6: the assistant's element holding other JSON is re-signed once, at its address, with its file's JSON, after the key is loaded", () => {
  const r = runPass1b();
  const re = r.regenerateJson;
  assert(re.length === 1 && re[0].uuid === own('field-mark-allowed'), `one re-sign, at ${own('field-mark-allowed')}; got ${show(re.map((x) => x.uuid))}`);
  const file = JSON.parse(fs.readFileSync(path.join(REPO, 'firmware/versions/v1.0.0/concepts/graph-rule/elements/field-mark-allowed.json'), 'utf8'));
  assert(show(re[0].json) === show(file), 'it signs the file\'s JSON');
  assert(r.loadTAKey >= 1, 'the helpers\' key is loaded before the re-sign');
  assert(!r.createElement.includes('field-mark-allowed'), 'and it isn\'t created again');
});

t("IS7: an element only another author has is never signed over, nor created beside it, and the log says so", () => {
  const r = runPass1b();
  assert(!r.createElement.includes('concept-slug-unique') && !r.regenerateJson.some((x) => x.name === 'concept-slug-unique'), 'nothing is created or signed for concept-slug-unique');
  assert(r.log.some((l) => /Not made/.test(l) && /concept-slug-unique-99999999/.test(l)), `the log names the other author's element; the log is ${show(r.log)}`);
});

t('IS8: a lookup that fails is recorded as an error, the element isn\'t created blindly, and the install goes on', () => {
  const r = runPass1b();
  assert(r.errors.some((e) => e.slug === 'class-thread-acyclic'), `an error is recorded for class-thread-acyclic; got ${show(r.errors)}`);
  assert(!r.createElement.includes('class-thread-acyclic'), 'it isn\'t created after a failed lookup');
  assert(r.lookups.length === Object.keys(SCENARIO).length, `all ${Object.keys(SCENARIO).length} elements were looked up, the ones after the failure included; got ${r.lookups.length}`);
});

t('IS9: every lookup finds the header by its address, and every other concept installs as before: create-element for each element file, no lookup', () => {
  const r = runPass1b();
  const headers = [...new Set(r.lookups.map((l) => l.header))];
  assert(show(headers) === show([`39998:${r.ta}:graph-rule`]), `each lookup names 39998:<TA>:graph-rule; got ${show(headers)}`);
  const manifestJson = JSON.parse(fs.readFileSync(path.join(REPO, 'firmware/versions/v1.0.0/manifest.json'), 'utf8'));
  let files = 0;
  for (const c of manifestJson.concepts) {
    if (c.slug === 'graph-rule') continue;
    const dir = path.join(REPO, 'firmware/versions/v1.0.0', c.dir, 'elements');
    if (fs.existsSync(dir)) files += fs.readdirSync(dir).filter((f) => f.endsWith('.json')).length;
  }
  assert(r.otherConcepts.createElement === files, `create-element once per other concept's element file, ${files}; got ${r.otherConcepts.createElement}`);
  assert(r.otherConcepts.lookups === 0, `no other concept's element is looked up; got ${r.otherConcepts.lookups}`);
});

t("IS10: with another author's element read first, the assistant's that differs is the one re-signed, never the other's", () => {
  const others = { 'tapestry-key-unique': 'own-reordered', 'relationship-type-allowed': 'own-reordered', 'concept-slug-unique': 'own-reordered', 'class-thread-acyclic': 'own-reordered', 'set-has-a-parent': 'own-reordered', 'element-fits-schema': 'own-reordered' };
  const r = runPass1b({ ...others, 'field-mark-allowed': 'other-first+own-changed' });
  const re = r.regenerateJson.map((x) => x.uuid);
  assert(show(re) === show([own('field-mark-allowed')]), `one re-sign, at the assistant's ${own('field-mark-allowed')}, though another author's row came first; got ${show(re)}`);
  assert(!re.some((u) => u.startsWith(`39999:${'b'.repeat(64)}:`)), 'another author\'s element is never re-signed (ADR 0041 Decision 6)');
  assert(r.createElement.length === 0, `nothing is created; got ${show(r.createElement)}`);
});

async function run() {
  console.log('\n--- a reinstall brings a concept\'s existing elements in line (graph-operations-first-slice #41) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`); pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++;
    }
  }
  console.log(`\nfirmware-element-sync: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
