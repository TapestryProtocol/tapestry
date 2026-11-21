# Story 1: Every build of the tapestry image brings its Ubuntu packages up to date at least once a week

**Status:** Approved
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

## Linked artifacts
- ADR: `engineering-team/decisions/container-apt-refresh/0001-weekly-package-refresh-after-the-cached-steps.md`
- Test plan: `engineering-team/stories/container-apt-refresh/1-deploys-refresh-ubuntu-packages.test-plan.md`
- Review: (filled in after Review phase)
- Book: `engineering-team/audits/container-apt-refresh/book.md`
- Related: OPEN.md row 134; ledger row `2026-11-14-cold-deploy-outlasts-safe-buffer`.
