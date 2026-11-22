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
