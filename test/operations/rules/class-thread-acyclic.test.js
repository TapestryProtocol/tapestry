'use strict';
/**
 * The rule class-thread-acyclic — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/28-link-set-and-unlink-set.md (AC3's cycle, AC7)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0028-link-set-and-unlink-set.md (Decisions 3, 5, 8,
 *          11)
 *
 * Stack-free. The rule's one definition, violations(items, read), is called directly, in a child process with the TA
 * set, over test/helpers/classThreadSeed.js's ruleGraph() (through graphFake's readerOver), as link-set's guard calls
 * it with { set, parent } before a link is made, and as rules check (A10.31) will call it over links already there.
 * The rule is found through the rules loader, so a rule that isn't there yet fails each test with that reason. An
 * item names a node as '@<name>', the seed's name for it.
 *
 *   CA1 the rules' loader finds it: its name, a summary, refuses: true, and one refusal, cycle, 409
 *   CA2 as a guard, a link that closes no loop gives no finding: a set under a second parent, a superset under another
 *       concept's set
 *   CA3 a set under itself is a cycle, naming it
 *   CA4 a set under a set already below it, one link down, two, or through another concept, is a cycle naming the chain
 *       from the set down to the parent, in order
 *   CA5 a chain longer than twelve is named in part, saying how many more
 *   CA6 items naming a missing node, or a node of the wrong kind, give no finding (the declaration refuses those), even
 *       where a walk over any node, or over IS_THE_CONCEPT_FOR too, would come back to the set
 *   CA7 as a check over links already in the graph, it names each link on a cycle an old route made, and only those
 *   CA8 the class thread anomaly breaks it nowhere: the concept-header concept's header, an element of its own
 *       superset, makes no cycle, as an item or on a walk
 *   CA9 the rules document holds its entry, in the entry format: it refuses, how a check finds what breaks it, and
 *       graph unlink-set as its repair
 *   CA10 an item with a trust-pipeline card set at either end, labelled Set but with no address, gives no finding, even
 *        where a walk that took the card set for a set would come back to the set (ADR 0028 Amendment 3)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');

const { ROOT, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: rule class-thread-acyclic');

const RULES_INDEX = path.join(ROOT, 'src/operations/rules/index.js');
const RULE_FILE = path.join(ROOT, 'src/operations/rules/class-thread-acyclic.js');
const NAME = 'class-thread-acyclic';
const NOBODY = '00000000-0000-4000-8000-0000000000ca';
const RULES_DOC = path.join(ROOT, 'docs/GRAPH_RULES.md');
const CH = 'fw:concept-header';
const CH_SUPERSET = 'fw:concept-header/superset';

const item = (set, parent) => ({ set, parent });
const CASES = {
  secondParent: [item('@Sedans', '@Trucks')],
  classLink: [item('@Ladders', '@Movers')],
  self: [item('@Cars', '@Cars')],
  oneDown: [item('@Cars', '@Sedans')],
  twoDown: [item('@Vehicles', '@Sedans')],
  across: [item('@Machines', '@Sedans')],
  long: [item('@Rung 01', '@Rung 15')],
  missingSet: [item(NOBODY, '@Cars')],
  missingParent: [item('@Cars', NOBODY)],
  // Each below would come back to the set on a walk that took any node, or IS_THE_CONCEPT_FOR too.
  elementAsSet: [item('@Old note', '@Ghost set')],
  elementAsParent: [item('@Notes', '@Stray note')],
  headerAsSet: [item('@vehicle', '@Sedans')],
  headerAsParent: [item('@Sedans', '@vehicle')],
  userAsSet: [item('@U', '@Cars')],
  check: [
    item('@Loop B', '@Loop A'), item('@Loop C', '@Loop B'), item('@Loop A', '@Loop C'),
    item('@Off loop', '@Loop A'), item('@Loop A', '@Loops'), item('@Cars', '@Vehicles'), item('@Vehicles', '@Movers'),
  ],
  anomalyLink: [item('@Header sets', `@${CH_SUPERSET}`)],
  anomalyItself: [item(`@${CH}`, `@${CH_SUPERSET}`)],
  anomalyWalk: [item(`@${CH_SUPERSET}`, '@Cars')],
  // Above cards ─▶ Card set X ─▶ Below cards: each item would close a loop through the card set, if it were a set.
  cardSetAsSet: [item('@Card set X', '@Below cards')],
  cardSetAsParent: [item('@Above cards', '@Card set X')],
};

/** Run the rule in a child over ruleGraph(); each case answers { items, violations } or { error }. */
function runRule(cases) {
  const dir = tmp('rule-cta-');
  const script = path.join(dir, 'child.js');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(script, `'use strict';
const ROOT = ${JSON.stringify(ROOT)};
const out = {};
(async () => {
  try {
    const { readerOver } = require(ROOT + '/test/helpers/graphFake.js');
    const CT = require(ROOT + '/test/helpers/classThreadSeed.js');
    const rules = require(${JSON.stringify(RULES_INDEX)});
    out.problems = rules.loadRules().problems;
    const rule = rules.findRule(${JSON.stringify(NAME)});
    out.rule = rule ? { name: rule.name, summary: rule.summary, refuses: rule.refuses, refusals: rule.refusals, hasViolations: typeof rule.violations === 'function' } : null;
    const g = CT.ruleGraph();
    out.keys = g.keys;
    out.names = g.names;
    if (rule) {
      out.cases = {};
      const resolve = (x) => (typeof x === 'string' && x.startsWith('@') ? g.keys[x.slice(1)] : x);
      for (const [name, items] of Object.entries(${JSON.stringify(cases)})) {
        const resolved = items.map((it) => ({ set: resolve(it.set), parent: resolve(it.parent) }));
        if (resolved.some((it) => !it.set || !it.parent)) { out.cases[name] = { error: 'the case names a node the seed has not' }; continue; }
        try { out.cases[name] = { items: resolved, violations: await rule.violations(resolved, readerOver(g.state)) }; }
        catch (e) { out.cases[name] = { items: resolved, error: String((e && e.message) || e) }; }
      }
    }
  } catch (e) { out.error = String((e && e.stack) || e); }
  require('fs').writeFileSync(${JSON.stringify(outFile)}, JSON.stringify(out));
  process.exit(0);
})();
`);
  const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  if (!fs.existsSync(outFile)) return { error: `the rule's child must answer: ${(child.stderr || '').slice(-600)}` };
  const out = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  if (out.error) return { error: `the rule's child failed: ${out.error.split('\n').slice(0, 3).join(' | ')}` };
  if (!out.rule) {
    const left = (out.problems || []).find((p) => p.file === `rules/${NAME}.js`);
    if (!fs.existsSync(RULE_FILE)) return { error: `rule ${NAME} isn't loaded: src/operations/rules/${NAME}.js does not exist yet (ADR graph-operations-first-slice/0028 Decision 3)` };
    return { error: `rule ${NAME} isn't loaded: the rules' loader left it out${left ? `: ${left.problem}` : ''}` };
  }
  return out;
}

let MAIN = null;
function main() {
  if (!MAIN) MAIN = runRule(CASES);
  if (MAIN.error) throw new Error(MAIN.error);
  return MAIN;
}
function only(name) {
  const c = main().cases[name];
  assert(c && !c.error, `case ${name} must run; got ${show(c)}`);
  assert(Array.isArray(c.violations), `case ${name}: violations() answers a list; got ${show(c.violations)}`);
  return c;
}
const key = (n) => main().keys[n];
/** Whether `text` names each node, by name or tapestryKey, in this order. */
function namesInOrder(text, nodes) {
  let at = 0;
  for (const n of nodes) {
    const found = [n, key(n)].map((s) => String(text).indexOf(s, at)).filter((i) => i >= 0);
    if (!found.length) return false;
    at = Math.min(...found) + 1;
  }
  return true;
}
function oneCycle(name) {
  const c = only(name);
  assert(c.violations.length === 1 && c.violations[0].code === 'cycle', `${name}: one cycle finding; got ${show(c.violations)}`);
  const v = c.violations[0];
  assert(v.item && v.item.set === c.items[0].set && v.item.parent === c.items[0].parent, `${name}: the finding names its item; got ${show(v.item)}`);
  assert(typeof v.message === 'string' && v.message.trim(), `${name}: it says in words what is wrong; got ${show(v)}`);
  return v;
}
function none(name) {
  const c = only(name);
  assert(c.violations.length === 0, `${name}: no finding; got ${show(c.violations)}`);
}

test('CA1: the rules\' loader finds class-thread-acyclic, with its name, a summary, refuses: true, and one refusal, cycle, 409', () => {
  const r = main().rule;
  assert(r.name === NAME && typeof r.summary === 'string' && r.summary.trim() && r.hasViolations, `its name, a summary and violations(items, read); got ${show(r)}`);
  assert(r.refuses === true, `it refuses a write (ADR Decision 3); got ${show(r.refuses)}`);
  const codes = (r.refusals || []).map((x) => `${x.code}:${x.status}`);
  assert(show(codes) === show(['cycle:409']), `its one refusal is cycle, 409; got ${show(r.refusals)}`);
});

test('CA2: as a guard, a link that closes no loop gives no finding: a set under a second parent, a superset under another concept\'s set', () => {
  none('secondParent');
  none('classLink');
});

test('CA3: a set under itself is a cycle, naming it', () => {
  const v = oneCycle('self');
  assert(namesInOrder(v.message, ['Cars']), `it names Cars; got ${show(v.message)}`);
});

test('CA4: a set under a set already below it, one link down, two, or through another concept, is a cycle naming the chain from the set down to the parent', () => {
  for (const [name, chain] of [['oneDown', ['Cars', 'Sedans']], ['twoDown', ['Vehicles', 'Cars', 'Sedans']], ['across', ['Machines', 'Movers', 'Vehicles', 'Cars', 'Sedans']]]) {
    const v = oneCycle(name);
    assert(namesInOrder(v.message, chain), `${name}: it names ${chain.join(' → ')}, from the set down to the parent, in that order; got ${show(v.message)}`);
  }
});

test('CA5: a chain longer than twelve is named in part, saying how many more', () => {
  const v = oneCycle('long');
  assert(namesInOrder(v.message, ['Rung 01']), `it names the set, Rung 01, first in the chain; got ${show(v.message)}`);
  assert(/\b3 more\b/.test(v.message), `the chain from Rung 01 down to Rung 15 is 15 sets: it names twelve, then says 3 more (ADR Decision 3); got ${show(v.message)}`);
  const between = Array.from({ length: 13 }, (_, i) => `Rung ${String(i + 2).padStart(2, '0')}`);
  const named = between.filter((r) => v.message.includes(r) || v.message.includes(key(r)));
  assert(named.length <= 12, `it names at most twelve of the chain's sets, so not all thirteen between Rung 01 and Rung 15; it names ${named.length}: ${show(v.message)}`);
});

test('CA6: items naming a missing node, or a node of the wrong kind, give no finding: the declaration refuses those', () => {
  for (const name of ['missingSet', 'missingParent', 'elementAsSet', 'elementAsParent', 'headerAsSet', 'headerAsParent', 'userAsSet']) none(name);
});

test('CA7: as a check over links already in the graph, it names each link on a cycle an old route made, and only those', () => {
  const c = only('check');
  const k = main().keys;
  const got = c.violations.map((v) => `${main().names[v.item && v.item.set]}<${main().names[v.item && v.item.parent]}:${v.code}`).sort();
  assert(show(got) === show(['Loop A<Loop C:cycle', 'Loop B<Loop A:cycle', 'Loop C<Loop B:cycle']), `of seven links, exactly the three on the loop Loop A → Loop B → Loop C → Loop A; got ${show(got)}`);
  const ab = c.violations.find((v) => v.item.set === k['Loop B'] && v.item.parent === k['Loop A']);
  assert(namesInOrder(ab.message, ['Loop B', 'Loop C', 'Loop A']), `the link Loop A → Loop B is on the loop Loop B → Loop C → Loop A; got ${show(ab.message)}`);
});

test('CA8: the class thread anomaly breaks it nowhere: the concept-header concept\'s header, an element of its own superset, makes no cycle', () => {
  none('anomalyLink');
  none('anomalyItself');
  none('anomalyWalk');
});

test('CA9: the rules document holds its entry, in the entry format: it refuses, how a check finds what breaks it, and graph unlink-set as its repair', () => {
  const doc = fs.readFileSync(RULES_DOC, 'utf8');
  const at = doc.search(new RegExp(`^## \\d+\\.[^\\n]*${NAME}`, 'm'));
  assert(at >= 0, `docs/GRAPH_RULES.md has no entry for ${NAME} yet (ADR graph-operations-first-slice/0028 Decision 11)`);
  const next = doc.slice(at + 3).search(/^## /m);
  const entry = next >= 0 ? doc.slice(at, at + 3 + next) : doc.slice(at);
  for (const label of ['Says', 'Kind', 'Refuses or reports', 'Check', 'Repair', 'Enforced by']) assert(entry.includes(`**${label}:**`), `the entry is in the entry format: it has **${label}:**`);
  assert(/refuses/i.test(entry) && entry.includes('cycle'), 'the entry says it refuses a write, with cycle');
  const repair = entry.slice(entry.indexOf('**Repair:**'), entry.indexOf('**Enforced by:**'));
  assert(/unlink-set/.test(repair), `its repair is graph unlink-set, which takes out a link on a cycle; got ${show(repair.trim())}`);
  assert(/\blink-set/.test(entry.slice(entry.indexOf('**Enforced by:**'))), 'it is enforced by graph link-set\'s guard');
});

test('CA10: an item with a trust-pipeline card set at either end gives no finding, even where a walk that took it for a set would come back', () => {
  // ADR 0028 Amendment 3: class-thread-acyclic judges no link with an address-less end; the declaration refuses it.
  none('cardSetAsSet');
  none('cardSetAsParent');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
