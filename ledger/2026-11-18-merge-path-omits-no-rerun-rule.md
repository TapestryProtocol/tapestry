# Nothing an agent reads on its way to a merge says that a red stack-free check is the verdict, not a cue to run it again

**Id:** 2026-11-18-merge-path-omits-no-rerun-rule
**Type:** meta
**Opened:** 2026-11-18 (review of `test-suite-hermeticity` #3, round 3, harness friction)
**Status:** OPEN
**Done:** —

**What was seen.** OPERATIONS.md §15 says the first run's exit code is the verdict, and that a failed run isn't run again. Nothing on an agent's way to a merge says so:
- the three merge skills (`.claude/skills/cycle-staging`, `cycle-prod`, `cycle-full`) never mention the `stack-free` check;
- AGENTS.md, CLAUDE.md and `docs/SAFE_TO_MERGE.md` don't state the rule either.

Three failed runs have been run again: PR #83's `43808151504`, and RW7's `43985723290` and `44335714732`. GitHub names the agents' account, `nousclawds4`, as the one that started each second attempt. #143's is recorded as coming from a session that hadn't read §15 (ledger row `2026-10-08-realtime-wrapper-timing-flake-under-load`).

**Fix shape.** Say the rule where an agent meets a red check: one line in each `cycle-*` skill's merge step, and in `docs/SAFE_TO_MERGE.md` or AGENTS.md. For example: "A red `stack-free` run is the verdict. Don't run it again; stop and tell the owner (OPERATIONS.md §15)."

**Pointer:** OPERATIONS.md §15; `.claude/skills/cycle-staging/SKILL.md`, `.claude/skills/cycle-prod/SKILL.md`, `.claude/skills/cycle-full/SKILL.md`; `engineering-team/reviews/test-suite-hermeticity/3-rw7-times-restarts-from-the-real-start.md`, round 3's harness friction.
