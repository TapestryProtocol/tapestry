'use strict';
/**
 * community-reference #39: the prune builder (ADR community-reference/0035 Decision 1).
 *   Story: engineering-team/stories/community-reference/39-firmware-install-leaves-tags-once.md
 *   ADR:   engineering-team/decisions/community-reference/0035-community-references-import-then-prune.md
 *   Plan:  engineering-team/stories/community-reference/39-firmware-install-leaves-tags-once.test-plan.md
 *
 * buildPruneCypher(event, { derivedEdges }) in src/api/neo4j/eventSync.js returns the statements that make the event's
 * node hold only what buildImportCypher(event) makes. These tests run the real buildImportCypher's statements and then
 * the prune's on the Cypher engine (test/helpers/cypherEngine.js), each statement committed as Neo4j commits one
 * (test/helpers/communityStep.js's run, which refuses a statement that leaves a relationship without its node), and read
 * the graph they leave. Whatever Cypher the Implementer writes within the engine's subset, the graph is what's checked.
 * Install's use of the builder has its own suite, test/firmware-install-leaves-tags-once.test.js.
 *
 *   P1  AC-1  after Pass 1's tags and the seeded letter's, the prune leaves the seeded letter's tags, each once
 *   P2  AC-1  importing and pruning the same letter again changes nothing, down to the tag nodes themselves
 *   P3        a tag node another node also holds (two ids that end alike) loses only this node's link to it
 *   P4  AC-2  a copy holding three versions' tags keeps only the newest's, and the old tag nodes are gone
 *   P5  AC-2  with derivedEdges, b-derived relationships the newest version doesn't make go: a REFERENCES to itself and
 *             an INHERITS_FROM
 *   P6  AC-2  with derivedEdges, the relationships the newest version's b tags derive stay, one each
 *   P7        without derivedEdges, b-derived relationships stay (ADR 0035 Decision 4: an own header's are not pruned)
 *   P8        the prune touches only tag nodes and b-derived relationships: the node's labels, properties and every
 *             other relationship stay, and a node an old tag pointed at stays
 *   P9        a d-tag and a b target holding a quote and a backslash
 */

const C = require('./helpers/communityStep');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

const ES = C.eventSync();
/** buildPruneCypher(event[, opts]), run whole on the graph. */
function prune(g, ev, opts) {
  assert(typeof ES.buildPruneCypher === 'function', 'src/api/neo4j/eventSync.js exports no buildPruneCypher yet (ADR community-reference/0035 Decision 1: a new export beside buildImportCypher)');
  const out = opts === undefined ? ES.buildPruneCypher(ev) : ES.buildPruneCypher(ev, opts);
  assert(Array.isArray(out) && out.every((q) => typeof q === 'string'), `buildPruneCypher must return the statements executeCypher runs, an array of strings; it returned ${JSON.stringify(out).slice(0, 200)}`);
  for (const q of out) C.run(g, q, {});
}

const TA = C.sha256("an instance's assistant");
const CURATOR = C.sha256('a curator');
const at = (pubkey, kind, slug) => `${kind}:${pubkey}:${slug}`;

function nodeAt(g, address) {
  const ns = C.nodesAt(g, address);
  assert(ns.length === 1, `${ns.length} nodes hold ${C.short(address)}`);
  return ns[0];
}
const tagUuids = (g, address) => C.tagsOf(g, nodeAt(g, address)).map((t) => t.props.uuid).sort();
/** Why the node at the letter's address doesn't hold exactly the tag nodes buildImportCypher makes for it, or null. */
function trouble(g, ev) {
  const address = C.addressOf(ev);
  const got = tagUuids(g, address);
  const want = C.importMakes(ev, 'today');
  if (sameList(got, want)) return null;
  const extra = got.filter((u) => !want.includes(u));
  const missing = want.filter((u) => !got.includes(u));
  return `${C.short(address)} holds ${got.length} tag nodes; the letter ${ev.id.slice(0, 8)}…'s import makes ${want.length}${extra.length ? `; ${extra.length} more, such as ${extra.slice(0, 3).join(', ')}` : ''}${missing.length ? `; ${missing.length} of the letter's missing, such as ${missing.slice(0, 3).join(', ')}` : ''}`;
}
const bRefs = (g, address) => C.relsOut(g, nodeAt(g, address), 'REFERENCES').filter((r) => r.props && r.props.source === 'b-tag').map((r) => r.toNode && r.toNode.props.uuid).sort();
const inherits = (g, address) => C.relsOut(g, nodeAt(g, address), 'INHERITS_FROM').map((r) => r.toNode && r.toNode.props.uuid).sort();
const noOrphans = (g) => { const o = C.orphanTags(g); return o.length ? `${o.length} tag nodes are held by no node, such as ${o.slice(0, 3).map((t) => t.props.uuid).join(', ')}` : null; };
const snapshot = (g) => JSON.stringify({ nodes: g.nodes, rels: g.rels });

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('P1 (AC-1): after Pass 1\'s tags and the seeded letter\'s, the prune leaves the seeded letter\'s tags, each once', () => {
  const tags = C.headerTags(TA, 'tag');
  const first = C.letter(TA, { kind: 39998, at: 1000, tags });
  const seeded = C.letter(TA, { kind: 39998, at: 1001, tags: [...tags, ['b', at(CURATOR, 39998, 'tag'), 'pointer']] });
  const g = C.emptyGraph();
  C.pass1Import(g, first);
  C.todaysImport(g, seeded);
  const before = tagUuids(g, C.addressOf(seeded)).length;
  assert(before === tags.length * 2 + 1, `fixture check: the header holds Pass 1's ${tags.length} tags and the seeded letter's ${tags.length + 1}, ${tags.length * 2 + 1} in all; it holds ${before}`);
  prune(g, seeded);
  const bad = [trouble(g, seeded), noOrphans(g)].filter(Boolean);
  assert(!bad.length, `after the prune: ${bad.join('; ')}`);
  const contents = C.tagsOf(g, nodeAt(g, C.addressOf(seeded))).map((t) => JSON.stringify(C.contentOf(t))).sort();
  assert(sameList(contents, seeded.tags.map((t) => JSON.stringify(t)).sort()), `the header's tags should be the seeded letter's, each once: ${contents.join(' ')}`);
  assert(sameList(bRefs(g, C.addressOf(seeded)), [at(CURATOR, 39998, 'tag')]), `the seeded b's REFERENCES {source:'b-tag'} stays, once; got ${bRefs(g, C.addressOf(seeded)).map(C.short).join(', ')}`);
});

test('P2 (AC-1): importing and pruning the same letter again changes nothing, down to the tag nodes themselves', () => {
  const tags = C.headerTags(TA, 'tag');
  const seeded = C.letter(TA, { kind: 39998, at: 1001, tags: [...tags, ['b', at(CURATOR, 39998, 'tag'), 'pointer']] });
  const g = C.emptyGraph();
  C.pass1Import(g, C.letter(TA, { kind: 39998, at: 1000, tags }));
  C.todaysImport(g, seeded);
  prune(g, seeded);
  const once = snapshot(g);
  C.todaysImport(g, seeded);
  prune(g, seeded);
  assert(snapshot(g) === once, 'a second import and prune of the letter the node holds changed the graph: no tag node may be made again or lose its key (ADR 0035 Consequences: "re-importing a letter the node already holds makes no new tag nodes")');
});

test('P3: a tag node another node also holds (two ids that end alike) loses only this node\'s link to it', () => {
  // buildImportCypher names a tag node from the last 8 hex of its letter's id (the ledger row's 32-bit tag key), so two
  // letters whose ids end alike share their tag nodes. Pruning one node must leave the other's.
  const a1 = C.letter(TA, { kind: 39999, at: 1000, tags: [['d', 'a'], ['name', 'A']], id: `${'1'.repeat(56)}deadbeef` });
  const b1 = C.letter(CURATOR, { kind: 39999, at: 1000, tags: [['d', 'b'], ['name', 'B']], id: `${'2'.repeat(56)}deadbeef` });
  const a2 = C.letter(TA, { kind: 39999, at: 1001, tags: [['d', 'a'], ['name', 'A, again']] });
  const g = C.emptyGraph();
  C.todaysImport(g, a1);
  C.todaysImport(g, b1);
  const shared = tagUuids(g, C.addressOf(b1));
  assert(shared.every((u) => tagUuids(g, C.addressOf(a1)).includes(u)), 'fixture check: the two nodes share their tag nodes');
  C.todaysImport(g, a2);
  prune(g, a2);
  const bad = [trouble(g, a2), noOrphans(g)].filter(Boolean);
  assert(!bad.length, `after the prune of ${C.short(C.addressOf(a2))}: ${bad.join('; ')}`);
  assert(sameList(tagUuids(g, C.addressOf(b1)), shared), `the other node keeps the tag nodes it shared: it held ${shared.join(', ')} and now holds ${tagUuids(g, C.addressOf(b1)).join(', ')}`);
});

test('P4 (AC-2): a copy holding three versions\' tags keeps only the newest\'s, and the old tag nodes are gone', () => {
  const v = (n) => C.letter(CURATOR, { kind: 39998, at: 1000 + n, tags: C.headerTags(CURATOR, 'nostr-relay') });
  const g = C.emptyGraph();
  for (const n of [1, 2, 3]) C.todaysImport(g, v(n));
  const before = tagUuids(g, C.addressOf(v(1))).length;
  C.todaysImport(g, v(4));
  prune(g, v(4), { derivedEdges: true });
  const bad = [trouble(g, v(4)), noOrphans(g)].filter(Boolean);
  assert(!bad.length, `the copy held ${before} tag nodes from three versions; after the newest's import and prune: ${bad.join('; ')}`);
});

test('P5 (AC-2): with derivedEdges, the b-derived relationships the newest version doesn\'t make go: a REFERENCES to itself and an INHERITS_FROM', () => {
  const self = at(CURATOR, 39998, 'nostr-relay');
  const parent = at(C.sha256('a parent concept'), 39998, 'parent');
  const tags = C.headerTags(CURATOR, 'nostr-relay');
  const v1 = C.letter(CURATOR, { kind: 39998, at: 1001, tags: [...tags, ['b', self, 'pointer'], ['b', parent, 'inherit']] });
  const v2 = C.letter(CURATOR, { kind: 39998, at: 1002, tags });
  const g = C.emptyGraph();
  C.todaysImport(g, v1);
  assert(sameList(bRefs(g, self), [self]) && sameList(inherits(g, self), [parent]), 'fixture check: the old version\'s b tags made a REFERENCES from the copy to itself and an INHERITS_FROM');
  C.todaysImport(g, v2);
  prune(g, v2, { derivedEdges: true });
  const loops = C.selfRels(g, nodeAt(g, self));
  assert(!bRefs(g, self).length && !inherits(g, self).length && !loops.length,
    `the newest version has no b tag, so the copy should keep no b-derived relationship; it has REFERENCES {source:'b-tag'} to [${bRefs(g, self).map(C.short).join(', ')}], INHERITS_FROM to [${inherits(g, self).map(C.short).join(', ')}] and ${loops.length} relationships to itself`);
  assert(C.nodesAt(g, parent).length === 1, 'the node the old INHERITS_FROM ended at stays: the prune deletes relationships, never the node at their end');
});

test('P6 (AC-2): with derivedEdges, the relationships the newest version\'s b tags derive stay, one each', () => {
  const x = at(C.sha256('x'), 39998, 'x');
  const y = at(C.sha256('y'), 39998, 'y');
  const parent = at(C.sha256('a parent concept'), 39998, 'parent');
  const tags = C.headerTags(CURATOR, 'nostr-relay');
  const v1 = C.letter(CURATOR, { kind: 39998, at: 1001, tags: [...tags, ['b', x, 'pointer'], ['b', y], ['b', parent, 'inherit']] });
  const v2 = C.letter(CURATOR, { kind: 39998, at: 1002, tags: [...tags, ['b', y, 'pointer'], ['b', parent, 'inherit']] });
  const g = C.emptyGraph();
  C.todaysImport(g, v1);
  C.todaysImport(g, v2);
  prune(g, v2, { derivedEdges: true });
  const address = C.addressOf(v2);
  assert(sameList(bRefs(g, address), [y]) && sameList(inherits(g, address), [parent]),
    `the newest version points at ${C.short(y)} and inherits from ${C.short(parent)}, and no longer points at ${C.short(x)}; the copy has REFERENCES {source:'b-tag'} to [${bRefs(g, address).map(C.short).join(', ')}] and INHERITS_FROM to [${inherits(g, address).map(C.short).join(', ')}]`);
  assert(!trouble(g, v2), trouble(g, v2) || '');
});

test('P7 (ADR 0035 Decision 4): without derivedEdges, the prune leaves b-derived relationships alone', () => {
  // An own header: an earlier letter carried a b the owner authored, which Pass 1's letter dropped (the queued lost-b
  // fault). The firmware's step must not erase its last trace.
  const owners = at(C.sha256('a concept the owner points at'), 39998, 'elsewhere');
  const community = at(CURATOR, 39998, 'tag');
  const tags = C.headerTags(TA, 'tag');
  const before = C.letter(TA, { kind: 39998, at: 1000, tags: [...tags, ['b', owners, 'pointer']] });
  const seeded = C.letter(TA, { kind: 39998, at: 1001, tags: [...tags, ['b', community, 'pointer']] });
  const g = C.emptyGraph();
  C.todaysImport(g, before);
  C.todaysImport(g, seeded);
  prune(g, seeded);
  const address = C.addressOf(seeded);
  assert(sameList(bRefs(g, address), [community, owners].sort()), `both REFERENCES {source:'b-tag'} stay, to ${C.short(community)} and ${C.short(owners)}; got [${bRefs(g, address).map(C.short).join(', ')}]`);
  assert(!trouble(g, seeded), trouble(g, seeded) || '');
});

test('P8: the prune touches only tag nodes and b-derived relationships: the node\'s labels, properties and every other relationship stay, and a node an old tag pointed at stays', () => {
  const other = at(C.sha256('another node'), 39999, 'other');
  const sup = at(TA, 39999, 'nostr-relay-superset');
  const v1 = C.letter(CURATOR, { kind: 39999, at: 1001, tags: [...C.supersetTags(CURATOR, 'nostr-relay'), ['a', other]] });
  const v2 = C.letter(CURATOR, { kind: 39999, at: 1002, tags: C.supersetTags(CURATOR, 'nostr-relay') });
  const address = C.addressOf(v2);
  const g = C.emptyGraph();
  C.todaysImport(g, v1);
  C.run(g, 'MATCH (n:NostrEvent {uuid: $u}) SET n:Superset, n.kept = $k', { u: address, k: 'set by hand' });
  C.run(g, 'MERGE (s:NostrEvent:Superset {uuid: $s}) WITH s MATCH (n:NostrEvent {uuid: $u}) MERGE (s)-[:IS_A_SUPERSET_OF]->(n)', { s: sup, u: address });
  C.run(g, `MATCH (n:NostrEvent {uuid: $u}), (o:NostrEvent {uuid: $o})
    MERGE (n)-[r:REFERENCES]->(o) SET r.source = 'firmware-community'
    MERGE (n)-[:IS_THE_CONCEPT_FOR]->(o)`, { u: address, o: other });
  const kept = (s) => C.relsOut(s, nodeAt(s, address)).filter((r) => r.type !== 'HAS_TAG').map((r) => `${r.type}${r.props && r.props.source ? `{${r.props.source}}` : ''}->${r.toNode.props.uuid}`).sort();
  const outBefore = kept(g);
  const inBefore = g.rels.filter((r) => r.to === nodeAt(g, address).eid && r.type !== 'HAS_TAG').map((r) => r.type).sort();
  C.todaysImport(g, v2);
  prune(g, v2, { derivedEdges: true });
  const n = nodeAt(g, address);
  assert(n.labels.includes('Superset') && n.props.kept === 'set by hand', `the node keeps its labels and properties; it has ${n.labels.join(':')} and kept = ${n.props.kept}`);
  assert(sameList(kept(g), outBefore), `the node's other outgoing relationships stay: they were ${outBefore.join(', ')}; now ${kept(g).join(', ')}`);
  const inAfter = g.rels.filter((r) => r.to === n.eid && r.type !== 'HAS_TAG').map((r) => r.type).sort();
  assert(sameList(inAfter, inBefore), `its incoming relationships stay: they were ${inBefore.join(', ')}; now ${inAfter.join(', ')}`);
  assert(C.nodesAt(g, other).length === 1, 'the node the old version\'s a tag pointed at stays');
  assert(!trouble(g, v2) && !noOrphans(g), [trouble(g, v2), noOrphans(g)].filter(Boolean).join('; '));
});

test('P9: a d-tag and a b target holding a quote and a backslash are found and kept', () => {
  const d = "it's \\ odd";
  const target = at(C.sha256('t'), 39998, "o'brien \\ x");
  const gone = at(C.sha256('gone'), 39998, 'gone');
  const v1 = C.letter(CURATOR, { kind: 39999, at: 1001, tags: [['d', d], ['name', 'Odd'], ['b', target, 'pointer'], ['b', gone, 'pointer']] });
  const v2 = C.letter(CURATOR, { kind: 39999, at: 1002, tags: [['d', d], ['name', 'Odd, again'], ['b', target, 'pointer']] });
  const g = C.emptyGraph();
  C.todaysImport(g, v1);
  C.todaysImport(g, v2);
  prune(g, v2, { derivedEdges: true });
  const address = C.addressOf(v2);
  assert(!trouble(g, v2), trouble(g, v2) || '');
  assert(sameList(bRefs(g, address), [target]), `REFERENCES {source:'b-tag'} should run to ${C.short(target)} alone; got [${bRefs(g, address).map(C.short).join(', ')}]`);
});

/* ───────────── run ───────────── */

async function run() {
  console.log('\n=== the prune builder of firmware\'s community references (community-reference #39) ===');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\ncommunity-references-prune-builder: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
