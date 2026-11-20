'use strict';
/**
 * import nostr — its declaration, what it refuses, who may call it and how it reaches agents. Run by
 * test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/32-import-nostr.md (AC1's callers, AC7)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0032-import-nostr.md (Decisions 1, 10 and 11;
 *          Consequences: the catalog, BIBLE §6 and §11, the agent skill)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/32-import-nostr.test-plan.md
 *
 * Stack-free: the real catalog over the graph test/helpers/cypherGraphFake.js keeps, and the relays and DNS of
 * test/helpers/relayFake.js. The graph holds the assistant's concept dog (test/helpers/importFixtures.js's ownConcept);
 * relay.example.com holds two of alice's letters and one of bob's; the instance's own relay holds one of bob's. R holds
 * only refusals, so the graph after R is the graph before it, and the relays saw no connection; C holds the callers the
 * module refuses; W imports as the admin, the owner, a direct-local caller and the command, with the spy on.
 *
 *   IN1  the declaration: import nostr, a write for the owner and admins, with run and no apply, guards or repeatKey;
 *        five inputs, none required, each described; nine refusals of its own at their statuses
 *   IN2  listed for agents with its inputs and every refusal, and its /docs entry, POST /api/tapestry/import/nostr
 *   IN3  no-source; two-sources for each pair; ids and addresses together are one source
 *   IN4  too-many: more than 200 ids and addresses together; 201 ids alone and no ids at all are refused too, naming ids
 *   IN5  bad-id: not hex, 63 characters, uppercase hex, a note or an nevent that doesn't decode, an npub; each names the
 *        value (uppercase is refused, never lowered: settled at Test Design)
 *   IN6  bad-address: a kind that isn't one, a kind past 65535, a pubkey that isn't 64 hex, an uppercase-hex pubkey, no
 *        d part, an naddr that doesn't decode; and an id given as graph
 *   IN7  bad-filter: JSON text that doesn't parse, a field it doesn't take, kinds of the wrong type, a tag of two
 *        letters, a since that isn't a number
 *   IN8  bad-relay: http and https, a user name, no host, text that isn't a URL
 *   IN9  private-relay (403), for the owner, an admin, a direct-local caller and the command: the instance's own relay
 *        named, localhost, a private address, IPv6 loopback, and names that resolve to a private address, to a public
 *        and a private one, or to nothing; no relay was connected to, and the guard asked the DNS for the names
 *   IN10 every refusal of R changed nothing and recorded no entry, and says in words what was wrong, naming the input
 *   IN11 the callers: a visitor 401, a stranger 403, a body that isn't JSON 415, an input it doesn't take, a filter's
 *        text past 10,000 characters, a relay past 2,000, ids that aren't a list
 *   IN12 the owner, an admin and a direct-local caller import, each entry its caller's; nothing is signed or published,
 *        no key is read and no strfry child process runs
 *   IN13 the internal command imports with the same inputs, its entry naming the command; its refusal is the route's
 *   IN14 the catalog, BIBLE §6 and §11 and the agent skill say what it does; the catalog stops saying the stream
 *        consumer imports continuously
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const F = require('../../helpers/importFixtures');
const R = require('../../helpers/relayFake');

const { ROOT, ADMIN, OWNER, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: import nostr — its declaration, its refusals, its callers');
const { KEYS, imp } = F;

const CODES = Object.freeze({
  'no-source': 400, 'two-sources': 400, 'too-many': 400, 'bad-id': 400, 'bad-address': 400, 'bad-filter': 400, 'bad-relay': 400,
  'private-relay': 403, 'relay-unreachable': 409,
});
const PK = KEYS.alice.pubkey;
const N1 = F.letter(KEYS.alice, { kind: 1, at: 1700000001, tags: [['t', 'hello']], content: 'hello' });
const A1 = F.letter(KEYS.alice, { kind: 39999, at: 1700000002, tags: [['d', 'a-thing'], ['name', 'A Thing']] });
const N2 = F.letter(KEYS.bob, { kind: 1, at: 1700000003, content: 'on the own relay' });
const N3 = F.letter(KEYS.bob, { kind: 1, at: 1700000004, content: 'for the command' });
const N4 = F.letter(KEYS.bob, { kind: 1, at: 1700000005, content: 'asked by id beside an address' });
const A2 = F.letter(KEYS.alice, { kind: 39999, at: 1700000006, tags: [['d', 'second-thing'], ['name', 'Second Thing']] });
const RELAYS = { [F.PEER_RELAY]: F.relay([N1, A1, N3, N4, A2]), [F.OWN_RELAY]: F.relay([N2]) };
const hexes = (n, salt) => Array.from({ length: n }, (_, i) => require('crypto').createHash('sha256').update(`${salt}:${i}`).digest('hex'));
const err = (body) => String(body && body.error);
const names = (body, word) => body.input === word || new RegExp(`\\b${word}\\b`).test(err(body));

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    F.needDecl();
    const state = F.emptyGraph();
    const own = F.ownConcept(state);
    const before = JSON.parse(JSON.stringify(state));
    const id = N1.id;
    const refusals = [
      imp('r-no-source', 'owner', {}),
      imp('r-relay-only', 'owner', { relay: F.PEER_RELAY }),
      imp('r-ids-graph', 'owner', { ids: [id], graph: F.addressOf(A1) }),
      imp('r-addresses-filter', 'owner', { addresses: [F.addressOf(A1)], filter: { kinds: [1] } }),
      imp('r-graph-filter', 'owner', { graph: F.addressOf(A1), filter: { kinds: [1] } }),
      imp('r-ids-filter', 'owner', { ids: [id], filter: { kinds: [1] } }),
      imp('r-too-many', 'owner', { ids: hexes(150, 'ids'), addresses: hexes(51, 'd').map((d) => `39999:${PK}:${d}`) }),
      imp('r-201-ids', 'owner', { ids: hexes(201, 'many') }),
      imp('r-no-ids', 'owner', { ids: [] }),
      imp('r-bad-id-hex', 'owner', { ids: ['zz'.repeat(32)] }),
      imp('r-bad-id-short', 'owner', { ids: [id.slice(0, 63)] }),
      imp('r-bad-id-upper', 'owner', { ids: [id.toUpperCase()] }),
      imp('r-bad-note', 'owner', { ids: ['note1qqqqqqqqqqqq'] }),
      imp('r-bad-nevent', 'owner', { ids: ['nevent1notanevent'] }),
      imp('r-npub', 'owner', { ids: [F.NT.nip19.npubEncode(PK)] }),
      imp('r-bad-kind', 'owner', { addresses: [`thing:${PK}:d`] }),
      imp('r-kind-range', 'owner', { addresses: [`70000:${PK}:d`] }),
      imp('r-bad-pubkey', 'owner', { addresses: ['39999:abc:d'] }),
      imp('r-upper-pubkey', 'owner', { addresses: [`39999:${PK.toUpperCase()}:d`] }),
      imp('r-no-d', 'owner', { addresses: [`39999:${PK}`] }),
      imp('r-bad-naddr', 'owner', { addresses: ['naddr1notannaddr'] }),
      imp('r-graph-id', 'owner', { graph: id }),
      imp('r-filter-json', 'owner', { filter: '{"kinds": [1' }),
      imp('r-filter-field', 'owner', { filter: { kinds: [1], foo: 1 } }),
      imp('r-filter-kinds', 'owner', { filter: { kinds: '1' } }),
      imp('r-filter-tag', 'owner', { filter: { '#ab': ['x'] } }),
      imp('r-filter-since', 'owner', { filter: { since: 'yesterday' } }),
      imp('r-relay-https', 'owner', { ids: [id], relay: 'https://relay.example.com' }),
      imp('r-relay-http', 'owner', { ids: [id], relay: 'http://relay.example.com' }),
      imp('r-relay-user', 'owner', { ids: [id], relay: 'wss://me@relay.example.com' }),
      imp('r-relay-nohost', 'owner', { ids: [id], relay: 'wss://' }),
      imp('r-relay-text', 'owner', { ids: [id], relay: 'relay.example.com' }),
      imp('r-private-own', 'owner', { ids: [id], relay: F.OWN_RELAY }),
      imp('r-private-localhost', 'owner', { ids: [id], relay: 'ws://localhost:7777' }),
      imp('r-private-10', 'owner', { ids: [id], relay: 'ws://10.0.0.5' }),
      imp('r-private-v6', 'owner', { ids: [id], relay: 'wss://[::1]' }),
      imp('r-private-dns', 'owner', { ids: [id], relay: 'wss://intranet.example.com' }),
      imp('r-private-mixed', 'owner', { ids: [id], relay: 'wss://mixed.example.com' }),
      imp('r-private-nowhere', 'owner', { ids: [id], relay: 'wss://nowhere.example.com' }),
      imp('r-private-admin', 'admin', { ids: [id], relay: 'ws://10.0.0.5' }),
      imp('r-private-local', 'local', { ids: [id], relay: F.OWN_RELAY }),
    ];
    // The instance's own relay and every refused host are in the fixture, so a refusal that connected would show.
    const refusalRelays = { ...RELAYS, 'ws://localhost:7777': F.relay([N1]), 'ws://10.0.0.5': F.relay([N1]), 'wss://[::1]': F.relay([N1]), 'wss://intranet.example.com': F.relay([N1]), 'wss://mixed.example.com': F.relay([N1]) };
    const r = F.runImport({ state, relays: refusalRelays, requests: refusals, cli: [{ id: 'cli-private', argv: ['import', 'nostr', '--ids', id, '--relay', 'ws://10.0.0.5'] }], label: 'import-nostr-r' });
    const afterR = r.state();
    const rLog = r.log();

    const c = F.runImport({
      state: before,
      relays: RELAYS,
      requests: [
        imp('c-visitor', 'visitor', { ids: [id], relay: F.PEER_RELAY }),
        imp('c-stranger', 'stranger', { ids: [id], relay: F.PEER_RELAY }),
        { id: 'c-text', method: 'POST', url: F.ROUTE, caller: 'owner', contentType: 'text/plain', rawBody: `ids=${id}` },
        imp('c-unknown', 'owner', { ids: [id], foo: 1 }),
        imp('c-filter-long', 'owner', { filter: `{"search": "${'x'.repeat(10001)}"}` }),
        imp('c-relay-long', 'owner', { ids: [id], relay: `wss://${'a'.repeat(2001)}.com` }),
        imp('c-ids-type', 'owner', { ids: 'not a list' }),
      ],
      label: 'import-nostr-c',
    });

    const w = F.runImport({
      state: before,
      relays: RELAYS,
      spy: true,
      requests: [
        imp('w-admin', 'admin', { ids: [N1.id], relay: F.PEER_RELAY }),
        imp('w-owner', 'owner', { addresses: [F.addressOf(A1)], relay: F.PEER_RELAY }),
        imp('w-local', 'local', { ids: [N2.id] }),
        imp('w-both', 'owner', { ids: [N4.id], addresses: [F.addressOf(A2)], relay: F.PEER_RELAY }),
        { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'owner' },
      ],
      cli: [
        { id: 'cli', argv: ['import', 'nostr', '--ids', N3.id, '--relay', F.PEER_RELAY] },
        { id: 'cli-refused', argv: ['import', 'nostr'] },
      ],
      label: 'import-nostr-w',
    });
    return { own, before, refusals, r, afterR, rLog, c, w, afterW: w.state() };
  })();
  return MAIN;
}

test('IN1 [Decisions 1 and 10]: the declaration: a write for the owner and admins with run, five optional inputs, nine refusals of its own', async () => {
  F.needDecl();
  const d = require(F.DECL);
  assert(d.group === 'import' && d.name === 'nostr' && d.kind === 'write' && d.access === 'owner-and-admins', `import nostr, a write for the owner and admins; got ${show({ group: d.group, name: d.name, kind: d.kind, access: d.access })}`);
  assert(typeof d.run === 'function' && d.apply === undefined && d.guards === undefined && d.repeatKey === undefined,
    'it runs with run, not through the write path: no apply, no guards, no repeatKey (Decision 10: what makes a repeat safe is each event\'s address or id, and no guard runs, D4)');
  const ins = d.inputs || {};
  assert(show(Object.keys(ins).sort()) === show(['addresses', 'filter', 'graph', 'ids', 'relay']), `five inputs; got ${show(Object.keys(ins))}`);
  for (const [name, input] of Object.entries(ins)) {
    assert(!input.required, `${name} is optional`);
    assert(typeof input.description === 'string' && input.description.trim().length > 0, `${name} has a description`);
  }
  const own = Object.fromEntries((d.refusals || []).map((x) => [x.code, x.status]));
  for (const [code, status] of Object.entries(CODES)) assert(own[code] === status, `it declares ${code} at ${status}; got ${show(d.refusals)}`);
});

test('IN2 [AC7]: listed for agents with its inputs and every refusal, and its /docs entry is POST /api/tapestry/import/nostr', async () => {
  const { w } = await main();
  const e = ((w.req('list').body.data || {}).operations || []).find((o) => o.group === 'import' && o.name === 'nostr');
  assert(e, `import nostr is listed; problems: ${show((w.req('list').body.data || {}).problems)}`);
  assert(e.route === F.ROUTE && e.method === 'POST' && e.kind === 'write' && e.access === 'owner-and-admins', `its route, method, kind and access; got ${show({ route: e.route, method: e.method, kind: e.kind, access: e.access })}`);
  assert(show(Object.keys(e.inputs || {}).sort()) === show(['addresses', 'filter', 'graph', 'ids', 'relay']), `its inputs; got ${show(e.inputs)}`);
  const codes = (e.refusals || []).map((x) => x.code);
  for (const code of [...Object.keys(CODES), 'unknown-input', 'invalid-input', 'wrong-content-type', 'sign-in-required', 'not-allowed']) assert(codes.includes(code), `its refusals include ${code}; got ${show(codes)}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(F.ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('import-nostr-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${F.ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

test('IN3 [AC7, Decision 1]: no-source; two-sources for each pair; ids and addresses together are one source', async () => {
  const { r, w } = await main();
  const none = F.refused(r, 'r-no-source', 400, 'no-source');
  assert(['ids', 'addresses', 'graph', 'filter'].every((x) => names(none, x)), `no-source names the four ways in; got ${err(none)}`);
  F.refused(r, 'r-relay-only', 400, 'no-source');
  for (const [rid, pair] of [['r-ids-graph', ['ids', 'graph']], ['r-addresses-filter', ['addresses', 'filter']], ['r-graph-filter', ['graph', 'filter']], ['r-ids-filter', ['ids', 'filter']]]) {
    const b = F.refused(r, rid, 400, 'two-sources');
    assert(pair.every((x) => new RegExp(`\\b${x}\\b`).test(err(b))), `${rid}: two-sources names ${pair.join(' and ')}; got ${err(b)}`);
  }
  const both = F.data(w, 'w-both');
  assert(both.source === 'ids' && both.counts.recorded === 2 && F.forRef(both, N4.id).length === 1 && F.forRef(both, F.addressOf(A2)).length === 1,
    `ids and addresses together are one source, 'ids', each asked for answered once; got ${show(both).slice(0, 500)}`);
});

test('IN4 [AC7, Decision 1]: too-many past 200 ids and addresses together; 201 ids alone and an empty list are refused, naming ids', async () => {
  const { r } = await main();
  const b = F.refused(r, 'r-too-many', 400, 'too-many');
  assert(/\b200\b/.test(err(b)) && /\bids\b/.test(err(b)) && /\baddresses\b/.test(err(b)), `too-many says one call takes 200 ids and addresses together; got ${err(b)}`);
  const many = r.req('r-201-ids');
  assert(many.status === 400 && ['too-many', 'invalid-input'].includes(many.body.code) && names(many.body, 'ids'), `201 ids alone: refused, naming ids; got ${many.status} ${show(many.body)}`);
  const empty = r.req('r-no-ids');
  assert(empty.status === 400 && names(empty.body, 'ids'), `ids: [] is refused (1 to 200), naming ids; got ${empty.status} ${show(empty.body)}`);
});

test('IN5 [AC7, Decision 1]: bad-id for an id that isn\'t 64 lowercase hex (uppercase is refused, never lowered), a note or nevent that doesn\'t decode, and an npub; each names the value', async () => {
  const { r, refusals } = await main();
  for (const rid of ['r-bad-id-hex', 'r-bad-id-short', 'r-bad-id-upper', 'r-bad-note', 'r-bad-nevent', 'r-npub']) {
    const b = F.refused(r, rid, 400, 'bad-id');
    const value = refusals.find((q) => q.id === rid).body.ids[0];
    assert(err(b).includes(value), `${rid}: the refusal names the value it couldn't read, ${value}; got ${err(b)}`);
  }
});

test('IN6 [AC7, Decision 1]: bad-address for a kind, a pubkey (uppercase hex included) or a d part that isn\'t one, an naddr that doesn\'t decode, and an id given as graph', async () => {
  const { r, refusals } = await main();
  for (const rid of ['r-bad-kind', 'r-kind-range', 'r-bad-pubkey', 'r-upper-pubkey', 'r-no-d', 'r-bad-naddr']) {
    const b = F.refused(r, rid, 400, 'bad-address');
    const value = refusals.find((q) => q.id === rid).body.addresses[0];
    assert(err(b).includes(value), `${rid}: the refusal names ${value}; got ${err(b)}`);
  }
  const g = F.refused(r, 'r-graph-id', 400, 'bad-address');
  assert(names(g, 'graph'), `an id given as graph is refused: graph takes an address or an naddr; got ${err(g)}`);
});

test('IN7 [AC7, Decision 1]: bad-filter for JSON that doesn\'t parse, a field it doesn\'t take, a wrong type, a tag of two letters, a since that isn\'t a number', async () => {
  const { r } = await main();
  for (const [rid, word] of [['r-filter-json', 'filter'], ['r-filter-field', 'foo'], ['r-filter-kinds', 'kinds'], ['r-filter-tag', '#ab'], ['r-filter-since', 'since']]) {
    const b = F.refused(r, rid, 400, 'bad-filter');
    assert(err(b).includes(word), `${rid}: bad-filter names ${word}; got ${err(b)}`);
  }
});

test('IN8 [AC7, Decision 1]: bad-relay for http, https, a user name, no host and text that isn\'t a URL', async () => {
  const { r } = await main();
  for (const rid of ['r-relay-https', 'r-relay-http', 'r-relay-user', 'r-relay-nohost', 'r-relay-text']) {
    const b = F.refused(r, rid, 400, 'bad-relay');
    assert(names(b, 'relay'), `${rid}: bad-relay names relay; got ${err(b)}`);
  }
});

test('IN9 [AC7, Decision 1]: private-relay for every caller and the command; no relay was connected to, and the guard asked the DNS for the names', async () => {
  const { r, rLog } = await main();
  for (const rid of ['r-private-own', 'r-private-localhost', 'r-private-10', 'r-private-v6', 'r-private-dns', 'r-private-mixed', 'r-private-nowhere', 'r-private-admin', 'r-private-local']) {
    const b = F.refused(r, rid, 403, 'private-relay');
    assert(names(b, 'relay'), `${rid}: private-relay names relay; got ${err(b)}`);
  }
  const cli = r.cmd('cli-private');
  const body = JSON.parse(cli.stdout || '{}');
  assert(cli.code === 1 && body.code === 'private-relay', `the command is refused private-relay too; got ${cli.code} ${cli.stdout}`);
  const connects = rLog.filter((x) => x.at === 'connect');
  assert(connects.length === 0, `no relay was connected to by any refusal; got ${show(connects)}`);
  const asked = new Set(rLog.filter((x) => x.at === 'dns').map((x) => x.name));
  for (const name of ['intranet.example.com', 'mixed.example.com', 'nowhere.example.com']) assert(asked.has(name), `the host guard asked the DNS for ${name}; asked ${show([...asked])}`);
});

test('IN10 [AC7]: every refusal of R changed nothing and recorded no entry, and says in words what was wrong', async () => {
  const { r, refusals, before, afterR } = await main();
  for (const q of refusals) {
    const x = r.req(q.id);
    assert(x.status >= 400 && x.status < 500 && x.body && x.body.success === false && err(x.body).trim().length > 20, `${q.id} is a refusal in words; got ${x.status} ${show(x.body)}`);
  }
  assert(F.sameGraph(before, afterR), `the graph after R is the graph before it; differs: ${show(F.graphDiff(before, afterR))}`);
  assert(F.entries(afterR).length === F.entries(before).length, 'and no change entry was recorded');
});

test('IN11 [AC7]: the callers: a visitor 401, a stranger 403, a body that isn\'t JSON 415, and the inputs the module checks', async () => {
  const { c, before } = await main();
  // The central auth middleware answers a visitor and a stranger before the route does, so only the status is its own.
  const status = (rid) => c.req(rid).status;
  assert(status('c-visitor') === 401 && status('c-stranger') === 403 && status('c-text') === 415 && ['c-visitor', 'c-stranger', 'c-text'].every((x) => c.req(x).body.success === false),
    `a visitor 401, a stranger 403, a text/plain body 415; got ${status('c-visitor')} ${status('c-stranger')} ${status('c-text')}`);
  const u = F.refused(c, 'c-unknown', 400, 'unknown-input');
  assert(u.input === 'foo', `unknown-input names foo; got ${show(u)}`);
  for (const [rid, input] of [['c-filter-long', 'filter'], ['c-relay-long', 'relay'], ['c-ids-type', 'ids']]) {
    const b = c.req(rid);
    assert(b.status === 400 && names(b.body, input), `${rid}: refused, naming ${input}; got ${b.status} ${show(b.body).slice(0, 300)}`);
  }
  assert(F.sameGraph(before, c.state()) && F.entries(c.state()).length === F.entries(before).length, 'nothing changed');
});

test('IN12 [AC1, AC7]: the owner, an admin and a direct-local caller import, each entry its caller\'s; nothing is signed, published or read from a key store', async () => {
  const { w, afterW } = await main();
  const byOf = (rid) => { const d = F.data(w, rid); assert(d.counts && d.counts.recorded === 1 && d.changes === 1, `${rid} records one event and one entry; got ${show(d).slice(0, 400)}`); return d; };
  const da = byOf('w-admin'), dov = byOf('w-owner'), dl = byOf('w-local');
  const entryFor = (d) => F.entries(afterW).find((e) => e.operation === 'import nostr' && Array.isArray(e.keys) && e.keys.includes(d.events[0].node));
  const ea = entryFor(da), eo = entryFor(dov), el = entryFor(dl);
  assert(ea && ea.byRole === 'admin' && ea.byPubkey === ADMIN, `the admin's import is the admin's; got ${show(ea)}`);
  assert(eo && eo.byRole === 'owner' && eo.byPubkey === OWNER, `the owner's is the owner's; got ${show(eo)}`);
  assert(el && el.byRole === 'local' && (el.byPubkey === null || el.byPubkey === undefined), `a direct-local caller's is local; got ${show(el)}`);
  assert(dl.relay === 'own' && R.normalize(da.relay) === R.normalize(F.PEER_RELAY), `relay: own when left out, else the URL read; got ${show([dl.relay, da.relay])}`);
  assert(Array.isArray(w.spy) && w.spy.length === 0, `nothing was signed, no key was read and no strfry child process ran; the spy saw ${show(w.spy)}`);
  assert(!w.log().some((x) => x.at === 'publish'), 'nothing was published to any relay');
});

test('IN13 [AC7]: the internal command imports with the same inputs, its entry naming the command; its refusal is the route\'s', async () => {
  const { w, afterW } = await main();
  const c = w.cmd('cli');
  const body = JSON.parse(c.stdout || '{}');
  assert(c.code === 0 && body.success === true && body.data.counts.recorded === 1 && body.data.events[0].id === N3.id, `the command recorded N3; got ${c.code} ${String(c.stdout).slice(0, 400)} ${c.stderr}`);
  assert(c.leaked === '', `the command kept the process's stdout clean; leaked ${show(c.leaked)}`);
  const e = F.entries(afterW).find((x) => x.operation === 'import nostr' && x.keys.includes(body.data.events[0].node));
  assert(e && e.byRole === 'local', `its entry names the command (local); got ${show(e)}`);
  const rc = w.cmd('cli-refused');
  const rb = JSON.parse(rc.stdout || '{}');
  assert(rc.code === 1 && rb.code === 'no-source', `the command's refusal is the route's: no-source, exit 1; got ${rc.code} ${rc.stdout}`);
});

test('IN14 [AC7, Consequences]: the catalog, BIBLE §6 and §11 and the agent skill say what it does; the catalog stops saying the stream consumer imports continuously', () => {
  F.needDecl();
  const catalog = fs.readFileSync(path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md'), 'utf8');
  const s5 = catalog.slice(catalog.indexOf('## 5.'), catalog.indexOf('## 6.'));
  assert(!/imports continuously/.test(s5), `catalog §5 no longer says the stream consumer imports continuously (story fact 3); got ${show(s5.slice(0, 600))}`);
  assert(/\/api\/tapestry\/import\/nostr|`import nostr`/.test(s5), 'catalog §5 says where import nostr answers');
  const bible = fs.readFileSync(path.join(ROOT, 'BIBLE.md'), 'utf8');
  const section = (n) => { const at = bible.indexOf(`\n## ${n}. `); const end = bible.indexOf('\n## ', at + 5); return bible.slice(at, end); };
  assert(/import nostr/.test(section(6)), 'BIBLE §6 says what import nostr records and how it keys events');
  assert(/\/api\/tapestry\/import\/nostr/.test(section(11)), 'BIBLE §11 lists /api/tapestry/import/nostr');
  const skill = fs.readFileSync(path.join(ROOT, 'clients/cli/skill/SKILL.md'), 'utf8');
  const line = skill.split('\n').find((l) => /checks the graph's rules as it writes/.test(l)) || '';
  assert(/\bimport/i.test(line), `the skill's line that every operation checks the graph's rules as it writes gains the exception for imports; got ${show(line)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
