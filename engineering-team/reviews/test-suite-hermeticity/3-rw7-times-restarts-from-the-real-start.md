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

## Round 2 — 2026-11-18 (HEAD `94642b48`)

**Diff:** `git diff 04b8fe47..HEAD`, 11 files, +67 −12. It has two commits: `9ea9c95a`, round 1's fixes (11 files,
+59 −12), and `94642b48`, their Evidence (the story only, +8). It changes only records: `git diff 04b8fe47..HEAD --
test/ src/` is empty, so the suite is the one round 1 reviewed. The whole change, `git diff 566d2eb3..HEAD`, is 14
files, +587 −11.

### Quality gates (run by reviewer, not trusted)

- [ ] `npm test` (the full gate): **not run on this Mac**, for the reason round 1 gives. In its place, I ran round 1's
      17-suite scoped gate through the gate engine, on the clean committed tree, with every endpoint dead:
      `20261118T193212Z-63070-bb31 [thg-3-review-r2] started 2026-11-18T19:32:12.886Z on 94642b48 — FAIL, exit 1, 380 passed, 3 failed, 41 skipped, 17/17 suites; failed: router-stream-limit-on-connect`
  - The record's `git.dirty` is false.
  - **`router-stream-limit-on-connect` 23/3/0, not caused by this diff.** P1–P3 fail with `sed: … invalid command code
    f`, macOS's BSD `sed -i` (ledger row `2026-10-09-router-patch-sed-macos`). Its OPERATIONS.md check, O1, passes. In
    a throwaway `node:22-bookworm` container (Node 22.23.3, GNU sed 4.9, the worktree mounted read-only) it passed
    26/0/0.
  - **Every other suite passed** with round 1's counts, except `harness-lint`, now 85/0/0 (round 1: 83/2/0).
    `tagging-edges-realtime-wrapper` 25/0/0, `ci-test-job` 14/0/0, `live-link-checks` 26/0/0, `workflow-hardening`
    36/0/0, `honest-publish-reporting-ci-guard` 4/0/1, `information-for-agents` 32/0/25, `llms-txt` 12/0/15,
    `ledger-row-ids` 6/0/0, `session-start` 32/0/0, `bullboard-admin-access` 9/0/0, `generalized-task-scheduler`
    12/0/0, `reconciliation-incremental-mode` 16/0/0, `reconciliation-rearchitecture` 15/0/0, `task-queue-bullmq`
    18/0/0, `task-queue-neo4j-resource-class` 15/0/0.
  - These are the counts of the Implementer's `20261118T192258Z-89344-3bf5`, which ran on `9ea9c95a` with `git.dirty`
    false.
  - **Two more suites read the changed ledger rows and the branch's commits,** and aren't among the 17 (non-blocking
    5). I ran them through the gate engine, on the same clean tree, with the same dead endpoints:
    `20261118T194538Z-32874-c1f9 [thg-3-review-r2-extra] started 2026-11-18T19:45:38.754Z on 94642b48 — PASS, exit 0, 45 passed, 0 failed, 0 skipped, 2/2 suites`
    (`rollup-scanners` 33/0/0, `harness-stats` 12/0/0).
- [x] **`bash scripts/harness-lint.sh`** at `94642b48`, clean tree: `harness-lint: clean (0 violations)`, exit 0. L10
      now lands on `9ea9c95a` (`scripts/harness-lint.sh:287`), which touches both `.github/workflows/test.yml` and
      `engineering-team/CHANGELOG.md`.
- [x] **The suite alone:** on this Mac, 25/0/0 in three runs of three; in the Linux container, 25/0/0 in two of two.
- [x] `git diff --check 566d2eb3..HEAD`: clean.
- [x] **GitHub, read only, one request at a time.** I read the attempts of RW7's four CI failures (`43503615549`;
      `43985723290`, attempts 1 and 2; `43989662522`; `44335714732`, attempts 1 and 2), attempt 1 of `43808151504`,
      and the `Test` workflow's run listing, twice (183 runs, 2026-10-27T01:36Z to 2026-11-18T19:22Z).
- [ ] `npm run test:playwright`: not applicable.
- [ ] _Lint, typecheck and build not configured — skipped._

The optional independent check before commit (workflow 5) was not applied.

### Round 1's findings, as fixed

| # | The fix | How I checked it | Result |
|---|---|---|---|
| Blocking 1 | A CHANGELOG row (`engineering-team/CHANGELOG.md:122`), in `9ea9c95a` with `test.yml`'s rewording; a run on the committed tree, in Evidence (story lines 106–112) | The lint and the gate above. The row's claims hold: the base header said "the stack-free suite has a zero-flake record" (`git show 566d2eb3:.github/workflows/test.yml`, line 6); the other three flakes' rows were opened on 2026-11-16 from PR #83's runs; RW7 failed 4 of 110 runs from 2026-11-13 (the RW7 row, line 124). The Evidence's record ran on `9ea9c95a`, clean, 380/3/41, failing only the router suite. | holds, except one asked item: the Evidence doesn't say that the Implementation records were of a dirty tree (non-blocking 4) |
| Blocking 2 | `OPERATIONS.md:1060` and `:1064`; `test.yml:7–9`; `ledger/2026-11-16-ci-gate-flake-history-claim-untrue.md:18–19` | "Never a retry" is gone. RW7's four runs on GitHub: `43985723290` and `44335714732` failed attempt 1 and passed attempt 2; `43503615549` and `43989662522` have one attempt each. So "two of its four CI failures were run again by hand … and each passed on the second run" holds. Each of the four flakes has a row, now DONE, committed before its fix. `ci-test-job` W8 passes. | holds for RW7, but `test.yml`'s "the two failed runs" leaves out a third (blocking 1 below) |
| Non-blocking 1 | Story lines 74–79; test plan lines 37–39, box ticked | Nothing reads the `ms` at `test:567`, `:647`, `:673` or `:862`, and those windows are `waitFor` timeouts. RW22 reads the offsets in its fixture check (`test:1290–1291`) and its messages (`:1289`, `:1291`, `:1294`). | holds for RW3, RW9, RW10, RW22 and RW24; the new heading overclaims (non-blocking 3) |
| Non-blocking 2 | `ledger/2026-10-08-realtime-wrapper-timing-flake-under-load.md:13` | Read against the row's lines 18–20 and 31–36 | holds |
| Non-blocking 3 | Story line 71; `ledger/2026-11-16-ci-gate-flake-history-claim-untrue.md:18` | — | holds |
| Non-blocking 4 | The 17 suites | I looked for any other suite reading the changed files. `entrypoint-template-rendering` defines an OPERATIONS.md path (`test/entrypoint-template-rendering.test.js:32`) but never reads it. `brains-launcher-repo` only sorts path names. `tagging-edges-wiring` names §12 in a test title. Three suites name `test.yml` in comments only. | holds for the readers of OPERATIONS.md and `test.yml`; two readers of the changed ledger rows and commits were missing from both rounds' list (non-blocking 5) |

Round 2's other new claims hold too:
- **`ledger/2026-11-18-gate-before-commit-misses-lint-l10.md`**, except line 10 (non-blocking 1):
  - its account of L10 matches `scripts/harness-lint.sh:287`;
  - the Implementer's phase files never mention `harness-lint`;
  - "would have failed too" holds, since `harness-lint`'s real-repo tests (`test/harness-lint.test.js:568`, `:638`)
    have no CI skip.
- **`ledger/2026-11-18-no-map-of-suites-per-file.md`**, except line 11 (non-blocking 2): `7b6e0e24` changed
  OPERATIONS.md, `test.yml` and two ledger rows (`git show --stat`), and the counts of ten suites and seven more are
  right.
- **The seen-again notes:** `scripts/harness-def-paths.txt:16–17` still says no workflow runs, and the template still
  puts its close-out heading after `## Verdict` (`templates/review-checklist.md:61`, `:64`).
- **The story's new Evidence:** L15 allows "two to six lowercase words" (`scripts/harness-lint.sh:438`), which fits
  the rename to `no-map-of-suites-per-file`.
- **What round 1 accepted still holds.** The RW7 row's "about 7–60 ms each" (line 8) spans the probe's medians, from
  6.9 ms at 1.2 GB (the test plan's Verification) to 60.6 ms at 3 GB (`tmp/rw7-probe/run1.out`). The suite and `src/`
  are unchanged since `7b6e0e24`, and the suite passes on both OSes.

### Findings (round 2)

#### Blocking
1. **`.github/workflows/test.yml:7–9`** — "… and the two failed runs that were run again by hand against this rule".
   Three failed runs were run again by hand, not two.
   - **The two meant** are RW7's, `43985723290` (2026-11-17) and `44335714732` (2026-11-18, #143).
   - **The third is PR #83's `43808151504`** (2026-11-16, branch `fix/resync-test-raw-bidi`, at `4df10d9b`). Its
     attempt 1 failed on the live link check, and it was run again. Its attempt 2 failed K1's lock check, which is how
     that flake was found.
     - `ledger/2026-11-16-link-check-fails-during-prod-deploy.md:9`: "A rerun of the job, its attempt 2, passed L1 and
       failed another test".
     - The same row, line 13: "The rerun above was requested before §15 was read. Under §15 it doesn't change the
       verdict, which for 4df10d9b is attempt 1's FAIL."
     - `ledger/2026-11-16-k1-lock-check-races-worker.md:5` gives that row's source as "Actions run 43808151504,
       attempt 2".
   - **GitHub agrees.** Of the `Test` workflow's 183 runs from 2026-10-27 to 2026-11-18T19:22Z, exactly these three
     have a second attempt, and attempt 1 of `43808151504` reads `failure`.
   - **§15 doesn't mention the third.** Its live link checks bullet (`OPERATIONS.md:1063`) says nothing of the
     rerun.
   - **So the header undercounts the reruns.** It is one of AC5's two files, and the count is round 1's blocking 2's
     subject: what the no-retry policy's record really is. That record bears on the owner's question, still open on
     the 2026-11-16 row, of whether the quarantine file is still the answer to a flake.
   - **"Names" also claims more than §15 does.** §15 gives no run's id; the RW7 row does (`ledger/2026-10-08-…:128`).
     The CHANGELOG row says the same ("which names … the two RW7 failures", `engineering-team/CHANGELOG.md:122`).
   - **Round 1 missed this.** Its blocking 2 asked for RW7's two reruns only, though the 2026-11-16 row it cited
     points to the link-check row (line 12).

   **Asked change:**
   - In §15's live link checks bullet (`OPERATIONS.md:1063`), say that the failed run was run again by hand too. Give
     each of the three reruns' run ids in §15, so that "names" holds.
   - In `test.yml`, correct the count or drop it: for example, "… and the failed runs that were run again by hand
     against this rule". Keep out `\bretry\b`, `rerun` and `--retries` (`ci-test-job` W8).
   - That commit touches `test.yml`, so it must touch `engineering-team/CHANGELOG.md` too (L10). Amend row 122 so
     that its account of §15 matches, or add a row.
   - Bring the 2026-11-16 row's account of §15 (`ledger/2026-11-16-ci-gate-flake-history-claim-untrue.md:19`) into
     line. It is the row for these three flakes.
   - Then, on the committed tree, run `bash scripts/harness-lint.sh` and the scoped gate, and record both in Evidence
     with their commit.
   - Any wording suggested here is itself a claim for the next round to check.

#### Non-blocking
1. **`ledger/2026-11-18-gate-before-commit-misses-lint-l10.md:10`** — "ran three green scoped gates … on
   `92554055+dirty`". The first of the three, `20261118T171956Z-88650-afc8`, failed `ci-test-job` (13/1/0, and
   271/1/41 in all). The record doesn't name the test; the story says it was W8 (line 102). Only the other two were green. The wording grew from round 1's loose "the
   Evidence's green scoped gates … all ran on `92554055+dirty`" (blocking 1).
   Optional improvement: for example, "ran three scoped gates on `92554055+dirty`, with harness-lint passing in each;
   the last two were green".
2. **`ledger/2026-11-18-no-map-of-suites-per-file.md:11`** — "both `task-queue-*` suites". The registry has five
   (`test/registry.js:76`, `:77`, `:89`, `:363`, `:376`). The two that read OPERATIONS.md are `task-queue-bullmq` and
   `task-queue-neo4j-resource-class`. "Both `reconciliation-*` suites" is right, since there are two.
   Optional improvement: name the two.
3. **Story line 74** — "Only RW7 and RW22 read a start's time". RW25 reads each start's `at` too (`test:1348–1349`),
   as the test plan says (line 20: "It reads what RW7 reads"). So does the quick scenario's window end (`test:619`),
   which RW7 and RW8 share.
   Optional improvement: for example, "Of the checks that predate this story, only RW7 and RW22 read a start's time
   in an assertion or a message".
4. **Story lines 98–102** — round 1's blocking 1 asked the Evidence to "say that the earlier records were of a dirty
   tree". It doesn't: the story mentions neither `dirty` nor `92554055`.
   - All three Implementation records ran on `92554055+dirty`, before `7b6e0e24` existed. Each record's `git.dirty`
     is true.
   - The new ledger row says so, but a reader of the story sees a green record with no caveat.

   Optional improvement: one sentence at line 102, for example "All three ran on `92554055+dirty`, before `7b6e0e24`
   existed, so none could see L10."
5. **The scoped gate's suite list, again.** Two registry suites read what this story changed, and neither is among
   the 17 that both rounds ran.
   - `rollup-scanners` (`test/registry.js:158`) runs `collect_meta` in the real repo
     (`test/rollup-scanners.test.js:110`). That reads every open meta row under `ledger/` (`scripts/lib/collect-meta.sh:66`),
     the two this story added among them.
   - `harness-stats` (`test/registry.js:155`) runs `scripts/harness-stats.sh` on the real repo's commits and reviews
     (`test/harness-stats.test.js:150`, `:225`).
   - Both pass at `94642b48` (record `20261118T194538Z-32874-c1f9`, above). Round 1's non-blocking 4 looked only for
     OPERATIONS.md's readers. This is ledger row `2026-11-18-no-map-of-suites-per-file`'s case, seen again.

   Optional improvement: add both suites to the next round's scoped gate.

#### Harness friction (round 2)
1. **The Implementer's phase files say lint isn't configured, and to skip it** (`engineering-team/roles/implementer.md:20`
   and `:28`; `engineering-team/workflows/4-implementation.md:14`; `.claude/agents/implementer.md:24`).
   - They mean code lint. But `harness-lint` is a lint that the gate runs, and its L10 is what failed here.
   - None of those files names `bash scripts/harness-lint.sh`.
   - No row says so yet. It fits as one line in the fix shape of `2026-11-18-gate-before-commit-misses-lint-l10`.
2. Not new: two of this round's six findings are the case in rule 10 (`roles/reviewer.md:50`). Each is round 1's own
   wording, carried into the records and made more definite.

### Close-out (round 2, same commit, when the verdict passes)
- [ ] Story `**Status:**` flipped to `Done` in place. Not done: the story stays Approved.
- [x] Completion detection performed. The result is reported in the chat, never in this file.

### Verdict (round 2)
**CHANGES_REQUESTED**

## Round 3 — 2026-11-18 (HEAD `663d11e3`)

**Diff:** `git diff e313f62e..HEAD`, 7 files, +25 −8. It has two commits: `ea51978d`, round 2's fixes (7 files, +16
−8), and `663d11e3`, their Evidence (the story only, +9). It changes only records: `git diff e313f62e..HEAD -- test/
src/ scripts/` is empty. The whole change, `git diff 566d2eb3..HEAD`, is 14 files, +766 −11.

### Quality gates (run by reviewer, not trusted)

- [ ] `npm test` (the full gate): **not run on this Mac**, for the reason round 1 gives. In its place, I ran the
      19-suite scoped gate (round 2's 17, with `rollup-scanners` and `harness-stats`) through the gate engine, on the
      clean committed tree, with every endpoint dead:
      `20261118T200744Z-66992-7c15 [thg-3-review-r3] started 2026-11-18T20:07:44.510Z on 663d11e3 — FAIL, exit 1, 425 passed, 3 failed, 41 skipped, 19/19 suites; failed: router-stream-limit-on-connect`
  - The record's `git.dirty` is false.
  - **`router-stream-limit-on-connect` 23/3/0, not caused by this diff.** P1–P3 fail on BSD `sed`'s "invalid command
    code f" (ledger row `2026-10-09-router-patch-sed-macos`). Its OPERATIONS.md check, O1, passes. In a throwaway
    `node:22-bookworm` container (Node 22.23.3, GNU sed 4.9, the worktree mounted read-only) it passed 26/0/0.
  - **Every other suite passed,** with round 2's counts: `tagging-edges-realtime-wrapper` 25/0/0, `ci-test-job`
    14/0/0, `live-link-checks` 26/0/0, `workflow-hardening` 36/0/0, `honest-publish-reporting-ci-guard` 4/0/1,
    `information-for-agents` 32/0/25, `llms-txt` 12/0/15, `harness-lint` 85/0/0, `ledger-row-ids` 6/0/0,
    `session-start` 32/0/0, `bullboard-admin-access` 9/0/0, `generalized-task-scheduler` 12/0/0,
    `reconciliation-incremental-mode` 16/0/0, `reconciliation-rearchitecture` 15/0/0, `task-queue-bullmq` 18/0/0,
    `task-queue-neo4j-resource-class` 15/0/0, `rollup-scanners` 33/0/0, `harness-stats` 12/0/0.
  - These are the counts of the Implementer's `20261118T195354Z-73187-3343`, which ran on `ea51978d` with
    `git.dirty` false.
- [x] **`bash scripts/harness-lint.sh`** at `663d11e3`, clean tree: `harness-lint: clean (0 violations)`, exit 0. L10
      lands on `ea51978d`, the latest commit touching a harness-definition path, which touches both
      `.github/workflows/test.yml` and `engineering-team/CHANGELOG.md`.
- [x] **The suite alone:** on this Mac (bash 5.3.15), 25/0/0 in three runs of three; in the Linux container, 25/0/0.
- [x] **`ci-test-job` W8:** `test.yml` at HEAD matches none of W8's patterns (`/\bretry\b/i`, `/rerun/i`,
      `/--retries?\b/`, Playwright, a retry action).
- [x] `git diff --check 566d2eb3..HEAD`: clean.
- [x] **GitHub, read only, one request at a time, no polling.** Attempts 1 and 2 of `43808151504`, `43985723290` and
      `44335714732`; the failed-step log of attempt 1 of all three, and of attempt 2 of `43808151504`; PR #83; the
      `Test` workflow's run listing, twice (185 runs, 2026-10-27T01:36Z to 2026-11-18T19:55Z); run `43550764867`,
      and PR #53's listing and event timeline; and `gh`'s login.
- [ ] `npm run test:playwright`: not applicable.
- [ ] _Lint, typecheck and build not configured — skipped._

The optional independent check before commit (workflow 5) was not applied.

### Round 2's findings, as fixed

| # | The fix | How I checked it | Result |
|---|---|---|---|
| Blocking 1 | A paragraph naming the three reruns by run id (`OPERATIONS.md:1066–1068`); no count in `test.yml:9`; `engineering-team/CHANGELOG.md:122` and `ledger/2026-11-16-ci-gate-flake-history-claim-untrue.md:19` follow it | Against GitHub (the table below). Of the `Test` workflow's 185 runs, exactly these three have a second attempt. W8 passes, and L10 is clean. | holds; "by hand" is non-blocking 1 |
| Non-blocking 1 | `ledger/2026-11-18-gate-before-commit-misses-lint-l10.md:10`; its fix shape, `:20–22` | The three records are all on `92554055` with `git.dirty` true, and `harness-lint` passed 85/0/0 in each. The last two read PASS. The first reads FAIL, 271/1/41: `ci-test-job` 13/1/0 is its only failing suite, with `failures: []`. So I put the first wording back into a scratch copy of `7b6e0e24`'s `test.yml` ("not a second run" → "never a retry"): `ci-test-job` gives 13/1, W8 alone, and 14/0 unchanged. The four `file:line` references say what the row says, and none of those files names the harness lint. | holds |
| Non-blocking 2 | `ledger/2026-11-18-no-map-of-suites-per-file.md:11` | Of the registry's five `task-queue-*` suites (`test/registry.js:76`, `:77`, `:89`, `:363`, `:376`), only the two now named read OPERATIONS.md. | holds |
| Non-blocking 3 | Story line 74 | RW25 reads each start's `at` (`test:1348–1349`), and the quick scenario's window ends at `starts[0].at + MS.quickWindow` (`test:619`). | holds |
| Non-blocking 4 | Story line 102 | The three runs started from 17:19:56Z to 17:24:51Z; `7b6e0e24` was committed at 17:26:43Z. | holds; the sentence's placement is non-blocking 2 |
| Non-blocking 5 | Story lines 118–120 | Record `20261118T195354Z-73187-3343`: on `ea51978d`, clean, 425/3/41, `rollup-scanners` 33/0/0, `harness-stats` 12/0/0, router P1–P3 failing. `ea51978d` was committed at 19:53:37Z, and the run started at 19:53:54Z. | holds |

Round 2's harness friction 1 is now in the L10 row's fix shape.

**§15's three reruns, against GitHub.** Each run's attempt 1 failed as §15 says, and §15's dates are the runs' own
(UTC):

| Run | Branch, commit | Attempt 1 | Attempt 2 |
|---|---|---|---|
| `43808151504` | `fix/resync-test-raw-bidi`, PR #83's head (`4df10d9b`) | 2026-11-16, 05:07:09Z–05:14:38Z. One failure: `information-for-agents` L1, a 502, at 05:09:30Z | 05:30:07Z–05:38:34Z. One failure: `operations` K1, at 05:36:51Z; L1 passed |
| `43985723290` | `docs/relay-tools-staging-host`, `b0a7cf52` | 2026-11-17, 00:12:23Z–00:22:07Z. RW7 alone | 00:55:39Z–01:05:08Z, success |
| `44335714732` | `docs/concept-writes-header-lock-ship-records`, #143's `7ebbb80e` | 2026-11-18, 15:26:46Z–15:41:01Z. RW7 alone | 16:02:14Z–16:15:53Z, success |

- PR #83's head branch is `fix/resync-test-raw-bidi` (opened 05:06:40Z), so `43808151504` is its first run. The K1
  row names that run's attempt 2 as its source (`ledger/2026-11-16-k1-lock-check-races-worker.md:5`).
- **A failed run repeated another way:** one commit, PR #53's `31e84b40`, has a failed run followed by a fresh one
  (`43520785618`, then `43550764867`). The second came from reopening the PR 4.5 hours after it was closed, not from a
  rerun. It failed too, and the PR merged after it. I don't count it, and §15 is right not to.

### Findings (round 3)

#### Blocking
None.

#### Non-blocking
1. **`OPERATIONS.md:1066`** (and `test.yml:9`, `engineering-team/CHANGELOG.md:122`,
   `ledger/2026-11-16-ci-gate-flake-history-claim-untrue.md:19`,
   `ledger/2026-10-08-realtime-wrapper-timing-flake-under-load.md:128`) — "run again by hand". What the record shows
   for each second attempt:
   - **Who started it:** GitHub's `triggering_actor` is `nousclawds4` for all three. That is this Mac's `gh` login (a
     user account), the account PR #83 was opened under. None came from the owner's account, `wds4`.
   - **`43808151504`:** "the coordinator reports requesting it at 05:30:07Z"
     (`engineering-team/reviews/graph-operations-first-slice/resync-test-raw-bidi.md:29`), when attempt 2 started. How
     it was asked for isn't recorded.
   - **`44335714732`:** "The session that reran #143's hadn't read §15" (the RW7 row, line 130). The coordinator
     session's merge script for #143 (`merge-143.sh`, in that session's scratchpad, outside the repo) ran
     `gh run rerun "$TEST_RUN" --repo "$R" --failed` at 16:02:13Z, a second before attempt 2 started. Its header says
     it was written to merge #143 on the owner's "Merge once CI passes", after a first run that failed RW7 alone.
   - **`43985723290`:** the record shows only the account, and a start 33 minutes after attempt 1 ended. Nothing in
     the repo says who asked or how.
   - **Nothing automatic:** nothing in `.github/`, `scripts/` or `.claude/` reruns a workflow run.

   So "by hand" holds in the sense §15 uses for the link checks, "by hand (the Actions tab …)"
   (`OPERATIONS.md:1056`): asked for, not automatic. It doesn't hold if it's read as "by a person": the record shows
   the agent account each time, and names an agent session for two. That bears on the owner's open question on the
   2026-11-16 row, since every breach of the policy on record came through the agent account.

   Optional improvement: say who, in §15 and the 2026-11-16 row. For example: "Three failed runs were run again on
   request, each from `nousclawds4`, the account agent sessions use, against this policy". `test.yml` can stay as it
   is. Any wording suggested here is itself a claim for the next round to check.
2. **Story line 102** — "All three of these gate runs were on `92554055+dirty` …" comes before two of the three runs
   are named. It also now stands between the record at line 100 and "The run before it", so "it" reads as
   `7b6e0e24`, which all three ran before.
   Optional improvement: move the sentence to the end of the paragraph, or write "The run before that record".

#### Harness friction (round 3)
1. **Nothing on an agent's way to a merge says that a red `stack-free` is the verdict, not a cue to rerun.**
   - All three reruns on record came from the agent account (non-blocking 1). The records say two of the sessions
     hadn't read §15 (`ledger/2026-11-16-link-check-fails-during-prod-deploy.md:13`; the RW7 row, line 130), and
     #143's was made to carry out "Merge once CI passes".
   - The merge skills (`.claude/skills/cycle-staging/SKILL.md`, `cycle-prod/SKILL.md`, `cycle-full/SKILL.md`) never
     name the `stack-free` check. The nearest is `cycle-prod/SKILL.md:151`: a BLOCKED merge means "investigate,
     surface, don't override". AGENTS.md, CLAUDE.md and `docs/SAFE_TO_MERGE.md` don't state §15's rule either;
     SAFE_TO_MERGE's "re-run the check" is about its own check.
   - No open row covers it. The facts sit in two DONE rows, and the open 2026-11-16 row is about the premise's
     wording.
   - It fits a meta row whose fix shape has the merge path say what §15 says: a red run is stopped and reported, not
     run again.
2. Not new: the first Implementation record names no failed test (`ci-test-job` returns counts only, so its
   `failures` is empty). That is ledger row `2026-10-28-suite-results-omit-names-and-skips`, seen again. I confirmed
   W8 by mutation instead.
3. Not new: "by hand" is round 1's own wording (its blocking 2), taken from the RW7 row and carried through two
   rounds: the case in rule 10 (`roles/reviewer.md:50`).

### Close-out (round 3, same commit, when the verdict passes)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed. The result is reported in the chat, never in this file.

### Verdict (round 3)
**PASS**
