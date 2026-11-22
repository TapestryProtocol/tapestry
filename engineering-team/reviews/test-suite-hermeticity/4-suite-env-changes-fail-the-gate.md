# Review: Story 4 — A suite that leaves `process.env` changed fails the gate, and the change reaches no other suite

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-21
**Diff:** `git diff origin/staging...HEAD`. The merge-base is `b262a8c1`, staging after PR #177. HEAD is `6891b3cd`: the branch's five commits (`0472df55` to `c5fbfb75`), then a merge of `origin/staging`, which brought story `graph-operations-first-slice` #47.

## Quality gates (run by reviewer, not trusted)

The owner's Mac never runs the full `npm test`, because its `tapestry` container is the live agent-memory instance. So every gate here went through the engine with an explicit list:
- `runGate({ suites: [...].map((file) => ({ file })), label })`, then `npm run gate:status -- --label <label>`;
- every endpoint dead: closed ports, `TAPESTRY_CONTAINER=no-such-container`, a conf whose `NEO4J_URI` is `bolt://127.0.0.1:9`, and fake `curl` (exit 7) and `docker` (exit 1) first on `PATH`.

- [x] **The scoped gate on the merged tree:** `20261121T053637Z-20330-cfbd [ste4-r1] … on 6891b3cd — PASS, exit 0, 135 passed, 0 failed, 13 skipped, 9/9 suites`. It covered:
  - the guard, 16 of 16;
  - `gate-result-record`, 34 of 34;
  - the six suites the story names;
  - `firmware-nodes-hold-their-concepts-keys`, the suite #47 registered.

  All of them ran through the changed engine, so each passed the new check too.
- [ ] **`operations.test.js` through the changed engine:** `20261121T053127Z-4424-ae68 [ste4-ops] … on 6891b3cd — FAIL, exit 1, 1327 passed, 1 failed, 10 skipped, 1/1 suites; failed: operations`. Its one failure is the new check: `left process.env changed after its run (1 key): added TA_PUBKEY`. See Blocking 1.
- [x] **`bash scripts/harness-lint.sh`** at `6891b3cd`: clean (0 violations).
- [ ] **The whole registry** is not run here. It runs in CI's stack-free job on the pull request, which isn't open yet. With Blocking 1 that run would fail.
- [x] **`stack-free-npm-test`** is not run here, because its G2 runs live suites against any control panel that answers. CI runs it.
- [x] _Playwright: not applicable._
- [x] _Lint, typecheck and build: not configured, skipped._

## Spec adherence

- [x] **AC1, a change at load:**
  - E1: a key added, changed or removed at load is that suite's FAIL, the key named, `{ pass: 0, fail: 1 }`, and its `run()` never ran. The clean fixture beside it passes.
  - E2: a load that also threw keeps its load error first.
  - E3: a timer left at load fails the run as a stray change.
- [x] **AC2, a change left after the run:**
  - E4: each kind is one more failed check.
  - E5: a failing run and a throwing run keep their own failure.
  - E6: a change put back before the run ends keeps the suite's result.
  - E7: a zero-delay deferral counts against the suite that left it, not the next.
- [x] **AC3, names never values:**
  - E8 shows the keys named in the output and the record, and none of the seven values anywhere.
  - It held on real code too: the operations run's message names `TA_PUBKEY` and no value.
- [x] **AC4, the change goes no further:** E9 and E10. The probes before and after a leaking suite see the starting environment at load, at run, and in a child they start.
- [ ] **AC5, today's suites pass: not met.**
  - Five of its six suites put their keys back (S1, S3–S6), and S2 holds the sixth (ADR Amendment 1).
  - But one registered suite, `operations.test.js`, trips the check through two suites it runs in its own process. See Blocking 1.
- [x] No criterion is silently dropped. No behaviour beyond the story was added.

## ADR adherence

- [x] **The engine follows ADR 0002's rules 1–7** (`test/helpers/gateRunner.js`):
  - the four helpers at `:100–130`;
  - the starting copy at `:203`;
  - the check after each load, and the put-back, at `:213–217`;
  - the stray after the loads at `:222–225`;
  - the load-time result, not run, at `:237–239`;
  - the check after each run, one macrotask on, at `:251–260`;
  - the record's `envChanged` at `:271`;
  - the stray after the last suite at `:279–283`.

  The messages match the ADR's wording.
- [x] **The five suites follow §2 and Amendment 1,** and `strfry-router-saved-state` is untouched. The docs (§3), the ledger row (§4) and ADR 0001's pointer (§5) are in place.
- [x] **The carve-out holds.** Phase 4's `test/` diff (`git diff 7c08b0ee c5fbfb75 -- test/`) is the engine and the five suites. The guard, `gate-result-record`, `gateFixtures.js`, `registry.js` and `stack-free-npm-test` are untouched since Phase 3's commit.
- [x] **No new dependency.**
- [ ] **The Context's audit reached only part of the gate's process.**
  - It says "in the gate's own process, exactly the story's six leave a change behind".
  - It searched `test/*.test.js`, `test/helpers/` and the product code, but not `test/operations/`.
  - `operations.test.js` loads and runs every suite there in its own process (`test/operations.test.js:1158–1183`).
  - This is part of Blocking 1.

## Concept-graph integrity

- [x] No concept is touched and no handle changes, so no firmware reinstall is needed.

## Things tests can't catch

- [x] **No secrets.** The fixtures' values are made up for the test.
- [x] **No leftover debug logging.** The guard's `console.log` lines are its reporter.
- [x] **No commented-out code,** and `git diff --check` is clean.
- [x] **Error paths:** the env check runs after a throw (E5) and after a failed load (E2).
- [x] **Concurrency:** one process, suites in turn. Deferred work is caught by the one-macrotask waits (E3, E7). A longer deferral is named in ADR Consequences.
- [x] **Security:** the check writes names only (AC3).

## House rules check

- [x] No new lint, typecheck or build tooling.
- [x] Concept Graph API authority: not engaged.

## Findings

### Blocking

1. **`test/operations/graph/create-concept.test.js:237` and `test/operations/graph/update-concept.test.js:174`: two operation suites leave `TA_PUBKEY` set, so `operations.test.js` fails the new check and AC5 isn't met.**
   - **What they do.** CC3 and UC2 each set `process.env.TA_PUBKEY = TA`, the suites' test TA pubkey, before requiring `_fields.js`, and nothing puts it back.
   - **Why it's the gate's process.** `operations.test.js` requires every suite under `test/operations/` and awaits its `run()` inside its own (`test/operations.test.js:1158–1183`). So the key is still set when `operations.test.js`'s run ends.
   - **What it does today, without this diff.** `TA_PUBKEY` is the first place `getOwnerAssistantPubkey()` looks (`src/utils/assistantKeys.js:52–56`). So every suite after `operations.test.js` runs with the test TA as the instance's TA: 14 suites, from `test/registry.js:393` on. None of them reads it at run time today, by a text search, so nothing fails yet.
   - **What it does with this diff.** CI's stack-free run fails at `operations`, as run `20261121T053127Z-4424-ae68` shows.
   - **Why the audit and the S tests missed it.** The audit's reach is the ADR finding above, and the S tests cover only the six suites the audit found.
   - **Asked changes, tests first:**
     - *Test Design:* add S tests for both operation suites to `test/suite-env-changes.test.js`, as S1–S6 do. Each runs in a child with `TA_PUBKEY` unset, and with it preset to a value other than the suites' `TA`. Add both to the test plan's coverage map and red table.
     - *Implementation:* in CC3 and UC2, note `TA_PUBKEY` before setting it and put it back in a `finally`, deleting it when it was unset. Then `operations.test.js` must pass the check, in a scoped run of it alone.
     - *Records:* an ADR Amendment 2, at Review, records the audit's reach and adds the two suites to §2. The story's Background and AC5, and the ledger row's Done text, then name seven suites brought into line, not five.

### Non-blocking

1. **The test plan's "How to run" names `safe-run.sh` and `gate.js`, which live in this session's scratchpad.** The plan describes what they do, but the files won't outlast the session.
   - Optional: copy both into the main checkout's `tmp/`, where the gate records are kept (gitignored), and name that path.

### Harness friction

1. None. The static audit's miss was the audit's. The engine's check found what the audit didn't, which is what it is for.

## Verdict

**CHANGES_REQUESTED.** Blocking 1: AC5 isn't met, because `operations.test.js` leaves `TA_PUBKEY` set, and the pull request's stack-free run would fail there. Everything else holds: AC1–AC4, the ADR's rules, the carve-out and the records.

## Round 2 — 2026-11-21 (HEAD `f4ed296a`)

Round 1's findings were fixed in three commits after its review (`fbc65dc6`), tests first:
- `0b5c1823`: ADR Amendment 2, and the story's Background and AC5 brought up to seven suites;
- `2fe0b7bb`: tests S7 and S8, and the test plan's coverage map, red table, red run and script paths;
- `4a2c2065`: the two operation suites put `TA_PUBKEY` back; the ledger row's Done text and the story's Deviations name them.

Then staging moved, and two more commits followed:
- `6bef5deb` merges `origin/staging`, which had landed `container-apt-refresh` #1, export nostr and seed-firmware.
  - `engineering-team/CHANGELOG.md` conflicted: both sides had appended a row dated 2026-11-21. Both are kept, staging's first.
  - `test/registry.js` merged on its own.
- `f4ed296a`: Amendment 2's two `status.test.js` lines, which staging's change moved.

I checked each changed statement against the sources, as a new claim (role rule 10). That includes the asked changes, which were my own wording in round 1.

### Gates (run by the reviewer on clean trees; the whole registry by this PR's CI)

- [x] **The scoped gate,** through the engine with every endpoint dead: `20261121T055218Z-93327-bdc9 [ste4-r2] … on 4a2c2065 — PASS, exit 0, 1587 passed, 0 failed, 23 skipped, 13/13 suites`. It ran:
  - the guard, 18 of 18;
  - `gate-result-record`, 34 of 34;
  - the six suites the story names;
  - `firmware-nodes-hold-their-concepts-keys`;
  - `operations`, 1327 passed and 0 failed, now through the check;
  - `harness-lint`, `ledger-row-ids` and `session-start`, which read the changed ledger row, story and ADR.
- [x] **The red phase of the new tests:** `20261121T054500Z-59296-9e07 [ste4-r1-red] … on 0b5c1823+dirty — FAIL, … 16 passed, 2 failed`. S7 and S8 failed there, each with `added TA_PUBKEY` (unset) and `changed TA_PUBKEY` (preset). Every other test passed.
- [x] **The scoped gate after the merge,** at `6bef5deb`, with every endpoint dead: `20261121T183631Z-35365-9494 [ste4-merge2] … on 6bef5deb — PASS, exit 0, 1843 passed, 0 failed, 37 skipped, 16/16 suites`.
  - It ran the 13 suites above, plus three registered suites the merge brought in or touched: `container-apt-refresh` (new; 23 passed, its live checks off), `publish-export-a-concept` (changed) and `external-cli` (its helper `test/helpers/externalCliServer.js` changed).
  - `operations` ran 1504 tests, staging's new export and seed-firmware suites among them: 0 failed, 20 skipped (the scratch-stack live checks).
  - No suite's `envChanged` is set in the run's record, and the record has no strays.
- [x] **`bash scripts/harness-lint.sh`** at `4a2c2065`, `6bef5deb` and `f4ed296a`: clean (0 violations).
- [x] **The whole registry:** this PR's stack-free run on `f4ed296a`, [44937221100](https://github.com/TapestryProtocol/tapestry/actions/runs/44937221100): `Overall: PASS — 8577 passed, 0 failed, 669 skipped across 351 suites`.
  - No line of its log reports a `process.env` change or a stray error. `suite-env-changes` passed 18 of 18, and `operations` 1504 with 0 failed.
  - The run before the merge, 44873425891 on `4a2c2065`, passed too: `Overall: PASS — 8377 passed, 0 failed, 655 skipped across 350 suites`.

### Round-1 findings, re-checked

1. **Blocking 1 — fixed.**
   - **The two suites put the key back.** `test/operations/graph/create-concept.test.js` CC3 and `test/operations/graph/update-concept.test.js` UC2 each note `TA_PUBKEY`, set the suites' TA, and put it back in a `finally`, deleting it when it was unset (`git diff 2fe0b7bb 4a2c2065 -- test/operations/`). Their assertions are unchanged; they moved inside the `try` and nothing else.
   - **`operations.test.js` now passes the check:** 1327 passed and 0 failed in `ste4-r2`, and 1504 passed and 0 failed after the merge, in `ste4-merge2` and in CI's run 44937221100, each with no env failure.
   - **S7 and S8 pin it.** Both fail on the code before the fix (`ste4-r1-red`) and pass after it (`ste4-r2`).
   - **Their preset** is `'ee'.repeat(32)`, a key other than the suites' TA, `'dd'.repeat(32)` (`test/helpers/graphOpsSuite.js:30`). So "changed" can show.
   - **Amendment 2's claims hold.**
     - `operations.test.js:1158–1183` requires each suite and awaits its `run()` in its own process.
     - `getOwnerAssistantPubkey()` reads `TA_PUBKEY` first (`src/utils/assistantKeys.js:52–56`).
     - The other writes under `test/operations/` are put back in a `finally` (`lifecycle/backup-job.test.js:172–175`, `:370–375`), or are code strings run in a child (`graph/memberships-shared.test.js:503`, `lifecycle/status.test.js:107`, `:174`; staging's merge at `6bef5deb` moved those two lines, and `f4ed296a` updates the amendment to match).
   - **The story's count adds up.** AC5 now names seven suites: Background's five that leave a change behind (`search-api-result-type-settings` and the four that delete a key), plus the two operation suites. `strfry-router-saved-state`, also listed there, is marked as not leaking.
   - **The ledger row's Done text** names the two, with S7 and S8.
   - **AC5 is met.** The whole registry passes with the check in place (run 44937221100, above), staging's new suites included. So no registered suite leaves `process.env` changed. No suite can mark a change as allowed: the engine checks after every load and every run, with no opt-out (`test/helpers/gateRunner.js:213–281`).
2. **Non-blocking 1 — fixed.** Portable copies of `safe-run.sh` and `gate.js` are in the main checkout's `tmp/ste4/`.
   - They write their own fake `curl` and `docker` and a dead conf beside themselves, and run from any checkout.
   - The test plan's How to run names them (`:104`).
   - I ran both: the `ste4-r2` and `ste4-merge2` gates above, and an earlier one-suite check (`20261121T054528Z-60016-2ad3`, PASS).

### Findings

- **Blocking:** none.
- **Non-blocking:** none.

### Outside this story

- **The stack-free job is near its time limit.** Run 44937221100's job took 21 m 16 s, against `timeout-minutes: 25` in `.github/workflows/test.yml`. The run on `4a2c2065` took 16 m 48 s.
  - Nearly all of the growth is `operations`: 582 s before the merge, 801 s after it, from the export and seed-firmware suites staging added. This story's own suite took 21 s and 25 s.
  - Ledger row `2026-11-20-ci-gate-outgrows-its-timeout` raised the limit from 15 minutes to 25 the day before. This is not a finding against this diff.

### Harness friction

1. None.

### On PASS (same commit)

- [x] The story's `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed: the result goes to the chat, not this file.

### Verdict

**PASS.** Round 1's blocking finding is fixed, tests first, and AC1–AC5 hold: the whole registry passes on CI with the check in place, staging's new suites included. The ADR's rules, the carve-out and the records hold, with Amendment 2's two citations brought up to date after the merge.
