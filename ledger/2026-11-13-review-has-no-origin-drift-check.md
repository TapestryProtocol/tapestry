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

**2026-11-21: another instance, with no conflict at all** (community-reference #39, review round 1, Blocking 1).
- **What moved.** The story's ADR was written at `staging` `98c14108e`. In the hours its cycle took, `staging` gained
  `lifecycle seed-firmware`, whose `src/firmware/target.js` rebuilds the very function the story changes, and whose
  ST33 pins that function by digest.
- **How it was found.** `git merge-tree` showed no conflict. Only running the merged tree's suites found ST33's
  failure.
- **What it adds to the fix shape.** "Review the merged tree" means running its suites, not just merging it. The
  suites that read the changed files are listed from the merged tree too (OPEN.md row
  `2026-11-21-no-map-from-diff-to-suites`).

**Fix shape.** Workflow 5 opens the way workflow 1 does: ask the remote for the target branch's tip, and if it has
moved, say by how much and review the merged tree. One `git ls-remote` is enough to know.

**Pointer:** `engineering-team/reviews/workflow-hardening/1-harden-the-github-workflows.md` (round 2, R2-B1 and
Harness friction); `engineering-team/workflows/1-planning.md` step 0; `engineering-team/workflows/5-review.md`.
