'use strict';
/**
 * Tests for Story 7 (epic tagging-edges) — the pure confirmation module: may the owner confirm this held report, is a
 * confirmation already pending for it, and what of a confirmation the public status may show.
 *
 * Story: engineering-team/stories/tagging-edges/7-confirm-held-removals.md — AC-1 ("A second confirmation while one is
 *        pending is refused"; "A confirmation that cannot be relied on … still offers Confirm. Confirming replaces
 *        it"; "When the confirmation expires unused … offers Confirm again"), AC-4 ("The owner's shortened key goes from
 *        every confirmation the public status shows: pending, expired, or with an expiry that cannot be read"; "The
 *        public status keeps saying that a confirmation is pending or has expired, of which pass, and until when").
 * ADR:   engineering-team/decisions/tagging-edges/0007-confirm-held-removals.md — D3 (src/lib/tagging-edges/
 *        confirmation.js: validateConfirmation moved unchanged, pendingFor, publicConfirmation; plain CommonJS, no
 *        I/O) and D6 (confirmationPending is an allowlist).
 *
 * Intentionally failing until the implementation lands (red phase): src/lib/tagging-edges/confirmation.js does not
 * exist yet. The module is loaded inside each test, so this suite always loads and every test fails on its own with a
 * message naming the missing module or export and the ADR decision.
 *
 * Classes (all CL):
 *   CL1        the module (D3): its exports, and that it loads with no I/O.
 *   CL2–CL3    validateConfirmation moved unchanged; index.js re-exports the same function.
 *   CL4–CL8    pendingFor (D3): pending only for a version-1 record of the latest held list, unexpired; every other
 *              record is not pending, so a new confirmation replaces it.
 *   CL9–CL14   publicConfirmation (D6): the allowlist, the derived `expired`, a read that threw, anything else.
 *
 * Choices this suite makes where the ADR leaves a detail open:
 *   - pendingFor's expiry boundary is D3's letter: pending while nowMs < expiresAt, so at nowMs === expiresAt it is no
 *     longer pending (the same instant computeStatus already reads as expired: now >= expires).
 *   - "latest" without a held member, or with held.digest not a string, has no held list to be pending for: false.
 *   - publicConfirmation copies each allowlisted member only when the record has it as an own property, so a record
 *     without `heldCount` serves no `heldCount` key (not `heldCount: undefined`). `expired` is always present on an
 *     object record, false when either time does not parse (today's computeStatus rule).
 *   - `{unreadable: <code>}` (handleStatus's shape for a read that threw) is served as that one member, with at most
 *     `expired: false` beside it, which today's status adds (D6 "as today"; state-routes RT40 reads it the same way).
 *   - An array is not an object record, so it is served as null (D6 "anything else → null"), although today's
 *     withoutNonce spreads one into an object.
 *
 * Hermetic: pure functions only; no file, network, Redis or graph. Hand-rolled in the project's test style.
 */

const assert = require('assert');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const LIB = 'src/lib/tagging-edges/confirmation.js';
const INDEX = 'src/api/tagging-edges/index.js';
const D3 = 'ADR tagging-edges/0007 D3';
const D6 = 'ADR tagging-edges/0007 D6';

const OWNER = 'a1b2c3d4'.repeat(8);
const OWNER_KEY = OWNER.slice(0, 8);
const RUN = '20261107T030000Z-0a1b2c3d';
const EARLIER = '20261106T030000Z-9f8e7d6c';
const DIGEST = 'd'.repeat(64);
const OTHER_DIGEST = 'e'.repeat(64);
const MINTED = Date.parse('2026-11-07T04:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms) => new Date(ms).toISOString();

const tests = [];
function test(name, fn) { tests.push([name, fn]); }

function forget(rel) {
  const abs = path.join(REPO, rel);
  let resolved;
  try { resolved = require.resolve(abs); } catch (_) { return; } // not there yet: nothing cached
  delete require.cache[resolved];
}

/** Require `rel` and check it exports each name as a function; the message names the module, the names and the ADR. */
function load(rel, names, ref) {
  const abs = path.join(REPO, rel);
  let mod;
  try {
    mod = require(abs);
  } catch (e) {
    const head = String((e && e.message) || e).split('\n')[0];
    const absent = e && e.code === 'MODULE_NOT_FOUND' && head.includes(abs);
    assert.fail(absent
      ? `${rel} does not exist yet (${ref}): expected a module exporting ${names.join(', ')}`
      : `${rel} did not load (${ref}): ${head}`);
  }
  const missing = names.filter((n) => !mod || typeof mod[n] !== 'function');
  if (missing.length) {
    assert.fail(`${rel} does not export ${missing.map((n) => `${n}()`).join(', ')} yet (${ref}); it exports ${Object.keys(mod || {}).sort().join(', ') || 'nothing'}`);
  }
  return mod;
}
const lib = () => load(LIB, ['validateConfirmation', 'pendingFor', 'publicConfirmation'], D3);

function latestHeld(o = {}) {
  return {
    runId: o.runId || RUN,
    outcome: o.outcome || 'done-removals-held',
    held: o.held === undefined ? { total: 60, digest: DIGEST } : o.held,
    startedAt: iso(MINTED - 3600000),
    endedAt: iso(MINTED - 3000000),
  };
}
function record(o = {}) {
  const mintedAt = o.mintedAt === undefined ? iso(MINTED) : o.mintedAt;
  const r = {
    version: 1,
    runId: RUN,
    heldDigest: DIGEST,
    heldCount: 60,
    nonce: '0f'.repeat(16),
    mintedAt,
    expiresAt: typeof mintedAt === 'string' && Number.isFinite(Date.parse(mintedAt)) ? iso(Date.parse(mintedAt) + DAY) : mintedAt,
  };
  return Object.assign(r, o.over || {});
}
const deepFrozen = (v) => { if (v && typeof v === 'object') { Object.values(v).forEach(deepFrozen); Object.freeze(v); } return v; };

/** Run fn with Date.now and new Date() (no args) poisoned, so a function that reads the clock throws. */
function withoutClock(fn) {
  const RealDate = Date;
  const realNow = Date.now;
  function PoisonDate(...args) {
    if (!(this instanceof PoisonDate)) throw new Error('Date() read the clock');
    if (args.length === 0) throw new Error('new Date() read the clock');
    return new RealDate(...args);
  }
  PoisonDate.parse = RealDate.parse;
  PoisonDate.UTC = RealDate.UTC;
  PoisonDate.now = () => { throw new Error('Date.now() read the clock'); };
  PoisonDate.prototype = RealDate.prototype;
  global.Date = PoisonDate;
  try { return fn(); } finally { global.Date = RealDate; Date.now = realNow; }
}

// ─── CL1 — the module ─────────────────────────────────────────────────────────────────────────────────────────────

test('CL1 — src/lib/tagging-edges/confirmation.js exports validateConfirmation, pendingFor and publicConfirmation, and loads with no file, network or child-process I/O (D3: plain CommonJS, no I/O)', () => {
  const fs = require('fs');
  const cp = require('child_process');
  const net = require('net');
  const touched = [];
  const saved = {
    readFileSync: fs.readFileSync, writeFileSync: fs.writeFileSync, readdirSync: fs.readdirSync, openSync: fs.openSync,
    spawn: cp.spawn, exec: cp.exec, connect: net.connect,
  };
  fs.readFileSync = function (...a) { if (!String(a[0]).endsWith('.js') && !String(a[0]).endsWith('.json')) touched.push(`fs.readFileSync ${a[0]}`); return saved.readFileSync.apply(this, a); };
  fs.writeFileSync = function (...a) { touched.push(`fs.writeFileSync ${a[0]}`); return saved.writeFileSync.apply(this, a); };
  fs.readdirSync = function (...a) { touched.push(`fs.readdirSync ${a[0]}`); return saved.readdirSync.apply(this, a); };
  const isModule = (p) => /\.(js|json|node)$/.test(String(p)); // the module loader's own reads
  fs.openSync = function (...a) { if (!isModule(a[0])) touched.push(`fs.openSync ${a[0]}`); return saved.openSync.apply(this, a); };
  cp.spawn = function (...a) { touched.push(`spawn ${a[0]}`); return saved.spawn.apply(this, a); };
  cp.exec = function (...a) { touched.push(`exec ${a[0]}`); return saved.exec.apply(this, a); };
  net.connect = function (...a) { touched.push('net.connect'); return saved.connect.apply(this, a); };
  try {
    forget(LIB);
    lib();
  } finally {
    Object.assign(fs, { readFileSync: saved.readFileSync, writeFileSync: saved.writeFileSync, readdirSync: saved.readdirSync, openSync: saved.openSync });
    Object.assign(cp, { spawn: saved.spawn, exec: saved.exec });
    net.connect = saved.connect;
  }
  assert.deepStrictEqual(touched, [], `loading ${LIB} must do no I/O (${D3}); it did: ${touched.join('; ')}`);
});

// ─── CL2–CL3 — validateConfirmation, moved ────────────────────────────────────────────────────────────────────────

test('CL2 — validateConfirmation keeps today\'s answers exactly: 400 bad-run-id, 409 not-the-latest-report, 409 nothing-held, 409 running, and ok with the run id and the latest (D3: moved unchanged)', () => {
  const { validateConfirmation } = lib();
  const report = { reportVersion: 1, latest: latestHeld(), previous: [] };
  const cases = [
    [{ body: { runId: 'not-a-run' }, report, alive: false }, { ok: false, status: 400, code: 'bad-run-id' }],
    [{ body: { runId: ['x'] }, report, alive: false }, { ok: false, status: 400, code: 'bad-run-id' }],
    [{ body: {}, report, alive: false }, { ok: false, status: 400, code: 'bad-run-id' }],
    [{ body: { runId: EARLIER }, report, alive: false }, { ok: false, status: 409, code: 'not-the-latest-report' }],
    [{ body: { runId: RUN }, report: null, alive: false }, { ok: false, status: 409, code: 'not-the-latest-report' }],
    [{ body: { runId: RUN }, report: { latest: latestHeld({ outcome: 'done', held: { total: 0, digest: null } }) }, alive: false }, { ok: false, status: 409, code: 'nothing-held' }],
    [{ body: { runId: RUN }, report: { latest: latestHeld({ held: { total: 0, digest: DIGEST } }) }, alive: false }, { ok: false, status: 409, code: 'nothing-held' }],
    [{ body: { runId: RUN }, report, alive: true }, { ok: false, status: 409, code: 'running' }],
  ];
  for (const [input, want] of cases) {
    const got = validateConfirmation(input);
    for (const k of Object.keys(want)) {
      assert.strictEqual(got && got[k], want[k], `validateConfirmation(${JSON.stringify(input.body)}, …) ${k}: expected ${JSON.stringify(want[k])}, got ${JSON.stringify(got)} (${D3}: moved unchanged from index.js:124-140)`);
    }
    assert.strictEqual(typeof got.error, 'string', `a refusal keeps its error sentence; got ${JSON.stringify(got)} (${D3})`);
  }
  const ok = validateConfirmation({ body: { runId: RUN }, report, alive: false });
  assert.strictEqual(ok.ok, true, `the latest held report, not running, may be confirmed; got ${JSON.stringify(ok)} (${D3})`);
  assert.strictEqual(ok.runId, RUN, `ok carries the run id (${D3})`);
  assert.deepStrictEqual(ok.latest, report.latest, `ok carries the latest record (${D3})`);
});

test('CL3 — src/api/tagging-edges/index.js still exports validateConfirmation, and it is the lib\'s own function (D3: "index.js re-exports it, so its existing pins hold")', () => {
  const { validateConfirmation } = lib();
  forget(INDEX);
  const index = require(path.join(REPO, INDEX));
  assert.strictEqual(typeof index.validateConfirmation, 'function', `${INDEX} must keep exporting validateConfirmation (${D3})`);
  assert.strictEqual(index.validateConfirmation, validateConfirmation, `${INDEX}'s validateConfirmation must be the one in ${LIB}, not a copy (${D3}: "Moves here … index.js re-exports it")`);
});

// ─── CL4–CL8 — pendingFor ────────────────────────────────────────────────────────────────────────────────────────

test('CL4 — pendingFor is true for a version-1 record of the latest held list (same run id and digest) before it expires, at its very last millisecond included (D3; AC-1 "A second confirmation while one is pending is refused")', () => {
  const { pendingFor } = lib();
  const r = record();
  const latest = latestHeld();
  for (const now of [MINTED, MINTED + 1, MINTED + DAY / 2, MINTED + DAY - 1]) {
    assert.strictEqual(pendingFor(r, latest, now), true, `a confirmation of the latest held list at ${iso(now)} (expires ${r.expiresAt}) is pending (${D3}); pendingFor answered ${JSON.stringify(pendingFor(r, latest, now))}`);
  }
});

test('CL5 — pendingFor is false once the confirmation has expired: at expiresAt itself and after (D3 "nowMs < expiresAt"; AC-1 "When the confirmation expires unused … offers Confirm again")', () => {
  const { pendingFor } = lib();
  const r = record();
  for (const now of [MINTED + DAY, MINTED + DAY + 1, MINTED + 30 * DAY]) {
    assert.strictEqual(pendingFor(r, latestHeld(), now), false, `at ${iso(now)} a confirmation that expired at ${r.expiresAt} is not pending, so a new one replaces it (${D3}); got ${JSON.stringify(pendingFor(r, latestHeld(), now))}`);
  }
});

test('CL6 — pendingFor is false for every confirmation that cannot be relied on: none, unreadable, malformed, another version, an unreadable or missing expiry, one for an earlier pass, one of the same run with another digest (D3; AC-1 "A confirmation that cannot be relied on … Confirming replaces it")', () => {
  const { pendingFor } = lib();
  const now = MINTED + 1000;
  const latest = latestHeld();
  const cases = [
    ['no record', null],
    ['undefined', undefined],
    ['a read that threw ({unreadable})', { unreadable: 'EACCES' }],
    ['a string', 'pending'],
    ['an array', [record()]],
    ['version 2', record({ over: { version: 2 } })],
    ['no version', (() => { const r = record(); delete r.version; return r; })()],
    ['an expiry that does not parse', record({ over: { expiresAt: 'tomorrow' } })],
    ['no expiry', (() => { const r = record(); delete r.expiresAt; return r; })()],
    ['an expiry that is a number', record({ over: { expiresAt: MINTED + DAY } })],
    ['pending for an earlier pass', record({ over: { runId: EARLIER } })],
    ['the same run, another digest', record({ over: { heldDigest: OTHER_DIGEST } })],
    ['no digest', (() => { const r = record(); delete r.heldDigest; return r; })()],
  ];
  for (const [what, r] of cases) {
    let got;
    try { got = pendingFor(r, latest, now); } catch (e) { assert.fail(`pendingFor must not throw for ${what} (${D3}); it threw ${e && e.message}`); }
    assert.strictEqual(got, false, `${what} is not pending: no pass carries it out, and a new confirmation replaces it (${D3}); pendingFor answered ${JSON.stringify(got)}`);
  }
});

test('CL7 — pendingFor is false when the latest pass holds no list to be pending for: no latest, no held member, or a held digest that is not a string (D3)', () => {
  const { pendingFor } = lib();
  const r = record();
  const now = MINTED + 1000;
  const cases = [
    ['no latest', null],
    ['a latest with no held member', (() => { const l = latestHeld(); delete l.held; return l; })()],
    ['a held digest of null', latestHeld({ held: { total: 60, digest: null } })],
    ['a held digest that is a number', latestHeld({ held: { total: 60, digest: 7 } })],
  ];
  for (const [what, latest] of cases) {
    let got;
    try { got = pendingFor(r, latest, now); } catch (e) { assert.fail(`pendingFor must not throw for ${what} (${D3}); it threw ${e && e.message}`); }
    assert.strictEqual(got, false, `${what}: nothing to be pending for (${D3}); got ${JSON.stringify(got)}`);
  }
});

test('CL8 — pendingFor is pure: it reads no clock (only nowMs) and changes neither argument (D3: "Plain CommonJS with no I/O"; the view and server stay clock-free)', () => {
  const { pendingFor } = lib();
  const r = deepFrozen(record());
  const latest = deepFrozen(latestHeld());
  let a;
  let b;
  try {
    a = withoutClock(() => pendingFor(r, latest, MINTED + 1000));
    b = withoutClock(() => pendingFor(r, latest, MINTED + DAY + 1));
  } catch (e) {
    assert.fail(`pendingFor must judge from nowMs alone, never the clock, and must not write to its arguments (${D3}); it threw: ${e && e.message}`);
  }
  assert.strictEqual(a, true, `pending before its expiry, by nowMs (${D3})`);
  assert.strictEqual(b, false, `not pending after its expiry, by nowMs (${D3})`);
});

// ─── CL9–CL14 — publicConfirmation ───────────────────────────────────────────────────────────────────────────────

const ALLOWED = ['version', 'runId', 'heldDigest', 'heldCount', 'mintedAt', 'expiresAt'];

test('CL9 — publicConfirmation serves only version, runId, heldDigest, heldCount, mintedAt and expiresAt, plus the derived expired, from a record written before story 7 (with mintedBy and its nonce) (D6; AC-4 "The owner\'s shortened key goes from every confirmation the public status shows")', () => {
  const { publicConfirmation } = lib();
  const r = record({ over: { mintedBy: OWNER_KEY } });
  const got = publicConfirmation(r, MINTED + 1000);
  assert.ok(got && typeof got === 'object', `an object record is served as an object (${D6}); got ${JSON.stringify(got)}`);
  assert.deepStrictEqual(Object.keys(got).sort(), [...ALLOWED, 'expired'].sort(), `only the allowlist and expired are served (${D6}); got keys ${Object.keys(got).sort().join(', ')}`);
  for (const k of ALLOWED) assert.strictEqual(got[k], r[k], `${k} is served as the record holds it (${D6})`);
  assert.strictEqual(got.expired, false, `not expired before its expiry (${D6})`);
  const text = JSON.stringify(got);
  assert.ok(!text.includes(OWNER_KEY), `no shortened key of the owner on the public confirmation (${D6}; AC-4); got ${text}`);
  assert.ok(!text.includes(r.nonce), `the nonce never appears (${D6}; ADR 0002 C12); got ${text}`);
});

test('CL10 — publicConfirmation drops every member outside the allowlist, a hand-edited who included, whatever its name (D6: "or edited by hand")', () => {
  const { publicConfirmation } = lib();
  const r = record({ over: { mintedBy: OWNER_KEY, by: OWNER, who: { kind: 'owner', key: OWNER_KEY }, confirmedBy: OWNER, note: 'x', __proto__extra: 1 } });
  const got = publicConfirmation(r, MINTED + 1000);
  const extra = Object.keys(got || {}).filter((k) => ![...ALLOWED, 'expired'].includes(k));
  assert.deepStrictEqual(extra, [], `members outside the allowlist must not be served (${D6}); served ${extra.join(', ')}`);
  assert.ok(!JSON.stringify(got).includes(OWNER.slice(0, 8)), `no part of the owner's key is served (${D6}); got ${JSON.stringify(got)}`);
});

test('CL11 — publicConfirmation keeps saying pending or expired, of which pass and until when: expired is now >= expiresAt by nowMs, and false when a time does not parse (D6; AC-4 "The public status keeps saying …")', () => {
  const { publicConfirmation } = lib();
  const r = record();
  const before = publicConfirmation(r, MINTED + DAY - 1);
  const at = publicConfirmation(r, MINTED + DAY);
  const after = publicConfirmation(r, MINTED + DAY + 1);
  assert.strictEqual(before && before.expired, false, `before its expiry: expired false (${D6}); got ${JSON.stringify(before)}`);
  assert.strictEqual(at && at.expired, true, `at its expiry: expired true, as computeStatus reads now >= expires (${D6}); got ${JSON.stringify(at)}`);
  assert.strictEqual(after && after.expired, true, `after its expiry: expired true (${D6}); got ${JSON.stringify(after)}`);
  for (const p of [before, at, after]) {
    assert.strictEqual(p.runId, RUN, `which pass stays on the public confirmation (${D6}; AC-4)`);
    assert.strictEqual(p.expiresAt, r.expiresAt, `until when stays on the public confirmation (${D6}; AC-4)`);
  }
  const unparsed = publicConfirmation(record({ over: { expiresAt: 'soon' } }), MINTED);
  assert.strictEqual(unparsed && unparsed.expired, false, `an expiry that does not parse is not called expired (today's rule; the panel shows "its expiry time cannot be read") (${D6}); got ${JSON.stringify(unparsed)}`);
  assert.strictEqual(unparsed.expiresAt, 'soon', `the unreadable expiry is served as it is, so the panel can say it cannot read it (${D6})`);
  assert.strictEqual(withoutClock(() => publicConfirmation(r, MINTED + DAY + 1)).expired, true, `expired is judged by nowMs, never the clock (${D6})`);
});

test('CL12 — publicConfirmation serves an allowlisted member only when the record has it: no undefined keys, no invented values (D6 "each when present")', () => {
  const { publicConfirmation } = lib();
  const r = { version: 1, runId: RUN, expiresAt: iso(MINTED + DAY), mintedBy: OWNER_KEY };
  const got = publicConfirmation(r, MINTED);
  assert.deepStrictEqual(Object.keys(got || {}).sort(), ['expired', 'expiresAt', 'runId', 'version'], `only the members the record has, plus expired (${D6}); got ${JSON.stringify(got)}`);
});

test('CL13 — publicConfirmation passes a read that threw through as {unreadable: <code>} alone, and serves null for no record (D6 "null → null; a read that threw → {unreadable: <code>}, as today")', () => {
  const { publicConfirmation } = lib();
  assert.strictEqual(publicConfirmation(null, MINTED), null, `no confirmation → null (${D6})`);
  assert.strictEqual(publicConfirmation(undefined, MINTED), null, `undefined → null (${D6})`);
  // "as today": today's status serves {unreadable, expired: false} for it, so expired: false may stay beside it.
  const bare = (v) => { if (v && typeof v === 'object' && v.expired === false) { const { expired, ...rest } = v; return rest; } return v; };
  const u = publicConfirmation({ unreadable: 'EBADJSON' }, MINTED);
  assert.deepStrictEqual(bare(u), { unreadable: 'EBADJSON' }, `a read that threw is served as {unreadable}, with at most expired: false beside it (${D6}); got ${JSON.stringify(u)}`);
  const u2 = publicConfirmation({ unreadable: 'EIO', mintedBy: OWNER_KEY }, MINTED);
  assert.deepStrictEqual(bare(u2), { unreadable: 'EIO' }, `even with other members beside it, only unreadable is served (${D6}); got ${JSON.stringify(u2)}`);
});

test('CL14 — publicConfirmation serves null for anything that is not an object record (a string, a number, an array), as withoutNonce does today (D6 "anything else → null")', () => {
  const { publicConfirmation } = lib();
  for (const v of ['pending', 7, true, [record()]]) {
    const got = publicConfirmation(v, MINTED);
    assert.strictEqual(got, null, `${JSON.stringify(v).slice(0, 40)} → null (${D6}); got ${JSON.stringify(got)}`);
  }
});

// ─── the runner ─────────────────────────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n--- tagging-edges confirmation module (epic tagging-edges, Story 7) ---');
  let pass = 0, fail = 0;
  const skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    } finally {
      try { forget(LIB); } catch (_) { /* never loaded */ }
    }
  }
  console.log(`\ntagging-edges-confirmation-lib: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
