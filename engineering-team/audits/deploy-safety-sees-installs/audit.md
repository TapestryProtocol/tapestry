# Build Audit: The deploy-safety answer sees a running firmware install

**Book:** `engineering-team/audits/deploy-safety-sees-installs/book.md`
**Date:** 2026-11-22
**Branch / commit range:** from `ff8ec4cce` (`staging` when the book opened) through these merges:
- TapestryProtocol/tapestry#204, `fix/deploy-safety-sees-installs`, merged into `staging` as `c43cbd7f6`;
- #206, a promotion pinned at `4dfe03d11`, merged into `main` as `64c5b40a9`.

The records and this close are on `docs/deploy-safety-sees-installs-ship-records`, branched from `main`.
**Provenance:** Acceptance-frame
**Confidence:** high. The frame was confirmed at planning, with the owner's three answers folded in. Each of its five items has evidence on both deployed instances.

> The Build Audit is the **as-built record** — what the product *is* now, factual and source-linked. It is audience-neutral: the product team reads it to scope the next phase; a future engineer reads it to understand what shipped. It does **not** propose changes — that's the addendum/seed's job.

## 1. What shipped

- **A running firmware install holds merges.** While one runs, the instance's deploy-safety answer (`GET /api/deploy-safety/status`) is unsafe with the reason `FIRMWARE_INSTALL_RUNNING`, so the safe-to-merge check waits. Both installs count:
  - today's install, through its route, from any caller, a dry run included;
  - `lifecycle seed-firmware`, through its route or from a shell, from when it takes the lifecycle lock.

  (`stories/deploy-safety-gate/4-deploy-safety-sees-installs.md`)
- **The answer says which install, and when it started,** in a new, always-present block: `firmware: { installCount, installs: [{ install, startedAt }] }`. It says nothing about who started it. (#4)
- **Nothing sticks.** The answer lets go when an install ends, however it ends: finished, failed, refused, or cut off by a restart. Today's install is counted in memory only. seed-firmware's lock is judged by the lifecycle store's own staleness rule. (#4)
- **The procedures say what to check.** `docs/SAFE_TO_MERGE.md` says installs are covered, and gains "Before a firmware install":
  - check that no deploy of that instance is running or queued;
  - an answer with no `firmware` block doesn't see installs yet, so hold merges by hand there;
  - an install that hangs, the command-line form, and the gaps that remain.

  BIBLE §7 points to it. (#4)
- **Live on staging and production,** and seen working on each during one install the owner approved. The journals are in the book's Rollout evidence.

## 2. Epics & stories rolled up

### Epic: `deploy-safety-gate`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #4 deploy-safety-sees-installs | The answer sees a running firmware install, today's or seed-firmware's, so the check waits for it | Done | `reviews/deploy-safety-gate/4-deploy-safety-sees-installs.md` |

The epic was already Done from the `deploy-safety-gate` book (stories 1–3). Story 4 joined it under this book, and the epic stays Done, as OPEN.md row 268 prescribes; see §4 and step 9 below.

**The review:**
- **Round 1, by a fresh Reviewer agent:** one blocking finding. The new procedure promised protection on instances without the story.
- **Round 2:** PASS.
- **Three fix-checks after it,** each PASS, the last with no findings. ADR 0004 Amendment 1 records round 1's fixes and the owner's ratification of its two Architect picks.

## 3. As-built inventory

**User-facing:**
- **`GET /api/deploy-safety/status`** gains the reason `FIRMWARE_INSTALL_RUNNING` and the `firmware` block. No field is renamed or removed (ADR 0004 sub-decision 2).
- **No new route, no UI change.** The check script is unchanged: it acts only on `safeToDeploy`.

**Code:**
- **`src/firmware/inFlight.js`** (new): the in-memory count. It requires nothing.
- **`src/firmware/install.js`:** `install()` enters the count first and leaves it in a `finally`. Its old body is now `runInstall()`, unchanged (story, Deviations).
- **`src/api/deploy-safety/index.js`:**
  - `computeVerdict` takes `installCount`, defaulting to 0;
  - a new exported pure function, `seedFirmwareFromLock(lock)`;
  - `handleStatus` reads both sources and adds the block.
- **Comments naming the reader** in `src/operations/catalog/lifecycle/_store.js` (`inspectLock`) and `seed-firmware.js` (at `C.begin('seed-firmware')`).

**Docs:**
- `docs/SAFE_TO_MERGE.md`: the purpose line, "What the check is", and the new section;
- `BIBLE.md` §7, Firmware Install.

**Tests:**
- `test/deploy-safety-sees-installs.test.js`: 42 tests, stack-free;
- B10 in `test/safe-to-merge-check.test.js`;
- the fifth code in `test/deploy-safety-status.test.js`'s `REASON_CODES`;
- the registry entry.

**Domain:** no concept touched, and no firmware reinstall required. The two installs this book ran were evidence, not a step the change needs.

**Ledger:**
- **Six new rows:**
  - `2026-11-22-install-starts-after-a-safe-check`;
  - `2026-11-22-overlapping-installs-share-internal-mode`;
  - `2026-11-22-brainstorm-config-ignores-conf-path` (meta);
  - `2026-11-22-reboot-can-revive-a-dead-lock`;
  - `2026-11-22-install-after-a-deploy-loses-neo4j`;
  - `2026-11-22-scheduled-task-can-start-mid-install`.
- **Closed:** `2026-11-21-deploy-safety-misses-firmware-installs`.
- **Intake:** `stories/_intake.md`, 2026-11-21, lifecycle backup, restore and migrate.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame item 1, "while either install runs" | seed-firmware counts from when it takes the lifecycle lock, not from its first line | interpretation | Before the lock it only reads the firmware's files, so a deploy then cuts off nothing (story AC-1 amended at Architecture; ADR 0004 sub-decision 4) | None: the unguarded part writes nothing | — |
| 2 | Story AC-5, "the answer is what it is today, field for field" | The new `firmware` block is always present, empty when no install runs | intentional-change | A consumer never has to ask whether the block exists, as with `legacy` (AC-5 amended at Architecture; ADR 0004 sub-decision 2) | Additive. The check script and the Scheduled Tasks panel behave as before (B1–B9, `next-task-countdown` R2) | — |
| 3 | Frame item 1, "either install", as its callers run it | Today's install run by hand from the command line (`node src/firmware/install.js`) isn't seen | deferred | No procedure uses it, and it counts in its own process (story Out of scope; ADR 0004 sub-decision 3) | Whoever uses it must hold merges by hand; the recipe says so | §6 |
| 4 | Frame item 3, "the gap that remains has a ledger row" | Docs-only installer check; the gap stays open | deferred | The owner chose docs over a deploy-side wait at planning, 2026-11-21 (story Background) | A merger who checked just before an install started can still cut it off | §6 |
| 5 | Frame item 5, "an install no longer needs the owner to hold merges" | True on staging and production, for a merge that runs the check | constraint-discovered | The gate is procedural (OPEN.md row 340). #206 itself was merged by hand while production's check answered `NEXT_FIRE_WITHIN_BUFFER`, and its deploy cut off the 06:00 `refreshSearchIndex` run, which re-ran (book, Rollout evidence, production) | A merge that skips the check isn't held, for an install or a task | §6 |
| 6 | Frame item 3, the procedure's pre-check | "No deploy running or queued" misses a deploy that has just finished | constraint-discovered | The staging evidence install began 20 s after another merge's deploy recreated the container. It lost its Neo4j-driver reads and still answered success (book, Rollout evidence, staging) | An install started right after a deploy can do half its work and say it succeeded | §6 |
| 7 | Frame item 4, "the fix reaches both" | Staging and production only; `feat/tags` and `feature-magic-carpet` lack it | deferred | The sandboxes were kept out of this book (story Out of scope) | Installs there still need merges held by hand; their answer has no `firmware` block | §6 |
| 8 | The ask, "a merge doesn't redeploy an instance in the middle of a job" | Installs only; lifecycle backup, restore and migrate aren't seen | deferred | The owner kept the story to the two installs (2026-11-21) | A deploy can still cut off a backup, restore or migration | §6 |
| 9 | — | Four smaller implementation calls, each logged in the story's Deviations: `install()` wraps `runInstall()`; `startedAt: null` for a lock without one; BIBLE's pointer as a paragraph and two bullets; the recipe names the droplet's loopback command | interpretation | Story, Deviations | None | — |

**Undocumented work:** none. Every file in the book's diff traces to the story, ADR 0004, Amendment 1, or a review round's finding. That covers the two comments, the six ledger rows, the intake entry and the records.

## 5. Quality state at close

**The test gate.** On this Mac the full `npm test` never runs, since the local container is the owner's private agent-memory instance. CI runs the full gate on each pull request.
- **CI:** #204's `stack-free` passed (run 44985132498, 21 min), and #206's passed (run 44989999320) with `main-source-guard`.
- **Scoped gates, under dead endpoints:**
  - The implementation's final 67-suite run, `20261122T030840Z-63894-09dd`: 3330 passed, 3 failed. The only failures were `router-stream-limit-on-connect` P1–P3, BSD `sed` (OPEN.md row `2026-10-09-router-patch-sed-macos`).
  - The review's runs `ds4-review-1` to `ds4-review-5`: the last, on `d475cf7e`, was PASS, 236 passed.
  - `safe-to-merge-check`, run on its own with the system `curl`: 17 of 17.
  - The close's own run over the final tree is recorded at the end of this section.

**Known open issues** (rows; see §6):
- the gap after a merger's check;
- an install right after a deploy;
- two of today's installs at once;
- a scheduled task during an install;
- a revived lock after a reboot;
- row 340.

**Debt the ADR logged** (ADR 0004, Consequences):
- **The answer depends on the lifecycle lock's file and fields.** Comments at both ends say so.
- **The reason list grew to five, and the `firmware` block is now part of the consumed contract.**
- **A hung install holds the answer unsafe** until it ends or the instance restarts.

**The close's gate run** (step 10, over the final tree). It ran the 13 suites that read what the close changed: `harness-lint`, `ledger-row-ids`, `session-start`, `rollup-scanners`, `harness-stats`, `live-link-checks`, `gate-result-record`, `suite-env-changes`, `kill-timeout-orphans-by-default`, `note-tagging-raw-events-inspector-ui`, `container-apt-refresh` and this story's two suites.
- **Run `20261122T062912Z-87503-ccd7` (label `ds4-close-1`):** PASS, exit 0, with 369 passed, 0 failed and 10 skipped across 13 suites. It ran on `835a59f0` with the close's edits in the working tree, and they were committed unchanged after it. The skips are live parts, which need a stack.

## 6. Carry-forward register

- [ ] **The gap after a merger's check.** An install that starts just after a merger's check said safe can still be cut off by that merge's deploy. Ledger row `2026-11-22-install-starts-after-a-safe-check`; its structural fix is OPEN.md row 340's shape (b), a deploy that waits for the answer. (§4 #4)
- [ ] **A merge that skips the check isn't held at all:** OPEN.md row 340, seen again at #206. (§4 #5)
- [ ] **An install started right after a deploy loses its Neo4j reads,** and still answers success. The procedure's pre-check misses a just-finished deploy, today's install doesn't check the graph answers, and Pass 2 calls a failed read "not found". Ledger row `2026-11-22-install-after-a-deploy-loses-neo4j`. (§4 #6)
- [ ] **Port story 4 to `feat/tags` and `feature-magic-carpet`.** Until then, installs there need merges held by hand. (§4 #7)
- [ ] **Lifecycle backup, restore and migrate:** the answer doesn't see them. `stories/_intake.md`, 2026-11-21. (§4 #8)
- [ ] **A scheduled task can start during a long install.** Ledger row `2026-11-22-scheduled-task-can-start-mid-install`.
- [ ] **Two of today's installs at once break each other.** Ledger row `2026-11-22-overlapping-installs-share-internal-mode`.
- [ ] **After a droplet reboot, a cut-off lifecycle lock can read as live.** Ledger row `2026-11-22-reboot-can-revive-a-dead-lock`.
- [ ] **Today's install run from the command line isn't seen.** The recipe says so. (§4 #3)

**Ticked elsewhere at this close:** `audits/deploy-safety-gate/audit.md` §6, "First prod/tags promotion hits the endpoint-404 fail-closed stop". Production and tags both serve the endpoint, as read 2026-11-22.

## 7. Process findings (harness)

**Measurement** (`scripts/harness-stats.sh`, run 2026-11-22):
- this book open 1 day, and story 4 from story to review the same day;
- 359 reviews decided overall, at a 0% kick-back rate (CR-final ÷ decided).

Story 4's round 1 asked for changes, but its final review is PASS, so it adds no CR-final.

| Finding | Source | Terminal state |
|---|---|---|
| The scoped gate's hand-built suite list missed five readers of changed files: `test/registry.js`, `stories/_intake.md` and the new book. Ports to the Direction flow, which runs the same gate. | Review round 1, Harness friction 1 | OPEN.md row `2026-11-21-scoped-gate-lists-built-by-hand` (existing; dated "seen again" note added at this close) |
| `brainstormConfig` ignores `BRAINSTORM_CONF_PATH`, so a dead conf doesn't switch the task queue off, and ADR 0004's first testing note assumed it did | Review round 1, Harness friction 2 | OPEN.md row `2026-11-22-brainstorm-config-ignores-conf-path` (filed in this book) |
| The worktree borrowed the main checkout's `node_modules` by symlink. The tree lagged the lockfile (`micromark`), giving 48 false `operations` failures. | Implementation, first gate run | declined: a machine-local practice, not a repo rule. Nothing in the repo prescribes the symlink. It's recorded in the operator's agent memory (the scoped-gate note): run `npm ci --ignore-scripts` in the worktree |
| A merge made by hand skipped the check while it answered unsafe, and its deploy cut off a scheduled run. This is row 340's class, and it holds in both flows. | Rollout, #206 | OPEN.md row 340 (existing; "Seen again on 2026-11-22" added at this close) |
| `/cycle-staging` has no entry for "the PR is already open, merge it". The session entered at step 4 by hand. | Rollout, #204 | OPEN.md row 340, fix shape (d) (existing) |
| zsh's `:t` modifier mangled `39998:$FULL:tag` in a shell read | Rollout, staging checks | OPEN.md row 237 (existing; same class) |
| A tool input decoded a typed backslash-u escape into a raw quote, which broke a shell command | ADR amendment edit | declined: a tool quirk with no repo harness surface. It's in the operator's agent memory; the edit was redone with the Edit tool |
| The Reviewer's own suggested wording carried two slips into round 2's text ("H8 first", the flag's readers). The fix-checks caught both. | Review rounds 2–3 | declined: `roles/reviewer.md` step 10 ("check every fix as a fresh claim — your own suggested wording included") worked as designed; no change |
| A fresh Reviewer agent, given the artifacts and not the session's conclusions, found the one blocking issue the author had missed | Review round 1 | declined: no change. The harness already allows it, and the practice is noted here |

**Epic close-out (step 9).** `deploy-safety-gate`'s four stories are all Done, and its branch has merged into `staging` and `main`. The epic stays Done, and its folders stay outside `done/`. It may take more stories: the carry-forward's gap and deploy-side wait are its natural next ones. That follows OPEN.md row 268's lesson and the `security-auth-exposure` precedent.
