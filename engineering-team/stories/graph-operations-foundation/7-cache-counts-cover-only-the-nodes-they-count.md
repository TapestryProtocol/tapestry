# Story 7: The cache counts cover only the nodes they count

**Status:** Approved
**Created:** 2026-11-13
**Type:** Bug

## Background

Story 3 (Loom A10.3) gave every node in the graph a tapestryKey: concept-graph nodes, and also every `NostrUser`, tag node and metrics card. On staging, `tapestry lifecycle migrate --migration tapestry-keys` ran on 2026-11-13 and keyed 3,843,305 nodes. Afterwards `tapestry lifecycle status` answered:

> cache: `nodes: 3608, withTapestryKey: 3608, withoutTapestryKey: 0, cached: 0, cachedEmpty: 0, notCached: 3849037`

The cache part counts the nodes that can have a cached Tapestry JSON: those with an address (a `uuid` or an `id`), 3,608 on staging. But its "not cached" figure counts every keyed node in the graph. So the part no longer adds up: cached, empty and not cached should sum to the nodes with a key, as they did in story 1's evidence (428 + 0 + 2,105 = 2,533).

**The cost.** To get that figure, each answer looks up every keyed node's key in the cache, 3.85 million of them on staging and more on production, all held in the control panel's memory at once. The same counts answer `GET /api/tapestry-key/status`, and the Dashboard's Tapestry JSON panel calls that every time it loads. Story 3's review found the same pattern in backups and fixed it there (its Amendment 2), but missed it here.

**Who is affected:** the owner and admins reading `lifecycle status`, everyone who opens the Dashboard on an instance that has run `tapestry-keys` (staging today), and the control panel's memory on each of those calls. This should be fixed before staging is promoted to main.

## User-facing description

As the owner, or an admin agent, I want the cache counts in `lifecycle status` and on the Dashboard to describe the same nodes, so the figures add up and I can tell how much of the cache is built. And I want asking for them not to load every node's key in the graph into memory.

## Acceptance criteria

- [ ] **AC1 — the cache part adds up.**
  - Given a graph where every node has a tapestryKey but only some have a `uuid` or an `id` (as on staging since `tapestry-keys`), when the owner asks `lifecycle status`, then in the cache part `cached + cachedEmpty + notCached` equals `withTapestryKey`, and none of them is larger than `nodes`.
  - Its counts for those nodes are what they would have been before story 3. For example, a graph of 3,608 addressed nodes and 3 million keyed `NostrUser` nodes answers `notCached` of at most 3,608, not 3,003,608.
- [ ] **AC2 — the Dashboard's route adds up too.** Given the same graph, when anyone asks `GET /api/tapestry-key/status`, then its cache figures (`lmdb.derived + lmdb.empty + lmdb.missing`) equal its `initialized` count, and `total` counts only the addressed nodes, as before.
- [ ] **AC3 — only the counted nodes are looked up.** Given a graph that adds 3 million keyed nodes with no address to the same addressed nodes, when either answer is asked for, then it looks up exactly as many keys in the cache as it counts with a key. The nodes with no address add nothing to the lookups, and no read returns their keys.
- [ ] **AC4 — nothing else moves.**
  - The migrations part's whole-graph key counts are unchanged: they still count every node.
  - A `'{}'` key still counts as no key.
  - A node with an address and no key is still counted as without a key and is never looked up.

## Concepts touched

None by handle. The counts cover the concept-graph's nodes, those with an address; no concept definition changes, and no firmware reinstall is needed.

## Out of scope

- Telling whether a cached JSON is stale. That is `cache check` (catalog §7), as story 1 said.
- Counting `NostrUser` or tag nodes in the cache part. They never get a cached Tapestry JSON, and the migrations part already counts every node's key.
- Changing what the Dashboard panel shows, or its words.
- Why staging's cache holds no entries (`cached: 0`). Story 3's migration changed none of those 3,608 nodes' keys, so it isn't this bug. It is worth asking about separately.

## Open questions

None. Every criterion can be observed from outside: through `lifecycle status`, through `GET /api/tapestry-key/status`, and by counting the cache lookups and the keys read in a stack-free test.

## Linked artifacts

- ADR: none. Under Standard, a bug skips Architecture when the fix is obvious. The owner chose the Standard bug path on 2026-11-13.
- Found by: story 3's run on staging, 2026-11-13 (`engineering-team/stories/graph-operations-foundation/3-a-tapestry-key-on-every-node.md`).
- Test plan: `engineering-team/stories/graph-operations-foundation/7-cache-counts-cover-only-the-nodes-they-count.test-plan.md`
- Review: (filled in after Review phase)
