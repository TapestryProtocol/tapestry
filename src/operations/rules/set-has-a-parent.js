'use strict';
/**
 * set-has-a-parent: every set is directly under at least one superset or set, so some class thread reaches it and its
 * elements (story graph-operations-first-slice #28, AC5 and AC7; ADR graph-operations-first-slice/0028 Decision 4). A
 * superset is exempt: its concept's header holds it in its class thread. Its entry in the rules document is
 * docs/GRAPH_RULES.md.
 *
 * Its items are { set, without? }:
 *   - as graph unlink-set's guard, `without` is the parent about to be left. The item is judged only when a link from
 *     `without` to the set is there, so taking out a link that isn't there is a repeat, not a refusal;
 *   - as a check (rules check, A10.31, and unlink-set's re-check after its write), `without` is left out.
 * No finding for a key that names no node, or for a node that isn't a set (a superset, an element, a concept header).
 * Otherwise the set's parents are read, and only a superset or a set other than `without` counts: an element an old
 * route put above a set doesn't. With none, the finding is last-parent. A node with no address, such as one of the
 * trust pipeline's card sets, is neither judged as a set nor counted as a parent (_sets.js's kindOf; ADR 0028
 * Amendment 3).
 */

const S = require('../catalog/graph/_sets');

const NAME = 'set-has-a-parent';

module.exports = {
  name: NAME,
  summary: "Every set is directly under at least one superset or set; a superset is exempt, since its concept's header holds it in its class thread.",
  refuses: true,
  refusals: [
    { code: 'last-parent', status: 409, when: 'Taking the link out would leave the set under no superset or set, so no class thread would reach it or its elements' },
  ],

  async violations(items, read) {
    const out = [];
    for (const item of items || []) {
      const set = item && item.set;
      if (typeof set !== 'string') continue;
      const without = typeof item.without === 'string' ? item.without : null;
      const node = await S.nodeOf(read, set);
      if (!node || S.kindOf(node) !== 'set') continue;
      const parents = await S.parentsOf(read, [set]);
      const left = without ? parents.find((p) => p.parent === without) : null;
      if (without && !left) continue;
      if (parents.some((p) => p.parent !== without && S.kindOf(p) !== 'other')) continue;
      out.push({
        item,
        code: 'last-parent',
        message: without
          ? `${S.describe(node)} is under no superset or set other than ${S.describe(left)}, so taking it out from under that parent would leave it under none, and no class thread would reach it or its elements. Link it under another parent first (graph link-set), or delete it once it is empty (graph delete-set, A10.17).`
          : `${S.describe(node)} is under no superset or set, so no class thread reaches it or its elements. Link it under one with graph link-set, or delete it once it is empty (graph delete-set, A10.17).`,
      });
    }
    return out;
  },
};
