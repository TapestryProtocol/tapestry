'use strict';
/**
 * The graph the list-relationships suites seed for test/helpers/graphFake.js (story graph-operations-first-slice #13,
 * ADR graph-operations-first-slice/0013). TA and the owner are test/helpers/graphOpsSuite.js's unless given.
 *
 * hub (the assistant's) has these relationships, by the name the suites give the node at the other end:
 *   out  CITES       citedTa (the assistant), citedOwner (the owner), citedHi (a peer scored 0.2), citedLo (0.01),
 *                    citedNoscore (a NostrUser with no influence), citedNouser (no NostrUser at all), citedAnon (no
 *                    author and no address), nokey (no tapestryKey) and legacy (keyed '{}', the placeholder the codebase
 *                    reads as no key): the last two are never listed or counted
 *        DEPENDS_ON  dependency (the assistant)
 *        MENTIONS    hub itself: a relationship from the node to itself
 *        HAS_TAG     tagD, tagName, tagZ: hub's tag nodes (NostrEventTag, no name)
 *   in   HAS_ELEMENT holder, a set (the assistant's)
 *        CITES       citer (the peer scored 0.01)
 *        DEPENDS_ON  dependent (the assistant)
 *        REFERENCES  otherTag, the `e` tag node of another event, other (the assistant's), that names hub
 * So, from the owner's point of view with no type: kept 8 (citedTa, citedOwner, citedHi, citedAnon, dependency, the
 * loop, holder, dependent), left out 4 (citedLo, citedNoscore, citedNouser, citer), and 4 to tag nodes (HUB below).
 *
 * The people, NostrUser nodes keyed by their own pubkey: alice (0.2) has three TAGS to bob (0.2) that differ only in
 * what each records (its tag, its address, its event and its createdAt, an integer), and a FOLLOWS to bob with a
 * timestamp (an integer); carol (0.3) has a TAGS to alice.
 *
 * bulk: bulkHub has 70 LINKS out, to linkTargets (link1…link70), and 60 CITES in, from citeSources (cite1…cite60), all
 * the assistant's: pages of 50 are 50 out, then 20 out and 30 in, then the last 30 in.
 *
 * And: empty (no relationships), tagsOnly (two HAS_TAG to tag nodes, nothing else), G (a change entry), and the scores:
 * hi 0.2, lo 0.01, noscore (no influence), the owner 1, alice 0.2, bob 0.2, carol 0.3. With `unscored` no NostrUser has
 * an influence, as before GrapeRank has run.
 *
 * seedRelationships(opts) → { state, keys: { <name>: tapestryKey }, uuids, pubkeys, eids, file(dir) }. `eids` maps a
 * name to the fake's eid, for suites that change the graph between runs.
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
  alice: '66'.repeat(32),
  bob: '77'.repeat(32),
  carol: '88'.repeat(32),
  stranger: 'ef'.repeat(32),
});

/** hub's relationships, by the name of the node at the other end, for the expectations the suites compute. */
const HUB = Object.freeze({
  out: [
    ['CITES', 'citedTa'], ['CITES', 'citedOwner'], ['CITES', 'citedHi'], ['CITES', 'citedLo'], ['CITES', 'citedNoscore'],
    ['CITES', 'citedNouser'], ['CITES', 'citedAnon'], ['DEPENDS_ON', 'dependency'], ['MENTIONS', 'hub'],
  ],
  in: [['HAS_ELEMENT', 'holder'], ['CITES', 'citer'], ['DEPENDS_ON', 'dependent']],
  tagsOut: [['HAS_TAG', 'tagD'], ['HAS_TAG', 'tagName'], ['HAS_TAG', 'tagZ']],
  tagsIn: [['REFERENCES', 'otherTag']],
  leftOut: ['citedLo', 'citedNoscore', 'citedNouser', 'citer'],
});

/** alice's three TAGS to bob: what each records, by its tag. */
const ALICE_TAGS = Object.freeze([
  { tagSlug: 'developer', polarity: 'positive', created: '1789656766' },
  { tagSlug: 'nostr', polarity: 'positive', created: '1789656800' },
  { tagSlug: 'artist', polarity: 'negative', created: '1789656900' },
]);
const FOLLOWED_AT = '1700000000';

function seedRelationships({ owner = S.OWNER, admin = S.ADMIN, ta = S.TA, unscored = false, bulkOut = 70, bulkIn = 60 } = {}) {
  const s = emptyState();
  const keys = {};
  const uuids = {};
  const eids = {};
  const add = (name, labels, props, { keyed = true } = {}) => {
    const p = { ...props };
    if (keyed && p.tapestryKey === undefined) p.tapestryKey = crypto.randomUUID();
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
  const item = (name, props, opts) => add(name, ['NostrEvent', 'ListItem', 'TapestryNode'], { kind: 39999, ...props }, opts);
  const tagNode = (name, type, value) => add(name, ['NostrEventTag', 'TapestryNode'], { type, value });
  const person = (name, pubkey, influence) => add(name, ['NostrUser', 'TapestryNode'], unscored || influence === undefined ? { pubkey } : { pubkey, influence });

  // ── hub ──
  const hub = item('hub', { uuid: `39999:${ta}:hub`, name: 'hub', pubkey: ta });
  const cited = (name, pubkey, extra = {}) => link(hub, 'CITES', item(name, { uuid: pubkey ? `39999:${pubkey}:${name}` : undefined, name, pubkey, ...extra }));
  cited('citedTa', ta);
  cited('citedOwner', owner);
  cited('citedHi', PEERS.hi);
  cited('citedLo', PEERS.lo);
  cited('citedNoscore', PEERS.noscore);
  cited('citedNouser', PEERS.nouser);
  link(hub, 'CITES', add('citedAnon', ['ListItem', 'TapestryNode'], { name: 'citedAnon' }));
  link(hub, 'CITES', item('nokey', { uuid: `39999:${ta}:nokey`, name: 'nokey', pubkey: ta }, { keyed: false }));
  link(hub, 'CITES', item('legacy', { uuid: `39999:${ta}:legacy`, name: 'legacy', pubkey: ta, tapestryKey: '{}' }, { keyed: false }));
  link(hub, 'DEPENDS_ON', item('dependency', { uuid: `39999:${ta}:dependency`, name: 'dependency', pubkey: ta }));
  link(hub, 'MENTIONS', hub);
  link(hub, 'HAS_TAG', tagNode('tagD', 'd', 'hub'));
  link(hub, 'HAS_TAG', tagNode('tagName', 'name', 'hub'));
  link(hub, 'HAS_TAG', tagNode('tagZ', 'z', `39998:${ta}:thing`));
  link(add('holder', ['Set', 'TapestryNode'], { uuid: `39999:${ta}:things`, name: 'things', pubkey: ta }), 'HAS_ELEMENT', hub);
  link(item('citer', { uuid: `39999:${PEERS.lo}:citer`, name: 'citer', pubkey: PEERS.lo }), 'CITES', hub);
  link(item('dependent', { uuid: `39999:${ta}:dependent`, name: 'dependent', pubkey: ta }), 'DEPENDS_ON', hub);
  const other = item('other', { uuid: `39999:${ta}:other`, name: 'other', pubkey: ta });
  const otherTag = tagNode('otherTag', 'e', 'hub');
  link(other, 'HAS_TAG', otherTag);
  link(otherTag, 'REFERENCES', hub);

  // ── the people ──
  const alice = person('alice', PEERS.alice, 0.2);
  const bob = person('bob', PEERS.bob, 0.2);
  const carol = person('carol', PEERS.carol, 0.3);
  ALICE_TAGS.forEach((t, i) => link(alice, 'TAGS', bob, {
    tagSlug: t.tagSlug,
    polarity: t.polarity,
    address: `39999:${PEERS.alice}:tagging-${i + 1}`,
    eventId: String(i + 1).repeat(64).slice(0, 64),
    createdAt: { $int: t.created },
  }));
  link(alice, 'FOLLOWS', bob, { timestamp: { $int: FOLLOWED_AT } });
  link(carol, 'TAGS', alice, { tagSlug: 'friend', polarity: 'positive', address: `39999:${PEERS.carol}:tagging-1`, eventId: 'c'.repeat(64), createdAt: { $int: '1789657000' } });

  // ── bulk ──
  const bulkHub = item('bulkHub', { uuid: `39999:${ta}:bulk-hub`, name: 'bulk hub', pubkey: ta });
  const linkTargets = [];
  for (let i = 1; i <= bulkOut; i++) {
    const name = `link${i}`;
    linkTargets.push(name);
    link(bulkHub, 'LINKS', item(name, { uuid: `39999:${ta}:${name}`, name, pubkey: ta }));
  }
  const citeSources = [];
  for (let i = 1; i <= bulkIn; i++) {
    const name = `cite${i}`;
    citeSources.push(name);
    link(item(name, { uuid: `39999:${ta}:${name}`, name, pubkey: ta }), 'CITES', bulkHub);
  }

  // ── the rest ──
  item('empty', { uuid: `39999:${ta}:empty`, name: 'empty', pubkey: ta });
  const tagsOnly = item('tagsOnly', { uuid: `39999:${ta}:tags-only`, name: 'tags only', pubkey: ta });
  link(tagsOnly, 'HAS_TAG', tagNode('onlyD', 'd', 'tags-only'));
  link(tagsOnly, 'HAS_TAG', tagNode('onlyName', 'name', 'tags only'));
  add('G', ['GraphChange', 'TapestryNode'], { at: '2026-01-01T00:00:00.000Z', byRole: 'owner', byPubkey: owner, operation: 'graph add-relationship', keys: [], changes: '[]' });

  // ── the web of trust's scores ──
  person(null, PEERS.hi, 0.2);
  person(null, PEERS.lo, 0.01);
  person(null, PEERS.noscore);
  person(null, owner, 1);

  return {
    state: s,
    keys,
    uuids,
    eids,
    pubkeys: { ta, owner, admin, ...PEERS },
    linkTargets,
    citeSources,
    /** Write the state to <dir>/graph.json and return its path. */
    file(dir) { const f = path.join(dir, 'graph.json'); writeState(f, s); return f; },
  };
}

module.exports = { seedRelationships, HUB, PEERS, ALICE_TAGS, FOLLOWED_AT };
