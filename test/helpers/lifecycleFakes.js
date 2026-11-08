'use strict';
/**
 * Fakes and fixtures for the lifecycle backup suites — story graph-operations-foundation #2 (Loom A10.2), ADR
 * graph-operations-foundation/0002. Test-only; nothing here reaches a live instance.
 *
 *   fakeSystem(stateFile)   a stand-in for src/operations/catalog/lifecycle/_system.js (ADR Decision 8): supervisor,
 *                           programStatus, neo4jAdmin, cypher, version, freeBytes and sleep, over a graph kept in a
 *                           JSON state file, so the parent test can read what happened after the child exits.
 *   makeInstance(...)       a temporary instance: its secure-keys folder with a real encrypted assistant key (made with
 *                           the instance's own SecureKeyStorage), its conf, its settings, its backups folder, its fake
 *                           graph, and the environment that points the code under test at all of them.
 *   writeBackup(...)        a backup folder written the way ADR Decisions 2 and 3 describe, for restore, list,
 *                           download and upload to read.
 *   tarWrite / tarRead      a POSIX ustar writer and reader of their own (ADR Decision 9), independent of the
 *                           implementation's _tar.js, with knobs for damaged archives.
 *   runHarness(spec, env)   runs test/helpers/operationsHarness.js in a child process with an instance's environment.
 *
 * The fake graph database recognises the queries ADR Decision 4 step 2 lists, each as its own query, by what they
 * name: `dbms.components` (the version), `lmdb:` (offloaded json tags), `tapestryKey` (the keys: their rows, or
 * count(...) / count(DISTINCT ...) of them), a relationship pattern with count(...) (relationships), any other
 * count(...) (nodes), and RETURN 1 (is it answering?). A row's column is the query's last `AS <alias>`. While the
 * server is stopped, every query throws.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const NL = String.fromCharCode(10);
const DEAD = 'http://127.0.0.1:9';
const DUMP_MAGIC = `FAKE-NEO4J-DUMP/1${NL}`;
const WRITERS = ['stream-consumer', 'tagging-edges-realtime'];
const HARNESS = path.join(ROOT, 'test/helpers/operationsHarness.js');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const show = (x) => JSON.stringify(x);

// ── The fake graph database, supervisor and neo4j-admin ──────────────────────────────────────────────────────────

function defaultGraph(over = {}) {
  return { tx: 18, keys: ['k-0001', 'k-0002', 'k-0003'], nodesWithoutKey: 2, relationships: 4, offloaded: 0, ...over };
}

/** A fresh state file: the server online, both writers running, nothing failing. */
function newFakeState(file, over = {}) {
  const state = {
    online: true,
    version: '5.26.10',
    freeBytes: 1e12,
    graph: defaultGraph(over.graph || {}),
    programs: { 'stream-consumer': 'RUNNING', 'tagging-edges-realtime': 'RUNNING', ...(over.programs || {}) },
    confPath: over.confPath || null,
    failures: {
      cypherDown: false, // every query throws, though the server is "online"
      stopThrows: false, // `stop neo4j` stops the server, then throws
      dump: false, // the dump writes a few bytes and exits 1
      recoveryRequired: false, // info says the store needs recovery
      loadFailures: 0, // this many loads fail (and leave the store broken) before loads succeed again
      txOffsetOnce: 0, // the next successful load comes up at a different transaction
      writeAfterStart: 0, // this many starts are followed by a write (a new key) before anything else can count
      ...(over.failures || {}),
    },
    log: [],
  };
  fs.writeFileSync(file, JSON.stringify(state));
  return state;
}
const readState = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeState = (file, s) => fs.writeFileSync(file, JSON.stringify(s));
const nodeCount = (g) => g.keys.length + g.nodesWithoutKey;

function fakeDumpBytes(graph) {
  const g = { tx: graph.tx, keys: graph.keys, nodesWithoutKey: graph.nodesWithoutKey, relationships: graph.relationships, offloaded: graph.offloaded };
  if (graph.uncompressedBytes) g.uncompressedBytes = graph.uncompressedBytes;
  return Buffer.from(DUMP_MAGIC + JSON.stringify(g));
}
function parseFakeDump(buf) {
  const text = Buffer.from(buf || []).toString('utf8');
  if (!text.startsWith(DUMP_MAGIC)) return null;
  try { return JSON.parse(text.slice(DUMP_MAGIC.length)); } catch { return null; }
}
/** The assistant pubkey a conf file names on its BRAINSTORM_RELAY_PUBKEY line, or null. */
function confPubkey(conf) {
  if (!conf || !fs.existsSync(conf)) return null;
  const m = fs.readFileSync(conf, 'utf8').match(/^\s*export\s+BRAINSTORM_RELAY_PUBKEY=['"]?([0-9a-f]{64})['"]?/m);
  return m ? m[1] : null;
}
function readAll(stream) {
  return new Promise((resolve, reject) => {
    if (!stream) { resolve(Buffer.alloc(0)); return; }
    const chunks = [];
    stream.on('data', (c) => chunks.push(Buffer.from(c)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
function writeAll(stream, bytes) {
  return new Promise((resolve, reject) => stream.write(bytes, (err) => (err ? reject(err) : resolve())));
}
function aliasOf(query) {
  const all = [...String(query).matchAll(/\bAS\s+`?([A-Za-z_][A-Za-z0-9_]*)`?/gi)];
  return all.length ? all[all.length - 1][1] : null;
}

/** The stand-in for _system.js. Every call is logged in the state file, in order. */
function fakeSystem(stateFile) {
  const load = () => readState(stateFile);
  const save = (s) => writeState(stateFile, s);
  return {
    async supervisor(action, programs) {
      const s = load();
      const list = [].concat(programs || []);
      const entry = { call: 'supervisor', action, programs: list, online: s.online, at: Date.now() };
      for (const p of list) {
        if (p === 'neo4j') {
          if (action === 'stop' && s.failures.stopThrows) {
            // supervisorctl stopped the server, then reported a failure (review round 1, non-blocking 3)
            s.online = false;
            entry.threw = true;
            s.log.push(entry);
            save(s);
            throw new Error('supervisorctl stop neo4j exited 2 (fake): stopped, but the client lost its connection');
          }
          if (action === 'stop') s.online = false;
          if (action === 'start' || action === 'restart') {
            s.online = true;
            if (s.failures.writeAfterStart > 0) {
              s.failures.writeAfterStart--;
              s.graph.keys.push(`k-written-while-backing-up-${s.log.length}`);
            }
          }
        } else if (WRITERS.includes(p)) {
          if (action === 'stop') s.programs[p] = 'STOPPED';
          if (action === 'start' || action === 'restart') {
            s.programs[p] = 'RUNNING';
            entry.assistantAtStart = confPubkey(s.confPath);
          }
        }
      }
      entry.onlineAfter = s.online;
      s.log.push(entry);
      save(s);
    },
    async programStatus(names) {
      const s = load();
      const out = {};
      for (const n of [].concat(names || [])) out[n] = n === 'neo4j' ? (s.online ? 'RUNNING' : 'STOPPED') : (s.programs[n] || 'STOPPED');
      return out;
    },
    async neo4jAdmin(args, opts = {}) {
      const a = [].concat(args || []).map(String);
      const has = (x) => a.includes(x);
      let s = load();
      const entry = { call: 'neo4jAdmin', args: a, online: s.online };
      let result;
      if (has('--version')) {
        result = { code: 0, stdout: `${s.version}${NL}` };
      } else if (has('info') && !has('load')) {
        result = s.online
          ? { code: 1, stderr: "Failed to execute command as the database 'neo4j' is in use. Please stop it and try again." }
          : {
            code: 0,
            stdout: JSON.stringify({
              databaseName: 'neo4j', inUse: 'false', storeFormat: 'record-aligned-1.1', storeFormatIntroduced: '5.0.0',
              storeFormatSuperseded: null, lastCommittedTransaction: String(s.graph.tx), recoveryRequired: s.failures.recoveryRequired ? 'true' : 'false',
            }),
          };
      } else if (has('dump')) {
        if (s.online) {
          result = { code: 1, stderr: 'It is not possible to dump a database that is mounted in a running Neo4j server.' };
        } else if (s.failures.dump) {
          if (opts.stdout) await writeAll(opts.stdout, Buffer.from(DUMP_MAGIC.slice(0, 6)));
          result = { code: 1, stderr: 'Dump failed (fake): No space left on device' };
        } else {
          const bytes = fakeDumpBytes(s.graph);
          entry.dumped = parseFakeDump(bytes);
          if (opts.stdout) await writeAll(opts.stdout, bytes);
          result = { code: 0, stdout: opts.stdout ? '' : bytes.toString('utf8'), stderr: "Starting dump of database 'neo4j'\nFiles: 1/1, data: 100.0%" };
        }
      } else if (has('load') && has('--info')) {
        const buf = await readAll(opts.stdin);
        const g = parseFakeDump(buf);
        result = g
          ? { code: 0, stdout: ['Database: neo4j', 'Format: Neo4j ZSTD Dump.', 'Files: 37', `Bytes: ${g.uncompressedBytes || 270589952}`, ''].join(NL) }
          : { code: 1, stderr: ["Failed to get metadata for archive 'reading from stdin': Unknown frame descriptor", "Print metadata failed for databases: 'neo4j'"].join(NL) };
      } else if (has('load')) {
        const buf = await readAll(opts.stdin);
        s = load();
        if (s.online) {
          result = { code: 1, stderr: 'It is not possible to replace a database that is mounted in a running Neo4j server.' };
        } else if (s.failures.loadFailures > 0) {
          s.failures.loadFailures--;
          s.graph = { ...s.graph, keys: ['k-broken-by-a-failed-load'], nodesWithoutKey: 0, relationships: 0 };
          result = { code: 1, stderr: 'Load failed (fake): Truncated source' };
        } else {
          const g = parseFakeDump(buf);
          if (!g) {
            result = { code: 1, stderr: 'Unknown frame descriptor' };
          } else {
            const offset = s.failures.txOffsetOnce || 0;
            s.failures.txOffsetOnce = 0;
            s.graph = { tx: g.tx + offset, keys: g.keys, nodesWithoutKey: g.nodesWithoutKey, relationships: g.relationships, offloaded: g.offloaded || 0 };
            entry.loaded = parseFakeDump(fakeDumpBytes(s.graph));
            result = { code: 0, stdout: 'Done: 37 files, 258.1MiB processed in 0.155 seconds.' };
          }
        }
      } else {
        result = { code: 2, stderr: `the fake neo4j-admin doesn't know: ${a.join(' ')}` };
      }
      entry.code = result.code;
      s.log.push(entry);
      save(s);
      return { code: result.code, stdout: result.stdout || '', stderr: result.stderr || '' };
    },
    async cypher(query) {
      const s = load();
      const q = String(query);
      const note = (what) => { s.log.push({ call: 'cypher', what, online: s.online }); save(s); };
      if (!s.online || s.failures.cypherDown) {
        note('refused');
        throw new Error('ServiceUnavailable: the fake graph database is not answering');
      }
      const alias = aliasOf(q);
      const one = (v, fallback) => [{ [alias || fallback]: v }];
      const g = s.graph;
      if (/dbms\.components/i.test(q)) { note('version'); return [{ name: 'Neo4j Kernel', versions: [s.version], edition: 'community' }]; }
      if (/lmdb:/.test(q)) { note('offloaded'); return one(g.offloaded, 'count'); }
      if (/tapestryKey/.test(q)) {
        if (/count\s*\(\s*DISTINCT/i.test(q)) { note('distinct-keys'); return one(new Set(g.keys).size, 'count'); }
        if (/count\s*\(/i.test(q)) { note('key-count'); return one(g.keys.length, 'count'); }
        note('keys');
        return g.keys.map((k) => ({ [alias || 'tapestryKey']: k }));
      }
      if (/-\s*\[/.test(q) && /count\s*\(/i.test(q)) { note('relationships'); return one(g.relationships, 'count'); }
      if (/count\s*\(/i.test(q)) { note('nodes'); return one(nodeCount(g), 'count'); }
      if (/RETURN\s+1\b/i.test(q)) { note('ping'); return one(1, '1'); }
      note('unknown');
      throw new Error(`the fake graph database doesn't know this query: ${q}`);
    },
    async version() { return load().version; },
    async freeBytes(p) {
      const s = load();
      s.log.push({ call: 'freeBytes', path: String(p) });
      save(s);
      return s.freeBytes;
    },
    async sleep() { /* no waiting in the fake */ },
  };
}

/** The tapestryKey digest ADR Decision 3 defines: sha256 of the keys, sorted with JS's default sort, joined by NL. */
function keyDigest(keys) {
  return `sha256:${sha256(Buffer.from([...keys].sort().join(NL)))}`;
}
/** What a backup of `graph` records as its counts. */
function countsOf(graph) {
  return {
    nodes: nodeCount(graph), relationships: graph.relationships, tapestryKeys: graph.keys.length,
    distinctTapestryKeys: new Set(graph.keys).size, tapestryKeyDigest: keyDigest(graph.keys),
  };
}

// ── Identities ───────────────────────────────────────────────────────────────────────────────────────────────────

function quietly(fn) {
  const saved = {};
  for (const k of ['log', 'info', 'warn']) { saved[k] = console[k]; console[k] = () => {}; }
  return Promise.resolve().then(fn).finally(() => { for (const k of Object.keys(saved)) console[k] = saved[k]; });
}
function nostr() { return require(require.resolve('nostr-tools', { paths: [ROOT] })); }
function storage(dir, masterKey) {
  const { SecureKeyStorage } = require(path.join(ROOT, 'src/utils/secureKeyStorage'));
  return new SecureKeyStorage({ storagePath: dir, masterKey, storageType: 'encrypted-file' });
}

/** A new assistant key, stored as create_nostr_identity.sh stores one: .master-key and tapestry-assistant.json. */
async function makeIdentity(dir, masterKey = crypto.randomBytes(32).toString('hex')) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, '.master-key'), `${masterKey}${NL}`, { mode: 0o600 });
  const { generateSecretKey, getPublicKey, nip19 } = nostr();
  const sk = generateSecretKey();
  const privkey = Buffer.from(sk).toString('hex');
  const pubkey = getPublicKey(sk);
  const npub = nip19.npubEncode(pubkey);
  await quietly(() => storage(dir, masterKey).storeRelayKeys('tapestry-assistant', { privkey, nsec: nip19.nsecEncode(sk), pubkey, npub }));
  return { pubkey, npub, privkey, masterKey };
}
/** Another account's key in the same folder and under the same master key (a customer's, say). */
async function addAccountKey(dir, account) {
  const masterKey = fs.readFileSync(path.join(dir, '.master-key'), 'utf8').trim();
  const { generateSecretKey, getPublicKey } = nostr();
  const sk = generateSecretKey();
  const privkey = Buffer.from(sk).toString('hex');
  await quietly(() => storage(dir, masterKey).storeRelayKeys(account, { privkey }));
  return { account, privkey, pubkey: getPublicKey(sk) };
}
/** Decrypt an account's key in a folder with that folder's own .master-key, or with `masterKey`. */
async function readKey(dir, account = 'tapestry-assistant', masterKey) {
  const mk = masterKey || fs.readFileSync(path.join(dir, '.master-key'), 'utf8').trim();
  return quietly(() => storage(dir, mk).getRelayKeys(account));
}

// ── Backup folders (ADR Decisions 2 and 3) ───────────────────────────────────────────────────────────────────────

const ID_RE = /^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$/;
function newId(date = new Date(), hex = crypto.randomBytes(4).toString('hex')) {
  const iso = date.toISOString();
  return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z-${hex}`;
}
const MEMBER_ORDER = ['manifest.json', 'admins.json', 'identity/tapestry-assistant.json', 'identity/master-key', 'neo4j.dump'];

/**
 * Write a backup folder as ADR Decisions 2 and 3 lay it out.
 *   o.identityDir     the secure-keys folder whose key and master key it carries (required)
 *   o.assistantPubkey, o.ownerPubkey, o.admins, o.adminsFrom, o.graph, o.note, o.reason, o.restoring,
 *   o.countsExact, o.neo4jVersion, o.takenAt, o.id, o.dump (raw bytes instead of the graph's dump),
 *   o.manifest (fields replacing the computed ones; graph: {...} is merged), o.received ({ receivedAt, by })
 */
function writeBackup(backupsDir, o) {
  const graph = defaultGraph(o.graph || {});
  const takenAt = o.takenAt || new Date().toISOString();
  const id = o.id || newId(new Date(takenAt));
  const folder = path.join(backupsDir, id);
  fs.mkdirSync(path.join(folder, 'identity'), { recursive: true, mode: 0o700 });
  fs.chmodSync(backupsDir, 0o700);
  const adminsDoc = { pubkeys: o.admins || [], from: o.adminsFrom || 'settings' };
  const files = {
    'neo4j.dump': o.dump ? Buffer.from(o.dump) : fakeDumpBytes(graph),
    'admins.json': Buffer.from(JSON.stringify(adminsDoc)),
    'identity/tapestry-assistant.json': fs.readFileSync(path.join(o.identityDir, 'tapestry-assistant.json')),
    'identity/master-key': fs.readFileSync(path.join(o.identityDir, '.master-key')),
  };
  for (const [rel, data] of Object.entries(files)) fs.writeFileSync(path.join(folder, rel), data, { mode: 0o600 });
  const manifest = {
    format: 'tapestry-backup',
    version: 1,
    id,
    takenAt,
    note: o.note === undefined ? null : o.note,
    reason: o.reason || 'requested',
    restoring: o.restoring || null,
    instance: { assistantPubkey: o.assistantPubkey, ownerPubkey: o.ownerPubkey },
    admins: adminsDoc,
    graph: {
      neo4jVersion: o.neo4jVersion || '5.26.10',
      storeFormat: 'record-aligned-1.1',
      lastCommittedTransaction: String(graph.tx),
      ...countsOf(graph),
      countsExact: o.countsExact === undefined ? true : o.countsExact,
      offloadedJsonTags: graph.offloaded,
    },
    offlineMs: 4321,
    files: Object.fromEntries(Object.entries(files).map(([k, v]) => [k, { size: v.length, sha256: sha256(v) }])),
  };
  const over = o.manifest || {};
  for (const [k, v] of Object.entries(over)) {
    if (k === 'graph') Object.assign(manifest.graph, v);
    else manifest[k] = v;
  }
  for (const k of o.dropManifestFields || []) delete manifest[k];
  fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  if (o.received) fs.writeFileSync(path.join(folder, 'received.json'), JSON.stringify(o.received), { mode: 0o600 });
  return { id, folder, manifest, files, graph };
}
/** Every file of a backup folder, by its name relative to the folder. */
function folderFiles(folder) {
  const out = {};
  (function walk(d, rel) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(d, e.name), r);
      else out[r] = fs.readFileSync(path.join(d, e.name));
    }
  })(folder, '');
  return out;
}
/** The members of a backup folder, in ADR Decision 9's order, for tarWrite. */
function backupMembers(folder) {
  return MEMBER_ORDER.map((name) => ({ name, data: fs.readFileSync(path.join(folder, name)) }));
}

// ── ustar, independent of the code under test (ADR Decision 9) ────────────────────────────────────────────────────

function octal(n, width) { return `${Math.floor(n).toString(8).padStart(width - 1, '0')}\0`; }
function tarHeader(name, size, { type = '0', mode = 0o600, mtime = 1762632000, linkname = '', gnu = false, badChecksum = false } = {}) {
  const h = Buffer.alloc(512, 0);
  h.write(name, 0, 100, 'utf8');
  h.write(octal(mode, 8), 100, 8, 'ascii');
  h.write(octal(0, 8), 108, 8, 'ascii');
  h.write(octal(0, 8), 116, 8, 'ascii');
  h.write(octal(size, 12), 124, 12, 'ascii');
  h.write(octal(mtime, 12), 136, 12, 'ascii');
  h.write('        ', 148, 8, 'ascii');
  h.write(type, 156, 1, 'ascii');
  h.write(linkname, 157, 100, 'utf8');
  if (gnu) h.write('ustar  \0', 257, 8, 'ascii');
  else { h.write('ustar\0', 257, 6, 'ascii'); h.write('00', 263, 2, 'ascii'); }
  h.write('root', 265, 32, 'ascii');
  h.write('root', 297, 32, 'ascii');
  let sum = 0;
  for (const b of h) sum += b;
  if (badChecksum) sum += 7;
  h.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
  return h;
}
/**
 * A ustar archive. members: [{ name, data?, type? ('0' file, '5' directory, '2' symlink), linkname?, mode?, gnu?,
 * badChecksum? }]. opts: { gnu, truncateTo, noEnd }.
 */
function tarWrite(members, opts = {}) {
  const parts = [];
  for (const m of members) {
    const type = m.type || '0';
    const data = type === '0' && m.data ? Buffer.from(m.data) : Buffer.alloc(0);
    parts.push(tarHeader(m.name, data.length, { ...m, type, gnu: opts.gnu || m.gnu }));
    if (data.length) {
      parts.push(data);
      const pad = (512 - (data.length % 512)) % 512;
      if (pad) parts.push(Buffer.alloc(pad));
    }
  }
  if (!opts.noEnd) parts.push(Buffer.alloc(1024));
  const buf = Buffer.concat(parts);
  return opts.truncateTo ? buf.subarray(0, opts.truncateTo) : buf;
}
function tarRead(buf) {
  const members = [];
  let off = 0;
  let zeros = 0;
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    off += 512;
    if (h.every((b) => b === 0)) { zeros++; if (zeros === 2) break; continue; }
    zeros = 0;
    const field = (a, b) => h.toString('ascii', a, b).replace(/\0[\s\S]*$/, '').trim();
    const size = parseInt(field(124, 136) || '0', 8);
    let sum = 0;
    for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : h[i];
    members.push({
      name: h.toString('utf8', 0, 100).replace(/\0[\s\S]*$/, ''),
      size,
      mode: parseInt(field(100, 108) || '0', 8),
      type: h[156] ? String.fromCharCode(h[156]) : '0',
      magic: h.toString('ascii', 257, 263),
      checksumOk: sum === parseInt(field(148, 156), 8),
      data: Buffer.from(buf.subarray(off, off + size)),
    });
    off += Math.ceil(size / 512) * 512;
  }
  return { members, endsWithTwoZeroBlocks: zeros === 2, consumed: off, length: buf.length };
}

// ── Instances ────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A temporary instance: secure-keys (a real encrypted assistant key), conf, settings, backups folder, fake graph,
 * and the environment for a child running the code under test against them. TA_PUBKEY is left out, so the conf's
 * BRAINSTORM_RELAY_PUBKEY line names the assistant, as it does in a container.
 */
async function makeInstance(base, { name = 'instance', owner, admins = [], masterKey, graph, programs, failures, confPubkeyOverride, confExtra = [] } = {}) {
  const dir = path.join(base, name);
  fs.mkdirSync(dir, { recursive: true });
  const keysDir = path.join(dir, 'secure-keys');
  const backupsDir = path.join(dir, 'backups');
  const identity = await makeIdentity(keysDir, masterKey);
  const conf = path.join(dir, 'brainstorm.conf');
  const named = confPubkeyOverride || identity.pubkey;
  fs.writeFileSync(conf, [
    `export BRAINSTORM_OWNER_PUBKEY="${owner}"`,
    'export NEO4J_URI="bolt://127.0.0.1:9"',
    'export REDIS_HOST="127.0.0.1"',
    'export REDIS_PORT="9"',
    `export BRAINSTORM_RELAY_PUBKEY='${named}'`,
    `export BRAINSTORM_RELAY_NPUB='${confPubkeyOverride ? nostr().nip19.npubEncode(named) : identity.npub}'`,
    '# TA pubkey from secure storage (privkey NOT in this file)',
    ...confExtra,
  ].join(NL) + NL, { mode: 0o664 });
  fs.chmodSync(conf, 0o664);
  const settings = path.join(dir, 'settings.json');
  fs.writeFileSync(settings, JSON.stringify({ adminPubkeys: admins }, null, 2));
  const state = path.join(dir, 'fake-graph.json');
  newFakeState(state, { graph, programs, failures, confPath: conf });
  const env = {
    ...process.env,
    BRAINSTORM_CONF_PATH: conf,
    TAPESTRY_SETTINGS_PATH: settings,
    BRAINSTORM_BASE_DIR: dir,
    TAPESTRY_LMDB_PATH: path.join(dir, 'lmdb'),
    TAPESTRY_BACKUPS_DIR: backupsDir,
    TAPESTRY_SECURE_KEYS_DIR: keysDir,
    BRAINSTORM_BASE_URL: DEAD,
    TAPESTRY_BASE: DEAD,
    MEILI_URL_HOST: DEAD,
    // Every service endpoint dead, here as well as in the conf: a child whose conf lacks one falls back to localhost.
    NEO4J_URI: 'bolt://127.0.0.1:9',
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '9',
    HOME: dir,
  };
  delete env.TA_PUBKEY;
  delete env.TASK_QUEUE_ENABLED;
  return { dir, keysDir, backupsDir, conf, settings, state, identity, env, owner, admins };
}

/** The ids of the complete backup folders in a backups folder (those with a manifest), sorted. */
function backupIds(backupsDir) {
  if (!fs.existsSync(backupsDir)) return [];
  return fs.readdirSync(backupsDir).filter((n) => ID_RE.test(n) && fs.existsSync(path.join(backupsDir, n, 'manifest.json'))).sort();
}
/** Everything in a backups folder that isn't a complete backup: incomplete folders, incoming uploads, a lock. */
function leftovers(backupsDir) {
  if (!fs.existsSync(backupsDir)) return [];
  return fs.readdirSync(backupsDir).filter((n) => n !== '.runs' && !(ID_RE.test(n) && fs.existsSync(path.join(backupsDir, n, 'manifest.json'))));
}

/** The fields of /proc/<pid>/stat's start time, as ADR Decision 7 reads it, or null where /proc doesn't exist. */
function startTimeOf(pid) {
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    return Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]);
  } catch { return null; }
}
/** A pid that is certainly not running: a child that has already exited. */
function deadPid() {
  const r = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' });
  return Number(r.stdout);
}
/** Write a lock as ADR Decision 7 describes it. */
function writeLock(backupsDir, { runId = newId(), op = 'backup', host = os.hostname(), pid = process.pid, stage = 'online', backup = null, safety, startedAt } = {}) {
  fs.mkdirSync(backupsDir, { recursive: true, mode: 0o700 });
  const lock = { runId, op, host, holders: [{ pid, startTime: startTimeOf(pid) }], stage, backup, startedAt: startedAt || new Date().toISOString() };
  if (safety) lock.safety = safety;
  fs.writeFileSync(path.join(backupsDir, '.lock'), JSON.stringify(lock));
  return lock;
}

// ── The harness ──────────────────────────────────────────────────────────────────────────────────────────────────

const OWNER = 'aa'.repeat(32);
const ADMIN = 'bb'.repeat(32);
const STRANGER = 'cc'.repeat(32);

/** Run the operations harness in a child process with an instance's environment. */
function runHarness(spec, env, tmpDir) {
  const dir = fs.mkdtempSync(path.join(tmpDir || os.tmpdir(), 'lifecycle-harness-'));
  const specFile = path.join(dir, 'spec.json');
  const outFile = path.join(dir, 'out.json');
  fs.writeFileSync(specFile, JSON.stringify({ owner: OWNER, admin: ADMIN, stranger: STRANGER, timeoutMs: 100000, ...spec }));
  const child = spawnSync(process.execPath, [HARNESS, specFile, outFile], { cwd: ROOT, env, encoding: 'utf8', timeout: 120000, maxBuffer: 64 * 1024 * 1024 });
  let data = null;
  try { data = JSON.parse(fs.readFileSync(outFile, 'utf8')); } catch { /* reported by the caller */ }
  fs.rmSync(dir, { recursive: true, force: true });
  return { child, data };
}
/** A harness run's request or command by id, or throw why it isn't there. */
function pick(run, id) {
  const where = `the harness run (exit ${run.child.status})`;
  if (!run.data) throw new Error(`${where} wrote no result: ${String(run.child.stderr || '').slice(-600)}`);
  if (run.data.error) throw new Error(`${where} failed: ${run.data.error}`);
  for (const s of run.data.scenarios || []) {
    for (const r of [...(s.requests || []), ...(s.cli || [])]) if (r.id === id) return r;
  }
  throw new Error(`${where} has no request or command '${id}'`);
}
/** The calls a fake system logged, optionally only one kind. */
function calls(stateFile, kind) {
  const log = readState(stateFile).log;
  return kind ? log.filter((e) => e.call === kind) : log;
}
/**
 * A compact trace of what the fake was asked, in order: 'stop stream-consumer+tagging-edges-realtime', 'count:keys',
 * 'stop neo4j', 'info', 'dump', 'start neo4j', 'load', 'check-archive', 'version', … (cypher calls are 'count:<what>').
 */
function trace(stateFile) {
  return calls(stateFile).filter((e) => e.call !== 'freeBytes').map((e) => {
    if (e.call === 'cypher') return `count:${e.what}`;
    if (e.call === 'supervisor') return `${e.action} ${e.programs.join('+')}`;
    if (e.call === 'neo4jAdmin') {
      if (e.args.includes('--version')) return 'version';
      if (e.args.includes('info') && !e.args.includes('load')) return 'info';
      if (e.args.includes('dump')) return 'dump';
      if (e.args.includes('load') && e.args.includes('--info')) return 'check-archive';
      if (e.args.includes('load')) return 'load';
    }
    return e.call;
  });
}

/**
 * Find `steps` (regexes, or [regex, label]) in `list` in this order, each after the one before. Returns the indices,
 * or throws naming the first step not found after its predecessor, with the whole trace.
 */
function inOrder(list, steps) {
  const found = [];
  let from = 0;
  for (const step of steps) {
    const [re, label] = Array.isArray(step) ? step : [step, String(step)];
    let i = from;
    while (i < list.length && !re.test(list[i])) i++;
    if (i >= list.length) throw new Error(`expected ${label} after ${found.length ? `'${list[found[found.length - 1]]}'` : 'the start'}; the trace was ${show(list)}`);
    found.push(i);
    from = i + 1;
  }
  return found;
}

// ── A small suite kit, in the style of the repo's suites ──────────────────────────────────────────────────────────

/**
 * suite(title) → { test, base, setup, okData, run }. `setup(name, { instance, before, scenario, env })` makes an
 * instance, runs `before(inst)` (fixtures), then one harness run of `scenario(inst, extra)` with the lifecycle fake
 * installed, memoized by name, and resolves { inst, run, extra }.
 */
function suite(title) {
  const tests = [];
  const runs = {};
  let baseDir = null;
  const kit = {
    test(name, fn) { tests.push([name, fn]); },
    base() { if (!baseDir) baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lifecycle-')); return baseDir; },
    async setup(name, { instance = {}, before, scenario, env, mustExist = [] }) {
      if (runs[name]) return runs[name];
      for (const [abs, why] of mustExist) {
        if (!fs.existsSync(abs)) throw new Error(`${path.relative(ROOT, abs)} does not exist yet (${why})`);
      }
      const inst = await makeInstance(kit.base(), { name, owner: OWNER, admins: [ADMIN], ...instance });
      const extra = before ? ((await before(inst)) || {}) : {};
      const spec = { scenarios: [{ lifecycleFake: { stateFile: inst.state }, ...scenario(inst, extra) }] };
      const run = runHarness(spec, { ...inst.env, ...(env ? env(inst, extra) : {}) }, kit.base());
      runs[name] = { inst, run, extra };
      return runs[name];
    },
    okData(run, id) {
      const r = pick(run, id);
      if (!(r.status === 200 && r.body && r.body.success === true)) {
        throw new Error(`'${id}' must answer 200 { success: true, data }; got ${r.status} ${show(r.body).slice(0, 700)}`);
      }
      return r.body.data;
    },
    async run() {
      console.log(`${NL}=== operations: ${title} ===`);
      let pass = 0, fail = 0, skipped = 0;
      const failures = [];
      try {
        for (const [name, fn] of tests) {
          try {
            const r = await fn();
            if (r === 'skip') { console.log(`  SKIP  ${name}`); skipped++; } else { console.log(`  PASS  ${name}`); pass++; }
          } catch (err) {
            console.log(`  FAIL  ${name}${NL}        ${err.message}`);
            failures.push({ name, message: err.message });
            fail++;
          }
        }
      } finally {
        if (baseDir) fs.rmSync(baseDir, { recursive: true, force: true });
        baseDir = null;
        for (const k of Object.keys(runs)) delete runs[k];
      }
      console.log(`${NL}operations: ${title}: ${pass} passed, ${fail} failed, ${skipped} skipped`);
      return { pass, fail, failures, skipped };
    },
  };
  return kit;
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const modeOf = (p) => fs.statSync(p).mode & 0o777;

module.exports = {
  suite, assert, modeOf,
  inOrder,
  ROOT, DEAD, OWNER, ADMIN, STRANGER, ID_RE, MEMBER_ORDER, WRITERS, DUMP_MAGIC,
  sha256, show, defaultGraph, newFakeState, readState, writeState, fakeSystem, fakeDumpBytes, parseFakeDump, keyDigest,
  countsOf, confPubkey, makeIdentity, addAccountKey, readKey, newId, writeBackup, folderFiles, backupMembers, tarWrite,
  tarRead, tarHeader, makeInstance, backupIds, leftovers, startTimeOf, deadPid, writeLock, runHarness, pick, calls, trace,
};
