# Review: doc lane — K1 waits for its stand-in worker to remove its lock, and its ledger row is closed

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-16
**Diff:** `git diff origin/staging...HEAD` on `fix/k1-lock-check-waits`: two commits, `54d03799` and `0f61e7a4`, over `origin/staging` at `89376a4c` (the merge of PR #88). PR #90 into `staging`: open, mergeable, not a draft, head `0f61e7a4` (one `gh pr view`, read at 10:53:10Z).
**Lane:** doc lane, a one-liner (`engineering-team/workflows/0-intake.md` step 3: Implementer, then Reviewer, `:27`; a non-numbered review and no story, `:31`; no book, `:39`). The owner confirmed this path on 2026-11-16, as this review's brief records. This file is the lane's record. Template: the docs-mode variant in `templates/review-checklist.md` (`:20`).
**Spec:** OPEN.md row `2026-11-16-k1-lock-check-races-worker`: its "What was seen" (`:9`), "Likely cause" (`:11`) and "Fix shape" (`:13`). The close is checked against OPEN.md § "How to use this ledger" (`:23`, `:27`) and `templates/open-row.md` (`:20`).
**Filed under:** graph-operations-foundation, because the test's header names that epic's story 3 and ADR 0003 (`test/operations/lifecycle/migrate-job.test.js:4-7`).
**Files:** `test/operations/lifecycle/migrate-job.test.js` (+5 −1: base `:93` becomes `:93-97`), `ledger/2026-11-16-k1-lock-check-races-worker.md` (+2 −2, lines 6–7).

## Quality gates (run by reviewer, not trusted)

- [x] **The race, made wide, in memory.** I used my own throwaway script, outside the repo, not the Implementer's (next item).
  - It reads each commit's blob of the test with `git show`, not the file on disk. It compiles the blob with `Module._compile` under the file's real path, so the blob's requires resolve as usual.
  - It changes WORKER in memory only, in one of two ways. It inserts a busy-wait of N ms between the record write (`:47`) and the lock removal (`:48`), or it replaces the removal with a comment. It refuses to run unless the record write is directly followed by the one lock removal.
  - It evaluates the changed WORKER array and prints the script the worker will run, so I saw where the gap lands rather than assuming it.
  - It registers only K1, by filtering the suite kit's `test`, and times it. Every endpoint was dead (the brief's list), and each run was a fresh process, one after another.

  | Commit | WORKER | K1 | K1's time (ms) | Failure message |
  |---|---|---|---|---|
  | base `89376a4c` | as it is | 3 of 3 pass | 4,108–4,115 | — |
  | base | 300 ms gap | 3 of 3 fail | 4,099–4,115 | "the job releases its lock when it ends" |
  | base | never removes its lock | 1 of 1 fail | 4,111 | the same |
  | HEAD `0f61e7a4` | as it is | 3 of 3 pass | 4,092–4,108 | — |
  | HEAD | 300 ms gap | 3 of 3 pass | 4,380–4,410 | — |
  | HEAD | 1.5 s gap | 3 of 3 pass | 5,566–5,614 | — |
  | HEAD | 2.5 s gap | 2 of 2 fail | 6,139–6,192 | "the job releases its lock when it ends, within 2 s of writing its record" |
  | HEAD | 3 s gap | 2 of 2 fail | 6,185–6,188 | the same |
  | HEAD | never removes its lock | 2 of 2 fail | 6,133–6,136 | the same |

  - **The race is real.** With a 300 ms gap the base K1 fails on CI's assertion, at CI's moment. Here that is about 4.1 s into K1 run alone; in CI it was 4.1 s after the suite began (see "CI" below).
  - **The fix answers it.** HEAD's as-is time is the base's, so the wait costs nothing when the lock is already gone. HEAD passes the 300 ms and 1.5 s gaps by waiting them out (about +0.3 s and +1.5 s).
  - **The bound holds both ways.** HEAD fails a lock that outlives the bound (2.5 s, 3 s) and one that is never removed. Each failing run ends 2.03–2.09 s after HEAD's as-is runs.
- [x] **The Implementer's script, read and not reused.**
  - `k1-repro.js` changes WORKER the same way. It inserts the busy-wait before the lock line, refuses to run unless that line matches once, and has a "never" mode. It compiles under the path it is given and writes nothing itself.
  - It reads the source from disk, though. Its base runs could only have been made before the edit, so they can't be re-run against the committed tree. I took no result from its output files.
- [x] **The suite on its own at HEAD.** I ran it from disk with the dead-endpoint env (`node -e "require('./test/operations/lifecycle/migrate-job.test.js').run()…"`), with output to a file: `operations: lifecycle migrate job and key walk: 6 passed, 0 failed, 0 skipped`, exit 0, 13 s.
- [x] **The whole `operations` suite at HEAD** (`test/operations.test.js`), run the same way: `operations: 509 passed, 0 failed, 4 skipped`, exit 0, 64 s.
  - K's sub-suite in that run: 6 passed.
  - The four skips are LK1–LK4 in `test/operations/lifecycle/shared-keys.test.js`. They run only with `TAPESTRY_KEYS_LIVE=1` and a scratch container (`:313-324`).
- [x] **Nothing was written to the repo.** `git status --porcelain --ignored=matching` was identical before and after all my runs.
- [x] `git diff --check origin/staging...HEAD`: no output, exit 0. The added lines are printable ASCII.
- [x] `bash scripts/harness-lint.sh`: last line `harness-lint: clean (0 violations)`, exit 0.
  - L15 checks the row's filename and header fields.
  - Neither changed path is listed in `scripts/harness-def-paths.txt`, so L10 asks for no CHANGELOG row.
  - I ran it again with this review in place: still clean, exit 0. Its one line about this file is an INFO line (friction 1).
- [ ] `npm test`: **not run, on purpose.** On this Mac the full suite writes to a live instance that holds an agent's memory. `node test/gate-status.js` prints `no gate run records in <worktree>/tmp/gate-runs` and exits 2, so there is no local gate line to quote.
- [ ] **CI.** The check is `Test / stack-free`: `npm ci`, then `npm test`, on every pull request to `staging` or `main` (`.github/workflows/test.yml:11-12`, `:40-41`).
  - **As found** at 10:56:18Z (one `gh pr checks`): one check, `stack-free`, pending, run 43852429909. I did not wait for it (N2).
  - **The failure this PR answers.** I read the failed-step log of PR #83's run 43808151504, attempt 2, once (`gh run view --attempt 2 --log-failed`):
    - The K sub-suite began at 05:36:47.667Z.
    - `FAIL  K1: …` came at 05:36:51.763Z, 4.1 s later, with the message `the job releases its lock when it ends`.
    - The sub-suite ended `5 passed, 1 failed, 0 skipped`. The suite ended `[338/342] operations: FAIL (508 passed, 1 failed, 4 skipped) 123861ms`.
    - The run ended `Overall: FAIL — 7447 passed, 1 failed, 607 skipped across 342 suites · record tmp/gate-runs/20261116T053026Z-2396-a6a5.json`, then `Process completed with exit code 1`.
    - Every figure checked here matches the row's "What was seen" (`:9`). Attempt 1's figures were not checked.
- [ ] Playwright: not applicable (no UI).
- [ ] _Lint / typecheck / build not configured: skipped._
- [ ] Independent checker (`workflows/5-review.md`, "Optional: an independent check before the commit"): not applied, because this session can't start one. The session that commits this review can run one first.

## Claims adherence (doc-lane variant)

"Where" says who makes each claim: C is the message of commit `54d03799`, P is PR #90's body, D is the Done line (`ledger/…:7`), and S is the subject of commit `0f61e7a4`.

| # | Claim | Where | Evidence | Holds? |
|---|---|---|---|---|
| 1 | K1 checked the lock the moment it saw the job's record | C, P | Base `:92-93`: the lock assertion directly follows the record's, with no wait | Yes |
| 2 | WORKER writes the record and then removes the lock | C, P | `:47`, then `:48` | Yes |
| 3 | So a poll that lands between the two steps sees the record done and the lock still held | C, P | Gates, "The race": a 300 ms gap fails the base K1 on that assertion, 3 of 3 | Yes |
| 4 | That failed PR #83's CI (run 43808151504, attempt 2) on unchanged code | C, P; the row (`:5`, `:9`) | Gates, "CI": K1 failed there, on that assertion. **Unchanged:** `git diff 4df10d9b 89376a4c` over the test, `test/helpers/lifecycleFakes.js`, `_jobs.js` and `_store.js` is empty, and PR #83 changed only `test/dictionary-resync-concept.test.js` and its row. **"That" as the cause:** the log can't tell a late lock removal from no removal, because the old K1 fails both the same way at the same moment. The row calls the race the likely cause, not reproduced (`:11`). The widened gap gives CI's failure at CI's moment. The new K1 still fails a lock that never goes, so it can't hide the other reading | Yes, as the likely cause, which the reproduction supports |
| 5 | K1 now gives the second step up to 2 s, 40 polls 50 ms apart, then asserts that the lock has gone | C, P | `:95-97`: at most 40 sleeps of 50 ms while the lock exists, then the assertion. The bound counts timers, not clock time. On an idle machine the failing runs end 2.03–2.09 s after the as-is ones. On a loaded runner each timer can fire late, so the wait can stretch, but never past 40 timers | Yes |
| 6 | WORKER's two steps keep their order, as the row asks | C, P | The diff touches only `:93-97`. WORKER (`:39-51`) is the same at base and HEAD | Yes |
| 7 | So K1 still models the same job | C, P | It models the same job as before this change. That is not the real job's order: the real job releases its lock, then writes its record (N1) | Yes, read as "unchanged" (N1) |
| 8 | A 300 ms gap: the old K1 fails on "the job releases its lock when it ends", as in CI, and the new K1 passes | C, P | Base: 3 of 3 fail with that message. HEAD: 3 of 3 pass | Yes |
| 9 | A 1.5 s gap: the new K1 passes | C, P | 3 of 3 pass | Yes |
| 10 | A 3 s gap, and a worker that never removes its lock: the new K1 fails, "so it still catches a lock that is never released" | C, P | 2 of 2 fail for each, on the new message. A 2.5 s gap also fails, 2 of 2 | Yes |
| 11 | Shown on the suite compiled in memory under its real path, with WORKER busy-waiting between its two steps; nothing was written to the repo | C, P | Gates, "The Implementer's script": the method is as described, and the script writes nothing. Its results came from disk states that can't be re-run, so I re-derived each one from git blobs, and my runs left the tree's status unchanged | The method, yes. The results, re-derived here |
| 12 | With WORKER unchanged and every endpoint dead, the suite passes 6 of 6 | C, P | 6 passed, 0 failed, 0 skipped, exit 0 | Yes |
| 13 | The `operations` suite: 509 passed, 0 failed, 4 skipped | C, P | The same three figures, exit 0 | Yes |
| 14 | The full `npm test` isn't run on this Mac, since it writes to the owner's agent-memory instance; CI runs it on this pull request | P | `test.yml:11-12`, `:40-41`. The check was pending when read | Yes |
| 15 | It closes ledger row `2026-11-16-k1-lock-check-races-worker`, which PR #83's CI found (run 43808151504, attempt 2) | P | The row's Opened field (`:5`), and claim 16 | Yes |
| 16 | The row is closed: `**Status:** DONE` and `**Done:** 2026-11-16, in #90 (commit 54d03799)`. S reads "fixed by #90" | D, S; the diff (`:6-7`) | "The row close", below | Yes |
| 17 | The process: a one-liner under the intake table (step 3, Standard), so Implementer then Reviewer, with a doc-lane review and no story, as the owner confirmed. The second commit closes the row and names this PR | P | 0-intake `:27`, `:31`, `:39`. The owner's confirmation is in this review's brief, not in the repo. `0f61e7a4` names #90 | Yes |
| 18 | The review is to come, at `engineering-team/reviews/graph-operations-foundation/k1-lock-check-waits.md` | P | This file | Yes |

**The row close (claim 16).**
- **The form.** OPEN.md `:23` says to set DONE, fill Done and never delete. `:27` asks for an ISO date and the PR, and `templates/open-row.md:20` says the same.
- **The facts.** The date is both commits' UTC date (10:49:52Z and 10:50:28Z). #90 is this branch's PR, and `54d03799` is the commit that changes K1.
- **The hash stays reachable.** `staging` takes PRs as merge commits: its last twelve first-parent commits are merges, and `89376a4c`'s second parent is the merged branch's tip, `5466749a`.
- **Nothing else moved.** The file is not moved or renamed, its Id (`:3`) is unchanged, and L15 is clean.
- **Precedent.** A row has been closed by a second commit inside the PR that fixes it before: PR #83's `4df10d9b` ("fixed by #83"), now on `staging`.

## ADR adherence

Not applicable: the lane has no ADR. The row's Fix shape (`:13`) takes its place, and each of its asks is met.

- [x] "After seeing the record, wait for the lock to go, within a bound such as two seconds, then assert that it has gone": done at `:95-97`, and measured in Gates.
- [x] "This still fails if the lock is never released": see the never-removes runs.
- [x] "Don't swap the stand-in worker's two steps": WORKER is unchanged (claim 6). N1 is about the reason the row gives for this.
- [x] "a flake's answer is a cited quarantine entry, not a rerun" (OPERATIONS.md `:1048`, `:1050`): the PR adds no rerun and no quarantine file; it removes the race instead. For why no quarantine exists yet, the row cites OPEN.md row `2026-11-16-link-check-fails-during-prod-deploy`.
- [x] K1's other assertions (`:82-84`, `:92`) are unchanged. There are no new dependencies, no layering changes and no other files.

## Concept-graph integrity

- [x] No concept definition or handle is touched, so no firmware reinstall is needed.
- [x] There is no new code outside the test, so nothing has to orient via `/summaries`.

## Things tests can't catch

- [x] **Bounded.** The loop stops after 40 timers whatever the filesystem does, and K1 awaits it before the next test starts. No per-test or per-suite time limit exists for the added time to trip: none in the suite kit (`test/helpers/lifecycleFakes.js:937-988`), in `runDiscovered` (`test/operations.test.js:1159-1184`) or in the gate engine.
- [x] **No false pass.** Nothing in K1 but WORKER removes the lock. On this path `runDetached` returns `running` before any `releaseLock` (`src/operations/catalog/lifecycle/_jobs.js:499-503`), so a lock gone within the bound was removed by WORKER.
- [x] **The same race elsewhere.** K1 is the only check of this kind under `test/operations/`.
  - `backup-job.test.js`'s `FAKE_WORKER` has the same order (`:58-59`). But its two lock-gone checks run on paths where `runDetached` removes the lock itself before it resolves: J3 at `:164` (`_jobs.js:506`) and J6 at `:245` (`:477`).
  - The four other lock-gone checks run after a harness run has ended, with the job run inside the harness's own process (`test/helpers/operationsHarness.js:19-25`): `backup.test.js:184`, `migrate.test.js:219` and `:480`, and `upload-backup.test.js:131`.
- [x] **K1's other two time limits are unchanged.** They are `out.took < 2500` (`:83`), and the record poll's 120 × 50 ms (`:87-91`) for a record due about 4 s after the worker starts. Neither is what failed, and both are outside the row.
- [x] No secrets, no debug output and no commented-out code. The two added comment lines are prose.
- [x] Scope: exactly the row's fix and its close.
- [x] Architecture invariants: not engaged (a test and a ledger row).

## House rules check

- [x] Concept Graph API authority: not engaged.
- [x] No new lint, typecheck or build tooling.
- [x] No TA pubkey literal is added.
- [x] The comment at `:94` cites the row by its id, never its path (OPEN.md `:22`). It uses the "ledger <id>" form, which most code comments use.

## Product-guide adherence

Not applicable: no PRD-traced copy.

## Findings

### Blocking

None.

### Non-blocking

1. **The row's reason not to swap WORKER's steps (`ledger/2026-11-16-k1-lock-check-races-worker.md:13`) is backwards against the real worker.** What the row says about the stand-in itself (`:1`, `:11`) is accurate.
   - **What the real worker does.** The row says a swap "would change what K1 models". But the real job releases its lock first. Each job does it in its own `finally`: backup at `_jobs.js:265`, migrate at `:298`, restore at `:438`. That runs before `runJob` builds the record (`:451-452`), and `_worker.js:33` writes the record only after `runJob` has resolved (`:32`).
   - **What follows.** In the real job the lock is gone before the record appears, so the race exists only in the stand-in. A swap would have brought WORKER closer to `_worker.js`, not further from it.
   - **A likely source.** `runDetached`'s doc comment (`_jobs.js:463-464`) lists the steps in the stand-in's order ("finish, write its record and release its lock"). That may be where the stand-in's order came from.
   - **No change asked of this PR.** It does what the row asks, and the row is the spec. The bounded wait passes whichever order WORKER uses, and the comment at `:93` describes WORKER accurately.
   - **What it leaves.** The closed row keeps this reason, and C and P repeat "so K1 still models the same job" (claim 7). A later reader can take both to mean that WORKER follows the real job.
   - **Optional:** one follow-up row (type `cleanup`) to choose between two changes. Either WORKER releases, then writes, as `_worker.js` does, which removes the race at its source (the wait can stay as a guard). Or WORKER's doc comment (`:38`) says that its order is the reverse of the real one, on purpose.
2. **For the merge, not the diff: CI's verdict for `0f61e7a4` was pending when I read it** (Gates, "CI").
   - Under OPERATIONS.md `:1048`, the first run's exit code is the verdict.
   - `staging` has no required checks (`:119`), so whether to merge is the merger's call.
   - **Suggested:** whoever merges reads the first run's verdict for this head and cites it. If it is red, they look for its cause rather than rerun it, as this PR does for #83's failure.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **`scripts/harness-lint.sh:111` says this review "predates the numbering convention".** It is a doc-lane review, and 0-intake step 3 (`:31`) gives doc-lane reviews exactly this non-numbered form. The open row `2026-11-16-lint-mislabels-doc-lane-reviews` already covers this, so there is no new row.

## Verdict

**PASS**

The diff is the row's fix shape and its close, and nothing else.
- **The race is real.** With a 300 ms gap between WORKER's two steps, the base K1 fails on CI's assertion at CI's moment, and HEAD's K1 passes by waiting the gap out.
- **The wait is bounded.** It stops after 40 timers, about 2.0–2.1 s here, and costs nothing when the lock is already gone. It still fails a lock that outlives it or is never removed.
- **The gates are clean.** At HEAD, stack-free, the suite passes 6 of 6, and the whole `operations` suite gives 509 passed, 0 failed, 4 skipped. Lint is clean, and the diff's whitespace check is empty.
- **The claims hold.** Every claim in the commit message and the PR body holds.

One premise in the spec is backwards, but it doesn't bear on the diff (N1). CI for this head was still running when read (N2).

## On PASS (same commit)

- [x] No story to mark Done: the doc lane has none (0-intake step 3).
- [x] Completion detection: none needed. A doc-lane one-liner opens no book (0-intake `:39`).
- [ ] Commit: left to the session that launched this review, which asked the Reviewer not to commit. The role's rule is to commit the review whatever the verdict. Suggested message: `review: k1-lock-check-waits — PASS (graph-operations-foundation, doc lane)`.
