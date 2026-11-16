#!/usr/bin/env node
'use strict';
/**
 * The process a lifecycle job runs in — ADR graph-operations-foundation/0002 Decision 8. _jobs.js's runDetached starts
 * it as `node _worker.js <runId>`, in a session of its own, with its output going to .runs/<runId>.log. It reads the
 * request from .runs/<runId>.json, joins the run's lock, runs the job with the real system (_jobs.js's runJob), and
 * writes back { …request, outcome: 'done' | 'failed', result | error, finishedAt }. Then, after a restore that changed
 * the assistant, it restarts the control panel once the answer is out or its caller is gone (Amendment 1's afterJob).
 * When the lock is no longer its run's, it records the run failed and runs nothing (A4).
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
  // The record keeps whatever the caller added meanwhile (answeredAt), so it is read back in before each write.
  const save = (record) => store.writeJson(file, { ...(store.readJson(file) || {}), ...record });
  if (!store.addHolder(runId, process.pid)) {
    // Another run holds the lock, or none does: running now could overlap another job's offline window, so the job
    // doesn't start, and neither the system nor the lock is touched (ADR 0002 Amendment 1, A4).
    const error = `the ${request.op} job didn't start: the lock is no longer this run's (another backup or restore took it, or it was removed)`;
    save({ ...request, outcome: 'failed', error, finishedAt: new Date().toISOString() });
    console.log(`[lifecycle ${request.op}] ${runId}: failed — ${error}`);
    return;
  }
  const record = await jobs.runJob(request, system);
  save(record);
  console.log(`[lifecycle ${request.op}] ${runId}: ${record.outcome}${record.error ? ` — ${record.error}` : ''}`);
  await jobs.afterJob(record, system);
}

main()
  .catch((err) => { console.error(`[lifecycle worker] ${(err && err.stack) || err}`); process.exitCode = 1; })
  .finally(async () => {
    try { await require('../../../lib/neo4j-driver').closeDriver(); } catch { /* nothing to close */ }
    process.exit(process.exitCode || 0);
  });
