'use strict';
/**
 * graph unmark-field — take a concept's field out of the Neo4j properties its elements carry, and remove the copies
 * (story graph-operations-foundation #5, AC4; ADR graph-operations-foundation/0005 Decision 9, Amendment 2.4 and 2.5).
 *
 * A write through the write path, with no guard: unmarking breaks no rule. It deletes only the mark's edge from the set
 * of neo4j properties that are also fields, never the property concept's edge to the node (D9), and removes the
 * property from every current element of the concept that carries it, whether or not that element's JSON can be read:
 * it needs no JSON to do that (Amendment 2.2 is about the mapping). No other concept's copy has this name (Decision 4).
 */

const { CHANGE_ENTRY } = require('../../changes');
const { refusal } = require('../../refusal');
const N = require('./_nodes');
const F = require('./_fields');

const FIELD_PATTERN = '^[A-Za-z][A-Za-z0-9_]{0,63}$';
const UNKNOWN_FIELD = Object.freeze({ ...F.UNKNOWN_FIELD, when: "A field that is neither one of the concept's top-level fields nor has a property node in its property tree" });

module.exports = {
  group: 'graph',
  name: 'unmark-field',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Unmark a concept's field, and remove its copies from the concept's elements",
  description: [
    "Takes the `field` of the concept whose header's tapestryKey is `concept` out of the set of neo4j properties that are also fields, and removes the property `<concept key>_<field>` from every current element of the concept that carries it. The field's property node stays an element of the property concept.",
    'Called again, or for a field that was never marked, it changes nothing, records nothing and answers `already-unmarked`. A field that has left the schema but still has its property node can be unmarked too. A call handles at most 10,000 elements.',
  ].join('\n\n'),
  inputs: {
    concept: N.keyInput("The tapestryKey of the concept's header"),
    field: { schema: { type: 'string', pattern: FIELD_PATTERN }, required: true, description: 'The marked field, such as breed' },
  },
  result: {
    description: 'The mark, whether it was taken out or already gone, how many elements it cleared, and the change entry this call recorded (null when it changed nothing)',
    schema: {
      type: 'object',
      required: ['mark', 'outcome', 'cleared', 'change'],
      properties: {
        mark: F.MARK,
        outcome: { type: 'string', enum: ['unmarked', 'already-unmarked'], description: 'unmarked, or already-unmarked when the field was not marked' },
        cleared: { type: 'integer', minimum: 0, description: 'How many elements no longer carry the property' },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [F.UNKNOWN_CONCEPT, UNKNOWN_FIELD, F.TOO_MANY_ELEMENTS],
  guards: [],
  repeatKey: ['concept', 'field'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    const concept = await F.conceptOf(read, inputs.concept);
    if (!concept) throw refusal('unknown-concept', F.say.unknownConcept(inputs.concept), { input: 'concept' });
    const node = await F.propertyNodeOf(read, concept, inputs.field);
    if (!node && !Object.prototype.hasOwnProperty.call(concept.fields, inputs.field)) {
      throw refusal('unknown-field', F.say.unknownField(concept, inputs.field, { node: true }), { input: 'field' });
    }
    const property = concept.oKey ? F.propertyName(concept.oKey, inputs.field) : null;
    const mark = { concept: concept.key, field: inputs.field, property, node };
    const marked = node ? (await F.marksOf(read, { concept: concept.key })).some((m) => m.node === node) : false;
    const set = marked ? await F.firstSetOf(read) : null;
    if (!marked || !set) return { data: { mark, outcome: 'already-unmarked', cleared: 0 }, changes: [] };
    const elements = await F.elementsOf(read, concept, F.MAX_ELEMENTS + 1);
    if (elements.length > F.MAX_ELEMENTS) throw F.tooManyElements(concept);
    await tx.run(
      `MATCH (s:TapestryNode {tapestryKey: $set})-[r:${F.markType()}]->(p:TapestryNode {tapestryKey: $node})
       WHERE NOT s:GraphChange AND NOT p:GraphChange
       DELETE r
       RETURN count(r) AS removed`,
      { set: set.key, node },
    );
    const carriers = elements.filter((e) => e.copies[property] !== undefined).map((e) => e.key).sort();
    await F.writeCopies(tx, carriers.map((key) => ({ key, props: { [property]: null } })));
    const changes = [{ change: 'field-unmarked', node, concept: concept.key, field: inputs.field, property }];
    if (carriers.length) changes.push({ change: 'copies-removed', property, nodes: carriers, count: carriers.length });
    return { data: { mark, outcome: 'unmarked', cleared: carriers.length }, changes };
  },
};
