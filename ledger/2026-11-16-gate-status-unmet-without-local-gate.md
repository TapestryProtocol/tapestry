# The review template asks for the gate's run record, which a Mac that may not run the full gate can't give

**Id:** 2026-11-16-gate-status-unmet-without-local-gate
**Type:** meta
**Opened:** 2026-11-16 (graph-operations-first-slice #28, Loom A10.28: review round 1)
**Status:** OPEN
**Done:** —

**What was seen.**
- **What the review is asked for.** A quote of the gate's verdict from its run record (`npm run gate:status`, engineering-team/README.md "Running and reading the test gate").
- **Why the full gate isn't run there.** On David's Mac Studio the full `npm test` must not run: the local stack is the agent-memory instance, and about 40 suites write to it (ledger `2026-11-13-live-suites-have-no-off-switch`). So a review there runs the story's suites and the stack-free operations suite one at a time, and the full gate runs only in the pull request's CI.
- **What the record then says.** `gate:status` reports "no gate run records". A Reviewer can't meet the template's ask, and has to say so in words of its own.

**Fix shape.** The template and workflow 5 say what to record when the gate runs only in CI:
- the suites run locally, with their counts;
- the pull request's CI run, its URL and its verdict, once it exists;
- a rule that the review's PASS is read together with that CI result before merging.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/28-link-set-and-unlink-set.md` (round 1, Gates); `engineering-team/templates/review-checklist.md`; `engineering-team/workflows/5-review.md`.
