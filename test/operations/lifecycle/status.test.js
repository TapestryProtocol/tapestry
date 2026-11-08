'use strict';
/**
 * lifecycle status — its own suite (ADR graph-operations-foundation/0001 Decisions 11 and 12), run by
 * test/operations.test.js, which finds every suite under test/operations/.
 *   Story: engineering-team/stories/graph-operations-foundation/1-operation-declaration-and-lifecycle-status.md (AC1)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0001-declare-each-operation-once.md
 *
 * Stack-free. The four part-readers are exercised with what they read replaced: in-process on the declaration's own
 * `parts` object (restored after), or in a child process where an API module is replaced in require.cache, so the
 * gate's own process never holds a stubbed module.
 *
 *   P1  backup says plainly that no backup of the graph is recorded
 *   P2  migrations says plainly that none is recorded
 *   P3  firmware reports the version the instance carries and all, some or none of its concepts in the graph
 *   P4  cache reports how many nodes have a cached Tapestry JSON, and how many don't
 *   P5  run answers exactly the four parts; a part that fails is { known: false, problem } and the rest stand
 *   P6  every answer, known or not, matches the declaration's own result schema
 *   P7  the readers it reuses are exported, and GET /api/tapestry-key/status answers exactly as before
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const NL = String.fromCharCode(10);
const STATUS_FILE = path.join(ROOT, 'src/operations/catalog/lifecycle/status.js');

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (x) => JSON.stringify(x);
const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.keys(v).sort().reduce((o, key) => { o[key] = v[key]; return o; }, {}) : v));
const same = (a, b) => canon(a) === canon(b);

function status() {
  if (!fs.existsSync(STATUS_FILE)) throw new Error('src/operations/catalog/lifecycle/status.js does not exist yet (ADR graph-operations-foundation/0001 Decision 11)');
  const s = require(STATUS_FILE);
  assert(s.parts && typeof s.parts === 'object', 'lifecycle status must keep its part-readers on its export as `parts` (ADR Decision 11)');
  for (const p of ['backup', 'firmware', 'migrations', 'cache']) assert(typeof s.parts[p] === 'function', `parts.${p} must be a function`);
  assert(typeof s.run === 'function', 'lifecycle status must have run()');
  return s;
}

/** Run `fn` with some of status.parts replaced, then put the originals back. */
async function withParts(replacements, fn) {
  const s = status();
  const saved = { ...s.parts };
  Object.assign(s.parts, replacements);
  try { return await fn(s); } finally { Object.assign(s.parts, saved); }
}
const CONTEXT = { via: 'cli', caller: { role: 'local', pubkey: null } };
const FIRMWARE = { known: true, version: '1.0.0', installed: 'all', conceptsInGraph: 39, concepts: 39, missing: [] };
const CACHE = { known: true, nodes: 4, withTapestryKey: 3, withoutTapestryKey: 1, cached: 1, cachedEmpty: 1, notCached: 1 };

/** Run a script in a child process with a temp HOME and dead endpoints; it prints one RESULT: line of JSON. */
function child(script) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ops-status-'));
  try {
    const file = path.join(dir, 'child.js');
    fs.writeFileSync(file, script);
    const conf = path.join(dir, 'brainstorm.conf');
    fs.writeFileSync(conf, `export NEO4J_URI="bolt://127.0.0.1:9"${NL}`);
    const env = { ...process.env, BRAINSTORM_CONF_PATH: conf, TAPESTRY_SETTINGS_PATH: path.join(dir, 'settings.json'), BRAINSTORM_BASE_DIR: dir,
      TAPESTRY_LMDB_PATH: path.join(dir, 'lmdb'), HOME: dir, TA_PUBKEY: 'dd'.repeat(32), BRAINSTORM_BASE_URL: 'http://127.0.0.1:9' };
    const r = spawnSync(process.execPath, [file], { cwd: ROOT, env, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
    const line = (r.stdout || '').split(NL).find((l) => l.startsWith('RESULT:'));
    assert(line, `the child printed no result (exit ${r.status}): ${(r.stderr || '').slice(-500)}`);
    const out = JSON.parse(line.slice(7));
    assert(!out.error, `the child failed: ${out.error}`);
    return out;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
/** Child-script lines that replace one module in require.cache with `exportsSrc` (a JS expression). */
const stub = (rel, exportsSrc) => [
  `{ const p = require.resolve(${show(path.join(ROOT, rel))});`,
  `  require.cache[p] = { id: p, filename: p, loaded: true, children: [], paths: [], exports: ${exportsSrc} }; }`,
].join(NL);
const wrap = (body) => [
  `'use strict';`,
  `for (const k of ['log', 'info', 'debug', 'warn']) console[k] = () => {};`,
  `(async () => {`,
  `  try {`,
  body,
  `  } catch (e) { process.stdout.write('RESULT:' + JSON.stringify({ error: e.message }) + '\\n'); }`,
  `})();`,
].join(NL);

test('P1: backup says plainly that no backup of the graph is recorded', async () => {
  const b = await status().parts.backup();
  assert(b && b.known === true && b.last === null && typeof b.note === 'string' && b.note.trim().length > 0,
    `backup must be { known: true, last: null, note }; got ${show(b)}`);
});

test('P2: migrations says plainly that none is recorded', async () => {
  const m = await status().parts.migrations();
  assert(m && m.known === true && Array.isArray(m.applied) && m.applied.length === 0 && typeof m.note === 'string' && m.note.trim().length > 0,
    `migrations must be { known: true, applied: [], note }; got ${show(m)}`);
});

test('P3: firmware reports the version the instance carries and whether all, some or none of its concepts are in the graph', () => {
  status();
  const out = child(wrap([
    `let state = null;`,
    stub('src/api/firmware/index.js', `{ readInstallState: async () => state }`),
    `const s = require(${show(STATUS_FILE)});`,
    `const r = {};`,
    `state = { installedCount: 3, totalCount: 3, missing: [], installed: ['a', 'b', 'c'], activeVersion: '9.9.9' }; r.all = await s.parts.firmware();`,
    `state = { installedCount: 2, totalCount: 3, missing: ['c'], installed: ['a', 'b'], activeVersion: '9.9.9' }; r.some = await s.parts.firmware();`,
    `state = { installedCount: 0, totalCount: 3, missing: ['a', 'b', 'c'], installed: [], activeVersion: '9.9.9' }; r.none = await s.parts.firmware();`,
    `process.stdout.write('RESULT:' + JSON.stringify(r) + '\\n');`,
  ].join(NL)));
  const want = {
    all: { known: true, version: '9.9.9', installed: 'all', conceptsInGraph: 3, concepts: 3, missing: [] },
    some: { known: true, version: '9.9.9', installed: 'some', conceptsInGraph: 2, concepts: 3, missing: ['c'] },
    none: { known: true, version: '9.9.9', installed: 'none', conceptsInGraph: 0, concepts: 3, missing: ['a', 'b', 'c'] },
  };
  for (const k of Object.keys(want)) assert(same(out[k], want[k]), `firmware (${k}) must be ${show(want[k])}; got ${show(out[k])}`);
});

test('P4: cache reports how many nodes have a cached Tapestry JSON, how many have an empty one, and how many have none', () => {
  status();
  const out = child(wrap([
    stub('src/api/tapestry-key/index.js', `{ readTapestryKeyCounts: async () => ({ initialized: 118, uninitialized: 2, total: 120, lmdb: { derived: 100, empty: 3, missing: 15 } }) }`),
    `const s = require(${show(STATUS_FILE)});`,
    `process.stdout.write('RESULT:' + JSON.stringify(await s.parts.cache()) + '\\n');`,
  ].join(NL)));
  const want = { known: true, nodes: 120, withTapestryKey: 118, withoutTapestryKey: 2, cached: 100, cachedEmpty: 3, notCached: 15 };
  assert(same(out, want), `cache must be ${show(want)}; got ${show(out)}`);
});

test('P5: run answers exactly the four parts, and a part that fails is { known: false, problem } while the rest stand', async () => {
  const all = await withParts({ firmware: async () => FIRMWARE, cache: async () => CACHE }, (s) => s.run({}, CONTEXT));
  assert(same(Object.keys(all || {}).sort(), ['backup', 'cache', 'firmware', 'migrations']), `exactly four parts; got ${show(Object.keys(all || {}))}`);
  assert(same(all.firmware, FIRMWARE) && same(all.cache, CACHE), `each part is what its reader returned; got ${show(all)}`);
  const broken = await withParts({ firmware: async () => { throw new Error('graph down'); }, cache: async () => CACHE }, (s) => s.run({}, CONTEXT));
  assert(broken.firmware && broken.firmware.known === false && /graph down/.test(String(broken.firmware.problem)),
    `a failing part must answer { known: false, problem }; got ${show(broken.firmware)}`);
  assert(same(broken.cache, CACHE) && broken.backup.known === true && broken.migrations.known === true, `the other parts stand; got ${show(broken)}`);
});

test('P6: every answer, known or not, matches the declaration\'s own result schema', async () => {
  const s = status();
  const Ajv = require('ajv');
  const validate = new Ajv({ allErrors: true, strict: false }).compile(s.result.schema);
  const known = await withParts({ firmware: async () => FIRMWARE, cache: async () => CACHE }, (x) => x.run({}, CONTEXT));
  assert(validate(known), `a fully known answer must match the result schema: ${show(validate.errors)}`);
  const unknown = await withParts({ firmware: async () => { throw new Error('x'); }, cache: async () => { throw new Error('y'); } }, (x) => x.run({}, CONTEXT));
  assert(validate(unknown), `an answer whose parts failed must match the result schema too: ${show(validate.errors)}`);
});

test('P7: readInstallState and readTapestryKeyCounts are exported, and GET /api/tapestry-key/status answers exactly as before', () => {
  const out = child(wrap([
    `const keyRows = [{ tk: 'k1' }, { tk: 'k2' }, { tk: 'k3' }];`,
    `const countRows = [{ initialized: true, count: 3 }, { initialized: false, count: 1 }];`,
    `let present = new Set();`,
    // The stubs go in before anything that might require the real modules.
    stub('src/lib/neo4j-driver.js', `{
      runCypher: async (cypher, params) => {
        if (/h:NostrEvent \\{uuid: \\$uuid\\}/.test(cypher)) return present.has(String(params.uuid).split(':').pop()) ? [{ uuid: params.uuid }] : [];
        if (/AS tk/.test(cypher)) return keyRows;
        return countRows;
      },
      writeCypher: async () => [], explainCypher: async () => [], getDriver: () => null, closeDriver: async () => {}, toJS: (v) => v,
    }`),
    stub('src/lib/tapestry-store.js', `{
      get: (k) => ({ k1: { data: { a: 1 } }, k2: { data: {} } })[k] || null,
      put: async () => ({}), remove: async () => {}, stats: () => ({ count: 2 }), listKeys: () => [], close: () => {}, getDb: () => null,
    }`),
    `const manifest = require(${show(path.join(ROOT, 'src/api/normalize/firmware.js'))}).getManifest();`,
    `present = new Set(manifest.concepts.slice(0, 2).map((c) => c.slug));`,
    `const fw = require(${show(path.join(ROOT, 'src/api/firmware/index.js'))});`,
    `const tk = require(${show(path.join(ROOT, 'src/api/tapestry-key/index.js'))});`,
    `const r = { fwType: typeof fw.readInstallState, tkType: typeof tk.readTapestryKeyCounts, total: manifest.concepts.length, version: manifest.version };`,
    `if (r.fwType === 'function') r.install = await fw.readInstallState();`,
    `if (r.tkType === 'function') r.counts = await tk.readTapestryKeyCounts();`,
    `r.route = await new Promise((resolve) => { tk.handleStatus({}, { status() { return this; }, json: resolve }); });`,
    `process.stdout.write('RESULT:' + JSON.stringify(r) + '\\n');`,
  ].join(NL)));
  assert(out.fwType === 'function', `src/api/firmware/index.js must export readInstallState; it is ${out.fwType}`);
  assert(out.install && out.install.installedCount === 2 && out.install.totalCount === out.total && out.install.activeVersion === out.version
    && Array.isArray(out.install.missing) && out.install.missing.length === out.total - 2,
    `readInstallState must answer { installedCount, totalCount, missing, installed, activeVersion }; got ${show(out.install)}`);
  assert(out.tkType === 'function', `src/api/tapestry-key/index.js must export readTapestryKeyCounts; it is ${out.tkType}`);
  const counts = { initialized: 3, uninitialized: 1, total: 4, lmdb: { derived: 1, empty: 1, missing: 1 } };
  assert(same(out.counts, counts), `readTapestryKeyCounts must answer ${show(counts)}; got ${show(out.counts)}`);
  assert(same(out.route, { success: true, data: counts }), `GET /api/tapestry-key/status must still answer { success: true, data: <the counts> }; got ${show(out.route)}`);
});

async function run() {
  console.log(`${NL}=== operations: lifecycle status ===`);
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'skip') { console.log(`  SKIP  ${name}`); skipped++; } else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}operations: lifecycle status: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
