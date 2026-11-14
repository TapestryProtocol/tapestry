'use strict';
/**
 * The write path — its own suite, run by test/operations.test.js, which finds every suite under test/operations/.
 *   Story: engineering-team/stories/graph-operations-foundation/4-the-write-path.md (AC4, AC6, AC7)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0004-the-write-path.md (Decisions 1–3, 8, 11)
 *
 * Stack-free. A fixture catalog holds one write through the path, graph link-pair, whose apply MERGEs a CITES
 * relationship and can refuse or fail after it has written, and the declarations the loader must leave out. The
 * graph is test/helpers/graphFake.js's, kept in a file the test reads afterwards.
 *
 *   W1  a read that declares apply, and a write that declares both run and apply, are left out; a lifecycle write
 *       with run still loads; and every write in the shipped catalog's graph group declares apply and no run (ADR
 *       0004 Amendment 2: the gate, not the loader, holds that rule, since other suites' fixture catalogs keep
 *       graph writes with run)
 *   W2  an apply write with no repeatKey, an empty one, one naming an input it doesn't declare, a guard naming a rule
 *       there isn't, or a result that doesn't declare `change`, is left out
 *   W3  a write through the path lists its guards and repeatKey, its refusals include its guard's, and /docs says both
 *   W4  a write that changes the graph records one change entry with it, and answers it as `change`
 *   W5  repeating it changes nothing, records nothing and answers change: null
 *   W6  a guard that refuses answers before apply runs: nothing written, no entry, the transaction rolled back
 *   W7  a refusal after the change is written keeps neither the change nor an entry
 *   W8  a failure after the change is written keeps neither
 *   W9  when the entry's write fails, the change isn't kept either
 *   W10 the entry says who: the owner or an admin by pubkey, or the command, with no pubkey
 *   W11 a write that isn't sent as JSON is refused with 415 and changes nothing, lifecycle backup's included; a
 *       visitor is still refused with 401 first
 *   W12 an answer that can't be sent as JSON fails with the same words from the route and the command
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../helpers/graphOpsSuite');
const F = require('../helpers/lifecycleFakes');

const { ROOT, NL, OWNER, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: the write path');

const REFUSAL = path.join(ROOT, 'src/operations/refusal.js');
const LINK = '/api/tapestry/graph/link-pair';
const LIST = '/api/tapestry/operations';
const RULE = 'relationship-type-allowed';

// ── the fixture catalog ──
const linkPair = `'use strict';
const { refusal } = require(${JSON.stringify(REFUSAL)});
module.exports = {
  group: 'graph', name: 'link-pair', kind: 'write', access: 'owner-and-admins',
  summary: 'A fixture write through the write path',
  inputs: {
    from: { schema: { type: 'string' }, required: true },
    to: { schema: { type: 'string' }, required: true },
    type: { schema: { type: 'string' } },
    mode: { schema: { type: 'string', enum: ['normal', 'refuse-after-write', 'throw-after-write'] } },
  },
  result: { description: 'What it did', schema: { type: 'object', properties: { outcome: { type: 'string' }, change: { type: 'object', nullable: true } } } },
  refusals: [{ code: 'fixture-refused', status: 422, when: 'mode is refuse-after-write' }],
  guards: [{ rule: '${RULE}', items: (inputs) => [{ type: inputs.type || 'CITES', from: inputs.from, to: inputs.to }] }],
  repeatKey: ['from', 'to'],
  async apply(inputs, ctx) {
    const r = await ctx.tx.run('MATCH (a:TapestryNode {tapestryKey: $from}), (b:TapestryNode {tapestryKey: $to}) MERGE (a)-[r:CITES]->(b) RETURN count(r) AS n', { from: inputs.from, to: inputs.to });
    if (inputs.mode === 'refuse-after-write') throw refusal('fixture-refused', 'The fixture refused after writing.');
    if (inputs.mode === 'throw-after-write') throw new Error('the fixture failed after writing');
    const created = r.counters.relationshipsCreated > 0;
    return { data: { outcome: created ? 'added' : 'already-there' }, changes: created ? [{ change: 'relationship-added', type: 'CITES', from: inputs.from, to: inputs.to }] : [] };
  },
};
`;
const applyBody = `async apply() { return { data: {}, changes: [] }; }`;
const runBody = `async run() { return {}; }`;
const withChange = `{ schema: { type: 'object', properties: { change: { type: 'object', nullable: true } } } }`;
const decl = (group, name, kind, fields) => `'use strict';
module.exports = {
  group: '${group}', name: '${name}', kind: '${kind}', access: 'owner-and-admins', summary: 'A fixture declaration',
  inputs: { from: { schema: { type: 'string' } } },
  ${fields}
};
`;
const FIXTURES = {
  'graph/link-pair.js': linkPair,
  'graph/write-with-run.js': decl('graph', 'write-with-run', 'write', `result: ${withChange}, repeatKey: ['from'], ${runBody}`),
  'graph/read-with-apply.js': decl('graph', 'read-with-apply', 'read', `result: ${withChange}, repeatKey: ['from'], ${applyBody}`),
  'graph/both.js': decl('graph', 'both', 'write', `result: ${withChange}, repeatKey: ['from'], ${runBody}, ${applyBody}`),
  'graph/no-repeat-key.js': decl('graph', 'no-repeat-key', 'write', `result: ${withChange}, ${applyBody}`),
  'graph/empty-repeat-key.js': decl('graph', 'empty-repeat-key', 'write', `result: ${withChange}, repeatKey: [], ${applyBody}`),
  'graph/stray-repeat-key.js': decl('graph', 'stray-repeat-key', 'write', `result: ${withChange}, repeatKey: ['nope'], ${applyBody}`),
  'graph/unknown-guard.js': decl('graph', 'unknown-guard', 'write', `result: ${withChange}, repeatKey: ['from'], guards: [{ rule: 'no-such-rule', items: () => [] }], ${applyBody}`),
  'graph/no-change.js': decl('graph', 'no-change', 'write', `result: { schema: { type: 'object', properties: { outcome: { type: 'string' } } } }, repeatKey: ['from'], ${applyBody}`),
  'lifecycle/keeps-run.js': decl('lifecycle', 'keeps-run', 'write', `result: { schema: { type: 'object' } }, ${runBody}`),
  'graph/cant-serialize.js': `'use strict';
module.exports = {
  group: 'graph', name: 'cant-serialize', kind: 'read', access: 'owner-and-admins', summary: 'A fixture read whose answer cannot be sent as JSON',
  inputs: {}, result: { schema: { type: 'object' } },
  async run() { return { value: { toJSON() { throw 'it will not serialize'; } } }; },
};
`,
};
let CATALOG = null;
function catalog() {
  if (CATALOG) return CATALOG;
  CATALOG = tmp('write-path-catalog-');
  for (const [rel, text] of Object.entries(FIXTURES)) {
    const f = path.join(CATALOG, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, text);
  }
  return CATALOG;
}

// ── one harness run, shared ──
let RUN = null;
function main() {
  if (RUN) return RUN;
  const dir = tmp('write-path-');
  const seed = S.seedGraph();
  const file = seed.file(dir);
  const k = seed.keys;
  const post = (id, caller, body, extra = {}) => ({ id, app: 'fixture', method: 'POST', url: LINK, caller, body, ...extra });
  const spec = {
    fixtureDir: catalog(),
    formBodies: true,
    scenarios: [{
      // The list first, with no graph fake installed, so the declaration tests read the loader without graph.js.
      requests: [
        { id: 'list', app: 'fixture', method: 'GET', url: LIST, caller: 'owner' },
        { id: 'w11-run-text', app: 'fixture', method: 'POST', url: '/api/tapestry/lifecycle/keeps-run', caller: 'owner', contentType: 'text/plain', rawBody: '{}' },
        { id: 'w12-route', app: 'fixture', method: 'GET', url: '/api/tapestry/graph/cant-serialize', caller: 'owner' },
      ],
      cli: [{ id: 'w12-cli', catalog: 'fixture', argv: ['graph', 'cant-serialize'] }],
    }, {
      graphFake: { stateFile: file },
      requests: [
        post('w4-add', 'owner', { from: k.A, to: k.B }),
        post('w5-again', 'owner', { from: k.A, to: k.B }),
        post('w6-guard', 'owner', { from: k.B, to: k.A, type: 'HAS_ELEMENT' }),
        post('w7-refuse', 'owner', { from: k.B, to: k.A, mode: 'refuse-after-write' }),
        post('w8-throw', 'owner', { from: k.B, to: k.A, mode: 'throw-after-write' }),
        post('w10-admin', 'admin', { from: k.A, to: k.U }),
        post('w11-text', 'owner', { from: k.U, to: k.A }, { contentType: 'text/plain', rawBody: JSON.stringify({ from: k.U, to: k.A }) }),
        post('w11-form', 'owner', null, { contentType: 'application/x-www-form-urlencoded', rawBody: `from=${k.U}&to=${k.A}` }),
        post('w11-none', 'owner', undefined, { noContentType: true }),
        post('w11-visitor', 'visitor', null, { contentType: 'text/plain', rawBody: '{}' }),
        post('w11-charset', 'owner', { from: k.U, to: k.B }, { contentType: 'application/json; charset=utf-8' }),
      ],
      cli: [
        { id: 'w10-cli', catalog: 'fixture', argv: ['graph', 'link-pair', '--from', k.B, '--to', k.U] },
      ],
    }],
  };
  const r = S.runHarness(spec, { dir });
  RUN = { r, seed, file, k };
  return RUN;
}
/** A second run whose entry write fails (W9). */
let FAILING = null;
function failing() {
  if (FAILING) return FAILING;
  const dir = tmp('write-path-failing-');
  const seed = S.seedGraph();
  seed.state.failures = { entry: true };
  const file = seed.file(dir);
  const k = seed.keys;
  const r = S.runHarness({
    fixtureDir: catalog(),
    scenarios: [{ graphFake: { stateFile: file }, requests: [{ id: 'w9', app: 'fixture', method: 'POST', url: LINK, caller: 'owner', body: { from: k.A, to: k.B } }] }],
  }, { dir });
  FAILING = { r, file, k };
  return FAILING;
}

const graphAfter = (file) => S.readState(file);
const newEntries = (file) => S.entriesOf(graphAfter(file)).filter((e) => e.at !== '2026-01-01T00:00:00.000Z');
const problemsOf = (list) => ((list.body && list.body.data && list.body.data.problems) || []);
const problemFor = (list, file) => problemsOf(list).find((p) => p.file === file);
const listed = (list, name) => ((list.body && list.body.data && list.body.data.operations) || []).find((o) => o.group === 'graph' && o.name === name);
const leftOutBecause = (list) => {
  const p = problemFor(list, 'graph/link-pair.js');
  return p ? ` (the loader left graph/link-pair.js out: ${p.problem})` : '';
};
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test('W1: a read with apply, and a write with run and apply, are left out; every graph write in the shipped catalog applies', () => {
  const { req } = S.answered(main().r);
  const list = req('list');
  assert(list.status === 200, `the list must answer 200; got ${list.status} ${show(list.body)}`);
  for (const f of ['graph/read-with-apply.js', 'graph/both.js']) {
    const p = problemFor(list, f);
    assert(p && /apply/.test(p.problem), `${f} must be left out with a problem naming apply (ADR 0004 Decision 1); its problem: ${show(p || null)}`);
  }
  assert(!problemFor(list, 'lifecycle/keeps-run.js'), `a lifecycle write keeps run and still loads; got ${show(problemFor(list, 'lifecycle/keeps-run.js'))}`);
  assert(((list.body.data.operations || []).some((o) => o.group === 'lifecycle' && o.name === 'keeps-run')), 'lifecycle keeps-run must be listed');
  // The shipped catalog (ADR 0004 Amendment 2): every graph write declares apply and no run. It holds the story's two
  // writes, so the check is never true of an empty group.
  const child = spawnSync(process.execPath, ['-e', `
    const { loadOperations } = require(${JSON.stringify(path.join(ROOT, 'src/operations/index.js'))});
    const { operations, problems } = loadOperations();
    const writes = operations.filter((o) => o.group === 'graph' && o.kind === 'write')
      .map((o) => ({ name: o.name, apply: typeof o.declaration.apply === 'function', run: typeof o.declaration.run === 'function' }));
    const graphProblems = problems.filter((p) => p.file.startsWith('graph/'));
    process.stdout.write('RESULT:' + JSON.stringify({ writes, graphProblems }));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('write-path-catalog-check-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line, `the shipped catalog's check must run: ${(child.stderr || '').slice(-400)}`);
  const { writes, graphProblems } = JSON.parse(line);
  assert(!graphProblems.length, `the shipped catalog's graph group loads with no problems; got ${show(graphProblems)}`);
  const names = writes.map((w) => w.name).sort();
  for (const n of ['add-relationship', 'remove-relationship']) assert(names.includes(n), `the shipped catalog declares graph ${n} as a write; its graph writes: ${show(names)}`);
  const runs = writes.filter((w) => !w.apply || w.run);
  assert(!runs.length, `every graph write in the shipped catalog declares apply and no run (ADR 0004 Amendment 2); these don't: ${show(runs)}`);
});

test('W2: an apply write with no repeatKey, an empty one, a stray one, an unknown guard, or no `change` in its result is left out', () => {
  const { req } = S.answered(main().r);
  const want = {
    'graph/no-repeat-key.js': /repeatKey/,
    'graph/empty-repeat-key.js': /repeatKey/,
    'graph/stray-repeat-key.js': /nope/,
    'graph/unknown-guard.js': /no-such-rule/,
    'graph/no-change.js': /change/,
  };
  for (const [f, re] of Object.entries(want)) {
    const p = problemFor(req('list'), f);
    assert(p && re.test(p.problem), `${f} must be left out with a problem matching ${re} (ADR 0004 Decision 2); its problem: ${show(p || null)}`);
  }
});

test('W3: a write through the path lists its guards and repeatKey, its refusals include its guard\'s, and /docs says both', () => {
  const { req } = S.answered(main().r);
  const e = listed(req('list'), 'link-pair');
  assert(e, `graph link-pair must be listed${leftOutBecause(req('list'))}`);
  assert(show(e.guards) === show([RULE]), `its list entry must show guards ${show([RULE])}; got ${show(e.guards)}`);
  assert(show(e.repeatKey) === show(['from', 'to']), `its list entry must show repeatKey ["from","to"]; got ${show(e.repeatKey)}`);
  const codes = (e.refusals || []).map((x) => x.code);
  for (const c of ['undeclared-type', 'reserved-type', 'fixture-refused', 'wrong-content-type', 'invalid-body']) {
    assert(codes.includes(c), `its refusals must include ${c}; got ${show(codes)}`);
  }
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const doc = withOperationDocs({}, { dir: ${JSON.stringify(catalog())} });
    const p = doc.paths['/api/tapestry/graph/link-pair'];
    process.stdout.write('RESULT:' + JSON.stringify(p ? p.post : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('write-path-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line, `the /docs check must run: ${(child.stderr || '').slice(-400)}`);
  const entry = JSON.parse(line);
  assert(entry, '/docs must have POST /api/tapestry/graph/link-pair');
  const text = `${entry.summary || ''} ${entry.description || ''}`;
  assert(text.includes(RULE), `its /docs entry must name the rule it guards (${RULE}); got ${show(text)}`);
  assert(/Safe to repeat by/.test(text) && /from/.test(text) && /to/.test(text), `its /docs entry must say "Safe to repeat by" from and to; got ${show(text)}`);
});

test('W4: a write that changes the graph records one change entry with it, and answers it as `change`', () => {
  const { r, file, k } = main();
  const { req } = S.answered(r);
  const a = req('w4-add');
  assert(a.status === 200, `the first link-pair must answer 200; got ${a.status} ${show(a.body)}${leftOutBecause(req('list'))}`);
  assert(a.body.data.outcome === 'added', `its outcome must be added; got ${show(a.body.data)}`);
  const c = a.body.data.change;
  assert(c && typeof c === 'object', `the answer must carry the change entry as data.change; got ${show(a.body.data)}`);
  assert(UUID.test(c.id), `the entry's id is a v4 UUID (its tapestryKey); got ${show(c.id)}`);
  assert(ISO.test(c.at), `the entry's at is ISO 8601 UTC with milliseconds; got ${show(c.at)}`);
  assert(show(c.by) === show({ role: 'owner', pubkey: OWNER }), `the entry's by is the owner; got ${show(c.by)}`);
  assert(c.operation === 'graph link-pair', `the entry names its operation; got ${show(c.operation)}`);
  assert(show(c.changes) === show([{ change: 'relationship-added', type: 'CITES', from: k.A, to: k.B }]), `the entry lists what changed; got ${show(c.changes)}`);
  const g = graphAfter(file);
  assert(S.relsOf(g, 'CITES').filter((x) => x.from === k.A && x.to === k.B).length === 1, `the graph holds one CITES from A to B; got ${show(S.relsOf(g, 'CITES'))}`);
  const mine = S.entriesOf(g).filter((e) => e.tapestryKey === c.id);
  assert(mine.length === 1, `the graph holds the entry as one node whose tapestryKey is its id; got ${show(S.entriesOf(g))}`);
  const e = mine[0];
  assert(e.labels.includes('GraphChange') && e.labels.includes('TapestryNode'), `the entry carries GraphChange and TapestryNode (ADR 0004 Decision 5); got ${show(e.labels)}`);
  assert(e.at === c.at && e.byRole === 'owner' && e.byPubkey === OWNER && e.operation === 'graph link-pair', `the entry node holds at, byRole, byPubkey and operation as answered; got ${show(e)}`);
  assert(show([...(e.keys || [])].sort()) === show([k.A, k.B].sort()), `the entry's keys are the tapestryKeys its changes name; got ${show(e.keys)}`);
  assert(e.uuid === undefined, `an entry has no uuid; got ${show(e.uuid)}`);
  assert(show(e.changes) === show(c.changes), `the entry node's changes are its changes, as JSON text; got ${show(e.changes)}`);
});

test('W5: repeating the write changes nothing, records nothing, and answers change: null', () => {
  const { r, file, k } = main();
  const { req } = S.answered(r);
  const again = req('w5-again');
  assert(again.status === 200 && again.body.data.outcome === 'already-there', `the repeat answers 200 already-there; got ${again.status} ${show(again.body)}`);
  assert(again.body.data.change === null, `the repeat answers change: null; got ${show(again.body.data.change)}`);
  const g = graphAfter(file);
  assert(S.relsOf(g, 'CITES').filter((x) => x.from === k.A && x.to === k.B).length === 1, 'still one CITES from A to B');
  const forAB = S.entriesOf(g).filter((e) => (e.keys || []).includes(k.A) && (e.keys || []).includes(k.B));
  assert(forAB.length === 1, `still one entry for A and B; got ${forAB.length}`);
});

test('W6: a guard that refuses answers before apply runs: nothing written, no entry, rolled back', () => {
  const { r, file, k } = main();
  const { req } = S.answered(r);
  const g6 = req('w6-guard');
  assert(g6.status === 409 && g6.body.code === 'reserved-type', `HAS_ELEMENT is reserved: 409 reserved-type; got ${g6.status} ${show(g6.body)}`);
  assert(g6.body.rule === RULE, `a guard's refusal names its rule (ADR 0004 Decision 3); got ${show(g6.body)}`);
  assert(/HAS_ELEMENT/.test(g6.body.error), `the refusal says in words what was wrong; got ${show(g6.body.error)}`);
  const g = graphAfter(file);
  assert(!S.relsOf(g, 'CITES').some((x) => x.from === k.B && x.to === k.A), 'no CITES from B to A was kept');
  assert(!S.entriesOf(g).some((e) => (e.keys || []).includes(k.B) && (e.keys || []).includes(k.A) && e.byRole === 'owner' && /link-pair/.test(e.operation) && JSON.stringify(e.changes).includes(`"from":"${k.B}"`)), 'no entry was recorded for it');
  // In the log, the refused transaction rolled back, and it ran no MERGE before the guard refused.
  const log = g.log;
  const rollbacks = [];
  for (let i = 0; i < log.length; i++) {
    if (log[i].call !== 'rollback' || !/HAS_ELEMENT/.test(log[i].error || '')) continue;
    let j = i - 1;
    const steps = [];
    while (j >= 0 && log[j].call !== 'begin') steps.unshift(log[j--]);
    rollbacks.push(steps);
  }
  assert(rollbacks.length === 1, `the guard's refusal rolled one transaction back; the log: ${show(log.slice(-12))}`);
  assert(!rollbacks[0].some((s) => s.kind === 'merge' || s.kind === 'create'), `the guard refused before anything was written; the transaction ran: ${show(rollbacks[0])}`);
});

test('W7: a refusal after the change is written keeps neither the change nor an entry', () => {
  const { r, file, k } = main();
  const { req } = S.answered(r);
  const x = req('w7-refuse');
  assert(x.status === 422 && x.body.code === 'fixture-refused', `its own refusal answers at its status; got ${x.status} ${show(x.body)}`);
  const g = graphAfter(file);
  assert(!S.relsOf(g, 'CITES').some((y) => y.from === k.B && y.to === k.A), `the CITES it MERGEd before refusing wasn't kept; got ${show(S.relsOf(g, 'CITES'))}`);
});

test('W8: a failure after the change is written keeps neither the change nor an entry', () => {
  const { r, file, k } = main();
  const { req } = S.answered(r);
  const x = req('w8-throw');
  assert(x.status === 500 && x.body.code === 'failed', `a failure answers 500 failed; got ${x.status} ${show(x.body)}`);
  assert(/the fixture failed after writing/.test(x.body.error), `the failure says what failed; got ${show(x.body.error)}`);
  const g = graphAfter(file);
  assert(!S.relsOf(g, 'CITES').some((y) => y.from === k.B && y.to === k.A), 'the CITES it MERGEd before failing wasn\'t kept');
});

test('W9: when the entry\'s write fails, the change isn\'t kept either', () => {
  const { r, file, k } = failing();
  const { req } = S.answered(r);
  const x = req('w9');
  assert(x.status === 500 && x.body.code === 'failed', `a failed entry write answers 500 failed; got ${x.status} ${show(x.body)}`);
  const g = graphAfter(file);
  assert(S.relsOf(g, 'CITES').length === 0, `the change wasn't kept without its entry (ADR 0004 Decision 3); got ${show(S.relsOf(g, 'CITES'))}`);
  assert(newEntries(file).length === 0, `no entry was kept; got ${show(newEntries(file))}`);
  assert(g.log.some((e) => e.call === 'rollback'), 'the transaction rolled back');
});

test('W10: the entry says who made the change: an admin by pubkey, the command with no pubkey', () => {
  const { r, k } = main();
  const { req, cmd } = S.answered(r);
  const a = req('w10-admin');
  assert(a.status === 200, `the admin's link-pair answers 200; got ${a.status} ${show(a.body)}`);
  assert(show(a.body.data.change && a.body.data.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the admin's entry names the admin; got ${show(a.body.data.change)}`);
  const c = cmd('w10-cli');
  assert(c.code === 0, `the command answers with exit 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(show(body.data.change && body.data.change.by) === show({ role: 'local', pubkey: null }), `the command's entry names the command, with no pubkey; got ${show(body.data.change)}`);
  assert(show(body.data.change.changes) === show([{ change: 'relationship-added', type: 'CITES', from: k.B, to: k.U }]), `the command's entry lists its change; got ${show(body.data.change.changes)}`);
});

test('W11: a write that isn\'t sent as JSON is refused with 415 and changes nothing; a visitor gets 401 first', () => {
  const { r, file, k } = main();
  const { req } = S.answered(r);
  const runWrite = req('w11-run-text');
  assert(runWrite.status === 415 && runWrite.body.code === 'wrong-content-type', `a write that keeps run is held to it too (lifecycle keeps-run, text/plain): 415 wrong-content-type; got ${runWrite.status} ${show(runWrite.body)}`);
  for (const id of ['w11-text', 'w11-form', 'w11-none']) {
    const x = req(id);
    assert(x.status === 415 && x.body.code === 'wrong-content-type', `${id}: a write not sent as JSON is refused 415 wrong-content-type (ADR 0004 Decision 8); got ${x.status} ${show(x.body)}`);
  }
  const g = graphAfter(file);
  assert(!S.relsOf(g, 'CITES').some((y) => y.from === k.U && y.to === k.A), 'none of them wrote anything');
  const v = req('w11-visitor');
  assert(v.status === 401, `the caller is checked first: a visitor gets 401; got ${v.status} ${show(v.body)}`);
  const ok = req('w11-charset');
  assert(ok.status === 200, `application/json with a charset is JSON; got ${ok.status} ${show(ok.body)}`);
});

test('W11b: lifecycle backup with no Content-Type, or text/plain, is refused with 415 and takes no backup', async () => {
  const base = tmp('write-path-lifecycle-');
  const inst = await F.makeInstance(base, { name: 'json-only', owner: F.OWNER, admins: [F.ADMIN] });
  const route = '/api/tapestry/lifecycle/backup';
  const spec = {
    scenarios: [{
      lifecycleFake: { stateFile: inst.state },
      requests: [
        { id: 'none', method: 'POST', url: route, caller: 'owner', noContentType: true },
        { id: 'text', method: 'POST', url: route, caller: 'owner', contentType: 'text/plain', rawBody: '{}' },
      ],
    }],
  };
  const out = F.runHarness(spec, inst.env, base);
  assert(out.data && !out.data.error, `the harness must run: ${show(out.data && out.data.error)} ${(out.child.stderr || '').slice(-300)}`);
  const byId = Object.fromEntries(out.data.scenarios[0].requests.map((q) => [q.id, q]));
  for (const id of ['none', 'text']) {
    assert(byId[id].status === 415 && byId[id].body.code === 'wrong-content-type', `lifecycle backup (${id}) must be refused 415 wrong-content-type; got ${byId[id].status} ${show(byId[id].body)}`);
  }
  assert(F.backupIds(inst.backupsDir).length === 0, `no backup was taken; got ${show(F.backupIds(inst.backupsDir))}`);
  assert(!F.trace(inst.state).includes('stop neo4j'), `the graph was never taken offline; trace ${show(F.trace(inst.state))}`);
});

test('W12: an answer that can\'t be sent as JSON fails with the same words from the route and the command', () => {
  const { req, cmd } = S.answered(main().r);
  const route = req('w12-route');
  assert(route.status === 500 && route.body.code === 'failed', `the route answers 500 failed; got ${route.status} ${show(route.body)}`);
  const c = cmd('w12-cli');
  assert(c.code === 3, `the command exits 3 (failed); got ${c.code}`);
  const body = JSON.parse(c.stdout);
  assert(body.error === route.body.error, `the command and the route word the failure the same (memo #96, ADR 0004 Decision 11): route ${show(route.body.error)}, command ${show(body.error)}`);
  assert(/it will not serialize/.test(route.body.error), `the words say what failed; got ${show(route.body.error)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
void NL;
