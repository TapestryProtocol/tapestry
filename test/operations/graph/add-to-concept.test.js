'use strict';
/**
 * graph add-to-concept — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.md (AC1–AC5,
 *          AC8's add refusals, AC9's marks, access and command, over the fake; the live check covers the rest)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0022-add-to-concept-and-remove-from-concept.md
 *          (Decisions 1–9, 13, 14, 17; Amendment 1)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.test-plan.md
 *
 * Stack-free: the real catalog, over a graph test/helpers/membershipGraph.js seeds for test/helpers/graphFake.js (it
 * says what the graph holds and what each node is for), with the harness's spy on everything that signs or reads a key.
 * MAIN adds memberships and repeats them; AFTER reads MAIN's graph back through history and list-elements; REF holds
 * every refusal, so its graph must end as it began; the locks, a keyless instance, an entry that can't be recorded and
 * a node deleted meanwhile each have a run of their own.
 *
 *   AT1  the owner adds Whiskers, a pet, to beagle: directly under its superset, beagle's section and key in its JSON
 *   AT2  everything else about it stays: its pet section, its tags (a z naming beagle added), address, key, membership
 *   AT3  the change entry: membership-added, section-added, tag-added, wordTypes; history finds it by the node and the
 *        concept; list-elements lists Whiskers among beagle's elements
 *   AT4  into a set two concepts reach: Fetch goes directly in walkers, joins dog and pet, z naming dog, n naming walkers;
 *        pet's schema is reported, not refused
 *   AT5  a node already in the concept goes in the set as well, its section untouched, differs naming a field given
 *   AT6  a set that is the concept's own superset is the same as none; an admin's add is the admin's
 *   AT7  the same add again is already-element: nothing changes or is recorded; differs names what differs
 *   AT8  two adds of one membership make it once
 *   AT9  another author's node is filed beside their letter: tapestryOwnSections holds the section, their letter as it was
 *   AT10 an admin's letter and a stranger's node are someone else's (beside); the owner's letter is the instance's own
 *   AT11 a person node takes its section's name from fields, cleaned, and the slug it gives; nothing else of it changes
 *   AT12 a placeholder, and firmware's own element, are filed beside: firmware's file stays as it is
 *   AT13 a section the view already holds is merged into, own or beside
 *   AT14 name-in-use isn't checked for a node kept beside; another author's element of the name is no clash
 *   AT15 a JSON held in the store is written back inline; a node with no json tag gets one
 *   AT16 cacheOutOfDate and letterOutOfDate
 *   AT17 the marks follow in the same write, recorded as copies, and a beside node's copies come from its owner's section
 *   AT18 nothing is signed; the command adds one too, fields as JSON text, recorded as the command's
 *   AT19 it is listed with its guard, repeatKey, inputs and every refusal, and has its /docs entry
 *   AT20 each add locks the node, then the concept's header, before any read; a repeat writes nothing but its locks
 *   AT48 (Amendment 1, item 12: A10.20.b landed first) an add into a set word's thread holds, word given its real
 *        schema: word is reported waiting for the derive step, fits null, not failing, and the add is made
 *   AT30–AT47 the refusals (REF and their own runs); AT47, name-in-use for firmware's own element kept beside
 *   Review round 1 (ADR Amendment 2), in a run of their own (FILL, UNDO) or REF:
 *   AT49 a node already in the concept whose JSON lacks its section is given it: added, section-added, no new link;
 *        the same call again is already-element (item 1)
 *   AT50 the same for a node kept beside: the section goes into tapestryOwnSections (item 1)
 *   AT51 a removal that also left a second concept is undone by add-to-concept: Goldie into golden retriever, then dog
 *        with dog's fields from the entry, both sections as they were (item 1)
 *   AT52 a node already in the concept put in a set another concept reaches gains that concept's key in wordTypes,
 *        recorded as field-changed (item 2)
 *   AT53 a node already in the concept whose JSON can't be read is unreadable-json, the JSON read before the repeat
 *        (item 5; a guard of what the code does)
 *   Review round 2 (ADR Amendment 3), in a run of its own (ROUND2), FILL's or MAIN's listing:
 *   AT54 a node already in dog, with no breed, put in golden retriever's superset through dog is refused
 *        invalid-fields naming dog.breed, as a new member is: a call that changes wordTypes is judged (item 1)
 *   AT55 a call that leaves the JSON as it was, writing a set's link and its tags alone, isn't refused for a misfit the
 *        node already had: it is reported (item 1, the other side)
 *   AT56 a section given alone writes no would-be z or n tag (item 4; a guard of what the code does)
 *   AT57 rule 4 judges the section given alone: fields pet's schema refuses are invalid-fields, own or beside (item 4;
 *        a guard of what the code does)
 *   AT58 the published description: update-node changes what differs names for the instance's own node; for a node
 *        kept beside, which update-node refuses, a removal and then an add do (item 5)
 *   Review round 3 (ADR Amendment 4), over ROUND2's calls and MAIN's listing:
 *   AT59 Mark Me's refusal, from a call that writes no section, says fields given in it aren't written into the
 *        section it holds, and names the way on: golden retriever, then dog's breed with update-node (item 1)
 *   AT60 a refused call that writes a section keeps the rule's plain message, with no such way on: a new member's,
 *        and a member's given its missing section, own or beside (item 1, so a fix can't over-reach)
 *   AT61 the published description: a removal and then an add change the owner's own section of any node kept
 *        beside; a section the author's letter holds, for a membership their letter claims, stays theirs (item 2)
 *   Review round 4 (ADR Amendment 5), over AT59's two refusals and the same call into show goldens, below golden
 *   retriever's superset, and over the scroll shelf, a set of scroll's and beagle's (the seed's two round-4 sets):
 *   AT62 the way on gives golden retriever, the concept to add Mark Me to, by its tapestryKey too (item 1)
 *   AT63 its add gives the refused call's own set, show goldens included, never the joined concept's superset in its
 *        place (item 2; a guard of what the code does)
 *   AT64 its update-node gives dog's tapestryKey as concept (item 2; a guard of what the code does)
 *   AT65 a no-schema refusal from a call that writes no section keeps the rule's plain message: Scrolled into the
 *        scroll shelf through scroll (item 2; a guard of what the code does)
 *   AT66 the other side: a concept with no schema that a membership joins is reported, never refused for: Rover into
 *        the scroll shelf through beagle (Amendment 3, item 1)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const C = require('../../helpers/conceptGraph');
const M = require('../../helpers/membershipGraph');

const { ROOT, TA, OWNER, ADMIN, assert, show, tmp } = S;
const { OTHER, STRANGER } = M;
const { test, run } = S.makeSuite('operations: graph add-to-concept');

const ROUTE = '/api/tapestry/graph/add-to-concept';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/add-to-concept.js');
const RULE = 'element-fits-schema';
const HAS_ELEMENT = 'HAS_ELEMENT';
const NOBODY = '00000000-0000-4000-8000-0000000000c2';
const NOSET = '00000000-0000-4000-8000-0000000000d2';

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/add-to-concept.js does not exist yet (ADR graph-operations-first-slice/0022 Decision 1)');
}
const post = (id, caller, body, extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body, ...extra });
const add = (id, node, concept, extra = {}, caller = 'owner') => post(id, caller, { node, concept, ...extra });
const get = (id, url) => ({ id, method: 'GET', url, caller: 'owner' });

/** One harness run over a state file; { r, a }. */
function runOn(file, requests, { cli = [], spy = false, env = null } = {}) {
  const dir = path.dirname(file);
  const r = S.runHarness({ spy, scenarios: [{ graphFake: { stateFile: file }, requests, cli }] }, { dir, env: env ? env(dir) : null });
  return { r, a: S.answered(r) };
}
/** A fresh seed in a directory of its own; { file, dir, k, u, seed }. `mutate(state, keys)` changes it first. */
async function fresh(mutate = null, { store = false } = {}) {
  const seed = await M.seedMemberships();
  if (mutate) mutate(seed.state, seed.keys);
  const file = seed.file(tmp('add-to-concept-'));
  const dir = path.dirname(file);
  if (store) seed.storeEntries(dir);
  return { file, dir, k: seed.keys, u: seed.uuids, seed };
}

// ── reading a state ──
const nodeByKey = (g, key) => g.nodes.find((n) => n.props.tapestryKey === key) || null;
const entriesIn = (g) => g.nodes.filter((n) => n.labels.includes('GraphChange'));
const sortKeys = (o) => Object.fromEntries(Object.keys(o || {}).sort().map((k) => [k, o[k]]));
const same = (a, b) => show(sortKeys(a)) === show(sortKeys(b));
const into = (g, key) => C.into(g, key, HAS_ELEMENT).sort();
const links = (g, from, to) => S.relsOf(g, HAS_ELEMENT).filter((r) => r.from === from && r.to === to).length;
const tagsBut = (g, key, type) => C.tagArrays(g, key).filter((t) => t[0] !== type);
const jsonTags = (g, key) => C.tags(g, key).filter((t) => t.type === 'json');
const ownSections = (g, key) => { const n = nodeByKey(g, key); const v = n && n.props.tapestryOwnSections; return typeof v === 'string' ? JSON.parse(v) : v; };
const propsBut = (n, ...names) => Object.fromEntries(Object.entries(n.props).filter(([k]) => !names.includes(k)));
const changeOf = (d, name) => ((d && d.change && d.change.changes) || []).filter((c) => c.change === name);
const byInput = (d) => Object.fromEntries(((d && d.differs) || []).map((x) => [x.input, x]));
const conceptKeys = (d) => ((d && d.concepts) || []).map((c) => c.concept);
/** The node properties an answer's copies name: a list of names or of { property }, or an object keyed by property. */
const propsOf = (copies) => (Array.isArray(copies) ? copies.map((c) => (typeof c === 'string' ? c : c && c.property)) : copies && typeof copies === 'object' ? Object.keys(copies) : ['(not a list or an object)']).sort();
const err = (body) => String(body && body.error);
const wasNone = (c) => !('was' in c) || c.was === null;

/** The transactions the fake logged from `from` on: [{ end, error, steps }]. */
function transactions(log, from = 0) {
  const out = [];
  let cur = null;
  for (const l of log.slice(from)) {
    if (l.call === 'begin') cur = { steps: [] };
    else if (l.call === 'commit' || l.call === 'rollback') { if (cur) out.push({ end: l.call, error: l.error || null, steps: cur.steps }); cur = null; } else if (cur) cur.steps.push(l);
  }
  return out;
}

// ── MAIN: adds memberships and repeats them ──
let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    const { file, k, u, seed } = await fresh(null, { store: true });
    const before = S.readState(file);
    const { a } = runOn(file, [
      add('ac1', k.whiskers, k.beagle, { fields: { description: 'a cat among the beagles' } }),
      add('ac1-again', k.whiskers, k.beagle, { fields: { description: 'a cat among the beagles' } }),
      add('ac1-differs', k.whiskers, k.beagle, { fields: { description: 'a cat, still', color: 'tabby' } }),
      add('set-holds', k.lucky, k.beagle, { set: k.showBeagles }),
      add('ac2', k.fetch, k.dog, { set: k.walkers }),
      add('in-concept', k.rover, k.beagle, { set: k.showBeagles, fields: { description: 'a different beagle' } }),
      add('admin', k.ghosty, k.pet, { set: k.petSuperset, fields: { description: 'a ghost of a pet' } }, 'admin'),
      add('peer', k.snowy, k.pet, { fields: { description: 'filed under pet by the owner' } }),
      add('admin-letter', k.ace, k.pet, { fields: { description: "an admin's beagle, filed as a pet" } }),
      add('owner-letter', k.patch, k.graph),
      add('person', k.personNode, k.pet, { fields: { name: '  Alice  ', description: 'a person, filed as a pet' } }),
      add('placeholder', k.placeholder, k.beagle, { fields: { name: 'Far Away', description: 'an event the graph does not hold' } }),
      add('firmware', k.firmwareRover, k.pet, { fields: { description: "firmware's rover, filed as a pet" } }),
      add('stale', k.stale, k.pet, { fields: { description: 'fresh' } }),
      add('peer-stale', k.peerStale, k.pet, { fields: { description: "the owner's words" } }),
      add('peer-lucky', k.peerLucky, k.beagle, { fields: { description: "another author's Lucky" } }),
      add('pet-snowy', k.petSnowy, k.beagle, { fields: '{"description":"a pet named Snowy"}' }),
      add('stored', k.stored, k.pet, { fields: { description: 'its JSON was in the store' } }),
      add('mute', k.mute, k.pet, { fields: { description: 'it had no json tag' } }),
      add('cached', k.stamped, k.pet, { fields: { description: 'cached before' } }),
      add('marks', k.markMe, k.gadget, { fields: { size: 3, color: 'green' } }),
      add('marks-beside', k.drifter, k.gadget, { fields: { size: 4, color: 'red' } }),
      { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
    ], {
      spy: true,
      cli: [{ id: 'cli', argv: ['graph', 'add-to-concept', '--node', k.commandBeagle, '--concept', k.pet, '--fields', '{"description":"from the command"}'] }],
    });
    return { a, k, u, file, before, seed };
  })();
  return MAIN;
}
const graph = async () => S.readState((await main()).file);
async function ok(id) {
  needDecl();
  const x = (await main()).a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body).slice(0, 600)}`);
  return x.body.data;
}

test('AT1 [AC1]: the owner adds Whiskers, a pet, to beagle: directly under its superset, and its JSON gains beagle\'s section and key', async () => {
  const d = await ok('ac1');
  const { k, u } = await main();
  assert(d.outcome === 'added' && d.concept === k.beagle && d.kept === 'json-tag', `added, to beagle, its sections kept in its json tag (Decision 2); got ${show(d).slice(0, 400)}`);
  assert(d.node && d.node.tapestryKey === k.whiskers && d.node.address === u.whiskers && d.node.name === 'Whiskers', `the answer's node is its key, address and name (Decision 13); got ${show(d.node)}`);
  const g = await graph();
  assert(show(into(g, k.whiskers)) === show([k.beagleSuperset, k.petSuperset].sort()), `it is directly under beagle's superset, and still under pet's; got ${show(into(g, k.whiskers))}`);
  const j = C.json(g, k.whiskers);
  assert(show(j.beagle) === show({ name: 'Whiskers', slug: 'whiskers', description: 'a cat among the beagles' }), `beagle's section holds its name, the slug its name gives, then the fields given, nothing made up; got ${show(j.beagle)}`);
  assert(show(j.word.wordTypes) === show(['word', 'pet', 'beagle']), `wordTypes gains beagle at its end (Decision 9); got ${show(j.word.wordTypes)}`);
  const cs = d.concepts || [];
  assert(cs.length === 2 && cs[0].concept === k.beagle && cs[0].key === 'beagle' && cs[0].fits === true && cs[1].concept === k.pet && cs[1].key === 'pet' && cs[1].fits === true,
    `each concept it now belongs to, the named one first, each with whether its JSON fits: beagle, then pet, both fitting (AC1, Decision 13); got ${show(cs)}`);
  assert(cs.every((c) => c.waiting === false), `each entry, the named concept's too, says it waits for nothing: neither schema asks for the graphContext only the derive step builds (Sch.fits, ADR 0042 Decision 4; Amendment 1, item 12); got ${show(cs)}`);
  assert(d.letterOutOfDate === false && d.cacheOutOfDate === false && show(d.differs) === show([]), `a node made here, never cached: neither its letter nor its cache is out of date, and nothing differs; got ${show({ l: d.letterOutOfDate, c: d.cacheOutOfDate, differs: d.differs })}`);
});

test('AT2 [AC1]: everything else about Whiskers stays: its pet section, its tags (a z naming beagle added), its address, key and other membership', async () => {
  const d = await ok('ac1');
  const { k, u, before } = await main();
  const g = await graph();
  const was = C.json(before, k.whiskers);
  const now = C.json(g, k.whiskers);
  assert(show(now.pet) === show(was.pet), `its pet section is as it was; got ${show(now.pet)}`);
  assert(show({ ...now.word, wordTypes: null }) === show({ ...was.word, wordTypes: null }), `its word block is as it was but for wordTypes; got ${show(now.word)}`);
  assert(same(nodeByKey(g, k.whiskers).props, nodeByKey(before, k.whiskers).props), `its node properties, uuid and tapestryKey among them, are as they were; got ${show(nodeByKey(g, k.whiskers).props)}`);
  const beagleUuid = C.node(before, k.beagle).props.uuid;
  const want = [...tagsBut(before, k.whiskers, 'json'), ['z', beagleUuid]];
  assert(show(tagsBut(g, k.whiskers, 'json')) === show(want), `its tags are as they were, with a z naming beagle's header added, so a reinstall's pass 1d and a letter agree with the graph (Decision 9); got ${show(tagsBut(g, k.whiskers, 'json'))}`);
  const jt = jsonTags(g, k.whiskers);
  assert(jt.length === 1 && jt[0].key === jsonTags(before, k.whiskers)[0].key, 'its one json tag is rewritten in place, not replaced');
  const z = C.tags(g, k.whiskers).find((t) => t.type === 'z' && t.value === beagleUuid);
  assert(z && typeof z.key === 'string' && z.uuid, `the new z tag is a keyed tag node with the import's uuid; got ${show(z)}`);
  void d; void u;
});

test('AT3 [AC1, Decision 14]: the change entry names the membership, the section, the tag and wordTypes; history finds it by the node and the concept; list-elements lists Whiskers', async () => {
  const d = await ok('ac1');
  const { file, k, before } = await main();
  assert(d.change && d.change.operation === 'graph add-to-concept' && show(d.change.by) === show({ role: 'owner', pubkey: OWNER }), `the entry is the owner's, through graph add-to-concept; got ${show(d.change).slice(0, 300)}`);
  const m = changeOf(d, 'membership-added');
  assert(m.length === 1 && m[0].type === HAS_ELEMENT && m[0].from === k.beagleSuperset && m[0].to === k.whiskers && m[0].node === k.whiskers && m[0].concept === k.beagle, `membership-added: its type, from the anchor, to the node, the node and the concept; got ${show(m)}`);
  const sec = changeOf(d, 'section-added');
  assert(sec.length === 1 && sec[0].node === k.whiskers && sec[0].concept === k.beagle && sec[0].field === 'beagle' && wasNone(sec[0]) && show(sec[0].now) === show({ name: 'Whiskers', slug: 'whiskers', description: 'a cat among the beagles' }) && sec[0].property === undefined,
    `section-added: the concept's key as its field, was null, now the section; no property for a json-tag node; got ${show(sec)}`);
  const beagleUuid = C.node(before, k.beagle).props.uuid;
  const t = changeOf(d, 'tag-added');
  assert(t.length === 1 && t[0].node === k.whiskers && t[0].field === 'z' && t[0].now === beagleUuid, `tag-added: the z, naming beagle's header; got ${show(t)}`);
  const w = changeOf(d, 'field-changed').filter((c) => c.field === 'word.wordTypes');
  assert(w.length === 1 && w[0].node === k.whiskers && show(w[0].was) === show(['word', 'pet']) && show(w[0].now) === show(['word', 'pet', 'beagle']), `wordTypes: field-changed, was and now; got ${show(changeOf(d, 'field-changed'))}`);
  const { a } = runOn(file, [
    get('h-node', `/api/tapestry/graph/history?node=${k.whiskers}&limit=5`),
    get('h-concept', `/api/tapestry/graph/history?node=${k.beagle}&limit=200`),
    get('le', `/api/tapestry/graph/list-elements?concept=${k.beagle}&limit=200`),
  ]);
  for (const id of ['h-node', 'h-concept']) {
    const x = a.req(id);
    const ids = x.status === 200 ? x.body.data.entries.map((e) => e.id) : null;
    assert(ids && ids.includes(d.change.id), `${id}: graph history finds the entry; got ${x.status} ${show(x.body).slice(0, 300)}`);
  }
  const le = a.req('le');
  const listed = le.status === 200 ? le.body.data.elements.map((e) => e.tapestryKey) : null;
  assert(listed && listed.includes(k.whiskers), `list-elements lists Whiskers among beagle's elements, from the owner's point of view, which counts the instance's own nodes; got ${le.status} ${show(le.body).slice(0, 300)}`);
});

test('AT4 [AC2, AC3]: into a set two concepts reach: Fetch goes directly in walkers and joins dog and pet; pet\'s schema is reported, not refused', async () => {
  const d = await ok('ac2');
  const { k, before } = await main();
  const g = await graph();
  assert(d.outcome === 'added' && d.set === k.walkers, `added, into walkers; got ${show(d).slice(0, 300)}`);
  assert(show(into(g, k.fetch)) === show([k.beagleSuperset, k.walkers].sort()), `it is directly in walkers, not under dog's superset (AC2); got ${show(into(g, k.fetch))}`);
  const j = C.json(g, k.fetch);
  assert(show(j.dog) === show({ name: 'Fetch', slug: 'fetch' }) && !('pet' in j), `dog's section holds the name and slug alone, no fields given and none made up; no section for pet, which wasn't named; got ${show(j)}`);
  assert(show(j.word.wordTypes) === show(['word', 'beagle', 'dog', 'pet']), `wordTypes gains dog, the named concept, then pet, which walkers joins too (AC2, Decision 9); got ${show(j.word.wordTypes)}`);
  const dogUuid = C.node(before, k.dog).props.uuid;
  const walkersUuid = C.node(before, k.walkers).props.uuid;
  const added = C.tagArrays(g, k.fetch).slice(C.tagArrays(before, k.fetch).length);
  assert(show(added) === show([['z', dogUuid], ['n', walkersUuid]]), `a z naming dog and an n naming walkers are added, and no z for pet (Decision 9); got ${show(added)}`);
  const cs = d.concepts || [];
  assert(cs[0] && cs[0].concept === k.dog && cs[0].fits === true, `dog first, fitting; got ${show(cs)}`);
  const rest = cs.slice(1).map((c) => c.concept);
  assert(show(rest) === show([k.beagle, k.pet].sort()), `then beagle and pet, by tapestryKey (Decision 13); got ${show(rest)}`);
  const pet = cs.find((c) => c.concept === k.pet);
  assert(pet && pet.fits === false && (pet.problems || []).length > 0, `pet's schema wants a pet section, which Fetch lacks: reported, never refused (AC3); got ${show(pet)}`);
  assert(cs.every((c) => c.waiting === false), `no entry waits for the derive step: none of the three schemas asks for graphContext (ADR 0042 Decision 4); got ${show(cs)}`);
  const m = changeOf(d, 'membership-added');
  assert(m.length === 1 && m[0].from === k.walkers && m[0].concept === k.dog, `the entry's membership runs from walkers; got ${show(m)}`);
});

test('AT5 [AC2, Decision 7]: a node already in the concept goes in the set as well, its section untouched, and differs names a field given that differs', async () => {
  const d = await ok('in-concept');
  const { k, before } = await main();
  const g = await graph();
  assert(d.outcome === 'added' && d.set === k.showBeagles, `added: only the set's link is new; got ${show(d).slice(0, 300)}`);
  assert(show(into(g, k.rover)) === show([k.beagleSuperset, k.showBeagles].sort()), `rover is in show beagles as well as under beagle's superset; got ${show(into(g, k.rover))}`);
  assert(show(C.json(g, k.rover)) === show(C.json(before, k.rover)), `its JSON is as it was: an add never changes a section the node has (story, Out of scope); got ${show(C.json(g, k.rover))}`);
  const showBeaglesUuid = C.node(before, k.showBeagles).props.uuid;
  const beagleUuid = C.node(before, k.beagle).props.uuid;
  const addedTags = C.tagArrays(g, k.rover).slice(C.tagArrays(before, k.rover).length);
  assert(addedTags.some((t) => t[0] === 'n' && t[1] === showBeaglesUuid) && addedTags.every((t) => (t[0] === 'n' && t[1] === showBeaglesUuid) || (t[0] === 'z' && t[1] === beagleUuid)),
    `rover, kept in its json tag, gains a would-be n naming show beagles (and a z naming beagle only if it had none): the set's link, its would-be tags and the marks are written, the section isn't (Decision 7, Amendment 1, item 7); got ${show(addedTags)}`);
  assert(changeOf(d, 'tag-added').some((c) => c.field === 'n' && c.now === showBeaglesUuid), `the entry records the n tag added; got ${show(changeOf(d, 'tag-added'))}`);
  const f = byInput(d)['fields.description'];
  assert(f && f.given === 'a different beagle' && f.holds === 'a good beagle', `differs names the field whose value differs, with what the section holds; graph update-node changes it (AC4); got ${show(d.differs)}`);
  assert(changeOf(d, 'section-added').length === 0 && changeOf(d, 'membership-added').length === 1 && changeOf(d, 'membership-added')[0].from === k.showBeagles, `the entry records the set's membership and no section; got ${show(d.change)}`);
  assert(d.letterOutOfDate === true, `rover has a letter, kept in its json tag: its letter is now out of date (Decision 13); got ${show(d.letterOutOfDate)}`);
});

test('AT6 [AC2, AC1]: a set that is the concept\'s own superset is the same as none; an admin\'s add is recorded as the admin\'s', async () => {
  const d = await ok('admin');
  const { k, before } = await main();
  const g = await graph();
  assert(d.outcome === 'added' && d.kept === 'json-tag', `ghosty, which records no author, is the instance's own: added, in its json tag; got ${show(d).slice(0, 300)}`);
  assert(show(into(g, k.ghosty)) === show([k.beagleSuperset, k.petSuperset].sort()), `directly under pet's superset; got ${show(into(g, k.ghosty))}`);
  const added = C.tagArrays(g, k.ghosty).slice(C.tagArrays(before, k.ghosty).length);
  assert(show(added) === show([['z', C.node(before, k.pet).props.uuid]]), `a z naming pet and no n: the superset isn't a set (Decision 3, the anchor); got ${show(added)}`);
  assert(show(d.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the entry is the admin's; got ${show(d.change && d.change.by)}`);
});

test('AT7 [AC4]: the same add again is already-element: nothing changes or is recorded; differs names each field that differs', async () => {
  needDecl();
  const { k } = await main();
  for (const id of ['ac1-again', 'ac1-differs', 'set-holds']) {
    const d = await ok(id);
    assert(d.outcome === 'already-element' && d.change === null, `${id}: already-element, and no entry (AC4); got ${show(d).slice(0, 300)}`);
  }
  assert(show((await ok('ac1-again')).differs) === show([]), 'the same fields again: nothing differs');
  const f = byInput(await ok('ac1-differs'));
  assert(f['fields.description'] && f['fields.description'].given === 'a cat, still' && f['fields.description'].holds === 'a cat among the beagles', `a field whose value differs is named with what the section holds; got ${show(f)}`);
  assert(f['fields.color'] && f['fields.color'].given === 'tabby' && f['fields.color'].holds === null, `a field the section lacks holds null (Decision 7); got ${show(f)}`);
  const g = await graph();
  assert(C.json(g, k.whiskers).beagle.description === 'a cat among the beagles' && !('color' in C.json(g, k.whiskers).beagle), 'the repeats changed none of its fields: graph update-node does that');
  assert(show(into(g, k.lucky)) === show([k.showBeagles]), 'lucky, directly in show beagles, is where it was');
});

test('AT8 [AC4]: two adds of one membership make it once: one link, one entry', async () => {
  assert((await ok('ac1')).outcome === 'added' && (await ok('ac1-again')).outcome === 'already-element', 'the path under test ran: added, then already-element');
  const { k } = await main();
  const g = await graph();
  assert(links(g, k.beagleSuperset, k.whiskers) === 1, `one HAS_ELEMENT from beagle's superset to Whiskers; got ${links(g, k.beagleSuperset, k.whiskers)}`);
  const mine = entriesIn(g).filter((e) => e.props.operation === 'graph add-to-concept' && (e.props.keys || []).includes(k.whiskers));
  assert(mine.length === 1, `one entry for Whiskers' membership; got ${mine.length}`);
});

test('AT9 [AC5]: another author\'s node is filed beside their letter: tapestryOwnSections holds the owner\'s section, and their letter is as the graph recorded it', async () => {
  const d = await ok('peer');
  const { k, before } = await main();
  const g = await graph();
  assert(d.outcome === 'added' && d.kept === 'beside' && d.letterOutOfDate === false, `added, kept beside the other author's letter, which isn't the instance's to be out of date (Decisions 2, 13); got ${show(d).slice(0, 300)}`);
  assert(show(C.tagArrays(g, k.snowy)) === show(C.tagArrays(before, k.snowy)), `Snowy's tags, its json tag among them, are exactly as they were: no tag written (AC5, Decision 2); got ${show(C.tagArrays(g, k.snowy))}`);
  assert(same(propsBut(nodeByKey(g, k.snowy), 'tapestryOwnSections'), nodeByKey(before, k.snowy).props), `its event's properties are as they were; got ${show(nodeByKey(g, k.snowy).props)}`);
  assert(show(ownSections(g, k.snowy)) === show({ pet: { name: 'Snowy', slug: 'snowy', description: 'filed under pet by the owner' } }), `tapestryOwnSections holds the owner's pet section (Decision 6); got ${show(nodeByKey(g, k.snowy).props.tapestryOwnSections)}`);
  assert(show(into(g, k.snowy)) === show([k.beagleSuperset, k.petSuperset].sort()), `directly under pet's superset: the owner's claim, beside the author's (D4); got ${show(into(g, k.snowy))}`);
  const sec = changeOf(d, 'section-added');
  assert(sec.length === 1 && sec[0].property === 'tapestryOwnSections' && sec[0].field === 'pet', `section-added names tapestryOwnSections for a node kept beside (Decision 14); got ${show(sec)}`);
  assert(changeOf(d, 'tag-added').length === 0, `no tag-added: nothing is written into another author's letter; got ${show(changeOf(d, 'tag-added'))}`);
  const pet = (d.concepts || []).find((c) => c.concept === k.pet);
  assert(pet && pet.fits === true && d.concepts[0].concept === k.pet, `pet's schema judges the JSON as its readers get it, the owner's section laid over the letter's (AC3, AC5); got ${show(d.concepts)}`);
  const { a } = runOn((await main()).file, [get('le-pet-everyone', `/api/tapestry/graph/list-elements?concept=${k.pet}&pov=everyone&limit=200`)]);
  const le = a.req('le-pet-everyone');
  const listed = le.status === 200 ? le.body.data.elements.map((e) => e.tapestryKey) : null;
  assert(listed && listed.includes(k.snowy), `list-elements from a point of view that counts its author (everyone's) lists Snowy among pet's elements (AC1, AC5); got ${le.status} ${show(le.body).slice(0, 300)}`);
});

test('AT10 [AC5]: an admin\'s letter and a stranger\'s node with no letter are someone else\'s, kept beside; the owner\'s letter is the instance\'s own', async () => {
  const ace = await ok('admin-letter');
  const { k, before } = await main();
  const g = await graph();
  assert(ace.outcome === 'added' && ace.kept === 'beside', `an admin's letter is another author's (Decision 2); got ${show(ace).slice(0, 300)}`);
  assert(show(C.tagArrays(g, k.ace)) === show(C.tagArrays(before, k.ace)), 'the admin\'s letter is as it was');
  const drifter = await ok('marks-beside');
  assert(drifter.outcome === 'added' && drifter.kept === 'beside', `a stranger's node with no letter is someone else's too; got ${show(drifter).slice(0, 300)}`);
  const patch = await ok('owner-letter');
  assert(patch.outcome === 'added' && patch.kept === 'json-tag' && patch.letterOutOfDate === true, `the owner's letter is the instance's own: its json tag gains the section, and its letter is out of date (Decision 13); got ${show(patch).slice(0, 300)}`);
  assert(show(C.json(g, k.patch).graph) === show({ name: 'Patch', slug: 'patch' }), `patch's JSON gains graph's section; got ${show(C.json(g, k.patch))}`);
});

test('AT11 [AC5, Decision 7]: a person node takes its section\'s name from fields, cleaned, and the slug it gives; nothing else of it changes', async () => {
  const d = await ok('person');
  const { k, before } = await main();
  const g = await graph();
  assert(d.outcome === 'added' && d.kept === 'beside', `a person node is filed beside (Decision 2); got ${show(d).slice(0, 300)}`);
  assert(show(ownSections(g, k.personNode)) === show({ pet: { name: 'Alice', slug: 'alice', description: 'a person, filed as a pet' } }), `its section's name is the one fields gives, trimmed, and the slug it gives; got ${show(nodeByKey(g, k.personNode).props)}`);
  assert(same(propsBut(nodeByKey(g, k.personNode), 'tapestryOwnSections'), nodeByKey(before, k.personNode).props), 'the person node is otherwise as the import made it');
  assert(C.tags(g, k.personNode).length === 0, 'and has no tags: nothing is written as its letter');
  assert(show(into(g, k.personNode)) === show([k.petSuperset]), `it is an element of pet now; got ${show(into(g, k.personNode))}`);
});

test('AT12 [AC5]: a placeholder, and firmware\'s own element, are filed beside: firmware\'s file stays as the graph recorded it', async () => {
  const p = await ok('placeholder');
  const { k, before } = await main();
  const g = await graph();
  assert(p.outcome === 'added' && p.kept === 'beside', `a placeholder is filed beside; got ${show(p).slice(0, 300)}`);
  assert(show(ownSections(g, k.placeholder)) === show({ beagle: { name: 'Far Away', slug: 'far-away', description: 'an event the graph does not hold' } }), `its section's name comes from fields; got ${show(nodeByKey(g, k.placeholder).props)}`);
  assert(same(propsBut(nodeByKey(g, k.placeholder), 'tapestryOwnSections'), nodeByKey(before, k.placeholder).props) && C.tags(g, k.placeholder).length === 0, 'it is still a placeholder, with no tags and no created_at');
  const f = await ok('firmware');
  assert(f.outcome === 'added' && f.kept === 'beside', `firmware's own element is filed beside its definition (Decision 2); got ${show(f).slice(0, 300)}`);
  assert(show(C.tagArrays(g, k.firmwareRover)) === show(C.tagArrays(before, k.firmwareRover)), "firmware's rover keeps its file's tags and JSON, exactly");
  const file = fs.readFileSync(path.join(ROOT, 'firmware/versions/v1.0.0', M.FIRMWARE_FILES.rover), 'utf8');
  assert(show(C.json(g, k.firmwareRover)) === show(JSON.parse(file)), 'its json tag still holds its file\'s JSON');
  assert(show(ownSections(g, k.firmwareRover)) === show({ pet: { name: 'Rover', slug: 'rover', description: "firmware's rover, filed as a pet" } }), `the owner's pet section is kept beside it; got ${show(nodeByKey(g, k.firmwareRover).props.tapestryOwnSections)}`);
});

test('AT13 [Decision 7]: a section the node\'s JSON already holds for the concept is merged into, whether kept in its json tag or beside', async () => {
  const s = await ok('stale');
  const { k, before } = await main();
  const g = await graph();
  assert(s.outcome === 'added' && s.kept === 'json-tag', `added; got ${show(s).slice(0, 300)}`);
  assert(show(C.json(g, k.stale).pet) === show({ name: 'Stale', slug: 'stale', description: 'fresh', color: 'grey' }), `the fields given merge into the section it held, in place (X.mergeSection); got ${show(C.json(g, k.stale).pet)}`);
  const p = await ok('peer-stale');
  assert(p.outcome === 'added' && p.kept === 'beside', `added beside; got ${show(p).slice(0, 300)}`);
  assert(show(ownSections(g, k.peerStale)) === show({ pet: { name: 'Peer Stale', slug: 'peer-stale', description: "the owner's words", color: 'brown' } }), `the owner's section starts from the author's, the fields merged in; got ${show(nodeByKey(g, k.peerStale).props.tapestryOwnSections)}`);
  assert(show(C.tagArrays(g, k.peerStale)) === show(C.tagArrays(before, k.peerStale)) && C.json(g, k.peerStale).pet.description === "the author's words", "the author's letter still holds their own words");
});

test('AT14 [Decision 8, AC5]: name-in-use isn\'t checked for another author\'s node kept beside, and another author\'s element of the name is no clash; fields as JSON text', async () => {
  const p = await ok('peer-lucky');
  const { k } = await main();
  assert(p.outcome === 'added' && p.kept === 'beside', `another author's Lucky joins beagle beside the instance's own Lucky: a beside node is never a repeat (Decision 8, step 6); got ${show(p).slice(0, 300)}`);
  const s = await ok('pet-snowy');
  assert(s.outcome === 'added' && s.kept === 'json-tag', `the instance's own Snowy joins beagle, where only another author's Snowy is (name-in-use counts the instance's own); got ${show(s).slice(0, 300)}`);
  assert(C.json(await graph(), k.petSnowy).beagle.description === 'a pet named Snowy', 'fields given as JSON text are read as the object it holds');
});

test('AT15 [Decision 9]: a JSON held in the store is written back inline; a node with no json tag gets one', async () => {
  const s = await ok('stored');
  const { k, seed } = await main();
  const g = await graph();
  assert(s.outcome === 'added' && s.kept === 'json-tag', `added; got ${show(s).slice(0, 300)}`);
  const jt = jsonTags(g, k.stored);
  assert(jt.length === 1 && !String(jt[0].value).startsWith('lmdb:'), `its json tag now holds the JSON inline, so the graph holds the change (BIBLE §30); got ${show(jt.map((t) => String(t.value).slice(0, 60)))}`);
  const j = JSON.parse(jt[0].value);
  assert(show(j.beagle) === show(seed.stored[k.stored].beagle) && show(j.pet) === show({ name: 'Stored', slug: 'stored', description: 'its JSON was in the store' }), `it holds the store's sections and the new one; got ${show(j)}`);
  const m = await ok('mute');
  assert(m.outcome === 'added' && m.kept === 'json-tag', `a node with no json tag is added; got ${show(m).slice(0, 300)}`);
  const mj = jsonTags(g, k.mute);
  const mute = mj.length === 1 ? JSON.parse(mj[0].value) : {};
  assert(mj.length === 1 && show(mute.pet) === show({ name: 'Mute', slug: 'mute', description: 'it had no json tag' }) && show(Object.keys(mute).filter((x) => x !== 'word')) === show(['pet']),
    `its JSON was {} (Decision 5), and the write adds one json tag holding pet's section and no other concept's; got ${show(mj)}`);
});

test('AT16 [Decision 13]: cacheOutOfDate holds for a node the derive step had cached; neither holds for a node made here and never cached', async () => {
  const c = await ok('cached');
  assert(c.outcome === 'added' && c.cacheOutOfDate === true && c.letterOutOfDate === false, `stamped, cached by the derive step: its cached copy is out of date; it has no letter; got ${show(c).slice(0, 300)}`);
  const w = await ok('ac1');
  assert(w.cacheOutOfDate === false && w.letterOutOfDate === false, 'Whiskers has neither');
});

test('AT17 [AC9]: the marks follow in the same write, recorded as copies; a node kept beside carries copies from the owner\'s section', async () => {
  const d = await ok('marks');
  const { k, before } = await main();
  const g = await graph();
  const n = nodeByKey(g, k.markMe);
  assert(d.outcome === 'added' && show(n.props.gadget_size) === show({ $int: '3' }) && n.props.gadget_color === 'green', `Mark Me carries gadget_size, as an integer, and gadget_color (A10.5); got ${show(n.props)}`);
  assert(show(propsOf(d.copies)) === show(['gadget_color', 'gadget_size']), `the answer gives the copies it carries; got ${show(d.copies)}`);
  const set = changeOf(d, 'copies-set');
  assert(show(set.map((c) => c.property).sort()) === show(['gadget_color', 'gadget_size']) && set.every((c) => show(c.nodes) === show([k.markMe])), `its entry records each copy (Decision 14); got ${show(set)}`);
  const b = await ok('marks-beside');
  const dn = nodeByKey(g, k.drifter);
  assert(b.outcome === 'added' && show(dn.props.gadget_size) === show({ $int: '4' }) && dn.props.gadget_color === 'red', `drifter, kept beside, carries the copies its owner's section gives (Decision 6: the field mapping lays the sections over); got ${show(dn.props)}`);
  assert(show(C.tagArrays(g, k.drifter)) === show(C.tagArrays(before, k.drifter)), 'and its own JSON and tags are as they were');
});

test('AT18 [AC1, AC9]: nothing is signed; the command adds one too, fields as JSON text, recorded as the command\'s', async () => {
  assert((await ok('ac1')).outcome === 'added', 'the path under test ran (AT1)');
  const { a, k } = await main();
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key (D1); the spy saw ${show(a.spy)}`);
  const c = a.cmd('cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.success === true && body.data.outcome === 'added' && body.data.node.tapestryKey === k.commandBeagle, `the command answers as the route does; got ${show(body).slice(0, 300)}`);
  assert(show(body.data.change.by) === show({ role: 'local', pubkey: null }), `its entry names the command (AC9); got ${show(body.data.change.by)}`);
  assert(C.json(await graph(), k.commandBeagle).pet.description === 'from the command', 'the command\'s fields are kept');
});

test('AT19 [AC9, Decisions 1 and 17]: it is listed with its guard, repeatKey, inputs and every refusal, and has its /docs entry', async () => {
  needDecl();
  const { a } = await main();
  const e = ((a.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'add-to-concept');
  assert(e, `graph add-to-concept is listed; problems: ${show((a.req('list').body.data || {}).problems)}`);
  assert(e.kind === 'write' && e.access === 'owner-and-admins' && show(e.guards) === show([RULE]) && show(e.repeatKey) === show(['node', 'concept', 'set']),
    `a write for the owner and admins, guard ${RULE}, repeatKey [node, concept, set]; got ${show({ kind: e.kind, access: e.access, guards: e.guards, repeatKey: e.repeatKey })}`);
  const ins = e.inputs || {};
  assert(ins.node && ins.node.required === true && ins.concept && ins.concept.required === true && ins.set && !ins.set.required && ins.fields && !ins.fields.required,
    `node and concept are required, set and fields not (Decision 1); got ${show(ins)}`);
  const kinds = ((ins.fields.schema || {}).oneOf || []).map((x) => x.type).sort();
  assert(show(kinds) === show(['object', 'string']), `fields takes an object or its JSON text; got ${show(ins.fields.schema)}`);
  const status = Object.fromEntries((e.refusals || []).map((x) => [x.code, x.status]));
  const want = { 'not-installed': 409, 'unknown-node': 404, 'tag-node': 409, 'made-elsewhere': 409, 'unknown-concept': 404, 'reserved-key': 409, 'no-superset': 409, 'not-a-set': 409, 'not-in-class-thread': 409, 'bad-fields': 400, 'bad-name': 400, 'unreadable-json': 409, 'name-in-use': 409, 'invalid-fields': 400, 'no-schema': 409 };
  for (const [code, st] of Object.entries(want)) assert(status[code] === st, `its refusals include ${code} (${st}), Decision 17's; got ${show(status)}`);
  for (const code of ['missing-input', 'invalid-input', 'unknown-input', 'wrong-content-type', 'sign-in-required', 'not-allowed']) assert(code in status, `its refusals include ${code}; got ${show(Object.keys(status))}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('add-to-concept-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

// ── Decision 4: the locks ──
test('AT20 [Decision 4, AC4]: each add locks the node first, then the concept\'s header, before any read; a repeat writes nothing but its locks', async () => {
  needDecl();
  const { file, k } = await fresh();
  const from = S.readState(file).log.length;
  const { a } = runOn(file, [add('first', k.commandBeagle, k.pet, { fields: { description: 'locked' } }), add('again', k.commandBeagle, k.pet, { fields: { description: 'locked' } })]);
  assert(a.req('first').status === 200 && a.req('first').body.data.outcome === 'added' && a.req('again').body.data.outcome === 'already-element',
    `the path under test ran: added, then already-element; got ${show(['first', 'again'].map((id) => a.req(id).body)).slice(0, 400)}`);
  const txns = transactions(S.readState(file).log, from);
  assert(txns.length === 2 && txns.every((t) => t.end === 'commit'), `one committed transaction for each call; got ${show(txns.map((t) => t.end))}`);
  for (const [t, id] of [[txns[0], 'first'], [txns[1], 'again']]) {
    const four = t.steps.slice(0, 4);
    assert(four.length === 4 && four.every((x) => x.call === 'tx.run' && x.kind === 'copies'), `${id}: it starts with two locks, each set and removed, before any read; got ${show(four)}`);
    const keys = four.map((x) => (Array.isArray(x.keys) ? x.keys.join(',') : null));
    assert(show(keys) === show([k.commandBeagle, k.commandBeagle, k.pet, k.pet]), `${id}: the node's lock, then the concept header's (Decision 4); got ${show(keys)}`);
  }
  const againWrites = txns[1].steps.filter((x) => x.call === 'tx.run');
  assert(againWrites.length === 4 && againWrites.every((x) => x.kind === 'copies'), `the repeat writes nothing but its locks; got ${show(againWrites)}`);
});

// ── ADR 0042's waiting, through Sch.fits (Amendment 1, item 12) ──
test('AT48 [AC3, Amendment 1 item 12]: an add into a set word\'s thread holds reports word as waiting for the derive step, not failing, and is made', async () => {
  needDecl();
  // Firmware's word with its real schema, which requires the graphContext only the derive step builds, as
  // create-element's CE34 gives it. The seed's commonSet sits under beagle's superset and word's.
  const real = fs.readFileSync(path.join(ROOT, 'firmware/versions/v1.0.0/concepts/word/json-schema.json'), 'utf8');
  const { file, k, u } = await fresh((s, keys) => {
    const header = s.nodes.find((n) => n.props.tapestryKey === keys.word);
    const node = { eid: s.nextEid++, labels: ['NostrEvent', 'ListItem', 'JSONSchema', 'TapestryNode'], props: { uuid: `39999:${TA}:word-json-schema`, kind: 39999, pubkey: TA, name: 'JSON schema for the concept of words', created_at: 1763000000, tapestryKey: '00000000-0000-4000-8000-0000000000e6' } };
    const tag = { eid: s.nextEid++, labels: ['NostrEventTag', 'TapestryNode'], props: { type: 'json', value: real, uuid: 'word-json-schema-json', tapestryKey: '00000000-0000-4000-8000-0000000000e7' } };
    s.nodes.push(node, tag);
    s.rels.push({ eid: s.nextEid++, type: 'IS_THE_JSON_SCHEMA_FOR', from: node.eid, to: header.eid, props: {} });
    s.rels.push({ eid: s.nextEid++, type: 'HAS_TAG', from: node.eid, to: tag.eid, props: {} });
  });
  const { a } = runOn(file, [add('into-words', k.whiskers, k.beagle, { set: k.commonSet, fields: { description: 'a cat among common words' } })]);
  const x = a.req('into-words');
  assert(x.status === 200 && x.body.data && x.body.data.outcome === 'added', `Whiskers joins beagle through common words: nothing refuses it for word, whose graphContext only the derive step can build; got ${x.status} ${show(x.body).slice(0, 400)}`);
  const cs = x.body.data.concepts || [];
  assert(cs[0] && cs[0].concept === k.beagle && cs[0].fits === true && cs[0].waiting === false, `beagle, the concept named, first, fitting and waiting for nothing; got ${show(cs)}`);
  const word = cs.find((c) => c.concept === k.word);
  assert(word && word.key === 'word' && word.fits === null && word.waiting === true && show(word.problems) === show([]) && /derive step/.test(String(word.problem)),
    `word's schema requires graphContext: word is reported as waiting for the derive step, not as failing (ADR 0042 Decisions 3 and 4); got ${show(word || cs)}`);
  const pet = cs.find((c) => c.concept === k.pet);
  assert(pet && pet.fits === true && pet.waiting === false, `pet, which it was already in, still fits; got ${show(pet)}`);
  const g = S.readState(file);
  assert(show(C.json(g, k.whiskers).word.wordTypes) === show(['word', 'pet', 'beagle']), `wordTypes gains beagle, word's key aside (Decision 9); got ${show(C.json(g, k.whiskers).word)}`);
  const added = C.tagArrays(g, k.whiskers).filter((t) => t[0] === 'n');
  assert(show(added) === show([['n', u.commonSet]]), `its would-be n names common words; got ${show(added)}`);
  const Ajv = require(require.resolve('ajv', { paths: [ROOT] }));
  const declared = require(DECL).result.schema.properties.concepts;
  assert(declared && declared.items && Array.isArray(declared.items.required) && declared.items.required.includes('waiting'), `the declared answer's concepts entry requires waiting (X.CONCEPTS); got ${show(declared)}`);
  const valid = new Ajv({ allErrors: true, strict: false }).compile(declared);
  assert(valid(cs), `the answer's concepts validate against the declared answer, word's waiting entry too; got ${show(valid.errors)}`);
});

// ── review round 1 (ADR Amendment 2, items 1 and 2): a missing section, and the keys a set joins ──
let FILL = null;
/** One run: AT4's Fetch, and Snowy kept beside, each put in dog through walkers and then given pet's section; Mark Me put in dog, then in walkers. */
function fill() {
  if (FILL) return FILL;
  FILL = (async () => {
    const { file, k } = await fresh();
    const before = S.readState(file);
    const { a } = runOn(file, [
      add('into-walkers', k.fetch, k.dog, { set: k.walkers }),
      add('fill-pet', k.fetch, k.pet, { fields: { description: 'Fetch, a pet through walkers' } }),
      add('fill-pet-again', k.fetch, k.pet, { fields: { description: 'Fetch, a pet through walkers' } }),
      add('peer-into-walkers', k.snowy, k.dog, { set: k.walkers }),
      add('peer-fill-pet', k.snowy, k.pet, { fields: { description: 'Snowy, a pet through walkers' } }),
      add('mark-dog', k.markMe, k.dog),
      add('mark-walkers', k.markMe, k.dog, { set: k.walkers }),
    ]);
    return { a, k, file, before };
  })();
  return FILL;
}
async function filled(id) {
  needDecl();
  const x = (await fill()).a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body).slice(0, 600)}`);
  return x.body.data;
}

test('AT49 [AC2, AC4, Amendment 2 item 1]: a node already in the concept whose JSON lacks its section is given it: added, section-added, no new link; then it is already-element', async () => {
  const entered = await filled('into-walkers');
  assert(entered.outcome === 'added', `the path under test ran: Fetch joins dog through walkers, and pet with it, with no pet section (AT4's state); got ${show(entered).slice(0, 300)}`);
  const d = await filled('fill-pet');
  const { k, file, before } = await fill();
  const g = S.readState(file);
  assert(d.outcome === 'added' && d.kept === 'json-tag', `Fetch is in pet through walkers, but its JSON has no pet section: add-to-concept gives it one, added, not already-element (Amendment 2, item 1); got ${show(d).slice(0, 400)}`);
  assert(show(C.json(g, k.fetch).pet) === show({ name: 'Fetch', slug: 'fetch', description: 'Fetch, a pet through walkers' }) && show(C.json(g, k.fetch).dog) === show({ name: 'Fetch', slug: 'fetch' }),
    `its JSON gains pet's section, built as a new one is, and its dog section is as it was; got ${show(C.json(g, k.fetch))}`);
  const sec = changeOf(d, 'section-added');
  assert(sec.length === 1 && sec[0].concept === k.pet && sec[0].field === 'pet' && wasNone(sec[0]) && show(sec[0].now) === show(C.json(g, k.fetch).pet), `the entry records section-added for pet; got ${show(d.change)}`);
  assert(changeOf(d, 'membership-added').length === 0 && show(into(g, k.fetch)) === show([k.beagleSuperset, k.walkers].sort()), `no new link: pet already reaches it through walkers; got ${show(changeOf(d, 'membership-added'))}, in from ${show(into(g, k.fetch))}`);
  const pet = (d.concepts || []).find((c) => c.concept === k.pet);
  assert(d.concepts[0].concept === k.pet && pet.fits === true, `pet, the concept named, first, now fitting; got ${show(d.concepts)}`);
  const again = await filled('fill-pet-again');
  assert(again.outcome === 'already-element' && again.change === null && show(again.differs) === show([]), `now that its view holds pet's section, the same call is already-element, changing nothing (AC4); got ${show(again).slice(0, 300)}`);
  void before;
});

test('AT50 [AC5, Amendment 2 item 1]: the same for a node kept beside: its missing section goes into tapestryOwnSections, beside the dog section it has, and its letter stays', async () => {
  const entered = await filled('peer-into-walkers');
  assert(entered.outcome === 'added' && entered.kept === 'beside', `the path under test ran: Snowy, another author's, joins dog through walkers, beside its letter; got ${show(entered).slice(0, 300)}`);
  const d = await filled('peer-fill-pet');
  const { k, file, before } = await fill();
  const g = S.readState(file);
  assert(d.outcome === 'added' && d.kept === 'beside', `Snowy is in pet through walkers, and neither its letter nor the owner's sections hold pet's section: it is given one, added (Amendment 2, item 1); got ${show(d).slice(0, 400)}`);
  assert(show(ownSections(g, k.snowy)) === show({ dog: { name: 'Snowy', slug: 'snowy' }, pet: { name: 'Snowy', slug: 'snowy', description: 'Snowy, a pet through walkers' } }), `tapestryOwnSections holds the dog section it had and the pet section it is given; got ${show(nodeByKey(g, k.snowy).props.tapestryOwnSections)}`);
  const sec = changeOf(d, 'section-added');
  assert(sec.length === 1 && sec[0].field === 'pet' && sec[0].property === 'tapestryOwnSections', `section-added, naming tapestryOwnSections; got ${show(d.change)}`);
  assert(changeOf(d, 'membership-added').length === 0 && show(into(g, k.snowy)) === show([k.beagleSuperset, k.walkers].sort()), `no new link; got ${show(into(g, k.snowy))}`);
  assert(show(C.tagArrays(g, k.snowy)) === show(C.tagArrays(before, k.snowy)), "Snowy's letter, its tags and json tag, is as it was");
});

test('AT51 [AC6, Amendment 2 item 1]: a removal that also leaves a second concept is undone by add-to-concept: Goldie back into golden retriever, then dog with dog\'s fields from the entry, both sections as they were', async () => {
  needDecl();
  const { file, k } = await fresh();
  const was = C.json(S.readState(file), k.goldie);
  const fieldsOf = (section) => Object.fromEntries(Object.entries(section).filter(([f]) => f !== 'name' && f !== 'slug'));
  const { a } = runOn(file, [
    { id: 'out', method: 'POST', url: '/api/tapestry/graph/remove-from-concept', caller: 'owner', body: { node: k.goldie, concept: k.goldenRetriever } },
    add('back-gr', k.goldie, k.goldenRetriever, { fields: fieldsOf(was.goldenRetriever) }),
    add('back-dog', k.goldie, k.dog, { fields: fieldsOf(was.dog) }),
  ]);
  const out = a.req('out');
  const removed = out.status === 200 ? (out.body.data.change.changes || []).filter((c) => c.change === 'section-removed') : [];
  assert(removed.length === 2 && show(removed.map((c) => c.field).sort()) === show(['dog', 'goldenRetriever']), `the path under test ran: Goldie leaves golden retriever, and dog with it, its entry keeping both sections (RM6); got ${out.status} ${show(out.body).slice(0, 300)}`);
  const gr = a.req('back-gr');
  assert(gr.status === 200 && gr.body.data.outcome === 'added', `back into golden retriever, with its fields: added; got ${gr.status} ${show(gr.body).slice(0, 300)}`);
  const dog = a.req('back-dog');
  assert(dog.status === 200 && dog.body.data.outcome === 'added' && (dog.body.data.change.changes || []).some((c) => c.change === 'section-added' && c.field === 'dog'),
    `Goldie is in dog again, through golden retriever, with no dog section: add-to-concept with dog's fields from the entry gives it back, added, not already-element (Amendment 2, item 1); got ${dog.status} ${show(dog.body).slice(0, 400)}`);
  const now = C.json(S.readState(file), k.goldie);
  assert(show(now.dog) === show(was.dog) && show(now.goldenRetriever) === show(was.goldenRetriever) && show(now.pet) === show(was.pet), `both sections are as they were before the removal; got ${show(now)}`);
  assert(show([...now.word.wordTypes].sort()) === show([...was.word.wordTypes].sort()), `and wordTypes names the same concepts again; got ${show(now.word.wordTypes)}`);
});

test('AT52 [AC2, Amendment 2 item 2]: a node already in the concept, put in a set another concept also reaches, gains that concept\'s key in wordTypes, recorded', async () => {
  const first = await filled('mark-dog');
  const { k, file } = await fill();
  assert(first.outcome === 'added', `the path under test ran: Mark Me joins dog directly; got ${show(first).slice(0, 300)}`);
  const d = await filled('mark-walkers');
  const g = S.readState(file);
  assert(d.outcome === 'added' && (d.concepts || []).some((c) => c.concept === k.pet), `put in walkers, it joins pet too, listed in the answer; got ${show(d).slice(0, 400)}`);
  const j = C.json(g, k.markMe);
  assert(show(j.word.wordTypes) === show(['word', 'beagle', 'dog', 'pet']), `its wordTypes gains pet, the other concept walkers reaches, as a new membership's does (AC2; Amendment 2, item 2); got ${show(j.word.wordTypes)}`);
  const w = changeOf(d, 'field-changed').filter((c) => c.field === 'word.wordTypes');
  assert(w.length === 1 && show(w[0].was) === show(['word', 'beagle', 'dog']) && show(w[0].now) === show(['word', 'beagle', 'dog', 'pet']), `the entry records field-changed on word.wordTypes; got ${show(d.change)}`);
  assert(!('pet' in j) && show(j.dog) === show({ name: 'Mark Me', slug: 'mark-me' }), `and no section for pet, which wasn't named; dog's is as it was; got ${show(j)}`);
});

// ── review round 2 (ADR Amendment 3, items 1, 4 and 5): a call that changes the node's JSON is judged; one that doesn't is reported ──
let ROUND2 = null;
/**
 * Three runs over one seed, each read back after it. SETUP: Mark Me put in dog, with no breed; Fetch, and Snowy kept
 * beside, put in dog through walkers, so each is in pet with no pet section (AT49's and AT50's state); Bare, whose
 * beagle section holds neither name nor slug, put in show beagles with fields, as AT5 puts rover there; walkerMax,
 * directly in walkers and so in pet with no pet section, put in pet through walkers with fields; and (review round 4)
 * Rover, already in beagle, put in the scroll shelf through beagle. GR: Mark Me, then Command Beagle, put in golden
 * retriever's superset through dog, then Mark Me again with dog's breed given (review round 3), and through dog into
 * show goldens, a set below golden retriever's superset (review round 4). BAD: Fetch and Snowy given pet sections pet's
 * schema refuses. SCROLL (review round 4): Scrolled, already in scroll, put in the scroll shelf through scroll, and
 * Command Beagle given to scroll, a new member. Every call in GR (once Amendment 3 item 1 is built), in BAD and in
 * SCROLL is refused, so each leaves the graph as the run before it left it.
 */
function round2() {
  if (ROUND2) return ROUND2;
  ROUND2 = (async () => {
    const { file, k } = await fresh();
    const before = S.readState(file);
    const setup = runOn(file, [
      add('r2-dog', k.markMe, k.dog),
      add('r2-into-walkers', k.fetch, k.dog, { set: k.walkers }),
      add('r2-peer-into-walkers', k.snowy, k.dog, { set: k.walkers }),
      add('r2-misfit-in-set', k.bare, k.beagle, { set: k.showBeagles, fields: { description: 'bare, and shown' } }),
      add('r2-max-pet', k.walkerMax, k.pet, { set: k.walkers, fields: { description: 'Max, a pet in walkers' } }),
      // review round 4 (Amendment 5, item 2): a beagle put through beagle in the scroll shelf joins scroll, reported
      add('r2-shelf-contrast', k.rover, k.beagle, { set: k.scrollShelf }),
    ]).a;
    const setUp = S.readState(file);
    const gr = runOn(file, [
      add('r2-gr', k.markMe, k.dog, { set: k.goldenRetrieverSuperset }),
      add('r2-new-gr', k.commandBeagle, k.dog, { set: k.goldenRetrieverSuperset }),
      // review round 3 (Amendment 4, item 1): the review's probe 6, Q1, the breed given in the same call
      add('r2-gr-with-breed', k.markMe, k.dog, { set: k.goldenRetrieverSuperset, fields: { breed: 'goldenRetriever' } }),
      // review round 4 (Amendment 5, item 2): through dog into show goldens, a set below golden retriever's superset
      add('r2-deeper', k.markMe, k.dog, { set: k.showGoldens }),
    ]).a;
    const afterGr = S.readState(file);
    const bad = runOn(file, [
      add('r2-pet-bad', k.fetch, k.pet, { fields: { description: 5 } }),
      add('r2-peer-pet-bad', k.snowy, k.pet, { fields: { description: 5 } }),
    ]).a;
    const afterBad = S.readState(file);
    // review round 4 (Amendment 5, item 2): no-schema from a call that writes no section, and a new member's beside it
    const scroll = runOn(file, [
      add('r2-shelf', k.scrolled, k.scroll, { set: k.scrollShelf }),
      add('r2-new-scroll', k.commandBeagle, k.scroll),
    ]).a;
    const afterScroll = S.readState(file);
    const req = (id) => ([setup, gr, bad, scroll].find((x) => x.requests[id]) || setup).req(id);
    return { k, before, setUp, afterGr, afterBad, afterScroll, req };
  })();
  return ROUND2;
}
/** Whether two states hold the same nodes and relationships, change entries among them. */
const unchanged = (a, b) => show(a.nodes) === show(b.nodes) && show(a.rels) === show(b.rels);
const sentencesOf = (text) => String(text || '').split(/(?<=[.!?])\s+/);

test('AT54 [AC3, Amendment 3 item 1]: a node already in dog, with no breed, put in golden retriever\'s superset through dog is refused invalid-fields naming dog.breed, as a new member is: the wordTypes the call would write is judged, and nothing changes', async () => {
  needDecl();
  const { k, setUp, afterGr, req } = await round2();
  const first = req('r2-dog');
  const j = C.json(setUp, k.markMe);
  assert(first.status === 200 && first.body.data.outcome === 'added' && show(j.dog) === show({ name: 'Mark Me', slug: 'mark-me' }) && show(j.word.wordTypes) === show(['word', 'beagle', 'dog']),
    `the path under test ran: Mark Me joined dog, its dog section holding no breed and its wordTypes no goldenRetriever; got ${first.status} ${show(first.body).slice(0, 300)}, its JSON ${show(j)}`);
  const anew = req('r2-new-gr');
  assert(anew.status === 400 && anew.body.code === 'invalid-fields' && anew.body.rule === RULE && /`?dog\.breed`? is required/.test(err(anew.body)),
    `Command Beagle, a new member of dog, put in golden retriever's superset is refused: once wordTypes holds goldenRetriever, dog's schema asks for that breed (its Reverse conditional); got ${anew.status} ${show(anew.body).slice(0, 400)}`);
  const x = req('r2-gr');
  assert(x.status === 400 && x.body.code === 'invalid-fields',
    `Mark Me, already in dog with its section, put in the same set must be refused alike: the call would add goldenRetriever to its wordTypes, a change to its JSON, so dog's schema judges the JSON as the call would leave it (Amendment 3, item 1; AC3); got ${x.status} ${show(x.body).slice(0, 500)}`);
  assert(x.body.rule === RULE && /`?dog\.breed`? is required/.test(err(x.body)) && err(x.body).includes('"dog"') && !/`?goldenRetriever`? is required/.test(err(x.body)),
    `refused by ${RULE} for dog's schema, the concept named, naming dog.breed: golden retriever, which the set joins, is reported, never refused for; got ${show(x.body)}`);
  assert(unchanged(afterGr, setUp) && entriesIn(afterGr).length === entriesIn(setUp).length,
    `nothing changes: no link from golden retriever's superset, no n naming it, wordTypes as it was, no entry; Mark Me is in from ${show(into(afterGr, k.markMe))}, its wordTypes ${show(C.json(afterGr, k.markMe).word.wordTypes)}`);
});

test('AT55 [AC3, Amendment 3 item 1]: a call that leaves the node\'s JSON as it was, writing a set\'s link and its tags alone, isn\'t refused for a misfit the node already had: the named concept\'s verdict is reported', async () => {
  needDecl();
  const { k, before, setUp, req } = await round2();
  const x = req('r2-misfit-in-set');
  assert(x.status === 200 && x.body.data && x.body.data.outcome === 'added',
    `Bare, in beagle with a section holding neither name nor slug, put in show beagles as AT5 puts rover there: added, not refused, since the call changes none of its JSON (Amendment 3, item 1); got ${x.status} ${show(x.body).slice(0, 500)}`);
  const d = x.body.data;
  const beagle = (d.concepts || [])[0];
  assert(beagle && beagle.concept === k.beagle && beagle.fits === false && /beagle\.name/.test(show(beagle.problems)) && /beagle\.slug/.test(show(beagle.problems)),
    `beagle, the concept named, is reported first, not fitting, naming what its section lacks; got ${show(d.concepts)}`);
  assert(show(C.json(setUp, k.bare)) === show(C.json(before, k.bare)) && show(jsonTags(setUp, k.bare).map((t) => t.value)) === show(jsonTags(before, k.bare).map((t) => t.value)),
    `its JSON is exactly as it was; got ${show(C.json(setUp, k.bare))}`);
  const f = byInput(d)['fields.description'];
  assert(f && f.given === 'bare, and shown' && f.holds === 'bare', `the field given is named in differs, with what the section holds, and not written; got ${show(d.differs)}`);
  assert(show(into(setUp, k.bare)) === show([k.beagleSuperset, k.showBeagles].sort()), `it is in show beagles as well as under beagle's superset; got ${show(into(setUp, k.bare))}`);
  const added = C.tagArrays(setUp, k.bare).slice(C.tagArrays(before, k.bare).length);
  assert(show(added) === show([['n', C.node(before, k.showBeagles).props.uuid]]), `the set's would-be n is written; got ${show(added)}`);
  assert(changeOf(d, 'membership-added').length === 1 && changeOf(d, 'tag-added').length === 1 && changeOf(d, 'section-added').length === 0 && changeOf(d, 'field-changed').length === 0,
    `the entry records the set's link and its n alone: no section, no wordTypes; got ${show(d.change && d.change.changes)}`);
});

test('AT56 [AC2, Amendment 3 item 4]: a section given alone to a node already in the concept writes no would-be tag: no z naming the concept, and no n naming a set it is given through', async () => {
  const d = await filled('fill-pet');
  const { k, file, before } = await fill();
  const g = S.readState(file);
  const uuid = (key) => C.node(before, key).props.uuid;
  assert(changeOf(d, 'section-added').length === 1 && changeOf(d, 'membership-added').length === 0, `the path under test ran: Fetch, in pet through walkers, was given pet's section and no link (AT49); got ${show(d.change && d.change.changes)}`);
  assert(changeOf(d, 'tag-added').length === 0 && show(tagsBut(g, k.fetch, 'json')) === show([...tagsBut(before, k.fetch, 'json'), ['z', uuid(k.dog)], ['n', uuid(k.walkers)]]),
    `Fetch's tags are the seed's and the z and n its link through walkers brought, with no z naming pet: the would-be tags go with a link, and a section given alone makes none (Amendment 2, item 1); got ${show(tagsBut(g, k.fetch, 'json'))}, tag-added ${show(changeOf(d, 'tag-added'))}`);
  const r2 = await round2();
  const x = r2.req('r2-max-pet');
  const m = (x.body && x.body.data) || {};
  const was = tagsBut(r2.before, r2.k.walkerMax, 'json');
  const u2 = (key) => C.node(r2.before, key).props.uuid;
  assert(!was.some((t) => (t[0] === 'z' && t[1] === u2(r2.k.pet)) || (t[0] === 'n' && t[1] === u2(r2.k.walkers))), `walkerMax's seed tags name neither pet nor walkers, so a would-be tag would show; got ${show(was)}`);
  assert(x.status === 200 && m.outcome === 'added' && changeOf(m, 'section-added').length === 1 && changeOf(m, 'membership-added').length === 0 && show(C.json(r2.setUp, r2.k.walkerMax).pet) === show({ name: 'Max', slug: 'max', description: 'Max, a pet in walkers' }),
    `the path under test ran: walkerMax, directly in walkers and so in pet, put in pet through walkers, was given pet's section and no link; got ${x.status} ${show(x.body).slice(0, 400)}`);
  assert(changeOf(m, 'tag-added').length === 0 && show(tagsBut(r2.setUp, r2.k.walkerMax, 'json')) === show(was),
    `no tag is written, neither a z naming pet nor an n naming walkers: a node given its section through a set it is already directly in gets no link, so no would-be tag; got ${show(tagsBut(r2.setUp, r2.k.walkerMax, 'json'))}, tag-added ${show(changeOf(m, 'tag-added'))}`);
});

test('AT57 [AC3, Amendment 3 item 4]: rule 4 judges the section a node already in the concept is given: fields pet\'s schema refuses are invalid-fields, own or beside, and nothing changes', async () => {
  needDecl();
  const { k, afterGr, afterBad, req } = await round2();
  for (const id of ['r2-into-walkers', 'r2-peer-into-walkers']) {
    const x = req(id);
    assert(x.status === 200 && x.body.data.outcome === 'added', `the path under test ran: ${id} put the node in dog through walkers, and so in pet; got ${x.status} ${show(x.body).slice(0, 300)}`);
  }
  for (const [key, who] of [[k.fetch, 'Fetch'], [k.snowy, 'Snowy']]) {
    const j = C.json(afterGr, key) || {};
    const own = ownSections(afterGr, key) || {};
    assert(show(into(afterGr, key)) === show([k.beagleSuperset, k.walkers].sort()) && !('pet' in j) && !('pet' in own), `${who} is in pet through walkers with no pet section, in its JSON or beside it; got in from ${show(into(afterGr, key))}, ${show({ json: Object.keys(j), beside: Object.keys(own) })}`);
  }
  for (const [id, who] of [['r2-pet-bad', 'Fetch, kept in its json tag'], ['r2-peer-pet-bad', "Snowy, kept beside its author's letter"]]) {
    const x = req(id);
    assert(x.status === 400 && x.body.code === 'invalid-fields' && x.body.rule === RULE && /pet\.description/.test(err(x.body)) && /string/.test(err(x.body)),
      `${who}, given a pet section whose description isn't text: pet's schema judges the section the call writes, invalid-fields naming pet.description (Amendment 2, item 1; Amendment 3, item 4); got ${x.status} ${show(x.body).slice(0, 400)}`);
  }
  assert(unchanged(afterBad, afterGr) && entriesIn(afterBad).length === entriesIn(afterGr).length,
    `nothing changes: neither gains a pet section, and no entry; Fetch's pet ${show(C.json(afterBad, k.fetch).pet)}, Snowy's beside ${show((ownSections(afterBad, k.snowy) || {}).pet)}`);
});

test('AT58 [AC4, Amendment 3 item 5]: the published description says how the fields differs names change: graph update-node for the instance\'s own node, and for a node kept beside another author\'s letter, which update-node refuses, a removal and then an add', async () => {
  needDecl();
  const { a } = await main();
  const e = ((a.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'add-to-concept');
  assert(e, `graph add-to-concept is listed; problems: ${show((a.req('list').body.data || {}).problems)}`);
  const text = String(e.description || '');
  const onDiffers = sentencesOf(text).filter((s) => /differs|update-node/.test(s));
  const beside = sentencesOf(text).filter((s) => /\bbeside\b|another author/i.test(s) && /\bremov(al|als|e|es|ing)\b/i.test(s) && /\badd(s|ed|ing)?\b/i.test(s));
  assert(beside.length > 0, `a sentence says a node kept beside another author's letter changes the fields differs names by a removal and then an add with them (Amendment 3, item 5; ledger row 2026-11-18-update-node-refuses-owner-sections-beside); its sentences on differs are ${show(onDiffers)}`);
  assert(/update-node[^.]*\brefuses\b|\brefuses\b[^.]*update-node|\bnot (through|with|by|via)\b[^.]*update-node/i.test(text),
    `and that graph update-node, which refuses such a node, isn't the way for it; its sentences on differs are ${show(onDiffers)}`);
});

// ── review round 3 (ADR Amendment 4): the words of a member's refusal, and of the way for a node kept beside ──
/** What Amendment 4 item 1 adds to a refusal: fields left unwritten, or a way on through another operation. */
const WAY_ON = /update-node|add-to-concept|remove-from-concept|\bwritten\b|\bmerged\b/i;

test('AT59 [AC8, Amendment 4 item 1]: Mark Me\'s refusal, from a call that writes no section, says fields given in it aren\'t written into the section it holds, and names the way on: golden retriever, then dog\'s breed with update-node', async () => {
  needDecl();
  const { k, req } = await round2();
  for (const [id, what] of [['r2-gr', 'with no fields (AT54)'], ['r2-gr-with-breed', "with dog's breed given in the same call (the review's probe 6, Q1)"]]) {
    const x = req(id);
    const text = err(x.body);
    assert(x.status === 400 && x.body.code === 'invalid-fields' && x.body.rule === RULE && /`?dog\.breed`? is required/.test(text),
      `the path under test ran: ${id}, Mark Me, already in dog with its section, put in golden retriever's superset through dog ${what}, is refused invalid-fields by ${RULE}, naming dog.breed (AT54); got ${x.status} ${show(x.body).slice(0, 400)}`);
    const sentences = sentencesOf(text);
    const unwritten = sentences.filter((s) => /\bfields?\b/i.test(s) && /\bsections?\b/i.test(s) && /\b(aren't|are not|isn't|is not|not|never|doesn't|does not|won't)\b/i.test(s) && /\b(written|write|writes|merged|merge|merges)\b/i.test(s));
    assert(unwritten.length > 0,
      `${id}: the refusal says fields given in this call aren't written into a section the node already holds, since the call writes no section, so giving the breed here can't help (Amendment 4, item 1; the review's R3-1); got ${show(text)}`);
    const first = sentences.filter((s) => (/golden[ -]?retriever/i.test(s) || s.includes(k.goldenRetriever)) && /\badd(s|ed|ing)?\b|add-to-concept/i.test(s));
    assert(first.length > 0,
      `${id}: it names the way on, first: add Mark Me to golden retriever, the concept the set joins, which reports dog's verdict without refusing; got ${show(text)}`);
    const then = sentences.filter((s) => /update-node/.test(s) && /\bdog\b|\bbreed\b/i.test(s));
    assert(then.length > 0,
      `${id}: then: give dog's missing field, its breed, with graph update-node, Mark Me being one of this instance's own nodes; got ${show(text)}`);
  }
});

test('AT60 [AC8, Amendment 4 item 1]: a refused call that writes a section keeps the rule\'s plain message, with no such way on: a new member\'s, Command Beagle\'s, and a member\'s given its missing section, own or beside', async () => {
  needDecl();
  const { req } = await round2();
  for (const [id, schema, who] of [
    ['r2-new-gr', 'dog', "Command Beagle, a new member of dog, put in golden retriever's superset (AT54)"],
    ['r2-pet-bad', 'pet', "Fetch, in pet through walkers, given pet's missing section with a description that isn't text (AT57)"],
    ['r2-peer-pet-bad', 'pet', "Snowy, the same, kept beside (AT57)"],
  ]) {
    const x = req(id);
    const text = err(x.body);
    assert(x.status === 400 && x.body.code === 'invalid-fields' && x.body.rule === RULE, `the path under test ran: ${id} is refused invalid-fields by ${RULE}; got ${x.status} ${show(x.body).slice(0, 400)}`);
    assert(text.startsWith(`The element's JSON doesn't fit the JSON schema of "${schema}"`) && !WAY_ON.test(text),
      `${who}: the call writes the section its fields go into, so its refusal is the rule's own message, saying nothing of fields left unwritten or of another operation (Amendment 4, item 1 is for a call that writes no section); got ${show(text)}`);
  }
});

test('AT61 [AC4, Amendment 4 item 2]: the published description says a removal and then an add change the owner\'s own section of any node kept beside, and that a section the author\'s letter holds, for a membership their letter claims, stays theirs', async () => {
  needDecl();
  const { a } = await main();
  const e = ((a.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'add-to-concept');
  assert(e, `graph add-to-concept is listed; problems: ${show((a.req('list').body.data || {}).problems)}`);
  const sentences = sentencesOf(e.description);
  const onBeside = sentences.filter((s) => /\bbeside\b/i.test(s) && /\bremov(al|als|e|es|ing)\b/i.test(s) && /\badd(s|ed|ing)?\b/i.test(s));
  const owners = onBeside.filter((s) => /\bowner['’]s own sections?\b/i.test(s));
  assert(owners.length > 0,
    `a sentence says what a removal and then an add change for a node kept beside: the owner's own section (Amendment 4, item 2; the review's R3-2); its sentences on a node kept beside are ${show(onBeside)}`);
  const theirs = sentences.filter((s) => /\b(the author['’]s|their) letter holds\b/i.test(s) && /\bletter claims\b/i.test(s) && /\b(stays|remains) theirs\b/i.test(s));
  assert(theirs.length > 0,
    `and that a section the author's letter holds, for a membership their letter claims, stays theirs: such a removal is refused author-claim (the review's probe 6, Q2); got ${show(onBeside)}`);
  assert(owners.some((s) => /\bkept beside\b(?!\s+another author)/i.test(s)),
    `the sentence is for every node kept beside, not only one beside another author's letter: person nodes, placeholders and firmware's own elements are kept beside too, and update-node refuses them as well; got ${show(owners)}`);
});

// ── review round 4 (ADR Amendment 5, items 1 and 2): the keys the way on gives, so an agent can follow it as written ──
/**
 * AT59's two refusals, and the same call into show goldens, below golden retriever's superset, each with its sentences:
 * the way on's add (the one naming add-to-concept) and its update-node.
 */
async function wayOnOf() {
  const r2 = await round2();
  return ['r2-gr', 'r2-gr-with-breed', 'r2-deeper'].map((id) => {
    const x = r2.req(id);
    const text = err(x.body);
    assert(x.status === 400 && x.body.code === 'invalid-fields' && x.body.rule === RULE && /`?dog\.breed`? is required/.test(text),
      `the path under test ran: ${id}, Mark Me put in golden retriever's superset through dog, is refused invalid-fields by ${RULE} for dog.breed (AT54, AT59); got ${x.status} ${show(x.body).slice(0, 400)}`);
    const sentences = sentencesOf(text);
    return { id, text, add: sentences.filter((s) => /add-to-concept/.test(s)), update: sentences.filter((s) => /update-node/.test(s)) };
  });
}
/** Whether `text` gives `key` as the input `input`: the input's name, then the key, a space or a backtick between. */
const gives = (text, input, key) => new RegExp(`\\b${input}\\b\\W{0,4}${key.replace(/[^0-9A-Za-z]/g, (c) => `\\${c}`)}`).test(text);

test('AT62 [AC8, Amendment 5 item 1]: the way on gives golden retriever, the concept to add Mark Me to, by its tapestryKey, beside its name and address, since add-to-concept\'s concept takes a tapestryKey', async () => {
  needDecl();
  const { k, before } = await round2();
  const address = C.node(before, k.goldenRetriever).props.uuid;
  for (const w of await wayOnOf()) {
    const named = w.add.filter((s) => /golden retriever/i.test(s) && s.includes(address));
    assert(named.length > 0, `${w.id}: the way on's add names golden retriever by its name and address, as round 3 built it; got ${show(w.text)}`);
    assert(named.some((s) => s.includes(k.goldenRetriever)),
      `${w.id}: and by its tapestryKey, ${k.goldenRetriever}: the address, ${address}, is refused as add-to-concept's concept (400 invalid-input, the review's probe 7), so an agent would need graph resolve first (Amendment 5, item 1; the review's R4-1); its add reads ${show(named)}`);
  }
});

test('AT63 [AC8, Amendment 5 item 2]: the way on\'s add gives the refused call\'s own set as its set: golden retriever\'s superset, or show goldens below it, never the superset of the concept it joins in its place', async () => {
  needDecl();
  const { k } = await round2();
  const own = { 'r2-gr': k.goldenRetrieverSuperset, 'r2-gr-with-breed': k.goldenRetrieverSuperset, 'r2-deeper': k.showGoldens };
  for (const w of await wayOnOf()) {
    assert(w.add.some((s) => gives(s, 'set', own[w.id])),
      `${w.id}: the add puts Mark Me in the set the refused call named, ${own[w.id]}, so the call made again is a repeat (Amendment 5, item 2; the review's R4-2); its add reads ${show(w.add)}`);
  }
  const deeper = (await wayOnOf()).find((w) => w.id === 'r2-deeper');
  assert(!deeper.add.some((s) => gives(s, 'set', k.goldenRetrieverSuperset)),
    `r2-deeper: show goldens is below golden retriever's superset, so the add doesn't give that superset, ${k.goldenRetrieverSuperset}, as its set in the call's place; its add reads ${show(deeper.add)}`);
});

test('AT64 [AC8, Amendment 5 item 2]: the way on\'s update-node gives dog\'s tapestryKey, the concept named, as its concept', async () => {
  needDecl();
  const { k } = await round2();
  for (const w of await wayOnOf()) {
    assert(w.update.some((s) => gives(s, 'concept', k.dog)),
      `${w.id}: update-node is told dog, ${k.dog}: by then Mark Me is in beagle, dog and golden retriever, and update-node with no concept is refused concept-needed (the review's probe 7c; Amendment 5, item 2); its update-node reads ${show(w.update)}`);
  }
});

test('AT65 [AC3, AC8, Amendment 5 item 2]: a no-schema refusal from a call that writes no section keeps the rule\'s plain message, word for word a new member\'s, with no way-on words: Scrolled put in the scroll shelf through scroll', async () => {
  needDecl();
  const { k, before, afterBad, afterScroll, req } = await round2();
  const j = C.json(before, k.scrolled) || {};
  assert(show(into(before, k.scrolled)) === show([k.scrollSuperset]) && show(j.scroll) === show({ name: 'Scrolled', slug: 'scrolled' }) && show((j.word || {}).wordTypes) === show(['word', 'scroll']),
    `the path under test: Scrolled is in scroll, holding its section, kept in its json tag, and beagle isn't in its wordTypes; got in from ${show(into(before, k.scrolled))}, its JSON ${show(j)}`);
  const plain = req('r2-new-scroll');
  assert(plain.status === 409 && plain.body.code === 'no-schema' && plain.body.rule === RULE, `the path under test ran: Command Beagle, given to scroll as a new member, is refused no-schema by ${RULE} (AT41's ns-scroll); got ${plain.status} ${show(plain.body).slice(0, 300)}`);
  const x = req('r2-shelf');
  assert(x.status === 409 && x.body.code === 'no-schema' && x.body.rule === RULE,
    `Scrolled put in the scroll shelf, which beagle's superset holds too, through scroll: the call writes no section but adds beagle to its wordTypes, so rule 4 judges scroll, which has no schema node: 409 no-schema (Amendment 3, item 1); got ${x.status} ${show(x.body).slice(0, 400)}`);
  assert(err(x.body) === err(plain.body) && !WAY_ON.test(err(x.body)),
    `the refusal is the rule's plain message, word for word a new member's, saying nothing of fields left unwritten or of another operation: the way on mends a misfit, not a missing schema (Amendment 5, item 2; the review's R4-2 and Q5); got ${show(err(x.body))}; a new member's: ${show(err(plain.body))}`);
  assert(unchanged(afterScroll, afterBad) && entriesIn(afterScroll).length === entriesIn(afterBad).length,
    `nothing changes: Scrolled is in from ${show(into(afterScroll, k.scrolled))}, its wordTypes ${show((C.json(afterScroll, k.scrolled).word || {}).wordTypes)}`);
});

test('AT66 [AC3, Amendment 3 item 1; Amendment 5 item 2]: a concept with no schema that a membership joins is reported, never refused for: Rover, already in beagle, put in the scroll shelf through beagle joins scroll and is added', async () => {
  needDecl();
  const { k, before, setUp, req } = await round2();
  const x = req('r2-shelf-contrast');
  assert(x.status === 200 && x.body.data && x.body.data.outcome === 'added',
    `Rover put in the scroll shelf through beagle: beagle, the concept named, judges its JSON, scroll now in its wordTypes, and it fits. Scroll, which the set joins, has no schema node, and is reported, since the other concepts a membership joins never refuse it (Amendment 3, item 1); got ${x.status} ${show(x.body).slice(0, 400)}`);
  const cs = x.body.data.concepts || [];
  const sc = cs.find((c) => c.concept === k.scroll);
  assert(cs[0] && cs[0].concept === k.beagle && cs[0].fits === true && sc && sc.fits === null && sc.waiting === false && /no JSON schema/i.test(String(sc.problem)),
    `beagle first, fitting; scroll reported with fits null, saying it has no schema; got ${show(cs)}`);
  assert(show(C.json(setUp, k.rover).word.wordTypes) === show([...C.json(before, k.rover).word.wordTypes, 'scroll']) && show(into(setUp, k.rover)) === show([k.beagleSuperset, k.scrollShelf].sort()),
    `its wordTypes gains scroll, and it is in the scroll shelf as well as under beagle's superset; got ${show(C.json(setUp, k.rover).word.wordTypes)}, in from ${show(into(setUp, k.rover))}`);
});

// ── REF: every refusal, over a graph that must end as it began ──
let REF = null;
function ref() {
  if (REF) return REF;
  REF = (async () => {
    const { file, k } = await fresh();
    const before = S.readState(file);
    const cb = (id, concept, extra = {}) => add(id, k.commandBeagle, concept, extra);
    const me = (slug) => cb(`mec-${slug}`, k.fw[slug]);
    const { a } = runOn(file, [
      post('visitor', 'visitor', { node: k.commandBeagle, concept: k.pet }),
      post('stranger', 'stranger', { node: k.commandBeagle, concept: k.pet }),
      post('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ node: k.commandBeagle, concept: k.pet }) }),
      // the node
      add('u-node', NOBODY, k.pet),
      add('u-entry', k.G, k.pet),
      add('tag', k.luckyJsonTag, k.pet),
      add('men-header', k.beagle, k.pet),
      add('men-superset', k.beagleSuperset, k.pet),
      add('men-schema', k.beagleNodes.jsonSchema, k.pet),
      add('men-property', k.propertyNode, k.pet),
      add('men-set', k.walkers, k.pet),
      add('men-rule', k.ruleElement, k.pet),
      // the concept
      cb('uc-random', NOBODY),
      cb('uc-element', k.rover),
      cb('rk-word', k.word),
      cb('rk-other-word', k.otherWord),
      cb('rk-graph-context', k.graphContextConcept),
      cb('no-superset', k.widgets[0]),
      ...['concept-header', 'superset', 'json-schema', 'primary-property', 'properties-set', 'property-tree-graph', 'concept-graph', 'core-nodes-graph', 'set', 'property', 'graph-rule'].map(me),
      // the set
      cb('un-set', k.beagle, { set: NOSET }),
      cb('nas-element', k.beagle, { set: k.rover }),
      cb('nas-header', k.beagle, { set: k.beagle }),
      cb('lap', k.dog, { set: k.lapPets }),
      // fields and names
      cb('f-text-bad', k.pet, { fields: 'not json' }),
      cb('f-text-array', k.pet, { fields: '[1, 2]' }),
      cb('f-text-null', k.pet, { fields: 'null' }),
      cb('f-array', k.pet, { fields: [1] }),
      cb('f-name', k.pet, { fields: { name: 'Someone Else', description: 'x' } }),
      cb('f-slug', k.pet, { fields: { slug: 'other-slug', description: 'x' } }),
      cb('f-long', k.pet, { fields: { description: 'z'.repeat(1000000) } }),
      add('n-blank', k.personNode, k.pet, { fields: { name: '   ', description: 'x' } }),
      // JSON that can't be read
      add('uj-twofer', k.twofer, k.pet, { fields: { description: 'x' } }),
      add('uj-garble', k.garble, k.pet, { fields: { description: 'x' } }),
      add('uj-phantom', k.phantom, k.pet, { fields: { description: 'x' } }),
      add('uj-listy', k.listy, k.pet, { fields: { description: 'x' } }),
      add('uj-peer', k.peerGarbled, k.gadget, { fields: { size: 1 } }),
      add('uj-own', k.peerBadOwn, k.gadget, { fields: { size: 1 } }),
      // review round 1, finding 5 (ADR Amendment 2, item 5): Twofer is in beagle already
      add('uj-repeat', k.twofer, k.beagle, { fields: { description: 'x' } }),
      // name-in-use
      add('niu-name', k.petLucky, k.beagle, { fields: { description: 'x' } }),
      add('niu-address', k.petOdie, k.beagle, { fields: { description: 'x' } }),
      add('niu-owner', k.petPatch, k.beagle, { fields: { description: 'x' } }),
      add('niu-firmware', k.firmwareRover, k.beagle, { fields: { description: 'x' } }),
      // rule 4
      cb('if-gadget-missing', k.gadget),
      cb('if-gadget-type', k.gadget, { fields: { size: 'big' } }),
      add('if-beagle-type', k.whiskers, k.beagle, { fields: { description: 5 } }),
      add('if-nameless', k.personNode, k.beagle, { fields: { description: 'a person with no name given' } }),
      cb('ns-scroll', k.scroll),
      cb('ns-teapot', k.teapot, { fields: { description: 'x' } }),
      cb('ns-kettle', k.kettle, { fields: { description: 'x' } }),
      cb('ns-lantern', k.lantern, { fields: { description: 'x' } }),
      cb('ns-compass', k.compass, { fields: { description: 'x' } }),
      // inputs
      post('i-missing', 'owner', {}),
      post('i-type', 'owner', { node: 5, concept: k.pet }),
      post('i-unknown', 'owner', { node: k.commandBeagle, concept: k.pet, color: 'red' }),
      post('i-pattern', 'owner', { node: 'not-a-key', concept: k.pet }),
    ], {
      spy: true,
      cli: [{ id: 'cli-refused', argv: ['graph', 'add-to-concept', '--node', k.commandBeagle, '--concept', k.gadget] }],
    });
    return { a, k, file, before };
  })();
  return REF;
}
async function refused(id, status, code) {
  needDecl();
  const x = (await ref()).a.req(id);
  assert(x.status === status && x.body.code === code, `${id} must be refused ${status} ${code}; got ${x.status} ${show(x.body).slice(0, 600)}`);
  return x.body;
}

test('AT30 [AC9]: a visitor gets 401, a stranger 403, a text/plain body 415; the command\'s refusal is the route\'s', async () => {
  needDecl();
  const { a } = await ref();
  const [v, s, t] = ['visitor', 'stranger', 'text'].map((id) => a.req(id));
  assert(v.status === 401 && s.status === 403 && t.status === 415, `401, 403 and 415; got ${v.status} ${s.status} ${t.status}`);
  const c = a.cmd('cli-refused');
  assert(c.code === 1, `a refused command exits 1; got ${c.code} ${c.stdout} ${c.stderr}`);
  const rb = JSON.parse(c.stdout);
  const route = a.req('if-gadget-missing').body;
  assert(rb.code === 'invalid-fields' && rb.code === route.code && rb.error === route.error && rb.rule === route.rule, `the command's refusal is the route's; command ${show(rb)}, route ${show(route)}`);
});

test('AT31 [AC8, Decision 2]: a node that names no node, or a change entry, is unknown-node, naming node', async () => {
  for (const id of ['u-node', 'u-entry']) {
    const body = await refused(id, 404, 'unknown-node');
    assert(body.input === 'node', `${id}: names the input node; got ${show(body)}`);
  }
});

test('AT32 [AC8, Decision 2]: a tag is refused tag-node: part of a letter, and no element', async () => {
  const body = await refused('tag', 409, 'tag-node');
  assert(body.input === 'node' && err(body).length > 20, `tag-node names the input and says why, in words; got ${show(body)}`);
});

test('AT33 [AC8, Decision 2]: a node another operation looks after is refused made-elsewhere, naming the operation', async () => {
  const want = { 'men-header': /update-concept/, 'men-superset': /update-concept/, 'men-schema': /set-schema/, 'men-property': /update-property/, 'men-set': /./, 'men-rule': /rulebook/ };
  for (const [id, op] of Object.entries(want)) {
    const body = await refused(id, 409, 'made-elsewhere');
    assert(body.input === 'node' && op.test(err(body)), `${id}: made-elsewhere, naming node and the operation (${op}); got ${show(body)}`);
  }
});

test('AT34 [AC8, Decision 3]: a concept that names no header is unknown-concept; one keyed word or graphContext is reserved-key; one with no superset no-superset', async () => {
  for (const id of ['uc-random', 'uc-element']) {
    const body = await refused(id, 404, 'unknown-concept');
    assert(body.input === 'concept', `${id}: names the input concept; got ${show(body)}`);
  }
  for (const [id, key] of [['rk-word', 'word'], ['rk-other-word', 'word'], ['rk-graph-context', 'graphContext']]) {
    const body = await refused(id, 409, 'reserved-key');
    assert(body.input === 'concept' && err(body).includes(key), `${id}: reserved-key, naming the key ${key}; got ${show(body)}`);
  }
  await refused('no-superset', 409, 'no-superset');
});

test('AT35 [AC8, Decision 3]: a concept whose elements another operation makes is refused made-elsewhere, naming that operation', async () => {
  const by = { 'graph create-concept': ['concept-header', 'superset', 'json-schema', 'primary-property', 'properties-set', 'property-tree-graph', 'concept-graph', 'core-nodes-graph'], 'graph create-set': ['set'], 'graph add-property': ['property'] };
  for (const [op, slugs] of Object.entries(by)) {
    for (const slug of slugs) {
      const body = await refused(`mec-${slug}`, 409, 'made-elsewhere');
      assert(err(body).includes(op), `${slug}: names ${op}; got ${err(body)}`);
    }
  }
  assert(/rulebook|GRAPH_RULES/.test(err(await refused('mec-graph-rule', 409, 'made-elsewhere'))), 'graph-rule names the rulebook');
});

test('AT36 [AC8, Decision 3]: a set that names no node, isn\'t a set, or is outside the concept\'s class thread is refused, naming set', async () => {
  const { k } = await ref();
  const un = await refused('un-set', 404, 'unknown-node');
  assert(un.input === 'set', `unknown-node names the input set; got ${show(un)}`);
  const el = await refused('nas-element', 409, 'not-a-set');
  assert(el.input === 'set', `an element is not a set; got ${show(el)}`);
  const h = await refused('nas-header', 409, 'not-a-set');
  assert(err(h).includes(k.beagleSuperset), `a concept header names its superset, the key to pass; got ${err(h)}`);
  const lap = await refused('lap', 409, 'not-in-class-thread');
  assert(lap.input === 'set' && err(lap).includes(k.dogSuperset), `a set of pet's alone is outside dog's class thread, naming dog's superset; got ${show(lap)}`);
});

test('AT37 [AC8, Decision 7]: fields that aren\'t an object or its text, give another name or slug, or make JSON too long are bad-fields; a blank name from fields is bad-name', async () => {
  for (const id of ['f-text-bad', 'f-text-array', 'f-text-null', 'f-name', 'f-slug', 'f-long']) {
    const body = await refused(id, 400, 'bad-fields');
    assert(body.input === 'fields' && err(body).length > 10, `${id}: bad-fields, naming the input, in words; got ${show(body).slice(0, 300)}`);
  }
  assert(/1,?000,?000|million/.test(err(await refused('f-long', 400, 'bad-fields'))), 'the length refusal says the limit');
  const arr = (await ref()).a.req('f-array');
  assert(arr.status === 400 && ['invalid-input', 'bad-fields'].includes(arr.body.code) && arr.body.input === 'fields', `a list is neither an object nor its text; got ${arr.status} ${show(arr.body)}`);
  const blank = await refused('n-blank', 400, 'bad-name');
  assert(blank.input === 'fields', `a nameless node's name comes from fields, so bad-name names fields (Amendment 1, item 8); got ${show(blank)}`);
});

test('AT38 [AC8, Decision 5]: JSON that can\'t be read is refused unreadable-json: own or beside', async () => {
  for (const id of ['uj-twofer', 'uj-garble', 'uj-phantom', 'uj-listy', 'uj-peer', 'uj-own']) {
    const body = await refused(id, 409, 'unreadable-json');
    assert(body.input === 'node' && err(body).length > 20, `${id}: unreadable-json, naming node, saying why; got ${show(body).slice(0, 300)}`);
  }
});

test('AT39 [AC8, Decision 8]: an own node is refused name-in-use where another of the instance\'s own elements has its name, sits at its address, or is the owner\'s', async () => {
  const { k } = await ref();
  for (const [id, other, why] of [['niu-name', k.lucky, 'lucky, by name, case aside'], ['niu-address', k.odie, 'odie, at the address the name Odie gives'], ['niu-owner', k.patch, "the owner's Patch"]]) {
    const body = await refused(id, 409, 'name-in-use');
    assert(err(body).includes(other), `${id}: names the element that has it: ${why}; got ${show(body)}`);
  }
});

test('AT47 [AC8, Decision 8, Amendment 1 item 5]: firmware\'s own element, kept beside but at the assistant\'s address, is refused name-in-use where the instance\'s own element of its name is', async () => {
  const { k } = await ref();
  const body = await refused('niu-firmware', 409, 'name-in-use');
  assert(body.input === 'node' && err(body).includes(k.rover), `firmware's rover can't join beagle beside the instance's own Rover: create-element's repeat would have two answers; the refusal names beagle's rover; got ${show(body)}`);
});

test('AT53 [AC8, Amendment 2 item 5]: a node already in the concept whose JSON can\'t be read is refused unreadable-json, not answered already-element: the JSON is read before the repeat', async () => {
  const { k } = await ref();
  const body = await refused('uj-repeat', 409, 'unreadable-json');
  assert(body.input === 'node' && /json tags/.test(err(body)), `Twofer, in beagle with two json tags that differ: whether its view holds beagle's section can't be told, so unreadable-json, before the repeat (Decision 8's steps 5 and 7 swapped); got ${show(body)}`);
  void k;
});

test('AT40 [AC3]: fields that don\'t fit are refused invalid-fields by element-fits-schema, every problem named; no value is made up', async () => {
  const missing = await refused('if-gadget-missing', 400, 'invalid-fields');
  assert(missing.rule === RULE && /`?gadget\.size`? is required/.test(err(missing)), `a required field left out is named, never filled in; got ${show(missing)}`);
  const type = await refused('if-gadget-type', 400, 'invalid-fields');
  assert(/gadget\.size/.test(err(type)) && /integer/.test(err(type)), `the wrong type names the field and the type; got ${err(type)}`);
  const desc = await refused('if-beagle-type', 400, 'invalid-fields');
  assert(/beagle\.description/.test(err(desc)) && /string/.test(err(desc)), `a description that isn't text is named; got ${err(desc)}`);
  const nameless = await refused('if-nameless', 400, 'invalid-fields');
  assert(/beagle\.name/.test(err(nameless)) && /beagle\.slug/.test(err(nameless)), `a node with no name, given none: its section has no name or slug, and the schema decides (Decision 7); got ${err(nameless)}`);
});

test('AT41 [AC3]: a concept whose schema is missing, can\'t be read or doesn\'t compile is refused no-schema', async () => {
  for (const id of ['ns-scroll', 'ns-teapot', 'ns-kettle', 'ns-lantern', 'ns-compass']) {
    const body = await refused(id, 409, 'no-schema');
    assert(body.rule === RULE, `${id}: no-schema from ${RULE}; got ${show(body)}`);
  }
});

test('AT42: inputs are checked: missing, the wrong type, unknown, not a key', async () => {
  needDecl();
  const { a } = await ref();
  for (const [id, code] of [['i-missing', 'missing-input'], ['i-type', 'invalid-input'], ['i-unknown', 'unknown-input'], ['i-pattern', 'invalid-input']]) {
    const x = a.req(id);
    assert(x.status === 400 && x.body.code === code, `${id}: 400 ${code}; got ${x.status} ${show(x.body)}`);
  }
});

test('AT43 [AC3, AC8]: the refusal run changed nothing and recorded nothing, and signed nothing', async () => {
  await refused('if-gadget-missing', 400, 'invalid-fields');
  await refused('uj-own', 409, 'unreadable-json');
  const { file, before, a } = await ref();
  const after = S.readState(file);
  assert(entriesIn(after).length === entriesIn(before).length, `no change entry was recorded; ${entriesIn(before).length} before, ${entriesIn(after).length} after`);
  assert(show(after.nodes) === show(before.nodes) && show(after.rels) === show(before.rels), 'the graph is as it was: every refusal comes before anything is written');
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signed or read a key; the spy saw ${show(a.spy)}`);
});

test('AT44 [Decision 2]: with no assistant key it is refused not-installed, and nothing changes', async () => {
  needDecl();
  const { file, k } = await fresh();
  const before = S.readState(file);
  const { a } = runOn(file, [add('ni', k.commandBeagle, k.pet, { fields: { description: 'x' } })], { env: (dir) => { const env = S.childEnv(dir); delete env.TA_PUBKEY; return env; } });
  const x = a.req('ni');
  assert(x.status === 409 && x.body.code === 'not-installed', `409 not-installed; got ${x.status} ${show(x.body)}`);
  const after = S.readState(file);
  assert(show(after.nodes) === show(before.nodes) && show(after.rels) === show(before.rels), 'and nothing changes');
});

test('AT45: an add whose entry can\'t be recorded keeps nothing', async () => {
  needDecl();
  const { file, k } = await fresh((s) => { s.failures = { entry: true }; });
  const before = S.readState(file);
  const { a } = runOn(file, [add('fail', k.commandBeagle, k.pet, { fields: { description: 'doomed' } })]);
  assert(a.req('fail').status === 500, `the write fails; got ${a.req('fail').status} ${show(a.req('fail').body).slice(0, 300)}`);
  const after = S.readState(file);
  assert(show(after.nodes) === show(before.nodes) && show(after.rels) === show(before.rels), 'and keeps neither the link, nor the section, nor the tag (ADR 0004 Decision 3)');
});

test('AT46 [Decision 4]: an add whose node a delete removed while it waited answers unknown-node, never a 500', async () => {
  needDecl();
  const { file, k } = await fresh((s, keys) => { s.failures = { vanish: { key: keys.commandBeagle } }; });
  const { a } = runOn(file, [add('vanished', k.commandBeagle, k.pet, { fields: { description: 'too late' } })]);
  const x = a.req('vanished');
  assert(x.status === 404 && x.body.code === 'unknown-node', `unknown-node from its second try (ADR 0026 Decision 6); got ${x.status} ${show(x.body).slice(0, 300)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
