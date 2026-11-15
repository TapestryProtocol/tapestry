'use strict';
/**
 * graph map-fields — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-foundation/5-field-mapping.md (AC5, AC6 over the fake, AC8)
 *   ADR:   engineering-team/decisions/graph-operations-foundation/0005-field-mapping.md (Decisions 4, 8, 10–14)
 *
 * Stack-free, as mark-field's suite is. The seed (test/helpers/fieldGraph.js) has dog's breed and age marked, and
 * widget's color, pet's name, cat's color and otherDog's color (another author's dog, the same key) too. The copies
 * stand as today's routes and the nostr import leave them, which apply no mapping (D15):
 *   rover   right, plus dog_retired: a copy no mark yields (its field left the schema, and the unhook took its mark)
 *   spot    dog_breed stale: its JSON now says irishSetter
 *   bella, luna, rex   no copies yet
 *   fido    dog_breed, but its JSON gives no breed any more
 *   max     right as a dog; it joined pet after pet's name was marked, so it has no pet_name
 *   od1     right, and dog_color, which otherDog's mark of color yields
 *   loner   a node of no concept, with dog_breed
 *   w1 and c1 stale, w2 without a copy
 *
 *   MP1  the owner maps dog: each element carries exactly what its marks say: a missing copy added, a stale one
 *        corrected, one whose value is gone removed, and a copy in dog's namespace that no mark yields removed; one
 *        entry with a copies-set and a copies-removed change for each property that changed; set, removed and
 *        unchanged count elements (Amendment 2.3)
 *   MP2  a copy that another same-key concept's mark yields stays, and so do nodes that aren't the concept's elements
 *   MP3  the same call again changes nothing and records nothing: change null
 *   MP4  a wrapped concept is brought in line too, and a node that joined a concept late gets its copy
 *   MP5  flat JSON, with no dog section, loses its stale copy and is listed under skipped (Amendment 2.2)
 *   MP5b an element whose JSON can't be read (its LMDB entry missing, or no json tag) keeps its copy and is listed
 *        under skipped, in a call that changed other elements (Amendment 2.2)
 *   MP6  with no concept for neo4j properties it is refused not-installed, and a stray copy stays
 *   MP7  above 10,000 elements it is refused too-many-elements, and nothing changes
 *   MP8  a concept that names nothing, or isn't a key, is refused
 *   MP9  nothing is signed; a visitor 401, a stranger 403, a text/plain body 415, none changing anything; an admin's
 *        map is the admin's; the command answers as the route, here with nothing to change
 *   MP10 it is listed with its repeatKey and refusals, and has its /docs entry
 *   MP11 after map-fields, a Cypher read by dog_breed follows spot's change (AC6, over the fake)
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const FG = require('../../helpers/fieldGraph');
const G = require('../../helpers/graphFake');

const { ROOT, OWNER, ADMIN, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: graph map-fields');

const ROUTE = '/api/tapestry/graph/map-fields';
const DECL = path.join(ROOT, 'src/operations/catalog/graph/map-fields.js');
const NOBODY = '00000000-0000-4000-8000-0000000000cc';
const int = (n) => ({ $int: String(n) });

function needDecl() {
  if (!fs.existsSync(DECL)) throw new Error('src/operations/catalog/graph/map-fields.js does not exist yet (ADR graph-operations-foundation/0005 Decision 8)');
}
const post = (id, caller, body, extra = {}) => ({ id, method: 'POST', url: ROUTE, caller, body, ...extra });
const sameSet = (a, b) => show([...a].sort()) === show([...b].sort());

const SEED = {
  marks: [['dog', 'breed'], ['dog', 'age'], ['widget', 'color'], ['pet', 'name'], ['cat', 'color'], ['otherDog', 'color']],
  copies: {
    rover: { dog_breed: 'goldenRetriever', dog_age: int(3), dog_retired: true },
    spot: { dog_breed: 'goldenRetriever', dog_age: int(5) },
    fido: { dog_breed: 'irishSetter', dog_age: 9007199254740992 },
    max: { dog_breed: 'irishSetter' },
    od1: { dog_breed: 'irishSetter', dog_color: 'grey' },
    w1: { widget_color: 'green' },
    c1: { cat_color: 'white' },
    p1: { pet_name: 'Polly' },
  },
};

function runOver(seedOpts, requests, { cli = [], spy = false, lmdb = false } = {}) {
  const dir = tmp('map-fields-');
  const seed = FG.seedFields(seedOpts);
  if (lmdb) FG.seedLmdb(dir, [[seed.lunaKey, FG.LUNA_JSON]]);
  const file = seed.file(dir);
  const r = S.runHarness({ spy, scenarios: [{ graphFake: { stateFile: file }, requests: requests(seed.keys), cli: typeof cli === 'function' ? cli(seed.keys) : cli }] }, { dir });
  return { r, a: S.answered(r), file, k: seed.keys };
}

let MAIN = null;
function main() {
  if (MAIN) return MAIN;
  MAIN = runOver(SEED, (k) => [
    post('visitor', 'visitor', { concept: k.cat }),
    post('stranger', 'stranger', { concept: k.cat }),
    post('text', 'owner', null, { contentType: 'text/plain', rawBody: JSON.stringify({ concept: k.cat }) }),
    post('mp1', 'owner', { concept: k.dog }),
    post('mp3', 'owner', { concept: k.dog }),
    post('widget', 'owner', { concept: k.widget }),
    post('pet', 'owner', { concept: k.pet }),
    post('unknown', 'owner', { concept: NOBODY }),
    post('not-a-key', 'owner', { concept: 'dog' }),
    post('admin', 'admin', { concept: k.cat }),
    { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' },
  ], {
    spy: true,
    lmdb: true,
    cli: (k) => [{ id: 'cli', argv: ['graph', 'map-fields', '--concept', k.otherDog] }],
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
const changesOf = (d) => (d && d.change && d.change.changes) || [];
const find = (d, change, property) => changesOf(d).find((c) => c.change === change && c.property === property);

test('MP1: the owner maps dog: each element carries exactly what its marks say, and one entry says which nodes changed', () => {
  const { a, k } = main();
  const d = ok(a, 'mp1');
  assert(d.concept === k.dog && sameSet(d.marks || [], ['dog_breed', 'dog_age']), `it answers the concept and its marks' property names; got ${show({ concept: d.concept, marks: d.marks })}`);
  const g = graph();
  const on = (name) => FG.copiesOn(g, k[name], 'dog_');
  const want = {
    rover: { dog_breed: 'goldenRetriever', dog_age: int(3) },
    spot: { dog_breed: 'irishSetter', dog_age: int(5) },
    bella: { dog_breed: 'goldenRetriever', dog_age: 2.5 },
    fido: { dog_age: 9007199254740992 },
    rex: { dog_age: 'three' },
    luna: { dog_breed: 'irishSetter', dog_age: int(4) },
    max: { dog_breed: 'irishSetter' },
    od1: { dog_breed: 'irishSetter', dog_color: 'grey' },
  };
  const canon = (o) => show(Object.keys(o).sort().reduce((x, key) => { x[key] = o[key]; return x; }, {}));
  for (const [name, copies] of Object.entries(want)) assert(canon(on(name)) === canon(copies), `${name} carries exactly ${canon(copies)}; got ${canon(on(name))}`);
  assert(canon(on('flat')) === '{}' && canon(on('ghost')) === '{}', 'flat (no dog section) and ghost (its LMDB entry missing) carry nothing');
  const set = (p) => (find(d, 'copies-set', p) || {}).nodes;
  const removed = (p) => (find(d, 'copies-removed', p) || {}).nodes;
  assert(sameSet(set('dog_breed') || [], [k.spot, k.bella, k.luna]), `copies-set for dog_breed: spot corrected, bella and luna added; got ${show(find(d, 'copies-set', 'dog_breed'))}`);
  assert(sameSet(set('dog_age') || [], [k.bella, k.rex, k.luna]), `copies-set for dog_age: bella, rex and luna added; got ${show(find(d, 'copies-set', 'dog_age'))}`);
  assert(sameSet(removed('dog_breed') || [], [k.fido]), `copies-removed for dog_breed: fido, whose JSON gives no breed now; got ${show(find(d, 'copies-removed', 'dog_breed'))}`);
  assert(sameSet(removed('dog_retired') || [], [k.rover]), `copies-removed for dog_retired: rover's copy, which no mark yields (Decision 8); got ${show(find(d, 'copies-removed', 'dog_retired'))}`);
  assert(changesOf(d).length === 4 && changesOf(d).every((c) => c.count === c.nodes.length), `four changes, each counting its nodes, and no others; got ${show(changesOf(d))}`);
  // Amendment 2.3: counts of elements. set: spot, bella, luna and rex got a copy added or corrected; removed: fido and
  // rover lost one; unchanged: max, od1, flat and ghost, which it wrote nothing to, the skipped ones included.
  assert(d.set === 4 && d.removed === 2 && d.unchanged === 4, `set 4, removed 2, unchanged 4 (counts of elements, Amendment 2.3); got ${show({ set: d.set, removed: d.removed, unchanged: d.unchanged })}`);
  assert(sameSet([...new Set((d.skipped || []).map((x) => x.node))], [k.rex, k.flat, k.ghost]), `skipped: rex (its breed is an object), flat and ghost; got ${show(d.skipped)}`);
  const c = d.change;
  assert(c && show(c.by) === show({ role: 'owner', pubkey: OWNER }) && c.operation === 'graph map-fields', `the entry is the owner's, through graph map-fields; got ${show(c)}`);
  const entries = S.entriesOf(g).filter((e) => e.operation === 'graph map-fields' && (e.keys || []).includes(k.spot));
  const changed = [k.spot, k.bella, k.luna, k.rex, k.fido, k.rover];
  assert(entries.length === 1 && changed.every((key) => entries[0].keys.includes(key)) && entries[0].keys.every((key) => changed.includes(key) || key === k.dog),
    `one entry, keyed by every node that changed (and, if its changes name it, the concept): Decision 12; got ${show(entries.map((e) => e.keys))}`);
});

test('MP2: a copy another same-key concept\'s mark yields stays, and so do copies on nodes that aren\'t dog\'s elements', () => {
  const { a, k } = main();
  assert(ok(a, 'mp1').concept === k.dog, 'dog was mapped');
  const g = graph();
  assert(FG.copiesOn(g, k.od1, 'dog_').dog_color === 'grey', 'od1 keeps dog_color: otherDog\'s mark of color yields it, so it is no stray ("no mark anywhere")');
  assert(FG.copiesOn(g, k.loner, 'dog_').dog_breed === 'goldenRetriever', 'loner, no element of dog, keeps its dog_breed');
  assert(!Object.keys(FG.copiesOn(g, k.stray, 'dog_')).length, 'the unwired implicit member gets nothing');
});

test('MP3: the same call again changes nothing and records nothing: change null', () => {
  const { a } = main();
  const d = ok(a, 'mp3');
  assert(d.change === null, `everything is in line, so nothing is recorded; got ${show(d.change)}`);
  assert(S.entriesOf(graph()).filter((e) => e.operation === 'graph map-fields' && (e.keys || []).includes(main().k.spot)).length === 1, 'still one entry for dog');
});

test('MP4: a wrapped concept is brought in line, and a node that joined a concept after its field was marked gets its copy', () => {
  const { a, k } = main();
  const w = ok(a, 'widget');
  const g = graph();
  assert(FG.copiesOn(g, k.w1, 'widget_').widget_color === 'red' && FG.copiesOn(g, k.w2, 'widget_').widget_color === 'blue', 'w1 corrected to red, w2 given blue');
  assert(sameSet((find(w, 'copies-set', 'widget_color') || {}).nodes || [], [k.w1, k.w2]), `its entry names both; got ${show(changesOf(w))}`);
  assert(w.set === 2 && w.removed === 0 && w.unchanged === 0, `widget: set 2 (w1 corrected, w2 added), removed 0, unchanged 0; got ${show({ set: w.set, removed: w.removed, unchanged: w.unchanged })}`);
  const p = ok(a, 'pet');
  assert(FG.copiesOn(g, k.max, 'pet_').pet_name === 'Maxie' && sameSet((find(p, 'copies-set', 'pet_name') || {}).nodes || [], [k.max]), `max, which joined pet late, gets pet_name; p1 was right already; got ${show(changesOf(p))}`);
  assert(p.set === 1 && p.removed === 0 && p.unchanged === 1, `pet: set 1 (max), removed 0, unchanged 1 (p1); got ${show({ set: p.set, removed: p.removed, unchanged: p.unchanged })}`);
});

/**
 * Amendment 2.2's run: dog's breed marked, and stale copies on three elements it skips: flat (no dog section), ghost
 * (its LMDB entry missing) and mute (no json tag). Luna's entry is stored, so its JSON reads.
 */
let SKIP = null;
function skipRun() {
  if (SKIP) return SKIP;
  SKIP = runOver({ marks: [['dog', 'breed']], jsonless: true, copies: { flat: { dog_breed: 'goldenRetriever' }, ghost: { dog_breed: 'irishSetter' }, mute: { dog_breed: 'goldenRetriever' } } },
    (k) => [post('x', 'owner', { concept: k.dog })], { lmdb: true });
  return SKIP;
}

test('MP5: flat JSON, with no dog section, loses its stale copy and is listed under skipped (Amendment 2.2)', () => {
  needDecl();
  const r = skipRun();
  const d = ok(r.a, 'x');
  assert((d.skipped || []).some((s) => s.node === r.k.flat), `flat is listed under skipped; got ${show(d.skipped)}`);
  assert(!('dog_breed' in FG.copiesOn(S.readState(r.file), r.k.flat, 'dog_')), 'flat\'s stale copy is removed: JSON with no dog section gives no property, which removes a copy (Amendment 2.2)');
  assert(sameSet((find(d, 'copies-removed', 'dog_breed') || {}).nodes || [], [r.k.flat]), `the entry's copies-removed for dog_breed names flat, and only flat; got ${show(changesOf(d))}`);
});

test('MP5b: an element whose JSON can\'t be read (an LMDB entry missing, or no json tag) keeps its copy and is skipped, in a call that changed others', () => {
  needDecl();
  const r = skipRun();
  const d = ok(r.a, 'x');
  const g = S.readState(r.file);
  const set = find(d, 'copies-set', 'dog_breed');
  assert(set && set.nodes.includes(r.k.rover) && FG.copiesOn(g, r.k.rover, 'dog_').dog_breed === 'goldenRetriever',
    `map-fields ran: in the same call it gave rover its dog_breed; got ${show(changesOf(d))}`);
  for (const [name, value, why] of [['ghost', 'irishSetter', 'its LMDB entry is missing'], ['mute', 'goldenRetriever', 'it has no json tag']]) {
    assert(FG.copiesOn(g, r.k[name], 'dog_').dog_breed === value, `${name}, whose JSON can't be read (${why}), keeps its dog_breed (Amendment 2.2, BIBLE §30); got ${show(FG.copiesOn(g, r.k[name], 'dog_'))}`);
    assert((d.skipped || []).some((s) => s.node === r.k[name]), `${name} is listed under skipped; got ${show(d.skipped)}`);
    assert(!JSON.stringify(changesOf(d)).includes(r.k[name]), `no change in the entry names ${name}`);
  }
  assert(d.set === 6 && d.removed === 1 && d.unchanged === 4, `set 6 (rover, spot, bella, luna, max, od1), removed 1 (flat), unchanged 4 (fido, rex, ghost, mute: skipped ones included, Amendment 2.3); got ${show({ set: d.set, removed: d.removed, unchanged: d.unchanged })}`);
});

test('MP6: with no concept for neo4j properties it is refused not-installed, and a stray copy stays', () => {
  needDecl();
  const r = runOver({ noConcept: true, copies: { rover: { dog_breed: 'goldenRetriever', dog_retired: true } } }, (k) => [post('x', 'owner', { concept: k.dog })]);
  const x = r.a.req('x');
  assert(x.status === 409 && x.body.code === 'not-installed', `409 not-installed; got ${x.status} ${show(x.body)}`);
  assert(/firmware/i.test(x.body.error) && /install/i.test(x.body.error), `it says to install the firmware first; got ${show(x.body.error)}`);
  const c = FG.copiesOn(S.readState(r.file), r.k.rover, 'dog_');
  assert(c.dog_breed === 'goldenRetriever' && c.dog_retired === true, `rover's copies are untouched: with no concept, every copy would look like a stray; got ${show(c)}`);
});

test('MP7: above 10,000 elements it is refused too-many-elements, and nothing changes', () => {
  needDecl();
  const r = runOver({ bigCount: 10001, marks: [['big', 'label']] }, (k) => [post('x', 'owner', { concept: k.big })]);
  const x = r.a.req('x');
  assert(x.status === 409 && x.body.code === 'too-many-elements' && /10,?00[01]/.test(String(x.body.error)), `409 too-many-elements, naming the count; got ${x.status} ${show(x.body).slice(0, 300)}`);
  const g = S.readState(r.file);
  assert(r.k.bigElements.every((key) => !('big_label' in FG.nodeOf(g, key).props)) && S.entriesOf(g).length === 0, 'no copy was made and no entry recorded');
});

test('MP8: a concept that names nothing is refused unknown-concept; one that isn\'t a tapestryKey, invalid-input', () => {
  needDecl();
  const { a } = main();
  const u = a.req('unknown');
  assert(u.status === 404 && u.body.code === 'unknown-concept' && String(u.body.error).includes(NOBODY), `404 unknown-concept, naming the key; got ${u.status} ${show(u.body)}`);
  const i = a.req('not-a-key');
  assert(i.status === 400 && i.body.code === 'invalid-input' && i.body.input === 'concept', `400 invalid-input; got ${i.status} ${show(i.body)}`);
});

test('MP9: nothing is signed; a visitor 401, a stranger 403, text/plain 415, none changing anything; an admin\'s is the admin\'s; the command', () => {
  needDecl();
  const { a, k } = main();
  assert(ok(a, 'mp1').change, 'the path under test ran (MP1 recorded an entry)');
  assert(Array.isArray(a.spy) && a.spy.length === 0, `nothing signs, publishes or reads a key; the spy saw: ${show(a.spy)}`);
  assert(a.req('visitor').status === 401 && a.req('stranger').status === 403 && a.req('text').status === 415, `401, 403, 415; got ${a.req('visitor').status}, ${a.req('stranger').status}, ${a.req('text').status}`);
  const ad = ok(a, 'admin');
  assert(show(ad.change && ad.change.by) === show({ role: 'admin', pubkey: ADMIN }) && sameSet((find(ad, 'copies-set', 'cat_color') || {}).nodes || [], [k.c1]),
    `the admin's map corrected c1, recorded as the admin's (so the three before it hadn't); got ${show(ad.change)}`);
  assert(FG.copiesOn(graph(), k.c1, 'cat_').cat_color === 'black', 'c1 carries black');
  const c = a.cmd('cli');
  assert(c.code === 0, `the command exits 0; got ${c.code} ${c.stdout} ${c.stderr}`);
  const body = JSON.parse(c.stdout);
  assert(body.success === true && body.data.concept === k.otherDog && body.data.change === null, `the command answers as the route; otherDog needed nothing, so change is null; got ${show(body)}`);
  assert(body.data.set === 0 && body.data.removed === 0 && body.data.unchanged === 1, `set 0, removed 0, unchanged 1 (od1); got ${show(body.data)}`);
});

test('MP10: it is listed with its repeatKey and refusals, and has its /docs entry', () => {
  needDecl();
  const list = main().a.req('list');
  const e = ((list.body.data && list.body.data.operations) || []).find((o) => o.group === 'graph' && o.name === 'map-fields');
  assert(e, `graph map-fields is listed; problems: ${show(list.body.data && list.body.data.problems)}`);
  assert(e.kind === 'write' && e.access === 'owner-and-admins' && show(e.repeatKey) === show(['concept']), `a write for the owner and admins, repeatKey [concept]; got ${show({ kind: e.kind, access: e.access, repeatKey: e.repeatKey })}`);
  const codes = e.refusals.map((x) => `${x.code}:${x.status}`);
  for (const c of ['not-installed:409', 'unknown-concept:404', 'too-many-elements:409', 'wrong-content-type:415', 'sign-in-required:401', 'not-allowed:403']) assert(codes.includes(c), `its refusals include ${c}; got ${show(codes)}`);
  const child = spawnSync(process.execPath, ['-e', `
    const { withOperationDocs } = require(${JSON.stringify(path.join(ROOT, 'src/operations/openapi.js'))});
    const p = withOperationDocs({}).paths[${JSON.stringify(ROUTE)}];
    process.stdout.write('RESULT:' + JSON.stringify(p ? Object.keys(p) : null));
  `], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(tmp('map-fields-docs-')) });
  const line = (child.stdout || '').split('RESULT:')[1];
  assert(line && show(JSON.parse(line)) === show(['post']), `/docs has POST ${ROUTE}; got ${line}`);
});

test('MP11: after map-fields, a Cypher read of dog\'s elements by dog_breed follows spot\'s change (AC6, over the fake graph)', () => {
  const { a, k } = main();
  assert(ok(a, 'mp1').concept === k.dog, 'dog was mapped');
  const read = (breed) => G.exec(graph(), `MATCH (h:TapestryNode {tapestryKey: $dog})-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*0..]->()-[:HAS_ELEMENT]->(d)
    WHERE d.dog_breed = $breed RETURN DISTINCT d.tapestryKey AS key`, { dog: k.dog, breed }).rows.map((r) => r.key);
  assert(sameSet(read('irishSetter'), [k.spot, k.luna, k.max, k.od1]), `spot is now found as an irish setter; got ${show(read('irishSetter'))}`);
  assert(sameSet(read('goldenRetriever'), [k.rover, k.bella]), `and not as a golden retriever; got ${show(read('goldenRetriever'))}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
