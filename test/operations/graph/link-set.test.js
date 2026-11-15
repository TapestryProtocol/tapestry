'use strict';
/**
 * graph link-set — its own suite (ADR graph-operations-foundation/0001 Decision 12), run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/28-link-set-and-unlink-set.md (AC1–AC3, AC6, AC8)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0028-link-set-and-unlink-set.md (Decisions 1, 3,
 *          5, 6, 10)
 *
 * Stack-free: the real catalog, over test/helpers/classThreadSeed.js's linkSetGraph() (its header draws it), through
 * test/helpers/operationsHarness.js with the spy on everything that signs or reads a key. One harness run sends the
 * requests below in turn, then the commands; each test reads their answers and the graph the run committed. Each
 * test's sets are its own, so one answer can't change another test's starting point.
 *
 *   LS1  the owner links a set under a second parent: one link, linked, its change entry; it keeps its first parent,
 *        and every concept above the parent now reaches the set, the sets below it and their elements
 *   LS2  a class link: a concept's superset goes under another concept's set, or its superset, and the one concept's
 *        elements become the other's
 *   LS3  graph history finds the entry by the parent and by the set
 *   LS4  the same call again changes nothing, records nothing, and answers already-linked with change: null; so does a
 *        repeat of a link a reinstall would prune (a repeat never refuses)
 *   LS5  a set or parent that names no node, or names a change entry, is refused unknown-node, naming which; one that
 *        isn't a tapestryKey is refused invalid-input; nothing changes
 *   LS6  a set that is neither a set nor a superset is refused not-a-set: an element, a NostrUser, and a concept header,
 *        whose refusal names its superset's tapestryKey; nothing changes
 *   LS7  a parent that is neither a superset nor a set is refused not-a-parent: an element, and a concept header, whose
 *        refusal names its superset's tapestryKey; nothing changes
 *   LS8  a set under itself is refused cycle, by class-thread-acyclic, naming it; nothing changes
 *   LS9  a set under a set already below it, one link down or two, is refused cycle, naming the chain from the set down
 *        to the parent, in order; nothing changes
 *   LS10 across two concepts too: a superset under a set of a concept below it is refused cycle, naming the whole chain
 *   LS11 the owner's sets go under a firmware concept's set and its superset, beside an older redundancy a reinstall
 *        would prune, which doesn't block them
 *   LS12 firmware-prunes, shape 1: a link from a firmware concept's superset straight to a set already below it through
 *        another set is refused, naming the link and seed-firmware; nothing changes
 *   LS13 firmware-prunes, shape 2: a link that would make an earlier direct link from that superset prunable is refused,
 *        naming the earlier link: the set itself was under the superset, or a set below it was; nothing changes
 *   LS14 under the owner's own concept, or a firmware concept whose folder has no manifest.json, both shapes are linked
 *   LS15 an admin's call is recorded as the admin's
 *   LS16 nothing is signed and no key is read, accepted, refused or repeated
 *   LS17 a visitor is refused 401 and a stranger 403, and neither links anything: the command links that pair afterwards
 *   LS18 the command links a set too, recorded as the command's, and its refusal matches the route's
 *   LS19 it is listed for an admin with its guard, repeatKey, inputs and refusals, and has its /docs entry
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const CT = require('../../helpers/classThreadSeed');

const { ROOT, OWNER, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph link-set');

const ROUTE = '/api/tapestry/graph/link-set';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/link-set.js');
const MISSING = 'src/operations/catalog/graph/link-set.js does not exist yet (ADR graph-operations-first-slice/0028 Decision 1)';
const RULE = 'class-thread-acyclic';
const PROP = CT.PROP;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const F = 'fw:nostr-relay/superset';
const OBF = 'fw:nostr-relay/sets/organization-by-firmware';
const OBM = 'fw:nostr-relay/sets/organization-by-monetization';
const PROFILE = 'fw:nostr-relay/sets/profile-relays';

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  const dir = tmp('link-set-');
  const g = CT.linkSetGraph();
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
        post('ls1-link', 'owner', k.Beagles, k['Indoor pets']),
        history('ls3-by-parent', k['Indoor pets']),
        history('ls3-by-set', k.Beagles),
        post('ls2-under-a-set', 'owner', k.Canines, k['Pack animals']),
        post('ls2-under-a-superset', 'owner', k.Felines, k.Mammals),
        post('ls4-again', 'owner', k.Beagles, k['Indoor pets']),
        post('ls4-redundant-again', 'owner', k[PROFILE], k[F]),
        post('ls5-set', 'owner', nobody, k.Pets),
        post('ls5-parent', 'owner', k.Tabbies, nobody),
        post('ls5-entry', 'owner', k.Tabbies, k.G),
        post('ls5-not-a-key', 'owner', 'not-a-key', k.Pets),
        post('ls6-element', 'owner', k.Goldie, k.Pets),
        post('ls6-user', 'owner', k.U, k.Pets),
        post('ls6-header', 'owner', k.feline, k.Mammals),
        post('ls7-element', 'owner', k.Tabbies, k.Goldie),
        post('ls7-header', 'owner', k.Tabbies, k.canine),
        post('ls8-self', 'owner', k.Cars, k.Cars),
        post('ls9-one-down', 'owner', k.Cars, k.Sedans),
        post('ls9-two-down', 'owner', k.Vehicles, k.Sedans),
        post('ls10-across', 'owner', k.Machines, k.Sedans),
        post('ls11-under-a-firmware-set', 'owner', k['Relay notes'], k[OBM]),
        post('ls11-under-a-firmware-superset', 'owner', k['My relationship types'], k['fw:relationship-type/superset']),
        post('ls12-shape-1', 'owner', k['Favourite relays'], k[F]),
        post('ls13-shape-2', 'owner', k['Bookmarked relays'], k[OBF]),
        post('ls13-shape-2-below', 'owner', k['Relay folders'], k[OBF]),
        post('ls14-owner-shape-1', 'owner', k.Jigsaws, k.Toys),
        post('ls14-owner-shape-2', 'owner', k.Blocks, k.Puzzles),
        post('ls14-no-manifest', 'owner', k['Field details'], k['fw:property/superset']),
        post('ls15-admin', 'admin', k.Tabbies, k['Indoor pets']),
        post('ls17-visitor', 'visitor', k.Kittens, k['Outdoor pets']),
        post('ls17-stranger', 'stranger', k.Kittens, k['Outdoor pets']),
        { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
      ],
      cli: [
        { id: 'ls18-cli', argv: ['graph', 'link-set', '--set', k.Kittens, '--parent', k['Outdoor pets']] },
        { id: 'ls18-refused', argv: ['graph', 'link-set', '--set', k.Cars, '--parent', k.Cars] },
      ],
    }],
  }, { dir });
  MAIN = { r, a: S.answered(r), g, file, k, nobody };
  return MAIN;
}
const graph = () => S.readState(main().file);
const before = () => main().g.state;
const name = (key) => main().g.names[key];
const links = (from, to) => CT.relsBetween(graph(), from, to);
const entriesFor = (from, to) => CT.entriesNaming(graph(), from, to);

/** A short account of an answer: Express's "Cannot POST …" for a route that isn't there, or the body. */
function said(x) {
  if (typeof x.body === 'string') { const m = x.body.match(/Cannot \w+ [^<\n]+/); return m ? m[0] : x.body.slice(0, 120); }
  return show(x.body).slice(0, 300);
}
function needDecl(what) {
  if (!fs.existsSync(DECL)) throw new Error(`${MISSING}${what ? `: ${what}` : ''}`);
}
function answer(id) {
  const x = main().a.req(id);
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
/** A key-order-free comparison. */
const canon = (x) => JSON.stringify(x, (key, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((n) => [n, v[n]])) : v));
const same = (a, b) => canon(a) === canon(b);
/** Whether `text` names the node keyed `key`: by its name, or by its tapestryKey. */
const names = (text, key) => String(text).includes(key) || String(text).includes(name(key));
/** Whether `text` names each node, by name or tapestryKey, in this order. */
function namesInOrder(text, keys) {
  let at = 0;
  for (const key of keys) {
    const found = [key, name(key)].map((s) => String(text).indexOf(s, at)).filter((i) => i >= 0);
    if (!found.length) return false;
    at = Math.min(...found) + 1;
  }
  return true;
}
const linkOf = (d) => d && d.link && Object.keys(d.link).length === 2 ? d.link : null;

test('LS1: the owner links a set under a second parent: one link, linked, its change entry; it keeps its first parent, and every concept above the parent reaches it', () => {
  const { k } = main();
  const d = ok('ls1-link');
  assert(d.outcome === 'linked', `outcome linked; got ${show(d)}`);
  assert(same(linkOf(d), { set: k.Beagles, parent: k['Indoor pets'] }), `it answers the link, { set, parent }; got ${show(d.link)}`);
  const c = d.change;
  assert(c && UUID.test(c.id) && ISO.test(c.at), `it answers its change entry, with an id and an ISO time; got ${show(c)}`);
  assert(same(c.by, { role: 'owner', pubkey: OWNER }) && c.operation === 'graph link-set', `the entry is the owner's, through graph link-set; got ${show(c)}`);
  assert(same(c.changes, [{ change: 'set-linked', type: PROP, from: k['Indoor pets'], to: k.Beagles }]), `the entry says what changed: set-linked, ${PROP}, from the parent to the set; got ${show(c.changes)}`);
  assert(links(k['Indoor pets'], k.Beagles) === 1, 'the graph holds one link from Indoor pets to Beagles');
  assert(links(k.Hounds, k.Beagles) === 1, 'Beagles is still under Hounds, its first parent');
  const kept = S.entriesOf(graph()).filter((e) => e.tapestryKey === c.id);
  assert(kept.length === 1 && kept[0].labels.includes('GraphChange'), `the entry is kept as a GraphChange node; got ${show(kept)}`);
  assert(same([...kept[0].keys].sort(), [k['Indoor pets'], k.Beagles].sort()), `the kept entry's keys are the parent's and the set's; got ${show(kept[0].keys)}`);
  for (const concept of ['pet', 'household']) {
    const reached = CT.elementsOf(graph(), k[concept]);
    assert(!CT.elementsOf(before(), k[concept]).includes(k.Rex), `(the seed: ${concept}'s class thread doesn't reach Rex before the link)`);
    assert(reached.includes(k.Rex) && reached.includes(k.Snoopy), `${concept}, above Indoor pets, now reaches Beagles' element Rex and Snoopy, the element of a set below Beagles; got ${show(reached.map(name))}`);
  }
});

test('LS2: a class link: a concept\'s superset goes under another concept\'s set, or its superset, and the one concept\'s elements become the other\'s', () => {
  const { k } = main();
  const underSet = ok('ls2-under-a-set');
  assert(underSet.outcome === 'linked' && same(linkOf(underSet), { set: k.Canines, parent: k['Pack animals'] }), `Canines, a superset, is linked under Pack animals, a set of Mammals; got ${show(underSet)}`);
  assert(same(underSet.change && underSet.change.changes, [{ change: 'set-linked', type: PROP, from: k['Pack animals'], to: k.Canines }]), `its entry; got ${show(underSet.change)}`);
  const underSuperset = ok('ls2-under-a-superset');
  assert(underSuperset.outcome === 'linked' && links(k.Mammals, k.Felines) === 1, `Felines, a superset, is linked under Mammals, a superset; got ${show(underSuperset)}`);
  const mammals = CT.elementsOf(graph(), k.mammal);
  for (const e of ['Fido', 'Rex', 'Tom', 'Whale']) assert(mammals.includes(k[e]), `${e} is now an element of mammal; mammal reaches ${show(mammals.map(name))}`);
  assert(!CT.elementsOf(before(), k.mammal).includes(k.Fido), '(the seed: Fido wasn\'t a mammal before)');
  assert(CT.elementsOf(graph(), k.canine).includes(k.Fido) && CT.relsBetween(graph(), k.canine, k.Canines, 'IS_THE_CONCEPT_FOR') === 1, 'Canines is still canine\'s superset, and canine\'s elements are still its own');
});

test('LS3: graph history finds the entry by the parent and by the set', () => {
  const d = ok('ls1-link');
  for (const id of ['ls3-by-parent', 'ls3-by-set']) {
    const h = main().a.req(id);
    assert(h.status === 200 && h.body.success, `${id}: history answers; got ${h.status} ${said(h)}`);
    const found = h.body.data.entries.filter((e) => e.id === d.change.id);
    assert(found.length === 1 && found[0].operation === 'graph link-set', `${id}: history finds LS1's entry; got ${show(h.body.data.entries.map((e) => e.operation))}`);
  }
});

test('LS4: the same call again changes nothing, records nothing, and answers already-linked; so does a repeat of a link a reinstall would prune', () => {
  const { k } = main();
  const d = ok('ls4-again');
  assert(d.outcome === 'already-linked' && d.change === null, `already-linked, change null; got ${show(d)}`);
  assert(same(linkOf(d), { set: k.Beagles, parent: k['Indoor pets'] }), `it answers the link; got ${show(d.link)}`);
  assert(links(k['Indoor pets'], k.Beagles) === 1, 'still one link from Indoor pets to Beagles');
  assert(entriesFor(k['Indoor pets'], k.Beagles).length === 1, `one entry for the link, not two; got ${entriesFor(k['Indoor pets'], k.Beagles).length}`);
  const redundant = ok('ls4-redundant-again');
  assert(redundant.outcome === 'already-linked' && redundant.change === null, `the older redundancy from nostr-relay's superset to profile-relays, linked again: already-linked, not firmware-prunes (ADR Decision 1, step 3); got ${show(redundant)}`);
  assert(links(k[F], k[PROFILE]) === 1 && entriesFor(k[F], k[PROFILE]).length === 0, 'it is still there, once, with no entry');
});

test('LS5: a set or parent that names no node, or names a change entry, is refused unknown-node, naming which; one that isn\'t a tapestryKey, invalid-input', () => {
  const { k, nobody } = main();
  for (const [id, input, key] of [['ls5-set', 'set', nobody], ['ls5-parent', 'parent', nobody], ['ls5-entry', 'parent', k.G]]) {
    const b = refused(id, 404, 'unknown-node');
    assert(b.input === input, `${id}: the refusal names the input, ${input}; got ${show(b)}`);
    assert(b.error.includes(key), `${id}: its words name the key that names no node; got ${show(b.error)}`);
  }
  const bad = refused('ls5-not-a-key', 400, 'invalid-input');
  assert(bad.input === 'set', `a set that isn't a tapestryKey: invalid-input naming set; got ${show(bad)}`);
  const g = graph();
  assert(CT.relsBetween(g, k.G, k.Tabbies) === 0, 'nothing was linked under the change entry');
  assert(!S.entriesOf(g).some((e) => (e.keys || []).includes(nobody) || (e.keys || []).includes(k.G)), 'no entry names the missing key or the change entry');
});

test('LS6: a set that is neither a set nor a superset is refused not-a-set: an element, a NostrUser, and a concept header, naming its superset\'s key', () => {
  const { k } = main();
  for (const [id, key] of [['ls6-element', k.Goldie], ['ls6-user', k.U], ['ls6-header', k.feline]]) {
    const b = refused(id, 409, 'not-a-set');
    assert(b.input === 'set', `${id}: the refusal names the input, set; got ${show(b)}`);
    assert(b.error.includes(key), `${id}: its words name the key passed; got ${show(b.error)}`);
  }
  assert(answer('ls6-header').body.error.includes(k.Felines), `a concept header's refusal names its superset's tapestryKey, the key to pass; got ${show(answer('ls6-header').body.error)}`);
  const g = graph();
  assert(CT.relsBetween(g, k.Pets, k.Goldie) === 0 && CT.relsBetween(g, k.Pets, k.U) === 0 && CT.relsBetween(g, k.Mammals, k.feline) === 0, 'none of them was linked');
  assert(!S.entriesOf(g).some((e) => [k.Goldie, k.U, k.feline].some((x) => (e.keys || []).includes(x))), 'no entry names any of them');
});

test('LS7: a parent that is neither a superset nor a set is refused not-a-parent: an element, and a concept header, naming its superset\'s key', () => {
  const { k } = main();
  for (const [id, key] of [['ls7-element', k.Goldie], ['ls7-header', k.canine]]) {
    const b = refused(id, 409, 'not-a-parent');
    assert(b.input === 'parent', `${id}: the refusal names the input, parent; got ${show(b)}`);
    assert(b.error.includes(key), `${id}: its words name the key passed; got ${show(b.error)}`);
  }
  assert(answer('ls7-header').body.error.includes(k.Canines), `a concept header as the parent: the refusal names its superset's tapestryKey; got ${show(answer('ls7-header').body.error)}`);
  assert(links(k.Goldie, k.Tabbies) === 0 && links(k.canine, k.Tabbies) === 0, 'Tabbies was linked under neither');
});

test('LS8: a set under itself is refused cycle, by class-thread-acyclic, naming it; nothing changes', () => {
  const { k } = main();
  const b = refused('ls8-self', 409, 'cycle');
  assert(b.rule === RULE, `the refusal comes from ${RULE}; got ${show(b)}`);
  assert(names(b.error, k.Cars), `it names the set, Cars; got ${show(b.error)}`);
  assert(links(k.Cars, k.Cars) === 0 && entriesFor(k.Cars, k.Cars).length === 0, 'no link from Cars to itself, and no entry');
});

test('LS9: a set under a set already below it, one link down or two, is refused cycle, naming the chain from the set down to the parent', () => {
  const { k } = main();
  for (const [id, chain] of [['ls9-one-down', ['Cars', 'Sedans']], ['ls9-two-down', ['Vehicles', 'Cars', 'Sedans']]]) {
    const b = refused(id, 409, 'cycle');
    assert(b.rule === RULE, `${id}: the refusal comes from ${RULE}; got ${show(b)}`);
    assert(namesInOrder(b.error, chain.map((n) => k[n])), `${id}: it names the chain from the set down to the parent, ${chain.join(' → ')}, in that order; got ${show(b.error)}`);
  }
  assert(links(k.Sedans, k.Cars) === 0 && links(k.Sedans, k.Vehicles) === 0, 'neither link was made');
  assert(entriesFor(k.Sedans, k.Cars).length === 0 && entriesFor(k.Sedans, k.Vehicles).length === 0, 'and neither recorded an entry');
});

test('LS10: across two concepts too: a superset under a set of a concept below it is refused cycle, naming the whole chain', () => {
  const { k } = main();
  const b = refused('ls10-across', 409, 'cycle');
  const chain = ['Machines', 'Movers', 'Vehicles', 'Cars', 'Sedans'];
  assert(b.rule === RULE && namesInOrder(b.error, chain.map((n) => k[n])), `Machines under Sedans: the chain ${chain.join(' → ')}, through both concepts, in order; got ${show(b)}`);
  assert(links(k.Sedans, k.Machines) === 0 && entriesFor(k.Sedans, k.Machines).length === 0, 'no link, no entry');
});

test('LS11: the owner\'s sets go under a firmware concept\'s set and its superset, beside an older redundancy a reinstall would prune', () => {
  const { k } = main();
  const underSet = ok('ls11-under-a-firmware-set');
  assert(underSet.outcome === 'linked' && links(k[OBM], k['Relay notes']) === 1, `Relay notes, the owner's, under nostr-relay's organization-by-monetization: linked; got ${show(underSet)}`);
  const underSuperset = ok('ls11-under-a-firmware-superset');
  assert(underSuperset.outcome === 'linked' && links(k['fw:relationship-type/superset'], k['My relationship types']) === 1, `the owner's own relationship types under the relationship type concept's superset: linked; got ${show(underSuperset)}`);
  assert(links(k[F], k[PROFILE]) === 1, '(the seed: the older redundancy, nostr-relay\'s superset straight to profile-relays, is there throughout)');
});

test('LS12: firmware-prunes, shape 1: a link from a firmware concept\'s superset straight to a set already below it through another set', () => {
  const { k } = main();
  const b = refused('ls12-shape-1', 409, 'firmware-prunes');
  assert(names(b.error, k['Favourite relays']) && names(b.error, k[F]), `it names the link, from nostr-relay's superset to Favourite relays; got ${show(b.error)}`);
  assert(/seed-firmware/.test(b.error), `it names lifecycle seed-firmware, how firmware changes; got ${show(b.error)}`);
  assert(links(k[F], k['Favourite relays']) === 0 && entriesFor(k[F], k['Favourite relays']).length === 0, 'the link was rolled back, and no entry recorded');
  assert(links(k[OBF], k['Favourite relays']) === 1, 'Favourite relays is still under organization-by-firmware');
});

test('LS13: firmware-prunes, shape 2: a link that would make an earlier direct link from that superset prunable, naming the earlier link', () => {
  const { k } = main();
  const direct = refused('ls13-shape-2', 409, 'firmware-prunes');
  assert(names(direct.error, k['Bookmarked relays']) && names(direct.error, k[F]), `Bookmarked relays under organization-by-firmware: it names the link a reinstall would prune, nostr-relay's superset to Bookmarked relays; got ${show(direct.error)}`);
  assert(/seed-firmware/.test(direct.error), `it names lifecycle seed-firmware; got ${show(direct.error)}`);
  assert(links(k[OBF], k['Bookmarked relays']) === 0 && links(k[F], k['Bookmarked relays']) === 1, 'the new link was rolled back, and the earlier one is untouched');
  const below = refused('ls13-shape-2-below', 409, 'firmware-prunes');
  assert(names(below.error, k['Saved relays']), `Relay folders under organization-by-firmware: it names the earlier link to Saved relays, a set below Relay folders, which a reinstall would then prune; got ${show(below.error)}`);
  assert(links(k[OBF], k['Relay folders']) === 0 && links(k[F], k['Saved relays']) === 1, 'the new link was rolled back, and the earlier one is untouched');
  assert(entriesFor(k[OBF], k['Bookmarked relays']).length === 0 && entriesFor(k[OBF], k['Relay folders']).length === 0, 'neither recorded an entry');
});

test('LS14: under the owner\'s own concept, or a firmware concept whose folder has no manifest.json, both shapes are linked', () => {
  const { k } = main();
  const shape1 = ok('ls14-owner-shape-1');
  assert(shape1.outcome === 'linked' && links(k.Toys, k.Jigsaws) === 1, `Jigsaws, already below Toys through Puzzles, straight under Toys: linked, since toy isn't firmware's; got ${show(shape1)}`);
  const shape2 = ok('ls14-owner-shape-2');
  assert(shape2.outcome === 'linked' && links(k.Puzzles, k.Blocks) === 1, `Blocks, straight under Toys, under Puzzles too: linked; got ${show(shape2)}`);
  const noManifest = ok('ls14-no-manifest');
  assert(noManifest.outcome === 'linked' && links(k['fw:property/superset'], k['Field details']) === 1, `Field details straight under property's superset: linked, since install prunes only concepts whose folder has a manifest.json (ADR Decision 6); got ${show(noManifest)}`);
});

test('LS15: an admin\'s call is recorded as the admin\'s', () => {
  const d = ok('ls15-admin');
  assert(d.outcome === 'linked' && same(d.change && d.change.by, { role: 'admin', pubkey: ADMIN }), `the admin's link is recorded as the admin's; got ${show(d)}`);
});

test('LS16: nothing is signed and no key is read, accepted, refused or repeated', () => {
  assert(ok('ls1-link').outcome === 'linked', 'the path under test ran (LS1 linked a set)');
  assert(answer('ls8-self').body.code === 'cycle' && answer('ls4-again').body.data.outcome === 'already-linked', 'and it refused and repeated');
  const { spy } = main().a;
  assert(Array.isArray(spy), `the harness's spy recorded its calls; got ${show(spy)}`);
  assert(spy.length === 0, `nothing signs, publishes or reads a key (ADR graph-operations-foundation/0004 Decision 10); the spy saw: ${show(spy)}`);
});

test('LS17: a visitor is refused 401 and a stranger 403, and neither links anything', () => {
  const v = answer('ls17-visitor');
  const s = answer('ls17-stranger');
  assert(v.status === 401 && v.body.success === false && /owner/i.test(String(v.body.error)), `a visitor: 401, told who may call; got ${v.status} ${said(v)}`);
  assert(s.status === 403 && s.body.success === false && /owner/i.test(String(s.body.error)), `a stranger: 403, told who may call; got ${s.status} ${said(s)}`);
  const c = command('ls18-cli');
  const body = JSON.parse(c.stdout || 'null');
  assert(body && body.data && body.data.outcome === 'linked', `the command, run afterwards, links Kittens under Outdoor pets as new, so neither the visitor nor the stranger had; got ${show(body)}`);
});

test('LS18: the command links a set too, recorded as the command\'s, and its refusal matches the route\'s', () => {
  const { k } = main();
  const c = command('ls18-cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.success === true && body.data.outcome === 'linked', `the command answers as the route does; got ${show(body)}`);
  assert(same(body.data.change.by, { role: 'local', pubkey: null }) && body.data.change.operation === 'graph link-set', `the command's entry names the command; got ${show(body.data.change)}`);
  assert(links(k['Outdoor pets'], k.Kittens) === 1, 'the command made the link');
  const no = command('ls18-refused');
  assert(no.code === 1, `a refused command exits 1; got ${no.code} ${no.stderr}`);
  const rb = JSON.parse(no.stdout);
  const route = answer('ls8-self').body;
  assert(rb.code === route.code && rb.error === route.error && rb.rule === route.rule, `the command's refusal is the route's; command ${show(rb)}, route ${show(route)}`);
});

test('LS19: it is listed for an admin with its guard, repeatKey, inputs and refusals, and has its /docs entry', () => {
  const list = main().a.req('list');
  const ops = (list.body.data && list.body.data.operations) || [];
  needDecl(`the list for an admin has graph ${ops.filter((o) => o.group === 'graph').map((o) => o.name).join(', ')}`);
  const e = ops.find((o) => o.group === 'graph' && o.name === 'link-set');
  assert(e, `graph link-set is listed for an admin; problems: ${show(list.body.data && list.body.data.problems)}`);
  assert(e.kind === 'write' && e.method === 'POST' && e.access === 'owner-and-admins' && e.route === ROUTE, `a POST write at ${ROUTE}, for the owner and admins; got ${show({ kind: e.kind, method: e.method, access: e.access, route: e.route })}`);
  assert(same(e.guards, [RULE]) && same(e.repeatKey, ['set', 'parent']), `guards [${RULE}], repeatKey [set, parent]; got ${show({ guards: e.guards, repeatKey: e.repeatKey })}`);
  assert(same(Object.keys(e.inputs).sort(), ['parent', 'set']) && e.inputs.set.required === true && e.inputs.parent.required === true, `two required inputs, set and parent; got ${show(e.inputs)}`);
  const codes = e.refusals.map((x) => `${x.code}:${x.status}`);
  for (const c of ['cycle:409', 'unknown-node:404', 'not-a-set:409', 'not-a-parent:409', 'firmware-prunes:409', 'wrong-content-type:415', 'invalid-input:400', 'missing-input:400', 'sign-in-required:401', 'not-allowed:403']) {
    assert(codes.includes(c), `its refusals include ${c}; got ${show(codes)}`);
  }
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('link-set-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && same(JSON.parse(line), ['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
