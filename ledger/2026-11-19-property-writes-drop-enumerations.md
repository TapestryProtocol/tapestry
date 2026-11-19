# The property writes can drop or break a property's link to another concept, and their answers don't say so

**Id:** 2026-11-19-property-writes-drop-enumerations
**Type:** bug
**Opened:** 2026-11-19 (story graph-operations-first-slice #19, `graph enumerate`: ADR graph-operations-first-slice/0019, Context fact 3 and Consequences)
**Status:** OPEN
**Done:** —

**What was seen.** `graph enumerate` links a property to another concept with one `ENUMERATES` from the source concept's superset to the property node (ADR graph-operations-first-slice/0019). The property writes of story 18 don't know about the link:
- `graph remove-property`, `graph set-schema`, and the catch-up every property write makes first, take a property out with `DETACH DELETE` (`src/operations/catalog/graph/_properties.js`, `NODE_DELETE`), and the link into it goes with it. The change entry keeps the edge, under the removed node's `was.relationships`, but the answer doesn't say a link went, so the agent isn't told its field is no longer enumerated.
- `graph update-property` can change an enumerated property's type so that it holds no reference (a number, an object, a list of objects). The link stays, and the rule `enumerated-value-allowed` then refuses every value of the field that rule 4 allows, while the property writes' report shows the elements that held references as not fitting the schema.

**Fix shape.** A guard like `marked-field`'s in `commit`: refuse taking out an enumerated property, or a property one hangs under, and retyping one so that it can't hold a reference, until `graph unenumerate` takes the link out first. Or report the links taken out in the answer. ADR 0019 left both out of story 19's scope.

**Pointer:** `engineering-team/decisions/graph-operations-first-slice/0019-enumerate-and-unenumerate.md` (Context, fact 3; Consequences; Out of scope); `src/operations/catalog/graph/_properties.js` (`commit`, its marks check); `src/operations/catalog/graph/update-property.js`, `remove-property.js`, `set-schema.js`.
