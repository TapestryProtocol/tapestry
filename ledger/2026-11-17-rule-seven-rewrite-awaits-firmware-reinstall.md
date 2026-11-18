# Rule 7's rewritten graph-rule item reaches an instance only with a firmware reinstall there

**Id:** 2026-11-17-rule-seven-rewrite-awaits-firmware-reinstall
**Type:** cleanup
**Opened:** 2026-11-17 (story graph-operations-first-slice #42, ADR graph-operations-first-slice/0042 Consequences: "Firmware reinstall required? Yes, for rule 7's element (AC5)")
**Status:** OPEN
**Done:** —

**What is pending.** Story 42 rewrites rulebook entry 7 (`docs/GRAPH_RULES.md`): it now judges a node's fully realized tapestryJson, and names ADRs 0020, 0020a and 0042 as its source. `node src/firmware/graph-rules.js` regenerated `firmware/versions/v1.0.0/concepts/graph-rule/elements/element-fits-schema.json` from it. An instance's graph carries the new words only after a firmware reinstall there, as the item story 20 added did (ledger row `2026-11-16-rule-seven-awaits-firmware-reinstall`). Firmware's `word` schema is unchanged.

**What closes it.** A firmware reinstall on staging, once the story's PR reaches it, and on production, after its promotion. On each, the graph's rule 7 item, from `rules list-rules` or `/api/concept-graph/node/<its handle>`, should carry entry 7's new Says. The agent-memory instance on the Mac Studio takes it only at David's word.

**Pointer:** `engineering-team/stories/graph-operations-first-slice/42-both-readers-judge-tapestryjson.md` (AC5).
