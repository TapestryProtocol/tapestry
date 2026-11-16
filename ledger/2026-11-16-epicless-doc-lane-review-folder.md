# No rule says which folder takes a doc-lane review that no active epic owns

**Id:** 2026-11-16-epicless-doc-lane-review-folder
**Type:** meta
**Opened:** 2026-11-16 (doc-lane review `harness-self-improvement/main-guard-actions-policy-2026-11-16`, harness friction 3)
**Status:** OPEN
**Done:** —

`engineering-team/workflows/0-intake.md` step 3 gives a doc-lane review the path `reviews/<epic>/<slug>.md`, but doesn't say which folder takes one that no active epic owns. The change behind this row's review, the Actions policy that keeps `main-source-guard` running, touched the guard's workflow, `.github/rulesets/`, OPERATIONS.md §4 and `/cycle-prod`, and no active epic owns any of them. The guard's last change before it (`cb6c8b82`) and the rulesets' commit (`c8b24d87`) had no epic, and `workflow-hardening`, which last changed six of the eight workflows, is retired under `reviews/done/`. The Reviewer followed precedent into `reviews/harness-self-improvement/`, beside 14 other non-numbered reviews, though that epic's file says Done (`epics/harness-self-improvement.md:3`).

**Fix shape.** One line in 0-intake step 3 naming the home for an epic-less doc-lane review: `harness-self-improvement`, made explicit, or a standing folder such as `reviews/doc-lane/`. Decide together with OPEN.md row `2026-11-16-lint-mislabels-doc-lane-reviews`, since both are about how the lint and the folders read a doc-lane review.

**Pointer:** `engineering-team/workflows/0-intake.md` step 3; `engineering-team/reviews/harness-self-improvement/main-guard-actions-policy-2026-11-16.md`, "Harness friction" 3.
