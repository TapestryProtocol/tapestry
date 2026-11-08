# Review: Story 6 — The external CLI and the agent's skill

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-08
**Diff:** `git diff 5fad20913...HEAD` (HEAD `7c890cc49`: story `6c374a4f4`, ADR `460a723f3`, failing tests `c627aa0ad`, implementation `7c890cc49`)
**Story:** [6-external-cli-and-agent-skill.md](../../stories/graph-operations-foundation/6-external-cli-and-agent-skill.md) · **ADR:** [0006-external-cli-made-from-the-operations-list.md](../../decisions/graph-operations-foundation/0006-external-cli-made-from-the-operations-list.md) · **Test plan:** [6-…test-plan.md](../../stories/graph-operations-foundation/6-external-cli-and-agent-skill.test-plan.md)

**In short.** The CLI follows the ADR closely, and its suite covers every acceptance criterion. Three things block:

1. CI's gate will fail on a guard that the new top-level `clients/` folder trips (B1).
2. A write whose declared refusal is a 401 runs twice. A probe proved it (B2).
3. The skill's test misses two of the cases AC6 names. Mutations proved it (B3).

## Quality gates (run by reviewer, not trusted)

- [ ] **`npm test`: not run.** On this machine the full gate's live suites can reach a private instance: container `tapestry` at `localhost:7778` is someone's agent memory, not a dev stack. This review's environment rule forbids the full run.
  - There is no run record to quote: `npm run gate:status` printed `no gate run records in <worktree>/tmp/gate-runs` (exit 2).
  - CI runs the full gate on the pull request. **As the branch stands, that run will fail** on `brains-launcher-repo` W1c (B1).
- [x] **Suites run one by one,** through their `run()` exports, on Node 24.18.0 at `7c890cc49`. Every service endpoint was dead: the session's runner points `BRAINSTORM_BASE_URL`, `TAPESTRY_BASE`, `NEO4J_URI`, `REDIS_*` and `MEILI_URL_HOST` at port 9. Results are pass/fail/skip.

  | Suite | Result | Why it was run |
  |---|---|---|
  | `external-cli` | 49/0/0 | the story's suite |
  | `operations` (with H16, D6) | 48/0/0 | the list's `caller` |
  | `openapi-coverage` | 13/0/0 | reads `src/operations/openapi.js` |
  | `openapi-document` | 10/0/0 | the API document |
  | `admin-action-sweep` | 9/0/0 | the route table |
  | `admin-action-sweep-access` | 13/0/0 | the route table |
  | `default-deny-mutations` | 14/0/0 | the route table |
  | `stack-free-npm-test` | 6/0/1 | G5, the registry is complete. G2 skips with no live panel. |
  | `brains-launcher-repo` | **30/1/0** | reads `.dockerignore` and every top-level path. **W1c fails** (B1). |
  | `harness-lint` | 85/0/0 | lints the real repo, including the new story, ADR and test plan |
  | `harness-stats` | 12/0/0 | the commit-message slugs |
  | **Total** | **289/1/1** | |

  The story's Evidence gives the first nine suites as 193/0/1, with `brains-launcher-repo` at 31/0/0. At HEAD the same nine are 192/1/1. B1 explains the difference.
- [x] **The screen.** Before running, I grepped each suite for `docker exec`, `TAPESTRY_PORT` and `:7778`. I read each match and judged it safe:
  - `stack-free-npm-test.test.js:43` has a `localhost:7778` fallback, which the dead `BRAINSTORM_BASE_URL` overrides.
  - The 12 live suites that suite's G1 spawns carry the same fallback. One of them, `tl-publication-from-pins`, has a `docker exec` path, but it runs only after the suite's reachability probe passes (`:226-232`).
  - `brains-launcher-repo.test.js:334` is an assertion message. That suite spawns only `bash` (with a fake `curl`) and `git`.
- [x] **Red before green.** On an export of `c627aa0ad`, `external-cli` gives 0/49 and `operations` 46/2 (H16 and D6 fail), as the test plan's Verification says. Phase 4 left `test/` alone: `git diff c627aa0ad..HEAD -- test/` is empty.
- [x] **Two probes,** kept in the session scratchpad and not committed, each described where it is used:
  - a loopback test instance with a write that declares a 401 refusal (B2);
  - SK1–SK3 run against four mutated copies of the skill (B3).

  Neither touched Docker, a relay or the worktree.
- [ ] `npm run test:playwright`: not applicable (no UI).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [ ] **Every acceptance criterion has a passing test:** all but part of AC6.

  | AC | Tests | Also checked by the reviewer |
  |---|---|---|
  | AC1 sign-in | S1–S6 | A sign-in is reused by origin and pubkey (`clients/cli/src/sessions.js:31-36`). The re-sign-in happens at most once per run (`signin.js:47`). **But** any 401 triggers it, including an operation's own declared 401, which makes a write run again (B2). |
  | AC2 from the instance | O1–O6 | An unknown group or operation exits 2. Its message says the operation "may not exist there, or it may be the owner's only", and lists what the key may call (`main.js:118-130`). |
  | AC3 calling | K1–K10 | K3 compares 15 writes and 3 reads against the internal command, run in-process over the same catalog. K10 holds the parser to the original on 15 argument lists. `parseFlags` (`flags.js:15-31`) is byte-identical to `src/operations/cli.js:65-81`. |
  | AC4 key, instance, who | I1–I15 | No path prints a secret. The errors name where the key came from, not its value (`identity.js:63-96`). `key show` names the source, never the signer command, which may hold a bunker secret. |
  | AC5 only the operations | A1–A3, S6 | The client requires only its own modules, `ajv`, `nostr-tools/pure`, `nostr-tools/nip19` and Node built-ins. `POST /api/auth/logout` is public (`src/middleware/routeAccess.js:128`) and is ADR Decision 2's `logout`, so I read it as part of "its sign-in". The guard on list routes is a string-prefix check (non-blocking 3). |
  | AC6 the skill | SK1–SK4 | The skill covers every topic the story lists, and names no operation but `lifecycle status`. **SK3 doesn't fail when the skill names an exit code, or a second command word, that the CLI lacks** (B3). |
  | AC7 end to end | the live check, in the story's Evidence | Judged from its record, below. |

- [ ] **No criterion silently dropped:** AC6's last bullet is only half tested (B3).
- [x] **No behavior added that isn't in the story.** `login`, `logout`, `use`, `key show` and `--version` come from ADR Decision 2. The Deviations log the rest, and each stays inside the ADR.

**AC7, judged from its record.** I didn't re-run it (environment rule).

What I verified:
- **The output matches every Evidence claim.** The session scratchpad holds the live-check script and its output.
  - `key new` printed `{ file, npub, pubkey }`.
  - `whoami` answered `neither`, exit 1, before the owner acted, and `admin`, exit 0, after.
  - `tapestry` listed `lifecycle status`.
  - That operation exited 0 both outside and inside, and the two answers were JSON-equal: firmware 1.0.0 `all`, 39 of 39; cache 3,142 nodes, 428 cached.
  - A second key answered `neither`.
  - The home was 0700, and its three files were 0600.
- **The check ran this branch's code.**
  - The standalone install it ran from has the same `bin/`, `src/`, `skill/`, `package.json`, lockfile and README as `7c890cc49` (`diff -rq`).
  - `whoami` answered `role: admin`, not the fallback for an older instance, so this branch's `http.js` was live.
- **The owner's step was equivalent.** Making the key an admin through `updateOverrides({ adminPubkeys })` is the same write that `POST /api/admin/add` makes (`src/api/admin/index.js:212-213`).

What I couldn't verify:
- **Where the record came from.** I can't confirm it is the output of the run it describes.
- **The cleanup.** I can't confirm the scratch stack was removed afterwards.
- **That the CLI reached nothing else.** The nginx excerpt is `tail -n 40`, filtered by the CLI's User-Agent. Its counts (4 sign-ins, 6 refusals of the list) also include an earlier run against the same scratch stack, since this script signs in only twice. The claim "only these four routes" holds for that window.

## ADR adherence

- [x] **Files match Decision 1.** The extra `src/errors.js` is a logged Deviation. The instance's side changes exactly the three files the implementation notes name.
- [x] **Layering.** Nothing in `src/` or `bin/` loads the client (P4), and the client loads nothing from the server's tree.
- [x] **Dependencies.** nostr-tools 2.10.4 and ajv 8.18.0, pinned at the root's versions (P1).
  - The gate runs the CLI against the root's `node_modules`, not against its own lockfile's tree.
  - The two trees match for nostr-tools' crypto. The root nests @noble/curves 1.2.0, @noble/hashes 1.3.1 and @scure/base 1.1.1 under nostr-tools, the versions the client's lockfile hoists.
  - They differ only in ajv's `fast-uri` (3.1.8 against 3.1.0).
- [ ] **Two of the ADR's own claims don't hold as built.**
  - Decision 5 says "A 401 is answered before the operation runs, so a write is never sent twice". That is false for a write whose declared refusal is a 401, which the declaration rules allow (B2).
  - Decision 8 says the skill's test fails when "the skill names … [an] exit code that isn't in the tables". It doesn't (B3).
- [ ] **Decision 10 is right but incomplete.** `.dockerignore` lists `clients/`, but `brains-launcher-repo` W1c also requires a new top-level folder to be sorted, and no artifact planned for that (B1).

## Concept-graph integrity
- [x] **Handles:** none touched.
- [x] **Firmware reinstall:** not needed, since no concept changed (the ADR says the same).
- [x] **`/summaries`:** not applicable, since the CLI reads no concept.

## Things tests can't catch
- [x] **No secrets in committed files:** no added line holds an nsec or a 64-character hex string.
- [x] **No leftover debug code:** no `console` call in the client, no TODO and no `debugger`.
- [x] **No commented-out code.**
- [ ] **Error paths and edge cases:** B2, and non-blocking 2, 5 and 6.
- [x] **Concurrency.** `sessions.json` is always written whole, through a temporary file and a rename. Two runs at once can lose one another's update. That costs one extra sign-in and never mixes keys (I15).
- [x] **Security.**
  - The instance URL must be an origin, and https except for loopback.
  - Redirects are refused, so neither the cookie nor the signed challenge follows one.
  - A key file is refused if any group or other permission bit is set.
  - A signer's event is checked for kind, pubkey, content, tags, time and signature before it is sent.
  - The signer command is the agent's own. Nothing is put into it; the event goes on its stdin.

  The prefix guard on list routes is the weak point (non-blocking 3).

## House rules check
- [x] **Concept Graph API authority:** respected (not involved).
- [x] **No new lint, typecheck or build tooling.** The client package has no scripts and no build.
- [x] **No TA pubkey** anywhere in the client.

## Product-guide adherence *(when the story traces to a PRD)*
- Not applicable. There is no PRD (the book has an acceptance frame), and no UI.

## Findings

### Blocking

1. **`test/brains-launcher-repo.test.js:260-265`: CI's gate will fail.** The failing test is W1c (`:267-274`), and the suite gates through `test/registry.js:234`.
   - **What fails.** W1c requires every top-level path in `git ls-tree --name-only HEAD` either to roll the brains or to be listed in `NOT_RUNTIME`. It now fails with "sort these into publish-image.yml's push paths or NOT_RUNTIME here: clients".
   - **Why it passed earlier.** It passed in Test Design and in Implementation because `clients/` wasn't committed yet: the tree of `c627aa0ad` has no `clients`. The Evidence was written in the same commit as the client. So the story's Evidence row for this suite (story `:159`, 31/0/0) and its total (`:160`, 193/0/1) aren't true of `7c890cc49`.
   - **Asked change:**
     - Add `'clients'` to `NOT_RUNTIME`. Don't add it to `publish-image.yml`'s push paths: Decision 10 keeps a client change from rolling the brains. This is a test file, so it's a Test Design change, to be noted in the test plan.
     - Then re-run the touched suites on the committed tree, and correct the Evidence table.
     - While there, correct the screen sentence (story `:147`). The screen found more than "the launcher suite's assertion text". It also found `stack-free-npm-test.test.js:43`'s `localhost:7778` fallback, and the live suites that suite's G1 spawns. They are harmless with dead endpoints, but that sentence is what tells the next person on this machine that the run was safe.

2. **`clients/cli/src/signin.js:47-53` and `clients/cli/src/main.js:140`: a write whose declared refusal is a 401 runs twice.**
   - **The cause.** `authed` treats every 401 as an ended sign-in. It drops the kept sign-in, signs in again and sends the call again. But a declaration may give its own refusal any 4xx status (`src/operations/declaration.js:119`), so a 401 can come from an operation after it has run.
   - **The probe.** I ran a loopback test instance, with dead endpoints, serving a write whose `run()` counts each run and then throws a declared `{ code: 'upstream-auth', status: 401 }`. One `tapestry graph write-then-401` exited 1, but:
     - **the operation ran twice**: two POSTs, two sign-ins;
     - stderr said "… didn't accept the sign-in of npub…, even after signing in again", which was false;
     - the kept sign-in, which was still good, was dropped.
   - **Why it matters now.** ADR Decision 5 gives this as the reason a retry is safe: "A 401 is answered before the operation runs, so a write is never sent twice". That is false under rules the instance already accepts, and every later write reaches this CLI with no change to it.
   - **How likely.** No operation declares a 401 yet: not `lifecycle status`, and none of the six on the `A10.2-lifecycle-backup-restore` branch (`20d3fa902`). So the problem is latent, and cheap to close now.
   - **How to tell the cases apart.** The instance's own sign-in refusals carry a code no declaration can use:
     - the central check's 401 has no `code` (`src/middleware/auth.js:329-331`);
     - the router's 401 has `code: 'sign-in-required'` (`src/operations/http.js:34`), a reserved code (`declaration.js:39`, `:116`).
   - **Asked change:** sign in again and retry only on one of those two. Treat any other 401 as the operation's answer: print it, exit 1, keep the sign-in, and don't claim the sign-in failed (`main.js:140`). This narrows Decision 5:
     - the Architect amends its sentence;
     - the Tester adds a fixture write that declares a 401, and asserts it runs once with no second sign-in.
   - **Optional, same cause.** The 403 note at `main.js:139` also reads the status alone, so a declared 403 would be reported as "neither its owner nor an admin".
   - **An alternative.** Forbidding 401 in declared refusals at `declaration.js:119` would close this for every client. But that is story 1's file and outside this story's scope, so it is the owner's call, and it would have to land before any write does.

3. **`test/external-cli.test.js:862-868` and `:874-879` (SK3): the skill's test misses two of the cases AC6 names.**
   - **What's required.** AC6 (story `:88`) and ADR Decision 8 (`:184-187`) both say: "A test fails when the skill names a command, flag or exit code the CLI doesn't have".
   - **What SK3 does.** It checks only the first word of each command the skill shows. It checks that the four codes in the table appear in the skill, but never that the skill names no other code.
   - **The mutations,** run on copies of `skill/SKILL.md` through the suite's own SK1–SK3:
     - unmutated: all pass;
     - an exit-table row `| 4 | timed out | … |` added: **SK3 passes**;
     - `` `tapestry key rotate` `` added: **SK3 passes**;
     - controls: adding `TAPESTRY_PROFILE` fails SK3, and adding `` `tapestry rotate` `` fails SK3.
   - **Where the gap started.** The test plan's SK3 row (`:65`) had already dropped exit codes from this direction ("no `tapestry …` word, flag or variable the CLI lacks").
   - **Asked change (Tester).** SK3 must also fail:
     - when the skill gives an exit code that isn't a key of `EXIT_CODES`, in its exit table or as an `exit <n>`;
     - when a command the skill shows matches a table entry by its first word only. Require the entry's full `words`, so `key rotate` fails and `key new --file <path>` passes.

     The four mutated copies should then all fail SK3, and the unmutated skill should still pass.

### Non-blocking

1. **Merge order with A10.2.**
   - **What A10.2 adds.** The `A10.2-lifecycle-backup-restore` branch (`20d3fa902`, not on staging) declares two operations that carry a file:
     - `lifecycle download-backup` answers with a tar (`result.file`);
     - `lifecycle upload-backup` takes a tar as its body (`body.file`; inside the instance, `tapestry lifecycle upload-backup < backup.tar`).
   - **Why this CLI can't run them.**
     - It accepts only a JSON object as an answer (`clients/cli/src/instance.js:76`, `:88-92`): it reads a tar whole into memory and then exits 3.
     - It sends only a JSON body made from flags (`clients/cli/src/operations.js:119-126`, `:137`).
   - **What stops holding.** Once both stories are on one branch, AC2's "nothing about the CLI changes, then the CLI lists it and runs it" and Loom's done-when stop holding for those two operations. If A10.2 reaches staging first, AC7's "any that land before this story does" also covers them.
   - **The shared files.** A10.2 also edits `src/operations/http.js`, `openapi.js`, `index.js` (where its `listEntry` gains `body` and `result.file`) and the epic file, all of which this story edits too.
   - **Suggested.**
     - Decide now which story makes the external CLI carry files.
     - Re-run the AC7 live check for whatever has landed before this story merges.
     - Meanwhile, have the CLI say plainly that it can't carry an operation whose list entry has `result.file` or `body`, rather than failing with "isn't JSON".

2. **`clients/cli/skill/SKILL.md:79`: the advice for exit 3, "try once more at most", can repeat a write.** A client timeout (`TAPESTRY_TIMEOUT`) doesn't stop the operation on the instance, and a 500 may come after a write has run. Suggested: for a read, try once more; for a write, read the state first, with `lifecycle status` or the operation's own read.

3. **`clients/cli/src/operations.js:130`: the "only under `/api/tapestry/`" guard is a string-prefix test.**
   - A list route `/api/tapestry/../admin/add` (or one with `%2e%2e`) passes it, and `fetch` normalizes it to `/api/admin/add`.
   - The host can't change, so the risk stays on the same instance. But the Deviation presents this guard as protecting AC5 against a wrong list.
   - Suggested: check `new URL(route, origin).pathname` instead.

4. **The tables aren't held to the code.**
   - The dispatch (`main.js:152-162`) and the environment variables read (`identity.js:125-135`, `instance.js:35-48`) are written by hand.
   - Today they match `commands.js` exactly: 6 first words and 7 variables, which I checked by grep.
   - But no test fails if the code gains a command or variable that the table lacks. That is the other half of AC6: "the CLI has a command of its own that the skill doesn't explain".
   - Suggested: dispatch from the table, or add a structural test.

5. **`clients/cli/src/identity.js:174-177`: on the signer's 180-second timeout, SIGKILL reaches `/bin/sh`, not necessarily the program it started.** A `nak` waiting on a bunker can outlive the CLI. Suggested: spawn the signer detached and kill its process group.

6. **`clients/cli/src/main.js:176`: the Node check tests `fetch` and `AbortSignal.timeout`, but not `Headers.prototype.getSetCookie`** (Node 19.7 and later). On Node 18 the CLI fails at sign-in with "sent its sign-in challenge without a session cookie", which misleads. `engines` says `>=20`, so npm does warn.

7. **The `local` role isn't explained.**
   - If the CLI reaches an instance's app directly over loopback, with no proxy in front, the instance treats it as a direct-local caller. The list's `caller.role` is then `local`, and `whoami` prints `role: local` (`main.js:85`), with every operation open to it.
   - The skill invites that path ("must be https, except for this machine"), but it explains only `owner`, `admin` and `neither` (`SKILL.md:56`).
   - Suggested: one line in the skill.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **A Phase 4 run can't be trusted for a suite whose answer depends on what is committed.** New: no OPEN.md row covers it.
   - W1c reads `git ls-tree HEAD`. The Implementer runs the suites and writes the Evidence before the implementation commit. So a new top-level folder passed there, and fails at the commit CI tests (B1).
   - Candidates:
     - W1c also counts untracked top-level paths (`git ls-files --others --exclude-standard`);
     - workflow 4 step 7 asks for the touched suites to be re-run on the committed tree.
2. **This review has no `npm run gate:status` line to quote.** No full run exists for this code on this machine, and none may be made here.
   - Row 294 (OPEN) already proposes that a review may rest on recorded runs plus the suites that read changed files.
   - This machine adds the case with no full run at all, where CI's run on the pull request is the first.
   - Add this case to row 294 rather than opening a new row.
3. **Two stories of one epic were planned at once, in different sessions, with clashing assumptions and no step to reconcile them.**
   - A10.2 adds operations that carry files, and edits the shared operations files. A10.6's ADR assumes every answer and every body is JSON (non-blocking 1).
   - The epic's note handles only the stories' numbers.
   - Candidate: when stories of one epic are in flight together, each ADR names the other's changes to the shared files, and the operation shapes it assumes.

## On PASS (same commit)
- [ ] Not applicable: the verdict is CHANGES_REQUESTED.
  - The story's `**Status:**` stays `Approved`, and no completion detection was run.
  - The optional independent check (workflow 5) wasn't applied.
  - The launching task asked for this file only, so this session commits nothing.

## Verdict
**CHANGES_REQUESTED**
