# The graph rule concept's seventh item, element-fits-schema, reaches an instance only with a firmware reinstall there

**Id:** 2026-11-16-rule-seven-awaits-firmware-reinstall
**Type:** cleanup
**Opened:** 2026-11-16 (story graph-operations-first-slice #20, ADR graph-operations-first-slice/0020 Consequences: "Firmware reinstall required? Yes, but only for the graph rule concept's new element")
**Status:** DONE
**Done:** 2026-11-17, staging's and production's firmware reinstalls, after TapestryProtocol/tapestry#103 reached staging and promotion TapestryProtocol/tapestry#104 took it to production

**What was seen.** Story 20 adds rule 7, `element-fits-schema`, to `docs/GRAPH_RULES.md`. `node src/firmware/graph-rules.js` makes it the seventh element file of firmware's graph rule concept (`firmware/versions/v1.0.0/concepts/graph-rule/elements/element-fits-schema.json`).

A deploy doesn't install firmware, so an instance gets the item only when its firmware is reinstalled, after the change reaches its code. Until then, the instance's graph rule concept lists six items. `graph create-element` and the rule work regardless: they are code, and need no firmware change.

The agent-memory instance on the Mac Studio isn't affected: it is built from its own checkout, and its next upgrade brings both.

**Fix shape.** Once the change is on staging, reinstall staging's firmware (`POST /api/firmware/install`, the owner's call there). Then check that `tapestry graph list-elements` for `39998:<TA>:graph-rule` gives seven items, `element-fits-schema` among them. Do the same on production after its promotion, then close this row.

**Closed, 2026-11-17, with both instances reinstalled.** Each install ran on the owner's yes, as the loopback call `POST http://127.0.0.1:7778/api/firmware/install` inside the instance's `tapestry` container, after `GET /api/deploy-safety/status` answered safe. Times are UTC.
- **Staging.** #103's merge, f11d8316, deployed as run 43995725364. The install ran from 01:35:59 to 01:39:37, and the log reads `FIRMWARE INSTALL COMPLETE`. Then `tapestry graph list-elements` for the graph rule concept listed seven items, `element-fits-schema` among them.
- **Production.** #104's merge, 24cdcfa7, deployed as run 43999913693. At 02:07:36 the concept listed six items, without `element-fits-schema`. The install ran from 02:07:46 to 02:11:30. It answered `"success": true`, with every `errors` list empty. The log reads `Pass 2 complete: 41 enriched, 0 skipped, 0 errors` and `FIRMWARE INSTALL COMPLETE`. At 02:11:31 the concept listed seven items: `class-thread-acyclic`, `concept-slug-unique`, `element-fits-schema`, `field-mark-allowed`, `relationship-type-allowed`, `set-has-a-parent` and `tapestry-key-unique`.

**Pointer:** ADR graph-operations-first-slice/0020 (Decision 12, Consequences); ADR graph-operations-first-slice/0041 (how the items are made and installed); ledger row `2026-11-16-graph-rule-ui-page-unchecked`, which checked the concept's UI page on staging when it had six items.
