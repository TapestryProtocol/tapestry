'use strict';
/**
 * lifecycle backup — a full backup of the instance: its whole graph (a Neo4j dump), its assistant's key and its admin
 * list (catalog §8; story graph-operations-foundation #2, ADR graph-operations-foundation/0002 Decisions 1–4 and 7–8).
 */

const C = require('./_common');

module.exports = {
  group: 'lifecycle',
  name: 'backup',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Back up the instance: its whole graph, its assistant's key and its admin list",
  description: [
    'Takes a full backup: a dump of the whole graph database, the instance assistant\'s key (with the master key it is encrypted under) and the admin list, kept on the instance\'s data volume, where it outlives the container being recreated. The answer gives its id, what it holds, and how long the graph was offline.',
    '**The graph is offline while the backup is taken** — Neo4j Community can only be dumped stopped — usually some seconds, longer on a big graph. Requests that need it fail meanwhile, and everything comes back by itself. The backup runs as a job of its own, so it finishes even if the caller goes away.',
    'A backup is a key: it holds the assistant\'s secret key, so anyone with its file can sign as the instance.',
  ].join('\n\n'),
  inputs: {
    note: { schema: { type: 'string', minLength: 1, maxLength: 200 }, required: false, description: 'A few words to know it by, such as "before migrate"' },
  },
  result: {
    description: 'The backup taken: { backup, holds, graph, offlineMs, warnings }',
    schema: {
      type: 'object',
      properties: { backup: C.REF, holds: C.HOLDS, graph: C.GRAPH, offlineMs: { type: 'integer', minimum: 0 }, warnings: C.WARNINGS },
    },
  },
  refusals: [C.BUSY, C.GRAPH_UNAVAILABLE],

  async run(inputs, context) {
    const lock = await C.begin('backup');
    const note = typeof inputs.note === 'string' && inputs.note.trim() ? inputs.note.trim() : null;
    if (context && context.via === 'cli') {
      console.log('This backup runs as a job of its own. If this command is interrupted, the job still finishes, and `tapestry lifecycle status` shows how it went.');
    }
    return C.finish(await require('./_jobs').runDetached({ op: 'backup', runId: lock.runId, note }));
  },
};
