# The trust pipeline's card sets carry the concept graph's `Set` label

**Id:** 2026-11-15-card-sets-carry-the-set-label
**Type:** cleanup
**Opened:** 2026-11-15 (story graph-operations-foundation #8, Out of scope)
**Status:** OPEN
**Done:** —

**What was seen.** The trust pipeline makes one `SetOfNostrUserWotMetricsCards` node for each user it scores. Both places that make them also label them `Set`:
- `src/cns/addSetsOfMetricsCards.sh:26`, `MERGE (n) -[:WOT_METRICS_CARDS]-> (s:Set:SetOfNostrUserWotMetricsCards)`;
- `src/cns/prepareNeo4jForCustomerData.sh:100`.

They aren't sets of the concept graph: they have no address, no class-thread edges, and no Tapestry JSON. But every read of `:Set` walks them.
- **Staging** (count store, 2026-11-15): 370,377 of 370,401 `Set` nodes.
- **Production:** 390,460 of 390,480.

Since `tapestry-keys` gave them keys, Pass 3 picked them all up, and would have needed weeks to rebuild them. Story 8 made Pass 3 and derive-status pass them by, keeping only the nodes with an address. Any other reader of `:Set` still pays for them.

**Fix shape.** Two choices.
- **Take `Set` off them.** Both scripts, and every query that matches `(:Set:SetOfNostrUserWotMetricsCards)`, change at once: a `MERGE` on the old pattern would make duplicates. Each instance also needs a migration of hundreds of thousands of nodes.
- **Keep the label, and leave out the nodes with no address** wherever the concept graph reads `:Set`, as story 8 does.

This is worth deciding before more readers of `:Set` are written.

**Pointer:** `engineering-team/stories/graph-operations-foundation/8-pass-3-finishes-in-minutes.md` (Background, Out of scope).

**The graph operations' readers of `:Set` take the second choice (2026-11-15).**
- **link-set and unlink-set** (story graph-operations-first-slice #28, ADR graph-operations-first-slice/0028 Amendment 3) count a node as a set, a superset or a parent only when it has an address, its `uuid`. So they refuse a card set as either end, never count one as a set's parent, and `set-has-a-parent`'s check doesn't report the card sets.
- **list-elements** (A10.11, ADR graph-operations-first-slice/0011 Amendment 2) reads a set the same way.

The labels stay as they are. Each new reader of `:Set` follows the same rule, until the first choice, taking the label off, is decided.
