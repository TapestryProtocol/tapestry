# No relationship records who made it, so the reads weigh the owner's membership of another author's node by that author

**Id:** 2026-11-18-reads-ignore-owner-membership-claims
**Type:** feature
**Opened:** 2026-11-18 (story graph-operations-first-slice #22, review round 1, finding 8: ADR graph-operations-first-slice/0022 Consequences, follow-up 1)
**Status:** OPEN
**Done:** —

**What was seen.** ADR graph-operations-first-slice/0022's follow-up 1. `graph add-to-concept` takes another author's node and makes the owner's membership beside their letter (AC5), but no relationship records who made it. A read judges a relationship by the node at its other end (ADR graph-operations-first-slice/0011), so the owner's membership is weighed by the node's author. Two halves of one missing provenance:
- **From the owner's point of view,** a node whose author that point of view doesn't count stays out of the concept's elements, even once the owner has added it.
- **From a point of view that counts the node's author,** the owner's membership counts as that author's. Story 22's AT9 shows it: `graph list-elements` for pet, from everyone's point of view, lists another author's Snowy once the owner has filed it under pet, as AC1 asks under today's conventions.

**Fix shape.** Record who made a membership on the relationship, and count the owner's own memberships from the owner's point of view, and an author's from a point of view that counts that author: a change to the read conventions (ADR 0011), in a story of its own (story 22's Out of scope).

**Pointer:** `engineering-team/decisions/graph-operations-first-slice/0022-add-to-concept-and-remove-from-concept.md` (Consequences, follow-up 1); `engineering-team/reviews/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.md` (finding 8); `src/operations/reads.js`.
