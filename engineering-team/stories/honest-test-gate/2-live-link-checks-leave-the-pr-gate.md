# Story 2: The pull-request gate stops checking live links; a weekly run checks them and files an issue

**Status:** In Progress
**Created:** 2026-11-16
**Type:** Bug

## Background

On 2026-11-16, PR #83's CI failed one test, `information-for-agents` L1: https://tapestry.brainstorm.world
answered 502 at 05:09:30Z, while a production deploy restarted the site (05:07:46Z–05:09:48Z). The site
answered 200 twenty minutes later. Every merge into `main` deploys, so any pull request whose CI reaches
that check during those minutes fails, whatever it changes. Ledger row
`2026-11-16-link-check-fails-during-prod-deploy` records it.

OPERATIONS.md §15 gives the pull-request gate no retries: its first run is the verdict, because the
stack-free suite is meant to hold no nondeterminism ("all documented nondeterminism lives in the excluded
live `*-publish` class"). The briefing's link check breaks that premise, and so does the same kind of check
in the llms.txt suite (its 12 links: GitHub raw files and `api.brainstorm.world`). Both fetch the public
internet on every pull request, and neither stands down when the stack is absent. A red from them says
something about a website at that minute, not about the pull request, which is the opposite of this epic's
goal: a red always means signal.

The owner chose on 2026-11-16, from the row's four options: take both link checks out of the pull-request
gate, behind a switch; run them every week on a schedule; and have a red weekly run open a GitHub issue. The
owner accepted the cost: a pull request that breaks a link is caught by the next weekly run, not by its own
CI. This is a Bug under Standard strictness, with Architecture skipped because the owner chose the design
(`workflows/0-intake.md` step 3, confirmed 2026-11-16).

**Who is affected:** everyone who opens a pull request, whose gate stops going red over someone else's
website; and whoever keeps the briefing and llms.txt current, who still hears about a dead link within a
week.

## User-facing description

As someone opening a pull request, I want the gate's verdict to depend on my change, not on whether a public
website is up at that minute, so that a red gate always means my change needs a look.

As whoever keeps the briefing and llms.txt current, I want their links still checked every week, with a dead
link showing up as a GitHub issue, so that link rot is still caught.

## Acceptance criteria

- [ ] **AC1. The pull-request gate fetches no links.** Given a run with the live link checks not switched on
  (the default, as in a pull request's CI), when the information-for-agents and llms.txt suites run, then
  none of their link checks makes a network request. Each is reported as SKIP, with a reason that says the
  live link checks are off and how to switch them on. Every other test in both suites runs and reports as it
  does today.
- [ ] **AC2. Switched on, the checks are today's checks.** Given the live link checks switched on, in any run
  (a person's own or the scheduled one), when the two suites run, then each link check follows the rules the
  briefing's check follows today. A 2xx passes. A network failure, or a cloud egress gateway's own 403, is SKIP
  with its reason. Any other status fails, naming the link and the status. For llms.txt's check this is a
  change, by the owner's ruling at the Test Design gate (2026-11-16): today it reads an egress 403 as a dead
  link, and its skips give no reason (ledger row `2026-10-04-llms-txt-egress-403-false-fail`).
- [ ] **AC3. A weekly run, and the same run on demand.** Given the weekly schedule, or a person starting the
  same run by hand from GitHub, when it runs, then it runs both suites with the live link checks switched on,
  and its log shows how many links passed, failed and were skipped. It ends red if any link check fails, and
  also red if it could check no link at all (every one skipped). Otherwise it ends green.
- [ ] **AC4. A red run opens an issue.** Given a scheduled or by-hand run that ends red, when it ends, then a
  GitHub issue in this repository names each failing link with its status, and links the run. If an issue
  from an earlier red run is still open, the run comments on that issue instead of opening a second one. A
  green run opens no issue. If an issue from an earlier red run is still open, a green run comments on it
  that every link resolves again, linking itself, and closes it.
- [ ] **AC5. The operations doc says where the checks went.** Given OPERATIONS.md §15, when a reader looks for
  what the pull-request gate leaves out, then it names the live link checks beside the live classes it
  already excludes, and says when they run instead, how to run them by hand, and where a failure is
  reported. Ledger row `2026-11-16-link-check-fails-during-prod-deploy` is closed in this story's pull
  request.

## Concepts touched

None in the concept graph. This story changes the test gate and CI, not the knowledge graph, so there are no
handles for the Architect to resolve.

## Out of scope

- The row's other three options: retrying a 5xx, reading a 5xx as SKIP, and building §15's quarantine file.
- Checking links in a pull request's own CI when it edits the briefing or llms.txt. The owner accepted that
  the weekly run catches those.
- Fixing any link that is dead today.
- The H-class and the other live checks against the stack, which already stand down when the stack is
  absent.
- Making the gate a required check, which stays §15's separate operator decision.
- Any other suite later found to fetch the public internet: that gets a new ledger row, not this story.

## Open questions

None left. Resolved by the owner on 2026-11-16: when a later run is green while an issue from an earlier red
run is still open, that run closes the issue with a comment naming itself (now part of AC4), so that a site
that was down for a minute leaves no open issue behind.

## Deviations

Judgment calls made in Implementation, too small for an ADR (the story has none):

- **One helper for both suites.** The briefing's link check (`checkLink`, `isEgressRefusal`) moved into a new
  `test/helpers/liveLinkChecks.js` with the switch, so both suites follow one set of rules (AC2), and the weekly
  run counts every check from the outcomes it records rather than by reading the suites' output. Its abort
  timer is now cleared on every path: before, a failed fetch left it pending for up to 15 s.
- **The new write scope is declared where §18.2 says.** `WRITE_SCOPES` in `test/workflow-hardening.test.js`
  gains `live-link-checks.yml: ['issues']`, and OPERATIONS.md §18.2 lists the workflow, in the same pull
  request that adds the scope, as that section requires.
- **The schedule** is Mondays at 07:23 UTC, off the hour as GitHub advises for scheduled workflows.
- **A failed `gh` call ends the run red** (exit 2, "the run itself failed"), so a report that couldn't be made
  is never silent.
- **After review round 1** (its non-blocking 1, 2, 7, 9 and 10). A green run that closes the issue names any link
  it could not check, since the dead link may be among them. With `--report`, a run that dies before it can count
  says so on the same issue: AC4 speaks only of runs that counted, but a crash is red too. The workflow's checkout
  keeps no git credentials, since the token can write issues while `npm ci` runs install scripts. OPERATIONS.md
  §15 says the schedule starts only from `main`, and §3 lists the workflows that aren't deploys. The October
  ledger row's note no longer limits itself to the pull-request gate. Loose ends from the review are ledger rows
  `2026-11-16-ci-gate-flake-history-claim-untrue`, `2026-11-16-story-numbers-ignore-planned-stories` and
  `2026-11-16-harness-docs-say-workflows-retired`.
- **After review round 2** (its blocking 1). The "could not run" report fires only when the suites fail before
  anything is counted. A `gh` call that fails after counting exits 2 and posts nothing more, so a dead link is never
  hidden behind a false "no link was counted". OPERATIONS.md §15 now says the schedule runs `main`'s copy, while a
  by-hand run can pick a branch.
- **Left as found, and flagged for the owner.** §15's "zero recorded-flake history" was already untrue on
  2026-11-16 (K1 and the launcher's destroy test, fixed in #90 and #91); this story only adds the link checks to
  the paragraph's excluded live classes. OPEN.md row 172 still says llms-txt's L1 checks the links on every
  `npm test`; they now run weekly or by hand, and the row is left for its next renewal.

## Linked artifacts

- ADR: none. Architecture is skipped: a Bug under Standard, with the design chosen by the owner from ledger
  row `2026-11-16-link-check-fails-during-prod-deploy`'s options on 2026-11-16.
- Test plan: `engineering-team/stories/honest-test-gate/2-live-link-checks-leave-the-pr-gate.test-plan.md`
- Review: `engineering-team/reviews/honest-test-gate/2-live-link-checks-leave-the-pr-gate.md`
