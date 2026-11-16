# GitHub will block `pull_request_target` in public repositories from 2026-12-02, and main's required `main-source-guard` runs on it, so no pull request could then merge into main

**Id:** 2026-11-16-main-guard-blocked-by-github-policy
**Type:** bug (CI: a check main's ruleset requires)
**Opened:** 2026-11-16 (graph-operations-first-slice #41's promotion, TapestryProtocol/tapestry#96)
**Status:** OPEN
**Done:** —

**What was seen.** Three runs of `guard-main-source.yml` ended in `startup_failure`, with no job started:
- 43904518731, at 16:10:22Z, when #92's merge moved staging, the head of the then-open #95;
- 43905341086, at 16:14:47Z, when #96 opened;
- 43907439787, at 16:26:05Z, when #96 was reopened.

The run at 15:47:55Z had passed. The workflow file hadn't changed, it is the same on main and staging, and the `Test` workflow ran normally throughout. The runs' annotation named the cause: a scheduled brownout of GitHub's default protection for `pull_request_target` in public repositories, until 18:00 UTC that day. It said an administrator can let such workflows run by explicitly allowing `pull_request_target` in an applicable Actions event policy.

A startup failure can't be rerun (`gh run rerun`: "This workflow run cannot be retried"). After 18:00, #96 was closed and reopened, and the guard passed (43924498162, 18:01:44Z). #96 merged at 18:11:23Z, so the brownout held it for about two hours. GitHub's status page showed an "Incident with Pull Requests" in monitoring at the same time; it doesn't explain these runs.

**Why it matters.** GitHub's guide "Securely using pull_request_target", § "Default policy for pull_request_target", says a default event policy blocks `pull_request_target` in public repositories that have no applicable Actions event policy. It runs in evaluate mode for now, and GitHub will enforce it on 2026-12-02. Main's ruleset, `main-requires-pr-before-merging`, requires `main-source-guard` and has no bypass actors (OPERATIONS.md §4). Once the policy is enforced the guard never runs, so every pull request into main stays `BLOCKED`: promotions from `staging` or `promote/*`, and `hotfix/*` alike.

**Fix shape.** Options, for the owner to choose between before 2026-12-02:
- **Allow `pull_request_target`** in an Actions event policy that applies to this repository: an administrator's settings change. The guard is the kind of `pull_request_target` workflow the guide treats as safe. It checks out nothing, runs nothing from the pull request, and reads only `github.head_ref` (the workflow's header comment).
- **Move the guard to another event,** keeping what `pull_request_target` gives it: a pull request can't edit the guard away in the same pull request (the header comment, written after PR #446).
- **Enforce the source rule another way,** and take `main-source-guard` out of the ruleset's required checks.

Whichever is chosen, OPERATIONS.md §4 and `/cycle-prod` should say what a `main-source-guard` startup failure means, and that a new pull-request event (closing and reopening) is the only way to run it again.

**Chosen, 2026-11-16: the first option.** The owner sets an Actions policy, `allow-pull-request-target-for-main-source-guard`, in Settings → Actions → Policies. It names `guard-main-source.yml` by its path and allows that workflow `pull_request_target`, so the guard keeps its trigger and its protection. Moving the guard to `workflow_run` was the alternative: GitHub runs that event only from main's copy too, but the guard would need a write scope to post its check, and could first be tried only after its own promotion. `.github/rulesets/allow-pull-request-target-for-main-source-guard.json` is the policy's definition, and OPERATIONS.md §4 and `/cycle-prod` now say what a startup failure means.

**Closing it.** Until 2026-12-02 GitHub only reports what its default policy would block, so a guard run that passes before then proves nothing about this policy: it would pass with the policy missing, disabled, or naming a path GitHub doesn't match. Close this row on evidence that tests the policy:
- before 2026-12-02: Policy insights (Settings → Actions → Policies → Policy insights) lists the guard's earlier runs among those the default would block, and doesn't list its run on a real PR into `main` made after the policy was created; or
- on or after 2026-12-02, or during a brownout: a guard run on a real PR into `main` that passes.

When the owner has created the policy, record the date and its id here. Then have someone with admin read it back (`gh api repos/TapestryProtocol/tapestry/actions/policies/<id> -H 'X-GitHub-Api-Version: 2026-03-10'`) and compare it with the file, the way the rulesets' files were read from a live API.

**Pointer:** `.github/workflows/guard-main-source.yml`; OPERATIONS.md §4, "Branch protection rulesets"; OPEN.md row 155; #96's checks and comments; GitHub's guide, `https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target`.
