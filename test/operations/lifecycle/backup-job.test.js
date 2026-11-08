'use strict';
/**
 * The lifecycle job, the real system and the Docker configuration — story graph-operations-foundation #2 (Loom A10.2),
 * ADR graph-operations-foundation/0002 Decisions 8 and 13. Run by test/operations.test.js.
 *
 * Stack-free: the job runner is driven with a stand-in worker; _system.js is driven with stand-in `runuser`,
 * `supervisorctl` and `neo4j-admin` commands put first on PATH, which log what they were asked.
 *
 *   J1  runDetached writes the request to .runs/<runId>.json, runs the worker on it, and resolves its result
 *   J2  the job finishes, and writes its result, even when its caller is killed while it runs
 *   J3  a job that dies without a result is reported failed, and its lock is removed
 *   J4  after an assistant-changing restore, the job restarts the control panel once its caller marks the answer out
 *   J5  … or once its caller is gone, or at its time limit; never after a backup (ADR 0002 Amendment 1)
 *   J6  a job that can't be started is failed, and its lock removed (review round 1)
 *   J7  recovering a stale lock removes only that lock (review round 1)
 *   J8  a restore that failed after its key went in still restarts the control panel: its record carries restarting
 *   J9  a lock appears whole: written to a file of its own and linked into place, never found empty
 *   J10 the worker runs nothing when the lock is no longer its run's (J8–J10: ADR 0002 Amendment 1, A4)
 *   Y1  _system.js runs neo4j-admin as user neo4j through runuser, and supervisorctl, with the arguments the ADR names
 *   Y2  programStatus reads supervisorctl status, which exits 3 when some program isn't running
 *   K1  nginx: /api/tapestry/lifecycle/ keeps X-Forwarded-For, streams and waits 900 s; only the upload takes 9g (A4)
 *   K2  supervisord: neo4j gets 120 s to stop, and the stop reaches its whole process group
 *   K3  the docs: OPERATIONS.md's backups section and ADR security-auth-exposure/0005's pointer to ADR 0002
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const F = require('../../helpers/lifecycleFakes');

const { suite, assert, show } = F;
const S = suite('lifecycle backup job and system');
const test = S.test;
const ROOT = F.ROOT;
const NL = String.fromCharCode(10);
const JOBS = path.join(ROOT, 'src/operations/catalog/lifecycle/_jobs.js');
const SYSTEM = path.join(ROOT, 'src/operations/catalog/lifecycle/_system.js');
const need = (abs, why) => { if (!fs.existsSync(abs)) throw new Error(`${path.relative(ROOT, abs)} does not exist yet (${why})`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A stand-in worker: reads its request, notes it started, waits payload.delayMs, writes a result and releases the lock. */
const FAKE_WORKER = [
  `'use strict';`,
  `const fs = require('fs'); const path = require('path');`,
  `const dir = process.env.TAPESTRY_BACKUPS_DIR; const runId = process.argv[2];`,
  `const file = path.join(dir, '.runs', runId + '.json');`,
  `const req = JSON.parse(fs.readFileSync(file, 'utf8'));`,
  `fs.writeFileSync(path.join(dir, 'started-' + runId), String(process.pid));`,
  `setTimeout(() => {`,
  `  if (req.payload.mode === 'vanish') process.exit(1);`,
  `  fs.writeFileSync(file, JSON.stringify({ ...req, outcome: 'done', result: { echoed: req.payload.value, workerPid: process.pid }, finishedAt: new Date().toISOString() }));`,
  `  try { const l = JSON.parse(fs.readFileSync(path.join(dir, '.lock'), 'utf8')); if (l.runId === runId) fs.rmSync(path.join(dir, '.lock')); } catch {}`,
  `  process.exit(0);`,
  `}, req.payload.delayMs || 0);`,
].join(NL);

/** A caller script that runs runDetached and prints RESULT:<record>. */
function callerScript(runId, payload, workerPath) {
  return [
    `'use strict';`,
    `for (const k of ['log', 'info', 'debug', 'warn']) console[k] = () => {};`,
    `const jobs = require(${show(JOBS)});`,
    `jobs.runDetached({ op: 'backup', runId: ${show(runId)}, payload: ${show(payload)} }, { workerPath: ${show(workerPath)} })`,
    `  .then((rec) => process.stdout.write('RESULT:' + JSON.stringify(rec) + '\\n'), (e) => process.stdout.write('RESULT:' + JSON.stringify({ threw: e.message }) + '\\n'));`,
  ].join(NL);
}
function jobDir(name) {
  const dir = fs.mkdtempSync(path.join(S.base(), `${name}-`));
  const backups = path.join(dir, 'backups');
  fs.mkdirSync(path.join(backups, '.runs'), { recursive: true, mode: 0o700 });
  const worker = path.join(dir, 'fake-worker.js');
  fs.writeFileSync(worker, FAKE_WORKER);
  const env = { ...process.env, TAPESTRY_BACKUPS_DIR: backups, HOME: dir };
  return { dir, backups, worker, env };
}
const resultOf = (stdout) => {
  const line = String(stdout || '').split(NL).find((l) => l.startsWith('RESULT:'));
  return line ? JSON.parse(line.slice(7)) : null;
};

test('J1: runDetached writes the request to .runs/<runId>.json, runs the worker on it as a process of its own, and resolves its record', () => {
  need(JOBS, 'ADR graph-operations-foundation/0002 Decision 8');
  const j = jobDir('j1');
  const runId = F.newId();
  const script = path.join(j.dir, 'caller.js');
  fs.writeFileSync(script, callerScript(runId, { value: 42 }, j.worker));
  const r = spawnSync(process.execPath, [script], { cwd: ROOT, env: j.env, encoding: 'utf8', timeout: 30000 });
  const rec = resultOf(r.stdout);
  assert(rec && rec.outcome === 'done' && rec.result && rec.result.echoed === 42, `runDetached resolves the worker's record { outcome: 'done', result }; got ${show(rec)} ${String(r.stderr).slice(-400)}`);
  assert(rec.result.workerPid !== r.pid, 'the worker is a process of its own');
  const file = JSON.parse(fs.readFileSync(path.join(j.backups, '.runs', `${runId}.json`), 'utf8'));
  assert(file.op === 'backup' && file.runId === runId && file.payload.value === 42 && file.outcome === 'done', `the run file holds the request and the outcome; got ${show(file)}`);
});

test('J2: the job finishes and writes its result even when Ctrl-C reaches its caller\'s whole process group mid-run', async () => {
  need(JOBS, 'ADR graph-operations-foundation/0002 Decision 8');
  const j = jobDir('j2');
  const runId = F.newId();
  const script = path.join(j.dir, 'caller.js');
  fs.writeFileSync(script, callerScript(runId, { value: 7, delayMs: 1500 }, j.worker));
  // The caller leads a process group of its own, as a command in a terminal does; Ctrl-C signals that whole group,
  // so only a worker spawned detached (in a session of its own) outlives it.
  const caller = spawn(process.execPath, [script], { cwd: ROOT, env: j.env, stdio: 'ignore', detached: true });
  const started = path.join(j.backups, `started-${runId}`);
  for (let i = 0; i < 100 && !fs.existsSync(started); i++) await sleep(50);
  assert(fs.existsSync(started), 'the worker started');
  const exited = new Promise((resolve) => caller.on('exit', resolve));
  process.kill(-caller.pid, 'SIGINT');
  await exited;
  const file = path.join(j.backups, '.runs', `${runId}.json`);
  let rec = null;
  for (let i = 0; i < 120; i++) {
    try { rec = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { rec = null; }
    if (rec && rec.outcome) break;
    await sleep(50);
  }
  assert(rec && rec.outcome === 'done' && rec.result.echoed === 7, `the job finished after its caller was killed; got ${show(rec)}`);
  assert(Number(fs.readFileSync(started, 'utf8')) !== caller.pid, 'the worker was not the caller');
});

test('J3: a job that dies without a result is reported failed, and the lock it held is removed', () => {
  need(JOBS, 'ADR graph-operations-foundation/0002 Decision 8');
  const j = jobDir('j3');
  const runId = F.newId();
  F.writeLock(j.backups, { runId, op: 'backup', pid: process.pid });
  const script = path.join(j.dir, 'caller.js');
  fs.writeFileSync(script, callerScript(runId, { value: 1, mode: 'vanish' }, j.worker));
  const r = spawnSync(process.execPath, [script], { cwd: ROOT, env: j.env, encoding: 'utf8', timeout: 30000 });
  const rec = resultOf(r.stdout);
  assert(rec && rec.outcome === 'failed' && /result/i.test(String(rec.error)), `a job with no result is { outcome: 'failed', error } saying so; got ${show(rec)} ${String(r.stderr).slice(-300)}`);
  assert(!fs.existsSync(path.join(j.backups, '.lock')), 'the dead job\'s lock is removed');
});

// ── After the job: the restart, once the answer is out or the caller is gone (ADR 0002 Amendment 1) ──────────────

const STORE = path.join(ROOT, 'src/operations/catalog/lifecycle/_store.js');
/** Run `fn` with TAPESTRY_BACKUPS_DIR set to `dir`, then put it back. */
async function inBackups(dir, fn) {
  const before = process.env.TAPESTRY_BACKUPS_DIR;
  process.env.TAPESTRY_BACKUPS_DIR = dir;
  try { return await fn(); } finally {
    if (before === undefined) delete process.env.TAPESTRY_BACKUPS_DIR; else process.env.TAPESTRY_BACKUPS_DIR = before;
  }
}
/** A system that only records restarts, and really sleeps. */
function restartRecorder() {
  return { calls: [], async supervisor(action, programs) { this.calls.push({ action, programs: [].concat(programs), at: Date.now() }); }, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };
}
function afterJobOf() {
  need(JOBS, 'ADR graph-operations-foundation/0002 Decision 8');
  const jobs = require(JOBS);
  assert(typeof jobs.afterJob === 'function' && typeof jobs.markAnswered === 'function', '_jobs.js exports afterJob(record, system, opts) and markAnswered(runId) (ADR 0002 Amendment 1)');
  return jobs;
}

test('J4: after a restore that changed the assistant, the job restarts the control panel once its caller marks the answer out — not before', async () => {
  const jobs = afterJobOf();
  const j = jobDir('j4a');
  const runId = F.newId();
  await inBackups(j.backups, async () => {
    const request = { op: 'restore', runId, callerPid: process.pid };
    fs.writeFileSync(path.join(j.backups, '.runs', `${runId}.json`), JSON.stringify(request));
    const sys = restartRecorder();
    let markedAt = null;
    setTimeout(() => { markedAt = Date.now(); jobs.markAnswered(runId); }, 300);
    await jobs.afterJob({ ...request, outcome: 'done', result: { restarting: ['brainstorm'] } }, sys, { pollMs: 25, timeoutMs: 5000 });
    const restarts = sys.calls.filter((c) => c.action === 'restart' && c.programs.includes('brainstorm'));
    assert(restarts.length === 1 && markedAt && restarts[0].at >= markedAt, `one restart, after the answer was marked (${markedAt}); got ${show(sys.calls)}`);
    const file = JSON.parse(fs.readFileSync(path.join(j.backups, '.runs', `${runId}.json`), 'utf8'));
    assert(file.answeredAt && file.restartedAt, `the run file records answeredAt and restartedAt; got ${show(file)}`);
  });
});

test('J5: the job restarts the control panel when its caller is gone (a command ended by Ctrl-C), or at its time limit; never after a backup', async () => {
  const jobs = afterJobOf();
  const j = jobDir('j5');
  await inBackups(j.backups, async () => {
    const restore = (runId, callerPid) => {
      const request = { op: 'restore', runId, callerPid };
      fs.writeFileSync(path.join(j.backups, '.runs', `${runId}.json`), JSON.stringify(request));
      return { ...request, outcome: 'done', result: { restarting: ['brainstorm'] } };
    };
    const gone = restartRecorder();
    const t0 = Date.now();
    await jobs.afterJob(restore(F.newId(), F.deadPid()), gone, { pollMs: 25, timeoutMs: 5000 });
    assert(gone.calls.filter((c) => c.action === 'restart').length === 1 && Date.now() - t0 < 2000, `a gone caller: one restart, at once; got ${show(gone.calls)} after ${Date.now() - t0} ms`);
    const silent = restartRecorder();
    const t1 = Date.now();
    await jobs.afterJob(restore(F.newId(), process.pid), silent, { pollMs: 25, timeoutMs: 400 });
    assert(silent.calls.filter((c) => c.action === 'restart').length === 1 && Date.now() - t1 >= 380, `a silent caller: one restart, at the time limit; got ${show(silent.calls)} after ${Date.now() - t1} ms`);
    const none = restartRecorder();
    await jobs.afterJob({ op: 'backup', runId: F.newId(), callerPid: process.pid, outcome: 'done', result: { backup: { id: F.newId() } } }, none, { pollMs: 25, timeoutMs: 400 });
    await jobs.afterJob({ op: 'restore', runId: F.newId(), callerPid: process.pid, outcome: 'done', result: { restarting: [] } }, none, { pollMs: 25, timeoutMs: 400 });
    await jobs.afterJob({ op: 'restore', runId: F.newId(), callerPid: process.pid, outcome: 'failed', error: 'x' }, none, { pollMs: 25, timeoutMs: 400 });
    assert(none.calls.length === 0, `no restart after a backup, a restore that changed nothing, or a failed one; got ${show(none.calls)}`);
  });
});

test('J6: a job that can\'t be started (its run file can\'t be written) is failed, and its lock is removed (review round 1)', async () => {
  need(JOBS, 'ADR graph-operations-foundation/0002 Decision 8');
  const jobs = require(JOBS);
  const j = jobDir('j6');
  fs.rmSync(path.join(j.backups, '.runs'), { recursive: true, force: true });
  fs.writeFileSync(path.join(j.backups, '.runs'), 'a file where the runs folder should be');
  const runId = F.newId();
  F.writeLock(j.backups, { runId, op: 'backup', pid: process.pid });
  await inBackups(j.backups, async () => {
    let rec;
    try { rec = await jobs.runDetached({ op: 'backup', runId }, { workerPath: j.worker }); } catch (e) { rec = { threw: e.message }; }
    assert(rec && rec.outcome === 'failed' && typeof rec.error === 'string', `resolves { outcome: 'failed', error }; got ${show(rec)}`);
  });
  assert(!fs.existsSync(path.join(j.backups, '.lock')), 'the lock is removed, so the next backup isn\'t refused busy');
});

test('J7: recovering a stale lock removes only that lock — one another run took meanwhile stays (review round 1)', async () => {
  need(STORE, 'ADR graph-operations-foundation/0002 Decision 7');
  const store = require(STORE);
  const j = jobDir('j7');
  const stale = F.writeLock(j.backups, { op: 'backup', pid: F.deadPid(), stage: 'offline' });
  const freshRunId = F.newId();
  const sys = {
    calls: [],
    async supervisor(action, programs) {
      this.calls.push(`${action} ${[].concat(programs).join('+')}`);
      // Meanwhile another process finishes its own recovery and takes the lock for a run of its own.
      if (action === 'start') F.writeLock(j.backups, { runId: freshRunId, op: 'restore', pid: process.pid });
    },
    async sleep() {},
  };
  await inBackups(j.backups, () => store.recoverIfStale(sys, async () => {}));
  const lock = JSON.parse(fs.readFileSync(path.join(j.backups, '.lock'), 'utf8'));
  assert(lock.runId === freshRunId, `the fresh lock stays; got ${show(lock)}`);
  const run = JSON.parse(fs.readFileSync(path.join(j.backups, '.runs', `${stale.runId}.json`), 'utf8'));
  assert(run.outcome === 'interrupted', `the stale run is still recorded as interrupted; got ${show(run)}`);
});

test('J8: a restore that failed after its key went in still restarts the control panel once the answer is out — its record carries restarting (ADR 0002 Amendment 1, A4)', async () => {
  const jobs = afterJobOf();
  const j = jobDir('j8');
  const runId = F.newId();
  await inBackups(j.backups, async () => {
    const request = { op: 'restore', runId, callerPid: process.pid };
    fs.writeFileSync(path.join(j.backups, '.runs', `${runId}.json`), JSON.stringify(request));
    const sys = restartRecorder();
    let markedAt = null;
    setTimeout(() => { markedAt = Date.now(); jobs.markAnswered(runId); }, 200);
    await jobs.afterJob({ ...request, outcome: 'failed', error: 'restoring the admins failed', restarting: ['brainstorm'] }, sys, { pollMs: 25, timeoutMs: 5000 });
    const restarts = sys.calls.filter((c) => c.action === 'restart' && c.programs.includes('brainstorm'));
    assert(restarts.length === 1 && markedAt && restarts[0].at >= markedAt, `one restart, after the answer was marked (${markedAt}); got ${show(sys.calls)}`);
    const file = JSON.parse(fs.readFileSync(path.join(j.backups, '.runs', `${runId}.json`), 'utf8'));
    assert(file.answeredAt && file.restartedAt, `the run file records answeredAt and restartedAt; got ${show(file)}`);
  });
});

test('J9: a lock appears whole — acquireLock writes it to a file of its own and links that into place, so a reader never finds it empty and judges it stale; a held lock still refuses the next (ADR 0002 Amendment 1, A4)', async () => {
  need(STORE, 'ADR graph-operations-foundation/0002 Decision 7');
  const store = require(STORE);
  const j = jobDir('j9');
  await inBackups(j.backups, async () => {
    const lockFile = path.join(j.backups, '.lock');
    const seen = [];
    const real = { writeFileSync: fs.writeFileSync, openSync: fs.openSync, linkSync: fs.linkSync, readFileSync: fs.readFileSync };
    const atLock = (p) => typeof p === 'string' && path.resolve(p) === lockFile;
    const writing = (flags) => /[wa+]/.test(String(flags === undefined ? 'r' : flags));
    fs.writeFileSync = function (p, ...rest) { if (atLock(p)) seen.push('written in place'); return real.writeFileSync.call(fs, p, ...rest); };
    fs.openSync = function (p, flags, ...rest) { if (atLock(p) && writing(flags)) seen.push('opened in place to write'); return real.openSync.call(fs, p, flags, ...rest); };
    fs.linkSync = function (src, dest) {
      const out = real.linkSync.call(fs, src, dest);
      if (atLock(dest)) {
        let whole = false;
        try { whole = store.isId(JSON.parse(real.readFileSync.call(fs, lockFile, 'utf8')).runId); } catch { whole = false; }
        seen.push(whole ? 'linked whole' : 'linked empty');
      }
      return out;
    };
    let first;
    let second;
    try {
      first = store.acquireLock({ op: 'backup' });
      second = store.acquireLock({ op: 'restore' });
    } finally { Object.assign(fs, real); }
    assert(first && store.isId(first.runId) && second === null, `the first takes the lock, and the second is refused while it is held; got ${show({ first, second })}`);
    assert(seen.length >= 1 && seen.every((s) => s === 'linked whole'), `the lock file only ever appears whole, by a link; got ${show(seen)}`);
    const left = fs.readdirSync(j.backups).filter((n) => n !== '.lock' && n !== '.runs');
    assert(left.length === 0, `no temporary file is left beside the lock; got ${show(left)}`);
    const l = store.inspectLock();
    assert(l && l.runId === first.runId && l.stale === false, `the lock is the first run's, and live; got ${show(l)}`);
  });
});

const WORKER = path.join(ROOT, 'src/operations/catalog/lifecycle/_worker.js');
test('J10: the worker runs nothing when the lock is no longer its run\'s — it records the run failed, saying so, and the other run\'s lock stays (ADR 0002 Amendment 1, A4)', () => {
  need(WORKER, 'ADR graph-operations-foundation/0002 Decision 8');
  const j = jobDir('j10');
  const runId = F.newId();
  const theirs = F.writeLock(j.backups, { op: 'restore', pid: process.pid, stage: 'online' });
  fs.writeFileSync(path.join(j.backups, '.runs', `${runId}.json`), JSON.stringify({ op: 'backup', runId, callerPid: process.pid }));
  const bin = stubBin(j.dir);
  const log = path.join(j.dir, 'stub.log');
  const keys = path.join(j.dir, 'secure-keys'); // empty: a job that ran anyway would fail on the key, not on the lock
  fs.mkdirSync(keys);
  // Dead endpoints, in a conf of its own: the config reader takes NEO4J_URI from the conf file only, never from the
  // environment, and without a file it falls back to bolt://localhost:7687 — wherever a worker that ran anyway would go.
  const conf = path.join(j.dir, 'brainstorm.conf');
  fs.writeFileSync(conf, ['export NEO4J_URI="bolt://127.0.0.1:9"', 'export NEO4J_USER="neo4j"', 'export NEO4J_PASSWORD="none"',
    'export REDIS_HOST="127.0.0.1"', 'export REDIS_PORT="9"', ''].join(NL));
  const env = {
    ...j.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, STUB_LOG: log, STUB_DIR: j.dir,
    TAPESTRY_SECURE_KEYS_DIR: keys, BRAINSTORM_CONF_PATH: conf,
  };
  const r = spawnSync(process.execPath, [WORKER, runId], { cwd: ROOT, env, encoding: 'utf8', timeout: 30000 });
  const rec = JSON.parse(fs.readFileSync(path.join(j.backups, '.runs', `${runId}.json`), 'utf8'));
  assert(rec.outcome === 'failed' && /lock/i.test(String(rec.error)) && !rec.result,
    `the run is failed, saying its lock isn't its own; got ${show(rec)} (stdout ${show(String(r.stdout).slice(-300))}, stderr ${show(String(r.stderr).slice(-300))})`);
  const lock = JSON.parse(fs.readFileSync(path.join(j.backups, '.lock'), 'utf8'));
  assert(lock.runId === theirs.runId && (lock.holders || []).length === 1, `the other run's lock is untouched; got ${show(lock)}`);
  const calls = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split(NL).filter(Boolean) : [];
  assert(calls.length === 0, `nothing was stopped, paused, dumped or asked about; the stand-ins saw ${show(calls)}`);
});

// ── The real system, with stand-in commands on PATH ──────────────────────────────────────────────────────────────

function stubBin(dir) {
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin, { recursive: true });
  const admin = [
    'case " $* " in',
    '  *" --version "*) echo "5.26.10" ;;',
    '  *" info "*) printf \'{"databaseName":"neo4j","inUse":"false","storeFormat":"record-aligned-1.1","lastCommittedTransaction":"18","recoveryRequired":"false"}\' ;;',
    '  *" dump "*) printf "DUMP-BYTES-FROM-STUB"; echo "Files: 1/1, data: 100.0%" >&2 ;;',
    '  *" load "*) cat > "$STUB_DIR/loaded" ;;',
    'esac',
  ].join(NL);
  const scripts = {
    runuser: `#!/bin/bash${NL}printf '%s\\n' "runuser $*" >> "$STUB_LOG"${NL}shift 3${NL}${admin}${NL}exit 0${NL}`,
    'neo4j-admin': `#!/bin/bash${NL}printf '%s\\n' "neo4j-admin $*" >> "$STUB_LOG"${NL}${admin}${NL}exit 0${NL}`,
    supervisorctl: [
      '#!/bin/bash',
      `printf '%s\\n' "supervisorctl $*" >> "$STUB_LOG"`,
      'if [ "$1" = "status" ]; then',
      '  echo "neo4j                            RUNNING   pid 12, uptime 0:10:00"',
      '  echo "stream-consumer                  STOPPED   Nov 08 09:00 PM"',
      '  exit 3',
      'fi',
      'exit 0',
    ].join(NL) + NL,
  };
  for (const [name, text] of Object.entries(scripts)) {
    fs.writeFileSync(path.join(bin, name), text);
    fs.chmodSync(path.join(bin, name), 0o755);
  }
  return bin;
}
let SYS = null;
function systemRun() {
  if (SYS) return SYS;
  need(SYSTEM, 'ADR graph-operations-foundation/0002 Decision 8');
  const dir = fs.mkdtempSync(path.join(S.base(), 'system-'));
  const bin = stubBin(dir);
  const log = path.join(dir, 'stub.log');
  const script = path.join(dir, 'drive.js');
  fs.writeFileSync(script, [
    `'use strict';`,
    `for (const k of ['log', 'info', 'debug', 'warn']) console[k] = () => {};`,
    `const { PassThrough, Readable } = require('stream');`,
    `const sys = require(${show(SYSTEM)});`,
    `(async () => {`,
    `  const out = {};`,
    `  try {`,
    `    out.info = await sys.neo4jAdmin(['database', 'info', '--format=json', 'neo4j']);`,
    `    const pt = new PassThrough(); const chunks = []; pt.on('data', (c) => chunks.push(Buffer.from(c)));`,
    `    out.dump = await sys.neo4jAdmin(['database', 'dump', 'neo4j', '--to-stdout'], { stdout: pt });`,
    `    await new Promise((r) => setImmediate(r)); out.dumpBytes = Buffer.concat(chunks).toString('utf8');`,
    `    out.load = await sys.neo4jAdmin(['database', 'load', 'neo4j', '--from-stdin', '--overwrite-destination=true'], { stdin: Readable.from([Buffer.from('DUMPBYTES')]) });`,
    `    await sys.supervisor('stop', ['neo4j']);`,
    `    await sys.supervisor('start', ['stream-consumer', 'tagging-edges-realtime']);`,
    `    out.status = await sys.programStatus(['neo4j', 'stream-consumer']);`,
    `    out.version = await sys.version();`,
    `    out.free = await sys.freeBytes(${show(dir)});`,
    `  } catch (e) { out.error = e.message; }`,
    `  process.stdout.write('RESULT:' + JSON.stringify(out) + '\\n');`,
    `})();`,
  ].join(NL));
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, STUB_LOG: log, STUB_DIR: dir, HOME: dir };
  const r = spawnSync(process.execPath, [script], { cwd: ROOT, env, encoding: 'utf8', timeout: 30000 });
  const out = resultOf(r.stdout);
  assert(out && !out.error, `driving _system.js failed: ${show(out)} ${String(r.stderr).slice(-400)}`);
  SYS = { out, log: fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split(NL) : [], dir };
  return SYS;
}

test('Y1: _system.js runs neo4j-admin as user neo4j through runuser, and supervisorctl, with the arguments ADR 0002 names', () => {
  const { out, log, dir } = systemRun();
  const want = [
    'runuser -u neo4j -- neo4j-admin database info --format=json neo4j',
    'runuser -u neo4j -- neo4j-admin database dump neo4j --to-stdout',
    'runuser -u neo4j -- neo4j-admin database load neo4j --from-stdin --overwrite-destination=true',
    'supervisorctl stop neo4j',
    'supervisorctl start stream-consumer tagging-edges-realtime',
  ];
  for (const w of want) assert(log.includes(w), `expected the call \`${w}\`; the stand-ins saw ${show(log)}`);
  assert(out.info.code === 0 && JSON.parse(out.info.stdout).lastCommittedTransaction === '18', `info's stdout is captured; got ${show(out.info)}`);
  assert(out.dump.code === 0 && out.dumpBytes === 'DUMP-BYTES-FROM-STUB', `the dump's stdout goes to the given stream, and only the dump; got ${show(out.dumpBytes)}`);
  assert(out.load.code === 0 && fs.readFileSync(path.join(dir, 'loaded'), 'utf8') === 'DUMPBYTES', 'the load reads the given stream on its stdin');
  assert(out.version === '5.26.10' && Number.isFinite(out.free) && out.free > 0, `version() and freeBytes(); got ${show({ version: out.version, free: out.free })}`);
});

test('Y2: programStatus reads `supervisorctl status`, which exits 3 when some program isn\'t running', () => {
  const { out, log } = systemRun();
  assert(log.some((l) => /^supervisorctl status( |$)/.test(l)), `programStatus asks supervisorctl status; got ${show(log)}`);
  assert(out.status && out.status.neo4j === 'RUNNING' && out.status['stream-consumer'] === 'STOPPED', `{ neo4j: 'RUNNING', 'stream-consumer': 'STOPPED' }; got ${show(out.status)}`);
});

// ── The Docker configuration and the docs ────────────────────────────────────────────────────────────────────────

/** The inside of the docker/nginx.conf `location … { … }` block that `re` finds, or null. */
function nginxLocation(re) {
  const conf = fs.readFileSync(path.join(ROOT, 'docker/nginx.conf'), 'utf8');
  const at = conf.search(re);
  if (at < 0) return null;
  let depth = 0;
  let i = conf.indexOf('{', at);
  const start = i;
  for (; i < conf.length; i++) {
    if (conf[i] === '{') depth++;
    if (conf[i] === '}') { depth--; if (depth === 0) break; }
  }
  return conf.slice(start + 1, i);
}
function nginxBlock() {
  const b = nginxLocation(/location\s+\/api\/tapestry\/lifecycle\/\s*\{/);
  assert(b !== null, 'docker/nginx.conf has a `location /api/tapestry/lifecycle/ { … }` block');
  return b;
}
const bytes = (v) => { const m = String(v).match(/^(\d+)([kmg]?)$/i); if (!m) return NaN; return Number(m[1]) * ({ '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 })[m[2].toLowerCase()]; };
const secs = (v) => { const m = String(v).match(/^(\d+)(s|m)?$/); if (!m) return NaN; return Number(m[1]) * (m[2] === 'm' ? 60 : 1); };

test('K1: nginx sends /api/tapestry/lifecycle/ on with X-Forwarded-For (or it would be trusted as local), no buffering and 900 s — and only the upload takes a backup-sized body (ADR 0002 Amendment 1, A4)', () => {
  const common = (b, where) => {
    const has = (re, what) => assert(re.test(b), `${where} must have ${what}; it is: ${show(b)}`);
    has(/proxy_set_header\s+X-Forwarded-For\s+\$proxy_add_x_forwarded_for\s*;/, 'proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for');
    has(/proxy_set_header\s+Host\s+\$host\s*;/, 'proxy_set_header Host $host');
    has(/proxy_pass\s+http:\/\/127\.0\.0\.1:7778\s*;/, 'proxy_pass http://127.0.0.1:7778 (no URI, so the path passes as it is)');
    has(/proxy_http_version\s+1\.1\s*;/, 'proxy_http_version 1.1');
    has(/proxy_buffering\s+off\s*;/, 'proxy_buffering off');
    for (const k of ['proxy_read_timeout', 'proxy_send_timeout']) {
      const v = (b.match(new RegExp(`${k}\\s+(\\S+?)\\s*;`)) || [])[1];
      assert(secs(v) >= 900, `${where}: ${k} of at least 900s; got ${show(v)}`);
    }
  };
  const prefix = nginxBlock();
  common(prefix, 'the lifecycle block');
  const prefixMax = (prefix.match(/client_max_body_size\s+(\S+?)\s*;/) || [])[1];
  assert(prefixMax === undefined || (prefixMax !== '0' && bytes(prefixMax) <= 100 * 1024 ** 2),
    `the lifecycle block keeps the server's body limit (100m at most), so a visitor can't send 9 GB to every lifecycle route; got ${show(prefixMax)}`);
  const upload = nginxLocation(/location\s+=\s*\/api\/tapestry\/lifecycle\/upload-backup\s*\{/);
  assert(upload !== null, 'docker/nginx.conf has a `location = /api/tapestry/lifecycle/upload-backup { … }` block');
  common(upload, 'the upload block');
  assert(/proxy_request_buffering\s+off\s*;/.test(upload), `the upload block streams the body to the app (proxy_request_buffering off); it is: ${show(upload)}`);
  const max = (upload.match(/client_max_body_size\s+(\S+?)\s*;/) || [])[1];
  assert(max !== '0' && bytes(max) >= 9 * 1024 ** 3, `the upload block takes a body of at least 9g, and not an unlimited one; got ${show(max)}`);
});

test('K2: supervisord gives neo4j 120 s to stop, and stops its whole process group', () => {
  const conf = fs.readFileSync(path.join(ROOT, 'docker/supervisord.conf'), 'utf8');
  const sec = (conf.match(/\[program:neo4j\]([\s\S]*?)(?=\n\[|$)/) || [])[1] || '';
  const val = (k) => (sec.match(new RegExp(`^\\s*${k}\\s*=\\s*(\\S+)`, 'm')) || [])[1];
  assert(Number(val('stopwaitsecs')) >= 120, `[program:neo4j] stopwaitsecs of at least 120; got ${show(val('stopwaitsecs'))}`);
  assert(val('stopasgroup') === 'true' && val('killasgroup') === 'true', `stopasgroup=true and killasgroup=true; got ${show({ stopasgroup: val('stopasgroup'), killasgroup: val('killasgroup') })}`);
  assert(/command=\/usr\/share\/neo4j\/bin\/neo4j console/.test(sec) && /user=neo4j/.test(sec), 'the neo4j program is otherwise as it was');
});

test('K3: OPERATIONS.md says how backups work and what the droplets\' host nginx needs; ADR security-auth-exposure/0005 points to ADR 0002', () => {
  const ops = fs.readFileSync(path.join(ROOT, 'OPERATIONS.md'), 'utf8');
  assert(/^#+ .*Backups/m.test(ops), 'OPERATIONS.md has a Backups section');
  for (const w of ['/api/tapestry/lifecycle/', 'client_max_body_size', 'proxy_read_timeout', 'download-backup', 'upload-backup']) {
    assert(ops.includes(w), `OPERATIONS.md's backups section mentions ${w}`);
  }
  const adr = fs.readFileSync(path.join(ROOT, 'engineering-team/decisions/security-auth-exposure/0005-one-route-table-default-deny.md'), 'utf8');
  assert(/graph-operations-foundation\/0002/.test(adr.split(NL).slice(0, 12).join(NL)), 'ADR 0005\'s header names graph-operations-foundation/0002, which amends it for the five operations');
});

module.exports = { run: () => S.run() };
if (require.main === module) S.run().then(({ fail }) => process.exit(fail ? 1 : 0));
