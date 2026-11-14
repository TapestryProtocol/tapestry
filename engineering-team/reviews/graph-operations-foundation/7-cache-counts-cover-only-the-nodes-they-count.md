# Review: Story 7 — The cache counts cover only the nodes they count

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-11-13
**Diff:** `git diff e62a5f92...HEAD` (commit `7554ffda`, branch `fix-tapestry-key-counts-addressed-nodes`)

The same session wrote this story, its tests, the fix and this review, as it did for story 3. The evidence that doesn't rest on the session's own word has two parts. First, the test plan's candidate table (five fixes tried against the tests, two of them wrong). Second, the checks below, re-run for this review. The pull request's review by a teammate is the second pair of eyes.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test`, in the cloud workspace (no Docker, no Neo4j, so every live suite is skipped):
  `20261113T221637Z-189-a89b [story7-review] started 2026-11-13T22:16:37.877Z on 7554ffda — FAIL, exit 1, 7064 passed, 1 failed, 598 skipped, 338/338 suites; failed: setup-alert-polish`.
  - The one failure is `setup-alert-polish` S2, and it fails on `staging` without this branch. Run on `e62a5f92` in a temporary worktree, the suite gave 16 passed and 1 failed (S2). The cause is `ui/src/pages/reading/writeVerbs.js:278`, a hand-made `POST /api/strfry/publish` from `8a0b78e0`, which this branch doesn't touch. It is tracked as ledger row `2026-11-07-reading-writeverbs-raw-publish`.
  - The operations gate passes 201 of 201. That is the earlier 196, plus C1–C4 and C6.
- [x] Story 7's suites, run directly: `cache-counts.test.js` passes 7 of 7, and `status.test.js` passes 9 of 9.
- [ ] `npm run test:playwright`: not applicable. No UI changed.
- [x] _Lint not configured — skipped._ `scripts/harness-lint.sh`: clean (0 violations).
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence

- [x] **Every acceptance criterion has a passing test.**
  - AC1 is covered by C1 (after `tapestry-keys`, exact and adding up) and C5 (before it).
  - AC2 is covered by C2 and P7.
  - AC3 is covered by C3. For each caller it checks that the graph was read, that exactly the 4 counted keys were looked up once each, and that no returned row holds any of the 3,000 unaddressed keys.
  - AC4 is covered by C4 (`'{}'` and missing keys are never looked up), C5, C6 (the migrations part still counts all 3,008 nodes) and P2.
- [x] **No criterion is silently dropped.** AC1's example uses 3 million `NostrUser` nodes; the tests use 3,000. What the tests check is which nodes are read, and that doesn't depend on how many there are. The plan says so, and names the post-merge check on staging that sees the real scale.
- [x] **No behavior added that isn't in the story.** `src/api/tapestry-key/index.js` gains one predicate in one query (lines 61–65), and its comments say why (lines 32–36, 58). Nothing else in `src/` changed.

## ADR adherence

There is no story ADR, because the owner chose the Standard bug path on 2026-11-13. The fix restores what ADR `graph-operations-foundation/0001` Decision 11 says. Its table (line 220) gives the cache part's `nodes` as "that route's scope: nodes with a `uuid` or an `id`". Now the LMDB figures cover the same nodes.
- [x] **Files changed:** one source file. It holds the reader that both callers use, so neither caller needed changing (`status.js:208–220`, `index.js:96`).
- [x] **Layering:** unchanged.
- [x] **Dependencies:** none added. The new test helper, `test/helpers/nodeCypherFake.js`, needs only Node.

## Concept-graph integrity
- [x] **Handles:** none touched.
- [x] **Firmware:** no concept definition changed, so no reinstall is needed.
- [x] **Orientation:** not applicable. The change reads no concepts.

## Things tests can't catch
- [x] **No secrets** in the committed files.
- [x] **No debug logging and no commented-out code.**
- [x] **Edge cases where it matters.**
  - **`OR`/`AND` precedence.** The new predicate's parentheses (`index.js:63`) are what keep it from becoming `uuid IS NOT NULL OR (id IS NOT NULL AND …)`. The test plan's candidate (d) shows that this slip fails C4–C6.
  - **The key read covers the same nodes as the count.** It uses the same address filter as the count query (`index.js:42`) and the same key test (`index.js:44`). So `derived + empty + missing = initialized` holds unless the graph changes between the two reads, which was already true before story 3.
- [x] **Concurrency:** nothing new. The two reads aren't one transaction, as before.
- [x] **Security:** no input, and no change to who may ask. The route's access and status's `owner-and-admins` are as they were.
- [x] **The bug has no twin among the code's other whole-graph key reads.**
  - Initialize (`index.js:113–118`) has always keyed only addressed nodes. That is why the two counts agreed before story 3, and the fix brings that agreement back.
  - `deriveAll` and derive-status (`tapestry-derive.js:133–139`, `index.js:447–452`) read keyed nodes by label. The only labels with a deriver are concept-graph labels (`src/lib/derivers/index.js:14–23`), never `NostrUser`, so they don't reach the nodes `tapestry-keys` added.
  - The backup's and the migrations' whole-graph reads are meant to cover every node (story 3, ADR 0003 Amendment 2), and C6 confirms that they still do.

## House rules check
- [x] **Concept Graph API authority:** not applicable.
- [x] **Tooling:** no new lint, typecheck or build tooling.
- [x] **TA pubkey:** no literal added.

## Findings

### Blocking
None.

### Non-blocking
1. **`src/api/tapestry-key/index.js:39–88`**: each call still scans every node in the graph twice, once to count and once to read the keys. Before story 3 it was the same. What has changed is that no unaddressed row reaches the control panel now. On staging that is two scans of 3.85 million nodes inside Neo4j on every Dashboard load. Optional improvement: a single read of the addressed nodes' keys, counted in JS (the test plan's candidate (b), which passes the same tests), would halve that. If the Dashboard's load time matters, it should be a story of its own.
2. **`test/helpers/nodeCypherFake.js`**: the fake reads the Cypher subset it documents. Two limits matter to its next user, and neither affects these tests. A property named like a keyword (`n.end`, `n.set`) is refused with a clear message. `=` compares lists by reference, while Neo4j compares them by value.

### Harness friction
None in the repository's harness. In this session's clone, two things went wrong. The fetch refspec covered only `main` and the story-3 branch. So the Stop hook reported "1839 unpushed commit(s) and no remote branch" for a branch that was already pushed, and `git fetch origin staging` updated only `FETCH_HEAD` (seen in story 3 too). Adding a refspec and setting the branch's upstream fixed both. The template's "On PASS" heading problem is already ledger row `2026-10-07-on-pass-heading-reads-as-verdict`, so this review's close-out heading avoids the word.

## Verdict
**PASS**

The diff does what the story asks, with the smallest change that works. Every acceptance criterion has a test that passes. The one failure in the gate is on `staging` already and is tracked. Nothing blocks.

## Close-out (same commit)
- [x] Story `**Status:**` set to `Done` in place.
- [x] Completion detection was run, and its result is in the chat.
