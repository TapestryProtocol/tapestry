'use strict';
/**
 * graph mark-field — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-foundation/5-field-mapping.md (AC2, AC3, AC6 over the fake, AC8)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0005-field-mapping.md (Decisions 3–7, 10–13, 15)
 *
 * Stack-free: the real catalog, over a graph seeded for test/helpers/graphFake.js by test/helpers/fieldGraph.js (it
 * says what the graph holds), with the harness's spy on everything that signs or reads a key. luna's JSON is an LMDB
 * entry in the run's own store. In the seed, otherDog (another author's dog, the same key) has `name` marked, and spot
 * carries dog_slug, written by hand.
 *
 *   MF1  the owner marks dog's breed: one HAS_ELEMENT from the first set to its tree node, its value copied as dog_breed
 *        onto each current element whose JSON gives one (a subset's, one reached two ways, an LMDB one), none onto the
 *        rest, the skipped listed, and the entry answered and kept with its keys
 *   MF2  the same call again changes nothing, records nothing, and answers already-marked with change: null
 *   MF3  on a repeat, the mark already there, it writes nothing else, even where a copy is stale (Decision 7, step 5)
 *   MF4  a wrapped concept's field (on the primary property) and an imported concept's (a ListHeader only) are marked
 *   MF5  the values table (Decision 10): strings, booleans, an integer as an integer and a number as a float, lists of
 *        them (integers among fractions all as floats: Amendment 2.6), an empty list and a null as nothing, a mixed
 *        list, a list holding a null or an object as skipped, and a value that doesn't match the schema's type copied as
 *        the JSON holds it
 *   MF6  each refusal of AC3, from field-mark-allowed: unknown-concept, unknown-field, no-property-node (no node, only
 *        create-property's, no primary property), not-plain, unusable-name, property-taken, property-in-use; nothing
 *        changes, and each says in words what was wrong
 *   MF7  with no concept for neo4j properties, or no first set, it is refused not-installed
 *   MF8  above 10,000 elements it is refused too-many-elements and nothing changes; at 10,000 it marks
 *   MF9  inputs: a concept that isn't a tapestryKey, a field that isn't a plain name, a missing field
 *   MF10 nothing is signed; a visitor gets 401, a stranger 403, a text/plain body 415, and none changes anything; an
 *        admin's mark is recorded as the admin's
 *   MF11 the command marks one too, recorded as the command's, and its refusal matches the route's
 *   MF12 it is listed with its guard, repeatKey and refusals, and has its /docs entry
 *   MF13 graph history finds the mark's entry by the concept's header, by the property node and by an element
 *   MF14 a Cypher read of dog's elements filters on dog_breed (AC6, over the fake; the live check reads Neo4j)
 *   MF15 the docs: the catalog lists the three operations, and the design records the answer to §5, question 1
 *   MF16 marking a field no element gives a value for records field-marked alone, with no copies-set (Amendment 2.5)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const FG = require('../../helpers/fieldGraph');
const G = require('../../helpers/graphFake');

const { ROOT, OWNER, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph mark-field');

const ROUTE = '/api/tapestry/graph/mark-field';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/mark-field.js');
const RULE = 'field-mark-allowed';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NOBODY = '00000000-0000-4000-8000-0000000000aa';

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/mark-field.js does not exist yet (ADR graph-operations-foundation/0005 Decision 7)');
}
const post = (id, caller, body, extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body, ...extra });
const sameSet = (a, b) => show([...a].sort()) === show([...b].sort());

/** One harness run over a fresh seed; { a, file, k, seed }. */
function runOver(seedOpts, requests, { cli = [], spy = false, lmdb = false } = {}) {
  const dir = tmp('mark-field-');
  const seed = FG.seedFields(seedOpts);
  if (lmdb) FG.seedLmdb(dir, [[seed.lunaKey, FG.LUNA_JSON]]);
  const file = seed.file(dir);
  const r = S.runHarness({ spy, scenarios: [{ graphFake: { stateFile: file }, requests: typeof requests === 'function' ? requests(seed.keys) : requests, cli: typeof cli === 'function' ? cli(seed.keys) : cli }] }, { dir });
  return { r, a: S.answered(r), file, k: seed.keys, seed };
}

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = runOver({ marks: [['otherDog', 'name']], copies: { spot: { dog_slug: 'written-by-hand' } } }, (k) => [
    // Callers and bodies that must change nothing, first, while nothing is marked.
    post('visitor', 'visitor', { concept: k.cat, field: 'size' }),
    post('stranger', 'stranger', { concept: k.cat, field: 'size' }),
    post('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ concept: k.widget, field: 'shape' }) }),
    post('mf1', 'owner', { concept: k.dog, field: 'breed' }),
    { id: 'h-concept', method: 'GET', url: `/api/tapestry/graph/history?node=${k.dog}&limit=5`, caller: 'owner' },
    { id: 'h-property', method: 'GET', url: `/api/tapestry/graph/history?node=${k.dogProp.breed}&limit=5`, caller: 'owner' },
    { id: 'h-element', method: 'GET', url: `/api/tapestry/graph/history?node=${k.rover}&limit=5`, caller: 'owner' },
    post('mf2', 'owner', { concept: k.dog, field: 'breed' }),
    post('wrapped', 'owner', { concept: k.widget, field: 'color' }),
    post('listheader', 'owner', { concept: k.cat, field: 'color' }),
    ...['age', 'weight', 'vaccinated', 'nicknames', 'scores', 'checks', 'color'].map((f) => post(`v-${f}`, 'owner', { concept: k.dog, field: f })),
    post('r-unknown-concept', 'owner', { concept: NOBODY, field: 'breed' }),
    post('r-not-a-header', 'owner', { concept: k.rover, field: 'breed' }),
    post('r-unknown-field', 'owner', { concept: k.dog, field: 'wordTypes' }),
    post('r-no-node', 'owner', { concept: k.dog, field: 'microchip' }),
    post('r-create-property', 'owner', { concept: k.dog, field: 'nickname' }),
    post('r-no-pp', 'owner', { concept: k.rock, field: 'hardness' }),
    post('r-object', 'owner', { concept: k.dog, field: 'owner' }),
    post('r-list-of-objects', 'owner', { concept: k.dog, field: 'toys' }),
    post('r-list-of-lists', 'owner', { concept: k.dog, field: 'grid' }),
    post('r-unusable', 'owner', { concept: k.weird, field: 'color' }),
    post('r-taken', 'owner', { concept: k.dog, field: 'name' }),
    post('r-in-use', 'owner', { concept: k.dog, field: 'slug' }),
    post('i-concept', 'owner', { concept: 'dog', field: 'breed' }),
    post('i-field', 'owner', { concept: k.dog, field: 'dog.breed' }),
    post('i-digit', 'owner', { concept: k.dog, field: '1breed' }),
    post('i-missing', 'owner', { concept: k.dog }),
    post('admin', 'admin', { concept: k.widget, field: 'size' }),
    { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
  ], {
    spy: true,
    lmdb: true,
    cli: (k) => [
      { id: 'cli', argv: ['graph', 'mark-field', '--concept', k.pet, '--field', 'name'] },
      { id: 'cli-refused', argv: ['graph', 'mark-field', '--concept', k.dog, '--field', 'owner'] },
    ],
  });
  return MAIN;
}
const graph = () => S.readState(main().file);
function ok(a, id) {
  needDecl();
  const x = a.req(id);
  assert(x.status === 200, `${id} must answer 200; got ${x.status} ${show(x.body)}`);
  return x.body.data;
}
const changeOf = (d, name) => ((d && d.change && d.change.changes) || []).find((c) => c.change === name);
/** What each node carries in a namespace, as stored. */
const carried = (g, keys, prop) => Object.fromEntries(keys.map((key) => [key, FG.copiesOn(g, key, prop)[prop]]));

test('MF1: the owner marks dog\'s breed: one mark, its value copied onto each current element whose JSON gives one, the entry kept', () => {
  const { a, k } = main();
  const d = ok(a, 'mf1');
  assert(d.outcome === 'marked', `outcome marked; got ${show(d)}`);
  assert(d.mark && d.mark.concept === k.dog && d.mark.field === 'breed' && d.mark.property === 'dog_breed' && d.mark.node === k.dogProp.breed,
    `the answer gives the mark: the concept, the field, the property name dog_breed and the tree's breed node (not create-property's); got ${show(d.mark)}`);
  const g = graph();
  assert(FG.edges(g, k.set1, 'HAS_ELEMENT', k.dogProp.breed) === 1, 'one HAS_ELEMENT from the first set to breed\'s node (Decision 3)');
  assert(FG.edges(g, k.set2, 'HAS_ELEMENT', k.dogProp.breed) === 0 && FG.edges(g, k.neo4jPropertySuperset, 'HAS_ELEMENT', k.dogProp.breed) === 0, 'not from the second set or the superset');
  assert(FG.edges(g, k.set1, 'HAS_ELEMENT', k.dogCp.breed) === 0, 'create-property\'s breed node, off the schema node, is not the one marked');
  assert(FG.edges(g, k.propertySuperset, 'HAS_ELEMENT', k.dogProp.breed) === 1, 'the node is still an element of the property concept (D9)');
  const want = { rover: 'goldenRetriever', spot: 'irishSetter', bella: 'goldenRetriever', luna: 'irishSetter', max: 'irishSetter', od1: 'irishSetter' };
  for (const [name, value] of Object.entries(want)) {
    const got = FG.copiesOn(g, k[name], 'dog_').dog_breed;
    assert(got === value, `${name} carries dog_breed = ${value}${name === 'spot' ? ' (an element of a subset)' : name === 'bella' ? ' (reached two ways)' : name === 'luna' ? ' (its JSON an LMDB entry)' : ''}; got ${show(got)}`);
  }
  for (const name of ['fido', 'rex', 'flat', 'ghost', 'stray', 'w1', 'c1', 'p1']) {
    assert(!('dog_breed' in FG.copiesOn(g, k[name], 'dog_')), `${name} carries no dog_breed${name === 'fido' ? ' (its JSON gives no breed)' : name === 'stray' ? ' (an unwired implicit member)' : ''}; got ${show(FG.copiesOn(g, k[name], 'dog_'))}`);
  }
  assert(FG.copiesOn(g, k.loner, 'dog_').dog_breed === 'goldenRetriever', 'a node of no concept keeps what it had');
  assert(d.carried === 6, `carried: the six elements that carry it now; got ${show(d.carried)}`);
  const skipped = (d.skipped || []).map((x) => x.node);
  assert(sameSet(skipped, [k.rex, k.flat, k.ghost]), `skipped: rex (its breed is an object), flat (no dog section) and ghost (its LMDB entry is missing); got ${show(d.skipped)}`);
  assert(d.skipped.every((x) => typeof x.reason === 'string' && x.reason.trim()), `each skipped element has a reason; got ${show(d.skipped)}`);
  const reason = (key) => d.skipped.find((x) => x.node === key).reason;
  assert(reason(k.flat) !== reason(k.ghost), `the reasons say which: no section, or a missing LMDB entry; got ${show(d.skipped)}`);
  const c = d.change;
  assert(c && UUID.test(c.id) && show(c.by) === show({ role: 'owner', pubkey: OWNER }) && c.operation === 'graph mark-field', `the entry is the owner's, through graph mark-field; got ${show(c)}`);
  const fm = changeOf(d, 'field-marked');
  assert(fm && fm.node === k.dogProp.breed && fm.concept === k.dog && fm.field === 'breed' && fm.property === 'dog_breed',
    `a field-marked change names the node, the concept, the field and the property; got ${show(c.changes)}`);
  const set = changeOf(d, 'copies-set');
  const carriers = Object.keys(want).map((n) => k[n]);
  assert(set && set.property === 'dog_breed' && sameSet(set.nodes, carriers) && set.count === 6, `a copies-set change names the property and the six nodes, with their count; got ${show(set)}`);
  assert(c.changes.length === 2, `those two changes and no others; got ${show(c.changes)}`);
  const kept = S.entriesOf(g).filter((e) => e.tapestryKey === c.id);
  assert(kept.length === 1 && kept[0].labels.includes('GraphChange'), 'the entry is kept as a GraphChange node');
  assert(sameSet(kept[0].keys, [k.dogProp.breed, k.dog, ...carriers]), `its keys are the property node, the concept and every node whose copy changed (Decision 12); got ${show(kept[0].keys)}`);
});

test('MF2: the same call again changes nothing, records nothing, and answers already-marked with change: null', () => {
  const { a, k } = main();
  const d = ok(a, 'mf2');
  assert(d.outcome === 'already-marked' && d.change === null, `already-marked, change null; got ${show(d)}`);
  assert(FG.edges(graph(), k.set1, 'HAS_ELEMENT', k.dogProp.breed) === 1, 'still one mark');
  const forBreed = S.entriesOf(graph()).filter((e) => e.operation === 'graph mark-field' && JSON.stringify(e.changes).includes('"dog_breed"'));
  assert(forBreed.length === 1, `one entry for marking breed, not two; got ${forBreed.length}`);
});

test('MF3: on a repeat, with the mark already there, it writes nothing else, even where a copy is stale', () => {
  needDecl();
  const stale = runOver({
    marks: [['dog', 'breed']],
    copies: { rover: { dog_breed: 'goldenRetriever' } },
    json: { rover: { word: { slug: 'dog--rover' }, dog: { ...FG.DOG_ELEMENTS.rover, breed: 'irishSetter' } } },
  }, (k) => [post('again', 'owner', { concept: k.dog, field: 'breed' })]);
  const d = ok(stale.a, 'again');
  assert(d.outcome === 'already-marked' && d.change === null, `already-marked, change null; got ${show(d)}`);
  const g = S.readState(stale.file);
  assert(FG.copiesOn(g, stale.k.rover, 'dog_').dog_breed === 'goldenRetriever', 'rover\'s stale copy is left for map-fields: mark-field wrote nothing else');
  assert(!('dog_breed' in FG.copiesOn(g, stale.k.spot, 'dog_')), 'and no other copy was made');
  assert(S.entriesOf(g).length === 0, 'and no entry was recorded');
});

test('MF4: a wrapped concept\'s field and an imported concept\'s (labelled ListHeader only) are marked too', () => {
  const { a, k } = main();
  const w = ok(a, 'wrapped');
  assert(w.outcome === 'marked' && w.mark.node === k.widgetProp.color && w.mark.property === 'widget_color', `widget's color: its node on the primary property, as widget_color; got ${show(w)}`);
  const g = graph();
  assert(FG.copiesOn(g, k.w1, 'widget_').widget_color === 'red' && FG.copiesOn(g, k.w2, 'widget_').widget_color === 'blue' && w.carried === 2, `w1 and w2 carry it; got ${show([FG.copiesOn(g, k.w1, 'widget_'), FG.copiesOn(g, k.w2, 'widget_'), w.carried])}`);
  const c = ok(a, 'listheader');
  assert(c.outcome === 'marked' && c.mark.property === 'cat_color' && FG.copiesOn(g, k.c1, 'cat_').cat_color === 'black', `cat, brought in by the import: marked, c1 carries cat_color; got ${show(c)}`);
});

test('MF5: the values table: plain values and lists of them copied, integers as integers, nothing for empty or null, the rest skipped', () => {
  const { a, k } = main();
  for (const f of ['age', 'weight', 'vaccinated', 'nicknames', 'scores', 'checks', 'color']) assert(ok(a, `v-${f}`).outcome === 'marked', `${f} is marked`);
  const g = graph();
  const on = (name, prop) => FG.copiesOn(g, k[name], 'dog_')[prop];
  const int = (v, n) => FG.isInt(v) && v.$int === String(n);
  const float = (v, n) => typeof v === 'number' && v === n;
  // A number: as an integer where the schema says integer and it is a safe integer; otherwise a float.
  assert(int(on('rover', 'dog_age'), 3) && int(on('spot', 'dog_age'), 5) && int(on('luna', 'dog_age'), 4), `dog_age 3, 5 and 4 are sent as neo4j.int (integer schema, safe integers); got ${show([on('rover', 'dog_age'), on('spot', 'dog_age'), on('luna', 'dog_age')])}`);
  assert(float(on('bella', 'dog_age'), 2.5), `bella's age 2.5 is not an integer: a float; got ${show(on('bella', 'dog_age'))}`);
  assert(float(on('fido', 'dog_age'), 9007199254740992), `fido's age is no safe integer: a float; got ${show(on('fido', 'dog_age'))}`);
  assert(on('rex', 'dog_age') === 'three', `rex's age is the string "three": copied as the JSON holds it, though the schema says integer; got ${show(on('rex', 'dog_age'))}`);
  assert(float(on('rover', 'dog_weight'), 30.5) && float(on('spot', 'dog_weight'), 30), `dog_weight 30.5 and 30 are floats (number schema), 30 too; got ${show([on('rover', 'dog_weight'), on('spot', 'dog_weight')])}`);
  assert(on('rover', 'dog_vaccinated') === true && on('spot', 'dog_vaccinated') === false, `booleans, false included; got ${show([on('rover', 'dog_vaccinated'), on('spot', 'dog_vaccinated')])}`);
  assert(show(on('rover', 'dog_nicknames')) === show(['Ro', 'Rov']), `a list of strings; got ${show(on('rover', 'dog_nicknames'))}`);
  const scores = on('rover', 'dog_scores');
  assert(Array.isArray(scores) && scores.length === 3 && scores.every((x, i) => int(x, i + 1)), `a list of integers, each sent as neo4j.int; got ${show(scores)}`);
  const bellaScores = on('bella', 'dog_scores');
  assert(Array.isArray(bellaScores) && show(bellaScores) === show([1.5, 2]) && !bellaScores.some(FG.isInt),
    `bella's scores, [1.5, 2] under integer items: every item sent as a float, so the list stays one type (Amendment 2.6); got ${show(bellaScores)}`);
  assert(show(on('rover', 'dog_checks')) === show([true, false]), `a list of booleans; got ${show(on('rover', 'dog_checks'))}`);
  assert(on('rover', 'dog_color') === 'brown', `a field whose type list adds null; got ${show(on('rover', 'dog_color'))}`);
  for (const [name, prop, why] of [['spot', 'dog_scores', 'an empty list'], ['spot', 'dog_color', 'a null'], ['spot', 'dog_nicknames', 'nothing']]) {
    assert(on(name, prop) === undefined, `${name}'s ${prop}: ${why} gives no property; got ${show(on(name, prop))}`);
  }
  const nick = ok(a, 'v-nicknames');
  const skippedNick = (nick.skipped || []).map((x) => x.node);
  for (const [name, why] of [['bella', 'a mixed list'], ['fido', 'a list holding a null'], ['rex', 'a list holding an object']]) {
    assert(on(name, 'dog_nicknames') === undefined && skippedNick.includes(k[name]), `${name}'s nicknames, ${why}: no property, and listed under skipped; got ${show(on(name, 'dog_nicknames'))}, skipped ${show(nick.skipped)}`);
  }
  assert(!skippedNick.includes(k.spot), 'spot, whose JSON gives no nicknames, is not skipped: it just carries none');
});

const MF6 = [
  ['r-unknown-concept', 404, 'unknown-concept', (m) => m.includes(NOBODY), 'the key'],
  ['r-not-a-header', 404, 'unknown-concept', (m, k) => m.includes(k.rover), 'the key'],
  ['r-unknown-field', 404, 'unknown-field', (m) => /breed/.test(m) && /slug/.test(m), 'the concept\'s top-level fields'],
  ['r-no-node', 409, 'no-property-node', (m) => /generate-property-tree/.test(m) && /sign/i.test(m), 'to run generate-property-tree first, and that it signs'],
  ['r-create-property', 409, 'no-property-node', (m) => /generate-property-tree/.test(m), 'to run generate-property-tree first'],
  ['r-no-pp', 409, 'no-property-node', (m) => /generate-property-tree/.test(m), 'to run generate-property-tree first'],
  ['r-object', 409, 'not-plain', (m) => /object/i.test(m), 'what the field holds'],
  ['r-list-of-objects', 409, 'not-plain', (m) => /object/i.test(m), 'what the field holds'],
  ['r-list-of-lists', 409, 'not-plain', (m) => /array|list/i.test(m), 'what the field holds'],
  ['r-unusable', 409, 'unusable-name', (m) => m.includes('weird-thing'), 'the name'],
  ['r-taken', 409, 'property-taken', (m, k) => m.includes(k.otherDog) || m.includes(`39998:${FG.OTHER}:dog`), 'that concept'],
  ['r-in-use', 409, 'property-in-use', (m, k) => m.includes(k.spot) || m.includes(`39999:${S.TA}:spot`), 'one such node'],
];

test('MF6: each refusal of AC3 comes from field-mark-allowed, says in words what was wrong, and changes nothing', () => {
  needDecl();
  const { a, k } = main();
  for (const [id, status, code, says, what] of MF6) {
    const x = a.req(id);
    assert(x.status === status && x.body.code === code && x.body.rule === RULE, `${id}: ${status} ${code} from ${RULE}; got ${x.status} ${show(x.body)}`);
    assert(says(String(x.body.error), k), `${id}: the refusal names ${what}; got ${show(x.body.error)}`);
  }
  const g = graph();
  const marked = FG.marksIn(g);
  for (const [name, field] of [['dog', 'microchip'], ['dog', 'owner'], ['dog', 'toys'], ['dog', 'grid'], ['weird', 'color'], ['dog', 'name'], ['dog', 'slug']]) {
    const node = k[`${name}Prop`][field];
    if (node) assert(!marked.includes(node), `${name}'s ${field} was not marked`);
  }
  assert(!marked.includes(k.dogCp.nickname), 'create-property\'s nickname node was not marked');
  const elements = ['rover', 'spot', 'bella', 'fido', 'rex', 'luna', 'max', 'od1'].map((n) => k[n]);
  for (const prop of ['dog_microchip', 'dog_owner', 'dog_toys', 'dog_grid', 'dog_name', 'dog_nickname']) {
    assert(elements.every((key) => !(prop in FG.copiesOn(g, key, 'dog_'))), `no element got ${prop}`);
  }
  assert(FG.copiesOn(g, k.spot, 'dog_').dog_slug === 'written-by-hand' && !elements.filter((key) => key !== k.spot).some((key) => 'dog_slug' in FG.copiesOn(g, key, 'dog_')), 'dog_slug is as it was: only spot\'s, by hand');
  assert(!('weird-thing_color' in FG.nodeOf(g, k.wt1).props), 'wt1 got nothing');
  // Quoted, as the changes' JSON holds a name: "dog_nickname" is not "dog_nicknames", which MF5 marks.
  const named = S.entriesOf(g).filter((e) => /"dog_(microchip|owner|toys|grid|name|nickname|slug)"|"weird-thing_color"/.test(JSON.stringify(e.changes)));
  assert(!named.length, `no entry was recorded for any of them; got ${show(named)}`);
});

test('MF7: with no concept for neo4j properties, or no first set, it is refused not-installed, and nothing changes', () => {
  needDecl();
  for (const opts of [{ noConcept: true }, { noFirstSet: true }]) {
    const r = runOver(opts, (k) => [post('x', 'owner', { concept: k.dog, field: 'breed' })]);
    const x = r.a.req('x');
    assert(x.status === 409 && x.body.code === 'not-installed' && x.body.rule === RULE, `${show(opts)}: 409 not-installed from ${RULE}; got ${x.status} ${show(x.body)}`);
    assert(/firmware/i.test(x.body.error) && /install/i.test(x.body.error), `${show(opts)}: it says to install the firmware first; got ${show(x.body.error)}`);
    const g = S.readState(r.file);
    assert(!('dog_breed' in FG.copiesOn(g, r.k.rover, 'dog_')) && S.entriesOf(g).length === 0, `${show(opts)}: nothing was copied or recorded`);
  }
});

test('MF8: above 10,000 elements it is refused too-many-elements and nothing changes; at 10,000 it marks', () => {
  needDecl();
  const over = runOver({ bigCount: 10001 }, (k) => [post('x', 'owner', { concept: k.big, field: 'label' })]);
  const x = over.a.req('x');
  assert(x.status === 409 && x.body.code === 'too-many-elements', `10,001 elements: 409 too-many-elements (Decision 11); got ${x.status} ${show(x.body).slice(0, 300)}`);
  assert(/10,?00[01]/.test(String(x.body.error)), `the refusal names the count it met; got ${show(x.body.error)}`);
  const g = S.readState(over.file);
  assert(!FG.marksIn(g).includes(over.k.bigProp.label), 'no mark was made');
  assert(over.k.bigElements.every((key) => !('big_label' in FG.nodeOf(g, key).props)), 'no copy was made');
  assert(S.entriesOf(g).length === 0, 'no entry was recorded');
  const at = runOver({ bigCount: 10000 }, (k) => [post('y', 'owner', { concept: k.big, field: 'label' })]);
  const d = ok(at.a, 'y');
  assert(d.outcome === 'marked' && d.carried === 10000 && changeOf(d, 'copies-set').count === 10000, `10,000 elements: marked, each carrying big_label; got ${show({ outcome: d.outcome, carried: d.carried })}`);
});

test('MF9: a concept that isn\'t a tapestryKey, a field that isn\'t a plain name, and a missing field are refused', () => {
  needDecl();
  const { a } = main();
  for (const [id, code, input] of [['i-concept', 'invalid-input', 'concept'], ['i-field', 'invalid-input', 'field'], ['i-digit', 'invalid-input', 'field'], ['i-missing', 'missing-input', 'field']]) {
    const x = a.req(id);
    assert(x.status === 400 && x.body.code === code && x.body.input === input, `${id}: 400 ${code} naming ${input} (Decision 7's inputs); got ${x.status} ${show(x.body)}`);
  }
});

test('MF10: nothing is signed; a visitor 401, a stranger 403, a text/plain body 415, none changing anything; an admin\'s is the admin\'s', () => {
  const { a, k } = main();
  assert(ok(a, 'mf1').outcome === 'marked', 'the path under test ran (MF1 marked a field)');
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key (Decision 13); the spy saw: ${show(a.spy)}`);
  const v = a.req('visitor');
  const s = a.req('stranger');
  assert(v.status === 401 && /owner/i.test(String(v.body.error)) && s.status === 403 && /owner/i.test(String(s.body.error)), `a visitor 401, a stranger 403, each told who may call; got ${v.status}, ${s.status}`);
  const t = a.req('text');
  assert(t.status === 415 && t.body.code === 'wrong-content-type', `a text/plain body: 415 wrong-content-type; got ${t.status} ${show(t.body)}`);
  const g = graph();
  assert(!FG.marksIn(g).includes(k.catProp.size) && !('cat_size' in FG.nodeOf(g, k.c1).props), 'cat\'s size was not marked by the visitor or the stranger');
  assert(!FG.marksIn(g).includes(k.widgetProp.shape) && !('widget_shape' in FG.nodeOf(g, k.w1).props), 'widget\'s shape was not marked by the text/plain call');
  const ad = ok(a, 'admin');
  assert(ad.outcome === 'marked' && show(ad.change && ad.change.by) === show({ role: 'admin', pubkey: ADMIN }), `the admin's mark is recorded as the admin's; got ${show(ad)}`);
  assert(FG.isInt(FG.copiesOn(g, k.w1, 'widget_').widget_size), 'w1 carries widget_size, an integer');
});

test('MF11: the command marks one too, recorded as the command\'s, and its refusal matches the route\'s', () => {
  needDecl();
  const { a, k } = main();
  const c = a.cmd('cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.success === true && body.data.outcome === 'marked' && show(body.data.change.by) === show({ role: 'local', pubkey: null }), `the command answers as the route does, recorded as the command's; got ${show(body)}`);
  const g = graph();
  assert(FG.copiesOn(g, k.max, 'pet_').pet_name === 'Maxie' && FG.copiesOn(g, k.p1, 'pet_').pet_name === 'Polly', 'pet\'s elements carry pet_name, max (also a dog) included');
  const refused = a.cmd('cli-refused');
  assert(refused.code === 1, `a refused command exits 1; got ${refused.code}`);
  const rb = JSON.parse(refused.stdout);
  const route = a.req('r-object').body;
  assert(rb.code === route.code && rb.error === route.error && rb.rule === route.rule, `the command's refusal is the route's; command ${show(rb)}, route ${show(route)}`);
});

test('MF12: it is listed for an admin with its guard, repeatKey and refusals, and has its /docs entry', () => {
  needDecl();
  const list = main().a.req('list');
  const e = ((list.body.data && list.body.data.operations) || []).find((o) => o.group === 'graph' && o.name === 'mark-field');
  assert(e, `graph mark-field is listed for an admin; problems: ${show(list.body.data && list.body.data.problems)}`);
  assert(e.kind === 'write' && e.method === 'POST' && e.access === 'owner-and-admins', `a POST write for the owner and admins; got ${show({ kind: e.kind, method: e.method, access: e.access })}`);
  assert(show(e.guards) === show([RULE]) && show(e.repeatKey) === show(['concept', 'field']), `guards [${RULE}], repeatKey [concept, field]; got ${show({ guards: e.guards, repeatKey: e.repeatKey })}`);
  const codes = e.refusals.map((x) => `${x.code}:${x.status}`);
  const want = ['not-installed:409', 'unknown-concept:404', 'unknown-field:404', 'no-property-node:409', 'not-plain:409', 'unusable-name:409', 'property-taken:409', 'property-in-use:409', 'too-many-elements:409', 'wrong-content-type:415', 'invalid-input:400', 'missing-input:400', 'sign-in-required:401', 'not-allowed:403'];
  for (const c of want) assert(codes.includes(c), `its refusals include ${c}; got ${show(codes)}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('mark-field-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line} ${(child.stderr || '').slice(-300)}`);
});

test('MF13: graph history finds the mark\'s entry by the concept\'s header, by the property node and by an element', () => {
  needDecl();
  const { a } = main();
  const id = ok(a, 'mf1').change.id;
  for (const h of ['h-concept', 'h-property', 'h-element']) {
    const x = a.req(h);
    assert(x.status === 200 && x.body.data.entries.length && x.body.data.entries[0].id === id, `${h}: history by that node gives the mark's entry (Decision 12's keys); got ${x.status} ${show(x.body).slice(0, 300)}`);
  }
});

test('MF14: a Cypher read of dog\'s elements filters on dog_breed (AC6, over the fake graph; the live check reads Neo4j)', () => {
  const { a, k } = main();
  assert(ok(a, 'mf1').outcome === 'marked', 'breed was marked');
  const read = (breed) => G.exec(graph(), `MATCH (h:TapestryNode {tapestryKey: $dog})-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*0..]->()-[:HAS_ELEMENT]->(d)
    WHERE d.dog_breed = $breed RETURN DISTINCT d.tapestryKey AS key`, { dog: k.dog, breed }).rows.map((r) => r.key);
  assert(sameSet(read('goldenRetriever'), [k.rover, k.bella]), `the golden retrievers: rover and bella; got ${show(read('goldenRetriever'))}`);
  assert(sameSet(read('irishSetter'), [k.spot, k.luna, k.max, k.od1]), `the irish setters, not the golden retrievers; got ${show(read('irishSetter'))}`);
});

test('MF15: the catalog lists the three operations, and the design records the answer to the first half of §5, question 1', () => {
  needDecl();
  const catalog = fs.readFileSync(path.join(ROOT, 'docs/GRAPH_OPERATIONS_CATALOG.md'), 'utf8');
  const s2 = catalog.slice(catalog.indexOf('## 2.'), catalog.indexOf('## 3.'));
  for (const op of ['mark-field', 'unmark-field', 'map-fields']) assert(s2.includes(`\`${op}\``), `the catalog's §2 has a row for ${op} (Decision 15)`);
  // 62 since story graph-operations-first-slice #19 added unenumerate (ADR graph-operations-first-slice/0019 Implementation notes);
  // 65 since story graph-operations-first-slice #48 added declare-shared, wire-to-shared and defer-sharing (ADR 0048 Decision 10).
  assert(/At a glance \(65 operations\)/.test(catalog), 'the catalog\'s "At a glance" counts 65 operations');
  const glance = catalog.slice(catalog.indexOf('## At a glance'), catalog.indexOf('## 1.'));
  const schemaLine = glance.split('\n').find((l) => /properties and schema/.test(l)) || '';
  assert(['mark-field', 'unmark-field', 'map-fields'].every((op) => schemaLine.includes(op)), `"properties and schema" lists the three; got ${show(schemaLine)}`);
  const addProperty = s2.split('\n').find((l) => l.startsWith('| `add-property`')) || '';
  assert(/mark-field/.test(addProperty), `add-property's "whether elements carry it on the node" points to mark-field; got ${show(addProperty)}`);
  const design = fs.readFileSync(path.join(ROOT, 'docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md'), 'utf8');
  const s5 = design.slice(design.indexOf('## 5.'), design.indexOf('## 6.'));
  const q1 = s5.split(/\n2\. /)[0];
  assert(/0005|mark-field/.test(q1), 'design §5, question 1 records the settled half, pointing to ADR 0005 or mark-field');
  const status = design.split('\n').find((l) => l.startsWith('**Status:**')) || '';
  assert(status.includes('A10.5'), 'the design\'s Status line adds A10.5');
});

test('MF16: marking a field no element gives a value for records field-marked alone, with no copies-set (Amendment 2.5)', () => {
  needDecl();
  const r = runOver({ json: { c1: { cat: { color: 'black' } } } }, (k) => [post('x', 'owner', { concept: k.cat, field: 'size' })]);
  const d = ok(r.a, 'x');
  assert(d.outcome === 'marked' && d.carried === 0, `cat's size, which c1's JSON doesn't give: marked, carried 0; got ${show(d)}`);
  const changes = (d.change && d.change.changes) || [];
  assert(changes.length === 1 && changes[0].change === 'field-marked' && changes[0].node === r.k.catProp.size, `the entry holds field-marked alone; got ${show(changes)}`);
  const g = S.readState(r.file);
  assert(FG.edges(g, r.k.set1, 'HAS_ELEMENT', r.k.catProp.size) === 1 && !('cat_size' in FG.nodeOf(g, r.k.c1).props), 'the mark is made, and c1 carries nothing');
  assert(S.entriesOf(g).some((e) => e.tapestryKey === d.change.id), 'its entry is kept');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
void crypto;
