'use strict';
/**
 * graph list-relationships — a node's typed relationships, in and out, each with the way it points (catalog §1; story
 * graph-operations-first-slice #13; ADR graph-operations-first-slice/0013 Decision 2). A read: it opens no write
 * transaction and writes nothing. Its paging and its point of view are the read conventions of src/operations/reads.js
 * (C1, C2); the node it lists is answered as C3, and each relationship is answered as C5 and judged as C6 (Decision 1).
 *
 * Each direction is read in statements of its own, outgoing as (x)-[r]->(m) and incoming as (x)<-[r]-(m), so a
 * relationship's direction comes from the statement that found it. Pages run the outgoing relationships first, then the
 * incoming; within each, by type, then the other node's tapestryKey, then the relationship's elementId, which tells
 * parallel relationships apart and stays inside the cursor. A relationship from the node to itself is answered once:
 * as out, unless only in is asked for. With no type, relationships to tag nodes (NostrEventTag) are left out and counted
 * as tagsLeftOut; with one, they are listed. A type reaches Cypher's text only after TYPE_PATTERN, in backticks (ADR
 * graph-operations-foundation/0004 Decision 6); nothing else from input does.
 */

const graph = require('../../graph');
const R = require('../../reads');
const { refusal } = require('../../refusal');
const { KEY_PATTERN, TYPE_PATTERN, keyInput } = require('./_nodes');

const READ = 'graph list-relationships';
const KEY = new RegExp(KEY_PATTERN);
const TYPE = new RegExp(TYPE_PATTERN);
const DIRECTIONS = ['out', 'in', 'both'];

const UNKNOWN_NODE = Object.freeze({ code: 'unknown-node', status: 404, when: 'A node that names no node of the graph (a change entry is not one); the refusal names node' });

/** The opening MATCH for one direction, with the type in backticks when one is given. Nothing else comes from input. */
function patternOf(direction, type) {
  if (type !== null && !TYPE.test(type)) throw new Error(`graph list-relationships: ${JSON.stringify(type)} is not a relationship type`);
  const rel = type === null ? '[r]' : `[r:\`${type}\`]`;
  return direction === 'out'
    ? `MATCH (x:TapestryNode {tapestryKey: $key})-${rel}->(m)`
    : `MATCH (x:TapestryNode {tapestryKey: $key})<-${rel}-(m)`;
}

// F: the node at the other end is keyed, and not a change entry. $loops is false only for the incoming statement under
// both, which leaves out the node's relationships to itself: the outgoing statement has answered them.
const FILTER = `WHERE NOT m:GraphChange AND m.tapestryKey IS NOT NULL AND m.tapestryKey <> '{}'
       AND ($loops OR m.tapestryKey <> $key)`;

const asCount = (x) => (typeof x === 'number' ? x : x && typeof x.toNumber === 'function' ? x.toNumber() : Number(x) || 0);

module.exports = {
  group: 'graph',
  name: 'list-relationships',
  kind: 'read',
  access: 'owner-and-admins',
  summary: "A node's typed relationships, in and out, each with the way it points",
  description: [
    'The relationships of a node (`node`, its tapestryKey), one hop: every one that runs from it and every one that runs to it, of any type. `type` lists only that type\'s, whether the graph declares it or not. `direction` lists only those that run from the node (`out`) or only those that run to it (`in`); `both` is the default.',
    'Each relationship comes as { type, direction, from, to, node, properties }: its direction from the node asked about; the tapestryKeys of the nodes it runs from and to, which with its type are what graph remove-relationship takes; the node at its other end, as { tapestryKey, name, address, author, own }; and what it records about itself ({} for most). A relationship from the node to itself is listed once: as out, unless only in is asked for.',
    "Read from a point of view: the owner's by default. No relationship records its author, so a relationship counts when the node at its other end counts: when that node has no author, when its author is the instance's assistant or its owner, or when the owner's web of trust scores its author above the verified cutoff (GrapeRank's influence, above VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF). The node asked about is never left out. `pov=everyone` counts every relationship. The answer says how many the point of view kept and left out, across the whole list.",
    'With no type, relationships to tag nodes (a node has one for each tag of its letter) are left out, and the answer counts them as tagsLeftOut. With a type, such as HAS_TAG, they are listed.',
    "Up to `limit` a page: the outgoing relationships first, then the incoming, each by type, then by the other node's tapestryKey. Pass the answer's `cursor` to get the next page; it is null on the last.",
  ].join('\n\n'),
  inputs: {
    node: keyInput("The node's tapestryKey: list the relationships that run from it and to it"),
    type: { schema: { type: 'string', pattern: TYPE_PATTERN }, description: 'Only the relationships of this type: a plain name (letters, digits and underscores, starting with a letter), declared or not' },
    direction: { schema: { type: 'string', enum: DIRECTIONS, default: 'both' }, description: 'out: only those that run from the node; in: only those that run to it; both (the default)' },
    pov: R.POV_INPUT,
    limit: R.LIMIT_INPUT,
    cursor: R.CURSOR_INPUT,
  },
  result: {
    description: 'The node, a page of its relationships, what was listed, the point of view and what it kept and left out, and the cursor for the next page (null on the last)',
    schema: {
      type: 'object',
      required: ['node', 'type', 'direction', 'pov', 'kept', 'leftOut', 'tagsLeftOut', 'relationships', 'cursor'],
      properties: {
        node: R.NODE,
        type: { type: 'string', nullable: true, description: 'The type listed, or null for every type' },
        direction: { type: 'string', enum: DIRECTIONS, description: 'The direction listed: out, in or both' },
        pov: R.POV,
        kept: { type: 'integer', minimum: 0, description: 'How many relationships the point of view kept, across the whole list' },
        leftOut: { type: 'integer', minimum: 0, description: 'How many it left out, across the whole list' },
        tagsLeftOut: { type: 'integer', minimum: 0, description: 'How many relationships to tag nodes were left out because no type was given; 0 with a type' },
        relationships: { type: 'array', items: R.RELATIONSHIP, description: "This page of the relationships: the outgoing first, then the incoming, each by type, then by the other node's tapestryKey" },
        cursor: { type: 'string', nullable: true, description: 'Pass it as cursor for the next page; null on the last' },
      },
    },
  },
  refusals: [UNKNOWN_NODE, R.UNKNOWN_POV, R.INVALID_CURSOR],

  async run(inputs) {
    const key = inputs.node;
    const type = inputs.type === undefined || inputs.type === null ? null : inputs.type;
    const direction = inputs.direction === undefined || inputs.direction === null ? 'both' : inputs.direction;
    const limit = inputs.limit;
    if (!Number.isInteger(limit) || limit < 1) throw new Error(`graph list-relationships' limit must be a whole number from 1; got ${JSON.stringify(limit)}`);
    if (!DIRECTIONS.includes(direction)) throw new Error(`graph list-relationships' direction must be out, in or both; got ${JSON.stringify(direction)}`);
    const read = (cypher, params) => graph.read(cypher, params);
    const pov = await R.resolvePov(read, inputs.pov);
    const scope = R.scopeOf([key, type, direction, pov.name]);
    const dirs = direction === 'both' ? ['out', 'in'] : [direction];
    // A position is [direction, type, the other node's tapestryKey, elementId]: the last relationship of a page.
    const isPosition = (p) => Array.isArray(p) && p.length === 4
      && dirs.includes(p[0])
      && typeof p[1] === 'string' && TYPE.test(p[1]) && (type === null || p[1] === type)
      && typeof p[2] === 'string' && KEY.test(p[2])
      && typeof p[3] === 'string' && p[3].length > 0;
    const after = inputs.cursor ? R.decodeCursor(READ, scope, inputs.cursor, isPosition) : null;

    const found = await read(
      `MATCH (n:TapestryNode {tapestryKey: $key})
       WHERE NOT n:GraphChange
       RETURN ${R.nodeColumns('n')}`,
      { key },
    );
    if (!found.length) throw refusal(UNKNOWN_NODE.code, `No node of this graph has the tapestryKey ${key}, which node names.`, { input: 'node' });
    const node = R.nodeOf(found[0], pov.own);

    const trustParams = R.trustParams(pov);
    const tags = type !== null;
    const loopsFor = (d) => !(d === 'in' && direction === 'both');

    // S2, the counts, across the whole list: one statement for each direction asked for.
    let kept = 0;
    let seen = 0;
    let tagsLeftOut = 0;
    for (const d of dirs) {
      const counted = await read(
        `${patternOf(d, type)}
       ${FILTER}
       WITH r, m, (NOT $tags AND m:NostrEventTag) AS hidden
       ${R.trust('m', ['r', 'hidden'])}
       RETURN count(CASE WHEN hidden THEN 1 END) AS tags,
              count(CASE WHEN NOT hidden THEN 1 END) AS seen,
              count(CASE WHEN counts AND NOT hidden THEN 1 END) AS kept`,
        { key, loops: loopsFor(d), tags, ...trustParams },
      );
      if (counted.length) {
        tagsLeftOut += asCount(counted[0].tags);
        seen += asCount(counted[0].seen);
        kept += asCount(counted[0].kept);
      }
    }

    // S3, the page: out before in, from the cursor's position in its own direction and from the start in a later one.
    // Each LIMIT is the rows still wanted, a checked whole number written into the text (C1).
    const wanted = limit + 1;
    const rows = [];
    for (let i = after ? dirs.indexOf(after[0]) : 0; i < dirs.length && rows.length < wanted; i++) {
      const d = dirs[i];
      const from = after && after[0] === d ? after : null;
      const got = await read(
        `${patternOf(d, type)}
       ${FILTER}
         AND ($tags OR NOT m:NostrEventTag)
         AND ($afterType IS NULL OR type(r) > $afterType
              OR (type(r) = $afterType AND (m.tapestryKey > $afterKey
                  OR (m.tapestryKey = $afterKey AND elementId(r) > $afterRid))))
       ${R.trust('m', ['r'])}
       WHERE counts
       RETURN ${R.relationshipColumns('r', 'm')}
       ORDER BY type, tapestryKey, rid
       LIMIT ${wanted - rows.length}`,
        {
          key, loops: loopsFor(d), tags, ...trustParams,
          afterType: from ? from[1] : null, afterKey: from ? from[2] : null, afterRid: from ? from[3] : null,
        },
      );
      for (const row of got) rows.push({ row, direction: d });
    }
    const page = R.pageOf(rows, limit, (last) => R.encodeCursor(READ, scope, [last.direction, last.row.type, last.row.tapestryKey, last.row.rid]));

    return {
      node,
      type,
      direction,
      pov: { name: pov.name, observer: pov.observer, cutoff: pov.cutoff, scored: pov.scored },
      kept,
      leftOut: Math.max(0, seen - kept),
      tagsLeftOut,
      relationships: page.items.map(({ row, direction: d }) => R.relationshipOf(row, { key, direction: d, own: pov.own })),
      cursor: page.cursor,
    };
  },
};
