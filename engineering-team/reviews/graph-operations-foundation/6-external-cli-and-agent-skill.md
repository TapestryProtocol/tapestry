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

---

# Round 2

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-08
**Diff:** `git diff e5df47f95..801d6a9c0`, attributed commit by commit:
- `91f510908`: ADR 0006 Decision 5 amended (which 401s are retried). Docs only.
- `a3cb39f1e`: the Tester's round: `clients` in W1c's `NOT_RUNTIME`, S7, K11, a stricter SK2 and SK3, and the test plan's round-1 record. It touches no `clients/` or `src/`.
- `c179e7e49`: the fix, in `clients/cli/src/signin.js`, `main.js`, `operations.js`, `identity.js` and `skill/SKILL.md`, plus the story's Deviations and Out of scope. It touches no `test/`.
- `b7717ff13`: two ledger rows, and a case added to OPEN.md row 294.
- `66baabf4e`: the story's Evidence: the suites on the committed tree, and the live check run again.
- `eebdeb882`: one Evidence line (story `:192`), correcting the cause of the rerun's failed first try.
- `801d6a9c0`: a ledger row on `scripts/scratch-stack.sh`'s one shared name.

**In short.** B1, B2 and B3 are fixed, and each fix holds when re-derived. One new blocking issue comes from this round: the signer now runs in a new session, which takes its terminal away and lets it outlive a Ctrl-C (R2-B1). The change followed my own round-1 suggestion (non-blocking 5), which I withdraw.

## Quality gates (run by reviewer, not trusted)

- [ ] **`npm test`: not run,** for round 1's reason. `npm run gate:status` still has no run record. OPEN.md row 294 now carries this case.
- [x] **Suites run one by one** through their `run()` exports, on Node 24.18.0 at `801d6a9c0`, with nothing uncommitted but the `node_modules` link and every service endpoint dead (the same runner as round 1):

  | Suite | Result | Why it was run |
  |---|---|---|
  | `external-cli` | 51/0/0 | the story's suite, now with S7 and K11 |
  | `operations` | 48/0/0 | the list's `caller` |
  | `openapi-coverage` | 13/0/0 | as round 1 |
  | `openapi-document` | 10/0/0 | as round 1 |
  | `admin-action-sweep` | 9/0/0 | as round 1 |
  | `admin-action-sweep-access` | 13/0/0 | as round 1 |
  | `default-deny-mutations` | 14/0/0 | as round 1 |
  | `stack-free-npm-test` | 6/0/1 | G5 (G2 skips with no live panel) |
  | `brains-launcher-repo` | 31/0/0 | W1c now passes (B1) |
  | `harness-lint` | 85/0/0 | lints the real repo, the new ledger rows included |
  | `harness-stats` | 12/0/0 | the commit-message slugs |
  | `session-start` | 32/0/0 | new this round: its tests read this repo's `OPEN.md` and `ledger/` through the meta reader, so they cover the three new rows |
  | **Total** | **324/0/1** | |

  The eleven suites the story's Evidence names give 292/0/1 at the tip, the same as its table (taken at `c179e7e49`).
- [x] **Left out, after screening:** `ledger-row-ids` and `rollup-scanners`, which read the ledger too.
  - Both run `scripts/session-start.sh` (`ledger-row-ids.test.js:111`; `rollup-scanners.test.js:194`, through `test/helpers/rollupFixtures.js:43-46`). Its stack probe GETs `localhost:7778` (`session-start.sh:41-47`), the private instance on this machine (harness friction 1).
  - Both work on fixture repos, except rollup-scanners' AC-2, which reads this repo's meta list. I ran that check by hand: `collect_meta` exits 0 and lists all three new rows, and none of its 244 lines is invalid UTF-8.
  - `bash scripts/harness-lint.sh` at the tip is clean, with 0 violations. Its L15 checks every `ledger/*.md`.
- [x] **Red before green for this round's tests.** On an export of `a3cb39f1e`, `external-cli` gives 48/3, and the three are S7, K11 and SK2, as that commit says. Phase 4 left `test/` alone: `git diff a3cb39f1e..HEAD -- test/` is empty.
- [x] **Round 1's two probes, re-run at the tip.**
  - The declared-401 write: one POST, one run and one sign-in (the first), exit 1, nothing on stderr.
  - SK1–SK3 on the four mutated skills: SK3 fails on the exit code 4 and on `` `tapestry key rotate` ``; both controls still fail it; the unmutated skill passes.
- [x] **Two new probes,** under a pseudo-terminal (`script -q /dev/null`), kept in the session scratchpad. They spawn a stand-in signer with this CLI's own spawn options, round 1's and round 2's, and check whether it can open `/dev/tty` and whether it survives a Ctrl-C (R2-B1). Neither touched Docker or the worktree, and I removed the stand-ins they left.
- [ ] `npm run test:playwright`: not applicable (no UI).
- [ ] _Lint, typecheck and build not configured — skipped._

## Round 1's findings, each re-derived as a fresh claim

| Finding | Re-derived by | Result |
|---|---|---|
| B1, W1c | `brains-launcher-repo` at the tip: 31/0. `clients` is in `NOT_RUNTIME` (`test/brains-launcher-repo.test.js:263`), not in the push paths. The Evidence's table holds at the tip. Its screen sentence (story `:164-167`) lists exactly what a grep of the eleven suites finds: `stack-free-npm-test.test.js:43`, `brains-launcher-repo.test.js:335`, `harness-lint.test.js:58` and `:188`. | Fixed. My round-1 wording also asked it to name "the live suites its G1 spawns". Re-derived, that wasn't needed: G1 points them at a dead port itself (`stack-free-npm-test.test.js:121`). |
| B2, a declared 401 | The probe and S7 (which fails on `a3cb39f1e`): sent once, run once, no second sign-in, exit 1, the kept sign-in still works. The new predicate (`clients/cli/src/signin.js:48-50`) retries only a 401 with no `code`, or with `sign-in-required`. That separates the cases exactly: a declared code must be kebab-case (`src/operations/declaration.js:115`) and can't be a built-in one (`:116`), and both of the instance's sign-in refusals come before the operation runs (the central check, and the router's `gate`, `src/operations/http.js:48-50`). The amended ADR text (`:151-152`) says the same, and its line references are right. | Fixed. The optional 403 half wasn't taken (non-blocking 1). |
| B3, SK3 | The mutation probe, as above. | Fixed. |
| Non-blocking 1, A10.2 | The story's Out of scope (`:100`) and a ledger row record it. A10.2 is still off staging (`github/staging` is `5fad20913`). Its branch, now at `d118662c4`, still declares `download-backup` with a file result and `upload-backup` with a file body, both for the owner and admins. | Recorded; the decision stays the owner's. |
| Non-blocking 2, exit 3's advice | `SKILL.md:79` now separates a read from a write, and its "a write may have run" is the right hedge. SK2 holds it. | Fixed. |
| Non-blocking 3, the route guard | `underPrefix` (`clients/cli/src/operations.js:132-138`) refuses dot segments, `%2e`, backslashes and `//`, and any route a URL parser would change. That last check also catches a tab or newline, which the parser drops. K11 covers `..` and `%2e%2e`, and fails on `a3cb39f1e`. | Fixed. |
| Non-blocking 4, tables vs code | Not taken. The code and the tables still match: 6 first words and 7 variables. | Still non-blocking (non-blocking 2 below). |
| Non-blocking 5, the signer's kill | The timeout now kills the signer's process group (`identity.js:178`). But to get one, the signer is spawned `detached` (`:169-170`), and that does more. | **A regression: R2-B1.** |
| Non-blocking 6, the Node check | `main.js:176-177` also tests `Headers.prototype.getSetCookie`, and names the Node it found. | Fixed. |
| Non-blocking 7, the `local` role | `SKILL.md:56`, held by SK2. The new sentence holds: a direct-local caller's `pubkey` is null (`src/operations/http.js:21`), so the instance can't tell who called, whatever sign-in the CLI made. | Fixed. |
| Friction 1 | `ledger/2026-11-08-evidence-before-commit-misses-tree-suites.md` | Filed; its claims hold. |
| Friction 2 | OPEN.md row 294, the added case | Filed; accurate. |
| Friction 3 | `ledger/2026-11-08-parallel-stories-clash-in-shared-files.md` | Filed; its claims hold. Both branches change `http.js` and `openapi.js`, and A10.2 changes the five files it names. |

**Also re-derived, new this round:**
- **The rerun live check (story `:188-199`).** `live-check3.txt` bears out every claim, including the nginx counts, which are that run's alone: a fresh instance, 2 sign-ins, 2 refusals of the list, then 3 lists and 1 status. The install it ran from is identical to the tip's `clients/cli`, which hasn't changed since `c179e7e49`. `scratch-up3.txt` records the removal: "0 scratch containers left".
- **The corrected line (story `:192`, `eebdeb882`).** It fits the record and the script.
  - `scratch-up2.txt` shows the bring-up's ERR trap firing during the firmware install, and the try ended with exit 137 (128 + SIGKILL, which a `docker exec` gets when its container is removed).
  - On "already exists", `up` removes nothing: it exits at `scripts/scratch-stack.sh:61-64`, before setting its trap at `:67`. But `down` removes by the fixed names (`:26-28`, `:34-38`), so a caller that runs `down` after a failed `up` removes whichever instance holds the name.
  - The attribution to the A10.2 session rests on its message, which I can't check. Exit 137 is also what a memory kill gives, so the record alone can't tell the two causes apart.
  - "The shared containers stayed up" isn't in the record.
- **The scratch-stack ledger row (`801d6a9c0`).** Its claims about the script hold, at the lines above, and the script is unchanged on this branch and on A10.2's (`d118662c4`). Its time, 23:02:43Z, matches the failed try's files, written at 18:02 local. This session's scratchpad holds no wrapper script, so "both sessions fixed their own scratchpad wrappers" is beyond what I can check.

## Findings

### Blocking

1. **R2-B1. `clients/cli/src/identity.js:167-170` (with `:178`): the signer now runs in a new session, which takes its terminal away and lets it outlive a Ctrl-C.**
   - **The cause.** On POSIX, Node's `detached: true` makes the child "the leader of a new process group and session", not just a new group.
   - **The terminal.** Under a pseudo-terminal, a stand-in signer spawned as round 1 spawned it can open `/dev/tty` (`tty-ok`). Spawned as round 2 does, it can't (`no-tty`). Its stdin and stdout are the CLI's pipes, so `/dev/tty` is the only way a signer can ask its person for anything, a passphrase for an encrypted key, say. Such a signer now fails, and the sign-in with it. Yet AC4 takes "a signer of the agent's own" however the agent keeps its key, and ADR Decision 3 (`:133`) gives the signer 180 seconds so that its person can answer.
   - **Ctrl-C.** A stand-in signer (`sh -c 'sleep …'`) spawned as round 1 did died with its parent when a Ctrl-C came through the terminal: none were left. Spawned as round 2 does, both of its processes kept running. I removed them.
   - **Why the probe applies.** The CLI has no signal handler, so the real CLI behaves the same way. A person's Ctrl-C, or a harness that kills the CLI's process group on its own timeout, now leaves the signer running: waiting on a bunker, say. That is the orphan the change set out to remove, and it now removes it only after 180 seconds.
   - **Whose suggestion.** This change was my suggestion: round 1, non-blocking 5, "spawn it detached and kill the group". Re-derived, it was wrong, and I withdraw it.
   - **Asked change.**
     - Spawn the signer in the CLI's own session again (no `detached`), and keep the timeout's kill of the shell, as in round 1.
     - Record the trade-off in the Deviations: a program the command started can outlive the 180-second timeout.
     - Correct the two lines that now say otherwise: the story's Deviation (`:148`) and the test plan's "Not covered" line (`:117`).
     - Optionally, the Tester can hold this with a test: a fake signer that prints its own process group, which must be the CLI's. Otherwise, a check under a pseudo-terminal, recorded in the Evidence, is enough.

### Non-blocking

1. **`clients/cli/src/main.js:139` still reads a 403 by its status alone.** A declared 403 would be reported as "neither its owner nor an admin". This is round 1's optional half of B2, still open, and now the only place left that reads a refusal by its status.
2. **The tables still aren't held to the code** (round 1's non-blocking 4). They match today.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **Two suites that call themselves stack-free can't run where `localhost:7778` is another instance.**
   - `ledger-row-ids` says "No stack, no network" (`test/ledger-row-ids.test.js:14`). But its digest run (`:111`), and `rollup-scanners`' `runDigest` (`test/rollup-scanners.test.js:194`, through `test/helpers/rollupFixtures.js:43-46`), run `scripts/session-start.sh`.
   - That script's stack probe GETs `http://localhost:7778/api/concept-graph/summaries` (`:41-47`). On this machine that is the private instance.
   - The fixtures already stub `gh` for `whats-open.sh` (`rollupFixtures.js:28-34`); the digest gets no such stub.
   - Candidate: a variable that skips the probe, set by both fixtures.
   - New: rows 56 and 203 are about the probe's accuracy, not this.

## On PASS (same commit)
- [ ] Not applicable: the round-2 verdict is CHANGES_REQUESTED.
  - The story's `**Status:**` stays `Approved`, and no completion detection was run.
  - Round 3: the Implementer changes the spawn back and corrects the two lines; the Tester adds the process-group test, if chosen. Then this review runs again.
  - The launching task asked for this file only, so this session commits nothing.

## Verdict (round 2)
**CHANGES_REQUESTED**

---

# Round 3

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-08
**Diff:** `git diff 1d8d6218b..b55a8a1b1`, attributed commit by commit:
- `b20ec9cc5`: the Tester's round. It adds I16 (the signer's process group: the fake signer now records its own) and K12 (a read that declares its own 403), with their test-plan rows and the corrected "Not covered" line. It touches no `clients/` or `src/`.
- `03a63dede`: the fix. The signer is spawned without `detached` again (`identity.js`), and a new `isNotAllowed` (`signin.js`) now decides the 403 note (`main.js`). The story's two Deviations are rewritten. It touches no `test/`.
- `d6a5d9c77`: round 2's harness-friction item, as a dated note on the existing row `ledger/2026-11-05-suite-probe-reaches-private-container.md`.
- `b55a8a1b1`: the story's Evidence: the suite table at `d6a5d9c77`, and the three suites that weren't run here.

**In short.** R2-B1 is fixed, and so is round 2's non-blocking 1. Both hold when re-derived through the committed code. One blocking issue is left, and it is about the record, not the code. The story's Evidence says the reviewer didn't run `session-start` at round 2. I did, and that run reached this Mac's private instance through the digest's stack probe. The mistake was in my round-2 screening, which round 2 didn't notice and this round discloses.

## Correction to round 2 (my own)

- **What round 2 ran.** Round 2 ran `session-start` (32/0/0) as a safe suite. It isn't one.
  - `test/session-start.test.js` imports the digest runner under the name `digest` (`:33`, from `test/helpers/rollupFixtures.js:43-46`) and calls it from 18 tests (`:126` to `:439`). The one at `:189` sits in a loop of three, so the suite runs the digest 20 times.
  - Each run executes `scripts/session-start.sh`. Its stack probe GETs `http://localhost:7778/api/concept-graph/summaries` (`:41-47`, with `-m 2` and `-o /dev/null`).
  - So round 2's run sent up to 20 of those GETs to the private instance. They only read. Whether the instance answered, I can't tell.
- **How the screen missed it.** I grepped the suite for its script constant and for `runDigest`, and missed the alias.
- **What round 2 got wrong as a result.** Its friction item named two suites in this class; there are three. Its "New" was wrong too: the row `2026-11-05-suite-probe-reaches-private-container` is the class's home, as this round's ledger commit found.
- **This round** ran none of the three.

## Quality gates (run by reviewer, not trusted)

- [ ] **`npm test`: not run,** for round 1's reason. `npm run gate:status` still has no run record.
- [x] **Suites run one by one** through their `run()` exports, on Node 24.18.0 at `b55a8a1b1`. Nothing was uncommitted but the `node_modules` link, and every service endpoint was dead. Each suite was screened together with the helpers it loads:
  - `ledgerFixtures` only builds text;
  - `gateFixtures` runs the gate engine over fixture suites, with a stub `docker`;
  - `openapiNormalizeRoutes` runs nothing.

  None of them runs the digest or a live call.

  | Suite | Result |
  |---|---|
  | `external-cli` | 53/0/0 (with I16 and K12) |
  | `operations` | 48/0/0 |
  | `openapi-coverage` | 13/0/0 |
  | `openapi-document` | 10/0/0 |
  | `admin-action-sweep` | 9/0/0 |
  | `admin-action-sweep-access` | 13/0/0 |
  | `default-deny-mutations` | 14/0/0 |
  | `stack-free-npm-test` | 6/0/1 |
  | `brains-launcher-repo` | 31/0/0 |
  | `harness-lint` | 85/0/0 |
  | `harness-stats` | 12/0/0 |
  | **Total** | **294/0/1** |

  This is the same as the Evidence's table, which was taken at `d6a5d9c77`. Only the story has changed since then.
- [x] **Not run:** `session-start`, `ledger-row-ids` and `rollup-scanners`, because all three run the digest. I checked their real-tree claims by hand instead:
  - `bash scripts/harness-lint.sh`: clean, 0 violations;
  - `collect_meta`: exits 0, and lists the noted row;
  - its 244 lines: none is invalid UTF-8.
- [x] **Red before green.** On an export of `b20ec9cc5`, `external-cli` gives 51/2, for the right reasons:
  - I16 fails because the signer led its own process group;
  - K12 fails because stderr called the key neither owner nor admin.

  Phase 4 left `test/` alone: `git diff b20ec9cc5..HEAD -- test/` is empty.
- [x] **Probes through the committed signer path,** `identity.resolveIdentity({ env: { TAPESTRY_SIGNER, … } }).sign()`.
  - Under a pseudo-terminal: the signer opens `/dev/tty` (`tty-ok`), and a Ctrl-C leaves no signer behind (0 left).
  - Then SIGKILL to the signer's shell, which is what the timeout does:
    - a simple command (`sleep …`) is killed (0 left);
    - a foreground program in a compound command (`sleep …; :`) survives (1 left);
    - a pipeline member (`sleep … | cat`) survives (1 left).

  I removed what they left.
- [ ] `npm run test:playwright`: not applicable (no UI).
- [ ] _Lint, typecheck and build not configured — skipped._

## Round 2's findings, each re-derived as a fresh claim

| Finding | Re-derived by | Result |
|---|---|---|
| R2-B1, the signer's session | `identity.js:170` spawns the signer without `detached`, and the timeout kills the shell (`:178`). The probes give `tty-ok`, and nothing left after a Ctrl-C. I16 holds it: the fake signer's process group must be the test's. The CLI is spawned without `detached` too, so that puts the signer in the CLI's session and its foreground group, the two things R2-B1 lost. I16 fails on `b20ec9cc5`. The command it uses, `ps -o pgid= -p`, works on macOS and on CI's Linux. | Fixed. The trade's wording is narrower than the behavior (non-blocking 1). |
| Round 2's non-blocking 1, a declared 403 | `isNotAllowed` (`clients/cli/src/signin.js:57-59`) takes a 403 with no `code`, or with `not-allowed`. That separates the cases exactly: the central check's 403 has no `code` (`src/middleware/auth.js:329-331`), and the router's is `not-allowed` (`src/operations/http.js:38`), a built-in code (`src/operations/declaration.js:37`) that no declaration may use (`:116`). `main.js:139` uses it. K12 holds it, and fails on `b20ec9cc5`. The list's 403 (`operations.js:32`) still reads the status alone, which is right: the list route has no declared refusals. | Fixed. |
| Round 2's non-blocking 2, tables vs code | Not taken. The tables and the code still match: 6 first words and 7 variables. | Still non-blocking (non-blocking 2 below). |
| Round 2's friction 1 | A note on `ledger/2026-11-05-suite-probe-reaches-private-container.md` (`:22-31`), a better home than the new row I proposed. Its references hold: `ledger-row-ids.test.js:14` and `:28`, `rollupFixtures.js:4-6`, `session-start.sh:41-47`. But it names two suites, and says "That review skipped both suites". The class has a third, `session-start.test.js`, which round 2 ran (B-R3-1). | Filed, but incomplete. |

**Also re-derived, new this round:**
- **The story's two new Deviations.** The 403 one (`:149`) holds. The signer one (`:148`) holds except for its last sentence (non-blocking 1).
- **The Evidence (`:163-187`).** The table holds at the tip (above). I can't check "They last ran at `d6a5d9c77`", but my run at the tip, where nothing those suites read differs, gives the same counts. Line `:187` doesn't hold (B-R3-1).
- **The test plan.** Its new rows (`:19`, `:49` K12, `:56` I16) match the tests. Line `:120` carries the same narrow wording of the trade.

## Findings

### Blocking

1. **B-R3-1. `engineering-team/stories/graph-operations-foundation/6-external-cli-and-agent-skill.md:187` and `ledger/2026-11-05-suite-probe-reaches-private-container.md:22-30`: the record of what reached the private instance is wrong.**
   - **The story.** Line `:187` says the three digest suites "weren't run, here or by the reviewer at round 2". But the reviewer ran `session-start` at round 2 (round 2's gates table: 32/0/0). That run reached `localhost:7778` up to 20 times through the digest's probe, as the correction above explains.
   - **The ledger note.** It names two suites (`:25-26`) and says "That review skipped both suites" (`:30`). That's true of those two. But `session-start.test.js` runs the digest too, from 18 tests through `digest(...)` (`:33`). The note's own source says so: the header of `rollupFixtures.js` (`:4-6`) calls its digest runner "Shared by test/session-start.test.js and test/rollup-scanners.test.js". A fix made from the note as written would leave that suite out.
   - **Why it blocks.** This is the record that tells the owner, and the next session on this Mac, whether this story's work reached someone's private instance. As written, it says no. It did, once, read-only.
   - **Asked change.**
     - Correct story `:187`: the round-2 review ran `session-start`, and so sent the probe to `localhost:7778`, and none of the three suites has run here since.
     - Add `session-start.test.js` to the ledger note, with its digest calls and the round-2 run.
     - Optionally, a line in the note on how a grep screen of the suite missed it (an aliased import). That would support the row's fix shape: a probe URL the runner can point at a dead port makes the screen unnecessary.

### Non-blocking

1. **`clients/cli/src/identity.js:167-169`, story `:148` and test plan `:120`: the signer's trade is wider than "a program the signer starts in the background".**
   - SIGKILL to the shell, which is the timeout's kill, ends the shell. The only program it ends with it is a simple command that the shell runs in its own place. Under the probe:
     - `sleep …`: 0 left;
     - `sleep …; :` (a foreground program): 1 left;
     - `sleep … | cat`: 1 left.
   - So the test plan's "A signer that hangs past its 180 seconds is killed" holds only for a simple command.
   - My round-2 wording ("a program the command started can outlive the 180-second timeout") was accurate. The added "in the background" narrows it.
   - Suggested: "The timeout ends the shell, and so a signer that the shell runs as a simple command. Any other program the command starts, in the foreground or the background, may outlive it."
2. **The tables still aren't held to the code** (round 1's non-blocking 4). They match today.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **A grep screen of a suite file can't see what the suite runs.**
   - The screening rule this review followed is to grep the suite for `docker exec`, `TAPESTRY_PORT` and `:7778`. In round 2 it found nothing in `session-start.test.js`, because the call sits in a script the suite runs, through a helper imported under another name.
   - The row's fix shape would make screening unnecessary: a probe URL the runner can point at a dead port, or a stub `curl`.
   - Not a new row: add it to the note that B-R3-1 corrects.

## On PASS (same commit)
- [ ] Not applicable: the round-3 verdict is CHANGES_REQUESTED.
  - The story's `**Status:**` stays `Approved`, and no completion detection was run.
  - Round 4: the Implementer corrects story `:187` and the ledger note, and, if taken, the trade's wording in its three places. No code or test change is asked, so round 4 can re-derive the corrected lines and re-run `harness-lint` and `harness-stats`, the suites that read them.
  - The launching task asked for this file only, so this session commits nothing.

## Verdict (round 3)
**CHANGES_REQUESTED**

---

# Round 4

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-08
**Diff:** `git diff 93ea9d97c..77d6a442a`, attributed commit by commit:
- `ec5839143`: the Tester's line. The test plan's "Not covered" line (`:120`) restates the trade of the signer's timeout. It touches no code and no suite.
- `48b8d2ecf`: B-R3-1's story fix, the Evidence passage (`:187-191`). It also rewords the trade in the story's Deviation (`:148`) and in the comment in `identity.js` (`:167-170`). That comment is the only code change.
- `77d6a442a`: the ledger note on `2026-11-05-suite-probe-reaches-private-container` now names `session-start.test.js`, with round 2's run and the lesson about the renamed helper.

**In short.** B-R3-1 is fixed. The story and the ledger now say that round 2's run of `session-start` sent up to 20 read-only probes to `localhost:7778`, and that none of the three digest suites has run here since. Nothing blocking is left. The trade's new wording is better, but it is still a list, and it misses two cases (non-blocking 1).

## Quality gates (run by reviewer, not trusted)

- [ ] **`npm test`: not run,** for round 1's reason. `npm run gate:status` still has no run record. CI's run on the pull request will be the first full gate of this code.
- [x] **Suites run one by one** through their `run()` exports, on Node 24.18.0 at `77d6a442a`. Nothing was uncommitted but the `node_modules` link, every service endpoint was dead, and each suite was screened with the helpers it loads, as in round 3:

  | Suite | Result |
  |---|---|
  | `external-cli` | 53/0/0 |
  | `operations` | 48/0/0 |
  | `openapi-coverage` | 13/0/0 |
  | `openapi-document` | 10/0/0 |
  | `admin-action-sweep` | 9/0/0 |
  | `admin-action-sweep-access` | 13/0/0 |
  | `default-deny-mutations` | 14/0/0 |
  | `stack-free-npm-test` | 6/0/1 |
  | `brains-launcher-repo` | 31/0/0 |
  | `harness-lint` | 85/0/0 |
  | `harness-stats` | 12/0/0 |
  | **Total** | **294/0/1** |

  The Implementer ran two of these at the same commit (`external-cli` 53/0/0 and `harness-lint` 85/0/0), and both agree.
- [x] **Not run:** `session-start`, `ledger-row-ids` and `rollup-scanners`. I checked their real-tree claims by hand:
  - `bash scripts/harness-lint.sh`: clean, 0 violations, before this round's verdict was added;
  - `collect_meta`: exits 0, and lists the changed row (meta, OPEN);
  - its 244 lines: none is invalid UTF-8.

  All three are registered (`test/registry.js:156-158`), so CI runs them.
- [x] **A probe of the timeout's kill:** SIGKILL to the signer's shell, as `identity.js:179` sends it, for the kinds of command the new wording names and two it doesn't.
  - Named: a simple command, 0 left; a list joined by `&&`, 1 left; a list joined by `;`, 1 left; a pipeline, 1 left.
  - Not named: a background program (`sleep … & wait`), 1 left; a simple command's own child (`sh -c "sleep …; :"`), 1 left.

  I removed what it left.
- [ ] `npm run test:playwright`: not applicable (no UI).
- [ ] _Lint, typecheck and build not configured — skipped._

## Round 3's findings, each re-derived as a fresh claim

| Finding | Re-derived by | Result |
|---|---|---|
| B-R3-1, the story | Story `:187-191`, claim by claim. Three suites run `scripts/session-start.sh`, and each does (`ledger-row-ids.test.js:28` and `:111`; `rollup-scanners.test.js:194`; `session-start.test.js:33`). Round 2's review ran `session-start` (round 2's gates table: 32/0/0). That was about 20 runs, through a helper imported as `digest`: 18 tests, one of them in a loop of three. So up to 20 read-only probes, each discarding its answer (`-o /dev/null`). "None of the three has run on this machine since" holds for this story's work: I didn't run them at rounds 3 or 4, and no Implementer table lists them. CI runs them (`test/registry.js:156-158`). | Fixed. |
| B-R3-1, the ledger note | `ledger/2026-11-05-suite-probe-reaches-private-container.md:22-38` names three suites, `session-start.test.js` among them (`:27-31`), with round 2's run and the lesson about the renamed helper. "Skipped the first two at round 2, and all three from round 3 on" (`:35`) holds. Its account of why the screen missed the suite also holds in substance: the file names the script "only in comments and a structure check" (`:29`). In fact it names it in a comment (`:7`), a constant (`:37`) and two structural tests (`:97-104`, `:134-136`), and never in a run. | Fixed. It counts one structure check where there are two, which is immaterial. |
| Round 3's non-blocking 1, the trade's wording | `identity.js:169-170`, story `:148` and test plan `:120` now say that the timeout ends the shell, that a simple command ends with it, and that "the programs of a pipeline, or of a list joined by `;` or `&&`, may outlive it". The probe bears out each case the wording names. But the wording is a list, and two cases are missing from it: a background program, which the old wording named (1 left), and the programs a simple command starts itself (1 left), as a wrapper script that runs `nak` would. | Improved, still incomplete (non-blocking 1). |
| Round 3's non-blocking 2, tables vs code | Not taken. They still match: 6 first words and 7 variables. | Still non-blocking (non-blocking 2). |
| Round 3's friction 1 | In the ledger note (`:28-31`). | Filed. |

## Findings

### Blocking
None.

### Non-blocking
1. **`clients/cli/src/identity.js:169-170`, story `:148` and test plan `:120`: the trade is still a list, and it misses two cases.**
   - A background program (`… &`) and any program a simple command starts itself (a wrapper script's `nak`, say) also outlive the kill, as the probe above shows.
   - Suggested, as one rule: "The timeout kills only the signer's shell, and so a simple command that the shell runs in its own place. Any other program the command starts, or that its programs start, may outlive it."
   - My round-3 sentence said much the same. Re-derived, it holds for all six cases.
2. **The tables still aren't held to the code** (round 1's non-blocking 4). They match today.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*
1. None new.

## On PASS (same commit)
- [ ] **Story `**Status:**` flipped to `Done` in place.** Not done here: the launching task asked for this file only. Whoever commits this review sets it, in the same commit (workflow 5). Until then, `harness-lint` reports L1 for the story, since this review is now PASS-final.
- [x] **Completion detection performed.** Its result is in the chat, not in this file.

## Verdict (round 4)
**PASS**
