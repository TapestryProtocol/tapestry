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
