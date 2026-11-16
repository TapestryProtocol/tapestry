'use strict';
/**
 * graph create-concept — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/16-create-concept-and-update-concept.md (AC1–AC5, AC7,
 *          AC8 over the fake; the live check covers the rest)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0016-create-concept-and-update-concept.md
 *          (Decisions 1–8, 10–14)
 *
 * Stack-free: the real catalog, over a graph test/helpers/conceptGraph.js seeds for test/helpers/graphFake.js (it says
 * what the graph holds), with the harness's spy on everything that signs or reads a key. What today's create-concept
 * makes comes from the route itself, run in a sandbox (test/helpers/todaysCreateConcept.js).
 *
 *   CC1  the owner creates coffee house: eight nodes, no NostrEvent, each keyed and its name its tapestryValue, no id,
 *        the answer giving each node's key by role, its entry concept-created naming all eight, and a note on backups
 *   CC2  it is what today's route signs, recorded without signing: each node's address, labels, name, tags (the core
 *        nodes adding the spec's o tag after their z tags), the import's tag uuids and JSON, the route's eight wiring
 *        edges, and exactly the memberships a firmware reinstall leaves (ADR 0016 Amendment 2)
 *   CC3  _fields.js reads it as it reads a lettered concept: its key, its fields, and no elements yet
 *   CC4  graph history finds its entry by the header and by a core node
 *   CC5  the same name again, or the same slug in other case and spacing, answers already-exists, changes nothing,
 *        records nothing, and names the plural and description it was given that differ from what the concept holds
 *   CC6  a concept today's route made, and a firmware concept, are returned the same way, each with its keys by role
 *   CC7  near matches and shared concepts are reported, never refused: another author's same slug, this instance's
 *        own same name, a plural swap, and more than ten capped at ten with moreSimilar
 *   CC8  a name whose key another of this instance's concepts has under another slug is refused key-in-use, from
 *        concept-slug-unique, naming it; nothing changes
 *   CC9  an address that is held makes the concept take the next nonce, the concept-graph tag following it
 *   CC10 with every nonce to ~99 held it is refused no-free-address and nothing changes
 *   CC11 names are trimmed and their white space collapsed; each name problem is refused bad-name, and a description's
 *        bad-description, naming the input; nothing changes
 *   CC12 without a firmware concept its nodes join, or without the concept-header concept, it is refused not-installed
 *   CC13 the transaction takes the lock before it writes anything
 *   CC14 a write whose entry can't be recorded keeps none of the eight nodes
 *   CC15 nothing is signed; a visitor gets 401, a stranger 403, a text/plain body 415, and none changes anything; an
 *        admin's create is recorded as the admin's
 *   CC16 the command creates one too, recorded as the command's, and its refusal matches the route's
 *   CC17 it is listed with its guard, repeatKey and refusals, and has its /docs entry; inputs are checked
 *   (review round 1) CC11b an invisible formatting character, and a name with no letter a–z or digit, are refused
 *        saying why; CC18 differs names the name; CC19 a plural swap the other way; CC20 a bad plural or description is
 *        refused before the rule reads the graph
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const C = require('../../helpers/conceptGraph');
const G = require('../../helpers/graphFake');
const { todaysConcept } = require('../../helpers/todaysCreateConcept');

const { ROOT, TA, OWNER, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph create-concept');

const ROUTE = '/api/tapestry/graph/create-concept';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/create-concept.js');
const RULE = 'concept-slug-unique';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLE_OF_SUFFIX = { superset: 'superset', schema: 'json-schema', 'primary-property': 'primary-property', properties: 'properties-set', 'property-tree-graph': 'property-tree-graph', 'concept-graph': 'concept-graph', 'core-nodes-graph': 'core-nodes-graph' };
const KEY_OF_SUFFIX = { superset: 'superset', schema: 'jsonSchema', 'primary-property': 'primaryProperty', properties: 'properties', 'property-tree-graph': 'propertyTreeGraph', 'concept-graph': 'conceptGraph', 'core-nodes-graph': 'coreNodesGraph' };
/** Each node's memberships, as a firmware reinstall leaves them (ADR 0016 Amendment 2, the owner's ruling). */
const MEMBERS = Object.freeze({
  conceptHeader: ['concept-header'], superset: ['superset', 'set'], jsonSchema: ['json-schema'], primaryProperty: ['primary-property', 'property'],
  properties: ['properties-set'], propertyTreeGraph: ['property-tree-graph'], conceptGraph: ['concept-graph'], coreNodesGraph: ['core-nodes-graph'],
});
const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((o, key) => { o[key] = v[key]; return o; }, {}) : v));

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/create-concept.js does not exist yet (ADR graph-operations-first-slice/0016 Decision 7)');
}
const post = (id, caller, body, extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body, ...extra });

/** One harness run over a state file; { r, a }. */
function runOn(file, requests, { cli = [], spy = false } = {}) {
  const dir = path.dirname(file);
  const r = S.runHarness({ spy, scenarios: [{ graphFake: { stateFile: file }, requests, cli }] }, { dir });
  return { r, a: S.answered(r) };
}
/** A fresh seed in a directory of its own; { file, k, seed }. */
async function fresh(opts = {}, mutate = null) {
  const seed = await C.seedConcepts(opts);
  if (mutate) mutate(seed.state);
  return { file: seed.file(tmp('create-concept-')), k: seed.keys, seed };
}

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    const { file, k } = await fresh();
    const before = S.readState(file).nodes.length;
    const { a } = runOn(file, [
      // Callers and bodies that must change nothing, first.
      post('visitor', 'visitor', { name: 'visitor thing' }),
      post('stranger', 'stranger', { name: 'stranger thing' }),
      post('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ name: 'text thing' }) }),
      post('cc1', 'owner', { name: 'coffee house' }),
      post('again', 'owner', { name: 'coffee house' }),
      post('variant', 'owner', { name: 'Coffee  House ', plural: 'coffee housen', description: 'Somewhere to sit.' }),
      post('beagle', 'owner', { name: 'beagle' }),
      post('set', 'owner', { name: 'set' }),
      post('relay', 'owner', { name: 'nostr relay' }),
      post('bird', 'owner', { name: 'bird' }),
      post('mice', 'owner', { name: 'mice' }),
      post('widget', 'owner', { name: 'widget' }),
      post('cat', 'owner', { name: 'cat' }),
      post('held', 'owner', { name: 'held' }),
      post('crowded', 'owner', { name: 'crowded' }),
      post('trim', 'owner', { name: '  Tea   Room  ' }),
      post('trim-dash', 'owner', { name: 'tea-room' }),
      post('swap-other', 'owner', { name: 'meece', plural: 'mouse' }),
      post('order-plural', 'owner', { name: 'cat', plural: 'ca\u0007ts' }),
      post('order-desc', 'owner', { name: 'cat', description: 'x\u0000y' }),
      post('n-zero-width', 'owner', { name: 'bea\u200Bgle' }),
      post('n-cyrillic', 'owner', { name: 'собака' }),
      post('n-blank', 'owner', { name: '   ' }),
      post('n-noslug', 'owner', { name: '!!!' }),
      post('n-control', 'owner', { name: 'bad\u0007name' }),
      post('n-bidi', 'owner', { name: 'bi\u202Edi' }),
      post('n-long', 'owner', { name: 'x'.repeat(201) }),
      post('n-200', 'owner', { name: 'y'.repeat(200) }),
      post('p-control', 'owner', { name: 'kettle', plural: 'kett\u0000les' }),
      post('d-control', 'owner', { name: 'kettle', description: 'hot\u0000water' }),
      post('i-missing', 'owner', {}),
      post('i-type', 'owner', { name: 5 }),
      post('i-unknown', 'owner', { name: 'kettle', color: 'red' }),
      post('admin', 'admin', { name: 'admin lamp' }),
      { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
    ], {
      spy: true,
      cli: [
        { id: 'cli', argv: ['graph', 'create-concept', '--name', 'lamp post'] },
        { id: 'cli-refused', argv: ['graph', 'create-concept', '--name', 'cat'] },
      ],
    });
    return { a, k, file, before };
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
async function refused(id, status, code) {
  needDecl();
  const x = (await main()).a.req(id);
  assert(x.status === status && x.body.code === code, `${id} must be refused ${status} ${code}; got ${x.status} ${show(x.body)}`);
  return x.body;
}
const changeOf = (d, name) => ((d && d.change && d.change.changes) || []).filter((c) => c.change === name);
const header = (state, uuid) => C.byUuid(state, uuid);

test('CC1: the owner creates coffee house: eight nodes, no NostrEvent, keyed, named, the answer giving each by role, and its entry', async () => {
  const d = await ok('cc1');
  assert(d.outcome === 'created', `outcome created; got ${show(d)}`);
  const c = d.concept;
  assert(c && c.address === `39998:${TA}:coffee-house` && UUID.test(String(c.conceptHeader)), `it answers the header's address and key; got ${show(c)}`);
  assert(show(Object.keys(c.nodes || {}).sort()) === show([...C.ROLES].sort()) && Object.values(c.nodes).every((x) => UUID.test(String(x))), `it gives each of the eight nodes' keys by role; got ${show(c.nodes)}`);
  assert(c.nodes.conceptHeader === c.conceptHeader, 'the header is the conceptHeader role');
  assert(show(c.names) === show({ singular: 'coffee house', plural: 'coffee houses' }) && c.slug === 'coffee-house' && c.key === 'coffeeHouse' && c.hasLetter === false,
    `it answers the names (the plural left out is the name with an s), slug, key, and no letter; got ${show(c)}`);
  const g = await graph();
  for (const [role, key] of Object.entries(c.nodes)) {
    const n = C.node(g, key);
    assert(n, `the ${role} is in the graph`);
    assert(!n.labels.includes('NostrEvent') && n.labels.includes('TapestryNode'), `the ${role} has the shared label and no NostrEvent (D7); got ${show(n.labels)}`);
    assert(typeof n.props.name === 'string' && n.props.name && n.props.tapestryValue === n.props.name, `the ${role}'s name is its tapestryValue (D11); got ${show(n.props)}`);
    assert(!('id' in n.props) && n.props.pubkey === TA && Number.isInteger(n.props.created_at), `the ${role} has no id, the assistant as its would-be author, and when it was made; got ${show(n.props)}`);
  }
  const made = changeOf(d, 'concept-created');
  assert(made.length === 1 && made[0].concept === c.conceptHeader && show([...made[0].nodes].sort()) === show(Object.values(c.nodes).sort()) && made[0].count === 8,
    `its entry records concept-created, naming the header and all eight nodes; got ${show(d.change)}`);
  assert(made[0].slug === 'coffee-house' && made[0].name === 'coffee house', `the entry names the slug and the name; got ${show(made[0])}`);
  assert(show(d.change.by) === show({ role: 'owner', pubkey: OWNER }) && d.change.operation === 'graph create-concept', `the entry is the owner's, through graph create-concept; got ${show(d.change)}`);
  assert(/backup/i.test(String(d.note)), `the answer notes that only a backup keeps it; got ${show(d.note)}`);
  assert(show(d.similar) === show([]) && d.moreSimilar === false && show(d.differs) === show([]), `nothing near it, and nothing differs; got ${show({ similar: d.similar, moreSimilar: d.moreSimilar, differs: d.differs })}`);
});

test('CC2: it is what today\'s route signs, recorded without signing: addresses, labels, names, tags, tag uuids, JSON, wiring and memberships', async () => {
  const d = await ok('cc1');
  const { k } = await main();
  const g = await graph();
  const today = await todaysConcept({ name: 'coffee house', ta: TA });
  const headerUuid = today.events[0].uuid;
  assert(headerUuid === d.concept.address, `the header's address is the route's; route ${headerUuid}, answer ${d.concept.address}`);
  for (const e of today.events) {
    const n = C.byUuid(g, e.uuid);
    assert(n, `a node at ${e.uuid}, the address today's route gives it`);
    const suffix = e.kind === 39998 ? null : e.uuid.split(':')[2].slice('coffee-house-'.length);
    const role = suffix ? KEY_OF_SUFFIX[suffix] : 'conceptHeader';
    assert(d.concept.nodes[role] === n.props.tapestryKey, `the answer's ${role} is the node at ${e.uuid}`);
    const want = e.tags.map((t) => [...t]);
    if (suffix) {
      let last = -1;
      want.forEach((t, i) => { if (t[0] === 'z') last = i; });
      want.splice(last + 1, 0, ['o', headerUuid, ROLE_OF_SUFFIX[suffix]]);
    }
    const got = C.tagArrays(g, n.props.tapestryKey);
    for (let i = 0; i < Math.max(got.length, want.length); i++) {
      const [gt, wt] = [got[i], want[i]];
      if (wt && wt[0] === 'json' && gt && gt[0] === 'json') {
        assert(canon(JSON.parse(gt[1])) === canon(JSON.parse(wt[1])), `${role}'s JSON is the route's; got ${gt[1]}, want ${wt[1]}`);
        assert(gt[1] === wt[1], `${role}'s json tag is the route's text exactly, as the letter would carry it`);
      } else {
        assert(show(gt) === show(wt), `${role}'s tag ${i} is ${show(wt)}${suffix && wt && wt[0] === 'o' ? ' (the spec\'s o tag, after the z tags)' : ''}; got ${show(gt)}`);
      }
    }
    const uuids = C.tags(g, n.props.tapestryKey).map((t) => t.uuid);
    assert(show(uuids) === show(want.map((t, i) => C.tagUuid(e.uuid, t, i))), `${role}'s tag nodes have the uuids the import gives them`);
    const nameTag = (want.find((t) => t[0] === 'name') || want.find((t) => t[0] === 'names'))[1];
    assert(n.props.name === nameTag && n.props.kind === e.kind, `${role}'s name and kind are the route's (${nameTag}, ${e.kind}); got ${show(n.props)}`);
    const labels = [e.kind === 39998 ? 'ListHeader' : 'ListItem', ...(today.labels[e.uuid] || []), 'TapestryNode'];
    assert(show([...n.labels].sort()) === show([...new Set(labels)].sort()), `${role}'s labels are the route's, without NostrEvent; got ${show(n.labels)}, want ${show(labels)}`);
    // D9, as a firmware reinstall leaves it (ADR 0016 Amendment 2): exactly these memberships, and no other. The z tags
    // still name word and graph, which the class threads give.
    const from = C.into(g, n.props.tapestryKey, 'HAS_ELEMENT').sort();
    const wantFrom = MEMBERS[role].map((s) => k.supersets[s]).sort();
    const slugOf = (key) => Object.keys(k.supersets).find((s) => k.supersets[s] === key) || key;
    assert(show(from) === show(wantFrom), `${role} is an element of exactly ${MEMBERS[role].join(' and ')}, what a reinstall leaves (Amendment 2); got HAS_ELEMENT from ${show(from.map(slugOf))}`);
  }
  for (const w of today.wiring) {
    const [from, to] = [C.byUuid(g, w.from), C.byUuid(g, w.to)];
    assert(from && to && C.out(g, from.props.tapestryKey, w.type).includes(to.props.tapestryKey), `the route's wiring: ${w.type} from ${w.from} to ${w.to}`);
  }
  const cg = C.tags(g, d.concept.nodes.conceptHeader).find((t) => t.type === 'concept-graph');
  assert(cg && cg.value === C.node(g, d.concept.nodes.conceptGraph).props.uuid, `the header's concept-graph tag names its concept graph's address; got ${show(cg)}`);
});

test('CC3: _fields.js reads it as it reads a lettered concept: its key, its fields, and no elements yet', async () => {
  const d = await ok('cc1');
  const g = await graph();
  process.env.TA_PUBKEY = TA;
  const F = require(path.join(ROOT, 'src/operations/catalog/graph/_fields.js'));
  const read = G.readerOver(g);
  const concept = await F.conceptOf(read, d.concept.conceptHeader);
  // Today's route makes a schema whose only top-level key is the concept's key, so conceptOf reads it as wrapped, as it
  // reads beagle, which the seed made with today's route.
  const beagle = await F.conceptOf(read, (await main()).k.beagle);
  assert(concept && concept.oKey === 'coffeeHouse' && concept.wrapped === beagle.wrapped && concept.wrapped === true, `conceptOf finds the key coffeeHouse in its header's json, wrapped as today's route's beagle is; got ${show(concept)}`);
  assert(show(Object.keys(concept.fields).sort()) === show(['description', 'name', 'slug']), `and its schema node's fields; got ${show(concept.fields)}`);
  assert(show(await F.elementsOf(read, concept, 10)) === show([]), 'and walks its class thread to no elements');
});

test('CC4: graph history finds its entry by the header and by a core node', async () => {
  const d = await ok('cc1');
  const { file } = await main();
  const { a } = runOn(file, [
    { id: 'h-header', method: 'GET', url: `/api/tapestry/graph/history?node=${d.concept.conceptHeader}&limit=5`, caller: 'owner' },
    { id: 'h-core', method: 'GET', url: `/api/tapestry/graph/history?node=${d.concept.nodes.propertyTreeGraph}&limit=5`, caller: 'owner' },
  ]);
  for (const id of ['h-header', 'h-core']) {
    const x = a.req(id);
    const ids = x.status === 200 ? x.body.data.entries.map((e) => e.id) : null;
    assert(ids && ids.includes(d.change.id), `${id}: history finds the create's entry; got ${x.status} ${show(x.body)}`);
  }
});

test('CC5: the same name, or the same slug in other case and spacing, answers already-exists, changes nothing, and names what differs', async () => {
  const first = await ok('cc1');
  const { before } = await main();
  for (const id of ['again', 'variant']) {
    const d = await ok(id);
    assert(d.outcome === 'already-exists' && d.change === null, `${id}: already-exists, change null; got ${show(d)}`);
    assert(d.concept.conceptHeader === first.concept.conceptHeader && show(d.concept.nodes) === show(first.concept.nodes), `${id}: it answers the concept the first call made, with its keys by role`);
  }
  assert(show((await ok('again')).differs) === show([]), 'the same inputs again: nothing differs');
  const v = await ok('variant');
  const by = Object.fromEntries((v.differs || []).map((x) => [x.input, x]));
  assert(!by.name, `the name differs only in case and spacing, so it isn't named; got ${show(v.differs)}`);
  assert(by.plural && by.plural.given === 'coffee housen' && by.plural.holds === 'coffee houses', `the plural given and the plural held; got ${show(by.plural)}`);
  assert(by.description && by.description.given === 'Somewhere to sit.' && typeof by.description.holds === 'string' && by.description.holds !== 'Somewhere to sit.',
    `the description given and the one held, so an agent doesn't assume it was saved (memo #79); got ${show(by.description)}`);
  const g = await graph();
  assert(C.nodesAt(g, `39998:${TA}:coffee-house`).length === 1, 'one header at the address, not two');
  assert(!C.tags(g, first.concept.conceptHeader).some((t) => t.type === 'description'), 'the description given to the repeat wasn\'t saved');
  void before;
});

test('CC6: a concept today\'s route made, and a firmware concept, are returned the same way, with their keys by role', async () => {
  const { k } = await main();
  const beagle = await ok('beagle');
  assert(beagle.outcome === 'already-exists' && beagle.change === null && beagle.concept.conceptHeader === k.beagle && beagle.concept.hasLetter === true, `beagle: already-exists, the lettered concept, hasLetter; got ${show(beagle.concept)}`);
  assert(show(beagle.concept.nodes) === show(k.beagleNodes), `beagle: its eight nodes by role; got ${show(beagle.concept.nodes)}`);
  const set = await ok('set');
  assert(set.outcome === 'already-exists' && set.concept.address === `39998:${TA}:set`, `set: the firmware concept; got ${show(set.concept)}`);
});

test('CC7: near matches and shared concepts are reported, never refused, and more than ten are capped at ten', async () => {
  const { k } = await main();
  const relay = await ok('relay');
  assert(relay.outcome === 'created' && relay.concept.address === `39998:${TA}:nostr-relay`, `nostr relay is made as this instance's own; got ${show(relay.concept)}`);
  const r = (relay.similar || []).find((x) => x.concept === k.relay);
  assert(r && r.match === 'same-slug' && r.own === false && r.author === C.OTHER && r.address === `39998:${C.OTHER}:nostr-relay` && show(r.names) === show({ singular: 'nostr relay', plural: 'nostr relays' }) && r.slug === 'nostr-relay',
    `another author's concept with the slug is reported as a shared concept (Avi's ask); got ${show(relay.similar)}`);
  const bird = await ok('bird');
  const b = (bird.similar || []).find((x) => x.concept === k.bird);
  assert(bird.outcome === 'created' && b && b.match === 'same-name' && b.own === true && b.slug === 'avian', `this instance's own concept with the name and another slug is reported; got ${show(bird.similar)}`);
  const mice = await ok('mice');
  const m = (mice.similar || []).find((x) => x.concept === k.mouse);
  assert(mice.outcome === 'created' && m && m.match === 'plural-swap', `a concept whose plural is the singular asked for is reported; got ${show(mice.similar)}`);
  const widget = await ok('widget');
  assert(widget.outcome === 'created' && widget.similar.length === 10 && widget.moreSimilar === true, `twelve widgets by others are capped at ten, with moreSimilar; got ${widget.similar.length} ${show(widget.moreSimilar)}`);
  assert(widget.similar.every((x) => x.match === 'same-slug' && x.own === false && k.widgets.includes(x.concept)), 'each is another author\'s widget');
});

test('CC8: a name whose key another concept has under another slug is refused key-in-use, naming it; nothing changes', async () => {
  const { k } = await main();
  const body = await refused('cat', 409, 'key-in-use');
  assert(body.rule === RULE, `the refusal comes from ${RULE}; got ${show(body)}`);
  const g = await graph();
  const cat = C.node(g, k.cat);
  assert(String(body.error).includes(cat.props.uuid) || String(body.error).includes(k.cat), `it names the concept that has the key; got ${show(body.error)}`);
  assert(C.nodesAt(g, `39998:${TA}:cat~`).length === 0 && C.nodesAt(g, `39999:${TA}:cat-`).length === 7, 'no second cat was made: the seeded cat\'s seven core nodes, and no more');
});

test('CC9: an address that is held makes the concept take the next nonce, the concept-graph tag following it', async () => {
  const d = await ok('held');
  assert(d.outcome === 'created' && d.concept.address === `39998:${TA}:held~1`, `the header is at held~1; got ${show(d.concept && d.concept.address)}`);
  const g = await graph();
  const cgNode = C.node(g, d.concept.nodes.conceptGraph);
  assert(cgNode.props.uuid === `39999:${TA}:held~1-concept-graph` && C.node(g, d.concept.nodes.superset).props.uuid === `39999:${TA}:held~1-superset`, `each core node takes the header's d-tag; got ${cgNode.props.uuid}`);
  const cg = C.tags(g, d.concept.nodes.conceptHeader).find((t) => t.type === 'concept-graph');
  const dTag = C.tags(g, d.concept.nodes.conceptHeader).find((t) => t.type === 'd');
  assert(cg.value === cgNode.props.uuid && dTag.value === 'held~1', `the d tag and the concept-graph tag follow the nonce; got ${show({ d: dTag, cg })}`);
  assert(d.concept.slug === 'held', `the slug stays held; got ${d.concept.slug}`);
});

test('CC10: with every nonce to ~99 held it is refused no-free-address, and nothing changes', async () => {
  await refused('crowded', 409, 'no-free-address');
  const g = await graph();
  assert(C.nodesAt(g, `39999:${TA}:crowded`).length === 0, 'no core node was made');
});

test('CC11: names are trimmed and their white space collapsed; name and description problems are refused, naming the input', async () => {
  const d = await ok('trim');
  assert(d.outcome === 'created' && d.concept.names.singular === 'tea room' && d.concept.slug === 'tea-room' && d.concept.address === `39998:${TA}:tea-room`, `"  Tea   Room  " is tea room; got ${show(d.concept)}`);
  for (const id of ['n-blank', 'n-noslug', 'n-control', 'n-bidi', 'n-long']) {
    const body = await refused(id, 400, 'bad-name');
    assert(body.input === 'name' && String(body.error).length > 10, `${id}: bad-name, naming the input, in words; got ${show(body)}`);
  }
  assert((await ok('n-200')).outcome === 'created', 'a name of 200 characters is made');
  const p = await refused('p-control', 400, 'bad-name');
  assert(p.input === 'plural', `a plural's problem names the plural; got ${show(p)}`);
  const dsc = await refused('d-control', 400, 'bad-description');
  assert(dsc.input === 'description', `bad-description names the description; got ${show(dsc)}`);
  const g = await graph();
  assert(C.nodesAt(g, `39998:${TA}:kettle`).length === 0 && C.nodesAt(g, `39998:${TA}:x`).length === 0, 'none of the refused names made a node');
});

test('CC11b: an invisible formatting character is refused, and a name with no letter a–z or digit is refused saying so', async () => {
  const zw = await refused('n-zero-width', 400, 'bad-name');
  assert(zw.input === 'name' && /invisible|zero-width|format/i.test(String(zw.error)), `a zero-width space is refused as invisible formatting; got ${show(zw)}`);
  const cy = await refused('n-cyrillic', 400, 'bad-name');
  assert(/a–z|a-z/.test(String(cy.error)) && !/no letter or digit/.test(String(cy.error)), `a Cyrillic name is refused for having no letter a–z or digit, not for having no letter at all; got ${show(cy.error)}`);
  // The zero-width space is not a-z or 0-9, so the name's slug, and its address, would be bea-gle.
  assert(C.nodesAt(await graph(), `39998:${TA}:bea-gle`).length === 0, 'the zero-width name made nothing');
});

test('CC18: a repeat by slug under another name names the name in differs: tea-room against tea room', async () => {
  const first = await ok('trim');
  const d = await ok('trim-dash');
  assert(d.outcome === 'already-exists' && d.concept.conceptHeader === first.concept.conceptHeader, `tea-room has tea room's slug, so it is the repeat; got ${show(d)}`);
  const by = Object.fromEntries((d.differs || []).map((x) => [x.input, x]));
  assert(by.name && by.name.given === 'tea-room' && by.name.holds === 'tea room', `differs names the name given and the name held; got ${show(d.differs)}`);
});

test('CC19: a plural swap the other way: a concept whose singular is the plural asked for', async () => {
  const { k } = await main();
  const d = await ok('swap-other');
  const m = (d.similar || []).find((x) => x.concept === k.mouse);
  assert(d.outcome === 'created' && m && m.match === 'plural-swap', `mouse is reported, its singular the plural asked for; got ${show(d.similar)}`);
});

test('CC20: a bad plural or description is refused before the rule reads the graph: not key-in-use, though cat\'s key is taken', async () => {
  const p = await refused('order-plural', 400, 'bad-name');
  assert(p.input === 'plural', `the plural's problem, before the key clash; got ${show(p)}`);
  const dsc = await refused('order-desc', 400, 'bad-description');
  assert(dsc.input === 'description', `the description's problem, before the key clash; got ${show(dsc)}`);
});

test('CC12: without a firmware concept its nodes join, or without the concept-header concept, it is refused not-installed', async () => {
  needDecl();
  for (const without of [['word'], ['concept-header']]) {
    const { file } = await fresh({ without });
    const { a } = runOn(file, [post('ni', 'owner', { name: 'moth' })]);
    const x = a.req('ni');
    assert(x.status === 409 && x.body.code === 'not-installed', `without ${without}: 409 not-installed; got ${x.status} ${show(x.body)}`);
    assert(String(x.body.error).includes(without[0].replace('-', ' ')) || String(x.body.error).includes(without[0]), `it names what is missing (${without}); got ${show(x.body.error)}`);
    assert(C.nodesAt(S.readState(file), `39998:${TA}:moth`).length === 0, 'and makes nothing');
  }
});

test('CC13: each transaction that makes a concept takes the lock before it writes anything', async () => {
  assert((await ok('cc1')).outcome === 'created', 'the path under test ran (CC1 created a concept)');
  const log = (await graph()).log;
  // Every write in this run is a create-concept, so each committed transaction that creates a node is one.
  const txns = [];
  let cur = null;
  for (const l of log) {
    if (l.call === 'begin') cur = [];
    else if (l.call === 'commit') { if (cur && cur.some((x) => x.call === 'tx.run' && x.kind === 'tags')) txns.push(cur); cur = null; }
    else if (l.call === 'rollback') cur = null;
    else if (cur) cur.push(l);
  }
  assert(txns.length >= 8, `the fake logged each create's transaction; got ${txns.length}`);
  for (const t of txns) {
    const runs = t.filter((x) => x.call === 'tx.run');
    assert(runs[0] && runs[0].kind === 'lock', `its first write is the lock (Decision 6); got ${show(runs.slice(0, 3))}`);
  }
});

test('CC14: a write whose entry can\'t be recorded keeps none of the eight nodes', async () => {
  needDecl();
  const { file } = await fresh({}, (s) => { s.failures = { entry: true }; });
  const { a } = runOn(file, [post('fail', 'owner', { name: 'teapot' })]);
  const x = a.req('fail');
  assert(x.status === 500, `the write fails; got ${x.status} ${show(x.body)}`);
  const g = S.readState(file);
  assert(C.nodesAt(g, `39998:${TA}:teapot`).length === 0 && C.nodesAt(g, `39999:${TA}:teapot`).length === 0, 'and keeps none of its nodes (ADR 0004 Decision 3)');
});

test('CC15: nothing is signed; a visitor gets 401, a stranger 403, a text/plain body 415, and none changes anything; an admin\'s is the admin\'s', async () => {
  assert((await ok('cc1')).outcome === 'created', 'the path under test ran (CC1 created a concept)');
  const { a } = await main();
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key (ADR 0004 Decision 10); the spy saw ${show(a.spy)}`);
  const v = a.req('visitor');
  const s = a.req('stranger');
  const t = a.req('text');
  assert(v.status === 401 && s.status === 403 && t.status === 415, `401, 403 and 415; got ${v.status} ${s.status} ${t.status}`);
  const g = await graph();
  for (const slug of ['visitor-thing', 'stranger-thing', 'text-thing']) assert(C.nodesAt(g, `39998:${TA}:${slug}`).length === 0, `${slug} was not made`);
  const ad = await ok('admin');
  assert(ad.outcome === 'created' && show(ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the admin's create is recorded as the admin's; got ${show(ad.change && ad.change.by)}`);
});

test('CC16: the command creates one too, recorded as the command\'s, and its refusal matches the route\'s', async () => {
  needDecl();
  const { a } = await main();
  const c = a.cmd('cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.success === true && body.data.outcome === 'created' && body.data.concept.address === `39998:${TA}:lamp-post`, `the command answers as the route does; got ${show(body)}`);
  assert(show(body.data.change.by) === show({ role: 'local', pubkey: null }), `its entry names the command; got ${show(body.data.change.by)}`);
  const refusedCmd = a.cmd('cli-refused');
  assert(refusedCmd.code === 1, `a refused command exits 1; got ${refusedCmd.code}`);
  const rb = JSON.parse(refusedCmd.stdout);
  const route = a.req('cat').body;
  assert(rb.code === route.code && rb.error === route.error && rb.rule === route.rule, `the command's refusal is the route's; command ${show(rb)}, route ${show(route)}`);
});

test('CC17: it is listed with its guard, repeatKey and refusals, has its /docs entry, and checks its inputs', async () => {
  needDecl();
  const { a } = await main();
  const e = ((a.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'create-concept');
  assert(e, `graph create-concept is listed; problems: ${show((a.req('list').body.data || {}).problems)}`);
  assert(e.kind === 'write' && e.access === 'owner-and-admins' && show(e.guards) === show([RULE]) && show(e.repeatKey) === show(['name']), `a write for the owner and admins, guard ${RULE}, repeatKey [name]; got ${show({ kind: e.kind, access: e.access, guards: e.guards, repeatKey: e.repeatKey })}`);
  const codes = e.refusals.map((x) => x.code);
  for (const code of ['bad-name', 'bad-description', 'not-installed', 'no-free-address', 'key-in-use', 'missing-input', 'invalid-input', 'unknown-input', 'wrong-content-type', 'sign-in-required', 'not-allowed']) {
    assert(codes.includes(code), `its refusals include ${code}; got ${show(codes)}`);
  }
  for (const [id, code] of [['i-missing', 'missing-input'], ['i-type', 'invalid-input'], ['i-unknown', 'unknown-input']]) {
    const x = a.req(id);
    assert(x.status === 400 && x.body.code === code, `${id}: 400 ${code}; got ${x.status} ${show(x.body)}`);
  }
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('create-concept-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
