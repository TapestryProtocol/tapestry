'use strict';
/**
 * element-fits-schema: a node's fully realized tapestryJson fits the JSON schema of each concept it is an element of
 * (BIBLE §10, rule 4; the owner's D9; ADR graph-operations-first-slice/0020a). Story graph-operations-first-slice #20,
 * AC3 and AC7, and #42; ADR graph-operations-first-slice/0020 Decision 12, and 0042 Decisions 2 and 3. Its entry in the
 * rules document is §7 of docs/GRAPH_RULES.md, and the check it uses is src/operations/catalog/graph/_schemas.js, which
 * the derive step uses too, so the two give one verdict.
 *
 * Its items are one of two:
 *   { concept, json }           the JSON a write is about to store, judged against that concept's schema: graph
 *                               create-element's, run in its apply once it has built the JSON (its guard's items are
 *                               empty: the JSON comes from the graph), and the later element writes' (Decision 16).
 *                               The problems only about graphContext, which the derive step builds after the write, are
 *                               set aside, so a write is never refused for them (ADR 0042 Decision 3). A key that names
 *                               no concept header has no finding: the operation's own refusal answers for it. With
 *                               { concept, json, record }, the write is to a node that carries lifecycle
 *                               seed-firmware's install record: the sections record names (cameFrom, installed) are
 *                               set aside too, as the derive and the node form set them aside (ADR
 *                               graph-operations-first-slice/0037 Amendment 3, item 6; review round 2, R2-N1).
 *   { node } or { node, concept }  a node as it stands: its tapestryJson, from the tapestry-store, judged against the
 *                               schema of each concept whose class thread reaches it, or of the one named, with nothing
 *                               set aside but the install record's sections the node carries (E4): one finding for
 *                               each concept it doesn't fit, and one no-schema finding for
 *                               each concept with no usable schema. A node with no tapestryJson is one invalid-fields
 *                               finding, marked missing, and tapestryJson that isn't an object is one invalid-fields
 *                               finding (ADR 0042 Decision 2). A node no concept reaches has none: that is rule 3's
 *                               business. rules check (A10.31) and the property operations' reports (A10.18) use this
 *                               form.
 * Within one call, each concept's schema is read and compiled once.
 */

const NAME = 'element-fits-schema';

/** E4: a node's name and address, for messages; no row when no node has the key (ADR 0042 Decision 2). */
// cameFrom and installed: lifecycle seed-firmware's install record, whose sections the judge sets aside only for a node
// that carries it, as the derive's verdicts do (ADR graph-operations-first-slice/0037 Amendment 3, item 6).
const E4 = `MATCH (e:TapestryNode {tapestryKey: $key})
  WHERE NOT e:GraphChange
  RETURN e.name AS name, e.uuid AS uuid, e.cameFrom AS cameFrom, e.installed AS installed`;

const nodeLabel = (row, key) => {
  const name = row && typeof row.name === 'string' && row.name ? row.name : null;
  const where = row && typeof row.uuid === 'string' && row.uuid ? row.uuid : key;
  return name ? `"${name}" (${where})` : where;
};
const noSchema = (problem) => `${problem}, so no element's JSON can be checked against its concept's schema (BIBLE §10, rule 4).`;

module.exports = {
  name: NAME,
  summary: "A node's fully realized tapestryJson fits the JSON schema of each concept it is an element of (BIBLE §10, rule 4)",
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
        // Its tapestryJson, never its json tag (ADR 0042 Decision 2): one finding when there is none to judge.
        const t = X.tapestryJsonOf(item.node);
        if (t.problem) {
          out.push({ item, code: 'invalid-fields', ...(t.missing ? { missing: true } : {}), message: `${label}'s tapestryJson can't be checked against its concepts' schemas: ${t.problem}.` });
          continue;
        }
        // A finding says when the tapestryJson it judged was built, when it says (ADR 0020a Decision 5): an entry built
        // before a change is judged as it is. Anyone's letter can put an entry in, so a derivedAt no Date can hold is
        // given as the number alone, never thrown on.
        const gc = t.json.graphContext;
        const derivedAt = gc && typeof gc === 'object' && Number.isFinite(gc.derivedAt) ? gc.derivedAt : undefined;
        const built = derivedAt === undefined ? {} : { derivedAt };
        const at = derivedAt === undefined ? null : new Date(derivedAt * 1000);
        const when = !at ? ''
          : Number.isNaN(at.getTime()) ? ` Its tapestryJson gives ${derivedAt} as the time it was built, which no date can hold.`
            : ` Its tapestryJson was built at ${at.toISOString()}.`;
        const record = X.recordCarried(rows[0]);
        for (const concept of concepts) {
          const r = await j.check(concept, t.json, { record });
          if (r.header === false) continue;
          if (r.fits === null) out.push({ item, concept, code: 'no-schema', ...built, message: noSchema(r.problem) });
          else if (!r.fits) out.push({ item, concept, code: 'invalid-fields', problems: r.problems, ...built, message: `${label} doesn't fit the JSON schema of ${r.label}: ${X.listProblems(r.problems)}.${when}` });
        }
        continue;
      }
      if (typeof item.concept !== 'string' || !item.concept) continue;
      // A write's JSON: the problems only about graphContext are set aside (ADR 0042 Decision 3), and the install
      // record's sections the item's record names, those its node carries (ADR 0037 Amendment 3 item 6; R2-N1).
      const r = await j.check(item.concept, item.json, { writing: true, record: Array.isArray(item.record) ? item.record : [] });
      if (r.header === false) continue;
      if (r.fits === null && !r.waiting) out.push({ item, concept: item.concept, code: 'no-schema', message: noSchema(r.problem) });
      else if (r.fits === false) out.push({ item, concept: item.concept, code: 'invalid-fields', problems: r.problems, message: `The element's JSON doesn't fit the JSON schema of ${r.label}: ${X.listProblems(r.problems)}.` });
    }
    return out;
  },
};
