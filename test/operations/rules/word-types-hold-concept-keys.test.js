'use strict';
/**
 * The rule word-types-hold-concept-keys — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.md (AC1; AC2's
 *          findings as the rule gives them)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0047-wordtypes-hold-each-concepts-key.md (Decisions 1
 *          to 4 and 7)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/47-wordtypes-hold-each-concepts-key.test-plan.md
 *
 * Stack-free. The rule is found through the rules loader and called directly, in a child process with the TA set, over
 * test/helpers/wordTypesGraph.js's seed (through graphFake's readerOver): its scan(read, scope) as rules check calls it,
 * then violations(items, read). The seed checks itself against missingKeys, the rule restated in plain JavaScript, so a
 * finding the rule misses or adds is the rule's, not the seed's.
 *
 *   WT1  the loader finds it: its name, a summary, refuses: false, no refusals, violations and scan
 *   WT2  scan of the whole graph: every node a class thread reaches, each once, as { node }, by tapestryKey; not the
 *        unlabelled node, nor the change entry
 *   WT3  violations over the graph's items: exactly the seed's nine findings, one for each key a node lacks, and its five
 *        nodes that can't be judged, each marked unjudged with no-json or unreadable-json; every other node, nothing
 *   WT4  a finding's facts: its code, the node as reads answer one, the one concept whose key it lacks (validation
 *        tool's marked firmware), the key, no fix, and a choice saying why and how to go on (a firmware reinstall)
 *   WT5  the view: sections kept beside supply their keys; a key for a concept that doesn't reach the node, and the
 *        reserved keys, aren't judged; non-string entries, and wordTypes that isn't a list, hold nothing
 *   WT6  scan of a concept: its header, its core nodes, its class thread's sets and the nodes they reach; of a node: it
 *   WT7  items naming no node, a change entry, an unlabelled node, or a node only reserved concepts reach, give nothing
 *   WT8  the rules document holds entry 12 in the entry format: it only reports, rules check, the rule's file, enforced,
 *        ADR 0047 as its source
 *   WT9  firmware's graph rule item for it is made from the entry and the code, and the generator's check passes
 *   WT10 the catalog's check row names it beside property-has-one-parent
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const W = require('../../helpers/wordTypesGraph');

const { ROOT, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: rule word-types-hold-concept-keys');

const NAME = W.RULE;
const RULES_INDEX = path.join(ROOT, 'src/operations/rules/index.js');
const RULE_FILE = path.join(ROOT, `src/operations/rules/${NAME}.js`);
const RULES_DOC = path.join(ROOT, 'docs/GRAPH_RULES.md');
const CATALOG_DOC = path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md');
const ELEMENT = path.join(ROOT, `firmware/versions/v1.0.0/concepts/graph-rule/elements/${NAME}.json`);
const GENERATOR = path.join(ROOT, 'src/firmware/graph-rules.js');
const NOBODY = '00000000-0000-4000-8000-0000000000cb';

let seeded = null;
async function seed() {
  if (!seeded) seeded = await W.seedWordTypes('rule-wt');
  return seeded;
}

/**
 * Run the rule in a child over the seed's state. `calls` is { name: { scope } | { items } | { scope, judge: true } }:
 * a scope runs scan (and, with judge, violations over what it lists); items runs violations over them.
 */
function runRule(file, calls) {
  const dir = tmp('rule-wt-');
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
            if (typeof rule.scan !== 'function') { out.calls[name] = { error: 'the rule has no scan (ADR 0047 Decision 3)' }; continue; }
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
    if (!fs.existsSync(RULE_FILE)) throw new Error(`rule ${NAME} isn't loaded: src/operations/rules/${NAME}.js does not exist yet (ADR graph-operations-first-slice/0047 Decision 1)`);
    throw new Error(`rule ${NAME} isn't loaded: the rules' loader left it out${left ? `: ${left.problem}` : ''}`);
  }
  return out;
}
const call = (out, name) => {
  const c = out.calls[name];
  assert(c && !c.error, `the rule's ${name} call must run; got ${show(c)}`);
  return c;
};
const findingsOf = (vs) => (vs || []).filter((v) => v && v.unjudged !== true);
const unjudgedOf = (vs) => (vs || []).filter((v) => v && v.unjudged === true);
const pairs = (vs) => findingsOf(vs).map((v) => ({ node: v.node && v.node.tapestryKey, key: v.key })).sort((a, b) => (a.node < b.node ? -1 : a.node > b.node ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
const nodeOfItem = (v) => (v && v.item && v.item.node) || (v && v.node && v.node.tapestryKey) || null;

let graphRun = null;
async function graphCheck() {
  const ctx = await seed();
  if (!graphRun) graphRun = runRule(ctx.file, { graph: { scope: { kind: 'graph' }, judge: true } });
  return { ctx, out: graphRun, g: call(graphRun, 'graph') };
}

test('WT1 [AC1, Decision 1]: the rules\' loader finds it: its name, a summary, refuses: false, no refusals, violations and scan', async () => {
  const ctx = await seed();
  const out = runRule(ctx.file, {});
  const r = out.rule;
  assert(r.name === NAME && typeof r.summary === 'string' && r.summary.trim().length > 0, `named ${NAME}, with a summary; got ${show(r)}`);
  assert(r.refuses === false && show(r.refusals) === show([]), `it only reports: refuses false, no refusals (the story's out of scope: no write is refused); got ${show({ refuses: r.refuses, refusals: r.refusals })}`);
  assert(r.hasViolations && r.hasScan, `it has violations(items, read) and scan(read, scope) (Decision 1); got ${show(r)}`);
  assert(!(out.problems || []).length, `the rules' loader reports no problem; got ${show(out.problems)}`);
});

test('WT2 [AC2, Decision 3]: scan of the whole graph lists every node a class thread reaches, each once, as { node }, by tapestryKey', async () => {
  const { ctx, g } = await graphCheck();
  const want = W.scopeKeys(S.readState(ctx.file), { kind: 'graph' });
  const got = (g.items || []).map((it) => it && it.node);
  assert(show(got) === show(want), `the graph's ${want.length} nodes a class thread reaches, in tapestryKey order, each once; got ${got.length} ${show(got.map((x) => W.nameIn(ctx.k, x)))}`);
  assert((g.items || []).every((it) => it && Object.keys(it).length === 1), `each item is { node } and nothing else; got ${show((g.items || []).slice(0, 2))}`);
  assert(!got.includes(ctx.k.unlabelled), 'a node with no TapestryNode label isn\'t scanned, as no operation\'s read sees it');
  assert(!got.includes(ctx.k.entry), 'a change entry isn\'t scanned');
  for (const n of ['rex', 'walker', 'houndSchema', 'cngHeader', 'wordOnly', 'mute']) assert(got.includes(ctx.k[n]), `${n}, which a class thread reaches, is scanned`);
});

test('WT3 [AC2, Decisions 2 and 4]: violations over the graph: the nine findings, one per missing key; the five nodes it can\'t judge, marked so; nothing else', async () => {
  const { ctx, g } = await graphCheck();
  const vs = g.violations || [];
  const got = pairs(vs);
  const want = ctx.FINDINGS;
  assert(show(got) === show(want), `exactly the seed's nine findings, by node and key: ${show(want.map((f) => `${W.nameIn(ctx.k, f.node)}:${f.key}`))}; got ${show(got.map((f) => `${W.nameIn(ctx.k, f.node)}:${f.key}`))}`);
  const oracle = W.missingKeys(S.readState(ctx.file), g.items.map((i) => i.node));
  assert(show(got) === show(oracle.findings.map(({ node, key }) => ({ node, key }))), 'and what the rule restated in plain JavaScript finds over the same items');
  const wt = (key) => findingsOf(vs).filter((v) => v.node.tapestryKey === ctx.k.walker).map((v) => v.key).sort();
  assert(show(wt()) === show(['hound', 'pet']), `walker, in walkers under hound and pet, lacks both keys: two findings; got ${show(wt())}`);
  const un = unjudgedOf(vs).map((v) => ({ node: nodeOfItem(v), why: v.code })).sort((a, b) => (a.node < b.node ? -1 : 1));
  assert(show(un) === show(ctx.UNJUDGED), `the five it can't judge, each marked unjudged with why: ${show(ctx.UNJUDGED.map((u) => `${W.nameIn(ctx.k, u.node)}:${u.why}`))}; got ${show(un.map((u) => `${W.nameIn(ctx.k, u.node)}:${u.why}`))}`);
  for (const v of unjudgedOf(vs)) assert(typeof v.message === 'string' && v.message.length > 0 && !('key' in v && v.key), `an unjudged entry says why in words and names no key; got ${show(v)}`);
  const named = new Set([...findingsOf(vs).map((v) => v.node.tapestryKey), ...unjudgedOf(vs).map(nodeOfItem)]);
  for (const n of ['rex', 'champ', 'extraKey', 'beside', 'petSchema', 'walkers', 'houndSuperset', 'hound', 'wordOnly', 'ctxOnly']) {
    assert(!named.has(ctx.k[n]), `${n} holds every key expected of it, or has none expected: no entry; got one`);
  }
});

test('WT4 [AC2, Decision 4]: a finding\'s facts: code, node, the one concept, the key, no fix, and a choice naming the way on', async () => {
  const { ctx, g } = await graphCheck();
  const f = findingsOf(g.violations);
  const schema = f.find((v) => v.node.tapestryKey === ctx.k.houndSchema);
  assert(schema, `hound's JSON schema has a finding; got ${show(f.map((v) => W.nameIn(ctx.k, v.node.tapestryKey)))}`);
  assert(schema.code === 'missing-concept-key' && schema.key === 'validationTool', `its code is missing-concept-key and its key validationTool; got ${show({ code: schema.code, key: schema.key })}`);
  assert(schema.item && schema.item.node === ctx.k.houndSchema, `it carries its item; got ${show(schema.item)}`);
  for (const p of ['tapestryKey', 'name', 'address', 'author', 'own']) assert(p in schema.node, `its node is answered as reads answer a node, with ${p}; got ${show(schema.node)}`);
  assert(schema.node.address === ctx.uuid.houndSchema && schema.node.author === W.TA && schema.node.own === true, `the node's address, its author the assistant, its own; got ${show(schema.node)}`);
  assert(Array.isArray(schema.concepts) && schema.concepts.length === 1, `one concept: the one whose key it lacks; got ${show(schema.concepts)}`);
  const c = schema.concepts[0];
  assert(c.tapestryKey === ctx.k.validationTool && c.name === 'validation tool' && c.address === ctx.uuid.validationTool && c.own === true && c.firmware === true,
    `validation tool, by its header: tapestryKey, name, address, own, and marked firmware (K.isFirmware); got ${show(c)}`);
  assert(schema.fix === null, `no fix: it only reports; got ${show(schema.fix)}`);
  assert(schema.choice && typeof schema.choice.why === 'string' && schema.choice.why && typeof schema.choice.wayOn === 'string' && /reinstall/i.test(schema.choice.wayOn),
    `a choice saying why, and the way on: a firmware reinstall for firmware's nodes; got ${show(schema.choice)}`);
  assert(/validation tool/.test(schema.message) && /validationTool/.test(schema.message) && /jsonSchema/.test(schema.message), `its message names the concept and the key, and quotes its wordTypes; got ${show(schema.message)}`);
  const half = f.find((v) => v.node.tapestryKey === ctx.k.halfChamp);
  assert(half && half.concepts.length === 1 && half.concepts[0].tapestryKey === ctx.k.hound && half.concepts[0].firmware === false && half.key === 'hound', `half champ lacks hound's key; hound isn't firmware's; got ${show(half && { concepts: half.concepts, key: half.key })}`);
  const walker = f.filter((v) => v.node.tapestryKey === ctx.k.walker);
  assert(show(walker.map((v) => [v.key, v.concepts.map((x) => x.tapestryKey)]).sort()) === show([['hound', [ctx.k.hound]], ['pet', [ctx.k.pet]]]), `each of walker's findings names its own concept; got ${show(walker.map((v) => [v.key, v.concepts]))}`);
});

test('WT5 [AC2, Decision 2]: the view: kept-beside sections supply their keys; an unreached concept\'s key and the reserved keys aren\'t judged; only string entries of a list count', async () => {
  const { ctx, g } = await graphCheck();
  const f = findingsOf(g.violations);
  const on = (n) => f.filter((v) => v.node.tapestryKey === ctx.k[n]).map((v) => v.key).sort();
  assert(show(on('beside')) === show([]), `beside's letter lacks hound, but the owner's hound section kept beside it supplies the key, as the view lays it over; got ${show(on('beside'))}`);
  assert(show(on('extraKey')) === show([]), `extraKey holds pet, whose concept doesn't reach it: not judged; got ${show(on('extraKey'))}`);
  assert(show(on('nonString')) === show(['hound']) && show(on('strWordTypes')) === show(['hound']), `only string entries of a list count: [word, 7, null] and "hound" both lack hound; got ${show({ nonString: on('nonString'), strWordTypes: on('strWordTypes') })}`);
  assert(show(on('noWordBlock')) === show(['hound']) && show(on('noWordTypes')) === show(['hound']), `JSON with no word block, or no wordTypes, lacks every key; got ${show({ noWordBlock: on('noWordBlock'), noWordTypes: on('noWordTypes') })}`);
  assert(!f.some((v) => W.RESERVED.includes(v.key)), `word and graphContext are never expected; got ${show(f.filter((v) => W.RESERVED.includes(v.key)).map((v) => v.key))}`);
});

test('WT6 [AC2, AC4, Decision 3]: scan of a concept: its header, its core nodes, its sets and what they reach; of a node: the node', async () => {
  const ctx = await seed();
  const out = runRule(ctx.file, {
    hound: { scope: { kind: 'concept', key: ctx.k.hound }, judge: true },
    rex: { scope: { kind: 'node', key: ctx.k.rex }, judge: true },
    walker: { scope: { kind: 'node', key: ctx.k.walker }, judge: true },
  });
  const h = call(out, 'hound');
  const want = W.scopeKeys(S.readState(ctx.file), { kind: 'concept', key: ctx.k.hound });
  const got = (h.items || []).map((i) => i.node);
  assert(show(got) === show(want), `hound's scope: ${want.length} nodes, by tapestryKey; got ${show(got.map((x) => W.nameIn(ctx.k, x)))}`);
  for (const n of ['hound', 'houndSuperset', 'houndSchema', 'houndPP', 'walkers', 'showHoundSuperset', 'rex', 'champ', 'walker', 'beside', 'mute']) assert(got.includes(ctx.k[n]), `hound's scope holds ${n}`);
  for (const n of ['unlabelled', 'cngHeader', 'petSchema', 'wordOnly']) assert(!got.includes(ctx.k[n]), `hound's scope doesn't hold ${n}`);
  const oracle = W.missingKeys(S.readState(ctx.file), want);
  assert(show(pairs(h.violations)) === show(oracle.findings.map(({ node, key }) => ({ node, key }))), `its findings are the rule restated over the scope; got ${show(pairs(h.violations).map((f) => `${W.nameIn(ctx.k, f.node)}:${f.key}`))}`);
  const r = call(out, 'rex');
  assert(show(r.items) === show([{ node: ctx.k.rex }]) && show(r.violations) === show([]), `a node's scope is the node; rex holds its key; got ${show(r)}`);
  const w = call(out, 'walker');
  assert(show(pairs(w.violations).map((x) => x.key)) === show(['hound', 'pet']), `walker's scope gives its two findings; got ${show(pairs(w.violations))}`);
});

test('WT7 [AC2]: items naming no node, a change entry, an unlabelled node, or a node only reserved concepts reach give nothing', async () => {
  const ctx = await seed();
  const out = runRule(ctx.file, {
    nobody: { items: [{ node: NOBODY }] },
    entry: { items: [{ node: ctx.k.entry }] },
    unlabelled: { items: [{ node: ctx.k.unlabelled }] },
    reserved: { items: [{ node: ctx.k.wordOnly }, { node: ctx.k.ctxOnly }] },
    none: { items: [] },
    odd: { items: [null, 7, {}, { node: '' }] },
  });
  for (const name of ['nobody', 'entry', 'unlabelled', 'reserved', 'none', 'odd']) assert(show(call(out, name).violations) === show([]), `${name}: nothing; got ${show(call(out, name).violations)}`);
});

test('WT8 [AC1, Decision 7]: the rules document holds entry 12 in the entry format, with what it says, its check, its file and its source', () => {
  const doc = fs.readFileSync(RULES_DOC, 'utf8');
  const m = doc.match(new RegExp(`^## 12\\. \`${NAME}\`\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
  assert(m, `docs/GRAPH_RULES.md has entry 12, \`## 12. \\\`${NAME}\\\`\` (Decision 7)`);
  const body = m[1];
  for (const label of ['Says', 'Kind', 'Refuses or reports', 'Check', 'Repair', 'Enforced by', 'Status', 'Source']) assert(body.includes(`- **${label}:**`), `entry 12 has its ${label} field`);
  const field = (label) => (body.split(`- **${label}:**`)[1] || '').split('\n- **')[0];
  assert(/only reports/.test(field('Refuses or reports')), `it only reports; got ${show(field('Refuses or reports').slice(0, 200))}`);
  assert(field('Enforced by').includes(`src/operations/rules/${NAME}.js`) && /rules check/.test(field('Enforced by')), `Enforced by names rules check and the rule's file; got ${show(field('Enforced by').slice(0, 300))}`);
  assert(/^\s*enforced/.test(field('Status')), `its status is enforced; got ${show(field('Status').slice(0, 80))}`);
  assert(field('Source').includes('ADR graph-operations-first-slice/0047'), `its source is ADR 0047; got ${show(field('Source').slice(0, 200))}`);
  assert(/D10/.test(field('Says')) && /class thread/.test(field('Says')), `Says cites D10 and the class thread; got ${show(field('Says').slice(0, 300))}`);
  assert(/no-json/.test(field('Check')) && /unreadable-json/.test(field('Check')), `Check says what it can't judge; got ${show(field('Check').slice(0, 300))}`);
  assert(/reinstall/i.test(field('Repair')), `Repair names a firmware reinstall for firmware's nodes; got ${show(field('Repair').slice(0, 300))}`);
});

test('WT9 [AC1, Decision 7]: firmware\'s graph rule item for it is made from the entry and the code, and the generator\'s check passes', () => {
  assert(fs.existsSync(ELEMENT), `firmware's graph rule concept holds an element for it: ${path.relative(ROOT, ELEMENT)} (node src/firmware/graph-rules.js makes it)`);
  const item = JSON.parse(fs.readFileSync(ELEMENT, 'utf8'));
  const g = item.graphRule || {};
  assert(g.name === NAME && Number(g.number) === 12, `the item is rule 12, ${NAME}; got ${show({ name: g.name, number: g.number })}`);
  const c = spawnSync(process.execPath, [GENERATOR, '--check'], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('rule-wt-gen-')) });
  assert(c.status === 0, `node src/firmware/graph-rules.js --check passes: no element file would change; got ${c.status} ${(c.stdout || '').slice(-400)} ${(c.stderr || '').slice(-400)}`);
});

test('WT10 [Decision 7]: the catalog\'s check row names this rule beside property-has-one-parent', () => {
  const doc = fs.readFileSync(CATALOG_DOC, 'utf8');
  const row = doc.split('\n').find((l) => l.startsWith('| `check` |')) || '';
  assert(row.includes('property-has-one-parent') && row.includes(NAME), `docs/GRAPH_OPERATIONS_CATALOG.md's check row names both rules it runs; got ${show(row.slice(0, 400))}`);
  assert(row.includes('0047'), `and ADR 0047; got ${show(row.slice(0, 400))}`);
});

module.exports = { run };
if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));
