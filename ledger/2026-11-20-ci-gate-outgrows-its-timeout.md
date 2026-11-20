# The stack-free CI gate now runs into its 15-minute timeout, so a passing run is cancelled

**Id:** 2026-11-20-ci-gate-outgrows-its-timeout
**Type:** meta (the CI test gate, OPERATIONS.md §15)
**Opened:** 2026-11-20 (Loom A10.31.a, story graph-operations-first-slice #45, reading ADR PR #161's check)
**Status:** OPEN
**Done:** —

**What was seen.** `.github/workflows/test.yml` gives the `stack-free` job `timeout-minutes: 15`, and `test/ci-test-job.test.js` W7 pins that number ("a hang guard, not a budget", ADR 0001). The gate has grown to the edge of it. Its `npm test` step took:

| Run | PR branch | `npm test` step | Job |
|---|---|---|---|
| 44394778759 (2026-11-18) | feat/honest-test-gate | 13 m 52 s | success |
| 44601450091 (2026-11-19) | docs/enumerate-ship-records | 13 m 54 s | success |
| 44681193649 (2026-11-20) | A10.31.a-property-one-parent (PR #161) | 14 m 43 s to its `Overall:` line | **cancelled** at 15 m 0 s |
| 44688318909 (2026-11-20) | A10.32-import-nostr (PR #162) | still running at 14 m 59 s | **cancelled** at 15 m 0 s |

Run 44681193649 printed `Overall: PASS — 8178 passed, 0 failed, 649 skipped across 347 suites` and was cancelled about 7 seconds later, so GitHub shows the check as failing although no test failed. Run 44688318909 never reached its `Overall:` line. Neither is a hang: the suite is just longer than the guard. Every PR from here on is likely to go red this way, and the code PR for A10.31.a adds 48 more stack-free tests. A10.32's code PR (story graph-operations-first-slice #32, `import nostr`) adds 92 more, in `test/operations/import/`, about 29 s with each suite run alone (that story's Evidence); its scoped gate's `operations` entry took 229–240 s on this Mac.

**Fix shape.** Either raise `timeout-minutes` (amend ADR 0001, change W7 and the sentence in OPERATIONS.md §15 that names the 15 minutes), or make the gate faster. The no-retry rule in §15 still holds: a cancelled run is not run again by hand.

**Pointer:** `.github/workflows/test.yml`; `test/ci-test-job.test.js` W7; OPERATIONS.md §15; `engineering-team/decisions/done/test-hermeticity-ci/0001-ci-test-job.md`.
