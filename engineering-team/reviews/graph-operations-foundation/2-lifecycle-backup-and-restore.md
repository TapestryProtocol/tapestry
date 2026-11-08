# Review: Story 2 — Back up and restore the whole instance: `lifecycle backup` and `restore`, and moving a backup between instances

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-08
**Diff:** `git diff 5fad20913...HEAD` (HEAD `20d3fa902`: story `b994ebf33`, ADR `55ed161f2`, failing tests `d4a9fc06f`, the Tester's corrections `fb9c65cf1` and `2289da6f1`, implementation `8fcb3d675` and `b25f6588f`, evidence `20d3fa902`)
**Story:** [2-lifecycle-backup-and-restore.md](../../stories/graph-operations-foundation/2-lifecycle-backup-and-restore.md) · **ADR:** [0002-backup-and-restore-the-whole-instance.md](../../decisions/graph-operations-foundation/0002-backup-and-restore-the-whole-instance.md) · **Test plan:** [2-…test-plan.md](../../stories/graph-operations-foundation/2-lifecycle-backup-and-restore.test-plan.md)

## Quality gates (run by reviewer, not trusted)

- [ ] `npm test`: not run. On this Mac the full gate's live suites reach a private instance, so it is off limits (this review's environment rule; ledger `2026-09-30-npm-test-step-leaks-fixtures`). There is no run record to quote: `npm run gate:status` printed `No gate run records in <worktree>/tmp/gate-runs` (exit 2). CI runs the full stack-free gate on the pull request.
- [x] **Suites run one by one** through their `run()` exports, on Node 24.18.0 at `20d3fa902`, whose code is `b25f6588f`'s (`20d3fa902` changes only the story). They ran through the session's runner: every HTTP, Neo4j and Redis endpoint dead, `TAPESTRY_PORT=1`, `TAPESTRY_CONTAINER` naming no container, and a `docker` that refuses every call first on PATH. Results are pass/fail/skip.
  - **`test/operations.test.js`: 121/0/0.** That is the module's own 46 (A10.1's 39 and F1–F7) and the 75 under `test/operations/`: backup 19/0, restore 17/0, list-backups 6/0, download-backup 7/0, upload-backup 10/0, the job and the system 8/0, status 8/0. These are the story's numbers.
  - **Red before green:** the same suite on an export of `d4a9fc06f` gives 45/75/0. A10.1's 39 and P2–P7 pass; F1–F7, P1, P1b and every new lifecycle test fail. That matches the test plan's Verification.
  - **The suites the module, route-table and Docker changes reach:** `admin-action-sweep` 9/0, `openapi-coverage` 13/0, `openapi-document` 10/0, `stack-free-npm-test` 6/0/1 (G2 skips with no live panel), `admin-action-sweep-access` 13/0, `default-deny-mutations` 14/0, `brains-launcher-repo` 31/0, `ci-test-job` 14/0, `about-this-instance` 29/0, `bullboard-admin-access` 9/0, `task-routes-owner-admin` 5/0 and `setup-open-sign-up` 41/0.
  - **Screen matches run after reading them:**
    - The operations suites and their helpers: only dead `127.0.0.1:9` endpoints, and K1's regex text.
    - `admin-action-sweep-access` and `default-deny-mutations`: `/api/strfry/publish` as route data and fake requests.
    - `brains-launcher-repo`: a string inside an assertion message.
    - `stack-free-npm-test` spawns twelve live-API suites, and one of them, `tl-publication-from-pins`, reaches `docker exec`. Under the runner the base URL is dead, so each suite skips at its probe, and `docker` refuses.
  - **Left out:** the other 13 suites the Implementer ran on `8fcb3d675`, among them `router-stream-limit-on-connect`, whose P1–P3 fail on BSD sed and are not this change's. The later commits touch nothing they load: of the lifecycle helpers, the declarations load only `_common.js`, never `_identity.js`, `_jobs.js` or `_system.js`. The Implementer's log of that run (26 suites, 656/3/1) reconciles with the story's "498 passed and 3 failed" for the 21 beyond the five re-run on `b25f6588f`. Suites whose screen matched a container, a publish or a live URL were left out, as in the story.
- [ ] `npm run test:playwright`: not applicable (no UI).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

Two experiments of my own, described under Blocking 1 and Non-blocking 1, ran on scratch folders and an ephemeral loopback port, with no service touched.

## Spec adherence

- [ ] **Every acceptance criterion has a passing test**, but AC3 is not met on a path the design allows (Blocking 1).

  | AC | Passing tests | Also checked by the reviewer |
  |---|---|---|
  | AC1 take a backup | B2–B9, B14, B17–B19 | Every failure path in `runBackupJob` (`_jobs.js:129–194`) starts Neo4j again if it stopped it, restarts the writers it paused, removes the incomplete folder and releases the lock, except two improbable ones (Non-blocking 3). |
  | AC2 see the backups | L2–L5, P1, P1b | |
  | AC3 restore, and prove it | R2–R7, R11–R14, R17 | **Not met when the caller is gone before the answer** (Blocking 1). R11, R12 and R13 cover the three rollback cases the ADR names. |
  | AC4 move to a fresh instance | D2, D3, U2–U6, R4, and the live check | The live check is re-derived below. |
  | AC5 refusals | R8–R10, B10, B11, U8, D4, D5 | R8 refuses an unknown backup 2 ways, a damaged one 5 ways and an incompatible one 2 ways, each in words, and `assertUntouched` proves nothing ran. |
  | AC6 who may call, and the commands | B15, R16, L6, D6, U9; B16, R16, L6, D7, U10 | |

- [x] **The live check holds.** I re-derived it from its raw outputs (`run.log` and the `A.*` and `B.*` files of the run on `b25f6588f`).
  - After the restore, B's export is byte for byte A's: nodes sha256 `ddb9da2e…`, relationships `3f7dd7bd…`. That is 3,147 nodes, 3,610 relationships and the same 2,535 tapestryKeys. The `LiveCheck` fixture's date, float and list of integers came back as they were.
  - The safety backup holds B's own first graph, listed as `before-restore`: 3,145 nodes, 3,609 relationships, 2,533 keys, transaction 6938, and B's assistant `f2778d4d…`.
  - The report gives transaction 6944 against 6944, exact matching counts, admins from `[]` to A's, and `restarting: ["brainstorm"]`. B answered as A about 4 s later. The conf's two lines and `settings.json` are as the story says. The first upload was `uploaded` with `sameInstance: false`, the second `alreadyHeld`.
  - The earlier run on `8fcb3d675` (`run1/`) shows the `[""]` admin list the Deviations describe, before and after its restore.
  - The calls went straight to the control panel on the container's loopback, and the scratch image predates this branch's `docker/` files. So the nginx block and the new stop settings were not exercised (Non-blocking 9).
- [x] **No criterion is silently dropped.**
- [x] **No behavior is added that isn't in the story.** Every changed file is in ADR 0002's implementation notes or a logged Deviation. The new ledger row and OPEN.md row 281's DONE are the Deviations' own. Two small drifts that aren't logged are Non-blocking 7.

## ADR adherence

- [x] **Files changed match the ADR's implementation notes.** `src/operations/files.js` and `_common.js` are logged Deviations, and `bin/tapestry.js` is unchanged, as logged.
- [ ] **Layering and module boundaries are respected**, with two exceptions. Decision 10's "runs the `afterAnswer` functions once, on the response's `finish` or `close`" isn't what `http.js` does when the close comes first (Blocking 1). Decision 7's "the caller removes it too, if the job died" misses a job that never started (Non-blocking 1).
  - **File results and file bodies leave JSON operations as they were.** For an operation with neither, `describe` gives the same `result` (plus `body: null`), `listEntry` adds nothing, `/docs` builds the same parameters and JSON body, `http.js` reads the inputs from the same source, and `cli.js` prints and exits as before. The one change is the logged Deviation: a run that throws a built-in code it can get (`op.refusals`, `index.js:133`) is answered at that code's status, not 500. Those codes are already among the operation's documented refusals, and A10.1's H12 (an undeclared code that isn't built in → 500) still passes.
  - **The Tester's two commits during Implementation are corrections, not weakenings.**
    - `fb9c65cf1` changes five assertions (F2, B15, R16, D6, U9) from the module's `code` to what the central check answers, since it answers first and carries no code. They now check the status, `success: false` and an error naming the owner, exactly as A10.1's H5 does.
    - `2289da6f1` adds B19 and the fakes' `confExtra`, which only appends conf lines.
    - `git log d4a9fc06f..HEAD -- test/` lists only those two. The implementation commits touch no test.
- [x] **No new dependencies.** `package.json` is unchanged, `_tar.js` needs none, and ajv was already one.

## Concept-graph integrity

- [x] **Handles, firmware, orientation:** no concept, handle or firmware definition changes (story, "Concepts touched"; ADR, "Firmware reinstall required? No"). A restore from another instance carries its assistant's key, so its `39998:<TA>:<slug>` headers stay the instance's own, which is AC4's point. Nothing here reads a concept, so `/summaries` doesn't apply.
- [x] **No TA pubkey literal:** the diff adds no 64-hex literal under `src/`, `docker/` or OPERATIONS.md.

## Things tests can't catch

- [x] **No secrets in committed files.** No 64-hex or `nsec1` literal is added; the fakes make keys when they run.
- [x] **No leftover debug logging.** Every `console` call added under `src/` is a deliberate log line: the worker's outcome, a start that failed in a `finally`, a send or after-answer failure, and the command's "runs as a job of its own" (stderr in the command).
- [x] **No commented-out code.**
- [ ] **Error paths and edge cases handled where it matters:** see Blocking 1 and Non-blocking 1–4.
- [ ] **Concurrency and races considered:** mostly. The lock is `open(…, 'wx')`, and an upload lands by one rename. Two narrow lock races are Non-blocking 8.
- [x] **Security at the boundaries.**
  - **nginx:** `docker/nginx.conf:43–53` sets `X-Forwarded-For $proxy_add_x_forwarded_for`, and its `proxy_pass` has no URI, so the path passes unchanged. Traffic through it therefore never passes `auth.js`'s direct-local test, which needs a loopback peer *and* no forwarding header. The block reads as valid nginx (Non-blocking 9).
  - **Paths:** an id input must match `^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$` (R16 sends `../../etc` and gets 400), and `folderOf` throws on anything else. An uploaded manifest's `id` is checked against the same pattern before the rename (`_store.js:82`).
  - **Archives:** an upload keeps a member only when all of the following hold. U6 proves the refusals for links, unknown names, traversal, duplicates, a bad checksum, truncation, garbage and an empty body; I read the base-256 and after-the-end checks in `_tar.js`.
    - Its whole name, prefix included and a leading `./` dropped, is one of the five, and it appears once.
    - It is a regular file. Links and every other type are refused.
    - Its header checksum is right, its size isn't base-256, the archive isn't cut short, and no header follows an end block.
    - Its file is created `wx` and 0600, in a fresh `mkdtemp` folder that the `finally` removes.
  - **Key material:** none reaches an answer, a warning or a log (B18, R17). Decryption runs with `console.error` silenced, and the run files hold only the request and the summary or report.
  - **Access:** every operation is `owner-and-admins`. The owner's ruling, that admins may download the key and restore the key and the admin list, is recorded where the story and the ADR say:
    - the story's Background and open questions 1 and 4;
    - ADR 0002's header and Decision 12;
    - the new header line of ADR `security-auth-exposure/0005`, which names its item 3, and item 3 there is the two owner-only rules;
    - OPERATIONS.md §16.

    Not re-litigated.
  - **CORS** is the instance's posture from before this story (Non-blocking 5).

## House rules check

- [x] Concept Graph API authority respected: no concept is read or written.
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence *(when the story traces to a PRD)*

- Not applicable: the story traces to the book's acceptance frame, not to a PRD, and has no UI.

## Findings

### Blocking

1. **`src/operations/http.js:43–49` and `:98–99`, `src/operations/cli.js:131` and `:153–154`, and `src/operations/catalog/lifecycle/restore.js:42–48`: after a restore that changed the assistant, the control-panel restart is lost whenever the caller isn't there to run it. The instance is then left split between two assistants.**
   - **How it's lost.** `restore` registers the restart as `context.afterAnswer` once the job has finished (`restore.js:46–48`).
     - Over HTTP, `afterResponse` adds its `finish` and `close` listeners only after `callOperation` resolves. If the client left during the job, `close` has already fired, and neither listener ever runs.
     - From the command, the restart runs in `run`'s `finally` (`cli.js:153–154`). Nothing in `src/operations/` or `bin/tapestry.js` handles a signal, so an interrupted command never reaches it.
   - **Proved for HTTP.** I ran the real `http.js` with a scratch fixture operation that takes 1 s and registers an `afterAnswer` that writes a marker. A client that waited got 200, and the marker was written. A client that gave up after 300 ms got nothing, and no marker was ever written.
   - **What follows.**
     - The detached job still finishes the restore: the graph, the key file, the conf's two lines and the admins.
     - The running control panel keeps the old assistant it cached: the pubkey `getOwnerAssistantPubkey()` holds for the life of the process (`src/utils/assistantKeys.js`), and the private key the normalize routes load once, when they register (`_cachedPrivkey`, `src/api/normalize/index.js:88–102`, loaded at `:5481`). Paths that call `getOwnerAssistantKeys()` read the restored key file fresh. So the instance signs as the old assistant on some paths and the restored one on others, while it names, filters by and composes handles with the old pubkey, over a graph whose firmware is the restored assistant's. That is the incident shape CLAUDE.md's TA-pubkey rule describes.
     - Nothing restarts the control panel, and `lifecycle status` reports the restore as `done`.
   - **The design invites this path.**
     - ADR 0002's Consequences expect a restore through the droplets' host nginx to outlast its default 60 s read timeout until an operator raises it, and accept that the caller loses its answer because "the job finishes".
     - An agent's HTTP client may give up sooner. The live check's restore took about 29 s on 3,147 nodes.
     - The command itself tells the operator, "If this command is interrupted, the job still finishes" (`restore.js:42–44`).
   - **What it breaks.** AC3's "within a minute of the answer, with no step by hand, the instance answers as the restored instance" fails, and so does ADR Decision 10's "runs the `afterAnswer` functions once, on the response's `finish` or `close`". F4 and R5 only use a client that waits.
   - **Asked change:** make the restart happen whether or not the caller is still there.
     - For example, `afterResponse` runs the work at once when the response is already closed. And the job (or its worker) restarts the control panel itself when no caller has taken the restart within a short wait.
     - Add a test with a client that gives up before the answer (F4's fixture is enough), and one for a restore whose caller is gone.
     - If any path can still miss the restart, the command's line about interruption must say so.

### Non-blocking

1. **`_jobs.js:321–322`, with `backup.js:38` and `restore.js:41`: the lock stays when the job never starts.**
   - **The gap.** If writing the run file or opening its log throws, nobody releases the lock. The job never ran, `restore.js` has already set `started`, and `backup.js` has no `finally`. Over HTTP, the lock's holder is the live control panel, so it never goes stale.
   - **Reproduced.** I ran the real `_store` and `_jobs` on a scratch backups folder whose `.runs` couldn't be made. `runDetached` threw `EEXIST`, and the lock stayed, with `inspectLock()` saying it wasn't stale. The next caller was told, "A backup is running (since …); try again when it has finished."
   - **Effect.** Every backup, restore and upload then refuses `busy` until the control panel restarts, and status shows nothing wrong. A nearly full data volume is the realistic trigger, and it is likely enough with no rotation.
   - **Suggestion:** release the lock and record the run as failed when `runDetached` throws before the spawn, with a J-class test. Worth doing in the same round.
2. **`_jobs.js:255–265` and `:251`: the restore's errors after the load.**
   - A failure after a successful load answers 500 without saying that the backup's graph is now in place, or naming the safety backup, though AC3's point is that the safety backup is named. The failure can be the start timing out, a count, or putting the identity or the admins in place.
   - If `restoreIdentity` succeeded and a later step threw, the key and the conf changed, but nothing restarts the control panel: the split of Blocking 1.
   - The double-failure message gives a load to run by hand while Neo4j runs, since the job started it at `:247`, so `neo4j-admin` would refuse it as in use. It needs `supervisorctl stop neo4j` before and `supervisorctl start neo4j` after.
3. **`_jobs.js:103–107`, `:136`, `:149–150`, `:206` and `:218–219`: what to undo is recorded after the call that does it.** `paused` is set only once `pauseWriters` returns, and `stopped` only once the stop returns. If `supervisorctl stop` acts and then exits non-zero, the `finally` doesn't start what it stopped, and the lock that recorded `paused` is released. Improbable with supervisorctl's exit codes, and cheap to harden by recording first.
4. **`_common.js:122` and `:129`: `not-enough-space` fails open.** When `load --info` prints no `Bytes: <n>` line, the check is skipped without a word. The fake prints that format, but the live check didn't record the real output. Record it in the evidence, or warn when the size can't be read.
5. **`bin/control-panel.js:118–119`: CORS reflects any origin with credentials, and now covers the instance's key.**
   - The live download's headers include `Access-Control-Allow-Credentials: true` and `Vary: Origin`.
   - So script from any same-site origin, running in a signed-in owner's or admin's browser, can list the backups and read the tar, the secret key included.
   - That is OPEN.md row 326's posture from before this story, and `GET /api/get-customer-relay-keys` already returns customers' keys the same way.
   - **Suggestion:** add this route to row 326.
6. **`http.js:67` and `docker/nginx.conf:48`: two small resource points.**
   - `stream.pipe(res)` doesn't destroy the archive stream when the client aborts, so each aborted download leaves a read stream and its open file behind. `stream.pipeline` would close them.
   - `client_max_body_size 9g` covers the whole `/api/tapestry/lifecycle/` prefix, not just the upload, against 100 MB elsewhere, and OPERATIONS.md's host block copies it. So nginx accepts a visitor's body of up to 9 GB to any lifecycle route. `location = /api/tapestry/lifecycle/upload-backup` would narrow it.
7. **Two small drifts from ADR 0002 that no Deviation logs.** Log or fix them.
   - Decision 4 step 5 captures the dump's stderr "to the run's log". `_system.js:40` keeps it in memory instead, and only its last three lines, 400 characters at most, reach the failure message.
   - `restore`'s result schema is a bare `{ type: 'object' }` (`restore.js:23`), so `/docs` and the list don't describe the report Decision 5 defines, as backup's schema does.
8. **Narrow races and loose ends.**
   - Two callers recovering the same stale lock: the slower one's `rmSync` (`_store.js:295`) can remove the lock the faster one just took.
   - A lock read between `acquireLock`'s create and its write (`_store.js:241`) reads as unreadable, hence stale, and is removed. Renaming a stale lock aside, and writing a new lock through a temporary file and a link, would close both.
   - `_worker.js:20` ignores `addHolder` returning null (the lock isn't its run's), and runs anyway.
   - `_identity.js:127` keeps the backup's stored npub instead of deriving it from the pubkey it has just verified.
   - After a restore interrupted mid-load, the recovery starts Neo4j on whatever the load left, and status's interrupted note (`status.js:118`) doesn't name the safety backup the lock records.
9. **The two Docker files weren't exercised live.** The scratch image predates them, since only `src/` is mounted, and K1 and K2 read text. Both read as valid to me, but neither nginx nor supervisord is installed on this Mac to check them. A broken `docker/nginx.conf` would take down the container's front door when staging rolls the brains, so run `nginx -t` in the new image before it ships.

### Harness friction

1. The review checklist asks for the full gate's `npm run gate:status` line, which this Mac's rule forbids running. Already tracked by ledger row `2026-09-30-npm-test-step-leaks-fixtures`; no new row.

## On PASS (same commit)

- Not applicable this round: the story's Status stays as it is, and completion detection waits for a PASS.

## Verdict

**CHANGES_REQUESTED**

## Round 2

**Date:** 2026-11-08
**Diff:** `git diff 2544c0fa8..bac10ad30`. It holds ADR 0002 Amendment 1 (`b219ec18d`, with A4 in `b02a38065` and `df80956dc`), the Tester's failing tests (`2c6de20c6`, `8cf4fbf27`, `573f4d088`), the fixes (`d118662c4`, `28c4f6e65`) and the evidence (`bac10ad30`). I checked each round-1 finding as a fresh claim, audited Amendment 1 against the code, and read the new code.

### Quality gates (run by reviewer, not trusted)

- [ ] `npm test`: not run, by the same rule as round 1. `npm run gate:status` still finds no record (exit 2).
- [x] **Suites at `bac10ad30`**, whose code is `28c4f6e65`'s, through the same runner.
  - **`test/operations.test.js`: 135/0/0.** That is the module's 47 (A10.1's 39 and F1–F8) and the 88 under `test/operations/`: backup 20, restore 21, list-backups 6, download-backup 7, upload-backup 10, the job, the system and the configuration 16, status 8. It is the story's count.
  - **The gates and round 1's adjacent suites all pass:** `admin-action-sweep` 9, `admin-action-sweep-access` 13, `default-deny-mutations` 14, `openapi-coverage` 13, `openapi-document` 10, `stack-free-npm-test` 6 with 1 skipped (G2 needs a live panel), `brains-launcher-repo` 31, `ci-test-job` 14, `about-this-instance` 29, `bullboard-admin-access` 9, `task-routes-owner-admin` 5 and `setup-open-sign-up` 41.
  - **The screen:** the changed suites name only dead `127.0.0.1:9` endpoints, comments and K1's regex text. J10 spawns the real worker, with stand-in commands on PATH and a conf of dead endpoints.
- [x] **Red before green, re-derived on an export of each commit.**
  - `2c6de20c6` gives 119/11: F8, J4–J7, B20, R5, R18–R20 and P1b fail. `d118662c4` gives 130/0. Both are as the test plan says.
  - `8cf4fbf27` gives 129/5 (J8, J9, J10, K1, R21), as the test plan says.
  - The plan's "J11 failed alone, 134 passed" ran on a tree that no commit holds. `573f4d088` gives 129/6, since A4's code came after it. I re-derived the claim by mutation instead: `bac10ad30` with only `restoreIdentity`'s conf rollback removed gives 134/1, J11 (Non-blocking R2-4).
- [x] **The two Docker files, in the image.** Each check ran in a throwaway `tapestry-tapestry:latest` container with no network and the branch's file mounted read-only, as the coordinator allowed.
  - `nginx -t` passes. `nginx -T` shows the server's `client_max_body_size 100m`, the lifecycle prefix with no limit of its own, and `location = /api/tapestry/lifecycle/upload-backup` with `9g` and `proxy_request_buffering off`.
  - supervisord's own loader reads `[program:neo4j]` as `stopwaitsecs` 120 with `stopasgroup` and `killasgroup` true. `[program:brainstorm]` still has `stopasgroup` false, which the detached job relies on.
- [x] **Live checks 3 and 4, re-derived from their raw outputs** (`run3/` and `run4/`).
  - In both, the restore's client gave up after 3 s (`curl -m 3`, exit 28), so nobody waited for the answer.
  - **Run 4**, whose log names HEAD `28c4f6e65`:
    - The job finished at 23:33:13.168Z, the control panel marked the run answered at 13.279, and the job restarted it at 13.677, with `restartedBecause: "the answer is out"` and caller pid 234.
    - The report in the run's file: transaction 6944 both ways, counts exact and matching, offline 20,746 ms, admins from `[]` to A's, `restarting: ["brainstorm"]`, and the assistant from `349db554…` to `7062b6b5…`.
  - **Run 3** has the same shape: finished 23:13:38.718Z, marked answered 120 ms later, restarted at 39.224, transaction 6934. Its log doesn't name its commit, but its times fall between `d118662c4` and the next commit.
  - **In both runs:**
    - B's exports after the restore are byte for byte A's: 3,147 nodes, 3,610 relationships and the same 2,535 tapestryKeys.
    - The upload was kept as `uploaded` with `sameInstance: false`, and the same file again was `alreadyHeld`.
    - The safety backup is listed as `before-restore`.
    - The conf's two lines and `settings.json` name A's assistant and admin.
  - The live check kept only the last five lines of the worker's log, so it doesn't show the new dump and load lines. My own experiment's output does.

### Round 1's findings, checked again

| Round 1 | Now | Evidence |
|---|---|---|
| Blocking 1: the restart depended on the caller | **Fixed** | A1 and A2. The job's worker restarts the control panel once the caller marks the run answered (`restore.js:89`, `_jobs.js:412–441`), once the caller's pid is gone, or at 120 s. After-answer work runs at once when the response has already closed (`http.js:51`, with the flag at `:86`). J4, J5, J8, F8, R5 and R21 pass, and each failed first. My round-1 experiment, re-run: the abandoned request's after-answer work now runs. Runs 3 and 4 show the whole path live. The command's "If this command is interrupted, the job still finishes" is now true of the restart too (J5's dead caller). |
| NB1: a lock left when the job never starts | **Fixed** | `runDetached` releases the lock and answers `failed` when the run file or its log can't be made (`_jobs.js:366–374`). J6 passes. My round-1 experiment now leaves no lock, and nobody is refused. |
| NB2: the restore's errors after the load | **Mostly fixed; one step open** | A failure while counting, putting the key in, restoring the admins or starting the writers now says "Backup X's graph is in place … the safety backup Y" (R18). When the key went in before a later failure, the control panel restarts (R21, J8), and a conf that can't follow puts the old key back (J11). The rollback's by-hand steps are stop, load, start (R19). **Open:** the start and the wait right after the load (`_jobs.js:264–265`) sit before the new `try` (`:276`). I ran `runRestoreJob` with the suite's fakes and a start that fails after the load. The error is the bare `supervisorctl start neo4j exited 7: …`, though the backup's graph is on disk and a safety backup exists (Non-blocking R2-1). |
| NB3: what to undo was recorded after the call | **Fixed in the job** | `paused` and `stopped` are set before the stop (`_jobs.js:111`, `:156`, `:226`), and B20 passes. The lock's `stage` is still written after the stop (Non-blocking R2-2). |
| NB4: `not-enough-space` fails open | **Recorded, and the reason holds** | I fed a live-check dump to 5.26.10's `neo4j-admin database load --info` in a throwaway container. It prints `Bytes: 272285696`, which `_common.js:122` parses. |
| NB5: CORS covers the key | **Recorded** | OPEN.md row 326 gains a dated note naming `download-backup`. |
| NB6: an aborted download, and 9g on every route | **Fixed** | `sendFile` destroys the stream when the client goes (`http.js:73`). Through the real `http.js`, a client that left after 512 KiB of a 50 MiB file stopped the stream at 640 KiB. Only `location = …/upload-backup` takes 9g (K1, `nginx -T`), and OPERATIONS.md's host block is split the same way. |
| NB7: two undocumented drifts | **Fixed** | The dump's and the load's last line go to the run's log (`_jobs.js:91`, `:98`); my experiment printed both. Restore's schema names the report's fields, and a real report validates against it (R20). |
| NB8: narrow races and loose ends | **Fixed** | Recovery releases by `runId` and returns any fresh lock as busy (`_store.js:308–311`, J7). What's left is the read-then-remove inside `releaseLock`, now microseconds wide. The lock is linked into place whole (`_store.js:250`, J9). The worker runs nothing when the lock isn't its run's (`_worker.js:24`, J10). The npub is derived from the key (`_identity.js:127`). An interrupted restore's status names its safety backup (P1b). |
| NB9: the Docker files weren't checked | **Fixed** | `nginx -t` and supervisord's loader pass in the image, checked by the coordinator and again by me (Quality gates). |

### Amendment 1 against the code

- **A1 holds as written.**
  - `callerPid` is in the request (`_jobs.js:368`).
  - `afterJob` polls every 500 ms for at most 120 s, restarts once, and records `restartedAt` and why.
  - The restore declaration registers `markAnswered`, not the restart, and `restartControlPanel` is gone from `_identity.js`.
- **A2 holds** (`http.js:47–55`).
- **A3 holds except for one sentence.** "When a step after the load fails, the error says the backup's graph is in place and names the safety backup" is false for the start and the wait right after the load (Non-blocking R2-1). Its "recorded, not changed" points hold (NB4 and NB5 above).
- **A4 holds, all five points:**
  - a failed record keeps its `restarting` (`runJob`, `_jobs.js:345–355`);
  - the conf rollback;
  - the split nginx blocks;
  - the linked lock;
  - the worker's lock check.
- **The story's Deviations cover what the ADR didn't say:** `runDetached` resolving on the record as well as on the exit, a failed rollback left for the `finally` to start, and the restart's move into the worker.

### The new code

- **Sound.**
  - The worker stays on after a restore only to restart the control panel. The lock is released before the record is written, so nothing waits on it.
  - The run file has two writers, and they take turns. The caller marks the run only once the worker's record is in it, and the worker records the restart only after it has seen the mark, or stopped waiting for it.
  - `markAnswered` checks the id, and `afterJob` sends only signal 0, to the pid in the caller's own record.
  - Both nginx blocks keep `X-Forwarded-For`.
  - No secret, debug line or TA literal is added. The new log lines carry only `neo4j-admin`'s last line.
- **One property rests on the live check alone.**
  - `runDetached` must resolve on the job's record (`_jobs.js:380–386`), because a restore's worker stays alive after writing it. A caller waiting for the worker's exit would wait up to 120 s on itself, and over HTTP the control panel would be restarted before it answered.
  - No suite pins this: with the polling removed, so that it resolves on the exit only, all 135 operations tests still pass.
  - Runs 3 and 4 show it working: the run was marked answered about 120 ms after the job finished (Non-blocking R2-3).

### Findings (round 2)

#### Blocking

None.

#### Non-blocking

1. **R2-1. `_jobs.js:264–265`: A3 isn't met for the first step after the load.** If the server doesn't start on the loaded store, or doesn't answer within 300 s, the error says only that, though the backup's graph is on disk and the safety backup exists. Move the two lines into the `try` at `:276`, with a step such as "starting the graph database on the loaded backup", or narrow A3's sentence. `list-backups` still finds the safety backup without Neo4j, so this is about the message, not lost data.
2. **R2-2. `_jobs.js:156–158` and `:226–228`: the lock's `stage: 'offline'` is written after the stop returns.** The `finally` is now right. But a worker killed during the stop, which may now take up to 120 s, leaves Neo4j stopped under a lock that says `online`, so the next operation's recovery doesn't start it. Write the stage before the call, as A3 does for the job's own flags. A recovery that starts a server already running does no harm.
3. **R2-3. `runDetached` resolving on the record has no test** (see "The new code"). Add a J-test whose stand-in worker writes its record and stays alive, and assert that `runDetached` resolves before the worker exits.
4. **R2-4. The test plan's last red-before-green line** ("J11 failed alone, 134 passed") doesn't say it ran on a tree with A4's other fixes but not J11's, which no commit holds. Say so, or cite the mutation above.

#### Harness friction

1. The coordinator asked for the completion-detection result in this file. The review template says the result and the book arithmetic go to the chat or the run journal, "never in this file". I wrote the one-line result below and kept the arithmetic in the chat.

### On PASS (same commit)

- [x] The story's `**Status:**` is flipped to Done in place.
- [x] Completion detection was performed for book `graph-operations-first-slice`. The book does not look complete, so `/close-book` is not offered. The arithmetic is in the chat.

### Round 2 verdict

**PASS**
