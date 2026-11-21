# Test Plan: Story 1 — Every build of the tapestry image brings its Ubuntu packages up to date at least once a week

**Story:** `engineering-team/stories/container-apt-refresh/1-deploys-refresh-ubuntu-packages.md`
**ADR:** `engineering-team/decisions/container-apt-refresh/0001-weekly-package-refresh-after-the-cached-steps.md`
**Date:** 2026-11-21

All tests are in one new suite, `test/container-apt-refresh.test.js`, registered in `test/registry.js`. Each test's
name starts with its handle (D1, W2, L3 and so on), and the table names the criteria it covers.

## Coverage map

| Criterion | Test | Level |
|---|---|---|
| AC-1 Weekly freshness | **D1** a refresh step brings Ubuntu's packages up to date, keyed by `ARG PACKAGES_REFRESH` | source |
| AC-1, AC-3, AC-4 | **D3** it reads Ubuntu's sources only, fails when a source can't be reached, takes every update (phased ones too) without removing anything, keeps locally edited config files, and cleans its lists | source |
| AC-1, AC-4 | **C1** `docker-compose.yml` passes `PACKAGES_REFRESH` from the environment to the tapestry build, empty when unset | source |
| AC-1, AC-4 | **W1** ×4 each deploy script builds with `PACKAGES_REFRESH` set to the UTC ISO week (`date -u +%G-W%V`), then prunes | behavioural: the script runs under bash with docker, git and sed stubbed |
| AC-1 | **P1** the brains' build passes `PACKAGES_REFRESH` from a step that writes the UTC ISO week | source, and the week step runs under bash |
| AC-1, AC-2, AC-3 | **L1** on a stale base the step brings every Ubuntu package up to date, writes its marker, and leaves Neo4j and Node alone | live (Docker) |
| AC-2 The container says when | **D5** the step writes `/etc/tapestry/packages-refresh` with `week=`, `refreshed_at=` and `upgraded=`, outside every volume of both compose files | source |
| AC-2 | **L1** the marker's three lines, as written | live |
| AC-3 Nothing else moves | **D4** the step reads the neo4j and nodejs versions before the upgrade and again after it | source |
| AC-3 | **L3** when an upgrade would move nodejs, the step fails the build | live |
| AC-4 Deploy time and failure | **D2** the step comes after the NodeSource, strfry, Neo4j and npm steps and before `COPY .` | source |
| AC-4 | **D6** the step stops at its first failing command (`set -e`) | source |
| AC-4 | **W2** ×4 when the build fails, each deploy stops there: the run is red and nothing is pruned | behavioural (stubbed bash) |
| AC-4 | **L2** with no network the step fails and writes no marker | live |
| AC-4 | **L4** a build given no `PACKAGES_REFRESH`, as a plain `docker build .` is, still runs the step | live |
| AC-4, AC-5 | **O3** `docs/SAFE_TO_MERGE.md` says how to tell a refreshing deploy, and how long it takes | source |
| AC-5 Docs and the note | **O1** OPERATIONS.md §3 names `PACKAGES_REFRESH` and the marker, and says the first deploy of each ISO week refreshes, from Monday | source |
| AC-5 | **O2** OPERATIONS.md has a by-hand refresh section: with the step (`PACKAGES_REFRESH=…` and `docker compose up -d --build`) and in place (`docker exec tapestry` and `docker restart tapestry`) | source |
| AC-5 | **O4** the `/cycle-staging` and `/cycle-prod` skills each say the first deploy of an ISO week refreshes, and how long it takes | source |
| AC-5 | The PR to `staging` carries the note for tags and magic-carpet now | review check (R3 below) |
| AC-4 | A refreshing deploy on staging takes a few minutes more than a warm one, and the steps above the refresh stay cached | staging check (S1 below) |
| AC-3 | Neo4j still loads APOC and GDS on staging after the refresh | staging check (S2 below) |

**Where W2 already holds.** `deploy-tapestry.yml` and `deploy-tags.yml` already have `set -euo pipefail`, so W2 guards
them before and after. W2 fails today for `deploy-staging.yml` and `deploy-magic-carpet.yml`. Each of those exits 0
after a failed build and then prunes, so its run shows green.

## Edge cases

- [x] **Ubuntu's archive can't be reached.** The step fails (L2). The deploy turns red and doesn't prune (W2), and the
      running container is left as it was, since compose recreates nothing when its build fails.
- [x] **A third-party source can't be reached.** The refresh isn't affected. L1–L4 all run with an unreachable
      `nodesource.list` in `sources.list.d`.
- [x] **A pinned package would move.** In L3 a stand-in nodejs older than Ubuntu's own 12.x gives the upgrade something
      to move. The test first checks that it did move, so the guard can't pass untested.
- [x] **A base with months of drift.** All of it is applied, and nothing is left waiting (L1, on
      `ubuntu:jammy-20260509`).
- [x] **A build given no argument.** C1 checks the compose default. L4 checks a plain `docker build .`, which passes the
      ARG's own default, or leaves the variable unset when there is none. A bare `$PACKAGES_REFRESH` under `set -u`
      would fail there.
- [x] **A deploy script that `docker` might reach for real.** W1 and W2 refuse to run a script unless
      `command -v docker` resolves to the stub. Their PATH is the stub folder, then `/usr/bin:/bin` only.
- [ ] **Not covered: the week turning over during a deploy.** The stamp is read once per deploy, so a deploy that
      starts on Sunday at 23:59 UTC and ends on Monday is still one refresh.
- [ ] **Not covered: Concept Graph API unavailable, or a concept handle not found.** The story touches no concept.

## Test infrastructure

- **Runner.** Node's built-in runner, through `test/registry.js`. `js-yaml` reads the workflows and compose files; the
  repo already depends on it.
- **W and P tests** need `bash`. Each W test writes stubs for `docker`, `git` and `sed` into a temp folder and swaps
  `/opt/tapestry` in the script for a temp folder. Nothing touches Docker, a checkout or a server. `sed` is stubbed,
  not run, because macOS's BSD `sed -i` reads the scripts' GNU-style call differently.
- **L tests (live)** are off unless `TAPESTRY_LIVE_DOCKER_CHECKS=1`. Off, each one SKIPs and names the switch, so
  they're counted in every gate run and never run in CI.
  - **They need** Docker, Ubuntu's archive (`ports.ubuntu.com` on arm64, `archive.ubuntu.com` on amd64) and Docker Hub,
    which serves `ubuntu:jammy-20260509`.
  - **They use** `docker run --rm` only, with a unique container name each, and no compose, ports or volumes. So they
    never touch a running stack. Each takes one to two minutes.
  - **They run** the Dockerfile's refresh step verbatim, after installing stand-in `neo4j` (`1:5.26.10`) and `nodejs`
    packages built with `dpkg-deb`.
- **Never** run `docker compose up` from a worktree on a machine that already runs a stack called `tapestry`.
- **Concept Graph API, firmware state, fixtures:** none.

## How to run

```bash
node test/container-apt-refresh.test.js
```

```bash
TAPESTRY_LIVE_DOCKER_CHECKS=1 node test/container-apt-refresh.test.js
```

**The scoped gate for this story** is this suite plus the existing suites that read the files it changes:

```bash
node -e "Promise.all(['container-apt-refresh','workflow-hardening','ci-test-job','brains-launcher-repo','router-stream-limit-on-connect','neo4j-query-public-reads','neo4j-sizing-override','safe-to-merge-check'].map(s=>require('./test/'+s+'.test.js').run())).then(rs=>{const f=rs.reduce((n,r)=>n+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"
```

All eight only read files, or run scripts under bash with stubs, or answer from a local fake server. CI's `npm test`
runs the whole registry, this suite included.

**Left out of the scoped gate, on purpose:**
- `test/operations.test.js` and the suites under `test/operations/`. They read only lines this story leaves alone: the
  `tapestry` link (C6), the volume lines (backup) and references to unused source files (`tapestry-key-paths`). Some of
  them can reach a live instance unless they are stubbed.
- `test/stack-free-npm-test.test.js`, whose G5 checks that every suite file is registered. It runs suites in child
  processes, and some of those reach a control panel when one is running. The registration is checked directly
  instead: `test/container-apt-refresh.test.js` is in `suites`.

## Review-time and staging checks (not automated)

- **R1. The Dockerfile diff adds lines only between the last npm step and `COPY .`.** Any change above it would rebuild
  every later step once, on every target.
- **R2. Optional: the cache, on a real build.** This one is heavy: the first build takes 20–30 minutes here.
  1. Run `docker build -t apt-refresh-check:a --build-arg PACKAGES_REFRESH=2026-W47 .`.
  2. Run it again with `apt-refresh-check:b` and `PACKAGES_REFRESH=2026-W48`.
  3. In the second build, every step above the refresh step should show `CACHED`.
  4. Then remove both images.
- **R3. The PR to `staging` carries the note for tags and magic-carpet.** It covers ADR recipe 3, says it runs only on
  David's yes, and says that a full rebuild is unsafe on magic-carpet.
- **S1. On staging, after the merge, from GitHub alone:**
  - the deploy's log shows `packages refresh 2026-Wnn: N to upgrade`;
  - the steps above it show as `CACHED`;
  - the run took a few minutes more than a warm deploy (`gh run view <id> --log`).
- **S2. On staging, on David's yes.**
  - Over SSH, run `docker exec tapestry cat /etc/tapestry/packages-refresh`, and check the NGINX and Neo4j versions
    with `dpkg-query -W nginx neo4j`.
  - Neo4j's log shows APOC and GDS loaded, and the staging smoke test (`docs/SMOKE_TEST.md`) passes.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-21 at commit `e99166177` (branch
`feat/container-apt-refresh`), with `node test/container-apt-refresh.test.js`:

```
container-apt-refresh: 2 passed, 18 failed, 4 skipped
```

- **The 18 failures** are D1–D6, C1, P1, O1–O4, W1 for all four workflows, and W2 for `deploy-staging.yml` and
  `deploy-magic-carpet.yml`. Each fails on a contract assertion: "… not implemented yet (ADR container-apt-refresh/0001)"
  for the step, the compose argument, the build argument and the docs. W2 says "exited 0 after `docker compose up -d
  --build` failed, so its run would show green".
- **The 2 passes** are W2 for `deploy-tapestry.yml` and `deploy-tags.yml`, the guards above.
- **The 4 skips** are L1–L4, off.
- **With `TAPESTRY_LIVE_DOCKER_CHECKS=1`,** L1–L4 fail too: "the Dockerfile must declare `ARG PACKAGES_REFRESH` for the
  refresh step: not implemented yet". That happens before any container starts.

**The harness itself was checked against the ADR's step.** The step was put into the Dockerfile for the length of one
run, and the file was then restored byte for byte, so nothing of it is committed. In that run:
- D1–D6 and L1–L4 passed;
- L1 upgraded a 2026-05-09 base, left the stand-ins as they were, and had nothing waiting afterwards;
- L2 failed with no network;
- L3 caught nodejs moving.

So once the step is in, a failing L test means the step is wrong, not the harness.

**The baseline of the other seven suites in the scoped gate,** before any change, on this Mac:
- `workflow-hardening`: 36/0. `ci-test-job`: 14/0. `brains-launcher-repo`: 31/0. `neo4j-query-public-reads`: 30/0,
  with 1 skip. `neo4j-sizing-override`: 16/0. `safe-to-merge-check`: 16/0.
- `router-stream-limit-on-connect`: 23 passed and 3 failed.
  - The three failures, P1–P3, run `patches/strfry-router/apply-patches.sh`, which needs GNU `sed`; this Mac has BSD
    `sed`. CI runs on Ubuntu, where they pass.
  - The suite's D1–D3, which read the Dockerfile, pass.
  - This story doesn't touch the patch script, so those three stay as they are here.

## Amendment 1 (2026-11-21, after review round 1; the owner's "Fix all, option (a)")

Review round 1 (`engineering-team/reviews/container-apt-refresh/1-deploys-refresh-ubuntu-packages.md`) and ADR
Amendment 1 add three tests to the suite, one for each finding that changes the step or a doc's claim. They join the
coverage map above:

| Criterion | Test | Level |
|---|---|---|
| AC-2 | **D7** the count's simulation takes the upgrade's own options, `--no-remove` and `-o APT::Get::Always-Include-Phased-Updates=true`, so the marker counts what the upgrade does | source |
| AC-4, AC-5 | **O5** OPERATIONS.md §3's weekly refresh paragraph and `docs/SAFE_TO_MERGE.md`'s refreshing-deploy section each name the deploy that changes a step above the refresh (`package.json`, `patches/strfry-`) and how to see one before a merge (`gh pr diff`) | source |
| AC-5 | **O6** the by-hand section's recipe 1 says its refresh lasts only until the next deploy, which reuses this week's earlier refresh, and no longer says it lasts because the new image carries it | source |

- **The registry's comment** now counts the suite's four live checks, L1–L4 (round 1's non-blocking 3).
- **Not tested: SAFE_TO_MERGE's tags line** (non-blocking 2). It is one sentence, and the review checks it.
- **What's still a review check.** No test runs BuildKit, which this Mac lacks, so recipe 1's mechanism is a review
  check (ledger row `2026-11-21-local-docker-builds-skip-buildkit`). O6 holds only the doc's claim.
- **The scoped gate** for this round is derived from the final diff at review time, as round 1's was
  (`tmp/review-container-apt-refresh/derive-gate.js`). It replaces the hand-built list under "How to run".

**Verification.** Confirmed on 2026-11-21 at `d24924d78` plus this commit's tests, with
`node test/container-apt-refresh.test.js`:

```
container-apt-refresh: 20 passed, 3 failed, 4 skipped
```

- **The 3 failures** are D7, O5 and O6, each on its contract assertion:
  - D7: "it lacks --no-remove and APT::Get::Always-Include-Phased-Updates=true";
  - O5: "OPERATIONS.md §3 lacks package.json", and the same for `patches/strfry-` and `gh pr diff` in both docs;
  - O6: "recipe 1 must say its refresh lasts only until the next deploy".
- **The 20 passes** are round 1's 20, unchanged.
- **The 4 skips** are L1–L4, off.
