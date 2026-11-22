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

**A set's membership in `set`, seen and read (2026-11-17, story graph-operations-first-slice #27).**
- **Seen** (its live check, L6). Three sets `graph create-set` made kept `set-superset`'s direct `HAS_ELEMENT` through a reinstall. Firmware's own sets on the agent-memory instance, reinstalled many times, still have theirs.
- **Read, not run** (its review, round 1). Pass 1e does take that membership out, and Pass 3 puts it back:
  - **Pass 1e** counts paths that mix the two link types (`src/firmware/install.js:856`). So `set-superset -HAS_ELEMENT-> parent -IS_A_SUPERSET_OF-> set` counts when the set's parent is itself an element of this instance's `set`, as this instance's own supersets and sets are, and the pass deletes the set's direct link (`:862–866`). A set under another author's superset or set has no such path, and keeps its link.
  - **Pass 3's `wire-implicit-elements`** (`install.js:1291`) then wires it again from the set's `z` tag. It counts a node as wired only when a path ends in a `HAS_ELEMENT` into it (`src/api/normalize/index.js:5886–5893`), and a set's other way in ends in `IS_A_SUPERSET_OF`.
  - **This row's superset case is the opposite.** `superset-superset -HAS_ELEMENT-> set-superset -HAS_ELEMENT-> tea-house-superset` ends in a `HAS_ELEMENT`, so Pass 3 counts it as wired, and the membership stays lost.

  So the set case fits this row's suspected cause, rather than arguing against it.
- **What follows.**
  - Such a set stays in `set` only because Pass 3 runs to the end. A Pass 3 failure is caught and logged while the install goes on (`install.js:1289–1295`), and such a reinstall leaves those sets out of `set`.
  - A fix of this row's shape, pass 1e counting only class-thread paths, leaves sets alone. A change to `wire-implicit-elements`' check could drop the membership of every such set.
  - To confirm the reading on a scratch reinstall, read its output: `set: pruned N HAS_ELEMENT …` (`install.js:900`), then `Implicit elements wired: N` (`:1292`).

**The two meta-supersets list themselves, and a reinstall changed one (2026-11-21, community-reference #39's reinstalls).** Seen, not looked into:
- **On production.** A read-only query for every node linked to itself, run just before and after its firmware reinstall (23:37 to 23:41 UTC, on `196a475f`), found `39999:<TA>:set-superset -HAS_ELEMENT->` itself both times. `39999:<TA>:superset-superset -HAS_ELEMENT->` itself was there only after.
- **On staging,** after its reinstall that day (22:07 to 22:11 UTC, on the same code), `/neighbors` shows `set-superset` listing itself as an element and `superset-superset` not.
- **On tags,** both meta-supersets list themselves, before and after its reinstall on 2026-11-22 (read-only Cypher).
- **Why it may belong here.** Each meta-superset is itself a set, and `superset-superset` is a superset, so the memberships may be meant. But whether one is there depends on the instance and on the install, as with this row's moves between the two meta-supersets. `class-thread-acyclic` may count each as a cycle.
