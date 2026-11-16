'use strict';
/**
 * POST /api/normalize/create-concept refuses a name this instance's key has already used,
 * and overwrites only when asked to.
 *
 * The duplicate check compared `h.pubkey` to a double-encoded key: getPublicKey returns hex,
 * and Buffer.from(hex).toString('hex') encodes it again, giving 128 characters. It never
 * matched, so a repeat re-signed the replaceable header and its core nodes, replacing the
 * concept's definition and schema while its items stayed. Firmware install relies on that
 * rebuild (a reinstall rebuilds the header from the built-in definition), so it asks for it
 * with `overwrite: true`.
 *
 *   S-class (source assertions, stack-free): the check uses the key as it is, and the callers
 *     that rebuild on purpose ask to overwrite.
 *
 *   H-class (live, SKIP unless $TAPESTRY_CONTAINER names a container other than `tapestry`):
 *     every request rides container loopback. Point it at a throwaway instance, such as
 *     scripts/scratch-stack.sh gives you: its fixtures stay in that instance's strfry.
 *     The reinstall test also needs CREATE_CONCEPT_REINSTALL=1.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loopbackRequest, describeResponse } = require('./helpers/stackHttp');

const ROOT = path.resolve(__dirname, '..');
const NORMALIZE = path.join(ROOT, 'src/api/normalize/index.js');
const FIRMWARE_INSTALL = path.join(ROOT, 'src/firmware/install.js');

const CONTAINER = process.env.TAPESTRY_CONTAINER;
const LIVE = Boolean(CONTAINER) && CONTAINER !== 'tapestry';
const REINSTALL = LIVE && process.env.CREATE_CONCEPT_REINSTALL === '1';
const BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function post(route, body, timeoutS) {
  return loopbackRequest({ container: CONTAINER, method: 'POST', url: `${BASE}${route}`, body, ...(timeoutS ? { timeoutS } : {}) });
}

/** A concept's definition and schema properties, read back from the instance. */
function readConcept(handle) {
  const r = loopbackRequest({ container: CONTAINER, url: `${BASE}/api/concept-graph/node/${encodeURIComponent(handle)}/core-nodes` });
  assert(r.status === 200 && r.json && r.json.found, `couldn't read ${handle}: ${describeResponse(r)}`);
  const { header, schema } = r.json.nodes;
  return {
    definition: header.json.conceptHeader.description,
    schema: JSON.stringify(schema.json.jsonSchema),
  };
}

const NAME = `duplicate check ${crypto.randomBytes(4).toString('hex')}`;
let handle = null;

const tests = [
  ['S1: the duplicate check uses the key as getPublicKey returns it', () => {
    const src = fs.readFileSync(NORMALIZE, 'utf8');
    const start = src.indexOf('async function handleCreateConcept');
    const end = src.indexOf('const allEvents', start);
    assert(start !== -1 && end !== -1, 'handleCreateConcept not found');
    const slice = src.slice(start, end);
    assert(!/Buffer\.from\([^\n]*getPublicKey/.test(slice), 'the check still encodes the hex key a second time, so it can never match');
    assert(/const pubkey = nt\(\)\.getPublicKey\(privBytes\)/.test(slice), 'the check should compare the key as getPublicKey returns it');
  }],

  ['S2: firmware install asks to overwrite, so a reinstall still rebuilds headers', () => {
    const src = fs.readFileSync(FIRMWARE_INSTALL, 'utf8');
    const at = src.indexOf("apiPost('/api/normalize/create-concept'");
    assert(at !== -1, 'firmware install no longer calls create-concept');
    assert(/overwrite:\s*true/.test(src.slice(at, at + 500)), 'firmware install must pass overwrite: true, or a reinstall skips every existing concept');
  }],

  ['S3: the self-provisioning brain concepts keep repairing a header that has no superset', () => {
    const src = fs.readFileSync(NORMALIZE, 'utf8');
    const calls = src.split('invokeNormalizeHandler(handleCreateConcept, {').slice(1);
    assert(calls.length > 0, 'no self-provisioning callers found');
    for (const call of calls) {
      assert(/overwrite:\s*true/.test(call.slice(0, call.indexOf('});'))), 'a self-provisioning caller lost overwrite: true, so it would fail on a header with no superset');
    }
  }],

  ['H1: a repeat is refused, and leaves the definition and schema as they were', () => {
    if (!LIVE) return 'SKIP';
    const made = post('/api/normalize/create-concept', { name: NAME, description: 'The first definition.' });
    assert(made.status === 200 && made.json && made.json.success, `the first create failed: ${describeResponse(made)}`);
    handle = made.json.concept.uuid;
    const key = made.json.concept.primaryPropertyKey;
    const saved = post('/api/normalize/save-schema', {
      concept: NAME,
      schema: { type: 'object', properties: { [key]: { type: 'object', properties: { name: { type: 'string' }, breed: { type: 'string' } } } } },
    });
    assert(saved.status === 200 && saved.json && saved.json.success, `save-schema failed: ${describeResponse(saved)}`);
    const before = readConcept(handle);
    assert(/breed/.test(before.schema), 'the fixture schema should name breed');

    const repeat = post('/api/normalize/create-concept', { name: NAME, description: 'A second definition.' });
    assert(repeat.json && repeat.json.success === false, `the repeat should be refused: ${describeResponse(repeat)}`);
    assert(/already exists/.test(repeat.json.error), `the refusal should say so: ${repeat.json.error}`);

    const after = readConcept(handle);
    assert(after.definition === 'The first definition.', `the definition changed to: ${after.definition}`);
    assert(after.schema === before.schema, 'the schema changed');
  }],

  ['H2: overwrite: true replaces the concept when a caller asks', () => {
    if (!LIVE) return 'SKIP';
    assert(handle, 'H1 made no fixture');
    const r = post('/api/normalize/create-concept', { name: NAME, description: 'Rebuilt on purpose.', overwrite: true });
    assert(r.status === 200 && r.json && r.json.success, `the overwrite failed: ${describeResponse(r)}`);
    assert(readConcept(handle).definition === 'Rebuilt on purpose.', 'the definition should be replaced');
  }],

  ['H3: a firmware reinstall rebuilds an edited firmware header from its built-in definition', () => {
    if (!REINSTALL) return 'SKIP';
    const dog = post('/api/normalize/create-concept', { name: 'dog', description: 'Edited by a test.', dTag: 'dog', overwrite: true });
    assert(dog.json && dog.json.success, `editing dog failed: ${describeResponse(dog)}`);
    assert(readConcept(dog.json.concept.uuid).definition === 'Edited by a test.', 'the edit should show');
    const installed = post('/api/firmware/install', {}, 600);
    assert(installed.status === 200, `the reinstall failed: ${describeResponse(installed)}`);
    assert(readConcept(dog.json.concept.uuid).definition === 'Dog is a concept.', 'the reinstall should restore the built-in definition');
  }],
];

function removeFixture() {
  if (!handle) return;
  post('/api/neo4j/query', { cypher: 'MATCH (n:NostrEvent) WHERE n.uuid CONTAINS $slug DETACH DELETE n', params: { slug: NAME.replaceAll(' ', '-') } });
}

async function run() {
  let pass = 0;
  let fail = 0;
  let skipped = 0;
  const failures = [];
  try {
    for (const [name, fn] of tests) {
      try {
        if (fn() === 'SKIP') {
          console.log(`  SKIP  ${name}`);
          skipped++;
        } else {
          console.log(`  PASS  ${name}`);
          pass++;
        }
      } catch (err) {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
      }
    }
  } finally {
    removeFixture();
  }
  console.log(`\ncreate-concept-duplicate-check: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
