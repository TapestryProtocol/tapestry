'use strict';
/**
 * rules repair — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/45-property-has-one-parent.md (AC3, AC4, AC5's repair
 *          refusals, AC8's listing, /docs, callers and command)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0045-property-has-one-parent.md (Decisions 4 and 6
 *          to 10; Amendment 1)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/45-property-has-one-parent.test-plan.md
 *
 * Stack-free: the real catalog, over test/helpers/propertyParentsGraph.js's seed, with the spy on everything that
 * signs or reads a key. Each run starts from its own copy of the seed. A finding's id comes from rules check, run first
 * on the same copy, as an agent gets one.
 *
 *   RP1  repairing grok bot's project by its id takes off its link to its schema and nothing else: the graph after is
 *        the graph before less that one relationship, plus one change entry
 *   RP2  the answer: repaired; the fix (the link removed, its concept, no override) and the relationship element that
 *        still records the link; nothing left; nothing remaining; the change entry relationship-removed { type, from,
 *        to, node, concept, rule }
 *   RP3  graph history finds the entry by the property, the schema node and the concept
 *   RP4  before the repair grok bot's property writes are refused tangled-tree; after it, graph update-property changes
 *        its project
 *   RP5  the same repair again: nothing-to-repair, change null, nothing recorded
 *   RP6  the write's first statements set and clear the lock on grok bot's header; then the delete, then the entry
 *   RP7  a stale id: once the node's parents change, the old id is refused changed-since-check, naming the finding as
 *        it is now; nothing changes
 *   RP8  firmware's concept: refused firmware-concept without firmwareOverride, naming it; with it, repaired, the change
 *        recording firmwareOverride
 *   RP9  a choice, and another author's concept, answer left with why and the way on, changing nothing
 *   RP10 a repair over the whole graph fixes the instance's own, leaves the rest, each with why and the way on, in one
 *        answer with one entry; again, left; with firmwareOverride, word's too; then check finds only the choices
 *   RP11 a repair over a concept fixes only that concept's; the scope repair locks each concept's header in tapestryKey
 *        order before it deletes
 *   RP12 at most 100 fixes a call: remaining says how many are left, and the next call fixes them
 *   RP13 the refusals: bad-target, unknown-violation, unknown-rule, not-checkable, unknown-node; each changes nothing
 *   RP14 callers: 401, 403, 415; an admin's repair is the admin's; nothing is signed
 *   RP15 tapestry rules repair --violation repairs with no sign-in, recorded as the command's
 *   RP16 listed as a write with no guards, its repeatKey, inputs and refusals, and its /docs entry
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const P = require('../../helpers/propertyGraph');
const PG = require('../../helpers/propertyParentsGraph');
const G = require('../../helpers/graphFake');

const { ROOT, TA, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: rules repair');

const DECL = path.join(ROOT, 'src/operations/catalog/rules/repair.js');
const CHECK_DECL = path.join(ROOT, 'src/operations/catalog/rules/check.js');
const ROUTE = '/api/tapestry/rules/repair';
const CHECK = '/api/tapestry/rules/check';
const RULE = 'property-has-one-parent';
const NOBODY = '00000000-0000-4000-8000-0000000000cb';

let seeded = null;
async function seed() {
  if (!seeded) seeded = await PG.preparePropertyParents('rules-repair');
  return seeded;
}
async function copy(mutate = null) {
  const ctx = await seed();
  const s = S.readState(ctx.file);
  if (mutate) mutate(s, ctx);
  const file = path.join(tmp('rules-repair-'), 'graph.json');
  G.writeState(file, s);
  return { ctx, file };
}
const post = (id, body, caller = 'owner', extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body, ...extra });
const history = (id, key) => ({ id, method: 'GET', url: `/api/tapestry/graph/history?node=${key}&limit=200`, caller: 'owner' });
const runOn = (file, requests, { cli = [], spy = true } = {}) => S.answered(S.runHarness({ spy, scenarios: [{ graphFake: { stateFile: file }, requests, cli }] }, { dir: path.dirname(file) }));

/** The findings rules check gives on `file`, by the node's tapestryKey. */
function findingsOn(file, scope = 'graph') {
  const r = runOn(file, [{ id: 'check', method: 'GET', url: `${CHECK}?scope=${encodeURIComponent(scope)}&rules=property-has-one-parent&limit=200`, caller: 'owner' }], { spy: false });
  const x = r.req('check');
  if (!fs.existsSync(CHECK_DECL)) throw new Error(`rules check, which gives a finding's id, does not exist yet: src/operations/catalog/rules/check.js (ADR 0045 Decision 5): it answered ${x.status}`);
  assert(x.status === 200 && x.body.success, `rules check must answer; got ${x.status} ${show(x.body).slice(0, 400)}`);
  return Object.fromEntries(x.body.data.violations.map((v) => [v.node.tapestryKey, v]));
}
function needDecl(x) {
  if (!fs.existsSync(DECL)) throw new Error(`src/operations/catalog/rules/repair.js does not exist yet (ADR graph-operations-first-slice/0045 Decision 6): POST ${ROUTE} answered ${x.status}`);
}
function ok(r, id) {
  const x = r.req(id);
  needDecl(x);
  assert(x.status === 200 && x.body && x.body.success && x.body.data, `${id} must answer 200; got ${x.status} ${show(x.body).slice(0, 700)}`);
  return x.body.data;
}
function refused(r, id, status, code) {
  const x = r.req(id);
  needDecl(x);
  assert(x.status === status && x.body.code === code, `${id} must be refused ${status} ${code}; got ${x.status} ${show(x.body).slice(0, 600)}`);
  return x.body;
}
const nodeKey = (n) => (typeof n === 'string' ? n : n && n.tapestryKey);
const entries = (s) => s.nodes.filter((n) => n.labels.includes('GraphChange'));
const memberRels = (s, fromKey) => { const n = s.nodes.find((x) => x.props.tapestryKey === fromKey); return s.rels.filter((r) => r.type === PG.MEMBER && r.from === n.eid).map((r) => s.nodes.find((x) => x.eid === r.to).props.tapestryKey).sort(); };
const nameOf = (ctx, key) => (Object.entries(ctx.x).find(([, v]) => v === key) || [key])[0];
const without = (s, pred) => ({ nodes: s.nodes.filter((n) => !n.labels.includes('GraphChange')), rels: s.rels.filter((r) => !pred(r)) });

// ── B: one repair alone, so the graph before and after it can be compared whole ──
let bRun = null;
async function alone() {
  if (bRun) return bRun;
  const { ctx, file } = await copy();
  const f = findingsOn(file);
  const before = S.readState(file);
  const r = runOn(file, [post('fix', { violation: f[ctx.x.grokProject].id })]);
  const after = S.readState(file);
  bRun = { ctx, file, f, before, after, r };
  return bRun;
}

// ── A: the main run, over one copy, in order ──
let aRun = null;
async function mainRun() {
  if (aRun) return aRun;
  const { ctx, file } = await copy();
  const f = findingsOn(file);
  const id = (k) => f[k].id;
  const updBefore = runOn(file, [{ id: 'upd-before', method: 'POST', url: P.ROUTE.update, caller: 'owner', body: { property: ctx.x.grokProject, description: 'The project the bot belongs to' } }], { spy: false });
  const before = S.readState(file);
  const requests = [
    post('fix-grok', { violation: id(ctx.x.grokProject) }),
    post('again', { violation: id(ctx.x.grokProject) }),
    history('hist-node', ctx.x.grokProject), history('hist-schema', ctx.schema.grokBot), history('hist-concept', ctx.c.grokBot),
    { id: 'upd-after', method: 'POST', url: P.ROUTE.update, caller: 'owner', body: { property: ctx.x.grokProject, description: 'The project the bot belongs to' } },
    post('choice-hut', { violation: id(ctx.x.hutDoor) }),
    post('other-relay', { violation: id(ctx.x.relayMotto) }),
    post('other-recipe', { violation: id(ctx.x.recipeDish) }),
    post('fw-no', { violation: id(ctx.x.wordSpelling) }),
    post('fw-yes', { violation: id(ctx.x.wordSpelling), firmwareOverride: true }),
    post('r-neither', {}),
    post('r-both', { violation: id(ctx.x.teamLead), rule: RULE, scope: 'graph' }),
    post('r-rule-only', { rule: RULE }),
    post('r-garbage', { violation: 'nonsense' }),
    post('r-bad-digest', { violation: `${RULE}:${ctx.x.teamLead}:zz` }),
    post('r-violation-rule', { violation: `no-such-rule:${ctx.x.teamLead}:0123456789ab` }),
    post('r-unknown-rule', { rule: 'no-such-rule', scope: 'graph' }),
    post('r-not-checkable', { rule: 'set-has-a-parent', scope: 'graph' }),
    post('r-nobody', { rule: RULE, scope: NOBODY }),
    post('visitor', { violation: id(ctx.x.teamLead) }, 'visitor'),
    post('stranger', { violation: id(ctx.x.teamLead) }, 'stranger'),
    post('wrong-type', null, 'owner', { contentType: 'text/plain', rawBase64: Buffer.from('violation').toString('base64') }),
    { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'owner' },
  ];
  const r = runOn(file, requests, { cli: [{ id: 'cli', argv: ['rules', 'repair', '--violation', id(ctx.x.teamLead)] }] });
  const after = S.readState(file);
  aRun = { ctx, file, f, before, after, r, updBefore };
  return aRun;
}

test('RP1 [AC3, Decisions 6 and 10]: repairing grok bot\'s project takes off its link to its schema and nothing else', async () => {
  const { ctx, before, after, r } = await alone();
  ok(r, 'fix');
  assert(show(memberRels(before, ctx.x.grokProject)) === show([ctx.pp.grokBot, ctx.schema.grokBot].sort()), 'before: under its primary property and its schema');
  assert(show(memberRels(after, ctx.x.grokProject)) === show([ctx.pp.grokBot]), `after: under its primary property alone; got ${show(memberRels(after, ctx.x.grokProject))}`);
  const project = before.nodes.find((n) => n.props.tapestryKey === ctx.x.grokProject).eid;
  const schemaEid = before.nodes.find((n) => n.props.tapestryKey === ctx.schema.grokBot).eid;
  const gone = (rel) => rel.type === PG.MEMBER && rel.from === project && rel.to === schemaEid;
  assert(P.same(without(before, gone), without(after, () => false)), 'the graph after is the graph before less that one relationship: the property\'s node, tags, JSON, ENUMERATES and HAS_ELEMENT, the schema node, the tree graph and the relationship element all stay as they were');
  assert(entries(after).length === entries(before).length + 1, `one change entry is recorded; got ${entries(after).length - entries(before).length}`);
});

test('RP2 [AC3, Decisions 6, 9 and 10]: the answer: repaired, the fix, the letter that still records the link, and the change entry', async () => {
  const { ctx, f, r } = await alone();
  const d = ok(r, 'fix');
  assert(d.outcome === 'repaired' && Array.isArray(d.fixed) && d.fixed.length === 1 && show(d.left) === show([]) && d.remaining === 0, `repaired, one fix, nothing left, nothing remaining; got ${show({ outcome: d.outcome, fixed: d.fixed && d.fixed.length, left: d.left, remaining: d.remaining })}`);
  const x = d.fixed[0];
  assert(x.id === f[ctx.x.grokProject].id && nodeKey(x.node) === ctx.x.grokProject && x.concept === ctx.c.grokBot && x.firmwareOverride === false, `the fix names the finding, the node and its concept, with no override; got ${show(x).slice(0, 500)}`);
  assert(show(x.removed) === show([{ type: PG.MEMBER, from: ctx.x.grokProject, to: ctx.schema.grokBot, count: 1 }]), `it took off the one link; got ${show(x.removed)}`);
  assert(Array.isArray(x.letters) && x.letters.length === 1 && x.letters[0].tapestryKey === ctx.x.grokLetter && typeof x.letters[0].address === 'string', `it names the relationship element that still records the link, by tapestryKey and address; got ${show(x.letters)}`);
  const ch = (d.change && d.change.changes) || [];
  assert(d.change && d.change.operation === 'rules repair' && ch.length === 1, `one entry, by rules repair, with one change; got ${show(d.change).slice(0, 500)}`);
  const c = ch[0];
  assert(c.change === 'relationship-removed' && c.type === PG.MEMBER && c.from === ctx.x.grokProject && c.to === ctx.schema.grokBot && c.node === ctx.x.grokProject && c.concept === ctx.c.grokBot && c.rule === RULE,
    `relationship-removed { type, from, to, node, concept, rule }; got ${show(c)}`);
  assert(!c.firmwareOverride, `no override was used, so the change records none; got ${show(c.firmwareOverride)}`);
});

test('RP3 [AC3, Decision 9]: graph history finds the entry by the property, the schema node and the concept', async () => {
  const { r } = await mainRun();
  const fixId = ok(r, 'fix-grok').change.id;
  for (const h of ['hist-node', 'hist-schema', 'hist-concept']) {
    const list = (r.req(h).body.data || {}).entries || [];
    assert(list.some((e) => e.id === fixId && e.operation === 'rules repair'), `${h} lists the repair's entry; got ${show(list.map((e) => e.operation))}`);
  }
});

test('RP4 [AC3]: before the repair grok bot\'s property writes are refused tangled-tree; after it, update-property changes its project', async () => {
  const { r, updBefore } = await mainRun();
  const b = updBefore.req('upd-before');
  assert(b.status === 409 && b.body.code === 'tangled-tree', `before: refused tangled-tree; got ${b.status} ${show(b.body).slice(0, 300)}`);
  ok(r, 'fix-grok');
  const a = r.req('upd-after');
  assert(a.status === 200 && a.body.success, `after: graph update-property goes through; got ${a.status} ${show(a.body).slice(0, 400)}`);
});

test('RP5 [AC3, Decision 6]: the same repair again: nothing-to-repair, change null, nothing recorded', async () => {
  const { r } = await mainRun();
  const d = ok(r, 'again');
  assert(d.outcome === 'nothing-to-repair' && d.change === null && show(d.fixed) === show([]), `nothing-to-repair, nothing fixed, change null; got ${show(d)}`);
});

test('RP6 [Decision 6, step 4]: the write\'s first statements set and clear the lock on grok bot\'s header; then the delete, then the entry', async () => {
  const { ctx, before, after } = await alone();
  const txns = P.transactions(after.log, before.log.length).filter((t) => t.end === 'commit');
  const repair = txns.find((t) => t.steps.some((st) => st.call === 'tx.run' && st.kind === 'delete'));
  assert(repair, `a committed write that deletes; got ${show(txns.map((t) => t.steps.map((st) => st.kind)))}`);
  const writes = repair.steps.filter((st) => st.call === 'tx.run');
  assert(writes[0] && writes[0].kind === 'copies' && show(writes[0].keys) === show([ctx.c.grokBot]) && writes[1] && writes[1].kind === 'copies' && show(writes[1].keys) === show([ctx.c.grokBot]),
    `its first two statements that write set and clear the lock on grok bot's header; got ${show(writes.slice(0, 3))}`);
  const kinds = writes.map((st) => st.kind);
  assert(kinds.indexOf('delete') > 1 && kinds.lastIndexOf('create') > kinds.indexOf('delete'), `then the delete, then the entry; got ${show(kinds)}`);
});

test('RP7 [AC5, Decision 6, step 6]: a stale id is refused changed-since-check, naming the finding as it is now; nothing changes', async () => {
  const { ctx, file } = await copy();
  const old = findingsOn(file)[ctx.x.teamLead].id;
  const s = S.readState(file);
  const b = P.over(s);
  b.link(b.byKey(ctx.x.teamLead), PG.MEMBER, b.byKey(ctx.pp.person));
  G.writeState(file, s);
  const now = findingsOn(file)[ctx.x.teamLead].id;
  const before = S.readState(file);
  const r = runOn(file, [post('stale', { violation: old })]);
  const body = refused(r, 'stale', 409, 'changed-since-check');
  assert(String(body.error).includes(now), `the refusal names the finding as it is now, by its id; got ${show(body.error)}`);
  assert(P.same(P.graphOf(before), P.graphOf(S.readState(file))), 'nothing changed');
});

test('RP8 [AC5, Decision 7]: firmware\'s concept: refused firmware-concept without firmwareOverride; with it, repaired and recorded so', async () => {
  const { ctx, r } = await mainRun();
  const no = refused(r, 'fw-no', 409, 'firmware-concept');
  assert(/firmwareOverride/.test(no.error) && /word/.test(no.error), `the refusal names the concept and the input to pass; got ${show(no.error)}`);
  const d = ok(r, 'fw-yes');
  assert(d.outcome === 'repaired' && d.fixed.length === 1 && nodeKey(d.fixed[0].node) === ctx.x.wordSpelling && d.fixed[0].firmwareOverride === true, `repaired with the override; got ${show(d).slice(0, 500)}`);
  const c = d.change.changes[0];
  assert(c.firmwareOverride === true && c.to === ctx.xs.word && c.concept === ctx.c.word, `the change records firmwareOverride: true; got ${show(c)}`);
});

test('RP9 [AC4, Decisions 6 and 7, Amendment 1]: a choice, and another author\'s concept, answer left with why and the way on', async () => {
  const { ctx, r, before, file } = await mainRun();
  for (const [id, key] of [['choice-hut', ctx.x.hutDoor], ['other-relay', ctx.x.relayMotto], ['other-recipe', ctx.x.recipeDish]]) {
    const d = ok(r, id);
    assert(d.outcome === 'left' && d.change === null && show(d.fixed) === show([]) && d.left.length === 1 && nodeKey(d.left[0].node) === key && d.left[0].why && d.left[0].wayOn,
      `${id}: left, with why and the way on, nothing fixed, nothing recorded; got ${show(d).slice(0, 500)}`);
  }
  assert(/claim/i.test(`${ok(r, 'other-relay').left[0].why}`), `another author's concept is that author's claim; got ${show(ok(r, 'other-relay').left[0])}`);
  const s = S.readState(file);
  for (const key of [ctx.x.hutDoor, ctx.x.relayMotto, ctx.x.recipeDish]) assert(show(memberRels(s, key)) === show(memberRels(before, key)), `${nameOf(ctx, key)}'s parents are as they were`);
});

test('RP10 [AC3, AC4, Decisions 6 and 7]: a repair over the whole graph fixes the instance\'s own and leaves the rest, in one answer', async () => {
  const { ctx, file } = await copy();
  findingsOn(file);
  const r = runOn(file, [post('all', { rule: RULE, scope: 'graph' }), post('all-again', { rule: RULE, scope: 'graph' }), post('all-fw', { rule: RULE, scope: 'graph', firmwareOverride: true })]);
  const d = ok(r, 'all');
  assert(d.outcome === 'repaired' && show(d.fixed.map((x) => nodeKey(x.node)).sort()) === show([...ctx.FIXABLE].sort()), `it fixes grok bot's project and bot's team.lead; got ${show(d.fixed.map((x) => nameOf(ctx, nodeKey(x.node))))}`);
  const left = Object.fromEntries(d.left.map((x) => [nodeKey(x.node), x]));
  assert(show(Object.keys(left).sort()) === show([...ctx.FIRMWARE, ...ctx.CHOICES].sort()), `it leaves word's spelling and the eight choices; got ${show(Object.keys(left).map((k) => nameOf(ctx, k)))}`);
  assert(/firmwareOverride/.test(`${left[ctx.x.wordSpelling].why} ${left[ctx.x.wordSpelling].wayOn}`), `word's spelling is left for want of firmwareOverride, which the way on names; got ${show(left[ctx.x.wordSpelling])}`);
  for (const x of d.left) assert(x.id && x.why && x.wayOn, `each left finding has its id, why and the way on; got ${show(x)}`);
  assert(d.remaining === 0 && d.change && d.change.changes.length === 2, `nothing remaining; one entry with two changes; got ${show({ remaining: d.remaining, changes: d.change && d.change.changes.length })}`);
  const again = ok(r, 'all-again');
  assert(again.outcome === 'left' && show(again.fixed) === show([]) && again.change === null, `again: findings remain but none it may fix: left, nothing recorded; got ${show({ outcome: again.outcome, fixed: again.fixed, change: again.change })}`);
  const fw = ok(r, 'all-fw');
  assert(show(fw.fixed.map((x) => nodeKey(x.node))) === show(ctx.FIRMWARE), `with firmwareOverride, word's spelling is fixed too; got ${show(fw.fixed.map((x) => nameOf(ctx, nodeKey(x.node))))}`);
  const rest = Object.keys(findingsOn(file)).sort();
  assert(show(rest) === show([...ctx.CHOICES].sort()), `then check finds only the eight choices; got ${show(rest.map((k) => nameOf(ctx, k)))}`);
});

test('RP11 [Decision 6, steps 2 and 4]: a repair over a concept fixes only that concept\'s; a scope repair locks each header in tapestryKey order before it deletes', async () => {
  const { ctx, file } = await copy();
  const r = runOn(file, [post('grok', { rule: RULE, scope: ctx.c.grokBot })]);
  const d = ok(r, 'grok');
  assert(show(d.fixed.map((x) => nodeKey(x.node))) === show([ctx.x.grokProject]), `grok bot's scope fixes its project alone; got ${show(d.fixed.map((x) => nameOf(ctx, nodeKey(x.node))))}`);
  assert(findingsOn(file)[ctx.x.teamLead], "bot's team.lead, outside the scope, still has its finding");
  const two = await copy();
  const before = S.readState(two.file);
  ok(runOn(two.file, [post('all', { rule: RULE, scope: 'graph' })]), 'all');
  const after = S.readState(two.file);
  const txn = P.transactions(after.log, before.log.length).filter((t) => t.end === 'commit').find((t) => t.steps.some((st) => st.call === 'tx.run' && st.kind === 'delete'));
  const writes = txn.steps.filter((st) => st.call === 'tx.run');
  const firstDelete = writes.findIndex((st) => st.kind === 'delete');
  const locked = writes.slice(0, firstDelete).filter((st) => st.kind === 'copies').map((st) => (st.keys || [])[0]);
  const want = [ctx.c.bot, ctx.c.grokBot].sort();
  const firstSeen = locked.filter((k, i) => locked.indexOf(k) === i);
  assert(show(firstSeen) === show(want), `before the first delete it locks bot's and grok bot's headers, in tapestryKey order; got ${show(locked)}`);
});

test('RP12 [Decision 8]: at most 100 fixes a call: remaining says how many are left, and the next call fixes them', async () => {
  let manyHeader = null;
  const { ctx, file } = await copy((s) => {
    const b = P.over(s);
    const header = b.lettered({ uuid: `39998:${TA}:many`, kind: 39998, labels: ['ListHeader', 'ConceptHeader'], name: 'many', tags: [['d', 'many'], ['names', 'many', 'manies'], ['slug', 'many']] });
    const sc = b.lettered({ uuid: `39999:${TA}:many-schema`, labels: ['ListItem', 'JSONSchema'], name: 'JSON schema for the concept of manies', tags: [['d', 'many-schema'], ['name', 'JSON schema for the concept of manies']] });
    const pp = b.lettered({ uuid: `39999:${TA}:many-primary-property`, labels: ['ListItem', 'Property'], name: 'primary property for the concept of manies', tags: [['d', 'many-primary-property'], ['name', 'primary property for the concept of manies']] });
    b.link(sc, PG.SCHEMA, header);
    b.link(pp, PG.PRIMARY, header);
    b.link(pp, PG.MEMBER, sc);
    for (let i = 0; i < 101; i++) {
      const d = `field${String(i).padStart(3, '0')}-${P.hash8(pp.props.uuid)}`;
      const n = b.lettered({ uuid: `39999:${TA}:${d}`, labels: ['ListItem', 'Property'], name: `field${i}`, tags: [['d', d], ['name', `field${i}`]] });
      b.link(n, PG.MEMBER, pp);
      b.link(n, PG.MEMBER, sc);
    }
    manyHeader = header.props.tapestryKey;
  });
  const r = runOn(file, [post('one', { rule: RULE, scope: manyHeader }), post('two', { rule: RULE, scope: manyHeader }), post('three', { rule: RULE, scope: manyHeader })]);
  const a = ok(r, 'one');
  assert(a.fixed.length === 100 && a.remaining === 1, `the first call fixes 100 and says 1 remains; got ${show({ fixed: a.fixed.length, remaining: a.remaining })}`);
  const b = ok(r, 'two');
  assert(b.fixed.length === 1 && b.remaining === 0, `the second fixes the last; got ${show({ fixed: b.fixed.length, remaining: b.remaining })}`);
  const c = ok(r, 'three');
  assert(c.outcome === 'nothing-to-repair' && c.change === null, `the third finds nothing to repair; got ${show({ outcome: c.outcome, change: c.change })}`);
  assert(ctx, 'seeded');
});

test('RP13 [AC5, Decisions 4 and 6, step 1]: the refusals, each changing nothing', async () => {
  const { r, before, after } = await mainRun();
  refused(r, 'r-neither', 400, 'bad-target');
  refused(r, 'r-both', 400, 'bad-target');
  refused(r, 'r-rule-only', 400, 'bad-target');
  refused(r, 'r-garbage', 400, 'unknown-violation');
  refused(r, 'r-bad-digest', 400, 'unknown-violation');
  refused(r, 'r-violation-rule', 400, 'unknown-rule');
  refused(r, 'r-unknown-rule', 400, 'unknown-rule');
  const n = refused(r, 'r-not-checkable', 409, 'not-checkable');
  assert(/A10\.31/.test(n.error), `not-checkable names A10.31; got ${show(n.error)}`);
  refused(r, 'r-nobody', 404, 'unknown-node');
  const repairs = (s) => entries(s).filter((e) => e.props.operation === 'rules repair').length;
  // The main run's writes: fix-grok, fw-yes and the command's (RP15); the refusals add none.
  assert(repairs(after) - repairs(before) === 3, `only the three repairs that changed something are recorded; got ${repairs(after) - repairs(before)}`);
});

test('RP14 [AC8]: callers: 401, 403, 415; an admin\'s repair is the admin\'s; nothing is signed', async () => {
  const { ctx, r } = await mainRun();
  needDecl(r.req('visitor'));
  assert(r.req('visitor').status === 401 && r.req('stranger').status === 403 && r.req('wrong-type').status === 415, `401, 403 and 415; got ${r.req('visitor').status} ${r.req('stranger').status} ${r.req('wrong-type').status}`);
  assert(Array.isArray(r.spy) && r.spy.length === 0, `nothing signs, publishes or reads a key; the spy saw ${show(r.spy)}`);
  const { file } = await copy();
  const f = findingsOn(file);
  const a = runOn(file, [post('admin', { violation: f[ctx.x.teamLead].id }, 'admin')]);
  const d = ok(a, 'admin');
  assert(d.outcome === 'repaired' && d.change.by.role === 'admin' && d.change.by.pubkey === ADMIN, `the admin's repair is recorded as the admin's; got ${show(d.change && d.change.by)}`);
});

test('RP15 [AC8]: tapestry rules repair --violation repairs with no sign-in, recorded as the command\'s', async () => {
  const { ctx, r, after } = await mainRun();
  const c = r.cmd('cli');
  if (!fs.existsSync(DECL)) throw new Error(`src/operations/catalog/rules/repair.js does not exist yet (ADR 0045 Decision 6): the command exited ${c.code}`);
  assert(c.code === 0, `the command exits 0; got ${c.code} ${String(c.stdout).slice(0, 300)} ${String(c.stderr).slice(0, 300)}`);
  const body = JSON.parse(c.stdout);
  assert(body.data.outcome === 'repaired' && show(body.data.change.by) === show({ role: 'local', pubkey: null }), `repaired, the entry naming the command; got ${show(body).slice(0, 400)}`);
  assert(show(memberRels(after, ctx.x.teamLead)) === show([ctx.x.team]), `bot's team.lead now hangs under team alone; got ${show(memberRels(after, ctx.x.teamLead))}`);
});

test('RP16 [AC8]: listed as a write with no guards, its repeatKey, inputs and refusals, and its /docs entry', async () => {
  const { r } = await mainRun();
  needDecl(r.req('list'));
  const e = ((r.req('list').body.data || {}).operations || []).find((o) => o.group === 'rules' && o.name === 'repair');
  assert(e, `rules repair is listed; problems: ${show((r.req('list').body.data || {}).problems)}`);
  assert(e.kind === 'write' && e.access === 'owner-and-admins' && show(e.guards) === show([]) && show(e.repeatKey) === show(['violation', 'rule', 'scope', 'firmwareOverride']),
    `a write for the owner and admins, no guards, repeatKey [violation, rule, scope, firmwareOverride]; got ${show({ kind: e.kind, access: e.access, guards: e.guards, repeatKey: e.repeatKey })}`);
  assert(show(Object.keys(e.inputs || {}).sort()) === show(['firmwareOverride', 'rule', 'scope', 'violation']), `inputs violation, rule, scope and firmwareOverride; got ${show(Object.keys(e.inputs || {}))}`);
  const codes = (e.refusals || []).map((x) => x.code);
  for (const code of ['bad-target', 'unknown-violation', 'unknown-rule', 'not-checkable', 'unknown-node', 'changed-since-check', 'firmware-concept', 'wrong-content-type', 'sign-in-required', 'not-allowed']) assert(codes.includes(code), `its refusals include ${code}; got ${show(codes)}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('rules-repair-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

module.exports = { run };
if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));
