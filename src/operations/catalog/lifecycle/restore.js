'use strict';
/**
 * lifecycle restore — put a backup in place: the graph, the assistant's key and the admin list, after a safety backup
 * of the instance as it is (catalog §8; story graph-operations-foundation #2, ADR graph-operations-foundation/0002
 * Decisions 1, 5–8).
 */

const C = require('./_common');

module.exports = {
  group: 'lifecycle',
  name: 'restore',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Restore a backup: the graph, the assistant's key and the admins, after a safety backup of what is there",
  description: [
    'Checks the backup first — its files, its dump, its key and its version — and changes nothing if it refuses. Then, in one offline window, it dumps the graph as it is into a **safety backup**, loads the backup, and checks the loaded store is the one that was dumped; if the load fails, it rolls back from the safety backup. It then puts the backup\'s assistant key in place (under this instance\'s own master key) and its admins.',
    'The report compares what came back with what the backup recorded: the store\'s transaction, and the numbers of nodes, relationships and tapestryKeys and their exact set. When the assistant changes, the control panel restarts once it has answered, so within a minute the instance answers as the restored one. The owner stays as the instance\'s launch settings name it; the report says when the backup\'s differs.',
  ].join('\n\n'),
  inputs: { backup: C.idInput('The id of the backup to restore, one this instance holds') },
  result: {
    description: 'The report: { restored, safetyBackup, graph: { transaction, counts }, assistant, owner, admins, offlineMs, restarting, warnings }',
    schema: { type: 'object' },
  },
  refusals: [
    C.UNKNOWN,
    { code: 'damaged-backup', status: 422, when: "The backup is damaged or incomplete: a file missing or changed, a dump the graph database can't load, or a key that isn't its assistant" },
    { code: 'newer-database', status: 409, when: 'The backup was taken with another major version of the graph database, or a newer one' },
    { code: 'not-enough-space', status: 409, when: "There isn't room for the backup's database" },
    C.BUSY,
    C.GRAPH_UNAVAILABLE,
  ],

  async run(inputs, context) {
    const system = require('./_system');
    const store = require('./_store');
    const lock = await C.begin('restore', { backup: inputs.backup });
    let started = false;
    try {
      await C.verifyForRestore(inputs.backup, system);
      started = true;
      if (context && context.via === 'cli') {
        console.log('This restore runs as a job of its own. If this command is interrupted, the job still finishes, and `tapestry lifecycle status` shows how it went.');
      }
      const report = C.finish(await require('./_jobs').runDetached({ op: 'restore', runId: lock.runId, backup: inputs.backup }));
      if (report && report.assistant && report.assistant.changed) {
        context.afterAnswer(() => require('./_identity').restartControlPanel(system));
      }
      return report;
    } finally {
      if (!started) store.releaseLock(lock.runId);
    }
  },
};
