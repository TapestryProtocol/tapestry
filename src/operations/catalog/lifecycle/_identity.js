'use strict';
/**
 * The instance's assistant key and its admin list, as a backup carries them — ADR graph-operations-foundation/0002
 * Decision 6. A helper of the lifecycle operations.
 *
 * The key is secure-keys/tapestry-assistant.json, encrypted with secure-keys/.master-key (src/utils/secureKeyStorage.js,
 * as setup/create_nostr_identity.sh stores it). A backup copies both files byte for byte. A restore reads the backup's
 * key with the backup's own master key and stores it again under THIS instance's master key, which stays, so the other
 * keys in the folder still decrypt. It also rewrites the conf's BRAINSTORM_RELAY_PUBKEY and BRAINSTORM_RELAY_NPUB
 * lines, which the running processes read; the entrypoint rebuilds them from the key file at the next start.
 *
 * Nothing here logs or returns key material: only pubkeys and npubs leave these functions.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEY_FILE = 'tapestry-assistant.json';
const MASTER_FILE = '.master-key';
const ACCOUNT = 'tapestry-assistant';

function keysDir() { return process.env.TAPESTRY_SECURE_KEYS_DIR || '/var/lib/brainstorm/secure-keys'; }
function confPath() { return process.env.BRAINSTORM_CONF_PATH || '/etc/brainstorm.conf'; }
const HEX64 = /^[0-9a-f]{64}$/;

function storageAt(dir, masterKey) {
  const { SecureKeyStorage } = require('../../../utils/secureKeyStorage');
  return new SecureKeyStorage({ storagePath: dir, masterKey, storageType: 'encrypted-file' });
}

/** The assistant the instance names now: TA_PUBKEY, else the conf's BRAINSTORM_RELAY_PUBKEY line (read fresh). */
function namedAssistant() {
  if (process.env.TA_PUBKEY && HEX64.test(process.env.TA_PUBKEY)) return process.env.TA_PUBKEY;
  const { getConfigFromFile } = require('../../../utils/config');
  const v = getConfigFromFile('BRAINSTORM_RELAY_PUBKEY', '');
  return HEX64.test(String(v || '')) ? v : null;
}
function ownerPubkey() {
  const { getConfigFromFile } = require('../../../utils/config');
  return getConfigFromFile('BRAINSTORM_OWNER_PUBKEY', '') || 'unassigned';
}

/**
 * Decrypt the key in `dir` with `masterKey` (or the folder's own .master-key file, or `masterFile`): the pubkey the
 * private key derives, after checking it matches the pubkey stored beside it. Null when it doesn't decrypt.
 */
async function decryptedPubkey(dir, { masterKey, masterFile } = {}) {
  let mk = masterKey;
  if (!mk) {
    const f = masterFile || path.join(dir, MASTER_FILE);
    if (!fs.existsSync(f)) return null;
    mk = fs.readFileSync(f, 'utf8').trim();
  }
  if (!mk) return null;
  const quiet = console.error;
  console.error = () => {};
  let keys;
  try { keys = await storageAt(dir, mk).getRelayKeys(ACCOUNT); } catch { keys = null; } finally { console.error = quiet; }
  if (!keys || !keys.privkey || !/^[0-9a-f]{64}$/i.test(keys.privkey)) return null;
  const { getPublicKey } = require('nostr-tools');
  const derived = getPublicKey(Buffer.from(keys.privkey, 'hex'));
  return keys.pubkey && keys.pubkey !== derived ? null : derived;
}

/**
 * The identity a backup takes: the two files' bytes, and the assistant they hold — which must be the assistant the
 * instance names, or the backup fails before anything stops.
 */
async function readIdentity() {
  const dir = keysDir();
  const keyPath = path.join(dir, KEY_FILE);
  const masterPath = path.join(dir, MASTER_FILE);
  if (!fs.existsSync(keyPath) || !fs.existsSync(masterPath)) {
    throw new Error(`the assistant's key isn't in ${dir} (${KEY_FILE} and ${MASTER_FILE})`);
  }
  const named = namedAssistant();
  if (!named) throw new Error('the instance names no assistant (no TA_PUBKEY and no BRAINSTORM_RELAY_PUBKEY line in its conf)');
  const held = await decryptedPubkey(dir);
  if (held !== named) {
    throw new Error(`the assistant key in ${dir} doesn't decrypt to the assistant the instance names (${named.slice(0, 8)}…)`);
  }
  return { assistantPubkey: named, keyFile: fs.readFileSync(keyPath), masterKeyFile: fs.readFileSync(masterPath) };
}

/** Does a backup folder's identity decrypt to `expectedPubkey`? */
async function checkIdentity(folder, expectedPubkey) {
  const dir = path.join(folder, 'identity');
  const got = await decryptedPubkey(dir, { masterFile: path.join(dir, 'master-key') });
  return !!got && got === expectedPubkey;
}

/** Replace (or add) `export NAME='value'` lines in the conf, through a temporary file, keeping its mode. */
function rewriteConf(values) {
  const file = confPath();
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const mode = fs.existsSync(file) ? fs.statSync(file).mode & 0o777 : 0o664;
  const lines = text.length ? text.replace(/\n$/, '').split('\n') : [];
  for (const [name, value] of Object.entries(values)) {
    const line = `export ${name}='${value}'`;
    const re = new RegExp(`^\\s*(export\\s+)?${name}=`);
    const at = lines.findIndex((l) => re.test(l));
    if (at >= 0) lines[at] = line; else lines.push(line);
  }
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, `${lines.join('\n')}\n`, { mode });
  fs.chmodSync(tmp, mode);
  fs.renameSync(tmp, file);
}

/**
 * Put a backup's assistant key in place, under this instance's master key, and the conf's two lines with it.
 * @returns {{ before: string|null, after: string, changed: boolean }}
 */
async function restoreIdentity(folder, expectedPubkey) {
  const before = namedAssistant();
  const src = path.join(folder, 'identity');
  const srcMaster = fs.readFileSync(path.join(src, 'master-key'), 'utf8').trim();
  const quiet = console.error;
  console.error = () => {};
  let keys;
  try { keys = await storageAt(src, srcMaster).getRelayKeys(ACCOUNT); } finally { console.error = quiet; }
  if (!keys || !keys.privkey) throw new Error('the backup\'s assistant key does not decrypt with its master key');
  const { getPublicKey, nip19 } = require('nostr-tools');
  const pubkey = getPublicKey(Buffer.from(keys.privkey, 'hex'));
  if (pubkey !== expectedPubkey) throw new Error('the backup\'s assistant key is not the assistant its manifest names');
  const npub = keys.npub || nip19.npubEncode(pubkey);

  const dir = keysDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
  const masterPath = path.join(dir, MASTER_FILE);
  if (!fs.existsSync(masterPath)) throw new Error(`this instance has no ${MASTER_FILE} in ${dir} to store the key under`);
  const master = fs.readFileSync(masterPath, 'utf8').trim();
  // Stored in a scratch folder beside secure-keys, then renamed over the old file, so it is never half written.
  const scratch = fs.mkdtempSync(path.join(path.dirname(dir), '.restore-key-'));
  try {
    const saved = console.log;
    console.log = () => {};
    try {
      await storageAt(scratch, master).storeRelayKeys(ACCOUNT, { privkey: keys.privkey, nsec: keys.nsec, pubkey, npub });
    } finally { console.log = saved; }
    fs.renameSync(path.join(scratch, KEY_FILE), path.join(dir, KEY_FILE));
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  rewriteConf({ BRAINSTORM_RELAY_PUBKEY: pubkey, BRAINSTORM_RELAY_NPUB: npub });
  return { before, after: pubkey, changed: before !== pubkey };
}

/**
 * Only real pubkeys. The conf reader returns an empty quoted value, BRAINSTORM_ADMIN_PUBKEYS="", as the two characters
 * "" (src/utils/config.js), so a fresh instance's admin list would otherwise be [""] — and a restore would write that
 * into another instance's settings, where it would override that instance's own admins (found by the live check).
 */
const realPubkeys = (list) => [...new Set((list || []).map((p) => String(p).trim().toLowerCase()).filter((p) => HEX64.test(p)))];

/** The admins in effect, and where they come from: the instance's settings, or its launch settings (the conf). */
function readAdmins() {
  const { getAdminPubkeys } = require('../../../utils/config');
  const { getSettings } = require('../../../config/settings');
  let fromSettings = false;
  try {
    const s = getSettings();
    fromSettings = Array.isArray(s.adminPubkeys) && s.adminPubkeys.length > 0;
  } catch { /* no settings file: the launch settings */ }
  return { pubkeys: realPubkeys(getAdminPubkeys()), from: fromSettings ? 'settings' : 'launch-settings' };
}

/** Make the backup's admins the instance's (in its settings). An empty list falls back to the launch settings. */
function restoreAdmins(pubkeys) {
  const { updateOverrides } = require('../../../config/settings');
  updateOverrides({ adminPubkeys: realPubkeys(pubkeys) });
  return readAdmins();
}

/** Restart the control panel, once it has answered, so it drops the assistant it cached. */
function restartControlPanel(system) {
  return system.supervisor('restart', ['brainstorm']);
}

module.exports = { keysDir, confPath, namedAssistant, ownerPubkey, readIdentity, checkIdentity, restoreIdentity, readAdmins, restoreAdmins, restartControlPanel };
