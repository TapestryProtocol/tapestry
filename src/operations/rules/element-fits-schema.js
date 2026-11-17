'use strict';
/**
 * element-fits-schema: an element's JSON fits the JSON schema of each concept it belongs to (BIBLE §10, rule 4; the
 * owner's D9). Story graph-operations-first-slice #20, AC3 and AC7; ADR graph-operations-first-slice/0020 Decision 12.
 * Its entry in the rules document is §7 of docs/GRAPH_RULES.md, and the check it uses is
 * src/operations/catalog/graph/_schemas.js, which reads a schema as the derive step does.
 *
 * Its items are one of two:
 *   { concept, json }           the JSON a write is about to store, judged against that concept's schema: graph
 *                               create-element's, run in its apply once it has built the JSON (its guard's items are
 *                               empty: the JSON comes from the graph), and the later element writes' (Decision 16).
 *                               A key that names no concept header has no finding: the operation's own refusal
 *                               answers for it.
 *   { node } or { node, concept }  an element as it stands, read from its json tag (E4), judged against the schema of
 *                               each concept whose class thread reaches it, or of the one named: one finding for each
 *                               concept it doesn't fit, and one no-schema finding for each concept with no usable
 *                               schema. JSON that can't be read is one invalid-fields finding. A node no concept
 *                               reaches has none: that is rule 3's business. rules check (A10.31) and the property
 *                               operations' reports (A10.18) use this form.
 * Within one call, each concept's schema is read and compiled once.
 */

const NAME = 'element-fits-schema';

/** E4: an element's JSON, with its name and address for messages; no row when no node has the key. */
const E4 = `MATCH (e:TapestryNode {tapestryKey: $key})
  WHERE NOT e:GraphChange
  OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'})
  RETURN e.name AS name, e.uuid AS uuid, head(collect(t.value)) AS json`;

const nodeLabel = (row, key) => {
  const name = row && typeof row.name === 'string' && row.name ? row.name : null;
  const where = row && typeof row.uuid === 'string' && row.uuid ? row.uuid : key;
  return name ? `"${name}" (${where})` : where;
};
const noSchema = (problem) => `${problem}, so no element's JSON can be checked against its concept's schema (BIBLE §10, rule 4).`;

module.exports = {
  name: NAME,
  summary: "An element's JSON fits the JSON schema of each concept it belongs to (BIBLE §10, rule 4)",
  refuses: true,
  refusals: [
    { code: 'invalid-fields', status: 400, when: "The element's JSON doesn't fit its concept's JSON schema; the refusal lists every problem, each naming the field and what is wrong, at most 20 and then how many more" },
    { code: 'no-schema', status: 409, when: "The concept's JSON schema is missing, can't be read, or doesn't compile, so nothing could be checked; the refusal says why" },
  ],

  async violations(items, read) {
    const list = Array.isArray(items) ? items.filter((i) => i && typeof i === 'object' && !Array.isArray(i)) : [];
    if (!list.length) return [];
    // Required here, not at load: the rules' loader opens nothing (ADR graph-operations-foundation/0004 Decision 4).
    const X = require('../catalog/graph/_schemas');
    const F = require('../catalog/graph/_fields');
    const j = X.judge(read);
    const out = [];
    for (const item of list) {
      if (typeof item.node === 'string' && item.node) {
        const concepts = typeof item.concept === 'string' && item.concept
          ? [item.concept]
          : [...new Set((await F.conceptsOfNodes(read, [item.node])).map((r) => r.concept))].sort();
        if (!concepts.length) continue;
        const rows = await read(E4, { key: item.node });
        if (!rows.length) continue;
        const label = nodeLabel(rows[0], item.node);
        const { json, problem } = F.readJson(rows[0].json);
        if (problem) {
          out.push({ item, code: 'invalid-fields', message: `${label}'s JSON can't be checked against its concepts' schemas: ${problem}.` });
          continue;
        }
        for (const concept of concepts) {
          const r = await j.check(concept, json);
          if (r.header === false) continue;
          if (r.fits === null) out.push({ item, concept, code: 'no-schema', message: noSchema(r.problem) });
          else if (!r.fits) out.push({ item, concept, code: 'invalid-fields', problems: r.problems, message: `${label} doesn't fit the JSON schema of ${r.label}: ${X.listProblems(r.problems)}.` });
        }
        continue;
      }
      if (typeof item.concept !== 'string' || !item.concept) continue;
      const r = await j.check(item.concept, item.json);
      if (r.header === false) continue;
      if (r.fits === null) out.push({ item, concept: item.concept, code: 'no-schema', message: noSchema(r.problem) });
      else if (!r.fits) out.push({ item, concept: item.concept, code: 'invalid-fields', problems: r.problems, message: `The element's JSON doesn't fit the JSON schema of ${r.label}: ${X.listProblems(r.problems)}.` });
    }
    return out;
  },
};
