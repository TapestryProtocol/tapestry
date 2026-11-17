# Review: Story 1 — Only the main-source guard runs on `pull_request_target`

**Reviewer:** Claude (acting as Reviewer, Gate B — Light profile, Bug lane)
**Date:** 2026-11-17 (UTC; the evening of 2026-11-16 in EST)
**Diff:** `git diff ed18d8e1..8994805a` on `fix/guard-only-pull-request-target`. `ed18d8e1` is `origin/staging`.
`32d6ae8f` is the intake (book, epic, story) and `8994805a` the implementation. Reviewed at HEAD `8994805a`, working
tree clean.
**Story:** `engineering-team/stories/done/guard-only-pull-request-target/1-only-the-guard-runs-on-pull-request-target.md`
(no ADR: Design note). **Book:** `engineering-team/audits/guard-only-pull-request-target/book.md` (acceptance frame).

## Quality gates (run by reviewer, not trusted)

- [x] **Scoped gate** (the exact command in the story's Type line), run in the foreground, exit code captured by
  brace-redirect to a log, not piped: **exit 0, `TOTAL_FAIL=0`**. 48 tests, 48 passed, 0 failed:
  `workflow-hardening` 34/0 (S1–S19 with S13b, R0–R6, M1–M2, D1–D5) and `ci-test-job` 14/0. Both suites only read
  files.
- [ ] **Full `npm test`:** not run. On this machine it writes to a live local instance, and Light runs it at book
  close. `npm run gate:status` in this worktree answers "no gate run records in …/tmp/gate-runs" (exit 2): the scoped
  gate is a bare `node -e`, which writes no run record. Recorded in the form `ledger/2026-10-09-light-gate-b-no-gate-status.md`
  suggests: command, exit code, `TOTAL_FAIL`; full suite deferred to book close.
- [x] **Mutation probes** (not trusted from the commit message): 21 mutants of the rule, its tests' targets and §18.4,
  each run from a temporary dot-prefixed copy of the suite inside `test/`, deleted afterwards. 18 are caught and 3
  survive. Table under Evidence.
- [x] **harness-lint:** clean (0 violations) before this file was written, and again with it in the tree.
- [ ] _Playwright: not applicable (no UI)._ _Lint, typecheck, build: not configured._

## Spec adherence — AC verdict table

| AC | Handles | Verdict | Evidence |
|---|---|---|---|
| AC-1: any other file on the event, in every `on:` form, gives one finding that starts `<file>: EVENT:` and names where the list is | S18 | Met | All five forms (string, quoted key, list, map with and without settings), plus the rule as `allFindings` runs it. A blind rule, a dropped form, a renamed rule or a message without the list's name each fails S18. The file path in the message is not pinned (Non-blocking 3). |
| AC-2: the guard on the event, `push`, `pull_request`, and mentions in a comment, job name, script or `if:` give nothing | S17, S19 | Met | S19 asserts its fixture names the event four times, all outside `on:`. A rule that reads the raw text fails S19; one that ignores the list fails S17; one that matches `pull_request*` fails S17 and S19. |
| AC-3: the real folder is clean; the list names nothing gone or off the event; each real file off the list, put on the event in memory, is caught | R5, R6, M2 | Met | A gone entry or `test.yml` added to the list fails R6. Every one of the 7 workflows off the list is caught by M2; a blind rule fails M2. |
| AC-4: §18 states the rule, the list and how a workflow gets on it; §4 and the rulesets README point to it | D5, claims check | Present, inaccurate | Every required element is present, the pointers are in place, and the §4 → §18.4 link resolves. But §18.4's procedure misstates GitHub's guide (Blocking 1), states the story's own unknown as fact (Blocking 2), and leaves out what the policy does to the workflow it adds (Blocking 3). D5 doesn't hold the procedure at all (Non-blocking 1). |

- [x] Every AC has a passing test. None is silently dropped.
- [ ] The prose AC-4 requires is accurate (Blocking 1–3).
- [x] No behaviour beyond the story. The diff touches exactly the Design note's files: the test file, OPERATIONS.md
  (§3, §4's third bullet, §18's intro, the new §18.4) and two sentences of `.github/rulesets/README.md`. The one
  unlisted line is OPERATIONS.md's `Last updated` bump, which lint L9 and `ci-test-job` D4 read.

## Gate-A classification — Design note ratified; the lane is borderline

- **Irreversibility triggers:** none fires. No wire format or event shape, no product auth or trust default, no
  schema or firmware, no new dependency (`js-yaml` was already in use, and `package.json` is untouched), no cross-repo
  contract, no routing or middleware, no headers. The guard's path lives in the repo and in one GitHub setting, not in
  two repos.
- **The Design note matches the build:** the list, `eventsOf`, `checkEvents`, the `allFindings` wiring and `made()`'s
  `on` option (whose default reproduces the old rows exactly). Its rejected alternative is real: a separate suite would
  copy `workflowsIn` and `readWorkflow` and split the workflow rules across two files.
- **The lane:** 0-intake step 2 calls new behaviour a Feature and wrong existing behaviour a Bug. A new CI rule is new
  behaviour. The Bug reading, that the guard suite left the riskiest trigger unheld, is arguable. Not blocking: this
  review ran at full rigor. But the Bug lane has no Gate A, which is where the owner approves the approach, and the
  root of Blocking 3 is in AC-4's approach ("the same path added to the Actions policy"). For the book audit's §7.

## Adversarial probing beyond the plan

**Do the new tests fail when the rule is broken? Yes.** The commit message's claims hold exactly: made blind, S18 and
M2 fail; with the list ignored, S17 and R5 fail. Every way of breaking `eventsOf` is caught: drop the map form (S18,
R6, M2), the list form (S18), the string form (S18), or read the raw text instead of `on:` (S19, M2). So are dropping
the rule from `allFindings` (S18) and a stale list in either direction (R6). Three mutants survive. None hides a
defect in today's rule: a message that drops only the file path, a substring match on the list (Non-blocking 3), and
deleting §18.4's whole procedure (Non-blocking 1).

**Does `eventsOf` read `on:` the way GitHub does? Yes, for every file GitHub would run.** I read GitHub's published
workflow parser (`actions/languageservices`, `workflow-parser/src/model/converter/events.ts`, `convertOn`):
- `on:` is a string, a sequence, or a mapping, and nothing else.
- Each sequence item must pass `assertString("on")`.
- Each mapping key is an event name; a null value becomes `{}`, and any other value must be a mapping (a sequence for
  `schedule`).

Through js-yaml 4.1.1 (the repo's own):
- An event key with no value gives `null`, and `eventsOf` returns the key (S18's "no settings" form).
- `on:` with nothing after it gives `[]`, and GitHub's parser fails that file, since a null literal fails
  `assertString`. A file with no `on:` at all also gives `[]`, and a workflow with no trigger can't run on this one.
- A list holding a non-string, such as `on: [push, pull_request_target: {}]` or a block list whose item is
  `- pull_request_target:`, loses that item in `eventsOf`. GitHub's published parser stops at that item with an error
  (`assertString("on")`), so the file is invalid and nothing GitHub would run is missed.
- The key `on` reads as the string `on` whether bare, double- or single-quoted, as the Design note says.
- Anchors and merge keys resolve to the same events.
- A second `on` key throws, which is a READ finding, and R0 fails.
- Not checked: whether GitHub accepts the key spelled another way, such as `On:`. js-yaml keeps that as a different
  key, so the rule wouldn't see it.

**Is the guard-suite edit legitimate? Yes in substance. The clause it rewrote is not (Blocking 4).**
- The "GUARD SUITE" clause began in `workflow-hardening` #1's test plan: "is the judge of Phase 4. Phase 4 changes the
  workflow files and OPERATIONS.md and does not touch `test/`" (`stories/done/workflow-hardening/1-harden-the-github-workflows.test-plan.md:55–56`).
  It bound that story's implementer. The template's carve-out (`templates/adr.md:39`) assumes a Tester phase, and
  Light's Bug lane has none. There the implementer writes the fix and its test together, and Gate B's independent
  re-derivation, here 21 mutants, stands in for the Tester's independence.
- No existing check or assertion was weakened. The only removed lines are comments and `made()`'s row list. All 27
  earlier tests still pass.
- There is precedent: honest-test-gate #2's implementation commit `36e123d2` edited this file to add a `WRITE_SCOPES`
  entry.
- The rewrite, though, makes the clause general ("A story that changes the workflows … never this file"), and that
  forbids the allow-list edits this file and §18.4 require.

**Doc claims** (AC-4's claims-adherence check, which the story's AC → handle line assigns to this review):

| Claim (location) | Checked against | Holds? |
|---|---|---|
| "four rules that `npm test` holds … no `pull_request_target` trigger outside the main-source guard" (OPERATIONS.md:101) | `test/registry.js:161` registers the suite; the list is the guard alone (`test/workflow-hardening.test.js:61–63`) | Yes |
| §4's pointer: the test "fails any workflow but the guard that runs on the event", linking §18.4 (OPERATIONS.md:123) | R5, S18; anchor check below | Yes |
| §18's intro: four rules, the file and the rule named in each finding (OPERATIONS.md:1136) | S18's pattern `^other\.yml: EVENT: ` | Yes |
| §18.4 ¶1: only the listed files run on the event, today the guard alone (OPERATIONS.md:1204) | R5; lines 61–63 | Yes |
| ¶1: base repository's context, "a token that can write, next to a pull request's code" | The guide, § "Risks": the job gets the base repository's token and secrets, and a read/write token is "safe to grant" because "no code from the fork is executed by default" | Yes, as a loose paraphrase ("next to" means within reach) |
| ¶1: the guide "Securely using pull_request_target" warns about it; GitHub blocks it by default in public repos from 2026-12-02 | The guide's title and warning; "On December 2, 2026, GitHub will enforce the default policy …" | Yes |
| ¶1: the policy allows the event for the guard's path | `.github/rulesets/allow-pull-request-target-for-main-source-guard.json:5–6`; the ledger row's read-back | Yes |
| ¶1: "GitHub's docs don't say whether the default block still stops any other workflow once that policy exists" | The guide, § "How the default policy works" (the default is added where there is no "applicable Actions event policy"), and "About Actions policies". Neither defines when a path-scoped policy is applicable to other workflows | Yes, for the two pages read |
| ¶1: "whichever way its `on:` names it" | S18; GitHub's parser (above) | Yes |
| Step 1: "The guard qualifies because it checks out nothing and reads only `github.head_ref`" (OPERATIONS.md:1208) | `.github/workflows/guard-main-source.yml`: no checkout, and `${{ github.head_ref }}` is its only expression | Yes |
| Step 1: "A workflow that must check out or run a pull request's code follows the guide's hardening" | The guide's warning and § "Hardening" | **No** (Blocking 1) |
| Step 2: add the file name to the list, with a comment (OPERATIONS.md:1209) | Lines 61–62 | Yes, but the header forbids it (Blocking 4) |
| Step 3: the definition file and its `workflow_path` (OPERATIONS.md:1210) | JSON:5–6 | Yes |
| Step 3: "Without it, GitHub refuses to start the workflow from 2026-12-02" | ¶1 of the same section | **No** (Blocking 2) |
| Step 3: adding the path is all that is needed | JSON:12–14; OPERATIONS.md:122; README:64–66; "About Actions policies" | **No** (Blocking 3) |
| "The list and the policy name the same files … so a rename of the guard changes the list, the policy and its definition together" (OPERATIONS.md:1212) | R6 reads the folder only; no test reads the definition file | Partly (Non-blocking 2) |
| README: a rename changes this file, the live policy and the list together (`.github/rulesets/README.md:66–69`) | R6 forces the list, and the rest is the owner's step | Yes |
| README: the test "fails any workflow but the ones its `PULL_REQUEST_TARGET_FILES` lists, today the guard alone" (README:73–75) | R5; lines 61–63 | Yes |
| Story: no CHANGELOG row, because lint L10 reads no listed path here | `scripts/harness-def-paths.txt` lists `.github/workflows`, which the diff doesn't touch | Yes |
| Story: no consumers; `run()` is the only export | `git grep`: nothing requires the suite; `module.exports = { run }` at :857 | Yes |

**The §18.4 anchor resolves.** GitHub's heading ids follow `github-slugger`: lower-case, drop everything except
letters, marks, digits, connector punctuation (`_`), spaces and `-`, then spaces become `-`. Applied to the heading's
text, "18.4. pull_request_target: the main-source guard only", that gives
`184-pull_request_target-the-main-source-guard-only`, which is the link at OPERATIONS.md:123. The same rule, run over
all 84 headings, resolves every one of the file's 22 distinct in-page links. That includes the em-dash
double-hyphens of §12, §13, §16 and §17, which are specific to this slugger. No link in the repo depends on keeping
`_`, so that one point rests on the rule itself (`_` is connector punctuation, which the slugger keeps). §18's own
heading still names three topics, and is rightly left alone: three links use its anchor.

**Where the check binds.** Per the guide, a `pull_request_target` workflow is "taken from the base repository's
default branch", so a new one does nothing until it is on `main`. Every PR into `main` needs `stack-free` (§4), which
runs this suite (registry:161). So a direct push to `staging`, which `staging` allows, can't make such a workflow run
before the check has run. That supports the book's "Done" bullet.

**Collateral outside the diff: none found.** `allFindings` has no caller outside this file. S15 and S16 still see
only their own rules, since `made()`'s default is `push`. No live doc still counts three workflow rules: the remaining
mentions of this suite's count are dated CHANGELOG rows and the closed `workflow-hardening` book.

## Evidence

| # | Check | How | Result |
|---|---|---|---|
| E1 | Scoped gate | The story's command, `{ …; echo "EXIT=$?"; } > log 2>&1`, foreground | 48 passed, 0 failed; `TOTAL_FAIL=0`; `EXIT=0` |
| E2 | Run record | `npm run gate:status` | "no gate run records in …/tmp/gate-runs", exit 2 |
| E3 | Mutants | A copy at `test/.mut-workflow-hardening.test.js`, one mutation per run, deleted afterwards (`git status` clean) | Table below |
| E4 | YAML shapes | 13 `on:` shapes through js-yaml 4.1.1 and `eventsOf` | As in "Does `eventsOf` read …" |
| E5 | GitHub's parser | `actions/languageservices` `events.ts`, `convertOn` (lines 23–68), read-only fetch | Three forms; strings only in a list; null event value → `{}` |
| E6 | GitHub's docs | "Securely using pull_request_target" and "About Actions policies", read-only fetches | Quoted in the claims table and the findings |
| E7 | Anchor | The slugger rule over OPERATIONS.md's headings and in-page links | 22 of 22 resolve, the new link included |
| E8 | Nothing weakened | `git diff 32d6ae8f..8994805a -- test/workflow-hardening.test.js`, removed lines | Comments, the `allFindings` doc comment, `made()`'s rows |
| E9 | Consumers, registry | `git grep`; `test/registry.js` | No requirer; registered at :161 |
| E10 | Policy-definition readers | `git grep allow-pull-request-target-for-main-source-guard -- test scripts .claude` | Only a comment in the suite |
| E11 | Blast radius | `git diff --stat` against the Design note | Matches, plus the `Last updated` bump |
| E12 | harness-lint | `bash scripts/harness-lint.sh`, before and after this file | Clean (0 violations) both times |
| E13 | Verdict parse | `awk -f scripts/lib/review-verdict.awk` on this file | CR |

Mutants (each row lists the tests that failed; 34 pass on the unmutated copy):

| Mutant | Caught by |
|---|---|
| `checkEvents` returns `[]` | S18, M2 |
| the list is ignored | S17, R5 |
| `eventsOf` drops the map form / the list form / the string form | S18, R6, M2 / S18 / S18 |
| the rule reads the raw text, not `on:` | S19, M2 |
| `allFindings` leaves the rule out | S18 |
| `startsWith('pull_request')` instead of the exact event | S17, S19, R5 |
| the rule is named `EVENTS` | S18, M2 |
| the message drops the list's name | S18 |
| the list names `gone.yml` / `test.yml` | R6 / R6 |
| the list is emptied | S17, R5 |
| §18.4 loses the event from its heading / the guide's title / "Actions policy" / the list's name / the guard's file name | D5 each time |
| the message drops only "in test/workflow-hardening.test.js" | survives |
| the list is matched by substring | survives |
| §18.4 loses its whole "To add a workflow to the list" procedure | survives |

## Concept-graph integrity
- [x] No concepts, handles or definitions are touched. Nothing to reinstall, and no new code needs `/summaries`.

## Things tests can't catch
- [x] No secrets, debug logging, `.only`/`.skip`, TODOs or commented-out code in the diff.
- [x] No concurrency: the suite reads files synchronously, and S16's temporary directory is the existing test's own.
- [x] Error paths: a workflow the guard can't read gives `[]` from this rule, and READ reports it, as for the other
  checkers. An `on:` GitHub would reject gives no EVENT finding, which matches GitHub. Gaps in the guard's reach are
  named in the story's Not covered: a reusable workflow called from the guard, and `workflow_run`.
- [x] Security: the rule is itself the control. Its bypasses were probed above. Its weak points are in the prose that
  tells the next person how to add a workflow (Blocking 1–3).

## House rules check
- [x] No new lint, typecheck or build tooling, and no new dependency.
- [x] Concept Graph API authority: not involved. No TA pubkey anywhere in the diff.

## Product-guide adherence
- N/A: no PRD. The book is an acceptance frame.

## Findings

### Blocking
1. **OPERATIONS.md:1208** (§18.4, step 1): "A workflow that must check out or run a pull request's code follows the
   guide's hardening."
   - This misstates GitHub's guide in the unsafe direction.
   - The guide's warning says workflows on this event "should not check out, build, or run code from an untrusted pull
     request with access to repository secrets or a privileged GITHUB_TOKEN". Its § "Deciding whether to use
     pull_request_target" says checked-out code must be "only ever inspected as data and never executed".
   - Its § "Hardening" says its controls apply "whether or not your workflow checks out pull request code".
   - So running a pull request's code is the pwn-request pattern the guide exists to stop, not a case that hardening
     makes acceptable. Hardening is for every workflow on the list, the guard included.
   - Asked change: say what the guide says. A workflow on this event never runs a pull request's code, and reads any it
     checks out as data only. The guide's hardening applies to every workflow on the list.
2. **OPERATIONS.md:1210** (§18.4, step 3): "Without it, GitHub refuses to start the workflow from 2026-12-02."
   - This states as fact the one thing this story is built around not knowing.
   - Saying it is unknown: ¶1 of the same section (OPERATIONS.md:1204), §4's third bullet (OPERATIONS.md:123), the
     rulesets README (`.github/rulesets/README.md:71–72`), the list's own comment (`test/workflow-hardening.test.js:57–58`)
     and the story's Not covered ("That is the unknown the story works around", story:96–97). Each says GitHub's docs
     don't say whether the default block covers a workflow the policy doesn't name.
   - Neither GitHub page I read settles it.
   - Asked change: state it as the risk the step guards against. For example: GitHub may refuse to start it from
     2026-12-02, because its docs don't say whether the default block covers a workflow this policy doesn't name.
3. **OPERATIONS.md:1210** (§18.4, step 3) and **`test/workflow-hardening.test.js:58–60`**: adding a workflow's path to
   this policy confines that workflow to `pull_request_target`, and neither place says so.
   - The policy's only rule is `restrict_action_events`, with `allowed_events: ["pull_request_target"]`
     (`.github/rulesets/allow-pull-request-target-for-main-source-guard.json:12–14`).
   - The repo's own docs describe it as listing "the only events a workflow it covers may run on" (OPERATIONS.md:122,
     `.github/rulesets/README.md:64`). GitHub's "About Actions policies" shows the refusal that follows: "Event
     'workflow_dispatch' is not allowed to trigger Actions workflows."
   - So a second workflow that also runs on `workflow_dispatch`, `push` or `schedule` would lose those runs the moment
     step 3 is done.
   - This is a premise gap in AC-4 itself ("the same path added to the Actions policy"). §4 and the README had left it
     open as "its own decision about the policy".
   - Asked change: say in step 3, and in the list's comment, that this policy then allows the workflow only the events
     its rule lists, today `pull_request_target` alone. A workflow that runs on other events too needs them allowed, or
     a policy of its own, which is the owner's decision.
4. **`test/workflow-hardening.test.js:31–33`** (the rewritten GUARD SUITE clause): "A story that changes the workflows
   changes them and OPERATIONS.md, never this file."
   - It contradicts three instructions in this same diff and the file: `WRITE_SCOPES`' comment ("A workflow that needs
     to write something adds its scope here in the same change", :48–49), the new list's comment ("is added here and to
     the policy in the same change", :58–59), and §18.4 step 2 (OPERATIONS.md:1209).
   - It would also have forbidden `36e123d2`, which added `live-link-checks.yml` to `WRITE_SCOPES` in honest-test-gate
     #2's implementation commit.
   - The next story that adds a `pull_request_target` workflow is told both to edit this file and never to edit it.
   - The fix is to this comment only. Asked change: carve the allow lists out. For example: "… never this file, except
     to add its own entry to `WRITE_SCOPES` or `PULL_REQUEST_TARGET_FILES`." Optionally, also say that a story whose
     deliverable is a new rule leaves the existing checks and their tests as they are.

On the next round, each changed sentence is a fresh claim. Re-derive it from the guide and the policy file, including
any wording suggested here (`roles/reviewer.md` step 10).

### Non-blocking
1. **`test/workflow-hardening.test.js:832–839`** (D5) doesn't hold AC-4's "how a workflow gets on it".
   - A scratch copy of OPERATIONS.md with the whole "To add a workflow to the list" block deleted leaves D5 green.
     ¶1 (OPERATIONS.md:1204) already holds every phrase D5 looks for.
   - D5's own failure message promises more than it checks.
   - Optional: pin the procedure, for example by checking that §18.4 names the policy's definition file or
     `workflow_path`. Today both appear only in step 3.
2. **OPERATIONS.md:1212**, and the story's sentinel line (story:88–89, "That keeps the list and the Actions policy's
   path from drifting apart silently"): both claim more than R6 does.
   - R6 ties the list to the folder. No test reads `.github/rulesets/allow-pull-request-target-for-main-source-guard.json`.
   - So a rename that updates the folder and the list, but not the definition, passes.
   - Optional: a check that each listed file's `.github/workflows/<name>` is in the definition's
     `conditions.workflow_path.include`. Checking a subset keeps the rename window, when both paths are listed, green.
     Otherwise, say that the test forces the list and §4 asks for the rest.
3. **Two mutants of the rule survive every test** (S17 and S18, `test/workflow-hardening.test.js:620–640`, are where
   they would be caught).
   - S18's pattern pins the list's name but not "in test/workflow-hardening.test.js", so AC-1's "where the allowed files
     are listed" is half pinned.
   - Nothing pins that the list matches whole file names.
   - Optional: extend S18's pattern to the path, and add a fixture such as `old-guard-main-source.yml` on the event that
     must be caught.
4. **`test/workflow-hardening.test.js:4–5`** cite `engineering-team/stories/workflow-hardening/…`, which is now under
   `stories/done/`. Line 7 will go stale the same way at this epic's close-out.
   - This was there before the diff. It is a live case of `ledger/2026-09-20-done-move-breaks-inbound-refs.md` (OPEN),
     not a new row.

### Harness friction
1. No new rows. Two known items recurred:
   - The scoped gate leaves no run record for `gate:status` to read (`ledger/2026-10-09-light-gate-b-no-gate-status.md`,
     OPEN). It is a bare `node -e` because `npm test -- <files>` doesn't scope here (OPEN.md row 181). I recorded it in
     that row's suggested form.
   - The template's closing section after `## Verdict` would make this review parse as passing (OPEN.md row 28). I put
     the close-out above the verdict, and checked the parse with `scripts/lib/review-verdict.awk`.

## Close-out
- Story `**Status:**` is unchanged (In Progress). The Done flip waits for a round that clears the four blocking items.
- Completion detection is reported in the chat, not in this file.

## Verdict
**CHANGES_REQUESTED**

## Round 2

**Date:** 2026-11-17 (UTC)
**Diff:** `git show 925d5677`, the fixes on top of this review's round 1 commit `15a64cdd`. Reviewed at HEAD
`925d5677`, working tree clean. `origin/staging` is now 17 commits past `ed18d8e1`, and none of those commits touches a
file this branch changes: `git diff --stat ed18d8e1 origin/staging` on those paths is empty, so the merge has nothing
to collide on.

### Quality gates (re-run, not trusted)

- [x] **Scoped gate**, with round 1's command and capture: **exit 0, `TOTAL_FAIL=0`**. 50 passed, 0 failed:
  `workflow-hardening` 36/0 (round 1's 34, plus S20 and R7) and `ci-test-job` 14/0. This matches the commit message.
- [ ] **Full `npm test`:** not run, for round 1's reason. `npm run gate:status` again answers "no gate run records in
  …/tmp/gate-runs" (exit 2).
- [x] **Mutation probes:** 41 mutants. Round 1's 21 are all caught now, its 3 survivors included. 20 new ones target
  the helpers, R7, the policy definition and §18.4's steps. Overall, 37 are caught and 4 survive. Table below.
- [x] **harness-lint:** clean on the fix commit, and again with this section and the story's Done flip in the tree.

### AC verdict table (the ACs as amended at round 1)

| AC | Handles | Verdict | Evidence |
|---|---|---|---|
| AC-1 | S18 | Met | S18 now pins the finding's whole pointer, including the file path, and the list matching whole file names (`old-guard-main-source.yml`). Round 1's two surviving mutants of the rule now fail S18. |
| AC-2 | S17, S19 | Met | Unchanged. Its mutants are caught as in round 1. |
| AC-3, amended to add the definition clause | R5, R6, R7, S20, M2 | Met | R7 is green on the real definition. Of 9 changes to the definition, R7 catches 7. The other 2 (`disabled`, and a glob `exclude`) are Non-blocking R2-1. |
| AC-4, amended to "an Actions policy that names its path and allows it the event" | D5, claims check | Met | §18.4 re-derived claim by claim below. D5 now pins the procedure; step 1 alone is not pinned (Non-blocking R2-2). |

The ACs are the implementer's amended text. Each amendment carries a note naming its round 1 source (story:44 and
:48–50). The owner's Gate B verdict ratifies them as amended.

### Round 1's items, re-derived as fresh claims

| Item | What changed | Re-derived against | Resolved |
|---|---|---|---|
| Blocking 1 | Step 1 (OPERATIONS.md:1208) | The guide's warning, its "only ever inspected as data and never executed" rule, and the four § "Hardening" controls; the guard's file | Yes |
| Blocking 2 | Step 3 (OPERATIONS.md:1210): GitHub "may refuse", "since its docs don't say" | §18.4 ¶1, §4's third bullet, the README (:72), the guide's § "How the default policy works" | Yes |
| Blocking 3 | Step 3, and the list's comment (`test/workflow-hardening.test.js:61–66`); AC-4 amended | The definition's rule (JSON:12–14), OPERATIONS.md:122, README:65, "About Actions policies" | Yes |
| Blocking 4 | GUARD SUITE (`test/workflow-hardening.test.js:31–35`) | `WRITE_SCOPES`' comment (:50–52), the list's comment, §18.4 step 2 | Yes: the three now agree |
| Non-blocking 1 | D5 pins "To add a workflow to the list", `workflow_path` and `.github/rulesets/` (:899–900) | Deleting the whole procedure, or step 3 alone, now fails D5 | Yes, though step 1 alone isn't pinned (R2-2) |
| Non-blocking 2 | R7, `policyDefinitionsIn`, `allowsPullRequestTarget` and S20; §18.4's last paragraph and the README reworded; AC-3 amended | 9 changes to the definition and 9 mutants of the helpers and R7 | Yes, with two blind spots (R2-1) |
| Non-blocking 3 | S18 (:661–676) | Round 1's two surviving mutants of the rule | Yes |
| Non-blocking 4 | The header's paths, now under `stories/done/` (:4–5) | Both files exist there | Yes |

### New sentences, re-derived

| Claim (location) | Checked against | Holds? |
|---|---|---|
| Step 1: a workflow on the event "never runs a pull request's code, and treats any it checks out as data only" | The guide: checked-out code is "only ever inspected as data and never executed" | Yes |
| Step 1: the hardening applies to every workflow on the list, "whether or not it checks out code" | The guide's § "Hardening": "These apply whether or not your workflow checks out pull request code" | Yes |
| Step 1: the four controls (token and secrets, caches filled from trusted events, isolated runners, general protections such as against command injection) | The guide's four § "Hardening" items, in that order | Yes |
| Step 1: the guard "checks out nothing, its token only reads, it uses no secret and no cache, it runs on a GitHub-hosted runner, and it passes `github.head_ref` to its script through `env:`" | `.github/workflows/guard-main-source.yml`: no checkout, cache or `secrets.`; `permissions: contents: read` (:28–29); `runs-on: ubuntu-latest`; `HEAD_REF` set under `env:` and read as `$HEAD_REF` | Yes. "Meets it" holds in substance: strictly, a job that reads nothing needs only `permissions: {}`, but in a public repository `contents: read` grants only what is public. The guard is outside this story's files. |
| Step 3: give the workflow a policy that names its path in `workflow_path` and allows the event, with its definition in `.github/rulesets/`, and the owner sets the live one to match | R7; the README's recreate commands | Yes |
| Step 3: the existing policy allows `pull_request_target` "and no other event", so a path there suits only a workflow on that event alone; any other needs its events allowed, or a policy of its own | JSON:12–14; §4 ("and on no other event"); "About Actions policies", where event rules control "which events are permitted" | Yes |
| Step 3: without a covering policy GitHub "may refuse" the workflow, "since its docs don't say" | ¶1 of the same section; the guide | Yes, and it now agrees with ¶1 |
| Last paragraph (OPERATIONS.md:1212): the test fails on a listed file that is gone, off the event, or not named (by its exact path, with the event allowed) in a definition, "so a rename of the guard changes the list and the definition together" | R6 and R7; the mutants | Yes. R7 checks one direction, each listed file in a definition, which keeps the README's rename window green (both paths in `include`) |
| README: "Nothing applies them" and "One test reads them" (R7) (README:5–8) | `git grep rulesets -- test scripts .claude bin src lib`: only R7 reads the folder; the `ci-test-job` match is message text | Yes |
| The list's comment (:61–66) | §18.4 steps 2 and 3 | Yes |
| GUARD SUITE: a story that changes the workflows touches this file "only to add its own entry to `WRITE_SCOPES` or `PULL_REQUEST_TARGET_FILES`" and never loosens a checker; a new rule "leaves the existing checks and their tests as they are" | `WRITE_SCOPES`' comment; §18.4 step 2; this round changes only this story's own tests (S18, D5) and adds S20 and R7 | Yes |
| `policyDefinitionsIn`: the rulesets' own files have no event rule | Their rule types: `pull_request` and `required_status_checks`; `deletion` and `non_fast_forward` | Yes |
| `allowsPullRequestTarget` and S20: "An empty include means every workflow to GitHub" | GitHub's REST reference for Actions policies: `include` is an "Array of workflow file paths or glob patterns to include. An empty array includes all workflows not matched by an excluded pattern" | Yes |
| `allowsPullRequestTarget`: a definition counts when it "names the path itself in workflow_path's include, doesn't exclude it" | The same reference: `exclude` takes glob patterns too, and `enforcement` can be `disabled` | Partly (R2-1) |

### Evidence (round 2)

| # | Check | How | Result |
|---|---|---|---|
| R2-E1 | Scoped gate | Round 1's command and capture | 50 passed, 0 failed; `TOTAL_FAIL=0`; `EXIT=0` |
| R2-E2 | Run record | `npm run gate:status` | No record, exit 2 |
| R2-E3 | Mutants | One temporary dot-prefixed copy in `test/`; definition and OPERATIONS.md variants as scratch copies outside the repo; all deleted; `git status` clean afterwards | 41 run: 37 caught, 4 survive |
| R2-E4 | GitHub's REST reference | "REST API endpoints for GitHub Actions policies", one read-only fetch | `include` and `exclude` take glob patterns; an empty `include` covers every workflow; `~ALL`; omitting `workflow_path` targets all; `enforcement` is `disabled`, `active` or `evaluate` |
| R2-E5 | The guide | Round 1's copy, fetched earlier today, re-read locally | Step 1's sentences, as above |
| R2-E6 | The guard's properties | The workflow file | As above |
| R2-E7 | Readers of `.github/rulesets/` | `git grep` | R7 only |
| R2-E8 | Staging collisions | `git diff --stat ed18d8e1 origin/staging` on this branch's paths | Empty |
| R2-E9 | Old wording left anywhere | `git grep` for round 1's flagged phrases, outside reviews | None |
| R2-E10 | harness-lint | Before and after this section | Clean (0 violations) both times |
| R2-E11 | Verdict parse | `awk -f scripts/lib/review-verdict.awk` on this file | PASS |

Round 2's new mutants (36 tests pass on the unmutated copy; each row lists the tests that failed):

| Mutant | Caught by |
|---|---|
| `allowsPullRequestTarget` always true / always false | S20 / S20, R7 |
| `include` not checked / an empty `include` counted as every workflow | S20 / S20 |
| `exclude` ignored / the allowed event not checked | S20 / S20 |
| `policyDefinitionsIn` returns `[]` | R7 |
| `policyDefinitionsIn` keeps every JSON file | survives, with no effect: the rulesets' files name no workflow path |
| R7 looks up the bare file name instead of the path | R7 |
| the definition names another file / allows only `push` / excludes the guard's path / has an empty `include` / has `~ALL` / has a glob `include` / is deleted | R7 each time |
| the definition's `enforcement` is `disabled` | survives |
| the definition excludes the guard by a glob (`.github/workflows/guard-*.yml`) | survives |
| §18.4 loses step 3 | D5 |
| §18.4 loses step 1 | survives |

Round 1's 21 mutants, re-run, are all caught. A list naming `gone.yml` or `test.yml` now fails both R6 and R7.

### Findings (round 2)

#### Blocking
None.

#### Non-blocking
1. (R2-1) **R7 doesn't read two parts of a definition that GitHub does** (`allowsPullRequestTarget`,
   `test/workflow-hardening.test.js:383–395`).
   - It ignores `enforcement`, so a definition set to `disabled` still counts.
   - It matches `exclude` by exact path, while GitHub's reference says `exclude` takes glob patterns, so a definition
     whose `exclude` globs the guard out still counts.
   - Both survived as mutants. The helper's comment ("lets the workflow at this path run", "doesn't exclude it")
     claims more than it checks. The docs' wording ("names, by its exact path, with `pull_request_target` allowed")
     still holds.
   - Optional: count only `enforcement: "active"` definitions, and don't count one whose `exclude` has any entry
     that isn't a plain path.
2. (R2-2) **No test holds step 1**, which was round 1's Blocking 1 fix. Deleting it leaves D5 green.
   - Optional: D5 also checks that §18.4 says a workflow on the event never runs a pull request's code.

#### Harness friction
None new. Round 1's two known items still apply.

### Close-out (left uncommitted, as asked)
- [x] Story `**Status:**` set to `Done` in place.
- [x] Completion detection: reported in the chat, not in this file.

### Verdict (round 2)
**PASS**
