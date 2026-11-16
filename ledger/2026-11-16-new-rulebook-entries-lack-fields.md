# Rulebook entry 4, on PR #74, has no Status or Source

**Id:** 2026-11-16-new-rulebook-entries-lack-fields
**Type:** docs
**Opened:** 2026-11-16 (the docs follow-up to ADR graph-rules/0001, PR #78, review `reviews/graph-rules/rulebook-status-and-source.md`, finding 1)
**Status:** DONE
**Done:** 2026-11-16, in #74 (commit 4a2d1c49): entry 4 has **Status:** enforced and **Source:** ADR graph-operations-first-slice/0016. #78 merged first, and merging it into #74 needed no conflict to be resolved, since the fields were added the commit before.

**What was seen.** ADR graph-rules/0001 gives every entry in `docs/GRAPH_RULES.md` a Status and a Source. PR #78, the follow-up, adds them to entries 1 to 3, and to entries 5 and 6, which #77 (Loom A10.28) brought in while #78 was open. One open pull request into `staging` still adds an entry in the old shape: #74 (Loom A10.16), with §4 `concept-slug-unique`, built in story graph-operations-first-slice #16 (ADR 0016).

It conflicts once with the new fields, right after entry 3's "Enforced by" line. Keeping both sides resolves the conflict but leaves entry 4 without the fields, and A10.41 builds the graph rule concept's items from these entries.

**Fix shape.** Whichever of #74 and #78 merges last adds the fields to entry 4: **Status:** enforced. **Source:** ADR graph-operations-first-slice/0016. Then close this row.

**Pointer:** ADR `graph-rules/0001` (Decision 6); `engineering-team/reviews/graph-rules/rulebook-status-and-source.md` (finding 1).
