# A firmware reinstall can take a concept's superset out of the superset concept

**Id:** 2026-11-15-reinstall-drops-a-supersets-own-membership
**Type:** bug
**Opened:** 2026-11-15 (graph-operations-first-slice #16, the live check's step L3)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The case.** On a scratch instance, today's `POST /api/normalize/create-concept` made tea house. Its superset node was an element of the superset concept, as the route wires it: `39999:<TA>:superset-superset -HAS_ELEMENT-> tea-house-superset`.
- **What the reinstall did.** A firmware reinstall (`POST /api/firmware/install`) added `set-superset -HAS_ELEMENT-> tea-house-superset` from the node's `z` tag for set. It then removed `superset-superset -HAS_ELEMENT-> tea-house-superset`.
- **Why it matters.** The superset concept's class thread no longer reaches the node: nothing contains it but set's. A query for the superset concept's elements, through `IS_THE_CONCEPT_FOR`, `IS_A_SUPERSET_OF*` and `HAS_ELEMENT`, misses it, though its `z` tag names that concept. A second reinstall left it so. BIBLE §10's rule 3 (every element reachable through a class thread) is broken for every concept today's route made, once the firmware is reinstalled.
- **A suspected cause, not confirmed.** Pass 1e (`src/firmware/install.js`, "Prune redundant Superset edges") counts a path of two `HAS_ELEMENT`s as a class thread: `(sup)-[:IS_A_SUPERSET_OF|HAS_ELEMENT*2..12]->(elem)`. `superset-superset -HAS_ELEMENT-> set-superset -HAS_ELEMENT-> tea-house-superset` is such a path, through set's own superset, which is itself an element of the superset concept. So it would prune an edge no class thread replaces, and pass 3's `wire-implicit-elements`, finding the node reachable the same way, wouldn't wire it back.
- **What doesn't fit** (story 16's review round 1, non-blocking 6). The same path exists for every superset `graph create-concept` makes, since ADR 0016 Amendment 2 wires each into both `superset` and `set`. Yet the live check's record has those memberships surviving both reinstalls. So either the cause is something else, or what pass 1e prunes depends on the order in which it meets the edges. Whoever fixes pass 1e should re-derive the cause on a scratch instance before changing it, and the next scratch run that touches concepts should repeat L3 (story 16's test plan asks it).

**Fix shape, if the suspected cause holds.** In pass 1e, count only paths a class thread takes: `IS_A_SUPERSET_OF*1..` then one `HAS_ELEMENT`, as `wire-implicit-elements`' own prune does. Then a reinstall run over the graph wires back what it pruned. The concepts `graph create-concept` made in story 16's live check kept their supersets' membership through two reinstalls.

**Pointer:** `engineering-team/stories/graph-operations-first-slice/16-create-concept-and-update-concept.test-plan.md` (the live check, L3); `src/firmware/install.js` pass 1e.
