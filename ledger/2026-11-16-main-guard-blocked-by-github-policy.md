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

**Pointer:** `.github/workflows/guard-main-source.yml`; OPERATIONS.md §4, "Branch protection rulesets"; OPEN.md row 155; #96's checks and comments; GitHub's guide, `https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target`.
