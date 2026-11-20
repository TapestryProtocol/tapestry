# A stranger's tag node reads as the instance's own, so a stranger's reference into an own node counts from the owner's point of view

**Id:** 2026-11-20-strangers-tag-nodes-count-as-own
**Type:** bug
**Opened:** 2026-11-20 (story graph-operations-first-slice #32, `import nostr`, review round 1, non-blocking 4)
**Status:** OPEN
**Done:** —

**What was seen.** A tag node records no `pubkey`, so two reads treat every one as the instance's own:
- `factsOf` (`src/operations/catalog/graph/_nodes.js:98`, reached through `src/operations/reads.js:215`) calls any node with no author own;
- the trust fragment C2 (`src/operations/reads.js:178`) counts any such node from every point of view.

**Why story 32 makes it matter more.** Story 32's amendment 2 makes an `e`, `a` or `b` reference from another author's letter into one of the instance's own nodes on purpose. That reference starts at the stranger's tag node, so `graph list-relationships` counts it from the owner's point of view when asked for `REFERENCES`. In the live check, `calls/07b-target-refs.out` shows the referrer's tag node with `author: null, own: true`. It was pre-existing for tag nodes that today's builders write.

**What import nostr itself does.** Its own rules never take a tag node for an own node. Its lookups leave tag nodes out, a tag's reference is never judged, and it deletes old tag nodes only on a node that isn't the instance's own (review round 1, non-blocking 4).

**What closes it.** Judge a tag node by the node that `HAS_TAG` it, in `factsOf` and in C2, with a test that a stranger's tag counts only where its letter's author does.

**Pointer:** `src/operations/reads.js:178, 215`; `src/operations/catalog/graph/_nodes.js:98`; `engineering-team/reviews/graph-operations-first-slice/32-import-nostr.md`, non-blocking 4.
