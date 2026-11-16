# Four `/api/tapestry-key` routes find a node by key with no label, so each call reads the whole graph

**Id:** 2026-11-15-tapestry-key-routes-scan-every-node
**Type:** bug
**Opened:** 2026-11-15 (story graph-operations-foundation #8, Out of scope)
**Status:** OPEN
**Done:** —

**What was seen.** Story 8 fixed the rebuild routes. These four still match `(n { tapestryKey: … })` with no label, in `src/api/tapestry-key/index.js`:
- `POST /api/tapestry-key/:key`, at `:195`;
- `POST /api/tapestry-key/offload`, at `:266`;
- `GET /api/tapestry-key/resolve/:key`, at `:297`;
- `POST /api/tapestry-key/offload-all`, at `:354`, once for each tag it moves.

Neo4j can serve none of them from an index, so each call reads every node: 3,851,736 on staging since `tapestry-keys`. On a scratch stack in staging's shape that lookup took 1.35 s (story 8's test plan, M1).

**Fix shape.** As story 8's `findByKey` (`src/lib/tapestry-derive.js`): look the key up as `(:TapestryNode {tapestryKey: $key})`, which the rule `tapestry_key` indexes. Fall back to the lookup with no label only when that finds nothing, for an instance that hasn't run `tapestry-keys`.

**Pointer:** `engineering-team/stories/graph-operations-foundation/8-pass-3-finishes-in-minutes.md` (Out of scope).
