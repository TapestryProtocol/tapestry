# Story 43: A rename or a field mark beside a property write on the same concept — the two go one after the other, and neither is lost

**Status:** Approved
**Created:** 2026-11-18
**Type:** Bug
**Loom:** A10.18.a — https://loom.brainstorm.world/t/A10.18.a

## Background

Story 18 (Loom A10.18) built the four property writes, `graph add-property`, `update-property`, `remove-property` and `set-schema`. Each holds the concept's header from its first write to its commit, as the element writes and `graph delete-node` do. So those writes to one concept go one after the other, and the second reads what the first wrote (ADR graph-operations-first-slice/0018, Decision 11).

Two other writes to a concept don't hold its header, and story 18's review found that either can interleave with a property write (review round 1, non-blocking 1). It was found by reading the code. No suite shows it, since the fake graph runs one transaction at a time. ADR 0018 records it as a known limit (Amendment 3, item 1), and ledger row `2026-11-17-concept-writes-skip-header-lock` holds it open.

- **`graph update-concept`'s rename.** It holds the concept-header concept's header, which every concept write holds, but not the header of the concept it renames. It reads the concept's core nodes, then writes the json tags of the schema node, the primary property and the property tree graph from what it read, wherever they still hold the old names' text.
  - Beside a property write, it can write back what it read before that write committed. The schema node then loses the property write's change.
  - The next property write's catching up then follows the schema, and takes the new property's node out. The node is kept whole in that write's change entry.
  - A rename of the plural alone writes only tag nodes, so either write's change to those json tags can be the one lost.
- **`graph mark-field`.** It holds nothing of the concept. A type change or a removal can land on a field marked between the property write's read of the marks and its commit. Decision 8 refuses that change when the two run one after the other. After a removal, the mark's copies stay on the elements with no mark; `graph map-fields` clears them.

Both need the owner or an admin to run two writes on one concept at once, and the change entries keep what was lost. ADR 0018 Amendment 3, item 1, gives the fix: each of the two holds the concept's header before it reads, after any lock of its own, as the property writes do.

## User-facing description

As the owner, or an admin's agent working a concept, I want two writes to one concept to land one after the other, whichever comes first, with the second seeing what the first did. A rename, a field mark and a property change are among those writes. Then running two of them at once never loses one, and never leaves the concept's schema, its property nodes and its field marks disagreeing.

## Acceptance criteria

- [ ] **AC1 — A rename beside a property write keeps both.** `graph update-concept` changes a concept's name, its plural, or both. While it runs, a property write on the same concept is in flight (`add-property`, `update-property`, `remove-property` or `set-schema`). Then both land:
  - the concept has its new names, and the schema node, the primary property and the tree graph read them, wherever they held the old names' text;
  - the schema node, the property nodes and the tree graph keep the property write's change;
  - the next property write on the concept takes no property node out.

  For example, rename `lamp` to `lantern` beside `add-property weight`: the schema lists `weight`, and the concept is named `lantern`. Whichever of the two commits second sees what the first wrote.
- [ ] **AC2 — A mark beside a property write follows the rules either way round.** `graph mark-field` marks a field while a property write on the same concept changes that field's type or takes it out. The two go one after the other:
  - **the mark first:** the property write is refused `marked-field` (409), as when the two run one after the other (ADR 0018, Decision 8), and changes nothing;
  - **the property write first:** mark-field judges the field as the property write left it. Where the rule `field-mark-allowed` refuses that field, mark-field refuses it with the rule's own code and message (such as `not-plain`, `unknown-field` or `no-property-node`), and writes nothing: no mark, no copies, no change entry.

  So a marked field never has a type a mark can't carry, and no element keeps a mark's copies without the mark.
- [ ] **AC3 — Alone, each write is as it was.** Run alone, `graph update-concept` and `graph mark-field` give the same answers, refusals, writes and change entries as before this story. Neither waits for a write on another concept, except that `graph update-concept` still goes one at a time with `graph create-concept` and other `graph update-concept` calls, on any concept, as today.
- [ ] **AC4 — The records say it holds.** ADR 0018 no longer lists the two writes as a known limit of Decision 11, and ledger row `2026-11-17-concept-writes-skip-header-lock` is closed.

## Concepts touched

`<TA>` is the instance's assistant (`GET /api/assistant/pubkey`).

- `39998:<TA>:concept-header` — concept header (its header is the lock every concept write takes first; unchanged).
- Any of the instance's own concepts: its header, JSON schema node, primary property, property tree graph and property nodes (written by a rename and by the property writes).
- `39999:<TA>:the-set-of-neo4j-properties-that-are-also-fields` — the set a mark makes its property node an element of (written by mark-field; read by the property writes).

## Out of scope

- **`graph unmark-field` and `graph map-fields`,** which don't hold the concept's header either. Whether either can interleave harmfully with a property write is the Tester's and Reviewer's to check. If one can, it gets a ledger row of its own, not a fix here.
- **Two writes on different concepts:** they don't conflict, and nothing here makes them wait for each other.
- **Making the fake graph run transactions at once.**
- **Restoring what an interleaving lost before this fix:** the change entries hold it.

## Open questions

- None that block planning.

## Linked artifacts

- ADR: `engineering-team/decisions/graph-operations-first-slice/0018-property-operations.md` (Decision 11; Amendment 3, item 1). Architecture is skipped: the fix's shape is decided there.
- Test plan: `engineering-team/stories/graph-operations-first-slice/43-concept-writes-take-header-lock.test-plan.md`
- Review: `engineering-team/reviews/graph-operations-first-slice/43-concept-writes-take-header-lock.md`
