'use strict';
/**
 * export nostr's sender (story graph-operations-first-slice #34, AC1; ADR graph-operations-first-slice/0034 Decision 6).
 * It is the instance's second server-side publisher, beside dlist-curation's, under its own ADR and its own exclusion
 * (Decision 11): RE1 (test/publish-export-a-concept.test.js) excludes src/operations/catalog/export/, where this file
 * sits, and catches a publisher built this way anywhere else.
 *
 *   strfryImport(lines)        the seam for the instance's own relay: `strfry import` with the letters as JSONL on
 *                              stdin, as src/api/normalize/helpers.js puts a letter into it. Resolves { code } once it
 *                              ran, rejects when it couldn't run. Its exit code is never taken as an answer: strfry
 *                              exits 0 when it refuses an event, so each letter is read back by id (toOwn).
 *   now()                      the Unix time in seconds a letter's created_at starts from
 *   OK_MS, IN_FLIGHT           how long a relay has to send a letter's OK (5 s), and how many letters wait for theirs at
 *                              a time on one relay (8)
 *   toOwn(letters, conn, opts) put the letters into the instance's own relay and read each back by id over `conn`
 *                              (import's reader, src/operations/catalog/import/_relay.js) → Map(id → { status, reason }),
 *                              status accepted, refused, unread or unreachable (opts.deadline: no read-back starts
 *                              after it, and what it would have read is unread)
 *   toRelay(url, letters, opts)  send letters to one outside relay over one connection → Map(id → { status, reason }),
 *                              status accepted, refused, timeout, unreachable or not-sent (opts.cutoffAt: no send
 *                              starts after it; such a letter's answer carries cut: true, for next.after)
 * Each is read through this object at each call, so a suite can replace or shrink it (test/helpers/relayFake.js's
 * installStrfry). It signs nothing and reads no key: the letters come to it signed. It opens nothing when it loads.
 */

const OWN_RELAY = 'ws://127.0.0.1:7777';
const READ_BATCH = 100;
const STRFRY_MS = 60000;

const words = (err) => require('../import/_letters').words(err);
const answer = (status, reason = null) => ({ status, reason: reason === undefined || reason === '' ? null : reason });

/** One publish, waited for within `ms`: accepted (OK true), refused (OK false), timeout or unreachable. */
async function publishOne(relay, event, ms) {
  if (relay.connected === false) return answer('unreachable', 'the relay closed the connection before this letter was sent');
  let timer = null;
  let late = false;
  const waited = new Promise((resolve) => { timer = setTimeout(() => { late = true; resolve(null); }, ms); });
  // A rejection that comes after the wait is over is caught here too, so nothing is left unhandled.
  const sent = Promise.resolve().then(() => relay.publish(event)).then((reason) => ({ ok: true, reason }), (err) => ({ ok: false, err }));
  try {
    const got = await Promise.race([sent, waited]);
    if (got === null || late) return answer('timeout', `the relay sent no OK within ${ms / 1000} s`);
    if (got.ok) return answer('accepted', typeof got.reason === 'string' ? got.reason : null);
    const why = words(got.err);
    if (relay.connected === false) return answer('unreachable', why);
    if (/^publish timed out/.test(why)) return answer('timeout', why);
    return answer('refused', why);
  } finally {
    clearTimeout(timer);
  }
}

const sender = {
  OK_MS: 5000,
  IN_FLIGHT: 8,

  now() {
    return Math.floor(Date.now() / 1000);
  },

  strfryImport(lines) {
    const text = Array.isArray(lines) ? lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n') : String(lines);
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      let child;
      try {
        child = spawn('strfry', ['import'], { stdio: ['pipe', 'ignore', 'pipe'] });
      } catch (err) {
        reject(err);
        return;
      }
      let stderr = '';
      let done = false;
      const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch { /* gone */ } }, STRFRY_MS);
      child.on('error', (err) => { if (done) return; done = true; clearTimeout(timer); reject(new Error(`strfry import could not run: ${words(err)}`)); });
      child.stderr.on('data', (d) => { if (stderr.length < 4000) stderr += String(d); });
      child.on('close', (code, signal) => { if (done) return; done = true; clearTimeout(timer); resolve({ code, signal, stderr }); });
      // It may exit before it has read everything: what it kept is read back either way.
      child.stdin.on('error', () => {});
      child.stdin.end(text.endsWith('\n') ? text : `${text}\n`);
    });
  },

  async toOwn(letters, conn, { deadline = Infinity } = {}) {
    const out = new Map();
    if (!letters.length) return out;
    try {
      await sender.strfryImport(letters.map((e) => JSON.stringify(e)).join('\n'));
    } catch (err) {
      for (const e of letters) out.set(e.id, answer('unreachable', `strfry import could not run, so the instance's own relay was never given it: ${words(err)}`));
      return out;
    }
    const ids = letters.map((e) => e.id);
    for (let i = 0; i < ids.length; i += READ_BATCH) {
      const chunk = ids.slice(i, i + READ_BATCH);
      const got = Date.now() > deadline ? { ok: false, error: "the call's time ran out first" }
        : conn && !conn.error ? await conn.request({ ids: chunk }) : { ok: false, error: conn && conn.error ? conn.error : 'no connection to it' };
      const held = new Set(got.ok ? got.events.filter((e) => e && typeof e === 'object').map((e) => e.id) : []);
      for (const id of chunk) {
        if (!got.ok) out.set(id, answer('unread', `the instance's own relay couldn't be read back (${got.error}), so nothing is claimed for this letter`));
        else if (held.has(id)) out.set(id, answer('accepted'));
        else out.set(id, answer('refused', "the instance's own relay didn't store it: strfry import took it and kept nothing"));
      }
    }
    return out;
  },

  async toRelay(url, letters, { cutoffAt = Infinity } = {}) {
    const out = new Map();
    if (!letters.length) return out;
    // cut marks the letters the time cut short, for next.after; it isn't answered.
    const cut = () => ({ ...answer('not-sent', "the call's time to send ran out before this letter's turn; the next call, from next.after, sends it"), cut: true });
    if (Date.now() > cutoffAt) {
      for (const e of letters) out.set(e.id, cut());
      return out;
    }
    const conn = await require('../import/_relay').open(url);
    if (conn.error) {
      for (const e of letters) out.set(e.id, answer('unreachable', `the relay couldn't be reached: ${conn.error}`));
      return out;
    }
    const relay = conn.relay;
    const ms = sender.OK_MS;
    // nostr-tools' own publish timer waits longer than this one, so OK_MS is the one that counts.
    if (relay && typeof relay.publishTimeout === 'number') relay.publishTimeout = ms + 1000;
    try {
      const queue = [...letters];
      const worker = async () => {
        while (queue.length) {
          const e = queue.shift();
          if (Date.now() > cutoffAt) { out.set(e.id, cut()); continue; }
          out.set(e.id, await publishOne(relay, e, ms));
        }
      };
      const n = Math.max(1, Math.min(Math.floor(sender.IN_FLIGHT) || 1, letters.length));
      await Promise.all(Array.from({ length: n }, worker));
    } finally {
      conn.close();
    }
    return out;
  },
};

sender.OWN_RELAY = OWN_RELAY;

module.exports = sender;
