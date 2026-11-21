# Community-reference ADR 0004's "no server-side external publisher" posture was already false three times, and its RE1 sentinel can't see any of the three

**Id:** 2026-11-21-server-publishers-re1-cannot-see
**Type:** docs
**Opened:** 2026-11-21 (graph-operations-first-slice #34, Loom A10.34: review round 2, finding 17)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The claim.** Community-reference ADR 0004 rejected a server-side external-relay publisher, and its RE1 test (`test/publish-export-a-concept.test.js`) is meant to hold that posture. dlist-curation ADR 0004 excused its own folder, saying the posture holds for every other module.
- **Three senders RE1 can't see** already published from the server:
  - assistant-profile's `publishToRelays` (`src/api/assistant/profilePublish.js`, assistant-profile ADR 0002) sends with raw `ws`, not `SimplePool`;
  - the NIP-85 publishers under `src/algos/nip85/`, sending to damus, primal and others since 2025-04, sit in a folder RE1 doesn't scan;
  - `bin/brainstorm-create-and-publish-kind10040.js`, which two routes spawn (`src/api/index.js:181, 183`), has sent to outside relays since 2025-08, from `bin/`, which RE1 doesn't scan either (review round 3, finding 19).
- **Export nostr's own sender** (`src/operations/catalog/export/`, ADR graph-operations-first-slice/0034 Decision 11) is excluded by name, and RE1 now also catches a publisher built its way.
- **What changed so far.** Story 34's fixes reworded ADR 0004's header, line 5, to name both exceptions. Its line 4, the dlist-curation amendment's dated line, still says the posture holds "for every other module".

**Fix shape.** Either:
- record the server-side publishers that exist as the posture's named exceptions, and widen RE1's scan (to `src/algos/` and `bin/`) and its pattern (to a raw `["EVENT", …]` frame sent over `ws`), with each exception excluded by name; or
- retire the posture as no longer the house rule, in an ADR of its own.

**Pointer:** `engineering-team/decisions/community-reference/0004-publish-export-a-concept.md` (lines 4–5); `engineering-team/reviews/graph-operations-first-slice/34-export-nostr.md` (round 2, finding 17).
