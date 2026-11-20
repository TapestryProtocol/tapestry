# Old routes hang a property on its concept's JSON Schema, and some readers expect it there

**Id:** 2026-11-19-old-routes-hang-properties-on-schema
**Type:** bug (old routes and readers; under the design doc's D15 they get only cheap fixes)
**Opened:** 2026-11-19 (doc-lane review `engineering-team/reviews/graph-operations-first-slice/configuration-relationship-directions.md`, reported findings)
**Status:** OPEN
**Done:** —

**What was seen.** The owner reported on 2026-11-18, US Eastern time (2026-11-19 UTC), that Grok Bot, an admin agent, used today's routes to have the Grok Bots concept's property for the projects a bot works on enumerated by the Projects concept's superset, and that the routes hung the new property under both the concept's primary property and its JSON Schema, by `IS_A_PROPERTY_OF`: "(Both relationships were actually created.)" BIBLE §6 says a property hangs under the primary property (top level) or its parent property (nested), and only the primary property's own edge goes to the JSON Schema. The new property writes (`src/operations/catalog/graph/_properties.js`) refuse a concept whose tree has a node with two parents (`tangled-tree`), so that concept's properties can't be changed through them until the extra edge goes. The review found these places that still treat Property → JSONSchema as a property's parent:
- Writers in `src/api/normalize/index.js`: `create-property` without a parent (around `:3478-3505`); `enumerate`, which adds the edge even to a property already under the primary property (around `:4209-4243`); and `generate-property-tree` when the concept has no primary property. `create-property` also makes the node's address from the property concept rather than the parent, so one name used under two parents becomes one node with two parents: another way to a `tangled-tree` refusal.
- Readers: the property counts in `ui/src/pages/concepts/ConceptOverview.jsx` and `ConceptList.jsx` (1 for a correctly built tree); the "(top level)" label in `ui/src/pages/concepts/ConceptProperties.jsx` (shown only for a property whose parent is the JSON Schema); the audit's wiring rule in `src/api/audit/index.js` (accepts Property → JSONSchema from any property); and the reading views' `ui/src/pages/reading/readVerbs.js`, whose three-hop limit now reaches one level less deep.
- Firmware's `property-membership.json` still says `nodeToType: "jsonSchema"` (no code reads that field; changing it needs a firmware reinstall).

**Fix shape.** `rules check` (Loom A10.31) reports a property node with more than one parent, and `rules repair` removes the extra edge to the JSON Schema, keeping the primary property's own. The readers count and label from the primary property instead, which is cheap. The old writers stay as they are (D15) unless the fix is cheap.

**Partly done (story graph-operations-first-slice #45, Loom A10.31.a, 2026-11-20).**
- The rule `property-has-one-parent` (rulebook entry 11), with `rules check` and `rules repair` for it. The repair takes off a property's extra link to its own concept's JSON schema, and changes firmware's concepts only with `firmwareOverride`.
- `POST /api/normalize/enumerate` no longer hangs the property on the target's schema. A property it makes hangs under the target's primary property, with its address from it.
- `POST /api/normalize/create-property` hangs a top-level property under the primary property, and takes every address from the parent.

Still open: `generate-property-tree`'s fallback to the schema, the readers, and firmware's `property-membership.json`.

**Pointer:** `BIBLE.md` §6 (relationship types and the property tree); `docs/CONFIGURATION.md` and `docs/ARCHITECTURE.md` (relationship tables, corrected 2026-11-19); `src/operations/catalog/graph/_properties.js` (`treeOf`, `TANGLED_TREE`); `src/api/normalize/index.js`; `src/api/audit/index.js`.
