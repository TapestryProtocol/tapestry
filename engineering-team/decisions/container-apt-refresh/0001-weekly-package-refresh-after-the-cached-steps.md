# ADR 0001: A weekly package refresh after the cached build steps, keyed by the ISO week

**Status:** Accepted
**Date:** 2026-11-21
**Story:** `engineering-team/stories/container-apt-refresh/1-deploys-refresh-ubuntu-packages.md`

## Context

**The image and its cache.** Docker reuses a cached step until that step's text or its inputs change. A changed step
also rebuilds every step after it. The `Dockerfile` runs in this order:

| Lines | Step | On a cache miss |
|---|---|---|
| 6–11 | Ubuntu packages: NGINX, OpenSSL, OpenJDK 17, build tools and the rest | the slow step of a cold build, about one package a second on staging in August (OPEN.md row 134) |
| 14–16 | Node.js 22 from NodeSource | |
| 19–35 | strfry, cloned at `STRFRY_REF=1.1.0`, patched twice and compiled | minutes of C++ compile |
| 38–42 | Neo4j `1:5.26.10` from Neo4j's repository | |
| 45–50 | GDS 2.13.4 and APOC 5.26.10 jars | |
| 53–81 | Neo4j and APOC config, the strfry user, directories | |
| 85–94 | the three `npm install`/`npm ci` steps | |
| 97 onward | `COPY .`, which every push changes, then the UI build and the config files | every deploy |

So the first package step runs again only when a cache goes cold. That is the drift the story describes.

**The build paths.**
- **The four server deploys.** Each runs `docker compose up -d --build` on its server, then `docker image prune -f`
  (`deploy-staging.yml:33–41`, `deploy-tapestry.yml:30–44`, `deploy-tags.yml:25–44`,
  `deploy-magic-carpet.yml:25–33`). Compose builds `tapestry` from `build: .` (`docker-compose.yml:4`).
- **The brains' image.** `publish-image.yml:78–87` builds it with buildx on GitHub's runners, with a saved cache
  (`cache-from`/`cache-to: type=gha`, `mode=max`). A staging push that changes a runtime path starts it, and so can a
  run by hand.
- **Which copy runs.** Each long-lived sandbox deploys from its own branch's copy of the Dockerfile, the compose file
  and its workflow (OPERATIONS.md §1). `feat/tags` branched from `staging` on 2026-09-13, and `feature-magic-carpet` on
  2026-04-23.

**Constraints.**
- **The story's acceptance criteria**, and David's three intake answers:
  - the deploy that refreshes may take a few minutes more, but no full rebuild;
  - packages refresh at deploys only;
  - the brains' image is included.
- **No new tooling**, under the JS-without-build rule (CLAUDE.md).
- **The workflow rules** (OPERATIONS.md §18). `test/workflow-hardening.test.js` holds them as a guard suite. This change
  touches no action, token or environment, so it leaves that suite alone.
- **`test/brains-launcher-repo.test.js` W1–W3** pin `publish-image.yml`'s triggers, tags, `type=gha` caching and its
  roll.
- **The safe-to-merge rule.** A safe verdict leaves at least 10 minutes before the next scheduled task, and a merge may
  come up to 5 minutes after it (`docs/SAFE_TO_MERGE.md`). So a deploy that takes much over five minutes can recreate
  the container as a task starts (ledger row `2026-11-14-cold-deploy-outlasts-safe-buffer`).
- **No base-image pinning by digest.** David declined it in row 134.
- **No concept is touched**, so the Concept Graph has nothing to orient on here.

**What a refresh costs, measured 2026-11-21.** The measurement ran in throwaway containers on this Mac, as emulated
amd64, the droplets' architecture. Each run:
1. installed the image's 26 Ubuntu packages and their dependencies, as Ubuntu's snapshot archive had them on a past
   date, on the `ubuntu:jammy-*` base image of that date (331 packages in all, the base image's own included);
2. ran a refresh against today's archive.

| Package set as of | Upgraded | Download | `apt-get update` | Upgrade | NGINX after |
|---|---|---|---|---|---|
| 2026-11-14 (1 week) | 12 | 117 MB, mostly OpenJDK 17.0.21.1 | 14 s | 21 s | `14.22` → `14.24` |
| 2026-10-21 (1 month) | 30 | 138 MB | 15 s | 61 s | `14.21` → `14.24` |
| 2026-08-21 (3 months) | 90 | 168 MB | 15 s | 83 s | `14.20` → `14.24` |
| 2026-05-21 (6 months) | 101 | 172 MB | 14 s | 89 s | `14.11` → `14.24` |

- **The times** are this Mac's, under emulation, and only a guide to a droplet's. At the slowest rate seen on staging,
  about a package a second, six months' drift would take roughly two to three minutes.
- **The cost levels off.** A package that changed several times is still fetched once, at its newest version. So six
  months' drift upgraded barely more than three months', and the download is mostly OpenJDK whatever the age.
- **None of the four** needed a removal, a new package, or anything plain `upgrade` would have kept back.
- **The 1-week set** had NGINX at `14.22`, the version tags and magic-carpet run. Their package steps were rebuilt on
  2026-11-14 (the ledger row above).

**Three facts about apt 2.4 (jammy), checked in a scratch container.**
- `apt-get update` exits 0 when a source can't be reached; it only warns. With `--error-on=any` it exits 100.
- `-o Dir::Etc::SourceParts=-` makes apt read `/etc/apt/sources.list` alone, which is Ubuntu's archive. The NodeSource
  and Neo4j lists in `sources.list.d/` are left out, and with them their packages: `nodejs` and `neo4j` have no newer
  version to move to.
- `full-upgrade` can add a new dependency that a fix needs, where plain `upgrade` would keep the fix back. With
  `--no-remove`, it stops rather than remove anything.

## Options considered

### Option A — A refresh step after the cached steps, keyed by the ISO week
A new step between the `npm` steps and `COPY .` brings Ubuntu's packages up to date. Its cache key is a build argument,
`PACKAGES_REFRESH`, set to the ISO week, such as `2026-W47`, on every server deploy and every brain build. The first
build of each week misses the cache at this step, and only at this step: everything above it stays cached, and
everything below it is rebuilt by every push anyway.

- **Pros.**
  - A refresh adds only the upgrade itself: 35 seconds for a week's drift on this Mac, measured above.
  - strfry's compile, the Neo4j install and the `npm` installs are never redone for it.
  - Which build refreshes follows from the calendar.
- **Cons.**
  - Every week's refresh starts again from the same cached first package step. So it re-applies everything since that
    step was built, and grows as the step ages, until a cache goes cold or an operator rebuilds the step by hand. The
    growth levels off, though: 12 packages after a week, 101 after six months (the table above).
  - The image carries the old files under the new ones, and grows by the upgraded packages' size.

### Option B — A weekly key on the first package step, with `--pull`
The ISO week goes into the first package step (line 6), and `--pull` fetches the newest `ubuntu:22.04` each time.

- **Pros.**
  - The freshest result: a new base image and a clean package step every week.
  - The image doesn't grow.
- **Cons.**
  - Every step after line 6 is rebuilt each week, strfry's compile included: 9–10 minutes on 2026-11-14, and over 25 on
    a slow mirror in August.
  - That breaks intake answer 1, and the safe-to-merge margin above.
  - `--pull` also rebuilds everything whenever Docker Hub's `ubuntu:22.04` moves, on a day nobody chose.

### Option C — strfry in a build stage of its own, the package steps rebuilt weekly from a fresh base
A first stage compiles strfry. The final stage starts from `ubuntu:22.04` (with `--pull`), installs the runtime
packages keyed by the week, and copies strfry's binary in.

- **Pros.**
  - No growth: each week starts from a fresh base.
  - strfry's compile stays cached.
- **Cons.**
  - Every step after the package step is still rebuilt each week: NodeSource, Neo4j and its jars, and the three `npm`
    installs, roughly 5–8 minutes plus the full package download.
  - It restructures the whole Dockerfile and splits strfry's build dependencies from its runtime libraries. Every
    sandbox port would inherit that.
  - It is more than a few minutes, and much more change than the story needs.

### Option D — A scheduled rebuild outside deploys
A weekly workflow, or a timer on each server, rebuilds without a push.

- **Pros.**
  - It also refreshes a sandbox that never deploys.
- **Cons.**
  - Intake answer 2 put this out of scope.
  - GitHub runs a scheduled workflow only on `main`, while each target's deploy secrets are limited to its own branch
    (§18.3). It would need dispatch rights or server-side timers kept outside the repo.

## Decision

We chose **Option A**. It is the only option that keeps the refreshing deploy within a few minutes and leaves the
cached heavy steps alone, as intake answer 1 asks. The weekly key also makes the refreshing deploy predictable, which
the safe-to-merge rule needs. We trade away a fresh base image every week. The refresh re-applies all updates since the
cached package step was built, so its cost grows as the step ages. It levels off, though: 101 packages at six months
against 90 at three. The deploy log shows the growth, and an operator can reset it by hand (OPERATIONS.md).

The step, in full:

1. **Ubuntu's sources only.** NodeSource's Node and Neo4j `1:5.26.10` stay exactly as installed, and an outage at
   either of those repositories can't fail a deploy.
2. **`apt-get update --error-on=any`.** An unreachable archive fails the build loudly, rather than leaving the
   container stale behind a refresh that only claims to have run (AC-4).
3. **`full-upgrade -y --no-remove`, with phased updates included.** A fix that needs a new dependency still lands, and
   the step never removes a package. Including phased updates means nothing Ubuntu has published is left waiting
   (AC-1).
4. **A guard.** The step records `neo4j`'s and `nodejs`'s versions before the upgrade, and fails the build if either
   differs after it (AC-3).
5. **A marker file**, `/etc/tapestry/packages-refresh`, with the week, the time and the number of packages upgraded
   (AC-2).
6. **The week from each build host's clock in UTC,** `date -u +%G-W%V`. Weeks start on Monday at 00:00 UTC. The first
   deploy of a target in each week refreshes it, and the first brain build of each week refreshes the brains' image.
7. **Unset, the argument is an empty string,** as on a local `docker compose up --build`. The step then runs once and
   stays cached, as the first package step does today (AC-4).

The staging and magic-carpet deploy scripts also get the `set -euo pipefail` that production's and tags' already
have. Without it a failed build is followed by `docker image prune -f`, and the run reports success (`deploy-tags.yml`'s
comment, 2026-05-27).

## Consequences

- **Enables.** After any build, a server's or a brain's Ubuntu packages are at most a week behind Ubuntu's archive.
  That costs one longer build per target per week, and you can tell which build it will be beforehand:
  - the target has had no successful deploy since Monday 00:00 UTC;
  - or the container's marker names an earlier week.
- **The refresh grows with the cached package step's age, and levels off** (the table): 12 packages and 117 MB after
  a week, 101 and 172 MB after six months. A cold cache resets it, as does a deliberate edit to the first package
  step, or the by-hand rebuild in OPERATIONS.md. The step prints how many packages it upgrades, so the deploy log
  shows the growth before it matters.
- **The image grows** by the size of the packages the refresh replaces, since their old copies stay in the lower step.
  The servers' disks hold that easily, and `docker image prune -f` still clears old images.
- **An outage of Ubuntu's archive** on a week's first deploy turns that deploy red, and the running container keeps
  serving. The next deploy, or a re-run after the safe-to-merge check, tries again.
- **Phased updates are taken at once.** Ubuntu phases some non-security updates to catch regressions, and a weekly build
  takes them on the day it runs. Security updates are never phased.
- **Node.js and Neo4j are not refreshed.** Node's 22.x patch level still moves only when a cache goes cold, as today. A
  Node refresh would be its own decision (a follow-up), since it also changes what CI's Node 22 matches.
- **The first refresh on each target** catches up from that target's own cached package step. It is likely small on
  production and staging: their NGINX was already `14.24` on 2026-11-20, so their package steps are recent.
- **The sandboxes get nothing** until their branches take the change. The story leaves that, and their refresh by hand
  now, to the PR's note. See "Sandbox ports" below.
- **Unchanged:** a cache that goes cold for other reasons (the ledger row stays open); the nostr-search, Redis and
  Meilisearch images; Ubuntu 22.04's end of standard support in April 2027. Follow-ups for those go to OPEN.md with
  this PR.
- **Firmware reinstall required?** No. No concept definition changes.

## Implementation notes

**`Dockerfile`.** Insert the new step after the nip50-proxy `npm install` (line 94) and before
`# Now copy the full application code` (line 96). It changes no line above, so no step above it is rebuilt. Its shape,
for the Implementer to finish:

```dockerfile
# ── Weekly refresh of Ubuntu's packages (ADR container-apt-refresh/0001) ──
# The deploy workflows and publish-image.yml pass the ISO week (e.g. 2026-W47) as PACKAGES_REFRESH, so the first
# build of each week re-runs this step, and only it and what follows. It reads Ubuntu's own sources only, so Node
# and Neo4j stay exactly as installed above. Unset (a local build), it runs once and is then cached.
ARG PACKAGES_REFRESH=
RUN set -eu; \
    only_ubuntu="-o Dir::Etc::SourceParts=- -o Acquire::Retries=3"; \
    keep_conf="-o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold"; \
    pinned="$(dpkg-query -W -f='${Package}=${Version} ' neo4j nodejs)"; \
    apt-get $only_ubuntu update --error-on=any; \
    n="$(apt-get $only_ubuntu -s full-upgrade | grep -c '^Inst' || true)"; \
    echo "packages refresh ${PACKAGES_REFRESH:-unset}: ${n} to upgrade"; \
    apt-get $only_ubuntu $keep_conf -y --no-remove -o APT::Get::Always-Include-Phased-Updates=true full-upgrade; \
    test "$(dpkg-query -W -f='${Package}=${Version} ' neo4j nodejs)" = "$pinned"; \
    mkdir -p /etc/tapestry; \
    printf 'week=%s\nrefreshed_at=%s\nupgraded=%s\n' "${PACKAGES_REFRESH:-unset}" \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$n" > /etc/tapestry/packages-refresh; \
    rm -rf /var/lib/apt/lists/*
```

- `/bin/sh` here is dash, so the step uses `set -eu` and no `pipefail`. The one pipe only counts packages.
- `keep_conf` keeps a config file that was edited locally when an upgrade ships a new one. Without it dpkg asks, and
  with no terminal it stops ("end of file on stdin at conffile prompt"). At this point in the build nothing has edited
  an Ubuntu package's config. But the entrypoint appends to `/etc/nginx/nginx.conf` at start, so the in-place recipe
  below needs it.
- `DEBIAN_FRONTEND=noninteractive` is already set by `ENV` at line 3, and `docker exec` inherits it.
- Check the option name `APT::Get::Always-Include-Phased-Updates` against jammy's `apt.conf(5)`. apt accepts a
  misspelled `-o` name silently.
- `/etc/tapestry` is unused today. The marker must not live under a volume (`/var/lib/brainstorm`,
  `/var/lib/strfry`, `/var/lib/neo4j/data`, `/var/log/brainstorm`), which would hide it.

**`docker-compose.yml:4`.** Replace `build: .` with the long form, passing the argument through from the environment:

```yaml
    build:
      context: .
      args:
        # The ISO week whose Ubuntu updates the image carries; the deploy workflows set it (ADR container-apt-refresh/0001).
        PACKAGES_REFRESH: ${PACKAGES_REFRESH:-}
```

`docker-compose.dev.yml` overrides only volumes, so it inherits this. Compose builds `nostr-search-api` unchanged.

**The four deploy workflows,** on `staging`.
- **Every one:** just before `docker compose up -d --build`, add
  `export PACKAGES_REFRESH="$(date -u +%G-W%V)"`, with a one-line comment naming this ADR.
- **`deploy-staging.yml` and `deploy-magic-carpet.yml`:** also open their scripts with `set -euo pipefail` and its
  comment, as `deploy-tapestry.yml:31–36` has. Give `git checkout -- docker-compose.yml 2>/dev/null` its `|| true`.
- **The copies that don't run here.** Staging's copies of `deploy-tags.yml` and `deploy-magic-carpet.yml` never run on
  staging. They are what each sandbox gets when it next merges `staging`, so they change too.
- **Untouched:** actions, `permissions`, `environment`, `command_timeout` and the other steps.

**`publish-image.yml`.**
- In the existing `commit` step (line 74–76), also write `week=$(date -u +%G-W%V)` to `$GITHUB_OUTPUT`, and say so in
  the step's name.
- Give the Tapestry build step (line 78–87) `build-args: PACKAGES_REFRESH=${{ steps.commit.outputs.week }}`.
- Leave the search image alone. Leave the triggers, the tags, both `type=gha` lines per build and the roll as they are:
  W1–W3 hold them.

**Docs (AC-5).**
- **`OPERATIONS.md` §3.** A paragraph on the weekly refresh: what runs, which deploy (the first of each ISO week, per
  target), what it costs (the table's numbers, plus "the first one per target catches up"), how to tell beforehand,
  the marker, and what happens when Ubuntu's archive can't be reached.
- **`OPERATIONS.md`, a new subsection on refreshing by hand**, with three recipes:
  1. **A target that has the step.** Run `export PACKAGES_REFRESH="$(date -u +%G-W%V)-by-hand-$(date -u +%d%H%M)"`,
     then `docker compose up -d --build`, in `/opt/tapestry`. Check the safe-to-merge verdict first. It takes a few
     minutes, and lasts.
  2. **Resetting the cached package step when the refresh has grown.** Run
     `docker compose build --pull --no-cache tapestry`, then `docker compose up -d`. It takes 10–25 minutes. It is
     only for a branch whose Dockerfile pins strfry: `feature-magic-carpet` clones strfry's default branch, and its
     patch script predates the loud-failure fix of 2026-05-04.
  3. **A target without the step**, such as tags and magic-carpet today: upgrade in place with
     `docker exec tapestry sh -c '<the step's two apt-get lines, with $only_ubuntu and $keep_conf>'`, then
     `docker restart tapestry` after the safe-to-merge check. NGINX isn't under supervisord; the entrypoint starts
     it, so the restart is what loads the new binaries. It lasts until the container is next recreated.
- **The other docs.**
  - `OPERATIONS.md` §6.3 step 7's first-build line gains a pointer to the new paragraph.
  - Bump `OPERATIONS.md`'s and `docs/SAFE_TO_MERGE.md`'s "Last updated" lines; lint L9 checks them.
  - `docs/SAFE_TO_MERGE.md`: one short section. A refreshing deploy takes a few minutes more, so merge right after
    the safe verdict, without spending the 5-minute allowance, and here is how to tell one beforehand.
  - `.claude/skills/cycle-staging/SKILL.md:130` and `.claude/skills/cycle-prod/SKILL.md:123`: one sentence each with
    the refreshing deploy's expected time.
- **The records.**
  - **`engineering-team/CHANGELOG.md`:** one row, in the same commit as the workflow and skill edits, since both are
    harness-definition paths (lint L10).
  - **The PR to `staging`** carries the note for tags and magic-carpet now: recipe 3, run only on David's yes.

**For the Tester.**
- **Every check this ADR implies can be made from files:**
  - the step's place in the Dockerfile and its options;
  - the compose argument;
  - each workflow's `export` and `set -euo pipefail`;
  - the brain build's `build-args`;
  - the docs.
- **A live check, if one is planned.**
  - Build with `docker build -t <a scratch tag> --build-arg PACKAGES_REFRESH=…` twice, with two values. The second build
    should re-run only the new step and what follows it.
  - Never run `docker compose up` from this worktree on this Mac. `container_name: tapestry` belongs to the
    agent-memory instance already running here.

**Sandbox ports.** These are for the follow-up, not this PR. Matthias PRs into `feature-magic-carpet`
(OPERATIONS.md §7). The last sandbox ports went in with the owner's approval, and no CI ran on them, so their tests ran
locally (ledger row `2026-10-10-sandboxes-got-security-fixes`). A port of this change works the same way.
- **`feat/tags`.**
  - Its Dockerfile matches `staging`'s from the `npm` steps through `COPY .`, and its `docker-compose.yml` matches too,
    so both hunks apply as they are.
  - `deploy-tags.yml` already has `set -euo pipefail`, and needs only the `export`.
  - The branch lacks `test/workflow-hardening.test.js` and the brains tests, and its OPERATIONS.md is older. A ported
    suite keeps only the Dockerfile, compose and workflow checks.
- **`feature-magic-carpet`.**
  - Its Dockerfile also matches from the `npm` steps through `COPY .`. But it clones strfry's default branch, and
    the refresh step leaves that alone.
  - Its `docker-compose.yml` differs from staging's in 29 lines, so the `args` block is ported by hand.
  - Its workflow has no `set -e`, and still has `command_timeout: 25m`, which a cold build has outrun before. The port
    adds `set -euo pipefail` and the `export`. Raising the timeout is the owner's call.
  - It has no OPERATIONS.md or `docs/SAFE_TO_MERGE.md`.

## Out of scope

- **A scheduled refresh** (intake answer 2), and the sandbox ports themselves (the story's out of scope).
- **A Node.js refresh**, and moving off Ubuntu 22.04: follow-ups.
- **Serving the marker over HTTP.** An operator reads it with `docker exec`. A public endpoint would show anyone how
  stale a container might be.
- **Why build caches go cold.** That's ledger row `2026-11-14-cold-deploy-outlasts-safe-buffer`, which stays open.
