'use strict';
/**
 * lifecycle migrate — run one of the instance's one-time changes to existing data: give every node a tapestryKey and
 * the label TapestryNode, or take NostrEvent off the nodes that came from no event (catalog §8; story
 * graph-operations-foundation #3, ADR graph-operations-foundation/0003 Decisions 2–6 and 11).
 *
 * Its checks come first, holding the lock: the migration is known, the ones it requires are applied, and it isn't
 * applied already. Then it runs as a job of its own (ADR 0002 Decision 8), which takes a backup first when data will
 * change. Over HTTP it answers within `wait` seconds (50 by default); past that it answers `running`, and status shows
 * how the job went.
 */

const C = require('./_common');
const { refusal } = require('../../refusal');

const HTTP_WAIT_S = 50;
const STATUS_WORDS = '`tapestry lifecycle status` (or the status operation over HTTP)';

module.exports = {
  group: 'lifecycle',
  name: 'migrate',
  kind: 'write',
  access: 'owner-and-admins',
  summary: 'Run a migration: give every node a tapestryKey (tapestry-keys), or take NostrEvent off event-less sets (event-less-nodes)',
  description: [
    'Runs one migration, named by `migration`. **tapestry-keys** gives every node that lacks one a tapestryKey — a random UUID, set once and never changed — and the label TapestryNode, keeping every key a node already has, then adds the uniqueness rule `tapestry_key` and the index `tapestry_node_uuid`. When some key is already held by more than one node, it changes none of them and leaves the rule out, naming each such key and its nodes for the owner to decide. **event-less-nodes** (after tapestry-keys) takes the label NostrEvent off the sets made with no event, which keep their key and their other labels.',
    'When data will change, it **takes a backup first** — the graph is offline for that while, as for `lifecycle backup` — and names it in the answer. The changes themselves go in with the graph online, while the instance keeps writing. Run again with nothing left to change, it answers `already-applied` and takes no backup.',
    'It runs as a job of its own, so it finishes even if the caller goes away. Over HTTP it waits `wait` seconds (50 by default) and then answers `running` with its run id; the command waits to the end unless given `--wait`. `lifecycle status` shows each migration, whether it is applied, and its last run.',
  ].join('\n\n'),
  inputs: {
    migration: { schema: { type: 'string', minLength: 1, maxLength: 64 }, required: true, description: 'The migration to run: tapestry-keys or event-less-nodes' },
    wait: { schema: { type: 'integer', minimum: 0, maximum: 600 }, required: false, description: 'Seconds to wait for the job before answering running (over HTTP 50 by default; the command waits to the end)' },
  },
  result: {
    description: 'What was done: { migration, state, runId, backup, report, note }',
    schema: {
      type: 'object',
      properties: {
        migration: { type: 'string', description: 'The migration' },
        state: { type: 'string', enum: ['done', 'running', 'already-applied'], description: 'Done; still running as a job of its own; or applied already, with nothing changed' },
        runId: { type: 'string', nullable: true, description: 'The run, as status lists it; null when nothing ran' },
        backup: { type: 'string', nullable: true, description: 'The backup taken before the migration, or null when none was needed (or it is still running)' },
        report: { type: 'object', nullable: true, description: "The migration's own report, or null while it runs or when nothing ran" },
        note: { type: 'string', description: 'What was done, in words' },
      },
    },
  },
  refusals: [
    { code: 'unknown-migration', status: 400, when: 'There is no migration of that name (the refusal names the ones there are)' },
    { code: 'run-tapestry-keys-first', status: 409, when: 'event-less-nodes was asked for while tapestry-keys is not applied' },
    C.BUSY,
    C.GRAPH_UNAVAILABLE,
  ],

  async run(inputs, context) {
    const migrations = require('./_migrations');
    const name = inputs.migration;
    const m = migrations.byName(name);
    if (!m) throw refusal('unknown-migration', `There is no migration '${name}'. The migrations are: ${migrations.names().join(', ')}.`);

    const store = require('./_store');
    const system = require('./_system');
    const lock = await C.begin('migrate', { migration: name });
    let started = false;
    try {
      for (const r of m.requires) {
        if (!(await migrations.byName(r).plan(system)).applied) {
          throw refusal('run-tapestry-keys-first', `${name} needs ${r} applied first, and it isn't: run \`tapestry lifecycle migrate --migration ${r}\`, then this one.`);
        }
      }
      if ((await m.plan(system)).applied) {
        return { migration: name, state: 'already-applied', runId: null, backup: null, report: null, note: `${name} is already applied: nothing was changed, and no backup was taken.` };
      }

      const via = context && context.via;
      const waitMs = Number.isInteger(inputs.wait) ? inputs.wait * 1000 : via === 'cli' ? null : HTTP_WAIT_S * 1000;
      if (via === 'cli') {
        console.log('This migration runs as a job of its own. If this command is interrupted, the job still finishes, and `tapestry lifecycle status` shows how it went.');
      }
      const by = (context && context.caller && context.caller.pubkey) || 'local';
      started = true;
      const jobs = require('./_jobs');
      const record = await jobs.runDetached(
        { op: 'migrate', runId: lock.runId, migration: name, by, startedAt: new Date().toISOString() },
        { waitMs },
      );
      if (record && record.outcome === 'running') {
        return {
          migration: name, state: 'running', runId: lock.runId, backup: null, report: null,
          note: `${name} is still running as a job of its own (run ${lock.runId}); it finishes by itself, and ${STATUS_WORDS} shows how it went.`,
        };
      }
      const result = C.finish(record);
      return { migration: name, state: 'done', runId: lock.runId, backup: result.backup, report: result.report, note: result.note };
    } finally {
      if (!started) store.releaseLock(lock.runId);
    }
  },
};
