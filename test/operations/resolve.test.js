'use strict';
/**
 * The resolution, src/operations/resolve.js — its own suite, run by test/operations.test.js.
 *   Story: engineering-team/stories/graph-operations-first-slice/9-resolve.md (AC1, AC5, AC7)
 *   ADR:   engineering-team/decisions/graph-operations-first-slice/0009-resolve-and-naming-a-node.md
 *          (Decision 1: a ref, read; Decision 5: resolveOne; Implementation notes: the exports; Amendment 1)
 *
 * Stack-free. The module is required in a child process with the harness's environment (the owner, the TA and every
 * service endpoint dead: test/helpers/graphOpsSuite.js's childEnv), and called over the graph
 * test/helpers/resolveGraph.js seeds, its reads through graphFake's readerOver. Only what the ADR pins is checked: the
 * exports, the inputs and refusals, how a ref is read, and what resolveOne gives or refuses. How it gets there is the
 * Implementer's.
 *
 *   RS1  it exports the inputs, the refusals, the schemas and the functions the ADR names
 *   RS2  bad-ref is a 400, unknown-ref a 404 and ambiguous-ref a 409, each saying when
 *   RS3  REF_INPUT is required text of at most 1,000 characters; KIND_INPUT is concept or set; refInput(description)
 *        gives REF_INPUT's schema with that description
 *   RS4  READING is { as, value }; CANDIDATE is NODE's five facts with kind and matched added and required
 *   RS5  readingsOf reads a ref by its shape: a key, an address, an event id and a NIP-19 identifier only as what they
 *        are; anything else as a name, and as a slug when it has a slug's shape
 *   RS6  readingsOf refuses bad-ref, naming the input it is given, for an empty ref and each character create-concept
 *        refuses; not for a name in another script, a long one, or one with no slug
 *   RS7  resolveOne gives a tapestryKey back as given, with no read
 *   RS8  resolveOne gives the key of the one node a ref names from the point of view, narrowed by kind
 *   RS9  resolveOne refuses unknown-ref, naming the input, when nothing counts, and says how many were left out
 *   RS10 resolveOne refuses ambiguous-ref, naming the input, with up to 10 candidates and `more` when there are others
 *   RS11 loading it opens nothing: no Neo4j driver and no nostr-tools
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const S = require('../helpers/graphOpsSuite');

const { ROOT, TA, assert, show, tmp } = S;
const { test, run } = S.makeSuite('operations: the resolution (resolve.js)');

const CANDIDATE_KEYS = ['address', 'author', 'kind', 'matched', 'name', 'own', 'tapestryKey'];
const missing = () => new Error('src/operations/resolve.js does not exist yet (ADR graph-operations-first-slice/0009 Decisions 1–3 and 5)');

/** The child's script: it requires resolve.js, runs every check and prints its findings as one JSON line. */
const SCRIPT = `
'use strict';
const path = require('path');
const ROOT = ${JSON.stringify(ROOT)};
const TA = ${JSON.stringify(TA)};
const out = {};
const done = () => { process.stdout.write('RESULT:' + JSON.stringify(out) + '\\n'); };
const loaded = (name) => Object.keys(require.cache).some((p) => p.includes(path.sep + name + path.sep));
let RS;
try {
  RS = require(path.join(ROOT, 'src/operations/resolve.js'));
} catch (e) {
  out.missing = /Cannot find module/.test(String(e && e.message)) && String(e.message).includes('resolve.js');
  out.loadError = String((e && e.message) || e).split('\\n')[0];
  done();
  process.exit(0);
}
out.atLoad = { driver: loaded('neo4j-driver'), nostrTools: loaded('nostr-tools') };
const R = require(path.join(ROOT, 'src/operations/reads.js'));
const { readerOver } = require(path.join(ROOT, 'test/helpers/graphFake.js'));
const { seedResolve, EVENT_ID, PEERS, GOU } = require(path.join(ROOT, 'test/helpers/resolveGraph.js'));
const NT = require(require.resolve('nostr-tools', { paths: [ROOT] }));
const wrap = (x) => (x === undefined ? null : x);
const caught = (fn) => { try { return { threw: false, value: fn() }; } catch (e) { return { threw: true, isRefusal: !!(e && e.isRefusal), code: e && e.code, extra: e && e.extra, message: e && e.message }; } };
const caughtAsync = async (fn) => { try { return { threw: false, value: await fn() }; } catch (e) { return { threw: true, isRefusal: !!(e && e.isRefusal), code: e && e.code, extra: e && e.extra, message: e && e.message }; } };
const BEL = String.fromCharCode(0x07);
const RLO = String.fromCharCode(0x202e);
const ZWSP = String.fromCharCode(0x200b);

(async () => {
  out.exports = Object.fromEntries(Object.entries(RS).map(([k, v]) => [k, typeof v]));
  out.inputs = { ref: wrap(RS.REF_INPUT), kind: wrap(RS.KIND_INPUT), refInput: typeof RS.refInput === 'function' ? wrap(RS.refInput('The node to read')) : null };
  out.refusals = { bad: wrap(RS.BAD_REF), unknown: wrap(RS.UNKNOWN_REF), ambiguous: wrap(RS.AMBIGUOUS_REF) };
  out.schemas = { reading: wrap(RS.READING), candidate: wrap(RS.CANDIDATE), node: R.NODE };

  const naddr = NT.nip19.naddrEncode({ kind: 39998, pubkey: TA, identifier: 'dog' });
  const badNaddr = naddr.slice(0, -1) + (naddr.endsWith('q') ? 'p' : 'q');
  const npub = NT.nip19.npubEncode(PEERS.hi);
  out.cases = { naddr, badNaddr, npub };
  const cases = {
    key: '0f0f0f0f-0000-4000-8000-000000000001',
    address: '39998:' + TA.toUpperCase() + ':Dog',
    emptyD: '39998:' + TA + ':',
    eventId: EVENT_ID.toUpperCase(),
    naddr,
    note: NT.nip19.noteEncode(EVENT_ID),
    nevent: NT.nip19.neventEncode({ id: EVENT_ID }),
    badNaddr,
    npub,
    spaced: 'Dog Breed',
    spaces: '  dog   breed  ',
    slug: 'dog-breed',
    upperSlug: 'Dog-Breed',
    nonce: 'cat~1',
    word: 'dog',
    gou: GOU,
    colon: 'a:b',
    shortPubkey: '39998:abc:dog',
    dashes: '---',
    long: 'x'.repeat(300) + ' y',
  };
  out.readings = {};
  for (const [k, ref] of Object.entries(cases)) {
    const r = caught(() => RS.readingsOf(ref, 'ref'));
    out.readings[k] = r.threw ? r : { family: r.value && r.value.family, readings: r.value && r.value.readings };
  }
  out.bad = {};
  for (const [k, ref] of Object.entries({ empty: '', spaces: '   ', control: 'dog' + BEL, bidi: RLO + 'dog', invisible: 'do' + ZWSP + 'g' })) {
    out.bad[k] = caught(() => RS.readingsOf(ref, 'concept'));
  }

  const seed = seedResolve();
  const read = readerOver(seed.state);
  const owner = await R.resolvePov(read, 'owner');
  const everyone = await R.resolvePov(read, 'everyone');
  out.keys = seed.keys;
  out.itemKeys = seed.itemKeys;
  let calls = 0;
  const counting = async (q, p) => { calls++; return read(q, p); };
  const one = (input, ref, kind, pov, reader = read) => caughtAsync(() => RS.resolveOne(reader, { input, ref, kind, pov }));
  out.one = {};
  out.one.key = await one('concept', seed.keys.rex, 'concept', owner, counting);
  out.one.keyReads = calls;
  out.one.breed = await one('concept', 'dog-breed', 'concept', owner);
  out.one.naddr = await one('concept', naddr, 'concept', owner);
  out.one.rexOwner = await one('from', 'rex', 'node', owner);
  out.one.dogConcept = await one('concept', 'dog', 'concept', owner);
  out.one.walkersSet = await one('parent', 'walkers', 'set', owner);
  out.one.rexEveryone = await one('from', 'rex', 'node', everyone);
  out.one.dogNode = await one('node', 'dog', 'node', owner);
  out.one.items = await one('node', 'item', 'node', owner);
  out.one.adminNote = await one('node', 'admin note', 'node', owner);
  out.one.nothing = await one('node', 'no such thing', 'node', owner);
  out.one.badRef = await one('parent', 'do' + ZWSP + 'g', 'set', owner);
  done();
})().catch((e) => { out.crash = String((e && e.stack) || e); done(); });
`;

let RESULT = null;
function result() {
  if (RESULT) return RESULT;
  const dir = tmp('resolve-module-');
  const file = path.join(dir, 'check.js');
  fs.writeFileSync(file, SCRIPT);
  const child = spawnSync(process.execPath, [file], { cwd: ROOT, encoding: 'utf8', env: S.childEnv(dir), timeout: 60000 });
  const line = (child.stdout || '').split('RESULT:')[1];
  RESULT = line ? JSON.parse(line) : { crash: `no result: ${(child.stderr || '').slice(-600)}` };
  return RESULT;
}
function need() {
  const r = result();
  if (r.missing) throw missing();
  assert(!r.loadError && !r.crash, `resolve.js loads and its checks run; got ${show(r.loadError || r.crash)}`);
  return r;
}
const refusedWith = (x, code, input, label) => {
  assert(x && x.threw && x.isRefusal && x.code === code, `${label}: refused ${code}; got ${show(x)}`);
  assert(x.extra && x.extra.input === input, `${label}: the refusal names the input ${input}; got ${show(x.extra)}`);
  assert(typeof x.message === 'string' && x.message.length > 0, `${label}: the refusal says in words what was wrong`);
  return x;
};

test('RS1: it exports the inputs, the refusals, the schemas and the functions the ADR names', () => {
  const r = need();
  const want = {
    REF_INPUT: 'object', KIND_INPUT: 'object', refInput: 'function',
    BAD_REF: 'object', UNKNOWN_REF: 'object', AMBIGUOUS_REF: 'object',
    READING: 'object', CANDIDATE: 'object',
    readingsOf: 'function', candidatesOf: 'function', candidateOf: 'function', resolveOne: 'function',
  };
  for (const [name, type] of Object.entries(want)) assert(r.exports[name] === type, `resolve.js exports ${name} (${type}); got ${show(r.exports[name])}`);
});

test('RS2: bad-ref is a 400, unknown-ref a 404 and ambiguous-ref a 409, each saying when', () => {
  const r = need();
  for (const [k, code, status] of [['bad', 'bad-ref', 400], ['unknown', 'unknown-ref', 404], ['ambiguous', 'ambiguous-ref', 409]]) {
    const x = r.refusals[k];
    assert(x && x.code === code && x.status === status && typeof x.when === 'string' && x.when.length > 0, `${code}: { code, status ${status}, when }; got ${show(x)}`);
  }
});

test('RS3: REF_INPUT is required text of at most 1,000 characters; KIND_INPUT is concept or set; refInput takes the same schema', () => {
  const r = need();
  const ref = r.inputs.ref;
  assert(ref && ref.required === true && ref.schema && ref.schema.type === 'string' && ref.schema.maxLength === 1000 && ref.schema.minLength === undefined && typeof ref.description === 'string',
    `REF_INPUT: { schema: { type: 'string', maxLength: 1000 }, required: true, description }, with no minLength, so an empty ref meets bad-ref; got ${show(ref)}`);
  const kind = r.inputs.kind;
  assert(kind && kind.schema && kind.schema.type === 'string' && show(kind.schema.enum) === show(['concept', 'set']) && !kind.required, `KIND_INPUT: concept or set, not required; got ${show(kind)}`);
  const adopted = r.inputs.refInput;
  assert(adopted && show(adopted.schema) === show(ref.schema) && adopted.description === 'The node to read', `refInput(description) gives REF_INPUT's schema with that description; got ${show(adopted)}`);
});

test('RS4: READING is { as, value }; CANDIDATE is NODE\'s five facts with kind and matched added and required', () => {
  const r = need();
  const reading = r.schemas.reading;
  assert(reading && reading.type === 'object' && reading.properties && reading.properties.as && reading.properties.value, `READING has as and value; got ${show(reading)}`);
  assert(show([...reading.properties.as.enum].sort()) === show(['address', 'name', 'slug', 'tapestryKey']), `a reading is as a tapestryKey, an address, a name or a slug; got ${show(reading.properties.as)}`);
  const cand = r.schemas.candidate;
  const node = r.schemas.node;
  assert(cand && cand.properties, `CANDIDATE is an object schema; got ${show(cand)}`);
  for (const [fact, schema] of Object.entries(node.properties)) assert(show(cand.properties[fact]) === show(schema), `CANDIDATE keeps NODE's ${fact}; got ${show(cand.properties[fact])}`);
  assert(show([...cand.properties.kind.enum].sort()) === show(['concept', 'node', 'set', 'superset']), `a candidate's kind is concept, superset, set or node; got ${show(cand.properties.kind)}`);
  assert(cand.properties.matched.type === 'array' && show([...cand.properties.matched.items.enum].sort()) === show(['address', 'd-tag', 'name', 'plural', 'slug', 'tapestryKey']), `matched lists tapestryKey, address, name, plural, slug or d-tag; got ${show(cand.properties.matched)}`);
  for (const fact of [...node.required, 'kind', 'matched']) assert(cand.required.includes(fact), `CANDIDATE requires ${fact}; got ${show(cand.required)}`);
});

test('RS5: readingsOf reads a ref by its shape', () => {
  const r = need();
  const { naddr, badNaddr, npub } = r.cases;
  const want = {
    key: ['key', [{ as: 'tapestryKey', value: '0f0f0f0f-0000-4000-8000-000000000001' }]],
    address: ['address', [{ as: 'address', value: `39998:${TA}:Dog` }]],
    emptyD: ['address', [{ as: 'address', value: `39998:${TA}:` }]],
    eventId: ['address', [{ as: 'address', value: 'e1'.repeat(32) }]],
    naddr: ['address', [{ as: 'address', value: `39998:${TA}:dog` }]],
    note: ['address', [{ as: 'address', value: 'e1'.repeat(32) }]],
    nevent: ['address', [{ as: 'address', value: 'e1'.repeat(32) }]],
    badNaddr: ['name', [{ as: 'name', value: badNaddr }, { as: 'slug', value: badNaddr }]],
    npub: ['name', [{ as: 'name', value: npub }, { as: 'slug', value: npub }]],
    spaced: ['name', [{ as: 'name', value: 'Dog Breed' }]],
    spaces: ['name', [{ as: 'name', value: 'dog breed' }]],
    slug: ['name', [{ as: 'name', value: 'dog-breed' }, { as: 'slug', value: 'dog-breed' }]],
    upperSlug: ['name', [{ as: 'name', value: 'Dog-Breed' }, { as: 'slug', value: 'dog-breed' }]],
    nonce: ['name', [{ as: 'name', value: 'cat~1' }, { as: 'slug', value: 'cat~1' }]],
    word: ['name', [{ as: 'name', value: 'dog' }, { as: 'slug', value: 'dog' }]],
    gou: ['name', [{ as: 'name', value: String.fromCodePoint(0x72d7) }]],
    colon: ['name', [{ as: 'name', value: 'a:b' }]],
    shortPubkey: ['name', [{ as: 'name', value: '39998:abc:dog' }]],
    dashes: ['name', [{ as: 'name', value: '---' }]],
    long: ['name', [{ as: 'name', value: `${'x'.repeat(300)} y` }]],
  };
  assert(typeof naddr === 'string', 'the child made an naddr');
  for (const [k, [family, readings]] of Object.entries(want)) {
    const got = r.readings[k];
    assert(got && !got.threw && got.family === family && show(got.readings) === show(readings), `${k}: read as ${family}, ${show(readings)}; got ${show(got)}`);
  }
});

test('RS6: readingsOf refuses bad-ref, naming the input, for an empty ref and each character create-concept refuses, and names the character', () => {
  const r = need();
  for (const k of ['empty', 'spaces']) refusedWith(r.bad[k], 'bad-ref', 'concept', k);
  for (const [k, point] of [['control', 'U+0007'], ['bidi', 'U+202E'], ['invisible', 'U+200B']]) {
    const x = refusedWith(r.bad[k], 'bad-ref', 'concept', k);
    assert(x.message.includes(point), `${k}: the refusal names the character, ${point}; got ${show(x.message)}`);
  }
  for (const k of ['gou', 'long', 'dashes']) assert(r.readings[k] && !r.readings[k].threw, `${k} is not refused: create-concept's 200-character and slug rules are for making a concept's name; got ${show(r.readings[k])}`);
});

test('RS7: resolveOne gives a tapestryKey back as given, with no read', () => {
  const r = need();
  const x = r.one.key;
  assert(x && !x.threw && x.value === r.keys.rex, `rex's key comes back as given, though rex is no concept: the operation's own checks answer for a key; got ${show(x)}`);
  assert(r.one.keyReads === 0, `and nothing is read for it; got ${r.one.keyReads} reads`);
});

test('RS8: resolveOne gives the key of the one node a ref names from the point of view, narrowed by kind', () => {
  const r = need();
  for (const [k, name, why] of [
    ['breed', 'breed', 'dog-breed as a concept'],
    ['naddr', 'dog', 'dog\'s naddr as a concept'],
    ['rexOwner', 'rex', 'rex from the owner\'s point of view, which leaves lo\'s rex out'],
    ['dogConcept', 'dog', 'dog as a concept, though an element is named Dog'],
    ['walkersSet', 'walkers', 'walkers as a set, though a card set is named walkers'],
  ]) {
    const x = r.one[k];
    assert(x && !x.threw && x.value === r.keys[name], `${why}: ${name}'s key; got ${show(x)}`);
  }
});

test('RS9: resolveOne refuses unknown-ref, naming the input, when nothing counts, and says how many were left out', () => {
  const r = need();
  const left = refusedWith(r.one.adminNote, 'unknown-ref', 'node', 'admin note from the owner\'s point of view');
  assert(/\b1\b/.test(left.message) && /tapestryKey/.test(left.message), `the message says one was left out, and that a tapestryKey names a node whatever the point of view; got ${show(left.message)}`);
  refusedWith(r.one.nothing, 'unknown-ref', 'node', 'a ref that names nothing');
  refusedWith(r.one.badRef, 'bad-ref', 'parent', 'a ref with an invisible character');
});

test('RS10: resolveOne refuses ambiguous-ref, naming the input, with up to 10 candidates and more when there are others', () => {
  const r = need();
  const rex = refusedWith(r.one.rexEveryone, 'ambiguous-ref', 'from', 'rex from everyone\'s point of view');
  const cands = rex.extra.candidates;
  assert(Array.isArray(cands) && show(cands.map((c) => c.tapestryKey).sort()) === show([r.keys.rex, r.keys.peerRex].sort()), `the refusal carries both candidates; got ${show(cands)}`);
  for (const c of cands) assert(show(Object.keys(c).sort()) === show(CANDIDATE_KEYS), `each candidate as graph resolve answers one; got ${show(c)}`);
  assert(rex.extra.more === false, `more is false when every candidate is carried; got ${show(rex.extra.more)}`);
  const dog = refusedWith(r.one.dogNode, 'ambiguous-ref', 'node', 'dog as any node');
  assert(show(dog.extra.candidates.map((c) => c.tapestryKey).sort()) === show([r.keys.dog, r.keys.dogItem].sort()), `dog names the concept and the element Dog; got ${show(dog.extra.candidates)}`);
  const items = refusedWith(r.one.items, 'ambiguous-ref', 'node', 'item, which names 120 nodes');
  assert(items.extra.candidates.length === 10 && items.extra.more === true, `up to 10 candidates, and more is true; got ${items.extra.candidates.length} and ${show(items.extra.more)}`);
  assert(show(items.extra.candidates.map((c) => c.tapestryKey)) === show(r.itemKeys.slice(0, 10)), 'the first 10 in tapestryKey order');
  assert(/tapestryKey/.test(items.message), `the message says to pass the tapestryKey of the one meant; got ${show(items.message)}`);
});

test('RS11: loading it opens nothing: no Neo4j driver and no nostr-tools', () => {
  const r = need();
  assert(r.atLoad && r.atLoad.driver === false && r.atLoad.nostrTools === false, `resolve.js requires neither the driver nor nostr-tools at load; got ${show(r.atLoad)}`);
});

if (require.main === module) run().then(({ fail }) => process.exit(fail ? 1 : 0));

module.exports = { run };
