# Book of Work: The deploy-safety answer sees a running firmware install

**Slug:** deploy-safety-sees-installs
**Status:** Open
**Opened:** 2026-11-21
**Closed:** —
**Strictness:** Standard (project default; no Light profile).

## Intent anchor

**Acceptance frame (no PRD).** The ask (2026-11-21) came out of community-reference #39's rollout (book `audits/header-tags-once/`). Two staging reinstalls were cut off that day by merges whose deploys recreated the container, each right after the safe-to-merge check had answered safe. The ask: make the deploy-safety answer see a running firmware install, so the check waits for one instead of answering safe. Source: ledger row `2026-11-21-deploy-safety-misses-firmware-installs`. The owner's three answers at planning are folded in:
- both installs count: today's install route and `lifecycle seed-firmware`;
- the written procedure also tells whoever starts an install to check first that no deploy of that instance is running, and the gap that remains goes into the ledger;
- done covers staging and production, each seen working during one install the owner approves.

### Acceptance frame

- [x] **A running install holds merges.** While either install runs on an instance, that instance's deploy-safety answer is unsafe, with a reason that names the install, and the safe-to-merge check waits for it. (`deploy-safety-gate` #4: Done, and on `staging` since TapestryProtocol/tapestry#204; see Rollout evidence.)
- [x] **Nothing sticks.** When an install ends, however it ends, the answer stops reporting it. That includes an install cut off by a restart. (#4.)
- [x] **The procedures say what to check.** The written procedure tells whoever starts an install to check first that no deploy of that instance is running or queued. The gap that remains has a ledger row. (#4. The staging evidence install found the check misses a deploy that has just finished: ledger row `2026-11-22-install-after-a-deploy-loses-neo4j`.)
- [ ] **Staging and production, seen working.** The fix reaches both. On each, during one install the owner approves, the check run against that instance waits with the install's reason, then answers safe once the install ends. The journals are recorded here.
- [ ] **The ledger says so.** Row `2026-11-21-deploy-safety-misses-firmware-installs` is closed with its pointers, so an install no longer needs the owner to hold merges.

## Epics in this book

- `deploy-safety-gate` — story 4 (the epic stays Done; this book carries the active-work signal, as `audits/negentropy-sync-access/` did for `security-auth-exposure`'s stories 4–7, per OPEN.md row 268).

## Known constraints acknowledged at kickoff

- **The local container is off-limits.** It is the owner's private agent-memory instance: not checked, not touched, and no full `npm test` on this Mac.
- **Every write to staging or production needs the owner's yes, each time.** That covers SSH, a deploy and an install, the evidence installs included.
- **The TA pubkey is never hardcoded** (CLAUDE.md).

## Rollout evidence

### Staging (2026-11-22)

**The fix reached staging.**
- **Check and merge.** The safe-to-merge check answered safe on its first attempt, at 04:49:00 UTC. TapestryProtocol/tapestry#204 was merged at 04:49:04 (merge `c43cbd7f6`).
- **Deploy.** Run 44986704127 ran from 04:49:07 to 04:50:47.
- **Smoke test.** It was clean, and `/api/deploy-safety/status` carried `firmware: { installCount: 0, installs: [] }`.

**The evidence install, on the owner's yes ("Run it now").** At 04:53:29 the pre-check found no staging deploy running or queued. The install ran over SSH, as the loopback call, from 04:53:38 to 04:55:56.
- **The answer six seconds in:** `{"verdict":"unsafe","reasons":["FIRMWARE_INSTALL_RUNNING"],"firmware":{"installCount":1,"installs":[{"install":"firmware-install","startedAt":"2026-11-22T04:53:39.515Z"}]}}`.
- **The check against staging, at its canonical numbers,** journaled this, raw bodies left out:

  ```
  [2026-11-22T04:53:51Z] attempt 1/45 verdict=unsafe reasons=["FIRMWARE_INSTALL_RUNNING"]
  [2026-11-22T04:54:51Z] attempt 2/45 verdict=unsafe reasons=["FIRMWARE_INSTALL_RUNNING"]
  [2026-11-22T04:55:51Z] attempt 3/45 verdict=unsafe reasons=["FIRMWARE_INSTALL_RUNNING"]
  [2026-11-22T04:56:52Z] attempt 4/45 verdict=safe reasons=[]
  SAFE — merge may proceed …
  ```

  It waited while the install ran, and let go within a minute of the end. No merge followed: the check ran as evidence only.

**The install's own result found a gap of its own.**
- **What happened.** Another session merged #205 at 04:51:47, and its deploy recreated the container again, finishing at 04:53:18. So the install began 20 seconds after the recreate. Its Neo4j-driver reads failed: the 12 graph-rule reads in Pass 1b, and the 41 lookups in Pass 2, which reported "not found". Even so, it answered success.
- **No damage,** since no firmware file had changed since the last full install. Staging's tag schema and its six community-reference headers checked out after it.
- **Recorded in** ledger row `2026-11-22-install-after-a-deploy-loses-neo4j`.

**Raw records,** git-ignored, are in the main checkout's `tmp/deploy-safety-sees-installs/staging-2026-11-22/`.

### Production

Not yet. It follows once #204 reaches `main`, on the owner's yes.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/deploy-safety-sees-installs/audit.md`
- Product feedback: `engineering-team/audits/deploy-safety-sees-installs/prd-seed.md`
