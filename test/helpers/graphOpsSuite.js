'use strict';
/**
 * What the write path's suites share (story graph-operations-foundation #4, ADR graph-operations-foundation/0004):
 * the callers, a child environment with every service endpoint dead, a run of test/helpers/operationsHarness.js, a
 * graph seeded for test/helpers/graphFake.js, and the suite runner every suite under test/operations/ exports.
 *
 * The seeded graph holds this instance's relationship type concept, `39998:<TA>:relationship-type`, with the TA the
 * child environment sets (TA_PUBKEY), and its elements, each with its json tag as firmware makes them:
 *   - three of firmware's types: HAS_ELEMENT, REFERENCES and AUTHORS (each reserved, ADR Decision 6);
 *   - two an admin declared: CITES and DEPENDS_ON, one of them under a set below the concept's superset;
 *   - one whose json is an LMDB reference (`lmdb:<key>`), when the test gives it a store (lmdb: true): RELIES_ON;
 *   - one whose json doesn't parse (BROKEN's), and one whose json names no alias (NO_ALIAS's);
 * and these nodes, each with a tapestryKey and the shared label: A and B (concept-graph nodes), U (a NostrUser), and
 * G, an existing change entry, which no write may name.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { emptyState, readState, writeState } = require('./graphFake');

const ROOT = path.resolve(__dirname, '..', '..');
const HARNESS = path.join(ROOT, 'test/helpers/operationsHarness.js');
const NL = String.fromCharCode(10);
const OWNER = 'aa'.repeat(32);
const ADMIN = 'bb'.repeat(32);
const STRANGER = 'cc'.repeat(32);
const TA = 'dd'.repeat(32);
const DEAD = 'http://127.0.0.1:9';
const HANDLE = `39998:${TA}:relationship-type`;
const SPAWN = { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };

const temps = [];
function tmp(prefix) { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); temps.push(d); return d; }
function cleanup() { while (temps.length) { try { fs.rmSync(temps.pop(), { recursive: true, force: true }); } catch { /* best effort */ } } }

function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (x) => JSON.stringify(x);

/** An environment with the owner and the admin configured, the TA set, and every service endpoint dead. */
function childEnv(dir) {
  const conf = path.join(dir, 'brainstorm.conf');
  const settings = path.join(dir, 'settings.json');
  fs.writeFileSync(conf, [
    `export BRAINSTORM_OWNER_PUBKEY="${OWNER}"`,
    'export NEO4J_URI="bolt://127.0.0.1:9"',
    'export REDIS_HOST="127.0.0.1"',
    'export REDIS_PORT="9"',
  ].join(NL) + NL);
  fs.writeFileSync(settings, JSON.stringify({ adminPubkeys: [ADMIN] }));
  const env = {
    ...process.env,
    BRAINSTORM_CONF_PATH: conf,
    TAPESTRY_SETTINGS_PATH: settings,
    BRAINSTORM_BASE_DIR: dir,
    TAPESTRY_LMDB_PATH: path.join(dir, 'lmdb'),
    TAPESTRY_BACKUPS_DIR: path.join(dir, 'backups'),
    BRAINSTORM_BASE_URL: DEAD,
    TAPESTRY_BASE: DEAD,
    MEILI_URL_HOST: DEAD,
    TA_PUBKEY: TA,
    // Every service endpoint dead here as well as in the conf, so nothing can fall back to a live instance's.
    NEO4J_URI: 'bolt://127.0.0.1:9',
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '9',
    HOME: dir,
  };
  delete env.TASK_QUEUE_ENABLED;
  return env;
}

/** Run the harness on `spec` in a child process; { child, data, dir }. */
function runHarness(spec, { dir = tmp('graph-ops-'), env = null } = {}) {
  const specFile = path.join(dir, 'spec.json');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(specFile, JSON.stringify({ owner: OWNER, admin: ADMIN, stranger: STRANGER, timeoutMs: 100000, ...spec }));
  const child = spawnSync(process.execPath, [HARNESS, specFile, outFile], { ...SPAWN, cwd: ROOT, env: env || childEnv(dir), timeout: 120000 });
  let data = null;
  try { data = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported by the caller */ }
  return { child, data, dir };
}

/**
 * What the harness answered: its scenarios' requests by id, its commands by id, the spy's record and its own error,
 * if it stopped partway. `req(id)` and `cmd(id)` throw, naming that error, when the one asked for never ran.
 */
function answered(r) {
  assert(r.data, `the harness wrote no result: ${(r.child.stderr || '').split(NL).slice(-8).join(' | ')}`);
  const requests = {};
  const cli = {};
  for (const s of r.data.scenarios || []) {
    for (const q of s.requests) requests[q.id] = q;
    for (const c of s.cli) cli[c.id] = c;
  }
  const error = r.data.error || null;
  const req = (id) => { assert(requests[id], `request ${id} never ran${error ? `: the harness stopped: ${error}` : ''}`); return requests[id]; };
  const cmd = (id) => { assert(cli[id], `command ${id} never ran${error ? `: the harness stopped: ${error}` : ''}`); return cli[id]; };
  return { requests, cli, spy: r.data.spy || null, error, req, cmd };
}

// ── a seeded graph ──
const key = () => crypto.randomUUID();

/**
 * A state for test/helpers/graphFake.js, with the relationship type concept and the nodes above.
 * @returns {{ state, keys: { A, B, U, G }, file: (dir) => string }}
 */
function seedGraph({ lmdbKey = null, extraDeclared = [], noConcept = false } = {}) {
  const s = emptyState();
  const add = (labels, props) => { const n = { eid: s.nextEid++, labels, props }; s.nodes.push(n); return n; };
  const link = (from, type, to) => { s.rels.push({ eid: s.nextEid++, type, from: from.eid, to: to.eid, props: {} }); };
  const element = (holder, { slug, name, alias, category = 'custom', json }) => {
    const e = add(['NostrEvent', 'ListItem', 'TapestryNode'], { uuid: `39999:${TA}:${slug.toLowerCase()}`, name, slug, tapestryKey: key() });
    const value = json !== undefined ? json : JSON.stringify({
      word: { slug, name, wordTypes: ['word', 'relationshipType'] },
      relationshipType: { slug, alias, name, category, nodeFromType: 'node', nodeToType: 'node' },
    });
    const tag = add(['NostrEventTag'], { type: 'json', value });
    link(e, 'HAS_TAG', tag);
    link(holder, 'HAS_ELEMENT', e);
    return e;
  };
  if (!noConcept) {
    const header = add(['NostrEvent', 'ListHeader', 'ConceptHeader', 'TapestryNode'], { uuid: HANDLE, name: 'relationship type', tapestryKey: key() });
    const superset = add(['NostrEvent', 'ListItem', 'Superset', 'TapestryNode'], { uuid: `39999:${TA}:relationship-type-superset`, name: 'relationship types', tapestryKey: key() });
    link(header, 'IS_THE_CONCEPT_FOR', superset);
    const custom = add(['Set', 'TapestryNode'], { uuid: `39999:${TA}:custom-relationship-types`, name: 'custom relationship types', tapestryKey: key() });
    link(superset, 'IS_A_SUPERSET_OF', custom);
    element(superset, { slug: 'CLASS_THREAD_TERMINATION', name: 'class thread termination', alias: 'HAS_ELEMENT', category: 'classThread' });
    element(superset, { slug: 'REFERENCES', name: 'references', alias: 'REFERENCES', category: 'nostr' });
    element(superset, { slug: 'AUTHORS', name: 'authors', alias: 'AUTHORS', category: 'nostr' });
    element(superset, { slug: 'CITES', name: 'cites', alias: 'CITES' });
    element(custom, { slug: 'DEPENDS_ON', name: 'depends on', alias: 'DEPENDS_ON' });
    element(superset, { slug: 'BROKEN', name: 'broken', alias: 'BROKEN', json: '{"relationshipType": {"alias": "BROK' });
    element(superset, { slug: 'NO_ALIAS', name: 'no alias', alias: 'NO_ALIAS', json: JSON.stringify({ word: { slug: 'NO_ALIAS', name: 'no alias' }, relationshipType: { slug: 'NO_ALIAS', name: 'no alias' } }) });
    if (lmdbKey) element(superset, { slug: 'RELIES_ON', name: 'relies on', alias: 'RELIES_ON', json: `lmdb:${lmdbKey}` });
    for (const d of extraDeclared) element(superset, d);
  }
  const A = add(['NostrEvent', 'ListItem', 'TapestryNode'], { uuid: `39999:${TA}:node-a`, name: 'node a', tapestryKey: key() });
  const B = add(['NostrEvent', 'ListItem', 'TapestryNode'], { uuid: `39999:${TA}:node-b`, name: 'node b', tapestryKey: key() });
  const U = add(['NostrUser', 'TapestryNode'], { pubkey: 'ee'.repeat(32), tapestryKey: key() });
  const G = add(['GraphChange', 'TapestryNode'], {
    tapestryKey: key(), at: '2026-01-01T00:00:00.000Z', byRole: 'owner', byPubkey: OWNER, operation: 'graph add-relationship',
    keys: [], changes: '[]',
  });
  const keys = { A: A.props.tapestryKey, B: B.props.tapestryKey, U: U.props.tapestryKey, G: G.props.tapestryKey };
  return {
    state: s,
    keys,
    /** Write the state to <dir>/graph.json and return its path. */
    file(dir) { const f = path.join(dir, 'graph.json'); writeState(f, s); return f; },
  };
}

/** The relationships of `type` in a state, as { from, to } by tapestryKey. */
function relsOf(s, type) {
  const keyOf = (eid) => (s.nodes.find((n) => n.eid === eid) || { props: {} }).props.tapestryKey;
  return s.rels.filter((r) => r.type === type).map((r) => ({ from: keyOf(r.from), to: keyOf(r.to) }));
}
/** The change entries in a state, newest last as they were made, with `changes` parsed. */
function entriesOf(s) {
  return s.nodes.filter((n) => n.labels.includes('GraphChange')).map((n) => {
    let changes = n.props.changes;
    try { changes = JSON.parse(n.props.changes); } catch { /* left as it is */ }
    return { labels: n.labels, ...n.props, changes };
  });
}

/** The suite runner every suite under test/operations/ exports (ADR graph-operations-foundation/0001 Decision 12). */
function makeSuite(title) {
  const tests = [];
  function test(name, fn) { tests.push([name, fn]); }
  async function run() {
    console.log(`${NL}=== ${title} ===`);
    let pass = 0, fail = 0, skipped = 0;
    const failures = [];
    for (const [name, fn] of tests) {
      try {
        const r = await fn();
        if (r === 'skip') { console.log(`  SKIP  ${name}`); skipped++; } else { console.log(`  PASS  ${name}`); pass++; }
      } catch (err) {
        console.log(`  FAIL  ${name}${NL}        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
      }
    }
    cleanup();
    console.log(`${NL}${title}: ${pass} passed, ${fail} failed, ${skipped} skipped`);
    return { pass, fail, failures, skipped };
  }
  return { test, run };
}

module.exports = {
  ROOT, NL, OWNER, ADMIN, STRANGER, TA, HANDLE, DEAD,
  tmp, assert, show, childEnv, runHarness, answered, seedGraph, relsOf, entriesOf, readState, makeSuite,
};
