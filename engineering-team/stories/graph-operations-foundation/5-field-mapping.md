# Story 5: Field mapping — mark a concept's field so its elements carry it on their Neo4j nodes, with `graph mark-field`, `unmark-field` and `map-fields`

**Status:** Approved
**Created:** 2026-11-14
**Type:** Feature
**Loom:** A10.5 — https://loom.brainstorm.world/t/A10.5

## Background

The book's frame asks of the foundation: "A concept can mark the fields its elements carry as Neo4j properties." Loom's A10.5 is done "when a concept can mark a field, an element's value for it is stored on its Neo4j node whenever the element is written, and a read can filter on it." The design leaves open how a concept marks its fields (§5, question 1) and asks that the answer come before the first write that needs it (§8).

At the planning gate (2026-11-14) the owner settled where a mark lives and how the story proves it:

- **A mark is an edge into a concept of its own.** A new firmware concept holds the Neo4j properties that nodes carry. Marking Dog's `breed` makes the `breed` property node, from Dog's property tree, one of its elements. On why it's a concept rather than a set, the owner said: "It can then gain admission as a concept in the firmware, and users can always read the concept's description to get a quick understanding of how it works. Burying it in a Set node might mean people won't appreciate its significance."
- **Two kinds of Neo4j property.** The owner first put the concept's superset under the property concept's. He revised that the same day, because some properties a node carries are fields of no concept. His example is a `search_strings` property on each of Dog's elements, kept for Cypher queries: "purely metadata", not "on par with name, breed, owner". So the concept doesn't sit under property. Instead it has two sets: "Neo4j properties that are *also* vanilla properties (show up as Neo4j properties *and* in tapestryJson), and those that are not". This story fills the first set. The second ships empty, for a later story (see the table below).
- **Not in the schema.** Loom's A10.5 and the design's drafting had the concept's schema carry the mark, as a flag in its `x-tapestry` extension. The owner chose the edge over the flag for three reasons:
  - **Only an edge survives full reduction.** Under the owner's core rules (design §7), a node needs only its tapestryKey and tapestryValue, and a relationship only its type. Everything else is optional data, and a graph with none of it is fully reduced. The copies on the elements are optional data wherever the mark lives, so reduction always drops them. A mark kept as an edge stays, and the copies can be made again from it. If a concept's schema is ever to show its marks, the Tapestry Graph Conjecture (§9) needs them in the reduced graph too.
  - **Carrying `breed` on nodes is a choice about this database, not a fact about dogs.** In the schema, the mark would be published wherever Dog is, and adopting someone else's Dog would bring in their choices.
  - **Everything the instance carries on nodes is listed in one place,** the concept's elements, so these rules are easy to peruse and added frugally, as §7 asks.
- **What writes the copies.** Marking a field copies its value onto the concept's current elements, and unmarking removes it. A third operation, `map-fields`, catches up elements written since then by tools that don't apply the mapping: today's routes and the nostr import (D15).
- **The read** is plain Cypher on the property.
- **Firmware changes are expected.** The owner anticipates many as the operations are built (2026-11-14), so a new firmware concept is no obstacle.

The two sets make up the left column of this table:

| | On the Neo4j node | Not on the node |
|---|---|---|
| **A field of the concept** (in its schema and tapestryJson) | a marked field, such as `breed` | an unmarked field, such as a long `description` |
| **Not a field of the concept** | a Neo4j-only property, such as `search_strings` or an event's `kind` | — |

Seven facts about today's instance shape the story:

- **Today's tools sign.** save-schema hands the new schema to `regenerateJson` in `src/api/normalize/index.js`. That function signs a new version of the schema's event with the TA key, publishes it to the instance's relay and rebuilds the node from it. The routes that make property nodes sign too. The operations in this story sign nothing (D1).
- **A field has a property node only once today's routes have made one.** create-property makes one, and generate-property-tree makes a whole schema's; both sign. A concept whose tree was never made has none.
- **Property nodes are per concept, and keep their identity.** generate-property-tree gives each property node an address made from its name and its parent's (`deterministicDTag`). A re-run lands on the same node, and a re-import replaces only the node's tags (`importEventDirect`), leaving its edges alone. When a field leaves the schema, the next run unhooks its property node and deletes every `HAS_ELEMENT` edge into it.
- **Firmware concepts can ship with sets.** relationship-type ships with three: class threads, core nodes and nostr. Its manifest puts elements into them. Property requires its label (`x-tapestry.neo4j.nodeLabelRequired`), so every property node is a `:Property`.
- **Nodes already carry properties that no concept declares.** The nostr import sets `id`, `pubkey`, `kind`, `created_at` and the node's address from the event (`buildImportCypher` in `src/api/neo4j/eventSync.js`). None of them is a field of the element's concept. Design §7 expects a rule for them: "always include: id, kind, created_at, and uuid". The import also sets `name` from the event's tags, and today's create-element sets `slug` from the JSON (`handleCreateElement`). Those two are fields, carried by hand.
- **Neo4j properties hold only plain values and lists of them** (design §5, question 1). Avi's brain needed only strings and lists of strings (Loom A10.5; his comment on nousclawds4/tapestry#32).
- **add-relationship can't make a mark.** `HAS_ELEMENT` is reserved for the operations that build class threads (story 4, AC2), so a mark is made only through this story's operation and its guard.

## User-facing description

As the owner, I want to mark a field of a concept, such as Dog's `breed`, so that each of the concept's elements carries the field's value on its Neo4j node and I can find them with Cypher. Marking shouldn't sign anything or change what the concept says.

As the owner, I want every marked field listed in one concept, whose description explains what a mark costs, and I want to be able to unmark a field. That way, what my graph carries stays a choice I can see and undo.

As the owner, I want the concept to keep fields carried on the node apart from metadata that only Neo4j holds. Then I can later add metadata, such as search strings, without making it a field of the concept.

As an admin agent, I want to bring the copies up to date after elements were written by today's tools or imported, so that a read on a marked field stays right.

## Acceptance criteria

- [ ] **AC1 — The concept, in firmware.** After a firmware install, the graph has a concept for the properties nodes carry, working name *neo4j property* (Open questions, for Architecture). It has a header, a superset and a schema, made like every firmware concept. Its superset is not a subset of the property concept's, since a Neo4j property need not be a field. It ships with two sets, both empty, each with a description:
  - *Neo4j properties that are also fields* (working name). Its elements are property nodes from concepts' property trees, so each value is in the element's JSON as well as on its node. This story's marks go here.
  - *Neo4j-only properties* (working name). These are properties a node carries that are no field of its concept, such as search strings or an event's `kind`. A later story fills this set.

  The concept's description says, in words a newcomer can follow:
  - an element of this concept is a property that nodes carry, so Cypher can filter on it;
  - those values are optional data that cost space on every node, so a property goes in only when a read needs it (design §7);
  - a fully reduced graph keeps the membership, which is an edge, and drops the values on the nodes;
  - the values can be made again: a field's from the element's JSON, a Neo4j-only property's from the source it names.
- [ ] **AC2 — Mark a field: `graph mark-field`.** Given:
  - the owner or an admin is signed in;
  - a concept, named by its header's tapestryKey;
  - one of the concept's top-level fields that has a property node and holds a string, number, integer or boolean, or a list of one of those.

  When they call `POST /api/tapestry/graph/mark-field` with `concept` and `field`, then:
  - the field's property node is an element of the concept from AC1, by one `HAS_ELEMENT` edge from its set of Neo4j properties that are also fields;
  - each current element of the field's concept, including its subsets' elements, whose JSON gives the field a value carries that value on its node, under a property name the answer states;
  - an element whose JSON gives the field no value carries no such property;
  - the answer gives the mark, the property name, how many nodes now carry it, and the change entry;
  - nothing is signed.

  Called again with the same two, it changes nothing, records no entry, and answers that the field was already marked.
- [ ] **AC3 — Refused before anything changes.** mark-field refuses each of these, changes nothing, records no entry, and says in words what was wrong:
  - a `concept` that names no concept;
  - a `field` that isn't one of the concept's top-level fields;
  - a field with no property node yet, saying to make the concept's property tree first;
  - a field that holds an object, a list of objects or a list of lists (design §5, question 1, which stays open for those);
  - a property name that other code already sets on nodes, such as `tapestryKey`, `tapestryValue`, `uuid`, `name` or `slug` (the full list is Architecture's).

  The rule behind these is defined once. It runs as mark-field's guard, and it can run as a check over the graph's marks (D3). It is written into the rules document ([docs/GRAPH_RULES.md](../../../docs/GRAPH_RULES.md)).
- [ ] **AC4 — Unmark a field: `graph unmark-field`.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/unmark-field` with the `concept` and `field` of a marked field, then:
  - the edge from AC2 is gone, and no element of the concept carries the property any more;
  - the answer says how many nodes it cleared, and gives its change entry;
  - the property node stays an element of the property concept (D9);
  - nothing is signed.

  Called again, it changes nothing, records nothing, and answers that the field was already unmarked. A `concept` or `field` that names nothing is refused as in AC3.
- [ ] **AC5 — Catch up: `graph map-fields`.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/map-fields` with a `concept`, then each current element of it carries exactly what its marked fields say:
  - a missing copy is added;
  - a stale copy is corrected;
  - a copy whose field the element's JSON no longer gives a value is removed.

  It changes only what differs, records one entry saying which nodes changed, and records nothing when nothing did. Nothing is signed. This is how an element written by today's routes, or brought in by the nostr import, comes into line: neither applies the mapping (D15).
- [ ] **AC6 — A read filters on it.** Given Dog's `breed` is marked, one dog whose JSON gives `Beagle` and another whose JSON gives `Labrador`, when a plain Cypher read through `/api/neo4j/query` asks for Dog's elements whose property is `Beagle`, then it gets the first dog and not the second. If the first dog's breed changes through today's routes and map-fields runs, the read follows the change. Once `breed` is unmarked, the read finds neither dog.
- [ ] **AC7 — Marks survive what the instance does to itself.** Every mark and every copy is unchanged after any of these:
  - a firmware reinstall;
  - a re-run of generate-property-tree for the concept;
  - a backup restored through lifecycle (story 2).

  BIBLE §30: graph state made on this instance can't be rebuilt from the relay, and nothing may destroy it.
- [ ] **AC8 — Callers, the command, an agent, and the docs.**
  - **Callers.** The three operations are for the owner and admins. A caller who isn't signed in is refused with 401, and a signed-in person who is neither with 403.
  - **JSON only, nothing signed.** Each operation takes only a JSON body (415 otherwise), signs nothing and sends nothing to a relay. The instance's relay holds no new event afterwards.
  - **Listing and docs.** Each operation is listed for agents and has its `/docs` entry, made from its declaration.
  - **The internal command.** Someone with a shell inside the instance runs `tapestry graph mark-field --concept <key> --field <name>`, and likewise the other two, and gets the route's answers.
  - **An agent.** An admin agent with its own key marks a field, maps it and unmarks it through the external CLI (A10.6), with no change to the CLI.
  - **The docs.** The catalog lists the three operations, and the design records the owner's answer to the first half of §5, question 1.

Eight criteria. They stay one story because a mark is only useful with its copies, and the copies matter only with a read. If the change proves too big to review in one sitting, map-fields (AC5) can become a story of its own.

**How this meets "whenever the element is written."** No new operation writes an element yet; create-element is A10.20.
- Marking (AC2) and map-fields (AC5) apply the mapping to the elements that exist.
- The mapping is one function. Every element write the new operations add later, such as create-element, update-node and add-to-concept, calls it inside its own write.
- Today's routes and the nostr import don't apply it, and stay as they are (D15). map-fields brings their elements into line, and hooking them in is a follow-up.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`). It differs on every instance, so it is never written into code.

- **The new concept,** `39998:<TA>:<slug>`, with its two sets: made by firmware (AC1). Architecture picks its slug.
- `39998:<TA>:property`, property (read only): its elements, the property nodes, are what the new concept's first set holds. Nothing in this story changes it.
- `39998:<TA>:relationship-type`, relationship type (not touched): the precedent for a firmware concept that ships with sets.
- `39998:<TA>:dog`, dog (read only): the example in AC6. Its schema and elements stay as they are; the live check makes its own dogs on a throwaway instance.

## Out of scope

- **Nested objects, lists of objects and lists of lists** (the second half of the design's §5, question 1). AC3 refuses them; they're settled with the first concept that needs them.
- **Fields below the top level,** such as a name inside an `owner` object.
- **Neo4j-only properties in use.** The second set's first element, where its value comes from, and what writes it, including declaring today's event fields there (design §7's NostrEvent rule). The set ships empty (AC1).
- **Moving a property between the two sets.** A move changes the concept's schema, so it belongs to a later operation that changes the set membership and the property tree together.
- **Applying the mapping inside today's routes and the nostr import,** the alternative the owner passed over at this gate. map-fields catches up their elements (AC5). This is a follow-up.
- **The new element writes themselves.** create-element (A10.20), update-node and add-to-concept call the mapping when they're built.
- **A filter on `list-elements`** (A10.11), and **a rule that reads a marked property,** such as relationship-type's. The read here is plain Cypher (AC6).
- **Indexes and constraints.** In the owner's framing they become sibling concepts later. Until then, today's `x-tapestry.unique` and the concept header's `nodeLabelRequired` stay where they are (D15). Neo4j indexes on marked properties, and search, belong to A10.8.
- **Showing a mark in the concept's schema JSON,** once schemas are computed from property nodes (D10).
- **Making a property node without signing** (`graph add-property` in the catalog). Until that lands, a field's property node is made through today's routes (D15).
- **A UI for marking,** and **publishing a mark** as a nostr event.
- **Merging to staging and shipping to production,** which wait for the owner's OK (the book's frame).

## Open questions

To resolve at this gate.

1. **Where does a mark live?** *Resolved: in a firmware concept of its own. A mark is an edge that makes the field's property node one of that concept's elements* (the owner's answer, 2026-11-14). AC1, AC2.
2. **A concept of its own, or a set under property?** *Resolved: its own concept* (the owner's answer, 2026-11-14). The owner first put its superset under the property concept's. *He revised that the same day: it sits outside property, with two sets, one for Neo4j properties that are also fields and one for Neo4j-only properties* (the owner's answer, 2026-11-14). The revision lets a node carry metadata, such as search strings, that isn't a field of its concept. AC1.
3. **What puts a marked field's value on the nodes?** *Resolved: marking copies it onto the concept's current elements, unmarking removes it, and map-fields catches up the elements written since* (the owner's answer, 2026-11-14). AC2, AC4, AC5.
4. **How does the story show a read?** *Resolved: a plain Cypher read on the property* (the owner's answer, 2026-11-14). AC6.

For Architecture, not this gate:

- **The names and slugs** of the concept (working name *neo4j property*) and of its two sets, and whether the concept's schema gives its elements fields of their own.
- **What a Neo4j-only property's node will look like,** sketched only, so that the second set's description is right. Most likely it has a property node's shape (a name, a type, a description) plus a named source, so that a later move into the first set links the same node into a property tree.
- **The firmware change:** whether v1.0.0 is changed in place or becomes a new version, and the reinstall that follows (AGENTS.md §6).
- **The operations' inputs:** the concept by its header's key and the field by name, or the field's property node by its key.
- **The property name on the node, and collisions.**
  - The reserved names.
  - How two concepts on one node are kept from writing one property: names that carry the concept, or a refusal.
  - A node that joins a second concept after both concepts' fields were marked.
- **Where a value is read from,** inside the write's transaction: the json tag, an LMDB reference or the cached Tapestry JSON, and which section of it.
- **A mark on a concept with many elements:** the entry's shape, and whether the copying runs in one transaction or in batches.
- **A marked field that leaves the schema.** generate-property-tree's unhook deletes the mark along with the node's other `HAS_ELEMENT` edges. That leaves copies map-fields can no longer see. Three options: keep this behaviour, change the unhook, or have the check report the copies.
- **Whose marks count.** An imported event could make a property node an element of the new concept. Whether such a mark counts for this instance is a point-of-view question (D4; CLAUDE.md principles 1 and 2).
- **The check.** Whether a check that the copies match the JSON ships now, ready for `rules check` (A10.31), or ships with it.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Foundation bullet)
- Epic: [engineering-team/epics/graph-operations-foundation.md](../../epics/graph-operations-foundation.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D1, D3, D9, D10, D15; §5 question 1; §7; §8; §9). The catalog's `add-property`: [docs/GRAPH_OPERATIONS_CATALOG.md](../../../docs/GRAPH_OPERATIONS_CATALOG.md)
- Story 2, whose backup and restore AC7 uses: [2-lifecycle-backup-and-restore.md](2-lifecycle-backup-and-restore.md)
- Story 3, whose keys name the concept: [3-a-tapestry-key-on-every-node.md](3-a-tapestry-key-on-every-node.md)
- Story 4, the write path these operations run on: [4-the-write-path.md](4-the-write-path.md)
- Story 6, the external CLI the agent uses: [6-external-cli-and-agent-skill.md](6-external-cli-and-agent-skill.md)
- ADR: to come, `engineering-team/decisions/graph-operations-foundation/0005-field-mapping.md`
- Test plan: to come, `5-field-mapping.test-plan.md`
