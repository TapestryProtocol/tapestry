'use strict';
/**
 * The derive step's schema verdicts, graphContext.parentJsonSchemas, as the rule element-fits-schema gives them (story
 * graph-operations-first-slice #42, AC3; ADR graph-operations-first-slice/0042 Decision 5). A concept's JSON Schema
 * describes a node's tapestryJson (ADR 0020a), so the derive step judges the tapestryJson it builds, through the one
 * check the rule uses, src/operations/catalog/graph/_schemas.js:
 *   - against the concepts the rule judges: each concept whose class thread reaches the node (_fields.js
 *     conceptsOfNodes), a ConceptHeader or a ListHeader, at any depth, and no header a z tag names, since membership is
 *     the edges (D10);
 *   - with nothing set aside, since it judges the whole tapestryJson, its graphContext built;
 *   - in today's entry shape, one entry for each JSON schema node of those concepts: { uuid, tapestryKey } of the schema
 *     node, { conceptName, conceptTapestryKey } of the concept, lastValidated, valid (the check's fits: null when the
 *     schema can't be checked) and errors (the rule's problems in its words, or its one problem). A concept with more
 *     than one schema node gets one entry for each, valid null; a concept with no schema node gets none, the list being
 *     of schemas.
 * The cache's copy is dated by lastValidated; the rule decides when it is asked (ADR 0020a Decision 7).
 *
 *   schemaVerdicts({ tapestryKey, json, judge?, read?, now }) → parentJsonSchemas
 *   readOverRunCypher()           a read, (cypher, params) → rows, made from the driver's runCypher
 *
 * It opens nothing when it loads: _schemas.js, _fields.js and the driver are required when first called. A derive pass
 * passes one judge for all its nodes, so each schema is read and compiled once a pass (Decision 6).
 */

/** A read for _schemas.js and _fields.js, which only read through it, made from runCypher: the derive step has no transaction. */
function readOverRunCypher() {
  const { runCypher } = require('../neo4j-driver');
  return (cypher, params) => runCypher(cypher, params);
}

async function schemaVerdicts({ tapestryKey, json, judge = null, read = null, now }) {
  const X = require('../../operations/catalog/graph/_schemas');
  const F = require('../../operations/catalog/graph/_fields');
  const r = read || readOverRunCypher();
  const j = judge || X.judge(r);
  const concepts = [...new Set((await F.conceptsOfNodes(r, [tapestryKey])).map((row) => row.concept))].sort();
  const entries = [];
  for (const concept of concepts) {
    const c = await j.check(concept, json);
    if (c.header === false) continue;
    const nodes = Array.isArray(c.nodes) ? c.nodes : [];
    if (!nodes.length) continue;
    const errors = c.fits === true ? [] : c.fits === null ? [c.problem] : c.problems.map((p) => p.message);
    for (const n of nodes) {
      entries.push({
        ...(typeof n.uuid === 'string' ? { uuid: n.uuid } : {}),
        tapestryKey: n.tapestryKey,
        conceptName: c.name || c.label || concept,
        conceptTapestryKey: concept,
        lastValidated: now,
        valid: c.fits,
        errors,
      });
    }
  }
  return entries;
}

module.exports = { schemaVerdicts, readOverRunCypher };
