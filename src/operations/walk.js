'use strict';
/**
 * The walk (story graph-operations-first-slice #14, ADR graph-operations-first-slice/0014 Decision 1): following chosen
 * relationship types out from one or more nodes, up to a depth, defined once, so graph walk answers it a page at a time
 * and graph search (A10.8) calls it from code (Decision 3).
 *
 * A walk takes one step at a time. A step is one directed statement for each direction asked for, out before in, from
 * every node the walk is at (the frontier) to the nodes it hasn't met: so each node is met first at its least number of
 * steps, and a walk never steps onto a node twice. A cycle, a relationship walked back and a node's relationship to
 * itself go no further. JavaScript keeps the walk's books: the nodes met, the relationship that reached each new one,
 * the counts and the bound.
 *
 * A relationship is answered as reads.js's C5, read from the node a step leaves, and judged as C6: a walk steps along a
 * relationship only to a node its point of view counts, a node it leaves out leads nowhere, and the start nodes are
 * never left out (ADR 0013, Decision 1). With no types, a walk passes tag nodes by and counts them. Of several
 * relationships that reach a new node at one step, it keeps out before in, then the least tapestryKey of the node it
 * came from, then the type, then the elementId: the same path each time the graph is the same.
 *
 * The bound counts the relationships a walk reads to nodes it hasn't met, those to tag nodes and to nodes left out
 * included. Each statement's LIMIT is the bound less what the walk has read, plus one, a checked whole number written
 * into the text (C1). A step whose statements would read past the bound is dropped whole, and the walk answers the steps
 * it finished, saying it stopped short.
 *
 * walk(read, { from, types, direction, depth, pov, bound, input }) → { from, reached, kept, leftOut, tagsLeftOut,
 * complete, finished, pathOf }:
 *   read      (cypher, params) → rows: graph.read, or a write's tx.read
 *   pov       a resolved point of view (reads.js's resolvePov)
 *   reached   every node reached, nearest first (by steps, then tapestryKey), as C3's five facts with depth and start;
 *             pathOf(tapestryKey) gives its path, the first step leaving its start
 * It throws an Error, never a refusal, for a call no operation's schema lets through, and refuses unknown-node, naming
 * `input`, for a start that names no node.
 *
 * It opens nothing at load (ADR graph-operations-foundation/0001 Decision 10).
 */

const R = require('./reads');
const { refusal } = require('./refusal');
const { KEY_PATTERN, TYPE_PATTERN } = require('./catalog/graph/_nodes');

const KEY = new RegExp(KEY_PATTERN);
const TYPE = new RegExp(TYPE_PATTERN);
const DIRECTIONS = Object.freeze(['out', 'in', 'both']);

/** How many start nodes and types a walk takes, how many steps it goes, and how many relationships it reads at most. */
const MAX_FROM = 100;
const MAX_TYPES = 50;
const MAX_DEPTH = 10;
const BOUND = 10000;

// ── the inputs, which graph walk declares and search can take ──

const FROM_INPUT = {
  schema: { type: 'array', items: { type: 'string', pattern: KEY_PATTERN }, minItems: 1, maxItems: MAX_FROM },
  required: true,
  description: `The tapestryKeys of the nodes to walk from, 1 to ${MAX_FROM}, one value for each (from=<key>&from=<key>, or --from <key> --from <key>)`,
};
const TYPES_INPUT = {
  schema: { type: 'array', items: { type: 'string', pattern: TYPE_PATTERN }, minItems: 1, maxItems: MAX_TYPES },
  description: `The relationship types to step along, 1 to ${MAX_TYPES}, one value for each, each a plain name (letters, digits and underscores, starting with a letter), declared or not; leave it out to step along every type, tag nodes aside`,
};
const DIRECTION_INPUT = {
  schema: { type: 'string', enum: [...DIRECTIONS], default: 'both' },
  description: 'out: step only along relationships that run from the node the walk is at; in: only along those that run to it; both (the default)',
};
const DEPTH_INPUT = {
  schema: { type: 'integer', minimum: 1, maximum: MAX_DEPTH, default: 1 },
  description: `How many steps the walk goes at most, 1 to ${MAX_DEPTH} (1 by default)`,
};

/** A node the walk reached, as graph walk answers one: C3's five facts, then its depth, its start and its path. */
const REACHED = {
  type: 'object',
  required: [...R.NODE.required, 'depth', 'start', 'path'],
  description: 'A node the walk reached: its five facts, how many steps it is from the nearest start node, and the path that reached it',
  properties: {
    ...R.NODE.properties,
    depth: { type: 'integer', minimum: 1, description: 'How many steps it is from the nearest start node: the length of its path' },
    start: { type: 'string', description: 'The tapestryKey of the start node its path sets out from' },
    path: { type: 'array', items: R.RELATIONSHIP, description: 'The steps that reached it, in order, each a relationship read from the node it leaves: the first leaves start, and the last reaches this node' },
  },
};

const UNKNOWN_NODE = Object.freeze({ code: 'unknown-node', status: 404, when: 'A from that names no node of the graph (a change entry is not one); the refusal names from, and its message each key that names none' });

// ── the statements ──

/** S1, the start nodes: no relationship. */
const START_NODES = `MATCH (n:TapestryNode)
     WHERE n.tapestryKey IN $starts AND NOT n:GraphChange
     RETURN ${R.nodeColumns('n')}`;

/** S2, one step in one direction, with the types in backticks when given. Nothing else comes from input. */
function stepStatement(direction, types, limit) {
  if (direction !== 'out' && direction !== 'in') throw new Error(`walk: a step runs out or in; got ${JSON.stringify(direction)}`);
  if (types !== null && !types.every((t) => TYPE.test(t))) throw new Error(`walk: ${JSON.stringify(types)} are not relationship types`);
  if (!Number.isInteger(limit) || limit < 1) throw new Error(`walk: a step's LIMIT is a whole number from 1; got ${JSON.stringify(limit)}`);
  const rel = types === null ? '[r]' : `[r:${types.map((t) => `\`${t}\``).join('|')}]`;
  const opening = direction === 'out' ? `MATCH (x:TapestryNode)-${rel}->(m)` : `MATCH (x:TapestryNode)<-${rel}-(m)`;
  return `${opening}
     WHERE x.tapestryKey IN $frontier
       AND NOT m:GraphChange AND m.tapestryKey IS NOT NULL AND m.tapestryKey <> '{}'
       AND NOT m.tapestryKey IN $known
     WITH x, r, m, (NOT $tags AND m:NostrEventTag) AS hidden
     ${R.trust('m', ['x', 'r', 'hidden'])}
     RETURN x.tapestryKey AS parent, ${R.relationshipColumns('r', 'm')}, hidden, counts
     LIMIT ${limit}`;
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
/** Of two rows that reach one node in one direction: the lesser parent, then type, then elementId. */
const before = (a, b) => (cmp(a.parent, b.parent) || cmp(a.type, b.type) || cmp(a.rid, b.rid)) < 0;
/** 'X', 'X and Y', or 'X, Y and Z'. */
const listed = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

/** The walk: see the header. */
async function walk(read, { from, types = null, direction = 'both', depth = 1, pov, bound = BOUND, input = 'from' } = {}) {
  if (typeof read !== 'function') throw new Error('walk: read is a function (cypher, params) → rows');
  if (!Array.isArray(from) || from.length < 1 || from.length > MAX_FROM || !from.every((k) => typeof k === 'string' && KEY.test(k))) {
    throw new Error(`walk: from is a list of 1 to ${MAX_FROM} tapestryKeys; got ${JSON.stringify(from)}`);
  }
  if (types !== null && (!Array.isArray(types) || types.length < 1 || types.length > MAX_TYPES || !types.every((t) => typeof t === 'string' && TYPE.test(t)))) {
    throw new Error(`walk: types is null or a list of 1 to ${MAX_TYPES} relationship types; got ${JSON.stringify(types)}`);
  }
  if (!DIRECTIONS.includes(direction)) throw new Error(`walk: direction is out, in or both; got ${JSON.stringify(direction)}`);
  if (!Number.isInteger(depth) || depth < 1 || depth > MAX_DEPTH) throw new Error(`walk: depth is a whole number from 1 to ${MAX_DEPTH}; got ${JSON.stringify(depth)}`);
  if (!Number.isInteger(bound) || bound < 1) throw new Error(`walk: bound is a whole number from 1; got ${JSON.stringify(bound)}`);
  if (!pov || typeof pov !== 'object' || typeof pov.name !== 'string') throw new Error('walk: pov is a resolved point of view (reads.js resolvePov)');

  const starts = [...new Set(from)];
  const typeList = types === null ? null : [...new Set(types)].sort();

  const found = await read(START_NODES, { starts });
  const startRow = new Map((Array.isArray(found) ? found : []).map((row) => [row.tapestryKey, row]));
  const missing = starts.filter((k) => !startRow.has(k));
  if (missing.length) {
    throw refusal(UNKNOWN_NODE.code, `No node of this graph has the tapestryKey${missing.length > 1 ? 's' : ''} ${listed(missing)}, which ${input} names.`, { input });
  }

  const own = pov.own;
  const params = { tags: typeList !== null, ...R.trustParams(pov) };
  const dirs = direction === 'both' ? ['out', 'in'] : [direction];
  const met = new Set(starts); // every node met: the start nodes, the nodes reached, those left out, the tag nodes passed by
  const reachedBy = new Map(); // tapestryKey → { row, parent, direction, depth }
  let frontier = starts;
  let readSoFar = 0;
  let leftOut = 0;
  let tagsLeftOut = 0;
  let complete = true;
  let finished = depth;

  for (let step = 1; step <= depth && frontier.length > 0; step++) {
    const reachedNow = new Map();
    const leftNow = new Set();
    const passedNow = new Set();
    let rowsNow = 0;
    let over = false;
    for (const d of dirs) {
      const limit = bound - readSoFar - rowsNow + 1;
      const known = [...met, ...reachedNow.keys(), ...leftNow, ...passedNow];
      const rows = await read(stepStatement(d, typeList, limit), { ...params, frontier, known });
      if (rows.length >= limit) { over = true; break; }
      rowsNow += rows.length;
      const best = new Map();
      for (const row of rows) {
        if (row.hidden) { passedNow.add(row.tapestryKey); continue; }
        if (!row.counts) { leftNow.add(row.tapestryKey); continue; }
        const was = best.get(row.tapestryKey);
        if (!was || before(row, was)) best.set(row.tapestryKey, row);
      }
      // The outgoing statement runs first, and the incoming one leaves out what it met: out before in.
      for (const [key, row] of best) reachedNow.set(key, { row, parent: row.parent, direction: d, depth: step });
    }
    if (over) { complete = false; finished = step - 1; break; }
    readSoFar += rowsNow;
    leftOut += leftNow.size;
    tagsLeftOut += passedNow.size;
    for (const key of leftNow) met.add(key);
    for (const key of passedNow) met.add(key);
    for (const [key, entry] of reachedNow) { met.add(key); reachedBy.set(key, entry); }
    frontier = [...reachedNow.keys()];
  }

  const startOf = (key) => { let k = key; while (reachedBy.has(k)) k = reachedBy.get(k).parent; return k; };
  const order = [...reachedBy.keys()].sort((a, b) => (reachedBy.get(a).depth - reachedBy.get(b).depth) || cmp(a, b));
  const reached = order.map((key) => {
    const e = reachedBy.get(key);
    return { ...R.nodeOf(e.row, own), depth: e.depth, start: startOf(key) };
  });
  /** A reached node's path, its first step leaving its start node; [] for a key the walk didn't reach. */
  function pathOf(key) {
    const steps = [];
    for (let k = key; reachedBy.has(k); k = reachedBy.get(k).parent) {
      const e = reachedBy.get(k);
      steps.push(R.relationshipOf(e.row, { key: e.parent, direction: e.direction, own }));
    }
    return steps.reverse();
  }
  return {
    from: starts.map((k) => R.nodeOf(startRow.get(k), own)),
    reached,
    kept: reached.length,
    leftOut,
    tagsLeftOut,
    complete,
    finished,
    pathOf,
  };
}

module.exports = {
  FROM_INPUT, TYPES_INPUT, DIRECTION_INPUT, DEPTH_INPUT,
  MAX_FROM, MAX_TYPES, MAX_DEPTH, BOUND,
  REACHED, UNKNOWN_NODE,
  walk,
};
