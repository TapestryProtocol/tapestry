# ADR 0009's Context 4 says no index covers a node's uuid, but `tapestry_node_uuid` does; resolve's address lookup scans because of its OR

**Id:** 2026-11-16-adr-0009-uuid-index-misstated
**Type:** docs
**Opened:** 2026-11-16 (story graph-operations-first-slice #9, graph resolve, A10.9; its review, non-blocking 1)
**Status:** OPEN
**Done:** —

**What was seen.**
- **The claim.** ADR graph-operations-first-slice/0009, Context 4 (line 54) says "No index covers `name`, `tapestryValue` or a `TapestryNode`'s `uuid`".
- **The index exists.** The control panel makes `tapestry_node_uuid` at every boot (`bin/control-panel.js:360`, graph-operations-foundation ADR 0003 Amendment 1), "so lookups by address have one from the deploy on". Both the agent-memory instance and a fresh scratch stack have it.
- **An address lookup still scans.** Family A's `n.uuid = $address OR n.id = $address` (`src/operations/resolve.js:157`) can't seek on that index alone. A page took 0.503 s at 503,507 nodes, under the ADR's 2 s, so nothing has to change now.

**Fix shape.**
1. A line of amendment to ADR 0009 that corrects Context 4.
2. Only if address lookups come to matter at scale: split family A, so that `n.uuid = $address` seeks on the index and `n.id = $address` is a statement of its own.

**Pointer:** `engineering-team/stories/graph-operations-first-slice/9-resolve.md` (Evidence, "Found along the way"); `engineering-team/reviews/graph-operations-first-slice/9-resolve.md` (non-blocking 1).
