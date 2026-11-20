'use strict';
/**
 * A Cypher engine for the fake graph, reads and writes — story graph-operations-first-slice #32 (import nostr; ADR
 * graph-operations-first-slice/0032, Implementation notes, "The statements record runs"). Its test plan says why this and
 * not ten pinned shapes in test/helpers/graphFake.js: what makes the recorder right is what Neo4j does with its
 * statements (MERGE under the uniqueness rules, placeholders, a DETACH DELETE against a DELETE), so the suites run them
 * as Neo4j would and check the graph they leave, whatever text the Implementer writes within this subset.
 *
 *   run(state, cypher, params) → { rows, counters }
 *     runs one statement over a state in graphFake.js's shape ({ nodes: [{ eid, labels, props }], rels: [{ eid, type,
 *     from, to, props }], nextEid }), changing it in place. Rows are as src/lib/neo4j-driver.js's toJS gives them: a
 *     node as { ...properties, _labels }, a relationship as { ...properties, _type }, a stored integer as a number.
 *   danglingRels(state) → the relationships whose node is gone: Neo4j's commit refuses a DELETE that left them.
 *   isCantRun(err)       whether err is this engine saying a statement is outside its subset.
 *
 * The subset:
 *   clauses      MATCH and OPTIONAL MATCH [WHERE]; WITH [DISTINCT] items or * [ORDER BY, SKIP, LIMIT] [WHERE]; UNWIND;
 *                RETURN [DISTINCT] (last; a statement that writes may end without one); CREATE; MERGE of a node or a
 *                path, with ON CREATE SET and ON MATCH SET; SET v.p = e, v += e, v = e, v:L; REMOVE v.p, v:L; DELETE
 *                and DETACH DELETE; FOREACH (x IN e | CREATE, MERGE, SET, REMOVE, DELETE or FOREACH …)
 *   patterns     (v:A|B:C {k: e}); -[r:T|U *a..b {k: e}]->, <-[…]-, and in a match -[…]-; -->, <-- and --
 *   expressions  literals, $params, lists, maps {k: e}, v.p, v[e], list[a..b], v:L, + - * / %, unary -, = <> < > <= >=,
 *                =~, IS [NOT] NULL, IN, STARTS WITH, ENDS WITH, CONTAINS, NOT AND XOR OR (three-valued), CASE (both
 *                forms), [x IN list WHERE … | …], [(a)-[:R]->(b) WHERE … | …], a pattern as a predicate, EXISTS { … }
 *                and COUNT { … } (with or without MATCH), and the functions in FUNCTIONS; the aggregates count (also
 *                count(*)), collect, sum, min, max and avg, each with DISTINCT
 *
 * As Neo4j 5 does:
 *   - the uniqueness rules Tapestry's Neo4j has (setup/neo4jConstraintsAndIndexes.sh; lifecycle migrate's
 *     tapestry_key): NostrEvent.id, NostrEvent.uuid, NostrEventTag.uuid, NostrUser.pubkey and TapestryNode.tapestryKey,
 *     checked after each clause that writes; a breach fails the statement with Neo.ClientError.Schema.
 *     ConstraintValidationFailed, "Node(<eid>) already exists with label `L` and property `p` = '<v>'". So memo #130's
 *     failure of today's buildImportCypher happens here as it does on Neo4j;
 *   - MERGE matches the whole pattern, sees what earlier rows of the same clause made, and refuses a null in its map;
 *     a CREATE or MERGE of a relationship from a null node fails; CREATE of a node a variable already holds fails;
 *   - a SET to null removes the property; a property holds only a primitive or a list of one primitive type (a
 *     neo4j.int is stored as { $int: '<digits>' }, as graphFake.js stores one), anything else fails as Neo4j fails;
 *   - DELETE of a node with relationships leaves them dangling until the commit, which danglingRels finds, as Neo4j's
 *     "Cannot delete node<…>, because it still has relationships";
 *   - a read that doesn't end with RETURN fails; SKIP and LIMIT refuse a JavaScript number (the driver sends a float).
 * Anything else throws "the fake graph can't run this Cypher (…)", naming what it met, so a failure at the fake's
 * limits says so. Nothing here opens Neo4j, a file or the network.
 */

const crypto = require('crypto');

const PREFIX = "the fake graph can't run this Cypher";
const oneLine = (q) => String(q).replace(/\s+/g, ' ').trim();
function cantRun(why, q) {
  return Object.assign(new Error(`${PREFIX} (${why}); test/helpers/cypherEngine.js runs the subset its header names: ${oneLine(q).slice(0, 400)}`), { cantRun: true });
}
const isCantRun = (e) => !!(e && e.cantRun === true);
const neoError = (code, message) => Object.assign(new Error(message), { code });

/** The uniqueness rules: [label, property]. */
const CONSTRAINTS = Object.freeze([
  ['NostrEvent', 'id'], ['NostrEvent', 'uuid'], ['NostrEventTag', 'uuid'], ['NostrUser', 'pubkey'], ['TapestryNode', 'tapestryKey'],
]);

// ── values ──
const isNeoInt = (x) => !!x && typeof x === 'object' && typeof x.low === 'number' && typeof x.high === 'number' && typeof x.toNumber === 'function';
const isStoredInt = (x) => !!x && typeof x === 'object' && !Array.isArray(x) && typeof x.$int === 'string' && Object.keys(x).length === 1;
const num = (x) => (isNeoInt(x) ? x.toNumber() : isStoredInt(x) ? Number(x.$int) : x);
function plainValue(v) {
  if (v === undefined) return null;
  if (isStoredInt(v)) return Number(v.$int);
  if (isNeoInt(v)) return v.toNumber();
  if (Array.isArray(v)) return v.map(plainValue);
  return v;
}
const plainProps = (props) => Object.fromEntries(Object.entries(props || {}).map(([k, v]) => [k, plainValue(v)]));
const isMap = (x) => x !== null && typeof x === 'object' && !Array.isArray(x) && !isNeoInt(x) && !isStoredInt(x);

/** What a Neo4j property can hold, as the fake keeps it; throws, as Neo4j does, for anything else. */
function storable(v, prop) {
  const refuse = (what) => neoError('Neo.ClientError.Statement.TypeError', `Property values can only be of primitive types or arrays thereof. Encountered: ${what} in the property ${prop} (the fake graph refuses what Neo4j refuses)`);
  if (typeof v === 'string' || typeof v === 'boolean') return v;
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw refuse('a number that is not finite'); return v; }
  if (isNeoInt(v)) return { $int: v.toString() };
  if (isStoredInt(v)) return { $int: v.$int };
  if (Array.isArray(v)) {
    const kinds = new Set();
    const items = v.map((x) => {
      if (x === null || x === undefined) throw refuse('a list holding a null');
      if (Array.isArray(x) || (typeof x === 'object' && !isNeoInt(x) && !isStoredInt(x))) throw refuse('a list holding a list or a map');
      kinds.add(isNeoInt(x) || isStoredInt(x) ? 'integer' : typeof x === 'number' ? 'float' : typeof x);
      return storable(x, prop);
    });
    if (kinds.size > 1) throw refuse(`a list of mixed types (${[...kinds].join(', ')})`);
    return items;
  }
  throw refuse(v === null ? 'a null' : typeof v === 'object' ? 'a map' : `a ${typeof v}`);
}

// ── reading the statement ──
const KEYWORDS = new Set(['MATCH', 'OPTIONAL', 'WHERE', 'WITH', 'RETURN', 'ORDER', 'BY', 'SKIP', 'LIMIT', 'AS', 'DISTINCT',
  'ASC', 'ASCENDING', 'DESC', 'DESCENDING', 'AND', 'OR', 'XOR', 'NOT', 'IS', 'NULL', 'IN', 'TRUE', 'FALSE', 'CASE', 'WHEN',
  'THEN', 'ELSE', 'END', 'STARTS', 'ENDS', 'CONTAINS', 'UNION', 'CALL', 'UNWIND', 'MERGE', 'CREATE', 'SET', 'DELETE',
  'DETACH', 'REMOVE', 'FOREACH', 'YIELD', 'LOAD', 'USE', 'SHOW', 'EXPLAIN', 'PROFILE', 'ON']);
const AGGREGATES = new Set(['count', 'collect', 'sum', 'min', 'max', 'avg']);
const FUNCTIONS = new Set(['coalesce', 'keys', 'head', 'last', 'size', 'tostring', 'tointeger', 'tofloat', 'tolower', 'toupper',
  'trim', 'split', 'replace', 'substring', 'labels', 'type', 'elementid', 'properties', 'startnode', 'endnode', 'randomuuid',
  'timestamp', 'range', 'reverse', 'abs']);
const UPDATE_CLAUSES = ['CREATE', 'MERGE', 'SET', 'REMOVE', 'DELETE', 'DETACH', 'FOREACH'];
const desc = (t) => (t ? String(t.raw || t.v) : 'the end');

function tokenize(q) {
  const toks = [];
  let i = 0;
  const n = q.length;
  const ESC = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '\\': '\\', "'": "'", '"': '"' };
  while (i < n) {
    const c = q[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ';') { i++; continue; }
    if (c === '/' && q[i + 1] === '/') { while (i < n && q[i] !== '\n') i++; continue; }
    if (c === '/' && q[i + 1] === '*') { const j = q.indexOf('*/', i + 2); if (j < 0) throw cantRun('a comment with no end', q); i = j + 2; continue; }
    const start = i;
    if (c === "'" || c === '"') {
      let j = i + 1, s = '';
      while (j < n && q[j] !== c) {
        if (q[j] === '\\') {
          const e = q[j + 1];
          if (e === 'u') { s += String.fromCharCode(parseInt(q.slice(j + 2, j + 6), 16)); j += 6; continue; }
          s += Object.prototype.hasOwnProperty.call(ESC, e) ? ESC[e] : e;
          j += 2;
          continue;
        }
        s += q[j]; j++;
      }
      if (j >= n) throw cantRun('a string with no end', q);
      toks.push({ t: 'str', v: s, start, end: j + 1 }); i = j + 1; continue;
    }
    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < n && q[j] >= '0' && q[j] <= '9') j++;
      if (q[j] === '.' && q[j + 1] >= '0' && q[j + 1] <= '9') { j++; while (j < n && q[j] >= '0' && q[j] <= '9') j++; }
      if ((q[j] === 'e' || q[j] === 'E') && /[0-9+-]/.test(q[j + 1] || '')) { j++; if (q[j] === '+' || q[j] === '-') j++; while (j < n && q[j] >= '0' && q[j] <= '9') j++; }
      toks.push({ t: 'num', v: Number(q.slice(i, j)), start, end: j }); i = j; continue;
    }
    if (c === '$') { let j = i + 1; while (j < n && /\w/.test(q[j])) j++; toks.push({ t: 'param', v: q.slice(i + 1, j), start, end: j }); i = j; continue; }
    if (c === '`') { const j = q.indexOf('`', i + 1); if (j < 0) throw cantRun('a quoted name with no end', q); toks.push({ t: 'id', v: q.slice(i + 1, j), quoted: true, start, end: j + 1 }); i = j + 1; continue; }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < n && /\w/.test(q[j])) j++;
      const w = q.slice(i, j);
      toks.push(KEYWORDS.has(w.toUpperCase()) ? { t: 'kw', v: w.toUpperCase(), raw: w, start, end: j } : { t: 'id', v: w, start, end: j });
      i = j; continue;
    }
    const two = q.slice(i, i + 2);
    if (['<>', '<=', '>=', '=~', '..', '+='].includes(two)) { toks.push({ t: 'op', v: two, start, end: i + 2 }); i += 2; continue; }
    if ('()[]{},.:|=<>*-+/%'.includes(c)) { toks.push({ t: 'op', v: c, start, end: i + 1 }); i++; continue; }
    throw cantRun(`the character ${c}`, q);
  }
  return toks;
}

function parse(q) {
  const toks = tokenize(q);
  let p = 0;
  const peek = (o = 0) => toks[p + o];
  const isKw = (v, o = 0) => { const t = peek(o); return !!t && t.t === 'kw' && t.v === v; };
  const isOp = (v, o = 0) => { const t = peek(o); return !!t && t.t === 'op' && t.v === v; };
  const take = () => toks[p++];
  const kw = (v) => { if (!isKw(v)) throw cantRun(`expected ${v}, met ${desc(peek())}`, q); return take(); };
  const op = (v) => { if (!isOp(v)) throw cantRun(`expected ${v}, met ${desc(peek())}`, q); return take(); };
  // A label, a property or an alias may spell a keyword (a Set node): where a name is expected, a keyword is that name.
  const name = () => { const t = take(); if (t && t.t === 'kw' && t.raw) return t.raw; if (!t || t.t !== 'id') throw cantRun(`expected a name, met ${desc(t)}`, q); return t.v; };
  const tryParse = (fn) => { const save = p; try { const r = fn(); if (r) return r; } catch (e) { if (!isCantRun(e)) throw e; } p = save; return null; };

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
  function labelList() {
    const sets = [];
    while (isOp(':')) {
      take();
      const alts = [name()];
      while (isOp('|')) { take(); if (isOp(':')) take(); alts.push(name()); }
      sets.push(alts);
    }
    return sets;
  }
  function nodePattern() {
    op('(');
    const v = peek() && peek().t === 'id' ? take().v : null;
    const labels = labelList();
    const map = isOp('{') ? mapLiteral() : [];
    op(')');
    return { v, labels, map };
  }
  function relPattern() {
    let left = false;
    if (isOp('<')) { take(); left = true; }
    op('-');
    let v = null, types = null, min = 1, max = 1, map = [];
    if (isOp('[')) {
      take();
      if (peek() && peek().t === 'id') v = take().v;
      if (isOp(':')) { take(); types = [name()]; while (isOp('|')) { take(); if (isOp(':')) take(); types.push(name()); } }
      if (isOp('*')) {
        take();
        min = 1; max = Infinity;
        if (peek() && peek().t === 'num') { min = take().v; max = min; }
        if (isOp('..')) { take(); max = peek() && peek().t === 'num' ? take().v : Infinity; }
      }
      if (isOp('{')) map = mapLiteral();
      op(']');
    }
    op('-');
    let right = false;
    if (isOp('>')) { take(); right = true; }
    if (left && right) throw cantRun('a relationship with two arrows', q);
    if (v && (min !== 1 || max !== 1)) throw cantRun('a variable on a variable-length relationship', q);
    return { v, types, dir: left ? 'in' : right ? 'out' : 'both', min, max, map };
  }
  function pathPattern() {
    if (peek() && peek().t === 'id' && isOp('=', 1)) throw cantRun('a path variable', q);
    const nodes = [nodePattern()];
    const rels = [];
    while (isOp('-') || (isOp('<') && isOp('-', 1))) { rels.push(relPattern()); nodes.push(nodePattern()); }
    return { nodes, rels };
  }
  function patternList() { const paths = [pathPattern()]; while (isOp(',')) { take(); paths.push(pathPattern()); } return paths; }

  // ── expressions ──
  function expr() { return or(); }
  function or() { let l = xor(); while (isKw('OR')) { take(); l = { k: 'or', l, r: xor() }; } return l; }
  function xor() { let l = and(); while (isKw('XOR')) { take(); l = { k: 'xor', l, r: and() }; } return l; }
  function and() { let l = not(); while (isKw('AND')) { take(); l = { k: 'and', l, r: not() }; } return l; }
  function not() { if (isKw('NOT')) { take(); return { k: 'not', e: not() }; } return cmp(); }
  function cmp() {
    let l = add();
    for (;;) {
      if (isOp('=') || isOp('<>') || isOp('<') || isOp('>') || isOp('<=') || isOp('>=')) { const o = take().v; l = { k: 'cmp', o, l, r: add() }; continue; }
      if (isOp('=~')) { take(); l = { k: 'regex', l, r: add() }; continue; }
      if (isKw('IS')) { take(); const neg = isKw('NOT') ? (take(), true) : false; kw('NULL'); l = { k: 'isnull', e: l, neg }; continue; }
      if (isKw('IN')) { take(); l = { k: 'in', l, r: add() }; continue; }
      if (isKw('STARTS') || isKw('ENDS')) { const o = take().v; kw('WITH'); l = { k: 'str', o, l, r: add() }; continue; }
      if (isKw('CONTAINS')) { take(); l = { k: 'str', o: 'CONTAINS', l, r: add() }; continue; }
      return l;
    }
  }
  function add() { let l = mul(); while (isOp('+') || isOp('-')) { const o = take().v; l = { k: 'arith', o, l, r: mul() }; } return l; }
  function mul() { let l = unary(); while (isOp('*') || isOp('/') || isOp('%')) { const o = take().v; l = { k: 'arith', o, l, r: unary() }; } return l; }
  function unary() { if (isOp('-')) { take(); return { k: 'neg', e: unary() }; } if (isOp('+')) { take(); return unary(); } return postfix(); }
  function postfix() {
    let e = atom();
    for (;;) {
      if (isOp('.')) { take(); e = { k: 'prop', e, p: name() }; continue; }
      if (isOp('[')) {
        take();
        if (isOp('..')) { take(); const hi = isOp(']') ? null : expr(); op(']'); e = { k: 'slice', e, lo: null, hi }; continue; }
        const i = expr();
        if (isOp('..')) { take(); const hi = isOp(']') ? null : expr(); op(']'); e = { k: 'slice', e, lo: i, hi }; continue; }
        op(']');
        e = { k: 'index', e, i };
        continue;
      }
      if (isOp(':') && e.k === 'var') { e = { k: 'labels', e, sets: labelList() }; continue; }
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
    if (isOp('(')) {
      const pred = tryParse(() => { const path = pathPattern(); return path.rels.length ? { k: 'patternPred', path } : null; });
      if (pred) return pred;
      take(); const e = expr(); op(')'); return e;
    }
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
      if (isOp('(')) {
        const comp = tryParse(() => {
          const path = pathPattern();
          if (!path.rels.length || !(isKw('WHERE') || isOp('|'))) return null;
          const where = isKw('WHERE') ? (take(), expr()) : null;
          op('|');
          const proj = expr();
          op(']');
          return { k: 'patternComp', path, where, proj };
        });
        if (comp) return comp;
      }
      const items = [];
      if (!isOp(']')) { items.push(expr()); while (isOp(',')) { take(); items.push(expr()); } }
      op(']');
      return { k: 'list', items };
    }
    if (isOp('{')) return { k: 'map', entries: mapLiteral() };
    if (isKw('CASE')) {
      take();
      const subject = isKw('WHEN') ? null : expr();
      const whens = [];
      while (isKw('WHEN')) { take(); const c = expr(); kw('THEN'); whens.push({ c, v: expr() }); }
      const otherwise = isKw('ELSE') ? (take(), expr()) : { k: 'lit', v: null };
      kw('END');
      return { k: 'case', subject, whens, otherwise };
    }
    if (t.t === 'id' && /^(exists|count)$/i.test(t.v) && isOp('{', 1)) {
      const which = take().v.toLowerCase(); take();
      if (isKw('MATCH')) take();
      const paths = patternList();
      const where = isKw('WHERE') ? (take(), expr()) : null;
      op('}');
      return { k: which === 'exists' ? 'exists' : 'countSub', paths, where };
    }
    if (t.t === 'id' && isOp('.', 1) && peek(2) && peek(2).t === 'id' && (isOp('(', 3) || isOp('.', 3))) throw cantRun(`the procedure or function ${t.v}.${peek(2).v}…`, q);
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
    throw cantRun(`${desc(t)} where an expression should be`, q);
  }

  function projection(isReturn) {
    const distinct = isKw('DISTINCT') ? (take(), true) : false;
    let star = false;
    const list = [];
    if (isOp('*')) { take(); star = true; }
    if (!star || isOp(',')) {
      do {
        if (list.length || star) { if (isOp(',')) take(); }
        const at = peek() ? peek().start : q.length;
        const e = expr();
        const until = toks[p - 1] ? toks[p - 1].end : q.length;
        let alias;
        if (isKw('AS')) { take(); alias = name(); } else if (e.k === 'var') alias = e.v; else if (e.k === 'prop' && e.e.k === 'var') alias = `${e.e.v}.${e.p}`;
        else if (isReturn) alias = q.slice(at, until).trim();
        else throw cantRun('a WITH item with no AS', q);
        list.push({ e, alias });
      } while (isOp(','));
    }
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
    return { distinct, star, list, order, skip, limit };
  }

  function setItems() {
    const items = [];
    do {
      if (items.length) take();
      const v = name();
      if (isOp(':')) {
        const labels = labelList().map((alts) => { if (alts.length > 1) throw cantRun('a label alternative in SET', q); return alts[0]; });
        items.push({ k: 'labels', v, labels });
      } else if (isOp('.')) {
        take(); const prop = name(); op('='); items.push({ k: 'prop', v, prop, e: expr() });
      } else if (isOp('+=')) {
        take(); items.push({ k: 'merge', v, e: expr() });
      } else if (isOp('=')) {
        take(); items.push({ k: 'replace', v, e: expr() });
      } else if (isOp('[')) {
        take(); const ke = expr(); op(']'); op('='); items.push({ k: 'dynprop', v, ke, e: expr() });
      } else throw cantRun(`a SET item it can't read after ${v}`, q);
    } while (isOp(','));
    return items;
  }
  function removeItems() {
    const items = [];
    do {
      if (items.length) take();
      const v = name();
      if (isOp(':')) items.push({ k: 'labels', v, labels: labelList().map((alts) => alts[0]) });
      else if (isOp('.')) { take(); items.push({ k: 'prop', v, prop: name() }); } else throw cantRun(`a REMOVE item it can't read after ${v}`, q);
    } while (isOp(','));
    return items;
  }
  function exprList() { const xs = [expr()]; while (isOp(',')) { take(); xs.push(expr()); } return xs; }

  function clause(inForeach) {
    if (!inForeach && (isKw('OPTIONAL') || isKw('MATCH'))) {
      const optional = isKw('OPTIONAL') ? (take(), true) : false;
      kw('MATCH');
      const paths = patternList();
      const where = isKw('WHERE') ? (take(), expr()) : null;
      return { k: 'match', optional, paths, where };
    }
    if (!inForeach && isKw('UNWIND')) { take(); const e = expr(); kw('AS'); return { k: 'unwind', e, v: name() }; }
    if (!inForeach && isKw('WITH')) { take(); const proj = projection(false); const where = isKw('WHERE') ? (take(), expr()) : null; return { k: 'with', proj, where }; }
    if (!inForeach && isKw('RETURN')) { take(); return { k: 'return', proj: projection(true) }; }
    if (isKw('CREATE')) { take(); return { k: 'create', paths: patternList() }; }
    if (isKw('MERGE')) {
      take();
      const path = pathPattern();
      const onCreate = [], onMatch = [];
      while (isKw('ON')) {
        take();
        if (isKw('CREATE')) { take(); kw('SET'); onCreate.push(...setItems()); } else if (isKw('MATCH')) { take(); kw('SET'); onMatch.push(...setItems()); } else throw cantRun(`ON ${desc(peek())}`, q);
      }
      return { k: 'merge', path, onCreate, onMatch };
    }
    if (isKw('SET')) { take(); return { k: 'set', items: setItems() }; }
    if (isKw('REMOVE')) { take(); return { k: 'remove', items: removeItems() }; }
    if (isKw('DETACH')) { take(); kw('DELETE'); return { k: 'delete', detach: true, exprs: exprList() }; }
    if (isKw('DELETE')) { take(); return { k: 'delete', detach: false, exprs: exprList() }; }
    if (isKw('FOREACH')) {
      take(); op('(');
      const v = name(); kw('IN');
      const list = expr();
      op('|');
      const body = [];
      while (!isOp(')')) {
        if (!peek()) throw cantRun('a FOREACH with no end', q);
        if (!(peek().t === 'kw' && UPDATE_CLAUSES.includes(peek().v))) throw cantRun(`a ${desc(peek())} inside FOREACH`, q);
        body.push(clause(true));
      }
      op(')');
      return { k: 'foreach', v, list, body };
    }
    if (isKw('CALL')) throw cantRun('a CALL', q);
    if (isKw('UNION')) throw cantRun('UNION', q);
    throw cantRun(`a ${desc(peek())} clause`, q);
  }

  const clauses = [];
  while (p < toks.length) {
    const c = clause(false);
    clauses.push(c);
    if (c.k === 'return') { if (p < toks.length) throw cantRun(`${desc(peek())} after the RETURN`, q); break; }
  }
  if (!clauses.length) throw cantRun('an empty statement', q);
  const writes = (cs) => cs.some((c) => ['create', 'merge', 'set', 'remove', 'delete'].includes(c.k) || (c.k === 'foreach' && (c.body.length > 0)));
  return { clauses, writes: writes(clauses) };
}

// ── the graph, while a statement runs ──
const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };

class Graph {
  constructor(state, counters) {
    this.s = state;
    if (!Array.isArray(state.nodes)) state.nodes = [];
    if (!Array.isArray(state.rels)) state.rels = [];
    if (!Number.isInteger(state.nextEid)) state.nextEid = 1 + Math.max(0, ...state.nodes.map((x) => x.eid), ...state.rels.map((x) => x.eid));
    this.counters = counters;
    this.byEid = new Map();
    this.out = new Map();
    this.inc = new Map();
    this.nodeSet = new Set();
    this.relSet = new Set();
    this.gone = new Set();
    for (const x of state.nodes) { this.byEid.set(x.eid, x); this.nodeSet.add(x); }
    for (const r of state.rels) { this.relSet.add(r); push(this.out, r.from, r); push(this.inc, r.to, r); }
    this.index = new Map();
    this.touched = new Set();
  }
  isNode(x) { return !!x && typeof x === 'object' && (this.nodeSet.has(x) || (this.gone.has(x) && Array.isArray(x.labels))); }
  isRel(x) { return !!x && typeof x === 'object' && (this.relSet.has(x) || (this.gone.has(x) && typeof x.type === 'string')); }
  isEntity(x) { return this.isNode(x) || this.isRel(x); }
  live(x) { return this.nodeSet.has(x) || this.relSet.has(x); }
  props(x) {
    if (this.gone.has(x)) throw neoError('Neo.ClientError.Statement.EntityNotFound', `${this.isRel(x) ? 'Relationship' : 'Node'} with id ${x.eid} has been deleted in this transaction`);
    return x.props;
  }
  changed() { this.index.clear(); }
  addNode(labels, props) {
    const node = { eid: this.s.nextEid++, labels: [...new Set(labels)], props: {} };
    this.s.nodes.push(node);
    this.byEid.set(node.eid, node);
    this.nodeSet.add(node);
    this.counters.nodesCreated++;
    this.counters.labelsAdded += node.labels.length;
    for (const [k, v] of Object.entries(props)) this.setProp(node, k, v);
    this.touched.add(node);
    this.changed();
    return node;
  }
  addRel(type, from, to, props) {
    const rel = { eid: this.s.nextEid++, type, from: from.eid, to: to.eid, props: {} };
    this.s.rels.push(rel);
    this.relSet.add(rel);
    push(this.out, rel.from, rel);
    push(this.inc, rel.to, rel);
    this.counters.relationshipsCreated++;
    for (const [k, v] of Object.entries(props)) this.setProp(rel, k, v);
    return rel;
  }
  setProp(x, k, v) {
    this.props(x);
    if (v === null || v === undefined) {
      if (Object.prototype.hasOwnProperty.call(x.props, k)) { delete x.props[k]; this.counters.propertiesSet++; }
    } else {
      x.props[k] = storable(v, k);
      this.counters.propertiesSet++;
    }
    if (this.isNode(x)) this.touched.add(x);
    this.changed();
  }
  addLabel(x, l) { this.props(x); if (!x.labels.includes(l)) { x.labels.push(l); this.counters.labelsAdded++; this.touched.add(x); this.changed(); } }
  removeLabel(x, l) { this.props(x); const i = x.labels.indexOf(l); if (i >= 0) { x.labels.splice(i, 1); this.counters.labelsRemoved++; this.changed(); } }
  relsOf(node) { return [...(this.out.get(node.eid) || []), ...(this.inc.get(node.eid) || []).filter((r) => r.from !== r.to)]; }
  removeRel(r) {
    if (!this.relSet.has(r)) return;
    this.relSet.delete(r);
    this.gone.add(r);
    this.s.rels = this.s.rels.filter((x) => x !== r);
    this.out.set(r.from, (this.out.get(r.from) || []).filter((x) => x !== r));
    this.inc.set(r.to, (this.inc.get(r.to) || []).filter((x) => x !== r));
    this.counters.relationshipsDeleted++;
  }
  removeNode(node, detach) {
    if (!this.nodeSet.has(node)) return;
    if (detach) for (const r of this.relsOf(node)) this.removeRel(r);
    this.nodeSet.delete(node);
    this.gone.add(node);
    this.byEid.delete(node.eid);
    this.s.nodes = this.s.nodes.filter((x) => x !== node);
    this.counters.nodesDeleted++;
    this.changed();
  }
  /** Nodes whose `prop` equals `value` (plain), through an index made when first asked for. */
  byProp(prop, value) {
    if (!this.index.has(prop)) {
      const m = new Map();
      for (const x of this.s.nodes) {
        const v = plainValue(x.props[prop]);
        if (v === null || typeof v === 'object') continue;
        push(m, `${typeof v}:${v}`, x);
      }
      this.index.set(prop, m);
    }
    if (value === null || value === undefined || typeof value === 'object') return null;
    return this.index.get(prop).get(`${typeof value}:${value}`) || [];
  }
  /** The uniqueness rules over the nodes written since the last check. */
  checkConstraints() {
    const touched = [...this.touched].filter((x) => this.nodeSet.has(x));
    this.touched.clear();
    for (const x of touched) {
      for (const [label, prop] of CONSTRAINTS) {
        if (!x.labels.includes(label)) continue;
        const v = plainValue(x.props[prop]);
        if (v === null || v === undefined) continue;
        const same = (this.byProp(prop, v) || []).find((o) => o !== x && o.labels.includes(label));
        if (same) {
          throw neoError('Neo.ClientError.Schema.ConstraintValidationFailed', `Node(${same.eid}) already exists with label \`${label}\` and property \`${prop}\` = ${typeof v === 'string' ? `'${v}'` : v}`);
        }
      }
    }
  }
}

// ── evaluation, with Cypher's three-valued logic ──
function identity(x, g) {
  if (x === null || x === undefined) return 'null';
  if (g.isNode(x)) return `n#${x.eid}`;
  if (g.isRel(x)) return `r#${x.eid}`;
  if (Array.isArray(x)) return `[${x.map((y) => identity(y, g)).join(',')}]`;
  if (isMap(x)) return `{${Object.keys(x).sort().map((k) => `${k}:${identity(x[k], g)}`).join(',')}}`;
  return `${typeof num(x)}:${JSON.stringify(num(x))}`;
}
function equal(a, b, g) {
  a = num(a); b = num(b);
  if (a === null || a === undefined || b === null || b === undefined) return null;
  if (g.isEntity(a) || g.isEntity(b)) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    let unknown = false;
    for (let i = 0; i < a.length; i++) { const e = equal(a[i], b[i], g); if (e === false) return false; if (e === null) unknown = true; }
    return unknown ? null : true;
  }
  if (Array.isArray(a) || Array.isArray(b)) return false;
  if (isMap(a) && isMap(b)) {
    const ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (ka.join('|') !== kb.join('|')) return false;
    let unknown = false;
    for (const k of ka) { const e = equal(a[k], b[k], g); if (e === false) return false; if (e === null) unknown = true; }
    return unknown ? null : true;
  }
  if (typeof a !== typeof b) return false;
  return a === b;
}
function compare(o, a, b, g) {
  if (o === '=') return equal(a, b, g);
  if (o === '<>') { const e = equal(a, b, g); return e === null ? null : !e; }
  a = num(a); b = num(b);
  if (a === null || b === null || a === undefined || b === undefined) return null;
  if (typeof a !== typeof b || (typeof a !== 'string' && typeof a !== 'number')) return null;
  return o === '<' ? a < b : o === '>' ? a > b : o === '<=' ? a <= b : a >= b;
}
const ordering = (a, b) => { a = num(a); b = num(b); return a === b ? 0 : a === null || a === undefined ? 1 : b === null || b === undefined ? -1 : a < b ? -1 : 1; };

function evaluate(e, env, ctx) {
  const ev = (x) => evaluate(x, env, ctx);
  const { g } = ctx;
  switch (e.k) {
    case 'lit': return e.v;
    case 'param': if (!(e.v in ctx.params)) throw neoError('Neo.ClientError.Statement.ParameterMissing', `Expected parameter(s): ${e.v}`); return ctx.params[e.v] === undefined ? null : ctx.params[e.v];
    case 'list': return e.items.map(ev);
    case 'map': return Object.fromEntries(e.entries.map(([k, x]) => [k, ev(x)]));
    case 'var': if (!(e.v in env)) throw neoError('Neo.ClientError.Statement.SyntaxError', `Variable \`${e.v}\` not defined`); return env[e.v];
    case 'prop': {
      const x = ev(e.e);
      if (x === null || x === undefined) return null;
      if (g.isEntity(x)) return plainValue(g.props(x)[e.p]);
      if (isMap(x)) return x[e.p] === undefined ? null : x[e.p];
      throw neoError('Neo.ClientError.Statement.TypeError', `Type mismatch: expected a map, a node or a relationship to read .${e.p} from`);
    }
    case 'index': {
      const x = ev(e.e), i = num(ev(e.i));
      if (x === null || x === undefined || i === null || i === undefined) return null;
      if (g.isEntity(x)) return plainValue(g.props(x)[i]);
      if (Array.isArray(x)) { const j = i < 0 ? x.length + i : i; return j >= 0 && j < x.length ? x[j] : null; }
      if (typeof x === 'string') { const j = i < 0 ? x.length + i : i; return j >= 0 && j < x.length ? x[j] : null; }
      if (isMap(x)) return x[i] === undefined ? null : x[i];
      throw neoError('Neo.ClientError.Statement.TypeError', 'Type mismatch: [ ] on something that is not a list, a map or a node');
    }
    case 'slice': {
      const x = ev(e.e);
      if (x === null || x === undefined) return null;
      if (!Array.isArray(x) && typeof x !== 'string') throw neoError('Neo.ClientError.Statement.TypeError', 'Type mismatch: a slice of something that is not a list');
      const lo = e.lo ? num(ev(e.lo)) : 0, hi = e.hi ? num(ev(e.hi)) : x.length;
      if (lo === null || hi === null) return null;
      return x.slice(lo, hi);
    }
    case 'labels': { const x = ev(e.e); if (x === null || x === undefined) return null; if (!g.isNode(x)) throw neoError('Neo.ClientError.Statement.TypeError', 'a label test on something that is not a node'); return e.sets.every((alts) => alts.some((l) => x.labels.includes(l))); }
    case 'cmp': return compare(e.o, ev(e.l), ev(e.r), g);
    case 'regex': {
      const a = ev(e.l), b = ev(e.r);
      if (typeof a !== 'string' || typeof b !== 'string') return null;
      return new RegExp(`^(?:${b})$`).test(a);
    }
    case 'isnull': { const x = ev(e.e); const n = x === null || x === undefined; return e.neg ? !n : n; }
    case 'in': {
      const x = ev(e.l), list = ev(e.r);
      if (list === null || list === undefined) return null;
      if (!Array.isArray(list)) throw neoError('Neo.ClientError.Statement.TypeError', 'Type mismatch: IN expects a list');
      if (x === null || x === undefined) return list.length ? null : false;
      let unknown = false;
      for (const y of list) { const eq = equal(x, y, g); if (eq === true) return true; if (eq === null) unknown = true; }
      return unknown ? null : false;
    }
    case 'str': {
      const a = ev(e.l), b = ev(e.r);
      if (typeof a !== 'string' || typeof b !== 'string') return null;
      return e.o === 'STARTS' ? a.startsWith(b) : e.o === 'ENDS' ? a.endsWith(b) : a.includes(b);
    }
    case 'arith': {
      const a = num(ev(e.l)), b = num(ev(e.r));
      if (a === null || a === undefined || b === null || b === undefined) return null;
      if (e.o === '+') {
        if (Array.isArray(a) || Array.isArray(b)) return [...(Array.isArray(a) ? a : [a]), ...(Array.isArray(b) ? b : [b])];
        if (typeof a === 'string' || typeof b === 'string') return String(a) + String(b);
        if (typeof a === 'number' && typeof b === 'number') return a + b;
      } else if (typeof a === 'number' && typeof b === 'number') {
        if (e.o === '-') return a - b;
        if (e.o === '*') return a * b;
        if (e.o === '/') { if (b === 0 && Number.isInteger(a) && Number.isInteger(b)) throw neoError('Neo.ClientError.Statement.ArithmeticError', '/ by zero'); return Number.isInteger(a) && Number.isInteger(b) ? Math.trunc(a / b) : a / b; }
        if (e.o === '%') return a % b;
      }
      throw neoError('Neo.ClientError.Statement.TypeError', `Type mismatch: ${e.o} of ${typeof a} and ${typeof b}`);
    }
    case 'neg': { const x = num(ev(e.e)); if (x === null || x === undefined) return null; if (typeof x !== 'number') throw neoError('Neo.ClientError.Statement.TypeError', 'Type mismatch: - of something that is not a number'); return -x; }
    case 'not': { const x = ev(e.e); return x === null || x === undefined ? null : !x; }
    case 'and': { const a = ev(e.l), b = ev(e.r); if (a === false || b === false) return false; if (a === null || b === null) return null; return true; }
    case 'or': { const a = ev(e.l), b = ev(e.r); if (a === true || b === true) return true; if (a === null || b === null) return null; return false; }
    case 'xor': { const a = ev(e.l), b = ev(e.r); if (a === null || b === null) return null; return a !== b; }
    case 'case': {
      if (e.subject) { const s = ev(e.subject); for (const w of e.whens) if (equal(s, ev(w.c), g) === true) return ev(w.v); return ev(e.otherwise); }
      for (const w of e.whens) if (ev(w.c) === true) return ev(w.v);
      return ev(e.otherwise);
    }
    case 'comp': {
      const list = ev(e.list);
      if (list === null || list === undefined) return null;
      if (!Array.isArray(list)) throw neoError('Neo.ClientError.Statement.TypeError', 'Type mismatch: a list comprehension over something that is not a list');
      const out = [];
      for (const item of list) {
        const inner = { ...env, [e.v]: item };
        if (e.where && evaluate(e.where, inner, ctx) !== true) continue;
        out.push(e.proj ? evaluate(e.proj, inner, ctx) : item);
      }
      return out;
    }
    case 'patternPred': return matchPaths([e.path], env, ctx).length > 0;
    case 'patternComp': return matchPaths([e.path], env, ctx).filter((x) => !e.where || evaluate(e.where, x, ctx) === true).map((x) => evaluate(e.proj, x, ctx));
    case 'exists': return matchPaths(e.paths, env, ctx).some((x) => !e.where || evaluate(e.where, x, ctx) === true);
    case 'countSub': return matchPaths(e.paths, env, ctx).filter((x) => !e.where || evaluate(e.where, x, ctx) === true).length;
    case 'fn': return callFunction(e, e.args.map(ev), ctx);
    case 'agg': throw cantRun('an aggregate where Cypher reads none (outside a WITH or RETURN item)', ctx.q);
    default: throw cantRun(`an expression it can't read (${e.k})`, ctx.q);
  }
}

function callFunction(e, args, ctx) {
  const { g } = ctx;
  const x = args[0];
  const nil = x === null || x === undefined;
  const typeError = (what) => neoError('Neo.ClientError.Statement.TypeError', `Type mismatch: ${e.fn}() of ${what}`);
  switch (e.fn) {
    case 'coalesce': { const y = args.find((a) => a !== null && a !== undefined); return y === undefined ? null : y; }
    case 'keys':
      if (nil) return null;
      if (g.isEntity(x)) return Object.keys(g.props(x));
      if (isMap(x)) return Object.keys(x);
      throw typeError('something that is not a map, a node or a relationship');
    case 'head': if (nil) return null; if (!Array.isArray(x)) throw typeError('something that is not a list'); return x.length ? x[0] : null;
    case 'last': if (nil) return null; if (!Array.isArray(x)) throw typeError('something that is not a list'); return x.length ? x[x.length - 1] : null;
    case 'size': if (nil) return null; if (typeof x === 'string' || Array.isArray(x)) return x.length; throw typeError('something that is not a string or a list');
    case 'tostring': if (nil) return null; return typeof num(x) === 'object' ? JSON.stringify(x) : String(num(x));
    case 'tointeger': { if (nil) return null; const v = num(x); if (typeof v === 'number') return Math.trunc(v); if (typeof v === 'string') { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : null; } return null; }
    case 'tofloat': { if (nil) return null; const v = Number(num(x)); return Number.isFinite(v) ? v : null; }
    case 'tolower': if (nil) return null; if (typeof x !== 'string') throw typeError('something that is not a string'); return x.toLowerCase();
    case 'toupper': if (nil) return null; if (typeof x !== 'string') throw typeError('something that is not a string'); return x.toUpperCase();
    case 'trim': if (nil) return null; if (typeof x !== 'string') throw typeError('something that is not a string'); return x.trim();
    case 'split': if (nil || args[1] === null || args[1] === undefined) return null; return String(x).split(String(args[1]));
    case 'replace': if (nil || args[1] == null || args[2] == null) return null; return String(x).split(String(args[1])).join(String(args[2]));
    case 'substring': { if (nil) return null; const from = num(args[1]); const len = args[2] === undefined ? undefined : num(args[2]); return String(x).substr(from, len); }
    case 'labels': if (nil) return null; if (!g.isNode(x)) throw typeError('something that is not a node'); return [...x.labels];
    case 'type': if (nil) return null; if (!g.isRel(x)) throw typeError('something that is not a relationship'); return x.type;
    case 'elementid': if (nil) return null; if (!g.isEntity(x)) throw typeError('something that is not a node or a relationship'); return `5:00000000-0000-4000-8000-00000000fa4e:${x.eid}`;
    case 'properties': if (nil) return null; if (g.isEntity(x)) return { ...g.props(x) }; if (isMap(x)) return x; throw typeError('something that is not a map, a node or a relationship');
    case 'startnode': if (nil) return null; if (!g.isRel(x)) throw typeError('something that is not a relationship'); return g.byEid.get(x.from) || null;
    case 'endnode': if (nil) return null; if (!g.isRel(x)) throw typeError('something that is not a relationship'); return g.byEid.get(x.to) || null;
    case 'randomuuid': return crypto.randomUUID();
    case 'timestamp': return Date.now();
    case 'range': { const [a, b, s = 1] = args.map(num); const out = []; for (let i = a; s > 0 ? i <= b : i >= b; i += s) out.push(i); return out; }
    case 'reverse': if (nil) return null; if (typeof x === 'string') return [...x].reverse().join(''); if (Array.isArray(x)) return [...x].reverse(); throw typeError('something that is not a string or a list');
    case 'abs': if (nil) return null; return Math.abs(num(x));
    default: throw cantRun(`the function ${e.fn}()`, ctx.q);
  }
}

const hasAgg = (e) => !!e && typeof e === 'object' && (e.k === 'agg' || Object.values(e).some((x) => (Array.isArray(x) ? x.some(hasAgg) : x && typeof x === 'object' && hasAgg(x))));

function aggregate(a, rows, ctx) {
  if (a.star) return rows.length;
  let vals = rows.map((env) => evaluate(a.e, env, ctx)).filter((x) => x !== null && x !== undefined);
  if (a.distinct) { const seen = new Map(); for (const v of vals) if (!seen.has(identity(v, ctx.g))) seen.set(identity(v, ctx.g), v); vals = [...seen.values()]; }
  switch (a.fn) {
    case 'count': return vals.length;
    case 'collect': return vals;
    case 'sum': return vals.reduce((x, y) => x + num(y), 0);
    case 'avg': return vals.length ? vals.reduce((x, y) => x + num(y), 0) / vals.length : null;
    case 'min': return vals.length ? vals.reduce((m, y) => (ordering(y, m) < 0 ? y : m)) : null;
    case 'max': return vals.length ? vals.reduce((m, y) => (ordering(y, m) > 0 ? y : m)) : null;
    default: throw cantRun(`the aggregate ${a.fn}`, ctx.q);
  }
}
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
    else if (typeof v === 'number') throw neoError('Neo.ClientError.Statement.ArgumentError', `${what}: Invalid input. '${Number.isInteger(v) ? `${v}.0` : v}' is not a valid value. Must be a non-negative integer. (The driver sends a JavaScript number as a float, as Neo4j refuses here.)`);
    else n = v;
  } else throw cantRun(`a ${what} that is not a number or a parameter`, ctx.q);
  if (!Number.isInteger(n) || n < 0) throw neoError('Neo.ClientError.Statement.ArgumentError', `${what}: Invalid input. '${n}' is not a valid value. Must be a non-negative integer.`);
  return n;
}
function project(proj, rows, ctx) {
  const list = proj.star ? [...new Set(rows.flatMap((r) => Object.keys(r)))].map((v) => ({ e: { k: 'var', v }, alias: v })).concat(proj.list) : proj.list;
  const grouped = list.some((it) => hasAgg(it.e));
  let out;
  if (!grouped) {
    out = rows.map((env) => ({ env: Object.fromEntries(list.map((it) => [it.alias, evaluate(it.e, env, ctx)])), source: env }));
  } else {
    const keys = list.filter((it) => !hasAgg(it.e));
    const groups = new Map();
    for (const env of rows) {
      const kv = keys.map((it) => evaluate(it.e, env, ctx));
      const id = kv.map((x) => identity(x, ctx.g)).join('|');
      if (!groups.has(id)) groups.set(id, { kv, rows: [] });
      groups.get(id).rows.push(env);
    }
    if (!groups.size && !keys.length) groups.set('', { kv: [], rows: [] });
    out = [...groups.values()].map((grp) => {
      const keyEnv = grp.rows[0] || {};
      const env = {};
      let i = 0;
      for (const it of list) env[it.alias] = hasAgg(it.e) ? evaluateGrouped(it.e, grp.rows, ctx, keyEnv) : grp.kv[i++];
      return { env, source: keyEnv };
    });
  }
  if (proj.distinct) {
    const seen = new Set();
    out = out.filter((r) => { const id = Object.values(r.env).map((x) => identity(x, ctx.g)).join('|'); if (seen.has(id)) return false; seen.add(id); return true; });
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
const fitsLabels = (node, sets) => sets.every((alts) => alts.some((l) => node.labels.includes(l)));
function nodeFits(np, node, env, ctx) {
  if (!fitsLabels(node, np.labels)) return false;
  for (const [k, x] of np.map) if (equal(plainValue(node.props[k]), evaluate(x, env, ctx), ctx.g) !== true) return false;
  return true;
}
function relFits(rp, rel, env, ctx) {
  if (rp.types && !rp.types.includes(rel.type)) return false;
  for (const [k, x] of rp.map) if (equal(plainValue(rel.props[k]), evaluate(x, env, ctx), ctx.g) !== true) return false;
  return true;
}
function candidates(np, env, ctx) {
  const { g } = ctx;
  if (np.v && np.v in env) { const x = env[np.v]; return x && g.nodeSet.has(x) ? [x] : []; }
  for (const [k, x] of np.map) {
    const v = num(evaluate(x, env, ctx));
    if (v === null || v === undefined) return [];
    const hit = g.byProp(k, v);
    if (hit) return hit;
  }
  return g.s.nodes;
}
function reversedPath(path) {
  return { nodes: [...path.nodes].reverse(), rels: [...path.rels].reverse().map((r) => ({ ...r, dir: r.dir === 'out' ? 'in' : r.dir === 'in' ? 'out' : 'both' })) };
}
function oriented(path, env) {
  if (!path.rels.length) return path;
  const bound = (np) => !!np.v && np.v in env;
  return !bound(path.nodes[0]) && bound(path.nodes[path.nodes.length - 1]) ? reversedPath(path) : path;
}
function* steps(node, rp, used, env, ctx) {
  const { g } = ctx;
  const adj = (n) => {
    if (rp.dir === 'out') return (g.out.get(n.eid) || []).map((r) => [r, r.to]);
    if (rp.dir === 'in') return (g.inc.get(n.eid) || []).map((r) => [r, r.from]);
    return [...(g.out.get(n.eid) || []).map((r) => [r, r.to]), ...(g.inc.get(n.eid) || []).filter((r) => r.from !== r.to).map((r) => [r, r.from])];
  };
  function* dfs(n, path) {
    if (path.length >= rp.min) yield [n, path];
    if (path.length >= rp.max) return;
    for (const [r, farEid] of adj(n)) {
      if (used.has(r) || path.includes(r) || !relFits(rp, r, env, ctx)) continue;
      const m = g.byEid.get(farEid);
      if (m) yield* dfs(m, [...path, r]);
    }
  }
  yield* dfs(node, []);
}
function matchPaths(paths, env, ctx) {
  const out = [];
  const walkPath = (pi, e, used) => {
    if (pi === paths.length) { out.push(e); return; }
    const path = oriented(paths[pi], e);
    const bindNode = (np, node, cur) => {
      if (!nodeFits(np, node, cur, ctx)) return null;
      if (!np.v) return cur;
      if (np.v in cur) return cur[np.v] === node ? cur : null;
      return { ...cur, [np.v]: node };
    };
    const hop = (i, node, cur, usedHere) => {
      if (i === path.rels.length) { walkPath(pi + 1, cur, usedHere); return; }
      const rp = path.rels[i];
      for (const [m, rs] of steps(node, rp, usedHere, cur, ctx)) {
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

// ── writes ──
function mapOf(entries, env, ctx) { return Object.fromEntries(entries.map(([k, x]) => [k, evaluate(x, env, ctx)])); }
function missingNode(v, q) { return neoError('Neo.ClientError.Statement.SemanticError', `Failed to create relationship, node \`${v || 'anonymous'}\` is missing. If you prefer to simply ignore rows where a relationship node is missing, set 'cypher.lenient_create_relationship = true' in neo4j.conf (${oneLine(q).slice(0, 120)})`); }

/** CREATE one path for one row: its unbound nodes and every relationship; → the row with the new variables. */
function createPath(path, env, ctx) {
  const { g } = ctx;
  const cur = { ...env };
  const nodes = path.nodes.map((np) => {
    if (np.v && np.v in cur) {
      const x = cur[np.v];
      if (np.labels.length || np.map.length) throw neoError('Neo.ClientError.Statement.SyntaxError', `Can't create node \`${np.v}\` with labels or properties here. The variable is already declared in this context`);
      if (x === null || x === undefined) { if (path.rels.length) throw missingNode(np.v, ctx.q); return null; }
      if (!g.nodeSet.has(x)) throw neoError('Neo.ClientError.Statement.TypeError', `${np.v} is not a node`);
      return x;
    }
    const labels = np.labels.map((alts) => { if (alts.length > 1) throw cantRun('a label alternative in CREATE', ctx.q); return alts[0]; });
    const props = Object.fromEntries(Object.entries(mapOf(np.map, cur, ctx)).filter(([, v]) => v !== null && v !== undefined));
    const made = g.addNode(labels, props);
    if (np.v) cur[np.v] = made;
    return made;
  });
  path.rels.forEach((rp, i) => {
    if (!rp.types || rp.types.length !== 1) throw cantRun('a CREATE of a relationship that names no type, or more than one', ctx.q);
    if (rp.dir === 'both') throw cantRun('a CREATE of an undirected relationship', ctx.q);
    if (rp.min !== 1 || rp.max !== 1) throw cantRun('a CREATE of a variable-length relationship', ctx.q);
    const [a, b] = rp.dir === 'out' ? [nodes[i], nodes[i + 1]] : [nodes[i + 1], nodes[i]];
    if (!a || !b) throw missingNode(!a ? path.nodes[rp.dir === 'out' ? i : i + 1].v : path.nodes[rp.dir === 'out' ? i + 1 : i].v, ctx.q);
    if (rp.v && rp.v in cur) throw neoError('Neo.ClientError.Statement.SyntaxError', `Variable \`${rp.v}\` already declared`);
    const props = Object.fromEntries(Object.entries(mapOf(rp.map, cur, ctx)).filter(([, v]) => v !== null && v !== undefined));
    const rel = g.addRel(rp.types[0], a, b, props);
    if (rp.v) cur[rp.v] = rel;
  });
  return cur;
}

function applySet(items, env, ctx) {
  const { g } = ctx;
  for (const it of items) {
    const x = env[it.v];
    if (!(it.v in env)) throw neoError('Neo.ClientError.Statement.SyntaxError', `Variable \`${it.v}\` not defined`);
    if (x === null || x === undefined) continue;
    if (!g.isEntity(x)) throw neoError('Neo.ClientError.Statement.TypeError', `Type mismatch: SET on ${it.v}, which is not a node or a relationship`);
    if (it.k === 'labels') { if (!g.isNode(x)) throw neoError('Neo.ClientError.Statement.TypeError', 'a label on a relationship'); for (const l of it.labels) g.addLabel(x, l); continue; }
    if (it.k === 'prop') { g.setProp(x, it.prop, evaluate(it.e, env, ctx)); continue; }
    if (it.k === 'dynprop') { const k = evaluate(it.ke, env, ctx); if (typeof k !== 'string') throw neoError('Neo.ClientError.Statement.TypeError', 'a dynamic property name that is not a string'); g.setProp(x, k, evaluate(it.e, env, ctx)); continue; }
    let m = evaluate(it.e, env, ctx);
    if (g.isEntity(m)) m = { ...g.props(m) };
    if (m === null || m === undefined) m = {};
    if (!isMap(m)) throw neoError('Neo.ClientError.Statement.TypeError', `Type mismatch: SET ${it.v} ${it.k === 'merge' ? '+=' : '='} needs a map`);
    if (it.k === 'replace') for (const k of Object.keys(g.props(x))) if (!(k in m)) g.setProp(x, k, null);
    for (const [k, v] of Object.entries(m)) g.setProp(x, k, v);
  }
}

function runUpdate(c, rows, ctx) {
  const { g } = ctx;
  switch (c.k) {
    case 'create': {
      const out = rows.map((env) => { let cur = env; for (const path of c.paths) cur = createPath(path, cur, ctx); return cur; });
      g.checkConstraints();
      return out;
    }
    case 'merge': {
      const out = [];
      for (const env of rows) {
        for (const np of c.path.nodes) {
          if (np.v && np.v in env) continue;
          for (const [k, x] of np.map) {
            const v = evaluate(x, env, ctx);
            if (v === null || v === undefined) throw neoError('Neo.ClientError.Statement.SemanticError', `Cannot merge the following node because of null property value for '${k}': (${np.v || ''}${np.labels.map((a) => `:${a[0]}`).join('')} {${k}: null})`);
          }
        }
        for (const np of c.path.nodes) if (np.v && np.v in env && (env[np.v] === null || env[np.v] === undefined) && c.path.rels.length) throw missingNode(np.v, ctx.q);
        const found = matchPaths([c.path], env, ctx);
        if (found.length) {
          for (const f of found) { applySet(c.onMatch, f, ctx); out.push(f); }
        } else {
          for (const np of c.path.nodes) if (np.labels.some((alts) => alts.length > 1)) throw cantRun('a label alternative in MERGE', ctx.q);
          const made = createPath(c.path, env, ctx);
          applySet(c.onCreate, made, ctx);
          out.push(made);
        }
        g.checkConstraints();
      }
      return out;
    }
    case 'set': for (const env of rows) applySet(c.items, env, ctx); g.checkConstraints(); return rows;
    case 'remove':
      for (const env of rows) {
        for (const it of c.items) {
          const x = env[it.v];
          if (x === null || x === undefined) continue;
          if (it.k === 'labels') for (const l of it.labels) g.removeLabel(x, l); else g.setProp(x, it.prop, null);
        }
      }
      return rows;
    case 'delete':
      for (const env of rows) {
        for (const x of c.exprs.map((e) => evaluate(e, env, ctx))) {
          if (x === null || x === undefined) continue;
          if (g.nodeSet.has(x)) g.removeNode(x, c.detach);
          else if (g.relSet.has(x)) g.removeRel(x);
          else if (g.gone.has(x)) continue;
          else throw neoError('Neo.ClientError.Statement.TypeError', 'Type mismatch: DELETE of something that is not a node or a relationship');
        }
      }
      return rows;
    case 'foreach':
      for (const env of rows) {
        const list = evaluate(c.list, env, ctx);
        if (list === null || list === undefined) continue;
        if (!Array.isArray(list)) throw neoError('Neo.ClientError.Statement.TypeError', 'Type mismatch: FOREACH expects a list');
        for (const item of list) {
          let inner = [{ ...env, [c.v]: item }];
          for (const b of c.body) inner = runUpdate(b, inner, ctx);
        }
      }
      return rows;
    default: throw cantRun(`a ${c.k} where an update clause should be`, ctx.q);
  }
}

/** What toJS gives for a value. */
function toJs(x, g) {
  if (x === null || x === undefined) return null;
  if (g.isNode(x)) return { ...plainProps(x.props), _labels: [...x.labels] };
  if (g.isRel(x)) return { ...plainProps(x.props), _type: x.type };
  if (Array.isArray(x)) return x.map((y) => toJs(y, g));
  if (isStoredInt(x) || isNeoInt(x)) return num(x);
  return x;
}

const zero = () => ({ nodesCreated: 0, nodesDeleted: 0, relationshipsCreated: 0, relationshipsDeleted: 0, propertiesSet: 0, labelsAdded: 0, labelsRemoved: 0 });

/**
 * Run one statement over `state`, changing it in place; { rows, counters, writes }.
 * @param {object} state  { nodes, rels, nextEid }
 * @param {string} cypher
 * @param {object} params
 * @param {{ write?: boolean, atomic?: boolean }} opts  write false refuses a statement that writes, as a read must
 *   write nothing; atomic (the default) puts the state back as it was when the statement fails, as Neo4j rolls a failed
 *   statement back. test/helpers/cypherGraphFake.js passes false: it drops the whole transaction's copy instead.
 */
function run(state, cypher, params = {}, { write = true, atomic = true } = {}) {
  const q = String(cypher);
  const plan = parse(q);
  if (plan.writes && !write) throw new Error(`a read must write nothing; it sent: ${oneLine(q).slice(0, 300)}`);
  const last = plan.clauses[plan.clauses.length - 1];
  if (!plan.writes && last.k !== 'return') throw neoError('Neo.ClientError.Statement.SyntaxError', `Query cannot conclude with ${last.k.toUpperCase()} (must be a RETURN clause, a FINISH clause, an update clause, a unit subquery call, or a procedure call with no YIELD)`);
  if (!atomic || !plan.writes) return execute(state, plan, params, q);
  const before = JSON.stringify({ nodes: state.nodes || [], rels: state.rels || [], nextEid: state.nextEid });
  try {
    return execute(state, plan, params, q);
  } catch (e) {
    Object.assign(state, JSON.parse(before));
    throw e;
  }
}

function execute(state, plan, params, q) {
  const last = plan.clauses[plan.clauses.length - 1];
  const counters = zero();
  const g = new Graph(state, counters);
  const ctx = { g, params: params || {}, q };
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
    } else if (c.k === 'unwind') {
      const next = [];
      for (const env of rows) {
        const list = evaluate(c.e, env, ctx);
        if (list === null || list === undefined) continue;
        for (const item of Array.isArray(list) ? list : [list]) next.push({ ...env, [c.v]: item });
      }
      rows = next;
    } else if (c.k === 'with') {
      rows = project(c.proj, rows, ctx);
      if (c.where) rows = rows.filter((e) => evaluate(c.where, e, ctx) === true);
    } else if (c.k === 'return') {
      rows = project(c.proj, rows, ctx);
    } else {
      rows = runUpdate(c, rows, ctx);
    }
  }
  const out = last.k === 'return' ? rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, toJs(v, g)]))) : [];
  return { rows: out, counters, writes: plan.writes };
}

/** The relationships whose start or end node is gone: what Neo4j's commit refuses after a DELETE that wasn't DETACH. */
function danglingRels(state) {
  const live = new Set((state.nodes || []).map((x) => x.eid));
  return (state.rels || []).filter((r) => !live.has(r.from) || !live.has(r.to));
}

/** Whether a statement parses within the subset and writes. */
function writesOf(cypher) { return parse(String(cypher)).writes; }

module.exports = { run, parse, writesOf, danglingRels, isCantRun, CONSTRAINTS, PREFIX, plainValue, plainProps, isNeoInt, isStoredInt };
