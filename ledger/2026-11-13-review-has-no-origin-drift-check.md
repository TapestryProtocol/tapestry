# Review has no check of where the target branch is, so a review can pass a branch that no longer merges

**Id:** 2026-11-13-review-has-no-origin-drift-check
**Type:** meta
**Opened:** 2026-11-13 (workflow-hardening #1, review round 2, finding R2-B1)
**Status:** OPEN
**Done:** —

**What was seen.**
- **Planning has the check.** `engineering-team/workflows/1-planning.md` step 0 fetches `staging` and says how far
  behind the working base is.
- **Review does not.** Workflow 5 and the Reviewer role take the base ref as given. In `workflow-hardening` #1 the
  first review round ran against a local `origin/staging` four hours old. `staging` had gained 19 commits in that time,
  one of which added a section to OPERATIONS.md in the same place and under the same number as the story's. The second
  round asked the remote and found it.
- **What it would have cost.** A review that passed in round 1 would have been of a branch that could not merge.

**Fix shape.** Workflow 5 opens the way workflow 1 does: ask the remote for the target branch's tip, and if it has
moved, say by how much and review the merged tree. One `git ls-remote` is enough to know.

**Pointer:** `engineering-team/reviews/workflow-hardening/1-harden-the-github-workflows.md` (round 2, R2-B1 and
Harness friction); `engineering-team/workflows/1-planning.md` step 0; `engineering-team/workflows/5-review.md`.
