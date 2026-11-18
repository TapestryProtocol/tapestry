# graph unlink-set, and delete-set once it is built, can still leave an element of no concept

**Id:** 2026-11-18-unlink-set-skips-last-concept-guard
**Type:** feature
**Opened:** 2026-11-18 (story graph-operations-first-slice #22, review round 1, finding 8: ADR graph-operations-first-slice/0022 Consequences, follow-up 5)
**Status:** OPEN
**Done:** —

**What was seen.** ADR graph-operations-first-slice/0022's follow-up 5. Story 22 defines D9's rule once, as `node-has-a-concept` (rulebook entry 8): every node is an element of at least one concept other than word. Only `graph remove-from-concept` guards it. `graph unlink-set` takes a set out from under a parent with no check for the elements the set held, so an element the parent's concepts reached only through that set can be left an element of no concept but word (story 28). `graph delete-set` (A10.17) will meet the same when it is built. `rules check` (A10.31) reports such a node through the rule's check form.

**Fix shape.** Guard unlink-set, and delete-set when it is built, with `node-has-a-concept` for each element they disconnect, or report those elements in their answers.

**Pointer:** `engineering-team/decisions/graph-operations-first-slice/0022-add-to-concept-and-remove-from-concept.md` (Decision 12; Consequences, follow-up 5); `src/operations/rules/node-has-a-concept.js`; `src/operations/catalog/graph/unlink-set.js`.
