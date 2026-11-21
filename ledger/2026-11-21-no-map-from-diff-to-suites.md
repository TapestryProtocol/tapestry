# Nothing maps a diff's files to the registry suites that read them, so a scoped gate can miss a suite the change breaks

**Id:** 2026-11-21-no-map-from-diff-to-suites
**Type:** meta
**Opened:** 2026-11-21 (story graph-operations-first-slice #37, review round 1, harness friction)
**Status:** OPEN
**Done:** —

**What was seen.**
- **Where scoped gates come from.** On this Mac a change is gated by a scoped list of registry suites, never the full `npm test` (ledger row `2026-11-14-harness-points-tests-at-agent-memory`). The list comes from the session's judgment.
- **What story 37 missed.** Its Implementer's gate named twelve suites, and the session's thirteen. Three more read files the diff changes: `openapi-document` reads BIBLE §11, and `ledger-row-ids` and `session-start` read the real ledger. The Reviewer found them by grep.
- **The risk.** A scoped gate can pass while CI's full run fails on a suite nobody named.

**Fix shape.** A script that takes a diff and prints the registry entries whose suites read the changed files: by the file paths and module names they mention, and by the documents they read, such as `BIBLE.md` and `ledger/`. The gate recipe would then run it, beside the suites the change names.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/37-seed-firmware.md` (Harness friction 1); `test/registry.js`.
