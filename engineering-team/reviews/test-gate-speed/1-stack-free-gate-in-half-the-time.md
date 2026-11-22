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
