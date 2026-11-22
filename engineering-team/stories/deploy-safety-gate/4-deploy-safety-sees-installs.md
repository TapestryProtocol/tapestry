# Story 4: The deploy-safety answer sees a running firmware install

**Status:** Approved
**Created:** 2026-11-21
**Type:** Bug

## Background

**What happened.** On 2026-11-21, two firmware reinstalls of staging, for community-reference #39, were cut off by merges into `staging`:
- **The first** started at 20:28:01 UTC, as the loopback call `POST http://127.0.0.1:7778/api/firmware/install` inside the container. TapestryProtocol/tapestry#181 was merged at 20:28:09. Its deploy, run 44946433865, recreated the container at about 20:29:40, 1 minute 40 seconds into Pass 1.
- **The second** started at 20:51:08. TapestryProtocol/tapestry#190, a docs-only PR, was merged at 20:51:19. Its deploy, run 44948469514, recreated the container at about 20:52:48, again 1 minute 40 seconds into Pass 1.
- **A third attempt** ran from 22:07:06 to 22:11:46 and finished, because the owner held merges.

Both times, `scripts/check-safe-to-merge.sh https://staging.brainstorm.world` had answered safe a few seconds before the install started.

**Why.** The deploy-safety answer (`GET /api/deploy-safety/status`, story 1) counts three things: the task queue's running jobs, the legacy per-customer runs in flight, and a scheduled task due within the buffer. A firmware install is none of them, so the answer stays safe while one runs, and the safe-to-merge check (story 2) lets the merge through. Every merge into `staging` or `main` redeploys, docs-only ones included: `deploy-staging.yml` has no paths filter, and every deploy recreates the `tapestry` container.

**What a cut-off install leaves.** The concepts Pass 1 reached hold Pass 1's letter, and the rest hold what they held before. The first cut-off left `tag` and `nostr-relay` without their pointer `b` until the next full install. A full install heals it, but until one runs, the graph is in a state no install means to leave.

**Today's workaround.** Whoever runs an install asks the owner to hold merges into that instance's branch until it finishes. That works only when every merger hears about it.

**Two installs.** Today's install is the install route, `POST /api/firmware/install`. The Dashboard's button, the loopback call sessions use, and the install at first start all call it. `lifecycle seed-firmware` (graph-operations-first-slice #37) is the second: ADR graph-operations-first-slice/0043 makes it the install once export nostr can sign what it writes. The owner chose to cover both now (2026-11-21), so the gate doesn't go blind when the install changes.

**A gap the answer can't close.** An instance can't see an install that hasn't started. So an install that starts after a merger's check said safe, but before that merge's deploy recreates the container, is still cut off. The recreation comes about 90 seconds after the merge, and later on a refreshing deploy. Most of that window is a deploy that is already running, which the person starting the install can see. The owner chose (2026-11-21) to have the written procedure tell them to look first. What remains is a merger who has checked but not yet merged. The safe-to-merge recipe has them merge at once, so that is usually seconds. It is recorded in the ledger, not fixed here.

**Who's affected:** anyone who runs a firmware install on a deployed instance, and anyone who merges into a branch that deploys.

**Source:** ledger row `ledger/2026-11-21-deploy-safety-misses-firmware-installs.md` (on branch `docs/header-tags-once-ship-records` until that records PR merges into `staging`), and story community-reference #39's Evidence, "On staging".

## User-facing description

As someone who merges into `staging` or `main`, I want the safe-to-merge check to wait while a firmware install runs on the instance my merge redeploys, so that my merge never cuts an install off and nobody has to ask the owner to hold merges.

As someone who runs a firmware install, I want the written procedure to tell me what to check before I start, so that I don't start one while a deploy of that instance is on its way.

## Acceptance criteria

- [ ] **AC-1 (either install makes the answer unsafe while it runs).** Given an instance with nothing else running or due, when a firmware install starts, then every deploy-safety answer from that instance is unsafe from the moment the install starts until it ends. This holds for:
  - today's install, started through its route by any caller (the Dashboard's button, the loopback call, the install at first start), a dry run included;
  - `lifecycle seed-firmware`, run through its route or from a shell inside the instance.

  The answer gives a reason of its own, which says a firmware install is running and is none of the existing four. It also says which install is running and when it started, and nothing about who started it.
- [ ] **AC-2 (the answer lets go when the install ends, however it ends).** Given an install is running, when it finishes, fails with an error, or is refused before it writes anything, then the next answer no longer reports it. With nothing else running or due, that answer is safe. When two installs overlap, the answer stays unsafe until the last of them ends.
- [ ] **AC-3 (a cut-off install isn't reported afterwards).** Given an install was cut off by a restart of the instance, as a deploy's container recreation does, when the instance is back up, then its answer doesn't report that install as running. This has an explicit automated test, as story 1's phantom exclusion does.
- [ ] **AC-4 (the check waits for an install).** Given an install is running on the instance a merge would redeploy, when the safe-to-merge check runs, then each attempt it journals is unsafe with the install's reason, and it reports safe only once the install has ended. Its numbers stay as they are (45 attempts, 60 seconds apart), which outlast an install of about 4 to 5 minutes.
- [ ] **AC-5 (nothing else changes).** With no install running, the answer is what it is today, field for field. Its other consumers, the safe-to-merge check and the Scheduled Tasks panel's countdown line, behave as before.
- [ ] **AC-6 (the procedures say so).**
  - The safe-to-merge recipe says that installs are covered.
  - The written procedure for running an install on a deployed instance tells the person to check first that no deploy of that instance is running or queued, and says how.
  - It also says that an install that hangs keeps the answer unsafe, so the check stops at its bound, as it does for a long task, and the operator decides.
  - A new ledger row records the gap that remains: a merger whose check came just before the install started.

## Concepts touched

None. This is operational: no concept definition changes, and the answer is about the instance as a deployment, not a point of view (ADR deploy-safety-gate/0001, "POV note").

_(Architect: the local container is David's private agent-memory instance. Don't orient there. If a concept check is wanted, use staging's public `/api/concept-graph/summaries`.)_

## Out of scope

- **Other long jobs a deploy cuts off.** Lifecycle backup, restore and migrate run in a process of their own, which the answer doesn't see either. The owner kept this story to the two installs (2026-11-21). They are queued in `stories/_intake.md`, 2026-11-21.
- **Closing the gap completely.** A deploy that waits for a safe answer before it recreates the container would close it. The gate stays procedural (deploy-safety-gate's 2026-07-18 intake), so that would be a story of its own.
- **Today's install run by hand from the command line** (`node src/firmware/install.js`). No procedure uses it. It needn't be seen, but if it isn't, the procedure says so.
- **Making an install survive a deploy** (draining, or resuming where it stopped). The answer only lets a merger wait.
- **The Scheduled Tasks panel** doesn't show a running install. Its countdown line stays about scheduled tasks.
- **The sandboxes** (`feat/tags`, `feature-magic-carpet`) get the fix when their branches next take staging's changes, not in this book.
- **The local agent-memory container** isn't checked or touched.

## Open questions

For the Architect:
1. **Seeing an install in a process of its own.** `lifecycle seed-firmware` run from a shell inside the instance is not the control panel's process. How is it seen without a record that outlives a restart and then reads as running (AC-3)?
2. **One reason or two.** One reason for both installs with a detail that says which, or one reason each.
3. **Where the installer's procedure goes.** No doc in the repo describes running an install on a deployed instance today. BIBLE §7 names the route, and AGENTS.md §6 the local curl.

## Linked artifacts
- Book: `engineering-team/audits/deploy-safety-sees-installs/book.md`
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
