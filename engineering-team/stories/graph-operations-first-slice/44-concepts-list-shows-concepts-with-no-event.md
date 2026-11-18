# Story 44: The Concepts page and the Dashboard show a concept with no event

**Status:** Done
**Created:** 2026-11-18
**Type:** Bug
**Loom:** none of its own. It follows up A10.16 (story 16), and bugs stay in the repo's own tracker.

## Background

`graph create-concept` (story 16) makes a concept with no event. Its header and core nodes are in the graph only, until `export nostr` (A10.34) publishes them. By D7, a node with no event has no `NostrEvent` label.

The Concepts page lists only headers with that label, and the Dashboard's Concepts tile counts only those. So a concept made through the graph operations appears on neither. Its own page finds a concept by its address, and shows it.

David found this on david.tapestry.ninja on 2026-11-18, looking for **concept graph rule**, a concept made that day as Zeus.
- **The page:** of the 54 headers in that brain's graph it listed 53, and concept graph rule was the one it skipped.
- **The tile:** it counted 47 concepts, not 48.
- **The health summary:** the audit's summary, which the page also reads, already rates concept graph rule Healthy.

Story 16 left "today's routes and the UI's concept list" out of scope under D15: the old tools aren't brought up to code, though low-hanging fruit is fine. David asked for this fix on 2026-11-18.

**The Disposition… button can't help these concepts.** Each row of this instance's own concepts with no `b` tag offers Disposition…, which has three actions: submit as a shared concept, wire to an external one, and keep private. Each re-signs the header's latest event. For a header with no event, each answers "No local header event found", and nothing is signed or published. David chose to hide the button on those rows (2026-11-18).

## User-facing description

As the owner, I want every concept in my graph on the Concepts page and in the Dashboard's count, whether or not it has been published as nostr events, so that I can find a concept I made through the graph operations the way I find any other. A row shouldn't offer me a button that can only fail.

## Acceptance criteria

- [ ] **AC1 — Listed.** Given a concept made with `graph create-concept`, which has no event, when anyone opens the Concepts page, then the concept has a row like any other concept's.
  - The row shows its name, author, counts of elements, sets and properties, core-node checks and health verdict.
  - It sorts by name with the rest.
  - Choosing the row opens the concept's own page.
- [ ] **AC2 — Counted.** Given the same concept, the Dashboard's Concepts tile counts it. On david.tapestry.ninja on 2026-11-18, that is 48 rather than 47.
- [ ] **AC3 — No Disposition… without an event.** Given the row of a concept with no event:
  - its disposition cell says the concept has no event yet, where rows of this instance's other undispositioned concepts offer Disposition…;
  - it isn't under Undispositioned (mine), and Save & next passes over it;
  - it is under Not yet shared (mine) and All states, and the Author filter lists it under this instance's assistant.
- [ ] **AC4 — Everything else as before.** Concepts that came from an event are listed, counted, filtered and dispositioned exactly as before. That holds on an instance that has run the `tapestry-keys` migration and on one that hasn't.

## Concepts touched

`<TA>` is the instance's assistant (`GET /api/assistant/pubkey`).

- `39998:<TA>:concept-header`: concept header (every header the page lists; read only).
- Any concept made with `graph create-concept`: its header and core nodes (read only).
- `39998:<TA>:concept-graph-rule` on david.tapestry.ninja: concept graph rule (the concept that showed the bug; read only).

## Out of scope

- **Other pages that find nodes only by `NostrEvent`.**
  - The Nodes page leaves out headers with no event, and the Dashboard's Nodes tile counts only nodes that have one.
  - The reading pages look a concept up among headers with an event.

  D15 leaves the old tools as they are unless a fix is cheap, and David asked about this page.
- **The Dashboard's onboarding check.** It counts concepts only to see whether the firmware is installed. `graph create-concept` refuses `not-installed` without the firmware, so a concept with no event can't change the check's answer.
- **The concept's own page.** It already shows these concepts. Its Submit as a Shared Concept button has the same trouble as the row's Disposition…: it needs the header's event. Changing that page is a separate fix.
- **Publishing a concept** (`export nostr`, A10.34). Once a concept has its event, its row offers Disposition… as any other's does.
- **Dispositioning a concept with no event,** for example keeping it private before it's published.

## Open questions

- None.

## Deviations

- **ADR graph-operations-first-slice/0016 has a dated note.** Its Consequences said the UI's concept list reads only `NostrEvent` headers, which this story makes false. The note says what changed and that the name lookups are as they were. The story didn't ask for it.
- **The kept-list's Dashboard entry stays, with a new reason.** The tile's line changed, but the onboarding check's line has the same text. So the entry stays, and its reason now names the onboarding check, which counts concepts only to see whether the firmware is installed (test S6). The Concepts page's entry is gone, since its line changed (G11 holds the list to the code).
- **The other kept lines on the same reason,** eight since round 2, are ledger row `2026-11-18-kept-lines-claim-headers-always-events`, as the test plan said.
- **Round 2: Shared by me's waiting count counts these concepts too.** None of the ACs named Shared by me. Its "Haven't shared these yet — N waiting →" links to this page's Not yet shared (mine), and ADR shared-concepts-seeding/0002 holds the two to one population. AC3 put concepts with no event on that list, so review round 1 found the count one short of it (blocking 1). David chose to count them (2026-11-18), keeping AC3 as approved. Shared by me's scan now matches this page's, and its kept entry is gone. Tests S7 and L5 hold the two together.
- **The row's event fact is a kept line of its own.** `h:NostrEvent AS hasEvent` names `NostrEvent` alone, so the key-path guard's G18 asked for it to be classified; the first scoped gate failed there. It is about the event itself, so it is in the kept-list, with why. The test plan hadn't foreseen it.

## Evidence

### The suites (Implementation, 2026-11-18)

Run on this Mac. No full `npm test` ran here: the local stack is the owner's agent-memory instance, and the PR's CI runs the full gate.

- **The new suite, stack-free** (`TAPESTRY_CONTAINER=no-such-container`): 9 passed, 0 failed, 4 skipped, the live checks among the skipped. Before the fix it was 2 passed, 7 failed, 4 skipped.
- **The same, under Node 22,** CI's version: 9 passed, 0 failed, 4 skipped.
- **The new suite on a scratch stack** (`tapestry-scratch`, this checkout's `src/`, firmware installed): 13 passed, 0 failed. Before the fix it was 3 passed, 10 failed.
- **The suite catches each part of the fix.** Six scratch edits were each undone and checked byte for byte against the fix, each run on the scratch stack:

  | Edit | Fails |
  |---|---|
  | The page's scan back to `NostrEvent` alone | S1, L1, L4 |
  | The page's scan by the shared label alone | S1, L3 |
  | The filter without its event check | U1 |
  | The tile back to `NostrEvent:ListHeader` | S3, L2 |
  | The Disposition cell without its no-event branch | S5 |
  | Save & next without its event check | S4 |
- **The first scoped gate failed, for two reasons.** It was run through the gate engine with every endpoint dead and Node 24.18.0. It ran the 14 registry entries that read a changed file: this story's suite, `not-yet-shared-filter`, `list-headers-disposition-column`, `admin-tools-dashboard-panel`, `assistant-setup-state`, `b-coverage-audit-and-disposition`, `concept-count-canonical`, `one-default-assistant-profile`, `one-writer-assistant-profile`, `openapi-document`, `operations.test.js` (every suite under `test/operations/`), `share-from-shared-by-me`, `stack-free-npm-test` and `tagging-edges-wiring`. `node test/gate-status.js --label story-44-impl` read:
  `20261118T160459Z-36367-601a [story-44-impl] started 2026-11-18T16:04:59.661Z on 6842af3d+dirty — FAIL, exit 1, 1328 passed, 4 failed, 28 skipped, 14/14 suites; failed: operations`
  - **G18 found the `hasEvent` line,** as the Deviations say. Fixed by listing it.
  - **W1, X1 and X2 couldn't load `express`.** The worktree had no `node_modules`: a link to the main checkout's packages had been meant during Test Design, but was never made, so the route walk had no packages. Fixed by linking the checkout's `node_modules`, as the other worktrees do. No code changed for these three.
- **The scoped gate, run again** with the same 14 entries, endpoints and Node, passes. `node test/gate-status.js --label story-44-impl-2` reads:
  `20261118T160933Z-43661-5cf5 [story-44-impl-2] started 2026-11-18T16:09:33.031Z on 6842af3d+dirty — PASS, exit 0, 1332 passed, 0 failed, 28 skipped, 14/14 suites`

### Round 2 (Implementation, 2026-11-18)

Review round 1's cases came first: S7, L5, and L1's element and set counts (`c37508a2`). Before the fix, on a scratch stack, they gave 13 passed and 2 failed, S7 and L5, each for the missing population. The test plan's Verification quotes them.

- **The suite, stack-free:** 10 passed, 0 failed, 5 skipped, under both Node 24.18.0 and Node 22.23.1.
- **The suite on the scratch stack:** 15 passed, 0 failed, 0 skipped.
- **The key-path guard alone:** 20 passed, 0 failed. G11 holds without Shared by me's old entry.
- **The new cases catch their parts of the fix.** Three scratch edits were each undone and checked byte for byte against the fix, each run on the scratch stack:

  | Edit | Fails |
  |---|---|
  | Shared by me's scan back to `NostrEvent` alone | S7, L5 |
  | Shared by me's scan filtering differently (kind 39998 only) | S7 |
  | The page's element walks by `NostrEvent` alone | L1 |
- **The scoped gate,** the reviewer's 16 registry entries, through the gate engine, every endpoint dead, Node 24.18.0. A stub `curl` and a stub `docker`, each refusing, were first on `PATH`, so `ledger-row-ids`' run of the session-start digest couldn't probe this Mac's stack. Run alone that way, the digest reported "stack absent" while the stack was up. `node test/gate-status.js --label story-44-round2` reads:
  `20261118T165237Z-42474-c07b [story-44-round2] started 2026-11-18T16:52:37.783Z on 8865dabf+dirty — PASS, exit 0, 1424 passed, 0 failed, 29 skipped, 16/16 suites`
  That is round 1's review gate, 1423/0/28, plus S7 passing and L5 skipped with no scratch stack. The dirty paths are this commit's own changes and the `node_modules` link.

### On staging and production (2026-11-18)

**Staging: TapestryProtocol/tapestry#147.**
- **Its CI:** the `Test` run 44379880357 (`stack-free`) passed on the PR's head, `fe1dafb4`.
- **The safe-to-merge check** against staging said safe at 19:34:20Z, on its first attempt, with no reasons.
- **The merge,** at 19:34:23Z, was pinned with `--match-head-commit fe1dafb4`. Its merge commit is `af64a4e7`.
- **The deploy:** `deploy-staging.yml` run 44381849992 succeeded, 19:34:26Z to 19:36:20Z.
- **The smoke test** (`docs/SMOKE_TEST.md`) was clean:
  - tier 1: stable after 3 polls, with Neo4j answering after 3;
  - tier 2: its 7 pages, 4 of its public APIs (all but `get-user-data`) and the search route answered 200;
  - tier 3: the served bundle, `index-DAxhuweK.js`, carries the page's new scan, `hasEvent`, "no event yet" and Shared by me's new scan. The page's own query gave 53 rows, each with `hasEvent`, none without an event. Asked with nothing declared, Shared by me's count and the Not yet shared list both gave 40. The tile's query gave 46;
  - tier 4, in Chrome: the Concepts page rendered its 53 concepts. Shared by me showed "3 shared" and "Haven't shared these yet — 37 waiting", and Not yet shared (mine) showed "37 of 53 concepts". The Dashboard's tile read 46, and no page logged a console error;
  - tier 5: the neighbouring routes answered 200.

  Staging holds no concept with no event, so only the hosted brain below showed the new row.
- **The hosted brains:** `publish-image.yml` run 44381850145 published and rolled them, 19:34:26Z to 19:43:41Z.
- **On david.tapestry.ninja,** which holds concept graph rule, a concept with no event, checked read-only after the roll:
  - it serves the same bundle;
  - the page's query gave 54 rows, up from 53. The one without an event is concept graph rule: not undispositioned, not yet shared;
  - in Chrome, its row says "no event yet" where Disposition… was;
  - Undispositioned (mine) showed 40 of 54, without it, and Not yet shared (mine) showed 41 of 54, with it;
  - Shared by me showed "0 shared" and "41 waiting";
  - the Dashboard's tile read 48, up from 47;
  - no page logged a console error.

  Its profile search answered 503, "Search service unavailable": the brain has no search service, and this story doesn't touch search.
- **No Loom task** follows this story; bugs stay in the repo's tracker.
- **No firmware reinstall:** no concept definition changed.

**Production: TapestryProtocol/tapestry#149,** the promotion.
- **What it carried:** staging at `af64a4e7`, from `promote/concepts-list-eventless-2026-11-18`, a branch cut at that commit. That is #147, and three records-only PRs merged before it:
  - #143: story 43's ship records;
  - #145: a ledger row on RW7's CI flake;
  - #146: story 22's ship records.

  The owner approved promoting #147. The other three are docs only, and were part of the staging commit verified above.
- **Its checks:** the `stack-free` run 44385615602 and the `main-source-guard` run 44385268273 passed on `af64a4e7`, as did `deploy` and `publish`.
- **The safe-to-merge check** against production said safe at 20:08:40Z, on its first attempt, with no reasons.
- **The merge,** at 20:08:43Z, was pinned with `--match-head-commit af64a4e7`. Its merge commit is `7163bf1d`.
- **The deploy:** `deploy-tapestry.yml` run 44387897853 succeeded, 20:08:46Z to 20:10:39Z.
- **The smoke test** was clean in tiers 1, 2, 3 and 5:
  - tier 1: stable after 3 polls, with Neo4j answering after 6;
  - tier 2: the same 12 answered 200;
  - tier 3: it serves `index-DAxhuweK.js`, with the change. The page's query gave 50 rows, each with `hasEvent`, none without an event. Shared by me's count and the list both gave 37, and the tile's query gave 45;
  - tier 5: the neighbouring routes answered 200.
- **Tier 4 couldn't be checked in Chrome.** That profile is signed in to production as neither owner nor customer. From that session, production answers every `POST /api/neo4j/query` with 403, "Proper authentication required", even `RETURN 1` and the page's old scan, so every page shows the error. The same queries with no session answer 200, as tier 3's did.

**Not checked on either server:**
- **A concept with no event on staging or production.** Neither holds one. The new row was checked on david.tapestry.ninja, and on a scratch stack by the story's live checks.
- **The agent-memory instance on the Mac Studio** has none of this code. It takes it only at the owner's word.

## Linked artifacts
- ADR: none. Architecture was skipped, as for a bug with an obvious fix (David, 2026-11-18).
- Test plan: `engineering-team/stories/graph-operations-first-slice/44-concepts-list-shows-concepts-with-no-event.test-plan.md`
- Review: `engineering-team/reviews/graph-operations-first-slice/44-concepts-list-shows-concepts-with-no-event.md`
