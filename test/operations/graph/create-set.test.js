'use strict';
/**
 * graph create-set — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/27-create-set.md (AC1–AC5, AC6's and AC7's parts the
 *          fake can reach; the agent's run is create-set-agent-through-cli.test.js, and the live check covers the rest)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0027-create-set.md (Decisions 1–15)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/27-create-set.test-plan.md
 *
 * Stack-free: the real catalog in a child process (test/helpers/operationsHarness.js), over a graph
 * test/helpers/createSetGraph.js seeds for test/helpers/graphFake.js (it says what the graph holds), every service
 * endpoint dead, and the harness's spy on everything that signs or reads a key. MAIN makes sets and repeats them; AFTER
 * reads MAIN's graph back; REF holds every refusal, so its graph must end as it began; each variant changes the set
 * concept or the instance; SAME runs create-set and link-set over the same parents.
 *
 *   CS1  the owner makes Kennel Club under beagle's superset: one keyed set, no NostrEvent, its name its tapestryValue;
 *        the answer gives the set, the concepts whose class thread reaches it, and a set-created entry
 *   CS2  Kennel Club is the letter today's create-set would sign, plus json: its address, kind and author, and the tags
 *        d, name, z, s, description and json, in that order, with the import's tag uuids; no id
 *   CS3  its JSON is firmware's set-file shape, keys in order, and fits the set concept's schema; word, which reaches
 *        the set concept's superset, is reported as not fitting, for graphContext, and doesn't stop it
 *   CS4  its two links: one from its parent by IS_A_SUPERSET_OF, one from the set concept's superset by HAS_ELEMENT;
 *        nothing else is wired
 *   CS5  graph history finds its entry by the set and by the parent; list-elements of the set concept lists it;
 *        list-relationships of the parent lists the link
 *   CS6  a set under a set: Ribbons under show beagles, whose s tag names show beagles, in beagle's class thread
 *   CS7  a set under walkers is in dog's and pet's class threads: threads lists both, by tapestryKey
 *   CS8  a firmware concept's superset, another author's superset and another author's set each take a set, and a set
 *        in no class thread takes one too, with no threads
 *   CS9  a name is trimmed and collapsed; a description left out or blank leaves no tag and no JSON description; a name
 *        of 200 characters is made
 *   CS10 the same call again is already-exists: nothing changes, nothing is recorded, the same set, nothing differs
 *   CS11 differs names the name when it differs at all, case included, and a description given that differs
 *   CS12 the repeat is found among the parent's direct sets by name, lettered or not, or by the address the name gives,
 *        nonce or not; the plain address wins, then the lowest key
 *   CS13 what isn't the repeat: another author's set, a superset of the name, the name under another parent, a set at
 *        the name's address that is no longer under the parent, and a node at the address (the next nonce)
 *   CS14 each transaction takes the lock first, before any read; and the lock is on the parent, before a refusal too
 *   CS15 nothing is signed; an admin's create is the admin's; the command makes one, recorded as the command's
 *   CS16 it is listed with its guard, repeatKey, inputs and every refusal, and has its /docs entry
 *   CS17 the change entry's fields name, slug and from describe a set made under a parent
 *   CS18 the catalog's §2 row gives create-set as built: its inputs, its rule and what it reports
 *   CS19 the fake graph runs R6 and R7 as the ADR writes them, answering as Neo4j would
 *   CS20 _sets.js holds the set writes' shared pieces: requireParent, linkUnder, and the set's letter (setJson,
 *        setTags), its repeat (findSetRepeat, setDiffers) and describeSet
 *   CS21 a visitor gets 401, a stranger 403, a text/plain body 415; the command's refusal is the route's
 *   CS22 a parent that names no node, or names a change entry, is unknown-node, naming parent
 *   CS23 a parent that isn't a superset or a set is not-a-parent: an element, a concept header (naming its superset), a
 *        card set with no address, a node of no concept
 *   CS24 each name problem is refused bad-name, naming the input
 *   CS25 a description with a control character is refused bad-description
 *   CS26 every address the name and parent give is held: no-free-address
 *   CS27 inputs are checked: missing, the wrong type, unknown, a parent that isn't a tapestryKey, a description too long
 *   CS28 the refusal run changed nothing and recorded nothing
 *   CS29 a set concept whose schema asks more refuses JSON that doesn't fit: invalid-fields, by element-fits-schema
 *   CS30 a set concept with no schema, or one that can't be read, is refused no-schema
 *   CS31 with no assistant key, or with no set concept superset, it is refused not-installed
 *   CS32 a write whose entry can't be recorded keeps nothing
 *   CS33 a mark on the set concept's slug reaches the set in the same write, its entry records the copy; another
 *        concept above the set concept's superset joins wordTypes and the report
 *   CS34 create-set reads a parent as link-set does: the same nodes accepted, the same refused, in the same words
 *   CS35 the new module requires nothing that signs, publishes or reads a key
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const C = require('../../helpers/conceptGraph');
const G = require('../../helpers/createSetGraph');

const { ROOT, TA, OWNER, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph create-set');

const ROUTE = '/api/tapestry/graph/create-set';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/create-set.js');
const SETS = path.join(ROOT, 'src/operations/catalog/graph/_sets.js');
const RULE = 'element-fits-schema';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOBODY = '00000000-0000-4000-8000-0000000000ee';
const CN = require(path.join(ROOT, 'src/lib/conceptNames.js'));
const BEL = String.fromCharCode(0x07);
const RLO = String.fromCharCode(0x202e);
const ZWSP = String.fromCharCode(0x200b);

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/create-set.js does not exist yet (ADR graph-operations-first-slice/0027 Decision 1)');
}
const post = (id, caller, body, extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body, ...extra });
const get = (id, url) => ({ id, method: 'GET', url, caller: 'owner' });

/** One harness run over a state file; { r, a }. */
function runOn(file, requests, { cli = [], spy = false, env = null } = {}) {
  const dir = path.dirname(file);
  const r = S.runHarness({ spy, scenarios: [{ graphFake: { stateFile: file }, requests, cli }] }, { dir, env: env ? env(dir) : null });
  return { r, a: S.answered(r) };
}
/** A fresh seed in a directory of its own; { file, k, u }. */
async function fresh(opts = {}, mutate = null) {
  const seed = await G.seedCreateSet(opts);
  if (mutate) mutate(seed.state);
  return { file: seed.file(tmp('create-set-')), k: seed.keys, u: seed.uuids };
}

/** The set's JSON, as Decision 9 gives it, keys in order. */
function setJson(name, description = null, others = []) {
  const slug = require(path.join(ROOT, 'src/lib/dtag.js')).slug(name);
  const title = CN.toTitleName(name);
  return {
    word: { slug: `the-set-of-${slug}`, name: `The set of ${name}`, title: `The Set of ${title}`, wordTypes: ['word', 'set', ...others] },
    set: { slug, name, title, ...(description ? { description } : {}) },
  };
}

// ── MAIN: makes sets and repeats them ──
let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    const { file, k, u } = await fresh();
    const under = (id, parent, name, description, caller = 'owner') => post(id, caller, { parent, name, ...(description === undefined ? {} : { description }) });
    const b = (id, name, description) => under(id, k.beagleSuperset, name, description);
    const { a } = runOn(file, [
      b('kennel', 'Kennel Club', 'Beagles that show.'),
      b('kennel-again', 'Kennel Club', 'Beagles that show.'),
      b('kennel-bare', 'Kennel Club'),
      b('kennel-case', 'kennel club', 'Beagles that show.'),
      b('kennel-desc', 'Kennel Club', 'Another.'),
      under('ribbons', k.showBeagles, 'Ribbons', 'ribbon winners'),
      under('walks', k.walkers, 'Long Walks'),
      under('fw-parent', k.relationshipTypeSuperset, 'My Relationship Types'),
      under('peer-parent', k.relaySuperset, 'Relays I Use'),
      under('peer-set-parent', k.peerSet, 'Fast Ones'),
      under('orphan-parent', k.orphanSet, 'Lost'),
      b('rep-show-dogs', 'Show Dogs'),
      b('rep-puppies', 'Puppies', 'small ones'),
      b('rep-odd', 'Odd Ones'),
      b('rep-nonce', 'Nonce'),
      b('rep-twin', 'Twin'),
      b('rep-echo', 'Echo'),
      b('peer-named', 'Peer Named'),
      b('hounds', 'Hounds'),
      b('elsewhere', 'Elsewhere'),
      b('moved', 'Moved'),
      b('held', 'Held'),
      b('trim', '  Toy   Beagles  ', 'small ones'),
      b('bare', 'Bare'),
      b('blank-desc', 'Blank Desc', '   '),
      b('n-200', 'y'.repeat(200)),
      under('admin', k.beagleSuperset, 'Admin Set', 'by the admin', 'admin'),
      { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
    ], {
      spy: true,
      cli: [{ id: 'cli', argv: ['graph', 'create-set', '--parent', k.beagleSuperset, '--name', 'Command Set', '--description', 'from the command'] }],
    });
    return { a, k, u, file };
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
const changeOf = (d, name) => ((d && d.change && d.change.changes) || []).filter((c) => c.change === name);
const entriesNow = (g) => g.nodes.filter((n) => n.labels.includes('GraphChange')).length;
/** The node properties an answer's copies name: a list of names or of { property }. */
const propsOf = (copies) => (Array.isArray(copies) ? copies.map((c) => (typeof c === 'string' ? c : c && c.property)) : ['(not a list)']).sort();
const keysIn = (list) => (list || []).map((x) => x.concept);
const sorted = (xs) => [...xs].sort();

test('CS1: the owner makes Kennel Club under beagle\'s superset: one keyed set, no NostrEvent, its entry, and the concepts that reach it', async () => {
  const d = await ok('kennel');
  const { k, u } = await main();
  assert(d.outcome === 'created', `outcome created; got ${show(d)}`);
  const st = d.set;
  const address = G.setAddress('Kennel Club', u.beagleSuperset);
  assert(st && UUID.test(String(st.tapestryKey)) && st.address === address && st.name === 'Kennel Club' && st.slug === 'kennel-club' && st.description === 'Beagles that show.' && st.hasLetter === false,
    `it answers the set's key, the address today's create-set gives the name and parent (${address}), its name, slug and description, and no letter (Decision 13); got ${show(st)}`);
  assert(show(st.parents) === show([k.beagleSuperset]), `it is directly under beagle's superset; got parents ${show(st.parents)}`);
  const n = C.node(await graph(), st.tapestryKey);
  assert(n, 'the set is in the graph');
  assert(show([...n.labels].sort()) === show(['ListItem', 'Set', 'TapestryNode']), `labels ListItem, Set and the shared label, and no NostrEvent (D7; Decision 10); got ${show(n.labels)}`);
  assert(n.props.name === 'Kennel Club' && n.props.tapestryValue === 'Kennel Club', `its name is its tapestryValue (D11); got ${show(n.props)}`);
  assert(!('id' in n.props) && n.props.pubkey === TA && n.props.kind === 39999 && Number.isInteger(n.props.created_at), `no id, the assistant as its would-be author, kind 39999, and when it was made; got ${show(n.props)}`);
  assert(show(d.threads) === show([{ concept: k.beagle, address: u.beagle }]), `threads: beagle, the one concept whose class thread reaches it, with its address (Decision 13); got ${show(d.threads)}`);
  const made = changeOf(d, 'set-created');
  assert(made.length === 1 && made[0].node === st.tapestryKey && made[0].from === k.beagleSuperset && made[0].name === 'Kennel Club' && made[0].slug === 'kennel-club',
    `its entry records set-created: the set, the parent it was made under, its name and slug (Decision 14); got ${show(d.change)}`);
  assert(show(d.change.by) === show({ role: 'owner', pubkey: OWNER }) && d.change.operation === 'graph create-set', `the entry is the owner's, through graph create-set; got ${show(d.change)}`);
  assert(/backup/i.test(String(d.note)), `the answer notes that only a backup keeps it (BIBLE §30); got ${show(d.note)}`);
  assert(show(d.differs) === show([]) && propsOf(d.copies).length === 0 && show(d.skipped) === show([]), `nothing differs, and the set concept marks nothing here; got ${show({ differs: d.differs, copies: d.copies, skipped: d.skipped })}`);
});

test('CS2: Kennel Club is the letter today\'s create-set would sign, plus json: tags d, name, z, s, description, json, in order, with the import\'s uuids', async () => {
  const d = await ok('kennel');
  const { u } = await main();
  const g = await graph();
  const address = G.setAddress('Kennel Club', u.beagleSuperset);
  const n = C.node(g, d.set.tapestryKey);
  assert(n.props.uuid === address, `its uuid is the address ${address}; got ${n.props.uuid}`);
  const want = [['d', address.split(':')[2]], ['name', 'Kennel Club'], ['z', G.SET_CONCEPT], ['s', u.beagleSuperset], ['description', 'Beagles that show.'], ['json', JSON.stringify(setJson('Kennel Club', 'Beagles that show.'))]];
  const got = C.tagArrays(g, d.set.tapestryKey);
  assert(show(got) === show(want), `its tags are d, name, a z naming the set concept's header, an s naming the parent, description and json, in that order (Decision 10); got ${show(got)}, want ${show(want)}`);
  const uuids = C.tags(g, d.set.tapestryKey).map((t) => t.uuid);
  assert(show(uuids) === show(want.map((t, i) => C.tagUuid(address, t, i))), 'its tag nodes have the uuids the import gives them');
  assert(C.tags(g, d.set.tapestryKey).every((t) => typeof t.key === 'string'), 'each tag node is keyed');
});

test('CS3: its JSON is firmware\'s set-file shape and fits the set concept\'s schema; word is reported, for graphContext, and doesn\'t stop it', async () => {
  const d = await ok('kennel');
  const { k } = await main();
  const json = C.json(await graph(), d.set.tapestryKey);
  assert(show(json) === show(setJson('Kennel Club', 'Beagles that show.')), `the JSON is a word block (the-set-of-…, The set of …, The Set of …, wordTypes word and set) and a set section (slug, name, title, description), keys in Decision 9's order; got ${show(json)}`);
  const cs = d.concepts || [];
  assert(show(keysIn(cs)) === show([k.setConcept, k.word]), `concepts: the set concept first, then word, each a concept the set is an element of (Decision 13); got ${show(cs)}`);
  assert(cs[0].key === 'set' && cs[0].fits === true && show(cs[0].problems) === show([]) && cs[0].problem === null, `it fits the set concept's schema (rule 4); got ${show(cs[0])}`);
  assert(cs[1].key === 'word' && cs[1].fits === false && (cs[1].problems || []).some((p) => /graphContext/.test(`${p.path} ${p.message}`)),
    `word's schema requires graphContext, which only the derive step writes: reported, not refused (ADR 0020 Amendment 1); got ${show(cs[1])}`);
});

test('CS4: its two links: IS_A_SUPERSET_OF from its parent, HAS_ELEMENT from the set concept\'s superset, and nothing else', async () => {
  const d = await ok('kennel');
  const { k } = await main();
  const g = await graph();
  const key = d.set.tapestryKey;
  assert(show(C.into(g, key, 'IS_A_SUPERSET_OF')) === show([k.beagleSuperset]), `one class-thread link, from beagle's superset (Decision 11); got ${show(C.into(g, key, 'IS_A_SUPERSET_OF'))}`);
  assert(show(C.into(g, key, 'HAS_ELEMENT')) === show([k.setSuperset]), `one HAS_ELEMENT, from the set concept's superset: it is an element of the set concept (AC1); got ${show(C.into(g, key, 'HAS_ELEMENT'))}`);
  const eid = C.node(g, key).eid;
  const other = g.rels.filter((r) => (r.to === eid || r.from === eid) && r.type !== 'HAS_TAG').length;
  assert(other === 2, `nothing else is wired; it has ${other} links besides its tags`);
});

test('CS5: graph history finds the entry by the set and by the parent; list-elements of the set concept lists it; list-relationships of the parent lists the link', async () => {
  const d = await ok('kennel');
  const { file, k } = await main();
  const key = d.set.tapestryKey;
  const { a } = runOn(file, [
    get('h-set', `/api/tapestry/graph/history?node=${key}&limit=5`),
    get('h-parent', `/api/tapestry/graph/history?node=${k.beagleSuperset}&limit=200`),
    get('le', `/api/tapestry/graph/list-elements?concept=${k.setConcept}&limit=200`),
    get('lr', `/api/tapestry/graph/list-relationships?node=${k.beagleSuperset}&type=IS_A_SUPERSET_OF&direction=out&limit=200`),
  ]);
  for (const id of ['h-set', 'h-parent']) {
    const x = a.req(id);
    const ids = x.status === 200 ? x.body.data.entries.map((e) => e.id) : null;
    assert(ids && ids.includes(d.change.id), `${id}: history finds the create's entry; got ${x.status} ${show(x.body).slice(0, 400)}`);
  }
  const le = a.req('le');
  const listed = le.status === 200 ? le.body.data.elements.map((e) => e.tapestryKey) : null;
  assert(listed && listed.includes(key), `list-elements lists Kennel Club among the set concept's elements; got ${le.status} ${show(le.body).slice(0, 400)}`);
  const lr = a.req('lr');
  const links = lr.status === 200 ? lr.body.data.relationships : null;
  assert(links && links.some((r) => r.to === key && r.from === k.beagleSuperset && r.direction === 'out'), `list-relationships lists the link from beagle's superset to it; got ${lr.status} ${show(lr.body).slice(0, 400)}`);
});

test('CS6: a set under a set: Ribbons under show beagles, its s tag naming show beagles, in beagle\'s class thread', async () => {
  const d = await ok('ribbons');
  const { k, u } = await main();
  const address = G.setAddress('Ribbons', u.showBeagles);
  assert(d.outcome === 'created' && d.set.address === address && show(d.set.parents) === show([k.showBeagles]), `Ribbons is made directly under show beagles, at the address the name and that parent give; got ${show(d.set)}`);
  assert(show(keysIn(d.threads)) === show([k.beagle]), `beagle's class thread reaches it, through show beagles; got ${show(d.threads)}`);
  const s = C.tagArrays(await graph(), d.set.tapestryKey).find((t) => t[0] === 's');
  assert(s && s[1] === u.showBeagles, `its s tag names show beagles; got ${show(s)}`);
});

test('CS7: a set under walkers is in dog\'s and pet\'s class threads: threads lists both, by tapestryKey', async () => {
  const d = await ok('walks');
  const { k } = await main();
  assert(show(keysIn(d.threads)) === show(sorted([k.dog, k.pet])), `threads: dog and pet, whose class threads both reach walkers, in tapestryKey order (rule 3); got ${show(d.threads)}`);
});

test('CS8: a firmware concept\'s superset, another author\'s superset and another author\'s set each take a set; one in no class thread has no threads', async () => {
  const { k } = await main();
  const g = await graph();
  for (const [id, parent, concept] of [['fw-parent', k.relationshipTypeSuperset, k.relationshipType], ['peer-parent', k.relaySuperset, k.relay], ['peer-set-parent', k.peerSet, k.relay]]) {
    const d = await ok(id);
    assert(d.outcome === 'created' && show(d.set.parents) === show([parent]), `${id}: a set is made under it (AC4: any author's parent, and firmware's); got ${show(d)}`);
    assert(show(keysIn(d.threads)) === show([concept]), `${id}: threads names the concept whose class thread reaches the parent; got ${show(d.threads)}`);
    assert(C.node(g, d.set.tapestryKey).props.pubkey === TA, `${id}: the set is this instance's own claim, its author the assistant`);
  }
  const lost = await ok('orphan-parent');
  assert(lost.outcome === 'created' && show(lost.threads) === show([]), `a set under a set no concept's class thread reaches is made, with no threads (Decision 4); got ${show(lost)}`);
});

test('CS9: a name is trimmed and collapsed; a description left out or blank leaves no tag and no JSON description; a name of 200 characters is made', async () => {
  const { u } = await main();
  const g = await graph();
  const t = await ok('trim');
  assert(t.set.name === 'Toy Beagles' && t.set.address === G.setAddress('Toy Beagles', u.beagleSuperset), `the name is trimmed and its white space collapsed; got ${show(t.set)}`);
  for (const id of ['bare', 'blank-desc']) {
    const d = await ok(id);
    assert(d.set.description === null, `${id}: the answer's description is null; got ${show(d.set)}`);
    assert(!C.tagArrays(g, d.set.tapestryKey).some((x) => x[0] === 'description'), `${id}: no description tag`);
    const j = C.json(g, d.set.tapestryKey);
    assert(j && j.set && !('description' in j.set), `${id}: no description in the JSON's set section; got ${show(j)}`);
  }
  const long = await ok('n-200');
  assert(long.outcome === 'created' && long.set.name.length === 200, `a name of 200 characters is made; got ${show(long.set).slice(0, 200)}`);
});

test('CS10: the same call again is already-exists: nothing changes, nothing is recorded, the same set, nothing differs', async () => {
  const first = await ok('kennel');
  const { k } = await main();
  const g = await graph();
  for (const id of ['kennel-again', 'kennel-bare']) {
    const d = await ok(id);
    assert(d.outcome === 'already-exists' && d.change === null && d.set.tapestryKey === first.set.tapestryKey, `${id}: already-exists, the same set, nothing recorded (AC3); got ${show(d)}`);
    assert(show(d.differs) === show([]), `${id}: nothing differs (a description left out isn't compared); got ${show(d.differs)}`);
    assert(show(d.concepts) === show([]) && propsOf(d.copies).length === 0 && show(d.skipped) === show([]) && d.note === undefined, `${id}: no concepts, copies, skipped or note on a repeat (Decision 13); got ${show(d)}`);
    assert(show(keysIn(d.threads)) === show([k.beagle]), `${id}: threads are still given; got ${show(d.threads)}`);
  }
  assert(C.nodesAt(g, first.set.address).length === 1, 'one set at the address');
  const made = S.entriesOf(g).filter((e) => e.operation === 'graph create-set' && e.changes.some((c) => c.node === first.set.tapestryKey));
  assert(made.length === 1, `one entry for it; got ${made.length}`);
});

test('CS11: differs names the name when it differs at all, case included, and a description given that differs', async () => {
  const c = await ok('kennel-case');
  assert(c.outcome === 'already-exists' && show(c.differs) === show([{ input: 'name', given: 'kennel club', holds: 'Kennel Club' }]), `the name's case differs; got ${show(c.differs)}`);
  const dd = await ok('kennel-desc');
  assert(dd.outcome === 'already-exists' && show(dd.differs) === show([{ input: 'description', given: 'Another.', holds: 'Beagles that show.' }]), `the description given differs; got ${show(dd.differs)}`);
});

test('CS12: the repeat is found among the parent\'s direct sets, by name or by the address the name gives, nonce or not; the plain address wins, then the lowest key', async () => {
  const { k } = await main();
  const cases = [
    ['rep-show-dogs', k.showDogs, [], true, 'dogs for shows'],
    ['rep-puppies', k.puppies, [{ input: 'description', given: 'small ones', holds: 'young ones' }], false, 'young ones'],
    ['rep-odd', k.oddOnes, [{ input: 'name', given: 'Odd Ones', holds: 'Odd Ones!' }], false, null],
    ['rep-nonce', k.nonceSet, [{ input: 'name', given: 'Nonce', holds: 'Nonce Set' }], false, null],
    ['rep-twin', k.twinPlain, [], false, null],
    ['rep-echo', k.echoLow, [], false, null],
  ];
  for (const [id, want, differs, hasLetter, description] of cases) {
    const d = await ok(id);
    assert(d.outcome === 'already-exists' && d.change === null && d.set.tapestryKey === want, `${id}: already-exists with ${want} (Decision 7); got ${show(d.set)}`);
    assert(show(d.differs) === show(differs), `${id}: differs ${show(differs)}; got ${show(d.differs)}`);
    assert(d.set.hasLetter === hasLetter && d.set.description === description, `${id}: the set as it holds itself, hasLetter ${hasLetter} and description ${show(description)}; got ${show(d.set)}`);
    assert(show(d.set.parents) === show([k.beagleSuperset]), `${id}: its parents; got ${show(d.set.parents)}`);
  }
});

test('CS13: what isn\'t the repeat: another author\'s set, a superset of the name, the name under another parent, a set no longer under it, a node at the address', async () => {
  const { k, u } = await main();
  const cases = [
    ['peer-named', 'Peer Named', null, k.peerNamed],
    ['hounds', 'Hounds', null, k.hounds],
    ['elsewhere', 'Elsewhere', null, k.elsewhere],
    ['moved', 'Moved', 1, k.moved],
    ['held', 'Held', 1, k.heldNode],
  ];
  for (const [id, name, nonce, notThis] of cases) {
    const d = await ok(id);
    const address = G.setAddress(name, u.beagleSuperset, nonce);
    assert(d.outcome === 'created' && d.set.tapestryKey !== notThis && d.set.address === address, `${id}: a new set is made, at ${address} (Decisions 7 and 8); got ${show(d.set)}`);
  }
});

test('CS14: each transaction takes the lock first, before any read; the lock is on the parent, before a refusal too', async () => {
  assert((await ok('kennel')).outcome === 'created', 'the path under test ran (CS1 made Kennel Club)');
  const log = (await graph()).log;
  const txns = [];
  let cur = null;
  for (const l of log) {
    if (l.call === 'begin') cur = [];
    else if (l.call === 'commit' || l.call === 'rollback') { if (cur) txns.push(cur); cur = null; } else if (cur) cur.push(l);
  }
  const made = txns.filter((t) => t.some((x) => x.call === 'tx.run' && x.kind === 'tags'));
  assert(made.length >= 15, `the fake logged each create's transaction; got ${made.length}`);
  for (const t of txns.filter((x) => x.length)) {
    assert(t[0] && t[0].call === 'tx.run' && t[0].kind === 'copies' && t[1] && t[1].call === 'tx.run' && t[1].kind === 'copies',
      `each transaction (creates and repeats alike) starts with the lock, set and removed, before any read (Decision 5); got ${show(t.slice(0, 3))}`);
  }
  // Which node it locks: the declaration's apply, over the fake, with each statement's parameters recorded.
  for (const [what, parentOf, code] of [['a create', (k) => k.beagleSuperset, null], ['a refusal (not-a-parent)', (k) => k.rover, 'not-a-parent']]) {
    const { file, k } = await fresh();
    const out = applyDirect(file, { parent: parentOf(k), name: 'Lock Probe' });
    const lockKeys = (c) => (c && c.params && Array.isArray(c.params.rows) ? c.params.rows.map((r) => r.key) : c && c.params && c.params.key ? [c.params.key] : []);
    assert(out.calls.length >= 2 && out.calls[0].call === 'run' && out.calls[1].call === 'run' && show(lockKeys(out.calls[0])) === show([parentOf(k)]) && show(lockKeys(out.calls[1])) === show([parentOf(k)]),
      `${what}: apply's first two statements lock the parent, ${parentOf(k)} (Decision 5); got ${show(out.calls.slice(0, 3)).slice(0, 700)} ${out.error ? show(out.error) : ''}`);
    assert((out.error && out.error.code) === code, `${what}: ${code ? `refused ${code}, after the lock` : 'no refusal'}; got ${show(out.error)}`);
  }
});

/** Run the declaration's apply over the fake graph in a child, recording each statement and its parameters. */
function applyDirect(file, inputs) {
  needDecl();
  const script = [
    `const { fakeGraph } = require(${JSON.stringify(path.join(ROOT, 'test/helpers/graphFake.js'))});`,
    `const decl = require(${JSON.stringify(DECL)});`,
    'const calls = [];',
    '(async () => {',
    `  const g = fakeGraph(${JSON.stringify(file)});`,
    '  let error = null;',
    '  try {',
    '    await g.writeTransaction(async (tx) => {',
    "      const rec = { run: async (c, p) => { calls.push({ call: 'run', query: String(c).slice(0, 160), params: p }); return tx.run(c, p); },",
    "                    read: async (c, p) => { calls.push({ call: 'read', query: String(c).slice(0, 160), params: p }); return tx.read(c, p); } };",
    `      await decl.apply(${JSON.stringify(inputs)}, { tx: rec, caller: { role: 'owner', pubkey: ${JSON.stringify(OWNER)} } });`,
    '    });',
    '  } catch (e) { error = { code: e.code || null, message: String(e.message).slice(0, 300) }; }',
    "  process.stdout.write('RESULT:' + JSON.stringify({ calls, error }));",
    '})();',
  ].join('\n');
  const child = spawnSync(process.execPath, ['-e', script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(path.dirname(file)), maxBuffer: 64 * 1024 * 1024 });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line, `the direct run answered nothing: ${(child.stderr || '').slice(-500)}`);
  return JSON.parse(line);
}

test('CS15: nothing is signed; an admin\'s create is the admin\'s; the command makes one, recorded as the command\'s', async () => {
  assert((await ok('kennel')).outcome === 'created', 'the path under test ran (CS1 made Kennel Club)');
  const { a, k } = await main();
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key (ADR 0004 Decision 10, D1); the spy saw ${show(a.spy)}`);
  const ad = await ok('admin');
  assert(ad.outcome === 'created' && show(ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `an admin's create is recorded as the admin's; got ${show(ad.change)}`);
  const c = a.cmd('cli');
  assert(c.code === 0, `the command succeeds; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.success && body.data.outcome === 'created' && body.data.set.name === 'Command Set' && show(body.data.set.parents) === show([k.beagleSuperset]) && body.data.change.by.role === 'local',
    `the command makes Command Set under beagle's superset, recorded as the command's; got ${show(body)}`);
});

test('CS16: it is listed with its guard, repeatKey, inputs and every refusal, and has its /docs entry', async () => {
  needDecl();
  const { a } = await main();
  const e = ((a.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'create-set');
  assert(e, `graph create-set is listed; problems: ${show((a.req('list').body.data || {}).problems)}`);
  assert(e.kind === 'write' && e.access === 'owner-and-admins' && show(e.guards) === show([RULE]) && show(e.repeatKey) === show(['parent', 'name']),
    `a write for the owner and admins, guard ${RULE}, repeatKey [parent, name] (Decision 1); got ${show({ kind: e.kind, access: e.access, guards: e.guards, repeatKey: e.repeatKey })}`);
  const ins = e.inputs || {};
  assert(ins.parent && ins.parent.required === true && ins.name && ins.name.required === true && ins.description && !ins.description.required && (ins.description.schema || {}).maxLength === 10000,
    `parent and name are required; description is not, up to 10,000 characters; got ${show(ins)}`);
  const status = Object.fromEntries((e.refusals || []).map((x) => [x.code, x.status]));
  const want = { 'bad-name': 400, 'bad-description': 400, 'not-installed': 409, 'unknown-node': 404, 'not-a-parent': 409, 'no-free-address': 409, 'invalid-fields': 400, 'no-schema': 409 };
  for (const [code, st] of Object.entries(want)) assert(status[code] === st, `its refusals include ${code} (${st}), Decision 15's; got ${show(status)}`);
  for (const code of ['missing-input', 'invalid-input', 'unknown-input', 'wrong-content-type', 'sign-in-required', 'not-allowed']) assert(code in status, `its refusals include ${code}; got ${show(Object.keys(status))}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('create-set-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

test('CS17: the change entry\'s fields name, slug and from describe a set made under a parent', () => {
  needDecl();
  const { CHANGE } = require(path.join(ROOT, 'src/operations/changes.js'));
  const p = CHANGE.properties || {};
  assert(/\bset\b/.test(String(p.name && p.name.description)) && /\bset\b/.test(String(p.slug && p.slug.description)), `name's and slug's descriptions cover a set's (Decision 14); got ${show({ name: p.name, slug: p.slug })}`);
  assert(/\bparent\b/.test(String(p.from && p.from.description)), `from's covers the parent a set was made under; got ${show(p.from)}`);
});

test('CS18: the catalog\'s §2 row gives create-set as built: its inputs, its rule and what it reports', () => {
  needDecl();
  const text = fs.readFileSync(path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md'), 'utf8');
  const row = text.split('\n').find((l) => l.startsWith('| `create-set` |')) || '';
  assert(row.includes('`parent`') && row.includes('`name`') && row.includes('`description?`'), `its inputs: parent, name and description? (Decision 1); got ${show(row)}`);
  assert(row.includes('`element-fits-schema`') && /differs/.test(row) && /already-exists/.test(row), `it names its rule, and the repeat's answer and report (Decisions 7 and 9); got ${show(row)}`);
});

test('CS19: the fake graph runs R6 and R7 as the ADR writes them, answering as Neo4j would', async () => {
  const seed = await G.seedCreateSet();
  const { exec } = require(path.join(ROOT, 'test/helpers/graphFake.js'));
  const k = seed.keys;
  const r6 = exec(seed.state, `MATCH (h:TapestryNode {uuid: $uuid})-[:IS_THE_CONCEPT_FOR]->(s:Superset)
WHERE NOT h:GraphChange
RETURN h.tapestryKey AS concept, s.tapestryKey AS superset LIMIT 1`, { uuid: G.SET_CONCEPT }).rows;
  assert(show(r6) === show([{ concept: k.setConcept, superset: k.setSuperset }]), `R6 finds the set concept's header and superset by its address; got ${show(r6)}`);
  const R7 = `MATCH (p:TapestryNode {tapestryKey: $parent})-[:IS_A_SUPERSET_OF]->(s:Set)
WHERE NOT s:Superset AND NOT s:GraphChange AND s.uuid IS NOT NULL AND s.pubkey = $ta
  AND (toLower(s.name) = $name OR s.uuid = $address OR s.uuid STARTS WITH $nonced)
WITH DISTINCT s
OPTIONAL MATCH (s)-[:HAS_TAG]->(d:NostrEventTag {type: 'description'})
OPTIONAL MATCH (s)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
OPTIONAL MATCH (u)-[:IS_A_SUPERSET_OF]->(s)
RETURN s.tapestryKey AS key, s.uuid AS uuid, s.name AS name, s.id IS NOT NULL AS hasLetter,
       head(collect(DISTINCT d.value)) AS description, head(collect(DISTINCT j.value)) AS json,
       collect(DISTINCT u.tapestryKey) AS parents`;
  const r7 = (name) => {
    const address = G.setAddress(name, seed.uuids.beagleSuperset);
    return exec(seed.state, R7, { parent: k.beagleSuperset, ta: TA, name: name.toLowerCase(), address, nonced: `${address}~` }).rows;
  };
  const show7 = (rows) => sorted(rows.map((r) => r.key));
  assert(show(show7(r7('Twin'))) === show(sorted([k.twinNonced, k.twinPlain])), `R7 finds both twins, by name; got ${show(r7('Twin'))}`);
  const dogs = r7('Show Dogs');
  assert(dogs.length === 1 && dogs[0].key === k.showDogs && dogs[0].hasLetter === true && dogs[0].description === 'dogs for shows' && show(dogs[0].parents) === show([k.beagleSuperset]),
    `R7 answers the lettered Show Dogs, its description and its parents; got ${show(dogs)}`);
  assert(show(show7(r7('Odd Ones'))) === show([k.oddOnes]), `R7 finds Odd Ones! by the address the name gives; got ${show(r7('Odd Ones'))}`);
  assert(show(show7(r7('Nonce'))) === show([k.nonceSet]), `R7 finds Nonce Set at the address with a nonce; got ${show(r7('Nonce'))}`);
  assert(r7('Peer Named').length === 0 && r7('Hounds').length === 0 && r7('Moved').length === 0, 'R7 finds no peer\'s set, no superset, and no set that is no longer under the parent');
});

test('CS20: _sets.js holds the set writes\' shared pieces, and the set\'s letter has the ADR\'s shape', () => {
  needDecl();
  const X = require(SETS);
  for (const f of ['requireParent', 'linkUnder', 'setJson', 'setTags', 'findSetRepeat', 'setDiffers', 'describeSet']) {
    assert(typeof X[f] === 'function', `_sets.js exports ${f} (ADR 0027 Implementation notes); got ${typeof X[f]}`);
  }
  const j = X.setJson({ name: 'Toy Beagles', slug: 'toy-beagles', description: 'small ones', others: ['word', 'zoo', 'collection'] });
  assert(show(j) === show(setJson('Toy Beagles', 'small ones', ['collection', 'zoo'])), `setJson: word block and set section, wordTypes word, set, then the others sorted, word not twice (Decision 9); got ${show(j)}`);
  const bare = X.setJson({ name: 'Bare', slug: 'bare', others: [] });
  assert(show(bare) === show(setJson('Bare')), `setJson with no description leaves it out; got ${show(bare)}`);
  const t = X.setTags({ d: 'toy-beagles-12345678', name: 'Toy Beagles', setConcept: G.SET_CONCEPT, parent: '39999:p:parent', description: 'small ones', json: '{}' });
  assert(show(t) === show([['d', 'toy-beagles-12345678'], ['name', 'Toy Beagles'], ['z', G.SET_CONCEPT], ['s', '39999:p:parent'], ['description', 'small ones'], ['json', '{}']]), `setTags: d, name, z, s, description, json (Decision 10); got ${show(t)}`);
  const t2 = X.setTags({ d: 'bare-12345678', name: 'Bare', setConcept: G.SET_CONCEPT, parent: '39999:p:parent', json: '{}' });
  assert(!t2.some((x) => x[0] === 'description'), `setTags with no description has no description tag; got ${show(t2)}`);
  const d = X.setDiffers({ name: 'Kennel Club', description: 'Beagles that show.' }, { name: 'kennel club', description: 'Another.' });
  assert(show(d) === show([{ input: 'name', given: 'kennel club', holds: 'Kennel Club' }, { input: 'description', given: 'Another.', holds: 'Beagles that show.' }]), `setDiffers names the name and the description (Decision 7); got ${show(d)}`);
  const none = X.setDiffers({ name: 'Kennel Club', description: null }, { name: 'Kennel Club' });
  assert(show(none) === show([]), `a description left out isn't compared; got ${show(none)}`);
});

// ── REF: every refusal, over a graph that must end as it began ──
let REF = null;
function ref() {
  if (REF) return REF;
  REF = (async () => {
    const { file, k, u } = await fresh();
    const before = S.readState(file);
    const b = (id, body) => post(id, 'owner', { parent: k.beagleSuperset, ...body });
    const { a } = runOn(file, [
      post('visitor', 'visitor', { parent: k.beagleSuperset, name: 'Visitor Set' }),
      post('stranger', 'stranger', { parent: k.beagleSuperset, name: 'Stranger Set' }),
      post('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ parent: k.beagleSuperset, name: 'Text Set' }) }),
      post('un-random', 'owner', { parent: NOBODY, name: 'Nowhere' }),
      post('un-entry', 'owner', { parent: k.G, name: 'Entry Child' }),
      post('nap-element', 'owner', { parent: k.rover, name: 'Under Rover' }),
      post('nap-header', 'owner', { parent: k.beagle, name: 'Under Beagle' }),
      post('nap-card', 'owner', { parent: k.cardSet, name: 'Under Cards' }),
      post('nap-loner', 'owner', { parent: k.loner, name: 'Under Loner' }),
      b('n-blank', { name: '   ' }),
      b('n-noslug', { name: '!!!' }),
      b('n-control', { name: `bad${BEL}name` }),
      b('n-bidi', { name: `bi${RLO}di` }),
      b('n-zero-width', { name: `toy${ZWSP}set` }),
      b('n-long', { name: 'x'.repeat(201) }),
      b('d-control', { name: 'Control Desc', description: `bad${BEL}desc` }),
      b('crowd', { name: 'Crowd' }),
      post('i-missing', 'owner', {}),
      post('i-type', 'owner', { parent: k.beagleSuperset, name: 5 }),
      post('i-unknown', 'owner', { parent: k.beagleSuperset, name: 'Q', color: 'red' }),
      post('i-parent', 'owner', { parent: 'not-a-key', name: 'Q' }),
      b('i-desc-long', { name: 'Long Desc', description: 'z'.repeat(10001) }),
    ], {
      spy: true,
      cli: [{ id: 'cli-refused', argv: ['graph', 'create-set', '--parent', k.rover, '--name', 'Under Rover'] }],
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

test('CS21: a visitor gets 401, a stranger 403, a text/plain body 415; the command\'s refusal is the route\'s', async () => {
  needDecl();
  const { a } = await ref();
  const [v, s, t] = ['visitor', 'stranger', 'text'].map((id) => a.req(id));
  assert(v.status === 401 && s.status === 403 && t.status === 415, `401, 403 and 415; got ${v.status} ${s.status} ${t.status}`);
  const c = a.cmd('cli-refused');
  assert(c.code === 1, `a refused command exits 1; got ${c.code} ${c.stdout} ${c.stderr}`);
  const rb = JSON.parse(c.stdout);
  const route = a.req('nap-element').body;
  assert(rb.code === route.code && rb.error === route.error && rb.input === route.input, `the command's refusal is the route's; command ${show(rb)}, route ${show(route)}`);
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing in the refusal run signed or read a key; the spy saw ${show(a.spy)}`);
});

test('CS22: a parent that names no node, or names a change entry, is unknown-node, naming parent', async () => {
  const { k } = await ref();
  for (const [id, key] of [['un-random', NOBODY], ['un-entry', k.G]]) {
    const body = await refused(id, 404, 'unknown-node');
    assert(body.input === 'parent' && err(body).includes(key), `${id}: names parent and the key; got ${show(body)}`);
  }
});

test('CS23: a parent that isn\'t a superset or a set is not-a-parent: an element, a concept header (naming its superset), a card set, a node of no concept', async () => {
  const { k } = await ref();
  for (const id of ['nap-element', 'nap-header', 'nap-card', 'nap-loner']) {
    const body = await refused(id, 409, 'not-a-parent');
    assert(body.input === 'parent', `${id}: names parent; got ${show(body)}`);
  }
  const h = await refused('nap-header', 409, 'not-a-parent');
  assert(err(h).includes(k.beagleSuperset), `a concept header's refusal names its superset's tapestryKey, the key to pass (AC4; the owner's answer 3); got ${show(h)}`);
  const card = await refused('nap-card', 409, 'not-a-parent');
  assert(/address/i.test(err(card)), `a card set's refusal says a set has an address (ADR 0028 Amendment 3); got ${show(card)}`);
});

test('CS24: each name problem is refused bad-name, naming the input', async () => {
  for (const id of ['n-blank', 'n-noslug', 'n-control', 'n-bidi', 'n-zero-width', 'n-long']) {
    const body = await refused(id, 400, 'bad-name');
    assert(body.input === 'name', `${id}: names the input; got ${show(body)}`);
  }
});

test('CS25: a description with a control character is refused bad-description', async () => {
  const body = await refused('d-control', 400, 'bad-description');
  assert(body.input === 'description', `names the input; got ${show(body)}`);
});

test('CS26: every address the name and parent give is held, to ~99: no-free-address', async () => {
  const body = await refused('crowd', 409, 'no-free-address');
  assert(/99/.test(err(body)), `it says each nonce to ~99 is held; got ${show(body)}`);
});

test('CS27: inputs are checked: missing, the wrong type, unknown, a parent that isn\'t a tapestryKey, a description too long', async () => {
  await refused('i-missing', 400, 'missing-input');
  for (const id of ['i-type', 'i-parent', 'i-desc-long']) await refused(id, 400, 'invalid-input');
  await refused('i-unknown', 400, 'unknown-input');
});

test('CS28: the refusal run changed nothing and recorded nothing', async () => {
  await refused('nap-element', 409, 'not-a-parent');
  const { file, before } = await ref();
  const after = S.readState(file);
  assert(entriesNow(after) === entriesNow(before), `no change entry was recorded; ${entriesNow(before)} before, ${entriesNow(after)} after`);
  assert(show(after.nodes) === show(before.nodes) && show(after.rels) === show(before.rels), 'and the graph is as it was: every refusal comes before anything is written (Decision 2)');
});

// ── the variants: each changes the set concept, the graph or the instance ──
async function variant(opts, requests, { mutate = null, env = null } = {}) {
  needDecl();
  const { file, k, u } = await fresh(opts, mutate);
  const before = S.readState(file);
  const { a } = runOn(file, requests(k), { env });
  return { a, k, u, file, before, after: S.readState(file) };
}
const unchanged = (v) => show(v.after.nodes) === show(v.before.nodes) && show(v.after.rels) === show(v.before.rels);

test('CS29: a set concept whose schema asks more refuses JSON that doesn\'t fit: invalid-fields, by element-fits-schema, naming the field', async () => {
  const v = await variant({ strict: true }, (k) => [post('strict', 'owner', { parent: k.beagleSuperset, name: 'Strict' })]);
  const x = v.a.req('strict');
  assert(x.status === 400 && x.body.code === 'invalid-fields' && x.body.rule === RULE && /set\.color/.test(String(x.body.error)), `invalid-fields from ${RULE}, naming set.color (AC2; Decision 9); got ${x.status} ${show(x.body)}`);
  assert(unchanged(v), 'and nothing is written');
});

test('CS30: a set concept with no schema, or one whose JSON doesn\'t parse, is refused no-schema', async () => {
  for (const schema of ['missing', 'broken']) {
    const v = await variant({ schema }, (k) => [post('ns', 'owner', { parent: k.beagleSuperset, name: 'Schemaless' })]);
    const x = v.a.req('ns');
    assert(x.status === 409 && x.body.code === 'no-schema' && x.body.rule === RULE, `${schema}: no-schema from ${RULE} (Decision 9); got ${x.status} ${show(x.body)}`);
    assert(unchanged(v), `${schema}: and nothing is written`);
  }
});

test('CS31: with no assistant key, or with no set concept superset, it is refused not-installed, and nothing changes', async () => {
  const keyless = await variant({}, (k) => [post('ni', 'owner', { parent: k.beagleSuperset, name: 'Keyless' })], { env: (dir) => { const env = S.childEnv(dir); delete env.TA_PUBKEY; return env; } });
  const x = keyless.a.req('ni');
  assert(x.status === 409 && x.body.code === 'not-installed', `with no assistant, the would-be author, 409 not-installed; got ${x.status} ${show(x.body)}`);
  assert(unchanged(keyless), 'and nothing is written');
  const setless = await variant({ noSetConcept: true }, (k) => [post('ni2', 'owner', { parent: k.beagleSuperset, name: 'Setless' })]);
  const y = setless.a.req('ni2');
  assert(y.status === 409 && y.body.code === 'not-installed' && String(y.body.error).includes(G.SET_CONCEPT), `with no set concept superset, 409 not-installed, naming the set concept's address (Decision 6); got ${y.status} ${show(y.body)}`);
  assert(unchanged(setless), 'and nothing is written');
});

test('CS32: a write whose entry can\'t be recorded keeps nothing', async () => {
  const v = await variant({}, (k) => [post('fail', 'owner', { parent: k.beagleSuperset, name: 'Doomed' })], { mutate: (s) => { s.failures = { entry: true }; } });
  const x = v.a.req('fail');
  assert(x.status === 500, `the write fails; got ${x.status} ${show(x.body)}`);
  assert(C.nodesAt(v.after, G.setAddress('Doomed', v.u.beagleSuperset)).length === 0 && v.after.nodes.length === v.before.nodes.length, 'and keeps neither the node nor its tags (ADR 0004 Decision 3)');
});

test('CS33: a mark on the set concept\'s slug reaches the set in the same write; a concept above the set concept\'s superset joins wordTypes and the report', async () => {
  const v = await variant({ mark: true, above: true }, (k) => [post('marked', 'owner', { parent: k.beagleSuperset, name: 'Marked' })]);
  const x = v.a.req('marked');
  assert(x.status === 200 && x.body.data.outcome === 'created', `the create succeeds; got ${x.status} ${show(x.body).slice(0, 400)}`);
  const d = x.body.data;
  const n = C.node(v.after, d.set.tapestryKey);
  assert(n.props.set_slug === 'marked', `the set carries its slug as set_slug, the set concept's mark (Decision 12); got ${show(n.props)}`);
  assert(show(propsOf(d.copies)) === show(['set_slug']) && show(d.skipped) === show([]), `copies names set_slug; got ${show({ copies: d.copies, skipped: d.skipped })}`);
  const copies = changeOf(d, 'copies-set');
  assert(copies.length === 1 && copies[0].property === 'set_slug' && show(copies[0].nodes) === show([d.set.tapestryKey]), `its entry records the copy; got ${show(d.change)}`);
  const json = C.json(v.after, d.set.tapestryKey);
  assert(show(json.word.wordTypes) === show(['word', 'set', 'collection']), `wordTypes: word, set, then collection, which reaches the set concept's superset (D10; Decision 9); got ${show(json.word.wordTypes)}`);
  const cs = d.concepts || [];
  assert(cs[0] && cs[0].concept === v.k.setConcept && show(keysIn(cs.slice(1))) === show(sorted([v.k.collection, v.k.word])), `concepts: the set concept, then collection and word by tapestryKey; got ${show(cs)}`);
  const coll = cs.find((c) => c.concept === v.k.collection);
  assert(coll && coll.fits === null && typeof coll.problem === 'string' && coll.problem.length > 0, `collection has no schema: fits null, saying why; got ${show(coll)}`);
});

// ── SAME: create-set reads a parent as link-set does (AC5) ──
test('CS34: create-set reads a parent as link-set does: the same nodes accepted, the same refused, in the same words', async () => {
  needDecl();
  const { file, k } = await fresh();
  const candidates = [
    ['beagleSuperset', k.beagleSuperset], ['showBeagles', k.showBeagles], ['walkers', k.walkers], ['relationshipTypeSuperset', k.relationshipTypeSuperset],
    ['relaySuperset', k.relaySuperset], ['peerSet', k.peerSet], ['orphanSet', k.orphanSet],
    ['rover', k.rover], ['beagle', k.beagle], ['cardSet', k.cardSet], ['loner', k.loner], ['G', k.G], ['nobody', NOBODY],
  ];
  const requests = [];
  for (const [name, key] of candidates) {
    requests.push(post(`cs-${name}`, 'owner', { parent: key, name: 'Parity Set' }));
    requests.push({ id: `ls-${name}`, method: 'POST', url: '/api/tapestry/graph/link-set', caller: 'owner', body: { set: k.probe, parent: key } });
  }
  const { a } = runOn(file, requests);
  for (const [name] of candidates) {
    const cs = a.req(`cs-${name}`);
    const ls = a.req(`ls-${name}`);
    const accepted = (x) => x.status === 200;
    assert(accepted(cs) === accepted(ls), `${name}: create-set and link-set both take it as a parent, or both refuse it; create-set ${cs.status} ${show(cs.body).slice(0, 300)}, link-set ${ls.status} ${show(ls.body).slice(0, 300)}`);
    if (!accepted(cs)) {
      assert(cs.status === ls.status && cs.body.code === ls.body.code && cs.body.input === ls.body.input && cs.body.error === ls.body.error,
        `${name}: the same refusal, in the same words (Decision 4); create-set ${show(cs.body)}, link-set ${show(ls.body)}`);
    }
  }
});

test('CS35: the new module requires nothing that signs, publishes or reads a key', () => {
  for (const f of ['src/operations/catalog/graph/create-set.js', 'src/operations/catalog/graph/_sets.js']) {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) throw new Error(`${f} does not exist yet (ADR graph-operations-first-slice/0027 Implementation notes)`);
    const src = fs.readFileSync(abs, 'utf8');
    const bad = (src.match(/require\(\s*['"][^'"]*['"]\s*\)/g) || []).filter((r) => /nostr-tools|normalize\/helpers|secureKeyStorage|child_process|strfry|signing/.test(r));
    assert(bad.length === 0, `${f} must require nothing that signs (ADR 0004 Decision 10); it requires ${show(bad)}`);
  }
  needDecl();
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
