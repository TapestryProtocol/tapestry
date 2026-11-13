# Review: Story 1 — The GitHub workflows pin what they run, limit their token, and name a deploy environment

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-13
**Diff:** `git diff origin/staging...HEAD` (base `6c57ec1f`, HEAD `0af83004`: story `1dc1ca44`, failing tests `8b6931bb`, a ledger row `495e0458`, implementation `0af83004`)
**Story:** [1-harden-the-github-workflows.md](../../stories/workflow-hardening/1-harden-the-github-workflows.md) · **ADR:** none (Architecture skipped at intake) · **Test plan:** [1-…test-plan.md](../../stories/workflow-hardening/1-harden-the-github-workflows.test-plan.md)

**In short.** The workflow changes are right. All 12 action calls are pinned to the commit their tag points to today, and that commit is the release each comment names. Every workflow declares its token's permissions, the five deploy jobs name the right environments, and nothing else in any workflow changed. I found no reason the workflows would stop running. Two things block, and neither is in a workflow file:

1. The runbook for the `ninja` box still tells an admin to add its deploy key as a repository secret, which is what the new §17.3 says not to do (B1).
2. The test plan takes this story's full gate from the pull request's `Test` run and says that run must be green. An open ledger row says every pull request into `staging` is red on one unrelated test, and that test still fails on this tree (B2).

The guard has real holes. None of them blocks (non-blocking 1 to 3).

## Quality gates (run by reviewer, not trusted)

- [ ] **`npm test`: not run.** On this machine the container named `tapestry` is a long-lived instance, not a scratch stack, and a full run writes to it (`ledger/2026-11-13-live-suites-have-no-off-switch.md`). The launching task forbids the full run here, and the test plan (`:95-98`) takes the full gate's result from the pull request's `Test` run. So this review holds **no full-gate result for this code**.
  - No `npm run gate:status` line is quoted, and I did not run it. The only record on this machine is the Test Design baseline: run `20261113T204400Z-47565-3703`, taken at `1dc1ca44` with the test changes uncommitted, verdict FAIL. It is not a run of this code.
  - That record does bear out the test plan's red-first counts (`workflow-hardening` 19 passed and 7 failed, `ci-test-job` 11 and 3, `brains-launcher-repo` 31 and 0). It also has `setup-alert-polish` at 16 passed, 1 failed (B2).
- [x] **Three suites, run one at a time** through their `run()` exports at `0af83004`, on Node 24.18.0, with `TAPESTRY_CONTAINER`, `TAPESTRY_PORT` and `BRAINSTORM_BASE_URL` pointed at nothing. They are the guard and the two suites that hold `test.yml` and `publish-image.yml`: the three the launching task allowed. **They are not the full gate.**

  | Suite | Passed / failed / skipped |
  |---|---|
  | `workflow-hardening` | 26 / 0 |
  | `ci-test-job` | 14 / 0 |
  | `brains-launcher-repo` | 31 / 0 / 0 |

- [x] **Other suites that read a changed file: read, not run.**
  - Seven more suites open OPERATIONS.md: `bullboard-admin-access`, `generalized-task-scheduler`, `reconciliation-incremental-mode`, `reconciliation-rearchitecture`, `router-stream-limit-on-connect`, `task-queue-bullmq` and `task-queue-neo4j-resource-class`. Each checks that text about its own subject is present: the queue in §10, reconciliation in §12, the scheduler in §13, and the "What a deploy does" paragraph (`OPERATIONS.md:875`). This diff's seven hunks are elsewhere: the header, the contents list, §1, §3, §6.2, §6.3 and the new §17.
  - `stack-free-npm-test` G5 needs every suite file registered or excluded. The guard is registered (`test/registry.js:161`).
  - `harness-lint`'s tests lint the real repo, the new ledger row and records included. The script itself is clean (next line).
- [x] **`bash scripts/harness-lint.sh`:** clean, 0 violations, before this file was written and after.
- [x] **The guard suite rule.** `git show --name-only 0af83004 -- test/` and `git diff --name-only 8b6931bb HEAD -- test/` are both empty, so Phase 4 left `test/` alone. The test commit changed three assertions in `test/ci-test-job.test.js` (W3 `:94`, W4 `:104`, W9 `:175`) with their comments, added one registry line and added the guard. Nothing else under `test/` changed.
- [x] **Red before green, re-derived.** I ran the guard's own checkers, as committed in `8b6931bb`, over the workflow files and OPERATIONS.md of that commit, in memory. They give 11 PIN, 5 TOKEN and 5 ENV findings and neither doc section: the test plan's numbers. Over HEAD they give 0, 0 and 0, with both sections present.
- [x] **Probes.** Made-up workflows fed to the guard's checkers in a throwaway `node -e` (non-blocking 1 to 3), and each workflow file parsed before and after (V2). Nothing was written, and no file under `test/` was touched.
- [x] **GitHub, read only: ten requests.** Six `git ls-remote` (V1), two raw files of `appleboy/ssh-action` at the pinned commit, and two raw files of GitHub's documentation source (`github/docs`, `main`).
- [ ] `npm run test:playwright`: not applicable (no UI).
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Would the changed workflows still run?

Nothing here can run a GitHub workflow. This is reasoned from the files, from the action's source at the pin, and from GitHub's documentation.

**Positions and syntax.** All seven files parse (js-yaml 4.1.1). `permissions` is a top-level key in each. `environment` sits on the job in the five deploy jobs. Each of the 12 `uses:` values parses to exactly `owner/repo@<40 hex characters>`, with the release comment outside the value.

**What each job needs from its token.**

| Job | What it does | What it needs | What it has |
|---|---|---|---|
| the four `deploy` jobs | one step, `appleboy/ssh-action` | Nothing. At the pin the action is a composite of two shell steps. It calls no other action and reads no token (`action.yml` and `entrypoint.sh`, read at `0ff4204d`). | `permissions: {}` |
| `stack-free` (`test.yml`) | checkout with full history, Node setup with the npm cache, `npm ci`, `npm test` | To read the repository. The `npm` steps are handed no token (`test.yml:27-30` sets one variable). | `contents: read` (`:20-21`) |
| `publish` (`publish-image.yml`) | steps unchanged | unchanged | `contents: read`, `packages: write` (`:52-54`), unchanged |

**A job that names an environment that does not exist yet.** GitHub's documentation, read today:

- "Running a workflow that references an environment that does not exist will create an environment with the referenced name. … the newly created environment will not have any protection rules or secrets configured." (`content/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments.md:95`)
- "if an organization, repository, and environment all have a secret with the same name, the environment-level secret takes precedence." (`content/actions/reference/security/secrets.md:25`)

So the first run creates each environment empty, and the job goes on reading the repository-level secrets, as the implementation commit says.

**What will look different after the merge.** These are expected, from GitHub's general behaviour, and are not defects:

- Environments appear in the repository's settings as each job first runs (`staging` and `ninja` on this merge), with a deployment recorded for each run.
- The merge rolls the brains, because `publish-image.yml` is in its own `paths` list (the test plan's V3 says so).
- If Required reviewers is later turned on for an environment, `/cycle-staging` and `/cycle-prod` will sit in `gh run watch` (`.claude/skills/cycle-staging/SKILL.md:127`, `.claude/skills/cycle-prod/SKILL.md:120`) until someone approves in GitHub.

**What I could not check from here.** These are settings and GitHub's own behaviour, and V3's runs are what will show them:

- The organization's policy on which actions may run. A policy that lists actions by tag would refuse a commit reference.
- That environments are available to this repository. They are for a public repository on any plan. The launching task says this one is public, and the clone at `OPERATIONS.md:239` uses no credentials; I did not ask GitHub.
- That a job with no token scopes still downloads a public action, that the Node setup's cache needs no token scope, and that the deployment record an environment creates needs none. All three are GitHub's general behaviour as I know it.

## V1: the pins, read a third time

`git ls-remote --tags https://github.com/<owner>/<repo> <tag> '<tag>^{}' '<tag>.*'`, six times, on 2026-11-13.

| Action | The tag points to, today | The release in the comment points to | Result |
|---|---|---|---|
| `actions/checkout` | `v5` → `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09` | `v5.1.0` → the same | matches the pin |
| `actions/setup-node` | `v5` → `a0853c24544627f65ddf259abe73b1d18a591444` | `v5.0.0` → the same | matches the pin |
| `appleboy/ssh-action` | `v1` → `0ff4204d59e8e51228ff73bce53f80d53301dee2` | `v1.2.5` → the same | matches the pin |
| `docker/build-push-action` | `v6` → `10e90e3645eae34f1e60eeb005ba3a3d33f178e8` | `v6.19.2` → the same | matches the pin |
| `docker/login-action` | `v3` → `c94ce9fb468520275223c153574b00df6fe4bcc9` | `v3.7.0` → the same | matches the pin |
| `docker/setup-buildx-action` | `v3` → `8d2750c68a42422c14e847fe6c8ac0403b4cbd6f` | `v3.12.0` → the same | matches the pin |

No output had a line ending in `^{}`: all six repositories use plain tags here, so each line is the commit itself. No tag has moved since the test plan's table was written.

## V2: nothing else changed

The test plan's command (`:129`) printed nothing. 45 changed lines went into it.

The command has two blind spots (non-blocking 6), so I also parsed each workflow as it is on `origin/staging` and as it is at HEAD. With the top-level `permissions`, each job's `environment` and the part of each `uses` after the `@` set aside, all seven files are equal, key for key and script for script. `guard-main-source.yml` is byte-identical. The 12 changed `uses:` lines keep their action names.

## Spec adherence

- [x] **Every acceptance criterion has a passing test,** in the three suites run here.

  | Criterion | Tests | Also checked by the reviewer |
  |---|---|---|
  | AC-1 pinned | R1, S1–S4; W3, W4, W9 | I read all 12 `uses:` lines. V1, above. |
  | AC-2 token | R2, R3, S5–S8 | One top-level block in each of the seven files and none on a job. The only write scope is `packages`, in `publish-image.yml:52-54`. |
  | AC-3 environment | R4, S9–S13 | Five jobs read deploy secrets: three each, of one server each. The names match (`deploy-tapestry.yml:19`, `deploy-staging.yml:22`, `deploy-tags.yml:14`, `deploy-magic-carpet.yml:14`, `publish-image.yml:61`). |
  | AC-4 the suite holds the rules | R0, M1, S14–S16 | The checkers find 11, 5 and 5 on the files as they were. A file added later is read (`test/workflow-hardening.test.js:78-84`). Its holes are non-blocking 1 to 3. |
  | AC-5 the docs | D1–D4 | The claim table below. All four clauses are in OPERATIONS.md. D1, D2 and D4 match §17's own heading first, so they read the whole section; the text each needs is in the right subsection. The `ninja` box's own setup doc was missed (B1). |
  | AC-6 nothing else | the existing W-handles; V2 | The parsed comparison, above. V3 is for the pull request and after (B2). |

- [x] **No criterion is silently dropped.**
- [x] **No behavior added that isn't in the story.** The four Deviations (story `:91-101`) are each acceptable:
  - **`permissions: {}` on the deploy workflows.** The action needs no token, as its source at the pin shows.
  - **A comment on each added line.** Each comment is accurate, and the parsed comparison shows they change nothing.
  - **"§6.3 step 2" became "step 3".** Right: step 3 is the deploy key (`OPERATIONS.md:229`); step 2 is SSH hardening.
  - **The full gate was not run on the development machine.** Right for that machine. What the pull request's run will say is B2.

## OPERATIONS.md §17 and the changed §6.2, claim by claim

| Claim | Where | Checked against | Result |
|---|---|---|---|
| The guard reads the folder on every `npm test`, names the file and the rule, and covers a workflow added later | `:1106` | `test/registry.js:161`; `test/workflow-hardening.test.js:78-87`; S15, S16 | Holds |
| The example pin | `:1113` | V1 | Holds |
| A tag can be moved and a commit id can't | `:1116` | How git works. No source read today. | Holds |
| `appleboy/ssh-action` downloads its SSH client from a release at run time | `:1116` | `entrypoint.sh` at the pin: `curl` fetches `drone-ssh` 1.8.2 from a release of `appleboy/drone-ssh`, with no checksum | Holds (non-blocking 7) |
| How to read a pin with `git ls-remote`, and which line is the commit | `:1118-1124` | The same command gave the six V1 reads. All six were the "otherwise the plain line is" case. The `^{}` case is git's behaviour for annotated tags, not seen today. | Holds. The example's `v1.2.6` does not exist (non-blocking 5). |
| `test/ci-test-job.test.js` holds the gate's two actions at `v5` | `:1124` | W3 `:94`, W4 `:104` | Holds |
| Which workflow declares what | `:1128-1134` | The seven files | Holds |
| Without a declaration, a repository setting decides | `:1128` | GitHub's behaviour as I know it. Not read today. | Not re-verified |
| The table of environments, secrets, workflows and branches | `:1140-1146` | Each file's `on:` and secrets; `publish-image.yml:58` for `ninja`'s two branches | Holds for this tree. One more workflow reads `magic-carpet`'s secrets on another branch (non-blocking 4). |
| A repository-level secret goes to any workflow that names it, on any branch | `:1148` | GitHub's behaviour as I know it. Pull requests from forks are the exception. | Not re-verified |
| An environment's secrets go only to a job that names it, and only from the branches it allows | `:1148` | Documentation `manage-environments.md:82`: "These secrets are only available to workflow jobs that use the environment. Additionally, workflow jobs that use this environment can only access these secrets after any configured rules (for example, required reviewers) pass." A branch limit is one of those rules, by my reading (`:74-75` are its settings steps). | Holds. The option is labelled "Selected branches and tags" (non-blocking 5). |
| Required reviewers | `:1148` | Documentation `:59-60` | Holds |
| GitHub creates an environment the first time a job names it, empty and with no rules | `:1150` | Documentation `:95`, quoted above | Holds |
| Until its secrets are added, the job reads the repository-level secrets of the same names | `:1150` | Documentation `secrets.md:25`, quoted above: a job that names an environment sees both levels | Holds. The first deploy to staging is the live proof. |
| The order for moving a target's secrets | `:1152-1160` | Follows from the two rows above, and from each push-triggered workflow running its own branch's copy. Step 1's command, run as written on my local refs, prints nothing for the four deploy branches today and prints the line for this branch's five files. "§6.3 step 3" is the key step (`:229`). | Holds where one workflow reads a target's secrets (non-blocking 4) |
| GitHub can't copy a secret's value | `:1156` | GitHub's behaviour as I know it | Not re-verified |
| §6.2 steps 1 and 2, §6.3's last line, §1 and §3 | `:188-189`, `:235`, `:45`, `:100` | Consistent with §17. "`npm test` fails without it" is R4. The four in-page links this diff adds resolve. | Holds |

## ADR adherence

Not applicable. The owner skipped Architecture at intake, as obvious for a Bug. The convention is recorded in OPERATIONS.md §17.

## Concept-graph integrity

- [x] **Handles:** none touched.
- [x] **Firmware reinstall:** not needed. No concept changed.
- [x] **`/summaries`:** not applicable. This is CI configuration.

## Things tests can't catch

- [x] **No secrets in committed files.** In the added lines, the only IP address is one already in the sentence this diff edits (`OPERATIONS.md:45`), and the only 40-character hex strings are the six pins. There is no 64-character hex string, key, token or home path.
- [x] **Described, not named.** The diff's files describe the exposure at the level of the story's Background: where deploy secrets live, and how GitHub hands them out. I saw nothing more specific.
- [x] **No leftover debug logging.** The guard's only `console.log` is the suites' usual result printer (`test/workflow-hardening.test.js:642-646`).
- [x] **No commented-out code.**
- [ ] **Error paths and edge cases.** A file the guard can't parse is a finding, not a silent pass (S14). Its holes are non-blocking 1 to 3.
- [x] **Concurrency.** Not involved. S16 writes to a temporary folder of its own and removes it.
- [ ] **Security.** The change narrows what each workflow can reach. One operator doc still points the other way (B1).

## House rules check

- [x] **Concept Graph API authority:** not involved.
- [x] **No new lint, typecheck or build tooling.** The guard is a test suite on `js-yaml`, already a dependency. No package file changed.
- [x] **The harness-definition rule.** `.github/workflows` changed, and the same commit adds an accurate row at `engineering-team/CHANGELOG.md:118`. The date at `OPERATIONS.md:6` moved with the content.
- [x] **No TA pubkey literal** added, and the `LEGACY_*` constants are untouched.

## Product-guide adherence *(when the story traces to a PRD)*

Not applicable. The book has an acceptance frame and no PRD, and there is no UI.

## Findings

### Blocking

1. **B1. `deploy/RUNBOOK.md:125-131`: the `ninja` box's setup still puts its deploy key at repository level.**
   - **What it says.** Step 7 has an admin add `DEPLOY_HOST_NINJA`, `DEPLOY_USER_NINJA` and `DEPLOY_SSH_KEY_NINJA` "In the repo's Settings, Secrets and variables, Actions" (`:130`). That is the page for repository secrets.
   - **What this change says.** `publish-image.yml:61` names the `ninja` environment, and §17.3 says a deploy target's `DEPLOY_` secrets belong in its environment (`OPERATIONS.md:1148`), with `ninja` in its table (`:1146`). The diff rewrote §6.2 for droplets (`:188-189`). But §6 sends the `ninja` box to the runbook (`:176`), which this diff does not touch and which has no pointer to §17.
   - **Why it blocks.** Step 7 is what an admin follows to set the box up again or to give it a new key, and §17.3 step 3 itself suggests a new key during the move (`:1156`). Followed after the move, it puts the new key where §17.3 says a workflow on any branch can read it. The job never uses that key either, because the environment's older value takes precedence. The guard can't see any of this: the workflow still names its environment.
   - **Asked change.** In step 7, the three secrets go in the `ninja` environment (Settings → Environments), limited to `staging` and `main` as the table says, with a pointer to OPERATIONS.md §17.3. A pointer the other way, from §17.3's last line (`:1162`) to the runbook, would close the loop. A Markdown change under `deploy/` does not roll the brains (`publish-image.yml:40`).

2. **B2. Test plan `:95` and `:132-133`: the run named as this story's full gate is expected to come back red, and the plan says it must be green.**
   - **What the plan says.** The full gate's result comes "From the pull request's `Test` run" (`:95`), and V3 says that run "must be green" (`:132-133`). The story's fourth Deviation rests on the same sentence (`:99-101`).
   - **What the tree says.**
     - `ledger/2026-11-07-reading-writeverbs-raw-publish.md` is OPEN: "Until it's fixed, every PR into `staging` reads red on this one test" (`:15`).
     - The cause is still here at `0af83004`. `ui/src/pages/reading/writeVerbs.js:278` posts to `/api/strfry/publish` by hand, and `RAW_PUBLISH_ALLOWED` (`test/setup-alert-polish.test.js:42-52`) doesn't list that file. So S2 (`:358`) fails with or without a stack.
     - I did not run that suite. The baseline record named above has it at 16 passed, 1 failed.
   - **Why it blocks.** That run is the only full-gate evidence this story will have. As written, V3 fails for a reason that has nothing to do with the change, and the story would be marked Done against a gate that reads FAIL. The ledger row records that an earlier book shipped with this red "on the owner's OK". That is the owner's to give again. A review can't assume it.
   - **Asked change, one of:**
     - the fix for S2 lands on `staging` first (the row gives its shape), and V3 stands as written; or
     - the Tester amends `:95-98` and V3 to name the known failure and to say how the run is read, and the owner's OK to ship on that reading is recorded. For example: every step before `npm test` succeeds on the pinned actions with `contents: read`, and the run's only failure is `setup-alert-polish` S2.

### Non-blocking

1. **`test/workflow-hardening.test.js:209-222`: ENV misses a fourth way to read every secret.**
   - S13 (`:438-452`) catches `toJSON(secrets)`, `secrets[…]` and `secrets: inherit`. GitHub's expressions also have an object filter, `secrets.*`, which gives every secret's value.
   - In a probe, a job with no `environment:` that reads `join(secrets.*, …)` or `toJSON(secrets.*)` passed the guard, while the two controls (a named deploy secret, and `toJSON(secrets)`) were caught.
   - A space around the dot (`secrets . DEPLOY_SSH_KEY_STAGING`) passed too. I believe GitHub's parser accepts that, but couldn't test it here.
   - Why it doesn't block: nobody writes these by accident, and the guard is a tripwire, not the control. The control is each environment's branch limit in GitHub.
   - Suggested (Tester): treat any use of `secrets` that isn't `secrets.<NAME>` as reading every secret, with these as S13 cases. Or list them under the test plan's "Not covered" (`:66-73`).

2. **`test/workflow-hardening.test.js:102-131`: PIN reads only the `uses:` lines of workflow files.** Two things a workflow can run are outside it:
   - a local action (`uses: ./…`) is passed unread (`:115`, `:125`; S1 `:344`), though its own `action.yml` is in this repo and can call other actions by tag;
   - a job's `container:` or `services:` image named by tag, while an image run as a step is held to a digest (`:126-131`).

   Probes confirm both pass. Nothing uses either today: no `action.yml` is tracked, and no workflow has `container:` or `services:`. Suggested (Tester): hold both, or name them under "Not covered".

3. **`OPERATIONS.md:1118-1124`: whether a pin is the release it claims is checked once, in this review.** The guard checks the form: 40 hex characters and a `# vX.Y.Z` comment. In a probe, any id with any version comment passed. The test plan says so (`:70`), and V1 covered this change. Nothing asks the reviewer of the next pin move to read it again. Suggested: one sentence in §17.1, that the reviewer of a pin change runs the same `git ls-remote` and compares.

4. **`OPERATIONS.md:1154` and `:1158`, and the epic `:39-41`: the move order and the landing note assume one workflow per target.**
   - On `feature-magic-carpet` the folder holds `configure-prod.yml`, `deploy-brainstorm.yml` and `deploy-magic-carpet.yml`. This is my local ref, `08376328` of 2026-11-02. I did not fetch.
   - `configure-prod.yml`, run by hand, also reads `DEPLOY_*_MAGIC_CARPET`. It calls `appleboy/ssh-action@v1.2.2`, and has no `permissions:` and no `environment:`. It is the only such extra workflow on any of the 39 remote branches I have.
   - So after step 5 for `magic-carpet`, that workflow finds no secret unless it names the environment too.
   - And when this change reaches that branch, the guard fails on both extra files. The branch is 4,245 commits behind `staging`, so "the usual promotion and sync" is not a small step.
   - Suggested: step 1 checks every workflow on the branch that names the target's secrets (`git grep -n 'DEPLOY_[A-Z_]*_<NAME>' origin/<branch> -- .github/workflows`), and the book's "What stays open" (`engineering-team/audits/workflow-hardening/book.md:28`) names the two files.

5. **Small wording points in OPERATIONS.md.**
   - `:189` and `:1148`: GitHub's option reads "Selected branches and tags".
   - `:1121`: `v1.2.6` does not exist. The newest `v1.*` is `v1.2.5`, so the command as printed returns nothing. Using `v1.2.5` would let a reader compare the output with the pin shown above it.
   - `:1148`: a branch limit is as strong as the rules on the branch it allows, and §4 (`:106`) records what those are. One sentence pointing there would keep "limited to its deploy branch" from reading as more than it is.
   - `:15`, older than this diff: the contents line links `#4-branch-protection-ruleset`, but the heading (`:104`) ends "rulesets". The new link at `:1128` is right.

6. **Test plan `:129`: V2's command has two blind spots.**
   - Its first `grep` drops any changed line whose text starts with `-` or `+` in the first column.
   - Any changed `uses:` line passes, whatever it now names.

   Neither one bit here: the parsed comparison covers both. Suggested: say so beside the command, or pair the removed and added `uses:` lines by action name.

7. **`OPERATIONS.md:1116`, and the SSH step of all five deploy jobs: the step that holds the SSH key still runs a program fetched at run time.** At the pin, `entrypoint.sh` downloads `drone-ssh` 1.8.2 from a release of another repository, with `curl` and no checksum. §17.1 says this accurately. Worth an intake entry: a plain `ssh` step on the runner would need neither the action nor the download.

8. **Three older citations of `test.yml:36` now point at the Node setup line.** They are `test/honest-publish-reporting-ci-guard.test.js:13`, `engineering-team/decisions/honest-test-gate/0001-registry-runner-and-run-record.md:64` and `engineering-team/stories/honest-publish-reporting/1-publish-result-tells-the-truth.test-plan.md:134`. `npm ci` and `npm test` are at `:40-41` now. Only the comment in the test is worth correcting, and that file is the Tester's.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

1. **The Reviewer role, workflow 5 and the review template all say to run `npm test`, and none says what a full run does to a stack that answers.** Already tracked: `ledger/2026-11-13-live-suites-have-no-off-switch.md`, this story's own row, and OPEN.md row 294. This review is another case of row 294's "no full run at all". Add it there; no new row.
2. **The template's `## On PASS (same commit)` heading comes after the verdict and carries a verdict word,** so a review written to the template that requests changes lints as a pass. Already tracked: `ledger/2026-10-07-on-pass-heading-reads-as-verdict.md`. I moved the section above the verdict by hand. One more occurrence for that row.
3. **`scripts/harness-def-paths.txt:16-18` says the workflows are retired and "no workflow runs".** This story exists because they run. Already tracked: `ledger/2026-10-29-h2-0-baseline-predates-github-flow.md`, item 3 of its fix list. That row places the comment on `main`; it is in this branch's tree too.
4. **New: nothing in Test Design asks whether a registered suite is already red before a test plan names CI as its gate** (B2). The row for the red suite has been OPEN since 2026-11-07, and says what every pull request into `staging` will show. Candidate: workflow 3 checks the OPEN `bug` rows that name a failing suite whenever a plan takes its gate from CI. Or a note on that row.
5. **New: Planning counted "every workflow" from one branch's folder** (non-blocking 4). `scripts/long-lived-branches.txt` lists the branches a change like this has to hold on. Candidate: a story about every file of one kind lists that kind on each long-lived branch at intake.

## On PASS (same commit)

- [ ] Not applicable: the verdict is CHANGES_REQUESTED.
  - The story's `**Status:**` stays `Approved`, and no completion detection was run.
  - Next round: the Implementer changes the runbook (B1). For B2, either the S2 fix lands first or the Tester amends the test plan and the owner's OK is recorded. Non-blocking 1 and 2 are the Tester's, if taken in the same round. Then this review re-derives the changed lines, runs the three suites again (D1 to D4 read OPERATIONS.md) and runs the lint.
  - The optional independent check (workflow 5) is the launching session's to apply before it commits this file. This session commits nothing.

## Verdict

**CHANGES_REQUESTED**
