# Two link-sets at once can leave a direct link from a firmware superset that a reinstall prunes, and no rule's check finds it

**Id:** 2026-11-16-concurrent-links-leave-prunable-firmware-link
**Type:** feature
**Opened:** 2026-11-16 (graph-operations-first-slice #28, Loom A10.28: review round 2)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The guard.** `graph link-set` refuses `firmware-prunes`: a link that would leave a direct link from a firmware concept's superset to a set that is also below it through another set. Install's prune pass takes such a link out on a reinstall (`src/firmware/install.js:807–833`). link-set compares what the prune would take out before and after its own write (ADR graph-operations-first-slice/0028 Decision 6).
- **The race.** Two link-sets that share no node, so share no lock, can together make such a link, though neither alone does. Each one's check runs before the other commits (ADR 0028 Amendment 3, item 4).
- **Nothing finds it afterwards.** `firmware-prunes` is link-set's own refusal, not a rule, so `rules check` (A10.31) has nothing to run over the graph for it. The next reinstall then takes the earlier link out. The set stays below the superset through the other set, so no element leaves the concept, but a direct link the owner made is gone.

**Fix shape.**
- **A check.** `rules check` (A10.31) gains a check for prunable direct links under firmware supersets: the same walk as `firmwarePrunes` in `src/operations/catalog/graph/_sets.js`.
- **Or remove the cause.** Lifecycle seed-firmware (A10.37) keeps local edits, so a reinstall no longer prunes links the owner made, and the refusal and this row both retire.

**Pointer:** `engineering-team/decisions/graph-operations-first-slice/0028-link-set-and-unlink-set.md` (Decision 6, Amendment 3 item 4); `engineering-team/reviews/graph-operations-first-slice/28-link-set-and-unlink-set.md` (round 2, "Still open"); `src/operations/catalog/graph/_sets.js` (`firmwarePrunes`).
