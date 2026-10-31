# Review: Story 10 — Sourcing the config file never puts its contents in a log

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-31 (round 1: CHANGES_REQUESTED; round 2, same day: PASS)
**Diff:** `git diff origin/staging..HEAD` (base `6d3bb659`; story `a788b4f5`, failing tests `fa069442`, fix `a6b73119`),
plus round 2's docs edits to the story, the epic, the book and `stories/_intake.md`, which land in the review commit.
The code is unchanged since round 1, at `a6b73119`.
**Story:** `stories/security-auth-exposure/10-config-source-stderr-no-values.md` (Bug, Standard; no ADR)
**Test plan:** `stories/security-auth-exposure/10-config-source-stderr-no-values.test-plan.md`
**Book:** `audits/config-secret-logging/book.md`

## Quality gates (run by reviewer, not trusted, unless marked as the session's)

- [ ] `npm test`: **not run, on purpose.** On this Mac a full `npm test` publishes fixtures to public relays (memory
      *full-npm-test-leaks-fixtures*), so there is no `npm run gate:status` line to quote. In its place, single
      stack-free suites were run through their `run()` export.
  - **On the host, by the reviewer, at `a6b73119`:**
    - `config-source-stderr`: 4 passed, 0 failed.
    - `config-secret-logging` (story 9, AC-5): 5 passed, 0 failed.
    - `graperank-shared-csv-race`: 13 passed, 0 failed.
    - `neo4j-sizing-override`: 9 passed, 0 failed.
  - **In a throwaway scratch container, run and reported by the session (not re-run by the reviewer, who was told to
    stay off Docker):** image `agent-memory-tapestry`, this branch's `src/` mounted, `test/` and `lib/` copied in at
    `a6b73119`.
    - `config-source-stderr`: 4/0. This includes AC-1's child process under the image's Debian bash.
    - `config-secret-logging`: 5/0.
    - `harden-user-data-error-path` 2/0, `my-assistant-page` 31/0, `shell-input-hardening` 6/0,
      `bullboard-admin-access` 9/0, `tagging-edges-state-routes` 62/0, `tagging-edges-wiring` 86/0. These six load
      `src/utils/config.js` with dependencies the host checkout lacks, so they could only run there.
    - `graperank-shared-csv-race`: 13/0.
    - `neo4j-sizing-override`: 8/1. The failure is S2, which reads `../docker-compose.yml`
      (`test/neo4j-sizing-override.test.js:24`, `:131-132`). That file is at the repo root, which wasn't copied into
      the image. So the failure is environmental, and the suite is 9/0 on the host (above).
    - The scratch app's startup log (925 lines) names `NEO4J_PASSWORD` and `SESSION_SECRET` only as
      `Found <KEY> (quoted)`. The real values occur 0 times, in 0 files under `/var/log`. The instance has been
      removed.
- [x] **The tests fail on the code before the fix.** In a throwaway `git worktree` at `fa069442` (tests in, fix not),
      `config-source-stderr` gave **0 passed, 4 failed**, the same failures the test plan's Verification section
      records. The worktree was removed.
- [x] **AC-1's child process does capture inherited stderr.** A mutation in that worktree changed only the `catch` in
      `src/utils/config.js` to log `.status`, and left bash's stderr inherited. AC-1 still failed: the value reached
      the output through bash's own stderr. AC-3 passed.
- [x] `node --check` passes on all five changed readers, the new suite and `test/registry.js`. The suite is registered
      once, after story 9's (`test/registry.js:293`).
- [ ] `npm run test:playwright`: not applicable (no UI).
- [ ] _Lint not configured — skipped._ `bash scripts/harness-lint.sh | tail -1` → `harness-lint: clean (0 violations)`
      (round 1).
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence
- [x] Every acceptance criterion has a passing test (AC-1, AC-3 behavioural; AC-2, AC-3, AC-4 source-level; AC-5 by
      story 9's suite, 5/5).
- [x] No criterion is silently dropped.
- [x] No behaviour added that isn't in the story.
- [x] **The story's inventory of affected readers is accurate.** Round 1 found it wasn't. Round 2 narrows it; see
      blocking finding 1 (resolved).

### Are the source-level checks sound?

Yes, for the five files they cover, and they are hard to pass vacuously:

- `sourceCalls()` takes every `execSync(` call, finds its closing parenthesis by counting brackets, and keeps calls
  whose text contains the word `source`. It then requires **exactly one** such call per file
  (`test/config-source-stderr.test.js:115`). Deleting or renaming the call fails the test rather than passing it.
- The `stdio` regex is checked against the call's own text, so an option elsewhere in the file can't satisfy it.
- The catch check flags every use of the error variable that isn't `<name>.status`: `.message`, `.stderr`, the bare
  variable, `String(err)`, destructuring and bracket access all count. A `.` before the name is excluded, so
  `console.error` with a variable named `error` is not a false hit. It also requires `.status` to appear (AC-3).
- AC-4 (`:133`) is the weakest: it catches only the three variable names used today (`result`, `defaultValue`,
  `process.env[varName]`). A future log with `${value}` would get through. That is enough for the current code
  (non-blocking finding 3).

The check covers only the fixed list in `READERS` (`:66`), not the rest of the repo. That's why it didn't flag the
GrapeRank scripts. The intake entry now proposes widening it to a scan.

### Does `stdio: ['ignore', 'pipe', 'ignore']` change behaviour that matters?

- **Return values: no.** stdout is still piped and returned. Readers with `encoding: 'utf8'` keep it, and the
  `.toString()` callers still get a Buffer to convert.
- **Exit paths: no.** `execSync` still throws on a non-zero status. `initializeScorecards.js:41` still exits 1,
  `publish_nip85_30382.js` and `lib/config.js` still return `null`, `addToQueue.mjs` still falls through to the
  environment, and `getConfigFromFile()` still returns the default. stdin was never read, so `ignore` on stdin doesn't
  matter.
- **Operator visibility: a little less, and on purpose.** A *fatal* conf error now logs the key and the exit status
  (AC-3) but not the line number or the text. That's the trade the story chose. A *non-fatal* bad line is now silent.
  A probe with the line `B=pw TAILY` placed before the key being looked up showed the old code printing
  `line 3: TAILY: command not found`, half of the value, while the lookup succeeded. The new code prints nothing. So
  the change also closes a second, partial leak, but an operator no longer sees that kind of line (non-blocking
  finding 2; the intake entry now records this case).

## ADR adherence
- [x] No ADR. Architecture was skipped, and the five patches match the story's Approach exactly.
- [x] No new modules or dependencies.

## Concept-graph integrity
- [x] Not touched: no handles, concept definitions or firmware. Nothing to reinstall.

## Things tests can't catch
- [x] No secrets in committed files. The diff has no 64-hex strings and no `nsec`.
- [x] No leftover debug logging. The new comments explain *why* `.message` is avoided, which is worth keeping.
- [x] No commented-out code.
- [x] Error paths are kept. See the `stdio` section above.
- [x] Concurrency: not applicable.
- [x] The rest of the class (the GrapeRank `.js` scripts and the shell scripts) is recorded as out of scope and
      queued in `stories/_intake.md`. It is no longer claimed fixed.

## House rules check
- [x] Concept Graph API authority: not applicable.
- [x] No new lint, typecheck or build tooling.
- [x] No hard-coded TA pubkey.

## Findings

### Blocking

1. **RESOLVED in round 2.** *Round 1:* the story said "Five readers in the JavaScript code do this", the epic said
   "five JavaScript readers", and the book bullet said "**No** JavaScript reader that sources the config file lets
   bash's stderr … into a log". In fact 11 more `.js` files make 27 more `execSync` calls that source
   `/etc/brainstorm.conf` with stderr inherited and `error.message` logged. Found with
   `git grep -nE "[\"'\`(]\s*(bash -c [\"'])?source " -- 'src/*.js' 'src/*.mjs' 'src/*.cjs' 'src/*.ts' lib bin`,
   with non-config hits removed by hand, then a count of the brainstorm.conf calls per file and `grep -c stdio` on
   each file (0 in every one).

   | File | Calls on brainstorm.conf | Caller found |
   |---|---|---|
   | `src/algos/personalizedGrapeRank/updateNeo4j.js` | 3 (incl. `NEO4J_PASSWORD`) | `updateNeo4j.sh:28` |
   | `src/algos/personalizedGrapeRank/initializeRatings.js` | 1 | `initializeRatings.sh:23` |
   | `src/algos/personalizedGrapeRank/calculateGrapeRank.js` | 1 | `calculateGrapeRank.sh:23` |
   | `src/algos/customers/personalizedGrapeRank/initializeScorecards.js` | 4 (incl. `NEO4J_PASSWORD`) | `personalizedGrapeRank.sh:188` |
   | `src/algos/customers/personalizedGrapeRank/updateNeo4jWithApoc.js` | 3 | `personalizedGrapeRank.sh:290` |
   | `src/algos/customers/personalizedGrapeRank/interpretRatings.js` | 1 | `personalizedGrapeRank.sh:134` |
   | `src/algos/customers/personalizedGrapeRank/calculateGrapeRank.js` | 1 | `personalizedGrapeRank.sh:239` |
   | `src/algos/customers/personalizedGrapeRank/updateNeo4j.js` | 3 | **none found** |
   | `src/algos/importedGrapeRankEngine/calculateFromLibrary.js` (compiled from `.ts`) | 4 | `calculateFromLibrary.sh:6`, `calculatePersonalizedGrapeRank.sh:58` |
   | `src/algos/customers/personalizedGrapeRank/updateNeo4j_copy.js`, `updateNeo4jWithApoc_moreLogsButWithBug.js` | 3 + 3 | dead copies |

   *Round 2 (the owner chose option (a), narrow the record), checked against the working tree:*
   - **Story** `10-config-source-stderr-no-values.md:27-29`: the Background now scopes the fix to "the five shared or
     standalone readers below" and records the 11 files and 27 calls. *Out of scope* (`:80-90`) lists the same 11
     files, including `calculateFromLibrary.js`, and points to the intake entry. The shell-script bullet says it's
     queued. The file list matches the table above exactly.
   - **Epic** `security-auth-exposure.md:36`: names the five readers and says the GrapeRank scripts and the shell
     scripts are queued.
   - **Book** `config-secret-logging/book.md:20-24`: the bullet now names the five readers and says the rest are queued
     and not part of this book. The five patches meet it as worded.
   - **Intake** `stories/_intake.md:2973`: a new entry lists the same 11 files and the shell scripts, sketches the fix
     (`bash -n` at entrypoint render, patch the 11, widen AC-2's scan), and records the `B=pw TAILY` case.
   - **No remaining wording says all JavaScript readers are fixed.** I grepped the story, the test plan, the epic, the
     book and the test file for "every/all/no/any JavaScript", "javascript reader" and "five". Every hit is now
     scoped to the five. Background item 1's "Several JavaScript readers" is accurate. The title and the user-facing
     sentence are broader; see non-blocking finding 6.

### Non-blocking

1. **The patched `initializeScorecards.js` still leaks through its wrapper.**
   `src/algos/personalizedGrapeRank/initializeScorecards.sh:7` runs `source /etc/brainstorm.conf` before it starts the
   node script, so a malformed line reaches that script's log once, through the shell. The patch takes it from three
   copies to one. This is covered by the shell-script item now queued in intake.
2. **A non-fatal bad conf line is now invisible.** With stderr ignored, a line like `B=pw TAILY`, which bash runs as a
   command and which doesn't fail the `source`, no longer shows up anywhere, and the lookup succeeds. Before, its
   stderr printed part of the value, so this is a net security gain. Recorded in the intake entry.
3. **`test/config-source-stderr.test.js:133`. AC-4's leak pattern lists only today's variable names.** Optional: flag
   any `${…}` other than `${varName}` in the reader's log lines.
4. **`src/utils/config.js:64` and the other four catches log `status ${…status}`.** When the child is killed by a
   signal, `status` is `null`, so the log says `status null`. Optional: log `.signal` as well.
5. **`test/config-source-stderr.test.js:74`. `mkdtempSync` runs when the module loads, and cleanup runs only in
   `run()`.** This is the same nit as story 9's finding 3. No temp directory was left behind in these runs.
6. **Round-2 wording, to fix when the intake entry is promoted (none of it overstates what's fixed):**
   - **(a) "Nine are live"** (story `:82`, intake entry). This came from my own round-1 report, and it's wrong for
     one file: no caller is found anywhere in the repo for `src/algos/customers/personalizedGrapeRank/updateNeo4j.js`.
     `git grep "updateNeo4j.js"` finds only the owner-scoped `personalizedGrapeRank/updateNeo4j.sh:28`, which calls
     `src/algos/personalizedGrapeRank/updateNeo4j.js`. So eight have callers, one has none, and two are dead copies.
     It overcounts what is live, which is the safe direction.
   - **(b) "Their shell wrappers already `source` the conf themselves"** (story `:88-89`). This holds for
     `initializeRatings.sh`, `calculateGrapeRank.sh`, `updateNeo4j.sh`, `personalizedGrapeRank.sh` and
     `calculatePersonalizedGrapeRank.sh:3`. It does not hold for `calculateFromLibrary.sh`, which runs only `tsc` and
     `node`. For that path, patching the JavaScript would close the leak completely.
   - **(c) "Stories 9 and 10 closed this for the five"** (intake entry). Story 9 closed value logging in
     `getConfigFromFile()`, not the stderr path. Story 10 alone closes stderr for the five.
   - **(d) The title** ("Sourcing the config file never puts its contents in a log") and the user-facing sentence
     are broader than the narrowed scope. Their commits are already made, and the Background and *Out of scope*
     scope them now. Leave them.

   *(a)–(c) fixed by the session before the review commit, 2026-10-31: the story and the intake entry now say eight
   are live and one has no caller, that most wrappers source the conf but `calculateFromLibrary.sh` doesn't, and that
   story 10 closed the stderr path. The session confirmed (a) and (b) with `git grep` and by reading
   `calculateFromLibrary.sh`.)*

### Harness friction
1. None new. The rule against a full `npm test` on this Mac again leaves the template's `gate:status` box
   unfillable. The substitute evidence is recorded above, as in story 9.

## Verdict
**PASS**

Round 1 was CHANGES_REQUESTED on blocking finding 1 alone: the record claimed a wider fix than the code makes. Round 2
narrows the story, the epic and the book to the five readers, which the code and the tests do cover. It queues the 11
GrapeRank scripts (the same list as the review's table) and the shell scripts in `stories/_intake.md`. The code is
unchanged and sound: 4/4 now, 0/4 on `fa069442`, AC-1 provably captures inherited stderr, and the session's
container run has all six previously pending suites green. The one container failure, `neo4j-sizing-override` S2,
is environmental (9/0 on the host). Non-blocking finding 6 is wording to fix when the intake entry is promoted.

## On PASS (same commit)
- [ ] Story `**Status:**` flipped to `Done` in place. *(Left to the session after the operator's gate, as
      instructed.)*
- [ ] Completion detection. *(Left to the session.)* Book arithmetic is for the run journal or the chat, not this
      file.
