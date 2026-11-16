'use strict';
/**
 * A tapestryKey on every node (story graph-operations-foundation #3, ADR graph-operations-foundation/0003).
 *
 * Every node carries the label TapestryNode and a tapestryKey, a random v4 UUID set once and never changed (BIBLE §29,
 * design D6). Neo4j 5 Community enforces uniqueness only per label, so the rule tapestry_key holds the keys of every
 * TapestryNode node, and tapestry_node_uuid indexes their addresses. `lifecycle migrate --migration tapestry-keys`
 * makes both (ADR Decision 1).
 *
 * keyNode(v) is the Cypher fragment each statement that makes a node puts after the clause that makes it, in the same
 * statement (Decision 8). It gives the node the label and a key only where either is missing, so a statement that
 * touches the same node again writes nothing, and a node that has no key gets one. Shell scripts and APOC command files
 * carry the same text written out. test/operations/lifecycle/tapestry-key-paths.test.js checks every path.
 */

const LABEL = 'TapestryNode';
const KEY_RULE = 'tapestry_key';
const UUID_INDEX = 'tapestry_node_uuid';
const VARIABLE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** The fragment that gives node variable `v` the label and a key where either is missing. */
function keyNode(v) {
  if (typeof v !== 'string' || !VARIABLE.test(v)) throw new Error(`keyNode: ${JSON.stringify(v)} is not a Cypher variable name`);
  return `FOREACH (_ IN CASE WHEN NOT ${v}:${LABEL} OR ${v}.tapestryKey IS NULL OR ${v}.tapestryKey = '{}' THEN [1] ELSE [] END |
    SET ${v}:${LABEL},
        ${v}.tapestryKey = CASE WHEN ${v}.tapestryKey IS NULL OR ${v}.tapestryKey = '{}' THEN randomUUID() ELSE ${v}.tapestryKey END)`;
}

module.exports = { keyNode, LABEL, KEY_RULE, UUID_INDEX };
