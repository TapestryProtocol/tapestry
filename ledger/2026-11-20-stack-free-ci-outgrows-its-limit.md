# The stack-free CI job now outgrows its 15-minute limit, so every pull request's check stops as "cancelled"

**Id:** 2026-11-20-stack-free-ci-outgrows-its-limit
**Type:** meta
**Opened:** 2026-11-20 (story graph-operations-first-slice #32, while checking its ADR pull request, TapestryProtocol/tapestry#162)
**Status:** OPEN
**Done:** —

**What was seen.** `.github/workflows/test.yml`'s `stack-free` job has `timeout-minutes: 15`.
- **The cancelled runs:** on 2026-11-20, two pull requests' runs stopped at that limit, which GitHub shows as cancelled. They were run 44681193649 (A10.31.a's, started 05:27Z) and run 44688318909 (#162's, started 06:30Z, a docs-only change).
- **The trend:** the green runs of 2026-11-19 took 9.5, 11.8, 13.6, 13.1 and 14.2 minutes.
- **What story 32 adds:** about 37 s to the `operations` entry; its suites' times are in the story's Evidence.

**Why it matters.** The check is advisory (OPERATIONS.md §15), so it blocks nothing. But a red that only means "slow" teaches readers to ignore the gate, and §15's no-retry rule leaves each one to the owner.

**What closes it.** A pull request whose own `stack-free` run finishes green within its limit, with room to grow. That can come from a higher `timeout-minutes` (§15's sentence that "a 15-minute timeout guards against hangs" then changes with it), a faster suite, or both.

**Pointer:** `.github/workflows/test.yml`; OPERATIONS.md §15; runs 44681193649 and 44688318909.
