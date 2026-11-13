# Story 3: A tapestryKey on every node — `lifecycle migrate`, one shared label and a uniqueness constraint

**Status:** Approved
**Created:** 2026-11-08
**Type:** Feature
**Loom:** A10.3 — https://loom.brainstorm.world/t/A10.3

## Background

D6 makes a node's `tapestryKey` its id: "a random v4 UUID, assigned once and never changed (BIBLE §29), owned by neither nostr nor any key." It asks three things: "every operation that creates a node assigns it; a Neo4j uniqueness constraint covers it (which also indexes it); every backup and import path carries it." The book's frame asks for the same, today's nodes included: "Every node has a unique tapestryKey under one shared label with a uniqueness constraint." Every graph operation after this one names nodes by their tapestryKey (catalog, Conventions), so this story comes before the reads and the write path (Loom A10.4, A10.7–A10.15).

"Every node" means every node in the graph, the web-of-trust graph's included. At the planning gate (2026-11-08) the owner ruled: "Let's add tapestryKey to the NostrUser nodes too. They are subject to the concept graph rules just as much as any other nodes."

Seven facts about today's instance shape the story:

- **Most nodes get a key late, or never.** Of the paths that make nodes, only the brain write sets a tapestryKey. D6's "Today" also names the derive engine, but it reads nodes by their key and gives none. Nodes from the nostr import, the signing routes and add-subset's event-less sets get one only when someone runs `POST /api/tapestry-key/initialize` or a firmware install. A fresh scratch instance with firmware 1.0.0 had 3,142 nodes in lifecycle status's scope and 609 without a key (Loom memo #98 on A10.3). Avi's instance, built through today's routes, has nodes from the signing routes with no key (Loom memo #100 on A10).
- **Most of the graph is the web of trust, and none of it has a key.** Production, staging and tags each hold about 3 million `NostrUser` nodes (tagging-edges story 2, measured 2026-09), against a concept graph of a few thousand. Lifecycle status's counts leave them out: they count only nodes with an event address or an event id. The trust pipeline makes these nodes: the loaders of follows, mutes and reports (in batch, as a stream and in reconciliation), the tagging-edges pass, the nostr import's author nodes, and each customer's setup and metrics cards. None of them sets a key.
- **Some nodes hold a placeholder.** A key of `{}` is left on some nodes, and lifecycle status and the initialize route already count it as no key.
- **Nothing makes keys unique.** No constraint or index covers `tapestryKey`. The instance runs Neo4j 5.26 Community, which enforces uniqueness only for nodes that carry a given label, so the database can guarantee unique keys only if every node carries one shared label (design §7: "theoretically optional, practically required").
- **A backup exists now.** A10.2 built `lifecycle backup`, and the task's done-when asks that "an A10.2 backup was taken first." It takes the graph offline while it runs: about 20 seconds for a 3,147-node scratch instance (story 2's live check). How long for a graph the size of production hasn't been measured.
- **Status has a place waiting.** `lifecycle status` has a migrations part that answers "No migration has been recorded" until this story fills it in, and its cache part already counts the nodes with and without a key (story 1).
- **`NostrEvent` also marks nodes with no event.** D7: "If a node does not have an associated nostr event, then no, it should not have the NostrEvent label." Today add-subset's event-less sets carry it (BIBLE §6), and many queries find a node by `:NostrEvent` whether or not it came from an event. Once every node carries the shared label, a query that means "any node" can say so, and the label can come off the nodes with no event. At the planning gate (2026-11-08) the owner put that migration in this story.

## User-facing description

As the owner of a Tapestry instance, or an admin agent working for them, I want one call that gives every node a permanent tapestryKey, puts every node under one shared label and makes the database refuse a second node with the same key, after taking a backup, so that every node can be named by its key from then on.

As the owner or an admin, I want every node the instance makes from now on to get its key and the shared label when it is made, so that the graph doesn't drift back to nodes with no key.

As the owner or an admin, I want a node to carry `NostrEvent` only when it came from a nostr event, so that the label means what D7 says it means.

As the owner or an admin, I want `lifecycle status` to tell me which migrations have run, when, and which backup was taken before each, so that I can see where the instance stands and go back if I need to.

## Acceptance criteria

- [ ] **AC1 — Migrate, after a backup.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/lifecycle/migrate` with `migration: "tapestry-keys"`, then:
  - the instance first takes a backup, as `lifecycle backup` does, with a note naming the migration, and names it in the answer;
  - every node with no tapestryKey, or with the placeholder `{}`, gets a new random v4 UUID, and no node that already has a real key gets a new one;
  - every node carries the shared label;
  - the database refuses a second node with the same tapestryKey under that label.

  The answer gives the backup's id, how many nodes got a key, how many got the label, whether the uniqueness rule was added or already there, and the counts of nodes with and without a key before and after. Afterwards, `lifecycle status` shows no node without a key (AC4).

  It works at production's size, about 3 million `NostrUser` nodes: the caller's request doesn't time out, and the instance keeps answering and its trust pipeline keeps writing while migrate runs, except while its backup is taken. A node the pipeline makes during the run ends up with a key and the label.
- [ ] **AC2 — Keys already shared.** Given two or more nodes already hold the same tapestryKey, when migrate runs, then it changes none of their keys. It still gives keys and the label to the rest, leaves the uniqueness rule out, and names each shared key with the nodes that hold it, so the owner can decide. *(Whether any instance has such nodes today is checked in Architecture; see Open questions.)*
- [ ] **AC3 — Safe to repeat.** Given migrate has run, when it is called again with nothing left to change, then it takes no backup, changes nothing and says the migration is already applied. Given nodes without a key have appeared since, for example made through raw Cypher, it takes a backup and gives them keys and the label, as in AC1.
- [ ] **AC4 — Status shows it.** Given a migration has run, when the owner or an admin asks for `lifecycle status`, then its migrations part lists it as applied, with when it last ran, who ran it and the backup taken before it, says whether the uniqueness rule is in place, and counts the nodes in the whole graph with and without a key. Before any run, the part says no migration has run, lists the migrations that can, and gives the same counts. The cache part keeps counting as it does today.
- [ ] **AC5 — New nodes get a key when they are made.** Given an instance, whether or not migrate has run, when a node is made by any of the instance's own routes and tasks, then it has a tapestryKey and the shared label as soon as it exists, with no migrate or initialize run in between. That covers:
  - importing a nostr event, with its author's node: the event route, the file import, a firmware install and pulling a class thread;
  - the signing normalize routes, add-subset's event-less sets and the brain write;
  - the trust pipeline: the loaders of follows, mutes and reports in batch, as a stream and in reconciliation, the tagging-edges pass, and each customer's setup and metrics cards.

  A node one of these touches again that still has no key gets one too.
- [ ] **AC6 — `NostrEvent` comes off the nodes with no event.** Given `tapestry-keys` has been applied, when the owner or an admin calls migrate with `migration: "event-less-nodes"`, then after a backup, as in AC1, every node that the instance made with no nostr event behind it loses the `NostrEvent` label, and keeps its key, its other labels, its properties and its relationships. Today those are add-subset's sets. A placeholder the import made for an event it has seen referenced but not yet received keeps the label, since it stands for an event. The answer names the backup and says how many nodes lost the label. Afterwards:
  - every route and page that found, showed or changed one of these nodes before still does: for example, an event-less set still appears among its concept's elements and on its set's page, add-subset can still add a set under it, and lifecycle backup and restore still carry it;
  - add-subset makes its new sets without the label.

  Called before `tapestry-keys` has been applied, it refuses and changes nothing, naming the migration to run first. Called again with nothing left to change, it behaves as AC3 says.
- [ ] **AC7 — Refusals, callers and the command.** Migrate refuses, and changes nothing, given a migration name it doesn't know (naming the ones it does), while a backup or restore is running, or when the backup before it fails. Each refusal says in words what went wrong. Migrate is open to the owner and admins alike (the owner's ruling at the planning gate, 2026-11-08). A caller who isn't signed in is refused with 401, and a signed-in person who is neither the owner nor an admin with 403. Someone with a shell inside the instance runs `tapestry lifecycle migrate --migration <name>` without signing in, and gets the same answers as the route.

Seven criteria, covering two migrations of one operation. They stay one story because the uniqueness rule is only worth having once every node can carry a key, a migration is only worth running once new nodes stop arriving without one, and the `NostrEvent` label can only come off once the shared label is there for the queries that mean "any node". The owner chose to keep the web-of-trust nodes and the label's migration in this story. If the change proves too big to review in one sitting, either can become a story of its own.

## Concepts touched

None changed. Every node gains a property where it lacks one, and a label, but no concept's definition, schema or elements change.

## Out of scope

- **Scripts nothing in the instance runs,** such as the concept graph's old setup and batch-transfer scripts, and the backup and deprecated copies of the trust pipeline's scripts.
- **Nodes made outside the instance's own routes,** by raw Cypher through `POST /api/neo4j/query` or by other tools (D15). Nothing can make them set a key; running migrate again gives them one (AC3), and `rules check` will report them.
- **Carrying keys across instances.** The file export won't write each node's key, and the file import won't keep another instance's keys: that waits for `export file` (A10.35) and the import operations, under D15. The file import still gives the nodes it makes a key of their own (AC5). A backup carries every key already (A10.2).
- **Copying `name` into `tapestryValue`** (D11), and `POST /api/normalize/migrate-primary-property-ztags` (catalog §9): each is a migration for later.
- **Today's `/api/tapestry-key/*` routes** stay as they are (D15).
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

To resolve at this gate.

1. **Which nodes are "every node"?** *Resolved: every node in the graph, `NostrUser` included, in this story* (the owner's answer, 2026-11-08, quoted in the Background). AC1 and AC5.
2. **Removing `NostrEvent` from nodes with no event.** *Resolved: in this story* (the owner's answer, 2026-11-08). AC6.
3. **Who may call migrate?** *Resolved: the owner and admins,* as for status, backup and restore (the owner's answer, 2026-11-08). AC7.

For Architecture, not this gate:

- **The shared label's name.** Drafting leans to `TapestryNode`: it says nothing about the node, and doesn't collide with the `tapestry` concept (BIBLE §6).
- **Shared keys today.** Before AC2 is built, check staging and a scratch instance for keys held by more than one node.
- **Telling add-subset's sets from the import's placeholders.** Both have an event-form address and no event id. A placeholder that lost `NostrEvent` would be missed when its event arrived, and the import would make a second node for it.
- **Production's size.** How long the backup before migrate keeps a production-sized graph offline, how to give 3 million nodes keys while the stream writes, and what the extra property and the uniqueness rule's index cost. Measure on a scratch instance loaded to that size, never on a shared one.
- **Keys on writes the pipeline repeats.** The stream touches the same `NostrUser` nodes over and over. Healing a node with no key on every touch (AC5) shouldn't add a write each time.
- **The queries that match `:NostrEvent`.** 223 lines in 15 files under `src/` that something runs, as D7 counted, and 111 more in the Cypher 28 UI files send (a first count of 360 also took in `:NostrEventTag`; ADR 0003, Context 7). Each needs to say whether it means a node from an event, or any node.

## Evidence

### The live check and the measurements (Implementation, 2026-11-13, on `9b4bdfb7`)

These ran on the Mac Studio on two throwaway instances from `scripts/scratch-stack.sh`, one after the other, never a shared or private one. This is the summary by criterion. Every step, number and backup id is in the test plan's Verification, under "The live check and the measurements".

- **The instances.** Both ran image `agent-memory-tapestry`, since the default image has no `cron-parser`. `src/` was mounted from a worktree, and `bin/tapestry.js` and `bin/control-panel.js` were copied in. Neo4j 5.26.10 ran at the script's sizes. Neither instance published a port, nothing had to be paused, and both were removed afterwards.
  - Each ran the setup task's indexes first (`POST /api/neo4j-setup-constraints-and-indexes`), since a fresh instance has none and production's graphs have them.
  - **Instance A** had a fixture built with this branch's base, `f3aab4d4`, before the switch to `9b4bdfb7`. It held sets A and B from add-subset, B under A, each a `NostrEvent` with no `id`; an event whose `a` tag made a placeholder; one key of `'{}'`; and three `NostrUser` nodes from the stream. That made 3,166 nodes, 634 of them without a key.
  - **Instance B** was fresh, for AC2. It was then loaded with 3,000,000 `NostrUser` nodes for measurements 2 and 5.
- **No Cypher failed on Neo4j,** and no code was changed.

The live check covers AC1, AC2 and AC6, with AC4's status and AC5's new nodes along the way. AC3 and AC7 aren't in it.

- **AC1, migrate after a backup: passes.**
  - On instance A, `tapestry lifecycle migrate --migration tapestry-keys` took 29.2 s. The backup came first (`20261113T170208Z-36087224`), with the graph offline 19.3 s and the counts exact.
  - The report: 634 keys given, 3,166 labels given, the `'{}'` replaced, one pass, no failed batch, the rule added and the index already there.
  - All 2,532 real keys are unchanged, and no key is held twice.
  - **At production's size** (measurement 2, on instance B). Before the run, 2,997,500 nodes had no key. After it, none had, and all 3,007,677 had the label. It took 58.7 s, in one pass of 17.4 s with no failed batch, and the same statement run directly had 0 retries. The backup kept the graph offline 24.1 s, and the rule came online 5.1 s after it was made.
  - **The pipeline kept writing.** Throughout the run, a loop put 5 follow lists a second on the stream consumer's queue. The backup paused the consumer for about 33 s, and it drained the 124 lists queued meanwhile within 20 s. It logged no errors, Neo4j logged no deadlock, and the nodes it made during the run came out with a key and the label.
- **AC2, keys already shared: passes.** On instance B, two firmware nodes were given the same key by Cypher. `tapestry-keys` changed no key, left the rule out, and named the shared key with both nodes. Nothing else needed a key, so it answered in 0.5 s with no backup. Its note's wording about the index is wrong (finding 3).
- **AC4, status.** After both runs, both migrations show as applied, each with its last run and its backup. The keys part reads 3,166 nodes, 3,166 with the label and 0 without a key, with the rule and the index in place. Before any run the counts were right, but the note called `event-less-nodes` applied (finding 2). At 3 million nodes a whole status took 1.2–1.4 s and its scan 0.42–0.63 s, so status keeps scanning on every call (M11 stands).
- **AC5, new nodes: passes for the paths exercised.** With no migrate run in between, these had the label and a key as soon as they existed:
  - a new event through the event route, with its 5 tag nodes, its author, and its placeholders by address and by `id`. Its `a` tag to set C made no second node at C's address, and gave C no `NostrEvent`;
  - set C, from add-subset;
  - new `NostrUser` nodes from the stream consumer. The existing user it touched kept its key.

  The other paths AC5 names weren't exercised live.
- **AC6, `NostrEvent` off the nodes with no event: fails on one surface.**
  - Run before `tapestry-keys`, `event-less-nodes` was refused (409 `run-tapestry-keys-first`, exit 1), and no backup was taken.
  - Run after it, it took 27.5 s after its backup (`20261113T170352Z-c368852c`, offline 17.9 s) and relabelled 2. Only A and B lost `NostrEvent`, no key changed, and the placeholder kept the label.
  - **Still working:** Set Detail, and `readVerbs.js`'s `group` and `node`, for A and B; the `tag` concept's Elements tab; the concept-graph API; add-subset under B, whose set C has no `NostrEvent`; a backup and a restore, with `match: true` and every node as it was. An event imported at A's address, and one at B's through `importEventDirect`, each landed on the same node, which got `NostrEvent` back and kept its key.
  - **Fails:** the `set` concept's Elements tab. After the migration, A and B drop out of it (100 rows to 98), and C never appears there (finding 1).
- **Measurement 1, the disjunction: passes.** `MATCH (n:NostrEvent|TapestryNode {uuid: $u})` plans as seeks of both `nostrEvent_uuid` and `tapestry_node_uuid`, with no label or all-nodes scan, before migrate, after it, and at 3 million nodes.
  - **Amendment 1's index: passes.** `tapestry_node_uuid` wasn't there before the control panel's restart, and was ONLINE after it, with no migrate run and no rule.
- **Measurement 2, production's size.** Its run, the offline window, the passes and the rule are under AC1, and Decision 4's scan is under AC4. Also:
  - Decision 10's walk, in a later backup: `countGraph` took 4.9–5.0 s at 195–203 MB. The backup took 41.1 s, 22.7 s of it offline, and its worker peaked at 241 MB.
  - The store: `databases/neo4j` went from 1,011,096,160 bytes to 1,313,361,920 (30% more), and the transaction logs from 820,336,321 to 1,360,979,567.
  - This graph had 12,475 relationships, where production has the follow graph's millions, and a small Neo4j. So production's offline window will be longer than 24 s.
- **Measurement 3, the fragment: passes.** On a node with no key, `keyNode` gave `labelsAdded: 1, propertiesSet: 1`, then 0 and 0. A `'{}'` key was replaced by a new v4 UUID. Where the `MERGE` made the node itself: `nodesCreated: 1, labelsAdded: 2, propertiesSet: 2`, then 0 and 0.
- **Measurement 4, today's graphs.** On instance A before any migration: 2 of Decision 5's nodes, 3 `NostrEvent` nodes with no `id`, and 0 addresses held by more than one node. On staging, with the owner's OK (2026-11-13, 18:39 UTC): 0, 2 (both placeholders) and 0, with the full scan taking 5.9 s. So on staging today `event-less-nodes` would relabel nothing.
- **Measurement 5 (Amendment 2), the key read before migrate.** With the rule dropped on instance B's 3,008,029 keyed nodes, `countGraph`'s stream took 5.9–6.0 s at 373–380 MB, with the same digest as the walk. A backup's worker peaked at 412 MB, where A10.2's one-query read peaked at 1,662 MB. Amendment 2's "about 200 MB" is low.

**Findings for the Implementer and the Reviewer,** given in full in the test plan:

1. AC6's failure: `ConceptElements.jsx:70` and `:81` end on `(e:NostrEvent)`, and no test reads them. `readVerbs.js:508` and `:572–573` have the same shape, and weren't exercised.
2. Before `tapestry-keys`, status calls `event-less-nodes` applied.
3. The shared-keys note says the index "were left out" when the report says it was already there.
4. Migrate's report has no count of retried batches.
5. `placeholdersReplaced` read 132 where there were none, because other writers keyed nodes between its two scans.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Foundation bullet)
- Epic: [engineering-team/epics/graph-operations-foundation.md](../../epics/graph-operations-foundation.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D6, D7, D11, D15, §7); catalog §8
- Story 1, whose `lifecycle status` this fills in: [1-operation-declaration-and-lifecycle-status.md](1-operation-declaration-and-lifecycle-status.md)
- Story 2, whose backup this takes first: [2-lifecycle-backup-and-restore.md](2-lifecycle-backup-and-restore.md)
- ADR: [engineering-team/decisions/graph-operations-foundation/0003-a-tapestry-key-on-every-node.md](../../decisions/graph-operations-foundation/0003-a-tapestry-key-on-every-node.md)
- Test plan: [3-a-tapestry-key-on-every-node.test-plan.md](3-a-tapestry-key-on-every-node.test-plan.md)
- Review: [engineering-team/reviews/graph-operations-foundation/3-a-tapestry-key-on-every-node.md](../../reviews/graph-operations-foundation/3-a-tapestry-key-on-every-node.md) (round 1, 2026-11-13)
