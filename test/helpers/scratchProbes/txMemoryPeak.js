'use strict';
/**
 * A probe copied INTO a scratch container and run there (graph-operations-foundation #9, AC4): polls SHOW TRANSACTIONS
 * every 200 ms and keeps the peak of Neo4j's own estimate of what all transactions hold together
 * (estimatedUsedHeapMemory summed, which is what dbms.memory.transaction.total.max caps), and each query's own peak.
 * It reads only. It stops on SIGINT or SIGTERM, or after --seconds=<n> (600), and prints one JSON line:
 * { samples, peakAllMB, queries: [{ mb, query }] }.
 *
 *   docker exec -d <scratch> sh -c 'node /tmp/txMemoryPeak.js --seconds=600 > /tmp/txMemoryPeak.out 2>&1'
 */
const fs = require('fs');
const neo4j = require('/usr/local/lib/node_modules/brainstorm/node_modules/neo4j-driver');

const pw = (fs.readFileSync('/etc/brainstorm.conf', 'utf8').match(/NEO4J_PASSWORD="?([^"\n]*)/) || [])[1];
const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', pw || ''));
const secs = Number((process.argv.find((a) => a.startsWith('--seconds=')) || '--seconds=600').split('=')[1]);
const peaks = new Map();
let peakAll = 0;
let samples = 0;
let stop = false;
const mb = (b) => Math.round((b / 1048576) * 10) / 10;
const short = (q) => String(q || '').replace(/\s+/g, ' ').trim().slice(0, 120);

async function main() {
  const end = Date.now() + secs * 1000;
  while (!stop && Date.now() < end) {
    // A session per sample: a backup stops and restarts Neo4j, and a fresh session reconnects after it.
    const session = driver.session();
    try {
      const r = await session.run("SHOW TRANSACTIONS YIELD currentQuery, estimatedUsedHeapMemory WHERE NOT currentQuery STARTS WITH 'SHOW TRANSACTIONS' RETURN currentQuery, estimatedUsedHeapMemory");
      let sum = 0;
      for (const rec of r.records) {
        const m = Number(rec.get('estimatedUsedHeapMemory') || 0);
        const q = short(rec.get('currentQuery'));
        sum += m;
        if (!peaks.has(q) || peaks.get(q) < m) peaks.set(q, m);
      }
      if (sum > peakAll) peakAll = sum;
      samples++;
    } catch (e) { /* the server is offline during a backup's dump; keep sampling */ }
    await session.close().catch(() => {});
    await new Promise((res) => setTimeout(res, 200));
  }
  await driver.close().catch(() => {});
  const queries = [...peaks.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([query, m]) => ({ mb: mb(m), query }));
  console.log(JSON.stringify({ samples, peakAllMB: mb(peakAll), queries }));
}
process.on('SIGINT', () => { stop = true; });
process.on('SIGTERM', () => { stop = true; });
main();
