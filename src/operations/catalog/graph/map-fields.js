'use strict';
/**
 * graph map-fields — bring a concept's elements in line with its marked fields (story graph-operations-foundation #5,
 * AC5; ADR graph-operations-foundation/0005 Decision 8, Amendment 2.2 and 2.3).
 *
 * The catch-up for elements written by today's routes and the nostr import, which apply no mapping (D15). A write
 * through the write path, safe to repeat by concept. Every mark's copy is added, corrected or removed to match each
 * element's JSON, and every copy in the concept's namespace that no mark anywhere yields is removed: what a vanished
 * mark leaves behind (Decision 14). An element whose JSON can't be read is left exactly as it is. It refuses
 * not-installed, since with no concept for neo4j properties every <key>_ copy would look like one no mark yields.
 */

const { CHANGE_ENTRY } = require('../../changes');
const { refusal } = require('../../refusal');
const N = require('./_nodes');
const F = require('./_fields');

const COUNT = (description) => ({ type: 'integer', minimum: 0, description });

module.exports = {
  group: 'graph',
  name: 'map-fields',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Bring a concept's elements in line with its marked fields",
  description: [
    "For the concept whose header's tapestryKey is `concept`, makes each current element carry exactly what its marked fields say: a missing copy is added, a stale one corrected, and one whose field the element's JSON no longer gives a value is removed. A copy in the concept's namespace, `<concept key>_…`, that no mark anywhere yields is removed too, such as one left by a field that has left the schema.",
    "This is how elements written by today's routes or brought in by the nostr import come into line, since neither applies the mapping. An element whose JSON can't be read is left as it is and listed under `skipped`. It writes only what differs, records one entry naming the nodes that changed, and records nothing when nothing did. A call handles at most 10,000 elements.",
  ].join('\n\n'),
  inputs: {
    concept: N.keyInput("The tapestryKey of the concept's header"),
  },
  result: {
    description: "The concept, its marks' property names, how many elements got a copy added or corrected, lost one, or were left alone, the elements whose value could not be carried, and the change entry this call recorded (null when it changed nothing)",
    schema: {
      type: 'object',
      required: ['concept', 'marks', 'set', 'removed', 'unchanged', 'skipped', 'change'],
      properties: {
        concept: { type: 'string', description: "The tapestryKey of the concept's header" },
        marks: { type: 'array', items: { type: 'string' }, description: "The property names of the concept's marked fields" },
        set: COUNT('How many elements got at least one copy added or corrected'),
        removed: COUNT('How many elements lost at least one copy'),
        unchanged: COUNT('How many elements it wrote nothing to, the skipped ones included'),
        skipped: F.SKIPPED,
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [F.NOT_INSTALLED, F.UNKNOWN_CONCEPT, F.TOO_MANY_ELEMENTS],
  guards: [],
  repeatKey: ['concept'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    if (!(await F.firstSetOf(read))) throw refusal('not-installed', F.say.notInstalled());
    const concept = await F.conceptOf(read, inputs.concept);
    if (!concept) throw refusal('unknown-concept', F.say.unknownConcept(inputs.concept), { input: 'concept' });
    const mapped = await F.mapConcept(tx, concept, { strays: true });
    const set = new Set(Object.values(mapped.set).flat());
    const removed = new Set(Object.values(mapped.removed).flat());
    const touched = new Set([...set, ...removed]);
    return {
      data: {
        concept: concept.key,
        marks: mapped.marks.map((m) => m.property).sort(),
        set: set.size,
        removed: removed.size,
        unchanged: mapped.elements - touched.size,
        skipped: mapped.skipped,
      },
      changes: F.copyChanges(mapped),
    };
  },
};
