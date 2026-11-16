# Review: doc lane — the resync test writes its text-direction control as an escape, and its ledger row is closed

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-16
**Diff:** `git diff origin/staging...HEAD` on `fix/resync-test-raw-bidi`: two commits, `3f8dd8f4` and `4df10d9b`, over `origin/staging` at `a35fd054` (the merge of PR #81). PR #83 into `staging`: open, mergeable, head `4df10d9b` (one `gh pr view`, read at 05:35:05Z).
**Lane:** doc lane, a one-liner (`engineering-team/workflows/0-intake.md` step 3: Implementer, then Reviewer; a non-numbered review, no story, no test plan, no book). This file is the lane's record. Template: the docs-mode variant in `templates/review-checklist.md` (`:20`).
**Spec:** OPEN.md row `2026-11-16-raw-bidi-control-in-resync-test`, its "What was seen" (`:9`, `:11`) and "Fix shape" (`:13`). The close is checked against OPEN.md § "How to use this ledger".
**Filed under:** graph-operations-first-slice, because the row came from that epic's story 16 review (round 1, non-blocking 11: `16-create-concept-and-update-concept.md:188`). The test itself was never filed under an epic.
**Files:** `test/dictionary-resync-concept.test.js` (+1 -1, line 253), `ledger/2026-11-16-raw-bidi-control-in-resync-test.md` (+2 -2, lines 6–7).

## Quality gates (run by reviewer, not trusted)

- [x] **Code points.** I used a throwaway script outside the repo. It builds every special character from its code point and names each character it prints as U+XXXX.
  - Only line 253 differs (358 lines on both sides). The base line holds one character outside printable ASCII: U+202E, at column 53. HEAD's line holds none.
  - HEAD's line is the base line with that U+202E replaced by the six characters U+005C U+0075 U+0032 U+0030 U+0032 U+0045: an escape for 202E in upper-case hex, as `src/lib/conceptHeaderEdit.js:45` writes its range. Nothing else on the line changed (exact string equality).
  - I evaluated both versions of the line's array in a sandbox. Each has four rows, and every element is `===` its counterpart. Element [1][1] is `GitHub `, then U+202E, then `tnuoccA`.
  - The ledger row holds no bidirectional control at either commit. Its Status and Done lines are now plain ASCII. The base Done line held U+2014, the template's placeholder.
  - I scanned all 4,844 tracked files at HEAD: by code point in every text file (all decode as UTF-8), and by byte in every file, the 8 binary ones included. `firmware/active` is a symlink to a tracked directory, and that directory's files were scanned too. There are no hits for U+202A–U+202E or U+2066–U+2069. In the binary files, the byte scan finds only the pair D8 9C (the UTF-8 form of U+061C) inside a PNG and two fonts. That is binary data, not text.
  - Positive control: the same scan finds `base:253 U+202E` in the base blob, and 12 of 12 in a planted string. Unicode's wider Bidi_Control property (12 code points) finds two marks in the checkout (see N2).
  - The two commit messages hold one character outside printable ASCII: U+2014.
- [x] **The changed suite, stack-free.** I ran it with the brief's dead-endpoint env (`node -e "require('./test/dictionary-resync-concept.test.js').run()…"`), output redirected to a file, not piped.
  - HEAD: `dictionary-resync-concept: 21 passed, 0 failed, 0 skipped`, exit 0.
  - Base: the `origin/staging` blob, compiled in memory under the real path, with nothing written to the repo. The same line, exit 0.
  - The two outputs are byte-identical.
- [x] `git diff --check origin/staging...HEAD`: no output, exit 0.
- [x] `bash scripts/harness-lint.sh`: last line `harness-lint: clean (0 violations)`, exit 0. L15 checks the row's filename and header fields. Neither changed path is listed in `scripts/harness-def-paths.txt`, so L10 asks for no CHANGELOG row. I ran it again with this review in place: still clean, exit 0. Its one line about this file is an INFO line (friction 3).
- [ ] `npm test`: **not run, on purpose.** On this Mac the full suite writes to a live instance that holds an agent's memory. `node test/gate-status.js` prints `no gate run records in <worktree>/tmp/gate-runs` and exits 2, so there is no local gate line to quote.
- [ ] **CI.** The check is `Test / stack-free`: `npm ci`, then `npm test`, on every pull request to `staging` or `main` (`.github/workflows/test.yml:11-12`, `:24`, `:40-41`).
  - **As found** at 05:35:05Z: one check, `IN_PROGRESS` since 05:30:12Z. It is a rerun of run 43808151504; the coordinator reports requesting it at 05:30:07Z. I did not wait for it.
  - **Attempt 1.** I read its failed-step log once (`gh run view 43808151504 --attempt 1 --log-failed`). Gate run `20261116T050750Z-2549-0bf2` ended on `Overall: FAIL — 7447 passed, 1 failed, 607 skipped across 342 suites · record tmp/gate-runs/20261116T050750Z-2549-0bf2.json`, and the step ended `Process completed with exit code 1`. The record stayed on the runner, so this is the run's own verdict line, not a `gate:status` line.
  - **The changed suite in that run:** `[185/342] dictionary-resync-concept: PASS (21 passed, 0 failed, 0 skipped)`.
  - **The one failure,** at 05:09:30Z: `FAIL  L1 briefing link resolves with 2xx: https://tapestry.brainstorm.world`, with the message `https://tapestry.brainstorm.world must resolve with a 2xx; got 502.`
  - **It doesn't bear on the diff.** L1 checks the links in `docs/information-for-agents.md` (`test/information-for-agents.test.js:45`, `:524`, `:531`). This diff touches neither that file nor anything it links to. A 502 is the live server's answer, which no test string or ledger file can cause. And the suite this diff changes passed in the same run.
  - **Not checked here:** the coordinator also reports a production deploy ("Deploy to Tapestry", run 43808217938 on `main`, 05:07:46Z–05:09:48Z) whose window contains the failure, and a 200 from the site at 05:29Z.
  - **The verdict stands.** Under OPERATIONS.md's no-retry policy (`:1048`), the first run's exit code is the verdict. CI's verdict for this head is therefore FAIL, and a green rerun won't change that record (N3).
- [ ] Playwright: not applicable (no UI).
- [ ] _Lint / typecheck / build not configured: skipped._
- [ ] Independent checker (`workflows/5-review.md`, "Optional: an independent check before the commit"): not applied, because this session can't start one. The session that commits this review can run one first.

## Claims adherence (doc-lane variant)

"Where" says who makes each claim: D is the Done line (`ledger/…:7`), C is the message of commit `3f8dd8f4`, and P is PR #83's body.

| # | Claim | Where | Evidence | Holds? |
|---|---|---|---|---|
| 1 | `:253` held a raw U+202E, the right-to-left override, inside a string: the input E10 checks | C, P; the row (`:9`) | It is the base line's only character outside printable ASCII, at column 53, inside element [1][1] of E10's `bad` array. E10 sends every element through the resync route and expects `source-invalid` | Yes |
| 2 | A viewer that applies the Unicode bidirectional algorithm showed the rest of the line reversed: the "Trojan Source" pattern, CVE-2021-42574 | C, P; the row (`:9`) | No U+202C follows the override on the line. Without one, an override lasts to the end of the paragraph (UAX #9, rule X8), and a line break ends the paragraph. CVE-2021-42574 is the Trojan Source bidirectional CVE | Yes |
| 3 | GitHub warned about hidden bidirectional text on the file | C, P; the row (`:9`) | It matches the banner GitHub shows on such files. Not seen in this review | Not checked; immaterial |
| 4 | The line now writes the character as its six-character escape, as it already writes its newline | D, C, P | See Gates, "Code points": HEAD's `:253` is the base line with U+202E replaced by U+005C U+0075 U+0032 U+0030 U+0032 U+0045, and nothing else changed. The line's backslash escapes, in order, are that one and the backslash-n in `'Git\nHub'` | Yes |
| 5 | The array has the same value as before and still holds U+202E, so E10 checks the same string | D, C, P | Four rows, every element `===`, and [1][1] has U+202E at index 7. `BIDI_RE`, evaluated from `conceptHeaderEdit.js:45`, matches it and stops matching once the U+202E is removed. `checkEditFields` refuses names on that regex (`:79`), and the route runs it on the source's names (`src/api/adoption/resyncConcept.js:81`). The suite's output is byte-identical at base and HEAD | Yes |
| 6 | A scan of the checkout by code point finds no raw text-direction control (U+202A to U+202E, U+2066 to U+2069) | D (set not named); C, P (set named) | See Gates, "Code points": 4,844 tracked files, no hits for the nine, and a positive control | Yes, for the nine (N2) |
| 7 | The suite passes 21 of 21 before and after, run on its own with every endpoint dead | C, P | Gates: 21/0/0 at HEAD and at base, exit 0 each. CI attempt 1: `PASS (21 passed, 0 failed, 0 skipped)` | Yes |
| 8 | A script wrote the escape, because an escape typed into an agent's write tool can reach the file as the raw character | D, C, P | The result is claim 4. Bytes can't show who or what typed them. The mechanism matches this environment: this review's brief forbids typing such escapes for the same reason. I did not test it | The result, yes. The provenance can't be checked and doesn't matter |
| 9 | "That is how such characters got into #74's first round" | P | Review 16, round 1, blocking 2 (`:137`) records the raw characters, and that the module they were copied from writes escapes (`:140`). No record in the repo says how they got there | Unsourced (N1) |
| 10 | "The scanner was first checked on a file built to hold three" | P | Not in the record. This review's scan has its own positive control (claim 6) | Can't be checked; immaterial |
| 11 | The full `npm test` isn't run on this Mac; CI runs it on this pull request | P | `.github/workflows/test.yml` (Gates, "CI"). It did run: attempt 1 | Yes |
| 12 | The row came from review round 1 of graph-operations-first-slice #16, non-blocking 11 | P; the row (`:5`, `:15`) | `16-create-concept-and-update-concept.md:188`, inside round 1 (round 2 starts at `:209`) | Yes |
| 13 | The row is closed: `**Status:** DONE` and `**Done:** 2026-11-16, in #83 (commit 3f8dd8f4)`. The subject of `4df10d9b` reads "fixed by #83" | the diff (`:6–7`) | OPEN.md `:23` (set DONE, fill Done, never delete) and `:27` (an ISO date and the PR); `templates/open-row.md:20`. The date is both commits' UTC date (05:05:55Z and 05:07:04Z). #83 is this branch's PR. `3f8dd8f4` is the commit that changes `:253`, and `staging` takes PRs as merge commits (its last eight first-parent merges), so the hash stays reachable. The file is not moved or renamed, its Id is unchanged, and L15 is clean. Closing a row inside the PR that fixes it has a precedent: `a5232f93` ("fixed by #80"), which arrived through PR #80's branch | Yes |
| 14 | The process: a one-liner under the intake table (Implementer, then Reviewer), with a doc-lane review and no story. The row is closed in a second commit, which names the PR | P | 0-intake `:27` (Doc / one-liner, under Standard), `:31` (a non-numbered review, no story), `:39` (no book). `4df10d9b` names #83 | Yes |

## ADR adherence

Not applicable: the lane has no ADR. The row's Fix shape (`:13`) takes its place, and each of its asks is met.

- [x] "Write the character as the escape …, as `src/lib/conceptHeaderEdit.js:45` writes the range": done, in the same upper-case form (claim 4). The sibling Edit suite writes the same kind of input the same way (`test/dictionary-edit-concept.test.js:186`).
- [x] "the test then checks the same input": claim 5.
- [x] "Write it with a script … and check the bytes afterwards": the bytes are right (claims 4 and 6). For the script itself, see claim 8.
- [x] No dependencies, no layering, no other files.

## Concept-graph integrity

- [x] No concept definition or handle is touched, so no firmware reinstall is needed.
- [x] No new code, so nothing has to orient via `/summaries`.

## Things tests can't catch

- [x] **The hazard itself.** HEAD's line is printable ASCII, so a viewer shows what the parser reads. The test file's other characters outside printable ASCII are U+2014, U+2013, U+2550, U+2192, U+2019, U+2713 and U+2717. All are visible. The file has no format character (Cf), no control character and no unusual space.
- [x] No secrets. The diff adds one line of test data and two lines of ledger prose.
- [x] No debug output and no commented-out code.
- [x] Scope: exactly the row's fix and its close. No other line moved.
- [x] Architecture invariants: not engaged (test data and a ledger row).

## House rules check

- [x] Concept Graph API authority: not engaged.
- [x] No new lint, typecheck or build tooling.
- [x] No TA pubkey literal is added.

## Product-guide adherence

Not applicable: no PRD-traced copy.

## Findings

### Blocking

None.

### Non-blocking

1. **PR #83's body, "How it was made": "That is how such characters got into #74's first round" is stated as fact, without a source.** Review 16 records that those characters were raw, and that the module they came from writes escapes (`16-create-concept-and-update-concept.md:137`, `:140`). Nothing records how they got there. The mechanism is plausible, and this review's own brief guards against it. **Optional:** "which is likely how …", or a pointer to the evidence. This text lives only on GitHub, so nothing in the repo changes.
2. **`ledger/2026-11-16-raw-bidi-control-in-resync-test.md:7`: the Done line says "no raw text-direction control" without naming the set.**
   - For the row's own set it holds across the checkout. That set is U+202A–U+202E and U+2066–U+2069, defined at `:11` and named in the commit message and the PR body.
   - Unicode's Bidi_Control property also covers U+061C, U+200E and U+200F, and two of those are in the checkout. U+200E and U+200F sit at `public/kg/assets/html.worker-CwpTb9lJ.js:28-29`, a vendor bundle: they are the values of the `lrm;` and `rlm;` entries in its minified HTML-entity table. They are directional marks, not the embeddings, overrides and isolates the row is about.
   - **No change asked.** This is recorded so that a later scan by the Unicode property doesn't read these two as this row reopening.
3. **For the merge, not the diff: CI's verdict for this head is attempt 1's FAIL** (Gates, "CI"). Per OPERATIONS.md `:1048`, the first run's exit code is the verdict, so a green rerun adds evidence but doesn't replace that record. `staging` has no required checks (`:119`), so whether to merge is the merger's call. The cause is outside this diff. **Suggested:** whoever merges cites attempt 1's FAIL and its cause (the ledger row the coordinator plans), not the rerun's result alone.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **The stack-free gate can turn red without any code change.** `information-for-agents` L1 (`test/information-for-agents.test.js:531`) fetches every link in `docs/information-for-agents.md`, and one of them is the production site's root. In attempt 1 the root answered 502 at 05:09:30Z, inside the deploy window the coordinator reports. OPERATIONS.md's no-retry policy (`:1048`) rests on the suite's "zero recorded-flake history", which live checks like these can't promise. The policy's answer to a flake is "not a retry but a cited quarantine entry". The coordinator has said they will file a ledger row for this after the review. This item is evidence for that row, not a second row.
2. **`scripts/harness-def-paths.txt:16-17` still says "no workflow runs".** But this PR's `Test / stack-free` job ran, and is being rerun. This is already covered by the open row `2026-10-29-h2-0-baseline-predates-github-flow` (`:31`). No new row.
3. **`scripts/harness-lint.sh:111` says this review "predates the numbering convention".** It is a doc-lane review, and 0-intake step 3 (`:31`) gives doc-lane reviews exactly this non-numbered form. This is already covered by the open row `2026-11-16-lint-mislabels-doc-lane-reviews`. No new row.

## Verdict

**PASS**

The diff is the row's fix shape and its close, and nothing else. Line 253 is now printable ASCII and its array has the same value, so E10 checks the same string. The suite gives the same 21 of 21 before and after. No tracked file holds a raw override, embedding or isolate, and the close follows OPEN.md § "How to use this ledger". Every claim holds except one unsourced aside in the PR body (N1). CI's one failure is a live link check against the production site, outside anything this diff touches (N3; friction 1).

## On PASS (same commit)

- [x] No story to mark Done: the doc lane has none (0-intake step 3).
- [x] Completion detection: none needed. A doc-lane one-liner opens no book (0-intake `:39`).
- [ ] Commit: left to the session that launched this review, which asked the Reviewer not to commit. The role's rule is to commit the review whatever the verdict. A suggested message: `review: resync-test-raw-bidi — PASS (graph-operations-first-slice, doc lane)`.
