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
 *
 * Story graph-operations-foundation #5 (ADR graph-operations-foundation/0005, Implementation notes) adds:
 *   - S1–S4, the reads over paths: the concept (its header by tapestryKey, its json, its JSON Schema node and that
 *     node's json), the property node (the primary property, the section node, the field's node), the marks (from the
 *     first set back to each concept header) and the elements (the class-thread walk, each element's json tag and its
 *     properties under a prefix, through keys()). Every read that names a relationship and isn't story 4's declared
 *     types' read (a header found by uuid, with no keys()) is evaluated as Neo4j would by test/helpers/pathCypherFake.js,
 *     over these relationship types only: HAS_TAG, IS_THE_JSON_SCHEMA_FOR, IS_THE_PRIMARY_PROPERTY_FOR,
 *     IS_A_PROPERTY_OF, HAS_ELEMENT, IS_THE_CONCEPT_FOR, IS_A_SUPERSET_OF. S5, the first set by uuid, is a read of one
 *     node, as above;
 *   - S8, the copies: `UNWIND $rows AS row MATCH (n[:Labels] {tapestryKey: row.key}) [WHERE NOT n:GraphChange]
 *     SET n += row.props`, the key given in the node's map or as `n.tapestryKey = row.key` in the WHERE, optionally
 *     with RETURN count(n). A null in props removes that property. As Neo4j does, it refuses a value a property can't
 *     hold: a map, a list holding a null, a list or a map, or a list of mixed types (a neo4j.int and a float among
 *     them). A neo4j.int is kept as { $int: '<digits>' }, so a test can tell it from a float, and every read gives it
 *     back as a number, as toJS does. S6 and S7, the mark's MERGE and DELETE, are the relationship statements above.
 *
 * Story graph-operations-first-slice #16 (ADR graph-operations-first-slice/0016, Implementation notes C1–C11) adds:
 *   - C1, the lock: `MATCH (n:NostrEvent|TapestryNode {uuid: $p}) SET n.<lock> = true REMOVE n.<lock> RETURN n.tapestryKey AS a`,
 *     which writes nothing that stays and answers the node's key (no row when no node has the address);
 *   - C5, a node: the CREATE above, with any labels and a property map, not only a GraphChange's;
 *   - C6, its tags: `MATCH (n… {tapestryKey: $p}) UNWIND $tags AS t CREATE (n)-[:HAS_TAG]->(tn:NostrEventTag {…: t.…})
 *     SET tn.x = t.x, … [keyNode('tn')] [RETURN count(tn) AS a]`, one tag node per row, a null SET leaving it out;
 *   - C11, a removed tag: `MATCH (t:NostrEventTag… {tapestryKey: $p}) DETACH DELETE t`, for a tag node only;
 *   - the four wiring types its reads (C9) walk: IS_THE_PROPERTIES_SET_FOR, IS_THE_PROPERTY_TREE_GRAPH_FOR,
 *     IS_THE_CORE_GRAPH_FOR and IS_THE_CONCEPT_GRAPH_FOR; and toLower in both read fakes (C8).
 * C3, C4, C8 and C9 are reads the two read fakes run; C7 is the MERGE above, and C10 is S8.
 *
 * Story graph-operations-first-slice #13 (ADR graph-operations-first-slice/0013, Decision 2, S2 and S3) adds the
 * one-hop reads from a node found by its tapestryKey (ONE_HOP_FROM_KEY below), which the path fake runs over
 * relationships of every type, with elementId() and properties() (test/helpers/pathCypherFake.js), when nothing later in
 * the statement names another relationship.
 *
 * Anything else throws "the fake graph can't run this Cypher", naming the statement, so a test that fails on the
 * fake's limits says so. failures: { change: true } makes a relationship's MERGE or DELETE throw before it writes, and
 * { entry: true } the CREATE of a GraphChange node: the AC4 tests' crash between a change and its entry.
 */

const fs = require('fs');
const crypto = require('crypto');
const { runQuery } = require('./nodeCypherFake');
const { runPathQuery, plainProps, isNeoInt } = require('./pathCypherFake');
const { keyNode } = require('../../src/lib/tapestry-key-cypher');

const oneLine = (q) => String(q).replace(/\s+/g, ' ').trim();
function cantRun(why, q) {
  return new Error(`the fake graph can't run this Cypher (${why}); it runs ADR graph-operations-foundation/0004's and 0005's statements only (test/helpers/graphFake.js): ${oneLine(q).slice(0, 400)}`);
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
const WRITE_CLAUSES = /\b(CREATE|MERGE|SET|DELETE|REMOVE|DETACH|FOREACH)\b/i;
// A label, a property or a parameter may spell a clause's word (a Set node, $set: ADR 0005's S3 and S5): only a
// clause writes.
const WRITES = { test: (bare) => WRITE_CLAUSES.test(bare.replace(/\$\w+/g, '$p').replace(/:\s*`?[A-Za-z_]\w*`?(?:\s*\|\s*`?[A-Za-z_]\w*`?)*/g, ':L').replace(/\.\s*[A-Za-z_]\w*/g, '.p')) };
const HAS_RELATIONSHIP = /-\s*\[|\]\s*-|-->|<--/;
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
  // A stored integer ({ $int }, from S8) reads as a number, as toJS gives a neo4j Integer.
  const nodes = s.nodes.map((n) => ({ labels: [...n.labels], props: plainProps(copy(n.props)) }));
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

/** The CREATE of one node with labels and a property map: a GraphChange entry's (ADR 0004), or any node's (C5). */
function createEntry(s, query, params) {
  const entry = /\bCREATE\s*\(\s*\w+\s*:[A-Za-z_:\s]*\bGraphChange\b/.test(stripStrings(String(query)));
  if (entry && s.failures && s.failures.entry) throw new Error('the fake graph failed while writing the change entry (failures.entry)');
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

// ── ADR 0005 ──
/** The relationship types ADR 0005's reads (S1–S4) walk; a read over paths may name these and no others. */
const PATH_READ_TYPES = Object.freeze(['HAS_TAG', 'IS_THE_JSON_SCHEMA_FOR', 'IS_THE_PRIMARY_PROPERTY_FOR', 'IS_A_PROPERTY_OF', 'HAS_ELEMENT', 'IS_THE_CONCEPT_FOR', 'IS_A_SUPERSET_OF',
  // ADR graph-operations-first-slice/0016's C9: a concept's core nodes, by the wiring types today's create-concept makes.
  'IS_THE_PROPERTIES_SET_FOR', 'IS_THE_PROPERTY_TREE_GRAPH_FOR', 'IS_THE_CORE_GRAPH_FOR', 'IS_THE_CONCEPT_GRAPH_FOR']);

/**
 * ADR graph-operations-first-slice/0013's one-hop reads (story graph-operations-first-slice #13): a statement that opens
 * with one relationship, held in a variable, of no named type or of one type in backticks, from a node found by its
 * tapestryKey to a bare node, and names no other relationship. They read relationships of every type, so the path fake
 * runs them with no repertoire (`types: null`). A relationship with no variable, a type outside backticks, a second
 * hop, or any relationship later in the statement (LATER_RELATIONSHIP: a later MATCH, OPTIONAL MATCH or pattern in
 * WHERE) keeps the repertoire, so the fake still refuses a type it doesn't read (review 13, finding 2; F24).
 */
const ONE_HOP_FROM_KEY = /^\s*MATCH\s*\(\s*\w+\s*:\s*TapestryNode\s*\{\s*tapestryKey\s*:\s*\$\w+\s*\}\s*\)\s*(?:-\s*\[\s*\w+\s*(?::\s*`[A-Za-z][A-Za-z0-9_]*`\s*)?\]\s*->|<-\s*\[\s*\w+\s*(?::\s*`[A-Za-z][A-Za-z0-9_]*`\s*)?\]\s*-)\s*\(\s*\w+\s*\)\s*(?:WHERE|WITH|RETURN|OPTIONAL)\b/i;
/** A relationship pattern anywhere in the rest of a statement: -[…]-, -->, <-- or --. */
const LATER_RELATIONSHIP = /-\s*\[|\]\s*-|--/;
const isOneHopFromKey = (bare) => {
  const m = ONE_HOP_FROM_KEY.exec(bare);
  return Boolean(m) && !LATER_RELATIONSHIP.test(bare.slice(m.index + m[0].length));
};

/** Story 4's declared types' read: from a header found by uuid, through IS_THE_CONCEPT_FOR to HAS_ELEMENT, with no keys(). */
const isDeclaredTypesRead = (bare) => /\bHAS_ELEMENT\b/.test(bare) && /\bIS_THE_CONCEPT_FOR\b/.test(bare)
  && /\{\s*uuid\s*:\s*\$\w+\s*\}/.test(bare) && !/\bkeys\s*\(/i.test(bare);

/** What a Neo4j property can hold, as the fake keeps it; throws, as Neo4j does, for anything else. */
function storable(v, prop) {
  const refuse = (what) => new Error(`Neo4j can't store ${what} in the property ${prop}: property values can only be of primitive types or arrays thereof (the fake graph refuses what Neo4j refuses)`);
  if (typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') return v;
  if (isNeoInt(v)) return { $int: v.toString() };
  if (Array.isArray(v)) {
    const kinds = new Set();
    const items = v.map((x) => {
      if (x === null || x === undefined) throw refuse('a list holding a null');
      if (Array.isArray(x) || (typeof x === 'object' && !isNeoInt(x))) throw refuse('a list holding a list or a map');
      kinds.add(isNeoInt(x) ? 'integer' : typeof x === 'number' ? 'float' : typeof x);
      return storable(x, prop);
    });
    if (kinds.size > 1) throw refuse(`a list of mixed types (${[...kinds].join(', ')})`);
    return items;
  }
  throw refuse(`a ${v === null ? 'null' : typeof v === 'object' ? 'map' : typeof v}`);
}

/** S8: UNWIND $rows AS row MATCH (n… {tapestryKey: row.key}) [WHERE NOT n:GraphChange] SET n += row.props. */
function writeCopies(s, q, params) {
  const one = oneLine(q);
  const m = one.match(/^UNWIND\s+\$(\w+)\s+AS\s+(\w+)\s+MATCH\s*\(\s*(\w+)\s*((?::\s*[A-Za-z_]\w*\s*)*)(\{[^}]*\})?\s*\)\s*(?:WHERE\s+([\s\S]*?)\s*)?SET\s+(\w+)\s*\+=\s*(\w+)\.(\w+)\s*(?:RETURN\s+([\s\S]+?))?\s*;?$/i);
  if (!m) throw cantRun("a write of copies it can't read (S8 is UNWIND $rows AS row MATCH (n:TapestryNode {tapestryKey: row.key}) WHERE NOT n:GraphChange SET n += row.props)", q);
  const [, listParam, rowVar, nodeVar, labelText, mapText, whereText, setVar, propsVar, propsField, returnText] = m;
  if (setVar !== nodeVar || propsVar !== rowVar) throw cantRun(`a SET of something other than ${nodeVar} += ${rowVar}.<field>`, q);
  const labels = (labelText || '').split(':').map((x) => x.trim()).filter(Boolean);
  let keyField = null;
  let skipEntries = false;
  if (mapText) {
    const km = mapText.match(new RegExp(`^\\{\\s*tapestryKey\\s*:\\s*${esc(rowVar)}\\.(\\w+)\\s*\\}$`));
    if (!km) throw cantRun(`a node map it can't read in a write of copies (${mapText})`, q);
    keyField = km[1];
  }
  for (const part of whereText ? whereText.split(/\s+AND\s+/i) : []) {
    let w;
    if ((w = part.trim().match(new RegExp(`^${esc(nodeVar)}\\.tapestryKey\\s*=\\s*${esc(rowVar)}\\.(\\w+)$`)))) { keyField = w[1]; continue; }
    if (new RegExp(`^NOT\\s+${esc(nodeVar)}\\s*:\\s*GraphChange$`).test(part.trim())) { skipEntries = true; continue; }
    throw cantRun(`a WHERE it can't read in a write of copies (${part.trim()})`, q);
  }
  if (!keyField) throw cantRun(`a write of copies that doesn't find ${nodeVar} by tapestryKey`, q);
  let countAlias = null;
  if (returnText) {
    const rm = returnText.trim().match(new RegExp(`^count\\s*\\(\\s*(\\*|${esc(nodeVar)})\\s*\\)(?:\\s+AS\\s+([A-Za-z_]\\w*))?$`, 'i'));
    if (!rm) throw cantRun(`a RETURN after a write of copies that isn't count(${nodeVar}) (${returnText.trim()})`, q);
    countAlias = rm[2] || `count(${rm[1]})`;
  }
  const rows = params[listParam];
  if (!Array.isArray(rows)) throw new Error(`UNWIND expects a list in $${listParam}; got ${rows === null ? 'null' : typeof rows}`);
  const byKey = new Map();
  for (const n of s.nodes) if (typeof n.props.tapestryKey === 'string') { if (!byKey.has(n.props.tapestryKey)) byKey.set(n.props.tapestryKey, []); byKey.get(n.props.tapestryKey).push(n); }
  let matched = 0, propertiesSet = 0;
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Type mismatch: each of $${listParam} must be a map; got ${JSON.stringify(row)}`);
    const found = (byKey.get(row[keyField]) || []).filter((n) => labels.every((l) => n.labels.includes(l)) && !(skipEntries && n.labels.includes('GraphChange')));
    for (const n of found) {
      const props = row[propsField];
      if (!props || typeof props !== 'object' || Array.isArray(props)) throw new Error(`Type mismatch: SET ${nodeVar} += needs a map; ${rowVar}.${propsField} is ${JSON.stringify(props)}`);
      matched++;
      for (const [k, v] of Object.entries(props)) {
        if (v === null || v === undefined) { if (Object.prototype.hasOwnProperty.call(n.props, k)) { delete n.props[k]; propertiesSet++; } continue; }
        n.props[k] = storable(v, k);
        propertiesSet++;
      }
    }
  }
  return { rows: countAlias ? [{ [countAlias]: matched }] : [], counters: { ...zero(), propertiesSet } };
}

// ── ADR graph-operations-first-slice/0016 ──
// Labels as a pattern names them: `:A:B`, each of which may be alternatives, `:A|B` (ADR 0003 Decision 9).
const LABELS_TEXT = '((?::\\s*[A-Za-z_]\\w*(?:\\s*\\|\\s*[A-Za-z_]\\w*)*\\s*)*)';
const labelsIn = (text) => (text || '').split(':').map((x) => x.trim()).filter(Boolean).map((alts) => alts.split('|').map((l) => l.trim()));
const hasLabels = (n, groups) => groups.every((alts) => alts.some((l) => n.labels.includes(l)));

/** C1: MATCH (n:NostrEvent|TapestryNode {uuid: $p}) SET n.<lock> = true REMOVE n.<lock> RETURN n.tapestryKey AS a. */
function lockNode(s, q, params) {
  const one = oneLine(q);
  const m = one.match(new RegExp(`^MATCH\\s*\\(\\s*(\\w+)\\s*${LABELS_TEXT}\\{\\s*uuid\\s*:\\s*\\$(\\w+)\\s*\\}\\s*\\)\\s*SET\\s+(\\w+)\\.(\\w+)\\s*=\\s*true\\s+REMOVE\\s+(\\w+)\\.(\\w+)\\s+RETURN\\s+(\\w+)\\.tapestryKey\\s+AS\\s+(\\w+)\\s*;?$`, 'i'));
  if (!m) throw cantRun("a lock it can't read (C1 is MATCH (n:NostrEvent|TapestryNode {uuid: $uuid}) SET n.tapestryLock = true REMOVE n.tapestryLock RETURN n.tapestryKey AS key)", q);
  const [, v, labelText, param, setVar, prop, removeVar, removeProp, returnVar, alias] = m;
  if (setVar !== v || removeVar !== v || returnVar !== v || removeProp !== prop) throw cantRun(`a lock that sets and removes something other than one property of ${v}`, q);
  const labels = labelsIn(labelText);
  const found = s.nodes.filter((n) => n.props.uuid === params[param] && hasLabels(n, labels));
  return { rows: found.map((n) => ({ [alias]: n.props.tapestryKey === undefined ? null : n.props.tapestryKey })), counters: { ...zero(), propertiesSet: found.length * 2 } };
}

/**
 * C6: MATCH (n… {tapestryKey: $p}) UNWIND $tags AS t CREATE (n)-[:HAS_TAG]->(tn:NostrEventTag {…: t.…})
 * [SET tn.x = t.x, …] [keyNode('tn')] [RETURN count(tn) AS a].
 */
function createTags(s, query, params) {
  let one = oneLine(query);
  const made = one.match(/\bCREATE\s*\(\s*\w+\s*\)\s*-\s*\[\s*:\s*HAS_TAG\s*\]\s*->\s*\(\s*(\w+)/);
  let keyed = false;
  if (made) {
    const fragment = oneLine(keyNode(made[1]));
    if (one.includes(fragment)) { one = one.replace(fragment, ' ').replace(/\s+/g, ' ').trim(); keyed = true; }
  }
  const m = one.match(new RegExp(`^MATCH\\s*\\(\\s*(\\w+)\\s*${LABELS_TEXT}\\{\\s*tapestryKey\\s*:\\s*\\$(\\w+)\\s*\\}\\s*\\)\\s*UNWIND\\s+\\$(\\w+)\\s+AS\\s+(\\w+)\\s+CREATE\\s*\\(\\s*(\\w+)\\s*\\)\\s*-\\s*\\[\\s*:\\s*HAS_TAG\\s*\\]\\s*->\\s*\\(\\s*(\\w+)\\s*:\\s*NostrEventTag\\s*(\\{[^}]*\\})\\s*\\)\\s*(?:SET\\s+(.*?))?\\s*(?:RETURN\\s+count\\s*\\(\\s*(\\w+)\\s*\\)\\s+AS\\s+(\\w+))?\\s*;?$`, 'i'));
  if (!m) throw cantRun("a CREATE of tags it can't read (C6 is MATCH (n:TapestryNode {tapestryKey: $key}) UNWIND $tags AS t CREATE (n)-[:HAS_TAG]->(tn:NostrEventTag {uuid: t.uuid, type: t.type, value: t.value}) SET tn.value1 = t.value1, tn.value2 = t.value2)", query);
  const [, nv, labelText, keyParam, listParam, rowVar, fromVar, tagVar, mapText, setText, countVar, countAlias] = m;
  if (fromVar !== nv) throw cantRun(`a CREATE of tags from ${fromVar}, not the node the MATCH found (${nv})`, query);
  if (countVar && countVar !== tagVar) throw cantRun(`a RETURN after a CREATE of tags that counts ${countVar}, not ${tagVar}`, query);
  const fromRow = (expr) => {
    const e = expr.trim();
    const rm = e.match(new RegExp(`^${esc(rowVar)}\\.(\\w+)$`));
    if (rm) return (row) => (row[rm[1]] === undefined ? null : row[rm[1]]);
    const val = valueOf(e, params, query);
    return () => val;
  };
  const mapped = mapEntries(mapText, query).map(([k, e]) => [k, fromRow(e)]);
  const sets = setText ? splitTop(setText).map((a) => {
    const am = a.match(new RegExp(`^${esc(tagVar)}\\.([A-Za-z_]\\w*)\\s*=\\s*([\\s\\S]+)$`));
    if (!am) throw cantRun(`a SET it can't read in a CREATE of tags (${a})`, query);
    return [am[1], fromRow(am[2])];
  }) : [];
  const rows = params[listParam];
  if (!Array.isArray(rows)) throw new Error(`UNWIND expects a list in $${listParam}; got ${rows === null ? 'null' : typeof rows}`);
  const node = s.nodes.find((n) => n.props.tapestryKey === params[keyParam] && hasLabels(n, labelsIn(labelText)) && !n.labels.includes('GraphChange'));
  const counters = zero();
  if (!node) return { rows: countAlias ? [{ [countAlias]: 0 }] : [], counters };
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Type mismatch: each of $${listParam} must be a map; got ${JSON.stringify(row)}`);
    const props = {};
    for (const [k, f] of [...mapped, ...sets]) {
      const v = f(row);
      if (v === null || v === undefined) { delete props[k]; continue; }
      props[k] = storable(v, k);
      counters.propertiesSet++;
    }
    const labels = ['NostrEventTag'];
    if (keyed) { labels.push('TapestryNode'); props.tapestryKey = crypto.randomUUID(); counters.propertiesSet++; }
    const tag = { eid: s.nextEid++, labels, props };
    s.nodes.push(tag);
    s.rels.push({ eid: s.nextEid++, type: 'HAS_TAG', from: node.eid, to: tag.eid, props: {} });
    counters.nodesCreated++;
    counters.relationshipsCreated++;
    counters.labelsAdded += labels.length;
  }
  return { rows: countAlias ? [{ [countAlias]: rows.length }] : [], counters };
}

/** C11: MATCH (t:NostrEventTag… {tapestryKey: $p}) DETACH DELETE t, for a tag node only. */
function deleteTag(s, q, params) {
  const m = oneLine(q).match(new RegExp(`^MATCH\\s*\\(\\s*(\\w+)\\s*${LABELS_TEXT}\\{\\s*tapestryKey\\s*:\\s*\\$(\\w+)\\s*\\}\\s*\\)\\s*DETACH\\s+DELETE\\s+(\\w+)\\s*;?$`, 'i'));
  if (!m || m[4] !== m[1]) throw cantRun("a DETACH DELETE it can't read (C11 is MATCH (t:NostrEventTag:TapestryNode {tapestryKey: $key}) DETACH DELETE t)", q);
  const labels = labelsIn(m[2]);
  if (!labels.some((alts) => alts.length === 1 && alts[0] === 'NostrEventTag')) throw cantRun('a DETACH DELETE of something other than a tag node (C11 names :NostrEventTag)', q);
  const gone = s.nodes.filter((n) => n.props.tapestryKey === params[m[3]] && hasLabels(n, labels));
  const eids = new Set(gone.map((n) => n.eid));
  const rels = s.rels.filter((r) => eids.has(r.from) || eids.has(r.to));
  s.nodes = s.nodes.filter((n) => !eids.has(n.eid));
  s.rels = s.rels.filter((r) => !rels.includes(r));
  return { rows: [], counters: { ...zero(), nodesDeleted: gone.length, relationshipsDeleted: rels.length } };
}

/** Run one statement over state `s` (changed in place); { rows, counters }. */
function exec(s, cypher, params = {}, { write = false } = {}) {
  const q = String(cypher);
  const bare = stripStrings(q);
  const writes = WRITES.test(bare);
  const hasRel = HAS_RELATIONSHIP.test(bare);
  if (!writes && !hasRel) return { rows: readOneNode(s, q, params), counters: zero() };
  if (!writes && isDeclaredTypesRead(bare)) return { rows: readDeclared(s, q, params), counters: zero() };
  if (!writes && isOneHopFromKey(bare)) return { rows: runPathQuery(s, q, params, { types: null }), counters: zero() };
  if (!writes) return { rows: runPathQuery(s, q, params, { types: PATH_READ_TYPES }), counters: zero() };
  if (writes && !write) throw new Error(`a read must write nothing; it sent: ${oneLine(q).slice(0, 300)}`);
  if (/\bCREATE\s*\(\s*\w+\s*:\s*[A-Za-z_:\s]*\bGraphChange\b/.test(bare)) return createEntry(s, q, params);
  if (/\bMERGE\s*\(\s*\w+\s*\)\s*-\s*\[/.test(bare)) return mergeRel(s, q, params);
  if (/\bDETACH\s+DELETE\b/.test(bare) && !hasRel) return deleteTag(s, q, params);
  if (/\bDELETE\b/.test(bare) && hasRel) return deleteRel(s, q, params);
  if (/^\s*UNWIND\b/i.test(bare) && /\bSET\s+\w+\s*\+=/.test(bare) && !hasRel) return writeCopies(s, q, params);
  if (/\bUNWIND\b/.test(bare) && /\bCREATE\b/.test(bare) && /\bHAS_TAG\b/.test(bare)) return createTags(s, q, params);
  if (/\bCREATE\s*\(\s*\w+\s*:/.test(bare) && !hasRel) return createEntry(s, q, params);
  if (/\bSET\b/.test(bare) && /\bREMOVE\b/.test(bare) && !hasRel) return lockNode(s, q, params);
  throw cantRun('not one of the statements it runs', q);
}

const KIND = (q) => {
  const b = stripStrings(String(q));
  if (/^\s*UNWIND\b/i.test(b) && /\bSET\b/.test(b)) return 'copies';
  if (/\bUNWIND\b/.test(b) && /\bHAS_TAG\b/.test(b) && /\bCREATE\b/.test(b)) return 'tags';
  if (/\bDETACH\s+DELETE\b/.test(b)) return 'detach';
  if (/\bSET\b/.test(b) && /\bREMOVE\b/.test(b) && !/\bCREATE\b/.test(b)) return 'lock';
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

module.exports = { fakeGraph, readerOver, emptyState, readState, writeState, exec, PATH_READ_TYPES };
