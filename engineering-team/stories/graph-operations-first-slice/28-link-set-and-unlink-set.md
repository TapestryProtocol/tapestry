# Story 28: `graph link-set` and `unlink-set` — put a set under another parent, or take it out from under one

**Status:** Approved
**Created:** 2026-11-15
**Type:** Feature
**Loom:** A10.28 — https://loom.brainstorm.world/t/A10.28

## Background

Loom's A10.28 asks for two graph writes (catalog §2, Sets):

- **`graph link-set`:** "Put an existing set, or a concept's superset, under another parent", taking `set` and `parent` and answering "the link". It "refuses a cycle".
- **`graph unlink-set`:** "Take a set out from under one of its parents", taking `set` and `parent` and answering "removed". It "refuses the set's last parent".

P-149 left an admin-callable class-link route for later, and Loom says "this task and A10.29 are that route". A10.29, `graph add-relationship` and `remove-relationship`, is built (story graph-operations-foundation #4), and it refuses the class thread's link as a type reserved for these two operations. Done, for Loom, is when "each is declared once; answers at `/api/tapestry/graph/<operation>` for the owner and admins; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI."

Ten facts about today's instance shape the story:

- **A class thread is a chain of links.** A concept's header points to its superset (`IS_THE_CONCEPT_FOR`), the superset to its sets and each set to the sets below it (`IS_A_SUPERSET_OF`, the class thread's propagation link), and a superset or a set to its elements (`HAS_ELEMENT`). A node is an element of a concept when the concept's class thread reaches it (BIBLE §10, rule 3). A set may have more than one parent (protocols/drafts/class-thread-relationships.md, multi-parent semantics), so one set's elements can belong to more than one concept.
- **A superset under another concept's set is a class link.** Putting the superset of Dogs under Mammals' superset, or under one of Mammals' sets, makes every element of Dogs an element of Mammals: Dogs becomes a kind of Mammal. Today's link-concepts makes the first of these.
- **Today's link-concepts signs.** `POST /api/normalize/link-concepts` finds both concepts by name, taking the first header whose names match, signs a relationship event, stores it in the instance's relay, and only then adds the link. It refuses a link that is already there, with `success: false` and status 200. It doesn't check for a cycle.
- **Today's primitives check nothing.** `POST /api/normalize/add-relationship` adds the propagation link between any two nodes by uuid, without signing, and without checking that the ends are a set and a parent or that the link makes no cycle. `POST /api/normalize/delete-relationship` removes one without checking whether the set keeps a parent. Both answer with a note that a firmware install can undo them.
- **The new stack keeps the link for these two operations.** `graph add-relationship` and `remove-relationship` refuse `IS_A_SUPERSET_OF` as `reserved-type`, "made by graph link-set and create-set" (rule `relationship-type-allowed`, docs/GRAPH_RULES.md §2). Until link-set lands, no operation of the new stack can put an existing set under another parent.
- **Sets come in two kinds today.** `POST /api/normalize/create-set` signs a set event whose `s` tag names its parent. `POST /api/normalize/add-subset` makes a set with no event, under a superset or a set, and registers it under the set concept. Either kind can be linked; only the first has a letter that names a parent.
- **Another author's links are recorded as theirs.** When the instance pulls a shared concept's class thread, it records the links its author's events claim (their sets' `s` tags), and never one whose parent is in the instance's own part of the graph (BIBLE §23, the trust gate). Under D4 the instance records a peer's claims, the point of view decides at read time whether they count, and repair never edits a peer's node.
- **Firmware rebuilds its own class threads.** A firmware install wires each firmware concept's sets as its built-in definition says, then takes out a link from a firmware concept's superset straight to a set that is also below it through another set, as redundant. So a reinstall puts back a firmware link that was taken out, and takes out such a direct link that was put in.
- **The write path is built.** A10.4 gives a graph write its guards, one transaction with its change entry, and no signing (ADR graph-operations-foundation/0004). Its rules are each defined once and used two ways, as guards and in `rules check` (D3; A10.31 builds the check), and each is written into docs/GRAPH_RULES.md.
- **Agents already have a way in.** The external CLI (A10.6) turns each operation the instance lists into a command, so these two reach agents with no change to it.

## User-facing description

As an admin agent rebuilding a concept graph, or the owner, I want to put an existing set under another parent, so that a set can sit in more than one part of a class thread, and so that one concept can be made a kind of another, without signing anything.

As the same agent, I want to take a set out from under one of its parents, so that I can reorganize a class thread without deleting and remaking the set.

As the same agent, I want either one refused, with the reason, when it would make a set a subset of itself or leave a set under no parent, so that every class thread stays one that every reader of the graph can walk.

## Acceptance criteria

- [ ] **AC1 — Link a set.** Given the owner or an admin is signed in, when they call `POST /api/tapestry/graph/link-set` with `set`, the tapestryKey of a set or of a concept's superset, and `parent`, the tapestryKey of a superset or a set, then `set` is directly under `parent`: one link from `parent` to `set`. The class thread of every concept that reaches `parent` now reaches `set`, the sets below it and their elements, which become elements of those concepts too. `set` keeps its other parents. The answer gives the link (`set` and `parent`), `outcome: linked` and the change entry, and `graph history` finds the entry by either node. Nothing is signed or sent to a relay.
- [ ] **AC2 — Safe to repeat.** Given `set` is already directly under `parent`, link-set changes nothing, records nothing, and answers `already-linked` with `change: null`. Two calls at once make one link.
- [ ] **AC3 — What link-set refuses.** link-set refuses each of these, changes nothing, records no entry, and says in words what was wrong, naming the input:
  - a `set` or `parent` that names no node of the graph;
  - a `set` that is neither a set nor a superset: a concept header, an element, any other node. For a concept header, the refusal names its superset's tapestryKey, the key to pass;
  - a `parent` that is neither a superset nor a set;
  - a cycle: `parent` is `set` itself, or is already below `set` in the class thread, through any number of links and across concepts. The refusal names the chain of sets from `set` down to `parent`.
- [ ] **AC4 — Unlink a set.** Given the owner or an admin is signed in, and `set` is directly under `parent` and under at least one other parent, when they call `POST /api/tapestry/graph/unlink-set` with `set` and `parent`, then the link from `parent` to `set` is gone and `set` stays under its other parents. An element that `parent`'s concepts reached only through that link is no longer one of their elements. The answer gives the link, `outcome: unlinked` and the change entry. When the set's own letter names `parent` (a set today's create-set signed), the answer says the letter no longer matches (open question 1). Given `set` isn't directly under `parent`, unlink-set changes nothing, records nothing, and answers `already-unlinked` with `change: null`. Nothing is signed or sent to a relay.
- [ ] **AC5 — What unlink-set refuses.** unlink-set refuses each of these, changes nothing, records no entry, and says in words what was wrong, naming the input:
  - a `set` or `parent` that names no node, a `set` that is neither a set nor a superset, and a `parent` that is neither a superset nor a set, as link-set refuses them;
  - the set's last parent: `parent` is the only parent `set` has, so no class thread would reach it or its elements. The refusal names that parent and says how to go on: link the set under another parent first, or delete it once it is empty (`graph delete-set`, A10.17). A concept's superset has no last parent to keep, since it stays its concept's superset: unlinking it from its last parent is allowed, and its concept stops being a kind of the other.
- [ ] **AC6 — The links these operations leave alone** (open questions 1 and 2). unlink-set refuses each of these, naming what makes the link and changing nothing:
  - a link another author's event claims (a peer's set under the parent its event names), since the instance records a peer's claims as theirs (D4) and the next pull would record it again; whether it counts is decided per point of view;
  - a link the firmware makes, since a firmware reinstall puts it back; lifecycle seed-firmware (A10.37) is how firmware changes.

  link-set refuses a link from a firmware concept's superset straight to a set that is already below it through another set, since a reinstall takes that link out as redundant; the set's elements already belong to that concept. The owner's own links stay theirs to make and take out, whoever's sets they join, and putting the owner's own sets or concepts under a firmware concept stays allowed.
- [ ] **AC7 — The two rules, defined once.** No cycle in a class thread, and no set under no parent, are each defined once: as link-set's and unlink-set's guards and, run over a given set of links or sets, as a check that names each one that breaks it, for `rules check` (A10.31). Each is written into the rules document (docs/GRAPH_RULES.md) with what it says, that it refuses a write, and how a check finds what breaks it. The class thread anomaly (BIBLE §10, rule 9) is an element, not a link, and breaks neither.
- [ ] **AC8 — It lasts, and it reaches agents.** A link made or taken out by these operations is as it was after a firmware reinstall, and after a backup restored on a fresh instance (BIBLE §30). Both operations are for the owner and admins: a caller who isn't signed in is refused with 401, and a signed-in person who is neither with 403. Each is listed for agents and has its `/docs` entry, both made from its declaration. Someone with a shell inside the instance runs `tapestry graph link-set --set <key> --parent <key>` and `tapestry graph unlink-set --set <key> --parent <key>` with no sign-in and gets the route's answers, and their entries name the command as who made them. On a scratch stack, an admin agent with its own key links a set, links it again, is refused a cycle, unlinks the set, and is refused its last parent, through the external CLI (A10.6) with no change to the CLI.

Eight criteria, covering two operations that share their inputs, their reading of the class thread and the two rules. They stay one story because Loom pairs them and each one's refusals are the other's undo. If the change proves too big to review in one sitting, unlink-set (AC4 to AC6) can become a story of its own.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`); it differs on every instance, so it is never written into code.

- `39998:<TA>:class-thread` — class thread (read): the pattern both rules keep whole.
- `39998:<TA>:superset` — superset (read): a `set` or a `parent` may be a concept's superset, the top of its class thread.
- `39998:<TA>:set` — set (read): a `set` or a `parent` may be a set; add-subset registers its sets as elements of this concept.
- `39998:<TA>:relationship-type` — relationship type (read): `IS_A_SUPERSET_OF`, the link these operations make and take out, is one of its firmware elements, kept for them by `relationship-type-allowed`.
- Nothing in this story changes a firmware concept's definition.

## Out of scope

- **Making and deleting sets:** `graph create-set` (A10.27) and `graph delete-set` (A10.17). link-set takes only sets and supersets that exist.
- **Elements:** making a node an element of a concept or a set, taking it out, or moving it (`add-to-concept` and `remove-from-concept`, A10.22; `move-element`, A10.23). Those are `HAS_ELEMENT` links, with a rule of their own (a node's last concept, D9).
- **Checking the elements a link brings in** against the schema of each concept they join (BIBLE §10, rule 4; D9; open question 3). `rules check` (A10.31) reports elements that don't validate.
- **Moving a set from one parent to another in one step.** A link and then an unlink do it, and neither leaves the set under no parent.
- **Taking out redundant links** (a direct link to a set already below the parent through another set). Today's `prune-superset-edges` route stays as it is.
- **Naming a set by its name or address** (`graph resolve`, A10.9): both inputs take tapestryKeys.
- **Publishing a link,** or a set's new parent, as nostr events (`export nostr`, A10.34). A link made here is a private thought until then (BIBLE §30).
- **Today's link-concepts, add-relationship, delete-relationship, create-set and add-subset routes,** which stay as they are (D15).
- **Bulk links** (catalog §10, question 6): one link per call.
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

To resolve at this gate. Each carried the drafting's proposal, for the owner to confirm or change; the owner approved the story as drafted, with all three (2026-11-15).

1. **Which links may unlink-set take out?** *Resolved: the owner's own, with or without a letter, but not a peer's or the firmware's* (the drafting's proposal, approved by the owner, 2026-11-15). AC4, AC6. A link another author's event claims stays (D4): the next pull would bring it back, and whether it counts is the point of view's call (CLAUDE.md principles 2 and 3). A link the instance's own letter claims (a set today's create-set signed names its parent in its `s` tag) is taken out, the node first and the letter later on purpose (D2): the answer says the letter no longer matches, and `export nostr` (A10.34) is what sends a new one. This mirrors what story 16 proposes for update-concept.
2. **What about firmware's class threads?** *Resolved: leave the firmware's own links alone, and allow everything else* (the drafting's proposal, approved by the owner, 2026-11-15). AC6. unlink-set refuses a link the firmware makes, and link-set refuses the one link shape a reinstall takes out (a direct link from a firmware concept's superset to a set already below it), so every link these operations make or take out lasts (AC8). Putting the owner's sets or concepts under a firmware concept stays allowed, such as relationship types of the owner's own under the relationship type concept. The other choice, refusing any link that touches a firmware concept, would stop the owner from declaring relationship types through a set of their own.
3. **Should link-set check the elements a link brings into another concept?** *Resolved: no* (the drafting's proposal, approved by the owner, 2026-11-15). `rules check` (A10.31) reports an element that doesn't validate against a concept it belongs to (BIBLE §10, rule 4, whose intentional violations include work in progress). Refusing would make every link wait on every element it brings in being right first, and the catalog's row refuses only a cycle.

For Architecture, not this gate:

- **What counts as a set and a superset** for the inputs: a node's label (`Set`, `Superset`), its being an element of the set or superset concept, its being in some class thread, or a mix; and what to make of a set already in the graph that is under no parent.
- **How to tell a link the firmware makes, or one a peer's event claims, from one the owner made:** by the set's event and its `s` tag, a relationship event naming the pair, or the firmware's built-in definition; and what to do with a link that more than one of them claims.
- **How a cycle is found and named:** how deep today's class threads go, whether the walk is bounded, and what the refusal says when the chain is long.
- **Two writes at once:** two link-sets that together would make a cycle, and two unlink-sets that together would take out a set's last two parents, must not both pass their guards.
- **Whether the two rules are one file or two,** and their names.
- **The change entries' shape:** a link made or taken out, as `type`, `from` and `to`, as add-relationship's entries record it.
- **What a letter that no longer matches means** when today's import brings the old letter in again (open question 1).

## Deviations

Small judgment calls made in Implementation, inside ADR 0028:

- **`_sets.js` holds a few things beside Decision 2's functions,** so the two declarations state each once: `requireEnds` (Decision 1's steps 1 and 2), `isLinked` (the repeat's read, through R3), `say` (the wording of `not-a-set` and `not-a-parent`), and the shapes `NOT_A_SET`, `NOT_A_PARENT` and `LINK`.
- **`ancestors` takes an optional `nodes` map** that collects each parent's uuid, name and labels from R3's rows. The cycle message names the chain with it, and `firmwarePrunes` tells a superset from a set with it, with no read per node.
- **`firmwarePrunes` answers `[{ parent, set, isNew }]`.** `isNew` marks the new link itself, so the refusal tells shape 1 (this link) from shape 2 (an earlier link).
- **unlink-set answers `already-unlinked`, with no change, when its `DELETE` removes nothing,** because a concurrent unlink took the link first. Decision 1 says the same of link-set's `MERGE`, through `relationshipsCreated`, and nothing of unlink-set's.
- **The `cycle` message reads the same as a guard and as a check** ("X under Y makes a cycle…"), since the rule's items don't say which they are. `last-parent` names the parent being left as a guard, and only the set as a check, as Decision 4 words them.
- **`firmware-link` says a reinstall *can* put the link back,** not that it will: part (a)'s links come back only for a set the install newly makes (ADR Context 7).
- **Part (d) reads `headerATag` as install does:** split on `:`, kind 39998, then the curator and the d-tag. It doesn't match a 64-hex pattern.
- **With no assistant key, `firmwareLinks()` answers no links and doesn't cache that,** so a key configured later is used.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Rebuild bullet)
- Epic: [engineering-team/epics/graph-operations-first-slice.md](../../epics/graph-operations-first-slice.md) (made on story 16's branch; this story's line is added once that lands)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D1–D4, D6, D9, D13, D15); catalog §2, Sets
- The write path these go through, and the type it keeps for them: [stories/graph-operations-foundation/4-the-write-path.md](../graph-operations-foundation/4-the-write-path.md); [docs/GRAPH_RULES.md](../../../docs/GRAPH_RULES.md) §2
- The external CLI the agent uses: [stories/graph-operations-foundation/6-external-cli-and-agent-skill.md](../graph-operations-foundation/6-external-cli-and-agent-skill.md)
- The sibling story in this epic: stories/graph-operations-first-slice/16-create-concept-and-update-concept.md (on story 16's branch)
- ADR: [engineering-team/decisions/graph-operations-first-slice/0028-link-set-and-unlink-set.md](../../decisions/graph-operations-first-slice/0028-link-set-and-unlink-set.md)
- Test plan: [28-link-set-and-unlink-set.test-plan.md](./28-link-set-and-unlink-set.test-plan.md)
- Review: (filled in after Review phase)
