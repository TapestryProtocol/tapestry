# A test plan named the pull request's CI run as its gate while a suite on staging was already red

**Id:** 2026-11-13-plan-names-ci-gate-already-red
**Type:** meta
**Opened:** 2026-11-13 (workflow-hardening #1, review round 1, finding B2)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The plan.** The test plan for `workflow-hardening` #1 took the story's full gate from the pull request's `Test`
  run, and said that run must be green.
- **The ledger.** OPEN.md row `2026-11-07-reading-writeverbs-raw-publish` had said for six days that every pull request
  into `staging` is red on one test.
- **The gap.** Nothing in Test Design asks whether a registered suite is already red. So the plan promised a result
  the branch could not give, and the Reviewer caught it by reading the ledger.

**Fix shape.**
- **In workflow 3,** when a plan takes its gate from CI, the Tester reads the OPEN `bug` rows that name a failing
  suite, and says in the plan how the run is read while they are open.
- **Or in `/whats-open`,** print the rows that say "red on staging" at the top, where a session starting a plan sees
  them.

**Pointer:** `engineering-team/reviews/workflow-hardening/1-harden-the-github-workflows.md` (B2, Harness friction 4);
`engineering-team/workflows/3-test-design.md`.
