# Two sessions promoted one staging bundle to main at once, because `/cycle-prod` looks only for an open promotion headed at `staging`

**Id:** 2026-11-17-parallel-promotions-of-one-bundle
**Type:** meta
**Opened:** 2026-11-17 (the promotion of graph create-set and graph walk: TapestryProtocol/tapestry#116, #117 and #118)
**Status:** OPEN
**Done:** —

**What was seen.** Two sessions under the same GitHub account promoted the same bundle, on the owner's word in each session, without either seeing the other.
- **#116** was opened at 04:39:29Z by the A10.14 session (graph walk), from `promote/graph-walk-and-create-set-2026-11-17`, pinned at staging's `8c2ea9bc`.
- **#117** was opened later by the A10.27 session (graph create-set). Before opening it, that session looked for an open promotion with `gh pr list --base main --head staging`. That doesn't list a promotion from a `promote/*` branch, the head ledger row `2026-11-17-promotion-pr-head-moves-with-staging` now recommends. It then replaced #117 with **#118**, from `promote/create-set-and-walk-2026-11-17`, pinned at the same `8c2ea9bc`.
- **Both sessions** ran the safe-to-merge check against production, which reported unsafe (`QUEUE_TASK_RUNNING`) while its search-index refresh ran.
  - #116's check saw SAFE at 05:08:09, on its third attempt, and #116 merged at 05:08:11, pinned with `--match-head-commit 8c2ea9bc`.
  - #118's check saw SAFE at 05:08:12. Its merge command, at 05:08:25, found it already merged: GitHub marks a PR merged once its head is in the base, so #118 added no commit to main.
- **Nothing wrong shipped,** because both pins named one commit. With different pins, or one of them unpinned, the second merge would have shipped a second bundle on the first one's approval.

**Why it matters.** Each promotion's approval covers one bundle, and two open promotions into main split that check. Each one's description, safe-to-merge verdict and smoke test then describe a merge that another session may make first. The sessions that start parallel build sessions are also the ones likeliest to finish them close together and promote.

**Fix shape.**
- **`/cycle-prod` step 1:** before opening a promotion, list every open PR into main, whatever its head: `gh pr list --repo TapestryProtocol/tapestry --base main --state open`. If one is open, don't open another: say so, name it, and let the owner choose whether to use it or close it.
- **Shared notes:** a session about to promote writes one line in its family's shared notes folder first, and reads the folder for another session's line.
- **Optional:** `guard-main-source.yml` could refuse a promotion PR while another into main is open.

**Pointer:** `.claude/skills/cycle-prod/SKILL.md`, steps 1 and 2; ledger row `2026-11-17-promotion-pr-head-moves-with-staging`; TapestryProtocol/tapestry#116, #117 (closed for #118) and #118.
