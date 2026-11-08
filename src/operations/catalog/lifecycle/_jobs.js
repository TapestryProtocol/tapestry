'use strict';
/**
 * The backup and restore jobs — ADR graph-operations-foundation/0002 Decisions 4, 5, 6 and 8. A helper of the
 * lifecycle operations.
 *
 *   runBackupJob(request, system)   Decision 4's steps; resolves the backup's answer, or throws
 *   runRestoreJob(request, system)  Decision 5's steps, in one offline window; resolves the report, or throws
 *   runDetached(request, opts)      runs one of them in a process of its own (_worker.js), so the graph database
 *                                   comes back whatever happens to the caller; resolves the run's record,
 *                                   { outcome: 'done', result } or { outcome: 'failed', error }
 *
 * A request is { op: 'backup' | 'restore', runId, … }. The jobs remove their run's lock when they finish, and always
 * start the graph database and the paused writers again if they stopped them.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const store = require('./_store');
const identity = require('./_identity');

const GRAPH_WAIT_MS = 300000;
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const tail = (s) => String(s || '').trim().split('\n').slice(-3).join(' ').slice(0, 400);

/** Wait until the graph database answers, polling every second. */
async function waitForGraph(system, { timeoutMs = GRAPH_WAIT_MS } = {}) {
  const start = Date.now();
  for (;;) {
    try { await system.cypher('RETURN 1 AS ok'); return; } catch (err) {
      if (Date.now() - start > timeoutMs) throw new Error(`the graph database didn't answer within ${Math.round(timeoutMs / 1000)} s of starting (${err.message})`);
      await system.sleep(1000);
    }
  }
}
/** Does the graph answer within `ms`? */
async function graphAnswers(system, ms = 5000) {
  let timer;
  try {
    await Promise.race([system.cypher('RETURN 1 AS ok'), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timed out')), ms); })]);
    return true;
  } catch { return false; } finally { clearTimeout(timer); }
}

/** Decision 4 step 2's counts, each its own query. */
async function countGraph(system) {
  const one = async (q, key) => Number(((await system.cypher(q))[0] || {})[key]);
  const nodes = await one('MATCH (n) RETURN count(n) AS nodes', 'nodes');
  const relationships = await one('MATCH ()-[r]->() RETURN count(r) AS relationships', 'relationships');
  const keys = (await system.cypher('MATCH (n) WHERE n.tapestryKey IS NOT NULL RETURN n.tapestryKey AS k')).map((row) => String(row.k));
  const offloadedJsonTags = await one("MATCH (t:NostrEventTag) WHERE t.value STARTS WITH 'lmdb:' RETURN count(t) AS offloaded", 'offloaded');
  keys.sort();
  return {
    nodes, relationships, tapestryKeys: keys.length, distinctTapestryKeys: new Set(keys).size,
    tapestryKeyDigest: `sha256:${sha256(keys.join('\n'))}`, offloadedJsonTags,
  };
}
const COUNT_FIELDS = ['nodes', 'relationships', 'tapestryKeys', 'distinctTapestryKeys', 'tapestryKeyDigest'];
const sameCounts = (a, b) => COUNT_FIELDS.every((k) => a[k] === b[k]);
const pick = (c) => Object.fromEntries(COUNT_FIELDS.map((k) => [k, c[k]]));

/** The store's facts, read while the server is stopped; refuses a store in use or needing recovery. */
async function storeInfo(system) {
  const r = await system.neo4jAdmin(['database', 'info', '--format=json', 'neo4j']);
  if (r.code !== 0) throw new Error(`neo4j-admin database info failed: ${tail(r.stderr || r.stdout)}`);
  let info;
  try { info = JSON.parse(String(r.stdout).trim().split('\n').filter(Boolean).pop()); } catch { throw new Error('neo4j-admin database info printed no JSON'); }
  if (String(info.inUse) === 'true') throw new Error('the database was still in use after the server stopped');
  if (String(info.recoveryRequired) === 'true') throw new Error('the database needs recovery: the server did not shut down cleanly, so it was not dumped');
  return { lastCommittedTransaction: String(info.lastCommittedTransaction), storeFormat: String(info.storeFormat || '') };
}

/** Dump the stopped database into `file`, hashing it as it goes. */
async function dumpTo(system, file) {
  const out = fs.createWriteStream(file, { mode: 0o600 });
  const hash = crypto.createHash('sha256');
  let size = 0;
  const { PassThrough } = require('stream');
  const tee = new PassThrough();
  tee.on('data', (c) => { hash.update(c); size += c.length; });
  tee.pipe(out);
  const written = new Promise((resolve, reject) => { out.on('finish', resolve); out.on('error', reject); });
  let r;
  try {
    r = await system.neo4jAdmin(['database', 'dump', 'neo4j', '--to-stdout'], { stdout: tee });
  } finally {
    tee.end();
    await written;
  }
  console.log(`[lifecycle] neo4j-admin database dump: exit ${r.code}; ${lastLine(r.stderr)}`);
  if (r.code !== 0) throw new Error(`neo4j-admin database dump failed: ${tail(r.stderr)}`);
  return { size, sha256: hash.digest('hex') };
}
/** Load `file` into the stopped database, replacing it. */
async function loadFrom(system, file) {
  const r = await system.neo4jAdmin(['database', 'load', 'neo4j', '--from-stdin', '--overwrite-destination=true'], { stdin: fs.createReadStream(file) });
  console.log(`[lifecycle] neo4j-admin database load: exit ${r.code}; ${lastLine(r.stderr || r.stdout)}`);
  return r;
}

/**
 * Stop the writers that are running. `onPaused(running)` hears which, before the stop is asked for, so a stop that
 * fails halfway is still undone by the job's `finally` (ADR 0002 Amendment 1); the lock records them for a recovery.
 */
async function pauseWriters(system, runId, onPaused) {
  const status = await system.programStatus(store.WRITERS);
  const running = store.WRITERS.filter((w) => status[w] === 'RUNNING');
  if (running.length) {
    store.updateLock(runId, { paused: running });
    onPaused(running);
    await system.supervisor('stop', running);
  }
  return running;
}
const lastLine = (s) => String(s || '').trim().split('\n').filter(Boolean).pop() || '';

function writeIdentityFiles(folder, ident, admins) {
  fs.mkdirSync(path.join(folder, 'identity'), { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(folder, 'identity', 'tapestry-assistant.json'), ident.keyFile, { mode: 0o600 });
  fs.writeFileSync(path.join(folder, 'identity', 'master-key'), ident.masterKeyFile, { mode: 0o600 });
  fs.writeFileSync(path.join(folder, 'admins.json'), JSON.stringify(admins), { mode: 0o600 });
}
async function payloadFiles(folder, dump) {
  const files = { 'neo4j.dump': dump };
  for (const m of ['admins.json', 'identity/tapestry-assistant.json', 'identity/master-key']) files[m] = await store.hashFile(path.join(folder, m));
  return files;
}
function writeManifest(folder, manifest) {
  const problem = store.manifestProblem(manifest, manifest.id);
  if (problem) throw new Error(`the backup's own manifest is invalid (${problem})`);
  store.writeJson(path.join(folder, 'manifest.json'), manifest);
}

const OFFLOADED_WARNING = (n) => `${n} json tag${n === 1 ? ' is' : 's are'} offloaded to the cache store (the LMDB), which a backup doesn't carry: their content is not in this backup.`;

async function runBackupJob(request, system) {
  const { runId } = request;
  let paused = [];
  let stopped = false;
  let folder = null;
  let kept = false;
  try {
    paused = await pauseWriters(system, runId, (running) => { paused = running; });
    const before = await countGraph(system);
    const neo4jVersion = await system.version();
    const id = store.newId();
    store.ensureDir();
    folder = store.folderOf(id);
    fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
    store.updateLock(runId, { backup: id });
    const ident = await identity.readIdentity();
    const admins = identity.readAdmins();
    writeIdentityFiles(folder, ident, admins);

    const offlineFrom = Date.now();
    stopped = true; // before the call: a stop that fails halfway is still undone
    await system.supervisor('stop', ['neo4j']);
    store.updateLock(runId, { stage: 'offline' });
    const info = await storeInfo(system);
    const dump = await dumpTo(system, path.join(folder, 'neo4j.dump'));
    await system.supervisor('start', ['neo4j']);
    await waitForGraph(system);
    stopped = false;
    store.updateLock(runId, { stage: 'online' });
    const offlineMs = Date.now() - offlineFrom;

    const after = await countGraph(system);
    if (paused.length) await system.supervisor('start', paused);
    paused = [];

    const countsExact = sameCounts(before, after);
    const warnings = [];
    if (!countsExact) warnings.push('The graph changed while the backup was being taken, so the counts it records are those from just before; a restore can\'t confirm them exactly.');
    if (before.offloadedJsonTags > 0) warnings.push(OFFLOADED_WARNING(before.offloadedJsonTags));
    const manifest = {
      format: 'tapestry-backup', version: 1, id, takenAt: new Date(offlineFrom).toISOString(),
      note: request.note || null, reason: 'requested', restoring: null,
      instance: { assistantPubkey: ident.assistantPubkey, ownerPubkey: identity.ownerPubkey() },
      admins,
      graph: { neo4jVersion, storeFormat: info.storeFormat, lastCommittedTransaction: info.lastCommittedTransaction, ...pick(before), countsExact, offloadedJsonTags: before.offloadedJsonTags },
      offlineMs,
      files: await payloadFiles(folder, dump),
    };
    writeManifest(folder, manifest);
    kept = true;
    const summary = store.summaryOf(id, manifest);
    return {
      backup: { id, takenAt: summary.takenAt, note: summary.note, size: summary.size, origin: 'taken', reason: 'requested' },
      holds: summary.holds, graph: summary.graph, offlineMs, warnings,
    };
  } finally {
    if (stopped) {
      try { await system.supervisor('start', ['neo4j']); await waitForGraph(system); } catch (err) { console.error(`[lifecycle backup] starting the graph database again failed: ${err.message}`); }
    }
    if (paused.length) {
      try { await system.supervisor('start', paused); } catch (err) { console.error(`[lifecycle backup] starting ${paused.join(', ')} again failed: ${err.message}`); }
    }
    if (!kept && folder) fs.rmSync(folder, { recursive: true, force: true });
    store.releaseLock(runId);
  }
}

async function runRestoreJob(request, system) {
  const { runId, backup: id } = request;
  const source = store.readManifest(id);
  if (!source) throw new Error(`backup ${id} is gone`);
  const sourceFolder = store.folderOf(id);
  let paused = [];
  let stopped = false;
  let safetyFolder = null;
  let safetyKept = false;
  try {
    paused = await pauseWriters(system, runId, (running) => { paused = running; });
    const before = await countGraph(system);
    const neo4jVersion = await system.version();
    const safetyId = store.newId();
    safetyFolder = store.folderOf(safetyId);
    fs.mkdirSync(safetyFolder, { recursive: true, mode: 0o700 });
    store.updateLock(runId, { safety: safetyId });
    const ident = await identity.readIdentity();
    const adminsBefore = identity.readAdmins();
    writeIdentityFiles(safetyFolder, ident, adminsBefore);

    const offlineFrom = Date.now();
    stopped = true; // before the call: a stop that fails halfway is still undone
    await system.supervisor('stop', ['neo4j']);
    store.updateLock(runId, { stage: 'offline' });
    const info = await storeInfo(system);
    const safetyDump = await dumpTo(system, path.join(safetyFolder, 'neo4j.dump'));
    writeManifest(safetyFolder, {
      format: 'tapestry-backup', version: 1, id: safetyId, takenAt: new Date(offlineFrom).toISOString(),
      note: `Safety backup taken before restoring ${id}`, reason: 'before-restore', restoring: id,
      instance: { assistantPubkey: ident.assistantPubkey, ownerPubkey: identity.ownerPubkey() },
      admins: adminsBefore,
      graph: { neo4jVersion, storeFormat: info.storeFormat, lastCommittedTransaction: info.lastCommittedTransaction, ...pick(before), countsExact: false, offloadedJsonTags: before.offloadedJsonTags },
      offlineMs: Date.now() - offlineFrom,
      files: await payloadFiles(safetyFolder, safetyDump),
    });
    safetyKept = true;

    // The load, then the store's own proof that it is the store that was dumped; a rollback if either fails.
    const recorded = String(source.graph.lastCommittedTransaction);
    let wrong = null;
    let loaded = null;
    const load = await loadFrom(system, path.join(sourceFolder, 'neo4j.dump'));
    if (load.code !== 0) {
      wrong = `loading backup ${id} failed (${tail(load.stderr)})`;
    } else {
      try { loaded = (await storeInfo(system)).lastCommittedTransaction; } catch (err) { wrong = `the loaded store couldn't be read (${err.message})`; }
      if (!wrong && loaded !== recorded) wrong = `the loaded store is at transaction ${loaded}, not ${recorded} as backup ${id} recorded`;
    }
    if (wrong) {
      const back = await loadFrom(system, path.join(safetyFolder, 'neo4j.dump'));
      if (back.code !== 0) {
        // Left stopped for the finally to try starting; the store may not come up, so say how to put it back by hand.
        throw new Error(`${wrong}, and rolling back from the safety backup ${safetyId} failed too (${tail(back.stderr)}). To put the graph back by hand: stop the graph database (supervisorctl stop neo4j), load the safety dump (runuser -u neo4j -- neo4j-admin database load neo4j --from-stdin --overwrite-destination=true < ${path.join(safetyFolder, 'neo4j.dump')}), then start it again (supervisorctl start neo4j).`);
      }
      await system.supervisor('start', ['neo4j']);
      await waitForGraph(system);
      stopped = false;
      throw new Error(`${wrong}. The restore rolled back: the graph is as it was, from the safety backup ${safetyId}.`);
    }
    await system.supervisor('start', ['neo4j']);
    await waitForGraph(system);
    stopped = false;
    store.updateLock(runId, { stage: 'online' });
    const offlineMs = Date.now() - offlineFrom;

    // From here on the backup's graph is in place: a failure says so, and where the graph as it was is kept.
    let step = 'counting what came back';
    let restored;
    let assistant;
    let adminsAfter;
    let resumed;
    try {
      restored = await countGraph(system);
      step = 'putting the assistant\'s key in place';
      assistant = await identity.restoreIdentity(sourceFolder, source.instance.assistantPubkey);
      assistant.before = ident.assistantPubkey;
      assistant.changed = assistant.before !== assistant.after;
      step = 'restoring the admins';
      adminsAfter = identity.restoreAdmins(source.admins.pubkeys);
      step = 'starting the paused writers';
      resumed = [...paused];
      if (paused.length) await system.supervisor('start', paused);
      paused = [];
    } catch (err) {
      // When the backup's key went in first, the running control panel still holds the old one: the job restarts it
      // all the same, once the answer is out (ADR 0002 Amendment 1, A4).
      const keyIn = !!(assistant && assistant.changed);
      const failure = new Error(`Backup ${id}'s graph is in place, but ${step} failed: ${err.message}. The graph as it was is in the safety backup ${safetyId}.${keyIn ? " The backup's assistant key is in place too, so the control panel restarts to take it." : ''}`);
      if (keyIn) failure.restarting = ['brainstorm'];
      throw failure;
    }

    const exact = source.graph.countsExact === true;
    const recordedCounts = pick(source.graph);
    const match = exact ? sameCounts(recordedCounts, restored) : null;
    const instanceOwner = identity.ownerPubkey();
    const warnings = [];
    if (match === false) {
      const differ = COUNT_FIELDS.filter((k) => recordedCounts[k] !== restored[k]).join(', ');
      warnings.push(`What came back doesn't match what backup ${id} recorded (${differ}). To go back, restore the safety backup ${safetyId}.`);
    }
    if (match === null) warnings.push(`Backup ${id}'s counts weren't exact when it was taken, so the restore can't confirm them; it confirmed the store's transaction instead.`);
    if (source.instance.ownerPubkey !== instanceOwner) warnings.push(`Backup ${id} was taken with owner ${source.instance.ownerPubkey}; this instance's owner stays ${instanceOwner}, as its launch settings name it.`);
    if (!source.admins.pubkeys.length) warnings.push('The backup has no admins, so this instance\'s admins are whatever its launch settings name.');
    if (process.env.TA_PUBKEY) warnings.push('TA_PUBKEY is set in this instance\'s environment, and it outranks the restored key until it is removed.');
    if (restored.offloadedJsonTags > 0) warnings.push(OFFLOADED_WARNING(restored.offloadedJsonTags));
    warnings.push('The cache (each node\'s Tapestry JSON in the LMDB) was built from the graph before the restore, so it may be out of step until it is rebuilt.');

    return {
      restored: id,
      safetyBackup: safetyId,
      graph: {
        transaction: { recorded, loaded, same: loaded === recorded },
        counts: { recorded: recordedCounts, restored: pick(restored), exact, match },
      },
      assistant: { before: assistant.before, after: assistant.after, changed: assistant.changed },
      owner: { backup: source.instance.ownerPubkey, instance: instanceOwner, same: source.instance.ownerPubkey === instanceOwner },
      admins: { before: adminsBefore.pubkeys, after: adminsAfter.pubkeys },
      offlineMs,
      // The control panel restarts after the answer; the writer that reads the assistant came back with the key.
      restarting: assistant.changed ? ['brainstorm', ...resumed.filter((w) => w === 'tagging-edges-realtime')] : [],
      warnings,
    };
  } finally {
    if (stopped) {
      try { await system.supervisor('start', ['neo4j']); await waitForGraph(system); } catch (err) { console.error(`[lifecycle restore] starting the graph database again failed: ${err.message}`); }
    }
    if (paused.length) {
      try { await system.supervisor('start', paused); } catch (err) { console.error(`[lifecycle restore] starting ${paused.join(', ')} again failed: ${err.message}`); }
    }
    if (!safetyKept && safetyFolder) fs.rmSync(safetyFolder, { recursive: true, force: true });
    store.releaseLock(runId);
  }
}

/**
 * Run a job and make its record, as the worker writes it: { …request, outcome: 'done', result, finishedAt } or
 * { …request, outcome: 'failed', error, finishedAt }. A failure that still needs a restart — a restore whose key went
 * in before a later step failed — keeps its `restarting` in the record, for afterJob (ADR 0002 Amendment 1, A4).
 */
async function runJob(request, system) {
  const job = request && request.op === 'restore' ? runRestoreJob : runBackupJob;
  try {
    const result = await job(request, system);
    return { ...request, outcome: 'done', result, finishedAt: new Date().toISOString() };
  } catch (err) {
    const record = { ...request, outcome: 'failed', error: (err && err.message) || String(err), finishedAt: new Date().toISOString() };
    if (err && Array.isArray(err.restarting) && err.restarting.length) record.restarting = err.restarting;
    return record;
  }
}

/**
 * Run a job in a process of its own: write the request to .runs/<runId>.json, start `node <workerPath> <runId>` in
 * a session of its own (so Ctrl-C to the caller's terminal or a restart of the control panel doesn't reach it), wait
 * for it, and read back its record.
 */
async function runDetached(request, opts = {}) {
  const workerPath = opts.workerPath || path.join(__dirname, '_worker.js');
  const file = store.runFile(request.runId);
  let log;
  try {
    // The caller's pid, so the job can tell when it is gone (ADR 0002 Amendment 1).
    store.writeJson(file, { ...request, callerPid: process.pid, startedAt: new Date().toISOString() });
    log = fs.openSync(store.runLog(request.runId), 'a', 0o600);
  } catch (err) {
    // The job never started, so nothing else would free its lock (review round 1).
    store.releaseLock(request.runId);
    return { outcome: 'failed', error: `the ${request.op} job couldn't be started: ${err.message}`, finishedAt: new Date().toISOString() };
  }
  let exit = 'still running';
  try {
    const child = spawn(process.execPath, [workerPath, request.runId], { detached: true, stdio: ['ignore', log, log], env: process.env });
    // Resolve on the job's record, not on the worker's exit: after a restore the worker stays on to restart the
    // control panel once this caller has answered (afterJob), so waiting for its exit would wait on ourselves.
    await new Promise((resolve) => {
      let settled = false;
      const finish = () => { if (!settled) { settled = true; clearInterval(timer); resolve(); } };
      const timer = setInterval(() => { const r = store.readJson(file); if (r && r.outcome) finish(); }, 250);
      child.on('error', (err) => { exit = `could not start (${err.message})`; finish(); });
      child.on('exit', (code, signal) => { exit = code === null ? `signal ${signal}` : `exit ${code}`; finish(); });
    });
    child.unref();
  } finally {
    fs.closeSync(log);
  }
  const record = store.readJson(file);
  if (!record || !record.outcome) {
    store.releaseLock(request.runId);
    const error = `the ${request.op} job ended (${exit}) without a result; its log is ${store.runLog(request.runId)}`;
    const finishedAt = new Date().toISOString();
    store.writeJson(file, { ...(record || request), outcome: 'failed', error, finishedAt });
    return { outcome: 'failed', error, finishedAt };
  }
  store.releaseLock(request.runId);
  return record.outcome === 'done'
    ? { outcome: 'done', result: record.result, finishedAt: record.finishedAt }
    : { outcome: record.outcome, error: record.error, finishedAt: record.finishedAt };
}

/** Merge `fields` into a run's file, making it if need be. */
function updateRun(runId, fields) {
  const file = store.runFile(runId);
  store.writeJson(file, { runId, ...(store.readJson(file) || {}), ...fields });
}

/** The caller's word that the answer is out (ADR 0002 Amendment 1): the job may restart the control panel now. */
function markAnswered(runId) {
  if (store.isId(runId)) updateRun(runId, { answeredAt: new Date().toISOString() });
}

/**
 * What the job does once its record is written (ADR 0002 Amendment 1): after a restore that changed the assistant, it
 * restarts the control panel — once the caller has marked the answer out, once the caller is gone, or at the time
 * limit — so the restart never cuts the answer short and never waits on a caller that went away. A failed restore
 * whose key went in asks for it in the record's own `restarting` (A4).
 */
async function afterJob(record, system, { pollMs = 500, timeoutMs = 120000 } = {}) {
  const restarting = !record ? null
    : record.outcome === 'done' ? record.result && record.result.restarting
      : record.outcome === 'failed' ? record.restarting : null;
  const restart = Array.isArray(restarting) && restarting.includes('brainstorm');
  if (!restart) return { restarted: false };
  const started = Date.now();
  let why = 'the time limit';
  for (;;) {
    const run = store.readJson(store.runFile(record.runId)) || {};
    if (run.answeredAt) { why = 'the answer is out'; break; }
    if (!store.pidAlive(record.callerPid)) { why = 'the caller is gone'; break; }
    if (Date.now() - started >= timeoutMs) break;
    await system.sleep(pollMs);
  }
  await system.supervisor('restart', ['brainstorm']);
  updateRun(record.runId, { restartedAt: new Date().toISOString(), restartedBecause: why });
  console.log(`[lifecycle] restarted the control panel, since ${why}`);
  return { restarted: true, why };
}

module.exports = { runBackupJob, runRestoreJob, runJob, runDetached, afterJob, markAnswered, waitForGraph, graphAnswers, countGraph };
