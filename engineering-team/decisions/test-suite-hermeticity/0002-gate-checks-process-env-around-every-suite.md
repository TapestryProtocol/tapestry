# ADR 0002: The gate checks `process.env` around every suite's load and run, fails the suite that changed it, and puts it back

**Status:** Accepted
**Date:** 2026-11-20
**Story:** `engineering-team/stories/test-suite-hermeticity/4-suite-env-changes-fail-the-gate.md`
**Supersedes (in part):** ADR `honest-test-gate/0001`, for `process.env` only:
- Decision, "Load order" (`:173–175`): its rejection of snapshotting and restoring `process.env` around each suite.
- Out of scope (`:446–448`): "cross-suite env hygiene", which it left to the assertion sweep (`test-suite-hermeticity` #2).

Its load order stands: every suite still loads before any runs.

**Superseded in part by:** ADR `test-gate-speed/0001` (2026-11-21), on where the check runs. Its rules stand, and they now run inside each suite's own process. The sentence above no longer holds: each suite loads just before it runs, from the gate's starting environment.

## Context

The story asks the gate to:
- fail any suite that leaves `process.env` different from how it found it, at load (AC1) or after its run (AC2);
- name every changed key, and never a value (AC3);
- give every other suite the environment the gate began with (AC4);
- pass with today's suites, the six it names brought into line (AC5).

The owner settled three questions at planning: load and run, every key, and the environment given back (story, Open questions).

**What the engine does today** (`test/helpers/gateRunner.js` at `origin/staging` `5fa52957`):
- It traps `process.exit` from the first load to its own exit (`:154`).
- It loads every suite first, each `require` in its own try/catch (`:157–164`). A load failure becomes that entry's FAIL, and its `run()` is not attempted.
- It then runs each entry in registry order (`:166–196`). For each one: `await run()` in a try/catch (`:181`), a verdict, a result line, and a record rewrite (`:191–196`).
- After the last suite, it waits one macrotask so that a deferred call from that suite lands before the verdict (`:198–200`).
- Nothing looks at `process.env`. One process shares it across the whole run.

**What the audit found** (2026-11-20). It searched `test/`, `src/`, `lib/`, `scripts/`, `bin/` and `setup/`, then read every write site:
- **No suite or in-process helper writes `process.env` at load.** The one unindented write, `test/helpers/routeWalk.js:72`, runs in a child process.
- **28 suite files write it directly inside a function.** One more, `task-queue-job-gate`, writes it through `test/helpers/taggingEdgesPassFakes.js:879–884` and `:1268–1273`. In the gate's own process, exactly the story's six leave a change behind:
  - `search-api-result-type-settings` sets `TAPESTRY_SETTINGS_PATH` (`:61`) and never puts it back, on purpose (`:52–58`).
  - `strfry-router-saved-state` P3 restores `BRAINSTORM_ROUTER_PLUGINS_DIR` by assignment (`:172–178`). Node turns an assigned `undefined` into the string `"undefined"`, so a key that was unset is left holding that string. The same file restores the same key correctly at `:366–367`. *(Corrected by Amendment 1: P3 does not leak.)*
  - `tl-certainty-method` (`:54`, `:359`), `tl-membership-method-selector` (`:66`, `:415`) and `tl-weighted-sum-method` (`:52`, `:478`) set `TAPESTRY_SETTINGS_PATH` and end their runs by deleting it.
  - `trusted-list-pin-publish-blockers` AC-7 sets `SCHEDULED_TASKS_CONFIG_PATH` (`:240`) and deletes it at the end of the test, outside a `finally` (`:252`).

  The four that delete change the environment whenever the key was already set when they began.
- **Every other writer puts back each key it changes in the gate's process,** saving it first and restoring it in a `finally`, and deleting a key that was unset. Their remaining writes run in child processes:
  - `tagging-edges-confirm`'s `chChild` (`:1153`) and `tagging-edges-pass-routes`' `pxChild` (`:1453`) run under `node -e` (`:1300`, `:1677`);
  - `test/helpers/accessHarness.js:158` runs in its three users' children;
  - `scripts/live-link-checks.js:111` runs as its own process.
- **Product code:**
  - `src/manage/taskQueue/testSystemStateGatherer.js:24` is the only write in `src/`. It sits inside a function that no suite calls.
  - `bin/`, `lib/` and `setup/` have none.
  - `tests/global-setup.js` belongs to Playwright, outside the gate.
- **Not audited:** packages under `node_modules/`. A package that sets a key when it loads would fail the first suite that requires it. The pull request's stack-free CI run is where that would show.

**An existing guard depends on today's behaviour.** `test/gate-result-record.test.js` C6 (`:358–370`) proves "every suite loads before any runs" with two fixtures from `test/helpers/gateFixtures.js:109–113`:
- `env-writer` sets `GATE_FIXTURE_ENV_PROBE` in its run and leaves it set;
- `env-reader` reads that key at load;
- C6 asserts that the reader passes and the run exits 0.

Under this ADR env-writer fails, so C6's exit-0 assertion fails. C6 can also no longer tell eager loading from lazy loading through that channel.

**Constraints:**
- **One process.** Running each suite in its own process is out of the story's scope.
- **No API newer than Node 16.** ADR `honest-test-gate/0001` recorded v16.17.0 on the owner's Mac; CI and the image run 22. So the engine uses `Object.prototype.hasOwnProperty.call`, not `Object.hasOwn`, and no `structuredClone`.
- **Nothing new to install** (CLAUDE.md: no build step, no lint or typecheck tooling).
- **The owner's Mac never runs the full gate.** The `tapestry` container there is the live agent-memory instance.
  - Scoped gates there use dead endpoints.
  - `test/stack-free-npm-test.test.js` runs only in CI, because its G2 runs live suites against any control panel that answers.
- **Lane rules.** The deliverable is test infrastructure, so the ADR template's carve-out applies (Implementation notes).

No concepts are touched: this is test infrastructure. The concept-graph probe (`GET /api/concept-graph/summaries` on this Mac's instance) answered HTTP 200 with 55 summaries, and there are no handles to walk. Firmware reinstall: no.

## Options considered

### Option A — the engine checks `process.env` at every boundary, fails the suite that changed it, and puts it back (chosen)

The engine copies `process.env` just before the first load; that copy is the gate's starting environment. It compares the live environment with the copy after each suite's load and after each suite's run, and puts the copy back after each comparison:
- a suite whose load changed a key fails and is not run;
- a suite whose run left a key changed fails, with one more failed check;
- each failure names the keys, never their values.

*Pros:*
- AC1–AC4 hold where the change happens. The suite that made it is the one that fails, in every gate run, CI's stack-free run included.
- No suite can reach another through `process.env`, whatever order they are registered in.
- One mechanism, in one file. A new suite needs nothing.
- It's cheap: about 700 comparisons of a hundred-odd strings, and one macrotask per suite (Decision).

*Cons:*
- A key set by a package at load fails whichever suite first requires that package. The fix goes in that suite, not in the package.
- A change deferred by more than a macrotask still lands on whichever suite is running then.
- C6 must be re-aimed.

### Option B — a stack-free guard suite that loads every registered suite in a child and compares its environment (the ledger row's second shape)

*Pros:* the engine stays as it is.

*Cons:* it meets AC1 alone, and only in the guard's own result. Rejected:
- To see a change left after a run (AC2), it would have to run every suite a second time inside the guard: a second full gate.
- The leak still reaches every other suite in the same run (AC4).
- The guard fails, not the leaking suite (AC1).
- It repeats the gate's whole load of 351 suites in a child, on every run.

### Option C — make `process.env` refuse writes, so a write throws where it is made

Swap `process.env` for a Proxy, or trap its setters, during the load phase or the whole run.

*Pros:* the error carries a stack trace that points at the line that wrote.

*Cons:* Rejected:
- Over the whole run, it breaks every suite that sets a key and puts it back, which AC2 says keep their results.
- Over the load phase only, it still leaves the run-time half to Option A.
- Replacing `process.env` changes the object every module sees, so a module that keeps `const env = process.env` holds the Proxy afterwards.
- The key names Option A reports are all AC1 asks for.

## Decision

We chose **Option A**. It is the only option that fails the suite that made the change, covers both load and run, and keeps the change from reaching any other suite (AC4).

What we trade away:
- A package's load-time write, should one exist, becomes some suite's failure to handle.
- C6 has to be re-aimed.
- Every gate run takes a few hundred milliseconds longer.

**The rules the engine applies:**

1. **The starting environment** is a copy of `process.env`, taken in `runGate` just before the first load. It holds whatever the caller set before calling `runGate`, such as `test/test.js:14–15`'s two relay keys for the config smoke check (story, Out of scope).
2. **A comparison** checks the live `process.env` against the starting copy and gives three sorted lists of key names:
   - *added*: in the live environment, not in the copy;
   - *removed*: in the copy, not in the live environment;
   - *changed*: in both, with a different value.

   Values are compared, and never kept, printed or recorded.
3. **Putting it back** means deleting every added key and setting every changed or removed key back to its starting value. The live environment then equals the copy.
4. **After each load** (inside the load loop, after the `require`, whether it returned or threw), compare and put back. Any change:
   - makes the entry's result `{ pass: 0, fail: 1, skipped: 0 }`, and the entry is not run, as with a load failure;
   - sets its error to `changed process.env when it loaded, so it was not run (<n> key[s]): added A, B; changed C; removed D — a suite may set process.env only inside run(), and must put it back before run() ends`.

   A load that also threw keeps its `failed to load: …` text first, then `; and ` and the env text.

   **Not running it is a safety rule.** A suite that set keys at load expects its run to see them. Story 46's suite set dead endpoints so that its own requests reached nothing. Run with the starting environment put back, a suite like that could reach a live stack.
5. **After the load phase**, wait one macrotask, compare and put back. A change found here was deferred by some suite's load. It goes into `strayErrors` with `during: null` and the message `process.env changed after the suites loaded, before any ran (<n> key[s]): …`, and the existing stray-error rule fails the run.
6. **After each run:**
   - When `run()` settles (passed, failed, threw, or called the trapped `process.exit`), wait one macrotask while `current` still names the suite. A change or a stray error the suite deferred with a zero-delay timer or `setImmediate` then lands against that suite, not the next one.
   - Then compare and put back. Any change adds 1 to the suite's `fail` and sets its error to `left process.env changed after its run (<n> key[s]): added A; changed C — put each key back before run() ends (delete one that was unset)`. A suite that already has an error keeps that first, then `; and ` and the env text.
   - A suite that changes keys during its run and puts them back keeps its result (AC2).
7. **After the last suite**, the existing one-macrotask wait (`:198–200`) is followed by one more compare and put back. A change found there is a stray: `process.env changed after <last suite> finished (<n> key[s]): …`.

**Names, never values (AC3).**
- The env check writes key names, counts and the words added, changed and removed, and nothing else. That covers:
  - every message above;
  - the result line that carries one (`— <error>`, printed at `:189` today);
  - the record's `suites[].error`;
  - the new `suites[].envChanged`.
- Each message gives the key count first, so `R.clip`'s 500-character cut (`test/helpers/gateRecord.js:37`, `:94–97`) still leaves the count.
- The record's existing `label` (from `GATE_LABEL`), `cwd` and `argv` are the run's own identity fields (ADR `honest-test-gate/0001` §2). They stay as they are.

**The record.** Each `suites[]` entry gains `envChanged`:
- `null` when the suite changed nothing;
- otherwise `{ phase: 'load' | 'run', added, changed, removed }`, each an array of key names.

A suite has at most one, since a suite that changed keys at load is not run. The field is additive: `schema` stays 1, and `test/gate-status.js` reads no field it would disturb.

## Consequences

- **What this enables:**
  - No suite can change what another sees through `process.env`, whatever their order. The ledger row's failures can't recur: live checks skipping, G2 failing, a scratch live check pointed at `no-such-container`.
  - A leak fails in the pull request that adds it, in CI's stack-free run, with the suite and the keys named.
  - A suite's deferred zero-delay work counts against that suite rather than the next one. That includes an escaped rejection and a timed `process.exit`.
  - A child process started by any suite inherits the starting environment.
- **What this constrains:**
  - A suite sets `process.env` only inside `run()`, and puts every key back before `run()` ends: in a `finally`, deleting a key that was unset. Values meant for a child go in that child's `env`.
  - Suites can no longer pass anything to one another through `process.env`. The audit found none that do.
  - A suite whose load changes a key is not run at all.
  - A gate run takes a few hundred milliseconds longer.
  - A suite that busts the require cache and re-requires `src/config/settings.js` after `search-api-result-type-settings` has run now resolves `TAPESTRY_SETTINGS_PATH` from the starting environment. Today it gets that suite's temp file, deleted by then. The audit found no such suite; the stack-free CI run is the check.
- **New debt and follow-ups:**
  - The other state that suites share in one process stays unchecked (story, Out of scope): the working directory, the require cache, globals and patched modules. For example, `search-api-result-type-settings` still leaves `src/` modules in the require cache that were loaded under its temp settings path. A later story could cover `process.cwd()` with the same copy, compare and put-back.
  - A change deferred longer than one macrotask still lands on whichever suite is running.
  - A leak on a path only a live stack reaches shows only in a run with a stack (story, Out of scope).
- **Firmware reinstall required?** No: no concept definitions change.

## Implementation notes

**Lane mapping: the carve-out applies.** The artifact under repair is test infrastructure, the engine and six suites, so the standing test-lane rule inverts (ADR template, "Carve-out").

- **Phase 3 (Tester):**
  - writes a new guard suite, `test/suite-env-changes.test.js`, that fails against today's engine and today's six suites;
  - re-aims C6 in `test/gate-result-record.test.js`;
  - adds any fixtures it needs to `test/helpers/gateFixtures.js`;
  - registers the guard in `test/registry.js`, next to `gate-result-record.test.js` (`:270`).
- **Phase 4 (Implementer):**
  - changes `test/helpers/gateRunner.js` and the six suites;
  - edits the docs and flips the ledger row;
  - must not touch the guard suite, `test/gate-result-record.test.js`, `test/helpers/gateFixtures.js`, `test/registry.js` or `test/stack-free-npm-test.test.js`.

A Phase-4 `test/` diff is expected. The Reviewer checks that it is confined to the files named in §1 and §2.

**1. Engine — `test/helpers/gateRunner.js`.**
- **Local helpers, not exported:**
  - `snapshotEnv()`: a plain-object copy of `process.env`;
  - `envChangesSince(start)`: returns `{ added, changed, removed }`;
  - `restoreEnv(start)`;
  - `describeEnvChanges(c)`: gives `(<n> key[s]): added …; changed …; removed …`, leaving out empty groups.
- **Take the starting copy** just before `const loaded = suites.map(…)` (`:157`).
- **Load loop (`:157–164`).** After each `require`, in both the success and the catch branch, compare and put back. Keep the lists on the loaded entry as `envAtLoad`.
- **After the load loop:** `await` one macrotask (`setTimeout(…, 0)`, as at `:200`). Then compare, record any change as a stray, and put back.
- **Run loop (`:166–196`):**
  - An entry with `envAtLoad` gets the load-time result and error (Decision, rule 4) in place of a run.
  - For every other entry, after the existing try/catch around `run()`: `await` one macrotask, then compare and put back (rule 6).
  - Set `r.envChanged` before `verdictOf(r)`, so that the verdict, the result line and the record agree.
  - The record mapping (`:191–196`) adds `envChanged: x.envChanged || null`.
- **After the final macrotask (`:200`):** compare and put back (rule 7), before the summary.
- **The header comment (`:1–31`)** gains a bullet saying:
  - the environment is checked around each load and each run;
  - a change is that suite's FAIL, with the keys named;
  - the starting environment is put back.

**2. The six suites.** Each puts back what it changed, and only that.
- **`test/search-api-result-type-settings.test.js`:**
  - In `run()` (`:314`), before the first test, note whether `TAPESTRY_SETTINGS_PATH` is set and to what.
  - Put it back in a `finally` around the test loop: delete it if it was unset, set it back if it was set.
  - Rewrite the comment at `:52–58` that calls leaving it set safe.
- **`test/strfry-router-saved-state.test.js` P3 (`:172–178`):** *withdrawn by Amendment 1:* the suite doesn't leak, so nothing changes here.
- **`test/tl-certainty-method.test.js` (`run()` at `:326`), `test/tl-membership-method-selector.test.js` (`:390`) and `test/tl-weighted-sum-method.test.js` (`:434`):**
  - Note `TAPESTRY_SETTINGS_PATH` at the start of `run()`.
  - Replace the closing `delete` (`:359`, `:415`, `:478`) with a conditional restore, reached on every path out of `run()` that reaches the `delete` today.
- **`test/trusted-list-pin-publish-blockers.test.js` AC-7 (`:237–253`):** note `SCHEDULED_TASKS_CONFIG_PATH` before `:240`, and restore it conditionally in a `finally` that replaces the `delete` at `:252`.

**3. Docs.**
- **`engineering-team/README.md`, "Running and reading the test gate" (`:57–64`):** one new bullet, saying:
  - a suite that leaves `process.env` changed, when it loads or after its run, is that suite's FAIL, naming the keys;
  - a suite whose load changed it is not run;
  - the gate puts the starting environment back for every other suite;
  - set keys only inside `run()`, put them back in a `finally` (deleting one that was unset), and give a child its own `env`.
- **`engineering-team/CHANGELOG.md`:** a row in the same commit. The README is a harness-definition path (`scripts/harness-def-paths.txt`), so without the row L10 fires on the commit.

**4. Ledger.** The implementation commit flips `ledger/2026-11-20-suite-env-changes-reach-every-suite.md` to `DONE`, pointing to this ADR and the story. The Reviewer verifies it.

**5. Records.** This ADR's own commit adds a `**Superseded in part by:**` line to ADR `honest-test-gate/0001`'s header.

**Phase 3: the guard's expected coverage.** This is the Tester's design space; the list is the coverage this ADR expects.

Everything runs stack-free. The engine runs in a child `node` over fixture suites, with records in a temp `GATE_RECORD_DIR`. Every child gets dead endpoints:
- dead ports;
- `TAPESTRY_CONTAINER=no-such-container`;
- a `BRAINSTORM_CONF_PATH` whose `NEO4J_URI` is `bolt://127.0.0.1:9`;
- fake `curl` and `docker` first on `PATH`.

The guard must reach nothing from any machine: `tl-weighted-sum-method`'s live layer, for one, writes the container's `settings.json`.

- **AC1:**
  - Three load-time fixtures: one adds a key, one changes a preset key, one removes a preset key. Each entry is FAIL; its error names the key; `envChanged.phase` is `'load'`; its `run()` never ran (it would have left a marker); and the run ends FAIL with exit 1.
  - A fixture that leaves the environment alone passes in the same run.
- **AC2:**
  - Run-time fixtures that add, change and remove a key: each is FAIL naming the key, with `phase: 'run'` and its own counts plus one failed check.
  - One that throws after adding a key: its error carries both.
  - One that sets a key and puts it back: keeps its result.
  - One that sets a key on a zero-delay timer after its `run()` resolves: that fixture fails, and the fixture after it passes.
- **AC3:** the values the fixtures write, and the preset starting values, appear nowhere in the child's stdout, its stderr or its record file.
- **AC4:**
  - Probe fixtures placed before and after a load-time leaker and a run-time leaker read the starting values, both at load and at run.
  - A child started by the later probe inherits them.
- **AC5:**
  - Each of the six suites runs in a child, through its `require` and `run()` directly, with the child comparing its own environment before and after. It must leave `process.env` as it found it.
  - Each runs once with the keys it touches unset. The five that touch `TAPESTRY_SETTINGS_PATH` or `SCHEDULED_TASKS_CONFIG_PATH` run once more with that key preset to a temp path.
  - Today each of the six fails at least one of these runs.
  - These checks don't go through the engine, so they fail before Phase 4's engine change, and judge the suites alone.
- **C6 re-aim:**
  - C6 keeps its property, that every suite loads before any runs, through a channel the env check doesn't police. For example, the writer's run creates a marker file in the scenario directory, the reader records at load whether it exists, and the run exits 0.
  - `env-writer` stays, as a fixture whose run now fails.

**Running it on the owner's Mac:**
- Through the engine with an explicit list (`runGate({ suites: [...].map((file) => ({ file })), label })`, then `npm run gate:status -- --label <label>`), with the dead endpoints above.
- The list is the guard, `gate-result-record` and the six suites.
- **Never** run `npm test` there, and never `stack-free-npm-test`.
- AC5's last check, that the whole registry passes with the engine's check, is the pull request's stack-free CI run. The Reviewer reads it.

## Out of scope

- The other state suites share in one process: the working directory, the require cache, globals and patched modules.
- Running each suite in its own process, lazy loading, and the registry's order.
- Per-suite timeouts (`honest-test-gate` story 3).
- Which suites CI runs, and where `stack-free-npm-test`'s G2 runs.
- Auditing `node_modules`. A package that writes at load would show in CI as a failure of the first suite that requires it, fixed in that suite under AC5.

## Amendment 1 (2026-11-21, at Test Design; for the owner's approval with the test plan)

Writing the tests corrected one fact that the Context and Implementation notes §2 relied on. The decision and every story criterion stand.

1. **`strfry-router-saved-state` P3 doesn't leak.**
   - The suite's `run()` sets `BRAINSTORM_ROUTER_PLUGINS_DIR` to its own plugins directory before any test runs (`test/strfry-router-saved-state.test.js:349–350`), and puts it back correctly in a `finally` (`:364–367`).
   - So P3's restore by assignment (`:172–178`) always meets a value, and never leaves the string `"undefined"`. The Context's audit read that restore line on its own, without the `run()` around it.
   - Test S2 runs the suite in a child with the key unset and with it preset. It shows that the suite leaves the environment as it found it, today, in both cases.
2. **What changes.**
   - Five suites leave a change behind, not six. Read "the six suites" in the Context and Implementation notes §1–§2 as these five.
   - Implementation notes §2's P3 item is withdrawn: the Implementer changes the other five suites and leaves `strfry-router-saved-state` alone. P3's pattern stays in place. It would bite only if P3 ran outside the suite's `run()`, so it is no leak today, and no test drives a change to it.
   - S2 stays, as a regression guard: it passes today and must keep passing.

## Amendment 2 (2026-11-21, at Review round 1; for the owner's approval with the fix)

Review round 1 found that the Context's audit didn't reach every suite the gate's process runs. The decision and every story criterion stand.

1. **The audit's reach.**
   - It searched `test/*.test.js`, `test/helpers/` and the product code. It never searched `test/operations/`.
   - `test/operations.test.js` loads every suite under `test/operations/` and runs it inside its own run (`:1158–1183`). So those suites run in the gate's own process, and whatever they leave in `process.env` is left by `operations.test.js`.
2. **Two of them leave a key behind.**
   - `test/operations/graph/create-concept.test.js` CC3 (`:237`) and `test/operations/graph/update-concept.test.js` UC2 (`:174`) each set `TA_PUBKEY` to the suites' test TA (`'dd'.repeat(32)`, `test/helpers/graphOpsSuite.js:30`), and nothing puts it back.
   - `getOwnerAssistantPubkey()` reads `TA_PUBKEY` first (`src/utils/assistantKeys.js:52–56`). So today the 14 suites after `operations.test.js` run with that test TA as the instance's.
   - Run through this ADR's engine, `operations.test.js` fails the check: `left process.env changed after its run (1 key): added TA_PUBKEY` (run `20261121T053127Z-4424-ae68`).
   - Every other write under `test/operations/` is put back (`lifecycle/backup-job.test.js`), or runs in a child (`graph/memberships-shared.test.js:503`, `lifecycle/status.test.js:107`, `:174`).
3. **What changes.**
   - Implementation notes §2 gains both suites. Each notes `TA_PUBKEY` before its test sets it, and puts it back in a `finally`, deleting it when it was unset.
   - The guard gains S7 and S8 for them, written first, as S1–S6 were. Each runs its suite in a child, with `TA_PUBKEY` unset and preset to a key other than the suites' `TA`.
   - So seven suites are brought into line: the five Amendment 1 left, and these two.
