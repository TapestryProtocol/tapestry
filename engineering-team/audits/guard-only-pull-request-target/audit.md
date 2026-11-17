# Build Audit: Only the main-source guard runs on `pull_request_target`

**Book:** `engineering-team/audits/guard-only-pull-request-target/book.md`
**Date:** 2026-11-17
**Branch / commit range:** `ed18d8e1..2ec98ec6`. The work is TapestryProtocol/tapestry#105, branch
`fix/guard-only-pull-request-target`:
- `32d6ae8f`: intake;
- `8994805a`: implementation;
- `15a64cdd`: review round 1, CHANGES_REQUESTED;
- `925d5677`: round 1's fixes;
- `7dd89c9b`: review round 2, PASS;
- `2ec98ec6`: merged into `staging`.
**Provenance:** Acceptance-frame
**Confidence:** high. The frame was confirmed by the owner before any work, the book holds one story, and the diff stays
inside that story's declared blast radius (review round 1, "Blast radius" check; round 2 re-checked it).

> The Build Audit is the **as-built record** — what the product *is* now, factual and source-linked. It is audience-neutral: the product team reads it to scope the next phase; a future engineer reads it to understand what shipped. It does **not** propose changes — that's the addendum/seed's job.

## 1. What shipped
- **CI refuses any workflow other than `guard-main-source.yml` that runs on `pull_request_target`.** Every `npm test`,
  and so every pull request's `stack-free` check, reads `.github/workflows/` and reports
  `<file>: EVENT: runs on pull_request_target, …` for any file not on the list. It catches the event in any of the
  three forms `on:` takes (`stories/done/guard-only-pull-request-target/1-only-the-guard-runs-on-pull-request-target.md`).
- **CI keeps the allow list honest.** It fails when the list names a file that's gone, or one that no longer runs on the
  event (R6). It also fails when no Actions policy definition in `.github/rulesets/` names a listed file, by its exact
  path, with `pull_request_target` allowed (R7). A rename of the guard therefore has to change the list and the policy's
  definition together.
- **The rule is written down.** OPERATIONS.md §18.4 states it and gives the three steps to add a workflow:
  1. a review against GitHub's guide;
  2. the list;
  3. a policy that allows its events, which is the owner's decision.

  §3, §4 and §18's opening, and `.github/rulesets/README.md`, point to it.

## 2. Epics & stories rolled up

### Epic: `guard-only-pull-request-target`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 only-the-guard-runs-on-pull-request-target | The EVENT rule, its tests (S17–S20, R5–R7, M2, D5) and the docs | Done | `reviews/done/guard-only-pull-request-target/1-only-the-guard-runs-on-pull-request-target.md` (round 1 CHANGES_REQUESTED, 4 blocking; round 2 PASS) |

## 3. As-built inventory
- **User-facing:** none; no page, endpoint or command changed. Developer-facing, three new CI failure messages:
  - `EVENT`, for a workflow that isn't on the list;
  - R6, for a list entry that is stale;
  - R7, for a list entry no policy definition covers.
- **Domain:** no concept, handle, schema or firmware touched, so no firmware reinstall is needed.
- **Data & contracts:**
  - **`test/workflow-hardening.test.js`:**
    - `PULL_REQUEST_TARGET_FILES` (today `['guard-main-source.yml']`);
    - `eventsOf(doc)`, which reads `on:` as a string, a list or a map, as GitHub's workflow parser does (review round 1);
    - `checkEvents(wf)`, which `allFindings` now runs as its fifth check;
    - `policyDefinitionsIn(dir)` and `allowsPullRequestTarget(def, path)`;
    - `made()` takes an `on` option;
    - 36 tests in the file, 14 of them new.
  - **R7 reads `.github/rulesets/*.json`:** the README's "Nothing reads or applies them" is now "Nothing applies them", and
    it names that test.
  - **No workflow file changed.**
- **Docs:**
  - OPERATIONS.md: §3's rule count; §4's third policy bullet; §18's opening; the new §18.4, "`pull_request_target`: the
    main-source guard only".
  - `.github/rulesets/README.md`.
  - The test file's header: four rules, the guard-suite clause rewritten, and the story paths under `stories/done/`.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame, "The check" / AC-3 as first written: the list names no file that is gone or no longer runs on the event | Also R7: each listed file must be named, with the event allowed, in a policy definition in `.github/rulesets/` | added-beyond-scope | Review round 1 non-blocking 2. The docs said the list and the policy can't drift, and only R6 stood behind it. AC-3 was amended with a note | None for users. CI now also fails when the policy's definition stops naming a listed file | §6: R7 doesn't read `enforcement`, or a wildcard `exclude` |
| 2 | Frame, "The docs" / AC-4 as first written: a workflow gets on the list with "the same path added to the Actions policy" | §18.4 step 3: an Actions policy that names the path and allows the workflow's events, the owner's decision | intentional-change | Review round 1 blocking 3. The existing policy allows `pull_request_target` alone, so adding a second path there would stop that workflow's other events. AC-4 was amended with a note | A future `pull_request_target` workflow needs the owner's policy decision, recorded in `.github/rulesets/` | — |
| 3 | §18.4 as first written: "Without it, GitHub refuses to start the workflow from 2026-12-02", and step 1's "follows the guide's hardening" for code that must run | Step 3 says GitHub *may* refuse it, the unknown the story is built around. Step 1 says a workflow on this event never runs a pull request's code, and that the guide's four hardening controls apply to every workflow on the list | interpretation | Review round 1 blocking 1 and 2, checked against the guide's § "Hardening" on 2026-11-17 | None for users. The docs now match GitHub's guide | — |

**Undocumented work:** none. Every file in `ed18d8e1..2ec98ec6` sits in the story's blast radius, as the story file declares it after round 1's
amendment. The header's story paths, which pointed at `stories/` before `done/`, were fixed under round 1's
non-blocking 4. That was pre-existing drift, in a line the story was already editing.

## 5. Quality state at close
- **Test gate.** The full `npm test` was **not run on the owner's Mac at close.** There the suite writes to the live local
  instance, which holds the owner's agent memory (OPEN.md row `2026-11-14-harness-points-tests-at-agent-memory`, which
  now lists this step). The full suite ran in CI instead: `stack-free`, `npm ci && npm test` on a clean runner, **passed**
  on TapestryProtocol/tapestry#105 (run 43999081306, 7m25s). It ran against #105 merged into `staging`, the tree this book
  leaves behind. No `npm run gate:status` line exists for either run: `gate:status` reads local run records, and neither
  run made one (OPEN.md row `2026-10-09-light-gate-b-no-gate-status`). The story's scoped gate, which only reads files,
  ran on this close's tree: see the close commit's message.
- **Mutation evidence (the reviewer's script):** round 1, 18 of 21 mutations caught; round 2, 37 of 41. The four that
  survive are the two non-blocking gaps in §6.
- **Staging:** deploy run 44000226873 on `2ec98ec6`, 1m45s. The smoke test was clean, with the bundle unchanged
  (`index-D1TtEuL5.js`), and `get-user-data`'s known 504 for the test pubkey was the only non-200.
- **Known open issues / accepted bugs:** the two gaps from round 2 below. No ADR, so no ADR debt.

## 6. Carry-forward register
- [ ] **R7 counts more than GitHub would.** It ignores a definition's `enforcement`, so one set to `disabled` still counts.
  It also matches `exclude` by exact path, so a wildcard pattern that excludes the guard isn't seen (review round 2,
  non-blocking 1).
- [ ] **No test pins §18.4 step 1:** the guide's rule that a workflow on this event never runs a pull request's code, and
  that its hardening applies to every listed workflow. Deleting the step leaves D5 green (review round 2, non-blocking 2).
- [ ] **Still unknown:** whether GitHub's default block still covers the repo's other workflows once a path-scoped policy
  exists. The rule makes it moot here. Revisit if GitHub documents it (story, "Not covered").
- [ ] **No rule for GitHub's other privileged triggers,** `workflow_run` and `issue_comment` (story, "Out of scope").

## 7. Process findings (harness)
`scripts/harness-stats.sh` at retro time (2026-11-17):
- 335 reviews parsed; 102 have a kick-back in their history.
- This book has four counted phase commits (`impl:` ×2, `review:` ×2; the `intake:` commit isn't a counted prefix).
- Its Gate B round 1 raised 8 findings (4 blocking). The Light trial's comparison line is the corpus median of 3 findings
  per Gate B review, so the single human stop still had a reviewer with teeth behind it.

| Finding | Source (journal / review / deviation / meta row) | Terminal state (commit `<sha>` · OPEN.md row <n> · declined: <reason>) |
|---|---|---|
| A Light Gate B's scoped gate leaves no `gate:status` record. It recurred here, and at close too, since CI's run makes no local record | Story 1's review, round 1, harness friction 1; §5 | OPEN.md row `2026-10-09-light-gate-b-no-gate-status` (existing). Ports to Direction mode as well: its gates quote the same line |
| The review template's close-out after `## Verdict` would make a CHANGES_REQUESTED review parse as PASS. Avoided this time by putting the close-out above the verdict | Story 1's review, round 1, harness friction 2 | OPEN.md row 28 (existing; its fifth occurrence was recorded on 2026-11-16) |
| Book close step 10's `npm test` can't run on the owner's Mac: it writes to the agent-memory instance. CI's `stack-free` on the change stood in | This close, §5 | OPEN.md row `2026-11-14-harness-points-tests-at-agent-memory` (existing; a dated note now adds `6-book-close.md` step 10 to its list) |
| **Light trial, followed or bent.** Followed: Bug lane, Implementer + Reviewer, one human stop at Gate B; the scoped gate named in the story; Gate B at full rigour, two rounds. Bent: none of Light's own rules. The opt-in itself took one extra human exchange at intake (path and frame), which Light's lane table doesn't count | `workflows/light-profile.md` § "Trial protocol" | Declined: no change. The exchange is 0-intake's step 5 (confirm the path), which every lane has, and the book records it |
| **Bug or Feature.** The story adds enforcement, which 0-intake's table would call new behaviour (a Feature) | Story 1's review, round 1, classification note | Declined: the story closes a protection gap that the repo's own Actions policy may have opened, which is 0-intake's "existing behavior is wrong". The story's Type line gives the reason |
| **Two acceptance criteria (AC-3, AC-4) were amended during review round 1** | Story 1's review, round 1, blocking 3 and non-blocking 2; the story's AC notes | Declined: the process worked as designed. The review caught AC-4's premise gap, each amendment carries a dated note, and the owner ratified both at Gate B. Same in human-gated Standard |
| **The test file's header said Phase 4 never edits it,** which a story whose deliverable is a new rule there has to do | Story 1's Design note; review round 1, blocking 4 | Declined: settled in the file itself. Its header now allows a story's own `WRITE_SCOPES` or `PULL_REQUEST_TARGET_FILES` entry, and a rule-adding story with its own S, R and M tests. `templates/adr.md`'s carve-out is about repairing suites and needs no change |
