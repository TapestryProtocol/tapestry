# Rules 3 and 7's regenerated graph-rule items reach an instance only with a firmware reinstall there

**Id:** 2026-11-17-rule-three-rewrite-awaits-firmware-reinstall
**Type:** cleanup
**Opened:** 2026-11-17 (story graph-operations-first-slice #18, ADR graph-operations-first-slice/0018 Consequences: "Firmware reinstall required? Yes, for rule 3's element text (Decision 15)")
**Status:** OPEN
**Done:** —

**What is pending.** Story 18 changes two rulebook entries (`docs/GRAPH_RULES.md`):
- entry 3, `field-mark-allowed`: its `no-property-node` line now names `graph set-schema` and the other property writes, which give a concept's fields their nodes and sign nothing, beside `POST /api/normalize/generate-property-tree`;
- entry 7, `element-fits-schema`: its Check and Enforced by now say the property operations are built, and how they use the rule's check.

`node src/firmware/graph-rules.js` regenerated `firmware/versions/v1.0.0/concepts/graph-rule/elements/field-mark-allowed.json` and `element-fits-schema.json` from them. An instance's graph carries the new words only after a firmware reinstall there. Entry 7's earlier rewrite is waiting on the same reinstall (ledger row `2026-11-17-rule-seven-rewrite-awaits-firmware-reinstall`), so one reinstall settles both rows.

**What closes it.** A firmware reinstall on staging, once the story's PR reaches it, and on production, after its promotion. On each, the graph's rule 3 and rule 7 items, from `rules list-rules` or `/api/concept-graph/node/<its handle>`, should carry the new words. The agent-memory instance on the Mac Studio takes it only at David's word.

**Pointer:** `engineering-team/stories/graph-operations-first-slice/18-property-operations.md`; `engineering-team/decisions/graph-operations-first-slice/0018-property-operations.md` (Decision 15).
