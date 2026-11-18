# graph search doesn't see the owner's sections kept beside another author's letter

**Id:** 2026-11-18-search-misses-owner-sections-beside
**Type:** feature
**Opened:** 2026-11-18 (story graph-operations-first-slice #22, review round 1, finding 8: ADR graph-operations-first-slice/0022 Consequences, follow-up 3)
**Status:** OPEN
**Done:** —

**What was seen.** ADR graph-operations-first-slice/0022's follow-up 3. The owner's sections for another author's node, a person node, a placeholder or one of firmware's own elements are kept in the node property `tapestryOwnSections` (Decision 6). The field mapping and the derive step lay them over the node's JSON (`F.overlaySections`), but graph search's texts come from the json tag alone (`src/operations/catalog/graph/_search.js:98–121`). So the words in an owner's section beside a letter aren't found by `graph search`.

**Fix shape.** `_search.js` lays `tapestryOwnSections` over the json tag's JSON, as `elementsOf` does, and its full-text index (ADR graph-operations-first-slice/0008) covers the texts that come from it.

**Pointer:** `engineering-team/decisions/graph-operations-first-slice/0022-add-to-concept-and-remove-from-concept.md` (Decision 6; Consequences, follow-up 3); `src/operations/catalog/graph/_search.js`; `src/operations/catalog/graph/_fields.js` (`overlaySections`).
