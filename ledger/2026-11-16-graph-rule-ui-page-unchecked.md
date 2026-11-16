# No one has opened the graph rule concept's page in the UI, so story 41's AC6 is checked only through the API

**Id:** 2026-11-16-graph-rule-ui-page-unchecked
**Type:** cleanup
**Opened:** 2026-11-16 (story graph-operations-first-slice #41; its review, round 1, non-blocking 6)
**Status:** OPEN
**Done:** —

**What was seen.** AC6 says the concept's page in the UI lists its items. The live checks ran on a scratch instance, which has no published ports, so they read the concept through `/api/concept-graph/summaries`, the node reads and `tapestry graph list-elements`. The page lists elements with the same class-thread walk (`ui/src/pages/concepts/ConceptElements.jsx:67–72`), so the risk is low.

**Fix shape.** Once the change is on staging and staging's firmware is reinstalled, open the graph rule concept's page there. It should list its six items, one per rulebook entry, each with its fields. Then close this row.

**Pointer:** the story's Known limits, `engineering-team/stories/graph-operations-first-slice/41-graph-rule-concept.md`; `engineering-team/reviews/graph-operations-first-slice/41-graph-rule-concept.md` (non-blocking 6).
