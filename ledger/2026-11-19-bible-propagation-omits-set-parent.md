# BIBLE §6's propagation row leaves out a set as the parent

**Id:** 2026-11-19-bible-propagation-omits-set-parent
**Type:** docs
**Opened:** 2026-11-19 (doc-lane review `engineering-team/reviews/graph-operations-first-slice/configuration-relationship-directions.md`, round 2)
**Status:** OPEN
**Done:** —

**What was seen.** BIBLE §6's class-thread table gives `IS_A_SUPERSET_OF` as Superset → Superset/Set. Sets are also made and linked under other sets (BIBLE §11's add-subset and create-set; ADR graph-operations-first-slice/0028, link-set), firmware's own relationship definition allows it, and the audit already uses Superset/Set → Superset/Set. `docs/CONFIGURATION.md` and `docs/ARCHITECTURE.md` now say Superset/Set → Superset/Set; BIBLE §6 still doesn't.

**Fix shape.** Change BIBLE §6's row to Superset/Set → Superset/Set, through the Protocol-Spec workflow's docs mode.

**Pointer:** `BIBLE.md` §6 (class-thread relationships); `docs/CONFIGURATION.md`; `docs/ARCHITECTURE.md`.
