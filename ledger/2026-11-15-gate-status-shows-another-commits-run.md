# `npm run gate:status` prints its newest record without saying that the record isn't of HEAD

**Id:** 2026-11-15-gate-status-shows-another-commits-run
**Type:** meta
**Opened:** 2026-11-15 (graph-operations-foundation #5 review, Harness friction 2)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The instruction.** The Reviewer role and workflow 5 say to quote "the run's" `npm run gate:status` line, its run id and verdict, as the gate's result.
- **What it printed.** In story 5's review, on `1fc4ca39`, it printed `20261113T204400Z-47565-3703 [workflow-hardening-pre] started 2026-11-13T20:44:00.421Z on 1dc1ca44+dirty — FAIL`. That run was another session's, of an ancestor commit with a dirty tree, two days old. Nothing in the line says that it isn't HEAD's.
- **The risk.** A review that quotes that line as its gate could pass a FAIL off as this diff's, or report a stale PASS as a fresh one. On the Mac Studio no review runs the full gate (OPEN.md row 294), so the newest record there is always someone else's.

**Fix shape.** In `test/gate-status.js` (`describe`, `:41–45`), compare the record's `git.commit` with `git rev-parse HEAD`. When they differ, or the tree was dirty, say so in the line, for example `— of 1dc1ca44+dirty, not HEAD 1fc4ca39`, and exit with a code of its own.

**Pointer:** `engineering-team/reviews/graph-operations-foundation/5-field-mapping.md` (Quality gates; Harness friction 2); `test/gate-status.js`.
