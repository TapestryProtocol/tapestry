/**
 * The owner's confirmation, pure (tagging-edges story 7, ADR tagging-edges/0007 D3, D6).
 *
 *   validateConfirmation({ body, report, alive })  may the owner confirm this held report? Moved unchanged from the
 *                                                  routes (src/api/tagging-edges/index.js re-exports it)
 *   pendingFor(record, latest, nowMs)              is a confirmation of the latest held list pending? Anything else is
 *                                                  replaced by the next confirmation
 *   publicConfirmation(record, nowMs)              what of confirmation.json the public status may show: an allowlist
 *
 * Plain CommonJS with no I/O and no clock (every time is handed in), so the controller, the routes and the gate's tests
 * require it alike.
 */

const { RUN_ID_RE } = require('./sweep');

/** The members of confirmation.json a signed-out reader may see (D6). Who, and the nonce, are never among them. */
const PUBLIC_MEMBERS = Object.freeze(['version', 'runId', 'heldDigest', 'heldCount', 'mintedAt', 'expiresAt']);

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * Pure. May the owner confirm this held report? Checks the posted run id's grammar, then its equality with the
 * latest report's, before any held file is touched. → { ok: true, runId, latest } | { ok: false, status, code, error }
 */
function validateConfirmation({ body, report, alive } = {}) {
  const runId = body && typeof body === 'object' ? body.runId : undefined;
  if (typeof runId !== 'string' || !RUN_ID_RE.test(runId)) {
    return { ok: false, status: 400, code: 'bad-run-id', error: 'runId must be a run id' };
  }
  const latest = report && report.latest;
  if (!latest || latest.runId !== runId) {
    return { ok: false, status: 409, code: 'not-the-latest-report', error: 'that run is not the latest report' };
  }
  if (latest.outcome !== 'done-removals-held' || !latest.held || !(latest.held.total > 0)) {
    return { ok: false, status: 409, code: 'nothing-held', error: 'the latest report holds no removals' };
  }
  if (alive) {
    return { ok: false, status: 409, code: 'running', error: 'that pass is still running' };
  }
  return { ok: true, runId, latest };
}

/**
 * Pure. Is `record` a pending confirmation of `latest`'s held list at `nowMs`? Only a version-1 record of the same run
 * and digest whose expiry parses and is still ahead. No record, an unreadable or malformed one, an expired one, one with
 * an unreadable expiry, and one for another run or digest are not pending: no pass carries them out (D3).
 */
function pendingFor(record, latest, nowMs) {
  if (!isObject(record) || record.version !== 1) return false;
  if (!isObject(latest) || !isObject(latest.held) || typeof latest.held.digest !== 'string') return false;
  if (record.runId !== latest.runId || record.heldDigest !== latest.held.digest) return false;
  const expires = typeof record.expiresAt === 'string' ? Date.parse(record.expiresAt) : NaN;
  return Number.isFinite(expires) && nowMs < expires;
}

/** A read error's code as the status names it: an E-code or 'error', and 'error' for anything else in its place. */
const CODE_RE = /^(E[A-Z0-9_]+|error)$/;

/**
 * Pure. The public status's confirmationPending (D6): null for none; a read that threw ({ unreadable: <code> }) as that
 * code alone, with today's expired: false; an object record as only PUBLIC_MEMBERS, each when present, plus the
 * derived expired (true from its expiry on, false when either time does not parse); anything else null. So mintedBy,
 * the nonce and any member added by hand never reach a signed-out reader.
 */
function publicConfirmation(record, nowMs) {
  if (!isObject(record)) return null;
  if (own(record, 'unreadable')) {
    const code = typeof record.unreadable === 'string' && CODE_RE.test(record.unreadable) ? record.unreadable : 'error';
    return { unreadable: code, expired: false };
  }
  const out = {};
  for (const k of PUBLIC_MEMBERS) if (own(record, k)) out[k] = record[k];
  const expires = Date.parse(record.expiresAt);
  out.expired = Number.isFinite(expires) && Number.isFinite(nowMs) ? nowMs >= expires : false;
  return out;
}

module.exports = { validateConfirmation, pendingFor, publicConfirmation };
