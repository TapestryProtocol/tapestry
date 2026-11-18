# Story 22: `graph add-to-concept` and `remove-from-concept` — make any node an element of another concept, or put it in a set, and take the owner's claim out again, never out of the node's last concept

**Status:** Done
**Created:** 2026-11-17
**Type:** Feature
**Loom:** A10.22 — https://loom.brainstorm.world/t/A10.22

## Background

Loom's A10.22 asks for two graph writes (catalog §2, Nodes):

- **`graph add-to-concept`:** "Make a node an element of another concept, or put it in a set", taking `node`, `concept` or `set`, and `fields`, and answering "the membership". It "refuses fields that don't validate".
- **`graph remove-from-concept`:** "Take a node out of a concept or a set", taking `node` and `concept` or `set`, and answering "removed". It "refuses the node's last concept (D9)".

Done, for Loom, is when "each is declared once; answers at `/api/tapestry/graph/<operation>` for the owner and admins; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI." They are the element writes after create-element (A10.20), update-node (A10.21) and delete-node (A10.26). update-node refuses a node that has no section for the concept it names (`no-section`), and a node of no concept but word (`not-an-element`), and names add-to-concept for both.

The catalog's "`concept` or `set`" is read as story 20 settled it for create-element (its open question 1): `concept` is required and `set` is optional, for both operations. The concept decides which section the fields go in, which schema they meet, and which concept a removal takes the node out of; a set can sit in several concepts' class threads.

Twelve facts about today's instance shape the story:

- **Today's routes sign, or check nothing.**
  - `POST /api/normalize/add-node-as-element` takes a concept header's uuid and a node's uuid, links the concept's superset to the node (`HAS_ELEMENT`), and then signs a new version of the concept's concept graph, which lists its sets. It refuses a node already directly under the superset (409), and checks nothing else: not the node's JSON against the concept's schema, nor whose node it is. It gives the node no section for the concept and no tag naming it.
  - `POST /api/normalize/add-to-set` finds a set and an item by name, taking the first match. It signs a relationship event naming the pair, signs the item's event again with an `n` tag naming the set when the item is the assistant's, and links the set to the item.
  - `POST /api/normalize/delete-relationship` removes a `HAS_ELEMENT` between two nodes, by uuid, with no check for the node's last concept, and answers with a note that a firmware install can undo it.
- **The new stack keeps the membership link for these operations.** `graph add-relationship` and `remove-relationship` refuse `HAS_ELEMENT` as `reserved-type`, made by "graph add-to-concept and create-element" (rule `relationship-type-allowed`, docs/GRAPH_RULES.md §2). So no operation of the new stack can yet add or remove a membership of a node that already exists.
- **A node is an element of every concept whose class thread reaches it** (BIBLE §10, rule 3): from the concept's header to its superset (`IS_THE_CONCEPT_FOR`), down through its sets (`IS_A_SUPERSET_OF`), to the node (`HAS_ELEMENT`). One concept can reach a node in several ways at once: straight from its superset, through one or more of its sets, through a set that sits under more than one parent, or through another concept whose superset link-set put under this concept's superset or one of its sets, which makes that concept a kind of this one (A10.28).
- **`word` reaches nearly everything.** On this instance, word's class thread reaches 503 nodes through 48 sets (`/api/concept-graph/summaries`, 2026-11-17). update-node counts a node that no concept but word reaches as an element of no concept (`not-an-element`), and refuses a concept keyed `word` or `graphContext` (`reserved-key`), the keys an element's JSON keeps for itself (ADR graph-operations-first-slice/0020 Amendment 1).
- **A node's direct links undercount its concepts** (memo #117 on A10.22; ledger row `2026-11-16-prune-drops-superset-has-element`). A firmware install's prune passes take out a superset's direct link to an element that the superset also reaches through a set. The node stays in the concept through the set, with no direct link left to take out. So membership is read through the class thread, from each concept's header down to the node, as the field mapping's reads do.
- **A reinstall links again from a node's tags.** Pass 1d of a firmware install links each concept's superset, word's excepted, to every node whose `z` tag names the concept's header. The prune passes then take out a direct link that another way in makes redundant, never a node's only way in (`src/firmware/install.js`). So a membership that is added lasts a reinstall, and one that is taken out lasts only when nothing among the node's tags still names the concept.
- **An element's JSON is word-wrapper JSON.** It has a `word` block, whose `wordTypes` lists `word` and the key of each concept the node is an element of, and a section for each concept, under that concept's key. create-element writes the section of the concept it names, holding the element's name, the slug its name gives and the fields given, and the tags a letter for the element would carry: `d`, `name`, a `z` naming the concept's header, an `n` naming its set when it has one, and `json` (ADR 0020). Under D10, a node's edges say which concepts it belongs to, and `wordTypes` is computed from them.
- **One check of an element against a schema.** The rule `element-fits-schema` (BIBLE §10, rule 4; the rulebook's entry 7) is the check every element write calls. ADR 0020 Decision 16 already says add-to-concept passes it the node's JSON with the new concept's section, and reports each other concept the membership joins, as create-element does. What the rule judges is changing: A10.20.a decided that it judges a node's tapestryJson (ADR graph-operations-first-slice/0020a), whose implementation notes name add-to-concept among the writes that follow, and A10.20.b is building that now.
- **Whose node, and whose claim.** A node can point at data outside Neo4j, someone else's nostr event among them (D5). Under D4, an import records the claims that data makes, such as an item's claim to belong to a concept, as its author's, and "repair never edits a peer's node; it can add the owner's own nodes or edges alongside." unlink-set leaves alone a link another author's event claims and one firmware's definition makes (`peer-link`, `firmware-link`; ADR 0028), since a pull or a reinstall would make it again. update-node and delete-node, which change or delete a node itself, share a test of whose node it is, and refuse a node from someone else's event (`not-own-node`), a person node (`person-node`), a placeholder the import made (`placeholder-node`) and firmware's own elements (`firmware-node`) (ADRs 0021 and 0026). Each of them refuses a node another operation looks after (`made-elsewhere`: a concept header or core node, a schema, a property, a set, a graph rule), and create-element refuses, also as `made-elsewhere`, a concept whose elements another operation makes.
- **Marked fields go on the node.** A concept can mark fields its elements carry as node properties, `<concept key>_<field>` (A10.5). Every element write brings the nodes it wrote in line with the marks of every concept they are elements of, inside its own write, and records the copies in its change entry.
- **The letter, the cache and the reads.** A node from the instance's own letter changes in the graph first: update-node's answer says when the letter no longer matches the node, until `export nostr` (A10.34) sends a new one, and when the node's cached copy is out of date (the owner's answers to story 21's open questions 3 and 4). ADR 0020a's notes have the writes ask the derive step to rebuild the node after they commit. Reads judge a relationship by the node at its other end, since no relationship records who made it yet (ADR graph-operations-first-slice/0011).
- **Agents already have a way in.** The external CLI (A10.6) turns each operation the instance lists into a command, and an input such as `fields` takes an object or its JSON text (ADR 0020 Decision 1), so both operations reach agents with no change to either CLI.

## User-facing description

As an admin agent rebuilding or fixing a concept graph, or the owner, I want to make a node an element of another concept, or put it in one of a concept's sets, with the fields that concept asks for, without signing anything, so that a node can belong to every concept it is a case of, and a node that belongs to none can be given one.

As the owner, I want to file any node under my concepts, a pointer to someone else's event included, with my section kept beside their letter and never written into it, so that I can organize other people's items in my own graph while their claims stay as they wrote them.

As the same agent, I want to take a node out of a concept, or out of one of its sets, without deleting and remaking the node, so that a node put in the wrong place can be moved, and a class thread reorganized.

As the same agent, I want a call refused, with the reason and the way on, when it would leave a node in no concept, give it a section that doesn't fit, take out a claim that isn't the owner's, or take the node out of a concept I didn't name, so that every node stays an element of some concept (D9) and every write does only what was asked.

## Acceptance criteria

- [ ] **AC1 — Add a node to a concept.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/add-to-concept` with `node` (a node's tapestryKey), `concept` (a concept header's tapestryKey) and `fields` (an object, or its JSON text), then the node is an element of the concept, directly under its superset. The node's JSON gains the concept's section, under the concept's key, holding the node's name, the slug its name gives and the fields given, and its word block's `wordTypes` gains the concept's key. Its other sections, its tags, address and tapestryKey, and its other memberships stay as they were. The answer gives the node (its tapestryKey, address and name), `outcome: added`, each concept the node now belongs to with whether its JSON fits that concept's schema, whether its letter and its cached copy now differ from it, and the change entry, which `graph history` finds by the node and by the concept. `graph list-elements` lists the node among the concept's elements, from every point of view that counts the node (AC5). Nothing is signed or sent to a relay.
- [ ] **AC2 — Into a set.** Given `set` too, the tapestryKey of a set or superset in the concept's class thread, the node goes directly in that set, and becomes an element of every concept whose class thread reaches the set, each listed in `wordTypes` and in the answer. A node already in the concept goes in the set as well, and its section stays as it is.
- [ ] **AC3 — The new section is checked (rule 4).** Before anything is written, the node's JSON, as the call would leave it, is checked against the concept's JSON Schema with the check every element write uses (`element-fits-schema`). JSON that doesn't fit is refused (`invalid-fields`), listing every problem, each naming the field and what is wrong; a concept whose schema is missing or can't be read is refused (`no-schema`). Either way nothing changes and no entry is recorded. No value is made up for a field the caller left out. For each other concept the membership joins, the answer says whether the node's JSON fits that concept's schema, and those never stop the call (as story 20's open question 2 settled for create-element).
- [ ] **AC4 — Safe to repeat.** Given the node is already an element of the concept, and directly in the set when one is given, add-to-concept changes nothing, records nothing, and answers `outcome: already-element`, naming in `differs` each field given whose value differs from what the node's section holds; `graph update-node` changes those. Two calls at once that add one membership make it once.
- [ ] **AC5 — Anyone's node, and only the owner's claims** (open question 3). add-to-concept takes a node whatever its source: one of the instance's own, one that points at another author's event, a person node, a placeholder, or one of firmware's own elements. Each membership it adds is the owner's claim, beside any the node's author makes (D4). When the node's JSON is another author's letter, or firmware's definition, the owner's section is kept beside it, never written into it: the graph's record of that letter, or of that file, is unchanged, and the node's JSON as its readers get it holds the owner's section too, which AC3 checks. remove-from-concept takes out only the owner's own claims. A membership another author's event claims (a `z` tag naming the concept, or an `n` naming the set, in their letter), or one firmware's definition makes, is refused, naming whose claim it is: a reinstall or the next import would make it again, and whether it counts is each point of view's call, as unlink-set leaves a peer's link and firmware's (story 28).
- [ ] **AC6 — Take a node out of a concept, or out of a set** (open questions 1 and 2). Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/remove-from-concept` with `node` and `concept`, then the concept no longer reaches the node: every link to the node from the concept's superset, or from a set in the concept's class thread, is gone. Given `set` too, a set or superset in the concept's class thread, the links to the node from that set and from the sets below it are gone instead, and the node stays in the concept when the concept still reaches it another way. The node leaves each concept that reached it only through what was taken out, and stays in every other. For each concept it leaves, that concept's section leaves the node's JSON (the owner's section, for a node whose JSON is someone else's: AC5), and its key leaves `wordTypes`; the change entry keeps each section as it was, so a mistaken removal can be undone with add-to-concept. The answer gives the node, `outcome: removed`, each concept it left, each concept it is still an element of, whether its letter and its cached copy now differ from it, and the change entry, which `graph history` finds by the node and by the concept. Given the concept, or the set, doesn't reach the node, remove-from-concept changes nothing, records nothing, and answers `outcome: already-removed`. Nothing is signed or sent to a relay.
- [ ] **AC7 — Never a node's last concept (D9).** remove-from-concept refuses a call that would leave the node an element of no concept but word (`last-concept`): nothing changes, and the refusal names the concept and says how to go on: add the node to another concept first, or delete it (`graph delete-node`). Two calls at once that together would take a node out of its last two concepts don't both pass. The rule, that every node is an element of at least one concept, is defined once: as this guard and, run over a given set of nodes, as a check that names each one no concept but word reaches, for `rules check` (A10.31). It is written into the rulebook (`docs/GRAPH_RULES.md`) with what it says, that it refuses a write, and how a check finds what breaks it, and so becomes an element of the graph rule concept (A10.41).
- [ ] **AC8 — What they refuse.** Each operation refuses these, changes nothing, records no entry, and says in words what was wrong, naming the input, and the operation to use where there is one:
  - a `node` that names no node; a `concept` that names no concept header, or has no superset; a `set` that names no node, is neither a set nor a superset, or is outside the concept's class thread;
  - a concept keyed `word` or `graphContext` (`reserved-key`), and, for add-to-concept, a concept whose elements another operation makes (`made-elsewhere`, as create-element refuses one);
  - a node another operation looks after (`made-elsewhere`: a concept header or core node, a schema, a property, a set or superset, a graph rule), and a tag or a change entry, which is part of a letter or of the history and no element;
  - for add-to-concept: `fields` that aren't an object or its JSON text, or that give a `name` or `slug` other than the node's; a node whose JSON can't be read; and JSON that would be longer than 1,000,000 characters;
  - for remove-from-concept: a membership the node's author claims, or firmware's definition makes (AC5); and a call that would also take the node out of a concept that doesn't reach it through the concept or set named (open question 1). That is the concept the node is directly in when the named concept reaches it through that concept's superset (a dog, when the call names mammal), and a concept whose class thread holds a set the node is in that the named concept shares. The refusal names that concept, and the way on;
  - JSON that doesn't fit (AC3), and a node's last concept (AC7).
- [ ] **AC9 — It lasts, and it reaches agents.** After a firmware reinstall, after a backup restored on a fresh instance, and, for a node that points at someone else's letter, after that letter is imported again, a node changed by these operations is an element of the same concepts and sets as after the call, with the same JSON, tags and node properties (BIBLE §30). When the node's concepts mark fields (A10.5), the node properties `<concept key>_<field>` follow each change in the same write, set for a concept it joins and taken off for one it leaves, and the change entry records them. Both operations are for the owner and admins: a caller who isn't signed in is refused with 401, and a signed-in person who is neither with 403. Each is listed for agents and has its `/docs` entry, both made from its declaration. Someone with a shell inside the instance runs `tapestry graph add-to-concept` and `tapestry graph remove-from-concept` with no sign-in, passing `fields` as JSON text, and gets the routes' answers, and their entries name the command as who made them. On a scratch stack, an admin agent with its own key, through the external CLI (A10.6) and with no change to it: adds an element create-element made to a second concept, adds it again and is told it already is one, puts it in a set, takes it out of the set, and takes it out of the second concept; adds a node from a peer's event to a concept, and finds the peer's letter unchanged; and is refused fields that don't fit, a membership the peer's event claims, and a node's last concept.

Nine criteria, covering two operations that share their inputs, their reading of the class thread and their reading of whose claim a membership is. They stay one story because Loom pairs them and each one's call is the other's undo. If the change proves too big to review in one sitting, remove-from-concept (AC6, AC7, and its parts of AC5 and AC8) can become a story of its own.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`); it differs on every instance, so it is never written into code.

- Any concept, through its header, superset, sets and JSON schema (read): the concept a node joins or leaves, and the other concepts whose class threads reach it.
- `39998:<TA>:superset` and `39998:<TA>:set` — superset and set (read): `set` may be either.
- `39998:<TA>:word` — word (read): its class thread reaches nearly every element, so a node no other concept reaches is no element (AC7), and its key is reserved (AC8).
- `39998:<TA>:concept-header` and the seven core-node concepts (`superset`, `json-schema`, `primary-property`, `properties-set`, `property-tree-graph`, `concept-graph`, `core-nodes-graph`), `39998:<TA>:set` and `39998:<TA>:property` (read): their elements are another operation's, refused as the node and, by add-to-concept, as the concept.
- `39998:<TA>:graph-rule` — graph rule (firmware, written by `node src/firmware/graph-rules.js`): its elements are refused as the node, and D9's rule becomes one of them (AC7).
- `39998:<TA>:nostr-user` — nostr user (read): it has no elements on this instance; a person node can now be added to it, as to any concept (AC5).
- `39998:<TA>:neo4j-property` — neo4j property (read): its first set holds the marks AC9 carries.
- Firmware's concepts (read): firmware's own memberships stay as its definition makes them (AC5).
- No other firmware concept's definition changes.

## Out of scope

- **Moving an element** between two sets of one concept in one step: `graph move-element` (A10.23). An add, then a remove, does it in two.
- **Making an element, or changing a section it has:** `graph create-element` (A10.20) and `graph update-node` (A10.21). add-to-concept gives a node a section it lacks, and never changes one it has (AC4).
- **Sets, supersets, concept headers, core nodes, properties and graph rules as the node:** link-set and unlink-set (A10.28), create-set (A10.27), the concept and property operations (A10.16, A10.18) and the rulebook.
- **Changing what another author's letter, or firmware's definition, says:** their claims stay theirs (D4). `graph copy-node` (A10.24) makes a copy of one's own, and `lifecycle seed-firmware` (A10.37) changes firmware.
- **Counting the owner's claims in reads** (open question 3). A read judges a relationship by the node at its other end (ADR 0011), so from the owner's point of view, a node whose author it doesn't count stays out of a concept's elements even once the owner adds it, until relationships record who made them, a change to the read conventions for a story of its own.
- **Finding and fixing the nodes of no concept already in the graph:** `rules check` and `rules repair` (A10.31) run the rule AC7 defines.
- **Install's prune passes** (ledger rows `2026-11-16-prune-drops-superset-has-element` and `2026-11-15-reinstall-drops-a-supersets-own-membership`). These operations read membership through the class thread, so the passes don't mislead them; fixing the passes is those rows' work.
- **Consequences a concept gives its elements,** such as uniqueness its schema asks for (`x-tapestry.unique`) or a relationship type's alias: concept-dependent rules (design §7), for stories of their own.
- **Today's add-node-as-element, add-to-set and delete-relationship routes,** which stay as they are (D15).
- **Publishing a membership** as a nostr event (`export nostr`, A10.34). A membership made here is a private thought until then (BIBLE §30).
- **Naming a node by its name or address:** each input takes a tapestryKey, and an agent calls `graph resolve` (A10.9) first.
- **Bulk changes** (catalog §10, question 6): one node and one membership per call.
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

Resolved at this gate. Each carried the drafting's proposal, for the owner to confirm or change; the owner approved the first two and answered the third in the owner's own words (2026-11-17).

1. **What does taking a node out of a concept take out?** One concept can reach a node in several ways at once (fact 3). *Resolved: every way the concept's class thread reaches the node, and never a way that would also take the node out of a concept the caller didn't name* (the drafting's proposal, approved by the owner, 2026-11-17). AC6, AC8. The call takes out each link to the node from the concept's superset and from the sets in its class thread. The node then also leaves each concept that reached it only through this one, such as a concept this one is a kind of, and word: that follows from the class thread, so the answer lists them and the call isn't refused for them. But when the named concept reaches the node through another concept's superset (Snoopy is a mammal because he is a dog), or through a set another concept's class thread holds too, taking those links out would take the node out of that other concept as well: the call is refused, naming it, and saying to take the node out of that concept instead, or to unlink the two. With `set`, the same holds within that set and the sets below it. The other choices were: take out only the one direct link from the superset or set named, and say whether the concept still reaches the node; or take out every way in and let the node leave every concept that follows, refusing only its last concept.
2. **What happens to the section of a concept the node leaves?** *Resolved: it leaves the node's JSON, the concept's key leaves `wordTypes`, and the change entry keeps the section whole, so a mistaken removal can be undone with add-to-concept and the section's fields* (the drafting's proposal, approved by the owner, 2026-11-17). AC6. A section for a concept the node isn't in tells every reader of the JSON something the graph doesn't say (D10: the edges say which concepts a node belongs to), and no concept's schema would judge it. The cost: a removal and then an add have to give the fields again, which the entry holds. The other choice was to keep the section, take only the key out of `wordTypes`, and let add-to-concept take the node back with the section it kept.
3. **Someone else's node: refused, or a membership beside it?** *Resolved: accepted* (the owner's answer, 2026-11-17, in place of the drafting's proposal to refuse it): "Yes, it should accept a node, even if the node came from someone else's event. Many nodes will include pointers to data that exists outside of neo4j; this does not automatically disqualify the node from being an element of any concept. Indeed, every node must be an element of at least one concept. This is true even if the outside data is someone else's nostr event." AC5, AC8, AC9. What the drafting took from the answer, which the owner confirmed in approving the story (2026-11-17):
   - **The same holds for a person node, a placeholder and firmware's own elements,** each a pointer to data outside the graph: a nostr account, an event the graph doesn't hold, firmware's definition. Tags and change entries, parts of a letter and of the history, stay refused.
   - **What the owner adds is the owner's claim, beside the author's** (D4: "the owner's own nodes or edges alongside"). The owner's section is kept beside their letter, never written into it, so their claim stays as they wrote it (story 21's user-facing description), and the next import of their letter leaves the owner's section in place.
   - **remove-from-concept takes out only the owner's claims.** A membership the author's event claims, or firmware's definition makes, stays: a reinstall or the next import would make it again, and whether it counts is each point of view's call, as unlink-set leaves a peer's link and firmware's (story 28, open questions 1 and 2).
   - **Reads don't count the owner's claim yet** (Out of scope). From the owner's point of view, a node whose author it doesn't count stays out of the concept's elements even once added, until relationships record who made them.

**Added at Architecture** (the owner's approval, 2026-11-17, with ADR 0022): AC8's list gains `name-in-use`, for adding one of this instance's own nodes to a concept where another of its own elements has the node's name, or sits at the address the name gives, since create-element's repeat would then have two answers (as story 21's open question 2 settled for a rename); and `tag-node`, for a tag, which is part of a letter, records no author, and is no element. The ADR's other refusals beyond the list, `not-installed`, `unreadable-json` and a length limit on the JSON, are mechanics the other element writes have too. The owner's sections beside another author's letter are kept in one node property of the instance's own, `tapestryOwnSections` (ADR 0022, Option A).

**Changed at review round 1** (the owner's choice, "Fix findings first", and answer, "add-to-concept", 2026-11-18, with ADR 0022 Amendments 2 and 3): AC4's repeat is `already-element` only when the node's JSON, as the operations read it, holds the concept's section. A node already in the concept that lacks its section is given one, checked against the concept's schema, with no new link, so a call with no fields for such a node is refused `invalid-fields` when the schema asks for fields. AC2's "its section stays as it is" holds for a node that already has one. AC3's check runs whenever the call changes the node's JSON, its `wordTypes` included.

For Architecture, not this gate:

- **Where the owner's section lives on a node whose JSON is another author's letter or firmware's definition** (AC5): beside it, so that the graph's record of the letter is unchanged, the node's tapestryJson (ADR 0020a) holds the section, the rule judges it, and importing the letter again, or a reinstall, leaves it. And what the call does when the author's own JSON already has a section for the concept.
- **How a removal is made to last** (AC9): the node's tags that claim a membership (`z`, and `n` for a set), which a reinstall's pass 1d reads (fact 6), for a membership added or taken out; the relationship event today's add-to-set signs, naming the pair; and what a letter for the node would carry afterwards.
- **How each membership's claimant is told** (the owner's writes, an author's letter, firmware's definition), and what the calls do with one that more than one of them claims.
- **How the ways a concept reaches a node are found,** and how AC8's cross-concept cases are found and named, when a set sits under several parents and when link-set made one concept a kind of another.
- **Which locks the writes take,** so that AC4's and AC7's two calls at once go one at a time, and so does an add or a remove beside an update-node or a delete-node of the same node.
- **Whether these build on A10.20.b's change** to what `element-fits-schema` judges (fact 8), and so wait for it to merge, or on the rule as it stands.
- **The word block:** a node with none, such as those today's create-element route made, a person node or a placeholder; and one whose `wordTypes` doesn't list what its edges say.
- **A json tag held in the store** (`lmdb:<tapestryKey>`), and the cached copy after the write (ADR 0020a's rebuild after commit).
- **D9's rule:** one rulebook entry or two, its name, and which nodes its check covers, since tags, person nodes, placeholders and change entries are elements of no concept today.
- **`relationship-type-allowed`'s text for `HAS_ELEMENT`,** which names add-to-concept and create-element as what makes it, and not remove-from-concept as what takes it out.
- **The answers' and change entries' shapes, and the refusals' codes and statuses.**

## Deviations

- **`_sets.js` exports `descriptorsOf`,** which Decision 11 calls as `S.descriptorsOf` but the module didn't export. Nothing else in `_sets.js` changes.
- **`_fields.js` also exports `ownSectionsOf`,** the one reading of `tapestryOwnSections` (JSON text of an object), which `elementsOf`, the derive step and `_memberships.js` share.
- **Sections beside that don't parse,** a case the ADR doesn't name: `elementsOf` reads such a node as a problem, so the field mapping leaves its copies as they are, as it does for a json tag that can't be read (BIBLE §30). The derive step leaves them out and derives the node from its letter.
- **`section-added`'s `was`** is the section the node's JSON already held for the concept when it wasn't yet an element of it (Decision 7's merge: AT13's `stale`), else null. Decision 14 gives `was: null` for a new section only. For a node kept beside, `was` is what `tapestryOwnSections` held for the concept.
- **One `unknown-node` and one `made-elsewhere` declaration per operation,** each `when` covering both the node and the set, or both the node and the concept. A declaration may list a code only once (`declaration.js`), and Decision 17 names two sources for each.
- **`made-elsewhere` for a superset names both** `graph update-concept`, which AT33 and RM32 look for, and `graph link-set` and `unlink-set`, which Amendment 1, item 6 names. For a set it names link-set and unlink-set; for anything else, the operation `X.changedElsewhere` names.
- **`name-in-use` isn't checked for a node already in the concept** that is put in a set (Amendment 1, item 7): no new membership of the named concept is made, so create-element's repeat isn't affected. *(Review round 1: ADR Amendment 2, item 1 says so of every node already in the concept.)*
- **`reserved-key` and `no-superset` are worded for these operations** in `M.say` where `_elements.js`'s words are create-element's ("No element of it can be made here"): remove-from-concept's `reserved-key`, and both operations' `no-superset`. add-to-concept's `reserved-key` keeps `_elements.js`'s words. *(Review round 1: each operation now also declares its own `no-superset` and `not-installed`, Amendment 2, item 7.)*
- **remove-from-concept takes out a `z` naming any concept the node leaves,** word's included (Decision 15, step 3, as written), while the word block, and `word` in `wordTypes`, stay (Amendment 1, item 4).
- **`set` in both answers echoes the input,** or null; Decision 13 lists it without a definition. An `already-element` answer's `concepts` gives each concept's verdict on the node's JSON as it is (Decision 8, step 8).
- **The relationship events in `letters` are found from their `nodeTo` tag.** No index holds tag values, so on a large graph that read scans the tags; it runs only for a removal that took a link out. *(Superseded at review round 1: they are found through the relationship concept's class thread, Amendment 2, item 4.)*
- **`docs/GRAPH_RULES.md` entry 7's Enforced by still says `graph add-to-concept` "will call" its check.** The ADR changes only §8, and rewording entry 7 would regenerate rule 7's element as well. *(Superseded at review round 1: entry 7 is reworded and rule 7's element regenerated, Amendment 2, item 7.)*
- **A ledger row records rule 8's firmware reinstall,** `2026-11-18-rule-eight-awaits-firmware-reinstall`, as rule 7's was recorded.
- **The scoped gate needed this worktree's `node_modules` linked** to the main checkout's, as A10.18's and A10.26's are: its first run (`20261118T022832Z-51505-24f5`) failed 13 tests in four suites, each on `Cannot find module '<worktree>/node_modules/…'`. The link is untracked, since `.gitignore`'s `node_modules/` doesn't match a link, and was removed afterwards.

**Review round 1's** (ADR Amendment 2):
- **A section given alone carries no would-be tags.** A node already in the concept whose JSON lacks its section gets the section and no new link (Amendment 2, item 1). Decision 9's tags go with a link, so none is written then: a `z` would have a reinstall's pass 1d make the direct link the call didn't.
- **`wordTypes` gains the concept's own key too,** when a node already in the concept lacks it, beside the keys the set joins (Amendment 2, item 2), since a new membership's step 2 adds both.
- **add-to-concept's length check covers whatever the call writes,** `wordTypes` alone included, where it covered a new section only.
- **Only the rule's guard form is silent for a node another operation looks after** (Amendment 2, item 3). Its check form, `{ node }`, still judges such a node, for `rules check`. `_memberships.js`'s `lookedAfterElsewhere` is the one test, which `theNode` and the guard share.
- **The relationship concept's header is found by its address in a read of its own,** then walked by its tapestryKey: one walk from a header found by `uuid` reads, in the fake graph, as story 4's declared-types read, which can't return an event's address.
- **The catalog's add-to-concept row says when `already-element` is answered,** and that a missing section is given: Decision 16 keeps the row to what is built, and Amendment 2 doesn't name it.
- **`not-installed`'s and `no-superset`'s messages are worded per operation too,** as their new declarations are.

**Review round 2's** (ADR Amendment 3):
- **add-to-concept's description also says when rule 4 runs:** whenever the call changes the node's JSON, a section or `wordTypes`, as for a new member, and that a call writing only a set's link and its tags reports the concept's verdict. Amendment 3 asks only for item 5's words there, but item 1 changes what the description's repeat paragraph said.
- **A refusal for a member's `wordTypes` carries the rule's own message,** as a new member's does ("`dog.breed` is required"). The review's suggested way on, adding the node to golden retriever first, isn't in the message: Amendment 3 doesn't ask for it. *(Review round 3: the message now adds it, Amendment 4, item 1.)*
- **No live re-check this round.** Item 1 changes only the condition on which add-to-concept calls `Sch.checkElements`. The check itself, the concept's schema read through the transaction and judged by ajv in the process, is the code the fake graph runs too, so no Neo4j behaviour changed.

**Review round 3's** (ADR Amendment 4):
- **The way on names the concepts whose keys the call adds to `wordTypes`,** not every concept the set joins. A concept whose key `wordTypes` already holds brings no change, and an add to it would answer `already-element`.
- **Its add-to-concept call gives the same `set`,** so the node lands where the refused call would have put it, even in a set below the other concept's superset. For Mark Me the set is golden retriever's superset, which counts as no set.
- **Its update-node call names the concept,** since the node is then in more than one, and update-node can leave `concept` out only for a node's one concept.
- **When the call adds no other concept's key,** only the named concept's own, the way on is update-node first, then the same call again. Amendment 4 doesn't name this case.
- **Only `invalid-fields` gets the words.** A `no-schema` refusal keeps the rule's message, since neither step of the way on could help with a schema that can't be read.
- **No words for a node kept beside:** Amendment 4 says the refusal never reaches one, and the test plan neither asks for those words nor forbids them.
- **The words live in `M.say.memberMisfit`,** with the other refusals' words.
- **No live re-check:** these are words, and the coordinator's brief said to skip it.

**Review round 4's** (ADR Amendment 5):
- **Each concept to add the node to has its key given in the review's form:** "with graph add-to-concept, concept <key> and set <set>". When the set joins more than one such concept, the words name each one with its own key ("<name> (<address>) with concept <key>"), all with the same `set`, one add for each. Neither a test nor Amendment 5 covers that case.
- **No live re-check:** the change is to words alone.

## Evidence

### The suites (Implementation, 2026-11-18, on `85326415` with the implementation uncommitted, since committed as `841b7549`)

Each ran alone on this Mac, with every service endpoint dead (`BRAINSTORM_BASE_URL`, `TAPESTRY_PORT`, `TAPESTRY_CONTAINER`, `NEO4J_URI` and `REDIS_PORT` on dead values). None failed.
- **The new suites:** add-to-concept 39 passed, remove-from-concept 33, memberships-shared 18, memberships-agent-through-cli 1.
- **Rule 8's:** graph-rules-builder 26 passed; graph-rule-firmware 13 passed, 4 skipped (GL1–GL4, live); firmware-element-sync 21 passed.
- **The neighbours:**
  - update-node 42, its shared suite 13, its agent 1;
  - create-element 34, element-schemas 14, elements' agent 1;
  - map-fields 12, mark-field 16, unmark-field 13, fields 8, fields' agent 1;
  - the six rules suites: class-thread-acyclic 10, concept-slug-unique 5, element-fits-schema 11, field-mark-allowed 14, relationship-type-allowed 10, set-has-a-parent 12;
  - add-relationship 12, remove-relationship 7, history 8, list-elements 30;
  - delete-node 40 and its agent 1, unlink-set 21, link-set 21;
  - graph-fake 31, write-path 13, change-entry-fields 3.
- **The scoped gate:** record `20261118T023152Z-53544-4655`, PASS, 1,122 passed, 0 failed, 10 skipped, over 8 suites (operations, external-cli, openapi-coverage, admin-action-sweep, schema-save-finds-the-right-header, graph-rules-builder, graph-rule-firmware, firmware-element-sync), on `85326415+dirty`. The earlier run is in Deviations.
- **harness-lint:** clean.

### The live check (Implementation, 2026-11-18, on `85326415` with the implementation uncommitted, since committed as `841b7549`)

It ran on a throwaway instance from `scripts/scratch-stack.sh`, never a shared or private one. Every call went through `test/helpers/scratchLoopback.js`. The scripts (`setup.sh`, `live.js`, `restore.sh`) and every call's request and answer are in this worktree's `tmp/live-check-22/` (ignored by git).
- **The instance.** It booted from image `agent-memory-tapestry:latest` with this branch's `src/` mounted. The image's firmware differed from the branch's (digests `c4c302955e90` and `b210347f63a8`), so the branch's was copied in, the control panel restarted, and the firmware installed again. The branch's `bin/tapestry.js` and `clients/cli` were copied in.
- **Keys.** Four throwaway keys: the owner's and an admin's, for the agent, both set in `/etc/brainstorm.conf`; a peer's; a stranger's.
- **Afterwards** it was removed, after a second, fresh boot for the restore, which was removed too. Each `down` checked first that the container mounted this worktree's `src/`.

**The seed:** live beagle and live pet, with `graph create-concept`; live lap pets, a set of live pet's, with `graph create-set`; live hound, with today's create-concept route and its property tree, its `description` marked with `graph mark-field`; Peer Pup, the peer's lettered element of live beagle, made with Cypher; and Peer Letter, an event the peer signed, put in the relay and imported with `POST /api/neo4j/event-update`.

**By check, all 32 of the script's checks passed, and L10's three:**
- **L1,** the admin agent through nginx and the external CLI:
  - it made Snoopy in live beagle; added it to live pet (`added`, `kept: json-tag`, recorded as the agent's); added it again (`already-element`, `change: null`); put it in live lap pets; took it out of the set (`left: []`), then out of live pet;
  - it filed Peer Pup under live pet (`kept: beside`);
  - it was refused `{"description":5}` (`invalid-fields`, from `element-fits-schema`), Peer Pup's membership of live beagle (`author-claim`, naming the peer) and Snoopy's last concept (`last-concept`, by `node-has-a-concept`);
  - Snoopy's history: two removals, two adds and the create, each the agent's. In Neo4j it is in live beagle alone, with no `z` naming live pet, no `n` naming the set and no live pet section.
- **L2:** Peer Pup's tags and json tag were exactly as before, and `tapestryOwnSections` held the owner's section.
- **L3,** after a set of adds and removes: Rex into live hound, its description carried as `liveHoundKg13_description`; Hound Gone into live beagle and out of live hound, its copy and its `z` going; firmware's dog rover into live pet, beside its file; Lap Dog, in live pet, into live lap pets. Then two firmware reinstalls, each `success: true`. After each, the seven nodes' concepts, set links, tags, JSON, sections beside and copies were as the calls left them, and no superset link changed: nothing taken out came back through pass 1d or wire-implicit-elements.
- **L4:** backup `20261118T024336Z-98143e4e` (5.97 MB: 3,684 nodes, 4,173 relationships) was restored on a fresh instance, its transaction and counts exact. The seven nodes were as before.
- **L5:** Peer Letter's event imported again answered `action: updated`. The owner's section beside it, and its membership of live pet, stayed; its tags came back as the letter says, under the import's own tag uuids, which for one event are the same each time.
- **L6,** at once, three times each:
  - two adds of one membership: `added` and `already-element`, one link and one entry;
  - two removes of a node's last two concepts: one `removed` and one `last-concept`, each time from the re-check after the delete (Decision 15), the node left in live pet;
  - an add beside an update-node of one node: both went, the add first each time, and neither write was lost.
- **L7:** Peer Letter, derived, then added to live pet beside: `cacheOutOfDate: true`. Derived again, its tapestryJson held the owner's section and live pet's key in `wordTypes`, and the rule's verdict for live pet was valid.
- **L8,** through nginx: a visitor got 401 from both routes. The stranger, signed in by the CLI, was refused ("Only the owner or an admin can do this."), and with its session cookie both routes answered 403.
- **L9:** the relay held 478 events before the membership calls and 478 after. The change entries went from 7 to 43.
- **L10:** with the branch's firmware installed, `graph-rule-firmware.test.js`'s live part passed GL1–GL3: an item per rule, eight, `node-has-a-concept` among them.

### Review round 1's fixes (2026-11-18, on `b06f8aa3` with the fixes uncommitted, since committed as `f7a72259`)

The review passed with eight non-blocking findings, and the owner chose to fix them before the PR. ADR Amendment 2 says what each fix is; the Tester's tests for them are in `b06f8aa3`.
- **What changed.**
  - **Item 1:** add-to-concept reads the node's JSON first, and answers `already-element` only when its view holds the concept's section. A node already in the concept without one is given it: `added`, `section-added`, and no link unless a set is given that doesn't hold it. update-node's `no-section` words and add-to-concept's description say so, and so does the catalog's row.
  - **Item 2:** a node kept in its json tag gains in `wordTypes` the keys the set joins, as a new membership does, recorded as `field-changed`.
  - **Item 3:** the rule's guard form is silent for a node another operation looks after (`_memberships.js`'s `lookedAfterElsewhere`, which `theNode` shares), so apply answers `made-elsewhere`.
  - **Item 4:** `letters` finds the instance's own relationship events through the relationship concept's class thread, never by a tag's type and value.
  - **Item 6:** a removal from a node kept beside reads only `tapestryOwnSections`.
  - **Item 7:** rulebook entry 7 says add-to-concept calls the check, and entry 8 says word reaches nearly every element "through the other concepts' supersets under its own"; `node src/firmware/graph-rules.js` regenerated both elements, and ledger row `2026-11-18-rule-eight-awaits-firmware-reinstall` names rule 7's. `_memberships.js` declares each operation's own `not-installed` and `no-superset`.
  - **Item 8:** ledger rows `2026-11-18-reads-ignore-owner-membership-claims` (follow-up 1, with the other half of the missing provenance), `2026-11-18-update-node-refuses-owner-sections-beside` (2), `2026-11-18-search-misses-owner-sections-beside` (3) and `2026-11-18-unlink-set-skips-last-concept-guard` (5).
- **The suites,** each alone on this Mac with every service endpoint dead; none failed:
  - add-to-concept 44 passed, remove-from-concept 35, memberships-shared 22, memberships-agent-through-cli 1;
  - graph-rules-builder 26; graph-rule-firmware 13, 4 skipped (live); firmware-element-sync 21;
  - every neighbour run before, with the same counts as before.
- **The scoped gate:** record `20261118T045139Z-91032-59b1`, PASS, 1,133 passed, 0 failed, 10 skipped, over the same 8 suites, on `b06f8aa3+dirty`, with `node_modules` linked for the run and the link removed after.
- **harness-lint:** clean.
- **The live re-check,** on a fresh scratch stack from `scripts/scratch-stack.sh`, booted from `agent-memory-tapestry:latest` with this branch's `src/` and the branch's firmware installed after a restart, as before. Its script and every call are in `tmp/live-check-22/` (`recheck.js`, `report-recheck.json`). It was removed afterwards, after checking it mounted this worktree's `src/`; the `tapestry` container was never touched.
  - **The first run** failed three checks on the script's own mistake: it added Fetch and Mark to live dog with no fields, and graph create-concept's schema requires a description, so both were refused `invalid-fields`, rightly (`report-recheck-run1.json`). With a description given, the second run passed all 9.
  - **Item 1:** Fetch, in live beagle, went into live walkers through live dog (a set live pet shares), joining live pet with no live pet section (`fits: false`). add-to-concept to live pet with fields then answered `added`, its entry one `section-added` and no `membership-added`. The links into Fetch were the same before and after, and live pet's schema then fit. The same call again was `already-element`.
  - **Item 2:** Mark, in live dog, put in live walkers: its `wordTypes` gained live pet's key, recorded as `field-changed`, with no live pet section.
  - **Item 6:** a peer's lettered node whose json tag doesn't parse, made with Cypher in live beagle and live pet with the owner's section beside, was taken out of live pet: `removed`, `kept: beside`, the property gone, its tags as they were, still in live beagle.
  - **Item 4:** today's `POST /api/normalize/add-to-set` put Paired in live lap pets and signed the assistant's relationship event naming the pair, not yet wired into the relationship concept. A firmware reinstall wired it from its `z` tag. Paired then taken out of live lap pets: `letters` named the event.

### Review round 2's fixes (2026-11-18, on `fc4cf1b1` with the fixes uncommitted, since committed as `9c6d890c`)

Review round 2 asked for changes: one blocking finding (R2-1) and five non-blocking. ADR Amendment 3 says what each fix is. The merge with staging (R2-6) and the story's AC2 and AC4 note (R2-2) were done before this round's code; the Tester's tests are in `fc4cf1b1`.
- **What changed.**
  - **R2-1:** add-to-concept runs rule 4 whenever the call changes the JSON it keeps (`jsonChanged || ownChanged`), not only when it writes a section. So a member whose `wordTypes` a set would change is refused as a new member is, and a call that writes only a set's link and its tags reports. The description says so.
  - **R2-3:** `M.LETTERS`' description and remove-from-concept's description say `letters` finds the instance's own relationship events through the relationship concept, and that one signed since the last firmware reinstall can be missing until a reinstall wires it.
  - **R2-5:** add-to-concept's description says `graph update-node` changes the fields `differs` names for one of the instance's own nodes, and that for a node kept beside another author's letter, which update-node refuses, a removal and then an add with the fields change them.
- **The suites,** each alone on this Mac with every service endpoint dead; none failed:
  - add-to-concept 49 passed (AT54–AT58 among them), remove-from-concept 36, memberships-shared 23, memberships-agent-through-cli 1;
  - graph-rules-builder 26; graph-rule-firmware 13, 4 skipped (live); firmware-element-sync 21; `node src/firmware/graph-rules.js --check`: the 8 items are current;
  - A10.18's suites, which the merge brought: add-property 15, remove-property 8, set-schema 10, update-property 11, properties-agent-through-cli 1;
  - every neighbour run before, with the same counts as before.
- **The scoped gate:** record `20261118T054955Z-30922-7f5b`, PASS, 1,185 passed, 0 failed, 10 skipped, over the same 8 suites, on `fc4cf1b1+dirty`, with `node_modules` linked for the run and the link removed after. Operations' 1,024 include A10.18's suites, which the merge brought.
- **harness-lint:** clean.
- **No live re-check** (Deviations, round 2).

### Review round 3's fixes (2026-11-18, on `e7a9833f` with the fixes uncommitted, since committed as `58c8bf58`)

Review round 3 passed with two non-blocking findings, both about words, and the owner chose to fix them before the PR. ADR Amendment 4 says what each fix is. The Tester's tests are in `e7a9833f`.
- **What changed.**
  - **R3-1:** some calls write no section but are refused for a misfit that their `wordTypes` change brings. Such a refusal keeps rule 4's message and adds two things. First, fields given in the call aren't written into the section the node already holds. Second, the way on: add the node to each concept the set joins, with `graph add-to-concept` and the same `set`, then give the named concept's missing fields with `graph update-node`. For Mark Me, the concept is golden retriever and the field is dog's breed. The words are `M.say.memberMisfit`. A call that writes a section keeps the plain message.
  - **R3-2:** add-to-concept's description now has Amendment 4's sentence, word for word. A removal and then an add change the owner's own section of any node kept beside. A section the author's letter holds, for a membership their letter claims, stays theirs.
- **The suites,** each alone on this Mac with every service endpoint dead; none failed:
  - add-to-concept 52 passed (AT59–AT61 among them), remove-from-concept 36, memberships-shared 23, memberships-agent-through-cli 1;
  - graph-rules-builder 26; graph-rule-firmware 13, 4 skipped (live); firmware-element-sync 21; `node src/firmware/graph-rules.js --check`: the 8 items are current;
  - every neighbour run at round 2, with the same counts.
- **The scoped gate:** record `20261118T063427Z-23019-21fd`, PASS, 1,188 passed, 0 failed, 10 skipped, over the same 8 suites, on `e7a9833f+dirty`. `node_modules` was linked for the run and the link removed after. An earlier run, `20261118T063035Z-10618-6663`, passed with the same counts. It was run again because comments in the two files changed while it ran.
- **harness-lint:** clean.
- **No live re-check** (Deviations, round 3).

### Review round 4's fixes (2026-11-18, uncommitted on `e9b1310d`)

Review round 4 passed with three non-blocking findings, and the owner chose to fix them before the PR. ADR Amendment 5 says what each fix is. The Tester's tests and the seed's two new sets, scrollShelf and showGoldens, are in `e9b1310d`.
- **What changed.**
  - **R4-1:** the way on now names each concept to add the node to by its tapestryKey as well as its name and address: "with graph add-to-concept, concept <key> and set <set>". An agent can follow it without running graph resolve first. `M.say.memberMisfit` is the only code that changed.
  - **R4-2:** tests only. AT63, AT64 and AT65 hold round 3's three details: the add's own `set`, update-node's `concept`, and `no-schema`'s plain message. AT66 holds the other side: a joined concept with no schema is reported, not refused for. Their code is as round 3 left it.
  - **R4-3:** the ledger row is the coordinator's, to reword at the next staging merge. Nothing changed for it here.
- **The suites,** each alone on this Mac with every service endpoint dead; none failed:
  - add-to-concept 57 passed (AT62–AT66 among them), remove-from-concept 36, memberships-shared 23, memberships-agent-through-cli 1;
  - graph-rules-builder 26; graph-rule-firmware 13, 4 skipped (live); firmware-element-sync 21; `node src/firmware/graph-rules.js --check`: the 8 items are current;
  - every neighbour run at round 3, with the same counts.
- **The scoped gate:** record `20261118T074914Z-92395-b18f`, PASS, 1,193 passed, 0 failed, 10 skipped, over the same 8 suites, on `e9b1310d+dirty`. `node_modules` was linked for the run and the link removed after.
- **harness-lint:** clean.
- **No live re-check** (Deviations, round 4).

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Rebuild bullet)
- Epic: [engineering-team/epics/graph-operations-first-slice.md](../../epics/graph-operations-first-slice.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D1, D2, D4, D5, D6, D9, D10, D13, D15); catalog §2, Nodes
- The element writes these follow, and the checks they share: [20-create-element.md](20-create-element.md) (ADR 0020), [21-update-node.md](21-update-node.md) (ADR 0021), [26-delete-node.md](26-delete-node.md) (ADR 0026)
- The class threads they read, how one concept becomes a kind of another, and the links left as their claimants': [28-link-set-and-unlink-set.md](28-link-set-and-unlink-set.md) (ADR 0028)
- What the schema check judges: [engineering-team/decisions/graph-operations-first-slice/0020a-the-document-a-schema-describes.md](../../decisions/graph-operations-first-slice/0020a-the-document-a-schema-describes.md); [42-both-readers-judge-tapestryjson.md](42-both-readers-judge-tapestryjson.md)
- The read conventions' point of view: [11-list-elements.md](11-list-elements.md) (ADR 0011)
- Reading membership through the class thread: memo #117 on A10.22; [ledger/2026-11-16-prune-drops-superset-has-element.md](../../../ledger/2026-11-16-prune-drops-superset-has-element.md)
- The field marks they carry: [stories/graph-operations-foundation/5-field-mapping.md](../graph-operations-foundation/5-field-mapping.md)
- The rulebook and its graph rule concept: [docs/GRAPH_RULES.md](../../../docs/GRAPH_RULES.md); [41-graph-rule-concept.md](41-graph-rule-concept.md)
- The external CLI the agent uses: [stories/graph-operations-foundation/6-external-cli-and-agent-skill.md](../graph-operations-foundation/6-external-cli-and-agent-skill.md)
- ADR: [engineering-team/decisions/graph-operations-first-slice/0022-add-to-concept-and-remove-from-concept.md](../../decisions/graph-operations-first-slice/0022-add-to-concept-and-remove-from-concept.md)
- Test plan: [22-add-to-concept-and-remove-from-concept.test-plan.md](22-add-to-concept-and-remove-from-concept.test-plan.md)
- Review: [reviews/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.md](../../reviews/graph-operations-first-slice/22-add-to-concept-and-remove-from-concept.md)
