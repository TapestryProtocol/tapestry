'use strict';
/**
 * graph remove-relationship — remove a typed relationship between two nodes (catalog §2; story
 * graph-operations-foundation #4, AC3; ADR graph-operations-foundation/0004 Decision 7).
 *
 * A write through the write path, held to the same rule as add-relationship, so it can't remove a class-thread edge,
 * a concept's core-node wiring or anything the import made. It removes every relationship of the type from one node
 * to the other, since older paths could have made two, and counts them in its change entry.
 */

const { CHANGE_ENTRY } = require('../../changes');
const N = require('./_nodes');

module.exports = {
  group: 'graph',
  name: 'remove-relationship',
  kind: 'write',
  access: 'owner-and-admins',
  summary: 'Remove a typed relationship between two nodes',
  description: [
    'Removes the relationship of `type` from the node `from` to the node `to`, each named by its tapestryKey: every one there is, with their count in the change entry. Called again, it changes nothing, records nothing and answers `already-gone`.',
    '`type` is held to the same rule as `graph add-relationship`: a type the graph declares, and not one reserved for another operation or the nostr import.',
  ].join('\n\n'),
  inputs: {
    from: N.keyInput('The tapestryKey of the node the relationship runs from'),
    to: N.keyInput('The tapestryKey of the node it runs to'),
    type: N.typeInput('Its type, as the graph declares it, such as CITES'),
  },
  result: {
    description: 'The relationship, whether it was removed or already gone, and the change entry this call recorded (null when it changed nothing)',
    schema: {
      type: 'object',
      required: ['relationship', 'outcome', 'change'],
      properties: {
        relationship: N.RELATIONSHIP,
        outcome: { type: 'string', enum: ['removed', 'already-gone'], description: 'removed, or already-gone when there was none' },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [N.UNKNOWN_NODE],
  guards: [{ rule: 'relationship-type-allowed', items: (inputs) => [{ type: inputs.type, from: inputs.from, to: inputs.to }] }],
  repeatKey: ['from', 'to', 'type'],

  async apply(inputs, ctx) {
    const { from, to, type } = inputs;
    await N.requireNodes(ctx.tx, [['from', from], ['to', to]]);
    const { counters } = await ctx.tx.run(
      `MATCH (a:TapestryNode {tapestryKey: $from})-[r:\`${type}\`]->(b:TapestryNode {tapestryKey: $to})
       WHERE NOT a:GraphChange AND NOT b:GraphChange
       DELETE r
       RETURN count(r) AS removed`,
      { from, to },
    );
    const removed = counters.relationshipsDeleted;
    return {
      data: { relationship: { type, from, to }, outcome: removed ? 'removed' : 'already-gone' },
      changes: removed ? [{ change: 'relationship-removed', type, from, to, count: removed }] : [],
    };
  },
};
