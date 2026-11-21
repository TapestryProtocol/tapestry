'use strict';
/**
 * export nostr on a scratch stack — the real strfry import, the real read-back over ws://127.0.0.1:7777, and Neo4j. Run
 * by test/operations.test.js, and it SKIPS unless TAPESTRY_CONTAINER names a scratch container (tapestry-scratch…,
 * scripts/scratch-stack.sh): it writes that container's graph and publishes to its relay, so it never touches any other
 * container. With the variable unset, or naming anything else, it asks docker nothing.
 *   Story: engineering-team/stories/graph-operations-first-slice/34-export-nostr.md (AC1, AC5, AC6)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0034-export-nostr.md (Decisions 5, 6, 8 and 12;
 *          Implementation notes, the live check: the uniqueness rules and lifecycle migrate --migration tapestry-keys first)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/34-export-nostr.test-plan.md (its live check; LH1 and
 *          LH2 are by hand)
 *
 * Every call goes through docker exec <container> to the control panel on 127.0.0.1 inside the container
 * (test/helpers/scratchLoopback.js), as the direct-local caller. A concept is made fresh each run, with a random name, by
 * the graph operations, so a run never meets an earlier one's nodes.
 *
 *   LV1 a concept made with the graph operations is exported to the stack's own strfry through the real strfry import:
 *       each letter accepted, and read back over ws://127.0.0.1:7777 by a node process in the container, verifying
 *   LV2 the same call again: every letter unchanged, nothing signed
 *   LV3 graph update-node, then a dry run and an export: only that letter changed, and the relay keeps the newer version
 *   LV4 import nostr of those letters: own, each node as it was
 *   LV5 two exports of one concept fired together from one process in the container: each answers; every node ends with
 *       one letter; the next export answers unchanged or changed, never a failure
 *   LV6 timing: 500 letters in one call, the seconds it took printed for the story's record against nginx's 60 s. The
 *       call is direct to the control panel: through nginx it needs a signed-in session, which this suite doesn't hold,
 *       so the through-nginx run is the plan's LH1, by hand
 */

const { execFileSync } = require('child_process');
const crypto = require('crypto');
const S = require('../../helpers/graphOpsSuite');
const L = require('../../helpers/scratchLoopback');

const { assert } = S;
const show = (x) => String(S.show(x));
const { test, run } = S.makeSuite('operations: export nostr on a scratch stack (skips unless TAPESTRY_CONTAINER names tapestry-scratch…)');
const ROUTE = '/api/tapestry/export/nostr';

let READY = null;
/** '' when the scratch container answers; else why the live checks can't run, said once. */
function ready() {
  if (READY !== null) return READY;
  READY = L.scratchRefusal();
  if (READY) console.log(`  (export nostr's live checks skip: ${READY}. They run on a scratch stack: TAPESTRY_CONTAINER=tapestry-scratch-…, scripts/scratch-stack.sh)`);
  return READY;
}

const okData = (r, what) => { assert(r.status === 200 && r.json && r.json.success, `${what}: 200; got ${r.status} ${String(r.text).slice(0, 400)}`); return r.json.data; };
const op = (name, body, what) => okData(L.http('POST', `/api/tapestry/graph/${name}`, body, 120), what || `graph ${name}`);
const exportNostr = (body, maxSeconds = 120) => L.http('POST', ROUTE, body, maxSeconds);
const letters = (d) => (d && Array.isArray(d.letters) ? d.letters : []);
const keyOf = (l) => l.node || l.tapestryKey;
const ownStatus = (l) => ((l.relays || []).find((x) => x.relay === 'own' || x.relay === 'ws://127.0.0.1:7777') || {}).status;

/** Events by id, read over ws://127.0.0.1:7777 by a node process in the container, each with whether it verifies. */
function readBack(filter) {
  const c = L.assertScratch();
  const script = `
    const { Relay, verifyEvent } = require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools');
    (async () => {
      const relay = await Relay.connect('ws://127.0.0.1:7777');
      const got = [];
      await new Promise((resolve) => { const sub = relay.subscribe([${JSON.stringify(filter)}], { onevent: (e) => got.push({ ...e, verifies: verifyEvent(e) }), oneose: () => { sub.close(); resolve(); } }); });
      relay.close();
      process.stdout.write('READ ' + JSON.stringify(got));
    })().catch((e) => { process.stdout.write('READ-FAILED ' + e.message); });`;
  const out = execFileSync('docker', ['exec', c, 'node', '-e', script], { encoding: 'utf8', timeout: 120000 });
  assert(out.includes('READ '), `the read-back ran in the container; got ${out.slice(-300)}`);
  return JSON.parse(out.slice(out.indexOf('READ ') + 5));
}

let MADE = null;
/** A concept made fresh by the graph operations: a set, two elements, a tapestry: link. */
function made() {
  if (MADE) return MADE;
  const name = `live export ${crypto.randomBytes(3).toString('hex')}`;
  const concept = op('create-concept', { name, plural: `${name}s` }).concept;
  const set = op('create-set', { parent: concept.nodes.superset, name: 'Live Set' }).set.tapestryKey;
  const one = op('create-element', { concept: concept.conceptHeader, name: 'Live One', set, fields: { description: 'the first' } }).element.tapestryKey;
  const two = op('create-element', { concept: concept.conceptHeader, name: 'Live Two', fields: { description: `beside [the first](tapestry:${one})` } }).element.tapestryKey;
  MADE = { concept, set, one, two, cg: concept.nodes.conceptGraph };
  return MADE;
}
const snapshot = (keys) => L.cypher('MATCH (n:TapestryNode) WHERE n.tapestryKey IN $keys OPTIONAL MATCH (n)-[:HAS_TAG]->(t) RETURN n.tapestryKey AS key, n.id AS id, n.created_at AS at, n.sentTo AS sentTo, count(t) AS tags ORDER BY key', { keys });

test('LV1 [AC1, Decision 6]: on the stack, a concept made with the graph operations goes through the real strfry import, each letter accepted and read back, verifying', () => {
  if (ready()) return 'skip';
  const m = made();
  const d = okData(exportNostr({ graph: m.cg }), 'the export');
  const ls = letters(d);
  assert(ls.length >= 11 && ls.every((l) => l.outcome === 'new' && ownStatus(l) === 'accepted'), `every letter new and accepted by the own relay; got ${show(ls.map((l) => [l.outcome, ownStatus(l)]))}`);
  const got = readBack({ ids: ls.map((l) => l.id) });
  assert(got.length === ls.length && got.every((e) => e.verifies), `each is read back over ws://127.0.0.1:7777 and verifies; got ${got.length} of ${ls.length}`);
  const rows = snapshot(ls.map(keyOf));
  assert(rows.every((r) => typeof r.id === 'string' && r.at), `each node holds its letter now; got ${show(rows).slice(0, 400)}`);
});

test('LV2 [AC5]: the same call again: every letter unchanged, nothing signed', () => {
  if (ready()) return 'skip';
  const m = made();
  const d = okData(exportNostr({ graph: m.cg }), 'the same export again');
  assert(letters(d).every((l) => l.outcome === 'unchanged'), `every letter unchanged; got ${show(letters(d).map((l) => l.outcome))}`);
});

test('LV3 [AC5, Decision 5]: graph update-node, then a dry run and an export: only that letter changed, and the relay keeps the newer version', () => {
  if (ready()) return 'skip';
  const m = made();
  op('update-node', { node: m.one, fields: { description: 'the first, changed' } });
  const dry = okData(exportNostr({ graph: m.cg, dryRun: true }), 'the dry run');
  assert(letters(dry).filter((l) => l.outcome !== 'unchanged').map(keyOf).join() === m.one, `the dry run lists only that element changed; got ${show(letters(dry).filter((l) => l.outcome !== 'unchanged'))}`);
  const d = okData(exportNostr({ graph: m.cg }), 'the export');
  const changed = letters(d).find((l) => keyOf(l) === m.one);
  assert(changed && changed.outcome === 'changed' && letters(d).filter((l) => l !== changed).every((l) => l.outcome === 'unchanged'), 'only it is signed again');
  const [address] = L.cypher('MATCH (n:TapestryNode {tapestryKey: $k}) RETURN n.uuid AS uuid', { k: m.one });
  const [kind, pubkey, ...rest] = address.uuid.split(':');
  const versions = readBack({ kinds: [Number(kind)], authors: [pubkey], '#d': [rest.join(':')] });
  assert(versions.length === 1 && versions[0].id === changed.id, `the relay keeps the newer version only; got ${show(versions.map((e) => e.id))}`);
});

test('LV4 [AC6]: import nostr of those letters answers own, and each node is as it was', () => {
  if (ready()) return 'skip';
  const m = made();
  const keys = [m.concept.conceptHeader, m.set, m.one, m.two];
  const before = snapshot(keys);
  const addresses = L.cypher('MATCH (n:TapestryNode) WHERE n.tapestryKey IN $keys RETURN n.uuid AS uuid', { keys }).map((r) => r.uuid);
  const r = L.http('POST', '/api/tapestry/import/nostr', { addresses }, 120);
  const d = okData(r, 'the import');
  assert(d.events.every((e) => e.outcome === 'own') && d.changes === 0, `each letter comes back own; got ${show(d.events.map((e) => e.outcome))}`);
  assert(show(snapshot(keys)) === show(before), 'and each node is as it was');
});

test('LV5 [Decision 12]: two exports of one concept fired together: each answers, every node ends with one letter, and the next export never fails', () => {
  if (ready()) return 'skip';
  const name = `live race ${crypto.randomBytes(3).toString('hex')}`;
  const concept = op('create-concept', { name, plural: `${name}s` }).concept;
  const c = L.assertScratch();
  const script = `
    const http = require('http');
    const body = JSON.stringify({ graph: ${JSON.stringify(concept.nodes.conceptGraph)} });
    const one = () => new Promise((resolve) => {
      const req = http.request({ host: '127.0.0.1', port: ${Number(process.env.TAPESTRY_CONTAINER_PORT || 7778)}, path: '${ROUTE}', method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
        let t = ''; res.on('data', (d) => { t += d; }); res.on('end', () => resolve({ status: res.statusCode, body: t }));
      });
      req.end(body);
    });
    Promise.all([one(), one()]).then((rs) => process.stdout.write('RACE ' + JSON.stringify(rs)));`;
  const out = execFileSync('docker', ['exec', c, 'node', '-e', script], { encoding: 'utf8', timeout: 240000 });
  const rs = JSON.parse(out.slice(out.indexOf('RACE ') + 5));
  assert(rs.every((x) => x.status === 200), `both answered 200; got ${show(rs.map((x) => [x.status, x.body.slice(0, 200)]))}`);
  const rows = snapshot(Object.values(concept.nodes));
  assert(rows.every((r) => typeof r.id === 'string'), `every node ends with one letter; got ${show(rows)}`);
  const next = okData(exportNostr({ graph: concept.nodes.conceptGraph }), 'the next export');
  assert(letters(next).every((l) => ['unchanged', 'changed'].includes(l.outcome)), `the next export answers unchanged or changed; got ${show(letters(next).map((l) => l.outcome))}`);
});

test('LV6 [Decision 2 and 6]: timing: 500 letters in one call, its seconds printed for the record against nginx\'s 60 s', () => {
  if (ready()) return 'skip';
  const name = `live timing ${crypto.randomBytes(3).toString('hex')}`;
  const concept = op('create-concept', { name, plural: `${name}s` }).concept;
  for (let i = 0; i < 489; i++) op('create-element', { concept: concept.conceptHeader, name: `timed ${i}`, fields: { description: `element ${i}` } }, `element ${i}`);
  const r = exportNostr({ graph: concept.nodes.conceptGraph }, 300);
  const d = okData(r, 'the timed export');
  const sent = letters(d).filter((l) => ownStatus(l) === 'accepted').length;
  console.log(`    timing: ${sent} letters accepted in ${r.seconds}s (${(sent / r.seconds).toFixed(1)} letters/s); next ${show(d.next)}`);
  assert(sent > 0 && r.seconds < 60, `the call sends within nginx's 60 s; took ${r.seconds}s for ${sent}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
