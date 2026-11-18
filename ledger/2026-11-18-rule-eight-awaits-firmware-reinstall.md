# The graph rule concept's eighth item, node-has-a-concept, reaches an instance only with a firmware reinstall there

**Id:** 2026-11-18-rule-eight-awaits-firmware-reinstall
**Type:** cleanup
**Opened:** 2026-11-18 (story graph-operations-first-slice #22, ADR graph-operations-first-slice/0022 Consequences, follow-up 9: "Firmware reinstall required? Yes, for rule 8's element")
**Status:** OPEN
**Done:** —

**What is pending.** Story 22 adds rule 8, `node-has-a-concept`, to `docs/GRAPH_RULES.md`. `node src/firmware/graph-rules.js` made it the eighth element file of firmware's graph rule concept (`firmware/versions/v1.0.0/concepts/graph-rule/elements/node-has-a-concept.json`). A deploy doesn't install firmware, so an instance's graph rule concept lists seven items until its firmware is reinstalled after the change reaches its code, as rule 7's did (ledger row `2026-11-16-rule-seven-awaits-firmware-reinstall`). `graph add-to-concept`, `graph remove-from-concept` and the rule work regardless: they are code. No concept's definition changes.

**What closes it.** A firmware reinstall on staging, once the story's PR reaches it, and on production, after its promotion, each the owner's call there. On each, `tapestry graph list-elements` for `39998:<TA>:graph-rule` should give eight items, `node-has-a-concept` among them. The agent-memory instance on the Mac Studio takes it only at David's word.

**Pointer:** `engineering-team/stories/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.md` (AC7); ADR graph-operations-first-slice/0022 (Decision 12, Consequences).
