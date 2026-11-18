# The concept page's Properties tab reads a property's `required` as the field's own flag, which it isn't in firmware's `property` schema

**Id:** 2026-11-17-properties-tab-misreads-required
**Type:** bug (low: the tab shows a wrong mark; nothing writes from it)
**Opened:** 2026-11-17 (story graph-operations-first-slice #18, the property operations, at Test Design)
**Status:** OPEN
**Done:** —

**What was seen.** The Properties tab (`ui/src/pages/concepts/ConceptProperties.jsx:50–58`) shows a "Required" column with ✅ when a property node's JSON has a truthy `property.required`. That fits the nodes today's create-property and generate-property-tree sign, which hold `property.required` as a boolean: whether the field itself is required.

Firmware's `property` concept says otherwise. Its schema (`firmware/versions/v1.0.0/concepts/property/json-schema.json`) gives `property.required` as an array, "which child properties are required (for object types)", and a field's own flag as `x-tapestry.requiredByParent`. ADR graph-operations-first-slice/0018 follows firmware: a property node's view holds `required` as an object's list of required children, as create-concept's primary property already does. So, for the nodes the property operations write:
- an object with required children shows ✅, whether or not it is required itself;
- a required leaf shows nothing.

**Fix shape.** The tab reads the field's required flag from where its parent says it: the parent's `property.required` list naming the field, or the concept's schema. Or it drops the column. The UI's property editor (`NewProperty.jsx`) writes through today's create-property, so it is part of the same move; story 18 leaves both out of scope (D15).

**Pointer:** `engineering-team/decisions/graph-operations-first-slice/0018-property-operations.md` (Decision 1; Amendment 1, item 11); `ui/src/pages/concepts/ConceptProperties.jsx`.
