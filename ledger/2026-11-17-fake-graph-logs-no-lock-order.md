# No suite checks the order update-node takes its concept locks in, because the fake graph logs no statement's parameters

**Id:** 2026-11-17-fake-graph-logs-no-lock-order
**Type:** cleanup (a test gap; the cost of the bug it would let through is retried deadlocks, not a wrong graph)
**Opened:** 2026-11-17 (story graph-operations-first-slice #21, graph update-node, review round 1's non-blocking 6)
**Status:** OPEN
**Done:** —

**What was seen.** ADR graph-operations-first-slice/0021 Decision 5 avoids deadlocks with one order: the node's lock first, then each judged concept's header, sorted by tapestryKey. update-node gets that order from `.sort()` (`src/operations/catalog/graph/update-node.js:166`) and locks in it (`:182`).

UN13 (`test/operations/graph/update-node.test.js:400`) checks that the node's lock comes first, and counts the header locks. It can't check their order: the fake graph logs each statement's kind and text, but not its parameters (`test/helpers/graphFake.js:549–550`), and the lock statement is the same text for every key. So a change that dropped the sort would pass every suite.

Left out of review round 1's fixes: the fake is a shared helper, which parallel sessions edit, and every suite reads its log.

**Fix shape.**
- In `graphFake.js`, log the `key` parameter of a lock statement (`S.lockNode`'s), or of every statement.
- In UN13, assert the header locks' keys in sorted order, over a node in two concepts whose keys sort the other way from the order `conceptsOfNodes` returns them.
- The same check would serve create-element's and link-set's locks.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/21-update-node.md` (non-blocking 6); `test/helpers/graphFake.js` (`fakeGraph`'s `tx.run`).
