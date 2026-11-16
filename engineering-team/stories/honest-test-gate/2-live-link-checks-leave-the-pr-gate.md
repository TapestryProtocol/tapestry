# Story 2: The pull-request gate stops checking live links; a weekly run checks them and files an issue

**Status:** Approved
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
  (a person's own or the scheduled one), when the two suites run, then each link check behaves as it does
  today. A 2xx passes. A network failure, or a cloud egress gateway's own 403, is SKIP with its reason. Any
  other status fails, naming the link and the status.
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

## Linked artifacts

- ADR: none. Architecture is skipped: a Bug under Standard, with the design chosen by the owner from ledger
  row `2026-11-16-link-check-fails-during-prod-deploy`'s options on 2026-11-16.
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
