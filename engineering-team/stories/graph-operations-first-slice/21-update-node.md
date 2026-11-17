# Story 21: `graph update-node` — change an element's name, description or fields, with no event, its changed sections checked against their concepts' schemas, and never a node from someone else's event

**Status:** Approved
**Created:** 2026-11-16
**Type:** Feature
**Loom:** A10.21 — https://loom.brainstorm.world/t/A10.21

## Background

Loom's A10.21 asks for one graph write (catalog §2, Nodes):

- **`graph update-node`:** "Change a node's name, description or fields", taking `node` and fields, merged, and answering "the node". It "refuses a result that doesn't validate, and a node that came from someone else's event (D4)".

Done, for Loom, is when "it is declared once; answers at `/api/tapestry/graph/update-node` for the owner and admins; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI." It is the next element write after create-element (A10.20). It checks an element against its concept's schema with the check create-element brought in, and it is the first write to refuse a node because of whose it is: merge-nodes (A10.25) and delete-node (A10.26) refuse the same nodes, and copy-node (A10.24) is how someone makes such a node their own (D8).

Thirteen facts about today's instance shape the story:

- **Today's routes change a node's JSON by signing, and check nothing.** `POST /api/normalize/save-element-json` takes a node's address and a whole new JSON; `POST /api/normalize/set-json-tag` takes an address and a JSON, or a flag that takes the json tag out (`src/api/normalize/index.js`). Each rebuilds the node's tags from the graph with the json tag replaced, signs them as a new event with the assistant's key, stores it in the instance's relay, and imports it onto the node. Neither merges anything, checks the JSON against a schema, or asks whose node it is, and neither renames. Given a node from a peer's event, the import writes the assistant's event onto it: its `pubkey` becomes the assistant's and its `id` the new event's, at the peer's address. Both are owner-only.
- **Where an element's name and slug live.** create-element writes the name as the node's `name` and its tapestryValue (D11), its `name` tag, its section's `name`, and its word block's `name` and `title` ("dog: Rover", "Dog: Rover"). It writes the slug as its section's `slug` and in its word block's `slug` (`dog--rover`). The d-tag, from which the node's address comes, is the name's slug and a hash of the concept header's address. The address and the tapestryKey are what a letter published later lands on (D6, ADR graph-operations-first-slice/0016 Decision 1).
- **create-element's repeat.** It answers `already-exists`, untouched, for this instance's own element of the concept, anywhere in its class thread, that has the name, without regard to case, or that sits at the address the name gives. Another author's element is never the repeat (ADR graph-operations-first-slice/0020 Decision 6, approved by the owner).
- **How update-concept changes a concept** (ADR graph-operations-first-slice/0016). Only this instance's own concepts change: the header's author must be the assistant, so firmware's (which a reinstall rebuilds) and another author's are refused. A rename changes the names, and the titles made from them, wherever each still holds what the old names made; the slugs, key, labels, address and tapestryKeys never change. `letterOutOfDate` says when a node with a letter now differs from it. A call that changes nothing answers `unchanged`.
- **D4 and D8.** Guards apply to the owner's and admins' own writes, not to imports, and "repair never edits a peer's node; it can add the owner's own nodes or edges alongside." Publishing someone else's node gives the owner a node of their own (D8), which is copy-node's job (A10.24, not built).
- **Two writes guard a corner of D4 already.** update-concept refuses a concept whose header's author isn't the assistant, and unlink-set refuses a link a peer's event claims (`peer-link`, ADR graph-operations-first-slice/0028). Nothing decides, for any node, whether it came from someone else's event.
- **Whose nodes count as the instance's own.** The read conventions (ADR graph-operations-first-slice/0011) answer `own` for a node whose author is the instance's assistant or its owner, or that was made here with no author. An admin counts by score, like anyone. update-concept counts the assistant alone. The old A9 tools sign with an agent's own admin key (D14).
- **An element can belong to several concepts.** Its JSON is word-wrapper JSON, with a section for each concept under that concept's key, and a node is an element of every concept whose class thread reaches it (BIBLE §10, rule 3). So one node can belong to more than one concept and have a section for only some of them. Adding a concept's section is add-to-concept's job (A10.22), as story 20 set out.
- **Rule 4 has one check.** `element-fits-schema` (the rulebook's entry 7), through `_schemas.js`, is the check every element write calls. ADR 0020 Decision 16 says update-node passes it the JSON with the given fields merged in, for each concept whose section it changes. It judges the stored JSON, the json tag. The derive step judges its own cached copy, so the two verdicts split under some schemas, among them JSON with no word block, which the elements today's create-element route made have (ledger row `2026-11-16-derive-step-and-rule-check-split`; A10.20.a, which decides which document a schema describes, is still open).
- **The cache keeps a node's old JSON.** The derive step builds a node's cached Tapestry JSON from its existing cached copy before its json tag (OPEN.md row 139), and nothing clears a copy when a json tag changes. update-concept leaves the cache as it was, and `cache rebuild` (A10.36, not built) is to rebuild from the graph (ADR 0016, Consequences). The UI's JSON page for a node shows the cached copy, and its derive button rebuilds from that copy too. A json tag can itself be held in that store, as `lmdb:<tapestryKey>`.
- **Marked fields are carried on the node.** A concept can mark fields its elements carry as node properties, `<concept key>_<field>` (A10.5). Every element write brings the nodes it wrote in line with those marks, inside its own write, and its change entry records the copies (ADR graph-operations-foundation/0005 Amendment 2.7).
- **Some nodes are another operation's to change.** create-element refuses the concepts whose elements another operation makes (`made-elsewhere`): the concept-header concept and the seven core-node concepts (graph create-concept), set (graph create-set), property (graph add-property) and graph rule (the rulebook). Their changes have homes of their own: update-concept for a concept's names, which its core nodes' names follow, and the property operations (A10.18) for its properties and schema. No operation yet changes a set's name or description, and the draft of story 27 (create-set, A10.27, being planned now) names update-node for it.
- **Command lines make no objects.** `fields` takes an object or its JSON text (ADR 0020 Decision 1), so both CLIs reach it with no change.

## User-facing description

As an admin agent fixing a concept graph, or the owner, I want to rename one of this instance's own elements, or change its description or its fields, without signing anything, so that a mistake can be corrected privately, and a step that failed partway can simply be run again.

As the same agent, I want a change that would leave the element not fitting its concept's schema refused, with every problem named, so that the operations never leave an element its concept's readers can't read.

As the owner, I want a node that came from someone else's event left as its author wrote it, and told how to make a copy of my own, so that a peer's claim is never rewritten in my graph.

## Acceptance criteria

- [ ] **AC1 — Change an element's fields.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/update-node` with `node` (the tapestryKey of one of this instance's own elements) and `fields` (an object, or its JSON text), then the fields are merged into the node's section for its concept: each field given takes the value given, a field given as `null` is taken out, and every other field stays as it was. A value that is an object is replaced whole, not merged. When the node is an element of more than one concept, `concept` names the one whose section changes. `description` is the section's `description` field, given on its own. Nothing else about the node changes: its other tags, its address, tapestryKey, labels and memberships stay. The answer gives the node as it now is (its tapestryKey, address, name and slug), `outcome: updated`, `changed` (each field changed, as `fields.<field>`), `concepts` (each concept the node belongs to, and whether its JSON fits that concept's schema), and the change entry, which `graph history` finds by the node and by the concept. A call that gives only what the node already holds changes nothing, records nothing, and answers `outcome: unchanged`. Nothing is signed or sent to a relay.
- [ ] **AC2 — Rename an element.** Given `name`, the node's name changes everywhere it holds it: its name and tapestryValue, its `name` tag, the `name` of each section that held the old name, and its word block's `name` and `title` where they held what the old name made. Its slug follows wherever it held the slug the old name gave: each such section's `slug`, and the word block's `slug` (open question 2). Its address, d-tag and tapestryKey don't change, so a letter published later still lands on it, and create-element with the old name still answers this element, which sits at the address the old name gives. The name is cleaned and checked as create-element checks one. Every section the rename changes is checked as AC3 says.
- [ ] **AC3 — The result is checked against each concept's schema it changes (rule 4).** Before anything is written, the node's JSON, as the call would leave it, is checked against the JSON Schema of each concept whose section the call changes, with the check create-element uses (`element-fits-schema`). JSON that doesn't fit is refused (`invalid-fields`), listing every problem, each naming the field and what is wrong; a concept whose schema is missing or can't be read is refused (`no-schema`). Either way nothing changes and no entry is recorded. For each other concept the node belongs to, `concepts` says whether its JSON fits that concept's schema, and those never stop the change.
- [ ] **AC4 — A rename onto a name in use is refused** (open question 2). When, in any concept the node belongs to, another of this instance's own elements has the new name, without regard to case, or sits at the address the new name gives (the element create-element would answer as the repeat), the rename is refused (`name-in-use`), naming that element; nothing changes. Another author's element with the name doesn't stop it. Two calls at once that would rename two elements of one concept to one name change at most one of them.
- [ ] **AC5 — Never a node from someone else's event (D4).** A node that came from an event another author signed, anyone but the instance's assistant or its owner (open question 3), is refused (`not-own-node`), naming its author and address, and saying that `graph copy-node` (A10.24) makes a copy of one's own; nothing changes. A node from the instance's own letter changes, and `letterOutOfDate` says that its letter now differs from it, until `export nostr` (A10.34) sends a new one. Whether a node is someone else's is decided in one place, which merge-nodes (A10.25) and delete-node (A10.26) will use too; the ADR says how.
- [ ] **AC6 — What else it refuses.** update-node refuses each of these, changes nothing, records no entry, and says in words what was wrong, naming the input:
  - a `node` that names no node, and a node no concept's class thread reaches, which has no concept to check it against (D9);
  - a node another operation changes: a concept header or one of its core nodes (graph update-concept), a property or a schema (the property operations, A10.18), a graph rule (the rulebook) and a set (open question 1), naming the operation to use;
  - a node firmware's definition makes, which a firmware reinstall rebuilds;
  - a call that gives no `name`, `description` or `fields`;
  - a name as create-element refuses one;
  - `fields` that aren't an object or its JSON text, that give a `name` or `slug` other than the node's name and the slug it gives, or take either out; and a `description` given both on its own and in `fields`, with different values;
  - `fields` or `description` with no `concept` when the node belongs to more than one concept, naming them; a `concept` the node doesn't belong to; and a concept whose section the node's JSON doesn't have (graph add-to-concept, A10.22, adds one);
  - a concept keyed `word` or `graphContext`, the keys an element's JSON keeps for itself (ADR 0020 Amendment 1);
  - a node whose JSON can't be read, and JSON that would be longer than 1,000,000 characters;
  - JSON that doesn't fit, and a concept with no schema (AC3); a name in use (AC4); someone else's node (AC5).
- [ ] **AC7 — Marked fields follow.** When a change touches a field one of the node's concepts marks (A10.5), the node property `<concept key>_<field>` follows in the same write: set, changed, or taken out with the field. The answer lists the node properties the node now carries for its concepts' marks, and those it couldn't carry, and the change entry records the copies as the field mapping's writes record them.
- [ ] **AC8 — It lasts, and it reaches agents.** After a firmware reinstall, and after a backup restored on a fresh instance, a node changed by this operation keeps its new name, fields, tags and node properties, and the same concepts and sets (BIBLE §30). The operation is for the owner and admins: a caller who isn't signed in is refused with 401, and a signed-in person who is neither with 403. It is listed for agents and has its `/docs` entry, both made from its declaration. Someone with a shell inside the instance runs `tapestry graph update-node` with no sign-in, passing `fields` as JSON text, and gets the route's answers, and their entries name the command as who made them. On a scratch stack, an admin agent with its own key, through the external CLI (A10.6) and with no change to the CLI, changes a field of an element create-element made, renames it, runs the same call again and is told nothing changed, and is refused fields that don't fit, a rename onto a name in use, and a node from another author's event.

Eight criteria for one operation. AC5's test is the shared piece the later writes reuse; it stays here because update-node can't refuse without it. If the change proves too big to review in one sitting, the rename (AC2 and AC4) can become a story of its own.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`); it differs on every instance, so it is never written into code.

- Any concept, through its header and JSON schema (read): the concepts the node belongs to, whose schemas the sections the call changes are checked against.
- `39998:<TA>:concept-header` and the seven core-node concepts (`superset`, `json-schema`, `primary-property`, `properties-set`, `property-tree-graph`, `concept-graph`, `core-nodes-graph`), `39998:<TA>:set`, `39998:<TA>:property` and `39998:<TA>:graph-rule` (read): their elements are another operation's to change, and are refused.
- `39998:<TA>:neo4j-property` (read): its first set holds the marks AC7 carries.
- Firmware's concepts (read): the nodes firmware's definition makes are refused.
- No firmware concept's definition changes. Whether the test of AC5 becomes an entry of the rulebook, which would need a firmware reinstall to reach the graph rule concept, is for Architecture.

## Out of scope

- **Adding a concept's section, or a membership:** `graph add-to-concept` (A10.22). Moving an element between sets: `graph move-element` (A10.23).
- **A set's name and description** (open question 1).
- **Concept headers, core nodes, properties and schemas:** `graph update-concept` (A10.16) and the property operations (A10.18).
- **Firmware's own nodes,** which change in firmware's definition.
- **Someone else's node:** `graph copy-node` (A10.24) makes a copy of one's own (D8).
- **The word block, the address, the d-tag and the labels,** which no input sets: a rename brings the word block's names along (AC2), and nothing else changes them.
- **Consequences a concept gives a field,** such as a relationship type's `alias`, which the rule `relationship-type-allowed` reads, or uniqueness the schema asks for (`x-tapestry.unique`) beyond AC4's name: concept-dependent rules (design §7), for stories of their own.
- **Which document a schema describes** (A10.20.a): this story checks the stored JSON, as create-element does (ADR 0020), and doesn't settle the split.
- **The cache's rebuild** (A10.36) and the derive step's preference for its cached copy (OPEN.md row 139), beyond what open question 4 settles for this write.
- **Today's save-element-json and set-json-tag routes,** which stay as they are (D15), and their field mapping (A10.5.a).
- **Publishing a change** as a nostr event (`export nostr`, A10.34).
- **Naming the node by its name or address:** `node` takes a tapestryKey, and an agent calls `graph resolve` (A10.9) first. Taking a ref is the declaration hook A10.9.a builds.
- **Bulk updates** (catalog §10, question 6): one node per call.
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

Resolved at this gate. Each carried the drafting's proposal, for the owner to confirm or change; the owner approved all four (2026-11-16).

1. **Sets: here, or once create-set lands?** *Resolved: once create-set lands. A set is refused for now, naming the follow-up, and a Loom subtask (A10.21.a) adds sets when A10.27 is merged* (the drafting's proposal, approved by the owner, 2026-11-16). AC6. Three things make a set differ from an element. Every set is an element of the set concept, so a rename's check (AC4) has to look among the set's siblings under its parent, as create-set's repeat does, not among all the set concept's elements. Today's sets carry no JSON, so nothing about them could be checked (AC3). And story 27's draft, being planned now, is deciding both a set's JSON and its repeat. The other choice is sets here too, with update-node waiting for create-set to merge first. Either way, story 27's Out of scope line naming update-node should say which.
2. **A rename onto a name in use, and the slug.** *Resolved: refuse it (`name-in-use`), using create-element's repeat in each concept the node belongs to; and the slug follows the name, while the address never changes* (the drafting's proposal, approved by the owner, 2026-11-16). AC2, AC4. Two of the instance's own elements of one name in one concept would leave create-element's repeat with two answers, and merging duplicates is merge-nodes' job (A10.25). A slug that follows keeps "the slug its name gives", which create-element holds every element to, true after a rename. The other choices: allow the rename and report the clash; or keep the slug, as update-concept keeps a concept's slugs, so a renamed element's slug stays its old name's.
3. **Whose letters are the instance's own?** *Resolved: the read conventions' answer, its assistant's or its owner's* (the drafting's proposal, approved by the owner, 2026-11-16). AC5. A letter an admin signed, such as one the A9 tools sign with an agent's own admin key, is then someone else's: refused, with copy-node named. One answer for reads and writes keeps `own` meaning the same thing everywhere, and the instance can't send a new version of an admin's letter, since it doesn't hold the admin's key. The other choices: an admin's letters count as the instance's own too; or the assistant's alone, as update-concept counts.
4. **What do readers of the cache see after a change?** *Resolved: the cached copy is left as it is, as update-concept leaves it, and the answer says when the node has a cached copy that is now out of date, until `cache rebuild` (A10.36) rebuilds it from the graph* (the drafting's proposal, approved by the owner, 2026-11-16). Fact 10. The UI's JSON page for a node shows that copy, so until then it shows the old JSON, and a firmware reinstall's derive pass rebuilds from it too. A memo on A10.36 records that this write makes such copies common. The other choice: the write takes the node's cached copy out, unless its json tag is held there, so readers fall back to the json tag and the next derive builds from the new JSON. That makes a graph write reach into the cache, which the design keeps apart (D1, D2).

For Architecture, not this gate:

- **The test of AC5:** what it reads, where it lives, and how merge-nodes (A10.25), delete-node (A10.26) and copy-node (A10.24) use it; whether it is an entry of the rulebook; and what it says of a node with no letter whose recorded author isn't the instance's own, such as a `NostrUser` node, whose `pubkey` is the person it stands for.
- **Which locks the write takes:** create-element locks its concept's header, and ADR 0020 Decision 16 says update-node takes the lock on the header of each concept whose section it changes. A rename checks names in every concept the node belongs to (AC4), and ledger row `2026-11-16-shared-set-creates-can-race` suggests locking every such header, in one order.
- **How firmware's own nodes are told apart** (AC6).
- **The merge's details:** the order of the section's keys; JSON held in the store (`lmdb:<tapestryKey>`), which update-concept writes back inline; and how a field given as `null` is told from a field to keep.
- **A rename's word block,** for an element whose word block isn't create-element's shape, and for one with none.
- **An element with no word block,** such as those today's create-element route made, under a schema that requires `word`: rule 4 judges the stored JSON (fact 9), so such an element can't change until its JSON has one.
- **The change entry's shape:** each field changed, with what it was and is, as update-concept's `concept-updated` records a concept's, and the copies.
- **The refusals' codes and statuses.**

## Deviations

- **`copies` reads the node again after the mapping.** `mapNodes` returns only what it changed, and ADR 0021 Decision 14's `copies` is the node properties it *now* carries. So update-node reads its judged concepts' marks (`F.marksOf`) and the node itself after the write, and lists the marked properties it has. That is two more reads.
- **The JSON tags are written only when the JSON changed.** Decision 13 writes them on every update. A rename of a node whose JSON holds no value the old name gave writes only its name, tapestryValue and name tags, and leaves a json tag held in the store (`lmdb:<key>`) as it was.
- **`changedElsewhere` takes `{ conceptUuids, labels, uuid }`,** not the uuids alone (ADR Implementation notes): Amendment 1's labels, and the address a `Set` label needs, come with them.
- **update-node declares its own `bad-fields`, `unknown-node` and `not-installed`,** worded for it; it reuses `bad-name` and `reserved-key` from `_elements.js`, `unknown-concept` from `_fields.js`, and `not-own-node` from `_nodes.js`.
- **Two refusals name another input:**
  - a description given two ways names `description`;
  - `no-section` names `concept` when it was given, else `fields`.
- **`not-an-element` says which case it is:** no concept reaches the node, or only word's does.
- **`firmwareElements` skips an element file whose JSON doesn't parse,** and keeps the first file when two give one address, as install's own create would find the first.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md)
- Epic: [engineering-team/epics/graph-operations-first-slice.md](../../epics/graph-operations-first-slice.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D1, D2, D4, D6, D8, D9, D10, D11, D15); catalog §2, Nodes
- The element write it follows, and the shared check it calls: [20-create-element.md](20-create-element.md) (ADR 0020, Decisions 6, 7, 11, 12 and 16)
- The concept write it mirrors: [16-create-concept-and-update-concept.md](16-create-concept-and-update-concept.md) (ADR 0016)
- The read conventions' `own`: [11-list-elements.md](11-list-elements.md) (ADR 0011)
- The field marks it carries: [stories/graph-operations-foundation/5-field-mapping.md](../graph-operations-foundation/5-field-mapping.md)
- The external CLI the agent uses: [stories/graph-operations-foundation/6-external-cli-and-agent-skill.md](../graph-operations-foundation/6-external-cli-and-agent-skill.md)
- ADR: [engineering-team/decisions/graph-operations-first-slice/0021-update-node.md](../../decisions/graph-operations-first-slice/0021-update-node.md)
- Test plan: [21-update-node.test-plan.md](21-update-node.test-plan.md)
- Review: (filled in after Review phase)
