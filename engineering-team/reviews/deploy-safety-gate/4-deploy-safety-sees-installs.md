# Review: Story 4 — The deploy-safety answer sees a running firmware install

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-21
**Diff:** `git diff origin/staging...HEAD`: base `94e85fe06` (origin/staging), HEAD `585e22d16`. Four commits: story `ad3ef5aa5`, ADR `50de6d358`, failing tests `a013bcea7`, implementation `585e22d16`. 18 files, +1779 / −9.
**Inputs:**
- story `stories/deploy-safety-gate/4-deploy-safety-sees-installs.md`, with its two dated Architecture amendments, its Deviations and its Evidence;
- ADR `decisions/deploy-safety-gate/0004-deploy-safety-sees-firmware-installs.md`, which extends 0001 and 0002;
- test plan `stories/deploy-safety-gate/4-deploy-safety-sees-installs.test-plan.md`;
- book `audits/deploy-safety-sees-installs/book.md`.

## Quality gates (run by reviewer, not trusted)

**How it was run.** This Mac's local container is the owner's private agent-memory instance, so there was no full `npm test`, and no call to the local container, `:7778`, `:7474`, `:7687` or any instance. During the gate, `lsof` showed no node process connected to those ports.
- **Node and modules:** Node 22.23.1 (CI's major), with the worktree's own `node_modules`, from the lockfile. No package file is in the diff.
- **Environment, every run but one:**
  - a stub `curl` and a stub `docker` first on `PATH`;
  - `BRAINSTORM_CONF_PATH` at a dead conf;
  - `BRAINSTORM_BASE_URL`, `TAPESTRY_PORT`, `TAPESTRY_API_BASE` and `REDIS_PORT` on port 9;
  - `TAPESTRY_CONTAINER` and `TAPESTRY_CONTAINER_PORT` unset;
  - for the gate, also `MEILI_URL_HOST`, `CONCEPT_GRAPH_URL` and `NEO4J_URI` on port 9.

The checks:

- [x] **Scoped gate, 67 suites, on the final HEAD:** `npm run gate:status -- --label ds4-review-1` gives
  `20261122T024343Z-74481-23be [ds4-review-1] started 2026-11-22T02:43:43.457Z on 585e22d1 — FAIL, exit 1, 3325 passed, 3 failed, 123 skipped, 67/67 suites; failed: router-stream-limit-on-connect`
  - **The only failures are `router-stream-limit-on-connect` P1–P3.** There BSD `sed` rejects the router patch's GNU `sed -i`, which is open ledger row `2026-10-09-router-patch-sed-macos`. This diff touches no script, patch or Docker file.
  - **The skips are live layers, with no stack:** the two skipped suites, `profile-tags` and `pin-a-tag`, and the 123 skipped tests.
  - **No suite left `process.env` changed.** The engine fails any suite that does (ADR test-suite-hermeticity/0002), and the record's `envChanged` is empty throughout.
  - **This story's suites:**
    - `deploy-safety-sees-installs`: 37 of 37;
    - `deploy-safety-status`: 17 passed, with 6 live skips;
    - `next-task-countdown` 24, `close-unauth-write-surface` 14, `default-deny-mutations` 14, `admin-action-sweep-access` 13, `firmware-install-leaves-tags-once` 24;
    - `operations`: 1556 passed, 20 skipped. The Evidence's run, from before the rebase, had 1504; the difference is the suites #198 and #199 brought in.
  - **The harness readers:** `suite-env-changes` 18, `harness-lint` 85, `ledger-row-ids` 6, `session-start` 32, `rollup-scanners` 33, `harness-stats` 12, `kill-timeout-orphans-by-default` 9, `note-tagging-raw-events-inspector-ui` 32 and `gate-result-record` 34, all with no failures.
- [x] **The gate's list, derived by me from the final diff.** It is the Implementer's 62, plus five suites that read a file this diff changes and that their token list missed:
  - `suite-env-changes`, which reads `test/registry.js` and polices the `process.env` restore the new suite does;
  - `rollup-scanners` and `harness-stats`, which read the intake, ledger and audits;
  - `kill-timeout-orphans-by-default` and `note-tagging-raw-events-inspector-ui`, which read `stories/_intake.md`.

  **Left out,** each for its stated reason:
  - `event-tagging-firmware-seed`, which calls `localhost:7778` whatever the environment says;
  - `stack-free-npm-test`, whose G2 runs live tests when a control panel answers, so it stays CI's;
  - `safe-to-merge-check`, run on its own, below;
  - the suites under `test/operations/`, which `operations.test.js` runs.

  The other 16 hits of my wider search name a book or the intake only in a comment or an assertion message, and read no changed file.
- [x] **`test/deploy-safety-sees-installs.test.js` on its own:** 37 passed, 0 failed.
- [x] **`test/safe-to-merge-check.test.js` on its own, with the system `curl`:** 17 passed, 0 failed, B10 included. I first checked that every URL in it is an OS-assigned `127.0.0.1` port that the suite opens, or opens and releases, itself.
- [x] **The tests fail without the feature.** I extracted `a013bcea7` with `git archive` into a scratch folder. There the new suite gives 2 passed and 35 failed. The two passes are U6 and S1, the guards the plan names, and every failure names the missing piece, as the test plan's Verification says.
- [x] **Mutation probe.** On a scratch copy of HEAD, never the worktree, I applied 8 mutations one at a time, restoring each. Every one turned a named test red:

  | Mutation | Tests that failed |
  |---|---|
  | `leave()` without a `finally` | I3 |
  | the merged list not sorted | H7 |
  | `stale` ignored | L3, H4, H5 |
  | `installCount` not passed to the verdict | H1–H7, H9 |
  | `enter()` after the first step | I1–I4 |
  | no `enter()` | I1–I4 |
  | the reason after `QUEUE_STATE_UNAVAILABLE` | U2 |
  | the block present only while an install runs | H1, H3–H9 |
- [x] **`bash scripts/harness-lint.sh`:** clean, 0 violations, before this file and after it.
- [ ] `npm run test:playwright`: not applicable, no UI change.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] Every acceptance criterion has a passing test. AC-6's procedure has a doc gap (Blocking 1), and one link in AC-1's seed-firmware chain is verified by reading only (Non-blocking 1).
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story. The intake entry for backup, restore and migrate is the story's Out of scope.

**AC by AC.** I checked each against the code, not against the Evidence.

| AC | Test evidence | Also verified by reading |
|---|---|---|
| AC-1, the answer is unsafe while either install runs | U1–U4 (the reason, its order, NEXT_FIRE kept out, queue off); L1, L2; M1; H1 (today's install, named); H2 (a lock held by a process of its own: named, no run id or host in the payload); I1 (`install()` counts itself, a dry run included); I2 (the route handler); S3 | Every caller reaches the one handler: two registrations of one function (`src/api/firmware/index.js:233`, `src/api/normalize/index.js:5737`), the UI's `installFirmware` (`ui/src/api/firmware.js`), `tools/firmware-on-boot.sh:29`, the scratch scripts. No `await` comes between the handler's start and `install()`'s first line. seed-firmware takes the lock with op `'seed-firmware'` at `seed-firmware.js:143` and frees it in the `finally` at :177. The control panel and a `docker exec` shell share the lock path, since `TAPESTRY_BACKUPS_DIR` is set nowhere in the deployment. |
| AC-2, it lets go however the install ends | U5, M2, M3, H3, H7, I3, I4 | seed-firmware's `busy` takes no lock, and `graph-unavailable` frees it at once (`_common.js:78-85`). |
| AC-3, a cut-off install isn't reported | L3, L4; H4 (a SIGKILLed holder, and the GET leaves the lock file byte for byte); H5 (another host, with a live holder); H9 (a fresh process); S1, S2 | `docker-compose.yml` sets no `hostname:`, so a recreate changes the host. The pid-reuse rule is untested anywhere (Non-blocking 6). |
| AC-4, the check waits for an install | B10 (the real script against the real handler); B9, C7 (45 × 60) | `scripts/` is not in the diff. The script greps the first `safeToDeploy` and `reasons`, and the new block holds neither key. |
| AC-5, nothing else changes | H8; U6 (guard); story 1's suite with the list widened to five codes; `next-task-countdown` R2 | `ui/src/utils/nextTaskCountdown.js` reads only `queue` and `schedule`. |
| AC-6, the procedures say so | D1–D5 | The text exists and reads as the ADR asks, except where it overclaims coverage (Blocking 1, Non-blocking 5). |

## ADR adherence

- [x] **Files changed match the ADR's Implementation notes:**
  - new `src/firmware/inFlight.js`: requires nothing; `enter()` returns a `leave()` that is safe to call twice; `list()` is a sorted copy; its header names its reader;
  - `install()` counts its whole run: the logged wrapper around `runInstall()`, a deviation with the same behavior, since `runInstall` isn't exported;
  - `computeVerdict` takes `installCount`, defaulting to 0, and adds the reason after `LEGACY_TASK_RUNNING`. The `reasons.length === 0` test for the next fire is unchanged;
  - `seedFirmwareFromLock()` is pure;
  - `handleStatus` merges and sorts both sources and always adds the `firmware` block;
  - the module header lists four sources and the never-touches rules;
  - `_store.js` gains a comment only;
  - the recipe, BIBLE §7, and the two ledger rows.
- [x] **Layering respected.** Both new sources are lazy-required inside the handler, as the others are. The GET calls only `inspectLock()`, which reads.
- [x] **No new dependencies or tooling.**
- [x] **The four logged deviations are each within the ADR's intent:**
  - the wrapper;
  - `startedAt: null` for a hand-made lock;
  - BIBLE's short paragraph;
  - the loopback command in `docs/`. harness-lint's wiring set excludes `docs/`, so its port literal is allowed there.

**The ADR's Context, checked against the source.** I checked every file:line citation at `origin/staging`. The cited files are unchanged since the ADR's read commit `deef26702`.
- `src/api/deploy-safety/index.js` :23-24, :47, :50, :53, :69-71, :83, :160-162.
- `src/firmware/install.js` :60-66, :1280, :1518, :1530, :1535, :1544.
- `src/api/firmware/index.js:233` and `src/api/normalize/index.js:5737`.
- `tools/firmware-on-boot.sh:29`, `scripts/scratch-stack.sh:94`, `scripts/brain-drill.sh:109`.
- `seed-firmware.js` :125, :132, :143, :154, :155, :177.
- `_common.js` :73-86, :82.
- `_store.js` :30, :205, :223-230, :232-237, :234, :239-260, :291, :308, :348-362.
- `status.js:174`; `docker-compose.yml:38`; `docker/supervisord.conf:60-62`; `check-safe-to-merge.sh` :23, :79, :80.
- Story 1's suite :52, U12 :278-301, S1 :306, H1 :375-389; `next-task-countdown` R2 :411.

All hold. Three more claims hold:
- **no cluster:** `bin/control-panel.js` has none;
- **the orientation:** the saved read of staging's summaries has 46 concepts, none on deploys, installs, lifecycle jobs or locks;
- **the overlap ledger row:** no container sets `TAPESTRY_API_BASE`, nginx adds `X-Forwarded-For`, and `auth.js:366` treats a forwarded call as remote.

One claim elsewhere in the ADR doesn't hold: its testing note at :232 (Non-blocking 3).

## Concept-graph integrity

- [x] Handles: none created or changed.
- [x] Firmware reinstall: not needed. No concept definition changes.
- [x] Orientation: the ADR used staging's public `/api/concept-graph/summaries`, since the local container is off-limits, and confirmed "Concepts touched: None".

## Things tests can't catch

- [x] No secrets. No 64-hex string, key or password was added, and the TA pubkey is used nowhere.
- [x] No debug logging added under `src/`.
- [x] No commented-out code or TODOs.
- [x] Error paths. `inspectLock()` guards its reads. An unexpected throw takes the existing 500, which the check treats as no usable answer, never as safe.
- [x] Concurrency:
  - overlapping installs are counted apart, by id;
  - the read of `list()` and `inspectLock()` is a snapshot, and its race is harmless;
  - the module-wide internal-mode hazard is recorded in ledger row `2026-11-21-overlapping-installs-share-internal-mode`;
  - no other suite calls `install()` in the gate's shared process, so the count can't leak across suites.
- [x] Security:
  - the GET stays unauthenticated and read-only (H4 reads the lock back byte for byte);
  - the payload adds only an install's name and start time, and H2 checks that no run id or host gets in;
  - only the owner may start today's install (`routeAccess.js:207`), and the owner and admins seed-firmware, so an anonymous caller can't hold the gate unsafe.

## House rules check

- [x] Concept Graph API authority respected (no concept work).
- [x] No new lint, typecheck or build tooling, and no new dependency.
- [x] The TA pubkey is never hardcoded: nothing here filters by author or signs.

## Product-guide adherence *(when the story traces to a PRD)*

Not applicable. The book is an acceptance frame with no PRD, and there is no UI copy.

## Findings

### Blocking

1. **`docs/SAFE_TO_MERGE.md:113-125`: the installer's procedure claims protection where there is none.** The new section is for whoever starts an install "on a deployed instance". It says that once the install starts, "the instance's answer is unsafe until it ends … and nobody needs to hold merges by hand" (:125), with no condition. That is false on any instance whose branch lacks this story, and it fails silently: story 1's answer, which those instances serve, says safe while an install runs. That is the incident this story fixes. It applies today to:
   - **tags.brainstorm.world.** `origin/feat/tags` (`25d39636e`) serves story 1's endpoint without story 4, and the story's Out of scope keeps the sandboxes out of this book. The recipe's own branch map covers `feat/tags` (:43), but the section gives the check for a running deploy only for staging and production (:115-121), and `deploy-tags.yml` isn't named.
   - **Production,** from this story's merge into `staging` until `main` takes it.

   The recipe already has the pattern: its transition note for story 1 (:109), and the same tags caveat for a refreshing deploy (:89-90).

   **Asked change:** add a transition note to "Before a firmware install":
   - an instance sees an install only once its branch carries this story;
   - such an instance's answer always carries a `firmware` block (ADR 0004 sub-decision 2), so an answer without one doesn't see installs (today tags, and production until it is promoted);
   - on such an instance the old workaround stands: have merges into its branch held until the install ends.

   Qualify :125 to match, and either give tags' workflow (`deploy-tags.yml`) or say tags isn't covered yet. Pinning the note in D2 is the Tester's call.

### Non-blocking

1. **`src/operations/catalog/lifecycle/seed-firmware.js:143`: the writer's side of the lock coupling is unpinned.** The answer sees seed-firmware only because `run()` takes the lock under the op `'seed-firmware'` (`C.begin('seed-firmware')`, then `_common.js:79`, then `acquireLock({ op })`).
   - Nothing pins that. H2–H7 take the lock through `acquireLock({ op: 'seed-firmware' })` directly (`test/deploy-safety-sees-installs.test.js:189-196`, :599), and seed-firmware's own suites test `busy` only against a backup's lock (SF26).
   - ADR 0004's Consequences says "comments at both ends say so". The comments are at the reader and at `inspectLock`, not at :143.
   - ADR graph-operations-first-slice/0043 expects seed-firmware to change when it becomes the install, so a rename there would blind the gate with every test green.

   Optional: a source sentinel that `seed-firmware.js` calls `C.begin('seed-firmware')` before `graph.writeTransaction` and releases the lock in its `finally`, and a comment at :143 that names the reader.
2. **`src/api/deploy-safety/index.js:116-121`: `handleStatus`'s JSDoc is stale.** It still says the GET does "only Redis reads (ping, active jobs, job schedulers), a config-file read, and in-memory Map iteration". It now also reads the lifecycle lock file and probes its holders (`process.kill(pid, 0)`, `/proc/<pid>/stat`). The module header (:2-33) is right. Optional: update the sentence.
3. **`engineering-team/decisions/deploy-safety-gate/0004-deploy-safety-sees-firmware-installs.md:232`: the testing note misnames what turns the queue off.** It says "The queue must read as off, through a `BRAINSTORM_CONF_PATH` at a dead conf".
   - But `src/utils/brainstormConfig.js:18` reads the fixed `/etc/brainstorm.conf`, and its `get()` (:109-110) falls back to `process.env`. `BRAINSTORM_CONF_PATH` reaches only `src/utils/config.js` and the lifecycle identity module.
   - The queue reads as off because `/etc/brainstorm.conf` is absent and `TASK_QUEUE_ENABLED` is unset, as the test plan (:8) says.
   - So the in-process H tests depend on that ambient state. On a host whose `/etc/brainstorm.conf` enables the queue, or with `TASK_QUEUE_ENABLED=true` exported, they would reach for the task queue and fail, H8 first, since it pins `queue: { enabled: false }`.

   Optional: correct the sentence at the next gate.
4. **`engineering-team/stories/deploy-safety-gate/4-deploy-safety-sees-installs.md:87, :95`: the Evidence's run predates the rebase.**
   - `239fe71e` is the failing-tests commit from before the rebase, on `deef26702`. The branch's own is `a013bcea7`, on `94e85fe06`, and the rebase brought in 22 changed files under `src/`, `test/` and `docs/` from #198 and #199.
   - The run's 62-suite list also missed the five readers named under Quality gates.

   This review's run on the final HEAD covers both. Optional: say that the run predates the rebase, and point at this run.
5. **`docs/SAFE_TO_MERGE.md:133`: "A gap remains" names only one gap.** It names the check that came just before the install started. ADR 0004 (:189) also accepts that a merge that skips the check isn't held, and OPEN.md row 340 records several. Optional: one clause there would tell the installer both.
6. **`src/operations/catalog/lifecycle/_store.js:225-227`: the pid-reuse rule is untested.** This branch of `holderAlive` judges a holder dead when its pid answers with a different `/proc` start time. After a plain container restart that keeps the hostname, it is the only thing that makes a seed-firmware lock stale. It is correct by reading, but no suite exercises it: this one doesn't (H4's holder dies outright), and on macOS, with no `/proc`, none could. The gap predates this story, which now leans on it. Optional: an intake or ledger note.
7. **`ledger/2026-11-21-install-starts-after-a-safe-check.md`, `ledger/2026-11-21-overlapping-installs-share-internal-mode.md`: the ids carry the local date.** Both are dated 2026-11-21, but they were first named in the ADR commit `50de6d358`, authored 2026-11-22T01:46:29Z, and OPEN.md's id rule is the UTC day the row is minted. Renaming is allowed until the rows reach `staging`, but it touches the two rows and the four files that cite them. Leaving them is defensible.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*

1. **Scoped gate lists are still built by hand.** The Implementer's token list missed five readers of changed files: `test/registry.js`, `stories/_intake.md` and the new audits book. Open meta rows `2026-11-21-scoped-gate-lists-built-by-hand` and `2026-11-21-no-map-from-diff-to-suites` already cover this. This is one more instance, so no new row.
2. **Two conf readers disagree.** `src/utils/config.js` honours `BRAINSTORM_CONF_PATH`, and `src/utils/brainstormConfig.js` doesn't. The latter is the deploy-safety module's, and it reads the queue flag. So a scoped-gate recipe that points `BRAINSTORM_CONF_PATH` at a dead conf still leaves the queue flag to `/etc/brainstorm.conf` and `process.env`, and ADR 0004's testing note (:232) assumed otherwise. Proposed meta row, for the session to file: "brainstormConfig ignores BRAINSTORM_CONF_PATH, so a dead conf doesn't switch the task queue off".

## Verdict

One blocking issue: the installer's procedure promises protection on instances that don't have it yet. The code, its ADR conformance and its tests are sound. The ADR's Context holds against the source, every criterion has a test, and the tests fail without the feature, each for the right reason. The fix is a short paragraph in `docs/SAFE_TO_MERGE.md`. The non-blocking items can ride along in the same round.

**CHANGES_REQUESTED**

## Close-out (same commit)

- [ ] The story stays `Approved` this round. Nothing flips, and no file moves.
- [ ] Completion detection not run, since the story hasn't cleared review. The book stays Open.

---

## Round 2

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-21 (2026-11-22 UTC)
**Diff:** `git diff d3816935d..HEAD`, the three commits since round 1's review commit: ADR 0004 Amendment 1 `7270d05fc`, round 2's tests `2fcc8d70a`, and the fixes `3b2064e16`. 10 files, +245 / −16. HEAD is `3b2064e16`, still on `94e85fe06`.

### Quality gates, round 2 (run by reviewer, not trusted)

The safety constraints and environment were round 1's.

- [x] **Scoped gate, 67 suites, on the final HEAD:** `npm run gate:status -- --label ds4-review-2` gives
  `20261122T032535Z-65466-0e05 [ds4-review-2] started 2026-11-22T03:25:35.424Z on 3b2064e1 — FAIL, exit 1, 3330 passed, 3 failed, 123 skipped, 67/67 suites; failed: router-stream-limit-on-connect`
  - **The only failures are `router-stream-limit-on-connect` P1–P3,** BSD `sed` again (open ledger row `2026-10-09-router-patch-sed-macos`). The tree was clean: the line has no `+dirty`.
  - **No suite left `process.env` changed,** and the skips are round 1's live layers.
  - **This story's suites:**
    - `deploy-safety-sees-installs`: 42 of 42, with H10, S4 and D6–D8;
    - `deploy-safety-status`: 17 passed, with 6 live skips;
    - `next-task-countdown` 24, `close-unauth-write-surface` 14, `default-deny-mutations` 14, `admin-action-sweep-access` 13, `firmware-install-leaves-tags-once` 24;
    - `operations`: 1556 passed, 20 skipped.
  - **The harness readers,** all with no failures: `suite-env-changes` 18, `harness-lint` 85, `ledger-row-ids` 6, `session-start` 32, `rollup-scanners` 33, `harness-stats` 12, `kill-timeout-orphans-by-default` 9, `note-tagging-raw-events-inspector-ui` 32, `gate-result-record` 34.
  - **It agrees with the coordinator's run,** `20261122T030840Z-63894-09dd` on `2fcc8d70+dirty`: the same 3330 passed and the same three failures.
- [x] **The list, re-derived from the final diff.** The diff now also holds `seed-firmware.js`, three ledger files and this review, and their readers are already on the list:
  - `operations.test.js`, which runs `test/operations/`;
  - `deploy-safety-sees-installs` (S4), `deploy-safety-status` and `firmware-install-leaves-tags-once`, which name seed-firmware;
  - `harness-lint`, `harness-stats`, `ledger-row-ids`, `session-start` and `rollup-scanners`, which read the ledger and the reviews.

  So it is round 1's 67, identical to the coordinator's `list2.json`, and the same 16 near-misses are left out for round 1's reason.
- [x] **`test/safe-to-merge-check.test.js` on its own, with the system `curl` (`env-realcurl.sh`):** 17 passed, 0 failed, B10 included. Its C1–C3 read the recipe that round 2 changed.
- [x] **The new tests without the fixes.** I extracted `2fcc8d70a` (round 2's tests, on round 1's code and docs) into a scratch folder. There the suite gives 35 passed and 7 failed: S4, D2, D3, D5, D6, D7 and D8, each naming what is missing. H10 passes, as a guard on an existing rule should. This matches the test plan's Round 2 section.
- [x] **The guards, on a scratch copy of HEAD,** one mutation at a time, each restored:

  | Mutation | Result |
  |---|---|
  | none (control) | 42 of 42 |
  | `_store.js:227`, the pid-reuse line, taken out | H10 alone fails: "… must read as no install (got [{"install":"seed-firmware",…}])" |
  | `C.begin('seed-firmware')` renamed to `C.begin('seed')` | S4 alone fails: "seed-firmware no longer takes the lifecycle lock as C.begin('seed-firmware') …" |
  | the comment above `C.begin` taken out | S4 alone fails |
  | the release in seed-firmware's `finally` taken out | S4 alone fails |
  | the answer's op check renamed to `'seed'`, the install name kept | L2, L3, L5, H2–H7 and H10 fail |
  | the transition note's production clause taken out | nothing fails (R2-3) |
  | the note's "What to do there" bullet taken out | nothing fails (R2-3) |
- [x] **`bash scripts/harness-lint.sh`:** clean before this section. After it, there is one violation, L1: this review is now final against a story still marked `Approved`. The session's flip in the same commit clears it (Close-out, round 2). Nothing else.

### Round 1's findings, each re-checked as a fresh claim

I re-derived each fix from the code and the docs, not from my round-1 wording. Where a fix adopted that wording, the sentence was checked like any other.

| Round 1 | The fix | Checked against |
|---|---|---|
| Blocking 1: the procedure promised protection everywhere | a transition note (`docs/SAFE_TO_MERGE.md:115-118`); `deploy-tags.yml` named (:126); :130 qualified; D7 | `origin/feat/tags` (`25d39636e`) and `origin/main` (`9f7d7aa30`) serve story 1's endpoint with no `FIRMWARE_INSTALL_RUNNING` and no `firmware` block. HEAD's handler adds the block to every 200 answer. Its 400 and 500 exits lack it, which can only make an installer hold merges. `deploy-tags.yml` deploys `feat/tags` on push, and the `!= "completed"` filter also catches a run waiting on its environment. **Holds.** D7 pins only part of it (R2-3). |
| Non-blocking 1: the writer's side unpinned | a comment at `seed-firmware.js:143-145`; S4 | The comment is accurate: the answer keys on the op (`seedFirmwareFromLock`), whatever process holds the lock. S4 fails on a renamed op, a missing comment or a missing `finally` release. **Holds.** |
| Non-blocking 2: stale JSDoc | `src/api/deploy-safety/index.js:117-122` | "Signal 0" is `pidAlive`'s `process.kill(pid, 0)`, and `/proc/<pid>/stat` is `startTimeOf`'s read, both inside `inspectLock()`, which takes, frees and recovers nothing. **Holds.** |
| Non-blocking 3: the testing note | ADR :238 and a new meta row | `brainstormConfig.js:18` reads the fixed path, and `get()` (:109-110) falls back to `process.env`. **Holds for the handler,** which is what the ADR speaks of. The meta row overstates it (R2-1, R2-2). |
| Non-blocking 4: Evidence from before the rebase | a note at story :89, and round 2's run | Its record (`20261122T030840Z-63894-09dd`, on `2fcc8d70+dirty`) matches the numbers given, on the same 67 suites. **Holds,** with two small slips (R2-4). |
| Non-blocking 5: one gap named | "Two gaps remain" (:138-140) | OPEN.md row 340 records four merges that skipped the check: 2026-09-19, 2026-10-29, and twice on 2026-10-31. "Several" holds. **Holds.** |
| Non-blocking 6: the pid-reuse rule untested | H10 | Its stand-in stat line puts the start time at field 22, where `startTimeOf` reads it, and the stand-in is put back before anything else can run. On CI's Linux, an intercept that missed would fail H10's control rather than pass it. **Holds.** The rule itself has an edge (R2-7). |
| Non-blocking 7: ids dated by the local day | `git mv` to 2026-11-22, with `**Id:**` and `**Opened:**` updated; D6 | L15 holds, and neither old id was ever on `origin/staging`. The old ids remain only in round 1 of this review, in the test plan's quoted failure output (labelled as such), and in D6's `OLD_ROW_IDS`, all history or deliberate. **Holds.** |
| Harness friction 2 | `ledger/2026-11-22-brainstorm-config-ignores-conf-path.md` | A well-formed meta row, but two of its claims don't hold (R2-1, R2-2). |

**Also checked:**
- **Phase lanes:** `7270d05fc` touches only the ADR, `2fcc8d70a` only the suite and the test plan, and `3b2064e16` no test file.
- **Amendment 1's other items (1, 2, 3, 5, 6, 7)** match what the fixes did.
- **No new dependency, tooling, TA pubkey or secret.**

### Findings, round 2

#### Blocking

None.

#### Non-blocking

1. **R2-1. `ledger/2026-11-22-brainstorm-config-ignores-conf-path.md:13`: the queue flag has two readers, not one.** The row says "The second is the one that reads `TASK_QUEUE_ENABLED`". It isn't the only one:
   - `src/api/assistant/scores.js:138` and `src/api/assistant/selfMap.js:141` read the same flag through `getConfigFromFile` (`src/utils/config.js`), the reader that honours `BRAINSTORM_CONF_PATH`;
   - `brainstormConfig` serves the deploy-safety answer (`src/api/deploy-safety/index.js:141`), the API's queue mount (`src/api/index.js:578`) and run-task (`src/api/manage/commands/runTask.js:419`).

   So under a dead conf, one flag reaches two parts of the control panel by two paths, which only strengthens the row. Optional: name both readers.
2. **R2-2. The same row, :18-22: "H8 first" is my own round-1 wording, and it doesn't hold.** I re-derived it:
   - A test process never calls `initTaskQueue`; only `bin/control-panel.js:338` does. So `isQueueAvailable()` returns false at once (`src/manage/taskQueue/queue/index.js:194`, `_state` unset) and makes no Redis call.
   - With the flag on, every answer is unsafe with `QUEUE_STATE_UNAVAILABLE`. H1 fails first, and every H test that expects a safe answer fails with it, H8 among them.
   - "Would reach for the task queue" is loose too: the suites require its module but never reach Redis.

   Optional: "They would fail there, H1 first: every answer is unsafe with `QUEUE_STATE_UNAVAILABLE`, since a test process never starts the queue."
3. **R2-3. `test/deploy-safety-sees-installs.test.js:976` and `:978` (D7): two of its parts pass on other sentences.**
   - `/production/i` is met by "Use `deploy-tapestry.yml` for production" (`docs/SAFE_TO_MERGE.md:126`).
   - `/hold merges[^.]*by hand/` is met by :130's "on that instance nobody needs to hold merges by hand", which says the opposite.

   On a scratch copy, taking out the note's production clause, or its "What to do there" bullet, leaves D7 green. The doc is right today; D7 just pins less than its name says. Optional, in the Tester's lane: test those parts against the note's own lines.
4. **R2-4. `engineering-team/stories/deploy-safety-gate/4-deploy-safety-sees-installs.md:89` and `:121`: two small slips in the Evidence.**
   - **:89** says round 1's run and round 2's "cover the final tree". Round 1's ran on `585e22d1`, before round 2's changes. Only round 2's run and this review's cover the final tree.
   - **:121** says round 2's gate ran "with the fixes in the working tree and committed unchanged after it". The fix commit holds this paragraph, which names the run, so the paragraph was written after the run; the record shows `2fcc8d70+dirty`.

   No result depends on either: this round's run is on `3b2064e1` itself.
5. **R2-5. `engineering-team/stories/deploy-safety-gate/4-deploy-safety-sees-installs.test-plan.md:60`: D6's row says more than D6 checks.** It says "no doc cites the old ids", but D6 checks only `docs/SAFE_TO_MERGE.md` (test :967), and the test plan itself quotes the old names, by design. Optional: "and `SAFE_TO_MERGE.md` no longer cites them".
6. **R2-6. `docs/SAFE_TO_MERGE.md:115`, :117, :118, :130: "this story" in a standing recipe.** Whoever reads the recipe isn't reading a story. The section's own parenthetical, and the rest of the doc, say "story #4". Optional: "story #4".
7. **R2-7. ADR 0004 :271 (Amendment 1, item 4): the restart it names is the unchecked one, and the rule isn't reboot-proof.**
   - **The example.** It names "a droplet compose override that pins `hostname:`", which the ADR's Context says wasn't checked. The certain case is the container restarting itself, after a droplet reboot or a crash. `docker-compose.yml` sets `restart: unless-stopped` (:40), and a restarted container keeps its id, and so its hostname.
   - **The edge.** There the start-time rule can misjudge. `/proc` start times count clock ticks since boot, so after a reboot a reused pid can start at the same tick count as the dead holder did, and the lock then reads live.
   - **The effect.** For the gate that fails closed: the answer stays unsafe until the check's bound. But lifecycle operations would refuse `busy` until the process holding that pid restarts or someone removes the lock.
   - **Not this story's.** The behaviour predates it (ADR graph-operations-foundation/0002, Decision 7), and the odds are low.

   Optional: a ledger row. A holder could also record the kernel's boot id (`/proc/sys/kernel/random/boot_id`).

#### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*

1. None new. R2-2 is the case role step 10 exists for: my own suggested wording went into the record unchecked, and this round's fresh check caught it.

### Verdict, round 2

Every round-1 finding is fixed, and each fix holds as a fresh claim. What remains is the small imprecision listed above, none of which changes behaviour or would lead an installer or merger into an unsafe act. The new tests fail without the fixes for the right reasons, and the guards are real. The gate on the final HEAD fails only on the known macOS `sed` trio.

**PASS**

### Close-out, round 2 (same commit)

- [ ] The story's `Status` goes to `Done` in place, in this review's commit. The session makes that change, since the Reviewer writes only this file. Until it lands, harness-lint's L1 reports this review as final against an `Approved` story, and nothing else.
- [ ] Amendment 1's two Architect picks wait on the owner's ratification at this gate: item 4, a test rather than a ledger note, and item 6, the renamed ids.
- [ ] Completion detection performed. The result goes in the chat, not in this file.

---

## Fix-check after round 2

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-21 (2026-11-22 UTC)
**Diff:** `git diff 7a593c0e9..HEAD`, two commits:
- `9d59e3a37` (test): D7 and the test plan;
- `d8a6d6581` (docs): the recipe, ADR 0004 Amendment 1, the story's Evidence, the meta row, and a new ledger row.

7 files, +99 / −22. HEAD is `d8a6d6581`, still on `94e85fe06`. The story has been `Done` since round 2's commit.

### Quality gates, fix-check (run by reviewer, not trusted)

The safety constraints and environment were round 1's.

- [x] **Scoped gate, 13 suites, on the committed HEAD:** `npm run gate:status -- --label ds4-review-3` gives
  `20261122T035447Z-10628-3f2f [ds4-review-3] started 2026-11-22T03:54:47.865Z on d8a6d658 — PASS, exit 0, 369 passed, 0 failed, 10 skipped, 13/13 suites`
  - **The tree was clean:** the line has no `+dirty`. No suite left `process.env` changed.
  - **Every suite passed:** `deploy-safety-sees-installs` 42 of 42, `deploy-safety-status` 17 (6 live skips), `container-apt-refresh` 23 (4 skips), `live-link-checks` 26, `harness-lint` 85, `harness-stats` 12, `rollup-scanners` 33, `session-start` 32, `ledger-row-ids` 6, `gate-result-record` 34, `suite-env-changes` 18, `kill-timeout-orphans-by-default` 9 and `note-tagging-raw-events-inspector-ui` 32.
  - **It agrees with round 3's run,** `20261122T034530Z-17030-d50f` on `9d59e3a3+dirty`: the same 13 suites and totals.
- [x] **Why these 13 are enough.** The two commits change one test (D7), the recipe, the ADR, the story, the test plan and two ledger rows. Their readers are:
  - for the recipe: `deploy-safety-sees-installs`, `container-apt-refresh` and `safe-to-merge-check`;
  - for the ledger: `ledger-row-ids`, `session-start`, `harness-lint` and `live-link-checks`;
  - for the ADR, story and test plan: `harness-lint`, `harness-stats` and `rollup-scanners`;
  - for a changed test file: `gate-result-record`.

  The other ledger hits read other rows or only name the folder: `word-elements-fit-the-installed-word-schema`, `property-has-one-parent` and `brains-launcher-repo`. The 13 hold every reader above except `safe-to-merge-check`, run on its own below. They also hold four suites that read nothing changed here, which is harmless.
- [x] **`test/safe-to-merge-check.test.js` on its own, with the system `curl` (`env-realcurl.sh`):** 17 passed, 0 failed, B10 included. Its C1–C3 read the recipe this check changed.
- [x] **D7's guard, on a scratch copy of HEAD,** one edit at a time, each restored:

  | Edit to the recipe | Result |
  |---|---|
  | none (control) | 42 of 42 |
  | the "What to do there" bullet removed | D7 alone fails: "the transition note must say that on such an instance, merges into its branch are held by hand until the install ends." |
  | the production clause removed | D7 alone fails: "the transition note must name production, until `main` takes story #4." |
  | "on that instance" removed from :130 | D7 alone fails: "… may stand only for an instance that carries story #4 …" |
  | the "How to tell" bullet removed | D7 alone fails: "the transition note must say how to tell an instance that doesn't see installs yet …" |
  | "that carries story #4" dropped from :130's bold sentence, with "on that instance" kept | nothing fails (F4) |

  The first three are the test plan's Round 3 edits, reproduced.
- [x] **`bash scripts/harness-lint.sh`:** clean before this section, and clean after it, with 0 violations. The story is `Done` and the final verdict is the one below.

### Round 2's findings, each re-checked as a fresh claim

I re-derived each fix from the code and the docs, including the new ledger row's reasoning about pids and start times, which re-uses my round-2 wording.

| Round 2 | The fix | Checked against |
|---|---|---|
| R2-1: the meta row names one reader | :13 now names `scores.js:138` and `selfMap.js:141` as readers through the first | **Partly holds.** The deploy-safety answer does read through the second, and a dead conf does reach those two. But "Other readers of the same flag use the first" still isn't the split (F1). |
| R2-2: "H8 first" | :22: H1 fails first, at its after-leave check, with no Redis call | **Holds for this suite.** H1 is the first H test, and its in-install checks pass (unsafe, naming the install) before its after-leave check fails. But "A test process never starts the task queue" overreaches, and it was my round-2 claim (F1). |
| R2-3: D7 pins less than its name says | D7 checks each part inside the transition note | **Holds.** Four of my five edits fail D7 alone, the test plan's three among them. One residual gap (F4). |
| R2-4: slips in the Evidence | story :89 and :121 reworded, and round 3's run recorded | **Holds.** The record (`20261122T034530Z-17030-d50f`, on `9d59e3a3+dirty`) matches the Evidence: exit 0, with 369 passed, 0 failed and 10 skipped across 13 suites. |
| R2-5: D6's row says more than D6 checks | test plan :60 | **Holds.** It now says `docs/SAFE_TO_MERGE.md` doesn't cite the old ids, which is what D6 checks (:967). |
| R2-6: "this story" in the recipe | four places now say "story #4", and the parenthetical is trimmed | **Holds.** No "this story" is left in the recipe. |
| R2-7: the ADR's example, and the reboot edge | ADR :272-281, and `ledger/2026-11-22-reboot-can-revive-a-dead-lock.md` | **Mostly holds.** Item 4 now names the restart that `restart: unless-stopped` gives, and confines the coincidence to a droplet reboot, which is right: without one, a restarted process starts later, so its start time can't match. The store keeps raw ticks since boot, with no boot time or boot id (`_store.js:206-212`). The row's reasoning holds, "cut off by a crash or reboot" included: a lock a crash left stale can be revived by a later reboot, and a deploy changes the hostname. Three slips (F2, F3). |

**Also checked:**
- **The ratification line and the revision note** (ADR :260, :291-296) say what the coordinator relayed of the owner's choice. I can't check that choice beyond that.
- **Phase lanes:** `9d59e3a37` touches only the suite and the test plan, and `d8a6d6581` touches no test file.
- **The new row's id** is well formed: six words, minted on 2026-11-22 UTC. L15 holds.

### Findings, fix-check

#### Blocking

None.

#### Non-blocking

1. **F1. `ledger/2026-11-22-brainstorm-config-ignores-conf-path.md:13` and `:22`: two claims still overreach, both partly from my own round-2 wording.**
   - **:13 says "Other readers of the same flag use the first".** Re-derived with a grep of `src/` and `bin/`, the flag has seven readers:
     - through `getConfigFromFile`, which honours `BRAINSTORM_CONF_PATH`: `bin/control-panel.js:334` (whether the queue starts at all), `src/api/assistant/scores.js:138` and `src/api/assistant/selfMap.js:141`;
     - through `brainstormConfig`, which doesn't: `src/api/deploy-safety/index.js:141`, `src/api/index.js:578`, `src/api/manage/commands/runTask.js:419` and `src/api/tagging-edges/pass.js:69`.

     My round-2 list missed `control-panel.js` and `pass.js`. The row's conclusion holds: a dead conf reaches the first three, not the deploy-safety answer.
   - **:22 says "A test process never starts the task queue".** That was my round-2 claim, from a grep of `src/` and `bin/` alone. In fact `task-queue-job-gate` starts it in the gate's own process, over stand-ins, and closes it in a `finally`, and `tagging-edges-wiring`'s SWR79 starts it in a child. Both run after this suite in registry order (319 and 305, against 130). So for this suite, standalone or in the full gate, the conclusion holds.

   Optional: name both sides at :13, and at :22 say "this suite's process hasn't started the task queue".
2. **F2. `ledger/2026-11-22-reboot-can-revive-a-dead-lock.md:26`, and ADR 0004 :278: the wedge is over-described.**
   - **How long it lasts.** The row says "That lasts until someone removes the lock by hand", and the ADR "until someone removes the lock". It also ends when the process now holding that pid restarts, which gives it a new start time, or when a deploy recreates the container, which gives it a new hostname. The next lifecycle operation then recovers the lock. My round-2 text had the restart clause; it was dropped.
   - **Which operations refuse.** "Every lifecycle operation refuses `busy`: backup, restore, migrate and seed-firmware." `upload-backup` refuses too (`upload-backup.js:48-49`), while list-backups, download-backup and status don't refuse at all.
3. **F3. `ledger/2026-11-22-reboot-can-revive-a-dead-lock.md:31`: the second fix shape shares the coincidence.** Process 1's start time also counts ticks from boot, and process 1 starts at a repeatable point after boot. Recorded as ticks, it can match after a reboot too. It helps only if recorded as wall-clock time: the boot time (`btime` in `/proc/stat`) plus the ticks. The boot-id shape (:30) is a full fix.
4. **F4. `test/deploy-safety-sees-installs.test.js:989-990` (D7): "on that instance" passes on its own.** Dropping "that carries story #4" from :130's bold sentence, while keeping "on that instance", leaves D7 green (checked on a scratch copy). "That instance" would then mean any instance. The transition note stays pinned, so the section still states the condition. Optional, in the Tester's lane: also pin :130's "an instance that carries story #4 answers unsafe".

#### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*

1. None new. F1's second point is one more case of what role step 10 guards against: my own round-2 claim, from too narrow a grep (`src/` and `bin/`, not `test/`), went into the record, and this check caught it.

### Verdict, fix-check

Every round-2 finding is fixed. Each fix holds as a fresh claim, or holds where it matters. D7's guard is real, and the gate on the committed HEAD passes. What's left is precision in the two ledger rows and one residual gap in D7. None of it changes behaviour or lets an unsafe merge through.

**PASS**

### Close-out, fix-check

- [x] The story is already `Done`, from round 2's review commit, so nothing flips.
- [ ] Completion detection performed. The result goes in the chat, not in this file.

---

## Second fix-check (F1–F4)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-21 (2026-11-22 UTC)
**Diff:** `git show 3208c7c90 d780c4715`, two commits:
- `3208c7c90` (test), F4: D7 and the test plan;
- `d780c4715` (docs), F1–F3: the meta row, the reboot row, and ADR 0004 :278.

5 files, +39 / −8. They come just before `60ecaa9e6`, the commit that holds the fix-check section above, so the fix-check's "HEAD is `d8a6d6581`" is history. The base is still `94e85fe06`, and the story is `Done`.

### Quality gates (run by reviewer, not trusted)

The safety constraints and environment were round 1's.

- [x] **Scoped gate, the same 13 suites, on the committed HEAD `60ecaa9e6`:** `npm run gate:status -- --label ds4-review-4` gives
  `20261122T040850Z-16361-73b4 [ds4-review-4] started 2026-11-22T04:08:50.225Z on 60ecaa9e — PASS, exit 0, 369 passed, 0 failed, 10 skipped, 13/13 suites`
  - **The tree was clean,** and no suite left `process.env` changed. `deploy-safety-sees-installs` gave 42 of 42, and every other suite gave the fix-check's numbers.
  - **It agrees with the coordinator's run,** `20261122T040256Z-24746-f06e` on `3208c7c9+dirty`: the same 13 suites and totals.
- [x] **Why the same 13.** The two commits change D7's test file, the test plan, the ADR and two ledger rows. Their readers are a subset of the fix-check's 13: `deploy-safety-sees-installs`, `gate-result-record`, `harness-lint`, `harness-stats`, `rollup-scanners`, `ledger-row-ids`, `session-start` and `live-link-checks`. `safe-to-merge-check` reads the recipe, its script and the cycle skills, none of which changed, so I didn't rerun it.
- [x] **D7's guard, on a scratch copy of `60ecaa9e6`,** one edit to the recipe at a time, each restored:

  | Edit | Result |
  |---|---|
  | none (control) | 42 of 42 |
  | "that carries story #4" dropped from :130's bold sentence, with "on that instance" kept (the fix-check's F4 probe) | D7 alone fails: "… may stand only in a paragraph that limits it to an instance that carries story #4 …" |
  | "on that instance" removed from :130 | D7 alone fails: "… must be qualified in its own sentence …" |
  | the "What to do there" bullet removed | D7 alone fails |
  | the production clause removed | D7 alone fails |
  | the "How to tell" bullet removed | D7 alone fails |

  These are the test plan's five edits, reproduced.
- [x] **`bash scripts/harness-lint.sh`:** clean before this section, and clean after it, with 0 violations.

### F1–F4, each re-checked as a fresh claim

| Finding | The fix | Checked against |
|---|---|---|
| F1, the meta row's readers | :13-24: seven readers, three through `getConfigFromFile` and four through `brainstormConfig` | **Holds.** I re-derived it from a grep of the whole repo outside tests and docs. The code readers are exactly these seven. The other hits are comments, log lines, and the template line that sets the flag. `control-panel.js:334` does decide whether the queue starts (:335-345). |
| F1, "a test process never starts the queue" | :33: nothing has started it in the gate's process by the time those suites run; two later suites start it over stand-ins | **Holds.** Only `task-queue-job-gate` and `tagging-edges-wiring` call `initTaskQueue` (`task-queue-bullmq` and `task-queue-neo4j-resource-class` only mention it), and both sit after this suite in `test/registry.js` (319 and 305, against 130). B10's in-process handler runs right after this suite too. |
| F2, the wedge | the reboot row :26-29 and ADR :278: five operations, and three ways the refusal ends | **Holds.** Backup, restore, migrate and seed-firmware take the lock through `C.begin`, and upload-backup checks it with `recoverIfStale` (`upload-backup.js:48-49`). No other lifecycle operation refuses. The refusal ends once the lock reads stale (a new pid or start time, or a new hostname after a recreate) or is removed. |
| F3, the second fix shape | the reboot row :34: wall-clock time, and the boot id as the only full fix on its own | **Holds,** including "only … on its own". A wall-clock start rests on `btime`, which moves when the clock is stepped, so comparing it needs a tolerance; the boot id doesn't. |
| F4, D7 | D7 also checks that the paragraph names an instance that carries story #4 | **Holds.** My probe now fails D7, and so does each of the other four edits. |

**Also checked:**
- **Phase lanes:** `3208c7c90` touches only the suite and the test plan, and `d780c4715` no test file.
- **No new verdict vocabulary** in the ADR, the story or the test plan; harness-lint's L14 holds.

### Findings, second fix-check

#### Blocking

None.

#### Non-blocking

1. **G1. `ledger/2026-11-22-brainstorm-config-ignores-conf-path.md:27` and `:37`: the file doesn't always win.** This is older text, from round 2, resting on my round-1 reading; I found it while re-deriving F1.
   - **Why.** `brainstormConfig`'s parser keeps only bare `VAR=value` lines (`src/utils/brainstormConfig.js:57`). The template writes the flag as `export TASK_QUEUE_ENABLED=true` (`config/brainstorm.conf.template:100`), and the entrypoint renders `/etc/brainstorm.conf` from that template (`docker/entrypoint.sh:41-62`). So on a deployed instance `brainstormConfig` never takes the flag from the file. It gets it from `process.env`, because the entrypoint sources the conf (:292).
   - **The check.** I called `parseConfig` in memory: the `export` line gave no key, the bare line did, and `get()` then returned the environment's value.
   - **What it changes.** "The queue flag comes from `/etc/brainstorm.conf`" (:27) holds only for a bare line. "The file wins over `process.env`" (:37) is wrong for the template's own line, so the first fix shape (exporting `TASK_QUEUE_ENABLED=false`) works better than the row says.

   Optional: correct both lines.
2. **G2. `engineering-team/stories/deploy-safety-gate/4-deploy-safety-sees-installs.md:89`: this round isn't in the Evidence.** D7 changed again, and a run was made (`20261122T040256Z-24746-f06e`, on `3208c7c9+dirty`). But the story's Evidence still ends at round 3, and :89 still says round 3 "changed only prose and one test, D7". The run is recorded only in `d780c4715`'s message and in this review. Optional: one line in the Evidence.

#### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*

1. None new. G1 is one more case of my own earlier reading going into a record, caught on a fresh check.

### Verdict, second fix-check

F1–F4 are fixed, and each fix holds as a fresh claim. D7's guard is real, and the gate on the committed HEAD passes. What remains is two optional corrections to records, neither touching code, tests or the procedure.

**PASS**

### Close-out, second fix-check

- [x] The story is already `Done`, so nothing flips.
- [ ] Completion detection performed. The result goes in the chat, not in this file.
