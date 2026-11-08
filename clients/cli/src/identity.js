'use strict';
/**
 * Whose key the CLI signs in with, and where its things live (ADR graph-operations-foundation/0006 Decision 3).
 *
 * How an agent keeps its key is its own business (the owner, at story 6's planning gate). The CLI takes it the way
 * the agent's setup gives it, the first of:
 *   1. --key-file <path>
 *   2. TAPESTRY_KEY_FILE
 *   3. TAPESTRY_SECRET_KEY            (an nsec, or 64 hex characters)
 *   4. TAPESTRY_SIGNER                a command of the agent's own that signs, with TAPESTRY_PUBKEY
 *   5. config.json's keyFile, or its signer with pubkey
 *   6. <home>/key                     what `tapestry key new` made
 * A key file must be readable by its user alone, as ssh insists for a private key. The secret is used only to sign
 * the instance's sign-in challenge: it is never stored by the CLI, printed, logged or sent.
 *
 * The home is TAPESTRY_HOME, by default ~/.config/tapestry, readable only by its user. One agent per home: agents
 * that share a machine user each set their own.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } = require('nostr-tools/pure');
const nip19 = require('nostr-tools/nip19');
const { Usage, Setup, Failed } = require('./errors');

const SIGNER_TIMEOUT_MS = 180000;
const HEX64 = /^[0-9a-f]{64}$/i;

function homeDir(env) {
  return path.resolve(env.TAPESTRY_HOME || path.join(env.HOME || os.homedir(), '.config', 'tapestry'));
}
/** Make the home, readable only by its user, if it isn't there yet. */
function ensureHome(home) {
  if (!fs.existsSync(home)) fs.mkdirSync(home, { recursive: true, mode: 0o700 });
}
/** Write a file readable only by its user, whole or not at all: a temporary file in the same folder, then a rename. */
function writePrivate(file, text) {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
  fs.writeFileSync(tmp, text, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function readConfig(home) {
  const file = path.join(home, 'config.json');
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return {}; throw new Usage(`Can't read ${file}: ${e.message}`); }
  try {
    const c = JSON.parse(text);
    return c && typeof c === 'object' && !Array.isArray(c) ? c : {};
  } catch (e) {
    throw new Usage(`${file} isn't JSON (${e.message}). Fix or remove it.`);
  }
}
function writeConfig(home, patch) {
  ensureHome(home);
  const next = { ...readConfig(home), ...patch };
  writePrivate(path.join(home, 'config.json'), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

function secretFrom(text, where) {
  const s = String(text || '').trim();
  if (s.startsWith('nsec1')) {
    let d = null;
    try { d = nip19.decode(s); } catch { d = null; }
    if (d && d.type === 'nsec') return d.data;
    throw new Usage(`${where} holds an nsec that doesn't decode.`);
  }
  if (HEX64.test(s)) return Uint8Array.from(Buffer.from(s, 'hex'));
  throw new Usage(`${where} must hold a secret key: an nsec1… or 64 hex characters.`);
}
function pubkeyFrom(text, where) {
  const s = String(text || '').trim();
  if (s.startsWith('npub1')) {
    let d = null;
    try { d = nip19.decode(s); } catch { d = null; }
    if (d && d.type === 'npub') return d.data;
    throw new Usage(`${where} holds an npub that doesn't decode.`);
  }
  if (HEX64.test(s)) return s.toLowerCase();
  throw new Usage(`${where} must be a public key: an npub1… or 64 hex characters.`);
}

function readKeyFile(file) {
  let st;
  try { st = fs.statSync(file); } catch (e) {
    throw new Usage(`No key file at ${file}${e.code === 'ENOENT' ? '' : ` (${e.code})`}. Make one with \`tapestry key new\`, or point TAPESTRY_KEY_FILE at yours.`);
  }
  if (!st.isFile()) throw new Usage(`${file} isn't a file.`);
  if (process.platform !== 'win32' && (st.mode & 0o077) !== 0) {
    throw new Usage(`${file} can be read by other users on this machine, so it isn't used. Run: chmod 600 ${file}`);
  }
  return secretFrom(fs.readFileSync(file, 'utf8'), file);
}

function withKey(sk, source) {
  const pubkey = getPublicKey(sk);
  return {
    source,
    pubkey,
    npub: nip19.npubEncode(pubkey),
    sign: async (t) => finalizeEvent({ kind: t.kind, created_at: t.created_at, tags: t.tags, content: t.content }, sk),
  };
}
function withSigner(command, pubkeyText, source, io) {
  if (!pubkeyText) throw new Usage(`${source} needs the public key it signs for: set TAPESTRY_PUBKEY to its npub.`);
  const pubkey = pubkeyFrom(pubkeyText, 'TAPESTRY_PUBKEY');
  return { source, pubkey, npub: nip19.npubEncode(pubkey), sign: (t) => askSigner(command, t, io) };
}

function noKeyHelp(home) {
  return [
    'No key to sign in with. Give the CLI your own key in one of these ways:',
    `  tapestry key new                 make one, kept in ${path.join(home, 'key')}, readable only by you`,
    '  TAPESTRY_KEY_FILE=<path>         a file holding your nsec (chmod 600)',
    '  TAPESTRY_SECRET_KEY=<nsec|hex>   your key, in the environment',
    '  TAPESTRY_SIGNER=<command>        a signer of your own, with TAPESTRY_PUBKEY=<npub>',
    "Then give your npub to the instance's owner, who can make it an admin.",
  ].join('\n');
}

/** The identity this run signs in as: { source, pubkey, npub, sign(template) }. */
function resolveIdentity({ keyFile, env, home, io }) {
  if (keyFile) { const f = path.resolve(keyFile); return withKey(readKeyFile(f), `key file ${f}`); }
  if (env.TAPESTRY_KEY_FILE) { const f = path.resolve(env.TAPESTRY_KEY_FILE); return withKey(readKeyFile(f), `key file ${f}`); }
  if (env.TAPESTRY_SECRET_KEY) return withKey(secretFrom(env.TAPESTRY_SECRET_KEY, 'TAPESTRY_SECRET_KEY'), 'TAPESTRY_SECRET_KEY');
  if (env.TAPESTRY_SIGNER) return withSigner(env.TAPESTRY_SIGNER, env.TAPESTRY_PUBKEY, 'signer (TAPESTRY_SIGNER)', io);
  const config = readConfig(home);
  if (config.keyFile) { const f = path.resolve(home, config.keyFile); return withKey(readKeyFile(f), `key file ${f} (config.json)`); }
  if (config.signer) return withSigner(config.signer, config.pubkey, 'signer (config.json)', io);
  const made = path.join(home, 'key');
  if (fs.existsSync(made)) return withKey(readKeyFile(made), `key file ${made}`);
  throw new Setup(noKeyHelp(home));
}

/** The first line of `text` that parses as a JSON object, or null. */
function firstJsonObject(text) {
  for (const line of String(text).split('\n')) {
    const s = line.trim();
    if (!s.startsWith('{')) continue;
    try { const o = JSON.parse(s); if (o && typeof o === 'object' && !Array.isArray(o)) return o; } catch { /* the next line */ }
  }
  return null;
}
/** What's wrong with a signer's event, compared with the sign-in event it was asked to sign, or null. */
function mismatch(ev, t) {
  if (ev.kind !== t.kind) return 'another kind';
  if (ev.pubkey !== t.pubkey) return 'another key';
  if (ev.content !== t.content) return 'other content';
  if (JSON.stringify(ev.tags) !== JSON.stringify(t.tags)) return 'other tags';
  if (typeof ev.created_at !== 'number' || Math.abs(ev.created_at - t.created_at) > 600) return 'another time';
  let ok = false;
  try { ok = verifyEvent(JSON.parse(JSON.stringify(ev))) === true; } catch { ok = false; }
  return ok ? null : "a signature that doesn't verify";
}

/**
 * Ask a signer command of the agent's own to sign the sign-in event. It gets the unsigned event as one line of JSON
 * on stdin, and its stdout's first JSON object is the signed event. Its stderr passes through, so its prompts reach
 * whoever runs the CLI. The CLI never sees the key.
 */
function askSigner(command, template, io) {
  return new Promise((resolve, reject) => {
    let child;
    // A process group of its own, so a timeout ends the programs the command started too, not only its shell
    // (review round 1).
    const group = process.platform !== 'win32';
    try { child = spawn('/bin/sh', ['-c', command], { stdio: ['pipe', 'pipe', 'pipe'], detached: group }); } catch (e) {
      reject(new Failed(`The signer command couldn't start: ${e.message}`));
      return;
    }
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => io.err(String(d)));
    const timer = setTimeout(() => {
      try { if (group) process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch { child.kill('SIGKILL'); }
      reject(new Failed(`The signer didn't answer within ${SIGNER_TIMEOUT_MS / 1000} seconds. Is it waiting for an approval?`));
    }, SIGNER_TIMEOUT_MS);
    child.on('error', (e) => { clearTimeout(timer); reject(new Failed(`The signer command couldn't start: ${e.message}`)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      const event = firstJsonObject(out);
      if (!event) { reject(new Failed(`The signer gave no signed event on stdout (it exited ${code}).`)); return; }
      const wrong = mismatch(event, template);
      if (wrong) { reject(new Failed(`The signer returned an event that isn't the sign-in it was asked for (${wrong}), so it wasn't sent.`)); return; }
      resolve(event);
    });
    child.stdin.on('error', () => { /* a signer that exits without reading its input */ });
    child.stdin.end(`${JSON.stringify(template)}\n`);
  });
}

/** `tapestry key new`: a new key in a file readable only by its user, never over an existing one. */
function newKey({ home, file }) {
  const target = file ? path.resolve(file) : path.join(home, 'key');
  if (file) fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 }); else ensureHome(home);
  const sk = generateSecretKey();
  try {
    fs.writeFileSync(target, `${nip19.nsecEncode(sk)}\n`, { mode: 0o600, flag: 'wx' });
  } catch (e) {
    if (e.code === 'EEXIST') throw new Usage(`${target} already exists, and key new never overwrites a key. Use it, or name another file with --file.`);
    throw e;
  }
  fs.chmodSync(target, 0o600);
  const pubkey = getPublicKey(sk);
  return { file: target, npub: nip19.npubEncode(pubkey), pubkey };
}

module.exports = { homeDir, ensureHome, writePrivate, readConfig, writeConfig, resolveIdentity, newKey, pubkeyFrom };
