# Epic: test-gate-speed

**Created:** 2026-11-21
**Status:** Done (epic retired 2026-11-22 at the test-gate-speed book close: story 1 Done, review PASS at round 3, on TapestryProtocol/tapestry#201 to `staging`, which carries the close; merging it waits for David's yes)
**Book:** `engineering-team/audits/test-gate-speed/book.md` (acceptance frame, Standard; Refactor lane)
**Provenance:** `engineering-team/stories/_intake.md`, 2026-11-21: "The stack-free gate runs one suite at a time, and
each operations story adds about a minute and a half to every pull request (refactor)". On 2026-11-21 the owner chose to
raise the CI job's time limit to 40 minutes first (TapestryProtocol/tapestry#191) and to make the gate faster after
that. This epic is that second step.

## Goal

The `stack-free` check gives its verdict in at most half the time it takes today on the same runner, and gives the same
verdict: the same tests, the same counts, no retries. Each operations story then costs every pull request about half
as much time as it does today.

## Why it matters

GitHub picks the runner, and on a slow one the check takes about 21 minutes. In two days it outgrew a 15-minute limit
and then neared a 25-minute one. Each operations story the size of export nostr adds about a minute and a half on a
slow runner. A gate that slow costs every pull request its wait, and it blocks promotions to `main` when it is
cancelled, since `stack-free` is required there and §15 forbids running a cancelled run again.

## Stories

`stories/done/test-gate-speed/`:

1. **stack-free-gate-in-half-the-time:** the same verdict in at most half the time on the same runner, with one check
   named `stack-free`, one command, no retries and no new flakes. Refactor, Standard.

## Out of scope (whole epic)

- Making single suites faster. The time is spread across many files.
- The 40-minute limit, which stays a hang guard.
- `main`'s ruleset and `staging`'s branch rules.
- e2e and Playwright in CI, and the live suites (ADR `test-hermeticity-ci/0001`).

## Related

- Ledger row `2026-11-21-ci-gate-nears-25-minute-timeout`: nine runs of one tree, and the slowest ten files.
- ADR `engineering-team/decisions/done/test-hermeticity-ci/0001-ci-test-job.md`, Amendments 1 and 2: one job, a stable
  check name, no retries.
- OPERATIONS.md §15, the CI test gate.
- Epic `honest-test-gate` (the gate engine and its run record) and story `test-suite-hermeticity` #4 (the
  `process.env` check around every suite). This epic keeps every guarantee they made.
