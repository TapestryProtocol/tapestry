# The property writes that take `property` answer `load`'s refusals with `input: concept`, an input they don't have

**Id:** 2026-11-19-property-load-names-concept-input
**Type:** bug
**Opened:** 2026-11-19 (story graph-operations-first-slice #19, `graph enumerate`: review round 1, non-blocking 5)
**Status:** OPEN
**Done:** —

**What was seen.** `P.load`'s refusals (`src/operations/catalog/graph/_properties.js`, `load`, about `:628–657`: `unknown-concept`, `not-own-concept`, `firmware-concept`, the no-key refusal, `no-schema`, `no-primary-property` and `tangled-tree`) answer `input: concept`, and so does its refusal of a schema it can't catch up to (`not-wrapped-now` or `unreadable-schema`, about `:681`). The four writes that take `property` and no `concept`, `graph update-property`, `remove-property`, `enumerate` and `unenumerate`, get that too, so an agent is told to fix an input it never sent. `unknown-concept` is the one exception: each of the four passes `missing`, so a concept gone mid-call is refused `unknown-property`, for `property`. Story 19's Evidence noted it as surprising but within ADR graph-operations-first-slice/0019, and its test plan leaves it unpinned.

**Fix shape.** `load` takes the input's name, as it already takes `missing`, and gives it to each of its refusals, so the four name `property`. add-property and set-schema, which take `concept`, keep it. A case in each of the four suites pins the field.

**Pointer:** `src/operations/catalog/graph/_properties.js` (`load`); its four callers that take `property`: `update-property.js:82`, `remove-property.js:100`, `enumerate.js:89`, `unenumerate.js:81`; `engineering-team/reviews/graph-operations-first-slice/19-enumerate.md` (non-blocking 5); `engineering-team/stories/graph-operations-first-slice/19-enumerate.md` (Evidence, "Surprising, but within the ADR").
