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

- [ ] **A running install holds merges.** While either install runs on an instance, that instance's deploy-safety answer is unsafe, with a reason that names the install, and the safe-to-merge check waits for it. (`deploy-safety-gate` #4.)
- [ ] **Nothing sticks.** When an install ends, however it ends, the answer stops reporting it. That includes an install cut off by a restart. (#4.)
- [ ] **The procedures say what to check.** The written procedure tells whoever starts an install to check first that no deploy of that instance is running or queued. The gap that remains has a ledger row. (#4.)
- [ ] **Staging and production, seen working.** The fix reaches both. On each, during one install the owner approves, the check run against that instance waits with the install's reason, then answers safe once the install ends. The journals are recorded here.
- [ ] **The ledger says so.** Row `2026-11-21-deploy-safety-misses-firmware-installs` is closed with its pointers, so an install no longer needs the owner to hold merges.

## Epics in this book

- `deploy-safety-gate` — story 4 (the epic stays Done; this book carries the active-work signal, as `audits/negentropy-sync-access/` did for `security-auth-exposure`'s stories 4–7, per OPEN.md row 268).

## Known constraints acknowledged at kickoff

- **The local container is off-limits.** It is the owner's private agent-memory instance: not checked, not touched, and no full `npm test` on this Mac.
- **Every write to staging or production needs the owner's yes, each time.** That covers SSH, a deploy and an install, the evidence installs included.
- **The TA pubkey is never hardcoded** (CLAUDE.md).

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/deploy-safety-sees-installs/audit.md`
- Product feedback: `engineering-team/audits/deploy-safety-sees-installs/prd-seed.md`
