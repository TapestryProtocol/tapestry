# Build Audit: Deploys keep the tapestry image's Ubuntu packages current

**Book:** `engineering-team/audits/container-apt-refresh/book.md`
**Date:** 2026-11-21
**Branch / commit range:** `b262a8c18..6eedffeb6`, 11 commits on `feat/container-apt-refresh`, merged into `staging` at
`2a812f7e3` (TapestryProtocol/tapestry#188, by David, 2026-11-21 18:31 UTC):
- `3a831031a`: the story;
- `e99166177`: ADR 0001;
- `557bde2d3`: the failing tests;
- `3fe3b606c`: the implementation;
- `a95898f26`: review round 1, CHANGES_REQUESTED;
- `d24924d78`: ADR Amendment 1;
- `f1aefa98f`: failing tests for round 1's findings;
- `a9a7470de`: round 1's fixes;
- `754b87399`: review round 2, PASS;
- `753dac05a`: round 2's one nit;
- `6eedffeb6`: the nit's fix check, PASS.

**Provenance:** Acceptance-frame. There is no PRD. The frame is the ask as David confirmed it at intake on 2026-11-21,
with his three answers.
**Confidence:** high.
- Every frame item is met for the build paths this repository deploys from `staging` and `main`.
- After the merge, the refresh was seen running on staging and in the brains' build.
- The one gap in the frame's "every server deploy" is the two sandboxes, which the story left to their branches (§4 #1).

> As-built record: what the product *is* now, source-linked. It proposes no changes. That's `prd-seed.md`.

## 1. What shipped

All of it is story 1, `stories/done/container-apt-refresh/1-deploys-refresh-ubuntu-packages.md`.

- **A weekly package refresh in every build of the tapestry image** (AC-1, AC-4).
  - **The step.** A new Dockerfile step, after the npm installs and before `COPY .`, brings the image's Ubuntu packages
    up to date from Ubuntu's own sources.
  - **The weekly key.** The step is keyed by `PACKAGES_REFRESH`, the ISO week. The four deploy workflows and the
    brains' `publish-image.yml` pass it.
  - **The effect.** The first build of each week on each target runs the step. strfry's compile, the Neo4j install and
    the npm installs above it stay cached.
- **A marker that says when** (AC-2). `/etc/tapestry/packages-refresh` holds `week=`, `refreshed_at=` and `upgraded=`.
- **A guard** (AC-3). The build fails if Neo4j's version or NodeSource Node's version moves.
- **Loud failures** (AC-4).
  - `apt-get update --error-on=any` fails the build when Ubuntu's archive can't be reached.
  - Staging's and magic-carpet's deploy scripts gain the `set -euo pipefail` that production's and tags' already had.
    Before that, a failed build was followed by a prune and reported green.
- **The docs** (AC-5).
  - OPERATIONS.md §3: which deploy refreshes, what it costs, how to tell beforehand, and the marker.
  - OPERATIONS.md §3.1: three ways to refresh a container by hand.
  - `docs/SAFE_TO_MERGE.md`, "A refreshing deploy".
  - One sentence each in the `/cycle-staging` and `/cycle-prod` skills.
- **The note for tags and magic-carpet now** (AC-5). It's in PR #188's body: §3.1's recipe 3, run only on David's yes.

**Where it runs today.**
- Staging and the brains, since the merge.
- Production, from the next staging-to-main promotion.
- Tags and magic-carpet only once their branches take `staging` (§4 #1).

## 2. Epics & stories rolled up

### Epic: `container-apt-refresh`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 deploys-refresh-ubuntu-packages | The refresh step, the week passed by five workflows and the compose file, the marker, the guard, the docs, the note | Done | `reviews/done/container-apt-refresh/1-deploys-refresh-ubuntu-packages.md`: round 1 CHANGES_REQUESTED, round 2 PASS, then a fix check of round 2's nit, PASS |

- **The ADR:** `decisions/done/container-apt-refresh/0001-weekly-package-refresh-after-the-cached-steps.md`, Option A,
  with Amendment 1 from review round 1.
- **The test plan:** `stories/done/container-apt-refresh/1-deploys-refresh-ubuntu-packages.test-plan.md`, with its own
  Amendment 1.

## 3. As-built inventory

Derived from the diff, `2a812f7e3^1..2a812f7e3`: 25 files, +2067 −11.
- **Build and deploy:** 9 files, +61 −7.
  - The `Dockerfile` (+20).
  - `docker-compose.yml` (+6 −1).
  - Five workflows: `deploy-staging.yml`, `deploy-tapestry.yml`, `deploy-tags.yml`, `deploy-magic-carpet.yml` and
    `publish-image.yml`.
  - The two cycle skills.
- **Docs:** 2 files, +137 −4: OPERATIONS.md and `docs/SAFE_TO_MERGE.md`.
- **Tests:** `test/container-apt-refresh.test.js`, which is new, and its `test/registry.js` entry.
- **Records:** the story, the test plan, the ADR, the review, the epic, the book, a CHANGELOG row and five ledger rows.

The inventory by kind:
- **User-facing:** nothing for a Tapestry user. No screen, endpoint or command changed. An operator gets three things:
  - **A log line.** `packages refresh <week>: <n> to upgrade`, printed only when the step runs. Under BuildKit, a step
    that's reused shows only `CACHED`.
  - **The marker.** It's read with `docker exec tapestry cat /etc/tapestry/packages-refresh`.
  - **The docs.** OPERATIONS.md §3 and §3.1, SAFE_TO_MERGE's section and the skills' sentence.
- **Domain:** none. No concept was touched, so there's no firmware reinstall (ADR, Consequences).
- **Data & contracts:**
  - **`PACKAGES_REFRESH`.**
    - Its value is `date -u +%G-W%V` on each build host, such as `2026-W47`.
    - The four deploy workflows export it before `docker compose up -d --build`.
    - `publish-image.yml` passes it as a build-arg.
    - `docker-compose.yml` passes it through, and it's empty for a local build. Unset, the step runs once and then stays
      cached.
  - **The marker.** Three `key=value` lines. `upgraded=` counts every package the upgrade installs or upgrades.
  - **The sources.** The step reads only Ubuntu's sources (`-o Dir::Etc::SourceParts=-`), never NodeSource's or Neo4j's
    lists.

## 4. Deviations from intent

These are harvested from the story's Out of scope and Deviations, the ADR's Consequences and Amendment 1, and the
review's three parts, then reconciled against the diff. Nothing changes what a Tapestry user can do.

| # | Specified (frame) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Weekly: "after every server deploy … no more than a week behind" | Staging, production from its next promotion, and the brains. Tags and magic-carpet deploy from their own branches' Dockerfile and workflow, so they get nothing until those branches take `staging` | deferred | Story, Out of scope: merging `staging` into those branches is their owners' call. ADR, Consequences: "The sandboxes get nothing until their branches take the change" | Those two containers stay as old as their last cold build. Their NGINX was `14.22` on 2026-11-20, below the CVE fix. It's reachable only from the host | Ledger row `2026-11-21-sandboxes-lack-package-refresh`; until then, the PR's note on David's yes |
| 2 | Written down: a by-hand refresh "for a target that hasn't deployed" | Recipe 1 lasts only until that target's next deploy. A fix that can't wait needs it again after each later deploy that week whose log doesn't print `packages refresh` | constraint-discovered | Review round 1, blocking 1. BuildKit keeps each step as a build-cache record, which `docker image prune` leaves alone. David chose option (a), the docs, over (b), changing the deploy scripts (ADR Amendment 1, item 1; test O6) | A mid-week urgent fix has a repeatable step, not a lasting one | — |
| 3 | Predictable: "An operator can tell beforehand which deploy that is" | Three signs, not two: no successful deploy since Monday 00:00 UTC; an earlier week in the marker; or a merge that changes a step above the refresh (the package files, `patches/strfry-*`, or the Dockerfile above the step) | constraint-discovered | Review round 1, blocking 2 (ADR Amendment 1, item 2; test O5) | Such a merge refreshes whatever the week, so it's slower. SAFE_TO_MERGE names the case, with `gh pr diff --name-only` | — |
| 4 | Written down: the marker says what the refresh did | `upgraded=` comes from a simulation that takes the upgrade's own options | intentional-change | Review round 1, non-blocking 1 (ADR Amendment 1, item 3; test D7) | None for users. The count is right in a week when Ubuntu phases an update | — |
| 5 | Nothing else moves: "Node's major version" stays as pinned | Node stays on 22, and its patch level isn't refreshed either. It still moves only when a cache goes cold | deferred | ADR, Consequences, "Node.js and Neo4j are not refreshed", and Out of scope | A Node 22.x fix reaches the image only on a cold build | Ledger row `2026-11-21-node-patch-level-drifts` |
| 6 | Weekly: "the container's Ubuntu packages" | Only the `tapestry` image refreshes. `nostr-search`'s Alpine base, Redis and Meilisearch never do | deferred | Story, Out of scope, "The stack's other images" | Those three images drift the same way | Ledger row `2026-11-21-stack-images-never-refresh` |
| 7 | Weekly: "no more than a week behind Ubuntu's archive" | Holds while Ubuntu 22.04 has standard support, which ends in April 2027. After that only Ubuntu Pro carries its fixes | deferred | Story, Out of scope, "Moving off Ubuntu 22.04" | From April 2027 a refresh can find nothing new while fixes exist | Ledger row `2026-11-21-tapestry-image-leaves-ubuntu-2204` |

**Undocumented work:** none. Each of the 25 files traces to one of these:
- **Story 1 and its ADR:** the Dockerfile, the compose file, the five workflows, the two skills, OPERATIONS.md and
  SAFE_TO_MERGE.
- **The test plan:** the suite and its registry entry.
- **The review:** the meta ledger row.
- **The ADR's Consequences:** the four follow-up ledger rows.
- **harness-lint L10:** the CHANGELOG row for the skills and workflows.

## 5. Quality state at close

- **Test gate.** The full `npm test` was not run on the owner's Mac at close.
  - **Why.** There it writes to the agent-memory instance. Ledger row `2026-11-14-harness-points-tests-at-agent-memory`
    already names this step.
  - **The full suite** ran in CI instead: `stack-free` on #188's head, `6eedffeb6`, run 44930167680, passed.
  - **No `gate:status` line for it.** CI's run leaves no local record (OPEN.md row
    `2026-10-09-light-gate-b-no-gate-status`).
  - **This close's own gate** covers the 16 suites that read the files the close changes.
    - **How they were chosen.** `tmp/container-apt-refresh/close/derive-close-gate.js` derived them. It's a local
      record in the main checkout.
    - **Where it ran.** On the tree the close leaves behind, after the flip and the epic close-out, with every endpoint
      dead and docker and curl stubbed.
    - **Its line:**
      `20261121T195957Z-74154-00b7 [close-car] started 2026-11-21T19:59:57.058Z on f2e14987+dirty — FAIL, exit 1, 499 passed, 7 failed, 15 skipped, 16/16 suites; failed: safe-to-merge-check`.
    - **The 7 failures** are `safe-to-merge-check`'s B1, B2, B3, B5, B6, B8 and B9. The stub curl refuses their
      connections, and the same seven fail on `staging` alone (the review's run `20261121T163105Z-5575-15b5`).
    - **The other 15 suites passed.** The 15 skips are the new suite's four live checks, which are off here, one in
      `stack-free-npm-test` and ten in `operational-direction`.
- **The review's gates.**
  - Round 2's scoped gate had 42 suites, derived from the diff. It ran on the merge with `staging` and matched `staging`
    alone, suite by suite.
  - The live checks passed, 27 of 27: run `20261121T164130Z-95335-e3cc`.
  - The fix check, run `20261121T172604Z-46115-40c1`, failed only `router-stream-limit-on-connect` P1–P3. Those fail on
    BSD `sed`, as on every run on this Mac.
- **After the merge.** The record is in the main checkout, `tmp/container-apt-refresh/post-merge/README.md`.
  - **Staging's deploy** (run 44935962041) passed in 1 min 54 s.
    - All 17 steps above the refresh were `CACHED`.
    - The step ran for `2026-W47` and found 0 to upgrade, in 18.6 s.
    - That fits the story: staging's NGINX was already `14.24` on 2026-11-20.
  - **The brains' build** (run 44935962033) passed.
    - It built the image with `PACKAGES_REFRESH=2026-W47`, and the step found 0 to upgrade.
    - The roll updated all six brains: avi, vinney, david, yolo1, yolo2 and yolo3.
  - **The smoke test on staging**, tiers 1, 2 and 5, was clean.
- **Not run, waiting for David's yes:**
  - S2, over SSH on staging: the marker, `dpkg-query -W nginx neo4j`, and APOC and GDS in Neo4j's log.
  - The note for tags and magic-carpet.
- **Debt logged by the ADR's Consequences:**
  - **The refresh grows with the cached package step's age, and levels off.** It's 12 packages and 117 MB after a week,
    and 101 and 172 MB after six months. Recipe 2 resets it.
  - **The image grows** by the packages the refresh replaces.
  - **Phased updates are taken at once.**
  - **An outage of Ubuntu's archive** turns a week's first deploy red, while the running container keeps serving.

## 6. Carry-forward register

- [ ] **The sandboxes take the change.** `feat/tags` and `feature-magic-carpet` merge `staging` or take a port, with
  their owners' yes. Until then, the PR's note applies (§4 #1; ledger row `2026-11-21-sandboxes-lack-package-refresh`).
- [ ] **Node 22.x's patch level** (§4 #5; ledger row `2026-11-21-node-patch-level-drifts`).
- [ ] **The stack's other images** (§4 #6; ledger row `2026-11-21-stack-images-never-refresh`).
- [ ] **A base past Ubuntu 22.04 before April 2027** (§4 #7; ledger row `2026-11-21-tapestry-image-leaves-ubuntu-2204`).
- [ ] **S2 on staging,** on David's yes (§5).
- [ ] **Why build caches go cold, and the safe-to-merge buffer.** This book left them as they were (ledger row
  `2026-11-14-cold-deploy-outlasts-safe-buffer`, still open).

## 7. Process findings (harness)

`scripts/harness-stats.sh` at retro time (2026-11-21):
- **Reviews.** 356 decided: 354 final PASS and 2 final CHANGES_REQUESTED. 116 have a CHANGES_REQUESTED in their
  history, this book's review among them.
- **Books.** 95 closed and 11 open, this one included, before this close.
- **This book's phase commits.** It has 9 counted ones: `story:`, `adr:` ×2, `test:` ×2, `impl:` and `review:` ×3. The
  `fix:` and `docs:` commits aren't counted prefixes.
- **Its findings.** Review round 1 raised 2 blocking and 3 non-blocking findings. Round 2 raised one non-blocking.

| Finding | Source (journal / review / deviation / meta row) | Terminal state (commit `<sha>` · OPEN.md row <n> · declined: <reason>) |
|---|---|---|
| Docker cache checks on the owner's Mac use the legacy builder, so they can't show how the droplets' BuildKit caches. The test plan's R2 passed there, while blocking 1 was real on the droplets | Review round 1, harness friction 1 | OPEN.md row `2026-11-21-local-docker-builds-skip-buildkit` (meta, opened by this book). It ports to Direction mode: a Director's gate would trust the same local check |
| The test plan's scoped gate was built by hand, 8 suites, where the review derived 42 from the diff | Review round 1, harness friction 2 | OPEN.md row `2026-11-21-scoped-gate-lists-built-by-hand` (existing; a dated note now records this sighting). It ports: Direction mode's Gate 4 runs the same gate |
| The review template's `## On PASS (same commit)` after `## Verdict` made L1 read round 1's CHANGES_REQUESTED review as PASS-final. The review moved the section above its verdict | Review round 1 (`a95898f26`) | OPEN.md row 28 (existing; its 6th occurrence is now recorded). It ports: L1 and `harness-stats.sh` read verdicts the same way in both flows |
| The full `npm test` can't run on the owner's Mac at implementation, review or this close's step 10, because there it writes to the agent-memory instance. Scoped gates and CI's `stack-free` stood in | Story 1's Deviations, "The gate"; this close, §5 | OPEN.md row `2026-11-14-harness-points-tests-at-agent-memory` (existing; it already names step 10) |
| L14 reads one line at a time. A verdict phrase in the story's link to its review passed it only because it wrapped across two lines. The session removed the phrase, and the story now links the review by path, as other stories do | This session, before the PR | Declined: the lint's intent was followed, and the line was fixed in the same session. Matching across line breaks would make a line-based check much harder to read for one sighting. It does port, since a Direction-mode judge reads stories, so a second sighting should get a row |
| The branch was first created as `fix/container-apt-refresh` and renamed `feat/container-apt-refresh` before it was pushed | Story 1's Deviations, "The branch" | Declined: workflow 3 names the branch `feat/<book-slug>`, and that was followed before anything was pushed. Nothing in the harness pointed the other way |
