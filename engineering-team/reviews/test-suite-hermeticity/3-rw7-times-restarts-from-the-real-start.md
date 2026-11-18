# Review: Story 3 — RW7 times each restart from when node really started, so a busy test process can't fail it

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-18
**Diff:** `git diff 566d2eb3...HEAD`: story `66122101`, test plan and failing test RW25 `92554055`, implementation and
records `7b6e0e24`. Reviewed at `7b6e0e24` on `feat/honest-test-gate` (not pushed; base `origin/staging` at
`566d2eb3`). No ADR: a Bug under Standard, Architecture skipped. The contract is the story, its Deviations and the
test plan.

## Quality gates (run by reviewer, not trusted)

- [ ] `npm test` (the full gate): **not run on this Mac.** The local `tapestry` container is the owner's agent-memory
      instance, which the full suite writes to. In its place, a scoped gate through the gate engine, with every
      endpoint dead (every URL and port at `:9`, `TAPESTRY_CONTAINER=no-such-container`, `BRAINSTORM_CONF_PATH` a dead
      conf):
      `20261118T182326Z-4562-2735 [thg-3-review] started 2026-11-18T18:23:26.562Z on 7b6e0e24 — FAIL, exit 1, 378 passed, 5 failed, 41 skipped, 17/17 suites; failed: harness-lint, router-stream-limit-on-connect`
  - **The suites:** the Implementer's ten (`tagging-edges-realtime-wrapper`, `ci-test-job`, `live-link-checks`,
    `workflow-hardening`, `honest-publish-reporting-ci-guard`, `information-for-agents`, `llms-txt`, `harness-lint`,
    `ledger-row-ids`, `session-start`), plus seven registry suites that read OPERATIONS.md's text at runtime and were
    missing from that list (non-blocking 4).
  - **`harness-lint` 83/2/0, caused by this diff.** "the real repo lints clean" and "… from a shallow clone, 50
    commits deep and 1 commit deep" fail on lint L10 (blocking 1).
  - **`router-stream-limit-on-connect` 23/3/0, not caused by this diff.** P1–P3 fail with `sed: … invalid command code
    f`: macOS's BSD `sed -i`, ledger row `2026-10-09-router-patch-sed-macos` (OPEN). In the Linux container the suite
    passed 26/0/0. Its OPERATIONS.md check, O1, passes on both.
  - **Every other suite passed.** `tagging-edges-realtime-wrapper` 25/0/0, `ci-test-job` 14/0/0, `live-link-checks`
    26/0/0, `workflow-hardening` 36/0/0, `honest-publish-reporting-ci-guard` 4/0/1, `information-for-agents` 32/0/25,
    `llms-txt` 12/0/15, `ledger-row-ids` 6/0/0, `session-start` 32/0/0, `bullboard-admin-access` 9/0/0,
    `generalized-task-scheduler` 12/0/0, `reconciliation-rearchitecture` 15/0/0, `reconciliation-incremental-mode`
    16/0/0, `task-queue-bullmq` 18/0/0, `task-queue-neo4j-resource-class` 15/0/0.
  - **The Implementer's three records ran on a dirty tree:** `20261118T171956Z-88650-afc8`,
    `20261118T172233Z-40726-60bc` and `20261118T172451Z-92271-e982` were all `on 92554055+dirty`, before `7b6e0e24`
    existed. L10 reads commits only, so none of them could see the violation.
  - **No GitHub reads.** `session-start`'s roll-up tests shadow `gh` with a stub that fails at once
    (`test/helpers/rollupFixtures.js:24–33`).
- [x] **The suite alone, this Mac** (bash 5.3.15, the perl flock(2) shim): 25/0/0, three runs of three.
- [x] **The red phase, this Mac,** from scratch copies (the suite at the commit; fixtures and `run.sh` are unchanged
      across the range):
  - at `92554055`: 24/1/0 twice, RW25 failing alone: "the first restart read 0.53 s" (then 0.58 s) "after the first
    start, with the suite held up until 0.50 s after node first started";
  - at `566d2eb3`: 24/0/0.
- [x] **Linux,** a throwaway `node:22-bookworm` container (Node 22.23.3, flock(1), 4 CPUs, kernel 6.8.0-100-generic),
      the worktree mounted read-only, the probe `tmp/rw7-probe/rw7-probe.js`. First the Implementer's `verify-fix.sh`,
      rerun as-is, then my own baselines (`tmp/rw7-review/review-checks.sh`; outputs `part1.out`, `part2.out`):

  | Ballast | Suite | Spawn median, and spawning in the first second | Result |
  |---|---|---|---|
  | none ×3 | HEAD | 0.8–0.9 ms; 19–22 ms | 25/0/0 each |
  | 1 GB ×3 | HEAD | 12.4–13.4 ms; 307–343 ms | 25/0/0 each |
  | 3 GB ×3 | HEAD | 50.7–50.8 ms; 708–714 ms (14 of 23 spawns) | 25/0/0 each |
  | 3 GB, `yes` on every CPU | HEAD | 53.1 ms | 25/0/0 |
  | none | AC3 mutation (`nap "$backoff"` → `:`) | 0.9 ms | 19/6/0; RW7 "a hot loop: 1916 starts in 6.50 s"; RW18, RW19, RW20, RW22, RW25 fail too |
  | none | M2 (the stamp line removed) | 0.8 ms | 24/1/0; RW25 at 0.52 s |
  | 3 GB | M2 | 50.7 ms | 23/2/0; RW7 at 0.26 s and 0.30 s, RW25 at 0.52 s |
  | none | `566d2eb3` | 0.9 ms | 24/0/0 |
  | 1 GB ×3 | `566d2eb3` | 15.0–17.7 ms | RW7 failed 1 of 3 (0.78 s, both cases, at 17.7 ms); 24/0/0 twice |
  | 3 GB ×3 | `566d2eb3` | 34.5–39.7 ms | RW7 failed 3 of 3, at 0.42–0.52 s |
  | none, 3 GB | `92554055` | 0.9 ms; — | RW25 at 0.53 s both; at 3 GB RW7 too, at 0.39–0.43 s |

  The container's `os.tmpdir()` stamps mtimes in 1 ms steps (3,000 files in 44 ms, 45 distinct values), inside
  RW25's 20 ms `clockSlack`.
- [ ] **`bash scripts/harness-lint.sh`:** exit 1, one violation:
      `VIOLATION L10 commit:7b6e0e24 — latest harness-definition commit (impl: rw7-times-restarts-from-the-real-start (test-suite-her…) did not touch engineering-team/CHANGELOG.md — add the row (one per logical change)`.
      At the base, the latest harness-definition commit, `3c874499`, touched the CHANGELOG, so the lint was clean
      there. In a throwaway clone, one more commit appending a CHANGELOG row gives `harness-lint: clean (0 violations)`.
- [x] `git diff --check 566d2eb3...HEAD`: clean.
- [ ] `npm run test:playwright`: not applicable (no browser surface).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

The optional independent check before commit (workflow 5) was not applied: this isn't a docs-mode story.

## Spec adherence

| AC | Met? | Evidence |
|---|---|---|
| AC1 | yes | RW25 (`test/tagging-edges-realtime-wrapper.test.js:1326–1366`) fails at `92554055` for the stated reason (this Mac 0.53 s and 0.58 s, Linux 0.52–0.53 s): the first start is timed at the hold-up's end. It passes at HEAD in every run. RW25 is byte-identical between `92554055` and `7b6e0e24`; the fix commit touches only the stub's stamp line, `observe()` and comments, so the Tester's test was left alone. |
| AC2 | yes | At 1 GB of ballast, 3 of 3. At 3 GB, 3 of 3. At 3 GB with every CPU busy, 1 of 1. The story's "Today it fails there" is machine-dependent at 1 GB, as the test plan's correction says: the pre-story suite failed RW7 in 1 of 3 runs there, and in 3 of 3 at 3 GB. |
| AC3 | yes | With the fix in place and the backoff removed, RW7 fails with "a hot loop: 1916 starts in 6.50 s" (19 passed, 6 failed). |
| AC4 | yes | 25/0/0 alone on both OSes. The diff adds `MS.holdUp` and `MS.clockSlack` and changes no existing `MS` entry and none of RW7's bounds (0.8–3.5 s, at least 1.6 s, at most 4 starts). |
| AC5 | **no** | The RW7 row is DONE with its cause, and neither header claims a no-flake record any more. But the wording that replaces it doesn't match the records (blocking 2). |

- [x] Every acceptance criterion has a test or a recorded verification that I reran (AC2 and AC3 by container).
- [ ] No criterion silently dropped. None is dropped, but AC5 is unmet as written (blocking 2).
- [x] No behavior added that isn't in the story: test infrastructure and records only.

**The cause, re-derived.**
- The gate engine loads every suite, then runs them one at a time in one process (`test/helpers/gateRunner.js:157–182`).
  This suite is the 310th of the registry's 350 entries (`test/registry.js:353`).
- `startAll()` (`test:879–887`) queues every scenario as a microtask, so every scenario's synchronous prefix runs in one
  turn: 21 wrapper spawns. The quick scenario's two come 7th and 8th (`SCENARIOS` order), so the 13 after them block
  the event loop before the first observer tick.
- Each spawn's cost grew with the process's memory: about 0.9 ms with no ballast, 12–18 ms with 1 GB, and 34–53 ms
  with 3 GB.
- Before the fix, the first start's `at` was that late first tick, and the second start was seen on time. So the
  first gap shrank by however long the burst lasted.

**The fix, checked.** The stamp (`test:219`) is the stub's first act. Everything between one start's stamp and the
next start's stamp happens after the first stamp: the stub's exit, the wrapper's `wait`, its echo, `nap 1` (a real 1 s
sleep in the quick scenario's default sleep mode, `run.sh:64`), and the next fork, source and exec (`run.sh:52`). So a
delay on either side can only lengthen a stamp-to-stamp gap. Only mtime granularity can shorten one: 1 ms measured,
against 20 ms of slack.

**Every other reader of a start's time:**
- **RW7** (offsets at `test:619–624`), **RW22** (`test:1286`, a fixture floor of 3 s on a gap of about 4 s) and
  **RW25:** stamp against stamp, now exact.
- **The quick scenario's window end** (`test:619–620`): a stamp plus 6.5 s, compared with `Date.now()`. The two clocks
  differ by no more than the mtime granularity, which doesn't matter at 6.5 s.
- **RW3, RW9, RW10 and RW24:** they don't read `at`. See non-blocking 1.
- **RW20** times an exit (`test:1219`), not a start, and is untouched.
- **The other lines:** signals, stops and timeouts keep their observation times. RW11 and RW12 read only pids.

## ADR adherence
- [x] No ADR (a Bug, Architecture skipped under Standard). The files changed are one test suite and records. The
      wrapper (`src/pipeline/tagging-edges/realtime/run.sh`) is unchanged, as the story's Out of scope says.
- [x] Layering: no production code touched.
- [x] No new dependencies.

## Concept-graph integrity
- [x] Handles: none touched (test infrastructure).
- [x] Firmware: no concept definitions changed, so no reinstall.
- [x] `/summaries` orientation: not applicable.

## Things tests can't catch
- [x] No secrets in committed files.
- [x] No leftover debug logging or `console.log`.
- [x] No commented-out code.
- [x] **Error paths.** A start without a stamp falls back to when it was first seen (`test:439–441`). RW25 keeps that
      fallback from taking over unnoticed: with the stamp line removed it fails at 0.52 s (M2).
- [x] **Concurrency.** RW25's busy-wait stalls the event loop about 0.5 s (the probe's worst stall: 520–548 ms with no
      ballast). But the engine runs one suite at a time, and RW25 first awaits every scenario, so it holds up no other
      clock. A pid reused inside one scenario's stub dir (`start-time.<pid>`) would need the pid space to wrap within
      seconds, which isn't a practical risk.
- [x] **Security:** not applicable (test-only; temp dirs under `os.tmpdir()`).

## House rules check
- [x] Concept Graph API authority respected: not applicable.
- [x] No new lint/typecheck/build tooling.
- [ ] **Every harness change is a recorded event** (`engineering-team/README.md` § "Tuning the team"). `.github/workflows`
      is a harness-definition path (`scripts/harness-def-paths.txt:45`), and the diff adds no CHANGELOG row
      (blocking 1).
- [x] No TA pubkey used. ADR 0015's `LEGACY_*` constants are untouched.

## Product-guide adherence *(when the story traces to a PRD)*
- [x] Not applicable: no PRD and no user-facing copy.

## Findings

### Blocking
1. **`engineering-team/CHANGELOG.md` (no row) · `.github/workflows/test.yml:6–8`** — The diff rewords the no-retry
   policy's premise in `.github/workflows/test.yml`, a harness-definition path (`scripts/harness-def-paths.txt:45`),
   with no CHANGELOG row.
   - **What breaks:** `bash scripts/harness-lint.sh` exits 1 with `VIOLATION L10 commit:7b6e0e24`. That fails the
     gate: `harness-lint`'s "the real repo lints clean" and "… from a shallow clone, 50 commits deep …" tests, in
     record `20261118T182326Z-4562-2735`.
   - **On CI too:** CI checks out with `fetch-depth: 0` "so harness-lint L9/L10 (git-log-based) stay live in CI"
     (`test.yml:34–35`). So this PR's `stack-free` check would go red, on the story meant to make that check honest.
   - **Why nobody saw it:** the Evidence's green scoped gates (story lines 93–97) all ran on `92554055+dirty`.

   **Asked change:**
   - Add one CHANGELOG row (date, change, why, origin) for the reworded premise: `test.yml`'s header and OPERATIONS.md
     §15's "No-retry policy" and "First-flake waiver pattern". Its origin is ledger rows
     `2026-11-16-ci-gate-flake-history-claim-untrue` and `2026-10-08-realtime-wrapper-timing-flake-under-load`.
   - Make it a commit after `7b6e0e24`. Blocking 2's fix can share that commit.
   - Then, on the committed HEAD, run `bash scripts/harness-lint.sh` (expect `harness-lint: clean (0 violations)`) and
     the scoped gate.
   - Record that run in Evidence with its commit, not `+dirty`, and say that the earlier records were of a dirty
     tree.
   - Already checked: in a throwaway clone, one commit appending a CHANGELOG row clears L10.
2. **`OPERATIONS.md:1060` · `.github/workflows/test.yml:7–8` · `ledger/2026-11-16-ci-gate-flake-history-claim-untrue.md:19`**
   — The new wording doesn't match the records, and saying what happened is AC5's whole ask. It replaces §15's untrue
   "zero recorded-flake history" with another untrue premise, in the same paragraph.
   - **`OPERATIONS.md:1060`** says "Each one found so far has had a ledger row and a fix, never a retry". The RW7 row
     cited at line 1064 records the opposite: "Retried twice, against §15. Two of the four were run again by hand,
     and each passed on attempt 2: `43985723290`, and #143's `44335714732`, on which #143 merged"
     (`ledger/2026-10-08-realtime-wrapper-timing-flake-under-load.md:128`). The story's Background says so too (story
     line 31: "Two of the four CI hits were rerun anyway").
   - **`test.yml:7–8`** says "Each stack-free flake found so far got a ledger row and a fix at its root, not a second
     run". Two of RW7's CI failures did get a second run. And the live link checks were moved out of the gate, not
     fixed at their root: §15's own waiver paragraph says "each was fixed at its root or moved out of the gate"
     (`OPERATIONS.md:1068`).
   - **The 2026-11-16 row's note** (line 19) repeats "never a retry".

   **Asked change:**
   - Reword all three so they hold against the ledger. Each flake got a ledger row and was fixed at its root, or moved
     out of the gate, rather than retried away.
   - Say plainly that two of RW7's four CI failures were run again by hand anyway, against this policy, and cite the
     row.
   - In `test.yml`, keep out the words `ci-test-job` W8 forbids anywhere in the file: `\bretry\b`, `rerun` and
     `--retries`. ("retries" and "run again" pass it.)
   - Any wording suggested here is itself a claim for the next round to check.

### Non-blocking
1. **Story line 74 · test plan lines 37–40** — "RW3, RW9, RW10 and RW24 time from the suite's own action to a start.
   Each of those windows can only shorten": those four checks don't read a start's `at`.
   - Each window is a `waitFor` timeout on the observed start count (`test:566`, `645`, `672`, `861`).
   - The `ms` each scenario computes from `at` (`test:567`, `647`, `673`, `862`) is read by no assertion or message.
   - So they are unchanged, not shortened. The conclusion, that no window was widened, holds.

   Optional improvement: correct the reasoning, and tick or reword the test plan's unchecked box at line 37.
2. **`ledger/2026-10-08-realtime-wrapper-timing-flake-under-load.md:13`** — "were other checks under deliberate load"
   isn't what the row records.
   - It records RW15's failure as "Two gate containers ran at once on one Docker VM" (lines 18–20).
   - It records the 18-failure run as "beside a UI build and 185 browser tests in the same session" (lines 31–36).
   - That is concurrent load, not shown to be deliberate.
   - Closing the row DONE, with RW15 left to a new row if it recurs, is sound. RW15 hasn't recurred since 2026-09-30,
     the scan of 181 CI runs found none, and the my-assistants #1 review set the same bar (line 20).

   Optional improvement: say what the row says.
3. **Story line 71 · `ledger/2026-11-16-ci-gate-flake-history-claim-untrue.md:18`** — "It takes this rewording as the
   owner's, through his approval of AC5".
   - The owner approved what AC5 asks for, not these words, and the words needed a correction (blocking 2).
   - Naming four flakes instead of "which flake" is right: naming one would have implied the other three never
     happened.
   - Keeping the row OPEN for the quarantine-file question is right too.

   Optional improvement: say the wording goes to the owner at the PR, rather than that it is his.
4. **The scoped gate's suite list** (`gate-rw7.js`, as listed at story line 94) — It leaves out seven registry suites
   that read OPERATIONS.md's text at runtime: `bullboard-admin-access` T8, `generalized-task-scheduler` T8,
   `reconciliation-rearchitecture` T11, `reconciliation-incremental-mode` T10, `router-stream-limit-on-connect` O1,
   `task-queue-bullmq` T11 and `task-queue-neo4j-resource-class` T10. Each one's OPERATIONS.md check passes here.

   Optional improvement: include them in the next round's scoped gate.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. **A gate run before the commit can't see L10.** L10 reads commits only, so a scoped gate on a dirty tree is green
   while the committed HEAD fails `harness-lint`'s real-repo tests. This book has now hit it twice: honest-test-gate #2
   at `36e123d2` (fixed before its review) and here at `7b6e0e24`. Nothing in the Implementer's phase says to run
   `bash scripts/harness-lint.sh` after the implementation commit.
2. **`scripts/harness-def-paths.txt:16–17` is stale.** It says GitHub is retired and "no workflow runs" (nous-clawds4
   suspended 2026-10-19; repo now on ngit). But the `Test` workflow runs on TapestryProtocol/tapestry (181 runs since
   2026-10-27, per `ledger/2026-10-08-realtime-wrapper-timing-flake-under-load.md:117`), with `fetch-depth: 0`, so L10
   is live in CI.
3. **Nothing lists the registry suites that read a given file,** so each role greps by hand. The Implementer's list,
   and the scoped-gate script handed to this review, both missed seven readers of OPERATIONS.md.
4. **`templates/review-checklist.md` puts "## On PASS (same commit)" after "## Verdict".** The shared rule
   (`scripts/lib/review-verdict.awk`) takes the last PASS or CHANGES_REQUESTED token on a heading or bold line. So a
   CHANGES_REQUESTED review that keeps the template's order reads as PASS-final: tested on a two-heading sample, it
   prints `PASS`. L1 would then flag its story. This review puts the close-out checklist before the verdict.

## Close-out (same commit, when the verdict passes)
- [ ] Story `**Status:**` flipped to `Done` in place. Not done: the story stays Approved.
- [x] Completion detection performed. The result is reported in the chat, never in this file.

## Verdict
**CHANGES_REQUESTED**
