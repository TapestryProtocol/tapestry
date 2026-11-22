# A firmware install that starts just after a merger's check said safe can still be cut off by that merge's deploy

**Id:** 2026-11-22-install-starts-after-a-safe-check
**Type:** bug
**Opened:** 2026-11-22 (story deploy-safety-gate #4, book `audits/deploy-safety-sees-installs/`)
**Status:** OPEN
**Done:** —

**What remains after story 4.** Story deploy-safety-gate #4 makes a running firmware install hold the deploy-safety answer unsafe, so a merger's safe-to-merge check waits for it. But an instance can't see an install that hasn't started. This sequence still cuts an install off:
1. A merger runs the check against the instance, and it answers safe.
2. An install starts on that instance.
3. The merger merges. About 90 seconds later, or later on a refreshing deploy, the merge's deploy recreates the container, partway through the install.

**Narrowed by procedure, not closed.** `docs/SAFE_TO_MERGE.md`, "Before a firmware install", has whoever starts an install check first that no deploy of that instance is running or queued. That covers a merge that has already landed. It can't cover a merger who has checked but not yet merged. The recipe has a merger merge right after a safe verdict, so that window is usually seconds, but the recipe's staleness rule allows up to 5 minutes.

**Fix shapes, none chosen:**
- **The deploy workflows ask the answer themselves** before they recreate the container: OPEN.md row 340's fix shape (b). That makes the gate structural. The owner kept it out of story 4 (2026-11-21).
- **The merger takes a hold on the instance** before checking, and an install refuses to start under it.

**Pointer:**
- `engineering-team/stories/deploy-safety-gate/4-deploy-safety-sees-installs.md` (Background, "A gap the answer can't close");
- ADR `deploy-safety-gate/0004` (Consequences, "Known windows");
- OPEN.md row 340.
