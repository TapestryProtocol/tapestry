# Test Design doesn't look for other stories' tests that the ADR contradicts, so they turn up at Implementation

**Id:** 2026-11-13-test-design-misses-other-suites
**Type:** meta
**Opened:** 2026-11-13 (graph-operations-foundation #3 review, harness friction 1)
**Status:** OPEN
**Done:** —

ADR `graph-operations-foundation/0003` changed things other stories' suites assert on: the `NostrEvent` label on add-subset's sets, `nodes.js`'s exact require list, the tagging-edges pass's "no SET on a node", the shape of `lifecycle status`'s migrations part, and the text of a Cypher lookup that a stub matches. Test Design wrote the story's own tests but didn't look for these. Four tests (G8's filter, story 1's H1, tagging-edges' SWR15, node-primitives' S1 with its live checks) turned up failing at Implementation. An Implementer may not change tests, so each went back to the Tester, with a gate question for the owner. A fifth (story 1's P7, which stubs the driver by matching a lookup's text) was avoided by keeping that lookup as it was.

Fix shape: at Test Design, for each thing the ADR changes — a label, a module's requires, a Cypher shape, an answer's fields — grep `test/` for assertions and stubs that name it. List the ones that change in the test plan's coverage map, so the Tester amends them in the same phase. Perhaps a line in `engineering-team/workflows/3-test-design.md`.

**Pointer:** the story 3 test plan's Amendment 1 table; review `engineering-team/reviews/graph-operations-foundation/3-a-tapestry-key-on-every-node.md`, harness friction 1

**Round 2 (same day):** the same cause showed up again, inside the story. G11 guarded only the first of Decision 9's three kinds of line (lookups by address). The scans and walks, and the lines about the event, were never classified, and only the live check, run last, caught it: the `set` concept's Elements tab loses event-less sets. A Test Design check: for every rule an ADR states over "every query that …", the guard covers every line the rule governs, not the kind it names first.

