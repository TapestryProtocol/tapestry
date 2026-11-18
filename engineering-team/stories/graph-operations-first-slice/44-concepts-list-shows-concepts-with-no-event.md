# Story 44: The Concepts page and the Dashboard show a concept with no event

**Status:** In Progress
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
- **The other nine kept lines on the same reason** are ledger row `2026-11-18-kept-lines-claim-headers-always-events`, as the test plan said.
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

## Linked artifacts
- ADR: none. Architecture was skipped, as for a bug with an obvious fix (David, 2026-11-18).
- Test plan: `engineering-team/stories/graph-operations-first-slice/44-concepts-list-shows-concepts-with-no-event.test-plan.md`
- Review: `engineering-team/reviews/graph-operations-first-slice/44-concepts-list-shows-concepts-with-no-event.md`
