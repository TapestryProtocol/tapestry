# The graph rule concept's ninth item, tapestry-link-names-a-node, reaches an instance only with a firmware reinstall there

**Id:** 2026-11-18-rule-nine-awaits-firmware-reinstall
**Type:** cleanup
**Opened:** 2026-11-18 (rulebook entry 9, which ADR graph-rules/0002 Decision 5 asks for once the ADR is accepted)
**Status:** OPEN
**Done:** —

**What is pending.** Rulebook entry 9, `tapestry-link-names-a-node`, is proposed: nothing enforces it yet. `node src/firmware/graph-rules.js` made it the ninth element file of firmware's graph rule concept (`firmware/versions/v1.0.0/concepts/graph-rule/elements/tapestry-link-names-a-node.json`). A deploy doesn't install firmware, so an instance's graph rule concept lists the items its last reinstall gave it (eight on staging and production) until its firmware is reinstalled after the change reaches its code, as rule 8's did (ledger row `2026-11-18-rule-eight-awaits-firmware-reinstall`). No concept's definition changes.

**ADR graph-rules/0002 missed it.** Its Consequences say "Firmware reinstall required? No", and its Implementation notes call the rulebook entry a docs-only change. Both missed that the rulebook makes firmware's graph rule elements, and that three tests pin them.

**Rule 10 too.** Story graph-operations-first-slice #19 (Loom A10.19) adds rule 10, `enumerated-value-allowed`, to `docs/GRAPH_RULES.md`, with status enforced, and `node src/firmware/graph-rules.js` made it the tenth element file (`firmware/versions/v1.0.0/concepts/graph-rule/elements/enumerated-value-allowed.json`). ADR graph-operations-first-slice/0019's Consequences say its item can wait for the next reinstall, as rule 9's does. `graph enumerate`, `graph unenumerate` and the rule work regardless: they are code. So rule 10's item waits on this row's reinstall too, once the story reaches an instance.

**What closes it.** A firmware reinstall on staging, once the entry reaches it, and on production, after its promotion, each the owner's call there. On each, `tapestry graph list-elements` for `39998:<TA>:graph-rule` should give nine items, `tapestry-link-names-a-node` among them, and that item's JSON (its json tag) should say status proposed; and ten, `enumerated-value-allowed` among them with status enforced, once story 19 has reached that instance before its reinstall. The agent-memory instance on the Mac Studio takes it only at David's word.

**Pointer:** `docs/GRAPH_RULES.md`, entries 9 and 10; ADR graph-rules/0002 (Decision 5); ADR graph-operations-first-slice/0019 (Decision 13, Consequences).
