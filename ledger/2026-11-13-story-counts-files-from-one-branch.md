# A story about "every workflow" counted the workflows on one branch

**Id:** 2026-11-13-story-counts-files-from-one-branch
**Type:** meta
**Opened:** 2026-11-13 (workflow-hardening #1, review round 1, non-blocking 4)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The story.** `workflow-hardening` #1 says "every workflow" and "five of the seven". Planning read
  `.github/workflows/` on `staging`.
- **Another branch.** `feature-magic-carpet`, a long-lived deploy branch, holds two workflow files that `staging`
  doesn't, and both name deploy secrets.
- **What follows.** The story's rules reach that branch when the change does, and the guard will fail there on files
  the story never saw. The Reviewer found them from local refs.

**Fix shape.** When a story is about every file of one kind, intake lists that kind on each branch in
`scripts/long-lived-branches.txt`, and the story says which branches it covers.

**Pointer:** `engineering-team/reviews/workflow-hardening/1-harden-the-github-workflows.md` (non-blocking 4, Harness
friction 5); `scripts/long-lived-branches.txt`; `engineering-team/audits/workflow-hardening/book.md` ("What stays
open").
