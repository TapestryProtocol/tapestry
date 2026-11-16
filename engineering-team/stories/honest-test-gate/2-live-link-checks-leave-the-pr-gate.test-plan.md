# Test Plan: Story 2 — The pull-request gate stops checking live links; a weekly run checks them and files an issue

**Story:** `engineering-team/stories/honest-test-gate/2-live-link-checks-leave-the-pr-gate.md`
**ADR:** none. The owner skipped Architecture on 2026-11-16: a Bug whose design the owner chose from ledger row
`2026-11-16-link-check-fails-during-prod-deploy`'s options.
**Date:** 2026-11-16

## The shape of this story, and who edits what

Like `test-suite-hermeticity` #1, much of this story's deliverable is test code: the two suites' link checks
change. So the phases split this way.

- **Phase 3 (this plan)** adds a new guard suite, `test/live-link-checks.test.js`, registered in `test/registry.js`
  after `information-for-agents.test.js`. It drives both suites, and the runner the story asks for, as child
  processes with a fetch stub and a fake `gh`, so it never reaches the internet or GitHub.
- **Phase 4 (Implementer)** edits `test/information-for-agents.test.js` and `test/llms-txt.test.js`: the switch,
  each skipped check's reason, their header notes, and llms.txt's egress-403 rule (ratification item 2). It adds
  the runner `scripts/live-link-checks.js` and one workflow under `.github/workflows/`, updates OPERATIONS.md §15,
  and closes the ledger row. **The Implementer must not modify `test/live-link-checks.test.js`.**

## For ratification at this gate

**Ratified by the owner on 2026-11-16**, with item 2's first choice: llms.txt follows the briefing's rules, and
the story's AC2 now says so.

With no ADR, these tests pin an interface. Each item is the least the acceptance criteria need.

1. **The switch** is the environment variable `TAPESTRY_LIVE_LINK_CHECKS`, on only when it is exactly `1`. A4
   checks that `0` and an empty value leave it off. Each skipped check's reason names `TAPESTRY_LIVE_LINK_CHECKS=1`.
2. **AC2 for llms.txt.** AC2 says each link check behaves as it does today, and lists the briefing's rules. llms.txt's
   check differs from them today in two ways: it reads a cloud egress gateway's own 403 as a dead link, and its
   skips give no reason. B2 holds llms.txt to the briefing's rules, which changes llms.txt's check. That also settles
   the egress half of open ledger row `2026-10-04-llms-txt-egress-403-false-fail`; the row's other half, a 5xx that
   a proxy writes, stays open. The alternative is to leave llms.txt as it is and reword AC2 to "as each does
   today", and then B2 would expect a FAIL for the egress 403 and no reason.
3. **The runner** is `node scripts/live-link-checks.js`. It runs both suites with the switch on, whatever its caller
   set. It prints one line, `live link checks: <P> passed, <F> failed, <S> skipped`, counting link checks: one per L1
   test, so a link both suites list counts twice. It exits non-zero when a check fails or when none could be
   checked.
4. **The report.** With `--report`, the runner keeps the issue through `gh issue list|create|comment|close`, the
   GitHub CLI that GitHub's hosted runners carry. It only ever touches an open issue whose title starts
   `Live link check`. It links the run from the standard `GITHUB_SERVER_URL`, `GITHUB_REPOSITORY` and
   `GITHUB_RUN_ID`. Without `--report` it never calls `gh`, so a person's own run never touches GitHub.
5. **The workflow** is one file under `.github/workflows/`. The tests find it by what it runs, not by its name.

## Amended after Review round 1 (2026-11-16)

The Tester hardened the guard on the review's non-blocking findings 3 and 4. No test was removed or loosened.
- **No real repository, ever.** `GITHUB_REPOSITORY` is now a placeholder (`live-link-checks-fixture/no-such-repo`),
  and each child's `GH_CONFIG_DIR` is an empty folder. If the fake `gh` could not run (a temp folder mounted
  noexec, say), exec would fall through to a real `gh` on PATH; that `gh` now has no login and no real repository
  to write to.
- **A4** also tries `"true"` and `"yes"`, so a switch read as truthy, or one that accepts more than `1`, fails.
- **D7** wants the words that no link could be checked, not just the counts line's "skipped".
- **E2** wants the pull request as `in #<n>` (or `PR #<n>`), so the story's own `#2` on the Done line doesn't
  count.

## Amended after Review round 2 (2026-11-16)

Round 2 found that a `gh` failure after the run has counted set off the crash report, and that no test reached the
crash path. The Tester added five tests and restored two checks round 1's amendment had loosened.
- **D8 and D9.** With `--report`, a run whose suite fails to load exits 2. It opens one issue saying the checks
  could not run, or comments that on the open #7. The stub's `LINK_STUB_CRASH` makes the named suite throw as it
  loads.
- **D10.** Without `--report`, that run exits 2 and calls no `gh` (ratified interface item 4).
- **D11.** It pins round 2's blocking 1. When `gh` fails after the run has counted, the run exits non-zero and
  posts no "could not run" report. That covers a red run whose issue create fails, and a green run whose close
  fails (the fake `gh`'s `FAKE_GH_FAIL`). It fails on the round-2 code, which does post one.
- **D12.** A green close names each link it could not check.
- **D7** again wants the word "skip" as well as the words that no link could be checked. **E2** is case-sensitive
  again, so a lower-case `**done:**` label doesn't count.
- The comment on the placeholder repository no longer claims a fallen-through `gh` has no login. A `gh` that keeps
  its token in the system keychain may still be logged in, and the placeholder is what keeps such a call harmless.

## Coverage map

| Criterion | Test | Test file | Level |
|---|---|---|---|
| AC1 | A1 the information-for-agents suite, switched off, makes no request, and each link check is SKIP with a reason naming the switch | `test/live-link-checks.test.js` | child process, stubbed fetch |
| AC1 | A2 the same for the llms-txt suite | same | same |
| AC1 | A3 switched off, every other test in both suites reports as it does switched on (passes today, by design: it guards the change) | same | same |
| AC1 | A4 `0` and an empty value leave the checks off | same | same |
| AC1 | C6 no workflow that runs on a pull request sets the switch (passes today, by design) | same | structural |
| AC2 | B1 the briefing's checks, switched on: a 2xx passes; a 502, a 404 and a site's own 403 fail, naming the link and the status; an egress 403 and a network failure are SKIP with a reason (passes today, by design: today's rules) | same | child process |
| AC2 | B2 the same rules for llms.txt's checks (fails today: the egress 403 reads as FAIL, and skips give no reason) | same | child process |
| AC3 | C1 the runner, every link 2xx: `N passed, 0 failed, 0 skipped`, exit 0, a request for every link of both suites although its caller left the switch unset, and no `gh` call | same | child process, stub and fake `gh` |
| AC3 | C2 one 404: `N−1 passed, 1 failed, 0 skipped`, a non-zero exit, and the log names the link and the status | same | same |
| AC3 | C3 every link a network failure: `0 passed, 0 failed, N skipped`, and a non-zero exit | same | same |
| AC3 | C4 two links skipped and none failing: `N−2 passed, 0 failed, 2 skipped`, and exit 0 | same | same |
| AC3, AC4 | C5 the workflow: one weekly cron, `workflow_dispatch`, no `pull_request` or `push`, `issues: write`, and `npm ci` before `scripts/live-link-checks.js --report` | same | structural (js-yaml) |
| AC4 | D1 red, no issue open: one issue, titled `Live link check…`, whose body names the link, its status and the run | same | runner and fake `gh` |
| AC4 | D2 red, #7 open: one comment on #7 with the link, its status and the run; no new issue; nothing closed | same | same |
| AC4 | D3 two links failing, a 502 and a 404: each on a line with its own status | same | same |
| AC4 | D4 green, no issue open: no create, comment or close, and exit 0 | same | same |
| AC4 | D5 green, #7 open: #7 closed, with a comment that the links resolve again, linking the run | same | same |
| AC4 | D6 only an unrelated #3 open: the run opens its own issue and leaves #3 alone | same | same |
| AC3, AC4 | D7 no link could be checked: red, and the issue says the links were skipped, linking the run | same | same |
| AC4 | D8 a suite that fails to load, with `--report`: exit 2, and one issue saying the checks could not run, linking the run | same | same, with the stub's `LINK_STUB_CRASH` |
| AC4 | D9 the same while #7 is open: a comment on #7, and no second issue | same | same |
| AC3 | D10 the same without `--report`: exit 2, and no `gh` call | same | same |
| AC4 | D11 `gh` failing after the run has counted (a red run's create, or a green run's close): a non-zero exit, and no "could not run" report | same | same, with the fake `gh`'s `FAKE_GH_FAIL` |
| AC4 | D12 green with two links skipped while #7 is open: the closing comment names both | same | runner and fake `gh` |
| AC5 | E1 OPERATIONS.md §15 names both suites, the switch, the weekly run, running by hand, and the issue | same | structural |
| AC5 | E2 the ledger row: `**Status:** DONE`, and a Done line with an ISO date and `#<n>` | same | structural |

## Edge cases

- [x] The switch set to `0`, or empty (A4).
- [x] Links that both suites list. Counts are per check (C1). The 404 and skip cases use links only the briefing
  has, so each changes exactly one check (C2, C4, D1–D3, D6).
- [x] A red run with nothing checked opens an issue that says why (D7).
- [x] An unrelated open issue is never touched (D6).
- [x] Each "nothing happened" assertion is paired with proof that the path ran. The switched-on control run shows
  the stub sees every link's request (A1, A2). Each suite run must reach its end. C1 shows the runner's requests.
- [ ] Not covered: `gh` itself failing, which the ACs don't speak to; the real GitHub API; and the real cron firing.
  Only the schedule's shape is checked.

## Test infrastructure

- Test framework: Node, in the repo's own pattern (a `tests` array, and `run()` returning the counts), registered in
  `test/registry.js`. A run's result is read per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
- Concept Graph API: not used. No stack, no firmware and no network.
- Child processes get `NODE_OPTIONS=--require=<the fetch stub>`, `PATH` with the fake `gh` first, and
  `BRAINSTORM_BASE_URL=http://127.0.0.1:9`, so the H-class skips. `GH_TOKEN` and `GITHUB_TOKEN` are removed, and
  `GITHUB_SERVER_URL`, `GITHUB_REPOSITORY` and `GITHUB_RUN_ID` are fake.
- Fixtures: none in the repo. The stub and the fake `gh` are functions in the test file, written to a temp folder
  when the suite starts and removed when it ends. `js-yaml`, already a dependency, parses the workflows.
- **For the Implementer.** The suites' fetch helpers leave their abort timer pending when a fetch fails, which holds a
  process open for 10–15 s. The guard's own child runs exit as soon as they have a result. The runner should also
  end its process once it has its verdict, or each C and D test takes about 15 s.

## How to run

Stack-free, with every endpoint at a dead port as for any single suite:

```
node -e "require('./test/live-link-checks.test.js').run().then((r) => console.log(JSON.stringify(r)))"
```

`npm test` runs it in the gate.

## Verification

The new tests fail with the current code. Confirmed on 2026-11-16 on `fix/link-checks-out-of-gate` at `3c5b1955`
(the story's commit) with this phase's files added, run stack-free with every endpoint dead, in 0.4 s:

```
live-link-checks: 3 passed, 18 failed, 0 skipped
FAIL A1  switched off, the suite must make no request beyond the loopback; it requested ["https://brainstorm.world", …]
FAIL A2  switched off, the suite must make no request beyond the loopback; it requested ["https://raw.githubusercontent.com/NosFabrica/protocols/main/CONCEPTS.md", …]
PASS A3
FAIL A4  with TAPESTRY_LIVE_LINK_CHECKS="0", the suite must make no request; it requested 21
PASS B1
FAIL B2  an egress gateway's own 403 is SKIP; https://raw.githubusercontent.com/NosFabrica/protocols/main/specs/graperank.md reported FAIL
FAIL C1–C4, D1–D7  scripts/live-link-checks.js does not exist yet (the weekly run's entry point, story AC3)
FAIL C5  exactly one workflow runs scripts/live-link-checks.js; found []
PASS C6
FAIL E1  §15 must name the briefing's suite (information-for-agents)
FAIL E2  the row says **Status:** DONE
```

Each failure is the missing feature, not a typo or a load error. A3, B1 and C6 pass by design: they hold today's
behavior while the change goes in.
