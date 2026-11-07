'use strict';
/**
 * Tests for Story 7 (epic tagging-edges) — confirming held removals: the controller's one confirmation step, and the
 * confirm route that hands every confirmation to it.
 *
 * Story: engineering-team/stories/tagging-edges/7-confirm-held-removals.md — AC-1 (Confirm for the owner: nothing
 *        busy, a pass waiting, a pass that has begun or only just started, every busy pass with a stop asked for,
 *        "Never a false answer", a second confirmation while one is pending, no pass lined up, a pass starting while
 *        the confirmation is being made, a confirmation that cannot be relied on), AC-2 ("Only what the prompt
 *        showed"; "The answer says what happened"), AC-3 ("The server decides": every refused caller changes and
 *        records nothing), AC-4 (what is recorded; refused when it cannot be recorded; no public read names who), and
 *        § Test tasks "Server cases for AC-1 to AC-4", the last bullet included (signed-out reads after the owner's
 *        confirmation).
 * ADR:   engineering-team/decisions/tagging-edges/0007-confirm-held-removals.md — D1 (controller.confirm, one chain
 *        step; the route keeps only the who and body checks), D2 (the step's nine steps, in order; takeBackStart), D3
 *        (pendingFor, through the controller), D4 (the answers), D5 (the confirm line; refused when unrecordable), D6
 *        (the public confirmation: no who), § Readings 1 (a starting pass is joined), R10, R11, § Seams for Test
 *        Design ("The controller", "Interleavings", "The route"). The controller it extends is ADR tagging-edges/0006's
 *        (D1, D5, D6, D11; Amendment 1 § C).
 *
 * Intentionally failing until the implementation lands (red phase): createController(deps) returns no confirm yet,
 * and the confirm route still runs its own sequence. Every module under test is loaded lazily inside each test through
 * test/helpers/taggingEdgesPassFakes.js's loadModule, and a missing confirm() is named with ADR 0007 D1, so this suite
 * always loads and every test fails on its own.
 *
 * Classes (all CH):
 *   CH1        the module (D1): confirm beside lineUp, stop, snapshot and gate, on every instance and the default one;
 *              lineUp's confirm mode is gone (confirmStep goes).
 *   CH2–CH5    steps 1–3: the report checks (not-the-latest-report, nothing-held, running), the pending check
 *              (already-pending, and the replacement of a confirmation that cannot be relied on), the held list.
 *   CH6–CH11   step 4, the plan and its precedence: nothing busy, a waiting pass (four forms), a starting pass (ahead of
 *              a waiting one), the queue not ok (ahead of a starting pass), every busy pass with a stop asked for, the
 *              finishing window.
 *   CH12–CH14  steps 5–6: the record first (record-unavailable writes nothing else), confirmation.json's shape, a
 *              failed confirmation write (the record taken back).
 *   CH15–CH18  step 7, the re-read and its withdraw: renamed (pass-started), already claimed (taken-up), the rename
 *              throws (withdraw-failed), a pass that records itself between the report check and the plan (R11).
 *   CH19–CH21  step 8 and the record: a failed or timed-out add, takeBackStart over a record at the history's cap,
 *              the confirm line's shape (D5).
 *   CH22       every path bumps the generation (a status read after confirm is fresh).
 *   CH23–CH25  interleavings: a second confirm queued behind the first; a gate afterAcquire queued behind a confirm
 *              and the other way round; "Never a false answer" across every answer.
 *   CH26–CH27  the route with an injected confirm: what it hands over and sends; its refusals reach no confirm.
 *   CH28–CH29  in a child process: the real authMiddleware and requireOwnerOnly in front of the real route (signed
 *              out, an admin, a user who is neither, another site: nothing changed or recorded; the owner reaches
 *              confirm); and, after the owner's confirmation, signed-out reads of the status, the held list, the path
 *              status and the Task Explorer's data carry no who on a pending, an expired or an unreadable-expiry
 *              confirmation, nor does anything logged (story 6's PX38 is the model).
 *
 * Hermetic: every controller is an instance built by createController(deps) over the shared fakes (makeWorld: a
 * BullMQ-faithful fake queue, an in-memory record, a fake process table, a fixed fake clock, and story 7's held-file,
 * confirmation and nonce deps). TAGGING_EDGES_STATE_DIR points at a temp directory for the whole run; nothing reads or
 * writes /var/lib/brainstorm. process.kill is replaced for the whole run by the helper's guardProcessKill, and a test
 * whose code reached it fails. No Redis, network, graph, relay or host /proc. The child process gets a temp
 * brainstorm.conf naming the owner and a temp settings file naming the admin, every child_process launch replaced by a
 * recorder, and the task queue module replaced by a stub in require's cache, as story 6's PX child has.
 *
 * Choices this suite makes where the ADR leaves a detail open (recorded in the Test Design return):
 *   - confirm({ who, runId }) resolves { status, body } (D1: the route "sends {status, body} as Run's handler does");
 *     a flat body is not accepted. who is handed over as the route hands it, { kind: 'owner', key: <the full owner
 *     pubkey> } (D1), and the record keeps the 8-character key (0006 D11's normalWho).
 *   - The lined-up answer's behindStopping is read as true, or as anything but true when nothing is busy (D2 step 4:
 *     "with behindStopping: true when anything is busy"; D4 lists it in the body).
 *   - A failed add's reason: a time-out must answer QUEUE_UNAVAILABLE; a refused add may answer 'error' (with cause)
 *     or QUEUE_UNAVAILABLE, as story 6's Run (CT28).
 *   - The start of a lined-up pass is recorded at the same instant as the confirm line (one commit, D2 step 5; the
 *     fake clock does not move inside a step), and its history line sits above the confirm line (D5: "The confirm line
 *     is written first, so the start shows above it").
 *   - confirmation.json is exactly { version, runId, heldDigest, heldCount, nonce, mintedAt, expiresAt } (D2 step 6
 *     names those members and "No mintedBy"); heldCount is the held file's length.
 *   - "Every busy pass has a stop asked for" while the held run is still the latest (so the re-read keeps it) is
 *     built from a record entry that carries a stop for a job that then waits for the lock, or starts, with no skip
 *     or noRerun: a pass that has recorded itself is always the report's latest, so a running pass with a stop asked
 *     for is refused at step 1 (not-the-latest-report), or caught at step 7.
 *   - "Every path bumps the generation" is read through the status route's 1 s snapshot reuse (0006 D5): a status
 *     read cached before the confirmation, then a live pass appearing behind the controller's back, then a second
 *     status read, which must show it.
 *   - A pass "starting while the confirmation is being made" is driven through the world's one-shot hooks: after the
 *     confirmation write (the re-read then sees it), or after the step's first report read (the plan sees it; R11).
 *   - The route's injected confirm is the only dep it may call after its checks: its pre-story-7 deps (readFile,
 *     readHeld, heldDigest, writeConfirmation, withdrawConfirmation, nonce, lineUp, queueHealth) are traps.
 *   - Signed-out reads' who (CH29): either case of the owner's pubkey, its 8-character key, a member named "who" or
 *     "mintedBy", or the kind "owner" as JSON or as console prints it. Each read must also show what it is about (the
 *     pending confirmation's run, the held list's run), so a missing who is not an empty answer.
 *
 * Hand-rolled in the project's existing test style — no new framework. Works on Node 16 and 22.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const H = require('./helpers/taggingEdgesPassFakes');

const { REPO, OWNER, ADMIN, STRANGER, OWNER_KEY, ADMIN_KEY, TASK, LINEUP_ID, MODULES, PATHS, T0, adr7, DAY_MS } = H;
const adr6 = H.adr;
const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
/** D1: what the route hands the controller. */
const OWNER_IN = Object.freeze({ kind: 'owner', key: OWNER });
/** D5: who the record keeps (0006 D11). */
const OWNER_REC = Object.freeze({ kind: 'owner', key: OWNER_KEY });
const ADMIN_REC = Object.freeze({ kind: 'admin', key: ADMIN_KEY });
const CONFIRMATION_WHO = Object.freeze({ kind: 'confirmation' });
/** D2 step 6: confirmation.json's members. */
const CONF_KEYS = ['version', 'runId', 'heldDigest', 'heldCount', 'nonce', 'mintedAt', 'expiresAt'];
const OUT_OF_DATE = ['not-the-latest-report', 'nothing-held', 'running', 'held-list-changed'];

// ─── test harness ──────────────────────────────────────────────────────────────────────────────────────────────
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function sortKeys(v) {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object' && !Buffer.isBuffer(v)) return Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {});
  return v;
}
function show(v) {
  if (v === undefined) return 'undefined';
  if (v instanceof Error) return `<${v.code || 'Error'}: ${firstLine(v)}>`;
  try {
    const s = JSON.stringify(sortKeys(v), (k, x) => (typeof x === 'string' && x.length > 160 ? `${x.slice(0, 40)}…(${x.length} characters)` : x));
    return s && s.length > 900 ? `${s.slice(0, 900)}…` : s;
  } catch (_) {
    return String(v);
  }
}
const exact = (v) => JSON.stringify(sortKeys(v));
const firstLine = (e) => String((e && e.message) || e).split('\n')[0];
const iso = (t) => new Date(t).toISOString();
const has = (o, k) => !!o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k);
function report(problems, ref) {
  const p = problems.filter(Boolean);
  if (p.length) throw new Error(`${p.join('\n          ')}${ref ? ` (${ref})` : ''}`);
}
async function cases(list, fn) {
  const failed = [];
  for (const c of list) {
    try { await fn(c); } catch (e) { failed.push(`[${c.name}] ${e.message}`); }
  }
  assert(failed.length === 0, `${failed.length} of ${list.length} case(s) failed:\n        ${failed.join('\n        ')}`);
}
async function within(p, limit, what) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(p),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} did not settle within ${limit} ms`)), limit); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// ─── loading ───────────────────────────────────────────────────────────────────────────────────────────────────
function loadController() { return H.loadModule(MODULES.controller, { createController: 'function' }, adr7('D1')); }
function loadRoutes() { return H.loadModule(MODULES.routes, { handleConfirmHeldRemovals: 'function', handleStatus: 'function' }, adr7('D1')); }
function allowErrorCode(code) {
  return H.loadModule('src/lib/tagging-edges/realtime.js', { allowErrorCode: 'function' }, 'ADR tagging-edges/0005 D5').allowErrorCode(code);
}

// ─── a controller over the fakes ───────────────────────────────────────────────────────────────────────────────
/**
 * A controller over a fresh world whose latest pass held 60 removals (o.held: holdRemovals' options; false for none).
 * o.world: makeWorld's options. o.setup(ctx) runs before the controller is built (seeds the world).
 */
function mk(o = {}) {
  const { createController } = loadController();
  const world = H.makeWorld(o.world || {});
  const held = o.held === false ? null : world.holdRemovals(o.held || {});
  const deps = { ...world.deps };
  const ctl = createController(deps);
  assert(ctl && typeof ctl.lineUp === 'function' && typeof ctl.stop === 'function' && typeof ctl.snapshot === 'function' && ctl.gate,
    `createController(deps) should still return { lineUp, stop, snapshot, gate } (${adr6('D1')}); it returned ${show(ctl && Object.keys(ctl))}`);
  return { world, ctl, q: world.queue, deps, held, createController };
}
async function withCtl(o, fn) {
  if (typeof o === 'function') { fn = o; o = {}; }
  const ctx = mk(o);
  try {
    return await fn(ctx);
  } finally {
    try { ctx.q.releaseHangs(); } catch (_) { /* nothing hung */ }
    ctx.world.cleanup();
  }
}
/** ctl.confirm, or a failure naming ADR 0007 D1 while it is missing. */
function confirmOf(ctl) {
  if (!ctl || typeof ctl.confirm !== 'function') {
    throw new Error(`createController(deps) returns no confirm({ who, runId }) yet (${adr7('D1')}: "createController returns confirm beside lineUp, stop and snapshot"); it returns ${show(ctl && Object.keys(ctl))}`);
  }
  return ctl.confirm;
}
async function confirm(ctx, { who = OWNER_IN, runId = ctx.held && ctx.held.runId, ctl = ctx.ctl, limit = 3000 } = {}) {
  confirmOf(ctl);
  const what = `confirm({ who: ${who.kind}, runId: ${runId} })`;
  return answerOf(await within(ctl.confirm({ who, runId }), limit, what), what);
}
function answerOf(r, what) {
  assert(r && typeof r === 'object' && Number.isInteger(r.status) && r.body && typeof r.body === 'object',
    `${what} should resolve { status, body }, as Run's lineUp does (${adr7('D1')}: the route "sends {status, body} as Run's handler does"); it resolved ${show(r)}`);
  return { status: r.status, body: r.body, what };
}
/** The confirm line's time, and the minted time: the fake clock's now (it does not move inside a step). */
const nowIso = (ctx) => iso(ctx.world.clock.now());

// ─── busy states ───────────────────────────────────────────────────────────────────────────────────────────────
async function runKey(ctx, who = ADMIN_REC) {
  const r = await within(ctx.ctl.lineUp({ who, mode: 'run' }), 3000, 'a Run');
  const b = r && r.body ? r.body : r;
  assert(b && b.linedUp === true && typeof b.key === 'string', `setup: a Run should line up a pass (${adr6('D6')}); it answered ${show(r)}`);
  return b.key;
}
function pick1(ctx, id) {
  const job = ctx.q.pickUp();
  assert(job && (id === undefined || job.id === id), `setup: ${id} should be picked up next; got ${show(job && job.id)} (queue ${show(ctx.q.dump())})`);
  return job;
}
async function gateStep(ctx, name, job, want) {
  const v = await within(ctx.ctl.gate[name](job), 3000, `gate.${name}(${job.id})`);
  if (want !== undefined) assert(v === want, `setup: gate.${name}(${job.id}) should answer '${want}' (${adr6('D3')}); it answered ${show(v)}`);
  return v;
}
async function lockWait(ctx, key) { const k = key || (await runKey(ctx)); const job = pick1(ctx, k); await gateStep(ctx, 'beforeAcquire', job, 'go'); return { key: k, job }; }
async function starting(ctx, key) { const w = await lockWait(ctx, key); await gateStep(ctx, 'afterAcquire', w.job, 'go'); return w; }
async function addJob(ctx, id, opts = {}) { await ctx.q.add(TASK, H.lineUpData(), { ...H.lineUpOpts(id), ...opts }); return id; }
async function snap(ctx, fresh = true) {
  const s = await within(ctx.ctl.snapshot({ ...ctx.deps, fresh }, { fresh }), 3000, `snapshot({ fresh: ${fresh} })`);
  const items = s && (Array.isArray(s.items) ? s.items : Array.isArray(s.busy) ? s.busy : null);
  assert(items, `snapshot() should carry its busy items (${adr6('D5')}); it resolved ${show(s)}`);
  return { raw: s, queue: s.queue, items };
}
/** A record entry that carries a stop for job `key`, with no skip and no noRerun (the Choices: a stop on record). */
function stoppedEntryRecord(key) {
  const at = iso(T0 - 5 * MIN);
  return H.recordFile({
    passes: { [key]: H.recordEntry({ jobId: key, stop: { at, runId: null, who: { ...ADMIN_REC } } }) },
    history: [H.historyLine('stop', key, at, { ...ADMIN_REC })],
  });
}
const STOP_KEY = H.lineUpKey(300);

/** D2 step 4's busy states with the held run still latest. Each setup → { key } of the busy job (or nothing). */
const WAITING = [
  { name: 'a Run waiting in line', setup: async (ctx) => ({ key: await runKey(ctx) }) },
  { name: 'a Run waiting for the heavy-task lock (behind scoring)', setup: async (ctx) => lockWait(ctx) },
  { name: 'a scheduled run come due, waiting in delayed (the seed id form)', setup: async (ctx) => ({ key: ctx.q.plantScheduled({ millis: ctx.world.clock.now() - MIN, every: 6 * HOUR }) }) },
  { name: 'a job picked up that the gate has not yet seen', setup: async (ctx) => { const k = await runKey(ctx); pick1(ctx, k); return { key: k }; } },
];

// ─── the world's state, and what changed ───────────────────────────────────────────────────────────────────────
function recordOf(ctx) {
  let r = null;
  try { r = ctx.world.record.parsed(); } catch (_) { r = null; }
  return r && typeof r === 'object' ? r : { version: 1, passes: {}, history: [] };
}
const historyOf = (ctx) => (Array.isArray(recordOf(ctx).history) ? recordOf(ctx).history : []);
const passesOf = (ctx) => (recordOf(ctx).passes && typeof recordOf(ctx).passes === 'object' ? recordOf(ctx).passes : {});
const confirmLines = (ctx) => historyOf(ctx).filter((l) => l && l.action === 'confirm');
const lastWritten = (ctx) => ctx.world.confirmationWrites[ctx.world.confirmationWrites.length - 1] || null;
const addsOf = (ctx) => ctx.world.callsOf('queue.add');
function stateOf(ctx) {
  return {
    record: ctx.world.record.bytes(),
    recordWrites: ctx.world.callsOf('writeRecord').length,
    confirmation: JSON.stringify(ctx.world.confirmation === undefined ? null : ctx.world.confirmation),
    confWrites: ctx.world.callsOf('writeConfirmation').length,
    adds: addsOf(ctx).length,
    jobs: ctx.q.jobs().map((j) => j.id).sort().join(','),
  };
}
/** Nothing written, recorded or added since `before` (the record's bytes, confirmation.json, the queue). */
function unchangedProblems(ctx, before, label) {
  const after = stateOf(ctx);
  const p = [];
  if (after.recordWrites !== before.recordWrites) p.push(`the record was written ${after.recordWrites - before.recordWrites} time(s)`);
  if (after.record !== before.record) p.push(`the record changed: it is ${show(recordOf(ctx))}`);
  if (after.confWrites !== before.confWrites) p.push(`confirmation.json was written: ${show(lastWritten(ctx))}`);
  if (after.confirmation !== before.confirmation) p.push(`confirmation.json changed: it was ${before.confirmation} and is ${after.confirmation}`);
  if (after.adds !== before.adds || after.jobs !== before.jobs) p.push(`a job was added: the queue holds ${after.jobs || '(nothing)'}`);
  return p.map((x) => `${label}: ${x}`);
}
/** The record reads as it did (`before` from stateOf): the same text, or, when there was no file, nothing but empty. */
function recordAsBeforeProblems(ctx, before, label) {
  const now = ctx.world.record.bytes();
  if (now === before.record) return [];
  const norm = (t) => { if (t === null) return exact({ passes: {}, history: [] }); try { const r = JSON.parse(t); return exact({ passes: r.passes, history: r.history }); } catch (_) { return t; } };
  return norm(now) === norm(before.record) ? [] : [`${label}: the record should read as it did before (${before.record === null ? 'empty' : 'byte for byte'}); it is ${show(recordOf(ctx))}`];
}
/** Who as no answer may carry it (D4 "No answer carries a full pubkey or who"). */
function whoLeaks(v) {
  const s = JSON.stringify(v) || '';
  return [['the owner\'s pubkey', OWNER], ['the owner\'s pubkey in upper case', OWNER.toUpperCase()], ['an admin\'s pubkey', ADMIN], ['the owner\'s short key', OWNER_KEY], ['an admin\'s short key', ADMIN_KEY], ['a "who" member', '"who"'], ['a "mintedBy" member', '"mintedBy"'], ['a "kind" member', '"kind"']]
    .filter(([, n]) => s.includes(n)).map(([l]) => l);
}

// ─── the answers (D4) ──────────────────────────────────────────────────────────────────────────────────────────
function refusedProblems(a, status, code, ref = 'D4') {
  const b = a.body;
  const p = [];
  if (a.status !== status) p.push(`status ${a.status}, not ${status}`);
  if (b.success !== false) p.push('no success: false');
  if (b.code !== code) p.push(`code ${show(b.code)}, not '${code}'`);
  if (typeof b.error !== 'string' || !b.error) p.push(`no error text beside code (${adr7('D4')}: "The 409 and 500 bodies keep error beside code")`);
  const leaks = whoLeaks(b);
  if (leaks.length) p.push(`it carries ${leaks.join(', ')}`);
  return p.length ? [`${a.what} should answer ${status} { success: false, code: '${code}', error } (${adr7(ref)}): ${p.join('; ')}; it answered ${a.status} ${show(b)}`] : [];
}
/**
 * An accepted answer (D4's 200 rows): { success: true, confirmed: true, outcome, expiresAt: the written record's }, no
 * who and no nonce. want: { member: value | (v) => true-or-a-problem-string }.
 */
function acceptedProblems(ctx, a, outcome, want = {}) {
  const b = a.body;
  const p = [];
  if (a.status !== 200) p.push(`status ${a.status}, not 200`);
  if (b.success !== true || b.confirmed !== true) p.push('no { success: true, confirmed: true }');
  if (b.outcome !== outcome) p.push(`outcome ${show(b.outcome)}, not '${outcome}'`);
  const written = lastWritten(ctx);
  if (!written) p.push('no confirmation.json was written');
  else {
    if (b.expiresAt !== written.expiresAt) p.push(`expiresAt ${show(b.expiresAt)}, not the written record's ${show(written.expiresAt)}`);
    if (typeof written.nonce === 'string' && JSON.stringify(b).includes(written.nonce)) p.push('it carries the nonce');
  }
  for (const [k, v] of Object.entries(want)) {
    if (typeof v === 'function') { const why = v(b[k]); if (why !== true) p.push(`${k}: ${why}`); } else if (exact(b[k]) !== exact(v)) p.push(`${k} ${show(b[k])}, not ${show(v)}`);
  }
  const leaks = whoLeaks(b);
  if (leaks.length) p.push(`it carries ${leaks.join(', ')} (${adr7('D4')} "No answer carries a full pubkey or who")`);
  return p.length ? [`${a.what} should answer 200 { success: true, confirmed: true, outcome: '${outcome}', … } (${adr7('D4')}): ${p.join('; ')}; it answered ${a.status} ${show(b)}`] : [];
}
const notTrue = (v) => (v !== true ? true : `should not be true when nothing is busy, it is ${show(v)}`);
/** The confirm line (D5), exactly; `at` the confirmation's minted time. */
function confirmLineProblems(ctx, runId, at, label) {
  const want = { action: 'confirm', key: null, at, who: { ...OWNER_REC }, runId };
  const lines = confirmLines(ctx);
  if (lines.length !== 1 || exact(lines[0]) !== exact(want)) return [`${label}: the record's history should hold one confirm line ${show(want)} (${adr7('D5')}); its history is ${show(historyOf(ctx))}`];
  return [];
}
/** No start recorded for any key but those in `keep` since the test began (D2 step 5 writes a start for line-up only). */
function noNewStartProblems(ctx, keep, label) {
  const keys = new Set(keep || []);
  const starts = historyOf(ctx).filter((l) => l && l.action === 'start' && !keys.has(l.key));
  const entries = Object.entries(passesOf(ctx)).filter(([k, e]) => !keys.has(k) && e && e.start && e.start.who && e.start.who.kind === 'confirmation');
  return starts.length || entries.length ? [`${label}: no start should be recorded; the history holds ${show(starts)} and the passes ${show(entries)}`] : [];
}
/** One new job, under the randomKey's id, waiting; its start recorded as the confirmation; its line above the confirm line. */
function linedUpJobProblems(ctx, a, at, label) {
  const p = [];
  const adds = addsOf(ctx);
  const key = adds.length ? adds[adds.length - 1].args[2] && adds[adds.length - 1].args[2].jobId : undefined;
  if (!(typeof key === 'string' && LINEUP_ID.test(key) && ctx.world.keys.includes(key))) p.push(`one job should be added under the controller's randomKey() id (${adr6('D2')}); the adds are ${show(adds.map((c) => c.args[2]))}`);
  else {
    if (a.body.jobId !== key) p.push(`the answer's jobId ${show(a.body.jobId)} should be the job added, ${key}`);
    const state = ctx.q.state(key);
    if (state !== 'waiting' && state !== 'active') p.push(`the new job should be in line; it is ${state}`);
    const e = passesOf(ctx)[key];
    if (!e || exact(e.start) !== exact({ at, who: { ...CONFIRMATION_WHO } })) p.push(`the new job's start should be recorded as { at: ${at}, who: { kind: 'confirmation' } } (${adr7('D5')} "The start"); its entry is ${show(e)}`);
    const h = historyOf(ctx);
    const si = h.findIndex((l) => l && l.action === 'start' && l.key === key);
    const ci = h.findIndex((l) => l && l.action === 'confirm');
    if (si < 0 || ci < 0 || si > ci) p.push(`the start's line should sit above the confirm line (${adr7('D5')}: "the start shows above it"); the history is ${show(h)}`);
    if (ctx.ctl.gate.shouldAbandon({ id: key, timestamp: T0, data: H.lineUpData() }) !== false) p.push('the new job is marked to be skipped (shouldAbandon true)');
  }
  return p.map((x) => `${label}: ${x}`);
}

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CH1 — the module (D1)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('CH1: every controller instance, the default `controller` included, has confirm({ who, runId }) beside lineUp, stop, snapshot and gate; and lineUp\'s confirm mode is gone — with a pass waiting, lineUp({ who: { kind: \'confirmation\' }, mode: \'confirm\' }) is never answered as joined and adds nothing [ADR 0007 D1 "createController returns confirm beside lineUp, stop and snapshot"; "confirmStep goes. lineUp({mode: \'confirm\'}) is no longer called by anything; remove the mode"]', async () => {
  const mod = H.loadModule(MODULES.controller, { createController: 'function', controller: 'object' }, adr7('D1'));
  const p = [];
  if (typeof mod.controller.confirm !== 'function') p.push(`the default controller has no confirm() (${adr7('D1')}); it has ${show(Object.keys(mod.controller))}`);
  await withCtl(async (ctx) => {
    if (typeof ctx.ctl.confirm !== 'function') p.push(`createController(deps) has no confirm() (${adr7('D1')}); it has ${show(Object.keys(ctx.ctl))}`);
    await runKey(ctx);
    const adds = addsOf(ctx).length;
    const r = await within(ctx.ctl.lineUp({ who: { ...CONFIRMATION_WHO }, mode: 'confirm' }), 3000, "lineUp({ mode: 'confirm' })");
    const b = (r && r.body) || r || {};
    if (b.joined === true) p.push(`lineUp's confirm mode still joins a busy pass (${show(b)}); confirmStep is gone (${adr7('D1')})`);
    if (addsOf(ctx).length !== adds) p.push(`lineUp({ mode: 'confirm' }) with a pass waiting added a job (${adr7('D1')})`);
  });
  report(p);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CH2–CH5 — steps 1–3 (D2, D3)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('CH2: step 1, the report — a confirmation of a run that is not the latest report (an earlier run, and with no report at all), of a latest report that held nothing (done, or held.total 0), or while the held run\'s own process is still alive, is refused 409 not-the-latest-report, nothing-held or running, with its error text; nothing is written, recorded or added, and an earlier pending confirmation stays as it was [ADR 0007 D2 step 1 "Run validateConfirmation … 409 not-the-latest-report, nothing-held, or running"; "Nothing is written before step 5"; D4; story AC-2 "Only what the prompt showed"]', async () => {
  const earlier = H.confirmationRecord({ runId: '20261027T090000Z-0e0e0e0e', mintedBy: null });
  await cases([
    { name: 'a run that is not the latest', code: 'not-the-latest-report', o: { held: { runId: '20261027T100000Z-0a0a0a01' } }, then: (ctx) => { ctx.world.startPass(); ctx.world.endPass({ state: 'done' }); }, runId: () => '20261027T100000Z-0a0a0a01' },
    { name: 'no report at all', code: 'not-the-latest-report', o: { held: false }, runId: () => '20261027T100000Z-0a0a0a02' },
    { name: 'the latest pass finished done, holding nothing', code: 'nothing-held', o: { held: false }, then: (ctx) => { ctx.world.startPass(); ctx.world.endPass({ state: 'done' }); }, runId: (ctx) => ctx.world.report.latest.runId },
    { name: 'a held report whose held.total is 0', code: 'nothing-held', o: { held: { n: 0 } } },
    { name: 'the held run\'s own process still alive (its finishing window)', code: 'running', o: { held: { alive: true } } },
  ], (c) => withCtl(c.o, async (ctx) => {
    if (c.then) c.then(ctx);
    ctx.world.confirmation = H.clone(earlier);
    const before = stateOf(ctx);
    const runId = c.runId ? c.runId(ctx) : ctx.held.runId;
    const a = await confirm(ctx, { runId });
    report([...refusedProblems(a, 409, c.code, 'D2 step 1'), ...unchangedProblems(ctx, before, c.name)]);
  }));
});

test('CH3: step 2, the pending check — while a confirmation of this held list is pending (same run, same digest, unexpired), a second one is refused 409 { code: \'already-pending\', runId, expiresAt: the first one\'s, error } and changes nothing: the record is not written, confirmation.json keeps the first one\'s nonce and its 24 hours, and nothing is lined up — with nothing busy, with a pass waiting, and with the queue unavailable; one millisecond before its expiry it is still pending [ADR 0007 D2 step 2 "If pendingFor(record, latest, now) is true: 409 … Nothing is written or recorded"; D3 pendingFor; story AC-1 "A second confirmation while one is pending … the first keeps its 24 hours and its pass, and nothing new is recorded"; Test tasks "with a pass waiting and with the queue unavailable"]', async () => {
  await cases([
    { name: 'nothing busy', set: async () => {} },
    { name: 'a pass waiting', set: async (ctx) => { await runKey(ctx); } },
    { name: 'the queue unavailable', set: async (ctx) => { ctx.world.health = 'not-ready'; } },
    { name: 'one millisecond before its expiry', set: async (ctx) => { ctx.world.clock.set(Date.parse(ctx.world.confirmation.expiresAt) - 1); } },
  ], (c) => withCtl(async (ctx) => {
    const first = H.confirmationRecord({ runId: ctx.held.runId, heldDigest: ctx.held.digest, heldCount: 60, mintedAt: iso(T0 - HOUR), nonce: H.nonceOf('the-first'), mintedBy: null });
    ctx.world.confirmation = H.clone(first);
    await c.set(ctx);
    const before = stateOf(ctx);
    const a = await confirm(ctx);
    const p = refusedProblems(a, 409, 'already-pending', 'D2 step 2');
    if (a.body.code === 'already-pending' && (a.body.runId !== first.runId || a.body.expiresAt !== first.expiresAt)) p.push(`the refusal should name the pending one's run and expiry, ${show({ runId: first.runId, expiresAt: first.expiresAt })}; it names ${show({ runId: a.body.runId, expiresAt: a.body.expiresAt })}`);
    report([...p, ...unchangedProblems(ctx, before, c.name)]);
  }));
});

test('CH4: step 2, a confirmation that cannot be relied on is replaced — one that cannot be read, one whose expiry cannot be read, an expired one (and one expiring exactly now), one pending for an earlier pass while the latest pass holds a different list, one for this run with another digest, one of another version, and one that is not an object: each new confirmation is accepted (lined up), confirmation.json then holds the new record with a new nonce, and the confirm line is recorded; once a newer pass has run, the expired one\'s held list is refused not-the-latest-report and nothing changes [ADR 0007 D3 "Anything else is not pending and is replaced by step 6"; story AC-1 "A confirmation that cannot be relied on … Confirming replaces it"; "When the confirmation expires unused … It offers Confirm again for the same held list, as long as that pass is still the latest"; Test tasks "an expired confirmation: … refused once a newer pass ran"; "an unreadable confirmation, one with an unreadable expiry, and one pending for an earlier pass: a new confirmation accepted, replacing it"]', async () => {
  const of = (ctx, o) => H.confirmationRecord({ runId: ctx.held.runId, heldDigest: ctx.held.digest, mintedAt: iso(T0 - HOUR), nonce: H.nonceOf('old'), mintedBy: null, ...o });
  await cases([
    { name: 'a confirmation.json that cannot be read', set: (ctx) => { ctx.world.confirmation = of(ctx); ctx.world.confirmationError = 'EBADJSON'; } },
    { name: 'an expiry that cannot be read', set: (ctx) => { ctx.world.confirmation = of(ctx, { expiresAt: 'tomorrow' }); } },
    { name: 'an expired confirmation', set: (ctx) => { ctx.world.confirmation = of(ctx, { mintedAt: iso(T0 - 25 * HOUR) }); } },
    { name: 'a confirmation expiring exactly now', set: (ctx) => { ctx.world.confirmation = of(ctx, { mintedAt: iso(T0 - DAY_MS) }); } },
    { name: 'one pending for an earlier pass, while the latest holds a different list', setup: { held: { label: 'older', runId: '20261027T080000Z-0b0b0b0b' } }, set: (ctx) => { ctx.world.confirmation = of(ctx, { runId: ctx.older.runId, heldDigest: ctx.older.digest }); } },
    { name: 'one for this run with another digest', set: (ctx) => { ctx.world.confirmation = of(ctx, { heldDigest: 'f'.repeat(64) }); } },
    { name: 'one of version 2', set: (ctx) => { ctx.world.confirmation = of(ctx, { version: 2 }); } },
    { name: 'one that is not an object', set: (ctx) => { ctx.world.confirmation = ['not', 'a', 'record']; } },
  ], async (c) => {
    const ctx = mk(c.setup ? { held: false } : {});
    try {
      if (c.setup) { ctx.older = ctx.world.holdRemovals(c.setup.held); ctx.world.clock.advance(MIN); ctx.held = ctx.world.holdRemovals({ label: 'newer' }); }
      c.set(ctx);
      const at = nowIso(ctx);
      const a = await confirm(ctx);
      const p = acceptedProblems(ctx, a, 'lined-up', { enqueued: true });
      const now = ctx.world.confirmation;
      if (!now || now.runId !== ctx.held.runId || now.heldDigest !== ctx.held.digest || now.nonce === H.nonceOf('old') || now.mintedAt !== at) p.push(`confirmation.json should now hold the new record (this run, this digest, a new nonce, minted ${at}); it holds ${show(now)}`);
      p.push(...confirmLineProblems(ctx, ctx.held.runId, at, c.name));
      report(p);
    } finally { ctx.world.cleanup(); }
  });
  // Refused once a newer pass ran: the expired one's held list is no longer the latest's.
  await withCtl(async (ctx) => {
    const old = ctx.held.runId;
    ctx.world.confirmation = of(ctx, { mintedAt: iso(T0 - 25 * HOUR) });
    ctx.world.startPass();
    ctx.world.endPass({ state: 'done' });
    const before = stateOf(ctx);
    const a = await confirm(ctx, { runId: old });
    report([...refusedProblems(a, 409, 'not-the-latest-report', 'D2 step 1'), ...unchangedProblems(ctx, before, 'an expired confirmation once a newer pass ran')]);
  });
});

test('CH5: step 3, the held list — with no held file for the latest run, or a held file whose digest is not the report\'s held.digest, the confirmation is refused 409 held-list-changed and nothing is written, recorded or added [ADR 0007 D2 step 3 "readHeld(latest.runId); missing, or a digest unequal to latest.held.digest: 409 held-list-changed"]', async () => {
  await cases([
    { name: 'no held file', held: { file: false } },
    { name: 'a held file that no longer hashes to held.digest', held: { fileList: H.heldList(59, 'shorter') } },
  ], (c) => withCtl({ held: c.held }, async (ctx) => {
    const before = stateOf(ctx);
    const a = await confirm(ctx);
    report([...refusedProblems(a, 409, 'held-list-changed', 'D2 step 3'), ...unchangedProblems(ctx, before, c.name),
      ctx.world.callsOf('readHeld').length === 0 && `${c.name}: the held list was never read (setup: the path under test did not run)`]);
  }));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CH6–CH11 — step 4, the plan (D2 step 4)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('CH6: nothing busy — the confirmation lines up a pass: 200 { outcome: \'lined-up\', enqueued: true, jobId, behindStopping not true, expiresAt }; one job is added under the controller\'s own id and waits in line; the record holds the confirm line and, above it, the new job\'s start as the owner\'s confirmation; the confirmation is pending; and a status read then shows the new pass waiting, its start recorded [ADR 0007 D2 step 4 "otherwise (nothing busy …) → line-up"; step 5 "the start entry and its line under a new key from d.randomKey()"; D4 lined-up row; D5 "The start"; story AC-1 "When nothing is busy, confirming lines up a pass. Within 10 seconds every viewer sees it waiting"]', async () => {
  await withCtl(async (ctx) => {
    const at = nowIso(ctx);
    const a = await confirm(ctx);
    const p = [...acceptedProblems(ctx, a, 'lined-up', { enqueued: true, behindStopping: notTrue }), ...linedUpJobProblems(ctx, a, at, 'nothing busy'), ...confirmLineProblems(ctx, ctx.held.runId, at, 'nothing busy')];
    if (!ctx.world.confirmation || ctx.world.confirmation.runId !== ctx.held.runId) p.push(`the confirmation should be pending; confirmation.json is ${show(ctx.world.confirmation)}`);
    if (typeof a.body.jobId === 'string') {
      const s = await snap(ctx, false);
      const it = s.items.find((i) => i.key === a.body.jobId);
      if (!it || it.state !== 'waiting' || it.startRecorded !== true) p.push(`a status read should show ${a.body.jobId} waiting with startRecorded true (${adr6('D12')}); it shows ${show(s.items)}`);
    }
    report(p);
  });
});

test('CH7: a pass waiting with no stop asked for takes the confirmation up — for a Run waiting in line, one waiting for the heavy-task lock, a scheduled run come due, and a job picked up that the gate has not yet seen: 200 { outcome: \'waiting-pass\', enqueued: true, joined: true, expiresAt }; nothing new is lined up; the record gains only the confirm line, no start; the confirmation is pending [ADR 0007 D2 step 4 "a waiting item with no stop asked for → waiting-pass"; D4 waiting-pass row; story AC-1 "A pass waiting with no stop asked for: confirming starts nothing new. The answer says plainly that the waiting pass will take the confirmation up"; Test tasks "with a pass waiting, or a scheduled run come due and waiting: nothing new lined up"]', async () => {
  await cases(WAITING, (c) => withCtl(async (ctx) => {
    const b = await c.setup(ctx);
    const adds = addsOf(ctx).length;
    const at = nowIso(ctx);
    const a = await confirm(ctx);
    const p = [...acceptedProblems(ctx, a, 'waiting-pass', { enqueued: true, joined: true }), ...confirmLineProblems(ctx, ctx.held.runId, at, c.name), ...noNewStartProblems(ctx, [b && b.key], c.name)];
    if (addsOf(ctx).length !== adds) p.push(`${c.name}: nothing new may be lined up; the queue holds ${show(ctx.q.jobs().map((j) => j.id))}`);
    if (!ctx.world.confirmation || ctx.world.confirmation.runId !== ctx.held.runId) p.push(`${c.name}: the confirmation should be pending for the waiting pass; confirmation.json is ${show(ctx.world.confirmation)}`);
    report(p);
  }));
});

test('CH8: a starting pass (launched, no report yet) takes the confirmation up — 200 { outcome: \'starting-pass\', enqueued: true, joined: true }, nothing new lined up, only the confirm line recorded — and it is named ahead of a pass waiting behind it (a due scheduled run) [ADR 0007 D2 step 4 "a running item with no stop asked for (starting: runId null …) → starting-pass"; "A starting pass is ahead of any waiting one, so it is named first"; § Readings 1 "A starting pass is joined, not refused"; story AC-1 "A pass that has only just started, before it records itself as the latest, may still take the confirmation up; the answer says which happened"]', async () => {
  await cases([
    { name: 'a pass starting', setup: async (ctx) => starting(ctx) },
    { name: 'a pass starting, a due scheduled run waiting behind it', setup: async (ctx) => { const s = await starting(ctx); ctx.q.plantScheduled({ millis: ctx.world.clock.now() - MIN, every: 6 * HOUR }); return s; } },
  ], (c) => withCtl(async (ctx) => {
    const s = await c.setup(ctx);
    const adds = addsOf(ctx).length;
    const at = nowIso(ctx);
    const a = await confirm(ctx);
    const p = [...acceptedProblems(ctx, a, 'starting-pass', { enqueued: true, joined: true }), ...confirmLineProblems(ctx, ctx.held.runId, at, c.name), ...noNewStartProblems(ctx, [s.key], c.name)];
    if (addsOf(ctx).length !== adds) p.push(`${c.name}: nothing new may be lined up`);
    report(p);
  }));
});

test('CH9: the queue not ok comes first — never initialised, Redis not ready, a queue read that fails, and a read that fails while a pass is starting: 200 { outcome: \'not-lined-up\', enqueued: false, reason: \'QUEUE_UNAVAILABLE\', expiresAt }; nothing is added; the confirmation is made and kept pending; the confirm line is recorded and no start [ADR 0007 D2 step 4 "queue !== \'ok\' → none, with reason: \'QUEUE_UNAVAILABLE\'" (first in precedence); D4 not-lined-up row; story AC-1 "When the confirmation is made but no pass is lined up … the confirmation is kept pending"; Test tasks "no pass lined up (the queue unavailable …): kept pending, and the answer says so"]', async () => {
  await cases([
    { name: 'the queue never initialised', set: async (ctx) => { ctx.world.health = 'off'; } },
    { name: 'Redis not ready', set: async (ctx) => { ctx.world.health = 'not-ready'; } },
    { name: 'a queue read that fails', set: async (ctx) => { ctx.q.inject('getDelayed', { error: 'ECONNRESET' }); } },
    { name: 'a read that fails while a pass is starting', set: async (ctx) => { const s = await starting(ctx); ctx.q.inject('getJobs', { error: 'ECONNRESET' }); return s.key; } },
  ], (c) => withCtl(async (ctx) => {
    const own = await c.set(ctx);
    const adds = addsOf(ctx).length;
    const at = nowIso(ctx);
    const a = await confirm(ctx);
    const p = [...acceptedProblems(ctx, a, 'not-lined-up', { enqueued: false, reason: 'QUEUE_UNAVAILABLE' }), ...confirmLineProblems(ctx, ctx.held.runId, at, c.name), ...noNewStartProblems(ctx, [own], c.name)];
    if (addsOf(ctx).length !== adds) p.push(`${c.name}: nothing may be added`);
    if (!ctx.world.confirmation || ctx.world.confirmation.runId !== ctx.held.runId) p.push(`${c.name}: the confirmation should be kept pending; confirmation.json is ${show(ctx.world.confirmation)}`);
    report(p);
  }));
});

test('CH10: every busy pass has a stop asked for — a pass waiting for the lock and a pass starting, each whose stop is on record — so none takes the confirmation up: a new pass is lined up, 200 { outcome: \'lined-up\', enqueued: true, jobId, behindStopping: true }, its start recorded as the confirmation; never waiting-pass, starting-pass or taken-up [ADR 0007 D2 step 4 "every busy item has a stop asked for → line-up, with behindStopping: true when anything is busy"; story AC-1 "Every busy pass has a stop asked for: none of them takes the confirmation up. Confirming lines up a new pass … and the answer says so"; Test tasks "never answered as taken up by a pass that is stopping"]', async () => {
  await cases([
    { name: 'a pass waiting for the lock, its stop on record', setup: (ctx) => lockWait(ctx, STOP_KEY) },
    { name: 'a pass starting, its stop on record', setup: (ctx) => starting(ctx, STOP_KEY) },
  ], (c) => withCtl({ world: { record: { record: stoppedEntryRecord(STOP_KEY) } } }, async (ctx) => {
    await addJob(ctx, STOP_KEY);
    await c.setup(ctx);
    const s = await snap(ctx);
    const it = s.items.find((i) => i.key === STOP_KEY);
    assert(it && it.stopAskedAt != null && s.items.length === 1, `setup: ${STOP_KEY} should be the one busy item, with a stop asked for; busy ${show(s.items)}`);
    const at = nowIso(ctx);
    const a = await confirm(ctx);
    report([...acceptedProblems(ctx, a, 'lined-up', { enqueued: true, behindStopping: true }), ...linedUpJobProblems(ctx, a, at, c.name), ...confirmLineProblems(ctx, ctx.held.runId, at, c.name)]);
  }));
});

test('CH11: the seconds after a pass ends — the held run itself has ended while its job is still active (the finishing window), and again once the gate has ended the job and the queue completed it: the confirmation lines up a NEW job (behindStopping not true), which waits behind the ending one and is picked up once it completes, nothing joining; never waiting-pass, starting-pass or taken-up [ADR 0007 D2 step 4 "nothing busy, the finishing window included … → line-up"; story AC-1 "Never a false answer … That includes the few seconds after a pass ends"; Test tasks "in the seconds after a pass ends: lined up, or a plain answer that none will"; ledger 2026-09-28-confirm-route-joins-finishing-job]', async () => {
  await cases([{ name: 'the finishing window', end: false }, { name: 'after the gate ended the job', end: true }], (c) => withCtl({ held: false }, async (ctx) => {
    const k = await runKey(ctx);
    const { job } = await starting(ctx, k);
    ctx.world.clock.advance(SEC);
    ctx.held = ctx.world.holdRemovals({ jobId: k, startedAt: nowIso(ctx) });
    ctx.world.clock.advance(3 * SEC);
    if (c.end) { ctx.ctl.gate.ended(job); ctx.q.complete(k); }
    assert((await snap(ctx)).items.length === 0, `setup: the ending job should not be busy (${adr6('D5')})`);
    const at = nowIso(ctx);
    const a = await confirm(ctx);
    const p = [...acceptedProblems(ctx, a, 'lined-up', { enqueued: true, behindStopping: notTrue }), ...linedUpJobProblems(ctx, a, at, c.name)];
    const k2 = a.body.jobId;
    if (ctx.q.joins.length) p.push(`the start joined the ending job: ${show(ctx.q.joins)}`);
    if (typeof k2 === 'string' && k2 !== k) {
      if (!c.end) { ctx.ctl.gate.ended(job); ctx.q.complete(k); }
      const next = ctx.q.pickUp();
      if (!next || next.id !== k2) p.push(`the new job should be picked up next; got ${show(next && next.id)}`);
    }
    report(p);
  }));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CH12–CH14 — steps 5 and 6 (D2 steps 5–6, D5)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('CH12: the record first — with a record that gives a read error, or a record write that fails, the confirmation is refused 500 { code: \'record-unavailable\', cause } and nothing else is written: no confirmation.json (none stays none, and an expired earlier one stays as it was), no job, the record\'s bytes unchanged — whether the plan was to line up, to leave it to a waiting pass, or the queue was unavailable; and on an accepted confirmation the record is written before confirmation.json [ADR 0007 D2 step 5 "The record is unreadable, or the write fails → 500 {code: \'record-unavailable\', cause}. Nothing else is written"; D5 "Refused when it cannot be written. This replaces ADR 0006 D8\'s \'cannot be refused for want of a record\'"; story AC-4 "When the server cannot record it, Confirm is refused, as Run is, and changes nothing"]', async () => {
  const expired = (ctx) => H.confirmationRecord({ runId: ctx.held.runId, heldDigest: ctx.held.digest, mintedAt: iso(T0 - 25 * HOUR), nonce: H.nonceOf('expired'), mintedBy: null });
  const faults = [{ name: 'a record that gives a read error', fail: (ctx) => ctx.world.record.failReads('EIO'), cause: 'EIO' }, { name: 'a record write that fails', fail: (ctx) => ctx.world.record.failWrites('ENOSPC'), cause: 'ENOSPC' }];
  const plans = [
    { name: 'nothing busy (line-up)', set: async () => {}, prior: () => null },
    // A job added another way, not a Run: a Run would load the record into this controller first, and a read error
    // is seen only by a read (0006 D11 "Before writing, a step re-reads the record if its last read was not readable").
    { name: 'a pass waiting (waiting-pass)', set: async (ctx) => { await addJob(ctx, H.lineUpKey(310)); }, prior: expired },
    { name: 'the queue unavailable (none)', set: async (ctx) => { ctx.world.health = 'off'; }, prior: expired },
  ];
  const list = [];
  for (const f of faults) for (const pl of plans) list.push({ name: `${f.name}, ${pl.name}`, f, pl });
  await cases(list, (c) => withCtl({ world: { record: { record: H.recordFile({ passes: {}, history: [] }) } } }, async (ctx) => {
    await c.pl.set(ctx);
    ctx.world.confirmation = c.pl.prior(ctx);
    c.f.fail(ctx);
    const before = stateOf(ctx);
    const a = await confirm(ctx);
    const p = refusedProblems(a, 500, 'record-unavailable', 'D2 step 5');
    if (a.body.code === 'record-unavailable' && a.body.cause !== allowErrorCode(c.f.cause)) p.push(`the cause should be ${allowErrorCode(c.f.cause)} (through allowErrorCode); it is ${show(a.body.cause)}`);
    const after = stateOf(ctx);
    p.push(...unchangedProblems(ctx, { ...before, recordWrites: after.recordWrites }, c.name));
    if (c.f.cause === 'EIO' && after.recordWrites !== before.recordWrites) p.push(`${c.name}: a record that gives a read error must not be written`);
    report(p);
  }));
  await withCtl(async (ctx) => {
    await confirm(ctx);
    const w = ctx.world.callsOf('writeRecord').map((x) => x.seq)[0];
    const cw = ctx.world.callsOf('writeConfirmation').map((x) => x.seq)[0];
    report([!(w !== undefined && cw !== undefined && w < cw) && `the record should be written before confirmation.json (${adr7('D2 step 5')} "The record first"); the calls were ${show(ctx.world.names().filter((n) => n === 'writeRecord' || n === 'writeConfirmation'))}`]);
  });
});

test('CH13: confirmation.json is exactly { version: 1, runId, heldDigest, heldCount (the held file\'s length), nonce (the nonce dep\'s, 32 lower-case hex), mintedAt, expiresAt } — no mintedBy and no who — with mintedAt the confirm line\'s `at` and expiresAt 24 hours later, and the answer\'s expiresAt the same; nonce() is asked once — for each accepted plan: lined up, a waiting pass, a starting pass, and none (the queue unavailable) [ADR 0007 D2 step 6 "Write {version: 1, runId, heldDigest, heldCount: list.length, nonce, mintedAt, expiresAt}, with mintedAt the confirm line\'s at and expiresAt 24 h later. No mintedBy"; D1 nonce(); story AC-4 "Who may read it"]', async () => {
  await cases([
    { name: 'lined up', outcome: 'lined-up', set: async () => {} },
    { name: 'a waiting pass', outcome: 'waiting-pass', set: async (ctx) => { await runKey(ctx); } },
    { name: 'a starting pass', outcome: 'starting-pass', set: async (ctx) => { await starting(ctx); } },
    { name: 'the queue unavailable', outcome: 'not-lined-up', set: async (ctx) => { ctx.world.health = 'off'; } },
  ], (c) => withCtl(async (ctx) => {
    await c.set(ctx);
    ctx.world.clock.advance(1234);
    const at = nowIso(ctx);
    const a = await confirm(ctx);
    const p = acceptedProblems(ctx, a, c.outcome);
    const writes = ctx.world.confirmationWrites;
    const rec = writes[0];
    if (writes.length !== 1) p.push(`confirmation.json should be written once; it was written ${writes.length} time(s)`);
    if (rec) {
      const want = { version: 1, runId: ctx.held.runId, heldDigest: ctx.held.digest, heldCount: ctx.held.list.length, nonce: ctx.world.nonces[0], mintedAt: at, expiresAt: iso(Date.parse(at) + DAY_MS) };
      if (exact(Object.keys(rec).sort()) !== exact(CONF_KEYS.slice().sort())) p.push(`its members should be exactly ${show(CONF_KEYS)}; they are ${show(Object.keys(rec))}`);
      if (exact(rec) !== exact(want)) p.push(`it should be ${show(want)}; it is ${show(rec)}`);
      if (has(rec, 'mintedBy') || whoLeaks(rec).length) p.push(`it carries who: ${show(rec)} (${adr7('D2 step 6')} "No mintedBy")`);
    }
    if (ctx.world.nonces.length !== 1 || !/^[0-9a-f]{32}$/.test(String(ctx.world.nonces[0]))) p.push(`nonce() should be asked once (${adr7('D1')}); it was asked ${ctx.world.nonces.length} time(s)`);
    p.push(...confirmLineProblems(ctx, ctx.held.runId, at, c.name));
    report(p);
  }));
});

test('CH14: a confirmation.json write that fails — the record is taken back to what it was, byte for byte, and the answer is 500 { code: \'confirmation-unwritten\', cause }; nothing is pending (an earlier expired confirmation stays as it was, none stays none) and no job is added — for the line-up plan (its start taken back too) and for a waiting pass, over a record that held earlier actions [ADR 0007 D2 step 6 "A failed write: take the record back to prior, best effort, and answer 500 {code: \'confirmation-unwritten\', cause}. Nothing is pending"]', async () => {
  const seeded = () => {
    const k = H.lineUpKey(800);
    const t = iso(T0 - HOUR);
    return H.recordFile({ passes: { [k]: H.recordEntry({ jobId: k, start: { at: t, who: { ...OWNER_REC } } }) }, history: [H.historyLine('start', k, t, { ...OWNER_REC })] });
  };
  await cases([
    { name: 'the line-up plan, nothing pending before', set: async () => {}, prior: () => null },
    { name: 'a waiting pass, an expired confirmation before', set: async (ctx) => { await runKey(ctx); }, prior: (ctx) => H.confirmationRecord({ runId: ctx.held.runId, heldDigest: ctx.held.digest, mintedAt: iso(T0 - 25 * HOUR), mintedBy: null }) },
  ], (c) => withCtl({ world: { record: { record: seeded() } } }, async (ctx) => {
    await c.set(ctx);
    ctx.world.confirmation = c.prior(ctx);
    const before = stateOf(ctx);
    ctx.world.confirmationWriteError = 'ENOSPC';
    const a = await confirm(ctx);
    const p = refusedProblems(a, 500, 'confirmation-unwritten', 'D2 step 6');
    if (a.body.code === 'confirmation-unwritten' && a.body.cause !== 'ENOSPC') p.push(`the cause should be ENOSPC; it is ${show(a.body.cause)}`);
    if (ctx.world.callsOf('writeConfirmation').length !== 1) p.push(`setup: confirmation.json's write should have been tried once; it was tried ${ctx.world.callsOf('writeConfirmation').length} time(s)`);
    if (ctx.world.record.bytes() !== before.record) p.push(`the record should be back as it was, byte for byte; it is ${show(recordOf(ctx))}`);
    if (JSON.stringify(ctx.world.confirmation) !== before.confirmation) p.push(`nothing may be pending: confirmation.json was ${before.confirmation} and is ${JSON.stringify(ctx.world.confirmation)}`);
    if (addsOf(ctx).length !== before.adds) p.push('a job was added');
    report(p);
  }));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CH15–CH18 — step 7, the re-read and its withdraw (D2 step 7, R11)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** A pass records itself the moment confirmation.json is written (and, with claim, claims it): → () => its runId. */
function passStartsAfterWrite(ctx, { claim = false, jobId = null } = {}) {
  let runId = null;
  ctx.world.onCall('writeConfirmation', () => {
    const rec = ctx.world.startPass({ jobId });
    runId = rec.runId;
    if (claim) ctx.world.claim(rec.runId);
  });
  return () => runId;
}

test('CH15: a pass that recorded itself after the confirmation was written, and has not claimed it — the re-read sees it latest, the confirmation is withdrawn (renamed away), the record is taken back to what it was, and the answer is 409 { code: \'pass-started\', error }; nothing is added and nothing is pending — for the line-up plan and a waiting pass [ADR 0007 D2 step 7 "renamed: take the record back to prior → 409 {code: \'pass-started\'}. Nothing changed"; story AC-1 "When a pass starts while the confirmation is being made … the confirmation was withdrawn and nothing changed"; Test tasks "a pass starting mid-confirmation: … withdrawn …"]', async () => {
  await cases([{ name: 'the line-up plan', set: async () => null }, { name: 'a waiting pass', set: async (ctx) => runKey(ctx) }], (c) => withCtl(async (ctx) => {
    const k = await c.set(ctx);
    const before = stateOf(ctx);
    const started = passStartsAfterWrite(ctx, { jobId: k });
    const a = await confirm(ctx);
    const p = refusedProblems(a, 409, 'pass-started', 'D2 step 7');
    if (!started()) p.push('setup: the pass never started (confirmation.json was not written)');
    p.push(...recordAsBeforeProblems(ctx, before, 'taken back'));
    if (ctx.world.confirmation !== null || ctx.world.withdrawn.length !== 1) p.push(`the confirmation should be withdrawn; confirmation.json is ${show(ctx.world.confirmation)}, withdrawn ${ctx.world.withdrawn.length}`);
    if (addsOf(ctx).length !== before.adds) p.push('a job was added');
    report(p);
  }));
});

test('CH16: a pass that claimed the confirmation between its write and the re-read — the withdraw finds nothing, and the answer is 200 { outcome: \'taken-up\', enqueued: false, claimedBy: that pass\'s run id, expiresAt }; the confirm line stays and any start is taken back, nothing is added — for the line-up plan (its start taken back) and a waiting pass [ADR 0007 D2 step 7 "already gone (that pass claimed it): take back only the start, if any (takeBackStart) → 200 {outcome: \'taken-up\', claimedBy}"; § Seams "a claim landing between steps 6 and 7 (the fake withdrawConfirmation answers false)"; story AC-1 "the answer says plainly which of these happened: that pass took the confirmation up"]', async () => {
  await cases([{ name: 'the line-up plan', set: async () => null }, { name: 'a waiting pass', set: async (ctx) => runKey(ctx) }], (c) => withCtl(async (ctx) => {
    const k = await c.set(ctx);
    const adds = addsOf(ctx).length;
    const at = nowIso(ctx);
    const claimer = passStartsAfterWrite(ctx, { claim: true, jobId: k });
    const a = await confirm(ctx);
    const p = acceptedProblems(ctx, a, 'taken-up', { enqueued: false, claimedBy: claimer() });
    p.push(...confirmLineProblems(ctx, ctx.held.runId, at, c.name), ...noNewStartProblems(ctx, [k], c.name));
    if (addsOf(ctx).length !== adds) p.push('a job was added');
    if (![...ctx.world.claimed].some((n) => n.startsWith(`${claimer()}-`))) p.push('setup: the pass never claimed it');
    report(p);
  }));
});

test('CH17: a withdraw that throws — the answer is 500 { code: \'withdraw-failed\', cause }, the server cannot tell whether the confirmation stands: the confirm line stays so the history shows it, any start is taken back, nothing is added, and confirmation.json is left as written [ADR 0007 D2 step 7 "the rename threw: take back only the start → 500 {code: \'withdraw-failed\', cause}. The confirmation may stand; the confirm line stays"; story AC-1 "When the server cannot tell whether the confirmation stands, the panel says so"]', async () => {
  await withCtl(async (ctx) => {
    const at = nowIso(ctx);
    const started = passStartsAfterWrite(ctx);
    ctx.world.withdrawError = 'EIO';
    const a = await confirm(ctx);
    const p = refusedProblems(a, 500, 'withdraw-failed', 'D2 step 7');
    if (a.body.code === 'withdraw-failed' && a.body.cause !== 'EIO') p.push(`the cause should be EIO; it is ${show(a.body.cause)}`);
    if (!started()) p.push('setup: the pass never started');
    p.push(...confirmLineProblems(ctx, ctx.held.runId, at, 'a withdraw that throws'), ...noNewStartProblems(ctx, [], 'a withdraw that throws'));
    if (addsOf(ctx).length) p.push('a job was added');
    if (!ctx.world.confirmation || ctx.world.confirmation.runId !== ctx.held.runId) p.push(`confirmation.json should be left as written; it is ${show(ctx.world.confirmation)}`);
    report(p);
  });
});

test('CH18: a pass that records itself between the report check and the plan (a hand run, R11) — the plan sees it running, but the re-read catches it: unclaimed, the answer is 409 pass-started with nothing changed; claimed, 200 taken-up naming it — never starting-pass, waiting-pass or lined-up [ADR 0007 R11 "A pass started outside the gate … can record itself between the snapshot and the re-read. The withdraw race then decides it"; D2 step 4 "or, defensively, any other → starting-pass"; step 7; story AC-1 "Never a false answer"]', async () => {
  await cases([{ name: 'unclaimed', claim: false }, { name: 'claimed at its step 7', claim: true }], (c) => withCtl(async (ctx) => {
    const before = stateOf(ctx);
    let runId = null;
    ctx.world.onCall('readReport', () => { runId = ctx.world.startPass().runId; });
    if (c.claim) ctx.world.onCall('writeConfirmation', () => { ctx.world.claim(runId); });
    const a = await confirm(ctx);
    const p = [];
    if (!runId) p.push('setup: the hand run never started (the step read no report)');
    if (c.claim) p.push(...acceptedProblems(ctx, a, 'taken-up', { enqueued: false, claimedBy: runId }));
    else {
      p.push(...refusedProblems(a, 409, 'pass-started', 'R11; D2 step 7'));
      p.push(...recordAsBeforeProblems(ctx, before, 'unclaimed'));
    }
    if (addsOf(ctx).length) p.push(`a job was added: ${show(ctx.q.jobs().map((j) => j.id))}`);
    report(p);
  }));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CH19–CH21 — step 8 and the record (D2 step 8, takeBackStart, D5)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('CH19: an add that fails or times out — the key goes into skips (a late landing completes without spawning), the start is taken back, the confirm line stays, the confirmation stays pending, and the answer is 200 { outcome: \'not-lined-up\', enqueued: false, reason } — QUEUE_UNAVAILABLE for a time-out; \'error\' (with its cause) or QUEUE_UNAVAILABLE for a refused add [ADR 0007 D2 step 8 "A failure or time-out: put the key in skips (R1), take back only the start, and answer 200 {outcome: \'not-lined-up\', reason: \'QUEUE_UNAVAILABLE\' | \'error\', cause?}. The confirmation stays pending"; story AC-1 "(… the server failing to line one up), the confirmation is kept pending … gives the server\'s reason"]', async () => {
  await cases([
    { name: 'an add that times out, then lands', fault: { hang: true }, lands: true, reasons: ['QUEUE_UNAVAILABLE'] },
    { name: 'an add that is refused', fault: { error: 'ECONNRESET' }, reasons: ['error', 'QUEUE_UNAVAILABLE'] },
  ], (c) => withCtl(async (ctx) => {
    ctx.q.inject('add', c.fault);
    const at = nowIso(ctx);
    const a = await confirm(ctx);
    const key = addsOf(ctx).length ? addsOf(ctx)[0].args[2].jobId : null;
    const p = acceptedProblems(ctx, a, 'not-lined-up', { enqueued: false, reason: (v) => (c.reasons.includes(v) ? true : `should be ${c.reasons.join(' or ')}, it is ${show(v)}`) });
    if (a.body.reason === 'error' && a.body.cause !== allowErrorCode('ECONNRESET')) p.push(`a refused add's cause should be ECONNRESET; it is ${show(a.body.cause)}`);
    if (!key) p.push('setup: no add was tried');
    else {
      if (ctx.ctl.gate.shouldAbandon({ id: key, timestamp: T0, data: H.lineUpData() }) !== true) p.push(`the key ${key} should be in skips (shouldAbandon true)`);
      if (historyOf(ctx).some((l) => l && l.key === key) || (passesOf(ctx)[key] && passesOf(ctx)[key].start)) p.push(`the start of ${key} should be taken back; the record is ${show(recordOf(ctx))}`);
    }
    p.push(...confirmLineProblems(ctx, ctx.held.runId, at, c.name));
    if (!ctx.world.confirmation || ctx.world.confirmation.runId !== ctx.held.runId) p.push(`the confirmation should stay pending; confirmation.json is ${show(ctx.world.confirmation)}`);
    if (c.lands && key) {
      ctx.q.releaseHangs();
      await H.waitFor(() => ctx.q.has(key), { what: 'the late add to land' });
      const job = pick1(ctx, key);
      if ((await gateStep(ctx, 'beforeAcquire', job)) !== 'skip') p.push('the late landing should be skipped at pickup');
    }
    report(p);
  }));
});

const FULL_KEYS = Array.from({ length: 10 }, (_, i) => H.lineUpKey(600 + i));
function fullRecord() {
  const passes = {};
  const history = [];
  FULL_KEYS.forEach((k, i) => {
    const at = iso(T0 - HOUR + i * SEC);
    passes[k] = H.recordEntry({ jobId: k, start: { at, who: { ...OWNER_REC } } });
    history.unshift(H.historyLine('start', k, at, { ...OWNER_REC }));
  });
  return H.recordFile({ passes, history });
}

test('CH20: takeBackStart over a record already at the history\'s cap — after a failed add, the record reads as if only the confirmation had been asked for: the confirm line on top of the nine newest earlier lines, the start\'s entry and line gone, and every earlier line\'s entry as it was [ADR 0007 D2 "takeBackStart: restore prior\'s passes and history, then re-add the confirm line, pruned as every write is. The record then reads as if only the confirmation had been asked for (the ADR 0006 Amendment 1 § C rule)"]', async () => {
  await withCtl({ world: { record: { record: fullRecord() } } }, async (ctx) => {
    const prior = recordOf(ctx);
    ctx.q.inject('add', { error: 'ECONNRESET' });
    const at = nowIso(ctx);
    const a = await confirm(ctx);
    const key = addsOf(ctx).length ? addsOf(ctx)[0].args[2].jobId : null;
    const p = acceptedProblems(ctx, a, 'not-lined-up', { enqueued: false });
    const h = historyOf(ctx);
    const want = [{ action: 'confirm', key: null, at, who: { ...OWNER_REC }, runId: ctx.held.runId }, ...prior.history.slice(0, 9)];
    if (exact(h) !== exact(want)) p.push(`the history should be the confirm line over the nine newest earlier lines; it is ${show(h)}`);
    if (!key) p.push('setup: no add was tried');
    else if (has(passesOf(ctx), key)) p.push(`the start's entry ${key} should be gone; it is ${show(passesOf(ctx)[key])}`);
    for (const l of prior.history.slice(0, 9)) if (exact(passesOf(ctx)[l.key]) !== exact(prior.passes[l.key])) p.push(`the entry of ${l.key} should be as it was; it is ${show(passesOf(ctx)[l.key])}`);
    if (has(passesOf(ctx), 'null') || has(passesOf(ctx), '')) p.push('the confirm line keeps an entry (a null key keeps none)');
    report(p);
  });
});

test('CH21: the confirm line is exactly { action: \'confirm\', key: null, at: the minted time, who: { kind: \'owner\', key: <8 hex> }, runId: the held run\'s id } — whether who comes with the full key or already shortened — in a record of version 1 that keeps no entry for it and holds no full pubkey; an earlier action\'s line and entry stay [ADR 0007 D5 "The line. D11\'s history gains {action: \'confirm\', key: null, at: <mintedAt>, who: {kind: \'owner\', key: <8 hex>}, runId}. version stays 1"; "Pruning is unchanged: a line whose key is null keeps no entry"; D1 "normalWho keeps an 8-character key for the owner"; story AC-4 "Every confirmation the server accepts records the owner, with a shortened key, and when"]', async () => {
  await cases([{ name: 'who with the full key', who: OWNER_IN }, { name: 'who already shortened', who: OWNER_REC }], (c) => withCtl({ world: { record: { record: stoppedEntryRecord(H.lineUpKey(301)) } } }, async (ctx) => {
    const at = nowIso(ctx);
    const prior = recordOf(ctx);
    await confirm(ctx, { who: { ...c.who } });
    const r = recordOf(ctx);
    const p = confirmLineProblems(ctx, ctx.held.runId, at, c.name);
    if (r.version !== 1) p.push(`the record's version should stay 1; it is ${show(r.version)}`);
    if (has(r.passes, 'null') || has(r.passes, '')) p.push('the confirm line keeps an entry');
    const bytes = String(ctx.world.record.bytes());
    if (bytes.includes(OWNER) || bytes.includes(ADMIN)) p.push('the record holds a full pubkey');
    const k = H.lineUpKey(301);
    if (exact(r.passes[k]) !== exact(prior.passes[k]) || !historyOf(ctx).some((l) => l.action === 'stop' && l.key === k)) p.push(`the earlier stop's entry and line should stay; the record is ${show(r)}`);
    report(p);
  }));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CH22 — every path bumps the generation (D2)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('CH22: every path of the step bumps the generation — a status read cached before the confirmation is never served after it: once a pass appears behind the controller\'s back, the next status read shows it — for each answer: not-the-latest-report, nothing-held, running, already-pending, held-list-changed, record-unavailable, confirmation-unwritten, pass-started, taken-up, withdraw-failed, not-lined-up (the queue off, and an add that fails), waiting-pass, starting-pass and lined-up [ADR 0007 D2 "every path bumps generation"; ADR 0006 D5 "Caching, for the status route only … A cached or in-flight status snapshot from an older generation is neither served nor stored"]', async () => {
  const ok = (code) => (a) => a.body.code === code || a.body.outcome === code;
  await cases([
    { name: 'not-the-latest-report', runId: () => '20261027T100000Z-0c0c0c0c', want: ok('not-the-latest-report') },
    { name: 'nothing-held', o: { held: { n: 0 } }, want: ok('nothing-held') },
    { name: 'running', o: { held: { alive: true } }, want: ok('running') },
    { name: 'already-pending', set: (ctx) => { ctx.world.confirmation = H.confirmationRecord({ runId: ctx.held.runId, heldDigest: ctx.held.digest, mintedAt: iso(T0 - HOUR), mintedBy: null }); }, want: ok('already-pending') },
    { name: 'held-list-changed', o: { held: { file: false } }, want: ok('held-list-changed') },
    { name: 'record-unavailable', set: (ctx) => ctx.world.record.failWrites('ENOSPC'), want: ok('record-unavailable') },
    { name: 'confirmation-unwritten', set: (ctx) => { ctx.world.confirmationWriteError = 'ENOSPC'; }, want: ok('confirmation-unwritten') },
    { name: 'pass-started', set: (ctx) => passStartsAfterWrite(ctx), want: ok('pass-started') },
    { name: 'taken-up', set: (ctx) => passStartsAfterWrite(ctx, { claim: true }), want: ok('taken-up') },
    { name: 'withdraw-failed', set: (ctx) => { passStartsAfterWrite(ctx); ctx.world.withdrawError = 'EIO'; }, want: ok('withdraw-failed') },
    { name: 'not-lined-up, the queue off', set: (ctx) => { ctx.world.health = 'off'; }, want: ok('not-lined-up') },
    { name: 'not-lined-up, the add refused', set: (ctx) => ctx.q.inject('add', { error: 'ECONNRESET' }), want: ok('not-lined-up') },
    { name: 'waiting-pass', set: async (ctx) => { await runKey(ctx); }, want: ok('waiting-pass') },
    { name: 'starting-pass', set: async (ctx) => { await starting(ctx); }, want: ok('starting-pass') },
    { name: 'lined-up', want: ok('lined-up') },
  ], (c) => withCtl(c.o || {}, async (ctx) => {
    if (c.set) await c.set(ctx);
    await snap(ctx, false); // cached for up to a second while the generation stands
    const a = await confirm(ctx, { runId: c.runId ? c.runId() : ctx.held.runId });
    assert(c.want(a), `setup: the confirmation should have answered ${c.name}; it answered ${a.status} ${show(a.body)}`);
    const rec = ctx.world.startPass({ jobId: H.lineUpKey(990) }); // behind the controller's back: no step sees it
    const s = await snap(ctx, false);
    report([!s.items.some((i) => i && i.runId === rec.runId) && `${c.name}: a status read after the confirmation was served from the snapshot cached before it, which cannot show the pass that appeared since (${adr7('D2')} "every path bumps generation"); it lists ${show(s.items)}`]);
  }));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CH23–CH25 — interleavings, and never a false answer
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('CH23: a second confirmation queued behind the first in the chain is refused already-pending, with the first one\'s expiry — with nothing busy (the first lines up a pass) and with the queue unavailable (the first is kept pending, no pass lined up): one confirmation.json write, one confirm line, at most one job [ADR 0007 Option A "Two confirmations are serialised, so a second is refused needs no file lock"; § Seams "A second confirm queued behind the first"; story AC-1 "A second confirmation while one is pending is refused plainly, for example one sent from another tab or the console snippet"]', async () => {
  await cases([{ name: 'nothing busy', first: 'lined-up', set: () => {} }, { name: 'the queue unavailable', first: 'not-lined-up', set: (ctx) => { ctx.world.health = 'not-ready'; } }], (c) => withCtl(async (ctx) => {
    c.set(ctx);
    confirmOf(ctx.ctl);
    const [r1, r2] = await within(Promise.all([ctx.ctl.confirm({ who: OWNER_IN, runId: ctx.held.runId }), ctx.ctl.confirm({ who: OWNER_IN, runId: ctx.held.runId })]), 4000, 'two confirmations');
    const a1 = answerOf(r1, 'the first confirmation');
    const a2 = answerOf(r2, 'the second confirmation');
    const p = [...acceptedProblems(ctx, a1, c.first), ...refusedProblems(a2, 409, 'already-pending', 'D2 step 2')];
    const first = ctx.world.confirmationWrites[0];
    if (first && a2.body.expiresAt !== first.expiresAt) p.push(`the second's refusal should give the first one's expiry ${first.expiresAt}; it gives ${show(a2.body.expiresAt)}`);
    if (ctx.world.confirmationWrites.length !== 1) p.push(`confirmation.json should be written once; it was written ${ctx.world.confirmationWrites.length} time(s)`);
    if (confirmLines(ctx).length !== 1) p.push(`one confirm line expected; the history is ${show(historyOf(ctx))}`);
    if (addsOf(ctx).length > 1) p.push(`at most one job; adds ${addsOf(ctx).length}`);
    report(p);
  }));
});

test('CH24: the gate\'s waiting→running step and a confirmation are serialised — an afterAcquire called while the confirmation step holds the chain (its record write held) does not answer until that step ends; the confirmation answers waiting-pass, decided before the launch, and afterAcquire then answers go; and a confirmation queued behind an afterAcquire sees the pass starting and answers starting-pass [ADR 0007 Option A "The gate\'s waiting→running step (afterAcquire) cannot land between the snapshot and the line-up decision"; § Seams "a gate afterAcquire queued behind a confirm"; ADR 0006 D3 "This chain step is the waiting→running boundary"]', async () => {
  const p = [];
  await withCtl(async (ctx) => {
    const w = await lockWait(ctx);
    confirmOf(ctx.ctl);
    ctx.world.record.gateWrites();
    const n0 = ctx.world.callsOf('writeRecord').length;
    const pc = ctx.ctl.confirm({ who: OWNER_IN, runId: ctx.held.runId });
    try {
      await H.waitFor(() => ctx.world.callsOf('writeRecord').length > n0, { what: 'the confirmation step to reach its record write', timeoutMs: 2000 });
      let settled = false;
      const pa = ctx.ctl.gate.afterAcquire(w.job).then((v) => { settled = true; return v; });
      await H.sleep(40);
      if (settled) p.push(`afterAcquire answered while the confirmation step still held the chain (${adr6('D1')} "The chain")`);
      ctx.world.record.releaseWrites();
      const a = answerOf(await within(pc, 3000, 'the confirmation'), 'the confirmation before the launch');
      p.push(...acceptedProblems(ctx, a, 'waiting-pass', { joined: true }));
      const v = await within(pa, 3000, 'afterAcquire');
      if (v !== 'go') p.push(`afterAcquire should then answer go; it answered ${show(v)}`);
    } finally { ctx.world.record.releaseWrites(); }
  });
  await withCtl(async (ctx) => {
    const w = await lockWait(ctx);
    confirmOf(ctx.ctl);
    const pa = ctx.ctl.gate.afterAcquire(w.job);
    const pc = ctx.ctl.confirm({ who: OWNER_IN, runId: ctx.held.runId });
    const v = await within(pa, 3000, 'afterAcquire');
    const a = answerOf(await within(pc, 3000, 'the confirmation'), 'the confirmation after the launch');
    if (v !== 'go') p.push(`setup: afterAcquire should answer go; it answered ${show(v)}`);
    p.push(...acceptedProblems(ctx, a, 'starting-pass', { joined: true }));
  });
  report(p);
});

test('CH25: never a false answer — across nothing busy, a waiting pass, a starting pass, every busy pass stopping, the finishing window, the queue off, a failed add, a pass that started and one that claimed: lined-up only with a new job in line that is not marked to be skipped; waiting-pass or starting-pass only while that pass is still listed with no stop asked for; taken-up only when claimed/ holds that run\'s claim; and no other outcome claims a pass will take it up [story AC-1 "Never a false answer. Confirm is never answered as lined up, or as taken up, when no pass will take it up"; ADR 0007 Constraints "never a false lined up or taken up"; R10]', async () => {
  const scenarios = [
    { name: 'nothing busy', set: async () => {} },
    { name: 'a pass waiting', set: async (ctx) => { await runKey(ctx); } },
    { name: 'a pass starting', set: async (ctx) => { await starting(ctx); } },
    { name: 'every busy pass stopping', o: { world: { record: { record: stoppedEntryRecord(STOP_KEY) } } }, set: async (ctx) => { await addJob(ctx, STOP_KEY); await lockWait(ctx, STOP_KEY); } },
    { name: 'the queue off', set: async (ctx) => { ctx.world.health = 'off'; } },
    { name: 'an add that fails', set: async (ctx) => ctx.q.inject('add', { error: 'ECONNRESET' }) },
    { name: 'a pass that started meanwhile', set: async (ctx) => { passStartsAfterWrite(ctx); } },
    { name: 'a pass that claimed it meanwhile', set: async (ctx) => { passStartsAfterWrite(ctx, { claim: true }); } },
  ];
  await cases(scenarios, (c) => withCtl(c.o || {}, async (ctx) => {
    await c.set(ctx);
    const a = await confirm(ctx);
    const b = a.body;
    const p = [];
    const s = await snap(ctx);
    const open = s.items.filter((i) => i.stopAskedAt == null);
    if (b.outcome === 'lined-up') {
      if (!(typeof b.jobId === 'string' && ctx.q.has(b.jobId) && ctx.ctl.gate.shouldAbandon({ id: b.jobId, timestamp: T0, data: H.lineUpData() }) === false)) p.push(`lined-up, but ${show(b.jobId)} is not a job in line to run`);
    } else if (b.outcome === 'waiting-pass') {
      if (!open.some((i) => i.state === 'waiting')) p.push(`waiting-pass, but no pass waits with no stop asked for: ${show(s.items)}`);
    } else if (b.outcome === 'starting-pass') {
      if (!open.some((i) => i.state === 'running' && i.runId == null)) p.push(`starting-pass, but no pass is starting with no stop asked for: ${show(s.items)}`);
    } else if (b.outcome === 'taken-up') {
      if (!(typeof b.claimedBy === 'string' && [...ctx.world.claimed].some((n) => n.startsWith(`${b.claimedBy}-`)))) p.push(`taken-up by ${show(b.claimedBy)}, but no claim of it is in claimed/`);
    } else if (b.outcome !== 'not-lined-up' && b.success !== false) {
      p.push(`an answer that is neither one of D4's outcomes nor a refusal: ${a.status} ${show(b)}`);
    }
    if (b.success === undefined && b.outcome === undefined) p.push(`no answer at all: ${show(b)}`);
    if (b.success !== false && typeof b.outcome !== 'string') p.push(`an accepted answer should carry outcome (${adr7('D4')} "Every accepted answer adds outcome"); it is ${show(b)}`);
    report(p);
  }));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CH26–CH27 — the route with an injected confirm (D1, D4)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

const RUN_ID = '20261107T090000Z-0d0d0d0d';
/** The route's deps: confirm a spy answering `answer`, and every pre-story-7 dep a trap. */
function routeDeps(answer) {
  const calls = [];
  const traps = [];
  const trap = (name) => (...a) => { traps.push(name); throw Object.assign(new Error(`${name} is not the route's any more`), { code: 'ETRAP' }); };
  const deps = {
    getOwnerPubkey: () => OWNER,
    getAdminPubkeys: () => [ADMIN],
    // Not async: a confirm that throws at once is the handler's to catch, as one that rejects is.
    confirm: (args) => { calls.push(H.clone(args)); if (typeof answer === 'function') return answer(args); return Promise.resolve(H.clone(answer)); },
  };
  for (const n of ['readFile', 'readHeld', 'heldDigest', 'writeConfirmation', 'withdrawConfirmation', 'nonce', 'lineUp', 'queueHealth', 'isQueueAvailable', 'runViaQueueAsync', 'isAlive', 'snapshot']) deps[n] = trap(n);
  return { deps, calls, traps };
}
const confirmReq = (as, o = {}) => H.passReq(as, { path: PATHS.confirm, origin: 'same', body: { runId: RUN_ID }, ...o });

test('CH26: the confirm route hands the owner\'s confirmation to d.confirm({ who: { kind: \'owner\', key: the owner }, runId }) once, after its checks, and sends the { status, body } it answers as it is — a 200 waiting-pass and a 409 already-pending — calling none of its pre-story-7 deps (readFile, readHeld, heldDigest, writeConfirmation, withdrawConfirmation, nonce, lineUp, queueHealth); a confirm that throws or rejects answers 500 { code: \'error\', cause: allowErrorCode(code) }, and the handler never rejects [ADR 0007 D1 "The route … Then it calls d.confirm({who: {kind: \'owner\', key: owner}, runId}) and sends {status, body} as Run\'s handler does"; "Every handler resolves and never rejects"; "index.js\'s defaultDeps … loses writeConfirmation, withdrawConfirmation, heldDigest, nonce, lineUp and queueHealth"; D4]', async () => {
  const { handleConfirmHeldRemovals } = loadRoutes();
  const waiting = { status: 200, body: { success: true, confirmed: true, outcome: 'waiting-pass', enqueued: true, joined: true, expiresAt: iso(T0 + DAY_MS) } };
  const pending = { status: 409, body: { success: false, code: 'already-pending', runId: RUN_ID, expiresAt: iso(T0 + HOUR), error: 'a confirmation of this held list is already pending' } };
  const p = [];
  for (const [label, answer] of [['a waiting pass', waiting], ['a pending one', pending]]) {
    const d = routeDeps(answer);
    const r = await H.callHandler(handleConfirmHeldRemovals, confirmReq('owner'), d.deps);
    if (d.calls.length !== 1) p.push(`${label}: d.confirm should be called once (${adr7('D1')}); it was called ${d.calls.length} time(s)${d.traps.length ? `, and the route called its old deps ${show(d.traps)}` : ''}`);
    else {
      const a = d.calls[0] || {};
      const keyOk = a.who && a.who.kind === 'owner' && (a.who.key === OWNER || a.who.key === OWNER_KEY) && Object.keys(a.who).length === 2;
      if (!keyOk || a.runId !== RUN_ID || Object.keys(a).sort().join(',') !== 'runId,who') p.push(`${label}: d.confirm should get { who: { kind: 'owner', key: the owner }, runId: ${RUN_ID} }; it got ${show(a)}`);
    }
    if (r.status !== answer.status || exact(r.body) !== exact(answer.body)) p.push(`${label}: the route should send confirm's answer as it is, ${answer.status} ${show(answer.body)}; it sent ${r.status} ${show(r.body)}`);
    if (d.traps.length) p.push(`${label}: the route called ${show([...new Set(d.traps)])} — the confirmation's work is the controller's now (${adr7('D1')})`);
    if (r.rejected) p.push(`${label}: the handler rejected: ${firstLine(r.rejected)}`);
  }
  for (const [label, answer, code] of [
    ['a confirm that throws', () => { throw Object.assign(new Error('boom'), { code: 'EIO' }); }, 'EIO'],
    ['a confirm that rejects with an odd code', () => Promise.reject(Object.assign(new Error('boom'), { code: 'neo4j.internal:7687' })), 'neo4j.internal:7687'],
  ]) {
    const d = routeDeps(answer);
    const r = await H.callHandler(handleConfirmHeldRemovals, confirmReq('owner'), d.deps);
    if (d.calls.length !== 1) p.push(`${label}: d.confirm should be called once; it was called ${d.calls.length} time(s)`);
    if (r.status !== 500 || !r.body || r.body.code !== 'error' || r.body.cause !== allowErrorCode(code)) p.push(`${label}: the route should answer 500 { code: 'error', cause: ${show(allowErrorCode(code))} } (${adr7('D1')} "a throw from a dep answers 500 {code: 'error', cause: allowErrorCode(code)}"); it answered ${r.status} ${show(r.body)}`);
    if (r.rejected) p.push(`${label}: the handler rejected: ${firstLine(r.rejected)}`);
  }
  report(p);
});

test('CH27: the confirm route\'s checks come before the chain, in today\'s order, and reach no confirm — signed out (401), a session not marked authenticated, an admin, a user who is neither (403 "Owner access required"), the owner from another site (403), a body that is not JSON (415), a run id outside the grammar (400) — while the owner\'s valid request, the positive control, reaches confirm once [ADR 0007 D1 "handleConfirmHeldRemovals keeps its checks before the chain, in today\'s order: session (401), owner (403), sameHost (403), JSON (415), runId grammar (400)"; story AC-3 "The server decides … It refuses everyone else, and changes and records nothing"]', async () => {
  const { handleConfirmHeldRemovals } = loadRoutes();
  const ok = { status: 200, body: { success: true, confirmed: true, outcome: 'lined-up', enqueued: true, jobId: H.lineUpKey(1), behindStopping: false, expiresAt: iso(T0 + DAY_MS) } };
  const p = [];
  for (const [label, req, status] of [
    ['signed out', confirmReq('signed-out'), 401],
    ['a session not marked authenticated', confirmReq('unauthenticated'), 403],
    ['an admin', confirmReq('admin'), 403],
    ['a user who is neither', confirmReq('stranger'), 403],
    ['the owner from another site', confirmReq('owner', { origin: 'other' }), 403],
    ['a body that is not JSON', confirmReq('owner', { contentType: 'text/plain' }), 415],
    ['a run id outside the grammar', confirmReq('owner', { body: { runId: '../report' } }), 400],
  ]) {
    const d = routeDeps(ok);
    const r = await H.callHandler(handleConfirmHeldRemovals, req, d.deps);
    if (r.status !== status) p.push(`${label}: should be refused ${status}; it answered ${r.status} ${show(r.body)}`);
    if (d.calls.length) p.push(`${label}: reached confirm (${show(d.calls)}) — refusals come before the chain (${adr7('D1')})`);
    if (d.traps.length) p.push(`${label}: called ${show(d.traps)}`);
  }
  const d = routeDeps(ok);
  const r = await H.callHandler(handleConfirmHeldRemovals, confirmReq('owner'), d.deps);
  if (d.calls.length !== 1 || r.status !== 200) p.push(`the positive control — the owner's valid request — should reach confirm once and send its 200; it reached it ${d.calls.length} time(s) and answered ${r.status} ${show(r.body)} (${adr7('D1')})`);
  report(p);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
// CH28–CH29 — in a child process: the real middleware, and signed-out reads after the owner's confirmation
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════

/** The child's whole program (stringified into `node -e`): the CH28 requests, then CH29's reads. */
function chChild() {
  const path0 = require('path');
  const http0 = require('http');
  const Module0 = require('module');
  const cp0 = require('child_process');
  const { EventEmitter } = require('events');
  const spec = JSON.parse(process.env.CH_SPEC);
  const ROOT = spec.repo;
  const H0 = require(spec.helper);
  const rec = H0.recordStructuredEvents();
  const cap = H0.captureConsole();
  const guard = H0.guardProcessKill({ label: 'the CH child' });
  const out = { mw: [], who: null, loaded: {}, spawns: [], error: null, directKills: guard.directKills };
  const first = (e) => String((e && e.message) || e).split('\n')[0];
  const j = (v) => { try { return JSON.stringify(v); } catch (_) { return String(v); } };
  let finished = false;
  const finish = (code) => {
    if (finished) return;
    finished = true;
    const line = `\n@@CH-CHILD@@${JSON.stringify(out)}\n`;
    try { process.stdout.write(line, () => process.exit(code)); } catch (_) { process.exit(code); }
  };
  setTimeout(() => { out.error = `the child did not finish within ${spec.timeoutMs} ms`; finish(1); }, spec.timeoutMs).unref();
  const PREFIX = '/usr/local/lib/node_modules/brainstorm/';
  const origResolve = Module0._resolveFilename;
  Module0._resolveFilename = function resolveForTest(request, ...rest) {
    if (typeof request === 'string' && request.startsWith(PREFIX)) request = path0.join(ROOT, request.slice(PREFIX.length));
    return origResolve.call(this, request, ...rest);
  };
  const blocked = () => Object.assign(new Error('blocked by tagging-edges-confirm: nothing is launched'), { code: 'EPERM' });
  for (const name of ['spawn', 'exec', 'execFile', 'fork']) {
    cp0[name] = function recordLaunch(...a) {
      out.spawns.push(`${name} ${String(a[0]).slice(0, 120)}`);
      const c = new EventEmitter();
      c.stdout = new EventEmitter(); c.stderr = new EventEmitter(); c.stdin = { write() { return true; }, end() {} }; c.kill = () => true; c.unref = () => {};
      const cb = a.find((x) => typeof x === 'function');
      process.nextTick(() => { if (cb) cb(blocked(), '', ''); else c.emit('error', blocked()); });
      return c;
    };
  }
  for (const name of ['spawnSync', 'execFileSync']) cp0[name] = function recordLaunchSync(...a) { out.spawns.push(`${name} ${String(a[0]).slice(0, 120)}`); throw blocked(); };
  cp0.execSync = function noShell() { return Buffer.from(''); };
  // The task queue module, stubbed: nothing here may reach Redis.
  const qPath = require.resolve(path0.join(ROOT, 'src/manage/taskQueue/queue/index.js'));
  const qm = new Module0(qPath);
  qm.filename = qPath; qm.loaded = true;
  qm.exports = new Proxy({}, { get(_, n) { if (typeof n !== 'string' || n === 'then' || n === '__esModule' || n === 'default') return undefined; return () => (n === 'queueHealth' ? 'off' : undefined); } });
  require.cache[qPath] = qm;

  const P = H0.PATHS;
  const trapsOf = () => {
    const hit = [];
    const deps = {};
    for (const n of ['readFile', 'readHeld', 'heldDigest', 'writeConfirmation', 'withdrawConfirmation', 'nonce', 'lineUp', 'queueHealth', 'isAlive']) {
      deps[n] = () => { hit.push(n); throw Object.assign(new Error(`${n} is not the route's any more`), { code: 'ETRAP' }); };
    }
    return { deps, hit };
  };

  async function whoPhase(routes, ctlMod) {
    const w = { error: null, steps: [], runId: null, confirm: null, events: [], lines: [], console: [] };
    const marks = { e: rec.events.length, l: rec.lines.length, c: cap.lines.length };
    let world = null;
    try {
      if (!ctlMod || typeof ctlMod.createController !== 'function') throw new Error(`the controller did not load in the child: ${out.loaded.controllerError}`);
      const realtime = require(path0.join(ROOT, spec.realtimeRel));
      const pass = require(path0.join(ROOT, spec.passRel));
      const explorer = require(path0.join(ROOT, spec.explorerRel));
      const se = require(rec.file);
      world = H0.makeWorld({ owner: spec.owner, admins: [spec.admin], stateDir: spec.stateDir });
      const held = world.holdRemovals({});
      w.runId = held.runId;
      const ctl = ctlMod.createController(world.deps);
      if (typeof ctl.confirm !== 'function') throw new Error(`createController(deps) returns no confirm({ who, runId }) yet (${spec.adr7} D1); it returns ${j(Object.keys(ctl))}`);
      w.confirm = await ctl.confirm({ who: { kind: 'owner', key: spec.owner }, runId: held.runId });
      if (!w.confirm || w.confirm.status !== 200) throw new Error(`setup: the owner's confirmation should be accepted; it answered ${j(w.confirm)}`);
      const written = JSON.parse(JSON.stringify(world.confirmation));
      const enoent = (p) => Object.assign(new Error(`ENOENT: no such file or directory, open '${p}'`), { code: 'ENOENT' });
      const readFile = async (p) => {
        const f = String(p);
        if (f.endsWith(`${path0.sep}report.json`)) { if (world.report == null) throw enoent(f); return JSON.stringify(world.report); }
        if (f.endsWith(`${path0.sep}confirmation.json`)) { if (world.confirmation == null) throw enoent(f); return JSON.stringify(world.confirmation); }
        const m = /held[\\/]([^\\/]+)\.json$/.exec(f);
        if (m && world.held[m[1]]) return JSON.stringify({ runId: m[1], held: world.held[m[1]] });
        throw enoent(f);
      };
      const deps = Object.assign({}, world.deps, { readFile, readScheduleEntries: () => [], controller: ctl, snapshot: (...x) => ctl.snapshot(...x), lineUp: (...x) => ctl.lineUp(...x), stop: (...x) => ctl.stop(...x), confirm: (x) => ctl.confirm(x) });
      const step = async (kind, label, fn, req, d) => {
        const r = await H0.callHandler(fn, req, d, { timeoutMs: 6000 });
        w.steps.push({ kind, label, status: r.status, body: r.body, rejected: r.rejected ? first(r.rejected) : null });
      };
      const status = (label) => step('status', `the public status, signed out, ${label}`, routes.handleStatus, H0.passReq('signed-out', { method: 'GET', path: P.status }), deps);
      await status('with the owner\'s confirmation pending');
      await step('read', 'the held list, signed out', routes.handleHeld, H0.passReq('signed-out', { method: 'GET', path: '/api/tagging-edges/held' }), deps);
      await step('read', 'the path status, signed out', realtime.handleRealtimeStatus, H0.passReq('signed-out', { method: 'GET', path: '/api/tagging-edges/realtime/status' }), { stateDir: () => spec.stateDir, isAlive: () => false, now: () => world.clock.now() });
      se.emitTaskEvent('PROGRESS', H0.TASK, '', { phase: 'ch29-sentinel' });
      process.env.BRAINSTORM_LOG_DIR = spec.logDir;
      w.logFile = rec.writeJsonl(spec.logDir);
      await step('read', 'the Task Explorer\'s data for this task, signed out', explorer, H0.passReq('signed-out', { method: 'GET', path: '/api/task-explorer/single-task/data', query: { taskName: H0.TASK } }), undefined);
      world.clock.advance(25 * 60 * 60 * 1000);
      await status('with the owner\'s confirmation expired');
      world.confirmation = Object.assign({}, written, { expiresAt: 'not a time' });
      await status('with an expiry that cannot be read');
      const old = { mintedBy: spec.ownerKey, who: { kind: 'owner', key: spec.ownerKey } }; // as written before story 7, or by hand
      world.confirmation = Object.assign({}, written, old, { expiresAt: new Date(world.clock.now() + 3600000).toISOString() });
      await status('with a pending confirmation that carries mintedBy (written before story 7)');
      world.confirmation = Object.assign({}, written, old, { expiresAt: new Date(world.clock.now() - 1000).toISOString() });
      await status('with an expired confirmation that carries mintedBy');
      world.confirmation = Object.assign({}, written, old, { expiresAt: 'not a time' });
      await status('with an expiry that cannot be read, carrying mintedBy');
      await step('gated', 'the owner\'s gated record read', pass.handlePassRecord, H0.passReq('owner', { method: 'GET', path: P.record, origin: 'same' }), deps);
    } catch (e) {
      w.error = first(e);
    } finally {
      w.events = rec.events.slice(marks.e);
      w.lines = rec.lines.slice(marks.l);
      w.console = cap.lines.slice(marks.c);
      if (world) world.cleanup();
    }
    return w;
  }

  (async () => {
    const express = require(path0.join(ROOT, 'node_modules/express'));
    const { authMiddleware } = require(path0.join(ROOT, 'src/middleware/auth.js'));
    const adminApi = require(path0.join(ROOT, 'src/api/admin'));
    const routes = require(path0.join(ROOT, spec.routesRel));
    let ctlMod = null;
    try { ctlMod = require(path0.join(ROOT, spec.controllerRel)); } catch (e) { out.loaded.controllerError = first(e); }
    let current = null;
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { const s = req.headers['x-test-session']; req.session = s ? JSON.parse(s) : {}; next(); });
    app.use(authMiddleware);
    app.post(P.confirm, adminApi.requireOwnerOnly, (req, res) => routes.handleConfirmHeldRemovals(req, res, current.deps));
    const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const port = server.address().port;
    for (const q of spec.requests) {
      const world = H0.makeWorld({ owner: spec.owner, admins: [spec.admin] });
      const held = world.holdRemovals({});
      const t = trapsOf();
      const confirms = [];
      let ctl = null;
      try { ctl = ctlMod.createController(world.deps); } catch (e) { out.loaded.buildError = first(e); }
      current = {
        deps: Object.assign({}, t.deps, {
          getOwnerPubkey: () => spec.owner,
          getAdminPubkeys: () => [spec.admin],
          confirm: async (args) => {
            confirms.push(JSON.parse(JSON.stringify(args)));
            if (!ctl || typeof ctl.confirm !== 'function') throw Object.assign(new Error('the controller has no confirm yet'), { code: 'ENOCONFIRM' });
            return ctl.confirm(args);
          },
        }),
      };
      const caller = spec.callers[q.caller];
      const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.9' };
      if (caller.session) headers['X-Test-Session'] = JSON.stringify(caller.session);
      headers.Origin = q.origin === 'same' ? `http://127.0.0.1:${port}` : q.origin;
      const r = await new Promise((resolve) => {
        const rq = http0.request({ host: '127.0.0.1', port, path: P.confirm, method: 'POST', headers, agent: false }, (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (c) => { body += c; });
          res.on('end', () => { let parsed = body; try { parsed = JSON.parse(body); } catch (_) { /* text */ } resolve({ status: res.statusCode, body: parsed }); });
        });
        rq.setTimeout(8000, () => rq.destroy(new Error('no answer within 8000 ms')));
        rq.on('error', (e) => resolve({ status: -1, body: first(e) }));
        rq.end(JSON.stringify({ runId: held.runId }));
      });
      out.mw.push({
        id: q.id, status: r.status, body: r.body, confirms, traps: t.hit, runId: held.runId,
        record: world.record.parsed(), recordWrites: world.record.writes.length,
        confirmation: world.confirmation, confWrites: world.confirmationWrites.length,
        adds: world.queue.calls.filter((x) => x.method === 'add').length,
      });
      current = null;
      world.cleanup();
    }
    await new Promise((resolve) => { server.close(resolve); });
    out.who = await whoPhase(routes, ctlMod);
    cap.restore();
    finish(0);
  })().catch((e) => { out.error = String((e && e.stack) || e); finish(1); });
}

const CH_REQUESTS = [
  { id: 'signed-out', caller: 'signedOut', origin: 'same' },
  { id: 'admin', caller: 'admin', origin: 'same' },
  { id: 'stranger', caller: 'stranger', origin: 'same' },
  { id: 'owner-other-site', caller: 'owner', origin: H.ORIGINS.other },
  { id: 'owner', caller: 'owner', origin: 'same' },
];
let CHILD = null;
/** One child run for CH28 and CH29 (memoized): the conf names the owner, the settings file the admin. */
function childRun() {
  if (CHILD) return CHILD;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tagging-edges-confirm-child-'));
  try {
    const conf = path.join(dir, 'brainstorm.conf');
    const settings = path.join(dir, 'settings.json');
    const stateDir = path.join(dir, 'state');
    const logDir = path.join(dir, 'logs');
    fs.mkdirSync(stateDir);
    fs.mkdirSync(logDir);
    fs.writeFileSync(conf, `export BRAINSTORM_OWNER_PUBKEY="${OWNER}"\n`);
    fs.writeFileSync(settings, JSON.stringify({ adminPubkeys: [ADMIN] }));
    const spec = {
      repo: REPO,
      helper: path.join(__dirname, 'helpers', 'taggingEdgesPassFakes.js'),
      routesRel: MODULES.routes,
      controllerRel: MODULES.controller,
      realtimeRel: MODULES.realtime,
      passRel: MODULES.pass,
      explorerRel: 'src/api/taskExplorer/getTaskExplorerSingleTaskData.js',
      owner: OWNER,
      ownerKey: OWNER_KEY,
      admin: ADMIN,
      adr7: H.ADR7,
      stateDir,
      logDir,
      timeoutMs: 60000,
      callers: {
        signedOut: { session: null },
        stranger: { session: { authenticated: true, pubkey: STRANGER } },
        owner: { session: { authenticated: true, pubkey: OWNER } },
        admin: { session: { authenticated: true, pubkey: ADMIN } },
      },
      requests: CH_REQUESTS,
    };
    const env = {
      ...process.env,
      BRAINSTORM_CONF_PATH: conf,
      TAPESTRY_SETTINGS_PATH: settings,
      TAGGING_EDGES_STATE_DIR: stateDir,
      SCHEDULED_TASKS_CONFIG_PATH: path.join(dir, 'scheduled-tasks.json'),
      BRAINSTORM_STRUCTURED_LOGGING: 'false',
      BRAINSTORM_LOG_DIR: logDir,
      BRAINSTORM_MODULE_BASE_DIR: `${REPO}/`,
      REDIS_HOST: '127.0.0.1',
      REDIS_PORT: '1',
      CH_SPEC: JSON.stringify(spec),
    };
    const r = spawnSync(process.execPath, ['-e', `(${chChild.toString()})();`], { cwd: REPO, env, encoding: 'utf8', timeout: 90000, maxBuffer: 64 * 1024 * 1024 });
    const line = String(r.stdout || '').split('\n').find((l) => l.startsWith('@@CH-CHILD@@'));
    let data = null;
    let error = null;
    if (!line) error = `the child printed no result; exit ${r.status}, signal ${r.signal}, error ${r.error ? firstLine(r.error) : 'none'}, stderr: ${String(r.stderr || '').slice(-800)}`;
    else {
      try { data = JSON.parse(line.slice('@@CH-CHILD@@'.length)); } catch (e) { error = `the child's result did not parse: ${firstLine(e)}`; }
    }
    if (data && data.error) error = `the child failed: ${String(data.error).split('\n').slice(0, 3).join(' | ')}`;
    CHILD = { data, error };
    return CHILD;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
const MW_401 = { success: false, error: 'Sign in as the owner or an admin to do this.' };
const MW_403 = { success: false, error: 'Only the owner or an admin can do this.' };

test('CH28: through the real authMiddleware and adminApi.requireOwnerOnly in front of the real confirm route (in a child process, the owner from a temp brainstorm.conf and the admin from a temp settings file) — signed out (401, the middleware\'s), an admin (403 "Owner access required"), a user who is neither (403, the middleware\'s) and the owner from another site (403 "cross-site request refused") are refused, each changing and recording nothing: no confirm call, no record write, no confirmation.json, no job; and the owner from the same site, the positive control, reaches confirm once and is answered 200 lined-up with the confirm line recorded [story AC-3 "The server decides. It accepts a confirmation only from the signed-in owner. It refuses everyone else, and changes and records nothing: a signed-out request; a signed-in admin; a signed-in user who is neither owner nor admin; a request from another site"; ADR 0007 D1; Out of scope "the confirm route keeps OWNER_ACTION plus requireOwnerOnly"; § Seams "through authMiddleware for the refused callers (the startApp pattern)"]', () => {
  const run = childRun();
  assert(run.data, `the child produced nothing: ${run.error}`);
  const byId = new Map((run.data.mw || []).map((x) => [x.id, x]));
  const p = [];
  if (run.data.directKills && run.data.directKills.length) p.push(`the code under test called process.kill directly in the child: ${show(run.data.directKills)}`);
  const refusals = [
    ['signed-out', 401, (b) => exact(b) === exact(MW_401), 'the middleware\'s 401'],
    ['admin', 403, (b) => b && b.success === false && b.error === 'Owner access required', '403 "Owner access required"'],
    ['stranger', 403, (b) => exact(b) === exact(MW_403), 'the middleware\'s 403'],
    ['owner-other-site', 403, (b) => b && b.success === false && b.error === 'cross-site request refused', '403 "cross-site request refused"'],
  ];
  for (const [id, status, bodyOk, what] of refusals) {
    const x = byId.get(id);
    if (!x) { p.push(`${id}: no result from the child${run.error ? ` (${run.error})` : ''}`); continue; }
    if (x.status !== status || !bodyOk(x.body)) p.push(`${id}: should be refused with ${what}; it answered ${x.status} ${show(x.body)}`);
    if (x.confirms.length) p.push(`${id}: reached confirm ${show(x.confirms)}`);
    if (x.recordWrites || (x.record && Array.isArray(x.record.history) && x.record.history.length)) p.push(`${id}: the record was written: ${show(x.record)}`);
    if (x.confWrites || x.confirmation) p.push(`${id}: confirmation.json was written: ${show(x.confirmation)}`);
    if (x.adds) p.push(`${id}: a job was added`);
    if (x.traps.length) p.push(`${id}: the route called ${show(x.traps)}`);
  }
  const o = byId.get('owner');
  if (!o) p.push(`owner: no result from the child${run.error ? ` (${run.error})` : ''}`);
  else {
    const line = o.record && Array.isArray(o.record.history) ? o.record.history.find((l) => l && l.action === 'confirm') : null;
    if (o.confirms.length !== 1 || o.status !== 200 || !o.body || o.body.outcome !== 'lined-up' || !line || line.runId !== o.runId) {
      p.push(`the positive control — the owner from the same site — should reach confirm once and be answered 200 lined-up with the confirm line recorded (${adr7('D1, D4, D5')}); it reached confirm ${o.confirms.length} time(s), answered ${o.status} ${show(o.body)}, and the record is ${show(o.record)}${o.traps.length ? `; the route called its old deps ${show(o.traps)}` : ''}`);
    }
  }
  report(p);
});

/** CH29's needles: who as a signed-out reader or a log must never see it (AC-4 "Who may read it"; D5 "Who is never logged"). */
const CH_NEEDLES = [
  ['the owner\'s pubkey', OWNER], ['the owner\'s pubkey in upper case', OWNER.toUpperCase()], ['the owner\'s shortened key', OWNER_KEY],
  ['a member named "who"', '"who"'], ['a member named "mintedBy"', '"mintedBy"'],
  ['the kind "owner"', '"kind":"owner"'], ['the kind "owner", printed', 'kind: \'owner\''],
];
const needlesIn = (text) => CH_NEEDLES.filter(([, n]) => String(text).includes(n)).map(([l]) => l);
const clip = (v) => { const s = show(v); return s.length > 500 ? `${s.slice(0, 500)}…` : s; };

test('CH29: after the owner\'s confirmation, a signed-out reader gets no who — the public status with the confirmation pending, expired, and with an expiry that cannot be read (and each again with a file that carries mintedBy and a who, as written before story 7), the held list, the path\'s status and the Task Explorer\'s data for this task (over an events.jsonl holding everything the child logged) carry no owner key, full or shortened, no "who" or "mintedBy" member and no owner kind; each still says what it is about (the pending confirmation\'s run and its expiry, the held list\'s run); nothing logged carries who; and the owner\'s gated record read names the confirm line with the owner\'s key, so the search finds who where it is [story AC-4 "Who may read it … No public read names who confirmed. The owner\'s shortened key goes from every confirmation the public status shows: pending, expired, or with an expiry that cannot be read"; "The public status keeps saying that a confirmation is pending or has expired, of which pass, and until when"; Test tasks, the last server case; ADR 0007 D6 (the allowlist: "So mintedBy and the nonce never reach a signed-out reader, whether the file was written before this story or after"); D5 "Who is never logged"; story 6\'s PX38]', () => {
  const run = childRun();
  assert(run.data, `the child produced nothing: ${run.error}`);
  const w = run.data.who;
  assert(w, `the child ran no CH29 phase${run.error ? ` (${run.error})` : ''}`);
  assert(!w.error, `CH29's confirmation and reads could not all run in the child: ${w.error}`);
  const p = [];
  for (const s of w.steps.filter((x) => x.kind !== 'gated')) {
    if (s.rejected) p.push(`${s.label}: the handler rejected (${s.rejected})`);
    if (s.status !== 200) p.push(`${s.label}: a public read should answer 200; it answered ${s.status} ${clip(s.body)}`);
    const found = needlesIn(JSON.stringify(s.body === undefined ? null : s.body));
    if (found.length) p.push(`${s.label} carries who (${found.join(', ')}) (${adr7('D6')}); the answer is ${clip(s.body)}`);
  }
  for (const s of w.steps.filter((x) => x.kind === 'status')) {
    const cp = s.body && s.body.confirmationPending;
    if (s.label.includes('cannot be read')) {
      if (!cp || cp.runId !== w.runId) p.push(`${s.label}: confirmationPending should still name the run ${w.runId}; it is ${clip(cp)}`);
    } else if (!cp || cp.runId !== w.runId || typeof cp.expiresAt !== 'string' || typeof cp.expired !== 'boolean' || cp.expired !== s.label.includes('expired')) {
      p.push(`${s.label}: confirmationPending should still say of which pass, until when, and whether it has expired (story AC-4); it is ${clip(cp)}`);
    }
  }
  const held = w.steps.find((s) => s.label.startsWith('the held list'));
  if (!held || !held.body || held.body.runId !== w.runId || held.body.total !== 60) p.push(`the held list should answer for ${w.runId}, 60 entries; it answered ${clip(held && held.body)}`);
  const te = w.steps.find((s) => s.label.startsWith('the Task Explorer'));
  if (!te || !te.body || !te.body.rawEvents || !JSON.stringify(te.body.rawEvents).includes('ch29-sentinel')) p.push(`the Task Explorer's data should come from the events.jsonl the child wrote, holding its sentinel; it is ${clip(te && te.body)}`);
  const logged = needlesIn(JSON.stringify(w.events) + JSON.stringify(w.lines) + JSON.stringify((w.console || []).map((l) => `${l.text}\n${l.json}`)));
  if (logged.length) p.push(`something logged carries who (${logged.join(', ')}) (${adr7('D5')} "Who is never logged"): ${clip(w.console)}`);
  const g = w.steps.find((s) => s.kind === 'gated');
  const line = g && g.body && Array.isArray(g.body.history) ? g.body.history.find((l) => l && l.action === 'confirm') : null;
  if (!line || exact(line.who) !== exact(OWNER_REC) || line.runId !== w.runId) p.push(`the owner's gated record read should hold the confirm line with { kind: 'owner', key: ${OWNER_KEY} } for ${w.runId} (${adr7('D5')}); it answered ${clip(g && g.body)}`);
  report(p);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════
async function run() {
  console.log('\n--- tagging-edges confirm tests (epic tagging-edges, Story 7 — ADR 0007 D1–D6; AC-1–AC-4) ---');
  let pass = 0;
  let fail = 0;
  const failures = [];
  const savedDir = process.env.TAGGING_EDGES_STATE_DIR;
  const root = H.makeTempStateDir('ch-suite');
  const restoreLogging = H.structuredLoggingOff();
  const guard = H.guardProcessKill({ label: 'the CH suite' });
  const strays = [];
  const onUnhandled = (reason) => { strays.push(`unhandled rejection: ${firstLine(reason)}`); };
  process.on('unhandledRejection', onUnhandled);
  try {
    process.env.TAGGING_EDGES_STATE_DIR = root.dir;
    for (const [name, fn] of tests) {
      strays.length = 0;
      const killsBefore = guard.directKills.length;
      let err = null;
      try { await fn(); } catch (e) { err = e; }
      await new Promise((r) => { setImmediate(r); });
      if (!err && strays.length) err = new Error(`the test left ${strays.length} unhandled rejection(s): ${strays.join('; ')}`);
      if (!err && guard.directKills.length > killsBefore) err = new Error(`the code under test called process.kill directly (${show(guard.directKills.slice(killsBefore))})`);
      if (err) {
        console.log(`  FAIL  ${name}\n        ${err.message}`);
        failures.push({ name, message: err.message });
        fail++;
      } else {
        console.log(`  PASS  ${name}`);
        pass++;
      }
    }
  } finally {
    process.removeListener('unhandledRejection', onUnhandled);
    guard.restore();
    restoreLogging();
    if (savedDir === undefined) delete process.env.TAGGING_EDGES_STATE_DIR; else process.env.TAGGING_EDGES_STATE_DIR = savedDir;
    root.cleanup();
  }
  console.log(`\ntagging-edges-confirm: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, skipped: 0, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
