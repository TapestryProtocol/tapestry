# graph walk reaches a keyed node with no `TapestryNode` label, never walks on from it, and still says it's complete

**Id:** 2026-11-17-walk-skips-unlabelled-keyed-nodes
**Type:** cleanup
**Opened:** 2026-11-17 (story graph-operations-first-slice #14, Loom A10.14; its review, non-blocking 4)
**Status:** OPEN
**Done:** —

**What was seen.** A walk's step (ADR graph-operations-first-slice/0014, Decision 1, S2) finds the nodes the walk is at with `MATCH (x:TapestryNode) … WHERE x.tapestryKey IN $frontier`. It leaves the node at the far end, `m`, unlabelled. So a node with a tapestryKey and no `TapestryNode` label is answered as reached, but the next step never walks on from it, and the walk still says `complete: true`. Given as a start, such a node is refused `unknown-node`, since S1 needs the label too. The review's probe walked from a start, through such a node, toward a node beyond it, to depth 3. It reached the unlabelled node at step 1 and never the one beyond.
- **Such nodes are rare.** Every writer labels a node as it keys it (`keyNode`, `src/lib/tapestry-key-cypher.js:21–26`). `lifecycle migrate` labels the rest, except nodes that share a key, which it leaves for the owner (`src/operations/catalog/lifecycle/_migrations.js:296`). Only the old `POST /api/tapestry-key/initialize` keys without labelling (`src/api/tapestry-key/index.js:139`).
- **list-relationships has the same asymmetry.** It answers a far end with no label (ADR 0013's filter F), but refuses such a node as the one it lists.
- **graph search never finds such a node** (story graph-operations-first-slice #8's review, note 5). Its index covers `TapestryNode` only (`src/lib/graph-search-index.js:21–27`), and S1 joins a hit on a tag to its node through `(p:TapestryNode)` (`src/operations/catalog/graph/search.js:46`). So such a node is answered neither by its name nor by its fields, and nothing in the answer says so. Given as `concept`, such a header is refused `unknown-node`.

**Why it matters.** A walk's `complete` is a promise that it reached everything within its depth. Through such a node it isn't, and nothing in the answer says so.

**Fix shape.** Decide it in an amendment to ADR 0014, and to ADR 0013 for list-relationships, with a test on each:
- label the far end in S2, `(m:TapestryNode)`, so a walk never reaches what it can't walk on from. That changes which nodes walk and list-relationships answer; or
- drop the label from S1 and from S2's frontier match, and seek by key alone. The `tapestry_key` index is on the label, so every step would then scan.

For search, in an amendment to ADR 0008: S1's label on `p` only filters, since the join starts from the hit.
- **Dropping that label** would find, through their labelled tags, the nodes `lifecycle migrate` leaves unlabelled because they share a key.
- **A node the old initialize route keyed** has unlabelled tags too, so only migrate makes it findable. That route keys every node with a `uuid` or `id`, tags included, and labels none (`src/api/tapestry-key/index.js:114–119`, `:136–141`).
- **By its own name,** a node is found only with the label, which the index is on.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/14-walk.md` (Findings, non-blocking 4); `engineering-team/reviews/graph-operations-first-slice/8-search.md` (Findings, note 5).
