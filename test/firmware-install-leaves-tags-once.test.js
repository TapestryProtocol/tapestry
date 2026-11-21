'use strict';
/**
 * community-reference #39: a firmware install leaves each header's tags once (ADR community-reference/0035).
 *   Story: engineering-team/stories/community-reference/39-firmware-install-leaves-tags-once.md
 *   ADR:   engineering-team/decisions/community-reference/0035-community-references-import-then-prune.md
 *   Plan:  engineering-team/stories/community-reference/39-firmware-install-leaves-tags-once.test-plan.md
 *
 * Install's real community references, and the edge wiring after them, run in a child process
 * (test/helpers/communityStepChild.js) over the Cypher engine, with a fake strfry and a fake relay. Each scenario starts
 * from a graph built the way today's code builds one (test/helpers/communityStep.js), and each test reads the graph, the
 * strfry and the calls the child reports. The builder the step calls has its own suite,
 * test/community-references-prune-builder.test.js.
 *
 *   S1  AC-1  one install: each header with a community reference holds its letter's tags once, its b included, and
 *             has one REFERENCES {source:'b-tag'}, to the community header
 *   S2  AC-1  two installs in a row: the same
 *   S3  AC-1  a header whose letter already carries the b, which no install signs again (feat/tags' installs): its
 *             letter's tags once, and the header is neither signed nor published
 *   S4  AC-2  community headers and supersets holding several versions' tags keep only the tags of the version the
 *             install brings in
 *   S5  AC-2  a copy keeps only the relationships its version's b tags derive
 *   S6  AC-3  the instance that curates nostr-relay's reference: no b naming its own header, nothing from the header or
 *             its superset to itself, and the superset's tags once
 *   S7  AC-3  it signs, publishes and fetches nothing for that reference, while the other five are seeded and fetched
 *   S8  AC-3  pass_communityReferences hands the edge wiring no entry for that reference, and one for each other
 *   S9  AC-4  a staging-shaped graph of today is clean after one install
 *   S10 AC-4  a production-shaped graph of today is clean after one install
 *   E1        a second install on production leaves it as clean as the first
 *   E2        a relay with none of the community letters: each header still holds its letter's tags once
 *   E3        a copy whose import fails keeps the tags it held: no prune runs ahead of a good import (passes before the
 *             fix too; it guards the order ADR 0035 Decision 2 sets)
 *   E4        a dry run changes nothing, the reference the instance curates included (passes before the fix too)
 *   E5        a REFERENCES on the instance's own header from a b its owner authored survives the install (ADR 0035
 *             Decision 4; passes before the fix too)
 *
 * Review round 1's (ADR 0035 Amendment 1):
 *   S11 AC-3  seed-firmware's target (src/firmware/target.js) gives the reference its assistant curates no pointer b,
 *             no claim and no references entry, and each other reference's header its own (item 1)
 *   S12 AC-3  seed-firmware's oracle, today's routes run from their source (test/helpers/todaysFirmwareRoutes.js), signs
 *             no b on it either, and agrees with the target (item 1)
 *   E6        a seeded header whose prune fails keeps its REFERENCES {source:'b-tag'}: the wiring makes no stub of it
 *             (item 2)
 *   E7        the same on the "already has a b" path (item 2)
 *   E8        a seeded letter whose import fails after its publish gets no stub either (item 2)
 *
 * The assistants: production's is read from the manifest (the curator nostr-relay's reference names), and staging's is
 * made up, so the decision of which reference is the instance's own is the code's, made at run time.
 *
 * Nothing here reaches a real service. The child gets a conf whose Neo4j is a closed port, and every other endpoint a
 * closed port too, as test/word-elements-fit-the-installed-word-schema.test.js gives its child; its stubs answer every
 * call install makes. This process sets nothing in process.env: the gate loads every suite into one process.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const C = require('./helpers/communityStep');

const CHILD = path.join(__dirname, 'helpers/communityStepChild.js');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(C.ROOT, 'firmware/active/manifest.json'), 'utf8'));

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const brief = (x, n = 700) => { const s = typeof x === 'string' ? x : JSON.stringify(x); return s && s.length > n ? `${s.slice(0, n)}…` : s; };
const list = (xs) => (xs.length ? `\n          - ${xs.join('\n          - ')}` : '');

/* ───────────── the manifest's community references ───────────── */

const CRS = MANIFEST.concepts.filter((c) => c.communityReference && c.communityReference.headerATag).map((c) => {
  const cr = c.communityReference;
  const [, curator, ...d] = cr.headerATag.split(':');
  const dTag = d.join(':');
  return { slug: c.slug, headerATag: cr.headerATag, curator, dTag, supersetATag: `39999:${curator}:${dTag}-superset`, pin: cr.knownGoodEventId || null };
});
/** The reference production curates itself, today (story #39, AC-3). */
const SELF = CRS.find((c) => c.slug === 'nostr-relay');
const OTHERS = CRS.filter((c) => c !== SELF);
/** Production's assistant: the curator nostr-relay's reference names. */
const PROD = SELF ? SELF.curator : null;
/** A staging-shaped instance's assistant: one that curates none of the references. */
const STAGING = C.sha256("a staging-shaped instance's assistant");

const ownHeader = (ta, c) => `39998:${ta}:${c.slug}`;
const ownSuperset = (ta, c) => `39999:${ta}:${c.slug}-superset`;

/* ───────────── graphs as today's code leaves them ───────────── */

function world(ta) { return { ta, graph: C.emptyGraph(), strfry: new C.LetterStore(), relay: new C.LetterStore(), clock: 1700000000 }; }

/** Version v of a curator's community header; a pinned reference's one version has the pinned id. */
function curatorHeader(c, v, b = []) {
  return C.letter(c.curator, { kind: 39998, at: 1690000000 + v * 1000, tags: [...C.headerTags(c.curator, c.dTag), ...b], id: c.pin && v === 1 ? c.pin : null });
}
function curatorSuperset(c, v) {
  return C.letter(c.curator, { kind: 39999, at: 1690000000 + v * 1000 + 1, tags: C.supersetTags(c.curator, c.dTag) });
}
/** Pass 1's part of an install: the concept's header and superset signed again, stored, and imported as create-concept does. */
function pass1(w, c) {
  for (const l of [C.letter(w.ta, { kind: 39998, at: ++w.clock, tags: C.headerTags(w.ta, c.slug) }), C.letter(w.ta, { kind: 39999, at: ++w.clock, tags: C.supersetTags(w.ta, c.slug) })]) {
    w.strfry.put(l);
    C.pass1Import(w.graph, l);
  }
}
/** Today's seed (src/firmware/install.js:1131-1138): the header's letter again with the pointer-b, signed, stored, and imported by buildImportCypher. */
function seed(w, c) {
  const h = w.strfry.get(ownHeader(w.ta, c));
  const s = C.letter(w.ta, { kind: 39998, at: ++w.clock, tags: [...h.tags, ['b', c.headerATag, 'pointer']], content: h.content });
  w.strfry.put(s);
  C.todaysImport(w.graph, s);
  return s;
}
/** Today's import of a community letter (install.js:1166-1167 and :1193-1200): stored, imported by buildImportCypher, a superset labelled. */
function bringIn(w, l) {
  w.strfry.put(l);
  C.todaysImport(w.graph, l);
  if (l.kind === 39999) C.run(w.graph, 'MATCH (n:NostrEvent|TapestryNode {uuid: $uuid}) SET n:Superset', { uuid: C.addressOf(l) });
}
/** Today's wiring after Pass 3 for a header that carries the b (install.js:1355-1377): only the superset link. */
function wire(w, c) {
  C.run(w.graph, 'MATCH (a:NostrEvent|TapestryNode {uuid:$from}), (b:NostrEvent|TapestryNode {uuid:$to}) MERGE (a)-[:IS_A_SUPERSET_OF]->(b)', { from: ownSuperset(w.ta, c), to: c.supersetATag });
}
/**
 * The copies of a reference as today's installs leave them: `hv` versions of the community header (one when pinned) and
 * `sv` of its superset, each version's tags beside the last's. The relay has each one's next version (a pinned header's
 * own), `nextB` on the next header; or, with `same`, the versions the copies already hold.
 */
function copies(w, c, { hv, sv, oldB = () => [], nextB = [], same = false }) {
  for (let v = 1; v <= hv; v++) bringIn(w, curatorHeader(c, v, oldB(v)));
  for (let v = 1; v <= sv; v++) bringIn(w, curatorSuperset(c, v));
  wire(w, c);
  w.relay.put(c.pin ? curatorHeader(c, 1) : same ? curatorHeader(c, hv, oldB(hv)) : curatorHeader(c, hv + 1, nextB));
  w.relay.put(curatorSuperset(c, same ? sv : sv + 1));
}
const selfB = (v) => (v > 2 ? [['b', SELF.headerATag, 'pointer']] : []);

/**
 * A staging-shaped instance as today's installs leave it (story #39's Background): each of the six headers holds Pass 1's
 * tags and the seeded letter's; the copies of the five legacy headers hold one version (pinned) or two, their supersets
 * two; the copy of production's nostr-relay header and its superset hold `prodVersions` versions each, the later headers
 * with production's b naming its own header, so the copy has a REFERENCES to itself. The relay has each curator's next
 * version, production's with no b unless `newestProdB` says otherwise: the graph once production has healed. Staging's
 * own first install comes before production's, and keeps that loop until its next (ADR 0035 Amendment 1, item 5).
 */
function stagingToday({ prodVersions = 9, oldProdB = selfB, newestProdB = [] } = {}) {
  const w = world(STAGING);
  for (const c of CRS) {
    pass1(w, c);
    seed(w, c);
    if (c === SELF) copies(w, c, { hv: prodVersions, sv: prodVersions, oldB: oldProdB, nextB: newestProdB });
    else copies(w, c, { hv: c.pin ? 1 : 2, sv: 2 });
  }
  return w;
}
/**
 * A production-shaped instance as today's installs leave it: its assistant is the curator nostr-relay's reference names,
 * and its five other references are as on staging. For nostr-relay, the seed gave the header a b naming itself, from which
 * buildImportCypher derived a REFERENCES from the header to itself. The community step then brought in the instance's own
 * header (the seeded letter: no new tags) and its own superset (Pass 1's letter, whose second import doubled its tags),
 * and the wiring made the superset a superset of itself.
 */
function productionToday() {
  const w = world(PROD);
  for (const c of CRS) {
    pass1(w, c);
    const s = seed(w, c);
    if (c === SELF) {
      bringIn(w, s);
      bringIn(w, w.strfry.get(ownSuperset(w.ta, c)));
      wire(w, c);
    } else {
      copies(w, c, { hv: c.pin ? 1 : 2, sv: 2 });
    }
  }
  return w;
}
/** An instance before its first install: nothing in its graph or strfry, and the curators' letters on the relay (production's with no b). */
function freshInstance({ relayHasLetters = true } = {}) {
  const w = world(STAGING);
  if (relayHasLetters) for (const c of CRS) { w.relay.put(curatorHeader(c, 1)); w.relay.put(curatorSuperset(c, 1)); }
  return w;
}
/**
 * tags.brainstorm.world's shape: an instance whose installs never sign a header again (feat/tags' Pass 1 has no
 * overwrite, ADR 0035 Context). Each header's letter is the one its first install seeded, b included, and the header holds
 * create-concept's tags and the seeded letter's. The relay has the versions the copies hold, so only the headers change.
 */
function neverResigned() {
  const w = world(STAGING);
  for (const c of CRS) {
    pass1(w, c);
    seed(w, c);
    copies(w, c, { hv: 1, sv: 1, same: true });
  }
  return w;
}

/* ───────────── the child ───────────── */

// A conf whose Neo4j is a closed port, and every endpoint a closed port: were a stub ever bypassed, nothing is reached.
const DEAD_CONF = path.join(os.tmpdir(), `header-tags-once-dead-${process.pid}.conf`);
const DEAD = { BRAINSTORM_CONF_PATH: DEAD_CONF, NEO4J_URI: 'bolt://127.0.0.1:9', TAPESTRY_API_BASE: 'http://127.0.0.1:9', BRAINSTORM_BASE_URL: 'http://127.0.0.1:9', TAPESTRY_PORT: '9', MEILI_URL_HOST: 'http://127.0.0.1:9', TAPESTRY_CONTAINER: 'no-such-container' };
let deadWritten = false;
function deadConf() {
  if (deadWritten) return;
  fs.writeFileSync(DEAD_CONF, 'NEO4J_URI="bolt://127.0.0.1:9"\nNEO4J_USER="none"\nNEO4J_PASSWORD="none"\n');
  process.on('exit', () => { try { fs.unlinkSync(DEAD_CONF); } catch { /* already gone */ } });
  deadWritten = true;
}

function child(w, extra = {}) {
  deadConf();
  const r = spawnSync(process.execPath, [CHILD], {
    input: JSON.stringify({ ta: w.ta, graph: w.graph, strfry: w.strfry.all(), relay: w.relay.all(), ...extra }),
    encoding: 'utf8', env: { ...process.env, ...DEAD }, maxBuffer: 256 << 20, timeout: 120000,
  });
  const at = (r.stdout || '').lastIndexOf('@@RESULT@@');
  assert(at >= 0, `the child process printed no result (exit ${r.status}${r.signal ? `, ${r.signal}` : ''}): ${brief(r.stderr || r.stdout, 900)}`);
  const out = JSON.parse(r.stdout.slice(at + 10).split('\n')[0]);
  assert(!out.threw, `install's code threw in the child process: ${brief(out.threw, 1200)}`);
  assert(out.ta === w.ta, `the child's assistant is ${out.ta}, not the scenario's ${w.ta}`);
  assert(!out.calls.unexpected.length, `install asked for what the child doesn't answer: ${brief(out.calls.unexpected)}. The child answers the routes ADR 0035 names; see test/helpers/communityStepChild.js`);
  return out;
}
const runs = new Map();
/** A scenario run once and shared by the tests that read it. */
function once(name, make) {
  if (!runs.has(name)) { const [w, extra] = make(); runs.set(name, { w, out: child(w, extra) }); }
  return runs.get(name);
}
const RESIGN = { installs: [{ resign: true }] };
const S_FRESH = () => once('fresh', () => [freshInstance(), RESIGN]);
const S_TWICE = () => once('fresh-twice', () => [freshInstance(), { installs: [{ resign: true }, { resign: true }] }]);
const S_NEVER = () => once('never-resigned', () => [neverResigned(), { installs: [{ resign: false }] }]);
const S_STAGING = () => once('staging', () => [stagingToday(), RESIGN]);
const S_PROD = () => once('production', () => [productionToday(), RESIGN]);

/* ───────────── reading what the child left ───────────── */

const letterAt = (out, address) => new C.LetterStore(out.strfry).get(address);
function nodeAt(out, address) { const ns = C.nodesAt(out.graph, address); return ns.length === 1 ? ns[0] : null; }
const sameList = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Why the node at `address` doesn't hold exactly the tag nodes one import of its current letter makes, or null. */
function tagTrouble(out, address) {
  const l = letterAt(out, address);
  if (!l) return `${C.short(address)}: the instance's strfry holds no letter there`;
  const ns = C.nodesAt(out.graph, address);
  if (ns.length !== 1) return `${C.short(address)}: ${ns.length} nodes hold the address`;
  const tags = C.tagsOf(out.graph, ns[0]);
  const held = tags.map((t) => t.props.uuid).sort();
  if (sameList(held, C.importMakes(l, 'today')) || sameList(held, C.importMakes(l, 'pass1'))) return null;
  const counts = {};
  for (const t of tags) { const k = JSON.stringify(C.contentOf(t)); counts[k] = (counts[k] || 0) + 1; }
  const repeated = Object.entries(counts).filter(([, n]) => n > 1).map(([k, n]) => `${JSON.parse(k)[0]} ×${n}`);
  const inLetter = new Set(l.tags.map((t) => JSON.stringify(t)));
  const stray = Object.keys(counts).filter((k) => !inLetter.has(k)).map((k) => C.short(brief(JSON.parse(k), 90)));
  return `${C.short(address)} holds ${tags.length} tag nodes; its letter ${l.id.slice(0, 8)}… has ${l.tags.length} tags, and one import of it makes ${l.tags.length}`
    + `${repeated.length ? `. Repeated: ${repeated.join(', ')}` : ''}${stray.length ? `. Not in its letter: ${stray.join(', ')}` : ''}`
    + `${!repeated.length && !stray.length ? '. Their contents match the letter, but they are not the tag nodes an import of it makes: an earlier letter\'s tag nodes are still there' : ''}`;
}
/** Why the header at `address` doesn't have exactly one REFERENCES {source:'b-tag'}, to `to`, or null (AC-1). */
function refTrouble(out, address, to) {
  const h = nodeAt(out, address);
  if (!h) return `${C.short(address)}: no single node holds the address`;
  const got = C.relsOut(out.graph, h, 'REFERENCES').filter((r) => r.props && r.props.source === 'b-tag').map((r) => (r.toNode ? r.toNode.props.uuid : '(no node)'));
  return got.length === 1 && got[0] === to ? null : `${C.short(address)} has ${got.length} REFERENCES {source:'b-tag'}${got.length ? `, to ${got.map(C.short).join(', ')}` : ''}; it should have one, to ${C.short(to)}`;
}
/** Why the node at `address` doesn't have exactly the b-derived relationships its current letter derives, each once, or null (AC-2). */
function derivedTrouble(out, address) {
  const l = letterAt(out, address);
  const n = nodeAt(out, address);
  if (!l || !n) return `${C.short(address)}: ${l ? 'no single node holds the address' : 'no letter in strfry'}`;
  const want = C.bTargets(l);
  const refs = C.relsOut(out.graph, n, 'REFERENCES').filter((r) => r.props && r.props.source === 'b-tag').map((r) => r.toNode && r.toNode.props.uuid).sort();
  const inh = C.relsOut(out.graph, n, 'INHERITS_FROM').map((r) => r.toNode && r.toNode.props.uuid).sort();
  const wantRefs = [...new Set(want.pointers)].sort();
  const wantInh = [...new Set(want.inherits)].sort();
  if (sameList(refs, wantRefs) && sameList(inh, wantInh)) return null;
  return `${C.short(address)} has REFERENCES {source:'b-tag'} to [${refs.map(C.short).join(', ')}] and INHERITS_FROM to [${inh.map(C.short).join(', ')}]; `
    + `the letter it holds (${l.id.slice(0, 8)}…) derives REFERENCES to [${wantRefs.map(C.short).join(', ')}] and INHERITS_FROM to [${wantInh.map(C.short).join(', ')}]`;
}
/** Why the node at `address` has a relationship to itself, or null. */
function selfTrouble(out, address) {
  const n = nodeAt(out, address);
  if (!n) return null;
  const loops = C.selfRels(out.graph, n);
  return loops.length ? `${C.short(address)} has ${loops.map((r) => `${r.type}${r.props && r.props.source ? ` {source:'${r.props.source}'}` : ''}`).join(', ')} to itself` : null;
}
const isCopy = (ta, address) => address.split(':')[1] !== ta;
/** Every node the six references touch: the instance's headers and supersets, and the copies strfry holds a letter for. */
function addresses(out) {
  const all = new Set();
  for (const c of CRS) for (const a of [ownHeader(out.ta, c), ownSuperset(out.ta, c), c.headerATag, c.supersetATag]) all.add(a);
  return [...all].filter((a) => !isCopy(out.ta, a) || letterAt(out, a));
}
/** What keeps the whole of the step's part of the graph from meeting AC-1 to AC-3 (AC-4). */
function everyTrouble(out) {
  const found = [];
  for (const a of addresses(out)) {
    found.push(tagTrouble(out, a), selfTrouble(out, a));
    if (isCopy(out.ta, a)) found.push(derivedTrouble(out, a));
  }
  for (const c of CRS) if (!(out.ta === c.curator)) found.push(refTrouble(out, ownHeader(out.ta, c), c.headerATag));
  const orphans = C.orphanTags(out.graph);
  if (orphans.length) found.push(`${orphans.length} tag nodes are held by no node, e.g. ${orphans.slice(0, 3).map((t) => t.props.uuid).join(', ')}`);
  return found.filter(Boolean);
}
const seeded = (out, c) => { const l = letterAt(out, ownHeader(out.ta, c)); return !!l && l.tags.some((t) => t[0] === 'b' && t[1] === c.headerATag && t[2] === 'pointer'); };
const askedFor = (out, c) => out.calls.relay.some((f) => (f.ids && c.pin && f.ids.includes(c.pin)) || ((f.authors || []).includes(c.curator) && (f['#d'] || []).includes(c.dTag)));

/* ───────────── the tests ───────────── */

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('S0: the manifest has the references the story names, nostr-relay\'s curated by an assistant of its own', () => {
  const named = ['nostr-event-tag', 'nostr-relay', 'nostr-user-tag', 'tag', 'tag-pinning', 'tagging-with-specific-tag'];
  assert(sameList(CRS.map((c) => c.slug).sort(), named), `the manifest's communityReference entries are ${CRS.map((c) => c.slug).join(', ') || 'none'}; the story names these six: ${named.join(', ')}`);
  assert(OTHERS.every((c) => c.curator !== PROD), 'nostr-relay\'s curator curates no other reference, so production curates exactly one of its references (story #39, AC-3)');
});

test('S1 (AC-1): after one install, each header with a community reference holds its letter\'s tags once, b included, and one REFERENCES {source:\'b-tag\'}, to the community header', () => {
  const { out } = S_FRESH();
  const found = [];
  for (const c of CRS) {
    if (!seeded(out, c)) found.push(`${C.short(ownHeader(out.ta, c))}: its letter carries no ['b', ${C.short(c.headerATag)}, 'pointer']`);
    found.push(tagTrouble(out, ownHeader(out.ta, c)), refTrouble(out, ownHeader(out.ta, c), c.headerATag));
  }
  const bad = found.filter(Boolean);
  assert(!bad.length, `after one install (Pass 1, then the community step and its wiring):${list(bad)}`);
});

test('S2 (AC-1): after two installs in a row, each header still holds its latest letter\'s tags once and one REFERENCES {source:\'b-tag\'}', () => {
  const { out } = S_TWICE();
  const found = CRS.flatMap((c) => [tagTrouble(out, ownHeader(out.ta, c)), refTrouble(out, ownHeader(out.ta, c), c.headerATag)]).filter(Boolean);
  assert(!found.length, `after two installs:${list(found)}`);
});

test('S3 (AC-1): a header whose letter already carries the b, which no install signs again (feat/tags\' installs), ends with its letter\'s tags once, and is neither signed nor published', () => {
  const { w, out } = S_NEVER();
  const before = CRS.map((c) => C.tagsOf(w.graph, C.nodesAt(w.graph, ownHeader(w.ta, c))[0]).length);
  const found = CRS.flatMap((c) => [tagTrouble(out, ownHeader(out.ta, c)), refTrouble(out, ownHeader(out.ta, c), c.headerATag)]).filter(Boolean);
  assert(!found.length, `the headers held ${before.join(', ')} tag nodes before the install; after it:${list(found)}`);
  const own = new Set(CRS.map((c) => ownHeader(out.ta, c)));
  const signed = out.calls.signs.filter((l) => own.has(C.addressOf(l)));
  const sent = out.calls.publishes.filter((l) => own.has(C.addressOf(l)));
  assert(!signed.length && !sent.length, `a header that carries a b is never signed again or published (Story 38's never-clobber, ADR 0035 Decision 2): signed ${signed.length}, published ${sent.length}`);
});

test('S4 (AC-2): community headers and supersets holding several versions\' tags keep only the tags of the version the install brings in', () => {
  const { w, out } = S_STAGING();
  const held = (a) => C.tagsOf(w.graph, C.nodesAt(w.graph, a)[0]).length;
  const found = CRS.flatMap((c) => [tagTrouble(out, c.headerATag), tagTrouble(out, c.supersetATag)]).filter(Boolean);
  assert(!found.length, `before the install the copy of production's header held ${held(SELF.headerATag)} tag nodes and its superset ${held(SELF.supersetATag)}; after it:${list(found)}`);
});

test('S5 (AC-2): a copy keeps only the relationships its version\'s b tags derive: an old version\'s REFERENCES to itself and its INHERITS_FROM go, the new version\'s REFERENCES is there once', () => {
  const parent = `39998:${C.sha256('a parent concept')}:parent`;
  const next = `39998:${C.sha256('another community')}:nostr-relay`;
  const { w, out } = once('staging-b', () => [stagingToday({ prodVersions: 3, oldProdB: () => [['b', SELF.headerATag, 'pointer'], ['b', parent, 'inherit']], newestProdB: [['b', next, 'pointer']] }), RESIGN]);
  const loopsBefore = selfTrouble({ ...out, graph: w.graph }, SELF.headerATag);
  assert(loopsBefore, 'the scenario starts with the copy of production\'s header holding a REFERENCES to itself (fixture check)');
  const found = [derivedTrouble(out, SELF.headerATag), selfTrouble(out, SELF.headerATag), tagTrouble(out, SELF.headerATag)].filter(Boolean);
  assert(!found.length, `the copy of production's header, whose new version names ${C.short(next)} and no longer itself or ${C.short(parent)}:${list(found)}`);
});

test('S6 (AC-3): on the instance that curates nostr-relay\'s reference, the header carries no b naming itself and has nothing to itself, and its superset holds its tags once with nothing to itself', () => {
  const { out } = S_PROD();
  const h = ownHeader(PROD, SELF);
  const sup = ownSuperset(PROD, SELF);
  const l = letterAt(out, h);
  const node = nodeAt(out, h);
  const found = [];
  if (!l) found.push(`${C.short(h)}: strfry holds no letter there`);
  else if (l.tags.some((t) => t[0] === 'b' && t[1] === h)) found.push(`the letter strfry holds for ${C.short(h)} (${l.id.slice(0, 8)}…) carries a b naming its own address`);
  if (!node) found.push(`${C.short(h)}: no single node holds the address`);
  else if (C.tagsOf(out.graph, node).some((t) => t.props.type === 'b' && t.props.value === h)) found.push(`${C.short(h)} holds a b tag node naming its own address`);
  found.push(selfTrouble(out, h), tagTrouble(out, h), tagTrouble(out, sup), selfTrouble(out, sup));
  const bad = found.filter(Boolean);
  assert(!bad.length, `production after one install:${list(bad)}`);
});

test('S7 (AC-3): that instance signs, publishes and fetches nothing for its own reference, while the other five are seeded and fetched', () => {
  const { out } = S_PROD();
  const mine = new Set([ownHeader(PROD, SELF), ownSuperset(PROD, SELF)]);
  const signed = out.calls.signs.filter((l) => mine.has(C.addressOf(l)));
  const sent = out.calls.publishes.filter((l) => mine.has(C.addressOf(l)));
  const fetched = out.calls.relay.filter((f) => (f.authors || []).includes(PROD));
  assert(!signed.length && !sent.length && !fetched.length,
    `for the reference production curates itself the step signed ${signed.length} letters, published ${sent.length} and asked the relay ${fetched.length} times (${brief(fetched, 300)}); it should do none of these (ADR 0035 Decision 3)`);
  const missed = OTHERS.filter((c) => !seeded(out, c) || !askedFor(out, c)).map((c) => `${c.slug}: ${seeded(out, c) ? '' : 'not seeded '}${askedFor(out, c) ? '' : 'not fetched'}`);
  assert(!missed.length, `the step must still reach every other reference: ${missed.join('; ')}`);
});

test('S8 (AC-3): pass_communityReferences hands the edge wiring no entry for the reference the instance curates, and one for each other', () => {
  const { out } = once('production-direct', () => [productionToday(), { direct: true }]);
  const slugs = (out.pending || []).map((p) => p.slug);
  assert(!slugs.includes(SELF.slug), `pending holds an entry for ${SELF.slug}, from ${C.short(ownHeader(PROD, SELF))} to itself: the wiring would make its relationships to itself again (ADR 0035 Decision 3). Pending: ${slugs.join(', ')}`);
  assert(sameList([...slugs].sort(), OTHERS.map((c) => c.slug).sort()), `pending should hold one entry for each other reference (${OTHERS.map((c) => c.slug).join(', ')}); it holds ${slugs.join(', ') || 'none'}`);
});

test('S9 (AC-4): a staging-shaped graph of today is clean after one install: every header and copy holds its letter\'s tags once, with only the relationships its letter derives, and nothing points at itself', () => {
  const { out } = S_STAGING();
  const found = everyTrouble(out);
  assert(!found.length, `staging after one install:${list(found)}`);
});

test('S10 (AC-4): a production-shaped graph of today is clean after one install', () => {
  const { out } = S_PROD();
  const found = everyTrouble(out);
  assert(!found.length, `production after one install:${list(found)}`);
});

test('E1: a second install on production leaves it as clean as the first: its relationships to itself and its repeated tags don\'t come back', () => {
  const { out } = once('production-twice', () => [productionToday(), { installs: [{ resign: true }, { resign: true }] }]);
  const found = everyTrouble(out);
  assert(!found.length, `production after two installs:${list(found)}`);
});

test('E2: when the relay hints have none of the community letters, each header still holds its letter\'s tags once, its REFERENCES to the address its b names', () => {
  const { out } = once('relay-miss', () => [freshInstance({ relayHasLetters: false }), RESIGN]);
  assert(out.calls.relay.length >= CRS.length, `the step asked the relay ${out.calls.relay.length} times; it should ask for each reference (the path under test ran)`);
  const found = CRS.flatMap((c) => [tagTrouble(out, ownHeader(out.ta, c)), refTrouble(out, ownHeader(out.ta, c), c.headerATag)]).filter(Boolean);
  assert(!found.length, `after one install with nothing on the relay:${list(found)}`);
});

test('E3: a community copy whose import fails keeps the tags it held: no prune runs ahead of a good import', () => {
  const { w, out } = once('copy-import-fails', () => [stagingToday({ prodVersions: 3 }), { ...RESIGN, failImportAt: SELF.headerATag }]);
  assert(out.calls.failedImports.includes(SELF.headerATag), `the child never refused the import of ${C.short(SELF.headerATag)}: the path under test didn't run`);
  const was = C.tagsOf(w.graph, C.nodesAt(w.graph, SELF.headerATag)[0]).map((t) => t.props.uuid).sort();
  const n = nodeAt(out, SELF.headerATag);
  const now = n ? C.tagsOf(out.graph, n).map((t) => t.props.uuid).sort() : [];
  assert(sameList(now, was), `the copy of production's header held ${was.length} tag nodes before the install, and after its import failed it holds ${now.length}${now.length < was.length ? ': a prune ran without its import' : ''} (ADR 0035 Decision 2: each prune runs after its import has resolved)`);
  const missed = OTHERS.filter((c) => !askedFor(out, c)).map((c) => c.slug);
  assert(!missed.length, `the install must carry on past the failure; the relay was never asked for ${missed.join(', ')}`);
});

test('E4: a dry run changes nothing, the reference the instance curates included', () => {
  const { w, out } = once('production-dry-run', () => [productionToday(), { installs: [{ resign: false, dryRun: true }] }]);
  const quiet = !out.calls.publishes.length && !out.calls.signs.length && !out.calls.relay.length;
  assert(quiet, `a dry run published ${out.calls.publishes.length}, signed ${out.calls.signs.length} and fetched ${out.calls.relay.length}`);
  const graphOf = (g) => JSON.stringify({ nodes: g.nodes, rels: g.rels });
  assert(graphOf(out.graph) === graphOf(w.graph), 'a dry run changed the graph: with the self-loops of production\'s own reference in it, a dry run must leave them (ADR 0035 Implementation notes §2: "Unless it\'s a dry run")');
  const listed = OTHERS.filter((c) => out.log.some((line) => line.includes(`(dry-run) ${c.slug} `)));
  assert(listed.length === OTHERS.length, `the dry run should still list each other reference (the step ran); it listed ${listed.map((c) => c.slug).join(', ') || 'none'}`);
});

test('E5: a REFERENCES {source:\'b-tag\'} on the instance\'s own header, from a b its owner authored that Pass 1\'s letter dropped, survives the install (ADR 0035 Decision 4)', () => {
  // The queued lost-b fault decides what a reinstall keeps of an owner's b. Until then the step must not erase its last
  // trace, so AC-1's "one REFERENCES" is read on headers whose owner authored no b of their own.
  const owners = `39998:${C.sha256('a concept the owner pointed the header at')}:elsewhere`;
  const c = OTHERS[0];
  const { out } = once('owner-b', () => {
    const w = stagingToday({ prodVersions: 3 });
    C.run(w.graph, `MATCH (h:NostrEvent {uuid: $h}) MERGE (x:NostrEvent {uuid: $x}) MERGE (h)-[r:REFERENCES]->(x) SET r.source = 'b-tag'`, { h: ownHeader(w.ta, c), x: owners });
    return [w, RESIGN];
  });
  const h = nodeAt(out, ownHeader(out.ta, c));
  const to = h ? C.relsOut(out.graph, h, 'REFERENCES').filter((r) => r.props && r.props.source === 'b-tag').map((r) => r.toNode && r.toNode.props.uuid).sort() : [];
  assert(to.includes(owners), `${C.short(ownHeader(out.ta, c))}'s REFERENCES to ${C.short(owners)}, from its owner's b, is gone: the step pruned an own header's b-derived relationships (it has [${to.map(C.short).join(', ')}])`);
  assert(to.filter((u) => u === c.headerATag).length === 1, `and the firmware's REFERENCES to ${C.short(c.headerATag)} is there once; it has [${to.map(C.short).join(', ')}]`);
});

/* ───────────── review round 1 (ADR 0035 Amendment 1) ───────────── */

const FIRMWARE_DIR = path.join(C.ROOT, 'firmware/active');
/** Seed-firmware's target under an assistant (src/firmware/target.js, a pure function of the files and `ta`). */
function targetUnder(ta) {
  const { buildTarget } = require(path.join(C.ROOT, 'src/firmware/target.js'));
  const t = buildTarget({ dir: FIRMWARE_DIR, ta });
  assert(!(t.problems || []).length, `buildTarget found problems with the firmware's files: ${brief(t.problems)}`);
  return t;
}
/** What a target gives a reference's header on the instance: its b tags, its b claims, and whether references lists the curator's header. */
function targetHeader(t, ta, c) {
  const address = ownHeader(ta, c);
  const n = t.nodes.find((x) => x.address === address);
  return {
    found: !!n,
    bs: n ? n.tags.filter((x) => x[0] === 'b') : [],
    claims: t.relationships.filter((r) => r.type === 'REFERENCES' && r.from === address && r.properties && r.properties.source === 'b-tag').map((r) => r.to),
    listed: (t.references || []).includes(c.headerATag),
  };
}
const keepsItsB = (h, c) => h.found && h.bs.length === 1 && h.bs[0][1] === c.headerATag && h.bs[0][2] === 'pointer' && sameList(h.claims, [c.headerATag]) && h.listed;

test('S11 (AC-3, Amendment 1 item 1): seed-firmware\'s target gives the reference its assistant curates no pointer b, no claim and no references entry, and each other reference\'s header its own', () => {
  const t = targetUnder(PROD);
  const self = targetHeader(t, PROD, SELF);
  assert(self.found, `seed-firmware's target has no node at ${C.short(ownHeader(PROD, SELF))}`);
  const found = [];
  if (self.bs.length) found.push(`its header carries ${C.short(brief(self.bs))}`);
  if (self.claims.length) found.push(`it claims REFERENCES {source:'b-tag'} to ${self.claims.map(C.short).join(', ')}`);
  if ((t.references || []).includes(SELF.headerATag)) found.push(`references lists ${C.short(SELF.headerATag)}, the instance's own header`);
  for (const c of OTHERS) if (!keepsItsB(targetHeader(t, PROD, c), c)) found.push(`${c.slug} lost what it keeps: ${C.short(brief(targetHeader(t, PROD, c)))}`);
  assert(!found.length, `seed-firmware's target under production's assistant (ADR 0035 Amendment 1 item 1):${list(found)}`);
  const ts = targetUnder(STAGING);
  const lost = CRS.filter((c) => !keepsItsB(targetHeader(ts, STAGING, c), c)).map((c) => c.slug);
  assert(!lost.length, `under an assistant that curates none of them, each of the six keeps its pointer b and claim; ${lost.join(', ')} don't`);
});

test('S12 (AC-3, Amendment 1 item 1): seed-firmware\'s oracle, today\'s routes run from their source, signs no b on the reference its assistant curates, and agrees with the target', async () => {
  const { todaysFirmware } = require(path.join(C.ROOT, 'test/helpers/todaysFirmwareRoutes.js'));
  const o = await todaysFirmware({ dir: FIRMWARE_DIR, ta: PROD });
  const t = targetUnder(PROD);
  const found = [];
  for (const c of CRS) {
    const l = o.letters.get(ownHeader(PROD, c));
    if (!l) { found.push(`${c.slug}: the oracle signs no letter at ${C.short(ownHeader(PROD, c))}`); continue; }
    const signed = l.tags.filter((x) => x[0] === 'b');
    const want = c === SELF ? [] : [['b', c.headerATag, 'pointer']];
    if (JSON.stringify(signed) !== JSON.stringify(want)) found.push(`${c.slug}: the oracle signs ${C.short(brief(signed))}; it should sign ${C.short(brief(want))}`);
    const given = targetHeader(t, PROD, c).bs;
    if (JSON.stringify(given) !== JSON.stringify(signed)) found.push(`${c.slug}: the target gives ${C.short(brief(given))}, the oracle signs ${C.short(brief(signed))}`);
  }
  assert(!found.length, `seed-firmware's oracle under production's assistant (ADR 0035 Amendment 1 item 1):${list(found)}`);
});

/** Why the instance's header for c doesn't have exactly one REFERENCES, {source:'b-tag'}, to the community header, or null. */
function keptItsClaim(out, c) {
  const h = nodeAt(out, ownHeader(out.ta, c));
  const refs = h ? C.relsOut(out.graph, h, 'REFERENCES').map((r) => ({ to: r.toNode && r.toNode.props.uuid, source: r.props && r.props.source })) : [];
  if (refs.length === 1 && refs[0].to === c.headerATag && refs[0].source === 'b-tag') return null;
  return `${C.short(ownHeader(out.ta, c))} has ${refs.length ? refs.map((r) => `REFERENCES {source:'${r.source}'} to ${C.short(r.to)}`).join(', ') : 'no REFERENCES'}; it should keep its one REFERENCES {source:'b-tag'}, to ${C.short(c.headerATag)}, and the wiring make no firmware-community stub of it (ADR 0035 Amendment 1 item 2)`;
}

test('E6 (Amendment 1 item 2): when a seeded header\'s prune fails, the header keeps its REFERENCES {source:\'b-tag\'}: the wiring makes no firmware-community stub of it', () => {
  const c = OTHERS[0];
  const { out } = once('seed-prune-fails', () => [stagingToday({ prodVersions: 3 }), { ...RESIGN, failPruneAt: ownHeader(STAGING, c) }]);
  assert(out.calls.failedPrunes.includes(ownHeader(STAGING, c)), `the child never failed the prune at ${C.short(ownHeader(STAGING, c))}: the path under test didn't run`);
  const why = keptItsClaim(out, c);
  assert(!why, why);
});

test('E7 (Amendment 1 item 2): the same on the "already has a b" path, which signs no header again', () => {
  const c = OTHERS[0];
  const { out } = once('has-b-prune-fails', () => [neverResigned(), { installs: [{ resign: false }], failPruneAt: ownHeader(STAGING, c) }]);
  assert(out.calls.failedPrunes.includes(ownHeader(STAGING, c)), `the child never failed the prune at ${C.short(ownHeader(STAGING, c))}: the path under test didn't run`);
  const why = keptItsClaim(out, c);
  assert(!why, why);
});

test('E8 (Amendment 1 item 2): when a seeded letter\'s import fails after its publish, the header gets no firmware-community stub either', () => {
  const c = OTHERS[0];
  const { out } = once('seed-import-fails', () => [stagingToday({ prodVersions: 3 }), { ...RESIGN, failImportAt: ownHeader(STAGING, c) }]);
  assert(out.calls.failedImports.includes(ownHeader(STAGING, c)), `the child never failed the import at ${C.short(ownHeader(STAGING, c))}: the path under test didn't run`);
  assert(out.calls.publishes.some((l) => C.addressOf(l) === ownHeader(STAGING, c) && l.tags.some((x) => x[0] === 'b' && x[1] === c.headerATag)), 'and the seeded letter, b included, was published first');
  const why = keptItsClaim(out, c);
  assert(!why, why);
});

/* ───────────── run ───────────── */

async function run() {
  console.log('\n=== a firmware install leaves each header\'s tags once (community-reference #39) ===');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\nfirmware-install-leaves-tags-once: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run, worlds: { stagingToday, productionToday, freshInstance, neverResigned, CRS, SELF, PROD, STAGING } };
