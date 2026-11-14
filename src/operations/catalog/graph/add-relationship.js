'use strict';
/**
 * graph add-relationship — a typed relationship between two nodes, of a type the graph declares (catalog §2; story
 * graph-operations-foundation #4, AC1 and AC2; ADR graph-operations-foundation/0004 Decision 7).
 *
 * A write through the write path (src/operations/write.js): its guard is relationship-type-allowed, it is safe to
 * repeat by from, to and type, it records a change entry when it adds the relationship, and it signs nothing.
 */

const { CHANGE_ENTRY } = require('../../changes');
const N = require('./_nodes');

module.exports = {
  group: 'graph',
  name: 'add-relationship',
  kind: 'write',
  access: 'owner-and-admins',
  summary: 'A typed relationship between two nodes, of a type the graph declares',
  description: [
    'Adds one relationship of `type` from the node `from` to the node `to`, each named by its tapestryKey. Called again with the same three, it adds nothing, records nothing and answers `already-there`.',
    '`type` must be a relationship type the graph declares, as an element of its relationship type concept (`39998:<TA>:relationship-type`), and not one reserved for another operation or the nostr import: the class threads, a concept\'s core-node wiring, the property tree, and what the import and the instance\'s pipelines make (today, every type firmware makes). Declare a type before adding relationships of it.',
  ].join('\n\n'),
  inputs: {
    from: N.keyInput('The tapestryKey of the node the relationship runs from'),
    to: N.keyInput('The tapestryKey of the node it runs to'),
    type: N.typeInput('Its type, as the graph declares it (letters, digits and underscores, starting with a letter), such as CITES'),
  },
  result: {
    description: 'The relationship, whether it was added or already there, and the change entry this call recorded (null when it changed nothing)',
    schema: {
      type: 'object',
      required: ['relationship', 'outcome', 'change'],
      properties: {
        relationship: N.RELATIONSHIP,
        outcome: { type: 'string', enum: ['added', 'already-there'], description: 'added, or already-there when it was there before this call' },
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
    // `type` matched TYPE_PATTERN and passed the guard, so it is a plain name the graph declares.
    const { counters } = await ctx.tx.run(
      `MATCH (a:TapestryNode {tapestryKey: $from}) WHERE NOT a:GraphChange
       MATCH (b:TapestryNode {tapestryKey: $to}) WHERE NOT b:GraphChange
       MERGE (a)-[r:\`${type}\`]->(b)
       RETURN count(r) AS n`,
      { from, to },
    );
    const added = counters.relationshipsCreated > 0;
    return {
      data: { relationship: { type, from, to }, outcome: added ? 'added' : 'already-there' },
      changes: added ? [{ change: 'relationship-added', type, from, to }] : [],
    };
  },
};
