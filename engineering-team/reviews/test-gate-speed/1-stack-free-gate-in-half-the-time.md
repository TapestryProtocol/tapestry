# Review: Story 1 — The stack-free gate gives the same verdict in half the time

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-22
**Diff:** `git diff fb9e230bb...HEAD` (commit `4eb1da50`). `fb9e230bb` is the staging tip the branch was cut from. The branch has 14 commits, `5cb99327` to `4eb1da50`.

## Quality gates (run by reviewer, not trusted)

This Mac never runs the full `npm test`, because its `tapestry` container is the live agent-memory instance. The owner allowed full runs only in the sealed Linux container (story, Open questions 2).

- [x] **`npm test`, the full gate, in the sealed container at `4eb1da50`** (4 CPUs, `--network none`, run by the main session for this review):
  `20261122T055344Z-23-1c8e [review-full-gate] started 2026-11-22T05:53:44.947Z on 4eb1da50 — PASS, exit 0, 8634 passed, 0 failed, 669 skipped, 465/465 suites`
- [x] **A scoped gate at `4eb1da50`.** I ran it through this branch's engine with `GATE_JOBS=8` and every endpoint dead: closed ports, a dead conf, `TAPESTRY_CONTAINER=no-such-container`, and fake `curl` and `docker` first on `PATH` (`tmp/ste4/safe-run.sh`).
  `20261122T060347Z-70460-0546 [review-tgs1-scoped] started 2026-11-22T06:03:47.630Z on 4eb1da50+dirty — PASS, exit 0, 1696 passed, 0 failed, 21 skipped, 120/120 suites`
  - It ran `config-loading` 1/0/0, `gate-side-by-side` 23/0/0, `gate-result-record` 34/0/0, `suite-env-changes` 18/0/0, `stack-free-npm-test` 6/0/1, `ci-test-job` 15/0/0, `openapi-document` 10/0/0 and `harness-lint` 85/0/0.
  - It also ran `operations` expanded: its own 49/0/0, plus 111 file units. That is 1504/0/20 in all, the same as the Phase-3 run of `operations` alone.
  - "+dirty" is the untracked `node_modules` link in this worktree.
  - `stack-free-npm-test`'s G2 probed `http://127.0.0.1:9` and skipped, so nothing reached the agent-memory instance.
- [x] **CI on HEAD:** run 44991282286, on the merge of `4eb1da50` into staging. Both parts passed, and `stack-free` succeeded about 6 minutes after the run started.
  - Part 1, on an AMD EPYC 9V74: `part 1 of 2: 235 of 471 suites`, then `Overall: PASS — 4282 passed, 0 failed, 298 skipped across 235 suites`. Its `npm test` step took 5 m 29 s.
  - Part 2, on an AMD EPYC 7763: `part 2 of 2: 236 of 471 suites`, then `Overall: PASS — 4447 passed, 0 failed, 371 skipped across 236 suites`. Its step took 5 m 40 s.
- [x] _Playwright: not applicable._
- [x] _Lint, typecheck and build: not configured, skipped._

### The test plan's verification claims, checked

I re-derived these with a script over the sealed container's records (`tmp/gatebox/src/tmp/gate-runs/`), and from CI.

| Claim | What I found | Holds? |
|---|---|---|
| V2: the old engine 1,038.7 s, the new one 403.6 s, 0.389, at `7df76221` | Records `20261122T031835Z-7-4724` (old, 354 entries) and `20261122T031151Z-22-cf6c` (new, 465 units). They took 1,038.7 s and 403.6 s, and both read 8,630/0/669. All 353 entries other than `operations` have the same counts. `operations` is 1504/0/20 in the old record, and its own unit plus its 111 files in the new. | Yes |
| V2, split: parts of 232 and 233 suites, 4,375/0/350 and 4,259/0/319, adding up to a whole run | Records `20261122T043335Z-22-82cc` and `20261122T043552Z-22-00cd`, at `9d90954d`, against a whole run at `7836548a`. No unit is in both parts, and all 465 are covered. Every unit's counts equal the whole run's, and each part's record keeps whole-run unit order. 4,375 + 4,259 = 8,634, and 350 + 319 = 669. | Yes |
| V3: ten runs in a row at `7836548a`, all 8,634/0/669 | The ten records `v3-run-1` to `v3-run-10` are consecutive. All passed, with no strays and one and the same set of per-unit counts. Runs 1–6 had 4 CPUs and 4 jobs, and runs 7–10 had 2 CPUs and 4 jobs. `test/` is identical at `7836548a` and at HEAD. | Yes. The records' own durations are 356.1–367.3 s and 514.4–518.9 s, within about a second of the table's figures. |
| V1′: 1,154 s then 215 s on an EPYC 9V74, and 1,353 s then 444 s on an EPYC 7763; the parts add up to the whole gate's 8,686 passed and 669 skipped | Run 44985636771's step times give exactly those four durations, so the ratios are 0.186 and 0.328. Its log, in the main session's saved copy, shows the old engine passing on both runners: `Overall: PASS — 8686 passed, 0 failed, 669 skipped across 354 suites`. The parts read 4,195/0/344 and 4,491/0/325, each 235 of 470 suites. | Yes |
| V4: the verdict 4 m 29 s after the run started | Run 44987919987 was created at 05:06:09 and ended at 05:10:38, with success. I didn't re-read its per-job times. | Yes |
| AC4: a cancelled part fails `stack-free` | The next push cancelled run 44985568553. Both parts ended `cancelled`. `stack-free` still ran, printed "The parts of the stack-free gate: cancelled", and ended `failure`. | Yes, live |

One thing I didn't re-derive: V1's and the re-time's step times (runs 44978145159 and 44981972812). They are the stop rule's history, and both runs succeeded.

## Spec adherence

- [x] **AC1, half the time.** V1′ gives 0.186 and 0.328 on two runners, each part against today's whole gate on its own runner. The final shape's two runs gave the verdict in 4 m 29 s and about 6 minutes, under 12 minutes. The three runs that carried the temporary timing step took 31 to 35 minutes, as ADR Decision 11 planned (Non-blocking 6).
- [ ] **AC2, the same verdict.** On today's tree it holds. Every suite, and every file under `test/operations/`, has the same counts under both engines, and so do `Total skipped:` and `Overall:`. But one guarantee of story `honest-test-gate` #1 no longer holds, against AC2's second bullet. What a suite's process does after its result is sent no longer counts (Blocking 1).
- [x] **AC3, a log to read and measure.** Each unit's output is one block (P10). Blocks come in finishing order with unit-order numbers (P11). Each unit's time is on its result line and in the record. The first line names the CPU count and model (P4). CI's first lines name the `AMD EPYC 9V74 80-Core Processor` and the `AMD EPYC 7763 64-Core Processor`.
- [x] **AC4, one check, one command, no retries.** One check named `stack-free` carries the verdict, and `main`'s ruleset needs no change. `npm test` is the only command, and the parts add up (V2, split). Nothing retries, and each part keeps the 40-minute guard. W10 pins the shape. A cancelled part failed `stack-free` live, in run 44985568553.
- [x] **AC5, no new flakes.** Ten sealed runs in a row passed, four of them with 4 jobs on 2 CPUs. Every CI run that finished passed. No failure was seen only side by side, so none needed a ledger row. OPERATIONS.md §15 tells a contributor to use `GATE_JOBS=1`.
- [x] Nothing outside the story was added, beyond the small drifts under "ADR adherence".

## Guard-suite discipline (the test-deliverable carve-out)

- [x] Only the three `test:` commits touched the Tester's six files: `e727bc51`, `90a3719c` and `75b82927`. No `impl:` commit touched any of them (`git log fb9e230bb..HEAD --` the six files).
- [x] The Implementer's files match the ADR's Phase-4 list.

## ADR adherence

- [x] Decisions 1–9 and Amendments 1–3 are as built. In particular, `partsOf()` (`test/helpers/gateRunner.js:210–220`) puts every unit in exactly one part, and units never see `GATE_PART` (`:254–255`, P23).
- [x] The temporary timing step and its removal are two commits, `7df76221` and `a57e570e`, as the Implementation notes ask.
- [x] The "Superseded in part by" lines are in ADRs `honest-test-gate/0001`, `test-suite-hermeticity/0002` and `graph-operations-foundation/0001`.
- [x] There is no new dependency. `package.json` and the lockfile are unchanged.
- Small drifts, none of them blocking:
  - `fail-fast: false` (`.github/workflows/test.yml:31–32`) isn't in Amendment 3. It is the right choice, and the workflow's comment says why.
  - The unit logs go to `mkdtemp(<tmpdir>/gate-<runId>-)` (`test/helpers/gateRunner.js:350`), not to Decision 5's `gate-<runId>/`.
  - Decision 6 overstates what is killed (Non-blocking 2). Decision 4 doesn't name what exiting at once costs (Blocking 1).

## Concept-graph integrity

- [x] No concepts, handles or firmware are touched, so no reinstall is needed.

## Things tests can't catch

- [x] No secrets in committed files.
- [x] No leftover debug logging. Every new `console.log` is a suite's or a fixture's own report.
- [x] No commented-out code.
- [ ] Error paths: see Blocking 1 and Non-blocking 1. I drove the paths that no guard drives, over fixtures, with this branch's engine:
  - An engine failure while another unit runs ends `Overall: FAIL` with exit 1. It kills that unit and removes the log folder, but drops that unit's output (Non-blocking 1).
  - A unit that kills itself is a FAIL, and so is one that exits 0 through `process.reallyExit`: "its process ended before it reported a result". The next suite still runs.
  - The close-grace timer (`test/helpers/gateRunner.js:54`, `:422–426`). A unit's result is in the socket before its process exits, so the engine reads it in the same poll as the exit. A late read would give a false FAIL, never a false PASS.
  - A fork error with no pid is that unit's FAIL (`:421`). A fork that throws is the engine's FAIL (`:418`, `:442`).
- [x] Concurrency. Both parts check out the same commit (`github.sha`), and `partsOf()` reads only the tree's file list and file sizes, with ties broken by unit order. So the two runners compute the same split. The workflow's `if: always()` and its result test can't read a failed, cancelled or skipped part as a pass.
- [x] Security. The one expression inside a `run:` line, `needs.stack-free-part.result`, is one of four fixed words.

## House rules check

- [x] Concept Graph API authority: not applicable.
- [x] No new lint, typecheck or build tooling.
- [x] The harness-definition changes carry CHANGELOG rows (L10), and `harness-lint` passed in the scoped gate.

## Findings

### Blocking

1. **`test/helpers/gateUnit.js:43` and `:118–120`, with `test/helpers/gateRunner.js:362–367`.** A unit sends its result one macrotask after its run, then exits at once. After that, nothing its process does counts:
   - An error thrown, or a rejection left unhandled, later than one macrotask after the run never happens, because the process is gone. An un-awaited assertion in a suite's last test is the usual way this comes about.
   - A deferred `process.exit` is never called.
   - An exit-time failure is ignored, such as a `process.on('exit')` cleanup that throws, or a crash as the process exits. `resultOf()` takes the message and never reads the exit status.

   Staging's engine failed every one of these cases. I drove both engines over the same fixtures: a suite that passes, then fails 300 ms later, then a 1.5 s suite after it.

   | Fixture | Staging's engine (`fb9e230bb`) | This branch |
   |---|---|---|
   | throws 300 ms after its run | `Overall: FAIL`, exit 1, a stray "during after" | `Overall: PASS`, exit 0, with `GATE_JOBS=1` and with the default |
   | an un-awaited assertion rejects 300 ms after its run | `Overall: FAIL`, exit 1 | `Overall: PASS`, exit 0 |
   | `process.exit(0)` 300 ms after its run | `Overall: FAIL`, exit 1 ("called process.exit(0)") | `Overall: PASS`, exit 0 |
   | a `process.on('exit')` cleanup that throws | `Overall: FAIL`, exit 1 | `Overall: PASS`, exit 0 |
   | a crash at exit (an exit listener that sends SIGKILL) | `npm test` ends by SIGKILL, so CI is red | `Overall: PASS`, exit 0 |

   - **What it breaks.** AC2 says "Every guarantee of story `honest-test-gate` #1 … still holds" (story `:40–44`). That story says a `process.exit` "deferred past a suite's `run()` is a stray FAIL, never the end of the run" (`engineering-team/stories/honest-test-gate/1-gate-result-tells-the-truth.md:145–146`). Its ADR says "One run-wide listener catches escaped rejections and exceptions. No single failure can erase the others" (`honest-test-gate/0001:106–107`).
   - **How far it reaches.** The old engine already missed this for the last suite of a run. The new one misses it for every suite, so the blind spot is now the tail of all 465 units.
   - **Why the tests are green.** Nothing pins the boundary. `stray-rejection` rejects during its run (`test/helpers/gateFixtures.js:193–197`), and C13's timer has no delay (`:295`). ADR Decision 4 (`:197–198`) chose "exits through the real `process.exit`" without naming this cost. The engine's own headers still promise escaped errors as strays (`gateUnit.js:16`, `gateRunner.js:17–19`).
   - **What it costs today.** Nothing yet: today's tree has no such suite, and V2 shows no strays under either engine. The loss is in what the gate would catch next.

   **Asked change:** either keep the guarantee, or narrow it on the record, by the owner's choice. That changes Decision 4, so it goes back through Architecture and Test Design first.
   - **To keep it:** after `run()` settles, the unit stays up until its event loop empties or a short cap passes, whichever comes first. Errors and `process.exit` calls in that window are its strays, sent with or after the result. A unit that reported, but then exits non-zero or by a signal, is a FAIL in `resultOf()`. The cap bounds the cost for suites that leave handles open, and the Architect measures that cost against AC1.
   - **To narrow it:** an ADR amendment says how long after its run a unit's escaped errors still count, and that exit-time failures no longer count. AC2, and the guarantees it carries forward, are reworded to match.
   - **Either way:** the Tester adds guards that pin the choice. They are a throw and a `process.exit` 300 ms after a run, each with a suite after it, and an exit cleanup that throws.

### Non-blocking

1. **`test/helpers/gateRunner.js:305–315`.** `abandon()` kills the running units but doesn't print what they had written. The signal path does (`:322–328`). So an engine failure mid-run loses the running units' output, which is the part you'd want to read. Optional improvement: print the same "unfinished" blocks in `abandon()`.
2. **`OPERATIONS.md:1161`, ADR Decision 6 (`:219–222`), `engineering-team/CHANGELOG.md:127` and `test/helpers/gateRunner.js:22–23`.** These say that nothing a suite started outlives it. But the engine kills only the unit's process group. A process the suite starts with `detached: true` has a group of its own, and it survives. I checked: a fixture's detached child was still alive after the run. The old engine killed nothing, so this is no regression. Optional improvement: say "whatever it left running in its process group".
3. **`test/helpers/gateRunner.js:210–220`.** The split balances bytes, not time.
   - In the container, part 2 held 920 unit-seconds to part 1's 539, so the parts took 232.7 s and 136.7 s. The three heaviest suites, `seed-firmware`, `nostr-send` and `schema-save-finds-the-right-header`, all landed in part 2.
   - V1′'s parts took 444 s and 215 s, and HEAD's took 340 s and 329 s.
   - AC1 holds with room to spare (0.328 at worst). But the margin depends on how the split falls as files are added.

   Optional improvement: a follow-up row, should the heavier part start to set the verdict's time.
4. **`.github/workflows/test.yml:55–63` and ADR Amendment 3 (`:432–435`).** `stack-free` reads only the parts' results. That the parts together ran every unit rests on both runners computing the same split from the same commit. That holds, as checked above. But the amendment never answers Option B's own drawback (`:131–132`: proving that the parts together ran every unit exactly once). Optional improvement: one sentence in Amendment 3 giving the determinism argument.
5. **`engineering-team/CHANGELOG.md:127`.** The row ends "the workflow is unchanged, and W10 pins its one job". Row 128, in the same pull request, says the workflow now runs two parts. The file's own rule is "one row per logical change … not one per commit". Optional improvement: drop that clause, or merge the two rows.
6. **The test plan's record of what ran** (`engineering-team/stories/test-gate-speed/1-stack-free-gate-in-half-the-time.test-plan.md`).
   - The V1 snippet (`:148–154`) isn't the step that ran. Commit `7df76221`'s step wrote to `$RUNNER_TEMP/oldgate` and ended with `|| echo "the old engine's run exited $?"`, so the old engine's own exit status didn't gate those jobs. In V1′ it passed on both runners anyway.
   - V2 says "Over the final tree" (`:176`), but its row ran at `7df76221` (`:213`). I also compared the final tree's whole run (`7836548a`) with the old engine at `7df76221`. All 351 suites that didn't change between them, and `operations`, have the same counts. So the claim holds in substance.
   - V4 (`:203`) and the story's AC1 (`:37`) say every CI run of the pull request gives its verdict in under 12 minutes. The three timing runs took 31 to 35 minutes, by design, and 44985568553 was cancelled. HEAD's own run, 44991282286, isn't listed.

   Optional improvement: make these rows say what ran.

### Harness friction

1. **A guarantee that lived only in prose was dropped with every test green.** Story `honest-test-gate` #1 says a call "deferred past a suite's `run()` is a stray FAIL", but no test defers past one macrotask. So this story could lose the guarantee while its AC2 said "every guarantee … still holds". Suggest a `meta` row: when an AC carries another story's guarantees forward, the Tester lists each one from that story's text and names the test that pins it, or adds one.
2. **The test plan's scoped-gate recipe (`:112–117`) depends on two untracked files** in the main checkout's `tmp/`: `tmp/ste4/safe-run.sh` and `tmp/ste4/gate.js`. A fresh checkout or another machine has neither. And `gate.js` passes only `{ file }`, so it can't drive the engine's `expand` path. This review used a scratchpad variant that can. Suggest a `meta` row on where the dead-endpoint scoped-gate recipe should live.
3. **The story and its ADR disagree on CI time.** Story AC1 says every CI run of the pull request gives its verdict in under 12 minutes (`:37`). ADR Decision 11 planned measurement runs of about 30 minutes on the same pull request, and both were approved. Suggest a `meta` row: an AC about "every CI run" names any planned measurement runs as the exception.

## Verdict
**CHANGES_REQUESTED**

---

# Round 2

**Date:** 2026-11-22
**Diff:** `git diff 9a6aca5ba..7b89bbb59`, the four commits after round 1's review commit `9a6aca5b`. The branch is pushed at `7b89bbb5`.
- `fdd06d61` test: guards P24–P27 and their fixtures.
- `75cb6286` docs: AC1's timing-run exception, the test plan's corrections, and three meta ledger rows.
- `73fc1077` adr: ADR `test-gate-speed/0001` Amendment 4.
- `7b89bbb5` impl: the unit runner and the engine, the docs, and ledger row `2026-11-22-gate-parts-balance-by-bytes`.

The owner chose to keep the guarantee and fix every round-1 finding. I re-checked each fix as a fresh claim, and the coordinator's own runs too.

## Round 2: quality gates (run by reviewer, not trusted)

- [x] **Guard discipline.** Only `fdd06d61`, a `test:` commit, touched the Tester's files. No `impl:` commit touched them.
- [x] **P24–P27 alone,** under the wrapper with the coordinator's `one-test.js`, at `7b89bbb5`: 4 passed, 0 failed.
- [x] **The same four against the engine just before the fix.** I extracted `75cb6286`'s `test/` into the scratchpad and ran them there: 0 passed, 4 failed. Each failed for the reason it names, so the guards bite.
  - For example: "late-throw, GATE_JOBS=1: it ended exit 0, last line "Overall: PASS …"".
- [x] **A scoped gate on the committed tree,** with `GATE_JOBS=8` and every endpoint dead:
  `20261122T065737Z-70464-6a01 [review-tgs1-r2-scoped] started 2026-11-22T06:57:37.870Z on 7b89bbb5+dirty — PASS, exit 0, 1750 passed, 0 failed, 21 skipped, 123/123 suites`
  - It ran `gate-side-by-side` 27/0/0, `gate-result-record` 34/0/0, `suite-env-changes` 18/0/0, `stack-free-npm-test` 6/0/1, `ci-test-job` 15/0/0, `openapi-document` 10/0/0, `harness-lint` 85/0/0, `harness-stats` 12/0/0, `ledger-row-ids` 6/0/0, `session-start` 32/0/0 and `config-loading` 1/0/0.
  - It also ran `operations` expanded: its own 49/0/0, plus 111 files. That is 1504/0/20, the same as round 1.
  - There were no strays, and no unit failed after its result. G2 probed `http://127.0.0.1:9` and skipped. "+dirty" is the `node_modules` link.
- [x] **`bash scripts/harness-lint.sh`** at `7b89bbb5`: clean (0 violations).
- [x] **The coordinator's docs gate,** read with `gate:status`:
  `20261122T064256Z-84085-dd41 [tgs1-r2-docs] started 2026-11-22T06:42:56.712Z on 7b89bbb5+dirty — PASS, exit 0, 135 passed, 0 failed, 0 skipped, 4/4 suites`.
- [x] **The coordinator's scoped gate,** `20261122T063930Z-93925-a782 [tgs1-r2-scoped]`, ended FAIL: 2263 passed, 10 failed, 84 skipped.
  - It ran on `75cb6286+dirty`, before the impl commit, so the engine it ran was uncommitted work. My own gate above is on the commit.
  - Its reading holds: the ten failures are this Mac's, not the change's. Staging's engine fails the same two suites the same way through the same wrapper (record `20261122T065513Z-68697-ca6d`, in the scratchpad).
  - `safe-to-merge-check` is 9/7/0 under both engines. Every attempt reads `raw=curl exit 7`, the wrapper's stub.
  - `router-stream-limit-on-connect` is 23/3/0 under both: `sed: 1: "…": invalid command code f`, BSD sed refusing GNU's `sed -i`.
  - Both suites pass in every Linux run.
- [ ] **The ten sealed runs at `7b89bbb5`** (V3 again, AC5): in progress. Two of ten are in, both passed, 8,638/0/669, with no strays, in 368.8 s and 364.2 s. 8,638 is round 1's 8,634 plus P24–P27.
- [ ] **CI on `7b89bbb5`:** not yet seen. I made no GitHub requests this round.

## Round 2: the round-1 findings, re-checked

| Round 1 | The fix | What I found | Holds? |
|---|---|---|---|
| Blocking 1 | Amendment 4. After its run, a unit stays up until its event loop is empty or 2 s pass. A unit that exits non-zero or by a signal after its result is a FAIL. | My round-1 experiments, re-run at `7b89bbb5`: all five cases now fail. The three late ones are strays named for the suite that left them ("during late-throw"), where staging's engine blamed the next suite ("during after"). The two exit-time ones read "its process ended with exit 1 after it sent its result" (the cleanup that throws) and "its process ended by SIGKILL after it sent its result" (the crash). P24 and P25 pin them. | Yes, within the bound Amendment 4 states. One edge it doesn't state is round 2's non-blocking 1. |
| Non-blocking 1 | `printUnfinished()` (`test/helpers/gateRunner.js:306`), shared by `abandon()` and the signal path | The engine-failure experiment now prints the running unit's output, marked unfinished. It still kills the unit and leaves no log folder. P27 pins it. | Yes |
| Non-blocking 2 | `OPERATIONS.md:1162`, `engineering-team/CHANGELOG.md:127`, `test/helpers/gateRunner.js:23` and Amendment 4 | A detached child still outlives its suite, and each of these now says so | Yes |
| Non-blocking 3 | Ledger row `2026-11-22-gate-parts-balance-by-bytes` | Its numbers match round 1's | Yes |
| Non-blocking 4 | Amendment 4's determinism bullet (ADR `:479`) | It gives the argument, and answers Option B's own drawback | Yes |
| Non-blocking 5 | `engineering-team/CHANGELOG.md:127` | The row now ends "the next row splits the workflow into two parts" | Yes |
| Non-blocking 6 | Test plan `:150–161`, `:183` and `:210`, and a row for CI run 44991282286 (`:223`) | The V1 snippet is the step that ran, V2 names its commit, and V4 names the timing runs and the cancelled run. The plan's new claim, that the old engine passed in every timing run, holds. The saved logs of runs 44978145159, 44981972812 and 44985636771 show 8,682, 8,683 and 8,686 passed, 0 failed, 669 skipped. In the first two, the new engine's totals on the same tree match the old engine's exactly. | Yes |
| Harness friction 1–3 | Ledger rows `2026-11-22-carried-guarantees-need-their-tests`, `2026-11-22-scoped-gate-recipe-lives-in-tmp` and `2026-11-22-ci-time-ac-ignores-timing-runs` | Each names its finding, a fix shape and a pointer | Yes |

I also checked Amendment 4's own claims:
- **What the cap costs.** The first ten-run record at `7b89bbb5` took 368.8 s. The full gate at `4eb1da50`, with no linger, took 365.0 s. About fifteen network-touching suites now wait the full 2 s, such as `information-for-agents`, `llms-txt` and `site-trust-signals`. Units with nothing left report at once: 31–36 ms in my experiments.
- **"A failure that fires later than 2 s after its run is lost."** True. A throw at 2.5 s, with an interval holding the process, passed. A throw at 1 s with the same interval was a stray.
- **"Every suite in the registry that sets `process.exitCode` does so only when run directly."** True, as far as I can check without the full runs:
  - The ten suites that set it do so inside `require.main === module`.
  - Three `probe-*.js` scripts set it at top level, but none of them is registered.
  - The `src/` setters are under `require.main`, or write to an injected `proc`.
  - The reconcile pass's `defaultDeps()` does hand over the real `process` (`proc: process`). But no suite calls its `run()` with that in its own process: `tagging-edges-runner` does it in child probes.
  - The two finished ten-run records have no unit that failed after its result.

## Round 2: findings

### Blocking
None.

### Non-blocking
1. **`test/helpers/gateUnit.js:157–163`, ADR Amendment 4 (`:466`), `OPERATIONS.md:1161` and `engineering-team/README.md:76`.** These say a unit waits until "nothing is left that could run". But `beforeExit` fires when nothing keeps the process alive, and an unref'd timer doesn't. So a throw on an unref'd 300 ms timer is lost, and the unit doesn't wait at all: 34 ms in my experiment. Staging's engine caught it, as a stray during the next suite. Optional improvement: say "until nothing keeps its process alive (an unref'd timer doesn't), or 2 seconds", and list the case beside the 2 s bound.
2. **`test/helpers/gateUnit.js:50–57`.** The exit after the result can hang.
   - Suppose a suite leaves its own `uncaughtException` listener that swallows errors, an exit cleanup that throws, and a handle open. Then `realExit()` (`:56`) throws, the suite's listener swallows it, and the process never ends. The engine has the result, but waits for an exit that never comes.
   - In my experiment the engine was still waiting at 20 s. SIGTERM then cleaned up properly.
   - No suite has all three today. Every exit listener in `test/` is wrapped in try/catch, and the realtime engine removes its listener when its run ends. In CI, the 40-minute guard would end such a run red, naming the unit.
   - Optional improvement: `try { realExit(); } catch { process.reallyExit(1); }`. That also stops the exit code depending on Node's own handler.
3. **`test/gate-side-by-side.test.js:673` (P26).** No guard pins the other half of the wait: that a unit with nothing left reports at once. P26 bounds only the cap, with `leaves-interval` under 8 s. A linger that always waited the full 2 s would pass every guard, and add about 4 minutes to a whole run (465 units × 2 s, 4 at a time). It holds today. Optional improvement: bound a plain fixture's time well under the cap.
4. **The phase order.** Amendment 4 (`73fc1077`, 01:42:30) was committed after the guards it governs (`fdd06d61`, 01:28:46), and six seconds before the code. Round 1 asked for Architecture first. The guards and the amendment agree, so only the order is off.
5. **The test plan, when the ten runs land.** "The ten count on the final commit" (`:206`) and the V3 row (`:222`) still name `7836548a`, but the final engine is `7b89bbb5`'s. The plan also records no failing run for P24–P27. I ran one, above: 0/4 at `75cb6286`.

### Harness friction
None new. Round 1's three are ledger rows now.

## Round 2 verdict

**Pending.** No blocking issue is left in the diff. The verdict waits on two things, both for the final engine at `7b89bbb5`:
1. **AC5:** the ten sealed runs in a row, with nothing failing. Two of ten are in, both passed.
2. **AC1, AC4 and AC5:** CI on `7b89bbb5`. Both parts must pass, and `stack-free` must give its verdict in under 12 minutes.

If both land green, the verdict is PASS. If either fails, it is CHANGES_REQUESTED, with the failure.

---

# Round 3

**Date:** 2026-11-22
**Diff:** `git diff 7b89bbb59..b64934363`, three commits, this time in the harness's order (07:22:16, 07:24:11, 07:26:13):
- `39d9c6f0` adr: Amendment 4's note on unref'd timers under item 1, item 5 rewritten, the cap's cost measured again, and guards P28–P29 listed.
- `673dd65f` test: P28 and P29, the fixture `swallows-at-exit`, and the test plan's coverage row.
- `b6493436` impl: `test/helpers/gateUnit.js`, OPERATIONS.md §15, README's gate recipe, the CHANGELOG's 2026-11-22 row, and the story's "Process:" deviation.

The test plan's changes for round 2's non-blocking 5 came after them, in the records commit `e5aad348`. The owner chose to fix all five round-2 findings before the verdict. This round's verdict replaces round 2's pending one.

## Round 3: quality gates (run by reviewer, not trusted)

- [x] **Guard discipline.** Only `673dd65f`, a `test:` commit, touched the Tester's files.
- [x] **P24–P29 alone,** at `b6493436`, under the wrapper: 6 passed, 0 failed. On its own, P28 takes 2.2 s and P29 0.3 s.
- [x] **P28 and P29 against round 2's engine.** I laid `b6493436`'s guard file and fixture helper over `7b89bbb5`'s helpers, in the scratchpad.
  - P28 failed, "the engine was still waiting", once its 20 s limit ran out. No unit was left running afterwards.
  - P29 passed there, as it should: at `7b89bbb5` a unit with nothing left already reported at once.
- [x] **P29 against a mutant.** In a copy of `b6493436`'s tree, `linger()` always waits out the cap: no `beforeExit` resolve, and no `unref()` on the cap. P29 failed, with "the middle of the five is 2045 ms (2043, 2049, 2050, 2043, 2045 ms)". P26 still passed there, so P29 is what pins that half.
- [x] **The exit itself, in plain Node.** I set up a throwing exit listener, a listener that swallows every error, and an interval. Then I called `process.exit()` in a `try`, and `process.exit(1)` in its `catch`. The exit listener ran once, and the process ended with status 1.
- [x] **A scoped gate on the committed engine,** with every endpoint dead. I used `GATE_JOBS=4`, to stay light beside the container runs:
  `20261122T123908Z-17112-7311 [review-tgs1-r3-scoped] started 2026-11-22T12:39:08.480Z on b6493436+dirty — PASS, exit 0, 238 passed, 0 failed, 1 skipped, 10/10 suites`
  - It ran `gate-side-by-side` 29/0/0, `gate-result-record` 34/0/0, `suite-env-changes` 18/0/0, `stack-free-npm-test` 6/0/1, `ci-test-job` 15/0/0, `harness-lint` 85/0/0, `harness-stats` 12/0/0, `ledger-row-ids` 6/0/0, `session-start` 32/0/0 and `config-loading` 1/0/0.
  - "+dirty" is the `node_modules` link, this review and the test plan's uncommitted changes. `harness-lint`'s real-repo check passed with both in place.
  - I left `operations` to the container's full runs this time.
- [x] **`bash scripts/harness-lint.sh`** on the working tree, with this review and the test plan's changes in place: clean (0 violations).
- [x] **The coordinator's scoped gate,** `20261122T122740Z-18170-8955 [tgs1-r3-scoped]`, ended with 2232 passed, 1 failed, 84 skipped. Its reading holds.
  - The one failure was harness-lint's "the real repo lints clean".
  - L1 reads a review's verdict as the last uppercase PASS or CHANGES_REQUESTED on a heading or bold line (`scripts/lib/review-verdict.awk`). Four lines of my round-2 draft carried one after round 1's verdict. So the rule read the review as passed, while the story is still Approved.
  - I changed only the form of those four lines. Two quotes moved to lines of their own, and "both PASS" became "both passed". The rule now reads round 1's verdict until a final one is written below.
- [x] **The ten sealed runs at `b6493436`** (V3, AC5): all ten in a row passed, 8,640/0/669 each, with no strays and no suite failing after its result. 8,640 is round 2's 8,638 plus P28 and P29.
  - I read all ten records myself. They are the only records at `b6493436`, in a row, and they hold one and the same set of per-unit counts.
  - Runs 1–6 had 4 CPUs, and runs 7–10 had 2, with 4 jobs each, on a clean tree.
  - The first and the last, read with `test/gate-status.js --run`:
    - `20261122T122716Z-22-59f9 [v3-run-1] started 2026-11-22T12:27:16.307Z on b6493436 — PASS, exit 0, 8640 passed, 0 failed, 669 skipped, 465/465 suites`
    - `20261122T133112Z-22-4d52 [v3-run-10] started 2026-11-22T13:31:12.618Z on b6493436 — PASS, exit 0, 8640 passed, 0 failed, 669 skipped, 465/465 suites`
  - By each record's own clock, runs 1–6 took 367.1–400.5 s, and runs 7–10 took 521.1–534.1 s.
  - Run 1's extra 30 s, with `gate-side-by-side` doubled to 107.4 s, was load. The coordinator's host-side gate started 24 s into it, and P28 and P29 take 2.5 s on their own.
- [x] **CI on `b6493436`:** run 45022370952, on `d32653253`, the merge of `b64934363` into staging's `61d86166`. Both parts and `stack-free` succeeded. I read the coordinator's saved log of the run, and made no GitHub requests myself.
  - The verdict came about 7 minutes after the run started. The log runs from 12:27:33 to 12:34:33Z, and the coordinator gives 7 m 6 s from creation to finish.
  - Part 1, on an AMD EPYC 7763: `part 1 of 2: 236 of 471 suites`, then `Overall: PASS — 4525 passed, 0 failed, 363 skipped across 236 suites`. Its gate ran 6 m 42 s by the log.
  - Part 2, on an Intel Xeon 6975P-C: `part 2 of 2: 235 of 471 suites`, then `Overall: PASS — 4210 passed, 0 failed, 306 skipped across 235 suites`, in 3 m 36 s.
  - `stack-free` printed "The parts of the stack-free gate: success". No line in the log names a failure.
  - The parts add up to 471 suites, 8,735 passed and 669 skipped. CI's tree has one registered suite and five operations files more than the container's, from staging.
  - The saved log of CI on `7b89bbb5`, run 44995116940, shows both parts passing too: 4,357/0/266 and 4,376/0/403, with gates of about 4 m 19 s and 4 m 13 s.

## Round 3: the round-2 findings, re-checked

| Round 2 | The fix | What I found | Holds? |
|---|---|---|---|
| Non-blocking 1: an unref'd timer isn't waited for | Amendment 4's note under item 1 (ADR `:469`); `OPERATIONS.md:1161`; `engineering-team/README.md:76`; the unit runner's header and `linger()` comment (`test/helpers/gateUnit.js:162–166`); `engineering-team/CHANGELOG.md:129` | Each now says the unit waits until nothing keeps it alive, and that a failure on an unref'd timer is lost. That is what the code does: the unref'd 300 ms throw is still lost, with no wait (34 ms). | Yes |
| Non-blocking 2: the exit after the result could hang | Amendment 4, item 5. `test/helpers/gateUnit.js:52–63`: the exit runs inside a `try`, and a throw is logged, then the real exit is called again with 1. The stray listeners stay in place. | My round-2 hang fixture now ends in 2.1 s, as a FAIL "with exit 1 after it sent its result", and its unit is gone. P28 pins it, and fails against round 2's engine. The two exit-time cases from round 1 still fail. | Yes |
| Non-blocking 3: nothing pinned that a unit with nothing left reports at once | P29 | It passes at `b6493436` and at `7b89bbb5`, and fails on a mutant whose wait always runs to the cap | Yes |
| Non-blocking 4: the phase order | The story's "Process:" deviation (story `:91`). This round's commits run ADR, tests, then code. | Committed at 07:22:16, 07:24:11 and 07:26:13 | Yes |
| Non-blocking 5: the test plan | In `e5aad348`: "The failing runs of the review rounds", V3's "Runs that went before", relabeled V2-split and V3 rows, and the final V3 and CI rows | Its figures match the records, the two saved CI logs and my own runs | Yes |

I also checked Amendment 4's new cost claim, "the ten sealed runs took 365–386 s on 4 CPUs … 520 s", at `7b89bbb5`. All ten records there passed, 8,638/0/669, with no strays. Runs 1–6 took 364.2–386.0 s, and runs 7–10 took 518.8–520.1 s. The plan's figures are the container's clock, about a second above each record's own.

## Round 3: findings

### Blocking
None.

### Non-blocking
None new.

### Harness friction
1. **A review's progress lines can flip its verdict.**
   - L1's rule takes the last uppercase verdict word on any bold or heading line (`scripts/lib/review-verdict.awk`).
   - A multi-round review naturally writes progress lines, such as a bold checklist item saying that runs passed, with the verdict word in capitals. Four such lines made this review read as passed, and harness-lint's real-repo check failed in the coordinator's gate.
   - The awk file already notes this edge, for one waived case.
   - Suggest a `meta` row: the review template's Verdict section says to keep the capitalised verdict words off every other bold or heading line. Or the rule reads only a line that holds nothing but the verdict.

## Round 3 verdict

Both things the verdict waited on have landed, at the final code commit `b6493436`, and both hold:
1. AC5: the ten sealed runs in a row passed, with nothing failing.
2. AC1, AC4 and AC5: CI passed both parts, and `stack-free` gave its verdict in about 7 minutes, under 12.

The test plan's final V3 and CI rows, committed in `e5aad348`, match the records and the logs. That commit changes only the test plan and a ledger row, so the runs at `b6493436` cover the final code.

Every finding of rounds 1 to 3 is resolved:
- Round 1's blocking finding is fixed under Amendment 4. It is bounded as the amendment says: a failure later than 2 s after a run, or on a timer the suite unref'd, is lost.
- Every non-blocking finding of rounds 1 and 2 is fixed.
- The harness friction of rounds 1 and 3 has ledger rows.

**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; the result is in the chat, not in this file. `/close-book` offered if the book looks complete.
