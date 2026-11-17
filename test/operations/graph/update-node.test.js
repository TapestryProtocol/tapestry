'use strict';
/**
 * graph update-node — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/21-update-node.md (AC1–AC7, and AC8 over the fake; the
 *          live check covers the rest)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0021-update-node.md (Decisions 1–20)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/21-update-node.test-plan.md
 *
 * Stack-free: the real catalog, over a graph test/helpers/updateNodeGraph.js seeds for test/helpers/graphFake.js (it
 * says what the graph holds), and over test/helpers/fieldGraph.js's for the marks, with the harness's spy on everything
 * that signs or reads a key. MAIN first makes three elements with graph create-element, so update-node meets that
 * write's own shape, then changes them and the seeded ones; REF holds every refusal, so its graph must end as it began.
 *
 *   UN1  a field: merged into the section, the rest of the node as it was; the answer's node, changed and concepts;
 *        its entry field-changed, with was and now
 *   UN2  the merge: new fields at the end, an object replaced whole, a null taking a field out, JSON text read, and a
 *        field called __proto__ kept as an own field
 *   UN3  description is the section's description field, trimmed; given both ways alike it is taken; "" is a value
 *   UN4  a rename: the node's name and tapestryValue, its name tag, its section's name and slug, its word block's name,
 *        title and slug follow; its address, d tag and key don't; create-element with the old name answers it; the same
 *        rename again is unchanged
 *   UN5  a rename that changes only the case is no clash; another author's element of the name is none either
 *   UN6  letters and the cache: a lettered node's letter is out of date after a change, the owner's letter is the
 *        instance's own, a node the derive step cached says its cached copy is out of date, and a word block that is
 *        the name itself follows a rename
 *   UN7  an element of two concepts: concept names the section; the other concept's verdict is reported, not refused
 *   UN8  sections: a section given the name and slug it lacked, a section restating its own slug, a hand-edited name
 *        kept through a rename, and a node with no name tag gaining one
 *   UN9  an own element of a firmware concept changes; an element create-element made of a concept with a strict
 *        schema changes; the name it already has is unchanged
 *   UN10 nothing is signed; an admin's change is the admin's; the command changes a node too, as the command's
 *   UN11 it is listed with its guard, repeatKey, inputs and every refusal, and has its /docs entry
 *   UN12 graph history finds a field's entry by the node and by the concept, and a rename's by the node
 *   UN13 each update takes the lock on the node first, then the lock on each concept it judges, before it writes
 *   UN14 the change entry's was and now take an element field's value; field describes an element's field
 *   UN15 the catalog's §2 row gives update-node as built
 *   UN20 a changed section that doesn't fit is refused invalid-fields by element-fits-schema, each problem named
 *   UN21 a rename that breaks two concepts' sections names every problem of both
 *   UN22 a concept whose section changes and that has no schema is refused no-schema
 *   UN23 someone else's node is refused not-own-node: another author's letter, an admin's, a stranger's with none
 *   UN24 a node another operation changes is refused made-elsewhere, naming that operation, by its concepts or, before
 *        a reinstall has wired them, by its role labels (Amendment 1)
 *   UN25 firmware's own element is refused firmware-node, naming its file
 *   UN26 a node no concept but word reaches is refused not-an-element
 *   UN27 a node key that names no node, or a change entry, is unknown-node
 *   UN28 concept: one that names no concept header, one keyed word or graphContext, one the node isn't of
 *   UN29 fields with no concept for a node of two concepts, and a concept whose section the node lacks
 *   UN30 JSON that can't be read: no json tag, two that differ, one that doesn't parse, a missing LMDB entry, a list
 *   UN31 a rename onto a name in use, by name, by case, by the address it gives, by the owner's element, in another
 *        concept the node belongs to
 *   UN32 each name problem is refused bad-name
 *   UN33 fields that aren't an object or its text, a name or slug that is neither the node's nor the section's, a name
 *        or slug taken out, a description given two ways, JSON too long: bad-fields
 *   UN34 a call that changes nothing named is nothing-to-change
 *   UN35 inputs are checked: missing, the wrong type, unknown
 *   UN36 a visitor gets 401, a stranger 403, a text/plain body 415; the command's refusal is the route's
 *   UN37 the refusal run changed nothing and recorded nothing
 *   UN38 with no assistant key it is refused not-installed, and nothing changes
 *   UN39 a write whose entry can't be recorded keeps nothing
 *   UN40 the marks: a changed marked field follows onto the node, and a field taken out takes its copy with it
 *   UN41 the new and changed modules require nothing that signs
 *   (review round 1) UN42 a concept keyed __proto__ whose section the node lacks is no-section, not a change recorded but
 *        never stored; UN43 the same description given both ways, with white space around it, is one change, trimmed;
 *        UN44 no-section reached through description alone names description
 *   (review round 2) UN45 fields.description given alone is kept as given, white space and all
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const C = require('../../helpers/conceptGraph');
const E = require('../../helpers/createElementGraph');
const U = require('../../helpers/updateNodeGraph');
const FG = require('../../helpers/fieldGraph');
const { names } = require('../../helpers/todaysCreateConcept');

const { ROOT, TA, OWNER, ADMIN, STRANGER, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph update-node');

const ROUTE = '/api/tapestry/graph/update-node';
const CREATE = '/api/tapestry/graph/create-element';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/update-node.js');
const RULE = 'element-fits-schema';
const NOBODY = '00000000-0000-4000-8000-0000000000cc';
const dtag = require(path.join(ROOT, 'src/lib/dtag.js'));
const fromCode = (n) => String.fromCodePoint(n);

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/update-node.js does not exist yet (ADR graph-operations-first-slice/0021 Decision 1)');
}
const post = (id, caller, body, extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body, ...extra });
const create = (id, body) => ({ id, method: 'POST', url: CREATE, caller: 'owner', body });
const get = (id, url) => ({ id, method: 'GET', url, caller: 'owner' });

/** One harness run over a state file; { r, a }. */
function runOn(file, requests, { cli = [], spy = false, env = null } = {}) {
  const dir = path.dirname(file);
  const r = S.runHarness({ spy, scenarios: [{ graphFake: { stateFile: file }, requests, cli }] }, { dir, env: env ? env(dir) : null });
  return { r, a: S.answered(r) };
}
/** A fresh seed in a directory of its own; { file, k, u, seed }. */
async function fresh(mutate = null) {
  const seed = await U.seedUpdateNode();
  if (mutate) mutate(seed.state, seed.keys);
  return { file: seed.file(tmp('update-node-')), k: seed.keys, u: seed.uuids, seed };
}

const changeOf = (d, name) => ((d && d.change && d.change.changes) || []).filter((c) => c.change === name);
const fieldChange = (d, field) => changeOf(d, 'field-changed').find((c) => c.field === field) || null;
const entriesNow = (g) => g.nodes.filter((n) => n.labels.includes('GraphChange')).length;
const sectionOf = (g, key, oKey) => { const j = C.json(g, key); return j && j[oKey]; };
const tagOf = (g, key, type) => C.tagArrays(g, key).filter((t) => t[0] === type);
/** The node properties an answer's copies name: a list of names or of { property }, or an object keyed by property. */
const propsOf = (copies) => (Array.isArray(copies) ? copies.map((c) => (typeof c === 'string' ? c : c && c.property)) : copies && typeof copies === 'object' ? Object.keys(copies) : ['(not a list or an object)']).sort();
const beagleTitle = names('beagle', 'beagles').oTitles.singular;

// ── MAIN: create-element makes three elements; then update-node changes them, and the seeded ones ──
let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = (async () => {
    const { file, k, u } = await fresh();
    const made = runOn(file, [
      create('snoopy', { concept: k.beagle, name: 'Snoopy', fields: { description: 'A beagle who flies.' } }),
      create('mentors', { concept: k.relationshipType, name: 'Mentors', fields: { alias: 'MENTORS' } }),
      create('widget', { concept: k.gadget, name: 'Widget Four', fields: { size: 4, color: 'red' } }),
    ]).a;
    const keyOf = (id) => {
      const x = made.req(id);
      if (x.status !== 200 || !x.body.data || x.body.data.outcome !== 'created') throw new Error(`graph create-element must make ${id} before update-node changes it; got ${x.status} ${show(x.body).slice(0, 300)}`);
      return x.body.data.element.tapestryKey;
    };
    const snoopy = keyOf('snoopy');
    const mentors = keyOf('mentors');
    const widget = keyOf('widget');
    const before = S.readState(file);
    const { a } = runOn(file, [
      post('field', 'owner', { node: snoopy, fields: { description: 'A beagle who flew.' } }),
      post('field-again', 'owner', { node: snoopy, fields: { description: 'A beagle who flew.' } }),
      post('merge-1', 'owner', { node: snoopy, fields: { meta: { a: 1, b: 2 }, color: 'white' } }),
      post('merge-2', 'owner', { node: snoopy, fields: '{"meta": {"c": 3}, "color": null}' }),
      post('desc', 'owner', { node: snoopy, description: '  A beagle, trimmed.  ' }),
      post('desc-both', 'owner', { node: snoopy, description: 'Both ways', fields: { description: 'Both ways' } }),
      post('rename', 'owner', { node: snoopy, name: '  Snoopy   Ace ' }),
      create('old-name', { concept: k.beagle, name: 'Snoopy', fields: { description: 'Both ways' } }),
      post('rename-again', 'owner', { node: snoopy, name: 'Snoopy Ace' }),
      post('case', 'owner', { node: k.lucky, name: 'LUCKY' }),
      post('snowy', 'owner', { node: k.ghosty, name: 'Snowy' }),
      post('empty-desc', 'owner', { node: k.ghosty, description: '' }),
      post('rover', 'owner', { node: k.rover, fields: { description: 'a better beagle' } }),
      post('rover-rename', 'owner', { node: k.rover, name: 'Rover Two' }),
      post('patch', 'owner', { node: k.patch, fields: { description: "the owner's, changed" } }),
      post('stamped', 'owner', { node: k.stamped, fields: { description: 'changed after its cache was made' } }),
      post('max-dog', 'owner', { node: k.walkerMax, concept: k.dog, fields: { color: 'brown' } }),
      post('max-again', 'owner', { node: k.walkerMax, concept: k.dog, fields: { color: 'brown' } }),
      post('bare', 'owner', { node: k.bare, fields: { name: 'Bare', slug: 'bare' } }),
      post('proto', 'owner', { node: k.bare, fields: '{"__proto__": {"x": 1}}' }),
      post('oddslug', 'owner', { node: k.oddSlug, fields: { slug: 'odd-one', description: 'kept its own slug' } }),
      post('handy', 'owner', { node: k.handy, name: 'Handy Two' }),
      post('tagless', 'owner', { node: k.tagless, name: 'Tagless Two' }),
      post('mentors', 'owner', { node: mentors, fields: { alias: 'MENTORS_OF' } }),
      post('widget', 'owner', { node: widget, fields: { size: 5 } }),
      post('widget-name', 'owner', { node: widget, name: 'Widget Four' }),
      post('admin', 'admin', { node: k.gizmo, fields: { size: 3 } }),
      { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
    ], {
      spy: true,
      cli: [{ id: 'cli', argv: ['graph', 'update-node', '--node', widget, '--fields', '{"color":"green"}'] }],
    });
    return { a, k, u, file, before, snoopy, mentors, widget };
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

test('UN1: a field is merged into the section, the rest of the node is as it was, and the entry says what it was and is', async () => {
  const d = await ok('field');
  const { k, u, snoopy, before } = await main();
  assert(d.outcome === 'updated', `outcome updated; got ${show(d)}`);
  const n = d.node || {};
  assert(n.tapestryKey === snoopy && n.address === E.elementAddress('Snoopy', u.beagle) && n.author === TA && n.own === true && n.hasLetter === false,
    `the node, as the read conventions answer it, with its letter: its key, address, author, own (Decision 17); got ${show(n)}`);
  assert(show(d.changed) === show(['fields.description']), `changed names the one field (Decision 17); got ${show(d.changed)}`);
  const cs = d.concepts || [];
  assert(cs.length === 1 && cs[0].concept === k.beagle && cs[0].key === 'beagle' && cs[0].fits === true && show(cs[0].problems) === show([]), `it belongs to beagle alone, and fits its schema; got ${show(cs)}`);
  const fc = fieldChange(d, 'description');
  assert(fc && fc.node === snoopy && fc.concept === k.beagle && fc.was === 'A beagle who flies.' && fc.now === 'A beagle who flew.',
    `its entry records field-changed: the node, the concept, the field, what it was and is (Decision 18); got ${show(d.change)}`);
  assert(show(d.change.by) === show({ role: 'owner', pubkey: OWNER }) && d.change.operation === 'graph update-node', `the entry is the owner's, through graph update-node; got ${show(d.change && d.change.by)}`);
  assert(d.letterOutOfDate === false && d.cacheOutOfDate === false, `a node made here, never cached: no letter and no cached copy out of date; got ${show({ letter: d.letterOutOfDate, cache: d.cacheOutOfDate })}`);
  assert(/graph only|nothing (was )?signed|signs nothing/i.test(String(d.note)), `the note says the change is in this graph only, and nothing was signed; got ${show(d.note)}`);
  const was = C.node(before, snoopy);
  const g = await graph();
  const now = C.node(g, snoopy);
  assert(show([...now.labels].sort()) === show([...was.labels].sort()) && now.props.uuid === was.props.uuid && now.props.pubkey === was.props.pubkey && now.props.created_at === was.props.created_at && !('id' in now.props),
    `its labels, address, author and time stay, and it gains no id (Decision 13); got ${show(now.props)}`);
  assert(show(C.into(g, snoopy, 'HAS_ELEMENT')) === show(C.into(before, snoopy, 'HAS_ELEMENT')), 'its memberships stay');
  for (const type of ['d', 'z']) assert(show(tagOf(g, snoopy, type)) === show(tagOf(before, snoopy, type)), `its ${type} tag stays`);
});

test('UN2: the merge: new fields go at the end, an object is replaced whole, a null takes a field out, JSON text is read', async () => {
  const one = await ok('merge-1');
  const two = await ok('merge-2');
  const { snoopy } = await main();
  assert(show(one.changed) === show(['fields.color', 'fields.meta']), `merge-1 changed color and meta, sorted; got ${show(one.changed)}`);
  const meta = fieldChange(two, 'meta');
  assert(meta && meta.was && meta.was.a === 1 && meta.was.b === 2 && show(meta.now) === show({ c: 3 }), `an object given is replaced whole, not merged into the one held: { c: 3 }, not { a, b, c } (Decision 8); got ${show(meta)}`);
  const color = fieldChange(two, 'color');
  assert(color && color.was === 'white' && color.now === null, `a field given as null is taken out, its now null (Decision 18); got ${show(color)}`);
  assert(show(two.changed) === show(['fields.color', 'fields.meta']), `merge-2, given as JSON text, changed both; got ${show(two.changed)}`);
  const sec = sectionOf(await graph(), snoopy, 'beagle');
  assert(show(Object.keys(sec)) === show(['name', 'slug', 'description', 'meta']), `the section keeps its order, meta after the fields it had, and no color; got ${show(sec)}`);
  assert(show(sec.meta) === show({ c: 3 }) && !('color' in sec), `meta is { c: 3 } and color is gone; got ${show(sec)}`);
  const p = await ok('proto');
  const { k } = await main();
  const bare = sectionOf(await graph(), k.bare, 'beagle');
  assert(p.outcome === 'updated' && show(p.changed) === show(['fields.__proto__']) && Object.prototype.hasOwnProperty.call(bare, '__proto__') && show(bare.__proto__) === show({ x: 1 }),
    `a field called __proto__, given as JSON text, stays an own field of the section, and nothing else changes (Decision 8); got ${show(p.changed)} ${JSON.stringify(Object.entries(bare))}`);
  assert(({}).x === undefined, 'and no object anywhere gained x');
});

test('UN3: description is the section\'s description field: trimmed, taken when fields gives the same, and "" is a value', async () => {
  const d = await ok('desc');
  const fc = fieldChange(d, 'description');
  assert(fc && fc.now === 'A beagle, trimmed.', `description is trimmed, then is the section's description (Decision 1); got ${show(fc)}`);
  assert(show(d.changed) === show(['fields.description']), `changed names fields.description; got ${show(d.changed)}`);
  const both = await ok('desc-both');
  assert(both.outcome === 'updated' && fieldChange(both, 'description').now === 'Both ways', `description and fields.description, alike, are one change; got ${show(both)}`);
  const empty = await ok('empty-desc');
  const { k } = await main();
  assert(empty.outcome === 'updated' && sectionOf(await graph(), k.ghosty, 'beagle').description === '', `an empty description sets the field to "" (Decision 1); got ${show(sectionOf(await graph(), k.ghosty, 'beagle'))}`);
});

test('UN4: a rename: name, tapestryValue, name tag, section and word block follow; the address, d tag and key stay', async () => {
  const d = await ok('rename');
  const { snoopy, u, k, before } = await main();
  assert(d.outcome === 'updated' && show(d.changed) === show(['name']) && d.node.name === 'Snoopy Ace' && d.node.slug === 'snoopy-ace',
    `the name is cleaned, its white space collapsed, and changed names it; got ${show({ changed: d.changed, node: d.node })}`);
  const r = changeOf(d, 'node-renamed');
  assert(r.length === 1 && r[0].node === snoopy && r[0].was === 'Snoopy' && r[0].now === 'Snoopy Ace', `its entry records node-renamed, was and now (Decision 18); got ${show(d.change)}`);
  const g = await graph();
  const n = C.node(g, snoopy);
  assert(n.props.name === 'Snoopy Ace' && n.props.tapestryValue === 'Snoopy Ace', `the node's name and tapestryValue (D11); got ${show(n.props)}`);
  assert(show(tagOf(g, snoopy, 'name')) === show([['name', 'Snoopy Ace']]), `its name tag; got ${show(tagOf(g, snoopy, 'name'))}`);
  assert(n.props.uuid === E.elementAddress('Snoopy', u.beagle) && show(tagOf(g, snoopy, 'd')) === show(tagOf(before, snoopy, 'd')), `its address and d tag never change, so a letter published later lands on it (Decision 9); got ${n.props.uuid} ${show(tagOf(g, snoopy, 'd'))}`);
  const j = C.json(g, snoopy);
  assert(j.beagle.name === 'Snoopy Ace' && j.beagle.slug === 'snoopy-ace', `its section's name and slug follow (the owner's answer, open question 2); got ${show(j.beagle)}`);
  assert(show(j.word) === show({ slug: 'beagle--snoopy-ace', name: 'beagle: Snoopy Ace', title: `${beagleTitle}: Snoopy Ace`, wordTypes: ['word', 'beagle'] }), `its word block's slug, name and title follow, wordTypes stay; got ${show(j.word)}`);
  const old = (await main()).a.req('old-name');
  assert(old.status === 200 && old.body.data.outcome === 'already-exists' && old.body.data.element.tapestryKey === snoopy, `create-element with the old name answers the renamed element, which sits at the address that name gives; got ${old.status} ${show(old.body).slice(0, 400)}`);
  const differs = (old.body.data.differs || []).find((x) => x.input === 'name');
  assert(differs && differs.given === 'Snoopy' && differs.holds === 'Snoopy Ace', `and its differs names the name; got ${show(old.body.data.differs)}`);
  const again = await ok('rename-again');
  assert(again.outcome === 'unchanged' && again.change === null && show(again.changed) === show([]), `the same rename again is unchanged, and records nothing; got ${show(again)}`);
  void k;
});

test('UN5: a rename that changes only the case is no clash; another author\'s element of the name is none either', async () => {
  const d = await ok('case');
  const { k } = await main();
  const g = await graph();
  assert(d.outcome === 'updated' && show(d.changed) === show(['name']) && C.node(g, k.lucky).props.name === 'LUCKY', `Lucky renamed LUCKY: its own name, in another case, is no clash (Decision 10); got ${show(d)}`);
  const j = C.json(g, k.lucky);
  assert(j.beagle.slug === 'lucky' && j.word.slug === 'beagle--lucky' && j.word.name === 'beagle: LUCKY', `the slug the name gives is the same, so it stays, and the word block's name follows; got ${show(j)}`);
  const s = await ok('snowy');
  assert(s.outcome === 'updated' && C.node(g, k.ghosty).props.name === 'Snowy' && C.node(g, k.snowy).props.name === 'Snowy', `ghosty renamed Snowy beside another author's Snowy, which isn't the instance's own (Decision 10); got ${show(s)}`);
  assert(s.node.own === true && s.node.author === null, `a node made here with no author is the instance's own (Decision 3); got ${show(s.node)}`);
});

test('UN6: letters and the cache: a lettered node\'s letter is out of date, the owner\'s letter is the instance\'s own, a cached node says so', async () => {
  const rover = await ok('rover');
  assert(rover.outcome === 'updated' && rover.letterOutOfDate === true && rover.node.hasLetter === true && rover.node.own === true,
    `rover, lettered by the assistant: changed, and its letter now differs from it (Decision 15); got ${show(rover)}`);
  assert(/export nostr|A10\.34/.test(String(rover.note)), `the note says export nostr sends a new letter; got ${show(rover.note)}`);
  const patch = await ok('patch');
  assert(patch.outcome === 'updated' && patch.node.own === true && patch.node.author === OWNER && patch.letterOutOfDate === true,
    `patch, lettered by the owner, is the instance's own (the owner's answer, open question 3), and its letter is out of date; got ${show(patch)}`);
  const st = await ok('stamped');
  assert(st.outcome === 'updated' && st.cacheOutOfDate === true && /cache/i.test(String(st.note)) && /A10\.36|cache rebuild/.test(String(st.note)),
    `a node the derive step cached: its cached copy may be out of date until cache rebuild (Decision 16; the owner's answer, open question 4); got ${show(st)}`);
  const { k } = await main();
  const g = await graph();
  assert(C.node(g, k.stamped).props.tapestryJsonUpdatedAt === 1763000001, 'the cache stamp is left as it was: the cache isn\'t touched');
  const rr = await ok('rover-rename');
  const j = C.json(g, k.rover);
  assert(rr.outcome === 'updated' && j.word.name === 'Rover Two' && j.word.slug === 'rover-two' && j.beagle.name === 'Rover Two' && j.beagle.slug === 'rover-two',
    `rover's word block holds its name and slug themselves, and both follow the rename (Decision 9); got ${show(j)}`);
});

test('UN7: an element of two concepts: concept names the section, and the other concept\'s verdict is reported, not refused', async () => {
  const d = await ok('max-dog');
  const { k } = await main();
  assert(d.outcome === 'updated' && sectionOf(await graph(), k.walkerMax, 'dog').color === 'brown', `walkerMax's dog section gains color; got ${show(d)}`);
  const cs = d.concepts || [];
  assert(cs[0] && cs[0].concept === k.dog && cs[0].fits === true, `the concept named comes first, and fits (Decision 17); got ${show(cs)}`);
  const pet = cs.find((c) => c.concept === k.pet);
  assert(cs.length === 2 && pet && pet.key === 'pet' && pet.fits === false && (pet.problems || []).some((p) => /pet/.test(String(p.message))),
    `pet's schema wants a pet section, which walkerMax lacks: reported, never refused for (Decision 11); got ${show(cs)}`);
  const again = await ok('max-again');
  assert(again.outcome === 'unchanged' && again.change === null, `the same call again is unchanged; got ${show(again)}`);
});

test('UN8: sections: a name and slug given to a section that lacked them, a section\'s own slug restated, a hand-edited name kept, a name tag gained', async () => {
  const { k } = await main();
  const g = await graph();
  const bare = await ok('bare');
  assert(bare.outcome === 'updated' && show(bare.changed) === show(['fields.name', 'fields.slug']), `bare's section gains the name and slug it lacked (Decision 8); got ${show(bare)}`);
  const bs = sectionOf(g, k.bare, 'beagle');
  assert(show(Object.keys(bs).slice(0, 3)) === show(['description', 'name', 'slug']) && bs.name === 'Bare' && bs.slug === 'bare' && bs.description === 'bare', `after its description, which it had (UN2's __proto__ field comes later); got ${JSON.stringify(Object.entries(bs))}`);
  const odd = await ok('oddslug');
  assert(odd.outcome === 'updated' && show(odd.changed) === show(['fields.description']) && sectionOf(g, k.oddSlug, 'beagle').slug === 'odd-one',
    `a slug the section already holds may be restated, as a read-modify-write does, though it isn't the slug the name gives (Decision 8); got ${show(odd)}`);
  const handy = await ok('handy');
  const hs = sectionOf(g, k.handy, 'beagle');
  assert(handy.outcome === 'updated' && hs.name === 'Hand Edited' && hs.slug === 'handy-two' && C.json(g, k.handy).word.name === 'beagle: Handy Two',
    `a section's name edited by hand stays; the slug and word block that held what the old name gave follow (Decision 9); got ${show(C.json(g, k.handy))}`);
  const tagless = await ok('tagless');
  const tags = C.tagArrays(g, k.tagless);
  const uuid = C.node(g, k.tagless).props.uuid;
  assert(tagless.outcome === 'updated' && show(tags.map((t) => t[0])) === show(['d', 'z', 'json', 'name']) && tags[3][1] === 'Tagless Two',
    `a node with no name tag gains one, at the end (Decision 13); got ${show(tags)}`);
  const nameTag = C.tags(g, k.tagless)[3];
  assert(nameTag.uuid === C.tagUuid(uuid, ['name', 'Tagless Two'], 3) && typeof nameTag.key === 'string', `with the uuid the import gives a tag at that index, and a key; got ${show(nameTag)}`);
});

test('UN9: an own element of a firmware concept changes; one with a strict schema changes; a name it already has is unchanged', async () => {
  const m = await ok('mentors');
  const { mentors, widget } = await main();
  const g = await graph();
  assert(m.outcome === 'updated' && sectionOf(g, mentors, 'relationshipType').alias === 'MENTORS_OF', `an element of firmware's relationship type that firmware's files don't define is the owner's, and changes (Decision 4); got ${show(m)}`);
  const w = await ok('widget');
  assert(w.outcome === 'updated' && fieldChange(w, 'size').was === 4 && fieldChange(w, 'size').now === 5, `gadget's size, an integer, changes, was and now numbers; got ${show(w)}`);
  const wn = await ok('widget-name');
  assert(wn.outcome === 'unchanged' && wn.change === null, `its own name again changes nothing; got ${show(wn)}`);
  void widget;
});

test('UN10: nothing is signed; an admin\'s change is the admin\'s; the command changes a node, as the command\'s', async () => {
  assert((await ok('field')).outcome === 'updated', 'the path under test ran (UN1 changed a field)');
  const { a, widget, k } = await main();
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key (ADR 0004 Decision 10, D1); the spy saw ${show(a.spy)}`);
  const ad = await ok('admin');
  assert(ad.outcome === 'updated' && show(ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the admin's change is recorded as the admin's; got ${show(ad.change && ad.change.by)}`);
  const c = a.cmd('cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.success === true && body.data.outcome === 'updated' && show(body.data.change.by) === show({ role: 'local', pubkey: null }), `the command answers as the route does, fields given as JSON text, its entry the command's; got ${show(body)}`);
  assert(sectionOf(await graph(), widget, 'gadget').color === 'green', 'the command\'s change is kept');
  void k;
});

test('UN11: it is listed with its guard, repeatKey, inputs and every refusal, and has its /docs entry', async () => {
  needDecl();
  const { a } = await main();
  const e = ((a.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'update-node');
  assert(e, `graph update-node is listed; problems: ${show((a.req('list').body.data || {}).problems)}`);
  assert(e.kind === 'write' && e.access === 'owner-and-admins' && show(e.guards) === show([RULE]) && show(e.repeatKey) === show(['node', 'concept', 'name', 'description', 'fields']),
    `a write for the owner and admins, guard ${RULE}, repeatKey [node, concept, name, description, fields] (Decision 1); got ${show({ kind: e.kind, access: e.access, guards: e.guards, repeatKey: e.repeatKey })}`);
  const ins = e.inputs || {};
  assert(ins.node && ins.node.required === true && ['name', 'description', 'fields', 'concept'].every((i) => ins[i] && !ins[i].required), `node is required; name, description, fields and concept are not; got ${show(ins)}`);
  const kinds = ((ins.fields.schema || {}).oneOf || []).map((x) => x.type).sort();
  assert(show(kinds) === show(['object', 'string']), `fields takes an object or its JSON text; got ${show(ins.fields.schema)}`);
  const status = Object.fromEntries((e.refusals || []).map((x) => [x.code, x.status]));
  const want = {
    'nothing-to-change': 400, 'bad-name': 400, 'bad-fields': 400, 'not-installed': 409, 'unknown-node': 404, 'not-own-node': 409,
    'made-elsewhere': 409, 'firmware-node': 409, 'not-an-element': 409, 'unknown-concept': 404, 'reserved-key': 409, 'not-its-concept': 409,
    'concept-needed': 409, 'unreadable-json': 409, 'no-section': 409, 'name-in-use': 409, 'invalid-fields': 400, 'no-schema': 409,
  };
  for (const [code, st] of Object.entries(want)) assert(status[code] === st, `its refusals include ${code} (${st}), Decision 20's; got ${show(status)}`);
  for (const code of ['missing-input', 'invalid-input', 'unknown-input', 'wrong-content-type', 'sign-in-required', 'not-allowed']) assert(code in status, `its refusals include ${code}; got ${show(Object.keys(status))}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('update-node-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

test('UN12: graph history finds a field\'s entry by the node and by the concept, and a rename\'s by the node', async () => {
  const f = await ok('field');
  const r = await ok('rename');
  const { file, k, snoopy } = await main();
  const { a } = runOn(file, [
    get('h-node', `/api/tapestry/graph/history?node=${snoopy}&limit=50`),
    get('h-concept', `/api/tapestry/graph/history?node=${k.beagle}&limit=200`),
  ]);
  const ids = (id) => { const x = a.req(id); return x.status === 200 ? x.body.data.entries.map((e) => e.id) : null; };
  assert((ids('h-node') || []).includes(f.change.id) && (ids('h-node') || []).includes(r.change.id), `history by the node finds the field's entry and the rename's; got ${show(a.req('h-node').body).slice(0, 400)}`);
  assert((ids('h-concept') || []).includes(f.change.id), `history by the concept finds the field's entry (AC1); got ${show(a.req('h-concept').body).slice(0, 400)}`);
});

// ── the locks (Decision 5), over a run of two calls that write nothing but their locks ──
test('UN13: each update takes the lock on the node first, then the lock on each concept it judges, before it writes', async () => {
  needDecl();
  const { file, k } = await fresh();
  const { a } = runOn(file, [
    post('two-concepts', 'owner', { node: k.walkerMax, concept: k.dog, fields: { name: 'Max' } }),
    post('one-concept', 'owner', { node: k.lucky, fields: { description: 'a lucky beagle' } }),
  ]);
  for (const id of ['two-concepts', 'one-concept']) {
    const x = a.req(id);
    assert(x.status === 200 && x.body.data.outcome === 'unchanged', `${id}: the path under test ran, changing nothing; got ${x.status} ${show(x.body).slice(0, 300)}`);
  }
  const txns = [];
  let cur = null;
  for (const l of S.readState(file).log) {
    if (l.call === 'begin') cur = [];
    else if (l.call === 'commit' || l.call === 'rollback') { if (cur) txns.push(cur); cur = null; } else if (cur) cur.push(l);
  }
  assert(txns.length === 2, `the fake logged one transaction for each call; got ${txns.length}`);
  for (const [t, judged, id] of [[txns[0], 2, 'two-concepts (dog and pet)'], [txns[1], 1, 'one-concept (beagle)']]) {
    assert(t[0] && t[0].kind === 'copies' && t[1] && t[1].kind === 'copies', `${id}: the transaction starts with the lock on the node, set and removed, before any read; got ${show(t.slice(0, 3))}`);
    const locks = t.filter((x) => x.call === 'tx.run' && x.kind === 'copies').length;
    assert(locks === 2 + 2 * judged, `${id}: an unchanged call writes nothing but its locks: the node's and each judged concept's header, ${2 + 2 * judged} lock statements; got ${locks}: ${show(t.map((x) => x.kind))}`);
    assert(!t.some((x) => x.call === 'tx.run' && x.kind !== 'copies'), `${id}: and nothing else is written; got ${show(t.filter((x) => x.call === 'tx.run'))}`);
  }
});

test('UN14: the change entry\'s was and now take an element field\'s value, and field describes an element\'s field', () => {
  needDecl();
  const { CHANGE } = require(path.join(ROOT, 'src/operations/changes.js'));
  const p = CHANGE.properties || {};
  for (const f of ['was', 'now']) {
    assert(p[f] && !('type' in p[f]) && /element/.test(String(p[f].description)), `${f} takes any JSON value, an element field's included, with no type (Decision 18); got ${show(p[f])}`);
  }
  assert(/element/.test(String(p.field && p.field.description)), `field's description covers an element's field; got ${show(p.field)}`);
});

test('UN15: the catalog\'s §2 row gives update-node as built: its inputs, its rule and what it refuses', () => {
  needDecl();
  const text = fs.readFileSync(path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md'), 'utf8');
  const row = text.split('\n').find((l) => l.startsWith('| `update-node` |')) || '';
  for (const input of ['`node`', '`concept?`', '`name?`', '`description?`', '`fields?`']) assert(row.includes(input), `its row names ${input}; got ${show(row)}`);
  for (const word of ['`element-fits-schema`', '`not-own-node`', '`name-in-use`']) assert(row.includes(word), `its row names ${word}; got ${show(row)}`);
});

// ── REF: every refusal, over a graph that must end as it began ──
let REF = null;
function ref() {
  if (REF) return REF;
  REF = (async () => {
    const { file, k } = await fresh();
    const before = S.readState(file);
    const lucky = (id, body, caller = 'owner') => post(id, caller, { node: k.lucky, ...body });
    const { a } = runOn(file, [
      post('visitor', 'visitor', { node: k.lucky, fields: { description: 'x' } }),
      post('stranger', 'stranger', { node: k.lucky, fields: { description: 'x' } }),
      post('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ node: k.lucky, fields: { description: 'x' } }) }),
      // rule 4
      post('size-big', 'owner', { node: k.gizmo, fields: { size: 'big' } }),
      post('color-blue', 'owner', { node: k.gizmo, fields: { color: 'blue' } }),
      post('weight', 'owner', { node: k.gizmo, fields: { weight: 3 } }),
      lucky('desc-out', { fields: { description: null } }),
      post('two-faced', 'owner', { node: k.twoFaced, name: 'Two Faces' }),
      post('scrolled', 'owner', { node: k.scrolled, fields: { extra: 1 } }),
      // whose node it is
      post('other', 'owner', { node: k.snowy, fields: { description: 'mine now' } }),
      post('admin-letter', 'owner', { node: k.ace, fields: { description: 'mine now' } }),
      post('drifter', 'owner', { node: k.drifter, name: 'Settled' }),
      // the node's kind
      post('me-header', 'owner', { node: k.beagle, name: 'hound' }),
      post('me-superset', 'owner', { node: k.beagleSuperset, name: 'all the hounds' }),
      post('me-schema', 'owner', { node: k.beagleNodes.jsonSchema, fields: { type: 'object' } }),
      post('me-primary', 'owner', { node: k.beagleNodes.primaryProperty, name: 'primary hound' }),
      post('me-property', 'owner', { node: k.propertyNode, name: 'a tight property' }),
      post('me-set', 'owner', { node: k.walkers, name: 'runners' }),
      post('me-set-label', 'owner', { node: k.showBeagles, name: 'show hounds' }),
      post('me-rule', 'owner', { node: k.ruleElement, name: 'a new rule' }),
      post('fw-rover', 'owner', { node: k.firmwareRover, fields: { breed: 'irishSetter' } }),
      post('ne-loner', 'owner', { node: k.loner, name: 'alone' }),
      post('ne-word', 'owner', { node: k.wordOnly, name: 'only a lexeme' }),
      post('un-nobody', 'owner', { node: NOBODY, name: 'Nobody' }),
      post('un-entry', 'owner', { node: k.G, name: 'Entry' }),
      // the concept and the section
      lucky('uc-nobody', { concept: NOBODY, fields: { description: 'x' } }),
      lucky('uc-element', { concept: k.rover, fields: { description: 'x' } }),
      lucky('rk-word', { concept: k.word, fields: { description: 'x' } }),
      lucky('rk-graph-context', { concept: k.graphContextConcept, fields: { description: 'x' } }),
      lucky('nic-gadget', { concept: k.gadget, fields: { size: 1 } }),
      post('needed', 'owner', { node: k.walkerMax, fields: { color: 'grey' } }),
      post('needed-desc', 'owner', { node: k.walkerMax, description: 'a walker' }),
      post('no-section', 'owner', { node: k.walkerMax, concept: k.pet, fields: { description: 'a pet' } }),
      // JSON that can't be read
      ...['mute', 'twofer', 'garble', 'phantom', 'listy'].map((n) => post(`uj-${n}`, 'owner', { node: k[n], fields: { description: 'x' } })),
      // names in use
      lucky('niu-name', { name: 'Rover' }),
      lucky('niu-case', { name: 'ROVER' }),
      lucky('niu-address', { name: 'Odie' }),
      lucky('niu-owner', { name: 'Patch' }),
      post('niu-other-concept', 'owner', { node: k.walkerMax, name: 'Whiskers' }),
      // names
      lucky('n-blank', { name: '   ' }),
      lucky('n-noslug', { name: '!!!' }),
      lucky('n-control', { name: `bad${fromCode(7)}name` }),
      lucky('n-bidi', { name: `bi${fromCode(0x202E)}di` }),
      lucky('n-zero-width', { name: `luc${fromCode(0x200B)}ky` }),
      lucky('n-long', { name: 'x'.repeat(201) }),
      // fields
      lucky('f-text-bad', { fields: 'not json' }),
      lucky('f-text-array', { fields: '[1, 2]' }),
      lucky('f-text-null', { fields: 'null' }),
      lucky('f-array', { fields: [1] }),
      lucky('f-name', { fields: { name: 'Someone Else' } }),
      lucky('f-slug', { fields: { slug: 'other-slug' } }),
      lucky('f-name-null', { fields: { name: null } }),
      lucky('f-slug-null', { fields: { slug: null } }),
      lucky('f-desc-two-ways', { description: 'one way', fields: { description: 'another way' } }),
      lucky('f-long', { fields: { description: 'z'.repeat(1000000) } }),
      // nothing to change
      lucky('nothing', {}),
      lucky('nothing-but-concept', { concept: k.beagle }),
      // inputs
      post('i-missing', 'owner', {}),
      post('i-type', 'owner', { node: 5, name: 'Q' }),
      post('i-unknown', 'owner', { node: k.lucky, name: 'Q', color: 'red' }),
    ], {
      spy: true,
      cli: [{ id: 'cli-refused', argv: ['graph', 'update-node', '--node', k.lucky, '--fields', '{"description": null}'] }],
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
const err = (body) => String(body && body.error);

test('UN20: a changed section that doesn\'t fit is refused invalid-fields by element-fits-schema, each problem named in words', async () => {
  const big = await refused('size-big', 400, 'invalid-fields');
  assert(big.rule === RULE && /gadget\.size/.test(err(big)) && /integer/.test(err(big)), `the wrong type names the field and the type, from ${RULE}; got ${show(big)}`);
  const blue = await refused('color-blue', 400, 'invalid-fields');
  assert(/gadget\.color/.test(err(blue)) && /red/.test(err(blue)) && /green/.test(err(blue)), `a value not allowed lists the values; got ${err(blue)}`);
  const w = await refused('weight', 400, 'invalid-fields');
  assert(/`?gadget\.weight`? isn't a field the schema takes/.test(err(w)), `a field the schema doesn't take is named so; got ${err(w)}`);
  const out = await refused('desc-out', 400, 'invalid-fields');
  assert(/`?beagle\.description`? is required/.test(err(out)), `a required field taken out is named; got ${err(out)}`);
});

test('UN21: a rename that breaks two concepts\' sections names every problem of both', async () => {
  const body = await refused('two-faced', 400, 'invalid-fields');
  assert(body.rule === RULE && /pet\.description/.test(err(body)) && /gadget\.size/.test(err(body)),
    `both changed sections are judged, and the refusal lists pet's problem and gadget's (Decision 11: every finding); got ${err(body)}`);
});

test('UN22: a concept whose section changes and that has no schema is refused no-schema', async () => {
  const body = await refused('scrolled', 409, 'no-schema');
  assert(body.rule === RULE && /schema/i.test(err(body)), `no-schema from ${RULE}, saying why; got ${show(body)}`);
});

test('UN23: someone else\'s node is refused not-own-node: another author\'s letter, an admin\'s, a stranger\'s with no letter', async () => {
  const { k } = await ref();
  const g = (await ref()).before;
  for (const [id, author, key, letter] of [['other', E.OTHER, k.snowy, true], ['admin-letter', ADMIN, k.ace, true], ['drifter', STRANGER, k.drifter, false]]) {
    const body = await refused(id, 409, 'not-own-node');
    const address = C.node(g, key).props.uuid;
    assert(body.input === 'node' && err(body).includes(author) && err(body).includes(address), `${id}: names the input, its author and its address (Decision 3); got ${show(body)}`);
    assert(/copy-node/.test(err(body)) && /A10\.24/.test(err(body)), `${id}: says graph copy-node (A10.24) makes a copy of one's own (D8); got ${err(body)}`);
    assert(letter ? /event|letter/i.test(err(body)) : /recorded author|records/i.test(err(body)), `${id}: says whether it came from an event or only records the author; got ${err(body)}`);
  }
});

test('UN24: a node another operation changes is refused made-elsewhere, naming that operation, by its concepts or its labels', async () => {
  // By its concepts (Decision 4): beagle's superset, schema and primary property are elements of firmware's superset,
  // json-schema and primary-property concepts; walkers of set; the loose property of property; the rule of graph rule.
  // By its role labels alone (Amendment 1): beagle's header, which today's route made and no reinstall has yet made an
  // element of the concept-header concept, and show beagles, a set no reinstall has yet registered under set.
  const cases = [
    ['me-header', /update-concept/, 'a concept header, by its label'], ['me-superset', /update-concept/, 'a superset'],
    ['me-primary', /update-concept/, 'a primary property, by its concept before its label'], ['me-schema', /set-schema/, 'a JSON schema'],
    ['me-property', /update-property/, 'a property'], ['me-set', /A10\.21\.a/, 'a set of the set concept'],
    ['me-set-label', /A10\.21\.a/, 'a set, by its label'], ['me-rule', /rulebook|GRAPH_RULES/, 'a graph rule'],
  ];
  for (const [id, op, what] of cases) {
    const body = await refused(id, 409, 'made-elsewhere');
    assert(body.input === 'node' && op.test(err(body)), `${id}, ${what}: names ${op} (Decision 4; Amendment 1); got ${show(body)}`);
  }
});

test('UN25: firmware\'s own element is refused firmware-node, naming its file', async () => {
  const body = await refused('fw-rover', 409, 'firmware-node');
  assert(/concepts\/dog\/elements\/rover\.json/.test(err(body)) && /seed-firmware|A10\.37|reinstall/i.test(err(body)), `names the file and how firmware changes (Decision 4); got ${show(body)}`);
});

test('UN26: a node no concept but word reaches is refused not-an-element', async () => {
  for (const id of ['ne-loner', 'ne-word']) {
    const body = await refused(id, 409, 'not-an-element');
    assert(body.input === 'node' && /add-to-concept|A10\.22/.test(err(body)), `${id}: names graph add-to-concept (A10.22) (Decision 4); got ${show(body)}`);
  }
});

test('UN27: a node key that names no node, or a change entry, is unknown-node', async () => {
  for (const id of ['un-nobody', 'un-entry']) {
    const body = await refused(id, 404, 'unknown-node');
    assert(body.input === 'node', `${id}: names the input node; got ${show(body)}`);
  }
});

test('UN28: concept: one that names no concept header, one keyed word or graphContext, one the node isn\'t an element of', async () => {
  for (const id of ['uc-nobody', 'uc-element']) assert((await refused(id, 404, 'unknown-concept')).input === 'concept', `${id}: names the input concept`);
  for (const [id, key] of [['rk-word', 'word'], ['rk-graph-context', 'graphContext']]) {
    const body = await refused(id, 409, 'reserved-key');
    assert(body.input === 'concept' && err(body).includes(key), `${id}: reserved-key, naming the key ${key} (Decision 6); got ${show(body)}`);
  }
  const nic = await refused('nic-gadget', 409, 'not-its-concept');
  const { k } = await ref();
  assert(nic.input === 'concept' && err(nic).includes(k.beagle), `not-its-concept names the input, and lists the concepts the node is an element of; got ${show(nic)}`);
});

test('UN29: fields with no concept for a node of two concepts is concept-needed; a section the node lacks is no-section', async () => {
  const { k } = await ref();
  for (const id of ['needed', 'needed-desc']) {
    const body = await refused(id, 409, 'concept-needed');
    assert(err(body).includes(k.dog) && err(body).includes(k.pet), `${id}: lists each concept the node belongs to, dog's and pet's (Decision 6); got ${show(body)}`);
  }
  const ns = await refused('no-section', 409, 'no-section');
  assert(/pet/.test(err(ns)) && /add-to-concept|A10\.22/.test(err(ns)), `no-section names the section and graph add-to-concept (A10.22); got ${show(ns)}`);
});

test('UN30: JSON that can\'t be read is refused unreadable-json', async () => {
  for (const [n, why] of [['mute', /json tag/i], ['twofer', /differ|more than one|two/i], ['garble', /pars/i], ['phantom', /LMDB/i], ['listy', /object/i]]) {
    const body = await refused(`uj-${n}`, 409, 'unreadable-json');
    assert(why.test(err(body)), `uj-${n}: unreadable-json, saying why (${why}) (Decision 7); got ${show(body)}`);
  }
});

test('UN31: a rename onto a name in use is refused name-in-use, naming the element that has it', async () => {
  const { k } = await ref();
  const cases = [
    ['niu-name', k.rover, 'another of the instance\'s own elements of beagle has the name'],
    ['niu-case', k.rover, 'the name in another case'],
    ['niu-address', k.odie, 'an element at the address the name gives, under another name'],
    ['niu-owner', k.patch, 'the owner\'s own element has the name'],
    ['niu-other-concept', k.whiskers, 'an element of pet, the other concept walkerMax belongs to, has the name'],
  ];
  for (const [id, other, why] of cases) {
    const body = await refused(id, 409, 'name-in-use');
    assert(body.input === 'name' && err(body).includes(other), `${id}: ${why}, so it is refused, naming that element (Decision 10); got ${show(body)}`);
  }
});

test('UN32: each name problem is refused bad-name, naming the input', async () => {
  for (const id of ['n-blank', 'n-noslug', 'n-control', 'n-bidi', 'n-zero-width', 'n-long']) {
    const body = await refused(id, 400, 'bad-name');
    assert(body.input === 'name' && err(body).length > 10, `${id}: bad-name, naming the input, in words; got ${show(body)}`);
  }
});

test('UN33: fields that aren\'t an object or its text, a name or slug of another, one taken out, a description two ways, too long: bad-fields', async () => {
  for (const id of ['f-text-bad', 'f-text-array', 'f-text-null', 'f-name', 'f-slug', 'f-name-null', 'f-slug-null', 'f-desc-two-ways', 'f-long']) {
    const body = await refused(id, 400, 'bad-fields');
    assert(['fields', 'description'].includes(body.input) && err(body).length > 10, `${id}: bad-fields, naming the input, in words; got ${show(body).slice(0, 300)}`);
  }
  needDecl();
  const arr = (await ref()).a.req('f-array');
  assert(arr.status === 400 && ['invalid-input', 'bad-fields'].includes(arr.body.code) && arr.body.input === 'fields', `a list is neither an object nor its text; got ${arr.status} ${show(arr.body)}`);
  assert(/1,?000,?000|million/.test(err(await refused('f-long', 400, 'bad-fields'))), 'the length refusal says the limit');
});

test('UN34: a call that names nothing to change is refused nothing-to-change', async () => {
  for (const id of ['nothing', 'nothing-but-concept']) await refused(id, 400, 'nothing-to-change');
});

test('UN35: inputs are checked: missing, the wrong type, unknown', async () => {
  needDecl();
  const { a } = await ref();
  for (const [id, code] of [['i-missing', 'missing-input'], ['i-type', 'invalid-input'], ['i-unknown', 'unknown-input']]) {
    const x = a.req(id);
    assert(x.status === 400 && x.body.code === code, `${id}: 400 ${code}; got ${x.status} ${show(x.body)}`);
  }
});

test('UN36: a visitor gets 401, a stranger 403, a text/plain body 415; the command\'s refusal is the route\'s', async () => {
  needDecl();
  const { a } = await ref();
  const [v, s, t] = ['visitor', 'stranger', 'text'].map((id) => a.req(id));
  assert(v.status === 401 && s.status === 403 && t.status === 415, `401, 403 and 415; got ${v.status} ${s.status} ${t.status}`);
  const c = a.cmd('cli-refused');
  assert(c.code === 1, `a refused command exits 1; got ${c.code} ${c.stdout} ${c.stderr}`);
  const rb = JSON.parse(c.stdout);
  const route = a.req('desc-out').body;
  assert(rb.code === route.code && rb.error === route.error && rb.rule === route.rule, `the command's refusal is the route's; command ${show(rb)}, route ${show(route)}`);
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing in the refusal run signed or read a key; the spy saw ${show(a.spy)}`);
});

test('UN37: the refusal run changed nothing and recorded nothing', async () => {
  await refused('desc-out', 400, 'invalid-fields');
  const { file, before } = await ref();
  const after = S.readState(file);
  assert(entriesNow(after) === entriesNow(before), `no change entry was recorded; ${entriesNow(before)} before, ${entriesNow(after)} after`);
  assert(show(after.nodes) === show(before.nodes) && show(after.rels) === show(before.rels), 'and the graph is as it was: every refusal comes before anything is written (Decision 2)');
});

test('UN38: with no assistant key it is refused not-installed, and nothing changes', async () => {
  needDecl();
  const { file, k } = await fresh();
  const before = S.readState(file);
  const { a } = runOn(file, [post('ni', 'owner', { node: k.lucky, fields: { description: 'keyless' } })], {
    env: (dir) => { const env = S.childEnv(dir); delete env.TA_PUBKEY; return env; },
  });
  const x = a.req('ni');
  assert(x.status === 409 && x.body.code === 'not-installed', `with no assistant key, 409 not-installed (Decision 2); got ${x.status} ${show(x.body)}`);
  const after = S.readState(file);
  assert(show(after.nodes) === show(before.nodes), 'and nothing changes');
});

test('UN39: a write whose entry can\'t be recorded keeps nothing', async () => {
  needDecl();
  const { file, k } = await fresh((s) => { s.failures = { entry: true }; });
  const before = S.readState(file);
  const { a } = runOn(file, [post('fail', 'owner', { node: k.lucky, fields: { description: 'doomed' } })]);
  const x = a.req('fail');
  assert(x.status === 500, `the write fails; got ${x.status} ${show(x.body)}`);
  const after = S.readState(file);
  assert(show(after.nodes) === show(before.nodes) && show(after.rels) === show(before.rels), 'and keeps none of its change (ADR 0004 Decision 3)');
});

// ── the marks (AC7), over test/helpers/fieldGraph.js ──
test('UN40: a changed marked field follows onto the node, and a field taken out takes its copy with it', async () => {
  needDecl();
  const seed = FG.seedFields({ marks: [['dog', 'breed'], ['dog', 'age'], ['dog', 'owner']] });
  const k = seed.keys;
  const file = seed.file(tmp('update-node-marks-'));
  const { a } = runOn(file, [
    post('breed', 'owner', { node: k.rover, fields: { breed: 'irishSetter' } }),
    post('breed-out', 'owner', { node: k.rover, fields: { breed: null } }),
  ]);
  const one = a.req('breed');
  assert(one.status === 200 && one.body.data.outcome === 'updated', `rover's breed changes; got ${one.status} ${show(one.body).slice(0, 400)}`);
  const d1 = one.body.data;
  assert(show(propsOf(d1.copies)) === show(['dog_age', 'dog_breed']), `the answer gives the node properties rover now carries for dog's marks (Decision 14); got ${show(d1.copies)}`);
  assert(changeOf(d1, 'copies-set').some((c) => c.property === 'dog_breed' && show(c.nodes) === show([k.rover])), `its entry records dog_breed's copy, as the field mapping's writes do; got ${show(d1.change)}`);
  assert((d1.skipped || []).some((s) => s.field === 'owner' && s.node === k.rover), `the owner, an object no Neo4j property can hold, is skipped; got ${show(d1.skipped)}`);
  const two = a.req('breed-out');
  assert(two.status === 200 && two.body.data.outcome === 'updated', `rover's breed is taken out; got ${two.status} ${show(two.body).slice(0, 400)}`);
  const d2 = two.body.data;
  assert(changeOf(d2, 'copies-removed').some((c) => c.property === 'dog_breed' && show(c.nodes) === show([k.rover])), `taking the field out removes its copy, and the entry records it; got ${show(d2.change)}`);
  const n = C.node(S.readState(file), k.rover);
  assert(!('dog_breed' in n.props) && 'dog_age' in n.props, `rover carries dog_age, and no dog_breed; got ${show(n.props)}`);
});

test('UN41: the new and changed modules require nothing that signs, publishes or reads a key', () => {
  const files = ['src/operations/catalog/graph/update-node.js', 'src/operations/catalog/graph/_nodes.js', 'src/operations/catalog/graph/_elements.js', 'src/operations/catalog/graph/_schemas.js'];
  for (const f of files) {
    const abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) throw new Error(`${f} does not exist yet (ADR graph-operations-first-slice/0021 Implementation notes)`);
    const src = fs.readFileSync(abs, 'utf8');
    const bad = (src.match(/require\(\s*['"][^'"]*['"]\s*\)/g) || []).filter((r) => /nostr-tools|normalize\/helpers|secureKeyStorage|child_process|strfry|signing/.test(r));
    assert(bad.length === 0, `${f} must require nothing that signs (ADR 0004 Decision 10); it requires ${show(bad)}`);
  }
});

// ── review round 1's findings 1–3, over a seed of their own ──
let ROUND2 = null;
/** The json tag node of the node keyed `key` in a seed's state. */
const jsonTagOf = (s, key) => {
  const n = s.nodes.find((x) => x.props.tapestryKey === key);
  const r = s.rels.find((x) => x.from === n.eid && x.type === 'HAS_TAG' && s.nodes.find((t) => t.eid === x.to).props.type === 'json');
  return s.nodes.find((t) => t.eid === r.to);
};
function round2() {
  if (ROUND2) return ROUND2;
  ROUND2 = (async () => {
    const { file, k } = await fresh((s, keys) => {
      // gadget's key made __proto__, its schema one that takes any object: twoFaced has no own __proto__ section.
      const h = jsonTagOf(s, keys.gadget);
      const hj = JSON.parse(h.props.value);
      hj.conceptHeader.oKeys = { ...(hj.conceptHeader.oKeys || {}), singular: '__proto__' };
      h.props.value = JSON.stringify(hj);
      const header = s.nodes.find((x) => x.props.tapestryKey === keys.gadget);
      const sr = s.rels.find((r) => r.to === header.eid && r.type === 'IS_THE_JSON_SCHEMA_FOR');
      jsonTagOf(s, s.nodes.find((x) => x.eid === sr.from).props.tapestryKey).props.value = JSON.stringify({ jsonSchema: { type: 'object' } });
      // whiskers, an element of pet alone, given JSON with no pet section.
      const w = jsonTagOf(s, keys.whiskers);
      const wj = JSON.parse(w.props.value);
      delete wj.pet;
      w.props.value = JSON.stringify(wj);
    });
    const before = S.readState(file);
    const { a } = runOn(file, [
      post('proto-key', 'owner', { node: k.twoFaced, concept: k.gadget, fields: { weight: 3 } }),
      post('desc-spaces', 'owner', { node: k.lucky, description: ' same, with spaces ', fields: { description: ' same, with spaces ' } }),
      post('desc-no-section', 'owner', { node: k.whiskers, description: 'a cat' }),
      post('desc-fields-alone', 'owner', { node: k.oddSlug, fields: { description: ' kept as given ' } }),
    ]);
    return { a, k, file, before };
  })();
  return ROUND2;
}

test('UN42: a concept keyed __proto__ whose section the node lacks is refused no-section; nothing is recorded or changed', async () => {
  needDecl();
  const { a, k, file, before } = await round2();
  const x = a.req('proto-key');
  assert(x.status === 409 && x.body.code === 'no-section' && x.body.input === 'concept', `the section is read by the JSON's own key, so an inherited __proto__ is no section (Decision 6, Amendment 2; review round 1, finding 1); got ${x.status} ${show(x.body).slice(0, 400)}`);
  const after = S.readState(file);
  // The run's other calls record entries of their own (UN43's is a change): count those that name twoFaced.
  const naming = (g) => g.nodes.filter((n) => n.labels.includes('GraphChange') && Array.isArray(n.props.keys) && n.props.keys.includes(k.twoFaced)).length;
  assert(naming(after) === 0 && naming(before) === 0, `no change entry names twoFaced; ${naming(before)} before, ${naming(after)} after`);
  assert(show(C.json(after, k.twoFaced)) === show(C.json(before, k.twoFaced)), 'and twoFaced\'s JSON is as it was');
});

test('UN43: the same description given both ways, with white space around it, is one change, trimmed', async () => {
  needDecl();
  const { a, k, file } = await round2();
  const x = a.req('desc-spaces');
  assert(x.status === 200 && x.body.data.outcome === 'updated' && show(x.body.data.changed) === show(['fields.description']), `description and fields.description, alike once trimmed, are one change (Decision 1; review round 1, finding 2); got ${x.status} ${show(x.body).slice(0, 400)}`);
  assert(sectionOf(S.readState(file), k.lucky, 'beagle').description === 'same, with spaces', `the section takes the description, trimmed; got ${show(sectionOf(S.readState(file), k.lucky, 'beagle'))}`);
});

test('UN44: no-section reached through description alone names the input description', async () => {
  needDecl();
  const { a } = await round2();
  const x = a.req('desc-no-section');
  assert(x.status === 409 && x.body.code === 'no-section' && x.body.input === 'description', `with no fields and no concept given, the refusal names description, the input given (Decision 6; review round 1, finding 3); got ${x.status} ${show(x.body).slice(0, 400)}`);
});

test('UN45: fields.description given alone is a field like any other, kept as given, white space and all', async () => {
  needDecl();
  const { a, k, file } = await round2();
  const x = a.req('desc-fields-alone');
  assert(x.status === 200 && x.body.data.outcome === 'updated' && show(x.body.data.changed) === show(['fields.description']), `a description in fields alone is a change (Decision 8); got ${x.status} ${show(x.body).slice(0, 400)}`);
  const kept = sectionOf(S.readState(file), k.oddSlug, 'beagle').description;
  assert(kept === ' kept as given ', `only the description input is trimmed: fields are kept as given (Amendment 2.2; review round 2, R2-3); got ${show(kept)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
