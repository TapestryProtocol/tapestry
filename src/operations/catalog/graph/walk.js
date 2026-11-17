'use strict';
/**
 * graph walk — follow chosen relationship types out from one or more nodes, up to a depth (catalog §1; story
 * graph-operations-first-slice #14; ADR graph-operations-first-slice/0014 Decision 2). A read: it opens no write
 * transaction and writes nothing. The walk itself is src/operations/walk.js's (Decision 1), which graph search (A10.8)
 * calls too; this file pages it. Its paging and its point of view are the read conventions of src/operations/reads.js
 * (C1, C2); a node is answered as C3, and each step of a path as C5, judged as C6.
 *
 * Every page walks again from the start, since the counts are across the whole walk and nothing is stored; the bound
 * caps what one walk reads. The nodes reached come nearest first, by steps and then by tapestryKey: the one read whose
 * order can change for a node, since a change between pages that brings a node nearer, or takes it further away, can
 * move it (ADR graph-operations-first-slice/0011, Amendment 4). A cursor's position is [steps, tapestryKey], the last
 * node of a page. Its scope takes from sorted, since the walk doesn't depend on the order it was given in.
 */

const graph = require('../../graph');
const R = require('../../reads');
const W = require('../../walk');
const { KEY_PATTERN } = require('./_nodes');

const READ = 'graph walk';
const KEY = new RegExp(KEY_PATTERN);
const DIRECTIONS = ['out', 'in', 'both'];
/** 10000 → '10,000', with no locale data. */
const grouped = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

module.exports = {
  group: 'graph',
  name: 'walk',
  kind: 'read',
  access: 'owner-and-admins',
  summary: 'Follow chosen relationship types out from one or more nodes, up to a depth: each node reached once, with the path that reached it',
  description: [
    `Walk out from one or more nodes (\`from\`, their tapestryKeys, up to ${W.MAX_FROM}, one value for each) along the relationship types \`types\` names (up to ${W.MAX_TYPES}, declared or not), or along every type when it is left out, up to \`depth\` steps (1 to ${W.MAX_DEPTH}, 1 by default). \`direction\` is \`out\` (only relationships that run from the node the walk is at), \`in\` (only those that run to it) or \`both\`, the default, for the whole walk.`,
    'Each node the walk reaches comes once, as { tapestryKey, name, address, author, own, depth, start, path }: its five facts; how many steps it is from the nearest start node; the start node its path sets out from; and the path, one shortest path, each step a relationship as list-relationships answers one ({ type, direction, from, to, node, properties }), read from the node the step leaves. Of several paths as short, the walk takes the same one each time the graph is the same. It never steps onto a node it has met, so a cycle, a relationship walked back or a node\'s relationship to itself goes no further, and a start node is never answered as reached.',
    "Walked from a point of view: the owner's by default. No relationship records its author, so a walk steps along a relationship only to a node that counts: one with no author, one by the instance's assistant or its owner, or one whose author the owner's web of trust scores above the verified cutoff (GrapeRank's influence, above VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF). A node that doesn't count is neither answered nor walked through. The start nodes are never left out. `pov=everyone` steps onto every node. The answer says how many nodes the walk reached (kept) and left out, across the whole walk.",
    'With no types, the walk doesn\'t step onto tag nodes (a node has one for each tag of its letter) and counts them as tagsLeftOut. With types, it steps wherever they lead: HAS_TAG leads to tag nodes.',
    `A walk reads at most ${grouped(W.BOUND)} relationships to nodes it hasn't met yet, those to tag nodes and to nodes left out included; it passes over relationships back to nodes it has met without counting them. When its next step would read more, it answers the steps it finished and says so: complete is false, and finished is how many steps it finished. Narrow it with types, a direction, a smaller depth or the owner's point of view; graph list-relationships pages through one node's relationships however many it has.`,
    'Up to `limit` nodes a page, nearest first: by steps, then by tapestryKey. Pass the answer\'s `cursor` to get the next page; it is null on the last. Every page walks again, so a change to the graph between pages that brings a node nearer, or takes it further away, can move that node.',
  ].join('\n\n'),
  inputs: {
    from: W.FROM_INPUT,
    types: W.TYPES_INPUT,
    direction: W.DIRECTION_INPUT,
    depth: W.DEPTH_INPUT,
    pov: R.POV_INPUT,
    limit: R.LIMIT_INPUT,
    cursor: R.CURSOR_INPUT,
  },
  result: {
    description: 'The start nodes, a page of the nodes reached, nearest first, each with its path, what was walked by, what the walk kept, left out and passed by, whether it finished, and the cursor for the next page (null on the last)',
    schema: {
      type: 'object',
      required: ['from', 'types', 'direction', 'depth', 'pov', 'kept', 'leftOut', 'tagsLeftOut', 'complete', 'finished', 'nodes', 'cursor'],
      properties: {
        from: { type: 'array', items: R.NODE, description: 'The start nodes, in the order given, each once' },
        types: { type: 'array', items: { type: 'string' }, nullable: true, description: 'The types walked by, sorted, each once; null for every type' },
        direction: { type: 'string', enum: DIRECTIONS, description: 'The direction walked: out, in or both' },
        depth: { type: 'integer', minimum: 1, description: 'The most steps asked for' },
        pov: R.POV,
        kept: { type: 'integer', minimum: 0, description: 'How many nodes the walk reached, across the whole walk' },
        leftOut: { type: 'integer', minimum: 0, description: "How many nodes it didn't step onto because the point of view doesn't count them; nothing beyond them is met or counted" },
        tagsLeftOut: { type: 'integer', minimum: 0, description: "How many tag nodes it didn't step onto because no types were given; 0 with types" },
        complete: { type: 'boolean', description: `false when the walk stopped short at its bound: its next step would have read more than ${grouped(W.BOUND)} relationships to nodes it hadn't met` },
        finished: { type: 'integer', minimum: 0, description: 'How many steps it finished: depth when complete' },
        nodes: { type: 'array', items: W.REACHED, description: 'This page of the nodes reached, nearest first: by steps, then by tapestryKey' },
        cursor: { type: 'string', nullable: true, description: 'Pass it as cursor for the next page; null on the last' },
      },
    },
  },
  refusals: [W.UNKNOWN_NODE, R.UNKNOWN_POV, R.INVALID_CURSOR],

  async run(inputs) {
    const limit = inputs.limit;
    const depth = inputs.depth;
    if (!Number.isInteger(limit) || limit < 1) throw new Error(`graph walk's limit must be a whole number from 1; got ${JSON.stringify(limit)}`);
    if (!Number.isInteger(depth) || depth < 1 || depth > W.MAX_DEPTH) throw new Error(`graph walk's depth must be a whole number from 1 to ${W.MAX_DEPTH}; got ${JSON.stringify(depth)}`);
    const from = [...new Set(inputs.from)];
    const types = inputs.types === undefined || inputs.types === null ? null : [...new Set(inputs.types)].sort();
    const direction = inputs.direction === undefined || inputs.direction === null ? 'both' : inputs.direction;
    const read = (cypher, params) => graph.read(cypher, params);
    const pov = await R.resolvePov(read, inputs.pov);
    const scope = R.scopeOf([[...from].sort(), types, direction, depth, pov.name]);
    // A position is [steps, tapestryKey]: the last node of a page.
    const isPosition = (p) => Array.isArray(p) && p.length === 2
      && Number.isInteger(p[0]) && p[0] >= 1 && p[0] <= depth
      && typeof p[1] === 'string' && KEY.test(p[1]);
    const after = inputs.cursor ? R.decodeCursor(READ, scope, inputs.cursor, isPosition) : null;

    const walked = await W.walk(read, { from, types, direction, depth, pov });
    const rest = after
      ? walked.reached.filter((n) => n.depth > after[0] || (n.depth === after[0] && n.tapestryKey > after[1]))
      : walked.reached;
    const page = R.pageOf(rest, limit, (last) => R.encodeCursor(READ, scope, [last.depth, last.tapestryKey]));

    return {
      from: walked.from,
      types,
      direction,
      depth,
      pov: { name: pov.name, observer: pov.observer, cutoff: pov.cutoff, scored: pov.scored },
      kept: walked.kept,
      leftOut: walked.leftOut,
      tagsLeftOut: walked.tagsLeftOut,
      complete: walked.complete,
      finished: walked.finished,
      nodes: page.items.map((n) => ({ ...n, path: walked.pathOf(n.tapestryKey) })),
      cursor: page.cursor,
    };
  },
};
