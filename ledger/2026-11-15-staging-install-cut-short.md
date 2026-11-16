# Staging's firmware install of 2026-11-15 was stopped in Pass 3, so its last steps never ran

**Id:** 2026-11-15-staging-install-cut-short
**Type:** bug
**Opened:** 2026-11-15 (story graph-operations-foundation #8, Background)
**Status:** DONE
**Done:** 2026-11-16 (PR #70, story graph-operations-foundation #8, deployed to staging; the install reran clean)

**What was seen.** Story 5's session started a firmware install on staging at about 19:09 UTC, for story 5's new concept `neo4j-property`.
- **What finished:** Pass 1 and Pass 2, with no errors. Install-status reads 40 of 40 concepts, and `neo4j-property` and its two sets are in place.
- **Where it stalled:** Pass 3's rebuild, for story 8's bug.
- **The stop:** at the owner's word, the control panel was restarted at 20:13:17 UTC, during ListHeader's rebuild. Nothing has been rebuilt since (checked 20:49 UTC).
- **What never ran:** apply-enumerations, wire-implicit-elements and the community-reference edges.

**To close.** Once story 8 is deployed to staging, run the install again (`POST /api/firmware/install`, the owner's call). It should now finish in minutes. Then check its log reaches "FIRMWARE INSTALL COMPLETE", and that derive-status reads derived = total for each label.

**Closed 2026-11-16.**
- **The rerun.** PR #70 merged into staging at 00:15 UTC as `33c5ce2f`, and the control panel restarted on it at about 00:17. Then story 5's session ran staging's firmware install again. It finished in 196 s.
- **The log:** Pass 1 had 40 concepts and 0 errors. Pass 2 enriched 40, with 0 errors. Pass 3 derived 722, applied 4 enumerations and wired 74 implicit elements. The log reaches "FIRMWARE INSTALL COMPLETE". So apply-enumerations, wire-implicit-elements and the community-reference edges have now run.
- **Afterwards (story 8's session read staging read-only, about 00:58 UTC):** derive-status reads derived = total for every label, with Set at 24 of 24. Install-status reads 40 of 40, none missing.
- **On Loom:** recorded as memo 112 on A10.3.b.

**Pointer:** `engineering-team/stories/graph-operations-foundation/8-pass-3-finishes-in-minutes.md` (Background).
