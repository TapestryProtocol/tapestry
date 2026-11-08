# A promotion of one piece of work leaves main and staging with different commit ids, and /cycle-prod describes only a promotion of all of staging

**Id:** 2026-11-08-selective-promotion-diverges-main
**Type:** meta
**Opened:** 2026-11-08 (tagging-edges book close, audit §7; seen at story 7's promotion)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The bundle.** On 2026-11-08 staging held 123 commits that main lacked, mostly other sessions' unpromoted work.
  The owner chose to ship tagging-edges story 7 alone.
- **How it was shipped.** The promotion was `promote/tagging-edges-7`, a branch off main with the story's 24
  commits copied by `cherry-pick -x`, merged as nousclawds4/tapestry#40.
- **This is not the first selective promotion.** Main has taken several lately, each its own way:
  `promote/openapi-coverage` (nousclawds4/tapestry#29), and `feat/setup-create-account` merged straight into main.
- **What it leaves.** Main and staging now hold the same change under different commit ids. The next promotion of
  all of staging meets the lines both sides touched again. For story 7, that is the `**Last updated:**` lines of
  BIBLE.md and OPERATIONS.md. The work's records also reach main only with that later promotion.
- **What the skill says.** `.claude/skills/cycle-prod/SKILL.md` opens "Promote everything that's currently on
  `staging` but not on `main`". It has no section for a selective promotion: how to build it, which branch to use,
  what to expect at the next full promotion, or whether to merge main back into staging afterwards.

**Fix shape.**
- **Give `/cycle-prod` a selective-promotion section.** Name the two shapes in use:
  - cherry-picks with `-x` onto a `promote/<work>` branch off main;
  - a feature branch merged into main.
- **Say what each leaves behind.** Cherry-picks duplicate the change under new ids; a feature-branch merge carries
  whatever that branch was based on.
- **Decide one convergence step,** for example merging main back into staging right after a selective promotion, so
  the duplicate ids meet once, in a small merge whose conflicts the promoter already knows.
- **Record in the promotion PR which lines will conflict at the next full promotion.**

**Pointer:** `engineering-team/stories/done/tagging-edges/7-confirm-held-removals.md` § Evidence, "Production";
`engineering-team/audits/tagging-edges/audit.md` §7; related: `2026-10-29-cycle-prod-skips-trial-merge`,
`2026-10-29-h2-0-baseline-predates-github-flow`.
