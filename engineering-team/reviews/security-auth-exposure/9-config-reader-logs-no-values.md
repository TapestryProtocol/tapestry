# Review: Story 9 — The config reader logs key names, never values

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-31
**Diff:** `git diff origin/staging...HEAD` on `fix/config-secret-logging` — story `0a60c80f`, failing tests `ff1e4569`,
fix `b56f83a1` (base `69e10489`)
**Story:** `engineering-team/stories/security-auth-exposure/9-config-reader-logs-no-values.md`
**Test plan:** `engineering-team/stories/security-auth-exposure/9-config-reader-logs-no-values.test-plan.md`
**ADR:** none (Bug, Standard; Architecture skipped as obvious)
**Book:** `engineering-team/audits/config-secret-logging/book.md`
**Source:** ngit issue `c549202b`

## Quality gates (run by reviewer, not trusted)

- [ ] `npm test` — **not run, by machine rule.** On the Mac Studio a full `npm test` publishes fixtures to public
      relays, so no `npm run gate:status` line exists for this review. In its place:
  - [x] **New suite, at HEAD `b56f83a1`:** run through its export (`node -e "const m=require('./test/config-secret-logging.test.js'); …"`)
        — `config-secret-logging: 5 passed, 0 failed`, `{"pass":5,"fail":0,"failures":[]}`, exit 0. The suite was
        grepped first for `localhost|CONTROL_PANEL_BASE|BRAINSTORM_BASE_URL|fetch|strfry|publish|nak`: no hits.
  - [x] **New suite, at the pre-fix commit `ff1e4569`** (throwaway `git worktree`, removed afterwards):
        `0 passed, 5 failed`, exit 1. Every test fails on the fix's target. The suite has teeth.
  - [x] **Regression in the six suites that load `src/utils/config.js`** (harden-user-data-error-path,
        my-assistant-page, shell-input-hardening, bullboard-admin-access, tagging-edges-state-routes,
        tagging-edges-wiring) — **PASS, rerun by the session after this review** (2026-10-31) inside the throwaway
        `tapestry-scratch` container (`SCRATCH_IMAGE=agent-memory-tapestry`, this checkout's `src/` mounted, `test/`
        copied in), each through its `run()` export: 2/0, 31/0, 6/0, 9/0, 62/0 and 86/0 (pass/fail), and the new suite
        5/0. On the host they had failed only on missing packages, with identical counts before and after the fix.
        Static support for no regression: the diff
        changes only the text of four `console.log` lines (`git diff --stat -- src`: 1 file, +6 −4), no return path
        changes, and a grep of `test/ scripts/ src/ lib/ bin/` found nothing that matches on the old log text
        (`Source command result`, `Using default value for`, `(quoted)`, `(unquoted)`).
  - [ ] **Registry guard** `test/stack-free-npm-test.test.js` — not run by the reviewer (its G2 runs a live suite
        against `:7778`). The Tester recorded 7/7 with the suite registered. The registry entry is a plain
        `{ file: 'config-secret-logging.test.js' }` and the suite exports `run()`, the shape the guard requires.
- [ ] `npm run test:playwright` — not applicable (no UI).
- [x] `bash scripts/harness-lint.sh | tail -1` → `harness-lint: clean (0 violations)` at HEAD `b56f83a1`, before this
      review was written. With this PASS review in the tree it reports `1 violation(s)`: **L1**, PASS-final review but
      story status `Approved`. That violation is expected and clears when the review commit flips the story to `Done`
      (see *On PASS*).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] **AC-1** (quoted, unquoted): two tests, both assert the returned value first and then that the captured
      stdout+stderr doesn't contain it. `src/utils/config.js:33` and `:42` now print `Found <KEY> (quoted|unquoted)`.
- [x] **AC-2** (`source` fallback, environment only): test passes. `:55` prints `found` / `not found`, never the result.
- [x] **AC-3** (default): two tests (key missing from file; file missing). `:69` prints only the key name.
- [x] **AC-4** (name and resolution still logged): every test also asserts the key name and the way it was resolved.
      `quoted`/`unquoted`/`source`/`default`/`not found` all survive. The `\bquoted\b` check can't be satisfied by
      `unquoted` (there is no word boundary inside the word).
- [x] **AC-5** (startup log on a scratch instance, then on the staging droplet) — **done.** Scratch instance
      (2026-10-31, session): the startup log `/var/log/supervisor/brainstorm.log` (930 lines) names both keys only as
      `Found NEO4J_PASSWORD (quoted)` and `Found SESSION_SECRET (quoted)`. The real values, read from the instance's
      `/etc/brainstorm.conf`, occur 0 times in it and in 0 files under `/var/log`, and no line has the old
      `Found <KEY>=`, `Source command result for` or `Using default value for <KEY>: ` form. Staging droplet
      (2026-10-31, session, read-only over SSH): after ngit and GitHub `staging` moved to merge `6d3bb659` and deploy
      run 41235569192 succeeded (1m52s), the droplet's checkout was `6d3bb659`, the container restarted at 19:45:28
      UTC, and the 858-line startup log named both keys only as `Found <KEY> (quoted)`. The real values occurred 0
      times in it and in 0 files under `/var/log`, with no old-format line; the site answered 200. Re-checked after
      story 10's deploy (`17e38803`, run 41243255175): still 0.
- [x] No criterion dropped. No behavior added beyond the story: only log strings changed, return values are identical.
- [x] The story's sweep claim holds. `grep` for `console.*(PASSWORD|SECRET|PRIVKEY|NSEC)` and for logs of
      `${neo4jPassword|password|sessionSecret|privkey|nsec}` across `src lib bin` found only `bin/install.js:440`.
      That line prints the hard-coded `'neo4j'` set at `:436` on the empty-config path, as the story says.

## ADR adherence

- [x] No ADR. Architecture skip is justified: four log-string edits make no design choice.
- [x] No new dependencies. The test uses only `fs`, `os`, `path`, `crypto`.

## Concept-graph integrity

- [x] Not applicable. No concepts, handles or firmware touched. No POV, publish or graph-state surface (principles 1–4 untouched).

## Things tests can't catch

- [x] No secrets in committed files. Test values are random per run. Fixture key names are `CSL_TEST_*`.
- [x] No leftover debug logging. The one added comment (`config.js:30-31`) explains the rule and cites the issue.
- [x] No commented-out code.
- [~] Error paths: see non-blocking finding 1. A pre-existing path in the `source` fallback can still echo a config
      line verbatim. The diff doesn't widen it.
- [x] Concurrency: the test swaps `process.stdout.write`/`stderr.write` synchronously around a synchronous call and
      restores both in `finally`. Its env/`BRAINSTORM_CONF_PATH` changes are restored in `run()`'s `finally`. That is
      safe under the in-process runner.
- [x] Security: the change only removes data from logs. Pre-existing regex and shell interpolation of `varName` and
      `confFile` (`:27`, `:38`, `:49`) is unchanged and fed only literal key names by callers. Out of scope.

## House rules check

- [x] Concept Graph API authority respected (n/a).
- [x] No new lint/typecheck/build tooling.
- [x] TA pubkey: not touched.

## Product-guide adherence

- n/a (no PRD; acceptance-frame book).

## Findings

### Blocking

None.

### Non-blocking

1. **`src/utils/config.js:49-54`, `:60`. A bash syntax error in the conf file is still echoed verbatim, value
   included, whenever the `source` fallback runs.** Verified by the reviewer. A conf whose line is
   `export NEO4J_PASSWORD=pw)SECRETTAIL_paren` was used with a lookup of an unset key. The output held the full line
   twice: once through `execSync`'s default stderr pass-through (no `stdio` option, so Node writes the child's stderr
   to `process.stderr`), and once in `sourceError.message`, which Node builds as `Command failed: <cmd>\n<stderr>`.
   That message is logged at `:60`. An unquoted value with a space (`export SESSION_SECRET=abc TAIL`) did **not**
   leak, because `export` takes `TAIL` as a second name.
   **Severity: non-blocking.** (a) The path existed before the fix and the diff doesn't widen it. (b) It needs a conf
   line that isn't valid bash. The installer and template double-quote every secret (`bin/install.js:561`, `:575`;
   `config/brainstorm.conf.template:72`, `:84`), so it takes a value containing `"` or a hand edit. (c) The same conf
   is sourced by 123 other repo files (`grep -rlE 'source +"?/etc/brainstorm.conf'`). They would print the same
   syntax error into their own logs, so fixing only this reader would not close the class.
   **Recommended follow-up** (OPEN row or a story in this epic): run the fallback with
   `stdio: ['ignore', 'pipe', 'ignore']` and log `sourceError.status` (the exit code) instead of `sourceError.message`.
2. **`src/pipeline/stream/addToQueue.mjs:26`, `:37`, `:43`. A second config reader that still logs values.**
   Agree with the Implementer: out of scope. Its only call (`:55`) reads `BRAINSTORM_RELAY_URL`, a public value, so
   nothing secret leaks today. It is a latent footgun, though: the next `getConfigValue('…SECRET…')` added to that
   file would reintroduce issue `c549202b`. Suggest folding it into the follow-up row for finding 1 (same one-line
   fix: drop the value from the three lines), or adding a sentence about it to the story's *Out of scope* section.
3. **`test/config-secret-logging.test.js:55`. `fs.mkdtempSync` runs at module load, but cleanup happens only in
   `run()`.** If the file is `require`d without calling `run()`, an empty temp directory is left behind. Observed once
   during this review and removed. The runner always calls `run()`, so this is a trivial nit. Optional: create the
   directory inside `run()`.

### Harness friction

1. None new. This machine's rule against a full `npm test` makes the template's "quote the `gate:status` line" box
   unfillable here. That is a known local constraint (memory *full-npm-test-leaks-fixtures*), not a defect in this
   story's artifacts. The substitute evidence is recorded above.

## Verdict

**PASS**

The diff matches the story. All four value-bearing log lines are fixed, and the AC-4 diagnostics remain. The new suite
passes at HEAD and fails 0/5 at the pre-fix commit. No blocking issues. PASS is for the code review. The six-suite
regression rerun and the AC-5 live evidence were pending at review time; both have since passed (above).

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place, by the session in the review commit, after the scratch-container
      rerun of the six config-dependent suites confirmed no regression (above).
- [x] Completion detection: the book (`audits/config-secret-logging/`) was **not** complete at review time (frame
      bullets 1–2 only). Bullets 3–5 landed later on 2026-10-31, and story 10 met the bullet it added; the owner then
      ratified the close ("Record and close").
