'use strict';
/**
 * Reads over paths, for test/helpers/graphFake.js: the reads ADR graph-operations-foundation/0005 adds (its
 * Implementation notes, S1–S4: the concept, the property node, the marks and the elements). Story
 * graph-operations-foundation #5 is its first user.
 *
 * runPathQuery(state, cypher, params, { types }) runs one read over the fake graph's state ({ nodes, rels }) as Neo4j
 * would, within this subset of Cypher, and answers its rows as src/lib/neo4j-driver.js's toJS gives them:
 *
 *   clauses   MATCH, OPTIONAL MATCH (each with its WHERE), WITH [DISTINCT] … [WHERE], RETURN [DISTINCT], each WITH or
 *             RETURN with ORDER BY, SKIP and LIMIT
 *   patterns  one or more paths, comma-separated: (v:A|B:C {p: <expression>}), joined by -[r:T|U]-> or <-[r:T]-, a
 *             relationship of one length or variable (*, *2, *0.., *1..3). A relationship names its type, and only the
 *             types in `types` (the caller's repertoire); a relationship isn't matched twice in one MATCH
 *   expressions  literals, $params, lists, v.prop, v[expr], v:Label tests, =, <>, <, >, <=, >=, IS [NOT] NULL, IN,
 *             STARTS WITH, ENDS WITH, CONTAINS, NOT/AND/XOR/OR with Cypher's three-valued logic, CASE WHEN, list
 *             comprehensions [x IN list WHERE … | …], and the functions keys, head, size, coalesce, toString, toLower, labels,
 *             type; the aggregates count (with *, DISTINCT) and collect (with DISTINCT), also inside head(…)
 *
 * As Neo4j does, it refuses a SKIP or LIMIT given as a parameter that holds a JavaScript number: the driver sends one
 * as a float (story 4's deviation on LIMIT), so the checked number goes into the text, as history's does. A whole node
 * comes back as { ...properties, _labels }, without _id; a relationship as { ...properties, _type }. A property the
 * fake stores as an integer, { $int: '<digits>' } (what a neo4j.int written by graphFake.js's S8 becomes), reads as a
 * JavaScript number, as toJS converts a neo4j Integer.
 *
 * Anything else (UNWIND, CALL, UNION, a write, a path variable, an undirected relationship, a relationship with no
 * type, arithmetic, a map literal, another function) throws "the fake graph can't run this Cypher", naming what it
 * met, so a test that fails on the fake's limits says so.
 *
 * Story graph-operations-first-slice #13 (ADR graph-operations-first-slice/0013) adds the relationship reads:
 *   - `types: null` lifts the repertoire. A relationship may then name any type, or none, and one with no type
 *     matches every type. test/helpers/graphFake.js passes it for ADR 0013's one-hop reads only.
 *   - elementId(x) of a node or a relationship: text in Neo4j 5's form, `5:<database id>:<n>`, fixed for its life.
 *   - properties(x) of a node or a relationship: its map, with an integer left as the driver leaves one inside a map
 *     ({ $int: '<digits>' } here, a neo4j Integer there), since toJS converts a list's items but returns a map as it is.
 */

const KEYWORDS = new Set(['MATCH', 'OPTIONAL', 'WHERE', 'WITH', 'RETURN', 'ORDER', 'BY', 'SKIP', 'LIMIT', 'AS', 'DISTINCT',
  'ASC', 'ASCENDING', 'DESC', 'DESCENDING', 'AND', 'OR', 'XOR', 'NOT', 'IS', 'NULL', 'IN', 'TRUE', 'FALSE', 'CASE', 'WHEN',
  'THEN', 'ELSE', 'END', 'STARTS', 'ENDS', 'CONTAINS', 'UNION', 'CALL', 'UNWIND', 'MERGE', 'CREATE', 'SET', 'DELETE',
  'DETACH', 'REMOVE', 'FOREACH', 'YIELD', 'LOAD', 'USE', 'SHOW', 'EXPLAIN', 'PROFILE', 'ON']);
const CLAUSE_WORDS = ['UNION', 'CALL', 'UNWIND', 'MERGE', 'CREATE', 'SET', 'DELETE', 'DETACH', 'REMOVE', 'FOREACH', 'YIELD', 'LOAD', 'USE', 'SHOW', 'EXPLAIN', 'PROFILE'];
const AGGREGATES = new Set(['count', 'collect']);
const FUNCTIONS = new Set(['keys', 'head', 'size', 'coalesce', 'tostring', 'tolower', 'labels', 'type', 'elementid', 'properties']);
/** The database id in the fake's elementIds (ADR 0013, Context 8: Neo4j 5's form is 5:<database id>:<n>). */
const FAKE_DATABASE_ID = '00000000-0000-4000-8000-00000000fa4e';

const oneLine = (q) => String(q).replace(/\s+/g, ' ').trim();
function cantRun(why, q) {
  return new Error(`the fake graph can't run this Cypher (${why}); it runs ADR graph-operations-foundation/0004's and 0005's statements only (test/helpers/graphFake.js, test/helpers/pathCypherFake.js): ${oneLine(q).slice(0, 400)}`);
}
const desc = (t) => (t ? String(t.v) : 'the end');

// ── values ──
const isNeoInt = (x) => !!x && typeof x === 'object' && typeof x.low === 'number' && typeof x.high === 'number' && typeof x.toNumber === 'function';
const isStoredInt = (x) => !!x && typeof x === 'object' && !Array.isArray(x) && typeof x.$int === 'string' && Object.keys(x).length === 1;
/** A stored property value as toJS would give it: an integer as a number, lists item by item. */
function plainValue(v) {
  if (v === undefined) return null;
  if (isStoredInt(v)) return Number(v.$int);
  if (Array.isArray(v)) return v.map(plainValue);
  return v;
}
const plainProps = (props) => Object.fromEntries(Object.entries(props || {}).map(([k, v]) => [k, plainValue(v)]));

// ── reading the statement ──
function tokenize(q) {
  const toks = [];
  let i = 0;
  while (i < q.length) {
    const c = q[i];
    if (/\s/.test(c) || c === ';') { i++; continue; }
    if (c === '/' && q[i + 1] === '/') { while (i < q.length && q[i] !== '\n') i++; continue; }
    if (c === '/' && q[i + 1] === '*') { const j = q.indexOf('*/', i + 2); if (j < 0) throw cantRun('a comment with no end', q); i = j + 2; continue; }
    if (c === "'" || c === '"') {
      let j = i + 1, s = '';
      while (j < q.length && q[j] !== c) { if (q[j] === '\\') { s += q[j + 1]; j += 2; } else { s += q[j]; j++; } }
      if (j >= q.length) throw cantRun('a string with no end', q);
      toks.push({ t: 'str', v: s }); i = j + 1; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < q.length && /[0-9]/.test(q[j])) j++;
      if (q[j] === '.' && /[0-9]/.test(q[j + 1] || '')) { j++; while (j < q.length && /[0-9]/.test(q[j])) j++; }
      toks.push({ t: 'num', v: Number(q.slice(i, j)) }); i = j; continue;
    }
    if (c === '$') { let j = i + 1; while (j < q.length && /\w/.test(q[j])) j++; toks.push({ t: 'param', v: q.slice(i + 1, j) }); i = j; continue; }
    if (c === '`') { const j = q.indexOf('`', i + 1); if (j < 0) throw cantRun('a quoted name with no end', q); toks.push({ t: 'id', v: q.slice(i + 1, j) }); i = j + 1; continue; }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < q.length && /\w/.test(q[j])) j++;
      const w = q.slice(i, j);
      toks.push(KEYWORDS.has(w.toUpperCase()) ? { t: 'kw', v: w.toUpperCase(), raw: w } : { t: 'id', v: w });
      i = j; continue;
    }
    const two = q.slice(i, i + 2);
    if (['<>', '<=', '>=', '=~', '..', '+='].includes(two)) { toks.push({ t: 'op', v: two }); i += 2; continue; }
    if ('()[]{},.:|=<>*-+/%'.includes(c)) { toks.push({ t: 'op', v: c }); i++; continue; }
    throw cantRun(`the character ${c}`, q);
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
  const kw = (v) => { if (!isKw(v)) throw cantRun(`expected ${v}, met ${desc(peek())}`, q); return take(); };
  const op = (v) => { if (!isOp(v)) throw cantRun(`expected ${v}, met ${desc(peek())}`, q); return take(); };
  // A label, a property or an alias may spell a keyword (a Set node): where a name is expected, a keyword is that name.
  const name = () => { const t = take(); if (t && t.t === 'kw' && t.raw) return t.raw; if (!t || t.t !== 'id') throw cantRun(`expected a name, met ${desc(t)}`, q); return t.v; };
  const labelAlternatives = () => { const alts = [name()]; while (isOp('|')) { take(); alts.push(name()); } return alts; };
  const types = new Set();
  let untyped = false;

  // ── patterns ──
  function mapLiteral() {
    op('{');
    const entries = [];
    if (!isOp('}')) {
      do { if (entries.length) take(); const k = name(); op(':'); entries.push([k, expr()]); } while (isOp(','));
    }
    op('}');
    return entries;
  }
  function nodePattern() {
    op('(');
    const v = peek() && peek().t === 'id' ? take().v : null;
    const labels = [];
    while (isOp(':')) { take(); labels.push(labelAlternatives()); }
    const map = isOp('{') ? mapLiteral() : [];
    op(')');
    return { v, labels, map };
  }
  function relPattern() {
    let dir = 'out';
    if (isOp('<')) { take(); op('-'); dir = 'in'; } else op('-');
    if (!isOp('[')) throw cantRun('a relationship with no [ ]: it names its type', q);
    take();
    const v = peek() && peek().t === 'id' ? take().v : null;
    let ts = null;
    if (isOp(':')) {
      take(); ts = [name()];
      while (isOp('|')) { take(); if (isOp(':')) take(); ts.push(name()); }
    }
    let min = 1, max = 1;
    if (isOp('*')) {
      take();
      min = 1; max = Infinity;
      if (peek() && peek().t === 'num') { min = take().v; max = min; }
      if (isOp('..')) { take(); max = peek() && peek().t === 'num' ? take().v : Infinity; }
    }
    if (isOp('{')) throw cantRun('a property map on a relationship', q);
    op(']');
    op('-');
    if (dir === 'out') { if (!isOp('>')) throw cantRun('an undirected relationship', q); take(); } else if (isOp('>')) throw cantRun('a relationship with two arrows', q);
    // A relationship with no type matches every type, where the caller lifts the repertoire (runPathQuery).
    if (!ts) untyped = true; else for (const t of ts) types.add(t);
    if (v && (min !== 1 || max !== 1)) throw cantRun('a variable on a variable-length relationship', q);
    return { v, types: ts, dir, min, max };
  }
  function pathPattern() {
    if (peek() && peek().t === 'id' && isOp('=', 1)) throw cantRun('a path variable', q);
    const nodes = [nodePattern()];
    const rels = [];
    while (isOp('-') || isOp('<')) { rels.push(relPattern()); nodes.push(nodePattern()); }
    return { nodes, rels };
  }

  // ── expressions ──
  function expr() { return or(); }
  function or() { let l = xor(); while (isKw('OR')) { take(); l = { k: 'or', l, r: xor() }; } return l; }
  function xor() { let l = and(); while (isKw('XOR')) { take(); l = { k: 'xor', l, r: and() }; } return l; }
  function and() { let l = not(); while (isKw('AND')) { take(); l = { k: 'and', l, r: not() }; } return l; }
  function not() { if (isKw('NOT')) { take(); return { k: 'not', e: not() }; } return cmp(); }
  function cmp() {
    let l = postfix();
    for (;;) {
      if (isOp('=') || isOp('<>') || isOp('<') || isOp('>') || isOp('<=') || isOp('>=')) { const o = take().v; l = { k: 'cmp', o, l, r: postfix() }; continue; }
      if (isOp('=~')) throw cantRun('a regular expression (=~)', q);
      if (isKw('IS')) { take(); const neg = isKw('NOT') ? (take(), true) : false; kw('NULL'); l = { k: 'isnull', e: l, neg }; continue; }
      if (isKw('IN')) { take(); l = { k: 'in', l, r: postfix() }; continue; }
      if (isKw('STARTS') || isKw('ENDS')) { const o = take().v; kw('WITH'); l = { k: 'str', o, l, r: postfix() }; continue; }
      if (isKw('CONTAINS')) { take(); l = { k: 'str', o: 'CONTAINS', l, r: postfix() }; continue; }
      if (isOp('+') || isOp('-') || isOp('*') || isOp('/') || isOp('%')) throw cantRun(`arithmetic (${peek().v})`, q);
      return l;
    }
  }
  function postfix() {
    let e = atom();
    for (;;) {
      if (isOp('.')) { take(); e = { k: 'prop', e, p: name() }; continue; }
      if (isOp('[')) { take(); const i = expr(); if (isOp('..')) throw cantRun('a list slice', q); op(']'); e = { k: 'index', e, i }; continue; }
      if (isOp(':') && e.k === 'var') { const sets = []; while (isOp(':')) { take(); sets.push(labelAlternatives()); } e = { k: 'labels', e, sets }; continue; }
      return e;
    }
  }
  function atom() {
    const t = peek();
    if (!t) throw cantRun('an expression cut short', q);
    if (t.t === 'str' || t.t === 'num') { take(); return { k: 'lit', v: t.v }; }
    if (t.t === 'param') { take(); return { k: 'param', v: t.v }; }
    if (isKw('TRUE')) { take(); return { k: 'lit', v: true }; }
    if (isKw('FALSE')) { take(); return { k: 'lit', v: false }; }
    if (isKw('NULL')) { take(); return { k: 'lit', v: null }; }
    if (isOp('(')) { take(); const e = expr(); op(')'); return e; }
    if (isOp('[')) {
      take();
      if (peek() && peek().t === 'id' && isKw('IN', 1)) {
        const v = take().v; take();
        const list = expr();
        const where = isKw('WHERE') ? (take(), expr()) : null;
        const proj = isOp('|') ? (take(), expr()) : null;
        op(']');
        return { k: 'comp', v, list, where, proj };
      }
      const items = [];
      if (!isOp(']')) { items.push(expr()); while (isOp(',')) { take(); items.push(expr()); } }
      op(']');
      return { k: 'list', items };
    }
    if (isOp('{')) throw cantRun('a map literal', q);
    if (isKw('CASE')) {
      take();
      if (!isKw('WHEN')) throw cantRun('a CASE with a value (only CASE WHEN … is read)', q);
      const whens = [];
      while (isKw('WHEN')) { take(); const c = expr(); kw('THEN'); whens.push({ c, v: expr() }); }
      const otherwise = isKw('ELSE') ? (take(), expr()) : { k: 'lit', v: null };
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
      if (AGGREGATES.has(fn)) { if (args.length !== 1) throw cantRun(`${fn} with ${args.length} arguments`, q); return { k: 'agg', fn, distinct, e: args[0] }; }
      if (distinct) throw cantRun(`DISTINCT in ${fn}()`, q);
      if (!FUNCTIONS.has(fn)) throw cantRun(`the function ${fn}()`, q);
      return { k: 'fn', fn, args };
    }
    if (t.t === 'id') { take(); return { k: 'var', v: t.v }; }
    if (t.t === 'kw' && (CLAUSE_WORDS.includes(t.v) || t.v === 'MATCH' || t.v === 'OPTIONAL')) throw cantRun(`a ${t.v} clause`, q);
    throw cantRun(`${t.v} where an expression should be`, q);
  }

  function projection() {
    const distinct = isKw('DISTINCT') ? (take(), true) : false;
    if (isOp('*')) throw cantRun('WITH * or RETURN *', q);
    const list = [];
    do {
      if (list.length) take();
      const e = expr();
      let alias;
      if (isKw('AS')) { take(); alias = name(); } else if (e.k === 'var') alias = e.v; else if (e.k === 'prop' && e.e.k === 'var') alias = `${e.e.v}.${e.p}`;
      else throw cantRun('a WITH or RETURN item with no AS', q);
      list.push({ e, alias });
    } while (isOp(','));
    const order = [];
    if (isKw('ORDER')) {
      take(); kw('BY');
      do {
        if (order.length) take();
        const e = expr();
        let descending = false;
        if (isKw('DESC') || isKw('DESCENDING')) { take(); descending = true; } else if (isKw('ASC') || isKw('ASCENDING')) take();
        order.push({ e, desc: descending });
      } while (isOp(','));
    }
    const skip = isKw('SKIP') ? (take(), atom()) : null;
    const limit = isKw('LIMIT') ? (take(), atom()) : null;
    return { distinct, list, order, skip, limit };
  }

  // ── the query ──
  const clauses = [];
  while (p < toks.length) {
    if (isKw('OPTIONAL') || isKw('MATCH')) {
      const optional = isKw('OPTIONAL') ? (take(), true) : false;
      kw('MATCH');
      const paths = [pathPattern()];
      while (isOp(',')) { take(); paths.push(pathPattern()); }
      const where = isKw('WHERE') ? (take(), expr()) : null;
      clauses.push({ k: 'match', optional, paths, where });
      continue;
    }
    if (isKw('WITH')) { take(); const proj = projection(); const where = isKw('WHERE') ? (take(), expr()) : null; clauses.push({ k: 'with', proj, where }); continue; }
    if (isKw('RETURN')) {
      take();
      clauses.push({ k: 'return', proj: projection() });
      if (p < toks.length) throw cantRun(`${desc(peek())} after the RETURN`, q);
      break;
    }
    throw cantRun(`a ${desc(peek())} clause`, q);
  }
  if (!clauses.length || clauses[clauses.length - 1].k !== 'return') throw cantRun('no RETURN', q);
  return { clauses, types, untyped };
}

// ── evaluation, with Cypher's three-valued logic ──
function context(state, params, q) {
  const nodes = state.nodes || [];
  const rels = state.rels || [];
  const byEid = new Map(nodes.map((n) => [n.eid, n]));
  const out = new Map(), inc = new Map(), byProp = { tapestryKey: new Map(), uuid: new Map() };
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  for (const r of rels) { push(out, r.from, r); push(inc, r.to, r); }
  for (const n of nodes) for (const k of Object.keys(byProp)) if (typeof n.props[k] === 'string') push(byProp[k], n.props[k], n);
  return { nodes, byEid, out, inc, byProp, isNode: new Set(nodes), isRel: new Set(rels), params: params || {}, q };
}

const hasLabels = (node, sets) => sets.every((alts) => alts.some((l) => node.labels.includes(l)));

function identity(x, ctx) {
  if (x === null || x === undefined) return 'null';
  if (ctx.isNode.has(x)) return `n#${x.eid}`;
  if (ctx.isRel.has(x)) return `r#${x.eid}`;
  if (Array.isArray(x)) return `[${x.map((y) => identity(y, ctx)).join(',')}]`;
  return JSON.stringify(x);
}
function equal(a, b, ctx) {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (ctx.isNode.has(a) || ctx.isNode.has(b) || ctx.isRel.has(a) || ctx.isRel.has(b)) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    let unknown = false;
    for (let i = 0; i < a.length; i++) { const e = equal(a[i], b[i], ctx); if (e === false) return false; if (e === null) unknown = true; }
    return unknown ? null : true;
  }
  if (Array.isArray(a) || Array.isArray(b)) return false;
  return a === b;
}
function compare(o, a, b, ctx) {
  if (o === '=') return equal(a, b, ctx);
  if (o === '<>') { const e = equal(a, b, ctx); return e === null ? null : !e; }
  if (a === null || b === null || a === undefined || b === undefined) return null;
  if (typeof a !== typeof b || (typeof a !== 'string' && typeof a !== 'number')) return null;
  return o === '<' ? a < b : o === '>' ? a > b : o === '<=' ? a <= b : a >= b;
}
const ordering = (a, b) => (a === b ? 0 : a === null || a === undefined ? 1 : b === null || b === undefined ? -1 : a < b ? -1 : 1);

function evaluate(e, env, ctx) {
  const ev = (x) => evaluate(x, env, ctx);
  switch (e.k) {
    case 'lit': return e.v;
    case 'param': if (!(e.v in ctx.params)) throw new Error(`Expected parameter(s): ${e.v}`); return ctx.params[e.v] === undefined ? null : ctx.params[e.v];
    case 'list': return e.items.map(ev);
    case 'var': if (!(e.v in env)) throw new Error(`Variable \`${e.v}\` not defined`); return env[e.v];
    case 'prop': {
      const x = ev(e.e);
      if (x === null || x === undefined) return null;
      if (ctx.isNode.has(x) || ctx.isRel.has(x)) return plainValue(x.props[e.p]);
      if (typeof x === 'object' && !Array.isArray(x)) return x[e.p] === undefined ? null : x[e.p];
      throw new Error(`Type mismatch: expected a map, a node or a relationship to read .${e.p} from`);
    }
    case 'index': {
      const x = ev(e.e), i = ev(e.i);
      if (x === null || x === undefined || i === null || i === undefined) return null;
      if (ctx.isNode.has(x) || ctx.isRel.has(x)) return plainValue(x.props[i]);
      if (Array.isArray(x)) { const j = i < 0 ? x.length + i : i; return j >= 0 && j < x.length ? x[j] : null; }
      if (typeof x === 'object') return x[i] === undefined ? null : x[i];
      throw new Error('Type mismatch: [ ] on something that is not a list, a map or a node');
    }
    case 'labels': { const x = ev(e.e); if (x === null || x === undefined) return null; if (!ctx.isNode.has(x)) throw new Error('a label test on something that is not a node'); return hasLabels(x, e.sets); }
    case 'cmp': return compare(e.o, ev(e.l), ev(e.r), ctx);
    case 'isnull': { const x = ev(e.e); const n = x === null || x === undefined; return e.neg ? !n : n; }
    case 'in': {
      const x = ev(e.l), list = ev(e.r);
      if (list === null || list === undefined) return null;
      if (!Array.isArray(list)) throw new Error('Type mismatch: IN expects a list');
      if (x === null || x === undefined) return list.length ? null : false;
      let unknown = false;
      for (const y of list) { const eq = equal(x, y, ctx); if (eq === true) return true; if (eq === null) unknown = true; }
      return unknown ? null : false;
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
    case 'comp': {
      const list = ev(e.list);
      if (list === null || list === undefined) return null;
      if (!Array.isArray(list)) throw new Error('Type mismatch: a list comprehension over something that is not a list');
      const out = [];
      for (const item of list) {
        const inner = { ...env, [e.v]: item };
        if (e.where && evaluate(e.where, inner, ctx) !== true) continue;
        out.push(e.proj ? evaluate(e.proj, inner, ctx) : item);
      }
      return out;
    }
    case 'fn': {
      const args = e.args.map(ev);
      const x = args[0];
      switch (e.fn) {
        case 'coalesce': { const y = args.find((a) => a !== null && a !== undefined); return y === undefined ? null : y; }
        case 'keys':
          if (x === null || x === undefined) return null;
          if (ctx.isNode.has(x) || ctx.isRel.has(x)) return Object.keys(x.props).filter((k) => x.props[k] !== null && x.props[k] !== undefined);
          if (typeof x === 'object' && !Array.isArray(x)) return Object.keys(x);
          throw new Error('Type mismatch: keys() of something that is not a map, a node or a relationship');
        case 'head': if (x === null || x === undefined) return null; if (!Array.isArray(x)) throw new Error('Type mismatch: head() of something that is not a list'); return x.length ? x[0] : null;
        case 'size': if (x === null || x === undefined) return null; return x.length;
        case 'tostring': if (x === null || x === undefined) return null; return String(x);
        // Story graph-operations-first-slice #16 (ADR 0016, C8): a concept's names compared without case.
        case 'tolower': if (x === null || x === undefined) return null; if (typeof x !== 'string') throw new Error('Type mismatch: toLower() of something that is not a string'); return x.toLowerCase();
        case 'labels': if (x === null || x === undefined) return null; if (!ctx.isNode.has(x)) throw new Error('labels() of something that is not a node'); return [...x.labels];
        case 'type': if (x === null || x === undefined) return null; if (!ctx.isRel.has(x)) throw new Error('type() of something that is not a relationship'); return x.type;
        // Story graph-operations-first-slice #13 (ADR 0013): a relationship's id, and its map as the driver leaves it.
        case 'elementid':
          if (x === null || x === undefined) return null;
          if (!ctx.isNode.has(x) && !ctx.isRel.has(x)) throw new Error('Type mismatch: elementId() of something that is not a node or a relationship');
          return `5:${FAKE_DATABASE_ID}:${x.eid}`;
        case 'properties':
          if (x === null || x === undefined) return null;
          if (ctx.isNode.has(x) || ctx.isRel.has(x)) return { ...x.props };
          if (typeof x === 'object' && !Array.isArray(x)) return x;
          throw new Error('Type mismatch: properties() of something that is not a map, a node or a relationship');
        default: throw cantRun(`the function ${e.fn}()`, ctx.q);
      }
    }
    case 'agg': throw cantRun('an aggregate where Cypher reads none (outside a WITH or RETURN item)', ctx.q);
    default: throw cantRun(`an expression it can't read (${e.k})`, ctx.q);
  }
}

const hasAgg = (e) => !!e && typeof e === 'object' && (e.k === 'agg' || Object.values(e).some((x) => (Array.isArray(x) ? x.some(hasAgg) : x && typeof x === 'object' && hasAgg(x))));

function aggregate(a, rows, ctx) {
  if (a.star) return rows.length;
  let vals = rows.map((env) => evaluate(a.e, env, ctx)).filter((x) => x !== null && x !== undefined);
  if (a.distinct) { const seen = new Map(); for (const v of vals) if (!seen.has(identity(v, ctx))) seen.set(identity(v, ctx), v); vals = [...seen.values()]; }
  return a.fn === 'count' ? vals.length : vals;
}
/** An item that holds an aggregate, over one group's rows: each aggregate computed, then the rest as written. */
function evaluateGrouped(e, rows, ctx, keyEnv) {
  const fold = (x) => {
    if (!x || typeof x !== 'object') return x;
    if (x.k === 'agg') return { k: 'lit', v: aggregate(x, rows, ctx) };
    if (Array.isArray(x)) return x.map(fold);
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, fold(v)]));
  };
  return evaluate(fold(e), keyEnv, ctx);
}

function count(x, ctx, what) {
  let n;
  if (x.k === 'lit') n = x.v;
  else if (x.k === 'param') {
    const v = ctx.params[x.v];
    if (isNeoInt(v)) n = v.toNumber();
    else if (typeof v === 'number') throw new Error(`${what}: Invalid input. '${Number.isInteger(v) ? `${v}.0` : v}' is not a valid value. Must be a non-negative integer. (The fake graph refuses what Neo4j refuses: the driver sends a JavaScript number as a float, so write the checked number into the text, as graph history does.)`);
    else n = v;
  } else throw cantRun(`a ${what} that is not a number or a parameter`, ctx.q);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${what}: Invalid input. '${n}' is not a valid value. Must be a non-negative integer.`);
  return n;
}

function project(proj, rows, ctx) {
  const grouped = proj.list.some((it) => hasAgg(it.e));
  let out;
  if (!grouped) {
    out = rows.map((env) => ({ env: Object.fromEntries(proj.list.map((it) => [it.alias, evaluate(it.e, env, ctx)])), source: env }));
  } else {
    const keys = proj.list.filter((it) => !hasAgg(it.e));
    const groups = new Map();
    for (const env of rows) {
      const kv = keys.map((it) => evaluate(it.e, env, ctx));
      const id = kv.map((x) => identity(x, ctx)).join('|');
      if (!groups.has(id)) groups.set(id, { kv, rows: [] });
      groups.get(id).rows.push(env);
    }
    if (!groups.size && !keys.length) groups.set('', { kv: [], rows: [] });
    out = [...groups.values()].map((g) => {
      const keyEnv = g.rows[0] || {};
      const env = {};
      let i = 0;
      for (const it of proj.list) env[it.alias] = hasAgg(it.e) ? evaluateGrouped(it.e, g.rows, ctx, keyEnv) : g.kv[i++];
      return { env, source: null };
    });
  }
  if (proj.distinct) {
    const seen = new Set();
    out = out.filter((r) => { const id = Object.values(r.env).map((x) => identity(x, ctx)).join('|'); if (seen.has(id)) return false; seen.add(id); return true; });
  }
  if (proj.order.length) {
    const keyed = out.map((r) => ({ r, ks: proj.order.map((o) => evaluate(o.e, r.source ? { ...r.source, ...r.env } : r.env, ctx)) }));
    keyed.sort((a, b) => { for (let i = 0; i < proj.order.length; i++) { const c = ordering(a.ks[i], b.ks[i]); if (c) return proj.order[i].desc ? -c : c; } return 0; });
    out = keyed.map((x) => x.r);
  }
  if (proj.skip) out = out.slice(count(proj.skip, ctx, 'SKIP'));
  if (proj.limit) out = out.slice(0, count(proj.limit, ctx, 'LIMIT'));
  return out.map((r) => r.env);
}

// ── matching ──
function nodeFits(np, node, env, ctx) {
  if (!hasLabels(node, np.labels)) return false;
  for (const [k, x] of np.map) if (equal(plainValue(node.props[k]), evaluate(x, env, ctx), ctx) !== true) return false;
  return true;
}
function candidates(np, env, ctx) {
  if (np.v && np.v in env) { const x = env[np.v]; return x && ctx.isNode.has(x) ? [x] : []; }
  for (const [k, x] of np.map) {
    if (!ctx.byProp[k]) continue;
    const v = evaluate(x, env, ctx);
    return typeof v === 'string' ? (ctx.byProp[k].get(v) || []) : [];
  }
  return ctx.nodes;
}
function* steps(node, rp, used, ctx) {
  const adj = rp.dir === 'out' ? ctx.out : ctx.inc;
  const far = (r) => ctx.byEid.get(rp.dir === 'out' ? r.to : r.from);
  const next = (n, path) => (adj.get(n.eid) || []).filter((r) => (rp.types === null || rp.types.includes(r.type)) && !used.has(r) && !path.includes(r));
  function* dfs(n, path) {
    if (path.length >= rp.min) yield [n, path];
    if (path.length >= rp.max) return;
    for (const r of next(n, path)) { const m = far(r); if (m) yield* dfs(m, [...path, r]); }
  }
  yield* dfs(node, []);
}
/** Every way the clause's paths match, extending env; a relationship isn't matched twice in one clause. */
function matchPaths(paths, env, ctx) {
  const out = [];
  const walkPath = (pi, e, used) => {
    if (pi === paths.length) { out.push(e); return; }
    const path = paths[pi];
    const bindNode = (np, node, cur) => {
      if (!nodeFits(np, node, cur, ctx)) return null;
      if (!np.v) return cur;
      if (np.v in cur) return cur[np.v] === node ? cur : null;
      return { ...cur, [np.v]: node };
    };
    const hop = (i, node, cur, usedHere) => {
      if (i === path.rels.length) { walkPath(pi + 1, cur, usedHere); return; }
      const rp = path.rels[i];
      for (const [m, rs] of steps(node, rp, usedHere, ctx)) {
        let next = bindNode(path.nodes[i + 1], m, cur);
        if (!next) continue;
        if (rp.v) {
          if (rp.v in next) { if (next[rp.v] !== rs[0]) continue; } else next = { ...next, [rp.v]: rs[0] };
        }
        hop(i + 1, m, next, new Set([...usedHere, ...rs]));
      }
    };
    for (const n of candidates(path.nodes[0], e, ctx)) {
      const start = bindNode(path.nodes[0], n, e);
      if (start) hop(0, n, start, used);
    }
  };
  walkPath(0, env, new Set());
  return out;
}
const varsOf = (paths) => paths.flatMap((pa) => [...pa.nodes.map((n) => n.v), ...pa.rels.map((r) => r.v)]).filter(Boolean);

/** What toJS gives for a value: a node as { ...properties, _labels }, a relationship as { ...properties, _type }. */
function toJs(x, ctx) {
  if (x === null || x === undefined) return null;
  if (ctx.isNode.has(x)) return { ...plainProps(x.props), _labels: [...x.labels] };
  if (ctx.isRel.has(x)) return { ...plainProps(x.props), _type: x.type };
  if (Array.isArray(x)) return x.map((y) => toJs(y, ctx));
  if (isStoredInt(x)) return Number(x.$int);
  return x;
}

/**
 * Run a read over paths; its rows.
 * @param {{ nodes: object[], rels: object[] }} state
 * @param {string} cypher
 * @param {object} params
 * @param {{ types: Iterable<string>|null }} opts  the relationship types it may read over; null for every type, with
 *   relationships of no type matching each (ADR graph-operations-first-slice/0013's one-hop reads)
 */
function runPathQuery(state, cypher, params = {}, { types } = {}) {
  const q = String(cypher);
  const plan = parse(q);
  if (types !== null) {
    if (plan.untyped) throw cantRun('a relationship with no type', q);
    const allowed = new Set(types || []);
    for (const t of plan.types) if (!allowed.has(t)) throw cantRun(`a read over ${t}, a relationship type it doesn't read paths over (it reads ${[...allowed].join(', ')})`, q);
  }
  const ctx = context(state, params, q);
  let rows = [{}];
  for (const c of plan.clauses) {
    if (c.k === 'match') {
      const next = [];
      for (const env of rows) {
        const found = matchPaths(c.paths, env, ctx).filter((e) => !c.where || evaluate(c.where, e, ctx) === true);
        if (found.length) next.push(...found);
        else if (c.optional) {
          const nulls = { ...env };
          for (const v of varsOf(c.paths)) if (!(v in nulls)) nulls[v] = null;
          next.push(nulls);
        }
      }
      rows = next;
    } else if (c.k === 'with') {
      rows = project(c.proj, rows, ctx);
      if (c.where) rows = rows.filter((e) => evaluate(c.where, e, ctx) === true);
    } else {
      rows = project(c.proj, rows, ctx);
    }
  }
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, toJs(v, ctx)])));
}

module.exports = { runPathQuery, plainValue, plainProps, isNeoInt, isStoredInt };
