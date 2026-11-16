'use strict';
/**
 * The rule field-mark-allowed — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-foundation/5-field-mapping.md (AC3)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0005-field-mapping.md (Decisions 3–6, 15)
 *
 * Stack-free. The rule's one definition, violations(items, read), is called directly, in a child process with the TA
 * set, over graphs test/helpers/fieldGraph.js seeds (through graphFake's readerOver), as the write path calls it as a
 * guard and rules check (A10.31) will call it as a check. An item names its concept as '@<name>', the seed's key for it.
 *
 *   FR1  the rules' loader finds it: its name, a summary, refuses: true, and its eight refusals with their statuses
 *   FR2  a field it allows passes: an unwrapped concept's, a wrapped one's, an imported (ListHeader) one's, one whose
 *        type list adds null
 *   FR3  not-installed: no concept for neo4j properties, or no first set; the message says to install the firmware
 *   FR4  unknown-concept: a key nothing has, or a node that isn't a concept header; the message names the key
 *   FR5  unknown-field: not a top-level field of the concept (a child of the word section, a field that has left the
 *        schema though its node is in the tree); the message names the concept's top-level fields
 *   FR6  no-property-node: no node, only create-property's node off the schema node, or no primary property; the
 *        message says to run generate-property-tree first, and that it signs
 *   FR7  not-plain: an object, a list of objects, a list of lists; the message says what the field holds
 *   FR8  unusable-name: a concept key that isn't letters and digits; the message names it
 *   FR9  property-taken: another concept with the same key has marked a field of the same name; the message names it
 *   FR10 property-in-use: an element already carries the name and the field isn't marked; the message names a node
 *   FR11 the order of the table: each case that breaks two checks is refused with the earlier one
 *   FR12 a repeat on a marked field passes: property-taken and property-in-use skip the field's own mark
 *   FR13 as a check over many marks at once, it names each that broke since it was made (a changed type, a lost
 *        property node, a collision) and only those
 *   FR14 the rules document holds its entry, with its codes and the naming convention
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const FG = require('../../helpers/fieldGraph');

const { ROOT, TA, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: rule field-mark-allowed');

const RULES_INDEX = path.join(ROOT, 'src/operations/rules/index.js');
const RULE_FILE = path.join(ROOT, 'src/operations/rules/field-mark-allowed.js');
const NAME = 'field-mark-allowed';
const NOBODY = '00000000-0000-4000-8000-0000000000dd';
const ORDER = ['not-installed', 'unknown-concept', 'unknown-field', 'no-property-node', 'not-plain', 'unusable-name', 'property-taken', 'property-in-use'];

/** Run the rule in a child over each case's own seed; each case answers { items, keys, violations } or { error }. */
function runRule(cases) {
  const dir = tmp('rule-fma-');
  const script = path.join(dir, 'child.js');
  // The answer goes to a file: written to a pipe and followed by process.exit, a long one would be cut short.
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(script, `'use strict';
const ROOT = ${JSON.stringify(ROOT)};
const out = {};
(async () => {
  try {
    const { readerOver } = require(ROOT + '/test/helpers/graphFake.js');
    const FG = require(ROOT + '/test/helpers/fieldGraph.js');
    const rules = require(${JSON.stringify(RULES_INDEX)});
    const rule = rules.findRule(${JSON.stringify(NAME)});
    out.rule = rule ? { name: rule.name, summary: rule.summary, refuses: rule.refuses, refusals: rule.refusals, hasViolations: typeof rule.violations === 'function' } : null;
    if (rule) {
      out.cases = {};
      for (const [name, c] of Object.entries(${JSON.stringify(cases)})) {
        const seed = FG.seedFields(c.seed || {});
        const resolve = (x) => (typeof x === 'string' && x.startsWith('@') ? seed.keys[x.slice(1)] : x);
        const items = c.items.map((it) => ({ concept: resolve(it.concept), field: it.field }));
        try { out.cases[name] = { items, keys: seed.keys, violations: await rule.violations(items, readerOver(seed.state)) }; }
        catch (e) { out.cases[name] = { items, error: String((e && e.message) || e) }; }
      }
    }
  } catch (e) { out.error = String((e && e.stack) || e); }
  require('fs').writeFileSync(${JSON.stringify(outFile)}, JSON.stringify(out));
  process.exit(0);
})();
`);
  const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  assert(fs.existsSync(outFile), `the rule's child must answer: ${(child.stderr || '').slice(-600)}`);
  const out = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  if (out.error) throw new Error(`the rule's child failed: ${out.error.split('\n').slice(0, 3).join(' | ')}`);
  if (!out.rule) {
    if (!fs.existsSync(RULE_FILE)) throw new Error('src/operations/rules/field-mark-allowed.js does not exist yet (ADR graph-operations-foundation/0005 Decision 5)');
    throw new Error(`the rules' loader must find ${NAME}: it left it out (see its warning on the child's stderr: ${(child.stderr || '').slice(-300)})`);
  }
  return out;
}

const item = (concept, field) => ({ concept, field });
const CASES = {
  passDog: { items: [item('@dog', 'breed')] },
  passWrapped: { items: [item('@widget', 'color')] },
  passImported: { items: [item('@cat', 'color')] },
  passNullable: { items: [item('@dog', 'color')] },
  noConcept: { items: [item('@dog', 'breed')], seed: { noConcept: true } },
  noFirstSet: { items: [item('@dog', 'breed')], seed: { noFirstSet: true } },
  unknownKey: { items: [item(NOBODY, 'breed')] },
  notAHeader: { items: [item('@rover', 'breed')] },
  wordSection: { items: [item('@dog', 'wordTypes')] },
  leftSchema: { items: [item('@dog', 'retired')] },
  noNode: { items: [item('@dog', 'microchip')] },
  createPropertyOnly: { items: [item('@dog', 'nickname')] },
  noPrimaryProperty: { items: [item('@rock', 'hardness')] },
  object: { items: [item('@dog', 'owner')] },
  listOfObjects: { items: [item('@dog', 'toys')] },
  listOfLists: { items: [item('@dog', 'grid')] },
  unusable: { items: [item('@weird', 'color')] },
  taken: { items: [item('@dog', 'name')], seed: { marks: [['otherDog', 'name']] } },
  inUse: { items: [item('@dog', 'slug')], seed: { copies: { spot: { dog_slug: 'written-by-hand' } } } },
  // FR11: each breaks the two checks named, and must be refused with the first.
  order1: { items: [item(NOBODY, 'breed')], seed: { noConcept: true } }, // not-installed, unknown-concept
  order2: { items: [item('@dog', 'collar')] }, // no-property-node (collar has no node), not-plain (an object)
  order3: { items: [item('@weird', 'shape')] }, // not-plain (an object), unusable-name
  order4: { items: [item('@weird', 'color')], seed: { marks: [['otherWeird', 'color']] } }, // unusable-name, property-taken
  order5: { items: [item('@dog', 'name')], seed: { marks: [['otherDog', 'name']], copies: { spot: { dog_name: 'written-by-hand' } } } }, // property-taken, property-in-use
  repeat: { items: [item('@dog', 'breed')], seed: { marks: [['dog', 'breed']], copies: { rover: { dog_breed: 'goldenRetriever' }, spot: { dog_breed: 'irishSetter' } } } },
  check: {
    items: [item('@dog', 'breed'), item('@dog', 'age'), item('@dog', 'weight'), item('@widget', 'color')],
    seed: {
      marks: [['dog', 'breed'], ['otherDog', 'breed'], ['dog', 'age'], ['dog', 'weight'], ['widget', 'color']],
      dogFields: { ...FG.DOG_FIELDS, age: { type: 'object', properties: { years: { type: 'integer' } } } },
      unhook: [['widget', 'color']],
      copies: { rover: { dog_breed: 'goldenRetriever', dog_weight: 30.5 } },
    },
  },
};

let MAIN = null;
const main = () => { if (!MAIN) MAIN = runRule(CASES); return MAIN; };
function only(name) {
  const c = main().cases[name];
  assert(c && !c.error, `case ${name} must run; got ${show(c)}`);
  return c;
}
/** The first violation the rule reports for a case's one item, or null. */
function first(name) {
  const c = only(name);
  const v = (c.violations || []).filter((x) => x && x.item && x.item.concept === c.items[0].concept && x.item.field === c.items[0].field);
  return v.length ? v[0] : null;
}
function refusedWith(name, code, says, what) {
  const v = first(name);
  assert(v && v.code === code, `${name}: the first violation is ${code}; got ${show(only(name).violations)}`);
  if (says) assert(says(String(v.message), only(name).keys), `${name}: the message names ${what}; got ${show(v.message)}`);
  return v;
}

test('FR1: the rules\' loader finds field-mark-allowed, with its name, summary, refuses: true and its eight refusals', () => {
  const r = main().rule;
  assert(r.name === NAME && typeof r.summary === 'string' && r.summary.trim() && r.hasViolations, `its name, a summary and violations(items, read); got ${show(r)}`);
  assert(r.refuses === true, `it refuses a write (ADR 0005 Decision 5); got ${show(r.refuses)}`);
  const codes = (r.refusals || []).map((x) => `${x.code}:${x.status}`).sort();
  const want = ['not-installed:409', 'unknown-concept:404', 'unknown-field:404', 'no-property-node:409', 'not-plain:409', 'unusable-name:409', 'property-taken:409', 'property-in-use:409'].sort();
  assert(show(codes) === show(want), `its refusals are the table's eight, with their statuses; got ${show(r.refusals)}`);
});

test('FR2: a field it allows passes: unwrapped, wrapped, imported (ListHeader only), and one whose type list adds null', () => {
  for (const name of ['passDog', 'passWrapped', 'passImported', 'passNullable']) {
    assert(show(only(name).violations) === '[]', `${name}: no violation; got ${show(only(name).violations)}`);
  }
});

test('FR3: not-installed when the graph has no concept for neo4j properties, or no first set', () => {
  for (const name of ['noConcept', 'noFirstSet']) refusedWith(name, 'not-installed', (m) => /firmware/i.test(m) && /install/i.test(m), 'that the firmware must be installed first');
});

test('FR4: unknown-concept for a key nothing has, and for a node that isn\'t a concept header, naming the key', () => {
  refusedWith('unknownKey', 'unknown-concept', (m) => m.includes(NOBODY), 'the key');
  refusedWith('notAHeader', 'unknown-concept', (m, k) => m.includes(k.rover), 'the key');
});

test('FR5: unknown-field for a name that isn\'t one of the concept\'s top-level fields, naming those fields', () => {
  refusedWith('wordSection', 'unknown-field', (m) => /breed/.test(m) && /slug/.test(m), 'dog\'s top-level fields');
  refusedWith('leftSchema', 'unknown-field', null);
});

test('FR6: no-property-node for no node, only create-property\'s node, or no primary property, pointing to generate-property-tree', () => {
  for (const name of ['noNode', 'createPropertyOnly', 'noPrimaryProperty']) {
    refusedWith(name, 'no-property-node', (m) => /generate-property-tree/.test(m) && /sign/i.test(m), 'POST /api/normalize/generate-property-tree, and that it signs');
  }
});

test('FR7: not-plain for an object, a list of objects and a list of lists, saying what the field holds', () => {
  refusedWith('object', 'not-plain', (m) => /object/i.test(m), 'an object');
  refusedWith('listOfObjects', 'not-plain', (m) => /object/i.test(m), 'a list of objects');
  refusedWith('listOfLists', 'not-plain', (m) => /array|list/i.test(m), 'a list of lists');
});

test('FR8: unusable-name for a concept key that isn\'t letters and digits, naming it', () => {
  refusedWith('unusable', 'unusable-name', (m) => m.includes('weird-thing'), 'the name');
});

test('FR9: property-taken when another concept with the same key has marked a field of the same name, naming that concept', () => {
  refusedWith('taken', 'property-taken', (m, k) => m.includes(k.otherDog) || m.includes(`39998:${FG.OTHER}:dog`), 'the other dog concept');
});

test('FR10: property-in-use when an element already carries the name and the field isn\'t marked, naming a node', () => {
  refusedWith('inUse', 'property-in-use', (m, k) => m.includes(k.spot) || m.includes(`39999:${TA}:spot`), 'spot, which carries dog_slug');
});

test('FR11: the table\'s order: a field that breaks two checks is refused with the earlier one', () => {
  const pairs = [['order1', 'not-installed', 'unknown-concept'], ['order2', 'no-property-node', 'not-plain'], ['order3', 'not-plain', 'unusable-name'], ['order4', 'unusable-name', 'property-taken'], ['order5', 'property-taken', 'property-in-use']];
  for (const [name, earlier, later] of pairs) {
    assert(ORDER.indexOf(earlier) < ORDER.indexOf(later), 'the pairs follow the table');
    const v = first(name);
    assert(v && v.code === earlier, `${name} breaks ${earlier} and ${later}: the first violation is ${earlier}; got ${show(only(name).violations)}`);
  }
});

test('FR12: a repeat on a marked field passes: the last two checks skip the field\'s own mark and its copies', () => {
  assert(show(only('repeat').violations) === '[]', `dog's breed, marked and carried, passes again; got ${show(only('repeat').violations)}`);
});

test('FR13: as a check over many marks at once, it names each that broke since it was made, and only those', () => {
  const c = only('check');
  const firstOf = (field, concept) => (c.violations || []).find((v) => v.item && v.item.field === field && v.item.concept === concept);
  const got = { breed: firstOf('breed', c.keys.dog), age: firstOf('age', c.keys.dog), weight: firstOf('weight', c.keys.dog), color: firstOf('color', c.keys.widget) };
  assert(got.breed && got.breed.code === 'property-taken', `dog's breed now collides with otherDog's mark: property-taken; got ${show(got.breed)}`);
  assert(got.age && got.age.code === 'not-plain', `dog's age is an object now: not-plain; got ${show(got.age)}`);
  assert(got.color && got.color.code === 'no-property-node', `widget's color node has left the tree: no-property-node; got ${show(got.color)}`);
  assert(!got.weight, `dog's weight is still fine: no violation; got ${show(got.weight)}`);
});

test('FR14: the rules document holds field-mark-allowed\'s entry, with its codes and the naming convention', () => {
  const doc = fs.readFileSync(path.join(ROOT, 'docs/GRAPH_RULES.md'), 'utf8');
  const at = doc.search(/^## 3\.[^\n]*field-mark-allowed/m);
  assert(at >= 0, 'docs/GRAPH_RULES.md has no entry 3 for field-mark-allowed yet (ADR graph-operations-foundation/0005 Decision 15)');
  const next = doc.slice(at + 4).search(/^## /m);
  const entry = next >= 0 ? doc.slice(at, at + 4 + next) : doc.slice(at);
  for (const label of ['Says', 'Kind', 'Refuses or reports', 'Check', 'Repair', 'Enforced by']) assert(entry.includes(`**${label}:**`), `the entry is in the entry format: it has **${label}:**`);
  for (const code of ORDER) assert(entry.includes(code), `the entry names ${code}`);
  assert(/refuses/i.test(entry), 'the entry says it refuses a write');
  assert(/<[^>]*key[^>]*>_<[^>]*field[^>]*>|dog_breed/.test(entry), 'the entry gives the naming convention, <key>_<field> (Decision 4)');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
