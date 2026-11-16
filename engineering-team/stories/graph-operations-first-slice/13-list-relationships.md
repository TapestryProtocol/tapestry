# Story 13: `graph list-relationships` — a node's typed relationships, in and out, each with the way it points

**Status:** In Progress
**Created:** 2026-11-16
**Type:** Feature
**Loom:** A10.13 — https://loom.brainstorm.world/t/A10.13

## Background

Loom's A10.13 asks for one graph read (catalog §1, Graph reads): **`graph list-relationships`**, "a node's typed relationships, in and out", taking `node`, `type?` and `direction?` and answering the relationships. Loom adds that "the new read returns each relationship's direction". Done, for Loom, is when "it is declared once; answers at `/api/tapestry/graph/list-relationships` for the owner and admins; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI."

Ten facts about today's instance shape the story:

- **Today's route doesn't say which way a relationship points.** `GET /api/concept-graph/node/:handle/neighbors` (not in /docs) finds a node by its nostr address, matches its relationships in both directions, and answers the nodes at their other ends grouped by type. BIBLE §11 warns that its answer "carries **no direction**": a superset's `HAS_ELEMENT` group lists its own elements together with the relationship that makes it an element of the `superset` concept. It leaves out tag nodes (next fact). It has no paging and no point of view, and visitors can call it.
- **Most nodes have a tag node for each tag of their letter.** The nostr import makes one for each tag of an event, joined to the event's node by `HAS_TAG`. A node with no event gets the tag nodes of the letter its write would sign, so it reads like an imported one (ADR graph-operations-first-slice/0016, Decision 1). A tag node has a type and a value but no name.
- **Which way a relationship points is what it means.** The class thread runs from a concept's header to its superset, from a set to the sets below it, and from a superset or a set to its elements (BIBLE §6). `graph add-relationship` and `graph remove-relationship` name a relationship by `from`, `to` and `type` (story graph-operations-foundation #4).
- **A node can have many relationships, of many types.** The local instance (2026-11-16) holds 9,549 nodes and about 11,000 relationships of 16 types: 7,325 `TAGS` from the event-tagging pipeline, 2,779 `HAS_TAG` to tag nodes, 527 `HAS_ELEMENT`, and most of the rest the class thread and a concept's core-node wiring. The trust pipeline gives a person's node one `FOLLOWS` for each account they follow, so one node can carry thousands.
- **Two relationships can share a type, two nodes and a direction.** The event-tagging pipeline makes one `TAGS` for each tag one person applies to another. They differ only in what each records about itself: the tag, its polarity, and the address of the event that applied it.
- **No relationship records its author.** A node records its author as `pubkey`, and the read conventions judge a node by it (ADR graph-operations-first-slice/0011, C2). A relationship records no author. Only `TAGS` records the event it came from. The relationships the instance wires itself, through today's signing routes, the firmware install or the new graph writes, record nothing about who made them, though each new graph write records which admin made it in its change entry. ADR 0011 left "how the authors of edges count" to `graph walk` (A10.14). This read is the first to face it, so walk and `graph describe-node` (A10.10) will follow the answer.
- **The read conventions exist.** A read that answers a list pages with `limit` and a cursor bound to its list. A read that can include other authors' nodes takes `pov`, the owner's point of view by default or `everyone`, and says how many items it kept and left out. A node is answered with five facts: tapestryKey, name, address, author and whether it is the instance's own (catalog, Conventions; ADR 0011).
- **Every input that names a node takes its tapestryKey** (catalog, Conventions). `graph resolve` (A10.9), built at the same time in another session, will turn a name or slug into one.
- **Reads stay behind sign-in, and write nothing.** The book's frame: "Until read visibility is decided (catalog §10, question 1), the new read routes require an owner or admin sign-in." `graph list-elements` and `graph history` open no write transaction and record no change entry.
- **Agents already have a way in.** The external CLI (A10.6) turns each operation the instance lists into a command, so this one reaches agents with no change to it.

## User-facing description

As an admin agent exploring or rebuilding a concept graph, or the owner, I want to list a node's relationships, the ones that run from it and the ones that run to it, each saying which way it points, so that I can see what a node is wired to without writing Cypher or guessing directions.

As the same agent, I want to narrow the list to one type or one direction, and to page through a node that has thousands, so that I get the relationships I'm after.

As the same agent, I want the list read from a point of view, the owner's unless I ask for another, so that relationships to nodes made by untrusted authors don't count, and I'm told how many were left out.

As whoever builds `graph walk` and `graph describe-node`, I want how a relationship is answered and how a point of view judges it settled once, so that every relationship read answers the same way.

## Acceptance criteria

- [ ] **AC1 — A node's relationships, in and out.** Given the owner or an admin is signed in, when they call `GET /api/tapestry/graph/list-relationships` with `node`, a node's tapestryKey, then the answer lists every relationship that runs from the node and every one that runs to it, of any type. With `type`, it lists only that type's. With `direction=out`, it lists only those that run from the node; with `direction=in`, only those that run to it; `both` is the default. The answer gives the node it listed, with the five facts the read conventions answer a node with, and the type, direction and point of view it listed by. A node with no relationships, or none that match, answers an empty list, and so does a type no relationship has.
- [ ] **AC2 — Each relationship, answered, with the way it points** (open question 2). Each relationship comes with its type; its direction, `out` when it runs from the node asked about and `in` when it runs to it; the tapestryKeys of the node it runs from and the node it runs to, under the names `graph remove-relationship` takes (`from`, `to`, `type`); the node at its other end, with the five facts; and what the relationship records about itself. Two relationships of one type between the same two nodes, running the same way, are each listed.
- [ ] **AC3 — Page by page.** A page holds at most `limit` relationships (1 to 200, 50 by default), in a stable order, with a cursor for the next page that is null on the last. Passing each page's cursor in turn answers every relationship exactly once, those that share a type, two nodes and a direction included. A relationship added or taken out between two pages doesn't make any other appear twice or go missing. A `limit` out of range is refused, naming `limit`. A cursor that isn't one this read gave, for the same node, type, direction and point of view, is refused.
- [ ] **AC4 — From a point of view: the owner's, by default** (open question 1). With no `pov`, a relationship counts when the node at its other end counts by the read conventions' test: it has no author, or its author is the instance's own, or the owner's web of trust scores its author above the verified cutoff. The node asked about is never left out, since the caller named it. The answer says how many relationships the point of view kept and left out, across the whole list and not just the page, and says when the owner's scores don't exist yet. `pov=everyone` keeps every relationship. Nothing about a point of view is stored: the same graph, read from another point of view or after the owner's scores change, answers differently with no write in between. A `pov` the instance can't read from is refused, saying which points of view it can.
- [ ] **AC5 — What it refuses.** list-relationships refuses each of these, changes nothing, and says in words what was wrong, naming the input:
  - no `node`, or a `node` that names no node of the graph (a change entry is not one);
  - a `node` that isn't a tapestryKey, a `type` that isn't a plain type name (letters, digits and underscores, starting with a letter), and a `direction` other than `out`, `in` or `both`;
  - an input the read doesn't take.
- [ ] **AC6 — A read, behind sign-in, that agents can use.** list-relationships writes nothing: no change, and no change entry. A caller who isn't signed in is refused with 401, and a signed-in person who is neither the owner nor an admin with 403. It is listed for agents and has its `/docs` entry, both made from its declaration. Someone with a shell inside the instance runs `tapestry graph list-relationships --node <key>` with no sign-in and gets the route's answers. On a scratch stack, an admin agent with its own key lists a node's relationships page by page, then by type and by direction, through the external CLI (A10.6) with no change to the CLI.
- [ ] **AC7 — The convention for relationship reads, written once.** How a relationship is answered (AC2) and how a point of view judges it (AC4) are each defined once, beside the read conventions, and written into the catalog's Conventions, so `graph walk` (A10.14) and `graph describe-node` (A10.10) answer and judge relationships the same way. Today's neighbors route keeps answering as it does.

Seven criteria, for one read. AC7 is what makes this story the pattern for the relationship reads after it, and it adds no behavior of its own.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`). It differs on every instance, so it is never written into code.

- `39998:<TA>:relationship-type` — relationship type (read): the types the graph declares. `type` names one, though a relationship of any type the graph holds is listed, declared or not (the trust pipeline's `FOLLOWS` isn't declared).
- `39998:<TA>:relationship` — relationship (not read): the letters today's signing routes sign for the relationships they wire. This read lists the relationships in the graph, not these letters, and nothing in the graph links one to the other.
- `39998:<TA>:class-thread` — class thread (read): its relationships are the ones BIBLE §11's warning is about.
- `39998:<TA>:nostr-user` — nostr user (read): the authors whose trust the owner's point of view weighs, and the nodes whose `FOLLOWS` and `TAGS` relationships can number thousands.
- `39998:<TA>:web-of-trust` and `39998:<TA>:graperank` — the owner's web of trust and its scores (read): what decides whether the node at a relationship's other end counts.
- Nothing in this story changes a firmware concept's definition.

## Out of scope

- **More than one hop,** and several types at once: `graph walk` (A10.14) takes `types` and a depth.
- **Anything more about the node asked about or the nodes at the other ends:** their fields, concepts and where they came from (`graph describe-node`, A10.10).
- **Recording who made a relationship** (provenance, design doc §5, question 2). This read changes no write.
- **Naming a node by its name, slug or address** (`graph resolve`, A10.9): `node` takes a tapestryKey.
- **Points of view besides the owner's and everyone's** (ADR 0011, debt 2).
- **Letting visitors read** (catalog §10, question 1).
- **Today's neighbors route,** which stays as it is (D15).
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

To resolve at this gate. Each carried the drafting's proposal, for the owner to confirm or change; the owner approved the story as drafted, with all three (2026-11-16). Each binds `graph walk` and `graph describe-node` too (AC7).

1. **Which relationships count from a point of view.** *Resolved: the node at the other end decides, by the read conventions' test, as list-elements judges an element; the node asked about is never left out* (the drafting's proposal, approved by the owner, 2026-11-16). AC4. No relationship records its author, so the node at the other end is the one claim the read can judge, and it is a node the read answers anyway. A set's `HAS_ELEMENT` relationships out then keep the elements list-elements keeps. When relationships come to record who made them (provenance), the test can widen to judge that as well, with no change for callers. Other choices: both ends must count, so an untrusted node's relationships are all left out; or no point of view at all, with each other end's author shown for the caller to judge.
2. **What each relationship is answered with.** *Resolved: its type; its direction (`out` or `in`, from the node asked about); `from` and `to`, ready to pass to `graph remove-relationship`; the node at the other end with its five facts; and what the relationship records about itself, which for most is nothing (a `TAGS` records its tag, its polarity and its event's address). `direction` takes `out`, `in` or `both`, `both` by default* (the drafting's proposal, approved by the owner, 2026-11-16). AC1 and AC2. Without what a relationship records, two `TAGS` between the same two people would look alike. Other choices: leave what a relationship records to `describe-node`; or leave out `from` and `to`, since the direction and the node asked about give them.
3. **Tag nodes.** *Resolved: with no `type`, relationships to tag nodes are left out, as today's neighbors route leaves them out, and the answer says how many; with a `type`, such as `HAS_TAG`, they're listed* (the drafting's proposal, approved by the owner, 2026-11-16). AC1. Most nodes have one tag node for each tag of their letter, each with no name, so they would crowd out the relationships an agent looks for. Other choice: list them like any other relationship.

For Architecture, not this gate:

- **Order:** what order relationships come in, and how a cursor tells apart two that share a type, two nodes and a direction. And a relationship from a node to itself.
- **Relationships to nodes with no tapestryKey,** which a cursor can't name.
- **How `type` reaches the query,** since a relationship type can't be a query parameter, and what a page costs on a node with thousands of relationships. Measure it on a scratch stack.
- **The test fakes,** which read relationships of a few named types only, in one direction at a time.

## Evidence

### The live check (Implementation, 2026-11-16, on the code of the implementation commit)

This ran on a throwaway instance from `scripts/scratch-stack.sh`, never a shared or private one.
- **The instance.** It booted from image `agent-memory-tapestry` with this branch's `src/` mounted. The image's `bin/` was identical to the branch's, and its `tapestry` command was linked. The branch's `clients/cli` was copied in, on the instance's own nostr-tools 2.10.4 and ajv 8.18.0, the CLI's versions.
- **Keys.** The instance made its own assistant key at boot. A throwaway owner key, a throwaway admin key for the agent and a peer's key were made inside it, and only their public keys left it.
- **Afterwards** it was removed, with its keys.
- **The calls** went through `docker exec` to `127.0.0.1:7778`, a direct-local caller. The agent's went through the instance's nginx.
- **How each answer was judged.** A script inside the instance compared every list with its own reading of the graph: one undirected match for each node, each relationship's direction from `startNode(r)`, each relationship once by its `elementId`, and the filter and the point of view applied in JavaScript. It made 91 checks, and all passed.

**The seed:**
- `cites`, declared through today's `create-element`, which signed one event: the relay went from 450 to 451.
- live widget, made by `graph create-concept`, with CITES added by `graph add-relationship`: from its header to its superset, from its schema to its header, and from its header to itself.
- A peer's list item, signed by a throwaway key with a `z` tag naming live widget. It was put on the relay (451 to 452), imported (`event-update`) and wired (`wire-implicit-elements`, wired 1), and given a CITES from the header.
- With Cypher: the owner's NostrUser, with two TAGS to the peer's, one to a third person's, and a FOLLOWS to the peer's. Their `createdAt` and `timestamp` are integers.
- With Cypher: a dense hub with 10,000 relationships, 6,000 LINKS out (25 of them parallel to another) and 4,000 CITES in. A quarter of the nodes at their other ends are the peer's.

**By criterion:**
- **AC1: passes.** With no type, live widget's header listed 11 relationships, and left out its 6 to tag nodes as `tagsLeftOut`. With each `direction`, and with `type` CITES (alone and with `in`), `HAS_TAG`, `IS_THE_CONCEPT_FOR` and FOLLOWS, it answered exactly what the graph holds:
  - `HAS_TAG` listed its 6 tag nodes, author-less, with `tagsLeftOut` 0;
  - FOLLOWS, which it has none of, answered an empty list.
- **AC2: passes.** Every relationship came with exactly its six facts.
  - The header's IS_THE_CONCEPT_FOR and CITES to its superset each came as out, from the header to the superset, and the schema's CITES as in.
  - The header's CITES to itself came once, as out, under `both` and `out`, and as in under `in`.
  - The owner's two TAGS to the peer were each listed, told apart by their tags, and a page of 1 parted them.
  - `createdAt` and `timestamp` came as numbers.
- **AC3: passes.**
  - The dense hub paged through at 50 a page: 200 pages, all 10,000 each once (the 25 parallel LINKS twice each), the 6,000 out and then the 4,000 in, in order, with the whole count on every page. A page took 67 ms at the median and 312 ms at most, 14.3 s in all.
  - At 200 a page: 50 pages, 68 ms at the median and 155 ms at most, 3.6 s in all.
  - A page of 1, mostly its counts, took 72 ms at the median, and a page of the header 31 ms. No index was needed.
  - A cursor from another node, or another direction, was refused `invalid-cursor`.
- **AC4: passes.**
  - **Before any score existed:** the owner's point of view answered `scored: false`. It kept none of the owner's 4, and left the CITES to the peer's widget out.
  - **The peer's influence set to 0.2:** kept 3 and left out 1 (the third person's), `scored: true`, and the CITES to the peer's widget was kept.
  - **Then 0.01:** kept 0 and left out 4, and the CITES was left out again. The peer's own node, asked about, was still answered, and the owner's 3 relationships to it counted.
  - **The owner's own pubkey as `pov`** answered exactly as the default did. **`everyone`** kept all 4, and a stranger's pubkey was refused `unknown-pov`.
  - **The dense hub, from the owner's point of view,** kept 7,501 and left out 2,499: the nodes by the peer, at 0.01.
  - The relay, the change entries, the nodes and the relationships were the same before and after the score changes and the reads around them.
- **AC5: passes.**
  - A key no node has, and a change entry's key, got 404 `unknown-node`, naming `node`.
  - No `node` got `missing-input`.
  - A node that isn't a key, a type with a backtick, `direction=OUT`, and limits of 0 and 201 got `invalid-input`, each naming its input.
  - `foo` got `unknown-input`.
- **AC6: passes.**
  - `tapestry graph list-relationships` in the instance answered what the route answered, a refusal included (exit 1).
  - **The admin agent,** with its own key, through nginx and the external CLI:
    - `whoami` answered `admin`;
    - it paged through live widget's header 3 at a time to its last cursor: 4 pages, kept 11, left out 1;
    - it listed the dense hub's 4,000 incoming CITES from everyone's point of view, 200 at a time, in 20 pages;
    - it was refused a key no node has (exit 1, `unknown-node`).
  - A visitor through nginx got 401.
  - Before and after every list-relationships call, the relay held 452 events, and the graph 5 change entries, 13,293 nodes and 13,732 relationships.
- **AC7: passes.** The relationship conventions are C5 and C6 in `src/operations/reads.js`, and the catalog's Conventions state them.

### The suites (Implementation, 2026-11-16)

Each ran on its own on the Mac Studio, never the full `npm test`, with every endpoint dead:

| Suite | Passed |
|---|---|
| `test/operations/graph/list-relationships.test.js` | 26 of 26 |
| `test/operations/reads.test.js` | 21 of 21 |
| `test/operations/graph/list-relationships-agent-through-cli.test.js` | 2 of 2 |
| `test/operations/graph-fake.test.js` | 24 of 24 |
| `test/operations/graph/list-elements.test.js` | 30 of 30 |
| `test/operations/graph/history.test.js` | 8 of 8 |
| `test/operations/graph/list-elements-agent-through-cli.test.js` | 2 of 2 |
| `test/openapi-coverage.test.js` | 13 of 13 |
| `test/admin-action-sweep.test.js` | 9 of 9 |

- **The catalog loads.** A script doing what `test/operations.test.js`'s L1 and L4 check found the repo's catalog loads with no problems (19 operations), and requires no driver, LMDB or Redis module at load.
- **The fakes' new route catches only this read.** No other statement in `src/` opens with a relationship held in a variable to a bare node, which is what the route catches.
- **The full gate** runs in the pull request's CI.

## Deviations

- **`trust(v, keep)` checks that `keep` is a list,** and carries `v` once when `keep` names it too. A caller's slip then fails with a plain error, never a Cypher one. It throws for a kept name that isn't a variable, as ADR 0013 Decision 1 asks.
- **`relationshipOf` throws for a direction other than `out` or `in`,** as `trust` and `nodeColumns` throw for a name that isn't a variable. That is a programming error, never an answer.
- **`run` checks `direction` again, and checks the type again before writing it into Cypher's text,** as it checks `limit` again (list-elements' deviation). The inputs' schemas refuse each first, so these checks are for a caller that skips them.
- **The catalog's `list-relationships` row also says what the read does:** "each with the way it points, from a point of view", as list-elements' row does. ADR 0013 Decision 3 named only its "Takes → returns" column.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Rebuild and "Reads stay behind sign-in" bullets)
- Epic: [engineering-team/epics/graph-operations-first-slice.md](../../epics/graph-operations-first-slice.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D4, D6, D9, D13, D15; §5, question 2; §7, relationship properties); [docs/GRAPH_OPERATIONS_CATALOG.md](../../../docs/GRAPH_OPERATIONS_CATALOG.md) (Conventions, §1, §10 question 1)
- Direction, today: [BIBLE.md](../../../BIBLE.md) §11 (the neighbors route), §6 (the class thread)
- The read conventions this read follows: [11-list-elements.md](11-list-elements.md); [ADR graph-operations-first-slice/0011](../../decisions/graph-operations-first-slice/0011-list-elements-and-the-read-conventions.md)
- The writes that name a relationship by `from`, `to` and `type`: [stories/graph-operations-foundation/4-the-write-path.md](../graph-operations-foundation/4-the-write-path.md)
- The external CLI the agent uses: [stories/graph-operations-foundation/6-external-cli-and-agent-skill.md](../graph-operations-foundation/6-external-cli-and-agent-skill.md)
- ADR: [engineering-team/decisions/graph-operations-first-slice/0013-list-relationships-and-the-relationship-conventions.md](../../decisions/graph-operations-first-slice/0013-list-relationships-and-the-relationship-conventions.md)
- Test plan: [13-list-relationships.test-plan.md](13-list-relationships.test-plan.md)
- Review: (filled in after Review phase)
