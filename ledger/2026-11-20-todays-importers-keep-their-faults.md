# Today's importers keep their faults: memo #130's failure, a 32-bit tag key, keying at kind 30000, older versions over newer, old tags never cleared, and two `importEventDirect` copies that differ

**Id:** 2026-11-20-todays-importers-keep-their-faults
**Type:** bug
**Opened:** 2026-11-20 (story graph-operations-first-slice #32, `import nostr`: ADR graph-operations-first-slice/0032, Consequences; story facts 1, 2, 4–6)
**Status:** OPEN
**Done:** —

**What was seen.** `import nostr` (`POST /api/tapestry/import/nostr`) has a recorder of its own (ADR graph-operations-first-slice/0032, Option A), and today's three builders keep working as they do (D15). Read on staging `1abd2889`; memo #130 ran its case against a throwaway Neo4j.
- **Memo #130's failure, on `buildImportCypher`'s callers** (`src/api/neo4j/eventSync.js:198`; called by `POST /api/neo4j/event-update`, the I/O import `POST /api/io/imports/:tempId/execute`, `pull-community-class-thread`, `POST /api/normalize/set-b-tag` and firmware's community references). An event that names an addressable event by id (`e`), imported first, leaves a placeholder keyed by that id; the target's own import then fails on every retry on `nostrEvent_id`, and nothing sits at its address. A `b` tag naming an event by id makes a placeholder whose `uuid` is that id, which `nostrEvent_uuid` refuses the same way. The callers carry on past each failure.
- **A 32-bit tag key.** Tag nodes are keyed `<last 8 hex of the id>_<index>_<type>` (`:248`): among 50,000 events two will likely share one, and their tags of the same index and type then `MERGE` onto one tag node.
- **Keying at kind 30000.** It keys an event of kind 30000 or more by its address and every other by its id (`:200-202`), so NIP-01's replaceable kinds 0, 3 and 10000–19999 get a node per version, and 40000 and up are taken as addressable. `import nostr` moves a replaceable event's id-keyed node to its address when no node holds it, and leaves it where it is when one does; a newer version whose id such a per-version node already holds, while an older version holds the address, then fails the import on `nostrEvent_id` (`failed`, after Decision 7.9's second run).
- **Older versions over newer.** It compares no `created_at` (`:214-215`): an older version overwrites a newer one.
- **Old tags never cleared.** A new version's tag nodes are keyed by its own id, so it adds a second set of tags unless the caller deleted the first (`event-update` does; the I/O import doesn't).
- **The `importEventDirect` copies differ** (`src/api/normalize/index.js:139` and `src/api/normalize/helpers.js:65`; OPEN.md row 142): each records no author, no `aTag` and no edge from any tag, and `DELETE r, t`, which isn't `DETACH`, fails on a tag node with a `REFERENCES`.

**2026-11-21: firmware's community references no longer leave old tags** (community-reference #39, ADR community-reference/0035). That caller now prunes after each `buildImportCypher`: the event's node keeps only the tags of the letter it holds, and a community copy keeps only the relationships its letter derives.
- **Where it runs.** On staging and production, which each had a reinstall with the fix on 2026-11-21. Also on tags.brainstorm.world, after its port to `feat/tags` and a reinstall on 2026-11-22. On each, the six headers and community copies now hold each tag once (story 39's Evidence).
- **What's unchanged.** The other callers, and the other faults listed here: memo #130's failure, the 32-bit tag key, keying at kind 30000, and older versions over newer. The I/O import still adds a second set of tags.

**Fix shape.** Move a caller onto `import nostr`'s recorder (`src/operations/catalog/import/_letters.js`, `record`) when its fault is wanted gone: it keys by NIP-01, keeps the newest version, keys tag nodes by the whole id, clears a newer version's old tags, and merges a placeholder keyed by an id into the event's node. Each move is a story of its own, since it changes what that caller builds (ADR 0032, Option B's cons).

**Pointer:** `engineering-team/decisions/graph-operations-first-slice/0032-import-nostr.md` (Context 4; Option B; Consequences); `engineering-team/stories/graph-operations-first-slice/32-import-nostr.md` (facts 1, 2, 4–6); Loom memo #130 on A10.32; OPEN.md row 142.
