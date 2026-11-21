# Story 4: A suite that leaves `process.env` changed fails the gate, and the change reaches no other suite

**Status:** Approved
**Created:** 2026-11-20
**Type:** Feature

## Background

The gate runs every registered suite in one process, and loads all of them before it runs any (ADR `honest-test-gate/0001`, Decision, "Load order"). So every suite shares one `process.env`.
- A suite that changes it in its run changes it for every suite that runs after it.
- A suite that changes it when it loads changes it for every suite in the run, including those registered before it.

**What happened.** Story `graph-operations-first-slice` #46 added a suite that set dead endpoints on `process.env` when it loaded:
- five addresses at port 9;
- `TAPESTRY_CONTAINER=no-such-container`;
- a temporary `BRAINSTORM_CONF_PATH`.

Its review (round 1, blocking 1) showed a suite listed first reading port 9 and `no-such-container` when it ran. Commit `31e3c327` fixed that suite. Nothing stops the next one.

**What a leak breaks, and why nothing showed this one** (ledger row `2026-11-20-suite-env-changes-reach-every-suite`):
- **Where a control panel answers,** two things get the leaked values: a live check that reads its endpoint when it runs, and a child process started after the suites load. `stack-free-npm-test`'s G2 fails.
- **A scratch live check** (`TAPESTRY_CONTAINER=tapestry-scratch npm test`) would point some of its checks at `no-such-container` and still exit 0.
- **CI shows none of this.** CI runs with no stack, so every endpoint is dead there anyway and nothing differs. G2 is the one check that would show a leak, and it runs only where a panel answers.

**Why the gate allows it.** The gate isolates each suite's throws and exits, but not its environment (review 46, harness friction 1). ADR `honest-test-gate/0001` chose to load every suite first, reasoning that "no suite mutates `process.env` or globals at load". Nothing enforces that.

**A change left after a run reaches later suites the same way.** On 2026-11-20 a text search found 28 suite files that write to `process.env` inside a function. Most put the value back. At least these don't:
- `search-api-result-type-settings` leaves `TAPESTRY_SETTINGS_PATH` set on purpose (`test/search-api-result-type-settings.test.js:54–61`), reasoning that later suites don't read it. ADR `honest-test-gate/0001` left this to the assertion sweep (`test-suite-hermeticity` #2).
- `strfry-router-saved-state` P3 restores `BRAINSTORM_ROUTER_PLUGINS_DIR` by assignment (`test/strfry-router-saved-state.test.js:173–178`). When the key was unset, that leaves it holding the string `"undefined"`. *Corrected at Test Design, 2026-11-21: this one doesn't leak. The suite's `run()` sets the key before any test runs and puts it back correctly, so P3 never meets an unset key (ADR `test-suite-hermeticity/0002`, Amendment 1).*
- Four suites put a key back by deleting it: `tl-certainty-method`, `tl-membership-method-selector` and `tl-weighted-sum-method` (`TAPESTRY_SETTINGS_PATH`), and `trusted-list-pin-publish-blockers` (`SCHEDULED_TASKS_CONFIG_PATH`). That is a change whenever the key was already set before the suite ran, whether by the gate's starting environment or by an earlier suite's leak.

**Who it hurts.** Everyone who reads a gate verdict, most of all anyone who runs the gate where a stack answers. There a leak can do either of two things:
- turn live checks into skips while the run still says PASS;
- fail a check that has nothing wrong with it.

## User-facing description

As anyone who reads the test gate's verdict, I want the gate to fail any suite that leaves `process.env` different from how it found it, naming the keys it changed. Then no suite can quietly change what the others check, and the next leak is caught in the pull request that adds it, by CI with no stack.

## Acceptance criteria

- [ ] **AC1 — A change at load fails that suite.**
  - **Given** a registered suite that adds, changes or removes a `process.env` key when it loads,
  - **when** the gate runs with no stack, as CI runs it,
  - **then** that suite's result is FAIL, its reason names each key it changed, and the run's verdict is FAIL with a non-zero exit.
  - A suite that leaves `process.env` alone keeps the result it would have had.
- [ ] **AC2 — A change left after the run fails that suite.**
  - **Given** a registered suite whose run ends with a key added, changed or removed since the run began, whether the run passed, failed or threw,
  - **when** the gate runs,
  - **then** that suite's result is FAIL, naming each key.
  - A suite that changes `process.env` during its run and puts it back before the run ends keeps the result it would have had.
- [ ] **AC3 — Names, never values.** The suite's reason, the gate's printed lines and the run record name the changed keys and nothing else. No environment variable's value appears in them: a value can be a secret, and CI's log for this public repository is public.
- [ ] **AC4 — The change goes no further.**
  - **Given** a run with a suite that changes `process.env` when it loads or in its run,
  - **then** every other suite, registered before it or after it, starts its load and its run from the environment the gate began with,
  - so the leak changes no other suite's result.
- [ ] **AC5 — Today's suites pass, with no way round.**
  - With this in place, the gate passes when run with no stack, as CI runs it.
  - Every registered suite that would trip the check is brought into line in this story, including the five in Background that leave a change behind. (The four that put a key back by deleting it trip the check only when the gate begins with that key set. `strfry-router-saved-state`, also listed there, turned out not to leak; see the correction there.)
  - No suite can mark a change as allowed.

## Concepts touched

None in the concept graph: this is test infrastructure. No concept definitions change, so no firmware reinstall.

## Out of scope

- **Other state that suites share in one process:** the working directory, the require cache, globals and patched modules. Only `process.env` is checked here.
- **Running each suite in its own process.**
- **Which suites CI runs, and where G2 runs.** G2 still runs only where a panel answers.
- **Loading suites lazily, or reordering the registry.**
- **The environment the gate sets up before its first suite,** such as the two relay keys for the config smoke check. Every suite starts from that environment; it is not a suite's change.
- **A leak that only a run with a stack reaches.** It fails the run that finds it, and is fixed when found.
- **A child process's own environment.** A child can't change its parent's, so nothing it does reaches the gate.

## Open questions

None open. The owner answered three at planning, on 2026-11-20:

1. **Load and run.** The check covers changes a suite leaves after its run (AC2, and AC5's suites), not only changes at load, which is all the ledger row's title names.
2. **Every key.** It covers every key in `process.env`, not only the endpoint variables review 46 named.
3. **Give it back.** After a leak, the gate gives every other suite the environment it began with (AC4). Naming and failing the leaking suite is not enough on its own.

## Linked artifacts

- ADR: `engineering-team/decisions/test-suite-hermeticity/0002-gate-checks-process-env-around-every-suite.md`
- Test plan: `engineering-team/stories/test-suite-hermeticity/4-suite-env-changes-fail-the-gate.test-plan.md`
- Review: (filled in after Review phase)
- Ledger: `ledger/2026-11-20-suite-env-changes-reach-every-suite.md` (this story closes it)
- Where it was found: `engineering-team/reviews/graph-operations-first-slice/46-word-elements-fit-the-installed-word-schema.md` (round 1, blocking 1 and harness friction 1)
