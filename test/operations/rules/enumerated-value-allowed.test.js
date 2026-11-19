'use strict';
/**
 * The rule enumerated-value-allowed (the rulebook's rule 10) — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/19-enumerate.md (AC2 and AC3)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0019-enumerate-and-unenumerate.md (Option A;
 *          Decisions 6, 7 and 13)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/19-enumerate.test-plan.md
 *
 * Stack-free. The rule's one definition, violations(items, read), is called directly, in a child process with the TA
 * and the owner set (test/helpers/graphOpsSuite.js's childEnv), over the graph test/helpers/enumerationGraph.js seeds
 * (it says what the graph holds), through graphFake's readerOver, as the element writes call it, with { concept, json }
 * items. The links are made first, as today's route makes them: project's superset to bot's project, projects and
 * nickname; person's superset to bot's team.lead and to person's mentor; project's superset to grok bot's project,
 * whose tree is tangled, its property also IS_A_PROPERTY_OF its JSON schema node (Grok Bots' shape); and firmware's
 * shape, person's superset to bot's JSON schema node, with a destinationPath naming bot.spare.
 *
 *   EV1  the rules' loader finds it: its name, a summary, refuses: true, and its one refusal, value-not-allowed (400)
 *   EV2  a value that isn't a reference: a name, a slug, an address, a nostr: link, an uppercase key, a bare key, an
 *        empty string, a number
 *   EV3  a reference whose key names no node, or a node the source doesn't hold: another concept's element, the
 *        source's own header or superset
 *   EV4  a node the source holds whose author the owner's point of view leaves out: below the cutoff, at it, unscored,
 *        an admin below it
 *   EV5  allowed values pass: the instance's own, the owner's, a scored peer's, one with no author, one in a set below
 *   EV6  a list is judged item by item: one finding, naming each value not allowed; a list that holds only allowed
 *        values, and an empty one, pass
 *   EV7  a null, in a field whose type allows it, and a field left out, aren't judged
 *   EV8  a nested property is found by its chain, and its finding gives its place, bot.team.lead
 *   EV9  Grok Bots' shape: a property found through its chain to the primary property, though it also hangs on the
 *        JSON schema node
 *   EV10 a concept's own elements as its source: person's mentor
 *   EV11 a concept with no enumerated properties gives nothing, after one read
 *   EV12 firmware's edge to a JSON schema node is never read: the field it names isn't judged
 *   EV13 the finding: { item, concept, code, field, values, source, message }, one for each field of each item that
 *        breaks it, naming the item it is about; reads don't grow with the items
 *   EV14 the message names the field, the value, why, the source concept by name and key, and the way on
 *   EV15 the rulebook holds its entry, §10, in its format: enforced, by the three element writes, from ADR 0019
 *   EV16 the graph rule concept's firmware has its element, as node src/firmware/graph-rules.js makes it
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const EG = require('../../helpers/enumerationGraph');

const { ROOT, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: rule enumerated-value-allowed');

const NAME = 'enumerated-value-allowed';
const RULES_INDEX = path.join(ROOT, 'src/operations/rules/index.js');
const RULE_FILE = path.join(ROOT, `src/operations/rules/${NAME}.js`);
const RULEBOOK = path.join(ROOT, 'docs/GRAPH_RULES.md');
const ELEMENT_FILE = path.join(ROOT, `firmware/versions/v1.0.0/concepts/graph-rule/elements/${NAME}.json`);
const ref = EG.ref;

function needRule() {
  if (!fs.existsSync(RULE_FILE)) throw new Error(`src/operations/rules/${NAME}.js does not exist yet (ADR graph-operations-first-slice/0019 Decision 7)`);
}

let CACHE = null;
async function results() {
  if (CACHE) return CACHE;
  CACHE = (async () => {
    needRule();
    const ctx = await EG.prepareLinked('rule-10');
    const { file, c, sup, el, uuid } = ctx;
    const json = (oKey, fields) => EG.elementJson(oKey, fields);
    const bot = (fields) => ({ concept: c.bot, json: json('bot', fields) });
    const person = (fields) => ({ concept: c.person, json: json('person', fields) });
    const grok = (fields) => ({ concept: c.grokBot, json: json('grokBot', fields) });
    const tea = { concept: c.teaHouse, json: json('teaHouse', { project: 'Loom' }) };
    const one = (fields) => [bot(fields)];
    const cases = {
      name: one({ project: 'Loom' }),
      slug: one({ project: 'loom' }),
      address: one({ project: uuid[el.loom] }),
      naddr: one({ project: 'nostr:naddr1qvzqqqr4gupzpqzwyyvl4tw9c5yjxqzwyyvl4tw9c5yjxqzwyyvl4tw9c5yjxqqzq' }),
      upper: one({ project: `tapestry:${el.loom.toUpperCase()}` }),
      bare: one({ project: el.loom }),
      empty: one({ project: '' }),
      number: one({ project: 5 }),
      nobody: one({ project: ref(EG.NOBODY) }),
      notHeld: one({ project: ref(el.lapsang) }),
      header: one({ project: ref(c.project) }),
      superset: one({ project: ref(sup.project) }),
      lo: one({ project: ref(el.peerLo) }),
      atCutoff: one({ project: ref(el.atCutoff) }),
      unscored: one({ project: ref(el.unscored) }),
      adminLow: one({ project: ref(el.adminProject) }),
      own: one({ project: ref(el.infiniteHarness) }),
      ownEventless: one({ project: ref(el.loom) }),
      owners: one({ project: ref(el.ownersPlan) }),
      hi: one({ project: ref(el.peerHi) }),
      noAuthor: one({ project: ref(el.noAuthor) }),
      deep: one({ project: ref(el.deep) }),
      list: one({ projects: [ref(el.loom), 'Loom', ref(el.peerLo)] }),
      listOk: one({ projects: [ref(el.loom), ref(el.infiniteHarness)] }),
      listEmpty: one({ projects: [] }),
      nullField: one({ nickname: null }),
      nickRef: one({ nickname: ref(el.loom) }),
      nickBad: one({ nickname: 'Loom' }),
      absent: one({}),
      nested: one({ team: { lead: 'Ada' } }),
      nestedOk: one({ team: { lead: ref(el.ada) } }),
      self: [person({ mentor: ref(el.grace) })],
      selfBad: [person({ mentor: 'Grace' })],
      grok: [grok({ project: 'Infinite Harness' })],
      grokOk: [grok({ project: ref(el.infiniteHarness) })],
      noEnum: [tea],
      firmwareEdge: one({ spare: 'anything at all' }),
      twoFields: one({ project: 'Loom', projects: ['Loom'] }),
      several: [bot({ project: ref(el.loom) }), bot({ project: 'Loom' }), tea],
      many1: one({ project: ref('00000000-0000-4000-8000-000000000100') }),
      many10: Array.from({ length: 10 }, (_, i) => bot({ project: ref(`00000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`) })),
    };
    const dir = tmp('rule-eva-');
    const casesFile = path.join(dir, 'cases.json');
    const outFile = path.join(dir, 'out.json');
    const script = path.join(dir, 'child.js');
    fs.writeFileSync(casesFile, JSON.stringify(cases));
    fs.writeFileSync(script, `'use strict';
const fs = require('fs');
const ROOT = ${JSON.stringify(ROOT)};
const out = { cases: {} };
(async () => {
  try {
    const { readerOver } = require(ROOT + '/test/helpers/graphFake.js');
    const rules = require(${JSON.stringify(RULES_INDEX)});
    out.problems = rules.loadRules().problems;
    const rule = rules.findRule(${JSON.stringify(NAME)});
    out.rule = rule ? { name: rule.name, summary: rule.summary, refuses: rule.refuses, refusals: rule.refusals } : null;
    if (!rule) throw new Error('the rule ${NAME} is not loaded (src/operations/rules/${NAME}.js)');
    const state = JSON.parse(fs.readFileSync(${JSON.stringify(file)}, 'utf8'));
    const cases = JSON.parse(fs.readFileSync(${JSON.stringify(casesFile)}, 'utf8'));
    for (const [id, items] of Object.entries(cases)) {
      const base = readerOver(state);
      let reads = 0;
      const read = async (q, p) => { reads += 1; return base(q, p); };
      try {
        const found = await rule.violations(items, read);
        out.cases[id] = { reads, findings: found.map((v) => ({ index: items.indexOf(v.item), concept: v.concept, code: v.code, field: v.field, values: v.values, source: v.source, message: v.message })) };
      } catch (e) { out.cases[id] = { error: String((e && e.stack) || e).slice(0, 900) }; }
    }
  } catch (e) { out.error = String((e && e.message) || e); }
  fs.writeFileSync(${JSON.stringify(outFile)}, JSON.stringify(out));
  process.exit(0);
})();
`);
    const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(ctx.dir), timeout: 120000 });
    let out = null;
    try { out = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported below */ }
    assert(out, `the rule's child wrote no answer: ${(child.stderr || '').slice(-600)}`);
    return { out, ctx };
  })();
  return CACHE;
}
async function result(id) {
  const { out } = await results();
  assert(!out.error, `the rule's child failed: ${out.error}`);
  const c = out.cases[id];
  assert(c && !c.error, `case ${id} failed: ${show(c).slice(0, 900)}`);
  return c;
}
const codes = (c) => c.findings.map((x) => x.code);
const sorted = (xs) => [...xs].map((x) => JSON.stringify(x)).sort();
/** One value-not-allowed finding for item 0, its field ending in `field`, naming exactly `values`. */
async function oneFinding(id, field, values) {
  const c = await result(id);
  assert(show(codes(c)) === show(['value-not-allowed']), `${id}: one value-not-allowed finding; got ${show(c.findings)}`);
  const x = c.findings[0];
  assert(x.index === 0 && new RegExp(`(^|\\.)${field.replace(/\./g, '\\.')}$`).test(String(x.field)), `${id}: the finding is about the item and its field ${field}; got ${show({ index: x.index, field: x.field })}`);
  assert(show(sorted(x.values || [])) === show(sorted(values)), `${id}: it names the values not allowed, ${show(values)}, and no other; got ${show(x.values)}`);
  return x;
}
async function none(id) {
  const c = await result(id);
  assert(show(c.findings) === '[]', `${id}: no finding; got ${show(c.findings)}`);
  return c;
}

test('EV1 [Decision 7]: the rules\' loader finds it: its name, a summary, refuses: true, and its one refusal, value-not-allowed (400)', async () => {
  const { out } = await results();
  assert(out.rule, `the loader must find ${NAME}; problems: ${show(out.problems)} ${out.error || ''}`);
  assert(!(out.problems || []).some((p) => String(p.file).includes(NAME)), `the loader leaves nothing of it out; got ${show(out.problems)}`);
  assert(out.rule.name === NAME && typeof out.rule.summary === 'string' && out.rule.summary.trim().length > 10 && out.rule.refuses === true, `its name, a summary, refuses: true; got ${show(out.rule)}`);
  const st = (out.rule.refusals || []).map((r) => `${r.code}:${r.status}`);
  assert(show(st) === show(['value-not-allowed:400']), `its one refusal is value-not-allowed, 400; got ${show(out.rule.refusals)}`);
});

test('EV2 [AC2, Decision 6]: a value that isn\'t a reference: a name, a slug, an address, a nostr: link, an uppercase key, a bare key, an empty string, a number', async () => {
  const { ctx } = await results();
  const { el, uuid } = ctx;
  for (const [id, value] of [['name', 'Loom'], ['slug', 'loom'], ['address', uuid[el.loom]], ['naddr', 'nostr:naddr1qvzqqqr4gupzpqzwyyvl4tw9c5yjxqzwyyvl4tw9c5yjxqzwyyvl4tw9c5yjxqqzq'], ['upper', `tapestry:${el.loom.toUpperCase()}`], ['bare', el.loom], ['empty', ''], ['number', 5]]) {
    const x = await oneFinding(id, 'project', [value]);
    // Decision 7: the message says why. Not a reference is its own reason, not a key that names no node (EV3's).
    assert(!/names no node/i.test(x.message), `${id}: refused as not a reference, not as a key that names no node; got ${show(x.message)}`);
  }
});

test('EV3 [AC2, Decision 6]: a reference whose key names no node, or a node the source doesn\'t hold: another concept\'s element, the source\'s own header, its superset', async () => {
  const { ctx } = await results();
  const { el, c, sup } = ctx;
  const x = await oneFinding('nobody', 'project', [ref(EG.NOBODY)]);
  assert(/no node/i.test(x.message), `it says the key names no node; got ${show(x.message)}`);
  await oneFinding('notHeld', 'project', [ref(el.lapsang)]);
  await oneFinding('header', 'project', [ref(c.project)]);
  await oneFinding('superset', 'project', [ref(sup.project)]);
});

test('EV4 [AC2, Decision 6]: a node the source holds whose author the owner\'s point of view leaves out: below the cutoff, at it, unscored, an admin below it', async () => {
  const { ctx } = await results();
  const { el } = ctx;
  for (const [id, key] of [['lo', el.peerLo], ['atCutoff', el.atCutoff], ['unscored', el.unscored], ['adminLow', el.adminProject]]) {
    const x = await oneFinding(id, 'project', [ref(key)]);
    assert(/point of view/i.test(x.message), `${id}: it says the source holds it, but not from the owner's point of view; got ${show(x.message)}`);
  }
});

test('EV5 [AC2]: allowed values pass: the instance\'s own (lettered or not), the owner\'s, a scored peer\'s, one with no author, one in a set below the superset', async () => {
  for (const id of ['own', 'ownEventless', 'owners', 'hi', 'noAuthor', 'deep']) await none(id);
});

test('EV6 [AC2, Decision 6]: a list is judged item by item: one finding naming each value not allowed; one of allowed values, and an empty one, pass', async () => {
  const { ctx } = await results();
  await oneFinding('list', 'projects', ['Loom', ref(ctx.el.peerLo)]);
  await none('listOk');
  await none('listEmpty');
});

test('EV7 [Decision 6]: a null, in a field whose type allows it, and a field left out, aren\'t judged; a nullable field\'s value is', async () => {
  await none('nullField');
  await none('absent');
  await none('nickRef');
  await oneFinding('nickBad', 'nickname', ['Loom']);
});

test('EV8 [Decision 7]: a nested property is found by its chain, and its finding gives its place, bot.team.lead', async () => {
  const x = await oneFinding('nested', 'team.lead', ['Ada']);
  assert(x.message.includes('bot.team.lead'), `the message names the field by its place under the concept's key (P.placeOf); got ${show(x.message)}`);
  await none('nestedOk');
});

test('EV9 [Decision 7]: Grok Bots\' shape: its project is found through its chain to the primary property, though it also hangs on the JSON schema node', async () => {
  await oneFinding('grok', 'project', ['Infinite Harness']);
  await none('grokOk');
});

test('EV10 [AC1]: a concept\'s own elements as its source: person\'s mentor', async () => {
  await none('self');
  await oneFinding('selfBad', 'mentor', ['Grace']);
});

test('EV11 [Decision 7]: a concept with no enumerated properties gives nothing, after one read', async () => {
  const c = await none('noEnum');
  assert(c.reads === 1, `tea house, with no enumerated property, costs the first read only; got ${c.reads} reads`);
});

test('EV12 [Decision 1]: firmware\'s edge to a JSON schema node is never read: the field it names isn\'t judged', async () => {
  await none('firmwareEdge');
});

test('EV13 [Decision 7]: the finding: { item, concept, code, field, values, source, message }, one per field of each item that breaks it; reads don\'t grow with the items', async () => {
  const { ctx } = await results();
  const two = await result('twoFields');
  assert(two.findings.length === 2 && show(two.findings.map((x) => String(x.field).split('.').pop()).sort()) === show(['project', 'projects']), `two fields that break it: two findings, one for each; got ${show(two.findings)}`);
  const sev = await result('several');
  assert(sev.findings.length === 1 && sev.findings[0].index === 1, `of three items, only the second breaks it, and the finding names that item; got ${show(sev.findings)}`);
  const x = sev.findings[0];
  assert(x.concept === ctx.c.bot && x.code === 'value-not-allowed' && typeof x.message === 'string' && JSON.stringify(x.source).includes(ctx.c.project),
    `the finding gives the item's concept, the code, the source (its concept, project) and a message; got ${show(x)}`);
  const m1 = await result('many1');
  const m10 = await result('many10');
  assert(m10.findings.length === 10 && m10.reads === m1.reads, `ten items read the graph as often as one does: one read finds the concept's enumerated properties, one more judges every value (Decision 7); got ${m1.reads} and ${m10.reads}`);
});

test('EV14 [AC3, Decision 7]: the message names the field, the value, why, the source concept by name and key, and the way on', async () => {
  const { ctx } = await results();
  const x = (await result('name')).findings[0];
  const m = String(x && x.message);
  for (const part of ['bot.project', 'Loom', 'project', ctx.c.project, 'graph resolve', 'graph list-elements', 'graph create-element']) {
    assert(m.includes(part), `the message names ${part}; got ${show(m)}`);
  }
  assert(/tapestry:|reference/.test(m), `and says why: 'Loom' isn't a reference (Decision 7); got ${show(m)}`);
});

test('EV15 [Decision 13]: the rulebook holds its entry, §10, in its format: enforced, by the three element writes, from ADR 0019', () => {
  needRule();
  const doc = fs.readFileSync(RULEBOOK, 'utf8');
  const at = doc.search(new RegExp('^## 10\\. `' + NAME + '`\\s*$', 'm'));
  assert(at >= 0, `docs/GRAPH_RULES.md has an entry headed "## 10. \`${NAME}\`" (ADR 0019 Decision 13)`);
  const rest = doc.slice(at + 1);
  const next = rest.search(/^## /m);
  const entry = next >= 0 ? rest.slice(0, next) : rest;
  for (const label of ['Says', 'Kind', 'Refuses or reports', 'Check', 'Repair', 'Enforced by', 'Status', 'Source']) {
    assert(new RegExp(`^- \\*\\*${label}:\\*\\*`, 'm').test(entry), `its entry has the field ${label} (the rulebook's eight labels)`);
  }
  assert(/`value-not-allowed` \(400\)/.test(entry), 'its refusal is written as the rulebook writes one: `value-not-allowed` (400)');
  const enforced = (entry.match(/^- \*\*Enforced by:\*\*[\s\S]*?(?=^- \*\*)/m) || [''])[0];
  assert(enforced.includes(`src/operations/rules/${NAME}.js`) && ['create-element', 'update-node', 'add-to-concept'].every((w) => enforced.includes(w)), `Enforced by names the rule's file and the three element writes; got ${show(enforced)}`);
  assert(/^- \*\*Status:\*\* enforced\.?\s*$/m.test(entry), 'its status is enforced');
  assert(/^- \*\*Source:\*\*.*graph-operations-first-slice\/0019/m.test(entry), 'its source is ADR graph-operations-first-slice/0019');
  assert(/rules check/.test(entry) && /A10\.31/.test(entry), 'its Check says rules check (A10.31) will run it over every element');
});

test('EV16 [Decision 13]: the graph rule concept\'s firmware has its element, as node src/firmware/graph-rules.js makes it', () => {
  needRule();
  assert(fs.existsSync(ELEMENT_FILE), `firmware/versions/v1.0.0/concepts/graph-rule/elements/${NAME}.json exists (made by node src/firmware/graph-rules.js)`);
  const el = JSON.parse(fs.readFileSync(ELEMENT_FILE, 'utf8'));
  assert(el.graphRule && el.graphRule.name === NAME && el.graphRule.number === 10 && el.graphRule.status === 'enforced', `its graphRule section: rule 10, enforced; got ${show(el.graphRule && { name: el.graphRule.name, number: el.graphRule.number, status: el.graphRule.status })}`);
  const check = spawnSync(process.execPath, [path.join(ROOT, 'src/firmware/graph-rules.js'), '--check'], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
  assert(check.status === 0, `node src/firmware/graph-rules.js --check finds the files as the rulebook makes them; exit ${check.status}: ${(check.stdout + check.stderr).slice(-400)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
