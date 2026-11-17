# The graph rule concept's seventh item, element-fits-schema, reaches an instance only with a firmware reinstall there

**Id:** 2026-11-16-rule-seven-awaits-firmware-reinstall
**Type:** cleanup
**Opened:** 2026-11-16 (story graph-operations-first-slice #20, ADR graph-operations-first-slice/0020 Consequences: "Firmware reinstall required? Yes, but only for the graph rule concept's new element")
**Status:** OPEN
**Done:** —

**What was seen.** Story 20 adds rule 7, `element-fits-schema`, to `docs/GRAPH_RULES.md`. `node src/firmware/graph-rules.js` makes it the seventh element file of firmware's graph rule concept (`firmware/versions/v1.0.0/concepts/graph-rule/elements/element-fits-schema.json`).

A deploy doesn't install firmware, so an instance gets the item only when its firmware is reinstalled, after the change reaches its code. Until then, the instance's graph rule concept lists six items. `graph create-element` and the rule work regardless: they are code, and need no firmware change.

The agent-memory instance on the Mac Studio isn't affected: it is built from its own checkout, and its next upgrade brings both.

**Fix shape.** Once the change is on staging, reinstall staging's firmware (`POST /api/firmware/install`, the owner's call there). Then check that `tapestry graph list-elements` for `39998:<TA>:graph-rule` gives seven items, `element-fits-schema` among them. Do the same on production after its promotion, then close this row.

**Pointer:** ADR graph-operations-first-slice/0020 (Decision 12, Consequences); ADR graph-operations-first-slice/0041 (how the items are made and installed); ledger row `2026-11-16-graph-rule-ui-page-unchecked`, which waits on the same reinstall.
