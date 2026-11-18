# Story 23: `graph move-element` — move an element from one set of a concept to another, in one step

**Status:** Approved
**Created:** 2026-11-18
**Type:** Feature
**Loom:** A10.23 — https://loom.brainstorm.world/t/A10.23

## Background

Loom's A10.23 asks for one graph write (catalog §2, Nodes):

- **`graph move-element`:** "Move an element between two sets of the same concept, in one step", taking `node`, `from` and `to`, and answering "moved". It "refuses sets of different concepts".

Done, for Loom, is when "it is declared once; answers at `/api/tapestry/graph/move-element` for the owner and admins; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI." The design doc lists it among the element writes: "elements (create as an element of a concept, update, move to another set, remove from a concept)" (GRAPH_OPERATIONS_DESIGN_HANDOFF.md §4).

Eight facts about today's instance shape the story:

- **No route moves an element today.** Today's tools take two calls: `POST /api/normalize/delete-relationship`, which removes a `HAS_ELEMENT` by uuid and checks nothing, and `POST /api/normalize/add-to-set`, which finds the set and the item by name and signs a relationship event (story 22, fact 1).
- **The new stack takes two calls too, and they don't add up to a move.** `graph add-to-concept` with `set` puts the node in the set as well, keeping its other memberships (story 22, AC2), and `graph remove-from-concept` with `set` takes out the links into the node from that set *and from the sets below it* (story 22, AC6). Between the two calls the node is in both sets, and a removal from a set with sets below it can take out more than the one link the caller meant.
- **Sets hold elements directly.** A concept's header points to its superset (`IS_THE_CONCEPT_FOR`), the superset to its sets and each set to the sets below it (`IS_A_SUPERSET_OF`), and a superset or a set to its elements (`HAS_ELEMENT`). A node is an element of every concept whose class thread reaches it (BIBLE §10, rule 3). A set may have more than one parent, and link-set can make one concept a kind of another by putting its superset under the other's class thread (story 28), so one set can sit in more than one concept's class thread.
- **On the local instance, sets are few and single-parent** (read-only count, 2026-11-18): 22 sets, each under exactly one parent; 532 element links come from supersets and 76 from sets. Most elements sit directly under their concept's superset, so the move an agent makes most is from the superset into a set, the filing of an element.
- **`word` reaches nearly everything.** Its class thread reaches most nodes (story 22, fact 4), so two sets of any two concepts are nearly always both in word's class thread. update-node and add-to-concept treat `word` and `graphContext` as reserved keys, and D9 counts a node that no concept but word reaches as an element of no concept.
- **Whose claim a membership is.** remove-from-concept takes out only the owner's claims: a membership another author's letter claims (`author-claim`: a `z` naming the concept, or an `n` naming the set) or one firmware's definition makes (`firmware-membership`) stays, since the next import or a reinstall would make it again (story 22, AC5). add-to-concept takes any node: one of the instance's own, a peer's, a person node, a placeholder, or one of firmware's own elements.
- **A node's tags say where it is.** For one of the instance's own nodes, add-to-concept writes the `n` tag naming the set it links, and remove-from-concept takes out the `n` naming a set it unlinks (story 22, AC9), so that the node's tags say where it is, as the letter `export nostr` sends will, and as an instance that pulls this owner's class thread follows them. A reinstall links from a `z` tag, never from an `n` (corrected at Architecture, 2026-11-18; ADR 0023, Context 4).
- **The write path and the CLI are built.** A10.4 gives a graph write its guards, one transaction with its change entry, and no signing (ADR graph-operations-foundation/0004). The external CLI (A10.6) turns each operation the instance lists into a command, so move-element reaches agents with no change to it.

## User-facing description

As an admin agent rebuilding or tidying a concept graph, or the owner, I want to move an element from one set of a concept to another in one call, such as filing a dog from the dogs concept's superset into its set of hounds, so that the element is never in both sets or in neither, and the call does only the move I asked for.

As the same agent, I want the move refused, with the reason and the way on, when the two sets belong to different concepts, when the element isn't in the set I named, or when the move would change which concepts the element belongs to, so that a move never changes anything but where in its concept the element sits.

## Acceptance criteria

- [ ] **AC1 — Move an element.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/move-element` with `node` (a node's tapestryKey), `from` (the tapestryKey of a set or superset that holds the node directly) and `to` (the tapestryKey of a set or superset of the same concept), then, in one write, the node is directly in `to` and no longer directly in `from`; no reader of the graph sees it in both, or in neither. Either end may be the concept's superset, so a move files an element into a set, or takes it back up to the superset. The node stays an element of the same concepts, and its JSON (its sections and `wordTypes`), its address and tapestryKey, its other memberships and its marked-field node properties stay as they were. The answer gives the node (its tapestryKey, address and name), `from`, `to`, `outcome: moved`, each concept the node is an element of, whether its letter now differs from it, and the change entry, which `graph history` finds by the node and by each set; when the node was already directly in `to` (AC2), by the node, `from` and the concept. `graph list-elements` with `set: to` and `direct` lists the node, and with `set: from` and `direct` no longer does. Nothing is signed or sent to a relay.
- [ ] **AC2 — Safe to repeat.** Given the node is directly in `to` and not directly in `from`, move-element changes nothing, records nothing, and answers `outcome: already-moved` with `change: null`. Given the node is directly in both, the move takes out only the link from `from`. Two calls at once that move one node out of one set make one move: the other call answers `already-moved`, or is refused as AC5's node not in `from` when its `to` differs.
- [ ] **AC3 — Two sets of one concept.** move-element refuses `from` and `to` when no concept but word has both in its class thread (`different-concepts`): nothing changes, no entry is recorded, and the refusal names the concepts each set belongs to, and says how to go on: `graph add-to-concept` with the other concept and its set, then `graph remove-from-concept`.
- [ ] **AC4 — The node's concepts stay the same** (open question 1). move-element refuses a move that would take the node out of a concept, because `from` is also in another concept's class thread that `to` isn't and nothing else of that concept reaches the node, or put it into a concept it isn't in, because `to` is also in another concept's class thread. The refusal names that concept and says how to go on: `graph remove-from-concept`, or `graph add-to-concept` with that concept's section. Nothing changes and no entry is recorded. No concept keyed `word` or `graphContext` is counted, as AC3 counts no word and D9 counts none. So a move never adds or takes out a section, never needs the node's JSON checked against a schema again, and can never leave a node of no concept (D9).
- [ ] **AC5 — What it refuses.** move-element refuses each of these, changes nothing, records no entry, and says in words what was wrong, naming the input, and the operation to use where there is one:
  - a `node`, `from` or `to` that names no node; a `from` or `to` that is neither a set nor a superset (for a concept header, the refusal names its superset's tapestryKey, the key to pass); and a `to` that is `from` (open question 2);
  - a node another operation looks after (`made-elsewhere`: a concept header or core node, a schema, a property, a set or superset, which link-set and unlink-set move, or a graph rule), and a tag or a change entry, which is part of a letter or of the history and no element;
  - a node that `from` doesn't hold directly, when `to` doesn't either: the refusal names the sets of the concept that hold the node directly, so the caller can name the right one, or says the node isn't an element of the concept, and names `graph add-to-concept` (open question 2);
  - a link from `from` that isn't the owner's claim (open question 3): one the node's author's letter claims (`author-claim`, its `n` naming `from`), or one firmware's definition makes (`firmware-membership`), as remove-from-concept refuses them, naming whose claim it is;
  - sets of different concepts (AC3), and a move that changes the node's concepts (AC4).
- [ ] **AC6 — Anyone's node.** move-element takes any node add-to-concept takes: one of the instance's own, one that points at another author's event, a person node, a placeholder, or one of firmware's own elements, as long as the link from `from` is the owner's claim (AC5). For one of the instance's own nodes, its tags follow the move, so they name `to` and no longer `from`, and the answer says when its letter, which names `from`, now differs from the node, until `export nostr` (A10.34) sends a new one. Another author's letter, or firmware's definition, is never written.
- [ ] **AC7 — It lasts, and it reaches agents.** After a backup restored on a fresh instance, a node moved by this operation is directly in `to` and not directly in `from` (BIBLE §30). After a firmware reinstall it is still directly in `to`, unless `to` is the concept's superset and another set of the concept holds it, and it is not directly in `from`, unless `from` is the concept's superset and the node's `z` names the concept: a reinstall can make or take out a superset's direct link to a node a set of its concept holds (ledger rows `2026-11-16-wire-implicit-prune-depends-on-run` and `2026-11-16-prune-drops-superset-has-element`). Its concepts and its sets are the same either way. The operation is for the owner and admins: a caller who isn't signed in is refused with 401, and a signed-in person who is neither with 403. It is listed for agents and has its `/docs` entry, both made from its declaration. Someone with a shell inside the instance runs `tapestry graph move-element --node <key> --from <key> --to <key>` with no sign-in and gets the route's answers, and its entries name the command as who made them. On a scratch stack, an admin agent with its own key, through the external CLI (A10.6) and with no change to it: moves an element create-element made from its concept's superset into a set, moves it again and is told it already moved, moves it on to a second set, and is refused sets of different concepts and a `from` that doesn't hold the node.

Seven criteria, for one operation. Most of what it reads, the class thread, whose claim a link is and the node's tags, is story 22's, so the story stays one reviewable change.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`); it differs on every instance, so it is never written into code.

- Any concept, through its header, superset and sets (read): the concept both sets belong to, and any other concept whose class thread holds one of them.
- `39998:<TA>:superset` and `39998:<TA>:set` — superset and set (read): `from` and `to` may be either.
- `39998:<TA>:word` — word (read): its class thread holds nearly every set, so it never counts as the concept two sets share (AC3).
- `39998:<TA>:concept-header`, the seven core-node concepts, `39998:<TA>:set`, `39998:<TA>:property` and `39998:<TA>:graph-rule` (read): their elements are another operation's, refused as the node (AC5).
- Firmware's concepts (read): firmware's own memberships stay as its definition makes them (AC5).
- No firmware concept's definition changes.

## Out of scope

- **Moving a node to another concept,** or into a set that would add or take away a concept (open question 1): `graph add-to-concept` and `graph remove-from-concept` (A10.22) do it in two calls, with the section the new concept asks for.
- **Moving a set** under another parent: `graph link-set` and `unlink-set` (A10.28).
- **Moving many elements in one call** (catalog §10, question 6): one node and one move per call.
- **An element's order within a set** (catalog §10, question 7).
- **Counting the owner's claims in reads,** as story 22 left it: a read judges a relationship by the node at its other end (ADR 0011).
- **Install's prune passes** (ledger rows `2026-11-16-prune-drops-superset-has-element` and `2026-11-16-wire-implicit-prune-depends-on-run`): fixing them is those rows' work.
- **Today's delete-relationship and add-to-set routes,** which stay as they are (D15).
- **Publishing the move** as nostr events (`export nostr`, A10.34). A move made here is a private thought until then (BIBLE §30).
- **Naming a node or a set by its name or address:** each input takes a tapestryKey, and an agent calls `graph resolve` (A10.9) first.
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

Resolved at this gate. Each carried the drafting's proposal, for the owner to confirm or change; the owner approved the story as drafted, with all three (2026-11-18).

1. **What may a move change?** *Resolved: only which sets of the concept hold the node. The node's concepts stay the same, so its JSON, its sections, `wordTypes` and its marked fields stay as they are, and a move that would take it out of a concept or put it into one is refused, naming that concept and the way on* (the drafting's proposal, approved by the owner, 2026-11-18). AC4. This reads the catalog's "between two sets of the same concept" strictly, and it keeps the operation small: links and tags only, no section written and no schema check. On the local instance every set has one parent, so the refusal comes up only once sets are shared or one concept is made a kind of another. The other choice is a move that is add-to-concept and remove-from-concept in one step, with their sections, schema check and refusals, so that it can also move a node across concepts; that is a larger story, and the two calls already do it.
2. **Which link does `from` name?** *Resolved: a set or superset that holds the node directly. A node `from` reaches only through a set below it is refused, naming the set it is directly in; and `to` equal to `from` is refused as a move of nothing* (the drafting's proposal, approved by the owner, 2026-11-18). AC5. Taking out only the one link named keeps the move exact. The other choice is remove-from-concept's reading, the links from `from` and from the sets below it, which can take out more than one link in a call meant to move one.
3. **Whose links may it move?** *Resolved: the owner's own, on any node add-to-concept takes; a link the node's author's letter claims, or firmware's definition makes, is refused, as remove-from-concept refuses it* (the drafting's proposal, approved by the owner, 2026-11-18). AC5, AC6. The next import or a reinstall would put such a link back, so the move would not last (AC7), and whether a peer's claim counts is each point of view's call (D4; CLAUDE.md principles 2 and 3).

**Changed at Architecture** (the owner's approval of ADR 0023, Option A, 2026-11-18): the background's seventh fact is corrected (a reinstall links from a `z` tag, never an `n`); AC7 says what a reinstall can do to a superset's direct link to a node a set of its concept holds; AC4 counts no concept keyed `word` or `graphContext`; and AC1 says what `graph history` finds a move by when the node was already in `to`. The other choice, Option C, would have changed install's pass 1d so AC7 held as first written; the owner kept install out of this story's scope.

For Architecture, not this gate:

- **How "the same concept" is found** when word's class thread holds nearly every set, and what to make of `graphContext`, whose key is reserved too.
- **Which locks the write takes,** so that two moves of one node go one at a time, and so does a move beside an add-to-concept, remove-from-concept, update-node or delete-node of the same node.
- **What it reuses from story 22** (`_memberships.js`: the class-thread reads, whose claim a link is, the node's facts and the tags), and whether D9's rule needs to be a guard at all when AC4 keeps the node's concepts.
- **The node's tags:** which `n` tags change on one of the instance's own nodes, what happens to a node kept beside another author's letter (no tags of the owner's to change), and what the letter and the derive step's cached copy say afterwards.
- **A move to the superset of a node a set of the concept still holds,** which install's prune would take out on a firmware concept (ledger row `2026-11-16-prune-drops-superset-has-element`), and what AC7's "it lasts" means there.
- **The answer's and the change entry's shapes,** and the refusals' codes and statuses.

## Deviations

*(filled in Implementation)*

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Rebuild bullet)
- Epic: [engineering-team/epics/graph-operations-first-slice.md](../../epics/graph-operations-first-slice.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D1–D4, D9, D13, D15); catalog §2, Nodes
- The sibling stories it builds on: [22-add-to-concept-and-remove-from-concept.md](./22-add-to-concept-and-remove-from-concept.md), [28-link-set-and-unlink-set.md](./28-link-set-and-unlink-set.md)
- The write path it goes through: [stories/graph-operations-foundation/4-the-write-path.md](../graph-operations-foundation/4-the-write-path.md)
- The external CLI the agent uses: [stories/graph-operations-foundation/6-external-cli-and-agent-skill.md](../graph-operations-foundation/6-external-cli-and-agent-skill.md)
- ADR: [engineering-team/decisions/graph-operations-first-slice/0023-move-element.md](../../decisions/graph-operations-first-slice/0023-move-element.md)
- Test plan: [23-move-element.test-plan.md](./23-move-element.test-plan.md)
- Review: *(Review)*
