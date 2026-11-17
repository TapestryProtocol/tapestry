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
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../../helpers/graphOpsSuite');

const { ROOT, TA, OWNER, ADMIN, STRANGER, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: what graph update-node shares');

const NOBODY = '00000000-0000-4000-8000-0000000000cc';

/** Run `body` (an async function's body, with ROOT, path, out(x) and the seed's helpers in scope) in a child; its result. */
function inChild(body) {
  const dir = tmp('update-node-shared-');
  const script = path.join(dir, 'probe.js');
  fs.writeFileSync(script, `'use strict';
const ROOT = ${JSON.stringify(ROOT)};
const path = require('path');
const out = (x) => process.stdout.write('RESULT:' + JSON.stringify(x));
const at = (rel) => require(path.join(ROOT, rel));
(async () => {
  const U = at('test/helpers/updateNodeGraph.js');
  const { readerOver } = at('test/helpers/graphFake.js');
  const seed = await U.seedUpdateNode();
  const read = readerOver(seed.state);
  const k = seed.keys;
  ${body}
})().catch((e) => out({ thrown: String((e && e.stack) || e).slice(0, 1200) }));
`);
  const child = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 60000 });
  const line = (child.stdout || '').split('RESULT:')[1];
  if (!line) throw new Error(`the child printed no result: ${(child.stderr || child.stdout || '').slice(-800)}`);
  const r = JSON.parse(line);
  if (r.missing) throw new Error(`${r.missing} doesn't exist yet (ADR graph-operations-first-slice/0021 Implementation notes)`);
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

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
