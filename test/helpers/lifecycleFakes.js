'use strict';
/**
 * Fakes and fixtures for the lifecycle backup suites — story graph-operations-foundation #2 (Loom A10.2), ADR
 * graph-operations-foundation/0002. Test-only; nothing here reaches a live instance.
 *
 *   fakeSystem(stateFile)   a stand-in for src/operations/catalog/lifecycle/_system.js (ADR Decision 8): supervisor,
 *                           programStatus, neo4jAdmin, cypher, cypherEach, version, freeBytes and sleep, over a graph kept in a
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
 *
 * A node-level graph (story graph-operations-foundation #3, Loom A10.3, ADR graph-operations-foundation/0003):
 * nodeGraph({ nodes }) holds each node's labels, tapestryKey, event id, address (uuid) and how many tag nodes it has,
 * and the schema (rules and indexes). The coarse graph above is kept as it is for the backup suites. On a node-level
 * graph the fake also answers, by what each query names (first match wins, in this order):
 *   SHOW CONSTRAINTS / SHOW INDEXES          the schema's rows; a WHERE name = '…' or name IN [...] is honoured. Each
 *                                            SHOW INDEXES advances a populating index, which is ONLINE after
 *                                            failures.indexPolls of them (default 1).
 *   CREATE CONSTRAINT <name> … / CREATE INDEX <name> …   ADR Decision 1's rule and index. The rule is refused, as
 *                                            Neo4j refuses it, while two TapestryNode nodes hold one key.
 *   apoc.periodic.iterate naming TapestryNode and tapestryKey   Decision 4's keys pass: the label on each node without
 *                                            it, and randomUUID() for each key that is null or '{}'. It must call
 *                                            randomUUID(). With the rule in place, a node whose key another labelled
 *                                            node holds fails, as its batch would.
 *   apoc.periodic.iterate with REMOVE <v>:NostrEvent   Decision 5's pass: off every NostrEvent node with no id and a tag.
 *   tapestryKey, collect( and > 1            shared keys: rows { k, c, ids } of real keys held by more than one node.
 *   TapestryNode, tapestryKey > $… and LIMIT  Decision 10's walk: the labelled keys after $after, sorted, one page.
 *   NOT <v>:TapestryNode and tapestryKey IS NOT NULL   the keys of nodes without the label, as rows.
 *   .id IS NULL and HAS_TAG                  the event-less nodes: count(...) of them, or rows of their uuid; with
 *                                            AND <v>:TapestryNode, only those that carry the label.
 *   count(...) and tapestryKey = '{}'        nodes whose key is the '{}' placeholder (with no IS NULL).
 *   count(...) and tapestryKey IS NULL       nodes whose key is null (and '{}', when the query names '{}').
 *   count(...) and NOT <v>:TapestryNode      nodes without the label.
 *   count(...) and (<v>:TapestryNode)        nodes with the label.
 * then the queries above. failures.keysPassFailsOnce fails half of the next keys pass's nodes, as a deadlock would;
 * failures.writesBetweenPasses ([n, …]) has the "pipeline" make n nodes with no key and no label after each keys pass;
 * failures.keysPassRetries ([n, …]) has each keys pass in turn report n retried batches.
 * Every cypher call is logged with the lock's stage at that moment (null when no lock is held).
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

// ── The node-level graph (ADR graph-operations-foundation/0003) ──────────────────────────────────────────────────

const isNodeGraph = (g) => !!g && Array.isArray(g.nodes);
const realKey = (k) => typeof k === 'string' && k !== '{}';
/**
 * One node: its labels, tapestryKey (null, '{}' or a key), event id, address and number of tag nodes. Other fields
 * (pubkey, name, …) ride along, so a test can see they are kept.
 */
function gnode({ labels = ['NostrEvent'], key = null, id = null, uuid = null, tags = 0, ...rest } = {}) {
  return { labels: [...labels], key, id, uuid, tags, ...rest };
}
/** A node-level graph. Each node gets an element id, n0, n1, …, unless it has one. */
function nodeGraph({ nodes = [], schema = {}, relationships = 0, tx = 18, offloaded = 0 } = {}) {
  const list = nodes.map((n, i) => ({ eid: `4:fake:${i}`, ...gnode(n), ...(n.eid ? { eid: n.eid } : {}) }));
  return { tx, nodes: list, nextEid: list.length, schema: { constraints: [], indexes: [], ...JSON.parse(JSON.stringify(schema)) }, relationships, offloaded };
}
/** The schema an instance has once tapestry-keys has run: the rule and both indexes, online. */
function migratedSchema() {
  return {
    constraints: [{ name: 'tapestry_key', label: 'TapestryNode', property: 'tapestryKey', ownedIndex: 'tapestry_key' }],
    indexes: [
      { name: 'tapestry_key', label: 'TapestryNode', property: 'tapestryKey', state: 'ONLINE', pollsLeft: 0, owningConstraint: 'tapestry_key' },
      { name: 'tapestry_node_uuid', label: 'TapestryNode', property: 'uuid', state: 'ONLINE', pollsLeft: 0, owningConstraint: null },
    ],
  };
}
/** Every tapestryKey the graph holds that isn't null ('{}' included), as backup has always counted them. */
function keysOf(g) {
  return isNodeGraph(g) ? g.nodes.filter((n) => n.key !== null && n.key !== undefined).map((n) => String(n.key)) : g.keys;
}
function addNode(g, fields) {
  const n = { eid: `4:fake:${g.nextEid++}`, ...gnode(fields) };
  g.nodes.push(n);
  return n;
}
/** The rows apoc.periodic.iterate answers. */
function iterateRow({ total, committed, failed = 0, failedBatches = 0, retries = 0, errors = {}, stats = {} }) {
  return [{
    batches: Math.max(1, failedBatches), total, timeTaken: 0, committedOperations: committed, failedOperations: failed,
    failedBatches, retries, errorMessages: errors, batch: { total: Math.max(1, failedBatches), committed: failedBatches ? 0 : 1, failed: failedBatches, errors },
    operations: { total, committed, failed, errors }, wasTerminated: false, failedParams: {}, updateStatistics: stats,
  }];
}
/** The names a SHOW … WHERE name = '…' / name IN [...] asks for, or null for all. */
function namesAskedFor(q) {
  const w = String(q).match(/\bWHERE\b([\s\S]*)$/i);
  if (!w || !/\bname\b/.test(w[1])) return null;
  return [...w[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] || m[2]);
}

/** A fresh state file: the server online, both writers running, nothing failing. */
function newFakeState(file, over = {}) {
  const state = {
    online: true,
    version: '5.26.10',
    freeBytes: 1e12,
    graph: isNodeGraph(over.graph) ? JSON.parse(JSON.stringify(over.graph)) : defaultGraph(over.graph || {}),
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
      startFails: 0, // this many `start neo4j` calls fail, leaving the server stopped, before starts succeed again
      indexPolls: 1, // node-level graph: SHOW INDEXES calls before a new index is ONLINE
      keysPassFailsOnce: 0, // node-level graph: this many keys passes fail half their nodes, as a deadlock would
      writesBetweenPasses: [], // node-level graph: after each keys pass, the "pipeline" makes this many keyless nodes
      keysPassRetries: [], // node-level graph: each keys pass in turn reports this many retried batches (APOC's retries)
      ...(over.failures || {}),
    },
    log: [],
  };
  fs.writeFileSync(file, JSON.stringify(state));
  return state;
}
const readState = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeState = (file, s) => fs.writeFileSync(file, JSON.stringify(s));
const nodeCount = (g) => (isNodeGraph(g) ? g.nodes.length : g.keys.length + g.nodesWithoutKey);

function fakeDumpBytes(graph) {
  const g = isNodeGraph(graph)
    ? { tx: graph.tx, nodes: graph.nodes, nextEid: graph.nextEid, schema: graph.schema, relationships: graph.relationships, offloaded: graph.offloaded }
    : { tx: graph.tx, keys: graph.keys, nodesWithoutKey: graph.nodesWithoutKey, relationships: graph.relationships, offloaded: graph.offloaded };
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

/**
 * The stage the run's lock records at this moment, as a recovery would read it, or null when there is no lock
 * (review round 2, R2-2). The harness runs with the instance's TAPESTRY_BACKUPS_DIR.
 */
function lockStageNow() {
  const dir = process.env.TAPESTRY_BACKUPS_DIR;
  if (!dir) return null;
  try { return JSON.parse(fs.readFileSync(path.join(dir, '.lock'), 'utf8')).stage || null; } catch { return null; }
}

/** The stand-in for _system.js. Every call is logged in the state file, in order. */
function fakeSystem(stateFile) {
  const load = () => readState(stateFile);
  const save = (s) => writeState(stateFile, s);
  return {
    async supervisor(action, programs) {
      const s = load();
      const list = [].concat(programs || []);
      const entry = { call: 'supervisor', action, programs: list, online: s.online, at: Date.now(), lockStage: lockStageNow() };
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
          if (action === 'start' && s.failures.startFails > 0) {
            // the server won't start, on the store it has (review round 2, R2-1)
            s.failures.startFails--;
            entry.threw = true;
            s.log.push(entry);
            save(s);
            throw new Error('supervisorctl start neo4j exited 7 (fake): neo4j: ERROR (spawn error)');
          }
          if (action === 'stop') s.online = false;
          if (action === 'start' || action === 'restart') {
            s.online = true;
            if (s.failures.writeAfterStart > 0) {
              s.failures.writeAfterStart--;
              const k = `k-written-while-backing-up-${s.log.length}`;
              if (isNodeGraph(s.graph)) addNode(s.graph, { labels: ['NostrEvent'], key: k });
              else s.graph.keys.push(k);
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
          s.graph = isNodeGraph(s.graph)
            ? nodeGraph({ tx: s.graph.tx, nodes: [{ labels: ['NostrEvent'], key: 'k-broken-by-a-failed-load' }] })
            : { ...s.graph, keys: ['k-broken-by-a-failed-load'], nodesWithoutKey: 0, relationships: 0 };
          result = { code: 1, stderr: 'Load failed (fake): Truncated source' };
        } else {
          const g = parseFakeDump(buf);
          if (!g) {
            result = { code: 1, stderr: 'Unknown frame descriptor' };
          } else {
            const offset = s.failures.txOffsetOnce || 0;
            s.failures.txOffsetOnce = 0;
            s.graph = isNodeGraph(g)
              ? { tx: g.tx + offset, nodes: g.nodes, nextEid: g.nextEid, schema: g.schema, relationships: g.relationships, offloaded: g.offloaded || 0 }
              : { tx: g.tx + offset, keys: g.keys, nodesWithoutKey: g.nodesWithoutKey, relationships: g.relationships, offloaded: g.offloaded || 0 };
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
    async cypher(query, params = {}) {
      const s = load();
      const q = String(query);
      const note = (what, extra = {}) => { s.log.push({ call: 'cypher', what, online: s.online, lockStage: lockStageNow(), ...extra }); save(s); };
      if (!s.online || s.failures.cypherDown) {
        note('refused');
        throw new Error('ServiceUnavailable: the fake graph database is not answering');
      }
      const alias = aliasOf(q);
      const one = (v, fallback) => [{ [alias || fallback]: v }];
      const g = s.graph;
      const schema = (isNodeGraph(g) && g.schema) || { constraints: [], indexes: [] };
      const isCount = /count\s*\(/i.test(q);
      const limitOf = () => { const m = q.match(/\bLIMIT\s+(\d+)/i); return m ? Number(m[1]) : (params.limit === undefined ? Infinity : Number(params.limit)); };

      // ── The schema (ADR 0003 Decision 1) ──
      if (/^\s*SHOW\s+CONSTRAINTS\b/i.test(q)) {
        const want = namesAskedFor(q);
        note('show-constraints');
        return schema.constraints.filter((c) => !want || want.includes(c.name)).map((c) => ({
          name: c.name, type: 'UNIQUENESS', entityType: 'NODE', labelsOrTypes: [c.label], properties: [c.property], ownedIndex: c.ownedIndex,
        }));
      }
      if (/^\s*SHOW\s+INDEXES\b/i.test(q)) {
        for (const ix of schema.indexes) {
          if (ix.state === 'POPULATING') { ix.pollsLeft = (ix.pollsLeft || 0) - 1; if (ix.pollsLeft <= 0) ix.state = 'ONLINE'; }
        }
        const want = namesAskedFor(q);
        note('show-indexes');
        return schema.indexes.filter((ix) => !want || want.includes(ix.name)).map((ix) => ({
          name: ix.name, state: ix.state, populationPercent: ix.state === 'ONLINE' ? 100 : 40, type: 'RANGE', entityType: 'NODE',
          labelsOrTypes: [ix.label], properties: [ix.property], owningConstraint: ix.owningConstraint || null,
        }));
      }
      if (/\bCREATE\s+CONSTRAINT\b/i.test(q)) {
        if (!isNodeGraph(g)) { note('unknown'); throw new Error('the fake makes rules only on a node-level graph'); }
        const name = (q.match(/CREATE\s+CONSTRAINT\s+`?([A-Za-z_][A-Za-z0-9_]*)`?/i) || [])[1];
        const m = q.match(/FOR\s*\(\s*([A-Za-z_]\w*)\s*:\s*TapestryNode\s*\)\s*REQUIRE\s*\1\s*\.\s*tapestryKey\s+IS\s+UNIQUE/i);
        if (name !== 'tapestry_key' || !m) { note('unknown'); throw new Error(`the fake knows only ADR 0003's rule (CREATE CONSTRAINT tapestry_key IF NOT EXISTS FOR (n:TapestryNode) REQUIRE n.tapestryKey IS UNIQUE): ${q}`); }
        if (schema.constraints.some((c) => c.name === name)) { note('create-rule', { existed: true }); return []; }
        const held = new Map();
        for (const n of g.nodes) {
          if (!n.labels.includes('TapestryNode') || n.key === null || n.key === undefined) continue;
          if (held.has(n.key)) {
            note('create-rule', { refused: true });
            throw new Error(`Neo.DatabaseError.Schema.ConstraintCreationFailed: Unable to create Constraint( name='tapestry_key', type='UNIQUENESS', schema=(:TapestryNode {tapestryKey}) ): Both Node(${held.get(n.key)}) and Node(${n.eid}) have the label \`TapestryNode\` and property \`tapestryKey\` = '${n.key}'`);
          }
          held.set(n.key, n.eid);
        }
        schema.constraints.push({ name, label: 'TapestryNode', property: 'tapestryKey', ownedIndex: name });
        schema.indexes.push({ name, label: 'TapestryNode', property: 'tapestryKey', state: 'POPULATING', pollsLeft: s.failures.indexPolls, owningConstraint: name });
        g.schema = schema;
        note('create-rule');
        return [];
      }
      if (/\bCREATE\s+INDEX\b/i.test(q)) {
        if (!isNodeGraph(g)) { note('unknown'); throw new Error('the fake makes indexes only on a node-level graph'); }
        const name = (q.match(/CREATE\s+INDEX\s+`?([A-Za-z_][A-Za-z0-9_]*)`?/i) || [])[1];
        const m = q.match(/FOR\s*\(\s*([A-Za-z_]\w*)\s*:\s*([A-Za-z_]\w*)\s*\)\s*ON\s*\(\s*\1\s*\.\s*([A-Za-z_]\w*)\s*\)/i);
        if (!name || !m) { note('unknown'); throw new Error(`the fake can't read this index: ${q}`); }
        if (schema.indexes.some((ix) => ix.name === name)) { note('create-index', { existed: true }); return []; }
        schema.indexes.push({ name, label: m[2], property: m[3], state: 'POPULATING', pollsLeft: s.failures.indexPolls, owningConstraint: null });
        g.schema = schema;
        note('create-index');
        return [];
      }

      // ── The passes (ADR 0003 Decisions 4 and 5) ──
      if (/apoc\.periodic\.iterate/i.test(q)) {
        if (!isNodeGraph(g)) { note('unknown'); throw new Error('the fake runs passes only on a node-level graph'); }
        if (/\bREMOVE\s+[A-Za-z_]\w*\s*:\s*NostrEvent\b/.test(q)) {
          const labelled = /\bAND\s+[A-Za-z_]\w*\s*:\s*TapestryNode\b/.test(q);
          const targets = g.nodes.filter((n) => n.labels.includes('NostrEvent') && (n.id === null || n.id === undefined) && n.tags > 0
            && (!labelled || n.labels.includes('TapestryNode')));
          for (const n of targets) n.labels = n.labels.filter((l) => l !== 'NostrEvent');
          note('relabel-pass', { nodes: targets.length });
          return iterateRow({ total: targets.length, committed: targets.length, stats: { labelsRemoved: targets.length } });
        }
        if (/TapestryNode/.test(q) && /tapestryKey/.test(q)) {
          if (!/randomUUID\s*\(\s*\)/.test(q)) { note('unknown'); throw new Error(`the keys pass must give keys with Cypher's randomUUID(): ${q}`); }
          let targets = g.nodes.filter((n) => !n.labels.includes('TapestryNode') || n.key === null || n.key === undefined || n.key === '{}');
          let failed = 0;
          const errors = {};
          if (s.failures.keysPassFailsOnce > 0) {
            s.failures.keysPassFailsOnce--;
            const keep = Math.ceil(targets.length / 2);
            failed = targets.length - keep;
            if (failed) errors['ForsetiClient[transactionId=7] can\'t acquire ExclusiveLock (fake): DeadlockDetected'] = 1;
            targets = targets.slice(0, keep);
          }
          const ruled = schema.constraints.some((c) => c.name === 'tapestry_key');
          const labelledKeys = new Set(g.nodes.filter((n) => n.labels.includes('TapestryNode') && n.key !== null && n.key !== undefined).map((n) => n.key));
          let labelsAdded = 0, propertiesSet = 0, applied = 0;
          for (const n of targets) {
            const key = n.key === null || n.key === undefined || n.key === '{}' ? crypto.randomUUID() : n.key;
            const labelling = !n.labels.includes('TapestryNode');
            if (ruled && labelling && labelledKeys.has(key)) {
              failed++;
              errors[`Node(${n.eid}) already exists with label \`TapestryNode\` and property \`tapestryKey\` = '${key}'`] = 1;
              continue;
            }
            if (labelling) { n.labels.push('TapestryNode'); labelsAdded++; labelledKeys.add(key); }
            if (key !== n.key) { if (n.key === '{}') n.tapestryJsonUpdatedAt = null; n.key = key; propertiesSet++; }
            applied++;
          }
          const later = Array.isArray(s.failures.writesBetweenPasses) ? (s.failures.writesBetweenPasses.shift() || 0) : 0;
          for (let i = 0; i < later; i++) addNode(g, { labels: ['NostrUser'], key: null, pubkey: `late-${g.nextEid}` });
          const retries = Array.isArray(s.failures.keysPassRetries) ? (s.failures.keysPassRetries.shift() || 0) : 0;
          note('keys-pass', { nodes: targets.length, failed, madeAfter: later, retries });
          return iterateRow({ total: applied + failed, committed: applied, failed, failedBatches: failed ? 1 : 0, retries, errors, stats: { labelsAdded, propertiesSet } });
        }
        note('unknown');
        throw new Error(`the fake doesn't know this pass: ${q}`);
      }

      if (/dbms\.components/i.test(q)) { note('version'); return [{ name: 'Neo4j Kernel', versions: [s.version], edition: 'community' }]; }
      if (/lmdb:/.test(q)) { note('offloaded'); return one(g.offloaded, 'count'); }

      // ── Node-level reads (ADR 0003 Decisions 4, 5, 7 and 10) ──
      if (isNodeGraph(g)) {
        if (/tapestryKey/.test(q) && /collect\s*\(/i.test(q) && />\s*1\b/.test(q)) {
          const by = new Map();
          for (const n of g.nodes) if (realKey(n.key)) by.set(n.key, [...(by.get(n.key) || []), n.eid]);
          const rows = [...by.entries()].filter(([, ids]) => ids.length > 1).map(([k, ids]) => ({ k, c: ids.length, ids: ids.slice(0, 10) }));
          note('shared-keys');
          return rows.slice(0, limitOf());
        }
        if (/TapestryNode/.test(q) && /tapestryKey\s*>\s*\$/.test(q) && /\bLIMIT\b/i.test(q)) {
          const size = limitOf();
          const after = params.after === undefined || params.after === null ? '' : String(params.after);
          const page = g.nodes.filter((n) => n.labels.includes('TapestryNode') && n.key !== null && n.key !== undefined)
            .map((n) => String(n.key)).sort().filter((k) => k > after).slice(0, size);
          note('walk-page', { size, after, rows: page.length });
          return page.map((k) => ({ [alias || 'k']: k }));
        }
        if (/NOT\s+[A-Za-z_]\w*\s*:\s*TapestryNode/.test(q) && /tapestryKey\s+IS\s+NOT\s+NULL/i.test(q) && !isCount) {
          note('unlabelled-keys');
          return g.nodes.filter((n) => !n.labels.includes('TapestryNode') && n.key !== null && n.key !== undefined).map((n) => ({ [alias || 'k']: String(n.key) }));
        }
        if (/\.\s*id\s+IS\s+NULL/i.test(q) && /HAS_TAG/.test(q)) {
          // A query that also asks `AND <v>:TapestryNode` counts only the event-less nodes that carry the label.
          const labelled = /\bAND\s+[A-Za-z_]\w*\s*:\s*TapestryNode\b/.test(q);
          const eventLess = g.nodes.filter((n) => n.labels.includes('NostrEvent') && (n.id === null || n.id === undefined) && n.tags > 0
            && (!labelled || n.labels.includes('TapestryNode')));
          if (isCount) { note('event-less-count'); return one(eventLess.length, 'count'); }
          note('event-less-rows');
          return eventLess.slice(0, limitOf()).map((n) => ({ [alias || 'uuid']: n.uuid }));
        }
        if (isCount && /tapestryKey\s*=\s*'\{\}'/.test(q) && !/IS\s+NULL/i.test(q)) {
          note('placeholders');
          return one(g.nodes.filter((n) => n.key === '{}').length, 'count');
        }
        if (isCount && /tapestryKey\s+IS\s+NULL/i.test(q)) {
          const braces = /'\{\}'|"\{\}"/.test(q);
          note('without-key');
          return one(g.nodes.filter((n) => n.key === null || n.key === undefined || (braces && n.key === '{}')).length, 'count');
        }
        if (isCount && /NOT\s+[A-Za-z_]\w*\s*:\s*TapestryNode/.test(q)) { note('without-label'); return one(g.nodes.filter((n) => !n.labels.includes('TapestryNode')).length, 'count'); }
        if (isCount && /\(\s*[A-Za-z_]?\w*\s*:\s*TapestryNode\s*\)/.test(q)) { note('with-label'); return one(g.nodes.filter((n) => n.labels.includes('TapestryNode')).length, 'count'); }
      }

      const keys = keysOf(g);
      if (/tapestryKey/.test(q)) {
        if (/count\s*\(\s*DISTINCT/i.test(q)) { note('distinct-keys'); return one(new Set(keys).size, 'count'); }
        if (/count\s*\(/i.test(q)) { note('key-count'); return one(keys.length, 'count'); }
        note('keys');
        return keys.map((k) => ({ [alias || 'tapestryKey']: k }));
      }
      if (/-\s*\[/.test(q) && /count\s*\(/i.test(q)) { note('relationships'); return one(g.relationships, 'count'); }
      if (/count\s*\(/i.test(q)) { note('nodes'); return one(nodeCount(g), 'count'); }
      if (/RETURN\s+1\b/i.test(q)) { note('ping'); return one(1, '1'); }
      note('unknown');
      throw new Error(`the fake graph database doesn't know this query: ${q}`);
    },
    /**
     * ADR graph-operations-foundation/0003 Amendment 2: a read whose rows go to onRow one at a time. It answers what
     * cypher would, and its log entry is cypher's, marked streamed: true, so traces read the same either way.
     */
    async cypherEach(query, params = {}, onRow) {
      const rows = await this.cypher(query, params);
      const s = load();
      const last = s.log[s.log.length - 1];
      if (last && last.call === 'cypher') last.streamed = true;
      save(s);
      for (const row of rows) onRow(row);
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
  const keys = keysOf(graph);
  return {
    nodes: nodeCount(graph), relationships: graph.relationships, tapestryKeys: keys.length,
    distinctTapestryKeys: new Set(keys).size, tapestryKeyDigest: keyDigest(keys),
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
  const graph = isNodeGraph(o.graph) ? o.graph : defaultGraph(o.graph || {});
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
  isNodeGraph, realKey, gnode, nodeGraph, migratedSchema, keysOf, lockStageNow,
  sha256, show, defaultGraph, newFakeState, readState, writeState, fakeSystem, fakeDumpBytes, parseFakeDump, keyDigest,
  countsOf, confPubkey, makeIdentity, addAccountKey, readKey, newId, writeBackup, folderFiles, backupMembers, tarWrite,
  tarRead, tarHeader, makeInstance, backupIds, leftovers, startTimeOf, deadPid, writeLock, runHarness, pick, calls, trace,
};
