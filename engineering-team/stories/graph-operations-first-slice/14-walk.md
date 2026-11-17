# Story 14: `graph walk` — follow chosen relationship types out from one or more nodes, up to a depth, each node reached once with the path that reached it

**Status:** Approved
**Created:** 2026-11-16
**Type:** Feature
**Loom:** A10.14 — https://loom.brainstorm.world/t/A10.14

## Background

Loom's A10.14 asks for one graph read (catalog §1, Graph reads): **`graph walk`**, which follows "chosen relationship types out from one or more nodes, up to a depth". It takes `from`, `types?`, `direction?`, `depth`, `pov?` and `limit`, and answers "each node reached, with the path that reached it". Done, for Loom, is when "it is declared once; answers at `/api/tapestry/graph/walk` for the owner and admins; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI."

Nine facts about today's instance shape the story:

- **Today's route walks everything, both ways, and repeats itself.** `GET /api/concept-graph/subgraph/:handle` (not in /docs) finds one node by its nostr address. It follows every relationship from that node in both directions, leaving out tag nodes, to a depth of 1 by default and 3 at most. It answers a tree in which a node appears once for each way it was reached, and each node's children include the node it was reached from, so every relationship is walked back the way it came. It has no choice of types or direction, no paging and no point of view, and anyone can call it.
- **How a relationship is answered and judged is settled.** ADR graph-operations-first-slice/0013 wrote two conventions for every relationship read, walk among them (C5 and C6, in `src/operations/reads.js`):
  - a relationship is answered with six facts: its type, its direction, `from` and `to`, the node at its other end, and what it records about itself;
  - no relationship records its author, so a relationship counts from a point of view when the node at its other end counts.

  For walk, ADR 0013 adds that a relationship's direction is read from the node a step starts from, that a walk's start nodes are never left out, and that "a walk follows a relationship only to a node its point of view counts". That answers memo #113 on A10.14, which asked how an edge's author is read: it isn't, until relationships record who made them (provenance, design doc §5, question 2).
- **What ADR 0013 left to walk:** "a walk's paths, its order across hops, and whether walk leaves out tag nodes". Its reasons for leaving tag nodes out when no type is named "apply to walk too".
- **The read conventions exist,** set for A10.7 to A10.14 (ADR graph-operations-first-slice/0011). A read that answers a list pages with `limit` (1 to 200, 50 by default) and a cursor. A read that can include other authors' nodes takes `pov`, the owner's point of view by default or `everyone`, and says how many items it kept and left out across the whole list. A node is answered with five facts: tapestryKey, name, address, author and whether it is the instance's own.
- **The graph's shape.** The local instance (2026-11-16, read only) holds 10,446 nodes and 12,032 relationships of 16 types, most of them `TAGS` (7,592) and `HAS_TAG` (3,341). One node has 2,427 relationships.
  - The class thread runs from a concept's header to its superset, from a superset or set to the sets below it, and from either to its elements (BIBLE §6). A concept's elements are two steps from its header, plus one for each set between; the deepest chain of sets here makes that five steps.
  - Every relationship can be walked back the way it came, and a node can have a relationship to itself, so a walk meets cycles at once.
- **Search will walk.** The owner's idea for search (design doc §5, question 7) has two steps: match concept headers by keyword, then "walk the graph, with the walk depending on the nature of the search", for instance to a concept's elements, or to closely related concepts. `graph search` (A10.8) comes after this task, and rerunning Avi's race (A10.40) waits on search and on the rebuild (A10.39).
- **Every input that names a node takes its tapestryKey** (catalog, Conventions). `graph resolve` (A10.9) turns a name, slug or address into one. The declaration hook that would let an input take a name (A10.9.a) isn't built.
- **Reads stay behind sign-in, and write nothing.** The book's frame: "Until read visibility is decided (catalog §10, question 1), the new read routes require an owner or admin sign-in."
- **Agents already have a way in.** The external CLI (A10.6) turns each operation the instance lists into a command, so this one reaches agents with no change to it.

## User-facing description

As an admin agent exploring or rebuilding a concept graph, or the owner, I want to walk out from one or more nodes along the relationship types I choose, in the direction I choose, up to a depth, and get each node the walk reaches once, with how far away it is and the path that reached it, so that I can see what a node leads to (a concept's sets and elements, the concepts near it) without writing Cypher.

As the same agent, I want the walk read from a point of view, the owner's unless I ask for another, so that it never steps onto a node by an untrusted author, and I'm told how many it left out.

As the same agent, I want to page through a walk that reaches many nodes, nearest first, and to be told when a walk reached too far to answer in full, so that I can narrow it.

As whoever builds `graph search` (A10.8), I want to call the same walk from code, so that search's second step walks exactly as the read does.

## Acceptance criteria

- [ ] **AC1 — A walk from one or more nodes.** Given the owner or an admin is signed in, when they call `GET /api/tapestry/graph/walk` with `from`, one or more tapestryKeys, then the answer lists every node the walk reaches within `depth` steps, each once. With `types`, one or more relationship types, it steps only along those, whether the graph declares them or not; with none, along every type (AC3 says what happens to tag nodes). With `direction=out` it steps only along relationships that run from the node it's at; with `in`, only along those that run to it; with `both`, the default, either way. The answer gives the start nodes, each with the five facts, and the types, direction, depth and point of view it walked by. A walk whose start nodes have nothing to follow answers an empty list.
- [ ] **AC2 — Each node reached, with its path** (open question 1). Each node comes with the five facts, how many steps it is from the nearest start node, and the path that reached it: the start node it set out from, then each step in order, as a relationship as the conventions answer one, read from the node the step leaves. The path is a shortest one; when several are as short, the walk gives the same one each time the graph is the same. A walk never steps onto a node it has already reached, so a cycle, a relationship walked back the way it came, or a node's relationship to itself goes no further. A start node is never answered as a node reached: it is among the start nodes.
- [ ] **AC3 — Tag nodes** (carried over from list-relationships). With no `types`, the walk doesn't step onto tag nodes, and the answer says how many it didn't step onto. With `types`, it steps wherever they lead, tag nodes included: `HAS_TAG` leads to them.
- [ ] **AC4 — From a point of view: the owner's, by default.** With no `pov`, a walk steps along a relationship only to a node that counts by the read conventions' test. A node that doesn't count is neither answered nor walked through, so the walk reaches nothing by way of it. The start nodes are never left out, since the caller named them. The answer says how many nodes the walk reached, and how many it didn't step onto because they don't count, across the whole walk and not just the page, and says when the owner's scores don't exist yet. `pov=everyone` steps onto every node. Nothing about a point of view is stored: the same graph, walked from another point of view or after the owner's scores change, answers differently with no write in between. A `pov` the instance can't read from is refused, saying which points of view it can.
- [ ] **AC5 — Page by page, nearest first, within a bound** (open questions 2 and 3). A page holds at most `limit` nodes (1 to 200, 50 by default), nearest first: by how many steps a node is from a start node, then by tapestryKey. Each page has a cursor for the next, null on the last. Passing each page's cursor in turn answers every node the walk reaches exactly once, while the graph doesn't change between pages. A walk stops at a set number of nodes: when it would reach more, it answers every step it could finish within that number, and says it stopped short and how many steps it finished. A cursor this read didn't give, for the same start nodes, types, direction, depth and point of view, is refused. A `depth` or a `limit` out of range is refused, naming it.
- [ ] **AC6 — What it refuses.** walk refuses each of these, changes nothing, and says in words what was wrong, naming the input:
  - no `from`, or a `from` that names no node of the graph (a change entry is not one), saying which;
  - a `from` that isn't a tapestryKey, more start nodes than a walk takes, a `types` entry that isn't a plain type name (letters, digits and underscores, starting with a letter), and a `direction` other than `out`, `in` or `both`;
  - an input the read doesn't take.
- [ ] **AC7 — A read, behind sign-in, that agents and search can use.** walk writes nothing: no change, and no change entry. A caller who isn't signed in is refused with 401, and a signed-in person who is neither the owner nor an admin with 403. It is listed for agents and has its `/docs` entry, both made from its declaration. Someone with a shell inside the instance runs `tapestry graph walk --from <key>` with no sign-in and gets the route's answers. On a scratch stack, an admin agent with its own key walks from a concept's header to its elements, page by page, then by types and by direction, through the external CLI (A10.6) with no change to the CLI. The walk is defined once, so `graph search` (A10.8) can call it from code with the same inputs and get the same answer. Today's subgraph route keeps answering as it does.

Seven criteria, for one read. AC7's last part is what lets search build on walk, and it adds no behavior of its own.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`). It differs on every instance, so it is never written into code.

- `39998:<TA>:relationship-type` — relationship type (read): the types the graph declares. `types` names them, though a walk follows any type the graph holds, declared or not (the trust pipeline's `FOLLOWS` isn't declared).
- `39998:<TA>:class-thread` — class thread (read): the walk an agent takes most, from a concept's header through its superset and sets to its elements.
- `39998:<TA>:nostr-user` — nostr user (read): the authors whose trust the owner's point of view weighs, and the nodes whose `FOLLOWS` and `TAGS` can number thousands.
- `39998:<TA>:web-of-trust` and `39998:<TA>:graperank` — the owner's web of trust and its scores (read): what decides whether a node a walk could step onto counts.
- Nothing in this story changes a firmware concept's definition.

## Out of scope

- **Search** (A10.8): which walks search makes, and how its matches rank. This story only makes the walk callable from search.
- **A direction for each type,** or types to follow at one step and not at another: a walk has one set of types and one direction.
- **Every path to a node,** and the relationships between nodes reached that lie on no node's path. Sending a selection of nodes with all their relationships somewhere is export's (a graph scope, D12).
- **Anything more about the nodes reached:** their fields, their concepts and where they came from (`graph describe-node`, A10.10).
- **`graph class-thread-path`,** a particular walk with a task of its own.
- **Recording who made a relationship** (provenance, design doc §5, question 2). This read changes no write.
- **Naming a start node by its name, slug or address** (the refs hook, A10.9.a): `from` takes tapestryKeys, and an agent calls `graph resolve` first.
- **Points of view besides the owner's and everyone's** (ADR 0011, debt 2).
- **Letting visitors read** (catalog §10, question 1).
- **Today's subgraph route,** which stays as it is (D15).
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

To resolve at this gate. Each carried the drafting's proposal, for the owner to confirm or change; the owner chose the proposal for each of the three, and for `direction`'s default (2026-11-16).

1. **Which path each node comes with.** *Resolved: one path for each node, a shortest one, given whole: the start node, then each step as a relationship as the conventions answer one* (the drafting's proposal, chosen by the owner, 2026-11-16). AC2. A node three steps away comes with three relationships, so an agent never has to piece a path together. Other choices:
   - every path within the depth: a node reached through a busy node can have thousands of paths as short as each other, more than any page holds;
   - only the step that reached it, so a caller rebuilds a path by following the steps back through earlier pages.
2. **The order of the answer, and paging.** *Resolved: nearest first, by steps from a start node and then by tapestryKey, paged with `limit` and a cursor like every read that answers a list* (the drafting's proposal, chosen by the owner, 2026-11-16). AC5. Paging answers every node exactly once while the graph stays as it is. A change between two pages that brings a node nearer, or takes it further away, can move it to a page already read, or show it twice. Other choices:
   - by tapestryKey alone, as list-elements orders nodes: no change between pages moves a node, but the nearest nodes are spread through every page;
   - no cursor, as the catalog's first draft had it: only the nearest `limit` nodes, and a word that more lie beyond.
3. **How far a walk may go.** *Resolved: `depth` from 1 to 10, 1 by default; up to 100 start nodes; and a walk stops at a set number of nodes, which the Architect sets from the live check's timings. A walk that would reach more answers every step it could finish within that number, nearest first, and says it stopped short and how many steps it finished* (the drafting's proposal, chosen by the owner, 2026-11-16). AC5 and AC6. Without such a bound, one walk could read most of the graph on every page: a person's node carries one `FOLLOWS` for each account they follow, and a walk with no `types` steps through them all. Other choices:
   - refuse such a walk, saying how far it got, so the caller narrows it before seeing any of it;
   - no bound but `depth`.

**Carried over from list-relationships** (ADR 0013):
- **`direction`** takes `out`, `in` or `both`, for the whole walk, with `both` the default, as list-relationships takes it, so an agent that knows one read knows the other (chosen by the owner, 2026-11-16). AC1. Other choice: `out` by default, as Loom's "out from" and the class thread's direction suggest (a header leads out to its elements); an agent would pass `both` for a node's whole neighbourhood.
- **Tag nodes** are left out when no `types` are given, and counted (AC3), as the draft shown to the owner said; the owner didn't change it. Most nodes have a tag node for each tag of their letter, each with no name. An `e` or `a` tag node has a `REFERENCES` to the node it points at, so a walk through tag nodes would fill its pages with them and reach other nodes by way of their letters' tags.

For Architecture, not this gate:

- **How a page is answered without storing the walk,** and what a page costs, with the counts read across the whole walk. Measure it on a scratch stack at the size of Avi's brain (946 documents, about 8,000 typed links) and around a node with thousands of relationships, and set the walk's bound from that.
- **Which shortest path,** when several are as short, and how the same one comes back each time.
- **How `from` and `types` arrive as lists** through the query string, the internal CLI and the external CLI.
- **How search calls the walk:** where it is defined once, and what search passes and gets back.
- **The cursor.** A walk with no `types` follows types `TYPE_PATTERN` doesn't match, which only raw Cypher can make. If walk's cursor carries a relationship type, ledger row `2026-11-16-relationship-cursor-type-narrower` applies to it; settle that row here too, with an amendment to ADR 0013.
- **A start node named twice,** and nodes with no tapestryKey, which list-relationships neither lists nor counts.
- **The test fakes,** which read relationships of a few named types only, one step at a time.

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Rebuild and "Reads stay behind sign-in" bullets)
- Epic: [engineering-team/epics/graph-operations-first-slice.md](../../epics/graph-operations-first-slice.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D6, D12, D13, D15; §5, questions 2 and 7); [docs/GRAPH_OPERATIONS_CATALOG.md](../../../docs/GRAPH_OPERATIONS_CATALOG.md) (Conventions, §1, §10 question 1)
- Today's route: `GET /api/concept-graph/subgraph/:handle` (`src/api/concept-graph/index.js`); the class thread: [BIBLE.md](../../../BIBLE.md) §6
- The conventions this read follows: [ADR graph-operations-first-slice/0011](../../decisions/graph-operations-first-slice/0011-list-elements-and-the-read-conventions.md) (paging, the point of view, a node); [ADR graph-operations-first-slice/0013](../../decisions/graph-operations-first-slice/0013-list-relationships-and-the-relationship-conventions.md) (a relationship, answered and judged); [13-list-relationships.md](13-list-relationships.md)
- Naming a node: [ADR graph-operations-first-slice/0009](../../decisions/graph-operations-first-slice/0009-resolve-and-naming-a-node.md)
- Loom memo #113 (how an edge's author is read), from [the list-elements review](../../reviews/graph-operations-first-slice/11-list-elements.md), finding 9
- The external CLI the agent uses: [stories/graph-operations-foundation/6-external-cli-and-agent-skill.md](../graph-operations-foundation/6-external-cli-and-agent-skill.md)
- ADR: [engineering-team/decisions/graph-operations-first-slice/0014-walk.md](../../decisions/graph-operations-first-slice/0014-walk.md) (and its Amendment 4 to [ADR 0011](../../decisions/graph-operations-first-slice/0011-list-elements-and-the-read-conventions.md))
- Test plan: [14-walk.test-plan.md](14-walk.test-plan.md)
- Review: (filled in after Review phase)
