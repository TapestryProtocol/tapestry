# Rulebook entries 4 to 6, on PRs #74 and #77, have no Status or Source

**Id:** 2026-11-16-new-rulebook-entries-lack-fields
**Type:** docs
**Opened:** 2026-11-16 (the docs follow-up to ADR graph-rules/0001, review `reviews/graph-rules/rulebook-status-and-source.md`, finding 1)
**Status:** OPEN
**Done:** —

**What was seen.** ADR graph-rules/0001 gives every entry in `docs/GRAPH_RULES.md` a Status and a Source, and the follow-up adds them to entries 1 to 3. Two open pull requests into `staging` add entries in the old shape:
- #74 (Loom A10.16) adds §4 `concept-slug-unique`, built in story graph-operations-first-slice #16 (ADR 0016);
- #77 (Loom A10.28) adds §5 `class-thread-acyclic` and §6 `set-has-a-parent`, built in story graph-operations-first-slice #28 (ADR 0028).

Each conflicts once with the new fields, right after entry 3's "Enforced by" line. Keeping both sides resolves the conflict but leaves entries 4 to 6 without the fields, and A10.41 builds the graph rule concept's items from these entries.

**Fix shape.** Whichever of the three pull requests merges last adds the fields to each new entry:
- §4: **Status:** enforced. **Source:** ADR graph-operations-first-slice/0016.
- §5 and §6: **Status:** enforced. **Source:** ADR graph-operations-first-slice/0028.

Then close this row.

**Pointer:** ADR `graph-rules/0001` (Decision 6); `engineering-team/reviews/graph-rules/rulebook-status-and-source.md` (finding 1).
