# Story 3: RW7 times each restart from when node really started, so a busy test process can't fail it

**Status:** Done
**Created:** 2026-11-18
**Type:** Bug

## Background

RW7, in the tagging-edges real-time wrapper's suite (`tagging-edges` #3), checks that a node which exits at once is restarted with backoff, not in a hot loop: the second start must come 0.8–3.5 s after the first. The wrapper sleeps a full second between a node's exit and its next start, so the real gap can't be under 1 s.

RW7 fails anyway, reading 0.64–0.78 s:
- **in more than a dozen local gate runs since 2026-10-08,** recorded on ledger row `2026-10-08-realtime-wrapper-timing-flake-under-load`;
- **on CI four times since 2026-11-13,** about one run in 28. Each was on a pull request that didn't touch the wrapper.

Alone, the suite has passed every time it was tried.

**The cause,** reproduced on 2026-11-18:
- The suite times a start by when it first notices it, not by when it happened.
- It starts all its scenarios at once, which launches about 23 processes in one burst.
- The full gate runs every suite inside one process. Launching a process costs more the more memory that process holds: by RW7's turn, about 15 ms each instead of 1 ms.
- So the burst keeps the suite from looking for a quarter of a second or more, and it notices the first start late.

**The reproduction,** in a throwaway Linux container:
- At 55 MB, the suite alone passed RW7 three times out of three.
- Holding 1 GB more, it failed three times out of three, at 0.74–0.78 s, as on CI.
- At 3 GB, it read 0.10–0.56 s.

**Who it hurts:**
- **Everyone whose pull request runs the gate.**
- **Promotions:** `stack-free` is a required check on `main`, so a promotion that hits RW7 is blocked.
- **The owner:** OPERATIONS.md §15 forbids reruns, so each hit costs the owner a decision. Two of the four CI hits were rerun anyway.

## User-facing description

As anyone whose pull request runs the gate, I want RW7 to fail only when the wrapper really restarts too soon, so that a red gate means the code is wrong, not that the test process was busy.

## Acceptance criteria

- [ ] **AC1 — A busy test process doesn't shorten a gap.**
  - **Given** the wrapper restarting a node that exits at once,
  - **when** the suite's own process is held up for half a second around the first start,
  - **then** RW7 reads the first restart as the wrapper's real backoff: no less than 1 s after the first start, minus a few milliseconds of clock granularity. RW7 passes.
- [ ] **AC2 — Inside a big process too.** Given the suite run in a process that holds about a gigabyte more memory than it needs, as it does inside the full gate, RW7 passes in three runs out of three. Today it fails there.
- [ ] **AC3 — RW7 still catches a hot loop.** Given a wrapper that restarts node with no backoff, RW7 fails and names the gap.
- [ ] **AC4 — Nothing else changes.** Given the suite run alone, every case passes as before (24 of 24), and no check's window is widened.
- [ ] **AC5 — The records say what happened.**
  - Ledger row `2026-10-08-realtime-wrapper-timing-flake-under-load` is closed, with its cause.
  - `.github/workflows/test.yml`'s header and OPERATIONS.md §15 no longer claim a record of no flakes. They say instead which flake was found, and that it was fixed at its root, so §15's quarantine file stays unneeded.

## Concepts touched

None in the concept graph: this is test infrastructure. The wrapper under test is `tagging-edges` #3's real-time path.

## Out of scope

- **The wrapper itself.** It already sleeps the full backoff.
- **The suite's other windows,** which time from a test's own action to a start, an exit or a signal (RW3, RW9–RW13, RW20, RW24). They have generous upper bounds and haven't failed on CI. One that does gets its own row.
- **RW15,** a process group still alive 3 s after a SIGKILL. It's a different check, seen once, on 2026-09-30.
- **`setup-alert-polish`'s failures:** 31 of 36 failed CI attempts, from 2026-11-06 to 2026-11-14, and none since.
- **Running suites in separate processes,** or making process launches cheaper.
- **OPERATIONS.md §15's quarantine file.** It isn't needed if RW7 is fixed at its root.

## Open questions

- None that block.

## Deviations

- **AC5 names four flakes, not one.** AC5 says §15 should say "which flake was found". Four stack-free flakes are on record: the three from 2026-11-16 that ledger row `2026-11-16-ci-gate-flake-history-claim-untrue` lists, and RW7.
  - So §15 names all four, and `test.yml`'s header points to it.
  - That row says the policy's wording is the owner's to reword. The owner approved what AC5 asks for, not these words, so the words go to the owner at the pull request.
  - Its other question, whether the quarantine file is still the answer to a flake, is left to the owner. The row stays OPEN for it.
- **How a start is timed.** The stub makes a `start-time.<pid>` file as its first act, and the suite reads that file's mtime. It costs no process per start, and works the same on macOS and Linux. Without the file, a start falls back to when it was first seen.
- **Of the checks that predate this story, only RW7 and RW22 read a start's time, and both became exact.** Every start record's time moved to the start itself. RW25, new here, reads it too, and the quick scenario ends its window from the first start's time.
  - RW7 checks the gaps between starts.
  - RW22 reads the offsets between starts, in a fixture check and in its messages.
  - RW3, RW9, RW10 and RW24 compute an `ms` from a start that nothing reads. Their windows are `waitFor` timeouts, and are unchanged.
  - No window was widened.
  - Review round 1 corrected this note, which first said those four time to a start.
- **`test.yml`'s new comment avoids the words "retry" and "rerun".** `ci-test-job` W8 forbids them anywhere in the workflow file, comments included. The first wording, "never a retry", failed W8 in the first scoped gate, and was reworded to "not a second run".

## Evidence

### The suite (Implementation, 2026-11-18)

- **This Mac** (bash 5.3.15, the perl flock(2) shim): the suite alone passed 25 of 25, three runs out of three.
- **Linux** (a throwaway `node:22-bookworm` container, Node 22.23.3, flock(1); the worktree mounted read-only): 25 of 25 in each of nine runs (`tmp/rw7-probe/green.out`).

  | Ballast | Each spawn (median) | Spawning in the first second | RW7 and RW25 |
  |---|---|---|---|
  | none (55 MB) | 0.9–1.2 ms | 21–26 ms | pass, three of three |
  | 1 GB (1.19 GB) | 14.7–15.7 ms | 360–382 ms | pass, three of three |
  | 3 GB (3.24 GB) | 30.5–45.6 ms | 680–736 ms | pass, three of three |

  Before the fix, at 3 GB, RW7 failed three of three, at 0.44–0.55 s (`red-3gb.out`). At 1 GB it failed three of three in the first probe (`run1.out`), when each spawn took about 15.6 ms, as here.
- **AC3, the hot-loop mutation** (a copy of `run.sh` with `nap "$backoff"` replaced by `:`, the fix in place): RW7 fails, with "a hot loop: 1918 starts in 6.50 s". So do RW18, RW19, RW20, RW22 and RW25 (19 passed, 6 failed).
- **M2, the fix removed** (a copy of the suite without the stub's stamp line): RW25 fails at 0.52 s. At 3 GB, RW7 fails again too, at 0.52–0.56 s. So the stamp is what passes them.
- **The scoped gate,** through the gate engine, never the full `npm test` on this Mac. It ran the changed suite and every registry entry that reads the wording or records changed here, with every endpoint dead and `TAPESTRY_CONTAINER=no-such-container`:
  - the suites: `tagging-edges-realtime-wrapper`, `ci-test-job`, `live-link-checks`, `workflow-hardening`, `honest-publish-reporting-ci-guard`, `information-for-agents`, `llms-txt`, `harness-lint`, `ledger-row-ids` and `session-start`;
  - its record, `20261118T172233Z-40726-60bc [thg-3-impl]`: PASS, exit 0, 272 passed, 0 failed, 41 skipped, 10 of 10 suites.

  All three of these gate runs were on `92554055+dirty`, before `7b6e0e24` existed, so none could see L10's view of that commit (round 1, blocking 1). The run before it, `20261118T171956Z-88650-afc8`, failed `ci-test-job` W8 alone, on the comment's wording (Deviations). The run after this section and the "Last updated" bump were written, `20261118T172451Z-92271-e982 [thg-3-impl-final]`, passed with the same counts.

The probe, its scripts and their output are in the main checkout's `tmp/rw7-probe/`.

### Review round 1's fixes (2026-11-18)

- **The fixes are committed as `9ea9c95a`,** after round 1's review (`04b8fe47`). The suite's code didn't change.
- **`bash scripts/harness-lint.sh`** on the committed tree is clean. Before the fixes it failed L10 on `7b6e0e24`. While making them it failed L15 once, on a row name over six words; the row was renamed `2026-11-18-no-map-of-suites-per-file`.
- **The scoped gate,** on the committed, clean tree, with the reviewer's seven suites added (17 in all), every endpoint dead:
  - its record, `20261118T192258Z-89344-3bf5 [thg-3-r1-fixes]`: 380 passed, 3 failed, 41 skipped;
  - the three failures: `router-stream-limit-on-connect` P1–P3, the known GNU `sed -i` problem on macOS (ledger row `2026-10-09-router-patch-sed-macos`). This branch changes neither that suite nor `src/`. In the Linux container the suite passed 26 of 26.

### Review round 2's fixes (2026-11-18)

- **The fixes are committed as `ea51978d`,** after round 2's review (`e313f62e`). The suite's code didn't change.
- **`bash scripts/harness-lint.sh`** on the committed tree is clean.
- **The scoped gate,** on the committed, clean tree, every endpoint dead. It ran the 17 suites above plus `rollup-scanners` and `harness-stats`, which read the ledger rows and the branch's commits (19 in all):
  - its record, `20261118T195354Z-73187-3343 [thg-3-r2-fixes]`: 425 passed, 3 failed, 41 skipped. `rollup-scanners` passed 33 of 33, and `harness-stats` 12 of 12;
  - the three failures: `router-stream-limit-on-connect` P1–P3 again, the macOS `sed` problem.
- **In the Linux container:** `router-stream-limit-on-connect` passed 26 of 26, and `tagging-edges-realtime-wrapper` 25 of 25.

## Linked artifacts

- ADR: none. Architecture is skipped: a Bug whose fix follows from its cause, under Standard.
- Test plan: `engineering-team/stories/test-suite-hermeticity/3-rw7-times-restarts-from-the-real-start.test-plan.md`
- Review: `engineering-team/reviews/test-suite-hermeticity/3-rw7-times-restarts-from-the-real-start.md`
- Ledger: `ledger/2026-10-08-realtime-wrapper-timing-flake-under-load.md`
- The reproduction: the probe and its output, in the main checkout's `tmp/rw7-probe/` (git ignores it).
