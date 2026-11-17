'use strict';
/**
 * The graph rule concept's items, made from the rulebook and the rules' code — graph-operations-first-slice #41
 * (Loom A10.41).
 *
 * Story: engineering-team/stories/graph-operations-first-slice/41-graph-rule-concept.md
 * Plan:  engineering-team/stories/graph-operations-first-slice/41-graph-rule-concept.test-plan.md
 * ADR:   engineering-team/decisions/graph-operations-first-slice/0041-graph-rule-concept.md (Decisions 2 to 5 and 8,
 *        Amendment 1)
 *
 * Stack-free and deterministic: the script's three pure parts (src/firmware/graph-rules.js), fed the real rulebook and
 * rules, and fixtures. Run on its own with `node test/graph-rules-builder.test.js`.
 *
 *   GB1  the script exports its three parts
 *   GB2  the real rulebook reads as seven entries, numbered 1 to 7, with no problem; entry 1 is tapestry-key-unique [AC2]
 *   GB3  each real item's name, number, title, description, about, status and source                              [AC2, AC3]
 *   GB4  each real item's fields hold the rulebook's text: continuation lines dedented, other fields in alsoSays   [AC3]
 *   GB5  a real item whose rule has code holds the code's declaration; entry 1's code is null                       [AC3]
 *   GB6  the real rulebook and rules make exactly the committed element files, and nothing else is in the folder    [AC4]
 *   GB7  each file's text is its JSON, two-space indented, with a newline; graphRule's keys in Decision 2's order    [AC3]
 *   GB8  a changed entry, or a changed rule declaration, changes that item and no other                           [AC4]
 *   GB9  `--check` answers 0 on the committed files and writes nothing                                             [AC4]
 *   GB10 the rulebook's preamble says the entries are installed as the graph rule concept, and how                [AC6]
 *   GF0  sentinel: the fixture rulebook makes its two items with no problem, so the problem cases below aren't vacuous
 *   GP1  a rule file no entry names                                                                                [AC4]
 *   GP2  a rule file the loader left out                                                                           [AC4]
 *   GP3  an entry naming another rule's code file, or one that isn't there                                         [AC4]
 *   GP4  an entry whose rule has a code file that its Enforced by doesn't name                                     [AC4]
 *   GP5  a rule with a code file whose Status isn't enforced                                                       [AC4]
 *   GP6  refusal codes or statuses that differ between the entry and the code                                      [AC4]
 *   GP7  refusals listed for a rule whose code only reports, or none for one whose code refuses                    [AC4]
 *   GP8  a Status other than proposed, enforced or retired; a Kind that is neither a graph rule nor a letter rule   [AC3]
 *   GP9  the format: a heading without a name, numbers out of order, a name twice or not kebab-case, a label missing
 *        or twice, text before the first field                                                                    [AC2]
 *   GP10 another level-2 heading ends the entry before it and isn't an entry                                       [AC2]
 *   GP11 a letter rule is about events                                                                             [AC3]
 *   GP12 a non-blank line after a field that isn't indented is a problem, so it never joins the field (Amendment 2.2) [AC2]
 *   GP13 a level-2 heading with a name in backticks that isn't an entry's heading is a problem (Amendment 2.2)     [AC2]
 *   GP14 a field line outside any entry is a problem (Amendment 2.2)                                               [AC2]
 *   GP15 a Says' first sentence ends at a full stop and a capital letter, never at e.g. or i.e. (Amendment 2.3)    [AC3]
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const SCRIPT = path.join(REPO, 'src/firmware/graph-rules.js');
const RULEBOOK = path.join(REPO, 'docs/GRAPH_RULES.md');
const RULES_DIR = path.join(REPO, 'src/operations/rules');
const ELEMENTS = path.join(REPO, 'firmware/versions/v1.0.0/concepts/graph-rule/elements');
const ADR = 'ADR graph-operations-first-slice/0041';

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (x) => JSON.stringify(x);
const short = (x, n = 300) => { const s = typeof x === 'string' ? x : show(x); return s && s.length > n ? `${s.slice(0, n)}…` : s; };

/** The script, once it exists: its three pure parts (Decision 4). */
function builder() {
  if (!fs.existsSync(SCRIPT)) throw new Error(`src/firmware/graph-rules.js does not exist yet (${ADR} Decision 4)`);
  const m = require(SCRIPT);
  for (const f of ['parseRulebook', 'itemsFor', 'elementFiles']) {
    assert(m && typeof m[f] === 'function', `src/firmware/graph-rules.js exports ${f}() (${ADR} Decision 4); it exports ${show(Object.keys(m || {}))}`);
  }
  return m;
}

/** The real inputs: the rulebook's text, and the rules folder as the loader reads it. */
function realInputs() {
  const { loadRules } = require('../src/operations/rules');
  const { rules, problems } = loadRules();
  const ruleFiles = fs.readdirSync(RULES_DIR).filter((f) => f.endsWith('.js') && f !== 'index.js').sort();
  return { text: fs.readFileSync(RULEBOOK, 'utf8'), rules, ruleFiles, ruleProblems: problems };
}

/** parseRulebook, then itemsFor: { entries, items, problems }, the problems of both. */
function build(b, { text, rules, ruleFiles, ruleProblems }) {
  const parsed = b.parseRulebook(text);
  assert(parsed && Array.isArray(parsed.entries) && Array.isArray(parsed.problems), `parseRulebook answers { entries, problems } (Amendment 1); got ${short(parsed)}`);
  const made = b.itemsFor({ entries: parsed.entries, rules, ruleFiles, ruleProblems });
  assert(made && Array.isArray(made.items) && Array.isArray(made.problems), `itemsFor answers { items, problems } (Amendment 1); got ${short(made)}`);
  return { entries: parsed.entries, items: made.items, problems: [...parsed.problems, ...made.problems] };
}

const graphRule = (items, name) => {
  const it = items.find((i) => i && i.name === name);
  assert(it && it.json && it.json.graphRule, `an item named ${name}; the items are ${show(items.map((i) => i && i.name))}`);
  return it.json.graphRule;
};

/** Problems about `rule` (a name, or null) whose message matches `re`. */
function problemsAbout(problems, rule, re) {
  for (const p of problems) assert(p && typeof p.message === 'string' && 'rule' in p, `each problem is { rule, message } (Amendment 1); got ${short(p)}`);
  return problems.filter((p) => p.rule === rule && (!re || re.test(p.message)));
}
function expectProblem(problems, rule, re, what) {
  const hit = problemsAbout(problems, rule, re);
  assert(hit.length > 0, `${what}: a problem naming ${show(rule)}${re ? ` that says ${re}` : ''}; the problems are ${short(problems, 800)}`);
}

// ── The real rulebook, as Decision 2 makes it into items ────────────────────────────────────────────────────────

const REAL = [
  {
    number: 1, name: 'tapestry-key-unique', title: 'Tapestry Key Unique', code: false, alsoSays: [],
    source: 'ADR graph-operations-foundation/0003',
    description: 'Each node has a tapestryKey, a random v4 UUID set once and never changed, and no two nodes share one.',
  },
  {
    number: 2, name: 'relationship-type-allowed', title: 'Relationship Type Allowed', code: true, alsoSays: ['Reserved'],
    source: 'ADR graph-operations-foundation/0004',
    description: 'A relationship the owner or an admin adds or removes has a type the graph declares, and not one reserved for another operation or the nostr import.',
  },
  {
    number: 3, name: 'field-mark-allowed', title: 'Field Mark Allowed', code: true, alsoSays: ['The naming convention'],
    source: 'ADR graph-operations-foundation/0005',
    description: "A field marked to be carried on its elements' Neo4j nodes is a plain top-level field of a concept, with a property node in the concept's property tree, and a property name that no other mark yields and that nothing else wrote.",
  },
  {
    number: 4, name: 'concept-slug-unique', title: 'Concept Slug Unique', code: true, alsoSays: [],
    source: 'ADR graph-operations-first-slice/0016',
    description: "No two of this instance's own concepts share a slug or a key.",
  },
  {
    number: 5, name: 'class-thread-acyclic', title: 'Class Thread Acyclic', code: true, alsoSays: [],
    source: 'ADR graph-operations-first-slice/0028',
    description: 'No set or superset is below itself.',
  },
  {
    number: 6, name: 'set-has-a-parent', title: 'Set Has A Parent', code: true, alsoSays: [],
    source: 'ADR graph-operations-first-slice/0028',
    description: 'Every set is directly under at least one superset or set, so some class thread reaches it and its elements.',
  },
  // Rule 7, joined with story graph-operations-first-slice #20, and rewritten by story #42: its Says opens with the rule as
  // ADR graph-operations-first-slice/0042 Decision 7 states it, a node's fully realized tapestryJson, and its Source names
  // the three ADRs (story 42, AC5).
  {
    number: 7, name: 'element-fits-schema', title: 'Element Fits Schema', code: true, alsoSays: [],
    source: 'ADR graph-operations-first-slice/0020, ADR graph-operations-first-slice/0020a and ADR graph-operations-first-slice/0042',
    description: "A node's fully realized tapestryJson fits the JSON schema of each concept it is an element of.",
  },
];
const GRAPH_RULE_KEYS = ['name', 'number', 'says', 'kind', 'about', 'refusesOrReports', 'check', 'repair', 'enforcedBy', 'status', 'source', 'alsoSays', 'code'];

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

t('GB1: src/firmware/graph-rules.js exports parseRulebook, itemsFor and elementFiles', () => { builder(); });

t('GB2 (AC2): the real rulebook reads as seven entries, numbered 1 to 7, with no problem, and entry 1 is tapestry-key-unique', () => {
  const r = build(builder(), realInputs());
  assert(r.problems.length === 0, `no problem with today's rulebook and rules; got ${short(r.problems, 1200)}`);
  const got = r.entries.map((e) => [e.number, e.name]);
  assert(show(got) === show(REAL.map((e) => [e.number, e.name])), `the entries, in order, are ${show(REAL.map((e) => [e.number, e.name]))}; got ${show(got)}`);
  assert(show(r.items.map((i) => i.name)) === show(REAL.map((e) => e.name)), `one item per entry, in the rulebook's order; got ${show(r.items.map((i) => i.name))}`);
});

t("GB3 (AC2, AC3): each real item's word block, number, about, status and source", () => {
  const { items } = build(builder(), realInputs());
  for (const want of REAL) {
    const it = items.find((i) => i.name === want.name);
    assert(it, `an item for ${want.name}`);
    const w = it.json.word || {};
    assert(w.slug === want.name && w.name === want.name, `${want.name}: word.slug and word.name are the rule's name (Decision 2); got ${show({ slug: w.slug, name: w.name })}`);
    assert(w.title === want.title, `${want.name}: word.title is "${want.title}"; got ${show(w.title)}`);
    assert(w.description === want.description, `${want.name}: word.description is the first sentence of Says, as plain text, capitalized:\n          want ${show(want.description)}\n          got  ${show(w.description)}`);
    assert(show(w.wordTypes) === show(['word', 'graphRule']), `${want.name}: word.wordTypes is ["word","graphRule"]; got ${show(w.wordTypes)}`);
    const g = it.json.graphRule;
    assert(g.name === want.name && g.number === want.number, `${want.name}: graphRule.name and number; got ${show({ name: g.name, number: g.number })}`);
    assert(g.about === 'the graph', `${want.name}: about is "the graph", since its Kind starts "a graph rule"; got ${show(g.about)}`);
    assert(g.status === 'enforced', `${want.name}: status is "enforced", its Status without the full stop; got ${show(g.status)}`);
    assert(g.source === want.source, `${want.name}: source is "${want.source}", without the full stop; got ${show(g.source)}`);
    assert(/^a graph rule\b/.test(g.kind || ''), `${want.name}: kind keeps the rulebook's Kind as written; got ${show(g.kind)}`);
  }
});

t("GB4 (AC3): each real item's fields hold the rulebook's own text, continuation lines dedented, other fields in alsoSays", () => {
  const { items } = build(builder(), realInputs());
  for (const want of REAL) {
    const g = graphRule(items, want.name);
    for (const k of ['says', 'kind', 'refusesOrReports', 'check', 'repair', 'enforcedBy', 'source']) {
      assert(typeof g[k] === 'string' && g[k].trim() === g[k] && g[k].length > 0, `${want.name}: ${k} is the field's text, with no blank lines or spaces at either end; got ${short(g[k])}`);
    }
    assert(Array.isArray(g.alsoSays) && show(g.alsoSays.map((a) => a && a.label)) === show(want.alsoSays), `${want.name}: alsoSays holds the entry's other fields, in order: ${show(want.alsoSays)}; got ${short(g.alsoSays)}`);
  }
  const one = graphRule(items, 'tapestry-key-unique');
  const enforced = [
    '- the database: the uniqueness rule `tapestry_key`, on the shared label `TapestryNode`;',
    '- every path that makes a node: `keyNode`, in `src/lib/tapestry-key-cypher.js`.',
    '',
    'Built in story graph-operations-foundation #3 (ADR 0003). A change entry is a node too, and gets its key when it is made (ADR 0004 Decision 5).',
  ].join('\n');
  assert(one.enforcedBy === enforced, `entry 1's enforcedBy is its nested bullets and paragraph, each line losing the bullet's two spaces:\n          want ${show(enforced)}\n          got  ${show(one.enforcedBy)}`);
  assert(one.says.startsWith('each node has a `tapestryKey`, a random v4 UUID set once and never changed'), `entry 1's says is the rulebook's Markdown, backticks kept; got ${short(one.says)}`);
  const five = graphRule(items, 'class-thread-acyclic');
  assert(five.refusesOrReports === 'it refuses the write, before anything changes: `cycle` (409) for a link whose parent is the set itself, or is already below it in the class thread. The refusal names the chain of sets from the set down to the parent, at most twelve of them and then how many more.',
    `entry 5's refusesOrReports, exactly as written; got ${show(five.refusesOrReports)}`);
  const reserved = graphRule(items, 'relationship-type-allowed').alsoSays[0];
  assert(reserved.text.startsWith('two groups.\n- Every relationship type the active firmware declares.') && reserved.text.endsWith("A test fails if the code names a relationship type in Cypher that isn't reserved."),
    `entry 2's Reserved holds its text, nested bullets and closing paragraph; got ${short(reserved.text, 600)}`);
});

t("GB5 (AC3): a real item whose rule has code holds the code's declaration, in the code's order; entry 1's code is null", () => {
  const inputs = realInputs();
  const { items } = build(builder(), inputs);
  for (const want of REAL) {
    const g = graphRule(items, want.name);
    if (!want.code) { assert(g.code === null, `${want.name} has no code file, so its code is null (Decision 2); got ${short(g.code)}`); continue; }
    const rule = inputs.rules.find((r) => r.name === want.name);
    const expected = { file: `src/operations/rules/${want.name}.js`, summary: rule.summary, refuses: rule.refuses, refusals: rule.refusals.map((x) => ({ code: x.code, status: x.status, when: x.when })) };
    assert(show(g.code) === show(expected), `${want.name}: code is what its file declares, in the code's order:\n          want ${short(expected, 900)}\n          got  ${short(g.code, 900)}`);
  }
});

t('GB6 (AC4): the real rulebook and rules make exactly the committed element files, and nothing else is in the folder', () => {
  const b = builder();
  const files = b.elementFiles(build(b, realInputs()).items);
  assert(Array.isArray(files) && files.every((f) => f && typeof f.file === 'string' && typeof f.text === 'string'), `elementFiles answers [{ file, text }]; got ${short(files)}`);
  const want = new Map(files.map((f) => [f.file, f.text]));
  assert(fs.existsSync(ELEMENTS), `firmware/versions/v1.0.0/concepts/graph-rule/elements/ exists (${ADR} Decision 1)`);
  const have = fs.readdirSync(ELEMENTS).sort();
  const stale = [...want.keys()].filter((f) => !have.includes(f) || fs.readFileSync(path.join(ELEMENTS, f), 'utf8') !== want.get(f));
  const extra = have.filter((f) => !want.has(f));
  assert(!stale.length && !extra.length, `the committed items are what the rulebook and the rules make. Run \`node src/firmware/graph-rules.js\` and commit the folder. Stale or missing: ${show(stale)}; not made by any entry: ${show(extra)}`);
  assert(show(have) === show(REAL.map((e) => `${e.name}.json`).sort()), `the folder holds one file per entry, named for its rule; got ${show(have)}`);
});

t("GB7 (AC3): each file's text is its JSON, two-space indented with a newline, and graphRule's keys are in Decision 2's order", () => {
  const b = builder();
  const { items } = build(b, realInputs());
  const files = b.elementFiles(items);
  for (const it of items) {
    const f = files.find((x) => x.file === `${it.name}.json`);
    assert(f, `a file ${it.name}.json`);
    assert(f.text === `${JSON.stringify(it.json, null, 2)}\n`, `${f.file}'s text is JSON.stringify(json, null, 2) and a newline (Decision 4)`);
    assert(show(Object.keys(it.json)) === show(['word', 'graphRule']), `${it.name}: the word wrapper's keys are word, then graphRule; got ${show(Object.keys(it.json))}`);
    assert(show(Object.keys(it.json.graphRule)) === show(GRAPH_RULE_KEYS), `${it.name}: graphRule's keys in Decision 2's order, ${show(GRAPH_RULE_KEYS)}; got ${show(Object.keys(it.json.graphRule))}`);
  }
  const again = b.elementFiles(build(b, realInputs()).items);
  assert(show(again) === show(files), 'making the files twice gives the same text');
});

t('GB8 (AC4): a changed entry, or a changed rule declaration, changes that item and no other', () => {
  const b = builder();
  const inputs = realInputs();
  const base = new Map(b.elementFiles(build(b, inputs).items).map((f) => [f.file, f.text]));
  const marker = 'This sentence was added by graph-rules-builder GB8.';
  const text = inputs.text.replace(/(## 5\. `class-thread-acyclic`[\s\S]*?- \*\*Says:\*\* [^\n]*)/, `$1 ${marker}`);
  assert(text !== inputs.text, 'GB8 setup: entry 5 has a Says line to change');
  const edited = build(b, { ...inputs, text });
  assert(edited.problems.length === 0, `an edited Says is still a good entry; got ${short(edited.problems)}`);
  assert(graphRule(edited.items, 'class-thread-acyclic').says.endsWith(marker), 'the edited entry\'s item says the new words');
  const changed = b.elementFiles(edited.items).filter((f) => base.get(f.file) !== f.text).map((f) => f.file);
  assert(show(changed) === show(['class-thread-acyclic.json']), `only the edited entry's file changes; got ${show(changed)}`);

  const rules = inputs.rules.map((r) => (r.name === 'set-has-a-parent' ? { ...r, summary: `${r.summary} (GB8)` } : r));
  const recoded = build(b, { ...inputs, rules });
  assert(graphRule(recoded.items, 'set-has-a-parent').code.summary.endsWith('(GB8)'), "a rule whose declared summary changed: its item's code.summary follows");
  const changed2 = b.elementFiles(recoded.items).filter((f) => base.get(f.file) !== f.text).map((f) => f.file);
  assert(show(changed2) === show(['set-has-a-parent.json']), `only that rule's file changes; got ${show(changed2)}`);
});

t('GB9 (AC4): `node src/firmware/graph-rules.js --check` answers 0 on the committed files, and writes nothing', () => {
  builder();
  const before = fs.existsSync(ELEMENTS) ? fs.readdirSync(ELEMENTS).sort().map((f) => [f, fs.readFileSync(path.join(ELEMENTS, f), 'utf8')]) : [];
  const r = spawnSync(process.execPath, [SCRIPT, '--check'], { cwd: REPO, encoding: 'utf8', timeout: 60000 });
  const after = fs.existsSync(ELEMENTS) ? fs.readdirSync(ELEMENTS).sort().map((f) => [f, fs.readFileSync(path.join(ELEMENTS, f), 'utf8')]) : [];
  assert(r.status === 0, `--check exits 0 when the files are current; got ${r.status}: ${short(`${r.stdout}${r.stderr}`, 600)}`);
  assert(show(after) === show(before), '--check writes nothing');
});

t('GB10 (AC6): the rulebook\'s preamble says its entries are installed as the graph rule concept, made by the script', () => {
  const text = fs.readFileSync(RULEBOOK, 'utf8');
  const preamble = text.slice(0, text.search(/^## /m));
  assert(/In the graph/.test(preamble), 'the preamble has a paragraph "In the graph" (Decision 8)');
  for (const s of ['39998:<TA>:graph-rule', 'node src/firmware/graph-rules.js', 'ADR graph-operations-first-slice/0041']) {
    assert(preamble.includes(s), `the preamble names ${s} (Decision 8)`);
  }
  assert(/^## 1\. `tapestry-key-unique`$/m.test(text), 'entry 1\'s heading is "## 1. `tapestry-key-unique`" (Decision 3)');
});

// ── Fixtures: a small rulebook and rules, then each problem Decisions 3 and 5 name ────────────────────────────────

const ENTRY_ALPHA = [
  '## 1. `alpha-rule`',
  '',
  '- **Says:** every alpha is fine. More words here.',
  '- **Kind:** a graph rule, about alphas.',
  '- **Refuses or reports:** the database refuses a second alpha.',
  '- **Check:** a check counts the alphas.',
  '- **Repair:** none yet.',
  '- **Enforced by:** the database.',
  '- **Status:** enforced.',
  '- **Source:** ADR test/0001.',
];
const ENTRY_BETA = [
  '## 2. `beta-rule`',
  '',
  '- **Says:** no beta is below itself.',
  '- **Kind:** a graph rule, about betas.',
  '- **Refuses or reports:** it refuses the write: `beta-cycle` (409) for a beta under itself.',
  '- **Check:** the same `violations` names each one.',
  '- **Repair:** `graph unlink-beta` takes one out.',
  "- **Enforced by:** the guard of `graph link-beta`. The rule's code is in `src/operations/rules/beta-rule.js`.",
  '- **Status:** enforced.',
  '- **Source:** ADR test/0002.',
];
const rulebook = (alpha = ENTRY_ALPHA, beta = ENTRY_BETA, tail = []) => ['# Graph Rules', '', 'The preamble.', '', ...alpha, '', ...beta, '', ...tail].join('\n');
const BETA_RULE = Object.freeze({
  name: 'beta-rule',
  summary: 'No beta is below itself.',
  refuses: true,
  refusals: [{ code: 'beta-cycle', status: 409, when: 'A beta under itself' }],
  violations: async () => [],
});
const fixture = (over = {}) => ({ text: rulebook(), rules: [BETA_RULE], ruleFiles: ['beta-rule.js'], ruleProblems: [], ...over });
const swap = (lines, from, to) => lines.map((l) => (l === from ? to : l));
const drop = (lines, prefix) => lines.filter((l) => !l.startsWith(prefix));

t('GF0 (sentinel): the fixture rulebook makes its two items with no problem', () => {
  const r = build(builder(), fixture());
  assert(r.problems.length === 0, `the fixture has no problem; got ${short(r.problems, 800)}`);
  assert(show(r.items.map((i) => i.name)) === show(['alpha-rule', 'beta-rule']), `two items; got ${show(r.items.map((i) => i.name))}`);
  assert(graphRule(r.items, 'alpha-rule').code === null, 'alpha-rule has no code file');
  assert(graphRule(r.items, 'beta-rule').code.file === 'src/operations/rules/beta-rule.js', 'beta-rule has its code');
  assert(r.items.find((i) => i.name === 'alpha-rule').json.word.description === 'Every alpha is fine.', 'the description is the first sentence of Says, capitalized');
});

t('GP1 (AC4): a rule file that no entry names is a problem naming the rule', () => {
  const gamma = { ...BETA_RULE, name: 'gamma-rule' };
  const r = build(builder(), fixture({ rules: [BETA_RULE, gamma], ruleFiles: ['beta-rule.js', 'gamma-rule.js'] }));
  expectProblem(r.problems, 'gamma-rule', null, 'gamma-rule.js has no entry');
});

t('GP2 (AC4): a rule file the loader left out is a problem naming it', () => {
  const r = build(builder(), fixture({ ruleFiles: ['beta-rule.js', 'delta-rule.js'], ruleProblems: [{ file: 'rules/delta-rule.js', problem: 'it has no summary' }] }));
  expectProblem(r.problems, 'delta-rule', null, 'the loader left delta-rule.js out');
});

t("GP3 (AC4): an entry naming another rule's code file, or one that isn't there, is a problem naming the entry", () => {
  const other = swap(ENTRY_BETA, ENTRY_BETA[7], "- **Enforced by:** the guard. The rule's code is in `src/operations/rules/other-rule.js`.");
  expectProblem(build(builder(), fixture({ text: rulebook(ENTRY_ALPHA, other) })).problems, 'beta-rule', null, 'beta names other-rule.js');
  const ghost = swap(ENTRY_ALPHA, ENTRY_ALPHA[7], "- **Enforced by:** the guard. The rule's code is in `src/operations/rules/alpha-rule.js`.");
  expectProblem(build(builder(), fixture({ text: rulebook(ghost) })).problems, 'alpha-rule', null, "alpha names alpha-rule.js, which isn't there");
});

t("GP4 (AC4): an entry whose rule has a code file that its Enforced by doesn't name is a problem", () => {
  const silent = swap(ENTRY_BETA, ENTRY_BETA[7], '- **Enforced by:** the guard of `graph link-beta`.');
  expectProblem(build(builder(), fixture({ text: rulebook(ENTRY_ALPHA, silent) })).problems, 'beta-rule', null, "beta-rule.js is there, and the entry doesn't say so");
});

t("GP5 (AC4): a rule with a code file whose Status isn't enforced is a problem", () => {
  const proposed = swap(ENTRY_BETA, '- **Status:** enforced.', '- **Status:** proposed.');
  expectProblem(build(builder(), fixture({ text: rulebook(ENTRY_ALPHA, proposed) })).problems, 'beta-rule', null, 'beta has code but is proposed');
});

t('GP6 (AC4): refusal codes or statuses that differ between the entry and the code are a problem', () => {
  const line = ENTRY_BETA[4];
  for (const [what, to] of [
    ['another code', line.replace('`beta-cycle` (409)', '`beta-loop` (409)')],
    ['another status', line.replace('(409)', '(404)')],
    ['one code more', `${line} Or \`beta-twice\` (409) for a beta under two.`],
  ]) {
    const entry = swap(ENTRY_BETA, line, to);
    expectProblem(build(builder(), fixture({ text: rulebook(ENTRY_ALPHA, entry) })).problems, 'beta-rule', null, `the entry lists ${what}`);
  }
});

t('GP7 (AC4): refusals listed for a rule whose code only reports, or none for one whose code refuses, are a problem', () => {
  const reports = { ...BETA_RULE, refuses: false, refusals: [] };
  expectProblem(build(builder(), fixture({ rules: [reports] })).problems, 'beta-rule', null, 'the code only reports, the entry lists beta-cycle');
  const none = swap(ENTRY_BETA, ENTRY_BETA[4], '- **Refuses or reports:** it refuses the write.');
  expectProblem(build(builder(), fixture({ text: rulebook(ENTRY_ALPHA, none) })).problems, 'beta-rule', null, 'the code refuses, the entry lists no code');
});

t('GP8 (AC3): a Status other than proposed, enforced or retired, or a Kind that is neither rule, is a problem', () => {
  const pending = swap(ENTRY_ALPHA, '- **Status:** enforced.', '- **Status:** pending.');
  expectProblem(build(builder(), fixture({ text: rulebook(pending) })).problems, 'alpha-rule', null, 'Status pending');
  const kind = swap(ENTRY_ALPHA, '- **Kind:** a graph rule, about alphas.', '- **Kind:** a rule, about alphas.');
  expectProblem(build(builder(), fixture({ text: rulebook(kind) })).problems, 'alpha-rule', null, 'Kind "a rule"');
  const retired = swap(ENTRY_ALPHA, '- **Status:** enforced.', '- **Status:** retired.');
  const ok = build(builder(), fixture({ text: rulebook(retired) }));
  assert(ok.problems.length === 0 && graphRule(ok.items, 'alpha-rule').status === 'retired', `a retired rule with no code is fine; got ${short(ok.problems)}`);
});

t('GP9 (AC2): the format — a heading without a name, numbers out of order, a name twice or not kebab-case, a label missing or twice, text before the first field', () => {
  const b = builder();
  const cases = [
    ['a heading with no name', rulebook(ENTRY_ALPHA, swap(ENTRY_BETA, '## 2. `beta-rule`', '## 2. Some sentence about betas')), null, /Some sentence about betas/],
    ['numbers out of order', rulebook(ENTRY_ALPHA, swap(ENTRY_BETA, '## 2. `beta-rule`', '## 3. `beta-rule`')), 'beta-rule', null],
    // Two code-less entries, so the only problem naming alpha-rule is the name given twice.
    ['a name twice', rulebook(ENTRY_ALPHA, swap(ENTRY_ALPHA, '## 1. `alpha-rule`', '## 2. `alpha-rule`')), 'alpha-rule', null],
    ['a name not kebab-case', rulebook(swap(ENTRY_ALPHA, '## 1. `alpha-rule`', '## 1. `Alpha_Rule`')), 'Alpha_Rule', null],
    ['a label missing', rulebook(drop(ENTRY_ALPHA, '- **Check:**')), 'alpha-rule', /Check/],
    ['a label twice', rulebook([...ENTRY_ALPHA, '- **Says:** said again.']), 'alpha-rule', /Says/],
    ['text before the first field', rulebook([ENTRY_ALPHA[0], '', 'A stray paragraph.', '', ...ENTRY_ALPHA.slice(2)]), 'alpha-rule', null],
  ];
  for (const [what, text, rule, re] of cases) {
    const r = build(b, { ...fixture(), text, rules: [BETA_RULE] });
    if (rule === null) {
      assert(r.problems.some((p) => p.rule === null && re.test(p.message)), `${what}: a problem with rule null whose message quotes the heading; got ${short(r.problems, 800)}`);
    } else {
      expectProblem(r.problems, rule, re, what);
    }
  }
});

t("GP10 (AC2): another level-2 heading ends the entry before it and isn't an entry", () => {
  const r = build(builder(), fixture({ text: rulebook(ENTRY_ALPHA, ENTRY_BETA, ['## Notes', '', 'Words that belong to no rule.']) }));
  assert(r.problems.length === 0, `a "## Notes" section is no problem; got ${short(r.problems)}`);
  assert(r.items.length === 2, `still two items; got ${show(r.items.map((i) => i.name))}`);
  assert(!/belong to no rule/.test(graphRule(r.items, 'beta-rule').source), `beta-rule's last field stops at the heading; got ${show(graphRule(r.items, 'beta-rule').source)}`);
});

t('GP11 (AC3): a letter rule is about events', () => {
  const letter = swap(ENTRY_ALPHA, '- **Kind:** a graph rule, about alphas.', '- **Kind:** a letter rule, about the events an alpha signs.');
  const r = build(builder(), fixture({ text: rulebook(letter) }));
  assert(r.problems.length === 0, `a letter rule is a good entry; got ${short(r.problems)}`);
  assert(graphRule(r.items, 'alpha-rule').about === 'events', `about is "events"; got ${show(graphRule(r.items, 'alpha-rule').about)}`);
});

// ── Review round 1: the stricter format, and where a first sentence ends (ADR 0041 Amendment 2.2 and 2.3) ──────────

t("GP12 (AC2, AC3): a non-blank line after a field that isn't indented is a problem naming the entry, so it never joins the field", () => {
  const b = builder();
  const cases = [
    ['a --- separator between entries', rulebook([...ENTRY_ALPHA, '', '---']), 'alpha-rule'],
    ['a stray note after an entry', rulebook(ENTRY_ALPHA, [...ENTRY_BETA, '', 'Note: rules 1 and 2 share nothing.']), 'beta-rule'],
    ['a label with its colon outside the bold', rulebook([...ENTRY_ALPHA, '- **Example**: an alpha that breaks it.']), 'alpha-rule'],
    ['a plain bullet among the fields', rulebook(swap(ENTRY_ALPHA, '- **Check:** a check counts the alphas.', '- a check counts the alphas.')), 'alpha-rule'],
  ];
  for (const [what, text, rule] of cases) {
    const r = build(b, fixture({ text }));
    expectProblem(r.problems, rule, null, what);
  }
  const indented = build(b, fixture({ text: rulebook([...ENTRY_ALPHA.slice(0, -1), '- **Source:** ADR test/0001.', '', '  A paragraph that belongs to Source.']) }));
  assert(indented.problems.length === 0, `an indented paragraph after a field is still that field's; got ${short(indented.problems)}`);
  assert(graphRule(indented.items, 'alpha-rule').source === 'ADR test/0001.\n\nA paragraph that belongs to Source', `it joins the field, dedented; got ${show(graphRule(indented.items, 'alpha-rule').source)}`);
});

t('GP13 (AC2): a level-2 heading that holds a name in backticks but isn\'t an entry\'s heading is a problem naming the name', () => {
  const b = builder();
  for (const heading of ['## 3 `gamma-rule`', '## Rule 3: `gamma-rule`', '## The `gamma-rule` rule']) {
    const r = build(b, fixture({ text: rulebook(ENTRY_ALPHA, ENTRY_BETA, [heading, '', 'Words about gamma.']) }));
    expectProblem(r.problems, 'gamma-rule', null, `the heading "${heading}"`);
  }
});

t('GP14 (AC2): a field line outside any entry — in the preamble, or under a heading that isn\'t an entry\'s — is a problem', () => {
  const b = builder();
  const under = build(b, fixture({ text: rulebook(ENTRY_ALPHA, ENTRY_BETA, ['## Letter rules', '', '### 3. `gamma-rule`', '', '- **Says:** every gamma is signed.', '- **Kind:** a letter rule, about gammas.']) }));
  assert(under.problems.some((p) => p.rule === null && /Says/.test(p.message)), `a field line under "## Letter rules" is a problem with rule null that names its label; got ${short(under.problems, 800)}`);
  const preamble = build(b, fixture({ text: rulebook().replace('The preamble.', 'The preamble.\n\n- **Says:** a field line in the preamble.') }));
  assert(preamble.problems.some((p) => p.rule === null && /Says/.test(p.message)), `a field line in the preamble is a problem with rule null that names its label; got ${short(preamble.problems, 800)}`);
});

t("GP15 (AC3): a Says' first sentence ends at a full stop and a capital letter, never at e.g. or i.e.", () => {
  const b = builder();
  const cases = [
    ['- **Says:** no beta (e.g. a superset) is below itself. More words.', 'No beta (e.g. a superset) is below itself.'],
    ['- **Says:** every beta (i.e. Every one) is fine. More words.', 'Every beta (i.e. Every one) is fine.'],
    ['- **Says:** no beta is below itself', 'No beta is below itself'],
    ['- **Says:** no beta is below itself. it says so twice.', 'No beta is below itself. it says so twice.'],
  ];
  for (const [line, want] of cases) {
    const r = build(b, fixture({ text: rulebook(ENTRY_ALPHA, swap(ENTRY_BETA, '- **Says:** no beta is below itself.', line)) }));
    const got = r.items.find((i) => i.name === 'beta-rule').json.word.description;
    assert(got === want, `${line}: word.description is ${show(want)}; got ${show(got)}`);
  }
});

async function run() {
  console.log('\n--- the graph rule concept\'s items, made from the rulebook and the rules\' code (graph-operations-first-slice #41) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  PASS  ${name}`); pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++;
    }
  }
  console.log(`\ngraph-rules-builder: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, failures, skipped: 0 };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
