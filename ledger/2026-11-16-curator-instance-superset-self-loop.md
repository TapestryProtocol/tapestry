# On an instance whose assistant is a community reference's curator, firmware install may link that concept's superset to itself

**Id:** 2026-11-16-curator-instance-superset-self-loop
**Type:** bug
**Opened:** 2026-11-16 (graph-operations-first-slice #28, Loom A10.28: ADR 0028 Amendment 1, item 5, recorded at implementation)
**Status:** OPEN
**Done:** —

**What was seen.** Possible, not verified against a live graph.
- **The statement.** Install's part (d) wires a firmware concept that has a community reference: it MERGEs `IS_A_SUPERSET_OF` from `supersetFrom`, `39999:<TA>:<slug>-superset` (`src/firmware/install.js:1139`), to `supersetTo`, `39999:<curatorPk>:<dTag>-superset` (`:1297`). It doesn't compare the two ends.
- **When they are one node.** On an instance whose assistant is the curator, with a d-tag equal to the slug, both addresses name the same superset, so the MERGE makes a self-loop. The `tag` family's references are curated by the Mac Studio's local assistant, so that instance may already hold such loops.
- **What the new rules make of it.** `class-thread-acyclic`'s check would report the loop as a cycle. `graph unlink-set` would refuse to take it out as firmware's own, part (d) (ADR graph-operations-first-slice/0028 Decision 6), and a reinstall would MERGE it again.
- **Why it wasn't checked.** The test design and implementation sessions may not touch the Mac Studio's stack, which is a private instance.

**Fix shape.** On a curator's instance, check for the loop: `MATCH (s:Superset)-[:IS_A_SUPERSET_OF]->(s) RETURN s.uuid`. If it is there, have install skip part (d) when its two ends are the same node, and take the loop out with `POST /api/normalize/delete-relationship`.

**Pointer:** `engineering-team/decisions/graph-operations-first-slice/0028-link-set-and-unlink-set.md` (Amendment 1, item 5); `engineering-team/stories/graph-operations-first-slice/28-link-set-and-unlink-set.test-plan.md` (Gaps and questions, 6); `src/firmware/install.js:1290–1300`.
