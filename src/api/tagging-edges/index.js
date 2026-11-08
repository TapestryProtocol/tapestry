/**
 * The gap-filling pass's routes (tagging-edges story 2, ADR tagging-edges/0002).
 *
 *   GET  /api/tagging-edges/status                  public read: the latest report, the previous ones, any
 *                                                   owner confirmation (an allowlist with no nonce and no who; story
 *                                                   7), which passes are waiting or running (control, with no who;
 *                                                   story 6), and whether the pass is overdue (overdue; story 7)
 *   GET  /api/tagging-edges/held?runId=&offset=&limit   public read, paged: the LATEST report's held list only
 *   POST /api/tagging-edges/confirm-held-removals   owner only: { runId } → the pass controller's one confirmation
 *                                                   step (ADR tagging-edges/0007 D1): a single-use confirmation the
 *                                                   next pass claims, recorded with who confirmed
 *
 * What is served: counts, run ids, timestamps, relay- and graph-derived values (tagging addresses, event ids,
 * property-key names), the held list's digest, the pass's pid and process start time, reason text and redacted
 * error text. The stamp identities appear only as 8-character prefixes, while a tagging address carries its author's
 * full pubkey; who confirmed is not served at all (it is in the gated record of actions only); no config value or
 * credential appears, and no absolute path that starts a word (a `/` at the start or after whitespace, a quote, `[`,
 * `(` or `=`): the runner redacts error text before it enters the report, replacing any URI, any such path and any
 * `host:port` (an IPv4 address; a letter-led name, single-label or dotted, with a 2–5-digit port; or a bracketed IPv6
 * address). The held route never builds a path from request input.
 *
 * The display logic is the pure computeStatus(); validateConfirmation(), the pure check of a confirmation, lives in
 * src/lib/tagging-edges/confirmation.js and is re-exported here. Handlers take their dependencies (readFile included)
 * as a third argument, for tests. sameHost(), isJson() and ownerOrAdmin() are also the real-time switch's and the drift
 * count's (ADR tagging-edges/0005 D5).
 */

const path = require('path');
const { RUN_ID_RE } = require('../../lib/tagging-edges/sweep');
const { validateConfirmation, publicConfirmation } = require('../../lib/tagging-edges/confirmation');
const { overdueVerdict } = require('../../pipeline/tagging-edges/overdue');

const TASK_NAME = 'reconcileTaggingEdges';
const HELD_PAGE_MAX = 1000;
const OWNER_RE = /^[0-9a-f]{64}$/;

const allowErrorCode = (code) => require('../../lib/tagging-edges/realtime').allowErrorCode(code);

/** The real dependencies, required lazily so this module loads stack-free. */
function defaultDeps() {
  const state = () => require('../../pipeline/tagging-edges/state');
  const control = () => require('../../pipeline/tagging-edges/control');
  return {
    readFile: (p, enc) => require('fs').promises.readFile(p, enc),
    stateDir: () => state().stateDir(),
    isAlive: (record) => state().isAlive(record),
    readHeld: (runId, opts) => state().readHeld(runId, opts),
    now: () => Date.now(),
    ownerPubkey: () => require('../../utils/config').getConfigFromFile('BRAINSTORM_OWNER_PUBKEY'),
    // the schedule's entries for the overdue verdict; a read or parse error throws (ADR tagging-edges/0007 D8)
    readScheduleEntries: () => require('../scheduled-tasks').readConfigStrict().entries,
    // the default controller's confirmation and busy snapshot (ADR tagging-edges/0007 D1, 0006 D12), shared with Run
    // and the worker
    confirm: (args) => control().controller.confirm(args),
    snapshot: (...args) => control().controller.snapshot(...args),
  };
}

function withDeps(deps) {
  const d = { ...defaultDeps(), ...(deps && typeof deps === 'object' ? deps : {}) };
  if (deps && typeof deps.getOwnerPubkey === 'function') d.ownerPubkey = deps.getOwnerPubkey;
  else if (deps && typeof deps.ownerPubkey === 'string') { const o = deps.ownerPubkey; d.ownerPubkey = () => o; }
  if (deps && deps.readFile && !deps.isAlive) { const rf = deps.readFile; d.isAlive = (r) => require('../../pipeline/tagging-edges/state').isAlive(r, { readFile: rf }); }
  return d;
}

async function readJson(d, rel) {
  const file = path.join(d.stateDir(), rel);
  let text;
  try {
    text = await d.readFile(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw Object.assign(new Error(`${(err && err.code) || 'error'} ${rel}`), { code: (err && err.code) || 'error', rel });
  }
  try {
    return JSON.parse(Buffer.isBuffer(text) ? text.toString('utf8') : String(text));
  } catch (_) {
    throw Object.assign(new Error(`unreadable ${rel}`), { code: 'EBADJSON', rel });
  }
}

/**
 * The held list for a run id, through state.readHeld (which rejects a run id outside RUN_ID_RE and asserts the
 * resolved path is inside held/ before reading) with the injected readFile. → the list, or null when absent.
 */
async function readHeld(d, runId) {
  try {
    return await d.readHeld(runId, { readFile: d.readFile });
  } catch (err) {
    throw Object.assign(new Error(`${(err && err.code) || 'error'} held/`), { code: (err && err.code) || 'error', rel: 'held/' });
  }
}

/**
 * Pure. What the status route shows. `running` comes from liveness only — the stored value (the pessimistic
 * record stores `running: true`) is never passed through; a run that is not alive shows its stored text. The
 * confirmation is served through publicConfirmation's allowlist (ADR tagging-edges/0007 D6).
 */
function computeStatus({ report, alive, confirmation, now } = {}) {
  const running = !!alive && !!(report && report.latest);
  return {
    reportVersion: (report && report.reportVersion) || 1,
    running,
    latest: report && report.latest ? { ...report.latest, running } : null,
    previous: report && Array.isArray(report.previous) ? report.previous : [],
    confirmationPending: publicConfirmation(confirmation, now),
  };
}

/**
 * The cross-site rule of src/api/dlist-curation/update.js:107-115 (ADR curated-dlist-update/0006), copied until
 * ledger row 326 (the house-wide cross-origin posture) centralises it. A browser always sends Origin on a
 * cross-site POST; with no Origin the request goes on to the other checks.
 */
function sameHost(req) {
  const headers = (req && req.headers) || {};
  if (headers.origin === undefined) return true;
  try {
    return new URL(String(headers.origin)).hostname.toLowerCase() === new URL(`http://${headers.host}`).hostname.toLowerCase();
  } catch {
    return false;
  }
}

function isJson(req) {
  const ct = req && req.headers ? req.headers['content-type'] : undefined;
  return typeof ct === 'string' && /^application\/json(\s*;|$)/i.test(ct.trim());
}

/**
 * The owner-or-admin re-check behind requireOwnerOrAdmin (ADR tagging-edges/0005 D5), shared by the drift count and the
 * real-time switch and its record. Pure but for d.ownerPubkey() and d.getAdminPubkeys(), checked in the drift route's
 * order: a session pubkey (401, calling neither lookup; loopback is not admitted), a signed-in owner or admin (403), and
 * the cross-site rule (403). The owner is a lowercase 64-hex pubkey and is checked first; admins are compared as
 * isAdminPubkey compares them (includes, case-sensitive). An owner lookup that throws admits no owner, and an admin
 * lookup that throws admits no admin. The role comes from configuration at the time of the request, never from session
 * flags.
 * → { ok: true, role: 'owner' | 'admin', pubkey } | { ok: false, status, error }
 */
function ownerOrAdmin(req, d) {
  const session = req && req.session;
  if (!session || typeof session.pubkey !== 'string' || session.pubkey === '') {
    return { ok: false, status: 401, error: 'Not authenticated' };
  }
  let owner = null;
  try { owner = d.ownerPubkey(); } catch (_) { owner = null; }
  let admins = [];
  try { admins = d.getAdminPubkeys(); } catch (_) { admins = []; }
  const isOwner = typeof owner === 'string' && OWNER_RE.test(owner) && session.pubkey === owner;
  const isAdmin = Array.isArray(admins) && admins.includes(session.pubkey);
  if (session.authenticated !== true || !(isOwner || isAdmin)) {
    return { ok: false, status: 403, error: 'Owner or admin access required' };
  }
  if (!sameHost(req)) return { ok: false, status: 403, error: 'cross-site request refused' };
  return { ok: true, role: isOwner ? 'owner' : 'admin', pubkey: session.pubkey };
}

function fsError(res, err) {
  const code = (err && err.code) || 'error';
  const rel = err && err.rel ? ` ${err.rel}` : '';
  return res.status(500).json({ success: false, error: `could not read the pass's state: ${code}${rel}` });
}

/**
 * The status's `control` member (ADR tagging-edges/0006 D12): the controller's busy snapshot, which carries no who and
 * every time as an ISO string, or null when it cannot be dated — reused for up to a second while nothing has changed
 * (D5). A snapshot that cannot be taken reads as "cannot tell", never as nothing busy, and never hides the report.
 */
async function controlOf(d) {
  try {
    const s = await d.snapshot({ fresh: false });
    return { queue: s.queue, busy: s.items, gaveUp: s.gaveUp };
  } catch (_) {
    return { queue: 'read-failed', busy: [], gaveUp: null };
  }
}

/**
 * The status's `overdue` member (ADR tagging-edges/0007 D8): the verdict over the schedule's entries, the latest pass
 * and the server's own now, per request. A schedule that cannot be read is "cannot tell", never "no entry", and never
 * fails the status.
 */
async function overdueOf(d, report) {
  let entries;
  try { entries = await d.readScheduleEntries(); } catch (_) { return { state: 'cannot-tell', reason: 'schedule' }; }
  // A schedule the verdict cannot judge (a hand-edited entry) reads the same (ADR 0007 § Fix-round notes, D8).
  try { return overdueVerdict({ entries, latest: report && report.latest, nowMs: d.now() }); } catch (_) { return { state: 'cannot-tell', reason: 'schedule' }; }
}

/** GET /api/tagging-edges/status */
async function handleStatus(req, res, deps) {
  const d = withDeps(deps);
  try {
    const report = await readJson(d, 'report.json');
    // A side file that cannot be read must not hide the report (AC-7): say so in its place.
    let confirmation = null;
    try { confirmation = await readJson(d, 'confirmation.json'); } catch (err) { confirmation = { unreadable: (err && err.code) || 'error' }; }
    let alive = false;
    try { alive = !!(report && report.latest && (await d.isAlive(report.latest.process || report.latest))); } catch (_) { alive = false; }
    const answer = computeStatus({ report, alive, confirmation, now: d.now() });
    answer.control = await controlOf(d);
    answer.overdue = await overdueOf(d, report);
    return res.json(answer);
  } catch (err) {
    return fsError(res, err);
  }
}

function parseNonNegativeInt(v, fallback) {
  if (v === undefined) return fallback;
  if (typeof v !== 'string' || !/^\d{1,9}$/.test(v)) return null;
  return Number(v);
}

/** GET /api/tagging-edges/held?runId=&offset=&limit≤1000 — the latest report's held list, and no other. */
async function handleHeld(req, res, deps) {
  const d = withDeps(deps);
  const q = (req && req.query) || {};
  if (q.runId !== undefined && (typeof q.runId !== 'string' || !RUN_ID_RE.test(q.runId))) {
    return res.status(400).json({ success: false, error: 'runId must be a run id' });
  }
  const offset = parseNonNegativeInt(q.offset, 0);
  const limit = parseNonNegativeInt(q.limit, HELD_PAGE_MAX);
  if (offset === null || limit === null || limit < 1 || limit > HELD_PAGE_MAX) {
    return res.status(400).json({ success: false, error: `offset must be a whole number and limit 1–${HELD_PAGE_MAX}` });
  }
  try {
    const report = await readJson(d, 'report.json');
    const latest = report && report.latest;
    if (!latest || typeof latest.runId !== 'string') return res.status(404).json({ success: false, error: 'no report yet' });
    if (q.runId !== undefined && q.runId !== latest.runId) {
      return res.status(404).json({ success: false, error: 'that run is not the latest report', latestRunId: latest.runId });
    }
    const heldTotal = latest.held && Number.isInteger(latest.held.total) ? latest.held.total : 0;
    let list = [];
    if (heldTotal > 0) {
      if (!RUN_ID_RE.test(latest.runId)) return res.status(404).json({ success: false, error: 'no held list' });
      list = await readHeld(d, latest.runId);
      if (list === null) return res.status(404).json({ success: false, error: 'the held list is gone' });
    }
    return res.json({
      success: true,
      runId: latest.runId,
      outcome: latest.outcome,
      digest: latest.held ? latest.held.digest || null : null,
      total: list.length,
      offset,
      limit,
      items: list.slice(offset, offset + limit),
    });
  } catch (err) {
    return fsError(res, err);
  }
}

/** POST /api/tagging-edges/confirm-held-removals { runId } — owner only. */
async function handleConfirmHeldRemovals(req, res, deps) {
  const d = withDeps(deps);
  const session = req && req.session;
  if (!session || typeof session.pubkey !== 'string' || session.pubkey === '') {
    return res.status(401).json({ success: false, error: 'Not authenticated' });
  }
  let owner = null;
  try { owner = d.ownerPubkey(); } catch (_) { owner = null; }
  if (session.authenticated !== true || typeof owner !== 'string' || !OWNER_RE.test(owner) || session.pubkey !== owner) {
    return res.status(403).json({ success: false, error: 'Owner access required' });
  }
  if (!sameHost(req)) return res.status(403).json({ success: false, error: 'cross-site request refused' });
  if (!isJson(req)) return res.status(415).json({ success: false, error: 'the body must be application/json' });

  const body = req.body;
  const runId = body && typeof body === 'object' ? body.runId : undefined;
  if (typeof runId !== 'string' || !RUN_ID_RE.test(runId)) {
    return res.status(400).json({ success: false, error: 'runId must be a run id' });
  }

  // Everything after who and the body is the controller's one step (ADR tagging-edges/0007 D1, D2), answered as it is.
  let out;
  try {
    out = await d.confirm({ who: { kind: 'owner', key: owner }, runId });
    if (!out || !Number.isInteger(out.status) || !out.body || typeof out.body !== 'object') out = confirmFailed(null);
  } catch (err) {
    out = confirmFailed(err);
  }
  return res.status(out.status).json(out.body);
}

/** A confirmation the controller could not answer: 500 { code: 'error', cause } with an allow-listed code. */
function confirmFailed(err) {
  const body = { success: false, code: 'error', cause: allowErrorCode(err && err.code), error: 'the confirmation could not be carried out' };
  return { status: 500, body };
}

module.exports = {
  TASK_NAME,
  computeStatus,
  validateConfirmation,
  sameHost,
  isJson,
  ownerOrAdmin,
  handleStatus,
  handleHeld,
  handleConfirmHeldRemovals,
};
