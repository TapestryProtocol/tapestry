'use strict';
/**
 * Tests for Story 7 (epic tagging-edges) — the evidence fixture: the script that makes a held list of relationships
 * created only for a test, checks the held list is exactly theirs, and takes them out again.
 *
 * Story: engineering-team/stories/tagging-edges/7-confirm-held-removals.md — § Open questions, "Evidence": every held
 *        list made only of relationships created for the test; no tagging on any relay touched, nothing published or
 *        deleted on a relay; no real person shown tagging or tagged; nothing from before the test changed or removed;
 *        "Before the owner confirms, the held list is checked to be exactly the test's"; "everything it created is
 *        taken out again afterwards"; about 810 needed at 2026-11-07's count.
 * ADR:   engineering-team/decisions/tagging-edges/0007-confirm-held-removals.md — § Evidence ("The fixture": two
 *        TaggingEdgesEvidence nodes, never NostrUser; T TAGS between them at addresses under the author ffff…ffff,
 *        not a valid key; T = floor(B / 9) + 1 + max(20, ceil(B / 450)); one transaction. "The script":
 *        scripts/tagging-edges-held-fixture.js, its commands, and "Exports for the Tester: FIXTURE_AUTHOR,
 *        fixtureAddress(run, i), fixtureCount(B), checkHeld(items, {run, count}) and the Cypher strings").
 *
 * Intentionally failing until the implementation lands (red phase): scripts/tagging-edges-held-fixture.js does not
 * exist yet. It is loaded inside each test, so this suite always loads and every test fails on its own.
 *
 * SAFETY. This suite never runs the script's commands. Its tests run in the container too, where brainstorm.conf
 * names the owner's real graph, so a command that ran would write to it. Only the pure exports are called, and
 * the script is loaded with neo4j-driver and the network stubbed, so loading it can reach nothing (HF1).
 *
 * Classes (all HF):
 *   HF1        loading: the exports, and no driver, socket or child process at load.
 *   HF2–HF3    the author and the addresses: not a valid key; tagging-shaped, distinct, the ADR's form.
 *   HF4        the count: T makes the pass hold all T over any base, and is the ADR's formula (833 at 7,313).
 *   HF5–HF6    checkHeld: exactly the fixture's, each not-on-relay; anything else fails.
 *   HF7–HF9    the Cypher and the source: cleanup removes only TaggingEdgesEvidence nodes (DETACH DELETE by run);
 *              creation makes no NostrUser and one statement; anything touching NostrUser only reads; nothing
 *              publishes, deletes on a relay, or confirms.
 *
 * Choices this suite makes where the ADR leaves a detail open:
 *   - checkHeld answers an object whose `ok` is true or false (beside whatever detail it gives).
 *   - "The Cypher strings" are found among the module's exports: every string export, and every string value of a
 *     plain-object export, one level deep. The suite pins what those statements may and must do, not their names.
 *   - fixtureCount(B) must make the pass hold every fixture removal for any B (the fixture's whole purpose; the pass
 *     needs more than 50 removals), so for a small B it may exceed the ADR's formula; wherever the formula gives more
 *     than 50 it is the formula exactly.
 *
 * Hermetic: no graph, network, relay or child process; the script's source is read as text.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const REPO = path.resolve(__dirname, '..');
const SCRIPT = 'scripts/tagging-edges-held-fixture.js';
const EV = 'ADR tagging-edges/0007 § Evidence';
const AUTHOR = 'f'.repeat(64);
// The secp256k1 field prime: an x-only key must be below it (BIP-340 lift_x), so ffff…ffff is no key.
const SECP256K1_P = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F');

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

function forget(rel) {
  let resolved;
  try { resolved = require.resolve(path.join(REPO, rel)); } catch (_) { return; }
  delete require.cache[resolved];
}

/**
 * Load the script with neo4j-driver replaced by a recorder and every socket, HTTP request, fetch and child process
 * refused, so loading it can reach nothing. → { mod, reached: [what it tried at load] }
 */
function loadScript() {
  const abs = path.join(REPO, SCRIPT);
  if (!fs.existsSync(abs)) assert.fail(`${SCRIPT} does not exist yet (${EV}): expected a script exporting FIXTURE_AUTHOR, fixtureAddress(), fixtureCount(), checkHeld() and its Cypher strings`);
  const reached = [];
  const fakeDriver = { driver: (...a) => { reached.push(`neo4j.driver(${String(a[0])})`); throw new Error('no graph in this test'); }, auth: { basic: () => ({}) } };
  const net = require('net');
  const http = require('http');
  const https = require('https');
  const cp = require('child_process');
  const saved = {
    load: Module._load, connect: net.connect, createConnection: net.createConnection, request: http.request, get: http.get,
    srequest: https.request, sget: https.get, spawn: cp.spawn, exec: cp.exec, execFile: cp.execFile, spawnSync: cp.spawnSync,
    execSync: cp.execSync, fetch: global.fetch,
  };
  const refuse = (what) => (...a) => { reached.push(`${what}(${String(a[0]).slice(0, 80)})`); throw new Error(`${what} refused in this test`); };
  Module._load = function (request, parent, isMain) {
    if (request === 'neo4j-driver') return fakeDriver;
    return saved.load.call(this, request, parent, isMain);
  };
  net.connect = refuse('net.connect'); net.createConnection = refuse('net.createConnection');
  http.request = refuse('http.request'); http.get = refuse('http.get');
  https.request = refuse('https.request'); https.get = refuse('https.get');
  cp.spawn = refuse('spawn'); cp.exec = refuse('exec'); cp.execFile = refuse('execFile'); cp.spawnSync = refuse('spawnSync'); cp.execSync = refuse('execSync');
  global.fetch = refuse('fetch');
  let mod;
  try {
    forget(SCRIPT);
    mod = require(abs);
  } catch (e) {
    assert.fail(`${SCRIPT} did not load (${EV}): ${String((e && e.message) || e).split('\n')[0]}; reached at load: ${reached.join('; ') || 'nothing'}`);
  } finally {
    Module._load = saved.load;
    net.connect = saved.connect; net.createConnection = saved.createConnection;
    http.request = saved.request; http.get = saved.get; https.request = saved.srequest; https.get = saved.sget;
    Object.assign(cp, { spawn: saved.spawn, exec: saved.exec, execFile: saved.execFile, spawnSync: saved.spawnSync, execSync: saved.execSync });
    if (saved.fetch === undefined) delete global.fetch; else global.fetch = saved.fetch;
    forget(SCRIPT);
  }
  return { mod, reached };
}
function script() {
  const { mod } = loadScript();
  const missing = ['fixtureAddress', 'fixtureCount', 'checkHeld'].filter((n) => !mod || typeof mod[n] !== 'function');
  if (!mod || typeof mod.FIXTURE_AUTHOR !== 'string') missing.unshift('FIXTURE_AUTHOR');
  if (missing.length) assert.fail(`${SCRIPT} does not export ${missing.join(', ')} yet (${EV} "Exports for the Tester"); it exports ${Object.keys(mod || {}).sort().join(', ') || 'nothing'}`);
  return mod;
}
/** Every Cypher-looking string among the exports, one level into plain objects. */
function cypherStrings(mod) {
  const out = [];
  const looks = (s) => typeof s === 'string' && /\b(MATCH|CREATE|MERGE|DELETE|RETURN|UNWIND)\b/.test(s);
  for (const v of Object.values(mod)) {
    if (looks(v)) out.push(v);
    else if (v && typeof v === 'object' && !Array.isArray(v)) for (const w of Object.values(v)) if (looks(w)) out.push(w);
  }
  return out;
}
const WRITES = /\b(CREATE|MERGE|DELETE|SET|REMOVE|DETACH)\b/;
const sweep = () => require(path.join(REPO, 'src/lib/tagging-edges/sweep.js'));
const RUN = 'te7test';

// ─── HF1 ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test('HF1 — the script exports FIXTURE_AUTHOR, fixtureAddress, fixtureCount and checkHeld, and loading it opens no driver, socket, HTTP request or child process (it runs only when run as a command) (§ Evidence "The script")', () => {
  const { mod, reached } = loadScript();
  assert.deepStrictEqual(reached, [], `loading ${SCRIPT} must reach nothing: it may act only when run as a command (${EV}); at load it reached ${reached.join('; ')}`);
  script();
  assert.ok(cypherStrings(mod).length >= 2, `${SCRIPT} exports its Cypher strings, so their scope can be pinned (${EV} "Exports for the Tester"); found ${cypherStrings(mod).length}`);
});

// ─── HF2–HF3 ───────────────────────────────────────────────────────────────────────────────────────────────────────

test('HF2 — FIXTURE_AUTHOR is ffff…ffff (64 f), which is above the secp256k1 field prime, so it is no key: no tagging and no kind 5 can ever be signed for it, and the pass always finds nothing on the relay there (§ Evidence "The fixture")', () => {
  const { FIXTURE_AUTHOR } = script();
  assert.strictEqual(FIXTURE_AUTHOR, AUTHOR, `the fixture's author is 64 f (${EV}); got ${FIXTURE_AUTHOR}`);
  assert.ok(BigInt(`0x${FIXTURE_AUTHOR}`) >= SECP256K1_P, `the author must be at or above the field prime, so no x-only key has it (${EV})`);
});

test('HF3 — fixtureAddress(run, i) is 39999:<author>:tagging-edges-7-<run>-<i>: a tagging address the pass manages, distinct for each i and each run (§ Evidence "The fixture")', () => {
  const { fixtureAddress } = script();
  const { isTaggingAddress } = sweep();
  assert.strictEqual(fixtureAddress(RUN, 1), `39999:${AUTHOR}:tagging-edges-7-${RUN}-1`, `the address form is the ADR's (${EV}); got ${fixtureAddress(RUN, 1)}`);
  const seen = new Set();
  for (let i = 1; i <= 1000; i++) {
    const a = fixtureAddress(RUN, i);
    assert.ok(isTaggingAddress(a), `${a} must be tagging-shaped, so the pass judges it for removal rather than leaving it in place (${EV}; sweep.js leftReason)`);
    assert.ok(!seen.has(a), `addresses are distinct: ${a} repeats (${EV}; tags_address is unique)`);
    seen.add(a);
  }
  assert.notStrictEqual(fixtureAddress(RUN, 7), fixtureAddress('te7other', 7), `two runs never share an address (${EV})`);
});

// ─── HF4 ───────────────────────────────────────────────────────────────────────────────────────────────────────────

test('HF4 — fixtureCount(B) makes the pass hold all T fixture removals over a base of B + T, for any graph size; it is the ADR\'s formula wherever that gives more than 50, so 7,313 → 833 (§ Evidence "T is floor(B / 9) + 1 + max(20, ceil(B / 450))")', () => {
  const { fixtureCount } = script();
  const { judgeRemovals } = sweep();
  assert.strictEqual(fixtureCount(7313), 833, `at staging's 2026-11-07 count, 833 (${EV}); got ${fixtureCount(7313)}`);
  for (const B of [0, 1, 50, 100, 269, 270, 1000, 7030, 7313, 8146, 20000, 100000]) {
    const T = fixtureCount(B);
    assert.ok(Number.isInteger(T) && T > 0, `fixtureCount(${B}) is a positive whole number (${EV}); got ${T}`);
    const removals = Array.from({ length: T }, (_, i) => ({ address: `39999:${AUTHOR}:x-${i}`, seenEventId: null, reason: 'not-on-relay' }));
    const judged = judgeRemovals({ removals, base: B + T, confirmedHeld: null });
    assert.strictEqual(judged.held.length, T, `with ${T} fixture removals over a base of ${B} + ${T}, the pass must hold all of them (${EV}); it held ${judged.held.length} and applied ${judged.apply.length}`);
    const formula = Math.floor(B / 9) + 1 + Math.max(20, Math.ceil(B / 450));
    if (formula > 50) assert.strictEqual(T, formula, `fixtureCount(${B}) is the ADR's formula, ${formula} (${EV}); got ${T}`);
  }
});

// ─── HF5–HF6 ───────────────────────────────────────────────────────────────────────────────────────────────────────

const item = (address, o = {}) => ({ address, seenEventId: o.seenEventId === undefined ? null : o.seenEventId, reason: o.reason || 'not-on-relay' });
function fixtureItems(fixtureAddress, run, count) {
  return Array.from({ length: count }, (_, i) => item(fixtureAddress(run, i + 1)));
}
function ok(checkHeld, items, opts, why) {
  let r;
  try { r = checkHeld(items, opts); } catch (e) { assert.fail(`checkHeld must answer, not throw (${EV}); it threw ${e && e.message}`); }
  assert.ok(r && typeof r === 'object' && typeof r.ok === 'boolean', `checkHeld answers { ok: true | false, … } (${EV}); got ${JSON.stringify(r)}`);
  return r.ok;
}

test('HF5 — checkHeld passes a held list that is exactly the fixture\'s: every address 1..count of this run, once each, each not-on-relay, in any order (§ Evidence "passes only when … its addresses are exactly the fixture\'s, each not-on-relay")', () => {
  const { checkHeld, fixtureAddress } = script();
  const items = fixtureItems(fixtureAddress, RUN, 60);
  assert.strictEqual(ok(checkHeld, items, { run: RUN, count: 60 }), true, `exactly the fixture's 60: passes (${EV})`);
  assert.strictEqual(ok(checkHeld, items.slice().reverse(), { run: RUN, count: 60 }), true, `in any order: passes (${EV})`);
});

test('HF6 — checkHeld fails anything else: one missing, a real removal joined (all or nothing), a repeat, another reason, another run\'s, a count that differs, an empty list (§ Evidence "A real removal that falls due joins the held list … check fails, the owner does not confirm")', () => {
  const { checkHeld, fixtureAddress } = script();
  const base = fixtureItems(fixtureAddress, RUN, 60);
  const real = item(`39999:${'ab'.repeat(32)}:some-real-tag`, { seenEventId: 'c'.repeat(64) });
  const cases = [
    ['one missing', base.slice(1), 60],
    ['a real removal joined', [...base, real], 60],
    ['a real removal in place of one', [...base.slice(1), real], 60],
    ['a repeat in place of one', [...base.slice(1), base[1]], 60],
    ['a fixture address held for another reason', [...base.slice(1), item(base[0].address, { reason: 'non-tagging' })], 60],
    ['another run\'s fixture', fixtureItems(fixtureAddress, 'te7other', 60), 60],
    ['the count asked for is larger', base, 61],
    ['the count asked for is smaller', base, 59],
    ['an empty list', [], 60],
    ['an item that is not an object', [...base.slice(1), null], 60],
  ];
  for (const [what, items, count] of cases) {
    assert.strictEqual(ok(checkHeld, items, { run: RUN, count }), false, `${what}: checkHeld must fail, so the owner does not confirm (${EV})`);
  }
});

// ─── HF7–HF9 — the Cypher and the source ─────────────────────────────────────────────────────────────────────────

test('HF7 — cleanup removes only TaggingEdgesEvidence nodes of one run, with DETACH DELETE (so only the relationships attached to them); every statement that deletes matches only TaggingEdgesEvidence nodes (§ Evidence "cleanup … MATCH (n:TaggingEdgesEvidence {run: $run}) DETACH DELETE n")', () => {
  const mod = script();
  const cy = cypherStrings(mod);
  const deleting = cy.filter((s) => /\bDELETE\b/.test(s));
  assert.ok(deleting.length >= 1, `a cleanup statement is exported (${EV}); found none among ${cy.length} statements`);
  assert.ok(deleting.some((s) => /DETACH\s+DELETE/.test(s) && /:\s*TaggingEdgesEvidence\b/.test(s) && /\$run\b/.test(s)),
    `cleanup DETACH DELETEs TaggingEdgesEvidence nodes matched by $run (${EV}); the deleting statements are ${JSON.stringify(deleting)}`);
  for (const s of deleting) {
    assert.ok(/MATCH\s*\(\s*\w+\s*:\s*TaggingEdgesEvidence\b/.test(s), `every deleting statement matches TaggingEdgesEvidence nodes (${EV}); this one does not: ${s}`);
    assert.ok(!/NostrUser/.test(s), `no deleting statement names NostrUser (${EV}); this one does: ${s}`);
    assert.ok(!/MATCH\s*\(\s*\)\s*-\s*\[|MATCH\s*\(\s*\w*\s*\)\s*-/.test(s), `no deleting statement matches relationships between any nodes (${EV}): ${s}`);
  }
  for (const s of cy) {
    if (/NostrUser/.test(s)) assert.ok(!WRITES.test(s), `a statement that names NostrUser may only read (the before-and-after counts) (${EV}); this one writes: ${s}`);
  }
});

test('HF8 — creation makes the two TaggingEdgesEvidence nodes and the TAGS between them in one statement (one transaction, so a pass reads none or all), with no MERGE and no NostrUser (§ Evidence "two nodes labelled TaggingEdgesEvidence (never NostrUser)"; "One transaction")', () => {
  const cy = cypherStrings(script());
  const creating = cy.filter((s) => /\bCREATE\b/.test(s));
  assert.ok(creating.some((s) => /:\s*TaggingEdgesEvidence\b/.test(s) && /:\s*TAGS\b/.test(s)),
    `one statement creates both the TaggingEdgesEvidence nodes and the TAGS relationships (${EV}); creating statements: ${JSON.stringify(creating)}`);
  for (const s of creating) {
    assert.ok(!/\bMERGE\b/.test(s), `creation merges nothing, so it can never match an existing node (${EV}): ${s}`);
    assert.ok(!/NostrUser/.test(s), `creation makes no NostrUser (${EV}): ${s}`);
  }
});

test('HF9 — the script publishes nothing, deletes nothing on a relay, and never confirms: no relay or signing module, no POST, PUT or DELETE request, no confirm route, and its only HTTP read is the held list (§ Evidence "It writes nothing to any relay"; "The owner confirms only after a pass")', () => {
  script();
  const src = fs.readFileSync(path.join(REPO, SCRIPT), 'utf8');
  const requires = [...src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
  const banned = requires.filter((r) => /nostr-tools|strfry|publish|signer|websocket|^ws$|relay/i.test(r));
  assert.deepStrictEqual(banned, [], `no relay, signing or publishing module (${EV}); requires ${banned.join(', ')}`);
  assert.ok(!/method\s*:\s*['"`](POST|PUT|PATCH|DELETE)['"`]/i.test(src), `the script sends no POST, PUT, PATCH or DELETE request (${EV})`);
  assert.ok(!/confirm-held-removals/.test(src), `the script never calls the confirm route: the owner confirms from the panel, after the check (${EV})`);
  assert.ok(!/strfry\s+(delete|import)|\/api\/strfry\/(wipe|delete|publish)/i.test(src), `no relay deletion or import (${EV})`);
  const urls = [...src.matchAll(/\/api\/[A-Za-z0-9/_-]+/g)].map((m) => m[0]);
  const others = urls.filter((u) => u !== '/api/tagging-edges/held');
  assert.deepStrictEqual(others, [], `the only route the script reads is the held list (${EV}); it names ${others.join(', ')}`);
});

// ─── the runner ─────────────────────────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n--- tagging-edges held-list evidence fixture (epic tagging-edges, Story 7) ---');
  let pass = 0, fail = 0;
  const skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    } finally {
      forget(SCRIPT);
    }
  }
  console.log(`\ntagging-edges-held-fixture: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
