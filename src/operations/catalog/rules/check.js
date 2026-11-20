'use strict';
/**
 * rules check — run the rules over a node, a concept or the whole graph (catalog §4; story
 * graph-operations-first-slice #45, ADR graph-operations-first-slice/0045 Decision 5 and Amendment 1).
 *
 * A read. It runs each rule that declares a scan (today, property-has-one-parent), judges what the scan lists with the
 * rule's own violations, and pages the findings by the node's tapestryKey, then by rule. Each finding has an id, which
 * rules repair takes. It changes nothing and records nothing.
 */

const graph = require('../../graph');
const R = require('../../reads');
const X = require('./_rules');

module.exports = {
  group: 'rules',
  name: 'check',
  kind: 'read',
  access: 'owner-and-admins',
  summary: 'Run the rules over a node, a concept or the whole graph, and name what breaks them, with the repair for each',
  description: [
    "Runs the rules over `scope`: `graph` for the whole graph; a concept header's tapestryKey for that concept, its primary property, its property tree and what hangs on its JSON schema node; or any other node's tapestryKey for that node. `rules` names which to run; left out, every rule the check can run. Today that is property-has-one-parent; a rule with no scan yet is refused (`not-checkable`), and A10.31 will run the rest.",
    "Each finding comes as { id, rule, code, message, node, primary, concepts, parents, fix, choice }: the node and the concepts whose trees hold it, each parent with what it is (`kind`), the concept it belongs to and whether that is the node's own, and either `fix`, what `rules repair` would do, or `choice`, why nothing is planned and how to go on. Pass a finding's `id` to `rules repair` as `violation`. The id changes when the node's parents do.",
    'Every author\'s nodes are judged, whoever made them. Up to `limit` findings a page, by the node\'s tapestryKey, then by rule; pass the answer\'s `cursor` for the next page, null on the last. Every page runs the check again, so a change to the graph between pages can add or take away a finding. It changes nothing and records nothing.',
  ].join('\n\n'),
  inputs: {
    scope: X.SCOPE_INPUT,
    rules: X.RULES_INPUT,
    limit: R.LIMIT_INPUT,
    cursor: R.CURSOR_INPUT,
  },
  result: {
    description: 'The scope, the rules run, how many items were judged and how many findings there are, a page of the findings, and the cursor for the next page (null on the last)',
    schema: {
      type: 'object',
      required: ['scope', 'rules', 'judged', 'found', 'violations', 'cursor'],
      properties: {
        scope: { type: 'object', description: '{ kind: graph | concept | node, tapestryKey, name }' },
        rules: { type: 'array', items: { type: 'string' }, description: 'The rules run' },
        judged: { type: 'integer', minimum: 0, description: 'How many items the rules judged, across all pages' },
        found: { type: 'integer', minimum: 0, description: 'How many findings there are, across all pages' },
        violations: { type: 'array', items: X.FINDING },
        cursor: { type: 'string', nullable: true },
      },
    },
  },
  refusals: [X.UNKNOWN_SCOPE, X.UNKNOWN_RULE, X.NOT_CHECKABLE, R.INVALID_CURSOR],

  async run(inputs) {
    const limit = inputs.limit;
    if (!Number.isInteger(limit) || limit < 1) throw new Error(`rules check's limit must be a whole number from 1; got ${JSON.stringify(limit)}`);
    const read = (cypher, params) => graph.read(cypher, params);
    const rules = X.rulesNamed(inputs.rules);
    const scope = await X.scopeOf(read, inputs.scope);
    const names = rules.map((r) => r.name);
    const fingerprint = R.scopeOf([inputs.scope, [...names].sort()]);
    const isPosition = (p) => Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && typeof p[1] === 'string';
    const after = inputs.cursor === undefined ? null : R.decodeCursor('rules check', fingerprint, inputs.cursor, isPosition);
    const { judged, findings } = await X.findingsIn(read, scope, rules);
    const all = findings.map(({ rule, finding }) => X.answerOf(rule, finding));
    const past = after === null ? all : all.filter((f) => f.node.tapestryKey > after[0] || (f.node.tapestryKey === after[0] && f.rule > after[1]));
    const page = R.pageOf(past, limit, (f) => R.encodeCursor('rules check', fingerprint, [f.node.tapestryKey, f.rule]));
    return {
      scope: scope.kind === 'graph' ? { kind: 'graph' } : { kind: scope.kind, tapestryKey: scope.key, name: scope.name },
      rules: names,
      judged,
      found: all.length,
      violations: page.items,
      cursor: page.cursor,
    };
  },
};
