'use strict';
/**
 * export nostr — its declaration, who may call it, how it reaches agents, and what it refuses. Run by
 * test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/34-export-nostr.md (AC7, and AC1's callers)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0034-export-nostr.md (Decision 1; Implementation
 *          notes: the seams, the docs)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/34-export-nostr.test-plan.md
 *
 * Stack-free: the real catalog over the graph test/helpers/cypherGraphFake.js keeps (test/helpers/exportFixtures.js's
 * world: firmware, today's dog, alice's cat, and pet made by the graph operations), the relays and DNS of
 * test/helpers/relayFake.js with its fake strfry import, and the assistant's key through the harness's assistantKeys hook.
 * R holds only refusals, with the spy on, so the graph after R is the graph before it; C holds the callers; K runs with no
 * assistant key.
 *
 *   EN1  every refusal of R signed nothing (the spy saw no finalizeEvent or signAndFinalize), sent nothing (no strfry
 *        import, no publish, no connection to a refused relay) and recorded nothing (the graph as it was, no entry); each
 *        says in words what was wrong
 *   EN2  a visitor 401, a stranger 403; the owner, an admin and a direct-local caller are answered; the internal command
 *        `tapestry export nostr` answers as the route, with no sign-in; each call's entry is its caller's, the
 *        command's naming it as local
 *   EN3  the declaration (export nostr, a write for the owner and admins with run; six optional inputs; its eleven
 *        refusals; the seams BUDGET_MS, SEND_CUTOFF_MS, MAX_SCOPE, MAX_SEND, and _send.js's strfryImport, OK_MS,
 *        IN_FLIGHT and now()); listed for agents with its inputs and refusals; its /docs entry, POST
 *   EN4  no-scope (400): none of node, graph and everything, relays alone included
 *   EN5  two-scopes (400): node and graph; graph and everything
 *   EN6  bad-ref (400): a ref empty once trimmed; one with a control character
 *   EN7  unknown-ref (404): a tapestryKey no node has; a name nothing has
 *   EN8  ambiguous-ref (409): a name two of the instance's nodes share, with the candidates
 *   EN9  not-a-graph (400): graph naming an element whose JSON holds no graph object and that the graph concept's class
 *        thread doesn't reach
 *   EN10 bad-relay (400): https://…, ws://user@host, text that isn't a URL
 *   EN11 private-relay (403): a relay whose host the fake DNS resolves to 10.0.0.5, or to 192.168.1.5, for the owner
 *        too and for an admin; the guard asked the DNS for each name, and nothing connected to them
 *   EN12 too-many-relays (400): eleven relays
 *   EN13 bad-cursor (400): an after this operation didn't give, text or another read's cursor
 *   EN14 no-assistant-key (409): the child given no assistant key; nothing signed, sent or recorded
 *   EN15 (AC7's docs; not in the plan's list, added at Test Design) the catalog's export row, BIBLE §6 and §11 and the
 *        agent skill say what it does; the skill stops saying no operation publishes to nostr or signs a nostr event
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const X = require('../../helpers/exportFixtures');
const F = require('../../helpers/importFixtures');

const { ROOT, ADMIN, assert, tmp } = S;
const show = (x) => String(S.show(x));
const { test, run } = S.makeSuite('operations: export nostr — its declaration, its callers, its refusals');
const { exp } = X;

const CODES = Object.freeze({
  'no-scope': 400, 'two-scopes': 400, 'bad-ref': 400, 'unknown-ref': 404, 'ambiguous-ref': 409, 'not-a-graph': 400,
  'bad-relay': 400, 'private-relay': 403, 'too-many-relays': 400, 'bad-cursor': 400, 'no-assistant-key': 409,
});
const INPUTS = Object.freeze(['after', 'dryRun', 'everything', 'graph', 'node', 'relays']);
const DNS = { ...X.DNS, 'tenfive.example.com': { v4: ['10.0.0.5'] } };
const err = (body) => String(body && body.error);
const names = (body, word) => body.input === word || new RegExp(`\\b${word}\\b`).test(err(body));
/** A cursor of another read's shape (reads.js's encodeCursor), which export nostr never gave. */
const foreignCursor = Buffer.from(JSON.stringify(['graph list-elements', '0123456789abcdef', 'ffffffff-ffff-4fff-bfff-ffffffffffff'])).toString('base64url');
const eleven = Array.from({ length: 11 }, (_, i) => `wss://relay${i}.example.com`);
const DNS_ELEVEN = { ...DNS, ...Object.fromEntries(eleven.map((u, i) => [new URL(u).hostname, { v4: [`1.0.3.${i + 1}`] }])) };

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    X.needDecl();
    const w = await X.world();
    const k = w.keys;
    const before = X.copy(w.state);
    const refusals = [
      exp('r-no-scope', 'owner', {}),
      exp('r-relays-only', 'owner', { relays: [X.PEER] }),
      exp('r-node-graph', 'owner', { node: k.rex, graph: k.picks }),
      exp('r-graph-everything', 'owner', { graph: k.picks, everything: true }),
      exp('r-ref-blank', 'owner', { node: '   ' }),
      exp('r-ref-control', 'owner', { graph: `pet${String.fromCharCode(7)}s` }),
      exp('r-unknown-key', 'owner', { node: crypto.randomUUID() }),
      exp('r-unknown-name', 'owner', { graph: 'no graph anywhere is called this' }),
      exp('r-ambiguous', 'owner', { node: 'Rex' }),
      exp('r-not-a-graph', 'owner', { graph: k.rex }),
      exp('r-relay-https', 'owner', { node: k.rex, relays: ['https://relay.example.com'] }),
      exp('r-relay-user', 'owner', { node: k.rex, relays: ['ws://user@relay.example.com'] }),
      exp('r-relay-text', 'owner', { node: k.rex, relays: ['not a relay url'] }),
      exp('r-private-ten', 'owner', { node: k.rex, relays: ['wss://tenfive.example.com'] }),
      exp('r-private-dns', 'owner', { node: k.rex, relays: ['wss://intranet.example.com'] }),
      exp('r-private-admin', 'admin', { node: k.rex, relays: ['wss://tenfive.example.com'] }),
      exp('r-too-many', 'owner', { node: k.rex, relays: eleven }),
      exp('r-cursor-text', 'owner', { graph: k.picks, after: 'not-a-cursor-this-operation-gave' }),
      exp('r-cursor-foreign', 'owner', { graph: k.picks, after: foreignCursor }),
    ];
    // Every relay a refusal names is a fake that would accept, so a refusal that connected or published would show.
    const relays = Object.fromEntries([X.PEER, 'wss://tenfive.example.com', 'wss://intranet.example.com', ...eleven].map((u) => [u, F.relay([])]));
    const r = X.runExport({ state: before, ownEvents: w.ownEvents, lmdb: w.lmdb, relays, dns: DNS_ELEVEN, requests: refusals, label: 'export-nostr-r' });
    const c = X.runExport({
      state: before, ownEvents: w.ownEvents, lmdb: w.lmdb, label: 'export-nostr-c',
      requests: [
        exp('c-visitor', 'visitor', { node: k.rex, dryRun: true }),
        exp('c-stranger', 'stranger', { node: k.rex, dryRun: true }),
        exp('c-owner', 'owner', { node: k.rex, dryRun: true }),
        exp('c-admin', 'admin', { node: k.rex, dryRun: true }),
        exp('c-local', 'local', { node: k.rex, dryRun: true }),
        exp('c-owner-send', 'owner', { node: k.fido }),
        exp('c-admin-send', 'admin', { node: k.spot }),
        { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'owner' },
      ],
      cli: [
        { id: 'cli-dry', argv: ['export', 'nostr', '--node', k.rex, '--dryRun'] },
        { id: 'cli-send', argv: ['export', 'nostr', '--node', k.tom] },
        { id: 'cli-refused', argv: ['export', 'nostr'] },
      ],
    });
    const nokey = X.runExport({ state: before, ownEvents: w.ownEvents, lmdb: w.lmdb, assistantKeys: null, label: 'export-nostr-k', requests: [exp('k-send', 'owner', { node: k.fido })] });
    return { w, k, before, refusals, r, afterR: r.state(), rLog: r.log(), c, afterC: c.state(), nokey };
  })();
  return MAIN;
}

test('EN1 [AC7]: every refusal signed nothing, sent nothing and recorded nothing, and says in words what was wrong', async () => {
  const { r, refusals, before, afterR, rLog } = await main();
  for (const q of refusals) {
    const x = r.req(q.id);
    assert(x.status >= 400 && x.status < 500 && x.body && x.body.success === false && err(x.body).trim().length > 20, `${q.id} is a refusal in words; got ${x.status} ${show(x.body).slice(0, 400)}`);
  }
  assert(X.signings(r.spy) === 0, `nothing was signed by any refusal; the spy saw ${show(r.spy)}`);
  assert(!rLog.some((x) => x.at === 'strfry-import' || x.at === 'publish'), `nothing was sent: no strfry import, no publish; the log has ${show(rLog.filter((x) => x.at === 'strfry-import' || x.at === 'publish'))}`);
  assert(F.sameGraph(before, afterR), `the graph after the refusals is the graph before them; differs: ${show(F.graphDiff(before, afterR))}`);
  assert(X.entriesOf(afterR).length === X.entriesOf(before).length, 'and no change entry was recorded');
});

test('EN2 [AC7, AC1]: a visitor 401 and a stranger 403; the owner, an admin, a direct-local caller and the internal command are answered, each entry its caller\'s', async () => {
  const { c, afterC, k } = await main();
  assert(c.req('c-visitor').status === 401 && c.req('c-stranger').status === 403, `a visitor 401 and a stranger 403; got ${c.req('c-visitor').status} ${c.req('c-stranger').status}`);
  const outcomeOf = (d) => { const l = X.letterFor(d, k.rex); return l && l.outcome; };
  for (const id of ['c-owner', 'c-admin', 'c-local']) {
    const d = X.data(c, id);
    assert(outcomeOf(d) === 'new', `${id}: a dry run of Rex, which has no letter, answers it new; got ${show(d).slice(0, 500)}`);
  }
  const dry = c.cmd('cli-dry');
  const body = JSON.parse(dry.stdout || '{}');
  assert(dry.code === 0 && body.success === true && outcomeOf(body.data) === 'new', `the internal command answers as the route, with no sign-in; got ${dry.code} ${String(dry.stdout).slice(0, 400)} ${dry.stderr}`);
  assert(dry.leaked === '', `the command kept the process's stdout clean; leaked ${show(dry.leaked)}`);
  const refusedCmd = c.cmd('cli-refused');
  assert(refusedCmd.code === 1 && JSON.parse(refusedCmd.stdout || '{}').code === 'no-scope', `the command's refusal is the route's: no-scope, exit 1; got ${refusedCmd.code} ${refusedCmd.stdout}`);
  const send = c.cmd('cli-send');
  assert(send.code === 0 && JSON.parse(send.stdout || '{}').success === true, `the command exports Tom; got ${send.code} ${String(send.stdout).slice(0, 300)} ${send.stderr}`);
  const entryNaming = (key) => X.exportEntries(afterC).find((e) => Array.isArray(e.keys) && e.keys.includes(key));
  const eo = entryNaming(k.fido), ea = entryNaming(k.spot), el = entryNaming(k.tom);
  assert(eo && eo.byRole === 'owner' && eo.byPubkey === X.OWNER, `the owner's export is the owner's entry; got ${show(eo)}`);
  assert(ea && ea.byRole === 'admin' && ea.byPubkey === ADMIN, `the admin's is the admin's; got ${show(ea)}`);
  assert(el && el.byRole === 'local' && (el.byPubkey === null || el.byPubkey === undefined), `the command's entry names the command, local; got ${show(el)}`);
});

test('EN3 [AC7, Decision 1]: the declaration, with its seams; listed for agents with its inputs and refusals, and its /docs entry is POST /api/tapestry/export/nostr', async () => {
  X.needDecl();
  const d = require(X.DECL);
  assert(d.group === 'export' && d.name === 'nostr' && d.kind === 'write' && d.access === 'owner-and-admins', `export nostr, a write for the owner and admins; got ${show({ group: d.group, name: d.name, kind: d.kind, access: d.access })}`);
  assert(typeof d.run === 'function' && d.apply === undefined, 'it runs with run, not through the write path, since it signs (Decision 1; the write path carries nothing that signs or publishes)');
  const ins = d.inputs || {};
  assert(show(Object.keys(ins).sort()) === show(INPUTS), `six inputs, node, graph, everything, relays, dryRun and after; got ${show(Object.keys(ins))}`);
  for (const [name, input] of Object.entries(ins)) {
    assert(!input.required, `${name} is optional`);
    assert(typeof input.description === 'string' && input.description.trim().length > 0, `${name} has a description`);
  }
  const own = Object.fromEntries((d.refusals || []).map((x) => [x.code, x.status]));
  for (const [code, status] of Object.entries(CODES)) assert(own[code] === status, `it declares ${code} at ${status}; got ${show(d.refusals)}`);
  for (const seam of ['BUDGET_MS', 'SEND_CUTOFF_MS', 'MAX_SCOPE', 'MAX_SEND']) assert(Number.isFinite(d[seam]) && d[seam] > 0, `the declaration carries ${seam}, read at each call, so a suite can shrink it (the plan's seams); got ${show(d[seam])}`);
  assert(fs.existsSync(X.SEND), 'src/operations/catalog/export/_send.js exists (Decision 6; Implementation notes)');
  const send = require(X.SEND);
  assert(send && typeof send.strfryImport === 'function' && Number.isFinite(send.OK_MS) && Number.isFinite(send.IN_FLIGHT) && typeof send.now === 'function',
    `_send.js exports an object with strfryImport(lines), OK_MS, IN_FLIGHT and now() (the plan's seams); got ${show(Object.keys(send || {}))}`);
  const now = send.now();
  assert(Number.isInteger(now) && Math.abs(now - Math.floor(Date.now() / 1000)) < 60, `now() is the Unix time in seconds; got ${show(now)}`);

  const { c } = await main();
  const e = ((c.req('list').body.data || {}).operations || []).find((o) => o.group === 'export' && o.name === 'nostr');
  assert(e, `export nostr is listed; problems: ${show((c.req('list').body.data || {}).problems)}`);
  assert(e.route === X.ROUTE && e.method === 'POST' && e.kind === 'write' && e.access === 'owner-and-admins', `its route, method, kind and access; got ${show({ route: e.route, method: e.method, kind: e.kind, access: e.access })}`);
  assert(show(Object.keys(e.inputs || {}).sort()) === show(INPUTS), `its inputs; got ${show(e.inputs)}`);
  const codes = (e.refusals || []).map((x) => x.code);
  for (const code of [...Object.keys(CODES), 'unknown-input', 'invalid-input', 'wrong-content-type', 'sign-in-required', 'not-allowed']) assert(codes.includes(code), `its refusals include ${code}; got ${show(codes)}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(X.ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('export-nostr-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${X.ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

test('EN4 [AC7, Decision 1]: no-scope (400) for none of node, graph and everything, relays alone included, naming the three', async () => {
  const { r } = await main();
  for (const rid of ['r-no-scope', 'r-relays-only']) {
    const b = X.refused(r, rid, 400, 'no-scope');
    assert(['node', 'graph', 'everything'].every((x) => new RegExp(`\\b${x}\\b`).test(err(b))), `${rid}: no-scope names the three forms of a scope; got ${err(b)}`);
  }
});

test('EN5 [AC7, Decision 1]: two-scopes (400) for node and graph, and for graph and everything, naming the two', async () => {
  const { r } = await main();
  for (const [rid, pair] of [['r-node-graph', ['node', 'graph']], ['r-graph-everything', ['graph', 'everything']]]) {
    const b = X.refused(r, rid, 400, 'two-scopes');
    assert(pair.every((x) => new RegExp(`\\b${x}\\b`).test(err(b))), `${rid}: two-scopes names ${pair.join(' and ')}; got ${err(b)}`);
  }
});

test('EN6 [AC7, Decision 1]: bad-ref (400) for a ref empty once trimmed and one with a control character, naming the input', async () => {
  const { r } = await main();
  assert(names(X.refused(r, 'r-ref-blank', 400, 'bad-ref'), 'node'), 'the blank ref is refused bad-ref, naming node');
  assert(names(X.refused(r, 'r-ref-control', 400, 'bad-ref'), 'graph'), 'the ref with a control character is refused bad-ref, naming graph');
});

test('EN7 [AC7, Decision 1]: unknown-ref (404) for a tapestryKey no node has and for a name nothing has, naming the input', async () => {
  const { r } = await main();
  // resolveOne passes a tapestryKey through unread (src/operations/resolve.js), so export nostr's own check answers it.
  assert(names(X.refused(r, 'r-unknown-key', 404, 'unknown-ref'), 'node'), 'a key no node has is unknown-ref, naming node');
  assert(names(X.refused(r, 'r-unknown-name', 404, 'unknown-ref'), 'graph'), 'a name nothing has is unknown-ref, naming graph');
});

test('EN8 [AC7, Decision 1]: ambiguous-ref (409) for a name two of the instance\'s nodes share, with the candidates', async () => {
  const { r, k } = await main();
  const b = X.refused(r, 'r-ambiguous', 409, 'ambiguous-ref');
  const keys = (b.candidates || []).map((x) => x.tapestryKey);
  assert(names(b, 'node') && keys.includes(k.rex) && keys.includes(k.dogRex), `ambiguous-ref names node and carries both Rexes as candidates, pet's and dog's; got ${show(b).slice(0, 600)}`);
});

test('EN9 [AC7, Decision 1, amendment 6]: not-a-graph (400) for graph naming an element whose JSON holds no graph object and that the graph concept\'s class thread doesn\'t reach', async () => {
  const { r } = await main();
  assert(names(X.refused(r, 'r-not-a-graph', 400, 'not-a-graph'), 'graph'), 'Rex given as graph is refused not-a-graph, naming graph');
});

test('EN10 [AC7, Decision 1]: bad-relay (400) for https, a user name and text that isn\'t a URL, naming relays', async () => {
  const { r } = await main();
  for (const rid of ['r-relay-https', 'r-relay-user', 'r-relay-text']) assert(names(X.refused(r, rid, 400, 'bad-relay'), 'relays'), `${rid}: bad-relay names relays`);
});

test('EN11 [AC7, Decision 1]: private-relay (403) for a host the DNS resolves to a private address, for the owner and an admin; the guard asked, and nothing connected', async () => {
  const { r, rLog } = await main();
  for (const rid of ['r-private-ten', 'r-private-dns', 'r-private-admin']) assert(names(X.refused(r, rid, 403, 'private-relay'), 'relays'), `${rid}: private-relay names relays`);
  const asked = new Set(rLog.filter((x) => x.at === 'dns').map((x) => x.name));
  for (const name of ['tenfive.example.com', 'intranet.example.com']) assert(asked.has(name), `the host guard asked the DNS for ${name}; asked ${show([...asked])}`);
  const touched = rLog.filter((x) => x.at === 'connect' && /tenfive|intranet/.test(String(x.url)));
  assert(touched.length === 0, `nothing connected to a refused relay; got ${show(touched)}`);
});

test('EN12 [AC7, Decision 1, amendment 6]: too-many-relays (400) for eleven relays, naming relays', async () => {
  const { r } = await main();
  const b = X.refused(r, 'r-too-many', 400, 'too-many-relays');
  assert(names(b, 'relays'), `too-many-relays names relays; got ${err(b)}`);
});

test('EN13 [AC7, Decision 1, amendment 6]: bad-cursor (400) for an after this operation didn\'t give, naming after', async () => {
  const { r } = await main();
  for (const rid of ['r-cursor-text', 'r-cursor-foreign']) assert(names(X.refused(r, rid, 400, 'bad-cursor'), 'after'), `${rid}: bad-cursor names after`);
});

test('EN14 [AC7, Decision 1]: no-assistant-key (409) when the instance\'s assistant key can\'t be read; nothing signed, sent or recorded', async () => {
  const { nokey, before } = await main();
  X.refused(nokey, 'k-send', 409, 'no-assistant-key');
  assert(X.signings(nokey.spy) === 0 && !nokey.log().some((x) => x.at === 'strfry-import' || x.at === 'publish'), `nothing was signed or sent; spy ${show(nokey.spy)}`);
  assert(F.sameGraph(before, nokey.state()) && X.entriesOf(nokey.state()).length === X.entriesOf(before).length, 'and nothing changed or was recorded');
});

test('EN15 [AC7]: the catalog\'s export row, BIBLE §6 and §11 and the agent skill say what it does; the skill no longer says no operation publishes or signs', () => {
  X.needDecl();
  const catalog = fs.readFileSync(path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md'), 'utf8');
  const s6 = catalog.slice(catalog.indexOf('## 6.'), catalog.indexOf('## 7.'));
  assert(/\/api\/tapestry\/export\/nostr/.test(s6), 'catalog §6 says where export nostr answers, /api/tapestry/export/nostr');
  const bible = fs.readFileSync(path.join(ROOT, 'BIBLE.md'), 'utf8');
  const section = (n) => { const at = bible.indexOf(`\n## ${n}. `); const end = bible.indexOf('\n## ', at + 5); return bible.slice(at, end); };
  assert(/export nostr/.test(section(6)) && /sentTo/.test(section(6)), 'BIBLE §6 says what an exported node holds (its id, created_at and sentTo)');
  assert(/\/api\/tapestry\/export\/nostr/.test(section(11)), 'BIBLE §11 lists /api/tapestry/export/nostr');
  const skill = fs.readFileSync(path.join(ROOT, 'clients/cli/skill/SKILL.md'), 'utf8');
  assert(!/none of them publishes anything to nostr or signs a nostr event/.test(skill), 'the skill stops saying that no operation publishes to nostr or signs a nostr event');
  assert(/export nostr/.test(skill), 'and says what export nostr does');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
