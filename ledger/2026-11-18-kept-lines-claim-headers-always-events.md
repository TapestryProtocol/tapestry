# Eight lines the key-path guard keeps on NostrEvent alone are excused by "a header is always an event", which story 16 made false

**Id:** 2026-11-18-kept-lines-claim-headers-always-events
**Type:** cleanup
**Opened:** 2026-11-18 (story graph-operations-first-slice #44, Test Design)
**Status:** OPEN
**Done:** —

**What was seen.** `test/operations/lifecycle/nostr-event-lookups-kept.json` lists the lines that keep naming only `NostrEvent`, each with why. Eleven of them were excused by the same reason: a header is always an event. `graph create-concept` (story 16) makes a concept whose header has no event, so the reason no longer holds. Story 44 fixed or re-reasoned three:
- the Concepts page's scan;
- the Dashboard's concept counts;
- Shared by me's waiting count, which ADR shared-concepts-seeding/0002 holds to the Concepts page's list.

These eight remain:
- `src/api/adoption/index.js`;
- `src/api/normalize/index.js`, two lines;
- `src/api/property/index.js`;
- `ui/src/pages/reading/readVerbs.js`;
- `ui/src/pages/reading/writeVerbs.js`, three lines.

**Fix shape.** Judge each line on its own:
- **Right to keep, on another ground:** restate its reason. For example, the signing routes must not find a concept with no event (story 16, Out of scope).
- **An old tool a concept with no event should reach:** fix the line, if D15's low-hanging-fruit test passes, or leave it and say so in the reason.

None of this changes behavior until a line is fixed. G11 and G18 check only that each entry matches its line and carries a reason.

**Pointer:** `test/operations/lifecycle/nostr-event-lookups-kept.json`; `engineering-team/stories/graph-operations-first-slice/44-concepts-list-shows-concepts-with-no-event.test-plan.md` § "Left for a ledger row"; ADR graph-operations-first-slice/0016, Consequences.
