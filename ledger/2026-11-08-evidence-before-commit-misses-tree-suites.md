# A Phase 4 run can't be trusted for a suite whose answer depends on what is committed

**Id:** 2026-11-08-evidence-before-commit-misses-tree-suites
**Type:** meta
**Opened:** 2026-11-08 (graph-operations-foundation #6, Loom A10.6: the review's Harness friction 1)
**Status:** OPEN
**Done:** —

`test/brains-launcher-repo.test.js` W1c reads `git ls-tree HEAD`: every top-level path must either roll the brains or be listed as one they don't run. The Implementer of graph-operations-foundation #6 ran the touched suites and wrote the story's Evidence before the implementation commit. So the new top-level `clients/` didn't exist for W1c yet, and the suite passed 31/0. At the commit CI tests, the same suite fails 30/1. The review caught it (B1): the Evidence row was true for the working tree and false for the commit.

Any suite that reads the committed tree (`git ls-tree`, `git ls-files`, `git show HEAD:…`) behaves this way. Workflow 4 says to run the gate and then commit, which is the wrong order for these suites.

Candidates:
- W1c also counts untracked top-level paths (`git ls-files --others --exclude-standard`), so a working-tree run sees a new folder.
- Workflow 4 step 7 asks for the touched suites to be run again on the committed tree, with nothing uncommitted, before the Evidence is written. The fix round of #6 did that (`c179e7e49`).

**Pointer:** review `engineering-team/reviews/graph-operations-foundation/6-external-cli-and-agent-skill.md` (B1, Harness friction 1); story 6's Evidence ("The suites").
