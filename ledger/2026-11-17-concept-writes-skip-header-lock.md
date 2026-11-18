# update-concept's rename and mark-field don't take the concept header's lock, so either can interleave with a property write

**Id:** 2026-11-17-concept-writes-skip-header-lock
**Type:** bug (low: it needs an owner or an admin to run two writes on one concept at once, and the change entries keep what was lost)
**Opened:** 2026-11-17 (story graph-operations-first-slice #18's review round 1, non-blocking 1; ADR graph-operations-first-slice/0018 Amendment 3, item 1)
**Status:** OPEN
**Done:** —

**What was seen** (by reading, in review; the fake graph runs one transaction at a time, so no suite reproduces it):
- **The lock the writes share.** Each property write (`graph add-property`, `update-property`, `remove-property`, `set-schema`) takes `S.lockNode` on the concept's header before it writes, as create-element, update-node and delete-node do. So those writes to one concept go one after the other.
- **update-concept's rename** takes the concept-header concept's lock instead (`_concepts.js`'s C1), then reads the concept's core nodes. It then rewrites the json tags of the schema node, the primary property and the tree graph wherever they still hold the old names' text, from what it read (`renameRows`).
  - Beside a property write, it can write back what it read before that write committed, so the schema node loses the property write's change.
  - The next property write's catching up then follows the schema and takes the new property node out, kept whole in its entry.
  - A plural-only rename writes only tag nodes, so either write's change to those json tags can be the one lost.
- **mark-field** takes no lock. A type change, or a removal, can land on a field marked between the property write's read of the marks and its commit, though Decision 8 refuses that change when the two run one after the other. After a removal, the mark's copies stay on the elements with no mark; `graph map-fields` clears them.

**Fix shape.** update-concept and mark-field take `S.lockNode` on the concept's header before they read, after any lock of their own, as the property writes do. Then each suite that pins their first statements (update-concept's lock, mark-field's MERGE) follows, and a live check runs two of them at once on one concept, as story 18's L2 did for two adds.

**Pointer:** `src/operations/catalog/graph/update-concept.js:66`; `src/operations/catalog/graph/mark-field.js:51–85`; `src/operations/catalog/graph/_properties.js` (the marks read in `commit`); ADR 0018 Decision 11 and Amendment 3.
