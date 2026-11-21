'use strict';
/**
 * lifecycle seed-firmware's source: the target the builder makes from the firmware's files — run by
 * test/operations.test.js. In-process and pure: buildTarget({ dir, ta }) reads files and touches nothing.
 *   Story: engineering-team/stories/graph-operations-first-slice/37-seed-firmware.md (AC1, AC2, AC7's unreadable files)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0037-seed-firmware.md (Decisions 2, 3, 4 and 5)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/37-seed-firmware.test-plan.md
 *
 * The oracle is today's install's letters, from today's routes run from their source (test/helpers/
 * todaysFirmwareRoutes.js, whose own suite is seed-firmware-oracles.test.js). The edge passes are pinned against
 * expectations worked out from firmware/active: only the edges whatever order today's install reads its nodes in
 * (its 1e and 3c over the generic concepts depend on that order; the plan says so, and L1 compares the rest live).
 *
 *   ST1  firmware/active: no problems, its manifest's version, as many nodes as its files give (seedFirmwareFixtures.census:
 *        460 on firmware 1.0.0 since story graph-operations-first-slice #47: 41 headers, 287 core nodes, 88 elements, 22
 *        sets, 22 relationship letters), at today's install's addresses (nostr-event-tag's core nodes at
 *        nostr-event-tagging-…)
 *   ST2  each node's tags, as a set, are the tags today's install signs last at its address
 *   ST3  each node's kind and role labels are today's
 *   ST4  each node's JSON, by value, is today's, the primary properties pass 2's fold re-signs included; but the three
 *        concept graphs pass 1c flattens, which keep the form create-concept gave them (ADR 0037 Amendment 1, item 2)
 *   ST5  each node's name is today's, and an element's slug property create-element's
 *   ST6  no node has an `o` tag, which today's routes don't sign
 *   ST7  the headers: conceptHeader as handleCreateConcept merges its file's overrides; headerTags as literal tags after
 *        the description tag
 *   ST8  pass 2's schemas: each is its file's, under 1a's word block; those pass 3b fills carry no copied value
 *   ST9  the community-reference headers' tags end with the firmware's pointer b, and no other node has a b
 *   ST10 the relationship letters: one for each set, as create-set signs it, matched by nodeFrom, nodeTo and
 *        relationshipType
 *   ST11 relationships, 1a: each concept's eight core edges
 *   ST12 relationships, 1c: the manifest's existing nodes under their category's concept; nothing for a concept the
 *        manifest lacks
 *   ST13 relationships, the manifest's existing sets: an IS_A_SUPERSET_OF between supersets for each
 *   ST14 relationships, 1c¾ and 1e: concept manifests' edges, and the prune of a direct link a longer path reaches
 *   ST15 relationships, 1d and 1d½: the relationship letters under relationship's superset; every header under
 *        concept-header's
 *   ST16 relationships, 1d¾: an ENUMERATES for each of the manifest's enumerations, with sourcePath and destinationPath
 *   ST17 version and source: the digest is the same for the same files and changes when one does; source names its
 *        files; and the same files give the same relationships, the prune running in one fixed order (Amendment 1, item 5)
 *   ST18 the builder reads the folder it's given, fresh: a copy's change is in its target, firmware/active's isn't
 *   ST19 cameFrom: an element's names its file and the file's sha256; a set's its file; a header's a file of its concept
 *   ST20 the builder writes nothing and asks no graph
 *   ST21–ST27 firmware-unreadable: a manifest that doesn't parse; a file it names that isn't there; a file that isn't
 *        JSON; a concept an enumeration names that the manifest doesn't define (target, then enumerating); a relationship
 *        type a concept manifest uses that relationshipTypes lacks; several problems, each named
 *   ST28 graph-rule's elements: an item for each of its element files, as the file says (twelve since story 47)
 *   ST29 installName is exported from _elements.js and gives install's name for an element file
 *   ST30 conceptNodes called as today still gives today's eight nodes with the spec's o tags (its defaults unchanged)
 *   ST31 an existing set naming a concept the manifest doesn't define is skipped: no problem, and nothing made of it
 *        (ADR 0037 Amendment 1, item 4)
 *   ST32 a relationship type whose alias isn't a plain name ([A-Z_][A-Z0-9_]*): a space, a backtick: a problem naming
 *        its file and the alias (Amendment 3, item 5; review round 1, N1)
 *   ST33 the tripwire: install.js's pass functions, and pass 3c's route in src/api/normalize/index.js
 *        (handleWireImplicitElements; review round 2, R2-N3), as this suite last saw them; when one changes, it fails
 *        naming src/firmware/target.js, to be brought in line before the digest is (Amendment 3, item 8; N7). Passes now
 *   ST34 a header file whose word.wordTypes isn't all concept keys' form ([a-z][A-Za-z0-9]*): a key with a space, and a
 *        number: a problem naming the file, as today's create-concept refuses that list (ADR 0047 Decision 9; review
 *        round 4, R4-N1; the refusal is da47c43c's). Passes now
 */

const fs = require('fs');
const path = require('path');
const F = require('../../helpers/seedFirmwareFixtures');
const S = require('../../helpers/graphOpsSuite');

const { assert, show, TA } = F;
const { test, run } = S.makeSuite('operations: lifecycle seed-firmware — the target built from the firmware\'s files');

let ACTIVE_TARGET = null;
/** firmware/active's target, built once. */
const active = async () => { if (!ACTIVE_TARGET) ACTIVE_TARGET = await F.buildTarget(F.ACTIVE, TA); return ACTIVE_TARGET; };
const byAddress = (t) => new Map(F.nodesOf(t).filter((n) => !F.isRelationshipLetter(n)).map((n) => [n.address, n]));
const ROVER = 'concepts/dog/elements/rover.json';
const firstFew = (xs) => show(xs.slice(0, 5)).slice(0, 900);
/**
 * Each node of the target against the letter it should carry: today's install's, but the three concept graphs pass 1c
 * flattens, which keep create-concept's form (F.targetLetters; ADR 0037 Amendment 1, item 2). What `bad(target node,
 * letter)` says differs.
 */
async function eachAgainstToday(bad) {
  const o = await F.oracle();
  const t = byAddress((await active()));
  const wrong = [];
  for (const [address, l] of F.targetLetters(o)) {
    const n = t.get(address);
    if (!n) { wrong.push({ address, missing: true }); continue; }
    const why = bad(n, l);
    if (why) wrong.push({ address, role: l.role, concept: l.concept, ...why });
  }
  return wrong;
}

test('ST1 [AC1, Decisions 2–4]: firmware/active builds with no problems: its manifest\'s version, and as many nodes as its files give (headers, core nodes, elements, sets, relationship letters), at today\'s install\'s addresses', async () => {
  const T = await active();
  const t = T;
  const c = F.census();
  assert(Array.isArray(t.problems) && t.problems.length === 0, `firmware/active is readable: no problems; got ${firstFew(t.problems || ['no problems list'])}`);
  assert(t.version === c.version, `the target's version is the manifest's, ${c.version}; got ${show(t.version)}`);
  const nodes = F.nodesOf(t);
  assert(nodes.length === c.total, `${c.total} nodes (${c.headers} headers, ${c.coreNodes} core nodes, ${c.elements} elements, ${c.sets} sets, ${c.relationshipLetters} relationship letters); got ${nodes.length}`);
  const letters = nodes.filter(F.isRelationshipLetter);
  assert(letters.length === c.relationshipLetters, `${c.relationshipLetters} relationship letters, one for each set; got ${letters.length}`);
  assert(nodes.filter((n) => n.kind === 39998).length === c.headers, `${c.headers} headers of kind 39998; got ${nodes.filter((n) => n.kind === 39998).length}`);
  const o = await F.oracle();
  const mine = new Set([...byAddress(t).keys()]);
  const todays = new Set(o.letters.keys());
  const d = F.setDiff(mine, todays);
  assert(d.onlyFirst.length === 0 && d.onlySecond.length === 0, `the ${c.nodes} addresses are today's install's; only in the target ${firstFew(d.onlyFirst)}; only today's ${firstFew(d.onlySecond)}`);
  assert(mine.has(`39999:${TA}:nostr-event-tagging-superset`) && !mine.has(`39999:${TA}:nostr-event-tag-superset`),
    'nostr-event-tag ("nostr event tagging") has its header at its slug and its core nodes at its name\'s slug, as today\'s create-concept puts them');
  assert(nodes.every((n) => String(n.address).split(':')[1] === TA), 'every node is under the assistant\'s pubkey');
});

test('ST2 [AC1]: each node\'s tags, as a set, are the tags today\'s install signs last at its address', async () => {
  const wrong = await eachAgainstToday((n, l) => {
    const d = F.setDiff(F.tagSet(n.tags), F.tagSet(l.tags));
    return d.onlyFirst.length || d.onlySecond.length ? { onlyTarget: d.onlyFirst.map((x) => x.slice(0, 120)), onlyToday: d.onlySecond.map((x) => x.slice(0, 120)) } : null;
  });
  assert(wrong.length === 0, `${wrong.length} of ${F.census().nodes} nodes' tags differ from today's install's (tags compared as a set); the first: ${firstFew(wrong)}`);
});

test('ST3 [AC1, Decision 4]: each node\'s kind and role labels are today\'s: ListHeader and ConceptHeader, ListItem, Superset, Set, JSONSchema, Property', async () => {
  const T = await active();
  const wrong = await eachAgainstToday((n, l) => (n.kind !== l.kind || show(F.roleLabels(n.labels)) !== show(F.roleLabels(l.labels)) ? { kind: n.kind, labels: n.labels, todays: [l.kind, l.labels] } : null));
  assert(wrong.length === 0, `${wrong.length} nodes' kind or role labels differ from today's; the first: ${firstFew(wrong)}`);
  assert(F.nodesOf(T).every((n) => !(n.labels || []).includes('NostrEvent')), 'no node of the target carries NostrEvent: it has no letter (story fact 7)');
});

test('ST4 [AC1, Amendment 1]: each node\'s JSON, by value, is today\'s, the primary properties pass 2\'s fold re-signs included; null for a set; but node-type\'s, graph-type\'s and validation-tool-type\'s concept graphs keep create-concept\'s form, not 1c\'s flattened one', async () => {
  const wrong = await eachAgainstToday((n, l) => (F.sameJson(n.json === undefined ? null : n.json, l.json) ? null : { target: show(F.parsed(n.json)).slice(0, 160), expected: show(l.json).slice(0, 160) }));
  const folded = wrong.filter((w) => w.role === 'primaryProperty').length;
  const graphs = wrong.filter((w) => w.role === 'conceptGraph').length;
  assert(wrong.length === 0, `${wrong.length} nodes' JSON differs from what the target holds (${folded} primary properties, which pass 2's save-schema re-signs through reconcilePrimaryPropertyForConcept, Amendment 1 item 1; ${graphs} concept graphs, kept as create-concept made them, Amendment 1 item 2); the first: ${firstFew(wrong)}`);
  const o = await F.oracle();
  const t = byAddress(await active());
  for (const slug of F.DEPARTED_GRAPHS) {
    const address = [...o.letters.values()].find((l) => l.role === 'conceptGraph' && l.concept === slug).address;
    const j = F.parsed(t.get(address) && t.get(address).json);
    const g = j && j.graph;
    assert(j && j.word && g && Array.isArray(g.nodes) && g.nodes.length > 0 && g.nodes.every((x) => typeof x.slug === 'string') && Array.isArray(g.imports) && g.imports.length === 2,
      `${slug}'s concept graph keeps its word block, each node's slug and its two imports; got ${show(j).slice(0, 300)}`);
    assert(g.relationships.length === 1 && g.relationships[0].relationshipType.slug === 'IS_THE_CONCEPT_FOR', `and its one relationship, the header's IS_THE_CONCEPT_FOR its superset; got ${show(g.relationships)}`);
    assert(!F.sameJson(j, o.letters.get(address).json), `${slug}'s concept graph is not 1c's flattened { graph: { nodes, relationshipTypes, relationships: [] } }`);
  }
});

test('ST5 [AC1, Decision 4]: each node\'s name is today\'s, and each element has create-element\'s slug property', async () => {
  const T = await active();
  const wrong = await eachAgainstToday((n, l) => (n.name !== l.name || (l.role === 'element' && n.slug !== l.slug) ? { name: n.name, slug: n.slug, todays: [l.name, l.slug] } : null));
  assert(wrong.length === 0, `${wrong.length} nodes' names or slugs differ; the first: ${firstFew(wrong)}`);
  const rover = byAddress(T).get((await F.oracle()).elementOf(ROVER));
  assert(rover && rover.slug === 'dog--rover', `rover's slug property is its word.slug, dog--rover; got ${show(rover && rover.slug)}`);
});

test('ST6 [Decision 4, 1a]: no node has an `o` tag: conceptNodes adds one to each core node, and today\'s route signs none', async () => {
  const T = await active();
  const withO = F.nodesOf(T).filter((n) => (n.tags || []).some((x) => x[0] === 'o'));
  assert(withO.length === 0, `${withO.length} nodes carry an o tag; the first: ${firstFew(withO.map((n) => n.address))}`);
});

test('ST7 [Decision 4, 1a]: each header\'s conceptHeader is merged as handleCreateConcept merges its file\'s overrides, and headerTags become literal tags after the description tag', async () => {
  const T = await active();
  const t = byAddress(T);
  const o = await F.oracle();
  for (const entry of o.manifest.concepts) {
    const h = t.get(`39998:${TA}:${entry.slug}`);
    const ch = F.readFirmwareJson(F.ACTIVE, path.posix.join(entry.dir.replace(/^\.\//, ''), entry.conceptHeader)).conceptHeader;
    const json = F.parsed(h && h.json);
    assert(json && json.conceptHeader, `${entry.slug}'s header has its conceptHeader block`);
    assert(!('headerTags' in json.conceptHeader), `${entry.slug}: headerTags stay out of the JSON`);
    for (const k of Object.keys(ch).filter((x) => !['description', 'oNames', 'oSlugs', 'oKeys', 'oTitles', 'headerTags'].includes(x))) {
      assert(F.sameJson(json.conceptHeader[k], ch[k]), `${entry.slug}: the file's ${k} wins in the header's conceptHeader`);
    }
  }
  const tw = t.get(`39998:${TA}:tagging-with-specific-tag`);
  const types = (tw.tags || []).map((x) => x[0]);
  assert(types.indexOf('recommended') > types.indexOf('description') && types.indexOf('allowed') > types.indexOf('description'), `tagging-with-specific-tag's headerTags follow its description tag; got ${show(types)}`);
});

test('ST8 [AC1, Decisions 4 and 5]: each schema is its file\'s ({ $schema, type: object, …its jsonSchema }) under 1a\'s word block; those pass 3b fills carry no value copied from the graph', async () => {
  const T = await active();
  const t = byAddress(T);
  const o = await F.oracle();
  for (const entry of o.manifest.concepts) {
    const l = [...o.letters.values()].find((x) => x.role === 'jsonSchema' && x.concept === entry.slug);
    const n = t.get(l.address);
    const file = F.readFirmwareJson(F.ACTIVE, path.posix.join(entry.dir.replace(/^\.\//, ''), entry.jsonSchema)).jsonSchema;
    const json = F.parsed(n && n.json);
    assert(json && F.sameJson(json.jsonSchema, { $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', ...file }), `${entry.slug}'s schema is its file's; got ${show(json && json.jsonSchema).slice(0, 200)}`);
    assert(F.sameJson(json.word, l.json.word), `${entry.slug}'s schema keeps 1a's word block, as save-schema keeps it; got ${show(json.word).slice(0, 200)}`);
  }
  for (const slug of F.FIVE) {
    const l = [...o.letters.values()].find((x) => x.role === 'jsonSchema' && x.concept === slug);
    const text = show(F.parsed(t.get(l.address).json));
    assert(!/"allOf"/.test(text) || /"allOf"/.test(show(l.json)), `${slug}'s schema has no allOf conditionals pass 3b would add`);
    assert(F.sameJson(t.get(l.address).json, l.json), `${slug}'s schema is installed as its file says, with no value copied from the graph (Decision 5)`);
  }
});

test('ST9 [AC1, Decision 4]: the community-reference headers\' tags end with [b, the headerATag, pointer]; no other node has a b', async () => {
  const T = await active();
  const t = byAddress(T);
  const o = await F.oracle();
  for (const slug of F.COMMUNITY) {
    const h = t.get(`39998:${TA}:${slug}`);
    const cr = o.manifest.concepts.find((c) => c.slug === slug).communityReference;
    const last = h && h.tags[h.tags.length - 1];
    assert(show(last) === show(['b', cr.headerATag, 'pointer']), `${slug}'s tags end with its pointer b; got ${show(last)}`);
  }
  const others = F.nodesOf(T).filter((n) => !F.COMMUNITY.some((s) => n.address === `39998:${TA}:${s}`) && (n.tags || []).some((x) => x[0] === 'b'));
  assert(others.length === 0, `no other node has a b; got ${firstFew(others.map((n) => n.address))}`);
});

test('ST10 [AC1, Decision 4, 1c½]: a relationship letter for each set, as create-set signs it, matched by nodeFrom, nodeTo and relationshipType; its JSON null', async () => {
  const T = await active();
  const o = await F.oracle();
  const mine = F.nodesOf(T).filter(F.isRelationshipLetter);
  for (const r of o.relationshipLetters) {
    const n = mine.find((x) => F.tagValue(x.tags, 'nodeFrom') === r.nodeFrom && F.tagValue(x.tags, 'nodeTo') === r.nodeTo && F.tagValue(x.tags, 'relationshipType') === r.relationshipType);
    assert(n, `a relationship letter for ${r.nodeFrom} ${r.relationshipType} ${r.nodeTo}`);
    const withoutD = (tags) => new Set([...F.tagSet(tags)].filter((x) => !x.startsWith('["d",')));
    assert(F.sameSet(withoutD(n.tags), withoutD(r.tags)) && n.tags.some((x) => x[0] === 'd'), `its tags, but its random d, are create-set's; got ${show(n.tags)}`);
    assert(n.json === null || n.json === undefined, 'its JSON is null');
  }
});

test('ST11 [AC1, Decision 4, 1a]: each concept\'s eight core edges: IS_THE_CONCEPT_FOR, the six core links to the header, and IS_A_PROPERTY_OF', async () => {
  const T = await active();
  const o = await F.oracle();
  const core = o.edges.filter((e) => !['HAS_ELEMENT', 'IS_A_SUPERSET_OF'].includes(e.type));
  const c = F.census();
  assert(core.length === c.coreEdges, `the oracle has ${c.coreEdges} core edges, eight for each of the ${c.concepts} concepts; got ${core.length}`);
  const missing = core.filter((e) => !F.hasTargetRel(T, e.type, e.from, e.to));
  assert(missing.length === 0, `${missing.length} of the ${c.coreEdges} core edges are missing from the target's relationships; the first: ${firstFew(missing)}`);
});

test('ST12 [AC1, Decision 4, 1c]: the manifest\'s existing nodes under their category\'s concept (node-type, graph-type, validation-tool-type); dog-breed\'s, which the manifest doesn\'t define, make nothing', async () => {
  const T = await active();
  const t = T;
  const o = await F.oracle();
  const sup = (s) => o.supersetOf(s);
  const want = [['node-type', 'word'], ['node-type', 'image'], ['graph-type', 'core-nodes-graph'], ['graph-type', 'concept-graph'], ['graph-type', 'property-tree-graph'], ['graph-type', 'tapestry'],
    ['validation-tool-type', 'json-schema'], ['validation-tool-type', 'image-validation-script']];
  for (const [parent, child] of want) assert(F.hasTargetRel(t, 'HAS_ELEMENT', sup(parent), o.headerOf(child)), `${parent}'s superset HAS_ELEMENT ${child}'s header`);
  const ghosts = F.relsOfTarget(t).map(F.relEnds).filter((r) => [r.from, r.to].some((x) => /:(irish-setter|golden-retriever)$/.test(String(x))));
  assert(ghosts.length === 0, `no relationship names irish-setter or golden-retriever, which the manifest's concepts don't hold; got ${firstFew(ghosts)}`);
});

test('ST13 [AC1, Decision 4, existing sets]: the manifest\'s existing sets, each its parent\'s superset IS_A_SUPERSET_OF its concept\'s superset', async () => {
  const T = await active();
  const t = T;
  const o = await F.oracle();
  const cat = require('../../helpers/todaysFirmwareRoutes').categoryToSlug;
  const want = [];
  for (const [c, d] of Object.entries(o.manifest.sets || {})) for (const e of d['existing-sets'] || []) want.push([cat(c), e.concept]);
  assert(want.length > 0 && want.length === F.census().existingSets, `the manifest names ${F.census().existingSets}; got ${want.length}`);
  const missing = want.filter(([p, c]) => !F.hasTargetRel(t, 'IS_A_SUPERSET_OF', o.supersetOf(p), o.supersetOf(c)));
  assert(missing.length === 0, `missing: ${show(missing)}`);
});

test('ST14 [AC1, Decision 4, 1c¾ and 1e]: concept manifests\' edges, resolved by their files; a direct link a longer path reaches is pruned, one it doesn\'t is kept', async () => {
  const T = await active();
  const t = T;
  const o = await F.oracle();
  const el = (f) => o.elementOf(f);
  const st = (f) => o.setOf(f);
  for (const x of ['integer', 'number']) assert(F.hasTargetRel(t, 'HAS_ELEMENT', st('concepts/json-data-type/sets/numeric-types.json'), el(`concepts/json-data-type/elements/${x}.json`)), `numeric-types HAS_ELEMENT ${x} (json-data-type's manifest)`);
  for (const x of ['initiation', 'propagation', 'termination']) assert(F.hasTargetRel(t, 'HAS_ELEMENT', st('concepts/relationship-type/sets/class-threads.json'), el(`concepts/relationship-type/elements/class-thread-${x}.json`)), `class-threads HAS_ELEMENT class-thread-${x}`);
  assert(F.hasTargetRel(t, 'IS_A_SUPERSET_OF', st('concepts/nostr-relay/sets/organization-by-monetization.json'), st('concepts/nostr-relay/sets/free-relays.json')), 'organization-by-monetization IS_A_SUPERSET_OF free-relays (nostr-relay\'s manifest)');
  assert(F.hasTargetRel(t, 'HAS_ELEMENT', st('concepts/nostr-relay/sets/free-relays.json'), el('concepts/nostr-relay/elements/dcosl-brainstorm-world.json')), 'free-relays HAS_ELEMENT dcosl-brainstorm-world');
  assert(!F.hasTargetRel(t, 'HAS_ELEMENT', o.supersetOf('json-data-type'), el('concepts/json-data-type/elements/integer.json')), '1e prunes json-data-type\'s superset → integer: numeric-types reaches it');
  assert(F.hasTargetRel(t, 'HAS_ELEMENT', o.supersetOf('json-data-type'), el('concepts/json-data-type/elements/string.json')), '1e keeps json-data-type\'s superset → string: no longer path reaches it');
  assert(!F.hasTargetRel(t, 'HAS_ELEMENT', o.supersetOf('relationship-type'), el('concepts/relationship-type/elements/class-thread-initiation.json')), '1e prunes relationship-type\'s superset → class-thread-initiation');
  const nr = F.relsOfTarget(t).map(F.relEnds).filter((r) => r.from === o.supersetOf('nostr-relay'));
  assert(show(nr.filter((r) => r.type === 'IS_A_SUPERSET_OF').map((r) => r.to).sort()) === show([st('concepts/nostr-relay/sets/organization-by-firmware.json'), st('concepts/nostr-relay/sets/organization-by-monetization.json')].sort()),
    `1e leaves nostr-relay's superset IS_A_SUPERSET_OF its two organizing sets alone; got ${firstFew(nr.filter((r) => r.type === 'IS_A_SUPERSET_OF').map((r) => r.to))}`);
  assert(!nr.some((r) => r.type === 'HAS_ELEMENT'), 'and HAS_ELEMENT none of its elements, each in a set');
  assert(F.hasTargetRel(t, 'HAS_ELEMENT', o.supersetOf('dog'), el(ROVER)), 'dog\'s superset HAS_ELEMENT rover (1b; nothing longer reaches it)');
});

test('ST15 [AC1, Decision 4, 1d and 1d½]: relationship\'s superset HAS_ELEMENT each relationship letter (their z); concept-header\'s superset HAS_ELEMENT each header', async () => {
  const T = await active();
  const t = T;
  const o = await F.oracle();
  const letters = F.nodesOf(t).filter(F.isRelationshipLetter);
  const missing = letters.filter((n) => !F.hasTargetRel(t, 'HAS_ELEMENT', o.supersetOf('relationship'), n.address));
  assert(letters.length === F.census().relationshipLetters && missing.length === 0, `relationship's superset HAS_ELEMENT every relationship letter, ${F.census().relationshipLetters}; got ${letters.length}, missing ${missing.length}`);
  const headers = F.nodesOf(t).filter((n) => n.kind === 39998);
  const without = headers.filter((n) => !F.hasTargetRel(t, 'HAS_ELEMENT', o.supersetOf('concept-header'), n.address));
  assert(headers.length === F.census().headers && without.length === 0, `concept-header's superset HAS_ELEMENT every header, ${F.census().headers}; got ${headers.length}, missing ${firstFew(without.map((n) => n.address))}`);
});

test('ST16 [AC1, Decision 4, 1d¾]: an ENUMERATES for each of the manifest\'s enumerations, from the enumerating concept\'s superset to the target\'s schema, with sourcePath and destinationPath', async () => {
  const T = await active();
  const t = T;
  const o = await F.oracle();
  const cat = require('../../helpers/todaysFirmwareRoutes').categoryToSlug;
  const schemaOf = (slug) => [...o.letters.values()].find((l) => l.role === 'jsonSchema' && l.concept === slug).address;
  const all = F.relsOfTarget(t).map(F.relEnds).filter((r) => r.type === 'ENUMERATES');
  assert(F.FIVE.length > 0 && all.length === F.FIVE.length, `${F.FIVE.length} ENUMERATES, one for each enumeration; got ${all.length}`);
  for (const [plural, d] of Object.entries(o.manifest.enumerations)) {
    for (const e of d['existing-nodes']) {
      const r = F.targetRel(t, 'ENUMERATES', o.supersetOf(cat(plural)), schemaOf(e.concept));
      assert(r && r.props.sourcePath === e['source-path'] && r.props.destinationPath === e['destination-path'], `${cat(plural)} ENUMERATES ${e.concept}'s schema with its two paths; got ${show(r)}`);
    }
  }
});

test('ST17 [AC2, AC6, Decision 3]: the source names its files; its digest is the same for the same files (another folder too) and changes when one file does', async () => {
  const T = await active();
  const a = T;
  const again = await F.buildTarget(F.ACTIVE, TA);
  const copy = await F.buildTarget(F.copyFirmware(), TA);
  const changed = await F.buildTarget(F.copyFirmware({ [ROVER]: (j) => ({ ...j, dog: { ...j.dog, breed: 'irishSetter' } }) }), TA);
  const digest = (t) => t && t.source && t.source.digest;
  assert(/[0-9a-f]{64}/.test(String(digest(a))), `source.digest is a sha256; got ${show(a.source)}`);
  assert(digest(a) === digest(again) && digest(a) === digest(copy), `the same files give the same digest, wherever the folder is; got ${digest(a)}, ${digest(again)}, ${digest(copy)}`);
  assert(digest(changed) !== digest(a) && changed.version === a.version, 'a changed file changes the digest though the version stays 1.0.0 (story fact 5)');
  const files = a.source && a.source.files;
  const names = Array.isArray(files) ? files.map((x) => (typeof x === 'string' ? x : x && (x.path || x.address))) : files && typeof files === 'object' ? Object.keys(files) : [];
  assert(names.includes('manifest.json') && names.includes(ROVER), `source.files names the files read, by their path in the folder; got ${firstFew(names)}`);
  assert(a.source.kind === 'files', `source.kind is files; got ${show(a.source.kind)}`);
  const rels = (t) => new Set(F.relsOfTarget(t).map(F.relEnds).map((r) => `${r.from}|${r.type}|${r.to}`));
  const d1 = F.setDiff(rels(a), rels(again));
  const d2 = F.setDiff(rels(a), rels(copy));
  assert(!d1.onlyFirst.length && !d1.onlySecond.length && !d2.onlyFirst.length && !d2.onlySecond.length,
    `the same files give the same relationships, here or in another folder: the prune runs in one fixed order, by address (Amendment 1, item 5); differ ${firstFew([...d1.onlyFirst, ...d1.onlySecond, ...d2.onlyFirst, ...d2.onlySecond])}`);
});

test('ST18 [Decision 3]: the builder reads the folder it\'s given, fresh: a copy\'s changed element is in its target, and firmware/active\'s target is unchanged', async () => {
  const T = await active();
  const before = T;
  const dir = F.copyFirmware({ [ROVER]: (j) => ({ ...j, dog: { ...j.dog, name: 'Rover the Second' } }) });
  const t = await F.buildTarget(dir, TA);
  const address = (await F.oracle()).elementOf(ROVER);
  const n = byAddress(t).get(address);
  assert(n && F.parsed(n.json).dog.name === 'Rover the Second', `the copy's rover holds its changed JSON; got ${show(n && n.json).slice(0, 200)}`);
  const after = await F.buildTarget(F.ACTIVE, TA);
  assert(F.parsed(byAddress(after).get(address).json).dog.name === 'Rover' && F.parsed(byAddress(before).get(address).json).dog.name === 'Rover', 'firmware/active\'s target still holds its own file');
});

test('ST19 [AC2, Decision 6]: cameFrom: an element\'s is { kind: file, address: its file\'s path in the folder, id: the file\'s sha256 }; a set\'s names its file; a header\'s a file of its concept\'s folder', async () => {
  const T = await active();
  const t = byAddress(T);
  const o = await F.oracle();
  const cf = (n) => F.parsed(n && n.cameFrom);
  const rover = cf(t.get(o.elementOf(ROVER)));
  assert(rover && rover.kind === 'file' && rover.address === ROVER && rover.id === F.fileSha(F.ACTIVE, ROVER), `rover's cameFrom; got ${show(rover)}`);
  const free = cf(t.get(o.setOf('concepts/nostr-relay/sets/free-relays.json')));
  assert(free && free.kind === 'file' && free.address === 'concepts/nostr-relay/sets/free-relays.json' && free.id === F.fileSha(F.ACTIVE, 'concepts/nostr-relay/sets/free-relays.json'), `free-relays' cameFrom; got ${show(free)}`);
  const missing = F.nodesOf(T).filter((n) => { const c = cf(n); return !c || c.kind !== 'file' || typeof c.address !== 'string' || !/^[0-9a-f]{64}$/.test(String(c.id)); });
  assert(missing.length === 0, `every node has a cameFrom of kind file with a path and a sha256; ${missing.length} don't, the first ${firstFew(missing.map((n) => n.address))}`);
  const dog = cf(t.get(`39998:${TA}:dog`));
  assert(dog && dog.address.startsWith('concepts/dog/'), `dog's header came from a file of concepts/dog/; got ${show(dog)}`);
});

test('ST20 [Decision 2]: the builder writes nothing to the folder and asks no graph', async () => {
  const dir = F.copyFirmware();
  const snapshot = () => { const out = {}; (function walk(d, rel) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const r = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) walk(path.join(d, e.name), r); else out[r] = F.sha256(fs.readFileSync(path.join(d, e.name))); } })(dir, ''); return out; };
  const before = snapshot();
  const seam = require(path.join(F.ROOT, 'src/operations/graph.js'));
  const saved = { read: seam.read, writeTransaction: seam.writeTransaction };
  const asked = [];
  seam.read = async () => { asked.push('read'); throw new Error('the builder asked the graph'); };
  seam.writeTransaction = async () => { asked.push('writeTransaction'); throw new Error('the builder wrote to the graph'); };
  let t;
  try { t = await F.buildTarget(dir, TA); } finally { Object.assign(seam, saved); }
  assert(t && F.nodesOf(t).length === F.census(dir).total, `the builder answered, ${F.census(dir).total} nodes (so this isn't passing on a builder that returned early)`);
  assert(asked.length === 0, `it asked the graph nothing; got ${show(asked)}`);
  assert(show(snapshot()) === show(before), 'every file of the folder is as it was');
});

// ── firmware-unreadable (AC7, Decision 3) ──
const problemsOf = async (dir) => { const t = await F.buildTarget(dir, TA); return { t, list: Array.isArray(t.problems) ? t.problems : [], text: show(t.problems || []) }; };

test('ST21 [AC7, Decision 3]: a manifest that doesn\'t parse is a problem naming manifest.json', async () => {
  const { list, text } = await problemsOf(F.copyFirmware({ 'manifest.json': '{ "version": "1.0.0", "concepts": [' }));
  assert(list.length >= 1 && /manifest\.json/.test(text), `a problem names manifest.json; got ${text.slice(0, 400)}`);
});

test('ST22 [AC7, Decision 3]: a file the manifest names that isn\'t there is a problem naming the file: a concept\'s schema, and a relationship type\'s file', async () => {
  const { list, text } = await problemsOf(F.copyFirmware({ 'concepts/dog/json-schema.json': null }));
  assert(list.length >= 1 && /concepts\/dog\/json-schema\.json/.test(text), `a problem names concepts/dog/json-schema.json; got ${text.slice(0, 400)}`);
  const rt = await problemsOf(F.copyFirmware({ 'concepts/relationship-type/elements/class-thread-initiation.json': null }));
  assert(rt.list.length >= 1 && /class-thread-initiation\.json/.test(rt.text), `a problem names the relationship type file manifest.relationshipTypes names; got ${rt.text.slice(0, 400)}`);
});

test('ST23 [AC7, Decision 3]: a file that isn\'t JSON is a problem naming the file', async () => {
  const { list, text } = await problemsOf(F.copyFirmware({ [ROVER]: '{ "word": { "slug": "dog--rover", ' }));
  assert(list.length >= 1 && /concepts\/dog\/elements\/rover\.json/.test(text), `a problem names rover.json; got ${text.slice(0, 400)}`);
});

test('ST24 [AC7, Decision 3]: an enumeration naming a concept the manifest doesn\'t define is a problem naming that concept', async () => {
  const { list, text } = await problemsOf(F.copyFirmware({ 'manifest.json': (m) => { m.enumerations['dog-breeds']['existing-nodes'][0].concept = 'cat'; return m; } }));
  assert(list.length >= 1 && /\bcat\b/.test(text), `a problem names the concept cat; got ${text.slice(0, 400)}`);
});

test('ST25 [AC7, Decision 3]: an enumeration by a concept the manifest doesn\'t define (its key\'s singular) is a problem naming it', async () => {
  const { list, text } = await problemsOf(F.copyFirmware({ 'manifest.json': (m) => { m.enumerations['cat-breeds'] = m.enumerations['dog-breeds']; delete m.enumerations['dog-breeds']; return m; } }));
  assert(list.length >= 1 && /cat-breed/.test(text), `a problem names cat-breed (from cat-breeds); got ${text.slice(0, 400)}`);
});

test('ST26 [AC7, Decision 3]: a relationship type a concept manifest uses that relationshipTypes lacks is a problem naming the file and the type', async () => {
  const { list, text } = await problemsOf(F.copyFirmware({ 'concepts/dog/manifest.json': { HAS_ELEMENT: [], IS_A_SUPERSET_OF: [], IS_A_FRIEND_OF: [{ nodeFrom: 'rover', nodeTo: 'rover' }] } }));
  assert(list.length >= 1 && /IS_A_FRIEND_OF/.test(text) && /concepts\/dog\/manifest\.json/.test(text), `a problem names concepts/dog/manifest.json and IS_A_FRIEND_OF; got ${text.slice(0, 400)}`);
});

test('ST27 [AC7, Decision 3]: several problems at once are each named, files and concepts', async () => {
  const { list, text } = await problemsOf(F.copyFirmware({
    [ROVER]: 'not json',
    'concepts/graph/json-schema.json': null,
    'manifest.json': (m) => { m.enumerations['graph-types']['existing-nodes'][0].concept = 'chart'; return m; },
  }));
  assert(list.length >= 3, `three problems; got ${list.length}: ${text.slice(0, 500)}`);
  for (const what of [/concepts\/dog\/elements\/rover\.json/, /concepts\/graph\/json-schema\.json/, /\bchart\b/]) assert(what.test(text), `the problems name ${what}; got ${text.slice(0, 500)}`);
});

test('ST28 [AC5, Decision 7]: graph-rule\'s items, one for each of its element files, are elements of the target, each its file\'s JSON', async () => {
  const T = await active();
  const o = await F.oracle();
  const t = byAddress(T);
  const items = [...o.letters.values()].filter((l) => l.concept === 'graph-rule' && l.role === 'element');
  assert(items.length === F.census().graphRules, `the oracle has ${F.census().graphRules} graph-rule items, one for each file; got ${items.length}`);
  for (const l of items) {
    const n = t.get(l.address);
    assert(n && F.sameJson(n.json, F.readFirmwareJson(F.ACTIVE, l.file)), `${l.file} is an element of the target with its file's JSON`);
  }
});

test('ST29 [Decision 4, 1b]: _elements.js exports installName, which gives install\'s name for an element file: word.name after its last colon, else its section\'s name, else word.slug', async () => {
  const E = require(path.join(F.ROOT, 'src/operations/catalog/graph/_elements.js'));
  assert(typeof E.installName === 'function', '_elements.js exports installName (ADR 0037 Decision 4: "installName is exported")');
  assert(E.installName({ word: { name: 'dog: Rover', slug: 'dog--rover' }, dog: { name: 'X' } }) === 'Rover', 'after the last colon, trimmed');
  assert(E.installName({ word: { name: 'no colon', slug: 's' }, thing: { name: 'Section Name' } }) === 'Section Name', 'else the section\'s name');
  assert(E.installName({ word: { name: 'no colon', slug: 'the-slug' }, thing: {} }) === 'the-slug', 'else word.slug');
});

test('ST30 [Decision 4, regression]: conceptNodes called as today gives today\'s eight nodes, each core node with the spec\'s o tag (its defaults unchanged)', async () => {
  const K = require(path.join(F.ROOT, 'src/operations/catalog/graph/_concepts.js'));
  const CN = require(path.join(F.ROOT, 'src/lib/conceptNames'));
  // Quietly: in this process no assistant is configured, so the firmware module warns as it resolves each z address.
  const saved = { log: console.log, warn: console.warn };
  let nodes;
  try { console.log = () => {}; console.warn = () => {}; ({ nodes } = K.conceptNodes({ names: CN.deriveAllNames('gizmo', 'gizmos'), d: 'gizmo', ta: TA, description: 'a gizmo' })); } finally { Object.assign(console, saved); }
  assert(Object.keys(nodes).length === 8, 'eight nodes');
  for (const role of Object.keys(nodes).filter((r) => r !== 'conceptHeader')) assert(nodes[role].tags.some((x) => x[0] === 'o'), `${role} keeps its o tag when nothing asks otherwise`);
});

test('ST31 [AC7, Amendment 1, item 4]: an existing set naming a concept the manifest doesn\'t define is skipped, as today: no problem, and nothing made of it', async () => {
  const dir = F.copyFirmware({ 'manifest.json': (m) => { m.sets.words['existing-sets'].push({ concept: 'no-such-concept' }); return m; } });
  const t = await F.buildTarget(dir, TA);
  assert(Array.isArray(t.problems) && t.problems.length === 0, `no problem; got ${show(t.problems).slice(0, 300)}`);
  assert(F.nodesOf(t).length === F.census().total, `the same ${F.census().total} nodes; got ${F.nodesOf(t).length}`);
  const named = F.relsOfTarget(t).map(F.relEnds).filter((r) => [r.from, r.to].some((x) => String(x).includes('no-such-concept')));
  assert(named.length === 0, `no relationship names it; got ${firstFew(named)}`);
  const rels = (x) => new Set(F.relsOfTarget(x).map(F.relEnds).map((r) => `${r.from}|${r.type}|${r.to}`));
  const d = F.setDiff(rels(t), rels(await active()));
  assert(!d.onlyFirst.length && !d.onlySecond.length, `its relationships are firmware/active's; differ ${firstFew([...d.onlyFirst, ...d.onlySecond])}`);
});

test('ST32 [AC7, Amendment 3, item 5]: a relationship type whose alias isn\'t a plain name, [A-Z_][A-Z0-9_]*, is a problem naming its file and the alias: a space, and a backtick', async () => {
  const cases = [
    ['concepts/relationship-type/elements/core-node-concept-graph.json', 'IS THE CONCEPT GRAPH FOR'],
    ['concepts/relationship-type/elements/core-node-core-graph.json', 'IS_THE_CORE`GRAPH_FOR'],
  ];
  for (const [file, alias] of cases) {
    const dir = F.copyFirmware({ [file]: (j) => ({ ...j, relationshipType: { ...j.relationshipType, alias } }) });
    const t = await F.buildTarget(dir, TA);
    const text = show(t.problems || []);
    assert(Array.isArray(t.problems) && t.problems.length >= 1, `the alias ${show(alias)} is a problem: the builder must not take it; got no problem`);
    const named = (t.problems || []).some((x) => { const w = typeof x === 'string' ? x : show(x); return w.includes(file) && w.includes(alias); });
    assert(named, `a problem names ${file} and the alias ${show(alias)}; got ${text.slice(0, 400)}`);
    assert(F.nodesOf(t).length === 0 || !F.relsOfTarget(t).some((r) => F.relEnds(r).type === alias), 'and no relationship of that type is built');
  }
});

test('ST33 [Amendment 3, item 8; review round 1, N7; round 2, R2-N3]: the tripwire: today\'s install\'s pass functions, and pass 3c\'s route, are as the builder last followed them (when one changes, bring src/firmware/target.js in line, then update its digest here)', () => {
  // [file, what, where it starts, where it ends, its digest]: each part's source, its whitespace collapsed.
  const INSTALL = 'src/firmware/install.js';
  const NORMALIZE = 'src/api/normalize/index.js';
  const PINNED = [
    // Updated for story graph-operations-first-slice #47 (pass 1a passes each header file's word.wordTypes; ADR 0047 Decision 9), once target.js followed it.
    [INSTALL, 'pass1_bootstrap', /^async function pass1_bootstrap\(/m, /^\/\/ ── Pass 2: Enrich/m, 'b4cea1c4dec0c0d6d2c7431b4c8b85422e80015aacf4614b7fe6ef43a50a65e0'],
    [INSTALL, 'pass2_enrich', /^async function pass2_enrich\(/m, /^\/\/ ── Community references/m, 'bf2a3bc6ebf2a94726dac347562142c34afb8c4f2114fc16b2ff58e4e0261b9c'],
    // Updated for story community-reference #39 (each import pruned after it, a reference the assistant curates itself
    // skipped, seededB set once the stored letter carries the b; ADR community-reference/0035 and its Amendment 1), once
    // target.js and the oracle followed it.
    [INSTALL, 'pass_communityReferences', /^async function pass_communityReferences\(/m, /^\/\/ ── Full install/m, '11c57a1aab6c0c25e2fbe3ce20d184a366b13617ccd1f50ca7b791d98cb9f433'],
    [INSTALL, 'install\'s pass 3 (derive, apply enumerations, wire implicit elements, the community-reference edges)', /^ {2}\/\/ ── Pass 3: Derive \+ Apply Enumerations \+ Wire Implicit Elements ──/m,
      /^ {2}console\.log\('\\n╔═+╗'\);\n {2}console\.log\('║ +FIRMWARE INSTALL COMPLETE/m, 'c531d428fa704c760b6014b3a6d4d49321657e288f298282e8b9d5742f3d1e29'],
    // Pass 3c's route, POST /api/normalize/wire-implicit-elements, which install's pass 3 calls and the oracle doesn't
    // run (review round 2, R2-N3).
    [NORMALIZE, 'handleWireImplicitElements (pass 3c)', /^async function handleWireImplicitElements\(/m, /^\/\/ ═+\n\/\/ POST \/api\/normalize\/apply-enumerations/m, '79e22c0f3575aa080961cf0e71b8560587d7a82c676f7f44f83edfbd81244c7d'],
  ];
  const sources = new Map();
  const sourceOf = (file) => { if (!sources.has(file)) sources.set(file, fs.readFileSync(path.join(F.ROOT, file), 'utf8')); return sources.get(file); };
  const changed = [];
  for (const [file, name, from, to, pinned] of PINNED) {
    const src = sourceOf(file);
    const at = src.search(from);
    const end = at < 0 ? -1 : src.slice(at).search(to);
    if (at < 0 || end < 0) { changed.push(`${file}'s ${name} (not found where this test looks: ${at < 0 ? from : to}; it moved)`); continue; }
    const digest = F.sha256(src.slice(at, at + end).replace(/\s+/g, ' ').trim());
    if (digest !== pinned) changed.push(`${file}'s ${name} (now ${digest})`);
  }
  assert(changed.length === 0, `today's install changed: ${changed.join('; ')}. src/firmware/target.js rebuilds these passes (ADR 0037 Decision 4, Amendment 3 item 8): bring it in line with the change, then update the digest in this test`);
});

test('ST34 [AC7, Decision 3, ADR 0047 Decision 9; review round 4, R4-N1]: a header file whose word.wordTypes isn\'t all concept keys\' form is a problem naming the file: a key with a space, and a number', async () => {
  const cases = [
    ['concepts/word/concept-header.json', (j) => ({ ...j, word: { ...j.word, wordTypes: ['word', 'conceptHeader', 'node type'] } }), 'a key with a space'],
    ['concepts/image/concept-header.json', (j) => ({ ...j, word: { ...j.word, wordTypes: ['word', 'conceptHeader', 5] } }), 'a number'],
  ];
  for (const [file, change, what] of cases) {
    const { list, text } = await problemsOf(F.copyFirmware({ [file]: change }, { label: 'seed-firmware-wordtypes-' }));
    assert(list.length >= 1 && text.includes(file) && /wordTypes/.test(text), `${what}: a problem names ${file} and its wordTypes; got ${text.slice(0, 400)}`);
  }
  const fine = await problemsOf(F.copyFirmware({ 'concepts/word/concept-header.json': (j) => ({ ...j, word: { ...j.word, wordTypes: ['word', 'conceptHeader', 'nodeType', 'graphType'] } }) }, { label: 'seed-firmware-wordtypes-ok-' }));
  assert(fine.list.length === 0, `a list of concept keys is no problem; got ${fine.text.slice(0, 300)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
