# ADR 0001: Every suite runs in its own process, several at a time, on the one runner

**Status:** Accepted
**Date:** 2026-11-21
**Story:** `engineering-team/stories/test-gate-speed/1-stack-free-gate-in-half-the-time.md`
**Supersedes (in part):**
- ADR `honest-test-gate/0001`, Decision, "Load order": every suite loads before any runs. Now each suite loads in a
  fresh process of its own, just before it runs (Decision 1).
- ADR `test-suite-hermeticity/0002`, on where its check runs. Its rules stand, and they now run inside each suite's
  own process (Decision 4).
- ADR `graph-operations-foundation/0001`, Decision 12, on who runs the files under `test/operations/`. When the gate
  runs `operations.test.js`, the gate runs each of those files as a suite of its own (Decision 3). A new operation
  still never edits `test/registry.js`, and a file there that exports no `run()` still fails.

## Context

The story asks for the `stack-free` check's verdict in at most half the time on the same runner (AC1), with the same
verdict (AC2), a log that can still be read and measured (AC3), one check named `stack-free` with `npm test` as the one
command and no retries (AC4), and no new flakes (AC5). The owner chose half over a third at planning, because half fits
the 4 CPUs of one runner and a third might need the job split across runners.

**How the gate runs today** (`origin/staging` `fb9e230b`):
- `npm test` is `node test/test.js` (`package.json:13`). It sets two relay keys for the config smoke check and calls
  `runGate({ suites })` with the registry's 353 entries (`test/test.js:13–20`): 352 files and the `config-loading`
  pseudo-entry, a `{ name, run }` function (`test/registry.js:21–35`).
- The engine (`test/helpers/gateRunner.js`) loads every suite before running any (`:204–226`), each load guarded. It
  then runs them one at a time in its own process (`:228–274`).
  - It traps `process.exit` from the first load to its own exit (`:199`).
  - It checks `process.env` around each suite and puts it back (`:213–226`, `:253–264`, `:279–283`; ADR
    `test-suite-hermeticity/0002`).
  - It counts escaped errors as strays named for the suite then running (`:158–163`).
  - It writes the run record after every suite (`:266–273`), and its signal handlers record INTERRUPTED
    (`:176–185`).
- `operations.test.js` is entry 340 of 353. After its own tests it runs all 111 files under `test/operations/` one
  after another inside its own run (`runDiscovered`, `test/operations.test.js:1159–1185`), and reports their counts
  as its own.

**Where the time goes.** In run 44949158788 (#191's last run, Azure eastus, a slow runner), `npm test` took 1,259 s.
Of that, 797 s was `operations`, and the other 352 suites took 462 s. The slowest file took 57 s
(`lifecycle/seed-firmware`), and the slowest suite outside `operations` took 51 s (`harness-lint`). The work is CPU
work. On this Mac, measured at planning, the five slowest files each kept about one core busy:

| File under `test/operations/` | Wall | CPU (user + sys) |
|---|---|---|
| `lifecycle/seed-firmware` | 28.6 s | 34.5 s |
| `export/nostr-send` | 28.4 s | 27.0 s |
| `lifecycle/migrate-job` | 13.2 s | 11.7 s |
| `graph/add-to-concept` | 12.4 s | 17.8 s |
| `rules/repair` | 10.0 s | 14.3 s |

GitHub's Linux runners for public repositories have 4 CPUs and 16 GB (GitHub's "GitHub-hosted runners reference").
The gate keeps about one of them busy.

**One risk to the target.** A cloud VM's 4 vCPUs are often 2 physical cores with two threads each. Four busy threads
then do less than four times the work of one. My estimate for this design on such a runner is 2.3 to 3 times faster,
so half is likely but not certain. Nothing in today's logs names the CPU, so nobody knows yet. AC3 adds the CPU model
to the log, and Decision 11 measures the speed-up on a real runner before review.

**Can the suites run side by side?** I audited `test/` at planning:
- **Ports:** every server a suite starts listens on port 0, a free port the system picks. No suite binds a fixed port.
  `safe-to-merge-check`'s `refusedPort()` (`:150–156`) binds a free port and releases it to get an address nothing
  answers. Another suite could take that same port in between, but the chance is tiny.
- **Temporary files:** the fixed names in `os.tmpdir()` all carry `process.pid`. Today every suite has the gate's one
  pid. Each suite will have its own, so they stay apart. `test/test-config.js` and `test/test-neo4j-config.js` use a
  fixed name, but no registered suite loads them.
- **The repository tree:** no suite writes into it, apart from copies of `src/` that a suite makes into a temporary
  folder (`operations.test.js:902–909`, `openapi-coverage.test.js:337–344`). The run record goes to `tmp/gate-runs/`,
  which git ignores. This matters because gate-result-record A2 and A7 compare `git status --porcelain` before and
  after a short run, so any suite writing into the tree at that moment would make them fail.
- **Git:** every `git init`, `commit`, `clone` or `worktree add` runs in a temporary repository. The real repository is
  only read.
- **Process-wide hooks:** no suite or application code uses `process.send`, an IPC channel or `NODE_CHANNEL_FD`. The
  three suites that read `process.argv` do it in their own child scripts, or under `require.main === module`.
- **Timing:** about 60 files compare elapsed time with a bound. That is where side-by-side load can bring flakes,
  as load made RW7 flaky before (OPERATIONS.md §15). The audit can't settle these. AC5's runs can.

**Two engine tests pin today's single process.**
- **gate-result-record C6** proves "load order" with a file. `marker-writer`'s run writes a file, and `marker-reader`
  checks at load whether it is there. With a fresh process for each suite, loading just before running, a reader that
  starts after the writer sees the file. That is the shared file system, not a leak the engine could stop.
- **C11** proves the engine's own failure by patching `fs` inside a suite (`record-write-fault`), so that the engine's
  next record write, in the same process, throws. Once suites run in their own processes the patch can't reach the
  engine. C11's own message says to re-aim the fixture if that happens.

The other A–F, E1–E10 and G tests hold as they are (Implementation notes, Phase 3).

**Constraints.**
- ADR `test-hermeticity-ci/0001`: one job, the check name `stack-free`, plain `npm test`, no retries, and a 40-minute
  hang guard.
- `main`'s ruleset 27080672 requires `stack-free` by name.
- The project is JavaScript with no build step, and this adds no dependency.
- CI's Node 22 and this Mac's Node 24 have `os.availableParallelism()`.
- The gate runs on Linux in CI and on macOS here, both POSIX.

## Options considered

### Option A — A pool of fresh processes on the one runner (chosen)

The engine stays the parent. It runs each suite in a fresh child process, up to the runner's CPU count at a time. The
files under `test/operations/` become suites of their own, so the biggest suite splits into 112 units. Each child does
for its one suite what the engine does today, then reports its result to the parent. The parent keeps the record, the
log, the summary and the signals. The workflow doesn't change.

- **Pros.** It reaches the target on one runner, as the story measures it (AC1). It keeps one job, one check, one
  command and one record (AC4). The same command runs side by side locally too, so local runs get faster as well.
  Suites become more isolated than today: globals, the require cache, the working directory and patched modules no
  longer pass from one suite to the next, which story `test-suite-hermeticity` #4 left out of scope. It also scales
  with the runner: a bigger machine runs more at a time.
- **Cons.** It is the riskiest change of the three to the engine itself: about 300 lines of the gate's most-depended-on
  code move between two processes. It brings load, and so a new class of timing flake (AC5). Starting 464 processes
  costs about 6% of the work. A suite's output shows only when it ends. And on a runner whose 4 vCPUs share 2 cores,
  the margin over half is thin (Context).

### Option B — Split the job into parts on several runners

`.github/workflows/test.yml` gets K jobs (`stack-free part 1 of K` …), each running `npm test` over one slice of the
units, and a final job with the id `stack-free`. It needs every part, runs `if: always()`, and fails unless every part
succeeded. Each part could also run side by side (Option A inside it).

- **Pros.** With K = 3 and the parts run one suite at a time, a slow runner's job would take about 7.5 minutes. That
  is 36% of today, with no extra load on any runner and so no new flake class. With Option A inside each part it
  would be faster still.
- **Cons.**
  - AC1 measures speed on one machine. So does the owner's reason for picking half over a third: half fits one
    runner, and a third might need the job split. This option meets the story's intent by another route, and would
    need the story changed first.
  - It changes ADR `test-hermeticity-ci/0001`'s one job and stable check: a pull request gets K + 1 checks, and the
    verdict comes from a job that ran no tests.
  - Each part pays its own checkout, `setup-node` and `npm ci`, about 25 s.
  - Each part lands on a runner of its own, chosen at random, so the slowest part sets the time.
  - Proving that the parts together ran every unit exactly once needs either job outputs that the final job adds up,
    or two more actions (`upload-artifact` and `download-artifact`). W9 allows only `checkout` and `setup-node`.
  - The run record splits across K runners.
  - `npm test` in CI is no longer the whole of what a contributor runs.

  Rejected for now. It stays the layer to add if Option A falls short on a real runner (Decision 11).

### Option C — Run only `operations`' files side by side

`runDiscovered` gets a worker pool, and nothing else changes.

- **Pros.** It is the smallest change, and it leaves the gate engine as it is.
- **Cons.** It can't reach half. The other 352 suites stay one at a time: 462 s plus `operations` at about 797 / 2.5
  ≈ 320 s, so about 780 s, 62% of today. It also puts a second scheduler inside one suite, and the env check would
  still name `operations` rather than the file that leaked. Rejected.

*(Worker threads in place of child processes were also weighed, inside Option A. A thread can't call
`process.chdir`, every native addon such as `lmdb` must be built to load in a thread, and `process.exit` behaves
differently in one. Child processes have none of these differences.)*

## Decision

We chose **Option A**. It is the only option that meets the story as written on one runner, and it keeps ADR
`test-hermeticity-ci/0001`'s one job, one check and one command. The trade is a larger change to the engine and a new
flake class. Both are bounded by the guard suite (Phase 3) and by AC5's runs (Decision 11).

1. **Each suite runs in a fresh process of its own.**
   - The engine forks a new child runner, `test/helpers/gateUnit.js`, for each unit, using
     `child_process.fork(gateUnit, [], { cwd, env: process.env, stdio: ['ignore', out, out, 'ipc'], detached: true })`.
   - The parent sends the unit's spec as the first IPC message, so the child's `process.argv` is just
     `[node, gateUnit.js]`. Today it is `[node, test/test.js]`.
   - The parent never loads a suite itself.
   - Node removes the IPC channel's variable from a forked child's environment before any code runs. A check during
     this design found that neither the child nor any process it starts sees it. So the child starts from exactly the
     gate's starting environment.
   - The parent never changes its own environment after it starts.
2. **Several at a time.**
   - `GATE_JOBS` sets how many units run at once. The default is `os.availableParallelism()` (4 on GitHub's runners),
     and `GATE_JOBS=1` runs one at a time, the story's way to run with nothing side by side (AC5).
   - A value that isn't a whole number of 1 or more ends the run before its first suite: Overall FAIL, exit 1, with a
     line naming `GATE_JOBS`.
   - Units start in unit order (Decision 3), each as soon as a slot is free.
3. **The units.** They are the registry's entries in order, except where an entry carries `expand: '<folder>'`.
   - That entry's own module runs as one unit, called with `run({ discovered: 'separately' })`.
   - Right after it come one unit per `*.test.js` file under `test/<folder>/`, at any depth, skipping `node_modules`
     and sorted by path. This is today's rule (`filesUnder` and `discoverSuites`, `test/operations.test.js:865–873`
     and `:1155–1157`), moved to one shared helper that both the engine and `operations.test.js` use.
   - Only `operations.test.js` carries `expand: 'operations'`.
   - A unit's name is its path under `test/` without `.test.js`, such as `operations/graph/add-to-concept`. A file
     outside `test/` is named by its basename, as today.
   - `operations.test.js`'s `run()` skips `runDiscovered` when given `{ discovered: 'separately' }`, and says so in
     one line. Called with nothing, as standalone or from a scoped gate that lists it, it runs its own tests and then
     every file, as today. So no caller silently loses the files.
   - The run counts 464 units: the registry's 353 entries, `config-loading` now among them as a file (Decision 9),
     plus the 111 files. The totals of tests passed, failed and skipped don't change.
4. **Inside a unit's process, today's rules for one suite.** `gateUnit.js`:
   - takes its starting environment first;
   - traps `process.exit`, so a call throws where it was made;
   - records `unhandledRejection` and `uncaughtException` as strays of this unit;
   - loads the suite, guarded, and checks `process.env`: a change at load is that unit's FAIL, and the unit is not
     run (rule 4 of ADR `test-suite-hermeticity/0002`);
   - waits one macrotask and checks again, so a change from a timer its load left is a stray, now named for this
     unit rather than `during: null` (rule 5);
   - runs it, normalises the counts with today's `normalize()`, waits one macrotask, and checks `process.env` again:
     a key left changed is one more failed check, named (rule 6). Each unit is the last suite in its own process, so
     rule 7's end-of-run check is this same check;
   - sends one result message (counts, failures, error, `envChanged`, strays, ms), waits for it to be sent, and exits
     through the real `process.exit`.

   What it does when a suite misbehaves:
   - **A suite that never settles.** When its `run()` never settles and nothing keeps the process alive,
     `beforeExit` fires. The unit then reports "its run() never settled", and that unit is a FAIL. Today the whole
     run ends there. Now the other units still run, and the run still ends FAIL with exit 1 (gate-result-record C14).
   - **A parent that dies.** On the IPC channel's `disconnect`, the child kills its own process group and exits at
     once. So a parent killed outright (gate-result-record B3) leaves no unit running.
   - **Values never leave the child.** The child sends only key names. Values are compared there and dropped, as
     today (story `test-suite-hermeticity` #4, AC3).
   - **The helpers stay where they are.** `envChangesSince`, `describeEnvChanges`, `normalize`, `verdictOf` and the
     clipping helpers stay in `gateRunner.js`, which has no load-time side effects, and `gateUnit.js` requires them.
5. **Each unit's output is one block (AC3).**
   - Each unit's stdout and stderr both go to one file. Node writes to a file synchronously, so nothing is lost when
     the unit exits. The file is `<os.tmpdir()>/gate-<runId>/<index>.log`.
   - When a unit's process has exited, the engine prints its block and deletes its file. The block is
     `▶ [i/N] <name>`, then the output as written, then today's result line,
     `  [i/N] <name>: <VERDICT> (<p> passed, <f> failed, <s> skipped) <ms>ms[ — <error>]`.
   - `i` is the unit's place in unit order and `N` the number of units, so a line always names the same unit.
   - Blocks appear in the order units finish. The `Test Results` summary that follows lists every unit in unit order,
     as today.
6. **A unit's processes end with it.**
   - Each child leads its own process group (`detached: true`). Once a unit's process has exited, the engine kills
     what is left in that group (`SIGKILL` to `-pid`). So no process a suite started outlives it, to hold a port or
     write a file during another suite.
   - On SIGINT, SIGTERM or SIGHUP the engine kills every running unit's group. It then prints, marked unfinished,
     each running unit's output so far, records INTERRUPTED, prints `Overall: INTERRUPTED …` as the last line, and
     exits 128 + the signal number.
   - A CI cancellation or the 40-minute guard therefore shows which suites were still running, and what they had
     printed.
7. **The record, schema 2** (`test/helpers/gateRecord.js`).
   - It adds `machine: { cpus, model, jobs }`, `progress.running` (the running units' names), and a `name` on each
     suite entry.
   - `progress.current` stays, as those names joined with `, ` or `null`, so a reader of schema 1 keeps working.
   - `suites` is kept in unit order.
   - `npm run gate:status` reads schema 1 and schema 2. While a run is going, it shows the running names, and it
     names a failed unit by its unit name.
8. **The log says how the run was made.**
   - The first line keeps naming the record, and adds how the run counts its suites and what it ran on:
     `Gate run <runId> — record: <path> · 464 suites (353 registered, with operations' 111 files run as suites of
     their own) · 4 at a time on 4 CPUs (<model>)`.
   - The `Overall:` line keeps its shape and its first token: `across <N> suites` counts units.
   - `Total skipped:` and the summary are unchanged.
9. **The config smoke check becomes a file.** `config-loading` moves from a function in `test/registry.js` to
   `test/config-loading.test.js`, unchanged in what it does. It still relies on the two keys `test/test.js` sets.
   - With every unit in its own process, a function can't be handed to a child. So the engine treats an entry with
     no `file` as that entry's FAIL: "has no file; a suite runs in its own process, so it needs one". The run doesn't
     end there.
   - No caller passes one today: the gate tests pass files, and so do the scoped-gate scripts.
10. **The workflow doesn't change.** It keeps one job, `stack-free`, running `npm ci` then `npm test`, with no
    `strategy`, no `matrix` and no `GATE_JOBS`. So CI runs as many units at a time as the runner has CPUs. A new W10
    pins that (Phase 3), and W1–W9 stand as written.
11. **How it is measured, and the stop rule.**
    - **AC1, on a GitHub runner.** One temporary commit on the story's branch adds a step that runs the same tree
      twice on the same runner: first through today's engine, then through `npm test`.
      - Today's engine is `gateRunner.js` and `gateRecord.js` as on `origin/staging`, kept beside the new ones under
        other names for that one commit.
      - It runs over the branch's registry. It ignores `expand`, so `operations.test.js`, called with nothing, runs
        every file itself.
      - The next push removes the step. The review cites that run's id and both times. That job runs about 30
        minutes on a slow runner, inside the 40-minute guard.
    - **The stop rule.** If the new `npm test` takes more than half the old one's time on that runner, the
      Implementer stops before review. The Architect then brings the owner an amendment, such as more units at a time
      than CPUs, or Option B on top of this. Nothing merges until the owner chooses.
    - **AC1 and AC5 on this Mac, in a sealed container.** The owner allowed this at planning. The container:
      - works on a fresh clone of the branch in this checkout's `tmp/`, since Docker can't see the scratchpad;
      - runs the `node:22` image (Node 22, as CI uses), as the image's non-root `node` user, since CI's runner isn't
        root and root ignores file modes;
      - runs `npm ci` in one container that has a network, and every test run in another with `--network none`, no
        Docker socket and no published port, so the agent-memory instance is out of reach;
      - limits CPUs with `--cpuset-cpus`, which `os.availableParallelism()` reads, rather than `--cpus`, which it
        doesn't.

      AC5's ten passing runs in a row happen there. Some should run with 4 units on 2 CPUs: this Mac's cores are about
      twice as fast as a slow runner's (seed-firmware: 28.6 s here, 57 s in run 44949158788), and that is how this Mac
      can put a slow runner's timing pressure on the suites. The test plan sets the split.

## Consequences

- **What this enables.**
  - **Speed.** On a slow runner, by the estimate above, the job takes about 8 to 10 minutes instead of 21, and each
    new operations story costs a pull request about a third as much wait. A local full run gets faster the same way.
  - **Isolation.** Each suite starts in its own process from the gate's starting environment, with nothing left from
    another suite: no globals, no require cache, no working directory, no patched module and no leftover process.
  - **Hangs.** A hang now names itself. A CI cancellation prints the suites still running, and their output so far.
  - **Per-file results.** A failure, an env change or a stray under `test/operations/` is named for its file, not
    for `operations`.
- **What this constrains.**
  - No suite may rely on another: not its order, not a file it leaves, not its process.
  - No suite may assume it has the machine to itself. A time bound must hold under the load of 4 suites at once on a
    slow runner. Where one doesn't, it gets a ledger row and a fix at its root (AC5), never a retry.
  - A suite's output appears only when it ends, or at an interrupt.
  - `runGate` accepts only file entries.
- **What changes for a reader.**
  - The `[i/N]` numbering and the suite count cover 464 units. Result lines arrive in the order units finish. The
    first line names the CPUs and how many run at once.
  - Readers that grep `Overall:` or the result lines, the `direct-feature` skill among them, keep working.
  - The CI log parser that ledger row `2026-11-21-ci-gate-nears-25-minute-timeout` used lives outside the repo. It
    brackets `operations`' files by their headings, which still print inside each block, and it will want reading
    against the new per-unit result lines.
- **New debt and follow-ups.**
  - **No per-unit time limit.** A hung unit still holds the job until the 40-minute guard, though now it is named.
  - **Units start in unit order.** Starting the slowest first could shorten the tail. With 464 units, the longest at
    57 s, and about 300 s of work on each of four CPUs, the tail costs well under a minute. Ordering by an earlier
    run's times would need that history on CI, which has none.
  - **Option B stays the next layer** if the suite outgrows one runner.
- **Firmware reinstall required?** No. No concept definitions change.

## Implementation notes

This story's deliverable is test infrastructure, so the carve-out in the ADR template (`engineering-team/templates/adr.md`,
"a story whose deliverable IS a test change") applies, as it did for stories `honest-test-gate` #1 and
`test-suite-hermeticity` #4. The Tester writes a new guard suite, plus the re-aims and
registrations. The Implementer edits the engine and the suites under change, and must not touch the guard suite or the
re-aimed tests.

**Phase 3 (the Tester's files; the Implementer must not modify them):**
- `test/gate-side-by-side.test.js`, new and registered. It drives `runGate()` in a child process over fixture suites,
  as gate-result-record does, and pins Decisions 1 to 9. For example:
  - two fixtures that each wait for the other's marker pass only side by side, and with `GATE_JOBS=1` they run one
    after the other (timestamps that don't overlap);
  - a global, a require-cache entry or a working-directory change one fixture leaves isn't seen by the next;
  - each fixture's output is one block, even when two print over the same seconds;
  - an `expand` fixture folder gives one unit per file, named by path, with counts that add up, and its own module is
    called with `{ discovered: 'separately' }`;
  - the first line names the CPU count, the model and the jobs, and so does the record;
  - an invalid `GATE_JOBS` ends the run FAIL before its first suite;
  - a unit's leftover process is gone once the unit ends;
  - SIGINT prints a running unit's partial output before `Overall: INTERRUPTED`;
  - a parent killed with SIGKILL leaves no unit process running;
  - an entry with no file is that entry's FAIL, and the run goes on;
  - the real registry's `operations` entry carries `expand: 'operations'`, and every file under `test/operations/`
    becomes a unit.
- `test/gate-result-record.test.js` and `test/helpers/gateFixtures.js`:
  - re-aim **C6** to the property that survives: each suite loads from the gate's starting environment and with
    nothing left by another suite, for example a global that `marker-writer` sets in its run, which `marker-reader`
    must not see at its load;
  - re-aim **C11** to reach the engine's own record write from outside its process: for example, a fixture that
    makes the record directory read-only during its run. That needs a non-root user, which CI has and the sealed
    container uses.
- `test/ci-test-job.test.js`: add **W10**, the one job with no `strategy`, `matrix` or `GATE_JOBS`.
- `test/registry.js`:
  - replace the `config-loading` pseudo-entry with `{ file: 'config-loading.test.js' }`, and add
    `test/config-loading.test.js` (the same check, as a file);
  - add `expand: 'operations'` to the `operations.test.js` entry;
  - update the header comment.

  Today's engine ignores `expand`, so the Phase-3 commit's gate still passes.
- The temporary AC1 step and its revert (Decision 11) are verification, not deliverable. They land as two commits on
  the branch, and the test plan names them.

**Phase 4 (the Implementer's files):**
- `test/helpers/gateRunner.js`: the parent. It builds the units (Decision 3), keeps a pool of `GATE_JOBS` (Decision
  2), forks and listens (Decision 1), prints the blocks (Decision 5), kills the process groups (Decision 6), handles
  the record and the summary (Decisions 7 and 8), and keeps today's `abandon` and `exit` safety nets for the engine's
  own failure.
- `test/helpers/gateUnit.js`: new. The child (Decision 4).
- `test/helpers/discoverSuites.js`: new. The one discovery rule, `filesUnder` plus `discoverSuites`.
  `operations.test.js` re-exports `discoverSuites`, so T1 is unchanged.
- `test/operations.test.js`: `run(options)` honours `{ discovered: 'separately' }` (Decision 3), and uses the shared
  helper.
- `test/helpers/gateRecord.js`: schema 2 (Decision 7).
- `test/gate-status.js`: reads schema 1 and 2 (Decision 7).
- `test/test.js`: its header comment. The two keys stay.
- **Docs.**
  - OPERATIONS.md §15, "What runs": suites in their own processes, `GATE_JOBS`, and reading a block.
  - The no-retry policy: a failure seen only side by side gets a ledger row and a root fix, and `GATE_JOBS=1`
    compares it with a run alone.
  - Update its `**Last updated:**` line.
  - `engineering-team/README.md`, "Running and reading the test gate": `GATE_JOBS`, and the first line's machine
    details. F1 and F2 keep their phrases. README is a harness-definition path, so the same commit adds a row to
    `engineering-team/CHANGELOG.md` (L10).
- **The ADR headers.** This ADR's acceptance adds a "Superseded in part by" line to ADRs `honest-test-gate/0001`,
  `test-suite-hermeticity/0002` and `graph-operations-foundation/0001`, in the Architecture commit.

**Order of work.**
1. Get the engine and the unit runner green against the guard suite.
2. Run one full gate in the sealed container, and fix what fails only side by side.
3. Push, and run the AC1 step on a GitHub runner. The stop rule applies.
4. Do the ten container runs, then the review.

**Branches.** Only `staging`. The sandbox branches take it when they next take `staging`. The gate runs on pull
requests to `staging` and `main`, and a promotion carries it to `main`.

## Out of scope

- Splitting the job across runners (Option B), unless the stop rule leads to an amendment the owner accepts.
- A per-unit time limit, and ordering units by an earlier run's times.
- Making any suite faster on its own, and the 40-minute limit.
- The CI log parser outside the repo.
- Windows, which the gate has never supported.

## Amendment 1 (2026-11-21, Test Design): three details the guard pins

The guard suite, `test/gate-side-by-side.test.js`, pins three details that Decisions 3, 7 and 8 left loose. These come
with the test plan's approval.

1. **An expanded unit's name** is its folder's name, then its path under that folder, without `.test.js`. An example is
   `operations/graph/add-to-concept`, which is Decision 3's own example. That way a fixture folder outside `test/` gives
   path-based names too, such as `ops/nested/also`. The guard can test the rule without writing into `test/` during a
   run: A2 and A7 compare `git status` before and after a run. Any other unit keeps Decision 3's rule.
2. **The line `operations.test.js` prints** when given `{ discovered: 'separately' }` names `test/operations/` and says
   its files run as "suites of their own".
3. **The machine fields.** `machine.model` is `os.cpus()[0].model`, trimmed, and `machine.cpus` is
   `os.availableParallelism()`. The first line uses the same two values.
