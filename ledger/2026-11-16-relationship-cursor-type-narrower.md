# list-relationships' cursor refuses a relationship type the read can list but `TYPE_PATTERN` doesn't match

**Id:** 2026-11-16-relationship-cursor-type-narrower
**Type:** cleanup
**Opened:** 2026-11-16 (story graph-operations-first-slice #13, Loom A10.13; its review, non-blocking 4)
**Status:** OPEN
**Done:** —

**What was seen.** With no `type`, `graph list-relationships` lists every relationship type the graph holds. Its cursor's position, though, must carry a type that matches `TYPE_PATTERN`: a letter first, then letters, digits and underscores, 64 characters at most. ADR 0013 (Decision 2, step 3) sets that rule, and `isPosition` in `src/operations/catalog/graph/list-relationships.js` checks it. A page that ended on a relationship of another type would give a cursor the read then refuses as `invalid-cursor`, and the rest of the list couldn't be reached.

Nothing reaches this today. `graph add-relationship` takes only a type that matches the pattern, and all 14 relationship-type aliases in `firmware/` match it. Only a relationship made with raw Cypher could have such a type.

**Fix shape.** Accept any non-empty text as the position's type, still equal to `type` when one is given. That is safe because the position's type reaches Cypher only as the parameter `$afterType`, never in the statement's text. It changes ADR 0013's cursor rule, so it needs an amendment to that ADR. If `graph walk` (A10.14) pages relationships the same way, its ADR can settle both.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/13-list-relationships.md` (Findings, non-blocking 4).
