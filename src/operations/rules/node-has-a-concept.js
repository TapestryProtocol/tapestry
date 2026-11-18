'use strict';
/**
 * node-has-a-concept: every node is an element of at least one concept other than word, so some concept's class thread
 * reaches it (design D9; story graph-operations-first-slice #22, AC7; ADR graph-operations-first-slice/0022 Decision 12
 * and Amendment 1, items 4 and 10). A concept keyed word or graphContext, the keys an element's JSON keeps for itself,
 * doesn't count, as graph update-node counts a node's concepts. Tags and change entries are parts of letters and of the
 * history, and are exempt. Its entry in the rules document is §8 of docs/GRAPH_RULES.md.
 *
 * Its items are one of two:
 *   { node, concept, set? }  graph remove-from-concept's guard: the node judged as if every HAS_ELEMENT into it from the
 *                            anchor, or from below it, were gone (M1, _memberships.js's waysIn). The anchor is `set` when
 *                            it is given and isn't the concept's superset, else the superset. No finding when the node,
 *                            the concept or the set names nothing the rule can judge, since the operation refuses those:
 *                            no node, a tag, no concept header, a reserved key, no superset, or a set that isn't one or is
 *                            outside the concept's class thread. None either when M1 finds nothing: a repeat.
 *   { node }                 the check, which remove-from-concept's re-check after its write runs too: the node as it
 *                            stands, named when no concept but word reaches it. rules check (A10.31) will run it.
 * Loading it opens nothing (ADR graph-operations-foundation/0001 Decision 10): it requires what it reads with when
 * violations() runs.
 */

const NAME = 'node-has-a-concept';

module.exports = {
  name: NAME,
  summary: "Every node is an element of at least one concept other than word: some concept's class thread reaches it (design D9). Tags and change entries are exempt.",
  refuses: true,
  refusals: [
    { code: 'last-concept', status: 409, when: "Taking the node out would leave it an element of no concept but word, so no other concept's class thread would reach it (design D9); the refusal names the concept and the way on: add the node to another concept first (graph add-to-concept), or delete it (graph delete-node)" },
  ],

  async violations(items, read) {
    const list = Array.isArray(items) ? items.filter((i) => i && typeof i === 'object' && !Array.isArray(i) && typeof i.node === 'string' && i.node) : [];
    if (!list.length) return [];
    // Required here, not at load: the rules' loader opens nothing.
    const F = require('../catalog/graph/_fields');
    const K = require('../catalog/graph/_concepts');
    const M = require('../catalog/graph/_memberships');
    const N = require('../catalog/graph/_nodes');
    const { RESERVED_KEYS, conceptLabel } = require('../catalog/graph/_elements');

    // The concepts that count, of those keyed: each header's key read once a call.
    const keys = new Map();
    const counted = async (concepts) => {
      const unread = concepts.filter((c) => !keys.has(c));
      for (const h of unread.length ? await K.headersByKey(read, unread) : []) keys.set(h.key, h.oKey);
      return concepts.filter((c) => !RESERVED_KEYS.includes(keys.get(c)));
    };
    const way = 'Add it to another concept first (graph add-to-concept), or delete it (graph delete-node).';

    const out = [];
    for (const item of list) {
      const facts = await N.whoseNode(read, item.node);
      if (!facts || facts.labels.includes('NostrEventTag')) continue;
      const label = N.labelOf(facts);
      if (item.concept === undefined || item.concept === null) {
        const still = await counted(M.keysOf(await F.conceptsOfNodes(read, [item.node])));
        if (still.length) continue;
        out.push({ item, code: 'last-concept', message: `${label} is an element of no concept but word: no other concept's class thread reaches it, and every node is an element of at least one (design D9). ${way}` });
        continue;
      }
      if (typeof item.concept !== 'string' || !item.concept) continue;
      const at = await M.anchorOf(read, { concept: item.concept, set: item.set });
      if (!at) continue;
      const ways = await M.waysIn(read, { anchor: at.anchor, node: item.node });
      if (!ways.length) continue;
      const left = await counted(M.keysOf(await F.conceptsOfNodes(read, [item.node], { without: ways.map((w) => w.rel) })));
      if (left.length) continue;
      const from = at.anchor === at.superset ? '' : `, from the set ${item.set} in its class thread,`;
      out.push({
        item,
        code: 'last-concept',
        message: `Taking ${label} out of ${conceptLabel(at.concept)}${from} would leave it an element of no concept but word: no other concept's class thread would reach it, and every node is an element of at least one (design D9). Nothing changed. ${way}`,
      });
    }
    return out;
  },
};
