'use strict';
/**
 * graph history — the change entries the write path records: changes to a node, by one admin, or since a time
 * (catalog §1; story graph-operations-foundation #4, AC5; ADR graph-operations-foundation/0004 Decision 7). A read: it
 * opens no write transaction and writes nothing. Its query is src/operations/changes.js's readHistory.
 */

const { ENTRY, readHistory } = require('../../changes');
const graph = require('../../graph');
const { KEY_PATTERN } = require('./_nodes');

const TIME_PATTERN = '^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])T([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(\\.\\d{1,3})?Z$';

module.exports = {
  group: 'graph',
  name: 'history',
  kind: 'read',
  access: 'owner-and-admins',
  summary: 'The change entries: changes to a node, by one admin, or since a time',
  description: [
    'The change entries the graph writes recorded, newest first (by when, then by the later id), up to `limit` at a time. Pass the answer\'s `cursor` to get the next page; it is null on the last.',
    'Filter by `node` (the entries whose changes name it), by `by` (an owner\'s or admin\'s hex pubkey, or `local` for the command inside the instance) and by `since` (the entries made at that time or after). The filters combine.',
  ].join('\n\n'),
  inputs: {
    node: { schema: { type: 'string', pattern: KEY_PATTERN }, description: 'A tapestryKey: only the entries whose changes name that node' },
    by: { schema: { type: 'string', pattern: '^([0-9a-f]{64}|local)$' }, description: 'Who made them: a hex pubkey, or local for the command inside the instance' },
    since: { schema: { type: 'string', pattern: TIME_PATTERN }, description: 'An ISO 8601 UTC time, such as 2026-11-14T09:30:00Z: only the entries made then or after' },
    limit: { schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 }, description: 'How many entries a page holds, 1 to 200' },
    cursor: { schema: { type: 'string', minLength: 1 }, description: 'The cursor the last page answered, for the next page' },
  },
  result: {
    description: 'A page of change entries, newest first, and the cursor for the next page (null on the last)',
    schema: {
      type: 'object',
      required: ['entries', 'cursor'],
      properties: {
        entries: { type: 'array', items: ENTRY },
        cursor: { type: 'string', nullable: true, description: 'Pass it as cursor for the next page; null on the last' },
      },
    },
  },
  refusals: [{ code: 'invalid-cursor', status: 400, when: 'A cursor that is not one graph history gave' }],

  async run(inputs) {
    return readHistory((cypher, params) => graph.read(cypher, params), inputs);
  },
};
