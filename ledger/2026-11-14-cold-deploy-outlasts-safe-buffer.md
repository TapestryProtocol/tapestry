# A safe-to-merge verdict leaves ten minutes, and a deploy on a server whose image cache is cold takes nine to ten

**Id:** 2026-11-14-cold-deploy-outlasts-safe-buffer
**Type:** meta
**Opened:** 2026-11-14 (the merges of TapestryProtocol/tapestry#58, #59 and #60, each a one-file change to a deploy workflow)
**Status:** OPEN
**Done:** —

**What was seen.**
- **What the docs assume.**
  - `docs/SAFE_TO_MERGE.md` says a safe verdict guarantees at least the buffer, ten minutes by default, to the next
    scheduled task, and that merging within five minutes spends at most half of it.
  - `/cycle-staging` and `/cycle-prod` give a typical deploy as about 80 seconds, and "2m+" when dependencies change.
- **What three deploys took on 2026-11-14.** Each changed one workflow file, so nothing the image is built from:
  - production, run `43625005407`: 9m32s. Its deploy before that was on 2026-11-08.
  - magic carpet, run `43627352495`: 9m40s. Its deploy before that was on 2026-11-03.
  - tags, run `43628534280`: 9m10s. Its deploy before that was on 2026-11-03.

  The same day, staging's deploys of two merges took 1m27s and 1m41s. Staging deploys several times a day.
- **Where the time went.** The magic-carpet log shows the image's system-package layer being rebuilt. The container is
  recreated when the build ends, so the restart comes nine to ten minutes after the merge. Why the cache was cold is
  not diagnosed.
- **The near miss on tags.**
  - At 18:31:21 UTC the check read safe, with the next task due at 18:41:35. That is 614 seconds away, 14 past the
    buffer.
  - A merge then would have recreated the container at about 18:41, as that task started (`refreshPinnedTagTLs`,
    18:41:35).
  - The session held the merge on its own judgment, having just watched production take 9m32s. Nothing in the docs or
    the script asked it to.
  - The check read unsafe (`QUEUE_TASK_RUNNING`) at 18:45:02 and 18:46:03, and safe at 18:47:03. The merge followed at
    18:47:14, and the deploy ended at 18:56:32, 45 minutes before the next task.

**Fix shape.** One of:
- The check is told how long the deploy is expected to run, and asks for that much clear time on top of the buffer. A
  server that has not deployed for some days is assumed to build cold.
- The instance's verdict uses a longer buffer, at least twice the slowest deploy seen.
- The servers keep their build cache warm, so a deploy that changes no build input stays near 80 seconds.

Whichever is chosen, `docs/SAFE_TO_MERGE.md` and the two cycle skills say what a cold build takes.

**Pointer:** `docs/SAFE_TO_MERGE.md` ("The canonical invocation", staleness rule); `.claude/skills/cycle-prod/SKILL.md`
step 6; `.claude/skills/cycle-staging/SKILL.md` step 6; the bodies of TapestryProtocol/tapestry#58, #59 and #60.
