# _concepts.js's headersByKey matches nodes with no label, so its tapestryKey lookup can't use the index

**Id:** 2026-11-16-headers-by-key-scans-unlabelled
**Type:** cleanup
**Opened:** 2026-11-16 (story graph-operations-first-slice #20, review round 1, non-blocking finding 4)
**Status:** OPEN
**Done:** —

**What was seen.** `headersByKey` (C8b, `src/operations/catalog/graph/_concepts.js`) reads `MATCH (h) WHERE h.tapestryKey IN $keys`. With no label in the pattern, Neo4j can't use the index behind the `tapestry_key` uniqueness constraint, which is on `:TapestryNode` only (`src/operations/catalog/lifecycle/_migrations.js`), so each call scans the nodes.

Who calls it:
- `graph create-element` reads with it once per create, for the named concept, and once more when other concepts' class threads reach its target;
- the rebuild (A10.39) makes every element with it;
- create-concept calls it too, for its near matches and its answer;
- `graph create-set` reads with it once per create, for each concept other than set whose class thread reaches the set concept's superset: word, on firmware 1.0.0 (story graph-operations-first-slice #27, review round 1, non-blocking finding 4).

The cost is unmeasured. A fresh scratch stack has no `tapestry_key` constraint at all (the A10.9 notes), so it can't show the difference.

**Fix shape.** `MATCH (h:TapestryNode) WHERE h.tapestryKey IN $keys`. Every keyed node has the shared label (ADR graph-operations-foundation/0003 Decision 8), so the answer doesn't change. Time a create-element on a stack with the constraint, before and after.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/20-create-element.md` (non-blocking finding 4); ADR graph-operations-first-slice/0020 Amendment 1, item 3.
