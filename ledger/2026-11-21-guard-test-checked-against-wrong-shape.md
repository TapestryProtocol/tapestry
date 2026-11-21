# Test Design checked a widened guard test against a stand-in that didn't have the shape its ADR prescribed, so the gap reached Review

**Id:** 2026-11-21-guard-test-checked-against-wrong-shape
**Type:** meta
**Opened:** 2026-11-21 (graph-operations-first-slice #34, Loom A10.34: review round 1, finding 1)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The prescription.** ADR graph-operations-first-slice/0034 Decision 11 widened community-reference ADR 0004's RE1 sentinel (`test/publish-export-a-concept.test.js`) so that "a third publisher built the same way" as export nostr's would be caught.
- **What Test Design checked.** RE1's bite was checked against a throwaway stand-in publisher that named `AbstractRelay` beside `.publish(`. That is the shape RE1's pattern looks for.
- **The real shape.** The sender the ADR prescribed takes its relay from import's `_relay.js` `open()` and names no relay class. RE1 never saw that shape.
- **Where it surfaced.** Review round 1 placed two copies of export's real `_send.js` outside the excluded folders, and RE1 passed them (finding 1, blocking). A round of fixes followed, tests first.

**The lesson.** When a sentinel test is widened to catch "a publisher built like X", check its bite against a copy of X's real code, not a stand-in written to match the sentinel's own pattern. A stand-in that matches the pattern proves only that the pattern matches itself.

**Fix shape.** One line in `engineering-team/workflows/3-test-design.md`'s pitfalls, or in the Tester role: a sentinel's red check runs against the real artifact it names, or a copy of it, once that artifact exists. Until then the check waits for Implementation, and Review re-runs it.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/34-export-nostr.md` (round 1, finding 1; round 2's harness note); `test/publish-export-a-concept.test.js` (RE1).
