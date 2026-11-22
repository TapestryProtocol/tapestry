# Test Plan: Story 4 — The deploy-safety answer sees a running firmware install

**Story:** `engineering-team/stories/deploy-safety-gate/4-deploy-safety-sees-installs.md`
**ADR:** `engineering-team/decisions/deploy-safety-gate/0004-deploy-safety-sees-firmware-installs.md`
**Date:** 2026-11-21

Everything here runs stack-free. No test reaches a control panel, Neo4j, Redis, staging, production or the local container.
- **The handler runs in the test's own process.** It is called with a fake `req`/`res`, or served by Express on an OS-assigned `127.0.0.1` port (B10). The queue reads as off, since neither CI nor this Mac has `/etc/brainstorm.conf`.
- **Every lifecycle lock lives in a fresh temporary `TAPESTRY_BACKUPS_DIR`.** A test sets it inside `run()` and puts it back before it ends, as the gate requires (ADR test-suite-hermeticity/0002).
- **Today's install runs in child processes, and makes no call.** It reads a stand-in manifest with no concepts, both passes are off, and it is a dry run. `TAPESTRY_API_BASE` points at a closed port in case anything ever called out.

## Coverage map

New suite `test/deploy-safety-sees-installs.test.js` (registered after `deploy-safety-status.test.js` in `test/registry.js`), plus B10 in `test/safe-to-merge-check.test.js`.

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 | U1 a running install alone makes the verdict unsafe, with `FIRMWARE_INSTALL_RUNNING` as its only reason | sees-installs | unit |
| AC-1 | U2 the new reason comes after `LEGACY_TASK_RUNNING` and before `QUEUE_STATE_UNAVAILABLE` | sees-installs | unit |
| AC-1 | U3 a running install keeps `NEXT_FIRE_WITHIN_BUFFER` out, and the next fire is still reported | sees-installs | unit |
| AC-1 | U4 an install counts with the task queue off | sees-installs | unit |
| AC-1 | L1 no lock is no install | sees-installs | unit |
| AC-1 | L2 a live seed-firmware lock is one install, `{ install, startedAt }`, nothing about who holds it | sees-installs | unit |
| AC-1 | M1 `inFlight.enter()` lists one entry, `{ install, startedAt }`, until its `leave()` | sees-installs | unit |
| AC-1 | H1 while today's install is counted, the answer is unsafe, names it; after `leave()`, safe | sees-installs | handler |
| AC-1 | H2 seed-firmware held by a process of its own (the shell form): unsafe, named, nothing about who | sees-installs | handler + child |
| AC-1 | I1 `install()` counts itself mid-run, and is gone once it resolves (a dry run) | sees-installs | child |
| AC-1 | I2 the route handler, `POST /api/firmware/install`, is counted and lets go when it answers | sees-installs | child |
| AC-1 | S3 the module reads both sources: the in-memory count and `inspectLock()` | sees-installs | source |
| AC-2 | U5 two installs at once add `FIRMWARE_INSTALL_RUNNING` once | sees-installs | unit |
| AC-2 | M2 overlapping entries are counted apart; each `leave()` removes only its own | sees-installs | unit |
| AC-2 | M3 `leave()` twice removes no other install's entry | sees-installs | unit |
| AC-2 | H3 seed-firmware lets the lock go: the next answer is safe | sees-installs | handler + child |
| AC-2 | H7 both installs at once: both listed, sorted, one reason, unsafe until the last ends | sees-installs | handler + child |
| AC-2 | I3 an install that fails is counted while it runs and let go when it throws | sees-installs | child |
| AC-2 | I4 two of today's installs at once are both counted, then the count is empty | sees-installs | child |
| AC-3 | L3 a stale seed-firmware lock is no install (control: the same lock, live, is one) | sees-installs | unit |
| AC-3 | L4 an unreadable lock is no install | sees-installs | unit |
| AC-3 | H4 seed-firmware killed holding the lock: not reported afterwards, and the GET leaves the lock file as it was | sees-installs | handler + child |
| AC-3 | H5 a lock naming the old container's host is not reported, even with a live holder | sees-installs | handler |
| AC-3 | H9 today's install killed mid-run: the restarted process reports none (control: its own install, once entered) | sees-installs | two children |
| AC-3 | S1 *(guard)* the module never reads a run record, log or install marker, and never changes the lock | sees-installs | source |
| AC-3 | S2 `src/firmware/inFlight.js` requires nothing, so it keeps nothing outside memory | sees-installs | source |
| AC-4 | B10 against the real answer, the check waits while an install runs, journals `FIRMWARE_INSTALL_RUNNING` on each unsafe attempt, and exits 0 only after it ends | safe-to-merge-check | script + handler |
| AC-4 | B9, C7 *(existing)* the script's numbers stay 45 attempts × 60 s | safe-to-merge-check | script, source |
| AC-5 | H8 with nothing running, today's fields keep their values; the one addition is `firmware`, empty | sees-installs | handler |
| AC-5 | U6 *(guard)* `installCount` omitted and `0` give identical verdicts across story 1's scenarios | sees-installs | unit |
| AC-5 | story 1's suite *(existing, list widened)* and `next-task-countdown` R2 *(existing)* | deploy-safety-status, next-task-countdown | unit, source |
| AC-5, AC-1 | U7 with installs in play, the contract holds, and every reason is one of the five codes | sees-installs | unit |
| AC-6 | D1 the recipe says a running firmware install counts, and names its reason | sees-installs | content |
| AC-6 | D2 "Before a firmware install": the running-or-queued check and its command, a hang, the command-line form, the gap's row | sees-installs | content |
| AC-6 | D3 the ledger row for the gap that remains | sees-installs | content |
| AC-6 | D4 BIBLE §7's Firmware Install section says so and points to the procedure | sees-installs | content |
| ADR | D5 the ledger row for the hazard found in passing (two of today's installs at once) | sees-installs | content |
| scope | L5, H6 a lock held by a backup, restore, migration or upload is not a firmware install (control: seed-firmware is) | sees-installs | unit, handler |
| AC-3 *(round 2)* | H10 *(guard)* a lock naming this host and a live pid whose start time differs is no install (control: the matching start time is one). The test stands in for the `/proc/<pid>/stat` read, so it runs on macOS too | sees-installs | store |
| AC-1 *(round 2)* | S4 seed-firmware takes the lock as `'seed-firmware'` before its write and lets it go in a `finally`; a comment at the call names the reader; the answer reads the same op | sees-installs | source |
| AC-6 *(round 2)* | D7 the procedure says an answer with no `firmware` block doesn't see installs, names tags and production, says to hold merges by hand there, names `deploy-tags.yml`, and drops the unqualified sentence | sees-installs | content |
| AC-6 *(round 2)* | D8 the gap paragraph also names a merge that skips the check (OPEN.md row 340) | sees-installs | content |
| ADR *(round 2)* | D6 the two rows carry their UTC day: the 2026-11-21 files are gone and no doc cites the old ids. D3 and D5 now name the 2026-11-22 ids | sees-installs | content |

**Changed, not new.** `test/deploy-safety-status.test.js`'s `REASON_CODES` gains `FIRMWARE_INSTALL_RUNNING`, and its two messages say "five contract codes". That widens what U12 and H1 accept, so the suite passes before and after the change. Without it, H1 on a live stack would fail while an install runs.

**Guards that pass before the implementation.** U6 and S1 hold today and must keep holding: U6 that today's callers keep their verdicts, S1 that the answer never reaches a phantom source. The plan names them so a reviewer doesn't read them as tests that fail for nothing. Every other new test fails until the feature lands.

**Negative tests carry a positive control.** Each test that asserts something is *not* reported first proves the path ran:
- H3, H4 and H6 see the install reported while the lock is held;
- H5 sees a live lock on this host reported;
- H9 sees the restarted process report its own install;
- L3 and L5 check the live seed-firmware lock gives one install.

Before the implementation, each therefore fails at its control, never by passing for nothing (workflow 3, "Common pitfalls").

## Edge cases

- [x] **Two installs at once,** of either kind or one of each: M2, H7, I4.
- [x] **An install that fails:** I3.
- [x] **An install refused before it writes.** seed-firmware's refusals take the lock not at all (`busy`), or only for a moment (`graph-unavailable`, ADR 0004 Context). Both end the way H3's release does: the lock is gone, so the next answer is safe. Today's install has no refusal of its own past the route's access check, which runs before the handler and so is never counted.
- [x] **A cut-off run's lock, three ways:**
  - a killed holder (H4);
  - another host, as after a recreate (H5);
  - a lock file that can't be read (L4).
- [x] **The GET stays read-only:** H4 reads the stale lock file back byte for byte, and S1 forbids anything that changes the lock.
- [x] **Nothing about who:** L2, H2 and the entry checks hold every install to `install` and `startedAt` only. H2 also checks the answer carries neither the lock's run id nor its host.
- [x] **Other lifecycle jobs aren't installs:** L5, H6.
- [x] **The queue off:** U4, and every handler test, which runs with the queue off.
- [ ] **Today's install from the command line** (`node src/firmware/install.js`): not tested. The story allows it to go unseen, and D2 checks that the procedure says so.
- [ ] **A hung install:** not tested as behavior. Unsafe until it ends is what H1 and H2 test, and D2 checks the procedure's sentence about the bound.

## Test infrastructure

- **Runner:** the gate's registry (`test/registry.js`). Each suite exports `run()`, returning `{ pass, fail, failures, skipped }`, as the others do.
- **No stack, no firmware state:** no Concept Graph API, and no `POST /api/firmware/install` precondition. No concept definition changes, so no firmware reinstall is needed either.
- **Fixtures, all made by the tests:**
  - temporary backups folders (`os.tmpdir()`), removed after each test;
  - child processes that take, release or abandon the lifecycle lock through the store's own `acquireLock`/`releaseLock`;
  - a child that enters today's install and is SIGKILLed;
  - the install probe's stand-in `firmware.getManifest` and `firmware.getTAPubkey`.

  Nothing touches the checkout's files.
- **Node:** CI runs Node 22, and this plan's runs used 22.23.1.

## How to run

**On CI,** `npm test` runs both suites.

**On this Mac,** never the full `npm test`: the local container is the owner's agent-memory instance. Each suite runs on its own, from the checkout.

**The new suite and story 1's** run under the scoped-gate environment, as the memory's recipe sets it:
- a stub `curl` and a stub `docker` first on `PATH`;
- `BRAINSTORM_CONF_PATH` at a conf whose `NEO4J_URI` is `bolt://127.0.0.1:9`;
- `BRAINSTORM_BASE_URL=http://127.0.0.1:9` and `TAPESTRY_PORT=9`;
- `TAPESTRY_CONTAINER` and `TAPESTRY_CONTAINER_PORT` unset.

```bash
node -e "require('./test/deploy-safety-sees-installs.test.js').run().then(r => process.exit(r.fail ? 1 : 0))"
```

```bash
node -e "require('./test/deploy-safety-status.test.js').run().then(r => process.exit(r.fail ? 1 : 0))"
```

**`test/safe-to-merge-check.test.js` needs the system `curl`.** Run it with the same variables but without the stubs: its script talks only to its own `127.0.0.1` servers, and behind the stub its B cases time out (the memory's gate notes).

```bash
node -e "require('./test/safe-to-merge-check.test.js').run().then(r => process.exit(r.fail ? 1 : 0))"
```

## Verification

The new tests fail with the current code. This was confirmed on 2026-11-21, on Node 22.23.1, at `8d46bff24`, with these test files in the working tree.

**`test/deploy-safety-sees-installs.test.js`: 2 passed, 35 failed, 0 skipped.** The two passes are the guards U6 and S1. Every failure names the missing piece:

```
FAIL U1  one install must make the verdict unsafe (got safe)
FAIL U2  reason order must be … (got ["QUEUE_TASK_RUNNING","LEGACY_TASK_RUNNING","QUEUE_STATE_UNAVAILABLE"])
FAIL U3  the reasons must be [FIRMWARE_INSTALL_RUNNING] alone … (got ["NEXT_FIRE_WITHIN_BUFFER"])
FAIL U4  queue disabled + one install must be unsafe … (got safe [])
FAIL U5  two installs must make the verdict unsafe (got safe)
PASS U6  (guard)
FAIL U7  no scenario produced FIRMWARE_INSTALL_RUNNING — the installCount input is not read yet
FAIL L1–L5  src/api/deploy-safety/index.js does not export seedFirmwareFromLock(lock) yet
FAIL M1–M4, H1, H7, S2  src/firmware/inFlight.js does not exist yet
FAIL H2  a live seed-firmware lock held by another process must make the answer unsafe … (got safe [])
FAIL H3, H4  control: while held, the answer must report the install (got [])
FAIL H5  control: a live lock on this host must report the install (got [])
FAIL H6  the answer has no firmware block (got top-level keys bufferMs,checkedAt,legacy,queue,reasons,safeToDeploy,schedule,success,verdict)
FAIL H8  the answer's only new top-level field must be firmware (got additions [])
FAIL H9, I1–I4  src/firmware/inFlight.js: MODULE_NOT_FOUND — does not exist yet
PASS S1  (guard)
FAIL S3  the module never requires src/firmware/inFlight
FAIL D1  "What the check is" must say that a running firmware install counts
FAIL D2  docs/SAFE_TO_MERGE.md has no section whose heading matches /Before a firmware install/i
FAIL D3  ledger/2026-11-21-install-starts-after-a-safe-check.md does not exist yet
FAIL D4  BIBLE §7's Firmware Install section must say that while an install runs, the deploy-safety answer is unsafe
FAIL D5  ledger/2026-11-21-overlapping-installs-share-internal-mode.md does not exist yet
```

**`test/safe-to-merge-check.test.js`: 16 passed, 1 failed.**

```
FAIL B10  src/firmware/inFlight.js does not exist yet — the in-memory count of today's install that the deploy-safety answer reads
```

B1–B9 and C1–C7 pass, as before.

**`test/deploy-safety-status.test.js`: 17 passed, 0 failed, 6 skipped.** The six skips are its live H tests, with no stack. With the reason list widened, it passes as before.

## Round 2: review round 1's findings

Review round 1 (`engineering-team/reviews/deploy-safety-gate/4-deploy-safety-sees-installs.md`) asked for one blocking fix and seven smaller ones. ADR 0004 Amendment 1 records the fixes chosen. This round adds H10, S4 and D6–D8, and moves D3 and D5 to the renamed ids. The quoted old file names in the Verification above are from round 1, before the rename. Findings 2 and 3 (a stale comment and an ADR sentence) and finding 4 (the story's Evidence) are prose fixes with no test.

**Before the fixes, on 2026-11-22, on Node 22.23.1, at `7270d05fc` with these tests in the working tree.** `test/deploy-safety-sees-installs.test.js` gave 35 passed and 7 failed. Every failure names what's missing:

```
FAIL S4  a comment just above C.begin('seed-firmware') must name the deploy-safety answer as a reader of this lock
FAIL D2  the section must point at the ledger row for the gap that remains, 2026-11-22-install-starts-after-a-safe-check
FAIL D3  ledger/2026-11-22-install-starts-after-a-safe-check.md does not exist yet
FAIL D5  ledger/2026-11-22-overlapping-installs-share-internal-mode.md does not exist yet
FAIL D6  ledger/2026-11-21-install-starts-after-a-safe-check.md must be renamed to its UTC day (2026-11-22), not left beside the new one
FAIL D7  the section must say how to tell an instance that doesn't see installs yet: its answer has no `firmware` block
FAIL D8  the section must say that a merge which skips the check isn't held either, and point at OPEN.md row 340
```

**Guards: each new test fails when the thing it guards is taken out.** Each was checked on a scratch copy of the working tree, never the worktree itself.
- **H10** passes before the fixes, since the rule it pins is already in the store. With the rule's line taken out (`if (now !== null && now !== h.startTime) return false;`, `_store.js:227`), H10 fails: "a lock whose holder pid answers with a different start time … must read as no install (got [{"install":"seed-firmware",…}])".
- **S4** fails before the fixes for its missing comment. Once the comment exists, it must still fail when the op is renamed. That is checked after the fixes, in round 2's review evidence.
