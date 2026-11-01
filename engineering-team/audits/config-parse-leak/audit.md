# Build Audit: A config file bash can't parse never reaches a log

**Book:** `engineering-team/audits/config-parse-leak/book.md`
**Date:** 2026-11-01
**Branch / commit range:** `7c17785c..448e5b51` on `fix/config-parse-leak` (book `e43f600a` through the staging-evidence
commit `448e5b51`); merged to `staging` as `04e0d0f1` (ngit and GitHub), deployed by run 41273662458. This close
lands on the same branch.
**Provenance:** Acceptance-frame
**Confidence:** high. The frame was confirmed at kickoff, every bullet has evidence, the story was reviewed PASS by
an independent Reviewer (three rounds), and the change was checked on the staging droplet after deploy.

> The as-built record. It proposes nothing; `prd-seed.md` does that.

## 1. What shipped

- **A container whose rendered conf would be unsafe refuses to start, without printing the value.**
  `tools/render-conf-template.js` now refuses a substituted value containing `"`, `$`, a backtick, `\`, a carriage
  return or a newline (exit 3, `RenderError: <NAME> contains a character the config file can't hold safely …`),
  naming the variable only. So no value can end a quoted string, expand, or run as a command when the ~105 shell
  scripts and the control panel `source` the file. — ADR `security-auth-exposure/0006`
- **The rendered conf is checked with `bash -n` before anything starts.** The new `tools/check-conf-syntax.sh` keeps
  bash's own message (which, for some errors, holds the whole offending line) in a variable it never prints, and
  reports only `… is not valid bash near line N`. `docker/entrypoint.sh` runs it after the render and stops on
  failure, before `supervisord`. — story `security-auth-exposure` #11, AC-1
- **The remaining JavaScript readers keep bash's stderr out of the log.** Nine GrapeRank `.js` files and
  `calculateFromLibrary.ts` (plus its committed, hand-patched `.js`) pass `stdio: ['ignore', 'pipe', 'ignore']` on
  every call that runs `source` (21 on `brainstorm.conf`, 6 on `graperank.conf`) and log a failed lookup's keys and
  exit status. Two lookups in the `.ts` that had no `try` got their own catch, since their errors reached a
  `main().catch` that printed the whole error. The two dead copies are deleted. — story 11, AC-3
- **A scan replaces story 10's fixed list.** `test/config-parse-leak.test.js` (11 tests) walks `src/`, `lib/` and
  `bin/` for every exec-family call whose command runs `source`, including the compiled
  `(0, child_process_1.execSync)("source ".concat(…))` form, and proves it isn't vacuous. — story 11, AC-4
- **Operators are told.** OPERATIONS.md §11 has a new subsection on both refusals, the five characters, and how to
  check a hand edit before writing it into place.

## 2. Epics & stories rolled up

### Epic: `security-auth-exposure`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #11 unparseable-config-never-logged | render-time refusal, startup syntax check, the GrapeRank calls patched, the tree scan | Done | `reviews/security-auth-exposure/11-unparseable-config-never-logged.md` (CHANGES_REQUESTED twice on doc wording, then PASS at round 3) |

## 3. As-built inventory

- **User-facing:** no screen or route changed. Operators see two new ways a start can fail, each naming a variable
  or a line number, and GrapeRank failures now read `lookup of <KEYS> failed (status N)`.
- **Domain:** no concept, handle, schema or firmware change. No reinstall.
- **Data & contracts:** no event kind, API route or stored shape changed. For a well-formed conf every reader returns
  what it did before; exit codes are unchanged.
- **Code:** `tools/render-conf-template.js` (+17), `tools/check-conf-syntax.sh` (new, 29 lines), `docker/entrypoint.sh`
  (+6), nine GrapeRank files and `calculateFromLibrary.ts`/`.js`, and the two deleted copies: 15 files, +216 −687
  (−642 of it the deletions).
- **Diff walk:** all 27 files in `7c17785c..448e5b51` trace to story 11, ADR 0006, its test plan, its review, the
  book, the epic, the intake marker, OPERATIONS.md §11 or the two ledger rows the story's ADR and review called for.
  No undocumented work.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Intake / frame: patch the 11 GrapeRank `.js` files | Also `calculateFromLibrary.ts`, whose wrapper recompiles the `.js` when `tsc` is on `PATH` | added-beyond-scope | Found at Planning (story 11 Background); the image has `tsc` only in `node_modules/.bin` (ADR 0006 Context) | None; closes a path that would have undone the fix | — |
| 2 | ADR 0006: patch the `brainstorm.conf` calls | The six `graperank.conf` calls in the same files too | added-beyond-scope | ADR 0006 Decision: lets the scan use one rule; no secrets there | None | — |
| 3 | ADR 0006 note: keep each "Missing Neo4j connection details" throw and its catch's exit | The throw became a direct `console.error` plus the same exit | changed | So that message still reaches the operator without the catch logging `.message` (commit `d4784665`; review 11, non-blocking 5) | None; exit codes unchanged | — |
| 4 | ADR 0006: regenerate `calculateFromLibrary.js` with the image's `tsc` | Hand-applied the same edits | changed | The committed `.js` came from an older `.ts` and `tsc`; regenerating would rewrite unrelated code. The hand edits equal `tsc`'s own diff (review 11) | None | — |
| 5 | Frame: "a line that parses but runs a command (`B=pw TAILY`)" | Refused only when a value would produce it; a template line of that shape is caught by a test, not at boot | constraint-discovered | ADR 0006 Option C: with the value check, only a reviewed template edit can produce it | None today | — |
| 6 | Frame: the check covers the conf | A hand edit inside a running container isn't checked until the next start re-renders the file | deferred | Story 11 *Out of scope*: a check before every `source` means editing ~105 scripts | A bad hand edit reaches shell-script logs until restart | §6 |
| 7 | Frame bullet 5: staging and production pass the check | Checked; the sandboxes and the agent-memory instance were not | deferred | They follow `main`; review 11, non-blocking 7 | One of them could refuse to start after a `main` promotion | §6 |

**Undocumented work:** none.

## 5. Quality state at close

- **Test gate:** the full `npm test` was **not run**. On the Mac Studio it publishes test fixtures to public relays
  (OPEN.md row `2026-09-27-test-fixture-taggings-on-prod-relays`), so there is no `gate:status` line. Substitute
  evidence, each suite through its `run()` export:
  - **On the host** (bash 5.3), at the fix and at each review round: `config-parse-leak` 11/0,
    `config-source-stderr` 4/0, `config-secret-logging` 5/0, `entrypoint-template-rendering` 11/0,
    `graperank-shared-csv-race` 13/0. The same suites on the merged tree `04e0d0f1` before the push.
  - **Under the image's bash 5.1**, in a throwaway container from `agent-memory-tapestry` with the branch's tree
    copied in: the same five suites, all green.
  - **Before the fix:** 2 passed, 9 failed at `a33ff545` (the two passes are guards), checked by the Reviewer in a
    throwaway worktree; 9 of 12 mutations fail the suite.
  - **The real entrypoint**, with only its final `exec supervisord` stubbed, in throwaway containers: an unsafe
    password and a broken template each stop it with exit 1 and no value in the output; ordinary values reach
    `supervisord`.
- **Live:** before the push, staging and production passed the new checks (read-only over SSH, counts only). After
  deploy run 41273662458 the staging container restarted at 04:36:46 UTC, 7 programs RUNNING, no FATAL, RenderError
  or checker lines; the checker passes on the live conf; `NEO4J_PASSWORD` and `SESSION_SECRET` appear in 0 files
  under `/var/log`.
- **harness-lint:** clean (0 violations).
- **Known open issues:** §6.
- **ADR debt:** none. ADR 0006 is Accepted; deviations 3 and 4 are recorded above and in `d4784665`.

## 6. Carry-forward register

- [ ] Before `tags`, `magic-carpet` or the agent-memory instance take this code, run the values check there; any
      with an unsafe character would stop starting. *(Corrected 2026-11-01: they deploy from their own branches or
      rebuilds, not `main`, so the `main` promotion didn't reach them.)* (§4 #7; the counts-only check is described in `book.md`'s AC-5 bullet and the test plan's AC-5 section)
- [x] Promote to `main`; until then production and the sandboxes run neither this nor stories 9 and 10. (shared with
      `config-secret-logging` §6) *(Done 2026-11-01: promoted to production as merge `c3335a5d` on ngit and GitHub `main`, deploy run 41338503257; production checked clean after deploy. `tags` and `magic-carpet` deploy from their own branches, not `main`, so they take it when those branches do.)*
- [ ] A hand edit inside a running container isn't checked until restart. (§4 #6; OPERATIONS.md §11 gives the manual
      check)
- [ ] `getConfigFromFile()` misreads a value holding `'`, and an empty value. (OPEN.md row
      `2026-10-31-quote-in-conf-value-misread`)
- [ ] The scan checks the next catch in the text, and misses `source "${X}"`, `. ${X}` and `source ./x`; the second
      gap can hide a leaking call. (OPEN.md row `2026-10-31-source-call-scan-blind-spots`)
- [ ] Bare-metal installs run neither startup check. (ADR 0006 Consequences; story 11 *Out of scope*)

## 7. Process findings (harness)

`bash scripts/harness-stats.sh` at retro time: 305 reviews parsed, 303 final PASS, kick-back rate 0%, 80 reviews with
kick-back history; 9 open books and 87 closed before this close; this book open 1 day. Review 11's own "Harness
friction" section reported two items (P1, P5).

| Finding | Source | Terminal state |
|---|---|---|
| P1. The review brief named `git diff origin/staging..HEAD`; `staging` had moved on, so that range also showed the appearance-setting work reversed. The Reviewer used the merge base instead. | review 11 § Harness friction | declined: workflow 5 already says `git diff <base>...HEAD` (three dots); the brief, not the harness, was wrong, and the Reviewer caught it |
| P2. Running suites in a container from the image: `docker cp` merges into the image's tree (stale files such as the deleted copies stay), the scratchpad isn't shared with Docker, and macOS `com.apple.provenance` xattrs make `docker cp` fail unless the tar is made with `COPYFILE_DISABLE=1 tar --no-xattrs`. What worked: tar the tracked tree into a fresh `/tmp` in a throwaway container and link the image's `node_modules`. | this session, Implementation | OPEN.md row `2026-10-31-scratch-stack-image-and-lib-mount` ("Seen again 2026-11-01" added) |
| P3. Claude Code's safety check refused an `rm -rf $B/$d` inside a throwaway container's script, and a `docker rm -f $C`. | this session | declined: the check worked as designed; the no-delete approach in P2 was the better recipe anyway |
| P4. Story 10's review called `calculateFromLibrary.js` compiled but didn't notice its wrapper recompiles it, so a `.js`-only patch could be undone. | story 11 Planning | declined: Planning caught it before any code, as the per-story cycle is meant to; same disposition as `config-secret-logging` F4 |
| P5. The full `npm test` gate can't run on the Mac Studio; every gate line here is substitute evidence. | review 11 § Harness friction; §5 | OPEN.md row `2026-09-27-test-fixture-taggings-on-prod-relays` (the cause; still open) |
| P6. The safe-to-merge check, skipped twice in the last book (its F1), was run before the ngit merge and again before the deploying GitHub push. | this session | OPEN.md row 340: evidence that the operator's brief closes the gap when it names the step; the row's fix (the check on the documented path) is still open |

Ports to the other flow: P2 applies to any Tester or Reviewer on this machine, in either flow; P6 is the human-gated
half of row 340, and row 341 covers the Director's copy.

## 8. Epic close-out

`security-auth-exposure` stays **Done**. Story 11 joined it under this book as stories 3–10 did under theirs, and its
folders stay outside `done/`, as after the earlier closes.
