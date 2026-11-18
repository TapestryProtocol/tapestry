# Story 44: The Concepts page and the Dashboard show a concept with no event

**Status:** Approved
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

## Linked artifacts
- ADR: none. Architecture was skipped, as for a bug with an obvious fix (David, 2026-11-18).
- Test plan: `engineering-team/stories/graph-operations-first-slice/44-concepts-list-shows-concepts-with-no-event.test-plan.md`
- Review: (filled in after Review phase)
