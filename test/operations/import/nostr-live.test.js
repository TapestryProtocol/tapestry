'use strict';
/**
 * import nostr on a scratch stack's Neo4j — the cases only real Neo4j can show. Run by test/operations.test.js, and it
 * SKIPS unless TAPESTRY_CONTAINER names a scratch container (tapestry-scratch…, scripts/scratch-stack.sh): it publishes
 * to that container's relay and writes its graph, so it never touches any other container. With the variable unset, or
 * naming anything else, it asks docker nothing.
 *   Story: engineering-team/stories/graph-operations-first-slice/32-import-nostr.md (AC3: memo #130's pair and two
 *          imports at once; AC5's two-call filter; AC7's private relay)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0032-import-nostr.md (Implementation notes, the live
 *          check: "memo #130's pair and the e-plus-a referrer, published to the scratch stack's own relay with a
 *          throwaway key"; "a two-call filter"; "a timing run that measures the caps")
 *   Plan:  engineering-team/stories/graph-operations-first-slice/32-import-nostr.test-plan.md (its live check: the
 *          agent's run through the external CLI against a hosted instance's relay is run by hand, as it says)
 *
 * Every call goes through docker exec <container> to the control panel on 127.0.0.1 inside the container
 * (test/helpers/scratchLoopback.js), as the direct-local caller. The letters are signed here with throwaway keys and
 * published to the container's own relay, ws://127.0.0.1:7777, by a node process inside it.
 *
 *   LV1 memo #130 on Neo4j: a referrer by e, then its addressable target: one node at the address holding its id, the
 *       reference on it, no failed
 *   LV2 the referrer with the e and the matching a, then its target: one node, both references on it
 *   LV3 two imports of one new event at once, fired together from one process in the container: one node
 *   LV4 a filter in two calls, the second going on where the first stopped
 *   LV5 a relay on a private address is refused, for the direct-local caller too
 *   LV6 timing: 300 letters by filter, the events a second printed for the plan's evidence against Decision 12's caps
 */

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const S = require('../../helpers/graphOpsSuite');
const L = require('../../helpers/scratchLoopback');

const { assert, show } = S;
const { test, run } = S.makeSuite('operations: import nostr on a scratch stack (skips unless TAPESTRY_CONTAINER names tapestry-scratch…)');
const ROUTE = '/api/tapestry/import/nostr';

let READY = null;
/** '' when the scratch container answers; else why the live checks can't run, said once. */
function ready() {
  if (READY !== null) return READY;
  READY = L.scratchRefusal();
  if (READY) console.log(`  (import nostr's live checks skip: ${READY}. They run on a scratch stack: TAPESTRY_CONTAINER=tapestry-scratch-…, scripts/scratch-stack.sh)`);
  return READY;
}

function nt() { return require(require.resolve('nostr-tools', { paths: [S.ROOT] })); }
/** A throwaway key, new each run, so a run never meets an earlier one's letters. */
function freshKey() { const sk = crypto.randomBytes(32); return { sk: new Uint8Array(sk), pubkey: nt().getPublicKey(new Uint8Array(sk)) }; }
const sign = (key, t) => JSON.parse(JSON.stringify(nt().finalizeEvent({ kind: 1, created_at: Math.floor(Date.now() / 1000), tags: [], content: '', ...t }, key.sk)));
const addressOf = (e) => `${e.kind}:${e.pubkey}:${(e.tags.find((t) => t[0] === 'd') || [])[1] || ''}`;

/** Publish signed events to the container's own relay, from a node process inside it. */
function publish(events) {
  const c = L.assertScratch();
  const script = `
    const { Relay } = require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools');
    let input = ''; process.stdin.on('data', (d) => { input += d; });
    process.stdin.on('end', async () => {
      const relay = await Relay.connect('ws://127.0.0.1:7777');
      for (const e of JSON.parse(input)) await relay.publish(e);
      relay.close();
      process.stdout.write('PUBLISHED ' + JSON.parse(input).length);
    });`;
  const out = execFileSync('docker', ['exec', '-i', c, 'node', '-e', script], { input: JSON.stringify(events), encoding: 'utf8', timeout: 120000 });
  assert(out.includes(`PUBLISHED ${events.length}`), `the letters were published to the scratch relay; got ${out.slice(-200)}`);
}
function importNostr(body, maxSeconds = 120) {
  const r = L.http('POST', ROUTE, body, maxSeconds);
  return r;
}
const okData = (r, what) => { assert(r.status === 200 && r.json && r.json.success, `${what}: 200; got ${r.status} ${String(r.text).slice(0, 400)}`); return r.json.data; };

test('LV1 [AC3, memo #130]: on Neo4j, a referrer by e before its addressable target makes one node, the reference on it', () => {
  if (ready()) return 'skip';
  const al = freshKey(), bob = freshKey();
  const target = sign(al, { kind: 39999, tags: [['d', 'live-target'], ['name', 'Live Target']] });
  const referrer = sign(bob, { kind: 1, tags: [['e', target.id]], content: 'names it by id' });
  publish([target, referrer]);
  const a = okData(importNostr({ ids: [referrer.id] }), 'the referrer');
  const b = okData(importNostr({ addresses: [addressOf(target)] }), 'the target');
  assert(a.counts.failed === 0 && b.counts.failed === 0 && b.events[0].outcome === 'recorded', `no import failed; got ${show([a.counts, b.counts])}`);
  const rows = L.cypher('MATCH (n:NostrEvent) WHERE n.uuid = $u OR n.id = $id RETURN n.uuid AS uuid, n.id AS id, n.created_at AS at', { u: addressOf(target), id: target.id });
  assert(rows.length === 1 && rows[0].uuid === addressOf(target) && rows[0].id === target.id && rows[0].at, `one node at the address, holding the id; got ${show(rows)}`);
  const refs = L.cypher('MATCH (r:NostrEvent {id: $rid})-[:HAS_TAG]->(:NostrEventTag)-[:REFERENCES]->(t) RETURN t.uuid AS uuid', { rid: referrer.id });
  assert(refs.length === 1 && refs[0].uuid === addressOf(target), `the reference points at it; got ${show(refs)}`);
});

test('LV2 [AC3, memo #130]: on Neo4j, a referrer with the e and the matching a, before its target: one node, both references on it', () => {
  if (ready()) return 'skip';
  const al = freshKey(), bob = freshKey();
  const target = sign(al, { kind: 39999, tags: [['d', 'live-target-two']] });
  const referrer = sign(bob, { kind: 1, tags: [['e', target.id], ['a', addressOf(target)]] });
  publish([target, referrer]);
  okData(importNostr({ ids: [referrer.id] }), 'the referrer');
  const b = okData(importNostr({ addresses: [addressOf(target)] }), 'the target');
  assert(b.counts.failed === 0, `no import failed; got ${show(b)}`);
  const rows = L.cypher('MATCH (n:NostrEvent) WHERE n.uuid = $u OR n.id = $id RETURN count(n) AS c', { u: addressOf(target), id: target.id });
  assert(Number(rows[0].c) === 1, `one node; got ${show(rows)}`);
  const refs = L.cypher('MATCH (r:NostrEvent {id: $rid})-[:HAS_TAG]->(:NostrEventTag)-[:REFERENCES]->(t) RETURN t.uuid AS uuid', { rid: referrer.id });
  assert(refs.length === 2 && refs.every((x) => x.uuid === addressOf(target)), `both references on it; got ${show(refs)}`);
});

test('LV3 [AC3, Decision 13]: on Neo4j, two imports of one new event at once make one node', () => {
  if (ready()) return 'skip';
  const al = freshKey();
  const e = sign(al, { kind: 39999, tags: [['d', 'raced-live'], ['name', 'Raced']] });
  publish([e]);
  const c = L.assertScratch();
  const script = `
    const http = require('http');
    const body = JSON.stringify({ addresses: [${JSON.stringify(addressOf(e))}] });
    const one = () => new Promise((resolve) => {
      const req = http.request({ host: '127.0.0.1', port: ${Number(process.env.TAPESTRY_CONTAINER_PORT || 7778)}, path: '${ROUTE}', method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
        let t = ''; res.on('data', (d) => { t += d; }); res.on('end', () => resolve({ status: res.statusCode, body: t }));
      });
      req.end(body);
    });
    Promise.all([one(), one()]).then((rs) => process.stdout.write('RACE ' + JSON.stringify(rs)));`;
  const out = execFileSync('docker', ['exec', c, 'node', '-e', script], { encoding: 'utf8', timeout: 180000 });
  const rs = JSON.parse(out.slice(out.indexOf('RACE ') + 5));
  assert(rs.every((x) => x.status === 200), `both answered 200; got ${show(rs).slice(0, 400)}`);
  const outcomes = rs.map((x) => JSON.parse(x.body).data.events[0].outcome).sort();
  assert(outcomes.every((o) => ['recorded', 'unchanged'].includes(o)), `each recorded or unchanged, none failed; got ${show(outcomes)}`);
  const rows = L.cypher('MATCH (n:NostrEvent) WHERE n.uuid = $u OR n.id = $id RETURN count(n) AS c', { u: addressOf(e), id: e.id });
  assert(Number(rows[0].c) === 1, `one node; got ${show(rows)}`);
});

test('LV4 [AC5]: on the scratch relay, a filter in two calls, the second going on where the first stopped', () => {
  if (ready()) return 'skip';
  const carol = freshKey();
  const base = Math.floor(Date.now() / 1000) - 100;
  const notes = Array.from({ length: 6 }, (_, i) => sign(carol, { kind: 1, created_at: base + i, content: `live #${i}` }));
  publish(notes);
  const filter = { kinds: [1], authors: [carol.pubkey], limit: 4 };
  const one = okData(importNostr({ filter }), 'the first call');
  assert(one.next && Number.isInteger(one.next.until), `the first call stops at its cap and says where to go on; got ${show({ counts: one.counts, next: one.next })}`);
  const two = okData(importNostr({ filter: { ...filter, until: one.next.until } }), 'the second call');
  const ids = new Set([...one.events, ...two.events].filter((x) => x.outcome === 'recorded').map((x) => x.id));
  assert(notes.every((e) => ids.has(e.id)) && two.next === null, `the two calls record all six, the second going on where the first stopped; got ${show([one.counts, two.counts, two.next])}`);
});

test('LV5 [AC7]: a relay on a private address is refused, for the direct-local caller too', () => {
  if (ready()) return 'skip';
  const r = importNostr({ ids: ['a'.repeat(64)], relay: 'ws://10.0.0.1' });
  assert(r.status === 403 && r.json && r.json.code === 'private-relay', `private-relay; got ${r.status} ${String(r.text).slice(0, 300)}`);
});

test('LV6 [Decision 12]: timing: 300 letters by filter, the events a second printed for the plan', () => {
  if (ready()) return 'skip';
  const k = freshKey();
  const base = Math.floor(Date.now() / 1000) - 1000;
  const letters = Array.from({ length: 300 }, (_, i) => sign(k, { kind: 39999, created_at: base + i, tags: [['d', `timed-${i}`], ['name', `timed ${i}`], ['t', 'a'], ['t', 'b'], ['z', `39998:${k.pubkey}:timed`]] }));
  publish(letters);
  const r = importNostr({ filter: { kinds: [39999], authors: [k.pubkey] } }, 300);
  const d = okData(r, 'the timed import');
  console.log(`    timing: ${d.counts.recorded} recorded in ${r.seconds}s (${(d.counts.recorded / r.seconds).toFixed(1)} events/s, three tags each); next ${show(d.next)}`);
  assert(d.counts.recorded + d.counts.unchanged > 0, 'something was read');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
