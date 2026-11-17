# graph walk reaches a keyed node with no `TapestryNode` label, never walks on from it, and still says it's complete

**Id:** 2026-11-17-walk-skips-unlabelled-keyed-nodes
**Type:** cleanup
**Opened:** 2026-11-17 (story graph-operations-first-slice #14, Loom A10.14; its review, non-blocking 4)
**Status:** OPEN
**Done:** —

**What was seen.** A walk's step (ADR graph-operations-first-slice/0014, Decision 1, S2) finds the nodes the walk is at with `MATCH (x:TapestryNode) … WHERE x.tapestryKey IN $frontier`. It leaves the node at the far end, `m`, unlabelled. So a node with a tapestryKey and no `TapestryNode` label is answered as reached, but the next step never walks on from it, and the walk still says `complete: true`. Given as a start, such a node is refused `unknown-node`, since S1 needs the label too. The review's probe walked from a start, through such a node, toward a node beyond it, to depth 3. It reached the unlabelled node at step 1 and never the one beyond.
- **Such nodes are rare.** Every writer labels a node as it keys it (`keyNode`, `src/lib/tapestry-key-cypher.js:21–26`). `lifecycle migrate` labels the rest, except nodes that share a key, which it leaves for the owner (`src/operations/catalog/lifecycle/_migrations.js:296`). Only the old `POST /api/tapestry-key/initialize` keys without labelling (`src/api/tapestry-key/index.js:139`).
- **list-relationships has the same asymmetry.** It answers a far end with no label (ADR 0013's filter F), but refuses such a node as the one it lists.

**Why it matters.** A walk's `complete` is a promise that it reached everything within its depth. Through such a node it isn't, and nothing in the answer says so.

**Fix shape.** Decide it in an amendment to ADR 0014, and to ADR 0013 for list-relationships, with a test on each:
- label the far end in S2, `(m:TapestryNode)`, so a walk never reaches what it can't walk on from. That changes which nodes walk and list-relationships answer; or
- drop the label from S1 and from S2's frontier match, and seek by key alone. The `tapestry_key` index is on the label, so every step would then scan.

**Pointer:** `engineering-team/reviews/graph-operations-first-slice/14-walk.md` (Findings, non-blocking 4).
