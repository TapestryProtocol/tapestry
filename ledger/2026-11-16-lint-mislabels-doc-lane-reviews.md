# harness-lint says every non-numbered review "predates the numbering convention", though doc-lane reviews now use that form

**Id:** 2026-11-16-lint-mislabels-doc-lane-reviews
**Type:** meta
**Opened:** 2026-11-16 (the docs follow-up to ADR graph-rules/0001, review `reviews/graph-rules/rulebook-status-and-source.md`, harness friction)
**Status:** OPEN
**Done:** —

**What was seen.** `scripts/harness-lint.sh:111` prints `INFO non-numbered-review <file> (predates the numbering convention; not matchable to a story)` for every review that has no number. Since `workflows/0-intake.md` §3, a doc-lane review takes the non-numbered form by convention and needs no story. So a new doc-lane review, such as `engineering-team/reviews/graph-rules/rulebook-status-and-source.md`, gets a note that isn't true of it, in the SessionStart digest every session reads.

**Fix shape.** Reword the note to cover both cases, for example "non-numbered review (the doc lane, or older than the numbering convention; not matchable to a story)", or leave doc-lane reviews out of it.

**Pointer:** `scripts/harness-lint.sh:111`; `engineering-team/workflows/0-intake.md` §3.
