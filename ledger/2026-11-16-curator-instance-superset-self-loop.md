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

**2026-11-21: seen, and fixed on a branch** (community-reference #39, ADR community-reference/0035 Decision 3 and Amendment 1, item 8).
- **It is there.** Production, whose assistant curates `nostr-relay`'s reference, has its `nostr-relay` superset linked to itself. That instance's header also points at itself.
- **The fix.** It is on `fix/header-tags-once`:
  - install skips a reference the instance curates itself, and takes the loop out;
  - `graph link-set` and `unlink-set`'s model of firmware's links (`src/operations/catalog/graph/_sets.js`, part d) leaves it out;
  - seed-firmware's target skips it.
- **When the row closes.** When the fix reaches production and its reinstall takes the loop out. The Mac Studio's local instance, named above, is the other curator's instance: its assistant curates the five event-tagging references, each with a d-tag equal to its slug, so the fix covers it too. Its install is the owner's word (ADR community-reference/0035, Out of scope), and the row says so when it closes.

**2026-11-21: staging is reinstalled with the fix** (community-reference #39, 22:07 to 22:11 UTC). Staging curates none of the references, so none of its own headers or supersets has a relationship to itself. Three copies there do, each holding a letter whose `b` names its own address, which the copy derives (AC-2):
- **The copy of production's `nostr-relay` header.** It goes at staging's first install after production's.
- **The copies of the Mac Studio's `nostr-event-tag` and `tagging-with-specific-tag` headers.** Their letters, signed on 2026-07-17, carry that `b`; the letters of its other three event-tagging headers carry none. So any instance holding those two copies likely has the same two loops. Only staging's are checked.
- **When the Mac Studio's two go.** Only after its instance has an install with the fix, its new letters reach the references' relay (`wss://dcosl.brainstorm.world`), and each instance installs again.

**Fix shape.** On a curator's instance, check for the loop: `MATCH (s:Superset)-[:IS_A_SUPERSET_OF]->(s) RETURN s.uuid`. If it is there, have install skip part (d) when its two ends are the same node, and take the loop out with `POST /api/normalize/delete-relationship`.

**Pointer:** `engineering-team/decisions/graph-operations-first-slice/0028-link-set-and-unlink-set.md` (Amendment 1, item 5); `engineering-team/stories/graph-operations-first-slice/28-link-set-and-unlink-set.test-plan.md` (Gaps and questions, 6); `src/firmware/install.js:1290–1300`.
