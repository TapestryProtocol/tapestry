# Live-check plans say to "check the shared notes" before taking the scratch stack, and no such notes exist

**Id:** 2026-11-17-live-check-shared-notes-missing
**Type:** meta
**Opened:** 2026-11-17 (story graph-operations-first-slice #26 review, harness friction 2)
**Status:** OPEN
**Done:** —

**What was seen.** Story 21's test plan, and story 26's after it, say: "Check `docker ps` and the shared notes before taking `tapestry-scratch`, note it there, and take it down afterwards." No file, doc or ledger row holds such notes: a search of the repo for "shared notes" finds only those plans. Story 26's session looked for them, found nothing, and fell back on two things:
- `docker ps`;
- OPEN.md row `2026-11-16-scratch-stack-down-removes-anyones`'s rule: inspect the container's mounts before any `down`, and leave a stack that isn't yours alone.

**Fix shape.** Replace the phrase in the test-plan practice with that row's rule. Or, if a sign-up place is wanted, make one, such as a line in OPEN.md or a file under `tmp/`, and name it. The row's own fix, naming the stack after its worktree, would make the notes unnecessary.

**Pointer:** `engineering-team/stories/graph-operations-first-slice/21-update-node.test-plan.md` and `26-delete-node.test-plan.md`, "The live check"; OPEN.md row `2026-11-16-scratch-stack-down-removes-anyones`.
