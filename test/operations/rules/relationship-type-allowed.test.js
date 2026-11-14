'use strict';
/**
 * The rule relationship-type-allowed — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-foundation/4-the-write-path.md (AC2)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0004-the-write-path.md (Decisions 4, 6 and 12;
 *          Amendment 1)
 *
 * Stack-free. The rule's one definition, violations(items, read), is called directly, in a child process with the
 * TA set, over a graph seeded for test/helpers/graphFake.js (its readerOver), as rules check (A10.31) will call it.
 *
 *   R1  the rules' loader finds it, with its name, summary, refuses: true and two 409 refusals
 *   R2  a reserved type is refused reserved-type, declared or not, naming what makes it
 *   R3  a type the graph declares, under the concept's superset or a set below it, passes
 *   R4  a type nothing declares is refused undeclared-type, and so is one whose json doesn't parse or names no alias
 *   R5  a type declared by an element whose json is an LMDB reference passes
 *   R6  with no relationship type concept in the graph, every type is undeclared, and the message says why
 *   R7  over many relationships at once, it names each one that breaks it, and only those (the check's use, D3)
 *   R8  every type the active firmware declares is reserved
 *   R9  every relationship type the instance's code names in Cypher is reserved (the list's guard)
 *   R10 the rules document holds the rule's entry and the tapestryKey rule's, and design §7 points to it
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');

const { ROOT, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: rule relationship-type-allowed');

const RULES_INDEX = path.join(ROOT, 'src/operations/rules/index.js');
const RULE_FILE = path.join(ROOT, 'src/operations/rules/relationship-type-allowed.js');
const NAME = 'relationship-type-allowed';
const RULES_DOC = path.join(ROOT, 'docs/GRAPH_RULES.md');
const DESIGN = path.join(ROOT, 'docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md');

/** What makes each reserved type, as the refusal must name it (ADR 0004 Decision 6 and Amendment 1). */
const MADE_BY = {
  IS_THE_CONCEPT_FOR: /create-concept/,
  IS_THE_CONCEPT_GRAPH_FOR: /create-concept/,
  IS_THE_CORE_GRAPH_FOR: /create-concept/,
  IS_THE_JSON_SCHEMA_FOR: /create-concept/,
  IS_THE_PRIMARY_PROPERTY_FOR: /create-concept/,
  IS_THE_PROPERTIES_SET_FOR: /create-concept/,
  IS_THE_PROPERTY_TREE_GRAPH_FOR: /create-concept/,
  IS_A_SUPERSET_OF: /link-set/,
  HAS_ELEMENT: /add-to-concept/,
  IS_A_PROPERTY_OF: /add-property/,
  ENUMERATES: /enumerate/,
  AUTHORS: /import nostr/,
  HAS_TAG: /import nostr/,
  REFERENCES: /import nostr/,
  INHERITS_FROM: /import nostr/,
  FOLLOWS: /trust pipeline/,
  MUTES: /trust pipeline/,
  REPORTS: /trust pipeline/,
  TAGS: /tagging-edges/,
  PROVIDED_THE_TEMPLATE_FOR: /copy-node/,
  IMPORT: /merge-nodes/,
  SUPERCEDES: /merge-nodes/,
  SPECIFIC_INSTANCE: /cards/,
  WOT_METRICS_CARDS: /cards/,
  SERVES: /second brain/,
};

/**
 * Run the rule in a child: cases is { name: { items, seed: { lmdb?, noConcept? } } }; each answers { violations } or
 * { error }. The child stores RELIES_ON's json in a fresh LMDB when a case asks for it.
 */
function runRule(cases, extra = '') {
  const dir = tmp('rule-rta-');
  const script = path.join(dir, 'child.js');
  fs.writeFileSync(script, `'use strict';
const ROOT = ${JSON.stringify(ROOT)};
const out = {};
(async () => {
  try {
    const { readerOver } = require(ROOT + '/test/helpers/graphFake.js');
    const S = require(ROOT + '/test/helpers/graphOpsSuite.js');
    const rules = require(${JSON.stringify(RULES_INDEX)});
    out.loaded = rules.loadRules ? rules.loadRules() : null;
    const rule = rules.findRule(${JSON.stringify(NAME)});
    out.rule = rule ? { name: rule.name, summary: rule.summary, refuses: rule.refuses, refusals: rule.refusals, hasViolations: typeof rule.violations === 'function' } : null;
    const cases = ${JSON.stringify(cases)};
    let lmdbKey = null;
    if (Object.values(cases).some((c) => c.seed && c.seed.lmdb)) {
      const store = require(ROOT + '/src/lib/tapestry-store.js');
      lmdbKey = require('crypto').randomUUID();
      await store.put(lmdbKey, { word: { slug: 'RELIES_ON', name: 'relies on' }, relationshipType: { slug: 'RELIES_ON', alias: 'RELIES_ON', name: 'relies on', category: 'custom' } });
    }
    out.cases = {};
    for (const [name, c] of Object.entries(cases)) {
      const seed = S.seedGraph({ lmdbKey: c.seed && c.seed.lmdb ? lmdbKey : null, noConcept: !!(c.seed && c.seed.noConcept) });
      try { out.cases[name] = { violations: await rule.violations(c.items, readerOver(seed.state)) }; }
      catch (e) { out.cases[name] = { error: String((e && e.message) || e) }; }
    }
    ${extra}
  } catch (e) { out.error = String((e && e.stack) || e); }
  process.stdout.write('RESULT:' + JSON.stringify(out));
  process.exit(0);
})();
`);
  const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 60000, maxBuffer: 16 * 1024 * 1024 });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line, `the rule's child must answer: ${(child.stderr || '').slice(-600)}`);
  const out = JSON.parse(line);
  if (out.error) {
    if (!fs.existsSync(RULES_INDEX)) throw new Error('src/operations/rules/index.js does not exist yet (ADR graph-operations-foundation/0004 Decision 4)');
    if (!fs.existsSync(RULE_FILE)) throw new Error('src/operations/rules/relationship-type-allowed.js does not exist yet (ADR graph-operations-foundation/0004 Decision 6)');
    throw new Error(`the rule's child failed: ${out.error.split('\n').slice(0, 3).join(' | ')}`);
  }
  assert(out.rule, `the rules' loader must find ${NAME}`);
  return out;
}
const item = (type) => ({ type, from: '00000000-0000-4000-8000-000000000001', to: '00000000-0000-4000-8000-000000000002' });
const only = (out, name) => {
  const c = out.cases[name];
  assert(c && !c.error, `case ${name} must run; got ${show(c)}`);
  return c.violations;
};

// The firmware's declared types, read from its files as the test's own record of them.
function firmwareAliases() {
  const dir = path.join(ROOT, 'firmware/active/concepts/relationship-type/elements');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).relationshipType.alias).sort();
}

// Every relationship type the instance's code names in a Cypher pattern, with a file that names it.
function typesTheCodeNames() {
  const found = new Map();
  const re = /\[\s*\w*\s*:\s*`?([A-Z][A-Z0-9_]*(?:\s*\|\s*:?\s*`?[A-Z][A-Z0-9_]*`?)*)/g;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue; }
      if (!/\.(js|sh|cypher)$/.test(e.name)) continue;
      const t = fs.readFileSync(p, 'utf8');
      let m;
      while ((m = re.exec(t))) {
        for (const x of m[1].split('|')) {
          const type = x.replace(/[:`\s]/g, '');
          if (!found.has(type)) found.set(type, path.relative(ROOT, p));
        }
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  // The types the code builds at run time, which no pattern spells out (ADR 0004 Context 4): the trust pipeline's map
  // (src/pipeline/reconcile/processReconciliationQueue.js) and the tagging-edges pass's constant.
  for (const t of ['FOLLOWS', 'MUTES', 'REPORTS']) if (!found.has(t)) found.set(t, 'src/pipeline/reconcile/processReconciliationQueue.js');
  if (!found.has('TAGS')) found.set('TAGS', 'src/pipeline/tagging-edges/graph.js');
  return found;
}

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  const reservedTypes = Object.keys(MADE_BY);
  const cases = {
    declaredCites: { items: [item('CITES')] },
    declaredInSet: { items: [item('DEPENDS_ON')] },
    undeclared: { items: [item('MENTIONS')] },
    broken: { items: [item('BROKEN')] },
    noAlias: { items: [item('NO_ALIAS')] },
    lmdb: { items: [item('RELIES_ON')], seed: { lmdb: true } },
    noConcept: { items: [item('CITES')], seed: { noConcept: true } },
    many: { items: [item('CITES'), item('HAS_ELEMENT'), item('MENTIONS'), item('DEPENDS_ON')] },
  };
  for (const t of reservedTypes) cases[`reserved:${t}`] = { items: [item(t)] };
  for (const t of firmwareAliases()) cases[`firmware:${t}`] = { items: [item(t)] };
  for (const t of typesTheCodeNames().keys()) cases[`code:${t}`] = { items: [item(t)] };
  MAIN = runRule(cases);
  return MAIN;
}

test('R1: the rules\' loader finds relationship-type-allowed, with its name, summary, refuses: true and two 409 refusals', () => {
  const out = main();
  const r = out.rule;
  assert(r.name === NAME && typeof r.summary === 'string' && r.summary.trim(), `the rule has its name and a summary; got ${show(r)}`);
  assert(r.refuses === true, `it refuses a write rather than only reporting (ADR 0004 Decision 4); got ${show(r.refuses)}`);
  assert(r.hasViolations, 'it has violations(items, read), its one definition');
  const codes = (r.refusals || []).map((x) => `${x.code}:${x.status}`).sort();
  assert(show(codes) === show(['reserved-type:409', 'undeclared-type:409']), `its refusals are reserved-type and undeclared-type, both 409; got ${show(r.refusals)}`);
});

test('R2: a reserved type is refused reserved-type, declared in the graph or not, naming what makes it', () => {
  const out = main();
  for (const [type, re] of Object.entries(MADE_BY)) {
    const v = only(out, `reserved:${type}`);
    assert(v.length === 1 && v[0].code === 'reserved-type', `${type} is reserved: one reserved-type violation; got ${show(v)}`);
    assert(re.test(String(v[0].message)) && String(v[0].message).includes(type), `${type}'s refusal names the type and what makes it (${re}); got ${show(v[0].message)}`);
    assert(v[0].item && v[0].item.type === type, `the violation names its item; got ${show(v[0].item)}`);
  }
});

test('R3: a type the graph declares passes, under the concept\'s superset or a set below it', () => {
  const out = main();
  assert(show(only(out, 'declaredCites')) === '[]', `CITES is declared: no violation; got ${show(only(out, 'declaredCites'))}`);
  assert(show(only(out, 'declaredInSet')) === '[]', `DEPENDS_ON is declared under a set below the superset: no violation; got ${show(only(out, 'declaredInSet'))}`);
});

test('R4: a type nothing declares is undeclared-type, and so is one whose json doesn\'t parse or names no alias', () => {
  const out = main();
  for (const [name, type] of [['undeclared', 'MENTIONS'], ['broken', 'BROKEN'], ['noAlias', 'NO_ALIAS']]) {
    const v = only(out, name);
    assert(v.length === 1 && v[0].code === 'undeclared-type', `${type}: one undeclared-type violation; got ${show(v)}`);
    assert(String(v[0].message).includes(type), `the refusal names ${type}; got ${show(v[0].message)}`);
  }
});

test('R5: a type declared by an element whose json is an LMDB reference passes', () => {
  const v = only(main(), 'lmdb');
  assert(show(v) === '[]', `RELIES_ON's json is lmdb:<key>, resolved from the store: no violation; got ${show(v)}`);
});

test('R6: with no relationship type concept in the graph, every type is undeclared, and the message says why', () => {
  const v = only(main(), 'noConcept');
  assert(v.length === 1 && v[0].code === 'undeclared-type', `with no concept, CITES is undeclared; got ${show(v)}`);
  assert(/relationship.type/i.test(String(v[0].message)) && /concept/i.test(String(v[0].message)), `the message says the relationship type concept isn't in the graph; got ${show(v[0].message)}`);
});

test('R7: over many relationships at once, it names each one that breaks it, and only those', () => {
  const v = only(main(), 'many');
  const got = v.map((x) => `${x.item && x.item.type}:${x.code}`).sort();
  assert(show(got) === show(['HAS_ELEMENT:reserved-type', 'MENTIONS:undeclared-type']), `of CITES, HAS_ELEMENT, MENTIONS and DEPENDS_ON, exactly HAS_ELEMENT and MENTIONS break the rule; got ${show(v)}`);
});

test('R8: every type the active firmware declares is reserved', () => {
  const out = main();
  const aliases = firmwareAliases();
  assert(aliases.length >= 14, `the active firmware declares its relationship types (found ${aliases.length})`);
  for (const t of aliases) {
    const v = only(out, `firmware:${t}`);
    assert(v.length === 1 && v[0].code === 'reserved-type', `${t}, which the active firmware declares, is reserved; got ${show(v)}`);
  }
});

test('R9: every relationship type the instance\'s code names in Cypher is reserved', () => {
  const out = main();
  const missing = [];
  for (const [t, file] of typesTheCodeNames()) {
    const v = only(out, `code:${t}`);
    if (!(v.length === 1 && v[0].code === 'reserved-type')) missing.push(`${t} (named in ${file}): ${show(v)}`);
  }
  assert(!missing.length, `each type the code writes or reads is reserved, so add-relationship can't make one (ADR 0004 Consequences, debt 4); not reserved: ${missing.join('; ')}`);
});

test('R10: the rules document holds the rule\'s entry and the tapestryKey rule\'s, and design §7 points to it', () => {
  assert(fs.existsSync(RULES_DOC), 'docs/GRAPH_RULES.md does not exist yet (ADR graph-operations-foundation/0004 Decision 12)');
  const doc = fs.readFileSync(RULES_DOC, 'utf8');
  assert(doc.includes(NAME), `the rules document has an entry for ${NAME}`);
  assert(/refuses/i.test(doc), 'the entry says it refuses a write');
  assert(/tapestryKey/.test(doc) && /tapestry_key/.test(doc), 'the rules document has the tapestryKey rule\'s entry, enforced by the uniqueness rule tapestry_key');
  const design = fs.readFileSync(DESIGN, 'utf8');
  const s7 = design.slice(design.indexOf('## 7.'), design.indexOf('## 8.'));
  assert(/GRAPH_RULES\.md/.test(s7), 'design §7 points to docs/GRAPH_RULES.md');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
