# Test Plan: Story 1 — The stack-free gate gives the same verdict in half the time

**Story:** `engineering-team/stories/test-gate-speed/1-stack-free-gate-in-half-the-time.md`
**ADR:** `engineering-team/decisions/test-gate-speed/0001-every-suite-runs-in-its-own-process-several-at-a-time.md`
**Date:** 2026-11-21

This story's deliverable is test infrastructure, so the carve-out in `engineering-team/templates/adr.md` applies. Phase 3
writes a new guard suite, the re-aims and the registrations. Phase 4 edits the engine and the suites under change.

- **Phase 3, the Tester's files.** The Implementer must not modify any of these:
  - `test/gate-side-by-side.test.js` (new, registered);
  - `test/helpers/gateFixtures.js` (new fixtures; C6 and C11's fixtures re-aimed);
  - `test/gate-result-record.test.js` (C6 and C11 re-aimed);
  - `test/ci-test-job.test.js` (W10);
  - `test/registry.js` (`config-loading.test.js` in place of the pseudo-entry, `expand: 'operations'`, the guard suite
    registered, the header);
  - `test/config-loading.test.js` (new).
- **Phase 4, the Implementer's files.** `test/helpers/gateRunner.js`, `test/helpers/gateRecord.js`, `test/gate-status.js`,
  `test/operations.test.js`, `test/test.js` (its header), the new `test/helpers/gateUnit.js` and
  `test/helpers/discoverSuites.js`, and the docs.

## Coverage map

AC1's and AC5's main proofs are measurements, not tests. A suite can't time a GitHub runner or count its own flakes, so
they are in Verification, V1 to V4. The tests pin the mechanism those measurements rely on.

| Criterion | Test | File | Level |
|---|---|---|---|
| AC1 — half the time | P1: with `GATE_JOBS=2`, two suites that can only pass while the other runs both pass | `test/gate-side-by-side.test.js` | engine, in a child |
| AC1 | P4: with `GATE_JOBS` unset, one suite per CPU (`os.availableParallelism()`); `GATE_JOBS=3` gives 3 | same | engine |
| AC1 | **V1**: same tree, same GitHub runner, today's engine against the new one: at most half the time. **The stop rule** applies | Verification | measurement |
| AC1 | **V2**: the same comparison in the sealed container on 4 CPUs | Verification | measurement |
| AC1 | **V4**: every CI run of the PR finishes the job in under 12 minutes | Verification | measurement |
| AC2 — the same verdict | P6: an `expand` entry runs its own module with `{ discovered: 'separately' }`, then one suite per `*.test.js` in its folder, named by path, sorted, skipping `node_modules` and non-suites; counts add up; a file with no `run()` still fails; the first line says how the run counts its parts; `gate:status` names a failed unit by its name; without `expand` the module is called with nothing | same | engine |
| AC2 | P7: the real registry. Every entry has a file; `config-loading.test.js` is first and passes; exactly one entry, `operations.test.js`, expands over `operations` | same | registry, plus a child |
| AC2 | P8: the real `operations.test.js`, run with `{ discovered: 'separately' }`, runs only its own tests (fewer than 400) and says its files run as suites of their own. If it starts on the files, the test fails at once | same | suite, in a child |
| AC2 | P9: a global, a patched `fs`, a `chdir` and a loaded module that one suite leaves aren't there for the next | same | engine |
| AC2 | P16: a `run()` that never settles is that suite's FAIL, and the next suite still runs | same | engine |
| AC2 | P17: an entry with no file (a `{ name, run }` function) is that entry's FAIL, "has no file", and the run goes on | same | engine |
| AC2 | Every guarantee of `honest-test-gate` #1 and `test-suite-hermeticity` #4 still holds: gate-result-record A1–F2 (C6 and C11 re-aimed), suite-env-changes E1–E10 and S1–S8, stack-free-npm-test G1–G7, all unchanged apart from those two | existing suites | engine |
| AC2 | **V2**: over the same tree, the new engine's per-suite counts equal the old engine's; operations' count equals its own unit plus its 111 file units | Verification | measurement |
| AC3 — a log to read and measure | P10: two suites printing over the same seconds each come out as one block (`▶ [i/N] name`, its stdout and stderr in order, its result line), never mixed | same | engine |
| AC3 | P11: blocks come in finishing order, numbered by unit order; the record (schema 2: each suite's `name` and `ms`, `machine`) and the summary keep unit order | same | engine |
| AC3 | P4 and P3: the record's `machine { cpus, model, jobs }`, and the first line, "`<jobs>` at a time on `<cpus>` CPUs (`<model>`)" | same | engine |
| AC3 | P12: while two suites run, the record's `progress.running` lists both, `progress.current` carries both, and `gate:status` shows RUNNING 0/2 with both | same | engine |
| AC4 — one check, one command, no retries | W10 (rewritten for Amendment 3): two jobs. `stack-free-part` is a matrix of `part: [1, 2]` with `GATE_PART`, full-history checkout, `npm ci` then `npm test`, and the 40-minute guard. `stack-free` `needs` it, runs `if: always()`, fails unless `needs.stack-free-part.result` is `success`, and runs no action or test. There is no `GATE_JOBS` | `test/ci-test-job.test.js` | source contract |
| AC1 (Amendment 2) | P20: with `GATE_JOBS=2`, the largest of three fixtures, listed last, starts before the smallest, listed first, and the record keeps unit order | `test/gate-side-by-side.test.js` | engine |
| AC2, AC4 (Amendment 3) | P21: `GATE_PART=1/2` and `2/2` give two parts that share no suite, together cover all six fixtures, balance by file size within the largest file, and name the part on the first line and in the record. Their totals add up to an unsplit run's, and `[i/N]` matches the whole run's | same | engine |
| Amendment 3 | P22: an invalid `GATE_PART` (`0/2`, `3/2`, `1/0`, `one`, `1-2`, `2`) ends the run FAIL before its first suite, naming it. P23: a suite never sees `GATE_PART`, so a gate that a suite starts runs whole | same | engine |
| AC2 (Amendment 4; review round 1, blocking 1) | P24: a throw, an un-awaited rejection or a `process.exit` that a suite leaves to fire 300 ms after its run fails the run, as a stray named for that suite, one at a time and side by side. P25: a suite whose process exits non-zero or by a signal after sending its result (an exit cleanup that throws, a crash at exit) is its FAIL, saying so "after it sent its result". P26: a suite's process waits for the timers its run left (a 300 ms timer fires before the process ends), and one that leaves an interval running still ends within the cap and passes | `test/gate-side-by-side.test.js` | engine |
| AC3, AC5 (Amendment 4; review round 1, non-blocking 1) | P27: when the engine itself fails while a suite runs, it prints that suite's output so far, marked unfinished, before `Overall: FAIL`, and ends its process | same | engine |
| AC2 (Amendment 4; review round 2, non-blocking 2 and 3) | P28: a suite that leaves a listener swallowing every error, an exit cleanup that throws and an interval open still ends after its result, within 20 s, as its FAIL "after it sent its result"; the suite beside it passes. P29: of five plain suites run one at a time, the middle time is under 1,500 ms, where waiting out the 2 s cap would make every time at least 2,000 ms | same | engine |
| AC4 | W1–W9 unchanged: `pull_request` only, Node 22, `npm ci` then `npm test`, no retries, a 40-minute guard, two pinned actions. G5: `test/test.js` still runs the registry through `runGate` | existing | source contract |
| AC5 — no new flakes | P3: `GATE_JOBS=1` runs one at a time, in unit order | `test/gate-side-by-side.test.js` | engine |
| AC5 | P13: a process a suite leaves running is gone once that suite ends. P14: SIGINT prints a running suite's output so far, marked unfinished, before `Overall: INTERRUPTED`, and ends it. P15: an engine killed with SIGKILL leaves no suite running | same | engine |
| AC5 | P18: OPERATIONS.md §15 says side by side, a process of its own, `GATE_JOBS`, `GATE_JOBS=1`, and a ledger row for a side-by-side-only failure | same | doc contract |
| AC5 | P19: engineering-team/README.md, "Running and reading the test gate", names `GATE_JOBS` and the first line's CPUs | same | doc contract |
| AC5 | **V3**: ten full runs in a row in the sealed container with nothing failing, 6 on 4 CPUs and 4 with 4 jobs on 2 CPUs; and **V4**, every CI run of the PR passes | Verification | measurement |

**Two Phase-3 re-aims, and why.**
- **C6** proved "load order" with a file that one suite's run left and another's load looked for. With a fresh process for
  each suite, that file would reach the reader through the shared file system, which no engine isolates. C6 now uses a
  global, so it proves the property that survives: nothing an earlier suite's run leaves in its process reaches a later
  suite's load. It passes under today's engine, where every suite loads before any runs, and under the new one, where
  each loads in its own process. Under a single process that loads lazily, it fails.
- **C11** made the engine's own record write fail by patching `fs` inside a suite. Once the suite runs in its own
  process, the patch can't reach the engine. `record-dir-readonly` reaches it from outside: it takes write permission
  off the record directory. That binds any user but root, so C11 skips as root. CI's runner isn't root, and the sealed
  container runs as uid 501.

**Test Design clarifications to the ADR** (Amendment 1, approved with this plan):
1. An expanded unit's name is its folder's name, then its path under that folder, without `.test.js`. For example,
   `operations/graph/add-to-concept` matches Decision 3's example, and a fixture folder outside `test/` gives
   `ops/nested/also`.
2. The line `operations.test.js` prints when it leaves the files to the engine names `test/operations/` and says
   "suites of their own".
3. `machine.model` is `os.cpus()[0].model`, trimmed, and `machine.cpus` is `os.availableParallelism()`.

## Edge cases

- [x] `GATE_JOBS` of `0`, `-2`, `two` or `1.5` (P5): the run ends FAIL before its first suite, naming `GATE_JOBS`.
- [x] More jobs than units (P4: one unit with 4+ jobs). It runs normally; `machine.jobs` keeps the configured number.
- [x] A suite that leaves a grandchild running (P13), one that never settles (P16), one that hangs at an interrupt
  (P14), and an engine killed outright (P15).
- [x] stderr inside the block, in its place (P10).
- [x] A folder file with no `run()`, a non-suite helper, and a suite under `node_modules` in an expanded folder (P6).
- [x] An entry with no file (P17).
- [ ] Two expanded entries: none exist, and the first line's wording for two is unpinned.
- [ ] Windows: never supported (ADR, Out of scope).

## Test infrastructure

- Node's own runner, through the gate's registry (`test/registry.js`). No new framework.
- The engine tests use `test/helpers/gateFixtures.js`. Each scenario writes fixture suites to a fresh temp dir, records go
  to a temp `GATE_RECORD_DIR`, and the engine runs in a child process (`runEngineSync`, `startEngine`, and the new
  `runFunctionEntryEngine`). Children run with `cwd` = the repo.
- New fixtures, all in that helper:
  - `meet-a` and `meet-b`, each waiting for the other;
  - `chatty-a` and `chatty-b`: 15 lines over about 1.2 s, one stderr line, and a span record of pids and times;
  - `prints-then-hangs`, `slow-two`, `takes-a-while`;
  - `leave-state` and `see-state`;
  - `leaves-child`;
  - `own`, and the `EXPAND_FIXTURE` folder;
  - `record-dir-readonly`;
  - the global-based `marker-writer` and `marker-reader`.
- No live stack, no concept graph, no firmware state. P7 and P8 read the real registry and run the real
  `config-loading.test.js` and `operations.test.js` (own tests only) in children. Both are stack-free.
- On this Mac, never run the full `npm test` outside the sealed container. The agent-memory instance answers on
  `:7778` (memory `local-tapestry-container-is-agent-memory`).

## How to run

The suites this story touches, as a scoped gate with every endpoint dead:

```
/Users/wds4/repos/TapestryProtocol/tapestry/tmp/ste4/safe-run.sh "$PWD" /Users/wds4/repos/TapestryProtocol/tapestry/tmp/ste4/gate.js <label> \
  gate-side-by-side.test.js gate-result-record.test.js suite-env-changes.test.js stack-free-npm-test.test.js \
  ci-test-job.test.js config-loading.test.js openapi-document.test.js operations.test.js
npm run gate:status -- --label <label>
```

`operations.test.js` is there because P8 and its S1 read `test/registry.js`. List it or its files, never both: the memory
recipe's trap still applies to the old engine. The full gate runs in CI, and in the sealed container (V2, V3).

**The sealed container** (the owner's yes at planning, 2026-11-21). It runs on this Mac's Docker VM, which has 4 CPUs, as
uid 501 (non-root, matching the bind mount's owner), with no network while the tests run:

```
WT=/Users/wds4/repos/TapestryProtocol/tapestry/.claude/worktrees/vigorous-khorana-e9bc0e
git clone --no-local --branch feat/test-gate-speed "$WT" "$WT/tmp/gatebox/src"
docker run --rm --user 501:20 -e HOME=/tmp -e SCARF_ANALYTICS=false -v "$WT/tmp/gatebox/src:/work" -w /work node:22-bookworm npm ci
docker run --rm --init --user 501:20 -e HOME=/tmp --network none --cpuset-cpus 0-3 --memory 6g \
  -v "$WT/tmp/gatebox/src:/work" -w /work node:22-bookworm \
  bash -c 'git config --global --add safe.directory "*" && exec npm test'
```

`safe.directory` matters too. Docker's virtiofs mount on this Mac shows directories as owned by root and files as uid 501, so git refuses the clone as "dubious ownership". The `git config` line writes only the container's own `/tmp/.gitconfig` and leaves the gate's environment as it was. Without it the record has no git identity. Run alone, gate-result-record A2 then fails, and inside the first full container run it passed only because of what had run before it. GitHub's runners own their checkout, so they need no such line.

`--cpuset-cpus 0-1` with `-e GATE_JOBS=4` is the 2-CPU form.

`--init` matters. Without it `npm` is PID 1, and it never reaps an orphaned process, so a killed process group keeps zombie members. `tagging-edges-realtime-wrapper` RW15 then fails its own precondition, "the first wrapper's process group still had members 3 s after it was SIGKILLed". That happened in the first container baseline (under today's engine) on 2026-11-21. GitHub's runners have a real PID 1. The container can't reach the agent-memory instance: it has no
network, no Docker socket and no published port. The run's record lands in the clone's `tmp/gate-runs/`.

## Verification

### V1: the same-runner comparison on GitHub, and the stop rule (AC1)

One temporary commit on `feat/test-gate-speed`, pushed after the implementation is green locally, adds this step between
`npm ci` and `npm test`:

```yaml
      - run: |
          mkdir -p "$RUNNER_TEMP/oldgate"
          git show origin/staging:test/helpers/gateRecord.js | sed "s|path.resolve(__dirname, '..', '..')|'$PWD'|" > "$RUNNER_TEMP/oldgate/gateRecord.js"
          git show origin/staging:test/helpers/gateRunner.js | sed "s|path.resolve(__dirname, '..')|'$PWD/test'|" > "$RUNNER_TEMP/oldgate/gateRunner.js"
          node -e "process.env.BRAINSTORM_RELAY_URL='wss://test-relay.com'; process.env.BRAINSTORM_RELAY_PUBKEY='test-pubkey'; require(process.env.RUNNER_TEMP + '/oldgate/gateRunner').runGate({ suites: require('./test/registry').suites, label: 'old-engine' })" || echo "the old engine's run exited $?"
```

*(Corrected at review round 1: this is the step that ran, in commit `7df76221` and again inside each part for V1′.
The plan first wrote the copies to `.oldgate/` in the checkout; they went to `$RUNNER_TEMP`, outside it, so no suite
that reads `git status` saw them. The trailing `|| echo` means the old engine's own exit status didn't gate the job,
which is why each run's log was read for its `Overall:` line: the old engine passed in every timing run.)*

That is today's engine, as on `origin/staging`, run over this branch's registry. It ignores `expand`, so
`operations.test.js`, called with nothing, runs its files itself. The step has no "retry" or "rerun", so W8 holds, and no
`GATE_JOBS`, so W10 holds.
- The two times come from that run's step durations (`gh run view <id> --json jobs`): the old engine's step, and then
  `npm test`.
- **Pass:** `npm test` takes at most half the old step's time.
- **The stop rule:** if it doesn't, stop before review. The Architect brings the owner an amendment (ADR, Decision 11).
- The next push removes the step. The review cites the run's id and both times.

### V1, as run, and V1' for the split (AC1)

- **V1** (CI run 44978145159, Intel Xeon Platinum 8573C): today's engine 1,243 s, the new one 623 s, ratio 0.501. The stop rule fired. The owner chose longest-first (ADR Amendment 2).
- **The re-time** (CI run 44981972812, AMD EPYC 7763): 1,349 s against 703 s, ratio 0.521. The owner chose the split (ADR Amendment 3).
- **V1'**, with the same temporary step inside each part job:
  - Each part's runner first runs today's whole gate, then its own part.
  - **Pass:** on each runner, the part takes at most half of today's whole gate there. Then even two slow runners give the verdict in at most half.
  - The next push removes the step and its CHANGELOG row.

### V2: the same comparison, and the same counts, in the sealed container (AC1, AC2)

Over one tree, on 4 CPUs: the old engine, the same three lines as V1 run with `node`, then `npm test`. *(It ran at `7df76221`, before Amendments 2 and 3. Review round 1 compared the final tree's whole run, at `7836548a`, with it: the 351 suites that didn't change, and `operations`, have the same counts.)* Pass when:
- the new run takes at most half the old one's time;
- the `Overall:` totals of passed, failed and skipped are equal;
- every registry entry other than `operations.test.js` has the same counts in both records;
- `operations` in the old record equals the new `operations` unit plus its 111 `operations/…` units.

A short `node` script over the two records does the comparison, and the review quotes its output.

**For the split:** in the same container, `GATE_PART=1/2` and `GATE_PART=2/2` over the final tree. Their totals of passed, failed and skipped must add up to a whole run's. Every suite must be in exactly one part's record.

### V3: ten runs in a row, nothing failing (AC5)

Ten full `npm test` runs in the sealed container, each passing: six with `--cpuset-cpus 0-3` and four with
`--cpuset-cpus 0-1 -e GATE_JOBS=4`. This Mac's cores are about twice a slow runner's speed (seed-firmware: 28.6 s here,
57 s in run 44949158788), so 4 jobs on 2 CPUs put a slow runner's timing pressure on every time bound.
- A suite that fails only side by side gets a ledger row and a fix at its root, and the ten-run count starts again.
- It is never retried, and never moved out of the gate.
- `GATE_JOBS=1` re-runs it alone, to tell the two kinds of failure apart.

**Runs that went before.** None of these counts toward the ten. All passed in the container, each with 0 failed and 669 skipped:
- three on the first engine, at commit `7df76221`: 380 to 404 s;
- six with Amendment 2, at `85fba631`: 361 to 416 s;
- ten in a row at `7836548a`, before Amendment 4: 8,634 passed, runs 1–6 in 357–367 s and runs 7–10 in 515–520 s;
- ten in a row at `7b89bbb5`, with round 1's fix and before round 2's: 8,638 passed, runs 1–6 in 365–386 s and runs 7–10 in 520 s.

The ten count on the final code commit, `b6493436`. The commits after it change only the story's records: the test plan, the review and the story's status.

### V4: the PR's CI runs (AC1, AC4, AC5)

Every CI run of the story's PR to `staging` passes. Every run of the gate as merged gives its `stack-free` verdict in under 12 minutes. The planned timing runs are the exception: V1, the re-time and V1′ run today's whole gate first, and take about 30 minutes by design (ADR Decision 11). One run, 44985568553, was cancelled by a newer push, and `stack-free` read it as a failure, as it should. Each run's first line
names its CPUs, so the review can say what each runner was.

### The results (2026-11-21/22)

| Check | Run | What it measured | Result |
|---|---|---|---|
| V1 | CI 44978145159, Intel Xeon Platinum 8573C, one job | today's engine 1,243 s; the new one 623 s | 0.501, over half: stop rule (Amendment 2) |
| V1, re-time | CI 44981972812, AMD EPYC 7763, one job, longest-first | 1,349 s; 703 s | 0.521, over half: the owner chose the split (Amendment 3) |
| **V1'** | CI 44985636771, two parts, each runner timing today's whole gate first | part 1, AMD EPYC 9V74: 1,154 s, then 215 s. Part 2, AMD EPYC 7763: 1,353 s, then 444 s | **0.186 and 0.328: passes.** The parts' totals add up to the whole gate's: 4,195 + 4,491 = 8,686 passed, and 344 + 325 = 669 skipped |
| **V2** | sealed container, 4 CPUs, commit `7df76221` | today's engine 1,038.7 s; the new one 403.6 s | **0.389: passes.** All 354 entries have the same counts; `operations` = its own unit + its 111 files |
| V2, split | sealed container, commit `9d90954d`, the split's code | part 1: 232 suites, 4,375 passed, 350 skipped, 137 s. Part 2: 233 suites, 4,259 passed, 319 skipped, 233 s | **Passes:** no suite in both parts, all 465 covered, and 8,634 passed, 0 failed, 669 skipped, the same as a whole run |
| V3, before Amendment 4 | sealed container, commit `7836548a`, with the workflow still holding the timing step, which W1–W10 pass either way | ten full runs in a row: runs 1–6 on 4 CPUs in 357–367 s, runs 7–10 with 4 jobs on 2 CPUs in 515–520 s | Passed, all ten 8,634 passed, 0 failed, 669 skipped. The engine changed after it |
| V3, round 1's fix | sealed container, commit `7b89bbb5` | ten full runs in a row: runs 1–6 in 365–386 s, runs 7–10 in 520 s | Passed, all ten 8,638 passed, 0 failed, 669 skipped. The engine changed after it |
| **V3** | sealed container, commit `b6493436`, the final code | ten full runs in a row: runs 1–6 on 4 CPUs in 367–402 s, runs 7–10 with 4 jobs on 2 CPUs in 522–534 s | **Passes:** all ten 8,640 passed, 0 failed, 669 skipped, with no strays and no suite failing after its result. Run 1's extra time was load from a scoped gate on the host that started beside it |
| CI on `a57e570e` | CI 44987919987, the first run of the two-part workflow without the timing step | part 1, 3 m 50 s; part 2, 4 m 20 s; `stack-free`, 3 s | Passes: the verdict 4 m 29 s after the run started |
| CI on `4eb1da50` | CI 44991282286, the two-part workflow | part 1, EPYC 9V74: 235 of 471 suites, `npm test` 5 m 29 s; part 2, EPYC 7763: 236 of 471 suites, 5 m 40 s | Passes: the verdict about 6 minutes after the run started |
| CI on `7b89bbb5` | CI 44995116940, round 1's fix | part 1, AMD EPYC 9V74: 235 of 471 suites, 4,357 passed, 266 skipped, `npm test` 4 m 19 s; part 2, Intel Xeon 6975P-C: 236 suites, 4,376 passed, 403 skipped, 4 m 14 s | Passes: the verdict 4 m 47 s after the run started |
| **V4** | CI 45022370952, the final code, `b6493436` | part 1, AMD EPYC 7763: 236 of 471 suites, 4,525 passed, 363 skipped, `npm test` 6 m 42 s; part 2, Intel Xeon 6975P-C: 235 suites, 4,210 passed, 306 skipped, 3 m 36 s; `stack-free`, 3 s | **Passes:** the verdict 7 m 6 s after the run started, against 14–23 min today. The parts add up to 8,735 passed and 669 skipped |

CI runs a pull request's merge with `staging`, so its 471 suites hold one registered suite and five operations files that `staging` gained after this branch was cut. The container runs the branch alone: 465 suites.

### The failing run, at the Phase-3 commit

Confirmed on 2026-11-21, on the Architecture commit `25081b02` with this phase's changes, under today's engine and
`tmp/ste4/safe-run.sh` (every endpoint dead).

**The guard suite:** `gate-side-by-side: 1 passed, 18 failed, 0 skipped`. P7 passes, as it should once this phase's
registry edits are in. Each failure names what is missing, and none is an import error:

```
FAIL  P1   … got meet-a {… "verdict":"FAIL","pass":0,"fail":1, … "ms":15024 …}          (the suites ran one after the other)
FAIL  P2   … never in the engine's (pid 53865); chatty-a ran in 53865, chatty-b in 53865
FAIL  P3   … the record must say how many units ran at once — machine.jobs 1 …; got machine undefined
FAIL  P4   … the default is os.availableParallelism(), here 28, and the log names the machine …
FAIL  P5   … an invalid GATE_JOBS must end the run before its first suite …
FAIL  P6   … must be called as run({ discovered: 'separately' }) …; it was called with {"n":0,"args":[]}
FAIL  P8   … it went on to run them itself ("--- per-operation suites under test/operations/…")
FAIL  P9   … each suite starts in a fresh process with nothing another suite left …
FAIL  P10  precondition: with GATE_JOBS=2 the two must run side by side …; chatty-a ran …206–…423, chatty-b …429–…644
FAIL  P11  … so its block must come first …; got pass at 259, takes-a-while at 179
FAIL  P12  the record's progress.running must list every running unit …; progress was {"total":2,"completed":0,"current":null}
FAIL  P13  the process leaves-child started (pid 54691) was still running 5 s after the run ended …
FAIL  P14  … under a header marking it unfinished …; header at -1, the fixture's line at 4, of 6 lines
FAIL  P15  prints-then-hangs ran in the engine's own process (pid 54734) …
FAIL  P16  the suite after a run() that never settles must still run and pass …; pass's record entry is undefined
FAIL  P17  … must be that entry's FAIL, saying it has no file …; its record entry is {"file":"a-function-suite","verdict":"PASS",…}
FAIL  P18  §15 must tell a contributor how the gate now runs …
FAIL  P19  … missing: GATE_JOBS; that the run's first line names the CPUs
```

**The other suites this phase touched** pass under today's engine (scoped gate, label `tgs1-phase3-touched`):
`config-loading` 1/0/0, `gate-result-record` 34/0/0 (C6 and C11 re-aimed), `suite-env-changes` 18/0/0,
`stack-free-npm-test` 6/0/1, `ci-test-job` 15/0/0 (W10 new), `openapi-document` 10/0/0, and `operations`
1504/0/20 in 350 s, the same counts as CI's. The `gate:status` line:
`20261122T023435Z-55384-2d27 [tgs1-phase3-touched] … PASS, exit 0, 1588 passed, 0 failed, 21 skipped, 7/7 suites`.
No fixture process was left running afterwards.

The sealed container was checked the same day: `npm ci` in 10 s, then `ci-test-job` and `stack-free-npm-test` through
the engine with `--network none --cpuset-cpus 0-3`, both PASS, `os.availableParallelism()` 4.

### The failing runs of the review rounds (2026-11-22)

Each guard the review rounds added fails against the engine it guards against, for the reason it names. Each was run
alone under `tmp/ste4/safe-run.sh`, with every endpoint dead.

**P24–P27 against `75cb6286`,** round 1's guards with the engine before Amendment 4: `gate-side-by-side: 0 passed, 4 failed, 0 skipped`.

```
FAIL  P24  … late-throw, GATE_JOBS=1: it ended exit 0, last line "Overall: PASS — 3 passed, 0 failed, 0 skipped across 2 suites …"
           (and the same for late-throw, late-reject and late-exit, one at a time and side by side)
FAIL  P25  … exit-cleanup-throws: it ended exit 0, last line "Overall: PASS …"; and the same for crash-at-exit
FAIL  P26  late-timer's 300 ms timer must fire before its process ends …; it never fired
FAIL  P27  … under a header marking it unfinished, before the Overall line …; header at -1, the fixture's line at -1, of 4 lines
```

**P28 against `7b89bbb5`,** round 2's guard with round 1's fix. No process was left running afterwards: the engine's
own interrupt ended the unit's group.

```
FAIL  P28  the run must end on its own: after its result, swallows-at-exit's process must still exit … the engine was
           still waiting after 20012 ms, last line "[2/2] pass: PASS (2 passed, 0 failed, 0 skipped) 30ms"
```

**P29** passes against `7b89bbb5`, because a unit with nothing left already reported at once; it pins that half. To
show it bites, it ran against a copy of the tree whose wait always runs to the cap. That copy's `linger()` had lost its
`beforeExit` resolve and the cap timer's `unref()`:

```
FAIL  P29  a unit with nothing left must report at once, not wait out the cap: waiting would make every time at least
           2000 ms …; the middle of the five is 2058 ms (2040, 2062, 2060, 2058, 2054 ms)
```
