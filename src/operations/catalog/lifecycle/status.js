'use strict';
/**
 * lifecycle status — the last backup, the firmware version, the migrations applied, and how fresh the cache is
 * (catalog §8; story graph-operations-foundation #1, ADR graph-operations-foundation/0001 Decision 11).
 *
 * Each part has its own reader on `parts`. run() calls them through that object, all at once, and a part whose reader
 * fails answers { known: false, problem } while the rest still answer, so status says what it can when Neo4j is down.
 * It writes nothing and carries no timestamp: asking twice with nothing changed gives the same answer. The backup part
 * reads the backups folder (story graph-operations-foundation #2, ADR 0002 Decision 11); migrations has nothing to
 * read until lifecycle migrate (Loom A10.3) fills it in.
 *
 * The readers require what they read lazily, so loading this declaration opens nothing (Decision 10).
 */

const PARTS = ['backup', 'firmware', 'migrations', 'cache'];

/** A part's schema: `known`, then its own fields. A part that could not be read has only known: false and problem. */
function part(description, properties) {
  return {
    type: 'object',
    description,
    required: ['known'],
    properties: {
      known: { type: 'boolean', description: 'false when this part could not be read; `problem` then says why' },
      problem: { type: 'string', description: 'Why this part could not be read' },
      ...properties,
    },
  };
}
const count = (description) => ({ type: 'integer', minimum: 0, description });

const RESULT_SCHEMA = {
  type: 'object',
  required: PARTS,
  additionalProperties: false,
  properties: {
    backup: part('The backups of the instance (graph-operations-foundation #2).', {
      last: {
        type: 'object',
        nullable: true,
        description: 'The most recent backup the instance holds, or null while it holds none',
        properties: {
          id: { type: 'string' },
          takenAt: { type: 'string' },
          note: { type: 'string', nullable: true },
          size: count('The sum of its files, in bytes'),
          origin: { type: 'string', enum: ['taken', 'uploaded'] },
          reason: { type: 'string', enum: ['requested', 'before-restore'] },
        },
      },
      count: count('How many backups the instance holds'),
      lastRun: {
        type: 'object',
        nullable: true,
        description: 'The most recent backup or restore run to finish, or null',
        properties: {
          runId: { type: 'string' },
          op: { type: 'string', nullable: true },
          outcome: { type: 'string', enum: ['done', 'failed', 'interrupted'] },
          finishedAt: { type: 'string' },
          backup: { type: 'string', nullable: true },
        },
      },
      interrupted: {
        type: 'object',
        nullable: true,
        description: 'A backup or restore that stopped before it finished, until the next one tidies up after it, or null',
        properties: {
          runId: { type: 'string', nullable: true },
          op: { type: 'string' },
          startedAt: { type: 'string', nullable: true },
          safety: { type: 'string', nullable: true, description: "An interrupted restore's safety backup, the graph as it was before it" },
        },
      },
      note: { type: 'string', description: 'What this part knows, in words' },
    }),
    firmware: part('The firmware this instance carries, and how much of it is in the graph.', {
      version: { type: 'string', description: "The version of the firmware the instance carries (its active manifest's)" },
      installed: { type: 'string', enum: ['all', 'some', 'none'], description: "How many of the firmware's concepts are in the graph" },
      conceptsInGraph: count("How many of the firmware's concepts are in the graph"),
      concepts: count('How many concepts the firmware has'),
      missing: { type: 'array', items: { type: 'string' }, description: "The slugs of the firmware's concepts not in the graph" },
    }),
    migrations: part('The one-time changes to existing data that have been applied.', {
      applied: { type: 'array', items: {}, description: 'The migrations recorded as applied' },
      note: { type: 'string', description: 'What this part knows, in words' },
    }),
    cache: part("How much of the cache built from the graph (each node's Tapestry JSON, in the LMDB) is there. It counts the nodes with a uuid or an id, as GET /api/tapestry-key/status does.", {
      nodes: count('Nodes with a uuid or an id'),
      withTapestryKey: count('Of those, nodes with a tapestryKey'),
      withoutTapestryKey: count('Of those, nodes with no tapestryKey yet (they cannot be cached)'),
      cached: count('Keyed nodes whose Tapestry JSON is in the LMDB'),
      cachedEmpty: count('Keyed nodes whose LMDB entry is empty'),
      notCached: count('Keyed nodes with no LMDB entry'),
    }),
  },
};

const status = {
  group: 'lifecycle',
  name: 'status',
  kind: 'read',
  access: 'owner-and-admins',
  summary: 'The last backup, the firmware version, the migrations applied, and how fresh the cache is',
  description: [
    'Four parts, each saying plainly what it knows. **backup**: the most recent backup the instance holds, how many it holds, the last backup or restore run, and one that was interrupted. **firmware**: the version the instance carries, and whether all, some or none of its concepts are in the graph. **migrations**: the migrations applied (none is recorded until lifecycle migrate is built). **cache**: how many nodes have a cached Tapestry JSON, and how many do not.',
    'A part that cannot be read answers `known: false` with its `problem`, and the others still answer. Status changes nothing.',
  ].join('\n\n'),
  inputs: {},
  result: { description: 'The four parts', schema: RESULT_SCHEMA },
  refusals: [],

  parts: {
    async backup() {
      const store = require('./_store');
      const latest = store.latest();
      const last = latest
        ? { id: latest.id, takenAt: latest.takenAt, note: latest.note, size: latest.size, origin: latest.origin, reason: latest.reason }
        : null;
      const lock = store.inspectLock();
      const interrupted = lock && lock.stale
        ? { runId: lock.runId || null, op: lock.op, startedAt: lock.startedAt || null, safety: store.isId(lock.safety) ? lock.safety : null }
        : null;
      const words = [last ? `The most recent backup is ${last.id}, taken ${last.takenAt}.` : 'No backup has been taken yet.'];
      if (interrupted) {
        const safety = interrupted.safety ? ` Its safety backup, the graph as it was, is ${interrupted.safety}.` : '';
        words.push(`A ${interrupted.op} was interrupted (it began ${interrupted.startedAt}); the next backup, restore or upload tidies up after it.${safety}`);
      }
      return { known: true, last, count: store.count(), lastRun: store.lastRun(), interrupted, note: words.join(' ') };
    },
    async firmware() {
      const { readInstallState } = require('../../../api/firmware');
      const s = await readInstallState();
      const installed = s.installedCount === 0 ? 'none' : s.installedCount === s.totalCount ? 'all' : 'some';
      return {
        known: true,
        version: s.activeVersion,
        installed,
        conceptsInGraph: s.installedCount,
        concepts: s.totalCount,
        missing: s.missing,
      };
    },
    async migrations() {
      return { known: true, applied: [], note: 'No migration has been recorded: lifecycle migrate is not built yet.' };
    },
    async cache() {
      const { readTapestryKeyCounts } = require('../../../api/tapestry-key');
      const c = await readTapestryKeyCounts();
      return {
        known: true,
        nodes: c.total,
        withTapestryKey: c.initialized,
        withoutTapestryKey: c.uninitialized,
        cached: c.lmdb.derived,
        cachedEmpty: c.lmdb.empty,
        notCached: c.lmdb.missing,
      };
    },
  },

  async run() {
    const settled = await Promise.allSettled(PARTS.map((p) => status.parts[p]()));
    const answer = {};
    PARTS.forEach((p, i) => {
      const s = settled[i];
      answer[p] = s.status === 'fulfilled'
        ? s.value
        : { known: false, problem: String((s.reason && s.reason.message) || s.reason) };
    });
    return answer;
  },
};

module.exports = status;
