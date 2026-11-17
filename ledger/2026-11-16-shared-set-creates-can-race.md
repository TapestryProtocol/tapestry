# Two create-elements in two concepts whose class threads share a set can each make an element of one name at once

**Id:** 2026-11-16-shared-set-creates-can-race
**Type:** bug
**Opened:** 2026-11-16 (story graph-operations-first-slice #20, review round 1, non-blocking finding 3; ADR graph-operations-first-slice/0020 Amendment 1, item 3)
**Status:** OPEN
**Done:** —

**What was seen.** `graph create-element` takes a write lock on its named concept's header only (ADR 0020 Decision 7, `src/operations/catalog/graph/create-element.js`).

Suppose link-set has put concept B's superset under A's. Then two calls can make two elements of one name in B's superset, at two addresses, when they run at once:
- a create in A whose `set` is B's superset;
- a create of the same name in B.

Each holds a different lock, and neither repeat search sees the other's element.

Run one after the other, in either order, the second finds the first, since each repeat search covers B's superset. The review found this by reading. The fake graph can't run two transactions at once, so it wasn't reproduced.

**Fix shape.** Lock the header of every concept whose class thread reaches the target, in one order (sorted by tapestryKey), not only the named concept's. Neo4j detects a deadlock between two such writes and the driver retries the loser, but one order avoids it. Worth doing with the first write that needs it: a bulk create (catalog §10, question 6), or the rebuild (A10.39) if it runs creates in parallel.

**Pointer:** ADR graph-operations-first-slice/0020 (Decision 7; Amendment 1, item 3); `engineering-team/reviews/graph-operations-first-slice/20-create-element.md` (non-blocking finding 3).
