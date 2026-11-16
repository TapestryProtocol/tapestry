'use strict';
/**
 * The seam every graph operation and every rule reaches Neo4j through, and nothing else (ADR
 * graph-operations-foundation/0004 Decision 9). `module.exports` is the object itself, as lifecycle's _system.js is:
 * the operations call its methods through it, so a suite can replace them (test/helpers/operationsHarness.js does,
 * with test/helpers/graphFake.js).
 *
 *   writeTransaction(work)  runs work(tx) in one Neo4j write transaction (session.executeWrite, which runs it again
 *                           on a transient error such as a deadlock, so work does nothing outside tx) and resolves
 *                           what work resolves. A throw rolls everything back.
 *                             tx.run(cypher, params)   → { rows, counters }  (counters: summary.counters.updates())
 *                             tx.read(cypher, params)  → rows
 *   read(cypher, params)    a read outside any write transaction → rows
 *
 * Rows are plain objects, converted by src/lib/neo4j-driver.js's toJS. The driver is required when first called,
 * never at load (ADR graph-operations-foundation/0001 Decision 10).
 */

function rowsOf(result, toJS) {
  return result.records.map((record) => {
    const obj = {};
    for (const key of record.keys) obj[key] = toJS(record.get(key));
    return obj;
  });
}

function countersOf(result) {
  const u = result.summary && result.summary.counters && typeof result.summary.counters.updates === 'function'
    ? result.summary.counters.updates() : {};
  const n = (k) => Number(u[k] || 0);
  return {
    nodesCreated: n('nodesCreated'),
    nodesDeleted: n('nodesDeleted'),
    relationshipsCreated: n('relationshipsCreated'),
    relationshipsDeleted: n('relationshipsDeleted'),
    propertiesSet: n('propertiesSet'),
    labelsAdded: n('labelsAdded'),
  };
}

const graph = {
  async writeTransaction(work) {
    const neo4j = require('neo4j-driver');
    const { getDriver, toJS } = require('../lib/neo4j-driver');
    const session = getDriver().session({ defaultAccessMode: neo4j.session.WRITE });
    try {
      return await session.executeWrite(async (ntx) => {
        const tx = {
          async run(cypher, params) {
            const result = await ntx.run(cypher, params || {});
            return { rows: rowsOf(result, toJS), counters: countersOf(result) };
          },
          async read(cypher, params) {
            const result = await ntx.run(cypher, params || {});
            return rowsOf(result, toJS);
          },
        };
        return work(tx);
      });
    } finally {
      await session.close();
    }
  },

  async read(cypher, params) {
    const { runCypher } = require('../lib/neo4j-driver');
    return runCypher(cypher, params || {});
  },
};

module.exports = graph;
