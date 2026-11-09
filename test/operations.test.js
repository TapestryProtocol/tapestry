'use strict';
/**
 * The operations module — graph-operations-foundation #1 (Loom A10.1): each operation declared once, and its route,
 * route-table entry, /docs entry, command and list entry made from that declaration.
 *   Story: engineering-team/stories/graph-operations-foundation/1-operation-declaration-and-lifecycle-status.md
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0001-declare-each-operation-once.md
 *   Plan:  engineering-team/stories/graph-operations-foundation/1-operation-declaration-and-lifecycle-status.test-plan.md
 *
 * Stack-free: no running instance, no container, no network beyond ephemeral loopback ports. HTTP runs in a child
 * process (test/helpers/operationsHarness.js) with the owner and an admin configured through BRAINSTORM_CONF_PATH and
 * TAPESTRY_SETTINGS_PATH, and lifecycle status's firmware and cache parts replaced, so nothing reads Neo4j or the LMDB.
 *
 *   L1  the repo's catalog loads with no problems and declares lifecycle status                     [AC1, Decision 9]
 *   L2  a declaration that opens an operation to visitors or ordinary signed-in people is refused   [AC2]
 *   L3  the other declaration rules, and helper files beside a declaration are ignored              [Decisions 1, 2, 9]
 *   L4  loading the catalog (and the route table) loads no Neo4j driver, LMDB or Redis module       [Decision 10]
 *   R1  the route table has exact entries for lifecycle status and the list, resolving to owner     [AC2, AC6]
 *   R2  generated entries follow each declaration; none for an invalid one                          [AC2, Decision 3]
 *   W1  register(app) registers the status route and the list route                                 [AC1, AC7]
 *   H1–H16  the routes, through the real central auth middleware; H16 the list's caller (#6)        [AC1, AC2, AC5, AC7]
 *   C1–C8   the command                                                                              [AC3, AC5]
 *   D1–D6   the /docs entries; D6 the list's caller (#6)                                             [AC4]
 *   S1  nothing outside the declaration names the operation's route                                  [AC6]
 *   X1–X2   AC6 in a throwaway copy with only new declaration files added                            [AC6]
 *   T1  per-operation suites under test/operations/ are found and run                               [Decision 12]
 *
 * After its own tests it runs every suite under test/operations/ (ADR Decision 12), counting their results with its
 * own, so an operation's suite needs no line in test/registry.js.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const NL = String.fromCharCode(10);
const OPS = path.join(ROOT, 'src/operations');
const CATALOG = path.join(OPS, 'catalog');
const STATUS_FILE = path.join(CATALOG, 'lifecycle/status.js');
const TABLE = path.join(ROOT, 'src/middleware/routeAccess.js');
const OPENAPI = path.join(ROOT, 'src/api/openapi.yaml');
const ENTRYPOINT = path.join(ROOT, 'bin/control-panel.js');
const BIN = path.join(ROOT, 'bin/tapestry.js');
const DOCKERFILE = path.join(ROOT, 'Dockerfile');
const HARNESS = path.join(ROOT, 'test/helpers/operationsHarness.js');
const WALKER = path.join(ROOT, 'test/helpers/routeWalk.js');
const OPS_TESTS = path.join(ROOT, 'test/operations');
const REFUSAL = path.join(OPS, 'refusal.js');

const OWNER = 'aa'.repeat(32);
const ADMIN = 'bb'.repeat(32);
const STRANGER = 'cc'.repeat(32);
const DEAD = 'http://127.0.0.1:9';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (x) => JSON.stringify(x);
/** JSON with object keys sorted (array order kept), so equality never depends on the order keys were set in. */
const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.keys(v).sort().reduce((o, key) => { o[key] = v[key]; return o; }, {}) : v));
const same = (a, b) => canon(a) === canon(b);
const temps = [];
function tmp(prefix) { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); temps.push(d); return d; }

/** Throw the reason a file of the tree under test can't be used yet. Never requires it (bin/tapestry.js runs when loaded). */
function mustExist(abs, why) {
  if (!fs.existsSync(abs)) throw new Error(`${path.relative(ROOT, abs)} does not exist yet (${why})`);
}
/** A module of the tree under test, or throw the reason it can't be used yet. */
function need(abs, why) {
  mustExist(abs, why);
  return require(abs);
}
const operationsIndex = () => need(path.join(OPS, 'index.js'), 'ADR graph-operations-foundation/0001 Decision 1');
const routeTable = () => need(path.join(OPS, 'routeTable.js'), 'ADR Decision 3');
const openapi = () => need(path.join(OPS, 'openapi.js'), 'ADR Decision 6');
const statusDecl = () => need(STATUS_FILE, 'ADR Decision 11');

// ── Fixture catalogs ──────────────────────────────────────────────────────────────────────────────────────────────

const BASE = {
  kind: 'read',
  access: 'owner-and-admins',
  summary: 'A test operation',
  description: 'Made by test/operations.test.js.',
  inputs: {},
  result: { description: 'Anything', schema: { type: 'object' } },
  refusals: [],
};
const COUNT = (key) => `const runs = (globalThis.__opsRuns = globalThis.__opsRuns || {}); runs[${show(key)}] = (runs[${show(key)}] || 0) + 1;`;

/** Source text of a declaration file: its fields as JSON, then its run (or none, when run === null). */
function declSource(fields, { run = 'async run() { return { ok: true }; }', head = '' } = {}) {
  const body = Object.entries(fields).map(([k, v]) => `  ${show(k)}: ${show(v)},`).join(NL);
  return `'use strict';${NL}${head}${NL}module.exports = {${NL}${body}${NL}${run === null ? '' : `  ${run}${NL}`}};${NL}`;
}
function writeCatalog(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

const ECHO_INPUTS = {
  text: { schema: { type: 'string', minLength: 1 }, required: true, description: 'Some text' },
  limit: { schema: { type: 'integer', minimum: 1, maximum: 10, default: 3 }, required: false, description: 'A small number' },
  tags: { schema: { type: 'array', items: { type: 'string' } }, required: false, description: 'A list of words' },
  flag: { schema: { type: 'boolean' }, required: false, description: 'A switch' },
};

function fixtureFiles({ echoSummary = 'Echo the inputs it was given' } = {}) {
  return {
    'graph/echo-inputs.js': declSource({ ...BASE, group: 'graph', name: 'echo-inputs', summary: echoSummary, inputs: ECHO_INPUTS }, {
      run: `async run(inputs, context) { ${COUNT('graph echo-inputs')} return { inputs, via: context && context.via, role: context && context.caller && context.caller.role }; }`,
    }),
    'graph/write-thing.js': declSource({
      ...BASE, group: 'graph', name: 'write-thing', kind: 'write', summary: 'Write a number',
      inputs: { n: { schema: { type: 'integer' }, required: true, description: 'A number' } },
    }, { run: `async run(inputs) { ${COUNT('graph write-thing')} return { n: inputs.n }; }` }),
    'graph/refusing.js': declSource({
      ...BASE, group: 'graph', name: 'refusing', summary: 'Refuse, as told',
      inputs: { mode: { schema: { type: 'string', enum: ['declared', 'undeclared'] }, required: true, description: 'Which refusal' } },
      refusals: [{ code: 'not-found', status: 404, when: 'Asked to refuse with the code it declares' }],
    }, {
      head: `const { refusal } = require(${show(REFUSAL)});`,
      run: `async run(inputs) { if (inputs.mode === 'declared') throw refusal('not-found', 'There is nothing here.'); throw refusal('surprise', 'A code the declaration does not name.'); }`,
    }),
    // A result that can't be sent as JSON (review round 1, non-blocking 1): it must answer 500 failed, not end the process.
    'graph/unserializable.js': declSource({ ...BASE, group: 'graph', name: 'unserializable', summary: 'Answer with a BigInt' }, {
      run: 'async run() { return { n: 10n }; }',
    }),
    'graph/noisy.js': declSource({ ...BASE, group: 'graph', name: 'noisy', summary: 'Log while it runs' }, {
      run: `async run() { console.log('noise-from-the-operation'); console.info('more-noise'); return { quiet: true }; }`,
    }),
    'lifecycle/owner-thing.js': declSource({ ...BASE, group: 'lifecycle', name: 'owner-thing', access: 'owner-only', summary: 'Only for the owner' }, {
      run: `async run() { ${COUNT('lifecycle owner-thing')} return { ok: true }; }`,
    }),
    // Invalid: they try to open an operation to visitors and to ordinary signed-in people (AC2).
    'graph/visible.js': declSource({ ...BASE, group: 'graph', name: 'visible', access: 'public' }, {
      run: `async run() { ${COUNT('graph visible')} return { leaked: true }; }`,
    }),
    'graph/signed.js': declSource({ ...BASE, group: 'graph', name: 'signed', access: 'signed-in' }, {
      run: `async run() { ${COUNT('graph signed')} return { leaked: true }; }`,
    }),
    // Helper files beside the declarations: not declarations, never loaded as operations (ADR Decision 1).
    'graph/echo-inputs.parts.js': `'use strict';${NL}module.exports = { helper: true };${NL}`,
    'graph/_shared.js': `'use strict';${NL}module.exports = { helper: true };${NL}`,
  };
}

let FIX = null;
function fixtureDir() { if (!FIX) FIX = writeCatalog(tmp('ops-fixture-'), fixtureFiles()); return FIX; }

// ── Child processes ───────────────────────────────────────────────────────────────────────────────────────────────

/** An environment with the owner and the admin configured, and every service endpoint dead. */
function childEnv(dir) {
  const conf = path.join(dir, 'brainstorm.conf');
  const settings = path.join(dir, 'settings.json');
  fs.writeFileSync(conf, [
    `export BRAINSTORM_OWNER_PUBKEY="${OWNER}"`,
    'export NEO4J_URI="bolt://127.0.0.1:9"',
    'export REDIS_HOST="127.0.0.1"',
    'export REDIS_PORT="9"',
  ].join(NL) + NL);
  fs.writeFileSync(settings, JSON.stringify({ adminPubkeys: [ADMIN] }));
  const env = {
    ...process.env,
    BRAINSTORM_CONF_PATH: conf,
    TAPESTRY_SETTINGS_PATH: settings,
    BRAINSTORM_BASE_DIR: dir,
    TAPESTRY_LMDB_PATH: path.join(dir, 'lmdb'),
    // graph-operations-foundation #2: lifecycle status's backup part reads the backups folder, so point it at one
    // that holds nothing (ADR graph-operations-foundation/0002 Decision 11).
    TAPESTRY_BACKUPS_DIR: path.join(dir, 'backups'),
    BRAINSTORM_BASE_URL: DEAD,
    TAPESTRY_BASE: DEAD,
    MEILI_URL_HOST: DEAD,
    TA_PUBKEY: 'dd'.repeat(32),
  };
  delete env.TASK_QUEUE_ENABLED;
  return env;
}
const SPAWN = { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };

function runHarness(spec) {
  const dir = tmp('ops-harness-');
  const specFile = path.join(dir, 'spec.json');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(specFile, JSON.stringify({ owner: OWNER, admin: ADMIN, stranger: STRANGER, timeoutMs: 100000, ...spec }));
  const child = spawnSync(process.execPath, [HARNESS, specFile, outFile], { ...SPAWN, cwd: spec.root || ROOT, env: childEnv(dir), timeout: 120000 });
  let data = null;
  try { data = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported below */ }
  return { child, data };
}

const FIRMWARE_STUB = { known: true, version: '1.0.0', installed: 'some', conceptsInGraph: 37, concepts: 39, missing: ['concept-one', 'concept-two'] };
const CACHE_STUB = { known: true, nodes: 120, withTapestryKey: 118, withoutTapestryKey: 2, cached: 100, cachedEmpty: 3, notCached: 15 };
const STATUS = '/api/tapestry/lifecycle/status';
const LIST = '/api/tapestry/operations';
const ECHO = '/api/tapestry/graph/echo-inputs';

/** Successful echo-inputs runs the plan below makes: five over HTTP, three from the command. */
const ECHO_RUNS = 8;

function mainSpec() {
  const real = (id, caller, url = STATUS, method = 'GET') => ({ id, app: 'real', method, url, caller });
  const fix = (id, caller, url, method = 'GET', extra = {}) => ({ id, app: 'fixture', method, url, caller, ...extra });
  return {
    fixtureDir: fixtureDir(),
    scenarios: [
      {
        statusStubs: { firmware: { value: FIRMWARE_STUB }, cache: { value: CACHE_STUB } },
        requests: [
          real('h1-owner', 'owner'), real('h1-owner-again', 'owner'), real('h1-admin', 'admin'),
          real('h5-visitor', 'visitor'), real('h5-stranger', 'stranger'),
          real('h5-stranger-caps', 'stranger', STATUS.toUpperCase()), real('h5-local', 'local'),
          real('h11-unknown-input', 'owner', `${STATUS}?foo=1`),
          real('h13-list-owner', 'owner', LIST), real('h13-list-admin', 'admin', LIST),
          real('h14-list-visitor', 'visitor', LIST), real('h14-list-stranger', 'stranger', LIST),
          real('h16-list-local', 'local', LIST),
          fix('h6-owner', 'owner', '/api/tapestry/lifecycle/owner-thing'),
          fix('h6-local', 'local', '/api/tapestry/lifecycle/owner-thing'),
          fix('h6-admin', 'admin', '/api/tapestry/lifecycle/owner-thing'),
          fix('h6-stranger', 'stranger', '/api/tapestry/lifecycle/owner-thing'),
          fix('h6-visitor', 'visitor', '/api/tapestry/lifecycle/owner-thing'),
          fix('h7-visible-owner', 'owner', '/api/tapestry/graph/visible'),
          fix('h7-visible-visitor', 'visitor', '/api/tapestry/graph/visible'),
          fix('h7-signed-owner', 'owner', '/api/tapestry/graph/signed'),
          fix('h7-signed-stranger', 'stranger', '/api/tapestry/graph/signed'),
          fix('h8-unknown', 'owner', `${ECHO}?text=hi&bogus=1`),
          fix('h8-missing', 'owner', `${ECHO}?limit=5`),
          fix('h8-badtype', 'owner', `${ECHO}?text=hi&limit=abc`),
          fix('h8-range', 'owner', `${ECHO}?text=hi&limit=99`),
          fix('h9-typed', 'owner', `${ECHO}?text=hi&limit=5&tags=a&tags=b&flag=true`),
          fix('h9-one-tag', 'owner', `${ECHO}?text=hi&tags=a`),
          fix('h9-default', 'owner', `${ECHO}?text=hi`),
          fix('h9-admin', 'admin', `${ECHO}?text=hi`),
          fix('h9-local', 'local', `${ECHO}?text=hi`),
          fix('h10-write', 'owner', '/api/tapestry/graph/write-thing', 'POST', { body: { n: 2 } }),
          fix('h10-string', 'owner', '/api/tapestry/graph/write-thing', 'POST', { body: { n: '2' } }),
          fix('h10-array', 'owner', '/api/tapestry/graph/write-thing', 'POST', { rawBody: '[1,2]' }),
          fix('h10-missing', 'owner', '/api/tapestry/graph/write-thing', 'POST', { body: {} }),
          fix('h10-extra', 'owner', '/api/tapestry/graph/write-thing', 'POST', { body: { n: 2, extra: 1 } }),
          fix('h10-get-on-write', 'owner', '/api/tapestry/graph/write-thing'),
          fix('h12-declared', 'owner', '/api/tapestry/graph/refusing?mode=declared'),
          fix('h12-undeclared', 'owner', '/api/tapestry/graph/refusing?mode=undeclared'),
          fix('h14-list-owner-f', 'owner', LIST), fix('h14-list-admin-f', 'admin', LIST),
        ],
        cli: [
          { id: 'c1-status', catalog: 'real', argv: ['lifecycle', 'status'] },
          { id: 'c3-unknown-op', catalog: 'fixture', argv: ['graph', 'nope'] },
          { id: 'c3-unknown-group', catalog: 'fixture', argv: ['nosuchgroup', 'x'] },
          { id: 'c4-typed', catalog: 'fixture', argv: ['graph', 'echo-inputs', '--text', 'hi', '--limit', '5', '--tags', 'a', '--tags', 'b', '--flag'] },
          { id: 'c4-equals', catalog: 'fixture', argv: ['graph', 'echo-inputs', '--text=hi', '--limit=7'] },
          { id: 'c4-unknown', catalog: 'fixture', argv: ['graph', 'echo-inputs', '--text', 'hi', '--bogus', '1'] },
          { id: 'c4-missing', catalog: 'fixture', argv: ['graph', 'echo-inputs'] },
          { id: 'c4-badtype', catalog: 'fixture', argv: ['graph', 'echo-inputs', '--text', 'hi', '--limit', 'abc'] },
          { id: 'c4-positional', catalog: 'fixture', argv: ['graph', 'echo-inputs', 'stray'] },
          { id: 'c4-declared', catalog: 'fixture', argv: ['graph', 'refusing', '--mode', 'declared'] },
          { id: 'c4-failed', catalog: 'fixture', argv: ['graph', 'refusing', '--mode', 'undeclared'] },
          { id: 'c5-owner-only', catalog: 'fixture', argv: ['lifecycle', 'owner-thing'] },
          { id: 'c5-context', catalog: 'fixture', argv: ['graph', 'echo-inputs', '--text', 'hi'] },
          { id: 'c7-noisy', catalog: 'fixture', argv: ['graph', 'noisy'] },
          { id: 'c8-help-op', catalog: 'fixture', argv: ['graph', 'echo-inputs', '--help'] },
        ],
      },
      {
        statusStubs: { firmware: { throw: 'neo4j unreachable (test)' }, cache: { value: CACHE_STUB } },
        requests: [real('h4-failing-part', 'owner')],
      },
    ],
  };
}

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  const { child, data } = runHarness(mainSpec());
  const byId = new Map();
  if (data) for (const s of data.scenarios || []) for (const r of [...(s.requests || []), ...(s.cli || [])]) byId.set(r.id, r);
  MAIN = { child, data, byId };
  return MAIN;
}
/** One harness result by id, or throw the harness's own reason. */
function got(id) {
  const m = main();
  assert(m.data, `the harness wrote no result (exit ${m.child.status}): ${(m.child.stderr || '').slice(-400)}`);
  assert(!m.data.error, `the harness could not run: ${m.data.error}`);
  const r = m.byId.get(id);
  assert(r, `no harness result for ${id}`);
  return r;
}
const runsOf = (key) => ((main().data && main().data.runs) || {})[key] || 0;
const stdoutJson = (r) => { try { return JSON.parse(r.stdout); } catch { return null; } };

let WALK = null;
function walk(root = ROOT) {
  if (root === ROOT && WALK) return WALK;
  const dir = tmp('ops-walk-');
  const outFile = path.join(dir, 'out.json');
  // The conf keeps childEnv's dead Neo4j and Redis endpoints: an empty one would fall back to bolt://localhost:7687
  // (OPEN.md row `2026-11-08-suite-runner-not-in-repo`).
  const env = { ...childEnv(dir) };
  const child = spawnSync(process.execPath, [path.join(root, 'test/helpers/routeWalk.js'), outFile], { ...SPAWN, cwd: root, env, timeout: 90000 });
  let data = null;
  try { data = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported by the caller */ }
  const w = { child, data };
  if (root === ROOT) WALK = w;
  return w;
}
const walkHas = (w, method, p) => !!(w.data && w.data.routes || []).some((r) => r.method === method && r.path === p);

function runBin(args, root = ROOT) {
  const dir = tmp('ops-bin-');
  return spawnSync(process.execPath, [path.join(root, 'bin/tapestry.js'), ...args], { ...SPAWN, cwd: root, env: childEnv(dir), timeout: 60000 });
}

// ── L: the catalog and the declaration rules ──────────────────────────────────────────────────────────────────────

test('L1: the repo\'s catalog loads with no problems, and declares lifecycle status as a read for the owner and admins with no inputs', () => {
  const { loadOperations } = operationsIndex();
  const { operations, problems } = loadOperations();
  assert(Array.isArray(problems) && problems.length === 0, `the repo's catalog must load cleanly; problems: ${show(problems)}`);
  const s = (operations || []).find((o) => o.group === 'lifecycle' && o.name === 'status');
  assert(s, `lifecycle status is not among the loaded operations: ${show((operations || []).map((o) => `${o.group} ${o.name}`))}`);
  const want = { kind: 'read', access: 'owner-and-admins', method: 'GET', route: STATUS, command: 'tapestry lifecycle status' };
  for (const [k, v] of Object.entries(want)) assert(s[k] === v, `lifecycle status's ${k} must be ${show(v)}; got ${show(s[k])}`);
  assert(s.inputs && typeof s.inputs === 'object' && Object.keys(s.inputs).length === 0, `lifecycle status takes no inputs; got ${show(s.inputs)}`);
  const bad = operations.filter((o) => !['owner-and-admins', 'owner-only'].includes(o.access));
  assert(bad.length === 0, `every loaded operation is for the owner and admins or the owner only; got ${show(bad.map((o) => `${o.group} ${o.name}: ${o.access}`))}`);
});

test('L2: a declaration that opens an operation to visitors or to ordinary signed-in people is reported invalid and left out', () => {
  const { loadOperations } = operationsIndex();
  const { operations, problems } = loadOperations({ dir: fixtureDir() });
  const names = operations.map((o) => `${o.group} ${o.name}`);
  assert(names.includes('graph echo-inputs'), `a valid neighbour must load, so the refusal below means something; loaded ${show(names)}`);
  for (const [file, word] of [['graph/visible.js', 'public'], ['graph/signed.js', 'signed-in']]) {
    const p = problems.find((x) => String(x.file).replace(/\\/g, '/').endsWith(file));
    assert(p, `${file} (access '${word}') must be reported as a problem; problems: ${show(problems)}`);
    assert(/access/i.test(p.problem), `the problem for ${file} must name the access field; got ${show(p.problem)}`);
  }
  assert(!names.includes('graph visible') && !names.includes('graph signed'), `invalid declarations must be left out; loaded ${show(names)}`);
});

test('L3: the other declaration rules each refuse and name their file, and helper files beside a declaration are ignored', () => {
  const { loadOperations } = operationsIndex();
  const okRun = 'async run() { return { ok: true }; }';
  const g = (name, extra = {}) => ({ ...BASE, group: 'graph', name, ...extra });
  const cases = [
    ['graph/no-run.js', declSource(g('no-run'), { run: null }), /run/i],
    ['raw/thing.js', declSource({ ...BASE, group: 'raw', name: 'thing' }), /raw|group/i],
    ['widgets/thing.js', declSource({ ...BASE, group: 'widgets', name: 'thing' }), /group/i],
    ['graph/mismatch.js', declSource(g('other-name')), /name/i],
    ['graph/bad-schema.js', declSource(g('bad-schema', { inputs: { x: { schema: { type: 'nonsense' }, required: false, description: 'x' } } })), /schema|input/i],
    ['graph/builtin-code.js', declSource(g('builtin-code', { refusals: [{ code: 'unknown-input', status: 400, when: 'x' }] })), /unknown-input|built-in|refusal/i],
    ['graph/bad-kind.js', declSource(g('bad-kind', { kind: 'delete' })), /kind/i],
    ['graph/bad-status.js', declSource(g('bad-status', { refusals: [{ code: 'oops', status: 500, when: 'x' }] })), /status|refusal/i],
    ['graph/no-summary.js', declSource((() => { const d = g('no-summary'); delete d.summary; return d; })()), /summary/i],
  ];
  const files = { 'graph/good-one.js': declSource(g('good-one'), { run: okRun }) };
  for (const [rel, text] of cases) files[rel] = text;
  const dir = writeCatalog(tmp('ops-rules-'), files);
  const { operations, problems } = loadOperations({ dir });
  const loaded = operations.map((o) => `${o.group} ${o.name}`);
  assert(same(loaded, ['graph good-one']), `only the valid declaration may load; loaded ${show(loaded)}`);
  const wrong = [];
  for (const [rel, , re] of cases) {
    const p = problems.find((x) => String(x.file).replace(/\\/g, '/').endsWith(rel));
    if (!p) wrong.push(`${rel}: not reported`);
    else if (!re.test(String(p.problem))) wrong.push(`${rel}: problem ${show(p.problem)} does not match ${re}`);
  }
  assert(wrong.length === 0, `each invalid declaration is reported with its reason:${NL}        ${wrong.join(NL + '        ')}`);
  // Helper files in the fixture catalog are neither operations nor problems.
  const fx = loadOperations({ dir: fixtureDir() });
  const helperHits = [...fx.operations.map((o) => `${o.group}/${o.name}`), ...fx.problems.map((x) => String(x.file))]
    .filter((s) => /parts|_shared/.test(s));
  assert(helperHits.length === 0, `helper files beside a declaration must be ignored; found ${show(helperHits)}`);
});

test('L5: a declaration whose relative require fails is reported by the first line of its error, with no require stack', () => {
  const { loadOperations } = operationsIndex();
  const dir = writeCatalog(tmp('ops-broken-'), {
    'graph/broken-require.js': `'use strict';${NL}require('./no-such-helper-module-xyz');${NL}module.exports = {};${NL}`,
    'graph/good-one.js': declSource({ ...BASE, group: 'graph', name: 'good-one' }),
  });
  const { operations, problems } = loadOperations({ dir });
  assert(same(operations.map((o) => `${o.group} ${o.name}`), ['graph good-one']), `the valid neighbour loads and the broken one doesn't; loaded ${show(operations.map((o) => o.name))}`);
  const p = problems.find((x) => String(x.file).replace(/\\/g, '/').endsWith('graph/broken-require.js'));
  assert(p, `the declaration that fails to load must be reported; problems: ${show(problems)}`);
  const text = String(p.problem);
  assert(/failed to load/i.test(text) && text.includes('no-such-helper-module-xyz'), `the problem says it failed to load and why; got ${show(text)}`);
  const paths = [dir, fs.realpathSync(dir), ROOT, os.tmpdir()];
  assert(!/require stack/i.test(text) && !text.includes(NL) && !paths.some((x) => text.includes(x)),
    `the problem must carry only its error's first line, no require stack or absolute path (review round 1, non-blocking 2); got ${show(text)}`);
});

test('L4: loading the catalog, and the route table that spreads its entries, loads no Neo4j driver, LMDB, store or Redis module', () => {
  operationsIndex();
  const script = [
    `require(${show(TABLE)});`,
    `require(${show(path.join(OPS, 'index.js'))}).loadOperations();`,
    `const heavy = Object.keys(require.cache).filter((k) => /neo4j-driver|[\\\\/]lmdb[\\\\/]|tapestry-store|ioredis|connect-redis/.test(k));`,
    `process.stdout.write('RESULT:' + JSON.stringify(heavy) + '\\n');`,
  ].join(NL);
  const dir = tmp('ops-l4-');
  const r = spawnSync(process.execPath, ['-e', script], { ...SPAWN, cwd: ROOT, env: childEnv(dir), timeout: 60000 });
  const line = (r.stdout || '').split(NL).find((l) => l.startsWith('RESULT:'));
  assert(line, `the loader child printed no result (exit ${r.status}): ${(r.stderr || '').slice(-400)}`);
  const heavy = JSON.parse(line.slice(7));
  assert(heavy.length === 0, `loading must open nothing (ADR Decision 10); these were required: ${show(heavy.map((k) => path.relative(ROOT, k)))}`);
});

// ── R: the route table ────────────────────────────────────────────────────────────────────────────────────────────

test('R1: the route table holds exact entries for lifecycle status and the list, and both resolve to owner (owner, admins, direct-local)', () => {
  routeTable();
  delete require.cache[require.resolve(TABLE)];
  const { ROUTE_ACCESS, resolveRouteAccess } = require(TABLE);
  const s = ROUTE_ACCESS[`GET ${STATUS}`];
  assert(s && s.access === 'owner' && s.kind === 'read', `ROUTE_ACCESS['GET ${STATUS}'] must be { access: 'owner', kind: 'read' }; got ${show(s)}`);
  const l = ROUTE_ACCESS[`GET ${LIST}`];
  assert(l && l.access === 'owner' && l.kind === 'read', `ROUTE_ACCESS['GET ${LIST}'] must be { access: 'owner', kind: 'read' }; got ${show(l)}`);
  for (const [m, p] of [['GET', STATUS], ['HEAD', STATUS], ['GET', LIST]]) {
    const a = resolveRouteAccess(m, p);
    assert(a === 'owner', `resolveRouteAccess(${m}, ${p}) must be 'owner'; got ${show(a)}`);
  }
});

test('R2: generated entries follow each declaration — owner-only stays owner-only, a write is an action — and an invalid declaration gets none', () => {
  const { routeAccessEntries } = routeTable();
  const e = routeAccessEntries({ dir: fixtureDir() });
  const want = {
    'GET /api/tapestry/lifecycle/owner-thing': { access: 'owner-only', kind: 'read' },
    'POST /api/tapestry/graph/write-thing': { access: 'owner', kind: 'action' },
    [`GET ${ECHO}`]: { access: 'owner', kind: 'read' },
  };
  for (const [k, v] of Object.entries(want)) {
    assert(e[k] && e[k].access === v.access && e[k].kind === v.kind, `entry ${k} must be ${show(v)}; got ${show(e[k])}`);
  }
  const leaked = Object.keys(e).filter((k) => /visible|signed/.test(k));
  assert(leaked.length === 0, `an invalid declaration must get no table entry; got ${show(leaked)}`);
  const open = Object.entries(e).filter(([, v]) => !['owner', 'owner-only'].includes(v.access)).map(([k]) => k);
  assert(open.length === 0, `no generated entry may be public or signed-in; got ${show(open)}`);
});

// ── W: registration ───────────────────────────────────────────────────────────────────────────────────────────────

test('W1: register(app) registers GET /api/tapestry/lifecycle/status and GET /api/tapestry/operations', () => {
  const w = walk();
  assert(w.child.status === 0 && w.data && !w.data.registerError,
    `the route walk failed (exit ${w.child.status}): ${(w.data && w.data.registerError) || (w.child.stderr || '').slice(-300)}`);
  for (const p of [STATUS, LIST]) assert(walkHas(w, 'GET', p), `register(app) must register GET ${p}`);
});

// ── H: the routes ─────────────────────────────────────────────────────────────────────────────────────────────────

function assertStatusBody(r, who) {
  assert(r.status === 200, `${who}: lifecycle status must answer 200; got ${r.status} ${show(r.body)}`);
  assert(r.body && r.body.success === true, `${who}: the answer must be { success: true, data }; got ${show(r.body)}`);
  const d = r.body.data || {};
  assert(same(Object.keys(d).sort(), ['backup', 'cache', 'firmware', 'migrations']), `${who}: data must have exactly the four parts; got ${show(Object.keys(d))}`);
  assert(d.backup.known === true && d.backup.last === null && typeof d.backup.note === 'string' && d.backup.note.trim(),
    `${who}: backup must say plainly that none is recorded ({ known: true, last: null, note }); got ${show(d.backup)}`);
  assert(d.migrations.known === true && Array.isArray(d.migrations.applied) && d.migrations.applied.length === 0 && typeof d.migrations.note === 'string' && d.migrations.note.trim(),
    `${who}: migrations must say plainly that none is recorded ({ known: true, applied: [], note }); got ${show(d.migrations)}`);
  assert(same(d.firmware, FIRMWARE_STUB), `${who}: firmware must be what its part read; got ${show(d.firmware)}`);
  assert(same(d.cache, CACHE_STUB), `${who}: cache must be what its part read; got ${show(d.cache)}`);
}

test('H1: lifecycle status answers the owner and an admin with its four parts, and asking twice gives the same answer (AC1)', () => {
  assertStatusBody(got('h1-owner'), 'owner');
  assertStatusBody(got('h1-admin'), 'admin');
  assert(same(got('h1-owner').body, got('h1-owner-again').body), 'asking twice with nothing changed must give the same answer');
});

test('H4: a part that cannot be read answers known: false with its problem, and the call still succeeds', () => {
  const r = got('h4-failing-part');
  assert(r.status === 200 && r.body && r.body.success === true, `status must still answer 200; got ${r.status} ${show(r.body)}`);
  const f = r.body.data && r.body.data.firmware;
  assert(f && f.known === false && /unreachable/.test(String(f.problem)), `the failing part must be { known: false, problem }; got ${show(f)}`);
  assert(same(r.body.data.cache, CACHE_STUB), `the other parts must be unaffected; cache was ${show(r.body.data.cache)}`);
});

test('H5: under /api/tapestry/, a visitor is refused 401 and a stranger 403, each told who may call; a direct-local caller gets through', () => {
  const v = got('h5-visitor');
  assert(v.status === 401 && v.body && v.body.success === false && /owner/i.test(String(v.body.error)),
    `a visitor must get 401 with a message naming who may call; got ${v.status} ${show(v.body)}`);
  for (const id of ['h5-stranger', 'h5-stranger-caps']) {
    const s = got(id);
    assert(s.status === 403 && s.body && s.body.success === false && /owner/i.test(String(s.body.error)),
      `${id}: a signed-in stranger must get 403 with a message naming who may call; got ${s.status} ${show(s.body)}`);
  }
  const l = got('h5-local');
  assert(l.status === 200 && l.body && l.body.success === true, `a direct-local caller must get through; got ${l.status} ${show(l.body)}`);
});

test('H6: an owner-only operation answers the owner and a direct-local caller, and refuses an admin 403, a stranger 403 and a visitor 401', () => {
  for (const id of ['h6-owner', 'h6-local']) {
    const r = got(id);
    assert(r.status === 200 && r.body && r.body.success === true && r.body.data && r.body.data.ok === true, `${id}: must answer 200; got ${r.status} ${show(r.body)}`);
  }
  const a = got('h6-admin');
  assert(a.status === 403 && a.body && a.body.success === false && /owner/i.test(String(a.body.error)) && !/admin/i.test(String(a.body.error)),
    `an admin must be refused 403 by the operation's own check, told only the owner may; got ${a.status} ${show(a.body)}`);
  assert(got('h6-stranger').status === 403, `a stranger must get 403; got ${got('h6-stranger').status}`);
  assert(got('h6-visitor').status === 401, `a visitor must get 401; got ${got('h6-visitor').status}`);
  assert(runsOf('lifecycle owner-thing') === 3, `the owner-only operation must have run exactly 3 times (owner, local, and the command), never for the refused callers; ran ${runsOf('lifecycle owner-thing')}`);
});

test('H7: an invalid declaration\'s route is never served: the owner gets 404, visitors and strangers are refused, and it never runs', () => {
  for (const id of ['h7-visible-owner', 'h7-signed-owner']) {
    const r = got(id);
    assert(r.status === 404, `${id}: the invalid declaration's route must not exist (404); got ${r.status} ${show(r.body)}`);
  }
  assert(got('h7-visible-visitor').status === 401, `a visitor must still be refused (401); got ${got('h7-visible-visitor').status}`);
  assert(got('h7-signed-stranger').status === 403, `a signed-in stranger must still be refused (403); got ${got('h7-signed-stranger').status}`);
  assert(runsOf('graph visible') === 0 && runsOf('graph signed') === 0, `an invalid declaration must never run; runs ${show(main().data.runs)}`);
});

test('H8: an undeclared, missing or ill-typed input is refused 400, naming it, before the operation runs (AC5)', () => {
  const want = [
    ['h8-unknown', 'unknown-input', 'bogus'],
    ['h8-missing', 'missing-input', 'text'],
    ['h8-badtype', 'invalid-input', 'limit'],
    ['h8-range', 'invalid-input', 'limit'],
  ];
  const wrong = [];
  for (const [id, code, input] of want) {
    const r = got(id);
    const b = r.body || {};
    if (r.status !== 400 || b.success !== false || b.code !== code || b.input !== input || !String(b.error || '').includes(input)) {
      wrong.push(`${id}: want 400 ${code} naming '${input}'; got ${r.status} ${show(b)}`);
    }
  }
  assert(wrong.length === 0, wrong.join(NL + '        '));
  assert(runsOf('graph echo-inputs') === ECHO_RUNS,
    `echo-inputs must have run exactly ${ECHO_RUNS} times — only for the accepted calls, never for a refused one; ran ${runsOf('graph echo-inputs')}`);
});

test('H9: query inputs arrive typed — numbers, lists (one value is a list of one), booleans, defaults — with who called and how', () => {
  const data = (id) => { const r = got(id); assert(r.status === 200 && r.body && r.body.success === true, `${id}: must answer 200; got ${r.status} ${show(r.body)}`); return r.body.data; };
  const t = data('h9-typed');
  assert(same(t.inputs, { text: 'hi', limit: 5, tags: ['a', 'b'], flag: true }), `typed inputs; got ${show(t.inputs)}`);
  assert(same(data('h9-one-tag').inputs.tags, ['a']), `one tags value must arrive as a list of one; got ${show(data('h9-one-tag').inputs)}`);
  assert(data('h9-default').inputs.limit === 3, `the declared default must be applied; got ${show(data('h9-default').inputs)}`);
  const ctx = [['h9-typed', 'owner'], ['h9-admin', 'admin'], ['h9-local', 'local']].map(([id, role]) => [id, role, data(id)]);
  for (const [id, role, d] of ctx) assert(d.via === 'http' && d.role === role, `${id}: context must be { via: 'http', caller.role: '${role}' }; got via ${show(d.via)}, role ${show(d.role)}`);
});

test('H10: a write takes a typed JSON body — no coercion, unknown and missing fields refused, a non-object body refused — and is POST only', () => {
  const ok = got('h10-write');
  assert(ok.status === 200 && ok.body && ok.body.success === true && ok.body.data && ok.body.data.n === 2, `POST {n:2} must answer 200 with n 2; got ${ok.status} ${show(ok.body)}`);
  const want = [['h10-string', 'invalid-input', 'n'], ['h10-missing', 'missing-input', 'n'], ['h10-extra', 'unknown-input', 'extra']];
  for (const [id, code, input] of want) {
    const r = got(id);
    assert(r.status === 400 && r.body && r.body.code === code && r.body.input === input, `${id}: want 400 ${code} naming '${input}'; got ${r.status} ${show(r.body)}`);
  }
  const arr = got('h10-array');
  assert(arr.status === 400 && arr.body && arr.body.code === 'invalid-body', `a body that isn't a JSON object must be 400 invalid-body; got ${arr.status} ${show(arr.body)}`);
  assert(got('h10-get-on-write').status === 404, `a write is registered for POST only; GET answered ${got('h10-get-on-write').status}`);
  assert(runsOf('graph write-thing') === 1, `write-thing must have run once (the accepted call); ran ${runsOf('graph write-thing')}`);
});

test('H11: lifecycle status takes no inputs, so any query input is refused 400 unknown-input', () => {
  const r = got('h11-unknown-input');
  assert(r.status === 400 && r.body && r.body.code === 'unknown-input' && r.body.input === 'foo', `want 400 unknown-input naming 'foo'; got ${r.status} ${show(r.body)}`);
});

test('H12: a declared refusal answers at its declared status with its code; a refusal the declaration doesn\'t name is a 500 failed', () => {
  const d = got('h12-declared');
  assert(d.status === 404 && d.body && d.body.success === false && d.body.code === 'not-found' && /nothing here/i.test(String(d.body.error)),
    `want 404 not-found with the operation's message; got ${d.status} ${show(d.body)}`);
  const u = got('h12-undeclared');
  assert(u.status === 500 && u.body && u.body.success === false && u.body.code === 'failed', `an undeclared refusal must be 500 failed; got ${u.status} ${show(u.body)}`);
  assert(/graph refusing/.test(String(u.body.error)), `a failure names the operation ('graph refusing failed: …'); got ${show(u.body.error)}`);
});

function listOf(id) {
  const r = got(id);
  assert(r.status === 200 && r.body && r.body.success === true && r.body.data && Array.isArray(r.body.data.operations),
    `${id}: the list must answer 200 { success, data: { operations, problems } }; got ${r.status} ${show(r.body)}`);
  return r.body.data;
}
const codesOf = (op) => (op.refusals || []).map((x) => x.code);

test('H13: the owner\'s list gives each operation\'s group, name, route, method, command, access, kind, inputs, result and refusals (AC7)', () => {
  const data = listOf('h13-list-owner');
  const s = data.operations.find((o) => o.group === 'lifecycle' && o.name === 'status');
  assert(s, `the list must include lifecycle status; got ${show(data.operations.map((o) => `${o.group} ${o.name}`))}`);
  const want = { method: 'GET', route: STATUS, command: 'tapestry lifecycle status', kind: 'read', access: 'owner-and-admins' };
  for (const [k, v] of Object.entries(want)) assert(s[k] === v, `the list's ${k} must be ${show(v)}; got ${show(s[k])}`);
  assert(typeof s.summary === 'string' && s.summary.trim() && typeof s.description === 'string', `summary and description; got ${show({ summary: s.summary, description: s.description })}`);
  assert(s.inputs && Object.keys(s.inputs).length === 0, `inputs must be the declared (empty) inputs; got ${show(s.inputs)}`);
  assert(s.result && s.result.schema && typeof s.result.schema === 'object' && typeof s.result.description === 'string', `result { description, schema }; got ${show(s.result)}`);
  assert(same(s.result.schema, statusDecl().result.schema), 'the list\'s result schema must be the declaration\'s');
  const codes = codesOf(s);
  for (const c of ['unknown-input', 'sign-in-required', 'not-allowed']) assert(codes.includes(c), `the list must name the built-in refusal ${c}; got ${show(codes)}`);
  for (const c of ['missing-input', 'invalid-input']) assert(!codes.includes(c), `an operation with no inputs can't return ${c}; got ${show(codes)}`);
  assert(Array.isArray(data.problems) && data.problems.length === 0, `the repo's list must report no problems; got ${show(data.problems)}`);
  const admin = listOf('h13-list-admin');
  assert(admin.operations.some((o) => o.group === 'lifecycle' && o.name === 'status'), 'an admin may call lifecycle status, so their list includes it');
});

test('H14: the list shows each caller only what they may call, names invalid declarations, and refuses visitors and strangers', () => {
  const owner = listOf('h14-list-owner-f');
  const admin = listOf('h14-list-admin-f');
  const names = (d) => d.operations.map((o) => `${o.group} ${o.name}`);
  for (const n of ['graph echo-inputs', 'graph write-thing', 'graph refusing', 'graph noisy', 'lifecycle owner-thing']) {
    assert(names(owner).includes(n), `the owner's list must include ${n}; got ${show(names(owner))}`);
  }
  assert(!names(admin).includes('lifecycle owner-thing') && names(admin).includes('graph echo-inputs'),
    `an admin's list must leave out owner-only operations and keep the rest; got ${show(names(admin))}`);
  const echo = owner.operations.find((o) => o.name === 'echo-inputs');
  assert(echo.inputs && echo.inputs.text && echo.inputs.text.required === true && same(echo.inputs.limit.schema, ECHO_INPUTS.limit.schema),
    `inputs carry { schema, required, description } as declared; got ${show(echo.inputs)}`);
  for (const c of ['unknown-input', 'missing-input', 'invalid-input']) assert(codesOf(echo).includes(c), `echo-inputs can return ${c}; got ${show(codesOf(echo))}`);
  const write = owner.operations.find((o) => o.name === 'write-thing');
  assert(write.method === 'POST' && codesOf(write).includes('invalid-body'), `write-thing is a POST and can return invalid-body; got ${show({ method: write.method, codes: codesOf(write) })}`);
  const refusing = owner.operations.find((o) => o.name === 'refusing');
  const nf = (refusing.refusals || []).find((x) => x.code === 'not-found');
  assert(nf && nf.status === 404 && typeof nf.when === 'string', `refusing's own refusal must be listed { code, status, when }; got ${show(refusing.refusals)}`);
  const probFiles = (owner.problems || []).map((p) => String(p.file).replace(/\\/g, '/'));
  for (const f of ['graph/visible.js', 'graph/signed.js']) assert(probFiles.some((x) => x.endsWith(f)), `the list's problems must name ${f}; got ${show(owner.problems)}`);
  assert(!probFiles.some((x) => /parts|_shared/.test(x)), `helper files are not problems; got ${show(owner.problems)}`);
  assert(got('h14-list-visitor').status === 401 && got('h14-list-stranger').status === 403,
    `the list refuses a visitor 401 and a stranger 403; got ${got('h14-list-visitor').status} and ${got('h14-list-stranger').status}`);
});

test('H16: the list names its caller: the owner and an admin with their pubkeys, and a direct-local caller as local (graph-operations-foundation #6, ADR 0006 Decision 7)', () => {
  const want = [['h13-list-owner', { role: 'owner', pubkey: OWNER }], ['h13-list-admin', { role: 'admin', pubkey: ADMIN }], ['h16-list-local', { role: 'local', pubkey: null }]];
  for (const [id, caller] of want) {
    const data = listOf(id);
    assert(data.caller && same(data.caller, caller), `${id}: the list's data.caller must be ${show(caller)}, so a client can tell the owner from an admin; got ${show(data.caller)}`);
    assert(Array.isArray(data.operations) && Array.isArray(data.problems), `${id}: operations and problems stay beside caller; got ${show(Object.keys(data))}`);
  }
});

// ── C: the command ────────────────────────────────────────────────────────────────────────────────────────────────

test('C1: `tapestry lifecycle status` prints exactly the route\'s answer, with no sign-in, and exits 0 (AC3)', () => {
  const c = got('c1-status');
  assert(c.code === 0, `the command must exit 0; got ${show(c.code)} (stderr: ${String(c.stderr).slice(-300)})`);
  const j = stdoutJson(c);
  assert(j, `stdout must be the JSON answer and nothing else; got ${show(String(c.stdout).slice(0, 300))}`);
  assert(same(j, got('h1-owner').body), `the command must print what the route returns; got ${show(j)} vs ${show(got('h1-owner').body)}`);
  assert(!c.leaked, `nothing may reach the process's stdout but the answer; leaked ${show(String(c.leaked).slice(0, 200))}`);
});

test('C2: `tapestry` on its own (and `help`, `--help`) lists every operation by group with its summary; `tapestry lifecycle` lists one group', () => {
  mustExist(BIN, 'ADR Decision 7');
  const summary = statusDecl().summary;
  for (const args of [[], ['help'], ['--help']]) {
    const r = runBin(args);
    assert(r.status === 0, `tapestry ${args.join(' ')} must exit 0; got ${r.status}: ${(r.stderr || '').slice(-300)}`);
    assert(/lifecycle/.test(r.stdout) && /\bstatus\b/.test(r.stdout) && r.stdout.includes(summary),
      `tapestry ${args.join(' ')} must list lifecycle, status and its summary; got ${show(r.stdout.slice(0, 400))}`);
  }
  const g = runBin(['lifecycle']);
  assert(g.status === 0 && /\bstatus\b/.test(g.stdout) && g.stdout.includes(summary), `tapestry lifecycle must list the group's operations; got ${g.status} ${show(g.stdout.slice(0, 300))}`);
});

test('C3: an unknown group or operation exits 2 with a message that lists what exists', () => {
  mustExist(BIN, 'ADR Decision 7');
  const op = runBin(['lifecycle', 'stats']);
  assert(op.status === 2 && /lifecycle status|\bstatus\b/.test(op.stdout + op.stderr), `tapestry lifecycle stats must exit 2 naming 'status'; got ${op.status} ${show((op.stdout + op.stderr).slice(0, 300))}`);
  const grp = runBin(['nosuchgroup', 'x']);
  assert(grp.status === 2 && /lifecycle/.test(grp.stdout + grp.stderr), `an unknown group must exit 2 naming the groups that exist; got ${grp.status} ${show((grp.stdout + grp.stderr).slice(0, 300))}`);
  const fop = got('c3-unknown-op');
  assert(fop.code === 2 && /echo-inputs/.test(fop.stdout + fop.stderr), `in the fixture catalog, graph nope must exit 2 naming its operations; got ${show(fop.code)} ${show(String(fop.stdout + fop.stderr).slice(0, 300))}`);
  const fgrp = got('c3-unknown-group');
  assert(fgrp.code === 2 && /graph/.test(fgrp.stdout + fgrp.stderr), `an unknown group must exit 2 naming the groups; got ${show(fgrp.code)}`);
});

test('C4: the command takes the declared inputs by name and refuses as the route does: unknown, missing or ill-typed → exit 1 with the same JSON', () => {
  const typed = got('c4-typed');
  assert(typed.code === 0 && same((stdoutJson(typed) || {}).data && stdoutJson(typed).data.inputs, { text: 'hi', limit: 5, tags: ['a', 'b'], flag: true }),
    `--text hi --limit 5 --tags a --tags b --flag must arrive typed; got ${show(typed.code)} ${show(typed.stdout)}`);
  const eq = got('c4-equals');
  assert(eq.code === 0 && same(stdoutJson(eq).data.inputs, { text: 'hi', limit: 7 }), `--name=value works too; got ${show(eq.stdout)}`);
  for (const [id, code, input] of [['c4-unknown', 'unknown-input', 'bogus'], ['c4-missing', 'missing-input', 'text'], ['c4-badtype', 'invalid-input', 'limit']]) {
    const r = got(id);
    const j = stdoutJson(r) || {};
    assert(r.code === 1 && j.success === false && j.code === code && j.input === input, `${id}: want exit 1 and ${code} naming '${input}'; got ${show(r.code)} ${show(r.stdout)}`);
  }
  assert(got('c4-positional').code === 2, `a stray positional word is a usage error (exit 2); got ${show(got('c4-positional').code)}`);
  const dec = got('c4-declared');
  assert(dec.code === 1 && (stdoutJson(dec) || {}).code === 'not-found', `a declared refusal exits 1 with its code; got ${show(dec.code)} ${show(dec.stdout)}`);
  const fail = got('c4-failed');
  assert(fail.code === 3 && (stdoutJson(fail) || {}).code === 'failed', `a failure exits 3 with code failed; got ${show(fail.code)} ${show(fail.stdout)}`);
});

test('C5: the command runs an owner-only operation with no sign-in, as a local caller', () => {
  const r = got('c5-owner-only');
  assert(r.code === 0 && (stdoutJson(r) || {}).success === true, `lifecycle owner-thing must run from the command; got ${show(r.code)} ${show(r.stdout)}`);
  const c = stdoutJson(got('c5-context')) || {};
  assert(c.data && c.data.via === 'cli' && c.data.role === 'local', `the command's context is { via: 'cli', caller.role: 'local' }; got ${show(c.data)}`);
});

test('C6: bin/tapestry.js is an executable node script, and the Dockerfile links it onto PATH as tapestry', () => {
  mustExist(BIN, 'ADR Decision 7');
  const first = fs.readFileSync(BIN, 'utf8').split(NL)[0];
  assert(first === '#!/usr/bin/env node', `bin/tapestry.js must start with #!/usr/bin/env node; got ${show(first)}`);
  assert((fs.statSync(BIN).mode & 0o111) !== 0, 'bin/tapestry.js must be executable (mode 100755)');
  const docker = fs.readFileSync(DOCKERFILE, 'utf8');
  assert(/ln\s+-sf?\s+\/usr\/local\/lib\/node_modules\/brainstorm\/bin\/tapestry\.js\s+\/usr\/local\/bin\/tapestry\b/.test(docker),
    'the Dockerfile must link /usr/local/lib/node_modules/brainstorm/bin/tapestry.js to /usr/local/bin/tapestry (ADR Implementation notes)');
});

test('C7: while an operation logs, the command\'s stdout carries only the answer', () => {
  const r = got('c7-noisy');
  const j = stdoutJson(r);
  assert(r.code === 0 && j && j.success === true, `graph noisy must exit 0 with its JSON answer; got ${show(r.code)} ${show(String(r.stdout).slice(0, 300))}`);
  assert(!/noise/.test(r.stdout) && !/noise/.test(r.leaked), `the operation's console output must stay off stdout; stdout ${show(r.stdout)}, leaked ${show(r.leaked)}`);
});

// A result that can't be sent as JSON, in harness runs of its own: before the fix it ended the process, so it must not
// share a process with the other results (review round 1, non-blocking 1).
let UNSERIALIZABLE = null;
function unserializable() {
  if (UNSERIALIZABLE) return UNSERIALIZABLE;
  const http = runHarness({ fixtureDir: fixtureDir(), scenarios: [{ requests: [
    { id: 'h15-unserializable', app: 'fixture', method: 'GET', url: '/api/tapestry/graph/unserializable', caller: 'owner' },
    { id: 'h15-still-answers', app: 'fixture', method: 'GET', url: `${ECHO}?text=after`, caller: 'owner' },
  ] }] });
  const cli = runHarness({ fixtureDir: fixtureDir(), scenarios: [{ cli: [{ id: 'c9-unserializable', catalog: 'fixture', argv: ['graph', 'unserializable'] }] }] });
  const pick = (h, id) => {
    assert(h.data, `the harness wrote no result — the process ended (exit ${h.child.status}): ${(h.child.stderr || '').slice(-300)}`);
    assert(!h.data.error, `the harness could not run: ${h.data.error}`);
    const r = (h.data.scenarios || []).flatMap((s) => [...(s.requests || []), ...(s.cli || [])]).find((x) => x.id === id);
    assert(r, `no harness result for ${id}`);
    return r;
  };
  UNSERIALIZABLE = { http, cli, pick };
  return UNSERIALIZABLE;
}

test('H15: an operation whose result can\'t be sent as JSON answers 500 failed, naming it, and the control panel keeps answering', () => {
  const u = unserializable();
  const r = u.pick(u.http, 'h15-unserializable');
  assert(r.status === 500 && r.body && r.body.success === false && r.body.code === 'failed' && /graph unserializable/.test(String(r.body.error)),
    `want 500 { success: false, code: 'failed' } naming graph unserializable; got ${r.status} ${show(r.body)}`);
  const after = u.pick(u.http, 'h15-still-answers');
  assert(after.status === 200 && after.body && after.body.success === true, `the next request must still be answered; got ${after.status} ${show(after.body)}`);
});

test('C9: the command answers the same case with exit 3 and the same failed JSON on stdout', () => {
  const u = unserializable();
  const r = u.pick(u.cli, 'c9-unserializable');
  const j = stdoutJson(r) || {};
  assert(r.code === 3 && j.success === false && j.code === 'failed' && /graph unserializable/.test(String(j.error)),
    `want exit 3 and { success: false, code: 'failed' } naming graph unserializable on stdout; got ${show(r.code)} ${show(String(r.stdout).slice(0, 300))}`);
});

test('C8: `tapestry <group> <name> --help` shows the operation\'s inputs, its route and who may call it, and runs nothing', () => {
  const r = got('c8-help-op');
  const out = `${r.stdout}${r.stderr}`;
  assert(r.code === 0, `--help must exit 0; got ${show(r.code)}`);
  for (const w of ['text', 'limit', 'required', ECHO]) assert(out.includes(w), `--help must mention ${show(w)}; got ${show(out.slice(0, 400))}`);
  assert(/owner and admins/i.test(out), `--help must say who may call it; got ${show(out.slice(0, 400))}`);
});

// ── D: /docs ──────────────────────────────────────────────────────────────────────────────────────────────────────

const SHELL_SPEC = () => ({ openapi: '3.0.3', info: { title: 't', version: '1' }, tags: [], paths: {} });

test('D1: the served document lists GET /api/tapestry/lifecycle/status under its group, with its summary, who may call it, its command, no inputs, its result and its refusals (AC4)', () => {
  const { withOperationDocs } = openapi();
  const doc = withOperationDocs(yaml.load(fs.readFileSync(OPENAPI, 'utf8')));
  const entry = doc.paths && doc.paths[STATUS] && doc.paths[STATUS].get;
  assert(entry, `the served document must have paths['${STATUS}'].get`);
  const decl = statusDecl();
  assert(Array.isArray(entry.tags) && entry.tags.includes('Tapestry: lifecycle'), `tagged 'Tapestry: lifecycle'; got ${show(entry.tags)}`);
  const tag = (doc.tags || []).find((t) => t.name === 'Tapestry: lifecycle');
  assert(tag && typeof tag.description === 'string' && tag.description.trim(), `the document must describe the 'Tapestry: lifecycle' tag; got ${show(tag)}`);
  assert(entry.summary === decl.summary, `the summary is the declaration's; got ${show(entry.summary)}`);
  assert(/owner and admins/i.test(entry.description || '') && String(entry.description).includes('tapestry lifecycle status'),
    `the description says who may call it and names the command; got ${show(entry.description)}`);
  assert(!(entry.parameters && entry.parameters.length) && !entry.requestBody, `no inputs: no parameters, no body; got ${show({ parameters: entry.parameters, requestBody: entry.requestBody })}`);
  for (const code of ['200', '400', '401', '403', '500']) assert(entry.responses && entry.responses[code], `responses must include ${code}; got ${show(Object.keys(entry.responses || {}))}`);
  const s200 = entry.responses['200'].content && entry.responses['200'].content['application/json'] && entry.responses['200'].content['application/json'].schema;
  assert(s200 && s200.properties && same(s200.properties.data, decl.result.schema), `the 200 schema's data must be the declaration's result schema; got ${show(s200)}`);
  assert(entry.operationId === 'tapestry-lifecycle-status', `operationId tapestry-lifecycle-status; got ${show(entry.operationId)}`);
});

test('D2: each entry follows its declaration — query parameters, a write\'s JSON body, declared refusal statuses, owner only — and changes when it does', () => {
  const { withOperationDocs } = openapi();
  const doc = withOperationDocs(SHELL_SPEC(), { dir: fixtureDir() });
  const echo = doc.paths[ECHO] && doc.paths[ECHO].get;
  assert(echo, `the fixture's ${ECHO} must be documented`);
  const params = echo.parameters || [];
  for (const [name, input] of Object.entries(ECHO_INPUTS)) {
    const p = params.find((x) => x.name === name);
    assert(p && p.in === 'query' && !!p.required === input.required && same(p.schema, input.schema),
      `parameter ${name} must be { in: query, required: ${input.required}, schema: declared }; got ${show(p)}`);
  }
  const write = doc.paths['/api/tapestry/graph/write-thing'] && doc.paths['/api/tapestry/graph/write-thing'].post;
  const body = write && write.requestBody && write.requestBody.content && write.requestBody.content['application/json'] && write.requestBody.content['application/json'].schema;
  assert(body && body.type === 'object' && same(body.properties && body.properties.n, { type: 'integer' }) && (body.required || []).includes('n') && body.additionalProperties === false,
    `write-thing's body schema must be the declared object; got ${show(body)}`);
  assert(!(write.parameters && write.parameters.length), 'a write takes no query parameters');
  const refusing = doc.paths['/api/tapestry/graph/refusing'].get;
  assert(refusing.responses && refusing.responses['404'], `a declared refusal's status must be documented; got ${show(Object.keys(refusing.responses || {}))}`);
  const owner = doc.paths['/api/tapestry/lifecycle/owner-thing'].get;
  assert(/owner only/i.test(owner.description || '') && !/owner and admins/i.test(owner.description || ''), `an owner-only entry says so; got ${show(owner.description)}`);
  assert(!doc.paths['/api/tapestry/graph/visible'] && !doc.paths['/api/tapestry/graph/signed'], 'an invalid declaration is not documented');
  const changed = writeCatalog(tmp('ops-fixture-changed-'), fixtureFiles({ echoSummary: 'A changed summary' }));
  const doc2 = withOperationDocs(SHELL_SPEC(), { dir: changed });
  assert(doc2.paths[ECHO].get.summary === 'A changed summary' && echo.summary === 'Echo the inputs it was given',
    `changing the declaration must change the entry; got ${show(echo.summary)} then ${show(doc2.paths[ECHO].get.summary)}`);
});

test('D3: the list route is documented too, for the owner and admins', () => {
  const { withOperationDocs } = openapi();
  const doc = withOperationDocs(yaml.load(fs.readFileSync(OPENAPI, 'utf8')));
  const e = doc.paths[LIST] && doc.paths[LIST].get;
  assert(e && e.responses && e.responses['200'] && e.responses['401'] && e.responses['403'], `GET ${LIST} must be documented with 200, 401 and 403; got ${show(e)}`);
});

test('D6: the list route\'s /docs entry describes the caller it names (graph-operations-foundation #6, ADR 0006 Decision 7)', () => {
  const { withOperationDocs } = openapi();
  const doc = withOperationDocs(yaml.load(fs.readFileSync(OPENAPI, 'utf8')));
  const e = doc.paths[LIST] && doc.paths[LIST].get;
  // The entry's description already says "the caller may call"; the answer's own shape must name the field.
  const ok = (e && e.responses && e.responses['200'] && e.responses['200'].description) || '';
  assert(/\bcaller\b/.test(ok), `GET ${LIST}'s 200 response must name data.caller beside operations and problems; got ${show(ok)}`);
  assert(/\bowner\b/.test(e.description) && /\badmin\b/.test(e.description) && /\blocal\b/.test(e.description),
    `its description must say caller.role is owner, admin or local; got ${show(e.description)}`);
});

test('D4: withOperationDocs leaves the loaded YAML unchanged, and refuses a path the YAML already documents', () => {
  const { withOperationDocs } = openapi();
  const spec = yaml.load(fs.readFileSync(OPENAPI, 'utf8'));
  const before = JSON.stringify(spec);
  const doc = withOperationDocs(spec);
  assert(JSON.stringify(spec) === before, 'the YAML object passed in must not be changed');
  assert(doc !== spec && Object.keys(doc.paths).length > Object.keys(spec.paths).length, 'it returns a new document with the operations added');
  const dup = { ...SHELL_SPEC(), paths: { [STATUS]: { get: { responses: { 200: { description: 'hand-written' } } } } } };
  let threw = null;
  try { withOperationDocs(dup); } catch (e) { threw = e; }
  assert(threw && String(threw.message).includes(STATUS), `a hand-written entry for a generated path must be refused, naming it; got ${threw ? show(threw.message) : 'no error'}`);
});

test('D5: the entrypoint serves withOperationDocs of the YAML at /docs', () => {
  const src = fs.readFileSync(ENTRYPOINT, 'utf8');
  assert(/const\s+openapiSpec\s*=\s*require\([^)]*src\/operations\/openapi[^)]*\)\.withOperationDocs\(\s*yaml\.load\(/.test(src) ||
         /withOperationDocs\(\s*yaml\.load\(\s*fs\.readFileSync\([^;]*openapi\.yaml/.test(src),
    'bin/control-panel.js must build openapiSpec as withOperationDocs(yaml.load(…openapi.yaml…)) (ADR Decision 6)');
  assert(/swaggerUi\.setup\(\s*openapiSpec\b/.test(src), 'and serve that openapiSpec at /docs');
});

// ── S: no hand-kept list ──────────────────────────────────────────────────────────────────────────────────────────

function filesUnder(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') out.push(...filesUnder(p)); } else out.push(p);
  }
  return out;
}

test('S1: no file outside the declaration names lifecycle status\'s route or path — nothing lists operations by hand (AC6)', () => {
  statusDecl();
  const scanned = [...filesUnder(path.join(ROOT, 'src')), ...filesUnder(path.join(ROOT, 'bin')), path.join(ROOT, 'test/registry.js')]
    .filter((f) => /\.(js|json|yaml|yml|sh)$/.test(f) && path.resolve(f) !== path.resolve(STATUS_FILE));
  const hits = scanned.filter((f) => { const t = fs.readFileSync(f, 'utf8'); return t.includes(STATUS) || t.includes('lifecycle/status'); });
  assert(hits.length === 0, `these files name the operation by hand: ${show(hits.map((f) => path.relative(ROOT, f)))}`);
});

// ── X: AC6 in a throwaway copy ────────────────────────────────────────────────────────────────────────────────────

const DEMO_FILES = {
  'graph/demo-echo.js': declSource({
    ...BASE, group: 'graph', name: 'demo-echo', summary: 'Echo some text (demo)',
    inputs: { text: { schema: { type: 'string' }, required: true, description: 'Text' } },
  }, { run: `async run(inputs) { console.log('demo-echo-noise'); return { text: inputs.text }; }` }),
  'graph/demo-write.js': declSource({
    ...BASE, group: 'graph', name: 'demo-write', kind: 'write', access: 'owner-only', summary: 'Write a number (demo)',
    inputs: { n: { schema: { type: 'integer' }, required: true, description: 'A number' } },
  }, { run: 'async run(inputs) { return { n: inputs.n }; }' }),
};

let COPY = null;
/** A copy of the tree under test with ONLY the two demo declarations added. */
function copyWithDemo() {
  if (COPY) return COPY;
  operationsIndex();
  const dir = tmp('ops-copy-');
  for (const d of ['src', 'lib', 'firmware', 'bin']) fs.cpSync(path.join(ROOT, d), path.join(dir, d), { recursive: true, verbatimSymlinks: true });
  for (const f of ['package.json', 'test/admin-action-sweep.test.js', 'test/openapi-coverage.test.js', 'test/helpers/routeWalk.js',
    'test/helpers/operationsHarness.js', 'test/fixtures/openapi-known-gaps.json']) {
    if (!fs.existsSync(path.join(ROOT, f))) continue;
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  }
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'));
  for (const rel of Object.keys(DEMO_FILES)) {
    assert(!fs.existsSync(path.join(CATALOG, rel)), `the real catalog already has ${rel}; the demo must be new`);
  }
  writeCatalog(path.join(dir, 'src/operations/catalog'), DEMO_FILES);
  COPY = dir;
  return dir;
}
const failLines = (out) => String(out || '').split(NL).filter((l) => /^\s+FAIL\s/.test(l)).join(NL).slice(0, 800);

test('X1: in a copy with only two new declaration files, the routes are registered and in the table and the served document, and the sweep and the coverage gate pass', () => {
  const dir = copyWithDemo();
  const w = walk(dir);
  assert(w.data && !w.data.registerError, `the copy's route walk failed: ${(w.data && w.data.registerError) || (w.child.stderr || '').slice(-300)}`);
  assert(walkHas(w, 'GET', '/api/tapestry/graph/demo-echo') && walkHas(w, 'POST', '/api/tapestry/graph/demo-write'),
    'the copy registers GET /api/tapestry/graph/demo-echo and POST /api/tapestry/graph/demo-write with no other file changed');
  const script = [
    `const fs = require('fs');`,
    `const t = require(${show(path.join(dir, 'src/middleware/routeAccess.js'))}).ROUTE_ACCESS;`,
    `const yaml = require(require.resolve('js-yaml', { paths: [${show(dir)}] }));`,
    `const doc = require(${show(path.join(dir, 'src/operations/openapi.js'))}).withOperationDocs(yaml.load(fs.readFileSync(${show(path.join(dir, 'src/api/openapi.yaml'))}, 'utf8')));`,
    `process.stdout.write('RESULT:' + JSON.stringify({ echo: t['GET /api/tapestry/graph/demo-echo'], write: t['POST /api/tapestry/graph/demo-write'],`,
    `  docEcho: !!(doc.paths['/api/tapestry/graph/demo-echo'] || {}).get, docWrite: !!(doc.paths['/api/tapestry/graph/demo-write'] || {}).post }) + '\\n');`,
  ].join(NL);
  const r = spawnSync(process.execPath, ['-e', script], { ...SPAWN, cwd: dir, env: childEnv(tmp('ops-x1-')), timeout: 60000 });
  const line = (r.stdout || '').split(NL).find((l) => l.startsWith('RESULT:'));
  assert(line, `the copy's table and document could not be read (exit ${r.status}): ${(r.stderr || '').slice(-400)}`);
  const x = JSON.parse(line.slice(7));
  assert(x.echo && x.echo.access === 'owner' && x.echo.kind === 'read', `the copy's table must hold GET demo-echo as owner read; got ${show(x.echo)}`);
  assert(x.write && x.write.access === 'owner-only' && x.write.kind === 'action', `the copy's table must hold POST demo-write as owner-only action; got ${show(x.write)}`);
  assert(x.docEcho && x.docWrite, `the copy's served document must list both; got ${show(x)}`);
  const sweep = spawnSync(process.execPath, [path.join(dir, 'test/admin-action-sweep.test.js')], { ...SPAWN, cwd: dir, env: childEnv(tmp('ops-x1s-')), timeout: 180000 });
  assert(sweep.status === 0, `the route-table sweep must pass in the copy; it exited ${sweep.status}:${NL}${failLines(sweep.stdout) || (sweep.stderr || '').slice(-400)}`);
  const cov = spawnSync(process.execPath, [path.join(dir, 'test/openapi-coverage.test.js')],
    { ...SPAWN, cwd: dir, env: { ...childEnv(tmp('ops-x1c-')), OPENAPI_COVERAGE_SKIP_DEMO: '1' }, timeout: 240000 });
  assert(cov.status === 0, `the /docs coverage gate must pass in the copy; it exited ${cov.status}:${NL}${failLines(cov.stdout) || (cov.stderr || '').slice(-400)}`);
});

test('X2: in the same copy, the router answers the new operations for the owner, the list shows them, and the copy\'s command runs one with only the answer on stdout', () => {
  const dir = copyWithDemo();
  const { child, data } = runHarness({
    root: dir,
    scenarios: [{
      requests: [
        { id: 'x-echo', app: 'real', method: 'GET', url: '/api/tapestry/graph/demo-echo?text=hi', caller: 'owner' },
        { id: 'x-write', app: 'real', method: 'POST', url: '/api/tapestry/graph/demo-write', caller: 'owner', body: { n: 2 } },
        { id: 'x-write-admin', app: 'real', method: 'POST', url: '/api/tapestry/graph/demo-write', caller: 'admin', body: { n: 2 } },
        { id: 'x-list', app: 'real', method: 'GET', url: LIST, caller: 'owner' },
      ],
    }],
  });
  assert(data && !data.error, `the copy's harness failed: ${(data && data.error) || (child.stderr || '').slice(-400)}`);
  const by = new Map((data.scenarios[0].requests || []).map((r) => [r.id, r]));
  const e = by.get('x-echo');
  assert(e.status === 200 && e.body.data && e.body.data.text === 'hi', `GET demo-echo?text=hi must answer 200 with text hi; got ${e.status} ${show(e.body)}`);
  const wr = by.get('x-write');
  assert(wr.status === 200 && wr.body.data && wr.body.data.n === 2, `POST demo-write must answer the owner; got ${wr.status} ${show(wr.body)}`);
  const wa = by.get('x-write-admin');
  assert(wa.status === 403 && /owner/i.test(String(wa.body && wa.body.error)), `owner-only demo-write must refuse an admin 403; got ${wa.status} ${show(wa.body)}`);
  const names = ((by.get('x-list').body.data || {}).operations || []).map((o) => `${o.group} ${o.name}`);
  assert(names.includes('graph demo-echo') && names.includes('graph demo-write'), `the copy's list must include the new operations; got ${show(names)}`);
  const cli = runBin(['graph', 'demo-echo', '--text', 'hi'], dir);
  let j = null;
  try { j = JSON.parse(cli.stdout); } catch { /* reported below */ }
  assert(cli.status === 0 && j && j.success === true && j.data && j.data.text === 'hi',
    `the copy's tapestry graph demo-echo --text hi must exit 0 with its JSON answer as the whole of stdout; got ${cli.status} ${show(String(cli.stdout).slice(0, 300))} ${String(cli.stderr).slice(-300)}`);
  assert(!/demo-echo-noise/.test(cli.stdout), 'the operation\'s console.log must not reach the command\'s stdout');
});

// ── F: file results and file bodies (graph-operations-foundation #2, ADR graph-operations-foundation/0002 Decision 10)

const FILE_READ = '/api/tapestry/graph/file-read';
const FILE_WRITE = '/api/tapestry/graph/file-write';
const AFTER = '/api/tapestry/graph/after-answer';
/** The bytes file-read answers with: `size` bytes, (i * 7) mod 256. */
const fileBytes = (size) => Buffer.from(Array.from({ length: size }, (_, i) => (i * 7) % 256));
function fileFixtureFiles() {
  const read = { ...BASE, group: 'graph', name: 'file-read', summary: 'Answer with a file',
    inputs: { size: { schema: { type: 'integer', minimum: 1, maximum: 100000, default: 1500 }, required: false, description: 'How many bytes' } },
    result: { description: 'Some bytes', file: { contentType: 'application/octet-stream' } } };
  const write = { ...BASE, group: 'graph', name: 'file-write', kind: 'write', summary: 'Take a file',
    inputs: { label: { schema: { type: 'string', minLength: 1 }, required: true, description: 'A label' } },
    body: { file: { contentTypes: ['application/octet-stream'], maxBytes: 4096 } },
    result: { description: 'What arrived', schema: { type: 'object' } } };
  return {
    'graph/file-read.js': declSource(read, {
      run: `async run(inputs) { const buf = Buffer.from(Array.from({ length: inputs.size }, (_, i) => (i * 7) % 256)); return { file: { name: 'demo.bin', size: buf.length, contentType: 'application/octet-stream', open: () => require('stream').Readable.from([buf]) } }; }`,
    }),
    'graph/file-write.js': declSource(write, {
      run: `async run(inputs, context) { const r = (globalThis.__opsRuns = globalThis.__opsRuns || {}); r['file-write:' + inputs.label] = (r['file-write:' + inputs.label] || 0) + 1; const chunks = []; for await (const c of context.body) chunks.push(Buffer.from(c)); const b = Buffer.concat(chunks); return { label: inputs.label, size: b.length, sha256: require('crypto').createHash('sha256').update(b).digest('hex') }; }`,
    }),
    'graph/after-answer.js': declSource({ ...BASE, group: 'graph', name: 'after-answer', summary: 'Do something once it has answered' }, {
      run: `async run(inputs, context) { context.afterAnswer(async () => { const startedAt = Date.now(); await new Promise((res) => setTimeout(res, 400)); const r = (globalThis.__opsRuns = globalThis.__opsRuns || {}); r['after:' + context.via] = { startedAt, endedAt: Date.now() }; }); return { ok: true }; }`,
    }),
    // Review round 1: a client that gives up before a slow operation answers must not stop its after-answer work.
    'graph/slow-after.js': declSource({ ...BASE, group: 'graph', name: 'slow-after', summary: 'Answer slowly, then do something' }, {
      run: `async run(inputs, context) { await new Promise((res) => setTimeout(res, 500)); context.afterAnswer(async () => { const r = (globalThis.__opsRuns = globalThis.__opsRuns || {}); r['slow-after:' + context.via] = Date.now(); }); return { ok: true }; }`,
    }),
    // Invalid: a file result on a write, a file body on a read, a result with both, a body with no sensible limit.
    'graph/file-on-write.js': declSource({ ...read, name: 'file-on-write', kind: 'write' }),
    'graph/body-on-read.js': declSource({ ...BASE, group: 'graph', name: 'body-on-read', body: write.body }),
    'graph/schema-and-file.js': declSource({ ...BASE, group: 'graph', name: 'schema-and-file', result: { schema: { type: 'object' }, file: { contentType: 'application/octet-stream' } } }),
    'graph/bad-max.js': declSource({ ...write, name: 'bad-max', body: { file: { contentTypes: ['application/octet-stream'], maxBytes: -1 } } }),
  };
}
let FILE_FIX = null;
function fileFixtureDir() { if (!FILE_FIX) FILE_FIX = writeCatalog(tmp('ops-file-fixture-'), fileFixtureFiles()); return FILE_FIX; }

let FILES_RUN = null;
function filesRun() {
  if (FILES_RUN) return FILES_RUN;
  operationsIndex();
  const b64 = (buf) => buf.toString('base64');
  const write = (id, caller, label, bytes, extra = {}) => ({ id, app: 'fixture', method: 'POST', url: `${FILE_WRITE}${label ? `?label=${label}` : ''}`, caller, contentType: 'application/octet-stream', rawBase64: b64(bytes), ...extra });
  FILES_RUN = runHarness({
    fixtureDir: fileFixtureDir(),
    scenarios: [{
      pauseMs: 700,
      requests: [
        { id: 'fr-owner', app: 'fixture', method: 'GET', url: `${FILE_READ}?size=1500`, caller: 'owner' },
        { id: 'fr-visitor', app: 'fixture', method: 'GET', url: FILE_READ, caller: 'visitor' },
        write('fw-ok', 'admin', 'ok', fileBytes(3000)),
        write('fw-type', 'owner', 'texty', fileBytes(100), { contentType: 'text/plain' }),
        write('fw-declared', 'owner', 'declared', fileBytes(5000)),
        write('fw-chunked', 'owner', 'chunked', fileBytes(5000), { headers: { 'Transfer-Encoding': 'chunked' } }),
        write('fw-nolabel', 'owner', null, fileBytes(10)),
        { id: 'after', app: 'fixture', method: 'GET', url: AFTER, caller: 'owner' },
        { id: 'list', app: 'fixture', method: 'GET', url: LIST, caller: 'owner' },
        { id: 'gave-up', app: 'fixture', method: 'GET', url: '/api/tapestry/graph/slow-after', caller: 'owner', abortAfterMs: 150 },
      ],
      cli: [
        { id: 'c-read', catalog: 'fixture', argv: ['graph', 'file-read', '--size', '600'] },
        { id: 'c-read-tty', catalog: 'fixture', argv: ['graph', 'file-read'], stdoutIsTTY: true },
        { id: 'c-write', catalog: 'fixture', argv: ['graph', 'file-write', '--label', 'cli'], stdinBase64: b64(fileBytes(700)) },
        { id: 'c-write-tty', catalog: 'fixture', argv: ['graph', 'file-write', '--label', 'tty'], stdinIsTTY: true },
        { id: 'c-after', catalog: 'fixture', argv: ['graph', 'after-answer'] },
      ],
    }],
  });
  return FILES_RUN;
}
function fgot(id) {
  const m = filesRun();
  assert(m.data && !m.data.error, `the harness failed: ${(m.data && m.data.error) || (m.child.stderr || '').slice(-500)}`);
  const r = m.data.scenarios[0].requests.find((x) => x.id === id) || m.data.scenarios[0].cli.find((x) => x.id === id);
  assert(r, `no result for ${id}`);
  return r;
}
const frun = (key) => ((filesRun().data && filesRun().data.runs) || {})[key];
const sha = (buf) => require('crypto').createHash('sha256').update(buf).digest('hex');

test('F1: a read may answer with a file and a write may take one; a file result on a write, a body on a read, both kinds of result, or a bad limit is invalid', () => {
  const { loadOperations } = operationsIndex();
  const { operations, problems } = loadOperations({ dir: fileFixtureDir() });
  const names = operations.map((o) => o.name).sort();
  assert(same(names, ['after-answer', 'file-read', 'file-write', 'slow-after']), `the four valid fixtures load; got ${show(names)}`);
  const bad = problems.map((p) => p.file).sort();
  assert(same(bad, ['graph/bad-max.js', 'graph/body-on-read.js', 'graph/file-on-write.js', 'graph/schema-and-file.js']), `the four invalid ones are reported; got ${show(problems)}`);
  for (const p of problems) assert(/file|body|maxBytes/i.test(p.problem), `${p.file}'s problem says what is wrong with its file or body; got ${show(p.problem)}`);
});

test('F2: a file result is sent as the file — its type, length, attachment name, no-store and nosniff — byte for byte', () => {
  const r = fgot('fr-owner');
  const h = r.headers || {};
  const body = Buffer.from(r.bodyBase64 || '', 'base64');
  assert(r.status === 200 && body.equals(fileBytes(1500)), `200 with the file's 1500 bytes; got ${r.status}, ${body.length} bytes`);
  assert(String(h['content-type']).startsWith('application/octet-stream') && Number(h['content-length']) === 1500, `Content-Type and Content-Length; got ${show(h)}`);
  assert(h['content-disposition'] === 'attachment; filename="demo.bin"' && /no-store/.test(String(h['cache-control'])) && h['x-content-type-options'] === 'nosniff',
    `attachment; filename, no-store and nosniff; got ${show({ cd: h['content-disposition'], cc: h['cache-control'], x: h['x-content-type-options'] })}`);
  const v = fgot('fr-visitor');
  assert(v.status === 401 && v.body && v.body.success === false && /owner/i.test(String(v.body.error)), `a visitor still gets the central check's JSON 401; got ${v.status} ${show(v.body)}`);
});

test('F3: a file body arrives as a stream with its other inputs from the query; another type is 415 and too big is 413, without running', () => {
  const ok = fgot('fw-ok');
  assert(ok.status === 200 && ok.body.data && ok.body.data.label === 'ok' && ok.body.data.size === 3000 && ok.body.data.sha256 === sha(fileBytes(3000)),
    `the operation reads the 3000 bytes it was sent, with label from the query; got ${ok.status} ${show(ok.body)}`);
  const t = fgot('fw-type');
  assert(t.status === 415 && t.body.code === 'wrong-content-type' && !frun('file-write:texty'), `text/plain is 415 wrong-content-type and never runs; got ${t.status} ${show(t.body)} runs ${show(frun('file-write:texty'))}`);
  const d = fgot('fw-declared');
  assert(d.status === 413 && d.body.code === 'too-large' && !frun('file-write:declared'), `a Content-Length over maxBytes is 413 too-large and never runs; got ${d.status} ${show(d.body)}`);
  const c = fgot('fw-chunked');
  assert(c.status === 413 && c.body.code === 'too-large', `a chunked body that grows past maxBytes is 413 too-large; got ${c.status} ${show(c.body)}`);
  const n = fgot('fw-nolabel');
  assert(n.status === 400 && n.body.code === 'missing-input' && n.body.input === 'label', `a missing query input is 400 missing-input; got ${n.status} ${show(n.body)}`);
});

test('F4: afterAnswer work runs once the route has answered, and before the command exits', () => {
  const r = fgot('after');
  const http = frun('after:http');
  assert(r.status === 200 && http && http.endedAt, `the after-answer work ran for the route; got ${r.status} ${show(http)}`);
  assert(r.at < http.endedAt, `the answer arrived while the after-answer work was still running (answered ${r.at}, work ended ${http.endedAt})`);
  const c = fgot('c-after');
  const cli = frun('after:cli');
  assert(c.code === 0 && cli && c.endedAt >= cli.endedAt, `the command waits for the after-answer work before it exits; got ${show({ code: c.code, ended: c.endedAt, work: cli })}`);
});

test('F8: after-answer work runs even when the client gave up before the answer (review round 1)', () => {
  const r = fgot('gave-up');
  assert(r.aborted === true, `the client gave up before the answer; got ${show(r)}`);
  assert(typeof frun('slow-after:http') === 'number', `the operation's after-answer work still ran once it had answered; runs: ${show(filesRun().data && filesRun().data.runs)}`);
});

test('F5: the command writes a file result to stdout and reads a file body from stdin, and refuses a terminal for either (exit 2)', () => {
  const r = fgot('c-read');
  assert(r.code === 0 && Buffer.from(r.stdoutBase64, 'base64').equals(fileBytes(600)), `exit 0 and the 600 bytes on stdout; got ${show(r.code)} ${Buffer.from(r.stdoutBase64 || '', 'base64').length} bytes`);
  const rt = fgot('c-read-tty');
  assert(rt.code === 2 && !rt.stdoutBase64 && />/.test(rt.stderr), `to a terminal: exit 2, nothing written, a hint to redirect; got ${show(rt.code)} ${show(rt.stderr)}`);
  const w = fgot('c-write');
  let j = null;
  try { j = JSON.parse(w.stdout); } catch { /* reported below */ }
  assert(w.code === 0 && j && j.data && j.data.size === 700 && j.data.sha256 === sha(fileBytes(700)), `stdin's 700 bytes arrive; got ${show(w.code)} ${show(w.stdout)}`);
  const wt = fgot('c-write-tty');
  assert(wt.code === 2 && /</.test(wt.stderr) && !frun('file-write:tty'), `from a terminal: exit 2, a hint to send the file on stdin, and it never runs; got ${show(wt.code)} ${show(wt.stderr)}`);
});

test('F6: /docs documents a file result and a file body as binary content, with the body\'s inputs as query parameters and 413 and 415', () => {
  const { withOperationDocs } = openapi();
  const doc = withOperationDocs(SHELL_SPEC(), { dir: fileFixtureDir() });
  const read = doc.paths[FILE_READ] && doc.paths[FILE_READ].get;
  const r200 = read && read.responses && read.responses['200'] && read.responses['200'].content;
  assert(r200 && r200['application/octet-stream'] && same(r200['application/octet-stream'].schema, { type: 'string', format: 'binary' }),
    `file-read's 200 is binary application/octet-stream; got ${show(r200)}`);
  assert((read.parameters || []).some((p) => p.name === 'size' && p.in === 'query'), 'file-read keeps its query parameter');
  const write = doc.paths[FILE_WRITE] && doc.paths[FILE_WRITE].post;
  const body = write && write.requestBody && write.requestBody.content;
  assert(body && body['application/octet-stream'] && same(body['application/octet-stream'].schema, { type: 'string', format: 'binary' }) && !body['application/json'],
    `file-write's body is binary application/octet-stream; got ${show(body)}`);
  assert((write.parameters || []).some((p) => p.name === 'label' && p.in === 'query' && p.required === true), `file-write's label is a required query parameter; got ${show(write.parameters)}`);
  assert(write.responses && write.responses['413'] && write.responses['415'], `413 and 415 are documented; got ${show(Object.keys(write.responses || {}))}`);
});

test('F7: the list carries a file result and a file body, and their refusals', () => {
  const r = fgot('list');
  const ops = (r.body && r.body.data && r.body.data.operations) || [];
  const read = ops.find((o) => o.name === 'file-read');
  const write = ops.find((o) => o.name === 'file-write');
  assert(read && read.result && read.result.file && read.result.file.contentType === 'application/octet-stream', `file-read's entry has result.file; got ${show(read)}`);
  assert(write && write.body && write.body.file && same(write.body.file.contentTypes, ['application/octet-stream']) && write.body.file.maxBytes === 4096, `file-write's entry has its body; got ${show(write && write.body)}`);
  const codes = Object.fromEntries((write.refusals || []).map((x) => [x.code, x.status]));
  assert(codes['wrong-content-type'] === 415 && codes['too-large'] === 413 && !('invalid-body' in codes), `file-write can refuse 415 and 413, never invalid-body; got ${show(codes)}`);
});

// ── T: per-operation suites ───────────────────────────────────────────────────────────────────────────────────────

/** Every *.test.js under `dir`, sorted, as absolute paths. */
function discoverSuites(dir) {
  return filesUnder(dir).filter((f) => f.endsWith('.test.js')).sort();
}
/** Run discovered suites; a file that exports no run() is a failure of its own. */
async function runDiscovered(files, base) {
  const total = { pass: 0, fail: 0, skipped: 0, failures: [] };
  for (const f of files) {
    const rel = path.relative(base, f);
    let mod;
    try { mod = require(f); } catch (e) { total.fail++; total.failures.push({ name: rel, message: `failed to load: ${e.message}` }); console.log(`  FAIL  ${rel} failed to load: ${e.message}`); continue; }
    if (!mod || typeof mod.run !== 'function') {
      total.fail++;
      total.failures.push({ name: rel, message: `${rel} exports no run()` });
      console.log(`  FAIL  ${rel} exports no run() — a suite under test/operations/ must export run()`);
      continue;
    }
    try {
      const r = (await mod.run()) || {};
      total.pass += r.pass || 0;
      total.fail += r.fail ?? r.failed ?? 0;
      total.skipped += r.skipped || 0;
      for (const x of r.failures || []) total.failures.push({ name: `${rel}: ${x.name}`, message: x.message });
    } catch (e) {
      total.fail++;
      total.failures.push({ name: rel, message: `threw: ${e.message}` });
      console.log(`  FAIL  ${rel} threw: ${e.message}`);
    }
  }
  return total;
}

test('T1: suites under test/operations/ are found and run, a file there that exports no run() fails, and lifecycle status has its own', async () => {
  const dir = tmp('ops-discover-');
  writeCatalog(dir, {
    'good.test.js': `module.exports = { run: async () => ({ pass: 2, fail: 0, skipped: 0, failures: [] }) };${NL}`,
    'nested/also.test.js': `module.exports = { run: async () => ({ pass: 2, fail: 0, skipped: 1, failures: [] }) };${NL}`,
    'bad.test.js': `module.exports = {};${NL}`,
    'helper.js': `module.exports = {};${NL}`,
  });
  const files = discoverSuites(dir).map((f) => path.relative(dir, f).replace(/\\/g, '/'));
  assert(same(files, ['bad.test.js', 'good.test.js', 'nested/also.test.js']), `discovery finds every *.test.js, nested too, and nothing else; got ${show(files)}`);
  const quiet = console.log; console.log = () => {};
  let r;
  try { r = await runDiscovered(discoverSuites(dir), dir); } finally { console.log = quiet; }
  assert(r.pass === 4 && r.skipped === 1 && r.fail === 1 && r.failures.some((x) => /bad\.test\.js exports no run/.test(x.message)),
    `results add up and the file with no run() fails, named; got ${show(r)}`);
  const real = discoverSuites(OPS_TESTS).map((f) => path.relative(OPS_TESTS, f).replace(/\\/g, '/'));
  assert(real.includes('lifecycle/status.test.js'), `test/operations/lifecycle/status.test.js must exist; found ${show(real)}`);
});

// ── Runner ────────────────────────────────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`${NL}=== operations ===`);
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  try {
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
    console.log(`${NL}--- per-operation suites under test/operations/ (ADR Decision 12) ---`);
    const d = await runDiscovered(discoverSuites(OPS_TESTS), path.join(ROOT, 'test'));
    pass += d.pass; fail += d.fail; skipped += d.skipped; failures.push(...d.failures);
  } finally {
    for (const t of temps) { try { fs.rmSync(t, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
  console.log(`${NL}operations: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run, discoverSuites, runDiscovered };
