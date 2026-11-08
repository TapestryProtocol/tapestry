'use strict';
/**
 * The external CLI — graph-operations-foundation #6 (Loom A10.6): an agent with only its own admin key and an
 * instance's URL calls every operation the instance lists, from outside the instance, and a skill tells it how.
 *   Story: engineering-team/stories/graph-operations-foundation/6-external-cli-and-agent-skill.md
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0006-external-cli-made-from-the-operations-list.md
 *   Plan:  engineering-team/stories/graph-operations-foundation/6-external-cli-and-agent-skill.test-plan.md
 *
 * Stack-free. Each instance is a child (test/helpers/externalCliServer.js) on ephemeral loopback ports, with a real
 * express-session, the real central auth middleware and sign-in handlers, and a fixture catalog. It treats every
 * request as proxied, as nginx traffic is, so the CLI has to sign in. The CLI runs as a child,
 * `node clients/cli/bin/tapestry.js`, with a temporary TAPESTRY_HOME and HOME and nothing else of this process's
 * environment but PATH. Every key is made here; nothing reaches a relay or a live instance.
 *
 *   S1–S6    signing in with the agent's own key                                          [AC1]
 *   O1–O6    the operations come from the instance                                       [AC2]
 *   K1–K10   calling an operation: flags, typing, answers, exit codes, transport          [AC3; ADR 0006 Decisions 1, 4, 6]
 *   I1–I15   the key, the instance, and who the agent is there                            [AC4]
 *   SK1–SK4  the skill                                                                    [AC6]
 *   P1–P5    the package, the version banner, the README, and staying out of the image    [ADR 0006 Decisions 1, 2, 9, 10]
 *   A1–A3    only the sign-in and /api/tapestry/, nothing signed but the challenge        [AC5] — last, over every request
 *
 * AC7 (end to end on a scratch stack) is Implementation's live check, not a gate suite (the plan says how).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const NL = String.fromCharCode(10);
const CLI_DIR = path.join(ROOT, 'clients/cli');
const BIN = path.join(CLI_DIR, 'bin/tapestry.js');
const PKG = path.join(CLI_DIR, 'package.json');
const LOCK = path.join(CLI_DIR, 'package-lock.json');
const COMMANDS = path.join(CLI_DIR, 'src/commands.js');
const FLAGS = path.join(CLI_DIR, 'src/flags.js');
const SKILL = path.join(CLI_DIR, 'skill/SKILL.md');
const README = path.join(CLI_DIR, 'README.md');
const SERVER = path.join(ROOT, 'test/helpers/externalCliServer.js');
const INTERNAL_CLI = path.join(ROOT, 'src/operations/cli.js');
const REFUSAL = path.join(ROOT, 'src/operations/refusal.js');
const DOCKERIGNORE = path.join(ROOT, '.dockerignore');
const ADR = 'ADR graph-operations-foundation/0006';
const SIGN_IN = ['/api/auth/verify-user', '/api/auth/login-user', '/api/auth/logout'];

const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));
const yaml = require(require.resolve('js-yaml', { paths: [ROOT] }));

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (x) => JSON.stringify(x);
const tail = (s, n = 400) => String(s || '').slice(-n);
const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.keys(v).sort().reduce((o, key) => { o[key] = v[key]; return o; }, {}) : v));
const same = (a, b) => canon(a) === canon(b);
const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
const temps = [];
function tmp(prefix) { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); temps.push(d); return d; }

function mustExist(abs, why) {
  if (!fs.existsSync(abs)) throw new Error(`${path.relative(ROOT, abs)} does not exist yet (${why})`);
}
const needCli = () => mustExist(BIN, `${ADR} Decision 1`);

// ── Keys ──────────────────────────────────────────────────────────────────────────────────────────────────────────

function makeKey() {
  const sk = NT.generateSecretKey();
  const pubkey = NT.getPublicKey(sk);
  return { sk, hex: Buffer.from(sk).toString('hex'), nsec: NT.nip19.nsecEncode(sk), pubkey, npub: NT.nip19.npubEncode(pubkey) };
}
const OWNER = makeKey();
const ADMIN = makeKey();
const STRANGER = makeKey();
const KEYS = [OWNER, ADMIN, STRANGER];

function keyFile(key, mode = 0o600) {
  const f = path.join(tmp('xcli-key-'), 'agent.key');
  fs.writeFileSync(f, `${key.nsec}${NL}`);
  fs.chmodSync(f, mode);
  return f;
}
/** A home the CLI hasn't made yet: it creates it, readable only by its user, when it first writes there. */
const newHome = () => path.join(tmp('xcli-agent-'), 'tapestry-home');

// ── The fixture catalog ───────────────────────────────────────────────────────────────────────────────────────────

const BASE = {
  kind: 'read',
  access: 'owner-and-admins',
  summary: 'A test operation',
  description: 'Made by test/external-cli.test.js.',
  inputs: {},
  result: { description: 'Anything', schema: { type: 'object' } },
  refusals: [],
};
const COUNT = (key) => `const runs = (globalThis.__opsRuns = globalThis.__opsRuns || {}); runs[${show(key)}] = (runs[${show(key)}] || 0) + 1;`;
function declSource(fields, { run = 'async run() { return { ok: true }; }', head = '' } = {}) {
  const body = Object.entries(fields).map(([k, v]) => `  ${show(k)}: ${show(v)},`).join(NL);
  return `'use strict';${NL}${head}${NL}module.exports = {${NL}${body}${NL}  ${run}${NL}};${NL}`;
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
const WRITE_INPUTS = {
  n: { schema: { type: 'integer' }, required: true, description: 'A whole number' },
  ratio: { schema: { type: 'number' }, required: false, description: 'A number' },
  on: { schema: { type: 'boolean' }, required: false, description: 'A switch' },
  names: { schema: { type: 'array', items: { type: 'string' } }, required: false, description: 'Some names' },
  counts: { schema: { type: 'array', items: { type: 'integer' } }, required: false, description: 'Some whole numbers' },
  label: { schema: { type: 'string' }, required: false, description: 'A label' },
  meta: { schema: { type: 'object' }, required: false, description: 'An object' },
};

function catalog(extra = {}) {
  return {
    'graph/echo-inputs.js': declSource({ ...BASE, group: 'graph', name: 'echo-inputs', summary: 'Echo the inputs it was given', inputs: ECHO_INPUTS }, {
      run: `async run(inputs, context) { ${COUNT('graph echo-inputs')} return { inputs, via: context.via, role: context.caller.role, pubkey: context.caller.pubkey }; }`,
    }),
    'graph/write-thing.js': declSource({ ...BASE, group: 'graph', name: 'write-thing', kind: 'write', summary: 'Write some typed values', inputs: WRITE_INPUTS }, {
      run: `async run(inputs, context) { ${COUNT('graph write-thing')} return { inputs, role: context.caller.role }; }`,
    }),
    'graph/refusing.js': declSource({
      ...BASE, group: 'graph', name: 'refusing', summary: 'Refuse, or break, as told',
      inputs: { mode: { schema: { type: 'string', enum: ['declared', 'broken'] }, required: true, description: 'What to do' } },
      refusals: [{ code: 'not-found', status: 404, when: 'Asked to refuse' }],
    }, {
      head: `const { refusal } = require(${show(REFUSAL)});`,
      run: `async run(inputs) { if (inputs.mode === 'declared') throw refusal('not-found', 'There is nothing here.'); throw new Error('it broke on purpose'); }`,
    }),
    'graph/slow.js': declSource({
      ...BASE, group: 'graph', name: 'slow', summary: 'Answer after a while',
      inputs: { ms: { schema: { type: 'integer', minimum: 0, maximum: 60000 }, required: true, description: 'How long to wait, in milliseconds' } },
    }, { run: 'async run(inputs) { await new Promise((r) => setTimeout(r, inputs.ms)); return { waited: inputs.ms }; }' }),
    'lifecycle/owner-thing.js': declSource({ ...BASE, group: 'lifecycle', name: 'owner-thing', access: 'owner-only', summary: 'Only for the owner' }, {
      run: `async run() { ${COUNT('lifecycle owner-thing')} return { ok: true }; }`,
    }),
    ...extra,
  };
}
const ADDED_LATER = { 'graph/added-later.js': declSource({ ...BASE, group: 'graph', name: 'added-later', summary: 'Added to one instance only' }) };

// ── Instances ─────────────────────────────────────────────────────────────────────────────────────────────────────

const children = [];
const READY = 'externalCliServer-ready ';

function serverEnv(dir) {
  const conf = path.join(dir, 'brainstorm.conf');
  const settings = path.join(dir, 'settings.json');
  fs.writeFileSync(conf, [
    `export BRAINSTORM_OWNER_PUBKEY="${OWNER.pubkey}"`,
    'export NEO4J_URI="bolt://127.0.0.1:9"',
    'export REDIS_HOST="127.0.0.1"',
    'export REDIS_PORT="9"',
  ].join(NL) + NL);
  fs.writeFileSync(settings, JSON.stringify({ adminPubkeys: [ADMIN.pubkey] }));
  const env = {
    ...process.env,
    BRAINSTORM_CONF_PATH: conf,
    TAPESTRY_SETTINGS_PATH: settings,
    BRAINSTORM_BASE_DIR: dir,
    TAPESTRY_LMDB_PATH: path.join(dir, 'lmdb'),
    BRAINSTORM_BASE_URL: 'http://127.0.0.1:9',
    TAPESTRY_BASE: 'http://127.0.0.1:9',
    MEILI_URL_HOST: 'http://127.0.0.1:9',
    TA_PUBKEY: 'dd'.repeat(32),
  };
  delete env.TASK_QUEUE_ENABLED;
  return env;
}

function startInstance(name, { files = catalog(), mode, redirectTo } = {}) {
  const dir = tmp(`xcli-${name}-`);
  const catalogDir = writeCatalog(path.join(dir, 'catalog'), mode ? {} : files);
  const recordFile = path.join(dir, 'requests.jsonl');
  fs.writeFileSync(recordFile, '');
  const specFile = path.join(dir, 'spec.json');
  fs.writeFileSync(specFile, JSON.stringify({ root: ROOT, catalogDir, recordFile, mode, redirectTo }));
  const proc = spawn(process.execPath, [SERVER, specFile], { cwd: ROOT, env: serverEnv(dir), stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(proc);
  return new Promise((resolve, reject) => {
    let out = '';
    let err = '';
    let ready = false;
    const timer = setTimeout(() => reject(new Error(`test instance ${name} did not start within 30 s: ${tail(err)}`)), 30000);
    proc.stdout.on('data', (d) => {
      if (ready) return;
      out += d;
      const at = out.indexOf(READY);
      const end = at >= 0 ? out.indexOf(NL, at) : -1;
      if (end < 0) return;
      ready = true;
      clearTimeout(timer);
      const ports = JSON.parse(out.slice(at + READY.length, end));
      const requests = () => fs.readFileSync(recordFile, 'utf8').split(NL).filter(Boolean).map((l) => JSON.parse(l));
      resolve({
        name, dir, catalogDir, recordFile, proc,
        url: `http://127.0.0.1:${ports.port}`,
        controlPort: ports.control,
        requests,
        mark: () => requests().length,
        since: (n) => requests().slice(n),
      });
    });
    proc.stderr.on('data', (d) => { err += d; if (err.length > 65536) err = err.slice(-65536); });
    proc.on('exit', (code) => { if (!ready) { clearTimeout(timer); reject(new Error(`test instance ${name} exited ${code} before it was ready: ${tail(err)}`)); } });
  });
}

function control(inst, method, p) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: inst.controlPort, method, path: p }, (res) => {
      let b = '';
      res.on('data', (d) => { b += d; });
      res.on('end', () => { try { resolve(JSON.parse(b || 'null')); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}
const runsOf = async (inst, key) => ((await control(inst, 'GET', '/runs')) || {})[key] || 0;

function deadUrl() {
  return new Promise((resolve) => {
    const s = http.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(`http://127.0.0.1:${port}`)); });
  });
}

let INST = null; // the main instance
let INST2 = null; // a second instance, whose catalog has one more operation
let HTML = null; // answers HTML: not an instance
let TRAP = null; // where REDIRECT points; nothing may reach it
let REDIRECT = null; // answers 302 to TRAP
let A = null; // the admin agent: its own home, its key file, INST
let OWN = null; // the owner, the same way
let STR = null; // a key that signs in but is neither owner nor admin

async function setup() {
  INST = await startInstance('main');
  INST2 = await startInstance('second', { files: catalog(ADDED_LATER) });
  HTML = await startInstance('html', { mode: 'html' });
  TRAP = await startInstance('trap', { mode: 'html' });
  REDIRECT = await startInstance('redirect', { mode: 'redirect', redirectTo: `${TRAP.url}/trap` });
  A = agent(INST, ADMIN);
  OWN = agent(INST, OWNER);
  STR = agent(INST, STRANGER);
}
function agent(inst, key, env = {}) {
  return { home: newHome(), env: { TAPESTRY_INSTANCE: inst.url, TAPESTRY_KEY_FILE: keyFile(key), ...env } };
}

// ── Running the CLI ───────────────────────────────────────────────────────────────────────────────────────────────

let FAKE_HOME = null;
/** Run the CLI as a child with only PATH, a temporary HOME, the agent's TAPESTRY_HOME and the env given. */
function cli(args, { home, env = {}, timeoutMs = 30000 } = {}) {
  needCli();
  if (!FAKE_HOME) FAKE_HOME = tmp('xcli-home-');
  const childEnv = { PATH: process.env.PATH, HOME: FAKE_HOME, ...(home ? { TAPESTRY_HOME: home } : {}), ...env };
  for (const k of Object.keys(childEnv)) if (childEnv[k] === undefined) delete childEnv[k];
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [BIN, ...args], { cwd: FAKE_HOME, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, stdout, stderr, timedOut, ms: Date.now() - started }); });
  });
}
const said = (r) => `exit ${r.code}${r.timedOut ? ' (timed out)' : ''}; stdout ${show(tail(r.stdout, 300))}; stderr ${show(tail(r.stderr, 300))}`;
const count = (reqs, p, method = 'POST') => reqs.filter((x) => x.path === p && x.method === method).length;

/** The command inside the instance, in-process, over a catalog: what it prints and returns. */
async function internal(argv, dir) {
  const { main } = require(INTERNAL_CLI);
  let stdout = '';
  let stderr = '';
  const code = await main(argv, { stdout: { write: (s) => { stdout += s; } }, stderr: { write: (s) => { stderr += s; } } }, { dir });
  return { code, stdout, stderr };
}

/** A signer command of the agent's own: it signs what it's given on stdin with a key only it reads. */
function fakeSigner(signKey, { mangle = null } = {}) {
  const dir = tmp('xcli-signer-');
  const keyPath = path.join(dir, 'signer.key');
  fs.writeFileSync(keyPath, signKey.hex);
  fs.chmodSync(keyPath, 0o600);
  const seen = path.join(dir, 'seen.txt');
  const script = path.join(dir, 'signer.js');
  fs.writeFileSync(script, [
    "'use strict';",
    "const fs = require('fs');",
    `const { finalizeEvent } = require(${show(require.resolve('nostr-tools/pure', { paths: [ROOT] }))});`,
    "let input = '';",
    "process.stdin.on('data', (d) => { input += d; });",
    "process.stdin.on('end', () => {",
    `  fs.writeFileSync(${show(seen)}, input);`,
    "  process.stderr.write('fake-signer: signing the sign-in challenge' + String.fromCharCode(10));",
    "  const t = JSON.parse(input.trim().split(String.fromCharCode(10))[0]);",
    `  const sk = Uint8Array.from(Buffer.from(fs.readFileSync(${show(keyPath)}, 'utf8').trim(), 'hex'));`,
    '  const template = { kind: t.kind, created_at: t.created_at, tags: t.tags, content: t.content };',
    mangle === 'challenge' ? "  template.tags = [['challenge', 'not-the-challenge']];" : '',
    '  let ev = finalizeEvent(template, sk);',
    mangle === 'signature' ? "  ev = { ...ev, sig: (ev.sig[0] === 'a' ? 'b' : 'a') + ev.sig.slice(1) };" : '',
    '  process.stdout.write(JSON.stringify(ev) + String.fromCharCode(10));',
    '});',
  ].join(NL));
  return { command: `"${process.execPath}" "${script}"`, seen };
}

/** Every file under dir, recursively. */
function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...filesUnder(p)); else out.push(p);
  }
  return out;
}
const holdsSecret = (text) => KEYS.some((k) => text.includes(k.hex) || text.includes(k.nsec));

// ── S: signing in with the agent's own key (AC1) ──────────────────────────────────────────────────────────────────

test('S1: an admin key and an instance URL are enough — the first call signs in with the instance\'s challenge and runs as that admin (AC1)', async () => {
  const m = INST.mark();
  const r = await cli(['graph', 'echo-inputs', '--text', 'hi'], A);
  assert(r.code === 0, `the call must succeed; ${said(r)}`);
  const j = json(r.stdout);
  assert(j && j.success === true && j.data && j.data.role === 'admin' && j.data.pubkey === ADMIN.pubkey,
    `the operation must run as the admin whose key the CLI holds; got ${show(j)}`);
  const reqs = INST.since(m);
  assert(count(reqs, '/api/auth/verify-user') === 1 && count(reqs, '/api/auth/login-user') === 1,
    `exactly one challenge and one signed answer; got ${show(reqs.map((x) => `${x.method} ${x.path}`))}`);
  const verify = reqs.find((x) => x.path === '/api/auth/verify-user');
  assert(verify.body && verify.body.pubkey === ADMIN.pubkey, `the challenge is asked for the admin's public key; got ${show(verify.body)}`);
  const login = reqs.findIndex((x) => x.path === '/api/auth/login-user');
  const call = reqs.findIndex((x) => x.path === '/api/tapestry/graph/echo-inputs');
  assert(call > login, `the operation is called after the sign-in; got ${show(reqs.map((x) => x.path))}`);
});

test('S2: later calls reuse the sign-in: no new challenge, and the stored cookie goes with the call (AC1)', async () => {
  const m = INST.mark();
  const r = await cli(['graph', 'echo-inputs', '--text', 'again'], A);
  assert(r.code === 0, `the call must succeed; ${said(r)}`);
  const reqs = INST.since(m);
  assert(count(reqs, '/api/auth/verify-user') === 0 && count(reqs, '/api/auth/login-user') === 0,
    `a second call must not sign in again; got ${show(reqs.map((x) => `${x.method} ${x.path}`))}`);
  const call = reqs.find((x) => x.path === '/api/tapestry/graph/echo-inputs');
  assert(call && /connect\.sid=/.test(call.headers.cookie || ''), `the call must carry the stored sign-in cookie; got ${show(call && call.headers)}`);
});

test('S3: when the instance forgets the sign-in, the CLI signs in again once, by itself, and the call succeeds (AC1)', async () => {
  await control(INST, 'POST', '/forget');
  const m = INST.mark();
  const r = await cli(['graph', 'echo-inputs', '--text', 'after-forget'], A);
  assert(r.code === 0, `the call must succeed after signing in again; ${said(r)}`);
  const j = json(r.stdout);
  assert(j && j.data && j.data.role === 'admin', `it ran as the admin; got ${show(j)}`);
  const reqs = INST.since(m);
  assert(count(reqs, '/api/auth/verify-user') === 1 && count(reqs, '/api/auth/login-user') === 1,
    `exactly one new sign-in; got ${show(reqs.map((x) => `${x.method} ${x.path}`))}`);
});

test('S4: a write after the instance forgot the sign-in runs exactly once, because the 401 comes before it runs (AC1)', async () => {
  const before = await runsOf(INST, 'graph write-thing');
  await control(INST, 'POST', '/forget');
  const r = await cli(['graph', 'write-thing', '--n', '2'], A);
  assert(r.code === 0, `the write must succeed after signing in again; ${said(r)}`);
  const after = await runsOf(INST, 'graph write-thing');
  assert(after === before + 1, `the write must run exactly once; it ran ${after - before} times`);
});

test('S5: a sign-in the instance keeps refusing is retried once, not in a loop, and the call exits 1 (AC1)', async () => {
  await control(INST, 'POST', '/forget-always?on=1');
  let r;
  let reqs;
  try {
    const m = INST.mark();
    r = await cli(['graph', 'echo-inputs', '--text', 'never-sticks'], { ...A, timeoutMs: 20000 });
    reqs = INST.since(m);
  } finally {
    await control(INST, 'POST', '/forget-always?on=0');
  }
  assert(!r.timedOut && r.code === 1, `the CLI must give up and exit 1; ${said(r)}`);
  const signIns = count(reqs, '/api/auth/verify-user');
  const calls = reqs.filter((x) => x.path.startsWith('/api/tapestry/')).length;
  assert(signIns >= 1 && signIns <= 2 && calls <= 4, `one re-sign-in and one retry, not a loop; got ${signIns} sign-ins and ${calls} calls: ${show(reqs.map((x) => x.path))}`);
  const j = json(r.stdout);
  assert(j && j.success === false, `stdout carries the instance's refusal as it came; got ${show(tail(r.stdout, 200))}`);
});

test('S6: the sign-in event is kind 22242 with the challenge, the content the app signs, the key\'s pubkey and a valid signature, and no request carries the secret (AC1)', async () => {
  const logins = INST.requests().filter((x) => x.path === '/api/auth/login-user');
  assert(logins.length >= 2, `the suite's calls so far must have signed in; got ${logins.length} sign-ins`);
  for (const x of logins) {
    const e = x.body && x.body.event;
    assert(e && e.kind === 22242 && e.content === 'Tapestry authentication', `a sign-in event as the app signs it; got ${show(e)}`);
    assert(Array.isArray(e.tags) && e.tags.length === 1 && e.tags[0][0] === 'challenge' && /^[0-9a-f]{64}$/.test(e.tags[0][1]),
      `its only tag is the challenge; got ${show(e.tags)}`);
    assert(KEYS.some((k) => k.pubkey === e.pubkey) && NT.verifyEvent(JSON.parse(JSON.stringify(e))) === true, `signed by the key that signed in; got ${show(e)}`);
  }
  const leaked = INST.requests().filter((x) => holdsSecret(JSON.stringify(x)));
  assert(leaked.length === 0, `no request may carry a secret key; found it in ${show(leaked.map((x) => `${x.method} ${x.path}`))}`);
});

// ── O: the operations come from the instance (AC2) ───────────────────────────────────────────────────────────────

test('O1: `tapestry` alone lists, by group with their summaries, the operations this key may call, then the CLI\'s own commands; an admin doesn\'t see the owner\'s only (AC2)', async () => {
  const r = await cli([], A);
  assert(r.code === 0, `listing must exit 0; ${said(r)}`);
  for (const s of ['graph', 'echo-inputs', 'Echo the inputs it was given', 'write-thing', 'Write some typed values', 'whoami']) {
    assert(r.stdout.includes(s), `the admin's listing must include ${show(s)}; got ${show(tail(r.stdout, 600))}`);
  }
  assert(!r.stdout.includes('owner-thing'), `an admin's listing leaves out the owner-only operation; got ${show(tail(r.stdout, 600))}`);
  const o = await cli([], OWN);
  assert(o.code === 0 && o.stdout.includes('owner-thing') && o.stdout.includes('Only for the owner'), `the owner's listing includes it; ${said(o)}`);
  for (const word of ['help', '--help']) {
    const h = await cli([word], A);
    assert(h.code === 0 && h.stdout.includes('echo-inputs'), `\`tapestry ${word}\` lists the same; ${said(h)}`);
  }
});

test('O2: `tapestry <group>` lists one group\'s operations (AC2)', async () => {
  const r = await cli(['graph'], A);
  assert(r.code === 0 && r.stdout.includes('echo-inputs') && r.stdout.includes('write-thing') && !r.stdout.includes('owner-thing'),
    `\`tapestry graph\` lists graph's operations only; ${said(r)}`);
});

test('O3: `tapestry <group> <operation> --help` shows its inputs, result, refusals, who may call it and its route, from the instance, and runs nothing (AC2)', async () => {
  const before = await runsOf(INST, 'graph echo-inputs');
  const r = await cli(['graph', 'echo-inputs', '--help'], A);
  assert(r.code === 0, `help must exit 0; ${said(r)}`);
  for (const s of ['--text', '--limit', '--tags', '--flag', 'required', 'GET /api/tapestry/graph/echo-inputs', 'unknown-input', 'owner and admins']) {
    assert(r.stdout.includes(s), `the help must show ${show(s)}; got ${show(tail(r.stdout, 800))}`);
  }
  assert((await runsOf(INST, 'graph echo-inputs')) === before, 'asking for help must not run the operation');
});

test('O4: an operation one instance has and another hasn\'t: the same CLI, unchanged, lists and runs it there, and doesn\'t show it elsewhere (AC2)', async () => {
  const a = { home: newHome(), env: { TAPESTRY_KEY_FILE: keyFile(ADMIN) } };
  const there = await cli(['--instance', INST2.url, 'graph'], a);
  assert(there.code === 0 && there.stdout.includes('added-later'), `the second instance lists its own operation; ${said(there)}`);
  const here = await cli(['--instance', INST.url, 'graph'], a);
  assert(here.code === 0 && !here.stdout.includes('added-later'), `the main instance doesn't have it; ${said(here)}`);
  const ran = await cli(['--instance', INST2.url, 'graph', 'added-later'], a);
  const j = json(ran.stdout);
  assert(ran.code === 0 && j && j.success === true && j.data && j.data.ok === true, `the CLI runs it there; ${said(ran)}`);
});

test('O5: an operation this key may not call — the owner\'s only, or one that doesn\'t exist — exits 2, says so, lists what it may call, and calls nothing (AC2)', async () => {
  const m = INST.mark();
  const r = await cli(['lifecycle', 'owner-thing'], A);
  assert(r.code === 2, `exit 2; ${said(r)}`);
  assert(/owner/i.test(r.stderr) && r.stderr.includes(INST.url) && r.stderr.includes('echo-inputs'),
    `stderr must say it isn't among this key's operations on ${INST.url} (maybe the owner's only) and list the ones it may call; got ${show(tail(r.stderr, 600))}`);
  assert(!INST.since(m).some((x) => x.path === '/api/tapestry/lifecycle/owner-thing'), 'the operation is never called');
  const r2 = await cli(['graph', 'no-such-thing'], A);
  assert(r2.code === 2 && r2.stderr.includes('echo-inputs'), `an operation that doesn't exist exits 2, listing what does; ${said(r2)}`);
});

test('O6: an unknown group exits 2 and names the groups this key may use (AC2)', async () => {
  const r = await cli(['nosuchgroup', 'x'], A);
  assert(r.code === 2 && r.stderr.includes('graph'), `exit 2, naming graph; ${said(r)}`);
});

// ── K: calling an operation (AC3) ─────────────────────────────────────────────────────────────────────────────────

test('K1: a read sends its flags as the query string, the instance types them, and stdout is the instance\'s JSON, indented two spaces, alone (AC3)', async () => {
  const m = INST.mark();
  const r = await cli(['graph', 'echo-inputs', '--text', 'hi', '--limit', '5', '--tags', 'a', '--tags', 'b', '--flag'], A);
  assert(r.code === 0, `the read must succeed; ${said(r)}`);
  const j = json(r.stdout);
  assert(j && r.stdout === `${JSON.stringify(j, null, 2)}${NL}`, `stdout must be the JSON answer, indented two spaces, and nothing else; got ${show(tail(r.stdout, 300))}`);
  assert(same(j.data.inputs, { text: 'hi', limit: 5, tags: ['a', 'b'], flag: true }), `the instance typed them; got ${show(j.data.inputs)}`);
  const call = INST.since(m).find((x) => x.path === '/api/tapestry/graph/echo-inputs');
  assert(call && call.method === 'GET', `a read is a GET; got ${show(call)}`);
  const q = new URL(call.url, 'http://x').searchParams;
  assert(q.get('text') === 'hi' && q.get('limit') === '5' && same(q.getAll('tags'), ['a', 'b']) && q.get('flag') === 'true',
    `the flags go as the query string; got ${show(call.url)}`);
  const eq = await cli(['graph', 'echo-inputs', '--text=hi', '--limit=7'], A);
  assert(eq.code === 0 && json(eq.stdout).data.inputs.limit === 7, `--name=value works too; ${said(eq)}`);
});

test('K2: a write types its flags before they go, so the operation gets numbers, booleans and lists, in a JSON body (AC3)', async () => {
  const m = INST.mark();
  const r = await cli(['graph', 'write-thing', '--n', '3', '--ratio', '0.5', '--on', '--names', 'x', '--counts', '1', '--counts', '2', '--label', '42'], A);
  assert(r.code === 0, `the write must succeed; ${said(r)}`);
  const want = { n: 3, ratio: 0.5, on: true, names: ['x'], counts: [1, 2], label: '42' };
  const j = json(r.stdout);
  assert(j && same(j.data.inputs, want), `the operation gets the declared types; got ${show(j && j.data)}`);
  const call = INST.since(m).find((x) => x.path === '/api/tapestry/graph/write-thing');
  assert(call && call.method === 'POST' && /application\/json/.test(call.headers['content-type'] || '') && same(call.body, want),
    `a write is a POST with a typed JSON body; got ${show(call)}`);
});

test('K3: a write\'s inputs are typed exactly as the command inside the instance types them, and refused the same way (ADR 0006 Decision 6)', async () => {
  const cases = [
    ['--n', '3'], ['--n=4'], ['--n', '3', '--on'], ['--n', '3', '--on', 'false'], ['--n', '3', '--names', 'x'],
    ['--n', '3', '--names', 'a', '--names', 'b'], ['--n', '3', '--counts', '1', '--counts', '2'], ['--n', '3', '--ratio', '2.5'],
    ['--n', '3', '--label', '007'], ['--n', 'three'], ['--n', '3.5'], ['--n', '3', '--counts', 'x'], ['--n', '3', '--bogus', '1'],
    ['--ratio', '1'], ['--n', '3', '--meta', '{"a":1}'],
  ];
  for (const c of cases) {
    const ext = await cli(['graph', 'write-thing', ...c], A);
    const int = await internal(['graph', 'write-thing', ...c], INST.catalogDir);
    const e = json(ext.stdout);
    const i = json(int.stdout);
    assert(e && i, `${show(c)}: both must answer JSON; external ${said(ext)}; internal ${show(tail(int.stdout, 200))}`);
    if (i.success) {
      assert(ext.code === 0 && e.success === true && same(e.data.inputs, i.data.inputs), `${show(c)}: the same inputs as inside; inside ${show(i.data.inputs)}, outside ${show(e)}`);
    } else {
      assert(ext.code === 1 && e.success === false && e.code === i.code && e.input === i.input,
        `${show(c)}: refused the same way as inside (${i.code} ${i.input}); outside ${show(e)} (exit ${ext.code})`);
    }
  }
  for (const c of [['--text', 'hi'], ['--text', 'hi', '--tags', 'a'], ['--text', 'hi', '--limit', '11']]) {
    const ext = json((await cli(['graph', 'echo-inputs', ...c], A)).stdout);
    const int = json((await internal(['graph', 'echo-inputs', ...c], INST.catalogDir)).stdout);
    assert(ext && int && ext.success === int.success && (int.success ? same(ext.data.inputs, int.data.inputs) : ext.code === int.code),
      `${show(c)}: a read answers as inside; inside ${show(int)}, outside ${show(ext)}`);
  }
});

test('K4: the instance judges the inputs: an unknown, missing or ill-typed input comes back as its own 400, printed as it came, exit 1 (AC3)', async () => {
  const cases = [
    [['graph', 'echo-inputs', '--text', 'hi', '--bogus', '1'], 'unknown-input', 'bogus'],
    [['graph', 'echo-inputs'], 'missing-input', 'text'],
    [['graph', 'echo-inputs', '--text', 'hi', '--limit', 'lots'], 'invalid-input', 'limit'],
    [['graph', 'write-thing', '--n', 'many'], 'invalid-input', 'n'],
  ];
  for (const [argv, code, input] of cases) {
    const m = INST.mark();
    const r = await cli(argv, A);
    const j = json(r.stdout);
    assert(r.code === 1 && j && j.success === false && j.code === code && j.input === input, `${argv.join(' ')}: exit 1 with the instance's ${code} naming ${input}; ${said(r)}`);
    assert(INST.since(m).some((x) => x.path === `/api/tapestry/${argv[0]}/${argv[1]}`), `${argv.join(' ')}: the instance decided, so the call reached it`);
  }
});

test('K5: a declared refusal exits 1 and the operation\'s failure exits 3, each with the instance\'s JSON on stdout; the failure has a one-line reason on stderr (AC3)', async () => {
  const r = await cli(['graph', 'refusing', '--mode', 'declared'], A);
  const j = json(r.stdout);
  assert(r.code === 1 && j && j.code === 'not-found', `a declared refusal exits 1 with its JSON; ${said(r)}`);
  const f = await cli(['graph', 'refusing', '--mode', 'broken'], A);
  const k = json(f.stdout);
  assert(f.code === 3 && k && k.code === 'failed' && f.stderr.trim().length > 0, `the operation's failure exits 3, with its JSON and a reason on stderr; ${said(f)}`);
});

test('K6: an instance that can\'t be reached exits 3 with a one-line reason on stderr and nothing on stdout (AC3)', async () => {
  const dead = await deadUrl();
  const r = await cli(['--instance', dead, 'graph', 'echo-inputs', '--text', 'hi'], { home: newHome(), env: { TAPESTRY_KEY_FILE: keyFile(ADMIN) } });
  assert(r.code === 3 && r.stdout.trim() === '' && r.stderr.trim().length > 0, `exit 3, a reason on stderr, nothing on stdout; ${said(r)}`);
});

test('K7: an answer that isn\'t the instance\'s JSON exits 3 and says so (AC3)', async () => {
  const r = await cli(['--instance', HTML.url, 'graph', 'echo-inputs', '--text', 'hi'], { home: newHome(), env: { TAPESTRY_KEY_FILE: keyFile(ADMIN) } });
  assert(r.code === 3 && r.stdout.trim() === '' && /json|html/i.test(r.stderr), `exit 3, saying the answer wasn't JSON; ${said(r)}`);
  assert(HTML.requests().length >= 1, 'the CLI did call the address');
});

test('K8: a redirect is not followed: exit 3, naming where it pointed, and nothing reaches that address (ADR 0006 Decision 4)', async () => {
  const r = await cli(['--instance', REDIRECT.url, 'graph', 'echo-inputs', '--text', 'hi'], { home: newHome(), env: { TAPESTRY_KEY_FILE: keyFile(ADMIN) } });
  assert(r.code === 3 && r.stderr.includes(TRAP.url), `exit 3, naming the redirect's target ${TRAP.url}; ${said(r)}`);
  assert(REDIRECT.requests().length >= 1, 'the CLI did call the instance address');
  assert(TRAP.requests().length === 0, `nothing may follow the redirect; the target got ${show(TRAP.requests().map((x) => x.path))}`);
});

test('K9: a call slower than TAPESTRY_TIMEOUT seconds fails with exit 3 and says it timed out (ADR 0006 Decision 4)', async () => {
  const r = await cli(['graph', 'slow', '--ms', '6000'], { ...A, env: { ...A.env, TAPESTRY_TIMEOUT: '1' }, timeoutMs: 20000 });
  assert(r.code === 3 && /time/i.test(r.stderr) && r.ms < 5000, `exit 3 within about a second, saying it timed out; ${said(r)} after ${r.ms} ms`);
});

test('K10: the CLI\'s flag rules are the internal command\'s: the same argument lists give the same inputs, help and usage errors (ADR 0006 Decision 1)', () => {
  mustExist(FLAGS, `${ADR} Decision 1`);
  const ext = require(FLAGS);
  const int = require(INTERNAL_CLI);
  assert(typeof ext.parseFlags === 'function', 'clients/cli/src/flags.js must export parseFlags');
  const cases = [[], ['--a', 'b'], ['--a=b'], ['--a'], ['--a', '--b'], ['--a', '1', '--a', '2'], ['--a', '1', '--a', '2', '--a', '3'],
    ['stray'], ['--a', 'b', 'stray'], ['--'], ['-h'], ['--help'], ['--a=b=c'], ['--a='], ['--a', '-1']];
  for (const c of cases) {
    const e = ext.parseFlags(c);
    const i = int.parseFlags(c);
    assert(!!e.usage === !!i.usage && same(e.inputs, i.inputs) && !!e.help === !!i.help, `${show(c)}: inside ${show(i)}, outside ${show(e)}`);
  }
});

// ── I: the key, the instance, and who the agent is there (AC4) ───────────────────────────────────────────────────

test('I1: `tapestry key new` makes a key only its user can read, prints its npub and hex but not the secret, and never overwrites one (AC4)', async () => {
  const home = newHome();
  const r = await cli(['key', 'new'], { home });
  const j = json(r.stdout);
  assert(r.code === 0 && j && j.file === path.join(home, 'key'), `key new writes <home>/key; ${said(r)}`);
  assert((fs.statSync(j.file).mode & 0o777) === 0o600, `the key file is 0600; got ${(fs.statSync(j.file).mode & 0o777).toString(8)}`);
  assert((fs.statSync(home).mode & 0o077) === 0, `the home is readable only by its user; got ${(fs.statSync(home).mode & 0o777).toString(8)}`);
  const nsec = fs.readFileSync(j.file, 'utf8').trim();
  const decoded = NT.nip19.decode(nsec);
  assert(decoded.type === 'nsec' && NT.getPublicKey(decoded.data) === j.pubkey && NT.nip19.npubEncode(j.pubkey) === j.npub, `the file holds the nsec of the npub and hex printed; got ${show(j)}`);
  assert(!r.stdout.includes(nsec) && !r.stdout.includes(Buffer.from(decoded.data).toString('hex')) && !r.stderr.includes(nsec), 'the secret is never printed');
  const again = await cli(['key', 'new'], { home });
  assert(again.code !== 0 && fs.readFileSync(j.file, 'utf8').trim() === nsec && again.stderr.includes(j.file), `a second key new refuses and leaves the key as it was; ${said(again)}`);
  const other = path.join(tmp('xcli-keyfile-'), 'chosen.key');
  const third = await cli(['key', 'new', '--file', other], { home });
  assert(third.code === 0 && fs.existsSync(other) && (fs.statSync(other).mode & 0o777) === 0o600 && json(third.stdout).file === other, `--file writes there, 0600; ${said(third)}`);
});

test('I2: `tapestry key show` names where the key comes from and its public key, never the secret (AC4)', async () => {
  const fromFile = await cli(['key', 'show'], A);
  const j = json(fromFile.stdout);
  assert(fromFile.code === 0 && j && j.npub === ADMIN.npub && j.pubkey === ADMIN.pubkey && String(j.source).includes(A.env.TAPESTRY_KEY_FILE), `from the key file; ${said(fromFile)}`);
  const fromEnv = await cli(['key', 'show'], { home: newHome(), env: { TAPESTRY_SECRET_KEY: STRANGER.nsec } });
  const k = json(fromEnv.stdout);
  assert(fromEnv.code === 0 && k && k.pubkey === STRANGER.pubkey && /TAPESTRY_SECRET_KEY/.test(String(k.source)), `from the environment; ${said(fromEnv)}`);
  const signer = fakeSigner(ADMIN);
  const fromSigner = await cli(['key', 'show'], { home: newHome(), env: { TAPESTRY_SIGNER: signer.command, TAPESTRY_PUBKEY: ADMIN.npub } });
  const s = json(fromSigner.stdout);
  assert(fromSigner.code === 0 && s && s.pubkey === ADMIN.pubkey && /signer/i.test(String(s.source)), `from a signer; ${said(fromSigner)}`);
  for (const r of [fromFile, fromEnv, fromSigner]) assert(!holdsSecret(r.stdout + r.stderr), 'key show never prints a secret');
});

test('I3: a key file other users can read is refused, naming `chmod 600`, and nothing is sent; the same file at 0600 works (AC4)', async () => {
  const f = keyFile(ADMIN, 0o644);
  const env = { TAPESTRY_INSTANCE: INST.url, TAPESTRY_KEY_FILE: f };
  const m = INST.mark();
  const r = await cli(['graph', 'echo-inputs', '--text', 'hi'], { home: newHome(), env });
  assert(r.code === 2 && r.stderr.includes('chmod 600') && r.stderr.includes(f), `refused with exit 2, naming chmod 600 and the file; ${said(r)}`);
  assert(INST.since(m).length === 0, `nothing may reach the instance; got ${show(INST.since(m).map((x) => x.path))}`);
  fs.chmodSync(f, 0o600);
  const ok = await cli(['graph', 'echo-inputs', '--text', 'hi'], { home: newHome(), env });
  assert(ok.code === 0, `the same file at 0600 works; ${said(ok)}`);
});

test('I4: a key in TAPESTRY_SECRET_KEY, as hex or nsec, works, and the CLI writes it nowhere (AC4)', async () => {
  for (const secret of [ADMIN.hex, ADMIN.nsec]) {
    const home = newHome();
    const r = await cli(['graph', 'echo-inputs', '--text', 'hi'], { home, env: { TAPESTRY_INSTANCE: INST.url, TAPESTRY_SECRET_KEY: secret } });
    const j = json(r.stdout);
    assert(r.code === 0 && j && j.data.pubkey === ADMIN.pubkey, `${secret === ADMIN.hex ? 'hex' : 'nsec'}: runs as the admin; ${said(r)}`);
    const files = filesUnder(home);
    assert(files.length >= 1, `the CLI keeps its sign-in in the home; found ${show(files)}`);
    for (const p of files) assert(!holdsSecret(fs.readFileSync(p, 'utf8')), `${path.relative(home, p)} must not hold the secret`);
  }
});

test('I5: a signer of the agent\'s own signs the challenge: it gets the unsigned event on stdin, its stderr reaches the agent, and the CLI never holds the key (AC4)', async () => {
  const signer = fakeSigner(ADMIN);
  const home = newHome();
  const r = await cli(['graph', 'echo-inputs', '--text', 'signed-elsewhere'], { home, env: { TAPESTRY_INSTANCE: INST.url, TAPESTRY_SIGNER: signer.command, TAPESTRY_PUBKEY: ADMIN.npub } });
  const j = json(r.stdout);
  assert(r.code === 0 && j && j.data.pubkey === ADMIN.pubkey, `the call runs as the signer's key; ${said(r)}`);
  assert(r.stderr.includes('fake-signer: signing the sign-in challenge'), `the signer's stderr reaches the agent; got ${show(tail(r.stderr))}`);
  const given = json(fs.readFileSync(signer.seen, 'utf8').trim().split(NL)[0]);
  assert(given && given.kind === 22242 && given.pubkey === ADMIN.pubkey && given.content === 'Tapestry authentication'
    && Array.isArray(given.tags) && given.tags.length === 1 && given.tags[0][0] === 'challenge' && !given.sig,
    `the signer gets the unsigned sign-in event, one JSON line on stdin; got ${show(given)}`);
  for (const p of filesUnder(home)) assert(!holdsSecret(fs.readFileSync(p, 'utf8')), `${path.relative(home, p)} must not hold a secret`);
});

test('I6: a signer that returns the wrong event — another challenge, another key, or a bad signature — fails the sign-in, and that event is never sent (AC4)', async () => {
  const wrong = [['challenge', fakeSigner(ADMIN, { mangle: 'challenge' })], ['key', fakeSigner(STRANGER)], ['signature', fakeSigner(ADMIN, { mangle: 'signature' })]];
  for (const [what, signer] of wrong) {
    const m = INST.mark();
    const r = await cli(['graph', 'echo-inputs', '--text', 'hi'], { home: newHome(), env: { TAPESTRY_INSTANCE: INST.url, TAPESTRY_SIGNER: signer.command, TAPESTRY_PUBKEY: ADMIN.npub } });
    assert(r.code === 3, `${what}: the sign-in fails with exit 3; ${said(r)}`);
    assert(fs.existsSync(signer.seen), `${what}: the signer was asked`);
    assert(count(INST.since(m), '/api/auth/login-user') === 0, `${what}: the wrong event is never sent`);
  }
});

test('I7: two agents\' keys in one home never share a sign-in: each call runs as its own key, and each key signs in once (AC4)', async () => {
  const home = newHome();
  const as = (key) => ({ home, env: { TAPESTRY_INSTANCE: INST.url, TAPESTRY_SECRET_KEY: key.hex } });
  const m = INST.mark();
  for (const [key, role] of [[ADMIN, 'admin'], [OWNER, 'owner'], [ADMIN, 'admin'], [OWNER, 'owner']]) {
    const r = await cli(['graph', 'echo-inputs', '--text', role], as(key));
    const j = json(r.stdout);
    assert(r.code === 0 && j && j.data.role === role && j.data.pubkey === key.pubkey, `the ${role}'s call runs as the ${role}; ${said(r)}`);
  }
  const signIns = INST.since(m).filter((x) => x.path === '/api/auth/verify-user').map((x) => x.body && x.body.pubkey);
  assert(signIns.length === 2 && signIns.includes(ADMIN.pubkey) && signIns.includes(OWNER.pubkey), `one sign-in per key; got ${show(signIns)}`);
});

test('I8: the instance comes from --instance, then TAPESTRY_INSTANCE, then `tapestry use`; one key stays signed in to two instances at once (AC4)', async () => {
  const home = newHome();
  const env = { TAPESTRY_KEY_FILE: keyFile(ADMIN) };
  const use = await cli(['use', INST2.url], { home, env });
  assert(use.code === 0 && json(use.stdout) && json(use.stdout).instance === INST2.url, `\`tapestry use\` sets the default; ${said(use)}`);
  const byConfig = await cli(['graph'], { home, env });
  assert(byConfig.code === 0 && byConfig.stdout.includes('added-later'), `with no flag or variable, the default is used; ${said(byConfig)}`);
  const byEnv = await cli(['graph'], { home, env: { ...env, TAPESTRY_INSTANCE: INST.url } });
  assert(byEnv.code === 0 && !byEnv.stdout.includes('added-later'), `TAPESTRY_INSTANCE beats the default; ${said(byEnv)}`);
  const byFlag = await cli(['--instance', INST2.url, 'graph'], { home, env: { ...env, TAPESTRY_INSTANCE: INST.url } });
  assert(byFlag.code === 0 && byFlag.stdout.includes('added-later'), `--instance beats TAPESTRY_INSTANCE; ${said(byFlag)}`);
  const m1 = INST.mark();
  const m2 = INST2.mark();
  for (const url of [INST.url, INST2.url, INST.url, INST2.url]) {
    const r = await cli(['--instance', url, 'graph', 'echo-inputs', '--text', 'both'], { home, env });
    assert(r.code === 0, `${url}: ${said(r)}`);
  }
  assert(count(INST.since(m1), '/api/auth/verify-user') === 0 && count(INST2.since(m2), '/api/auth/verify-user') === 0,
    'both sign-ins are kept: alternating between the instances signs in to neither again');
});

test('I9: everything the CLI keeps is readable only by the agent\'s user (AC4)', async () => {
  const home = A.home;
  const files = filesUnder(home);
  assert(files.length >= 1, `the admin agent's home must hold its sign-in by now; found ${show(files)}`);
  assert((fs.statSync(home).mode & 0o077) === 0, `the home is 0700; got ${(fs.statSync(home).mode & 0o777).toString(8)}`);
  for (const p of files) assert((fs.statSync(p).mode & 0o077) === 0, `${path.relative(home, p)} must be readable only by its user; got ${(fs.statSync(p).mode & 0o777).toString(8)}`);
});

test('I10: plain http to a host other than this machine is refused, as is a URL with a path, and nothing is sent (ADR 0006 Decision 4)', async () => {
  const a = { home: newHome(), env: { TAPESTRY_KEY_FILE: keyFile(ADMIN) } };
  const http1 = await cli(['--instance', 'http://example.com', 'graph'], a);
  assert(http1.code === 2 && /https/i.test(http1.stderr), `plain http to another host exits 2, asking for https; ${said(http1)}`);
  const m = INST.mark();
  const withPath = await cli(['--instance', `${INST.url}/api`, 'graph'], a);
  assert(withPath.code === 2, `a URL with a path exits 2; ${said(withPath)}`);
  assert(INST.since(m).length === 0, 'nothing is sent for a refused URL');
  const ok = await cli(['--instance', INST.url, 'graph'], a);
  assert(ok.code === 0, `http to 127.0.0.1 is allowed; ${said(ok)}`);
});

test('I11: `tapestry whoami` says owner, admin or neither; for neither it exits 1 and says the owner can make the key an admin (AC4)', async () => {
  for (const [agentOf, key, role] of [[OWN, OWNER, 'owner'], [A, ADMIN, 'admin']]) {
    const r = await cli(['whoami'], agentOf);
    const j = json(r.stdout);
    assert(r.code === 0 && j && j.role === role && j.npub === key.npub && j.pubkey === key.pubkey && j.instance === INST.url, `the ${role}: ${said(r)}`);
  }
  const n = await cli(['whoami'], STR);
  const j = json(n.stdout);
  assert(n.code === 1 && j && j.role === 'neither' && j.npub === STRANGER.npub, `neither: exit 1 with role neither; ${said(n)}`);
  assert(n.stderr.includes(STRANGER.npub) && n.stderr.includes(INST.url) && /admin/i.test(n.stderr), `stderr names the npub and the instance, and that the owner can make it an admin; got ${show(tail(n.stderr))}`);
});

test('I12: a key that signs in but isn\'t the owner or an admin is told so plainly on every operation command, exit 1, never an empty list (AC4)', async () => {
  const list = await cli([], STR);
  assert(list.code === 1 && list.stderr.includes(STRANGER.npub) && /admin/i.test(list.stderr), `\`tapestry\` says so, exit 1; ${said(list)}`);
  const call = await cli(['graph', 'echo-inputs', '--text', 'hi'], STR);
  const j = json(call.stdout);
  assert(call.code === 1 && call.stderr.includes(STRANGER.npub) && /admin/i.test(call.stderr), `an operation command says so, exit 1; ${said(call)}`);
  assert(!j || j.success === false, `stdout is the instance's refusal, if anything; got ${show(tail(call.stdout, 200))}`);
});

test('I13: with no key, an operation command says how to set one up and exits 2, sending nothing; with no instance it exits 2 too; help still works (AC4)', async () => {
  const home = newHome();
  const m = INST.mark();
  const r = await cli(['graph', 'echo-inputs', '--text', 'hi'], { home, env: { TAPESTRY_INSTANCE: INST.url } });
  assert(r.code === 2 && r.stderr.includes('key new') && r.stderr.includes('TAPESTRY_KEY_FILE'), `exit 2, naming \`tapestry key new\` and TAPESTRY_KEY_FILE; ${said(r)}`);
  assert(INST.since(m).length === 0, 'nothing is sent without a key');
  const noInstance = await cli(['graph'], { home: newHome(), env: { TAPESTRY_KEY_FILE: keyFile(ADMIN) } });
  assert(noInstance.code === 2 && /TAPESTRY_INSTANCE|tapestry use|--instance/.test(noInstance.stderr), `exit 2, saying how to name an instance; ${said(noInstance)}`);
  const help = await cli(['help'], { home: newHome() });
  assert(help.code === 0 && help.stdout.includes('key new') && help.stdout.includes('whoami'), `help works with nothing set up; ${said(help)}`);
});

test('I14: `tapestry login` signs in afresh and says the role; `tapestry logout` ends the sign-in on the instance and forgets it, so the next call signs in again (AC4)', async () => {
  const a = agent(INST, ADMIN);
  assert((await cli(['graph', 'echo-inputs', '--text', 'first'], a)).code === 0, 'the first call signs in');
  let m = INST.mark();
  const login = await cli(['login'], a);
  assert(login.code === 0 && json(login.stdout) && json(login.stdout).role === 'admin', `login says the role; ${said(login)}`);
  assert(count(INST.since(m), '/api/auth/verify-user') === 1 && count(INST.since(m), '/api/auth/login-user') === 1, 'login signs in afresh, though a sign-in was kept');
  m = INST.mark();
  const logout = await cli(['logout'], a);
  const out = INST.since(m).find((x) => x.path === '/api/auth/logout');
  assert(logout.code === 0 && out && /connect\.sid=/.test(out.headers.cookie || ''), `logout ends the sign-in on the instance, with its cookie; ${said(logout)}`);
  m = INST.mark();
  const next = await cli(['graph', 'echo-inputs', '--text', 'after-logout'], a);
  assert(next.code === 0 && count(INST.since(m), '/api/auth/verify-user') === 1, `the next call signs in again; ${said(next)}`);
});

test('I15: runs started at once by one agent all succeed, and what they keep stays usable (AC4)', async () => {
  const a = agent(INST, ADMIN);
  const runs = await Promise.all([1, 2, 3].map((i) => cli(['graph', 'echo-inputs', '--text', `parallel-${i}`], a)));
  for (const r of runs) assert(r.code === 0, `every parallel run succeeds; ${said(r)}`);
  const m = INST.mark();
  const later = await cli(['graph', 'echo-inputs', '--text', 'later'], a);
  assert(later.code === 0 && count(INST.since(m), '/api/auth/verify-user') === 0, `a later run reuses a kept sign-in; ${said(later)}`);
});

// ── SK: the skill (AC6) ───────────────────────────────────────────────────────────────────────────────────────────

function skill() {
  mustExist(SKILL, `${ADR} Decision 8`);
  const text = fs.readFileSync(SKILL, 'utf8');
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert(fm, 'the skill must open with YAML frontmatter between --- lines');
  return { text, front: yaml.load(fm[1]) || {}, body: text.slice(fm[0].length) };
}
function tables() {
  mustExist(COMMANDS, `${ADR} Decision 1`);
  const t = require(COMMANDS);
  assert(Array.isArray(t.COMMANDS) && Array.isArray(t.GLOBAL_FLAGS) && Array.isArray(t.ENV) && t.EXIT_CODES && typeof t.EXIT_CODES === 'object',
    'clients/cli/src/commands.js must export { COMMANDS: [{ words, flags? }], GLOBAL_FLAGS, ENV, EXIT_CODES }');
  return t;
}
/** The `tapestry …` commands the skill shows, from inline code and code blocks. */
function shownCommands(text) {
  const spans = [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
  const blocks = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].flatMap((m) => m[1].split(NL));
  return [...spans, ...blocks].map((s) => s.trim()).filter((s) => /^tapestry(\s|$)/.test(s));
}

test('SK1: the skill is a SKILL.md that Claude Code and OpenClaw load: name tapestry-operations, a description of when to use it, and OpenClaw\'s need of the `tapestry` command (AC6)', () => {
  const { front } = skill();
  assert(front.name === 'tapestry-operations', `name: tapestry-operations; got ${show(front.name)}`);
  assert(typeof front.description === 'string' && front.description.length >= 40 && /tapestry/i.test(front.description), `a description saying when to use it; got ${show(front.description)}`);
  const bins = front.metadata && front.metadata.openclaw && front.metadata.openclaw.requires && front.metadata.openclaw.requires.bins;
  assert(Array.isArray(bins) && bins.includes('tapestry'), `metadata.openclaw.requires.bins includes tapestry; got ${show(front.metadata)}`);
});

test('SK2: the skill covers what the story lists, in order for a cold start: whoami, then lifecycle status, then the listing (AC6)', () => {
  const { body } = skill();
  const topics = {
    'what the operations are for': [/concept graph/i, /nostr/i],
    'installing the CLI': [/npm ci/, /npm link/, /which -a tapestry/, /tapestry --version/],
    'its own key': [/tapestry key new/, /TAPESTRY_KEY_FILE/, /TAPESTRY_SECRET_KEY/, /TAPESTRY_SIGNER/, /TAPESTRY_HOME/],
    'being made an admin': [/owner/i, /admin/i, /manage-administrators/],
    'choosing the instance': [/tapestry use/, /--instance/, /TAPESTRY_INSTANCE/],
    'the cold start': [/tapestry whoami/, /tapestry lifecycle status/],
    'help': [/--help/],
    'answers, refusals and exit codes': [/exit/i, /refus/i],
    'what never to do': [/never/i, /owner['’]s key/i, /cypher/i],
  };
  for (const [topic, res] of Object.entries(topics)) for (const re of res) assert(re.test(body), `the skill must cover ${topic}: missing ${re}`);
  const w = body.indexOf('tapestry whoami');
  const s = body.indexOf('tapestry lifecycle status');
  assert(w >= 0 && s > w, 'the cold start runs whoami before lifecycle status');
});

test('SK3: the skill and the CLI agree: every command, global flag, variable and exit code in the CLI\'s tables is in the skill, and the skill names none it lacks (AC6)', () => {
  const { body } = skill();
  const t = tables();
  const firstWords = new Set(t.COMMANDS.map((c) => c.words[0]));
  for (const c of t.COMMANDS) assert(body.includes(`tapestry ${c.words.join(' ')}`), `the skill must explain \`tapestry ${c.words.join(' ')}\``);
  for (const f of t.GLOBAL_FLAGS) assert(body.includes(f), `the skill must name the global flag ${f}`);
  for (const v of t.ENV) assert(body.includes(v), `the skill must name ${v}`);
  for (const v of new Set(body.match(/TAPESTRY_[A-Z_]+/g) || [])) assert(t.ENV.includes(v), `the skill names ${v}, which the CLI doesn't read`);
  const known = new Set([...t.GLOBAL_FLAGS, ...t.COMMANDS.flatMap((c) => c.flags || []), '--help', '-h', '--version']);
  for (const line of shownCommands(body)) {
    const words = line.split(/\s+/).slice(1);
    let i = 0;
    while (i < words.length && t.GLOBAL_FLAGS.includes(words[i])) i += 2;
    const first = words[i];
    const ok = first === undefined || firstWords.has(first) || /^<.*>$/.test(first) || known.has(first) || (first === 'lifecycle' && words[i + 1] === 'status');
    assert(ok, `the skill shows \`${line}\`, but ${show(first)} is neither a CLI command, <group>, nor lifecycle status`);
    for (const f of words.filter((x) => /^--?[a-z]/.test(x))) {
      const flag = f.split('=')[0];
      assert(known.has(flag) || first === undefined || /^<.*>$/.test(first) || first === 'lifecycle', `the skill shows the flag ${flag} in \`${line}\`, which the CLI doesn't take`);
    }
  }
  const want = { 0: 'answered', 1: 'refused', 2: 'usage', 3: 'failed' };
  assert(same(Object.fromEntries(Object.entries(t.EXIT_CODES).map(([k, v]) => [String(k), v])), Object.fromEntries(Object.entries(want).map(([k, v]) => [String(k), v]))),
    `the exit codes are the internal command's: ${show(want)}; got ${show(t.EXIT_CODES)}`);
  for (const [code, word] of Object.entries(want)) {
    assert(body.split(NL).some((l) => l.includes(code) && new RegExp(word, 'i').test(l)), `the skill must give exit ${code} as ${word}`);
  }
  const named = shownCommands(body).flatMap((line) => [...line.matchAll(/^tapestry\s+(?:--\S+\s+\S+\s+)*(graph|raw|rules|import|export|cache|lifecycle)\s+([a-z][a-z0-9-]*)/g)].map((m) => `${m[1]} ${m[2]}`));
  for (const n of named) assert(n === 'lifecycle status', `the skill names no operation by hand but lifecycle status; it names ${n}`);
});

test('SK4: the CLI\'s help names every command in its table, and a word that is neither a command nor a group exits 2 (AC6)', async () => {
  const t = tables();
  const h = await cli(['help'], { home: newHome() });
  assert(h.code === 0, `help exits 0; ${said(h)}`);
  for (const c of t.COMMANDS) assert(h.stdout.includes(c.words.join(' ')), `help must name \`tapestry ${c.words.join(' ')}\`; got ${show(tail(h.stdout, 600))}`);
  const u = await cli(['frobnicate'], A);
  assert(u.code === 2, `an unknown word exits 2; ${said(u)}`);
});

// ── P: the package, the banner, the README and the image (ADR 0006 Decisions 1, 2, 9, 10) ────────────────────────

test('P1: clients/cli is its own package — tapestry-operations-cli, private, the tapestry bin, Node 20 or later, and only nostr-tools and ajv at the root\'s versions, with its own lockfile (ADR 0006 Decision 1)', () => {
  mustExist(PKG, `${ADR} Decision 1`);
  const pkg = JSON.parse(fs.readFileSync(PKG, 'utf8'));
  assert(pkg.name === 'tapestry-operations-cli' && pkg.private === true, `name and private; got ${show({ name: pkg.name, private: pkg.private })}`);
  assert(pkg.bin && String(pkg.bin.tapestry).replace(/^\.\//, '') === 'bin/tapestry.js', `bin.tapestry is bin/tapestry.js; got ${show(pkg.bin)}`);
  assert(pkg.engines && pkg.engines.node === '>=20', `engines.node >=20; got ${show(pkg.engines)}`);
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  const rootVersion = (n) => lock.packages[`node_modules/${n}`].version;
  assert(same(Object.keys(pkg.dependencies || {}).sort(), ['ajv', 'nostr-tools']), `only ajv and nostr-tools; got ${show(pkg.dependencies)}`);
  for (const n of ['ajv', 'nostr-tools']) assert(pkg.dependencies[n] === rootVersion(n), `${n} pinned exactly at the root's ${rootVersion(n)}; got ${show(pkg.dependencies[n])}`);
  mustExist(LOCK, `${ADR} Decision 1`);
});

test('P2: bin/tapestry.js has a node shebang and is executable (ADR 0006 Decision 1)', () => {
  needCli();
  assert(fs.readFileSync(BIN, 'utf8').split(NL)[0] === '#!/usr/bin/env node', 'the first line is #!/usr/bin/env node');
  assert((fs.statSync(BIN).mode & 0o111) !== 0, 'the file is executable');
});

test('P3: `tapestry --version` prints the banner with the package\'s version and /api/tapestry/, with no network and no key (ADR 0006 Decision 2)', async () => {
  mustExist(PKG, `${ADR} Decision 1`);
  const { version } = JSON.parse(fs.readFileSync(PKG, 'utf8'));
  const r = await cli(['--version'], { home: newHome() });
  assert(r.code === 0 && r.stdout.includes(`tapestry ${version}`) && r.stdout.includes('/api/tapestry/'), `the banner names the version and /api/tapestry/; ${said(r)}`);
});

test('P4: the CLI stays out of the instance: .dockerignore lists clients/, and nothing in src/ or bin/ loads it (ADR 0006 Decision 10)', () => {
  const lines = fs.readFileSync(DOCKERIGNORE, 'utf8').split(NL).map((l) => l.trim());
  assert(lines.includes('clients/'), '.dockerignore must list clients/');
  const files = [...filesUnder(path.join(ROOT, 'src')), ...filesUnder(path.join(ROOT, 'bin'))].filter((f) => f.endsWith('.js'));
  assert(files.length > 50, `src/ and bin/ were scanned; found ${files.length} files`);
  const loads = files.filter((f) => /require\([^)]*clients\//.test(fs.readFileSync(f, 'utf8')));
  assert(loads.length === 0, `the server must not load the client; found ${show(loads.map((f) => path.relative(ROOT, f)))}`);
});

test('P5: the README says how to install from a checkout, and to check for another `tapestry` first (ADR 0006 Decision 9)', () => {
  mustExist(README, `${ADR} Decision 1`);
  const text = fs.readFileSync(README, 'utf8');
  for (const re of [/npm ci/, /npm link/, /which -a tapestry/, /skill/i]) assert(re.test(text), `the README must cover ${re}`);
});

// ── A: only the sign-in and /api/tapestry/, nothing signed but the challenge (AC5) — over every request above ─────

test('A1: across this suite, the CLI reached instances only through the sign-in and /api/tapestry/, every time with its User-Agent (AC5)', () => {
  const all = [INST, INST2].flatMap((i) => i.requests());
  assert(all.length >= 30, `the suite's calls must have reached the instances; got ${all.length} requests`);
  const allowed = (x) => (x.method === 'POST' && SIGN_IN.includes(x.path)) || x.path.startsWith('/api/tapestry/');
  const other = all.filter((x) => !allowed(x));
  assert(other.length === 0, `only the sign-in and /api/tapestry/; also reached ${show([...new Set(other.map((x) => `${x.method} ${x.path}`))])}`);
  const agents = [...new Set(all.map((x) => x.headers['user-agent']))];
  assert(agents.every((u) => /^tapestry-operations-cli\/\S+/.test(u || '')), `every request carries User-Agent tapestry-operations-cli/<version>; got ${show(agents)}`);
});

test('A2: the only signed events the CLI sent were sign-in events, and no request anywhere carried a secret key (AC5, AC1)', () => {
  const all = [INST, INST2, HTML, REDIRECT, TRAP].flatMap((i) => i.requests());
  const withEvent = all.filter((x) => x.body && typeof x.body === 'object' && x.body.event);
  assert(withEvent.length >= 5, `the suite must have signed in several times; got ${withEvent.length}`);
  for (const x of withEvent) assert(x.path === '/api/auth/login-user' && x.body.event.kind === 22242, `a signed event went to ${x.method} ${x.path}, kind ${x.body.event.kind}`);
  const sigs = all.filter((x) => /"sig"\s*:/.test(JSON.stringify(x.body || {})) && x.path !== '/api/auth/login-user');
  assert(sigs.length === 0, `no other request carries a signature; found ${show(sigs.map((x) => x.path))}`);
  const leaked = all.filter((x) => holdsSecret(JSON.stringify(x)));
  assert(leaked.length === 0, `no request may carry a secret key; found ${show(leaked.map((x) => `${x.method} ${x.path}`))}`);
});

test('A3: the CLI\'s code opens no relay connection: no WebSocket, relay, pool or NIP-46 module (AC5)', () => {
  const files = [...filesUnder(path.join(CLI_DIR, 'src')), ...filesUnder(path.join(CLI_DIR, 'bin'))].filter((f) => f.endsWith('.js'));
  assert(files.length >= 3, `clients/cli/src and bin must hold the CLI; found ${files.length} files`);
  const re = /require\(\s*['"](ws|websocket|websocket-polyfill)['"]\s*\)|nostr-tools\/(relay|pool|nip46|abstract-relay|abstract-pool)|\bWebSocket\b/;
  const opening = files.filter((f) => re.test(fs.readFileSync(f, 'utf8')));
  assert(opening.length === 0, `the CLI never talks to a relay; found ${show(opening.map((f) => path.relative(ROOT, f)))}`);
});

// ── Runner ────────────────────────────────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`${NL}=== external-cli ===`);
  let pass = 0;
  let fail = 0;
  const failures = [];
  try {
    try {
      await setup();
    } catch (err) {
      console.log(`  FAIL  setup: ${err.message}`);
      return { pass: 0, fail: tests.length, failures: tests.map(([name]) => ({ name, message: `setup failed: ${err.message}` })), skipped: 0 };
    }
    for (const [name, fn] of tests) {
      try {
        await fn();
        console.log(`  PASS  ${name}`);
        pass++;
      } catch (err) {
        console.log(`  FAIL  ${name}${NL}        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
      }
    }
  } finally {
    for (const c of children) { try { c.kill('SIGKILL'); } catch { /* gone */ } }
    for (const t of temps) { try { fs.rmSync(t, { recursive: true, force: true }); } catch { /* best effort */ } }
  }
  console.log(`${NL}external-cli: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
