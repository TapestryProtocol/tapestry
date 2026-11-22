# Story 4: The deploy-safety answer sees a running firmware install

**Status:** Done
**Created:** 2026-11-21
**Type:** Bug

## Background

**What happened.** On 2026-11-21, two firmware reinstalls of staging, for community-reference #39, were cut off by merges into `staging`:
- **The first** started at 20:28:01 UTC, as the loopback call `POST http://127.0.0.1:7778/api/firmware/install` inside the container. TapestryProtocol/tapestry#181 was merged at 20:28:09. Its deploy, run 44946433865, recreated the container at about 20:29:40, 1 minute 40 seconds into Pass 1.
- **The second** started at 20:51:08. TapestryProtocol/tapestry#190, a docs-only PR, was merged at 20:51:19. Its deploy, run 44948469514, recreated the container at about 20:52:48, again 1 minute 40 seconds into Pass 1.
- **A third attempt** ran from 22:07:06 to 22:11:46 and finished, because the owner held merges.

Both times, `scripts/check-safe-to-merge.sh https://staging.brainstorm.world` had answered safe a few seconds before the install started.

**Why.** The deploy-safety answer (`GET /api/deploy-safety/status`, story 1) counts three things: the task queue's running jobs, the legacy per-customer runs in flight, and a scheduled task due within the buffer. A firmware install is none of them, so the answer stays safe while one runs, and the safe-to-merge check (story 2) lets the merge through. Every merge into `staging` or `main` redeploys, docs-only ones included: `deploy-staging.yml` has no paths filter, and every deploy recreates the `tapestry` container.

**What a cut-off install leaves.** The concepts Pass 1 reached hold Pass 1's letter, and the rest hold what they held before. The first cut-off left `tag` and `nostr-relay` without their pointer `b` until the next full install. A full install heals it, but until one runs, the graph is in a state no install means to leave.

**Today's workaround.** Whoever runs an install asks the owner to hold merges into that instance's branch until it finishes. That works only when every merger hears about it.

**Two installs.** Today's install is the install route, `POST /api/firmware/install`. The Dashboard's button, the loopback call sessions use, and the install at first start all call it. `lifecycle seed-firmware` (graph-operations-first-slice #37) is the second: ADR graph-operations-first-slice/0043 makes it the install once export nostr can sign what it writes. The owner chose to cover both now (2026-11-21), so the gate doesn't go blind when the install changes.

**A gap the answer can't close.** An instance can't see an install that hasn't started. So an install that starts after a merger's check said safe, but before that merge's deploy recreates the container, is still cut off. The recreation comes about 90 seconds after the merge, and later on a refreshing deploy. Most of that window is a deploy that is already running, which the person starting the install can see. The owner chose (2026-11-21) to have the written procedure tell them to look first. What remains is a merger who has checked but not yet merged. The safe-to-merge recipe has them merge at once, so that is usually seconds. It is recorded in the ledger, not fixed here.

**Who's affected:** anyone who runs a firmware install on a deployed instance, and anyone who merges into a branch that deploys.

**Source:** ledger row `ledger/2026-11-21-deploy-safety-misses-firmware-installs.md` (on `staging` since TapestryProtocol/tapestry#195), and story community-reference #39's Evidence, "On staging".

## User-facing description

As someone who merges into `staging` or `main`, I want the safe-to-merge check to wait while a firmware install runs on the instance my merge redeploys, so that my merge never cuts an install off and nobody has to ask the owner to hold merges.

As someone who runs a firmware install, I want the written procedure to tell me what to check before I start, so that I don't start one while a deploy of that instance is on its way.

## Acceptance criteria

- [ ] **AC-1 (either install makes the answer unsafe while it runs).** Given an instance with nothing else running or due, when a firmware install starts, then every deploy-safety answer from that instance is unsafe from the moment the install starts until it ends. This holds for:
  - today's install, started through its route by any caller (the Dashboard's button, the loopback call, the install at first start), a dry run included;
  - `lifecycle seed-firmware`, run through its route or from a shell inside the instance, from when it takes the lifecycle lock, before it writes anything, until it lets the lock go.

  *(Amended at Architecture 2026-11-21, ADR 0004 sub-decision 4: seed-firmware's span. Before it takes the lock it only reads the firmware's files, so a deploy then cuts off nothing.)*

  The answer gives a reason of its own, which says a firmware install is running and is none of the existing four. It also says which install is running and when it started, and nothing about who started it.
- [ ] **AC-2 (the answer lets go when the install ends, however it ends).** Given an install is running, when it finishes, fails with an error, or is refused before it writes anything, then the next answer no longer reports it. With nothing else running or due, that answer is safe. When two installs overlap, the answer stays unsafe until the last of them ends.
- [ ] **AC-3 (a cut-off install isn't reported afterwards).** Given an install was cut off by a restart of the instance, as a deploy's container recreation does, when the instance is back up, then its answer doesn't report that install as running. This has an explicit automated test, as story 1's phantom exclusion does.
- [ ] **AC-4 (the check waits for an install).** Given an install is running on the instance a merge would redeploy, when the safe-to-merge check runs, then each attempt it journals is unsafe with the install's reason, and it reports safe only once the install has ended. Its numbers stay as they are (45 attempts, 60 seconds apart), which outlast an install of about 4 to 5 minutes.
- [ ] **AC-5 (nothing else changes).** With no install running, every field the answer carries today keeps its value, and its one addition, the install block, is empty. Its other consumers, the safe-to-merge check and the Scheduled Tasks panel's countdown line, behave as before. *(Amended at Architecture 2026-11-21, ADR 0004 sub-decision 2: the install block is always present, as `legacy` is, so a consumer never has to ask whether it exists.)*
- [ ] **AC-6 (the procedures say so).**
  - The safe-to-merge recipe says that installs are covered.
  - The written procedure for running an install on a deployed instance tells the person to check first that no deploy of that instance is running or queued, and says how.
  - It also says that an install that hangs keeps the answer unsafe, so the check stops at its bound, as it does for a long task, and the operator decides.
  - A new ledger row records the gap that remains: a merger whose check came just before the install started.

## Concepts touched

None. This is operational: no concept definition changes, and the answer is about the instance as a deployment, not a point of view (ADR deploy-safety-gate/0001, "POV note").

_(Architect: the local container is David's private agent-memory instance. Don't orient there. If a concept check is wanted, use staging's public `/api/concept-graph/summaries`.)_

## Out of scope

- **Other long jobs a deploy cuts off.** Lifecycle backup, restore and migrate run in a process of their own, which the answer doesn't see either. The owner kept this story to the two installs (2026-11-21). They are queued in `stories/_intake.md`, 2026-11-21.
- **Closing the gap completely.** A deploy that waits for a safe answer before it recreates the container would close it. The gate stays procedural (deploy-safety-gate's 2026-07-18 intake), so that would be a story of its own.
- **Today's install run by hand from the command line** (`node src/firmware/install.js`). No procedure uses it. It needn't be seen, but if it isn't, the procedure says so.
- **Making an install survive a deploy** (draining, or resuming where it stopped). The answer only lets a merger wait.
- **The Scheduled Tasks panel** doesn't show a running install. Its countdown line stays about scheduled tasks.
- **The sandboxes** (`feat/tags`, `feature-magic-carpet`) get the fix when their branches next take staging's changes, not in this book.
- **The local agent-memory container** isn't checked or touched.

## Open questions

For the Architect (each answered in ADR 0004):
1. **Seeing an install in a process of its own.** `lifecycle seed-firmware` run from a shell inside the instance is not the control panel's process. How is it seen without a record that outlives a restart and then reads as running (AC-3)? *Answered by sub-decision 4: the answer reads the lifecycle lock live, judged stale by the store's own rule.*
2. **One reason or two.** One reason for both installs with a detail that says which, or one reason each. *Answered by sub-decision 1: one reason, `FIRMWARE_INSTALL_RUNNING`.*
3. **Where the installer's procedure goes.** No doc in the repo describes running an install on a deployed instance today. BIBLE §7 names the route, and AGENTS.md §6 the local curl. *Answered by sub-decision 8: `docs/SAFE_TO_MERGE.md`, with a pointer from BIBLE §7.*

## Deviations

- **`install()` wraps the old body instead of re-indenting it.** The ADR has `install()` enter the count on its first line and leave in a `finally` around the rest. The body moved, unchanged, into a new internal `runInstall()`, and `install()` is now the three-line wrapper around it. That gives the same behavior with no 170-line re-indent. `runInstall()` isn't exported, so every caller still goes through `install()`.
- **A seed-firmware lock with no `startedAt` reports `startedAt: null`.** The store always writes one (`acquireLock`), so this only guards a hand-made lock file.
- **BIBLE §7's pointer is a short paragraph with two bullets, not the ADR's "one bullet".** It needed the reason, both installs and the doc's pointer, and a single bullet ran too long.
- **The new procedure section names the droplet's loopback command** (`docker exec tapestry curl … 127.0.0.1:7778/api/firmware/install`). That is how sessions run an install on staging and production. `docs/` is outside harness-lint's wiring set, so the literal port is allowed there.

## Evidence

**The scoped gate, stack-free (2026-11-21, Implementation).** It ran on `239fe71e` (the failing tests' commit), with the implementation in the working tree and committed unchanged after it. Node was 22.23.1, CI's major.

*(Review round 1, finding 4: this run predates the branch's rebase onto `94e85fe06`. Its base was `deef26702`, and its list missed five suites that read changed files. Review round 1's own run and round 2's run, below, cover the final tree.)*

**The environment** was the memory's scoped-gate recipe:
- a stub `curl` and a stub `docker` first on `PATH`;
- `BRAINSTORM_CONF_PATH` at a conf whose `NEO4J_URI` is a closed port;
- `BRAINSTORM_BASE_URL`, `TAPESTRY_API_BASE`, `MEILI_URL_HOST`, `CONCEPT_GRAPH_URL` and `REDIS_PORT` on port 9;
- `TAPESTRY_CONTAINER` unset.

**62 suites were derived from the diff:** every registered suite whose source names a changed file, or a function the change touched (`deploy-safety`, `firmware/install`, `firmware/inFlight`, `inspectLock`, `SAFE_TO_MERGE`, BIBLE, `ledger/`). `gate-result-record` came in because test files changed. `operations.test.js` ran in place of the suites under `test/operations/`.

Three were left out:
- `event-tagging-firmware-seed`, which calls `localhost:7778` whatever the environment says;
- `stack-free-npm-test`, whose G2 runs live tests when a control panel answers, so it stays CI's;
- `safe-to-merge-check`, run on its own below.

**Results:**
- **Run `20261122T021617Z-70304-eec5` (label `ds4-impl-2`): FAIL, exit 1, with 3169 passed, 3 failed and 123 skipped across 62 suites.** All three failures are `router-stream-limit-on-connect` P1–P3. There, BSD `sed` rejects the router patch's GNU `sed -i` (`invalid command code f`), which is OPEN ledger row `2026-10-09-router-patch-sed-macos`. This diff touches no script, patch or Docker file. The skips are live parts, which need a stack.
- **This story's suites** gave `deploy-safety-sees-installs` 37 of 37, and `deploy-safety-status` 17 passed with 6 live skips. `next-task-countdown` gave 24, `close-unauth-write-surface` 14, `default-deny-mutations` 14 and `admin-action-sweep-access` 13. `firmware-install-leaves-tags-once` gave 24, and `operations` 1504 passed with 20 skipped.
- **`test/safe-to-merge-check.test.js`, on its own with the system `curl`:** 17 of 17, B10 included. Its script talks only to its own `127.0.0.1` servers.

**An earlier run is not the verdict.** Run `20261122T020532Z-2714-68de` (`ds4-impl-1`) also failed `operations`, with 48 export-nostr failures: `Cannot find package 'micromark'`. The worktree had borrowed the main checkout's `node_modules` by symlink, and that tree predates the export-nostr story's dependency. `npm ci --ignore-scripts` gave the worktree its own tree from the lockfile, and the second run passed `operations` whole.

**What B10's check printed** (abridged):

```
attempt 1/10 verdict=unsafe reasons=["FIRMWARE_INSTALL_RUNNING"] raw={…"firmware":{"installCount":1,"installs":[{"install":"firmware-install",…
attempt 2/10 verdict=unsafe reasons=["FIRMWARE_INSTALL_RUNNING"] …
attempt 3/10 verdict=unsafe reasons=["FIRMWARE_INSTALL_RUNNING"] …
attempt 4/10 verdict=safe reasons=[] raw={…"firmware":{"installCount":0,"installs":[]},…}
SAFE — merge may proceed …
```

**Round 2, after review round 1's fixes (2026-11-22).** The gate ran on `2fcc8d70` (round 2's tests), with the fixes in the working tree and committed unchanged after it, on the branch rebased onto `94e85fe06`. The environment was the same.

**67 suites:** round 1's 62, plus the five the review found reading changed files:
- `suite-env-changes`;
- `rollup-scanners`;
- `harness-stats`;
- `kill-timeout-orphans-by-default`;
- `note-tagging-raw-events-inspector-ui`.

`seed-firmware.js`'s readers are under `test/operations/`, which `operations.test.js` runs.

**Results:**
- **Run `20261122T030840Z-63894-09dd` (label `ds4-round2-1`): FAIL, exit 1, with 3330 passed, 3 failed and 123 skipped across 67 suites.** The three failures are again `router-stream-limit-on-connect` P1–P3, the macOS `sed` row.
- **This story's suites:**
  - `deploy-safety-sees-installs` 42 of 42, with H10, S4 and D6–D8;
  - `deploy-safety-status` 17 passed, with 6 live skips;
  - `next-task-countdown` 24;
  - `operations` 1556 passed, with 20 skipped.
- **The harness readers:** `suite-env-changes` 18, `rollup-scanners` 33, `harness-stats` 12, `harness-lint` 85, `session-start` 32 and `ledger-row-ids` 6, each with none failed.
- **`test/safe-to-merge-check.test.js`,** on its own with the system `curl`: 17 of 17.
- **The guards, on scratch copies of the working tree:**
  - H10 fails with the store's pid-reuse line taken out;
  - S4 fails with seed-firmware's lock op renamed to `'seed'`.

**Not checked here.** There was no live check, since the local container is off-limits. The live evidence is the book's: one install on staging and one on production, each on the owner's yes, with the check run against that instance during it.

## Linked artifacts
- Book: `engineering-team/audits/deploy-safety-sees-installs/book.md`
- ADR: `engineering-team/decisions/deploy-safety-gate/0004-deploy-safety-sees-firmware-installs.md`
- Test plan: `engineering-team/stories/deploy-safety-gate/4-deploy-safety-sees-installs.test-plan.md`
- Review: `engineering-team/reviews/deploy-safety-gate/4-deploy-safety-sees-installs.md`
