'use strict';
/**
 * class-thread-acyclic: no set or superset is below itself, so following class-thread links down from any node never
 * comes back to it (story graph-operations-first-slice #28, AC3 and AC7; ADR graph-operations-first-slice/0028
 * Decision 3). Its entry in the rules document is docs/GRAPH_RULES.md.
 *
 * Its items are { set, parent }: a link about to be made (graph link-set's guard, and its re-check after the write) or
 * one that is there (rules check, A10.31). For each:
 *   - an item whose set or parent names no node, whose set isn't a set or a superset, or whose parent isn't a superset
 *     or a set, isn't this rule's to judge: no finding, and the declaration refuses it;
 *   - a parent that is the set itself is a cycle;
 *   - otherwise the class thread above the parent is walked, one level per read (_sets.js's ancestors). When the set
 *     is in it, the link is on a cycle, and the finding names the chain from the set down to the parent: at most
 *     twelve nodes, then how many more.
 * Walking up from the parent never uses the link itself, so the guard and the check are one definition. The walk
 * follows class-thread links only, so the class thread anomaly (BIBLE §10, rule 9), an element, breaks nothing.
 */

const S = require('../catalog/graph/_sets');

const NAME = 'class-thread-acyclic';
const MAX_NAMED = 12;

module.exports = {
  name: NAME,
  summary: 'No set or superset is below itself: following class-thread links down from any node never comes back to it.',
  refuses: true,
  refusals: [
    { code: 'cycle', status: 409, when: 'The parent is the set itself, or already below it in the class thread, so the link would make a set its own subset' },
  ],

  async violations(items, read) {
    const out = [];
    for (const item of items || []) {
      const set = item && item.set;
      const parent = item && item.parent;
      if (typeof set !== 'string' || typeof parent !== 'string') continue;
      const setNode = await S.nodeOf(read, set);
      const parentNode = setNode ? await S.nodeOf(read, parent) : null;
      if (!setNode || !parentNode || S.kindOf(setNode) === 'other' || S.kindOf(parentNode) === 'other') continue;
      if (set === parent) {
        out.push({ item, code: 'cycle', message: `${S.describe(setNode)} under itself makes a cycle in the class thread: a set or superset can't be its own subset. Choose another parent.` });
        continue;
      }
      const nodes = new Map([[set, setNode], [parent, parentNode]]);
      const up = await S.ancestors(read, parent, { nodes });
      if (!S.isAbove(up, set)) continue;
      const path = S.chain(up, parent, set).reverse();
      const named = path.slice(0, MAX_NAMED).map((k) => S.describe(nodes.get(k) || { key: k }));
      const more = path.length - named.length;
      out.push({
        item,
        code: 'cycle',
        message: `${S.describe(setNode)} under ${S.describe(parentNode)} makes a cycle in the class thread: ${S.describe(parentNode)} is already below ${S.describe(setNode)}, through ${named.join(' → ')}${more > 0 ? `, and ${more} more` : ''}. A set or superset can't be below itself. Take a link on that chain out with graph unlink-set, or choose another parent.`,
      });
    }
    return out;
  },
};
