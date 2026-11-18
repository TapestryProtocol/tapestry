# A gate run before the commit can't see harness-lint's L10, and the Implementer's phase never says to rerun the lint once committed

**Id:** 2026-11-18-gate-before-commit-misses-lint-l10
**Type:** meta
**Opened:** 2026-11-18 (review of `test-suite-hermeticity` #3, round 1, harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** L10 reads commits. It checks that the latest commit touching a harness-definition path also touched `engineering-team/CHANGELOG.md`, so a gate run on an uncommitted tree can't see a commit that doesn't exist yet.
- Story `test-suite-hermeticity` #3's implementer ran three green scoped gates, harness-lint among them, on `92554055+dirty`.
- Then it committed `7b6e0e24`, which changed `.github/workflows/test.yml` with no CHANGELOG row.
- harness-lint then failed L10 on the committed tree. CI's `stack-free` check, which checks out the full history, would have failed too.

The review notes the same miss in `honest-test-gate` #2.

**Fix shape.** One of these:
- Workflow 4, and each phase's per-phase commit step, says to rerun `bash scripts/harness-lint.sh` on the committed tree.
- Or the lint learns to judge the working tree's diff as if it were the next commit.

**Pointer:** `scripts/harness-lint.sh` (L10); `engineering-team/workflows/4-implementation.md`; `engineering-team/reviews/test-suite-hermeticity/3-rw7-times-restarts-from-the-real-start.md`, blocking 1 and harness friction 1.
