'use strict';
/**
 * The rule concept-slug-unique: no two of this instance's own concepts share a slug or a key (BIBLE §10, rule 10, as
 * its full text gives it: within one author's graph, since the key is what elements' JSON is filed under). Story
 * graph-operations-first-slice #16, ADR graph-operations-first-slice/0016 Decision 5 and Amendment 1.2; its entry is
 * §4 of docs/GRAPH_RULES.md.
 *
 * An item is one of three:
 *   { slug, key, repeat: true }  a create's: an own concept with the slug is the repeat, so nothing is violated;
 *                                otherwise an own concept with the key is key-in-use
 *   { concept, slug }            an update's: another own concept with the slug is slug-in-use
 *   { concept }                  a check's: the concept's own slug and key, against every other own concept
 * An item whose concept isn't one of this instance's own concept headers has no violations: the operation that wrote
 * it refuses it itself. Another author's slug or key never counts (D4).
 */

module.exports = {
  name: 'concept-slug-unique',
  summary: "No two of this instance's own concepts share a slug or a key (BIBLE §10, rule 10)",
  refuses: true,
  refusals: [
    { code: 'slug-in-use', status: 409, when: "A slug another of this instance's own concepts has; the refusal names it" },
    { code: 'key-in-use', status: 409, when: "A name whose key another of this instance's own concepts has under another slug; the refusal names it" },
  ],

  async violations(items, read) {
    const list = Array.isArray(items) ? items.filter((i) => i && typeof i === 'object') : [];
    if (!list.length) return [];
    // Required here, not at load: the rules' loader opens nothing (ADR graph-operations-foundation/0004 Decision 4).
    const { ownConcepts } = require('../catalog/graph/_concepts');
    const own = await ownConcepts(read);
    const named = (c) => `${c.names.singular || c.name || 'a concept'} (${c.uuid})`;
    const slugTaken = (item, slug, holder) => ({ item, code: 'slug-in-use', message: `The slug ${slug} belongs to ${named(holder)}: two of this instance's concepts can't share a slug (BIBLE §10, rule 10). Choose another slug.` });
    const keyTaken = (item, key, holder) => ({ item, code: 'key-in-use', message: `The key ${key}, which elements' JSON is filed under, belongs to ${named(holder)}, whose slug is ${holder.slug}: two of this instance's concepts can't share a key (BIBLE §10, rule 10), and a concept's key never changes. Give the new concept another name.` });
    const out = [];
    for (const item of list) {
      if (item.repeat === true) {
        if (own.some((c) => c.slug === item.slug)) continue;
        const holder = own.find((c) => c.oKey === item.key);
        if (holder) out.push(keyTaken(item, item.key, holder));
        continue;
      }
      const self = typeof item.concept === 'string' ? own.find((c) => c.key === item.concept) : null;
      if (!self) continue;
      const check = item.slug === undefined && item.key === undefined;
      const slug = check ? self.slug : item.slug;
      const key = check ? self.oKey : item.key;
      if (typeof slug === 'string') {
        const holder = own.find((c) => c !== self && c.slug === slug);
        if (holder) out.push(slugTaken(item, slug, holder));
      }
      if (typeof key === 'string') {
        const holder = own.find((c) => c !== self && c.oKey === key);
        if (holder) out.push(keyTaken(item, key, holder));
      }
    }
    return out;
  },
};
