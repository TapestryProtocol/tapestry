'use strict';
/**
 * The rule concept-slug-unique — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/16-create-concept-and-update-concept.md (AC7)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0016-create-concept-and-update-concept.md (Decisions 4
 *          and 5)
 *
 * Stack-free. The rule's one definition, violations(items, read), is called directly, in a child process with the TA
 * set, over the graph test/helpers/conceptGraph.js seeds (through graphFake's readerOver): as create-concept's and
 * update-concept's guard, and as rules check (A10.31) will call it. An item names a concept as '@<key name>', the seed's
 * key for it.
 *
 *   CS1 the rules' loader finds it: its name, a summary, refuses: true, and its two refusals, both 409
 *   CS2 a create's item: the same slug as one of this instance's concepts is the repeat, so nothing is violated; a key
 *       another own concept has under another slug is key-in-use, naming it; another author's slug or key doesn't count
 *   CS3 an update's item: another own concept's slug is slug-in-use, naming it; the concept's own slug, another author's
 *       slug, and an item whose concept isn't this instance's own concept header have no violations
 *   CS4 as a check over every own concept, a graph that keeps rule 10 has no violations; one where two concepts share a
 *       slug, or a key, names both
 *   CS5 the rules document holds its entry, §4, with its codes
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');

const { ROOT, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: rule concept-slug-unique');

const RULES_INDEX = path.join(ROOT, 'src/operations/rules/index.js');
const RULE_FILE = path.join(ROOT, 'src/operations/rules/concept-slug-unique.js');
const NAME = 'concept-slug-unique';

/**
 * Run the rule in a child over the seed; each case is { items, mutate? } and answers { violations } or { error }.
 * mutate names a change to the seed first: 'beagle-slug-feline' (beagle's slug tag becomes cat's) or 'mouse-key-beagle'
 * (mouse's oKeys.singular becomes beagle's key).
 */
function runRule(cases) {
  const dir = tmp('rule-csu-');
  const script = path.join(dir, 'child.js');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(script, `'use strict';
const ROOT = ${JSON.stringify(ROOT)};
const out = { cases: [] };
(async () => {
  try {
    const { readerOver } = require(ROOT + '/test/helpers/graphFake.js');
    const C = require(ROOT + '/test/helpers/conceptGraph.js');
    const rules = require(${JSON.stringify(RULES_INDEX)});
    const rule = rules.findRule(${JSON.stringify(NAME)});
    out.rule = rule ? { name: rule.name, summary: rule.summary, refuses: rule.refuses, refusals: rule.refusals } : null;
    out.problems = rules.loadRules().problems;
    if (!rule) throw new Error('the rule ${NAME} is not loaded (src/operations/rules/${NAME}.js)');
    for (const c of ${JSON.stringify(cases)}) {
      const seed = await C.seedConcepts();
      const s = seed.state;
      const k = seed.keys;
      const setTag = (key, type, fn) => { const n = C.node(s, key); const t = s.rels.filter((r) => r.from === n.eid && r.type === 'HAS_TAG').map((r) => s.nodes.find((x) => x.eid === r.to)).find((x) => x.props.type === type); fn(t.props); };
      if (c.mutate === 'beagle-slug-feline') setTag(k.beagle, 'slug', (p) => { p.value = 'feline'; });
      if (c.mutate === 'mouse-key-beagle') setTag(k.mouse, 'json', (p) => { const j = JSON.parse(p.value); j.conceptHeader.oKeys.singular = 'beagle'; p.value = JSON.stringify(j); });
      const resolve = (v) => (typeof v === 'string' && v.startsWith('@') ? (v === '@nobody' ? '00000000-0000-4000-8000-0000000000cc' : k[v.slice(1)]) : v);
      const items = c.items === 'every-own' ? null : c.items.map((it) => Object.fromEntries(Object.entries(it).map(([f, v]) => [f, resolve(v)])));
      let list = items;
      if (!list) {
        // As rules check would: every own concept, its slug and its key, as the rule reads them.
        list = [];
        for (const n of s.nodes.filter((x) => (x.labels.includes('ConceptHeader') || x.labels.includes('ListHeader')) && x.props.pubkey === C.TA)) list.push({ concept: n.props.tapestryKey });
      }
      try {
        const found = await rule.violations(list, readerOver(s));
        const name = (key) => Object.keys(k).find((x) => k[x] === key) || key;
        out.cases.push({ violations: found.map((v) => ({ concept: name(v.item && v.item.concept), code: v.code, message: v.message })), keys: { beagle: k.beagle, cat: k.cat, mouse: k.mouse }, uuids: { beagle: C.node(s, k.beagle).props.uuid, cat: C.node(s, k.cat).props.uuid, mouse: C.node(s, k.mouse).props.uuid } });
      } catch (e) { out.cases.push({ error: String(e && e.message || e) }); }
    }
  } catch (e) { out.error = String(e && e.message || e); }
  require('fs').writeFileSync(${JSON.stringify(outFile)}, JSON.stringify(out));
  process.exit(0);
})();
`);
  const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 120000 });
  let out = null;
  try { out = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported below */ }
  assert(out, `the child wrote no answer: ${(child.stderr || '').slice(-600)}`);
  return out;
}

function needRule() {
  if (!fs.existsSync(RULE_FILE)) throw new Error('src/operations/rules/concept-slug-unique.js does not exist yet (ADR graph-operations-first-slice/0016 Decision 5)');
}

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = runRule([
    { items: [{ slug: 'beagle', key: 'beagle', repeat: true }] },
    { items: [{ slug: 'lion', key: 'lion', repeat: true }] },
    { items: [{ slug: 'cat', key: 'cat', repeat: true }] },
    { items: [{ slug: 'nostr-relay', key: 'nostrRelay', repeat: true }] },
    { items: [{ concept: '@beagle', slug: 'feline' }] },
    { items: [{ concept: '@cat', slug: 'feline' }] },
    { items: [{ concept: '@relay', slug: 'beagle' }] },
    { items: [{ concept: '@nobody', slug: 'beagle' }] },
    { items: [{ concept: '@beagle', slug: 'nostr-relay' }] },
    { items: 'every-own' },
    { items: 'every-own', mutate: 'beagle-slug-feline' },
    { items: 'every-own', mutate: 'mouse-key-beagle' },
  ]);
  return MAIN;
}
function caseOf(i) {
  needRule();
  const out = main();
  assert(!out.error, `the child stopped: ${out.error}`);
  const c = out.cases[i];
  assert(c && !c.error, `case ${i} failed: ${c && c.error}`);
  return c;
}

test('CS1: the rules\' loader finds it: its name, a summary, refuses: true, and its two refusals, both 409', () => {
  needRule();
  const { rule, problems } = main();
  assert(rule, `the rule is loaded; problems: ${show(problems)}`);
  assert(rule.name === NAME && typeof rule.summary === 'string' && rule.summary.length > 10 && rule.refuses === true, `its name, summary and refuses; got ${show(rule)}`);
  const codes = Object.fromEntries(rule.refusals.map((r) => [r.code, r.status]));
  assert(show(codes) === show({ 'slug-in-use': 409, 'key-in-use': 409 }) || show(codes) === show({ 'key-in-use': 409, 'slug-in-use': 409 }), `its refusals are slug-in-use and key-in-use, 409; got ${show(rule.refusals)}`);
});

test('CS2: a create: the same slug is the repeat; a key under another slug is key-in-use, naming it; other authors\' don\'t count', () => {
  assert(show(caseOf(0).violations) === show([]), `the same slug as beagle: the repeat, nothing violated; got ${show(caseOf(0).violations)}`);
  assert(show(caseOf(1).violations) === show([]), 'a new slug and key: nothing violated');
  const cat = caseOf(2);
  assert(cat.violations.length === 1 && cat.violations[0].code === 'key-in-use' && cat.violations[0].message.includes(cat.uuids.cat), `cat's key, under its slug feline: key-in-use, naming the concept; got ${show(cat.violations)}`);
  assert(show(caseOf(3).violations) === show([]), 'another author\'s slug and key don\'t count (rule 10 holds within one author\'s graph)');
});

test('CS3: an update: another own concept\'s slug is slug-in-use, naming it; its own, another author\'s, and a concept not its own pass', () => {
  const beagle = caseOf(4);
  assert(beagle.violations.length === 1 && beagle.violations[0].code === 'slug-in-use' && beagle.violations[0].message.includes(beagle.uuids.cat), `beagle to feline: slug-in-use, naming cat; got ${show(beagle.violations)}`);
  assert(show(caseOf(5).violations) === show([]), 'cat to its own slug: nothing violated');
  assert(show(caseOf(6).violations) === show([]), 'an item for another author\'s concept: nothing (update-concept refuses it itself)');
  assert(show(caseOf(7).violations) === show([]), 'an item for a key nothing has: nothing (update-concept refuses it itself)');
  assert(show(caseOf(8).violations) === show([]), 'beagle to another author\'s slug: nothing violated');
});

test('CS4: as a check over every own concept: none in a graph that keeps rule 10; two sharing a slug, or a key, are both named', () => {
  assert(show(caseOf(9).violations) === show([]), `the seed keeps rule 10; got ${show(caseOf(9).violations)}`);
  const slug = caseOf(10);
  assert(show(slug.violations.map((v) => `${v.concept}:${v.code}`).sort()) === show(['beagle:slug-in-use', 'cat:slug-in-use']), `beagle and cat both slugged feline: both named; got ${show(slug.violations)}`);
  const key = caseOf(11);
  assert(show(key.violations.map((v) => `${v.concept}:${v.code}`).sort()) === show(['beagle:key-in-use', 'mouse:key-in-use']), `beagle and mouse both keyed beagle: both named; got ${show(key.violations)}`);
});

test('CS5: the rules document holds its entry, §4, with its codes', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs/GRAPH_RULES.md'), 'utf8');
  const at = doc.indexOf(`## 4. \`${NAME}\``);
  assert(at >= 0, `docs/GRAPH_RULES.md has "## 4. \`${NAME}\`"`);
  const entry = doc.slice(at, (doc.indexOf('\n## ', at + 5) + 1 || doc.length + 1) - 1);
  for (const part of ['**Says:**', '**Kind:**', '**Refuses or reports:**', '**Check:**', '**Repair:**', '**Enforced by:**', '`slug-in-use`', '`key-in-use`', 'rule 10']) {
    assert(entry.includes(part), `its entry says ${part}`);
  }
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
