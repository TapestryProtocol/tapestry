# A set `graph link-set` or `unlink-set` moves across concepts leaves the elements below it naming the concept they left, in their `z` tags and `wordTypes`, so `export nostr` sends those

**Id:** 2026-11-20-moved-sets-leave-stale-z-tags
**Type:** feature
**Opened:** 2026-11-20 (graph-operations-first-slice #34, Loom A10.34: implementation; ADR graph-operations-first-slice/0034 story amendment 1, Consequences, debt 1)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The writes.** `graph link-set` and `unlink-set` change a set's parent links and nothing below it. The elements in that set keep their `z` and `n` tags and their JSON's `wordTypes` as the write that made them left them (story 34, fact 3; memo #114).
- **The letter.** `export nostr` builds a letter from the node's own tags, its `s` alone from its parent links (ADR 0034 Option A, Decision 4). It reads `z`, `n` and `wordTypes` as the node holds them, because the class thread isn't the letter convention: measured on the local instance, it reaches 209 of 535 own nodes through concepts their letters never named, and misses 10 whose `z` is a convention (ADR 0034, Context 3).
- **The gap.** So when a set is moved from under one concept's superset to under another's, the elements below it still carry the old concept's `z` and `wordTypes`, and their letters say so. An instance that imports those letters still wires them into the concept they left (import nostr's `z` claim), beside the set's new place, which the set's `s` gives.
- **How rare.** Only a set moved across concepts. Moving a set within one concept's class thread leaves every `z` true. The writes that change one node's membership (create-element, add-to-concept, remove-from-concept, move-element) keep its `z`, `n` and `wordTypes` in step already.

**Fix shape.** A later story keeps the elements below a moved set in step: link-set and unlink-set rewrite each element's `z` and `wordTypes` when the move crosses a concept, as add-to-concept and remove-from-concept do for one node, and answer `letterOutOfDate` for those that have letters. Export then sends what the graph says, with no change to export.

**Pointer:** `engineering-team/decisions/graph-operations-first-slice/0034-export-nostr.md` (story amendment 1; Consequences, Debt); `src/operations/catalog/graph/link-set.js`, `unlink-set.js`; `src/operations/catalog/export/_letters.js` (`prepare`).
