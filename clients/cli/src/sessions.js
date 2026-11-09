'use strict';
/**
 * The sign-ins the CLI keeps (ADR graph-operations-foundation/0006 Decision 3): <home>/sessions.json, readable only by
 * its user, keyed by the instance's origin and then by the pubkey that signed in:
 *
 *   { version: 1, sessions: { "<origin>": { "<pubkey hex>": { cookie, expires, signedInAt } } } }
 *
 * A run finds its sign-in by its own pubkey, so one agent's key never picks up another key's sign-in. Every write is
 * whole (a temporary file, then a rename), so runs started at once never leave the file half-written.
 */

const fs = require('fs');
const path = require('path');
const { ensureHome, writePrivate } = require('./identity');

const FILE = 'sessions.json';

function load(home) {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(home, FILE), 'utf8'));
    if (d && d.version === 1 && d.sessions && typeof d.sessions === 'object') return d;
  } catch { /* none yet, or unreadable: start again */ }
  return { version: 1, sessions: {} };
}
function save(home, d) {
  ensureHome(home);
  writePrivate(path.join(home, FILE), `${JSON.stringify(d, null, 2)}\n`);
}

/** The kept sign-in for this instance and key, or null when there's none or it has expired. */
function get(home, origin, pubkey) {
  const e = (load(home).sessions[origin] || {})[pubkey];
  if (!e || typeof e.cookie !== 'string') return null;
  if (typeof e.expires === 'number' && e.expires <= Date.now()) return null;
  return e;
}
function put(home, origin, pubkey, { cookie, expires }) {
  const d = load(home);
  d.sessions[origin] = { ...(d.sessions[origin] || {}), [pubkey]: { cookie, expires: expires || null, signedInAt: Date.now() } };
  save(home, d);
}
function drop(home, origin, pubkey) {
  const d = load(home);
  if (!d.sessions[origin] || !d.sessions[origin][pubkey]) return;
  delete d.sessions[origin][pubkey];
  if (!Object.keys(d.sessions[origin]).length) delete d.sessions[origin];
  save(home, d);
}

module.exports = { get, put, drop };
