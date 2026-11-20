'use strict';
/**
 * import nostr — by filter, paged through the relay. Run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/32-import-nostr.md (AC5; memo #129)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0032-import-nostr.md (Decisions 2, 3, 5, 11 and 12)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/32-import-nostr.test-plan.md
 *
 * Stack-free, over test/helpers/cypherGraphFake.js and test/helpers/relayFake.js. Each case has a relay of its own, so
 * the relay log tells its requests apart; pages, sweep and crowd answer at most five events a request (a relay's own
 * cap, as search.brainstorm.world's 5,000 and strfry's 500 are), the others 500. Decision 5 as amended at Test Design:
 * a sweep is full, and may have missed some, only once the call has seen the relay stop short, when a request answered
 * fewer than it asked and another found one it should have held. One harness run, as the admin.
 *
 *   IF1  thirteen events, five a request: all recorded, paged by until, one request at a time on one connection, each
 *        page asking for 500; source filter, next null
 *   IF2  a page that stops inside a second: that second is swept (since = until), and the events past the page in it
 *        are recorded, each once
 *   IF3  a second fuller than a request, on evidence that the relay stops short: split by kinds, then by authors, and
 *        read whole (the evidence a newer second, which leaves the sweep more to find); one that can't be split is listed
 *        under crowded, with the second and how many were read, the answer saying a narrower filter may read the rest
 *        (the evidence older events the next page finds, so the sweep is judged once that page is read)
 *   IF4  the filter's limit caps the call: it finishes the second it is in and answers next.until, the second before
 *        the last one finished; a call given that until goes on there; a repeat over the same window records nothing
 *   IF5  since: nothing before it is asked for, and the reading stops there
 *   IF6  the filter as JSON text; search passed to the relay as given, on every request; a tag filter passed through
 *   IF7  the newest version of each address in the window is recorded, the other older
 *   IF8  no false alarm on a relay that answers what it is asked: one event, and eight letters in one second of one kind
 *        and one author, each read whole, nothing crowded
 */

const S = require('../../helpers/graphOpsSuite');
const F = require('../../helpers/importFixtures');
const R = require('../../helpers/relayFake');

const { assert, show } = S;
const { test, run } = S.makeSuite('operations: import nostr — by filter, paged');
const { KEYS, imp, letter } = F;
const key = (name) => F.keyFrom(name);
const people = { carol: KEYS.carol, dave: key('dave'), erin: key('erin'), frank: key('frank'), gil1: key('gil one'), gil2: key('gil two'), gina: key('gina'), hank: key('hank'), ivy: key('ivy'), jo: key('jo'), kai: key('kai') };
const URL = (name) => `wss://${name}.example.com`;
const RELAYS = ['pages', 'sweep', 'crowd', 'capped', 'since', 'search', 'versions', 'single', 'burst'];
const DNS = { ...F.DNS, ...Object.fromEntries(RELAYS.map((n, i) => [`${n}.example.com`, { v4: [`1.0.0.${i + 2}`] }])) };
const note = (who, when, i = 0, kind = 1) => letter(who, { kind, at: when, tags: [['t', `n${i}`]], content: `${who.label} at ${when} #${i}` });
const at = (rid, relay, filter) => imp(rid, 'admin', { relay: URL(relay), filter });

// IF1: thirteen at thirteen seconds.
const pages = Array.from({ length: 13 }, (_, i) => note(people.carol, 1700300100 + i, i));
// IF2: three, then four in a second the first page stops inside, then two.
const sweep = [...[0, 1, 2].map((i) => note(people.dave, 1700300300, i)), ...[3, 4, 5, 6].map((i) => note(people.dave, 1700300200, i)), ...[7, 8].map((i) => note(people.dave, 1700300100, i))];
// IF3: eight in one second, four of each kind; eight in one second, one kind and one author; eight, two authors. The
// relay answers five a request, and each case shows it: erin's and gil's have two letters in a newer second, so the
// first page ends three letters into the crowded second and its sweep finds two more; frank's have two in an older
// second, which the next page finds.
const kindsNewer = [8, 9].map((i) => note(people.erin, 1700300510, i, 1));
const byKinds = [...[0, 1, 2, 3].map((i) => note(people.erin, 1700300500, i, 1)), ...[4, 5, 6, 7].map((i) => note(people.erin, 1700300500, i, 7))];
const unsplittable = Array.from({ length: 8 }, (_, i) => note(people.frank, 1700300600, i));
const crowdedOlder = [8, 9].map((i) => note(people.frank, 1700300590, i));
const authorsNewer = [8, 9].map((i) => note(people.gil1, 1700300710, i));
const byAuthors = [...[0, 1, 2, 3].map((i) => note(people.gil1, 1700300700, i)), ...[4, 5, 6, 7].map((i) => note(people.gil2, 1700300700, i))];
// IF4: eleven, two of them in one second.
const capped = [1009, 1008, 1007, 1006, 1006, 1005, 1004, 1003, 1002, 1001, 1000].map((s, i) => note(people.gina, 1700300000 + s, i));
// IF5: ten, since the sixth.
const since = Array.from({ length: 10 }, (_, i) => note(people.hank, 1700302000 + i, i));
// IF6: search and a tag.
const searched = Array.from({ length: 3 }, (_, i) => note(people.ivy, 1700303000 + i, i));
const zHeader = `39998:${KEYS.bob.pubkey}:topic`;
const tagged = [letter(people.ivy, { kind: 39999, at: 1700303100, tags: [['d', 'with-z'], ['z', zHeader]] }), letter(people.ivy, { kind: 39999, at: 1700303101, tags: [['d', 'without-z']] })];
// IF7: two versions of one address.
const v1 = letter(KEYS.alice, { kind: 39999, at: 1700304000, tags: [['d', 'filtered'], ['name', 'first']] });
const v2 = letter(KEYS.alice, { kind: 39999, at: 1700304001, tags: [['d', 'filtered'], ['name', 'second']] });
// IF8: a relay that answers what it is asked: one letter; and eight in one second, one kind and one author.
const single = note(people.jo, 1700305000, 0);
const burst = Array.from({ length: 8 }, (_, i) => note(people.kai, 1700305100, i));

const author = (who, extra = {}) => ({ kinds: [1], authors: [who.pubkey], ...extra });

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    F.needDecl();
    const relays = {
      [URL('pages')]: F.relay(pages, { cap: 5 }),
      [URL('sweep')]: F.relay(sweep, { cap: 5 }),
      [URL('crowd')]: F.relay([...kindsNewer, ...byKinds, ...unsplittable, ...crowdedOlder, ...authorsNewer, ...byAuthors], { cap: 5 }),
      [URL('capped')]: F.relay(capped),
      [URL('since')]: F.relay(since),
      [URL('search')]: F.relay([...searched, ...tagged]),
      [URL('versions')]: F.relay([v1, v2]),
      [URL('single')]: F.relay([single]),
      [URL('burst')]: F.relay(burst),
    };
    const r = F.runImport({
      state: F.emptyGraph(), relays, dns: DNS, label: 'import-nostr-filter',
      requests: [
        at('f-pages', 'pages', author(people.carol)),
        at('f-sweep', 'sweep', author(people.dave)),
        at('f-kinds', 'crowd', { kinds: [1, 7], authors: [people.erin.pubkey] }),
        at('f-crowded', 'crowd', author(people.frank)),
        at('f-authors', 'crowd', { kinds: [1], authors: [people.gil1.pubkey, people.gil2.pubkey] }),
        at('f-cap-1', 'capped', author(people.gina, { limit: 4 })),
        at('f-since', 'since', author(people.hank, { since: 1700302005 })),
        at('f-search', 'search', JSON.stringify({ kinds: [1], authors: [people.ivy.pubkey], search: 'include:spam rust' })),
        at('f-tag', 'search', { kinds: [39999], '#z': [zHeader] }),
        at('f-versions', 'versions', { kinds: [39999], authors: [KEYS.alice.pubkey], '#d': ['filtered'] }),
        at('f-single', 'single', author(people.jo)),
        at('f-burst', 'burst', author(people.kai)),
      ],
    });
    // IF4: the next call goes on where the last stopped, and a repeat over the same window.
    const first = F.data(r, 'f-cap-1');
    const until1 = first.next && first.next.until;
    const r2 = F.runImport({ file: r.file, relays, dns: DNS, requests: [at('f-cap-2', 'capped', author(people.gina, { limit: 4, until: until1 }))] });
    const second = F.data(r2, 'f-cap-2');
    const until2 = second.next && second.next.until;
    const r3 = F.runImport({ file: r.file, relays, dns: DNS, requests: [at('f-cap-3', 'capped', author(people.gina, { limit: 4, until: until2 })), at('f-cap-again', 'capped', author(people.gina, { limit: 4 }))] });
    return { r, r2, r3, after: r3.state(), log: r.log() };
  })();
  return MAIN;
}

const requestsTo = (log, name) => log.filter((x) => x.at === 'req' && x.url === R.normalize(URL(name)));
const recordedIds = (d) => (d.events || []).filter((e) => e.outcome === 'recorded').map((e) => e.id);
const isSweep = (f) => typeof f.since === 'number' && f.since === f.until;

test('IF1 [AC5, Decisions 2 and 5]: thirteen events five a request are all recorded, paged by until, one request at a time, pages of 500', async () => {
  const { r, after, log } = await main();
  const d = F.data(r, 'f-pages');
  assert(d.source === 'filter' && d.next === null && d.graphs === null, `source filter, next null, no graphs; got ${show({ source: d.source, next: d.next, graphs: d.graphs })}`);
  assert(show(recordedIds(d).sort()) === show(pages.map((e) => e.id).sort()) && d.counts.recorded === 13, `all thirteen recorded, each once; got ${show(d.counts)}`);
  for (const e of pages) assert(F.withId(after, e.id).length === 1, `${e.created_at}: one node`);
  const reqs = requestsTo(log, 'pages');
  const pageReqs = reqs.filter((q) => !isSweep(q.filters[0]));
  assert(pageReqs.length >= 3, `it paged past the relay's five: at least three pages; got ${pageReqs.length}`);
  assert(pageReqs.every((q) => q.filters.length === 1 && q.filters[0].limit === 500 && show(q.filters[0].kinds) === show([1]) && show(q.filters[0].authors) === show([people.carol.pubkey])), `each page asks for 500, with the filter's fields; got ${show(pageReqs.map((q) => q.filters))}`);
  const untils = pageReqs.slice(1).map((q) => q.filters[0].until);
  assert(untils.every((u, i) => Number.isInteger(u) && (i === 0 || u < untils[i - 1])), `each page after the first reads to an earlier until; got ${show(untils)}`);
  assert(!reqs.some((q) => q.overlap), 'one request at a time');
  assert(log.filter((x) => x.at === 'connect' && x.ok && x.url === R.normalize(URL('pages'))).length === 1, 'on one connection');
  assert(!d.crowded || d.crowded.length === 0, `nothing crowded; got ${show(d.crowded)}`);
});

test('IF2 [AC5, Decision 5, memo #129]: a page that stops inside a second is followed by a sweep of that second', async () => {
  const { r, log } = await main();
  const d = F.data(r, 'f-sweep');
  assert(show(recordedIds(d).sort()) === show(sweep.map((e) => e.id).sort()) && d.events.length === sweep.length, `all nine recorded, each once: none in the cut second skipped; got ${show(d.events.map((e) => [e.id.slice(0, 6), e.outcome]))}`);
  const sweeps = requestsTo(log, 'sweep').filter((q) => isSweep(q.filters[0]));
  assert(sweeps.some((q) => q.filters[0].since === 1700300200), `the second the first page stopped inside was swept, since = until = 1700300200; got ${show(sweeps.map((q) => q.filters[0]))}`);
});

test('IF3 [AC5, Decision 5 as amended]: a crowded second, once the relay is seen to stop short, is split by kinds, then by authors; one that can\'t be is listed under crowded', async () => {
  const { r, log } = await main();
  const crowd = requestsTo(log, 'crowd').flatMap((q) => q.filters);
  const sweepAt = (second, pred) => crowd.some((f) => isSweep(f) && f.since === second && pred(f));
  const k = F.data(r, 'f-kinds');
  assert(show(recordedIds(k).sort()) === show([...kindsNewer, ...byKinds].map((e) => e.id).sort()) && (!k.crowded || k.crowded.length === 0),
    `two kinds: the page stopped three into the crowded second and its sweep found two more, so the relay stops short at five; the full sweep, split by kinds, read the second whole; got ${show(k.counts)} crowded ${show(k.crowded)}`);
  assert(sweepAt(1700300500, (f) => show(f.kinds) === show([7]) && show(f.authors) === show([people.erin.pubkey])), `the second was swept by one kind at a time; got ${show(crowd.filter((f) => isSweep(f) && f.since === 1700300500))}`);
  const a = F.data(r, 'f-authors');
  assert(show(recordedIds(a).sort()) === show([...authorsNewer, ...byAuthors].map((e) => e.id).sort()) && (!a.crowded || a.crowded.length === 0),
    `two authors, one kind: the same evidence; split by authors and read whole; got ${show(a.counts)} crowded ${show(a.crowded)}`);
  assert(sweepAt(1700300700, (f) => show(f.authors) === show([people.gil2.pubkey])), `the second was swept by one author at a time; got ${show(crowd.filter((f) => isSweep(f) && f.since === 1700300700))}`);
  const c = F.data(r, 'f-crowded');
  const entry = (c.crowded || []).find((x) => Object.values(x).includes(1700300600));
  assert(entry && Object.values(entry).includes(5), `one kind, one author, eight in a second, and the next page found older letters, so the relay stops short at five and the sweep of five was full: listed under crowded, with the second and the five read; got ${show(c.crowded)}`);
  const ids = recordedIds(c);
  assert(ids.length === 7 && crowdedOlder.every((e) => ids.includes(e.id)) && ids.filter((id) => unsplittable.some((e) => e.id === id)).length === 5, `the five read in that second and the two older recorded; got ${show(c.counts)}`);
  assert(/narrow/i.test(JSON.stringify({ ...c, events: undefined })), `the answer says a narrower filter may read the rest; got ${show({ ...c, events: undefined })}`);
});

test('IF4 [AC5, Decision 5]: the filter\'s limit caps the call; it finishes its second, answers next.until, and the next call goes on', async () => {
  const { r, r2, r3, after } = await main();
  const one = F.data(r, 'f-cap-1');
  const want1 = capped.filter((e) => e.created_at >= 1700301006).map((e) => e.id).sort();
  assert(show(recordedIds(one).sort()) === show(want1), `the four newest, and the fifth in the fourth's second: it finishes the second it is in; got ${show(recordedIds(one).length)}`);
  assert(one.next && one.next.until === 1700301005, `next.until is the second before the last one finished; got ${show(one.next)}`);
  const two = F.data(r2, 'f-cap-2');
  assert(show(recordedIds(two).sort()) === show(capped.filter((e) => e.created_at <= 1700301005 && e.created_at >= 1700301002).map((e) => e.id).sort()), `the next call goes on there; got ${show(two.events.map((e) => e.outcome))}`);
  assert(two.next && two.next.until === 1700301001, `and stops four further on; got ${show(two.next)}`);
  const three = F.data(r3, 'f-cap-3');
  assert(show(recordedIds(three).sort()) === show(capped.filter((e) => e.created_at <= 1700301001).map((e) => e.id).sort()) && three.next === null, `the last call reads the rest and answers next null; got ${show(three.next)}`);
  for (const e of capped) assert(F.withId(after, e.id).length === 1, `${e.created_at}: recorded once over the three calls`);
  const again = F.data(r3, 'f-cap-again');
  assert(again.events.every((e) => e.outcome === 'unchanged') && again.changes === 0, `a repeat over the first window records nothing new; got ${show(again.events.map((e) => e.outcome))}`);
});

test('IF5 [AC5, Decision 5]: since: nothing before it is asked for, and the reading stops there', async () => {
  const { r, log } = await main();
  const d = F.data(r, 'f-since');
  assert(show(recordedIds(d).sort()) === show(since.filter((e) => e.created_at >= 1700302005).map((e) => e.id).sort()), `the five at or after since; got ${recordedIds(d).length}`);
  const reqs = requestsTo(log, 'since');
  assert(reqs.every((q) => q.filters.every((f) => f.since === undefined || f.since >= 1700302005) && q.filters.every((f) => f.until === undefined || f.until >= 1700302005)), `no request reads before since; got ${show(reqs.map((q) => q.filters))}`);
});

test('IF6 [AC5, Decision 1]: the filter as JSON text; search passed as given on every request; a tag filter passed through', async () => {
  const { r, log } = await main();
  const s = F.data(r, 'f-search');
  assert(recordedIds(s).length === searched.length, `the filter given as JSON text reads as the object would; got ${show(s.counts)}`);
  const searchReqs = requestsTo(log, 'search').filter((q) => q.filters.some((f) => f.authors && f.authors.includes(people.ivy.pubkey) && show(f.kinds) === show([1])));
  assert(searchReqs.length >= 1 && searchReqs.every((q) => q.filters.every((f) => f.search === 'include:spam rust')), `every request carries search, as given; got ${show(searchReqs.map((q) => q.filters))}`);
  const t = F.data(r, 'f-tag');
  assert(show(recordedIds(t)) === show([tagged[0].id]), `#z reads the letter that names the header, and not the other; got ${show(t.events)}`);
  assert(requestsTo(log, 'search').some((q) => q.filters.some((f) => show(f['#z']) === show([zHeader]))), 'the tag filter reached the relay');
});

test('IF7 [AC5, Decision 3]: the newest version of each address in the window is recorded, the other older', async () => {
  const { r, after } = await main();
  const d = F.data(r, 'f-versions');
  const outs = Object.fromEntries((d.events || []).map((e) => [e.id, e.outcome]));
  assert(outs[v2.id] === 'recorded' && (outs[v1.id] === 'older' || outs[v1.id] === undefined), `the newer recorded, the older older; got ${show(outs)}`);
  assert(F.nodesAt(after, F.addressOf(v2)).length === 1 && F.nodesAt(after, F.addressOf(v2))[0].props.id === v2.id, 'one node, holding the newer');
});

test('IF8 [AC5, Decision 5 as amended]: no false alarm: on a relay that answers what it is asked, one event, or eight letters in one second, are read whole and nothing is crowded', async () => {
  const { r } = await main();
  const one = F.data(r, 'f-single');
  assert(show(recordedIds(one)) === show([single.id]) && (!one.crowded || one.crowded.length === 0), `a filter matching one event: recorded, nothing crowded (its sweep is as large as its page, but no request answered fewer than it asked while more were held); got ${show({ ...one, events: one.events && one.events.map((e) => e.outcome) })}`);
  const b = F.data(r, 'f-burst');
  assert(show(recordedIds(b).sort()) === show(burst.map((e) => e.id).sort()) && (!b.crowded || b.crowded.length === 0), `eight letters in one second, one kind and one author, as firmware's are published: all recorded, nothing crowded; got ${show({ counts: b.counts, crowded: b.crowded })}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
