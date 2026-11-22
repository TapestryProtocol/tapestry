# Story 1: Every build of the tapestry image brings its Ubuntu packages up to date at least once a week

**Status:** Done
**Created:** 2026-11-21
**Type:** Bug *(Standard: all five phases. Architecture isn't skipped: how a build refreshes the packages is a real
choice, weighed against deploy time.)*
**Loom:** none. Nothing on the board covers this: on 2026-11-21 the inbox, the map and the open proposals showed nothing.
Recording it on Loom is offered once the PR lands.

## Background

**What the image holds.** The `tapestry` image starts from `ubuntu:22.04`. Its first package step installs every Ubuntu
package the stack needs, NGINX, OpenSSL and OpenJDK 17 among them; OpenJDK 17 runs Neo4j. Later steps add three pinned
components:
- Node.js 22 from NodeSource;
- strfry, built from source at a pinned tag with two patch sets;
- Neo4j 5.26.10 from Neo4j's own package repository, with APOC 5.26.10 and GDS 2.13.4.

**Why the packages go stale.**
- **Server deploys.** Each one rebuilds the image on its server and reuses Docker's build cache
  (`docker compose up -d --build`, OPERATIONS.md §3).
- **The brains on tapestry.ninja.** They run the same image, built on GitHub's runners with a saved build cache
  (`publish-image.yml`).

Neither build asks Ubuntu for updates. So the package step runs again only when a cache happens to go cold.

- **Evidence, 2026-11-20.** A check of David's droplets for CVE-2026-123007 and CVE-2026-123633 found the container's
  NGINX on tags and magic-carpet at `1.18.0-6ubuntu14.22`. That is below Ubuntu's fix, `14.23`. Production and staging
  had `14.24`, and every droplet that runs NGINX on the host has it patched. The container's NGINX wasn't reachable from outside:
  it is published only on the host's `127.0.0.1:8080`, behind the host's NGINX, and has no HTTP/2. Every other Ubuntu
  package in the image drifts the same way, though.
- **A cold cache comes as a surprise.**
  - In August a cold rebuild of the package step on staging outran the deploy's 25-minute limit, at about one package
    a second (OPEN.md row 134). The limit is 50 minutes now.
  - On 2026-11-14, deploys to production, magic-carpet and tags each took 9–10 minutes. Magic-carpet's log shows the
    package step being rebuilt. The safe-to-merge buffer is 10 minutes (ledger row
    `2026-11-14-cold-deploy-outlasts-safe-buffer`, still open). Why those caches were cold hasn't been diagnosed.

  So a container's packages are as old as its last cold build, which can be months.
- **Pinning was declined.** In row 134, David declined pinning the base image by digest: "I would probably forget we
  have done it and that would come back to bite us". Silent staleness is the worse risk, and this story removes it.

**Decided at intake (David, 2026-11-21):**
1. The deploy that refreshes may take a few minutes longer than a warm deploy. A full rebuild is not wanted.
2. Packages refresh at deploys only. A target that hasn't deployed is refreshed by hand.
3. The brains' image is included.

## User-facing description

As the operator of Tapestry's deployments, I want every deploy to bring the container's Ubuntu packages up to date
once a week, so that a fix Ubuntu ships reaches each container within a week of its next deploy. I don't want to have
to remember to rebuild anything, and I don't want a slow deploy I didn't expect.

## Acceptance criteria

- [ ] **AC-1 Weekly freshness.** Given any server deploy or brain image build, when it finishes, then the container's
      Ubuntu packages were brought up to date by that build or by one in the 7 days before it. Right after a build that
      refreshed, no Ubuntu 22.04 update that Ubuntu had published when the build began is still waiting in the
      container. For example, its NGINX is the newest `1.18.0-6ubuntu14.*` Ubuntu offers, `14.24` or later today.
- [ ] **AC-2 The container says when.** Given a running container, an operator can read when its Ubuntu packages were
      last brought up to date, without rebuilding anything.
- [ ] **AC-3 Nothing else moves.** Given a build that refreshed, then:
  - Neo4j is still exactly 5.26.10, with APOC 5.26.10 and GDS 2.13.4 loading;
  - strfry is still built from its pinned tag, with both patch sets applied;
  - Node.js is still on its 22 line. A newer 22.x is fine, since a cold rebuild already picks one up today.
- [ ] **AC-4 Deploy time and failure.**
  - Given a server deploy that doesn't refresh, it takes about what a warm deploy takes today, about 1½ to 2½ minutes.
  - Given one that refreshes, it takes a few minutes longer at most; the aim is under 3. It doesn't redo strfry's
    compile or the Neo4j install.
  - An operator can tell before merging whether a deploy will refresh.
  - If the refresh can't reach Ubuntu's archive, the deploy's run goes red and the running container keeps serving.
  - A build that's given no new arguments, such as a local `docker compose up --build`, still works as it does today.
- [ ] **AC-5 Docs and the note.** Given the change on `staging`:
  - OPERATIONS.md §3 says when and how deploys refresh the packages, and what a refreshing deploy costs.
  - `docs/SAFE_TO_MERGE.md` and the `/cycle-staging` and `/cycle-prod` skills say how to tell a refreshing deploy, and
    how long one takes.
  - OPERATIONS.md gives the steps to refresh one target's container by hand.
  - The PR to `staging` carries a short note on refreshing tags' and magic-carpet's containers now. Their deploy
    branches don't carry this change until they merge `staging`. The note is run only on David's yes.

## Concepts touched

None. This story changes how the image is built and deployed. It reads and writes nothing in the concept graph.

## Out of scope

- **A scheduled refresh** for a target that doesn't deploy (intake decision 2). A sandbox whose branch goes weeks
  without a push keeps its packages until its next deploy or a refresh by hand.
- **Merging `staging` into `feat/tags` or `feature-magic-carpet`.** Each of these deploys from its own branch's copy of
  the Dockerfile and its workflow, so the change reaches them only when they merge `staging`. That's their owners'
  call.
- **Running anything on a server now.** The note says how, and it is run only on David's yes.
- **The stack's other images.** `nostr-search` is built from `node:22-alpine`. `redis:7-alpine` and
  `getmeili/meilisearch:v1.12` are pulled once, and a deploy never pulls them again. They drift the same way. This is a
  follow-up.
- **Moving off Ubuntu 22.04.** Canonical's standard security support for 22.04 ends in April 2027. After that, only
  Ubuntu Pro (ESM) carries fixes. A new base is a bigger change, touching package names, strfry's build and Java. This
  is a follow-up.
- **Why caches go cold, and the safe-to-merge buffer itself.** Both belong to the open ledger row. This story must not
  make a deploy collide with a scheduled task any more often than today.
- **The hosts' own packages.** unattended-upgrades covers them, as the 2026-11-20 check showed.
- **Pinning the base image by digest.** David declined it in row 134.

## Open questions

None. Intake's three questions are answered under Background.

## Deviations

- **The gate.** The full `npm test` was not run on the Mac this was built on, because there it writes to a live
  instance. The test plan's scoped gate ran instead, with the live checks switched on. CI's `stack-free` job runs the
  whole registry on the PR.
- **The branch.** The unpushed branch `fix/container-apt-refresh` was renamed `feat/container-apt-refresh`, the name
  workflow 3 gives.
- **The option name.** The ADR asked for `APT::Get::Always-Include-Phased-Updates` to be checked against jammy's
  `apt.conf(5)`. The image ships no man pages, so it was checked against jammy's `libapt-pkg` instead, which holds the
  name.

## On staging and production (2026-11-21)

**Staging: TapestryProtocol/tapestry#188,** merged by the owner at 18:31:04Z (merge commit `2a812f7e`).
- **Its CI:** `stack-free` run 44930167680 passed on the PR's head, `6eedffeb`.
- **The deploy:** `deploy-staging.yml` run 44935962041 succeeded. Its "Deploy via SSH" step ran 18:31:14–18:33:08Z,
  1 m 54 s.
  - Build steps tapestry 2/28 to 18/28, everything above the refresh, were cached.
  - The refresh, step 19/28, took 18.6 s and printed `packages refresh 2026-W47: 0 to upgrade`. Staging's NGINX was
    already 14.24 on 2026-11-20.
  - The Neo4j and Node guard held, since the step succeeded.
- **The brains:** "Publish brain images" run 44935962033 built the image with `PACKAGES_REFRESH=2026-W47` from the GHA
  cache. Every step above the refresh was cached, and the refresh found 0 to upgrade too. "Roll the brains" ran
  18:32:56–18:40:06Z and updated all six: avi, vinney, david, yolo1, yolo2 and yolo3.
- **The smoke test, 18:35:08–18:35:45Z:** tiers 1, 2 and 5 were clean. Tier 3 is the deploy log above, and tier 4
  doesn't apply, since no UI changed.
  - Tier 1: stable after 3 polls, with Neo4j answering after 3 (19,886 verified followers).
  - Tier 2: every page and public API answered 200, apart from `get-user-data`'s documented 504. Search answered 200
    with hits.
  - Tier 5: the served bundle `index-DAxhuweK.js` answered 200. Its `Server: nginx/1.24.0 (Ubuntu)` header is the
    droplet's NGINX, not the container's, so it can't show the container's version.
- **The book close, #190,** merged at 20:51:19Z (merge commit `13525ea1`). Its deploy, run 44948469514, was warm:
  steps 2/28 to 19/28 were cached, the refresh among them.

**Production: TapestryProtocol/tapestry#193,** the promotion of staging at `425006cf`, through
`promote/container-apt-refresh-2026-11-21`.
- **What it carried:** #188 and #190, with #181, #185, #186, #187, #189, #191 and #192 from other work.
  - The owner said "Yes, promote" after being told it would carry those nine PRs, then "Yes, merge it" once #193 was
    open.
  - #189's session had the same go-ahead for the same bundle. The two sessions agreed by message that this one would
    merge.
- **Staging first:** a smoke test of staging at `425006cf`, 22:13:52–22:14:29Z, was clean on tiers 1, 2 and 5.
- **Its required checks:** `main-source-guard` (run 44955895046) and `stack-free` (run 44955895061, its job 16 m)
  passed on `425006cf`.
- **The merge:** the safe-to-merge check against production said SAFE at 22:32:45Z, on its first attempt. #193 merged
  at 22:32:48Z, pinned with `--match-head-commit 425006cf` (merge commit `196a475f`).
- **The deploy:** `deploy-tapestry.yml` run 44957304980 succeeded, 22:32:51–22:34:46Z, 1 m 55 s.
  - Build steps 2/28 to 18/28 were cached.
  - The refresh ran in about 12 s and printed `packages refresh 2026-W47: 0 to upgrade`. Production's image was
    already current with Ubuntu's archive, so this first refresh there added almost nothing to the deploy.
  - The guard held, and the containers were recreated and had started by 22:34:43Z.
- **The smoke test, 22:34:58–22:35:44Z:** tiers 1, 2 and 5 were clean. Tier 3 is the deploy log above, and tier 4
  doesn't apply.
  - Tier 1: stable after 3 polls, with Neo4j answering after 6 (19,252 verified followers).
  - Tier 2: every page and public API answered 200, apart from `get-user-data`'s documented 504. Search answered 200
    with hits.
  - Tier 5: the served bundle, still `index-DAxhuweK.js`, answered 200, and so did `auth/status` through NGINX.

**What no one has run.**
- **S2,** on staging or production. It's the read-only check over SSH of the marker `/etc/tapestry/packages-refresh`,
  `dpkg-query -W nginx neo4j`, and Neo4j's log for APOC and GDS.
- **The sandboxes.** Tags and magic-carpet don't have the change until `feat/tags` and `feature-magic-carpet` take
  `staging`. Until then, recipe 3 in OPERATIONS.md §3.1 refreshes their containers by hand, on the owner's yes (ledger
  row `2026-11-21-sandboxes-lack-package-refresh`).

The records are in the main checkout's ignored `tmp/container-apt-refresh/`: `post-merge/` for staging and the brains,
and `promotion/` for production.

## Linked artifacts
- ADR: `engineering-team/decisions/done/container-apt-refresh/0001-weekly-package-refresh-after-the-cached-steps.md`
- Test plan: `engineering-team/stories/done/container-apt-refresh/1-deploys-refresh-ubuntu-packages.test-plan.md`
- Review: `engineering-team/reviews/done/container-apt-refresh/1-deploys-refresh-ubuntu-packages.md`
- Book: `engineering-team/audits/container-apt-refresh/book.md`
- Related: OPEN.md row 134; ledger row `2026-11-14-cold-deploy-outlasts-safe-buffer`.
