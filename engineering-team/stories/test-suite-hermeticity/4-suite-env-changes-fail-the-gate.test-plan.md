# Test Plan: Story 4 — A suite that leaves `process.env` changed fails the gate, and the change reaches no other suite

**Story:** `engineering-team/stories/test-suite-hermeticity/4-suite-env-changes-fail-the-gate.md`
**ADR:** `engineering-team/decisions/test-suite-hermeticity/0002-gate-checks-process-env-around-every-suite.md` (with Amendment 1, from this phase)
**Date:** 2026-11-21

## Coverage map

Every test is in the new guard suite, `test/suite-env-changes.test.js`, except C6. E tests drive the engine in a child process over fixture suites. S tests run one real suite in a child of its own.

| Criterion | Test | Where | Level |
|---|---|---|---|
| AC1 | `E1: a suite that adds, changes or removes a process.env key when it loads is that suite's FAIL, naming the key, and is never run; a suite beside it that changes nothing passes, and the run ends FAIL with exit 1` | `test/suite-env-changes.test.js` | engine, in a child |
| AC1 | `E2: a load that changes a key and then throws is that suite's FAIL carrying both — its load error first, then the key` | same | engine, in a child |
| AC1, AC4 | `E3: a key set by a timer a suite left while loading fails the run as a stray change, naming the key, and the suites that run after it see the environment the gate began with` | same | engine, in a child |
| AC2 | `E4: a suite whose run leaves a key added, changed or removed is that suite's FAIL, naming the key, with its own counts plus one failed check; a suite beside it that changes nothing passes` | same | engine, in a child |
| AC2 | `E5: a run that fails, or throws, and leaves a key changed is that suite's FAIL carrying both its own failure and the key` | same | engine, in a child |
| AC2 | `E6: a suite that changes keys during its run and puts them back before the run ends keeps its result, and the run passes` | same | engine, in a child |
| AC2, AC4 | `E7: a key a suite sets on a zero-delay timer after its run resolves counts against that suite, not the one after it` | same | engine, in a child |
| AC3 | `E8: a run full of env changes names every changed key, and no value — written by a suite, or the one the gate began with — appears in its output or its record` | same | engine, in a child |
| AC4 | `E9: a suite that changes keys when it loads changes nothing for the suites before and after it — at their load, at their run, or in a child they start` | same | engine, in a child |
| AC4 | `E10: a suite that leaves keys changed after its run changes nothing for the suites around it — at their load, at their run, or in a child they start` | same | engine, in a child |
| AC5 | `S1`–`S6`: each of the six suites the story names, loaded and run in a child with its key unset and then preset, leaves `process.env` as it found it | same | suite, in a child |
| AC5 | `S7`, `S8`: the graph create-concept and update-concept operation suites, which `operations.test.js` runs in its own process, each leave `TA_PUBKEY` as they found it, unset or preset to another key (added at review round 1, ADR Amendment 2) | same | suite, in a child |
| AC5 | **The whole registry passes the check,** in CI's stack-free run of the pull request | `.github/workflows/test.yml` (`stack-free`) | CI |
| (re-aim) | `C6: every suite is loaded before any runs, so a later suite's load-time read cannot see an earlier suite's run-time write`, now through a file | `test/gate-result-record.test.js` | engine, in a child |

**How the E tests work.**
- Each writes fixture suites from `test/helpers/gateFixtures.js` into a temp dir. It runs the engine over them in a child (`F.runEngineSync`), with records in a temp `GATE_RECORD_DIR`, and judges three things: the child's exit, its output lines and the record.
- **The starting environment.** The child's starting environment always holds `GATE_ENV_FIXTURE_PRESET`, at a value the guard sets, and never `GATE_ENV_FIXTURE_ADDED`. A fixture adds the first key, changes the second, or removes it.
- **A changed suite's entry** must be FAIL, with the key in its error and on its printed result line. Its record entry must have `envChanged: { phase, added | changed | removed }` listing the key, as ADR 0002's Decision ("The record") defines it.
- **An untouched suite's entry** must keep its own counts and have `envChanged: null`.
- **The env fixtures whose run would run leave a marker file.** That shows a load-time leaker was never run, paired with a clean fixture's marker, which shows the run reached its suites.
- **The probes,** `env-probe-first` and `env-probe-last`, write down what the two keys held at three points: at load, at run, and in a child started at run. AC4 checks those three readings.

**How the S tests work.**
- Each starts a child that requires the suite and calls its `run()` directly, not through the engine. The child compares its own `process.env` before the load, after it, and after the run plus one macrotask. It reports key names only.
- Each suite runs once with its key unset, and once with it preset to a path in a temp directory.
- Because these checks don't use the engine, they judge the suites alone. They fail before the engine changes, and pass only once each suite puts back what it changes.
- The child must also report numeric counts from `run()`, so that a suite that crashed can't pass by never reaching its restore.

**What failing looks like today (the red phase):**

| Suite | Unset | Preset |
|---|---|---|
| `search-api-result-type-settings` | adds `TAPESTRY_SETTINGS_PATH` | changes it |
| `tl-certainty-method`, `tl-membership-method-selector`, `tl-weighted-sum-method` | no change | removes `TAPESTRY_SETTINGS_PATH` |
| `trusted-list-pin-publish-blockers` | no change | removes `SCHEDULED_TASKS_CONFIG_PATH` |
| `strfry-router-saved-state` | no change | no change |
| `operations/graph/create-concept`, `operations/graph/update-concept` (added at review round 1) | adds `TA_PUBKEY` | changes it |

`strfry-router-saved-state` turned out not to leak (ADR Amendment 1):
- Its `run()` sets `BRAINSTORM_ROUTER_PLUGINS_DIR` before any test runs (`:349–350`) and puts it back in a `finally` (`:364–367`).
- So P3's restore by assignment always meets a value.
- S2 is a regression guard. It passes today and must keep passing, so the Implementer leaves that suite alone.

**C6's re-aim.**
- C6 proved "every suite loads before any runs" with `env-writer`, which leaves a key set in its run, and `env-reader`, which read that key at load. The C6 assertions were the reader passing and the run exiting 0.
- Under the ADR, env-writer fails, and the engine gives every suite back the starting environment. So process.env can't carry the signal, and the run can't exit 0.
- C6 now uses `marker-writer`, whose run leaves a file beside both fixtures, and `marker-reader`, which notes at load whether that file was there. It passes today and after, as a load-order guard should.
- `env-writer` stays, as E4's "adds a key in its run" fixture. `env-reader` is gone.

## Edge cases

- [x] **A key added, changed and removed:** each kind, at load (E1) and after a run (E4), named under its own kind in `envChanged`.
- [x] **A load that also throws** (E2), **a run that fails** and **a run that throws** (E5): the suite keeps its own error or count, and gains the env change.
- [x] **A change put back before `run()` ends** (E6): no failure. The fixture waits on a timer in the middle, so the check can't be one that only looks before the run.
- [x] **Deferred changes.** A zero-delay timer left at load (E3) is a stray that fails the run. One left by a run (E7) counts against that suite, not the next. Each fixture is followed by `brief`, which waits 400 ms: without the engine's per-suite wait, the timer would fire inside `brief`'s run and blame it.
- [x] **A child process started after a leak** (E9, E10): the probes' children see the starting environment.
- [x] **The record and output never hold a value** (E8). This is paired with the keys being named, so an engine that reports nothing can't pass it.
- [x] **A suite whose key was set before it ran:** the S tests' preset runs, and the E tests' `GATE_ENV_FIXTURE_PRESET`.
- [x] **Load order still eager** (C6, re-aimed).
- [ ] **A change deferred longer than one macrotask.** Not tested: the ADR says it lands on whichever suite is running (Consequences).
- [ ] **A package that writes at load.** Not tested here. The audit didn't cover `node_modules`, so CI's stack-free run of the whole registry is the check (AC5's last row).

## Test infrastructure

- **Framework:** none new. The guard is hand-rolled in the project's style, like `gate-result-record`. Node runs it directly, or the gate engine calls its `run()`. It is registered in `test/registry.js` after `gate-result-record.test.js`.
- **Fixtures:** `test/helpers/gateFixtures.js`, Phase-3 owned:
  - the env fixtures, `env-*.test.js`;
  - the C6 pair, `marker-writer` and `marker-reader`;
  - `ENV_FIXTURE`, the keys and every value the fixtures write.
- **Nothing reaches a real service.** Every child gets:
  - closed ports (`BRAINSTORM_BASE_URL`, `CONCEPT_GRAPH_URL`, `TAPESTRY_API_BASE`, `TAPESTRY_PORT`, `MEILI_URL_HOST`, `REDIS_*`, `NEO4J_URI`);
  - `TAPESTRY_CONTAINER=no-such-container`;
  - a conf whose `NEO4J_URI` is `bolt://127.0.0.1:9`;
  - fake `curl` (exit 7) and `docker` (exit 1) first on `PATH`.

  `TAPESTRY_CONTAINER_PORT` is unset. One of the six suites, `tl-weighted-sum-method`, writes the container's `settings.json` in its live layer.
- **The guard sets nothing in `process.env`.** The new check would judge it too.
- **No stack, and no firmware state.** No concepts are touched.
- **On the owner's Mac:**
  - Never the full `npm test`. The `tapestry` container there is the live agent-memory instance.
  - Never `test/stack-free-npm-test.test.js`, whose G2 runs live suites against any panel that answers.
  - Scoped gates go through the engine with an explicit list, with every endpoint dead as above.

## How to run

The guard, alone:
```
node test/suite-env-changes.test.js
```

The scoped gate this phase ran, through the engine, with every endpoint dead. `safe-run.sh` exports the dead endpoints listed above and puts fake `curl` and `docker` first on `PATH`. Portable copies of it and `gate.js` are kept in the main checkout's `tmp/ste4/` (gitignored), with the gate records, and run from any checkout as `<main checkout>/tmp/ste4/safe-run.sh "$PWD" <main checkout>/tmp/ste4/gate.js <label> <suites…>`:
```
safe-run.sh gate.js ste4-red suite-env-changes.test.js gate-result-record.test.js search-api-result-type-settings.test.js strfry-router-saved-state.test.js tl-certainty-method.test.js tl-membership-method-selector.test.js tl-weighted-sum-method.test.js trusted-list-pin-publish-blockers.test.js
npm run gate:status -- --label ste4-red
```

The whole registry, with the check in place, runs in CI's stack-free job on the pull request.

## Verification

The new tests fail with the current code: today's engine, `test/helpers/gateRunner.js`, and today's six suites. Confirmed on 2026-11-21 on `915fab4c` with this phase's files (the run was on `915fab4c+dirty`, before they were committed), every endpoint dead, through the engine with the explicit list in How to run:

```
20261121T050623Z-5553-b2c3 [ste4-red] started 2026-11-21T05:06:23.972Z on 915fab4c+dirty — FAIL, exit 1, 109 passed, 15 failed, 13 skipped, 8/8 suites; failed: suite-env-changes
  [1/8] suite-env-changes: FAIL (1 passed, 15 failed, 0 skipped) 3205ms
  [2/8] gate-result-record: PASS (34 passed, 0 failed, 0 skipped) 16582ms
  [3/8] search-api-result-type-settings: PASS (14 passed, 0 failed, 2 skipped) 27ms
  [4/8] strfry-router-saved-state: PASS (32 passed, 0 failed, 0 skipped) 5ms
  [5/8] tl-certainty-method: PASS (4 passed, 0 failed, 3 skipped) 21ms
  [6/8] tl-membership-method-selector: PASS (9 passed, 0 failed, 3 skipped) 10ms
  [7/8] tl-weighted-sum-method: PASS (5 passed, 0 failed, 4 skipped) 21ms
  [8/8] trusted-list-pin-publish-blockers: PASS (10 passed, 0 failed, 1 skipped) 2ms
```

Each failure is the feature missing, never an import error or a typo:
- **E1, E4, E7:** the leaking fixture is recorded PASS, where ADR 0002's rules 4 and 6 make it FAIL.
- **E2, E5:** the entry's error carries the suite's own failure, and no key.
- **E3, E9, E10:** a probe saw another suite's change when it ran, so the leak reached it.
- **E6:** the entry keeps its result, but carries no `envChanged`. The engine records nothing about the environment.
- **E8:** no changed key is named, in the output or in the record.
- **S1:** `search-api-result-type-settings` adds `TAPESTRY_SETTINGS_PATH` when it was unset, and changes it when it was set.
- **S3–S5:** each of the three `tl-*` suites removes a preset `TAPESTRY_SETTINGS_PATH`.
- **S6:** `trusted-list-pin-publish-blockers` removes a preset `SCHEDULED_TASKS_CONFIG_PATH`.
- **S2 passes:** its suite doesn't leak (ADR Amendment 1).
- **C6,** re-aimed, passes on today's engine, as a load-order guard should. So does the rest of `gate-result-record`.

The guard alone takes about 3 s.

### Review round 1's tests (2026-11-21)

Review round 1 found two more suites that leave a key behind (blocking 1; ADR Amendment 2). They aren't registered suites themselves: `operations.test.js` runs them in its own process. S7 and S8 run each alone in a child, as S1–S6 do.
- **The preset** is a key, not a path: `'ee'.repeat(32)`, a pubkey other than the suites' own test TA, `'dd'.repeat(32)`.
- **Before the fix,** both fail on the right line, and the other 16 tests pass:

```
20261121T054500Z-59296-9e07 [ste4-r1-red] started 2026-11-21T05:45:00.733Z on 0b5c1823+dirty — FAIL, exit 1, 16 passed, 2 failed, 0 skipped, 1/1 suites; failed: suite-env-changes
  FAIL  S7 (AC5): the graph create-concept operation suite puts TA_PUBKEY back as it found it, unset or set — so operations.test.js leaves it alone
      - TA_PUBKEY unset: its run left process.env changed: added TA_PUBKEY
      - TA_PUBKEY preset to another value: its run left process.env changed: changed TA_PUBKEY
  FAIL  S8 (AC5): the graph update-concept operation suite puts TA_PUBKEY back as it found it, unset or set — so operations.test.js leaves it alone
      - TA_PUBKEY unset: its run left process.env changed: added TA_PUBKEY
      - TA_PUBKEY preset to another value: its run left process.env changed: changed TA_PUBKEY
```

The two suites take about 2.6 s and 1.5 s alone, so the guard now takes about 11 s.
