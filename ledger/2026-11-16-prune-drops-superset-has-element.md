# Firmware install's `HAS_ELEMENT` prune can take out a firmware superset's direct link to an element once `graph link-set` puts the element's set under that superset

**Id:** 2026-11-16-prune-drops-superset-has-element
**Type:** feature
**Opened:** 2026-11-16 (graph-operations-first-slice #28, Loom A10.28: implementation, for A10.22)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The prune.** For each firmware concept whose folder has a `manifest.json`, install's prune pass first deletes the concept's superset's direct `HAS_ELEMENT` to an element it also reaches through its sets (`src/firmware/install.js:781–805`).
- **What link-set adds.** `graph link-set` can put a set that holds such an element under that superset, or under one of its sets. The next reinstall then deletes the superset's direct `HAS_ELEMENT` to the element.
- **What changes, and what doesn't.** Membership doesn't: the element is still reached through the set, so ADR graph-operations-first-slice/0028 doesn't check this prune (Decision 6, "Two simplifications"). But the node loses a direct `HAS_ELEMENT`, so anything that counts a node's concepts by its direct `HAS_ELEMENT` edges sees one fewer.

**For A10.22.** `graph remove-from-concept` takes a node out of a concept or a set, and refuses its last concept (D9). Both have to read membership through the class thread, from each concept's header through its superset and sets to the node, as `_fields.js`'s `elementsOf` does, not from the node's direct `HAS_ELEMENT` edges. After such a prune the node is in the firmware concept only through the set: there is no direct edge from the superset to take out, and the node's direct edges count fewer concepts than it is in.

**Pointer:** `engineering-team/decisions/graph-operations-first-slice/0028-link-set-and-unlink-set.md` (Consequences, debt 5); `src/firmware/install.js:781–805`.
