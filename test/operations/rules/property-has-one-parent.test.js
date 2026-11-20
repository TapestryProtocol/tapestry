'use strict';
/**
 * The rule property-has-one-parent — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/45-property-has-one-parent.md (AC1; AC2's and AC4's
 *          findings as the rule gives them)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0045-property-has-one-parent.md (Decisions 1, 2, 3
 *          and 13; Amendment 1)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/45-property-has-one-parent.test-plan.md
 *
 * Stack-free. The rule is found through the rules loader and called directly, in a child process with the TA set, over
 * test/helpers/propertyParentsGraph.js's seed (through graphFake's readerOver): its scan(read, scope) as rules check
 * will call it, then violations(items, read). The seed checks itself against oddProperties, the rule restated in plain
 * JavaScript, so a finding the rule misses or adds is the rule's, not the seed's.
 *
 *   PH1  the loader finds it: its name, a summary, refuses: false, no refusals, violations and scan
 *   PH2  scan of the whole graph: every Property with at least one parent, each once, as { node }, by tapestryKey;
 *        the unhooked property isn't among them
 *   PH3  violations over the graph's items: exactly the seed's eleven, each with its code; the rest give none
 *   PH4  the fixable findings carry a fix: grok bot's project and bot's team.lead lose their link to their own
 *        concept's schema, keeping their tree parent; word's spelling too, marked firmware
 *   PH5  a finding's facts: the node, its concepts, each parent with its kind, its concept and whether that is the
 *        node's own concept; its message names the node and its parents
 *   PH6  every other finding has no fix and a choice saying why and how to go on, naming the operation where there is
 *        one (Decision 3); another author's concept, and the owner's own key's, are that author's claim (Amendment 1)
 *   PH7  scan of a concept: its primary property, its tree, and what hangs directly on its schema; of a node: the
 *        node when it is a Property, else nothing
 *   PH8  items naming no node, a node that isn't a Property, or a property under no parent give no finding
 *   PH9  the rules document holds entry 11 in the entry format: it only reports, check and repair, the rule's file,
 *        enforced, ADR 0045 as its source
 *   PH10 firmware's graph rule item for it is made from the entry and the code, and the generator's check passes
 *   PH11 the catalog's check and repair rows and the ledger row say what story 45 built
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const PG = require('../../helpers/propertyParentsGraph');

const { ROOT, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: rule property-has-one-parent');

const NAME = 'property-has-one-parent';
const RULES_INDEX = path.join(ROOT, 'src/operations/rules/index.js');
const RULE_FILE = path.join(ROOT, `src/operations/rules/${NAME}.js`);
const RULES_DOC = path.join(ROOT, 'docs/GRAPH_RULES.md');
const CATALOG_DOC = path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md');
const LEDGER_ROW = path.join(ROOT, 'ledger/2026-11-19-old-routes-hang-properties-on-schema.md');
const ELEMENT = path.join(ROOT, `firmware/versions/v1.0.0/concepts/graph-rule/elements/${NAME}.json`);
const GENERATOR = path.join(ROOT, 'src/firmware/graph-rules.js');
const NOBODY = '00000000-0000-4000-8000-0000000000cb';
const KINDS = ['primary-property', 'property', 'json-schema', 'other'];

let seeded = null;
async function seed() {
  if (!seeded) seeded = await PG.preparePropertyParents('rule-pho');
  return seeded;
}

/**
 * Run the rule in a child over the seed's state. `calls` is { name: { scope } | { items } | { scope, judge: true } }:
 * a scope runs scan (and, with judge, violations over what it lists); items runs violations over them.
 */
function runRule(file, calls) {
  const dir = tmp('rule-pho-');
  const script = path.join(dir, 'child.js');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(script, `'use strict';
const ROOT = ${JSON.stringify(ROOT)};
const out = {};
(async () => {
  try {
    const G = require(ROOT + '/test/helpers/graphFake.js');
    const rules = require(${JSON.stringify(RULES_INDEX)});
    out.problems = rules.loadRules().problems;
    const rule = rules.findRule(${JSON.stringify(NAME)});
    out.rule = rule ? { name: rule.name, summary: rule.summary, refuses: rule.refuses, refusals: rule.refusals, hasViolations: typeof rule.violations === 'function', hasScan: typeof rule.scan === 'function' } : null;
    if (rule) {
      const read = G.readerOver(G.readState(${JSON.stringify(file)}));
      out.calls = {};
      for (const [name, c] of Object.entries(${JSON.stringify(calls)})) {
        try {
          if (c.scope) {
            if (typeof rule.scan !== 'function') { out.calls[name] = { error: 'the rule has no scan (ADR 0045 Decision 2)' }; continue; }
            const items = await rule.scan(read, c.scope);
            out.calls[name] = { items, ...(c.judge ? { violations: await rule.violations(items, read) } : {}) };
          } else {
            out.calls[name] = { violations: await rule.violations(c.items, read) };
          }
        } catch (e) { out.calls[name] = { error: String((e && e.message) || e) }; }
      }
    }
  } catch (e) { out.error = String((e && e.stack) || e); }
  require('fs').writeFileSync(${JSON.stringify(outFile)}, JSON.stringify(out));
  process.exit(0);
})();
`);
  const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  if (!fs.existsSync(outFile)) throw new Error(`the rule's child must answer: ${(child.stderr || '').slice(-600)}`);
  const out = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  if (out.error) throw new Error(`the rule's child failed: ${out.error.split('\n').slice(0, 3).join(' | ')}`);
  if (!out.rule) {
    const left = (out.problems || []).find((p) => p.file === `rules/${NAME}.js`);
    if (!fs.existsSync(RULE_FILE)) throw new Error(`rule ${NAME} isn't loaded: src/operations/rules/${NAME}.js does not exist yet (ADR graph-operations-first-slice/0045 Decision 1)`);
    throw new Error(`rule ${NAME} isn't loaded: the rules' loader left it out${left ? `: ${left.problem}` : ''}`);
  }
  return out;
}
const call = (out, name) => {
  const c = out.calls[name];
  assert(c && !c.error, `the rule's ${name} call must run; got ${show(c)}`);
  return c;
};
const byNode = (violations) => Object.fromEntries((violations || []).map((v) => [v.node && v.node.tapestryKey, v]));
const nameOf = (ctx, key) => (Object.entries(ctx.x).find(([, v]) => v === key) || [key])[0];

let graphRun = null;
async function graphCheck() {
  const ctx = await seed();
  if (!graphRun) graphRun = runRule(ctx.file, { graph: { scope: { kind: 'graph' }, judge: true } });
  return { ctx, out: graphRun, g: call(graphRun, 'graph') };
}

test('PH1 [AC1, Decision 1]: the rules\' loader finds it: its name, a summary, refuses: false, no refusals, violations and scan', async () => {
  const ctx = await seed();
  const out = runRule(ctx.file, {});
  const r = out.rule;
  assert(r.name === NAME && typeof r.summary === 'string' && r.summary.trim().length > 0, `named ${NAME}, with a summary; got ${show(r)}`);
  assert(r.refuses === false && show(r.refusals) === show([]), `it only reports: refuses false, no refusals (story, Out of scope: no guard); got ${show({ refuses: r.refuses, refusals: r.refusals })}`);
  assert(r.hasViolations && r.hasScan, `it has violations(items, read) and scan(read, scope) (Decision 2); got ${show(r)}`);
  assert(!(out.problems || []).length, `the rules' loader reports no problem; got ${show(out.problems)}`);
});

test('PH2 [Decision 2]: scan of the whole graph lists every Property with at least one parent, each once, as { node }, by tapestryKey', async () => {
  const { ctx, g } = await graphCheck();
  const want = PG.judgedProperties(S.readState(ctx.file));
  const got = (g.items || []).map((it) => it && it.node);
  assert(show(got) === show(want), `the graph's ${want.length} properties with a parent, in tapestryKey order, each once; got ${got.length} ${show(got.slice(0, 5))}…`);
  assert((g.items || []).every((it) => it && Object.keys(it).length === 1), `each item is { node } and nothing else; got ${show((g.items || []).slice(0, 2))}`);
  assert(!got.includes(ctx.x.unhooked), 'the unhooked property, under no parent, isn\'t scanned (open question 3)');
});

test('PH3 [AC1, AC2, Decision 1]: violations over the graph\'s items are exactly the seed\'s eleven, each with its code', async () => {
  const { ctx, g } = await graphCheck();
  const want = PG.oddProperties(S.readState(ctx.file));
  const got = (g.violations || []).map((v) => ({ key: v.node && v.node.tapestryKey, code: v.code })).sort((a, b) => (a.key < b.key ? -1 : 1));
  assert(show(got) === show(want), `one finding per property that breaks the rule, with its code; got ${show(got.map((x) => [nameOf(ctx, x.key), x.code]))}, want ${show(want.map((x) => [nameOf(ctx, x.key), x.code]))}`);
  const codes = Object.fromEntries(got.map((x) => [nameOf(ctx, x.key), x.code]));
  for (const [id, code] of [['grokProject', 'more-than-one-parent'], ['teamLead', 'more-than-one-parent'], ['hutDoor', 'more-than-one-parent'], ['shared', 'more-than-one-parent'],
    ['schemaOnly', 'parent-not-a-property'], ['underElement', 'parent-not-a-property'], ['misplacedPP', 'primary-property-misplaced']]) {
    assert(codes[id] === code, `${id} is ${code}; got ${codes[id]}`);
  }
  for (const v of g.violations) {
    assert(v.item && v.item.node === v.node.tapestryKey && typeof v.message === 'string' && v.message.length > 20, `each finding is { item, code, message, … } for its own item; got ${show(v).slice(0, 300)}`);
  }
});

test('PH4 [AC3, Decision 1]: the fixable findings carry a fix that takes off only the link to their own concept\'s schema', async () => {
  const { ctx, g } = await graphCheck();
  const v = byNode(g.violations);
  const want = [
    ['grokProject', ctx.c.grokBot, ctx.schema.grokBot, false],
    ['teamLead', ctx.c.bot, ctx.schema.bot, false],
    ['wordSpelling', ctx.c.word, ctx.xs.word, true],
  ];
  for (const [id, concept, schemaKey, firmware] of want) {
    const f = v[ctx.x[id]];
    assert(f && f.fix, `${id} has a fix; got ${show(f).slice(0, 400)}`);
    assert(f.fix.concept === concept && show(f.fix.removes) === show([{ type: PG.MEMBER, from: ctx.x[id], to: schemaKey }]),
      `${id}'s fix takes off its IS_A_PROPERTY_OF to its concept's schema and nothing else; got ${show(f.fix)}`);
    assert(f.fix.firmware === firmware, `${id}'s fix is ${firmware ? '' : 'not '}marked firmware; got ${show(f.fix.firmware)}`);
    assert(f.choice === null, `${id}, with a fix, has no choice; got ${show(f.choice)}`);
  }
});

test('PH5 [AC2, Decision 3]: a finding names the node, its concepts, and each parent with its kind, its concept and whether that is the node\'s own', async () => {
  const { ctx, g } = await graphCheck();
  const v = byNode(g.violations);
  const grok = v[ctx.x.grokProject];
  assert(grok.node.tapestryKey === ctx.x.grokProject && grok.node.name === 'project' && grok.primary === false, `the node, by its facts; not a primary property; got ${show(grok.node)} ${grok.primary}`);
  assert(show(grok.concepts.map((x) => [x.tapestryKey, x.own, x.firmware])) === show([[ctx.c.grokBot, true, false]]), `its one concept, grok bot, the instance's own; got ${show(grok.concepts)}`);
  const parents = Object.fromEntries(grok.parents.map((p) => [p.tapestryKey, p]));
  const pp = parents[ctx.pp.grokBot];
  const sc = parents[ctx.schema.grokBot];
  assert(grok.parents.length === 2 && pp && sc, `its two parents; got ${show(grok.parents)}`);
  assert(pp.kind === 'primary-property' && pp.concept === ctx.c.grokBot && pp.ofItsConcept === true, `its primary property, of its own concept; got ${show(pp)}`);
  assert(sc.kind === 'json-schema' && sc.concept === ctx.c.grokBot && sc.ofItsConcept === true, `its own concept's JSON schema; got ${show(sc)}`);
  assert(/project/.test(grok.message) && /primary property for the concept of grok bots/i.test(grok.message) && /json schema for the concept of grok bots/i.test(grok.message),
    `its message names the node and both parents; got ${show(grok.message)}`);
  const team = byNode(g.violations)[ctx.x.teamLead].parents.find((p) => p.tapestryKey === ctx.x.team);
  assert(team && team.kind === 'property' && team.concept === ctx.c.bot && team.ofItsConcept === true, `team.lead's parent team is a property of bot's tree; got ${show(team)}`);
  const other = v[ctx.x.otherSchema].parents.find((p) => p.tapestryKey === ctx.schema.bot);
  assert(other && other.kind === 'json-schema' && other.concept === ctx.c.bot && other.ofItsConcept === false, `person's mentor's second parent is bot's schema, another concept's; got ${show(other)}`);
  const el = v[ctx.x.underElement].parents[0];
  assert(el && el.tapestryKey === ctx.el.lapsang && el.kind === 'other', `steeping's parent is an element: kind other; got ${show(el)}`);
  for (const f of g.violations) for (const p of f.parents) assert(KINDS.includes(p.kind), `every parent's kind is one of ${show(KINDS)}; got ${show(p)}`);
  const shared = v[ctx.x.shared];
  assert(show(shared.concepts.map((x) => x.tapestryKey).sort()) === show([ctx.made.teaHouse.conceptHeader, ctx.made.gadget.conceptHeader].sort()), `the shared node is in tea house's tree and gadget's; got ${show(shared.concepts)}`);
  const only = v[ctx.x.schemaOnly];
  assert(show(only.concepts) === show([]) && only.parents[0].kind === 'json-schema' && only.parents[0].concept === ctx.made.lamp.conceptHeader && only.parents[0].ofItsConcept === false,
    `wattage is in no tree; its one parent is lamp's schema; got ${show({ concepts: only.concepts, parents: only.parents })}`);
  const pp2 = v[ctx.x.misplacedPP];
  assert(pp2.primary === true && show(pp2.concepts.map((x) => x.tapestryKey)) === show([ctx.made.bookshop.conceptHeader]), `bookshop's primary property: primary, its concept bookshop; got ${show({ primary: pp2.primary, concepts: pp2.concepts })}`);
});

test('PH6 [AC4, Decision 3, Amendment 1]: every other finding has no fix and a choice saying why and how to go on', async () => {
  const { ctx, g } = await graphCheck();
  const v = byNode(g.violations);
  for (const key of ctx.CHOICES) {
    const f = v[key];
    assert(f && f.fix === null && f.choice && typeof f.choice.why === 'string' && f.choice.why.length > 10 && typeof f.choice.wayOn === 'string' && f.choice.wayOn.length > 5,
      `${nameOf(ctx, key)} has no fix, and a choice with why and wayOn; got ${show(f).slice(0, 500)}`);
  }
  const way = (id) => `${v[ctx.x[id]].choice.why} ${v[ctx.x[id]].choice.wayOn}`;
  assert(/add-property|set-schema/.test(way('schemaOnly')), `a property hung only on a schema: the property writes give its field a node in the tree; got ${show(way('schemaOnly'))}`);
  assert(/normalize\/skeleton/.test(way('misplacedPP')), `a misplaced primary property names POST /api/normalize/skeleton; got ${show(way('misplacedPP'))}`);
  for (const id of ['hutDoor', 'shared']) assert(/A10\.31/.test(way(id)) && /tangled-tree/.test(way(id)), `${id}: no operation takes one of its links out yet, the property writes refuse its concept tangled-tree, and A10.31 is named; got ${show(way(id))}`);
  for (const id of ['relayMotto', 'recipeDish']) assert(/claim/i.test(way(id)) && /D4/.test(way(id)), `${id}'s concept isn't the instance's own: that author's claim (D4; Amendment 1); got ${show(way(id))}`);
  assert(/another concept/i.test(way('otherSchema')) || /bot/.test(way('otherSchema')), `person's mentor on bot's schema says the schema is another concept's; got ${show(way('otherSchema'))}`);
});

test('PH7 [Decision 2]: scan of a concept lists its primary property, its tree and what hangs on its schema; of a node, the node when it is a Property', async () => {
  const ctx = await seed();
  const out = runRule(ctx.file, {
    grok: { scope: { kind: 'concept', key: ctx.c.grokBot } },
    lamp: { scope: { kind: 'concept', key: ctx.made.lamp.conceptHeader } },
    project: { scope: { kind: 'node', key: ctx.x.grokProject } },
    unhooked: { scope: { kind: 'node', key: ctx.x.unhooked } },
    element: { scope: { kind: 'node', key: ctx.el.lapsang } },
    header: { scope: { kind: 'node', key: ctx.c.grokBot } },
  });
  const keys = (n) => call(out, n).items.map((it) => it.node);
  const s = S.readState(ctx.file);
  const tree = Object.values(PG_tree(s, ctx.c.grokBot));
  const wantGrok = [ctx.pp.grokBot, ...tree].filter((k, i, a) => a.indexOf(k) === i).sort();
  assert(show(keys('grok')) === show(wantGrok), `grok bot: its primary property and every property of its tree, by tapestryKey; got ${show(keys('grok'))}, want ${show(wantGrok)}`);
  assert(keys('lamp').includes(ctx.x.schemaOnly), `lamp: wattage, hung directly on lamp's schema, is listed; got ${show(keys('lamp'))}`);
  assert(show(keys('project')) === show([ctx.x.grokProject]), `the node scope lists the property itself; got ${show(keys('project'))}`);
  assert(show(keys('unhooked')) === show([ctx.x.unhooked]), `the node scope lists a property even under no parent (it gives no finding, PH8); got ${show(keys('unhooked'))}`);
  assert(show(keys('element')) === show([]) && show(keys('header')) === show([]), `a node that isn't a Property lists nothing; got ${show({ element: keys('element'), header: keys('header') })}`);
});
/** Every Property reaching a concept's primary property by IS_A_PROPERTY_OF, at any depth, by tapestryKey. */
function PG_tree(s, header) {
  const byEid = new Map(s.nodes.map((n) => [n.eid, n]));
  const h = s.nodes.find((n) => n.props.tapestryKey === header);
  const pps = s.rels.filter((r) => r.type === PG.PRIMARY && r.to === h.eid).map((r) => r.from);
  const seen = new Set();
  const queue = [...pps];
  while (queue.length) {
    const at = queue.shift();
    for (const r of s.rels.filter((x) => x.type === PG.MEMBER && x.to === at)) {
      const n = byEid.get(r.from);
      if (n && n.labels.includes('Property') && !seen.has(n.eid)) { seen.add(n.eid); queue.push(n.eid); }
    }
  }
  return Object.fromEntries([...seen].map((e) => [e, byEid.get(e).props.tapestryKey]));
}

test('PH8 [Decision 1, open question 3]: items naming no node, a node that isn\'t a Property, or a property under no parent give no finding', async () => {
  const ctx = await seed();
  const out = runRule(ctx.file, { odd: { items: [{ node: NOBODY }, { node: ctx.c.grokBot }, { node: ctx.el.lapsang }, { node: ctx.x.unhooked }, { node: ctx.x.grokLetter }] } });
  const v = call(out, 'odd').violations;
  assert(Array.isArray(v) && v.length === 0, `none of them is judged; got ${show(v).slice(0, 400)}`);
});

test('PH9 [AC1, Decision 13]: the rules document holds entry 11, property-has-one-parent, in the entry format', () => {
  const doc = fs.readFileSync(RULES_DOC, 'utf8');
  const at = doc.search(new RegExp(`^## 11\\. \`${NAME}\`$`, 'm'));
  assert(at >= 0, `docs/GRAPH_RULES.md has no entry "## 11. \`${NAME}\`" yet (ADR graph-operations-first-slice/0045 Decision 13)`);
  const next = doc.slice(at + 3).search(/^## /m);
  const entry = next >= 0 ? doc.slice(at, at + 3 + next) : doc.slice(at);
  for (const label of ['Says', 'Kind', 'Refuses or reports', 'Check', 'Repair', 'Enforced by', 'Status', 'Source']) assert(entry.includes(`- **${label}:**`), `the entry has - **${label}:**`);
  const field = (label) => { const i = entry.indexOf(`- **${label}:**`); const j = entry.slice(i + 4).search(/\n- \*\*/); return j >= 0 ? entry.slice(i, i + 4 + j) : entry.slice(i); };
  assert(/only reports/i.test(field('Refuses or reports')), `it only reports; got ${show(field('Refuses or reports'))}`);
  assert(/rules check/.test(field('Check')) && /rules repair/.test(field('Repair')) && /firmwareOverride/.test(field('Repair')), `check is rules check; repair is rules repair, with firmwareOverride for firmware's concepts; got ${show({ check: field('Check'), repair: field('Repair') })}`);
  assert(field('Enforced by').includes(`src/operations/rules/${NAME}.js`), `Enforced by names the rule's file; got ${show(field('Enforced by'))}`);
  assert(/enforced/.test(field('Status')) && /0045/.test(field('Source')), `enforced, from ADR 0045; got ${show({ status: field('Status'), source: field('Source') })}`);
});

test('PH10 [AC1, Decision 13]: firmware\'s graph rule item is made from the entry and the code, and the generator\'s check passes', () => {
  assert(fs.existsSync(ELEMENT), `firmware's element for the rule exists: ${path.relative(ROOT, ELEMENT)} (node src/firmware/graph-rules.js writes it; ADR 0045 Decision 13)`);
  const item = JSON.parse(fs.readFileSync(ELEMENT, 'utf8'));
  assert(show(item).includes(NAME), `the element names the rule; got ${show(item).slice(0, 300)}`);
  const r = spawnSync(process.execPath, [GENERATOR, '--check'], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('rule-pho-gen-')), timeout: 60000 });
  assert(r.status === 0, `node src/firmware/graph-rules.js --check exits 0: the committed items are what the rulebook and the code make; got ${r.status} ${(r.stdout || '').slice(-300)} ${(r.stderr || '').slice(-300)}`);
});

test('PH11 [Decision 13]: the catalog\'s check and repair rows and the ledger row say what story 45 built', () => {
  const cat = fs.readFileSync(CATALOG_DOC, 'utf8');
  for (const op of ['check', 'repair']) {
    const row = cat.split('\n').find((l) => l.startsWith(`| \`${op}\` |`) && /rule|violation/i.test(l));
    assert(row && row.includes(NAME), `the catalog's §4 ${op} row names ${NAME}; got ${show(row)}`);
  }
  const ledger = fs.readFileSync(LEDGER_ROW, 'utf8');
  assert(/story 45|#45|A10\.31\.a/.test(ledger) && /OPEN/.test(ledger), `the ledger row records story 45's part and stays OPEN for the rest; got ${show(ledger.slice(0, 200))}`);
});

module.exports = { run };
if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));
