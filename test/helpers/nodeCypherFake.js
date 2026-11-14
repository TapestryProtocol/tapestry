'use strict';
/**
 * A fake graph database for stack-free tests of reads over single nodes: it runs the Cypher it is given over a list of
 * nodes held in memory, as Neo4j would, so a test can say what a read must find without pinning the text of the query.
 * Story graph-operations-foundation #7 (the cache counts) is its first user.
 *
 * It reads one MATCH of one node, `(v)`, `(v:A)`, `(v:A|B)` or `(v:A:B)`, each with or without a property map
 * `{p: <expression>, …}` (read as WHERE v.p = <expression> AND …; graph-operations-foundation #4), then any number of WHERE and WITH clauses, and
 * a RETURN, each WITH or RETURN with its own ORDER BY, SKIP and LIMIT. Expressions:
 *   - literals: strings, numbers, true, false, null, lists `[...]`; parameters `$name`
 *   - `v.prop`, a label test `v:A` or `v:A|B`, an alias from a WITH
 *   - `=`, `<>`, `<`, `>`, `<=`, `>=`, `IS NULL`, `IS NOT NULL`, `IN`, `STARTS WITH`, `ENDS WITH`, `CONTAINS`
 *   - `NOT`, `AND`, `XOR`, `OR`, with Cypher's precedence (OR binds loosest, then XOR, AND, NOT, then comparisons) and
 *     its three-valued logic: a comparison with null is null, and WHERE keeps a row only when its test is true
 *   - `CASE WHEN … THEN … [ELSE …] END`, `coalesce`, `size`, `toString`, `trim`
 *   - aggregates `count(x)`, `count(*)`, `count(DISTINCT x)`, `collect(x)`, `sum(x)`, grouped by the other items
 * Anything else (a relationship, a second MATCH, OPTIONAL MATCH, UNWIND, CALL, UNION, a write) throws "the fake graph
 * database can't read this Cypher", naming what it met, so a test that fails on the fake's limits says so.
 *
 * A node is { labels: [..], props: { .. } }; a missing property reads as null. A node returned whole comes back as
 * { labels, properties }.
 */

const KEYWORDS = new Set(['MATCH', 'OPTIONAL', 'WHERE', 'WITH', 'RETURN', 'ORDER', 'BY', 'SKIP', 'LIMIT', 'AS', 'DISTINCT',
  'ASC', 'ASCENDING', 'DESC', 'DESCENDING', 'AND', 'OR', 'XOR', 'NOT', 'IS', 'NULL', 'IN', 'TRUE', 'FALSE', 'CASE', 'WHEN',
  'THEN', 'ELSE', 'END', 'STARTS', 'ENDS', 'CONTAINS', 'UNION', 'CALL', 'UNWIND', 'MERGE', 'CREATE', 'SET', 'DELETE',
  'DETACH', 'REMOVE', 'FOREACH', 'YIELD', 'LOAD', 'USE', 'SHOW', 'EXPLAIN', 'PROFILE']);
const AGGREGATES = new Set(['count', 'collect', 'sum']);

function cantRead(why, q) {
  return new Error(`the fake graph database can't read this Cypher (${why}); it reads one MATCH of one node, then WHERE, WITH, RETURN, ORDER BY, SKIP and LIMIT (test/helpers/nodeCypherFake.js): ${String(q).replace(/\s+/g, ' ').trim()}`);
}

function tokenize(q) {
  const toks = [];
  let i = 0;
  while (i < q.length) {
    const c = q[i];
    if (/\s/.test(c) || c === ';') { i++; continue; }
    if (c === '/' && q[i + 1] === '/') { while (i < q.length && q[i] !== '\n') i++; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1, s = '';
      while (j < q.length && q[j] !== c) { if (q[j] === '\\') { s += q[j + 1]; j += 2; } else { s += q[j]; j++; } }
      if (j >= q.length) throw cantRead('a string with no end', q);
      toks.push({ t: 'str', v: s }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c)) { let j = i; while (j < q.length && /[0-9.]/.test(q[j])) j++; toks.push({ t: 'num', v: Number(q.slice(i, j)) }); i = j; continue; }
    if (c === '$') { let j = i + 1; while (j < q.length && /\w/.test(q[j])) j++; toks.push({ t: 'param', v: q.slice(i + 1, j) }); i = j; continue; }
    if (c === '`') { const j = q.indexOf('`', i + 1); if (j < 0) throw cantRead('a quoted name with no end', q); toks.push({ t: 'id', v: q.slice(i + 1, j) }); i = j + 1; continue; }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < q.length && /\w/.test(q[j])) j++;
      const w = q.slice(i, j);
      toks.push(KEYWORDS.has(w.toUpperCase()) ? { t: 'kw', v: w.toUpperCase() } : { t: 'id', v: w });
      i = j; continue;
    }
    const two = q.slice(i, i + 2);
    if (['<>', '<=', '>=', '=~'].includes(two)) { toks.push({ t: 'op', v: two }); i += 2; continue; }
    if ('()[]{},.:|=<>*-+'.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    throw cantRead(`the character ${c}`, q);
  }
  return toks;
}

function parse(q) {
  const toks = tokenize(q);
  let p = 0;
  const peek = (o = 0) => toks[p + o];
  const isKw = (v, o = 0) => !!peek(o) && peek(o).t === 'kw' && peek(o).v === v;
  const isOp = (v, o = 0) => !!peek(o) && peek(o).t === 'op' && peek(o).v === v;
  const take = () => toks[p++];
  const kw = (v) => { if (!isKw(v)) throw cantRead(`expected ${v}, met ${peek() ? peek().v : 'the end'}`, q); return take(); };
  const op = (v) => { if (!isOp(v)) throw cantRead(`expected ${v}, met ${peek() ? peek().v : 'the end'}`, q); return take(); };
  const name = () => { const t = take(); if (!t || t.t !== 'id') throw cantRead(`expected a name, met ${t ? t.v : 'the end'}`, q); return t.v; };
  const labelAlternatives = () => { const alts = [name()]; while (isOp('|')) { take(); alts.push(name()); } return alts; };

  // ── expressions ──
  function expr() { return or(); }
  function or() { let l = xor(); while (isKw('OR')) { take(); l = { k: 'or', l, r: xor() }; } return l; }
  function xor() { let l = and(); while (isKw('XOR')) { take(); l = { k: 'xor', l, r: and() }; } return l; }
  function and() { let l = not(); while (isKw('AND')) { take(); l = { k: 'and', l, r: not() }; } return l; }
  function not() { if (isKw('NOT')) { take(); return { k: 'not', e: not() }; } return cmp(); }
  function cmp() {
    let l = atom();
    for (;;) {
      if (isOp('=') || isOp('<>') || isOp('<') || isOp('>') || isOp('<=') || isOp('>=')) { const o = take().v; l = { k: 'cmp', o, l, r: atom() }; continue; }
      if (isOp('=~')) throw cantRead('a regular expression (=~)', q);
      if (isKw('IS')) { take(); const neg = isKw('NOT') ? (take(), true) : false; kw('NULL'); l = { k: 'isnull', e: l, neg }; continue; }
      if (isKw('IN')) { take(); l = { k: 'in', l, r: atom() }; continue; }
      if (isKw('STARTS') || isKw('ENDS')) { const o = take().v; kw('WITH'); l = { k: 'str', o, l, r: atom() }; continue; }
      if (isKw('CONTAINS')) { take(); l = { k: 'str', o: 'CONTAINS', l, r: atom() }; continue; }
      if (isOp('+') || isOp('-') || isOp('*')) throw cantRead(`arithmetic (${peek().v})`, q);
      return l;
    }
  }
  function atom() {
    const t = peek();
    if (!t) throw cantRead('an expression cut short', q);
    if (t.t === 'str' || t.t === 'num') { take(); return { k: 'lit', v: t.v }; }
    if (t.t === 'param') { take(); return { k: 'param', v: t.v }; }
    if (isKw('TRUE')) { take(); return { k: 'lit', v: true }; }
    if (isKw('FALSE')) { take(); return { k: 'lit', v: false }; }
    if (isKw('NULL')) { take(); return { k: 'lit', v: null }; }
    if (isOp('(')) { take(); const e = expr(); op(')'); return e; }
    if (isOp('[')) {
      take(); const items = [];
      if (!isOp(']')) { items.push(expr()); while (isOp(',')) { take(); items.push(expr()); } }
      op(']'); return { k: 'list', items };
    }
    if (isKw('CASE')) {
      take();
      if (!isKw('WHEN')) throw cantRead('a CASE with a value (only CASE WHEN … is read)', q);
      const whens = [];
      while (isKw('WHEN')) { take(); const c = expr(); kw('THEN'); whens.push({ c, v: expr() }); }
      let otherwise = { k: 'lit', v: null };
      if (isKw('ELSE')) { take(); otherwise = expr(); }
      kw('END');
      return { k: 'case', whens, otherwise };
    }
    if (t.t === 'id' && isOp('(', 1)) {
      const fn = take().v.toLowerCase(); take();
      if (fn === 'count' && isOp('*')) { take(); op(')'); return { k: 'agg', fn: 'count', star: true }; }
      const distinct = isKw('DISTINCT') ? (take(), true) : false;
      const args = [];
      if (!isOp(')')) { args.push(expr()); while (isOp(',')) { take(); args.push(expr()); } }
      op(')');
      if (AGGREGATES.has(fn)) { if (args.length !== 1) throw cantRead(`${fn} with ${args.length} arguments`, q); return { k: 'agg', fn, distinct, e: args[0] }; }
      if (distinct) throw cantRead(`DISTINCT in ${fn}()`, q);
      if (!['coalesce', 'size', 'tostring', 'trim'].includes(fn)) throw cantRead(`the function ${fn}()`, q);
      return { k: 'fn', fn, args };
    }
    if (t.t === 'id') {
      const v = take().v;
      if (isOp('.')) { take(); return { k: 'prop', v, p: name() }; }
      if (isOp(':')) { const sets = []; while (isOp(':')) { take(); sets.push(labelAlternatives()); } return { k: 'labels', v, sets }; }
      return { k: 'var', v };
    }
    if (t.t === 'kw' && ['OPTIONAL', 'MATCH', 'UNWIND', 'CALL', 'UNION', 'MERGE', 'CREATE', 'SET', 'DELETE', 'DETACH', 'REMOVE', 'FOREACH'].includes(t.v)) throw cantRead(`a ${t.v} clause`, q);
    throw cantRead(`${t.v} where an expression should be`, q);
  }

  function items() {
    const distinct = isKw('DISTINCT') ? (take(), true) : false;
    const list = [];
    do {
      if (list.length) take();
      const e = expr();
      let alias;
      if (isKw('AS')) { take(); alias = name(); } else if (e.k === 'var') alias = e.v; else if (e.k === 'prop') alias = `${e.v}.${e.p}`;
      else throw cantRead('a WITH or RETURN item with no AS', q);
      list.push({ e, alias });
    } while (isOp(','));
    const order = [];
    if (isKw('ORDER')) {
      take(); kw('BY');
      do {
        if (order.length) take();
        const e = expr();
        let desc = false;
        if (isKw('DESC') || isKw('DESCENDING')) { take(); desc = true; } else if (isKw('ASC') || isKw('ASCENDING')) take();
        order.push({ e, desc });
      } while (isOp(','));
    }
    const skip = isKw('SKIP') ? (take(), atom()) : null;
    const limit = isKw('LIMIT') ? (take(), atom()) : null;
    return { distinct, list, order, skip, limit };
  }

  // ── the query ──
  if (isKw('OPTIONAL')) throw cantRead('an OPTIONAL MATCH', q);
  kw('MATCH'); op('(');
  const v = name();
  const sets = [];
  while (isOp(':')) { take(); sets.push(labelAlternatives()); }
  // A property map, (v:A {p: $x, q: 'y'}), reads as WHERE v.p = $x AND v.q = 'y' (graph-operations-foundation #4).
  const mapped = [];
  if (isOp('{')) {
    take();
    if (!isOp('}')) {
      do {
        if (mapped.length) take();
        const p = name();
        op(':');
        mapped.push({ k: 'where', e: { k: 'cmp', o: '=', l: { k: 'prop', v, p }, r: expr() } });
      } while (isOp(','));
    }
    op('}');
  }
  op(')');
  if (isOp(',') || isOp('-') || isOp('<')) throw cantRead('a pattern of more than one node, or a relationship', q);
  const stages = [...mapped];
  let ret = null;
  while (p < toks.length) {
    if (isKw('WHERE')) { take(); stages.push({ k: 'where', e: expr() }); continue; }
    if (isKw('WITH')) { take(); stages.push({ k: 'with', ...items() }); continue; }
    if (isKw('RETURN')) { take(); ret = items(); break; }
    throw cantRead(`a ${peek().v} clause`, q);
  }
  if (!ret) throw cantRead('no RETURN', q);
  if (p < toks.length) throw cantRead(`${peek().v} after the RETURN`, q);
  return { v, sets, stages, ret };
}

// ── evaluation, with Cypher's three-valued logic ──
const isNode = (x) => !!x && typeof x === 'object' && Array.isArray(x.labels) && x.props && typeof x.props === 'object';
const hasLabels = (node, sets) => sets.every((alts) => alts.some((l) => node.labels.includes(l)));
const cmpValues = (o, a, b) => {
  if (a === null || b === null || a === undefined || b === undefined) return null;
  if (o === '=') return a === b;
  if (o === '<>') return a !== b;
  if (typeof a !== typeof b || (typeof a !== 'string' && typeof a !== 'number')) return null;
  return o === '<' ? a < b : o === '>' ? a > b : o === '<=' ? a <= b : a >= b;
};
const order = (a, b) => (a === b ? 0 : a === null || a === undefined ? 1 : b === null || b === undefined ? -1 : a < b ? -1 : 1);

function evaluate(e, env, params, q) {
  const ev = (x) => evaluate(x, env, params, q);
  switch (e.k) {
    case 'lit': return e.v;
    case 'param': if (!(e.v in params)) throw new Error(`Expected parameter(s): ${e.v}`); return params[e.v] === undefined ? null : params[e.v];
    case 'list': return e.items.map(ev);
    case 'var': if (!(e.v in env)) throw new Error(`Variable \`${e.v}\` not defined`); return env[e.v];
    case 'prop': {
      if (!(e.v in env)) throw new Error(`Variable \`${e.v}\` not defined`);
      const x = env[e.v];
      if (x === null || x === undefined) return null;
      const val = isNode(x) ? x.props[e.p] : x[e.p];
      return val === undefined ? null : val;
    }
    case 'labels': { const x = env[e.v]; return x === null || x === undefined ? null : hasLabels(x, e.sets); }
    case 'cmp': return cmpValues(e.o, ev(e.l), ev(e.r));
    case 'isnull': { const x = ev(e.e); const n = x === null || x === undefined; return e.neg ? !n : n; }
    case 'in': {
      const x = ev(e.l), list = ev(e.r);
      if (list === null) return null;
      if (!Array.isArray(list)) throw cantRead('IN with something that is not a list', q);
      if (x === null) return list.length ? null : false;
      if (list.some((y) => y === x)) return true;
      return list.some((y) => y === null) ? null : false;
    }
    case 'str': {
      const a = ev(e.l), b = ev(e.r);
      if (typeof a !== 'string' || typeof b !== 'string') return null;
      return e.o === 'STARTS' ? a.startsWith(b) : e.o === 'ENDS' ? a.endsWith(b) : a.includes(b);
    }
    case 'not': { const x = ev(e.e); return x === null ? null : !x; }
    case 'and': { const a = ev(e.l), b = ev(e.r); if (a === false || b === false) return false; if (a === null || b === null) return null; return true; }
    case 'or': { const a = ev(e.l), b = ev(e.r); if (a === true || b === true) return true; if (a === null || b === null) return null; return false; }
    case 'xor': { const a = ev(e.l), b = ev(e.r); if (a === null || b === null) return null; return a !== b; }
    case 'case': { for (const w of e.whens) if (ev(w.c) === true) return ev(w.v); return ev(e.otherwise); }
    case 'fn': {
      const args = e.args.map(ev);
      if (e.fn === 'coalesce') { const x = args.find((y) => y !== null && y !== undefined); return x === undefined ? null : x; }
      const x = args[0];
      if (x === null || x === undefined) return null;
      if (e.fn === 'size') return x.length;
      if (e.fn === 'tostring') return String(x);
      return String(x).trim();
    }
    case 'agg': throw cantRead('an aggregate inside another expression', q);
    default: throw cantRead(`an expression it can't read (${e.k})`, q);
  }
}

const hasAgg = (e) => !!e && typeof e === 'object' && (e.k === 'agg' || Object.values(e).some((x) => (Array.isArray(x) ? x.some(hasAgg) : x && typeof x === 'object' && hasAgg(x))));

function aggregate(item, rows, params, q) {
  const e = item.e;
  if (e.k !== 'agg') throw cantRead('an aggregate inside another expression', q);
  if (e.star) return rows.length;
  let vals = rows.map((env) => evaluate(e.e, env, params, q)).filter((x) => x !== null && x !== undefined);
  if (e.distinct) vals = [...new Map(vals.map((x) => [JSON.stringify(x), x])).values()];
  if (e.fn === 'count') return vals.length;
  if (e.fn === 'collect') return vals;
  return vals.reduce((n, x) => n + (typeof x === 'number' ? x : 0), 0);
}

function project(stage, rows, params, q) {
  const grouped = stage.list.some((it) => hasAgg(it.e));
  let out; // [{ env: projected, source: env before projection or null }]
  if (!grouped) {
    out = rows.map((env) => {
      const next = {};
      for (const it of stage.list) next[it.alias] = evaluate(it.e, env, params, q);
      return { env: next, source: env };
    });
  } else {
    const keys = stage.list.filter((it) => !hasAgg(it.e));
    const groups = new Map();
    for (const env of rows) {
      const kv = keys.map((it) => evaluate(it.e, env, params, q));
      const id = JSON.stringify(kv.map((x) => (isNode(x) ? x.id : x)));
      if (!groups.has(id)) groups.set(id, { kv, rows: [] });
      groups.get(id).rows.push(env);
    }
    if (!groups.size && !keys.length) groups.set('[]', { kv: [], rows: [] });
    out = [...groups.values()].map((g) => {
      const next = {};
      let i = 0;
      for (const it of stage.list) next[it.alias] = hasAgg(it.e) ? aggregate(it, g.rows, params, q) : g.kv[i++];
      return { env: next, source: null };
    });
  }
  if (stage.distinct) {
    const seen = new Set();
    out = out.filter((r) => { const id = JSON.stringify(Object.values(r.env).map((x) => (isNode(x) ? x.id : x))); if (seen.has(id)) return false; seen.add(id); return true; });
  }
  if (stage.order.length) {
    const keyed = out.map((r) => ({ r, ks: stage.order.map((o) => evaluate(o.e, r.source ? { ...r.source, ...r.env } : r.env, params, q)) }));
    keyed.sort((a, b) => { for (let i = 0; i < stage.order.length; i++) { const c = order(a.ks[i], b.ks[i]); if (c) return stage.order[i].desc ? -c : c; } return 0; });
    out = keyed.map((x) => x.r);
  }
  const num = (x) => { const n = evaluate(x, {}, params, q); if (typeof n !== 'number' || n < 0) throw cantRead('a SKIP or LIMIT that is not a number', q); return n; };
  if (stage.skip) out = out.slice(num(stage.skip));
  if (stage.limit) out = out.slice(0, num(stage.limit));
  return out.map((r) => r.env);
}

/** Run `cypher` over `nodes` with `params`; rows of plain values, a node as { labels, properties }. */
function runQuery(nodes, cypher, params = {}) {
  const q = String(cypher);
  const plan = parse(q);
  nodes.forEach((n, i) => { if (n.id === undefined) Object.defineProperty(n, 'id', { value: i, enumerable: false }); });
  let rows = nodes.filter((n) => hasLabels(n, plan.sets)).map((n) => ({ [plan.v]: n }));
  for (const st of plan.stages) {
    if (st.k === 'where') rows = rows.filter((env) => evaluate(st.e, env, params, q) === true);
    else rows = project(st, rows, params, q);
  }
  const out = project(plan.ret, rows, params, q);
  const plain = (x) => (isNode(x) ? { labels: [...x.labels], properties: { ...x.props } } : Array.isArray(x) ? x.map(plain) : x);
  return out.map((r) => Object.fromEntries(Object.entries(r).map(([k, x]) => [k, plain(x)])));
}

/**
 * The exports of src/lib/neo4j-driver.js over `nodes`, for a child process to put in require.cache. Every query and
 * every row it returns go in `log` ({ queries: [], rows: [] }). Writes and direct use of the driver throw: the reads
 * these tests cover write nothing.
 */
function driverStub(nodes, log = { queries: [], rows: [] }) {
  const read = (cypher, params) => {
    log.queries.push(String(cypher));
    const rows = runQuery(nodes, cypher, params || {});
    for (const r of rows) log.rows.push(r);
    return rows;
  };
  return {
    runCypher: async (cypher, params) => read(cypher, params),
    streamCypher: async (cypher, params, onRecord) => { for (const r of read(cypher, params)) onRecord(r); },
    writeCypher: async (cypher) => { throw new Error(`a read must write nothing; it sent writeCypher: ${String(cypher).replace(/\s+/g, ' ').trim()}`); },
    explainCypher: async () => { throw new Error('the fake graph database plans nothing (explainCypher)'); },
    getDriver: () => { throw new Error('the fake graph database has no driver; use runCypher or streamCypher'); },
    closeDriver: async () => {},
    toJS: (x) => x,
  };
}

module.exports = { runQuery, driverStub };
