# Story 11: `graph list-elements` — the elements of a concept or a set, from a point of view

**Status:** Approved
**Created:** 2026-11-15
**Type:** Feature
**Loom:** A10.11 — https://loom.brainstorm.world/t/A10.11

## Background

Loom's A10.11 asks for one graph read (catalog §1, Graph reads): **`graph list-elements`**, "the elements of a concept or a set, through its class thread", taking `concept` or `set`, `direct?`, `pov?`, `limit` and `cursor`, and answering the elements. Done, for Loom, is when "it is declared once; answers at `/api/tapestry/graph/list-elements` for the owner and admins; has its internal CLI command and /docs entry made from the declaration; has a test for each thing it refuses or reports; and an agent has used it through the external CLI."

Ten facts about today's instance shape the story:

- **It is the read that sets the pattern.** It is the first graph read after `graph history`, and eight more are proposed on Loom: orient, search, resolve, describe-concept and describe-node, class-thread-path, list-relationships and walk (A10.7–A10.14). The catalog's conventions say that every read "returns a capped number of items with a cursor", and that "a read that can include other authors' nodes takes a point of view, `pov`, the owner's by default". Nothing yet says what a cursor is, what `pov` takes, or how a node is answered. This story settles them once, for every read that follows.
- **A concept's elements are what its class thread reaches.** A concept's header points to its superset, the superset to its sets and each set to the sets below it, and a superset or a set to its elements (BIBLE §6, The Class Thread; §10, rule 3). A set may have more than one parent, and a superset put under another concept's set makes its elements that concept's too (story 28). The field mapping already reads a concept's elements this way, its sets' elements included, and a node reached by two paths counts once (ADR graph-operations-foundation/0005, Decision 6).
- **Implicit members aren't elements yet.** A node that names a concept in its `z` tag, but that no element link reaches, isn't on the class thread until `wire-implicit-elements` wires it. A firmware install runs that pass.
- **Today's read walks, but doesn't list.** `GET /api/concept-graph/subgraph/:handle` (not in /docs) starts from a node's nostr address and follows every relationship type, at most three levels out. It has no paging and no point of view, and visitors can call it (catalog §10, question 1). Nothing lists a concept's or a set's elements by tapestryKey, a page at a time.
- **Paging has one precedent.** `graph history` answers up to `limit` entries (1 to 200, 50 by default), newest first, with a `cursor` for the next page that is null on the last. It refuses a cursor it didn't give with `invalid-cursor`.
- **An element's membership is its author's claim.** Each node records its author as `pubkey`. That is the event's author for a node the nostr import made, and this instance's assistant for nodes that today's signing routes, add-subset and the new graph writes make (ADR graph-operations-first-slice/0016, Decision 1). In the class-thread spec, the child's own signed event claims its parent, so whether a node belongs to a concept is its author's claim (protocols/drafts/class-thread-relationships.md). Under D4 the instance records a peer's claims as theirs, and the point of view decides at read time whether they count (CLAUDE.md, principles 1–3).
- **The owner's point of view is in the graph.** BIBLE §27 defines three points of view. The Owner's lives in Neo4j: GrapeRank's `influence`, the `verified*Count`s and `hops` on each `NostrUser` node, always available locally. A verified follower is one whose influence is above `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF`, 0.05 by default. The House and Personalized points of view come from kind 30382 assertions loaded into Meilisearch (`wot_rank_<suffix>`), outside the graph. Each customer's GrapeRank scorecards are also in Neo4j (`NostrUserWotMetricsCard`). Whether those are a source for the Personalized point of view is BIBLE §27's open question 5.
- **Reads stay behind sign-in.** The book's frame: "Until read visibility is decided (catalog §10, question 1), the new read routes require an owner or admin sign-in." `graph history` is for the owner and admins.
- **A read writes nothing.** `graph history` opens no write transaction and records no change entry.
- **Agents already have a way in.** The external CLI (A10.6) turns each operation the instance lists into a command, so this one reaches agents with no change to it.

## User-facing description

As an admin agent rebuilding or exploring a concept graph, or the owner, I want to list the elements of a concept, or of one of its sets, a page at a time, so that I can see what a concept holds without writing Cypher.

As the same agent, I want that list read from a point of view, the owner's unless I ask for another, so that a node some untrusted author claims belongs to a concept isn't counted as one of its elements, and I'm told how many the point of view left out.

As whoever builds the next graph read, I want paging, the point of view and a node's shape settled once, so that every read answers the same way.

## Acceptance criteria

- [ ] **AC1 — The elements of a concept or a set.** Given the owner or an admin is signed in, when they call `GET /api/tapestry/graph/list-elements` with `concept`, the tapestryKey of a concept's header, then the answer lists the concept's elements: every node its class thread reaches, through its sets and the sets below them, each once however many paths reach it. With `set`, the tapestryKey of a set or of a concept's superset, it lists the elements that set's part of the class thread reaches: its own, and those of the sets below it. With `direct=true`, either one lists only the elements directly under the superset or the set, leaving out those in the sets below. The answer names the concept or set it listed and the point of view it read from. A concept or set with no elements answers an empty list.
- [ ] **AC2 — Each element, answered.** Each element comes with its tapestryKey, its name, its nostr address (null when it has none), its author's pubkey, and whether it is the instance's own (its assistant's or its owner's). The later reads answer a node with the same facts under the same names (open question 3).
- [ ] **AC3 — Page by page.** A page holds at most `limit` elements (1 to 200, 50 by default), in a stable order, with a cursor for the next page that is null on the last. Passing each page's cursor in turn answers every element exactly once. An element added or taken out between two pages doesn't make any other element appear twice or go missing. A `limit` out of range is refused, naming `limit`. A cursor that isn't one this read gave, for the same concept or set, the same `direct` and the same point of view, is refused.
- [ ] **AC4 — From a point of view: the owner's, by default** (open questions 1 and 2). With no `pov`, an element counts when its author is the instance's own, or someone the owner's web of trust scores above the instance's verified cutoff. The rest are left out. The answer says how many elements the point of view kept and how many it left out, across the whole concept or set and not just the page. Until the owner's scores have been computed, only the instance's own elements count, and the answer says the scores aren't there yet. `pov=everyone` counts every author's claims and leaves nothing out. Nothing about a point of view is stored: the same graph, read from another point of view or after the owner's scores change, answers differently with no write in between. A `pov` the instance can't read from is refused, saying which points of view it can.
- [ ] **AC5 — What it refuses.** list-elements refuses each of these, changes nothing, and says in words what was wrong, naming the input:
  - neither `concept` nor `set`, or both;
  - a `concept` or `set` that names no node of the graph;
  - a `concept` that isn't a concept header;
  - a `set` that is neither a set nor a superset. For a concept header, the refusal says to pass it as `concept`;
  - an input that isn't a tapestryKey, a `direct` that isn't true or false, and an input the read doesn't take.
- [ ] **AC6 — A read, behind sign-in, that agents can use.** list-elements writes nothing: no change, and no change entry. A caller who isn't signed in is refused with 401, and a signed-in person who is neither the owner nor an admin with 403. It is listed for agents and has its `/docs` entry, both made from its declaration. Someone with a shell inside the instance runs `tapestry graph list-elements --concept <key>` with no sign-in and gets the route's answers. On a scratch stack, an admin agent with its own key lists a concept's elements page by page, then a set's, through the external CLI (A10.6) with no change to the CLI.
- [ ] **AC7 — The conventions, written once.** The paging, the point of view and a node's shape are each defined once. They are written into the catalog's Conventions, so the reads that follow (A10.7–A10.14) use them as they are. `graph history` keeps answering as it does today.

Seven criteria, for one read. AC7 is what makes this story the pattern for the rest, and it adds no behavior of its own.

## Concepts touched

The handles use this instance's assistant pubkey (`GET /api/assistant/pubkey`). It differs on every instance, so it is never written into code.

- `39998:<TA>:concept-header` — concept header (read): `concept` names one.
- `39998:<TA>:class-thread` — class thread (read): the pattern the read follows from a concept to its elements.
- `39998:<TA>:superset` — superset (read): where a concept's elements start, and a `set` may name one.
- `39998:<TA>:set` — set (read): a `set` may name one, and its elements and the sets below it are listed.
- `39998:<TA>:nostr-user` — nostr user (read): the authors whose trust the owner's point of view weighs.
- `39998:<TA>:web-of-trust` and `39998:<TA>:graperank` — the owner's web of trust and its scores (read): what decides whether another author's element counts.
- Nothing in this story changes a firmware concept's definition.

## Out of scope

- **Implicit members:** a node that names a concept only in its `z` tag isn't listed until it is wired (`wire-implicit-elements` today, `import nostr` later, A10.32).
- **Points of view besides the owner's and everyone's:** a customer's GrapeRank scorecards, and the House and Personalized points of view in Meilisearch (BIBLE §27, open question 5). The `pov` input leaves room for them without a change for callers.
- **Anything more about an element:** its fields, labels, relationships or JSON (`graph describe-node`, A10.10), and listing or filtering elements by a field (`graph search`, A10.8).
- **Naming a concept or a set by its name, slug or address** (`graph resolve`, A10.9): both inputs take tapestryKeys.
- **An order the owner chooses** for a concept's elements, as in a ranked list (catalog §10, question 7).
- **Counting a concept's elements without listing them** (`graph orient` and `describe-concept`, A10.7 and A10.10).
- **Letting visitors read** (catalog §10, question 1).
- **Today's subgraph route,** which stays as it is (D15), and any change to `graph history`.
- Merging to staging and shipping to production, which wait for the owner's OK (the book's frame).

## Open questions

To resolve at this gate. Each carried the drafting's proposal, for the owner to confirm or change; the owner approved the story as drafted, with all three (2026-11-15).

1. **What `pov` takes.** *Resolved: the owner's point of view, by default, or `everyone`; any other is refused for now* (the drafting's proposal, approved by the owner, 2026-11-15). AC4. The owner's is the one point of view the graph holds that BIBLE §27 names as a source. A customer's scorecards are in Neo4j too, but whether they count as a Personalized source is §27's open question 5. The House and Personalized points of view live in Meilisearch, and a graph read shouldn't depend on the search index being up. `everyone` keeps every claim the instance has recorded, for an owner or agent who wants the raw picture; it is never the default. The input's shape leaves room for more points of view later, so that adding one needs no change for callers.
2. **Which authors count from the owner's point of view.** *Resolved: the instance's own, meaning its assistant and its owner, always; anyone else when GrapeRank scores their influence above `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` (0.05 by default), the line that already decides who is a verified follower* (the drafting's proposal, approved by the owner, 2026-11-15). AC4. An admin counts by score, like anyone else: an admin's writes through the operations are recorded under the assistant's key, and being an admin is permission to write, not a trust score. Other choices: within so many follow hops of the owner; followed by the owner; or a cutoff the caller passes.
3. **What each element is answered with.** *Resolved: its tapestryKey, name, nostr address, author, and whether it is the instance's own* (the drafting's proposal, approved by the owner, 2026-11-15). AC2. That is enough to act on an element, read its name, find its letter, and judge its claim. More (its fields, labels, relationships, JSON) is `describe-node`'s. The names line up with ADR 0016's answers, which call a nostr address `address`.

For Architecture, not this gate:

- **Order.** What order elements come in: by name, or by a key that never changes. And what happens to an element renamed between two pages, given AC3.
- **What counts as a set, a superset and a concept header** for the inputs, in line with story 28's answers.
- **How trust filters at query time** against the owner's scores, and how the read tells "no scores yet" from "scored, and below the cutoff".
- **How a node's name is read:** its `tapestryValue` (D11), else its `name`.
- **What a page costs** on a large concept, since each page walks the whole class thread. Measure it on a scratch stack at a size past the rebuild's.
- **Where the conventions live** so the later reads use them, without changing `graph history` or the files story 16's session owns (`src/operations/changes.js` and the test fakes).

## Linked artifacts

- Book: [engineering-team/audits/graph-operations-first-slice/book.md](../../audits/graph-operations-first-slice/book.md) (the frame's Rebuild and "Reads stay behind sign-in" bullets)
- Epic: [engineering-team/epics/graph-operations-first-slice.md](../../epics/graph-operations-first-slice.md)
- Design: [docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md](../../../docs/GRAPH_OPERATIONS_DESIGN_HANDOFF.md) (D4, D6, D9, D11, D13, D15); [docs/GRAPH_OPERATIONS_CATALOG.md](../../../docs/GRAPH_OPERATIONS_CATALOG.md) (Conventions, §1, §10 question 1)
- Points of view: [BIBLE.md](../../../BIBLE.md) §27
- How the field mapping reads a concept's elements: [ADR graph-operations-foundation/0005](../../decisions/graph-operations-foundation/0005-field-mapping.md), Decision 6
- The read this one follows, and its paging: [stories/graph-operations-foundation/4-the-write-path.md](../graph-operations-foundation/4-the-write-path.md) (AC5); [ADR graph-operations-foundation/0004](../../decisions/graph-operations-foundation/0004-the-write-path.md), Decision 7
- The external CLI the agent uses: [stories/graph-operations-foundation/6-external-cli-and-agent-skill.md](../graph-operations-foundation/6-external-cli-and-agent-skill.md)
- The sibling stories in this epic: [16-create-concept-and-update-concept.md](16-create-concept-and-update-concept.md), [28-link-set-and-unlink-set.md](28-link-set-and-unlink-set.md)
- ADR: [engineering-team/decisions/graph-operations-first-slice/0011-list-elements-and-the-read-conventions.md](../../decisions/graph-operations-first-slice/0011-list-elements-and-the-read-conventions.md)
- Test plan: [11-list-elements.test-plan.md](11-list-elements.test-plan.md)
- Review: (filled in after Review phase)
