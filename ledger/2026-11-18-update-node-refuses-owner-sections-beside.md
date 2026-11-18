# graph update-node can't change the owner's section kept beside another author's letter

**Id:** 2026-11-18-update-node-refuses-owner-sections-beside
**Type:** feature
**Opened:** 2026-11-18 (story graph-operations-first-slice #22, review round 1, finding 8: ADR graph-operations-first-slice/0022 Consequences, follow-up 2)
**Status:** OPEN
**Done:** —

**What was seen.** ADR graph-operations-first-slice/0022's follow-up 2. `graph add-to-concept` keeps the owner's section for another author's node, a person node, a placeholder or one of firmware's own elements beside it, in the node property `tapestryOwnSections` (Decision 6). `graph update-node` refuses every node that isn't the instance's own (`not-own-node`, `person-node`, `placeholder-node`, `firmware-node`), so it can't change such a section. Today the owner changes one only by a removal and an add with the new fields.

**Fix shape.** Teach update-node a node kept beside: it edits only the owner's section in `tapestryOwnSections`, checked as it checks a section, and never the author's letter or firmware's file.

**Pointer:** `engineering-team/decisions/graph-operations-first-slice/0022-add-to-concept-and-remove-from-concept.md` (Decision 6; Consequences, follow-up 2); `src/operations/catalog/graph/update-node.js`; `src/operations/catalog/graph/_memberships.js` (`keptIn`, `jsonOf`).
