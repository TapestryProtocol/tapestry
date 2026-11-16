'use strict';
/**
 * graph update-concept — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/16-create-concept-and-update-concept.md (AC5–AC8 over
 *          the fake; the live check covers the rest)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0016-create-concept-and-update-concept.md
 *          (Decisions 2, 4–6, 9–11, 13)
 *
 * Stack-free, over test/helpers/conceptGraph.js's seed (it says what the graph holds). Two harness runs share one state:
 * the first makes lamp/lamps and dog-house with graph create-concept, the second changes them and the seeded concepts.
 *
 *   UC1  a rename of a concept with no event: its names, tapestryValue, titles, core-node names and default
 *        descriptions follow; its slugs, key, labels, address, d-tags and tapestryKeys stay; its entry names each field
 *        changed, was and now, and the core nodes renamed; no letter is out of date
 *   UC2  a rename of a lettered concept (beagle): a value edited by hand stays, the rest follows, its elements still read
 *        as its elements, and the answer says its letter is out of date
 *   UC3  a slug: the slug tag changes and oSlugs stays; create-concept then finds the concept by its new slug, refuses
 *        its old name key-in-use while the concept keeps that key, and makes a new concept for a name with the old slug
 *        and another key, at the next nonce; another author's slug doesn't count
 *   UC4  a description is set, and then removed: the tag goes and the JSON's default for the current names comes back
 *   UC5  the same values again change nothing, record nothing, and answer unchanged
 *   UC6  each refusal: unknown-concept (no node, or not a header), not-own-concept (another author's, the owner's own
 *        key's), firmware-concept, name-keyed (a new singular; a new plural is allowed), nothing-to-change, slug-in-use
 *        from concept-slug-unique naming the concept, bad-name, and a slug that isn't kebab-case; nothing changes
 *   UC7  nothing is signed; a visitor gets 401, a stranger 403, a text/plain body 415, and none changes anything; an
 *        admin's update is the admin's; the command updates too, its refusal matching the route's; it is listed with its
 *        guard, repeatKey and refusals, and has its /docs entry
 *   (review round 1) UC8 a rename of a concept whose names tag has no plural lands, and repeating it answers
 *        unchanged; UC9 a bad name is refused before the rule reads the graph; UC10 a rename onto a name-keyed name is
 *        refused (the owner's ruling)
 *   (review round 2) UC11 a tag the update can't find when it writes fails the update, which changes nothing
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const C = require('../../helpers/conceptGraph');
const G = require('../../helpers/graphFake');

const { ROOT, TA, OWNER, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph update-concept');

const ROUTE = '/api/tapestry/graph/update-concept';
const CREATE = '/api/tapestry/graph/create-concept';
const DECLS = ['create-concept', 'update-concept'].map((n) => path.join(ROOT, `src/operations/catalog/graph/${n}.js`));
const RULE = 'concept-slug-unique';
const NOBODY = '00000000-0000-4000-8000-0000000000bb';

function needDecls() {
  const missing = DECLS.find((f) => !fs.existsSync(f));
  if (missing) throw new Error(`${path.relative(ROOT, missing)} does not exist yet (ADR graph-operations-first-slice/0016 Decisions 7 and 9)`);
}
const post = (id, caller, body, extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body, ...extra });
const create = (id, body) => ({ id, method: 'POST', url: CREATE, caller: 'owner', body });
const runOn = (file, requests, cli = [], spy = false) => S.answered(S.runHarness({ spy, scenarios: [{ graphFake: { stateFile: file }, requests, cli }] }, { dir: path.dirname(file) }));

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    needDecls();
    const seed = await C.seedConcepts();
    // A names tag with no plural, as a header the dlist curation copies from the community can have (review round 1,
    // blocking 1): mouse's loses its plural.
    const mouse = C.node(seed.state, seed.keys.mouse);
    const namesTag = seed.state.rels.filter((r) => r.from === mouse.eid && r.type === 'HAS_TAG').map((r) => seed.state.nodes.find((n) => n.eid === r.to)).find((t) => t.props.type === 'names');
    delete namesTag.props.value1;
    const file = seed.file(tmp('update-concept-'));
    const k = seed.keys;
    const first = runOn(file, [create('lamp', { name: 'lamp' }), create('dog-house', { name: 'dog-house' })]);
    for (const id of ['lamp', 'dog-house']) {
      const x = first.req(id);
      assert(x.status === 200 && x.body.data.outcome === 'created', `the setup's create of ${id} must succeed; got ${x.status} ${show(x.body)}`);
    }
    const lamp = first.req('lamp').body.data.concept;
    const dogHouse = first.req('dog-house').body.data.concept;
    const before = S.readState(file);
    const a = runOn(file, [
      post('visitor', 'visitor', { concept: lamp.conceptHeader, name: 'visitor lamp' }),
      post('stranger', 'stranger', { concept: lamp.conceptHeader, name: 'stranger lamp' }),
      post('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ concept: lamp.conceptHeader, name: 'text lamp' }) }),
      post('rename', 'owner', { concept: lamp.conceptHeader, name: 'light', plural: 'lights' }),
      post('again', 'owner', { concept: lamp.conceptHeader, name: 'Light', plural: 'lights' }),
      post('slug', 'owner', { concept: lamp.conceptHeader, slug: 'lantern' }),
      create('c-new-slug', { name: 'lantern' }),
      create('c-old-name', { name: 'lamp' }),
      post('desc', 'owner', { concept: lamp.conceptHeader, description: 'A thing that gives light.' }),
      post('desc-clear', 'owner', { concept: lamp.conceptHeader, description: '' }),
      post('slug-in-use', 'owner', { concept: lamp.conceptHeader, slug: 'beagle' }),
      post('slug-bad', 'owner', { concept: lamp.conceptHeader, slug: 'Not Kebab' }),
      post('name-bad', 'owner', { concept: lamp.conceptHeader, name: '   ' }),
      post('beagle', 'owner', { concept: k.beagle, name: 'hound', plural: 'hounds' }),
      post('goal-name', 'owner', { concept: k.goal, name: 'owner goal' }),
      post('goal-plural', 'owner', { concept: k.goal, plural: 'tapestry owner aims' }),
      post('unknown', 'owner', { concept: NOBODY, name: 'ghost' }),
      post('not-header', 'owner', { concept: k.rover, name: 'ghost' }),
      post('other', 'owner', { concept: k.relay, name: 'relay' }),
      post('owner-key', 'owner', { concept: k.recipe, name: 'dish' }),
      post('firmware', 'owner', { concept: k.word, plural: 'wordz' }),
      post('nothing', 'owner', { concept: lamp.conceptHeader }),
      post('dh-slug', 'owner', { concept: dogHouse.conceptHeader, slug: 'kennel' }),
      create('c-dog-house', { name: 'dog house' }),
      post('other-slug', 'owner', { concept: lamp.conceptHeader, slug: 'nostr-relay' }),
      post('mouse-rat', 'owner', { concept: k.mouse, name: 'rat' }),
      post('mouse-rat-again', 'owner', { concept: k.mouse, name: 'rat' }),
      post('order-name-slug', 'owner', { concept: lamp.conceptHeader, name: '   ', slug: 'beagle' }),
      post('onto-goal', 'owner', { concept: k.bird, name: '  Tapestry   Owner Goal ' }),
      post('onto-set', 'owner', { concept: k.bird, name: 'set', plural: 'sets' }),
      post('admin', 'admin', { concept: dogHouse.conceptHeader, description: 'Where a dog sleeps.' }),
      { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
    ], [
      { id: 'cli', argv: ['graph', 'update-concept', '--concept', dogHouse.conceptHeader, '--plural', 'dog-homes'] },
      { id: 'cli-refused', argv: ['graph', 'update-concept', '--concept', k.relay, '--name', 'relay'] },
    ], true);
    return { a, k, file, lamp, dogHouse, before };
  })();
  return MAIN;
}
const graph = async () => S.readState((await main()).file);
async function ok(id) {
  const x = (await main()).a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body)}`);
  return x.body.data;
}
async function refused(id, status, code) {
  const x = (await main()).a.req(id);
  assert(x.status === status && x.body.code === code, `${id} must be refused ${status} ${code}; got ${x.status} ${show(x.body)}`);
  return x.body;
}
const changes = (d, name) => ((d && d.change && d.change.changes) || []).filter((c) => c.change === name);
const field = (d, f) => changes(d, 'concept-updated').find((c) => c.field === f);

test('UC1: a rename of a concept with no event: names, titles and core-node names follow; slugs, key, labels and addresses stay', async () => {
  const { lamp, before } = await main();
  const d = await ok('rename');
  assert(d.outcome === 'updated' && show([...d.changed].sort()) === show(['name', 'plural']) && d.letterOutOfDate === false, `updated, name and plural changed, no letter out of date; got ${show(d)}`);
  assert(show(field(d, 'name')) === show({ change: 'concept-updated', concept: lamp.conceptHeader, field: 'name', was: 'lamp', now: 'light' })
    && show(field(d, 'plural')) === show({ change: 'concept-updated', concept: lamp.conceptHeader, field: 'plural', was: 'lamps', now: 'lights' }), `the entry names each field, was and now; got ${show(d.change)}`);
  const renamed = changes(d, 'core-nodes-renamed')[0];
  const cores = Object.entries(lamp.nodes).filter(([r]) => r !== 'conceptHeader').map(([, x]) => x).sort();
  assert(renamed && renamed.concept === lamp.conceptHeader && show([...renamed.nodes].sort()) === show(cores) && renamed.count === 7, `and the seven core nodes renamed; got ${show(renamed)}`);
  assert(d.concept.names.singular === 'light' && d.concept.slug === 'lamp' && d.concept.key === 'lamp' && d.concept.address === lamp.address, `the concept as it now is: renamed, its slug, key and address as they were; got ${show(d.concept)}`);
  const g = await graph();
  const h = C.node(g, lamp.conceptHeader);
  assert(h.props.name === 'light' && h.props.tapestryValue === 'light' && h.props.uuid === lamp.address, `the header's name and tapestryValue follow (D11), its address stays; got ${show(h.props)}`);
  assert(show(C.tagArrays(g, lamp.conceptHeader).find((t) => t[0] === 'names')) === show(['names', 'light', 'lights']) && C.tags(g, lamp.conceptHeader).find((t) => t.type === 'd').value === 'lamp', 'its names tag follows, its d tag stays');
  const hj = C.json(g, lamp.conceptHeader);
  assert(show(hj.conceptHeader.oNames) === show({ singular: 'light', plural: 'lights' }) && show(hj.conceptHeader.oTitles) === show({ singular: 'Light', plural: 'Lights' }), `oNames and oTitles follow; got ${show(hj.conceptHeader)}`);
  assert(show(hj.conceptHeader.oSlugs) === show({ singular: 'lamp', plural: 'lamps' }) && show(hj.conceptHeader.oKeys) === show({ singular: 'lamp', plural: 'lamps' }) && show(hj.conceptHeader.oLabels) === show({ singular: 'Lamp', plural: 'Lamps' }), `oSlugs, oKeys and oLabels stay (the Dictionary's rule); got ${show(hj.conceptHeader)}`);
  assert(hj.word.name === 'concept header for the concept of lights' && hj.word.title === 'Concept Header for the Concept of Lights' && hj.word.slug === 'concept-header-for-the-concept-of-lamps', `the header's word name and title follow, its slug stays; got ${show(hj.word)}`);
  const sup = C.node(g, lamp.nodes.superset);
  const sj = C.json(g, lamp.nodes.superset);
  assert(sup.props.name === 'superset for the concept of lights' && sup.props.tapestryValue === sup.props.name && C.tags(g, lamp.nodes.superset).find((t) => t.type === 'name').value === sup.props.name, `the superset's name, tapestryValue and name tag follow; got ${show(sup.props)}`);
  assert(sj.superset.name === 'lights' && sj.superset.title === 'Lights' && sj.superset.slug === 'lamps' && sj.superset.description === 'This is the superset of all known lights.' && sj.word.slug === 'superset-for-the-concept-of-lamps',
    `its JSON's names, title and default description follow, its slugs stay; got ${show(sj)}`);
  const js = C.json(g, lamp.nodes.jsonSchema).jsonSchema;
  assert(js.name === 'light' && js.title === 'Light' && js.properties.lamp && js.properties.lamp.name === 'light' && js.properties.lamp.slug === 'lamp' && show(js.required) === show(['lamp']), `the schema's names follow under the same key; got ${show(js)}`);
  for (const [role, key] of Object.entries(lamp.nodes)) {
    const was = C.node(before, key);
    const now = C.node(g, key);
    assert(now && now.props.uuid === was.props.uuid && show(now.labels) === show(was.labels), `the ${role} keeps its tapestryKey, address and labels`);
  }
});

test('UC2: a rename of a lettered concept keeps a hand edit, follows the rest, keeps its elements, and says its letter is out of date', async () => {
  const { k } = await main();
  const d = await ok('beagle');
  assert(d.outcome === 'updated' && d.letterOutOfDate === true, `updated, and its letter is out of date (D2); got ${show(d)}`);
  const g = await graph();
  const sj = C.json(g, k.beagleNodes.superset);
  assert(sj.superset.description === 'All the beagles we know of.' && sj.superset.name === 'hounds' && sj.set.description === 'This is a set of hounds.', `a value edited by hand stays, the defaults follow; got ${show(sj)}`);
  assert(C.node(g, k.beagle).props.uuid === `39998:${TA}:beagle` && show(d.concept.nodes) === show(k.beagleNodes), 'its address and keys stay');
  process.env.TA_PUBKEY = TA;
  const F = require(path.join(ROOT, 'src/operations/catalog/graph/_fields.js'));
  const read = G.readerOver(g);
  const concept = await F.conceptOf(read, k.beagle);
  const elements = concept ? await F.elementsOf(read, concept, 10) : [];
  assert(concept && concept.oKey === 'beagle' && elements.map((e) => e.key).includes(k.rover), `its key is still beagle, and rover still reads as its element; got ${show({ concept, elements })}`);
});

test('UC3: a slug: create-concept finds the concept by it, refuses its old name while the key stays, and other authors\' slugs don\'t count', async () => {
  const { lamp, dogHouse } = await main();
  const d = await ok('slug');
  assert(d.outcome === 'updated' && show(d.changed) === show(['slug']) && d.concept.slug === 'lantern', `updated, the slug changed; got ${show(d)}`);
  assert(show(field(d, 'slug')) === show({ change: 'concept-updated', concept: lamp.conceptHeader, field: 'slug', was: 'lamp', now: 'lantern' }), `its entry; got ${show(d.change)}`);
  const found = await ok('c-new-slug');
  assert(found.outcome === 'already-exists' && found.concept.conceptHeader === lamp.conceptHeader, `create-concept finds it by its new slug; got ${show(found)}`);
  const old = await refused('c-old-name', 409, 'key-in-use');
  assert(old.rule === RULE && (String(old.error).includes(lamp.address) || String(old.error).includes(lamp.conceptHeader)), `its old name is refused while it keeps the key that name gives (AC6, corrected); got ${show(old)}`);
  const dh = await ok('dh-slug');
  assert(dh.outcome === 'updated' && dh.concept.slug === 'kennel', `dog-house's slug is kennel; got ${show(dh.concept)}`);
  const made = await ok('c-dog-house');
  assert(made.outcome === 'created' && made.concept.address === `39998:${TA}:dog-house~1` && made.concept.key === 'dogHouse', `a name with the old slug and another key is a new concept, at the next nonce; got ${show(made.concept)}`);
  assert(dogHouse.address === `39998:${TA}:dog-house`, 'the old one keeps its address');
  const other = await ok('other-slug');
  assert(other.outcome === 'updated' && other.concept.slug === 'nostr-relay', `another author's slug doesn't count for this instance's (rule 10 is per author); got ${show(other)}`);
  const g = await graph();
  const hj = C.json(g, lamp.conceptHeader);
  assert(show(hj.conceptHeader.oSlugs) === show({ singular: 'lamp', plural: 'lamps' }), `oSlugs stays as it was made; got ${show(hj.conceptHeader.oSlugs)}`);
});

test('UC4: a description is set, then removed: the tag goes, and the JSON\'s default for the current names comes back', async () => {
  const { lamp } = await main();
  const set = await ok('desc');
  assert(set.outcome === 'updated' && show(set.changed) === show(['description']) && set.concept.description === 'A thing that gives light.', `the description is set; got ${show(set)}`);
  assert(field(set, 'description') && field(set, 'description').now === 'A thing that gives light.', `its entry says now; got ${show(set.change)}`);
  const cleared = await ok('desc-clear');
  assert(cleared.outcome === 'updated' && show(cleared.changed) === show(['description']), `removing it is a change; got ${show(cleared)}`);
  const g = await graph();
  assert(!C.tags(g, lamp.conceptHeader).some((t) => t.type === 'description'), 'the description tag is gone');
  assert(C.json(g, lamp.conceptHeader).conceptHeader.description === 'Light is a concept.', `the JSON has the default for the current names; got ${show(C.json(g, lamp.conceptHeader).conceptHeader)}`);
});

test('UC5: the same values again change nothing, record nothing, and answer unchanged', async () => {
  const d = await ok('again');
  assert(d.outcome === 'unchanged' && d.change === null && show(d.changed) === show([]), `unchanged, change null; got ${show(d)}`);
});

test('UC6: each refusal, naming what was wrong; nothing changes', async () => {
  const { k, lamp } = await main();
  await refused('unknown', 404, 'unknown-concept');
  await refused('not-header', 404, 'unknown-concept');
  await refused('other', 409, 'not-own-concept');
  await refused('owner-key', 409, 'not-own-concept');
  await refused('firmware', 409, 'firmware-concept');
  const nk = await refused('goal-name', 409, 'name-keyed');
  assert(/tapestry owner goal/.test(String(nk.error)), `name-keyed names the concept; got ${show(nk)}`);
  assert((await ok('goal-plural')).outcome === 'updated', 'a name-keyed concept\'s plural can change');
  await refused('nothing', 400, 'nothing-to-change');
  const inUse = await refused('slug-in-use', 409, 'slug-in-use');
  assert(inUse.rule === RULE && String(inUse.error).includes(`39998:${TA}:beagle`), `slug-in-use comes from ${RULE} and names the concept that has it; got ${show(inUse)}`);
  const badSlug = (await main()).a.req('slug-bad');
  assert(badSlug.status === 400 && badSlug.body.code === 'invalid-input' && badSlug.body.input === 'slug', `a slug that isn't kebab-case: 400 invalid-input; got ${badSlug.status} ${show(badSlug.body)}`);
  const badName = await refused('name-bad', 400, 'bad-name');
  assert(badName.input === 'name', `bad-name names the input; got ${show(badName)}`);
  const g = await graph();
  assert(C.node(g, k.relay).props.name === 'nostr relay' && C.node(g, k.recipe).props.name === 'recipe' && C.tagArrays(g, k.word).find((t) => t[0] === 'names')[2] === 'words', 'another author\'s, the owner\'s and the firmware\'s concepts are as they were');
  assert(C.node(g, k.goal).props.name === 'tapestry owner goal', 'the name-keyed concept keeps its singular name');
  void lamp;
});

test('UC8: a rename of a concept whose names tag has no plural lands, and the same rename again answers unchanged', async () => {
  const { k } = await main();
  const d = await ok('mouse-rat');
  assert(d.outcome === 'updated' && show(d.changed) === show(['name']) && d.concept.names.singular === 'rat', `the rename lands; got ${show(d)}`);
  const again = await ok('mouse-rat-again');
  assert(again.outcome === 'unchanged' && again.change === null, `the same rename again changes nothing and records nothing (AC6); got ${show(again)}`);
  const g = await graph();
  const names = C.tags(g, k.mouse).find((t) => t.type === 'names');
  assert(names.value === 'rat' && (names.value1 === undefined || names.value1 === null), `the names tag holds the new singular, and still no plural; got ${show(names)}`);
  assert(C.node(g, k.mouse).props.name === 'rat', 'the header\'s name follows too');
});

test('UC9: a bad name is refused before the rule reads the graph: bad-name, not slug-in-use', async () => {
  const x = await refused('order-name-slug', 400, 'bad-name');
  assert(x.input === 'name', `the name's problem comes first, though the slug is another concept's; got ${show(x)}`);
});

test('UC10: a rename onto a name the server finds a concept by is refused name-keyed, as the Dictionary\'s edit refuses it; nothing changes', async () => {
  const { k } = await main();
  const goal = await refused('onto-goal', 409, 'name-keyed');
  assert(goal.input === 'name' && /tapestry owner goal/.test(String(goal.error)), `the name is cleaned and compared, and the refusal names it; got ${show(goal)}`);
  const set = await refused('onto-set', 409, 'name-keyed');
  assert(set.input === 'name', `any of the name-keyed names; got ${show(set)}`);
  const g = await graph();
  assert(C.node(g, k.bird).props.name === 'bird' && C.tags(g, k.bird).find((t) => t.type === 'names').value === 'bird', `bird keeps its name; got ${show(C.tags(g, k.bird).find((t) => t.type === 'names'))}`);
});

test('UC11: a tag the update can\'t find when it writes fails the update, which changes nothing', async () => {
  needDecls();
  // As CC21: the fake can't change a tag while the update runs, so bird's names tag keeps its key but loses the
  // TapestryNode label. conceptFacts still reads it, and the copies statement finds one row fewer than it was given.
  const seed = await C.seedConcepts();
  const bird = C.node(seed.state, seed.keys.bird);
  const namesTag = seed.state.rels.filter((r) => r.from === bird.eid && r.type === 'HAS_TAG').map((r) => seed.state.nodes.find((n) => n.eid === r.to)).find((t) => t.props.type === 'names');
  namesTag.labels = namesTag.labels.filter((l) => l !== 'TapestryNode');
  const file = seed.file(tmp('update-concept-lost-'));
  const r = runOn(file, [post('lost', 'owner', { concept: seed.keys.bird, name: 'parrot' })]);
  const x = r.req('lost');
  assert(x.status === 500, `the update fails rather than write part of a rename; got ${x.status} ${show(x.body)}`);
  const g = S.readState(file);
  assert(C.node(g, seed.keys.bird).props.name === 'bird' && C.tags(g, seed.keys.bird).find((t) => t.type === 'names').value === 'bird', 'bird is as it was');
});

test('UC7: nothing is signed; callers, the command, the list and /docs', async () => {
  assert((await ok('rename')).outcome === 'updated', 'the path under test ran (UC1 renamed a concept)');
  const { a, dogHouse, k } = await main();
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key; the spy saw ${show(a.spy)}`);
  assert(a.req('visitor').status === 401 && a.req('stranger').status === 403 && a.req('text').status === 415, `401, 403 and 415; got ${a.req('visitor').status} ${a.req('stranger').status} ${a.req('text').status}`);
  const g = await graph();
  assert(!g.nodes.some((n) => /^(visitor|stranger|text) lamp$/.test(String(n.props.name))), 'none of them renamed anything');
  const ad = await ok('admin');
  assert(ad.outcome === 'updated' && show(ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the admin's update is the admin's; got ${show(ad.change && ad.change.by)}`);
  const c = a.cmd('cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.data.outcome === 'updated' && body.data.concept.names.plural === 'dog-homes' && show(body.data.change.by) === show({ role: 'local', pubkey: null }), `the command updates, recorded as the command's; got ${show(body)}`);
  const rc = a.cmd('cli-refused');
  const rb = JSON.parse(rc.stdout);
  const route = a.req('other').body;
  assert(rc.code === 1 && rb.code === route.code && rb.error === route.error, `the command's refusal is the route's; command ${show(rb)}, route ${show(route)}`);
  const e = ((a.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'update-concept');
  assert(e && e.kind === 'write' && e.access === 'owner-and-admins' && show(e.guards) === show([RULE]) && show(e.repeatKey) === show(['concept', 'name', 'plural', 'slug', 'description']),
    `listed: a write, ${RULE}, repeatKey [concept, name, plural, slug, description]; got ${show(e && { kind: e.kind, guards: e.guards, repeatKey: e.repeatKey })}`);
  const codes = e.refusals.map((x) => x.code);
  for (const code of ['nothing-to-change', 'bad-name', 'bad-description', 'unknown-concept', 'not-own-concept', 'firmware-concept', 'name-keyed', 'not-installed', 'slug-in-use', 'invalid-input', 'wrong-content-type', 'sign-in-required', 'not-allowed']) {
    assert(codes.includes(code), `its refusals include ${code}; got ${show(codes)}`);
  }
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('update-concept-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line}`);
  void dogHouse; void k; void OWNER;
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
