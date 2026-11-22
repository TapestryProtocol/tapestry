/**
 * Story 4 (epic: deploy-safety-gate) — The deploy-safety answer sees a running firmware install.
 *
 * Story: engineering-team/stories/deploy-safety-gate/4-deploy-safety-sees-installs.md
 * ADR:   engineering-team/decisions/deploy-safety-gate/0004-deploy-safety-sees-firmware-installs.md
 * Plan:  engineering-team/stories/deploy-safety-gate/4-deploy-safety-sees-installs.test-plan.md
 *
 * Everything here is STACK-FREE. Nothing reaches a control panel, Neo4j, Redis, staging, production or
 * the local container: the handler runs in this process with the queue off (no /etc/brainstorm.conf), every lock lives
 * in a fresh temporary TAPESTRY_BACKUPS_DIR, and the install runs in child processes against a stand-in manifest with
 * no concepts and both passes off, so it makes no call at all.
 *
 *   U-class  computeVerdict's new input, installCount (ADR sub-decisions 1 and 5).
 *   L-class  seedFirmwareFromLock, the pure reading of inspectLock()'s answer (sub-decisions 4 and 6).
 *   M-class  src/firmware/inFlight.js, the in-memory count of today's install (sub-decision 3).
 *   H-class  handleStatus, called with a fake req/res: today's install through the in-memory count, seed-firmware
 *            through a real lifecycle lock held, released or abandoned by a child process (the shell form is a
 *            process of its own), and a fresh process after one was killed mid-install (AC-3).
 *   I-class  install() and its route handler in a child process: counted while they run, let go however they end.
 *   S-class  source sentinels: what the answer never touches (sub-decision 7) and what the count never keeps (AC-3).
 *   D-class  the procedures (AC-6): docs/SAFE_TO_MERGE.md, BIBLE §7, and the two ledger rows.
 *
 * AC-4's end-to-end case (the real check script against the real handler) is B10 in test/safe-to-merge-check.test.js,
 * beside the script's other behavior tests.
 *
 * Review round 1 added H10, S4 and D6–D8, and renamed the two ledger ids (ADR 0004 Amendment 1).
 *
 * Until the feature lands, every test but the guards the plan names fails with a feature-missing message:
 * inFlight.js, seedFirmwareFromLock, the reason and the firmware block don't exist yet, and the docs say nothing.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEPLOY_SAFETY = path.join(ROOT, 'src/api/deploy-safety/index.js');
const IN_FLIGHT = path.join(ROOT, 'src/firmware/inFlight.js');
const STORE = path.join(ROOT, 'src/operations/catalog/lifecycle/_store.js');
const DOC = path.join(ROOT, 'docs/SAFE_TO_MERGE.md');
const BIBLE = path.join(ROOT, 'BIBLE.md');
// The rows' ids carry the UTC day they were minted, 2026-11-22 (review round 1, finding 7; ADR 0004 Amendment 1, item 6).
const GAP_ROW_ID = '2026-11-22-install-starts-after-a-safe-check';
const OVERLAP_ROW_ID = '2026-11-22-overlapping-installs-share-internal-mode';
const GAP_ROW = path.join(ROOT, 'ledger', `${GAP_ROW_ID}.md`);
const OVERLAP_ROW = path.join(ROOT, 'ledger', `${OVERLAP_ROW_ID}.md`);
const OLD_ROW_IDS = ['2026-11-21-install-starts-after-a-safe-check', '2026-11-21-overlapping-installs-share-internal-mode'];
const SEED_FIRMWARE = path.join(ROOT, 'src/operations/catalog/lifecycle/seed-firmware.js');

const REASON = 'FIRMWARE_INSTALL_RUNNING';
const REASON_CODES = [
  'QUEUE_TASK_RUNNING',
  'LEGACY_TASK_RUNNING',
  REASON,
  'NEXT_FIRE_WITHIN_BUFFER',
  'QUEUE_STATE_UNAVAILABLE',
];
const DEFAULT_BUFFER_MS = 10 * 60 * 1000;
// Today's top-level fields of the answer (ADR deploy-safety-gate/0001's payload contract), which AC-5 keeps.
const TODAYS_KEYS = ['success', 'safeToDeploy', 'verdict', 'reasons', 'checkedAt', 'bufferMs', 'queue', 'legacy', 'schedule'];

function assert(cond, msg) { if (!cond) throw new Error(msg); }

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

const isIso = (s) => typeof s === 'string' && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString() === s;
const keysOf = (o) => Object.keys(o || {}).sort().join(',');

/* ─────────────── Feature handles (each throws a feature-missing message, never an opaque error) ─────────────── */

function deploySafety() {
  assert(fs.existsSync(DEPLOY_SAFETY), 'src/api/deploy-safety/index.js is missing — re-baseline this suite.');
  return require(DEPLOY_SAFETY);
}

function computeVerdict() {
  const fn = deploySafety().computeVerdict;
  assert(typeof fn === 'function', 'src/api/deploy-safety/index.js no longer exports computeVerdict() — re-baseline.');
  return fn;
}

function seedFirmwareFromLock() {
  const fn = deploySafety().seedFirmwareFromLock;
  assert(typeof fn === 'function',
    'src/api/deploy-safety/index.js does not export seedFirmwareFromLock(lock) yet — the pure reading of ' +
    'inspectLock()\'s answer that turns a live seed-firmware lock into an install (ADR 0004 sub-decision 4).');
  return fn;
}

function inFlight() {
  assert(fs.existsSync(IN_FLIGHT),
    'src/firmware/inFlight.js does not exist yet — the in-memory count of today\'s install, which install() ' +
    'enters on its first line and leaves in a finally (ADR 0004 sub-decision 3).');
  const mod = require(IN_FLIGHT);
  assert(typeof mod.enter === 'function' && typeof mod.list === 'function',
    'src/firmware/inFlight.js must export enter(install) → leave() and list() (ADR 0004 Implementation notes).');
  return mod;
}

/* ─────────────── U-class fixtures ─────────────── */

/** "Nothing running, nothing scheduled, queue healthy" — story 1's baseline input. */
function baseInput(overrides = {}) {
  return {
    now: Date.parse('2026-11-21T20:28:01.000Z'),
    bufferMs: DEFAULT_BUFFER_MS,
    queueEnabled: true,
    queueStateKnown: true,
    activeCount: 0,
    legacyInFlightCount: 0,
    nextFires: [],
    ...overrides,
  };
}

function fire(atMs) {
  return { entryId: 'seed:refreshSearchIndex', taskId: 'refreshSearchIndex', label: 'Refresh search index', at: new Date(atMs).toISOString() };
}

/* ─────────────── L-class fixtures: locks shaped as inspectLock() returns them (_store.js:232-260) ─────────────── */

function madeLock(overrides = {}) {
  return {
    runId: '20261121T202801Z-0a1b2c3d',
    op: 'seed-firmware',
    host: 'tapestry-container',
    holders: [{ pid: 4242, startTime: 123456 }],
    stage: 'online',
    backup: null,
    paused: [],
    startedAt: '2026-11-21T20:28:01.000Z',
    stale: false,
    ...overrides,
  };
}

/* ─────────────── H-class machinery ─────────────── */

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

/** One answer from handleStatus, called as Express would; asserts the handler really answered (the path ran). */
async function answer(query = {}) {
  const { handleStatus } = deploySafety();
  const res = fakeRes();
  await handleStatus({ query }, res);
  assert(res.statusCode === 200 && res.body && res.body.success === true,
    `handleStatus must answer 200 with success:true (got ${res.statusCode} ${JSON.stringify(res.body)}).`);
  return res.body;
}

/** The answer's install block, asserted present and well-formed: { installCount, installs: [{ install, startedAt }] }. */
function firmwareBlock(body) {
  const f = body.firmware;
  assert(f && typeof f === 'object',
    `the answer has no firmware block — ADR 0004 sub-decision 2 adds firmware: { installCount, installs } to every ` +
    `answer (got top-level keys ${keysOf(body)}).`);
  assert(typeof f.installCount === 'number' && Array.isArray(f.installs) && f.installCount === f.installs.length,
    `firmware must be { installCount: <n>, installs: [<n entries>] } (got ${JSON.stringify(f)}).`);
  return f;
}

/** Run `fn(dir)` with TAPESTRY_BACKUPS_DIR at a fresh temporary folder; put the variable back however it ends. */
async function withBackupsDir(fn) {
  const had = Object.prototype.hasOwnProperty.call(process.env, 'TAPESTRY_BACKUPS_DIR');
  const prev = process.env.TAPESTRY_BACKUPS_DIR;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-safety-sees-installs-'));
  process.env.TAPESTRY_BACKUPS_DIR = dir;
  try {
    return await fn(dir);
  } finally {
    if (had) process.env.TAPESTRY_BACKUPS_DIR = prev;
    else delete process.env.TAPESTRY_BACKUPS_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const LOCK_FILE = (dir) => path.join(dir, '.lock');

/**
 * A process of its own that takes the lifecycle lock through the store (as seed-firmware's begin() does) and holds it:
 * the shell form of seed-firmware, in miniature. release() closes its stdin, and it lets the lock go as seed-firmware's
 * finally does; kill() SIGKILLs it holding the lock, as a deploy's container recreation does.
 */
const HOLDER = `
const store = require(process.argv[1] + '/src/operations/catalog/lifecycle/_store');
const lock = store.acquireLock({ op: process.argv[2] });
if (!lock) { process.stdout.write('BUSY\\n'); process.exit(3); }
process.stdout.write(JSON.stringify(lock) + '\\n');
process.stdin.on('end', () => { store.releaseLock(lock.runId); process.exit(0); });
process.stdin.resume();
`;

function holdLock(dir, op) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', HOLDER, ROOT, op], {
      env: { ...process.env, TAPESTRY_BACKUPS_DIR: dir },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    let settled = false;
    const exited = new Promise((r) => child.on('exit', (code, signal) => r({ code, signal })));
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`the lock-holding child never reported its lock (stderr: ${err.slice(0, 400)})`));
    }, 15000);
    child.stderr.on('data', (d) => { err += d; });
    child.stdout.on('data', (d) => {
      out += d;
      const nl = out.indexOf('\n');
      if (nl < 0 || settled) return;
      settled = true;
      clearTimeout(timer);
      const first = out.slice(0, nl);
      if (first === 'BUSY') { reject(new Error('the lock-holding child found the lock already held')); return; }
      resolve({
        pid: child.pid,
        lock: JSON.parse(first),
        release: async () => { child.stdin.end(); return exited; },
        kill: async () => { child.kill('SIGKILL'); return exited; },
      });
    });
    child.on('error', (e) => { if (!settled) { settled = true; clearTimeout(timer); reject(e); } });
  });
}

/** Run a small node script in a child process; resolve its last stdout line parsed as JSON. */
function runChild(script, args, { env = process.env, timeoutMs = 20000, keepStdin = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script, ROOT, ...args], { env, stdio: [keepStdin ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error(`child timed out after ${timeoutMs} ms (stderr: ${err.slice(0, 400)})`)); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const last = out.trim().split('\n').filter(Boolean).pop();
      try { resolve({ code, result: JSON.parse(last), stderr: err }); }
      catch { reject(new Error(`child exited ${code} without a JSON result (stdout: ${out.slice(0, 400)}; stderr: ${err.slice(0, 400)})`)); }
    });
  });
}

/* ─────────────── I-class machinery: install() in a child, against a stand-in manifest ─────────────── */

/**
 * The child replaces firmware.getManifest (which install() reads through the module object, at call time) with a
 * stand-in that records inFlight.list() each time it is read, mid-run, and returns a manifest with no concepts; both
 * passes are off and it's a dry run, so install() makes no call at all. firmware.getTAPubkey is stood in too, so no
 * key store is read. TAPESTRY_API_BASE points at a closed port, in case anything ever did call out.
 *   mode install  install({ pass1:false, pass2:false, dryRun:true })
 *   mode route    handleFirmwareInstall({ body: <the same> }, fakeRes)
 *   mode throw    a stand-in that throws, so install() rejects
 *   mode overlap  two installs started together
 */
const INSTALL_PROBE = `
const root = process.argv[1], mode = process.argv[2];
const write = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
let inflight;
try { inflight = require(root + '/src/firmware/inFlight'); }
catch (e) { write({ missing: 'src/firmware/inFlight.js: ' + (e.code || e.message) }); process.exit(0); }
console.log = () => {};
const fw = require(root + '/src/api/normalize/firmware');
const inst = require(root + '/src/firmware/install');
const snaps = [];
const manifest = { version: '0.0.0-test', date: '', concepts: [], relationshipTypes: [] };
fw.getTAPubkey = () => null;
fw.getManifest = () => {
  snaps.push(inflight.list());
  if (mode === 'throw') throw new Error('stand-in: the firmware manifest cannot be read');
  return manifest;
};
const opts = { pass1: false, pass2: false, dryRun: true };
(async () => {
  let outcome = null;
  if (mode === 'install') {
    await inst.install(opts);
    outcome = 'resolved';
  } else if (mode === 'route') {
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    await inst.handleFirmwareInstall({ body: opts }, res);
    outcome = { statusCode: res.statusCode, success: !!(res.body && res.body.success) };
  } else if (mode === 'throw') {
    try { await inst.install({}); outcome = 'resolved'; } catch (e) { outcome = 'rejected: ' + e.message; }
  } else if (mode === 'overlap') {
    const a = inst.install(opts);
    const b = inst.install(opts);
    await Promise.all([a, b]);
    outcome = 'both resolved';
  }
  write({ snaps, after: inflight.list(), outcome });
  process.exit(0);
})().catch((e) => { write({ crashed: String(e && e.stack || e) }); process.exit(1); });
`;

async function installProbe(mode) {
  const env = { ...process.env, TAPESTRY_API_BASE: 'http://127.0.0.1:9' };
  const { result } = await runChild(INSTALL_PROBE, [mode], { env });
  assert(!result.missing,
    `${result.missing} — src/firmware/inFlight.js does not exist yet: the in-memory count of today's install ` +
    '(ADR 0004 sub-decision 3).');
  assert(!result.crashed, `the install probe crashed: ${result.crashed}`);
  return result;
}

/** One entry of today's install, as the count holds it: { install: 'firmware-install', startedAt: <ISO> } and nothing else. */
function assertFirmwareInstallEntry(e, where) {
  assert(e && e.install === 'firmware-install',
    `${where}: the entry must name today's install, install: 'firmware-install' (got ${JSON.stringify(e)}).`);
  assert(isIso(e.startedAt), `${where}: the entry's startedAt must be an ISO time (got ${JSON.stringify(e && e.startedAt)}).`);
  assert(keysOf(e) === 'install,startedAt',
    `${where}: the entry must carry only install and startedAt — nothing about who started it (AC-1; got ${keysOf(e)}).`);
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ══════════════ U-class — computeVerdict's installCount ══════════════ */

t('U1 (AC-1): a running install alone makes the verdict unsafe, with FIRMWARE_INSTALL_RUNNING as its only reason', () => {
  const r = computeVerdict()(baseInput({ installCount: 1 }));
  assert(r.verdict === 'unsafe' && r.safeToDeploy === false,
    `with nothing else running or due, one install must make the verdict unsafe (got ${r.verdict}) — ADR 0004 sub-decision 1.`);
  assert(JSON.stringify(r.reasons) === JSON.stringify([REASON]),
    `the reasons must be exactly [${REASON}], a reason of its own (got ${JSON.stringify(r.reasons)}).`);
});

t('U2 (AC-1): the new reason comes after LEGACY_TASK_RUNNING and before QUEUE_STATE_UNAVAILABLE', () => {
  const r = computeVerdict()(baseInput({ activeCount: 1, legacyInFlightCount: 1, installCount: 1, queueStateKnown: false }));
  // queueStateKnown:false with active work is an impossible live state, but the pure core must still order the codes.
  assert(JSON.stringify(r.reasons) === JSON.stringify(['QUEUE_TASK_RUNNING', 'LEGACY_TASK_RUNNING', REASON, 'QUEUE_STATE_UNAVAILABLE']),
    `reason order must be QUEUE_TASK_RUNNING, LEGACY_TASK_RUNNING, ${REASON}, QUEUE_STATE_UNAVAILABLE ` +
    `(ADR 0004 sub-decision 5; got ${JSON.stringify(r.reasons)}).`);
});

t('U3 (AC-1): a running install is a running source — it keeps NEXT_FIRE_WITHIN_BUFFER from being added, and the next fire is still reported', () => {
  const now = baseInput().now;
  const r = computeVerdict()(baseInput({ installCount: 1, nextFires: [fire(now + 2 * 60 * 1000)] }));
  assert(JSON.stringify(r.reasons) === JSON.stringify([REASON]),
    `with an install running and a fire due in 2 min, the reasons must be [${REASON}] alone — a running source keeps ` +
    `NEXT_FIRE_WITHIN_BUFFER out, as the other running sources do (got ${JSON.stringify(r.reasons)}).`);
  assert(r.nextFire && r.nextFire.withinBuffer === true && r.nextFire.inMs === 2 * 60 * 1000,
    `the next fire must still be reported, decorated (got ${JSON.stringify(r.nextFire)}).`);
});

t('U4 (AC-1): an install counts with the task queue off — the install source does not depend on the queue', () => {
  const r = computeVerdict()(baseInput({ queueEnabled: false, queueStateKnown: false, installCount: 1 }));
  assert(r.verdict === 'unsafe' && JSON.stringify(r.reasons) === JSON.stringify([REASON]),
    `queue disabled + one install must be unsafe with [${REASON}] only (got ${r.verdict} ${JSON.stringify(r.reasons)}).`);
});

t('U5 (AC-2): one reason however many installs run — two installs at once add FIRMWARE_INSTALL_RUNNING once', () => {
  const r = computeVerdict()(baseInput({ installCount: 2 }));
  assert(r.verdict === 'unsafe', `two installs must make the verdict unsafe (got ${r.verdict}).`);
  assert(r.reasons.filter((c) => c === REASON).length === 1,
    `${REASON} must appear once, not once per install (got ${JSON.stringify(r.reasons)}).`);
});

t('U6 (AC-5 guard): installCount omitted and installCount 0 give identical verdicts across story 1\'s scenarios', () => {
  const now = baseInput().now;
  const scenarios = [
    baseInput(),
    baseInput({ activeCount: 2 }),
    baseInput({ legacyInFlightCount: 1 }),
    baseInput({ queueStateKnown: false }),
    baseInput({ nextFires: [fire(now + 60 * 1000)] }),
    baseInput({ nextFires: [fire(now + 60 * 60 * 1000)] }),
    baseInput({ queueEnabled: false, queueStateKnown: false }),
  ];
  for (const s of scenarios) {
    const omitted = computeVerdict()(s);
    const zero = computeVerdict()({ ...s, installCount: 0 });
    assert(JSON.stringify(omitted) === JSON.stringify(zero),
      `installCount must default to 0 so today's callers keep their verdicts: omitted gave ${JSON.stringify(omitted)}, ` +
      `0 gave ${JSON.stringify(zero)} for ${JSON.stringify(s)}.`);
    assert(!omitted.reasons.includes(REASON), `no install, no ${REASON} (got ${JSON.stringify(omitted.reasons)}).`);
  }
});

t('U7 (contract): with installs in play, safeToDeploy stays verdict\'s twin, reasons is empty exactly when safe, and every reason is one of the five codes', () => {
  const now = baseInput().now;
  const scenarios = [
    baseInput({ installCount: 1 }),
    baseInput({ installCount: 1, activeCount: 1 }),
    baseInput({ installCount: 1, legacyInFlightCount: 1 }),
    baseInput({ installCount: 1, queueStateKnown: false }),
    baseInput({ installCount: 1, nextFires: [fire(now + 30 * 1000)] }),
    baseInput({ installCount: 1, queueEnabled: false, queueStateKnown: false }),
    baseInput({ installCount: 0 }),
  ];
  let sawInstall = false;
  for (const s of scenarios) {
    const r = computeVerdict()(s);
    assert(r.safeToDeploy === (r.verdict === 'safe'), `safeToDeploy must equal (verdict === 'safe') (got ${JSON.stringify(r)}).`);
    assert((r.reasons.length === 0) === (r.verdict === 'safe'), `reasons must be [] exactly when safe (got ${JSON.stringify(r)}).`);
    assert(r.reasons.every((c) => REASON_CODES.includes(c)), `every reason must be one of the five codes (got ${JSON.stringify(r.reasons)}).`);
    if (r.reasons.includes(REASON)) sawInstall = true;
  }
  assert(sawInstall, `no scenario produced ${REASON} — the installCount input is not read yet (ADR 0004 Implementation notes).`);
});

/* ══════════════ L-class — seedFirmwareFromLock(inspectLock()) ══════════════ */

t('L1 (AC-1): no lock means no install — seedFirmwareFromLock(null) is []', () => {
  const r = seedFirmwareFromLock()(null);
  assert(Array.isArray(r) && r.length === 0, `seedFirmwareFromLock(null) must be [] (got ${JSON.stringify(r)}).`);
});

t('L2 (AC-1): a live seed-firmware lock is one install, { install: \'seed-firmware\', startedAt }, and says nothing about who holds it', () => {
  const lock = madeLock();
  const r = seedFirmwareFromLock()(lock);
  assert(Array.isArray(r) && r.length === 1, `a live seed-firmware lock must give one install (got ${JSON.stringify(r)}).`);
  assert(r[0].install === 'seed-firmware' && r[0].startedAt === lock.startedAt,
    `the install must be { install: 'seed-firmware', startedAt: <the lock's startedAt> } (got ${JSON.stringify(r[0])}).`);
  assert(keysOf(r[0]) === 'install,startedAt',
    `only install and startedAt — no pid, host, run id or caller: AC-1's "nothing about who started it" (got ${keysOf(r[0])}).`);
});

t('L3 (AC-3): a stale seed-firmware lock — its holder gone, or another host\'s — is no install', () => {
  const r = seedFirmwareFromLock()(madeLock({ stale: true }));
  assert(Array.isArray(r) && r.length === 0,
    `a stale lock is what a cut-off run leaves; it must read as no install, as the store itself judges it (got ${JSON.stringify(r)}).`);
  const live = seedFirmwareFromLock()(madeLock());
  assert(live.length === 1, `control: the same lock, live, must give one install (got ${JSON.stringify(live)}).`);
});

t('L4 (AC-3): an unreadable lock, as inspectLock() reports one, is no install', () => {
  const r = seedFirmwareFromLock()({ stale: true, runId: null, op: 'unknown', holders: [], unreadable: true });
  assert(Array.isArray(r) && r.length === 0, `an unreadable lock must read as no install (got ${JSON.stringify(r)}).`);
});

t('L5 (scope): a live lock held by a backup, restore or migration is not a firmware install', () => {
  for (const op of ['backup', 'restore', 'migrate', 'upload']) {
    const r = seedFirmwareFromLock()(madeLock({ op }));
    assert(Array.isArray(r) && r.length === 0,
      `a live ${op} lock must give no install — those jobs are queued in stories/_intake.md, not this story (got ${JSON.stringify(r)}).`);
  }
  assert(seedFirmwareFromLock()(madeLock()).length === 1, 'control: a live seed-firmware lock must give one install.');
});

/* ══════════════ M-class — src/firmware/inFlight.js ══════════════ */

t('M1 (AC-1): inFlight.enter(install) lists one entry, { install, startedAt }, until its leave() is called', () => {
  const m = inFlight();
  const before = m.list().length;
  const leave = m.enter('firmware-install');
  try {
    assert(typeof leave === 'function', `enter() must return a leave() function (got ${typeof leave}).`);
    const now = m.list();
    assert(now.length === before + 1, `entering must add one entry (had ${before}, now ${now.length}).`);
    assertFirmwareInstallEntry(now[now.length - 1], 'inFlight.list()');
  } finally {
    if (typeof leave === 'function') leave();
  }
  assert(m.list().length === before, `leave() must remove the entry (had ${before}, now ${m.list().length}).`);
});

t('M2 (AC-2): overlapping entries are counted apart — each leave() removes only its own, in any order', () => {
  const m = inFlight();
  const before = m.list().length;
  const leaveA = m.enter('firmware-install');
  const leaveB = m.enter('firmware-install');
  try {
    assert(m.list().length === before + 2, `two entries expected (got ${m.list().length - before}).`);
    leaveA();
    assert(m.list().length === before + 1, `after A leaves, B must remain (got ${m.list().length - before}).`);
  } finally {
    leaveA();
    leaveB();
  }
  assert(m.list().length === before, `after both leave, none must remain (got ${m.list().length - before}).`);
});

t('M3 (AC-2): leave() twice is harmless — the second call removes no other install\'s entry', () => {
  const m = inFlight();
  const before = m.list().length;
  const leaveA = m.enter('firmware-install');
  const leaveB = m.enter('firmware-install');
  try {
    leaveA();
    leaveA();
    assert(m.list().length === before + 1, `a second leave() of A must not remove B (got ${m.list().length - before} entries).`);
  } finally {
    leaveA();
    leaveB();
  }
});

t('M4: list() is a copy, sorted by startedAt — changing it changes nothing', () => {
  const m = inFlight();
  const before = m.list().length;
  const leave = m.enter('firmware-install');
  try {
    const l = m.list();
    l.length = 0;
    assert(m.list().length === before + 1, 'emptying the returned array must not empty the count.');
    const sorted = m.list().map((e) => e.startedAt);
    assert(JSON.stringify(sorted) === JSON.stringify([...sorted].sort()), `list() must be sorted by startedAt (got ${JSON.stringify(sorted)}).`);
  } finally {
    leave();
  }
});

/* ══════════════ H-class — handleStatus, stack-free ══════════════ */

t('H1 (AC-1): while today\'s install is counted, the answer is unsafe with FIRMWARE_INSTALL_RUNNING and names it; after leave() it is safe again', async () => {
  await withBackupsDir(async () => {
    const m = inFlight();
    const leave = m.enter('firmware-install');
    let during;
    try {
      during = await answer();
    } finally {
      leave();
    }
    assert(during.verdict === 'unsafe' && during.safeToDeploy === false && during.reasons.includes(REASON),
      `with today's install running, the answer must be unsafe with ${REASON} (got ${during.verdict} ${JSON.stringify(during.reasons)}).`);
    const f = firmwareBlock(during);
    assert(f.installCount === 1, `firmware.installCount must be 1 (got ${f.installCount}).`);
    assertFirmwareInstallEntry(f.installs[0], 'firmware.installs[0]');
    const after = await answer();
    assert(after.verdict === 'safe' && after.reasons.length === 0,
      `after the install leaves, with nothing else running or due, the answer must be safe (got ${after.verdict} ${JSON.stringify(after.reasons)}).`);
    const fa = firmwareBlock(after);
    assert(fa.installCount === 0 && fa.installs.length === 0, `after: firmware must be { installCount: 0, installs: [] } (got ${JSON.stringify(fa)}).`);
  });
});

t('H2 (AC-1): seed-firmware held by a process of its own (the shell form) makes the answer unsafe, naming it, with nothing about who holds it', async () => {
  await withBackupsDir(async (dir) => {
    const holder = await holdLock(dir, 'seed-firmware');
    try {
      const during = await answer();
      assert(during.verdict === 'unsafe' && during.reasons.includes(REASON),
        `a live seed-firmware lock held by another process must make the answer unsafe with ${REASON} ` +
        `(got ${during.verdict} ${JSON.stringify(during.reasons)}) — ADR 0004 sub-decision 4.`);
      const f = firmwareBlock(during);
      assert(f.installCount === 1 && f.installs[0].install === 'seed-firmware' && f.installs[0].startedAt === holder.lock.startedAt,
        `firmware.installs must be [{ install: 'seed-firmware', startedAt: '${holder.lock.startedAt}' }] (got ${JSON.stringify(f.installs)}).`);
      assert(keysOf(f.installs[0]) === 'install,startedAt', `nothing about who holds it (got keys ${keysOf(f.installs[0])}).`);
      const raw = JSON.stringify(during);
      assert(!raw.includes(holder.lock.runId) && !raw.includes(holder.lock.host),
        `the answer must not carry the lock's run id or host (AC-1) — got ${raw.slice(0, 300)}.`);
    } finally {
      await holder.kill();
    }
  });
});

t('H3 (AC-2): when seed-firmware lets the lock go, the next answer no longer reports it and is safe', async () => {
  await withBackupsDir(async (dir) => {
    const holder = await holdLock(dir, 'seed-firmware');
    let during;
    try {
      during = await answer();
    } finally {
      await holder.release();
    }
    assert(during.reasons.includes(REASON), `control: while held, the answer must report the install (got ${JSON.stringify(during.reasons)}).`);
    assert(!fs.existsSync(LOCK_FILE(dir)), 'the released lock file must be gone — the fixture did not release as seed-firmware does.');
    const after = await answer();
    assert(after.verdict === 'safe' && firmwareBlock(after).installCount === 0,
      `after the lock is released, the answer must be safe with no install (got ${after.verdict} ${JSON.stringify(after.firmware)}).`);
  });
});

t('H4 (AC-3): seed-firmware cut off holding the lock (SIGKILL) is not reported afterwards, and the GET leaves its lock file as it was', async () => {
  await withBackupsDir(async (dir) => {
    const holder = await holdLock(dir, 'seed-firmware');
    let during;
    try {
      during = await answer();
    } finally {
      await holder.kill();
    }
    assert(during.reasons.includes(REASON), `control: while the holder lived, the answer must report the install (got ${JSON.stringify(during.reasons)}).`);
    assert(fs.existsSync(LOCK_FILE(dir)), 'the killed holder must leave its lock file behind — the cut-off state this test needs.');
    const leftBefore = fs.readFileSync(LOCK_FILE(dir), 'utf8');
    const after = await answer();
    assert(after.verdict === 'safe' && firmwareBlock(after).installCount === 0,
      `a lock left by a killed holder must not read as a running install (got ${after.verdict} ${JSON.stringify(after.firmware)}) — AC-3.`);
    assert(fs.existsSync(LOCK_FILE(dir)) && fs.readFileSync(LOCK_FILE(dir), 'utf8') === leftBefore,
      'the GET must leave the stale lock file exactly as it was — it reads; it never recovers or removes a lock (ADR 0004 sub-decision 7).');
  });
});

t('H5 (AC-3): after a recreate the container has a new hostname, so a lock naming the old host is not reported, even with a live holder', async () => {
  await withBackupsDir(async (dir) => {
    const store = require(STORE);
    const lock = store.acquireLock({ op: 'seed-firmware' }); // held by this live process, on this host
    assert(lock, 'the fixture could not take the lock in the temporary backups folder.');
    try {
      const live = await answer();
      assert(live.reasons.includes(REASON), `control: a live lock on this host must report the install (got ${JSON.stringify(live.reasons)}).`);
      const file = LOCK_FILE(dir);
      fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, 'utf8')), host: 'the-old-container-id' }));
      const after = await answer();
      assert(after.verdict === 'safe' && firmwareBlock(after).installCount === 0,
        `a lock naming another host must read as no install (got ${after.verdict} ${JSON.stringify(after.firmware)}).`);
    } finally {
      fs.rmSync(LOCK_FILE(dir), { force: true });
    }
  });
});

t('H6 (scope): a live backup lock is not reported as a firmware install; the same lock as seed-firmware is', async () => {
  await withBackupsDir(async (dir) => {
    const holder = await holdLock(dir, 'backup');
    try {
      const r = await answer();
      assert(firmwareBlock(r).installCount === 0 && !r.reasons.includes(REASON),
        `a backup holding the lock must not read as a firmware install (got ${JSON.stringify(r.firmware)} ${JSON.stringify(r.reasons)}).`);
    } finally {
      await holder.release();
    }
    const seed = await holdLock(dir, 'seed-firmware');
    try {
      const r = await answer();
      assert(r.reasons.includes(REASON), `control: a seed-firmware lock must read as an install (got ${JSON.stringify(r.reasons)}).`);
    } finally {
      await seed.release();
    }
  });
});

t('H7 (AC-2): both installs at once — the answer lists both, sorted by startedAt, with one reason, and stays unsafe until the last ends', async () => {
  await withBackupsDir(async (dir) => {
    const holder = await holdLock(dir, 'seed-firmware');
    const m = inFlight();
    let leave = null;
    try {
      await new Promise((r) => setTimeout(r, 5)); // so the two startedAt times differ
      leave = m.enter('firmware-install');
      const both = await answer();
      const f = firmwareBlock(both);
      assert(f.installCount === 2, `both installs must be listed (got ${JSON.stringify(f)}).`);
      assert(f.installs.map((e) => e.install).join(',') === 'seed-firmware,firmware-install',
        `the list must be sorted by startedAt — seed-firmware started first (got ${JSON.stringify(f.installs)}).`);
      assert(both.reasons.filter((c) => c === REASON).length === 1, `${REASON} once, not once per install (got ${JSON.stringify(both.reasons)}).`);
      leave();
      leave = null;
      const one = await answer();
      assert(one.verdict === 'unsafe' && firmwareBlock(one).installCount === 1 && one.firmware.installs[0].install === 'seed-firmware',
        `with one install still running the answer must stay unsafe, listing it (got ${one.verdict} ${JSON.stringify(one.firmware)}).`);
    } finally {
      if (leave) leave();
      await holder.release();
    }
    const none = await answer();
    assert(none.verdict === 'safe' && firmwareBlock(none).installCount === 0, `after both end the answer must be safe (got ${none.verdict}).`);
  });
});

t('H8 (AC-5): with no install running, every field the answer carries today keeps its value, and its one addition, the install block, is empty', async () => {
  await withBackupsDir(async () => {
    const r = await answer();
    for (const k of TODAYS_KEYS) assert(Object.prototype.hasOwnProperty.call(r, k), `today's field ${k} must still be in the answer (got ${keysOf(r)}).`);
    const added = Object.keys(r).filter((k) => !TODAYS_KEYS.includes(k));
    assert(JSON.stringify(added) === JSON.stringify(['firmware']),
      `the answer's only new top-level field must be firmware (got additions ${JSON.stringify(added)}) — AC-5 as amended.`);
    const f = firmwareBlock(r);
    assert(f.installCount === 0 && f.installs.length === 0 && keysOf(f) === 'installCount,installs',
      `with nothing running, firmware must be exactly { installCount: 0, installs: [] } (got ${JSON.stringify(f)}).`);
    assert(r.verdict === 'safe' && r.safeToDeploy === true && r.reasons.length === 0, `nothing running, nothing due: safe (got ${r.verdict}).`);
    assert(r.bufferMs === DEFAULT_BUFFER_MS, `bufferMs must still echo the 10-minute default (got ${r.bufferMs}).`);
    assert(r.queue && r.queue.enabled === false && keysOf(r.queue) === 'enabled',
      `with no queue configured, queue must still be { enabled: false } (got ${JSON.stringify(r.queue)}).`);
    assert(r.legacy && keysOf(r.legacy) === 'inFlightCount' && r.legacy.inFlightCount === 0,
      `legacy must still be { inFlightCount: 0 } (got ${JSON.stringify(r.legacy)}).`);
    assert(r.schedule && typeof r.schedule.enabledEntryCount === 'number' && r.schedule.nextFire === null,
      `schedule must still be { enabledEntryCount, nextFire: null } with the queue off (got ${JSON.stringify(r.schedule)}).`);
  });
});

/** A child that enters today's install in its own memory and waits: the instance, mid-install, before a recreate. */
const MID_INSTALL = `
const write = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
let inflight;
try { inflight = require(process.argv[1] + '/src/firmware/inFlight'); }
catch (e) { write({ missing: 'src/firmware/inFlight.js: ' + (e.code || e.message) }); process.exit(0); }
inflight.enter('firmware-install');
write({ entered: inflight.list().length });
process.stdin.resume();
`;

/** A fresh process, the instance after its restart: its first answer, then one after entering an install itself. */
const RESTARTED = `
const write = (o) => process.stdout.write(JSON.stringify(o) + '\\n');
const ds = require(process.argv[1] + '/src/api/deploy-safety');
let inflight;
try { inflight = require(process.argv[1] + '/src/firmware/inFlight'); }
catch (e) { write({ missing: 'src/firmware/inFlight.js: ' + (e.code || e.message) }); process.exit(0); }
const ask = async () => { const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } }; await ds.handleStatus({ query: {} }, res); return res.body; };
(async () => {
  const first = await ask();
  const leave = inflight.enter('firmware-install');
  const control = await ask();
  leave();
  write({ first: { verdict: first.verdict, firmware: first.firmware }, control: { verdict: control.verdict, firmware: control.firmware } });
  process.exit(0);
})().catch((e) => { write({ crashed: String(e && e.stack || e) }); process.exit(1); });
`;

t('H9 (AC-3): today\'s install cut off by a restart is not reported by the restarted process — the count lives only in memory', async () => {
  await withBackupsDir(async (dir) => {
    const env = { ...process.env, TAPESTRY_BACKUPS_DIR: dir };
    // The instance mid-install: a process that has entered today's install, then is killed, as a recreate kills it.
    const mid = spawn(process.execPath, ['-e', MID_INSTALL, ROOT], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    const first = await new Promise((resolve, reject) => {
      let out = '';
      const timer = setTimeout(() => { mid.kill('SIGKILL'); reject(new Error('the mid-install child never reported')); }, 15000);
      mid.stdout.on('data', (d) => { out += d; const nl = out.indexOf('\n'); if (nl >= 0) { clearTimeout(timer); resolve(JSON.parse(out.slice(0, nl))); } });
      mid.on('error', reject);
    });
    const killed = new Promise((r) => mid.on('exit', r));
    mid.kill('SIGKILL');
    await killed;
    assert(!first.missing, `${first.missing} — src/firmware/inFlight.js does not exist yet (ADR 0004 sub-decision 3).`);
    assert(first.entered === 1, `the mid-install child must have counted its install (got ${JSON.stringify(first)}).`);
    // The instance after its restart: a fresh process.
    const { result } = await runChild(RESTARTED, [], { env });
    assert(!result.missing, `${result.missing} — src/firmware/inFlight.js does not exist yet.`);
    assert(!result.crashed, `the restarted process crashed: ${result.crashed}`);
    assert(result.first.firmware && result.first.firmware.installCount === 0 && result.first.verdict === 'safe',
      `the restarted process must report no install — nothing of the killed one's count survives it (got ${JSON.stringify(result.first)}).`);
    assert(result.control.firmware && result.control.firmware.installCount === 1 && result.control.verdict === 'unsafe',
      `control: the restarted process must report its own install once it enters one (got ${JSON.stringify(result.control)}).`);
  });
});

/*
 * H10 — review round 1, finding 6 (ADR 0004 Amendment 1, item 4). After a restart that keeps the hostname, a cut-off
 * seed-firmware lock is stale only because its holder's pid, if it answers at all, has a different /proc start time
 * (_store.js holderAlive). This stands in for that one read, /proc/<pid>/stat, so it runs on macOS, which has no /proc,
 * as on CI. fs is the same module object the store reads through; every other path reads as it always does, and the
 * stand-in is put back before the test ends. The reads are synchronous, so nothing else runs while it is in place.
 */
t('H10 (AC-3): a lock naming this host and a live pid whose start time differs — a pid the restarted container reused — is no install; with the matching start time it is one', async () => {
  await withBackupsDir(async (dir) => {
    const store = require(STORE);
    const read = seedFirmwareFromLock();
    const statPath = `/proc/${process.pid}/stat`;
    // /proc/<pid>/stat: "<pid> (<comm>) <state> …" with the start time 20th after the ") " (field 22).
    const stat = (startTime) => `${process.pid} (node) S 1 1 1 0 -1 4194560 100 0 0 0 1 1 0 0 20 0 1 0 ${startTime} 1000000 100 18446744073709551615`;
    fs.writeFileSync(LOCK_FILE(dir), JSON.stringify(madeLock({
      host: os.hostname(),
      holders: [{ pid: process.pid, startTime: 4242 }],
      stale: undefined,
    })));
    const realRead = fs.readFileSync;
    let answers = 4242;
    let same;
    let reused;
    fs.readFileSync = function readFileSync(p, ...rest) {
      if (p === statPath) return stat(answers);
      return realRead.call(this, p, ...rest);
    };
    try {
      answers = 4242;
      same = read(store.inspectLock());
      answers = 9999;
      reused = read(store.inspectLock());
    } finally {
      fs.readFileSync = realRead;
    }
    assert(Array.isArray(same) && same.length === 1 && same[0].install === 'seed-firmware',
      `control: a lock whose holder answers with the start time it recorded must read as a live install (got ${JSON.stringify(same)}).`);
    assert(Array.isArray(reused) && reused.length === 0,
      `a lock whose holder pid answers with a different start time — another process, given the dead holder's pid — must read as no install (got ${JSON.stringify(reused)}); after a restart that keeps the hostname, this rule is all that marks a cut-off run's lock stale.`);
  });
});

/* ══════════════ I-class — install() and its route, in a child process ══════════════ */

t('I1 (AC-1): install() counts itself while it runs — mid-run the count holds one firmware-install entry — and is gone once it resolves (a dry run included)', async () => {
  const r = await installProbe('install');
  assert(r.outcome === 'resolved', `the stand-in install must resolve (got ${JSON.stringify(r.outcome)}).`);
  assert(r.snaps.length >= 1, 'the stand-in manifest was never read — the probe did not run install().');
  for (const [i, s] of r.snaps.entries()) {
    assert(Array.isArray(s) && s.length === 1,
      `mid-run read ${i + 1}: the count must hold exactly this install (got ${JSON.stringify(s)}) — install() enters it on its first line (ADR 0004 sub-decision 3).`);
    assertFirmwareInstallEntry(s[0], `mid-run read ${i + 1}`);
  }
  assert(Array.isArray(r.after) && r.after.length === 0, `once install() resolves, the count must be empty (got ${JSON.stringify(r.after)}).`);
});

t('I2 (AC-1): the route — POST /api/firmware/install\'s handler — is counted too, and lets go when it answers', async () => {
  const r = await installProbe('route');
  assert(r.outcome && r.outcome.statusCode === 200 && r.outcome.success === true,
    `the route handler must answer 200 success for the stand-in install (got ${JSON.stringify(r.outcome)}).`);
  assert(r.snaps.length >= 1 && r.snaps.every((s) => s.length === 1),
    `mid-run, the route's install must be counted once (got ${JSON.stringify(r.snaps)}).`);
  assertFirmwareInstallEntry(r.snaps[0][0], 'the route\'s mid-run read');
  assert(r.after.length === 0, `once the route answers, the count must be empty (got ${JSON.stringify(r.after)}).`);
});

t('I3 (AC-2): an install that fails is counted while it runs and let go when it throws', async () => {
  const r = await installProbe('throw');
  assert(typeof r.outcome === 'string' && r.outcome.startsWith('rejected: stand-in'),
    `install() must reject with the stand-in's error (got ${JSON.stringify(r.outcome)}).`);
  assert(r.snaps.length === 1 && r.snaps[0].length === 1,
    `before it failed, the install must have been counted (got ${JSON.stringify(r.snaps)}).`);
  assert(r.after.length === 0, `a failed install must leave the count empty — leave() in a finally (got ${JSON.stringify(r.after)}).`);
});

t('I4 (AC-2): two of today\'s installs at once are both counted, and the count is empty once both end', async () => {
  const r = await installProbe('overlap');
  assert(r.outcome === 'both resolved', `both stand-in installs must resolve (got ${JSON.stringify(r.outcome)}).`);
  const most = Math.max(...r.snaps.map((s) => s.length));
  assert(most === 2,
    `while both ran, the count must have held both (largest mid-run count ${most}; reads ${JSON.stringify(r.snaps.map((s) => s.length))}).`);
  assert(r.after.length === 0, `once both end, the count must be empty (got ${JSON.stringify(r.after)}).`);
});

/* ══════════════ S-class — source sentinels ══════════════ */

t('S1 (AC-3 guard): the deploy-safety module never reads a run record, log or install marker, and never changes the lock', () => {
  const src = readSafe(DEPLOY_SAFETY);
  assert(src !== null, 'src/api/deploy-safety/index.js is missing — re-baseline.');
  const forbidden = ['.runs', 'runsDir', 'runFile', 'runLog', 'lastRun', 'lastMigrateRun', 'firmware-on-boot',
    'acquireLock', 'releaseLock', 'recoverIfStale', 'updateLock', 'addHolder', 'begin('];
  for (const token of forbidden) {
    assert(!src.includes(token),
      `src/api/deploy-safety/index.js mentions "${token}". The answer reads the live lock through inspectLock() only: a ` +
      'run record or marker can outlive its install and read as running (story 1\'s phantom trap), and anything that ' +
      'changes the lock makes the GET a write (ADR 0004 sub-decision 7).');
  }
});

t('S2 (AC-3): src/firmware/inFlight.js keeps nothing outside memory — no file, process or network module', () => {
  inFlight();
  const src = readSafe(IN_FLIGHT);
  for (const mod of ['fs', 'child_process', 'net', 'http', 'https', 'os']) {
    assert(!new RegExp(`require\\(\\s*['"\`](node:)?${mod}['"\`]\\s*\\)`).test(src),
      `src/firmware/inFlight.js requires '${mod}'. The count must live only in the control panel's memory, so a restart ` +
      'clears it and nothing can read as running afterwards (AC-3; ADR 0004 Option A).');
  }
  assert(!/require\(/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')),
    'src/firmware/inFlight.js must require nothing at all (ADR 0004 Implementation notes).');
});

t('S3 (AC-1): the deploy-safety module reads both new sources — the in-memory count and the lifecycle lock through inspectLock()', () => {
  const src = readSafe(DEPLOY_SAFETY);
  assert(src !== null, 'src/api/deploy-safety/index.js is missing — re-baseline.');
  assert(/firmware\/inFlight/.test(src), 'the module never requires src/firmware/inFlight — today\'s install would go unseen.');
  assert(/inspectLock\(/.test(src), 'the module never calls inspectLock() — seed-firmware would go unseen.');
});

t('S4 (AC-1; round 1, finding 1): seed-firmware takes the lifecycle lock as \'seed-firmware\' before it writes and lets it go in a finally, and the call names the deploy-safety answer as a reader', () => {
  const src = readSafe(SEED_FIRMWARE);
  assert(src !== null, 'src/operations/catalog/lifecycle/seed-firmware.js is missing — re-baseline.');
  const begin = src.search(/C\.begin\(\s*'seed-firmware'\s*\)/);
  assert(begin >= 0,
    'seed-firmware no longer takes the lifecycle lock as C.begin(\'seed-firmware\'). The deploy-safety answer sees a running ' +
    'seed-firmware only through a lock whose op is \'seed-firmware\' (ADR 0004 sub-decision 4); a renamed op would blind the gate.');
  const write = src.indexOf('graph.writeTransaction(', begin);
  assert(write > begin, 'seed-firmware must take the lock before its write transaction, so no write runs uncounted.');
  const fin = src.indexOf('finally', write);
  const release = fin > 0 ? src.indexOf('store.releaseLock(lock.runId)', fin) : -1;
  assert(fin > write && release > fin, 'seed-firmware must let the lock go in a finally after its writes, so the answer lets go however it ends.');
  const lineStart = src.lastIndexOf('\n', begin);
  const comment = src.slice(Math.max(0, lineStart - 800), lineStart);
  assert(/deploy-safety/.test(comment),
    'a comment just above C.begin(\'seed-firmware\') must name the deploy-safety answer as a reader of this lock (ADR 0004 ' +
    'Amendment 1, item 3: comments at both ends).');
  const ds = readSafe(DEPLOY_SAFETY);
  assert(ds !== null && /'seed-firmware'/.test(ds), 'the deploy-safety module must read the lock by the same op, \'seed-firmware\'.');
});

/* ══════════════ D-class — the procedures (AC-6) ══════════════ */

/** The text of a markdown section: from its heading line to the next heading of the same or a higher level. */
function section(content, headingRe, file) {
  const lines = content.split('\n');
  const start = lines.findIndex((l) => /^#{1,6} /.test(l) && headingRe.test(l));
  assert(start >= 0, `${file} has no section whose heading matches ${headingRe}.`);
  const level = lines[start].match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+) /);
    if (m && m[1].length <= level) { end = i; break; }
  }
  return lines.slice(start, end).join('\n');
}

t('D1 (AC-6): the safe-to-merge recipe says a running firmware install counts, and names its reason', () => {
  const doc = readSafe(DOC);
  assert(doc !== null, 'docs/SAFE_TO_MERGE.md is missing — re-baseline.');
  const what = section(doc, /What the check is/i, 'docs/SAFE_TO_MERGE.md');
  assert(/firmware install/i.test(what),
    '"What the check is" must say that a running firmware install counts, as a scheduled task does (ADR 0004 sub-decision 8).');
  assert(doc.includes(REASON), `docs/SAFE_TO_MERGE.md must name the reason the journal will show, ${REASON}.`);
});

t('D2 (AC-6): "Before a firmware install" tells the installer to check for a running or queued deploy, and how, and what a hang and the command-line form mean', () => {
  const doc = readSafe(DOC);
  assert(doc !== null, 'docs/SAFE_TO_MERGE.md is missing — re-baseline.');
  const s = section(doc, /Before a firmware install/i, 'docs/SAFE_TO_MERGE.md');
  assert(/gh run list/.test(s) && /deploy-staging\.yml/.test(s) && /deploy-tapestry\.yml/.test(s),
    'the section must give the gh run list command for staging (deploy-staging.yml) and say which workflow production uses (deploy-tapestry.yml).');
  assert(/completed/.test(s) && /queued|waiting/i.test(s) && /running/i.test(s),
    'the section must say to check that no deploy of that instance is running or queued — runs whose status is not completed.');
  assert(/unsafe/i.test(s), 'the section must say that once the install starts, the instance\'s answer is unsafe until it ends.');
  assert(/hang/i.test(s) && /bound/i.test(s) && /operator/i.test(s),
    'the section must say an install that hangs keeps the answer unsafe, so a merger\'s check stops at its bound and the operator decides.');
  assert(/node src\/firmware\/install\.js/.test(s) && /(isn't|is not|not) seen/i.test(s),
    'the section must say that today\'s install run from the command line (node src/firmware/install.js) isn\'t seen.');
  assert(s.includes(GAP_ROW_ID), `the section must point at the ledger row for the gap that remains, ${GAP_ROW_ID}.`);
});

/** A ledger row's header fields (engineering-team/templates/open-row.md; harness-lint L15 checks the same). */
function ledgerRow(file, id) {
  const text = readSafe(file);
  assert(text !== null, `ledger/${id}.md does not exist yet.`);
  const field = (name) => { const m = text.match(new RegExp(`^\\*\\*${name}:\\*\\*\\s*(.+)$`, 'm')); return m ? m[1].trim() : null; };
  assert(field('Id') === id, `ledger/${id}.md must repeat its id in **Id:** (got ${JSON.stringify(field('Id'))}).`);
  assert(/^(bug|feature|protocol|docs|cleanup|meta)\b/.test(field('Type') || ''), `ledger/${id}.md needs a **Type:** from the template's list.`);
  assert(/^OPEN\b/.test(field('Status') || ''), `ledger/${id}.md must open as **Status:** OPEN.`);
  return text;
}

t('D3 (AC-6): a ledger row records the gap that remains — a merger whose check came just before the install started', () => {
  const text = ledgerRow(GAP_ROW, GAP_ROW_ID);
  assert(/install/i.test(text) && /check/i.test(text) && /merge/i.test(text) && /safe/i.test(text),
    `ledger/${GAP_ROW_ID}.md must describe the gap: an install that starts after a merger's check said safe, before that merge's deploy recreates the container.`);
});

t('D4 (AC-6): BIBLE §7\'s Firmware Install section says an install makes the answer unsafe and points to the installer\'s procedure', () => {
  const bible = readSafe(BIBLE);
  assert(bible !== null, 'BIBLE.md is missing — re-baseline.');
  const s = section(bible, /^### Firmware Install\s*$/, 'BIBLE.md');
  assert(s.includes(REASON) || /deploy-safety/i.test(s),
    `BIBLE §7's Firmware Install section must say that while an install runs, the deploy-safety answer is unsafe (${REASON}).`);
  assert(/SAFE_TO_MERGE\.md/.test(s) && /Before a firmware install/i.test(s),
    'BIBLE §7\'s Firmware Install section must point to docs/SAFE_TO_MERGE.md, "Before a firmware install".');
});

t('D5 (ADR deliverable): a ledger row records the hazard found in passing — two of today\'s installs at once share internal mode', () => {
  const text = ledgerRow(OVERLAP_ROW, OVERLAP_ROW_ID);
  assert(/internal mode|_internalMode/i.test(text),
    `ledger/${OVERLAP_ROW_ID}.md must name the module-wide internal mode the two installs share (ADR 0004 Consequences).`);
});

t('D6 (round 1, finding 7): the two rows carry the UTC day they were minted — the 2026-11-21 files are gone, not copied', () => {
  for (const id of OLD_ROW_IDS) {
    assert(!fs.existsSync(path.join(ROOT, 'ledger', `${id}.md`)),
      `ledger/${id}.md must be renamed to its UTC day (2026-11-22), not left beside the new one (ADR 0004 Amendment 1, item 6).`);
  }
  for (const f of [GAP_ROW, OVERLAP_ROW]) {
    assert(fs.existsSync(f), `${path.relative(ROOT, f)} does not exist yet.`);
  }
  const doc = readSafe(DOC) || '';
  for (const id of OLD_ROW_IDS) assert(!doc.includes(id), `docs/SAFE_TO_MERGE.md still cites the old id ${id}.`);
});

t('D7 (AC-6; round 1, blocking 1): "Before a firmware install" says an answer with no firmware block doesn\'t see installs, names tags and production, says to hold merges by hand there, and names deploy-tags.yml', () => {
  const doc = readSafe(DOC);
  assert(doc !== null, 'docs/SAFE_TO_MERGE.md is missing — re-baseline.');
  const s = section(doc, /Before a firmware install/i, 'docs/SAFE_TO_MERGE.md');
  // The transition note itself, from its opening sentence to the next bold paragraph: each part is checked there, so
  // another sentence of the section can't stand in for a part that went missing (review round 2, finding 3).
  const start = s.indexOf('**An instance sees an install only once');
  assert(start >= 0,
    'the section must open its transition note with "An instance sees an install only once its branch carries story #4" (ADR 0004 Amendment 1, item 1).');
  const end = s.indexOf('\n\n**', start + 1);
  const note = s.slice(start, end > start ? end : undefined);
  assert(/no `firmware` block/.test(note),
    'the transition note must say how to tell an instance that doesn\'t see installs yet: its answer has no `firmware` block.');
  assert(/tags\.brainstorm\.world/.test(note) && /feat\/tags/.test(note),
    'the transition note must name tags.brainstorm.world and its branch, feat/tags, which doesn\'t see installs yet.');
  assert(/production until `main`/.test(note),
    'the transition note must name production, until `main` takes story #4.');
  assert(/held by hand/.test(note),
    'the transition note must say that on such an instance, merges into its branch are held by hand until the install ends.');
  // "Nobody needs to hold merges by hand" is false where a branch lacks story #4 (review round 1, blocking 1). So its
  // sentence must be qualified ("on that instance"), and its paragraph must name the instance it means, one that carries
  // story #4: "on that instance" alone would let the condition drop (review round 2's fix check, F4).
  const nobodySentences = s.split(/(?<=[.!?])\s+/).filter((x) => /nobody needs to hold merges/i.test(x));
  assert(nobodySentences.every((x) => /on that instance|carries story #4/.test(x)),
    `"nobody needs to hold merges by hand" must be qualified in its own sentence. Got: ${JSON.stringify(nobodySentences)}.`);
  const nobodyParagraphs = s.split(/\n\s*\n/).filter((p) => /nobody needs to hold merges/i.test(p));
  assert(nobodyParagraphs.every((p) => /carries story #4/.test(p)),
    `"nobody needs to hold merges by hand" may stand only in a paragraph that limits it to an instance that carries story #4. Got: ${JSON.stringify(nobodyParagraphs)}.`);
  assert(/deploy-tags\.yml/.test(s), 'the running-deploy check must name tags\' workflow, deploy-tags.yml, beside staging\'s and production\'s.');
});

t('D8 (AC-6; round 1, finding 5): the gap paragraph also says a merge that skips the check isn\'t held (OPEN.md row 340)', () => {
  const doc = readSafe(DOC);
  assert(doc !== null, 'docs/SAFE_TO_MERGE.md is missing — re-baseline.');
  const s = section(doc, /Before a firmware install/i, 'docs/SAFE_TO_MERGE.md');
  assert(/skips? the check/i.test(s) && /row 340/.test(s),
    'the section must say that a merge which skips the check isn\'t held either, and point at OPEN.md row 340.');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- deploy-safety sees installs tests (epic deploy-safety-gate, Story 4) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message.split('\n')[0]}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\ndeploy-safety-sees-installs: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
