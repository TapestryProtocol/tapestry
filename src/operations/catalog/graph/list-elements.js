'use strict';
/**
 * graph list-elements — the elements of a concept or a set, through its class thread, from a point of view (catalog §1;
 * story graph-operations-first-slice #11; ADR graph-operations-first-slice/0011 Decision 2). A read: it opens no write
 * transaction and writes nothing. Its paging, its point of view and the shape of each element are the read conventions
 * of src/operations/reads.js (Decision 1), which every later read follows.
 *
 * A concept's elements are every node its class thread reaches: from its header through IS_THE_CONCEPT_FOR to its
 * superset, through IS_A_SUPERSET_OF to the sets below, and through HAS_ELEMENT to the elements, each once however many
 * paths reach it. A set's are its own and those of the sets below it. `direct` keeps only those directly under the
 * superset or the set. An implicit member (a node that only names the concept in a z tag) is listed once it is wired.
 */

const graph = require('../../graph');
const R = require('../../reads');
const { refusal } = require('../../refusal');
const { KEY_PATTERN } = require('./_nodes');

const READ = 'graph list-elements';
const KEY = new RegExp(KEY_PATTERN);

const CONCEPT_OR_SET = Object.freeze({ code: 'concept-or-set', status: 400, when: 'Neither concept nor set, or both: give one' });
const UNKNOWN_NODE = Object.freeze({ code: 'unknown-node', status: 404, when: 'A concept or set that names no node of the graph (a change entry is not one); the refusal names which' });
const NOT_A_CONCEPT = Object.freeze({ code: 'not-a-concept', status: 409, when: "A concept that isn't a concept header (a node labelled ConceptHeader, or ListHeader for one the nostr import brought in); for a set or a superset, the refusal says to pass it as set" });
const NOT_A_SET = Object.freeze({ code: 'not-a-set', status: 409, when: 'A set that is neither a set nor a superset; for a concept header, the refusal says to pass it as concept, and names its superset' });

/** The class thread's relationship types, as firmware names them (as _fields.js takes them). */
function types() {
  const { relAlias } = require('../../../api/normalize/firmware');
  return { INIT: relAlias('CLASS_THREAD_INITIATION'), PROP: relAlias('CLASS_THREAD_PROPAGATION'), TERM: relAlias('CLASS_THREAD_TERMINATION') };
}

/** The walk to `e`, from one of four fixed texts: a concept's or a set's, all or direct. Nothing comes from input. */
function walkOf(T, { fromConcept, direct }) {
  const down = direct ? '' : `-[:${T.PROP}*0..]->()`;
  return fromConcept
    ? `MATCH (h:TapestryNode {tapestryKey: $key})
     WHERE h:ConceptHeader OR h:ListHeader
     MATCH (h)-[:${T.INIT}]->(:Superset)${down}-[:${T.TERM}]->(e)`
    : `MATCH (s:TapestryNode {tapestryKey: $key})
     WHERE s:Set OR s:Superset
     MATCH (s)${down}-[:${T.TERM}]->(e)`;
}

const asCount = (x) => (typeof x === 'number' ? x : x && typeof x.toNumber === 'function' ? x.toNumber() : Number(x) || 0);

module.exports = {
  group: 'graph',
  name: 'list-elements',
  kind: 'read',
  access: 'owner-and-admins',
  summary: 'The elements of a concept or a set, through its class thread, from a point of view',
  description: [
    "The elements of a concept (`concept`, its header's tapestryKey): every node its class thread reaches, through its sets and the sets below them, each once. Or those of a set (`set`, a set's or a superset's tapestryKey): its own and those of the sets below it. With `direct`, only those directly under the superset or the set. A node that only names the concept in its z tag is listed once it is wired.",
    "Read from a point of view: the owner's by default. An element counts when it has no author, when its author is the instance's assistant or its owner, or when the owner's web of trust scores its author above the verified cutoff (GrapeRank's influence, above VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF). `pov=everyone` counts every author's claims. The answer says how many the point of view kept and left out, across the whole list.",
    'Each element comes as { tapestryKey, name, address, author, own }, up to `limit` a page in tapestryKey order. Pass the answer\'s `cursor` to get the next page; it is null on the last.',
  ].join('\n\n'),
  inputs: {
    concept: { schema: { type: 'string', pattern: KEY_PATTERN }, description: "A concept header's tapestryKey: list the concept's elements" },
    set: { schema: { type: 'string', pattern: KEY_PATTERN }, description: "A set's or a superset's tapestryKey: list its elements, and those of the sets below it" },
    direct: { schema: { type: 'boolean', default: false }, description: 'Only the elements directly under the superset or the set, not those in the sets below it' },
    pov: R.POV_INPUT,
    limit: R.LIMIT_INPUT,
    cursor: R.CURSOR_INPUT,
  },
  result: {
    description: 'A page of the elements, what was listed, the point of view and what it kept and left out, and the cursor for the next page (null on the last)',
    schema: {
      type: 'object',
      required: ['concept', 'set', 'direct', 'pov', 'kept', 'leftOut', 'elements', 'cursor'],
      properties: {
        concept: { type: 'string', nullable: true, description: 'The concept header listed, or null for a set' },
        set: { type: 'string', nullable: true, description: 'The set or superset listed, or null for a concept' },
        direct: { type: 'boolean', description: 'Whether only the direct elements were listed' },
        pov: R.POV,
        kept: { type: 'integer', minimum: 0, description: 'How many elements the point of view kept, across the whole list' },
        leftOut: { type: 'integer', minimum: 0, description: 'How many it left out, across the whole list' },
        elements: { type: 'array', items: R.NODE, description: 'This page of the elements, in tapestryKey order' },
        cursor: { type: 'string', nullable: true, description: 'Pass it as cursor for the next page; null on the last' },
      },
    },
  },
  refusals: [CONCEPT_OR_SET, UNKNOWN_NODE, NOT_A_CONCEPT, NOT_A_SET, R.UNKNOWN_POV, R.INVALID_CURSOR],

  async run(inputs) {
    const concept = inputs.concept || null;
    const set = inputs.set || null;
    const direct = inputs.direct === true;
    const limit = inputs.limit;
    if ((concept ? 1 : 0) + (set ? 1 : 0) !== 1) {
      throw refusal(CONCEPT_OR_SET.code, concept ? 'Give concept or set, not both.' : 'Give concept (a concept header\'s tapestryKey) or set (a set\'s or a superset\'s tapestryKey).');
    }
    if (!Number.isInteger(limit) || limit < 1) throw new Error(`graph list-elements' limit must be a whole number from 1; got ${JSON.stringify(limit)}`);
    const read = (cypher, params) => graph.read(cypher, params);
    const pov = await R.resolvePov(read, inputs.pov);
    const scope = R.scopeOf([concept, set, direct, pov.name]);
    const after = inputs.cursor ? R.decodeCursor(READ, scope, inputs.cursor, (p) => typeof p === 'string' && KEY.test(p)) : null;

    const key = concept || set;
    const input = concept ? 'concept' : 'set';
    const found = await read(
      `MATCH (n:TapestryNode {tapestryKey: $key})
       WHERE NOT n:GraphChange
       RETURN n.tapestryKey AS key, n:ConceptHeader OR n:ListHeader AS isHeader, n:Superset AS isSuperset, n:Set AS isSet`,
      { key },
    );
    if (!found.length) throw refusal(UNKNOWN_NODE.code, `No node of this graph has the tapestryKey ${key}, which ${input} names.`, { input });
    const node = found[0];
    const T = types();
    if (concept && !node.isHeader) {
      const kind = node.isSuperset ? 'a superset' : node.isSet ? 'a set' : null;
      throw refusal(NOT_A_CONCEPT.code, kind
        ? `${key} is ${kind}, not a concept header: pass it as set to list its elements.`
        : `${key} is not a concept header (a node labelled ConceptHeader, or ListHeader for one the nostr import brought in), so it has no elements to list.`, { input: 'concept' });
    }
    if (set && !(node.isSet || node.isSuperset)) {
      if (node.isHeader) {
        const sup = await read(
          `MATCH (h:TapestryNode {tapestryKey: $key})-[:${T.INIT}]->(s:Superset)
           RETURN s.tapestryKey AS key
           ORDER BY key
           LIMIT 1`,
          { key },
        );
        const supKey = sup.length && typeof sup[0].key === 'string' ? sup[0].key : null;
        throw refusal(NOT_A_SET.code, `${key} is a concept header, not a set: pass it as concept${supKey ? `, or pass its superset ${supKey} as set` : ''}.`, { input: 'set' });
      }
      throw refusal(NOT_A_SET.code, `${key} is neither a set nor a superset (a node labelled Set or Superset), so it has no elements to list.`, { input: 'set' });
    }

    const walk = walkOf(T, { fromConcept: !!concept, direct });
    const params = { key, ...R.trustParams(pov) };
    const counted = await read(
      `${walk}
       WITH DISTINCT e
       WHERE e.tapestryKey IS NOT NULL
       ${R.trust('e')}
       RETURN count(e) AS seen, count(CASE WHEN counts THEN 1 END) AS kept`,
      params,
    );
    const seen = counted.length ? asCount(counted[0].seen) : 0;
    const kept = counted.length ? asCount(counted[0].kept) : 0;
    // The limit is a checked whole number, so it goes into the text: the driver would send a parameter as a float.
    const rows = await read(
      `${walk}
       WITH DISTINCT e
       WHERE e.tapestryKey IS NOT NULL AND ($after IS NULL OR e.tapestryKey > $after)
       ${R.trust('e')}
       WHERE counts
       RETURN ${R.nodeColumns('e')}
       ORDER BY tapestryKey
       LIMIT ${limit + 1}`,
      { ...params, after },
    );
    const page = R.pageOf(rows, limit, (last) => R.encodeCursor(READ, scope, last.tapestryKey));
    return {
      concept,
      set,
      direct,
      pov: { name: pov.name, observer: pov.observer, cutoff: pov.cutoff, scored: pov.scored },
      kept,
      leftOut: Math.max(0, seen - kept),
      elements: page.items.map((r) => R.nodeOf(r, pov.own)),
      cursor: page.cursor,
    };
  },
};
