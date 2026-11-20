'use strict';
/**
 * lifecycle seed-firmware on scratch stacks' Neo4j — ADR graph-operations-first-slice/0037 Decision 13's live check.
 * Run by test/operations.test.js, and it SKIPS unless TAPESTRY_CONTAINER names a scratch container (tapestry-scratch…,
 * scripts/scratch-stack.sh): it installs into that container's graph and changes a file of its firmware, so it never
 * touches any other container. With the variable unset, or naming anything else, it asks docker nothing.
 *   Story: engineering-team/stories/graph-operations-first-slice/37-seed-firmware.md (AC1, AC3, AC4, the live check)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0037-seed-firmware.md (Decision 13)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/37-seed-firmware.test-plan.md
 *
 * Preconditions (story fact 12): each container has Neo4j's uniqueness rules, from the Dashboard's fix and
 * `tapestry lifecycle migrate --migration tapestry-keys`, applied before the suite runs.
 *   TAPESTRY_CONTAINER             an instance today's install installed (POST /api/firmware/install; L1 runs it first
 *                                  when the instance has no firmware). L1, L3 and L4 run here, in that order.
 *   TAPESTRY_SEED_EMPTY_CONTAINER  a second scratch container whose graph holds no firmware. L2 runs there, and skips
 *                                  without it.
 * Every call goes through docker exec <container> to the control panel on 127.0.0.1 inside the container
 * (test/helpers/scratchLoopback.js), as the direct-local caller.
 *
 *   L1 first contact: on an instance today's install installed, every firmware node answers unchanged but the five
 *      schemas pass 3b filled and the three concept graphs pass 1c flattened, which answer kept with noRecord (ADR 0037
 *      Amendment 1, item 2); nothing is added or removed; a relationship kept with noRecord, or a link between firmware
 *      nodes that the target lacks (the instance's own, others), is allowed only when it is the prune's kind, a
 *      HAS_ELEMENT or IS_A_SUPERSET_OF from a superset, since the target prunes in one fixed order, by address, where
 *      today's install prunes in Neo4j's (Amendment 1, item 5); L1 prints each such link
 *   L2 an empty instance: seed-firmware installs all 459 nodes, unsigned (no node at a firmware address has an id), and
 *      a second run changes nothing and records no entry
 *   L3 an update: after nostr-relay's header's b is re-pointed by a raw query, and dcosl-brainstorm-world.json is changed
 *      in the container's firmware (then the control panel restarted), the header answers kept, naming its b, and the
 *      changed file's node changed, holding the file's JSON
 *   L4 taking: take brings the kept header in line: changed, its b the firmware's pointer again
 * After L4 the container's firmware file is put back and the control panel restarted.
 */

const path = require('path');
const { execFileSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const L = require('../../helpers/scratchLoopback');

const { assert, show } = S;
const { test, run } = S.makeSuite('operations: lifecycle seed-firmware on scratch stacks (skips unless TAPESTRY_CONTAINER names tapestry-scratch…)');
const ROUTE = '/api/tapestry/lifecycle/seed-firmware';
const FIVE = ['word', 'graph', 'property', 'relationship', 'dog'];
/** The concept graphs pass 1c flattens, which the target keeps as create-concept made them (ADR 0037 Amendment 1, item 2). */
const DEPARTED = ['node-type', 'graph-type', 'validation-tool-type'];
const dtag = require(path.join(S.ROOT, 'src/lib/dtag.js'));
const IN_CONTAINER = '/usr/local/lib/node_modules/brainstorm/firmware/active';
const DCOSL = 'concepts/nostr-relay/elements/dcosl-brainstorm-world.json';

let READY = null;
function ready() {
  if (READY !== null) return READY;
  READY = L.scratchRefusal();
  if (READY) console.log(`  (seed-firmware's live checks skip: ${READY}. They run on scratch stacks: TAPESTRY_CONTAINER=tapestry-scratch-…, scripts/scratch-stack.sh)`);
  return READY;
}
const okData = (r, what) => { assert(r.status === 200 && r.json && r.json.success, `${what}: 200; got ${r.status} ${String(r.text).slice(0, 400)}`); return r.json.data; };
const seed = (body = {}, what = 'seed-firmware') => okData(L.http('POST', ROUTE, body, 900), what);
const count = (d, k) => { const c = d.counts || {}; const v = c[k] !== undefined ? c[k] : c[k.replace(/-([a-z])/g, (_, x) => x.toUpperCase())]; return typeof v === 'number' ? v : 0; };
const byAddress = (d) => new Map((d.nodes || []).map((e) => [e.address, e]));
/** Run fn with TAPESTRY_CONTAINER naming another scratch container, then put it back. */
function inContainer(name, fn) {
  const saved = process.env.TAPESTRY_CONTAINER;
  process.env.TAPESTRY_CONTAINER = name;
  try { return fn(); } finally { if (saved === undefined) delete process.env.TAPESTRY_CONTAINER; else process.env.TAPESTRY_CONTAINER = saved; }
}
function restartControlPanel() {
  L.sh('supervisorctl restart brainstorm >/dev/null 2>&1 || true', 120);
  const until = Date.now() + 180000;
  while (Date.now() < until) {
    try { const r = L.http('GET', '/api/tapestry-key/derive-status', undefined, 20); if (r.status === 200) return; } catch { /* not up yet */ }
    execFileSync('sleep', ['3']);
  }
  throw new Error('the control panel did not answer within 180 s of its restart');
}
function writeInContainer(rel, text) {
  const c = L.assertScratch();
  execFileSync('docker', ['exec', '-i', c, 'sh', '-c', `cat > '${IN_CONTAINER}/${rel}'`], { input: text, timeout: 60000 });
}

let L1 = null;
function firstContact() {
  if (L1) return L1;
  const ta = L.taPubkey();
  const status = L.http('GET', '/api/firmware/install-status', undefined, 60);
  if (!(status.json && status.json.installed === true)) okData(L.http('POST', '/api/firmware/install', {}, 900), "today's install (L1's precondition)");
  L1 = { ta, d: seed({}, 'first contact') };
  return L1;
}

test('L1 [AC1, AC4, Decision 13, Amendment 1]: first contact: every firmware node unchanged but the five schemas and the three flattened concept graphs (kept, noRecord); nothing added or removed; only the prune\'s direct links from a superset kept or the instance\'s own, each listed', () => {
  if (ready()) return 'skip';
  const { ta, d } = firstContact();
  const kept = (d.nodes || []).filter((e) => e.outcome === 'kept');
  const want = [...FIVE.map((x) => `39999:${ta}:${x}-schema`), ...DEPARTED.map((x) => `39999:${ta}:${x}-concept-graph`)];
  assert(kept.length === 8 && kept.every((e) => want.includes(e.address) && e.noRecord === true), `only the five schemas and the three concept graphs are kept, each with noRecord; got ${show(kept.map((e) => [e.address, e.parts]))}`);
  assert(count(d, 'unchanged') === 451 && !count(d, 'added') && !count(d, 'changed'), `451 unchanged; got ${show(d.counts)}`);
  const r = d.relationships || {};
  assert((r.added || []).length === 0 && (r.removed || []).length === 0, `first contact adds and removes no relationship; got added ${show((r.added || []).slice(0, 10))}, removed ${show((r.removed || []).slice(0, 10))}`);

  // The kept ones, their ends by address.
  const endOf = (v) => (v && typeof v === 'object' ? (v.address || v.uuid || v.slug || v.tapestryKey) : v);
  const keptRels = (r.kept || []).map((x) => ({ type: x.type || x.relationshipType, from: endOf(x.from || x.nodeFrom), to: endOf(x.to || x.nodeTo), noRecord: x.noRecord }));
  const keys = [...new Set(keptRels.flatMap((x) => [x.from, x.to]).filter((v) => typeof v === 'string' && !/^\d+:/.test(v)))];
  const byKey = new Map(keys.length ? L.cypher('MATCH (n:TapestryNode) WHERE n.tapestryKey IN $keys RETURN n.tapestryKey AS k, n.uuid AS u', { keys }).map((x) => [x.k, x.u]) : []);
  for (const x of keptRels) { x.from = byKey.get(x.from) || x.from; x.to = byKey.get(x.to) || x.to; }

  // The instance's own links between firmware nodes: in the graph, and in neither of the installed-firmware graph's lists.
  const installed = `39999:${ta}:${dtag.childDTag('installed firmware', `39998:${ta}:graph`)}`;
  const g = L.cypher("MATCH (g:TapestryNode {uuid: $u}) OPTIONAL MATCH (g)-[:HAS_TAG]->(t:NostrEventTag {type: 'json'}) RETURN g.tapestryKey AS k, t.value AS v", { u: installed })[0];
  assert(g, `the installed-firmware graph is at ${installed}`);
  let json = null;
  if (g.v && !String(g.v).startsWith('lmdb:')) json = JSON.parse(g.v);
  else { const c = L.http('GET', `/api/tapestry-key/${g.k}`, undefined, 60); json = c.json && c.json.data && c.json.data.data; }
  assert(json && json.graph && Array.isArray(json.graph.nodes) && Array.isArray(json.graph.relationships), 'its graph lists nodes and relationships');
  const listed = new Set(json.graph.relationships.map((x) => `${x.nodeFrom.slug}|${x.relationshipType.slug}|${x.nodeTo.slug}`));
  const firmware = json.graph.nodes.map((x) => x.slug).filter((a) => String(a).split(':')[1] === ta);
  const inGraph = L.cypher("MATCH (a:TapestryNode)-[r]->(b:TapestryNode) WHERE a.uuid IN $n AND b.uuid IN $n AND type(r) <> 'HAS_TAG' RETURN a.uuid AS from, type(r) AS type, b.uuid AS to", { n: firmware });
  const others = inGraph.filter((x) => !listed.has(`${x.from}|${x.type}|${x.to}`));

  const froms = [...new Set([...keptRels, ...others].map((x) => x.from))];
  const supersets = new Set(froms.length ? L.cypher('MATCH (s:Superset) WHERE s.uuid IN $u RETURN s.uuid AS u', { u: froms }).map((x) => x.u) : []);
  const pruneKind = (x) => ['HAS_ELEMENT', 'IS_A_SUPERSET_OF'].includes(x.type) && supersets.has(x.from);
  console.log(`    L1: ${keptRels.length} relationships kept with noRecord, ${others.length} links between firmware nodes the instance's own (the answer counts others ${show(r.others)}):`);
  for (const x of keptRels) console.log(`      kept    ${x.from} ${x.type} ${x.to}${pruneKind(x) ? '' : '   ← not the prune\'s kind'}`);
  for (const x of others) console.log(`      others  ${x.from} ${x.type} ${x.to}${pruneKind(x) ? '' : '   ← not the prune\'s kind'}`);
  const badKept = keptRels.filter((x) => !(pruneKind(x) && x.noRecord === true));
  const badOthers = others.filter((x) => !pruneKind(x));
  assert(badKept.length === 0 && badOthers.length === 0, `only a HAS_ELEMENT or IS_A_SUPERSET_OF from a superset may differ from today's install (the prune's order): ${badKept.length} kept and ${badOthers.length} others aren't, the first ${show([...badKept, ...badOthers].slice(0, 5))}`);
});

test('L2 [AC1, AC3, Decision 13]: an empty instance: it installs all 459 nodes, unsigned, and a second run changes nothing', () => {
  if (ready()) return 'skip';
  const empty = process.env.TAPESTRY_SEED_EMPTY_CONTAINER || '';
  if (!L.SCRATCH_NAME.test(empty)) { console.log('  (L2 skips: TAPESTRY_SEED_EMPTY_CONTAINER names no second scratch container with an empty graph)'); return 'skip'; }
  inContainer(empty, () => {
    const ta = L.taPubkey();
    const before = L.cypher('MATCH (h:ConceptHeader) WHERE h.uuid STARTS WITH $p RETURN count(h) AS c', { p: `39998:${ta}:` })[0].c;
    assert(Number(before) === 0, `the second container's graph holds no firmware; it holds ${before} headers`);
    const d = seed({}, 'the install');
    assert(count(d, 'added') === 459, `459 added; got ${show(d.counts)}`);
    const lettered = L.cypher('MATCH (n:TapestryNode) WHERE n.uuid STARTS WITH $p AND n.id IS NOT NULL RETURN count(n) AS c', { p: `39999:${ta}:` })[0].c;
    assert(Number(lettered) === 0, `no node it made has a letter's id; got ${lettered}`);
    const again = seed({}, 'the repeat');
    assert(count(again, 'unchanged') === 459 && again.change === null, `the repeat changes nothing; got ${show({ counts: again.counts, change: again.change })}`);
  });
});

let L3 = null;
function updated() {
  if (L3) return L3;
  const { ta } = firstContact();
  const header = `39998:${ta}:nostr-relay`;
  L.cypher("MATCH (h:TapestryNode {uuid: $u})-[:HAS_TAG]->(t:NostrEventTag {type: 'b'}) SET t.value = $v", { u: header, v: `39998:${'ee'.repeat(32)}:nostr-relay` });
  const original = L.sh(`cat '${IN_CONTAINER}/${DCOSL}'`);
  const changed = JSON.parse(original);
  changed.nostrRelay = { ...changed.nostrRelay, note: 'a newer firmware (seed-firmware live check)' };
  writeInContainer(DCOSL, `${JSON.stringify(changed, null, 2)}\n`);
  restartControlPanel();
  L3 = { ta, header, original, changed, d: seed({}, 'the update') };
  return L3;
}

test('L3 [AC4, Decision 13]: an update: a re-pointed b is kept, named; a changed file\'s node is changed, holding the file\'s JSON', () => {
  if (ready()) return 'skip';
  const { header, changed, d } = updated();
  const by = byAddress(d);
  const h = by.get(header);
  assert(h && h.outcome === 'kept' && /\bb\b/.test(show(h.parts)), `nostr-relay's header is kept, naming its b; got ${show(h)}`);
  const n = (d.nodes || []).find((e) => e.outcome === 'changed' && /dcosl-brainstorm-world/.test(String(e.file)));
  assert(n, `dcosl-brainstorm-world's node is changed; got ${show((d.nodes || []).filter((e) => e.outcome !== 'kept').slice(0, 5))}`);
  const rows = L.cypher("MATCH (n:TapestryNode {tapestryKey: $k})-[:HAS_TAG]->(t:NostrEventTag {type: 'json'}) RETURN t.value AS v", { k: n.tapestryKey });
  assert(rows.length === 1 && JSON.parse(rows[0].v).nostrRelay.note === changed.nostrRelay.note, `it holds the file's JSON; got ${show(rows).slice(0, 300)}`);
});

test('L4 [AC4, Decision 13]: take brings the kept header in line: changed, its b the firmware\'s pointer again', () => {
  if (ready()) return 'skip';
  const { header, original } = updated();
  try {
    const d = seed({ take: [header] }, 'the take');
    const h = byAddress(d).get(header);
    assert(h && h.outcome === 'changed', `the header is changed; got ${show(h)}`);
    const b = L.cypher("MATCH (h:TapestryNode {uuid: $u})-[:HAS_TAG]->(t:NostrEventTag {type: 'b'}) RETURN t.value AS v, t.value1 AS kind", { u: header });
    assert(b.length >= 1 && b.every((x) => x.kind === 'pointer' && !x.v.includes('ee'.repeat(32))), `its b is the firmware's pointer again; got ${show(b)}`);
  } finally {
    writeInContainer(DCOSL, original);
    restartControlPanel();
  }
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
