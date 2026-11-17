# Story 1: Only the main-source guard runs on `pull_request_target`

**Status:** Done
**Created:** 2026-11-17
**Type:** Bug *(Light lane: workflows/light-profile.md, Implementer + Reviewer, one human stop at
Gate B. No irreversibility trigger fires: one rule in a test file, and docs. Scoped gate:
`node -e "Promise.all(['./test/workflow-hardening.test.js','./test/ci-test-job.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"`.
Both suites only read files, so the gate never touches a live instance.)*

## Background
From 2026-12-02 GitHub blocks `pull_request_target` in public repositories that have no
applicable Actions event policy. `main-source-guard` runs on that event, so the owner created an
Actions policy, `allow-pull-request-target-for-main-source-guard`, that allows the event for
`.github/workflows/guard-main-source.yml` alone. On 2026-11-17 Policy insights showed that the
policy covers the guard (ledger row `2026-11-16-main-guard-blocked-by-github-policy`, closed by
TapestryProtocol/tapestry#102).

The policy says nothing about any other workflow. GitHub's docs say the default is added only
where no applicable event policy exists, and they don't say whether a policy scoped to one path
leaves the default in force for the repository's other workflows. If it doesn't, a later PR could
add a second `pull_request_target` workflow and GitHub would run it. That is the case the default
exists for: a write token next to code from a pull request. Before the policy, from 2026-12-02 on,
GitHub would have refused it. Nothing in the repo refuses it now.

## User-facing description
As whoever reviews a change to `.github/workflows/`, I want CI to fail on any new workflow that
runs on `pull_request_target`, so that adding one is a decision someone makes on purpose, with a
review against GitHub's guide and a matching change to the Actions policy, and never an accident
that GitHub may no longer stop.

## Acceptance criteria
- [ ] AC-1: Given a workflow file other than `guard-main-source.yml` whose `on:` names
      `pull_request_target`, written as a single event name, inside a list, or as a map key with
      or without settings, when `test/workflow-hardening.test.js` checks it, then it reports one
      finding that starts with the file's name and the rule, `EVENT`, and says where the allowed
      files are listed.
- [ ] AC-2: Given `guard-main-source.yml` on `pull_request_target`, or any workflow on `push` or
      `pull_request`, or one that only mentions `pull_request_target` in a comment, a job name, a
      script or an `if:` expression, when the check reads it, then it reports nothing.
- [ ] AC-3: Given the real `.github/workflows/`, the check reports nothing. The list of allowed
      files names no file that is gone and none that no longer runs on the event, and none that no
      Actions policy definition in `.github/rulesets/` names with the event allowed. And each real
      workflow not on the list, changed in memory to run on the event, is caught.
      *(The definition clause was added at review round 1, non-blocking 2.)*
- [ ] AC-4: OPERATIONS.md §18 states the rule, its list, and how a workflow gets on it: a review
      against GitHub's guide, and an Actions policy that names its path and allows it the event.
      §4's policy paragraph and `.github/rulesets/README.md` point to it where they say the policy
      covers no other workflow. *(Amended at review round 1, blocking 3: it said "the same path
      added to the Actions policy". That policy allows `pull_request_target` alone, so adding a
      path there suits only a workflow that runs on that event alone.)*

## Design note *(Light profile: provisional here, ratified at Gate B)*

**Approach.** One more rule in `test/workflow-hardening.test.js`, beside PIN, TOKEN and ENV:
- `PULL_REQUEST_TARGET_FILES = ['guard-main-source.yml']`, a list in the file, the way
  `WRITE_SCOPES` lists write scopes;
- `eventsOf(doc)` reads `on:` the three ways GitHub accepts it: a string, a list of strings, or a
  map keyed by event;
- `checkEvents(wf)` reports `<file>: EVENT: …` when `pull_request_target` is among a file's events
  and the file isn't on the list;
- `allFindings` runs it with the other checks.

It reads the parsed document, never the raw text, so the event's name in a comment, a script or a
job's name can't trip it. js-yaml reads the key `on` as the string `on` in every form, checked on
2026-11-17. `made()` gains an `on` option for the fixtures; its default keeps today's `on: push`.

**Alternative rejected: a new suite of its own.** The file's header says it is a guard suite, and
that the phase that changes the workflows never edits it. A separate suite would leave it
untouched, but would copy its reading of the folder and split the workflow rules across two
files. That header bound story `workflow-hardening` #1's implementer, whose job was to change the
workflows. This story's deliverable is a rule in the guard, so the guard is the file to change.
The new rule carries its own S, R and M tests, as the file's own convention asks: a rule that
silently found nothing would pass every real file. The header is updated to say so.

**Blast radius.**
- `test/workflow-hardening.test.js`: the rule, the `on` option of `made()`, the helpers
  `policyDefinitionsIn` and `allowsPullRequestTarget`, the tests S17–S20, R5–R7, M2 and D5, and
  the header (its story paths now under `stories/done/`).
- `OPERATIONS.md`: §3's rule count, §18's intro and a new §18.4, and §4's third policy bullet.
- `.github/rulesets/README.md`: a few sentences. R7 reads the policy's definition there, so "Nothing
  reads or applies them" becomes "Nothing applies them", and the README names the one test that
  reads them.
- No workflow file changes, so nothing under `.github/workflows/` and no CHANGELOG row (lint L10
  reads no listed path here).
- Not consumers, checked by grep: `test/ci-test-job.test.js` and `test/live-link-checks.test.js`
  read the workflows themselves and never call this file's checkers; `run()` is the file's only
  export.

## Edge cases & not-covered
- **Edge:** `on: pull_request_target` as a bare string, `on: [push, pull_request_target]`, and
  `pull_request_target:` as a map key with no value (js-yaml gives `null`) or with settings. All
  four are AC-1 fixtures.
- **Edge:** a quoted key, `"on": pull_request_target`. js-yaml reads it the same, and S18 includes
  it.
- **Regression sentinel:** R6 fails when the list names a file that's gone or no longer uses the
  event. R7 fails when the list names a file that no policy definition in `.github/rulesets/`
  names, by its exact path, with `pull_request_target` allowed. Together they keep the list and the
  policy's definition from drifting apart. The live policy is the owner's to match (§4).
- **Edge:** a file whose name only contains a listed name (`old-guard-main-source.yml`) is caught:
  the list matches whole names (S18). An empty `include` in a definition means every workflow to
  GitHub, and doesn't count for R7 (S20).
- **Regression sentinel:** M2 changes each real workflow not on the list to run on the event, in
  memory, and expects the check to notice. It proves the rule binds today's files and isn't
  matching nothing.
- **Not covered:** a reusable workflow called from the guard, which runs under the caller's event
  (no workflow here calls one), and a `workflow_run` workflow, GitHub's other privileged trigger.
  Neither is named by the default policy this story answers.
- **Not covered:** whether GitHub actually runs a second `pull_request_target` workflow today. That
  is the unknown the story works around, and testing it would mean adding one.

**AC → handle lines:** AC-1 → S18; AC-2 → S17, S19; AC-3 → R5, R6, R7, S20, M2; AC-4 → D5, and
the review's claims-adherence check for §4 and the README.

## Out of scope
- Changing the Actions policy, or any GitHub setting. The owner's, and unchanged.
- Rules for other events GitHub calls risky (`workflow_run`, `issue_comment`).

## Open questions
None.

## Linked artifacts
- ADR: none (Light Design note above; no trigger).
- Test plan: the Edge-case and AC→handle lines above (Light: the story file carries them).
- Review: `engineering-team/reviews/guard-only-pull-request-target/1-only-the-guard-runs-on-pull-request-target.md`
