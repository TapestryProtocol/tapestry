'use strict';
/**
 * enumerated-value-allowed: each value of a field that an ENUMERATES ends at is tapestry:<tapestryKey>, naming an
 * element of the link's source concept that counts from the owner's point of view (story graph-operations-first-slice
 * #19, AC2 and AC3; ADR graph-operations-first-slice/0019 Decisions 6–8 and 13). Its entry in the rules document is
 * §10 of docs/GRAPH_RULES.md, and its two reads and its check are in src/operations/catalog/graph/_enumerations.js,
 * which graph enumerate's report on a concept's elements uses too.
 *
 * Its items are { concept, json }: the JSON a write is about to store, as rule 4's write form takes it. graph
 * create-element, update-node and add-to-concept run it in apply, right after rule 4, over the same items, once they
 * hold their locks (their guards' items are empty: the JSON comes from the graph). For each concept of the items, its
 * first read finds the concept's enumerated properties, each by its chain of IS_A_PROPERTY_OF through property nodes
 * to the concept's primary property; a concept with none costs that read alone. Its second read judges every
 * reference the items hold, all in one UNWIND: whether its key names a node, whether the source's class thread reaches
 * that node, and whether it counts from the owner's point of view (reads.js's trust test, ADR 0011). A list is judged
 * item by item; a null, as a field's value or as an item of a list, and a field left out, aren't judged. The allowed
 * values are the source's elements as they are
 * when a write is checked, so the rule takes no lock and keeps nothing (Decision 8).
 */

const NAME = 'enumerated-value-allowed';

module.exports = {
  name: NAME,
  summary: "Each value of a field an ENUMERATES ends at is tapestry:<tapestryKey>, naming an element of the link's source concept that counts from the owner's point of view",
  refuses: true,
  refusals: [
    { code: 'value-not-allowed', status: 400, when: "The element's JSON holds, at a field a link makes enumerated, a value that isn't tapestry:<tapestryKey> of an element of the link's source concept from the owner's point of view: not a reference, a key that names no node, or a node the source doesn't hold, or doesn't hold from that point of view. The refusal names the field, each value and why, the source concept by name and key, and the way on: graph resolve, graph list-elements on the source, or graph create-element there" },
  ],

  async violations(items, read) {
    const list = Array.isArray(items) ? items.filter((i) => i && typeof i === 'object' && !Array.isArray(i) && typeof i.concept === 'string' && i.concept) : [];
    if (!list.length) return [];
    // Required here, not at load: the rules' loader opens nothing (ADR graph-operations-foundation/0004 Decision 4).
    const E = require('../catalog/graph/_enumerations');
    const R = require('../reads');
    const fields = new Map();
    for (const concept of new Set(list.map((i) => i.concept))) fields.set(concept, await E.enumeratedFieldsOf(read, concept));
    if (![...fields.values()].some((f) => f.length)) return [];
    const pov = await R.resolvePov(read, 'owner');
    return E.check(read, list, { fields, pov });
  },
};
