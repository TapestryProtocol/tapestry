# OPEN.md row 224 looks fixed on staging: the concept header no longer counts elements with its own `:ListItem` query

**Id:** 2026-11-05-row-224-looks-fixed
**Type:** cleanup
**Opened:** 2026-11-05 (the Issue Evaluator's dry run, harness/issue-evaluator)
**Status:** OPEN
**Done:** —

Row 224 says the concept header's element counter misses concepts-as-elements, because `ui/src/pages/concepts/ConceptDetail.jsx:52` matches `(elem:ListItem)`. On `origin/staging` at `d9b67014`, neither `ConceptDetail.jsx` nor `ConceptOverview.jsx` runs a `HAS_ELEMENT` query any more. The header now renders `concept.elementCount` (`ui/src/pages/concepts/ConceptDetail.jsx:239`); where that count comes from wasn't traced. A dry-run judge noticed this while reading the snapshot for another issue.

Confirm it on a live concept whose elements are concepts (row 224 used `concept header`: header 0 against overview 44). Then close row 224, naming the commit that changed it.

**Pointer:** OPEN.md row 224
