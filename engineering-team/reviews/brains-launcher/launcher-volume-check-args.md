# Review: doc lane — the launcher's destroy test looks for a whole `-v` or `--volumes` argument, and its ledger row is closed

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-16
**Diff:** `git diff origin/staging...HEAD` on `fix/launcher-volume-check-args`: two commits, `5e938e76` and `dfe87c87`, over `origin/staging` at `89376a4c` (the merge of PR #88). PR #91 into `staging`: open, head `dfe87c87`, two files (one `gh pr view`, read at 10:54:09Z).
**Lane:** doc lane, a one-liner (`engineering-team/workflows/0-intake.md` step 3: Implementer, then Reviewer; a non-numbered review, no story, no test plan, no book: `:27`, `:31`, `:39`). This file is the lane's record. Template: the docs-mode variant in `templates/review-checklist.md` (`:20`).
**Spec:** OPEN.md row `2026-11-16-launcher-volume-check-matches-temp-path`: its "What was seen" (`:9`), "Cause, reproduced" (`:11`) and "Fix shape" (`:13`). The close is checked against OPEN.md § "How to use this ledger" (`:18–28`) and `templates/open-row.md` (`:20`).
**Filed under:** brains-launcher, the epic that built the launcher (`epics/brains-launcher.md`, Active). The test file came in with its story 1 (`b078b81a`; review `1-launch-a-brain.md`).
**Files:** `deploy/launcher/test/compose.test.js` (+8 -3: lines 19, 23, 33, 80, 83, 87–89), `ledger/2026-11-16-launcher-volume-check-matches-temp-path.md` (+2 -2, lines 6–7). The backend and the test helpers are the same at both commits.

## Quality gates (run by reviewer, not trusted)

- [x] **The flake, at base and at HEAD.** I read the implementer's three scratch scripts, and they do what the brief says. Then I wrote my own, outside the repo:
  - a passive logger that records each folder `mkdtempSync` returns, with its call number;
  - a preload that forces the first random character of every temp folder. In draw mode it calls the real `mkdtempSync` until that character comes up and removes the others. In append mode it adds the character to the prefix;
  - a mutating preload. Unlike the implementer's, it also fails the run (exit 97) if a mutation never applies, and a control with a target that is never compiled shows that it does;
  - a runner that compiles the base test under its real path. Its source is `git show origin/staging:deploy/launcher/test/compose.test.js` (blob `3760ba2b`), byte-identical to the implementer's saved copy.

  The results:
  - **Natural draws, nothing forced:** 620 runs at each commit, with only the passive logger. At base, 9 runs failed, all on the destroy test. They are exactly the 9 runs whose destroy-test folder started with `v`, for example `launcher-test-vOMS3a`. At HEAD, 0 of 620 failed, including the 17 runs whose folder started with `v`.
  - **It also happened on its own during this review.** A plain base run failed. It forced no folder; the mutating preload was loaded, with nothing to change. Afterwards I found its destroy-test folder by birth time: `launcher-test-vzxWQO`.
  - **Forced `v`:** base gives `not ok 6 - destroy detaches Caddy first, then removes containers and keeps volumes`, with `error: 'destroy must not remove volumes'`: 15 passed, 1 failed, exit 1. HEAD passes 16 of 16, exit 0. The results are the same in both modes on Node 24, and in draw mode on Node 22.23.1, CI's major version (`.github/workflows/test.yml:38`).
  - **The row's cause, exactly as it states it (`:11`).** I ran the real `destroy`, with the test's fake `run`, in folders named `launcher-test-vQ3x9a` and `launcher-test-Q3x9av`. Each gave two commands, and neither command has a whole `-v` argument. The old check flags one command in the first folder (the compose line, through its two paths) and none in the second.
  - **The rate.** On this Mac, 62,000 real `mkdtempSync` folders all had a six-character random part drawn from 62 letters and digits. `v` came first 1,043 times, or 1 in 59.4; a uniform draw gives 1,000. CI's Linux runner wasn't sampled.
- [x] **A sweep for any other flake of this kind.** For each of the 62 characters, I forced the first random character of every temp folder, in every process, through `NODE_OPTIONS`. A check showed that this reaches the suite's processes: 17 node processes reported in, and all 104 folders they handed back carried the forced character. With that in place I ran the gate's launcher suite at HEAD. It gave 139 passed and 0 failed for all 62 characters. Base `compose.test.js`, forced by the same preload, fails only for `v`.
- [x] **Mutations of `destroy`,** made in memory as the backend is compiled. Every mutation reported as applied.

  | # | `destroy` changed to | Folders | HEAD test | Base test (real folder) |
  |---|---|---|---|---|
  | M1 | `down`, then `compose … rm -f -v` | real, `v` | fails: 'destroy must not remove volumes' | fails, same message |
  | M2 | `down`, then `compose … rm -f --volumes` | real, `v` | fails: same | fails, same |
  | M3 | `down -v` | real, `v` | fails earlier, at `:86`; the message is the line itself, `… down -v` | not run |
  | M4 | `down --volumes` | real, `v` | fails at `:86` (`… down --volumes`) | not run |
  | M5 | `down -v`, with `:86` removed in memory | real, `v` | fails: 'destroy must not remove volumes' | not run |
  | M6 | `down --volumes`, with `:86` removed | real, `v` | fails: same | not run |
  | M7 | `down`, then `compose … rm -f --volumes=true` | real, `v` | **passes 16 of 16** (N1) | fails |
  | M8 | `down`, then `docker volume rm brain-avi_data` | real, `v` | passes 16 of 16 | passes 16 of 16 |

  M1, M2, M5 and M6 are the case the brief asks about: a volume flag, as a whole argument, that `:86` doesn't catch. M1 and M2 add a command after `down`. M5 and M6 remove `:86`, so that `:89` is tested alone.
- [x] **The two suites, stack-free,** with the brief's dead-endpoint env and output redirected to files:
  - `node deploy/launcher/test/compose.test.js`: the spec reporter's `tests 16`, `pass 16`, `fail 0`, exit 0.
  - `test/brains-launcher-service.test.js`'s `run()`: `launcher unit tests: 139 passed, 0 failed` and `{"pass":139,"fail":0,"skipped":0}`, exit 0.
- [x] `git diff --check origin/staging...HEAD`: no output, exit 0.
- [x] `bash scripts/harness-lint.sh`: last line `harness-lint: clean (0 violations)`, exit 0. L15 checks the row's file name and header fields. Neither changed path is listed in `scripts/harness-def-paths.txt`, so L10 asks for no CHANGELOG row. I ran it again with this review in place: still clean, exit 0 (friction 2).
- [ ] `npm test`: **not run, on purpose.** On this Mac the full suite writes to a live instance that holds an agent's memory. `npm run gate:status` (`node test/gate-status.js`) prints `no gate run records in <worktree>/tmp/gate-runs` and exits 2, so there is no local gate line to quote.
- [ ] **CI.** The check is `Test / stack-free`: `npm ci`, then `npm test`, on every pull request to `staging` or `main` (`.github/workflows/test.yml:10–12`, `:40–41`). **As found** at 11:00:32Z, from one `gh pr checks`: one check, `pending`, run 43852862058. I did not wait for it (N4).
- [ ] Playwright: not applicable (no UI).
- [ ] _Lint / typecheck / build not configured: skipped._
- [ ] Independent checker (`workflows/5-review.md`, "Optional: an independent check before the commit"): not applied, because this session can't start one.
- [x] **Nothing written to the repo, after one slip.** One of my loop scripts briefly wrote its own output file into the worktree: a relative path, after the script's `cd`. I moved the file out at once. `git status --porcelain --ignored=matching` is back to what it was at the start, `?? node_modules` (friction 1), and HEAD is still `dfe87c87`.

## Claims adherence (doc-lane variant)

"Where" says who makes each claim. C is the message of commit `5e938e76`, P is PR #91's body, D is the close in the diff (the row's `:6–7` and `dfe87c87`'s subject), and R is the row itself, which is already on `staging`.

| # | Claim | Where | Evidence | Holds? |
|---|---|---|---|---|
| 1 | The test failed if any recorded command line held the text `-v` | C, P; R `:11` | Base `:84`, `!commands.some((c) => c.includes('-v'))`, over lines joined at base `:20–21` | Yes |
| 2 | `docker compose` gets the brain's folder in `--project-directory` and in its `-f` path | C, P; R `:11` | `deploy/launcher/backends/compose.js:55`: `dirOf(slug)` and `file(slug, 'docker-compose.yml')`, both under `brainsDir` | Yes |
| 3 | That folder comes from `tempDir()`, which is `mkdtemp` with the prefix `launcher-test-` | C, P; R `:11` | `setup()` at `:17`; `deploy/launcher/test/helpers.js:27–29` | Yes |
| 4 | A random name that starts with `v` puts `-v` into the path. The comment at `:87–88` says the same | C, P; R `:11` | Gates, "The row's cause". The random part is letters and digits, so `-v` can arise only from the prefix's last `-` followed by a first character `v`. All 9 natural base failures had such a folder | Yes |
| 5 | About one run in 62 | C, P; R `:11` | 62 characters; on this Mac `v` came first 1 in 59.4 over 62,000 folders. Base failed 9 times in 620 runs (1 in 69). Linux not sampled | Yes, on this Mac |
| 6 | That failed PR #83's CI (Actions run 43813017539) on unchanged code | C, P; R `:5`, `:9` | One `gh run view`: workflow `Test`, event `pull_request`, branch `fix/resync-test-raw-bidi`, head `3f3d76aa`, attempt 1, `failure`. Its failed-step log, read once: `[203/342] brains-launcher-service: FAIL (138 passed, 1 failed, 0 skipped)`; `not ok 51 - destroy detaches Caddy first, then removes containers and keeps volumes`; `error: 'destroy must not remove volumes'`; `Overall: FAIL — 7447 passed, 1 failed, 607 skipped across 342 suites`; exit code 1. `git diff --stat 4df10d9b 3f3d76aa` shows a review file and two ledger rows. `deploy/launcher` is identical from `3f3d76aa` to base | Yes |
| 7 | The fake `run` now also keeps each command's arguments as an array | C, P | `:19`, `:23`, `:33`, `:80`; reset at `:83` along with `commands` | Yes |
| 8 | The test looks for an argument that is exactly `-v` or `--volumes`, as the fix shape says | C, P; R `:13` | `:89`: each `a` is an array, so this is `Array.prototype.includes`, element by element (SameValueZero), not the string method. M1, M2, M5 and M6 fail on it; in the cause run, the `v` folder gives 0 | Yes |
| 9 | The other checks match text such as `' down -v'`, which no path produces, and stay as they were | C, P; R `:13` | The diff touches only `setup()` and the destroy test. The only other negative checks on command text are `:58`, `:112` and `:166`. `:58` looks for the brain's 32-character hex password in the log, and no path here holds one. `:166` looks for `/api/ready`, and the random part never holds a `/`. `:112` runs over an empty list, since `purge` returns before running any command (`compose.js:139`). The sweep: all 62 first characters, 139/0 at HEAD | Yes |
| 10 | The evidence came from two preloads outside the repo: "nothing written to the repo" (C), "changed nothing on disk" (P) | C, P | I read both. Both live in the session scratchpad. The `v` preload makes real temp folders, as the test does itself, so P's "nothing on disk" holds for the repo but not for the temp folder | Yes; P's wording is loose, which doesn't matter |
| 11 | A `v` folder, the real `destroy`: the old test fails on "destroy must not remove volumes", as in CI, and the new test passes 16 of 16 | C, P | Gates, "The flake": forced (both modes, Node 24 and 22) and natural | Yes |
| 12 | A `destroy` that also runs `compose rm -f -v`, or `rm -f --volumes`, in a real or a `v` folder: the new test fails on "destroy must not remove volumes" | C, P | M1 and M2, in both kinds of folder | Yes |
| 13 | `-v` or `--volumes` added after `destroy`'s `down`: the test fails earlier, on its check that the command ends with ` down` | C, P | M3 and M4: the failure's message is the line itself, which is `:86`'s message argument. With `:86` removed in memory, `:89` catches both (M5, M6) | Yes |
| 14 | Run on its own with every endpoint dead, the gate's `brains-launcher-service` suite passes 139 of 139 | C, P | Gates, "The two suites" | Yes |
| 15 | The full `npm test` isn't run on this Mac; CI runs it on this pull request | P | `test.yml:10–12`, `:40–41`. Pending when read (Gates, "CI") | Yes; its result not seen |
| 16 | The row is closed: `**Status:** DONE` and `**Done:** 2026-11-16, in #91 (commit 5e938e76)`. `dfe87c87`'s subject reads "fixed by #91" | D | OPEN.md `:23` (set DONE, fill Done, never delete) and `:27` (an ISO date and the PR); `templates/open-row.md:20`. The date is both commits' UTC date (10:53:06Z and 10:53:29Z). #91 is this branch's PR. `5e938e76` is the commit that changes the test, and `staging` takes PRs as merge commits (its last 12 first-parent commits are two-parent PR merges), so the hash stays reachable. The file isn't moved or renamed, its Id is unchanged, and L15 is clean | Yes |
| 17 | The process: a one-liner under the intake table (step 3, Standard), Implementer then Reviewer, with a doc-lane review and no story, as the owner confirmed. The second commit closes the row and names the PR | P | 0-intake `:27`, `:31`, `:39`. `dfe87c87` names #91. The owner's confirmation is reported in this review's brief, and the repo holds no record of it | Yes; the confirmation itself can't be checked here |
| 18 | A doc-lane review will follow, at `engineering-team/reviews/brains-launcher/launcher-volume-check-args.md` | P | This file, in the non-numbered form that 0-intake `:31` gives a doc-lane review | Yes |

## ADR adherence

Not applicable: the lane has no ADR. The row's Fix shape (`:13`) takes its place, and each of its asks is met.

- [x] "Check the arguments, not the joined line": `:89` reads `argvs`, not `commands`.
- [x] "Keep each command's arguments as an array": `:19` and `:23`. The array is a copy, `[file, ...args]`, pushed before anything can throw, so it stays index-aligned with `commands`. It is returned at `:33` and reset with `commands` at `:83`.
- [x] "Look for an argument that is exactly `-v` or `--volumes`": claim 8.
- [x] "The test's other checks match on text such as `' down -v'`, which no path produces": they are left as they were (claim 9).
- [x] The row's last sentence: a flake's answer is a cited quarantine entry, not a rerun (OPERATIONS.md `:1050`). This diff fixes the cause, so no entry is needed.
- [x] No dependencies, no layering, no other files.

## Concept-graph integrity

- [x] No concept definition or handle is touched, so no firmware reinstall is needed.
- [x] The only new code is in a test, so nothing has to orient via `/summaries`.

## Things tests can't catch

- [x] **What the new check no longer flags:** N1.
- [x] **How the new check reads:** N2.
- [x] No secrets. The diff adds test code and two lines of ledger prose.
- [x] No debug output and no commented-out code. `:87–88` is an explanation, and it cites the row by its id, as OPEN.md `:22` asks. The `ledger <id>` form is one that test comments already use (for example `test/assistant-self-map-check.test.js:22`).
- [x] Scope: exactly the row's fix and its close. The other 15 tests still destructure only what they use, so the added `argvs` field changes nothing for them.
- [x] Concurrency: none. The fake `run` is called in sequence.
- [x] Outside the diff, the tests' temp folders: N3.
- [x] Architecture invariants: not engaged (a test and a ledger row).

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

1. **`deploy/launcher/test/compose.test.js:89`: the exact match catches less than the substring check did.**
   - An extra `compose … rm -f --volumes=true` after `down` now passes 16 of 16, where the base check flagged it (M7). Docker's command line also accepts a boolean flag written that way (not run here: this review had no Docker).
   - Neither version catches a `docker volume rm` (M8).
   - The `down` line itself is still pinned by `:86`, and the fix shape asked for exactly these two spellings. So this is a note, not a defect.
   - **Optional:** match `/^(-v|--volumes)(=|$)/` against each argument. Or pin destroy's whole command list with `assert.equal(commands.length, 2)`, which would catch any extra command, M8's included.
2. **`:89`: the array `includes` reads like the string `includes` it replaces.** `a` is an argument array, so `a.includes('-v')` asks whether some argument *is* `-v`. Only the name `argvs` and the comment at `:87–88` say so. If a later edit pushed the joined `line` into `argvs`, `:89` would silently turn back into the substring check, and only a `v` folder would show it. **Optional:** `a.some((arg) => arg === '-v' || arg === '--volumes')`, which can only be read one way.
3. **Outside the diff: the launcher's tests never remove their temp folders.**
   - `tempDir()` (`deploy/launcher/test/helpers.js:27–29`) makes a folder in the system temp folder, and no launcher test removes one. There is no `rmSync`, `after` or `afterEach` in any of them.
   - One run of the gate's launcher suite makes 104 such folders.
   - At the end of this review, this Mac's temp folder held 29,942 `launcher-test-*` folders. 29,472 of them were made after the review began, nearly all by its own runs.
   - CI's runners are thrown away after each run, so this matters only on a developer's machine.
   - **A second temp-path sensitivity,** seen while measuring the 104. With `TMPDIR` set to this session's long scratchpad path, 8 tests in `deploy/launcher/test/control.test.js` fail with `listen EINVAL`. They open a Unix socket under `tempDir()` (`:25`, `:108`), and that path, 156 bytes, is longer than macOS allows a socket path to be (104). Under this Mac's usual temp folder the path is 82 or 83 bytes. In CI's run 43813017539 these tests passed (138 of 139, the one failure being this row's), so the gate isn't affected. An agent whose `TMPDIR` is long would see 8 failures that aren't its change's fault.
   - **Suggested:** a `cleanup` ledger row covering both, if the coordinator wants one. This review doesn't open it.
4. **For the merge, not the diff: CI's verdict wasn't in when I read it** (Gates, "CI"). Under OPERATIONS.md's no-retry policy (`:1048`), that run's first exit code is CI's verdict for this head. `staging` has no required checks (`:119`), so the merge is the merger's call. **Suggested:** whoever merges reads run 43852862058's verdict first.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **The worktree's `node_modules` symlink shows as untracked.** It points to the main checkout's `node_modules`. `.gitignore:41`'s `node_modules/` has a trailing slash, so it matches only a directory, and `git status` lists `?? node_modules`. A `git add -A` would commit it. This PR doesn't include it (#91 lists two files). This is already covered by the open row `2026-11-16-route-walk-needs-node-modules` (its "The risk" bullet). No new row.
2. **`bash scripts/harness-lint.sh` says this review "predates the numbering convention",** in an INFO line. It is a doc-lane review, and 0-intake step 3 (`:31`) gives doc-lane reviews exactly this non-numbered form. This is already covered by the open row `2026-11-16-lint-mislabels-doc-lane-reviews`. No new row.

## Verdict

**PASS**

The diff is the row's fix shape and its close, and nothing else. The check now reads whole arguments, so a temp folder's name can't trip it.

- At base the flake is real: 9 of 620 natural runs failed, every one with a `v` folder, and one more failure happened on its own during this review.
- At HEAD nothing fails: 0 of 620 natural runs, and all 62 forced first characters across the whole launcher suite.
- The new check still catches a destroy that removes volumes through a whole `-v` or `--volumes` argument, including the cases `:86` misses (M1, M2, M5, M6).
- Every claim in the commit message and the PR body that can be checked holds. The owner's confirmation of the lane can't be checked from the repo (claim 17), and one phrase in the PR body is loose (claim 10). The two non-blocking notes on `:89` are optional (N1, N2).
- CI was pending when I read it (N4).

## On PASS (same commit)

- [x] No story to mark Done: the doc lane has none (0-intake step 3).
- [x] Completion detection: none in this file. A doc-lane one-liner opens no book (0-intake `:39`), and the result goes in the chat.
- [ ] Commit: left to the session that launched this review, which asked the Reviewer not to commit. The role's rule is to commit the review whatever the verdict. A suggested message: `review: launcher-volume-check-args — PASS (brains-launcher, doc lane)`.
