'use strict';
/**
 * The rule element-fits-schema (BIBLE §10, rule 4) — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/20-create-element.md (AC3, AC7), and
 *          engineering-team/stories/graph-operations-first-slice/42-both-readers-judge-tapestryjson.md (AC1, AC2, AC4,
 *          AC5)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0020-create-element.md (Decisions 11, 12 and 16),
 *          and 0042-both-readers-judge-tapestryjson.md (Decisions 2, 3 and 7)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/20-create-element.test-plan.md, and
 *          42-both-readers-judge-tapestryjson.test-plan.md
 *
 * Stack-free. The rule's one definition, violations(items, read), is called directly, in a child process with the TA
 * set, over the graph test/helpers/createElementGraph.js seeds (through graphFake's readerOver), as create-element's
 * guard and the later element writes call it ({ concept, json }) and as rules check (A10.31) will ({ node } or
 * { node, concept }). An item names a seeded node as '@<name>'. The child adds, first:
 *   - walker (in walkers, so of dog and pet, with a dog section only), broken (under beagle's superset, its json tag
 *     unparseable) and lexeme (under word's superset; word has no schema);
 *   - wordy, a concept whose schema is firmware word's own, which requires graphContext, with three elements: wordFull,
 *     wordNoContext and wordFar;
 *   - four more beagles: diffFits and diffMisses, whose json tags and tapestryJson differ; farMisses, whose
 *     tapestryJson gives a derivedAt beyond the Date range; and noEntry, with no tapestryJson at all.
 * It then puts each node's tapestryJson into the child's own store (TAPESTRY_LMDB_PATH, from childEnv): rover's,
 * walker's and lexeme's as their json tags hold it, broken's as a list, and the rest as each case says.
 *
 *   EFS1 the rules' loader finds it: its name, a summary that says it judges tapestryJson, refuses: true, and its two
 *        refusals, invalid-fields (400) and no-schema (409)
 *   EFS2 { concept, json }: JSON that fits gives nothing; JSON that doesn't gives one invalid-fields finding listing
 *        every problem; a key that names no concept header gives nothing; a concept with no schema, or one that
 *        doesn't compile, gives no-schema
 *   EFS3 { node } and { node, concept }: an element's tapestryJson is judged against each concept whose class thread
 *        reaches it, or the one named; tapestryJson that isn't an object gives one invalid-fields finding saying so; a
 *        node no concept reaches gives nothing
 *   EFS4 within one call, a concept's schema is read once, however many items name it
 *   EFS5 _schemas.checkElements throws the rule's first finding as a refusal with rule set, and passes what fits
 *   EFS6 the rulebook holds its entry, §7, in its format, with its codes, its code's file and its sources: it judges a
 *        node's fully realized tapestryJson, a node with none is one finding marked missing, a write's problems that
 *        are only about graphContext are set aside as waiting, and exceptions will come (story 42, AC5); ADR 0020a
 *        reads as accepted
 *   EFS7 the graph rule concept's firmware has its element, as node src/firmware/graph-rules.js makes it, saying it
 *        judges tapestryJson
 *   EFS8 (story 42, AC1) where a node's tapestryJson and json tag differ, the tapestryJson decides: under beagle's
 *        schema, and under firmware word's, where a tapestryJson with its graphContext fits and one without doesn't;
 *        a finding gives the judged tapestryJson's graphContext.derivedAt, when it has one (ADR 0020a Decision 5)
 *   EFS9 (story 42, AC2) a node with no tapestryJson gives one invalid-fields finding marked missing, saying so, and
 *        nothing for each concept; its json tag, which fits, isn't read in its place
 *   EFS10 (story 42, AC4) { concept, json }, a write's JSON, sets aside the problems only about graphContext: a full
 *        word block under firmware word's schema gives nothing, and checkElements passes it; one missing its slug is
 *        reported for the slug alone
 *   EFS11 (review round 2, non-blocking 1) a stored graphContext.derivedAt beyond the Date range doesn't stop the
 *        check: wordFar, which fits, gives nothing; farMisses, which doesn't, gives its finding with its derivedAt and
 *        a message that gives the number, with no date
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');

const { ROOT, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: rule element-fits-schema');

const NAME = 'element-fits-schema';
const RULES_INDEX = path.join(ROOT, 'src/operations/rules/index.js');
const RULE_FILE = path.join(ROOT, `src/operations/rules/${NAME}.js`);
const SCHEMAS = path.join(ROOT, 'src/operations/catalog/graph/_schemas.js');
const RULEBOOK = path.join(ROOT, 'docs/GRAPH_RULES.md');
const ELEMENT_FILE = path.join(ROOT, `firmware/versions/v1.0.0/concepts/graph-rule/elements/${NAME}.json`);
const ADR_0020A = path.join(ROOT, 'engineering-team/decisions/graph-operations-first-slice/0020a-the-document-a-schema-describes.md');
/** A word block firmware word's schema takes: its slug and wordTypes (story 42). */
const WORD_BLOCK = { slug: 'word--lexeme', name: 'word: Lexeme', wordTypes: ['word'] };

function needRule() {
  if (!fs.existsSync(RULE_FILE)) throw new Error(`src/operations/rules/${NAME}.js does not exist yet (ADR graph-operations-first-slice/0020 Decision 12)`);
}

/**
 * Run the cases in a child over the seed; each case is { items, check? } and answers { violations, schemaReads } or
 * { error }; with check: true it calls _schemas.checkElements instead, answering { threw } or { passed }.
 */
let CACHE = null;
function runCases() {
  if (CACHE) return CACHE;
  const beagleJson = (description) => ({ word: { slug: 'beagle--max', name: 'beagle: Max', wordTypes: ['word', 'beagle'] }, beagle: { name: 'Max', slug: 'max', ...(description === undefined ? {} : { description }) } });
  const cases = {
    fits: { items: [{ concept: '@beagle', json: beagleJson('a good dog') }] },
    missing: { items: [{ concept: '@beagle', json: beagleJson(undefined) }] },
    twoProblems: { items: [{ concept: '@gadget', json: { word: { wordTypes: ['word', 'gadget'] }, gadget: { name: 'G', slug: 'g', size: 'big', weight: 3 } } }] },
    wordTypes: { items: [{ concept: '@dog', json: { word: { slug: 'dog--fido', name: 'dog: Fido', wordTypes: ['word', 'dog'] }, dog: { name: 'Fido', slug: 'fido', breed: 'goldenRetriever' } } }] },
    nobody: { items: [{ concept: '@nobody', json: beagleJson('x') }] },
    notHeader: { items: [{ concept: '@rover', json: beagleJson('x') }] },
    noSchema: { items: [{ concept: '@word', json: { word: { wordTypes: ['word'] } } }] },
    noCompile: { items: [{ concept: '@compass', json: { compass: { name: 'N', slug: 'n', description: 'x' } } }] },
    rover: { items: [{ node: '@rover' }] },
    walker: { items: [{ node: '@walker' }] },
    walkerDog: { items: [{ node: '@walker', concept: '@dog' }] },
    walkerPet: { items: [{ node: '@walker', concept: '@pet' }] },
    broken: { items: [{ node: '@broken' }] },
    loner: { items: [{ node: '@loner' }] },
    lexeme: { items: [{ node: '@lexeme' }] },
    once1: { items: [{ concept: '@beagle', json: beagleJson('one') }] },
    once10: { items: Array.from({ length: 10 }, (_, i) => ({ concept: '@beagle', json: beagleJson(`dog ${i}`) })) },
    checkThrows: { check: true, items: [{ concept: '@beagle', json: beagleJson('fine') }, { concept: '@beagle', json: beagleJson(undefined) }] },
    checkPasses: { check: true, items: [{ concept: '@beagle', json: beagleJson('fine') }] },
    diffFits: { items: [{ node: '@diffFits' }] },
    diffMisses: { items: [{ node: '@diffMisses' }] },
    wordFull: { items: [{ node: '@wordFull' }] },
    wordNoContext: { items: [{ node: '@wordNoContext' }] },
    noEntry: { items: [{ node: '@noEntry' }] },
    wordFar: { items: [{ node: '@wordFar' }] },
    farMisses: { items: [{ node: '@farMisses' }] },
    writeWordFull: { items: [{ concept: '@wordy', json: { word: WORD_BLOCK } }] },
    writeWordNoSlug: { items: [{ concept: '@wordy', json: { word: { name: 'word: Lexeme', wordTypes: ['word'] } } }] },
    checkWordFull: { check: true, items: [{ concept: '@wordy', json: { word: WORD_BLOCK } }] },
  };
  const dir = tmp('rule-efs-');
  const script = path.join(dir, 'child.js');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(script, `'use strict';
const ROOT = ${JSON.stringify(ROOT)};
const out = { cases: {} };
(async () => {
  try {
    const { readerOver } = require(ROOT + '/test/helpers/graphFake.js');
    const C = require(ROOT + '/test/helpers/conceptGraph.js');
    const E = require(ROOT + '/test/helpers/createElementGraph.js');
    const rules = require(${JSON.stringify(RULES_INDEX)});
    const rule = rules.findRule(${JSON.stringify(NAME)});
    out.rule = rule ? { name: rule.name, summary: rule.summary, refuses: rule.refuses, refusals: rule.refusals } : null;
    out.problems = rules.loadRules().problems;
    if (!rule) throw new Error('the rule ${NAME} is not loaded (src/operations/rules/${NAME}.js)');
    const seed = await E.seedCreateElement();
    const s = seed.state;
    const k = seed.keys;
    const add = (labels, props) => { const n = { eid: s.nextEid++, labels, props: { ...props, tapestryKey: require('crypto').randomUUID() } }; s.nodes.push(n); return n; };
    const link = (a, type, b) => s.rels.push({ eid: s.nextEid++, type, from: a.eid, to: b.eid, props: {} });
    const withJson = (name, holder, value) => {
      const n = add(['ListItem', 'TapestryNode'], { uuid: '39999:' + E.TA + ':' + name, kind: 39999, pubkey: E.TA, name });
      link(n, 'HAS_TAG', add(['NostrEventTag', 'TapestryNode'], { type: 'json', value, uuid: name + '-json' }));
      link(C.node(s, holder), 'HAS_ELEMENT', n);
      k[name] = n.props.tapestryKey;
    };
    withJson('walker', k.walkers, JSON.stringify({ word: { slug: 'dog--walker', name: 'dog: Walker', wordTypes: ['word', 'dog', 'pet'] }, dog: { name: 'Walker', slug: 'walker' } }));
    withJson('broken', k.beagleSuperset, '{"beagle": {"name": "Bro');
    withJson('lexeme', k.supersets.word, JSON.stringify({ word: { slug: 'lexeme', name: 'lexeme', wordTypes: ['word'] } }));
    // wordy: a concept whose schema is firmware word's own (story 42), its header, superset and schema node.
    const wordyHeader = add(['NostrEvent', 'ListHeader', 'ConceptHeader', 'TapestryNode'], { uuid: '39998:' + E.TA + ':wordy', kind: 39998, pubkey: E.TA, name: 'wordy' });
    const wordySuperset = add(['NostrEvent', 'ListItem', 'Superset', 'TapestryNode'], { uuid: '39999:' + E.TA + ':wordy-superset', kind: 39999, pubkey: E.TA, name: 'wordies' });
    link(wordyHeader, 'IS_THE_CONCEPT_FOR', wordySuperset);
    const wordySchema = add(['NostrEvent', 'ListItem', 'JSONSchema', 'TapestryNode'], { uuid: '39999:' + E.TA + ':wordy-schema', kind: 39999, pubkey: E.TA, name: 'schema for wordy' });
    link(wordySchema, 'IS_THE_JSON_SCHEMA_FOR', wordyHeader);
    link(wordySchema, 'HAS_TAG', add(['NostrEventTag', 'TapestryNode'], { type: 'json', value: require('fs').readFileSync(ROOT + '/firmware/versions/v1.0.0/concepts/word/json-schema.json', 'utf8'), uuid: 'wordy-schema-json' }));
    k.wordy = wordyHeader.props.tapestryKey;
    k.wordySuperset = wordySuperset.props.tapestryKey;
    const wordBlock = ${JSON.stringify(WORD_BLOCK)};
    withJson('wordFull', k.wordySuperset, JSON.stringify({ word: wordBlock }));
    withJson('wordNoContext', k.wordySuperset, JSON.stringify({ word: wordBlock }));
    withJson('wordFar', k.wordySuperset, JSON.stringify({ word: wordBlock }));
    const beagleTag = (description) => JSON.stringify(${JSON.stringify(beagleJson('§'))}).replace('"§"', JSON.stringify(description));
    withJson('diffFits', k.beagleSuperset, JSON.stringify(${JSON.stringify(beagleJson(undefined))}));
    withJson('diffMisses', k.beagleSuperset, beagleTag('the json tag has it'));
    withJson('noEntry', k.beagleSuperset, beagleTag('a json tag that fits'));
    withJson('farMisses', k.beagleSuperset, beagleTag('the json tag has it'));
    // Each node's tapestryJson, in the child's own store (story 42): rover's, walker's and lexeme's as their json tags
    // hold it; broken's a list; diffFits' with the description its tag lacks, diffMisses' without the one its tag has;
    // wordFull's with the graphContext the derive step builds, wordNoContext's without; wordFar's and farMisses' with a
    // derivedAt beyond the Date range (review round 2, non-blocking 1); none for noEntry or loner.
    const store = require(ROOT + '/src/lib/tapestry-store.js');
    await store.put(k.rover, C.json(s, k.rover));
    await store.put(k.walker, C.json(s, k.walker));
    await store.put(k.lexeme, C.json(s, k.lexeme));
    await store.put(k.broken, [1, 2]);
    await store.put(k.diffFits, ${JSON.stringify(beagleJson('the tapestryJson has it'))});
    await store.put(k.diffMisses, { ...${JSON.stringify(beagleJson(undefined))}, graphContext: { identifiers: { tapestryKey: k.diffMisses }, derivedAt: 1700000000 } });
    await store.put(k.wordFull, { word: wordBlock, graphContext: { identifiers: { tapestryKey: k.wordFull }, elementOf: { direct: [], indirect: [] }, parentJsonSchemas: [], derivedAt: 1 } });
    await store.put(k.wordNoContext, { word: wordBlock });
    await store.put(k.wordFar, { word: wordBlock, graphContext: { identifiers: { tapestryKey: k.wordFar }, elementOf: { direct: [], indirect: [] }, parentJsonSchemas: [], derivedAt: 1e13 } });
    await store.put(k.farMisses, { ...${JSON.stringify(beagleJson(undefined))}, graphContext: { identifiers: { tapestryKey: k.farMisses }, derivedAt: 1e13 } });
    const resolve = (v) => (typeof v === 'string' && v.startsWith('@') ? (v === '@nobody' ? '00000000-0000-4000-8000-0000000000cc' : k[v.slice(1)]) : v);
    const name = (key) => Object.keys(k).find((x) => k[x] === key) || key;
    out.keys = { beagle: k.beagle, dog: k.dog, pet: k.pet, word: k.word, walker: k.walker };
    for (const [id, c] of Object.entries(${JSON.stringify(cases)})) {
      const items = c.items.map((it) => Object.fromEntries(Object.entries(it).map(([f, v]) => [f, resolve(v)])));
      const base = readerOver(s);
      let schemaReads = 0;
      const read = async (q, p) => { if (/IS_THE_JSON_SCHEMA_FOR/.test(String(q))) schemaReads++; return base(q, p); };
      try {
        if (c.check) {
          const X = require(${JSON.stringify(SCHEMAS)});
          try { await X.checkElements(read, items); out.cases[id] = { passed: true }; }
          catch (e) { out.cases[id] = { threw: { isRefusal: e && e.isRefusal === true, code: e && e.code, rule: e && e.extra && e.extra.rule, message: String(e && e.message) } }; }
          continue;
        }
        const found = await rule.violations(items, read);
        out.cases[id] = { schemaReads, violations: found.map((v) => ({ node: name(v.item && v.item.node), concept: name(v.item && v.item.concept), code: v.code, message: v.message, missing: v.missing === true, derivedAt: v.derivedAt, problems: (v.problems || []).map((x) => x.message), item: v.item ? Object.fromEntries(Object.entries(v.item).filter(([f]) => f !== 'json').map(([f, x]) => [f, name(x)])) : null, findingConcept: name(v.concept) })) };
      } catch (e) { out.cases[id] = { error: String(e && e.message || e) }; }
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
  CACHE = out;
  return out;
}
function result(id) {
  needRule();
  const out = runCases();
  assert(!out.error, `the child failed: ${out.error}`);
  const c = out.cases[id];
  assert(c && !c.error, `case ${id} failed: ${show(c)}`);
  return c;
}
const codes = (c) => c.violations.map((v) => v.code);

test('EFS1: the rules\' loader finds it: its name, a summary, refuses: true, and invalid-fields (400) and no-schema (409)', () => {
  needRule();
  const out = runCases();
  assert(out.rule, `the loader must find ${NAME}; problems: ${show(out.problems)} ${out.error || ''}`);
  assert(out.rule.name === NAME && typeof out.rule.summary === 'string' && out.rule.summary.length > 10 && out.rule.refuses === true, `its name, a summary, refuses: true; got ${show(out.rule)}`);
  assert(/tapestryJson/.test(out.rule.summary), `its summary says it judges a node's tapestryJson (ADR 0042 Decision 7); got ${show(out.rule.summary)}`);
  const st = Object.fromEntries(out.rule.refusals.map((r) => [r.code, r.status]));
  assert(show(Object.keys(st).sort()) === show(['invalid-fields', 'no-schema']) && st['invalid-fields'] === 400 && st['no-schema'] === 409,
    `its refusals are invalid-fields (400) and no-schema (409), and nothing else; got ${show(out.rule.refusals)}`);
});

test('EFS2: { concept, json }: what fits gives nothing; what doesn\'t gives one finding listing every problem; no schema gives no-schema', () => {
  assert(show(result('fits').violations) === show([]), `JSON that fits beagle's schema: no finding; got ${show(result('fits'))}`);
  const m = result('missing');
  assert(show(codes(m)) === show(['invalid-fields']) && /`?beagle\.description`? is required/.test(m.violations[0].message), `a missing description: one invalid-fields finding naming it; got ${show(m)}`);
  const two = result('twoProblems');
  assert(show(codes(two)) === show(['invalid-fields']) && /gadget\.size/.test(two.violations[0].message) && /gadget\.weight/.test(two.violations[0].message), `one finding, listing both problems; got ${show(two)}`);
  const wt = result('wordTypes');
  assert(show(codes(wt)) === show(['invalid-fields']) && /word\.wordTypes/.test(wt.violations[0].message), `dog's schema, draft 2020-12 named, ties the breed to wordTypes, as the derive step reads it; got ${show(wt)}`);
  for (const id of ['nobody', 'notHeader']) assert(show(result(id).violations) === show([]), `${id}: a key that names no concept header gives no finding: the operation's own refusal answers for it; got ${show(result(id))}`);
  for (const id of ['noSchema', 'noCompile']) assert(show(codes(result(id))) === show(['no-schema']), `${id}: no-schema; got ${show(result(id))}`);
});

test('EFS3: { node } and { node, concept }: its tapestryJson, judged against each concept that reaches it, or the one named; tapestryJson that isn\'t an object is one finding', () => {
  assert(show(result('rover').violations) === show([]), `rover fits beagle, the one concept that reaches it; got ${show(result('rover'))}`);
  const w = result('walker');
  assert(show(codes(w)) === show(['invalid-fields']) && /pet/.test(w.violations[0].message), `walker fits dog but not pet, which wants a pet section: one finding, for pet; got ${show(w)}`);
  assert(show(result('walkerDog').violations) === show([]), `named dog, walker fits; got ${show(result('walkerDog'))}`);
  assert(show(codes(result('walkerPet'))) === show(['invalid-fields']), `named pet, it doesn't; got ${show(result('walkerPet'))}`);
  const b = result('broken');
  assert(show(codes(b)) === show(['invalid-fields']) && /tapestryJson/.test(b.violations[0].message) && /object/.test(b.violations[0].message) && b.violations[0].missing !== true,
    `broken's tapestryJson is a list: one invalid-fields finding saying it isn't an object, not marked missing (ADR 0042 Decision 1); its unparseable json tag isn't read; got ${show(b)}`);
  assert(show(result('loner').violations) === show([]), `a node no concept reaches gives nothing: that is rule 3's business; got ${show(result('loner'))}`);
  assert(show(codes(result('lexeme'))) === show(['no-schema']), `an element of a concept with no schema: one no-schema finding; got ${show(result('lexeme'))}`);
});

test('EFS4: within one call, a concept\'s schema is read once, however many items name it', () => {
  const one = result('once1');
  const ten = result('once10');
  assert(one.schemaReads >= 1 && ten.schemaReads === one.schemaReads, `ten items of beagle read its schema as often as one does (Decision 12: compiled once per concept per call); got ${one.schemaReads} and ${ten.schemaReads}`);
  assert(show(ten.violations) === show([]), 'and all ten fit');
});

test('EFS5: _schemas.checkElements throws the rule\'s first finding as a refusal, with rule set, and passes what fits', () => {
  if (!fs.existsSync(SCHEMAS)) throw new Error('src/operations/catalog/graph/_schemas.js does not exist yet (ADR graph-operations-first-slice/0020 Decision 11)');
  const t = result('checkThrows');
  assert(t.threw && t.threw.isRefusal && t.threw.code === 'invalid-fields' && t.threw.rule === NAME && /beagle\.description/.test(t.threw.message),
    `the second item's finding is thrown as the rule's refusal, as K.recheck does; got ${show(t)}`);
  assert(result('checkPasses').passed === true, `items that fit pass; got ${show(result('checkPasses'))}`);
});

test('EFS6: the rulebook holds its entry, §7, in its format, with its codes, its code\'s file and its source', () => {
  const doc = fs.readFileSync(RULEBOOK, 'utf8');
  const at = doc.search(new RegExp('^## 7\\. `' + NAME + '`\\s*$', 'm'));
  assert(at >= 0, `docs/GRAPH_RULES.md has an entry headed "## 7. \`${NAME}\`" (ADR 0020 Decision 12)`);
  const rest = doc.slice(at + 1);
  const next = rest.search(/^## /m);
  const entry = next >= 0 ? rest.slice(0, next) : rest;
  for (const label of ['Says', 'Kind', 'Refuses or reports', 'Check', 'Repair', 'Enforced by', 'Status', 'Source']) {
    assert(new RegExp(`^- \\*\\*${label}:\\*\\*`, 'm').test(entry), `its entry has the field ${label} (the rulebook's eight labels)`);
  }
  assert(/`invalid-fields` \(400\)/.test(entry) && /`no-schema` \(409\)/.test(entry), 'its refusals are written as the rulebook writes them');
  assert(entry.includes(`src/operations/rules/${NAME}.js`) && entry.includes('create-element'), 'Enforced by names the rule\'s file and create-element\'s guard');
  assert(/graph-operations-first-slice\/0020/.test(entry), 'its source is ADR graph-operations-first-slice/0020');
  assert(/rule 4/.test(entry), 'it says it is BIBLE §10\'s rule 4');
  const says = (entry.match(/^- \*\*Says:\*\*[^\n]*(?:\n(?!- \*\*)[^\n]*)*/m) || [''])[0];
  assert(/tapestryJson/.test(says) && /fully realized/i.test(says), `its Says field: a node's fully realized tapestryJson fits the schema of each concept it is an element of (story 42, AC5; ADR 0042 Decision 7); got ${show(says)}`);
  assert(/exception/i.test(entry), 'it says exceptions to the rule will come (ADR 0020a Decision 2)');
  assert(/`missing`/.test(entry) && /no tapestryJson/i.test(entry), 'its Check says a node with no tapestryJson gives one finding, marked `missing`');
  assert(/waiting/.test(entry) && /graphContext/.test(entry) && /derive step/.test(entry), 'its Refuses or reports says a write\'s problems only about graphContext, which the derive step builds, are set aside, the concept reported as waiting');
  const source = (entry.match(/^- \*\*Source:\*\*[^\n]*/m) || [''])[0];
  assert(/0020a/.test(source) && /0042/.test(source), `its Source names ADR 0020a and ADR 0042 beside ADR 0020; got ${show(source)}`);
  assert(/^\*\*Status:\*\* Accepted\b/m.test(fs.readFileSync(ADR_0020A, 'utf8')), 'ADR 0020a reads as accepted: its decider merged it (story 42, AC5; TapestryProtocol/tapestry#125)');
});

test('EFS7: the graph rule concept\'s firmware has its element, as node src/firmware/graph-rules.js makes it, saying it judges tapestryJson', () => {
  assert(fs.existsSync(ELEMENT_FILE), `firmware/versions/v1.0.0/concepts/graph-rule/elements/${NAME}.json exists (ADR 0020 Decision 12, made by node src/firmware/graph-rules.js)`);
  const el = JSON.parse(fs.readFileSync(ELEMENT_FILE, 'utf8'));
  assert(el.graphRule && el.graphRule.name === NAME, `its graphRule section names the rule; got ${show(el.graphRule && el.graphRule.name)}`);
  assert(/tapestryJson/.test(JSON.stringify(el.graphRule)), 'its graphRule section, made from the rulebook, says the rule judges tapestryJson: rule 7\'s element in the graph says so after a reinstall (story 42, AC5)');
  const check = spawnSync(process.execPath, [path.join(ROOT, 'src/firmware/graph-rules.js'), '--check'], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
  assert(check.status === 0, `node src/firmware/graph-rules.js --check finds the files as the rulebook makes them; exit ${check.status}: ${(check.stdout + check.stderr).slice(-400)}`);
});

test('EFS8: where a node\'s tapestryJson and its json tag differ, the tapestryJson decides, under beagle\'s schema and firmware word\'s', () => {
  assert(show(result('diffFits').violations) === show([]), `diffFits: its json tag lacks the description, its tapestryJson has it: it fits (story 42, AC1); got ${show(result('diffFits'))}`);
  const m = result('diffMisses');
  assert(show(codes(m)) === show(['invalid-fields']) && m.violations[0].problems.some((p) => /beagle\.description/.test(p)), `diffMisses: its json tag has the description, its tapestryJson doesn't: invalid-fields, naming it; got ${show(m)}`);
  assert(m.violations[0].derivedAt === 1700000000, `the finding says when the tapestryJson it judged was built, its graphContext.derivedAt (ADR 0020a Decision 5; review round 1, non-blocking 5); got ${show(m.violations[0])}`);
  assert(show(result('wordFull').violations) === show([]), `wordFull: a tapestryJson with its graphContext fits firmware word's schema, though its json tag has none; got ${show(result('wordFull'))}`);
  const n = result('wordNoContext');
  assert(show(codes(n)) === show(['invalid-fields']) && n.violations[0].problems.some((p) => /graphContext/.test(p)),
    `wordNoContext: a tapestryJson with no graphContext doesn't fit firmware word's schema; the check form sets nothing aside (ADR 0042 Decision 2); got ${show(n)}`);
  assert(n.violations[0].derivedAt === undefined, `and with no graphContext, no build date to give; got ${show(n.violations[0])}`);
});

test('EFS9: a node with no tapestryJson is one finding marked missing, nothing for each concept, and its json tag isn\'t read in its place', () => {
  const r = result('noEntry');
  assert(r.violations.length === 1, `one finding for the node, not one for each concept (story 42, AC2); got ${show(r)}`);
  const v = r.violations[0];
  assert(v.code === 'invalid-fields' && v.missing === true && /tapestryJson/.test(v.message) && !v.findingConcept,
    `invalid-fields, marked missing, saying it has no tapestryJson yet; no concept named, since none could be judged (ADR 0042 Decision 2); got ${show(v)}`);
  assert(/derive/i.test(v.message), `it says the derive step builds it; got ${show(v.message)}`);
});

test('EFS10: { concept, json }, a write\'s JSON, sets aside the problems only about graphContext: a full word block passes; one with no slug is reported for the slug alone', () => {
  assert(show(result('writeWordFull').violations) === show([]), `a word block with its slug and wordTypes, and no graphContext, under firmware word's schema: no finding, nothing to refuse (story 42, AC4); got ${show(result('writeWordFull'))}`);
  assert(result('checkWordFull').passed === true, `checkElements passes it: a write isn't refused for graphContext (ADR 0042 Decision 3); got ${show(result('checkWordFull'))}`);
  const s = result('writeWordNoSlug');
  assert(show(codes(s)) === show(['invalid-fields']) && s.violations[0].problems.some((p) => /word\.slug/.test(p)) && !s.violations[0].problems.some((p) => /graphContext/.test(p)) && !/graphContext/.test(s.violations[0].message),
    `a word block with no slug: one finding, for word.slug alone, graphContext set aside; got ${show(s)}`);
});

test('EFS11: a stored derivedAt beyond the Date range doesn\'t stop the check: what fits gives nothing; what doesn\'t gives the number, with no date', () => {
  const f = result('wordFar');
  assert(show(f.violations) === show([]), `wordFar's tapestryJson fits firmware word's schema; its derivedAt, 1e13 seconds, is past the last date a Date can hold, and the check must neither throw nor report it; got ${show(f)}`);
  const m = result('farMisses');
  assert(show(codes(m)) === show(['invalid-fields']) && m.violations[0].problems.some((p) => /beagle\.description/.test(p)), `farMisses: invalid-fields for its missing description, as diffMisses; got ${show(m)}`);
  const v = m.violations[0];
  assert(v.derivedAt === 1e13, `the finding still gives the derivedAt it judged (ADR 0020a Decision 5); got ${show(v)}`);
  assert(v.message.includes(String(1e13)) && !/\d{4}-\d{2}-\d{2}T/.test(v.message), `its message gives the number, ${String(1e13)}, and no date, since none can be made from it; got ${show(v.message)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
