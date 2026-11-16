# An event-less set's would-be `s` tag keeps naming a parent `graph unlink-set` took it out from under, so `export nostr` must take a set's parents from its links

**Id:** 2026-11-16-would-be-s-tags-go-stale
**Type:** feature
**Opened:** 2026-11-16 (graph-operations-first-slice #28, Loom A10.28: implementation)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The tag.** `POST /api/normalize/add-subset` makes a set with no event, but gives it the tag nodes a letter would have, `s` among them, naming its first parent's uuid (`buildSubsetTags`, `src/api/normalize/nodes.js:72`).
- **The links move; the tag doesn't.** `graph unlink-set` takes a set's link to a parent out and leaves its tag nodes as they are, and `graph link-set` adds a parent that no tag names. So after an unlink, the would-be `s` tag names a parent the set is no longer under.
- **Not reported.** unlink-set's `letters` reports only a real letter, an event with an `id` (ADR graph-operations-first-slice/0028 Decision 7). A would-be tag isn't one, and keeping the would-be tags in step with the links is out of the ADR's scope.
- **The risk.** An export that builds a set's event from its tag nodes would publish a parent the set no longer has, and leave out the parents link-set added.

**Fix shape.** `export nostr` (A10.34) takes a set's parents from its class-thread links, `(parent)-[:IS_A_SUPERSET_OF]->(set)`, never from its `s` tag nodes. Or a later story keeps an event-less set's would-be tags in step with its links.

**Pointer:** `engineering-team/decisions/graph-operations-first-slice/0028-link-set-and-unlink-set.md` (Consequences, debt 2; Decision 7); `src/operations/catalog/graph/unlink-set.js`.
