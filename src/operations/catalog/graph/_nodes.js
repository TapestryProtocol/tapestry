'use strict';
/**
 * What the graph writes share (story graph-operations-foundation #4, ADR graph-operations-foundation/0004 Decision 7):
 * the inputs that name a node by its tapestryKey (design D6) and a relationship by its type, and the one lookup every
 * write finds its nodes with. The lookup leaves change entries out, so no graph write can name one (Decision 5).
 * Requires nothing at load that opens anything (ADR 0001 Decision 10).
 */

const { refusal } = require('../../refusal');

const KEY_PATTERN = '^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$';
// Only a plain name ever reaches Cypher's text, in backticks: a relationship type can't be a parameter (Decision 6).
const TYPE_PATTERN = '^[A-Za-z][A-Za-z0-9_]{0,63}$';

const keyInput = (description) => ({ schema: { type: 'string', pattern: KEY_PATTERN }, required: true, description });
const typeInput = (description) => ({ schema: { type: 'string', pattern: TYPE_PATTERN }, required: true, description });

const UNKNOWN_NODE = Object.freeze({ code: 'unknown-node', status: 404, when: 'A from or to that names no node of the graph (a change entry is not one); the refusal names which' });

/** The relationship a write is about, as its answer and its schema give it. */
const RELATIONSHIP = Object.freeze({
  type: 'object',
  required: ['type', 'from', 'to'],
  properties: {
    type: { type: 'string', description: 'Its type' },
    from: { type: 'string', description: 'The tapestryKey of the node it runs from' },
    to: { type: 'string', description: 'The tapestryKey of the node it runs to' },
  },
});

/** Refuse unknown-node, naming the input, unless each of [input, tapestryKey] names a node of the graph. */
async function requireNodes(tx, wanted) {
  for (const [input, key] of wanted) {
    const rows = await tx.read('MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n.tapestryKey AS key LIMIT 1', { key });
    if (!rows.length) throw refusal('unknown-node', `No node of this graph has the tapestryKey ${key}, which ${input} names.`, { input });
  }
}

module.exports = { KEY_PATTERN, TYPE_PATTERN, keyInput, typeInput, UNKNOWN_NODE, RELATIONSHIP, requireNodes };
