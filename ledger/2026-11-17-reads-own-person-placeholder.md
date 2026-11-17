# The read conventions still call an `e`-tag placeholder, and the owner's and the assistant's person nodes, the instance's own

**Id:** 2026-11-17-reads-own-person-placeholder
**Type:** bug (latent: a read's `own` steers no write)
**Opened:** 2026-11-17 (story graph-operations-first-slice #26, ADR graph-operations-first-slice/0026 Decision 4 and Consequences)
**Status:** OPEN
**Done:** —

**What was seen.** ADR 0026 Decision 4 taught the write side's test of whose node it is (`_nodes.js`'s `factsOf` and `whoseNode`) two kinds of node that are never the instance's own: a person node (`NostrUser`) and a placeholder the import made (a `NostrEvent` with no `created_at`). The read conventions were left alone (`src/operations/reads.js`'s `nodeOf`, C3). They still answer `own` by the author alone:
- an `e`-tag or `b`-tag placeholder, which records no author, reads `own: true`;
- the owner's and the assistant's person nodes, whose `pubkey` is the person and not an author, read `own: true`.

So list-relationships, walk and resolve can show such a node as the instance's own. ADR 0021 Decision 3 bound reads and writes to one `own`; ADR 0026 Decision 4 made the two differ for these two kinds only. SN11 pins that every other node still agrees.

**Fix shape.** Teach `nodeOf` the two marks. Every read statement that feeds it then has to return the node's labels and `created_at` beside `nodeColumns`, which is why ADR 0026 left it out of scope. Or document the difference in the read conventions.

**Pointer:** ADR graph-operations-first-slice/0026 Decision 4 and Consequences; `src/operations/reads.js` (`nodeOf`, `nodeColumns`); `test/operations/graph/update-node-shared.test.js` SN11; OPEN.md row `2026-11-17-own-test-reads-pubkey-as-author` (the writes' half, DONE).
