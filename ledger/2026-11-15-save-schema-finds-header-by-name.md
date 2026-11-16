# Saving a concept's schema finds the header by name, so another author's header with that name can take its place

**Id:** 2026-11-15-save-schema-finds-header-by-name
**Type:** bug
**Opened:** 2026-11-15 (story 5's session, from the owner's local install; filed by story graph-operations-foundation #8's session)
**Status:** OPEN
**Done:** —

**What was seen.** On the owner's local instance, upgraded to staging's `09dc9b7b`, a firmware install at about 20:35 UTC on 2026-11-15 logged two lines:

> ⚠️ Concept "tag" has no JSON Schema node. Create one first via normalize skeleton.

then `Pass 2 complete: 39 enriched, 0 skipped, 1 errors`. Staging's install logged no errors in Pass 2. That instance holds two ListHeaders named "tag":
- **its own**, `39998:<TA>:tag`, a ConceptHeader with its schema `39999:<TA>:tag-schema`;
- **the community's**, `39998:82b75e47…:tag`, under the literal pubkey of ADR 0015. It was imported 2026-06-13, and it is a ListHeader with no schema.

**The code.** `POST /api/normalize/save-schema` (`handleSaveSchema`, `src/api/normalize/index.js:1923`) matches the header with `h.name = $concept` among the list headers of any author, with `LIMIT 1` and no `ORDER BY` (`:1930–1940`). So when two headers share a name, which one it gets is up to the database. Two callers use it:
- Pass 2's enrich;
- Pass 3's apply-enumerations, which saves each enumerated schema through it (`:6221`).

**Effect.**
- **On the local instance:** that install didn't enrich the instance's own tag schema. Nothing else changed.
- **On a second install of a scratch stack** (seen with story 8's fix), six schemas' json tags came out different from the first install's: tag, nostr-user-tag, tag-pinning, nostr-event-tagging, tagging-with-specific-tag and nostr-relay.
  - **Five of them follow from this bug.** That install's Pass 2 failed for the five tag concepts, whose headers share their names with ListHeaders under ADR 0015's pubkey (story 8's review, round 2). Every install after the first did the same on the scratch stacks: 5 tag concepts failed on the seeded one, 3 on a fresh one.
  - **The rest has another cause, not yet found.** Nostr relay's schema, and the same install's move of `tagging-with-specific-tag-superset` and `tapestry-superset` between the HAS_ELEMENT targets of `set-superset` and `superset-superset` (story 8's test plan, Amendment 1).

**Fix shape.** Find a firmware concept's header by its address, `39998:<TA>:<slug>`, as `readInstallState` already does (`src/api/firmware/index.js:128–151`), not by name. Then check whether a second install leaves the same graph as the first.

**Pointer:** story graph-operations-foundation #8's test plan, Amendment 1; `src/api/normalize/index.js:1923–1948`.
