'use strict';
/**
 * graph resolve — every node a ref names: a name, a slug, a nostr address or a tapestryKey, from a point of view
 * (catalog §1; story graph-operations-first-slice #9; ADR graph-operations-first-slice/0009 Decision 4). A read: it
 * opens no write transaction and writes nothing. It never picks a candidate: an ambiguous ref answers each one it names,
 * and a ref that names nothing answers an empty list.
 *
 * What a ref names is src/operations/resolve.js's (Decisions 1–3), which a later operation's input that takes a ref
 * resolves with too (Decision 5). Its paging and its point of view are the read conventions of src/operations/reads.js
 * (ADR graph-operations-first-slice/0011 Decision 1).
 */

const graph = require('../../graph');
const R = require('../../reads');
const RS = require('../../resolve');
const { KEY_PATTERN } = require('./_nodes');

const READ = 'graph resolve';
const KEY = new RegExp(KEY_PATTERN);

module.exports = {
  group: 'graph',
  name: 'resolve',
  kind: 'read',
  access: 'owner-and-admins',
  summary: 'The nodes a name, a slug, a nostr address or a tapestryKey names, from a point of view',
  description: [
    "Every node `ref` names. A ref is read by its shape. A tapestryKey names the node that has it. A nostr address (kind:pubkey:d-tag), an event's id, or the naddr, nevent or note of one names the node at it, and the replaceable node whose latest event it is. Anything else is a name, with its extra white space cleaned: it names every node whose name it is, without regard to case, and every concept whose plural it is. When it has a slug's shape, it is a slug too: it names every concept whose slug it is, and every concept-graph node (kind 39998 or 39999) whose d-tag it is. The answer's `readings` say how the ref was read.",
    '`kind=concept` keeps only concept headers, and `kind=set` only sets and supersets with an address. A change entry, an event\'s tag node and a node with no tapestryKey are never candidates.',
    "Read from a point of view: the owner's by default. A node counts when it has no author, when its author is the instance's assistant or its owner, or when the owner's web of trust scores its author above the verified cutoff (GrapeRank's influence, above VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF). `pov=everyone` counts every author's. The answer says how many the point of view kept and left out, across the whole list, and it is `ambiguous` when more than one counts.",
    "It never picks one. Each candidate comes as { tapestryKey, name, address, author, own }, with its `kind` (concept, superset, set or node) and how the ref `matched` it, up to `limit` a page in tapestryKey order; a ref that names nothing answers an empty list. Pass the answer's `cursor` to get the next page; it is null on the last. To act on a candidate, pass its tapestryKey to the operation that needs it.",
  ].join('\n\n'),
  inputs: {
    ref: RS.REF_INPUT,
    kind: RS.KIND_INPUT,
    pov: R.POV_INPUT,
    limit: R.LIMIT_INPUT,
    cursor: R.CURSOR_INPUT,
  },
  result: {
    description: 'What the ref names: how it was read, the point of view, whether it is ambiguous, how many were kept and left out, a page of the candidates, and the cursor for the next page (null on the last)',
    schema: {
      type: 'object',
      required: ['ref', 'readings', 'kind', 'pov', 'ambiguous', 'kept', 'leftOut', 'candidates', 'cursor'],
      properties: {
        ref: { type: 'string', description: 'The ref as given, trimmed' },
        readings: { type: 'array', items: RS.READING, description: 'How the ref was read: what it was looked up as' },
        kind: { type: 'string', nullable: true, description: 'The kind asked for, concept or set; null for any node' },
        pov: R.POV,
        ambiguous: { type: 'boolean', description: 'Whether more than one candidate counts, across the whole list' },
        kept: { type: 'integer', minimum: 0, description: 'How many candidates the point of view kept, across the whole list' },
        leftOut: { type: 'integer', minimum: 0, description: 'How many it left out, across the whole list' },
        candidates: { type: 'array', items: RS.CANDIDATE, description: 'This page of the candidates, in tapestryKey order' },
        cursor: { type: 'string', nullable: true, description: 'Pass it as cursor for the next page; null on the last' },
      },
    },
  },
  refusals: [RS.BAD_REF, R.UNKNOWN_POV, R.INVALID_CURSOR],

  async run(inputs) {
    // The ref is read before anything is read from the graph, so a bad one is refused first (Decision 4, step 1).
    const readings = RS.readingsOf(inputs.ref, 'ref');
    const kind = inputs.kind || null;
    const limit = inputs.limit;
    if (!Number.isInteger(limit) || limit < 1) throw new Error(`graph resolve's limit must be a whole number from 1; got ${JSON.stringify(limit)}`);
    const read = (cypher, params) => graph.read(cypher, params);
    const pov = await R.resolvePov(read, inputs.pov);
    // The readings, not the ref: an naddr and the address it decodes to page the same list.
    const scope = R.scopeOf([readings.readings, kind, pov.name]);
    const after = inputs.cursor ? R.decodeCursor(READ, scope, inputs.cursor, (p) => typeof p === 'string' && KEY.test(p)) : null;
    const { seen, kept, rows } = await RS.candidatesOf(read, readings, { kind, pov, after, limit });
    const page = R.pageOf(rows, limit, (last) => R.encodeCursor(READ, scope, last.tapestryKey));
    return {
      ref: inputs.ref.trim(),
      readings: readings.readings,
      kind,
      pov: { name: pov.name, observer: pov.observer, cutoff: pov.cutoff, scored: pov.scored },
      ambiguous: kept > 1,
      kept,
      leftOut: Math.max(0, seen - kept),
      candidates: page.items.map((r) => RS.candidateOf(r, pov.own)),
      cursor: page.cursor,
    };
  },
};
