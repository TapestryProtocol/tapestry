# Test files' header comments cite story docs at paths that no longer exist

**Id:** 2026-11-22-test-headers-cite-moved-docs
**Type:** cleanup
**Opened:** 2026-11-22 (test-gate-speed book close)
**Status:** OPEN
**Done:** —

A suite's header comment usually names its story, ADR and test plan by path, such as
`engineering-team/stories/<epic>/<n>-<slug>.md`. An epic close-out moves those folders under `done/` with one
`git mv` per area (`engineering-team/workflows/5-review.md`, "Epic close-out"), and nothing rewrites the comments. On
2026-11-22, 104 files under `test/` cited 188 such paths that no longer exist:
- 171 resolve once `done/` is inserted after `stories/`, `decisions/` or `reviews/`;
- 17 name files that are gone, renamed or never written.

This book's own guard, `test/gate-side-by-side.test.js`, joins them: its lines 5–7 still name the story, ADR and plan at
their pre-close paths. Only a `test:` commit may touch that file (the test-deliverable carve-out), and the close changed
only records. Nothing reads these paths; they are comments. But a reader following one lands nowhere.

Fix shape: a one-time sweep that rewrites each dead path whose `done/` form exists, then a look at the 17. Optionally,
the close-out step could rewrite the moved epic's own paths under `test/`, or a harness-lint check could report a dead
header path (a harness change, with a CHANGELOG row).

**Pointer:** `test/gate-side-by-side.test.js:5–7`; `test/ci-test-job.test.js:4`; `engineering-team/workflows/5-review.md` § Epic close-out.
