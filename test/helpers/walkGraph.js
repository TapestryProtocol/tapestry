'use strict';
/**
 * The graphs the walk suites seed for test/helpers/graphFake.js (story graph-operations-first-slice #14, ADR
 * graph-operations-first-slice/0014). TA and the owner are test/helpers/graphOpsSuite.js's unless given. Every node is
 * the assistant's unless its line says otherwise. The suites name nodes by the names below (seed.keys[name]).
 *
 * The class thread: header -IS_THE_CONCEPT_FOR-> superset; superset -IS_A_SUPERSET_OF-> set1 -IS_A_SUPERSET_OF-> set2
 * -IS_A_SUPERSET_OF-> set3; superset -HAS_ELEMENT-> elem1, set1 -HAS_ELEMENT-> elem2, set3 -HAS_ELEMENT-> elem3. And
 * elem3 -CITES-> header (back to the start), set2 -MENTIONS-> set2 (a loop), and three tag nodes: header's headerTagD
 * and headerTagName, and elem1's elem1TagD (HAS_TAG to each). CLASS_THREAD gives each node's steps from header:
 *   out along the class thread's three types: superset 1; set1, elem1 2; set2, elem2 3; set3 4; elem3 5
 * BOTH gives them with no types, both ways: superset and elem3 (by its CITES, in) 1; set1, elem1 and set3 (by its
 * HAS_ELEMENT to elem3, in) 2; set2 (out from set1, before in from set3) and elem2 3.
 *
 * The tie-break, with fixed keys so their order is known (TIE_KEYS): starts tie1 < tie2. Each pair below was made in
 * the order that puts the losing one first, so a walk that took the first relationship it met would pick wrong:
 *   shared   tie2 -LINKS-> shared, then tie1 -LINKS-> shared               (the start with the lesser key: tie1)
 *   far      tie1 -LINKS-> mid1 and mid2; mid2 -LINKS-> far, then mid1 -LINKS-> far   (the parent mid1)
 *   twin     tie1 -ZETA-> twin, then tie1 -ALPHA-> twin                     (the type ALPHA)
 *   inward   inward -INWARD-> tie1, then tie1 -OUTWARD-> inward              (out before in: OUTWARD)
 *   pair     tie1 -SAME-> pair twice, recording { n: 1 } and { n: 2 }       (one of them, the same each time)
 *
 * The point of view: pov0 -CITES-> povLo (a peer scored 0.01) -CITES-> povLoKid; povHi (0.2) -CITES-> povHiKid; povAnon
 * (no author); povNoUser (a pubkey with no NostrUser); povNoScore (a NostrUser with no influence); povOwned (the
 * owner's). And povStart (the peer scored 0.01) -CITES-> povStartKid.
 *
 * Tag nodes: tagged -HAS_TAG-> taggedD and taggedName; tagger -HAS_TAG-> taggerE, an `e` tag node, -REFERENCES-> tagged.
 *
 * The filter: filtered -CITES-> fine, and to three nodes no walk meets: nokey (no tapestryKey), legacy (keyed '{}', the
 * placeholder the codebase reads as no key) and entryLinked (a change entry). G is a change entry with no relationships.
 *
 * Depth: chain0 -NEXT-> chain1 -NEXT-> … -NEXT-> chain11. lonely has no relationships.
 *
 * Bulk: bulkHub -LINKS-> link1…link60, and each linkN -LINKS-> leafN: 60 nodes at 1 step and 60 at 2.
 *
 * The scores: hi 0.2, lo 0.01, noscore (no influence), the owner 1. With `unscored` no NostrUser has an influence.
 *
 * seedWalk(opts) → { state, keys: { <name>: tapestryKey }, uuids, eids, pubkeys, links, leaves, file(dir) }.
 * seedBound({ leaves }) → the same shape, for the bound: boundHub -LINKS-> boundMid -LINKS-> leaves nodes (10,000 by
 * default), so a walk from boundHub reads 1 relationship at its first step and `leaves` at its second.
 */

const path = require('path');
const crypto = require('crypto');
const { emptyState, writeState } = require('./graphFake');
const S = require('./graphOpsSuite');

const PEERS = Object.freeze({
  hi: '11'.repeat(32),
  lo: '22'.repeat(32),
  noscore: '33'.repeat(32),
  nouser: '44'.repeat(32),
  stranger: 'ef'.repeat(32),
});

/** A tapestryKey whose place in tapestryKey order is fixed by n. */
const fixedKey = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TIE_KEYS = Object.freeze({
  tie1: fixedKey(101), tie2: fixedKey(102),
  mid1: fixedKey(201), mid2: fixedKey(202),
  shared: fixedKey(301), twin: fixedKey(302), inward: fixedKey(303), pair: fixedKey(304),
  far: fixedKey(401),
});

/** The class thread's three types, as a walk along it names them. */
const THREAD_TYPES = Object.freeze(['IS_THE_CONCEPT_FOR', 'IS_A_SUPERSET_OF', 'HAS_ELEMENT']);
/** Steps from header, out along THREAD_TYPES. */
const CLASS_THREAD = Object.freeze({ superset: 1, set1: 2, elem1: 2, set2: 3, elem2: 3, set3: 4, elem3: 5 });
/** Steps from header, both ways with no types. */
const BOTH = Object.freeze({ superset: 1, elem3: 1, set1: 2, elem1: 2, set3: 2, set2: 3, elem2: 3 });

function builder(ta) {
  const s = emptyState();
  const keys = {};
  const uuids = {};
  const eids = {};
  const add = (name, labels, props, { keyed = true } = {}) => {
    const p = { ...props };
    if (keyed && p.tapestryKey === undefined) p.tapestryKey = TIE_KEYS[name] || crypto.randomUUID();
    const n = { eid: s.nextEid++, labels, props: p };
    s.nodes.push(n);
    if (name) {
      if (keyed && typeof p.tapestryKey === 'string') keys[name] = p.tapestryKey;
      if (p.uuid) uuids[name] = p.uuid;
      eids[name] = n.eid;
    }
    return n;
  };
  const link = (from, type, to, props = {}) => { const r = { eid: s.nextEid++, type, from: from.eid, to: to.eid, props }; s.rels.push(r); return r; };
  const item = (name, props = {}, opts) => add(name, ['NostrEvent', 'ListItem', 'TapestryNode'], { kind: 39999, uuid: `39999:${props.pubkey === undefined ? ta : props.pubkey}:${name}`, name, pubkey: ta, ...props }, opts);
  const tagNode = (name, type, value) => add(name, ['NostrEventTag', 'TapestryNode'], { type, value });
  return { s, keys, uuids, eids, add, link, item, tagNode };
}

function seedWalk({ owner = S.OWNER, admin = S.ADMIN, ta = S.TA, unscored = false } = {}) {
  const { s, keys, uuids, eids, add, link, item, tagNode } = builder(ta);
  const person = (pubkey, influence) => add(null, ['NostrUser', 'TapestryNode'], unscored || influence === undefined ? { pubkey } : { pubkey, influence });

  // ── the class thread ──
  const header = add('header', ['NostrEvent', 'ConceptHeader', 'TapestryNode'], { kind: 39998, uuid: `39998:${ta}:widget`, name: 'widget', pubkey: ta });
  const superset = add('superset', ['NostrEvent', 'Superset', 'TapestryNode'], { kind: 39999, uuid: `39999:${ta}:widgets`, name: 'widgets', pubkey: ta });
  const set = (name) => add(name, ['NostrEvent', 'Set', 'TapestryNode'], { kind: 39999, uuid: `39999:${ta}:${name}`, name, pubkey: ta });
  const set1 = set('set1');
  const set2 = set('set2');
  const set3 = set('set3');
  const elem1 = item('elem1');
  const elem2 = item('elem2');
  const elem3 = item('elem3');
  link(header, 'IS_THE_CONCEPT_FOR', superset);
  link(superset, 'IS_A_SUPERSET_OF', set1);
  link(set1, 'IS_A_SUPERSET_OF', set2);
  link(set2, 'IS_A_SUPERSET_OF', set3);
  link(superset, 'HAS_ELEMENT', elem1);
  link(set1, 'HAS_ELEMENT', elem2);
  link(set3, 'HAS_ELEMENT', elem3);
  link(elem3, 'CITES', header);
  link(set2, 'MENTIONS', set2);
  link(header, 'HAS_TAG', tagNode('headerTagD', 'd', 'widget'));
  link(header, 'HAS_TAG', tagNode('headerTagName', 'name', 'widget'));
  link(elem1, 'HAS_TAG', tagNode('elem1TagD', 'd', 'elem1'));

  // ── the tie-break ──
  const tie1 = item('tie1');
  const tie2 = item('tie2');
  const shared = item('shared');
  link(tie2, 'LINKS', shared);
  link(tie1, 'LINKS', shared);
  const mid1 = item('mid1');
  const mid2 = item('mid2');
  link(tie1, 'LINKS', mid1);
  link(tie1, 'LINKS', mid2);
  const far = item('far');
  link(mid2, 'LINKS', far);
  link(mid1, 'LINKS', far);
  const twin = item('twin');
  link(tie1, 'ZETA', twin);
  link(tie1, 'ALPHA', twin);
  const inward = item('inward');
  link(inward, 'INWARD', tie1);
  link(tie1, 'OUTWARD', inward);
  const pair = item('pair');
  link(tie1, 'SAME', pair, { n: 1 });
  link(tie1, 'SAME', pair, { n: 2 });

  // ── the point of view ──
  const pov0 = item('pov0');
  const povLo = item('povLo', { pubkey: PEERS.lo });
  link(pov0, 'CITES', povLo);
  link(povLo, 'CITES', item('povLoKid'));
  const povHi = item('povHi', { pubkey: PEERS.hi });
  link(pov0, 'CITES', povHi);
  link(povHi, 'CITES', item('povHiKid'));
  link(pov0, 'CITES', add('povAnon', ['ListItem', 'TapestryNode'], { name: 'povAnon' }));
  link(pov0, 'CITES', item('povNoUser', { pubkey: PEERS.nouser }));
  link(pov0, 'CITES', item('povNoScore', { pubkey: PEERS.noscore }));
  link(pov0, 'CITES', item('povOwned', { pubkey: owner }));
  const povStart = item('povStart', { pubkey: PEERS.lo });
  link(povStart, 'CITES', item('povStartKid'));

  // ── tag nodes ──
  const tagged = item('tagged');
  link(tagged, 'HAS_TAG', tagNode('taggedD', 'd', 'tagged'));
  link(tagged, 'HAS_TAG', tagNode('taggedName', 'name', 'tagged'));
  const tagger = item('tagger');
  const taggerE = tagNode('taggerE', 'e', 'tagged');
  link(tagger, 'HAS_TAG', taggerE);
  link(taggerE, 'REFERENCES', tagged);

  // ── the filter ──
  const filtered = item('filtered');
  link(filtered, 'CITES', item('fine'));
  link(filtered, 'CITES', item('nokey', {}, { keyed: false }));
  link(filtered, 'CITES', item('legacy', { tapestryKey: '{}' }, { keyed: false }));
  link(filtered, 'CITES', add('entryLinked', ['GraphChange', 'TapestryNode'], { at: '2026-01-01T00:00:00.000Z', byRole: 'owner', byPubkey: owner, operation: 'graph add-relationship', keys: [], changes: '[]' }));
  add('G', ['GraphChange', 'TapestryNode'], { at: '2026-01-01T00:00:00.000Z', byRole: 'owner', byPubkey: owner, operation: 'graph add-relationship', keys: [], changes: '[]' });

  // ── depth ──
  let prev = item('chain0');
  for (let i = 1; i <= 11; i++) { const next = item(`chain${i}`); link(prev, 'NEXT', next); prev = next; }
  item('lonely');

  // ── bulk ──
  const bulkHub = item('bulkHub');
  const links = [];
  const leaves = [];
  for (let i = 1; i <= 60; i++) {
    const l = item(`link${i}`);
    links.push(`link${i}`);
    link(bulkHub, 'LINKS', l);
    link(l, 'LINKS', item(`leaf${i}`));
    leaves.push(`leaf${i}`);
  }

  // ── the web of trust's scores ──
  person(PEERS.hi, 0.2);
  person(PEERS.lo, 0.01);
  person(PEERS.noscore);
  person(owner, 1);

  return {
    state: s,
    keys,
    uuids,
    eids,
    pubkeys: { ta, owner, admin, ...PEERS },
    links,
    leaves,
    /** Write the state to <dir>/graph.json and return its path. */
    file(dir) { const f = path.join(dir, 'graph.json'); writeState(f, s); return f; },
  };
}

function seedBound({ leaves = 10000, ta = S.TA, owner = S.OWNER } = {}) {
  const { s, keys, uuids, eids, add, link, item } = builder(ta);
  const boundHub = item('boundHub');
  const boundMid = item('boundMid');
  link(boundHub, 'LINKS', boundMid);
  for (let i = 1; i <= leaves; i++) link(boundMid, 'LINKS', add(null, ['ListItem', 'TapestryNode'], { tapestryKey: crypto.randomUUID(), name: `leaf ${i}`, pubkey: ta }));
  add(null, ['NostrUser', 'TapestryNode'], { pubkey: owner, influence: 1 });
  return {
    state: s,
    keys,
    uuids,
    eids,
    file(dir) { const f = path.join(dir, 'graph.json'); writeState(f, s); return f; },
  };
}

module.exports = { seedWalk, seedBound, PEERS, TIE_KEYS, THREAD_TYPES, CLASS_THREAD, BOTH, fixedKey };
