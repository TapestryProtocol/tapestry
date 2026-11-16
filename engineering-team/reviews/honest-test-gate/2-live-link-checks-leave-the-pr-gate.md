# Review: Story 2 — The pull-request gate stops checking live links; a weekly run checks them and files an issue

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-16
**Diff:** `git diff 89376a4c...HEAD`: story `3c5b1955`, test plan and failing tests `10b234e0`, implementation
`36e123d2`, ledger close and CHANGELOG row `2a0f3f84`. Reviewed at `2a0f3f84`, PR #94's head (draft, into `staging`).
No ADR: a Bug under Standard, Architecture skipped (`workflows/0-intake.md` step 3). The contract is the story and the
test plan's "For ratification" items, ratified 2026-11-16.

## Quality gates (run by reviewer, not trusted)

- [ ] `npm test` (the full gate): **not run on this Mac.** The local stack is the owner's agent-memory instance, which
      the live suites write to (ledger `2026-11-16-gate-status-unmet-without-local-gate`). Here `npm run gate:status`
      prints `No gate run records in …/tmp/gate-runs` (exit 2). The full gate's answer is CI's, read from the job log
      of PR #94's one check (Actions run 43892481591, job 133387270135, Node 22.23.4), on merge commit `ffad8ba6`
      ("Merge 2a0f3f84 into 9e979a00"): `Gate run 20261116T150517Z-2547-8ed6`, ending
      `Overall: PASS — 7496 passed, 0 failed, 644 skipped across 346 suites · record tmp/gate-runs/20261116T150517Z-2547-8ed6.json`.
      `gh pr checks 94`, read once at 2026-11-16T15:52Z: `stack-free pass 7m1s`.
- [x] Single suites, run by the Reviewer stack-free (every endpoint at a dead port, the switch unset, Node 24.18.0):
  - `live-link-checks`: 21 passed, 0 failed, 0 skipped at HEAD (1.5 s). At `10b234e0`: 3 passed, 18 failed. At
    `36e123d2`: 20 passed, 1 failed (E2).
  - `information-for-agents` 32/0/25 · `llms-txt` 12/0/15 · `workflow-hardening` 27/0 · `ci-test-job` 14/0 ·
    `stack-free-npm-test` 6/0/1 · `site-trust-signals` 20/0/8 · `brains-launcher-repo` 31/0/0 (W1c sorts top-level
    paths) · `ledger-row-ids` 6/0 (the ledger-row id rules) · `harness-lint` suite 85/0 (runs the real lint on the tree).
    CI gave the same counts for each, on the merge commit.
  - `session-start` (counts open meta rows; one was closed here) was left to CI, where it passed 32/0/0. Some of its
    tests run the `/whats-open` roll-up, which calls `gh pr list`, and this review kept its GitHub requests to a few.
- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)` at HEAD. At `36e123d2` it reports
      `VIOLATION L10 commit:36e123d2` (no CHANGELOG row yet); `2a0f3f84` adds the row.
- [x] `git diff --check 89376a4c...HEAD`: clean.
- [x] The CI log shows the gate fetched no links: all 33 L1 tests are SKIP (21 in the briefing's suite, 12 in
      llms-txt's), 0 PASS, 0 FAIL, and 33 lines carry the reason
      `live link checks are off; set TAPESTRY_LIVE_LINK_CHECKS=1 to run them (OPERATIONS.md §15)`.
- [ ] `npm run test:playwright`: not applicable, no browser surface.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

The base moved while this was in review. `origin/staging` is now `d85dccd3` (PR #93). The 17 files it changed since
`89376a4c` don't overlap with this PR's 15, and `git merge-tree --write-tree origin/staging HEAD` merges clean.

## Spec adherence

- [x] **Every acceptance criterion has a passing test**, and each one also holds in the Reviewer's own runs:

| AC | Code | Tests | The Reviewer's own check |
|---|---|---|---|
| AC1 | `test/helpers/liveLinkChecks.js:17` (the reason), `:20` (on only at exactly `1`, read at each check), `:51-56`; `test/information-for-agents.test.js:513-514`; `test/llms-txt.test.js:314-315` | A1–A4, C6 | Under a no-network stub, switched off: 0 requests. 21 + 12 reason lines. Against the **base commit**, with every link answered 200: the briefing's other 36 tests and llms-txt's other 15 report line for line as before. L1 goes from 21 + 12 PASS to 21 + 12 SKIP. CI agrees. |
| AC2 | `liveLinkChecks.js:26-29` (`isEgressRefusal`), `:32-45` (`checkLink`), `:54` | B1, B2 | The base commit's `checkLink` against the helper's, over 15 stubbed answers (2xx, 3xx, 401, 403 plain and three egress bodies, 404, 500, 502, ENOTFOUND, an abort, a cause without a code, a 403 whose body read throws): 15 identical. llms-txt switched on: an egress 403 and an ENOTFOUND are SKIP with their reasons; a plain 403 and a 502 FAIL, naming the link and the status. |
| AC3 | `scripts/live-link-checks.js:83` (sets the switch itself), `:84`, `:85-90` (red when a check fails or none was checked), `:91`, `:95`; `.github/workflows/live-link-checks.yml:10-13`, `:37-39` | C1–C5 | Driven with a fake `gh` and the stub: `31 passed, 1 failed, 1 skipped`, exit 1; `0 passed, 0 failed, 33 skipped`, exit 1; `33 passed, 0 failed, 0 skipped`, exit 0. |
| AC4 | `live-link-checks.js:60-61` (open issues, marker only), `:62-74` (comment on the open one, else create), `:75-79` (green closes with a comment), `:38-53` (the text); workflow `:16-18`, `:41` | D1–D7 | One issue titled `Live link check failed: 1 dead link`, whose body lists `- https://brainstorm.world answered 404 (information-for-agents)` and `Run: …/actions/runs/555`. With #7 open: a comment on #7. Green with #7 open: `gh issue close 7 --repo o/r --comment "Every link resolves again (live link checks: 33 passed, 0 failed, 0 skipped). Run: …"`. An unrelated #3 is never touched. With nothing checked: `Live link check could not check any link`, giving `- 33 skipped: no network (ENOTFOUND)`. |
| AC5 | `OPERATIONS.md:1048` (new paragraph), `:1050`, `:1155` (§18.2); `ledger/2026-11-16-link-check-fails-during-prod-deploy.md:6-7` | E1, E2 | Read. §15 names both suites, the switch, the weekly time, the by-hand path, the summary line and the issue. The row reads DONE, in #94. |

- [x] **No criterion is silently dropped.** Each Out-of-scope item stays out. A 5xx still fails, with no retry. No
      quarantine file. No per-PR link check. No link fixed. The H-class is untouched. The required-check setting is
      untouched.
- [x] **No behavior added that isn't in the story.** The shared helper and its `recorded` list, the `WRITE_SCOPES`
      entry, the §18.2 line and the dated note on ledger row `2026-10-04-llms-txt-egress-403-false-fail` are each a
      logged Deviation or follow from ratified plan item 2.
- **Test-deliverable carve-out: verified.** `test/live-link-checks.test.js` is blob `fc817164` both at `10b234e0`
  and at HEAD, and no other commit touches it. Phase 4 edits the two suites the plan names. It also edits one line
  of `test/workflow-hardening.test.js`, another story's guard. That line is `WRITE_SCOPES`, the extension point
  that suite (`:42-44`) and OPERATIONS.md §18.2 tell a new write scope to use, in the same pull request.
- **Test-first: verified.** At `10b234e0` the guard reads `3 passed, 18 failed`, exactly the plan's Verification
  block. A3, B1 and C6 pass by design. Each failure is the missing feature: A1, A2 and A4 see the 21 or 12 requests;
  B2 sees the egress 403 as a FAIL; C1–C4 and D1–D7 find no runner; C5 finds no workflow; E1 finds no suite named
  in §15; E2 finds the row still open. At HEAD all 21 pass, here and in CI.

### Claims checked

| Claim (source) | Holds? | Evidence |
|---|---|---|
| The owner approved the story; Bug under Standard, Architecture skipped (`3c5b1955`) | Recorded | The story's Status says Approved. The skip fits `0-intake.md` step 3 ("Skip Architecture if obvious"). Approval isn't checkable from the repo. |
| The epic lists it as story 2 and moves the two anticipated stories to 3 and 4 (`3c5b1955`) | Yes | `epics/honest-test-gate.md:31-44`. Older references still use the old numbers: non-blocking 6. |
| 18 of 21 fail until built; A3, B1, C6 pass by design (`10b234e0`) | Yes | Reviewer's run at `10b234e0`. |
| The guard never reaches the internet or GitHub (`10b234e0`) | Yes | The stub replaces `globalThis.fetch` before the suites load; the fake `gh` is first on PATH; `GH_TOKEN` and `GITHUB_TOKEN` are removed. One fall-through: non-blocking 4. |
| Registered in `test/registry.js`; the Implementer does not edit the guard (`10b234e0`) | Yes | `test/registry.js:229`; blob unchanged. |
| AC2 now says llms.txt follows the briefing's rules (`10b234e0`) | Yes | That commit's story diff. The ratification itself is recorded in the plan, not checkable. |
| The pull-request gate stops fetching the public internet (`36e123d2`) | Yes, for these checks | CI log: 33 L1 SKIP, none run. No other public-host fetch in `test/`, by grep. Not proven by a network-denied run. |
| Off unless `TAPESTRY_LIVE_LINK_CHECKS=1`; each SKIP names the switch (`36e123d2`, PR) | Yes | AC1 row. |
| Switched on, both follow the briefing's rules; new for llms-txt (`36e123d2`, PR) | Yes | AC2 row. Base `llms-txt.test.js` read a 403 as the link's status and printed no skip reason. |
| The runner prints the summary line; exits 1 on a failed link or when none could be checked (`36e123d2`, PR) | Yes | AC3 row. It also exits 2 when the run itself fails. |
| `--report` keeps one issue: opens it or comments, and a green run closes it (`36e123d2`, PR) | Yes | AC4 row. |
| Weekly (Mondays, 07:23 UTC) and by hand; `issues: write` in `WRITE_SCOPES` and §18.2 (`36e123d2`, PR) | Yes, once on `main` | Workflow `:12`, `:13`, `:18`; `workflow-hardening.test.js:47`; `OPERATIONS.md:1155`. The default branch is `main`: non-blocking 1. |
| §15 says where the checks went and how to run them (`36e123d2`, PR) | Yes | `OPERATIONS.md:1048`. |
| The guard passes 20 of 21 at the implementation commit; E2 waits for the PR number (`36e123d2`, PR) | Yes | Reviewer's run at `36e123d2`. |
| 32 passed/25 skipped; 12/15; workflow-hardening (27), ci-test-job (14), stack-free-npm-test, site-trust-signals pass (`36e123d2`, PR) | Yes | Reviewer's runs and CI. |
| "harness-lint is clean" (`36e123d2`) | Not at that commit | L10 flags `36e123d2`. Clean at HEAD, as the PR body says: non-blocking 5. |
| Every other test in both suites runs as before (PR) | Yes | Checked against the base commit. |
| The full `npm test` isn't run on this Mac; CI runs it (PR) | Yes | CI: `Overall: PASS — 7496 passed, 0 failed, 644 skipped`. |
| The briefing's check failed PR #83's CI on a deploy's 502 (PR) | Recorded | From ledger row `2026-11-16-link-check-fails-during-prod-deploy` (Actions run 43808151504). Not re-fetched. |
| Draft until its Review passes (PR) | Yes | `isDraft: true`. |
| Closes the row "fixed by #94"; dated note on the 2026-10-04 row; CHANGELOG row for L10 (`2a0f3f84`) | Yes | Row `:6-7`; the 2026-10-04 row stays OPEN for its proxy-5xx half, correctly; `CHANGELOG.md:120`. |
| Deviation: the abort timer is now cleared on every path | Yes | `liveLinkChecks.js:42-44`. After a failed fetch the helper leaves no pending timer; the old code left one per failure. |
| Deviation: a failed `gh` call ends the run red (exit 2) | Yes | A fake `gh issue create` that fails gives exit 2. |
| Deviation: the schedule is off the hour | Yes | `23 7 * * 1`. |

## ADR adherence

- [x] **No ADR. The ratified plan's five pinned items hold.** (1) The switch is on only at exactly `1`
      (`liveLinkChecks.js:20`) and each reason names it. (2) llms.txt follows the briefing's rules. (3) The runner is
      `node scripts/live-link-checks.js`; it switches the checks on itself, prints the one summary line, counts one
      per L1 test, and exits non-zero on a failure or when nothing was checked. (4) `--report` works only through
      `gh issue list|create|comment|close`, only on an open issue whose title starts `Live link check`, links the run
      from the three `GITHUB_*` variables, and never calls `gh` without the flag. (5) One workflow, found by what it
      runs.
- [x] **Layering.** One new edge: a script requires a test helper (`scripts/live-link-checks.js:23`). That fits a
      runner whose whole job is to run two suites.
- [x] **No new dependencies.** `package.json` and the lockfile are unchanged. `js-yaml` was already a dependency.

## Concept-graph integrity

- [x] Not applicable. No concept, handle or firmware definition changes, and no TA pubkey appears anywhere in the
      diff.

## The guard's teeth (mutations, run in a throwaway copy of HEAD)

38 mutations, one at a time, with the guard run after each. 35 were caught and 3 survived.

| Mutation | Caught by |
|---|---|
| Switch always on | A1 A2 A4 |
| Switch read as truthy / on when merely set | A4 / A4 |
| Switch also accepts `"true"` | **survived** |
| Switch cached at load | C1 C2 C4 D1–D5 |
| Reason omits the switch; the briefing's or llms-txt's skip prints no reason | A1 A2; A1 B1; A2 B2 |
| Egress 403 read as the link's answer | B1 B2 |
| llms-txt bypasses the helper (its old check) | A2 B2 C1–C4 |
| Any status recorded as pass; a skip recorded as pass | C2 D1 D2 D3 D6; C3 C4 D7 |
| Runner leaves the switch to its caller | C1 C2 C4 D1–D5 |
| Runner green when nothing could be checked | C3 D7 |
| Runner always exits 0 | C2 C3 D1 D2 D7 |
| Runner calls `gh` without `--report` | C1 C2 |
| Counts unique links instead of checks | C1–C4 |
| `--report` touches any open issue, marker or not | D6 |
| Red run ignores the open issue; also opens a second; also closes it | D2; D2; D2 |
| Green run leaves the issue open; comments but never closes; closes without the run link | D5; D5; D5 |
| Red issue omits the run link; omits each status; title lacks the marker | D1 D2 D7; D1 D2 D3; D1 |
| The no-link-checked issue says nothing about why | **survived** |
| Workflow also on `pull_request`; fires daily; no `issues: write`; no `npm ci`; no `--report` | C5 each |
| The test gate sets the switch | C6 |
| §15's paragraph removed; its issue sentence removed | E1; E1 |
| Ledger row reopened | E2 |
| Ledger Done line names no PR | **survived** |

The three survivors are weak assertions in the guard, not faults in the code. The code is right on each, by reading
and by direct run: non-blocking 3.

## Things tests can't catch

- [x] **GitHub's runner.** Hosted runners carry `gh`. Every flag the runner uses is in `gh` 2.86.0's own help:
      `--body-file -` reads the body from stdin for `create` and `comment`, `close --comment`, and
      `list --state open --json number,title --limit 100`, which prints a JSON array. `GH_TOKEN` is set on the one
      step that needs it. The repository has issues enabled and one open issue, so the limit of 100 doesn't bind. The
      cron is a valid weekly line. A schedule fires only on the default branch, and a `workflow_dispatch` run needs the
      file there too. The default branch is `main`: non-blocking 1.
- [x] **Nothing in the stack-free gate fetches these links now.** The two suites' only other requests go to the
      local stack, and they are GETs. The guard's children run under the stub. No other suite in `test/` fetches a
      public host (grep). The guard ran in CI on Linux and Node 22 in 1.1 s.
- [x] **Output and counts are honest.** In the gate, the 33 checks move from PASS to SKIP, are counted on each
      suite's line and in `Total skipped`, and give their reason. The runner counts from the helper's records, one per
      L1 call. Each record comes from the same result the test reads, so the summary and the test lines agree, as C1–C4
      confirm. The runner's verdict ignores the suites' other tests by design. Those tests run in every pull request's
      gate.
- [x] **The shared helper behaves exactly like the briefing's old `checkLink`.** All 15 cases match. The timer change
      is safe. `clearTimeout` now sits in `finally`, so a failed fetch no longer leaves a 15 s timer that would only
      abort a request already finished. The success path clears it at the same point as before: after a 403's body
      is read, or once a non-403's headers arrive.
- [x] **Error paths.** A failing `gh` call exits 2. A run that dies before it can count also exits 2 and opens no
      issue: non-blocking 10.
- [x] **Concurrency.** `concurrency: live-link-checks`, with no cancel, so a by-hand run can't race the scheduled
      one on the issue.
- [x] **Security.** No `${{ github.event.* }}` reaches a shell. The token gets `contents: read` plus `issues: write`
      only. One hardening point: non-blocking 9.
- [x] **No secrets, no debug output, no TODOs, no commented-out code** in the diff (scanned).

## House rules check

- [x] Concept Graph API authority: not engaged; no concept work.
- [x] No new lint, typecheck or build tooling. The new workflow runs two existing suites.
- [x] Workflow rules (§18): both actions are pinned to the same commits as `test.yml`, with release comments. The
      token is declared, the write scope is listed, and no deploy secret is read. `workflow-hardening` R1–R4 pass.
- [x] CHANGELOG touch-rule (L10): the PR's diff touches `.github/workflows` and `engineering-team/CHANGELOG.md`.
      Lint is clean at HEAD.

## Product-guide adherence

- Not applicable. No PRD.

## Findings

### Blocking

None.

### Non-blocking

1. **`.github/workflows/live-link-checks.yml:10-13`.** The schedule and the Run workflow button work only from the
   default branch, `main`. PR #94 lands on `staging`, and from that merge on no pull request's gate checks a link.
   Until the next promotion to `main`, no link is checked anywhere. `OPERATIONS.md:1048` describes the weekly run as
   already in place. Optional: say this in §15 or the PR body, as the 2026-11-14 CHANGELOG row did for its workflow.
   Once `main` has the file, start the first run by hand, so a real `gh` round trip is seen once.
2. **`scripts/live-link-checks.js:76`.** A green run closes the issue with "Every link resolves again" even when
   links were skipped. AC3 lets a run with skips be green. If last week's dead link is among this week's skips, the
   issue closes on a link nobody checked. The counts in the comment show that there were skips, but not which links.
   This follows AC4's wording. Optional: name the skipped links in the closing comment, or keep the issue open while
   a link it names was skipped.
3. **`test/live-link-checks.test.js:259`, `:488`, `:464` (the Tester's file).** A4 tries only `"0"` and `""`, so a
   switch that also accepts `"true"` survives. E2's `#\d+` is met by the story's own `#2` on the Done line, so a Done
   line that names no pull request passes. D7's `/skip/i` is met by the counts line, so an issue that never says why
   passes. Optional tightening in a later test change.
4. **`test/live-link-checks.test.js:61`.** `RUN_ENV` names the real repository, `TapestryProtocol/tapestry`. Today the
   fake `gh` is found first on PATH, so nothing reaches GitHub. But exec falls through to the next `gh` on PATH when
   the first can't run, for example in a temp folder mounted noexec. A developer's logged-in `gh` would then open
   real issues there. A placeholder repository name would make that path harmless.
5. **Commit `36e123d2`'s message** says "harness-lint is clean". At that commit, L10 flags the commit itself. The
   CHANGELOG row came one commit later, and at HEAD the PR body's claim holds. Recorded only. Nothing to change.
6. **Story numbers changed by the renumbering in `3c5b1955`.** Open rows still use the old numbers. OPEN.md rows 104,
   106 and 192 (`OPEN.md:137`, `:139`, `:241`) say "remains honest-test-gate story 3". Row 291 (`OPEN.md:323`) says
   "for story 2 (which reopens the engine)". ADR `decisions/honest-test-gate/0001-registry-runner-and-run-record.md`
   (`:125`, `:191`, `:216`, `:392`, `:440`, `:442`) and story 1 (`:87`, `:96`, `:98`) do the same. Those stories are
   now 3 and 4, and story 2 is this one. Only the epic's note records the change. Optional: a dated pointer on the
   four open rows.
7. **Statements this change leaves stale.** OPEN.md row 172 (`OPEN.md:205`) says llms-txt's L1 "checks this on every
   `npm test`" (flagged in Deviations). On `ledger/2026-10-04-llms-txt-egress-403-false-fail.md`, the Pointer
   (`:30`) names `fetchForLinkCheck`, which is now deleted. The new note there (`:28`) says the failure can't happen
   in "the pull-request gate", but the row's own failure was a cloud session's `npm test`, and the checks are now
   off by default in every run. OPERATIONS.md §3 (`:99`) says "The one non-deploy workflow is the pull-request test
   gate". That was already one workflow short at the base, and it is now two short. Optional one-line fixes.
8. **`OPERATIONS.md:1050`.** "Zero recorded-flake history" is left untrue on purpose, because of K1 and the
   launcher's destroy test. The story's Deviations section is the only place that says so. A ledger row would keep
   the owner's decision from being lost.
9. **`.github/workflows/live-link-checks.yml:32`.** `actions/checkout` leaves the job's token, which now has
   `issues: write`, in `.git/config` while `npm ci` runs every dependency's install scripts. Nothing in the job
   needs git credentials: `gh` reads `GH_TOKEN`. Optional hardening, in `workflow-hardening` #1's spirit:
   `persist-credentials: false`.
10. **`scripts/live-link-checks.js:101-104`.** A run that dies before it can count (shown here with a suite that
    throws at load) exits 2 and opens no issue. Only the red Actions run shows it, plus GitHub's notice to whoever
    last edited the cron. AC4 doesn't cover this case: its red runs are ones that counted. Optional: with `--report`,
    file that failure through the same issue.

### Harness friction

1. `scripts/harness-def-paths.txt:16-18` and `docs/harness/H2_0-baseline.md:34`, `:60` say `.github/workflows` is
   "retired with GitHub" and that "no workflow runs". The repository is back on GitHub (CHANGELOG, 2026-11-11), and
   this story adds a workflow that runs. A candidate `meta` row.
2. The numbering rule (`workflows/5-review.md`, numbering note: next number = highest filed `<n>` in the folder)
   doesn't cover stories that are anticipated but not yet filed. Their numbers were already cited in an ADR and in
   four open rows, and filing this story renumbered them (non-blocking 6). A candidate `meta` row: number past the
   anticipated stories, or leave a pointer wherever the old numbers are cited.
3. The template asks for a `gate:status` quote that this Mac can't give. That is already ledger
   `2026-11-16-gate-status-unmet-without-local-gate`. No new row.

The optional independent check before the review commit (`workflows/5-review.md`) was not applied. It is recommended
for docs-mode stories, and this is not one.

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place, and its Review line points here.
- [x] Completion detection performed. The result is reported in the chat, not here.

## Round 2

**Date:** 2026-11-16
**Delta:** `git diff 4fa7f451..HEAD`: the Tester's guard hardening `9c08fe8b`, the Implementer's fixes `0b2c436b`, three
ledger rows `12bac940`. Reviewed at `12bac940`, PR #94's head. Round 1's text above is unchanged since `4fa7f451`.
Every fix below was checked as a fresh claim, my own round-1 wording included.

### Gates (run by the Reviewer)

- The guard at HEAD: 21 passed, 0 failed, 0 skipped (1.4 s), stack-free, the switch unset. Every guard run this round
  had a recording trap first on PATH, in front of the real `gh`. The trap was never reached.
- `information-for-agents` 32/0/25 · `llms-txt` 12/0/15 · `workflow-hardening` 27/0 · `ci-test-job` 14/0 ·
  `stack-free-npm-test` 6/0/1 · `site-trust-signals` 20/0/8 · `brains-launcher-repo` 31/0/0 · `ledger-row-ids` 6/0
  (the three new ledger files).
- `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)`. L10 lands on `0b2c436b`, which updates the
  CHANGELOG row. `git diff --check` is clean for `4fa7f451..HEAD` and for `89376a4c...HEAD`.
- CI, read once (`gh pr view 94`, 16:29Z): head `12bac940`, check `stack-free` COMPLETED SUCCESS (Actions run
  43905706265, job 133433814015, 16:16:45Z–16:26:26Z). I didn't fetch the log, to keep to one read, so there is no
  Overall line to quote. `npm run gate:status` here still has no record (ledger
  `2026-11-16-gate-status-unmet-without-local-gate`).

### Each fix against its finding

| Round-1 finding | The fix | Holds? | Evidence |
|---|---|---|---|
| 1 rollout | §15 says the schedule and Run workflow work only from `main` | Yes | `OPERATIONS.md:1048`. One wording point: non-blocking R2-3. |
| 2 green close with skips | the closing comment names each link it couldn't check | Yes | P1 below. No test pins it: non-blocking R2-6. |
| 3 weak guard checks | A4 also tries `"true"` and `"yes"`; D7 wants the words; E2 wants `in #<n>` | Yes | Each round-1 survivor is now caught (A4, A4, D7, E2), and each still passes the round-1 guard. D7 and E2 each also admit one input the round-1 guard rejected: non-blocking R2-1. |
| 4 real repository in the guard | placeholder repository, an empty `GH_CONFIG_DIR`, enterprise tokens removed | Yes | My round-1 premise, tested: with a `gh` that can't run first on PATH, Node's exec runs the next `gh`. In a copy with the fake made non-runnable, the next `gh` (my trap) got 14 calls. Under the round-1 guard they carried `--repo TapestryProtocol/tapestry` and the default config folder. Under the new guard they carry `live-link-checks-fixture/no-such-repo` and an empty config folder. The "no login" half is unverified: non-blocking R2-2. |
| 5 commit message claim | "answered in the PR body" (coordinator) | Not found | The PR body read at 16:29Z doesn't mention it: non-blocking R2-5. |
| 6 renumbered stories | the epic maps old numbers to new; a ledger row | Yes | `epics/honest-test-gate.md:37-39`; ledger `2026-11-16-story-numbers-ignore-planned-stories`, which has one wrong sentence: non-blocking R2-4. |
| 7 stale statements | §3 rewritten; the October note rewritten | Yes | §3 now accounts for all eight workflows. The October note now says the checks are off by default in every `npm test` run and names the helper that replaced `fetchForLinkCheck`. The row's Pointer line still names the old function, but the dated note above it explains, as that row's earlier notes do. Row 172 is left as is, by the choice recorded in Deviations. |
| 8 flake-history claim | ledger row | Yes | `2026-11-16-ci-gate-flake-history-claim-untrue`. Its three flakes trace to PR #83's runs 43808151504 (two) and 43813017539. |
| 9 credentials during `npm ci` | `persist-credentials: false` | Yes | `.github/workflows/live-link-checks.yml:33-36`. `workflow-hardening` passes, and nothing in the job uses git credentials. |
| 10 a crash files no issue | `reportCrash`, with `--report` | Partly | Before counting it works (P3–P6). After counting it reports the wrong thing: blocking R2-1. |
| Friction 1 | ledger row | Yes | `2026-11-16-harness-docs-say-workflows-retired`. Its citations hold: `harness-def-paths.txt:16-17`, `H2_0-baseline.md:34` and `:46-48`. |
| Friction 2 | the same row as 6 | Yes | As 6. |
| Friction 3 | none needed | Yes | The existing row stands. |

### Teeth, and whether anything loosened

49 mutations in a throwaway copy of HEAD, each run against the new guard and, beside it, the round-1 guard
(`4fa7f451`'s copy):

| Group | Mutations | New guard | Round-1 guard |
|---|---|---|---|
| Round 1's set, rewritten for the new code | 35 | 34 caught, by the same tests as before | the same 34 |
| Round 1's survivors (switch accepts `"true"`; accepts `"yes"`; the no-link issue says nothing about why; the Done line names no PR) | 4 | all 4 caught (A4, A4, D7, E2) | none |
| Round 2's new code: the green close lists no skipped link; always says every link resolves; the crash isn't reported; it opens a new issue beside the open one; it's reported without `--report`; it exits 0; the checkout keeps credentials; §15 loses the default-branch sentence | 8 | none caught | none |
| Loosening probes: a no-link issue that says "No link could be checked." and never "skip"; a lower-case `**done:**` label | 2 | none caught | both (D7, E2) |

The one round-1 mutation now missed by both guards removes §15's issue sentence. The guard didn't change there:
E1 checks for the word "issue", and §15's new crash sentence also says "issue".

### The new runner paths (in the copy, with the stub and a recording fake `gh`)

- **P1, green, two links skipped, #7 open:** exit 0. `gh issue close 7` with "No link failed, and every link this run
  could check resolves again (live link checks: 31 passed, 0 failed, 2 skipped). These 2 could not be checked, …",
  then each skipped link with its suite and reason, then the run. #3 untouched.
- **P2, green, nothing skipped, #7 open:** exit 0. "Every link resolves again (…33 passed, 0 failed, 0 skipped)." and
  the run.
- **P3, a suite throws at load, `--report`, no issue open:** exit 2. Opens "Live link check could not run", giving the
  error's first line only, "No link was counted, …", and the run.
- **P4, the same with #7 open:** exit 2. One comment on #7, no create, #3 untouched.
- **P5, the same without `--report`:** exit 2, no `gh` call. Ratified item 4 holds.
- **P6, the same with `gh issue list` failing:** exit 2, and the log says "could not report that on GitHub either".
- **P7, red (one 404), `gh issue create` fails once:** exit 2. The crash reporter then opens "Live link check could not
  run" with "The live link checks could not run: Command failed: gh issue create … No link was counted, so this run
  says nothing about the links." The run had counted 32 passed and 1 failed, and the dead link appears nowhere on
  the issue.
- **P8, green, `gh issue close` fails once, #7 open:** exit 2. #7 stays open, with a comment that the checks "could not
  run" and that "No link was counted", over a run of 33 passed.

### Findings (round 2)

#### Blocking

1. **`scripts/live-link-checks.js:129-133`, with `:96-107`.** The crash reporter also catches a failure of the report
   step itself, after the run has counted. It then tells the issue that the checks could not run and that no link
   was counted. In P7 a red run's dead link never reaches the issue, and the open issue says the run says nothing
   about the links. In P8 the issue stays open with a false comment over a green run. §15 (`OPERATIONS.md:1048`) and
   the Deviations promise this report only for "a run that fails before it can count". Round 1 left these cases at a
   silent exit 2. The fix made them say something untrue on GitHub. Asked change: send only failures from before the
   count to the "could not run" report. For a failure after counting, either stop at exit 2 as before, or report what
   was counted (the counts and each dead link). Keep §15 and the Deviations in step.
2. **`test/live-link-checks.test.js` (the Tester's file).** The crash path calls `gh`, and no guard test reaches it.
   Four mutations of it survive both guards: it isn't reported at all; it opens a new issue beside the open one; it's
   reported without `--report`; it exits 0 once reported. The third breaks ratified item 4 ("Without `--report` it
   never calls `gh`, so a person's own run never touches GitHub") without any test noticing. Asked change: the
   Tester adds guard tests, failing first where they pin blocking 1's fix. Cover a run that dies before counting:
   with `--report` and no issue open (one create, titled "Live link check…", linking the run, a non-zero exit); with
   `--report` and #7 open (one comment on #7, no create); and without `--report` (no `gh` call). Cover a `gh` write
   that fails after counting (no "No link was counted" text, whatever the fix chooses). Add the rows to the plan's
   coverage map.

#### Non-blocking

- **R2-1.** "No test was removed or loosened" (`9c08fe8b`, and the plan's amendment) is not quite true. D7 no longer
  requires "skip": a no-link issue that says "No link could be checked." and never "skip" passes the new guard and
  fails the round-1 one. E2's new `i` flag admits a lower-case `**done:**` label, with the same split. Neither matters
  much. To make the claim true, keep D7's old condition beside the new one, and limit E2's case-insensitivity to its
  `in`/`PR`/`pull request` words.
- **R2-2.** "That `gh` now has no login" (the plan, `9c08fe8b`) is unverified. On macOS, `gh` can keep its token in
  the system keychain rather than in its config folder. I didn't run the real `gh` to see whether an empty
  `GH_CONFIG_DIR` hides that token. What makes a fall-through harmless is the placeholder repository, for as long as
  that owner name stays unregistered. Setting `GH_HOST` to an unresolvable host in `childEnv` would keep a
  fall-through off the network altogether.
- **R2-3.** `OPERATIONS.md:1048`, "a change to it takes effect only there": true for the schedule. But once the file
  is on `main`, a by-hand run can pick another branch, and then it runs that branch's copy of the workflow.
- **R2-4.** Ledger row `2026-11-16-story-numbers-ignore-planned-stories` says "none names the epic beside the
  number". Rows 104, 106 and 192 do ("remains honest-test-gate story 3"). What they don't use is the `#3` form that
  workflow 1 asks for.
- **R2-5.** PR #94's body, read at 16:29Z, doesn't answer non-blocking 5. It still says the guard was "written at Test
  Design and not edited since", which `9c08fe8b` made untrue. It still says "Review: to come", and it doesn't describe
  round 1's fixes. Update it before the PR is marked ready.
- **R2-6.** No test pins the green close's list of skipped links (two mutations survive). It would be cheap to add in
  the same Tester pass as blocking 2.

### Story status

The story is still `**Status:** Done` from round 1. This round was told to write only this file, so it stays.
Under this verdict, Done rests on a review whose final verdict isn't a pass. Whoever drives round 3 should decide
whether it goes back to Approved in the meantime.

### Verdict (round 2)

**CHANGES_REQUESTED**
