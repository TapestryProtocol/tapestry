# Review: doc lane — `main-source-guard` keeps `pull_request_target` under an Actions policy

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-16 (UTC; the review ended at about 21:30Z)
**Diff:** `git diff e8347ee2..3c874499` on `docs/main-guard-actions-policy`: one commit, `3c874499`, over `origin/staging` at `e8347ee2` (the merge of PR #97). Seven files, 60 insertions and 7 deletions. The branch has no upstream, so there is no PR and no CI run to read.
**Lane:** doc lane (`engineering-team/workflows/0-intake.md` step 3, Standard: Implementer, then Reviewer, `:27`). The review is non-numbered, with no story, no test plan and no book (`:31`, `:39`). This file is the lane's record. Template: the docs-mode variant in `templates/review-checklist.md` (`:20`).
**Spec:** the brief's five-item acceptance frame (checked item by item under "Claims adherence"), and the ledger row it answers, `2026-11-16-main-guard-blocked-by-github-policy`: its fix options and its docs ask (`:20–25` at `e8347ee2`).
**Filed under:** harness-self-improvement. The change touches two harness-definition paths, `.claude/skills` and `.github/workflows` (`scripts/harness-def-paths.txt:33`, `:45`), and no active epic owns `.github/` or its settings. `workflow-hardening`, which last changed the workflows, is retired under `reviews/done/`, and the rulesets' own commit (`c8b24d87`) had no epic. The closest precedent is filed here: `skills-repo-nousclawds4-2026-10-28.md`, which changed the same skill, OPERATIONS.md and the CHANGELOG. So are 13 other doc-lane reviews (friction 3).
**Files:** `.github/rulesets/README.md` (+23 −5), `.github/rulesets/allow-pull-request-target-for-main-source-guard.json` (new, 18 lines), `OPERATIONS.md` (+9 −2: `:6`, `:107`, `:119–124`), `.claude/skills/cycle-prod/SKILL.md` (+1: `:152`), `.github/workflows/guard-main-source.yml` (+6, all comment: `:17–22`), `engineering-team/CHANGELOG.md` (+1: `:121`), `ledger/2026-11-16-main-guard-blocked-by-github-policy.md` (+2: `:27`).

## Quality gates (run by reviewer, not trusted)

- [x] `bash scripts/harness-lint.sh` at `3c874499`: last line `harness-lint: clean (0 violations)`, exit 0. L10 judges `3c874499` itself, the newest non-merge commit on a listed path, and that commit touches `engineering-team/CHANGELOG.md`. L9: OPERATIONS.md's `**Last updated:** 2026-11-16` matches its last commit date. L15 passes the edited row. Run again with this review in place: still clean, exit 0 (friction 1).
- [x] **The two file-reading suites, through the brief's runner:** `test/workflow-hardening.test.js` gave `{"pass":27,"fail":0}` and `test/ci-test-job.test.js` gave `{"pass":14,"fail":0}`, exit 0. `workflow-hardening` holds OPERATIONS.md §18's three rules for every workflow, the edited guard included. The guard has no `uses:`, has `permissions: contents: read`, and reads no deploy secret.
- [x] **Suites read but not run,** because they also reach the network or the local API:
  - `test/safe-to-merge-check.test.js` C5 asserts seven things about `cycle-prod/SKILL.md`. A script re-ran all seven on the HEAD file, and all hold. The new line adds no `gh pr merge`, no standalone 45 or 60, and no `bufferMinutes`, and it sits after step 5.
  - `test/operational-direction.test.js` asks only that the Director's role still name `/cycle-prod` (`:1236`).
  - `test/live-link-checks.test.js` C6 reads every workflow that runs on a pull-request event. The guard's change is all comment (claim 21), so C6 can't move.
- [x] **Scripted checks,** in the session scratchpad, outside the repo:
  - The guard parses to the same document at base and HEAD.
  - The policy file was checked field by field against the fetched REST body schema (claim 6).
  - `cycle-prod/SKILL.md` gains exactly one line.
- [x] `git diff --check e8347ee2..3c874499`: no output, exit 0. The four relative links in §4 (`:107–124`) all resolve.
- [x] **Sources,** fetched on 2026-11-16 through docs.github.com's article API (markdown bodies): the four in the brief, plus "Events that trigger workflows" (the `pull_request_target` and `workflow_run` sections) and "API Versions". Three docs searches, one on how the default policy treats workflows outside a policy's path and two on how a policy targets workflows, found nothing more (B1, claim 4).
- [x] **GitHub API:** four reads, one at a time, no writes.
  - (1) `repos/TapestryProtocol/tapestry`: `visibility: public`, `default_branch: main`.
  - (2) `repos/TapestryProtocol/tapestry/rules/branches/main`: ruleset 27080672 (`pull_request`, and `required_status_checks` with `stack-free` and `main-source-guard`) and ruleset 27080689 (`deletion`, `non_fast_forward`).
  - (3) run 43905341086: event `pull_request_target`, conclusion `startup_failure`, path `.github/workflows/guard-main-source.yml`, created 16:14:47Z, attempt 1.
  - (4) `gh pr view 96`: created 16:14:41Z, merged 18:11:23Z.
  - The live Actions policy wasn't read: the brief says this token gets a 404 there. Whether the owner has created it yet isn't assessed here.
- [ ] `npm test`: **not run, on purpose.** On this Mac the full suite writes to a live instance. `npm run gate:status` (`node test/gate-status.js`) prints `no gate run records in <worktree>/tmp/gate-runs` and exits 2, so there is no gate line to quote.
- [ ] CI: none to read (no upstream, no PR).
- [ ] Playwright: not applicable (no UI).
- [ ] _Lint / typecheck / build not configured: skipped._
- [ ] Independent checker (`workflows/5-review.md`, "Optional: an independent check before the commit"): not applied, because this session can't start one.
- [x] Nothing else written to the repo. `git status --porcelain --ignored=matching` showed only `!! node_modules/` before this file, and HEAD is still `3c874499`.

## Claims adherence (doc-lane variant)

**The frame, item by item.**

1. A recreatable record of the policy (its definition and the commands to create or change it), beside the rulesets: **met** (claims 6–12; N3).
2. §4 and `/cycle-prod` say what a startup failure means, and that closing and reopening the PR runs the guard again, since the run can't be re-run: **met** (claims 14 and 16–19, 24).
3. Every claim about GitHub's behaviour, the policy and the API is accurate and consistent: **not met** (claim 3, B1). Everything else holds.
4. The ledger row records the choice and stays OPEN, to close once a real PR has run the guard with the policy in place: the record and the status are **met**. The close condition as written doesn't verify the fix (claim 22, B2).
5. Harness rules (L10 CHANGELOG row, L9 date, lint clean, §18 for the edited workflow): **met** (claim 23; Gates).

"Where" codes:

- R: `.github/rulesets/README.md`
- J: the policy JSON
- O: `OPERATIONS.md`
- S: `.claude/skills/cycle-prod/SKILL.md`
- G: `.github/workflows/guard-main-source.yml`
- C: the CHANGELOG row
- L: the ledger row
- M: the commit message

| # | Claim | Where | Evidence | Holds? |
|---|---|---|---|---|
| 1 | From 2026-12-02 GitHub blocks `pull_request_target` in a public repository unless an applicable Actions policy allows it | G:18–19, O:119, R:13, C | The guide, § "How the default policy works": the default is added "For public repositories that do not already have an applicable Actions event policy", and enforced "On December 2, 2026 … for affected repositories that were using the default `pull_request_target` policy before general availability". § "Reviewing the impact before enforcement": "create or update an applicable Actions event policy that explicitly allows `pull_request_target`". The repo is public (call 1), and its brownout (L `:14`) shows it is an affected repository | Yes |
| 2 | Without the policy the guard never runs, so every PR into `main` stays `BLOCKED`. `main`'s ruleset requires the check, with no bypass | O:117–119, R:12–13, C, G:21–22 | Call 2: ruleset 27080672 requires `stack-free` and `main-source-guard`. That answer doesn't carry bypass actors; `main-requires-pr-before-merging.json:37` has `[]` | Yes. The bypass part is from the file only |
| 3 | The policy lets the guard, "and no other workflow", run on `pull_request_target` | R:13, O:119 | B1 | **No** |
| 4 | The policy finds the guard by its path, so a move or rename has to change the policy | R:54–55, O:121, G:20–22, C, L:27 | J:5–8 includes `.github/workflows/guard-main-source.yml`. Run 43905341086's `path` is the same string (call 3). GitHub's own error example names a workflow the same way: "Workflow file: '.github/workflows/0-welcome.yml'" (About Actions policies). The REST reference doesn't say what form a pattern takes, so only B2's evidence would prove the form | Yes. The order of a rename: N2 |
| 5 | The rule lists the only events a workflow it covers may run on. With no path it would cover every workflow, and the deploys, the test gate and the weekly link checks would stop | R:53–54, O:122 | About Actions policies: "an allowlist that controls … which events are permitted to run them". REST, create: "Omitting workflow_path targets all workflows". The triggers: the four deploys run on `push`, `test.yml` on `pull_request`, and `live-link-checks.yml` on `schedule` and `workflow_dispatch`. A `grep` of `.github/workflows/` finds `pull_request_target` only in the guard | Yes. The list leaves one out: N1 |
| 6 | The definition's shape | J, R:22–23 | REST, "Create a repository Actions policy", body schema: <br>• `name` and `enforcement` are required, with `enforcement` one of `disabled`, `active`, `evaluate`. <br>• `conditions` is empty or holds only `workflow_path`, whose `include` and `exclude` are both required arrays, with at least one pattern. <br>• `restrict_action_events` requires `allowed_events`, from a list of 36 values that includes `pull_request_target`. <br>A script checked every field against the fetched page. All match, and the file has no field the body doesn't take. `active` is the only setting that works here, since evaluate needs Enterprise (the REST page and the how-to) | Yes |
| 7 | API version `2026-03-10` | R:22, :47, :50 | The REST page's note: "plus `X-GitHub-Api-Version: 2026-03-10`". The API Versions page: "released on Tue, 10 Mar 2026" | Yes |
| 8 | To create it: `gh api -X POST repos/TapestryProtocol/tapestry/actions/policies … --input <file>` | R:47 | REST: `POST /repos/{owner}/{repo}/actions/policies` | Yes |
| 9 | To find its id: `gh api repos/…/actions/policies … --jq '.policies[] \| {id,name}'` | R:50 | The list's response is `total_count` plus `policies[]`, each with an `id` and a `name` | Yes. See N3 |
| 10 | To change it: `-X PUT repos/…/actions/policies/<id>` | R:51 | REST: `PUT /repos/{owner}/{repo}/actions/policies/{policy_id}`. Leaving out `workflow_path` there keeps the stored targeting, and the file carries one | Yes |
| 11 | It needs admin. The UI is Settings, Actions, Policies, and Policy insights sits under Policies | R:5–6, :44; O:119, :124; L:27 | The how-to: "Click the **Settings** tab. In the left sidebar, under **Actions**, click **Policies**". "Organization owners and repository administrators can then add to these restrictions". Insights are "directly under the page for GitHub Actions policies", and show runs "that have been blocked (for active policies) or would have been blocked (for "evaluate" policies)" | Yes |
| 12 | GitHub keeps Actions policies in settings, so a move can lose them | R:3–4, O:107 | About Actions policies: they live in "the **Policies** section of your GitHub Actions settings". No page says what a move does to them, and the sentence says "can" | Yes, as hedged |
| 13 | This repo had no rulesets after the move of 2026-10-23 (it used to say "has had none since") | R:4, O:107 | The repo-move row, `:13` (read 2026-10-28). Call 2 shows both rulesets live on `main` today (27080672 and 27080689), so the new past tense is the accurate one | Yes. See N4 |
| 14 | A startup failure has no job and no log, the PR waits on a check that never came, and the run's annotation names the cause | O:124, S:152 | L `:9`, `:14`. Run 43905341086 (call 3): `pull_request_target`, `startup_failure` | Yes |
| 15 | The brownout did this to three runs, and held #96 for about two hours | O:124, C | L `:9–16`. #96 (call 4) was created at 16:14:41Z and merged at 18:11:23Z: 1 h 57 min | Yes |
| 16 | A startup failure can't be re-run: `gh run rerun` answers "This workflow run cannot be retried" | O:124, S:152, C | L `:16`, as seen on 2026-11-16. Not tried again here, since a rerun is a write | Yes, as recorded |
| 17 | Closing and reopening the PR is a new `pull_request_target` event, and the guard runs again | O:124, S:152, C | The events reference: by default the event runs only for `opened`, `synchronize` and `reopened`, and the guard sets no `types:` (G:24–26). L `:16`: #96 was reopened after 18:00 and the guard passed (43924498162). Neither file says reopening is the only way; a push to the head runs it too | Yes |
| 18 | `gh pr close <PR#> --repo …`, then `gh pr reopen <PR#> --repo …` | S:152 | `gh pr close --help` and `gh pr reopen --help`: both take `{<number> \| <url> \| <branch>}` and `-R, --repo`. The entry doesn't pass `--delete-branch`, which matters for a PR whose head is `staging` | Yes |
| 19 | The skill points at OPERATIONS.md §4, "When `main-source-guard` ends in `startup_failure`" | S:152 | That is O:124's bold lead, word for word | Yes |
| 20 | `workflow_run` would also run only from `main`'s copy, would need a write scope to post its check, and could be tried only after its own promotion | L:27 | The events reference, `workflow_run`: "This event will only trigger a workflow run if the workflow file exists on the default branch", and `GITHUB_SHA` is the default branch's last commit. The write scope follows from that: such a run's own check sits on `main`'s commit, not on the PR's head | Yes. The scope point is an inference |
| 21 | The guard's edit is comment only | G:17–22, M | Base and HEAD parse to the same document (`js-yaml`, scripted) | Yes |
| 22 | The row records the choice and stays OPEN, to close once a real PR into `main` has run the guard with the policy in place | L:6–7, :27; C; M | `**Status:** OPEN` and `**Done:** —`, and L15 is clean. The close condition: B2 | The record: yes. The close condition: **no** (B2) |
| 23 | A CHANGELOG row, and OPERATIONS.md's date | C, O:6, M | L10 and L9 (Gates). The row has the table's four cells (`:20` is the header) | Yes |
| 24 | `/cycle-prod` is where the entry belongs | S:152; frame item 2 | `/cycle-full` hands its prod stage to `/cycle-prod` (`cycle-full/SKILL.md:69–71`), and `/direct-feature` forbids PRs into `main` (`:24–27`). No other skill or command opens one | Yes |

## ADR adherence

Not applicable: the lane has no ADR. The ledger row's fix options and docs ask (`:20–25` at `e8347ee2`) take its place.

- [x] The first option, allowing `pull_request_target` in an applicable Actions event policy, is the one recorded (L:27) and defined (J).
- [x] "OPERATIONS.md §4 and `/cycle-prod` should say what a `main-source-guard` startup failure means, and that a new pull-request event … is the only way to run it again": O:124 and S:152. Both say reopening runs it, not that it is the only way (claim 17).
- [x] No dependencies, no new tooling, and no change to how a workflow runs (claim 21).

## Concept-graph integrity

- [x] No concept definition or handle is touched, so no firmware reinstall is needed.
- [x] No code is added, so nothing has to orient via `/summaries`.

## Things tests can't catch

- [x] **Allowing the event for this workflow meets the guide's terms.** The job checks out nothing, and its token only reads (`permissions: contents: read`, G:28–29). `github.head_ref` reaches the shell through `env:` and a quoted variable (G:37–40), not interpolated into the script. That meets the guide's warning ("should not check out, build, or run code from an untrusted pull request with access to repository secrets or a privileged `GITHUB_TOKEN`"). The policy adds no actor rule, so who may trigger the guard is unchanged.
- [x] **What the policy covers and what it doesn't:** B1 (other workflows) and N2 (a rename).
- [x] **Whether the fix gets verified before the deadline:** B2.
- [x] No secrets. The JSON holds no ids or tokens.
- [x] No debug output and no commented-out code. The workflow's new lines are an explanation that cites §4.
- [x] Scope: the frame, and two wording corrections it needs. R:3–4 and O:107 now say the repo "had no rulesets after the move", because "them" now includes the policy, and that matches the live state (claim 13).
- [x] Concurrency: not engaged.
- [x] Architecture invariants: not engaged (CI settings and their record).

## House rules check

- [x] Concept Graph API authority: not engaged.
- [x] No new lint, typecheck or build tooling.
- [x] No TA pubkey literal is added.

## Product-guide adherence

Not applicable: no PRD-traced copy.

## Findings

### Blocking

1. **`.github/rulesets/README.md:13` and `OPERATIONS.md:119`: "and no other workflow" claims a block that this policy doesn't make.**
   - The README files the sentence under "What it enforces": "`guard-main-source.yml`, and no other workflow, may run on `pull_request_target`". §4 says: "It lets `guard-main-source.yml`, and no other workflow, run on `pull_request_target`".
   - **The policy reaches one workflow.** Its `workflow_path` names one file (J:5–8). The REST page says "Omitting workflow_path targets all workflows", so a path narrows the policy to the files it matches. Its event rule ("Select the events that can trigger Actions workflows") binds only those.
   - **Whether any other workflow may run on the event is up to GitHub's default policy, not this one.** The guide says GitHub adds the default "For public repositories that do not already have an applicable Actions event policy", and that it "Does not replace an applicable event policy that you have already configured". Both sentences are about the repository. No page fetched says whether a policy scoped to one path leaves the default in force for the repository's other workflows. Read as written, the default no longer applies here once this policy exists. Nothing would then block a second `pull_request_target` workflow.
   - **Why it blocks:** frame item 3, and the use the sentence will get. GitHub's default exists for the case of a later PR that adds a `pull_request_target` workflow. A reviewer who reads §4 would expect GitHub to refuse that workflow until the policy changes, and might not give it the review the guide asks for.
   - Three other places already say it accurately: the CHANGELOG row ("lets that one workflow, found by its path, run on the event", `:121`), the ledger row (L:27), and the guard's header ("allows it for this file alone", G:20).
   - **Asked change:** in both places, say what the policy does: it allows `pull_request_target` for `guard-main-source.yml`, found by its path, and limits that workflow to that event. It covers no other workflow. Add that GitHub's docs don't say whether the default still blocks the event for the repository's other workflows once this policy exists. So a new `pull_request_target` workflow needs its own review against the guide, and its own decision about the policy.

2. **`ledger/2026-11-16-main-guard-blocked-by-github-policy.md:27`: the close condition can be met by a run that doesn't test the policy.**
   - The condition: "Close this row once a real PR into `main` has run the guard with the policy in place."
   - Until 2026-12-02 the default "Currently runs in **evaluate** mode. In this mode, workflow runs continue" (the guide, § "How the default policy works"), apart from scheduled brownouts like the one on 2026-11-16. So a guard run before then passes whether or not the policy covers the guard. A path GitHub doesn't match passes then too, and so does a policy left `disabled`. Both fail on 2026-12-02.
   - The definition was written from the REST reference, not read back from a live policy (R:22–23), and the reference doesn't say what form a path takes (claim 4). The next promotion would probably meet the condition within days. The row is the only open record of the deadline, and it would close with the policy untested. The first real test would then be the first PR into `main` under enforcement, which is the failure this row exists to prevent.
   - **Asked change:** name evidence that tests the policy. Either a guard run that passes on or after 2026-12-02 (or during a brownout), or, before then, Policy insights (Settings → Actions → Policies → Policy insights) no longer listing the guard's runs among those the default would block. The guide's § "Reviewing the impact before enforcement" and the how-to's § "Evaluating policies" both name insights as the place where such runs show.
   - **Optional, in the same place:** once the owner has created the policy, record the date and the policy's id. Then have someone with admin read it back (`gh api repos/TapestryProtocol/tapestry/actions/policies/<id> -H 'X-GitHub-Api-Version: 2026-03-10'`) and compare it with the file. The rulesets' files came from a live API in the same way (R:18–20).

### Non-blocking

1. **`.github/rulesets/README.md:53–54` and `OPERATIONS.md:122`: the list of what would stop leaves out the image publisher.**
   - `publish-image.yml` runs on `push` to `staging` (`:14`) and on `workflow_dispatch` (`:44`), so a policy with no path would stop it too.
   - OPERATIONS.md §3 counts it among the workflows that aren't deploys (`:99`).
   - **Optional:** "every other workflow: the deploys, the image publisher, the test gate and the weekly link checks".
2. **`.github/rulesets/README.md:54–55`, `OPERATIONS.md:121` and `.github/workflows/guard-main-source.yml:20–22`: the order of a rename.**
   - `main`'s copy of the guard, at the old path, checks a PR into `main` that renames it. `pull_request_target` "runs in the context of the default branch of the base repository" (the events reference).
   - If the live policy moves to the new path before that PR merges, the PR's own guard run is no longer covered. If it moves after, PRs opened in between aren't covered.
   - **Optional:** say to list both paths in `include` until the rename is on `main`, then drop the old one.
3. **`.github/rulesets/README.md:50–51`: the commands to change the policy.**
   - By default the list includes policies set above the repository: `has_parents`, "Include policies configured at higher levels that apply to this repository", with `Default: true`. An organization's policy is changed through `PUT /orgs/{org}/actions/policies/{policy_id}`, not the repository endpoint that `:51` names. **Optional:** add `source_type` to the `--jq`, or pass `has_parents=false`.
   - `:51` drops the version header that `:47` and `:50` carry. That does no harm: a request without the header defaults to `2022-11-28`, and "Adding an operation" is a change "available in all supported API versions" (the API Versions page). **Optional, for copy and paste:** repeat `-H` and `--input` there.
4. **Outside the diff: `ledger/2026-10-28-repo-move-follow-ups.md:55` still says "Item 1 holds: the new repo has no rulesets".**
   - The same item is at `:13` and `:20`.
   - Call 2 shows both rulesets live on `main`, and this diff's §4 now says the repo "had no rulesets after the move" (`OPERATIONS.md:107`).
   - **Suggested:** a dated note on that row's item 1, added by whoever can confirm that the owner created them. This review doesn't edit it.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **This review is mislabelled by the lint.** `bash scripts/harness-lint.sh` lists it as one that "predates the numbering convention", in an INFO line. It is a doc-lane review, in the form 0-intake `:31` gives one. This is already covered by the open row `2026-11-16-lint-mislabels-doc-lane-reviews`. No new row.
2. **`scripts/harness-def-paths.txt:16–18` still says `.github/workflows` is retired and "no workflow runs".** This change exists because a workflow runs and a live ruleset requires it. This is already covered by the open row `2026-11-16-harness-docs-say-workflows-retired`. No new row.
3. **No rule says where an epic-less doc-lane review goes.** 0-intake `:31` gives a doc-lane review the path `reviews/<epic>/<slug>.md`, but doesn't say which folder takes one that no active epic owns. This one follows precedent into `harness-self-improvement`, whose epic is Done (`epics/harness-self-improvement.md:3`). It is a candidate `meta` row, for the session that commits this review to file if it agrees.

## Verdict

**CHANGES_REQUESTED**

Most of the change is right:

- The policy file matches GitHub's REST body, field by field.
- The commands use the documented endpoints and header.
- The startup-failure guidance is accurate: no job, no re-run, and reopening runs the guard again. It sits where `/cycle-prod` and §4's readers will find it.
- The harness rules hold.

Two items block:

1. `.github/rulesets/README.md:13` and `OPERATIONS.md:119`: "and no other workflow" claims a protection that the policy doesn't give and GitHub's docs don't promise (B1).
2. `ledger/2026-11-16-main-guard-blocked-by-github-policy.md:27`: any guard run before 2026-12-02 meets the close condition, and such a run passes whether or not the policy works (B2).

Both are wording changes, in three files.

## On PASS (same commit)

- [ ] Not applicable: the verdict is CHANGES_REQUESTED. There is no story to mark Done (the doc lane has none) and no book to check (0-intake `:39`).
- [ ] Commit: left to the session that launched this review, which asked for the file to stay uncommitted. The role's rule is to commit the review whatever the verdict (`workflows/5-review.md:33–34`). A suggested message: `review: main-guard-actions-policy — CHANGES_REQUESTED (harness-self-improvement, doc lane)`.

## Round 2

**Date:** 2026-11-16 (UTC; the round ran from about 21:35Z, just after the fix commit, to about 21:45Z)
**Diff:** `git diff 587425f9..7cb12f82` on `docs/main-guard-actions-policy`: one commit, `7cb12f82`, over `587425f9`, the round-1 review's commit. Four files, 45 insertions and 9 deletions: `.github/rulesets/README.md`, `OPERATIONS.md`, `ledger/2026-11-16-main-guard-blocked-by-github-policy.md`, and a new row, `ledger/2026-11-16-epicless-doc-lane-review-folder.md`. The fix commit leaves this file as round 1 wrote it. The branch still has no upstream and no PR.
**Asked:** re-review the fixes for B1, B2 and N1–N3. N4 is outside this change and left as a follow-up. Friction 3 became a new `meta` row, and the brief asks whether it holds as written.
**Method:** every changed statement is checked as a fresh claim, round 1's suggested wording included (`roles/reviewer.md`, rule 10). The row-codes R, J, O and L are round 1's.

### Quality gates (round 2, run by reviewer)

- [x] `bash scripts/harness-lint.sh` at `7cb12f82`: `harness-lint: clean (0 violations)`, exit 0. L15 accepts the new row's file name and header fields. L10 has nothing new to judge, because the fix commit touches no listed path, so the newest one is still `3c874499`, which carries the CHANGELOG row. L9: OPERATIONS.md's `Last updated: 2026-11-16` matches the fix commit's date. Run again with this section in place: still clean, exit 0.
- [x] **The two file-reading suites, again,** because OPERATIONS.md changed and both read it: `test/workflow-hardening.test.js` `{"pass":27,"fail":0}` and `test/ci-test-job.test.js` `{"pass":14,"fail":0}`, exit 0.
- [x] `git diff --check 3c874499..7cb12f82`: no output, exit 0.
- [x] **Sources.** The guide, fetched again, is byte-identical to round 1's copy. Two more pages were read for B1's negative claim: "Secure use reference" and "Managing GitHub Actions settings for a repository". Neither says how GitHub's default treats workflows outside a policy's path.
- [x] GitHub API: no calls this round. The local git history answered the questions it raised.
- [x] **The verdict parse (OPEN.md row 28).** Round 1's file parses as the wrong verdict (R2-F1). This section ends on its own verdict, and after writing it, `awk -f scripts/lib/review-verdict.awk` on this file prints `CR`.
- [ ] `npm test`: not run, for round 1's reason. `npm run gate:status` still finds no records.
- [ ] Independent checker: not applied, because this session can't start one.
- [x] Nothing else written to the repo. This file is the only change in the worktree.

### Round-1 items

| Item | The fix | Checked against | Holds? |
|---|---|---|---|
| B1 | R:13 and O:119 now say the guard, "found by its path, may run on `pull_request_target`, and on no other event. It covers no other workflow." R:69–71 and O:123 add that the policy says nothing about other workflows. GitHub's docs don't say whether the default block still applies to them, so a new `pull_request_target` workflow needs its own review and its own decision about the policy | <br>• The event rule is an allowlist ("an allowlist that controls … which events are permitted to run them", About Actions policies). J:5–8 targets one path, and "Omitting workflow_path targets all workflows" (REST). <br>• "On no other event" holds whatever else applies here. Protections "layer", and the lower levels "add to these restrictions" (the how-to), so no other policy can widen what this one allows the guard. <br>• The negative claim: no page read says how the default treats workflows outside a policy's path. The pages were the guide (unchanged), the concepts page, the how-to, the REST and events references, and this round's two pages | Yes |
| B2 | L:29–33, a new "Closing it." paragraph | <br>• Evaluate mode: "workflow runs continue, but you can use policy insights to identify runs that would be blocked after enforcement" (the guide). <br>• Insights list runs "that have been blocked (for active policies) or would have been blocked (for "evaluate" policies)" (the how-to, § "Evaluating policies"). <br>• The first bullet (L:30) pairs a control with the test. The control: the guard's earlier runs are listed. The test: its run after the policy exists isn't. Under either reading of how GitHub scopes its default (B1), a run that insights don't list is one the default won't block on 2026-12-02. <br>• The second bullet (L:31) is the direct test. <br>• The read-back (L:33) is `GET /repos/{owner}/{repo}/actions/policies/{policy_id}` (REST, "Get a repository Actions policy"). <br>• L:6–7 still read OPEN and — | Yes. One overstatement: R2-N1 |
| N1 | R:63–65 and O:122: "every other one would stop: the deploys, the image publisher, the test gate and the weekly link checks" | The seven workflows other than the guard (round 1's claim 5, and `publish-image.yml:14`, `:44`) are all named now | Yes |
| N2 | R:65–67 and O:121: both paths stay in `include` until the rename is on `main`, then the old one comes out | `pull_request_target` takes the workflow "from the base repository's default branch" (the guide) and "runs in the context of the default branch" (the events reference). So until the rename merges, `main`'s copy at the old path is the one that runs | Yes |
| N3 | R:50–61: the list passes `has_parents=false` in a quoted path, and the `PUT` carries the header and `--input` | <br>• REST: `has_parents`, "Include policies configured at higher levels that apply to this repository", `Default: true`. <br>• An organization's policy changes through `PUT /orgs/{org}/actions/policies/{policy_id}`, and the repository's through `PUT /repos/{owner}/{repo}/actions/policies/{policy_id}`. <br>• The quotes keep zsh from treating `?` as a glob | Yes |
| N4 | None: it is outside this change, as the brief says | `ledger/2026-10-28-repo-move-follow-ups.md:55` is unchanged | Still open: R2-N2 |
| Friction 3 | A new row, `2026-11-16-epicless-doc-lane-review-folder` | The table below | One claim is false: R2-B1 |

### The new `meta` row, `ledger/2026-11-16-epicless-doc-lane-review-folder.md`

| # | Claim | Evidence | Holds? |
|---|---|---|---|
| 1 | Its file name and header fields | L15 is clean. The id has five words and 42 characters, within OPEN.md's pattern (`:20`). `Type: meta`, `Status: OPEN` and `Done: —` (`:3–7`) | Yes |
| 2 | 0-intake step 3 gives a doc-lane review `reviews/<epic>/<slug>.md`, and doesn't say where one goes when no active epic owns it (`:9`) | 0-intake `:31` | Yes |
| 3 | "The review of the Actions policy … changed `.github/`, `OPERATIONS.md` §4 and `/cycle-prod`" (`:9`) | It was the change under review that changed them (`3c874499`). The review changed nothing | A slip: R2-B1 |
| 4 | "no active epic owns any of them" (`:9`) | It holds for each thing the change touched: <br>• the guard, last changed by `cb6c8b82` (2026-08-07), which had no epic; <br>• `.github/rulesets/` and §4's rewrite, from `c8b24d87`, which had none either; <br>• `/cycle-prod`, whose last epic commit is `ffcf0f8a`, `deploy-safety-gate` #2, an epic now Done. <br>`honest-test-gate` #2 edited §3, §15 and §18.2, not §4. The claim doesn't hold for `.github/` as a whole: the active `honest-test-gate` added `.github/workflows/live-link-checks.yml` on 2026-11-16 (`36e123d2`) | For those files, yes. For `.github/` as a whole, no: R2-B1 |
| 5 | "`workflow-hardening`, which last changed the workflows, is retired under `reviews/done/`" (`:9`) | Before `3c874499`, the newest commits to `.github/workflows/` are `36e123d2` and `0b2c436b`, from story `honest-test-gate` #2. `workflow-hardening` (`e596b6de`, 2026-11-13) last changed six of the eight files | **No**: R2-B1 |
| 6 | "beside 14 other non-numbered reviews", and that epic's file says Done (`:9`) | The folder holds 15 non-numbered reviews, this one included. `epics/harness-self-improvement.md:3` says Done | Yes |
| 7 | The fix shape, to be decided together with `2026-11-16-lint-mislabels-doc-lane-reviews` (`:11`) | That row is OPEN and is about lint's INFO line for non-numbered reviews (`scripts/harness-lint.sh:111`). It's cited by id, as OPEN.md `:22` asks | Yes |
| 8 | The pointer (`:13`) | Both paths resolve, and "Harness friction" 3 is round 1's item | Yes |

**Correction to round 1.** Round 1's "Filed under" line makes claim 5's error, so the row's error starts in this review. The filing still stands. `honest-test-gate`'s goal is the test gate: a verdict and exit status that are always true, and a red that always means signal (`epics/honest-test-gate.md`, Goal). It owns none of the guard, the rulesets, §4 or `/cycle-prod`.

### Findings (round 2)

#### Blocking

1. **R2-B1. `ledger/2026-11-16-epicless-doc-lane-review-folder.md:9`: the row's example says `workflow-hardening` last changed the workflows, and it didn't.**
   - Before this change, `honest-test-gate` #2 was the last to change `.github/workflows/`. It added `live-link-checks.yml` on 2026-11-16 (`36e123d2`, `0b2c436b`), and `honest-test-gate` is Active. `workflow-hardening` last changed six of the eight workflows.
   - The same sentence has two smaller slips. "The review … changed" should name the change it reviewed. And "no active epic owns any of them" holds for the guard, the rulesets, §4 and `/cycle-prod`, but not for `.github/` as a whole.
   - The error started in round 1's "Filed under" line, and the row adopted it. This is the case rule 10 is written for: the sentence now carries two roles' apparent endorsement.
   - Why it blocks: the row is new, and the brief asks whether it holds as written. It doesn't, and a false fact in a ledger row costs one sentence to fix now.
   - **Asked change:** rewrite that sentence so each fact in it is true. For example: "The change it reviewed touched the guard's workflow, `.github/rulesets/`, OPERATIONS.md §4 and `/cycle-prod`, and no active epic owns any of them. The guard's last change before it (`cb6c8b82`) and the rulesets' commit (`c8b24d87`) had no epic. `workflow-hardening`, which last changed six of the eight workflows, is retired under `reviews/done/`." The next round will check this wording as a claim like any other.

#### Non-blocking

1. **R2-N1. `ledger/2026-11-16-main-guard-blocked-by-github-policy.md:29` says "Until 2026-12-02 GitHub only reports what its default policy would block".** A scheduled brownout does block, as the row records (`:14`, `:16`), and its own second bullet names brownouts (`:31`). **Optional:** "Until 2026-12-02, apart from scheduled brownouts, GitHub only reports …".
2. **R2-N2. N4 is left as a follow-up, and nothing records it yet.** `ledger/2026-10-28-repo-move-follow-ups.md:55` still says the repo has no rulesets, though both are live on `main`. **Suggested:** a dated note on that row before the session ends, so the follow-up isn't lost.

#### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **R2-F1. OPEN.md row 28's edge fired on round 1 of this review.**
   - At `587425f9`, `scripts/lib/review-verdict.awk` reads this file as the wrong verdict.
   - The last line it scans is the template's post-verdict heading, `## On PASS (same commit)`. The "Not applicable" line under it is a plain list item, and the parser scans only headings and lines with bold markers. So the fix from the row's fourth occurrence works only if that line is bold.
   - No tool read the wrong verdict: lint's L1 and L4 and `harness-stats.sh` read only numbered reviews.
   - This round leaves round 1's text as committed, and closes on its own verdict, so the file now parses as `CR`.
   - **Suggested:** a fifth-occurrence note on row 28, not a new row.

### Verdict (round 2)

**CHANGES_REQUESTED**

Round 1's two blocking items are fixed. So are the three optional ones that were taken up. B1's new wording says what the policy does and no more. B2's close condition now names evidence that tests the policy: insights before 2026-12-02, and a guard run that passes under enforcement after it. One item blocks: R2-B1, a false sentence in the new `meta` row (`ledger/2026-11-16-epicless-doc-lane-review-folder.md:9`), which started in this review's round 1. It is a one-sentence fix, and nothing else in the change needs another edit before it merges.

### Close-out (same commit)

- No story to mark Done, and no book to check (0-intake `:39`).
- Commit: left to the session that launched this round, which asked for the file to stay uncommitted. A suggested message: `review: main-guard-actions-policy — round 2, changes requested (harness-self-improvement, doc lane)`.
