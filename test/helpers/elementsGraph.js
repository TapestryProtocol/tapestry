'use strict';
/**
 * The graph the list-elements suites seed for test/helpers/graphFake.js (story graph-operations-first-slice #11, ADR
 * graph-operations-first-slice/0011). It is shaped as today's routes make the class thread (BIBLE §6): a header points
 * to its superset (IS_THE_CONCEPT_FOR), a superset or a set to the sets below it (IS_A_SUPERSET_OF), and a superset or
 * a set to its elements (HAS_ELEMENT). TA is test/helpers/graphOpsSuite.js's; the owner is too, unless `owner` is given.
 *
 * dog (39998:<TA>:dog): header H, superset S, set W ("walkers") under S, set P ("puppies") under W. Its elements, by
 * the name the suites use, with where each hangs and who wrote it:
 *   rover    S        the assistant (TA), with an address
 *   bella    S and W  the assistant: two paths, one element
 *   spot     W        the owner
 *   pip      P        the assistant: two sets down
 *   ada      W        no author and no address: made here by an older path (ADR 0011, Context 4)
 *   named    W        the assistant; tapestryValue 'Named Dog' and name 'old name'
 *   unnamed  S        the assistant; neither a tapestryValue nor a name
 *   hi       W        a peer GrapeRank scores 0.2, above the default cutoff (0.05)
 *   lo       S        a peer scored 0.01, below it
 *   noscore  S        a peer whose NostrUser has no influence
 *   nouser   P        a peer with no NostrUser node at all
 *   admin    W        the admin, scored 0.01: an admin counts by score, like anyone (the story's question 2)
 *   nokey    S        the assistant, but no tapestryKey: never listed or counted
 * and three that aren't its elements: stray (its z tag names dog, but no HAS_ELEMENT reaches it: an implicit member),
 * loner (a node of no concept) and G (a change entry). cardSet is a trust-pipeline card set, as staging holds 370,377
 * of them: labelled Set and SetOfNostrUserWotMetricsCards, with a tapestryKey but no address and no class-thread links,
 * so no set (ADR graph-operations-first-slice/0011 Amendment 2, after ADR 0028 Amendment 3).
 *
 * The other concepts:
 *   mammal   header MH, superset MS with its own element whale; dog's superset S is under MS (a class link), so
 *            mammal's elements are whale and every element of dog
 *   cat      header CH labelled ListHeader only (one the nostr import brought in), superset CS, element tom
 *   empty    a header and a superset with no elements
 *   bare     a header with no superset
 *   bulk     header BH and superset BS with `bulk` elements (120 by default), all the assistant's, each directly under
 *            BS: enough for three pages of 50
 *   legacy   header LH and superset LS with two keyed elements, oldA and oldB, and two more from before the graph was
 *            migrated, keyed '{}', the placeholder the codebase reads as no key (ADR graph-operations-foundation/0003):
 *            neither is an element a read may list or count (story 11's review, Finding 1)
 *   edge     header EGH and superset EGS with one element, atCutoff, by a peer GrapeRank scores exactly 0.05, the default
 *            cutoff: not above it, so left out (the review's ask 5)
 *
 * The NostrUser nodes: hi 0.2, lo 0.01, noscore (no influence), admin 0.01, and the owner 1. With `unscored` none of
 * them has an influence, as before GrapeRank has run.
 *
 * seedElements(opts) → { state, keys: { <name>: tapestryKey }, uuids: { <name>: uuid }, pubkeys, names(...),
 * file(dir) }. `names(list)` maps names to tapestryKeys, sorted, so a suite can say which elements it expects.
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
  atCutoff: '55'.repeat(32),
  stranger: 'ef'.repeat(32),
});

/** The elements of dog, as the suites name them, for the expectations they compute. */
const DOG = Object.freeze({
  all: ['rover', 'bella', 'spot', 'pip', 'ada', 'named', 'unnamed', 'hi', 'lo', 'noscore', 'nouser', 'admin'],
  kept: ['rover', 'bella', 'spot', 'pip', 'ada', 'named', 'unnamed', 'hi'],
  leftOut: ['lo', 'noscore', 'nouser', 'admin'],
  own: ['rover', 'bella', 'spot', 'pip', 'ada', 'named', 'unnamed'],
  direct: ['rover', 'bella', 'unnamed', 'lo', 'noscore'],
  walkers: ['bella', 'spot', 'ada', 'named', 'hi', 'admin', 'pip', 'nouser'],
  walkersDirect: ['bella', 'spot', 'ada', 'named', 'hi', 'admin'],
});

function seedElements({ owner = S.OWNER, admin = S.ADMIN, ta = S.TA, unscored = false, bulk = 120 } = {}) {
  const s = emptyState();
  const keys = {};
  const uuids = {};
  const add = (name, labels, props, { keyed = true } = {}) => {
    const p = { ...props };
    if (keyed) p.tapestryKey = crypto.randomUUID();
    const n = { eid: s.nextEid++, labels, props: p };
    s.nodes.push(n);
    if (name) {
      if (keyed) keys[name] = p.tapestryKey;
      if (p.uuid) uuids[name] = p.uuid;
    }
    return n;
  };
  const link = (from, type, to) => { s.rels.push({ eid: s.nextEid++, type, from: from.eid, to: to.eid, props: {} }); };
  const header = (name, slug, labels = ['NostrEvent', 'ListHeader', 'ConceptHeader', 'TapestryNode']) =>
    add(name, labels, { uuid: `39998:${ta}:${slug}`, name: slug, pubkey: ta, kind: 39998 });
  const superset = (name, slug) => add(name, ['NostrEvent', 'ListItem', 'Superset', 'TapestryNode'], { uuid: `39999:${ta}:${slug}-superset`, name: `the superset of all ${slug}s`, pubkey: ta, kind: 39999 });
  const item = (name, props, opts) => add(name, ['NostrEvent', 'ListItem', 'TapestryNode'], { kind: 39999, ...props }, opts);

  // ── dog ──
  const H = header('H', 'dog');
  const Sd = superset('S', 'dog');
  const W = add('W', ['Set', 'TapestryNode'], { uuid: `39999:${ta}:walkers`, name: 'walkers', pubkey: ta });
  const P = add('P', ['Set', 'TapestryNode'], { uuid: `39999:${ta}:puppies`, name: 'puppies', pubkey: ta });
  link(H, 'IS_THE_CONCEPT_FOR', Sd);
  link(Sd, 'IS_A_SUPERSET_OF', W);
  link(W, 'IS_A_SUPERSET_OF', P);
  const under = (holder, node) => link(holder, 'HAS_ELEMENT', node);
  under(Sd, item('rover', { uuid: `39999:${ta}:rover`, name: 'rover', pubkey: ta }));
  const bella = item('bella', { uuid: `39999:${ta}:bella`, name: 'bella', pubkey: ta });
  under(Sd, bella);
  under(W, bella);
  under(W, item('spot', { uuid: `39999:${owner}:spot`, name: 'spot', pubkey: owner }));
  under(P, item('pip', { uuid: `39999:${ta}:pip`, name: 'pip', pubkey: ta }));
  under(W, add('ada', ['ListItem', 'TapestryNode'], { name: 'ada' }));
  under(W, item('named', { uuid: `39999:${ta}:named`, tapestryValue: 'Named Dog', name: 'old name', pubkey: ta }));
  under(Sd, item('unnamed', { uuid: `39999:${ta}:unnamed`, pubkey: ta }));
  under(W, item('hi', { uuid: `39999:${PEERS.hi}:hi`, name: 'hi', pubkey: PEERS.hi }));
  under(Sd, item('lo', { uuid: `39999:${PEERS.lo}:lo`, name: 'lo', pubkey: PEERS.lo }));
  under(Sd, item('noscore', { uuid: `39999:${PEERS.noscore}:noscore`, name: 'noscore', pubkey: PEERS.noscore }));
  under(P, item('nouser', { uuid: `39999:${PEERS.nouser}:nouser`, name: 'nouser', pubkey: PEERS.nouser }));
  under(W, item('admin', { uuid: `39999:${admin}:admin`, name: 'admin', pubkey: admin }));
  under(Sd, item('nokey', { uuid: `39999:${ta}:nokey`, name: 'nokey', pubkey: ta }, { keyed: false }));
  const stray = item('stray', { uuid: `39999:${ta}:stray`, name: 'stray', pubkey: ta });
  const z = add(null, ['NostrEventTag', 'TapestryNode'], { type: 'z', value: `39998:${ta}:dog` });
  link(stray, 'HAS_TAG', z);
  item('loner', { uuid: `39999:${ta}:loner`, name: 'loner', pubkey: ta });
  add('G', ['GraphChange', 'TapestryNode'], { at: '2026-01-01T00:00:00.000Z', byRole: 'owner', byPubkey: owner, operation: 'graph add-relationship', keys: [], changes: '[]' });
  add('cardSet', ['Set', 'SetOfNostrUserWotMetricsCards', 'TapestryNode'], { observee_pubkey: PEERS.hi });

  // ── mammal, with dog's superset under its own ──
  const MH = header('MH', 'mammal');
  const MS = superset('MS', 'mammal');
  link(MH, 'IS_THE_CONCEPT_FOR', MS);
  link(MS, 'IS_A_SUPERSET_OF', Sd);
  under(MS, item('whale', { uuid: `39999:${ta}:whale`, name: 'whale', pubkey: ta }));

  // ── cat, as the nostr import brings a concept in: ListHeader only ──
  const CH = header('CH', 'cat', ['NostrEvent', 'ListHeader', 'TapestryNode']);
  const CS = superset('CS', 'cat');
  link(CH, 'IS_THE_CONCEPT_FOR', CS);
  under(CS, item('tom', { uuid: `39999:${ta}:tom`, name: 'tom', pubkey: ta }));

  // ── empty, and bare ──
  const EH = header('EH', 'empty');
  const ES = superset('ES', 'empty');
  link(EH, 'IS_THE_CONCEPT_FOR', ES);
  header('BRH', 'bare');

  // ── bulk: three pages of 50 ──
  const BH = header('BH', 'bulk');
  const BS = superset('BS', 'bulk');
  link(BH, 'IS_THE_CONCEPT_FOR', BS);
  const bulkNames = [];
  for (let i = 1; i <= bulk; i++) {
    const name = `item${i}`;
    bulkNames.push(name);
    under(BS, item(name, { uuid: `39999:${ta}:${name}`, name: `item ${i}`, pubkey: ta }));
  }

  // ── legacy: two elements keyed '{}', from before the graph was migrated ──
  const LH = header('LH', 'legacy');
  const LS = superset('LS', 'legacy');
  link(LH, 'IS_THE_CONCEPT_FOR', LS);
  under(LS, item('oldA', { uuid: `39999:${ta}:old-a`, name: 'old a', pubkey: ta }));
  under(LS, item('oldB', { uuid: `39999:${ta}:old-b`, name: 'old b', pubkey: ta }));
  for (const name of ['oldC', 'oldD']) {
    under(LS, add(null, ['NostrEvent', 'ListItem', 'TapestryNode'], { kind: 39999, uuid: `39999:${ta}:${name.toLowerCase()}`, name, pubkey: ta, tapestryKey: '{}' }, { keyed: false }));
  }

  // ── edge: one element by a peer scored exactly at the default cutoff ──
  const EGH = header('EGH', 'edge');
  const EGS = superset('EGS', 'edge');
  link(EGH, 'IS_THE_CONCEPT_FOR', EGS);
  under(EGS, item('atCutoff', { uuid: `39999:${PEERS.atCutoff}:at-cutoff`, name: 'at cutoff', pubkey: PEERS.atCutoff }));

  // ── the web of trust's scores ──
  const user = (pubkey, influence) => add(null, ['NostrUser', 'TapestryNode'], unscored || influence === undefined ? { pubkey } : { pubkey, influence });
  user(PEERS.atCutoff, 0.05);
  user(PEERS.hi, 0.2);
  user(PEERS.lo, 0.01);
  user(PEERS.noscore);
  user(admin, 0.01);
  user(owner, 1);

  const names = (list) => list.map((n) => {
    if (!keys[n]) throw new Error(`elementsGraph: no node named ${n}`);
    return keys[n];
  }).sort();

  return {
    state: s,
    keys,
    uuids,
    pubkeys: { ta, owner, admin, ...PEERS },
    bulkNames,
    names,
    /** Write the state to <dir>/graph.json and return its path. */
    file(dir) { const f = path.join(dir, 'graph.json'); writeState(f, s); return f; },
  };
}

module.exports = { seedElements, DOG, PEERS };
