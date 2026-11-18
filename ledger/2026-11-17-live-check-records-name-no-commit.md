# A live check's records don't name the code it ran, so a review can match it to the committed code only by file times

**Id:** 2026-11-17-live-check-records-name-no-commit
**Type:** meta
**Opened:** 2026-11-17 (story graph-operations-first-slice #18's review, Harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.**
- **How a live check runs.** `scripts/scratch-stack.sh` mounts the worktree's `src/` into a throwaway instance, live, and the instance is removed after the check. The check's records (`tmp/live-check-<n>/`: its script, its reports, its hand calls) name the instance and every call, but no commit, and no hash of the tree or of the files modified beside it.
- **What that hid.** Story 18's run 2 ran on an uncommitted `_properties.js` that was edited again before the commit. The reviewer could tell the code that ran from the code committed only by file times (`report-main.json` written at 20:47; `_properties.js` last changed at 21:10), and the Evidence didn't say so (the review's non-blocking 2).
- **Why it matters.** A live check is the evidence for what the suites can't reach: locking, a reinstall, a restore, nginx, the relay. If its record can't name the code, a reviewer can't tell whether it still holds for the commit under review.

**Fix shape.** Each live-check record carries, at each run, `git rev-parse HEAD` and a hash of each file `git status` shows modified under `src/` and `firmware/` (`git hash-object`). A shared helper beside `test/helpers/scratchLoopback.js` could write that stamp into each report. The live-check sections of the test-plan template and of workflow 4 then ask for it.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/18-property-operations.md` (Harness friction 1; non-blocking 2); `scripts/scratch-stack.sh`; `test/helpers/scratchLoopback.js`.
