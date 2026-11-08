# Test Plan: Story 2 — Back up and restore the whole instance

**Story:** `engineering-team/stories/graph-operations-foundation/2-lifecycle-backup-and-restore.md`
**ADR:** `engineering-team/decisions/graph-operations-foundation/0002-backup-and-restore-the-whole-instance.md`
**Date:** 2026-11-08

Every suite is stack-free. The routes and commands run in a child process (`test/helpers/operationsHarness.js`, extended here) against a temporary instance. That instance has a real encrypted assistant key made with the instance's own `SecureKeyStorage`, a conf, settings and a backups folder. A fake supervisor, `neo4j-admin` and graph database stand in for `_system.js`, keeping their state in a file (`test/helpers/lifecycleFakes.js`). Archives are made and read by the test's own ustar code, never the implementation's. The live path — two real instances in turn — is the scratch-stack check at the end, which Implementation runs and records.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC1 — take a backup | B2 the folder: dump, key and master key byte for byte, admins, manifest with sizes and sha256s, modes 0700/0600 · B3 the answer · B4 the offline window, in order · B5 only running writers are paused · B6 a write during the backup leaves the counts of before, marked not exact · B7 offloaded json tags counted and warned · B8 a failed dump keeps nothing and brings everything back · B9 a store needing recovery is never dumped · B14 a key that doesn't decrypt fails before the stop · B17 the default folder is on the data volume · B18 no key material in answers or logs | `test/operations/lifecycle/backup.test.js` | unit, through the route |
| AC2 — see the backups | L2 every complete backup, newest first, with its summary, origin and sameInstance · L3 nothing else is listed · L4 paging · L5 no folder at all · P1 none taken · P1b status shows the last backup, the count, the last run and an interrupted run, and changes nothing | `list-backups.test.js`, `status.test.js` | unit, through the route |
| AC3 — restore, and prove it | R2 safety backup first, then the backup in place, with the proof · R3 one offline window · R4 another instance's key under this master key, the conf lines, the admins, the owner reported · R5 the control panel restarts once, after the answer; writers start with the new key · R6 a count mismatch names the safety backup · R7 counts not exact → match null · R11, R12 rollback · R13 a failed safety dump changes nothing · R14 warnings · R17 no key material | `restore.test.js` | unit, through the route |
| AC4 — move a backup to a fresh instance | D2 the download is one ustar file, byte for byte · D3 the system's tar reads it · U2 an upload is kept as it came · U3 listed as uploaded · U4 already held, or backup-exists · U5 accepted variants · U6 every damaged or hostile archive refused, nothing left behind · R4 restoring it makes the instance the same one · **the live check** below | `download-backup.test.js`, `upload-backup.test.js`, `restore.test.js` | unit; live |
| AC5 — refusals | R8 unknown, damaged (5 ways) and incompatible (2 ways) backups, changing nothing · R9 not-enough-space · R10 busy and graph-unavailable · B10, B11 for backup · U8 busy for upload · D4, D5 for download | the five suites | unit |
| AC6 — who may call, and the commands | B15, R16, L6, D6, U9: owner and admins, visitor 401, stranger 403 · B16, R16, L6, D7, U10: the commands, D7 and U10 with the terminal refusals | the five suites | unit |
| ADR Decision 1 — the declarations | B1, R1, L1, D1, U1 | the five suites | unit |
| ADR Decision 8 — the detached job, the real system | J1 the run record · J2 survives Ctrl-C to its caller's process group · J3 a job with no result is failed, its lock removed · Y1 command lines through `runuser` and `supervisorctl` · Y2 `supervisorctl status` exiting 3 | `backup-job.test.js` | unit, with stand-in commands on PATH |
| ADR Decision 10 — file results and file bodies in the module | F1 declaration rules · F2 file result headers and bytes · F3 file body, 415, 413 by declared length and by streamed length · F4 afterAnswer after the route answers, before the command exits · F5 the command's stdout and stdin, refusing a terminal · F6 `/docs` · F7 the list | `test/operations.test.js` | unit, with fixture declarations |
| ADR Decision 13 and the docs | K1 nginx keeps X-Forwarded-For, takes 9g, streams, 900 s · K2 neo4j's stop settings · K3 OPERATIONS.md's Backups section and ADR 0005's pointer | `backup-job.test.js` | static |

## Edge cases

- [x] Concurrent calls: a live lock refuses backup, restore and upload (B10, R10, U8). A stale lock is recovered — by a dead pid (B12) or another host (B13) — and status reports it without touching it (P1b).
- [x] Graph unavailable: refused before anything stops (B11, R10).
- [x] Failures inside the offline window: a dump (B8), a store needing recovery (B9), a load (R11), a transaction mismatch (R12), a safety dump (R13). Each test proves the server and the writers come back.
- [x] A write landing while a backup is taken (B6).
- [x] Hostile archives: path traversal, a symlink, an unexpected member, a duplicate member, a bad header checksum, a truncated archive, garbage, an empty body (U6).
- [x] Size limits: a sparse 8 GiB dump (D5), a declared 20 GiB body (U7), and a chunked body over a small fixture limit (F3).
- [x] An id that isn't one is refused by its pattern, so it is never a path (R16).
- [x] Secrets never leave in answers or logs (B18, R17).
- [x] Tests that assert something did *not* happen also assert the path ran. For example, R8 checks the refusal codes and then that nothing stopped, and B10 checks the 409 and then that no supervisor call was made.

## The test-facing contract (what the suites rely on, from the ADR)

The Implementer must keep these, or the suites can't drive the code:

- **Paths come from the environment.** `TAPESTRY_BACKUPS_DIR` defaults to `/var/lib/brainstorm/backups` and `TAPESTRY_SECURE_KEYS_DIR` to `/var/lib/brainstorm/secure-keys`; `BRAINSTORM_CONF_PATH` and `TAPESTRY_SETTINGS_PATH` as today. They are read when called, not cached at load.
- **`_system.js`'s `module.exports` is the system object.** Its methods are `supervisor(action, programs)`, `programStatus(names)`, `neo4jAdmin(args, { stdin, stdout })`, `cypher(query, params)`, `version()`, `freeBytes(path)` and `sleep(ms)`. Everything that uses them calls them through that object at call time, so the harness can replace them. `neo4jAdmin` resolves `{ code, stdout, stderr }`, with `stdout` captured as text when no stream is given. The real one runs `runuser -u neo4j -- neo4j-admin …` and `supervisorctl …` by name, from `PATH`. `programStatus` reads `supervisorctl status <names>`, whose exit code 3 only means some program isn't running.
- **The restart after an assistant change** is `system.supervisor('restart', ['brainstorm'])`, from `afterAnswer`. The real system runs it detached.
- **`_jobs.js` exports three functions.**
  - `runBackupJob(request, system)` and `runRestoreJob(request, system)` resolve the job's result or throw, and remove the lock in their `finally` when they hold it.
  - `runDetached(request, { workerPath? })` writes `.runs/<request.runId>.json` with the request, spawns `node <workerPath> <runId>` detached, and resolves `{ outcome: 'done', result }` or `{ outcome: 'failed', error }`. A worker that leaves no outcome is `failed`, its error mentions the missing result, and the lock whose `runId` matches is removed.
  - The request carries `op: 'backup' | 'restore'` and `runId`. The declarations call `require('./_jobs').runDetached(...)` at call time.
- **The queries are the ADR's Decision 4 step 2, each its own query**, with `'lmdb:'` written into the query, not passed as a parameter. Keys come back as rows. The fake recognises queries by what they name; its rules are in `test/helpers/lifecycleFakes.js`.
- **A stale lock is recovered before the other checks,** so a graph left offline by a dead job doesn't refuse `graph-unavailable` first (B12). The recovery records the dead run as `{ outcome: 'interrupted' }` in `.runs/<its runId>.json`. A lock is stale when its host differs, or when no holder pid is alive (start times compared where `/proc` exists).
- **Manifest values:** `lastCommittedTransaction` is a string, as `info` prints it. `takenAt` is ISO, `note` a string or null, `restoring` an id or null, and `offlineMs` an integer. `tapestryKeyDigest` is `'sha256:'` plus the hex of the keys sorted with JavaScript's default sort and joined by a newline.
- **Status's backup part** is `{ known, last, count, lastRun, interrupted, note }`. `lastRun.backup` is the run's `result.backup.id` (backup) or `result.restored` (restore).
- **Download checks the dump's size before reading it** (D5 uses a sparse 8 GiB file) and doesn't verify checksums; upload does.
- **A file body's `too-large`** is answered 413 whether the length is declared or found while streaming (F3). A refusal thrown from the stream counter is a built-in, never "a code the declaration doesn't list".
- **The command's terminal checks** use `io.stdout.isTTY` and `io.stdin.isTTY`. A file result is written through `io.stdout.write`.
- **Upload's `received.json.by`** is the caller's pubkey, or `'local'` from the command.
- **`list-backups`' `next`** is the last id given when more are older, and null when none are.

## Test infrastructure

- Node's own runner style: each suite exports `run()`. `test/operations.test.js` discovers everything under `test/operations/` (ADR 0001 Decision 12), so `test/registry.js` is unchanged.
- **`test/helpers/operationsHarness.js` (extended).** Requests carry binary bodies (`rawBase64`), a content type, extra headers and `declaredOnly`, and use a fresh connection each. Answers record `headers`, `bodyBase64` and `at`. Commands take `stdinBase64`, `stdinIsTTY` and `stdoutIsTTY`, and record `stdoutBase64` and `endedAt`. `lifecycleFake: { stateFile }` installs the fake system and runs the jobs in-process. `pauseMs` waits after each request. All 39 of the module suite's own tests (A10.1's) still pass with it.
- **`test/helpers/lifecycleFakes.js` (new):** the fake system, instances, backup folders, the ustar writer and reader, locks, and a small suite kit.
- **No running stack, no container, no network** beyond ephemeral loopback ports. Every service endpoint is dead in each child's environment. `backup-job.test.js` puts stand-in `runuser`, `supervisorctl` and `neo4j-admin` scripts first on PATH.
- **Firmware state:** none. **Concept Graph API:** not used; no concept is touched.

## How to run

On this Mac, don't run the full `npm test`: its live suites reach the private instance on :7778. Run the touched suites through their `run()` exports with every endpoint dead, set inside the runner. The runner also puts a refusing `docker` on PATH, and sets `TAPESTRY_PORT=1` and `TAPESTRY_CONTAINER` to a container that doesn't exist. For example, `test/operations.test.js` runs the module suite and every suite under `test/operations/`:

```
node -e "require('./test/operations.test.js').run().then(r => process.exit(r.fail ? 1 : 0))"
```

CI runs the stack-free gate on the pull request.

### The live check (AC4), run in Implementation

On a throwaway instance (`scripts/scratch-stack.sh`; ask before pausing `vespa` and `brainstorm-graperank` for memory), from this worktree, which is under `/Users`:

1. `up` instance A. Copy in `bin/tapestry.js`, since only `src/` is mounted. Make a few nodes with tapestryKeys, and a relationship with a property.
2. Export every node's `elementId`, labels and properties, and every relationship's type, ends and properties, through `/api/neo4j/query` on loopback, sorted. Run `tapestry lifecycle backup --note "live check"`.
3. Download it: `docker exec tapestry-scratch tapestry lifecycle download-backup --backup <id> > a.tar`, or the route over loopback. Note A's assistant pubkey, then `down`.
4. `up` instance B, a fresh one with its own assistant. Upload `a.tar` (`docker exec -i … upload-backup < a.tar`) and restore it.
5. Pass when:
   - B's export equals A's, byte for byte;
   - every tapestryKey is there;
   - `GET /api/assistant/pubkey` gives A's assistant within a minute;
   - the admins are A's;
   - the restore's report shows `transaction.same` and `match: true`;
   - B's own first graph is in the safety backup.
6. Record the evidence in the story's Evidence section, then `down`.

## Verification

The new tests fail with the current code, for the reasons they should. The run was on 2026-11-08, on the tree of this commit (branch `A10.2-lifecycle-backup-restore`, base `55ed161f2`), on Node 24.18.0, through the runner described above:

```
=== operations: lifecycle backup ===         0 passed, 18 failed — src/operations/catalog/lifecycle/backup.js does not exist yet (ADR …0002 Decision 1); B17: _store.js does not exist yet (Decision 2)
=== operations: lifecycle restore ===        0 passed, 17 failed — src/operations/catalog/lifecycle/restore.js does not exist yet
=== operations: lifecycle list-backups ===   0 passed, 6 failed  — list-backups.js does not exist yet
=== operations: lifecycle download-backup ===0 passed, 7 failed  — download-backup.js does not exist yet
=== operations: lifecycle upload-backup ===  0 passed, 10 failed — upload-backup.js does not exist yet
=== operations: lifecycle backup job and system === 0 passed, 8 failed
    J1–J3  _jobs.js does not exist yet (Decision 8)        Y1–Y2  _system.js does not exist yet (Decision 8)
    K1  docker/nginx.conf has a `location /api/tapestry/lifecycle/ { … }` block
    K2  [program:neo4j] stopwaitsecs of at least 120; got undefined
    K3  OPERATIONS.md has a Backups section
=== operations: lifecycle status ===         6 passed, 2 failed
    P1   backup must be { known: true, last: null, count: 0, lastRun: null, interrupted: null, note }; got {"known":true,"last":null,"note":"No backup … recorded …"}
    P1b  two backups, nothing interrupted; got {"known":true,"last":null,…}
    (P2–P7 still pass)
=== operations === (the module suite)        its own 39 tests (A10.1's) pass; F1–F7 fail:
    F1  the three valid fixtures load; got ["after-answer","bad-max","body-on-read","file-write","schema-and-file"]
    F2  200 with the file's 1500 bytes; got 404        F3  … got 400 'label' is required (the query isn't read for a body file)
    F4  … got 500                                      F5  exit 0 and the 600 bytes on stdout; got 2
    F6  file-read's 200 is binary …; got undefined     F7  file-read's entry has result.file; got undefined
```

The helpers were checked on their own first. A real key decrypts, the fake neo4j round-trips a dump through `info`, `load --info` and `load`, and the ustar writer's archive is read by the test's reader and listed by the system's bsdtar.

## Round 2: tests for review round 1's fixes (ADR 0002 Amendment 1)

Added by the Tester after review round 1, failing first (commit `2c6de20c6`):

| Finding | Tests | File |
|---|---|---|
| Blocking: the restart depended on the caller | F8: after-answer work runs when the client gave up before the answer (harness `abortAfterMs`) · R5 rewritten: the answer marks its run answered, and the route restarts nothing · J4: the job restarts once the caller marks the answer out, not before · J5: or once the caller is gone, or at its time limit; never after a backup, a no-change restore or a failed one | `operations.test.js`, `restore.test.js`, `backup-job.test.js` |
| A job that can't start kept its lock | J6 | `backup-job.test.js` |
| Recovery could remove a fresh lock | J7 | `backup-job.test.js` |
| What to undo was recorded after the stop call | B20 (the fake's `stopThrows`) | `backup.test.js` |
| Restore's errors after the load | R18 (in place, and the safety backup) · R19 (stop, load, start, by hand) | `restore.test.js` |
| Restore's result schema | R20 | `restore.test.js` |
| An interrupted restore's safety backup | P1b extended | `status.test.js` |

Red before green: 11 failed and 119 passed on `2c6de20c6`; after the fix, 130 passed.
