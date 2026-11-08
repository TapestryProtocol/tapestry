#!/usr/bin/env node
'use strict';
/**
 * The process a lifecycle job runs in — ADR graph-operations-foundation/0002 Decision 8. _jobs.js's runDetached starts
 * it as `node _worker.js <runId>`, in a session of its own, with its output going to .runs/<runId>.log. It reads the
 * request from .runs/<runId>.json, joins the run's lock, runs the job with the real system, and writes back
 * { …request, outcome: 'done' | 'failed', result | error, finishedAt }.
 */

const fs = require('fs');
const store = require('./_store');
const jobs = require('./_jobs');
const system = require('./_system');

async function main() {
  const runId = process.argv[2];
  if (!store.isId(runId)) throw new Error(`usage: _worker.js <runId>; got ${JSON.stringify(runId)}`);
  const file = store.runFile(runId);
  const request = JSON.parse(fs.readFileSync(file, 'utf8'));
  store.addHolder(runId, process.pid);
  let record;
  try {
    const job = request.op === 'restore' ? jobs.runRestoreJob : jobs.runBackupJob;
    const result = await job(request, system);
    record = { ...request, outcome: 'done', result, finishedAt: new Date().toISOString() };
  } catch (err) {
    record = { ...request, outcome: 'failed', error: (err && err.message) || String(err), finishedAt: new Date().toISOString() };
  }
  store.writeJson(file, record);
  console.log(`[lifecycle ${request.op}] ${runId}: ${record.outcome}${record.error ? ` — ${record.error}` : ''}`);
}

main()
  .catch((err) => { console.error(`[lifecycle worker] ${(err && err.stack) || err}`); process.exitCode = 1; })
  .finally(async () => {
    try { await require('../../../lib/neo4j-driver').closeDriver(); } catch { /* nothing to close */ }
    process.exit(process.exitCode || 0);
  });
