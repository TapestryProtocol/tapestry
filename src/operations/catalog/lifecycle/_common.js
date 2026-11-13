'use strict';
/**
 * What the lifecycle backup declarations share — ADR graph-operations-foundation/0002 Decisions 1, 3, 5 and 7. Its
 * schemas are plain data; its functions require the store, the jobs and the system only when they run, so a
 * declaration that requires this file still opens nothing at load (ADR 0001 Decision 10).
 */

const fs = require('fs');
const path = require('path');
const { refusal } = require('../../refusal');

const ID_PATTERN = '^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$';
const NEO4J_DATA = '/var/lib/neo4j/data';

const int = (description) => ({ type: 'integer', minimum: 0, description });
const str = (description) => ({ type: 'string', description });

const HOLDS = {
  type: 'object',
  description: 'What the backup holds',
  properties: {
    nodes: int('Nodes in the graph'),
    relationships: int('Relationships in the graph'),
    tapestryKeys: int('Nodes with a tapestryKey'),
    countsExact: { type: 'boolean', description: 'Whether the counts held from just before the backup to just after it' },
    assistantPubkey: str("The instance assistant's pubkey"),
    ownerPubkey: str("The owner's pubkey when the backup was taken"),
    admins: { type: 'array', items: { type: 'string' }, description: 'The admins when the backup was taken' },
    offloadedJsonTags: int('json tags offloaded to the LMDB, whose content a backup does not carry'),
  },
};
const GRAPH = {
  type: 'object',
  description: "The graph database's facts",
  properties: { neo4jVersion: str('Its version'), storeFormat: str('Its store format'), lastCommittedTransaction: str('The transaction the store was at') },
};
const REF = {
  type: 'object',
  properties: {
    id: { type: 'string', pattern: ID_PATTERN, description: "The backup's id: the UTC time it was taken and four random bytes" },
    takenAt: str('When it was taken'),
    note: { type: 'string', nullable: true, description: 'Its note' },
    size: int('The sum of its files, in bytes'),
    origin: { type: 'string', enum: ['taken', 'uploaded'], description: 'Taken here, or uploaded' },
    reason: { type: 'string', enum: ['requested', 'before-restore'], description: 'Asked for, or the safety backup a restore took first' },
  },
};
const SUMMARY = {
  type: 'object',
  description: 'A backup the instance holds',
  properties: {
    ...REF.properties,
    restoring: { type: 'string', nullable: true, description: 'For a safety backup, the backup whose restore it came before' },
    receivedAt: str('When an uploaded backup arrived'),
    sameInstance: { type: 'boolean', description: "Whether it is this instance's own (the same assistant)" },
    holds: HOLDS,
    graph: GRAPH,
    offlineMs: int('How long the graph was offline while it was taken'),
  },
};
const WARNINGS = { type: 'array', items: { type: 'string' }, description: 'What to know about it, in words' };

const BUSY = { code: 'busy', status: 409, when: 'Another backup, restore or migration is running' };
const GRAPH_UNAVAILABLE = { code: 'graph-unavailable', status: 409, when: "The graph database isn't answering" };
const UNKNOWN = { code: 'unknown-backup', status: 404, when: "The instance holds no backup with that id (the refusal names the ones it holds)" };

const idInput = (description) => ({ schema: { type: 'string', pattern: ID_PATTERN }, required: true, description });

/**
 * The checks a backup, restore or migration makes first: recover a stale lock (before anything else), take the lock,
 * and see the graph answer. Resolves the lock; refuses busy or graph-unavailable, holding nothing.
 */
async function begin(op, { backup = null, migration = null } = {}) {
  const system = require('./_system');
  const store = require('./_store');
  const jobs = require('./_jobs');
  const live = await store.recoverIfStale(system, jobs.waitForGraph);
  if (live) throw refusal('busy', store.busyMessage(live));
  const lock = store.acquireLock({ op, backup, migration });
  if (!lock) throw refusal('busy', store.busyMessage(store.inspectLock()));
  if (!(await jobs.graphAnswers(system))) {
    store.releaseLock(lock.runId);
    const what = op === 'restore' ? 'restored' : op === 'migrate' ? 'migrated' : 'backed up';
    throw refusal('graph-unavailable', `The graph database isn't answering, so nothing can be ${what} now. See \`supervisorctl status neo4j\`.`);
  }
  return lock;
}

/** A job's record as the operation's answer: its result, or its failure thrown. */
function finish(record) {
  if (record && record.outcome === 'done') return record.result;
  throw new Error((record && record.error) || 'the job failed');
}

const tail = (s) => String(s || '').trim().split('\n').slice(-2).join(' ').slice(0, 300);
function parseVersion(v) {
  const m = String(v || '').match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3] || 0)] : null;
}

/**
 * Restore's checks of the backup, before anything changes (Decision 5): it exists, its manifest holds, its files are
 * the ones it recorded, the graph database can load its dump, its key is the assistant it names, its version suits
 * this instance, and there is room for it. Resolves { manifest, bytes }.
 */
async function verifyForRestore(id, system) {
  const store = require('./_store');
  const identity = require('./_identity');
  const manifest = store.readManifest(id);
  if (!manifest) throw refusal('unknown-backup', `This instance holds no backup ${id}. It holds: ${store.heldIds()}.`);
  const damaged = (why) => refusal('damaged-backup', `Backup ${id} is damaged or incomplete: ${why}.`);
  const problem = store.manifestProblem(manifest, id);
  if (problem) throw damaged(problem);
  const folder = store.folderOf(id);
  for (const m of store.PAYLOAD) {
    const p = path.join(folder, m);
    if (!fs.existsSync(p)) throw damaged(`its ${m} is missing`);
    const h = await store.hashFile(p);
    if (h.size !== manifest.files[m].size || h.sha256 !== manifest.files[m].sha256) throw damaged(`its ${m} is not the file its manifest recorded`);
  }
  const check = await system.neo4jAdmin(['database', 'load', '--info', '--from-stdin', 'neo4j'], { stdin: fs.createReadStream(path.join(folder, 'neo4j.dump')) });
  if (check.code !== 0) throw damaged(`its neo4j.dump is not an archive the graph database can load (${tail(check.stderr || check.stdout)})`);
  const bytes = Number((String(check.stdout).match(/Bytes:\s*(\d+)/) || [])[1]);
  if (!(await identity.checkIdentity(folder, manifest.instance.assistantPubkey))) throw damaged("its assistant key doesn't decrypt to the assistant its manifest names");
  const mine = await system.version();
  const a = parseVersion(manifest.graph.neo4jVersion);
  const b = parseVersion(mine);
  const newer = !a || !b || a[0] !== b[0] || a[1] > b[1] || (a[1] === b[1] && a[2] > b[2]);
  if (newer) throw refusal('newer-database', `Backup ${id} was taken with Neo4j ${manifest.graph.neo4jVersion}, and this instance runs ${mine}: it restores backups from its own major version, up to its own.`);
  if (Number.isFinite(bytes)) {
    const free = await system.freeBytes(NEO4J_DATA);
    if (free < bytes) throw refusal('not-enough-space', `Restoring backup ${id} needs about ${bytes} bytes free for the database; ${free} are free where it lives.`);
  }
  return { manifest, bytes };
}

module.exports = { ID_PATTERN, HOLDS, GRAPH, REF, SUMMARY, WARNINGS, BUSY, GRAPH_UNAVAILABLE, UNKNOWN, idInput, begin, finish, verifyForRestore };
