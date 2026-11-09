'use strict';
/**
 * lifecycle list-backups — the backups the instance holds, newest first (story graph-operations-foundation #2,
 * ADR graph-operations-foundation/0002 Decisions 1 and 11).
 */

const C = require('./_common');

module.exports = {
  group: 'lifecycle',
  name: 'list-backups',
  kind: 'read',
  access: 'owner-and-admins',
  summary: 'The backups the instance holds, newest first',
  description: 'Each complete backup the instance holds — taken here, or uploaded — with what it holds, whether it is this instance\'s own, and when an uploaded one arrived. `next` is the id to pass as `before` for the next page, or null at the end.',
  inputs: {
    limit: { schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 }, required: false, description: 'How many to list' },
    before: { schema: { type: 'string', pattern: C.ID_PATTERN }, required: false, description: 'List the backups older than this one' },
  },
  result: {
    description: '{ backups, next }',
    schema: {
      type: 'object',
      properties: { backups: { type: 'array', items: C.SUMMARY }, next: { type: 'string', nullable: true, description: 'The id to pass as `before` for more, or null' } },
    },
  },
  refusals: [],

  async run(inputs) {
    const store = require('./_store');
    const identity = require('./_identity');
    return store.listBackups({ limit: inputs.limit, before: inputs.before || null, assistantPubkey: identity.namedAssistant() });
  },
};
