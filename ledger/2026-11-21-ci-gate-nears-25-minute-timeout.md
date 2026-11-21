# On a slow runner the stack-free CI gate now ends two to four minutes inside its 25-minute timeout

**Id:** 2026-11-21-ci-gate-nears-25-minute-timeout
**Type:** meta (the CI test gate, OPERATIONS.md §15)
**Opened:** 2026-11-21 (story test-suite-hermeticity #4, review round 2, reading PR TapestryProtocol/tapestry#181's checks)
**Status:** OPEN
**Done:** —

**What was seen.** Row `2026-11-20-ci-gate-outgrows-its-timeout` raised the `stack-free` job's `timeout-minutes` from 15 to 25 on 2026-11-20, and closed. A day later the gate is close to the new limit again whenever GitHub gives it a slow runner. The `Test` workflow runs only on pull requests, so staging's own timing is a pull request's. These nine runs all tested staging with export nostr (#183) and seed-firmware (#182) in it, and every one passed. In each, `operations` ran the same 1,504 passed and 20 skipped tests:

| Run | PR | Runner | `npm test` step | `operations` | Job |
|---|---|---|---|---|---|
| 44875787707 | #183 | Azure eastus | 22 m 37 s | 913 s | **22 m 53 s** |
| 44920941218 | #187 (docs only) | Azure centralus | 20 m 52 s | 818 s | 21 m 16 s |
| 44937221100 | #181 | Azure westcentralus | 20 m 58 s | 801 s | 21 m 16 s |
| 44936164615 | #189 | Azure westus2 | 20 m 52 s | 810 s | 21 m 12 s |
| 44920240157 | #185 (docs only) | Azure westus2 | 20 m 40 s | 808 s | 20 m 59 s |
| 44878655853 | #184 (promotion to `main`) | Azure centralus | 16 m 40 s | 643 s | 16 m 55 s |
| 44920460947 | #186 (docs only) | AWS us-east-1 | 14 m 59 s | 569 s | 15 m 18 s |
| 44930167680 | #188 | AWS us-east-1 | 14 m 47 s | 557 s | 15 m 06 s |
| 44943273237 | #181 | Azure eastus2 | 13 m 47 s | 484 s | 13 m 58 s |

- **Headroom.** The slowest run had 2 m 07 s left. The other four slow runs had 3 m 44 s to 4 m 01 s, and the four fast ones 8 to 11 minutes. Staging has since gained about 30 s more on a slow runner: `suite-env-changes` (#181, 24.7 s in run 44937221100) and `firmware-install-leaves-tags-once` (#189, 8.0 s in run 44936164615). So on staging's tip today, by that arithmetic, the slowest runner seen would have about a minute and a half left, and a typical slow one about three.
- **The runner makes most of the spread, and nothing picks it.** The same tests took 484 s to 913 s. The cloud and region in each log's "Runner Image Provisioner" block don't predict the speed: Azure ran both the slowest and the fastest. Five of the nine runs got a slow runner. The limit has to fit the slowest runner GitHub hands out, not the typical one.
- **Growth.** Run 44873425891 (PR #181 at `4a2c2065`, before #182 and #183 were merged into its branch, on Azure westus3) took 16 m 48 s, with `operations` at 582 s for 1,327 passed and 10 skipped. Those two stories added 15 of the 111 files under `test/operations/`. On the 96 files both trees share, the nine runners above took 0.65 to 1.24 times as long as that westus3 runner. Scaled back by each run's own factor, the 15 new files cost 155 to 159 s in every one of the nine runs. That is about 85 s a story on a typical slow runner, and 96 s on the slowest. By that arithmetic, one more operations story of that size takes the slowest runner seen past 25 minutes, and three take a typical slow runner past it.
- **What a cancelled run costs.** On `main` the check is required: `main`'s ruleset requires `stack-free` and `main-source-guard`, so a cancelled run blocks a promotion. On `staging` it is advisory, but a cancelled run still shows red with no test failed, and §15 forbids running it again by hand.

**Where the time goes.** `operations` is about 64% of `npm test` on a slow runner (801 s of about 1,250 s on the median run). The gate (`test/helpers/gateRunner.js`) runs one suite at a time in one process, and `operations` runs its 111 files one after another (`runDiscovered` in `test/operations.test.js`). The time is spread across those files: the slowest 3 hold 17% of `operations`, the slowest 10 hold 36%, and the slowest 20 hold 55%. The slowest ten, as medians over the nine runs, with the range across them:

| File under `test/operations/` | Tests | Median | Range |
|---|---|---|---|
| `lifecycle/seed-firmware.test.js` | 40 | 57.9 s | 32.9–65.6 s |
| `export/nostr-send.test.js` | 24 | 44.9 s | 29.9–51.0 s |
| `lifecycle/migrate-job.test.js` | 6 | 32.1 s | 23.1–35.0 s |
| `graph/add-to-concept.test.js` | 60 | 28.2 s | 16.7–36.0 s |
| `rules/repair.test.js` | 16 | 23.3 s | 13.7–26.1 s |
| `graph/move-element.test.js` | 44 | 21.0 s | 12.3–23.6 s |
| `graph/enumerate.test.js` | 31 | 20.7 s | 12.2–23.4 s |
| `graph/update-node.test.js` | 46 | 20.2 s | 11.9–21.6 s |
| `graph/create-element.test.js` | 39 | 20.1 s | 12.0–24.9 s |
| `export/nostr-letters.test.js` | 12 | 18.3 s | 10.7–20.6 s |

Of these ten, `migrate-job.test.js` costs the most per test: its tests wait out a 4 s stand-in job and walk a fake graph of 100,003 keys.

**Fix shape.** Which fix to take is the owner's call. The no-retry rule in §15 holds either way: a cancelled run is not run again by hand.
1. **Raise `timeout-minutes` again,** in `.github/workflows/test.yml`. With it go an Amendment 2 to ADR `engineering-team/decisions/done/test-hermeticity-ci/0001-ci-test-job.md` (its Decision table names 25, and Amendment 1 says why), W7 in `test/ci-test-job.test.js` (its pattern pins `timeout-minutes:\s*25\b`), and the sentence in OPERATIONS.md §15 that names the 25 minutes. It is quick and costs a passing run nothing; a real hang just takes longer to be cancelled. It buys time, not speed: at about 96 s a story on the slowest runner seen, 30 minutes holds about four more stories like these two, and 35 about seven.
2. **Make `operations` faster.** Trimming one file buys little, since the time is spread out: the slowest three hold 17% of it. The bigger levers are in how it runs: the gate runs one suite at a time, and `operations` one file at a time. Running files side by side, or splitting the job, is a design change for its own story and ADR. The gate engine checks each suite's `process.env` in turn (story test-suite-hermeticity #4). ADR 0001 has one job with a stable check name, and `main`'s ruleset requires `stack-free` by that name.

**How it was measured.** Job and step times come from `gh run view <id> --json jobs`. A top-level suite's time comes from its `[n/N] <suite>: PASS (…) <ms>ms` line in `gh run view <id> --log`. A file's time under `test/operations/` comes from the log timestamps of its `=== operations: <title> ===` heading and its `operations: <title>: N passed` line. The runner's cloud and region come from the log's "Runner Image Provisioner" block.

**Pointer:** `.github/workflows/test.yml`; `test/ci-test-job.test.js` W7; OPERATIONS.md §15; `engineering-team/decisions/done/test-hermeticity-ci/0001-ci-test-job.md`; `test/operations.test.js` (`runDiscovered`); `test/helpers/gateRunner.js`.
