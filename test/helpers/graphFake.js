'use strict';
/**
 * A fake for src/operations/graph.js, the seam every graph operation and rule reaches Neo4j through (ADR
 * graph-operations-foundation/0004 Decision 9). Story graph-operations-foundation #4 is its first user.
 *
 * fakeGraph(stateFile) returns the seam's two methods over a graph kept in a JSON state file, so the test that set the
 * graph up can read what was committed:
 *
 *   { nodes: [{ eid, labels, props }], rels: [{ eid, type, from, to, props }], failures: {}, log: [], nextEid }
 *
 *   writeTransaction(work)  runs work(tx) over a copy of the graph and saves the copy only when work resolves. A throw
 *                           anywhere leaves the graph as it was (the transaction rolled back), and the log says which.
 *                           tx.run(cypher, params) resolves { rows, counters }; tx.read(cypher, params) the rows.
 *   read(cypher, params)    reads the saved graph; a statement that writes throws.
 *
 * It runs the statements ADR 0004 names, and nothing else:
 *   - a read of one node: one MATCH of one node, with or without a property map, then WHERE, WITH and RETURN, read by
 *     test/helpers/nodeCypherFake.js. A whole node comes back as src/lib/neo4j-driver.js's toJS gives it,
 *     { ...properties, _labels }, without _id;
 *   - the guard's read of the declared relationship types (Decision 6): from the concept header, found by a parameter
 *     that holds its uuid, through IS_THE_CONCEPT_FOR, IS_A_SUPERSET_OF*0.. and HAS_ELEMENT, then each element's json
 *     tag (HAS_TAG to a NostrEventTag of type 'json'). Its RETURN items read `….tapestryKey`, `….value`, `….slug` or
 *     `….name`;
 *   - MERGE of a relationship, `MERGE (a)-[r:TYPE]->(b)`, between two nodes the statement finds by tapestryKey;
 *   - a MATCH of a relationship between two such nodes, then DELETE of it;
 *   - CREATE of a GraphChange node with a property map, then SET of its properties (Decision 5), with or without
 *     src/lib/tapestry-key-cypher.js's keyNode(v) fragment after it, which gives the node the shared label and a key
 *     where it lacks either (ADR 0003 Decision 8, the one rule for every node a statement makes).
 * A node is found by tapestryKey through `(v… {tapestryKey: $p})` or `v.tapestryKey = $p`, must carry every label the
 * pattern names for it, and is left out when the statement says `NOT v:GraphChange` and it is an entry. An aggregate
 * RETURN (count) answers one row even when nothing matched, as Cypher's does.
 *
 * Anything else throws "the fake graph can't run this Cypher", naming the statement, so a test that fails on the
 * fake's limits says so. failures: { change: true } makes a relationship's MERGE or DELETE throw before it writes, and
 * { entry: true } the CREATE of a GraphChange node: the AC4 tests' crash between a change and its entry.
 */

const fs = require('fs');
const crypto = require('crypto');
const { runQuery } = require('./nodeCypherFake');
const { keyNode } = require('../../src/lib/tapestry-key-cypher');

const oneLine = (q) => String(q).replace(/\s+/g, ' ').trim();
function cantRun(why, q) {
  return new Error(`the fake graph can't run this Cypher (${why}); it runs ADR graph-operations-foundation/0004's statements only (test/helpers/graphFake.js): ${oneLine(q).slice(0, 400)}`);
}
const zero = () => ({ nodesCreated: 0, nodesDeleted: 0, relationshipsCreated: 0, relationshipsDeleted: 0, propertiesSet: 0, labelsAdded: 0 });
const copy = (x) => JSON.parse(JSON.stringify(x));

/** A new state file's content: an empty graph, with `extra` over it. */
function emptyState(extra = {}) {
  return { nodes: [], rels: [], failures: {}, log: [], nextEid: 1, ...extra };
}
function readState(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeState(file, s) { fs.writeFileSync(file, JSON.stringify(s)); }

// ── reading the statement ──
const stripStrings = (q) => q.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, "''");
const WRITES = /\b(CREATE|MERGE|SET|DELETE|REMOVE|DETACH|FOREACH)\b/i;
const HAS_RELATIONSHIP = /-\s*\[|\]\s*-/;
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Split `text` on commas outside brackets, braces, parentheses and strings. */
function splitTop(text) {
  const parts = [];
  let depth = 0, cur = '', quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { cur += c; if (c === '\\') { cur += text[++i] || ''; } else if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"') { quote = c; cur += c; continue; }
    if ('([{'.includes(c)) depth++;
    if (')]}'.includes(c)) depth--;
    if (c === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

/** The RETURN clause's items, [{ expr, alias }], or [] when there is none. */
function returnItems(q) {
  const m = q.match(/\bRETURN\b([\s\S]*)$/i);
  if (!m) return [];
  const body = m[1].replace(/\b(ORDER\s+BY|SKIP|LIMIT)\b[\s\S]*$/i, '').trim();
  return splitTop(body.replace(/^DISTINCT\s+/i, '')).map((item) => {
    const a = item.match(/^([\s\S]*?)\s+AS\s+([A-Za-z_]\w*)$/i);
    return a ? { expr: a[1].trim(), alias: a[2] } : { expr: item, alias: item };
  });
}

/** A value in a property map or a SET: a parameter, randomUUID(), or a literal. */
function valueOf(expr, params, q) {
  const e = expr.trim();
  let m;
  if ((m = e.match(/^\$(\w+)$/))) return params[m[1]] === undefined ? null : params[m[1]];
  if (/^randomUUID\s*\(\s*\)$/i.test(e)) return crypto.randomUUID();
  if ((m = e.match(/^'((?:[^'\\]|\\.)*)'$/)) || (m = e.match(/^"((?:[^"\\]|\\.)*)"$/))) return m[1].replace(/\\(.)/g, '$1');
  if (/^-?\d+(\.\d+)?$/.test(e)) return Number(e);
  if (/^true$/i.test(e)) return true;
  if (/^false$/i.test(e)) return false;
  if (/^null$/i.test(e)) return null;
  throw cantRun(`a value it can't read (${e})`, q);
}

/** The entries of a property map's text, `{a: $x, b: 'y'}`, as [[name, expr]]. */
function mapEntries(text, q) {
  const inner = text.trim().replace(/^\{/, '').replace(/\}$/, '');
  if (!inner.trim()) return [];
  return splitTop(inner).map((pair) => {
    const m = pair.match(/^`?([A-Za-z_]\w*)`?\s*:\s*([\s\S]+)$/);
    if (!m) throw cantRun(`a property map entry it can't read (${pair})`, q);
    return [m[1], m[2]];
  });
}

const nodeOf = (s, eid) => s.nodes.find((n) => n.eid === eid);
const toJsShape = (n) => ({ ...n.props, _labels: [...n.labels] });

/**
 * The node variable `v` stands for, when the statement finds it by tapestryKey; null when no node matches.
 * Throws when the statement doesn't say how `v` is found.
 */
function bound(s, q, params, v) {
  const V = esc(v);
  let key, labels = [];
  const inline = q.match(new RegExp(`\\(\\s*${V}\\s*((?::\\s*[A-Za-z_]\\w*(?:\\s*\\|\\s*[A-Za-z_]\\w*)*\\s*)*)\\{\\s*tapestryKey\\s*:\\s*\\$(\\w+)\\s*\\}\\s*\\)`));
  if (inline) {
    key = params[inline[2]];
    labels = inline[1].split(':').map((x) => x.trim()).filter(Boolean).map((alts) => alts.split('|').map((l) => l.trim()));
  } else {
    const where = q.match(new RegExp(`\\b${V}\\.tapestryKey\\s*=\\s*\\$(\\w+)`));
    if (!where) throw cantRun(`it can't tell how the statement finds ${v} by its tapestryKey`, q);
    key = params[where[1]];
    const pattern = q.match(new RegExp(`\\(\\s*${V}\\s*((?::\\s*[A-Za-z_]\\w*(?:\\s*\\|\\s*[A-Za-z_]\\w*)*\\s*)+)\\)`));
    if (pattern) labels = pattern[1].split(':').map((x) => x.trim()).filter(Boolean).map((alts) => alts.split('|').map((l) => l.trim()));
  }
  if (typeof key !== 'string') return null;
  const skipEntries = new RegExp(`\\bNOT\\s+${V}\\s*:\\s*GraphChange\\b`).test(q);
  return s.nodes.find((n) => n.props.tapestryKey === key
    && labels.every((alts) => alts.some((l) => n.labels.includes(l)))
    && !(skipEntries && n.labels.includes('GraphChange'))) || null;
}

/** One row of a RETURN over a relationship statement's variables. */
function relRow(items, vars, q) {
  const row = {};
  for (const { expr, alias } of items) {
    let m;
    if ((m = expr.match(/^count\s*\(\s*(\*|\w+)\s*\)$/i))) { row[alias] = vars.count; continue; }
    if ((m = expr.match(/^(\w+)\.tapestryKey$/)) && vars.nodes[m[1]]) { row[alias] = vars.nodes[m[1]].props.tapestryKey; continue; }
    if ((m = expr.match(/^type\s*\(\s*(\w+)\s*\)$/i)) && m[1] === vars.relVar) { row[alias] = vars.type; continue; }
    if (expr === vars.relVar && vars.rel) { row[alias] = { ...vars.rel.props, _type: vars.type }; continue; }
    throw cantRun(`a RETURN item it can't read (${expr})`, q);
  }
  return row;
}
const isAggregate = (items) => items.length > 0 && items.every(({ expr }) => /^count\s*\(/i.test(expr));

// ── the statements ──
function readOneNode(s, q, params) {
  const nodes = s.nodes.map((n) => ({ labels: [...n.labels], props: copy(n.props) }));
  return runQuery(nodes, q, params).map((r) => Object.fromEntries(Object.entries(r).map(([k, x]) => {
    const plain = (y) => (y && typeof y === 'object' && Array.isArray(y.labels) && y.properties ? { ...y.properties, _labels: y.labels } : Array.isArray(y) ? y.map(plain) : y);
    return [k, plain(x)];
  })));
}

function readDeclared(s, q, params) {
  const items = returnItems(q);
  if (!items.length) throw cantRun('no RETURN', q);
  const values = new Set(Object.values(params || {}).filter((x) => typeof x === 'string'));
  const header = s.nodes.find((n) => n.labels.includes('ConceptHeader') && values.has(n.props.uuid));
  if (!header) return [];
  const out = (from, type) => s.rels.filter((r) => r.from === from && r.type === type).map((r) => r.to);
  const start = out(header.eid, 'IS_THE_CONCEPT_FOR').filter((eid) => (nodeOf(s, eid) || { labels: [] }).labels.includes('Superset'));
  const seen = new Set(start);
  const queue = [...start];
  while (queue.length) { const x = queue.shift(); for (const y of out(x, 'IS_A_SUPERSET_OF')) if (!seen.has(y)) { seen.add(y); queue.push(y); } }
  const elements = [...new Set([...seen].flatMap((x) => out(x, 'HAS_ELEMENT')))];
  return elements.map((eid) => {
    const e = nodeOf(s, eid);
    const tag = out(eid, 'HAS_TAG').map((t) => nodeOf(s, t)).find((t) => t && t.labels.includes('NostrEventTag') && t.props.type === 'json');
    const row = {};
    for (const { expr, alias } of items) {
      if (/\.tapestryKey$/.test(expr)) row[alias] = e.props.tapestryKey === undefined ? null : e.props.tapestryKey;
      else if (/\.value$/.test(expr)) row[alias] = tag && tag.props.value !== undefined ? tag.props.value : null;
      else if (/\.slug$/.test(expr)) row[alias] = e.props.slug === undefined ? null : e.props.slug;
      else if (/\.name$/.test(expr)) row[alias] = e.props.name === undefined ? null : e.props.name;
      else throw cantRun(`a RETURN item it can't read in the declared types' read (${expr})`, q);
    }
    return row;
  });
}

function createEntry(s, query, params) {
  if (s.failures && s.failures.entry) throw new Error('the fake graph failed while writing the change entry (failures.entry)');
  // keyNode(v) after the CREATE: read as "the label and a key where either is missing", then set aside.
  let q = query;
  let keyed = false;
  const made = String(query).match(/\bCREATE\s*\(\s*(\w+)/);
  if (made) {
    const fragment = oneLine(keyNode(made[1]));
    if (oneLine(query).includes(fragment)) { q = oneLine(query).replace(fragment, ' '); keyed = true; }
  }
  const m = q.match(/\bCREATE\s*\(\s*(\w+)\s*((?::\s*[A-Za-z_]\w*\s*)+)(\{[\s\S]*?\})?\s*\)/);
  if (!m) throw cantRun('a CREATE it can\'t read', q);
  const v = m[1];
  const labels = m[2].split(':').map((x) => x.trim()).filter(Boolean);
  const props = {};
  let propertiesSet = 0;
  for (const [k, e] of m[3] ? mapEntries(m[3], q) : []) {
    const val = valueOf(e, params, q);
    if (val !== null) { props[k] = val; propertiesSet++; }
  }
  const set = q.match(/\bSET\b([\s\S]*?)(?=\bRETURN\b|\bWITH\b|$)/i);
  if (set) {
    for (const a of splitTop(set[1])) {
      const am = a.match(new RegExp(`^${esc(v)}\\.([A-Za-z_]\\w*)\\s*=\\s*([\\s\\S]+)$`));
      if (!am) throw cantRun(`a SET it can't read (${a})`, q);
      const val = valueOf(am[2], params, q);
      if (val === null) delete props[am[1]]; else { props[am[1]] = val; propertiesSet++; }
    }
  }
  let labelsAdded = labels.length;
  if (keyed) {
    if (!labels.includes('TapestryNode')) { labels.push('TapestryNode'); labelsAdded++; }
    if (props.tapestryKey === undefined || props.tapestryKey === null || props.tapestryKey === '{}') { props.tapestryKey = crypto.randomUUID(); propertiesSet++; }
  }
  const n = { eid: s.nextEid++, labels, props };
  s.nodes.push(n);
  const rows = returnItems(q).length ? [Object.fromEntries(returnItems(q).map(({ expr, alias }) => {
    if (expr === v) return [alias, toJsShape(n)];
    const pm = expr.match(new RegExp(`^${esc(v)}\\.([A-Za-z_]\\w*)$`));
    if (pm) return [alias, props[pm[1]] === undefined ? null : props[pm[1]]];
    throw cantRun(`a RETURN item it can't read after the CREATE (${expr})`, q);
  }))] : [];
  return { rows, counters: { ...zero(), nodesCreated: 1, labelsAdded, propertiesSet } };
}

const REL_TYPE = '`?([A-Za-z][A-Za-z0-9_]*)`?';

function mergeRel(s, q, params) {
  const m = q.match(new RegExp(`\\bMERGE\\s*\\(\\s*(\\w+)\\s*\\)\\s*-\\s*\\[\\s*(\\w*)\\s*:\\s*${REL_TYPE}\\s*\\]\\s*->\\s*\\(\\s*(\\w+)\\s*\\)`));
  if (!m) throw cantRun('a MERGE it can\'t read', q);
  const [, av, rv, type, bv] = m;
  if (s.failures && s.failures.change) throw new Error('the fake graph failed while writing the change (failures.change)');
  const a = bound(s, q, params, av);
  const b = bound(s, q, params, bv);
  const items = returnItems(q);
  if (!a || !b) return { rows: isAggregate(items) ? [relRow(items, { count: 0, nodes: {}, relVar: rv, type }, q)] : [], counters: zero() };
  let rel = s.rels.find((r) => r.from === a.eid && r.to === b.eid && r.type === type);
  let created = 0;
  if (!rel) { rel = { eid: s.nextEid++, type, from: a.eid, to: b.eid, props: {} }; s.rels.push(rel); created = 1; }
  const rows = items.length ? [relRow(items, { count: 1, nodes: { [av]: a, [bv]: b }, relVar: rv, rel, type }, q)] : [];
  return { rows, counters: { ...zero(), relationshipsCreated: created } };
}

function deleteRel(s, q, params) {
  const m = q.match(new RegExp(`\\(\\s*(\\w+)[^()]*\\)\\s*-\\s*\\[\\s*(\\w+)\\s*:\\s*${REL_TYPE}\\s*\\]\\s*->\\s*\\(\\s*(\\w+)[^()]*\\)`));
  if (!m) throw cantRun('a relationship pattern it can\'t read', q);
  const [, av, rv, type, bv] = m;
  if (!new RegExp(`\\bDELETE\\s+${esc(rv)}\\b`).test(q)) throw cantRun(`a DELETE of something other than ${rv}`, q);
  if (s.failures && s.failures.change) throw new Error('the fake graph failed while writing the change (failures.change)');
  const a = bound(s, q, params, av);
  const b = bound(s, q, params, bv);
  const gone = a && b ? s.rels.filter((r) => r.from === a.eid && r.to === b.eid && r.type === type) : [];
  s.rels = s.rels.filter((r) => !gone.includes(r));
  const items = returnItems(q);
  let rows = [];
  if (isAggregate(items)) rows = [relRow(items, { count: gone.length, nodes: {}, relVar: rv, type }, q)];
  else if (items.length) throw cantRun('a RETURN after a DELETE that isn\'t a count', q);
  return { rows, counters: { ...zero(), relationshipsDeleted: gone.length } };
}

/** Run one statement over state `s` (changed in place); { rows, counters }. */
function exec(s, cypher, params = {}, { write = false } = {}) {
  const q = String(cypher);
  const bare = stripStrings(q);
  const writes = WRITES.test(bare);
  const hasRel = HAS_RELATIONSHIP.test(bare);
  if (!writes && !hasRel) return { rows: readOneNode(s, q, params), counters: zero() };
  if (!writes && /\bHAS_ELEMENT\b/.test(bare)) return { rows: readDeclared(s, q, params), counters: zero() };
  if (writes && !write) throw new Error(`a read must write nothing; it sent: ${oneLine(q).slice(0, 300)}`);
  if (/\bCREATE\s*\(\s*\w+\s*:\s*[A-Za-z_:\s]*\bGraphChange\b/.test(bare)) return createEntry(s, q, params);
  if (/\bMERGE\s*\(\s*\w+\s*\)\s*-\s*\[/.test(bare)) return mergeRel(s, q, params);
  if (/\bDELETE\b/.test(bare) && hasRel) return deleteRel(s, q, params);
  throw cantRun('not one of the statements it runs', q);
}

const KIND = (q) => {
  const b = stripStrings(String(q));
  if (/\bCREATE\b/.test(b)) return 'create';
  if (/\bMERGE\b/.test(b)) return 'merge';
  if (/\bDELETE\b/.test(b)) return 'delete';
  if (/\bHAS_ELEMENT\b/.test(b)) return 'declared';
  return 'read';
};

function fakeGraph(stateFile) {
  return {
    async writeTransaction(work) {
      const committed = readState(stateFile);
      const s = copy(committed);
      const log = [];
      const tx = {
        async run(cypher, params) { log.push({ call: 'tx.run', kind: KIND(cypher), query: oneLine(cypher).slice(0, 200) }); return exec(s, cypher, params, { write: true }); },
        async read(cypher, params) { log.push({ call: 'tx.read', kind: KIND(cypher), query: oneLine(cypher).slice(0, 200) }); return exec(s, cypher, params).rows; },
      };
      try {
        const result = await work(tx);
        s.log = [...committed.log, { call: 'begin' }, ...log, { call: 'commit' }];
        writeState(stateFile, s);
        return result;
      } catch (err) {
        committed.log.push({ call: 'begin' }, ...log, { call: 'rollback', error: String((err && err.message) || err).slice(0, 200) });
        writeState(stateFile, committed);
        throw err;
      }
    },
    async read(cypher, params) {
      const s = readState(stateFile);
      const rows = exec(s, cypher, params).rows;
      const after = readState(stateFile);
      after.log.push({ call: 'read', kind: KIND(cypher), query: oneLine(cypher).slice(0, 200) });
      writeState(stateFile, after);
      return rows;
    },
  };
}

/** Run statements over a state object in memory, for a test that calls a rule's violations(items, read) itself. */
function readerOver(state) {
  return async (cypher, params) => exec(state, cypher, params).rows;
}

module.exports = { fakeGraph, readerOver, emptyState, readState, writeState, exec };
