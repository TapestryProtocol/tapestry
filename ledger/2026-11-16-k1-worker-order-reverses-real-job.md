# K1's stand-in worker writes its record before it removes its lock, the reverse of the real job, so the race #90 waits out exists only in the stand-in

**Id:** 2026-11-16-k1-worker-order-reverses-real-job
**Type:** cleanup
**Opened:** 2026-11-16 (review of #90, its non-blocking 1)
**Status:** OPEN
**Done:** —

**What was seen.** #90's review (`engineering-team/reviews/graph-operations-foundation/k1-lock-check-waits.md`, non-blocking 1) read the real job's order. Each lifecycle job releases its lock in its own `finally` (`src/operations/catalog/lifecycle/_jobs.js:265`, `:298`, `:438`), and `_worker.js` writes the record only after the job returns (`:32–33`). So the real job removes its lock first and writes its record second. K1's stand-in `WORKER` (`test/operations/lifecycle/migrate-job.test.js`) does the reverse, and that is the only reason a poll could see the record done while the lock is still held. OPEN.md row `2026-11-16-k1-lock-check-races-worker` said a swap "would change what K1 models". Against the real worker, a swap would bring K1 closer to it.

**Fix shape.** Either is a test-only one-liner, and it is the owner's call:
- reorder `WORKER` to remove its lock, then write its record, as the real worker does. K1's bounded wait from #90 then never waits, and stays as a guard;
- or keep the order, and say in `WORKER`'s comment that it is the reverse of the real job's on purpose, to exercise the wait.

**Pointer:** the review above; `_jobs.js`, each job's `finally` (`store.releaseLock`); `_worker.js:32–33`; `migrate-job.test.js`, `WORKER`.
