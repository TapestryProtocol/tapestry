# The shared D4 test calls an `e`-tag placeholder and the owner's NostrUser node the instance's own, which merge-nodes and delete-node must decide on before they call it

**Id:** 2026-11-17-own-test-reads-pubkey-as-author
**Type:** bug (latent: update-node can't reach it; merge-nodes A10.25 and delete-node A10.26 will)
**Opened:** 2026-11-17 (story graph-operations-first-slice #21, graph update-node, review round 1's non-blocking 4)
**Status:** OPEN
**Done:** —

**What was seen.** ADR graph-operations-first-slice/0021 Decision 3 makes one test of whose node it is: `whoseNode` and `requireOwn` in `src/operations/catalog/graph/_nodes.js`. merge-nodes (A10.25) and delete-node (A10.26) are to call `requireOwn` for D4. The test reads the node's `pubkey` as its author (`_nodes.js:71–72`), and a node with no author is the instance's own, as the read conventions' `own` says. Two kinds of node aren't letters, and the answer doesn't fit them:
- **An `e`-tag placeholder** answers `own: true` and `hasLetter: true`. The import makes it as `NostrEvent {id, uuid}` with no `pubkey` (`src/api/neo4j/eventSync.js:268–270`). It stands in for another author's event, whose id it has.
- **The owner's and the assistant's `NostrUser` nodes** answer `own: true`, since their `pubkey` is the person, not an author.

The review's probe ran `whoseNode` over the fake graph's reader: the `e`-tag placeholder answered `{ own: true, author: null, hasLetter: true }`, the owner's NostrUser `own: true`. An `a`-tag placeholder, which records its author, answered `own: false`.

update-node can't reach either case: neither has a section to change, so a later step refuses it (`not-an-element`, or `unreadable-json`). A merge or a delete has no such step.

**Fix shape.** In ADR 0021's Decision 3 terms, before A10.25 or A10.26 calls `requireOwn`:
- decide what counts for a node that isn't a letter or an element: by its labels (`NostrUser`), or by a placeholder's mark (an `id` with no `pubkey` and no `kind`);
- put the answer in `whoseNode`, so all three operations, copy-node (A10.24) among them, share it;
- add the two cases to `test/operations/graph/update-node-shared.test.js`.

**Pointer:** ADR graph-operations-first-slice/0021 Decision 3 and Amendment 2; `src/operations/catalog/graph/_nodes.js` (`whoseNode`); `engineering-team/reviews/graph-operations-first-slice/21-update-node.md` (non-blocking 4).
