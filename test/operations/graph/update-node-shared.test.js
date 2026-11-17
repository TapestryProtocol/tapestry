'use strict';
/**
 * What graph update-node brings for the writes after it — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/21-update-node.md (AC5's "decided in one place, which
 *          merge-nodes (A10.25) and delete-node (A10.26) will use too", and AC3)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0021-update-node.md (Decisions 3, 4 and 11; Amendment 1)
 *   Plan:  engineering-team/stories/graph-operations-first-slice/21-update-node.test-plan.md
 *
 * Stack-free. Each test runs in a child process with test/helpers/graphOpsSuite.js's environment (TA_PUBKEY set, the
 * owner and the admin configured, every service endpoint dead), over the graph test/helpers/updateNodeGraph.js seeds,
 * read through test/helpers/graphFake.js's readerOver.
 *
 *   SN1 whoseNode answers a node's address, name, author, letter, labels and whether it is the instance's own: by its
 *       assistant or its owner, lettered or not, or made here with no author; and null for no node or a change entry
 *   SN2 its own is the read conventions' own, node for node
 *   SN3 requireOwn answers the instance's own node, and refuses unknown-node and not-own-node, naming the input it is
 *       given, the author, the address and graph copy-node
 *   SN4 NOT_OWN_NODE is the refusal's declaration: not-own-node, 409, in words
 *   SN5 firmwareElements gives each firmware element file's address, as install gives it, mapped to its file;
 *       firmwareElementOf answers the file for that address, and null for any other
 *   SN6 checkElements with every throws one refusal naming each finding; without it, the first only, as before
 *   SN7 the fake graph runs U0, U1 and E3 with $authors as the ADR writes them (it passes before the code exists: it
 *       holds the fake to the ADR's new statements)
 *
 * Story graph-operations-first-slice #26 (graph delete-node, AC3; ADR graph-operations-first-slice/0026 Decision 4,
 * which amends ADR 0021 Decision 3; plan 26-delete-node.test-plan.md) adds, over test/helpers/deleteNodeGraph.js's seed:
 *   SN8  whoseNode answers person and placeholder, and own false for either, whatever key the node carries
 *   SN9  refuseUnlessOwn refuses person-node, then placeholder-node, then not-own-node, naming the input; requireOwn too
 *   SN10 PERSON_NODE and PLACEHOLDER_NODE are the refusals' declarations: 409, in words
 *   SN11 a write's own is still the read conventions' own for every other node; a person node or a placeholder is
 *        never a write's own
 *   SN12 factsOf reads a node's properties and labels as whoseNode does
 *   SN13 update-node refuses a person node and a placeholder by those codes, and lists both
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');
const D = require('../../helpers/deleteNodeGraph');

const { ROOT, TA, OWNER, ADMIN, STRANGER, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: what graph update-node shares');

const NOBODY = '00000000-0000-4000-8000-0000000000cc';

/**
 * Run `body` (an async function's body, with ROOT, path, out(x) and the seed's helpers in scope) in a child; its result.
 * The seed is update-node's unless `seed` names another helper and its function, as DELETE_SEED does.
 */
function inChild(body, { seed = 'test/helpers/updateNodeGraph.js', fn = 'seedUpdateNode', adr = '0021' } = {}) {
  const dir = tmp('update-node-shared-');
  const script = path.join(dir, 'probe.js');
  fs.writeFileSync(script, `'use strict';
const ROOT = ${JSON.stringify(ROOT)};
const path = require('path');
const out = (x) => process.stdout.write('RESULT:' + JSON.stringify(x));
const at = (rel) => require(path.join(ROOT, rel));
(async () => {
  const U = at(${JSON.stringify(seed)});
  const { readerOver } = at('test/helpers/graphFake.js');
  const seed = await U[${JSON.stringify(fn)}]();
  const read = readerOver(seed.state);
  const k = seed.keys;
  ${body}
})().catch((e) => out({ thrown: String((e && e.stack) || e).slice(0, 1200) }));
`);
  const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 60000 });
  const line = (child.stdout || '').split('RESULT:')[1];
  if (!line) throw new Error(`the child printed no result: ${(child.stderr || child.stdout || '').slice(-800)}`);
  const r = JSON.parse(line);
  if (r.missing) throw new Error(`${r.missing} doesn't exist yet (ADR graph-operations-first-slice/${adr} Implementation notes)`);
  if (r.thrown) throw new Error(`the child threw: ${r.thrown}`);
  return r;
}

const NAMES = ['rover', 'lucky', 'patch', 'ghosty', 'snowy', 'ace', 'drifter', 'walkers'];

test('SN1: whoseNode answers a node\'s facts and whether it is the instance\'s own', () => {
  const r = inChild(`
    const N = at('src/operations/catalog/graph/_nodes.js');
    if (typeof N.whoseNode !== 'function') return out({ missing: '_nodes.js whoseNode' });
    const facts = {};
    for (const name of ${JSON.stringify(NAMES)}) facts[name] = await N.whoseNode(read, k[name]);
    facts.nobody = await N.whoseNode(read, ${JSON.stringify(NOBODY)});
    facts.entry = await N.whoseNode(read, k.G);
    const uuids = Object.fromEntries(${JSON.stringify(NAMES)}.map((n) => [n, seed.uuids[n] || null]));
    out({ facts, keys: Object.fromEntries(${JSON.stringify(NAMES)}.map((n) => [n, k[n]])), uuids });
  `);
  const f = r.facts;
  const want = {
    rover: { own: true, author: TA, hasLetter: true, why: "the assistant's letter" },
    lucky: { own: true, author: TA, hasLetter: true, why: "the assistant's letter" },
    patch: { own: true, author: OWNER, hasLetter: true, why: "the owner's letter (the owner's answer, open question 3)" },
    ghosty: { own: true, author: null, hasLetter: false, why: 'made here, with no author' },
    snowy: { own: false, author: 'ee'.repeat(32), hasLetter: true, why: "another author's letter" },
    ace: { own: false, author: ADMIN, hasLetter: true, why: "an admin's letter: an admin's key isn't one of the instance's own" },
    drifter: { own: false, author: STRANGER, hasLetter: false, why: "no letter, but a stranger's recorded author" },
  };
  for (const [name, w] of Object.entries(want)) {
    const x = f[name];
    assert(x && x.key === r.keys[name] && x.own === w.own && x.author === w.author && x.hasLetter === w.hasLetter,
      `${name}, ${w.why}: own ${w.own}, author ${w.author}, hasLetter ${w.hasLetter} (Decision 3); got ${show(x)}`);
    if (r.uuids[name]) assert(x.uuid === r.uuids[name], `${name}: its address; got ${show(x.uuid)}`);
  }
  assert(Array.isArray(f.walkers && f.walkers.labels) && f.walkers.labels.includes('Set'), `whoseNode answers the node's labels (Amendment 1); got ${show(f.walkers)}`);
  assert(f.rover.name === 'Rover', `and its name; got ${show(f.rover)}`);
  assert(f.nobody === null && f.entry === null, `no node, and a change entry, are null; got ${show({ nobody: f.nobody, entry: f.entry })}`);
});

test('SN2: whoseNode\'s own is the read conventions\' own, node for node', () => {
  const r = inChild(`
    const N = at('src/operations/catalog/graph/_nodes.js');
    if (typeof N.whoseNode !== 'function') return out({ missing: '_nodes.js whoseNode' });
    const R = at('src/operations/reads.js');
    const own = R.ownKeys();
    const pairs = [];
    for (const name of ${JSON.stringify(NAMES)}) {
      const w = await N.whoseNode(read, k[name]);
      pairs.push({ name, write: w.own, read: R.nodeOf({ tapestryKey: k[name], name: w.name, address: w.uuid, author: w.author }, own).own });
    }
    out({ pairs });
  `);
  for (const p of r.pairs) assert(p.write === p.read, `${p.name}: a write counts a node as the instance's own exactly when a read does (Decision 3); write ${p.write}, read ${p.read}`);
});

test('SN3: requireOwn answers the instance\'s own node, and refuses unknown-node and not-own-node, naming the input', () => {
  const r = inChild(`
    const N = at('src/operations/catalog/graph/_nodes.js');
    if (typeof N.requireOwn !== 'function') return out({ missing: '_nodes.js requireOwn' });
    const catchIt = async (f) => { try { return { answer: await f() }; } catch (e) { return { code: e.code, message: e.message, extra: e.extra, refusal: e.isRefusal === true }; } };
    out({
      own: await catchIt(() => N.requireOwn(read, k.patch)),
      unknown: await catchIt(() => N.requireOwn(read, ${JSON.stringify(NOBODY)})),
      unknownMerge: await catchIt(() => N.requireOwn(read, ${JSON.stringify(NOBODY)}, { input: 'merge' })),
      other: await catchIt(() => N.requireOwn(read, k.snowy)),
      otherMerge: await catchIt(() => N.requireOwn(read, k.ace, { input: 'merge' })),
      snowy: seed.uuids.snowy,
    });
  `);
  assert(r.own.answer && r.own.answer.own === true && r.own.answer.author === OWNER, `the owner's node is answered, its facts given; got ${show(r.own)}`);
  assert(r.unknown.refusal && r.unknown.code === 'unknown-node' && r.unknown.extra && r.unknown.extra.input === 'node', `no node: unknown-node, naming the input node by default; got ${show(r.unknown)}`);
  assert(r.unknownMerge.code === 'unknown-node' && r.unknownMerge.extra.input === 'merge', `and naming the input it is given, as merge-nodes will give merge; got ${show(r.unknownMerge)}`);
  assert(r.other.refusal && r.other.code === 'not-own-node' && r.other.extra.input === 'node', `another author's letter: not-own-node; got ${show(r.other)}`);
  assert(r.other.message.includes('ee'.repeat(32)) && r.other.message.includes(r.snowy) && /copy-node/.test(r.other.message), `naming its author, its address, and graph copy-node (D8); got ${show(r.other.message)}`);
  assert(r.otherMerge.code === 'not-own-node' && r.otherMerge.extra.input === 'merge' && r.otherMerge.message.includes(ADMIN), `an admin's letter, for the input merge: not-own-node, naming the admin; got ${show(r.otherMerge)}`);
});

test('SN4: NOT_OWN_NODE is the refusal\'s declaration: not-own-node, 409, in words', () => {
  const r = inChild(`
    const N = at('src/operations/catalog/graph/_nodes.js');
    if (!N.NOT_OWN_NODE) return out({ missing: '_nodes.js NOT_OWN_NODE' });
    out({ decl: N.NOT_OWN_NODE });
  `);
  assert(r.decl.code === 'not-own-node' && r.decl.status === 409 && typeof r.decl.when === 'string' && r.decl.when.length > 30, `{ code: not-own-node, status: 409, when } (Decision 3); got ${show(r.decl)}`);
});

test('SN5: firmwareElements gives each firmware element file\'s address, as install gives it; firmwareElementOf answers its file', () => {
  const r = inChild(`
    const X = at('src/operations/catalog/graph/_elements.js');
    if (typeof X.firmwareElements !== 'function' || typeof X.firmwareElementOf !== 'function') return out({ missing: '_elements.js firmwareElements and firmwareElementOf' });
    const fs = require('fs');
    const dtag = at('src/lib/dtag.js');
    const firmware = at('src/api/normalize/firmware.js');
    const ta = process.env.TA_PUBKEY;
    // Install's naming of an element file (src/firmware/install.js:262–266), and today's create-element's d-tag (fact 8).
    const expected = [];
    for (const c of firmware.getManifest().concepts) {
      const dir = path.join(firmware.firmwareDir(), c.dir, 'elements');
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
        const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        const conceptKey = Object.keys(data).filter((key) => key !== 'word')[0];
        const name = (data.word.name.includes(':') ? data.word.name.split(':').pop().trim() : (data[conceptKey] && data[conceptKey].name) || data.word.slug).trim();
        expected.push({ address: '39999:' + ta + ':' + dtag.childDTag(name, '39998:' + ta + ':' + c.slug), file: path.posix.join(c.dir.replace(/^\\.\\//, '').replace(/\\/$/, ''), 'elements', file), slug: c.slug });
      }
    }
    const all = X.firmwareElements();
    const size = all instanceof Map ? all.size : Object.keys(all || {}).length;
    const got = expected.map((e) => ({ ...e, of: X.firmwareElementOf(e.address) }));
    out({ size, got, beagleRover: X.firmwareElementOf(seed.uuids.rover), nothing: X.firmwareElementOf(null), roverAddress: at('test/helpers/updateNodeGraph.js').firmwareElementAddress('Rover', 'dog') });
  `);
  assert(r.got.length > 50, `the active firmware has element files; found ${r.got.length}`);
  assert(r.size === r.got.length, `one address for each firmware element file (Decision 4); got ${r.size} for ${r.got.length} files`);
  const miss = r.got.filter((e) => typeof e.of !== 'string' || !String(e.of).replace(/\\/g, '/').endsWith(e.file));
  assert(miss.length === 0, `each file's address answers that file; ${miss.length} don't, the first ${show(miss.slice(0, 3))}`);
  const rover = r.got.find((e) => e.file.endsWith('dog/elements/rover.json'));
  assert(rover && rover.address === r.roverAddress, `dog's rover is at the address install gives it, as the seed places it; got ${show(rover)} and ${r.roverAddress}`);
  assert(r.got.some((e) => e.slug === 'graph-rule'), 'the graph rules\' files are among them');
  assert(r.beagleRover === null && r.nothing === null, `an address no firmware file gives, and none, answer null; got ${show({ beagleRover: r.beagleRover, nothing: r.nothing })}`);
});

test('SN6: checkElements with every throws one refusal naming each finding; without it, the first finding alone', () => {
  const r = inChild(`
    const Sch = at('src/operations/catalog/graph/_schemas.js');
    const C = at('test/helpers/conceptGraph.js');
    const json = C.json(seed.state, k.twoFaced);
    const items = [{ concept: k.pet, json }, { concept: k.gadget, json }];
    const catchIt = async (f) => { try { await f(); return { threw: false }; } catch (e) { return { threw: true, code: e.code, message: e.message, rule: e.extra && e.extra.rule }; } };
    out({ every: await catchIt(() => Sch.checkElements(read, items, { every: true })), first: await catchIt(() => Sch.checkElements(read, items)) });
  `);
  const e = r.every;
  assert(e.threw && e.code === 'invalid-fields' && e.rule === 'element-fits-schema', `with every, one refusal from the rule (Decision 11); got ${show(e)}`);
  assert(/pet\.description/.test(e.message) && /gadget\.size/.test(e.message), `its message names each concept's problems, pet's and gadget's; got ${show(e.message)}`);
  const f = r.first;
  assert(f.threw && f.code === 'invalid-fields' && /pet\.description/.test(f.message) && !/gadget\.size/.test(f.message), `without it, the first finding alone, as create-element calls it; got ${show(f)}`);
});

test('SN7: the fake graph runs U0, U1 and E3 with $authors as the ADR writes them, answering as Neo4j would', () => {
  const r = inChild(`
    const ta = process.env.TA_PUBKEY;
    const owner = ${JSON.stringify(OWNER)};
    const U0 = 'MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n';
    const U1 = 'MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange OPTIONAL MATCH (n)-[:HAS_TAG]->(t:NostrEventTag) RETURN n.uuid AS uuid, n.name AS name, n.tapestryValue AS value, n.tapestryJsonUpdatedAt AS cached, t.tapestryKey AS tag, t.type AS type, t.value AS tagValue';
    const E3 = 'MATCH (h:TapestryNode {tapestryKey: $key})-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*0..]->()-[:HAS_ELEMENT]->(e:TapestryNode) WHERE e.pubkey IN $authors AND NOT e:GraphChange AND (toLower(e.name) = $name OR e.uuid = $address OR e.uuid STARTS WITH $nonced) WITH DISTINCT e OPTIONAL MATCH (e)-[:HAS_TAG]->(t:NostrEventTag {type: \\'json\\'}) OPTIONAL MATCH (p)-[:HAS_ELEMENT]->(e) RETURN e.tapestryKey AS key, e.uuid AS uuid, e.name AS name, e.id IS NOT NULL AS hasLetter, head(collect(DISTINCT t.value)) AS json, collect(DISTINCT p.tapestryKey) AS parents';
    const none = '39999:' + ta + ':no-such-address';
    out({
      u0: await read(U0, { key: k.walkers }),
      u0Entry: await read(U0, { key: k.G }),
      u1: await read(U1, { key: k.stamped }),
      e3Ta: (await read(E3, { key: k.beagle, authors: [ta], name: 'patch', address: none, nonced: none + '~' })).map((x) => x.key),
      e3Own: (await read(E3, { key: k.beagle, authors: [ta, owner], name: 'patch', address: none, nonced: none + '~' })).map((x) => x.key),
      patch: k.patch,
      stampedUuid: seed.uuids.stamped,
    });
  `);
  assert(r.u0.length === 1 && r.u0[0].n && Array.isArray(r.u0[0].n._labels) && r.u0[0].n._labels.includes('Set'), `U0 answers the whole node, its labels among its properties (Amendment 1); got ${show(r.u0)}`);
  assert(r.u0Entry.length === 0, `U0 leaves a change entry out; got ${show(r.u0Entry)}`);
  const types = r.u1.map((x) => x.type).sort();
  assert(show(types) === show(['d', 'json', 'name', 'z']) && r.u1.every((x) => x.uuid === r.stampedUuid && x.cached === 1763000001 && typeof x.tag === 'string'), `U1 answers one row a tag, each with the node's address and cache stamp and the tag's key; got ${show(r.u1)}`);
  assert(show(r.e3Ta) === show([]) && show(r.e3Own) === show([r.patch]), `E3 with $authors counts the authors it is given: the owner's Patch only when the owner's key is among them (Decision 10); got ${show({ ta: r.e3Ta, own: r.e3Own })}`);
});

// ── story 26: person nodes and placeholders (ADR graph-operations-first-slice/0026 Decision 4) ──
const DELETE_SEED = { seed: 'test/helpers/deleteNodeGraph.js', fn: 'seedDeleteNode', adr: '0026' };

test('SN8: whoseNode answers person and placeholder, and own false for either, whatever key the node carries', () => {
  const names = ['taUser', 'ownerUser', 'otherUser', 'personElement', 'ePlaceholder', 'aPlaceholder', 'aOwnPlaceholder', 'bPlaceholder', 'elementPlaceholder', 'rich', 'ghosty', 'snowy', 'loner'];
  const r = inChild(`
    const N = at('src/operations/catalog/graph/_nodes.js');
    const facts = {};
    for (const name of ${JSON.stringify(names)}) facts[name] = await N.whoseNode(read, k[name]);
    out({ facts });
  `, DELETE_SEED);
  const want = {
    taUser: { person: true, placeholder: false, own: false, author: TA, why: "the assistant's person node: its key is the person's, not an author's" },
    ownerUser: { person: true, placeholder: false, own: false, author: OWNER, why: "the owner's person node" },
    otherUser: { person: true, placeholder: false, own: false, author: D.OTHER, why: "another author's person node" },
    personElement: { person: true, placeholder: false, own: false, why: 'a person node that is an element of a concept' },
    ePlaceholder: { person: false, placeholder: true, own: false, hasLetter: false, author: null, why: "an e tag's placeholder: an id, no letter the graph holds" },
    aPlaceholder: { person: false, placeholder: true, own: false, hasLetter: false, author: D.OTHER, why: "an a tag's placeholder, by another author's address" },
    aOwnPlaceholder: { person: false, placeholder: true, own: false, hasLetter: false, author: TA, why: "a placeholder at one of the assistant's addresses" },
    bPlaceholder: { person: false, placeholder: true, own: false, hasLetter: false, author: null, why: "a b tag's placeholder: an address alone" },
    elementPlaceholder: { person: false, placeholder: true, own: false, why: 'a placeholder that is an element of a concept' },
    rich: { person: false, placeholder: false, own: true, hasLetter: true, author: TA, why: "the assistant's letter" },
    ghosty: { person: false, placeholder: false, own: true, hasLetter: false, author: null, why: 'made here, with no author' },
    snowy: { person: false, placeholder: false, own: false, hasLetter: true, why: "another author's letter" },
    loner: { person: false, placeholder: false, own: true, hasLetter: true, why: 'a letter with its created_at: no placeholder' },
  };
  for (const [name, w] of Object.entries(want)) {
    const x = r.facts[name] || {};
    for (const [field, v] of Object.entries(w)) if (field !== 'why') assert(x[field] === v, `${name}, ${w.why}: ${field} ${show(v)} (ADR 0026 Decision 4); got ${show(x)}`);
  }
});

test('SN9: refuseUnlessOwn refuses person-node, then placeholder-node, then not-own-node, naming the input; requireOwn refuses the same', () => {
  const r = inChild(`
    const N = at('src/operations/catalog/graph/_nodes.js');
    if (typeof N.refuseUnlessOwn !== 'function') return out({ missing: '_nodes.js refuseUnlessOwn' });
    const catchIt = async (f) => { try { await f(); return { passed: true }; } catch (e) { return { code: e.code, message: e.message, extra: e.extra, refusal: e.isRefusal === true }; } };
    const facts = (name) => N.whoseNode(read, k[name]);
    out({
      ta: await catchIt(async () => N.refuseUnlessOwn(await facts('taUser'), { input: 'merge' })),
      element: await catchIt(async () => N.refuseUnlessOwn(await facts('personElement'), { input: 'node' })),
      e: await catchIt(async () => N.refuseUnlessOwn(await facts('ePlaceholder'), { input: 'node' })),
      aOwn: await catchIt(async () => N.refuseUnlessOwn(await facts('aOwnPlaceholder'), { input: 'node' })),
      other: await catchIt(async () => N.refuseUnlessOwn(await facts('snowy'), { input: 'node' })),
      own: await catchIt(async () => N.refuseUnlessOwn(await facts('rich'), { input: 'node' })),
      requirePerson: await catchIt(() => N.requireOwn(read, k.ownerUser)),
      requirePlaceholder: await catchIt(() => N.requireOwn(read, k.bPlaceholder, { input: 'merge' })),
      aOwnUuid: seed.uuids.aOwnPlaceholder,
      bUuid: seed.uuids.bPlaceholder,
    });
  `, DELETE_SEED);
  assert(r.ta.refusal && r.ta.code === 'person-node' && r.ta.extra && r.ta.extra.input === 'merge' && r.ta.message.includes(TA) && /A10\.30|raw delete-node/.test(r.ta.message),
    `the assistant's person node: person-node, naming the input, the person's key and raw delete-node; got ${show(r.ta)}`);
  assert(r.element.code === 'person-node', `a person node that is an element is a person node still; got ${show(r.element)}`);
  assert(r.e.refusal && r.e.code === 'placeholder-node' && r.e.extra.input === 'node' && r.e.message.includes(D.E_ID) && /import/i.test(r.e.message),
    `an e tag's placeholder: placeholder-node, naming the id it stands for and the import; got ${show(r.e)}`);
  assert(r.aOwn.code === 'placeholder-node' && r.aOwn.message.includes(r.aOwnUuid), `a placeholder at the assistant's address: placeholder-node, its key notwithstanding; got ${show(r.aOwn)}`);
  assert(r.other.code === 'not-own-node', `another author's letter: not-own-node, as before; got ${show(r.other)}`);
  assert(r.own.passed === true, `the instance's own node passes; got ${show(r.own)}`);
  assert(r.requirePerson.code === 'person-node' && r.requirePerson.extra.input === 'node', `requireOwn refuses a person node the same way, naming node by default; got ${show(r.requirePerson)}`);
  assert(r.requirePlaceholder.code === 'placeholder-node' && r.requirePlaceholder.extra.input === 'merge' && r.requirePlaceholder.message.includes(r.bUuid),
    `and a placeholder, naming the input it is given; got ${show(r.requirePlaceholder)}`);
});

test('SN10: PERSON_NODE and PLACEHOLDER_NODE are the refusals\' declarations: 409, in words', () => {
  const r = inChild(`
    const N = at('src/operations/catalog/graph/_nodes.js');
    if (!N.PERSON_NODE || !N.PLACEHOLDER_NODE) return out({ missing: '_nodes.js PERSON_NODE and PLACEHOLDER_NODE' });
    out({ person: N.PERSON_NODE, placeholder: N.PLACEHOLDER_NODE });
  `, DELETE_SEED);
  for (const [decl, code] of [[r.person, 'person-node'], [r.placeholder, 'placeholder-node']]) {
    assert(decl.code === code && decl.status === 409 && typeof decl.when === 'string' && decl.when.length > 30, `{ code: ${code}, status: 409, when } (ADR 0026 Decision 4); got ${show(decl)}`);
  }
});

test('SN11: a write\'s own is still the read conventions\' own for every other node; a person node or a placeholder is never a write\'s own', () => {
  const r = inChild(`
    const N = at('src/operations/catalog/graph/_nodes.js');
    const R = at('src/operations/reads.js');
    const own = R.ownKeys();
    const rows = [];
    for (const n of seed.state.nodes) {
      if (n.labels.includes('GraphChange') || !n.props.tapestryKey) continue;
      const w = await N.whoseNode(read, n.props.tapestryKey);
      rows.push({ key: n.props.tapestryKey, person: w.person, placeholder: w.placeholder, write: w.own, read: R.nodeOf({ tapestryKey: n.props.tapestryKey, name: w.name, address: w.uuid, author: w.author }, own).own });
    }
    out({ rows, special: ['taUser', 'ownerUser', 'otherUser', 'personElement', 'ePlaceholder', 'aPlaceholder', 'aOwnPlaceholder', 'bPlaceholder', 'elementPlaceholder'].map((x) => k[x]) });
  `, DELETE_SEED);
  let others = 0;
  for (const x of r.rows) {
    if (x.person || x.placeholder) assert(x.write === false, `${x.key}, a ${x.person ? 'person node' : 'placeholder'}: never a write's own (ADR 0026 Decision 4); got ${show(x)}`);
    else { others++; assert(x.write === x.read, `${x.key}: a write counts it as its own exactly when a read does (ADR 0021 Decision 3); write ${x.write}, read ${x.read}`); }
  }
  const special = new Set(r.rows.filter((x) => x.person || x.placeholder).map((x) => x.key));
  assert(r.special.every((key) => special.has(key)) && others > 100, `the seed's person nodes and placeholders are among them, beside every other node; got ${special.size} and ${others}`);
});

test('SN12: factsOf reads a node\'s properties and labels as whoseNode does', () => {
  const r = inChild(`
    const N = at('src/operations/catalog/graph/_nodes.js');
    if (typeof N.factsOf !== 'function') return out({ missing: '_nodes.js factsOf' });
    const pairs = [];
    for (const name of ['rich', 'taUser', 'ePlaceholder', 'aPlaceholder', 'ghosty', 'snowy']) {
      const [row] = await read('MATCH (n:TapestryNode {tapestryKey: $key}) WHERE NOT n:GraphChange RETURN n', { key: k[name] });
      pairs.push({ name, facts: N.factsOf(k[name], row.n), whose: await N.whoseNode(read, k[name]) });
    }
    out({ pairs });
  `, DELETE_SEED);
  for (const p of r.pairs) assert(show(p.facts) === show(p.whose), `${p.name}: factsOf gives what whoseNode answers (ADR 0026 Decision 4); factsOf ${show(p.facts)}, whoseNode ${show(p.whose)}`);
});

test('SN13: update-node refuses a person node and a placeholder by those codes, and lists both', async () => {
  const seed = await D.seedDeleteNode();
  const k = seed.keys;
  const file = seed.file(tmp('update-node-shared-run-'));
  const post = (id, node) => ({ id, method: 'POST', url: '/api/tapestry/graph/update-node', caller: 'owner', body: { node, name: 'Someone' } });
  const r = S.runHarness({ scenarios: [{ graphFake: { stateFile: file }, requests: [post('person', k.ownerUser), post('placeholder', k.ePlaceholder), { id: 'list', method: 'GET', url: '/api/tapestry/operations', caller: 'admin' }], cli: [] }] }, { dir: path.dirname(file) });
  const a = S.answered(r);
  const p = a.req('person');
  const ph = a.req('placeholder');
  assert(p.status === 409 && p.body.code === 'person-node' && p.body.input === 'node', `update-node of the owner's person node: 409 person-node (ADR 0026 Decision 4); got ${p.status} ${show(p.body)}`);
  assert(ph.status === 409 && ph.body.code === 'placeholder-node' && ph.body.input === 'node', `update-node of an e tag's placeholder: 409 placeholder-node; got ${ph.status} ${show(ph.body)}`);
  const e = ((a.req('list').body.data || {}).operations || []).find((o) => o.group === 'graph' && o.name === 'update-node');
  const status = Object.fromEntries(((e && e.refusals) || []).map((x) => [x.code, x.status]));
  assert(status['person-node'] === 409 && status['placeholder-node'] === 409, `update-node lists person-node and placeholder-node; got ${show(status)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
