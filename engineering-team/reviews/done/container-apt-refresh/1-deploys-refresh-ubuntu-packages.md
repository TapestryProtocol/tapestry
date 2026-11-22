# Review: Story 1 — Every build of the tapestry image brings its Ubuntu packages up to date at least once a week

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-21
**Diff:** `git diff origin/staging...HEAD` at `3fe3b606c`: 23 files, +1401 −11. The base is `b262a8c18`, where the
branch left `staging`. The range holds four commits:
- `3a831031a`: the story;
- `e99166177`: ADR 0001;
- `557bde2d3`: the test plan, `test/container-apt-refresh.test.js` and its line in `test/registry.js`;
- `3fe3b606c`: the implementation:
  - the Dockerfile's refresh step, the compose argument, the five workflows;
  - OPERATIONS.md, `docs/SAFE_TO_MERGE.md` and the two cycle skills;
  - the CHANGELOG row, four ledger rows and the story's Deviations.

  It touches no test file.

**Against:**
- the story, [1-deploys-refresh-ubuntu-packages.md](../../../stories/done/container-apt-refresh/1-deploys-refresh-ubuntu-packages.md),
  with its Deviations;
- [ADR 0001](../../../decisions/done/container-apt-refresh/0001-weekly-package-refresh-after-the-cached-steps.md);
- the [test plan](../../../stories/done/container-apt-refresh/1-deploys-refresh-ubuntu-packages.test-plan.md);
- the Implementer's records in the ignored `tmp/container-apt-refresh/`.

**How it was made.**
- **The gate.** The Reviewer ran it itself, stack-free, twice:
  - on the branch merged with today's `staging` (`cae6e1cb2`), as a trial merge commit `6fb67e964` that no ref points
    to and that was never pushed;
  - on `staging` alone, for the baseline.

  `staging` has moved 85 files since the branch point. None of them is a file this diff changes, and `git merge-tree`
  merges the two cleanly.
- **What it never ran.** `npm test`, Playwright, or anything that reaches the `tapestry` container, SSH or a hosted
  instance.
- **Its probes.**
  - Throwaway `docker run --rm` containers from `ubuntu:jammy-20260509`, with no mounts or ports.
  - Read-only `gh` calls: the latest staging and production deploy runs, and one staging deploy log.
- **The records** are in the ignored `tmp/review-container-apt-refresh/`.
- **No independent check.** The independent check before the commit (workflow 5, P13) wasn't applied.

**Verdict:** CHANGES_REQUESTED, with two blocking findings and three non-blocking ones. All five are in the docs, the
ADR, the step's printed count or a comment. The step, the compose file, the workflows and the tests do what the ADR
says.

## Quality gates (run by reviewer, not trusted)

- [ ] **The full gate** (`npm test`) was not run. On this Mac the local stack is the owner's live agent-memory
  instance, and the full suite writes to it. CI's `stack-free` job runs it on the pull request.
- [x] **The scoped gate, derived from the final diff** (ledger row `2026-11-21-scoped-gate-lists-built-by-hand`).
  - **What it ran.** Every registered suite whose source names a file this diff changes, plus the two that scan every
    test file: 42 suites (`tmp/review-container-apt-refresh/derive-gate.js`, `derive.log`). They are
    `gate-result-record`, `stack-free-npm-test`, `task-queue-bullmq`, `task-queue-neo4j-resource-class`,
    `entrypoint-template-rendering`, `bullboard-admin-access`, `admin-tools-dashboard-panel`, `create-tapestry`,
    `reconciliation-incremental-mode`, `generalized-task-scheduler`, `reconciliation-rearchitecture`,
    `task-queue-semaphore-protection-audit`, `tagging-raw-event-inspector-ui`, `note-tagging-raw-events-inspector-ui`,
    `harness-lint`, `harness-stats`, `session-start`, `ledger-row-ids`, `rollup-scanners`, `ci-test-job`,
    `workflow-hardening`, `safe-to-merge-check`, `neo4j-query-public-reads`, `router-stream-limit-on-connect`,
    `tapestry-per-concept-detail-views`, `operational-direction`, `stamped-composite-avatar`, `site-trust-signals`,
    `llms-txt`, `information-for-agents`, `live-link-checks`, `neo4j-sizing-override`, `brains-launcher-repo`,
    `honest-publish-reporting`, `honest-publish-reporting-ci-guard`, `tagging-edges-wiring`,
    `tagging-edges-realtime-resilience`, `openapi-coverage`, `operations` (every suite under `test/operations/`),
    `external-cli`, `word-elements-fit-the-installed-word-schema` and `container-apt-refresh`.
  - **Left out:** `event-tagging-firmware-seed`, which calls `localhost:7778` whatever the environment says.
  - **The test plan's own list** named 8 of these. The other 34 name a changed file in their source too, most often
    OPERATIONS.md, the workflows folder, the skills or the ledger. A name in a comment counts, so some of them only
    cite the file.
  - **The environment.** Stub `docker` and `curl` first on `PATH`, `BRAINSTORM_CONF_PATH` at a conf whose `NEO4J_URI`
    is a closed port, and `BRAINSTORM_BASE_URL`, `TAPESTRY_API_BASE`, `TAPESTRY_PORT`, `NEO4J_URI` and
    `MEILI_URL_HOST` on dead ports. `TAPESTRY_CONTAINER`, `TAPESTRY_CONTAINER_PORT` and
    `TAPESTRY_LIVE_DOCKER_CHECKS` were unset (`tmp/review-container-apt-refresh/review-gate.sh`).

  The merged tree's `npm run gate:status -- --label review-car-merged` line:

  ```
  20261121T153702Z-53052-fa3f [review-car-merged] started 2026-11-21T15:37:02.120Z on 6fb67e96 — FAIL, exit 1, 2475 passed, 10 failed, 98 skipped, 42/42 suites; failed: safe-to-merge-check, router-stream-limit-on-connect · <scratchpad>/review-merged/tmp/gate-runs/20261121T153702Z-53052-fa3f.json
  ```

  `staging` alone, the same 41 suites without `container-apt-refresh`
  (`npm run gate:status -- --label review-car-base`):

  ```
  20261121T154738Z-67153-1210 [review-car-base] started 2026-11-21T15:47:38.154Z on cae6e1cb — FAIL, exit 1, 2455 passed, 10 failed, 94 skipped, 41/41 suites; failed: safe-to-merge-check, router-stream-limit-on-connect · <scratchpad>/review-base/tmp/gate-runs/20261121T154738Z-67153-1210.json
  ```

  - **The 10 failures** are the two suites that always fail on this Mac, and neither comes from this branch:
    - `safe-to-merge-check`, 7 of its B tests, which time out behind the stub `curl`. Run alone with the real `curl`,
      whose only target is the suite's own server on 127.0.0.1, it passes. On the merged tree, with the stub
      `docker` kept, its run `20261121T155648Z-59899-fe60` [review-car-stm-alone] recorded `PASS, exit 0, 16 passed,
      0 failed, 0 skipped, 1/1 suites`.
    - `router-stream-limit-on-connect` P1–P3, which need GNU `sed` (ledger row `2026-10-09-router-patch-sed-macos`).
      Its D1–D3, which read the Dockerfile, pass.
  - **Against `staging` alone, suite by suite** (`compare-runs.js`, `compare.log`): the 41 shared suites have the
    same pass, fail and skip counts, with no new failure. The merged tree adds only `container-apt-refresh`'s
    20 passes and 4 skips: 2475 = 2455 + 20, and 98 = 94 + 4.
  - **`container-apt-refresh`** on the merged tree: 20 passed, 0 failed, 4 skipped (L1–L4, off).
- [x] **The live checks**, run by the Reviewer from the branch (`TAPESTRY_LIVE_DOCKER_CHECKS=1`, through the gate
  engine, with the real `docker`; `review-live.sh`). L1–L4 pass. They use `docker run --rm` only, with no compose,
  ports or volumes. The `+dirty` is this review's uncommitted files, none of which the suite reads.

  ```
  20261121T155841Z-61487-1240 [review-car-live] started 2026-11-21T15:58:41.574Z on 3fe3b606+dirty — PASS, exit 0, 24 passed, 0 failed, 0 skipped, 1/1 suites · tmp/gate-runs/20261121T155841Z-61487-1240.json
  ```
- [x] **`bash scripts/harness-lint.sh`** on the branch: `harness-lint: clean (0 violations)`.
- [x] **R1. The Dockerfile hunk** (`@@ -93,6 +93,26 @@`) adds 20 lines between the nip50-proxy `npm install`
  (`Dockerfile:94`) and `# Now copy the full application code` (`:116`). It changes and removes nothing, so no step
  above it is rebuilt.
- [x] **R2, read from the Implementer's records, not run again.** A first build here takes 20–30 minutes.
  - `r2-a.log` (week 47) ran the step: `packages refresh 2026-W47: 105 to upgrade`.
  - `r2-b.log` (week 48) took steps 2–21 from cache and ran the step again, again 105 to upgrade.
  - `r2-c.log` (a code-only change, week 48) took the step from cache: `Step 22/34` is followed by `Using cache`.
  - All three ran on this Mac's legacy builder (`Step n/34`, `Using cache`), not on BuildKit, which the droplets use.
    See blocking 1.
- [ ] _Playwright: no UI. Lint, typecheck and build: not configured._

## Spec adherence

- [x] **AC-1, weekly freshness.** D1, D3, C1, W1 for all four workflows, P1 and L1 pass. W1 runs each deploy script
  and reads the `PACKAGES_REFRESH` that the stub `docker` was given, an ISO week. P1 runs the week step. L1 brings a
  2026-05-09 base up to date and leaves nothing waiting.
- [x] **AC-2, the marker.** D5 (outside every volume of both compose files) and L1 (the marker's three lines) pass.
- [x] **AC-3, nothing else moves.** D4 and L3 pass. In L3 the upgrade is made to move a stand-in `nodejs`, so the
  guard is tested, not assumed. L1 keeps both stand-ins as they were. APOC and GDS loading on staging is S2, after the
  merge.
- [ ] **AC-4, deploy time and failure.**
  - D2, D6, W2 for all four workflows, L2 and L4 pass.
  - The time: 47 s here (R2), and the ADR's measured table. S1 on staging, after the merge.
  - "An operator can tell before merging whether a deploy will refresh": the docs' rule misses one kind of deploy.
    See blocking 2.
- [ ] **AC-5, docs and the note.**
  - O1–O4 pass.
  - Recipe 1 of the by-hand section says something that doesn't hold on the droplets. See blocking 1.
  - The note for tags and magic-carpet belongs to the pull request (R3), which doesn't exist yet. See "For the pull
    request" below.
- [x] **No criterion is dropped, and nothing is added beyond the story.** The `set -euo pipefail` that the staging and
  magic-carpet scripts gain is in the ADR's Decision, and AC-4's red run needs it.

## ADR adherence

- [x] **The Dockerfile step** (`Dockerfile:101–114`) is the ADR's shape (ADR:203–216) word for word. Its comment
  (`:96–100`) adds three clauses: the heavy steps stay cached, the build fails if Node or Neo4j moves, and the marker
  says when. It sits where the Implementation notes put it.
- [x] **The compose file** is the ADR's block. Its comment adds "and a local build leaves it empty".
- [x] **The four deploy workflows.**
  - Each sets `export PACKAGES_REFRESH="$(date -u +%G-W%V)"` with its comment, just before
    `docker compose up -d --build`.
  - Staging's and magic-carpet's scripts open with `set -euo pipefail` and production's comment, and
    `git checkout -- docker-compose.yml 2>/dev/null` gains `|| true`.
  - Actions, `permissions`, `environment` and `command_timeout` are unchanged.
- [x] **`publish-image.yml`.**
  - The `commit` step is renamed and also writes `week=`.
  - The Tapestry build passes it as `build-args`.
  - The search image, the triggers, the tags, the four `type=gha` lines and the roll are untouched.
- [x] **The docs.** §3's paragraph, §3.1's three recipes, the §6.3 pointer, both "Last updated" lines, the
  SAFE_TO_MERGE section and the two skills' sentence are all there.
- [x] **The records.**
  - The CHANGELOG row is in the same commit as the workflow and skill edits, `3fe3b606c` (lint L10).
  - The ADR's follow-ups are four ledger rows, which is where OPEN.md now puts new rows.
- [x] **The option name.** `APT::Get::Always-Include-Phased-Updates` is in jammy's `libapt-pkg` (apt 2.4.14,
  re-checked). The story's Deviations say why `apt.conf(5)` couldn't be read.
- [x] **No new dependency.** `js-yaml` was already one.
- [ ] **The ADR's own text** carries the two claims the blocking findings correct: recipe 1 "lasts" (ADR:263–265),
  and how to tell a refreshing deploy beforehand (ADR:167–170). So both fixes amend the ADR as well as the docs.

## Concept-graph integrity

- [x] No concept, handle or firmware file is touched, so no firmware reinstall (ADR, Consequences).

## Things tests can't catch

- [x] **No secrets.** The diff adds no key, and the workflows' `secrets.*` references are unchanged.
- [x] **No debug logging or commented-out code.** The step's `echo` is its intended log line.
- [x] **Error paths.**
  - The step stops at its first failure (`set -eu`). L2 shows an unreachable archive failing the step
    (`--error-on=any`), and L3 shows the guard failing it.
  - The count's pipe hides a failed simulation, which does no harm: the real upgrade comes next and fails loudly.
- [x] **Concurrency.** The deploy concurrency groups are unchanged. The week is read once per deploy, so a deploy
  across Monday 00:00 UTC is one refresh (test plan).
- [x] **Security.**
  - `PACKAGES_REFRESH` reaches only quoted `echo` and `printf` arguments and a compose interpolation, so it has no
    path to injection.
  - Recipe 3 runs as root in the container, by hand, on David's yes.
  - The marker isn't served over HTTP (ADR, Out of scope).
- [x] **The new fail-fast on staging and magic-carpet.** Any failing command in those scripts now fails the deploy,
  a `git pull` that can't fast-forward among them. Production's and tags' scripts have run this way since 2026-05-27.

## House rules check

- [x] Concept Graph API authority: nothing in this diff reads a concept.
- [x] No new lint, typecheck or build tooling.

## Findings

### Blocking

1. **`OPERATIONS.md:147–148`: recipe 1 says a by-hand refresh "lasts" and that "the next deploy that week runs the
   step once more". On staging and production the next deploy usually undoes it.**

   **Why.**
   - **The droplets build with BuildKit.** Staging's deploy of 2026-11-21 06:53 UTC (run 44877650711) logs
     `#9 [tapestry  1/27] FROM docker.io/library/ubuntu:22.04@sha256:…` and 16 `CACHED` lines, and no `Using cache`.
   - **BuildKit keeps a built step as a build-cache record.** `docker image prune` removes dangling images only. Build
     cache has its own prune command, and BuildKit's own collection clears it only when it grows too big or too old
     (Docker docs, [Prune unused Docker objects](https://docs.docker.com/engine/manage-resources/pruning/) and
     [Build garbage collection](https://docs.docker.com/build/cache/garbage-collection/)). So recipe 1's
     `docker image prune -f` leaves in place the record of the week's first refresh. Each deploy that reuses it marks
     it used again.
   - **The next deploy hits that record.** It passes the plain week. If nothing above the step has changed, that is
     the key of the week's first refresh. So the step comes from cache, and the container is recreated on that older
     package set. The marker goes back to that refresh's time too.
   - **The step runs once more only** when no deploy has refreshed that week, which is what the doc describes.

   **How often.** From Monday 2026-11-16 00:00 UTC to this review, staging had 90 successful deploys and production
   18. So by the time an operator reaches for recipe 1, the week's first refresh has nearly always
   run, and the next merge undoes recipe 1 within hours. A fix that recipe 1 rushes out is then gone until Monday's
   refresh, and the deploy log doesn't say so: the step just shows `CACHED`.

   **Why the checks missed it.** R2 ran on this Mac, whose Docker (29.2.1) has no buildx, so `docker build` and
   compose here use the legacy builder. Its cache is the image chain itself, which recipe 1's prune does remove. And
   no check ran recipe 1 followed by a plain-week build. The finding rests on staging's log and Docker's documented
   cache model; BuildKit isn't available here to reproduce it.

   **The same claim** is in the ADR's Implementation notes, recipe 1: "It takes a few minutes, and lasts"
   (ADR:263–265).

   **Asked change: pick one at this gate.**
   - **(a) Say what happens.** Recipe 1 lasts only until the next deploy, unless no deploy has refreshed yet that
     week, because a later deploy that week reuses the week's earlier refresh. Amend the ADR's recipe-1 note to match.
     If the docs then name a way to keep a mid-week refresh, check it first:
     - **Recipe 2 is the likely one.** When its `--pull` fetches a newer `ubuntu:22.04`, later deploys, which don't
       pull, build on that base. So they reuse recipe 2's new steps.
     - **What isn't checked here.** When `--pull` finds no newer base, BuildKit holds two records for the first
       package step's key, and which one a later build takes hasn't been checked.
   - **(b) Make recipe 1 last.** For example, the deploy scripts could add to the week a suffix that recipe 1 writes
     to a file on the server, so the deploys after it reuse its step. That changes the four workflows and W1's
     expectation, so it needs an ADR amendment and a test plan amendment.

   The Reviewer suggests (a). It stays inside the ADR's design and intake answer 2 (packages refresh at deploys, with
   a refresh by hand the exception), and recipe 2 is likely to make a refresh stick already.

2. **`OPERATIONS.md:102–103` and `:114–116`, `docs/SAFE_TO_MERGE.md:62–63` and `:71–78`: the docs say that only the
   week's first deploy refreshes, and that "every later deploy that week finds the step cached". Some later deploys
   refresh too.**

   **Why.**
   - **The step comes after the three npm steps** (`Dockerfile:85–94`) and every step above them. A deploy that
     changes one of those misses the cache there, and every later step runs again, the refresh included. The ADR's
     Context says so: "A changed step also rebuilds every step after it."
   - **So a mid-week deploy refreshes** if it changes any of:
     - `package.json` or `package-lock.json`;
     - `ui/package.json` or `ui/package-lock.json`;
     - `nip50-proxy/package.json`;
     - a file under `patches/strfry-redis/` or `patches/strfry-router/`;
     - the Dockerfile above its line 96.
   - **R2 showed only the converse:** a code-only change keeps the step cached.

   **Why it matters.**
   - Those deploys are already the slow ones, the cycle skills' "~2m+ when `package.json` or other invalidating files
     change".
   - The refresh adds one to three minutes on top. So these are the deploys where SAFE_TO_MERGE's "merge right after
     the safe verdict" matters most.
   - On `staging`, 6 first-parent merges since 2026-08-21 changed one of those files. The latest is today's #183, which
     added micromark. A seventh, #39, changed the Dockerfile only below the step.
   - AC-4 asks that an operator can tell before merging whether a deploy will refresh, and so does the book's
     acceptance frame.

   **Asked change.** Name this second case wherever the docs say which deploy refreshes and how to tell beforehand:
   - OPERATIONS.md §3, "Which deploy refreshes" and "How to tell beforehand";
   - SAFE_TO_MERGE.md, "A refreshing deploy";
   - the ADR's Consequences, ADR:167–170, by amendment.

   The skills can stay as they are: they already flag those deploys as slower, and they point to SAFE_TO_MERGE.md.

### Non-blocking

1. **`Dockerfile:107`: the count comes from a different command than the upgrade.**
   - **The mismatch.** The simulation, `apt-get $only_ubuntu -s full-upgrade`, runs without the upgrade's
     `--no-remove` and `-o APT::Get::Always-Include-Phased-Updates=true` (`:109`).
   - **Its effect.** In a week when Ubuntu is phasing an `-updates` package the image has, the simulation can defer it
     while the upgrade installs it. Then `n` counts low. `n` is printed as "N to upgrade" and written as `upgraded=`,
     which OPERATIONS.md:118 calls "the number of packages it upgraded".
   - **The evidence.**
     - In a jammy container apt does evaluate phasing: `apt-cache policy` shows `(phased 40%)`
       (`tmp/review-container-apt-refresh/phasing-check7.log`).
     - Today's lists hold 37 phased entries, all NVIDIA packages the image doesn't have. So today the two counts
       agree, 41 and 41 (`phasing-check.log`, same folder).
     - `^Inst` also counts a newly installed dependency as well as an upgrade.
   - **Optional improvement.** Give the simulation the upgrade's own options, or say in §3 that the count is the
     simulation's.
2. **`docs/SAFE_TO_MERGE.md:78`: "Use … `deploy-tags.yml` for tags".** Tags' deploys don't refresh until `feat/tags`
   takes this change (OPERATIONS.md §3, "The sandboxes"). Until then the check says a tags deploy refreshes when it
   won't. Optional improvement: add "once `feat/tags` has the step".
3. **`test/registry.js:427`: the comment says "Its live checks (L1–L3)".** The suite has four, L1–L4. It's the
   Tester's line, so the Tester's fix.

### For the owner to decide at this gate

- **Blocking 1's fix:** (a) or (b) above. The Reviewer suggests (a).
- **Whether the non-blocking findings are fixed in the same round.**

### For the pull request

These aren't findings in the diff. They are what the PR to `staging` needs to say (R3, and the merge's side effects):
- **The note for tags and magic-carpet now.** It covers recipe 3 of §3.1, run only on David's yes. It says a full
  rebuild (recipe 2) is unsafe on magic-carpet, whose Dockerfile clones strfry's default branch (verified:
  `origin/feature-magic-carpet:Dockerfile:22`). Its patch script dates from 2026-04-11, before the loud-failure fix of
  2026-05-04 (`ce4a82360`).
- **The merge rolls the brains.** This diff changes the `Dockerfile` and `publish-image.yml`, both in
  `publish-image.yml`'s `paths`. So merging it builds a refreshed brain image and moves every brain on tapestry.ninja
  onto it.
- **The merge's staging deploy refreshes, whatever the week.** The step is new to staging's cache. It catches up from
  staging's cached package step, which is likely small: staging's NGINX was `14.24` on 2026-11-20. SAFE_TO_MERGE's
  advice for a refreshing deploy applies to that merge.
- **After the merge:** S1 from staging's deploy log, and S2 on David's yes.

### Harness friction

1. **Docker cache checks on this Mac don't show what the droplets do.** This Mac's Docker has no buildx, so
   `docker build` and compose here use the legacy builder, while the droplets build with BuildKit. The test plan's R2
   expects BuildKit's `CACHED`, and the Implementer read `Using cache` instead. The real gap is that the two builders
   keep their caches differently, which is how blocking 1 got through. New row: OPEN.md row
   `2026-11-21-local-docker-builds-skip-buildkit` (meta).
2. **The test plan's scoped gate was built by hand**, 8 suites where the diff derives 42. This happened again under
   the existing row `2026-11-21-scoped-gate-lists-built-by-hand`, so it gets no new row.

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place. *(Not this round.)*
- [ ] Completion detection. *(Not this round.)*

## Verdict

**CHANGES_REQUESTED.**

- The refresh step, its place in the Dockerfile, the compose argument, the five workflows and the tests match the ADR
  and pass.
- Two doc claims that operators and agents will act on are wrong on the droplets:
  - a by-hand refresh usually doesn't last past the next deploy (blocking 1);
  - the rule for telling a refreshing deploy misses deploys that change a step above the refresh (blocking 2).
- Both are fixes in prose, plus an ADR amendment. If the owner picks (b) for blocking 1, it also changes the
  workflows and W1.

Kick back to Implementation with blocking 1 (the owner's choice of fix) and blocking 2, and the non-blocking ones if
the owner wants them in the same round. Non-blocking 3 is the Tester's.

## Round 2 — 2026-11-21 (HEAD `a9a7470de`)

**The owner's answer at round 1's gate:** "Fix all, option (a)".

**The diff since round 1:** `git diff a95898f26..a9a7470de`, 7 files, +161 −15, in three commits:
- `d24924d78`: ADR Amendment 1, which records option (a) and the three changes;
- `f1aefa98f`: D7, O5 and O6, the registry comment and the test plan's Amendment 1;
- `a9a7470de`: the fixes in the Dockerfile, OPERATIONS.md and `docs/SAFE_TO_MERGE.md`. It touches no test file.

**How it was made.** As round 1, with each fix checked as a fresh claim. The temporary trees were the trial merge and
`staging` again, plus a tree at `f1aefa98f`, all in the scratchpad and since removed.

### Gates (run by the reviewer at `a9a7470de`)

- [x] **The scoped gate**, derived again from the final diff. It gives the same 42 suites as round 1
  (`derive-r2.log`), with the same environment (`review-gate-r2.sh`).
  - **`staging` has moved** to `25078cf9c`, by two story files and two ledger rows. None of them is a file this diff
    changes, and the two merge cleanly, as trial merge `0bdbe9816`, never pushed.
  - **The merged tree**, `npm run gate:status -- --label review-car-r2-merged`:

    ```
    20261121T162057Z-9879-2535 [review-car-r2-merged] started 2026-11-21T16:20:57.071Z on 0bdbe981 — FAIL, exit 1, 2478 passed, 10 failed, 98 skipped, 42/42 suites; failed: safe-to-merge-check, router-stream-limit-on-connect · <scratchpad>/review-merged/tmp/gate-runs/20261121T162057Z-9879-2535.json
    ```
  - **`staging` alone**, `--label review-car-r2-base`:

    ```
    20261121T163105Z-5575-15b5 [review-car-r2-base] started 2026-11-21T16:31:05.919Z on 25078cf9 — FAIL, exit 1, 2455 passed, 10 failed, 94 skipped, 41/41 suites; failed: safe-to-merge-check, router-stream-limit-on-connect · <scratchpad>/review-base/tmp/gate-runs/20261121T163105Z-5575-15b5.json
    ```
  - **Against `staging` alone, suite by suite** (`compare-r2.log`). The 41 shared suites have the same pass, fail and
    skip counts, with no new failure. The merged tree adds only `container-apt-refresh`'s 23 passes and 4 skips:
    2478 = 2455 + 23, and 98 = 94 + 4.
  - **The 10 failures** are round 1's two suites, unchanged: `safe-to-merge-check` behind the stub `curl`, and
    `router-stream-limit-on-connect` P1–P3 on BSD `sed`.
- [x] **`safe-to-merge-check` alone** on the merged tree, with the real `curl`: run `20261121T163121Z-6763-bb33`
  [review-car-r2-stm-alone] recorded `PASS, exit 0, 16 passed, 0 failed, 0 skipped, 1/1 suites`.
- [x] **The live checks** on the changed step, run by the reviewer (`review-live-r2.sh`). L1–L4 pass. The `+dirty`
  is this round's uncommitted review file.

  ```
  20261121T164130Z-95335-e3cc [review-car-r2-live] started 2026-11-21T16:41:30.036Z on a9a7470d+dirty — PASS, exit 0, 27 passed, 0 failed, 0 skipped, 1/1 suites · tmp/gate-runs/20261121T164130Z-95335-e3cc.json
  ```
- [x] **The new tests fail without their fixes.**
  - At `f1aefa98f`, in a tree of that commit, the suite gives `20 passed, 3 failed, 4 skipped`. The three failures
    are D7, O5 and O6, on their contract assertions, as the test plan's Amendment 1 says.
  - The six mutation probes each take one fix back out (`mutate-round1.js`, run again by the reviewer). D7, O5 or O6
    catches every one, and every file comes back byte for byte (`mutate-round2-review.log`).
- [x] **`bash scripts/harness-lint.sh`**: `harness-lint: clean (0 violations)`.

### Round 1's findings, re-checked

1. **Blocking 1, recipe 1: fixed, with option (a)** (`OPERATIONS.md:159–164`). Each claim, checked again:
   - **"It lasts until the next deploy."** Both targets with the step build with BuildKit. Staging's run 44877650711
     and production's 44880067110 each log 16 `CACHED` lines and no `Using cache`. Docker's docs say
     `docker image prune` leaves the build cache alone, so the next plain-week deploy finds the week's earlier
     refresh.
   - **"If none has, the next deploy runs the step again."** With no record under the plain week's key, the step
     misses the cache.
   - **"A fix that can't wait for next week's refresh needs this recipe again after each deploy that week."** This
     follows from the two cases.
   - **The rest of the fix.** ADR Amendment 1, item 1, says the same, and O6 holds the doc's claim. One slip remains:
     round 2's non-blocking 1.
2. **Blocking 2, the deploy that changes a step above the refresh: fixed** (`OPERATIONS.md:102–112` and `:123–128`,
   `docs/SAFE_TO_MERGE.md:63–68` and `:86–91`).
   - **The list in §3 is complete.** It is every `COPY` above the step (`Dockerfile:19`, `:20`, `:85`, `:89` and
     `:93`) plus the Dockerfile itself. The base image changes only when it is pulled, which a deploy doesn't do.
   - **The documented command works.** `gh pr diff 183 --repo TapestryProtocol/tapestry --name-only` lists
     `package.json` and `package-lock.json`. That was today's dependency change.
   - **The rest.** ADR Amendment 1, item 2, amends Consequences, and O5 holds both docs.
3. **Non-blocking 1, the count: fixed** (`Dockerfile:107`).
   - The simulation now takes the upgrade's own `--no-remove` and
     `-o APT::Get::Always-Include-Phased-Updates=true` (`:109`).
   - ADR Amendment 1, item 3, shows that line exactly, apart from its indent.
   - The marker's line (`OPERATIONS.md:130`) says "installed or upgraded", which is what `^Inst` counts. D7 holds the
     options.
4. **Non-blocking 2, tags: fixed** (`docs/SAFE_TO_MERGE.md:83–84`).
5. **Non-blocking 3, the registry comment: fixed** in the Tester's commit (`test/registry.js:427`, "L1–L4").

### Findings

#### Blocking

None.

#### Non-blocking

1. **`OPERATIONS.md:160–162`: recipe 1's first case says the next deploy "reuses" the week's earlier refresh.**
   - **The slip.** A next deploy that changes a step above the refresh runs the step again instead (§3, lines
     105–111). So its packages are as new as that deploy, not older.
   - **Which way it errs.** The doc's direction is the safe one: it never promises a fix that the deploy then drops.
     But it contradicts §3's own list a few lines up.
   - **Optional improvement.** Add "unless that deploy changes a step above the refresh (§3), which runs the step
     again".

### Harness friction

None new. Round 1's two rows still stand.

### On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed. The result is in the chat, not in this file.

### Verdict

**PASS.**

- Every round-1 finding is fixed as asked, with the owner's option (a), and each fix holds as a fresh claim.
- The scoped gate on the merge with today's `staging` matches `staging` alone, suite by suite, and the live checks
  pass.
- One non-blocking slip in the new prose remains, for the owner to fix now or leave.

## Round 2 fix check — 2026-11-21 (HEAD `753dac05a`, not a round)

**The owner's answer at round 2's gate:** "Fix the nit first". This checks only `753dac05a`: 3 files, +7 −4.

### The fix

- **`OPERATIONS.md:162`.** Recipe 1's first case now names its exception: "a deploy that changes a step above the
  refresh (§3), which runs the step again". That matches §3's list (`:105–111`) and the cache rule behind it.
- **`OPERATIONS.md:164–165`.** The recipe is needed again only "after each later deploy that week whose log doesn't
  print `packages refresh`". Under BuildKit a cached step shows only `CACHED`. A step that runs prints its own echo,
  `packages refresh <week>: <n> to upgrade` (`Dockerfile:108`). So the log tells the two apart.
- **ADR Amendment 1, item 1,** and the ledger row `2026-11-21-local-docker-builds-skip-buildkit` say the same.

### Gates

- **The fix's readers.** The suites that read OPERATIONS.md, as text: the 13 in round 2's list plus
  `operations/lifecycle/tapestry-key-paths` and `operations/lifecycle/backup-job`, run alone. The other suites under
  `test/operations/` only read `docs/GRAPH_OPERATIONS_CATALOG.md`. Same environment as round 2
  (`review-fixcheck.sh`), on the committed HEAD:

  ```
  20261121T172604Z-46115-40c1 [review-car-fixcheck] started 2026-11-21T17:26:04.748Z on 753dac05 — FAIL, exit 1, 286 passed, 3 failed, 4 skipped, 15/15 suites; failed: router-stream-limit-on-connect · tmp/gate-runs/20261121T172604Z-46115-40c1.json
  ```

  - The three failures are `router-stream-limit-on-connect` P1–P3, which fail on BSD `sed`, as in every run here.
  - `container-apt-refresh` gives 23 passed and 4 skipped, with O6 still passing on the new text.
  - `tapestry-key-paths` passes 20 and `backup-job` 17.
- **`bash scripts/harness-lint.sh`:** clean.
- **`staging`** is still `25078cf9c`, so round 2's merged run stands.

### Findings

None.

### Verdict

**PASS.** The nit is fixed, and the fix's text holds as a fresh claim.
