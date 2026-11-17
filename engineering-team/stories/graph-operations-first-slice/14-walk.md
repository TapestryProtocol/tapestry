# Story 14: `graph walk` — follow chosen relationship types out from one or more nodes, up to a depth, each node reached once with the path that reached it

**Status:** Done
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

## Evidence

### The live check (Implementation, 2026-11-17 UTC, on the code of the implementation commit, `c211051e`)

This ran on a throwaway instance from `scripts/scratch-stack.sh`, never a shared or private one.
- **The instance.** It booted from image `agent-memory-tapestry` with this branch's `src/` mounted, and firmware installed. `lifecycle migrate --migration tapestry-keys` put `tapestry_key` in place, and the check added `nostrUser_pubkey`, as a real instance has them. The branch's `clients/cli` was copied in, on the instance's own nostr-tools 2.10.4 and ajv 8.18.0, the CLI's versions.
- **Keys.** The instance made its own assistant key at boot. A throwaway owner key, a throwaway admin key for the agent and a peer's key were made inside it, and only their public keys left it.
- **Afterwards** it was removed, with its keys.
- **The calls** went through `docker exec` to `127.0.0.1:7778`, a direct-local caller. The agent's went through the instance's nginx.
- **How each answer was judged.** The check read the whole graph: every node's key, labels and author, every relationship, and every NostrUser's influence. It walked the graph again in JavaScript by ADR 0014's rules, keeping only distances and counts. For each walk it compared, across every page:
  - the nodes and each one's steps with that independent walk, each node once and nearest first;
  - `kept`, `leftOut` and `tagsLeftOut`;
  - each path, step by step, against the relationships the graph holds.

  It made 137 checks, and all passed. Two earlier boots stopped on mistakes in the check script, never on the walk: an element with no description, which the new concept's schema requires, and an agent's walk compared with one read from another point of view.

**The seed:**
- walk gadget, made by `graph create-concept`. Sets a and b below its superset were made with Cypher, since create-set isn't on staging yet. `graph create-element` made gadget one, two and deep: one directly in the superset, one in set a and one in set b.
- With Cypher: a peer's element under the superset, with a node of the assistant's behind it (CITES), and the peer's NostrUser.
- With Cypher: a graph the size of Avi's brain, 1,000 nodes and 8,000 typed relationships, 1,000 of each of eight types, between random pairs.
- With Cypher: two hubs, one with 12,000 LINKS out and one with 9,999.

At the end the graph held 26,328 nodes and 33,806 relationships.

**By criterion:**
- **AC1: passes.** Out along the class thread from the header, at depths 1 to 4, the walk reached 1, 4, 6 and 7 nodes; gadget deep was 4 steps away, its path running through both sets. Each of these walks reached exactly what the independent walk reached: in from gadget deep; both ways from the header, at depths 2 and 3; from three elements at once; and along HAS_TAG.
- **AC2: passes.** Every path of every walk ran from its start to its node along relationships the graph holds, at the least number of steps.
- **AC3: passes.** Along HAS_TAG the walk reached the header's 6 tag nodes, which have no author, so the owner's point of view counts them. With no types it passed the same 6 by and counted them. Both ways from the header to depth 3, it passed 431 tag nodes by.
- **AC4: passes.**
  - **The peer at 0.2:** the walk stepped onto the peer's element, and on to the node behind it.
  - **Then 0.01, with no write between:** the element was left out (`leftOut` one more), and nothing behind it was reached.
  - `everyone` stepped onto both. The owner's own pubkey walked as the default. A stranger's was refused `unknown-pov`. A start by the peer at 0.01 was answered and walked from.
- **AC5: passes.**
  - **The Avi-size graph, both ways with no types, depth 3:** 943 nodes, complete, in 19 pages of 50 at 191 ms median (344 ms at most, 3.8 s in all), or 5 pages of 200 at 189 ms. To depth 10: 999 nodes, 5 pages of 200 at 339 ms median and 474 ms at most. Out along two types to depth 5: 14 nodes, 144 ms.
  - **The hub of 12,000** stopped short before its first step (`complete` false, `finished` 0, no nodes), in 57 ms. Both hubs at once, 21,999 relationships, stopped short too.
  - **The hub of 9,999** was complete: every leaf once, in 50 pages of 200, at 70 ms median, 86 ms at most and 3.6 s in all.
  - **The bound stays 10,000.** A page at the bound took 70 ms, and an Avi-size walk with no types stayed under it to depth 10, so nothing called for raising or lowering it.
- **AC6: passes.** A key no node has, and a change entry's, got 404 `unknown-node`, naming `from`. Depth 11, a malformed type, `direction=OUT` and 101 starts got `invalid-input`, each naming its input.
- **AC7: passes.**
  - `tapestry graph walk` in the instance, with `--from` and `--types` repeated, answered what the route answered.
  - **The admin agent,** with its own key, through nginx and the external CLI:
    - `whoami` exited 0 with the agent's own pubkey, not the owner's;
    - it walked from the header to its elements 2 a page, to its last cursor, getting each node once and in order, as the route answers from the owner's point of view;
    - it walked in from two elements, with `--from` and `--types` repeated;
    - it was refused a key no node has (exit 1, `unknown-node`).
  - A visitor through nginx got 401.
  - The relay held 450 events before and after the walks. The graph held 4 change entries before and after: the concept's and its three elements'.

### The suites (Implementation, 2026-11-17 UTC)

Each ran on its own on the Mac Studio, never the full `npm test`, with every endpoint dead:

| Suite | Passed |
|---|---|
| `test/operations/walk.test.js` | 11 of 11 |
| `test/operations/graph/walk.test.js` | 30 of 30 |
| `test/operations/graph/walk-agent-through-cli.test.js` | 2 of 2 |
| `test/operations/graph-fake.test.js` | 27 of 27 |
| `test/operations/reads.test.js` | 21 of 21 |
| `test/operations/graph/list-relationships.test.js` | 26 of 26 |
| `test/operations/graph/list-relationships-agent-through-cli.test.js` | 2 of 2 |
| `test/operations/graph/list-elements.test.js` | 30 of 30 |
| `test/operations/graph/link-set.test.js` | 21 of 21 |
| `test/operations/resolve.test.js` | 11 of 11 |
| `test/operations/graph/history.test.js` | 8 of 8 |
| `test/openapi-coverage.test.js` | 13 of 13 |
| `test/admin-action-sweep.test.js` | 9 of 9 |

- **A scoped gate** over the same 13 suites recorded PASS, 211 passed, on `c211051e` (`npm run gate:status -- --label a10-14-walk-impl-committed`).
- **The catalog loads.** A script doing what `test/operations.test.js`'s L1 and L4 check found the catalog loads 22 operations with no problems, and that loading it and the route table requires no driver, LMDB or Redis module.
- **The full gate** runs in the pull request's CI.

### After the review (2026-11-17 UTC)

The review passed with nothing blocking ([14-walk.md](../../reviews/graph-operations-first-slice/14-walk.md)). Its three non-blocking asks were then fixed on this branch:
1. **The tie-break's order** is tested. W32 walks from ord0 to ordX, which it reaches through the lesser parent though that parent's type is the greater, and to ordY, which it reaches out from the greater parent rather than in from the lesser. With `walk.js` comparing the type before the parent, W32 fails.
2. **A node met again a step later** is tested. W31 walks from rm0, whose left-out neighbour and tag node are met again from rmA at step 2, and each counts once. Without either of the two lines that add them to what the walk has met, W31 fails.
3. **The bound's wording** now says what it counts, in /docs, in `complete`'s description and in the catalog's row: the relationships a walk reads to nodes it hasn't met yet. Relationships back to nodes it has met cost work the bound doesn't count, and no walk through a dense cluster, such as the trust pipeline's FOLLOWS, was timed. So search (A10.8) times one before it leans on the bound (a memo on A10.8).

The four notes the review recorded stand as it gives them. The 13 suites passed again afterwards, `graph/walk.test.js` with 32 of 32: a scoped gate recorded PASS, 213 passed, on `1f595135` with the fix's six files in place before their commit (`npm run gate:status -- --label a10-14-walk-after-review`), and the reviewer's round 2 gate on `14c451ae` itself gave the same (`a10-14-walk-review-round2`).

Round 2 of the review ([14-walk.md](../../reviews/graph-operations-first-slice/14-walk.md), "Round 2") found the three fixes right, and one older gap, note 8: `complete`'s description read as if the bound were one step's. It and the matching sentence in /docs now say a walk stops when its next step would take it past the bound, which counts the whole walk.

## Deviations

- **`walk()` also throws for a `types` list that is empty or longer than `MAX_TYPES`,** as it throws for a `from` of the wrong length, and when `read` isn't a function or `pov` isn't a resolved point of view. ADR 0014 Decision 1 named the other throws. Each is a programming error, which the inputs' schemas refuse first for graph walk.
- **The step statement checks its direction, its types and its `LIMIT` again before writing them into Cypher's text,** as list-relationships checks its type again. The walk has checked them already, so these checks are for a caller that skips it.
- **The /docs text and the `complete` description give the bound as "10,000",** grouped from `BOUND` with no locale data, so they change with it.

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
- Review: [engineering-team/reviews/graph-operations-first-slice/14-walk.md](../../reviews/graph-operations-first-slice/14-walk.md)
