# After a droplet reboot, a lifecycle lock left by a cut-off run can read as live, because start times count from boot

**Id:** 2026-11-22-reboot-can-revive-a-dead-lock
**Type:** bug
**Opened:** 2026-11-22 (story deploy-safety-gate #4, review round 2, finding 7)
**Status:** OPEN
**Done:** —

**What was found.** This was read in the code, not seen on any instance.

**How the store judges a lock.** `src/operations/catalog/lifecycle/_store.js` (`holderAlive`, `inspectLock`) treats a lock as live while two things hold:
- it names this host;
- one of its holders' process ids answers with the `/proc` start time the lock recorded for it.

That start time is the holder's own (field 22 of `/proc/<pid>/stat`), counted in clock ticks since the host booted.

**How a reboot can defeat it.** After a droplet reboot, `restart: unless-stopped` (`docker-compose.yml`) brings the same `tapestry` container back.
- **The hostname matches:** it's the same container.
- **Process ids start again,** in the container's new process namespace. The control panel, which holds the lock for a seed-firmware run through its route, can come back with the same process id.
- **Start times count from the new boot.** So if the run was cut off by a crash or reboot, the new process can, by chance, have the dead holder's start time. That takes a start at the same tick after boot.

The lock then reads live.

**What follows.**
- **The deploy-safety answer reports a running seed-firmware** (story deploy-safety-gate #4). That fails closed: a merger's check stops at its bound, and the operator decides.
- **The lifecycle operations that take or check the lock refuse `busy`:** backup, restore, migrate, seed-firmware and upload-backup. `recoverIfStale` recovers only a lock it judges stale, so the refusal lasts until one of three things happens:
  - the process holding that pid restarts, and so has a new start time;
  - a deploy recreates the container, which gives it a new hostname;
  - someone removes the lock by hand.
- **The odds are low,** and this predates story 4. Story 4 made it visible: its answer is the first reader outside the lifecycle operations.

**Fix shapes, none chosen:**
- **Record the boot** (`/proc/sys/kernel/random/boot_id`) in the lock, and treat a lock from another boot as stale.
- **Record the container's own start as wall-clock time,** for example process 1's start converted from ticks since boot, and compare that. Kept as ticks, it could coincide after a reboot just as a holder's does. Only the boot-id shape is a full fix on its own.

**Pointer:**
- ADR `deploy-safety-gate/0004` (Amendment 1, item 4);
- `engineering-team/reviews/deploy-safety-gate/4-deploy-safety-sees-installs.md` (round 2, finding 7);
- `src/operations/catalog/lifecycle/_store.js` (`startTimeOf`, `holderAlive`, `inspectLock`, `recoverIfStale`).
