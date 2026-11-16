# K1 checks the lock the moment the job's record appears, but its stand-in worker writes the record before it removes the lock, so K1 can fail on unchanged code

**Id:** 2026-11-16-k1-lock-check-races-worker
**Type:** bug
**Opened:** 2026-11-16 (PR #83's CI, Actions run 43808151504, attempt 2)
**Status:** DONE
**Done:** 2026-11-16, in #90 (commit 54d03799)

**What was seen.** Attempt 2 of PR #83's stack-free run, at 4df10d9b, ended "Overall: FAIL — 7447 passed, 1 failed, 607 skipped". The one failure was the `operations` suite's K1 (`test/operations/lifecycle/migrate-job.test.js`), "runDetached with waitMs answers { outcome: 'running' } once the wait is up, while the job runs on, holds its lock, and later writes its record". It failed on its last assertion, "the job releases its lock when it ends", at 05:36:51.763Z, 4.1 seconds after its suite began. Attempt 1 ran the same commit and passed K1, with 509 of the `operations` suite's tests passing and none failing. The suite took 124 seconds in attempt 2, against 98 in attempt 1.

**Likely cause, not reproduced.** K1's stand-in worker (`WORKER` in that file) ends its job in two steps: it writes the finished record, then reads the lock and removes it. K1 polls the record every 50 ms, and checks the lock as soon as it sees the record. A poll that lands between the two steps sees the record done and the lock still held. K1 failed at the moment the worker writes its record (its delay is 4 seconds). On this path `runDetached` (`src/operations/catalog/lifecycle/_jobs.js`) answers `running` without touching the lock, so only the worker removes it. 80 runs of the worker's two steps on an idle Mac, polled every 0 and every 50 ms, never caught the gap. A loaded runner can stall a process between two calls for longer.

**Fix shape.** After seeing the record, wait for the lock to go, within a bound such as two seconds, then assert that it has gone. This still fails if the lock is never released. Don't swap the stand-in worker's two steps to fix it: that would change what K1 models. Under OPERATIONS.md §15, a flake's answer is a cited quarantine entry, not a rerun, and OPEN.md row `2026-11-16-link-check-fails-during-prod-deploy` says why that isn't built.

**Pointer:** PR #83's CI (Actions run 43808151504, attempt 2); `test/operations/lifecycle/migrate-job.test.js`, K1 and `WORKER`.
