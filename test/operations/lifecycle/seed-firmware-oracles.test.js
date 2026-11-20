'use strict';
/**
 * The oracles lifecycle seed-firmware's suites compare with: today's routes, run from their source — run by
 * test/operations.test.js. These pass now: they test the oracles (what today's install signs), not the feature.
 *   Story: engineering-team/stories/graph-operations-first-slice/37-seed-firmware.md (AC1: "the graph holds what
 *          today's install makes from the same files")
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0037-seed-firmware.md (Implementation notes: "AC1's
 *          oracles are today's routes run from their source in node:vm")
 *   Plan:  engineering-team/stories/graph-operations-first-slice/37-seed-firmware.test-plan.md
 *
 *   SO1 today's routes over firmware/active sign 459 letters: 41 headers, 287 core nodes, 87 elements, 22 sets and 22
 *       relationship letters, each the assistant's, none refused
 *   SO2 create-concept takes dTag, overwrite and conceptHeaderOverrides as the install passes them
 *   SO3 create-element: rover's address, tags, label and slug, and the superset's HAS_ELEMENT
 *   SO4 create-set: a set's tags, labels and no json; its relationship letter at a random d-tag
 *   SO5 save-schema: each schema's word block and jsonSchema, and the primary properties its fold re-signs
 *   SO6 add-node-as-element (pass 1c) rewrites three concept graphs, and names no concept the manifest lacks; the oracle
 *       keeps each as create-concept made it, the form the target keeps (ADR 0037 Amendment 1, item 2)
 *   SO7 the community references' seed: six headers end with the firmware's pointer b
 *   SO8 todaysGraph: the engine holds today's install's nodes under the uniqueness rules
 */

const path = require('path');
const F = require('../../helpers/seedFirmwareFixtures');
const CC = require('../../helpers/todaysCreateConcept');
const S = require('../../helpers/graphOpsSuite');

const { assert, show, TA } = F;
const { test, run } = S.makeSuite('operations: lifecycle seed-firmware — the oracles (today\'s routes, run from their source)');

const ROVER = 'concepts/dog/elements/rover.json';
const FREE = 'concepts/nostr-relay/sets/free-relays.json';
const letters = async () => [...(await F.oracle()).letters.values()];

test('SO1 [AC1]: today\'s routes over firmware/active sign 459 letters at 459 addresses: 41 headers, 287 core nodes, 87 elements, 22 sets and 22 relationship letters, each the assistant\'s', async () => {
  const o = await F.oracle();
  const all = await letters();
  const by = (r) => all.filter((l) => l.role === r).length;
  assert(o.version === '1.0.0', `firmware/active is 1.0.0; got ${o.version}`);
  assert(o.letters.size === 437 && o.relationshipLetters.length === 22, `437 nodes and 22 relationship letters; got ${o.letters.size} and ${o.relationshipLetters.length}`);
  assert(by('conceptHeader') === 41 && by('element') === 87 && by('set') === 22, `41 headers, 87 elements, 22 sets; got ${by('conceptHeader')}, ${by('element')}, ${by('set')}`);
  for (const r of ['superset', 'jsonSchema', 'primaryProperty', 'properties', 'propertyTreeGraph', 'conceptGraph', 'coreNodesGraph']) assert(by(r) === 41, `41 ${r} nodes; got ${by(r)}`);
  assert(all.every((l) => l.address.split(':')[1] === TA), 'every address is the assistant\'s');
  assert(all.filter((l) => l.kind === 39998).length === 41, 'the headers are kind 39998, the rest 39999');
  assert(o.refusedElements.length === 0, `today's create-element refuses none of firmware/active's elements; got ${show(o.refusedElements)}`);
});

test('SO2 [AC1, ADR Implementation notes]: create-concept takes dTag, overwrite and conceptHeaderOverrides as the install passes them', async () => {
  const ch = F.readFirmwareJson(F.ACTIVE, 'concepts/tagging-with-specific-tag/concept-header.json').conceptHeader;
  const r = await CC.todaysConcept({ name: ch.oNames.singular, plural: ch.oNames.plural, description: ch.description, dTag: 'tagging-with-specific-tag', overwrite: true, conceptHeaderOverrides: ch, ta: TA });
  const header = r.events.find((e) => e.kind === 39998);
  assert(header.uuid === `39998:${TA}:tagging-with-specific-tag` && header.tags[0][1] === 'tagging-with-specific-tag', `the header's d is the dTag; got ${header.uuid}`);
  const json = JSON.parse(header.tags.find((t) => t[0] === 'json')[1]);
  assert(json.conceptHeader['x-tapestry'] && !('headerTags' in json.conceptHeader), `the overrides go into the conceptHeader block, headerTags left out; got ${show(Object.keys(json.conceptHeader))}`);
  const types = header.tags.map((t) => t[0]);
  assert(types.indexOf('recommended') > types.indexOf('description') && types.includes('allowed'), `headerTags follow the description tag as literal tags; got ${show(types)}`);
  const plain = await CC.todaysConcept({ name: 'gizmo', ta: TA });
  assert(plain.events.find((e) => e.kind === 39998).uuid === `39998:${TA}:gizmo`, 'without dTag the header keeps its name\'s d-tag (story 16\'s oracle is unchanged)');
});

test('SO3 [AC1]: create-element: rover at childDTag(Rover, dog\'s header), tags d, name, z and json, ListItem, its slug, and HAS_ELEMENT from dog\'s superset', async () => {
  const o = await F.oracle();
  const address = o.elementOf(ROVER);
  assert(address === `39999:${TA}:${F.dtag.childDTag('Rover', `39998:${TA}:dog`)}`, `rover's address; got ${address}`);
  const l = o.letters.get(address);
  assert(show(l.tags.map((t) => t[0])) === show(['d', 'name', 'z', 'json']) && l.tags[2][1] === `39998:${TA}:dog`, `its tags; got ${show(l.tags.map((t) => t[0]))}`);
  assert(F.sameJson(l.json, F.readFirmwareJson(F.ACTIVE, ROVER)) && show(l.labels) === show(['ListItem']) && l.slug === 'dog--rover', `its json is its file, ListItem, slug dog--rover; got ${show({ labels: l.labels, slug: l.slug })}`);
  assert(o.edges.some((e) => e.from === o.supersetOf('dog') && e.type === 'HAS_ELEMENT' && e.to === address), 'dog\'s superset HAS_ELEMENT rover');
});

test('SO4 [AC1]: create-set: a set\'s tags are d, name, z (set), s (its parent) and description, ListItem and Set, no json; its relationship letter is at a random d-tag', async () => {
  const o = await F.oracle();
  const address = o.setOf(FREE);
  const l = o.letters.get(address);
  assert(address === `39999:${TA}:the-set-of-free-nostr-relays`, `the set is at its word.slug; got ${address}`);
  assert(show(l.tags.map((t) => t[0])) === show(['d', 'name', 'z', 's', 'description']) && l.json === null && show(l.labels) === show(['ListItem', 'Set']), `its tags and labels; got ${show(l.tags)} ${show(l.labels)}`);
  const letter = o.relationshipLetters.find((r) => r.nodeTo === address);
  assert(letter && letter.nodeFrom === o.supersetOf('nostr-relay') && letter.relationshipType === 'IS_A_SUPERSET_OF' && /^random/.test(letter.address.split(':')[2]), `its relationship letter; got ${show(letter)}`);
});

test('SO5 [AC1, Decision 4 pass 2]: save-schema keeps each schema\'s word block and sets jsonSchema to { $schema, type, …the file\'s }; its fold re-signs 38 primary properties', async () => {
  const all = await letters();
  const o = await F.oracle();
  for (const entry of o.manifest.concepts) {
    const l = all.find((x) => x.role === 'jsonSchema' && x.concept === entry.slug);
    const file = F.readFirmwareJson(F.ACTIVE, path.posix.join(entry.dir.replace(/^\.\//, ''), entry.jsonSchema)).jsonSchema;
    const want = { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', ...file };
    assert(F.sameJson(l.json.jsonSchema, want) && l.json.word && l.json.word.wordTypes.includes('jsonSchema'), `${entry.slug}'s schema is its file's, under 1a's word block`);
  }
  const firstSchema = Math.min(...all.filter((x) => x.role === 'jsonSchema').map((x) => x.created_at));
  const folded = all.filter((x) => x.role === 'primaryProperty' && x.created_at >= firstSchema);
  assert(folded.length === 38, `pass 2's fold (reconcilePrimaryPropertyForConcept) re-signs 38 primary properties; got ${folded.length}`);
});

test('SO6 [AC1]: add-node-as-element (pass 1c) rewrites the concept graphs of node-type, graph-type and validation-tool-type, and does nothing for a concept the manifest lacks', async () => {
  const all = await letters();
  for (const slug of ['node-type', 'graph-type', 'validation-tool-type']) {
    const l = all.find((x) => x.role === 'conceptGraph' && x.concept === slug);
    assert(l.json && !l.json.word && l.json.graph && Array.isArray(l.json.graph.nodes), `${slug}'s concept graph is today's 1c rewrite, with no word block; got ${show(l.json).slice(0, 200)}`);
  }
  const dogBreed = all.find((x) => x.role === 'conceptGraph' && x.concept === 'dog-breed');
  assert(dogBreed.json.word, 'dog-breed\'s existing nodes (irish-setter, golden-retriever) are no concepts of the manifest: its concept graph keeps 1a\'s JSON');
  const o = await F.oracle();
  const kept = [...o.rewrittenBy1c.values()];
  assert(show(kept.map((l) => l.concept).sort()) === show([...F.DEPARTED_GRAPHS].sort()), `the oracle keeps create-concept's form of exactly the three 1c rewrites; got ${show(kept.map((l) => l.concept))}`);
  for (const l of kept) {
    const g = l.json && l.json.graph;
    assert(l.json.word && g && g.nodes.every((n) => typeof n.slug === 'string') && g.imports.length === 2 && g.relationships.length === 1, `${l.concept}'s concept graph as create-concept made it: its word block, slugs, two imports and IS_THE_CONCEPT_FOR; got ${show(l.json).slice(0, 200)}`);
  }
});

test('SO7 [AC1]: the community references\' seed: each of the six headers ends with [b, its headerATag, pointer]', async () => {
  const o = await F.oracle();
  for (const slug of F.COMMUNITY) {
    const l = o.letters.get(o.headerOf(slug));
    const entry = o.manifest.concepts.find((c) => c.slug === slug);
    assert(show(l.tags[l.tags.length - 1]) === show(['b', entry.communityReference.headerATag, 'pointer']), `${slug}'s header ends with its pointer b; got ${show(l.tags[l.tags.length - 1])}`);
  }
  assert((await letters()).filter((l) => l.tags.some((t) => t[0] === 'b')).length === 6, 'no other node has a b');
});

test('SO8: todaysGraph: the engine holds today\'s install\'s 459 nodes, each a NostrEvent with its id, under the uniqueness rules', async () => {
  const s = F.todaysGraph(await F.oracle());
  const firmware = F.live(s).filter((n) => n.labels.includes('NostrEvent') && n.props.id);
  assert(firmware.length === 459, `459 lettered nodes; got ${firmware.length}`);
  const rows = F.cy(s, 'MATCH (h:ConceptHeader) RETURN count(h) AS c');
  assert(rows[0].c === 41, `41 concept headers; got ${show(rows)}`);
  const dupes = F.cy(s, 'MATCH (n:TapestryNode) WITH n.uuid AS u, count(n) AS c WHERE u IS NOT NULL AND c > 1 RETURN u');
  assert(dupes.length === 0, `one node an address; got ${show(dupes).slice(0, 300)}`);
  const head = F.nodesAt(s, `39998:${TA}:nostr-relay`)[0];
  assert(F.tagsOf(s, head).length === 13 && F.tagSet(F.tagsOf(s, head)).size === 7, 'a seeded header carries two tag nodes for each tag but its b (today\'s seed imports beside pass 1a\'s), seven tags as a set');
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
