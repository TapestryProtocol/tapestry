# `/cycle-prod` treats the approved bundle as fixed when the PR opens, but its head is `staging`, so later merges into staging join the promotion

**Id:** 2026-11-17-promotion-pr-head-moves-with-staging
**Type:** meta
**Opened:** 2026-11-17 (the promotion of book `guard-only-pull-request-target`: TapestryProtocol/tapestry#108, closed, and #112)
**Status:** OPEN
**Done:** —

**What was seen.** `/cycle-prod` step 2 opens the promotion PR with `--head staging --base main`. Step 4 then says the
approval "covers *what ships* (the bundle, fixed at PR-open)". The bundle isn't fixed: the PR's head is the `staging`
branch, so anything merged into staging before the promotion merges joins it.
- **#108** opened at 2026-11-17 02:27:41Z, carrying #105 and #106, the bundle the owner had just approved.
- **#107** merged into staging at 02:35:21Z and joined #108. That restarted its `stack-free` check, and the owner then
  approved the larger bundle.
- **#109,** another session's code change, merged at 02:44:44Z and joined it too, before the restarted check finished.
- **Nothing wrong merged.** The merge was pinned with `gh pr merge --match-head-commit <sha read when the bundle was
  approved>`, and the script stopped when the head no longer matched.
- **The fix here:** #108 was closed, and the approved bundle went out as #112, from
  `promote/guard-only-pull-request-target-2026-11-17`, a branch pushed at staging's `ff8de6ee`.

On a busy staging, each merge also restarts the promotion's roughly eight-minute `stack-free` run. So a promotion
opened from `staging` may never sit still long enough to merge.

**Why it matters.** The skill's own safeguard, "re-ask only if the bundle changes", rests on a bundle that it doesn't
fix. A merge run straight from the skill, with no pin, would ship whatever reached staging while the checks ran,
including work its own sessions hadn't verified on staging yet.

**Fix shape.**
- **Step 2:** cut `promote/<date>` at the staging commit whose bundle the user approves (`git push origin
  <sha>:refs/heads/promote/<date>`). `guard-main-source.yml` allows `promote/*`. A branch cut on staging's own line
  carries no cherry-pick, so it doesn't make main diverge the way selective promotions do (OPEN.md row
  `2026-11-16-cycle-prod-assumes-clean-promotion`).
- **Step 5:** merge with `--match-head-commit <that sha>`, so a moved head refuses instead of shipping.
- **Step 4:** the sentence says the bundle is the pinned commit's.

**Pointer:** `.claude/skills/cycle-prod/SKILL.md` steps 2, 4 and 5; TapestryProtocol/tapestry#108's closing comment;
TapestryProtocol/tapestry#112.
