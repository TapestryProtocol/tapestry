# `/cycle-prod` opens `staging → main` as if it always merges cleanly, but selective `promote/*` promotions make main diverge from staging

**Id:** 2026-11-16-cycle-prod-assumes-clean-promotion
**Type:** meta
**Opened:** 2026-11-16 (story graph-operations-foundation #10's promotion, TapestryProtocol/tapestry#82)
**Status:** OPEN
**Done:** —

**What was seen.** `/cycle-prod` (`.claude/skills/cycle-prod/SKILL.md`, step 2) opens its promotion PR with `--head staging --base main`. On 2026-11-16 that could not merge:
- **Staging was ahead.** It held 398 commits main didn't, from 61 PRs.
- **Main was ahead too.** It held 47 commits staging didn't. Since 2026-11-05, promotions had gone through selective `promote/*` branches:
  - tagging-edges story 7, built and promoted on main's line (staging has it as #37, #41 and #42);
  - main's own openapi gap list;
  - production's deploy workflow (#58).

  Nothing merged main back into staging afterwards.
- **So `staging → main` conflicted in 10 files.** The skill's error handling names `BLOCKED` and `BEHIND`, not a conflict. It never mentions the `promote/*` branches that `guard-main-source.yml` allows into main, or merging main back into staging.

**What was done.**
1. **A reconciling branch.** `promote/staging-2026-11-16` was built from staging with main merged in. Each conflict was resolved by taking staging's later version, or by keeping both sides in date order.
2. **A check that production would run what staging verified.** `src/`, `ui/`, `bin/` and `firmware/`, the Dockerfile, the package files, `setup/` and `deploy-tapestry.yml` were all byte-identical to staging's.
3. **The promotion and the merge back.** That branch went into main as #82, and main came back into staging as #84.

One slip on the way: running `git checkout -b` in the middle of the merge dropped the merge state, so the first commit had one parent, not two. It was redone before pushing.

**Fix shape.** The skill should say three things:
- **When staging doesn't merge into main cleanly:**
  1. build `promote/<date>` from staging, naming the branch first (`git switch -c`) and only then merging main;
  2. resolve the conflicts;
  3. check the runtime paths are identical to staging's;
  4. open that branch's PR.
- **After any promotion through `promote/*`,** merge main back into staging, so the next promotion starts from lines that agree.
- **Every PR into main** comes from staging, a `promote/*` branch or a `hotfix/*` branch (`guard-main-source.yml`).

**Pointer:** `.claude/skills/cycle-prod/SKILL.md`; OPERATIONS.md §1, "Standard branch promotion flow"; TapestryProtocol/tapestry#82 (its "How this branch was made") and #84.
