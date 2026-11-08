/**
 * Is the gap-filling pass overdue? (tagging-edges story 7, ADR tagging-edges/0007 D8.)
 *
 *   overdueVerdict({ entries, latest, nowMs, periodOf }) → { state, reason?, latestBeganAt?, expectedAt?, periodMs? }
 *     state  'no-entry'     no enabled Scheduled Tasks entry runs the pass
 *            'no-schedule'  enabled entries, none with a runnable rule (no positive interval, no cron that parses)
 *            'cannot-tell'  reason 'rule' (no counted rule could be judged, a pattern too long to judge, or more than 32
 *                           distinct patterns) or 'report' (the latest start is unreadable)
 *            'no-pass'      no pass on record
 *            'overdue'      the latest pass began longer ago than the most frequent entry's period plus one hour
 *            'on-time'
 *     The last two carry latestBeganAt, expectedAt (ISO) and periodMs.
 *
 * It lives here, not in src/lib/tagging-edges/, because that folder's purity pin (test/tagging-edge-contract.test.js)
 * refuses dates and outside requires, and the cron judge needs both (ADR 0007 D8's note of 2026-11-07).
 *
 * Pure but for the cron judge: every time comes from nowMs, never the clock, so the verdict is the same for every viewer.
 * An entry's rule is the scheduler's (queue/scheduler.js toRepeatOpts): a non-blank cron wins; otherwise days, hours and
 * minutes sum to an interval. A cron's period is the longest gap between consecutive runs, from cron-parser with no tz
 * (as BullMQ: the process's zone, UTC in the container), over at most 1,000 runs within 400 days of nowMs; fewer than
 * two runs cannot be judged (R13). cron-parser is reached only when a cron is judged, so this module loads with no I/O.
 */

const TASK_NAME = 'reconcileTaggingEdges';
const GRACE_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const HORIZON_MS = 400 * 24 * 60 * 60 * 1000;
const MAX_RUNS = 1000;
const CACHE_MAX = 32;
/**
 * A cron pattern longer than this is not judged, and the verdict cannot tell: it may be the most frequent rule, so no other
 * entry's period may stand for it (ADR 0007 § Fix-round notes, round 2, D8).
 */
const MAX_PATTERN_LENGTH = 256;

/** pattern → { parses, periodMs }, at most CACHE_MAX, the oldest dropped first. */
const judged = new Map();

function judge(pattern, nowMs) {
  if (judged.has(pattern)) return judged.get(pattern);
  let out;
  try {
    const it = require('cron-parser').parseExpression(pattern, { currentDate: new Date(nowMs) });
    const runs = [];
    while (runs.length < MAX_RUNS) {
      let next;
      try { next = it.next().getTime(); } catch (_) { break; } // no further run the parser can find
      if (next > nowMs + HORIZON_MS) break;
      runs.push(next);
    }
    let periodMs = null;
    for (let i = 1; i < runs.length; i += 1) periodMs = Math.max(periodMs || 0, runs[i] - runs[i - 1]);
    out = { parses: true, periodMs };
  } catch (_) {
    out = { parses: false, periodMs: null };
  }
  if (judged.size >= CACHE_MAX) judged.delete(judged.keys().next().value);
  judged.set(pattern, out);
  return out;
}

/** The cron judge: the longest gap between consecutive runs of `pattern`, in ms, or null when it cannot be judged. */
function cronPeriod(pattern, nowMs) {
  return judge(pattern, nowMs).periodMs;
}

/** An ISO string, or null for a time a Date cannot hold. */
function toIso(ms) {
  const t = new Date(ms);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

function overdueVerdict({ entries, latest, nowMs, periodOf } = {}) {
  const enabled = (Array.isArray(entries) ? entries : []).filter((e) => e && e.taskId === TASK_NAME && e.enabled === true);
  if (!enabled.length) return { state: 'no-entry' };
  const periodOfCron = typeof periodOf === 'function' ? periodOf : cronPeriod;
  const cronOf = (e) => (e.cron ? String(e.cron).trim() : '');
  // The bounds (ADR 0007 § Fix-round notes, D8, and round 2): more distinct patterns than the cache holds, or one too long
  // to judge, and none is judged. A pattern not judged may be the most frequent, so no other entry's period may stand
  // for it.
  const crons = enabled.map(cronOf).filter(Boolean);
  if (new Set(crons).size > CACHE_MAX || crons.some((c) => c.length > MAX_PATTERN_LENGTH)) return { state: 'cannot-tell', reason: 'rule' };
  let counted = 0;
  const periods = [];
  for (const e of enabled) {
    const cron = cronOf(e);
    if (cron) {
      if (!judge(cron, nowMs).parses) continue; // the scheduler cannot run it
      counted += 1;
      const p = periodOfCron(cron, nowMs);
      if (typeof p === 'number' && p > 0) periods.push(p);
    } else {
      const minutes = (Number(e.intervalDays) || 0) * 24 * 60 + (Number(e.intervalHours) || 0) * 60 + (Number(e.intervalMinutes) || 0);
      if (minutes > 0) { counted += 1; periods.push(minutes * MINUTE_MS); }
    }
  }
  if (!counted) return { state: 'no-schedule' };
  if (!periods.length) return { state: 'cannot-tell', reason: 'rule' };
  if (!latest) return { state: 'no-pass' };
  const began = typeof latest.startedAt === 'string' ? Date.parse(latest.startedAt) : NaN;
  const periodMs = Math.min(...periods);
  const latestBeganAt = toIso(began);
  const expectedAt = toIso(began + periodMs);
  if (latestBeganAt === null || expectedAt === null) return { state: 'cannot-tell', reason: 'report' };
  return { state: nowMs > began + periodMs + GRACE_MS ? 'overdue' : 'on-time', latestBeganAt, expectedAt, periodMs };
}

module.exports = { overdueVerdict };
