# The graph rule concept's eighth item, node-has-a-concept, reaches an instance only with a firmware reinstall there

**Id:** 2026-11-18-rule-eight-awaits-firmware-reinstall
**Type:** cleanup
**Opened:** 2026-11-18 (story graph-operations-first-slice #22, ADR graph-operations-first-slice/0022 Consequences, follow-up 9: "Firmware reinstall required? Yes, for rule 8's element")
**Status:** DONE
**Done:** 2026-11-18. Reinstalled on staging (15:08Z to 15:12Z) and on production (16:02Z to 16:07Z), each on the owner's yes, after TapestryProtocol/tapestry#141 and its promotion #144. Each instance's graph rule concept now lists eight items, `node-has-a-concept` among them, and rule 7's item carries entry 7's new Enforced by (story 22's Evidence, "On staging and production"). The agent-memory instance on the Mac Studio takes it only at David's word.

**What is pending.** Story 22 adds rule 8, `node-has-a-concept`, to `docs/GRAPH_RULES.md`. `node src/firmware/graph-rules.js` made it the eighth element file of firmware's graph rule concept (`firmware/versions/v1.0.0/concepts/graph-rule/elements/node-has-a-concept.json`). A deploy doesn't install firmware, so an instance's graph rule concept lists seven items until its firmware is reinstalled after the change reaches its code, as rule 7's did (ledger row `2026-11-16-rule-seven-awaits-firmware-reinstall`). `graph add-to-concept`, `graph remove-from-concept` and the rule work regardless: they are code. No concept's definition changes.

**Rule 7's element too.** At review round 1 (ADR graph-operations-first-slice/0022 Amendment 2, item 7) the story also reworded rulebook entry 7's Enforced by, which now says `graph add-to-concept` calls the check, and regenerated rule 7's element, `firmware/versions/v1.0.0/concepts/graph-rule/elements/element-fits-schema.json`. The same reinstall carries it, beside rule 8's. Story 18's row `2026-11-17-rule-three-rewrite-awaits-firmware-reinstall` is closed: its reinstall ran on staging and production on 2026-11-18, before this story's rewording of entry 7 reached either. So rule 8, and rule 7's element as entry 7 now reads, naming both `graph add-to-concept` and the property operations as built (the merge of staging at review round 2), wait on this row's reinstall alone.

**What closes it.** A firmware reinstall on staging, once the story's PR reaches it, and on production, after its promotion, each the owner's call there. On each, `tapestry graph list-elements` for `39998:<TA>:graph-rule` should give eight items, `node-has-a-concept` among them, and rule 7's item, `element-fits-schema`, should carry entry 7's new Enforced by. The agent-memory instance on the Mac Studio takes it only at David's word.

**Pointer:** `engineering-team/stories/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.md` (AC7); ADR graph-operations-first-slice/0022 (Decision 12, Consequences).
