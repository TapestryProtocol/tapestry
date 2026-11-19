'use strict';
/**
 * graph create-element — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/20-create-element.md (AC1–AC6, AC7's guard, and AC8
 *          over the fake; the live check covers the rest)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0020-create-element.md (Decisions 1–10, 13–15, 18)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/20-create-element.test-plan.md
 *
 * Stack-free: the real catalog, over a graph test/helpers/createElementGraph.js seeds for test/helpers/graphFake.js (it
 * says what the graph holds), and over test/helpers/fieldGraph.js's for the marks, with the harness's spy on
 * everything that signs or reads a key. Three runs: MAIN makes elements and repeats them; REF holds every refusal, so
 * its graph must end as it began; AFTER reads MAIN's graph back through history and list-elements.
 *
 *   CE1  the owner makes Snoopy, a beagle: one node under beagle's superset, no NostrEvent, keyed, its name its
 *        tapestryValue; the answer gives its key, address, concept and parents, and its entry element-created
 *   CE2  Snoopy is the letter today's create-element would sign, recorded without signing: address, kind, author,
 *        tags d, name, z and json in that order with the import's uuids, and word-wrapper JSON with keys in order
 *   CE3  graph history finds Snoopy's entry by the element and by the concept, Ribbon's by its set; list-elements
 *        lists Snoopy among beagle's elements
 *   CE4  a name is trimmed and its white space collapsed; a slug in fields equal to the name's is taken; the section
 *        holds name, slug, then the fields as given, and no value is made up for a field left out; text fields work
 *   CE5  in a set: Buddy goes directly in the golden retrievers' superset, its n tag naming it, and belongs to dog and
 *        golden retriever, both in wordTypes and the answer; golden retriever's schema is reported, not refused
 *   CE6  in a set two concepts reach: Max, in walkers, belongs to dog and pet; a set that is the concept's own
 *        superset is the same as none; every concepts entry, the named concept's too, says whether it waits for the
 *        derive step, as the declared answer says it does (story graph-operations-first-slice #42, AC4; ADR 0042
 *        Decision 4)
 *   CE7  the same name again is already-exists, changes nothing and records nothing, and differs names what differs:
 *        the name's case, the set, each field given; a repeat checks no fields
 *   CE8  the repeat is found anywhere in the class thread, by name or by the address the name gives, with or without
 *        a nonce: the plain address wins, then the lowest key; today's lettered rover is one
 *   CE9  another author's element of the same name is no repeat: this instance's own is made beside it
 *   CE10 an address held by a node outside the class thread makes the element take the next nonce
 *   CE11 a concept of another author takes an element, as do another author's concept named set and firmware's
 *        relationship type and graph; two schemas with one $id both check
 *   CE12 each transaction of the run starts with the lock, before any read
 *   CE13 nothing is signed; an admin's create is the admin's; the command creates one too, as the command's
 *   CE14 it is listed with its guard, repeatKey, inputs and every refusal, and has its /docs entry
 *   CE15 the change entry's fields name, slug and from describe an element and the set it was made in
 *   CE16 the catalog's §2 row gives create-element as built: its inputs, its rule and what it reports
 *   CE17 (review round 1) a repeat compares fields as JSON, a nested __proto__ key included
 *   CE20 fields that don't fit are refused invalid-fields by element-fits-schema, each problem named in words
 *   CE21 more than twenty problems: twenty named, and how many more
 *   CE22 a schema that is missing, can't be read, or doesn't compile is refused no-schema, saying why
 *   CE23 a concept that names no concept header is unknown-concept, and one with no superset no-superset
 *   CE24 a set that names no node, that isn't a set, or that is outside the concept's class thread is refused
 *   CE25 each name problem is refused bad-name, naming the input
 *   CE26 fields that aren't a JSON object or its text, give another name or slug, or make JSON too long: bad-fields
 *   CE27 a concept whose elements another operation makes is refused made-elsewhere, naming that operation
 *   CE28 inputs are checked: missing, the wrong type, unknown
 *   CE29 a visitor gets 401, a stranger 403, a text/plain body 415; the command's refusal is the route's
 *   CE30 the refusal run changed nothing and recorded nothing
 *   CE31 with no assistant key it is refused not-installed, and nothing changes
 *   CE32 a write whose entry can't be recorded keeps nothing
 *   CE33 (review round 1, ADR 0020 Amendment 1) a concept keyed word or graphContext is refused reserved-key before
 *        anything is built: firmware's word, with no schema or with its real one, another author's word, and graph
 *        context; nothing changes
 *   CE34 (story 42's review round 2) an element made in a set under word's thread, with firmware word's real schema,
 *        is made: the named concept fits, and word is reported as waiting for the derive step, not as failing; the
 *        answer validates against the declared one
 *   CE40 the marks: Biscuit carries dog's marked fields as dog_breed and dog_age in the same write, its entry records
 *        the copies, and what can't be carried comes back as skipped
 *   CE41 the new modules require nothing that signs
 *   Story graph-operations-first-slice #19 (ADR graph-operations-first-slice/0019 Decision 8; its test plan), over
 *   test/helpers/enumerationGraph.js's seed with its links (prepareLinked), in runs of their own:
 *   CE50 a value a link doesn't allow is refused value-not-allowed by enumerated-value-allowed, naming the field, the
 *        value, the source and the way on; a name, a list holding one, a nested field's, a peer's below the cutoff,
 *        an uppercase key; nothing is written
 *   CE51 allowed references are made: the instance's own, a scored peer's, one in a set below, a list of them, a
 *        nested one; a null, and a field left out, aren't judged
 *   CE52 the values follow the source with no further call: an element create-element adds to it is allowed at once;
 *        one taken out with remove-from-concept, or deleted, is refused
 *   CE53 Grok Bots' tangled concept, its link today's route's, is checked all the same
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const C = require('../../helpers/conceptGraph');
const E = require('../../helpers/createElementGraph');
const FG = require('../../helpers/fieldGraph');
const { names } = require('../../helpers/todaysCreateConcept');

const { ROOT, TA, OWNER, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph create-element');

const ROUTE = '/api/tapestry/graph/create-element';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/create-element.js');
const RULE = 'element-fits-schema';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOBODY = '00000000-0000-4000-8000-0000000000cc';
const NOSET = '00000000-0000-4000-8000-0000000000dd';
const dtag = require(path.join(ROOT, 'src/lib/dtag.js'));

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/create-element.js does not exist yet (ADR graph-operations-first-slice/0020 Decision 1)');
}
const post = (id, caller, body, extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body, ...extra });
const get = (id, url) => ({ id, method: 'GET', url, caller: 'owner' });

/** One harness run over a state file; { r, a }. */
function runOn(file, requests, { cli = [], spy = false, env = null } = {}) {
  const dir = path.dirname(file);
  const r = S.runHarness({ spy, scenarios: [{ graphFake: { stateFile: file }, requests, cli }] }, { dir, env: env ? env(dir) : null });
  return { r, a: S.answered(r) };
}
/** A fresh seed in a directory of its own; { file, k, u, seed }. */
async function fresh(mutate = null) {
  const seed = await E.seedCreateElement();
  if (mutate) mutate(seed.state, seed.keys);
  return { file: seed.file(tmp('create-element-')), k: seed.keys, u: seed.uuids, seed };
}

// ── MAIN: makes elements and repeats them ──
let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    const { file, k, u } = await fresh();
    const before = S.readState(file);
    const beagle = (id, name, fields, extra = {}) => post(id, 'owner', { concept: k.beagle, name, ...(fields === undefined ? {} : { fields }), ...extra });
    const { a } = runOn(file, [
      beagle('snoopy', 'Snoopy', { description: 'A beagle who flies.' }),
      beagle('snoopy-again', 'Snoopy', { description: 'A beagle who flies.' }),
      beagle('snoopy-case', 'snoopy', { description: 'A beagle who flies.' }),
      beagle('snoopy-differs', 'Snoopy', { description: 'Another description.', color: 'white' }, { set: k.showBeagles }),
      beagle('snoopy-badtype', 'Snoopy', { description: 5 }),
      beagle('trim', '  Tea   Cup  ', { slug: 'tea-cup', description: 'A small beagle.' }),
      beagle('text-fields', 'Texty', '{"description":"from text"}'),
      beagle('rover', 'Rover', { description: 'A different beagle.' }),
      beagle('lucky', 'Lucky', { description: 'a lucky beagle' }),
      beagle('odie', 'Odie', { description: 'made by an older route, with a bang' }),
      beagle('pluto', 'Pluto', { description: 'at a nonce' }),
      beagle('twin', 'Twin', { description: 'the plain twin' }),
      beagle('echo', 'Echo', { description: 'the lower key' }),
      beagle('snowy', 'Snowy', { description: 'mine' }),
      beagle('biscuit', 'Biscuit', { description: 'a held address' }),
      beagle('ribbon', 'Ribbon', { description: 'a show beagle' }, { set: k.showBeagles }),
      beagle('plain-jane', 'Plain Jane', { description: 'in the superset, named' }, { set: k.beagleSuperset }),
      beagle('n-200', 'y'.repeat(200), { description: 'a long name' }),
      post('buddy', 'owner', { concept: k.dog, name: 'Buddy', set: k.goldenRetrieverSuperset, fields: { breed: 'goldenRetriever' } }),
      post('max', 'owner', { concept: k.dog, name: 'Max', set: k.walkers }),
      post('gadget-ok', 'owner', { concept: k.gadget, name: 'Widget Three', fields: { size: 3, color: 'red' } }),
      post('other-relay', 'owner', { concept: k.relay, name: 'Damus', fields: { description: 'a relay' } }),
      post('other-set', 'owner', { concept: k.otherSet, name: 'Bookshelf', fields: { description: 'a set of shelves' } }),
      post('fw-rt', 'owner', { concept: k.relationshipType, name: 'Mentors', fields: { alias: 'MENTORS' } }),
      post('fw-graph', 'owner', { concept: k.graph, name: 'My Selection' }),
      post('same-id-a', 'owner', { concept: k.sameIdA, name: 'Alpha', fields: { description: 'a' } }),
      post('same-id-b', 'owner', { concept: k.sameIdB, name: 'Beta', fields: { description: 'b' } }),
      post('admin', 'admin', { concept: k.beagle, name: 'Admin Beagle', fields: { description: 'by the admin' } }),
      // A field holding an object with a __proto__ key, given as JSON text, then the repeat with an empty one.
      beagle('nesty', 'Nesty', '{"description":"nested","meta":{"__proto__":{"a":1}}}'),
      beagle('nesty-again', 'Nesty', { description: 'nested', meta: {} }),
      { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
    ], {
      spy: true,
      cli: [
        { id: 'cli', argv: ['graph', 'create-element', '--concept', k.beagle, '--name', 'Command Beagle', '--fields', '{"description":"from the command"}'] },
      ],
    });
    return { a, k, u, file, before };
  })();
  return MAIN;
}
const graph = async () => S.readState((await main()).file);
async function ok(id) {
  needDecl();
  const x = (await main()).a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body)}`);
  return x.body.data;
}
const changeOf = (d, name) => ((d && d.change && d.change.changes) || []).filter((c) => c.change === name);
const entriesNow = (g) => g.nodes.filter((n) => n.labels.includes('GraphChange')).length;
const byInput = (d) => Object.fromEntries(((d && d.differs) || []).map((x) => [x.input, x]));
const sectionOf = (g, key, oKey) => { const j = C.json(g, key); return j && j[oKey]; };
/** The node properties an answer's copies name: a list of names or of { property }, or an object keyed by property. */
const propsOf = (copies) => (Array.isArray(copies) ? copies.map((c) => (typeof c === 'string' ? c : c && c.property)) : copies && typeof copies === 'object' ? Object.keys(copies) : ['(not a list or an object)']).sort();
const beagleTitle = () => names('beagle', 'beagles').oTitles.singular;

test('CE1: the owner makes Snoopy, a beagle: one keyed node under its superset, no NostrEvent, and its entry', async () => {
  const d = await ok('snoopy');
  const { k, u } = await main();
  assert(d.outcome === 'created', `outcome created; got ${show(d)}`);
  const el = d.element;
  const address = E.elementAddress('Snoopy', u.beagle);
  assert(el && UUID.test(String(el.tapestryKey)) && el.address === address && el.name === 'Snoopy' && el.slug === 'snoopy' && el.concept === k.beagle && el.hasLetter === false,
    `it answers the element's key, the address today's route gives the name and concept (${address}), its name, slug, concept and no letter; got ${show(el)}`);
  assert(show(el.parents) === show([k.beagleSuperset]), `with no set it is directly under beagle's superset; got parents ${show(el.parents)}`);
  const g = await graph();
  const n = C.node(g, el.tapestryKey);
  assert(n, 'the element is in the graph');
  assert(show([...n.labels].sort()) === show(['ListItem', 'TapestryNode']), `labels ListItem and the shared label, and no NostrEvent (D7); got ${show(n.labels)}`);
  assert(n.props.name === 'Snoopy' && n.props.tapestryValue === 'Snoopy', `its name is its tapestryValue (D11); got ${show(n.props)}`);
  assert(!('id' in n.props) && n.props.pubkey === TA && n.props.kind === 39999 && Number.isInteger(n.props.created_at), `no id, the assistant as its would-be author, kind 39999, and when it was made; got ${show(n.props)}`);
  assert(show(C.into(g, el.tapestryKey, 'HAS_ELEMENT')) === show([k.beagleSuperset]), `one HAS_ELEMENT, from beagle's superset (D10); got ${show(C.into(g, el.tapestryKey, 'HAS_ELEMENT'))}`);
  const made = changeOf(d, 'element-created');
  assert(made.length === 1 && made[0].node === el.tapestryKey && made[0].concept === k.beagle && made[0].from === k.beagleSuperset && made[0].name === 'Snoopy' && made[0].slug === 'snoopy',
    `its entry records element-created: the node, its concept, the superset it was made in, its name and slug (D15); got ${show(d.change)}`);
  assert(show(d.change.by) === show({ role: 'owner', pubkey: OWNER }) && d.change.operation === 'graph create-element', `the entry is the owner's, through graph create-element; got ${show(d.change)}`);
  assert(/backup/i.test(String(d.note)), `the answer notes that only a backup keeps it (BIBLE §30); got ${show(d.note)}`);
  assert(show(d.differs) === show([]) && propsOf(d.copies).length === 0 && show(d.skipped) === show([]), `nothing differs, and beagle marks nothing; got ${show({ differs: d.differs, copies: d.copies, skipped: d.skipped })}`);
  const cs = d.concepts || [];
  assert(cs.length === 1 && cs[0].concept === k.beagle && cs[0].key === 'beagle' && cs[0].fits === true && show(cs[0].problems) === show([]), `it belongs to beagle alone, and fits its schema; got ${show(cs)}`);
});

test('CE2: Snoopy is the letter today\'s create-element would sign: its address, tags in order with the import\'s uuids, and word-wrapper JSON', async () => {
  const d = await ok('snoopy');
  const { u } = await main();
  const g = await graph();
  const address = E.elementAddress('Snoopy', u.beagle);
  const n = C.node(g, d.element.tapestryKey);
  assert(n.props.uuid === address, `its uuid is the address ${address}; got ${n.props.uuid}`);
  const json = {
    word: { slug: 'beagle--snoopy', name: 'beagle: Snoopy', title: `${beagleTitle()}: Snoopy`, wordTypes: ['word', 'beagle'] },
    beagle: { name: 'Snoopy', slug: 'snoopy', description: 'A beagle who flies.' },
  };
  const want = [['d', address.split(':')[2]], ['name', 'Snoopy'], ['z', u.beagle], ['json', JSON.stringify(json)]];
  const got = C.tagArrays(g, d.element.tapestryKey);
  assert(show(got) === show(want), `its tags are d, name, z naming beagle's header, and json, in that order, the JSON's keys in Decision 8's order: no n tag, and no z stamped for the nostr relay beagle's b pointer names (Decision 9); got ${show(got)}, want ${show(want)}`);
  const uuids = C.tags(g, d.element.tapestryKey).map((t) => t.uuid);
  assert(show(uuids) === show(want.map((t, i) => C.tagUuid(address, t, i))), 'its tag nodes have the uuids the import gives them');
  assert(C.tags(g, d.element.tapestryKey).every((t) => typeof t.key === 'string'), 'each tag node is keyed');
});

test('CE3: graph history finds Snoopy\'s entry by the element and by beagle, Ribbon\'s by its set; list-elements lists Snoopy', async () => {
  const s = await ok('snoopy');
  const r = await ok('ribbon');
  const { file, k } = await main();
  const { a } = runOn(file, [
    get('h-element', `/api/tapestry/graph/history?node=${s.element.tapestryKey}&limit=5`),
    get('h-concept', `/api/tapestry/graph/history?node=${k.beagle}&limit=200`),
    get('h-set', `/api/tapestry/graph/history?node=${k.showBeagles}&limit=5`),
    get('le', `/api/tapestry/graph/list-elements?concept=${k.beagle}&limit=100`),
  ]);
  for (const [id, entry] of [['h-element', s.change.id], ['h-concept', s.change.id], ['h-set', r.change.id]]) {
    const x = a.req(id);
    const ids = x.status === 200 ? x.body.data.entries.map((e) => e.id) : null;
    assert(ids && ids.includes(entry), `${id}: history finds the create's entry; got ${x.status} ${show(x.body).slice(0, 400)}`);
  }
  const le = a.req('le');
  const listed = le.status === 200 ? le.body.data.elements.map((e) => e.tapestryKey) : null;
  assert(listed && listed.includes(s.element.tapestryKey) && listed.includes(r.element.tapestryKey), `list-elements lists Snoopy and Ribbon among beagle's elements; got ${le.status} ${show(le.body).slice(0, 400)}`);
});

test('CE4: a name is trimmed and collapsed; the section holds name, slug, then the fields as given; no value is made up; text fields work', async () => {
  const d = await ok('trim');
  const { u, k } = await main();
  assert(d.outcome === 'created' && d.element.name === 'Tea Cup' && d.element.slug === 'tea-cup' && d.element.address === E.elementAddress('Tea Cup', u.beagle),
    `"  Tea   Cup  " is Tea Cup, its slug tea-cup, and fields' equal slug is taken; got ${show(d.element)}`);
  const g = await graph();
  const sec = sectionOf(g, d.element.tapestryKey, 'beagle');
  assert(show(Object.keys(sec)) === show(['name', 'slug', 'description']) && sec.name === 'Tea Cup' && sec.slug === 'tea-cup', `the section holds name, slug, then description, once each; got ${show(sec)}`);
  const gadget = await ok('gadget-ok');
  const gs = sectionOf(g, gadget.element.tapestryKey, 'gadget');
  assert(show(gs) === show({ name: 'Widget Three', slug: 'widget-three', size: 3, color: 'red' }), `gadget's section holds what was given and nothing made up; got ${show(gs)}`);
  const sel = await ok('fw-graph');
  const ss = sectionOf(g, sel.element.tapestryKey, 'graph');
  assert(show(ss) === show({ name: 'My Selection', slug: 'my-selection' }), `fields left out are {}: the section holds the name and slug alone, no empty values (open question 3); got ${show(ss)}`);
  const t = await ok('text-fields');
  assert(sectionOf(g, t.element.tapestryKey, 'beagle').description === 'from text', 'fields given as JSON text are read as the object it holds (Decision 1)');
  void k;
});

test('CE5: in a set: Buddy goes directly in the golden retrievers\' superset, its n tag naming it, and belongs to dog and golden retriever', async () => {
  const d = await ok('buddy');
  const { k, u } = await main();
  const g = await graph();
  assert(d.outcome === 'created' && show(d.element.parents) === show([k.goldenRetrieverSuperset]) && d.element.concept === k.dog, `Buddy is made directly in the set; got ${show(d.element)}`);
  assert(show(C.into(g, d.element.tapestryKey, 'HAS_ELEMENT')) === show([k.goldenRetrieverSuperset]), `its one HAS_ELEMENT is from the set, not from dog's superset (D10); got ${show(C.into(g, d.element.tapestryKey, 'HAS_ELEMENT'))}`);
  const address = E.elementAddress('Buddy', u.dog);
  const json = { word: { slug: 'dog--buddy', name: 'dog: Buddy', title: 'Dog: Buddy', wordTypes: ['word', 'dog', 'goldenRetriever'] }, dog: { name: 'Buddy', slug: 'buddy', breed: 'goldenRetriever' } };
  const want = [['d', address.split(':')[2]], ['name', 'Buddy'], ['z', u.dog], ['n', u.goldenRetrieverSuperset], ['json', JSON.stringify(json)]];
  assert(show(C.tagArrays(g, d.element.tapestryKey)) === show(want), `its tags: d, name, z naming dog, n naming the set, json, whose wordTypes list dog, then golden retriever (as firmware's rover); got ${show(C.tagArrays(g, d.element.tapestryKey))}`);
  const cs = d.concepts || [];
  assert(cs.length === 2 && cs[0].concept === k.dog && cs[0].key === 'dog' && cs[0].fits === true, `the named concept first, fitting; got ${show(cs)}`);
  const gr = cs[1];
  assert(gr.concept === k.goldenRetriever && gr.key === 'goldenRetriever' && gr.fits === false && (gr.problems || []).some((p) => /goldenRetriever/.test(String(p.message)) && /required/.test(String(p.message))),
    `golden retriever's schema asks for a goldenRetriever section, which Buddy lacks: reported, not refused (open question 2); got ${show(gr)}`);
  const made = changeOf(d, 'element-created')[0];
  assert(made && made.from === k.goldenRetrieverSuperset && made.concept === k.dog, `the entry names the set it was made in; got ${show(made)}`);
});

test('CE6: Max, in walkers, belongs to dog and pet; a set that is the concept\'s own superset is the same as none', async () => {
  const d = await ok('max');
  const { k, u } = await main();
  const g = await graph();
  const j = C.json(g, d.element.tapestryKey);
  assert(show(j.word.wordTypes) === show(['word', 'dog', 'pet']) && show(j.dog) === show({ name: 'Max', slug: 'max' }), `wordTypes list dog then pet, and dog's section holds the name and slug; got ${show(j)}`);
  const n = C.tagArrays(g, d.element.tapestryKey).find((t) => t[0] === 'n');
  assert(n && n[1] === u.walkers, `its n tag names walkers; got ${show(n)}`);
  const keysOf = (d.concepts || []).map((c) => c.concept);
  assert(keysOf[0] === k.dog && keysOf.length === 2 && keysOf.includes(k.pet), `dog first, then pet; got ${show(d.concepts)}`);
  const pet = d.concepts.find((c) => c.concept === k.pet);
  assert(pet.fits === false && pet.key === 'pet' && pet.problems.some((p) => /pet/.test(String(p.message))), `pet's schema wants a pet section, reported; got ${show(pet)}`);
  assert(d.concepts.every((c) => c.waiting === false), `each entry, dog's (the concept named) and pet's, says it waits for nothing: neither schema asks for what the derive step builds (story 42, AC4; ADR 0042 Decision 4); got ${show(d.concepts)}`);
  const entry = require(path.join(ROOT, 'src/operations/catalog/graph/create-element.js')).result.schema.properties.concepts.items;
  assert(entry.required.includes('waiting') && entry.properties.waiting && entry.properties.waiting.type === 'boolean',
    `the declared answer's concepts entry has a required boolean, waiting (ADR 0042 Decision 4); got ${show(entry)}`);
  const Ajv = require(require.resolve('ajv', { paths: [ROOT] }));
  const validConcepts = new Ajv({ allErrors: true, strict: false }).compile(require(path.join(ROOT, 'src/operations/catalog/graph/create-element.js')).result.schema.properties.concepts);
  assert(validConcepts(d.concepts), `the answer's concepts validate against the declared answer, waiting and all (ADR 0042 Decision 4; review round 1, non-blocking 3); got ${show(validConcepts.errors)}`);
  const pj = await ok('plain-jane');
  assert(show(pj.element.parents) === show([k.beagleSuperset]) && !C.tagArrays(g, pj.element.tapestryKey).some((t) => t[0] === 'n'),
    `set = beagle's own superset: directly under it, with no n tag; got ${show(pj.element)} ${show(C.tagArrays(g, pj.element.tapestryKey))}`);
  const rb = await ok('ribbon');
  const rbn = C.tagArrays(g, rb.element.tapestryKey).find((t) => t[0] === 'n');
  assert(rbn && rbn[1] === u.showBeagles && show(rb.element.parents) === show([k.showBeagles]) && show(C.json(g, rb.element.tapestryKey).word.wordTypes) === show(['word', 'beagle']),
    `Ribbon, in show beagles, has its n tag, and only beagle reaches it; got ${show(rb.element)}`);
});

test('CE7: the same name again is already-exists, changes nothing, records nothing, and names what differs; a repeat checks no fields', async () => {
  const first = await ok('snoopy');
  const { k, u } = await main();
  for (const id of ['snoopy-again', 'snoopy-case', 'snoopy-differs', 'snoopy-badtype']) {
    const d = await ok(id);
    assert(d.outcome === 'already-exists' && d.change === null, `${id}: already-exists, change null, so nothing is recorded; got ${show(d)}`);
    assert(d.element.tapestryKey === first.element.tapestryKey && d.element.address === first.element.address, `${id}: it answers the element the first call made`);
    assert(show(d.concepts) === show([]) && propsOf(d.copies).length === 0 && show(d.skipped) === show([]), `${id}: concepts, copies and skipped are empty on a repeat (D14); got ${show(d)}`);
  }
  assert(show((await ok('snoopy-again')).differs) === show([]), 'the same inputs again: nothing differs');
  const c = byInput(await ok('snoopy-case'));
  assert(c.name && c.name.given === 'snoopy' && c.name.holds === 'Snoopy' && Object.keys(c).length === 1, `the name's case differs, so it is named; got ${show(c)}`);
  const f = byInput(await ok('snoopy-differs'));
  assert(f.set && f.set.given === k.showBeagles && show(f.set.holds) === show([k.beagleSuperset]), `a set it isn't directly in is named, with the sets it is in; got ${show(f.set)}`);
  assert(f['fields.description'] && f['fields.description'].given === 'Another description.' && f['fields.description'].holds === 'A beagle who flies.', `a field whose value differs is named, with what it holds, so the agent knows it wasn't saved; got ${show(f)}`);
  assert(f['fields.color'] && f['fields.color'].given === 'white', `a field it doesn't hold is named; got ${show(f)}`);
  const b = byInput(await ok('snoopy-badtype'));
  assert(b['fields.description'] && b['fields.description'].given === 5, `a field of the wrong type on a repeat is only named in differs: a repeat writes nothing, so checks nothing; got ${show(b)}`);
  const g = await graph();
  assert(C.nodesAt(g, E.elementAddress('Snoopy', u.beagle)).length === 1, 'one Snoopy at its address, and none at a nonce');
  assert(sectionOf(g, first.element.tapestryKey, 'beagle').description === 'A beagle who flies.', 'the repeats changed none of its fields');
  assert(show(C.into(g, first.element.tapestryKey, 'HAS_ELEMENT')) === show([k.beagleSuperset]), 'and moved it nowhere');
});

test('CE8: the repeat is found anywhere in the class thread, by name or by address, nonce or not; the plain address wins, then the lowest key', async () => {
  const { k } = await main();
  const cases = [
    ['rover', k.rover, 'today\'s lettered rover, by its name, at an address of its own'],
    ['lucky', k.lucky, 'an element in a set below the superset'],
    ['odie', k.odie, 'an element at the address the name gives, under another name'],
    ['pluto', k.pluto, 'an element at the address the name gives with a nonce'],
    ['twin', k.twinPlain, 'two of that name: the one at the plain address, though its key is higher'],
    ['echo', k.echoLow, 'two of that name at nonces: the lowest key'],
  ];
  for (const [id, want, why] of cases) {
    const d = await ok(id);
    assert(d.outcome === 'already-exists' && d.element.tapestryKey === want && d.change === null, `${id}: ${why}; got ${show(d && d.element)}`);
  }
  const rover = await ok('rover');
  assert(rover.element.hasLetter === true, `rover has a letter; got ${show(rover.element)}`);
  const rd = byInput(rover)['fields.description'];
  assert(rd && rd.holds === 'a good beagle' && rd.given === 'A different beagle.', `rover's description differs; got ${show(rover.differs)}`);
  assert(show((await ok('lucky')).element.parents) === show([k.showBeagles]), 'lucky is answered with the set it is in');
  assert(show((await ok('lucky')).differs) === show([]), 'no set was given, so no set differs');
  const odie = byInput(await ok('odie'));
  assert(odie.name && odie.name.given === 'Odie' && odie.name.holds === 'Odie!', `odie's name differs; got ${show(odie)}`);
  const pluto = byInput(await ok('pluto'));
  assert(pluto.name && pluto.name.holds === 'Planet Pluto', `pluto's name differs; got ${show(pluto)}`);
});

test('CE9: another author\'s element of the same name is no repeat: this instance\'s own is made beside it', async () => {
  const d = await ok('snowy');
  const { k, u } = await main();
  assert(d.outcome === 'created' && d.element.tapestryKey !== k.snowy && d.element.address === E.elementAddress('Snowy', u.beagle), `Snowy is made as this instance's own; got ${show(d.element)}`);
  const g = await graph();
  assert(C.node(g, d.element.tapestryKey).props.pubkey === TA && C.node(g, k.snowy).props.pubkey === E.OTHER, 'beside the other author\'s Snowy, which is untouched');
});

test('CE10: an address held by a node outside the class thread makes the element take the next nonce', async () => {
  const d = await ok('biscuit');
  const { u, k } = await main();
  const held = E.elementAddress('Biscuit', u.beagle);
  assert(d.outcome === 'created' && d.element.address === `${held}~1` && d.element.slug === 'biscuit', `Biscuit is made at ~1, since a node not of beagle holds ${held}; got ${show(d.element)}`);
  const g = await graph();
  const dTag = C.tagArrays(g, d.element.tapestryKey).find((t) => t[0] === 'd');
  assert(dTag && dTag[1] === `${held.split(':')[2]}~1`, `its d tag follows the nonce; got ${show(dTag)}`);
  assert(C.node(g, k.biscuitHolder).props.name === 'not a beagle', 'the node that held the address is untouched');
});

test('CE11: another author\'s concept, another author\'s concept named set, and firmware\'s relationship type and graph each take an element; one $id twice is fine', async () => {
  const { k } = await main();
  const g = await graph();
  const relay = await ok('other-relay');
  const relayHeader = C.node(g, k.relay).props.uuid;
  assert(relay.outcome === 'created' && relay.element.address === `39999:${TA}:${dtag.childDTag('Damus', relayHeader)}`, `an element of another author's concept is this instance's own claim (principle 2); got ${show(relay.element)}`);
  const z = C.tagArrays(g, relay.element.tapestryKey).find((t) => t[0] === 'z');
  assert(z && z[1] === relayHeader, `its z tag names the other author's header; got ${show(z)}`);
  for (const id of ['other-set', 'fw-rt', 'fw-graph', 'same-id-a', 'same-id-b']) {
    const d = await ok(id);
    assert(d.outcome === 'created', `${id}: created; got ${show(d)}`);
  }
  assert(sectionOf(g, (await ok('fw-rt')).element.tapestryKey, 'relationshipType').alias === 'MENTORS', 'the relationship type\'s field is kept');
  const two = await ok('n-200');
  assert(two.outcome === 'created' && two.element.name === 'y'.repeat(200), 'a name of 200 characters is made');
});

test('CE12: each transaction of the run takes the lock first, before any read', async () => {
  assert((await ok('snoopy')).outcome === 'created', 'the path under test ran (CE1 made Snoopy)');
  const log = (await graph()).log;
  const txns = [];
  let cur = null;
  for (const l of log) {
    if (l.call === 'begin') cur = [];
    else if (l.call === 'commit' || l.call === 'rollback') { if (cur) txns.push(cur); cur = null; } else if (cur) cur.push(l);
  }
  const made = txns.filter((t) => t.some((x) => x.call === 'tx.run' && x.kind === 'tags'));
  assert(made.length >= 15, `the fake logged each create's transaction; got ${made.length}`);
  // A transaction refused before its lock (a bad name, say) reads and writes nothing; MAIN has none, REF has those.
  for (const t of txns.filter((x) => x.length)) {
    assert(t[0] && t[0].call === 'tx.run' && t[0].kind === 'copies' && t[1] && t[1].call === 'tx.run' && t[1].kind === 'copies',
      `each transaction (creates and repeats alike) starts with the lock on the concept's header, set and removed, before any read (Decision 7); got ${show(t.slice(0, 3))}`);
  }
});

test('CE13: nothing is signed; an admin\'s create is the admin\'s; the command creates one too, recorded as the command\'s', async () => {
  assert((await ok('snoopy')).outcome === 'created', 'the path under test ran (CE1 made Snoopy)');
  const { a, u } = await main();
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key (ADR 0004 Decision 10, D1); the spy saw ${show(a.spy)}`);
  const ad = await ok('admin');
  assert(ad.outcome === 'created' && show(ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the admin's create is recorded as the admin's; got ${show(ad.change && ad.change.by)}`);
  const c = a.cmd('cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.success === true && body.data.outcome === 'created' && body.data.element.address === E.elementAddress('Command Beagle', u.beagle), `the command answers as the route does, fields given as JSON text; got ${show(body)}`);
  assert(show(body.data.change.by) === show({ role: 'local', pubkey: null }), `its entry names the command; got ${show(body.data.change.by)}`);
  assert(sectionOf(await graph(), body.data.element.tapestryKey, 'beagle').description === 'from the command', 'the command\'s fields are kept');
});

test('CE14: it is listed with its guard, repeatKey, inputs and every refusal, and has its /docs entry', async () => {
  needDecl();
  const { a } = await main();
  const e = ((a.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'create-element');
  assert(e, `graph create-element is listed; problems: ${show((a.req('list').body.data || {}).problems)}`);
  // Story graph-operations-first-slice #19 (ADR 0019 Decision 8): rule 10's guard beside rule 4's, its items empty.
  assert(e.kind === 'write' && e.access === 'owner-and-admins' && show([...(e.guards || [])].sort()) === show([RULE, 'enumerated-value-allowed']) && show(e.repeatKey) === show(['concept', 'name']),
    `a write for the owner and admins, guards ${RULE} and enumerated-value-allowed, repeatKey [concept, name]; got ${show({ kind: e.kind, access: e.access, guards: e.guards, repeatKey: e.repeatKey })}`);
  const ins = e.inputs || {};
  assert(ins.concept && ins.concept.required === true && ins.name && ins.name.required === true && ins.set && !ins.set.required && ins.fields && !ins.fields.required,
    `concept and name are required, set and fields not; got ${show(ins)}`);
  const kinds = ((ins.fields.schema || {}).oneOf || []).map((x) => x.type).sort();
  assert(show(kinds) === show(['object', 'string']), `fields takes an object or its JSON text (Decision 1); got ${show(ins.fields.schema)}`);
  const status = Object.fromEntries((e.refusals || []).map((x) => [x.code, x.status]));
  const want = { 'bad-name': 400, 'bad-fields': 400, 'unknown-concept': 404, 'made-elsewhere': 409, 'no-superset': 409, 'not-installed': 409, 'unknown-node': 404, 'not-a-set': 409, 'not-in-class-thread': 409, 'no-free-address': 409, 'invalid-fields': 400, 'no-schema': 409, 'reserved-key': 409, 'value-not-allowed': 400 };
  for (const [code, st] of Object.entries(want)) assert(status[code] === st, `its refusals include ${code} (${st}), Decision 18's; got ${show(status)}`);
  for (const code of ['missing-input', 'invalid-input', 'unknown-input', 'wrong-content-type', 'sign-in-required', 'not-allowed']) assert(code in status, `its refusals include ${code}; got ${show(Object.keys(status))}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('create-element-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

test('CE15: the change entry\'s fields name, slug and from describe an element and the set it was made in', () => {
  needDecl();
  const { CHANGE } = require(path.join(ROOT, 'src/operations/changes.js'));
  const p = CHANGE.properties || {};
  assert(/element/.test(String(p.name && p.name.description)) && /element/.test(String(p.slug && p.slug.description)), `name's and slug's descriptions cover an element's (Decision 15); got ${show({ name: p.name, slug: p.slug })}`);
  assert(/element/.test(String(p.from && p.from.description)) && /set/.test(String(p.from && p.from.description)), `from's covers the superset or set an element was made in; got ${show(p.from)}`);
});

test('CE16: the catalog\'s §2 row gives create-element as built: its inputs, its rule and what it reports', () => {
  needDecl();
  const text = fs.readFileSync(path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md'), 'utf8');
  const row = text.split('\n').find((l) => l.startsWith('| `create-element` |')) || '';
  assert(row.includes('`concept`') && row.includes('`set?`') && row.includes('`name`') && row.includes('`fields?`') && !/`concept` or `set`/.test(row),
    `its inputs as built: concept and name, set? and fields? (the owner's answer to open question 1); got ${show(row)}`);
  assert(row.includes('`element-fits-schema`') && /differs/.test(row), `it names its rule, and the repeat's report; got ${show(row)}`);
});

test('CE17: a repeat compares the fields given with what the element holds as JSON, a nested __proto__ key included', async () => {
  const first = await ok('nesty');
  assert(first.outcome === 'created', `Nesty is made, its meta holding a __proto__ key; got ${show(first)}`);
  const g = await graph();
  const held = sectionOf(g, first.element.tapestryKey, 'beagle');
  assert(held && held.meta && Object.prototype.hasOwnProperty.call(held.meta, '__proto__'), `the key is stored as an own key of the section's meta; got ${show(held)}`);
  const d = await ok('nesty-again');
  const by = byInput(d);
  assert(d.outcome === 'already-exists' && by['fields.meta'] && show(by['fields.meta'].given) === show({}), `meta given as {} differs from the meta held, whose __proto__ key the comparison must keep (review round 1, non-blocking 2); got ${show(d.differs)}`);
});

// ── REF: every refusal, over a graph that must end as it began ──
let REF = null;
function ref() {
  if (REF) return REF;
  REF = (async () => {
    const { file, k, u } = await fresh();
    const before = S.readState(file);
    const b = (id, body, extra = {}) => post(id, 'owner', { concept: k.beagle, ...body }, extra);
    const fw = (slug) => post(`me-${slug}`, 'owner', { concept: k.fw[slug], name: `An element of ${slug}` });
    const { a } = runOn(file, [
      post('visitor', 'visitor', { concept: k.beagle, name: 'Visitor Dog', fields: { description: 'x' } }),
      post('stranger', 'stranger', { concept: k.beagle, name: 'Stranger Dog', fields: { description: 'x' } }),
      post('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ concept: k.beagle, name: 'Text Dog', fields: { description: 'x' } }) }),
      // rule 4
      post('fido', 'owner', { concept: k.dog, name: 'Fido', fields: { breed: 'goldenRetriever' } }),
      post('rex', 'owner', { concept: k.dog, name: 'Rex', fields: { breed: 'poodle' } }),
      post('gadget-many', 'owner', { concept: k.gadget, name: 'Widget One', fields: { size: 'big', color: 'blue', weight: 3 } }),
      post('gadget-missing', 'owner', { concept: k.gadget, name: 'Widget Two' }),
      post('survey', 'owner', { concept: k.survey, name: 'Poll' }),
      b('beagle-missing', { name: 'Nameless' }),
      b('beagle-type', { name: 'Typo', fields: { description: 5 } }),
      post('ns-scroll', 'owner', { concept: k.scroll, name: 'Parchment' }),
      // the keys an element's JSON keeps for itself (ADR 0020 Amendment 1, item 2)
      post('rk-word', 'owner', { concept: k.word, name: 'Lexeme' }),
      post('rk-other-word', 'owner', { concept: k.otherWord, name: 'Lexeme', fields: { description: 'a word' } }),
      post('rk-graph-context', 'owner', { concept: k.graphContextConcept, name: 'Context', fields: { description: 'a context' } }),
      post('ns-teapot', 'owner', { concept: k.teapot, name: 'Brown Betty', fields: { description: 'x' } }),
      post('ns-kettle', 'owner', { concept: k.kettle, name: 'Whistler', fields: { description: 'x' } }),
      post('ns-lantern', 'owner', { concept: k.lantern, name: 'Glow', fields: { description: 'x' } }),
      post('ns-compass', 'owner', { concept: k.compass, name: 'North', fields: { description: 'x' } }),
      // the concept and the set
      post('uc-random', 'owner', { concept: NOBODY, name: 'Nobody' }),
      post('uc-element', 'owner', { concept: k.rover, name: 'Rover Junior' }),
      post('no-superset', 'owner', { concept: k.widgets[0], name: 'Sprocket' }),
      b('un-set', { name: 'Setless', set: NOSET, fields: { description: 'x' } }),
      b('nas-element', { name: 'In Rover', set: k.rover, fields: { description: 'x' } }),
      b('nas-header', { name: 'In Beagle', set: k.beagle, fields: { description: 'x' } }),
      post('lap', 'owner', { concept: k.dog, name: 'Lapdog', set: k.lapPets }),
      b('crowd', { name: 'Crowd', fields: { description: 'c' } }),
      // names
      b('n-blank', { name: '   ', fields: { description: 'x' } }),
      b('n-noslug', { name: '!!!', fields: { description: 'x' } }),
      b('n-control', { name: 'bad\u0007name', fields: { description: 'x' } }),
      b('n-bidi', { name: 'bi\u202Edi', fields: { description: 'x' } }),
      b('n-zero-width', { name: 'snoo\u200Bpy', fields: { description: 'x' } }),
      b('n-long', { name: 'x'.repeat(201), fields: { description: 'x' } }),
      // fields
      b('f-text-bad', { name: 'Garbled', fields: 'not json' }),
      b('f-text-array', { name: 'Listy', fields: '[1, 2]' }),
      b('f-text-null', { name: 'Nully', fields: 'null' }),
      b('f-array', { name: 'Arrayed', fields: [1] }),
      b('f-name', { name: 'Fieldy', fields: { name: 'Someone Else', description: 'x' } }),
      b('f-slug', { name: 'Sluggo', fields: { slug: 'other-slug', description: 'x' } }),
      b('f-long', { name: 'Longfellow', fields: { description: 'z'.repeat(1000000) } }),
      // made elsewhere
      ...['concept-header', 'superset', 'json-schema', 'primary-property', 'properties-set', 'property-tree-graph', 'concept-graph', 'core-nodes-graph', 'set', 'property', 'graph-rule'].map(fw),
      // inputs
      post('i-missing', 'owner', {}),
      post('i-type', 'owner', { concept: k.beagle, name: 5 }),
      post('i-unknown', 'owner', { concept: k.beagle, name: 'Q', color: 'red' }),
    ], {
      spy: true,
      cli: [{ id: 'cli-refused', argv: ['graph', 'create-element', '--concept', k.beagle, '--name', 'Nameless'] }],
    });
    return { a, k, u, file, before };
  })();
  return REF;
}
async function refused(id, status, code) {
  needDecl();
  const x = (await ref()).a.req(id);
  assert(x.status === status && x.body.code === code, `${id} must be refused ${status} ${code}; got ${x.status} ${show(x.body).slice(0, 600)}`);
  return x.body;
}
const err = (body) => String(body && body.error);

test('CE20: fields that don\'t fit are refused invalid-fields by element-fits-schema, every problem named in words', async () => {
  const fido = await refused('fido', 400, 'invalid-fields');
  assert(fido.rule === RULE, `the refusal comes from the rule ${RULE}; got ${show(fido)}`);
  assert(/word\.wordTypes/.test(err(fido)), `a golden retriever put under dog's superset alone has wordTypes without goldenRetriever, which dog's schema ties to its breed: named; got ${err(fido)}`);
  const rex = await refused('rex', 400, 'invalid-fields');
  assert(/dog\.breed/.test(err(rex)) && /goldenRetriever/.test(err(rex)) && /irishSetter/.test(err(rex)), `a breed the schema doesn't allow names the field and the values allowed; got ${err(rex)}`);
  const many = await refused('gadget-many', 400, 'invalid-fields');
  assert(/gadget\.size/.test(err(many)) && /integer/.test(err(many)), `the wrong type names the field and the type; got ${err(many)}`);
  assert(/gadget\.color/.test(err(many)) && /red/.test(err(many)) && /green/.test(err(many)), `a value not allowed lists the values; got ${err(many)}`);
  assert(/`?gadget\.weight`? isn't a field the schema takes/.test(err(many)), `a field the schema doesn't take is named so; got ${err(many)}`);
  const missing = await refused('gadget-missing', 400, 'invalid-fields');
  assert(/`?gadget\.size`? is required/.test(err(missing)), `a required field left out is named, never filled in (open question 3); got ${err(missing)}`);
  const bm = await refused('beagle-missing', 400, 'invalid-fields');
  assert(/`?beagle\.description`? is required/.test(err(bm)), `an element of a concept today's create-concept made needs its description; got ${err(bm)}`);
  const bt = await refused('beagle-type', 400, 'invalid-fields');
  assert(/beagle\.description/.test(err(bt)) && /string/.test(err(bt)), `a description that isn't text is named; got ${err(bt)}`);
});

test('CE21: more than twenty problems: twenty are named, and how many more', async () => {
  const s = await refused('survey', 400, 'invalid-fields');
  const named = new Set(err(s).match(/survey\.q\d\d/g) || []);
  assert(named.size === 20 && /\b5 (more|others)\b/.test(err(s)), `25 required fields left out: 20 named, then 5 more (Decision 12); got ${named.size}: ${err(s)}`);
});

test('CE22: a concept whose schema is missing, can\'t be read, or doesn\'t compile is refused no-schema, saying why', async () => {
  const cases = [['ns-scroll', /schema/i], ['ns-teapot', /pars/i], ['ns-kettle', /more than one|two|several/i], ['ns-lantern', /LMDB/i], ['ns-compass', /compile/i]];
  for (const [id, why] of cases) {
    const body = await refused(id, 409, 'no-schema');
    assert(body.rule === RULE && why.test(err(body)), `${id}: no-schema from ${RULE}, saying why (${why}); got ${show(body)}`);
  }
});

test('CE23: a concept key that names no concept header is unknown-concept; one with no superset is no-superset', async () => {
  for (const id of ['uc-random', 'uc-element']) {
    const body = await refused(id, 404, 'unknown-concept');
    assert(body.input === 'concept', `${id}: names the input concept; got ${show(body)}`);
  }
  await refused('no-superset', 409, 'no-superset');
});

test('CE24: a set that names no node, that isn\'t a set, or that is outside the concept\'s class thread is refused', async () => {
  const { k } = await ref();
  const un = await refused('un-set', 404, 'unknown-node');
  assert(un.input === 'set', `unknown-node names the input set; got ${show(un)}`);
  const el = await refused('nas-element', 409, 'not-a-set');
  assert(el.input === 'set', `an element is not a set, naming the input; got ${show(el)}`);
  const h = await refused('nas-header', 409, 'not-a-set');
  assert(err(h).includes(k.beagleSuperset), `a concept header names its superset, the key to pass; got ${err(h)}`);
  const lap = await refused('lap', 409, 'not-in-class-thread');
  assert(lap.input === 'set' && err(lap).includes(k.dogSuperset) && /dog/.test(err(lap)), `a set of pet's alone is outside dog's class thread, naming dog and its superset; got ${show(lap)}`);
  await refused('crowd', 409, 'no-free-address');
});

test('CE25: each name problem is refused bad-name, naming the input', async () => {
  for (const id of ['n-blank', 'n-noslug', 'n-control', 'n-bidi', 'n-zero-width', 'n-long']) {
    const body = await refused(id, 400, 'bad-name');
    assert(body.input === 'name' && err(body).length > 10, `${id}: bad-name, naming the input, in words; got ${show(body)}`);
  }
  assert(/invisible/i.test(err(await refused('n-zero-width', 400, 'bad-name'))), 'a zero-width space is named as invisible');
});

test('CE26: fields that aren\'t a JSON object or its text, that give another name or slug, or whose JSON would be too long, are refused', async () => {
  for (const id of ['f-text-bad', 'f-text-array', 'f-text-null', 'f-name', 'f-slug', 'f-long']) {
    const body = await refused(id, 400, 'bad-fields');
    assert(body.input === 'fields' && err(body).length > 10, `${id}: bad-fields, naming the input, in words; got ${show(body).slice(0, 300)}`);
  }
  needDecl();
  const arr = (await ref()).a.req('f-array');
  assert(arr.status === 400 && ['invalid-input', 'bad-fields'].includes(arr.body.code) && arr.body.input === 'fields', `a list is neither an object nor its text; got ${arr.status} ${show(arr.body)}`);
  assert(/1,?000,?000|million/.test(err(await refused('f-long', 400, 'bad-fields'))), 'the length refusal says the limit');
});

test('CE27: a concept whose elements another operation makes is refused made-elsewhere, naming the operation', async () => {
  const by = { 'graph create-concept': ['concept-header', 'superset', 'json-schema', 'primary-property', 'properties-set', 'property-tree-graph', 'concept-graph', 'core-nodes-graph'], 'graph create-set': ['set'], 'graph add-property': ['property'] };
  for (const [op, slugs] of Object.entries(by)) {
    for (const slug of slugs) {
      const body = await refused(`me-${slug}`, 409, 'made-elsewhere');
      assert(err(body).includes(op), `${slug}: names ${op}; got ${err(body)}`);
    }
  }
  assert(/rulebook|GRAPH_RULES/.test(err(await refused('me-graph-rule', 409, 'made-elsewhere'))), 'graph-rule names the rulebook');
});

test('CE28: inputs are checked: missing, the wrong type, unknown', async () => {
  needDecl();
  const { a } = await ref();
  for (const [id, code] of [['i-missing', 'missing-input'], ['i-type', 'invalid-input'], ['i-unknown', 'unknown-input']]) {
    const x = a.req(id);
    assert(x.status === 400 && x.body.code === code, `${id}: 400 ${code}; got ${x.status} ${show(x.body)}`);
  }
});

test('CE29: a visitor gets 401, a stranger 403, a text/plain body 415; the command\'s refusal is the route\'s', async () => {
  needDecl();
  const { a } = await ref();
  const [v, s, t] = ['visitor', 'stranger', 'text'].map((id) => a.req(id));
  assert(v.status === 401 && s.status === 403 && t.status === 415, `401, 403 and 415; got ${v.status} ${s.status} ${t.status}`);
  const c = a.cmd('cli-refused');
  assert(c.code === 1, `a refused command exits 1; got ${c.code} ${c.stdout} ${c.stderr}`);
  const rb = JSON.parse(c.stdout);
  const route = a.req('beagle-missing').body;
  assert(rb.code === route.code && rb.error === route.error && rb.rule === route.rule, `the command's refusal is the route's; command ${show(rb)}, route ${show(route)}`);
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing in the refusal run signed or read a key; the spy saw ${show(a.spy)}`);
});

test('CE30: the refusal run changed nothing and recorded nothing', async () => {
  await refused('beagle-missing', 400, 'invalid-fields');
  const { file, before } = await ref();
  const after = S.readState(file);
  assert(entriesNow(after) === entriesNow(before), `no change entry was recorded; ${entriesNow(before)} before, ${entriesNow(after)} after`);
  assert(show(after.nodes) === show(before.nodes) && show(after.rels) === show(before.rels), 'and the graph is as it was: every refusal comes before anything is written (Decision 2)');
});

test('CE31: with no assistant key it is refused not-installed, and nothing changes', async () => {
  needDecl();
  const { file, k } = await fresh();
  const before = S.readState(file);
  const { a } = runOn(file, [post('ni', 'owner', { concept: k.beagle, name: 'Keyless', fields: { description: 'x' } })], {
    env: (dir) => { const env = S.childEnv(dir); delete env.TA_PUBKEY; return env; },
  });
  const x = a.req('ni');
  assert(x.status === 409 && x.body.code === 'not-installed', `with no assistant, the would-be author, 409 not-installed; got ${x.status} ${show(x.body)}`);
  const after = S.readState(file);
  assert(show(after.nodes) === show(before.nodes), 'and nothing is made');
});

test('CE33: a concept keyed word or graphContext is refused reserved-key before anything is built, naming the key', async () => {
  for (const [id, key] of [['rk-word', 'word'], ['rk-other-word', 'word'], ['rk-graph-context', 'graphContext']]) {
    const body = await refused(id, 409, 'reserved-key');
    assert(body.input === 'concept' && err(body).includes(key) && err(body).length > 40, `${id}: reserved-key, naming the input, the key ${key} and why (ADR 0020 Amendment 1, item 2); got ${show(body)}`);
  }
  // Firmware's word with its real schema, which asks for the derive step's graphContext: refused for its key, not for a
  // field no caller can give.
  const real = fs.readFileSync(path.join(ROOT, 'firmware/versions/v1.0.0/concepts/word/json-schema.json'), 'utf8');
  const { file, k } = await fresh((s) => {
    const header = s.nodes.find((n) => n.props.tapestryKey && n.props.uuid === `39998:${TA}:word`);
    const node = { eid: s.nextEid++, labels: ['NostrEvent', 'ListItem', 'JSONSchema', 'TapestryNode'], props: { uuid: `39999:${TA}:word-json-schema`, kind: 39999, pubkey: TA, name: 'JSON schema for the concept of words', tapestryKey: '00000000-0000-4000-8000-0000000000ee' } };
    const tag = { eid: s.nextEid++, labels: ['NostrEventTag', 'TapestryNode'], props: { type: 'json', value: real, uuid: 'word-json-schema-json', tapestryKey: '00000000-0000-4000-8000-0000000000ef' } };
    s.nodes.push(node, tag);
    s.rels.push({ eid: s.nextEid++, type: 'IS_THE_JSON_SCHEMA_FOR', from: node.eid, to: header.eid, props: {} });
    s.rels.push({ eid: s.nextEid++, type: 'HAS_TAG', from: node.eid, to: tag.eid, props: {} });
  });
  const before = S.readState(file);
  const { a } = runOn(file, [post('rk-word-real', 'owner', { concept: k.word, name: 'Lexeme', fields: { wordTypes: ['word'] } })]);
  const x = a.req('rk-word-real');
  assert(x.status === 409 && x.body.code === 'reserved-key', `firmware's word with its real schema: 409 reserved-key; got ${x.status} ${show(x.body)}`);
  const after = S.readState(file);
  assert(show(after.nodes) === show(before.nodes) && show(after.rels) === show(before.rels), 'and nothing changes');
});

test('CE34: an element made under word\'s thread reports word as waiting for the derive step, not failing, and is made', async () => {
  needDecl();
  // Firmware's word with its real schema, which requires the graphContext only the derive step builds, and beagle's
  // superset put under word's, so word's class thread reaches beagle's elements (story 42's review round 2,
  // non-blocking 4; ADR 0042's Testing: "an element created in a set under word's thread").
  const real = fs.readFileSync(path.join(ROOT, 'firmware/versions/v1.0.0/concepts/word/json-schema.json'), 'utf8');
  const { file, k } = await fresh((s, keys) => {
    const nodeOf = (key) => s.nodes.find((n) => n.props.tapestryKey === key);
    const header = s.nodes.find((n) => n.props.tapestryKey && n.props.uuid === `39998:${TA}:word`);
    const node = { eid: s.nextEid++, labels: ['NostrEvent', 'ListItem', 'JSONSchema', 'TapestryNode'], props: { uuid: `39999:${TA}:word-json-schema`, kind: 39999, pubkey: TA, name: 'JSON schema for the concept of words', tapestryKey: '00000000-0000-4000-8000-0000000000e4' } };
    const tag = { eid: s.nextEid++, labels: ['NostrEventTag', 'TapestryNode'], props: { type: 'json', value: real, uuid: 'word-json-schema-json', tapestryKey: '00000000-0000-4000-8000-0000000000e5' } };
    s.nodes.push(node, tag);
    s.rels.push({ eid: s.nextEid++, type: 'IS_THE_JSON_SCHEMA_FOR', from: node.eid, to: header.eid, props: {} });
    s.rels.push({ eid: s.nextEid++, type: 'HAS_TAG', from: node.eid, to: tag.eid, props: {} });
    s.rels.push({ eid: s.nextEid++, type: 'IS_A_SUPERSET_OF', from: nodeOf(keys.supersets.word).eid, to: nodeOf(keys.beagleSuperset).eid, props: {} });
  });
  const { a } = runOn(file, [post('lexie', 'owner', { concept: k.beagle, name: 'Lexie', fields: { description: 'a beagle among words' } })]);
  const x = a.req('lexie');
  assert(x.status === 200 && x.body.data && x.body.data.outcome === 'created', `Lexie is made: nothing refuses it for word, whose graphContext only the derive step can build; got ${x.status} ${show(x.body)}`);
  const cs = x.body.data.concepts || [];
  assert(cs[0] && cs[0].concept === k.beagle && cs[0].fits === true && cs[0].waiting === false, `beagle, the concept named, comes first, fitting and waiting for nothing; got ${show(cs)}`);
  const word = cs.find((c) => c.concept === k.word);
  assert(word && word.key === 'word' && word.fits === null && word.waiting === true && show(word.problems) === show([]) && /derive step/.test(String(word.problem)),
    `word's schema requires graphContext, which only the derive step builds: word is reported as waiting for it, not as failing (story 42, AC4; ADR 0042 Decisions 3 and 4); got ${show(word || cs)}`);
  const Ajv = require(require.resolve('ajv', { paths: [ROOT] }));
  const validConcepts = new Ajv({ allErrors: true, strict: false }).compile(require(DECL).result.schema.properties.concepts);
  assert(validConcepts(cs), `the answer's concepts validate against the declared answer, word's waiting entry too (ADR 0042 Decision 4); got ${show(validConcepts.errors)}`);
});

test('CE32: a write whose entry can\'t be recorded keeps nothing', async () => {
  needDecl();
  const { file, k, u } = await fresh((s) => { s.failures = { entry: true }; });
  const before = S.readState(file);
  const { a } = runOn(file, [post('fail', 'owner', { concept: k.beagle, name: 'Doomed', fields: { description: 'x' } })]);
  const x = a.req('fail');
  assert(x.status === 500, `the write fails; got ${x.status} ${show(x.body)}`);
  const after = S.readState(file);
  assert(C.nodesAt(after, E.elementAddress('Doomed', u.beagle)).length === 0 && after.nodes.length === before.nodes.length, 'and keeps neither the node nor its tags (ADR 0004 Decision 3)');
});

// ── the marks (AC6), over test/helpers/fieldGraph.js ──
test('CE40: Biscuit carries dog\'s marked fields as dog_breed and dog_age in the same write, its entry records the copies, and what can\'t be carried is skipped', async () => {
  needDecl();
  const seed = FG.seedFields({ marks: [['dog', 'breed'], ['dog', 'age'], ['dog', 'owner'], ['pet', 'name']] });
  const k = seed.keys;
  // pet's superset ─▶ walkers too, so an element in walkers joins pet, whose section it won't have.
  const eid = (key) => seed.state.nodes.find((n) => n.props.tapestryKey === key).eid;
  seed.state.rels.push({ eid: seed.state.nextEid++, type: 'IS_A_SUPERSET_OF', from: eid(k.petSuperset), to: eid(k.walkers), props: {} });
  const file = seed.file(tmp('create-element-marks-'));
  const { a } = runOn(file, [post('marked', 'owner', { concept: k.dog, set: k.walkers, name: 'Biscuit', fields: { breed: 'irishSetter', age: 4, owner: { name: 'Al' } } })]);
  const x = a.req('marked');
  assert(x.status === 200 && x.body.data.outcome === 'created', `Biscuit is made; got ${x.status} ${show(x.body)}`);
  const d = x.body.data;
  const g = S.readState(file);
  const n = C.node(g, d.element.tapestryKey);
  const num = (v) => (v && typeof v === 'object' && typeof v.$int === 'string' ? Number(v.$int) : v);
  assert(n.props.dog_breed === 'irishSetter' && num(n.props.dog_age) === 4 && !('dog_owner' in n.props), `it carries dog_breed and dog_age, not the owner, an object (A10.5); got ${show(n.props)}`);
  assert(show(propsOf(d.copies)) === show(['dog_age', 'dog_breed']), `the answer gives the copies it carries; got ${show(d.copies)}`);
  const sets = changeOf(d, 'copies-set');
  assert(show(sets.map((c) => c.property).sort()) === show(['dog_age', 'dog_breed']) && sets.every((c) => show(c.nodes) === show([d.element.tapestryKey])),
    `its entry records each copy, as the field mapping's writes do (ADR 0005 Amendment 2.7); got ${show(d.change)}`);
  const skipped = d.skipped || [];
  assert(skipped.some((s) => s.field === 'owner' && s.node === d.element.tapestryKey), `the owner, a value no Neo4j property can hold, is skipped; got ${show(skipped)}`);
  assert(skipped.some((s) => s.concept === k.pet && /pet/.test(String(s.reason))), `pet, whose section Biscuit lacks, is skipped (Decision 13); got ${show(skipped)}`);
});

test('CE41: the new modules require nothing that signs, publishes or reads a key', () => {
  const files = ['src/operations/catalog/graph/create-element.js', 'src/operations/catalog/graph/_elements.js', 'src/operations/catalog/graph/_schemas.js', 'src/operations/rules/element-fits-schema.js'];
  for (const f of files) {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) throw new Error(`${f} does not exist yet (ADR graph-operations-first-slice/0020 Implementation notes)`);
    const src = fs.readFileSync(abs, 'utf8');
    const bad = (src.match(/require\(\s*['"][^'"]*['"]\s*\)/g) || []).filter((r) => /nostr-tools|normalize\/helpers|secureKeyStorage|child_process|strfry|signing/.test(r));
    assert(bad.length === 0, `${f} must require nothing that signs (ADR 0004 Decision 10); it requires ${show(bad)}`);
  }
});

// ── story graph-operations-first-slice #19: the rule enumerated-value-allowed in create-element (ADR 0019 Decision 8) ──
const EG = require('../../helpers/enumerationGraph');
const RULE10 = 'enumerated-value-allowed';
function needRule10() {
  needDecl();
  if (!fs.existsSync(path.join(ROOT, `src/operations/rules/${RULE10}.js`))) throw new Error(`src/operations/rules/${RULE10}.js does not exist yet (ADR graph-operations-first-slice/0019 Decision 7): create-element runs it after rule 4 (Decision 8)`);
}
const canon19 = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((o, key) => { o[key] = v[key]; return o; }, {}) : v));
const graphOf19 = (s) => canon19({ nodes: s.nodes, rels: s.rels });

let ENUM = null;
function enumRuns() {
  if (ENUM) return ENUM;
  ENUM = (async () => {
    needRule10();
    const ctx = await EG.prepareLinked('create-element-enumerated');
    const { file, c, el } = ctx;
    const bot = (id, name, fields) => post(id, 'owner', { concept: c.bot, name, fields: { description: `${name}, a bot`, ...fields } });
    const before = S.readState(file);
    const refusedRun = runOn(file, [
      bot('name', 'Bad Name', { project: 'Infinite Harness' }),
      bot('list', 'Bad List', { projects: [EG.ref(el.loom), 'Loom'] }),
      bot('nested', 'Bad Nested', { team: { lead: 'Ada' } }),
      bot('peer-lo', 'Bad Peer', { project: EG.ref(el.peerLo) }),
      bot('upper', 'Bad Upper', { project: `tapestry:${el.loom.toUpperCase()}` }),
      post('grok-name', 'owner', { concept: c.grokBot, name: 'Grok Beta', fields: { description: 'a grok bot', project: 'Infinite Harness' } }),
    ]).a;
    const afterRefused = S.readState(file);
    const made = runOn(file, [
      bot('own', 'Good Own', { project: EG.ref(el.infiniteHarness) }),
      bot('peer-hi', 'Good Peer', { project: EG.ref(el.peerHi) }),
      bot('deep', 'Good Deep', { project: EG.ref(el.deep) }),
      bot('list-ok', 'Good List', { projects: [EG.ref(el.loom), EG.ref(el.infiniteHarness)] }),
      bot('nested-ok', 'Good Nested', { team: { lead: EG.ref(el.ada) } }),
      bot('null-ok', 'Good Null', { nickname: null }),
      bot('absent', 'Good Absent', {}),
      post('grok-ref', 'owner', { concept: c.grokBot, name: 'Grok Gamma', fields: { description: 'a grok bot', project: EG.ref(el.infiniteHarness) } }),
      post('new-source', 'owner', { concept: c.project, name: 'New Project', fields: { description: 'made after the link' } }),
      post('gone-source', 'owner', { concept: c.project, name: 'Gone Project', fields: { description: 'taken out later' } }),
      post('deleted-source', 'owner', { concept: c.project, name: 'Deleted Project', fields: { description: 'deleted later' } }),
    ]).a;
    const keyOf = (id) => { const x = made.req(id); assert(x.status === 200 && x.body.data.outcome === 'created', `${id} must be made; got ${x.status} ${show(x.body).slice(0, 400)}`); return x.body.data.element.tapestryKey; };
    const fresh19 = { newSource: keyOf('new-source'), goneSource: keyOf('gone-source'), deletedSource: keyOf('deleted-source') };
    const follow = runOn(file, [
      bot('after-new', 'Follows New', { project: EG.ref(fresh19.newSource) }),
      { id: 'gone-joins-person', method: 'POST', url: EG.ROUTE.addToConcept, caller: 'owner', body: { node: fresh19.goneSource, concept: c.person, fields: { description: 'a person too' } } },
      { id: 'gone-out', method: 'POST', url: EG.ROUTE.removeFromConcept, caller: 'owner', body: { node: fresh19.goneSource, concept: c.project } },
      { id: 'deleted', method: 'POST', url: EG.ROUTE.deleteNode, caller: 'owner', body: { node: fresh19.deletedSource } },
      bot('after-gone', 'Follows Gone', { project: EG.ref(fresh19.goneSource) }),
      bot('after-deleted', 'Follows Deleted', { project: EG.ref(fresh19.deletedSource) }),
    ]).a;
    return { ctx, before, afterRefused, refusedRun, made, follow, fresh19, file };
  })();
  return ENUM;
}
/** A create-element refused by rule 10: 400 value-not-allowed, the rule named, the field and the value in the words. */
function refusedByRule10(runResult, id, field, value) {
  const x = runResult.req(id);
  assert(x.status === 400 && x.body.code === 'value-not-allowed' && x.body.rule === RULE10, `${id} must be refused 400 value-not-allowed by ${RULE10}; got ${x.status} ${show(x.body).slice(0, 500)}`);
  assert(String(x.body.error).includes(field) && String(x.body.error).includes(value), `${id}: the refusal names the field ${field} and the value ${value}; got ${show(x.body.error)}`);
  return x.body;
}

test('CE50 [story 19 AC3, ADR 0019 Decision 8]: a value a link doesn\'t allow is refused value-not-allowed, naming the field, the value, the source and the way on; nothing is written', async () => {
  const { refusedRun, ctx, before, afterRefused } = await enumRuns();
  const { el, c } = ctx;
  const body = refusedByRule10(refusedRun, 'name', 'bot.project', 'Infinite Harness');
  for (const part of ['project', c.project, 'graph resolve', 'graph list-elements', 'graph create-element']) assert(String(body.error).includes(part), `the refusal names ${part}: the source concept by name and key, and the way on; got ${show(body.error)}`);
  refusedByRule10(refusedRun, 'list', 'bot.projects', 'Loom');
  assert(!String(refusedRun.req('list').body.error).includes(EG.ref(el.loom)), `a list is judged item by item: its allowed reference isn't named; got ${show(refusedRun.req('list').body.error)}`);
  refusedByRule10(refusedRun, 'nested', 'bot.team.lead', 'Ada');
  refusedByRule10(refusedRun, 'peer-lo', 'bot.project', EG.ref(el.peerLo));
  refusedByRule10(refusedRun, 'upper', 'bot.project', el.loom.toUpperCase());
  assert(graphOf19(afterRefused) === graphOf19(before), 'nothing is written: no node, tag, relationship or entry');
});

test('CE51 [story 19 AC2, AC3]: allowed references are made, each kept as given; a null, and a field left out, aren\'t judged', async () => {
  const { made, ctx, file } = await enumRuns();
  const { el } = ctx;
  const g = S.readState(file);
  for (const [id, field, value] of [
    ['own', 'project', EG.ref(el.infiniteHarness)], ['peer-hi', 'project', EG.ref(el.peerHi)], ['deep', 'project', EG.ref(el.deep)],
    ['list-ok', 'projects', [EG.ref(el.loom), EG.ref(el.infiniteHarness)]], ['nested-ok', 'team', { lead: EG.ref(el.ada) }], ['null-ok', 'nickname', null], ['absent', 'project', undefined],
  ]) {
    const x = made.req(id);
    assert(x.status === 200 && x.body.data.outcome === 'created', `${id} is made; got ${x.status} ${show(x.body).slice(0, 400)}`);
    const sec = sectionOf(g, x.body.data.element.tapestryKey, 'bot');
    assert(show(sec[field]) === show(value), `${id}: its ${field} as given; got ${show(sec[field])}`);
  }
});

test('CE52 [story 19 AC3]: the values follow the source: an element added to it is allowed at once; one taken out, or deleted, is refused, with no further call', async () => {
  const { follow, fresh19 } = await enumRuns();
  const x = follow.req('after-new');
  assert(x.status === 200 && x.body.data.outcome === 'created', `New Project, which create-element added to project after the link, is allowed; got ${x.status} ${show(x.body).slice(0, 400)}`);
  for (const id of ['gone-joins-person', 'gone-out', 'deleted']) assert(follow.req(id).status === 200, `the setup's ${id} must succeed; got ${follow.req(id).status} ${show(follow.req(id).body).slice(0, 300)}`);
  refusedByRule10(follow, 'after-gone', 'bot.project', EG.ref(fresh19.goneSource));
  refusedByRule10(follow, 'after-deleted', 'bot.project', EG.ref(fresh19.deletedSource));
});

test('CE53 [story 19 AC3, ADR 0019 Consequences]: Grok Bots\' tangled concept, linked by today\'s route, is checked all the same', async () => {
  const { refusedRun, made } = await enumRuns();
  refusedByRule10(refusedRun, 'grok-name', 'grokBot.project', 'Infinite Harness');
  const x = made.req('grok-ref');
  assert(x.status === 200 && x.body.data.outcome === 'created', `a reference is made; got ${x.status} ${show(x.body).slice(0, 400)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
