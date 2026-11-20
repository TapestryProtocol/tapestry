'use strict';
/**
 * import nostr — reading the relay. Run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/32-import-nostr.md (AC1's relay, AC7's unreachable
 *          relay told apart from one that holds none of what was asked)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0032-import-nostr.md (Decisions 1 and 2;
 *          Implementation notes: the relay seam and the relay host guard)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/32-import-nostr.test-plan.md
 *
 * Stack-free, over test/helpers/cypherGraphFake.js and test/helpers/relayFake.js, whose log records each connection,
 * request, end of stored events, close and DNS question. Two cases wait out Decision 2's ten seconds for a request
 * that never ends.
 *
 *   IL1  relay left out: the instance's own relay, ws://127.0.0.1:7777, with no DNS question; relay answered as own
 *   IL2  150 ids: requests of at most 100 ids, one at a time, on one connection; all recorded
 *   IL3  addresses grouped by kind and pubkey: an addressable kind as kinds, authors and #d, at most 100 d-tags a
 *        request; a replaceable kind as kinds and authors
 *   IL4  a connection that fails once is tried once more
 *   IL5  relay-unreachable (409), changing nothing: a relay that refuses both tries, and one whose first request never
 *        ends; a relay that holds none of what was asked is answered (200), each not-found
 *   IL6  a request that doesn't finish, closed by the relay or never ended, leaves its events unread, and the rest are
 *        recorded
 *   IL7  the host guard asks the DNS for a named relay's host before connecting to it
 */

const S = require('../../helpers/graphOpsSuite');
const F = require('../../helpers/importFixtures');
const R = require('../../helpers/relayFake');

const { assert, show } = S;
const { test, run } = S.makeSuite('operations: import nostr — reading the relay');
const { KEYS, imp, letter } = F;
const al = KEYS.alice, bob = KEYS.bob;
const NAMES = ['retry', 'refusing', 'silent', 'empty', 'closing', 'stalling', 'grouping'];
const URL = (name) => `wss://${name}.example.com`;
const DNS = { ...F.DNS, ...Object.fromEntries(NAMES.map((n, i) => [`${n}.example.com`, { v4: [`1.0.1.${i + 2}`] }])) };
const at = (rid, relay, body) => imp(rid, 'admin', { relay: URL(relay), ...body });
const notes = (who, n, base) => Array.from({ length: n }, (_, i) => letter(who, { kind: 1, at: base + i, content: `${who.label} ${base + i}` }));

const own = notes(bob, 2, 1700400000);
const many = notes(al, 150, 1700401000);
const retried = notes(al, 1, 1700402000);
const quiet = notes(bob, 3, 1700403000);
const closing = notes(al, 150, 1700404000);
const stalling = notes(bob, 150, 1700405000);
const d3 = ['a', 'b', 'c'].map((d) => letter(al, { kind: 39999, at: 1700406000, tags: [['d', `grouped-${d}`]] }));
const headers = ['h1', 'h2'].map((d) => letter(al, { kind: 39998, at: 1700406001, tags: [['d', d]] }));
const bobs = [letter(bob, { kind: 39999, at: 1700406002, tags: [['d', 'bobs']] })];
const lots = Array.from({ length: 120 }, (_, i) => letter(bob, { kind: 30000, at: 1700406003, tags: [['d', `list-${i}`]] }));
const profile = letter(al, { kind: 0, at: 1700406004, content: '{}' });
const muted = letter(bob, { kind: 10000, at: 1700406005, tags: [['p', al.pubkey]] });

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    F.needDecl();
    const state = F.emptyGraph();
    const relays = {
      [F.OWN_RELAY]: F.relay(own),
      [F.PEER_RELAY]: F.relay(many),
      [URL('retry')]: F.relay(retried, { connect: 'fail-once' }),
      [URL('refusing')]: F.relay(quiet, { connect: 'refuse' }),
      [URL('silent')]: F.relay(quiet, { noEose: [1] }),
      [URL('empty')]: F.relay([]),
      [URL('closing')]: F.relay(closing, { close: [{ request: 2, afterEvents: 0 }] }),
      [URL('stalling')]: F.relay(stalling, { noEose: [2] }),
      [URL('grouping')]: F.relay([...d3, ...headers, ...bobs, ...lots, profile, muted]),
    };
    const before = JSON.parse(JSON.stringify(state));
    const refusedRun = F.runImport({
      state, relays, dns: DNS, label: 'import-nostr-unreachable',
      requests: [at('refusing', 'refusing', { ids: quiet.map((e) => e.id) }), at('silent', 'silent', { ids: quiet.map((e) => e.id) })],
    });
    const r = F.runImport({
      state, relays, dns: DNS, label: 'import-nostr-relay',
      requests: [
        imp('own', 'admin', { ids: own.map((e) => e.id) }),
        imp('many', 'admin', { ids: many.map((e) => e.id), relay: F.PEER_RELAY }),
        at('retry', 'retry', { ids: retried.map((e) => e.id) }),
        at('empty', 'empty', { ids: quiet.map((e) => e.id), addresses: [`39999:${al.pubkey}:nothing-here`] }),
        at('closing', 'closing', { ids: closing.map((e) => e.id) }),
        at('stalling', 'stalling', { ids: stalling.map((e) => e.id) }),
        at('grouping', 'grouping', { addresses: [...d3, ...headers, ...bobs, ...lots, profile, muted].map(F.addressOf) }),
      ],
    });
    return { before, refusedRun, r, after: r.state(), log: r.log(), refusedLog: refusedRun.log() };
  })();
  return MAIN;
}

const reqs = (log, url) => log.filter((x) => x.at === 'req' && x.url === R.normalize(url));

test('IL1 [AC1, Decision 2]: relay left out reads the instance\'s own relay, with no DNS question', async () => {
  const { r, log } = await main();
  const d = F.data(r, 'own');
  assert(d.relay === 'own' && d.counts.recorded === 2, `relay: own, both recorded; got ${show({ relay: d.relay, counts: d.counts })}`);
  assert(log.some((x) => x.at === 'connect' && x.ok && x.url === R.normalize(F.OWN_RELAY)), `it connected to ${F.OWN_RELAY}, the in-container relay (never /relay)`);
  assert(!log.some((x) => x.at === 'dns' && /127\.0\.0\.1|localhost/.test(x.name)), 'and asked the DNS nothing for it: the own relay needs no guard');
});

test('IL2 [Decision 2]: 150 ids go in requests of at most 100 ids, one at a time, on one connection', async () => {
  const { r, log } = await main();
  const d = F.data(r, 'many');
  assert(d.counts.recorded === 150, `all 150 recorded; got ${show(d.counts)}`);
  const q = reqs(log, F.PEER_RELAY);
  const asked = q.flatMap((x) => x.filters.flatMap((f) => f.ids || []));
  assert(q.length >= 2 && q.every((x) => x.filters.every((f) => Array.isArray(f.ids) && f.ids.length <= 100)), `at most 100 ids a request; got ${show(q.map((x) => x.filters.map((f) => (f.ids || []).length)))}`);
  assert(new Set(asked).size === 150 && many.every((e) => asked.includes(e.id)), 'every id asked for');
  assert(!q.some((x) => x.overlap), 'one request at a time');
  assert(log.filter((x) => x.at === 'connect' && x.ok && x.url === R.normalize(F.PEER_RELAY)).length === 1, 'one connection for the call');
});

test('IL3 [Decision 2]: addresses are grouped by kind and pubkey; #d at most 100 a request; a replaceable kind with no #d', async () => {
  const { r, log } = await main();
  const d = F.data(r, 'grouping');
  assert(d.counts.recorded === d3.length + headers.length + bobs.length + lots.length + 2, `every address recorded; got ${show(d.counts)}`);
  const fs = reqs(log, URL('grouping')).flatMap((x) => x.filters);
  assert(fs.every((f) => Array.isArray(f.kinds) && f.kinds.length === 1 && Array.isArray(f.authors) && f.authors.length === 1), `each request one kind and one author; got ${show(fs)}`);
  const of = (kind, who) => fs.filter((f) => f.kinds[0] === kind && f.authors[0] === who.pubkey);
  const dOf = (kind, who) => of(kind, who).flatMap((f) => f['#d'] || []);
  assert(of(39999, al).length === 1 && show(dOf(39999, al).sort()) === show(['grouped-a', 'grouped-b', 'grouped-c']), `alice's three 39999s in one request of their d-tags; got ${show(of(39999, al))}`);
  assert(show(dOf(39998, al).sort()) === show(['h1', 'h2']) && show(dOf(39999, bob)) === show(['bobs']), 'her 39998s apart, and bob\'s 39999 apart');
  assert(of(30000, bob).length >= 2 && of(30000, bob).every((f) => f['#d'].length <= 100) && dOf(30000, bob).length === 120, `120 d-tags of one kind and pubkey: requests of at most 100; got ${show(of(30000, bob).map((f) => f['#d'].length))}`);
  for (const [kind, who] of [[0, al], [10000, bob]]) {
    const x = of(kind, who);
    assert(x.length === 1 && x[0]['#d'] === undefined, `kind ${kind}: kinds and authors, no #d (NIP-01's empty d-tag); got ${show(x)}`);
  }
});

test('IL4 [Decision 2]: a connection that fails once is tried once more', async () => {
  const { r, log } = await main();
  const d = F.data(r, 'retry');
  assert(d.counts.recorded === 1, `read on the second try; got ${show(d.counts)}`);
  const tries = log.filter((x) => x.at === 'connect' && x.url === R.normalize(URL('retry')));
  assert(tries.length === 2 && !tries[0].ok && tries[1].ok, `two tries, the second connected; got ${show(tries)}`);
});

test('IL5 [AC7, Decision 1]: relay-unreachable for a relay that refuses both tries or never ends its first request; one that holds nothing is answered', async () => {
  const { refusedRun, before, refusedLog, r } = await main();
  const a = F.refused(refusedRun, 'refusing', 409, 'relay-unreachable');
  assert(/refusing\.example\.com/.test(String(a.error)) || a.input === 'relay', `it names the relay; got ${show(a)}`);
  assert(refusedLog.filter((x) => x.at === 'connect' && x.url === R.normalize(URL('refusing'))).length === 2, 'two tries, as Decision 2 gives connecting one retry');
  const b = F.refused(refusedRun, 'silent', 409, 'relay-unreachable');
  assert(/silent\.example\.com/.test(String(b.error)) || b.input === 'relay', `a relay whose first request never ends, with nothing read: unreachable, named; got ${show(b)}`);
  assert(F.sameGraph(before, refusedRun.state()) && F.entries(refusedRun.state()).length === 0, 'neither changed anything');
  const e = F.data(r, 'empty');
  assert(e.events.length === 4 && e.events.every((x) => x.outcome === 'not-found') && e.counts.notFound === 4, `a relay that holds none of what was asked is answered, each not-found: told apart from one that can't be reached; got ${show(e.events)}`);
  assert(!/unreachable/i.test(JSON.stringify(e)), 'and says nothing of being unreachable');
});

test('IL6 [AC1, Decision 2]: a request that doesn\'t finish leaves its events unread; the rest are recorded', async () => {
  const { r, after } = await main();
  for (const [rid, list] of [['closing', closing], ['stalling', stalling]]) {
    const d = F.data(r, rid);
    const unread = d.events.filter((x) => x.outcome === 'unread');
    const recorded = d.events.filter((x) => x.outcome === 'recorded');
    assert(unread.length > 0 && recorded.length > 0 && unread.length + recorded.length === list.length && d.counts.unread === unread.length, `${rid}: the first request's events recorded, the unfinished one's unread; got ${show(d.counts)}`);
    for (const x of unread) assert(F.withId(after, x.id).length === 0 && x.node === null, `${rid}: an unread event isn't recorded`);
  }
});

test('IL7 [AC7, Implementation notes]: the host guard asks the DNS for a named relay\'s host before connecting', async () => {
  const { log } = await main();
  const host = 'relay.example.com';
  const firstDns = log.findIndex((x) => x.at === 'dns' && x.name === host);
  const firstConnect = log.findIndex((x) => x.at === 'connect' && x.url === R.normalize(F.PEER_RELAY));
  assert(firstDns >= 0 && firstConnect > firstDns, `the DNS was asked for ${host}, before the connection; dns at ${firstDns}, connect at ${firstConnect}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
