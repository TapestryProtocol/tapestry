# Story 26: `graph delete-node` — delete one of this instance's own elements, with its relationships and tags, recorded so a mistake can be undone, and never a node from someone else's event

**Status:** Done
**Created:** 2026-11-17
**Type:** Feature
**Loom:** A10.26 — https://loom.brainstorm.world/t/A10.26

## Background

Loom's A10.26 asks for one graph write (catalog §2, Nodes):

- **`graph delete-node`:** "Delete a node of your own, with its edges", taking `node` and answering "removed". It "refuses core nodes, sets that still have elements, and nodes from someone else's event (§10, question 5)".

Done, for Loom, is when "it is declared once; answers at `/api/tapestry/graph/delete-node` for the owner and admins; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI." It is the third element write, after create-element (A10.20) and update-node (A10.21), and the first operation that removes a node. It refuses someone else's node with update-node's test of whose node it is (ADR graph-operations-first-slice/0021 Decision 3), which was built to be shared with it.

Ten facts about today's instance shape the story:

- **No route deletes a node today** (catalog §2). The only way is write Cypher through `POST /api/neo4j/query`, which any admin can send (catalog §10, question 4). `raw delete-node` (A10.30, not built) is to be the owner's way to delete any node, from the internal CLI; `graph delete-node` is the guarded one, for the owner and admins.
- **What a node has.** Relationships in and out: the `HAS_ELEMENT` from each superset or set it is an element of, and whatever else links it to other nodes. A node from a letter also has its tags, one node for each tag of its letter, which are that letter's alone (`NostrEventTag`, by `HAS_TAG`), and an `AUTHORS` relationship from its author's `NostrUser` node. A tag naming another event (`e` or `a`) has a `REFERENCES` relationship to the node at that event. Other nodes' tags can reference it the same way, and other authors' letters can link to it. The copies of its marked fields are properties on the node itself (A10.5).
- **What stays when a node goes.** Its change entries name it by its tapestryKey and link to nothing, so `graph history` still finds them by that key. Its letter, if it has one, stays in the instance's relay and wherever else it was sent.
- **What makes a deleted node again.** Nothing imports every event as it arrives. An import runs when someone asks for one: the event-update route, a class-thread pull, the DList page's import buttons, a file import, and a firmware install, for firmware's own nodes. Given a deleted node's letter, any of them makes the node again at its address, as a new node with a new tapestryKey. ADR 0021's Consequences describe the same routes undoing an update.
- **The import's placeholders and `NostrUser` nodes.** For a tag naming an event the graph doesn't hold, the import makes a placeholder node at it: by the event's id for an `e` tag, recording no author, and by its address for an `a` tag, recording the author the address gives. For each letter's author it makes a `NostrUser` node, which the instance's Web of Trust is computed from. On this instance neither is an element of any concept: the `nostr-user` concept has no elements (`/api/concept-graph/summaries`, 2026-11-17).
- **The shared test of whose node it is** counts a node as the instance's own when its author is the instance's assistant or its owner, or when it records none, as the read conventions count one (ADR 0021 Decision 3; the owner's answer to story 21's open question 3). update-node's review found two kinds of node it answers wrongly for a delete (memo #124 on A10.26; ledger row `2026-11-17-own-test-reads-pubkey-as-author`; ADR 0021 Amendment 2, item 4). An `e`-tag placeholder records no author, so it counts as the instance's own, and as having a letter, though it stands for another author's event. The owner's and the assistant's `NostrUser` nodes count as the instance's own, since their `pubkey` is the person each stands for. update-node never reaches either, since neither has a section to change. A delete would.
- **Some nodes are another operation's.** update-node refuses, naming the operation to use, a concept header or one of its core nodes, a JSON schema, a property, a set and a graph rule (`made-elsewhere`); firmware's own elements (`firmware-node`), which a firmware reinstall makes again; and a node no concept reaches but word (`not-an-element`). Loom gives deleting a concept with no elements, and deleting an empty set, to A10.17 (`graph delete-concept` and `graph delete-set`, not built); removing a property to A10.18; and taking a node out of one concept while keeping it to A10.22 (`graph remove-from-concept`).
- **Every node belongs to a concept** (D9). A node's concepts are those whose class thread reaches it, through the supersets and sets above it (BIBLE §10, rule 3). A node that other nodes are elements through, such as a set, takes their membership with it when it goes.
- **The graph is the instance's definitive self** (BIBLE §30). Its unpublished state is mortal: an element made with no event has nothing but the graph, and a backup, to come back from. Nothing yet marks which state was authored here, and until something does, state a rebuild can't reproduce is treated as precious.
- **The cache keeps a copy.** The derive step keeps a node's Tapestry JSON in the store, by its tapestryKey, which `GET /api/tapestry-key/:key` and the node's JSON page read. A json tag can itself be held there, as `lmdb:<tapestryKey>`, and then the store holds the node's only copy of its JSON. For update-node, the owner chose to leave the cache as it is and say when it is out of date (story 21, open question 4).

## User-facing description

As an admin agent rebuilding or fixing a concept graph, or the owner, I want to delete one of this instance's own elements, with its relationships and tags, without signing anything, so that a wrong or duplicate element can be taken out, and a step that failed partway can simply be run again.

As the owner, I want a node that came from someone else's event, a `NostrUser` node, a placeholder, and anything another operation looks after left alone, and to be told which operation to use, so that a delete never takes a peer's claim out of my graph or breaks a concept.

As the owner, I want each delete recorded with what the node held, so that a mistaken delete can be seen, and undone, without restoring a backup (open question 3).

## Acceptance criteria

- [ ] **AC1 — Delete an element, with its relationships and tags.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/delete-node` with `node`, the tapestryKey of one of this instance's own elements, then the node is gone from the graph, with every relationship it had, in and out, and its tags, with theirs. Nothing else is deleted: each node at the other end of one of its relationships stays, with its other relationships. An element of more than one concept leaves them all. The answer gives the node as it was (the read conventions' five facts, and whether it had a letter), `outcome: deleted`, each concept it was an element of, each relationship removed (its type, which way it ran, and the node at its other end), and the change entry. `graph history` finds that entry by the deleted node's tapestryKey, and by the tapestryKey of each node at the other end of a relationship removed. Nothing is signed or sent to a relay.
- [ ] **AC2 — Safe to repeat, and one at a time.** The same call again, once the node is gone, deletes nothing, records nothing, and answers `outcome: already-gone`, saying when, and by whom, it was deleted. A `node` that names no node, and whose deletion no entry records, is refused (`unknown-node`). Two calls at once that delete one node delete it once: one answers `deleted`, the other `already-gone`, and nothing is left half deleted.
- [ ] **AC3 — Never someone else's node (D4), a `NostrUser` node, or a placeholder.** A node that came from an event another author signed, anyone but the instance's assistant or its owner, or that records another author, is refused (`not-own-node`), naming its author and its address, and nothing changes. A node from the instance's own letter is deleted, as AC5 says. The owner's and the assistant's `NostrUser` nodes, and a placeholder the import made for an event the graph doesn't hold, are refused too, and nothing changes. The shared test of whose node it is answers both, so that every operation that calls it agrees (memo #124); the ADR says how, and which refusal names each.
- [ ] **AC4 — What else it refuses.** delete-node refuses each of these, changes nothing, records no entry, and says in words what was wrong, naming the input, and the operation to use where there is one:
  - a concept header or one of its core nodes, a JSON schema among them (`graph delete-concept`, A10.17);
  - a set, or a concept's superset (`graph delete-set`, A10.17; open question 1);
  - a property (`graph remove-property`, A10.18), and a graph rule (the rulebook);
  - one of firmware's own elements, which a firmware reinstall makes again: it changes in firmware's definition, through `lifecycle seed-firmware` (A10.37);
  - a node no concept's class thread reaches, such as a tag, a `NostrUser` node or a placeholder, which isn't an element: `raw delete-node` (A10.30, the owner's) removes any node;
  - a node other nodes are elements through, which would leave them of no concept (D9), naming how many and the first few.
- [ ] **AC5 — What stays behind: the letter and the cached copy.**
  - **The letter** (open question 2). A node whose letter the instance's assistant or its owner signed is deleted from the graph, as AC1 says. Its letter stays in the instance's relay and wherever else it was sent. The answer says so, names `export retract` (A10.34) as what takes a letter back, and warns that importing that letter again (fact 4) makes the node again, as a new node. For a node with no letter, it says it had none.
  - **The cached copy.** The derive step's cached copy of the node's JSON is left in the store, as update-node leaves one (story 21, open question 4). The answer says when the node had one, which readers of the cache, such as the node's JSON page and `GET /api/tapestry-key/:key`, may still show until `cache rebuild` (A10.36) drops it.
- [ ] **AC6 — History keeps what was deleted** (open question 3). The change entry records the node as it was: its properties, labels and tags, its JSON wherever it was held, the store included, and each relationship removed, with its properties. So `graph history` shows what each delete took out, and a mistaken delete can be undone from the entry alone, with the node's own tapestryKey and its relationships to the nodes still there, without restoring a backup. The operation that undoes a delete is a later story; this one keeps what it would need.
- [ ] **AC7 — It lasts, and it reaches agents.** After a firmware reinstall, and after a backup taken after the delete is restored on a fresh instance, a node deleted by this operation is still gone, and its change entry is still there (BIBLE §30). The operation is for the owner and admins: a caller who isn't signed in is refused with 401, and a signed-in person who is neither with 403. It is listed for agents and has its `/docs` entry, both made from its declaration. Someone with a shell inside the instance runs `tapestry graph delete-node` with no sign-in, gets the route's answers, and their entries name the command as who made them. On a scratch stack, an admin agent with its own key, through the external CLI (A10.6) and with no change to the CLI, makes an element with create-element, deletes it, deletes it again and is told it is already gone, finds the delete in `graph history`, and is refused a node from another author's event, a set, and one of firmware's own elements.

Seven criteria for one operation. If the change proves too big to review in one sitting, AC6's record of the whole node can become a story of its own, with AC1's entry recording only what it removed.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`); it differs on every instance, so it is never written into code.

- Any concept, through its class thread (read): the concepts the node is an element of, which the answer lists.
- `39998:<TA>:concept-header` and the seven core-node concepts (`superset`, `json-schema`, `primary-property`, `properties-set`, `property-tree-graph`, `concept-graph`, `core-nodes-graph`), `39998:<TA>:set`, `39998:<TA>:property` and `39998:<TA>:graph-rule` (read): their elements are another operation's, and are refused.
- `39998:<TA>:nostr-user` (read): it has no elements on this instance; a `NostrUser` node is refused whether or not it is one (AC3).
- Firmware's concepts (read): the nodes firmware's definition makes are refused.
- No firmware concept's definition changes. Whether AC4's "a node other nodes are elements through" becomes an entry of the rulebook, which would need a firmware reinstall to reach the graph rule concept, is for Architecture.

## Out of scope

- **Concepts and sets:** `graph delete-concept` and `graph delete-set` (A10.17), empty sets included (open question 1).
- **Properties and schemas:** `graph remove-property` and `graph set-schema` (A10.18).
- **Taking a node out of one concept and keeping it:** `graph remove-from-concept` (A10.22). Merging a duplicate into another node, its relationships moved over first: `graph merge-nodes` (A10.25).
- **Someone else's node:** hiding it, or muting its author, when the next import would bring it back (catalog §10, question 5), which is a point of view's choice; `graph copy-node` (A10.24) makes a copy of one's own.
- **Taking back a letter:** `export retract` (A10.34). A delete never signs, publishes or deletes an event (D1, D2).
- **Any node, unguarded:** `raw delete-node` (A10.30, owner only), and `rules repair` (A10.31) for nodes no concept reaches.
- **Undoing a delete:** AC6 keeps what an undo needs; the operation that does it is a later story.
- **The cache's rebuild** (A10.36), which drops the copies of nodes that are gone.
- **Consequences a concept gives its elements,** such as a relationship type that relationships still use, a value an enumeration lists, a graph's list of its members, or another node's JSON that names the deleted node: concept-dependent rules (design §7), for `rules check` (A10.31) to find.
- **Naming the node by its name or address:** `node` takes a tapestryKey, and an agent calls `graph resolve` (A10.9) first. Taking a ref is the declaration hook A10.9.a builds.
- **Bulk deletes** (catalog §10, question 6): one node per call.
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

Resolved at this gate. Each carried the drafting's proposal, for the owner to confirm or change; the owner approved all three (2026-11-17).

1. **Sets: here, or in delete-set (A10.17)?** The catalog's row says delete-node refuses "sets that still have elements", so it would delete an empty set; Loom gives deleting an empty set to A10.17, `graph delete-concept and delete-set`. *Resolved: A10.17's. delete-node refuses every set and every concept's superset, naming `graph delete-set` (A10.17), and the catalog's two rows are made to agree* (the drafting's proposal, approved by the owner, 2026-11-17). AC4. A set's delete has checks an element's doesn't: the sets below it, its links to its parents (unlink-set refuses a set's last parent), and the letters that still name it. One home for each kind of node keeps each check in one place, as update-node's `made-elsewhere` does. The other choice: delete-node deletes an empty set, with no set below it, and A10.17 keeps delete-concept alone. Either way, a node other nodes are elements through is refused (AC4).
2. **A node from the instance's own letter: delete it, or wait for `export retract`?** *Resolved: delete it from the graph, and say that its letter is still out there* (the drafting's proposal, approved by the owner, 2026-11-17). AC5. The graph is the instance's definitive self, and the letter only a letter (BIBLE §30). A graph write never touches a relay (D1, D2): a caller who wants the letter taken back too runs `export retract` (A10.34), as "create, then publish" combines a graph write with an export. Most of today's elements came from letters the assistant signed, through today's routes, so refusing them would leave delete-node unable to delete most existing elements until A10.34 is built. The cost: an import of that letter, when someone runs one (fact 4), makes the node again, as a new node with a new tapestryKey. The other choice: refuse a node that has a letter until `export retract` is built, naming it.
3. **What does history keep of a deleted node?** *Resolved: the node whole: its properties, labels, tags, its JSON wherever it was held, and every relationship removed, with its properties, so a mistaken delete can be undone from the entry alone* (the drafting's proposal, approved by the owner, 2026-11-17). AC6. An element made with no event has only the graph and a backup to come back from (BIBLE §30). An agent works fast, and restoring a backup takes back every change made since it, too. The cost: an entry is as large as the node it records, up to the 1,000,000 characters an element's JSON may hold, with its relationships. The other choice: record what identifies the node (its tapestryKey, name, address and author) and the relationships removed, as remove-relationship's entry records what it removed; a backup is then the only way back.

For Architecture, not this gate:

- **The shared test of whose node it is,** for an `e`-tag placeholder and for the owner's and the assistant's `NostrUser` nodes (memo #124): how it answers them, so that update-node, merge-nodes (A10.25), delete-node and copy-node (A10.24) agree, and which refusal names each (AC3).
- **How a repeat is told from a key that never named a node** (AC2), and what the answer says of it.
- **Which locks the delete takes,** so that two deletes of one node, and a delete beside an update of the node, a create-element in one of its concepts, or a relationship added to it, go one at a time.
- **How a node other nodes are elements through is found** (AC4), and whether that is an entry of the rulebook.
- **A placeholder only the deleted node's tags pointed at:** left in the graph, or removed with them.
- **A cap on what one call removes,** for a node with very many relationships, as the field mapping caps at 10,000 elements.
- **The answer's shape, the change entry's, and the refusals' codes and statuses.**

## Deviations

- **delete-node reads the node with U0 and calls `factsOf`,** not `whoseNode`. One read then gives both the facts and the properties its entry records (ADR Decision 4's `factsOf`).
- **`_nodes.js` exports `labelOf`,** so delete-node names a node in its messages as `requireOwn` does.
- **`relationships` lists the tags' relationships before the node's own.** The tags are read first, so a relationship between the node and one of its tags is read under the tag (Decision 9).
- **already-gone's `letterRemains` and `cacheRemains`** are worked out from the node its entry recorded: its id, and the derive step's stamp. Decision 11 gives the two for a delete only.
- **already-gone's note names the entry's id,** beside when, by whom and through which operation.
- **`NOT_OWN_NODE`'s `when` gains a sentence:** a person node or a placeholder is refused by the two new codes instead.
- **The person-node and placeholder-node messages** are worded in `_nodes.js` for any write that tests whose node it is, so they name no operation but `raw delete-node`.
- **A tag with no tapestryKey stops the delete** with an error naming `lifecycle migrate`, as update-node stops on one.
- **`holds-elements` says "more than 10,000 other nodes"** when D2 reaches its limit.
- **A fourth hollow letter** (a kick-back to test design). `test/helpers/fieldGraph.js`'s letters got a `created_at`, as Amendment 1 item 5 gave three others: the test plan's "Added at implementation", commit `80189eb3`.

## Evidence

### The suites (Implementation, 2026-11-17)

Run on this Mac, each with every service endpoint dead. No full `npm test` ran here: the local stack is the owner's agent-memory instance, and the PR's CI runs the full gate.
- **The new and changed suites,** each alone:
  - `test/operations/graph/delete-node.test.js`: 35 passed, 0 failed;
  - `delete-node-agent-through-cli.test.js`: 1 passed, 0 failed;
  - `update-node-shared.test.js`: 13 passed, 0 failed.
- **The whole operations runner,** `test/operations.test.js`, which is stack-free and runs every suite under `test/operations/`: 806 passed, 0 failed, 4 skipped.
  - The 4 skipped are `lifecycle/shared-keys.test.js`'s live tests, which run only against a named scratch container.
  - Its first pass, with the code in, failed update-node's UN40 alone: a fourth hollow letter, fixed as a kick-back to test design (Deviations; the test plan's "Added at implementation").
- **The route-surface suites,** with every endpoint on a dead port: `openapi-coverage` 13 passed, `admin-action-sweep` 9, `admin-action-sweep-access` 13, `admin-action-sweep-named` 6; none failed.
- **harness-lint:** clean.

### The live check (Implementation, 2026-11-17, on `608bf8ae`)

It ran on a throwaway instance from `scripts/scratch-stack.sh`, never a shared or private one. Every call went through `test/helpers/scratchLoopback.js`, which refuses any container not named `tapestry-scratch…`. The script and every call's request and answer are in this worktree's `tmp/live-check-26/` (ignored by git): `live.js`, `report-main.json` and `report-restored.json`.
- **The instance.**
  - It booted from image `agent-memory-tapestry:latest` with this branch's `src/` mounted.
  - The image's firmware differed from the branch's (digests `e6118e628f71` and `fe62d06d0f54`). The branch's was copied in, the control panel restarted, and the firmware installed again; the digests then matched.
  - The branch's `bin/tapestry.js` and `clients/cli` were copied in.
- **Keys.** The instance had its own assistant key. Three throwaway keys were made: the owner's, an admin's for the agent, and a stranger's. The owner and the admin were set in `/etc/brainstorm.conf`.
- **The calls** went through `docker exec` to `127.0.0.1:7778`, as the trusted local operator. The agent's and the visitor's went through the instance's nginx.
- **Afterwards** it was removed, after a second, fresh boot for the restore. Each `down` checked first that the container mounted this worktree's `src/`.

**By check, 31 of 33 passed. The two that failed tested my own script's premises, not delete-node:**
- **L1:** Snoopy, made by create-element in `live beagle`:
  - deleted with its tags, `letterRemains: false`, its `HAS_ELEMENT` from the superset among the relationships removed, and gone in Neo4j with its tags;
  - its entry, by `local`, records the node whole;
  - the same delete again was `already-gone`, naming the first entry;
  - history by Snoopy gave the delete, then the create; history by the superset found the delete.
- **L2:** Live Rex, the assistant's letter, made by today's signing `POST /api/normalize/create-element` in firmware's dog, was deleted.
  - `hasLetter` and `letterRemains` were true, and the note named `export retract` and a re-import's new node.
  - The relay held as many events after the delete as before it.
  - *L2d failed on its premise:* it looked for an `AUTHORS` from the assistant's person node among Live Rex's relationships. The signing route imports with normalize's own direct import, which makes no `NostrUser` link; only the nostr import does (`eventSync.js:234–236`). Live Rex had one relationship, its `HAS_ELEMENT`, and that is what was removed and recorded. The person node exists, and stays.
- **L3, the refusals:**
  - a stranger's lettered node, made with Cypher: `not-own-node`, naming the stranger, and kept;
  - a set: `made-elsewhere`, naming `graph delete-set`;
  - a superset: `made-elsewhere`, naming `graph delete-concept`;
  - firmware's rover: `firmware-node`, naming its file;
  - the assistant's person node: `person-node`;
  - an `e` tag's placeholder, made with the import's own statement: `placeholder-node`;
  - a node with a `HAS_ELEMENT` to another: `holds-elements`, naming it;
  - a tag: `not-an-element`.
- **L4, at once:**
  - **Two deletes of one node,** three times: each pair answered one `deleted` and one `already-gone`.
  - **A delete beside an update-node of the node,** three times: the delete went each time. The update answered `updated` twice, having gone first, and `unknown-node` once. Never a 500.
  - *L4c failed on its premise:* it expected Neo4j's `EntityNotFound`, and Neo4j gave no error at all. A lock statement that waited for a node another transaction deleted answered `count(n) = 1`. So the races resolve on the lock and the read after it, and the write path's second try never ran. ADR Amendment 2 records this.
- **L5:** a node the derive step cached (`POST /api/tapestry-key/derive/:key`) was deleted with `cacheRemains: true`, the note naming `cache rebuild`. `GET /api/tapestry-key/:key` still answered its cached copy.
- **L6:** after a firmware reinstall, the three deleted nodes were still gone and their entries still there.
- **L7:** backup `20261117T140615Z-30dee424` (4.6 MB: 3,442 nodes, 3,911 relationships) was uploaded to a fresh instance and restored. The transaction and counts matched exactly. The deleted nodes were still gone, their entries there, and the other nodes back.
- **L8, an admin agent through nginx and the external CLI:**
  - it made Agent Pup, deleted it (recorded as the agent's), and deleted it again (`already-gone`, naming the agent);
  - its history gave the delete, then the create;
  - it was refused the stranger's node (`not-own-node`), the set (`made-elsewhere`) and firmware's rover (`firmware-node`);
  - a visitor through nginx got 401.
- **L9,** the read-only counts on staging and production, waits for the owner's yes for each server.

## Linked artifacts
- ADR: `engineering-team/decisions/graph-operations-first-slice/0026-delete-node.md`
- Test plan: `engineering-team/stories/graph-operations-first-slice/26-delete-node.test-plan.md`
- Review: `engineering-team/reviews/graph-operations-first-slice/26-delete-node.md`
