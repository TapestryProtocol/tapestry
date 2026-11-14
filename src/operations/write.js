'use strict';
/**
 * The write path: every graph write's guards, its change and its change entry, in one transaction (story
 * graph-operations-foundation #4, ADR graph-operations-foundation/0004 Decision 3).
 *
 * For a declaration that applies (Decision 1), once its inputs are checked:
 *   1. it opens one write transaction through the graph seam (graph.js);
 *   2. it runs each guard: rule.violations(guard.items(inputs), tx.read). The first violation is thrown as the rule's
 *      refusal, with `rule`, so the transaction rolls back before anything is written;
 *   3. it calls apply(inputs, ctx), with ctx.tx the transaction. A refusal or failure there rolls back the same way;
 *   4. when apply's changes aren't empty, it writes their change entry (changes.js) in the same transaction;
 *   5. it commits, and answers apply's data with `change`: the entry, or null.
 * The change and its entry are kept together or not at all. The context carries nothing that signs or publishes
 * (Decision 10): graph writes never sign (design D1).
 */

const graph = require('./graph');
const { findRule } = require('./rules');
const { recordChange } = require('./changes');
const { refusal } = require('./refusal');

const CHANGE_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Run a write through the path; resolves the answer's data. */
async function applyWrite(op, inputs, context) {
  const decl = op.declaration;
  const operation = `${op.group} ${op.name}`;
  return graph.writeTransaction(async (tx) => {
    // Taken once per attempt: the driver runs this function again after a transient error.
    const at = new Date().toISOString();
    const read = (cypher, params) => tx.read(cypher, params);
    for (const g of decl.guards || []) {
      const rule = findRule(g.rule);
      if (!rule) throw new Error(`its guard names the rule ${g.rule}, which isn't loaded`);
      const found = await rule.violations(g.items(inputs), read);
      if (found && found.length) throw refusal(found[0].code, found[0].message, { rule: rule.name });
    }
    const out = await decl.apply(inputs, { ...context, tx });
    const changes = out && Array.isArray(out.changes) ? out.changes : [];
    for (const c of changes) {
      if (!c || !CHANGE_NAME.test(String(c.change))) throw new Error(`it answered a change with no kebab-case \`change\`: ${JSON.stringify(c)}`);
    }
    const data = out && out.data && typeof out.data === 'object' ? { ...out.data } : {};
    data.change = changes.length ? await recordChange(tx, { at, caller: context.caller, operation, changes }) : null;
    return data;
  });
}

module.exports = { applyWrite };
