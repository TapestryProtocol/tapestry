'use strict';
/**
 * rules repair — fix one violation, or every violation of one rule in a scope (catalog §4; story
 * graph-operations-first-slice #45, ADR graph-operations-first-slice/0045 Decisions 6 to 10 and Amendment 1).
 *
 * A write through the write path, with no guard: the rule refuses nothing, and the repair judges inside apply. In one
 * transaction it judges the candidates once, locks each concept header it may change (in tapestryKey order, at most
 * 100 fixes a call), judges them again on the graph as it is now, takes off the links each allowed fix plans, judges the
 * fixed nodes once more, names the relationship elements that still record a removed link, and records one change
 * entry. It changes the instance's own concepts, and firmware's only with firmwareOverride; another author's concept,
 * and every finding with no fix, are left, with why and the way on. Nothing is signed.
 */

const { refusal } = require('../../refusal');
const { CHANGE_ENTRY } = require('../../changes');
const S = require('../graph/_sets');
const X = require('./_rules');

const MAX_FIXES = 100;
const RULE_NAME = '^[a-z][a-z0-9]*(-[a-z0-9]+)*$';

const byKey = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const DELETE_LINK = (type) => `MATCH (a:TapestryNode {tapestryKey: $from})-[r:\`${type}\`]->(b:TapestryNode {tapestryKey: $to})
  WHERE NOT a:GraphChange AND NOT b:GraphChange
  DELETE r
  RETURN count(r) AS removed`;
const LETTERS = `MATCH (e:TapestryNode)-[:HAS_TAG]->(t1:NostrEventTag {type: 'relationshipType', value: $type})
  MATCH (e)-[:HAS_TAG]->(t2:NostrEventTag {type: 'nodeFrom', value: $from})
  MATCH (e)-[:HAS_TAG]->(t3:NostrEventTag {type: 'nodeTo', value: $to})
  RETURN DISTINCT e.tapestryKey AS tapestryKey, e.uuid AS address`;

const FIXED = Object.freeze({
  type: 'object',
  properties: {
    id: { type: 'string' },
    node: { type: 'object', description: 'The node, as reads answer one' },
    concept: { type: 'string', description: "The concept header whose tree the node is in" },
    removed: { type: 'array', items: { type: 'object' }, description: 'Each link taken off: { type, from, to, count }' },
    firmwareOverride: { type: 'boolean', description: "Whether the fix was made in a firmware concept, with firmwareOverride" },
    letters: { type: 'array', items: { type: 'object' }, description: 'The relationship elements that still record a removed link ({ tapestryKey, address }), as today\'s enumerate route signs one: graph delete-node deletes one' },
  },
});
const LEFT = Object.freeze({
  type: 'object',
  properties: {
    id: { type: 'string' }, node: { type: 'object' },
    why: { type: 'string', description: 'Why the repair left it' },
    wayOn: { type: 'string', description: 'How to go on' },
  },
});

module.exports = {
  group: 'rules',
  name: 'repair',
  kind: 'write',
  access: 'owner-and-admins',
  summary: 'Fix one violation, or every violation of one rule in a scope; the choices it leaves, with the way on',
  description: [
    'Takes `violation`, a finding\'s id as `rules check` gives it, or `rule` and `scope` together (a scope as `rules check` takes one). Today it repairs property-has-one-parent: it takes off a property\'s IS_A_PROPERTY_OF to its own concept\'s JSON schema node when the property also hangs under one parent in that concept\'s tree, keeping that link.',
    "It judges again in its own transaction, after locking each concept it may change, so it writes on the graph as it is: a violation whose node has changed since its check is refused (`changed-since-check`), naming its id now; one that is gone answers `nothing-to-repair`. It changes the instance's own concepts; a firmware concept only with `firmwareOverride: true` (refused `firmware-concept` without it); and never another author's. Every finding it doesn't fix is answered in `left`, with why and the way on.",
    'At most 100 fixes a call: `remaining` says how many more there are, and the next call fixes them. The answer names the relationship elements that still record a removed link, which `graph delete-node` deletes. One change entry records every link taken off; nothing is signed.',
  ].join('\n\n'),
  inputs: {
    violation: { schema: { type: 'string', minLength: 1, maxLength: 300 }, description: "A finding's id, <rule>:<tapestryKey>:<12 hex digits>, as rules check gives it; or give rule and scope instead" },
    rule: { schema: { type: 'string', pattern: RULE_NAME }, description: 'The rule whose violations to repair, with scope' },
    scope: { ...X.SCOPE_INPUT, required: false },
    firmwareOverride: { schema: { type: 'boolean', default: false }, description: "True to repair a firmware concept's violations too (--firmwareOverride true on a command line); false by default" },
  },
  result: {
    description: 'repaired, left or nothing-to-repair; each fix made, with the relationship elements that still record its link; each finding left, with why and the way on; how many fixable findings remain past the cap; and the change entry this call recorded (null when it changed nothing)',
    schema: {
      type: 'object',
      required: ['outcome', 'fixed', 'left', 'remaining', 'change'],
      properties: {
        outcome: { type: 'string', enum: ['repaired', 'left', 'nothing-to-repair'] },
        fixed: { type: 'array', items: FIXED },
        left: { type: 'array', items: LEFT },
        remaining: { type: 'integer', minimum: 0, description: `How many fixable findings remain past the cap of ${MAX_FIXES}` },
        change: CHANGE_ENTRY,
      },
    },
  },
  refusals: [X.BAD_TARGET, X.UNKNOWN_VIOLATION, X.UNKNOWN_RULE, X.NOT_CHECKABLE, X.UNKNOWN_SCOPE, X.CHANGED_SINCE_CHECK, X.FIRMWARE_CONCEPT],
  guards: [],
  repeatKey: ['violation', 'rule', 'scope', 'firmwareOverride'],

  async apply(inputs, ctx) {
    const { tx } = ctx;
    const read = (cypher, params) => tx.read(cypher, params);
    const override = inputs.firmwareOverride === true;

    // 1. The inputs.
    const hasViolation = inputs.violation !== undefined;
    const hasRule = inputs.rule !== undefined;
    const hasScope = inputs.scope !== undefined;
    if (hasViolation ? hasRule || hasScope : !(hasRule && hasScope)) {
      throw refusal(X.BAD_TARGET.code, 'Give violation (a finding\'s id from rules check), or rule and scope together, and not both. Nothing changed.', { input: hasViolation ? 'violation' : 'rule' });
    }
    let rule;
    let scope;
    let wanted = null;
    if (hasViolation) {
      wanted = X.parseId(inputs.violation);
      [rule] = X.rulesNamed([wanted.rule], 'violation');
      scope = { kind: 'node', key: wanted.node };
    } else {
      [rule] = X.rulesNamed([inputs.rule], 'rule');
      scope = await X.scopeOf(read, inputs.scope);
    }
    const allowed = (f) => !!f.fix && (!f.fix.firmware || override);

    // 2 and 3. The candidates, judged once; 4. the locks on the concepts the allowed fixes change.
    const items = await rule.scan(read, scope);
    const first = await rule.violations(items, read);
    const locked = [...new Set(first.filter(allowed).slice(0, MAX_FIXES).map((f) => f.fix.concept))].sort(byKey);
    for (const key of locked) await S.lockNode(tx, key);

    // 5. Judged again, on the graph as it is now.
    const now = await rule.violations(items, read);
    const idOf = (f) => X.idOf(rule.name, f);
    const leftOf = (f) => {
      if (f.fix && f.fix.firmware && !override) {
        const name = (f.concepts[0] && f.concepts[0].name) || f.fix.concept;
        return { id: idOf(f), node: f.node, why: `"${name}" is a firmware concept, whose tree rules repair changes only with firmwareOverride: true`, wayOn: 'Call again with firmwareOverride: true to repair it.' };
      }
      return { id: idOf(f), node: f.node, why: (f.choice && f.choice.why) || 'nothing is planned for it', wayOn: (f.choice && f.choice.wayOn) || 'The owner decides.' };
    };

    // 6. One violation.
    let todo;
    let left;
    let remaining = 0;
    if (wanted) {
      const f = now.find((x) => x.node && x.node.tapestryKey === wanted.node);
      if (!f) return { data: { outcome: 'nothing-to-repair', fixed: [], left: [], remaining: 0 }, changes: [] };
      const id = idOf(f);
      if (id !== inputs.violation) {
        throw refusal(X.CHANGED_SINCE_CHECK.code, `${f.message}. That isn't what the violation ${inputs.violation} found: the node's parents have changed since it was checked. As it is now, the finding is ${id}. Check again, then repair that. Nothing changed.`, { input: 'violation' });
      }
      if (f.fix && f.fix.firmware && !override) {
        const name = (f.concepts[0] && f.concepts[0].name) || f.fix.concept;
        throw refusal(X.FIRMWARE_CONCEPT.code, `"${name}" (${f.fix.concept}) is a firmware concept, whose tree a firmware install builds from its definition: rules repair changes it only with firmwareOverride: true. Nothing changed.`, { input: 'firmwareOverride' });
      }
      if (!f.fix) return { data: { outcome: 'left', fixed: [], left: [leftOf(f)], remaining: 0 }, changes: [] };
      todo = [f];
      left = [];
    } else {
      // 7. The policy, over a scope.
      const fixable = now.filter(allowed);
      todo = fixable.filter((f) => locked.includes(f.fix.concept)).slice(0, MAX_FIXES);
      remaining = fixable.length - todo.length;
      left = now.filter((f) => !allowed(f)).map(leftOf);
    }

    // 8. The writes.
    const fixed = [];
    const changes = [];
    for (const f of todo) {
      const removed = [];
      const letters = [];
      for (const rm of f.fix.removes) {
        const { counters } = await tx.run(DELETE_LINK(rm.type), { from: rm.from, to: rm.to });
        const count = counters.relationshipsDeleted;
        if (!count) continue;
        removed.push({ type: rm.type, from: rm.from, to: rm.to, count });
        changes.push({
          change: 'relationship-removed', type: rm.type, from: rm.from, to: rm.to, node: f.node.tapestryKey,
          concept: f.fix.concept, rule: rule.name, count, ...(f.fix.firmware ? { firmwareOverride: true } : {}),
        });
        // 10. The letters that still record the link.
        const target = f.parents.find((p) => p.tapestryKey === rm.to);
        if (f.node.address && target && target.address) {
          for (const r of await read(LETTERS, { type: rm.type, from: f.node.address, to: target.address })) {
            if (typeof r.tapestryKey === 'string' && !letters.some((l) => l.tapestryKey === r.tapestryKey)) letters.push({ tapestryKey: r.tapestryKey, address: typeof r.address === 'string' ? r.address : null });
          }
        }
      }
      if (removed.length) fixed.push({ id: idOf(f), node: f.node, concept: f.fix.concept, removed, firmwareOverride: f.fix.firmware === true, letters: letters.sort((a, b) => byKey(a.tapestryKey, b.tapestryKey)) });
    }

    // 9. What was written, judged once more: a fix that didn't fix rolls the whole write back.
    if (fixed.length) {
      const still = await rule.violations(fixed.map((x) => ({ node: x.node.tapestryKey })), read);
      if (still.length) throw new Error(`rules repair took off the planned links, but ${still.map((x) => x.node.tapestryKey).join(', ')} still break ${rule.name}: ${still[0].message}`);
    }

    const outcome = fixed.length ? 'repaired' : now.length ? 'left' : 'nothing-to-repair';
    return { data: { outcome, fixed, left, remaining }, changes };
  },
};
