'use strict';
/**
 * What rules check and rules repair share (catalog §4; story graph-operations-first-slice #45, ADR
 * graph-operations-first-slice/0045 Decisions 2 to 5).
 *
 *   SCOPE_INPUT, RULES_INPUT        the scope (graph, or a tapestryKey) and the rules to run
 *   scopeOf(read, scope)            the parsed scope, { kind, key?, name? } (Decision 4), or unknown-node
 *   rulesNamed(names)               the rules to run, each with a scan: every such rule when names is left out, else
 *                                   unknown-rule or not-checkable (Decision 5)
 *   findingsIn(read, scope, rules)  each rule's scan, then its violations → { judged, findings: [{ rule, finding }] },
 *                                   by the node's tapestryKey, then by rule
 *   idOf(rule, finding)             a finding's id, `<rule>:<node>:<12 hex>` (Decision 3)
 *   parseId(text)                   { rule, node, digest }, or unknown-violation
 *   answerOf(rule, finding)         a finding as check answers it
 *   the refusals both declare
 *
 * Like the other _*.js modules, it opens nothing when it loads, and its name starts with `_`, so the loader skips it.
 */

const crypto = require('crypto');
const { refusal } = require('../../refusal');
const { loadRules } = require('../../rules');
const N = require('../graph/_nodes');

const KEY_BODY = N.KEY_PATTERN.replace(/^\^/, '').replace(/\$$/, '');
const RULE_NAME = '^[a-z][a-z0-9]*(-[a-z0-9]+)*$';
const MAX_RULES = 20;

const SCOPE_INPUT = Object.freeze({
  schema: { type: 'string', pattern: `^(graph|${KEY_BODY})$` },
  required: true,
  description: "What to judge: graph for the whole graph; a concept header's tapestryKey for that concept (its primary property, its property tree and what hangs on its JSON schema node); any other node's tapestryKey for that node",
});
const RULES_INPUT = Object.freeze({
  schema: { type: 'array', items: { type: 'string', pattern: RULE_NAME }, minItems: 1, maxItems: MAX_RULES },
  description: `The rules to run, 1 to ${MAX_RULES}, one value for each (rules=<name>&rules=<name>, or --rules <name> --rules <name>); leave it out to run every rule the check can run`,
});

const D = (code, status, when) => Object.freeze({ code, status, when });
const UNKNOWN_SCOPE = D('unknown-node', 404, 'A scope that names no node of the graph: a change entry and a tag are not one; the refusal names the scope');
const UNKNOWN_RULE = D('unknown-rule', 400, 'A rule the rulebook\'s code holds none of; the refusal names it and the rules there are');
const NOT_CHECKABLE = D('not-checkable', 409, 'A rule the check can\'t run yet: it declares no scan (A10.31 runs the rest)');
const UNKNOWN_VIOLATION = D('unknown-violation', 400, 'A violation that isn\'t a finding\'s id, <rule>:<tapestryKey>:<12 hex digits>, as rules check gives one');
const CHANGED_SINCE_CHECK = D('changed-since-check', 409, "A violation whose node breaks the rule differently now than when it was checked: its parents changed. The refusal gives the finding's id as it is now, so check again");
const BAD_TARGET = D('bad-target', 400, 'Neither a violation nor a rule and a scope, or both: a repair takes one violation, or a rule and a scope together');
const FIRMWARE_CONCEPT = D('firmware-concept', 409, "A violation in a firmware concept, repaired only with firmwareOverride: true; the refusal names the concept");

const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const show = (x) => JSON.stringify(x);

/** The parsed scope (Decision 4). */
async function scopeOf(read, scope) {
  if (scope === 'graph') return { kind: 'graph' };
  const rows = await read('MATCH (n:TapestryNode {tapestryKey: $key}) RETURN labels(n) AS labels, coalesce(n.tapestryValue, n.name) AS name', { key: scope });
  const labels = rows.length && Array.isArray(rows[0].labels) ? rows[0].labels : null;
  if (!labels || labels.includes('GraphChange') || labels.includes('NostrEventTag')) {
    const what = !labels ? 'names no node of this graph' : labels.includes('GraphChange') ? 'names a change entry, which is part of the history, not of the graph' : "names a tag, which is part of a letter, not a node a rule judges";
    throw refusal(UNKNOWN_SCOPE.code, `The scope ${scope} ${what}. Pass graph, a concept header's tapestryKey or a node's. Nothing changed.`, { input: 'scope' });
  }
  const name = typeof rows[0].name === 'string' && rows[0].name ? rows[0].name : null;
  const concept = labels.includes('ConceptHeader') || labels.includes('ListHeader');
  return { kind: concept ? 'concept' : 'node', key: scope, name };
}

/** The rules to run: each a loaded rule with a scan (Decision 5). */
function rulesNamed(names, input = 'rules') {
  const all = loadRules().rules;
  if (names === undefined || names === null) return all.filter((r) => typeof r.scan === 'function');
  const out = [];
  for (const name of [...new Set(names)]) {
    const rule = all.find((r) => r.name === name);
    if (!rule) throw refusal(UNKNOWN_RULE.code, `There is no rule ${show(name)}. The rules are ${all.map((r) => r.name).join(', ')}. Nothing changed.`, { input });
    if (typeof rule.scan !== 'function') {
      const can = all.filter((r) => typeof r.scan === 'function').map((r) => r.name);
      throw refusal(NOT_CHECKABLE.code, `The rule ${name} can't be checked over the graph yet: it declares no scan. A10.31 will run it; today a check runs ${can.join(', ') || 'none'}. Nothing changed.`, { input });
    }
    out.push(rule);
  }
  return out;
}

/** Each rule's scan, then its violations, over `read` → { judged, findings: [{ rule, finding }] }. */
async function findingsIn(read, scope, rules) {
  let judged = 0;
  const findings = [];
  for (const rule of rules) {
    const items = await rule.scan(read, scope);
    judged += items.length;
    for (const finding of await rule.violations(items, read)) findings.push({ rule: rule.name, finding });
  }
  findings.sort((a, b) => byKey(nodeKeyOf(a.finding), nodeKeyOf(b.finding)) || byKey(a.rule, b.rule));
  return { judged, findings };
}
const nodeKeyOf = (f) => (f && f.node && typeof f.node.tapestryKey === 'string' ? f.node.tapestryKey : (f && f.item && f.item.node) || '');

/** A finding's id (Decision 3): the same for the same finding on the same graph, and new when the node's parents change. */
function idOf(rule, finding) {
  const node = nodeKeyOf(finding);
  const parents = (finding.parents || []).map((p) => p.tapestryKey).sort(byKey);
  const digest = crypto.createHash('sha256').update(JSON.stringify({ code: finding.code, node, parents })).digest('hex').slice(0, 12);
  return `${rule}:${node}:${digest}`;
}

/** A violation's parts, or unknown-violation. */
function parseId(text) {
  const m = new RegExp(`^([a-z][a-z0-9]*(?:-[a-z0-9]+)*):(${KEY_BODY}):([0-9a-f]{12})$`).exec(String(text));
  if (!m) throw refusal(UNKNOWN_VIOLATION.code, `${show(text)} isn't a finding's id. An id is <rule>:<tapestryKey>:<12 hex digits>, as rules check gives one. Nothing changed.`, { input: 'violation' });
  return { rule: m[1], node: m[2], digest: m[3] };
}

/** A finding as check answers it. */
function answerOf(rule, f) {
  return {
    id: idOf(rule, f), rule, code: f.code, message: f.message,
    node: f.node, primary: f.primary === true, concepts: f.concepts || [], parents: f.parents || [],
    fix: f.fix || null, choice: f.choice || null,
  };
}

const PARENT = Object.freeze({
  type: 'object',
  properties: {
    tapestryKey: { type: 'string' }, name: { type: 'string', nullable: true }, address: { type: 'string', nullable: true }, author: { type: 'string', nullable: true }, own: { type: 'boolean' },
    kind: { type: 'string', enum: ['primary-property', 'property', 'json-schema', 'other'], description: "What the parent is: a primary property, another property, a JSON schema node, or another kind of node" },
    concept: { type: 'string', nullable: true, description: 'The concept header it belongs to, or null' },
    ofItsConcept: { type: 'boolean', description: "Whether that concept is one of the node's own" },
  },
});
const FINDING = Object.freeze({
  type: 'object',
  required: ['id', 'rule', 'code', 'message', 'node', 'fix', 'choice'],
  properties: {
    id: { type: 'string', description: "The finding's id, <rule>:<tapestryKey>:<12 hex digits>, which rules repair takes as violation" },
    rule: { type: 'string' },
    code: { type: 'string', description: 'What breaks the rule, such as more-than-one-parent' },
    message: { type: 'string' },
    node: { type: 'object', description: 'The node, as reads answer one: tapestryKey, name, address, author, own' },
    primary: { type: 'boolean', description: "Whether the node is a concept's primary property" },
    concepts: { type: 'array', items: { type: 'object' }, description: 'The concepts whose trees hold it ({ tapestryKey, name, address, own, firmware }); for a primary property, its concept' },
    parents: { type: 'array', items: PARENT },
    fix: { type: 'object', nullable: true, description: 'What rules repair would do: { concept, removes: [{ type, from, to }], firmware }; null when it does nothing' },
    choice: { type: 'object', nullable: true, description: 'Why nothing is planned, and how to go on: { why, wayOn }; null when there is a fix' },
  },
});

module.exports = {
  SCOPE_INPUT, RULES_INPUT, FINDING,
  UNKNOWN_SCOPE, UNKNOWN_RULE, NOT_CHECKABLE, UNKNOWN_VIOLATION, CHANGED_SINCE_CHECK, BAD_TARGET, FIRMWARE_CONCEPT,
  scopeOf, rulesNamed, findingsIn, idOf, parseId, answerOf, nodeKeyOf,
};
