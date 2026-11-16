'use strict';
/**
 * graph unlink-set — its own suite (ADR graph-operations-foundation/0001 Decision 12), run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/28-link-set-and-unlink-set.md (AC4–AC6, AC8)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0028-link-set-and-unlink-set.md (Decisions 1, 4–7,
 *          10)
 *
 * Stack-free: the real catalog, over test/helpers/classThreadSeed.js's unlinkSetGraph() (its header draws it), through
 * test/helpers/operationsHarness.js with the spy on. One harness run sends the requests below in turn, then the
 * commands; a second one sweeps every link the shipped firmware's definition makes (firmwareSweepGraph()). Each test's
 * sets are its own, so one answer can't change another test's starting point.
 *
 *   UL1  the owner unlinks a set from one of its two parents: the link is gone, the set stays under the other, and the
 *        parent's concept no longer reaches its element; unlinked, letters [], the change entry
 *   UL2  graph history finds the entry by the parent and by the set
 *   UL3  the same call again changes nothing, records nothing, and answers already-unlinked with letters [] and
 *        change: null
 *   UL4  no link from that parent is already-unlinked, not last-parent: a set under no parent at all (its would-be s tag
 *        still naming that parent), and a set under another parent
 *   UL5  two copies of the link, as an older path could make, are both taken out, with a count of 2
 *   UL6  the instance's own lettered set reports its letter, which still names the parent: the TA's, and the owner's
 *   UL7  an event-less set whose would-be s tag names the parent reports no letter
 *   UL8  the set's last parent is refused last-parent, by set-has-a-parent, naming the parent and how to go on; nothing
 *        changes
 *   UL9  a concept's superset may be unlinked from its last parent: its concept is no longer a kind of the other, and it
 *        stays its concept's superset
 *   UL10 unknown-node, not-a-set and not-a-parent, as link-set refuses them; nothing changes
 *   UL11 a firmware link is refused firmware-link, naming the part of firmware's definition that makes it and
 *        seed-firmware: a set file (a), existing-sets (b), a concept manifest (c), a community reference (d); it stays
 *   UL12 every class-thread link the shipped firmware's definition makes is refused firmware-link, naming its part, and
 *        every shipped existing-sets category resolves to a firmware concept (a sweep over firmware/active)
 *   UL13 the owner's own link between two firmware sets isn't firmware's, and is unlinked
 *   UL14 a peer's lettered set under the parent its event names is refused peer-link, naming the author; the owner's own
 *        link to that same set is unlinked
 *   UL15 an admin's call is recorded as the admin's
 *   UL16 nothing is signed; a visitor gets 401 and a stranger 403 and neither unlinks anything; the command unlinks that
 *        pair afterwards, recorded as the command's, and its refusal matches the route's
 *   UL17 it is listed for an admin with its guard, repeatKey, inputs and refusals, and has its /docs entry
 *   UL18 an unlink leaves the set's own properties as they were, unlinked or refused after its lock: the lock it takes
 *        first (ADR 0028 Amendment 2; Amendment 3, item 1) leaves nothing behind. The refused call is refused inside
 *        apply, not by the guard, and its rolled-back transaction shows it took the lock before it refused
 *   UL19 a trust-pipeline card set, labelled Set but with no address, is refused not-a-set, named as a node with no
 *        address (Amendment 3), even one a link puts under a set; nothing changes
 *   UL20 a card set as the parent is refused not-a-parent, named the same way; nothing changes
 *   UL21 a card set doesn't count as a parent: a set whose only other incoming link is from one is refused last-parent
 *        when unlinked from its one real parent, which it stays under
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const CT = require('../../helpers/classThreadSeed');

const { ROOT, OWNER, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph unlink-set');

const ROUTE = '/api/tapestry/graph/unlink-set';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/unlink-set.js');
const MISSING = 'src/operations/catalog/graph/unlink-set.js does not exist yet (ADR graph-operations-first-slice/0028 Decision 1)';
const RULE = 'set-has-a-parent';
const PROP = CT.PROP;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const F = 'fw:nostr-relay/superset';
const OBM = 'fw:nostr-relay/sets/organization-by-monetization';
const FREE = 'fw:nostr-relay/sets/free-relays';
const PROFILE = 'fw:nostr-relay/sets/profile-relays';

/**
 * What a firmware-link refusal must name for each part of firmware's definition (ADR Decision 6's table): its own part,
 * and none of the others, so a message that lists every part names none. (a) is the set file's name.
 */
const PART = {
  a: { says: (m, l) => m.includes(l.file), what: (l) => `the set file ${l.file}`, not: /existing-sets|community.?reference/i },
  b: { says: (m) => /existing-sets/.test(m), what: () => 'existing-sets', not: /community.?reference/i },
  c: { says: (m) => /manifest/i.test(m), what: (l) => `the concept manifest ${l.file}`, not: /existing-sets|community.?reference/i },
  d: { says: (m) => /community.?reference/i.test(m), what: () => 'the community reference', not: /existing-sets/ },
};
/** Every way `message` fails to name part `l.part` and seed-firmware, as sentences. */
function partProblems(message, l) {
  const m = String(message);
  const p = PART[l.part];
  const problems = [];
  if (!p.says(m, l)) problems.push(`it doesn't name ${p.what(l)}`);
  if (p.not.test(m)) problems.push(`it names another part too (${p.not})`);
  if (!/seed-firmware/.test(m)) problems.push('it doesn\'t name lifecycle seed-firmware');
  return problems;
}

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  const dir = tmp('unlink-set-');
  const g = CT.unlinkSetGraph();
  const file = g.file(dir);
  const k = g.keys;
  const nobody = crypto.randomUUID();
  const post = (id, caller, set, parent) => ({ id, method: 'POST', url: ROUTE, caller, body: { set, parent } });
  const history = (id, node) => ({ id, method: 'GET', url: `/api/tapestry/graph/history?node=${node}&limit=200`, caller: 'owner' });
  const r = S.runHarness({
    spy: true,
    scenarios: [{
      graphFake: { stateFile: file },
      requests: [
        post('ul1-unlink', 'owner', k.Hounds, k['Indoor pets']),
        history('ul2-by-parent', k['Indoor pets']),
        history('ul2-by-set', k.Hounds),
        post('ul3-again', 'owner', k.Hounds, k['Indoor pets']),
        post('ul4-under-no-parent', 'owner', k.Strays, k.Pets),
        post('ul4-under-another', 'owner', k['Outdoor pets'], k.Canines),
        post('ul5-two-copies', 'owner', k.Puppies, k['Indoor pets']),
        post('ul6-ta-letter', 'owner', k.Tabbies, k.Felines),
        post('ul6-owner-letter', 'owner', k.Calicos, k.Felines),
        post('ul7-event-less', 'owner', k.Ferals, k.Felines),
        post('ul8-last-parent', 'owner', k.Siamese, k.Felines),
        post('ul9-superset', 'owner', k.Wolves, k['Pack animals']),
        post('ul10-set', 'owner', nobody, k.Pets),
        post('ul10-parent', 'owner', k['Outdoor pets'], nobody),
        post('ul10-entry', 'owner', k['Outdoor pets'], k.G),
        post('ul10-element-set', 'owner', k.Rex, k.Hounds),
        post('ul10-header-set', 'owner', k.feline, k.Pets),
        post('ul10-element-parent', 'owner', k['Outdoor pets'], k.Rex),
        post('ul10-header-parent', 'owner', k['Outdoor pets'], k.feline),
        post('ul11-a', 'owner', k[OBM], k[F]),
        post('ul11-b', 'owner', k['fw:superset/superset'], k['fw:set/superset']),
        post('ul11-c', 'owner', k[FREE], k[OBM]),
        post('ul11-d', 'owner', k['fw:tag/community'], k['fw:tag/superset']),
        post('ul13-between-firmware-sets', 'owner', k[FREE], k[PROFILE]),
        post('ul14-peer', 'owner', k.Songbirds, k.Birds),
        post('ul14-owner-link-to-it', 'owner', k.Songbirds, k['Garden visitors']),
        post('ul15-admin', 'admin', k.Persians, k['Indoor pets']),
        post('ul16-visitor', 'visitor', k['Maine coons'], k['Outdoor pets']),
        post('ul16-stranger', 'stranger', k['Maine coons'], k['Outdoor pets']),
        post('ul18-refused-after-the-lock', 'owner', k['Lock probe'], k.Pets),
        post('ul19-card-set', 'owner', k['Card set A'], k.Pets),
        post('ul20-card-set-as-parent', 'owner', k['Lap cats'], k['Card set B']),
        post('ul21-a-card-set-is-no-parent', 'owner', k['House cats'], k.Felines),
        { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
      ],
      cli: [
        { id: 'ul16-cli', argv: ['graph', 'unlink-set', '--set', k['Maine coons'], '--parent', k['Outdoor pets']] },
        { id: 'ul16-refused', argv: ['graph', 'unlink-set', '--set', k.Siamese, '--parent', k.Felines] },
      ],
    }],
  }, { dir });
  MAIN = { r, a: S.answered(r), g, file, k, nobody };
  return MAIN;
}

let SWEEP = null;
function sweep() {
  if (SWEEP) return SWEEP;
  const dir = tmp('unlink-set-sweep-');
  const g = CT.firmwareSweepGraph();
  const file = g.file(dir);
  const requests = g.links.map((l, i) => ({ id: `sweep-${i}`, method: 'POST', url: ROUTE, caller: 'owner', body: { set: g.keys[l.set], parent: g.keys[l.parent] } }));
  const r = S.runHarness({ scenarios: [{ graphFake: { stateFile: file }, requests }] }, { dir });
  SWEEP = { r, a: S.answered(r), g, file, links: g.links };
  return SWEEP;
}

const graph = () => S.readState(main().file);
const before = () => main().g.state;
const name = (key) => main().g.names[key];
const links = (from, to) => CT.relsBetween(graph(), from, to);
const entriesFor = (from, to) => CT.entriesNaming(graph(), from, to);

function said(x) {
  if (typeof x.body === 'string') { const m = x.body.match(/Cannot \w+ [^<\n]+/); return m ? m[0] : x.body.slice(0, 120); }
  return show(x.body).slice(0, 300);
}
function needDecl(what) {
  if (!fs.existsSync(DECL)) throw new Error(`${MISSING}${what ? `: ${what}` : ''}`);
}
function answer(id, from = main) {
  const x = from().a.req(id);
  needDecl(`${id} answered ${x.status} ${said(x)}`);
  return x;
}
function ok(id) {
  const x = answer(id);
  assert(x.status === 200 && x.body && x.body.success === true, `${id} must answer 200; got ${x.status} ${said(x)}`);
  return x.body.data;
}
function refused(id, status, code) {
  const x = answer(id);
  assert(x.status === status && x.body && x.body.code === code, `${id}: ${status} ${code}; got ${x.status} ${said(x)}`);
  assert(typeof x.body.error === 'string' && x.body.error.trim(), `${id}: the refusal says in words what was wrong; got ${show(x.body)}`);
  return x.body;
}
function command(id) {
  const c = main().a.cmd(id);
  needDecl(`the command exited ${c.code}: ${String(c.stderr || '').trim().split('\n')[0]}`);
  return c;
}
const canon = (x) => JSON.stringify(x, (key, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((n) => [n, v[n]])) : v));
const same = (a, b) => canon(a) === canon(b);
const names = (text, key) => String(text).includes(key) || String(text).includes(name(key));
const linkOf = (d) => d && d.link && Object.keys(d.link).length === 2 ? d.link : null;

test('UL1: the owner unlinks a set from one of its two parents: gone, the set stays under the other, the parent\'s concept no longer reaches its element', () => {
  const { k } = main();
  const d = ok('ul1-unlink');
  assert(d.outcome === 'unlinked', `outcome unlinked; got ${show(d)}`);
  assert(same(linkOf(d), { set: k.Hounds, parent: k['Indoor pets'] }), `it answers the link, { set, parent }; got ${show(d.link)}`);
  assert(Array.isArray(d.letters) && d.letters.length === 0, `an event-less set has no letter to report; got ${show(d.letters)}`);
  const c = d.change;
  assert(c && UUID.test(c.id) && ISO.test(c.at), `it answers its change entry; got ${show(c)}`);
  assert(same(c.by, { role: 'owner', pubkey: OWNER }) && c.operation === 'graph unlink-set', `the entry is the owner's, through graph unlink-set; got ${show(c)}`);
  assert(same(c.changes, [{ change: 'set-unlinked', type: PROP, from: k['Indoor pets'], to: k.Hounds }]), `the entry says what changed, with no count for one copy; got ${show(c.changes)}`);
  assert(links(k['Indoor pets'], k.Hounds) === 0, 'the link from Indoor pets to Hounds is gone');
  assert(links(k.Canines, k.Hounds) === 1, 'Hounds is still under Canines');
  assert(CT.elementsOf(before(), k.pet).includes(k.Rex), '(the seed: pet reached Rex, through Indoor pets and Hounds)');
  assert(!CT.elementsOf(graph(), k.pet).includes(k.Rex), `pet no longer reaches Rex; it reaches ${show(CT.elementsOf(graph(), k.pet).map(name))}`);
  assert(CT.elementsOf(graph(), k.canine).includes(k.Rex), 'canine still does');
  const kept = S.entriesOf(graph()).filter((e) => e.tapestryKey === c.id);
  assert(kept.length === 1 && same([...kept[0].keys].sort(), [k['Indoor pets'], k.Hounds].sort()), `the entry is kept, keyed by the parent and the set; got ${show(kept)}`);
});

test('UL2: graph history finds the entry by the parent and by the set', () => {
  const d = ok('ul1-unlink');
  for (const id of ['ul2-by-parent', 'ul2-by-set']) {
    const h = main().a.req(id);
    assert(h.status === 200 && h.body.success, `${id}: history answers; got ${h.status} ${said(h)}`);
    const found = h.body.data.entries.filter((e) => e.id === d.change.id);
    assert(found.length === 1 && found[0].operation === 'graph unlink-set', `${id}: history finds UL1's entry; got ${show(h.body.data.entries.map((e) => e.operation))}`);
  }
});

test('UL3: the same call again changes nothing, records nothing, and answers already-unlinked with letters [] and change: null', () => {
  const { k } = main();
  const d = ok('ul3-again');
  assert(d.outcome === 'already-unlinked' && d.change === null, `already-unlinked, change null; got ${show(d)}`);
  assert(Array.isArray(d.letters) && d.letters.length === 0, `letters: []; got ${show(d.letters)}`);
  assert(same(linkOf(d), { set: k.Hounds, parent: k['Indoor pets'] }), `it answers the link; got ${show(d.link)}`);
  assert(entriesFor(k['Indoor pets'], k.Hounds).length === 1, `one entry for the unlink, not two; got ${entriesFor(k['Indoor pets'], k.Hounds).length}`);
});

test('UL4: no link from that parent is already-unlinked, not last-parent: a set under no parent at all, and one under another parent', () => {
  const { k } = main();
  for (const [id, set, parent] of [['ul4-under-no-parent', 'Strays', 'Pets'], ['ul4-under-another', 'Outdoor pets', 'Canines']]) {
    const d = ok(id);
    assert(d.outcome === 'already-unlinked' && d.change === null && Array.isArray(d.letters) && d.letters.length === 0, `${set} from ${parent}: already-unlinked, letters [], change null; got ${show(d)}`);
    assert(entriesFor(k[parent], k[set]).length === 0, `${id}: nothing recorded`);
  }
  assert(CT.parentsOf(graph(), k.Strays).length === 0 && links(k.Pets, k['Outdoor pets']) === 1, 'Strays is still under no parent, and Outdoor pets still under Pets');
});

test('UL5: two copies of the link, as an older path could make, are both taken out, with a count of 2', () => {
  const { k } = main();
  const d = ok('ul5-two-copies');
  assert(d.outcome === 'unlinked', `unlinked; got ${show(d)}`);
  assert(same(d.change && d.change.changes, [{ change: 'set-unlinked', type: PROP, from: k['Indoor pets'], to: k.Puppies, count: 2 }]), `the entry counts both copies; got ${show(d.change && d.change.changes)}`);
  assert(links(k['Indoor pets'], k.Puppies) === 0 && links(k.Canines, k.Puppies) === 1, 'no copy is left, and Puppies is still under Canines');
});

test('UL6: the instance\'s own lettered set reports its letter, which still names the parent: the TA\'s, and the owner\'s', () => {
  const { k, g } = main();
  for (const [id, set] of [['ul6-ta-letter', 'Tabbies'], ['ul6-owner-letter', 'Calicos']]) {
    const d = ok(id);
    assert(d.outcome === 'unlinked' && links(k.Felines, k[set]) === 0, `${set} is unlinked from Felines; got ${show(d)}`);
    assert(Array.isArray(d.letters) && d.letters.length === 1, `${set}'s letter is reported, once; got ${show(d.letters)}`);
    const [letter] = d.letters;
    assert(letter.address === g.uuids[set], `the letter's address is ${set}'s uuid, ${g.uuids[set]}; got ${show(letter)}`);
    assert(typeof letter.says === 'string' && letter.says.includes(g.uuids.Felines), `it says the letter's s tag still names Felines, ${g.uuids.Felines}; got ${show(letter)}`);
  }
});

test('UL7: an event-less set whose would-be s tag names the parent reports no letter', () => {
  const { k } = main();
  const d = ok('ul7-event-less');
  assert(d.outcome === 'unlinked' && links(k.Felines, k.Ferals) === 0 && links(k['Outdoor pets'], k.Ferals) === 1, `Ferals is unlinked from Felines, and stays under Outdoor pets; got ${show(d)}`);
  assert(Array.isArray(d.letters) && d.letters.length === 0, `a would-be s tag is not a letter (no id; ADR Decision 7); got ${show(d.letters)}`);
});

test('UL8: the set\'s last parent is refused last-parent, by set-has-a-parent, naming the parent and how to go on; nothing changes', () => {
  const { k } = main();
  const b = refused('ul8-last-parent', 409, 'last-parent');
  assert(b.rule === RULE, `the refusal comes from ${RULE}; got ${show(b)}`);
  assert(names(b.error, k.Felines), `it names the parent, Felines; got ${show(b.error)}`);
  assert(/link-set|another parent/i.test(b.error) && /delete-set/.test(b.error), `it says how to go on: link the set under another parent first, or graph delete-set once it is empty; got ${show(b.error)}`);
  assert(links(k.Felines, k.Siamese) === 1 && entriesFor(k.Felines, k.Siamese).length === 0, 'the link is still there, and no entry was recorded');
});

test('UL9: a concept\'s superset may be unlinked from its last parent: its concept is no longer a kind of the other, and stays its own', () => {
  const { k } = main();
  const d = ok('ul9-superset');
  assert(d.outcome === 'unlinked' && links(k['Pack animals'], k.Wolves) === 0, `Wolves, the wolf concept's superset, is unlinked from Pack animals, its only parent; got ${show(d)}`);
  assert(CT.elementsOf(before(), k.mammal).includes(k['Grey wolf']), '(the seed: mammal reached Grey wolf)');
  assert(!CT.elementsOf(graph(), k.mammal).includes(k['Grey wolf']), 'mammal no longer reaches Grey wolf: wolf is no longer a kind of mammal');
  assert(CT.relsBetween(graph(), k.wolf, k.Wolves, 'IS_THE_CONCEPT_FOR') === 1 && CT.elementsOf(graph(), k.wolf).includes(k['Grey wolf']), 'Wolves is still wolf\'s superset, and Grey wolf still a wolf');
});

test('UL10: unknown-node, not-a-set and not-a-parent, as link-set refuses them; nothing changes', () => {
  const { k, nobody } = main();
  for (const [id, input, key] of [['ul10-set', 'set', nobody], ['ul10-parent', 'parent', nobody], ['ul10-entry', 'parent', k.G]]) {
    const b = refused(id, 404, 'unknown-node');
    assert(b.input === input && b.error.includes(key), `${id}: unknown-node, naming ${input} and the key; got ${show(b)}`);
  }
  for (const [id, key] of [['ul10-element-set', k.Rex], ['ul10-header-set', k.feline]]) {
    const b = refused(id, 409, 'not-a-set');
    assert(b.input === 'set' && b.error.includes(key), `${id}: not-a-set, naming set and the key passed; got ${show(b)}`);
  }
  assert(answer('ul10-header-set').body.error.includes(k.Felines), `a concept header: the refusal names its superset's tapestryKey; got ${show(answer('ul10-header-set').body.error)}`);
  for (const [id, key] of [['ul10-element-parent', k.Rex], ['ul10-header-parent', k.feline]]) {
    const b = refused(id, 409, 'not-a-parent');
    assert(b.input === 'parent' && b.error.includes(key), `${id}: not-a-parent, naming parent and the key passed; got ${show(b)}`);
  }
  assert(answer('ul10-header-parent').body.error.includes(k.Felines), `a concept header as the parent: the refusal names its superset's tapestryKey; got ${show(answer('ul10-header-parent').body.error)}`);
  assert(links(k.Pets, k['Outdoor pets']) === 1 && CT.relsBetween(graph(), k.Hounds, k.Rex, 'HAS_ELEMENT') === 1, 'Outdoor pets is still under Pets, and Rex still an element of Hounds');
  assert(!S.entriesOf(graph()).some((e) => [nobody, k.G, k.Rex, k.feline].some((x) => (e.keys || []).includes(x))), 'no entry names any of them');
});

test('UL11: a firmware link is refused firmware-link, naming the part of firmware\'s definition that makes it, and seed-firmware; it stays', () => {
  const { k } = main();
  const def = CT.firmwareDefinition();
  const find = (part, parent, set) => def.links.find((l) => l.part === part && l.parent === parent && l.set === set);
  const cases = [
    ['ul11-a', find('a', F, OBM)],
    ['ul11-b', find('b', 'fw:set/superset', 'fw:superset/superset')],
    ['ul11-c', find('c', OBM, FREE)],
    ['ul11-d', find('d', 'fw:tag/superset', 'fw:tag/community')],
  ];
  for (const [id, l] of cases) {
    assert(l, `${id}: (the seed: the firmware's files make this link)`);
    const b = refused(id, 409, 'firmware-link');
    const problems = partProblems(b.error, l);
    assert(!problems.length, `${id}, part (${l.part}): ${problems.join('; ')}; got ${show(b.error)}`);
    assert(links(k[l.parent], k[l.set]) === 1 && entriesFor(k[l.parent], k[l.set]).length === 0, `${id}: the link is still there, and nothing was recorded`);
  }
});

test('UL12: every class-thread link the shipped firmware\'s definition makes is refused firmware-link, naming its part (a sweep)', () => {
  const def = CT.firmwareDefinition();
  const unresolved = def.links.filter((l) => l.part === 'b' && !l.resolves);
  assert(!unresolved.length, `every shipped existing-sets category resolves to a firmware concept (ADR Decision 6); these don't: ${show(unresolved.map((l) => `${l.category} → ${l.parentConcept}, ${l.concept}`))}`);
  const s = sweep();
  const parts = [...new Set(s.links.map((l) => l.part))].sort();
  assert(same(parts, ['a', 'b', 'c', 'd']), `(the sweep covers all four parts; got ${show(parts)})`);
  const bad = [];
  s.links.forEach((l, i) => {
    const x = answer(`sweep-${i}`, sweep);
    if (x.status !== 409 || !x.body || x.body.code !== 'firmware-link') { bad.push(`(${l.part}) ${l.parent} ─▶ ${l.set}: ${x.status} ${said(x)}`); return; }
    const problems = partProblems(x.body.error, l);
    if (problems.length) bad.push(`(${l.part}) ${l.parent} ─▶ ${l.set}: ${problems.join('; ')}: ${show(x.body.error)}`);
  });
  assert(!bad.length, `of ${s.links.length} firmware links, ${bad.length} weren't refused as firmware's own part: ${bad.slice(0, 6).join(' | ')}${bad.length > 6 ? ` | and ${bad.length - 6} more` : ''}`);
  const g = S.readState(s.file);
  const gone = s.links.filter((l) => CT.relsBetween(g, s.g.keys[l.parent], s.g.keys[l.set]) !== 1);
  assert(!gone.length && !S.entriesOf(g).length, `every firmware link is still there, and nothing was recorded; gone: ${show(gone.map((l) => `${l.parent} ─▶ ${l.set}`))}`);
});

test('UL13: the owner\'s own link between two firmware sets isn\'t firmware\'s, and is unlinked', () => {
  const { k } = main();
  const d = ok('ul13-between-firmware-sets');
  assert(d.outcome === 'unlinked' && links(k[PROFILE], k[FREE]) === 0, `free-relays, unlinked from profile-relays (a pair firmware's definition doesn't make); got ${show(d)}`);
  assert(Array.isArray(d.letters) && d.letters.length === 0, `free-relays' letter names nostr-relay's superset, not profile-relays: no letter to report; got ${show(d.letters)}`);
  assert(links(k[OBM], k[FREE]) === 1 && links(k[F], k[FREE]) === 1, 'firmware\'s own links to free-relays stay');
});

test('UL14: a peer\'s lettered set under the parent its event names is refused peer-link, naming the author; the owner\'s own link to it is unlinked', () => {
  const { k } = main();
  const b = refused('ul14-peer', 409, 'peer-link');
  assert(b.error.includes(CT.PEER), `it names the set's author, ${CT.PEER}; got ${show(b.error)}`);
  assert(/point of view|\bPOV\b/i.test(b.error), `it says the point of view decides whether a peer's link counts; got ${show(b.error)}`);
  assert(links(k.Birds, k.Songbirds) === 1 && entriesFor(k.Birds, k.Songbirds).length === 0, 'the peer\'s link is still there, and nothing was recorded');
  const d = ok('ul14-owner-link-to-it');
  assert(d.outcome === 'unlinked' && links(k['Garden visitors'], k.Songbirds) === 0, `the owner's own link from Garden visitors to the peer's Songbirds is unlinked; got ${show(d)}`);
  assert(Array.isArray(d.letters) && d.letters.length === 0, `a peer's letter isn't the instance's own to report; got ${show(d.letters)}`);
});

test('UL15: an admin\'s call is recorded as the admin\'s', () => {
  const { k } = main();
  const d = ok('ul15-admin');
  assert(d.outcome === 'unlinked' && same(d.change && d.change.by, { role: 'admin', pubkey: ADMIN }), `the admin's unlink is recorded as the admin's; got ${show(d)}`);
  assert(links(k['Indoor pets'], k.Persians) === 0, 'and Persians is unlinked from Indoor pets');
});

test('UL16: nothing is signed; a visitor gets 401, a stranger 403, neither unlinks anything; the command does, as the command, refusing as the route does', () => {
  const { k, a } = main();
  assert(ok('ul1-unlink').outcome === 'unlinked', 'the path under test ran (UL1 unlinked a set)');
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key; the spy saw: ${show(a.spy)}`);
  const v = answer('ul16-visitor');
  const s = answer('ul16-stranger');
  assert(v.status === 401 && /owner/i.test(String(v.body.error)) && s.status === 403 && /owner/i.test(String(s.body.error)), `a visitor 401 and a stranger 403, each told who may call; got ${v.status} ${said(v)}, ${s.status} ${said(s)}`);
  const c = command('ul16-cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.success === true && body.data.outcome === 'unlinked', `the command unlinks Maine coons from Outdoor pets as new, so neither the visitor nor the stranger had; got ${show(body)}`);
  assert(same(body.data.change.by, { role: 'local', pubkey: null }) && body.data.change.operation === 'graph unlink-set', `the command's entry names the command; got ${show(body.data.change)}`);
  assert(links(k['Outdoor pets'], k['Maine coons']) === 0 && links(k.Felines, k['Maine coons']) === 1, 'the command took the link out, and Maine coons stays under Felines');
  const no = command('ul16-refused');
  assert(no.code === 1, `a refused command exits 1; got ${no.code} ${no.stderr}`);
  const rb = JSON.parse(no.stdout);
  const route = answer('ul8-last-parent').body;
  assert(rb.code === route.code && rb.error === route.error && rb.rule === route.rule, `the command's refusal is the route's; command ${show(rb)}, route ${show(route)}`);
});

test('UL17: it is listed for an admin with its guard, repeatKey, inputs and refusals, and has its /docs entry', () => {
  const list = main().a.req('list');
  const ops = (list.body.data && list.body.data.operations) || [];
  needDecl(`the list for an admin has graph ${ops.filter((o) => o.group === 'graph').map((o) => o.name).join(', ')}`);
  const e = ops.find((o) => o.group === 'graph' && o.name === 'unlink-set');
  assert(e, `graph unlink-set is listed for an admin; problems: ${show(list.body.data && list.body.data.problems)}`);
  assert(e.kind === 'write' && e.method === 'POST' && e.access === 'owner-and-admins' && e.route === ROUTE, `a POST write at ${ROUTE}, for the owner and admins; got ${show({ kind: e.kind, method: e.method, access: e.access, route: e.route })}`);
  assert(same(e.guards, [RULE]) && same(e.repeatKey, ['set', 'parent']), `guards [${RULE}], repeatKey [set, parent]; got ${show({ guards: e.guards, repeatKey: e.repeatKey })}`);
  assert(same(Object.keys(e.inputs).sort(), ['parent', 'set']) && e.inputs.set.required === true && e.inputs.parent.required === true, `two required inputs, set and parent; got ${show(e.inputs)}`);
  const codes = e.refusals.map((x) => `${x.code}:${x.status}`);
  for (const c of ['last-parent:409', 'unknown-node:404', 'not-a-set:409', 'not-a-parent:409', 'firmware-link:409', 'peer-link:409', 'wrong-content-type:415', 'invalid-input:400', 'missing-input:400', 'sign-in-required:401', 'not-allowed:403']) {
    assert(codes.includes(c), `its refusals include ${c}; got ${show(codes)}`);
  }
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('unlink-set-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && same(JSON.parse(line), ['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

/**
 * The steps of each transaction the fake rolled back whose error names one of `marks`, as story 4's W6 reads them
 * (test/operations/write-path.test.js): from its `begin` to its `rollback`.
 */
function rolledBack(log, marks) {
  const out = [];
  for (let i = 0; i < log.length; i++) {
    if (log[i].call !== 'rollback' || !marks.some((m) => String(log[i].error || '').includes(m))) continue;
    const steps = [];
    for (let j = i - 1; j >= 0 && log[j].call !== 'begin'; j--) steps.unshift(log[j]);
    out.push(steps);
  }
  return out;
}
/** The lock (ADR 0028 Amendment 2): a write in the shape of the field mapping's copies, UNWIND … SET n += row.props. */
const isLock = (s) => s.call === 'tx.run' && (s.kind === 'copies' || /\bUNWIND\b[\s\S]*\bSET\b/i.test(String(s.query || '')));

// ADR 0028 Amendment 2: unlink-set locks its set by setting a property and removing it again in its own transaction.
// Amendment 3, item 1: the lock is the first thing its apply does, so a refusal inside apply comes after it. A guard's
// refusal (UL8's last-parent) comes before apply, and takes no lock.
test('UL18: an unlink leaves the set\'s own properties as they were, unlinked or refused after its lock: the lock leaves nothing behind', () => {
  const { k } = main();
  const propsOf = (state, key) => {
    const n = state.nodes.find((x) => x.props && x.props.tapestryKey === key);
    return n ? n.props : null;
  };
  ok('ul1-unlink');
  const b = refused('ul18-refused-after-the-lock', 409, 'not-a-set');
  assert(b.input === 'set', `Lock probe, an element, is refused not-a-set, naming set; got ${show(b)}`);
  const txs = rolledBack(graph().log, [k['Lock probe'], 'Lock probe']);
  assert(txs.length === 1, `one rolled-back transaction names Lock probe; found ${txs.length}`);
  assert(txs[0].some(isLock), `the refused unlink took its lock before it refused not-a-set, and the rollback took it away (ADR 0028 Amendment 3, item 1: the lock is the first thing apply does); its transaction ran ${show(txs[0].map((s) => s.kind))}`);
  for (const [what, key] of [['Hounds, unlinked (UL1)', k.Hounds], ['Lock probe, refused not-a-set after the lock', k['Lock probe']]]) {
    const was = propsOf(before(), key);
    const is = propsOf(graph(), key);
    assert(was && is, `(the seed holds ${what})`);
    assert(!Object.prototype.hasOwnProperty.call(is, 'tapestryLock'), `${what}: no lock property is left on the node; got ${show(is)}`);
    assert(same(is, was), `${what}: the node's properties are as they were; was ${show(was)}, is ${show(is)}`);
  }
});

// ADR 0028 Amendment 3: a node counts as a set, a superset or a parent only when it has an address, its uuid. The trust
// pipeline's card sets are labelled Set and have none (classThreadSeed.js's cardSet). Each link to or from one here
// is one the link-set before Amendment 3 could make, as the review's probe did.
const namesNoAddress = (text) => /address/i.test(String(text));

test('UL19: a trust-pipeline card set, labelled Set but with no address, is refused not-a-set, even one a link puts under a set', () => {
  const { k } = main();
  const b = refused('ul19-card-set', 409, 'not-a-set');
  assert(b.input === 'set' && b.error.includes(k['Card set A']), `not-a-set, naming set and the key passed; got ${show(b)}`);
  assert(namesNoAddress(b.error), `its words say the node has no address, as the trust pipeline's card sets haven't (ADR 0028 Amendment 3); got ${show(b.error)}`);
  assert(links(k.Pets, k['Card set A']) === 1 && entriesFor(k.Pets, k['Card set A']).length === 0, 'the link from Pets is still there, and nothing was recorded');
});

test('UL20: a card set as the parent is refused not-a-parent, named as a node with no address; nothing changes', () => {
  const { k } = main();
  const b = refused('ul20-card-set-as-parent', 409, 'not-a-parent');
  assert(b.input === 'parent' && b.error.includes(k['Card set B']), `not-a-parent, naming parent and the key passed; got ${show(b)}`);
  assert(namesNoAddress(b.error), `its words say the node has no address (ADR 0028 Amendment 3); got ${show(b.error)}`);
  assert(links(k['Card set B'], k['Lap cats']) === 1 && links(k.Felines, k['Lap cats']) === 1, 'both links to Lap cats are still there');
  assert(entriesFor(k['Card set B'], k['Lap cats']).length === 0, 'and nothing was recorded');
});

test('UL21: a card set doesn\'t count as a parent: a set whose only other incoming link is from one is refused last-parent from its real parent', () => {
  const { k } = main();
  const b = refused('ul21-a-card-set-is-no-parent', 409, 'last-parent');
  assert(b.rule === RULE, `the refusal comes from ${RULE}; got ${show(b)}`);
  assert(names(b.error, k.Felines), `it names the parent, Felines; got ${show(b.error)}`);
  assert(links(k.Felines, k['House cats']) === 1 && entriesFor(k.Felines, k['House cats']).length === 0, 'House cats is still under Felines, and nothing was recorded');
  assert(CT.elementsOf(graph(), k.feline).includes(k.Mittens), 'feline\'s class thread still reaches Mittens, the element of House cats');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
