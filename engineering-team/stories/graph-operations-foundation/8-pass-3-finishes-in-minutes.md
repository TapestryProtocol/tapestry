# Story 8: A firmware install's Pass 3 finishes in minutes

**Status:** Approved
**Created:** 2026-11-15
**Type:** Bug

## Background

Story 5 (Loom A10.5) added a firmware concept, `neo4j-property`, so staging needed a firmware install. Story 5's session started one on 2026-11-15 at about 19:09 UTC (`POST /api/firmware/install`). Pass 1 and Pass 2 finished with no errors, and the new concept and its two sets are in place. Then Pass 3 stalled. Pass 3 rebuilds the cached Tapestry JSON of every node labelled ListItem, ListHeader, ConceptHeader, JSONSchema, Property, Set and Superset, one node at a time, label by label (`POST /api/tapestry-key/derive-all/<label>`). Only then does it apply enumerations, wire implicit elements and add the community-reference edges. It rebuilt 355 ListItems between 19:30 and 20:10 UTC, about 6.9 s each. At the owner's word, story 5's session stopped it at 20:13:17 UTC by restarting staging's control panel. It was then partway through ListHeader. Apply-enumerations, wire-implicit-elements and the community-reference edges never ran. Nothing has been rebuilt there since (checked 20:49 UTC).

Two things make Pass 3 stall.

- **It now rebuilds the trust pipeline's card sets.** Staging has 370,401 nodes labelled `Set`. 370,377 of them are `SetOfNostrUserWotMetricsCards`: the trust pipeline makes one for each user it scores, to hold that user's metrics cards. They have always carried `Set`, but they are not sets of the concept graph. They have no address (no `uuid` and no `id`) and no class-thread edges, and nothing reads a Tapestry JSON for them. Pass 3 picks the nodes to rebuild by label and key. Story 3 gave every node a key, so since story 3's migration ran on staging (2026-11-13), Pass 3 picks all of them. Before that they had no key and were skipped. The Tapestry JSON a card set gets is empty: no slug, no name, no `uuid`, and every list blank.
- **Each rebuild reads the whole graph.** Some of a rebuild's lookups name no label, so the database reads every node to answer them: 3,851,736 nodes on staging. A ListItem's rebuild has two such lookups. A Set's has four. A rebuild by key, the route that follows each edit the instance publishes to its own concept graph, has one more.

**Measured on a scratch stack seeded to staging's shape** (3,851,244 nodes, among them 3,107,261 users and 370,377 card sets each holding a card; every node keyed; the `tapestry_key` rule online; Neo4j 5.26.10 with 512 MB of page cache):

| What | Time today |
|---|---|
| Rebuild one ListItem by key | 3.45 s |
| Rebuild one concept Set by key | 4.7 s |
| Rebuild one card set by key | 4.6 s |
| Rebuild all 40 ConceptHeaders (`derive-all`) | 75.2 s (1.9 s each) |
| A lookup that reads every node | 0.45–1.35 s |
| A lookup that starts from a node's own edges | 3–4 ms |

At that rate, Pass 3's Set rebuild alone would take about 14 days on the scratch stack. Staging ran about 3.7 times slower (6.9 s per ListItem against 1.9 s), so there it would take about 50 days.

**Production today** (read-only, 2026-11-15 20:48 UTC). It has 4,625,039 nodes and 390,460 card sets. Story 3 hasn't reached it, so its card sets have no key, and its Pass 3 would rebuild 613 nodes. At staging's rate that is still more than an hour, and production has 20% more nodes to read. Once story 3 is promoted and `tapestry-keys` runs there, Pass 3 would pick all 390,460 card sets and stall as staging did. So this has to be fixed before staging is promoted to main.

**derive-status can't add up either.** On staging, `GET /api/tapestry-key/derive-status` reads Set as 24 derived of 370,401, and no rebuild can make the two meet. Pass 3 sums derive-status into its "Total derived".

**Who is affected:**
- the owner and admin agents who install firmware: staging today, and every instance with a trust pipeline once story 3 reaches it;
- staging, which still needs its install finished;
- anyone who edits the instance's own concept graph, since each edit waits for a rebuild by key (several seconds at staging's size).

## User-facing description

As the owner, or an admin agent, I want a firmware install to finish in minutes on an instance whose trust pipeline has scored millions of users. Installing a concept shouldn't stall for weeks, or need the control panel restarted to stop it.

## Acceptance criteria

- [ ] **AC1. Pass 3 rebuilds only nodes with an address.**
  - Given a graph with keyed card sets (labelled `Set` and `SetOfNostrUserWotMetricsCards`, with no `uuid` and no `id`) beside the concept graph's sets, when Pass 3 rebuilds Set, then every Set with an address is rebuilt and no card set is. No card set gets a cached Tapestry JSON or a `tapestryJsonUpdatedAt`.
  - The same holds for each of the seven labels. A keyed node with no address is never rebuilt, whatever labels it has.
  - An event-less set (a `uuid` and no `id`, made by add-subset) is still rebuilt.
- [ ] **AC2. derive-status counts the nodes Pass 3 rebuilds.**
  - Given the same graph, when anyone asks `GET /api/tapestry-key/derive-status`, then each label's `total` counts only the nodes with that label, a key and an address.
  - After a full Pass 3, each label's `derived` equals its `total`. On staging's shape, Set reads 24 of 24, not 24 of 370,401.
- [ ] **AC3. A rebuild doesn't read the whole graph.**
  - Given a graph in staging's shape (3.85 million nodes, nearly all of them outside the concept graph), when one concept node of any of the seven labels is rebuilt, then it takes at most 200 ms on the scratch stack. That holds when Pass 3 rebuilds it, and when it is rebuilt by key with `POST /api/tapestry-key/derive/:key`.
  - Taking away the 3.85 million nodes outside the concept graph changes that time by no more than half.
- [ ] **AC4. The whole of Pass 3 finishes in minutes.**
  - Given a scratch stack seeded to staging's shape, as above, when the firmware install runs, then Pass 3 finishes in under 10 minutes. That covers the seven rebuilds, apply-enumerations, wire-implicit-elements and the community-reference edges.
  - The install answers success, and its log reaches "FIRMWARE INSTALL COMPLETE".
  - The test plan records the time of Pass 3 and of each of its steps, and today's per-node times with the estimate they give.
- [ ] **AC5. Nothing else changes.**
  - On the same graph, every node Pass 3 rebuilds gets the same Tapestry JSON as today's code gives it, apart from the time it was derived: the same elements, child and parent sets, elementOf, schemas and validation results.
  - Apply-enumerations updates the same schemas, and wire-implicit-elements wires the same elements, as today.
  - A rebuild by key of a node with no address does what it does today.

## Concepts touched

None by handle. No concept definition changes, so the fix itself needs no firmware reinstall. Staging's interrupted install is still unfinished, and rerunning it is the owner's call (Out of scope).

## Out of scope

- **Taking `Set` off the card sets.** They would stop sharing a label with the concept graph's sets. But the trust pipeline's own scripts find them by `Set` and `SetOfNostrUserWotMetricsCards`, so the change would reach those scripts and every instance's data. This story makes Pass 3 pass them by instead. Renaming the label is worth deciding separately.
- **The other `/api/tapestry-key` routes that find a node by key with no label:** writing a Tapestry JSON (`POST /api/tapestry-key/:key`), offload, offload-all and resolve. None of them runs in Pass 3.
- **The time of Pass 1 and Pass 2.** The test plan records them, and anything slow they show becomes a story of its own.
- **Rerunning the install on staging or production.** That is the owner's call once the fix is deployed.
- **Rebuilding only what changed since the last install** (an incremental Pass 3).

## Open questions

None. Every criterion can be observed from outside: through derive-status, the rebuild routes and the install's log, on a scratch stack seeded as above.

## Deviations

- **A rebuild finds its node by element id.** Each of the derivers' queries starts from the node itself (`MATCH (n) WHERE elementId(n) = $elementId`, planned as `NodeByElementIdSeek`), not from story 3's address lookup. It is a direct lookup in every state of an instance: with or without `tapestry-keys`, and with or without a node's `NostrEvent` label. The element id comes with each row derive-all selects. A rebuild by key gets it from its own lookup.
- **A rebuild by key looks the key up in the `tapestry_key` index first,** and falls back to the lookup with no label when that finds nothing (an instance that hasn't run `tapestry-keys`). So on an instance that has run it, a key that doesn't exist still reads every node before the 404, as every lookup by key did before. Until an instance runs `tapestry-keys` there is no index on the key at all. Production is in that state today. There the first lookup reads every `TapestryNode` node (every node the pipeline has touched since the deploy), and an older node then costs a read of the whole graph. That is one or two such reads, where the old rebuild by key made three to five. Pass 3 doesn't use the lookup: derive-all's rows carry their element ids (review finding 3).
- **A rebuild by key of a node with no address** is still a rebuild (AC5). Its lists now come from the node's own edges, where the old lookup by its missing `uuid` found nothing. A card set has no class-thread edges, so its Tapestry JSON is the same as before (S5, L5c).
- **derive-all's answer** counts only the nodes it rebuilds: Set's `total` is 22 on staging's shape, not 370,399.
- **Apply-enumerations finds its source by address,** with story 3's disjunction. On staging's shape the planner starts from the concept graph's HAS_ELEMENT edges instead, about 530 of them. That is its own choice, and its cost follows the concept graph, not the size of the whole graph.

## Linked artifacts

- ADR: none. Under Standard, a bug skips Architecture when the fix is obvious. The owner chose the Standard bug path on 2026-11-15. The fix follows story 3's address lookup (ADR `graph-operations-foundation/0003`, Decision 9, measurement 1) and story 7's nodes with an address.
- Found by: story 5's firmware install on staging, 2026-11-15 (`engineering-team/stories/graph-operations-foundation/5-field-mapping.md`). The cause is story 3's keying of every node (`engineering-team/stories/graph-operations-foundation/3-a-tapestry-key-on-every-node.md`).
- Test plan: `engineering-team/stories/graph-operations-foundation/8-pass-3-finishes-in-minutes.test-plan.md`
- Review: (filled in after Review)
