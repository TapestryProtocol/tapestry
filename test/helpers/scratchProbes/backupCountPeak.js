'use strict';
/**
 * A probe copied INTO a scratch container and run there (graph-operations-foundation #9, AC4): runs a backup's count of
 * the graph — lifecycle's own countGraph (src/operations/catalog/lifecycle/_jobs.js), which, while the rule
 * tapestry_key isn't online, reads every key as a stream and keeps the strings (ADR 0003 Amendment 2) — in a process of
 * its own, and prints one JSON line: { keys, peakKB }, its count and the process's peak resident memory (VmHWM). That
 * peak is the yardstick AC4 holds the migration's job to. It reads only.
 *
 *   docker exec <scratch> node /tmp/backupCountPeak.js
 */
const fs = require('fs');

const LIFECYCLE = '/usr/local/lib/node_modules/brainstorm/src/operations/catalog/lifecycle';
const jobs = require(`${LIFECYCLE}/_jobs.js`);
const system = require(`${LIFECYCLE}/_system.js`);

jobs.countGraph(system)
  .then((c) => {
    const hwm = Number((fs.readFileSync('/proc/self/status', 'utf8').match(/VmHWM:\s+(\d+)/) || [])[1]);
    console.log(JSON.stringify({ keys: c.tapestryKeys, peakKB: hwm }));
    process.exit(0);
  })
  .catch((e) => { console.log(JSON.stringify({ error: e.message })); process.exit(1); });
