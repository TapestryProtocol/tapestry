# Export nostr's dry run lists a named relay it will never send to, on an instance that publishes to its own relay only

**Id:** 2026-11-22-export-dry-run-hides-local-only
**Type:** bug
**Opened:** 2026-11-22 (graph-operations-first-slice #48's first use on david.tapestry.ninja)
**Status:** OPEN
**Done:** —

**What was seen.** On 2026-11-22, Zeus ran `export nostr --graph <the vulnerability concept graph> --relays wss://dcosl.brainstorm.world --dryRun true` on david.tapestry.ninja.
- **The dry run** answered `relays: ["own", "wss://dcosl.brainstorm.world"]`, with 26 letters new and no report.
- **The real send** of one of them, the concept's header (`--node`, letter `38a45946…`), was accepted by the instance's own relay. It answered `not-sent` for dcosl: "this instance publishes to its own relay only (BRAINSTORM_PUBLISH_LOCAL_ONLY is true), so nothing goes to an outside relay".

So the dry run, which is the step meant to show what would go where, didn't say that no letter would reach the relay named. The owner had approved a send to dcosl on the strength of that dry run.

**Why.** The dry run answers before it sends to any relay, so a relay's per-letter status, `not-sent` here, appears only in a real send. The instance's local-only setting is read at sending time.

**What was done instead.** On the owner's word, the four letters were exported to the instance's own relay. Then they were copied, exactly as signed, from `wss://david.tapestry.ninja/relay` to dcosl from the owner's Mac. That is what the concept page's buttons already do from the browser. Story 48's records say so (Evidence, "The first use on david.tapestry.ninja").

**Fix shape (for a story).** The dry run should report, before anything is signed, that the instance is local-only and that each relay named will be `not-sent`.
- One way: a report such as `local-only`.
- Another: refuse the call `local-only` when relays are named.
- The design, under its own ADR, settles whether an admin's agent may send past the setting at all.

`lifecycle status` could also say whether the instance is local-only.

**Pointer:**
- `src/operations/catalog/export/nostr.js:339-344`, where only a real send reads `isPublishLocalOnly()` (`src/api/publish-policy`) and marks each named relay `not-sent`;
- story `engineering-team/stories/graph-operations-first-slice/48-declare-a-concept-shared.md` (Evidence);
- event-tagging ADR 0002, the local-only guard.
