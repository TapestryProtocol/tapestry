'use strict';
/**
 * graph mark-field — mark a concept's field, so its elements carry the field's value on their Neo4j nodes (story
 * graph-operations-foundation #5, AC2 and AC3; ADR graph-operations-foundation/0005 Decision 7).
 *
 * A write through the write path: its guard is field-mark-allowed, it is safe to repeat by concept and field, and it
 * signs nothing. The mark is one HAS_ELEMENT edge from the set of neo4j properties that are also fields to the field's
 * property node; on a new mark, every current element of the concept whose JSON gives the field a value carries it as
 * <concept key>_<field>, in the same transaction (_fields.js).
 */

const { CHANGE_ENTRY } = require('../../changes');
const N = require('./_nodes');
const F = require('./_fields');

const FIELD_PATTERN = '^[A-Za-z][A-Za-z0-9_]{0,63}$';

module.exports = {
  group: 'graph',
  name: 'mark-field',
  kind: 'write',
  access: 'owner-and-admins',
  summary: "Mark a concept's field, so its elements carry the field's value on their Neo4j nodes",
  description: [
    "Marks the top-level `field` of the concept whose header's tapestryKey is `concept`: its property node, in the concept's property tree, becomes an element of the set of neo4j properties that are also fields (`39999:<TA>:the-set-of-neo4j-properties-that-are-also-fields`). Each current element of the concept, its subsets' elements included, whose JSON gives the field a value then carries it on its node as the property `<concept key>_<field>`, such as `dog_breed`, so Cypher can filter on it: `MATCH (d:TapestryNode) WHERE d.dog_breed = 'goldenRetriever'`.",
    "Values come from each element's json tag. A string, a number, a boolean, or a list of one of them is copied as the JSON holds it; a number goes as an integer where the schema says integer and it is a safe integer. An empty list, a null or no value gives no property. An element whose JSON has no section for the concept, can't be read, or holds a value no Neo4j property can hold is listed under `skipped`, with the reason.",
    'The field must hold a plain value or a list of them, and have a property node: make the concept\'s property tree first with `POST /api/normalize/generate-property-tree`. One concept\'s mark yields one property name across the graph. Called again with the same two, it changes nothing, records nothing and answers `already-marked`; `graph map-fields` brings copies up to date after elements change. A call handles at most 10,000 elements.',
  ].join('\n\n'),
  inputs: {
    concept: N.keyInput("The tapestryKey of the concept's header"),
    field: { schema: { type: 'string', pattern: FIELD_PATTERN }, required: true, description: "One of the concept's top-level fields (letters, digits and underscores, starting with a letter), such as breed" },
  },
  result: {
    description: 'The mark, whether it was made or already there, how many elements carry the property now, the elements whose value could not be carried, and the change entry this call recorded (null when it changed nothing)',
    schema: {
      type: 'object',
      required: ['mark', 'outcome', 'carried', 'skipped', 'change'],
      properties: {
        mark: F.MARK,
        outcome: { type: 'string', enum: ['marked', 'already-marked'], description: 'marked, or already-marked when the mark was there before this call' },
        carried: { type: 'integer', minimum: 0, description: 'How many current elements of the concept carry the property now' },
        skipped: F.SKIPPED,
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [F.TOO_MANY_ELEMENTS],
  guards: [{ rule: 'field-mark-allowed', items: (inputs) => [{ concept: inputs.concept, field: inputs.field }] }],
  repeatKey: ['concept', 'field'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    // The guard has checked each of these in this transaction.
    const concept = await F.conceptOf(read, inputs.concept);
    const node = concept ? await F.propertyNodeOf(read, concept, inputs.field) : null;
    const set = await F.firstSetOf(read);
    if (!concept || !node || !set) throw new Error('the concept, the field\'s property node or the first set went missing after its guard passed');
    const elements = await F.elementsOf(read, concept, F.MAX_ELEMENTS + 1);
    if (elements.length > F.MAX_ELEMENTS) throw F.tooManyElements(concept);
    const property = F.propertyName(concept.oKey, inputs.field);
    const mark = { concept: concept.key, field: inputs.field, property, node };
    const { counters } = await tx.run(
      `MATCH (s:TapestryNode {tapestryKey: $set}) WHERE NOT s:GraphChange
       MATCH (p:TapestryNode {tapestryKey: $node}) WHERE NOT p:GraphChange
       MERGE (s)-[r:${F.markType()}]->(p)
       RETURN count(r) AS n`,
      { set: set.key, node },
    );
    if (!counters.relationshipsCreated) {
      // Already marked: it writes nothing else, and map-fields is the catch-up (Decision 7, step 5).
      const carried = elements.filter((e) => e.copies[property] !== undefined).length;
      return { data: { mark, outcome: 'already-marked', carried, skipped: [] }, changes: [] };
    }
    const mapped = await F.mapConcept(tx, concept, { fields: [inputs.field], elements });
    return {
      data: {
        mark,
        outcome: 'marked',
        carried: mapped.carried[property] || 0,
        skipped: mapped.skipped.map((s) => ({ node: s.node, reason: s.reason })),
      },
      changes: [{ change: 'field-marked', node, concept: concept.key, field: inputs.field, property }, ...F.copyChanges(mapped)],
    };
  },
};
