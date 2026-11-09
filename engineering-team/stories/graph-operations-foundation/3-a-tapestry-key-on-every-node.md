# Story 3: A tapestryKey on every node — `lifecycle migrate`, one shared label and a uniqueness constraint

**Status:** Draft
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
- **The queries that match `:NostrEvent`.** 360 lines in 26 files under `src/` today (D7 counted 223 in 15). Each needs to say whether it means a node from an event, or any node.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Foundation bullet)
- Epic: [engineering-team/epics/graph-operations-foundation.md](../../epics/graph-operations-foundation.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D6, D7, D11, D15, §7); catalog §8
- Story 1, whose `lifecycle status` this fills in: [1-operation-declaration-and-lifecycle-status.md](1-operation-declaration-and-lifecycle-status.md)
- Story 2, whose backup this takes first: [2-lifecycle-backup-and-restore.md](2-lifecycle-backup-and-restore.md)
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
