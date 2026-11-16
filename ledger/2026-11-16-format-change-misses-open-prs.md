# An ADR that changes a shared document's format has no step that finds the open PRs writing to it

**Id:** 2026-11-16-format-change-misses-open-prs
**Type:** meta
**Opened:** 2026-11-16 (the docs follow-up to ADR graph-rules/0001, review `reviews/graph-rules/rulebook-status-and-source.md`, harness friction)
**Status:** OPEN
**Done:** —

**What was seen.** ADR graph-rules/0001 added two fields to every entry in `docs/GRAPH_RULES.md`. At the same time, two open pull requests, #74 and #77, were adding entries in the old shape. Nothing in the Architect's workflow, the ADR template or the review checklist asks which open pull requests also write to a document whose format a change alters. The hazard surfaced only in the review of the follow-up, as OPEN.md row `2026-11-16-new-rulebook-entries-lack-fields`.

**Fix shape.** Add one question to the ADR template's Consequences, or to `workflows/2-architecture.md`: "Does this change the format of a document that other branches also write? Name the open pull requests that touch it, and say who updates each." The review checklist could ask the same of the diff.

**Pointer:** `engineering-team/reviews/graph-rules/rulebook-status-and-source.md` (harness friction); OPEN.md row `2026-11-16-new-rulebook-entries-lack-fields`.
