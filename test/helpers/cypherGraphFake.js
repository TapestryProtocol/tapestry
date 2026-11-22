'use strict';
/**
 * The graph seam's fake for import nostr's suites (story graph-operations-first-slice #32; ADR
 * graph-operations-first-slice/0032 Decisions 7 and 13): src/operations/graph.js's two methods over a graph kept in a
 * JSON state file of test/helpers/graphFake.js's shape, every statement run by test/helpers/cypherEngine.js, reads and
 * writes, as Neo4j would, with Tapestry's uniqueness rules. A statement outside the engine's subset (graph search's
 * CALL, SHOW FULLTEXT INDEXES) goes to graphFake.js's own exec, so the other operations a suite calls still run.
 * test/helpers/operationsHarness.js installs it for a scenario's graphFake: { stateFile, engine: 'cypher' }, and
 * test/helpers/externalCliServer.js for spec.graphFakeEngine 'cypher'.
 *
 *   writeTransaction(work)  runs work(tx) over a copy of the graph, as one Neo4j transaction:
 *     - tx.run(cypher, params) → { rows, counters }; tx.read(cypher, params) → rows, and a read must write nothing;
 *     - a statement that fails fails the transaction, as Neo4j's does: each later statement in it throws "Cannot run
 *       query in this transaction, because it has been rolled back …", and the transaction rolls back however work
 *       ends, rejecting with the first failure;
 *     - the commit fails, as Neo4j's does, when a DELETE that wasn't DETACH left a relationship without its node:
 *       "Cannot delete node<…>, because it still has relationships" (Neo.ClientError.Schema.ConstraintValidationFailed);
 *     - work resolves → the copy is saved; else the saved graph stays as it was. The state's log gets { call: 'begin' },
 *       each statement ({ call: 'tx.run' | 'tx.read', kind: 'read' | 'write', query }), and { call: 'commit' } or
 *       { call: 'rollback', error }.
 *   read(cypher, params)    reads the saved graph ({ call: 'read', … } in the log); a statement that writes throws.
 *
 * The state's `failures`, each used up as it fires:
 *   unreachable: { after }  after `after` more commits, every writeTransaction and read rejects as neo4j-driver does
 *                           when the database can't be reached: an error whose code is ServiceUnavailable
 *   failWrite: [{ match, times = 1, code = 'Neo.ClientError.Schema.ConstraintValidationFailed', message, after = 0 }]
 *                           a statement that writes, and whose parameters hold the string `match` anywhere (an event's
 *                           id), fails with that code, `times` times in all; with `after` (review round 1), the first
 *                           `after` transactions holding it run as usual, so a later record of the same event fails
 *   slow: { ms }            (review round 1) every writeTransaction takes at least `ms` longer, never used up, so a
 *                           call's time budget runs out partway through a list of records
 *   meanwhile: [{ match, add: [{ labels, props }] }]  just before the first statement that writes and whose parameters
 *                           hold `match`, another transaction commits the nodes of `add` (each given a tapestryKey and the
 *                           shared label where it lacks them) to the saved graph and to this transaction's copy alike:
 *                           another import's placeholder, made after this one read the graph (Decision 7.9's race). The
 *                           log gets { call: 'meanwhile', match } just before the statement
 *                           (story graph-operations-first-slice #34, review round 1, finding 3) an entry may also carry
 *                           set: [{ key, props }]: that same other transaction gives the node with that tapestryKey those
 *                           properties (null takes one off), in the saved graph and this transaction's copy alike: another
 *                           export's record of the node, committed before this one's first write to it
 *                           (story graph-operations-first-slice #48, ADR 0048 Amendment 2 item 2) an entry may also carry
 *                           query, a regular expression's source: it then fires only at a statement whose text, on one
 *                           line, matches it too. So a suite can let another transaction commit a node at an address just
 *                           before one write naming that address, its placeholder statement, and not an earlier one that
 *                           names it too, such as the write of a b tag whose value is the address
 */

const fs = require('fs');
const crypto = require('crypto');
const engine = require('./cypherEngine');

const oneLine = (q) => String(q).replace(/\s+/g, ' ').trim();
const copy = (x) => JSON.parse(JSON.stringify(x));
function readState(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeState(file, s) { fs.writeFileSync(file, JSON.stringify(s)); }

/** Whether `needle` is one of the strings anywhere in `value`. */
function holds(value, needle) {
  if (typeof value === 'string') return value === needle || value.includes(needle);
  if (Array.isArray(value)) return value.some((x) => holds(x, needle));
  if (value && typeof value === 'object') return Object.values(value).some((x) => holds(x, needle));
  return false;
}

function unreachableError() {
  return Object.assign(new Error('Could not perform discovery. No routing servers available. (the fake graph: failures.unreachable)'), { code: 'ServiceUnavailable' });
}

/** Run one statement: the engine, or graphFake.js's exec for what the engine can't read. */
function exec(s, cypher, params, { write }) {
  try {
    return engine.run(s, cypher, params, { write, atomic: false });
  } catch (e) {
    if (!engine.isCantRun(e)) throw e;
    const G = require('./graphFake');
    try { return G.exec(s, cypher, params, { write }); } catch (e2) {
      if (/can't run this Cypher/.test(String(e2 && e2.message))) throw e;
      throw e2;
    }
  }
}
const kindOf = (cypher) => { try { return engine.writesOf(cypher) ? 'write' : 'read'; } catch { return /\b(CREATE|MERGE|SET|DELETE|REMOVE)\b/i.test(String(cypher)) ? 'write' : 'read'; } };

function fakeGraph(stateFile) {
  return {
    async writeTransaction(work) {
      const committed = readState(stateFile);
      const f = committed.failures || {};
      if (f.unreachable && !(f.unreachable.after > 0)) throw unreachableError();
      if (f.slow && f.slow.ms > 0) await new Promise((resolve) => setTimeout(resolve, f.slow.ms));
      const s = copy(committed);
      const log = [];
      let failed = null;
      const passed = new Set(); // failWrite entries this transaction was let through under `after`
      const fire = (cypher, params) => {
        if (kindOf(cypher) !== 'write') return;
        const meanwhile = Array.isArray(f.meanwhile) ? f.meanwhile : [];
        const m = meanwhile.findIndex((x) => x && holds(params || {}, x.match) && (typeof x.query !== 'string' || new RegExp(x.query).test(oneLine(cypher))));
        if (m >= 0) {
          const [one] = meanwhile.splice(m, 1);
          for (const n of one.add || []) {
            const props = { ...n.props };
            if (typeof props.tapestryKey !== 'string') props.tapestryKey = crypto.randomUUID();
            const labels = [...new Set([...(n.labels || []), 'TapestryNode'])];
            const eid = Math.max(committed.nextEid || 1, s.nextEid || 1);
            for (const st of [committed, s]) { st.nodes.push({ eid, labels: [...labels], props: { ...props } }); st.nextEid = eid + 1; }
          }
          for (const x of one.set || []) {
            for (const st of [committed, s]) {
              const node = st.nodes.find((n) => n.props && n.props.tapestryKey === x.key);
              if (!node) continue;
              for (const [p, v] of Object.entries(x.props || {})) { if (v === null) delete node.props[p]; else node.props[p] = copy(v); }
            }
          }
          log.push({ call: 'meanwhile', match: one.match });
        }
        const fw = Array.isArray(f.failWrite) ? f.failWrite : [];
        const w = fw.findIndex((x) => x && (x.times === undefined || x.times > 0) && holds(params || {}, x.match));
        if (w >= 0 && passed.has(fw[w])) return;
        if (w >= 0 && fw[w].after > 0) { fw[w].after -= 1; passed.add(fw[w]); return; }
        if (w >= 0) {
          const x = fw[w];
          x.times = (x.times === undefined ? 1 : x.times) - 1;
          if (x.times <= 0) fw.splice(w, 1);
          const code = x.code || 'Neo.ClientError.Schema.ConstraintValidationFailed';
          throw Object.assign(new Error(x.message || `Node(1) already exists with label \`NostrEvent\` and property \`id\` = '${x.match}' (the fake graph: failures.failWrite)`), { code });
        }
      };
      const statement = (call, write) => async (cypher, params) => {
        log.push({ call, kind: kindOf(cypher), query: oneLine(cypher).slice(0, 200) });
        if (failed) throw Object.assign(new Error(`Cannot run query in this transaction, because it has been rolled back either because of an error or explicit termination (the first failure: ${failed.message})`), { code: 'Neo.ClientError.Transaction.TransactionNotFound' });
        try {
          fire(cypher, params);
          const r = exec(s, cypher, params || {}, { write });
          return call === 'tx.read' ? r.rows : { rows: r.rows, counters: r.counters };
        } catch (e) {
          failed = e;
          throw e;
        }
      };
      const tx = { run: statement('tx.run', true), read: statement('tx.read', false) };
      // What the failures used up stays used up, whether this transaction commits or not.
      const keepFailures = (into) => { into.failures = f; };
      try {
        const result = await work(tx);
        if (failed) throw failed;
        const dangling = engine.danglingRels(s);
        if (dangling.length) {
          const live = new Set(s.nodes.map((n) => n.eid));
          const r = dangling[0];
          const eid = live.has(r.from) ? r.to : r.from;
          throw Object.assign(new Error(`Cannot delete node<${eid}>, because it still has relationships. To delete this node, you must first delete its relationships. (at the commit)`), { code: 'Neo.ClientError.Schema.ConstraintValidationFailed' });
        }
        if (f.unreachable) f.unreachable.after -= 1;
        keepFailures(s);
        s.log = [...(committed.log || []), { call: 'begin' }, ...log, { call: 'commit' }];
        writeState(stateFile, s);
        return result;
      } catch (err) {
        keepFailures(committed);
        committed.log = [...(committed.log || []), { call: 'begin' }, ...log, { call: 'rollback', error: String((err && err.message) || err).slice(0, 300), code: (err && err.code) || null }];
        writeState(stateFile, committed);
        throw err;
      }
    },
    async read(cypher, params) {
      const s = readState(stateFile);
      const f = s.failures || {};
      if (f.unreachable && !(f.unreachable.after > 0)) throw unreachableError();
      const rows = exec(s, cypher, params || {}, { write: false }).rows;
      const after = readState(stateFile);
      after.log = [...(after.log || []), { call: 'read', kind: kindOf(cypher), query: oneLine(cypher).slice(0, 200) }];
      writeState(stateFile, after);
      return rows;
    },
  };
}

/** The transactions in a state's log, from entry `from`: [{ statements, outcome, error, code, meanwhile }]. */
function transactions(log, from = 0) {
  const out = [];
  let cur = null;
  for (const e of (log || []).slice(from)) {
    if (e.call === 'begin') { cur = { statements: [], outcome: null, error: null, code: null, meanwhile: false }; continue; }
    if (!cur) continue;
    if (e.call === 'meanwhile') { cur.meanwhile = true; continue; }
    if (e.call === 'commit' || e.call === 'rollback') { cur.outcome = e.call; cur.error = e.error || null; cur.code = e.code || null; out.push(cur); cur = null; continue; }
    cur.statements.push(e);
  }
  return out;
}

module.exports = { fakeGraph, transactions, readState, writeState, exec };
