# Build Audit: The stack-free gate gives the same verdict in half the time

**Book:** `engineering-team/audits/test-gate-speed/book.md`
**Date:** 2026-11-22
**Branch / commit range:** `fb9e230bb..48fe1ff7a` on `feat/test-gate-speed` (24 commits), plus this close. The branch
was cut from `origin/staging` at `fb9e230bb`. It is open as TapestryProtocol/tapestry#201 to `staging`, ready for review;
merging it waits for David's yes.
**Provenance:** Acceptance-frame
**Confidence:** high. Every frame bullet is checked against runs: CI, the sealed container and the guard suite. Each
run is named below.

> The Build Audit is the **as-built record**: what the product *is* now, factual and source-linked. It is
> audience-neutral. The product team reads it to scope the next phase, and a future engineer reads it to understand
> what shipped. It does **not** propose changes; that's the seed's job.

## 1. What shipped

The "product" is the repository's test gate: `npm test`, and the CI check `stack-free` that runs it on every pull
request to `staging` or `main`. Story `test-gate-speed` #1 delivered all of it
(`stories/done/test-gate-speed/1-stack-free-gate-in-half-the-time.md`).

- **Every suite runs in a fresh process of its own, several at a time.** As many run at once as the machine has CPUs.
  `GATE_JOBS=<n>` sets how many, and `GATE_JOBS=1` runs one at a time, to tell a failure that happens only side by side
  from one that happens alone. Side by side, the largest test file starts first.
- **`operations`' files run as suites of their own**, each named and timed for its file. A new operation still needs
  no registry line.
- **CI runs the gate in two parts, on two runners,** and one check named `stack-free` gives the verdict. It fails
  unless both parts succeeded, a cancelled part included. Each suite runs in exactly one part, and the parts add up to
  a whole run.
- **The check gives its verdict sooner.** Every CI run of the gate as merged gave its verdict in 4½ to about 7
  minutes. Today's gate took 14 to 23 minutes for the same check, depending on the runner.
- **The verdict is the same.** The same tests run, with the same counts, suite by suite. Skips are still counted, and
  nothing retries. The guarantees of story `honest-test-gate` #1 and story `test-suite-hermeticity` #4 still hold,
  within one stated bound (§4 #2).
- **A run is easier to read.** Each suite's output is printed as one block when it ends, never mixed with another's.
  The first line names the machine and the part. An interrupt, a cancellation or the engine's own failure prints each
  suite still running, with its output so far.

## 2. Epics & stories rolled up

### Epic: `test-gate-speed`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 stack-free-gate-in-half-the-time | the gate in its own processes, side by side, split in two on CI, same verdict | Done | `reviews/done/test-gate-speed/1-stack-free-gate-in-half-the-time.md`. Round 1 CHANGES_REQUESTED (late failures were lost); round 2 found five non-blocking findings, which the owner chose to fix; round 3 PASS |

The epic is retired at this close (§5, epic close-out). Its folders moved under `done/`.

## 3. As-built inventory

Derived from `git diff fb9e230bb..48fe1ff7a` (33 files).

- **User-facing (contributors and CI):**
  - `npm test` is unchanged as a command. New environment variables: `GATE_JOBS=<n>` and `GATE_PART=<i>/<n>`. An
    invalid value of either ends the run FAIL before its first suite.
  - `.github/workflows/test.yml`: job `stack-free-part`, a matrix of `part: [1, 2]`. Each part runs `npm ci` then
    `npm test` with `GATE_PART=<part>/2`, under `timeout-minutes: 40`. Then job `stack-free` (`needs: stack-free-part`,
    `if: always()`, `timeout-minutes: 5`) passes only when the parts' result is `success`. The check names are
    `stack-free-part (1)`, `stack-free-part (2)` and `stack-free`. `main`'s ruleset still requires `stack-free` by name,
    unchanged.
  - The log: the first line reads "Gate run … · part i of n: k of N suites (… registered, with operations' … files run
    as suites of their own) · J at a time on C CPUs (model)". Then one block per suite: `▶ [i/N] <name>`, its output,
    and its result line with its time. Unfinished suites are marked "(unfinished: its output so far)".
- **The gate engine** (`test/helpers/`):
  - `gateRunner.js` is rewritten as the parent. It forks one process per unit, over IPC, in a process group of its
    own, and kills that group when the unit ends. It handles the split, the start order and the record, and gives a
    unit that ends badly its FAIL.
  - `gateUnit.js` is new: the child. It runs one suite under the old per-suite rules: a guarded load, a trapped
    `process.exit`, the `process.env` check, strays and normalised counts. Then it lingers up to 2 s and exits in a way
    nothing the suite left can stop (Amendment 4).
  - `discoverSuites.js` is new, shared by `expand` and `operations.test.js`.
  - `gateRecord.js` writes record schema 2.
- **The registry** (`test/registry.js`): `{ file: 'operations.test.js', expand: 'operations' }`, and the
  `config-loading` pseudo-entry becomes `test/config-loading.test.js`. `test/operations.test.js` honours
  `run({ discovered: 'separately' })`.
- **Tests:** `test/gate-side-by-side.test.js` (P1–P29) and the fixtures in `test/helpers/gateFixtures.js`. In
  `test/gate-result-record.test.js`, C6 and C11 are re-aimed. `test/ci-test-job.test.js` adds W10, the two-job shape.
- **Domain:** none. No concept or firmware definition changed, so no firmware reinstall.
- **Data & contracts:**
  - Run record schema 2 (`tmp/gate-runs/<id>.json`, gitignored): `machine { cpus, model, jobs }`, `part { index, count,
    of }`, `progress.running`, and `suites[].name`. `npm run gate:status` reads schemas 1 and 2, and names a failure by
    its unit.
  - The unit's IPC messages, internal to the engine: `gate-unit` in, then one `gate-unit-result` out, carrying the
    counts and clipped strays. Only key names cross, never an environment value.
- **Docs:**
  - OPERATIONS.md §15 says how `npm test` runs, the parts, and what a suite leaves for later. `engineering-team/README.md`'s
    gate recipe and the harness CHANGELOG (three rows) say the same.
  - ADR `test-hermeticity-ci/0001` gains Amendment 3, and its table rows for the timeout and the check name change.
  - "Superseded in part" headers are added to ADRs `honest-test-gate/0001`, `test-suite-hermeticity/0002` and
    `graph-operations-foundation/0001`.
  - The intake entry points to the story.

## 4. Deviations from intent

Harvested from the story's Open questions and Deviations, ADR `test-gate-speed/0001` (Consequences, Out of scope and
Amendments 1–4) and the review's three rounds, then reconciled against the diff.

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame, "Half the time": the verdict in at most half today's time, on the same runner | The gate split into two parts on two runners. Each part took at most half of today's whole gate on its own runner, 0.186 and 0.328 (CI 44985636771) | intentional-change | One runner reached only 0.501 and 0.521 (CI 44978145159, 44981972812): its 4 vCPUs behave like about 2 cores. The owner chose the split, and AC1 was reworded (story Open questions 3 and 4; ADR Amendment 3) | Each pull request uses two runners for 4–7 minutes, against one for 14–23. The verdict comes in under 12 minutes even on the slowest runner seen | Parts balance by file size, not time (row `2026-11-22-gate-parts-balance-by-bytes`) |
| 2 | Frame, "The same verdict": every guarantee the gate makes today still holds | It holds within one stated bound. A failure a suite leaves for after its run counts if it fires within 2 s. One later than that, or one on a timer the suite unref'd, is lost | constraint-discovered | Review round 1 found that a unit's process ended one macrotask after its run, so late failures passed. Amendment 4 restored the guarantee, with a 2 s cap, to keep the run's time. Round 2 found the unref'd-timer edge, now stated (ADR Amendment 4, item 1's note) | Staging's engine also lost such a failure, but only for a run's last suite. The new engine loses it for every suite. None is known | — (accepted bound) |
| 3 | Frame, "The same verdict" (story AC2): an exit-time failure is that suite's FAIL | A process that exits non-zero or by a signal after its result is its FAIL, and nothing a suite leaves can stop that exit | added-beyond-scope | Staging's engine failed these differently: a throwing exit cleanup was the engine's own failure, and a crash at exit killed the whole run. Amendment 4, items 4 and 5, from rounds 1 and 2 | Stricter: such a failure is named for its suite | — |
| 4 | Story AC3: each suite's time | A unit's time runs from forking its process to its exit, process start included | interpretation | Today's engine timed only `run()`, having loaded every suite up front (story Deviations) | Per-suite times aren't comparable with the old log's | — |
| 5 | ADR Decision 3: `expand` runs a folder's files | An `expand` folder that holds no suite is a FAIL of its own | added-beyond-scope | The registry's rule that no suite is silently never run (story Deviations) | A mistyped folder fails loudly | — |
| 6 | ADR Decision 4: a unit that never settles is a FAIL | A unit whose process ends before sending a result is a FAIL too | added-beyond-scope | A crash, or a suite that kills its own process (story Deviations) | — | — |
| 7 | ADR Decision 7: the record rewritten as each unit ends | Also rewritten as each unit starts, so `progress.running` is current | interpretation | Test P12 (story Deviations) | `gate:status` shows what is running mid-run | — |
| 8 | ADR, Option A: one runner, workflow unchanged | Two jobs. `stack-free` became an aggregating job that runs `if: always()` | intentional-change | Amendment 3, the owner's choice at the second timing; W10 pins it | The required check's name is kept, so `main`'s ruleset needs no change | — |
| 9 | ADR Consequences: per-unit time limit | Not built. A hung unit still holds its part until the 40-minute guard, though it is now named | deferred | ADR Out of scope | A hang costs up to 40 minutes, and its name is in the log | §6 |
| 10 | ADR Consequences: the CI log parser outside the repo | Not updated | deferred | ADR Out of scope | A ledger-row measurement that reads CI logs needs the new per-unit lines | §6 |

**Undocumented work.** None. Every file in the diff traces to the story, ADR `test-gate-speed/0001` and its
amendments, the review's rounds, or a ledger row.

## 5. Quality state at close

**The test gate.** On this Mac the full `npm test` never runs against the local stack, which is the owner's private
agent-memory instance. The story's own measurements ran the full gate in a sealed Linux container: networking off, no
Docker socket, no host port. David allowed that for this story's measurement and stability runs.
- **CI** (the full gate, as merged with `staging`):
  - Run 45022370952 on `b6493436`, the final code: both parts pass, 4,525 and 4,210 passed, 0 failed. The verdict came
    7 m 6 s after the run started.
  - Run 45029287867 on `48fe1ff7`, the branch's head before this close: pass.
  - Every CI run of the gate passed, except 44985568553, which a newer push cancelled. `stack-free` read that one as a
    failure, as it should. The planned timing runs passed, and took about 30 minutes by design.
- **The sealed container:** ten full runs in a row on `b6493436`, from `20261122T122716Z-22-59f9` to
  `20261122T133112Z-22-4d52`. All ten were PASS, exit 0, with 8,640 passed, 0 failed, 669 skipped and 465/465 suites,
  and no strays.
- **The close's gate run** is recorded at the end of this section.

**Known open issues.** None open against the story. The accepted bound is §4 #2.

**A row this book resolved:** `2026-11-17-gate-recipe-runs-operations-suites-twice` (meta), set DONE at the close. A
scoped gate that lists `operations.test.js` beside its own suites no longer fails, because each suite runs in a process
of its own. Run `20261122T143354Z-91554-0202` used the row's recipe and passed: 1550 passed, 0 failed.

**Debt the ADR logged** (Consequences, and Amendment 4):
- **No per-unit time limit** (§4 #9).
- **The parts balance by file size, not time.** In the container, part 2 held 920 unit-seconds to part 1's 539. Row
  `2026-11-22-gate-parts-balance-by-bytes`.
- **The CI log parser** that ledger row `2026-11-21-ci-gate-nears-25-minute-timeout` used lives outside the repo
  (§4 #10).

**Epic close-out** (step 9). Epic `test-gate-speed` is Done, and its story, ADR and review folders moved under `done/`.
The close lands on the same branch as the code, before the merge, because the book's frame defines done as the open
pull request, with `stack-free` green and a review that passes ("Merging it waits for David's yes"). The code and its
close reach `staging` in one merge. Row `2026-11-22-gate-speed-close-awaits-staging` tracks it until then.

**The close's gate run** (step 10, over the final tree). It ran the 14 suites that read what the close changed, under
dead endpoints. Seven read the harness's folders and scripts: `harness-lint`, `harness-stats`, `ledger-row-ids`,
`rollup-scanners`, `session-start`, `brains-launcher-repo` and `operations/graph/memberships-shared`, whose MS22 reads
the ledger. With them ran `live-link-checks` and the story's six suites: `gate-side-by-side`, `gate-result-record`,
`ci-test-job`, `suite-env-changes`, `stack-free-npm-test` and `config-loading`.
- **Run `20261122T144028Z-1924-7ea6` (label `tgs-close-2`):** PASS, exit 0, with 352 passed, 0 failed and 1 skipped
  across 14 suites, and no strays. It ran on `48fe1ff7` with the close's edits in the working tree; only this bullet was
  changed after it. The skip is `stack-free-npm-test`'s probe of a live stack, which isn't there. An earlier run of
  the same 14, `20261122T143135Z-568-34c8`, passed the same way before the last ledger flip.

## 6. Carry-forward register

- [ ] **Balance the gate's parts by time, not file size**, if the slower part starts to set the check's time (§4 #1; row `2026-11-22-gate-parts-balance-by-bytes`).
- [ ] **A per-unit time limit**, so a hung suite fails fast instead of holding its part for 40 minutes (§4 #9; ADR Out of scope).
- [ ] **The CI log parser outside the repo** needs reading against the per-unit result lines before a ledger row measures with it again (§4 #10).
- [ ] **OPERATIONS.md §15's stale "Required-check status" paragraph** still says `main` enforces no required checks. It was out of scope here, and OPEN.md row 14 tracks it (story Out of scope).
- [ ] **The four harness `meta` rows** from the review rounds (§7).

## 7. Process findings (harness)

The retro ran on 2026-11-22. `scripts/harness-stats.sh` at retro time:
- the book open 1 day;
- 18 phase commits attributed to `test-gate-speed` (24 on the branch: story 1, adr 5, test 5, impl 5, review 2, docs 4,
  ci 2);
- one review file, with a CHANGES_REQUESTED round before its PASS;
- the story's cycle time 0d by the tool's same-day rule. It ran 2026-11-21 to 2026-11-22.

Every lesson here ports to Direction mode unchanged, since none depends on who answers the gates.

| Finding | Source | Terminal state |
|---|---|---|
| A guarantee carried forward only in prose was dropped, and every test stayed green. Test Design should list each carried guarantee from its story's text and name the test that pins it | Review round 1, harness friction 1 | OPEN.md row `2026-11-22-carried-guarantees-need-their-tests` (meta) |
| The dead-endpoint scoped-gate recipe that test plans cite lives in untracked files in the main checkout's `tmp/`, and can't drive `expand` | Review round 1, harness friction 2 | OPEN.md row `2026-11-22-scoped-gate-recipe-lives-in-tmp` (meta) |
| An AC about "every CI run" contradicted the ADR's planned timing runs | Review round 1, harness friction 3 | OPEN.md row `2026-11-22-ci-time-ac-ignores-timing-runs` (meta) |
| A review's progress lines can flip its verdict under L1's last-token rule. It failed a scoped gate on a clean tree | Review round 3, harness friction | OPEN.md row `2026-11-22-review-progress-lines-flip-verdict` (meta) |
| Round 1's fix committed its guards before its ADR amendment | Review round 2, non-blocking 4; story Deviations ("Process:") | declined: the harness already puts Architecture first, and round 2's fixes followed it. The slip came from a gate option worded "Guards first", and the Deviations record it |
| The stop rule (ADR Decision 11) fired twice, and each time the owner chose the next layer (Amendments 2 and 3) | Story Open questions 3 and 4 | declined: the rule worked as designed, so no change is needed |
| A push during a planned CI timing run cancelled it (44985568553), and the no-rerun rule meant waiting for the next push's run | Test plan V4 | declined: OPERATIONS.md §15 already says a newer push cancels the older run. The test plan records it, and later timing runs held pushes |
