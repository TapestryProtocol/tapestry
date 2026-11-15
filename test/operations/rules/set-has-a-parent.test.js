'use strict';
/**
 * The rule set-has-a-parent — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/28-link-set-and-unlink-set.md (AC5's last parent, AC7)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0028-link-set-and-unlink-set.md (Decisions 4, 5, 11)
 *
 * Stack-free. The rule's one definition, violations(items, read), is called directly, in a child process with the TA
 * set, over test/helpers/classThreadSeed.js's ruleGraph() (through graphFake's readerOver): as unlink-set's guard calls
 * it, with { set, without } before a link is taken out, and as rules check (A10.31) will call it, with { set } over
 * sets already there. The rule is found through the rules loader, so a rule that isn't there yet fails each test with
 * that reason. An item names a node as '@<name>', the seed's name for it.
 *
 *   SP1  the rules' loader finds it: its name, a summary, refuses: true, and one refusal, last-parent, 409
 *   SP2  as a guard, a set under another superset or set besides `without` gives no finding, whichever is `without`
 *   SP3  as a guard, a set whose only parent is `without` is last-parent, naming the parent and how to go on
 *   SP4  as a guard, a `without` that isn't one of the set's parents gives no finding: a repeat, not a refusal, also for
 *       a set under no parent at all
 *   SP5  a superset is exempt: from its last parent as a guard, and under no parent as a check
 *   SP6  a parent that is neither a superset nor a set doesn't count: an element an old route put above the set
 *   SP7  items naming a missing node, or a node that isn't a set (an element, a concept header, a NostrUser), give no
 *        finding, though none of them is under a superset or a set
 *   SP8  as a check over many sets at once, it names each set under no superset or set, and only those
 *   SP9  the class thread anomaly breaks it nowhere: the concept-header concept's header is an element, not a set
 *   SP10 the rules document holds its entry, in the entry format: it refuses, how a check finds what breaks it, and
 *        graph link-set as its repair
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');

const { ROOT, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: rule set-has-a-parent');

const RULES_INDEX = path.join(ROOT, 'src/operations/rules/index.js');
const RULE_FILE = path.join(ROOT, 'src/operations/rules/set-has-a-parent.js');
const NAME = 'set-has-a-parent';
const NOBODY = '00000000-0000-4000-8000-0000000000cb';
const RULES_DOC = path.join(ROOT, 'docs/GRAPH_RULES.md');
const CH = 'fw:concept-header';
const CH_SUPERSET = 'fw:concept-header/superset';

const guard = (set, without) => ({ set, without });
const check = (set) => ({ set });
const CASES = {
  twoParents: [guard('@Tabbies', '@Felines'), guard('@Tabbies', '@Indoor pets')],
  lastParent: [guard('@Siamese', '@Felines')],
  notItsParent: [guard('@Siamese', '@Indoor pets')],
  underNoParent: [guard('@Strays', '@Felines')],
  supersetGuard: [guard('@Wolves', '@Pack animals')],
  supersetCheck: [check('@Felines')],
  elementParent: [guard('@Hybrid', '@Felines')],
  missing: [check(NOBODY), guard(NOBODY, '@Felines')],
  notASet: [check('@Rex'), check('@feline'), check('@U'), guard('@Rex', '@Sedans')],
  check: [check('@Tabbies'), check('@Siamese'), check('@Strays'), check('@Ghost set'), check('@Hybrid'), check('@Felines'), check('@Wolves'), check('@Sedans')],
  anomaly: [check(`@${CH}`), guard(`@${CH}`, `@${CH_SUPERSET}`), check(`@${CH_SUPERSET}`)],
};

/** Run the rule in a child over ruleGraph(); each case answers { items, violations } or { error }. */
function runRule(cases) {
  const dir = tmp('rule-shap-');
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
        const resolved = items.map((it) => (it.without === undefined ? { set: resolve(it.set) } : { set: resolve(it.set), without: resolve(it.without) }));
        if (resolved.some((it) => !it.set || ('without' in it && !it.without))) { out.cases[name] = { error: 'the case names a node the seed has not' }; continue; }
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
    if (!fs.existsSync(RULE_FILE)) return { error: `rule ${NAME} isn't loaded: src/operations/rules/${NAME}.js does not exist yet (ADR graph-operations-first-slice/0028 Decision 4)` };
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
const nameOf = (k) => main().names[k];
const names = (text, n) => String(text).includes(key(n)) || String(text).includes(n);
function none(name) {
  const c = only(name);
  assert(c.violations.length === 0, `${name}: no finding; got ${show(c.violations)}`);
}
function lastParent(name) {
  const c = only(name);
  assert(c.violations.length === 1 && c.violations[0].code === 'last-parent', `${name}: one last-parent finding; got ${show(c.violations)}`);
  const v = c.violations[0];
  assert(v.item && v.item.set === c.items[0].set, `${name}: the finding names its item; got ${show(v.item)}`);
  assert(typeof v.message === 'string' && v.message.trim(), `${name}: it says in words what is wrong; got ${show(v)}`);
  return v;
}

test('SP1: the rules\' loader finds set-has-a-parent, with its name, a summary, refuses: true, and one refusal, last-parent, 409', () => {
  const r = main().rule;
  assert(r.name === NAME && typeof r.summary === 'string' && r.summary.trim() && r.hasViolations, `its name, a summary and violations(items, read); got ${show(r)}`);
  assert(r.refuses === true, `it refuses a write (ADR Decision 4); got ${show(r.refuses)}`);
  const codes = (r.refusals || []).map((x) => `${x.code}:${x.status}`);
  assert(show(codes) === show(['last-parent:409']), `its one refusal is last-parent, 409; got ${show(r.refusals)}`);
});

test('SP2: as a guard, a set under another superset or set besides `without` gives no finding, whichever is `without`', () => {
  none('twoParents');
});

test('SP3: as a guard, a set whose only parent is `without` is last-parent, naming the parent and how to go on', () => {
  const v = lastParent('lastParent');
  assert(names(v.message, 'Felines'), `it names the parent, Felines; got ${show(v.message)}`);
  assert(/link-set|another parent/i.test(v.message) && /delete-set/.test(v.message), `it says how to go on: link the set under another parent first, or graph delete-set once it is empty (ADR Decision 1); got ${show(v.message)}`);
});

test('SP4: as a guard, a `without` that isn\'t one of the set\'s parents gives no finding, also for a set under no parent at all', () => {
  none('notItsParent');
  none('underNoParent');
});

test('SP5: a superset is exempt: from its last parent as a guard, and under no parent as a check', () => {
  none('supersetGuard');
  none('supersetCheck');
});

test('SP6: a parent that is neither a superset nor a set doesn\'t count: an element an old route put above the set', () => {
  const v = lastParent('elementParent');
  assert(names(v.message, 'Felines'), `Hybrid's only superset or set is Felines; the element Old note above it doesn't count; got ${show(v.message)}`);
});

test('SP7: items naming a missing node, or a node that isn\'t a set, give no finding, though none of them is under a superset or a set', () => {
  none('missing');
  none('notASet');
});

test('SP8: as a check over many sets at once, it names each set under no superset or set, and only those', () => {
  const c = only('check');
  const got = c.violations.map((v) => `${nameOf(v.item && v.item.set)}:${v.code}`).sort();
  assert(show(got) === show(['Ghost set:last-parent', 'Strays:last-parent']), `of eight, exactly Strays (under nothing) and Ghost set (under only an element); got ${show(got)}`);
  for (const v of c.violations) {
    assert(!('without' in v.item) || v.item.without === undefined, `a check's item has no without; got ${show(v.item)}`);
    assert(names(v.message, nameOf(v.item.set)), `each finding names its set; got ${show(v.message)}`);
  }
});

test('SP9: the class thread anomaly breaks it nowhere: the concept-header concept\'s header is an element, not a set', () => {
  none('anomaly');
});

test('SP10: the rules document holds its entry, in the entry format: it refuses, how a check finds what breaks it, and graph link-set as its repair', () => {
  const doc = fs.readFileSync(RULES_DOC, 'utf8');
  const at = doc.search(new RegExp(`^## \\d+\\.[^\\n]*${NAME}`, 'm'));
  assert(at >= 0, `docs/GRAPH_RULES.md has no entry for ${NAME} yet (ADR graph-operations-first-slice/0028 Decision 11)`);
  const next = doc.slice(at + 3).search(/^## /m);
  const entry = next >= 0 ? doc.slice(at, at + 3 + next) : doc.slice(at);
  for (const label of ['Says', 'Kind', 'Refuses or reports', 'Check', 'Repair', 'Enforced by']) assert(entry.includes(`**${label}:**`), `the entry is in the entry format: it has **${label}:**`);
  assert(/refuses/i.test(entry) && entry.includes('last-parent'), 'the entry says it refuses a write, with last-parent');
  const repair = entry.slice(entry.indexOf('**Repair:**'), entry.indexOf('**Enforced by:**'));
  assert(/\blink-set/.test(repair), `its repair is graph link-set, which gives a set with no parent one; got ${show(repair.trim())}`);
  assert(/unlink-set/.test(entry.slice(entry.indexOf('**Enforced by:**'))), 'it is enforced by graph unlink-set\'s guard');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
