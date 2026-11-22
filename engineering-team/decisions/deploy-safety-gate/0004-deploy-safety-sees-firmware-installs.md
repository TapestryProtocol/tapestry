# ADR 0004: The deploy-safety answer sees a running firmware install: a count in memory for today's install, the live lifecycle lock for seed-firmware

**Status:** Accepted (2026-11-21, at the Architecture gate, with the two story amendments of sub-decision 9)
**Date:** 2026-11-21
**Story:** `engineering-team/stories/deploy-safety-gate/4-deploy-safety-sees-installs.md`
**Extends:** ADR deploy-safety-gate/0001, with a fourth live source, a fifth reason and one new block. Nothing in its payload is renamed or removed. ADR 0002's script doesn't change; its recipe doc gains a section.

## Context

**The story's criteria** (`deploy-safety-gate` #4), in short:
- **AC-1:** while either install runs, every answer from that instance is unsafe, with a reason of its own that says a firmware install is running. The answer says which install it is and when it started, and nothing about who started it. Both installs count:
  - today's install, through its route, from any caller, a dry run included;
  - `lifecycle seed-firmware`, through its route or from a shell.
- **AC-2:** the answer lets go however the install ends: finished, failed, or refused before it writes. Overlapping installs hold it until the last one ends.
- **AC-3:** an install cut off by a restart isn't reported afterwards. This needs an explicit automated test.
- **AC-4:** the safe-to-merge check waits while an install runs, journaling its reason, and answers safe once it ends. Its numbers don't change.
- **AC-5:** with no install running, the answer and its consumers are as they are today.
- **AC-6:**
  - the recipe says installs are covered;
  - the written procedure tells whoever starts an install to check first that no deploy is running or queued;
  - a hung install makes the check stop at its bound;
  - a ledger row records the gap that remains.

**Orientation.** The local container is the owner's private agent-memory instance and is off-limits. So this ADR oriented on staging's public `/api/concept-graph/summaries`, read 2026-11-21: 46 concepts, and none covers deploys, installs, lifecycle jobs or tasks. That confirms the story's "Concepts touched: None", so no `/neighbors` or `/node` calls were needed. Source was read at `deef26702` (staging, 2026-11-21).

**The answer today.**
- **Three running sources, plus the next fire.** `computeVerdict` (`src/api/deploy-safety/index.js:47`) adds `QUEUE_TASK_RUNNING` for the task queue's active jobs and `LEGACY_TASK_RUNNING` for the legacy runs in flight (:50). It adds `QUEUE_STATE_UNAVAILABLE` when an enabled queue can't be read (:53). It adds `NEXT_FIRE_WITHIN_BUFFER` only when no other reason was added (:69-71).
- **Sources are required inside the handler.** `handleStatus` (:83) requires each source there, so the module loads with no Redis (:23-24).
- **The legacy source is the precedent here.** It is in-process memory, which a restart clears, so it can't read as running after one (:160-162).
- **A sentinel holds story 1's phantom rule.** `test/deploy-safety-status.test.js` S1 (:306) forbids the task-event history, where a killed task reads as running for hours.

**Today's install.**
- **One handler, two registrations.** `install(opts)` (`src/firmware/install.js:1280`) runs the passes. Its route handler, `handleFirmwareInstall` (:1518), is registered under one path twice, with the same function both times (`src/api/firmware/index.js:233`, `src/api/normalize/index.js:5737`).
- **Every caller reaches that handler:**
  - the Dashboard's button;
  - the loopback call sessions use;
  - the install at first start (`tools/firmware-on-boot.sh:29`);
  - the scratch scripts (`scripts/scratch-stack.sh:94`, `scripts/brain-drill.sh:109`).
- **The control panel is one process**, with no cluster in `bin/control-panel.js`, and it runs as root (`docker/supervisord.conf:60-62`).
- **The command-line form is a process of its own.** `node src/firmware/install.js` (:1544) runs `install()` there and calls the routes over HTTP. No procedure uses it.
- **The handler switches the whole module into internal mode.** It does so for its run (`_internalMode`, :60-66) and switches back when the run ends (:1530, :1535). That matters under Consequences.

**seed-firmware.**
- **It locks before its first write.** `run()` (`src/operations/catalog/lifecycle/seed-firmware.js:125`) first reads and checks the firmware's files (`buildTarget`, :132), writing nothing. Then it takes the lifecycle lock (`C.begin('seed-firmware')`, :143). It writes in one transaction, refreshes the cache (:154) and runs rules check (:155). It releases the lock in a `finally` (:177).
- **`begin()` holds nothing on a refusal.** It recovers a stale lock first (`_common.js:73-86`). If the graph doesn't answer, it lets the lock go again (:82). A busy refusal never takes the lock.
- **Both callers take the lock.** The route (`POST /api/tapestry/lifecycle/seed-firmware`) and the shell (`tapestry lifecycle seed-firmware`, `bin/tapestry.js`) run the same `run()`. The shell runs in a process of its own.

**The lifecycle lock** (ADR graph-operations-foundation/0002, Decision 7; `src/operations/catalog/lifecycle/_store.js:205-290`).
- **It outlives the container.** It is one file, `.lock`, in `TAPESTRY_BACKUPS_DIR` (default `/var/lib/brainstorm/backups`; :30, :205). That folder is on the `tapestry-data` volume (`docker-compose.yml:38`).
- **What it records** (:239-260):
  - `runId`, `op` and `startedAt`;
  - `host`, from `os.hostname()`;
  - `holders`, each a process id with its `/proc` start time.
- **`inspectLock()` (:232-237) only reads.** It marks the lock `stale` in either case:
  - its host isn't this one;
  - none of its holders is alive. A holder is alive when its process id answers and has the same start time, so a reused id doesn't count (:223-230).

  An unreadable lock reads as stale (:234). The store recovers a stale lock at the next lifecycle operation (`recoverIfStale`, :291).
- **A recreate makes every earlier lock stale, on two counts.**
  - Its holders' processes died with the old container. A process id the new container reuses has a different start time, so it doesn't count as the holder.
  - `docker-compose.yml` gives the container no `hostname:`, so Docker names it by its container id, which changes on every recreate. So the lock's host doesn't match either. A droplet's own compose override could pin a hostname, which wasn't checked here; the first count holds either way.
- **`lifecycle status` reads the lock the same way** (`status.js:174`). The store also keeps run records (`.runs/<runId>.json`). A cut-off run's record has no outcome until the next lifecycle operation tidies up after it (:308). The store reads such a record as running only while that run's lock is live (`lastMigrateRun`, :348-362). Read raw, the record would be this store's form of story 1's phantom trap.

**Consumers of the answer.**
- **The check script needs no change.** `scripts/check-safe-to-merge.sh` branches only on `safeToDeploy` (:23, :79) and journals `reasons` verbatim (:80).
- **The Scheduled Tasks panel** reads only `queue` and `schedule` (ADR 0003; `test/next-task-countdown.test.js` R2, :411).
- **Story 1's suite pins the four reason codes** (`test/deploy-safety-status.test.js:52`; U12, :278-301; H1, :375-389).

**Constraints.**
- **The GET stays as it is**: one unauthenticated, read-only request (ADR 0001, AC-1). No new dependency or tooling.
- **No TA pubkey anywhere.** Nothing here filters by author or signs.
- **ADR 0001's payload is a consumed contract.** A rename breaks the ops tooling; an addition doesn't.
- **The owner's choices at planning** (the story's Background):
  - both installs count;
  - the installer's check is docs;
  - a deploy that waits is out of scope.
- **The owner passed over having today's install take the lifecycle lock** (ledger row `2026-11-21-todays-install-races-seed-firmware`).
- **POV:** as ADR 0001's note says, the answer is about the instance as a deployment, not a point of view.

## Options considered

### Option A — Two live sources, each unable to outlive its install (chosen)

- **Today's install: a count in the control panel's memory.** A small module holds the installs running in this process. `install()` enters it on its first line and leaves it in a `finally`. Memory goes with the process, so nothing survives a restart to read as running. That is AC-3 by construction, as with the legacy source.
- **seed-firmware: the live lifecycle lock.** The answer reads `inspectLock()` and counts a lock whose `op` is `seed-firmware` that isn't stale. Every process in the container shares the lock, so the shell form is seen. The lock's own staleness rule keeps a cut-off run's lock from reading as running, since its holders died with the old container.
- **Pros:**
  - each install is seen through what already marks it running;
  - the only new state is in memory;
  - the shell form is covered with no new file;
  - neither install changes what it does.
- **Cons:**
  - two sources to read, one of them another module's lock;
  - the answer comes to depend on that lock's format (Decision 7).

### Option B — One marker file for both installs

Each install writes a marker (process id, start time, host) when it starts and removes it when it ends. The answer reads the marker with a staleness rule.
- **Pros:** one source, which would also cover the command-line form.
- **Cons:**
  - it's a second record that outlives the container, with a staleness rule of its own to get right: exactly the AC-3 risk;
  - today's install would write to the data volume on its way in and out, the first-boot path included;
  - for seed-firmware, it repeats a lock that already exists.

Rejected.

### Option C — Today's install takes the lifecycle lock too

Then the lock alone covers both installs, and the race in ledger row `2026-11-21-todays-install-races-seed-firmware` ends as well.
- **Cons:**
  - the owner passed this choice over;
  - today's install would refuse `busy` whenever a backup, restore or migration runs, including the install at first start;
  - a change to what the answer sees shouldn't change what an install does.

Rejected.

### Option D — A count in memory for both installs

seed-firmware's `run()` would enter the same count as today's install.
- **Cons:** the shell form runs in another process, so the answer would miss it (AC-1).

Rejected.

### Option E — Run both installs as task-queue jobs

The existing `QUEUE_TASK_RUNNING` would then cover them.
- **Cons:**
  - it changes how both installs run and answer;
  - the queue can be off (`TASK_QUEUE_ENABLED`);
  - it is far more than the story asks.

Rejected.

## Decision

We chose **Option A**: it sees each install through what already marks it running, adds no state that outlives a restart, covers the shell form, and changes neither install. It comes with these sub-decisions.

1. **One reason for both installs: `FIRMWARE_INSTALL_RUNNING`.** Which install is running goes in the detail. A merger needs to know that an install runs. One code keeps the contract's list short, and it stays right when seed-firmware becomes the install (ADR graph-operations-first-slice/0043, Decision 1).
2. **One new block, always present:** `firmware: { installCount, installs: [{ install, startedAt }] }`.
   - `install` is `firmware-install` or `seed-firmware`, and `startedAt` is an ISO time. The list is sorted by `startedAt`.
   - It carries no process id, host, run id or caller: AC-1's "nothing about who started it".
   - With no install running, it is `{ installCount: 0, installs: [] }`.
   - Like `legacy`, it is always there, so a consumer never has to ask whether it exists. That calls for AC-5's wording to be amended (sub-decision 9).
3. **Today's install counts for the whole of `install()`,** from its first line to its end, whether it returns or throws.
   - Every caller in the control panel's process is covered, a dry run included.
   - The command-line form counts in its own process's memory, which nothing reads, so it isn't seen. The story allows that, and the recipe says so.
4. **seed-firmware counts while it holds the lifecycle lock.**
   - It takes the lock before its first write and lets it go after its last, the cache refresh and rules check.
   - Before the lock, it only reads the firmware's files, so a deploy then cuts off nothing.
   - That calls for AC-1's wording to be amended (sub-decision 9).
5. **A running install is a running source.** Its reason comes after `LEGACY_TASK_RUNNING`. Like the other running sources, it keeps `NEXT_FIRE_WITHIN_BUFFER` from being added.
6. **Reading either source can't fail in practice, and gets no new reason.**
   - The count is memory, and `inspectLock()` guards its reads.
   - A stale or unreadable lock reads as not running, which is how the lifecycle store itself judges it.
   - An unexpected throw takes the handler's existing 500. The check treats that as no usable answer, never as safe.
7. **What the answer never touches.** A source sentinel holds both rules:
   - **No histories.** It never reads the lifecycle's run records (`.runs`) or their logs, or any marker an install leaves, such as first boot's `/var/lib/brainstorm/firmware-on-boot.installed`.
   - **Nothing that changes the lock.** It never calls `begin`, `acquireLock`, `releaseLock` or `recoverIfStale`, so the GET stays read-only.
8. **The procedures (AC-6) go in `docs/SAFE_TO_MERGE.md`,** the one recipe both sides already read. BIBLE §7's firmware install section, where the install is described, points there.
   - **"What the check is"** says that a running firmware install counts, as a scheduled task does.
   - **A new section, "Before a firmware install,"** is for whoever starts one on a deployed instance. It says:
     - check first that no deploy of that instance is running or queued, with the command below;
     - once the install starts, the instance's answer is unsafe until it ends;
     - an install that hangs keeps the answer unsafe, so a merger's check stops at its bound and the operator decides;
     - the command-line form isn't seen;
     - the gap that remains is recorded in a ledger row.
   - **The command**, for staging (`deploy-tapestry.yml` for production):

     ```bash
     gh run list --repo TapestryProtocol/tapestry --workflow deploy-staging.yml --limit 5 --json status,displayTitle,createdAt --jq '.[] | select(.status != "completed")'
     ```

     Empty output means no deploy is running or waiting. It is one request, and `--jq` is built into `gh`, so `jq` isn't needed.
   - **A new ledger row,** `2026-11-21-install-starts-after-a-safe-check`, records the gap.
9. **Two story amendments,** dated, at Architecture:
   - **AC-1's seed-firmware clause** gains: "from when it takes the lifecycle lock, before it writes anything, until it lets the lock go".
   - **AC-5** becomes: "With no install running, every field the answer carries today keeps its value, and its one addition, the install block, is empty."

## Consequences

- **Enables:**
  - a merge that runs the check no longer cuts an install off, so the owner no longer has to hold merges for one;
  - the book's evidence on staging and production.
- **Constrains:**
  - **The reason list grows to five.** The script journals it verbatim. Story 1's suite pins the list, which the Tester updates.
  - **The `firmware` block joins the consumed contract** (ADR 0001, Consequences).
  - **The answer depends on the lifecycle lock's file and fields** (ADR graph-operations-foundation/0002, Decision 7). If the lock changes, the answer has to change with it. Comments at both ends say so, as ADR 0001 did for `getInFlightCount`.
- **Known windows, accepted:**
  - **The gap.** An install can start after a merger's check said safe, but before that merge's deploy recreates the container. The installer's check covers a deploy that is already running. What remains is a merger who has checked but not yet merged, usually for seconds. The new ledger row records it.
  - **A merge that skips the check isn't protected.** OPEN.md row 340 records several such merges. Its fix shape (b) has the deploy workflows ask the answer themselves, which would make the gate structural. It stays out of scope, as the owner chose.
  - **A hung install holds the answer unsafe** until it ends or the instance restarts. The check then stops at its bound, 45 minutes, and the operator decides, as for a long task.
  - **Today's install run from the command line** isn't seen.
- **Found in passing, not this story's to fix: two of today's installs at once break each other.** The handler switches the whole module into internal mode (`install.js:60-66`), and the first install to end switches it back (:1530). The other install's remaining calls then go over HTTP through nginx. The auth layer doesn't treat those as local, so its writes are refused. The answer counts both installs correctly either way. The Implementer records this as ledger row `2026-11-21-overlapping-installs-share-internal-mode`.
- **Firmware reinstall required?** No. No concept definition changes.
- **New dependencies:** none. **New tooling:** none.
- **The sandboxes** get this when their branches next take staging's changes (the story's Out of scope).

## Implementation notes

Test-file changes the ADR requires belong to Phase 3, the Tester's lane, never to implementation: the reason list in `test/deploy-safety-status.test.js`, the new cases, and any runner registration.

- **New file: `src/firmware/inFlight.js`.** It requires nothing, and no `fs`, because it keeps nothing outside memory.
  - `enter(install)` adds `{ install, startedAt: new Date().toISOString() }` under a fresh id. It returns a `leave()` function, which is safe to call twice.
  - `list()` returns a copy of the entries, sorted by `startedAt`.
  - Its header comment names its one reader, the deploy-safety answer.
- **`src/firmware/install.js`.** `install()` calls `enter('firmware-install')` on its first line and `leave()` in a `finally` around the rest, the banner included. Nothing else changes. A comment there names the reader.
- **`src/api/deploy-safety/index.js`.**
  - **`computeVerdict`** takes `installCount`, defaulting to 0, so today's callers and tests keep working. When it is above 0, `FIRMWARE_INSTALL_RUNNING` is added after `LEGACY_TASK_RUNNING`. The `reasons.length === 0` test before `NEXT_FIRE_WITHIN_BUFFER` doesn't change.
  - **A new exported pure function, `seedFirmwareFromLock(lock)`,** takes what `inspectLock()` returns:
    - a seed-firmware lock that isn't stale gives `[{ install: 'seed-firmware', startedAt: lock.startedAt }]`;
    - `null`, a stale or unreadable lock, or another op gives `[]`.
  - **`handleStatus`**, beside the legacy source, requires both new sources:
    - `require('../../firmware/inFlight').list()`;
    - `seedFirmwareFromLock(require('../../operations/catalog/lifecycle/_store').inspectLock())`.

    It merges the two lists, sorted by `startedAt`, passes their length to `computeVerdict` as `installCount`, and adds the `firmware` block to the answer.
  - **The header comment** lists four live sources and sub-decision 7's never-touches list.
- **`src/operations/catalog/lifecycle/_store.js`.** No code change. A comment on `inspectLock` names the deploy-safety answer as a reader that relies on it only reading.
- **`docs/SAFE_TO_MERGE.md`**: the purpose line, "What the check is", the new section (sub-decision 8), and "Last updated".
- **`BIBLE.md` §7, Firmware Install**: one bullet. While either install runs, the instance's deploy-safety answer is unsafe (`FIRMWARE_INSTALL_RUNNING`). Before installing on a deployed instance, see `docs/SAFE_TO_MERGE.md`, "Before a firmware install".
- **Two ledger rows:**
  - `2026-11-21-install-starts-after-a-safe-check`, the gap (AC-6);
  - `2026-11-21-overlapping-installs-share-internal-mode`, the hazard found in passing.
- **Testing seams** (suggestions for the Tester, not prescriptions):
  - **`computeVerdict` with `installCount`:** the reason, its place in the order, the next-fire rule, and the five-code contract.
  - **`seedFirmwareFromLock` on made-up locks:** none, stale, unreadable, another op, and a live seed-firmware lock.
  - **`inFlight`:** enter, leave, two at once, leave twice, and a list that is a copy.
  - **`handleStatus` with a fake `req` and `res`, stack-free.** Point `TAPESTRY_BACKUPS_DIR` at a temporary folder, then:
    - a lock naming this process (its pid, `os.hostname()`, `op: 'seed-firmware'`) gives unsafe, with the reason and the detail;
    - the same lock naming a dead pid, or another host, gives safe (AC-3);
    - `inFlight.enter` gives unsafe, and `leave()` safe again.

    The queue must read as off, through a `BRAINSTORM_CONF_PATH` at a dead conf, as this Mac's scoped-gate recipe sets.
  - **Sentinels:** `install()` enters `inFlight` and leaves in a `finally`; and sub-decision 7's never-touches list.
  - **AC-4:** a stub-server case in `test/safe-to-merge-check.test.js` that serves `FIRMWARE_INSTALL_RUNNING` k times, then safe. That suite's B cases time out behind a stub `curl` on this Mac, so run it without one. It talks only to its own stub server.
  - **AC-6:** doc-content assertions, and the new ledger row's file and id.

## Out of scope

- **Everything the story lists:**
  - lifecycle backup, restore and migrate, queued in `stories/_intake.md`;
  - a deploy that waits for the answer;
  - the command-line form;
  - making an install survive a deploy;
  - the Scheduled Tasks panel;
  - the sandboxes;
  - the local container.
- **Two hazards, both ledger rows:** the overlap of two of today's installs, and the race between today's install and seed-firmware.
- **Any change to the check script, its numbers, or the cycle skills.**
