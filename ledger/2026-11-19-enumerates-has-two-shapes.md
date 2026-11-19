# `ENUMERATES` is written in two shapes, and apply-enumerations reads only one

**Id:** 2026-11-19-enumerates-has-two-shapes
**Type:** bug (decide one shape before Loom A10.19, `graph enumerate`, is built)
**Opened:** 2026-11-19 (doc-lane review `engineering-team/reviews/graph-operations-first-slice/configuration-relationship-directions.md`, finding on the `ENUMERATES` row)
**Status:** OPEN
**Done:** —

**What was seen.** BIBLE §6 says `ENUMERATES` goes Superset → Property (horizontal integration), and `POST /api/normalize/enumerate` writes it that way. Firmware install writes its five manifest enumerations differently: Superset → the target concept's JSON Schema, with the field named in `destinationPath` (`src/firmware/install.js`, around `:743` and `:795-800`). `apply-enumerations` reads only firmware's shape (`src/api/normalize/index.js`, around `:5979`), so an enumeration made by the enumerate route is never applied to a schema. Firmware's `property-enumeration.json` describes a third shape, Concept Header → Property, which no writer uses; the audit's wiring rule (`src/api/audit/index.js`, around `:141`, `:359` and `:783`) accepts only that shape (ListHeader → Property), so it flags every edge both writers make.

**Fix shape.** Before A10.19 is built, pick the one shape the graph keeps (BIBLE §6's Superset → Property is the documented one), make `graph enumerate` write it, make whatever applies enumerations read it, and make the audit and `rules check` (A10.31) accept it and report the others. Firmware's own five edges move only after `install.js` writes the chosen shape and the old edges are removed: a reinstall alone won't do it, since install never deletes `ENUMERATES` edges.

**Pointer:** `BIBLE.md` §6; `src/firmware/install.js`; `src/api/normalize/index.js` (`enumerate`, `apply-enumerations`); `src/api/audit/index.js`; Loom A10.19.
