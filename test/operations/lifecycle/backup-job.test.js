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
 *   Y1  _system.js runs neo4j-admin as user neo4j through runuser, and supervisorctl, with the arguments the ADR names
 *   Y2  programStatus reads supervisorctl status, which exits 3 when some program isn't running
 *   K1  nginx: /api/tapestry/lifecycle/ keeps X-Forwarded-For, takes large bodies, streams, and waits 900 s
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

function nginxBlock() {
  const conf = fs.readFileSync(path.join(ROOT, 'docker/nginx.conf'), 'utf8');
  const at = conf.search(/location\s+\/api\/tapestry\/lifecycle\/\s*\{/);
  assert(at >= 0, 'docker/nginx.conf has a `location /api/tapestry/lifecycle/ { … }` block');
  let depth = 0;
  let i = conf.indexOf('{', at);
  const start = i;
  for (; i < conf.length; i++) {
    if (conf[i] === '{') depth++;
    if (conf[i] === '}') { depth--; if (depth === 0) break; }
  }
  return conf.slice(start + 1, i);
}
const bytes = (v) => { const m = String(v).match(/^(\d+)([kmg]?)$/i); if (!m) return NaN; return Number(m[1]) * ({ '': 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 })[m[2].toLowerCase()]; };
const secs = (v) => { const m = String(v).match(/^(\d+)(s|m)?$/); if (!m) return NaN; return Number(m[1]) * (m[2] === 'm' ? 60 : 1); };

test('K1: nginx sends /api/tapestry/lifecycle/ on with X-Forwarded-For (or it would be trusted as local), large bodies, no buffering, and 900 s', () => {
  const b = nginxBlock();
  const has = (re, what) => assert(re.test(b), `the lifecycle block must have ${what}; it is: ${show(b)}`);
  has(/proxy_set_header\s+X-Forwarded-For\s+\$proxy_add_x_forwarded_for\s*;/, 'proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for');
  has(/proxy_set_header\s+Host\s+\$host\s*;/, 'proxy_set_header Host $host');
  has(/proxy_pass\s+http:\/\/127\.0\.0\.1:7778\s*;/, 'proxy_pass http://127.0.0.1:7778 (no URI, so the path passes as it is)');
  has(/proxy_http_version\s+1\.1\s*;/, 'proxy_http_version 1.1');
  has(/proxy_request_buffering\s+off\s*;/, 'proxy_request_buffering off');
  has(/proxy_buffering\s+off\s*;/, 'proxy_buffering off');
  const max = (b.match(/client_max_body_size\s+(\S+?)\s*;/) || [])[1];
  assert(max === '0' || bytes(max) >= 9 * 1024 ** 3, `client_max_body_size of at least 9g; got ${show(max)}`);
  for (const k of ['proxy_read_timeout', 'proxy_send_timeout']) {
    const v = (b.match(new RegExp(`${k}\\s+(\\S+?)\\s*;`)) || [])[1];
    assert(secs(v) >= 900, `${k} of at least 900s; got ${show(v)}`);
  }
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
