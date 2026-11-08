'use strict';
/**
 * lifecycle status — the last backup, the firmware version, the migrations applied, and how fresh the cache is
 * (catalog §8; story graph-operations-foundation #1, ADR graph-operations-foundation/0001 Decision 11).
 *
 * Each part has its own reader on `parts`. run() calls them through that object, all at once, and a part whose reader
 * fails answers { known: false, problem } while the rest still answer, so status says what it can when Neo4j is down.
 * It writes nothing and carries no timestamp: asking twice with nothing changed gives the same answer. Backup and
 * migrations have nothing to read yet; lifecycle backup (Loom A10.2) and lifecycle migrate (A10.3) fill them in.
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
    backup: part('The last backup of the graph.', {
      last: { description: 'The last backup recorded, or null while none is' },
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
    'Four parts, each saying plainly what it knows. **backup**: the last backup of the graph (none is recorded until lifecycle backup is built). **firmware**: the version the instance carries, and whether all, some or none of its concepts are in the graph. **migrations**: the migrations applied (none is recorded until lifecycle migrate is built). **cache**: how many nodes have a cached Tapestry JSON, and how many do not.',
    'A part that cannot be read answers `known: false` with its `problem`, and the others still answer. Status changes nothing.',
  ].join('\n\n'),
  inputs: {},
  result: { description: 'The four parts', schema: RESULT_SCHEMA },
  refusals: [],

  parts: {
    async backup() {
      return {
        known: true,
        last: null,
        note: 'No backup of the graph has been recorded: lifecycle backup is not built yet (bin/backup.js copies configuration, keys and logs, not the graph).',
      };
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
