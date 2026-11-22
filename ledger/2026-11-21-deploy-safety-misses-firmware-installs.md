# Deploy-safety answers "safe" while a firmware install runs, so a merge into staging redeploys mid-install and cuts the install off

**Id:** 2026-11-21-deploy-safety-misses-firmware-installs
**Type:** bug
**Opened:** 2026-11-21 (community-reference #39's staging reinstall)
**Status:** DONE
**Done:** 2026-11-22. Story deploy-safety-gate #4 fixed it: TapestryProtocol/tapestry#204 into `staging`, and #206 into `main`. See "Fixed" below.

**What was seen.** Story 39's reinstall of staging was cut off twice on 2026-11-21. Both times the deploy that a merge into `staging` started recreated the `tapestry` container while the install was running:
- **First attempt.** The install started at 20:28:01 UTC, as the loopback call `POST http://127.0.0.1:7778/api/firmware/install` inside the container. TapestryProtocol/tapestry#181 was merged at 20:28:09. Its deploy, run 44946433865, recreated the container at about 20:29:40, and the install's answer came back empty after 1 minute 40 seconds, in Pass 1.
- **Second attempt.** The install started at 20:51:08. TapestryProtocol/tapestry#190, a docs-only PR, was merged at 20:51:19. Its deploy, run 44948469514, started at 20:51:22 and recreated the container at about 20:52:48, again 1 minute 40 seconds into Pass 1.
- **Third attempt.** With the owner holding merges, it ran from 22:07:06 to 22:11:46 and finished.
- **A longer install (2026-11-22).** Tags' reinstall ran about 40 minutes, from 03:29:41 UTC to about 04:09, on a branch without staging's faster Pass 3.
  - A scheduled task (`refreshApplicabilityLists`) started during it.
  - Deploy-safety's ten-minute buffer covered only the install's start.

Both times, `GET /api/deploy-safety/status` had just answered `safe`, a few seconds before the install started.

**Why.** Deploy-safety's verdict (`src/api/deploy-safety/index.js`) counts three things: the task queue's active tasks, the legacy per-customer runs in flight (`customer-schedule`'s `getInFlightCount`), and the next scheduled fire inside the buffer. A firmware install run through `/api/firmware/install` is none of them. So the safe-to-merge check (`scripts/check-safe-to-merge.sh`, `docs/SAFE_TO_MERGE.md`) answers `safe` throughout an install. A docs-only merge redeploys too: `deploy-staging.yml` has no paths filter, and every deploy recreates the container.

**What a cut-off install leaves.** The concepts Pass 1 reached hold Pass 1's letter. The rest hold what they held before. On the first attempt that left two headers, `tag` and `nostr-relay`, without their pointer `b` until the next full install. Their `REFERENCES` to their community headers stayed. Nothing else was found broken, and a full install heals it. But until one runs, the graph is in a state no install means to leave.

**Fix shape (for a story).** Make an install visible to deploy-safety: for example, the install route keeps an in-flight count that the verdict reads, with its own reason, the way the legacy runs do. Then the safe-to-merge check waits for it. Until then, whoever runs an install asks the owner to hold merges into that instance's branch until it reports finished.

**Fixed (2026-11-22).** Story deploy-safety-gate #4 (ADR deploy-safety-gate/0004) shipped the fix shape above.
- **What changed.** While today's install or `lifecycle seed-firmware` runs, `GET /api/deploy-safety/status` answers unsafe with `FIRMWARE_INSTALL_RUNNING`. Its new `firmware` block names the install. So the safe-to-merge check waits for the install instead of answering safe.
- **Seen working on both instances,** each during one install the owner approved.
  - **Staging:** the check journaled three unsafe attempts with that reason, then safe once the install ended.
  - **Production:** it journaled six, then safe.
  - **Records:** the journals are in book `audits/deploy-safety-sees-installs/`, Rollout evidence.
- **Where merges are still held by hand.** On staging and production, an install no longer needs the owner to hold merges, for a merge that runs the check. It still does where a branch lacks the story, and an answer with no `firmware` block shows that: tags (`feat/tags`) and `feature-magic-carpet`, until their branches take staging's changes.

**What stays open, each in a row of its own:**
- `2026-11-22-install-starts-after-a-safe-check`: an install that starts just after a merger's check;
- `2026-11-22-install-after-a-deploy-loses-neo4j`: an install started right after a deploy;
- `2026-11-22-scheduled-task-can-start-mid-install`: the observation "A longer install" above;
- OPEN.md row 340: a merge that skips the check isn't held at all.

**Pointer:**
- `engineering-team/stories/community-reference/39-firmware-install-leaves-tags-once.md` (Evidence, "On staging");
- ADR deploy-safety-gate/0001, 0002 and 0004;
- `docs/SAFE_TO_MERGE.md`;
- story `engineering-team/stories/deploy-safety-gate/4-deploy-safety-sees-installs.md`.
