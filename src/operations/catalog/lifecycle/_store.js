'use strict';
/**
 * The store of backups — ADR graph-operations-foundation/0002 Decisions 2, 3, 7 and 11. A helper of the lifecycle
 * operations, not a declaration (its name starts with `_`, so the loader leaves it alone).
 *
 *   <TAPESTRY_BACKUPS_DIR, default /var/lib/brainstorm/backups>/
 *     <id>/            one backup: manifest.json (written last), neo4j.dump, admins.json, identity/…, received.json
 *     .lock            one backup, restore or upload at a time
 *     .runs/<runId>.json, .runs/<runId>.log   each job's request, result and log
 *     .incoming-<x>/   an upload being received
 *
 * Every path is read from the environment when it is used, never at load (Decision 10 of ADR 0001: loading opens
 * nothing).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const Ajv = require('ajv');

const DEFAULT_DIR = '/var/lib/brainstorm/backups';
const ID_PATTERN = '^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$';
const ID_RE = new RegExp(ID_PATTERN);
/** A backup's files, in the order a downloaded archive carries them (Decision 9). */
const MEMBERS = Object.freeze(['manifest.json', 'admins.json', 'identity/tapestry-assistant.json', 'identity/master-key', 'neo4j.dump']);
const PAYLOAD = Object.freeze(MEMBERS.filter((m) => m !== 'manifest.json'));
const WRITERS = Object.freeze(['stream-consumer', 'tagging-edges-realtime']);

function backupsDir() { return process.env.TAPESTRY_BACKUPS_DIR || DEFAULT_DIR; }
/** The backups folder, made if need be, mode 0700. */
function ensureDir() {
  const dir = backupsDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  return dir;
}
function runsDir() { return path.join(backupsDir(), '.runs'); }
function runFile(runId) { return path.join(runsDir(), `${runId}.json`); }
function runLog(runId) { return path.join(runsDir(), `${runId}.log`); }

/** A new id: the UTC time and four random bytes, YYYYMMDDTHHMMSSZ-<8 hex>, so ids sort by time. */
function newId(date = new Date()) {
  const s = date.toISOString();
  return `${s.slice(0, 4)}${s.slice(5, 7)}${s.slice(8, 10)}T${s.slice(11, 13)}${s.slice(14, 16)}${s.slice(17, 19)}Z-${crypto.randomBytes(4).toString('hex')}`;
}
function isId(id) { return typeof id === 'string' && ID_RE.test(id); }
function folderOf(id) {
  if (!isId(id)) throw new Error(`'${id}' is not a backup id`);
  return path.join(backupsDir(), id);
}

/** Write JSON atomically (a temporary file, then a rename), mode 0600. */
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

/** The sha256 and size of a file, read as a stream. */
async function hashFile(file) {
  const hash = crypto.createHash('sha256');
  let size = 0;
  for await (const chunk of fs.createReadStream(file)) { hash.update(chunk); size += chunk.length; }
  return { size, sha256: hash.digest('hex') };
}

// ── The manifest (Decision 3) ────────────────────────────────────────────────────────────────────────────────────

const int = { type: 'integer', minimum: 0 };
const fileEntry = { type: 'object', required: ['size', 'sha256'], properties: { size: int, sha256: { type: 'string', pattern: '^[0-9a-f]{64}$' } } };
const MANIFEST_SCHEMA = Object.freeze({
  type: 'object',
  required: ['format', 'version', 'id', 'takenAt', 'note', 'reason', 'restoring', 'instance', 'admins', 'graph', 'offlineMs', 'files'],
  properties: {
    format: { enum: ['tapestry-backup'] },
    version: { enum: [1] },
    id: { type: 'string', pattern: ID_PATTERN },
    takenAt: { type: 'string', minLength: 1 },
    note: { type: ['string', 'null'] },
    reason: { enum: ['requested', 'before-restore'] },
    restoring: { anyOf: [{ type: 'null' }, { type: 'string', pattern: ID_PATTERN }] },
    instance: {
      type: 'object',
      required: ['assistantPubkey', 'ownerPubkey'],
      properties: { assistantPubkey: { type: 'string', pattern: '^[0-9a-f]{64}$' }, ownerPubkey: { type: 'string' } },
    },
    admins: {
      type: 'object',
      required: ['pubkeys', 'from'],
      properties: { pubkeys: { type: 'array', items: { type: 'string' } }, from: { enum: ['settings', 'launch-settings'] } },
    },
    graph: {
      type: 'object',
      required: ['neo4jVersion', 'storeFormat', 'lastCommittedTransaction', 'nodes', 'relationships', 'tapestryKeys',
        'distinctTapestryKeys', 'tapestryKeyDigest', 'countsExact', 'offloadedJsonTags'],
      properties: {
        neo4jVersion: { type: 'string', minLength: 1 },
        storeFormat: { type: 'string' },
        lastCommittedTransaction: { type: 'string', minLength: 1 },
        nodes: int, relationships: int, tapestryKeys: int, distinctTapestryKeys: int,
        tapestryKeyDigest: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
        countsExact: { type: 'boolean' },
        offloadedJsonTags: int,
      },
    },
    offlineMs: int,
    files: {
      type: 'object',
      required: [...PAYLOAD],
      additionalProperties: false,
      properties: Object.fromEntries(PAYLOAD.map((m) => [m, fileEntry])),
    },
  },
});
let manifestValidator = null;
/** What is wrong with a manifest, in words, or null when nothing is. */
function manifestProblem(manifest, id) {
  if (!manifestValidator) manifestValidator = new Ajv({ allErrors: true, strict: false }).compile(MANIFEST_SCHEMA);
  if (!manifestValidator(manifest)) {
    const e = (manifestValidator.errors || [])[0] || {};
    return `its manifest ${e.instancePath ? `field ${e.instancePath} ` : ''}${e.message || 'is not valid'}`;
  }
  if (id && manifest.id !== id) return `its manifest names the backup ${manifest.id}, not ${id}`;
  return null;
}

/** A complete backup's manifest (its folder and manifest.json exist and parse), or null. */
function readManifest(id) {
  if (!isId(id)) return null;
  return readJson(path.join(folderOf(id), 'manifest.json'));
}
/** The ids of the complete backups, newest first. */
function ids() {
  const dir = backupsDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((n) => isId(n) && fs.existsSync(path.join(dir, n, 'manifest.json')))
    .sort()
    .reverse();
}

/** A backup as the list and the answers show it (Decisions 3 and 11). */
function summaryOf(id, manifest, { assistantPubkey } = {}) {
  const folder = folderOf(id);
  let size = 0;
  for (const m of MEMBERS) { try { size += fs.statSync(path.join(folder, m)).size; } catch { /* a missing file counts nothing */ } }
  const received = readJson(path.join(folder, 'received.json'));
  const g = manifest.graph || {};
  const inst = manifest.instance || {};
  const out = {
    id,
    takenAt: manifest.takenAt,
    note: manifest.note === undefined ? null : manifest.note,
    size,
    origin: received ? 'uploaded' : 'taken',
    reason: manifest.reason,
    restoring: manifest.restoring || null,
    holds: {
      nodes: g.nodes, relationships: g.relationships, tapestryKeys: g.tapestryKeys, countsExact: g.countsExact,
      assistantPubkey: inst.assistantPubkey, ownerPubkey: inst.ownerPubkey,
      admins: (manifest.admins && manifest.admins.pubkeys) || [], offloadedJsonTags: g.offloadedJsonTags,
    },
    graph: { neo4jVersion: g.neo4jVersion, storeFormat: g.storeFormat, lastCommittedTransaction: g.lastCommittedTransaction },
    offlineMs: manifest.offlineMs,
  };
  if (received) out.receivedAt = received.receivedAt;
  if (assistantPubkey !== undefined) out.sameInstance = !!assistantPubkey && inst.assistantPubkey === assistantPubkey;
  return out;
}

/** Complete backups, newest first, `limit` at a time; `before` lists those older than that id. */
function listBackups({ limit = 100, before = null, assistantPubkey } = {}) {
  let all = ids();
  if (before) all = all.filter((id) => id < before);
  const page = all.slice(0, limit);
  const backups = [];
  for (const id of page) {
    const m = readManifest(id);
    if (m) backups.push(summaryOf(id, m, { assistantPubkey }));
  }
  return { backups, next: all.length > page.length && page.length ? page[page.length - 1] : null };
}
function latest() {
  for (const id of ids()) {
    const m = readManifest(id);
    if (m) return summaryOf(id, m);
  }
  return null;
}
function count() { return ids().length; }

/** Up to 20 of the backups held, newest first, for a refusal that names them. */
function heldIds() {
  const all = ids();
  return all.length ? all.slice(0, 20).join(', ') : 'none';
}

// ── The lock (Decision 7) ────────────────────────────────────────────────────────────────────────────────────────

function lockPath() { return path.join(backupsDir(), '.lock'); }
/** A process's start time in clock ticks since boot (field 22 of /proc/<pid>/stat), or null where there is no /proc. */
function startTimeOf(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    return Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]);
  } catch { return null; }
}
/** Is a process with this pid running (on this host)? */
function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return !!err && err.code === 'EPERM';
  }
}
function holderAlive(h) {
  if (!h || !pidAlive(h.pid)) return false;
  if (h.startTime !== null && h.startTime !== undefined) {
    const now = startTimeOf(h.pid);
    if (now !== null && now !== h.startTime) return false; // the pid was reused
  }
  return true;
}
/** The lock, with `stale` set, or null when there is none. */
function inspectLock() {
  const lock = readJson(lockPath());
  if (!lock) return fs.existsSync(lockPath()) ? { stale: true, runId: null, op: 'unknown', holders: [], unreadable: true } : null;
  const stale = lock.host !== os.hostname() || !(lock.holders || []).some(holderAlive);
  return { ...lock, stale };
}
/** Take the lock for a new run, or null when it is held. */
function acquireLock({ op, backup = null }) {
  ensureDir();
  const lock = {
    runId: newId(), op, host: os.hostname(), holders: [{ pid: process.pid, startTime: startTimeOf(process.pid) }],
    stage: 'online', backup, paused: [], startedAt: new Date().toISOString(),
  };
  // Written whole to a file of its own, then linked into place: the link fails when a lock exists, as `wx` did, and a
  // reader never finds the lock empty, which inspectLock would judge stale (ADR 0002 Amendment 1, A4).
  const tmp = `${lockPath()}.${lock.runId}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(lock), { mode: 0o600 });
  try {
    fs.linkSync(tmp, lockPath());
  } catch (err) {
    if (err && err.code === 'EEXIST') return null;
    throw err;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  return lock;
}
/** Change the lock of run `runId`, if it is still that run's. */
function updateLock(runId, changes) {
  const lock = readJson(lockPath());
  if (!lock || lock.runId !== runId) return null;
  const next = { ...lock, ...changes };
  writeJson(lockPath(), next);
  return next;
}
function addHolder(runId, pid) {
  const lock = readJson(lockPath());
  if (!lock || lock.runId !== runId) return null;
  return updateLock(runId, { holders: [...(lock.holders || []), { pid, startTime: startTimeOf(pid) }] });
}
/** Remove the lock of run `runId`; another run's lock is left alone. */
function releaseLock(runId) {
  const lock = readJson(lockPath());
  if (lock && lock.runId === runId) fs.rmSync(lockPath(), { force: true });
}
/** A busy refusal's words for a live lock. */
function busyMessage(lock) {
  const what = lock && lock.op ? `A ${lock.op}` : 'Another backup or restore';
  return `${what} is running${lock && lock.startedAt ? ` (since ${lock.startedAt})` : ''}; try again when it has finished.`;
}

/**
 * Recover from a stale lock, before anything else is checked: start the graph database and the writers the dead run
 * stopped, remove its incomplete folders, record its run as interrupted, and remove the lock. A live lock is returned
 * as it is, for the caller to refuse `busy`; with no lock, null.
 */
async function recoverIfStale(system, waitForGraph) {
  const lock = inspectLock();
  if (!lock || !lock.stale) return lock;
  if (lock.stage === 'offline') {
    await system.supervisor('start', ['neo4j']);
    if (waitForGraph) await waitForGraph(system);
  }
  const paused = (lock.paused || []).filter((p) => WRITERS.includes(p));
  if (paused.length) await system.supervisor('start', paused);
  for (const id of [lock.backup, lock.safety]) {
    if (isId(id) && fs.existsSync(folderOf(id)) && !fs.existsSync(path.join(folderOf(id), 'manifest.json'))) {
      fs.rmSync(folderOf(id), { recursive: true, force: true });
    }
  }
  if (lock.runId && isId(lock.runId)) {
    const prior = readJson(runFile(lock.runId)) || { runId: lock.runId, op: lock.op };
    const safety = isId(lock.safety) ? ` Its safety backup is ${lock.safety}.` : '';
    writeJson(runFile(lock.runId), { ...prior, outcome: 'interrupted', finishedAt: new Date().toISOString(), error: `The ${lock.op} that began ${lock.startedAt} stopped before it finished; the next lifecycle operation tidied up after it.${safety}` });
  }
  // Only the lock found stale: another run may have recovered it too and taken a lock of its own meanwhile.
  if (lock.runId) releaseLock(lock.runId);
  else if (inspectLock() && inspectLock().unreadable) fs.rmSync(lockPath(), { force: true });
  const now = inspectLock();
  return now && !now.stale ? now : null;
}

// ── Runs ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The most recent finished run: { runId, op, outcome, finishedAt, backup }, or null. */
function lastRun() {
  const dir = runsDir();
  if (!fs.existsSync(dir)) return null;
  let best = null;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const r = readJson(path.join(dir, f));
    if (!r || !r.outcome || !r.finishedAt) continue;
    if (!best || String(r.finishedAt) > String(best.finishedAt)) best = { ...r, runId: r.runId || f.slice(0, -5) };
  }
  if (!best) return null;
  const result = best.result || {};
  const backup = (result.backup && result.backup.id) || result.restored || best.backup || null;
  return { runId: best.runId, op: best.op || null, outcome: best.outcome, finishedAt: best.finishedAt, backup };
}

module.exports = {
  DEFAULT_DIR, ID_PATTERN, ID_RE, MEMBERS, PAYLOAD, WRITERS, MANIFEST_SCHEMA,
  backupsDir, ensureDir, runsDir, runFile, runLog, newId, isId, folderOf, writeJson, readJson, hashFile,
  manifestProblem, readManifest, ids, summaryOf, listBackups, latest, count, heldIds,
  lockPath, startTimeOf, pidAlive, inspectLock, acquireLock, updateLock, addHolder, releaseLock, busyMessage, recoverIfStale,
  lastRun,
};
